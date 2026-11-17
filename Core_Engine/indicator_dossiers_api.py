# سجلات المؤشرات الأربعة: التعبئة من المحفوظ، وتعديل الالتزام، وتسكين ملف الطباعة.

from __future__ import annotations

import json
import shutil
import uuid
from datetime import date, timedelta
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from hijri_converter import Gregorian
from pydantic import BaseModel, Field

from .database import connect
from .noor_import import stamp
from .witness_files_api import ensure_witness_files_table

router = APIRouter(tags=["indicator-dossiers"])

_ROOT = Path(__file__).resolve().parents[1]
_PREVIEWS = _ROOT / "Print_Canvas" / "previews"
_COUNCILS = _ROOT / "School_Data" / "council_minutes.json"
_WITNESS = _ROOT / "School_Data" / "witness_files"
_YEAR_START = date(2026, 8, 23)
_MARKS = {"", "ملتزم", "ملاحظة"}
_HIJRI = [
    "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
    "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
]
_SEATS = {
    "manager": "مدير المدرسة",
    "education_agents": "وكيل الشؤون التعليمية",
    "student_agents": "وكيل شؤون الطلاب",
    "school_affairs_agent": "وكيل الشؤون المدرسية",
    "counselors": "الموجه الطلابي",
    "activity_leader": "رائد النشاط",
    "librarian": "أمين المصادر",
    "lab_tech": "محضر المختبر",
    "safety_supervisor": "مشرف السلامة",
}
_SEAT_NAME = {"chair": "رئيس", "member": "عضو", "exofficio": "بحكم المنصب"}
_COMMITTEES = (
    ("admin", "اللجنة الإدارية"),
    ("guidance", "لجنة التوجيه والإرشاد"),
    ("achievement", "لجنة التحصيل الدراسي"),
    ("excellence", "لجنة التميز"),
    ("fund", "فريق الصندوق المدرسي"),
    ("budget", "لجنة الميزانية التشغيلية"),
    ("safety", "فريق الأمن والسلامة المدرسية"),
    ("activity", "لجنة النشاط والمناسبات"),
    ("discipline", "لجنة الانضباط والتدخل السريع"),
    ("special", "فريق التربية الخاصة"),
)
_MINUTE_LABEL = dict(_COMMITTEES)
_MINUTE_LABEL.update({"teachers": "مجلس المعلمين", "students": "مجلس الطلاب"})
_FILES = {
    "1-2-1-2": {
        "title": "ميثاق أخلاقيات مهنة التعليم",
        "indicator": "تلتزم المدرسة بقيم مهنة التعليم وأخلاقياتها.",
        "slot": "p122-charter",
        "pdf": "شواهد_1-2-1-2_ميثاق_المهنة.pdf",
        "links": [
            {"label": "تعديل اللجنة", "href": "#view-committees"},
            {"label": "تعديل المنسوبين", "href": "#view-staff"},
        ],
    },
    "1-3-1-1": {
        "title": "بيئتنا الإيجابية والشراكة الداخلية",
        "indicator": "تعزز المدرسة بناء العلاقات الإيجابية والتعاون في المجتمع المدرسي.",
        "slot": "p131-plan",
        "pdf": "شواهد_1-3-1-1_بيئتنا_الإيجابية.pdf",
        "links": [
            {"label": "تعديل اللجان", "href": "#view-committees"},
            {"label": "محاضر المجالس", "href": "#view-council-details"},
        ],
    },
    "1-4-1-1": {
        "title": "التشكيلات والأنصبة وتطابق المؤهلات",
        "indicator": "توفر المدرسة كادرًا تعليميًّا مكتملاً ومؤهلاً بما يتسق مع المهام الموكلة له.",
        "slot": "p141-formation",
        "pdf": "شواهد_1-4-1-1_التشكيلات_والمؤهلات.pdf",
        "links": [
            {"label": "تعديل الرخص", "href": "#view-license-form"},
            {"label": "تعديل المنسوبين", "href": "#view-staff"},
        ],
    },
    "1-4-1-2": {
        "title": "تغطية التشكيلات الإدارية",
        "indicator": "توفر المدرسة كادرًا إداريًّا مكتملاً ومؤهلاً بما يتسق مع المهام الموكلة له.",
        "slot": "p142-structure",
        "pdf": "شواهد_1-4-1-2_تغطية_التشكيلات.pdf",
        "links": [
            {"label": "تعديل القيادة", "href": "#view-leadership"},
            {"label": "تعديل اللجان", "href": "#view-committees"},
        ],
    },
}


class MarkIn(BaseModel):
    national_id: str = Field(max_length=20)
    day: str = Field(max_length=10)
    mark: str = Field(default="", max_length=12)


class MarksIn(BaseModel):
    items: list[MarkIn] = Field(default_factory=list, max_length=200)


def _leadership(token: str) -> dict:
    from .access import require_user

    try:
        user = require_user(str(token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    role = str(user.get("role") or "")
    if role.startswith("مدير") or "وكيل" in role:
        return user
    raise HTTPException(status_code=403, detail="هذا السجل للمدير والوكيل")


def _ensure(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS indicator_follow_marks (
            national_id TEXT NOT NULL,
            day_iso TEXT NOT NULL,
            mark TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL,
            PRIMARY KEY (national_id, day_iso)
        )
        """
    )


def _hijri(value: date) -> str:
    converted = Gregorian(value.year, value.month, value.day).to_hijri()
    return f"{converted.day} {_HIJRI[converted.month - 1]} {converted.year}هـ"


def _days() -> list[dict]:
    return [
        {"iso": ( _YEAR_START + timedelta(days=offset)).isoformat(), "label": _hijri(_YEAR_START + timedelta(days=offset))}
        for offset in range(5)
    ]


def _known(code: str) -> dict:
    found = _FILES.get(str(code or "").strip())
    if not found:
        raise HTTPException(status_code=404, detail="هذا المؤشر ليس من ملفات المهنة والكادر")
    return found


def _active(connection) -> list[dict]:
    return [
        {
            "national_id": str(row[0]),
            "name": row[1] or "",
            "specialty": row[2] or "",
            "role": row[3] or "",
        }
        for row in connection.execute(
            """
            SELECT national_id, name, specialty, role
            FROM noor_staff
            WHERE active = 1 AND COALESCE(is_deleted, 0) = 0
            ORDER BY role, name
            """
        )
    ]


def _committees(connection) -> list[list[str]]:
    rows = []
    for key, title in _COMMITTEES:
        members = connection.execute(
            """
            SELECT n.name, c.seat
            FROM committee_seat c
            LEFT JOIN noor_staff n ON n.national_id = c.national_id
            WHERE c.committee_id = ?
            ORDER BY c.sort_order
            """,
            (key,),
        ).fetchall()
        names = "، ".join(
            f"{item[0] or ''} ({_SEAT_NAME.get(item[1] or '', item[1] or '')})"
            for item in members if item[0]
        )
        rows.append([title, str(len(members)), names])
    return rows


def _minutes() -> list[list[str]]:
    if not _COUNCILS.is_file():
        return []
    payload = json.loads(_COUNCILS.read_text(encoding="utf-8"))
    items = [
        item for item in (payload.get("minutes") or [])
        if "2026-08-11" <= str(item.get("iso") or "") <= "2026-11-04"
    ]
    items.sort(key=lambda item: str(item.get("iso") or ""))
    rows = []
    for item in items:
        present = "، ".join(person.get("name") or "" for person in item.get("present") or [])
        rows.append([
            _MINUTE_LABEL.get(item.get("type"), item.get("type") or ""),
            item.get("hijri") or "",
            item.get("agenda") or "",
            present,
        ])
    return rows


def _loads(connection) -> dict[str, int]:
    totals = {}
    for row in connection.execute(
        """
        SELECT staff_id, COUNT(*)
        FROM nafes_timetable
        WHERE COALESCE(is_deleted, 0) = 0 AND staff_id IS NOT NULL AND staff_id != ''
        GROUP BY staff_id
        """
    ):
        totals[str(row[0])] = int(row[1] or 0)
    return totals


def _dossier(connection, code: str) -> dict:
    spec = _known(code)
    people = _active(connection)
    teachers = [item for item in people if str(item["role"]).startswith("معلم")]
    admins = [item for item in people if not str(item["role"]).startswith("معلم")]
    tables = []
    marks = None
    if code == "1-2-1-2":
        guidance = [
            [item[0] or "", _SEAT_NAME.get(item[1] or "", item[1] or "")]
            for item in connection.execute(
                """
                SELECT n.name, c.seat
                FROM committee_seat c
                LEFT JOIN noor_staff n ON n.national_id = c.national_id
                WHERE c.committee_id = 'guidance'
                ORDER BY c.sort_order
                """
            )
        ]
        tables.append({"title": "لجنة التوجيه والإرشاد", "headers": ["الاسم", "الصفة"], "rows": guidance})
        tables.append({
            "title": "المنسوبون",
            "headers": ["الاسم", "العمل", "التخصص"],
            "rows": [[item["name"], item["role"], item["specialty"]] for item in admins + teachers],
        })
        saved = {
            (str(row[0]), str(row[1])): row[2] or ""
            for row in connection.execute("SELECT national_id, day_iso, mark FROM indicator_follow_marks")
        }
        days = _days()
        marks = {
            "days": days,
            "people": [
                {
                    "national_id": item["national_id"],
                    "name": item["name"],
                    "role": item["role"],
                    "marks": {day["iso"]: saved.get((item["national_id"], day["iso"]), "") for day in days},
                }
                for item in admins + teachers
            ],
        }
    elif code == "1-3-1-1":
        roles = [
            [_SEATS.get(row[0], row[0]), row[1] or ""]
            for row in connection.execute(
                """
                SELECT s.role, n.name
                FROM leadership_seat s
                LEFT JOIN noor_staff n ON n.national_id = s.national_id
                WHERE s.role IN ('activity_leader', 'counselors')
                ORDER BY s.role, s.sort_order
                """
            )
        ]
        tables.append({"title": "إطار البرنامج", "headers": ["الصفة", "الاسم"], "rows": roles})
        tables.append({
            "title": "المحاضر من 28 صفر حتى 24 جمادى الأولى 1448هـ",
            "headers": ["المجلس", "التاريخ", "جدول الأعمال", "الحضور"],
            "rows": _minutes(),
        })
    elif code == "1-4-1-1":
        totals = _loads(connection)
        tables.append({
            "title": "المعلمون والحصص المحفوظة",
            "headers": ["الاسم", "التخصص", "الحصص"],
            "rows": [
                [item["name"], item["specialty"], str(totals.get(item["national_id"], "") or "")]
                for item in teachers
            ],
        })
        licensed = {
            str(row[0]): row
            for row in connection.execute(
                "SELECT national_id, license_no, level_name, major, expires_on FROM witness_license_rows"
            )
        }
        license_rows = []
        for item in people:
            lic = licensed.get(item["national_id"])
            if not lic:
                continue
            license_rows.append([item["name"], item["role"], lic[1] or "", lic[2] or "", lic[3] or "", lic[4] or ""])
        tables.append({
            "title": "الرخص المحفوظة للمنسوبين النشطين",
            "headers": ["الاسم", "العمل", "رقم الرخصة", "المستوى", "التخصص", "الانتهاء"],
            "rows": license_rows,
        })
    else:
        seats = [
            [_SEATS.get(row[0], row[0]), row[1] or "", row[2] or ""]
            for row in connection.execute(
                """
                SELECT s.role, n.name, n.specialty
                FROM leadership_seat s
                LEFT JOIN noor_staff n ON n.national_id = s.national_id
                ORDER BY s.role, s.sort_order
                """
            )
        ]
        tables.append({"title": "المقاعد", "headers": ["المهمة", "الاسم", "التخصص"], "rows": seats})
        tables.append({
            "title": "اللجان والفرق",
            "headers": ["التشكيل", "العدد", "الأعضاء"],
            "rows": _committees(connection),
        })
    return {
        "code": code,
        "title": spec["title"],
        "indicator": spec["indicator"],
        "year": "1448-1449هـ",
        "statistical_number": "S-40341",
        "slot": spec["slot"],
        "pdf_ready": (_PREVIEWS / spec["pdf"]).is_file(),
        "links": spec["links"],
        "tables": tables,
        "marks": marks,
    }


@router.get("/api/session/indicator-dossiers/{code}")
def read_dossier(code: str, x_session_token: str = Header(default="")):
    _leadership(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        connection.commit()
        return _dossier(connection, code)
    finally:
        connection.close()


@router.put("/api/session/indicator-dossiers/1-2-1-2/marks")
def save_marks(body: MarksIn, x_session_token: str = Header(default="")):
    _leadership(x_session_token)
    days = {item["iso"] for item in _days()}
    connection = connect()
    try:
        _ensure(connection)
        active = {item["national_id"] for item in _active(connection)}
        for item in body.items:
            identity = str(item.national_id or "").strip()
            day = str(item.day or "").strip()
            mark = str(item.mark or "").strip()
            if identity not in active or day not in days or mark not in _MARKS:
                raise HTTPException(status_code=400, detail="خانة الالتزام غير مقبولة")
            if not mark:
                connection.execute(
                    "DELETE FROM indicator_follow_marks WHERE national_id = ? AND day_iso = ?",
                    (identity, day),
                )
            else:
                connection.execute(
                    """
                    INSERT INTO indicator_follow_marks (national_id, day_iso, mark, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(national_id, day_iso) DO UPDATE SET mark = excluded.mark, updated_at = excluded.updated_at
                    """,
                    (identity, day, mark, stamp()),
                )
        connection.commit()
        return _dossier(connection, "1-2-1-2")
    except HTTPException:
        connection.rollback()
        raise
    finally:
        connection.close()


@router.post("/api/session/indicator-dossiers/{code}/assign")
def assign_file(code: str, x_session_token: str = Header(default="")):
    _leadership(x_session_token)
    spec = _known(code)
    source = _PREVIEWS / spec["pdf"]
    if not source.is_file():
        raise HTTPException(status_code=404, detail="ملف الطباعة غير موجود")
    payload = source.read_bytes()
    if not payload.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="الملف ليس PDF")
    stored = uuid.uuid4().hex + ".pdf"
    _WITNESS.mkdir(parents=True, exist_ok=True)
    target = _WITNESS / stored
    connection = connect()
    try:
        ensure_witness_files_table(connection)
        count = connection.execute(
            "SELECT COUNT(*) FROM witness_files WHERE slot = ?",
            (spec["slot"],),
        ).fetchone()[0]
        if int(count or 0) >= 4:
            raise HTTPException(status_code=400, detail="بلغت خانة الشاهد حدها")
        shutil.copyfile(source, target)
        connection.execute(
            """
            INSERT INTO witness_files (slot, original_name, stored_name, kind, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (spec["slot"], spec["pdf"], stored, "pdf", stamp()),
        )
        connection.commit()
    except HTTPException:
        connection.rollback()
        if target.is_file():
            target.unlink()
        raise
    except Exception:
        connection.rollback()
        if target.is_file():
            target.unlink()
        raise
    finally:
        connection.close()
    return {"ok": True, "slot": spec["slot"], "name": spec["pdf"]}
