# قوائم الموهوبين والمتدني — جلسة فقط. الاسم والصف والفصل. اعتماد المدير.

from __future__ import annotations

import csv
import io
import json
import random
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from .database import connect

router = APIRouter(tags=["session-students-support"])

YEAR_FALLBACK = "1448-1449"
PILOT_SOURCE = "pilot-1448-support"
CATEGORIES = {"gifted": "الموهوبين", "struggling": "المتدني"}
JSON_PATH = Path(__file__).resolve().parent / "banks" / "students_support.json"
_DIGITS = re.compile(r"^\d{8,}$")
_SKIP_HEADERS = (
    "national_id",
    "id",
    "identity",
    "nid",
    "هوية",
    "رقم الهوية",
    "السجل",
    "السجل المدني",
)


class StudentBody(BaseModel):
    student_name: str = ""
    grade: str = ""
    section: str = ""
    category: str = ""
    academic_year: str = ""
    national_id: str = ""


class ApproveBody(BaseModel):
    category: str = ""
    academic_year: str = ""


def _token(value: str) -> str:
    return str(value or "").strip()


def _require_user(x_session_token: str) -> dict:
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _require_principal(x_session_token: str) -> dict:
    from .access import require_principal

    try:
        return require_principal(_token(x_session_token))
    except PermissionError as error:
        message = str(error)
        status = 401 if message == "لا جلسة" else 403
        raise HTTPException(status_code=status, detail=message) from error


def _year(requested: str = "") -> str:
    text = str(requested or "").strip()
    if not text:
        from .teacher_deliverables_api import stored_academic_year

        text = stored_academic_year() or YEAR_FALLBACK
    if text in ("1448", "1448هـ"):
        return YEAR_FALLBACK
    return text


def _clean_text(value: str, limit: int = 80) -> str:
    return " ".join(str(value or "").replace("\u00a0", " ").split())[:limit]


def _clean_name(value: str) -> str:
    name = _clean_text(value, 120)
    if not name:
        raise HTTPException(status_code=400, detail="الاسم مطلوب")
    if _DIGITS.match(name.replace(" ", "")):
        raise HTTPException(status_code=400, detail="لا يُقبل رقم هوية في حقل الاسم")
    return name


def _category(value: str) -> str:
    kind = str(value or "").strip()
    if kind not in CATEGORIES:
        raise HTTPException(status_code=400, detail="التصنيف: gifted أو struggling")
    return kind


def ensure_students_support_table(connection=None) -> None:
    owns = connection is None
    if owns:
        connection = connect()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS students_support (
                id INTEGER PRIMARY KEY,
                student_name TEXT NOT NULL,
                grade TEXT NOT NULL DEFAULT '',
                section TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL,
                academic_year TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft',
                approved_by TEXT,
                approved_at TEXT,
                created_at TEXT
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_students_support_cat_year
            ON students_support(category, academic_year, status)
            """
        )
        columns = {row[1] for row in connection.execute("PRAGMA table_info(students_support)")}
        if "national_id" not in columns:
            connection.execute(
                "ALTER TABLE students_support ADD COLUMN national_id TEXT NOT NULL DEFAULT ''"
            )
        columns = {row[1] for row in connection.execute("PRAGMA table_info(students_support)")}
        if "source" not in columns:
            connection.execute(
                "ALTER TABLE students_support ADD COLUMN source TEXT NOT NULL DEFAULT ''"
            )
        if "support_type" not in columns:
            connection.execute(
                "ALTER TABLE students_support ADD COLUMN support_type TEXT NOT NULL DEFAULT ''"
            )
        _seed_from_json(connection)
        if owns:
            connection.commit()
    finally:
        if owns:
            connection.close()


def _seed_from_json(connection) -> None:
    count = connection.execute("SELECT COUNT(*) FROM students_support").fetchone()
    if count and count[0]:
        return
    try:
        payload = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    if not isinstance(payload, dict):
        return
    year = str(payload.get("year") or "").strip() or _year()
    moment = datetime.now(timezone.utc).isoformat()
    for kind in CATEGORIES:
        rows = payload.get(kind)
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            name = _clean_text(row.get("name") or row.get("الاسم") or "", 120)
            if not name or _DIGITS.match(name.replace(" ", "")):
                continue
            connection.execute(
                """
                INSERT INTO students_support (
                    student_name, grade, section, category, academic_year,
                    status, approved_by, approved_at, created_at
                ) VALUES (?, ?, ?, ?, ?, 'draft', '', '', ?)
                """,
                (
                    name,
                    _clean_text(row.get("grade") or row.get("الصف") or "", 40),
                    _clean_text(row.get("section") or row.get("الفصل") or "", 20),
                    kind,
                    year,
                    moment,
                ),
            )


def _write_json_mirror(connection) -> None:
    year = _year()
    payload = {
        "year": year,
        "note": "مرآة للأسماء المعتمدة فقط. المصدر: جدول students_support. الاسم والصف والفصل بلا هوية.",
        "gifted": [],
        "struggling": [],
    }
    rows = connection.execute(
        """
        SELECT student_name, grade, section, category
        FROM students_support
        WHERE academic_year = ? AND status = 'approved'
        ORDER BY category, id
        """,
        (year,),
    ).fetchall()
    for row in rows:
        kind = str(row[3] or "")
        if kind not in payload:
            continue
        payload[kind].append(
            {
                "name": str(row[0] or "").strip(),
                "grade": str(row[1] or "").strip(),
                "section": str(row[2] or "").strip(),
            }
        )
    JSON_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _signer_name(connection, identity: str) -> str:
    key = str(identity or "").strip()
    if not key:
        return ""
    if not _DIGITS.match(key):
        return key
    row = connection.execute(
        "SELECT name FROM users WHERE national_id = ?",
        (key,),
    ).fetchone()
    return str(row[0] or "").strip() if row else ""


def _row_public(connection, row) -> dict:
    return {
        "id": row[0],
        "student_name": str(row[1] or "").strip(),
        "grade": str(row[2] or "").strip(),
        "section": str(row[3] or "").strip(),
        "category": str(row[4] or "").strip(),
        "academic_year": str(row[5] or "").strip(),
        "status": str(row[6] or "").strip() or "draft",
        "approved_by": _signer_name(connection, str(row[7] or "").strip()),
        "approved_at": str(row[8] or "").strip(),
        "created_at": str(row[9] or "").strip(),
        "national_id": str(row[10] or "").strip() if len(row) > 10 else "",
    }


def _student_from_noor(connection, national_id: str) -> tuple[str, str, str, str]:
    identity = _clean_text(national_id, 32)
    if not identity:
        raise HTTPException(status_code=400, detail="اختر طالباً من القائمة")
    row = connection.execute(
        """
        SELECT name, grade, classroom
        FROM noor_students
        WHERE national_id = ? AND COALESCE(is_deleted, 0) = 0
        """,
        (identity,),
    ).fetchone()
    if not row or not str(row[0] or "").strip():
        raise HTTPException(status_code=400, detail="الطالب غير موجود في السجل")
    return identity, _clean_name(row[0]), _clean_text(row[1] or "", 40), _clean_text(row[2] or "", 20)


def _pack(connection, kind: str, year: str) -> dict:
    rows = connection.execute(
        """
        SELECT id, student_name, grade, section, category, academic_year,
               status, approved_by, approved_at, created_at, COALESCE(national_id, '')
        FROM students_support
        WHERE category = ? AND academic_year = ?
        ORDER BY id
        """,
        (kind, year),
    ).fetchall()
    items = [_row_public(connection, row) for row in rows]
    approved = [item for item in items if item["status"] == "approved"]
    drafts = [item for item in items if item["status"] != "approved"]
    signer = ""
    stamped = ""
    if approved:
        signer = approved[-1].get("approved_by") or ""
        stamped = approved[-1].get("approved_at") or ""
    return {
        "category": kind,
        "label": CATEGORIES[kind],
        "items": items,
        "count": len(items),
        "approved_count": len(approved),
        "draft_count": len(drafts),
        "is_approved": bool(items) and not drafts,
        "approved_by": signer,
        "approved_at": stamped,
    }


def _assert_unlocked(connection, kind: str, year: str) -> None:
    pack = _pack(connection, kind, year)
    if pack["is_approved"]:
        raise HTTPException(status_code=403, detail="القائمة معتمدة. ألغِ الاعتماد أولاً.")


def approved_name_rows(kind: str, academic_year: str = "") -> list[dict]:
    """الاسم والصف والفصل للصفوف المعتمدة فقط. بلا هوية."""
    if kind not in CATEGORIES:
        return []
    year = _year(academic_year)
    connection = connect()
    try:
        ensure_students_support_table(connection)
        rows = connection.execute(
            """
            SELECT student_name, grade, section
            FROM students_support
            WHERE category = ? AND academic_year = ? AND status = 'approved'
            ORDER BY id
            """,
            (kind, year),
        ).fetchall()
    finally:
        connection.close()
    out = []
    for row in rows:
        name = str(row[0] or "").strip()
        if not name:
            continue
        out.append(
            {
                "name": name,
                "grade": str(row[1] or "").strip(),
                "section": str(row[2] or "").strip(),
            }
        )
    return out


def _parse_import_bytes(raw: bytes, filename: str) -> list[dict]:
    name = str(filename or "").lower()
    if name.endswith(".xlsx") or name.endswith(".xls"):
        try:
            import openpyxl
        except ImportError as error:
            raise HTTPException(
                status_code=400,
                detail="ملف Excel غير متاح هنا. استخدم CSV بالأعمدة: الاسم، الصف، الفصل.",
            ) from error
        book = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        sheet = book.active
        lines = []
        for row in sheet.iter_rows(values_only=True):
            lines.append(["" if cell is None else str(cell).strip() for cell in row])
        return _rows_from_table(lines)
    text = raw.decode("utf-8-sig", errors="replace")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    return _rows_from_table([list(row) for row in reader])


def _header_index(headers: list[str]) -> tuple[int, int, int]:
    mapped = [str(item or "").strip().lower() for item in headers]
    name_i = grade_i = section_i = -1
    for index, label in enumerate(mapped):
        if any(skip in label for skip in _SKIP_HEADERS):
            continue
        if name_i < 0 and label in ("name", "الاسم", "اسم الطالب", "student_name", "الطالب"):
            name_i = index
        elif grade_i < 0 and label in ("grade", "الصف", "صف"):
            grade_i = index
        elif section_i < 0 and label in ("section", "الفصل", "فصل", "الشعبة"):
            section_i = index
    if name_i < 0:
        name_i = 0
    if grade_i < 0:
        grade_i = 1 if len(headers) > 1 else -1
    if section_i < 0:
        section_i = 2 if len(headers) > 2 else -1
    return name_i, grade_i, section_i


def _rows_from_table(lines: list[list[str]]) -> list[dict]:
    usable = [line for line in lines if any(str(cell or "").strip() for cell in line)]
    if not usable:
        return []
    first = [str(cell or "").strip() for cell in usable[0]]
    looks_header = any(
        str(cell or "").strip().lower()
        in ("name", "الاسم", "الصف", "الفصل", "grade", "section", "student_name")
        for cell in first
    )
    if looks_header:
        name_i, grade_i, section_i = _header_index(first)
        body = usable[1:]
    else:
        name_i, grade_i, section_i = 0, 1 if len(first) > 1 else -1, 2 if len(first) > 2 else -1
        body = usable
    out = []
    for line in body:
        name = _clean_text(line[name_i] if name_i < len(line) else "", 120)
        if not name or _DIGITS.match(name.replace(" ", "")):
            continue
        out.append(
            {
                "student_name": name,
                "grade": _clean_text(line[grade_i] if grade_i >= 0 and grade_i < len(line) else "", 40),
                "section": _clean_text(
                    line[section_i] if section_i >= 0 and section_i < len(line) else "", 20
                ),
            }
        )
    return out


@router.get("/api/session/students-support")
def list_students_support(
    status: str = "",
    category: str = "",
    academic_year: str = "",
    x_session_token: str = Header(default=""),
):
    """يعيد قوائم الموهوبين والمتدني للعام المحفوظ. بلا أرقام هوية."""
    _require_user(x_session_token)
    year = _year(academic_year)
    wanted = str(status or "").strip()
    kind_filter = str(category or "").strip()
    connection = connect()
    try:
        ensure_students_support_table(connection)
        connection.commit()
        packs = {}
        for kind in CATEGORIES:
            if kind_filter and kind_filter != kind:
                continue
            pack = _pack(connection, kind, year)
            if wanted in ("draft", "approved"):
                pack["items"] = [item for item in pack["items"] if item["status"] == wanted]
            packs[kind] = pack
    finally:
        connection.close()
    return {"academic_year": year, "lists": packs}


@router.post("/api/session/students-support")
def add_student(body: StudentBody, x_session_token: str = Header(default="")):
    """يضيف طالباً مسودة: اسم وصف وفصل فقط."""
    _require_user(x_session_token)
    kind = _category(body.category)
    year = _year(body.academic_year)
    moment = datetime.now(timezone.utc).isoformat()
    connection = connect()
    try:
        ensure_students_support_table(connection)
        identity, name, grade, section = _student_from_noor(connection, body.national_id)
        _assert_unlocked(connection, kind, year)
        cursor = connection.execute(
            """
            INSERT INTO students_support (
                student_name, grade, section, category, academic_year,
                status, approved_by, approved_at, created_at, national_id
            ) VALUES (?, ?, ?, ?, ?, 'draft', '', '', ?, ?)
            """,
            (
                name,
                grade,
                section,
                kind,
                year,
                moment,
                identity,
            ),
        )
        row_id = cursor.lastrowid
        _write_json_mirror(connection)
        connection.commit()
        row = connection.execute(
            """
            SELECT id, student_name, grade, section, category, academic_year,
                   status, approved_by, approved_at, created_at, COALESCE(national_id, '')
            FROM students_support WHERE id = ?
            """,
            (row_id,),
        ).fetchone()
        return _row_public(connection, row)
    finally:
        connection.close()


@router.put("/api/session/students-support/{row_id}")
def update_student(row_id: int, body: StudentBody, x_session_token: str = Header(default="")):
    """يعدّل الطالب من السجل إن لم تكن القائمة معتمدة."""
    _require_user(x_session_token)
    connection = connect()
    try:
        ensure_students_support_table(connection)
        identity, name, grade, section = _student_from_noor(connection, body.national_id)
        existing = connection.execute(
            "SELECT id, category, academic_year, status FROM students_support WHERE id = ?",
            (row_id,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="السجل غير موجود")
        kind = _category(body.category) if str(body.category or "").strip() else str(existing[1])
        _assert_unlocked(connection, str(existing[1]), str(existing[2] or ""))
        if str(existing[3] or "") == "approved":
            raise HTTPException(status_code=403, detail="القائمة معتمدة. ألغِ الاعتماد أولاً.")
        connection.execute(
            """
            UPDATE students_support
            SET student_name = ?, grade = ?, section = ?, category = ?,
                status = 'draft', approved_by = '', approved_at = '', national_id = ?
            WHERE id = ?
            """,
            (
                name,
                grade,
                section,
                kind,
                identity,
                row_id,
            ),
        )
        _write_json_mirror(connection)
        connection.commit()
        row = connection.execute(
            """
            SELECT id, student_name, grade, section, category, academic_year,
                   status, approved_by, approved_at, created_at, COALESCE(national_id, '')
            FROM students_support WHERE id = ?
            """,
            (row_id,),
        ).fetchone()
        return _row_public(connection, row)
    finally:
        connection.close()


def draw_pilot_support(connection) -> dict:
    """يسكن الموهوبين والمتدنين من سجل الطلاب فقط. يعيد تسكين صفوف المرحلة ولا يمس غيرها."""
    ensure_students_support_table(connection)
    year = _year()
    connection.execute("DELETE FROM students_support WHERE source LIKE 'pilot-1448%'")
    rows = connection.execute(
        """
        SELECT national_id, name, grade, classroom
        FROM noor_students
        WHERE COALESCE(is_deleted, 0) = 0 AND TRIM(COALESCE(name, '')) != ''
        ORDER BY grade, classroom, name
        """
    ).fetchall()
    classes: dict[tuple[str, str], list] = {}
    for row in rows:
        classes.setdefault((str(row[2] or ""), str(row[3] or "")), []).append(row)
    rng = random.Random(1448)
    struggling = []
    per_class = []
    for key in sorted(classes):
        pool = list(classes[key])
        count = min(rng.randint(3, 6), max(0, len(pool) - 1))
        picked = rng.sample(pool, count) if count else []
        struggling.extend(picked)
        per_class.append({"grade": key[0], "section": key[1], "struggling": len(picked), "size": len(pool)})
    used = {str(row[0]) for row in struggling}
    gifted = []
    for key in sorted(classes):
        remain = [row for row in classes[key] if str(row[0]) not in used]
        if not remain:
            continue
        choice = rng.choice(remain)
        gifted.append(choice)
        used.add(str(choice[0]))
    rest = [row for row in rows if str(row[0]) not in used]
    need = 25 - len(gifted)
    if need > 0 and rest:
        gifted.extend(rng.sample(rest, min(need, len(rest))))
    moment = datetime.now(timezone.utc).isoformat()

    def insert(row, category: str, label: str) -> None:
        connection.execute(
            """
            INSERT INTO students_support (
                student_name, grade, section, category, academic_year,
                status, approved_by, approved_at, created_at, national_id, source, support_type
            ) VALUES (?, ?, ?, ?, ?, 'draft', '', '', ?, ?, ?, ?)
            """,
            (row[1], row[2] or "", row[3] or "", category, year, moment, row[0], PILOT_SOURCE, label),
        )

    for row in gifted:
        insert(row, "gifted", "موهوب")
    for row in struggling:
        insert(row, "struggling", "متدن")
    seated = {str(row[0]) for row in gifted + struggling}
    return {
        "year": year,
        "gifted": len(gifted),
        "struggling": len(struggling),
        "classes": per_class,
        "unseated": len(rows) - len(seated),
        "students": len(rows),
        "source": PILOT_SOURCE,
    }


def clear_pilot_support(connection) -> int:
    ensure_students_support_table(connection)
    cursor = connection.execute("DELETE FROM students_support WHERE source LIKE 'pilot-1448%'")
    return int(cursor.rowcount or 0)


@router.delete("/api/session/students-support/pilot")
def delete_pilot_support(x_session_token: str = Header(default="")):
    """يحذف تسكين المرحلة فقط. لا يمس طلاب نور ولا الصفوف بلا وسم."""
    _require_principal(x_session_token)
    connection = connect()
    try:
        removed = clear_pilot_support(connection)
        _write_json_mirror(connection)
        connection.commit()
    finally:
        connection.close()
    return {"ok": True, "removed": removed}


@router.post("/api/session/students-support/pilot-draw")
def redraw_pilot_support(x_session_token: str = Header(default="")):
    """يعيد التسكين العشوائي للمرحلة من سجل الطلاب."""
    _require_principal(x_session_token)
    connection = connect()
    try:
        report = draw_pilot_support(connection)
        connection.commit()
    finally:
        connection.close()
    return {"ok": True, **report}


@router.delete("/api/session/students-support/{row_id}")
def delete_student(row_id: int, x_session_token: str = Header(default="")):
    """يحذف صفاً من قائمة الدعم فقط. لا يمس سجلات الطلاب الأخرى."""
    _require_user(x_session_token)
    connection = connect()
    try:
        ensure_students_support_table(connection)
        existing = connection.execute(
            "SELECT id, category, academic_year, status FROM students_support WHERE id = ?",
            (row_id,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="السجل غير موجود")
        _assert_unlocked(connection, str(existing[1]), str(existing[2] or ""))
        if str(existing[3] or "") == "approved":
            raise HTTPException(status_code=403, detail="القائمة معتمدة. ألغِ الاعتماد أولاً.")
        connection.execute("DELETE FROM students_support WHERE id = ?", (row_id,))
        _write_json_mirror(connection)
        connection.commit()
    finally:
        connection.close()
    return {"ok": True, "id": row_id}


@router.post("/api/session/students-support/approve")
def approve_list(body: ApproveBody, x_session_token: str = Header(default="")):
    """يعتمد قائمة التصنيف للعام. للمدير فقط. يحفظ هوية الجلسة داخلياً ويعرض الاسم."""
    principal = _require_principal(x_session_token)
    kind = _category(body.category)
    year = _year(body.academic_year)
    signer = str(principal.get("id") or "").strip()
    if not signer:
        raise HTTPException(status_code=400, detail="هوية المدير غير محفوظة في الجلسة")
    moment = datetime.now(timezone.utc).isoformat()
    connection = connect()
    try:
        ensure_students_support_table(connection)
        count = connection.execute(
            """
            SELECT COUNT(*) FROM students_support
            WHERE category = ? AND academic_year = ?
            """,
            (kind, year),
        ).fetchone()[0]
        if not count:
            raise HTTPException(status_code=400, detail="لا أسماء في هذه القائمة للاعتماد")
        connection.execute(
            """
            UPDATE students_support
            SET status = 'approved', approved_by = ?, approved_at = ?
            WHERE category = ? AND academic_year = ?
            """,
            (signer, moment, kind, year),
        )
        _write_json_mirror(connection)
        connection.commit()
        pack = _pack(connection, kind, year)
    finally:
        connection.close()
    return {"ok": True, "academic_year": year, "list": pack}


@router.post("/api/session/students-support/unapprove")
def unapprove_list(body: ApproveBody, x_session_token: str = Header(default="")):
    """يلغي اعتماد القائمة. للمدير فقط. بعدها يعود التعديل."""
    _require_principal(x_session_token)
    kind = _category(body.category)
    year = _year(body.academic_year)
    connection = connect()
    try:
        ensure_students_support_table(connection)
        connection.execute(
            """
            UPDATE students_support
            SET status = 'draft', approved_by = '', approved_at = ''
            WHERE category = ? AND academic_year = ?
            """,
            (kind, year),
        )
        _write_json_mirror(connection)
        connection.commit()
        pack = _pack(connection, kind, year)
    finally:
        connection.close()
    return {"ok": True, "academic_year": year, "list": pack}


@router.post("/api/session/students-support/import")
def import_students(
    category: str = Form(...),
    academic_year: str = Form(""),
    file: UploadFile = File(...),
    x_session_token: str = Header(default=""),
):
    """يستورد CSV أو Excel: الاسم والصف والفصل. يتجاهل أعمدة الهوية. الصفوف تُضاف مسودة."""
    _require_user(x_session_token)
    kind = _category(category)
    year = _year(academic_year)
    raw = file.file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="الملف فارغ")
    rows = _parse_import_bytes(raw, file.filename or "")
    if not rows:
        raise HTTPException(status_code=400, detail="لا صفوف صالحة (اسم وصف وفصل)")
    moment = datetime.now(timezone.utc).isoformat()
    connection = connect()
    try:
        ensure_students_support_table(connection)
        _assert_unlocked(connection, kind, year)
        inserted = 0
        for row in rows:
            connection.execute(
                """
                INSERT INTO students_support (
                    student_name, grade, section, category, academic_year,
                    status, approved_by, approved_at, created_at
                ) VALUES (?, ?, ?, ?, ?, 'draft', '', '', ?)
                """,
                (
                    row["student_name"],
                    row["grade"],
                    row["section"],
                    kind,
                    year,
                    moment,
                ),
            )
            inserted += 1
        _write_json_mirror(connection)
        connection.commit()
        pack = _pack(connection, kind, year)
    finally:
        connection.close()
    return {"ok": True, "imported": inserted, "list": pack}
