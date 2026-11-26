# المرحلة ٦: جسر البرامج النوعية والإثراء ومنصات التتويج — من SSOT نافس إلى موهبة/إثراء.
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .database import connect

router = APIRouter(tags=["nafs-enrich-bridge"])

SCHOOL_STAT = "40341"
SCHOOL_STAT_AR = "٤٠٣٤١"
SCHOOL_NAME = "متوسطة سعد بن الربيع الأنصاري"
EASTERN = "٠١٢٣٤٥٦٧٨٩"
SOURCE_TAG = "nafs-enrich-bridge-v1"

PROGRAM_TRACKS = {
    "talent": {
        "key": "talent",
        "label": "موهبة",
        "program_name": "رعاية الموهوبين والمبتكرين",
        "etec": "3-1-1-2",
        "etec_ar": "٣-١-١-٢",
        "hint": "ترشيح ≥٩٥٪ أو مؤشر إتقان مرتفع",
    },
    "enrichment": {
        "key": "enrichment",
        "label": "إثراء",
        "program_name": "برامج الإثراء المدرسية",
        "etec": "3-1-1-3",
        "etec_ar": "٣-١-١-٣",
        "hint": "صدارة أسبوعية أو إتقان مستقر",
    },
    "reader": {
        "key": "reader",
        "label": "قارئ الحصيف",
        "program_name": "قارئ الحصيف",
        "etec": "3-1-1-1",
        "etec_ar": "٣-١-١-١",
        "hint": "قراءة متزامنة / إتقان قراءة",
    },
    "numbers": {
        "key": "numbers",
        "label": "تحدي الأرقام",
        "program_name": "تحدي الأرقام",
        "etec": "3-1-1-2",
        "etec_ar": "٣-١-١-٢",
        "hint": "حساب ذهني / رياضيات / تطهير",
    },
}


def _e(value: Any) -> str:
    return "".join(EASTERN[int(c)] if c.isdigit() else ("٪" if c == "%" else c) for c in str(value))


def _iso(dt: datetime | None = None) -> str:
    return (dt or datetime.now(timezone.utc)).replace(microsecond=0).isoformat()


def ensure_enrich_bridge(connection) -> None:
    from .portal_radar_api import ensure_radar_tables
    from .teacher_record_tables import ensure_teacher_record_tables

    ensure_radar_tables(connection)
    ensure_teacher_record_tables(connection)
    try:
        from .nafs_readalong_api import ensure_on_boot as ensure_readalong

        ensure_readalong(connection)
    except Exception:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS portal_readalong_progress (
                student_nid TEXT NOT NULL,
                passage_id TEXT NOT NULL,
                listened INTEGER NOT NULL DEFAULT 0,
                score REAL NOT NULL DEFAULT 0,
                detail_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL DEFAULT '',
                PRIMARY KEY(student_nid, passage_id)
            );
            """
        )
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS portal_program_nominations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_nid TEXT NOT NULL,
            student_name TEXT NOT NULL DEFAULT '',
            grade TEXT NOT NULL DEFAULT '',
            section TEXT NOT NULL DEFAULT '',
            track_key TEXT NOT NULL,
            track_label TEXT NOT NULL DEFAULT '',
            program_name TEXT NOT NULL DEFAULT '',
            score REAL NOT NULL DEFAULT 0,
            reason TEXT NOT NULL DEFAULT '',
            detail_json TEXT NOT NULL DEFAULT '{}',
            etec_code TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'nominated',
            source TEXT NOT NULL DEFAULT 'nafs-enrich-bridge-v1',
            updated_at TEXT NOT NULL,
            UNIQUE(student_nid, track_key)
        );
        CREATE INDEX IF NOT EXISTS ix_ppn_track ON portal_program_nominations(track_key, score DESC);
        CREATE INDEX IF NOT EXISTS ix_ppn_student ON portal_program_nominations(student_nid);
        """
    )


def _student_row(connection, nid: str) -> tuple:
    return connection.execute(
        "SELECT national_id, name, grade, classroom FROM noor_students WHERE national_id = ?",
        (nid,),
    ).fetchone() or (nid, "", "", "")


def _mastery_pack(connection, nid: str) -> dict:
    try:
        from .nafs_adaptive_engine import mastery_index

        return mastery_index(connection, nid) or {}
    except Exception:
        return {}


def _xp_by_event(connection, nid: str, event_like: str) -> int:
    try:
        row = connection.execute(
            """
            SELECT COALESCE(SUM(xp),0) FROM portal_xp_ledger
            WHERE student_nid = ? AND event_type LIKE ?
            """,
            (nid, event_like),
        ).fetchone()
        return int(row[0] or 0)
    except Exception:
        return 0


def _readalong_avg(connection, nid: str) -> float:
    try:
        row = connection.execute(
            """
            SELECT COALESCE(AVG(score),0), COUNT(*) FROM portal_readalong_progress
            WHERE student_nid = ?
            """,
            (nid,),
        ).fetchone()
        if int(row[1] or 0) <= 0:
            return 0.0
        return float(row[0] or 0)
    except Exception:
        return 0.0


def _best_challenge(connection, nid: str) -> float:
    try:
        row = connection.execute(
            """
            SELECT COALESCE(MAX(score_pct),0) FROM portal_challenge_runs
            WHERE student_nid = ? AND finished_at != ''
            """,
            (nid,),
        ).fetchone()
        return float(row[0] or 0)
    except Exception:
        return 0.0


def _purge_wins(connection, nid: str) -> int:
    try:
        return int(
            connection.execute(
                """
                SELECT COUNT(*) FROM portal_challenge_runs
                WHERE student_nid = ? AND mode = 'purge' AND finished_at != '' AND score_pct >= 70
                """,
                (nid,),
            ).fetchone()[0]
            or 0
        )
    except Exception:
        return 0


def _week_xp_rank_ids(connection, limit: int = 15) -> set[str]:
    since = _iso(datetime.now(timezone.utc) - timedelta(days=7))
    try:
        rows = connection.execute(
            """
            SELECT student_nid FROM (
              SELECT student_nid, SUM(xp) AS xp
              FROM portal_xp_ledger
              WHERE created_at >= ?
              GROUP BY student_nid
              ORDER BY xp DESC
              LIMIT ?
            )
            """,
            (since, limit),
        ).fetchall()
        return {r[0] for r in rows if r[0]}
    except Exception:
        return set()


def _elite_in_section(connection, nid: str) -> bool:
    try:
        from .nafs_counsel_boost import _elite_rank

        return bool(_elite_rank(connection, nid))
    except Exception:
        return False


def evaluate_student_tracks(connection, nid: str) -> list[dict]:
    """اشتقاق ترشيحات البرامج من مؤشرات SSOT القائمة فقط."""
    ensure_enrich_bridge(connection)
    sid, name, grade, section = _student_row(connection, nid)
    mastery = _mastery_pack(connection, nid) or {}
    domains = mastery.get("domains") if isinstance(mastery.get("domains"), dict) else {}

    def m_idx(domain: str) -> float:
        block = domains.get(domain) or {}
        return float(block.get("mastery_index") or block.get("initial_mastery") or 0)

    math_m = m_idx("math")
    read_m = m_idx("reading")
    sci_m = m_idx("science")
    avg_m = round((math_m + read_m + sci_m) / 3.0, 1) if (math_m or read_m or sci_m) else 0.0
    best = _best_challenge(connection, nid)
    readalong = _readalong_avg(connection, nid)
    mental_xp = _xp_by_event(connection, nid, "game_mental%") + _xp_by_event(connection, nid, "%mental%")
    read_xp = _xp_by_event(connection, nid, "readalong%")
    purge_n = _purge_wins(connection, nid)
    elite = _elite_in_section(connection, nid)
    week_top = nid in _week_xp_rank_ids(connection)

    talent_row = connection.execute(
        "SELECT best_score, status FROM portal_talent_candidates WHERE student_nid = ?",
        (nid,),
    ).fetchone()
    talent_score = float(talent_row[0]) if talent_row else 0.0

    hits: list[dict] = []

    if talent_row or best >= 95 or avg_m >= 85:
        reason = (
            f"مرشّح موهبة · أفضل نتيجة {_e(round(best, 1))}٪"
            + (f" · سجل رادار {_e(round(talent_score, 1))}٪" if talent_row else "")
            + (f" · متوسط إتقان {_e(avg_m)}٪" if avg_m else "")
        )
        hits.append(
            {
                "track_key": "talent",
                "score": max(best, talent_score, avg_m),
                "reason": reason,
                "detail": {"best": best, "talent_score": talent_score, "avg_mastery": avg_m},
            }
        )

    if week_top or elite or avg_m >= 75 or best >= 88:
        reason = "إثراء · "
        bits = []
        if week_top:
            bits.append("صدارة أسبوعية")
        if elite:
            bits.append("نخبة الصف")
        if avg_m >= 75:
            bits.append(f"إتقان {_e(avg_m)}٪")
        if best >= 88:
            bits.append(f"تميز {_e(round(best, 1))}٪")
        reason += " · ".join(bits) or "أداء متميز"
        hits.append(
            {
                "track_key": "enrichment",
                "score": max(best, avg_m, 70.0 if week_top or elite else 0),
                "reason": reason,
                "detail": {"week_top": week_top, "elite": elite, "avg_mastery": avg_m, "best": best},
            }
        )

    if readalong >= 80 or read_m >= 80 or read_xp >= 30:
        hits.append(
            {
                "track_key": "reader",
                "score": max(readalong, read_m, min(100.0, read_xp)),
                "reason": (
                    f"قارئ الحصيف · قراءة متزامنة {_e(round(readalong, 1))}٪"
                    f" · إتقان قراءة {_e(read_m)}٪ · XP قراءة {_e(read_xp)}"
                ),
                "detail": {"readalong": readalong, "reading_mastery": read_m, "read_xp": read_xp},
            }
        )

    if mental_xp >= 20 or math_m >= 80 or purge_n >= 1 or (best >= 85 and math_m >= 70):
        hits.append(
            {
                "track_key": "numbers",
                "score": max(math_m, min(100.0, mental_xp), 70.0 if purge_n else 0),
                "reason": (
                    f"تحدي الأرقام · إتقان رياضيات {_e(math_m)}٪"
                    f" · حساب ذهني XP {_e(mental_xp)}"
                    f" · تطهير ناجح {_e(purge_n)}"
                ),
                "detail": {"math_mastery": math_m, "mental_xp": mental_xp, "purge_wins": purge_n},
            }
        )

    stamped = _iso()
    out = []
    for hit in hits:
        track = PROGRAM_TRACKS[hit["track_key"]]
        item = {
            "student_nid": sid,
            "student_name": name or "",
            "grade": grade or "",
            "section": section or "",
            "track_key": track["key"],
            "track_label": track["label"],
            "program_name": track["program_name"],
            "score": round(float(hit["score"] or 0), 1),
            "reason": hit["reason"],
            "detail": hit["detail"],
            "etec_code": track["etec"],
            "etec_code_ar": track["etec_ar"],
            "status": "nominated",
            "source": SOURCE_TAG,
            "updated_at": stamped,
        }
        out.append(item)
    return out


def upsert_nominations(connection, items: list[dict]) -> int:
    ensure_enrich_bridge(connection)
    n = 0
    for item in items:
        connection.execute(
            """
            INSERT INTO portal_program_nominations(
              student_nid, student_name, grade, section, track_key, track_label,
              program_name, score, reason, detail_json, etec_code, status, source, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_nid, track_key) DO UPDATE SET
              student_name=excluded.student_name,
              grade=excluded.grade,
              section=excluded.section,
              track_label=excluded.track_label,
              program_name=excluded.program_name,
              score=excluded.score,
              reason=excluded.reason,
              detail_json=excluded.detail_json,
              etec_code=excluded.etec_code,
              status=excluded.status,
              source=excluded.source,
              updated_at=excluded.updated_at
            """,
            (
                item["student_nid"],
                item["student_name"],
                item["grade"],
                item["section"],
                item["track_key"],
                item["track_label"],
                item["program_name"],
                item["score"],
                item["reason"],
                json.dumps(item.get("detail") or {}, ensure_ascii=False),
                item["etec_code"],
                item.get("status") or "nominated",
                item.get("source") or SOURCE_TAG,
                item["updated_at"],
            ),
        )
        n += 1
        # توثيق خفيف في سجل الإثراء القائم — بدون تكرار لنفس المصدر/الطالب/البرنامج
        exists = connection.execute(
            """
            SELECT 1 FROM teacher_enrichment
            WHERE student_id = ? AND program = ? AND source = ?
            LIMIT 1
            """,
            (item["student_nid"], item["program_name"], SOURCE_TAG),
        ).fetchone()
        if not exists:
            connection.execute(
                """
                INSERT INTO teacher_enrichment(
                  national_id, subject, student_id, program, activity, follow_up_date, status, source
                ) VALUES ('', ?, ?, ?, ?, '', 'مرشّح', ?)
                """,
                (
                    item["track_label"],
                    item["student_nid"],
                    item["program_name"],
                    item["reason"],
                    SOURCE_TAG,
                ),
            )
    return n


def refresh_bridge(connection, limit_students: int = 120) -> dict:
    """يعيد بناء الترشيحات من الطلاب النشطين في نافس/الألعاب."""
    ensure_enrich_bridge(connection)
    nids = {
        r[0]
        for r in connection.execute(
            """
            SELECT DISTINCT student_nid FROM portal_challenge_runs WHERE finished_at != ''
            UNION
            SELECT DISTINCT student_nid FROM portal_xp_ledger
            UNION
            SELECT DISTINCT student_nid FROM portal_talent_candidates
            UNION
            SELECT DISTINCT student_nid FROM portal_readalong_progress
            """
        ).fetchall()
        if r[0]
    }
    # حد معقول لتجنب ضغط غير ضروري
    ordered = sorted(nids)[: max(20, min(int(limit_students or 120), 300))]
    all_items: list[dict] = []
    for nid in ordered:
        all_items.extend(evaluate_student_tracks(connection, nid))
    written = upsert_nominations(connection, all_items)
    by_track: dict[str, int] = {}
    for item in all_items:
        by_track[item["track_key"]] = by_track.get(item["track_key"], 0) + 1
    return {
        "ok": True,
        "scanned": len(ordered),
        "written": written,
        "by_track": by_track,
        "by_track_ar": {k: _e(v) for k, v in by_track.items()},
        "at": _iso(),
        "school": {"name": SCHOOL_NAME, "stat_no": SCHOOL_STAT, "stat_no_ar": SCHOOL_STAT_AR},
    }


def build_bridge_pack(connection, track: str = "") -> dict:
    ensure_enrich_bridge(connection)
    params: list[Any] = []
    where = ""
    if track and track in PROGRAM_TRACKS:
        where = "WHERE track_key = ?"
        params.append(track)
    rows = connection.execute(
        f"""
        SELECT student_nid, student_name, grade, section, track_key, track_label,
               program_name, score, reason, detail_json, etec_code, status, updated_at
        FROM portal_program_nominations
        {where}
        ORDER BY track_key, score DESC, updated_at DESC
        LIMIT 400
        """,
        tuple(params),
    ).fetchall()
    from .portal_owner_api import mask_nid

    items = []
    grouped: dict[str, list] = {k: [] for k in PROGRAM_TRACKS}
    for r in rows:
        track_meta = PROGRAM_TRACKS.get(r[4] or "", {})
        item = {
            "student_nid": r[0],
            "student_nid_masked": mask_nid(r[0] or ""),
            "name": r[1] or "",
            "grade": r[2] or "",
            "section": r[3] or "",
            "track_key": r[4] or "",
            "track_label": r[5] or track_meta.get("label") or "",
            "program_name": r[6] or "",
            "score": float(r[7] or 0),
            "score_ar": _e(round(float(r[7] or 0), 1)),
            "reason": r[8] or "",
            "detail": json.loads(r[9] or "{}"),
            "etec_code": r[10] or track_meta.get("etec") or "",
            "etec_code_ar": track_meta.get("etec_ar") or _e(r[10] or ""),
            "status": r[11] or "nominated",
            "updated_at": r[12] or "",
        }
        items.append(item)
        if item["track_key"] in grouped:
            grouped[item["track_key"]].append(item)

    summary = {k: len(v) for k, v in grouped.items()}
    return {
        "ok": True,
        "school": {"name": SCHOOL_NAME, "stat_no": SCHOOL_STAT, "stat_no_ar": SCHOOL_STAT_AR},
        "tracks": PROGRAM_TRACKS,
        "summary": summary,
        "summary_ar": {k: _e(v) for k, v in summary.items()},
        "items": items,
        "grouped": grouped,
        "legend": {
            "digits": "أرقام هندية ٠–٩",
            "etec_ltr": "رموز ETEC باتجاه LTR",
            "ssot": "بلا قواعد موازية — قراءة من نافس/vault/قراءة/حساب ذهني/رادار الموهبة",
        },
    }


def build_honor_report(connection) -> dict:
    """تقرير إنجاز موجز: منصات تتويج + ترشيحات برامج."""
    ensure_enrich_bridge(connection)
    from .portal_session_api import _period_start, _section_key
    from .portal_owner_api import mask_nid

    def board(kind: str, limit: int = 10) -> list[dict]:
        start = _period_start(kind)
        rows = connection.execute(
            """
            SELECT r.student_nid, s.name, s.grade, s.classroom,
                   SUM(r.xp_earned) AS xp, AVG(r.score_pct) AS avg_score
            FROM portal_challenge_runs r
            LEFT JOIN noor_students s ON s.national_id = r.student_nid
            WHERE r.finished_at >= ? AND r.finished_at != ''
            GROUP BY r.student_nid
            ORDER BY xp DESC, avg_score DESC
            LIMIT ?
            """,
            (start, limit),
        ).fetchall()
        out = []
        for i, row in enumerate(rows):
            out.append(
                {
                    "rank": i + 1,
                    "rank_ar": _e(i + 1),
                    "national_id_masked": mask_nid(row[0] or ""),
                    "name": row[1] or "",
                    "grade": row[2] or "",
                    "section": row[3] or "",
                    "xp": int(row[4] or 0),
                    "xp_ar": _e(int(row[4] or 0)),
                    "avg_score": round(float(row[5] or 0), 1),
                    "avg_score_ar": _e(round(float(row[5] or 0), 1)),
                }
            )
        return out

    class_rows = connection.execute(
        """
        SELECT s.grade, s.classroom, SUM(r.xp_earned) AS xp, COUNT(DISTINCT r.student_nid)
        FROM portal_challenge_runs r
        JOIN noor_students s ON s.national_id = r.student_nid
        WHERE r.finished_at >= ? AND r.finished_at != ''
        GROUP BY s.grade, s.classroom
        ORDER BY xp DESC
        LIMIT 12
        """,
        (_period_start("week"),),
    ).fetchall()
    classes = [
        {
            "rank": i + 1,
            "rank_ar": _e(i + 1),
            "label": _section_key(row[0] or "", row[1] or ""),
            "xp": int(row[2] or 0),
            "xp_ar": _e(int(row[2] or 0)),
            "students": int(row[3] or 0),
            "students_ar": _e(int(row[3] or 0)),
        }
        for i, row in enumerate(class_rows)
        if (row[0] or row[1])
    ]

    # نخبة الصف: أعلى ٣ لكل فصل من XP الأسبوع
    elite_rows = connection.execute(
        """
        SELECT s.classroom, s.grade, r.student_nid, s.name, SUM(r.xp_earned) xp
        FROM portal_challenge_runs r
        JOIN noor_students s ON s.national_id = r.student_nid
        WHERE r.finished_at >= ? AND r.finished_at != '' AND COALESCE(s.classroom,'') != ''
        GROUP BY s.classroom, s.grade, r.student_nid
        ORDER BY s.classroom, xp DESC
        """,
        (_period_start("week"),),
    ).fetchall()
    elite: list[dict] = []
    seen_section: dict[str, int] = {}
    for row in elite_rows:
        key = f"{row[1]}|{row[0]}"
        count = seen_section.get(key, 0)
        if count >= 3:
            continue
        seen_section[key] = count + 1
        elite.append(
            {
                "place": count + 1,
                "place_ar": _e(count + 1),
                "section": row[0] or "",
                "grade": row[1] or "",
                "national_id_masked": mask_nid(row[2] or ""),
                "name": row[3] or "",
                "xp": int(row[4] or 0),
                "xp_ar": _e(int(row[4] or 0)),
            }
        )

    bridge = build_bridge_pack(connection)
    return {
        "ok": True,
        "school": {"name": SCHOOL_NAME, "stat_no": SCHOOL_STAT, "stat_no_ar": SCHOOL_STAT_AR},
        "title": "تقرير منصات التتويج وجسر البرامج النوعية",
        "boards": {
            "day": board("day"),
            "week": board("week"),
            "month": board("month"),
            "classes_week": classes,
            "elite_class": elite,
        },
        "programs": bridge["grouped"],
        "summary": bridge["summary"],
        "summary_ar": bridge["summary_ar"],
        "tracks": PROGRAM_TRACKS,
        "barcode": f"HONOR-{SCHOOL_STAT}-{_iso()[:10]}",
        "generated_at": _iso(),
        "etec_codes_ar": ["٣-١-١-١", "٣-١-١-٢", "٣-١-١-٣"],
    }


def sync_student_programs(connection, student_nid: str) -> list[dict]:
    items = evaluate_student_tracks(connection, student_nid)
    if items:
        upsert_nominations(connection, items)
    return items


class RefreshBody(BaseModel):
    limit_students: int = 120


@router.get("/api/session/nafs/enrich-bridge")
def api_enrich_bridge(track: str = "", x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level

    _require_level(x_session_token, 2)
    connection = connect()
    try:
        return build_bridge_pack(connection, track=track)
    finally:
        connection.close()


@router.post("/api/session/nafs/enrich-bridge/refresh")
def api_enrich_refresh(body: RefreshBody = RefreshBody(), x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level, _audit

    user, _level = _require_level(x_session_token, 1)
    connection = connect()
    try:
        result = refresh_bridge(connection, limit_students=body.limit_students)
        _audit(connection, user, "nafs.enrich.bridge.refresh", str(result.get("written") or 0), result.get("by_track"))
        connection.commit()
        pack = build_bridge_pack(connection)
        result["pack"] = pack
        return result
    finally:
        connection.close()


@router.get("/api/session/nafs/honor-report")
def api_honor_report(x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level

    _require_level(x_session_token, 2)
    connection = connect()
    try:
        return build_honor_report(connection)
    finally:
        connection.close()


@router.get("/api/portal/student/programs")
def api_student_programs(x_portal_token: str = Header(default="")):
    from .portal_session_api import _require_portal

    session = _require_portal(x_portal_token, ("student",))
    connection = connect()
    try:
        ensure_enrich_bridge(connection)
        items = sync_student_programs(connection, session["student_nid"])
        connection.commit()
        return {
            "ok": True,
            "items": [
                {
                    "track_key": i["track_key"],
                    "track_label": i["track_label"],
                    "program_name": i["program_name"],
                    "reason": i["reason"],
                    "score_ar": _e(i["score"]),
                    "etec_code_ar": i["etec_code_ar"],
                }
                for i in items
            ],
            "school_stat_ar": SCHOOL_STAT_AR,
        }
    finally:
        connection.close()
