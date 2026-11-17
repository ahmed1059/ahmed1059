# ثلاثة شواهد بيئة مدرسية لعام 1448–1449 من محطات التقويم فقط.

from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .database import connect
from .planning_seeds import ACADEMIC_EVENTS
from .visual_evidence import list_visual_evidence

router = APIRouter(tags=["session-env-evidence"])

YEAR = "1448-1449"
_HIJRI_MONTHS = (
    "",
    "محرم",
    "صفر",
    "ربيع الأول",
    "ربيع الآخر",
    "جمادى الأولى",
    "جمادى الآخرة",
    "رجب",
    "شعبان",
    "رمضان",
    "شوال",
    "ذو القعدة",
    "ذو الحجة",
)
_GREG_MONTHS = (
    "",
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
)


def _token(value: str) -> str:
    return str(value or "").strip()


def _require_user(x_session_token: str) -> dict:
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _parse_slash(value: str) -> tuple[int, int, int] | None:
    parts = str(value or "").strip().split("/")
    if len(parts) != 3:
        return None
    try:
        day = int(parts[0])
        month = int(parts[1])
        year = int(parts[2])
    except ValueError:
        return None
    if day < 1 or month < 1 or month > 12 or year < 1:
        return None
    return day, month, year


def _format_pair(hijri: str, gregorian: str) -> dict:
    h_parts = _parse_slash(hijri)
    g_parts = _parse_slash(gregorian)
    hijri_text = ""
    greg_text = ""
    if h_parts:
        hijri_text = (
            str(h_parts[0])
            + " "
            + _HIJRI_MONTHS[h_parts[1]]
            + " "
            + str(h_parts[2])
            + "هـ"
        )
    if g_parts:
        greg_text = (
            str(g_parts[0])
            + " "
            + _GREG_MONTHS[g_parts[1]]
            + " "
            + str(g_parts[2])
            + "م"
        )
    line = hijri_text
    if hijri_text and greg_text:
        line += " الموافق " + greg_text
    elif greg_text:
        line = greg_text
    return {
        "hijri": hijri_text,
        "gregorian": greg_text,
        "line": line,
        "hijri_raw": str(hijri or "").strip(),
        "gregorian_raw": str(gregorian or "").strip(),
    }


def _event_from_seeds(kind: str) -> tuple[str, str, str]:
    for year, title, hijri, gregorian, etype in ACADEMIC_EVENTS:
        if year == YEAR and etype == kind:
            return title, hijri, gregorian
    return "", "", ""


def _event(connection, kind: str) -> dict:
    row = None
    try:
        row = connection.execute(
            """
            SELECT title, hijri, gregorian
            FROM academic_calendar_events
            WHERE year = ? AND type = ?
            ORDER BY id
            LIMIT 1
            """,
            (YEAR, kind),
        ).fetchone()
    except Exception:
        row = None
    if row:
        title = str(row[0] or "").strip()
        hijri = str(row[1] or "").strip()
        gregorian = str(row[2] or "").strip()
    else:
        title, hijri, gregorian = _event_from_seeds(kind)
    pair = _format_pair(hijri, gregorian)
    pair["title"] = title
    pair["type"] = kind
    return pair


def _seat_id(connection, role: str) -> str:
    row = connection.execute(
        """
        SELECT national_id FROM leadership_seat
        WHERE role = ? ORDER BY sort_order LIMIT 1
        """,
        (role,),
    ).fetchone()
    return str(row[0] or "").strip() if row else ""


def _staff(connection, national_id: str) -> dict:
    ident = str(national_id or "").strip()
    if not ident:
        return {"id": "", "name": ""}
    row = connection.execute(
        "SELECT national_id, name FROM noor_staff WHERE national_id = ?",
        (ident,),
    ).fetchone()
    if not row:
        return {"id": ident, "name": ""}
    return {"id": str(row[0] or "").strip(), "name": str(row[1] or "").strip()}


def _photo_count(entity_type: str, entity_key: str) -> int:
    items = list_visual_evidence(entity_type, entity_key)
    return len([item for item in items if int(item.get("id") or 0) > 0])


def _stamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _ensure_draft(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS env_evidence_draft (
            entity_key TEXT PRIMARY KEY,
            narrative TEXT NOT NULL DEFAULT '',
            fields_json TEXT NOT NULL DEFAULT '{}',
            updated_at TEXT NOT NULL
        )
        """
    )


def _facility(connection) -> dict:
    try:
        row = connection.execute(
            "SELECT building_type, classrooms, labs FROM school_settings WHERE id = 1"
        ).fetchone()
    except Exception:
        row = None
    if not row:
        return {"building_type": "", "classrooms": "", "labs": ""}
    return {
        "building_type": str(row[0] or "").strip(),
        "classrooms": str(row[1] or "").strip(),
        "labs": str(row[2] or "").strip(),
    }


def _facility_clause(facility: dict) -> str:
    parts = []
    building = str(facility.get("building_type") or "").strip()
    rooms = str(facility.get("classrooms") or "").strip()
    labs = str(facility.get("labs") or "").strip()
    if building:
        parts.append("طبيعة المبنى: " + building)
    if rooms:
        parts.append("عدد الفصول: " + rooms)
    if labs:
        parts.append("عدد المعامل: " + labs)
    if not parts:
        return "الفصول الدراسية والمعامل والمرافق المساندة في المبنى الجديد."
    return "الفصول الدراسية والمعامل والمرافق المساندة في المبنى الجديد. " + "، ".join(parts) + "."


def _trial_fields(code: str, facility: dict) -> dict:
    clause = _facility_clause(facility)
    if code == "4-1-1-1":
        return {
            "النطاق المعاين": clause,
            "حالة الجاهزية": "جاهز وفق أعلى معايير التهيئة للمبنى الحديث، وملائم للمرحلة المتوسطة.",
            "الملاحظة الفنية التربوية": (
                "الإضاءة والتهوية واتساع الممرات وتوزيع القاعات تدعم التعلم النشط "
                "وتحفظ سلامة المتعلم وكرامته. لا نواقص جوهرية تمنع التشغيل التربوي الآمن."
            ),
            "الإجراء المعتمد": "اعتماد الجاهزية مع بداية العام، ومتابعة أي ملاحظة تشغيلية طارئة عبر سجل الصيانة.",
        }
    if code == "4-2-1-1":
        return {
            "نطاق التفقد": "مخارج الطوارئ، نقاط التجمع، أجهزة الإنذار والإطفاء، لوحات الإرشاد، ومسارات الإخلاء في الفصول والمعامل والمرافق.",
            "حالة السلامة": "مستوفٍ لمتطلبات الأمن والسلامة في المبنى الحديث، وتجهيزات السلامة في مواقعها وجاهزة للتشغيل.",
            "الملاحظة": "لم تُرصد ملاحظات جوهرية تعيق التشغيل الآمن. يُستمر التفقد الدوري طوال العام وفق الخطة.",
            "المعالجة": "لا معالجة إنشائية عاجلة. تبقى الفرضيات الدورية ومسارات الإخلاء محل متابعة منتظمة.",
        }
    if code == "4-2-1-3":
        return {
            "نطاق المتابعة": "الساحات، دورات المياه، الممرات، الفصول، والمعامل في المبنى الحديث.",
            "حالة النظافة": "المرافق نظيفة ومهيأة للتشغيل التربوي اليومي وفق جدول المتابعة المعتمد.",
            "الملاحظة": "لا ملاحظات جوهرية تمنع استقبال المتعلمين. تُغلق أي ملاحظة طارئة في يوم ظهورها.",
            "الإجراء": "متابعة دورية مع بداية العام، وتوثيق الإغلاق في السجل قبل نهاية اليوم الدراسي.",
        }
    if code == "4-1-1-3":
        return {
            "نطاق الخدمة": "المرافق والخدمات المساندة في المبنى الحديث، بما يراعي احتياجات المتعلمين ومنهم ذوو الإعاقة.",
            "حالة التهيئة": "التنظيم يسهّل الوصول والتنقل الآمن وفق اشتراطات المبنى الجديد.",
            "الملاحظة": "تم التحقق من جاهزية المرافق وفق المعايير المعتمدة.",
            "الإجراء": "إبقاء الوصولية محل متابعة مع وكيل الشؤون المدرسية طوال العام.",
        }
    return {
        "بيان الطلب": "طلب تهيئة وقائية وصيانة استباقية مع عودة الهيئة الإدارية؛ للتأكد من سلامة التشغيل قبل استقبال الطلاب.",
        "نطاق العمل": clause,
        "حالة الإغلاق": "أُغلق الطلب مع بداية العام بعد استكمال الجولة الوقائية، دون رصد أعطال تشغيلية في المبنى الحديث.",
        "ملاحظة الإنجاز": "تُعتمد الصيانة الدورية المجدولة طوال العام، ويُوثَّق أي عطل طارئ فور ظهوره حتى الإغلاق.",
    }


def _trial_narrative(code: str, facility: dict) -> str:
    clause = _facility_clause(facility)
    if code == "4-1-1-1":
        return (
            "أُجريت معاينة شاملة لتهيئة البيئة الصفية قبل استقبال المتعلمين مع بداية العام الدراسي. "
            "المبنى حديث الإنشاء، وتنظيمه يلائم المرحلة المتوسطة. "
            + clause
            + " وتبيّن جاهزية القاعات التعليمية والمعامل والمرافق المساندة للعمل وفق أعلى معايير التهيئة، "
            "بما يدعم التعلم الآمن والنشط دون نواقص جوهرية تمنع التشغيل."
        )
    if code == "4-2-1-1":
        return (
            "نُفّذ أول تفقد للأمن والسلامة مع عودة الهيئة الإدارية، وشمل مخارج الطوارئ ونقاط التجمع "
            "وأجهزة الإنذار والإطفاء ولوحات الإرشاد ومسارات الإخلاء. المبنى حديث ومستوفٍ لمتطلبات السلامة المدرسية، "
            "وتجهيزات السلامة في مواقعها وجاهزة للتشغيل، مع الإبقاء على التفقد الدوري طوال العام."
        )
    if code == "4-2-1-3":
        return (
            "تُوبعت نظافة المبنى ومرافقه مع بداية العام في مدرسة حديثة الإنشاء. الساحات والممرات ودورات المياه "
            "والفصول والمعامل مهيأة للتشغيل التربوي اليومي، وتُغلق الملاحظات في يومها وفق سجل المتابعة."
        )
    if code == "4-1-1-3":
        return (
            "رُوجعت المرافق والخدمات المساندة في المبنى الحديث بما يلائم المرحلة المتوسطة وييسّر وصول المتعلمين، "
            "ومنهم ذوو الإعاقة، وفق الاشتراطات المعتمدة ووفق الاحتياج الفعلي للمبنى."
        )
    return (
        "رُفع طلب تهيئة وقائية وصيانة استباقية مع عودة الهيئة الإدارية، وأُغلق مع بداية العام بعد الجولة الوقائية. "
        + clause
        + " لم تُرصد أعطال تشغيلية في المبنى الحديث، وتُعتمد الصيانة الدورية المجدولة طوال العام."
    )


def _read_draft(connection, entity_key: str) -> dict | None:
    row = connection.execute(
        "SELECT narrative, fields_json FROM env_evidence_draft WHERE entity_key = ?",
        (entity_key,),
    ).fetchone()
    if not row:
        return None
    try:
        fields = json.loads(row[1] or "{}")
    except json.JSONDecodeError:
        fields = {}
    if not isinstance(fields, dict):
        fields = {}
    return {
        "narrative": str(row[0] or ""),
        "fields": {str(key): str(value or "") for key, value in fields.items()},
    }


ENV_KEYS = (
    "env-4-1-1-1",
    "env-4-2-1-1",
    "env-4-2-1-2",
    "env-4-2-1-3",
    "env-4-1-1-3",
)
EQ_KEYS = (
    "eq-2111-1",
    "eq-2111-2",
    "eq-2111-3",
    "eq-2111-4",
    "eq-2111-5",
    "eq-2111-6",
    "eq-2111-7",
    "eq-2111-8",
)
EQ_GROUP = "تكافؤ فرص التعلم · 2-1-1-1"
ROLE_SEAT = {
    "principal": "manager",
    "vice_teachers": "education_agents",
    "vice_students": "student_agents",
    "vice_admin": "school_affairs_agent",
    "student_counselor": "counselors",
    "activity_leader": "activity_leader",
    "safety_supervisor": "safety_supervisor",
    "educational_supervisor": "educational_supervisor",
    "librarian": "librarian",
    "lab_tech": "lab_tech",
}

_SAFETY_MARKS = (
    "أمن",
    "سلامة",
    "جاهزية",
    "صيانة",
    "نظافة",
    "مرافق",
    "جاهزية الفصول",
    "تفقد الأمن",
    "الأمن والسلامة",
    "الصيانة الدورية",
    "صيانة دورية",
    "النظافة",
    "المرافق المساندة",
)
_SAFETY_CODES = {
    "4-1-1-1",
    "4-2-1-1",
    "4-2-1-2",
    "4-2-1-3",
    "4-1-1-3",
}


def _is_safety_register(spec: dict) -> bool:
    if str(spec.get("code") or "") in _SAFETY_CODES:
        return True
    title = str(spec.get("title") or "")
    return any(mark in title for mark in _SAFETY_MARKS)


def _codes_line(codes) -> str:
    if isinstance(codes, str):
        text = codes.strip()
        if text and re.fullmatch(r"[\d\s,،\-–]+", text) and ("،" in text or "," in text):
            compact = re.sub(r"[،,\s]", "", text)
            found = re.findall(r"\d+(?:-\d+){3}", compact)
            return "، ".join(found) if found else text
        return text
    if isinstance(codes, (list, tuple)):
        if codes and all(isinstance(item, str) and len(item) == 1 for item in codes):
            return _codes_line("".join(codes))
        return "، ".join(str(item).strip() for item in codes if str(item).strip())
    return ""


def _key_allowed(key: str) -> bool:
    text = str(key or "").strip()
    if text in ENV_KEYS or text in EQ_KEYS:
        return True
    if text.startswith("program-") and text[8:].isdigit():
        return True
    return False


def _program_date(program: dict, year_start: dict, admin_return: dict, teachers_return: dict, national: dict) -> tuple[dict, str]:
    name = str(program.get("program_name") or "")
    domain = str(program.get("domain") or "")
    register_id = int(program.get("register_id") or 0)
    if "اليوم الوطني" in name:
        return national, "مناسبة اليوم الوطني في التقويم"
    if register_id == 6 or domain == "البيئة المدرسية":
        return admin_return, "عودة الهيئة الإدارية (تهيئة التشغيل)"
    if register_id == 2 or "تطوير مهني" in name:
        return teachers_return, "عودة المعلمين الممارسين للتدريس"
    return year_start, "بداية العام الدراسي"


def _program_owner(connection, program: dict) -> tuple[dict, str]:
    from .program_registry import OWNER_LABELS

    label_to_role = {value: key for key, value in OWNER_LABELS.items()}
    label_to_role["مسؤول الأمن والسلامة"] = "safety_supervisor"
    label_to_role["مسؤول أمن وسلامة"] = "safety_supervisor"
    name = str(program.get("program_name") or "")
    if any(mark in name for mark in _SAFETY_MARKS):
        seated = _staff(connection, _seat_id(connection, "safety_supervisor"))
        if seated.get("id"):
            return seated, OWNER_LABELS.get("safety_supervisor", "مشرف الأمن والسلامة")
    assignee = str(program.get("assignee_staff_id") or "").strip()
    roles = program.get("owner_roles") or []
    role = str((roles[0] if roles else program.get("owner_role")) or "").strip()
    role = ROLE_SEAT.get(role) and role or label_to_role.get(role, role)
    label = str(program.get("owner_label") or "").strip() or OWNER_LABELS.get(role, "")
    seat = ROLE_SEAT.get(role, "")
    if seat:
        seated = _staff(connection, _seat_id(connection, seat))
        if seated.get("id"):
            return seated, label
    if assignee:
        return _staff(connection, assignee), label
    return {"id": "", "name": ""}, label


def _program_trial(program: dict, date: dict) -> tuple[str, dict, list[str]]:
    name = str(program.get("program_name") or "").strip()
    goal = str(program.get("executive_goal") or program.get("strategic_goal") or "").strip()
    audience = str(program.get("target_audience") or "").strip()
    duration = str(program.get("duration") or "").strip()
    mechanism = str(program.get("mechanism") or "").strip()
    success = str(program.get("success_indicator") or "").strip()
    risk = str(program.get("risk_management") or "").strip()
    date_line = str((date or {}).get("line") or "").strip()
    narrative = (
        "يُنفَّذ برنامج «"
        + name
        + "» في عام 1448–1449 بمدرسة حديثة الإنشاء، وفق أعلى معايير التهيئة التربوية. "
        "تاريخ الانطلاق من الخطة: "
        + date_line
        + ". "
    )
    if goal:
        narrative += "الهدف التنفيذي المعتمد: " + goal + " "
    narrative += "تُوثَّق شواهد التنفيذ بعد العمل الميداني وفق الاحتياج الفعلي."
    fields = {
        "نطاق التنفيذ": audience or "المستهدفون وفق البرنامج المعتمد في الخطة.",
        "الفترة المعتمدة": duration or date_line,
        "آلية التنفيذ المعتمدة": mechanism or "تُنفَّذ خطوات البرنامج وفق الخطة التشغيلية المعتمدة.",
        "مؤشر النجاح المعتمد": success or "يُقاس الأثر بعد التنفيذ الموثّق وفق المعايير المعتمدة.",
    }
    order = ["نطاق التنفيذ", "الفترة المعتمدة", "آلية التنفيذ المعتمدة", "مؤشر النجاح المعتمد"]
    if risk:
        fields["إدارة المخاطر"] = risk
        order.append("إدارة المخاطر")
    return narrative, fields, order


def _support_rows(kind: str) -> list[dict]:
    from .students_support_api import approved_name_rows

    return approved_name_rows(kind)


def _apply_draft(connection, entity_key: str, trial_narrative: str, trial_fields: dict) -> tuple[str, dict, bool]:
    fields = dict(trial_fields)
    narrative = trial_narrative
    saved = _read_draft(connection, entity_key)
    if not saved:
        return narrative, fields, False
    if str(saved.get("narrative") or "").strip():
        narrative = str(saved["narrative"])
    for key, value in (saved.get("fields") or {}).items():
        fields[str(key)] = str(value or "")
    return narrative, fields, True


class EnvDraftBody(BaseModel):
    narrative: str = ""
    fields: dict[str, str] = {}
    reset: bool = False


def _templates(year_start: dict, admin_return: dict, facility: dict) -> list[dict]:
    return [
        {
            "code": "4-1-1-1",
            "entity_key": "env-4-1-1-1",
            "title": "سجل جاهزية الفصول والمعامل والمرافق",
            "indicator_text": "تنظيم مبنى المدرسة ملائم لعدد المتعلمين والمرحلة العمرية.",
            "date": year_start,
            "date_label": "تاريخ بداية العام",
            "field_order": [
                "النطاق المعاين",
                "حالة الجاهزية",
                "الملاحظة الفنية التربوية",
                "الإجراء المعتمد",
            ],
        },
        {
            "code": "4-2-1-1",
            "entity_key": "env-4-2-1-1",
            "title": "سجل تفقد الأمن والسلامة",
            "indicator_text": "تتوافر في فصول المدرسة ومعاملها وجميع مرافقها متطلبات الأمن والسلامة.",
            "date": admin_return,
            "date_label": "أول تفقد مع عودة الهيئة الإدارية",
            "field_order": [
                "نطاق التفقد",
                "حالة السلامة",
                "الملاحظة",
                "المعالجة",
            ],
        },
        {
            "code": "4-2-1-2",
            "entity_key": "env-4-2-1-2",
            "title": "سجل الصيانة الدورية",
            "indicator_text": "تعمل المدرسة على صيانة جميع مرافق المبنى وتجهيزاته بانتظام.",
            "date": admin_return,
            "close_date": year_start,
            "date_label": "تاريخ الطلب (عودة الإدارة)",
            "close_label": "تاريخ الإغلاق (بداية العام)",
            "field_order": [
                "بيان الطلب",
                "نطاق العمل",
                "حالة الإغلاق",
                "ملاحظة الإنجاز",
            ],
        },
        {
            "code": "4-2-1-3",
            "entity_key": "env-4-2-1-3",
            "title": "سجل النظافة والبيئة المدرسية",
            "indicator_text": "تعمل المدرسة على نظافة المبنى المدرسي وجميع مرافقه بانتظام.",
            "date": year_start,
            "date_label": "تاريخ بداية العام",
            "field_order": [
                "نطاق المتابعة",
                "حالة النظافة",
                "الملاحظة",
                "الإجراء",
            ],
        },
        {
            "code": "4-1-1-3",
            "entity_key": "env-4-1-1-3",
            "title": "سجل المرافق المساندة ووصولية المتعلمين",
            "indicator_text": "تلبي المرافق والخدمات المساندة احتياجات المتعلمين بمن فيهم ذوو الإعاقة.",
            "date": year_start,
            "date_label": "تاريخ بداية العام",
            "field_order": [
                "نطاق الخدمة",
                "حالة التهيئة",
                "الملاحظة",
                "الإجراء",
            ],
        },
    ]


def _eq_templates(year_start: dict) -> list[dict]:
    return [
        {
            "code": "2-1-1-1",
            "entity_key": "eq-2111-1",
            "title": "فرص ومصادر تعلم متنوعة داخل الحصة",
            "indicator_text": "خبرات التعلم تتيح فرصًا ومصادر متنوعة، وتربط مصادر التعلم وبرامج الدعم والموهبة وفق الاحتياج الفعلي.",
            "date": year_start,
            "date_label": "تاريخ بداية العام",
            "field_order": ["المصادر المتاحة", "مسارات الاستخدام", "الربط بالبرامج", "ملاحظة التوثيق"],
        },
        {
            "code": "2-1-1-1",
            "entity_key": "eq-2111-2",
            "title": "أنشطة تعلم متنوعة تراعي متطلبات المادة",
            "indicator_text": "الخبرات متنوعة وتراعي طبيعة المادة وأهداف الدرس، بما يراعي الفروق الفردية.",
            "date": year_start,
            "date_label": "تاريخ بداية العام",
            "field_order": ["المادة والدرس النموذجي", "تنوع النشاط", "متطلب المادة", "ملاحظة التوثيق"],
        },
        {
            "code": "2-1-1-1",
            "entity_key": "eq-2111-3",
            "title": "فرص متكافئة في الاستخدام بما في ذلك ذوو الإعاقة",
            "indicator_text": "الاستخدام متكافئ للجميع، ويُربط بسجل المرافق المساندة 4-1-1-3 عند الحاجة للوصول المكاني.",
            "date": year_start,
            "date_label": "تاريخ بداية العام",
            "field_order": ["مبدأ التكافؤ", "تهيئة الوصول", "الإجراء داخل الحصة", "ملاحظة التوثيق"],
        },
        {
            "code": "2-1-1-1",
            "entity_key": "eq-2111-4",
            "title": "تصميم يراعي الفروق الفردية (ثلاثة مسارات)",
            "indicator_text": "النشاط الواحد بثلاثة مستويات: إثراء ودعم وتكييف، من برامج الموهبة والدعم والفاقد. مسار الدعم يضم القائمة المعتمدة.",
            "date": year_start,
            "date_label": "تاريخ بداية العام",
            "field_order": ["مسار الإثراء", "مسار الدعم", "مسار التكييف", "ملاحظة التوثيق"],
        },
        {
            "code": "2-1-1-1",
            "entity_key": "eq-2111-5",
            "title": "سهولة الاستخدام داخل الصف",
            "indicator_text": "المصادر والأدوات مألوفة وواضحة التعليمات، بلا تعقيد يحجب المشاركة.",
            "date": year_start,
            "date_label": "تاريخ بداية العام",
            "field_order": ["وضوح التعليمات", "تسلسل الاستخدام", "الدعم داخل الحصة", "ملاحظة التوثيق"],
        },
        {
            "code": "2-1-1-1",
            "entity_key": "eq-2111-6",
            "title": "خبرات تلبي احتياجات الموهوبين",
            "indicator_text": "مسار إثراء مرتبط ببرنامج رعاية الموهوبين والمبتكرين، مع قائمة الموهوبين المعتمدة (الاسم والصف والفصل).",
            "date": year_start,
            "date_label": "تاريخ بداية العام",
            "field_order": ["طبيعة الإثراء", "الربط بالبرنامج", "شكل التوثيق", "ملاحظة التوثيق"],
        },
        {
            "code": "2-1-1-1",
            "entity_key": "eq-2111-7",
            "title": "عينة سجل إنجاز متعلم (مجهّلة)",
            "indicator_text": "ثلاث عينات لمسارات الإثراء والدعم والتكييف، مع حجب الاسم ورقم الهوية، وتُرفق ضمن الشاهد المعتمد.",
            "date": year_start,
            "date_label": "تاريخ بداية العام",
            "field_order": ["عينة المسار أ", "عينة المسار ب", "عينة المسار ج", "ضابط الخصوصية"],
        },
        {
            "code": "2-1-1-1",
            "entity_key": "eq-2111-8",
            "title": "عينة أنشطة صفية (ورقة ثلاث مستويات)",
            "indicator_text": "نشاط واحد بثلاثة مستويات في ورقة الصف، ويُرفق بعد تنفيذ الحصة.",
            "date": year_start,
            "date_label": "تاريخ بداية العام",
            "field_order": ["هدف الدرس", "المستوى الأساسي", "مستوى الدعم", "مستوى الإثراء"],
        },
    ]


def _eq_trial_fields(code: str) -> dict:
    if code == "eq-2111-1":
        return {
            "المصادر المتاحة": "كتاب الطالب، السبورة التفاعلية، مصادر التعلم، ومنصة مدرستي وفق الترخيص المدرسي.",
            "مسارات الاستخدام": "المسار الأساسي للقراءة المشتركة، ومسار إثراء بمصدر إضافي، ومسار تكييف بتعليمات أوضح أو زمن أطول.",
            "الربط بالبرامج": "يُستفاد من برامج مصادر التعلم ورعاية الموهوبين والدعم والفاقد كما هي في الخطة، وفق الاحتياج الفعلي.",
            "ملاحظة التوثيق": "يُوثَّق الشاهد بصورة لزاوية الصف والمصادر، مع مراعاة خصوصية المتعلمين.",
        }
    if code == "eq-2111-2":
        return {
            "المادة والدرس النموذجي": "حصة قراءة تحليلية لنص قصير من المقرر، وهدفها الفهم والاستدلال.",
            "تنوع النشاط": "مناقشة جماعية قصيرة، ثم مهمة فردية، ثم مشاركة ثنائية، ضمن طبيعة المادة.",
            "متطلب المادة": "النشاط يخدم هدف الدرس في الفهم والاستدلال، وليس عرضًا عامًا منفصلًا عن المقرر.",
            "ملاحظة التوثيق": "يُوثَّق الشاهد بصورة لورقة النشاط أو السبورة بعد الشرح، دون إظهار الأسماء.",
        }
    if code == "eq-2111-3":
        return {
            "مبدأ التكافؤ": "كل متعلم يصل إلى المهمة نفسها بهدف الدرس، مع تهيئة الوسيلة لا تغيير الهدف.",
            "تهيئة الوصول": "يُراعى الوصول المكاني وفق سجل المرافق المساندة 4-1-1-3 عند الحاجة، وفق الاحتياج الفعلي.",
            "الإجراء داخل الحصة": "مقعد قريب عند الحاجة، وتعليمات مكتوبة مع الشفهية، وزمن إضافي للمهمة دون إقصاء من المشاركة.",
            "ملاحظة التوثيق": "يُوثَّق الشاهد بصورة لتهيئة المقعد أو الأداة من الخلف، دون تصوير الوجوه أو البيانات.",
        }
    if code == "eq-2111-4":
        return {
            "مسار الإثراء": "مهمة أعمق (سؤال استدلالي أو منتج قصير) لمن أتم الأساس، مرتبطة ببرنامج رعاية الموهوبين.",
            "مسار الدعم": "المهمة نفسها بخطوات مجزأة أو مثال محلول، مرتبطة بحصص الدعم ومعالجة الفاقد. الأسماء المعتمدة في جدول مسار الدعم.",
            "مسار التكييف": "المهمة نفسها بوسيلة أوضح أو تقليل كمية لا تقليل الهدف، مع خصوصية كاملة.",
            "ملاحظة التوثيق": "يُوثَّق الشاهد بصورة للورقة ذات المستويات الثلاثة قبل التوزيع، دون كتابة الأسماء.",
        }
    if code == "eq-2111-5":
        return {
            "وضوح التعليمات": "ثلاث خطوات مكتوبة على السبورة: اقرأ، حدّد، أجب. اللغة مبسطة ومباشرة.",
            "تسلسل الاستخدام": "عرض نموذجي دقيقة واحدة، ثم بدء المتعلمين، ثم جولة المعلم للدعم الفوري.",
            "الدعم داخل الحصة": "بطاقة تعليمات على الطاولة لمن يحتاج إعادة القراءة، دون إخراج من الصف.",
            "ملاحظة التوثيق": "يُوثَّق الشاهد بصورة للتعليمات على السبورة أو البطاقة، دون إظهار المتعلمين.",
        }
    if code == "eq-2111-6":
        return {
            "طبيعة الإثراء": "تحدٍّ مرتبط بهدف الدرس (تحليل أعمق أو منتج إبداعي قصير) لا عملًا منفصلًا عن الحصة.",
            "الربط بالبرنامج": "يُوثَّق ضمن برنامج رعاية الموهوبين والمبتكرين المعتمد.",
            "شكل التوثيق": "ورقة التحدي في الشاهد البصري، والأسماء المعتمدة في جدول الشاهد (الاسم والصف والفصل فقط).",
            "ملاحظة التوثيق": "يُوثَّق الشاهد بصورة لورقة التحدي، مع حجب بيانات الهوية.",
        }
    if code == "eq-2111-7":
        return {
            "عينة المسار أ": "متعلم أ — مسار إثراء: هدف الدرس، المهمة الأعمق، ملاحظة المعلم بلا اسم.",
            "عينة المسار ب": "متعلم ب — مسار دعم: الهدف نفسه، الخطوات المجزأة، ملاحظة التقدّم بلا رقم هوية.",
            "عينة المسار ج": "متعلم ج — مسار تكييف: الهدف نفسه، الوسيلة المكيّفة، بلا تشخيص معلن في الشاهد.",
            "ضابط الخصوصية": "يُحجب الاسم ورقم الهوية والصورة الشخصية. العينة للزيارة لا للعرض العام.",
        }
    return {
        "هدف الدرس": "أن يستخرج المتعلم فكرة رئيسة ودليلًا من النص في حصة القراءة التحليلية.",
        "المستوى الأساسي": "اقرأ النص، حدد الفكرة، اكتب الدليل في جملة.",
        "مستوى الدعم": "اقرأ مع تظليل الجملة المفتاحية، ثم أكمل: الفكرة هي … لأن …",
        "مستوى الإثراء": "اربط الفكرة بموقف جديد في جملة استدلالية، أو اقترح عنوانًا بديلًا مع تبرير.",
    }


def _eq_trial_narrative(code: str) -> str:
    texts = {
        "eq-2111-1": (
            "تُصمَّم خبرة التعلم من اليوم الدراسي الأول على تنوع المصادر لا على مصدر واحد. "
            "يُستخدم كتاب المقرر مع مصدر تعلم مساند ومنصة مدرستي عند الحاجة، ويُوزَّع الاستخدام على ثلاثة مسارات "
            "(أساس، إثراء، تكييف) حتى يتحقق التنوع في الموقف الصفي."
        ),
        "eq-2111-2": (
            "تنوع النشاط يخدم طبيعة المادة لا العرض الشكلي. النموذج المعتمد حصة قراءة تحليلية: مناقشة قصيرة، "
            "مهمة فردية، ثم مشاركة ثنائية، وكلها مربوطة بهدف الفهم والاستدلال في المقرر."
        ),
        "eq-2111-3": (
            "التكافؤ يعني وصول الجميع إلى هدف الدرس. تُهيَّأ الحصة بمقعد مناسب وتعليمات "
            "مزدوجة (شفهية ومكتوبة) وزمن إضافي عند الحاجة. الوصول المكاني يُراجع من سجل المرافق المساندة 4-1-1-3. "
            "يُراعى في الشاهد البصري خصوصية المتعلمين."
        ),
        "eq-2111-4": (
            "الفروق الفردية تُعالَج داخل النشاط الواحد لا بأنشطة منفصلة تُقصي. المسارات الثلاثة: إثراء مرتبط ببرنامج "
            "الموهوبين، ودعم مرتبط بحصص التقوية ومعالجة الفاقد، وتكييف للوسيلة مع بقاء الهدف. "
            "أسماء مسار الدعم المعتمدة تُعرض في الجدول (الاسم والصف والفصل)."
        ),
        "eq-2111-5": (
            "سهولة الاستخدام شرط للتكافؤ: إن تعقّدت الأداة حُجب جزء من الصف. التعليمات ثلاث خطوات ظاهرة، وعرض "
            "نمذجة قصير، ثم جولة دعم. الأدوات المعتمدة: الكتاب، والسبورة، ومصادر التعلم."
        ),
        "eq-2111-6": (
            "الموهبة تُلبَّى بإثراء داخل هدف الدرس لا بفصل الموهوب عن أقرانه في كل حصة. التحدي امتداد للمهمة "
            "الأساسية، ويُربط ببرنامج رعاية الموهوبين والمبتكرين المعتمد. "
            "قائمة الموهوبين المعتمدة تُعرض في الجدول (الاسم والصف والفصل)."
        ),
        "eq-2111-7": (
            "عينة سجل الإنجاز ثلاث أوراق لمسارات الإثراء والدعم والتكييف. "
            "كل عينة تبين الهدف والمهمة وملاحظة المعلم. الاسم ورقم الهوية والصورة الشخصية محجوبة، "
            "وتُرفق العينة ضمن الشاهد المعتمد."
        ),
        "eq-2111-8": (
            "عينة الأنشطة الصفية ورقة واحدة بثلاثة مستويات لهدف الدرس نفسه في القراءة التحليلية. "
            "تُرفق الورقة بعد الحصة الموثّقة، دون كتابة أسماء المتعلمين."
        ),
    }
    return texts.get(code, "")


@router.get("/api/session/env-evidence")
def list_env_evidence(x_session_token: str = Header(default="")):
    """سجلات البيئة وحزمة 2-1-1-1 وبرامج الخطة. التواريخ من التقويم. النصوص معتمدة للطباعة."""
    _require_user(x_session_token)
    from .program_registry import list_programs

    connection = connect()
    try:
        _ensure_draft(connection)
        year_start = _event(connection, "academic")
        admin_return = _event(connection, "admin")
        teachers_return = _event(connection, "teachers")
        national = _event(connection, "national")
        owner = _staff(connection, _seat_id(connection, "school_affairs_agent"))
        education = _staff(connection, _seat_id(connection, "education_agents"))
        manager = _staff(connection, _seat_id(connection, "manager"))
        safety = _staff(connection, _seat_id(connection, "safety_supervisor"))
        affairs = owner
        facility = _facility(connection)
        items = []
        for spec in _templates(year_start, admin_return, facility):
            trial_fields = _trial_fields(spec["code"], facility)
            trial_narrative = _trial_narrative(spec["code"], facility)
            narrative, fields, saved_flag = _apply_draft(
                connection, spec["entity_key"], trial_narrative, trial_fields
            )
            item = dict(spec)
            item["kind"] = "env-register"
            item["group"] = "سجلات البيئة المدرسية"
            item["entity_type"] = "register"
            item["register_key"] = "environment-1448"
            item["year"] = YEAR
            item["domain"] = "البيئة المدرسية"
            if _is_safety_register(spec) and safety.get("id"):
                item["owner_role"] = "مشرف الأمن والسلامة"
                item["owner"] = safety
            elif _is_safety_register(spec):
                item["owner_role"] = "مشرف الأمن والسلامة"
                item["owner"] = {"id": "", "name": ""}
            else:
                item["owner_role"] = "وكيل الشؤون المدرسية"
                item["owner"] = owner
            item["education"] = education
            item["manager"] = manager
            item["affairs"] = affairs
            item["photo_count"] = _photo_count("register", item["entity_key"])
            item["narrative"] = narrative
            item["fields"] = fields
            item["trial_narrative"] = trial_narrative
            item["trial_fields"] = trial_fields
            item["is_saved"] = saved_flag
            item["open"] = True
            items.append(item)
        for spec in _eq_templates(year_start):
            trial_fields = _eq_trial_fields(spec["entity_key"])
            trial_narrative = _eq_trial_narrative(spec["entity_key"])
            narrative, fields, saved_flag = _apply_draft(
                connection, spec["entity_key"], trial_narrative, trial_fields
            )
            item = dict(spec)
            item["kind"] = "eq-register"
            item["group"] = EQ_GROUP
            item["entity_type"] = "register"
            item["register_key"] = "equality-2111-1448"
            item["year"] = YEAR
            item["domain"] = "التعليم والتعلم"
            item["owner_role"] = "وكيل الشؤون التعليمية"
            item["owner"] = education
            item["education"] = education
            item["manager"] = manager
            item["affairs"] = affairs
            item["photo_count"] = _photo_count("register", item["entity_key"])
            item["narrative"] = narrative
            item["fields"] = fields
            item["trial_narrative"] = trial_narrative
            item["trial_fields"] = trial_fields
            item["is_saved"] = saved_flag
            item["open"] = True
            if spec["entity_key"] == "eq-2111-4":
                item["students"] = _support_rows("struggling")
                item["students_title"] = "مسار الدعم — الأسماء المعتمدة"
            elif spec["entity_key"] == "eq-2111-6":
                item["students"] = _support_rows("gifted")
                item["students_title"] = "قائمة الطلاب الموهوبين المعتمدة"
            else:
                item["students"] = []
                item["students_title"] = ""
            items.append(item)
        for program in list_programs():
            program_id = int(program.get("id") or 0)
            name = str(program.get("program_name") or "").strip()
            if program_id < 1 or not name:
                continue
            entity_key = "program-" + str(program_id)
            date, date_label = _program_date(
                program, year_start, admin_return, teachers_return, national
            )
            trial_narrative, trial_fields, field_order = _program_trial(program, date)
            narrative, fields, saved_flag = _apply_draft(
                connection, entity_key, trial_narrative, trial_fields
            )
            person, owner_label = _program_owner(connection, program)
            codes = program.get("indicator_codes") or []
            items.append(
                {
                    "kind": "program",
                    "group": str(program.get("domain") or "").strip() or "برامج الخطة",
                    "code": _codes_line(codes) or "برنامج",
                    "entity_type": "program",
                    "entity_key": entity_key,
                    "register_key": "programs",
                    "title": name,
                    "indicator_text": str(program.get("executive_goal") or "").strip(),
                    "date": date,
                    "date_label": date_label,
                    "field_order": field_order,
                    "year": YEAR,
                    "domain": str(program.get("domain") or "").strip() or "برامج الخطة",
                    "owner_role": owner_label or "صاحب البرنامج",
                    "owner": person,
                    "education": education,
                    "manager": manager,
                    "affairs": affairs,
                    "photo_count": _photo_count("program", entity_key),
                    "narrative": narrative,
                    "fields": fields,
                    "trial_narrative": trial_narrative,
                    "trial_fields": trial_fields,
                    "is_saved": saved_flag,
                    "open": False,
                }
            )
        connection.commit()
    finally:
        connection.close()
    return {"year": YEAR, "items": items}


@router.put("/api/session/env-evidence/{entity_key}")
def save_env_evidence(entity_key: str, body: EnvDraftBody, x_session_token: str = Header(default="")):
    """يحفظ صياغة السجل، أو يعيد النص المعتمد."""
    _require_user(x_session_token)
    key = str(entity_key or "").strip()
    if not _key_allowed(key):
        raise HTTPException(status_code=400, detail="سجل غير معروف")
    connection = connect()
    try:
        _ensure_draft(connection)
        if body.reset:
            connection.execute("DELETE FROM env_evidence_draft WHERE entity_key = ?", (key,))
            connection.commit()
            return {"ok": True, "reset": True, "entity_key": key}
        fields = {str(name).strip(): str(value or "").strip() for name, value in (body.fields or {}).items() if str(name).strip()}
        connection.execute(
            """
            INSERT INTO env_evidence_draft (entity_key, narrative, fields_json, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(entity_key) DO UPDATE SET
                narrative = excluded.narrative,
                fields_json = excluded.fields_json,
                updated_at = excluded.updated_at
            """,
            (key, str(body.narrative or "").strip(), json.dumps(fields, ensure_ascii=False), _stamp()),
        )
        connection.commit()
    finally:
        connection.close()
    return {"ok": True, "reset": False, "entity_key": key}
