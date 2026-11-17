# تكليف داخلي (منسق موهوبين). ليس دوراً في OWNERS.

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .database import connect
from .noor_import import stamp

router = APIRouter(tags=["session-assignments"])

ASSIGNMENT_TYPES = {"gifted_coordinator": "منسق موهوبين"}


class AssignmentBody(BaseModel):
    assignment_type: str = "gifted_coordinator"
    staff_id: str = ""
    academic_year: str = ""


def _token(x_session_token: str) -> str:
    return str(x_session_token or "").strip()


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
    if text:
        return text
    from .teacher_deliverables_api import stored_academic_year

    return stored_academic_year()


def _staff_name(connection, staff_id: str) -> str:
    row = connection.execute(
        "SELECT name FROM noor_staff WHERE national_id = ?",
        (staff_id,),
    ).fetchone()
    return str(row[0] or "").strip() if row else ""


def _row_payload(connection, row) -> dict:
    staff_id = str(row[2] or "").strip()
    kind = str(row[1] or "").strip()
    return {
        "id": row[0],
        "assignment_type": kind,
        "assignment_label": ASSIGNMENT_TYPES.get(kind, ""),
        "staff_id": staff_id,
        "staff_name": _staff_name(connection, staff_id),
        "academic_year": str(row[3] or "").strip(),
        "appointed_by": str(row[4] or "").strip(),
        "created_at": str(row[5] or "").strip(),
        "active": bool(row[6]),
    }


@router.get("/api/session/internal-assignments")
def list_assignments(
    assignment_type: str = "",
    academic_year: str = "",
    x_session_token: str = Header(default=""),
):
    """يعيد التكليفات النشطة للعام المحفوظ. الاسم من سجل نور."""
    _require_user(x_session_token)
    year = _year(academic_year)
    kind = str(assignment_type or "").strip()
    connection = connect()
    try:
        if kind:
            rows = connection.execute(
                """
                SELECT id, assignment_type, staff_id, academic_year, appointed_by, created_at, active
                FROM internal_assignments
                WHERE active = 1 AND academic_year = ? AND assignment_type = ?
                ORDER BY id
                """,
                (year, kind),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT id, assignment_type, staff_id, academic_year, appointed_by, created_at, active
                FROM internal_assignments
                WHERE active = 1 AND academic_year = ?
                ORDER BY id
                """,
                (year,),
            ).fetchall()
        items = [_row_payload(connection, row) for row in rows]
    finally:
        connection.close()
    return {"academic_year": year, "items": items}


@router.post("/api/session/internal-assignments")
def save_assignment(body: AssignmentBody, x_session_token: str = Header(default="")):
    """يعين معلماً واحداً نشطاً لكل نوع في العام الدراسي."""
    principal = _require_principal(x_session_token)
    kind = str(body.assignment_type or "").strip() or "gifted_coordinator"
    if kind not in ASSIGNMENT_TYPES:
        raise HTTPException(status_code=400, detail="نوع التكليف غير معروف")
    staff_id = str(body.staff_id or "").strip()
    if not staff_id:
        raise HTTPException(status_code=400, detail="اختر معلماً من سجل المنسوبين")
    year = _year(body.academic_year)
    if not year:
        raise HTTPException(status_code=400, detail="العام الدراسي غير محفوظ")
    connection = connect()
    try:
        staff = connection.execute(
            "SELECT national_id, name FROM noor_staff WHERE national_id = ?",
            (staff_id,),
        ).fetchone()
        if not staff:
            raise HTTPException(status_code=400, detail="المعلم غير موجود في سجل المنسوبين")
        current = connection.execute(
            """
            SELECT id FROM internal_assignments
            WHERE assignment_type = ? AND academic_year = ? AND active = 1
            """,
            (kind, year),
        ).fetchone()
        moment = stamp()
        if current:
            connection.execute(
                """
                UPDATE internal_assignments
                SET staff_id = ?, appointed_by = ?, created_at = ?
                WHERE id = ?
                """,
                (staff_id, principal.get("id") or "", moment, current[0]),
            )
            saved_id = current[0]
        else:
            cursor = connection.execute(
                """
                INSERT INTO internal_assignments (
                    assignment_type, staff_id, academic_year, appointed_by, created_at, active
                ) VALUES (?, ?, ?, ?, ?, 1)
                """,
                (kind, staff_id, year, principal.get("id") or "", moment),
            )
            saved_id = cursor.lastrowid
        connection.commit()
        row = connection.execute(
            """
            SELECT id, assignment_type, staff_id, academic_year, appointed_by, created_at, active
            FROM internal_assignments WHERE id = ?
            """,
            (saved_id,),
        ).fetchone()
        payload = _row_payload(connection, row)
    finally:
        connection.close()
    return {"ok": True, "item": payload}


@router.delete("/api/session/internal-assignments")
def clear_assignment(
    assignment_type: str = "gifted_coordinator",
    academic_year: str = "",
    x_session_token: str = Header(default=""),
):
    """يلغي التكليف النشط للنوع والعام. البرامج المحفوظة لا تُمس."""
    _require_principal(x_session_token)
    kind = str(assignment_type or "").strip() or "gifted_coordinator"
    if kind not in ASSIGNMENT_TYPES:
        raise HTTPException(status_code=400, detail="نوع التكليف غير معروف")
    year = _year(academic_year)
    if not year:
        raise HTTPException(status_code=400, detail="العام الدراسي غير محفوظ")
    connection = connect()
    try:
        connection.execute(
            """
            UPDATE internal_assignments
            SET active = 0
            WHERE assignment_type = ? AND academic_year = ? AND active = 1
            """,
            (kind, year),
        )
        connection.commit()
    finally:
        connection.close()
    return {"ok": True, "assignment_type": kind, "academic_year": year}
