# عزل إلزامي — بروتوكول 1059
# يُمنع استيراد master_core_engine.py أو أي ملف يُنفَّذ عند الاستيراد.
# task_engine لا يُنفَّذ عند الاستيراد، واستيراده هنا لخدمة المسارات فقط.

import json
import re
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .content_loader import (
    ContentError,
    list_swot_overrides,
    list_task_overrides,
    load_role_content,
    next_custom_code,
    reset_all_overrides,
    reset_override,
    save_override,
    save_swot_override,
    save_task_override,
)
from .daily_tasks import autofill_daily_tasks, dashboard_payload, save_task
from .database import OFFICIAL_PRINCIPAL_NAME, connect, init_db
from .noor_import import fold_name, parse_enrichment, parse_students, parse_teachers, parse_timetable, stamp
from .phrase_bank import phrase_catalog, phrases_for_context, render_phrase, seed_phrase_bank, suggest_for_task
from .command_room import list_rules, list_today_signals, record_signal_action, refresh_signals
from .soft_periods import (
    add_soft_evidence_images,
    dashboard_bundle,
    remove_soft_evidence_image,
    save_follow,
    save_follow_bulk,
    save_slot,
)
from .visual_evidence import (
    add_visual_files,
    add_visual_link,
    can_delete_visual,
    ensure_visual_evidence_table,
    get_visual_item,
    list_visual_evidence,
    rebind_visual_evidence,
    remove_visual_item,
)
from .excel_parser import parse_evidence_staff

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from .task_engine import _ROLE_BANK, _load_task_bank, ensure_role_plan, generate_plans, seat_role

CANVAS_DIR = _ROOT / "Print_Canvas"
_APPROVAL_PATH = CANVAS_DIR / "banks" / "approval_authorities.json"
SCHOOL_DATA = _ROOT / "School_Data"
CALENDAR_PATH = Path(__file__).resolve().parent / "calendars" / "calendar_1448.json"
REGISTERS_DIR = Path(__file__).resolve().parent / "registers_bank"
# المراحل الدراسية العامة المطابقة لعينة الطلب
_EVIDENCE_FILE = "توثيق شواهد التقويم والاعتماد المدرسي - متوسطة سعد بن الربيع الأنصاري (الردود).xlsx"
_STAGES = {"ابتدائي", "متوسط", "ثانوي"}
_GENDERS = {"male", "female"}
_OFFICIAL_PRINCIPAL_NAME = "نايف بن سمير حجيف المخلفي"
_DUAL_ROLES = {
    "1009058346": ["محضر مختبر علوم", "أمين مصادر تعلم ومحضر معمل حاسب"],
    "1008379958": ["مسؤول النظام والقيادة الشاملة", "معلم رياضيات"],
}
_ACADEMIC_VICE_NAME = "محمد بن فايز بن هلال الحربي"
_STUDENTS_VICE_NAME = "خالد بن علي بن حجري العمري"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """يهيئ قاعدة البيانات ويحصّن مرآة الأداء عند الإقلاع."""
    import asyncio

    from .event_bus import bind_loop, hub
    from .disk_watch import watch

    bind_loop(asyncio.get_running_loop())
    bus_task = asyncio.create_task(hub())
    disk_task = asyncio.create_task(watch())
    init_db()
    try:
        from .accreditation_bank import store_accreditation_cycles

        stored = store_accreditation_cycles()
        print(f"Accreditation bank: {stored}")
    except Exception as error:
        print(f"Accreditation bank skipped: {error}")
    try:
        from . import seed_pilot_data

        if seed_pilot_data.seed_exists() and not seed_pilot_data.already_imported():
            imported = seed_pilot_data.apply()
            print(f"Pilot seed imported: {imported} rows")
    except Exception as error:
        print(f"Pilot seed import failed: {error}")
    try:
        from .binding_guard import sync_performance_mirror

        sync_performance_mirror(force=True)
    except Exception:
        pass
    try:
        yield
    finally:
        disk_task.cancel()
        bus_task.cancel()


app = FastAPI(title="منظومة الخطط المدرسية الذكية", lifespan=lifespan)

_PASSWORD_OPEN = {
    "/api/login",
    "/api/trial-launch",
    "/api/staff-directory",
    "/api/session",
    "/api/session/password",
}


@app.middleware("http")
async def hold_shared_password(request: Request, call_next):
    """جلسة كلمة التجربة لا تفتح العمل قبل تعيين كلمة خاصة."""
    path = request.url.path
    if request.method != "OPTIONS" and path.startswith("/api/") and path not in _PASSWORD_OPEN:
        token = str(request.headers.get("x-session-token") or "").strip()
        if token:
            from .access import session_is_limited

            if session_is_limited(token):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "عيّن كلمة مرور خاصة قبل متابعة العمل."},
                    headers={"X-Password-Change": "1"},
                )
    return await call_next(request)


@app.get("/health")
def health():
    """مسار فحص جاهزية الخدمة."""
    return {"status": "ok"}


@app.websocket("/ws/events")
async def events_socket(websocket: WebSocket):
    """يبث تغييرات القاعدة للشاشات المفتوحة. قرار 282."""
    from .event_bus import register, unregister

    await websocket.accept()
    register(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        unregister(websocket)
    except Exception:
        unregister(websocket)


@app.get("/api/trial-launch")
def trial_launch_api():
    """حالة الإطلاق التجريبي للمنسوبين (كلمة المرور تظهر فقط أثناء التفعيل)."""
    from .access import load_trial_config

    cfg = load_trial_config()
    enabled = bool(cfg.get("enabled"))
    payload = {
        "enabled": enabled,
        "title": cfg.get("title") or "",
        "note": cfg.get("note") or "",
        "open_all_windows": bool(cfg.get("open_all_windows")) if enabled else False,
    }
    if enabled:
        payload["must_replace_password"] = True
    return payload


@app.get("/api/performance-metrics")
def performance_metrics_api():
    """يقرأ مركز الأداء الكنسي فقط ويزامن المرآة قبل الإرجاع."""
    from .binding_guard import load_canonical, sync_performance_mirror

    try:
        sync_performance_mirror(force=True)
        return load_canonical()
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except (OSError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=500, detail="تعذر قراءة مركز الأداء") from error


@app.get("/api/binding-audit")
def binding_audit_api(x_session_token: str = Header(default="")):
    """فحص طبقات الترابط — للمدير/الجلسة فقط أثناء التحصين."""
    from .access import require_user
    from .binding_guard import audit_binding_layers, write_fortification_report

    try:
        require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    audit = audit_binding_layers()
    write_fortification_report(audit)
    return audit


@app.get("/login")
def login_page():
    """يقدم نموذج الدخول."""
    return FileResponse(CANVAS_DIR / "login.html")


@app.get("/portal-student.html")
def portal_student_page():
    return FileResponse(CANVAS_DIR / "portal-student.html")


@app.get("/portal-parent.html")
def portal_parent_page():
    return FileResponse(CANVAS_DIR / "portal-parent.html")


@app.get("/portal-owner.html")
def portal_owner_page():
    return FileResponse(CANVAS_DIR / "portal-owner.html")


class LoginBody(BaseModel):
    national_id: str = ""
    password: str = ""


class PasswordBody(BaseModel):
    national_id: str = ""
    password: str = ""


class OwnPasswordBody(BaseModel):
    password: str = ""
    confirm: str = ""


class SessionRoleBody(BaseModel):
    role: str = ""


class RestoreBody(BaseModel):
    name: str = ""


def _token(x_session_token: str) -> str:
    return str(x_session_token or "").strip()


def _auth_user(x_session_token: str):
    """يشترط جلسة صالحة؛ يرفض الطلب بلا توكن أو بتوكن باطل."""
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


@app.post("/api/login")
def login_api(body: LoginBody):
    """يدخل برقم الهوية وكلمة المرور المخزّنة كبصمة."""
    from .access import login

    user = login(body.national_id, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="رقم الهوية أو كلمة المرور غير صحيحة")
    return user


@app.get("/api/session")
def session_api(x_session_token: str = Header(default="")):
    from .access import session_user
    from .session_signature_api import get_user_signature_path

    user = session_user(_token(x_session_token))
    if not user:
        raise HTTPException(status_code=401, detail="لا جلسة")
    # استثناء مبرر: حقل nullable واحد لمعرفة وجود توقيع محفوظ
    user["signature_path"] = get_user_signature_path(user.get("id") or "")
    return user


@app.post("/api/session/role")
def choose_session_role(body: SessionRoleBody, x_session_token: str = Header(default="")):
    """يثبت دور هذه الجلسة: معلم أو مدير النظام، لمن يملك الدورين في السجل."""
    from .access import set_session_role

    try:
        role = set_session_role(_token(x_session_token), body.role)
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"ok": True, "role": role}


@app.post("/api/session/password")
def change_own_password_api(body: OwnPasswordBody, x_session_token: str = Header(default="")):
    """يبدّل كلمة الجلسة الحالية ولا يمس الدور."""
    from .access import change_own_password, require_user

    try:
        user = require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    if str(body.password or "") != str(body.confirm or ""):
        raise HTTPException(status_code=400, detail="كلمتا المرور غير متطابقتين")
    try:
        change_own_password(user["id"], body.password)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"ok": True}


# راوتر التوقيع — يُسجَّل مبكراً قبل Static mounts
from .session_signature_api import router as session_signature_router

app.include_router(session_signature_router)

from .staff_session_api import router as staff_session_router

app.include_router(staff_session_router)

from .leadership_session_api import router as leadership_session_router

app.include_router(leadership_session_router)

from .council_session_api import router as council_session_router

app.include_router(council_session_router)

from .teacher_deliverables_api import router as teacher_deliverables_router

app.include_router(teacher_deliverables_router)

from .council_signature_api import router as council_signature_router

app.include_router(council_signature_router)

from .knowledge_bank_api import router as knowledge_bank_router

app.include_router(knowledge_bank_router)

from .program_session_api import router as program_session_router

app.include_router(program_session_router)

from .internal_assignments_api import router as internal_assignments_router

app.include_router(internal_assignments_router)

from .program_images_api import router as program_images_router

app.include_router(program_images_router)

from .evidence_session_api import router as evidence_session_router

app.include_router(evidence_session_router)

from .planning_session_api import router as planning_session_router

app.include_router(planning_session_router)

from .committee_session_api import router as committee_session_router

app.include_router(committee_session_router)

from .consistency_api import router as consistency_router
from .evaluation_api import router as evaluation_router

app.include_router(consistency_router)
from .health_api import router as health_router

app.include_router(health_router)
app.include_router(evaluation_router)

from .role_desk_api import router as role_desk_router

app.include_router(role_desk_router)

from .env_evidence_session_api import router as env_evidence_session_router

app.include_router(env_evidence_session_router)

from .students_support_api import router as students_support_router

app.include_router(students_support_router)

from .import_center_api import router as import_center_router

app.include_router(import_center_router)

from .student_registry_session_api import router as student_registry_session_router

app.include_router(student_registry_session_router)

from .retention_api import router as retention_router

app.include_router(retention_router)

from .staff_opinions_api import router as staff_opinions_router

app.include_router(staff_opinions_router)

from .witness_files_api import router as witness_files_router

app.include_router(witness_files_router)

from .indicator_dossiers_api import router as indicator_dossiers_router

app.include_router(indicator_dossiers_router)

from .search_api import router as search_router

app.include_router(search_router)

from .classroom_visit_api import router as classroom_visit_router

app.include_router(classroom_visit_router)

from .visit_plan_api import router as visit_plan_router

app.include_router(visit_plan_router)

from .job_performance_api import router as job_performance_router

app.include_router(job_performance_router)

from .accreditation_session_api import router as accreditation_session_router

app.include_router(accreditation_session_router)

from .nafs_session_api import router as nafs_session_router

app.include_router(nafs_session_router)

from .portal_session_api import router as portal_session_router

app.include_router(portal_session_router)

from .portal_owner_api import router as portal_owner_router

app.include_router(portal_owner_router)

from .portal_identity_api import router as portal_identity_router

app.include_router(portal_identity_router)

from .portal_radar_api import router as portal_radar_router

app.include_router(portal_radar_router)

from .nafs_misconception_lab import router as nafs_misconception_router

app.include_router(nafs_misconception_router)

from .portal_games_api import router as portal_games_router

app.include_router(portal_games_router)

from .nafs_unit2_ssot import router as nafs_unit2_router

app.include_router(nafs_unit2_router)

from .nafs_adaptive_engine import router as nafs_adaptive_router

app.include_router(nafs_adaptive_router)

from .nafs_readalong_api import router as nafs_readalong_router

app.include_router(nafs_readalong_router)

from .nafs_remedial_clinics import router as nafs_remedial_clinics_router

app.include_router(nafs_remedial_clinics_router)


@app.get("/api/users")
def users_api(x_session_token: str = Header(default="")):
    from .access import require_principal, users_with_password

    try:
        require_principal(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    return {"users": users_with_password()}


@app.post("/api/users/password")
def user_password_api(body: PasswordBody, x_session_token: str = Header(default="")):
    from .access import require_principal, set_password

    try:
        require_principal(_token(x_session_token))
        set_password(body.national_id, body.password)
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"ok": True}


@app.get("/api/backups")
def backups_api(x_session_token: str = Header(default="")):
    from .access import list_backups, require_user

    try:
        require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    return {"backups": list_backups()}


@app.post("/api/backups")
def create_backup_api(x_session_token: str = Header(default="")):
    from .access import create_backup, require_user

    try:
        require_user(_token(x_session_token))
        created = create_backup()
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    return created


@app.post("/api/backups/restore")
def restore_backup_api(body: RestoreBody, x_session_token: str = Header(default="")):
    from .access import require_principal, restore_backup

    try:
        require_principal(_token(x_session_token))
        restored = restore_backup(body.name)
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return restored


class OverrideBody(BaseModel):
    """تعديل حقل واحد من محتوى الدور."""

    field_path: str
    value: str


class DeckTeammate(BaseModel):
    """صاحب خطة في فريق التخطيط. الاسم الفارغ يُستكمل من الاسم المعتمد."""

    role_id: str = ""
    name: str = ""
    title: str = ""


class FacilitySeat(BaseModel):
    """ما حُفظ في بيانات المنشأة. الحقل الذي لم يُحفظ يبقى فارغًا."""

    school_name: str = ""
    statistical_number: str = ""
    stage: str = ""
    founded_hijri: str = ""
    founded_gregorian: str = ""
    district: str = ""
    address: str = ""
    education_administration: str = ""
    phone: str = ""
    fax: str = ""
    email: str = ""
    website: str = ""
    distance_admin_km: str = ""
    distance_secondary: str = ""
    distance_secondary_unit: str = ""
    distance_middle: str = ""
    distance_middle_unit: str = ""
    distance_primary: str = ""
    distance_primary_unit: str = ""
    building_type: str = ""
    built_area: str = ""
    yard_area: str = ""
    room_count: str = ""
    classroom_count: str = ""
    bathroom_count: str = ""
    admin_room_count: str = ""
    lab_count: str = ""
    teacher_room_count: str = ""
    workshop_count: str = ""
    warehouse_count: str = ""


class SeatDeckBody(BaseModel):
    """طلب تسكين شرائح دور واحد. الحقول الفارغة تُستكمل من المحفوظ."""

    role: str = "principal"
    gender: str = "male"
    weeks_count: int | None = None
    school_name: str = ""
    administration: str = ""
    year_label: str = ""
    author_name: str = ""
    author_role: str = ""
    stage: str = ""
    founded_hijri: str = ""
    founded_gregorian: str = ""
    address: str = ""
    facility: FacilitySeat = Field(default_factory=FacilitySeat)
    team: list[DeckTeammate] = []
    names_resolved: bool = False


class DeckCellBody(BaseModel):
    """تعديل خلية واحدة. النص يُحفظ كما كُتب."""

    role: str = "principal"
    field_path: str
    value: str = ""


class DeckTombstoneBody(BaseModel):
    """شاهد حذف بند حتى لا يعود مع إعادة التسكين."""

    role: str = "principal"
    task_code: str


_DECK_CELL_FIELDS = {"title", "execution_method", "execution_time", "evidence", "executor"}


_DECK_ROLES = {
    "principal": ("مدير المدرسة", "نايف بن سمير بن حجيف الحربي"),
    "vice_teachers": ("وكيل الشؤون التعليمية", "محمد بن فايز بن هلال الحربي"),
    "vice_students": ("وكيل شؤون الطلاب", "خالد بن علي بن حجري العمري"),
    "student_counselor": ("الموجه الطلابي", "منور بن محمد بن عليان اللهيبي"),
    "activity_leader": ("رائد النشاط الطلابي", "محمد حامد عماش السهلي"),
}


def _stage_label(explicit: str, school_name: str) -> str:
    """المرحلة المكتوبة، وإلا تُستنتج من اسم المدرسة المحفوظ."""
    text = explicit.strip()
    if text:
        return text
    for token, label in (("متوسطة", "المتوسطة"), ("ثانوية", "الثانوية"), ("ابتدائية", "الابتدائية")):
        if token in school_name:
            return label
    return ""


def _founded_line(hijri: str, gregorian: str) -> str:
    """التاريخ الهجري ثم الميلادي في سطر واحد، والفارغ لا يُختلق."""
    h = hijri.strip()
    g = gregorian.strip()
    if h and g:
        return f"{h} — {g}"
    return h or g


def _ministry_number(value: str) -> str:
    """الرقم الوزاري لهذه المدرسة مع رمز المنظومة. الرقم المختلف يبقى كما حُفظ."""
    digits = value.replace("S-", "").replace("s-", "").strip()
    if not digits or digits == "40341":
        return "40341 / رمز المنظومة: 1059"
    return value


def _first(*values: object) -> str:
    """أول قيمة محفوظة غير فارغة."""
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def _measure(value: str, unit: str) -> str:
    """المسافة مع وحدتها المختصرة. بلا رقم تبقى فارغة حتى لا تظهر الوحدة وحدها."""
    text = value.strip()
    if not text:
        return ""
    mark = {"متر": "م", "كم": "كم"}.get(unit.strip(), unit.strip())
    return f"{text} {mark}".strip() if mark else text


def _role_is_teacher(role: str) -> bool:
    """الصفة معلم، لا الوكيل ولا المدير ولا بقية المنسوبين."""
    for part in (role or "").split("،"):
        title = part.strip()
        if not title or "وكيل" in title or "مدير" in title:
            continue
        if title == "معلم" or title.startswith("معلم "):
            return True
    return False


def _student_count() -> str:
    """عدد صفوف سجل الطلاب. الجدول الفارغ يبقي الخانة فارغة."""
    try:
        connection = connect()
        try:
            row = connection.execute("SELECT COUNT(*) FROM noor_students").fetchone()
        finally:
            connection.close()
    except Exception:
        return ""
    count = int(row[0]) if row else 0
    return str(count) if count else ""


def _teacher_names() -> dict:
    """أسماء المعلمين فقط، بالمفتاح رقم الهوية. غير المعلم لا يُعرض في المتابعة."""
    try:
        connection = connect()
        try:
            rows = connection.execute("SELECT national_id, name, role FROM noor_staff").fetchall()
        finally:
            connection.close()
    except Exception:
        return {}
    names = {}
    for national_id, name, role in rows:
        if national_id and name and _role_is_teacher(role or ""):
            names[str(national_id)] = str(name)
    return names


def _teacher_count() -> str:
    """عدد من صفتهم معلم في سجل المنسوبين. الغياب يبقي الحقل فارغًا."""
    try:
        connection = connect()
        try:
            rows = connection.execute("SELECT role FROM noor_staff").fetchall()
        finally:
            connection.close()
    except Exception:
        return ""
    count = sum(1 for (role,) in rows if _role_is_teacher(role or ""))
    return str(count) if count else ""


def _planning_team(requested: list[DeckTeammate], names_resolved: bool = False) -> list[dict]:
    """صف لكل اسم مُرسل. الأسماء المحسومة من سجل المنسوبين تبقى كما أُرسلت، والفارغ يبقى فارغًا."""
    if not requested and not names_resolved:
        return [{"title": title, "name": name} for _role_id, (title, name) in _DECK_ROLES.items()]
    rows = []
    for item in requested:
        title = item.title.strip()
        name = item.name.strip()
        if not title and item.role_id in _DECK_ROLES:
            title = _DECK_ROLES[item.role_id][0]
        if not title and not name:
            continue
        if name == "فهد حنيف بن محمد العمري":
            name = "منور بن محمد بن عليان اللهيبي"
        rows.append({"title": title, "name": name})
    return rows


def _school_profile(body: SeatDeckBody, school: dict) -> dict:
    """بيانات المدرسة من الإعدادات، وبقية الحقول مما حُفظ في بيانات المنشأة فقط."""
    facility = body.facility
    name = _first(body.school_name, facility.school_name, school.get("name"))
    principal = ""
    for item in body.team:
        if item.role_id == "principal" and item.name.strip():
            principal = item.name.strip()
            break
    return {
        "name": name,
        "stage": _stage_label(_first(body.stage, facility.stage), name),
        "founded": _founded_line(
            _first(body.founded_hijri, facility.founded_hijri),
            _first(body.founded_gregorian, facility.founded_gregorian),
        ),
        "number": _ministry_number(_first(facility.statistical_number, school.get("statistical_number"))),
        "district": facility.district.strip(),
        "address": _first(body.address, facility.address),
        "administration": _first(
            body.administration,
            facility.education_administration,
            school.get("education_administration"),
        ),
        "phone": facility.phone.strip(),
        "fax": facility.fax.strip(),
        "email": facility.email.strip(),
        "website": facility.website.strip(),
        "principal": principal if body.names_resolved else (principal or _OFFICIAL_PRINCIPAL_NAME),
        "students": _student_count(),
        "classrooms": _first(facility.classroom_count, school.get("classrooms")),
        "teachers": _teacher_count(),
        "distance_admin": _measure(facility.distance_admin_km, "كم"),
        "distance_secondary": _measure(facility.distance_secondary, facility.distance_secondary_unit),
        "distance_middle": _measure(facility.distance_middle, facility.distance_middle_unit),
        "distance_primary": _measure(facility.distance_primary, facility.distance_primary_unit),
        "building_type": _first(facility.building_type, school.get("building_type")),
        "built_area": facility.built_area.strip(),
        "yard_area": facility.yard_area.strip(),
        "room_count": facility.room_count.strip(),
        "bathroom_count": facility.bathroom_count.strip(),
        "admin_room_count": facility.admin_room_count.strip(),
        "lab_count": facility.lab_count.strip(),
        "teacher_room_count": facility.teacher_room_count.strip(),
        "workshop_count": facility.workshop_count.strip(),
        "warehouse_count": facility.warehouse_count.strip(),
    }


def _principal_only(role: str) -> None:
    if role not in _DECK_ROLES:
        raise HTTPException(status_code=400, detail="تسكين هذا الدور يأتي لاحقاً")


def _split_task_path(field_path: str) -> tuple[str, str]:
    if not field_path.startswith("tasks."):
        raise HTTPException(status_code=400, detail="مسار الحقل غير صالح")
    body = field_path[len("tasks."):]
    code, separator, field = body.rpartition(".")
    if not separator or not code or field not in _DECK_CELL_FIELDS:
        raise HTTPException(status_code=400, detail="مسار الحقل غير صالح")
    return code, field


def _known_deck_code(role: str, code: str, overrides: dict) -> bool:
    if any(str(item.get("task_code") or "") == code for item in _load_task_bank(role)):
        return True
    prefix = f"tasks.{code}."
    return any(path.startswith(prefix) for path in overrides)


class GeneratePlansRequest(BaseModel):
    """مدخلات توليد الخطط من ملف نور."""

    region: str
    stage: str
    gender: str
    semester: str
    excel_filename: str


def _calendar_year() -> dict:
    """يقرأ مناطق وفصول عام 1448 من ملف التقويم."""
    payload = json.loads(CALENDAR_PATH.read_text(encoding="utf-8"))
    return payload["1448"]


def _excel_file(filename: str) -> Path:
    """يبني مسار الملف داخل School_Data ويرفض الخروج من المجلد."""
    if not filename or Path(filename).name != filename:
        raise HTTPException(status_code=400, detail="اسم ملف الإكسل غير صالح")
    path = (SCHOOL_DATA / filename).resolve()
    if path.parent != SCHOOL_DATA.resolve():
        raise HTTPException(status_code=400, detail="اسم ملف الإكسل غير صالح")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="ملف الإكسل غير موجود")
    return path


@app.get("/api/staff-directory")
def staff_directory():
    """يعيد كشف الكادر مع صفات الدخول المعتمدة لكل سجل."""
    principal, teachers, _deputies, _participants = _evidence_directory()
    people = []
    seen = set()
    for person in [principal] + teachers:
        name = (person.get("name") or "").strip()
        person_id = (person.get("id") or "").strip()
        key = person_id or name
        if not name or not key or key in seen:
            continue
        seen.add(key)
        sheet_role = (person.get("role") or "").strip() or "منسوب"
        roles = list(_DUAL_ROLES.get(person_id) or [sheet_role])
        people.append({"id": person_id, "name": name, "roles": roles})
    return {"people": people}


def _merge_staff(records: list[dict]) -> dict:
    """يضيف المنسوب الجديد ويحدّث الموجود برقم الهوية. لا يحذف بقية السجل."""
    added = 0
    updated = 0
    moment = stamp()
    connection = connect()
    try:
        for row in records:
            national_id = (row.get("national_id") or "").strip()
            if not national_id:
                continue
            current = connection.execute(
                "SELECT name, mobile, specialty, role FROM noor_staff WHERE national_id = ?",
                (national_id,),
            ).fetchone()
            name = (row.get("name") or "").strip()
            mobile = (row.get("mobile") or "").strip()
            specialty = (row.get("specialty") or "").strip()
            role = (row.get("role") or "").strip()
            if current:
                kept_name = str(current[0] or "").strip() or name
                connection.execute(
                    """
                    UPDATE noor_staff
                    SET name = ?, mobile = ?, specialty = ?, role = ?, updated_at = ?, is_deleted = 0
                    WHERE national_id = ?
                    """,
                    (
                        kept_name,
                        mobile or current[1] or "",
                        specialty or current[2] or "",
                        _join_role(current[3] or "", role),
                        moment,
                        national_id,
                    ),
                )
                updated += 1
            else:
                connection.execute(
                    """
                    INSERT INTO noor_staff (national_id, name, mobile, specialty, role, active, updated_at)
                    VALUES (?, ?, ?, ?, ?, 1, ?)
                    """,
                    (national_id, name, mobile, specialty, role, moment),
                )
                added += 1
        connection.commit()
        total = int(
            connection.execute(
                "SELECT COUNT(*) FROM noor_staff WHERE COALESCE(is_deleted, 0) = 0"
            ).fetchone()[0]
        )
    finally:
        connection.close()
    return {"added": added, "updated": updated, "total": total}


def _staff_summary(file_count: int, added: int, updated: int, records: list[dict], total: int) -> str:
    """جملة التقرير: عدد الملفات، ثم الصفات في هذه الدفعة، ثم حجم السجل."""
    buckets: dict[str, int] = {}
    for row in records:
        label = (row.get("role") or "").strip() or "بلا صفة"
        buckets[label] = buckets.get(label, 0) + 1
    files_word = "ملف" if file_count == 1 else "ملفات"
    parts = [f"تم قراءة {file_count} {files_word}."]
    if buckets:
        bits = [f"{count} {label}" for label, count in sorted(buckets.items(), key=lambda item: (-item[1], item[0]))]
        parts.append("في هذه الدفعة: " + "، ".join(bits) + ".")
    parts.append(f"أُضيف {added}، وحُدّث {updated}. السجل الآن {total} منسوبًا.")
    return " ".join(parts)


def _store_noor(kind: str, records: list[dict]) -> int:
    """يستبدل صفوف الطلاب أو الجدول بصفوف الملف الأخير. المنسوبون يُدمجون في _merge_staff."""
    moment = stamp()
    connection = connect()
    try:
        if kind == "students":
            connection.execute("UPDATE noor_students SET is_deleted = 1")
            connection.executemany(
                """
                INSERT INTO noor_students (national_id, name, grade, classroom, status, updated_at, is_deleted)
                VALUES (?, ?, ?, ?, ?, ?, 0)
                ON CONFLICT(national_id) DO UPDATE SET
                    name = excluded.name,
                    grade = excluded.grade,
                    classroom = excluded.classroom,
                    status = excluded.status,
                    updated_at = excluded.updated_at,
                    is_deleted = 0
                """,
                [
                    (row.get("national_id", ""), row.get("name", ""), row.get("grade", ""), row.get("classroom", ""), row.get("status", ""), moment)
                    for row in records
                ],
            )
        else:
            connection.execute("UPDATE noor_timetable SET is_deleted = 1")
            connection.executemany(
                """
                INSERT INTO noor_timetable (day, period, subject, teacher, classroom, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (row.get("day", ""), row.get("period", ""), row.get("subject", ""), row.get("teacher", ""), row.get("classroom", ""), moment)
                    for row in records
                    if row.get("subject") or row.get("day")
                ],
            )
        connection.commit()
        if kind == "timetable":
            row = connection.execute(
                "SELECT COUNT(*) FROM noor_timetable WHERE COALESCE(is_deleted, 0) = 0"
            ).fetchone()
            return int(row[0])
        alive = connection.execute(
            "SELECT COUNT(*) FROM noor_students WHERE COALESCE(is_deleted, 0) = 0"
        ).fetchone()
        from .audit_log import log_action

        log_action(
            "",
            "استيراد الطلاب",
            "noor_students",
            "",
            "",
            str(int(alive[0])),
            connection,
        )
        connection.commit()
        return len(records)
    finally:
        connection.close()


@app.get("/api/noor/staff")
def noor_staff(x_session_token: str = Header(default="")):
    """أسماء المعلمين المدخلة من ملف نور، لتغذية القوائم المنسدلة."""
    _auth_user(x_session_token)
    connection = connect()
    try:
        from .job_performance_api import ensure_assignment_role_column

        ensure_assignment_role_column(connection)
        connection.commit()
        rows = connection.execute(
            """
            SELECT national_id, name, role, specialty, mobile, COALESCE(active, 1),
                   COALESCE(assignment_role, '')
            FROM noor_staff
            WHERE COALESCE(is_deleted, 0) = 0
            ORDER BY name
            """
        ).fetchall()
    finally:
        connection.close()
    return {
        "people": [
            {
                "id": row[0],
                "name": row[1],
                "role": row[2] or "",
                "specialty": row[3] or "",
                "mobile": row[4] or "",
                "active": bool(row[5]),
                "assignment_role": row[6] or "",
            }
            for row in rows
            if row[1]
        ]
    }


class NoorStaffEdit(BaseModel):
    """تعديل منسوب موجود، أو إضافة صف جديد من سجل المنسوبين."""

    national_id: str
    original_id: str = ""
    name: str = ""
    role: str = ""
    specialty: str = ""
    mobile: str = ""
    active: bool = True
    assignment_role: str = ""


@app.post("/api/noor/staff")
def save_noor_staff(body: NoorStaffEdit, x_session_token: str = Header(default="")):
    """يحفظ الاسم والصفة والتخصص. التعديل لا ينشئ صفًا إن غاب الرقم."""
    _auth_user(x_session_token)
    national_id = body.national_id.strip()
    name = body.name.strip()
    if not national_id or not name:
        raise HTTPException(status_code=400, detail="الاسم ورقم الهوية مطلوبان")
    original = body.original_id.strip() or national_id
    moment = stamp()
    assignment_role = body.assignment_role.strip()
    connection = connect()
    try:
        from .job_performance_api import ensure_assignment_role_column

        ensure_assignment_role_column(connection)
        existing = connection.execute(
            "SELECT national_id FROM noor_staff WHERE national_id = ?",
            (original,),
        ).fetchone()
        occupied = connection.execute(
            "SELECT national_id FROM noor_staff WHERE national_id = ?",
            (national_id,),
        ).fetchone()
        if existing:
            if occupied and original != national_id:
                raise HTTPException(status_code=400, detail="رقم الهوية مستخدم لمنسوب آخر")
            connection.execute(
                """
                UPDATE noor_staff
                SET national_id = ?, name = ?, role = ?, specialty = ?, mobile = ?,
                    active = ?, assignment_role = ?, updated_at = ?, is_deleted = 0
                WHERE national_id = ?
                """,
                (
                    national_id,
                    name,
                    body.role.strip(),
                    body.specialty.strip(),
                    body.mobile.strip(),
                    1 if body.active else 0,
                    assignment_role,
                    moment,
                    original,
                ),
            )
        elif body.original_id.strip():
            raise HTTPException(status_code=404, detail="رقم الهوية غير موجود في السجل")
        elif occupied:
            connection.execute(
                """
                UPDATE noor_staff
                SET name = ?, role = ?, specialty = ?, mobile = ?, active = ?,
                    assignment_role = ?, updated_at = ?, is_deleted = 0
                WHERE national_id = ?
                """,
                (
                    name,
                    body.role.strip(),
                    body.specialty.strip(),
                    body.mobile.strip(),
                    1 if body.active else 0,
                    assignment_role,
                    moment,
                    national_id,
                ),
            )
        else:
            connection.execute(
                """
                INSERT INTO noor_staff (
                    national_id, name, mobile, specialty, role, active, assignment_role, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    national_id,
                    name,
                    body.mobile.strip(),
                    body.specialty.strip(),
                    body.role.strip(),
                    1 if body.active else 0,
                    assignment_role,
                    moment,
                ),
            )
        connection.commit()
    finally:
        connection.close()
    return {"saved": national_id}


@app.delete("/api/noor/staff/{national_id}")
def delete_noor_staff(national_id: str, x_session_token: str = Header(default="")):
    """يحذف منسوبًا من سجل الملف المستورد."""
    _auth_user(x_session_token)
    connection = connect()
    try:
        from .retention import hide

        identity = national_id.strip()
        row = connection.execute(
            "SELECT name FROM noor_staff WHERE national_id = ?",
            (identity,),
        ).fetchone()
        hide(connection, "noor_staff", identity, "", str(row[0] if row else ""))
        connection.commit()
    finally:
        connection.close()
    return {"deleted": national_id.strip()}


def _enrich_noor(records: list[dict]) -> dict:
    """يحدّث التخصص أو الصف والفصل للرقم الموجود فقط."""
    staff_updated = 0
    students_updated = 0
    missing_ids = 0
    connection = connect()
    try:
        for row in records:
            national_id = row.get("national_id", "")
            matched = False
            specialty = row.get("specialty", "")
            if specialty:
                cursor = connection.execute(
                    "UPDATE noor_staff SET specialty = ?, updated_at = ? WHERE national_id = ?",
                    (specialty, stamp(), national_id),
                )
                if cursor.rowcount:
                    staff_updated += cursor.rowcount
                    matched = True
            grade = row.get("grade", "")
            classroom = row.get("classroom", "")
            if grade or classroom:
                current = connection.execute(
                    "SELECT grade, classroom FROM noor_students WHERE national_id = ?",
                    (national_id,),
                ).fetchone()
                if current:
                    connection.execute(
                        """
                        UPDATE noor_students
                        SET grade = ?, classroom = ?, updated_at = ?
                        WHERE national_id = ?
                        """,
                        (grade or current[0] or "", classroom or current[1] or "", stamp(), national_id),
                    )
                    students_updated += 1
                    matched = True
            if not matched:
                missing_ids += 1
        connection.commit()
    finally:
        connection.close()
    return {"staff_updated": staff_updated, "students_updated": students_updated, "missing_ids": missing_ids}


def _role_parts(value: str) -> list[str]:
    return [part.strip() for part in (value or "").split("،") if part.strip()]


def _join_role(current: str, new: str) -> str:
    """يبقي الصفتين إذا وصل الشخص نفسه من ملفين بمسميين مختلفين."""
    parts = _role_parts(current)
    for part in _role_parts(new):
        if part not in parts:
            parts.append(part)
    return "، ".join(parts)


def _place_students(records: list[dict]) -> dict:
    """يكتب الصف والفصل على الطالب الموجود. الكشف بلا رقم هوية يُطابق بالاسم ولا ينشئ صفًا."""
    updated = 0
    added = 0
    unmatched = 0
    ambiguous = 0
    moment = stamp()
    connection = connect()
    try:
        existing = connection.execute("SELECT national_id, name, grade, classroom, status FROM noor_students").fetchall()
        by_id = {row[0]: row for row in existing}
        by_name: dict[str, list[str]] = {}
        for row in existing:
            by_name.setdefault(fold_name(row[1]), []).append(row[0])
        for record in records:
            national_id = (record.get("national_id") or "").strip()
            name = (record.get("name") or "").strip()
            grade = (record.get("grade") or "").strip()
            classroom = (record.get("classroom") or "").strip()
            status = (record.get("status") or "").strip()
            if national_id and national_id in by_id:
                current = by_id[national_id]
                connection.execute(
                    """
                    UPDATE noor_students
                    SET name = ?, grade = ?, classroom = ?, status = ?, updated_at = ?
                    WHERE national_id = ?
                    """,
                    (name or current[1] or "", grade or current[2] or "", classroom or current[3] or "", status or current[4] or "", moment, national_id),
                )
                updated += 1
            elif national_id:
                connection.execute(
                    """
                    INSERT INTO noor_students (national_id, name, grade, classroom, status, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (national_id, name, grade, classroom, status, moment),
                )
                added += 1
            else:
                hits = by_name.get(fold_name(name), [])
                if len(hits) == 1:
                    connection.execute(
                        """
                        UPDATE noor_students
                        SET grade = ?, classroom = ?, status = ?, updated_at = ?
                        WHERE national_id = ?
                        """,
                        (grade, classroom, status, moment, hits[0]),
                    )
                    updated += 1
                elif len(hits) > 1:
                    ambiguous += 1
                else:
                    unmatched += 1
        connection.commit()
        total = int(connection.execute("SELECT COUNT(*) FROM noor_students").fetchone()[0])
    finally:
        connection.close()
    return {"updated": updated, "added": added, "unmatched": unmatched, "ambiguous": ambiguous, "total": total}


def _student_summary(parsed: dict, placed: dict | None) -> str:
    """جملة أوراق الكشف والصفوف وعدد من كُتب لهم الفصل."""
    grouped: dict[str, list[str]] = {}
    years = []
    for item in parsed.get("classes") or []:
        grade = (item.get("grade") or "").strip() or "بلا صف"
        room = (item.get("classroom") or "").strip()
        grouped.setdefault(grade, [])
        if room and room not in grouped[grade]:
            grouped[grade].append(room)
        year = (item.get("year") or "").strip()
        if year and year not in years:
            years.append(year)
    bits = []
    for grade, rooms in grouped.items():
        rooms.sort(key=lambda value: (0, int(value)) if str(value).isdigit() else (1, str(value)))
        if rooms:
            bits.append(grade + " (فصل " + "، ".join(rooms) + ")")
        else:
            bits.append(grade)
    sheet_count = parsed.get("sheets") or 0
    sheet_word = "ورقة" if sheet_count == 1 else "ورقات" if 2 <= sheet_count <= 10 else "ورقة"
    if sheet_count == 2:
        sheet_word = "ورقتين"
    parts = [f"تم قراءة {sheet_count} {sheet_word}."]
    if bits:
        parts.append("الصفوف: " + "، ".join(bits) + ".")
    if years:
        parts.append("العام الدراسي " + "، ".join(years) + ".")
    if placed:
        parts.append(f"كُتب الصف والفصل لـ {placed['updated']} طالباً.")
        if placed["added"]:
            parts.append(f"أُضيف {placed['added']}.")
        if placed["unmatched"]:
            parts.append(f"لم يُطابق {placed['unmatched']} اسماً.")
        if placed["ambiguous"]:
            parts.append(f"تُرك {placed['ambiguous']} اسماً مكرراً في السجل.")
        parts.append(f"السجل الآن {placed['total']} طالباً.")
    return " ".join(parts)


def _prefer_staff(records: list[dict]) -> list[dict]:
    """يجمع صفوف الملفات على رقم الهوية. القيمة غير الفارغة في ملف لاحق تُحدّث السابقة."""
    ordered = []
    by_id = {}
    for row in records:
        national_id = (row.get("national_id") or "").strip()
        if not national_id:
            continue
        if national_id not in by_id:
            ordered.append(national_id)
            by_id[national_id] = {
                "national_id": national_id,
                "name": (row.get("name") or "").strip(),
                "mobile": (row.get("mobile") or "").strip(),
                "specialty": (row.get("specialty") or "").strip(),
                "role": (row.get("role") or "").strip(),
            }
            continue
        current = by_id[national_id]
        for key in ("name", "mobile", "specialty"):
            value = (row.get(key) or "").strip()
            if value:
                current[key] = value
        current["role"] = _join_role(current["role"], row.get("role") or "")
    return [by_id[national_id] for national_id in ordered]


@app.post("/api/noor/import")
async def import_noor(
    kind: str = Form(...),
    file: UploadFile | None = File(None),
    files: list[UploadFile] | None = File(None),
    x_session_token: str = Header(default=""),
):
    """يقرأ ملف نور. ملفات المنسوبين تُدمج، وملف الطلاب أو الجدول يستبدل نوعه."""
    from .access import require_principal

    try:
        require_principal(_token(x_session_token))
    except PermissionError as error:
        message = str(error)
        status = 401 if message == "لا جلسة" else 403
        raise HTTPException(status_code=status, detail=message) from error
    if kind not in {"teachers", "students", "timetable", "enrich"}:
        raise HTTPException(status_code=400, detail="نوع الاستيراد غير معروف")
    uploads = [item for item in (files or []) if item is not None and item.filename]
    if file is not None and file.filename:
        uploads.append(file)
    if not uploads:
        raise HTTPException(status_code=400, detail="اختر ملفًا أولًا")
    if kind != "teachers":
        uploads = uploads[:1]
    folder = SCHOOL_DATA / "imports"
    folder.mkdir(parents=True, exist_ok=True)
    if kind != "teachers":
        upload = uploads[0]
        raw_name = Path(upload.filename or "").name
        if not raw_name or raw_name in {".", ".."}:
            raise HTTPException(status_code=400, detail="اسم الملف غير صالح")
        path = folder / f"{kind}-{raw_name}"
        path.write_bytes(await upload.read())
        try:
            if kind == "students":
                parsed = parse_students(path)
            elif kind == "enrich":
                parsed = parse_enrichment(path)
            else:
                parsed = parse_timetable(path)
        except Exception as error:
            raise HTTPException(status_code=400, detail=f"تعذر قراءة الملف: {error}") from error
        missing_notes = [f"العمود «{label}» غير موجود." for label in parsed["missing"]]
        inserted = 0
        staff_updated = 0
        students_updated = 0
        missing_ids = 0
        summary = ""
        total = 0
        if not parsed["missing"]:
            if kind == "enrich":
                enriched = _enrich_noor(parsed["records"])
                staff_updated = enriched["staff_updated"]
                students_updated = enriched["students_updated"]
                missing_ids = enriched["missing_ids"]
                inserted = staff_updated + students_updated
            elif kind == "students" and parsed.get("mode") == "roster":
                placed = _place_students(parsed["records"])
                students_updated = placed["updated"]
                inserted = placed["updated"] + placed["added"]
                missing_ids = placed["unmatched"]
                total = placed["total"]
                summary = _student_summary(parsed, placed)
            else:
                inserted = _store_noor(kind, parsed["records"])
        return {
            "kind": kind,
            "read": parsed["read"],
            "inserted": inserted,
            "skipped": parsed["skipped"],
            "missing": parsed["missing"],
            "warnings": [item for item in parsed["warnings"] if item],
            "errors": missing_notes,
            "staff_updated": staff_updated,
            "students_updated": students_updated,
            "missing_ids": missing_ids,
            "summary": summary,
            "added": 0,
            "updated": students_updated,
            "total": total,
        }
    combined = []
    errors = []
    warnings = []
    read = 0
    skipped = 0
    files_read = 0
    for index, upload in enumerate(uploads, start=1):
        raw_name = Path(upload.filename or "").name
        if not raw_name or raw_name in {".", ".."}:
            errors.append("اسم ملف غير صالح.")
            continue
        path = folder / f"teachers-{index}-{raw_name}"
        path.write_bytes(await upload.read())
        try:
            parsed = parse_teachers(path, raw_name)
        except Exception:
            errors.append(f"{raw_name}: تعذر قراءة الملف.")
            continue
        if parsed["missing"]:
            missing_text = " ".join(f"العمود «{label}» غير موجود." for label in parsed["missing"])
            errors.append(f"{raw_name}: {missing_text}")
            continue
        files_read += 1
        read += parsed["read"]
        skipped += parsed["skipped"]
        warnings.extend(item for item in parsed["warnings"] if item)
        combined.extend(parsed["records"])
    chosen = _prefer_staff(combined)
    merged = _merge_staff(chosen) if chosen else {"added": 0, "updated": 0, "total": 0}
    if not chosen:
        connection = connect()
        try:
            merged["total"] = int(connection.execute("SELECT COUNT(*) FROM noor_staff").fetchone()[0])
        finally:
            connection.close()
    return {
        "kind": kind,
        "read": read,
        "inserted": merged["added"],
        "skipped": skipped,
        "missing": [],
        "warnings": warnings,
        "errors": errors,
        "staff_updated": merged["updated"],
        "students_updated": 0,
        "missing_ids": 0,
        "summary": _staff_summary(files_read, merged["added"], merged["updated"], chosen, merged["total"]),
        "added": merged["added"],
        "updated": merged["updated"],
        "total": merged["total"],
    }


@app.get("/api/registers")
def registers_bank():
    """يعيد قوالب السجلات الرسمية للعرض حسب صفة الجلسة."""
    registers = []
    if REGISTERS_DIR.is_dir():
        for path in sorted(REGISTERS_DIR.glob("*.json")):
            payload = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(payload, dict) and payload.get("id"):
                registers.append(payload)
    return {"registers": registers}


@app.get("/api/registers-lookup")
def registers_lookup():
    """يعيد بنك الدروس والقوائم المرجعية لتعبئة السجلات."""
    path = REGISTERS_DIR / "registers_lookup_data.json"
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _read_json(path, fallback):
    """يقرأ ملفاً نصياً بصيغة JSON أو يعيد القيمة البديلة."""
    if not path.is_file():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/registers-content")
def registers_content():
    """يعيد سيناريوهات خطوات التنفيذ والأثر الرقمي."""
    return _read_json(REGISTERS_DIR / "registers_content_bank.json", {"scenarios": []})


@app.get("/api/assignment-templates")
def assignment_templates():
    """يعيد قوالب خطاب التكليف والمحضر ومصفوفة التواقيع."""
    return _read_json(REGISTERS_DIR / "individual_assignments_templates.json", {})


class CommitteeSeat(BaseModel):
    """مقعد في تشكيل لجنة."""

    title: str = ""
    name: str = ""


class CommitteeFormationBody(BaseModel):
    """تشكيل محفوظ للجنة."""

    seats: list[CommitteeSeat]


def _formation_path():
    return SCHOOL_DATA / "committee_formations.json"


def _allowed_committee_names():
    principal, teachers, _deputies, _participants = _evidence_directory()
    names = set()
    for person in [principal] + teachers:
        name = (person.get("name") or "").strip()
        if name:
            names.add(name)
    names.add(_OFFICIAL_PRINCIPAL_NAME)
    return names


@app.get("/api/committees")
def committees_portal(x_session_token: str = Header(default="")):
    """يعيد قرارات اللجان مع التشكيل المحفوظ."""
    _auth_user(x_session_token)
    bank = _read_json(REGISTERS_DIR / "school_committees_governance.json", {"committees": []})
    return {"committees": bank.get("committees", []), "formations": _read_json(_formation_path(), {})}


@app.post("/api/committees/{committee_id}")
def save_committee_formation(
    committee_id: str,
    body: CommitteeFormationBody,
    x_session_token: str = Header(default=""),
):
    """يحفظ تشكيل لجنة واحدة دون المساس بإعدادات المدرسة."""
    _auth_user(x_session_token)
    bank = _read_json(REGISTERS_DIR / "school_committees_governance.json", {"committees": []})
    known = {item.get("id") for item in bank.get("committees", [])}
    if committee_id not in known:
        raise HTTPException(status_code=404, detail="اللجنة غير موجودة")
    allowed = _allowed_committee_names()
    seats = []
    for seat in body.seats:
        name = seat.name.strip()
        if name and name not in allowed:
            raise HTTPException(status_code=400, detail="الاسم ليس من كشف الكادر")
        seats.append({"title": seat.title.strip(), "name": name})
    stored = _read_json(_formation_path(), {})
    stored[committee_id] = seats
    _formation_path().write_text(json.dumps(stored, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"id": committee_id, "seats": seats}


class CouncilsBody(BaseModel):
    minutes: list[dict] = []


def _councils_path():
    return SCHOOL_DATA / "council_minutes.json"


@app.get("/api/councils")
def get_councils(x_session_token: str = Header(default="")):
    """يعيد محاضر المجالس المحفوظة على الخادم."""
    _auth_user(x_session_token)
    payload = _read_json(_councils_path(), {"minutes": []})
    minutes = payload.get("minutes") if isinstance(payload, dict) else []
    if not isinstance(minutes, list):
        minutes = []
    return {"minutes": minutes}


@app.post("/api/councils")
def save_councils(body: CouncilsBody, x_session_token: str = Header(default="")):
    """يحفظ قائمة محاضر المجالس كاملة (مزامنة من الواجهة)."""
    _auth_user(x_session_token)
    cleaned = []
    for item in body.minutes:
        if not isinstance(item, dict):
            continue
        record_id = str(item.get("id") or "").strip()
        if not record_id:
            continue
        cleaned.append(item)
    SCHOOL_DATA.mkdir(parents=True, exist_ok=True)
    _councils_path().write_text(
        json.dumps({"minutes": cleaned}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return {"ok": True, "count": len(cleaned), "minutes": cleaned}


@app.get("/api/regions")
def regions():
    """يعيد المناطق المدعومة في تقويم 1448."""
    return list(_calendar_year().keys())


@app.get("/api/roles")
def roles():
    """يعيد الأدوار التي يملك المحرك ملف مهام لها."""
    return list(_ROLE_BANK.keys())


@app.post("/api/generate-plans")
def generate_plans_api(body: GeneratePlansRequest, x_session_token: str = Header(default="")):
    """يولّد الخطط ويعيدها دون حفظها في قاعدة البيانات."""
    _auth_user(x_session_token)
    calendar = _calendar_year()
    if body.region not in calendar:
        raise HTTPException(status_code=400, detail="المنطقة غير مدعومة")
    if str(body.semester) not in calendar[body.region]:
        raise HTTPException(status_code=400, detail="الفصل غير مدعوم")
    if body.stage not in _STAGES:
        raise HTTPException(status_code=400, detail="المرحلة غير مدعومة")
    if body.gender not in _GENDERS:
        raise HTTPException(status_code=400, detail="جنس المدرسة غير مدعوم")
    excel_path = _excel_file(body.excel_filename)
    stored = _settings_row()
    weeks_count = _coerce_weeks(stored[14] if stored and len(stored) > 14 else 18)
    payload = generate_plans(
        region=body.region,
        stage=body.stage,
        gender=body.gender,
        semester=str(body.semester),
        excel_path=str(excel_path),
        weeks_count=weeks_count,
    )
    evidence_path = SCHOOL_DATA / _EVIDENCE_FILE
    deputies = []
    teachers = []
    principal = {}
    if evidence_path.is_file():
        parsed = parse_evidence_staff(evidence_path)
        principal = parsed.get("principal") or {}
        deputies = parsed.get("deputies") or []
        teachers = parsed.get("teachers") or []
    principal_plan = payload.get("plans", {}).get("principal")
    if principal_plan:
        for week in principal_plan.get("weeks", []):
            current = week.get("executor") or {}
            week["executor"] = {
                "name": _OFFICIAL_PRINCIPAL_NAME,
                "id": principal.get("id") or current.get("id", ""),
            }

    def deputy_id(marker):
        for person in deputies:
            if marker in (person.get("role") or ""):
                return person.get("id") or ""
        return ""

    plans = payload.setdefault("plans", {})
    ensure_role_plan(
        plans,
        "vice_teachers",
        body.gender,
        {"name": _ACADEMIC_VICE_NAME, "id": deputy_id("تعليم")},
    )
    ensure_role_plan(
        plans,
        "vice_students",
        body.gender,
        {"name": _STUDENTS_VICE_NAME, "id": deputy_id("طلاب")},
    )

    def staff_executor(marker):
        for person in teachers:
            if marker in (person.get("role") or ""):
                return {"name": person.get("name") or "", "id": person.get("id") or ""}
        return {"name": "", "id": ""}

    ensure_role_plan(plans, "student_counselor", body.gender, staff_executor("موجه"))
    ensure_role_plan(plans, "activity_leader", body.gender, staff_executor("نشاط"))
    return payload


def _content_error(error):
    """يحوّل خطأ المحتوى إلى استجابة HTTP."""
    raise HTTPException(status_code=error.status, detail=str(error)) from error


@app.get("/api/content/{role}")
def get_role_content(role: str, x_session_token: str = Header(default="")):
    """يعيد محتوى الدور بعد دمج التعديلات على النص الافتراضي."""
    _auth_user(x_session_token)
    try:
        return load_role_content(role)
    except ContentError as error:
        _content_error(error)


@app.post("/api/content/{role}")
def post_role_content(role: str, body: OverrideBody, x_session_token: str = Header(default="")):
    """يحفظ تعديل حقل واحد ولا يغيّر ملف البنك."""
    _auth_user(x_session_token)
    try:
        save_override(role, body.field_path, body.value)
    except ContentError as error:
        _content_error(error)
    return {"status": "ok"}


@app.delete("/api/content/{role}/all")
def delete_role_content(role: str, x_session_token: str = Header(default="")):
    """يحذف كل تعديلات الدور فيستعيد الواجهة النص الافتراضي."""
    _auth_user(x_session_token)
    try:
        reset_all_overrides(role)
    except ContentError as error:
        _content_error(error)
    return {"status": "ok"}


@app.post("/api/deck/seat")
def seat_deck(body: SeatDeckBody, x_session_token: str = Header(default="")):
    """يبني شرائح خطة المدير مرة واحدة. التنقل بعدها من ذاكرة المتصفح."""
    _auth_user(x_session_token)
    if body.gender not in _GENDERS:
        raise HTTPException(status_code=400, detail="جنس المدرسة غير مدعوم")
    if body.role not in _DECK_ROLES:
        raise HTTPException(status_code=400, detail="تسكين هذا الدور يأتي لاحقاً")
    try:
        content = load_role_content(body.role)
    except ContentError as error:
        if error.status != 404:
            _content_error(error)
        content = {}
    try:
        overrides = list_task_overrides(body.role)
        overrides.update(list_swot_overrides())
    except ContentError as error:
        _content_error(error)
    saved = _saved_settings(OFFICIAL_PRINCIPAL_NAME)
    school = saved["school"]
    signature = (content.get("introduction") or {}).get("signature") or {}
    role_title, fallback_name = _DECK_ROLES[body.role]
    if body.names_resolved:
        author = body.author_name.strip()
    elif body.role == "principal":
        author = body.author_name.strip() or str(signature.get("name") or "").strip() or fallback_name
    else:
        author = body.author_name.strip() or fallback_name
    try:
        return seat_role(
            body.role,
            content,
            gender=body.gender,
            weeks_count=_coerce_weeks(body.weeks_count or school.get("term_weeks_count")),
            school_name=body.school_name.strip() or school.get("name") or "",
            administration=body.administration.strip() or school.get("education_administration") or "",
            year_label=body.year_label,
            author_name=author,
            author_role=body.author_role.strip() or role_title,
            overrides=overrides,
            school_profile=_school_profile(_fill_facility_from_bank(body), school),
            team=_planning_team(body.team, body.names_resolved),
            teacher_names=_teacher_names(),
            domain_scores=_domain_scores(),
            nafs_card=_nafs_card(),
            improvement_actions=_improvement_actions(),
            school_programs=programs_for_role(body.role),
            operational_plan=read_plan(),
            linked_programs=list_programs(),
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/deck/cell")
def save_deck_cell(body: DeckCellBody, x_session_token: str = Header(default="")):
    """يحفظ نص الخلية في content_overrides بلا تصريف."""
    _auth_user(x_session_token)
    if body.field_path.startswith("swot."):
        try:
            stored = save_swot_override(body.field_path, body.value)
        except ContentError as error:
            _content_error(error)
        return {"status": "ok", "field_path": body.field_path, "value": stored}
    _principal_only(body.role)
    code, _field = _split_task_path(body.field_path)
    try:
        overrides = list_task_overrides(body.role)
    except ContentError as error:
        _content_error(error)
    if not _known_deck_code(body.role, code, overrides):
        raise HTTPException(status_code=400, detail="البند غير موجود في الخطة")
    try:
        stored = save_task_override(body.role, body.field_path, body.value)
    except ContentError as error:
        _content_error(error)
    return {"status": "ok", "field_path": body.field_path, "value": stored}


@app.post("/api/deck/tombstone")
def tombstone_deck_item(body: DeckTombstoneBody, x_session_token: str = Header(default="")):
    """يثبت شاهد الحذف للبند حتى يتخطاه التسكين التالي."""
    _auth_user(x_session_token)
    _principal_only(body.role)
    code = body.task_code.strip()
    try:
        overrides = list_task_overrides(body.role)
    except ContentError as error:
        _content_error(error)
    if not _known_deck_code(body.role, code, overrides):
        raise HTTPException(status_code=400, detail="البند غير موجود في الخطة")
    try:
        save_task_override(body.role, f"tasks.{code}.deleted", "1")
    except ContentError as error:
        _content_error(error)
    return {"status": "ok", "task_code": code}


@app.post("/api/deck/custom")
def add_deck_custom_item(body: SeatDeckBody, x_session_token: str = Header(default="")):
    """يضيف بندًا فارغًا بالرمز التالي custom.N قبل أي تقسيم."""
    _auth_user(x_session_token)
    _principal_only(body.role)
    try:
        overrides = list_task_overrides(body.role)
        code = next_custom_code(overrides)
        save_task_override(body.role, f"tasks.{code}.added", "1")
    except ContentError as error:
        _content_error(error)
    return {"status": "ok", "task_code": code}


_DEFAULT_SCHOOL_NAME = "متوسطة سعد بن الربيع الأنصاري"
_DEFAULT_ADMINISTRATION = "الإدارة العامة للتعليم بمنطقة المدينة المنورة"
_BUILDING_TYPES = {"حكومي", "مستأجر"}
_DEFAULT_SOURCES = [
    "برنامج تنمية القدرات البشرية (رؤية المملكة 2030).",
    "معايير التقويم والاعتماد المدرسي (هيئة تقويم التعليم والتدريب).",
    "الأدلة التنظيمية والإجرائية لمدارس التعليم العام.",
    "نتائج الاختبارات الوطنية (نافس) وتقارير التقويم الذاتي للمدرسة.",
]


class CommitteeMember(BaseModel):
    """عضو مختار من معلمي ملف نور."""

    id: str = ""
    name: str = ""
    role: str = ""


class SchoolProfile(BaseModel):
    """بيانات المدرسة العامة."""

    name: str = _DEFAULT_SCHOOL_NAME
    statistical_number: str = ""
    education_office: str = ""
    education_administration: str = _DEFAULT_ADMINISTRATION
    building_type: str = "حكومي"
    classrooms: str = ""
    labs: str = ""
    sports_halls: str = ""
    total_students: str = ""
    total_staff: str = ""
    term_weeks_count: int = 18


class CommitteeProfile(BaseModel):
    """فريق إعداد الخطة وممثلا أولياء الأمور والطلاب."""

    chair_name: str = ""
    members: list[CommitteeMember] = []
    parent_representative: list[str] = []
    student_representative: list[str] = []


class ApprovalPerson(BaseModel):
    """منفّذ يعتمد الوكيل تقريره."""

    name: str = ""
    role: str = ""


class ApprovalSignatory(BaseModel):
    """صاحب توقيع في شريط الاعتماد."""

    name: str = ""
    title: str = ""
    signature: str = ""
    drive_id: str = ""


class ApprovalAuthority(ApprovalSignatory):
    """وكيل وقائمة من يعتمد تقاريرهم."""

    people: list[ApprovalPerson] = []


class ApprovalMap(BaseModel):
    """اعتماد المدير، ثم كل وكيل ومن يتبعه."""

    principal: ApprovalSignatory = ApprovalSignatory()
    authorities: list[ApprovalAuthority] = []


class SettingsBody(BaseModel):
    """حمولة حفظ إعدادات المدرسة كاملة."""

    school: SchoolProfile
    committee: CommitteeProfile
    sources: list[str]
    approval: ApprovalMap | None = None


def _copy_people(people):
    """ينسخ أسماء الكادر بحقول العرض فقط."""
    return [
        {"id": person.get("id", ""), "name": person.get("name", ""), "role": person.get("role", "")}
        for person in people
        if person.get("name")
    ]


def _evidence_directory():
    """يقرأ المدير والوكيلين وكامل المنسوبين من ملف الردود الرسمي."""
    path = SCHOOL_DATA / _EVIDENCE_FILE
    if not path.is_file():
        return {"name": "", "id": ""}, [], [], []
    parsed = parse_evidence_staff(path)
    principal = dict(parsed.get("principal") or {"name": "", "id": ""})
    principal["name"] = _OFFICIAL_PRINCIPAL_NAME
    return (
        principal,
        _copy_people(parsed.get("teachers", [])),
        _copy_people(parsed.get("deputies", [])),
        _copy_people(parsed.get("participants", [])),
    )


def _real_members(members, teachers):
    """يبقي أعضاء اللجنة الموجودين في كشف الكادر الفعلي فقط."""
    allowed_ids = {person.get("id", "") for person in teachers if person.get("id")}
    allowed_names = {person.get("name", "") for person in teachers if person.get("name")}
    kept = []
    for member in members:
        data = member.model_dump() if hasattr(member, "model_dump") else dict(member)
        member_id = data.get("id") or ""
        member_name = data.get("name") or ""
        if member_name == "__roster__":
            kept.append({"id": "", "name": "__roster__", "role": ""})
            continue
        if (member_id and member_id in allowed_ids) or member_name in allowed_names:
            kept.append({"id": member_id, "name": member_name, "role": data.get("role") or ""})
    return kept


def _coerce_weeks(value):
    """يبقي عدد الأسابيع بين 10 و 20، والافتراضي 18."""
    try:
        number = int(value)
    except (TypeError, ValueError):
        return 18
    if number < 10 or number > 20:
        return 18
    return number


def _settings_row():
    """يعيد صف الإعدادات المحفوظ أو لا شيء."""
    connection = connect()
    try:
        connection.row_factory = None
        row = connection.execute(
            """
            SELECT school_name, statistical_number, education_office, building_type,
                   classrooms, labs, sports_halls, total_students, total_staff,
                   chair_name, members_json, parent_representative,
                   student_representative, sources_json, term_weeks_count,
                   education_administration, approval_authorities_json
            FROM school_settings
            WHERE id = 1
            """
        ).fetchone()
        return row
    finally:
        connection.close()


def _name_list(value):
    """يحوّل الاسم المحفوظ إلى قائمة، ويقبل النص القديم أو مصفوفة JSON."""
    text = "" if value is None else str(value).strip()
    if not text:
        return []
    if text.startswith("["):
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    return [text]


def _default_approval():
    """قاعدة الاعتماد من ملف البنوك إن تعذر قراءة المحفوظ."""
    if not _APPROVAL_PATH.is_file():
        return {
            "principal": {
                "name": _OFFICIAL_PRINCIPAL_NAME,
                "title": "مدير المدرسة",
                "signature": "signatures/sig_manager.png",
                "drive_id": "",
            },
            "authorities": [],
        }
    parsed = json.loads(_APPROVAL_PATH.read_text(encoding="utf-8"))
    if not isinstance(parsed, dict):
        return {"principal": {"name": _OFFICIAL_PRINCIPAL_NAME, "title": "مدير المدرسة", "signature": "signatures/sig_manager.png", "drive_id": ""}, "authorities": []}
    principal = parsed.get("principal") if isinstance(parsed.get("principal"), dict) else {}
    principal["name"] = _OFFICIAL_PRINCIPAL_NAME
    parsed["principal"] = principal
    return parsed


def _stored_approval(raw):
    """يعيد خريطة الاعتماد المحفوظة، أو القاعدة الافتراضية إن كانت فارغة."""
    text = "" if raw is None else str(raw).strip()
    if not text:
        return _default_approval()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return _default_approval()
    if not isinstance(parsed, dict):
        return _default_approval()
    principal = parsed.get("principal") if isinstance(parsed.get("principal"), dict) else {}
    principal["name"] = _OFFICIAL_PRINCIPAL_NAME
    parsed["principal"] = principal
    if not isinstance(parsed.get("authorities"), list):
        parsed["authorities"] = []
    return parsed


def _approval_json(approval):
    """يجهّز JSON الاعتماد للحفظ، ويمتنع عن مسح القوائم إن وصلت فارغة."""
    if approval is None:
        return None
    authorities = []
    for item in approval.authorities:
        people = [
            {"name": person.name.strip(), "role": person.role.strip()}
            for person in item.people
            if person.name.strip()
        ]
        if not item.name.strip() and not people:
            continue
        signature = item.signature.strip()
        if not signature and "المعلمين" in item.title:
            signature = "signatures/sig_teachers.png"
        if not signature and "الطلاب" in item.title:
            signature = "signatures/sig_students.png"
        authorities.append({
            "name": item.name.strip(),
            "title": item.title.strip(),
            "signature": signature,
            "drive_id": item.drive_id.strip(),
            "people": people,
        })
    if not authorities:
        return None
    principal = approval.principal
    return json.dumps(
        {
            "principal": {
                "name": _OFFICIAL_PRINCIPAL_NAME,
                "title": principal.title.strip() or "مدير المدرسة",
                "signature": principal.signature.strip() or "signatures/sig_manager.png",
                "drive_id": principal.drive_id.strip(),
            },
            "authorities": authorities,
        },
        ensure_ascii=False,
    )


def _saved_settings(principal_name):
    """يبني بيانات المدرسة واللجنة والمصادر من الصف أو من القيم الافتراضية."""
    row = _settings_row()
    if row is None:
        return {
            "school": {
                "name": _DEFAULT_SCHOOL_NAME,
                "statistical_number": "",
                "education_office": "",
                "building_type": "حكومي",
                "classrooms": "",
                "labs": "",
                "sports_halls": "",
                "total_students": "",
                "total_staff": "",
                "term_weeks_count": 18,
                "education_administration": _DEFAULT_ADMINISTRATION,
            },
            "committee": {
                "chair_name": principal_name,
                "members": [],
                "parent_representative": [],
                "student_representative": [],
            },
            "sources": list(_DEFAULT_SOURCES),
            "approval": _default_approval(),
        }
    sources = json.loads(row[13]) if row[13] else list(_DEFAULT_SOURCES)
    members = json.loads(row[10]) if row[10] else []
    return {
        "school": {
            "name": row[0] or _DEFAULT_SCHOOL_NAME,
            "statistical_number": row[1] or "",
            "education_office": row[2] or "",
            "building_type": row[3] or "حكومي",
            "classrooms": row[4] or "",
            "labs": row[5] or "",
            "sports_halls": row[6] or "",
            "total_students": row[7] or "",
            "total_staff": row[8] or "",
            "term_weeks_count": _coerce_weeks(row[14] if len(row) > 14 else 18),
            "education_administration": (row[15] if len(row) > 15 and row[15] else _DEFAULT_ADMINISTRATION),
        },
        "committee": {
            "chair_name": principal_name or row[9] or "",
            "members": members,
            "parent_representative": _name_list(row[11]),
            "student_representative": _name_list(row[12]),
        },
        "sources": sources,
        "approval": _stored_approval(row[16] if len(row) > 16 else None),
    }


_FACILITY_FORM_FIELDS = (
    "schoolName", "statisticalNumber", "foundedHijri", "foundedGregorian", "stage",
    "educationAdministration", "district", "address",
    "phone", "fax", "email", "website",
    "distanceAdminKm", "distanceSecondary", "distanceSecondaryUnit",
    "distanceMiddle", "distanceMiddleUnit", "distancePrimary", "distancePrimaryUnit",
    "buildingType", "builtArea", "yardArea",
    "roomCount", "classroomCount", "bathroomCount",
    "adminRoomCount", "labCount", "teacherRoomCount", "workshopCount", "warehouseCount",
)

_FACILITY_TO_SEAT = {
    "schoolName": "school_name",
    "statisticalNumber": "statistical_number",
    "foundedHijri": "founded_hijri",
    "foundedGregorian": "founded_gregorian",
    "stage": "stage",
    "educationAdministration": "education_administration",
    "district": "district",
    "address": "address",
    "phone": "phone",
    "fax": "fax",
    "email": "email",
    "website": "website",
    "distanceAdminKm": "distance_admin_km",
    "distanceSecondary": "distance_secondary",
    "distanceSecondaryUnit": "distance_secondary_unit",
    "distanceMiddle": "distance_middle",
    "distanceMiddleUnit": "distance_middle_unit",
    "distancePrimary": "distance_primary",
    "distancePrimaryUnit": "distance_primary_unit",
    "buildingType": "building_type",
    "builtArea": "built_area",
    "yardArea": "yard_area",
    "roomCount": "room_count",
    "classroomCount": "classroom_count",
    "bathroomCount": "bathroom_count",
    "adminRoomCount": "admin_room_count",
    "labCount": "lab_count",
    "teacherRoomCount": "teacher_room_count",
    "workshopCount": "workshop_count",
    "warehouseCount": "warehouse_count",
}


class FacilityBankBody(BaseModel):
    """حقول نموذج المنشأة كما كُتبت. الفارغ يبقى فارغًا."""

    fields: dict[str, str] = Field(default_factory=dict)


def _ensure_facility_column(connection) -> None:
    columns = {row[1] for row in connection.execute("PRAGMA table_info(school_settings)")}
    if "facility_json" not in columns:
        connection.execute("ALTER TABLE school_settings ADD COLUMN facility_json TEXT")


def _clean_facility_fields(raw) -> dict[str, str]:
    source = raw if isinstance(raw, dict) else {}
    return {key: str(source.get(key) or "").strip() for key in _FACILITY_FORM_FIELDS}


def _read_facility_bank(connection):
    _ensure_facility_column(connection)
    row = connection.execute("SELECT facility_json FROM school_settings WHERE id = 1").fetchone()
    if not row or not row[0]:
        return None
    try:
        data = json.loads(row[0])
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or not data.get("saved"):
        return None
    return _clean_facility_fields(data.get("fields"))


def _fill_facility_from_bank(body: SeatDeckBody) -> SeatDeckBody:
    """يملأ حقل الشريحة الفارغ من بنك المنشأة. لا يستبدل قيمة مرسلة ولا يخترع رقمًا."""
    connection = connect()
    try:
        stored = _read_facility_bank(connection)
    finally:
        connection.close()
    if not stored:
        return body
    current = body.facility.model_dump()
    for form_key, seat_key in _FACILITY_TO_SEAT.items():
        if str(current.get(seat_key) or "").strip() or not stored.get(form_key):
            continue
        current[seat_key] = stored[form_key]
    body.facility = FacilitySeat(**current)
    return body


@app.get("/api/settings/facility")
def get_facility_bank(x_session_token: str = Header(default="")):
    """يعيد بيانات المنشأة المحفوظة في قاعدة المدرسة. بلا حفظ سابق تبقى الحقول فارغة."""
    from .access import require_user

    try:
        require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    connection = connect()
    try:
        fields = _read_facility_bank(connection)
    finally:
        connection.close()
    if fields is None:
        return {"saved": False, "fields": {}}
    return {"saved": True, "fields": fields}


@app.post("/api/settings/facility")
def post_facility_bank(body: FacilityBankBody, x_session_token: str = Header(default="")):
    """يحفظ نموذج المنشأة في قاعدة المدرسة دون مسح بقية صف الإعدادات."""
    from .access import require_user

    try:
        require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    fields = _clean_facility_fields(body.fields)
    payload = json.dumps({"saved": True, "fields": fields}, ensure_ascii=False)
    connection = connect()
    try:
        _ensure_facility_column(connection)
        exists = connection.execute("SELECT id FROM school_settings WHERE id = 1").fetchone()
        if exists:
            connection.execute(
                "UPDATE school_settings SET facility_json = ?, updated_at = datetime('now') WHERE id = 1",
                (payload,),
            )
        else:
            connection.execute(
                "INSERT INTO school_settings (id, facility_json, updated_at) VALUES (1, ?, datetime('now'))",
                (payload,),
            )
        connection.commit()
    finally:
        connection.close()
    return {"status": "ok", "saved": True}


@app.get("/api/settings")
def get_settings(x_session_token: str = Header(default="")):
    """يعيد بيانات المدرسة ولجنة التخطيط مع أسماء ملف الشواهد الرسمي."""
    _auth_user(x_session_token)
    principal, teachers, deputies, participants = _evidence_directory()
    payload = _saved_settings(principal.get("name", ""))
    payload["principal_name"] = principal.get("name", "")
    payload["teachers"] = teachers
    payload["deputies"] = deputies
    payload["participants"] = participants
    if teachers:
        payload["committee"]["members"] = _real_members(payload["committee"]["members"], teachers)
    from .teacher_deliverables_api import stored_academic_year
    payload["academic_year"] = stored_academic_year()
    return payload


@app.post("/api/settings")
def post_settings(body: SettingsBody, x_session_token: str = Header(default="")):
    """يستبدل صف إعدادات المدرسة بالكامل."""
    _auth_user(x_session_token)
    if body.school.building_type not in _BUILDING_TYPES:
        raise HTTPException(status_code=400, detail="طبيعة المبنى غير مدعومة")
    _principal, teachers, _deputies, _participants = _evidence_directory()
    parents = [name.strip() for name in body.committee.parent_representative if name and name.strip()]
    students = [name.strip() for name in body.committee.student_representative if name and name.strip()]
    members = _real_members(body.committee.members, teachers) if teachers else [
        member.model_dump() for member in body.committee.members
    ]
    approval_json = _approval_json(body.approval)
    connection = connect()
    try:
        connection.execute(
            """
            INSERT INTO school_settings (
                id, school_name, statistical_number, education_office, building_type,
                classrooms, labs, sports_halls, total_students, total_staff,
                chair_name, members_json, parent_representative, student_representative,
                sources_json, term_weeks_count, education_administration,
                approval_authorities_json, updated_at
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                school_name = excluded.school_name,
                statistical_number = excluded.statistical_number,
                education_office = excluded.education_office,
                building_type = excluded.building_type,
                classrooms = excluded.classrooms,
                labs = excluded.labs,
                sports_halls = excluded.sports_halls,
                total_students = excluded.total_students,
                total_staff = excluded.total_staff,
                chair_name = excluded.chair_name,
                members_json = excluded.members_json,
                parent_representative = excluded.parent_representative,
                student_representative = excluded.student_representative,
                sources_json = excluded.sources_json,
                term_weeks_count = excluded.term_weeks_count,
                education_administration = excluded.education_administration,
                approval_authorities_json = COALESCE(excluded.approval_authorities_json, school_settings.approval_authorities_json),
                updated_at = excluded.updated_at
            """,
            (
                body.school.name,
                body.school.statistical_number,
                body.school.education_office,
                body.school.building_type,
                body.school.classrooms,
                body.school.labs,
                body.school.sports_halls,
                body.school.total_students,
                body.school.total_staff,
                _OFFICIAL_PRINCIPAL_NAME,
                json.dumps(members, ensure_ascii=False),
                json.dumps(parents, ensure_ascii=False),
                json.dumps(students, ensure_ascii=False),
                json.dumps(body.sources, ensure_ascii=False),
                _coerce_weeks(body.school.term_weeks_count),
                (body.school.education_administration or _DEFAULT_ADMINISTRATION).strip() or _DEFAULT_ADMINISTRATION,
                approval_json,
            ),
        )
        connection.commit()
    finally:
        connection.close()
    return {"status": "ok"}


class PlanCustomItem(BaseModel):
    """بند خطة محفوظ مع حالة أسابيع المتابعة."""

    title: str = ""
    execution_time: str = ""
    execution_method: str = ""
    evidence: str = ""
    checks: list[bool] = []


class SavePlanItemsBody(BaseModel):
    """بنود دور واحد بعد التحرير."""

    role: str
    items: list[PlanCustomItem]


@app.get("/api/get-plan-items")
def get_plan_items(role: str = "principal", x_session_token: str = Header(default="")):
    """يعيد البنود المحفوظة للدور، أو قائمة فارغة إن لم يُحفظ شيء."""
    _auth_user(x_session_token)
    connection = connect()
    try:
        row = connection.execute(
            "SELECT items_json FROM plan_custom_items WHERE role = ?",
            (role,),
        ).fetchone()
    finally:
        connection.close()
    if row is None or not row[0]:
        return {"role": role, "items": []}
    return {"role": role, "items": json.loads(row[0])}


@app.post("/api/save-plan-items")
def save_plan_items(body: SavePlanItemsBody, x_session_token: str = Header(default="")):
    """يستبدل بنود الدور المحفوظة بالكامل."""
    _auth_user(x_session_token)
    if not body.role.strip():
        raise HTTPException(status_code=400, detail="الدور غير محدد")
    payload = json.dumps(
        [item.model_dump() for item in body.items],
        ensure_ascii=False,
    )
    connection = connect()
    try:
        connection.execute(
            """
            INSERT INTO plan_custom_items (role, items_json, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(role) DO UPDATE SET
                items_json = excluded.items_json,
                updated_at = excluded.updated_at
            """,
            (body.role.strip(), payload),
        )
        connection.commit()
    finally:
        connection.close()
    return {"status": "ok"}


@app.delete("/api/content/{role}")
def delete_role_field(role: str, field_path: str, x_session_token: str = Header(default="")):
    """يحذف تعديل حقل واحد حسب field_path."""
    _auth_user(x_session_token)
    try:
        reset_override(role, field_path)
    except ContentError as error:
        _content_error(error)
    return {"status": "ok"}


_EVAL_LEVELS = {"تهيئة", "انطلاق", "تقدم", "تميز"}


def _score_text(value) -> str:
    """يبقي النسبة كما كُتبت بعد التحقق أنها رقم."""
    if value is None:
        return ""
    text = str(value).strip().replace("٪", "").replace("%", "").strip()
    if not text:
        return ""
    try:
        float(text)
    except ValueError:
        raise HTTPException(status_code=400, detail="النسبة والمسافة تُكتبان رقمًا")
    return text


def _code_key(code: str) -> tuple:
    parts = []
    for piece in (code or "").split("-"):
        parts.append(int(piece) if piece.isdigit() else 0)
    return tuple(parts)


def _cycle_payload(row) -> dict:
    try:
        domains = json.loads(row[5] or "[]")
    except json.JSONDecodeError:
        domains = []
    return {
        "id": row[0],
        "title": row[1] or "",
        "academic_year": row[2] or "",
        "overall_score": row[3] or "",
        "overall_level": row[4] or "",
        "domains": domains if isinstance(domains, list) else [],
        "source_note": row[6] or "",
    }


def _indicator_payload(row) -> dict:
    return {
        "id": row[0],
        "cycle_id": row[1],
        "code": row[2] or "",
        "domain": row[3] or "",
        "standard_name": row[4] or "",
        "statement": row[5] or "",
        "level": row[6] or "",
        "domain_score": row[7] or "",
        "gap_to_next": row[8] or "",
    }


class EvaluationDomainBody(BaseModel):
    """نسبة مجال واحد والمسافة إلى المستوى التالي."""

    name: str
    score: str = ""
    gap_to_next: str = ""


class EvaluationCycleBody(BaseModel):
    """رأس دورة التقويم."""

    title: str
    academic_year: str = ""
    overall_score: str = ""
    overall_level: str = ""
    domains: list[EvaluationDomainBody] = []


class EvaluationIndicatorBody(BaseModel):
    """مؤشر واحد في سجل التقويم."""

    id: int = 0
    cycle_id: int
    code: str
    domain: str
    standard_name: str
    statement: str
    level: str
    domain_score: str = ""
    gap_to_next: str = ""


def _domain_scores() -> dict:
    """نسب المجالات ومسافاتها من دورة التقويم المحفوظة."""
    connection = connect()
    try:
        row = connection.execute(
            "SELECT domains_json FROM evaluation_cycles ORDER BY id LIMIT 1"
        ).fetchone()
    finally:
        connection.close()
    if not row or not row[0]:
        return {}
    try:
        domains = json.loads(row[0])
    except json.JSONDecodeError:
        return {}
    scores = {}
    for item in domains if isinstance(domains, list) else []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        scores[name] = {
            "score": str(item.get("score") or "").strip(),
            "gap": str(item.get("gap_to_next") or "").strip(),
        }
    return scores


def _nafs_card() -> dict:
    """بطاقة نافس المحفوظة. السجل الفارغ يعيد حقولًا فارغة."""
    connection = connect()
    try:
        row = connection.execute(
            """
            SELECT grade, enrolled, tested, reading_score, science_score, math_score,
                   weakest_skill, weakest_score
            FROM nafs_cards
            ORDER BY id
            LIMIT 1
            """
        ).fetchone()
    finally:
        connection.close()
    if not row:
        return {}
    keys = (
        "grade",
        "enrolled",
        "tested",
        "reading_score",
        "science_score",
        "math_score",
        "weakest_skill",
        "weakest_score",
    )
    return {key: str(row[index] or "").strip() for index, key in enumerate(keys)}


class NafsCardBody(BaseModel):
    """بطاقة نافس لصف واحد. الحقول الفارغة تبقى فارغة."""

    grade: str = ""
    enrolled: str = ""
    tested: str = ""
    reading_score: str = ""
    science_score: str = ""
    math_score: str = ""
    weakest_skill: str = ""
    weakest_score: str = ""


def _improvement_actions() -> list:
    """إجراءات خطة التحسين بالترتيب المحفوظ."""
    connection = connect()
    try:
        rows = connection.execute(
            """
            SELECT id, title, owner_role, owner_label, indicator_code, evidence, status, progress_percentage,
                   root_cause, objective, baseline_value, target_value, unit, resources,
                   start_hijri, start_gregorian, end_hijri, end_gregorian,
                   follow_hijri, follow_gregorian, follow_note
            FROM improvement_actions
            ORDER BY sort_order, id
            """
        ).fetchall()
    finally:
        connection.close()
    keys = (
        "id", "title", "owner_role", "owner_label", "indicator_code", "evidence", "status", "progress_percentage",
        "root_cause", "objective", "baseline_value", "target_value", "unit", "resources",
        "start_hijri", "start_gregorian", "end_hijri", "end_gregorian",
        "follow_hijri", "follow_gregorian", "follow_note",
    )
    return [
        {key: (row[index] if key == "id" else str(row[index] or "").strip()) for index, key in enumerate(keys)}
        for row in rows
    ]


class ImprovementActionBody(BaseModel):
    """إجراء محفوظ. الحقل الفارغ يبقى فارغًا."""

    id: int
    title: str = ""
    owner_label: str = ""
    indicator_code: str = ""
    evidence: str = ""
    status: str = ""
    progress_percentage: str = ""
    root_cause: str = ""
    objective: str = ""
    baseline_value: str = ""
    target_value: str = ""
    unit: str = ""
    resources: str = ""
    start_hijri: str = ""
    start_gregorian: str = ""
    end_hijri: str = ""
    end_gregorian: str = ""
    follow_hijri: str = ""
    follow_gregorian: str = ""
    follow_note: str = ""


class ImprovementPlanBody(BaseModel):
    """تعديل الإجراءات المحفوظة دون إنشاء إجراء جديد."""

    actions: list[ImprovementActionBody] = []


from .operational_plan import (
    read_plan,
    save_plan,
    save_task_link,
    task_choices,
)
from .operational_plan import summary as operational_summary
from .program_registry import (
    OWNERS,
    REGISTERS,
    STATUSES,
    add_phrase,
    approve_program,
    list_kpi_options,
    list_knowledge,
    list_phrases,
    list_programs,
    programs_for_role,
    save_program,
    template_payload,
)


class SchoolProgramBody(BaseModel):
    """حفظ برنامج. الاعتماد مسار مستقل ولا يمر من هذا الطلب."""

    id: int = 0
    program_name: str = ""
    strategic_goal: str = ""
    executive_goal: str = ""
    target_audience: str = ""
    duration: str = ""
    implementers: str = ""
    budget: str = ""
    mechanism: str = ""
    success_indicator: str = ""
    risk_management: str = ""
    register_id: int = 0
    owner_role: str = ""
    owner_roles: list[str] = []
    indicator_ids: list[int] = []
    baseline_value: str = ""
    target_value: str = ""
    current_value: str = ""
    unit: str = ""
    kpi_description: str = ""
    goal_ref: str = ""
    domain: str = ""
    level_name: str = ""
    status: str = "مسودة"
    duty_ref: str = ""
    task_ref: str = ""


class ProgramApprovalBody(BaseModel):
    """اعتماد المدير لمسودة برنامج."""

    id: int


class ProgramPhraseBody(BaseModel):
    """عبارة تُضاف إلى بنك قالب واحد وحقل واحد."""

    template_key: str = ""
    field: str = ""
    phrase: str = ""


class PlanIndicatorBody(BaseModel):
    kpi: str = ""
    target: str = ""
    measurement: str = ""


class PlanGoalBody(BaseModel):
    id: str = ""
    domain: str = ""
    text: str = ""
    progress: str = ""
    indicators: list[PlanIndicatorBody] = []


class PlanTeamBody(BaseModel):
    role: str = ""
    name: str = ""


class OperationalPlanBody(BaseModel):
    academic_year: str = ""
    vision: str = ""
    mission: str = ""
    values: list[str] = []
    swot: dict[str, str] = {}
    strategic_goals: list[PlanGoalBody] = []
    budget: str = ""
    planning_team: list[PlanTeamBody] = []
    monitoring_plan: str = ""


class TaskGoalBody(BaseModel):
    role: str = ""
    task_code: str = ""
    goal_id: str = ""


@app.get("/api/edition/tables")
def edition_tables_api(x_session_token: str = Header(default="")):
    """جدولا الإصدار: البرامج وفق الأهداف، ومتابعة الخطة. قراءة فقط."""
    from .access import require_user
    from .edition_tables import edition_tables

    try:
        require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    return edition_tables()


@app.get("/api/programs")
def school_programs():
    """البرامج المحفوظة وقوالب البروتوكول وقوائم السجلات والأدوار."""
    return {
        "programs": list_programs(),
        "templates": template_payload(),
        "registers": [{"id": number, "label": label} for number, label in REGISTERS],
        "owners": [{"role": role, "label": label} for role, label in OWNERS],
        "statuses": list(STATUSES),
        "phrases": list_phrases(),
        "knowledge": list_knowledge(),
        "kpi_options": list_kpi_options(),
        "plan_goals": [
            {"id": goal["id"], "text": goal["text"]}
            for goal in read_plan()["strategic_goals"]
        ],
    }


@app.post("/api/programs/phrases")
def save_program_phrase(body: ProgramPhraseBody):
    """يضيف عبارة إلى البنك ويعيد البنك كاملًا."""
    try:
        phrases = add_phrase(body.template_key, body.field, body.phrase)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"phrases": phrases}


@app.post("/api/programs")
def save_school_program(body: SchoolProgramBody, x_session_token: str = Header(default="")):
    """يحفظ البرنامج مسودة أو يحدّثه. لا يمنح الاعتماد."""
    try:
        programs = save_program(body)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    from .access import session_user
    from .audit_log import log_action

    actor = session_user(_token(x_session_token)) or {}
    log_action(
        actor.get("id") or "",
        "تعديل برنامج",
        "school_programs",
        body.id or "",
        "",
        body.program_name or "",
    )
    return {"programs": programs}


@app.post("/api/programs/approve")
def approve_school_program(
    body: ProgramApprovalBody,
    x_session_token: str = Header(default=""),
):
    """يحول المسودة إلى معتمد. هذا مسار المدير."""
    from .access import require_principal

    try:
        require_principal(x_session_token)
        programs = approve_program(body.id)
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"programs": programs}


class DailyTaskBody(BaseModel):
    """مهمة يومية: تعبئة تلقائية قابلة للتعديل أو مهمة يدوية."""

    id: int = 0
    task_date: str = ""
    hijri_date: str = ""
    title: str = ""
    description: str = ""
    owner_role: str = ""
    status: str = "مستحقة"
    priority: str = "عادي"
    evidence_status: str = "غير مطلوب"
    evidence_note: str = ""
    due_iso: str = ""
    source_ref: str = ""
    is_overridden: bool = True
    filter_role: str = ""


class DailyAutofillBody(BaseModel):
    """إعادة توليد المهام التلقائية ليوم محدد مع متابعات محلية اختيارية."""

    date: str = ""
    owner_role: str = ""
    follows: list = Field(default_factory=list)


@app.get("/api/daily-tasks")
def get_daily_tasks(date: str = "", owner_role: str = ""):
    """لوحة المهام اليومية بعد تعبئة تلقائية من المصادر المحفوظة."""
    payload = autofill_daily_tasks(date or None)
    if owner_role:
        return dashboard_payload(payload.get("date"), owner_role)
    return payload


@app.post("/api/daily-tasks/autofill")
def post_daily_autofill(body: DailyAutofillBody):
    """يشغّل محرك التعبئة ويُدمج متابعات السجلات المحلية إن وُجدت."""
    follows = body.follows if isinstance(body.follows, list) else []
    payload = autofill_daily_tasks(body.date or None, local_follows=follows)
    if body.owner_role:
        return dashboard_payload(payload.get("date"), body.owner_role)
    return payload


class SignalActionBody(BaseModel):
    """قبول أو تأجيل أو تجاهل إشارة غرفة القيادة."""

    signal_id: int
    action: str = ""
    note: str = ""
    defer_days: int = 1


@app.get("/api/command-room/today")
def get_command_room_today(refresh: int = 1):
    """لوحة «اليوم يحتاج انتباهًا» — يُعاد توليد الإشارات افتراضيًا."""
    if refresh:
        return refresh_signals()
    return list_today_signals()


@app.get("/api/command-room/rules")
def get_command_room_rules():
    """القواعد التشغيلية المصغّرة لغرفة القيادة."""
    return {"rules": list_rules()}


@app.post("/api/command-room/action")
def post_command_room_action(body: SignalActionBody):
    """يحفظ قرار المستخدم على الإشارة (قبول/تأجيل/تجاهل)."""
    try:
        return record_signal_action(body.signal_id, body.action, body.note, body.defer_days)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/daily-tasks")
def post_daily_task(body: DailyTaskBody):
    """يحفظ تعديلاً أو مهمة جديدة (Override بعد التعبئة)."""
    try:
        return save_task(body)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


class SoftSlotBody(BaseModel):
    """تعديل فترة لاصفية في الخطة اليومية."""

    slot_code: str = ""
    title: str = ""
    minutes: int = 0
    time_hint: str = ""
    owner_role: str = ""
    skill_focus: str = ""
    sort_order: int = 0


class SoftFollowBody(BaseModel):
    """تعديل متابعة فترة لاصفية ليوم محدد."""

    day_iso: str = ""
    slot_code: str = ""
    status: str = "لم يُنفّذ"
    note: str = ""
    evidence_status: str = "ناقص"
    evidence_note: str = ""


class SoftFollowBulkBody(BaseModel):
    """تعبئة جماعية لمتابعة الأسبوع أو يوم واحد."""

    week_start: str = ""
    day_iso: str = ""
    status: str = "منفّذ"
    evidence_status: str = "غير مطلوب"
    rows: list = Field(default_factory=list)


@app.get("/api/soft-periods")
def get_soft_periods(week_start: str = ""):
    """الخطة الزمنية اليومية 60د + متابعة الأسبوع."""
    return dashboard_bundle(week_start)


@app.post("/api/soft-periods/autofill")
def post_soft_periods_autofill(week_start: str = ""):
    """يعيد تعبئة القالب والمتابعة دون مسح Override."""
    return dashboard_bundle(week_start)


@app.post("/api/soft-periods/slot")
def post_soft_period_slot(body: SoftSlotBody):
    """يحفظ تعديلاً على فترة في الخطة اليومية."""
    try:
        return save_slot(body)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/soft-periods/follow")
def post_soft_period_follow(body: SoftFollowBody):
    """يحفظ حالة تنفيذ فترة في يوم محدد."""
    try:
        return save_follow(body)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/soft-periods/follow-bulk")
def post_soft_period_follow_bulk(body: SoftFollowBulkBody):
    """يملأ متابعة الأسبوع أو يوماً كاملاً دفعة واحدة."""
    try:
        return save_follow_bulk(body)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/soft-periods/evidence-images")
async def post_soft_evidence_images(
    day_iso: str = Form(...),
    slot_code: str = Form(...),
    files: list[UploadFile] | None = File(None),
    file: UploadFile | None = File(None),
):
    """يرفع صوراً متعددة لشاهد فترة لاصفية (ملف أو كاميرا) داخل evidence/soft."""
    uploads = [item for item in (files or []) if item is not None and item.filename]
    if file is not None and file.filename:
        uploads.append(file)
    if not uploads:
        raise HTTPException(status_code=400, detail="اختر صورة واحدة على الأقل")
    payload = []
    for item in uploads:
        payload.append(
            {
                "filename": item.filename or "capture.jpg",
                "content": await item.read(),
            }
        )
    try:
        return add_soft_evidence_images(day_iso, slot_code, payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


class SoftEvidenceDeleteBody(BaseModel):
    """حذف صورة واحدة من شاهد فترة لاصفية."""

    day_iso: str = ""
    slot_code: str = ""
    image_path: str = ""


@app.post("/api/soft-periods/evidence-images/delete")
def post_soft_evidence_image_delete(body: SoftEvidenceDeleteBody):
    """يحذف صورة شاهد واحدة مع Override دون مسح بقية الصور."""
    try:
        return remove_soft_evidence_image(body.day_iso, body.slot_code, body.image_path)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


def _portfolio_owner(x_session_token: str):
    """جلسة صاحب سجل الإنجاز. النوع الجديد لا يُقرأ ولا يُكتب لحساب آخر."""
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _assert_own_portfolio(x_session_token: str, entity_key: str) -> None:
    user = _portfolio_owner(x_session_token)
    if str(entity_key or "").strip() != str(user.get("id") or "").strip():
        raise HTTPException(status_code=403, detail="شاهد السجل يُربط بحسابك فقط.")


@app.get("/api/visual-evidence")
def get_visual_evidence(
    entity_type: str = "",
    entity_key: str = "",
    x_session_token: str = Header(default=""),
):
    """يرجع الشواهد البصرية المرتبطة بكيان محفوظ."""
    if str(entity_type or "").strip() == "teacher_portfolio":
        _assert_own_portfolio(x_session_token, entity_key)
    try:
        items = list_visual_evidence(entity_type, entity_key)
        return {"entity_type": entity_type, "entity_key": entity_key, "items": items}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/visual-evidence")
@app.post("/api/session/visual-evidence/upload")
async def post_visual_evidence(
    entity_type: str = Form(...),
    entity_key: str = Form(...),
    register_key: str = Form(""),
    link_url: str = Form(""),
    link_name: str = Form(""),
    files: list[UploadFile] | None = File(None),
    file: UploadFile | None = File(None),
    x_session_token: str = Header(default=""),
):
    """يرفع صوراً/فيديو/PDF أو يضيف رابطاً كشاهد بصري موحّد."""
    actor = _portfolio_owner(x_session_token)
    if str(entity_type or "").strip() == "teacher_portfolio":
        _assert_own_portfolio(x_session_token, entity_key)
    uploader = str(actor.get("id") or "").strip()
    uploads = [item for item in (files or []) if item is not None and item.filename]
    if file is not None and file.filename:
        uploads.append(file)
    try:
        if uploads:
            payload = []
            for item in uploads:
                payload.append(
                    {
                        "filename": item.filename or "file.bin",
                        "content": await item.read(),
                    }
                )
            result = add_visual_files(entity_type, entity_key, payload, register_key, uploaded_by=uploader)
        elif str(link_url or "").strip():
            result = add_visual_link(entity_type, entity_key, link_url, link_name, register_key, uploaded_by=uploader)
        else:
            raise ValueError("أرفق ملفاً أو أدخل رابطاً.")
        # عند اللاصفية: أعد حزمة المتابعة كاملة لسهولة التحديث في الواجهة.
        if entity_type == "soft_period" and "|" in entity_key:
            day_iso, slot_code = entity_key.split("|", 1)
            from .soft_periods import follow_payload, week_start_sunday

            week = week_start_sunday(day_iso)
            bundle = follow_payload(week)
            bundle["visual"] = result
            return bundle
        return result
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


class VisualEvidenceDeleteBody(BaseModel):
    """حذف مرفق شاهد بصري بالمعرّف."""

    id: int = 0


@app.post("/api/visual-evidence/delete")
def post_visual_evidence_delete(
    body: VisualEvidenceDeleteBody,
    x_session_token: str = Header(default=""),
):
    """يحذف مرفقاً بصرياً واحداً إن كان رافعه أو سجله الشخصي."""
    actor = _portfolio_owner(x_session_token)
    try:
        item = get_visual_item(body.id)
        if not item:
            raise ValueError("المرفق غير موجود.")
        if not can_delete_visual(actor, item):
            raise HTTPException(status_code=403, detail="لا صلاحية على هذا الشاهد.")
        result = remove_visual_item(body.id)
        if result.get("entity_type") == "soft_period" and "|" in str(result.get("entity_key") or ""):
            day_iso, _slot = str(result["entity_key"]).split("|", 1)
            from .soft_periods import follow_payload, week_start_sunday

            week = week_start_sunday(day_iso)
            bundle = follow_payload(week)
            bundle["visual"] = result
            return bundle
        return result
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


class VisualEvidenceRebindBody(BaseModel):
    """ترحيل شواهد من مفتاح مسودة إلى مفتاح الكيان المحفوظ."""

    entity_type: str = ""
    from_key: str = ""
    to_key: str = ""


@app.post("/api/visual-evidence/rebind")
def post_visual_evidence_rebind(body: VisualEvidenceRebindBody):
    """ينقل الشواهد من مفتاح إلى آخر دون خلط كيانات أخرى."""
    if str(body.entity_type or "").strip() == "teacher_portfolio":
        raise HTTPException(status_code=400, detail="شاهد السجل لا يُنقل.")
    try:
        return rebind_visual_evidence(body.entity_type, body.from_key, body.to_key)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


class PhraseRenderBody(BaseModel):
    """دمج صياغة تربوية مع سياق المهمة أو الشاهد أو المحضر."""

    template_text: str = ""
    context: dict = Field(default_factory=dict)
    category: str = ""
    sub_category: str = ""
    field_name: str = ""


class PhraseSuggestBody(BaseModel):
    """اقتراح صياغات لمهمة يومية من بنك التأسيس."""

    task: dict = Field(default_factory=dict)


@app.get("/api/phrase-bank")
def get_phrase_bank(category: str = "", sub_category: str = "", field_name: str = ""):
    """بنك الصياغات التربوية الأساسي للتعبئة التلقائية."""
    from .phrase_bank import list_phrases

    seed_phrase_bank()
    if category or sub_category or field_name:
        return {
            "phrases": list_phrases(category, sub_category, field_name),
            "filtered": True,
            "category": category,
            "sub_category": sub_category,
            "field_name": field_name,
        }
    return phrase_catalog()


@app.post("/api/phrase-bank/render")
def post_phrase_render(body: PhraseRenderBody):
    """يعيد النص بعد دمج المتغيرات دون اختراع قيم فارغة."""
    if body.field_name:
        return {
            "phrases": phrases_for_context(
                body.field_name,
                body.context,
                body.category,
                body.sub_category,
            )
        }
    return {"rendered_text": render_phrase(body.template_text, body.context)}


@app.post("/api/phrase-bank/suggest-task")
def post_phrase_suggest_task(body: PhraseSuggestBody):
    """صياغات الوصف والشاهد المناسبة لمهمة من اللوحة اليومية."""
    return suggest_for_task(body.task)


@app.get("/api/operational-plan")
def operational_plan():
    """الخطة الأم. بلا صف محفوظ تُقرأ الرؤية والأهداف من ملف المدير."""
    plan = read_plan()
    plan["summary"] = operational_summary()
    return plan


@app.get("/api/operational-plan/tasks")
def operational_tasks(role: str = "principal"):
    """بنود دور واحد لربطها بهدف. الربط لا يُكتب إلا بطلب."""
    return {"tasks": task_choices(role)}


@app.post("/api/operational-plan")
def save_operational_plan(body: OperationalPlanBody):
    """يحفظ الخطة الأم في جدولها."""
    try:
        plan = save_plan(body)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    plan["summary"] = operational_summary()
    return plan


@app.post("/api/operational-plan/tasks")
def link_operational_task(body: TaskGoalBody):
    """يربط بند خطة منسوب بهدف استراتيجي واحد."""
    try:
        plan = save_task_link(body.role, body.task_code, body.goal_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    plan["summary"] = operational_summary()
    return plan


@app.get("/api/improvement")
def improvement_plan():
    """إجراءات خطة التحسين."""
    return {"actions": _improvement_actions()}


@app.post("/api/improvement")
def save_improvement_plan(body: ImprovementPlanBody):
    """يحدّث الإجراءات الموجودة. الصف غير المحفوظ لا يُنشأ من الطلب."""
    moment = stamp()
    connection = connect()
    try:
        for action in body.actions:
            action_status = action.status.strip()
            if action_status and action_status not in STATUSES:
                raise HTTPException(status_code=400, detail="حالة الإجراء غير معروفة")
            progress = action.progress_percentage.strip()
            if progress:
                try:
                    number = float(progress.replace("%", ""))
                except ValueError as error:
                    raise HTTPException(status_code=400, detail="نسبة الإنجاز رقم من 0 إلى 100") from error
                if number < 0 or number > 100:
                    raise HTTPException(status_code=400, detail="نسبة الإنجاز رقم من 0 إلى 100")
            unit = action.unit.strip()
            if unit and unit not in ("%", "عدد", "نسبة"):
                raise HTTPException(status_code=400, detail="الوحدة: % أو عدد أو نسبة")
            connection.execute(
                """
                UPDATE improvement_actions
                SET title = ?, owner_label = ?, indicator_code = ?, evidence = ?, status = ?,
                    progress_percentage = ?, root_cause = ?, objective = ?, baseline_value = ?,
                    target_value = ?, unit = ?, resources = ?, start_hijri = ?, start_gregorian = ?,
                    end_hijri = ?, end_gregorian = ?, follow_hijri = ?, follow_gregorian = ?,
                    follow_note = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    action.title.strip(),
                    action.owner_label.strip(),
                    action.indicator_code.strip(),
                    action.evidence.strip(),
                    action_status,
                    progress,
                    action.root_cause.strip(),
                    action.objective.strip(),
                    action.baseline_value.strip(),
                    action.target_value.strip(),
                    unit,
                    action.resources.strip(),
                    action.start_hijri.strip(),
                    action.start_gregorian.strip(),
                    action.end_hijri.strip(),
                    action.end_gregorian.strip(),
                    action.follow_hijri.strip(),
                    action.follow_gregorian.strip(),
                    action.follow_note.strip(),
                    moment,
                    action.id,
                ),
            )
        connection.commit()
    finally:
        connection.close()
    return {"actions": _improvement_actions()}


@app.get("/api/nafs")
def nafs_card():
    """بطاقة نافس المحفوظة."""
    return _nafs_card()


@app.post("/api/nafs")
def save_nafs_card(body: NafsCardBody):
    """يحفظ بطاقة نافس واحدة. التعديل يستبدل الصف المحفوظ ولا ينشئ نسخة ثانية."""
    moment = stamp()
    values = (
        body.grade.strip(),
        body.enrolled.strip(),
        body.tested.strip(),
        body.reading_score.strip(),
        body.science_score.strip(),
        body.math_score.strip(),
        body.weakest_skill.strip(),
        body.weakest_score.strip(),
        moment,
    )
    connection = connect()
    try:
        current = connection.execute("SELECT id FROM nafs_cards ORDER BY id LIMIT 1").fetchone()
        if current:
            connection.execute(
                """
                UPDATE nafs_cards
                SET grade = ?, enrolled = ?, tested = ?, reading_score = ?, science_score = ?,
                    math_score = ?, weakest_skill = ?, weakest_score = ?, updated_at = ?
                WHERE id = ?
                """,
                (*values, current[0]),
            )
        else:
            connection.execute(
                """
                INSERT INTO nafs_cards (
                    grade, enrolled, tested, reading_score, science_score, math_score,
                    weakest_skill, weakest_score, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                values,
            )
        connection.commit()
    finally:
        connection.close()
    return _nafs_card()


@app.get("/api/evaluation/compare")
def evaluation_compare(x_session_token: str = Header(default="")):
    """مقارنة دورات التقويم الخارجي الثلاث للجلسة فقط."""
    from .access import require_user
    from .accreditation_bank import comparison_payload

    try:
        require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    return comparison_payload()


@app.get("/api/evaluation")
def evaluation_registry():
    """دورة التقويم ومؤشراتها. نسب المجالات تُرسم على شريحة المجالات."""
    connection = connect()
    try:
        cycle = connection.execute(
            """
            SELECT id, title, academic_year, overall_score, overall_level, domains_json, source_note
            FROM evaluation_cycles
            ORDER BY id
            LIMIT 1
            """
        ).fetchone()
        if not cycle:
            return {"cycle": None, "indicators": []}
        rows = connection.execute(
            """
            SELECT id, cycle_id, code, domain, standard_name, statement, level, domain_score, gap_to_next
            FROM evaluation_indicators
            WHERE cycle_id = ?
            """,
            (cycle[0],),
        ).fetchall()
    finally:
        connection.close()
    indicators = [_indicator_payload(row) for row in rows]
    indicators.sort(key=lambda item: _code_key(item["code"]))
    return {"cycle": _cycle_payload(cycle), "indicators": indicators}


@app.post("/api/evaluation/cycle")
def save_evaluation_cycle(body: EvaluationCycleBody):
    """يحفظ رأس الدورة، وينسخ نسبة كل مجال إلى مؤشراته."""
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="عنوان الدورة مطلوب")
    level = body.overall_level.strip()
    if level and level not in _EVAL_LEVELS:
        raise HTTPException(status_code=400, detail="مستوى الأداء: تهيئة أو انطلاق أو تقدم أو تميز")
    domains = []
    for item in body.domains:
        name = item.name.strip()
        if not name:
            continue
        domains.append({
            "name": name,
            "score": _score_text(item.score),
            "gap_to_next": _score_text(item.gap_to_next),
        })
    moment = stamp()
    connection = connect()
    try:
        current = connection.execute("SELECT id FROM evaluation_cycles ORDER BY id LIMIT 1").fetchone()
        payload = json.dumps(domains, ensure_ascii=False)
        values = (title, body.academic_year.strip(), _score_text(body.overall_score), level, payload, moment)
        if current:
            cycle_id = current[0]
            connection.execute(
                """
                UPDATE evaluation_cycles
                SET title = ?, academic_year = ?, overall_score = ?, overall_level = ?, domains_json = ?, updated_at = ?
                WHERE id = ?
                """,
                (*values, cycle_id),
            )
        else:
            cursor = connection.execute(
                """
                INSERT INTO evaluation_cycles (
                    title, academic_year, overall_score, overall_level, domains_json, source_note, updated_at
                ) VALUES (?, ?, ?, ?, ?, '', ?)
                """,
                values,
            )
            cycle_id = cursor.lastrowid
        for item in domains:
            connection.execute(
                """
                UPDATE evaluation_indicators
                SET domain_score = ?, gap_to_next = ?, updated_at = ?
                WHERE cycle_id = ? AND domain = ?
                """,
                (item["score"], item["gap_to_next"], moment, cycle_id, item["name"]),
            )
        connection.commit()
    finally:
        connection.close()
    return {"saved": cycle_id}


@app.post("/api/evaluation/indicators")
def save_evaluation_indicator(body: EvaluationIndicatorBody):
    """يضيف مؤشرًا أو يعدّل صفّه. نسبة المجال تُنسخ لبقية مؤشرات المجال نفسه."""
    code = body.code.strip()
    domain = body.domain.strip()
    standard_name = body.standard_name.strip()
    statement = body.statement.strip()
    level = body.level.strip()
    if not code or not domain or not standard_name or not statement or not level:
        raise HTTPException(status_code=400, detail="الرمز والمجال والمعيار والنص والمستوى مطلوبة")
    if level not in _EVAL_LEVELS:
        raise HTTPException(status_code=400, detail="المستوى: تهيئة أو انطلاق أو تقدم أو تميز")
    score = _score_text(body.domain_score)
    gap = _score_text(body.gap_to_next)
    moment = stamp()
    connection = connect()
    try:
        cycle = connection.execute(
            "SELECT id, domains_json FROM evaluation_cycles WHERE id = ?",
            (body.cycle_id,),
        ).fetchone()
        if not cycle:
            raise HTTPException(status_code=404, detail="دورة التقويم غير موجودة")
        occupied = connection.execute(
            "SELECT id FROM evaluation_indicators WHERE cycle_id = ? AND code = ?",
            (body.cycle_id, code),
        ).fetchone()
        if body.id:
            current = connection.execute(
                "SELECT id FROM evaluation_indicators WHERE id = ? AND cycle_id = ?",
                (body.id, body.cycle_id),
            ).fetchone()
            if not current:
                raise HTTPException(status_code=404, detail="المؤشر غير موجود")
            if occupied and occupied[0] != body.id:
                raise HTTPException(status_code=400, detail="الرمز مستخدم لمؤشر آخر")
            connection.execute(
                """
                UPDATE evaluation_indicators
                SET code = ?, domain = ?, standard_name = ?, statement = ?, level = ?,
                    domain_score = ?, gap_to_next = ?, updated_at = ?
                WHERE id = ?
                """,
                (code, domain, standard_name, statement, level, score, gap, moment, body.id),
            )
            saved = body.id
        else:
            if occupied:
                raise HTTPException(status_code=400, detail="الرمز مستخدم لمؤشر آخر")
            cursor = connection.execute(
                """
                INSERT INTO evaluation_indicators (
                    cycle_id, code, domain, standard_name, statement, level, domain_score, gap_to_next, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (body.cycle_id, code, domain, standard_name, statement, level, score, gap, moment),
            )
            saved = cursor.lastrowid
        connection.execute(
            """
            UPDATE evaluation_indicators
            SET domain_score = ?, gap_to_next = ?
            WHERE cycle_id = ? AND domain = ?
            """,
            (score, gap, body.cycle_id, domain),
        )
        try:
            domains = json.loads(cycle[1] or "[]")
        except json.JSONDecodeError:
            domains = []
        if not isinstance(domains, list):
            domains = []
        found = False
        for item in domains:
            if isinstance(item, dict) and item.get("name") == domain:
                item["score"] = score
                item["gap_to_next"] = gap
                found = True
        if not found:
            domains.append({"name": domain, "score": score, "gap_to_next": gap})
        connection.execute(
            "UPDATE evaluation_cycles SET domains_json = ?, updated_at = ? WHERE id = ?",
            (json.dumps(domains, ensure_ascii=False), moment, body.cycle_id),
        )
        connection.commit()
    finally:
        connection.close()
    return {"saved": saved}


@app.delete("/api/evaluation/indicators/{indicator_id}")
def delete_evaluation_indicator(indicator_id: int):
    """يحذف مؤشرًا واحدًا من السجل."""
    connection = connect()
    try:
        connection.execute("DELETE FROM evaluation_indicators WHERE id = ?", (indicator_id,))
        connection.commit()
    finally:
        connection.close()
    return {"deleted": indicator_id}


@app.get("/data/integration-map.json")
def integration_map():
    """خريطة الترابط. السجلات نفسها تبقى في قاعدة School_Data."""
    path = _ROOT / "data" / "integration-map.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="خريطة الترابط غير موجودة")
    return FileResponse(path, media_type="application/json")


# تقديم شعارات الكتيب من School_Data/assets قبل المسار الجذر حتى لا يبتلعها
app.mount(
    "/assets",
    StaticFiles(directory=str(_ROOT / "School_Data" / "assets")),
    name="assets",
)

# شواهد الصور تُقرأ عبر GET /api/session/evidence/{id}/file بجلسة (قرار 205).
(_ROOT / "School_Data" / "evidence").mkdir(parents=True, exist_ok=True)

# أنوية الواجهة (قرار 268/270) — ملفات JS فقط، قبل المسار الجذر
app.mount(
    "/cores",
    StaticFiles(directory=str(_ROOT / "Core_Engine" / "cores")),
    name="cores",
)

# تقديم الواجهات بعد مسارات التطبيق حتى لا يبتلع المسار /health
app.mount("/", StaticFiles(directory=CANVAS_DIR, html=True), name="canvas")
