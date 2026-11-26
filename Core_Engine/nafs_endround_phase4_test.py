# المرحلة ٤: امتداد أعمدة التقدّم لـ portal_challenge_runs
# تشغيل: python3 -m Core_Engine.nafs_endround_phase4_test
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Core_Engine.nafs_endround_progress import (  # noqa: E402
    build_progress_pulse,
    fetch_challenge_runs,
    fetch_runs,
    is_challenge_game,
    normalize_attempt,
)

GAMES_JS = ROOT / "Print_Canvas" / "js" / "portal-student-games.js"
PORTAL_JS = ROOT / "Print_Canvas" / "js" / "portal-student.js"
GAMES_API = ROOT / "Core_Engine" / "portal_games_api.py"
SESSION_API = ROOT / "Core_Engine" / "portal_session_api.py"
PROGRESS_PY = ROOT / "Core_Engine" / "nafs_endround_progress.py"


def _mem_db() -> sqlite3.Connection:
    con = sqlite3.connect(":memory:")
    con.execute(
        """
        CREATE TABLE portal_challenge_runs (
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
            detail_json TEXT NOT NULL DEFAULT '{}'
        )
        """
    )
    rows = [
        ("s1", "daily", "2026-01-01T10:00:00+00:00", "2026-01-01T10:05:00+00:00", 90, 10, 4, 40.0, 1),
        ("s1", "daily", "2026-01-02T10:00:00+00:00", "2026-01-02T10:04:00+00:00", 70, 10, 7, 70.0, 2),
        ("s1", "mock", "2026-01-03T10:00:00+00:00", "2026-01-03T10:08:00+00:00", 100, 10, 9, 90.0, 3),
        ("s1", "daily", "", "", 0, 10, 0, 0.0, 0),  # جارية — تُستبعد
    ]
    for nid, mode, started, finished, dur, total, correct, pct, streak in rows:
        con.execute(
            """
            INSERT INTO portal_challenge_runs
            (student_nid, mode, started_at, finished_at, duration_sec, total_questions,
             correct_count, score_pct, streak_best, detail_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (nid, mode, started, finished, dur, total, correct, pct, streak, "{}"),
        )
    # سجل بلا total لكن مع score_pct محفوظ
    con.execute(
        """
        INSERT INTO portal_challenge_runs
        (student_nid, mode, started_at, finished_at, duration_sec, total_questions,
         correct_count, score_pct, streak_best, detail_json)
        VALUES ('s1', 'purge', '2026-01-04T10:00:00+00:00', '2026-01-04T10:03:00+00:00',
                50, 0, 0, 55.0, 0, '{}')
        """
    )
    con.commit()
    return con


def main() -> int:
    errors: list[str] = []

    if not is_challenge_game("challenges") or not is_challenge_game("mock"):
        errors.append("challenge game keys")
    if is_challenge_game("words"):
        errors.append("words must not be challenge key")

    con = _mem_db()
    all_rows = fetch_challenge_runs(con, "s1")
    if len(all_rows) != 4:
        errors.append(f"finished challenges expected 4 got {len(all_rows)}")
    daily = fetch_challenge_runs(con, "s1", mode="daily")
    if len(daily) != 2:
        errors.append(f"daily filter expected 2 got {len(daily)}")

    routed = fetch_runs(con, "s1", "challenges")
    if len(routed) != 4:
        errors.append("fetch_runs challenges routing")
    routed_mock = fetch_runs(con, "s1", "mock")
    if len(routed_mock) != 1:
        errors.append("fetch_runs mock mode filter")

    pulse = build_progress_pulse(all_rows, limit=7)
    if pulse.get("source") != "challenge_runs":
        errors.append("pulse source challenge_runs")
    if pulse.get("title") != "تحدياتك":
        errors.append("pulse title")
    if not pulse["attempts"] or "start" not in pulse["attempts"][0]["badges"]:
        errors.append("start badge on first challenge")
    best = [a for a in pulse["attempts"] if "best" in a["badges"]]
    if not best or best[0]["accuracy_pct"] != 90:
        errors.append("best challenge should be 90%")

    # score_pct بلا total — لا اختلاق total
    legacy = normalize_attempt(all_rows[-1], abs_index=4)
    if legacy["total"] != 0:
        errors.append("must not invent total")
    if legacy["accuracy_pct"] != 55:
        errors.append(f"score_pct accuracy expected 55 got {legacy['accuracy_pct']}")

    con.close()

    progress_src = PROGRESS_PY.read_text(encoding="utf-8")
    for needle in ("fetch_challenge_runs", "fetch_runs", "CHALLENGE_GAME_KEYS", "score_pct"):
        if needle not in progress_src:
            errors.append(f"progress missing {needle}")

    api = GAMES_API.read_text(encoding="utf-8")
    if "fetch_runs" not in api or "is_challenge_game" not in api:
        errors.append("games api must route via fetch_runs")
    if "3-1-1-3" not in api:
        errors.append("challenge etec 3-1-1-3")

    session_api = SESSION_API.read_text(encoding="utf-8")
    for needle in ("progress_pulse", "endround", "fetch_challenge_runs", "٣-١-١-٣"):
        if needle not in session_api:
            errors.append(f"challenge finish missing {needle}")

    js = GAMES_JS.read_text(encoding="utf-8")
    portal = PORTAL_JS.read_text(encoding="utf-8")
    if "تحدياتك" not in js:
        errors.append("games js title for challenges")
    if "renderProgressPulse" not in js or "PortalStudentGames" not in js:
        errors.append("games expose pulse renderers")
    if "progress_pulse" not in portal or "renderProgressPulse" not in portal:
        errors.append("arena result must paint challenge pulse")

    # محصّنات
    for locked in (
        ROOT / "Print_Canvas" / "js" / "erp-nav.js",
        ROOT / "Print_Canvas" / "js" / "erp-suite.js",
        ROOT / "Print_Canvas" / "dashboard.html",
    ):
        text = locked.read_text(encoding="utf-8", errors="ignore") if locked.exists() else ""
        if "fetch_challenge_runs" in text or "progress_pulse" in text and locked.name == "dashboard.html":
            # dashboard must stay untouched by this feature
            if locked.name in ("erp-nav.js", "erp-suite.js", "dashboard.html") and "endround-phase4" in text:
                errors.append(f"locked file touched? {locked.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK endround-phase4")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
