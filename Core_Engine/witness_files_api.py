# مرفقات شاهد الكادر: صورة أو PDF. الملفات خارج المسارات العامة.

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .database import connect
from .noor_import import stamp

router = APIRouter(tags=["witness-files"])

_ROOT = Path(__file__).resolve().parents[1]
_DIR = _ROOT / "School_Data" / "witness_files"
_SLOT = "staff-cadre-141"
_ALLOWED = {
    _SLOT,
    "p122-charter", "p122-follow", "p122-council",
    "p126-plan", "p126-log", "p126-visual", "p126-impact",
    "p131-plan", "p131-meetings", "p131-students",
    "p132-plan", "p132-meetings", "p132-messages",
    "p141-formation", "p141-license", "p141-plc",
    "p142-structure", "p142-review",
    "p143-report", "p143-improve", "p143-quality",
}
_MAX_BYTES = 15 * 1024 * 1024
_MAX_FILES = 30
_KINDS = {
    "jpg": {"ext": ".jpg", "media": "image/jpeg", "magic": b"\xff\xd8\xff"},
    "png": {"ext": ".png", "media": "image/png", "magic": b"\x89PNG"},
    "webp": {"ext": ".webp", "media": "image/webp"},
    "pdf": {"ext": ".pdf", "media": "application/pdf", "magic": b"%PDF"},
}


def ensure_witness_files_table(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS witness_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slot TEXT NOT NULL,
            original_name TEXT NOT NULL,
            stored_name TEXT NOT NULL,
            kind TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS witness_license_rows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            person_name TEXT NOT NULL,
            national_id TEXT NOT NULL DEFAULT '',
            license_no TEXT NOT NULL DEFAULT '',
            level_name TEXT NOT NULL DEFAULT '',
            major TEXT NOT NULL DEFAULT '',
            expires_on TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        )
        """
    )


def _require_user(token: str) -> dict:
    from .access import require_user

    try:
        return require_user(str(token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _require_leadership(token: str) -> dict:
    user = _require_user(token)
    role = str(user.get("role") or "")
    if role.startswith("مدير") or "وكيل" in role:
        return user
    raise HTTPException(status_code=403, detail="تعبئة هذا النموذج للمدير والوكيل")


def _kind_of(payload: bytes, filename: str) -> str:
    name = Path(str(filename or "")).name.lower()
    if name.endswith(".pdf") and payload.startswith(b"%PDF"):
        return "pdf"
    if name.endswith((".jpg", ".jpeg")) and payload.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if name.endswith(".png") and payload.startswith(b"\x89PNG"):
        return "png"
    if name.endswith(".webp") and len(payload) >= 12 and payload[8:12] == b"WEBP":
        return "webp"
    raise HTTPException(status_code=400, detail="الملف صورة أو PDF فقط")


def _row(item) -> dict:
    kind = item[3] or ""
    return {
        "id": item[0],
        "original_name": item[2] or "",
        "kind": "image" if kind in {"jpg", "png", "webp"} else "pdf",
        "created_at": item[4] or "",
        "slot": item[1] or "",
    }


def _path(stored_name: str) -> Path:
    name = Path(str(stored_name or "")).name
    return _DIR / name


def _known_slot(slot: str) -> str:
    key = str(slot or "").strip() or _SLOT
    if key not in _ALLOWED:
        raise HTTPException(status_code=400, detail="خانة الشاهد غير معروفة")
    return key


@router.get("/api/session/witness-files")
def list_witness_files(slot: str = "", x_session_token: str = Header(default="")):
    _require_leadership(x_session_token)
    connection = connect()
    try:
        ensure_witness_files_table(connection)
        connection.commit()
        if slot == "bundle":
            keys = [key for key in _ALLOWED if key != _SLOT]
            marks = ",".join("?" for _ in keys)
            rows = connection.execute(
                f"""
                SELECT id, slot, original_name, kind, created_at
                FROM witness_files
                WHERE slot IN ({marks})
                ORDER BY id
                """,
                keys,
            ).fetchall()
        else:
            key = _known_slot(slot)
            rows = connection.execute(
                """
                SELECT id, slot, original_name, kind, created_at
                FROM witness_files
                WHERE slot = ?
                ORDER BY id
                """,
                (key,),
            ).fetchall()
    finally:
        connection.close()
    return {"items": [_row(row) for row in rows]}


@router.post("/api/session/witness-files")
async def upload_witness_file(
    file: UploadFile | None = File(None),
    slot: str = Form(default=""),
    x_session_token: str = Header(default=""),
):
    _require_leadership(x_session_token)
    key = _known_slot(slot)
    limit = _MAX_FILES if key == _SLOT else 4
    if file is None or not file.filename:
        raise HTTPException(status_code=400, detail="اختر ملفًا أو صورة")
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="الملف فارغ")
    if len(payload) > _MAX_BYTES:
        raise HTTPException(status_code=400, detail="حجم الملف لا يتجاوز 15 ميغابايت")
    kind = _kind_of(payload, file.filename)
    stored = uuid.uuid4().hex + _KINDS[kind]["ext"]
    _DIR.mkdir(parents=True, exist_ok=True)
    target = _DIR / stored
    target.write_bytes(payload)
    original = Path(str(file.filename)).name[:180]
    connection = connect()
    try:
        ensure_witness_files_table(connection)
        count = connection.execute(
            "SELECT COUNT(*) FROM witness_files WHERE slot = ?",
            (key,),
        ).fetchone()[0]
        if int(count or 0) >= limit:
            raise HTTPException(status_code=400, detail="بلغ المرفقات حدها")
        connection.execute(
            """
            INSERT INTO witness_files (slot, original_name, stored_name, kind, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (key, original, stored, kind, stamp()),
        )
        connection.commit()
        row = connection.execute(
            """
            SELECT id, slot, original_name, kind, created_at
            FROM witness_files WHERE stored_name = ?
            """,
            (stored,),
        ).fetchone()
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
    return {"ok": True, "item": _row(row)}


@router.get("/api/session/witness-files/{item_id}/file")
def read_witness_file(item_id: int, x_session_token: str = Header(default="")):
    _require_leadership(x_session_token)
    connection = connect()
    try:
        ensure_witness_files_table(connection)
        row = connection.execute(
            "SELECT stored_name, kind, original_name, slot FROM witness_files WHERE id = ?",
            (item_id,),
        ).fetchone()
    finally:
        connection.close()
    if not row or str(row[3] or "") not in _ALLOWED:
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    path = _path(row[0])
    if not path.is_file():
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    media = _KINDS.get(row[1], {}).get("media", "application/octet-stream")
    return FileResponse(path, media_type=media, filename=row[2] or path.name)


@router.delete("/api/session/witness-files/{item_id}")
def delete_witness_file(item_id: int, x_session_token: str = Header(default="")):
    _require_leadership(x_session_token)
    connection = connect()
    stored = ""
    try:
        ensure_witness_files_table(connection)
        row = connection.execute(
            "SELECT stored_name, slot FROM witness_files WHERE id = ?",
            (item_id,),
        ).fetchone()
        if not row or str(row[1] or "") not in _ALLOWED:
            raise HTTPException(status_code=404, detail="الملف غير موجود")
        stored = str(row[0] or "")
        connection.execute(
            "DELETE FROM witness_files WHERE id = ?",
            (item_id,),
        )
        connection.commit()
    finally:
        connection.close()
    path = _path(stored)
    if path.is_file():
        path.unlink()
    return {"ok": True}


class LicenseRowBody(BaseModel):
    person_name: str = ""
    national_id: str = ""
    license_no: str = ""
    level_name: str = ""
    major: str = ""
    expires_on: str = ""


def _clean(value: str, limit: int) -> str:
    return " ".join(str(value or "").split())[:limit]


def _license_row(item) -> dict:
    return {
        "id": item[0],
        "person_name": item[1] or "",
        "national_id": item[2] or "",
        "license_no": item[3] or "",
        "level_name": item[4] or "",
        "major": item[5] or "",
        "expires_on": item[6] or "",
    }


@router.get("/api/session/witness-licenses")
def list_license_rows(x_session_token: str = Header(default="")):
    _require_leadership(x_session_token)
    connection = connect()
    try:
        ensure_witness_files_table(connection)
        connection.commit()
        rows = connection.execute(
            """
            SELECT id, person_name, national_id, license_no, level_name, major, expires_on
            FROM witness_license_rows
            ORDER BY id
            """
        ).fetchall()
    finally:
        connection.close()
    return {"items": [_license_row(row) for row in rows]}


@router.post("/api/session/witness-licenses")
def add_license_row(body: LicenseRowBody, x_session_token: str = Header(default="")):
    _require_leadership(x_session_token)
    name = _clean(body.person_name, 120)
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="اسم صاحب الرخصة مطلوب")
    connection = connect()
    try:
        ensure_witness_files_table(connection)
        count = connection.execute("SELECT COUNT(*) FROM witness_license_rows").fetchone()[0]
        if int(count or 0) >= 40:
            raise HTTPException(status_code=400, detail="بلغ السجل حده")
        connection.execute(
            """
            INSERT INTO witness_license_rows (
                person_name, national_id, license_no, level_name, major, expires_on, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                _clean(body.national_id, 20),
                _clean(body.license_no, 30),
                _clean(body.level_name, 40),
                _clean(body.major, 60),
                _clean(body.expires_on, 20),
                stamp(),
            ),
        )
        connection.commit()
        row = connection.execute(
            """
            SELECT id, person_name, national_id, license_no, level_name, major, expires_on
            FROM witness_license_rows ORDER BY id DESC LIMIT 1
            """
        ).fetchone()
    finally:
        connection.close()
    return {"ok": True, "item": _license_row(row)}


@router.delete("/api/session/witness-licenses/{item_id}")
def delete_license_row(item_id: int, x_session_token: str = Header(default="")):
    _require_leadership(x_session_token)
    connection = connect()
    try:
        ensure_witness_files_table(connection)
        connection.execute("DELETE FROM witness_license_rows WHERE id = ?", (item_id,))
        connection.commit()
    finally:
        connection.close()
    return {"ok": True}
