# الوحدة 3-ج-2: مالك المنظومة + RBAC + دعم الحسابات + أدوات القيادة.
from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect
from .portal_ssot import find_student, normalize_phone, phone_last4, sync_student_ssot

router = APIRouter(tags=["portal-owner"])

OWNER_NID = "1008379958"
OWNER_NAME = "أ. أحمد علي هيازع الشهري"
OWNER_TITLE = "معلم الرياضيات — مالك المنظومة ومطوّرها"

# هرم رباعي قابل للتعميم على مدارس متعددة
RBAC_LEVELS = {
    0: {"code": "system_owner", "label": "مالك المنظومة", "scope": "platform"},
    1: {"code": "school_leadership", "label": "قيادة المدرسة", "scope": "school"},
    2: {"code": "staff", "label": "المعلمون والموجهون", "scope": "school"},
    3: {"code": "community", "label": "الطالب / ولي الأمر", "scope": "self"},
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS portal_owner_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    owner_nid TEXT NOT NULL DEFAULT '1008379958',
    owner_name TEXT NOT NULL DEFAULT '',
    owner_title TEXT NOT NULL DEFAULT '',
    school_code TEXT NOT NULL DEFAULT '40341',
    school_name TEXT NOT NULL DEFAULT 'متوسطة سعد بن الربيع الأنصاري',
    a4_sign_vice TEXT NOT NULL DEFAULT '',
    a4_sign_manager TEXT NOT NULL DEFAULT '',
    a4_sign_owner TEXT NOT NULL DEFAULT '',
    rbac_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS portal_rbac_assignments (
    national_id TEXT PRIMARY KEY,
    level INTEGER NOT NULL DEFAULT 2,
    school_code TEXT NOT NULL DEFAULT '40341',
    label TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS portal_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_nid TEXT NOT NULL DEFAULT '',
    actor_name TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    detail_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_staff_otp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_nid TEXT NOT NULL,
    code TEXT NOT NULL,
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS portal_family_pact (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_phone TEXT NOT NULL,
    student_nid TEXT NOT NULL,
    signed_name TEXT NOT NULL DEFAULT '',
    signed_at TEXT NOT NULL,
    evidence_code TEXT NOT NULL DEFAULT '1-3-1-2'
);

CREATE TABLE IF NOT EXISTS portal_absence_excuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_phone TEXT NOT NULL,
    student_nid TEXT NOT NULL,
    excuse_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_phone_change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_phone_old TEXT NOT NULL DEFAULT '',
    parent_phone_new TEXT NOT NULL,
    student_nid TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    resolved_at TEXT NOT NULL DEFAULT '',
    resolved_by TEXT NOT NULL DEFAULT ''
);
"""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None = None) -> str:
    return (dt or _now()).replace(microsecond=0).isoformat()


def mask_nid(value: str, tail: int = 3) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if not digits:
        return ""
    if len(digits) <= tail:
        return digits
    return ("*" * min(len(digits) - tail, 10)) + digits[-tail:]


def _audit(connection, actor: dict, action: str, target: str = "", detail: dict | None = None) -> None:
    connection.execute(
        """
        INSERT INTO portal_audit_log(actor_nid, actor_name, action, target, detail_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            str(actor.get("national_id") or actor.get("id") or ""),
            str(actor.get("name") or ""),
            action,
            target,
            json.dumps(detail or {}, ensure_ascii=False),
            _iso(),
        ),
    )


def ensure_owner_tables(connection) -> None:
    connection.executescript(SCHEMA)
    row = connection.execute("SELECT id FROM portal_owner_settings WHERE id = 1").fetchone()
    if not row:
        connection.execute(
            """
            INSERT INTO portal_owner_settings(
                id, owner_nid, owner_name, owner_title, a4_sign_vice, a4_sign_manager, a4_sign_owner, rbac_json, updated_at
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                OWNER_NID,
                OWNER_NAME,
                OWNER_TITLE,
                "signatures/sig_1008379958.png",
                "signatures/sig_manager.png",
                "signatures/sig_1008379958.png",
                json.dumps(RBAC_LEVELS, ensure_ascii=False),
                _iso(),
            ),
        )
    # تثبيت المالك في RBAC
    connection.execute(
        """
        INSERT INTO portal_rbac_assignments(national_id, level, school_code, label, updated_at)
        VALUES (?, 0, '40341', ?, ?)
        ON CONFLICT(national_id) DO UPDATE SET
          level = 0,
          label = excluded.label,
          updated_at = excluded.updated_at
        """,
        (OWNER_NID, OWNER_NAME, _iso()),
    )
    # قيادة افتراضية من المدير إن وُجد
    principal = connection.execute(
        """
        SELECT national_id, name FROM noor_staff
        WHERE role LIKE 'مدير%' AND COALESCE(active,1)=1
        ORDER BY national_id LIMIT 1
        """
    ).fetchone()
    if principal:
        connection.execute(
            """
            INSERT INTO portal_rbac_assignments(national_id, level, school_code, label, updated_at)
            VALUES (?, 1, '40341', ?, ?)
            ON CONFLICT(national_id) DO NOTHING
            """,
            (principal[0], principal[1] or "قيادة المدرسة", _iso()),
        )


def ensure_on_boot(connection) -> dict:
    ensure_owner_tables(connection)
    sync_student_ssot(connection, force=False)
    return {"ok": True, "owner_nid": OWNER_NID}


def _require_staff(token: str) -> dict:
    from .access import require_user

    try:
        return require_user(str(token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _level_for(connection, user: dict) -> int:
    nid = str(user.get("national_id") or user.get("id") or "").strip()
    if nid == OWNER_NID:
        return 0
    row = connection.execute(
        "SELECT level FROM portal_rbac_assignments WHERE national_id = ? LIMIT 1",
        (nid,),
    ).fetchone()
    if row is not None:
        return int(row[0])
    role = str(user.get("role") or "")
    if "مدير" in role:
        return 1
    if "وكيل" in role:
        return 1
    return 2


def _require_level(token: str, max_level: int) -> tuple[dict, int]:
    user = _require_staff(token)
    connection = connect()
    try:
        ensure_owner_tables(connection)
        level = _level_for(connection, user)
        connection.commit()
    finally:
        connection.close()
    if level > max_level:
        raise HTTPException(status_code=403, detail="صلاحية غير كافية لهذا الإجراء.")
    return user, level


class OwnerSettingsBody(BaseModel):
    owner_name: str = OWNER_NAME
    owner_title: str = OWNER_TITLE
    a4_sign_vice: str = ""
    a4_sign_manager: str = ""
    a4_sign_owner: str = ""
    school_name: str = ""
    school_code: str = ""


class RbacBody(BaseModel):
    national_id: str
    level: int = 2
    label: str = ""
    school_code: str = "40341"


class PhoneUpdateBody(BaseModel):
    student_nid: str
    guardian_phone: str


class OtpBody(BaseModel):
    staff_nid: str


class PactBody(BaseModel):
    student_nid: str
    signed_name: str = ""


class AbsenceBody(BaseModel):
    student_nid: str
    excuse_date: str
    reason: str


class PhoneRequestBody(BaseModel):
    student_nid: str = ""
    new_phone: str
    note: str = ""


class WorksheetBody(BaseModel):
    skill: str = ""
    domain: str = "math"
    student_nids: list[str] = Field(default_factory=list)
    count: int = 5


@router.get("/api/portal/owner/settings")
def owner_settings(x_session_token: str = Header(default="")):
    user, level = _require_level(x_session_token, 1)
    connection = connect()
    try:
        ensure_owner_tables(connection)
        row = connection.execute(
            """
            SELECT owner_nid, owner_name, owner_title, school_code, school_name,
                   a4_sign_vice, a4_sign_manager, a4_sign_owner, rbac_json, updated_at
            FROM portal_owner_settings WHERE id = 1
            """
        ).fetchone()
        assignments = [
            {
                "national_id": r[0],
                "national_id_masked": mask_nid(r[0]),
                "level": int(r[1]),
                "level_label": RBAC_LEVELS.get(int(r[1]), {}).get("label", ""),
                "school_code": r[2],
                "label": r[3],
            }
            for r in connection.execute(
                "SELECT national_id, level, school_code, label FROM portal_rbac_assignments ORDER BY level, national_id"
            )
        ]
        connection.commit()
        return {
            "viewer_level": level,
            "viewer_nid_masked": mask_nid(user.get("national_id") or user.get("id") or ""),
            "levels": RBAC_LEVELS,
            "settings": {
                "owner_nid": row[0],
                "owner_nid_masked": mask_nid(row[0]),
                "owner_name": row[1],
                "owner_title": row[2],
                "school_code": row[3],
                "school_name": row[4],
                "a4_sign_vice": row[5],
                "a4_sign_manager": row[6],
                "a4_sign_owner": row[7],
                "rbac": json.loads(row[8] or "{}"),
                "updated_at": row[9],
            },
            "assignments": assignments,
        }
    finally:
        connection.close()


@router.post("/api/portal/owner/settings")
def save_owner_settings(body: OwnerSettingsBody, x_session_token: str = Header(default="")):
    user, level = _require_level(x_session_token, 0)
    connection = connect()
    try:
        ensure_owner_tables(connection)
        connection.execute(
            """
            UPDATE portal_owner_settings SET
              owner_name = ?, owner_title = ?,
              a4_sign_vice = COALESCE(NULLIF(?, ''), a4_sign_vice),
              a4_sign_manager = COALESCE(NULLIF(?, ''), a4_sign_manager),
              a4_sign_owner = COALESCE(NULLIF(?, ''), a4_sign_owner),
              school_name = COALESCE(NULLIF(?, ''), school_name),
              school_code = COALESCE(NULLIF(?, ''), school_code),
              updated_at = ?
            WHERE id = 1
            """,
            (
                body.owner_name.strip() or OWNER_NAME,
                body.owner_title.strip() or OWNER_TITLE,
                body.a4_sign_vice.strip(),
                body.a4_sign_manager.strip(),
                body.a4_sign_owner.strip(),
                body.school_name.strip(),
                body.school_code.strip(),
                _iso(),
            ),
        )
        _audit(connection, user, "owner.settings.save", OWNER_NID)
        connection.commit()
        return {"ok": True}
    finally:
        connection.close()


@router.post("/api/portal/owner/rbac")
def assign_rbac(body: RbacBody, x_session_token: str = Header(default="")):
    user, level = _require_level(x_session_token, 0)
    nid = "".join(ch for ch in body.national_id if ch.isdigit())
    lvl = int(body.level)
    if lvl < 0 or lvl > 3:
        raise HTTPException(status_code=400, detail="مستوى RBAC غير صالح.")
    if nid == OWNER_NID and lvl != 0:
        raise HTTPException(status_code=400, detail="لا يمكن إنزال مالك المنظومة عن المستوى ٠.")
    connection = connect()
    try:
        ensure_owner_tables(connection)
        connection.execute(
            """
            INSERT INTO portal_rbac_assignments(national_id, level, school_code, label, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(national_id) DO UPDATE SET
              level = excluded.level,
              school_code = excluded.school_code,
              label = excluded.label,
              updated_at = excluded.updated_at
            """,
            (nid, lvl, body.school_code or "40341", body.label or RBAC_LEVELS[lvl]["label"], _iso()),
        )
        _audit(connection, user, "owner.rbac.assign", mask_nid(nid), {"level": lvl})
        connection.commit()
        return {"ok": True, "national_id_masked": mask_nid(nid), "level": lvl}
    finally:
        connection.close()


@router.get("/api/portal/support/search")
def support_search(q: str = "", x_session_token: str = Header(default="")):
    user, level = _require_level(x_session_token, 1)
    query = str(q or "").strip()
    if len(query) < 2:
        return {"items": []}
    connection = connect()
    try:
        ensure_owner_tables(connection)
        like = f"%{query}%"
        digits = "".join(ch for ch in query if ch.isdigit())
        rows = connection.execute(
            """
            SELECT national_id, name, grade, classroom, guardian_phone
            FROM noor_students
            WHERE COALESCE(is_deleted,0)=0
              AND (
                name LIKE ?
                OR national_id LIKE ?
                OR guardian_phone LIKE ?
              )
            ORDER BY name LIMIT 40
            """,
            (like, f"%{digits}%" if digits else like, f"%{digits}%" if digits else like),
        ).fetchall()
        items = [
            {
                "national_id": r[0],
                "national_id_masked": mask_nid(r[0]),
                "name": r[1],
                "grade": r[2],
                "section": r[3],
                "guardian_phone": r[4] or "",
                "guardian_phone_masked": (("*" * max(0, len(normalize_phone(r[4] or "")) - 4)) + phone_last4(r[4] or ""))
                if r[4]
                else "",
                "phone_last4": phone_last4(r[4] or ""),
            }
            for r in rows
        ]
        _audit(connection, user, "support.search", query[:40], {"count": len(items)})
        connection.commit()
        return {"items": items, "viewer_level": level}
    finally:
        connection.close()


@router.post("/api/portal/support/phone")
def support_update_phone(body: PhoneUpdateBody, x_session_token: str = Header(default="")):
    user, level = _require_level(x_session_token, 1)
    nid = "".join(ch for ch in body.student_nid if ch.isdigit())
    phone = str(body.guardian_phone or "").strip()
    if not nid or len(normalize_phone(phone)) < 9:
        raise HTTPException(status_code=400, detail="هوية أو جوال غير صالح.")
    connection = connect()
    try:
        ensure_owner_tables(connection)
        connection.execute(
            """
            UPDATE noor_students
            SET guardian_phone = ?, portal_synced_at = ?
            WHERE national_id = ?
            """,
            (phone, _iso(), nid),
        )
        sync_student_ssot(connection, force=True)
        _audit(connection, user, "support.phone.update", mask_nid(nid), {"phone_last4": phone_last4(phone)})
        connection.commit()
        return {"ok": True, "national_id_masked": mask_nid(nid), "phone_last4": phone_last4(phone)}
    finally:
        connection.close()


@router.post("/api/portal/support/otp")
def support_issue_otp(body: OtpBody, x_session_token: str = Header(default="")):
    user, level = _require_level(x_session_token, 1)
    staff_nid = "".join(ch for ch in body.staff_nid if ch.isdigit())
    if not staff_nid:
        raise HTTPException(status_code=400, detail="هوية المعلم مطلوبة.")
    code = f"{secrets.randbelow(1000000):06d}"
    created = _now()
    expires = created + timedelta(hours=24)
    connection = connect()
    try:
        ensure_owner_tables(connection)
        connection.execute(
            "UPDATE portal_staff_otp SET active = 0 WHERE staff_nid = ? AND active = 1",
            (staff_nid,),
        )
        connection.execute(
            """
            INSERT INTO portal_staff_otp(staff_nid, code, created_by, created_at, expires_at, active)
            VALUES (?, ?, ?, ?, ?, 1)
            """,
            (staff_nid, code, str(user.get("national_id") or ""), _iso(created), _iso(expires)),
        )
        _audit(connection, user, "support.otp.issue", mask_nid(staff_nid), {"expires_at": _iso(expires)})
        connection.commit()
        return {
            "ok": True,
            "staff_nid_masked": mask_nid(staff_nid),
            "code": code,
            "expires_at": _iso(expires),
            "note": "رمز ليوم واحد — يُبلَّغ للمعلم شفهياً أو عبر قناة آمنة.",
        }
    finally:
        connection.close()


@router.get("/api/portal/support/qr-pass")
def support_qr_pass(student_nid: str = "", x_session_token: str = Header(default="")):
    user, level = _require_level(x_session_token, 2)
    nid = "".join(ch for ch in student_nid if ch.isdigit())
    connection = connect()
    try:
        ensure_owner_tables(connection)
        from .portal_session_api import _qr_code_for

        student = find_student(connection, nid)
        if not student:
            raise HTTPException(status_code=404, detail="الطالب غير موجود.")
        code = _qr_code_for(nid)
        connection.execute(
            """
            INSERT INTO portal_qr_passes(student_nid, pass_code, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(student_nid) DO UPDATE SET pass_code = excluded.pass_code
            """,
            (nid, code, _iso()),
        )
        _audit(connection, user, "support.qr.issue", mask_nid(nid))
        connection.commit()
        return {
            "student": {
                "name": student["name"],
                "grade": student.get("grade") or "",
                "section": student.get("section") or "",
                "national_id_masked": mask_nid(nid),
            },
            "qr_code": code,
            "card_title": "بطاقة دخول نافس الذكية (QR Pass)",
        }
    finally:
        connection.close()


@router.get("/api/portal/support/audit")
def support_audit(limit: int = 50, x_session_token: str = Header(default="")):
    user, level = _require_level(x_session_token, 1)
    connection = connect()
    try:
        ensure_owner_tables(connection)
        rows = connection.execute(
            """
            SELECT actor_nid, actor_name, action, target, detail_json, created_at
            FROM portal_audit_log
            ORDER BY id DESC
            LIMIT ?
            """,
            (max(1, min(int(limit or 50), 200)),),
        ).fetchall()
        return {
            "items": [
                {
                    "actor_nid_masked": mask_nid(r[0]),
                    "actor_name": r[1],
                    "action": r[2],
                    "target": r[3],
                    "detail": json.loads(r[4] or "{}"),
                    "created_at": r[5],
                }
                for r in rows
            ]
        }
    finally:
        connection.close()


@router.get("/api/portal/morning-brief")
def morning_brief(x_session_token: str = Header(default="")):
    user, level = _require_level(x_session_token, 2)
    connection = connect()
    try:
        ensure_owner_tables(connection)
        today = _iso()[:10]
        challenges = connection.execute(
            """
            SELECT COUNT(*), COALESCE(SUM(xp_earned),0), COALESCE(AVG(score_pct),0)
            FROM portal_challenge_runs
            WHERE finished_at LIKE ?
            """,
            (today + "%",),
        ).fetchone()
        counseling = connection.execute(
            "SELECT COUNT(*) FROM portal_counseling WHERE status = 'new'"
        ).fetchone()[0]
        excuses = connection.execute(
            "SELECT COUNT(*) FROM portal_absence_excuses WHERE status = 'new'"
        ).fetchone()[0]
        phone_req = connection.execute(
            "SELECT COUNT(*) FROM portal_phone_change_requests WHERE status = 'pending'"
        ).fetchone()[0]
        top = connection.execute(
            """
            SELECT s.name, s.grade, s.classroom, SUM(r.xp_earned) xp
            FROM portal_challenge_runs r
            JOIN noor_students s ON s.national_id = r.student_nid
            WHERE r.finished_at LIKE ?
            GROUP BY r.student_nid
            ORDER BY xp DESC LIMIT 5
            """,
            (today + "%",),
        ).fetchall()
        _audit(connection, user, "morning.brief.view", today)
        connection.commit()
        return {
            "date": today,
            "challenges_today": int(challenges[0] or 0),
            "xp_today": int(challenges[1] or 0),
            "avg_score_today": round(float(challenges[2] or 0), 1),
            "counseling_new": int(counseling or 0),
            "absence_new": int(excuses or 0),
            "phone_requests_pending": int(phone_req or 0),
            "top_students": [
                {
                    "name": r[0],
                    "grade": r[1],
                    "section": r[2],
                    "xp": int(r[3] or 0),
                }
                for r in top
            ],
            "evidence_hooks": ["3-1-1-1", "3-1-1-2", "3-1-1-3", "1-3-1-2"],
        }
    finally:
        connection.close()


@router.post("/api/portal/worksheet/remedial")
def remedial_worksheet(body: WorksheetBody, x_session_token: str = Header(default="")):
    user, level = _require_level(x_session_token, 2)
    connection = connect()
    try:
        ensure_owner_tables(connection)
        from .nafs_question_bank_seed import ensure_nafs_question_bank

        ensure_nafs_question_bank(connection)
        count = max(1, min(int(body.count or 5), 10))
        domain = str(body.domain or "math").strip().lower()
        skill = str(body.skill or "").strip()
        params: list[Any] = []
        where = "WHERE COALESCE(active,1)=1"
        if domain in ("math", "reading", "science"):
            where += " AND domain = ?"
            params.append(domain)
        if skill:
            where += " AND skill LIKE ?"
            params.append(f"%{skill}%")
        rows = connection.execute(
            f"""
            SELECT id, domain, skill, stem, choice_a, choice_b, choice_c, choice_d, correct, rationale
            FROM nafs_question_bank {where}
            ORDER BY RANDOM() LIMIT ?
            """,
            tuple(params + [count]),
        ).fetchall()
        students = []
        for nid in body.student_nids or []:
            st = find_student(connection, "".join(ch for ch in nid if ch.isdigit()))
            if st:
                students.append(
                    {
                        "name": st["name"],
                        "grade": st.get("grade") or "",
                        "section": st.get("section") or "",
                        "national_id_masked": mask_nid(st["national_id"]),
                    }
                )
        _audit(
            connection,
            user,
            "worksheet.remedial",
            skill or domain,
            {"questions": len(rows), "students": len(students)},
        )
        connection.commit()
        return {
            "title": "ورقة عمل علاجية مركّزة — نافس",
            "skill": skill,
            "domain": domain,
            "students": students,
            "questions": [
                {
                    "id": int(r[0]),
                    "domain": r[1],
                    "skill": r[2],
                    "stem": r[3],
                    "choices": {"A": r[4], "B": r[5], "C": r[6], "D": r[7]},
                    "correct": (r[8] or "A").upper(),
                    "rationale": r[9] or "",
                }
                for r in rows
            ],
            "signoffs": {
                "owner": OWNER_NAME,
                "owner_title": OWNER_TITLE,
            },
        }
    finally:
        connection.close()


def _require_parent(token: str) -> dict:
    from .portal_session_api import _require_portal

    return _require_portal(token, ("parent",))


@router.post("/api/portal/parent/pact")
def parent_sign_pact(body: PactBody, x_portal_token: str = Header(default="")):
    session = _require_parent(x_portal_token)
    phone = (session.get("payload") or {}).get("phone_norm") or session.get("actor_key") or ""
    nid = "".join(ch for ch in body.student_nid if ch.isdigit())
    kids = {(c.get("national_id") or "") for c in ((session.get("payload") or {}).get("children") or [])}
    if nid not in kids:
        raise HTTPException(status_code=403, detail="هذا الطالب غير مرتبط بجلستك.")
    connection = connect()
    try:
        ensure_owner_tables(connection)
        connection.execute(
            """
            INSERT INTO portal_family_pact(parent_phone, student_nid, signed_name, signed_at, evidence_code)
            VALUES (?, ?, ?, ?, '1-3-1-2')
            """,
            (phone, nid, body.signed_name.strip() or "ولي أمر", _iso()),
        )
        # شاهد اعتماد حي (1-3-1-2)
        try:
            connection.execute(
                """
                INSERT INTO visual_evidence(
                  entity_type, entity_key, register_key, kind, url, name, created_at, uploaded_by
                ) VALUES ('accreditation', '1-3-1-2', 'family-pact', 'note', '', ?, ?, ?)
                """,
                (
                    "ميثاق الشراكة الأسرية — توقيع إلكتروني (" + mask_nid(nid) + ")",
                    _iso(),
                    "ولي أمر …" + str(phone)[-4:],
                ),
            )
        except Exception:
            pass
        connection.commit()
        return {
            "ok": True,
            "evidence_code": "1-3-1-2",
            "message": "وُثّق التوقيع الإلكتروني لميثاق الشراكة الأسرية كشاهد 1-3-1-2.",
        }
    finally:
        connection.close()


@router.post("/api/portal/parent/absence")
def parent_absence(body: AbsenceBody, x_portal_token: str = Header(default="")):
    session = _require_parent(x_portal_token)
    phone = (session.get("payload") or {}).get("phone_norm") or session.get("actor_key") or ""
    nid = "".join(ch for ch in body.student_nid if ch.isdigit())
    kids = {(c.get("national_id") or "") for c in ((session.get("payload") or {}).get("children") or [])}
    if nid not in kids:
        raise HTTPException(status_code=403, detail="هذا الطالب غير مرتبط بجلستك.")
    reason = str(body.reason or "").strip()
    if len(reason) < 3:
        raise HTTPException(status_code=400, detail="سبب العذر مطلوب.")
    connection = connect()
    try:
        ensure_owner_tables(connection)
        connection.execute(
            """
            INSERT INTO portal_absence_excuses(parent_phone, student_nid, excuse_date, reason, status, created_at)
            VALUES (?, ?, ?, ?, 'new', ?)
            """,
            (phone, nid, str(body.excuse_date or "").strip(), reason, _iso()),
        )
        risk = None
        try:
            from .portal_radar_api import ensure_radar_tables, evaluate_absence_risk

            ensure_radar_tables(connection)
            risk = evaluate_absence_risk(connection, nid)
        except Exception:
            risk = None
        connection.commit()
        return {
            "ok": True,
            "message": "وُفع عذر الغياب الإلكتروني وبانتظار اعتماد المدرسة.",
            "risk_alert": risk,
        }
    finally:
        connection.close()


@router.post("/api/portal/parent/phone-request")
def parent_phone_request(body: PhoneRequestBody, x_portal_token: str = Header(default="")):
    session = _require_parent(x_portal_token)
    phone_old = (session.get("payload") or {}).get("phone_norm") or session.get("actor_key") or ""
    phone_new = str(body.new_phone or "").strip()
    if len(normalize_phone(phone_new)) < 9:
        raise HTTPException(status_code=400, detail="رقم الجوال الجديد غير صالح.")
    nid = "".join(ch for ch in (body.student_nid or "") if ch.isdigit())
    connection = connect()
    try:
        ensure_owner_tables(connection)
        connection.execute(
            """
            INSERT INTO portal_phone_change_requests(
              parent_phone_old, parent_phone_new, student_nid, note, status, created_at
            ) VALUES (?, ?, ?, ?, 'pending', ?)
            """,
            (phone_old, phone_new, nid, body.note.strip(), _iso()),
        )
        connection.commit()
        return {"ok": True, "message": "وُفع طلب تحديث الجوال لمراجعة القيادة (المستوى ٠/١)."}
    finally:
        connection.close()
