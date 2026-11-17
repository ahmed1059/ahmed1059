# تشكيل اللجان من سجل المنسوبين. الاعتماد على المدير والوكلاء بعد التوقيع.
from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .database import connect

router = APIRouter(tags=["session-committees"])

COMMITTEES = (
    ("admin", "اللجنة الإدارية"),
    ("guidance", "لجنة التوجيه والإرشاد"),
    ("achievement", "لجنة التحصيل الدراسي"),
    ("excellence", "لجنة التميز"),
    ("fund", "فريق الصندوق المدرسي"),
    ("budget", "لجنة الميزانية التشغيلية"),
    ("safety", "فريق الأمن والسلامة المدرسية"),
    ("activity", "لجنة النشاط والمناسبات"),
    ("discipline", "لجنة الانضباط والتدخل السريع"),
    ("special", "فريق التربية الخاصة"),
)

OWNER_TO_COMMITTEE = {
    "activity_leader": "activity",
    "student_counselor": "guidance",
}


def _token(value: str) -> str:
    return str(value or "").strip()


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


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


def _is_leader(role: str) -> bool:
    text = str(role or "").strip()
    return text.startswith("مدير") or text.startswith("وكيل")


def _is_teacher(role: str) -> bool:
    return "معلم" in str(role or "")


def _ensure(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS committee_seat (
            committee_id TEXT NOT NULL,
            national_id TEXT NOT NULL,
            seat TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            PRIMARY KEY (committee_id, national_id)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS committee_meta (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            formation_stamp TEXT NOT NULL,
            drawn_at TEXT NOT NULL,
            drawn_by TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS committee_approval (
            national_id TEXT NOT NULL,
            formation_stamp TEXT NOT NULL,
            approved_at TEXT NOT NULL,
            PRIMARY KEY (national_id, formation_stamp)
        )
        """
    )


def _staff_map(connection) -> dict:
    rows = connection.execute(
        "SELECT national_id, name, role FROM noor_staff WHERE national_id IS NOT NULL AND trim(national_id) != ''"
    ).fetchall()
    out = {}
    for identity, name, role in rows:
        out[str(identity).strip()] = {
            "national_id": str(identity).strip(),
            "name": str(name or "").strip(),
            "role": str(role or "").strip(),
        }
    return out


def _leadership_ids(connection) -> dict:
    try:
        rows = connection.execute(
            "SELECT role, national_id, sort_order FROM leadership_seat ORDER BY role, sort_order"
        ).fetchall()
    except Exception:
        return {}
    seats = {
        "manager": "",
        "education": "",
        "students": "",
        "counselor": "",
        "activity": "",
    }
    for role, identity, _order in rows:
        ident = str(identity or "").strip()
        if role == "manager" and ident and not seats["manager"]:
            seats["manager"] = ident
        elif role == "education_agents" and ident and not seats["education"]:
            seats["education"] = ident
        elif role == "student_agents" and ident and not seats["students"]:
            seats["students"] = ident
        elif role == "counselors" and ident and not seats["counselor"]:
            seats["counselor"] = ident
        elif role == "activity_leader" and ident and not seats["activity"]:
            seats["activity"] = ident
    return seats


def _has_signature(national_id: str) -> bool:
    from pathlib import Path

    root = Path(__file__).resolve().parents[1] / "School_Data" / "signatures"
    return (root / ("sig_" + national_id + ".png")).is_file()


def _seat_rows(connection) -> list:
    return connection.execute(
        "SELECT committee_id, national_id, seat, sort_order FROM committee_seat ORDER BY committee_id, sort_order"
    ).fetchall()


def _stamp_of(rows) -> str:
    payload = [{"c": r[0], "id": r[1], "s": r[2], "o": r[3]} for r in rows]
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def _meta(connection) -> dict:
    row = connection.execute(
        "SELECT formation_stamp, drawn_at, drawn_by FROM committee_meta WHERE id = 1"
    ).fetchone()
    if not row:
        return {"formation_stamp": "", "drawn_at": "", "drawn_by": ""}
    return {"formation_stamp": row[0] or "", "drawn_at": row[1] or "", "drawn_by": row[2] or ""}


def _required_approvers(connection) -> list[str]:
    seats = _leadership_ids(connection)
    ordered = []
    for key in ("manager", "education", "students"):
        ident = seats.get(key) or ""
        if ident and ident not in ordered:
            ordered.append(ident)
    if not ordered:
        principal = connection.execute(
            """
            SELECT national_id FROM noor_staff
            WHERE role LIKE 'مدير%' AND national_id IS NOT NULL AND trim(national_id) != ''
            LIMIT 1
            """
        ).fetchone()
        if principal:
            ordered.append(str(principal[0]).strip())
    return ordered


def _payload(connection, user: dict) -> dict:
    staff = _staff_map(connection)
    rows = _seat_rows(connection)
    meta = _meta(connection)
    stamp = meta["formation_stamp"] or _stamp_of(rows)
    committees = []
    mine = []
    uid = str(user.get("id") or "").strip()
    for cid, title in COMMITTEES:
        members = []
        for committee_id, ident, seat, order in rows:
            if committee_id != cid:
                continue
            person = staff.get(ident) or {"national_id": ident, "name": "", "role": ""}
            item = {
                "national_id": ident,
                "name": person["name"],
                "role": person["role"],
                "seat": seat,
                "has_signature": _has_signature(ident),
            }
            members.append(item)
            if ident == uid:
                mine.append({"id": cid, "title": title, "seat": seat})
        committees.append({"id": cid, "title": title, "members": members})
    required = _required_approvers(connection)
    approvals = []
    approved_ids = set()
    if stamp:
        for row in connection.execute(
            "SELECT national_id FROM committee_approval WHERE formation_stamp = ?",
            (stamp,),
        ):
            approved_ids.add(str(row[0]).strip())
    for ident in required:
        person = staff.get(ident) or {"name": ""}
        approvals.append({
            "national_id": ident,
            "name": person.get("name") or "",
            "approved": ident in approved_ids,
        })
    role = str(user.get("role") or "")
    is_leader = _is_leader(role)
    is_principal = role.startswith("مدير")
    has_formation = bool(rows)
    my_approved = uid in approved_ids
    needs_draw = is_principal and not has_formation
    needs_wait = is_leader and (not is_principal) and not has_formation
    needs_approval = is_leader and has_formation and not my_approved
    return {
        "committees": committees,
        "my_committees": mine,
        "stamp": stamp,
        "drawn_at": meta["drawn_at"],
        "approvals": approvals,
        "is_leader": is_leader,
        "is_principal": is_principal,
        "has_formation": has_formation,
        "needs_draw": needs_draw,
        "needs_wait": needs_wait,
        "needs_approval": needs_approval,
        "needs_committee_action": needs_draw or needs_wait or needs_approval,
    }


def _reserved_chair(cid: str, seats: dict) -> str:
    if cid == "admin":
        return seats.get("manager") or ""
    if cid == "guidance":
        return seats.get("counselor") or ""
    if cid == "activity":
        return seats.get("activity") or ""
    return ""


@router.get("/api/session/committees")
def get_committees(x_session_token: str = Header(default="")):
    user = _require_user(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        connection.commit()
        return _payload(connection, user)
    finally:
        connection.close()


@router.post("/api/session/committees/draw")
def draw_committees(x_session_token: str = Header(default="")):
    user = _require_principal(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        staff = _staff_map(connection)
        lead = _leadership_ids(connection)
        reserved = {lead.get("manager"), lead.get("education"), lead.get("students"), lead.get("counselor"), lead.get("activity")}
        reserved.discard("")
        reserved.discard(None)
        teachers = [
            ident for ident, person in staff.items()
            if _is_teacher(person["role"]) and ident not in reserved
        ]
        if len(teachers) < 3:
            raise HTTPException(status_code=400, detail="عدد المعلمين في السجل غير كافٍ للتشكيل")
        rng = secrets.SystemRandom()
        rng.shuffle(teachers)
        ids = [item[0] for item in COMMITTEES]
        buckets = {cid: [] for cid in ids}
        for index, ident in enumerate(teachers):
            buckets[ids[index % len(ids)]].append(ident)
        connection.execute("DELETE FROM committee_seat")
        connection.execute("DELETE FROM committee_approval")
        inserts = []
        for cid in ids:
            chair = _reserved_chair(cid, lead)
            members = list(buckets[cid])
            if chair and chair in members:
                members = [item for item in members if item != chair]
            order = 0
            if chair:
                inserts.append((cid, chair, "chair", order))
                order += 1
            elif members:
                chair = members.pop(0)
                inserts.append((cid, chair, "chair", order))
                order += 1
            if cid == "admin":
                for ident, seat in (
                    (lead.get("education"), "exofficio"),
                    (lead.get("students"), "exofficio"),
                ):
                    if ident and ident != chair:
                        inserts.append((cid, ident, seat, order))
                        order += 1
            for ident in members:
                if ident == chair:
                    continue
                inserts.append((cid, ident, "member", order))
                order += 1
        connection.executemany(
            "INSERT OR REPLACE INTO committee_seat (committee_id, national_id, seat, sort_order) VALUES (?, ?, ?, ?)",
            inserts,
        )
        rows = _seat_rows(connection)
        stamp = _stamp_of(rows)
        connection.execute("DELETE FROM committee_meta")
        connection.execute(
            "INSERT INTO committee_meta (id, formation_stamp, drawn_at, drawn_by) VALUES (1, ?, ?, ?)",
            (stamp, _now(), user["id"]),
        )
        connection.commit()
        return _payload(connection, user)
    finally:
        connection.close()


class ApproveBody(BaseModel):
    acknowledged: bool = False


@router.post("/api/session/committees/approve")
def approve_committees(body: ApproveBody, x_session_token: str = Header(default="")):
    user = _require_user(x_session_token)
    if not _is_leader(user.get("role") or ""):
        raise HTTPException(status_code=403, detail="اعتماد التشكيل للمدير والوكلاء")
    if not body.acknowledged:
        raise HTTPException(status_code=400, detail="يلزم الإقرار باعتماد التشكيل")
    connection = connect()
    try:
        _ensure(connection)
        rows = _seat_rows(connection)
        if not rows:
            raise HTTPException(status_code=400, detail="لا تشكيل معتمد للعرض. يطلب المدير القرعة أولاً.")
        stamp = _meta(connection)["formation_stamp"] or _stamp_of(rows)
        connection.execute(
            """
            INSERT OR REPLACE INTO committee_approval (national_id, formation_stamp, approved_at)
            VALUES (?, ?, ?)
            """,
            (user["id"], stamp, _now()),
        )
        connection.commit()
        return _payload(connection, user)
    finally:
        connection.close()


class SeatBody(BaseModel):
    committee_id: str
    national_id: str
    seat: str = "member"


def _known_committee(committee_id: str) -> str:
    key = _token(committee_id)
    if key not in {item[0] for item in COMMITTEES}:
        raise HTTPException(status_code=400, detail="اللجنة غير معروفة")
    return key


def _refresh_stamp(connection, user: dict) -> None:
    rows = _seat_rows(connection)
    stamp = _stamp_of(rows)
    meta = _meta(connection)
    connection.execute("DELETE FROM committee_meta WHERE id = 1")
    connection.execute(
        "INSERT INTO committee_meta (id, formation_stamp, drawn_at, drawn_by) VALUES (1, ?, ?, ?)",
        (stamp, meta["drawn_at"] or _now(), meta["drawn_by"] or user["id"]),
    )


@router.post("/api/session/committees/seat")
def add_committee_seat(body: SeatBody, x_session_token: str = Header(default="")):
    """يضيف أو يحدّث مقعداً واحداً دون مس بقية اللجان. قرار 285."""
    user = _require_principal(x_session_token)
    committee_id = _known_committee(body.committee_id)
    national_id = _token(body.national_id)
    seat = _token(body.seat) or "member"
    if not national_id:
        raise HTTPException(status_code=400, detail="اختر منسوباً من السجل")
    connection = connect()
    try:
        _ensure(connection)
        person = connection.execute(
            "SELECT name FROM noor_staff WHERE national_id = ?",
            (national_id,),
        ).fetchone()
        if not person:
            raise HTTPException(status_code=400, detail="المنسوب غير موجود في السجل")
        current = connection.execute(
            "SELECT sort_order FROM committee_seat WHERE committee_id = ? AND national_id = ?",
            (committee_id, national_id),
        ).fetchone()
        if current:
            connection.execute(
                "UPDATE committee_seat SET seat = ? WHERE committee_id = ? AND national_id = ?",
                (seat, committee_id, national_id),
            )
        else:
            order = connection.execute(
                "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM committee_seat WHERE committee_id = ?",
                (committee_id,),
            ).fetchone()[0]
            connection.execute(
                "INSERT INTO committee_seat (committee_id, national_id, seat, sort_order) VALUES (?, ?, ?, ?)",
                (committee_id, national_id, seat, order),
            )
        _refresh_stamp(connection, user)
        connection.commit()
        return _payload(connection, user)
    finally:
        connection.close()


@router.post("/api/session/committees/seat/remove")
def remove_committee_seat(body: SeatBody, x_session_token: str = Header(default="")):
    """يحذف مقعداً واحداً ويُبقي بقية الصفوف. قرار 285."""
    user = _require_principal(x_session_token)
    committee_id = _known_committee(body.committee_id)
    national_id = _token(body.national_id)
    connection = connect()
    try:
        _ensure(connection)
        connection.execute(
            "DELETE FROM committee_seat WHERE committee_id = ? AND national_id = ?",
            (committee_id, national_id),
        )
        _refresh_stamp(connection, user)
        connection.commit()
        return _payload(connection, user)
    finally:
        connection.close()
