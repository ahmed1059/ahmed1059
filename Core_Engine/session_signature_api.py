# مسار توقيع الجلسة — ملف جديد معزول (قرار قشرة الرحلة 2026-11-03)
# التخزين في School_Data/signatures (خارج Static لـ Print_Canvas).
# لا يُعدّل جداول غير users.signature_path، ولا يمس مسارات ERP القديمة.

from __future__ import annotations

import base64
import re
import sqlite3
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect

_ROOT = Path(__file__).resolve().parent.parent
SCHOOL_DATA = _ROOT / "School_Data"
SIGNATURES_DIR = SCHOOL_DATA / "signatures"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
MAX_PNG_BYTES = 500 * 1024
DATA_URL_RE = re.compile(r"^data:image/png;base64,(.+)$", re.IGNORECASE | re.DOTALL)

router = APIRouter(tags=["session-signature"])

_column_ready = False


class SignatureBody(BaseModel):
    """توقيع المستخدم بصيغة PNG Base64 (مع أو بلا بادئة data URL)."""

    signature: str = Field(default="", min_length=1)


def _token(x_session_token: str) -> str:
    return str(x_session_token or "").strip()


def ensure_signature_column(connection: sqlite3.Connection | None = None) -> None:
    """Migration بسيط: يضيف users.signature_path إن لم يوجد. آمن ضد التنفيذ المزدوج."""
    global _column_ready
    if _column_ready and connection is None:
        return
    own = connection is None
    if own:
        connection = connect()
    try:
        columns = {
            str(row[1])
            for row in connection.execute("PRAGMA table_info(users)").fetchall()
        }
        if "signature_path" in columns:
            _column_ready = True
            return
        try:
            connection.execute("ALTER TABLE users ADD COLUMN signature_path TEXT")
            connection.commit()
        except sqlite3.OperationalError as error:
            # عمود موجود مسبقاً أو تنفيذ مزدوج متزامن
            message = str(error).lower()
            if "duplicate column" not in message and "already exists" not in message:
                raise
        _column_ready = True
    finally:
        if own:
            connection.close()


def get_user_signature_path(national_id: str) -> str:
    """يعيد اسم الملف المحفوظ (داخل School_Data/signatures) أو سلسلة فارغة."""
    user_id = str(national_id or "").strip()
    if not user_id:
        return ""
    ensure_signature_column()
    connection = connect()
    try:
        row = connection.execute(
            "SELECT signature_path FROM users WHERE national_id = ?",
            (user_id,),
        ).fetchone()
    finally:
        connection.close()
    if not row:
        return ""
    return str(row[0] or "").strip()


def _safe_filename(user_id: str) -> str:
    safe_id = re.sub(r"[^0-9A-Za-z_-]+", "", str(user_id))
    if not safe_id:
        raise ValueError("معرّف المستخدم غير صالح")
    return f"sig_{safe_id}.png"


def _absolute_path(filename: str) -> Path:
    name = Path(str(filename or "")).name
    if not name or not name.startswith("sig_") or not name.endswith(".png"):
        raise ValueError("مسار التوقيع غير صالح")
    primary = SIGNATURES_DIR / name
    if primary.is_file():
        return primary
    # ترحيل صامت من المسار القديم تحت Print_Canvas إن وُجد
    legacy = _ROOT / "Print_Canvas" / "signatures" / name
    if legacy.is_file():
        SIGNATURES_DIR.mkdir(parents=True, exist_ok=True)
        primary.write_bytes(legacy.read_bytes())
        return primary
    return primary


def _decode_png_base64(raw: str) -> bytes:
    text = str(raw or "").strip()
    if not text:
        raise ValueError("التوقيع مطلوب")
    match = DATA_URL_RE.match(text)
    payload = match.group(1) if match else text
    payload = re.sub(r"\s+", "", payload)
    try:
        binary = base64.b64decode(payload, validate=True)
    except Exception as error:
        raise ValueError("صيغة Base64 غير صالحة") from error
    if len(binary) > MAX_PNG_BYTES:
        raise ValueError("حجم التوقيع يتجاوز 500KB")
    if len(binary) < 8 or binary[:8] != PNG_MAGIC:
        raise ValueError("يُقبل توقيع PNG فقط")
    return binary


def _file_to_data_url(path: Path) -> str:
    if not path.is_file():
        return ""
    binary = path.read_bytes()
    if len(binary) < 8 or binary[:8] != PNG_MAGIC:
        return ""
    encoded = base64.b64encode(binary).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def read_user_signature_data_url(national_id: str) -> str:
    """يقرأ ملف التوقيع الخاص بالمستخدم فقط ويعيده كـ data URL."""
    filename = get_user_signature_path(national_id)
    if not filename:
        return ""
    try:
        return _file_to_data_url(_absolute_path(filename))
    except ValueError:
        return ""


def save_user_signature(national_id: str, signature_raw: str) -> dict:
    """يحفظ PNG في School_Data/signatures ويحدّث users.signature_path."""
    user_id = str(national_id or "").strip()
    if not user_id:
        raise ValueError("لا جلسة")
    binary = _decode_png_base64(signature_raw)
    filename = _safe_filename(user_id)
    SIGNATURES_DIR.mkdir(parents=True, exist_ok=True)
    target = SIGNATURES_DIR / filename
    target.write_bytes(binary)

    ensure_signature_column()
    connection = connect()
    try:
        existing = connection.execute(
            "SELECT national_id FROM users WHERE national_id = ?",
            (user_id,),
        ).fetchone()
        if not existing:
            raise ValueError("المستخدم غير موجود")
        connection.execute(
            "UPDATE users SET signature_path = ? WHERE national_id = ?",
            (filename, user_id),
        )
        connection.commit()
    finally:
        connection.close()
    return {
        "ok": True,
        "signature_path": filename,
        "signature_data_url": _file_to_data_url(target),
        "bytes": len(binary),
    }


@router.get("/api/session/signatures")
def get_signatures_by_ids(ids: str = "", x_session_token: str = Header(default="")):
    """يعيد توقيعات الهويات المطلوبة من sig_{id}.png فقط. الغائب يبقى فارغاً. بلا احتياطي دور."""
    from .access import require_user

    try:
        require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    images = {}
    seen = []
    for raw in str(ids or "").split(","):
        identity = re.sub(r"[^0-9]", "", str(raw or "").strip())
        if not identity or identity in seen:
            continue
        seen.append(identity)
        if len(seen) > 24:
            break
        path = SIGNATURES_DIR / f"sig_{identity}.png"
        if not path.is_file():
            continue
        data_url = _file_to_data_url(path)
        if data_url:
            images[identity] = data_url
    return {"signatures": images}


@router.get("/api/session/signature")
def get_session_signature(x_session_token: str = Header(default="")):
    """يعيد توقيع المستخدم الحالي فقط (data URL) — لا مسار static عام."""
    from .access import require_user

    try:
        user = require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    path = get_user_signature_path(user["id"])
    data_url = read_user_signature_data_url(user["id"]) if path else ""
    return {
        "id": user["id"],
        "name": user.get("name") or "",
        "signature_path": path,
        "has_signature": bool(path and data_url),
        "signature_data_url": data_url,
    }


@router.post("/api/session/signature")
def post_session_signature(
    body: SignatureBody,
    x_session_token: str = Header(default=""),
):
    """يحفظ توقيع PNG للمستخدم الحالي من الجلسة فقط (لا يقبل هوية مستهدف أخرى)."""
    from .access import require_user

    try:
        user = require_user(_token(x_session_token))
        result = save_user_signature(user["id"], body.signature)
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {
        "ok": True,
        "id": user["id"],
        "name": user.get("name") or "",
        "signature_path": result["signature_path"],
        "signature_data_url": result["signature_data_url"],
        "bytes": result["bytes"],
    }
