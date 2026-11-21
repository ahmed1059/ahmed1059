# الخطة السنوية للزيارات الصفية. صف لكل معلم، والزيارة الثالثة عند الحاجة فقط.
# التاريخ يُؤخذ من جدول calendars إن وُجد الأسبوع، وإلا يبقى فارغاً.

from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect

router = APIRouter(tags=["visit-plans"])

PLAN_SOURCE = "visit-plan-1448"
_ROOT = Path(__file__).resolve().parents[1]
_CURRICULUM_PATH = _ROOT / "Print_Canvas" / "data" / "curriculum-map.json"
SEMESTER_NAMES = {
    "1": ("1", "الأول", "الفصل الأول", "الفصل الدراسي الأول"),
    "2": ("2", "الثاني", "الفصل الثاني", "الفصل الدراسي الثاني"),
}
VISITOR_ROLES = ("manager", "education_agents", "student_agents")
VISITOR_LABELS = {
    "manager": "قائد المدرسة",
    "education_agents": "وكيل الشؤون التعليمية",
    "student_agents": "وكيل شؤون الطلاب",
}
LESSON_COLUMNS = (
    "visit_1_unit",
    "visit_1_lesson",
    "visit_1_skill",
    "visit_2_unit",
    "visit_2_lesson",
    "visit_2_skill",
)


class PlanRow(BaseModel):
    teacher_id: str
    specialization: str = ""
    subject: str = ""
    visit_1_date: str = ""
    visit_1_period: str = ""
    visit_1_visitor: str = ""
    visit_1_unit: str = ""
    visit_1_lesson: str = ""
    visit_1_skill: str = ""
    visit_2_date: str = ""
    visit_2_period: str = ""
    visit_2_visitor: str = ""
    visit_2_unit: str = ""
    visit_2_lesson: str = ""
    visit_2_skill: str = ""
    visit_3_date: str = ""
    visit_3_period: str = ""
    visit_3_visitor: str = ""
    notes: str = ""


class PlanSave(BaseModel):
    items: list[PlanRow] = Field(default_factory=list)


def _user(token: str) -> dict:
    from .access import require_user

    try:
        return require_user(str(token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _leadership(token: str) -> dict:
    user = _user(token)
    role = str(user.get("role") or "")
    if role.startswith("مدير") or "وكيل" in role:
        return user
    raise HTTPException(status_code=403, detail="هذه الخطة للمدير والوكيل")


def ensure_visit_plans(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS visit_annual_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id TEXT NOT NULL,
            specialization TEXT,
            subject TEXT,
            visit_1_date TEXT,
            visit_1_period TEXT,
            visit_1_visitor TEXT,
            visit_2_date TEXT,
            visit_2_period TEXT,
            visit_2_visitor TEXT,
            visit_3_date TEXT,
            visit_3_period TEXT,
            visit_3_visitor TEXT,
            notes TEXT,
            source TEXT NOT NULL DEFAULT 'visit-plan-1448',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_visit_annual_plan_teacher
        ON visit_annual_plans (teacher_id, source)
        """
    )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(visit_annual_plans)")}
    for column in LESSON_COLUMNS:
        if column not in columns:
            try:
                connection.execute(
                    f"ALTER TABLE visit_annual_plans ADD COLUMN {column} TEXT NOT NULL DEFAULT ''"
                )
            except sqlite3.OperationalError:
                pass


def _teachers(connection) -> list[dict]:
    rows = connection.execute(
        """
        SELECT national_id, name, COALESCE(specialty, '')
        FROM noor_staff
        WHERE COALESCE(is_deleted, 0) = 0
          AND COALESCE(active, 1) = 1
          AND role LIKE 'معلم%'
        ORDER BY name
        """
    ).fetchall()
    return [
        {
            "teacher_id": str(row[0]).strip(),
            "teacher_name": str(row[1] or "").strip(),
            "specialty": str(row[2] or "").strip(),
        }
        for row in rows
        if str(row[0] or "").strip()
    ]


def _visitors(connection) -> list[dict]:
    seats = connection.execute(
        f"""
        SELECT role, national_id FROM leadership_seat
        WHERE role IN ({",".join("?" * len(VISITOR_ROLES))})
        ORDER BY sort_order
        """,
        VISITOR_ROLES,
    ).fetchall()
    names = {
        str(row[0]).strip(): str(row[1] or "").strip()
        for row in connection.execute(
            "SELECT national_id, name FROM noor_staff WHERE COALESCE(is_deleted, 0) = 0"
        ).fetchall()
    }
    found = []
    for role, national_id in seats:
        identity = str(national_id or "").strip()
        if not identity:
            continue
        found.append(
            {
                "id": identity,
                "name": names.get(identity, ""),
                "role": VISITOR_LABELS.get(str(role), ""),
            }
        )
    return found


def _week_starts_from_calendar_file(semester: str) -> list[str]:
    """احتياطي معتمد: calendar_1448.json (بداية الفصل × عدد الأسابيع) عند فراغ جدول calendars."""
    try:
        payload = json.loads((_ROOT / "Print_Canvas" / "data" / "calendar_1448.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    year = payload.get("1448") if isinstance(payload, dict) else None
    if not isinstance(year, dict):
        return []
    region = year.get("المدينة المنورة") or year.get("مكة المكرمة") or next(iter(year.values()), None)
    if not isinstance(region, dict):
        return []
    block = region.get(str(semester)) if isinstance(region.get(str(semester)), dict) else None
    if not block:
        return []
    start = str(block.get("start") or "").strip()[:10]
    weeks = int(block.get("weeks") or 0)
    if not start or weeks <= 0:
        return []
    try:
        cursor = date.fromisoformat(start)
    except ValueError:
        return []
    from datetime import timedelta

    return [(cursor + timedelta(days=7 * index)).isoformat() for index in range(weeks)]


def _week_starts(connection, semester: str) -> list[str]:
    names = SEMESTER_NAMES[semester]
    rows = connection.execute(
        f"""
        SELECT start_date, COALESCE(region, '')
        FROM calendars
        WHERE semester IN ({",".join("?" * len(names))})
          AND trim(COALESCE(start_date, '')) != ''
        ORDER BY week_number, id
        """,
        names,
    ).fetchall()
    madinah = [row for row in rows if "المدينة" in str(row[1])]
    chosen = madinah or rows
    days = []
    for start, _region in chosen:
        day = str(start or "").strip()[:10]
        if day and day not in days:
            days.append(day)
    if days:
        return days
    return _week_starts_from_calendar_file(semester)


def _clean_date(value: str) -> str:
    text = str(value or "").strip()[:10]
    if not text:
        return ""
    try:
        date.fromisoformat(text)
    except ValueError as error:
        raise HTTPException(status_code=400, detail="التاريخ غير صالح") from error
    return text


def _clean_visitor(value: str, allowed: set[str]) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if text not in allowed:
        raise HTTPException(
            status_code=400,
            detail="منفّذ الزيارة قائد المدرسة أو وكيل الشؤون التعليمية أو وكيل شؤون الطلاب",
        )
    return text


def _parse_dmY(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        try:
            return date.fromisoformat(text[:10]).isoformat()
        except ValueError:
            return ""
    parts = text.replace("-", "/").split("/")
    if len(parts) != 3:
        return ""
    try:
        day, month, year = (int(parts[0]), int(parts[1]), int(parts[2]))
        return date(year, month, day).isoformat()
    except ValueError:
        return ""


def _blocked_ranges(occasions) -> list[tuple[str, str]]:
    ranges: list[tuple[str, str]] = []
    for item in occasions or []:
        if isinstance(item, dict):
            kind = str(item.get("type") or "").strip()
            start_raw = item.get("gregorian_start")
            end_raw = item.get("gregorian_end")
        else:
            kind = str(item[7] if len(item) > 7 else "").strip()
            start_raw = item[5] if len(item) > 5 else ""
            end_raw = item[6] if len(item) > 6 else ""
        if kind not in {"exam", "holiday"}:
            continue
        start = _parse_dmY(str(start_raw or ""))
        if not start:
            continue
        end = _parse_dmY(str(end_raw or "")) or start
        if end < start:
            start, end = end, start
        ranges.append((start, end))
    return ranges


def _date_blocked(day: str, blocked: list[tuple[str, str]]) -> bool:
    text = str(day or "").strip()[:10]
    if not text:
        return False
    for start, end in blocked:
        if start <= text <= end:
            return True
    return False


def _eligible_weeks(weeks: list[str], blocked: list[tuple[str, str]], min_week: int = 5) -> list[str]:
    start_index = max(0, int(min_week) - 1)
    eligible: list[str] = []
    for index, day in enumerate(weeks or []):
        if index < start_index:
            continue
        iso = str(day or "").strip()[:10]
        if not iso:
            continue
        if _date_blocked(iso, blocked):
            continue
        eligible.append(iso)
    return eligible


def _load_curriculum() -> dict:
    try:
        return json.loads(_CURRICULUM_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


_SUBJECT_ALIASES = {
    "أحياء": "العلوم",
    "فيزياء": "العلوم",
    "كيمياء": "العلوم",
    "علوم": "العلوم",
    "إنجليزي": "اللغة الإنجليزية",
    "لغة إنجليزية": "اللغة الإنجليزية",
    "لغتي": "لغتي الخالدة",
    "عربي": "لغتي الخالدة",
    "اجتماعيات": "الدراسات الاجتماعية",
    "حاسوب": "المهارات الرقمية",
    "حاسب": "المهارات الرقمية",
    "رقمية": "المهارات الرقمية",
    "إسلامية": "الدراسات الإسلامية",
    "تربية إسلامية": "الدراسات الإسلامية",
}


def _match_subject_key(specialty: str, subjects: dict) -> str:
    text = str(specialty or "").strip()
    if not text or not subjects:
        return ""
    if text in subjects:
        return text
    alias = _SUBJECT_ALIASES.get(text)
    if alias and alias in subjects:
        return alias
    for alias_key, subject_key in _SUBJECT_ALIASES.items():
        if alias_key in text and subject_key in subjects:
            return subject_key
    for key in subjects:
        key_text = str(key)
        if key_text in text or text in key_text:
            return key_text
    return ""


def _curriculum_slice(specialty: str, week_number: int, curriculum: dict) -> dict:
    subjects = (curriculum or {}).get("subjects") or {}
    subject = _match_subject_key(specialty, subjects)
    if not subject:
        return {}
    grades = subjects.get(subject) or {}
    if not isinstance(grades, dict) or not grades:
        return {}
    grade_key = next(iter(grades.keys()))
    weeks_map = grades.get(grade_key) or {}
    if not isinstance(weeks_map, dict):
        return {}
    entry = weeks_map.get(str(week_number)) or {}
    if not isinstance(entry, dict):
        return {}
    return {
        "subject": subject,
        "grade": str(grade_key),
        "unit": str(entry.get("unit") or "").strip(),
        "lesson": str(entry.get("lesson") or "").strip(),
        "skill": str(entry.get("skill") or "").strip(),
    }


def _curriculum_note(label: str, payload: dict) -> str:
    parts = []
    unit = str((payload or {}).get("unit") or "").strip()
    lesson = str((payload or {}).get("lesson") or "").strip()
    skill = str((payload or {}).get("skill") or "").strip()
    if unit:
        parts.append(f"الوحدة: {unit}")
    if lesson:
        parts.append(f"الدرس: {lesson}")
    if skill:
        parts.append(f"المهارة: {skill}")
    if not parts:
        return ""
    return f"{label} — " + " — ".join(parts)


def _week_number_of(day: str, weeks: list[str]) -> int:
    iso = str(day or "").strip()[:10]
    if not iso:
        return 0
    try:
        return weeks.index(iso) + 1
    except ValueError:
        return 0


def _occasion_rows(connection) -> list[dict]:
    try:
        from .planning_session_api import _ensure as ensure_planning

        ensure_planning(connection)
    except Exception:
        pass
    try:
        rows = connection.execute(
            """
            SELECT gregorian_start, gregorian_end, type
            FROM school_occasions
            WHERE type IN ('exam', 'holiday')
            """
        ).fetchall()
    except sqlite3.Error:
        rows = []
    if rows:
        return [
            {
                "gregorian_start": row[0],
                "gregorian_end": row[1],
                "type": row[2],
            }
            for row in rows
        ]
    from .planning_seeds import SCHOOL_OCCASIONS

    return [
        {
            "gregorian_start": seed[5],
            "gregorian_end": seed[6],
            "type": seed[7],
        }
        for seed in SCHOOL_OCCASIONS
        if str(seed[7]) in {"exam", "holiday"}
    ]


def _pick_visitor(visitors: list[dict], index: int, avoid: str = "") -> str:
    if not visitors:
        return ""
    for offset in range(len(visitors)):
        candidate = visitors[(index + offset) % len(visitors)]["id"]
        if avoid and candidate == avoid and len(visitors) > 1:
            continue
        return candidate
    return visitors[index % len(visitors)]["id"]


def _saved_map(connection) -> dict:
    rows = connection.execute(
        """
        SELECT id, teacher_id, specialization, subject,
               visit_1_date, visit_1_period, visit_1_visitor,
               COALESCE(visit_1_unit, ''), COALESCE(visit_1_lesson, ''), COALESCE(visit_1_skill, ''),
               visit_2_date, visit_2_period, visit_2_visitor,
               COALESCE(visit_2_unit, ''), COALESCE(visit_2_lesson, ''), COALESCE(visit_2_skill, ''),
               visit_3_date, visit_3_period, visit_3_visitor,
               notes
        FROM visit_annual_plans
        WHERE source = ?
        """,
        (PLAN_SOURCE,),
    ).fetchall()
    return {str(row[1]): row for row in rows}


def _public_row(teacher: dict, saved) -> dict:
    row = {
        "id": 0,
        "teacher_id": teacher["teacher_id"],
        "teacher_name": teacher["teacher_name"],
        "specialization": teacher["specialty"],
        "subject": teacher["specialty"],
        "visit_1_date": "",
        "visit_1_period": "",
        "visit_1_visitor": "",
        "visit_1_unit": "",
        "visit_1_lesson": "",
        "visit_1_skill": "",
        "visit_2_date": "",
        "visit_2_period": "",
        "visit_2_visitor": "",
        "visit_2_unit": "",
        "visit_2_lesson": "",
        "visit_2_skill": "",
        "visit_3_date": "",
        "visit_3_period": "",
        "visit_3_visitor": "",
        "notes": "",
    }
    if not saved:
        return row
    row["id"] = saved[0]
    row["specialization"] = saved[2] or teacher["specialty"]
    row["subject"] = saved[3] or teacher["specialty"]
    keys = (
        "visit_1_date",
        "visit_1_period",
        "visit_1_visitor",
        "visit_1_unit",
        "visit_1_lesson",
        "visit_1_skill",
        "visit_2_date",
        "visit_2_period",
        "visit_2_visitor",
        "visit_2_unit",
        "visit_2_lesson",
        "visit_2_skill",
        "visit_3_date",
        "visit_3_period",
        "visit_3_visitor",
        "notes",
    )
    for offset, key in enumerate(keys, start=4):
        row[key] = saved[offset] or ""
    return row


def _pack(connection) -> dict:
    teachers = _teachers(connection)
    saved = _saved_map(connection)
    weeks = {"1": _week_starts(connection, "1"), "2": _week_starts(connection, "2")}
    return {
        "items": [_public_row(teacher, saved.get(teacher["teacher_id"])) for teacher in teachers],
        "visitors": _visitors(connection),
        "weeks": {"1": len(weeks["1"]), "2": len(weeks["2"])},
    }


def _assign_date(current: str, other: str, weeks: list[str], index: int) -> str:
    if current or not weeks:
        return current
    candidate = weeks[index % len(weeks)]
    if other and candidate == other:
        return ""
    return candidate


@router.get("/api/session/visit-plans")
def list_plans(x_session_token: str = Header(default="")):
    _leadership(x_session_token)
    connection = connect()
    try:
        ensure_visit_plans(connection)
        connection.commit()
        return _pack(connection)
    finally:
        connection.close()


@router.post("/api/session/visit-plans")
def save_plans(body: PlanSave, x_session_token: str = Header(default="")):
    _leadership(x_session_token)
    connection = connect()
    try:
        ensure_visit_plans(connection)
        teachers = {item["teacher_id"]: item for item in _teachers(connection)}
        allowed = {item["id"] for item in _visitors(connection)}
        moment = datetime.now().replace(microsecond=0).isoformat(sep=" ")
        saved = 0
        for item in body.items:
            teacher = teachers.get(str(item.teacher_id or "").strip())
            if not teacher:
                continue
            values = (
                str(item.specialization or "").strip()[:80] or teacher["specialty"],
                str(item.subject or "").strip()[:80] or teacher["specialty"],
                _clean_date(item.visit_1_date),
                str(item.visit_1_period or "").strip()[:8],
                _clean_visitor(item.visit_1_visitor, allowed),
                str(item.visit_1_unit or "").strip()[:120],
                str(item.visit_1_lesson or "").strip()[:200],
                str(item.visit_1_skill or "").strip()[:200],
                _clean_date(item.visit_2_date),
                str(item.visit_2_period or "").strip()[:8],
                _clean_visitor(item.visit_2_visitor, allowed),
                str(item.visit_2_unit or "").strip()[:120],
                str(item.visit_2_lesson or "").strip()[:200],
                str(item.visit_2_skill or "").strip()[:200],
                _clean_date(item.visit_3_date),
                str(item.visit_3_period or "").strip()[:8],
                _clean_visitor(item.visit_3_visitor, allowed),
                str(item.notes or "").strip()[:400],
            )
            connection.execute(
                """
                INSERT INTO visit_annual_plans (
                    teacher_id, specialization, subject,
                    visit_1_date, visit_1_period, visit_1_visitor,
                    visit_1_unit, visit_1_lesson, visit_1_skill,
                    visit_2_date, visit_2_period, visit_2_visitor,
                    visit_2_unit, visit_2_lesson, visit_2_skill,
                    visit_3_date, visit_3_period, visit_3_visitor,
                    notes, source, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(teacher_id, source) DO UPDATE SET
                    specialization = excluded.specialization,
                    subject = excluded.subject,
                    visit_1_date = excluded.visit_1_date,
                    visit_1_period = excluded.visit_1_period,
                    visit_1_visitor = excluded.visit_1_visitor,
                    visit_1_unit = excluded.visit_1_unit,
                    visit_1_lesson = excluded.visit_1_lesson,
                    visit_1_skill = excluded.visit_1_skill,
                    visit_2_date = excluded.visit_2_date,
                    visit_2_period = excluded.visit_2_period,
                    visit_2_visitor = excluded.visit_2_visitor,
                    visit_2_unit = excluded.visit_2_unit,
                    visit_2_lesson = excluded.visit_2_lesson,
                    visit_2_skill = excluded.visit_2_skill,
                    visit_3_date = excluded.visit_3_date,
                    visit_3_period = excluded.visit_3_period,
                    visit_3_visitor = excluded.visit_3_visitor,
                    notes = excluded.notes,
                    updated_at = excluded.updated_at
                """,
                (
                    teacher["teacher_id"],
                    *values,
                    PLAN_SOURCE,
                    moment,
                    moment,
                ),
            )
            saved += 1
        connection.commit()
        return {"ok": True, "saved": saved}
    finally:
        connection.close()


@router.post("/api/session/visit-plans/distribute")
def distribute_plans(x_session_token: str = Header(default="")):
    _leadership(x_session_token)
    connection = connect()
    try:
        ensure_visit_plans(connection)
        teachers = _teachers(connection)
        visitors = _visitors(connection)
        weeks = {"1": _week_starts(connection, "1"), "2": _week_starts(connection, "2")}
        blocked = _blocked_ranges(_occasion_rows(connection))
        eligible = {
            "1": _eligible_weeks(weeks["1"], blocked, min_week=5),
            "2": _eligible_weeks(weeks["2"], blocked, min_week=5),
        }
        curriculum = _load_curriculum()
        saved = _saved_map(connection)
        moment = datetime.now().replace(microsecond=0).isoformat(sep=" ")
        for index, teacher in enumerate(teachers):
            current = _public_row(teacher, saved.get(teacher["teacher_id"]))
            first = _assign_date(
                current["visit_1_date"], current["visit_2_date"], eligible["1"], index
            )
            second = _assign_date(current["visit_2_date"], first, eligible["2"], index)
            first_visitor = current["visit_1_visitor"]
            second_visitor = current["visit_2_visitor"]
            if visitors:
                if not first_visitor:
                    first_visitor = _pick_visitor(visitors, index, avoid=second_visitor)
                if not second_visitor:
                    second_visitor = _pick_visitor(visitors, index + 1, avoid=first_visitor)
                    if second_visitor == first_visitor and len(visitors) < 2:
                        second_visitor = ""
            first_unit = current["visit_1_unit"]
            first_lesson = current["visit_1_lesson"]
            first_skill = current["visit_1_skill"]
            second_unit = current["visit_2_unit"]
            second_lesson = current["visit_2_lesson"]
            second_skill = current["visit_2_skill"]
            note_lines = []
            week_one = _week_number_of(first, weeks["1"])
            if week_one and (not first_lesson or not first_skill or not first_unit):
                slice_one = _curriculum_slice(teacher["specialty"], week_one, curriculum)
                if slice_one:
                    if not first_unit:
                        first_unit = slice_one.get("unit", "")
                    if not first_lesson:
                        first_lesson = slice_one.get("lesson", "")
                    if not first_skill:
                        first_skill = slice_one.get("skill", "")
                    note_lines.append(_curriculum_note("الزيارة الأولى", slice_one))
            week_two = _week_number_of(second, weeks["2"])
            if week_two and (not second_lesson or not second_skill or not second_unit):
                slice_two = _curriculum_slice(teacher["specialty"], week_two, curriculum)
                if slice_two:
                    if not second_unit:
                        second_unit = slice_two.get("unit", "")
                    if not second_lesson:
                        second_lesson = slice_two.get("lesson", "")
                    if not second_skill:
                        second_skill = slice_two.get("skill", "")
                    note_lines.append(_curriculum_note("الزيارة الثانية", slice_two))
            notes = (" | ".join(line for line in note_lines if line) or current["notes"])[:400]
            connection.execute(
                """
                INSERT INTO visit_annual_plans (
                    teacher_id, specialization, subject,
                    visit_1_date, visit_1_period, visit_1_visitor,
                    visit_1_unit, visit_1_lesson, visit_1_skill,
                    visit_2_date, visit_2_period, visit_2_visitor,
                    visit_2_unit, visit_2_lesson, visit_2_skill,
                    visit_3_date, visit_3_period, visit_3_visitor,
                    notes, source, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(teacher_id, source) DO UPDATE SET
                    specialization = excluded.specialization,
                    subject = excluded.subject,
                    visit_1_date = excluded.visit_1_date,
                    visit_1_period = excluded.visit_1_period,
                    visit_1_visitor = excluded.visit_1_visitor,
                    visit_1_unit = excluded.visit_1_unit,
                    visit_1_lesson = excluded.visit_1_lesson,
                    visit_1_skill = excluded.visit_1_skill,
                    visit_2_date = excluded.visit_2_date,
                    visit_2_period = excluded.visit_2_period,
                    visit_2_visitor = excluded.visit_2_visitor,
                    visit_2_unit = excluded.visit_2_unit,
                    visit_2_lesson = excluded.visit_2_lesson,
                    visit_2_skill = excluded.visit_2_skill,
                    visit_3_date = excluded.visit_3_date,
                    visit_3_period = excluded.visit_3_period,
                    visit_3_visitor = excluded.visit_3_visitor,
                    notes = excluded.notes,
                    updated_at = excluded.updated_at
                """,
                (
                    teacher["teacher_id"],
                    teacher["specialty"],
                    teacher["specialty"],
                    first,
                    current["visit_1_period"],
                    first_visitor,
                    first_unit,
                    first_lesson,
                    first_skill,
                    second,
                    current["visit_2_period"],
                    second_visitor,
                    second_unit,
                    second_lesson,
                    second_skill,
                    current["visit_3_date"],
                    current["visit_3_period"],
                    current["visit_3_visitor"],
                    notes,
                    PLAN_SOURCE,
                    moment,
                    moment,
                ),
            )
        connection.commit()
        pack = _pack(connection)
        pack["ok"] = True
        return pack
    finally:
        connection.close()
