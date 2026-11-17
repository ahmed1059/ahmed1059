# قوالب البرامج وحفظ المسودة — ملف جديد معزول.
# لا يغيّر POST /api/programs ولا مسار اعتماد المدير.

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["session-programs"])


class ProgramDraftBody(BaseModel):
    """مسودة برنامج. الحقول تطابق حفظ البرامج القديم، والحالة تُجبر على مسودة."""

    program_name: str = ""
    strategic_goal: str = ""
    executive_goal: str = ""
    target_audience: str = ""
    duration: str = ""
    implementers: str = ""
    budget: str = ""
    mechanism: str = ""
    success_indicator: str = ""
    risk_management: str = ""
    register_id: int = 0
    owner_role: str = ""
    owner_roles: list[str] = []
    indicator_ids: list[int] = []
    indicator_codes: list[str] = []
    baseline_value: str = ""
    target_value: str = ""
    current_value: str = ""
    unit: str = ""
    kpi_description: str = ""
    goal_ref: str = ""
    domain: str = ""
    level_name: str = ""
    duty_ref: str = ""
    task_ref: str = ""
    assignee_staff_id: str = ""
    id: int = 0
    status: str = "مسودة"


def _token(x_session_token: str) -> str:
    return str(x_session_token or "").strip()


def _require_user(x_session_token: str) -> dict:
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _program_board_status(raw_status, evidence_count):
    """اشتقاق العرض: مسودة / قيد التنفيذ / مكتمل. لا يكتب في العمود."""
    status = str(raw_status or "").strip() or "مسودة"
    has_evidence = int(evidence_count or 0) > 0
    if status == "مسودة":
        return "draft", "مسودة"
    if status in ("معتمد", "معتمدة", "قيد التنفيذ", "مكتمل"):
        if has_evidence:
            return "done", "مكتمل"
        return "in_progress", "قيد التنفيذ"
    return "", status


@router.get("/api/session/program-board")
def session_program_board(x_session_token: str = Header(default="")):
    """لوحة حالة البرامج: قراءة فقط مع وجود الشاهد بمفتاح program-{id}."""
    _require_user(x_session_token)
    from .database import connect
    from .program_registry import OWNER_LABELS, _roles_from_cell
    from .visual_evidence import ensure_visual_evidence_table

    connection = connect()
    try:
        ensure_visual_evidence_table(connection)
        rows = connection.execute(
            """
            SELECT p.id, p.program_name, p.status, p.owner_role, p.owner_roles,
                   COUNT(v.id) AS evidence_count
            FROM school_programs p
            LEFT JOIN visual_evidence v
              ON v.entity_type = 'program'
             AND v.entity_key = 'program-' || p.id
            GROUP BY p.id, p.program_name, p.status, p.owner_role, p.owner_roles
            ORDER BY p.id
            """
        ).fetchall()
    finally:
        connection.close()
    items = []
    counts = {"all": 0, "draft": 0, "in_progress": 0, "done": 0}
    for row in rows:
        roles = _roles_from_cell(row[4] if len(row) > 4 else "", str(row[3] or ""))
        owner_label = "، ".join(OWNER_LABELS.get(role, "") for role in roles)
        evidence_count = int(row[5] or 0)
        display_status, display_label = _program_board_status(row[2], evidence_count)
        counts["all"] += 1
        if display_status in counts:
            counts[display_status] += 1
        items.append(
            {
                "id": row[0],
                "program_name": str(row[1] or "").strip(),
                "status": str(row[2] or "").strip() or "مسودة",
                "display_status": display_status or "other",
                "display_label": display_label,
                "has_evidence": evidence_count > 0,
                "evidence_count": evidence_count,
                "owner_label": owner_label,
            }
        )
    return {"counts": counts, "items": items}


@router.get("/api/session/program-templates")
def session_program_templates(x_session_token: str = Header(default="")):
    """يعيد القوالب وأسماء السجلات والأدوار لصاحب الجلسة."""
    _require_user(x_session_token)
    from .program_registry import OWNERS, REGISTERS, template_payload

    return {
        "templates": template_payload(),
        "registers": [{"id": number, "label": label} for number, label in REGISTERS],
        "owners": [{"role": role, "label": label} for role, label in OWNERS],
        "units": ["%", "عدد", "نسبة"],
    }


@router.post("/api/session/programs")
def session_save_program(
    body: ProgramDraftBody,
    x_session_token: str = Header(default=""),
):
    """يحفظ مسودة جديدة فقط. لا يحدّث برنامجاً قائماً ولا يمنحه الاعتماد."""
    _require_user(x_session_token)
    from .program_registry import save_program

    body.id = 0
    body.status = "مسودة"
    try:
        save_program(body)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    from .database import connect

    connection = connect()
    try:
        row = connection.execute(
            """
            SELECT id, assignee_staff_id FROM school_programs
            WHERE program_name = ? ORDER BY id DESC LIMIT 1
            """,
            (body.program_name.strip(),),
        ).fetchone()
    finally:
        connection.close()
    return {
        "ok": True,
        "status": "مسودة",
        "id": row[0] if row else 0,
        "assignee_staff_id": str(row[1] or "").strip() if row else "",
    }


@router.post("/api/session/programs/{program_id}")
def session_update_program(
    program_id: int,
    body: ProgramDraftBody,
    x_session_token: str = Header(default=""),
):
    """يحدّث حقول برنامج قائم دون تغيير حالته ودون إنشاء صف جديد."""
    _require_user(x_session_token)
    from .program_registry import save_program

    if int(program_id or 0) < 1:
        raise HTTPException(status_code=400, detail="معرف البرنامج غير صالح")
    body.id = int(program_id)
    body.status = ""
    try:
        save_program(body)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    from .program_registry import list_programs

    for item in list_programs():
        if int(item.get("id") or 0) == int(program_id):
            return {"ok": True, "id": item["id"], "status": item.get("status") or ""}
    raise HTTPException(status_code=404, detail="البرنامج غير موجود")


@router.get("/api/session/programs/{program_id}")
def session_get_program(program_id: int, x_session_token: str = Header(default="")):
    """يعيد برنامجاً محفوظاً للحقول المستقلة بما فيها هوية المكلَّف المجمّدة."""
    _require_user(x_session_token)
    from .program_registry import list_programs

    for item in list_programs():
        if int(item.get("id") or 0) == int(program_id):
            return item
    raise HTTPException(status_code=404, detail="البرنامج غير موجود")
