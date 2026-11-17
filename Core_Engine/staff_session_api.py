# مسار كتابة المنسوبين المحمي بالجلسة — ملف جديد معزول.
# لا يغيّر /api/noor/staff حتى تبقى الواجهة القديمة.

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .database import connect

router = APIRouter(tags=["session-staff"])


class StaffWriteBody(BaseModel):
    """حفظ منسوب أو تعديله. الحقول تطابق مسار نور القديم."""

    national_id: str
    original_id: str = ""
    name: str = ""
    role: str = ""
    specialty: str = ""
    mobile: str = ""
    active: bool = True


def _token(x_session_token: str) -> str:
    return str(x_session_token or "").strip()


def _stamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _require_user(x_session_token: str) -> dict:
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


@router.post("/api/session/staff")
def save_session_staff(body: StaffWriteBody, x_session_token: str = Header(default="")):
    """يحفظ الاسم والصفة والتخصص بعد جلسة صالحة. التعديل لا ينشئ صفًا إن غاب الرقم."""
    _require_user(x_session_token)
    national_id = body.national_id.strip()
    name = body.name.strip()
    if not national_id or not name:
        raise HTTPException(status_code=400, detail="الاسم ورقم الهوية مطلوبان")
    original = body.original_id.strip() or national_id
    moment = _stamp()
    connection = connect()
    try:
        existing = connection.execute(
            "SELECT national_id FROM noor_staff WHERE national_id = ?",
            (original,),
        ).fetchone()
        occupied = connection.execute(
            "SELECT national_id FROM noor_staff WHERE national_id = ?",
            (national_id,),
        ).fetchone()
        if existing:
            if occupied and original != national_id:
                raise HTTPException(status_code=400, detail="رقم الهوية مستخدم لمنسوب آخر")
            connection.execute(
                """
                UPDATE noor_staff
                SET national_id = ?, name = ?, role = ?, specialty = ?, mobile = ?, active = ?, updated_at = ?, is_deleted = 0
                WHERE national_id = ?
                """,
                (
                    national_id,
                    name,
                    body.role.strip(),
                    body.specialty.strip(),
                    body.mobile.strip(),
                    1 if body.active else 0,
                    moment,
                    original,
                ),
            )
        elif body.original_id.strip():
            raise HTTPException(status_code=404, detail="رقم الهوية غير موجود في السجل")
        elif occupied:
            connection.execute(
                """
                UPDATE noor_staff
                SET name = ?, role = ?, specialty = ?, mobile = ?, active = ?, updated_at = ?, is_deleted = 0
                WHERE national_id = ?
                """,
                (
                    name,
                    body.role.strip(),
                    body.specialty.strip(),
                    body.mobile.strip(),
                    1 if body.active else 0,
                    moment,
                    national_id,
                ),
            )
        else:
            connection.execute(
                """
                INSERT INTO noor_staff (national_id, name, mobile, specialty, role, active, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    national_id,
                    name,
                    body.mobile.strip(),
                    body.specialty.strip(),
                    body.role.strip(),
                    1 if body.active else 0,
                    moment,
                ),
            )
        connection.commit()
    finally:
        connection.close()
    return {"saved": national_id}


@router.delete("/api/session/staff/{national_id}")
def delete_session_staff(national_id: str, x_session_token: str = Header(default="")):
    """يحذف منسوبًا بعد جلسة صالحة."""
    user = _require_user(x_session_token)
    identity = national_id.strip()
    connection = connect()
    try:
        from .retention import hide

        row = connection.execute(
            "SELECT name FROM noor_staff WHERE national_id = ?",
            (identity,),
        ).fetchone()
        hide(connection, "noor_staff", identity, str(user.get("id") or ""), str(row[0] if row else ""))
        connection.commit()
    finally:
        connection.close()
    return {"deleted": identity}
