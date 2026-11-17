# الخطة السنوية للزيارات الصفية. صف لكل معلم، والزيارة الثالثة عند الحاجة فقط.
# التاريخ يُؤخذ من جدول calendars إن وُجد الأسبوع، وإلا يبقى فارغاً.

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect

router = APIRouter(tags=["visit-plans"])

PLAN_SOURCE = "visit-plan-1448"
SEMESTER_NAMES = {
    "1": ("1", "الأول", "الفصل الأول", "الفصل الدراسي الأول"),
    "2": ("2", "الثاني", "الفصل الثاني", "الفصل الدراسي الثاني"),
}


class PlanRow(BaseModel):
    teacher_id: str
    specialization: str = ""
    subject: str = ""
    visit_1_date: str = ""
    visit_1_period: str = ""
    visit_1_visitor: str = ""
    visit_2_date: str = ""
    visit_2_period: str = ""
    visit_2_visitor: str = ""
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
        """
        SELECT role, national_id FROM leadership_seat
        WHERE role IN ('manager', 'education_agents')
        ORDER BY sort_order
        """
    ).fetchall()
    names = {
        str(row[0]).strip(): str(row[1] or "").strip()
        for row in connection.execute(
            "SELECT national_id, name FROM noor_staff WHERE COALESCE(is_deleted, 0) = 0"
        ).fetchall()
    }
    labels = {"manager": "قائد المدرسة", "education_agents": "وكيل الشؤون التعليمية"}
    found = []
    for role, national_id in seats:
        identity = str(national_id or "").strip()
        if not identity:
            continue
        found.append(
            {
                "id": identity,
                "name": names.get(identity, ""),
                "role": labels.get(str(role), ""),
            }
        )
    return found


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
    return days


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
        raise HTTPException(status_code=400, detail="منفّذ الزيارة قائد المدرسة أو وكيل الشؤون التعليمية")
    return text


def _saved_map(connection) -> dict:
    rows = connection.execute(
        """
        SELECT id, teacher_id, specialization, subject,
               visit_1_date, visit_1_period, visit_1_visitor,
               visit_2_date, visit_2_period, visit_2_visitor,
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
        "visit_2_date": "",
        "visit_2_period": "",
        "visit_2_visitor": "",
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
        "visit_2_date",
        "visit_2_period",
        "visit_2_visitor",
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
                _clean_date(item.visit_2_date),
                str(item.visit_2_period or "").strip()[:8],
                _clean_visitor(item.visit_2_visitor, allowed),
                _clean_date(item.visit_3_date),
                str(item.visit_3_period or "").strip()[:8],
                _clean_visitor(item.visit_3_visitor, allowed),
                str(item.notes or "").strip()[:400],
                moment,
                teacher["teacher_id"],
                PLAN_SOURCE,
            )
            connection.execute(
                """
                INSERT INTO visit_annual_plans (
                    teacher_id, specialization, subject,
                    visit_1_date, visit_1_period, visit_1_visitor,
                    visit_2_date, visit_2_period, visit_2_visitor,
                    visit_3_date, visit_3_period, visit_3_visitor,
                    notes, source, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(teacher_id, source) DO UPDATE SET
                    specialization = excluded.specialization,
                    subject = excluded.subject,
                    visit_1_date = excluded.visit_1_date,
                    visit_1_period = excluded.visit_1_period,
                    visit_1_visitor = excluded.visit_1_visitor,
                    visit_2_date = excluded.visit_2_date,
                    visit_2_period = excluded.visit_2_period,
                    visit_2_visitor = excluded.visit_2_visitor,
                    visit_3_date = excluded.visit_3_date,
                    visit_3_period = excluded.visit_3_period,
                    visit_3_visitor = excluded.visit_3_visitor,
                    notes = excluded.notes,
                    updated_at = excluded.updated_at
                """,
                (
                    teacher["teacher_id"],
                    *values[:12],
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
        saved = _saved_map(connection)
        moment = datetime.now().replace(microsecond=0).isoformat(sep=" ")
        for index, teacher in enumerate(teachers):
            current = _public_row(teacher, saved.get(teacher["teacher_id"]))
            first = _assign_date(current["visit_1_date"], current["visit_2_date"], weeks["1"], index)
            second = _assign_date(current["visit_2_date"], first, weeks["2"], index)
            first_visitor = current["visit_1_visitor"]
            second_visitor = current["visit_2_visitor"]
            if visitors:
                if not first_visitor:
                    first_visitor = visitors[index % len(visitors)]["id"]
                if not second_visitor and len(visitors) > 1:
                    second_visitor = visitors[(index + 1) % len(visitors)]["id"]
                elif not second_visitor:
                    second_visitor = ""
            connection.execute(
                """
                INSERT INTO visit_annual_plans (
                    teacher_id, specialization, subject,
                    visit_1_date, visit_1_period, visit_1_visitor,
                    visit_2_date, visit_2_period, visit_2_visitor,
                    visit_3_date, visit_3_period, visit_3_visitor,
                    notes, source, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(teacher_id, source) DO UPDATE SET
                    specialization = excluded.specialization,
                    subject = excluded.subject,
                    visit_1_date = excluded.visit_1_date,
                    visit_1_period = excluded.visit_1_period,
                    visit_1_visitor = excluded.visit_1_visitor,
                    visit_2_date = excluded.visit_2_date,
                    visit_2_period = excluded.visit_2_period,
                    visit_2_visitor = excluded.visit_2_visitor,
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
                    second,
                    current["visit_2_period"],
                    second_visitor,
                    current["visit_3_date"],
                    current["visit_3_period"],
                    current["visit_3_visitor"],
                    current["notes"],
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
