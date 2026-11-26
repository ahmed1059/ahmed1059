# المرحلة ٣: أسطورة نافس + فارق القفزة الآمن (بلا امتداد أعمدة التحديات)
# تشغيل: python3 -m Core_Engine.nafs_endround_phase3_test
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Core_Engine.nafs_endround_legend import (  # noqa: E402
    LEGEND_TIERS,
    MIN_PARTICIPANTS,
    build_rank_gap,
    legend_from_xp,
    path_hint_from_streak,
)
GAMES_JS = ROOT / "Print_Canvas" / "js" / "portal-student-games.js"
GAMES_CSS = ROOT / "Print_Canvas" / "css" / "portal-student.css"
GAMES_API = ROOT / "Core_Engine" / "portal_games_api.py"
PORTAL_JS = ROOT / "Print_Canvas" / "js" / "portal-student.js"
LEGEND_PY = ROOT / "Core_Engine" / "nafs_endround_legend.py"
PROGRESS_PY = ROOT / "Core_Engine" / "nafs_endround_progress.py"


def main() -> int:
    errors: list[str] = []

    # سلّم الألقاب يطابق البوابة
    portal = PORTAL_JS.read_text(encoding="utf-8")
    for title in ("فارس مبتدئ", "فارس نشط", "بطل الأسبوع", "نخبة الصف", "أسطورة نافس"):
        if title not in portal:
            errors.append(f"portal missing ladder title {title}")
        if title not in {t["title"] for t in LEGEND_TIERS}:
            errors.append(f"legend ladder missing {title}")

    leg = legend_from_xp(40)
    if leg["title"] != "فارس مبتدئ" or leg["remain_xp"] != 10:
        errors.append(f"legend 40xp unexpected {leg}")
    leg2 = legend_from_xp(700)
    if leg2["title"] != "أسطورة نافس":
        errors.append("700 xp should be أسطورة نافس")

    peers = [
        {"national_id": "a", "name": "أحمد", "xp": 100},
        {"national_id": "b", "name": "بدر", "xp": 80},
        {"national_id": "c", "name": "خالد", "xp": 60},
    ]
    hidden = build_rank_gap(peers[:2], "b", metric_key="xp")
    if hidden.get("visible"):
        errors.append("rank must hide below min participants")
    if MIN_PARTICIPANTS != 3:
        errors.append("min participants policy")

    shown = build_rank_gap(peers, "b", metric_key="xp")
    if not shown.get("visible") or shown.get("rank") != 2:
        errors.append(f"rank for b unexpected {shown}")
    if shown.get("gap_to_next") != 20:
        errors.append(f"gap unexpected {shown.get('gap_to_next')}")

    hint = path_hint_from_streak(low_streak=2, game="mental", accuracy_pct=40)
    if not hint or hint.get("kind") != "clinic":
        errors.append("mental path hint")
    no_hint = path_hint_from_streak(low_streak=0, game="words", accuracy_pct=90)
    if no_hint is not None:
        errors.append("no hint on strong run")

    api = GAMES_API.read_text(encoding="utf-8")
    for needle in (
        "endround-context",
        "endround",
        "_attach_endround_context",
        "_period_start",
    ):
        if needle not in api:
            errors.append(f"api missing {needle}")
    if "fetch_runs" not in api and "fetch_runs_for_game" not in api:
        errors.append("api missing fetch_runs routing")

    legend_src = LEGEND_PY.read_text(encoding="utf-8")
    if "fetch_week_challenge_peers" not in legend_src:
        errors.append("rank must use challenge_runs week peers")
    if "fetch_game_peers" in legend_src:
        errors.append("phase3 must not rank via game_runs peers")
    # امتداد أعمدة التحديات أصبح في المرحلة ٤ — لا نفشل بوجوده بعد الدمج
    _ = PROGRESS_PY.exists()
    js = GAMES_JS.read_text(encoding="utf-8")
    css = GAMES_CSS.read_text(encoding="utf-8")
    for needle in (
        "renderLegendBar",
        "renderRankGap",
        "renderPathHint",
        "أسطورة نافس",
        "الفارق للقفزة",
        "متوسط الجولة",
        "data-end-station",
        "nafs-legend-bar",
    ):
        if needle not in js:
            errors.append(f"js missing {needle}")
    for needle in (".nafs-legend-bar", ".end-round-rank", ".end-round-path-hint"):
        if needle not in css:
            errors.append(f"css missing {needle}")

    # محصّنات
    for locked in (
        ROOT / "Print_Canvas" / "js" / "erp-nav.js",
        ROOT / "Print_Canvas" / "js" / "erp-suite.js",
        ROOT / "Print_Canvas" / "dashboard.html",
    ):
        if locked.exists() and "endround" in locked.read_text(encoding="utf-8", errors="ignore"):
            errors.append(f"locked file touched? {locked.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK endround-phase3")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
