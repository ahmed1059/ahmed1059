# مرصد الموهوبين والتدخل المبكر — ترشيح ≥٩٥٪ وتنبيهات التراجع/الغياب.
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException

from .database import connect
from .portal_owner_api import _require_level, _audit, mask_nid

router = APIRouter(tags=["portal-radar"])

SCHEMA = """
CREATE TABLE IF NOT EXISTS portal_talent_candidates (
    student_nid TEXT PRIMARY KEY,
    student_name TEXT NOT NULL DEFAULT '',
    grade TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    best_score REAL NOT NULL DEFAULT 0,
    source_run_id INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'nominated',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_risk_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    student_name TEXT NOT NULL DEFAULT '',
    alert_type TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_portal_risk_status ON portal_risk_alerts(status, created_at);
"""


def _iso(dt: datetime | None = None) -> str:
    return (dt or datetime.now(timezone.utc)).replace(microsecond=0).isoformat()


def ensure_radar_tables(connection) -> None:
    connection.executescript(SCHEMA)


def ensure_on_boot(connection) -> dict:
    ensure_radar_tables(connection)
    return {"ok": True}


def maybe_nominate_talent(connection, student_nid: str, score_pct: float, run_id: int) -> dict | None:
    """ترشيح تلقائي عند ≥ ٩٥٪."""
    if score_pct < 95:
        return None
    ensure_radar_tables(connection)
    row = connection.execute(
        "SELECT name, grade, classroom FROM noor_students WHERE national_id = ?",
        (student_nid,),
    ).fetchone()
    name = (row[0] if row else "") or ""
    grade = (row[1] if row else "") or ""
    section = (row[2] if row else "") or ""
    now = _iso()
    existing = connection.execute(
        "SELECT best_score FROM portal_talent_candidates WHERE student_nid = ?",
        (student_nid,),
    ).fetchone()
    if existing:
        if float(existing[0] or 0) < score_pct:
            connection.execute(
                """
                UPDATE portal_talent_candidates
                SET best_score = ?, source_run_id = ?, updated_at = ?, status = 'nominated'
                WHERE student_nid = ?
                """,
                (score_pct, run_id, now, student_nid),
            )
    else:
        connection.execute(
            """
            INSERT INTO portal_talent_candidates(
              student_nid, student_name, grade, section, best_score, source_run_id, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'nominated', ?, ?)
            """,
            (student_nid, name, grade, section, score_pct, run_id, now, now),
        )
    return {"student_nid": student_nid, "score_pct": score_pct, "status": "nominated"}


def evaluate_performance_risk(connection, student_nid: str) -> dict | None:
    """تنبيه عند تراجع واضح في آخر الجولات."""
    ensure_radar_tables(connection)
    rows = connection.execute(
        """
        SELECT score_pct FROM portal_challenge_runs
        WHERE student_nid = ? AND finished_at != ''
        ORDER BY id DESC LIMIT 4
        """,
        (student_nid,),
    ).fetchall()
    if len(rows) < 3:
        return None
    scores = [float(r[0] or 0) for r in rows]
    latest = scores[0]
    prev_avg = sum(scores[1:]) / len(scores[1:])
    if latest + 20 <= prev_avg or (latest < 50 and prev_avg >= 70):
        name_row = connection.execute(
            "SELECT name FROM noor_students WHERE national_id = ?",
            (student_nid,),
        ).fetchone()
        detail = {"latest": latest, "prev_avg": round(prev_avg, 1), "reason": "performance_drop"}
        connection.execute(
            """
            INSERT INTO portal_risk_alerts(student_nid, student_name, alert_type, detail_json, status, created_at)
            VALUES (?, ?, 'performance_drop', ?, 'new', ?)
            """,
            (student_nid, (name_row[0] if name_row else "") or "", json.dumps(detail, ensure_ascii=False), _iso()),
        )
        return detail
    return None


def evaluate_absence_risk(connection, student_nid: str) -> dict | None:
    """تنبيه عند تكرار أعذار الغياب خلال ١٤ يوماً."""
    ensure_radar_tables(connection)
    since = _iso(datetime.now(timezone.utc) - timedelta(days=14))
    count = connection.execute(
        """
        SELECT COUNT(*) FROM portal_absence_excuses
        WHERE student_nid = ? AND created_at >= ?
        """,
        (student_nid, since),
    ).fetchone()[0]
    if int(count or 0) < 2:
        return None
    name_row = connection.execute(
        "SELECT name FROM noor_students WHERE national_id = ?",
        (student_nid,),
    ).fetchone()
    detail = {"absences_14d": int(count), "reason": "repeated_absence"}
    connection.execute(
        """
        INSERT INTO portal_risk_alerts(student_nid, student_name, alert_type, detail_json, status, created_at)
        VALUES (?, ?, 'repeated_absence', ?, 'new', ?)
        """,
        (student_nid, (name_row[0] if name_row else "") or "", json.dumps(detail, ensure_ascii=False), _iso()),
    )
    return detail


@router.get("/api/portal/radar/talent")
def radar_talent(x_session_token: str = Header(default="")):
    user, level = _require_level(x_session_token, 2)
    connection = connect()
    try:
        ensure_radar_tables(connection)
        rows = connection.execute(
            """
            SELECT student_nid, student_name, grade, section, best_score, status, updated_at
            FROM portal_talent_candidates
            ORDER BY best_score DESC, updated_at DESC
            """
        ).fetchall()
        _audit(connection, user, "radar.talent.view", str(len(rows)))
        connection.commit()
        return {
            "items": [
                {
                    "national_id_masked": mask_nid(r[0]),
                    "name": r[1],
                    "grade": r[2],
                    "section": r[3],
                    "best_score": r[4],
                    "status": r[5],
                    "updated_at": r[6],
                }
                for r in rows
            ]
        }
    finally:
        connection.close()


@router.get("/api/portal/radar/alerts")
def radar_alerts(x_session_token: str = Header(default="")):
    user, level = _require_level(x_session_token, 2)
    connection = connect()
    try:
        ensure_radar_tables(connection)
        rows = connection.execute(
            """
            SELECT id, student_nid, student_name, alert_type, detail_json, status, created_at
            FROM portal_risk_alerts
            ORDER BY id DESC LIMIT 100
            """
        ).fetchall()
        _audit(connection, user, "radar.alerts.view", str(len(rows)))
        connection.commit()
        return {
            "items": [
                {
                    "id": r[0],
                    "national_id_masked": mask_nid(r[1]),
                    "name": r[2],
                    "alert_type": r[3],
                    "detail": json.loads(r[4] or "{}"),
                    "status": r[5],
                    "created_at": r[6],
                }
                for r in rows
            ]
        }
    finally:
        connection.close()
