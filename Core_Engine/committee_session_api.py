# تشكيل اللجان من سجل المنسوبين وبنك النصاب. الاعتماد على المدير والوكلاء بعد التوقيع.
from __future__ import annotations

import hashlib
import json
import secrets
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .database import connect

router = APIRouter(tags=["session-committees"])

COMMITTEES = (
    ("admin", "اللجنة الإدارية"),
    ("guidance", "لجنة التوجيه والإرشاد"),
    ("achievement", "لجنة التحصيل الدراسي"),
    ("excellence", "لجنة التميز"),
    ("fund", "فريق عمل الصندوق المدرسي"),
    ("budget", "لجنة الميزانية التشغيلية"),
    ("safety", "فريق عمل الأمن والسلامة المدرسية"),
    ("activity", "لجنة النشاط الطلابي"),
    ("discipline", "لجنة الانضباط المدرسي"),
    ("special", "لجنة التربية الخاصة"),
)

OWNER_TO_COMMITTEE = {
    "activity_leader": "activity",
    "student_counselor": "guidance",
}

ALLOWED_SEATS = ("chair", "deputy", "secretary", "member", "student", "parent")
LEADERSHIP_SEATS = ("chair", "deputy", "secretary")

STAFF_KEYWORD_MAP = {
    "quality": ["جودة", "تميز"],
    "safety": ["أمن", "سلامة"],
    "treasurer": ["صندوق", "أمين الصندوق"],
    "special_ed": ["تربية خاصة"],
    "admin_assistant": ["مساعد إداري", "مساعد ادارى", "أداري", "اداري"],
    "health": ["موجه صحي", "الصحي", "صحي"],
}

_BANK_CACHE: dict | None = None


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


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _ensure(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS committee_seat (
            committee_id TEXT NOT NULL,
            national_id TEXT NOT NULL,
            seat TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            member_kind TEXT NOT NULL DEFAULT 'staff',
            display_name TEXT NOT NULL DEFAULT '',
            PRIMARY KEY (committee_id, national_id)
        )
        """
    )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(committee_seat)")}
    if "member_kind" not in columns:
        connection.execute(
            "ALTER TABLE committee_seat ADD COLUMN member_kind TEXT NOT NULL DEFAULT 'staff'"
        )
    if "display_name" not in columns:
        connection.execute(
            "ALTER TABLE committee_seat ADD COLUMN display_name TEXT NOT NULL DEFAULT ''"
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


def _load_bank() -> dict:
    """يقرأ بنك اللجان من Print_Canvas/data/committees-bank.json."""
    global _BANK_CACHE
    if _BANK_CACHE is not None:
        return _BANK_CACHE
    path = _repo_root() / "Print_Canvas" / "data" / "committees-bank.json"
    _BANK_CACHE = json.loads(path.read_text(encoding="utf-8"))
    return _BANK_CACHE


def _year_start_iso(connection=None) -> str:
    """بداية الفصل الأول 1448 للمنطقة (مكة/المدينة) من تقويم أم القرى المخزّن."""
    path = _repo_root() / "Print_Canvas" / "data" / "calendar_1448.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        year = data.get("1448") if isinstance(data, dict) else {}
        if not isinstance(year, dict):
            return ""
        for city in ("المدينة المنورة", "مكة المكرمة", "جدة", "الطائف"):
            block = year.get(city) if isinstance(year.get(city), dict) else {}
            sem1 = block.get("1") if isinstance(block.get("1"), dict) else {}
            start = _token(sem1.get("start"))
            if start:
                return start
    except Exception:
        return ""
    return ""


def _staff_map(connection) -> dict:
    rows = connection.execute(
        """
        SELECT national_id, name, role FROM noor_staff
        WHERE national_id IS NOT NULL AND trim(national_id) != ''
          AND COALESCE(is_deleted, 0) = 0
        """
    ).fetchall()
    out = {}
    for identity, name, role in rows:
        out[str(identity).strip()] = {
            "national_id": str(identity).strip(),
            "name": str(name or "").strip(),
            "role": str(role or "").strip(),
        }
    return out


def _student_name(connection, national_id: str) -> str:
    row = connection.execute(
        """
        SELECT name FROM noor_students
        WHERE national_id = ? AND COALESCE(is_deleted, 0) = 0
        """,
        (national_id,),
    ).fetchone()
    return str(row[0] or "").strip() if row else ""


def _staff_role(connection, national_id: str) -> str:
    row = connection.execute(
        "SELECT role FROM noor_staff WHERE national_id = ?",
        (_token(national_id),),
    ).fetchone()
    return str(row[0] or "").strip() if row else ""


def _counselor_ids(connection) -> list[str]:
    """كل الموجهين الطلابيين من السجل (مرجع المدرسة: اثنان)."""
    rows = connection.execute(
        """
        SELECT national_id FROM noor_staff
        WHERE role LIKE '%موجه%طلاب%'
          AND national_id IS NOT NULL AND trim(national_id) != ''
          AND COALESCE(is_deleted, 0) = 0
          AND COALESCE(active, 1) = 1
        ORDER BY name
        """
    ).fetchall()
    return [str(row[0]).strip() for row in rows if str(row[0] or "").strip()]


def _normalize_person_name(value: str) -> str:
    text = str(value or "").strip()
    for token in ("بن", "ابن", "آل"):
        text = text.replace(f" {token} ", " ")
    return " ".join(text.split())


def _excluded_names(connection, exclude: set[str]) -> set[str]:
    names: set[str] = set()
    for ident in exclude:
        if not ident:
            continue
        row = connection.execute(
            "SELECT name FROM noor_staff WHERE national_id = ?",
            (ident,),
        ).fetchone()
        if row and row[0]:
            names.add(_normalize_person_name(row[0]))
    return names


def _other_wakil(connection, exclude: set[str]) -> str:
    """أول وكيل مختلف هويةً واسماً عن المستثنين (يتفادى تكرار سجل نفس الشخص)."""
    blocked_names = _excluded_names(connection, exclude)
    rows = connection.execute(
        """
        SELECT national_id, role, name FROM noor_staff
        WHERE role LIKE '%وكيل%'
          AND national_id IS NOT NULL AND trim(national_id) != ''
          AND COALESCE(is_deleted, 0) = 0
          AND COALESCE(active, 1) = 1
        ORDER BY
          CASE
            WHEN role LIKE '%طلاب%' THEN 0
            WHEN role LIKE '%مدرسي%' THEN 1
            WHEN role = 'وكيل' THEN 2
            ELSE 3
          END,
          name
        """
    ).fetchall()
    for identity, _role, name in rows:
        ident = str(identity or "").strip()
        if not ident or ident in exclude:
            continue
        if _normalize_person_name(name) in blocked_names:
            continue
        return ident
    return ""


def _leadership_ids(connection) -> dict:
    """مقاعد القيادة من leadership_seat مع احتياطي أدوار من noor_staff فقط (بلا أسماء مخترعة)."""
    seats = {
        "manager": "",
        "education": "",
        "students": "",
        "school": "",
        "counselor": "",
        "counselor_2": "",
        "activity": "",
    }
    school_seat_raw = ""
    try:
        rows = connection.execute(
            "SELECT role, national_id, sort_order FROM leadership_seat ORDER BY role, sort_order"
        ).fetchall()
    except Exception:
        rows = []
    for role, identity, _order in rows:
        ident = str(identity or "").strip()
        if not ident:
            continue
        if role == "manager" and not seats["manager"]:
            seats["manager"] = ident
        elif role == "education_agents" and not seats["education"]:
            seats["education"] = ident
        elif role == "student_agents" and not seats["students"]:
            seats["students"] = ident
        elif role in ("school_agents", "school_affairs_agent") and not school_seat_raw:
            school_seat_raw = ident
        elif role == "counselors" and not seats["counselor"]:
            seats["counselor"] = ident
        elif role == "activity_leader" and not seats["activity"]:
            seats["activity"] = ident

    # وكيل الشؤون المدرسية: مقعد القيادة إن كان وكيلاً، وإلا وكيل بوصف مدرسي، وإلا الوكيل الآخر غير التعليمي
    if school_seat_raw and "وكيل" in _staff_role(connection, school_seat_raw):
        seats["school"] = school_seat_raw
    if not seats["school"]:
        fallback = connection.execute(
            """
            SELECT national_id FROM noor_staff
            WHERE role LIKE '%وكيل%' AND role LIKE '%مدرسي%'
              AND national_id IS NOT NULL AND trim(national_id) != ''
              AND COALESCE(is_deleted, 0) = 0
            LIMIT 1
            """
        ).fetchone()
        if fallback:
            seats["school"] = str(fallback[0]).strip()
    if not seats["school"]:
        seats["school"] = _other_wakil(connection, {seats["manager"], seats["education"]})

    if not seats["students"]:
        students = connection.execute(
            """
            SELECT national_id FROM noor_staff
            WHERE role LIKE '%وكيل%' AND role LIKE '%طلاب%'
              AND national_id IS NOT NULL AND trim(national_id) != ''
              AND COALESCE(is_deleted, 0) = 0
            LIMIT 1
            """
        ).fetchone()
        if students:
            seats["students"] = str(students[0]).strip()
    if not seats["students"]:
        seats["students"] = _other_wakil(
            connection, {seats["manager"], seats["education"], seats["school"]}
        ) or seats["school"]

    counselors = _counselor_ids(connection)
    if seats["counselor"] and seats["counselor"] in counselors:
        counselors = [seats["counselor"]] + [c for c in counselors if c != seats["counselor"]]
    if counselors:
        seats["counselor"] = counselors[0]
    if len(counselors) > 1:
        seats["counselor_2"] = counselors[1]

    if not seats["activity"]:
        seats["activity"] = _find_staff_by_keywords(connection, ["رائد النشاط", "رائد نشاط"])

    return seats


def _find_staff_by_keywords(connection, keywords: list[str]) -> str:
    """أول هوية دورها يحتوي أي كلمة من القائمة."""
    cleaned = [_token(item) for item in (keywords or []) if _token(item)]
    if not cleaned:
        return ""
    rows = connection.execute(
        """
        SELECT national_id, role FROM noor_staff
        WHERE national_id IS NOT NULL AND trim(national_id) != ''
          AND COALESCE(is_deleted, 0) = 0
        """
    ).fetchall()
    for identity, role in rows:
        role_text = str(role or "")
        for keyword in cleaned:
            if keyword in role_text:
                return str(identity).strip()
    return ""


def _resolve_source(connection, source: str) -> str:
    key = _token(source)
    if not key:
        return ""
    if key.startswith("leadership."):
        lead_key = key.split(".", 1)[1]
        return _token(_leadership_ids(connection).get(lead_key))
    if key.startswith("staff."):
        staff_key = key.split(".", 1)[1]
        keywords = STAFF_KEYWORD_MAP.get(staff_key) or []
        return _find_staff_by_keywords(connection, keywords)
    return ""


def _has_signature(national_id: str) -> bool:
    root = _repo_root() / "School_Data" / "signatures"
    return (root / ("sig_" + national_id + ".png")).is_file()


def _seat_rows(connection) -> list:
    return connection.execute(
        """
        SELECT committee_id, national_id, seat, sort_order,
               COALESCE(member_kind, 'staff'), COALESCE(display_name, '')
        FROM committee_seat
        ORDER BY committee_id, sort_order
        """
    ).fetchall()


def _stamp_of(rows) -> str:
    payload = [
        {
            "c": r[0],
            "id": r[1],
            "s": r[2],
            "o": r[3],
            "k": r[4] if len(r) > 4 else "staff",
            "n": r[5] if len(r) > 5 else "",
        }
        for r in rows
    ]
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
              AND COALESCE(is_deleted, 0) = 0
            LIMIT 1
            """
        ).fetchone()
        if principal:
            ordered.append(str(principal[0]).strip())
    return ordered


def _committee_title(cid: str, bank: dict | None = None) -> str:
    bank = bank if bank is not None else _load_bank()
    committees = bank.get("committees") if isinstance(bank, dict) else {}
    entry = committees.get(cid) if isinstance(committees, dict) else None
    if isinstance(entry, dict) and _token(entry.get("title")):
        return _token(entry.get("title"))
    for key, title in COMMITTEES:
        if key == cid:
            return title
    return cid


def _seat_sort_key(seat: str, bank: dict | None = None) -> int:
    bank = bank if bank is not None else _load_bank()
    order = bank.get("seat_order") if isinstance(bank, dict) else None
    if not isinstance(order, list):
        order = list(ALLOWED_SEATS)
    try:
        return order.index(seat)
    except ValueError:
        return len(order) + 1


def _fixed_source_ids(connection, committee: dict) -> set[str]:
    ids: set[str] = set()
    quotas = committee.get("quotas") if isinstance(committee, dict) else {}
    fixed = quotas.get("fixed") if isinstance(quotas, dict) else []
    for entry in fixed or []:
        if not isinstance(entry, dict):
            continue
        ident = _resolve_source(connection, entry.get("source") or "")
        if ident:
            ids.add(ident)
    return ids


def _quota_block(connection, cid: str, committee: dict, members: list[dict]) -> dict:
    quotas = committee.get("quotas") if isinstance(committee, dict) else {}
    if not isinstance(quotas, dict):
        quotas = {}
    size = int(committee.get("size") or 0)
    filled = len(members)
    needed: dict[tuple[str, str], int] = defaultdict(int)
    labels: dict[tuple[str, str], str] = {}
    optional_keys: set[tuple[str, str]] = set()

    for entry in quotas.get("fixed") or []:
        if not isinstance(entry, dict):
            continue
        seat = _token(entry.get("seat")) or "member"
        key = (seat, "staff")
        needed[key] += 1
        labels[key] = _token(entry.get("label")) or seat
        if entry.get("optional"):
            optional_keys.add(key)

    for entry in quotas.get("open") or []:
        if not isinstance(entry, dict):
            continue
        seat = _token(entry.get("seat")) or "member"
        kind = _token(entry.get("kind")) or "teacher"
        count = int(entry.get("count") or 0)
        if count <= 0:
            continue
        if kind in ("teacher", "admin"):
            key = (seat, "staff")
        elif kind == "student_or_parent":
            key = (seat, "student_or_parent")
        else:
            key = (seat, kind)
        needed[key] += count
        labels[key] = _token(entry.get("label")) or seat

    have: dict[tuple[str, str], int] = defaultdict(int)
    for member in members:
        seat = _token(member.get("seat"))
        kind = _token(member.get("member_kind")) or "staff"
        if kind in ("student", "parent"):
            have[(seat, kind)] += 1
            have[(seat, "student_or_parent")] += 1
        else:
            have[(seat, "staff")] += 1

    missing = []
    for key, count in needed.items():
        gap = count - have.get(key, 0)
        if gap <= 0:
            continue
        if key in optional_keys and have.get(key, 0) == 0:
            continue
        missing.append(
            {
                "seat": key[0],
                "kind": key[1],
                "label": labels.get(key) or key[0],
                "count": gap,
            }
        )

    return {
        "size": size,
        "filled": filled,
        "complete": len(missing) == 0 and (size <= 0 or filled >= size),
        "missing": missing,
        "badge": f"{filled}/{size}" if size else f"{filled}/0",
    }


def _payload(connection, user: dict) -> dict:
    staff = _staff_map(connection)
    rows = _seat_rows(connection)
    meta = _meta(connection)
    stamp = meta["formation_stamp"] or _stamp_of(rows)
    bank = _load_bank()
    bank_committees = bank.get("committees") if isinstance(bank.get("committees"), dict) else {}
    committees = []
    mine = []
    uid = str(user.get("id") or "").strip()
    for cid, fallback_title in COMMITTEES:
        committee_def = bank_committees.get(cid) if isinstance(bank_committees.get(cid), dict) else {}
        title = _committee_title(cid, bank) or fallback_title
        office_ids = _fixed_source_ids(connection, committee_def)
        members = []
        for committee_id, ident, seat, _order, member_kind, display_name in rows:
            if committee_id != cid:
                continue
            person = staff.get(ident) or {"national_id": ident, "name": "", "role": ""}
            name = _token(display_name) or person.get("name") or ""
            kind = _token(member_kind) or "staff"
            item = {
                "national_id": ident,
                "name": name,
                "role": person.get("role") or "",
                "seat": seat,
                "has_signature": _has_signature(ident) if kind == "staff" else False,
                "member_kind": kind,
                "by_office": ident in office_ids,
                "display_name": name,
            }
            members.append(item)
            if ident == uid:
                mine.append({"id": cid, "title": title, "seat": seat})
        members.sort(key=lambda item: (_seat_sort_key(item.get("seat") or "", bank), item.get("name") or ""))
        committees.append(
            {
                "id": cid,
                "title": title,
                "members": members,
                "quota": _quota_block(connection, cid, committee_def, members),
            }
        )
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
    seat_labels = bank.get("seat_labels") if isinstance(bank.get("seat_labels"), dict) else {}
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
        "bank_meta": {
            "seat_labels": seat_labels,
            "seat_order": bank.get("seat_order") if isinstance(bank.get("seat_order"), list) else list(ALLOWED_SEATS),
            "academic_year": (bank.get("meta") or {}).get("academic_year") if isinstance(bank.get("meta"), dict) else "",
        },
        "decree_date": _year_start_iso(connection),
    }


def _set_seat(
    connection,
    committee_id: str,
    national_id: str,
    seat: str,
    sort_order: int | None = None,
    member_kind: str = "staff",
    display_name: str = "",
) -> bool:
    """يضبط مقعد شخص في لجنة؛ يعيد True إن تغيّر شيء."""
    ident = _token(national_id)
    role = _token(seat) or "member"
    kind = _token(member_kind) or "staff"
    label = _token(display_name)
    if not ident:
        return False
    current = connection.execute(
        """
        SELECT seat, sort_order, COALESCE(member_kind, 'staff'), COALESCE(display_name, '')
        FROM committee_seat
        WHERE committee_id = ? AND national_id = ?
        """,
        (committee_id, ident),
    ).fetchone()
    if current:
        changed = False
        if current[0] != role:
            connection.execute(
                "UPDATE committee_seat SET seat = ? WHERE committee_id = ? AND national_id = ?",
                (role, committee_id, ident),
            )
            changed = True
        if sort_order is not None and int(current[1]) != int(sort_order):
            connection.execute(
                "UPDATE committee_seat SET sort_order = ? WHERE committee_id = ? AND national_id = ?",
                (int(sort_order), committee_id, ident),
            )
            changed = True
        if current[2] != kind:
            connection.execute(
                "UPDATE committee_seat SET member_kind = ? WHERE committee_id = ? AND national_id = ?",
                (kind, committee_id, ident),
            )
            changed = True
        if label and current[3] != label:
            connection.execute(
                "UPDATE committee_seat SET display_name = ? WHERE committee_id = ? AND national_id = ?",
                (label, committee_id, ident),
            )
            changed = True
        return changed
    order = (
        int(sort_order)
        if sort_order is not None
        else connection.execute(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM committee_seat WHERE committee_id = ?",
            (committee_id,),
        ).fetchone()[0]
    )
    connection.execute(
        """
        INSERT INTO committee_seat
            (committee_id, national_id, seat, sort_order, member_kind, display_name)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (committee_id, ident, role, order, kind, label),
    )
    return True


def _demote_conflicts(connection, committee_id: str, seat: str, keep_id: str) -> bool:
    if seat not in LEADERSHIP_SEATS:
        return False
    changed = False
    others = connection.execute(
        """
        SELECT national_id FROM committee_seat
        WHERE committee_id = ? AND seat = ? AND national_id != ?
        """,
        (committee_id, seat, keep_id),
    ).fetchall()
    for (other_id,) in others:
        connection.execute(
            "UPDATE committee_seat SET seat = 'member' WHERE committee_id = ? AND national_id = ?",
            (committee_id, other_id),
        )
        changed = True
    return changed


def _apply_fixed_quotas(connection) -> bool:
    """يجلس المقاعد الثابتة من بنك النصاب (بحكم المنصب) دون اختراع أسماء."""
    bank = _load_bank()
    committees = bank.get("committees") if isinstance(bank.get("committees"), dict) else {}
    staff = _staff_map(connection)
    changed = False
    for cid, committee in committees.items():
        if not isinstance(committee, dict):
            continue
        quotas = committee.get("quotas") if isinstance(committee.get("quotas"), dict) else {}
        for entry in quotas.get("fixed") or []:
            if not isinstance(entry, dict):
                continue
            seat = _token(entry.get("seat")) or "member"
            ident = _resolve_source(connection, entry.get("source") or "")
            if not ident:
                if entry.get("optional"):
                    continue
                continue
            person = staff.get(ident) or {}
            display = _token(person.get("name"))
            if _demote_conflicts(connection, cid, seat, ident):
                changed = True
            if _set_seat(
                connection,
                cid,
                ident,
                seat,
                member_kind="staff",
                display_name=display,
            ):
                changed = True
    return changed


def _pick_from_pool(pool: list[str], used: set[str]) -> str:
    for index, candidate in enumerate(pool):
        if candidate in used:
            continue
        pool.pop(index)
        return candidate
    return ""


@router.get("/api/session/committees")
def get_committees(x_session_token: str = Header(default="")):
    user = _require_user(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        _apply_fixed_quotas(connection)
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
        reserved = {
            lead.get("manager"),
            lead.get("education"),
            lead.get("students"),
            lead.get("school"),
            lead.get("counselor"),
            lead.get("counselor_2"),
            lead.get("activity"),
        }
        reserved.discard("")
        reserved.discard(None)

        bank = _load_bank()
        committees = bank.get("committees") if isinstance(bank.get("committees"), dict) else {}

        connection.execute("DELETE FROM committee_seat")
        connection.execute("DELETE FROM committee_approval")
        _apply_fixed_quotas(connection)

        seated = {str(row[1]).strip() for row in _seat_rows(connection)}
        excluded = set(reserved) | seated

        teachers = [
            ident
            for ident, person in staff.items()
            if _is_teacher(person["role"]) and ident not in excluded
        ]
        admins = [
            ident
            for ident, person in staff.items()
            if (not _is_teacher(person["role"]))
            and (not _is_leader(person["role"]))
            and ident not in excluded
        ]
        if len(teachers) < 3:
            raise HTTPException(status_code=400, detail="عدد المعلمين في السجل غير كافٍ للتشكيل")

        rng = secrets.SystemRandom()
        rng.shuffle(teachers)
        rng.shuffle(admins)

        special_ed = _find_staff_by_keywords(connection, STAFF_KEYWORD_MAP["special_ed"])
        if special_ed and special_ed in teachers:
            teachers.remove(special_ed)
            teachers.insert(0, special_ed)

        teacher_pool = list(teachers)
        admin_pool = list(admins)
        used_global = set(excluded)

        for cid in [item[0] for item in COMMITTEES]:
            committee = committees.get(cid) if isinstance(committees.get(cid), dict) else {}
            quotas = committee.get("quotas") if isinstance(committee.get("quotas"), dict) else {}
            committee_used = {
                str(row[1]).strip()
                for row in connection.execute(
                    "SELECT national_id FROM committee_seat WHERE committee_id = ?",
                    (cid,),
                ).fetchall()
            }
            for entry in quotas.get("open") or []:
                if not isinstance(entry, dict):
                    continue
                kind = _token(entry.get("kind")) or "teacher"
                seat = _token(entry.get("seat")) or "member"
                count = int(entry.get("count") or 0)
                if count <= 0:
                    continue
                if kind in ("student", "parent", "student_or_parent"):
                    continue
                pool = teacher_pool if kind == "teacher" else admin_pool
                if kind == "teacher" and cid == "special" and special_ed and special_ed not in used_global:
                    if special_ed in pool:
                        pool.remove(special_ed)
                        pool.insert(0, special_ed)
                for _ in range(count):
                    picked = _pick_from_pool(pool, used_global | committee_used)
                    if not picked:
                        break
                    display = _token((staff.get(picked) or {}).get("name"))
                    _set_seat(
                        connection,
                        cid,
                        picked,
                        seat,
                        member_kind="staff",
                        display_name=display,
                    )
                    used_global.add(picked)
                    committee_used.add(picked)

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
    member_kind: str | None = None
    display_name: str | None = None


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
    """يضيف أو يحدّث مقعداً واحداً دون مس بقية اللجان."""
    user = _require_principal(x_session_token)
    committee_id = _known_committee(body.committee_id)
    national_id = _token(body.national_id)
    seat = _token(body.seat) or "member"
    kind = _token(body.member_kind) or "staff"
    display_name = _token(body.display_name)

    if seat not in ALLOWED_SEATS:
        raise HTTPException(status_code=400, detail="المقعد غير مسموح")
    if kind not in ("staff", "student", "parent"):
        raise HTTPException(status_code=400, detail="نوع العضو غير مسموح")

    connection = connect()
    try:
        _ensure(connection)
        staff = _staff_map(connection)

        if kind == "staff":
            if not national_id:
                raise HTTPException(status_code=400, detail="اختر منسوباً من السجل")
            person = staff.get(national_id)
            if not person:
                row = connection.execute(
                    "SELECT name FROM noor_staff WHERE national_id = ?",
                    (national_id,),
                ).fetchone()
                if not row:
                    raise HTTPException(status_code=400, detail="المنسوب غير موجود في السجل")
                display_name = display_name or _token(row[0])
            else:
                display_name = display_name or _token(person.get("name"))
        elif kind == "student":
            if not national_id:
                raise HTTPException(status_code=400, detail="اختر طالباً من السجل")
            student_name = _student_name(connection, national_id)
            if not student_name:
                raise HTTPException(status_code=400, detail="الطالب غير موجود في سجل نور")
            display_name = display_name or student_name
        else:
            if not display_name:
                raise HTTPException(status_code=400, detail="يلزم اسم ممثل أولياء الأمور")
            if not national_id:
                digest = hashlib.sha256(display_name.encode("utf-8")).hexdigest()[:12]
                national_id = "parent:" + digest
            elif not national_id.startswith("parent:") and ":" not in national_id:
                # يُقبل رمز مخصص؛ إن كان هوية رقمية فقط يُغلَّف ببادئة ولي الأمر
                national_id = "parent:" + national_id

        if seat in LEADERSHIP_SEATS:
            _demote_conflicts(connection, committee_id, seat, national_id)

        _set_seat(
            connection,
            committee_id,
            national_id,
            seat,
            member_kind=kind,
            display_name=display_name,
        )
        _apply_fixed_quotas(connection)
        _refresh_stamp(connection, user)
        connection.commit()
        return _payload(connection, user)
    finally:
        connection.close()


@router.post("/api/session/committees/seat/remove")
def remove_committee_seat(body: SeatBody, x_session_token: str = Header(default="")):
    """يحذف مقعداً واحداً ويُبقي بقية الصفوف."""
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
