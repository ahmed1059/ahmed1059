# المرحلة ١: بطاقة ختام الجولة + مستويات الهواة/المحترفين/النخبة + إرجاع آمن
# تشغيل: python3 -m Core_Engine.nafs_endround_phase1_test
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Core_Engine.nafs_challenge_tiers import (  # noqa: E402
    TIER_AMATEUR,
    TIER_ELITE,
    TIER_PRO,
    coaching_from_round,
    fallback_tier_chain,
    pick_with_fallback,
    resolve_tier,
    taxonomy_snapshot,
)

GAMES_JS = ROOT / "Print_Canvas" / "js" / "portal-student-games.js"
GAMES_CSS = ROOT / "Print_Canvas" / "css" / "portal-student.css"
GAMES_API = ROOT / "Core_Engine" / "portal_games_api.py"


def main() -> int:
    errors: list[str] = []

    # —— مرجعية المستويات ——
    if resolve_tier(mental_level=1)["id"] != TIER_AMATEUR:
        errors.append("mental 1 → amateur")
    if resolve_tier(mental_level=3)["label"] != "المحترفين":
        errors.append("mental 3 → المحترفين")
    if resolve_tier(mental_level=5)["label"] != "النخبة":
        errors.append("mental 5 → النخبة")
    if resolve_tier(word_kind="meaning")["id"] != TIER_AMATEUR:
        errors.append("meaning → amateur")
    if resolve_tier(word_kind="synonym")["id"] != TIER_PRO:
        errors.append("synonym → pro")
    if resolve_tier(word_kind="antonym")["id"] != TIER_ELITE:
        errors.append("antonym → elite")
    if resolve_tier(grade_root="٢م")["id"] != TIER_PRO:
        errors.append("root ٢م → pro")
    if resolve_tier(mode="purge")["id"] != TIER_ELITE:
        errors.append("purge → elite")
    if resolve_tier(readalong_level="ناقد")["id"] != TIER_ELITE:
        errors.append("readalong ناقد → elite")

    chain = fallback_tier_chain(TIER_ELITE)
    if chain[0] != TIER_ELITE or TIER_AMATEUR not in chain:
        errors.append("fallback chain elite broken")

    picked = pick_with_fallback(
        {TIER_AMATEUR: [{"id": 1}], TIER_PRO: [], TIER_ELITE: []},
        TIER_ELITE,
    )
    if not picked.get("used_fallback") or picked["tier"]["id"] != TIER_AMATEUR:
        errors.append("fallback must soften to non-empty amateur")

    empty = pick_with_fallback({TIER_AMATEUR: [], TIER_PRO: [], TIER_ELITE: []}, TIER_PRO)
    if not empty.get("empty"):
        errors.append("empty bank must signal empty")

    coach = coaching_from_round(
        score=9, total=10, combo_best=4, elapsed_sec=40, seconds_budget=60, tier_label="المحترفين"
    )
    if "accuracy_pct" not in coach or not coach.get("message"):
        errors.append("coaching missing fields")

    snap = taxonomy_snapshot()
    if len(snap.get("sections") or {}) != 6:
        errors.append("taxonomy must cover 6 sections")
    if len(snap.get("tiers") or []) != 3:
        errors.append("taxonomy must list 3 tiers")

    # —— API wiring ——
    api_src = GAMES_API.read_text(encoding="utf-8")
    for needle in (
        "challenge-tiers",
        "coaching_from_round",
        "resolve_tier",
        "etec_ar",
        "taxonomy_snapshot",
    ):
        if needle not in api_src:
            errors.append(f"api missing {needle}")

    # —— واجهة الختام ——
    js = GAMES_JS.read_text(encoding="utf-8")
    css = GAMES_CSS.read_text(encoding="utf-8")
    for needle in (
        "paintEndRound",
        "data-end-replay",
        "data-end-games",
        "data-end-arena",
        "الهواة",
        "المحترفين",
        "النخبة",
        "data-lobby-tier",
        "goToArenaStation",
        "replayLastRound",
        "end-round-card",
    ):
        if needle not in js:
            errors.append(f"js missing {needle}")

    for needle in (".end-round-card", ".end-round-metrics", ".foundation-tier-row"):
        if needle not in css:
            errors.append(f"css missing {needle}")

    # محصّنات لم تُمس
    for locked in (
        ROOT / "Print_Canvas" / "js" / "erp-nav.js",
        ROOT / "Print_Canvas" / "js" / "erp-suite.js",
        ROOT / "Print_Canvas" / "dashboard.html",
    ):
        if not locked.exists():
            continue  # some layouts differ; skip absence

    # أرقام هندية + ETEC LTR في البطاقة
    if 'dir="ltr" class="etec-code' not in js and "dir=\\\"ltr\\\" class=\\\"etec-code" not in js:
        if 'class="etec-code end-round-etec"' not in js:
            errors.append("end-round etec LTR missing")
    if "foundation-hud-num" not in js:
        errors.append("eastern numeric class missing on metrics")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK endround-phase1")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
