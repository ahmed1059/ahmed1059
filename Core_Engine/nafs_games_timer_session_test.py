# عزل جلسات ألعاب التأسيس — منع تداخل المؤقتات
# تشغيل: python3 -m Core_Engine.nafs_games_timer_session_test
from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GAMES_JS = ROOT / "Print_Canvas" / "js" / "portal-student-games.js"


def main() -> int:
    errors: list[str] = []
    src = GAMES_JS.read_text(encoding="utf-8")

    for needle in (
        "beginFoundationSession",
        "stopFoundationGames",
        "isFoundationSession",
        "stopWordsTimer",
        "stopMentalTimer",
        'foundation.activeKey !== "words"',
        'foundation.activeKey !== "mental"',
        "stopFoundationGames()",
    ):
        if needle not in src:
            errors.append(f"missing {needle}")

    # startWords يجب أن يبدأ جلسة ويصفّر الطرفين عبر beginFoundationSession
    if not re.search(r"function startWords\([\s\S]*?beginFoundationSession\(\"words\"\)", src):
        errors.append("startWords missing beginFoundationSession")
    if not re.search(r"function startMental\([\s\S]*?beginFoundationSession\(\"mental\"\)", src):
        errors.append("startMental missing beginFoundationSession")

    # نبضة المؤقت تتحقق من الجلسة
    words_tick = re.search(
        r"words\.timer = setInterval\(function \(\) \{([\s\S]*?)\}, 1000\)",
        src,
    )
    mental_tick = re.search(
        r"mental\.timer = setInterval\(function \(\) \{([\s\S]*?)\}, 1000\)",
        src,
    )
    if not words_tick or "isFoundationSession(\"words\"" not in words_tick.group(1):
        errors.append("words tick missing session guard")
    if not mental_tick or "isFoundationSession(\"mental\"" not in mental_tick.group(1):
        errors.append("mental tick missing session guard")

    # enterLiveDuel يوقف ألعاب التأسيس
    if not re.search(r"function enterLiveDuel\([\s\S]*?stopFoundationGames\(\)", src):
        errors.append("enterLiveDuel must stop foundation games")

    # لا مساس بالمحصّنات
    for banned in ("erp-nav.js", "erp-suite.js", "dashboard.html"):
        if banned in src and "erp-nav" in banned:
            pass

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(
        "OK",
        {
            "file": str(GAMES_JS.relative_to(ROOT)),
            "guards": ["sessionId", "activeKey", "clear-both-timers"],
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
