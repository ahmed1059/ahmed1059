# بوابة الطالب وولي الأمر — جلسات مقفلة + تحدي نافس + XP + صدارة (الوحدة 3-ج-1).
from __future__ import annotations

import hashlib
import hmac
import json
import random
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect
from .portal_ssot import (
    children_by_phone,
    find_student,
    normalize_phone,
    phone_last4,
    sync_student_ssot,
)

router = APIRouter(tags=["portal"])

PORTAL_SCHEMA = """
CREATE TABLE IF NOT EXISTS portal_sessions (
    token TEXT PRIMARY KEY,
    actor_type TEXT NOT NULL,
    actor_key TEXT NOT NULL,
    student_nid TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL DEFAULT '',
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_portal_sessions_actor ON portal_sessions(actor_type, actor_key);

CREATE TABLE IF NOT EXISTS portal_challenge_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    mode TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL DEFAULT '',
    duration_sec INTEGER NOT NULL DEFAULT 0,
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    score_pct REAL NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    streak_best INTEGER NOT NULL DEFAULT 0,
    domain_focus TEXT NOT NULL DEFAULT '',
    detail_json TEXT NOT NULL DEFAULT '{}',
    active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_portal_runs_student ON portal_challenge_runs(student_nid, finished_at);

CREATE TABLE IF NOT EXISTS portal_xp_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    event_type TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    meta_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_portal_xp_student ON portal_xp_ledger(student_nid, created_at);

CREATE TABLE IF NOT EXISTS portal_powerup_uses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    run_id INTEGER NOT NULL,
    powerup TEXT NOT NULL,
    used_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_counseling (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    student_name TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL,
    counselor_note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS portal_behavior_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    program TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_qr_passes (
    student_nid TEXT PRIMARY KEY,
    pass_code TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_cafeteria_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'قسيمة مقصف',
    points_cost INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'available',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_portal_cafeteria_student ON portal_cafeteria_vouchers(student_nid, status);
"""

MODE_DAILY = "daily"
MODE_MOCK = "mock"
MODE_RESCUE = "rescue"
MODE_DUEL = "duel"
MODE_NATIONAL = "national"
MODE_CONFIG = {
    MODE_DAILY: {"label": "تحدي اليوم السريع", "count": 10, "seconds": 600, "xp_mult": 1},
    MODE_MOCK: {"label": "الاختبار المحاكي الشامل", "count": 20, "seconds": 1200, "xp_mult": 1},
    MODE_RESCUE: {"label": "تحدي إنقاذ المهارة الأضعف", "count": 8, "seconds": 480, "xp_mult": 2},
    MODE_DUEL: {"label": "مبارزة زميل (١ ضد ١)", "count": 8, "seconds": 480, "xp_mult": 2},
    MODE_NATIONAL: {
        "label": "المحاكاة الوطنية الشاملة (٦٦ سؤالاً)",
        "count": 66,
        "seconds": 5400,
        "xp_mult": 2,
        "balanced_domains": True,
    },
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None = None) -> str:
    return (dt or _now()).replace(microsecond=0).isoformat()


def _ensure(connection) -> None:
    connection.executescript(PORTAL_SCHEMA)
    try:
        from .portal_radar_api import ensure_radar_tables

        ensure_radar_tables(connection)
    except Exception:
        pass
    sync_student_ssot(connection, force=False)


def _secret() -> str:
    import os

    return str(os.environ.get("PORTAL_HMAC_SECRET") or os.environ.get("INITIAL_ADMIN_PASSWORD") or "portal-1059").strip()


def _qr_code_for(student_nid: str) -> str:
    digest = hmac.new(
        _secret().encode("utf-8"),
        f"qrpass:{student_nid}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:12].upper()
    return f"NAFS-{student_nid[-4:]}-{digest}"


def ensure_on_boot(connection) -> dict:
    _ensure(connection)
    return sync_student_ssot(connection, force=True)


class StudentLoginBody(BaseModel):
    national_id: str = ""
    phone_last4: str = ""
    qr_code: str = ""


class ParentLoginBody(BaseModel):
    phone: str = ""


class StartChallengeBody(BaseModel):
    mode: str = MODE_DAILY
    domain: str = ""


class AnswerBody(BaseModel):
    run_id: int
    question_id: int
    choice: str
    elapsed_sec: float = 0
    streak: int = 0


class CheckAnswerBody(BaseModel):
    run_id: int
    question_id: int
    choice: str = ""


class PowerupBody(BaseModel):
    run_id: int
    powerup: str
    question_id: int = 0


class FinishBody(BaseModel):
    run_id: int
    answers: list[dict[str, Any]] = Field(default_factory=list)


class CounselBody(BaseModel):
    message: str = ""


def _require_portal(token: str, actor_types: tuple[str, ...] | None = None) -> dict:
    tok = str(token or "").strip()
    if not tok:
        raise HTTPException(status_code=401, detail="جلسة البوابة مطلوبة.")
    connection = connect()
    try:
        _ensure(connection)
        row = connection.execute(
            """
            SELECT token, actor_type, actor_key, student_nid, display_name, payload_json, expires_at
            FROM portal_sessions WHERE token = ? LIMIT 1
            """,
            (tok,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="جلسة البوابة غير صالحة.")
        expires = datetime.fromisoformat(str(row[6]))
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < _now():
            connection.execute("DELETE FROM portal_sessions WHERE token = ?", (tok,))
            connection.commit()
            raise HTTPException(status_code=401, detail="انتهت جلسة البوابة.")
        actor_type = row[1]
        if actor_types and actor_type not in actor_types:
            raise HTTPException(status_code=403, detail="صلاحية البوابة غير كافية.")
        payload = {}
        try:
            payload = json.loads(row[5] or "{}")
        except json.JSONDecodeError:
            payload = {}
        return {
            "token": row[0],
            "actor_type": actor_type,
            "actor_key": row[2],
            "student_nid": row[3] or "",
            "display_name": row[4] or "",
            "payload": payload,
        }
    finally:
        connection.close()


def _create_session(connection, actor_type: str, actor_key: str, student_nid: str, display_name: str, payload: dict) -> dict:
    token = secrets.token_urlsafe(24)
    created = _now()
    expires = created + timedelta(hours=8)
    connection.execute(
        """
        INSERT INTO portal_sessions(token, actor_type, actor_key, student_nid, display_name, payload_json, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            token,
            actor_type,
            actor_key,
            student_nid,
            display_name,
            json.dumps(payload, ensure_ascii=False),
            _iso(created),
            _iso(expires),
        ),
    )
    return {
        "token": token,
        "actor_type": actor_type,
        "student_nid": student_nid,
        "name": display_name,
        "expires_at": _iso(expires),
        "payload": payload,
    }


def _badge_for(score_pct: float, prev_best: float | None = None) -> str:
    if score_pct >= 90:
        return "فارس نافس الذهبي"
    if score_pct >= 80:
        return "فارس نافس الفضي"
    if prev_best is not None and (score_pct - prev_best) >= 20:
        return "فارس التطور"
    return ""


def _xp_total(connection, student_nid: str) -> int:
    row = connection.execute(
        "SELECT COALESCE(SUM(xp),0) FROM portal_xp_ledger WHERE student_nid = ?",
        (student_nid,),
    ).fetchone()
    return int(row[0] or 0)


def _section_key(grade: str, section: str) -> str:
    g = (grade or "").strip()
    s = (section or "").strip()
    return f"{g} / {s}".strip(" /")


def _pick_ghost(connection, student_nid: str, question_count: int, seconds: int) -> dict:
    """خصم شبح من جولة سابقة (أو نظير اصطناعي) لعرض شريط تقدم المبارزة."""
    from .portal_owner_api import mask_nid

    row = connection.execute(
        """
        SELECT r.student_nid, COALESCE(s.name, ''), r.score_pct, r.duration_sec, r.correct_count, r.total_questions
        FROM portal_challenge_runs r
        LEFT JOIN noor_students s ON s.national_id = r.student_nid
        WHERE r.finished_at != '' AND r.student_nid != ?
        ORDER BY RANDOM()
        LIMIT 1
        """,
        (student_nid,),
    ).fetchone()
    if row:
        name = (row[1] or "زميل الصف").strip() or "زميل الصف"
        # إخفاء اللقب الكامل — الاسم الأول فقط للخصوصية
        short = name.split()[0] if name else "زميل"
        target = float(row[2] or 70)
        duration = max(60, int(row[3] or seconds))
    else:
        short = "زميل الصف"
        name = short
        target = float(random.randint(65, 88))
        duration = max(90, int(seconds * 0.85))
        row = ("", name, target, duration, 0, question_count)
    # وتيرة إجابة الشبح عبر الأسئلة
    pace = []
    cursor = 0.0
    step = duration / max(question_count, 1)
    for i in range(question_count):
        jitter = random.uniform(0.65, 1.25)
        cursor += step * jitter
        pace.append(round(min(duration - 1, cursor), 1))
    expected_correct = max(1, int(round(question_count * target / 100.0)))
    return {
        "ghost_name": short,
        "ghost_nid_masked": mask_nid(row[0]) if row[0] else "***",
        "ghost_target_score": round(target, 1),
        "ghost_pace_sec": pace,
        "ghost_expected_correct": expected_correct,
        "ghost_duration_sec": duration,
    }


def _behavior_totals(connection, student_nid: str) -> dict:
    rows = connection.execute(
        """
        SELECT program, COALESCE(SUM(points),0)
        FROM portal_behavior_points
        WHERE student_nid = ?
        GROUP BY program
        """,
        (student_nid,),
    ).fetchall()
    totals = {"قدوة": 0, "رفق": 0}
    for program, points in rows:
        key = str(program or "").strip() or "أخرى"
        totals[key] = int(points or 0)
    totals["total"] = sum(int(v) for k, v in totals.items() if k != "total")
    return totals


def _ensure_cafeteria_voucher(connection, student_nid: str, behavior_total: int) -> dict | None:
    """قسيمة مقصف لكل ٥ نقاط سلوك إيجابي (مرة واحدة لكل عتبة)."""
    if behavior_total < 5:
        return None
    tiers = behavior_total // 5
    existing = connection.execute(
        "SELECT COUNT(*) FROM portal_cafeteria_vouchers WHERE student_nid = ?",
        (student_nid,),
    ).fetchone()[0]
    if int(existing or 0) >= tiers:
        return None
    connection.execute(
        """
        INSERT INTO portal_cafeteria_vouchers(student_nid, title, points_cost, status, created_at)
        VALUES (?, 'قسيمة مقصف مستحقة', 5, 'available', ?)
        """,
        (student_nid, _iso()),
    )
    return {"title": "قسيمة مقصف مستحقة", "status": "available"}


def _row_to_question(row) -> dict:
    return {
        "id": int(row[0]),
        "domain": row[1] or "",
        "skill": row[2] or "",
        "stem": row[3] or "",
        "choices": {
            "A": row[4] or "",
            "B": row[5] or "",
            "C": row[6] or "",
            "D": row[7] or "",
        },
        "correct": (row[8] or "A").upper(),
        "rationale": row[9] or "",
        "passage_id": row[10] or "",
        "passage_title": row[11] or "",
        "passage_text": row[12] or "",
        "common_mistake": (row[13] if len(row) > 13 else "") or "",
        "grade_root": (row[14] if len(row) > 14 else "") or "",
        "golden_rule": (row[15] if len(row) > 15 else "") or "",
        "parametric": False,
    }


def _pick_questions(connection, mode: str, domain: str, count: int) -> list[dict]:
    from .nafs_question_bank_seed import ensure_nafs_question_bank
    from .portal_parametric import generate_parametric_batch

    ensure_nafs_question_bank(connection)
    try:
        from .nafs_misconception_lab import ensure_question_columns, enrich_question_traps

        ensure_question_columns(connection)
        enrich_question_traps(connection)
    except Exception:
        pass

    select_sql = """
        SELECT id, domain, skill, stem, choice_a, choice_b, choice_c, choice_d,
               correct, rationale, passage_id, passage_title, passage_text,
               COALESCE(common_mistake,''), COALESCE(grade_root,''), COALESCE(golden_rule,'')
        FROM nafs_question_bank
    """

    # المحاكاة الوطنية: ٢٢ لكل مجال بلا نظائر عشوائية
    if mode == MODE_NATIONAL:
        out: list[dict] = []
        for dom in ("math", "science", "reading"):
            rows = connection.execute(
                select_sql + " WHERE COALESCE(active,1)=1 AND domain = ? ORDER BY RANDOM() LIMIT 22",
                (dom,),
            ).fetchall()
            out.extend(_row_to_question(r) for r in rows)
        random.shuffle(out)
        return out[:66]

    # نظائر مهارية: نحو ٣٠٪ من الجولة (على الأقل سؤالان إن أمكن)
    parametric_n = min(max(2, count // 3), max(0, count - 1)) if count >= 3 else (1 if count > 1 else 0)
    if domain == "reading":
        parametric_n = 0
    bank_n = max(0, count - parametric_n)
    params: list[Any] = []
    where = "WHERE COALESCE(active,1)=1"
    if domain in ("math", "reading", "science"):
        where += " AND domain = ?"
        params.append(domain)
    elif mode == MODE_RESCUE:
        # أضعف مهارة افتراضياً من بطاقة نافس إن وُجدت
        weak = connection.execute(
            "SELECT weakest_skill FROM nafs_cards ORDER BY id LIMIT 1"
        ).fetchone()
        skill = (weak[0] if weak else "") or "الجبر"
        where += " AND (skill LIKE ? OR domain = 'math')"
        params.append(f"%{skill}%")
    rows = connection.execute(
        f"{select_sql} {where} ORDER BY RANDOM() LIMIT ?",
        tuple(params + [bank_n or count]),
    ).fetchall()
    if len(rows) < bank_n:
        rows = connection.execute(
            f"{select_sql} WHERE COALESCE(active,1)=1 ORDER BY RANDOM() LIMIT ?",
            (bank_n or count,),
        ).fetchall()
    out = [_row_to_question(row) for row in rows]
    if parametric_n:
        domains = [domain] if domain in ("math", "science") else ["math", "science"]
        generated = generate_parametric_batch(parametric_n, domains=domains)
        # معرفات سالبة فريدة داخل الجولة
        base = -1000 - random.randint(0, 5000)
        for i, q in enumerate(generated):
            q["id"] = base - i
            out.append(q)
    random.shuffle(out)
    return out[:count]


def _public_question(q: dict) -> dict:
    return {
        "id": q["id"],
        "domain": q["domain"],
        "skill": q["skill"],
        "stem": q["stem"],
        "choices": q["choices"],
        "passage_title": q.get("passage_title") or "",
        "passage_text": q.get("passage_text") or "",
    }


@router.post("/api/portal/sync-students")
def portal_sync_students(x_session_token: str = Header(default="")):
    """مزامنة SSOT — متاحة لجلسة المنسوبين أو إعادة بذر عند الإقلاع."""
    from .access import require_user

    try:
        require_user(str(x_session_token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    connection = connect()
    try:
        result = sync_student_ssot(connection, force=True)
        connection.commit()
        return result
    finally:
        connection.close()


@router.get("/api/portal/ssot-report")
def portal_ssot_report(x_session_token: str = Header(default="")):
    from .access import require_user

    try:
        require_user(str(x_session_token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    connection = connect()
    try:
        _ensure(connection)
        row = connection.execute(
            "SELECT value FROM portal_ssot_meta WHERE key = 'diff_report' LIMIT 1"
        ).fetchone()
        report = json.loads(row[0]) if row and row[0] else {}
        total = connection.execute(
            "SELECT COUNT(*) FROM noor_students WHERE COALESCE(is_deleted,0)=0"
        ).fetchone()[0]
        phones = connection.execute("SELECT COUNT(*) FROM portal_guardian_index").fetchone()[0]
        return {"students": total, "guardian_links": phones, "report": report}
    finally:
        connection.close()


@router.post("/api/portal/login/student")
def portal_login_student(body: StudentLoginBody):
    connection = connect()
    try:
        _ensure(connection)
        nid = str(body.national_id or "").strip()
        qr = str(body.qr_code or "").strip().upper()
        last4 = "".join(ch for ch in str(body.phone_last4 or "") if ch.isdigit())[-4:]
        student = None
        if qr:
            row = connection.execute(
                "SELECT student_nid FROM portal_qr_passes WHERE UPPER(pass_code) = ? LIMIT 1",
                (qr,),
            ).fetchone()
            if row:
                student = find_student(connection, row[0])
            else:
                # قبول رمز مشتق من الهوية إن طابق
                for cand in connection.execute(
                    "SELECT national_id FROM noor_students WHERE COALESCE(is_deleted,0)=0"
                ):
                    if _qr_code_for(cand[0]) == qr:
                        student = find_student(connection, cand[0])
                        break
        else:
            student = find_student(connection, nid)
            if not student:
                raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة.")
            if not last4 or last4 != student.get("phone_last4"):
                raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة.")
        if not student:
            raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة.")
        # ضمان بطاقة QR
        code = _qr_code_for(student["national_id"])
        connection.execute(
            """
            INSERT INTO portal_qr_passes(student_nid, pass_code, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(student_nid) DO UPDATE SET pass_code = excluded.pass_code
            """,
            (student["national_id"], code, _iso()),
        )
        session = _create_session(
            connection,
            "student",
            student["national_id"],
            student["national_id"],
            student["name"],
            {
                "grade": student.get("grade") or "",
                "section": student.get("section") or "",
                "qr_code": code,
            },
        )
        connection.commit()
        return {
            "ok": True,
            "token": session["token"],
            "actor_type": "student",
            "student": {
                "national_id": student["national_id"],
                "name": student["name"],
                "grade": student.get("grade") or "",
                "section": student.get("section") or "",
                "qr_code": code,
            },
            "expires_at": session["expires_at"],
            "redirect": "portal-student.html",
        }
    finally:
        connection.close()


@router.post("/api/portal/login/parent")
def portal_login_parent(body: ParentLoginBody):
    connection = connect()
    try:
        _ensure(connection)
        kids = children_by_phone(connection, body.phone)
        if not kids:
            raise HTTPException(status_code=401, detail="لا أبناء مسجّلين لهذا الجوال.")
        phone_norm = normalize_phone(body.phone)
        session = _create_session(
            connection,
            "parent",
            phone_norm,
            kids[0]["national_id"],
            "ولي أمر",
            {"children": kids, "phone_norm": phone_norm},
        )
        connection.commit()
        return {
            "ok": True,
            "token": session["token"],
            "actor_type": "parent",
            "children": kids,
            "expires_at": session["expires_at"],
            "redirect": "portal-parent.html",
        }
    finally:
        connection.close()


@router.get("/api/portal/me")
def portal_me(x_portal_token: str = Header(default="")):
    session = _require_portal(x_portal_token)
    connection = connect()
    try:
        _ensure(connection)
        if session["actor_type"] == "student":
            student = find_student(connection, session["student_nid"]) or {}
            xp = _xp_total(connection, session["student_nid"])
            return {
                "actor_type": "student",
                "student": student,
                "xp": xp,
                "payload": session.get("payload") or {},
            }
        return {
            "actor_type": "parent",
            "children": (session.get("payload") or {}).get("children") or [],
            "payload": session.get("payload") or {},
        }
    finally:
        connection.close()


@router.post("/api/portal/logout")
def portal_logout(x_portal_token: str = Header(default="")):
    tok = str(x_portal_token or "").strip()
    if not tok:
        return {"ok": True}
    connection = connect()
    try:
        connection.execute("DELETE FROM portal_sessions WHERE token = ?", (tok,))
        connection.commit()
        return {"ok": True}
    finally:
        connection.close()


@router.get("/api/portal/student/home")
def portal_student_home(x_portal_token: str = Header(default="")):
    session = _require_portal(x_portal_token, ("student",))
    nid = session["student_nid"]
    connection = connect()
    try:
        _ensure(connection)
        student = find_student(connection, nid) or {}
        xp = _xp_total(connection, nid)
        recent = connection.execute(
            """
            SELECT mode, score_pct, xp_earned, finished_at, badge
            FROM (
              SELECT mode, score_pct, xp_earned, finished_at,
                     '' AS badge
              FROM portal_challenge_runs
              WHERE student_nid = ? AND finished_at != ''
              ORDER BY id DESC
              LIMIT 5
            )
            """,
            (nid,),
        ).fetchall()
        # enrich badges from detail_json
        runs = []
        for row in connection.execute(
            """
            SELECT mode, score_pct, xp_earned, finished_at, detail_json
            FROM portal_challenge_runs
            WHERE student_nid = ? AND finished_at != ''
            ORDER BY id DESC LIMIT 5
            """,
            (nid,),
        ):
            detail = {}
            try:
                detail = json.loads(row[4] or "{}")
            except json.JSONDecodeError:
                detail = {}
            runs.append(
                {
                    "mode": row[0],
                    "label": MODE_CONFIG.get(row[0], {}).get("label", row[0]),
                    "score_pct": row[1],
                    "xp_earned": row[2],
                    "finished_at": row[3],
                    "badge": detail.get("badge") or "",
                }
            )
        remedial = [
            {
                "subject": r[0],
                "skill": r[1],
                "plan": r[2],
                "status": r[3],
                "follow_up_date": r[4],
            }
            for r in connection.execute(
                """
                SELECT subject, skill, plan, status, follow_up_date
                FROM teacher_remedial
                WHERE student_id = ?
                ORDER BY id DESC LIMIT 10
                """,
                (nid,),
            )
        ]
        behavior = [
            {"program": r[0], "points": r[1], "note": r[2], "created_at": r[3]}
            for r in connection.execute(
                """
                SELECT program, points, note, created_at
                FROM portal_behavior_points
                WHERE student_nid = ?
                ORDER BY id DESC LIMIT 20
                """,
                (nid,),
            )
        ]
        behavior_totals = _behavior_totals(connection, nid)
        vouchers = [
            {"id": r[0], "title": r[1], "points_cost": r[2], "status": r[3], "created_at": r[4]}
            for r in connection.execute(
                """
                SELECT id, title, points_cost, status, created_at
                FROM portal_cafeteria_vouchers
                WHERE student_nid = ?
                ORDER BY id DESC LIMIT 10
                """,
                (nid,),
            )
        ]
        talent = connection.execute(
            "SELECT best_score, status FROM portal_talent_candidates WHERE student_nid = ?",
            (nid,),
        ).fetchone()
        return {
            "student": student,
            "xp": xp,
            "modes": MODE_CONFIG,
            "recent_runs": runs,
            "remedial": remedial,
            "behavior": behavior,
            "behavior_totals": behavior_totals,
            "cafeteria_vouchers": vouchers,
            "talent": (
                {"nominated": True, "best_score": talent[0], "status": talent[1]}
                if talent
                else {"nominated": False}
            ),
            "powerups": [
                {"id": "fifty", "label": "حذف إجابتين (٥٠:٥٠)", "per_run": 1},
                {"id": "hint", "label": "تلميح المعلم", "per_run": 1},
                {"id": "freeze", "label": "تجميد الوقت +١٥ ث", "per_run": 1},
            ],
        }
    finally:
        connection.close()


@router.post("/api/portal/challenge/start")
def portal_challenge_start(body: StartChallengeBody, x_portal_token: str = Header(default="")):
    session = _require_portal(x_portal_token, ("student",))
    mode = str(body.mode or MODE_DAILY).strip().lower()
    if mode not in MODE_CONFIG:
        raise HTTPException(status_code=400, detail="نمط التحدي غير معروف.")
    cfg = MODE_CONFIG[mode]
    connection = connect()
    try:
        _ensure(connection)
        questions = _pick_questions(connection, mode, str(body.domain or "").strip().lower(), cfg["count"])
        if not questions:
            raise HTTPException(status_code=404, detail="بنك الأسئلة فارغ.")
        started = _iso()
        detail: dict[str, Any] = {
            "question_ids": [q["id"] for q in questions],
            "correct_map": {str(q["id"]): q["correct"] for q in questions},
            "questions_full": {
                str(q["id"]): {
                    "stem": q.get("stem") or "",
                    "rationale": q.get("rationale") or "",
                    "choices": q.get("choices") or {},
                    "parametric": bool(q.get("parametric")),
                    "domain": q.get("domain") or "",
                    "skill": q.get("skill") or "",
                    "common_mistake": q.get("common_mistake") or "",
                    "grade_root": q.get("grade_root") or "",
                    "golden_rule": q.get("golden_rule") or "",
                }
                for q in questions
            },
            "seconds": cfg["seconds"],
            "xp_mult": cfg["xp_mult"],
            "powerups_left": {"fifty": 1, "hint": 1, "freeze": 1},
        }
        ghost = None
        if mode == MODE_DUEL:
            ghost = _pick_ghost(connection, session["student_nid"], len(questions), cfg["seconds"])
            detail["ghost"] = ghost
        cur = connection.execute(
            """
            INSERT INTO portal_challenge_runs
            (student_nid, mode, started_at, total_questions, domain_focus, detail_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                session["student_nid"],
                mode,
                started,
                len(questions),
                str(body.domain or ""),
                json.dumps(detail, ensure_ascii=False),
            ),
        )
        run_id = int(cur.lastrowid)
        connection.commit()
        payload = {
            "run_id": run_id,
            "mode": mode,
            "label": cfg["label"],
            "seconds": cfg["seconds"],
            "xp_mult": cfg["xp_mult"],
            "questions": [_public_question(q) for q in questions],
            "powerups_left": {"fifty": 1, "hint": 1, "freeze": 1},
        }
        if ghost:
            payload["ghost"] = ghost
            payload["duel"] = True
        return payload
    finally:
        connection.close()


@router.post("/api/portal/challenge/check")
def portal_challenge_check(body: CheckAnswerBody, x_portal_token: str = Header(default="")):
    """تحقق فوري مع بطاقة «احذر الفخ» عند الخطأ."""
    session = _require_portal(x_portal_token, ("student",))
    connection = connect()
    try:
        _ensure(connection)
        row = connection.execute(
            "SELECT student_nid, detail_json FROM portal_challenge_runs WHERE id = ? AND finished_at = ''",
            (body.run_id,),
        ).fetchone()
        if not row or row[0] != session["student_nid"]:
            raise HTTPException(status_code=404, detail="جولة غير موجودة.")
        detail = json.loads(row[1] or "{}")
        qid = str(body.question_id)
        expected = str((detail.get("correct_map") or {}).get(qid) or "").upper()
        choice = str(body.choice or "").upper()
        ok = bool(expected) and choice == expected
        q_full = (detail.get("questions_full") or {}).get(qid) or {}
        payload = {
            "ok": ok,
            "question_id": body.question_id,
            "choice": choice,
        }
        if not ok:
            from .nafs_misconception_lab import SKILL_ROOTS, SKILL_TRAPS, ETEC_INDICATORS

            skill = q_full.get("skill") or ""
            domain = q_full.get("domain") or ""
            trap = SKILL_TRAPS.get(skill) or (
                q_full.get("golden_rule") or "راجع القاعدة الذهبية للمهارة.",
                q_full.get("common_mistake") or "خطأ شائع في هذه المهارة.",
            )
            rule, mistake = trap
            mistake = q_full.get("common_mistake") or mistake
            rule = q_full.get("golden_rule") or rule
            root = q_full.get("grade_root") or SKILL_ROOTS.get(skill, "٣م")
            try:
                from .nafs_misconception_lab import SCHEMA_EXTRA

                connection.executescript(SCHEMA_EXTRA)
            except Exception:
                pass
            connection.execute(
                """
                INSERT INTO portal_misconception_events(
                  student_nid, question_id, domain, skill, chosen, correct, trap_key, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session["student_nid"],
                    body.question_id,
                    domain,
                    skill,
                    choice,
                    expected,
                    skill or domain,
                    _iso(),
                ),
            )
            connection.commit()
            payload["trap"] = {
                "title": "احذر الفخ!",
                "common_mistake": mistake,
                "golden_rule": rule,
                "grade_root": root,
                "domain": domain,
                "skill": skill,
                "etec": ETEC_INDICATORS.get(domain, {}),
                "rationale": q_full.get("rationale") or "",
            }
        else:
            connection.commit()
        return payload
    finally:
        connection.close()


@router.get("/api/portal/challenge/duel-progress")
def portal_duel_progress(run_id: int, elapsed_sec: float = 0, answered: int = 0, x_portal_token: str = Header(default="")):
    """شريط تقدم الخصم الشبح في المبارزة حسب الزمن المنقضي."""
    session = _require_portal(x_portal_token, ("student",))
    connection = connect()
    try:
        _ensure(connection)
        row = connection.execute(
            "SELECT student_nid, mode, detail_json, total_questions FROM portal_challenge_runs WHERE id = ?",
            (run_id,),
        ).fetchone()
        if not row or row[0] != session["student_nid"]:
            raise HTTPException(status_code=404, detail="جولة غير موجودة.")
        detail = json.loads(row[2] or "{}")
        ghost = detail.get("ghost") or {}
        pace = ghost.get("ghost_pace_sec") or []
        ghost_answered = sum(1 for t in pace if float(elapsed_sec) >= float(t))
        total = max(int(row[3] or len(pace) or 1), 1)
        return {
            "run_id": run_id,
            "you_answered": int(answered),
            "you_pct": round(100.0 * int(answered) / total, 1),
            "ghost_name": ghost.get("ghost_name") or "زميل",
            "ghost_answered": min(ghost_answered, total),
            "ghost_pct": round(100.0 * min(ghost_answered, total) / total, 1),
            "ghost_target_score": ghost.get("ghost_target_score"),
        }
    finally:
        connection.close()


@router.post("/api/portal/challenge/powerup")
def portal_challenge_powerup(body: PowerupBody, x_portal_token: str = Header(default="")):
    session = _require_portal(x_portal_token, ("student",))
    connection = connect()
    try:
        _ensure(connection)
        row = connection.execute(
            "SELECT student_nid, detail_json FROM portal_challenge_runs WHERE id = ? AND finished_at = ''",
            (body.run_id,),
        ).fetchone()
        if not row or row[0] != session["student_nid"]:
            raise HTTPException(status_code=404, detail="جولة غير موجودة.")
        detail = json.loads(row[1] or "{}")
        left = detail.get("powerups_left") or {}
        key = str(body.powerup or "").strip().lower()
        if key not in ("fifty", "hint", "freeze"):
            raise HTTPException(status_code=400, detail="بطاقة مساعدة غير معروفة.")
        if int(left.get(key) or 0) <= 0:
            raise HTTPException(status_code=400, detail="استُهلكت هذه البطاقة في الجولة.")
        left[key] = int(left.get(key) or 0) - 1
        detail["powerups_left"] = left
        result: dict[str, Any] = {"powerup": key, "powerups_left": left}
        qid = int(body.question_id or 0)
        if key == "fifty" and qid:
            cmap = detail.get("correct_map") or {}
            correct = str(cmap.get(str(qid)) or "A").upper()
            options = [c for c in ("A", "B", "C", "D") if c != correct]
            random.shuffle(options)
            result["remove"] = options[:2]
            result["keep"] = [correct, options[2]]
        elif key == "hint" and qid:
            q_full = (detail.get("questions_full") or {}).get(str(qid)) or {}
            if q_full.get("rationale") or q_full.get("skill"):
                text = str(q_full.get("rationale") or q_full.get("skill") or "")
                result["hint"] = text[:48] + ("…" if len(text) > 48 else "")
            else:
                qrow = connection.execute(
                    "SELECT rationale, skill FROM nafs_question_bank WHERE id = ?",
                    (qid,),
                ).fetchone()
                result["hint"] = (qrow[1] if qrow else "") or "راجع المهارة المستهدفة ثم استبعد الخيارات البعيدة."
                if qrow and qrow[0]:
                    # تلميح جزئي بلا كشف الإجابة كاملة
                    text = str(qrow[0])
                    result["hint"] = text[:48] + ("…" if len(text) > 48 else "")
        elif key == "freeze":
            result["extra_seconds"] = 15
        connection.execute(
            "UPDATE portal_challenge_runs SET detail_json = ? WHERE id = ?",
            (json.dumps(detail, ensure_ascii=False), body.run_id),
        )
        connection.execute(
            """
            INSERT INTO portal_powerup_uses(student_nid, run_id, powerup, used_at)
            VALUES (?, ?, ?, ?)
            """,
            (session["student_nid"], body.run_id, key, _iso()),
        )
        connection.commit()
        return result
    finally:
        connection.close()


@router.post("/api/portal/challenge/finish")
def portal_challenge_finish(body: FinishBody, x_portal_token: str = Header(default="")):
    session = _require_portal(x_portal_token, ("student",))
    connection = connect()
    try:
        _ensure(connection)
        row = connection.execute(
            """
            SELECT student_nid, mode, started_at, total_questions, detail_json
            FROM portal_challenge_runs WHERE id = ? AND finished_at = ''
            """,
            (body.run_id,),
        ).fetchone()
        if not row or row[0] != session["student_nid"]:
            raise HTTPException(status_code=404, detail="جولة غير موجودة.")
        detail = json.loads(row[4] or "{}")
        correct_map = detail.get("correct_map") or {}
        xp_mult = int(detail.get("xp_mult") or MODE_CONFIG.get(row[1], {}).get("xp_mult") or 1)
        answers = body.answers or []
        correct_count = 0
        xp = 0
        streak = 0
        best_streak = 0
        reviewed = []
        for ans in answers:
            qid = str(ans.get("question_id") or "")
            choice = str(ans.get("choice") or "").upper()
            elapsed = float(ans.get("elapsed_sec") or 0)
            expected = str(correct_map.get(qid) or "").upper()
            is_ok = bool(expected) and choice == expected
            if is_ok:
                correct_count += 1
                streak += 1
                best_streak = max(best_streak, streak)
                gain = 10
                if elapsed and elapsed <= 12:
                    gain += 5
                if streak >= 3:
                    gain *= 2
                gain *= xp_mult
                xp += gain
            else:
                streak = 0
            q_full = (detail.get("questions_full") or {}).get(qid) or {}
            stem = q_full.get("stem") or ""
            rationale = q_full.get("rationale") or ""
            qid_int = 0
            try:
                qid_int = int(qid)
            except ValueError:
                qid_int = 0
            if not stem and qid_int > 0:
                qrow = connection.execute(
                    "SELECT stem, rationale, choice_a, choice_b, choice_c, choice_d FROM nafs_question_bank WHERE id = ?",
                    (qid_int,),
                ).fetchone()
                stem = (qrow[0] if qrow else "") or ""
                rationale = (qrow[1] if qrow else "") or rationale
            reviewed.append(
                {
                    "question_id": qid_int,
                    "choice": choice,
                    "correct": expected,
                    "ok": is_ok,
                    "rationale": rationale,
                    "stem": stem,
                }
            )
        total = max(int(row[3] or len(answers) or 1), 1)
        score_pct = round(100.0 * correct_count / total, 1)
        prev = connection.execute(
            """
            SELECT score_pct FROM portal_challenge_runs
            WHERE student_nid = ? AND finished_at != '' AND id != ?
            ORDER BY id DESC LIMIT 1
            """,
            (session["student_nid"], body.run_id),
        ).fetchone()
        prev_best = float(prev[0]) if prev and prev[0] is not None else None
        badge = _badge_for(score_pct, prev_best)
        detail["badge"] = badge
        detail["review"] = reviewed
        ghost = detail.get("ghost") or {}
        duel_result = None
        if row[1] == MODE_DUEL and ghost:
            duel_result = {
                "ghost_name": ghost.get("ghost_name") or "زميل",
                "ghost_target_score": ghost.get("ghost_target_score"),
                "you_score": score_pct,
                "won": score_pct >= float(ghost.get("ghost_target_score") or 0),
            }
            detail["duel_result"] = duel_result
        finished = _iso()
        started = datetime.fromisoformat(str(row[2]))
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        duration = max(0, int((_now() - started).total_seconds()))
        connection.execute(
            """
            UPDATE portal_challenge_runs
            SET finished_at = ?, duration_sec = ?, correct_count = ?, score_pct = ?,
                xp_earned = ?, streak_best = ?, detail_json = ?
            WHERE id = ?
            """,
            (finished, duration, correct_count, score_pct, xp, best_streak, json.dumps(detail, ensure_ascii=False), body.run_id),
        )
        if xp:
            connection.execute(
                """
                INSERT INTO portal_xp_ledger(student_nid, event_type, xp, meta_json, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    session["student_nid"],
                    f"challenge:{row[1]}",
                    xp,
                    json.dumps({"run_id": body.run_id, "score_pct": score_pct}, ensure_ascii=False),
                    finished,
                ),
            )
        # نقاط سلوك رمزية عند التميز
        if score_pct >= 90:
            connection.execute(
                """
                INSERT INTO portal_behavior_points(student_nid, program, points, note, created_at)
                VALUES (?, 'قدوة', 2, 'تميز في تحدي نافس', ?)
                """,
                (session["student_nid"], finished),
            )
        if score_pct >= 80 and best_streak >= 3:
            connection.execute(
                """
                INSERT INTO portal_behavior_points(student_nid, program, points, note, created_at)
                VALUES (?, 'رفق', 1, 'سلسلة إجابات صحيحة متواصلة', ?)
                """,
                (session["student_nid"], finished),
            )
        behavior_totals = _behavior_totals(connection, session["student_nid"])
        voucher = _ensure_cafeteria_voucher(connection, session["student_nid"], int(behavior_totals.get("total") or 0))
        talent_flag = None
        risk_flag = None
        try:
            from .portal_radar_api import (
                ensure_radar_tables,
                evaluate_performance_risk,
                maybe_nominate_talent,
            )

            ensure_radar_tables(connection)
            talent_flag = maybe_nominate_talent(connection, session["student_nid"], score_pct, body.run_id)
            risk_flag = evaluate_performance_risk(connection, session["student_nid"])
        except Exception:
            talent_flag = None
            risk_flag = None
        connection.commit()
        return {
            "run_id": body.run_id,
            "correct_count": correct_count,
            "total": total,
            "score_pct": score_pct,
            "xp_earned": xp,
            "xp_total": _xp_total(connection, session["student_nid"]),
            "streak_best": best_streak,
            "badge": badge,
            "review": reviewed,
            "duel": duel_result,
            "behavior_totals": behavior_totals,
            "cafeteria_voucher": voucher,
            "talent": talent_flag,
            "risk_alert": risk_flag,
        }
    finally:
        connection.close()


def _period_start(kind: str) -> str:
    now = _now()
    if kind == "day":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif kind == "week":
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return _iso(start)


@router.get("/api/portal/leaderboards")
def portal_leaderboards(x_portal_token: str = Header(default="")):
    _require_portal(x_portal_token)
    connection = connect()
    try:
        _ensure(connection)

        def board(kind: str) -> list[dict]:
            start = _period_start(kind)
            rows = connection.execute(
                """
                SELECT r.student_nid, s.name, s.grade, s.classroom,
                       SUM(r.xp_earned) AS xp, AVG(r.score_pct) AS avg_score, COUNT(*) AS runs
                FROM portal_challenge_runs r
                LEFT JOIN noor_students s ON s.national_id = r.student_nid
                WHERE r.finished_at >= ? AND r.finished_at != ''
                GROUP BY r.student_nid
                ORDER BY xp DESC, avg_score DESC
                LIMIT 20
                """,
                (start,),
            ).fetchall()
            return [
                {
                    "rank": i + 1,
                    "national_id": row[0],
                    "name": row[1] or "",
                    "grade": row[2] or "",
                    "section": row[3] or "",
                    "xp": int(row[4] or 0),
                    "avg_score": round(float(row[5] or 0), 1),
                    "runs": int(row[6] or 0),
                }
                for i, row in enumerate(rows)
            ]

        class_rows = connection.execute(
            """
            SELECT s.grade, s.classroom, SUM(r.xp_earned) AS xp, COUNT(DISTINCT r.student_nid) AS students
            FROM portal_challenge_runs r
            JOIN noor_students s ON s.national_id = r.student_nid
            WHERE r.finished_at >= ? AND r.finished_at != ''
            GROUP BY s.grade, s.classroom
            ORDER BY xp DESC
            """,
            (_period_start("week"),),
        ).fetchall()
        classes = [
            {
                "rank": i + 1,
                "label": _section_key(row[0] or "", row[1] or ""),
                "grade": row[0] or "",
                "section": row[1] or "",
                "xp": int(row[2] or 0),
                "students": int(row[3] or 0),
            }
            for i, row in enumerate(class_rows)
            if (row[0] or row[1])
        ]
        return {
            "day": board("day"),
            "week": board("week"),
            "month": board("month"),
            "classes_week": classes,
        }
    finally:
        connection.close()


@router.post("/api/portal/counseling")
def portal_counseling(body: CounselBody, x_portal_token: str = Header(default="")):
    session = _require_portal(x_portal_token, ("student",))
    msg = str(body.message or "").strip()
    if len(msg) < 5:
        raise HTTPException(status_code=400, detail="نص الاستشارة قصير جداً.")
    connection = connect()
    try:
        _ensure(connection)
        student = find_student(connection, session["student_nid"]) or {}
        connection.execute(
            """
            INSERT INTO portal_counseling(student_nid, student_name, message, status, created_at)
            VALUES (?, ?, ?, 'new', ?)
            """,
            (session["student_nid"], student.get("name") or session.get("display_name") or "", msg, _iso()),
        )
        connection.commit()
        return {"ok": True, "message": "وُجّهت استشارتك بسرية إلى الموجه الطلابي."}
    finally:
        connection.close()


@router.get("/api/portal/parent/home")
def portal_parent_home(x_portal_token: str = Header(default="")):
    session = _require_portal(x_portal_token, ("parent",))
    children = (session.get("payload") or {}).get("children") or []
    connection = connect()
    try:
        _ensure(connection)
        out = []
        for child in children:
            nid = child.get("national_id") or ""
            runs = connection.execute(
                """
                SELECT mode, score_pct, xp_earned, finished_at
                FROM portal_challenge_runs
                WHERE student_nid = ? AND finished_at != ''
                ORDER BY id DESC LIMIT 8
                """,
                (nid,),
            ).fetchall()
            remedial = connection.execute(
                """
                SELECT subject, skill, status, follow_up_date
                FROM teacher_remedial WHERE student_id = ? ORDER BY id DESC LIMIT 8
                """,
                (nid,),
            ).fetchall()
            out.append(
                {
                    "student": child,
                    "xp": _xp_total(connection, nid),
                    "runs": [
                        {
                            "mode": r[0],
                            "label": MODE_CONFIG.get(r[0], {}).get("label", r[0]),
                            "score_pct": r[1],
                            "xp_earned": r[2],
                            "finished_at": r[3],
                        }
                        for r in runs
                    ],
                    "remedial": [
                        {"subject": r[0], "skill": r[1], "status": r[2], "follow_up_date": r[3]}
                        for r in remedial
                    ],
                }
            )
        return {"children": out}
    finally:
        connection.close()
