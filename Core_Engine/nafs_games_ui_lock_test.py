# عزل واجهة ألعاب التأسيس — جلسة واحدة + زر العودة
# تشغيل: python3 -m Core_Engine.nafs_games_ui_lock_test
from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GAMES_JS = ROOT / "Print_Canvas" / "js" / "portal-student-games.js"
GAMES_HTML = ROOT / "Print_Canvas" / "portal-student.html"
GAMES_CSS = ROOT / "Print_Canvas" / "css" / "portal-student.css"


def main() -> int:
    errors: list[str] = []
    js = GAMES_JS.read_text(encoding="utf-8")
    html = GAMES_HTML.read_text(encoding="utf-8")
    css = GAMES_CSS.read_text(encoding="utf-8")

    for needle in (
        "enterFoundationUi",
        "exitFoundationUi",
        "btn-foundation-back",
        "foundation-game-tiles",
        "foundation-session-bar",
        "foundation-active-title",
        "data-foundation-exit",
        "foundation-hud-num",
        'dir=\\"ltr\\"',
    ):
        if needle not in js and needle not in html:
            errors.append(f"missing {needle}")

    if 'id="foundation-game-tiles"' not in html:
        errors.append("html tiles id")
    if 'id="btn-foundation-back"' not in html:
        errors.append("html back button")
    if ".foundation-session-bar" not in css or "unicode-bidi: isolate" not in css:
        errors.append("css session/LTR")

    if "function beginFoundationSession" in js and "enterFoundationUi" not in js[
        js.find("function beginFoundationSession") : js.find("function beginFoundationSession") + 400
    ]:
        errors.append("beginFoundationSession must enter UI")

    if not re.search(r"btn-foundation-back[\s\S]*?exitFoundationUi", js):
        errors.append("back button binding")

    # نبضة HUD فقط ما زالت قائمة
    words_tick = re.search(
        r"words\.timer = setInterval\(function \(\) \{([\s\S]*?)\}, 1000\)",
        js,
    )
    if not words_tick or "paintWords()" in words_tick.group(1):
        errors.append("words tick must stay HUD-only")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK", {"ui_lock": True, "back": True, "ltr_hud": True})
    return 0


if __name__ == "__main__":
    sys.exit(main())
