# زيارة المدير والوكيل للمعلمين. البنود من استمارة الزيارة المعتمدة.
# الدرجة تُحسب من المستوى. العبارة تُحفظ كما عدّلها صاحب الصلاحية.

from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect

router = APIRouter(tags=["classroom-visits"])

CRITERIA = (
    {"id": "planning", "label": "التخطيط للدرس ووضوح الأهداف", "weight": 10},
    {"id": "warmup", "label": "التهيئة وربط التعلم بالخبرة السابقة", "weight": 10},
    {"id": "strategies", "label": "استراتيجيات التدريس وتنويعها", "weight": 15},
    {"id": "content", "label": "دقة المحتوى العلمي والمهاري", "weight": 10},
    {"id": "differences", "label": "مراعاة الفروق الفردية", "weight": 15},
    {"id": "environment", "label": "بيئة التعلم وإدارة الصف", "weight": 10},
    {"id": "assessment", "label": "التقويم البنائي والختامي", "weight": 20},
    {"id": "closure", "label": "التغذية الراجعة وإغلاق الدرس", "weight": 10},
)
LEVELS = {"none": 0.0, "partial": 0.5, "met": 0.75, "high": 1.0}
PHRASES = {
    "planning": {
        "high": "الأهداف واضحة ومتسلسلة، والتخطيط يغطي التمهيد والعرض والتقويم.",
        "met": "التخطيط مكتمل والأهداف ظاهرة، مع مجال محدود للتحسين.",
        "partial": "التخطيط موجود، وبعض عناصر الهدف أو التسلسل تحتاج إحكاماً.",
        "none": "التخطيط للدرس غير ظاهر في هذه الزيارة.",
    },
    "warmup": {
        "high": "التهيئة ربطت الدرس بالخبرة السابقة، وشارك المتعلمون فيها.",
        "met": "التهيئة موجودة وترتبط بالدرس، ومشاركة المتعلمين محدودة.",
        "partial": "التهيئة مختصرة، والربط بالخبرة السابقة غير مكتمل.",
        "none": "لم تظهر تهيئة تربط الدرس بالخبرة السابقة.",
    },
    "strategies": {
        "high": "استراتيجيات التدريس متنوعة ومناسبة للهدف، ومشاركة المتعلمين ظاهرة.",
        "met": "الاستراتيجية مناسبة للهدف، والتنويع محدود.",
        "partial": "استراتيجية واحدة غالبة، ومشاركة المتعلمين ضعيفة.",
        "none": "لم تظهر استراتيجية تدريس واضحة.",
    },
    "content": {
        "high": "المحتوى العلمي دقيق، والأمثلة تخدم المهارة المستهدفة.",
        "met": "المحتوى صحيح في جملته، وبعض الأمثلة تحتاج تدقيقاً.",
        "partial": "في المحتوى هنات علمية أو مهارية تحتاج تصحيحاً.",
        "none": "دقة المحتوى غير متحققة في هذه الزيارة.",
    },
    "differences": {
        "high": "الفروق الفردية مرعية بأنشطة متدرجة ومساندة.",
        "met": "توجد مساندة لبعض المتعلمين، والتدرج غير كامل.",
        "partial": "النشاط واحد للجميع، والمساندة محدودة.",
        "none": "لم تُراعَ الفروق الفردية في هذه الزيارة.",
    },
    "environment": {
        "high": "الصف منظم، وبيئة التعلم آمنة ومهيأة.",
        "met": "الصف منضبط في جملته، والتنظيم يحتاج تثبيتاً.",
        "partial": "يظهر تشتت متكرر، وبيئة التعلم غير مستقرة.",
        "none": "إدارة الصف غير متحققة في هذه الزيارة.",
    },
    "assessment": {
        "high": "التقويم البنائي والختامي منفذ، وشواهد تحقق الهدف ظاهرة.",
        "met": "التقويم موجود، وشواهد التحقق غير مكتملة.",
        "partial": "سؤال ختامي فقط، بلا تقويم بنائي ظاهر.",
        "none": "لم يُنفَّذ تقويم بنائي أو ختامي.",
    },
    "closure": {
        "high": "التغذية الراجعة فورية، وإغلاق الدرس يربط الهدف بما تحقق.",
        "met": "أُغلق الدرس بتلخيص، والتغذية الراجعة مختصرة.",
        "partial": "الإغلاق سريع، والتغذية الراجعة غير موجهة.",
        "none": "لم يُغلق الدرس ولم تظهر تغذية راجعة.",
    },
}
VISIT_TYPES = ("استطلاعية", "تقويمية", "متابعة", "تبادلية")
INDICATORS = (
    "2-1 بناء خبرات التعلم",
    "2-2 تقويم التعلم",
)
RANKS = ("معلم", "معلم ممارس", "معلم متقدم", "معلم خبير")
FULL_RECOMMENDATIONS = "الممارسات متحققة في التخطيط والتهيئة والتنفيذ والتقويم. يُوثَّق شاهد من الحصة في ملف المعلم."
FULL_IMPROVEMENT = "تُثبَّت هذه الممارسات في الزيارة التالية، مع نشاط قصير يساند المتعلم الذي يحتاج وقتاً أطول."


class CriterionIn(BaseModel):
    id: str = ""
    level: str = ""
    phrase: str = ""


class VisitBody(BaseModel):
    teacher_id: str = ""
    visitor_id: str = ""
    visit_type: str = ""
    indicator: str = ""
    grade: str = ""
    section_no: str = ""
    subject: str = ""
    period_no: str = ""
    week: str = ""
    unit: str = ""
    lesson: str = ""
    skill: str = ""
    teacher_rank: str = ""
    visit_date: str = ""
    visit_date_hijri: str = ""
    recommendations: str = ""
    improvement: str = ""
    visit_intro: str = ""
    strengths: str = ""
    follow_hijri: str = ""
    follow_gregorian: str = ""
    criteria: list[CriterionIn] = Field(default_factory=list)


class GenerateBody(BaseModel):
    visitor_id: str = ""
    visit_type: str = ""
    indicator: str = ""
    visit_date: str = ""
    visit_date_hijri: str = ""


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
    raise HTTPException(status_code=403, detail="هذا النموذج للمدير والوكيل")


def ensure_classroom_visits(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS classroom_visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id TEXT NOT NULL,
            teacher_name TEXT NOT NULL,
            visitor_id TEXT NOT NULL,
            visitor_name TEXT NOT NULL,
            visitor_role TEXT NOT NULL DEFAULT '',
            visit_type TEXT NOT NULL DEFAULT '',
            indicator TEXT NOT NULL DEFAULT '',
            grade TEXT NOT NULL DEFAULT '',
            section_no TEXT NOT NULL DEFAULT '',
            subject TEXT NOT NULL DEFAULT '',
            period_no TEXT NOT NULL DEFAULT '',
            lesson TEXT NOT NULL DEFAULT '',
            visit_date TEXT NOT NULL DEFAULT '',
            visit_date_hijri TEXT NOT NULL DEFAULT '',
            recommendations TEXT NOT NULL DEFAULT '',
            improvement TEXT NOT NULL DEFAULT '',
            follow_hijri TEXT NOT NULL DEFAULT '',
            follow_gregorian TEXT NOT NULL DEFAULT '',
            criteria_json TEXT NOT NULL,
            total REAL NOT NULL DEFAULT 0,
            band TEXT NOT NULL DEFAULT '',
            source TEXT NOT NULL DEFAULT 'manual',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(classroom_visits)")}
    if "teacher_rank" not in columns:
        connection.execute(
            "ALTER TABLE classroom_visits ADD COLUMN teacher_rank TEXT NOT NULL DEFAULT ''"
        )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(classroom_visits)")}
    if "visit_intro" not in columns:
        connection.execute(
            "ALTER TABLE classroom_visits ADD COLUMN visit_intro TEXT NOT NULL DEFAULT ''"
        )
    if "strengths" not in columns:
        connection.execute(
            "ALTER TABLE classroom_visits ADD COLUMN strengths TEXT NOT NULL DEFAULT ''"
        )
    for column in ("week", "unit", "skill"):
        columns = {row[1] for row in connection.execute("PRAGMA table_info(classroom_visits)")}
        if column not in columns:
            connection.execute(
                f"ALTER TABLE classroom_visits ADD COLUMN {column} TEXT NOT NULL DEFAULT ''"
            )


def _band(total: float) -> str:
    if total >= 90:
        return "ممتاز"
    if total >= 75:
        return "متقدم"
    if total >= 60:
        return "متمكن"
    return "بحاجة إلى دعم"


def _score(criteria: list[dict]) -> tuple[list[dict], float, str]:
    by_id = {str(item.get("id") or ""): item for item in criteria}
    rows = []
    total = 0.0
    for spec in CRITERIA:
        incoming = by_id.get(spec["id"]) or {}
        level = str(incoming.get("level") or "")
        if level not in LEVELS:
            level = ""
        ratio = LEVELS.get(level, 0.0)
        points = round(ratio * spec["weight"], 2)
        total += points
        phrase = str(incoming.get("phrase") or "").strip()
        if not phrase and level in PHRASES[spec["id"]]:
            phrase = PHRASES[spec["id"]][level]
        rows.append({
            "id": spec["id"],
            "label": spec["label"],
            "weight": spec["weight"],
            "level": level,
            "phrase": phrase,
            "points": points,
        })
    total = round(total, 2)
    return rows, total, _band(total) if any(row["level"] for row in rows) else ""


def _staff_map(connection) -> dict:
    rows = connection.execute(
        """
        SELECT national_id, name, role, COALESCE(specialty, ''), COALESCE(active, 1)
        FROM noor_staff
        WHERE COALESCE(is_deleted, 0) = 0
        """
    ).fetchall()
    return {
        str(row[0]).strip(): {
            "name": str(row[1] or "").strip(),
            "role": str(row[2] or "").strip(),
            "specialty": str(row[3] or "").strip(),
            "active": bool(row[4]),
        }
        for row in rows
        if str(row[0] or "").strip()
    }


def _visitor_ids(connection) -> dict:
    rows = connection.execute(
        "SELECT role, national_id FROM leadership_seat ORDER BY sort_order"
    ).fetchall()
    allowed = {}
    for role, national_id in rows:
        identity = str(national_id or "").strip()
        seat = str(role or "").strip()
        if identity and seat in {"manager", "education_agents", "student_agents"}:
            allowed.setdefault(identity, seat)
    return allowed


def _seat_label(seat: str) -> str:
    if seat == "manager":
        return "مدير المدرسة"
    if seat == "education_agents":
        return "وكيل الشؤون التعليمية"
    if seat == "student_agents":
        return "وكيل شؤون الطلاب"
    return ""


def _clean_choice(value: str, options: tuple[str, ...]) -> str:
    text = str(value or "").strip()
    return text if text in options else ""


def _row_out(row) -> dict:
    try:
        criteria = json.loads(row[16] or "[]")
    except json.JSONDecodeError:
        criteria = []
    return {
        "id": row[0],
        "teacher_id": row[1] or "",
        "teacher_name": row[2] or "",
        "visitor_id": row[3] or "",
        "visitor_name": row[4] or "",
        "visitor_role": row[5] or "",
        "visit_type": row[6] or "",
        "indicator": row[7] or "",
        "grade": row[8] or "",
        "section_no": row[9] or "",
        "subject": row[10] or "",
        "period_no": row[11] or "",
        "lesson": row[12] or "",
        "visit_date": row[13] or "",
        "visit_date_hijri": row[14] or "",
        "recommendations": row[15] or "",
        "criteria": criteria if isinstance(criteria, list) else [],
        "improvement": row[17] or "",
        "follow_hijri": row[18] or "",
        "follow_gregorian": row[19] or "",
        "total": row[20],
        "band": row[21] or "",
        "source": row[22] or "",
        "teacher_rank": row[23] or "" if len(row) > 23 else "",
        "visit_intro": row[24] or "" if len(row) > 24 else "",
        "strengths": row[25] or "" if len(row) > 25 else "",
        "week": row[26] or "" if len(row) > 26 else "",
        "unit": row[27] or "" if len(row) > 27 else "",
        "skill": row[28] or "" if len(row) > 28 else "",
    }


_SELECT = """
    SELECT id, teacher_id, teacher_name, visitor_id, visitor_name, visitor_role,
           visit_type, indicator, grade, section_no, subject, period_no, lesson,
           visit_date, visit_date_hijri, recommendations, criteria_json,
           improvement, follow_hijri, follow_gregorian, total, band, source,
           COALESCE(teacher_rank, ''), COALESCE(visit_intro, ''), COALESCE(strengths, ''),
           COALESCE(week, ''), COALESCE(unit, ''), COALESCE(skill, '')
    FROM classroom_visits
"""


def _prepare(connection, body: VisitBody, user: dict) -> dict:
    staff = _staff_map(connection)
    teacher_id = str(body.teacher_id or "").strip()
    teacher = staff.get(teacher_id)
    if not teacher or not str(teacher["role"]).startswith("معلم"):
        raise HTTPException(status_code=400, detail="اختر معلماً من السجل")
    visitor_id = str(body.visitor_id or "").strip()
    seats = _visitor_ids(connection)
    if visitor_id not in seats and visitor_id != str(user.get("id") or ""):
        raise HTTPException(status_code=400, detail="الزائر من المدير أو الوكيل")
    visitor = staff.get(visitor_id)
    if not visitor:
        raise HTTPException(status_code=400, detail="الزائر غير موجود في السجل")
    rows, total, band = _score([item.model_dump() for item in body.criteria])
    return {
        "teacher_id": teacher_id,
        "teacher_name": teacher["name"],
        "visitor_id": visitor_id,
        "visitor_name": visitor["name"],
        "visitor_role": _seat_label(seats.get(visitor_id, "")) or visitor["role"],
        "visit_type": _clean_choice(body.visit_type, VISIT_TYPES),
        "indicator": _clean_choice(body.indicator, INDICATORS),
        "grade": str(body.grade or "").strip()[:40],
        "section_no": str(body.section_no or "").strip()[:8],
        "subject": str(body.subject or "").strip()[:80] or teacher["specialty"],
        "teacher_rank": _clean_choice(body.teacher_rank, RANKS),
        "period_no": str(body.period_no or "").strip()[:8],
        "week": str(body.week or "").strip()[:8],
        "unit": str(body.unit or "").strip()[:160],
        "lesson": str(body.lesson or "").strip()[:200],
        "skill": str(body.skill or "").strip()[:200],
        "visit_date": str(body.visit_date or "").strip()[:10],
        "visit_date_hijri": str(body.visit_date_hijri or "").strip()[:80],
        "recommendations": str(body.recommendations or "").strip()[:2000],
        "improvement": str(body.improvement or "").strip()[:2000],
        "visit_intro": str(body.visit_intro or "").strip()[:400],
        "strengths": str(body.strengths or "").strip()[:2000],
        "follow_hijri": str(body.follow_hijri or "").strip()[:80],
        "follow_gregorian": str(body.follow_gregorian or "").strip()[:10],
        "criteria": rows,
        "total": total,
        "band": band,
    }


@router.get("/api/session/classroom-visits")
def list_visits(x_session_token: str = Header(default="")):
    _leadership(x_session_token)
    connection = connect()
    try:
        ensure_classroom_visits(connection)
        _repair_generated(connection)
        connection.commit()
        rows = connection.execute(_SELECT + " ORDER BY updated_at DESC, id DESC").fetchall()
        return {
            "items": [_row_out(row) for row in rows],
            "criteria": list(CRITERIA),
            "phrases": PHRASES,
            "visit_types": list(VISIT_TYPES),
            "indicators": list(INDICATORS),
            "ranks": list(RANKS),
        }
    finally:
        connection.close()


@router.post("/api/session/classroom-visits")
def create_visit(body: VisitBody, x_session_token: str = Header(default="")):
    user = _leadership(x_session_token)
    connection = connect()
    try:
        ensure_classroom_visits(connection)
        prepared = _prepare(connection, body, user)
        moment = datetime.now().replace(microsecond=0).isoformat(sep=" ")
        connection.execute(
            """
            INSERT INTO classroom_visits (
                teacher_id, teacher_name, visitor_id, visitor_name, visitor_role,
                visit_type, indicator, grade, section_no, subject, period_no, lesson,
                visit_date, visit_date_hijri, recommendations, improvement,
                follow_hijri, follow_gregorian, criteria_json, total, band, source,
                teacher_rank, visit_intro, strengths, week, unit, skill,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                prepared["teacher_id"], prepared["teacher_name"], prepared["visitor_id"],
                prepared["visitor_name"], prepared["visitor_role"], prepared["visit_type"],
                prepared["indicator"], prepared["grade"], prepared["section_no"],
                prepared["subject"], prepared["period_no"], prepared["lesson"],
                prepared["visit_date"], prepared["visit_date_hijri"],
                prepared["recommendations"], prepared["improvement"],
                prepared["follow_hijri"], prepared["follow_gregorian"],
                json.dumps(prepared["criteria"], ensure_ascii=False),
                prepared["total"], prepared["band"], prepared["teacher_rank"],
                prepared["visit_intro"], prepared["strengths"],
                prepared["week"], prepared["unit"], prepared["skill"],
                moment, moment,
            ),
        )
        connection.commit()
        return {"ok": True, "total": prepared["total"], "band": prepared["band"]}
    finally:
        connection.close()


@router.put("/api/session/classroom-visits/{visit_id}")
def update_visit(visit_id: int, body: VisitBody, x_session_token: str = Header(default="")):
    user = _leadership(x_session_token)
    connection = connect()
    try:
        ensure_classroom_visits(connection)
        current = connection.execute(
            "SELECT id FROM classroom_visits WHERE id = ?",
            (visit_id,),
        ).fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="الزيارة غير محفوظة")
        prepared = _prepare(connection, body, user)
        moment = datetime.now().replace(microsecond=0).isoformat(sep=" ")
        connection.execute(
            """
            UPDATE classroom_visits
            SET teacher_id = ?, teacher_name = ?, visitor_id = ?, visitor_name = ?,
                visitor_role = ?, visit_type = ?, indicator = ?, grade = ?,
                section_no = ?, subject = ?, period_no = ?, lesson = ?,
                visit_date = ?, visit_date_hijri = ?, recommendations = ?,
                improvement = ?, follow_hijri = ?, follow_gregorian = ?,
                criteria_json = ?, total = ?, band = ?, teacher_rank = ?,
                visit_intro = ?, strengths = ?, week = ?, unit = ?, skill = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                prepared["teacher_id"], prepared["teacher_name"], prepared["visitor_id"],
                prepared["visitor_name"], prepared["visitor_role"], prepared["visit_type"],
                prepared["indicator"], prepared["grade"], prepared["section_no"],
                prepared["subject"], prepared["period_no"], prepared["lesson"],
                prepared["visit_date"], prepared["visit_date_hijri"],
                prepared["recommendations"], prepared["improvement"],
                prepared["follow_hijri"], prepared["follow_gregorian"],
                json.dumps(prepared["criteria"], ensure_ascii=False),
                prepared["total"], prepared["band"], prepared["teacher_rank"],
                prepared["visit_intro"], prepared["strengths"],
                prepared["week"], prepared["unit"], prepared["skill"],
                moment, visit_id,
            ),
        )
        connection.commit()
        return {"ok": True, "total": prepared["total"], "band": prepared["band"]}
    finally:
        connection.close()


@router.delete("/api/session/classroom-visits")
def delete_all_visits(x_session_token: str = Header(default="")):
    _leadership(x_session_token)
    connection = connect()
    try:
        ensure_classroom_visits(connection)
        deleted = connection.execute("SELECT COUNT(*) FROM classroom_visits").fetchone()[0]
        connection.execute("DELETE FROM classroom_visits")
        connection.commit()
        return {"ok": True, "deleted": deleted}
    finally:
        connection.close()


@router.delete("/api/session/classroom-visits/{visit_id}")
def delete_visit(visit_id: int, x_session_token: str = Header(default="")):
    _leadership(x_session_token)
    connection = connect()
    try:
        ensure_classroom_visits(connection)
        connection.execute("DELETE FROM classroom_visits WHERE id = ?", (visit_id,))
        connection.commit()
        return {"ok": True}
    finally:
        connection.close()


def _repair_generated(connection) -> None:
    staff = _staff_map(connection)
    moment = datetime.now().replace(microsecond=0).isoformat(sep=" ")
    saved = connection.execute(
        "SELECT id, teacher_id FROM classroom_visits WHERE source = 'auto'"
    ).fetchall()
    for visit_id, teacher_id in saved:
        person = staff.get(str(teacher_id), {})
        connection.execute(
            """
            UPDATE classroom_visits
            SET subject = CASE WHEN trim(subject) = '' THEN ? ELSE subject END,
                visit_type = CASE WHEN visit_type = 'استطلاعية' THEN 'تقويمية' ELSE visit_type END,
                indicator = CASE
                    WHEN indicator IN ('2-1 بناء خبرات التعلم', '2-2 تقويم التعلم') THEN indicator
                    ELSE ? END,
                recommendations = CASE
                    WHEN trim(recommendations) = '' OR recommendations = ?
                    THEN ? ELSE recommendations END,
                improvement = CASE
                    WHEN trim(improvement) = '' OR improvement = ?
                    THEN ? ELSE improvement END,
                updated_at = ?
            WHERE id = ?
            """,
            (
                person.get("specialty", ""),
                "2-1 بناء خبرات التعلم",
                "الاستمرار على الممارسات المتحققة، وتوثيق الشواهد في ملف المعلم.",
                FULL_RECOMMENDATIONS,
                "لا توجد فجوة ظاهرة في هذه الزيارة. تُراجع البنود عند الزيارة التالية.",
                FULL_IMPROVEMENT,
                moment,
                visit_id,
            ),
        )


@router.post("/api/session/classroom-visits/generate-full")
def generate_full(body: GenerateBody, x_session_token: str = Header(default="")):
    user = _leadership(x_session_token)
    connection = connect()
    try:
        ensure_classroom_visits(connection)
        staff = _staff_map(connection)
        seats = _visitor_ids(connection)
        visitor_id = str(body.visitor_id or user.get("id") or "").strip()
        if visitor_id not in seats:
            manager = next((item for item, seat in seats.items() if seat == "manager"), "")
            visitor_id = manager or visitor_id
        visitor = staff.get(visitor_id)
        if not visitor:
            raise HTTPException(status_code=400, detail="تعذر تحديد الزائر من التشكيل")
        full = [
            {"id": spec["id"], "level": "high", "phrase": PHRASES[spec["id"]]["high"]}
            for spec in CRITERIA
        ]
        rows, total, band = _score(full)
        encoded = json.dumps(rows, ensure_ascii=False)
        moment = datetime.now().replace(microsecond=0).isoformat(sep=" ")
        _repair_generated(connection)
        existing = {
            str(row[0]): row[1]
            for row in connection.execute(
                "SELECT teacher_id, id FROM classroom_visits WHERE source = 'auto'"
            ).fetchall()
        }
        created = 0
        visit_type = _clean_choice(body.visit_type, VISIT_TYPES) or "تقويمية"
        indicator = _clean_choice(body.indicator, INDICATORS) or "2-1 بناء خبرات التعلم"
        for identity, person in staff.items():
            if not person["role"].startswith("معلم") or not person["active"]:
                continue
            if identity in existing:
                continue
            connection.execute(
                """
                INSERT INTO classroom_visits (
                    teacher_id, teacher_name, visitor_id, visitor_name, visitor_role,
                    visit_type, indicator, grade, section_no, subject, period_no, lesson,
                    visit_date, visit_date_hijri, recommendations, improvement,
                    follow_hijri, follow_gregorian, criteria_json, total, band, source,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?, '', '', ?, ?, ?, ?, '', '', ?, ?, ?, 'auto', ?, ?)
                """,
                (
                    identity,
                    person["name"],
                    visitor_id,
                    visitor["name"],
                    _seat_label(seats.get(visitor_id, "")) or visitor["role"],
                    visit_type,
                    indicator,
                    person["specialty"],
                    str(body.visit_date or "").strip()[:10],
                    str(body.visit_date_hijri or "").strip()[:80],
                    FULL_RECOMMENDATIONS,
                    FULL_IMPROVEMENT,
                    encoded,
                    total,
                    band,
                    moment,
                    moment,
                ),
            )
            created += 1
        connection.commit()
        return {"ok": True, "created": created, "total": total, "band": band}
    finally:
        connection.close()
