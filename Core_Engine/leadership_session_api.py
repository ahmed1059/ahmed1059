# مسار التشكيل القيادي المحمي بالجلسة — ملف جديد معزول.
# يخزّن أرقام الهوية فقط. لا يكتب chair_name ولا يلمس /api/settings.

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .database import connect
from .session_signature_api import SIGNATURES_DIR, _file_to_data_url

router = APIRouter(tags=["session-leadership"])

_SINGLE_ROLES = (
    "manager",
    "school_affairs_agent",
    "activity_leader",
    "educational_supervisor",
    "safety_supervisor",
    "librarian",
    "lab_tech",
)
_LIST_ROLES = (
    "education_agents",
    "student_agents",
    "counselors",
)


class LeadershipBody(BaseModel):
    """أرقام الهوية لكل دور. الاسم يُقرأ لاحقًا من سجل المنسوبين."""

    manager: str = ""
    school_affairs_agent: str = ""
    education_agents: list[str] = []
    student_agents: list[str] = []
    counselors: list[str] = []
    activity_leader: str = ""
    educational_supervisor: str = ""
    safety_supervisor: str = ""
    librarian: str = ""
    lab_tech: str = ""


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


def _ensure(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS leadership_seat (
            role TEXT NOT NULL,
            national_id TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (role, sort_order)
        )
        """
    )


def _clean_ids(values) -> list[str]:
    seen = []
    for value in values or []:
        text = str(value or "").strip()
        if text and text not in seen:
            seen.append(text)
    return seen


def _read(connection) -> dict:
    rows = connection.execute(
        """
        SELECT role, national_id
        FROM leadership_seat
        ORDER BY role, sort_order
        """
    ).fetchall()
    payload = {
        "manager": "",
        "school_affairs_agent": "",
        "education_agents": [],
        "student_agents": [],
        "counselors": [],
        "activity_leader": "",
        "educational_supervisor": "",
        "safety_supervisor": "",
        "librarian": "",
        "lab_tech": "",
    }
    for role, national_id in rows:
        identity = str(national_id or "").strip()
        if not identity:
            continue
        if role == "counselor":
            payload["counselors"].append(identity)
        elif role in _LIST_ROLES:
            payload[role].append(identity)
        elif role in _SINGLE_ROLES and not payload[role]:
            payload[role] = identity
    return payload


def _known_ids(connection) -> set[str]:
    rows = connection.execute(
        "SELECT national_id FROM noor_staff WHERE COALESCE(is_deleted, 0) = 0"
    ).fetchall()
    return {str(row[0]).strip() for row in rows if row[0]}


@router.get("/api/session/leadership")
def get_session_leadership(x_session_token: str = Header(default="")):
    """يعيد أرقام الهوية المحفوظة لكل دور قيادي."""
    _require_user(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        connection.commit()
        return _read(connection)
    finally:
        connection.close()


@router.post("/api/session/leadership")
def save_session_leadership(body: LeadershipBody, x_session_token: str = Header(default="")):
    """يستبدل مقاعد التشكيل بأرقام الهوية المرسلة بعد التحقق من السجل."""
    user = _require_user(x_session_token)
    seats = {
        "manager": _clean_ids([body.manager])[:1],
        "school_affairs_agent": _clean_ids([body.school_affairs_agent])[:1],
        "education_agents": _clean_ids(body.education_agents),
        "student_agents": _clean_ids(body.student_agents),
        "counselors": _clean_ids(body.counselors),
        "activity_leader": _clean_ids([body.activity_leader])[:1],
        "educational_supervisor": _clean_ids([body.educational_supervisor])[:1],
        "safety_supervisor": _clean_ids([body.safety_supervisor])[:1],
        "librarian": _clean_ids([body.librarian])[:1],
        "lab_tech": _clean_ids([body.lab_tech])[:1],
    }
    connection = connect()
    try:
        _ensure(connection)
        known = _known_ids(connection)
        for identities in seats.values():
            for identity in identities:
                if identity not in known:
                    raise HTTPException(status_code=400, detail="رقم الهوية غير موجود في سجل المنسوبين")
        moment = _stamp()
        connection.execute("DELETE FROM leadership_seat")
        for role, identities in seats.items():
            for index, identity in enumerate(identities):
                connection.execute(
                    """
                    INSERT INTO leadership_seat (role, national_id, sort_order, updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (role, identity, index, moment),
                )
        from .audit_log import log_action

        filled = sum(len(items) for items in seats.values())
        log_action(
            user.get("id") or "",
            "تحديث التشكيل",
            "leadership_seat",
            "formation",
            "",
            str(filled),
            connection,
        )
        connection.commit()
        return _read(connection)
    finally:
        connection.close()


def _seat_ids(payload: dict) -> list[str]:
    ids = []
    for key in (
        "manager",
        "school_affairs_agent",
        "activity_leader",
        "educational_supervisor",
        "safety_supervisor",
        "librarian",
        "lab_tech",
    ):
        if payload.get(key):
            ids.append(payload[key])
    for key in ("education_agents", "student_agents", "counselors"):
        ids.extend(payload.get(key) or [])
    return _clean_ids(ids)


@router.get("/api/session/leadership/signatures")
def get_leadership_signatures(x_session_token: str = Header(default="")):
    """يعيد توقيعات أصحاب مقاعد التشكيل من ملف كل هوية. الغائب لا يُستبدل بتوقيع دور."""
    _require_user(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        payload = _read(connection)
    finally:
        connection.close()
    images = {}
    for identity in _seat_ids(payload):
        path = SIGNATURES_DIR / ("sig_" + identity + ".png")
        if not path.is_file():
            continue
        data_url = _file_to_data_url(path)
        if data_url:
            images[identity] = data_url
    return {"signatures": images}
