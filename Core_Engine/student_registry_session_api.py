# سجل طلاب المدرسة للعرض والطباعة. المصدر جدول noor_students. الملف المحفوظ لا يُحذف ولا يُعرض.

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from .database import connect

router = APIRouter(tags=["session-student-registry"])


def _token(value: str) -> str:
    return str(value or "").strip()


def _require_user(x_session_token: str) -> dict:
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _year() -> str:
    try:
        from .teacher_deliverables_api import stored_academic_year

        return stored_academic_year() or "1448-1449"
    except Exception:
        return "1448-1449"


def active_student_rows(connection) -> list[dict]:
    rows = connection.execute(
        """
        SELECT national_id, name, grade, classroom, status
        FROM noor_students
        WHERE COALESCE(is_deleted, 0) = 0
        ORDER BY name
        """
    ).fetchall()
    students = []
    for row in rows:
        ident = str(row[0] or "").strip()
        name = str(row[1] or "").strip()
        if not ident and not name:
            continue
        students.append(
            {
                "national_id": ident,
                "name": name,
                "grade": str(row[2] or "").strip(),
                "section": str(row[3] or "").strip(),
                "status": str(row[4] or "").strip(),
            }
        )
    return students


@router.get("/api/session/student-registry")
def list_student_registry(x_session_token: str = Header(default="")):
    """يعيد طلاب جدول نور. لا يقرأ ملف السجل المنفصل."""
    _require_user(x_session_token)
    connection = connect()
    try:
        students = active_student_rows(connection)
    finally:
        connection.close()
    return {
        "year": _year(),
        "count": len(students),
        "source": "noor_students",
        "students": students,
    }


@router.get("/api/session/noor-students")
def list_noor_students(x_session_token: str = Header(default="")):
    """طلاب نور للبحث في قوائم الدعم. الاسم والصف والفصل والهوية."""
    _require_user(x_session_token)
    connection = connect()
    try:
        rows = connection.execute(
            """
            SELECT national_id, name, grade, classroom
            FROM noor_students
            WHERE COALESCE(is_deleted, 0) = 0
              AND TRIM(COALESCE(name, '')) != ''
            ORDER BY name
            """
        ).fetchall()
    finally:
        connection.close()
    students = [
        {
            "national_id": str(row[0] or "").strip(),
            "name": str(row[1] or "").strip(),
            "grade": str(row[2] or "").strip(),
            "classroom": str(row[3] or "").strip(),
        }
        for row in rows
        if str(row[0] or "").strip() and str(row[1] or "").strip()
    ]
    return {"count": len(students), "students": students}
