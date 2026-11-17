# مدقق الروابط — قرار 282. يبلّغ ولا يحذف صفوفاً.

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from .database import connect

router = APIRouter(tags=["consistency"])


def _user(token: str) -> dict:
    from .access import require_user

    try:
        return require_user(str(token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _issues(connection) -> list[dict]:
    issues = []
    leadership = connection.execute(
        """
        SELECT l.role, l.sort_order
        FROM leadership_seat l
        LEFT JOIN noor_staff s
          ON s.national_id = l.national_id AND COALESCE(s.is_deleted, 0) = 0
        WHERE s.national_id IS NULL
        ORDER BY l.role, l.sort_order
        """
    ).fetchall()
    for role, order in leadership:
        issues.append({
            "kind": "leadership",
            "fix": "manual",
            "message": f"مقعد القيادة {role} (ترتيب {order}) لا يطابق منسوباً في السجل.",
        })
    committees = connection.execute(
        """
        SELECT c.committee_id, c.seat, c.sort_order
        FROM committee_seat c
        LEFT JOIN noor_staff s
          ON s.national_id = c.national_id AND COALESCE(s.is_deleted, 0) = 0
        WHERE s.national_id IS NULL
        ORDER BY c.committee_id, c.sort_order
        """
    ).fetchall()
    for committee_id, seat, order in committees:
        issues.append({
            "kind": "committee",
            "fix": "manual",
            "message": f"مقعد اللجنة {committee_id} / {seat} (ترتيب {order}) بلا منسوب مطابق.",
        })
    lessons = connection.execute(
        """
        SELECT t.id, t.day, t.period, t.teacher
        FROM noor_timetable t
        WHERE COALESCE(t.is_deleted, 0) = 0
          AND trim(COALESCE(t.teacher, '')) != ''
          AND NOT EXISTS (
            SELECT 1 FROM noor_staff s
            WHERE s.name = t.teacher AND COALESCE(s.active, 1) = 1
              AND COALESCE(s.is_deleted, 0) = 0
          )
        ORDER BY t.day, t.period
        LIMIT 40
        """
    ).fetchall()
    for lesson_id, day, period, teacher in lessons:
        issues.append({
            "kind": "timetable",
            "fix": "manual",
            "message": f"حصة {day} / {period} باسم «{teacher}» غير مطابقة لسجل المنسوبين.",
            "ref": lesson_id,
        })
    programs = connection.execute(
        """
        SELECT p.id, p.program_name
        FROM school_programs p
        WHERE COALESCE(p.is_deleted, 0) = 0
          AND trim(COALESCE(p.assignee_staff_id, '')) != ''
          AND NOT EXISTS (
            SELECT 1 FROM noor_staff s
            WHERE s.national_id = p.assignee_staff_id
              AND COALESCE(s.is_deleted, 0) = 0
          )
        ORDER BY p.id
        LIMIT 40
        """
    ).fetchall()
    for program_id, name in programs:
        issues.append({
            "kind": "program",
            "fix": "manual",
            "message": f"البرنامج «{name or program_id}» مربوط بهوية لا توجد في سجل المنسوبين.",
        })
    return issues


_ROLE_TO_SEAT = {
    "principal": "manager",
    "vice_teachers": "education_agents",
    "vice_students": "student_agents",
    "student_counselor": "counselors",
    "activity_leader": "activity_leader",
    "librarian": "librarian",
    "lab_tech": "lab_tech",
    "admin_assistant": "school_affairs_agent",
}


@router.get("/api/session/template-context")
def template_context(x_session_token: str = Header(default="")):
    """سياق القالب من الصفوف المحفوظة. قرار 286."""
    _user(x_session_token)
    connection = connect()
    try:
        school = connection.execute(
            """
            SELECT school_name, statistical_number, education_administration
            FROM school_settings WHERE id = 1
            """
        ).fetchone()
        seats = connection.execute(
            """
            SELECT l.role, l.sort_order, s.name
            FROM leadership_seat l
            LEFT JOIN noor_staff s
              ON s.national_id = l.national_id AND COALESCE(s.is_deleted, 0) = 0
            ORDER BY l.role, l.sort_order
            """
        ).fetchall()
        by_role: dict[str, str] = {}
        leadership = []
        for role, order, name in seats:
            leadership.append({"role": role, "sort_order": order, "name": name or ""})
            if role not in by_role and name:
                by_role[role] = name
        programs = []
        for program_id, name, owner_role, assignee in connection.execute(
            """
            SELECT id, program_name, owner_role, assignee_staff_id
            FROM school_programs
            WHERE COALESCE(is_deleted, 0) = 0
            ORDER BY id
            LIMIT 80
            """
        ):
            seat = _ROLE_TO_SEAT.get(owner_role or "")
            owner_name = by_role.get(seat, "") if seat else ""
            if not owner_name and assignee:
                found = connection.execute(
                    "SELECT name FROM noor_staff WHERE national_id = ? AND COALESCE(is_deleted, 0) = 0",
                    (assignee,),
                ).fetchone()
                owner_name = found[0] if found and found[0] else ""
            programs.append({
                "id": program_id,
                "name": name or "",
                "owner_role": owner_role or "",
                "owner_name": owner_name,
                "owner_linked": bool(owner_name) if seat or assignee else True,
            })
        return {
            "school": {
                "name": school[0] if school else "",
                "statistical_number": school[1] if school else "",
                "education_administration": school[2] if school else "",
            },
            "leadership": leadership,
            "programs": programs,
        }
    finally:
        connection.close()


@router.get("/api/session/consistency")
def get_consistency(x_session_token: str = Header(default="")):
    _user(x_session_token)
    connection = connect()
    try:
        issues = _issues(connection)
        return {"ok": not issues, "count": len(issues), "issues": issues}
    finally:
        connection.close()
