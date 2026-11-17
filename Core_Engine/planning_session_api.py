# تقويم ومناسبات وترويسة وصلاحيات وحسابات من الجلسة. لا يقرأ localStorage.
from __future__ import annotations

import json
import re
import sqlite3
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .database import connect
from .planning_seeds import ACADEMIC_EVENTS, SCHOOL_OCCASIONS

router = APIRouter(tags=["session-planning"])

_ROOT = Path(__file__).resolve().parents[1]
_LETTER = _ROOT / "School_Data" / "letterhead"
_MIN_BYTES = 500
_MAX_BYTES = 4 * 1024 * 1024
_SLOTS = {
    "ministry": {"ext": {".png", ".jpg", ".jpeg"}, "label": "شعار الوزارة"},
    "vision": {"ext": {".png", ".jpg", ".jpeg"}, "label": "شعار الرؤية"},
    "stamp": {"ext": {".png", ".jpg", ".jpeg"}, "label": "الختم"},
}
_WINDOWS = [
    {"id": "settings", "label": "شاشة الإعدادات"},
    {"id": "schoolRegisters", "label": "السجلات المدرسية"},
    {"id": "viceRegisters", "label": "سجلات الوكيل"},
    {"id": "teacherRegisters", "label": "سجلات المعلم"},
    {"id": "tasks", "label": "إدارة المهام"},
    {"id": "committees", "label": "اللجان"},
    {"id": "plans", "label": "الخطط"},
    {"id": "indicators", "label": "المؤشرات"},
    {"id": "calendar", "label": "التقويم المعتمد"},
    {"id": "occasions", "label": "المناسبات"},
    {"id": "letterhead", "label": "الترويسة والأختام"},
    {"id": "deliverables", "label": "تسليمات المعلم"},
    {"id": "backup", "label": "النسخ الاحتياطي"},
    {"id": "noor", "label": "الاستيراد من نور"},
    {"id": "accounts", "label": "إدارة الحسابات"},
]


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


def _ensure(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS planning_calendar (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            payload TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS academic_calendar_events (
            id INTEGER PRIMARY KEY,
            year TEXT NOT NULL,
            title TEXT NOT NULL,
            hijri TEXT NOT NULL DEFAULT '',
            gregorian TEXT NOT NULL DEFAULT '',
            type TEXT NOT NULL DEFAULT ''
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS school_occasions (
            id TEXT PRIMARY KEY,
            year TEXT NOT NULL,
            title TEXT NOT NULL,
            hijri_start TEXT NOT NULL DEFAULT '',
            hijri_end TEXT NOT NULL DEFAULT '',
            gregorian_start TEXT NOT NULL DEFAULT '',
            gregorian_end TEXT NOT NULL DEFAULT '',
            type TEXT NOT NULL DEFAULT '',
            scope TEXT NOT NULL DEFAULT 'all',
            anchor TEXT NOT NULL DEFAULT '',
            note TEXT NOT NULL DEFAULT ''
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS letterhead_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            stamp_note TEXT NOT NULL DEFAULT ''
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS letterhead_files (
            slot TEXT PRIMARY KEY,
            stored_name TEXT NOT NULL,
            original_name TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS user_window_permissions (
            national_id TEXT PRIMARY KEY,
            level TEXT NOT NULL,
            windows TEXT NOT NULL,
            is_disabled INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    try:
        connection.execute("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")
    except sqlite3.OperationalError:
        pass
    if not connection.execute("SELECT 1 FROM academic_calendar_events LIMIT 1").fetchone():
        connection.executemany(
            """
            INSERT INTO academic_calendar_events (year, title, hijri, gregorian, type)
            VALUES (?, ?, ?, ?, ?)
            """,
            ACADEMIC_EVENTS,
        )
    if not connection.execute("SELECT 1 FROM school_occasions LIMIT 1").fetchone():
        connection.executemany(
            """
            INSERT INTO school_occasions (
                id, year, title, hijri_start, hijri_end, gregorian_start, gregorian_end,
                type, scope, anchor, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            SCHOOL_OCCASIONS,
        )
    if not connection.execute("SELECT 1 FROM planning_calendar WHERE id = 1").fetchone():
        connection.execute(
            "INSERT INTO planning_calendar (id, payload) VALUES (1, ?)",
            (json.dumps(_default_calendar(), ensure_ascii=False),),
        )
    if not connection.execute("SELECT 1 FROM letterhead_settings WHERE id = 1").fetchone():
        connection.execute("INSERT INTO letterhead_settings (id, stamp_note) VALUES (1, '')")


def _default_calendar() -> dict:
    return {
        "years": ["1447-1448", "1448-1449", "1449-1450"],
        "year": "1448-1449",
        "termCount": "2",
        "region": "makkah",
        "startHijri": "",
        "startGregorian": "",
        "examHijri": "",
        "examGregorian": "",
        "endHijri": "",
        "endGregorian": "",
    }


def _calendar_row(connection) -> dict:
    row = connection.execute("SELECT payload FROM planning_calendar WHERE id = 1").fetchone()
    data = json.loads(row[0]) if row and row[0] else _default_calendar()
    base = _default_calendar()
    base.update(data if isinstance(data, dict) else {})
    years = base.get("years")
    if not isinstance(years, list) or not years:
        years = _default_calendar()["years"]
    base["years"] = [str(item) for item in years if str(item).strip()]
    return base


def _occasion_dict(row) -> dict:
    return {
        "id": row[0],
        "year": row[1],
        "title": row[2],
        "hijriStart": row[3],
        "hijriEnd": row[4],
        "gregorianStart": row[5],
        "gregorianEnd": row[6],
        "type": row[7],
        "scope": row[8],
        "anchor": row[9],
        "note": row[10],
    }


def _letter_payload(connection) -> dict:
    note = connection.execute("SELECT stamp_note FROM letterhead_settings WHERE id = 1").fetchone()
    files = {}
    for slot, stored, original in connection.execute(
        "SELECT slot, stored_name, original_name FROM letterhead_files"
    ):
        path = _LETTER / Path(str(stored)).name
        size = path.stat().st_size if path.is_file() else 0
        files[slot] = {
            "slot": slot,
            "original_name": original or "",
            "byte_size": size,
            "displayable": size >= _MIN_BYTES,
            "file_url": "/api/session/letterhead/file/" + slot if size else "",
        }
    return {"stamp_note": (note[0] if note else "") or "", "files": files}


class CalendarBody(BaseModel):
    years: list[str] = Field(default_factory=list)
    year: str = ""
    termCount: str = "2"
    region: str = "makkah"
    startHijri: str = ""
    startGregorian: str = ""
    examHijri: str = ""
    examGregorian: str = ""
    endHijri: str = ""
    endGregorian: str = ""


class OccasionBody(BaseModel):
    id: str = ""
    year: str = ""
    title: str = ""
    hijriStart: str = ""
    hijriEnd: str = ""
    gregorianStart: str = ""
    gregorianEnd: str = ""
    type: str = ""
    scope: str = "all"
    anchor: str = ""
    note: str = ""


class LetterNoteBody(BaseModel):
    stamp_note: str = ""


class PermissionBody(BaseModel):
    national_id: str = ""
    level: str = ""
    windows: dict = Field(default_factory=dict)


class AccountActiveBody(BaseModel):
    national_id: str = ""
    is_active: bool = True


@router.get("/api/session/calendar")
def get_calendar(x_session_token: str = Header(default="")):
    _require_user(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        connection.commit()
        return _calendar_row(connection)
    finally:
        connection.close()


@router.put("/api/session/calendar")
def put_calendar(body: CalendarBody, x_session_token: str = Header(default="")):
    _require_principal(x_session_token)
    payload = body.model_dump() if hasattr(body, "model_dump") else body.dict()
    years = [str(item).strip() for item in (payload.get("years") or []) if str(item).strip()]
    if not years:
        years = _default_calendar()["years"]
    payload["years"] = years
    payload["year"] = str(payload.get("year") or years[0]).strip() or years[0]
    payload["region"] = payload.get("region") if payload.get("region") in {"makkah", "other"} else "makkah"
    connection = connect()
    try:
        _ensure(connection)
        connection.execute(
            "UPDATE planning_calendar SET payload = ? WHERE id = 1",
            (json.dumps(payload, ensure_ascii=False),),
        )
        connection.commit()
        return _calendar_row(connection)
    finally:
        connection.close()


@router.get("/api/session/calendar/stations")
def calendar_stations(year: str = "", region: str = "", x_session_token: str = Header(default="")):
    _require_user(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        connection.commit()
        cal = _calendar_row(connection)
        chosen = str(year or cal.get("year") or "").strip()
        area = str(region or cal.get("region") or "makkah").strip() or "makkah"
        if chosen == "1448-1449":
            rows = connection.execute(
                """
                SELECT id, year, title, hijri_start, hijri_end, gregorian_start, gregorian_end,
                       type, scope, anchor, note
                FROM school_occasions WHERE year = ? ORDER BY gregorian_start, id
                """,
                (chosen,),
            ).fetchall()
            items = []
            for row in rows:
                item = _occasion_dict(row)
                if item["scope"] in {"all", area}:
                    items.append(item)
            return {"year": chosen, "region": area, "source": "occasions", "items": items}
        rows = connection.execute(
            """
            SELECT year, title, hijri, gregorian, type
            FROM academic_calendar_events WHERE year = ? ORDER BY id
            """,
            (chosen,),
        ).fetchall()
        items = [
            {
                "id": "",
                "year": row[0],
                "title": row[1],
                "hijriStart": row[2],
                "hijriEnd": "",
                "gregorianStart": row[3],
                "gregorianEnd": "",
                "type": row[4],
                "scope": "all",
                "anchor": "",
                "note": "",
            }
            for row in rows
        ]
        return {"year": chosen, "region": area, "source": "calendar", "items": items}
    finally:
        connection.close()


@router.get("/api/session/occasions")
def list_occasions(year: str = "", x_session_token: str = Header(default="")):
    _require_user(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        connection.commit()
        if year.strip():
            rows = connection.execute(
                """
                SELECT id, year, title, hijri_start, hijri_end, gregorian_start, gregorian_end,
                       type, scope, anchor, note
                FROM school_occasions WHERE year = ? ORDER BY gregorian_start, id
                """,
                (year.strip(),),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT id, year, title, hijri_start, hijri_end, gregorian_start, gregorian_end,
                       type, scope, anchor, note
                FROM school_occasions ORDER BY year, gregorian_start, id
                """
            ).fetchall()
        return {"items": [_occasion_dict(row) for row in rows]}
    finally:
        connection.close()


@router.post("/api/session/occasions")
def save_occasion(body: OccasionBody, x_session_token: str = Header(default="")):
    _require_principal(x_session_token)
    title = body.title.strip()
    year = body.year.strip()
    if not title or not year:
        raise HTTPException(status_code=400, detail="العنوان والعام مطلوبان")
    identity = body.id.strip() or ("occ-" + uuid.uuid4().hex[:12])
    if not re.match(r"^occ-[A-Za-z0-9_-]+$", identity):
        raise HTTPException(status_code=400, detail="معرّف المناسبة غير صالح")
    connection = connect()
    try:
        _ensure(connection)
        connection.execute(
            """
            INSERT INTO school_occasions (
                id, year, title, hijri_start, hijri_end, gregorian_start, gregorian_end,
                type, scope, anchor, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                year=excluded.year, title=excluded.title, hijri_start=excluded.hijri_start,
                hijri_end=excluded.hijri_end, gregorian_start=excluded.gregorian_start,
                gregorian_end=excluded.gregorian_end, type=excluded.type, scope=excluded.scope,
                anchor=excluded.anchor, note=excluded.note
            """,
            (
                identity, year, title, body.hijriStart.strip(), body.hijriEnd.strip(),
                body.gregorianStart.strip(), body.gregorianEnd.strip(), body.type.strip(),
                body.scope.strip() or "all", body.anchor.strip(), body.note.strip(),
            ),
        )
        connection.commit()
        row = connection.execute(
            """
            SELECT id, year, title, hijri_start, hijri_end, gregorian_start, gregorian_end,
                   type, scope, anchor, note FROM school_occasions WHERE id = ?
            """,
            (identity,),
        ).fetchone()
        return _occasion_dict(row)
    finally:
        connection.close()


@router.delete("/api/session/occasions/{occasion_id}")
def delete_occasion(occasion_id: str, x_session_token: str = Header(default="")):
    _require_principal(x_session_token)
    identity = occasion_id.strip()
    connection = connect()
    try:
        _ensure(connection)
        row = connection.execute("SELECT id FROM school_occasions WHERE id = ?", (identity,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="المناسبة غير موجودة")
        connection.execute("DELETE FROM school_occasions WHERE id = ?", (identity,))
        connection.commit()
        return {"ok": True, "id": identity}
    finally:
        connection.close()


@router.get("/api/session/letterhead")
def get_letterhead(x_session_token: str = Header(default="")):
    _require_user(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        connection.commit()
        return _letter_payload(connection)
    finally:
        connection.close()


@router.put("/api/session/letterhead")
def put_letterhead(body: LetterNoteBody, x_session_token: str = Header(default="")):
    _require_principal(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        connection.execute(
            "UPDATE letterhead_settings SET stamp_note = ? WHERE id = 1",
            (body.stamp_note.strip(),),
        )
        connection.commit()
        return _letter_payload(connection)
    finally:
        connection.close()


@router.post("/api/session/letterhead/file")
async def upload_letterhead_file(
    slot: str = Form(default=""),
    upload: UploadFile = File(...),
    x_session_token: str = Header(default=""),
):
    _require_principal(x_session_token)
    key = slot.strip()
    if key not in _SLOTS:
        raise HTTPException(status_code=400, detail="خانة الشعار غير معروفة")
    payload = await upload.read()
    if not payload or len(payload) > _MAX_BYTES:
        raise HTTPException(status_code=400, detail="الملف فارغ أو أكبر من 4 ميجابايت")
    if len(payload) < _MIN_BYTES:
        raise HTTPException(status_code=400, detail="الملف تالف أو أصغر من الحد الأدنى")
    suffix = Path(str(upload.filename or "")).suffix.lower()
    if suffix == ".jpeg":
        suffix = ".jpg"
    if suffix not in _SLOTS[key]["ext"]:
        raise HTTPException(status_code=400, detail="الصيغة PNG أو JPG فقط")
    _LETTER.mkdir(parents=True, exist_ok=True)
    stored = key + suffix
    path = _LETTER / stored
    connection = connect()
    try:
        _ensure(connection)
        old = connection.execute(
            "SELECT stored_name FROM letterhead_files WHERE slot = ?",
            (key,),
        ).fetchone()
        path.write_bytes(payload)
        original = Path(str(upload.filename or stored)).name
        connection.execute(
            """
            INSERT INTO letterhead_files (slot, stored_name, original_name)
            VALUES (?, ?, ?)
            ON CONFLICT(slot) DO UPDATE SET stored_name=excluded.stored_name, original_name=excluded.original_name
            """,
            (key, stored, original),
        )
        connection.commit()
        if old and old[0] and Path(str(old[0])).name != stored:
            leftover = _LETTER / Path(str(old[0])).name
            if leftover.is_file() and leftover != path:
                leftover.unlink()
        return _letter_payload(connection)
    finally:
        connection.close()


@router.get("/api/session/letterhead/file/{slot}")
def letterhead_file(slot: str, x_session_token: str = Header(default="")):
    _require_user(x_session_token)
    key = slot.strip()
    if key not in _SLOTS:
        raise HTTPException(status_code=404, detail="الخانة غير موجودة")
    connection = connect()
    try:
        _ensure(connection)
        row = connection.execute(
            "SELECT stored_name, original_name FROM letterhead_files WHERE slot = ?",
            (key,),
        ).fetchone()
    finally:
        connection.close()
    if not row:
        raise HTTPException(status_code=404, detail="لا ملف محفوظ")
    path = _LETTER / Path(str(row[0])).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    media = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return FileResponse(path, media_type=media, filename=row[1] or path.name)


@router.get("/api/session/permissions")
def get_permissions(national_id: str = "", x_session_token: str = Header(default="")):
    _require_principal(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        connection.commit()
        if national_id.strip():
            row = connection.execute(
                "SELECT national_id, level, windows, is_disabled FROM user_window_permissions WHERE national_id = ?",
                (national_id.strip(),),
            ).fetchone()
            record = None
            if row:
                record = {
                    "national_id": row[0],
                    "level": row[1],
                    "windows": json.loads(row[2] or "{}"),
                    "is_disabled": bool(row[3]),
                }
            return {"windows": _WINDOWS, "record": record}
        rows = connection.execute(
            "SELECT national_id, level, windows, is_disabled FROM user_window_permissions"
        ).fetchall()
        items = [
            {
                "national_id": row[0],
                "level": row[1],
                "windows": json.loads(row[2] or "{}"),
                "is_disabled": bool(row[3]),
            }
            for row in rows
        ]
        return {"windows": _WINDOWS, "items": items}
    finally:
        connection.close()


@router.put("/api/session/permissions")
def put_permissions(body: PermissionBody, x_session_token: str = Header(default="")):
    _require_principal(x_session_token)
    identity = body.national_id.strip()
    if not identity:
        raise HTTPException(status_code=400, detail="رقم الهوية مطلوب")
    level = body.level.strip() or "guest"
    if level not in {"system", "leadership", "teacher", "guest", "visitor"}:
        raise HTTPException(status_code=400, detail="مستوى غير معروف")
    allowed = {item["id"] for item in _WINDOWS}
    windows = {key: bool(value) for key, value in (body.windows or {}).items() if key in allowed}
    connection = connect()
    try:
        _ensure(connection)
        staff = connection.execute(
            "SELECT national_id FROM noor_staff WHERE national_id = ?",
            (identity,),
        ).fetchone()
        if not staff:
            raise HTTPException(status_code=400, detail="المنسوب غير موجود في السجل")
        connection.execute(
            """
            INSERT INTO user_window_permissions (national_id, level, windows, is_disabled)
            VALUES (?, ?, ?, 0)
            ON CONFLICT(national_id) DO UPDATE SET level=excluded.level, windows=excluded.windows
            """,
            (identity, level, json.dumps(windows, ensure_ascii=False)),
        )
        if level == "visitor":
            connection.execute(
                "UPDATE users SET role = 'visitor' WHERE national_id = ?",
                (identity,),
            )
        else:
            staff_role = connection.execute(
                "SELECT role FROM noor_staff WHERE national_id = ?",
                (identity,),
            ).fetchone()
            current_user = connection.execute(
                "SELECT role FROM users WHERE national_id = ?",
                (identity,),
            ).fetchone()
            current_role = str(current_user[0] if current_user else "")
            if current_role in {"visitor", "مشرف زائر"} and staff_role:
                connection.execute(
                    "UPDATE users SET role = ? WHERE national_id = ?",
                    (staff_role[0] or "", identity),
                )
        connection.commit()
        return {"ok": True, "national_id": identity, "level": level, "windows": windows}
    finally:
        connection.close()


@router.get("/api/session/accounts")
def list_accounts(x_session_token: str = Header(default="")):
    _require_principal(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        connection.commit()
        rows = connection.execute(
            """
            SELECT u.national_id, s.name,
                   CASE WHEN u.role IN ('visitor', 'مشرف زائر') THEN 'مشرف زائر'
                        ELSE COALESCE(s.role, u.role) END,
                   CASE WHEN u.password_hash IS NULL OR trim(u.password_hash) = '' THEN 0 ELSE 1 END,
                   COALESCE(u.is_active, 1)
            FROM users u
            LEFT JOIN noor_staff s ON s.national_id = u.national_id
            ORDER BY s.name, u.national_id
            """
        ).fetchall()
        return {
            "items": [
                {
                    "national_id": row[0],
                    "name": row[1] or "",
                    "role": row[2] or "",
                    "has_password": bool(row[3]),
                    "is_active": bool(row[4]),
                }
                for row in rows
            ]
        }
    finally:
        connection.close()


@router.post("/api/session/accounts/active")
def set_account_active(body: AccountActiveBody, x_session_token: str = Header(default="")):
    user = _require_principal(x_session_token)
    identity = body.national_id.strip()
    if not identity:
        raise HTTPException(status_code=400, detail="رقم الهوية مطلوب")
    if identity == user.get("id") and not body.is_active:
        raise HTTPException(status_code=400, detail="لا يوقف المدير حسابه أثناء الجلسة")
    connection = connect()
    try:
        _ensure(connection)
        row = connection.execute("SELECT national_id FROM users WHERE national_id = ?", (identity,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="الحساب غير موجود")
        connection.execute(
            "UPDATE users SET is_active = ? WHERE national_id = ?",
            (1 if body.is_active else 0, identity),
        )
        connection.commit()
        return {"ok": True, "national_id": identity, "is_active": bool(body.is_active)}
    finally:
        connection.close()


@router.get("/api/session/backups/{name}/file")
def download_backup(name: str, x_session_token: str = Header(default="")):
    from .access import BACKUP_NAME, _backup_path

    _require_principal(x_session_token)
    filename = str(name or "").strip()
    if not BACKUP_NAME.match(filename):
        raise HTTPException(status_code=400, detail="اسم النسخة غير صالح")
    try:
        path = _backup_path(filename)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if not path.is_file():
        raise HTTPException(status_code=404, detail="النسخة غير موجودة")
    return FileResponse(path, media_type="application/octet-stream", filename=filename)
