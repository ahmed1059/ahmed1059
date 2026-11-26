# المرحلة ٤: نواة التوجيه والتحفيز — قدوة/رفق/مقصف/نخبة + صندوق عمل الموجّه.
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .database import connect

router = APIRouter(tags=["nafs-counsel-boost"])

EASTERN = "٠١٢٣٤٥٦٧٨٩"
ETEC_BEHAVIOR = {"code": "2-1-1-5", "code_ar": "٢-١-١-٥", "label": "السلوك والانضباط الإيجابي"}

# بطاقة شرح للطالب — نصوص من قواعد التحفيز المحفوظة فقط (بلا مفاتيح تقنية).
CAFETERIA_POINTS_PER_VOUCHER = 5
STUDENT_BOOST_LEGEND = {
    "قدوة": "تميّز وتحصيل وانضباط إيجابي",
    "رفق": "التزام يومي ومساندة زميل أو أسرة",
    "مقصف": "قسيمة مقصف لكل ٥ نقاط مجموع من قدوة ورفق",
}
STUDENT_BOOST_HOWTO = {
    "قدوة": (
        "نتيجة عالية في التحدي، أو تصفية أخطاء جيدة، أو استعادة مهارة، أو صدارة أسبوعية في الفصل."
    ),
    "رفق": (
        "التزام يومي مناسب، أو سلسلة جيدة مع نتيجة مرتفعة، أو إتقان بطاقة ذهبية."
    ),
    "مقصف": (
        "كل ٥ نقاط مجموع (قدوة + رفق) تمنحك قسيمة مقصف مستحقة مرة لكل عتبة."
    ),
}

COUNSEL_SCHEMA = """
CREATE TABLE IF NOT EXISTS portal_counseling (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    student_name TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL,
    counselor_note TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'عام',
    updated_at TEXT NOT NULL DEFAULT '',
    closed_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS portal_behavior_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    program TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
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
CREATE TABLE IF NOT EXISTS portal_xp_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    event_type TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    meta_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
"""


def _e(value: Any) -> str:
    return "".join(EASTERN[int(c)] if c.isdigit() else ("٪" if c == "%" else c) for c in str(value))


def _iso(dt: datetime | None = None) -> str:
    return (dt or datetime.now(timezone.utc)).replace(microsecond=0).isoformat()


def _day_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _week_key() -> str:
    now = datetime.now(timezone.utc)
    return f"{now.isocalendar().year}-W{now.isocalendar().week:02d}"


def ensure_counsel_boost(connection) -> None:
    """توسيع جداول قائمة فقط — بلا قواعد موازية."""
    from .portal_radar_api import ensure_radar_tables

    connection.executescript(COUNSEL_SCHEMA)
    ensure_radar_tables(connection)
    cols = {r[1] for r in connection.execute("PRAGMA table_info(portal_counseling)").fetchall()}
    if "category" not in cols:
        connection.execute(
            "ALTER TABLE portal_counseling ADD COLUMN category TEXT NOT NULL DEFAULT 'عام'"
        )
    if "updated_at" not in cols:
        connection.execute(
            "ALTER TABLE portal_counseling ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''"
        )
    if "closed_at" not in cols:
        connection.execute(
            "ALTER TABLE portal_counseling ADD COLUMN closed_at TEXT NOT NULL DEFAULT ''"
        )


def _already_awarded(connection, student_nid: str, event_key: str) -> bool:
    row = connection.execute(
        """
        SELECT 1 FROM portal_behavior_points
        WHERE student_nid = ? AND note LIKE ?
        LIMIT 1
        """,
        (student_nid, f"%[{event_key}]%"),
    ).fetchone()
    return bool(row)


def _award(
    connection,
    student_nid: str,
    program: str,
    points: int,
    note: str,
    event_key: str,
) -> dict | None:
    if points <= 0:
        return None
    if _already_awarded(connection, student_nid, event_key):
        return None
    stamped = _iso()
    full_note = f"{note} [{event_key}]"
    connection.execute(
        """
        INSERT INTO portal_behavior_points(student_nid, program, points, note, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (student_nid, program, int(points), full_note, stamped),
    )
    return {
        "program": program,
        "points": int(points),
        "note": note,
        "event_key": event_key,
        "at": stamped,
    }


def _behavior_totals(connection, student_nid: str) -> dict:
    from .portal_session_api import _behavior_totals as totals_fn

    return totals_fn(connection, student_nid)


def _maybe_voucher(connection, student_nid: str) -> dict | None:
    from .portal_session_api import _ensure_cafeteria_voucher

    totals = _behavior_totals(connection, student_nid)
    return _ensure_cafeteria_voucher(connection, student_nid, int(totals.get("total") or 0))


def _elite_rank(connection, student_nid: str) -> dict | None:
    """نخبة الصف: ضمن أعلى ٣ في الفصل بأسبوع XP الحالي."""
    row = connection.execute(
        "SELECT classroom, name, grade FROM noor_students WHERE national_id = ?",
        (student_nid,),
    ).fetchone()
    if not row or not (row[0] or "").strip():
        return None
    section = row[0]
    week = _week_key()
    # تقريب أسبوعي عبر تاريخ ISO في ledger
    since = _iso(datetime.now(timezone.utc) - timedelta(days=7))
    peers = connection.execute(
        """
        SELECT s.national_id, COALESCE(SUM(x.xp),0) AS xp
        FROM noor_students s
        LEFT JOIN portal_xp_ledger x
          ON x.student_nid = s.national_id AND x.created_at >= ?
        WHERE COALESCE(s.classroom,'') = ?
        GROUP BY s.national_id
        ORDER BY xp DESC
        LIMIT 5
        """,
        (since, section),
    ).fetchall()
    ranks = [r[0] for r in peers if int(r[1] or 0) > 0]
    if student_nid not in ranks[:3]:
        return None
    place = ranks.index(student_nid) + 1
    return {
        "section": section,
        "name": row[1] or "",
        "grade": row[2] or "",
        "place": place,
        "week_key": week,
    }


def apply_challenge_boosts(
    connection,
    student_nid: str,
    *,
    mode: str,
    score_pct: float,
    best_streak: int,
    run_id: int = 0,
) -> dict:
    """قواعد موحدة بعد إنهاء جولة نافس — مع منع التكرار اليومي بالمفتاح."""
    ensure_counsel_boost(connection)
    day = _day_key()
    awards: list[dict] = []
    mode = (mode or "").strip().lower()
    score_pct = float(score_pct or 0)
    best_streak = int(best_streak or 0)

    # تميز عام → قدوة (مفتاح يومي حسب العتبة)
    if score_pct >= 90:
        hit = _award(
            connection,
            student_nid,
            "قدوة",
            2,
            "تميز في تحدي نافس (≥٩٠٪)",
            f"qodwa-high-{day}-{mode}",
        )
        if hit:
            awards.append(hit)
    elif score_pct >= 80 and best_streak >= 3:
        hit = _award(
            connection,
            student_nid,
            "رفق",
            1,
            "سلسلة إجابات صحيحة متواصلة",
            f"rifq-streak-{day}-{mode}",
        )
        if hit:
            awards.append(hit)

    # الالتزام اليومي
    if mode == "daily" and score_pct >= 60:
        hit = _award(
            connection,
            student_nid,
            "رفق",
            1,
            "التزام يومي بتحدي نافس",
            f"rifq-daily-{day}",
        )
        if hit:
            awards.append(hit)

    # تطهير الأخطاء العالقة
    if mode == "purge" and score_pct >= 70:
        hit = _award(
            connection,
            student_nid,
            "قدوة",
            2,
            "تطهير أخطاء عالقة بنجاح",
            f"qodwa-purge-{day}",
        )
        if hit:
            awards.append(hit)

    # استعادة من vault خلال اليوم
    try:
        recovered_today = connection.execute(
            """
            SELECT COUNT(*) FROM student_error_vault
            WHERE student_nid = ? AND status = 'recovered' AND recovered_at LIKE ?
            """,
            (student_nid, f"{day}%"),
        ).fetchone()[0]
        if int(recovered_today or 0) >= 1:
            hit = _award(
                connection,
                student_nid,
                "قدوة",
                1,
                "استعادة مهارة من مخزن الإتقان",
                f"qodwa-vault-recover-{day}",
            )
            if hit:
                awards.append(hit)
    except Exception:
        pass

    elite = _elite_rank(connection, student_nid)
    if elite:
        hit = _award(
            connection,
            student_nid,
            "قدوة",
            1,
            f"نخبة الصف — المركز {_e(elite['place'])} في فصل {elite['section']}",
            f"elite-{elite['week_key']}-{elite['section']}",
        )
        if hit:
            awards.append(hit)
            hit["elite"] = elite

    voucher = _maybe_voucher(connection, student_nid)
    totals = _behavior_totals(connection, student_nid)
    return {
        "ok": True,
        "awards": awards,
        "behavior_totals": totals,
        "cafeteria_voucher": voucher,
        "elite": elite,
        "etec": ETEC_BEHAVIOR,
    }


def apply_golden_boost(connection, student_nid: str, card_id: str) -> dict:
    ensure_counsel_boost(connection)
    hit = _award(
        connection,
        student_nid,
        "رفق",
        1,
        "إتقان بطاقة الحقيبة الذهبية",
        f"rifq-golden-{card_id}",
    )
    voucher = _maybe_voucher(connection, student_nid)
    return {
        "ok": True,
        "award": hit,
        "behavior_totals": _behavior_totals(connection, student_nid),
        "cafeteria_voucher": voucher,
        "etec": ETEC_BEHAVIOR,
    }


def build_counselor_inbox(connection, limit: int = 40) -> dict:
    """صندوق عمل الموجّه: استشارات + تنبيهات تراجع + حرارة vault."""
    ensure_counsel_boost(connection)
    from .portal_owner_api import mask_nid
    from .nafs_adaptive_engine import ensure_on_boot as ensure_vault, ETEC

    ensure_vault(connection)
    limit = max(10, min(int(limit or 40), 80))

    counseling = connection.execute(
        """
        SELECT id, student_nid, student_name, message, status, created_at,
               counselor_note, COALESCE(category,'عام'), COALESCE(updated_at,'')
        FROM portal_counseling
        WHERE status IN ('new','open','in_progress')
        ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'open' THEN 1 ELSE 2 END, id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()

    alerts = connection.execute(
        """
        SELECT id, student_nid, student_name, alert_type, detail_json, status, created_at
        FROM portal_risk_alerts
        WHERE status = 'new'
        ORDER BY id DESC LIMIT ?
        """,
        (limit,),
    ).fetchall()

    vault_hot = connection.execute(
        """
        SELECT v.student_nid, COALESCE(s.name,''), COALESCE(s.grade,''), COALESCE(s.classroom,''),
               v.domain, v.skill, COALESCE(v.grade_root,''), v.trap_heat, v.status
        FROM student_error_vault v
        LEFT JOIN noor_students s ON s.national_id = v.student_nid
        WHERE v.status IN ('open','recovering') AND v.trap_heat >= 2
        ORDER BY v.trap_heat DESC, v.last_seen DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()

    counsel_items = []
    for r in counseling:
        counsel_items.append(
            {
                "id": r[0],
                "student_nid": r[1],
                "student_nid_masked": mask_nid(r[1] or ""),
                "name": r[2] or "طالب",
                "message": r[3] or "",
                "status": r[4] or "new",
                "status_ar": {
                    "new": "جديدة",
                    "open": "مفتوحة",
                    "in_progress": "قيد المتابعة",
                    "closed": "مغلقة",
                }.get(r[4] or "new", r[4] or ""),
                "created_at": r[5] or "",
                "counselor_note": r[6] or "",
                "category": r[7] or "عام",
                "updated_at": r[8] or "",
            }
        )

    alert_items = []
    for r in alerts:
        detail = json.loads(r[4] or "{}")
        alert_type = r[3] or ""
        alert_items.append(
            {
                "id": r[0],
                "student_nid": r[1],
                "student_nid_masked": mask_nid(r[1] or ""),
                "name": r[2] or "طالب",
                "alert_type": alert_type,
                "alert_type_ar": {
                    "performance_drop": "تراجع مفاجئ في الأداء",
                    "repeated_absence": "تكرار غياب",
                    "vault_heat": "تعثر حراري في المهارات",
                }.get(alert_type, alert_type),
                "detail": detail,
                "status": r[5] or "new",
                "created_at": r[6] or "",
            }
        )

    heat_items = []
    for r in vault_hot:
        domain = r[4] or ""
        etec = ETEC.get(domain, {})
        heat_items.append(
            {
                "student_nid": r[0],
                "student_nid_masked": mask_nid(r[0] or ""),
                "name": r[1] or "طالب",
                "grade": r[2] or "",
                "section": r[3] or "",
                "domain": domain,
                "skill": r[5] or "",
                "grade_root": r[6] or "",
                "trap_heat": int(r[7] or 0),
                "status": r[8] or "",
                "etec": etec,
                "etec_code_ar": etec.get("code_ar") or _e(etec.get("code") or ""),
                "hint": "تدخل مبكر: راجع العيادة أو استدعاء أسري خفيف.",
            }
        )

    return {
        "ok": True,
        "summary": {
            "counseling_open": len(counsel_items),
            "alerts_new": len(alert_items),
            "vault_hot": len(heat_items),
        },
        "counseling": counsel_items,
        "alerts": alert_items,
        "vault_hot": heat_items,
        "etec_behavior": ETEC_BEHAVIOR,
        "legend": {
            "قدوة": STUDENT_BOOST_LEGEND["قدوة"],
            "رفق": STUDENT_BOOST_LEGEND["رفق"],
            "مقصف": STUDENT_BOOST_LEGEND["مقصف"],
            "نخبة": "صدارة أسبوعية داخل الفصل",
        },
    }


def student_boost_explain() -> dict[str, Any]:
    """بطاقة شرح مبسّطة للطالب من القواعد المحفوظة — بلا اختلاق مفاتيح تقنية."""
    threshold = CAFETERIA_POINTS_PER_VOUCHER
    return {
        "ok": True,
        "title": "قدوة ورفق والمقصف",
        "blurb": "نقاط سلوك حقيقية تُسجَّل عند إنجازك — لا مفاتيح تقنية هنا.",
        "etec": ETEC_BEHAVIOR,
        "etec_ar": ETEC_BEHAVIOR.get("code_ar") or _e(ETEC_BEHAVIOR.get("code") or ""),
        "programs": [
            {
                "id": "qodwa",
                "title": "قدوة",
                "meaning": STUDENT_BOOST_LEGEND["قدوة"],
                "howto": STUDENT_BOOST_HOWTO["قدوة"],
            },
            {
                "id": "rifq",
                "title": "رفق",
                "meaning": STUDENT_BOOST_LEGEND["رفق"],
                "howto": STUDENT_BOOST_HOWTO["رفق"],
            },
            {
                "id": "cafeteria",
                "title": "المقصف",
                "meaning": STUDENT_BOOST_LEGEND["مقصف"],
                "howto": STUDENT_BOOST_HOWTO["مقصف"],
                "threshold": threshold,
                "threshold_ar": _e(threshold),
            },
        ],
    }


def raise_vault_heat_alerts(connection, limit: int = 20) -> int:
    """يولّد تنبيه تدخّل مبكر للطلاب ذوي حرارة vault عالية (مرة لكل طالب/يوم)."""
    ensure_counsel_boost(connection)
    day = _day_key()
    rows = connection.execute(
        """
        SELECT v.student_nid, COALESCE(s.name,''), MAX(v.trap_heat)
        FROM student_error_vault v
        LEFT JOIN noor_students s ON s.national_id = v.student_nid
        WHERE v.status IN ('open','recovering') AND v.trap_heat >= 3
        GROUP BY v.student_nid
        ORDER BY MAX(v.trap_heat) DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    n = 0
    for nid, name, heat in rows:
        exists = connection.execute(
            """
            SELECT 1 FROM portal_risk_alerts
            WHERE student_nid = ? AND alert_type = 'vault_heat'
              AND created_at LIKE ? AND status = 'new'
            LIMIT 1
            """,
            (nid, f"{day}%"),
        ).fetchone()
        if exists:
            continue
        detail = {"trap_heat": int(heat or 0), "reason": "vault_heat", "day": day}
        connection.execute(
            """
            INSERT INTO portal_risk_alerts(student_nid, student_name, alert_type, detail_json, status, created_at)
            VALUES (?, ?, 'vault_heat', ?, 'new', ?)
            """,
            (nid, name or "", json.dumps(detail, ensure_ascii=False), _iso()),
        )
        n += 1
    return n


class CounselNoteBody(BaseModel):
    note: str = ""
    status: str = "in_progress"
    category: str = ""


class AlertStatusBody(BaseModel):
    status: str = "acked"


@router.get("/api/portal/counselor/inbox")
def api_counselor_inbox(limit: int = 40, x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level

    user, level = _require_level(x_session_token, 2)
    connection = connect()
    try:
        raised = raise_vault_heat_alerts(connection)
        pack = build_counselor_inbox(connection, limit=limit)
        pack["viewer"] = {"name": user.get("name") or "", "level": level}
        pack["vault_alerts_raised"] = raised
        connection.commit()
        return pack
    finally:
        connection.close()


@router.post("/api/portal/counselor/counseling/{item_id}/update")
def api_counsel_update(item_id: int, body: CounselNoteBody, x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level, _audit

    user, level = _require_level(x_session_token, 2)
    status = (body.status or "in_progress").strip().lower()
    if status not in ("new", "open", "in_progress", "closed"):
        status = "in_progress"
    connection = connect()
    try:
        ensure_counsel_boost(connection)
        row = connection.execute(
            "SELECT id FROM portal_counseling WHERE id = ?",
            (item_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="الاستشارة غير موجودة.")
        stamped = _iso()
        closed_at = stamped if status == "closed" else ""
        connection.execute(
            """
            UPDATE portal_counseling
            SET counselor_note = ?, status = ?, category = COALESCE(NULLIF(?, ''), category),
                updated_at = ?, closed_at = CASE WHEN ? != '' THEN ? ELSE closed_at END
            WHERE id = ?
            """,
            (
                (body.note or "").strip(),
                status,
                (body.category or "").strip(),
                stamped,
                closed_at,
                closed_at,
                item_id,
            ),
        )
        _audit(connection, user, "counselor.counseling.update", str(item_id), {"status": status})
        connection.commit()
        return {"ok": True, "id": item_id, "status": status, "updated_at": stamped}
    finally:
        connection.close()


@router.post("/api/portal/counselor/alerts/{alert_id}/status")
def api_alert_status(alert_id: int, body: AlertStatusBody, x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level, _audit

    user, level = _require_level(x_session_token, 2)
    status = (body.status or "acked").strip().lower()
    if status not in ("new", "acked", "closed"):
        status = "acked"
    connection = connect()
    try:
        ensure_counsel_boost(connection)
        cur = connection.execute(
            "UPDATE portal_risk_alerts SET status = ? WHERE id = ?",
            (status, alert_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="التنبيه غير موجود.")
        _audit(connection, user, "counselor.alert.status", str(alert_id), {"status": status})
        connection.commit()
        return {"ok": True, "id": alert_id, "status": status}
    finally:
        connection.close()


@router.get("/api/portal/boost/rules")
def api_boost_rules(x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level

    _require_level(x_session_token, 2)
    return {
        "ok": True,
        "etec": ETEC_BEHAVIOR,
        "rules": [
            {"when": "نتيجة ≥ ٩٠٪", "award": "قدوة +٢", "cap": "مرة/يوم لكل نمط"},
            {"when": "سلسلة ≥ ٣ ونتيجة ≥ ٨٠٪", "award": "رفق +١", "cap": "مرة/يوم لكل نمط"},
            {"when": "تحدي يومي ≥ ٦٠٪", "award": "رفق +١", "cap": "مرة/يوم"},
            {"when": "تصفية أخطاء ≥ ٧٠٪", "award": "قدوة +٢", "cap": "مرة/يوم"},
            {"when": "استعادة من vault", "award": "قدوة +١", "cap": "مرة/يوم"},
            {"when": "إتقان بطاقة ذهبية", "award": "رفق +١", "cap": "مرة/بطاقة"},
            {"when": "نخبة الصف (أعلى ٣ أسبوعياً)", "award": "قدوة +١", "cap": "مرة/أسبوع/فصل"},
            {
                "when": f"كل {_e(CAFETERIA_POINTS_PER_VOUCHER)} نقاط سلوك",
                "award": "قسيمة مقصف",
                "cap": "حسب العتبات",
            },
        ],
        "student_card": student_boost_explain(),
    }


@router.get("/api/portal/boost/explain")
def api_boost_explain(x_portal_token: str = Header(default="")):
    """شرح مبسّط للطالب — من القواعد المحفوظة فقط."""
    from .portal_session_api import _require_portal

    _require_portal(x_portal_token, ("student",))
    return student_boost_explain()
