# عزل واجهة ألعاب التأسيس — لوبي + ابدأ اللعبة + إخفاء قاطع للبطاقات
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
        "openFoundationLobby",
        "paintFoundationLobby",
        "launchFoundationPlay",
        "btn-foundation-back",
        "foundation-game-tiles",
        "data-foundation-start",
        "data-foundation-exit",
        "foundation-hud-num",
    ):
        if needle not in js and needle not in html:
            errors.append(f"missing {needle}")

    if 'id="foundation-game-tiles"' not in html:
        errors.append("html tiles id")
    if 'id="btn-foundation-back"' not in html:
        errors.append("html back button")

    # إخفاء قاطع يتجاوز display:grid
    if "#foundation-game-tiles[hidden]" not in css or "display: none !important" not in css:
        errors.append("css hard-hide tiles missing")
    if ".is-foundation-session" not in css:
        errors.append("css session class hide missing")

    if "openFoundationLobby(\"words\"" not in js.replace(" ", ""):
        # tolerate spacing
        if "openFoundationLobby(" not in js or 'startWords("lang")' in js[
            js.find("btn-words") : js.find("btn-words") + 250
        ]:
            # tiles must open lobby, not start immediately
            chunk = js[js.find("btn-words") : js.find("btn-words") + 350]
            if "openFoundationLobby" not in chunk:
                errors.append("words tile must open lobby")

    if "ابدأ اللعبة" not in js:
        errors.append("start button label missing")

    # لا يبدأ المؤقت من اللوبي — setInterval فقط داخل startWords/startMental بعد الجلسة
    lobby_fn = re.search(r"function openFoundationLobby\([\s\S]*?\n  \}", js)
    if lobby_fn and "setInterval" in lobby_fn.group(0):
        errors.append("lobby must not start timers")

    words_tick = re.search(
        r"words\.timer = setInterval\(function \(\) \{([\s\S]*?)\}, 1000\)",
        js,
    )
    if not words_tick or "paintWords()" in words_tick.group(1):
        errors.append("words tick must stay HUD-only")

    if not re.search(r"btn-foundation-back[\s\S]*?exitFoundationUi", js):
        errors.append("back button binding")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK", {"lobby": True, "start_gate": True, "hard_hide": True})
    return 0


if __name__ == "__main__":
    sys.exit(main())
