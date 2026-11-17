# مكتب الدور: حزمة العمل من المحفوظ فقط. التنفيذ والتعديل للمستخدم.
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException

from .database import connect

router = APIRouter(tags=["session-desk"])

_ROOT = Path(__file__).resolve().parent
_BANK = _ROOT / "task_bank"

DELIVER_SLOTS = (
    ("plan", "الخطة الدراسية"),
    ("prep", "التحضير اليومي"),
    ("visits", "الزيارات الصفية"),
    ("tests", "أدوات التقويم"),
    ("results", "تحليل النتائج"),
    ("portfolio", "ملف إنجاز المعلم"),
    ("growth", "التطوير المهني"),
)

BANK_FILE = {
    "principal": "executive.json",
    "vice_education": "vice_academic.json",
    "vice_students": "vice_students.json",
    "teacher": "teacher.json",
    "counselor": "student_counselor.json",
    "activity": "activity_leader.json",
    "admin": "admin_assistant.json",
    "lab": "lab_tech.json",
    "librarian": "librarian.json",
}


def _token(value: str) -> str:
    return str(value or "").strip()


def _require_user(x_session_token: str) -> dict:
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _staff_row(connection, national_id: str) -> dict:
    row = connection.execute(
        "SELECT national_id, name, role, specialty FROM noor_staff WHERE national_id = ?",
        (national_id,),
    ).fetchone()
    if not row:
        return {"national_id": national_id, "name": "", "role": "", "specialty": ""}
    return {
        "national_id": str(row[0] or "").strip(),
        "name": str(row[1] or "").strip(),
        "role": str(row[2] or "").strip(),
        "specialty": str(row[3] or "").strip(),
    }


def _leadership_ids(connection) -> dict:
    out = {"manager": "", "education": "", "students": "", "counselor": "", "activity": ""}
    try:
        rows = connection.execute(
            "SELECT role, national_id FROM leadership_seat ORDER BY role, sort_order"
        ).fetchall()
    except Exception:
        return out
    for role, identity in rows:
        ident = str(identity or "").strip()
        if role == "manager" and ident and not out["manager"]:
            out["manager"] = ident
        elif role == "education_agents" and ident and not out["education"]:
            out["education"] = ident
        elif role == "student_agents" and ident and not out["students"]:
            out["students"] = ident
        elif role == "counselors" and ident and not out["counselor"]:
            out["counselor"] = ident
        elif role == "activity_leader" and ident and not out["activity"]:
            out["activity"] = ident
    return out


def _desk_kind(role: str, uid: str, seats: dict) -> str:
    text = str(role or "").strip()
    if text.startswith("مدير"):
        return "principal"
    if text.startswith("وكيل"):
        if uid and uid == seats.get("students"):
            return "vice_students"
        return "vice_education"
    if "موجه" in text:
        return "counselor"
    if "رائد النشاط" in text:
        return "activity"
    if "مختبر" in text:
        return "lab"
    if "مصادر" in text or "أمين" in text:
        return "librarian"
    if "معلم" in text:
        return "teacher"
    if "أداري" in text or "إداري" in text:
        return "admin"
    return "teacher"


def _forms(kind: str) -> list:
    common = [
        {"title": "مهامي", "href": "#view-tasks", "action": "تنفيذ"},
        {"title": "لجاني", "href": "#view-committees", "action": "تنفيذ"},
        {"title": "شواهدي", "href": "#view-evidence", "action": "رفع / تعديل"},
    ]
    if kind == "teacher":
        return [
            {"title": "تسليماتي الدورية", "href": "#view-deliverables", "action": "رفع / تعديل"},
            {"title": "ملف الإنجاز (قالب النظام)", "href": "#view-portfolio", "action": "طباعة / تعديل"},
        ] + common
    if kind in ("vice_education", "vice_students", "principal"):
        return [
            {"title": "الخطط والبرامج", "href": "#view-planning", "action": "تنفيذ / تعديل"},
            {"title": "مركز التنفيذ", "href": "#view-execution", "action": "تنفيذ"},
            {"title": "تسليمات المعلمين", "href": "#view-deliverables", "action": "متابعة"},
        ] + common
    return [
        {"title": "سجل الإنجاز", "href": "#view-portfolio", "action": "طباعة / تعديل"},
    ] + common


def _duties(kind: str) -> list:
    name = BANK_FILE.get(kind) or "teacher.json"
    path = _BANK / name
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    items = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or "").strip()
        if not title:
            continue
        items.append({
            "code": str(row.get("task_code") or "").strip(),
            "title": title,
            "week": row.get("week_target") if row.get("week_target") is not None else "",
            "method": str(row.get("execution_method") or "").strip(),
            "evidence": str(row.get("evidence") or "").strip(),
            "category": str(row.get("category") or "").strip(),
        })
    return items


def _deliver_status(connection, teacher_id: str) -> list:
    counts = {}
    try:
        rows = connection.execute(
            "SELECT deliverable_type, COUNT(*) FROM teacher_deliverables WHERE teacher_id = ? GROUP BY deliverable_type",
            (teacher_id,),
        ).fetchall()
    except Exception:
        rows = []
    for kind, count in rows:
        counts[str(kind)] = int(count or 0)
    slots = []
    for kind, title in DELIVER_SLOTS:
        count = counts.get(kind, 0)
        slots.append({
            "kind": kind,
            "title": title,
            "count": count,
            "ready": count > 0,
            "href": "#view-deliverables",
            "action": "تعديل" if count else "رفع التنفيذ",
        })
    return slots


def _my_programs(connection, uid: str) -> list:
    try:
        rows = connection.execute(
            """
            SELECT id, program_name, status FROM school_programs
            WHERE assignee_staff_id = ? AND program_name IS NOT NULL AND trim(program_name) != ''
            ORDER BY id
            """,
            (uid,),
        ).fetchall()
    except Exception:
        return []
    return [
        {
            "id": row[0],
            "title": str(row[1] or "").strip(),
            "status": str(row[2] or "").strip() or "مسودة",
            "href": "#view-plan-details?id=" + str(row[0]),
            "action": "تنفيذ / تعديل",
        }
        for row in rows
    ]


def _hide_specialty(role: str) -> bool:
    text = str(role or "")
    return text.startswith("مدير") or text.startswith("وكيل") or text.startswith("موجه")


def _desk_programs(connection, uid: str, kind: str) -> list:
    items = _my_programs(connection, uid)
    if kind != "principal":
        return items
    seen = {item["title"] for item in items}
    try:
        rows = connection.execute(
            """
            SELECT id, program_name, status FROM school_programs
            WHERE COALESCE(is_deleted, 0) = 0 AND owner_role = 'principal'
              AND program_name IS NOT NULL AND trim(program_name) != ''
            ORDER BY id
            """
        ).fetchall()
    except Exception:
        rows = []
    for row in rows:
        title = str(row[1] or "").strip()
        if not title or title in seen:
            continue
        seen.add(title)
        items.append({
            "id": row[0],
            "title": title,
            "status": str(row[2] or "").strip() or "مسند",
            "href": "#view-plan-details?id=" + str(row[0]),
            "action": "تنفيذ / تعديل",
        })
    if not any("تحسين" in item["title"] for item in items):
        items.append({
            "id": "improve-follow",
            "title": "متابعة خطة التحسين",
            "status": "مفتوح",
            "href": "#view-planning",
            "action": "متابعة",
        })
    if not any("مجلس" in item["title"] for item in items):
        items.append({
            "id": "council-approve",
            "title": "اعتماد المجالس",
            "status": "مفتوح",
            "href": "#view-execution",
            "action": "اعتماد",
        })
    return items


def _my_committees(connection, uid: str) -> list:
    titles = {
        "admin": "اللجنة الإدارية",
        "guidance": "لجنة التوجيه والإرشاد",
        "achievement": "لجنة التحصيل الدراسي",
        "excellence": "لجنة التميز",
        "fund": "فريق الصندوق المدرسي",
        "safety": "فريق الأمن والسلامة المدرسية",
        "activity": "لجنة النشاط والمناسبات",
        "discipline": "لجنة الانضباط والتدخل السريع",
        "special": "فريق التربية الخاصة",
    }
    seats = {"chair": "رئيس", "member": "عضو", "exofficio": "بحكم المنصب"}
    try:
        rows = connection.execute(
            "SELECT committee_id, seat FROM committee_seat WHERE national_id = ? ORDER BY committee_id",
            (uid,),
        ).fetchall()
    except Exception:
        return []
    return [
        {
            "id": row[0],
            "title": titles.get(row[0], row[0]),
            "seat": seats.get(row[1], row[1]),
            "href": "#view-committees",
            "action": "تنفيذ",
        }
        for row in rows
    ]


@router.get("/api/session/desk")
def get_role_desk(x_session_token: str = Header(default="")):
    user = _require_user(x_session_token)
    uid = str(user.get("id") or "").strip()
    connection = connect()
    try:
        staff = _staff_row(connection, uid)
        kind = _desk_kind(user.get("role") or staff.get("role") or "", uid, _leadership_ids(connection))
        labels = {
            "principal": "مكتب مدير المدرسة",
            "vice_education": "مكتب وكيل الشؤون التعليمية",
            "vice_students": "مكتب وكيل شؤون الطلاب",
            "teacher": "مكتب المعلم",
            "counselor": "مكتب الموجه الطلابي",
            "activity": "مكتب رائد النشاط",
            "admin": "مكتب الإداري",
            "lab": "مكتب محضر المختبر",
            "librarian": "مكتب أمين المصادر",
        }
        payload = {
            "desk_kind": kind,
            "title": labels.get(kind, "مكتب العمل"),
            "hint": "الحزمة جاهزة من السجل. دورك التنفيذ، والتعديل إن لزم فقط.",
            "person": {
                "national_id": uid,
                "name": staff.get("name") or str(user.get("name") or "").strip(),
                "role": staff.get("role") or str(user.get("role") or "").strip(),
                "specialty": "" if _hide_specialty(staff.get("role") or "") else (staff.get("specialty") or ""),
            },
            "forms": _forms(kind),
            "duties": _duties(kind),
            "deliverables": _deliver_status(connection, uid) if kind == "teacher" else [],
            "programs": _desk_programs(connection, uid, kind),
            "committees": _my_committees(connection, uid),
        }
        return payload
    finally:
        connection.close()
