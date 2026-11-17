# سلة المهملات وسجل التدقيق واستطلاع الأحداث. للمدير حيث يلزم. قرار 292 و295.

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .access import require_principal, require_user
from .database import connect
from .retention import SOFT_TABLES, restore, trash_rows

router = APIRouter(tags=["retention"])


def _token(value: str) -> str:
    return str(value or "").strip()


def _user(token: str) -> dict:
    try:
        return require_user(_token(token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _principal(token: str) -> dict:
    try:
        return require_principal(_token(token))
    except PermissionError as error:
        message = str(error)
        status = 401 if message == "لا جلسة" else 403
        raise HTTPException(status_code=status, detail=message) from error


class RestoreBody(BaseModel):
    table: str
    record_id: str


@router.get("/api/session/trash")
def list_trash(x_session_token: str = Header(default="")):
    """الصفوف المخفية. المدير فقط."""
    _principal(x_session_token)
    connection = connect()
    try:
        items = trash_rows(connection)
    finally:
        connection.close()
    return {"items": items}


@router.post("/api/session/trash/restore")
def restore_trash(body: RestoreBody, x_session_token: str = Header(default="")):
    """يعيد صفاً مخفياً. لا يحذف شيئاً."""
    user = _principal(x_session_token)
    table = str(body.table or "").strip()
    record_id = str(body.record_id or "").strip()
    if table not in SOFT_TABLES or not record_id:
        raise HTTPException(status_code=400, detail="الجدول أو المعرّف غير صالح")
    connection = connect()
    try:
        changed = restore(connection, table, record_id, str(user.get("id") or ""))
        connection.commit()
    finally:
        connection.close()
    if not changed:
        raise HTTPException(status_code=404, detail="السجل غير موجود في السلة")
    return {"restored": True, "table": table}


@router.delete("/api/session/students/{national_id}")
def hide_student(national_id: str, x_session_token: str = Header(default="")):
    """يخفي طالباً من القوائم. الصف يبقى للاستعادة."""
    from .retention import hide

    user = _principal(x_session_token)
    identity = str(national_id or "").strip()
    connection = connect()
    try:
        row = connection.execute(
            "SELECT name FROM noor_students WHERE national_id = ?",
            (identity,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="الطالب غير موجود")
        changed = hide(connection, "noor_students", identity, str(user.get("id") or ""), str(row[0] or ""))
        connection.commit()
    finally:
        connection.close()
    if not changed:
        raise HTTPException(status_code=404, detail="الطالب مخفي مسبقاً")
    return {"hidden": True}


@router.get("/api/session/audit-logs")
def list_audit(x_session_token: str = Header(default="")):
    """آخر السجلات. الاسم يُعرض بدل رقم الهوية. المدير فقط."""
    _principal(x_session_token)
    connection = connect()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY,
                user_id TEXT,
                action TEXT NOT NULL,
                table_name TEXT,
                record_id TEXT,
                old_value TEXT,
                new_value TEXT,
                timestamp TEXT NOT NULL
            )
            """
        )
        rows = connection.execute(
            """
            SELECT a.id, a.action, a.table_name, a.old_value, a.new_value, a.timestamp,
                   COALESCE(u.name, '')
            FROM audit_logs a
            LEFT JOIN users u ON u.national_id = a.user_id
            ORDER BY a.id DESC
            LIMIT 200
            """
        ).fetchall()
    finally:
        connection.close()
    return {
        "items": [
            {
                "id": row[0],
                "action": row[1] or "",
                "table_name": row[2] or "",
                "detail": (row[3] or row[4] or ""),
                "timestamp": row[5] or "",
                "user_name": row[6] or "النظام",
            }
            for row in rows
        ]
    }


@router.get("/api/session/events")
def poll_events(after: int = 0, x_session_token: str = Header(default="")):
    """بديل القراءة حين لا يتصل WebSocket. قرار 294."""
    _user(x_session_token)
    from .event_bus import since

    return since(after)


@router.get("/api/session/disk")
def disk_status(x_session_token: str = Header(default="")):
    """نسبة المساحة الحرة. التنبيه يُنشر في الناقل إن قلت عن 10%."""
    _user(x_session_token)
    from .disk_watch import publish_if_low

    return publish_if_low()
