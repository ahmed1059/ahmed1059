# عزل جلسات ألعاب التأسيس — منع تداخل المؤقتات وإعادة الرسم كل ثانية
# تشغيل: python3 -m Core_Engine.nafs_games_timer_session_test
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GAMES_JS = ROOT / "Print_Canvas" / "js" / "portal-student-games.js"

NODE_SMOKE = r"""
// محاكاة منطق الجلسة + نبضة عداد دون إعادة رسم السؤال
let paints = 0;
let hudTicks = 0;
let activeKey = "";
let sessionId = 0;
function begin(key) {
  activeKey = key;
  sessionId += 1;
  return sessionId;
}
function isActive(key, sid) {
  return activeKey === key && sessionId === sid;
}
function paint() { paints += 1; }
function hud() { hudTicks += 1; }

const sidWords = begin("words");
let left = 5;
// نبضات كلمات — hud فقط
for (let i = 0; i < 3; i++) {
  if (!isActive("words", sidWords)) break;
  left -= 1;
  hud();
}
const sidMental = begin("mental"); // يبطل جلسة الكلمات
left = 5;
for (let i = 0; i < 3; i++) {
  // نبضة كلمات قديمة يجب أن تُرفض
  if (isActive("words", sidWords)) { paint(); }
  if (!isActive("mental", sidMental)) break;
  left -= 1;
  hud();
}
if (paints !== 0) { console.error("FAIL stale paint", paints); process.exit(1); }
if (hudTicks !== 6) { console.error("FAIL hud", hudTicks); process.exit(1); }
if (activeKey !== "mental") { console.error("FAIL active", activeKey); process.exit(1); }
console.log("OK", { hudTicks, paints, activeKey, sessionId });
"""


def main() -> int:
    errors: list[str] = []
    src = GAMES_JS.read_text(encoding="utf-8")

    for needle in (
        "beginFoundationSession",
        "stopFoundationGames",
        "isFoundationSession",
        "updateFoundationTimerHud",
        'id=\\"foundation-timer\\"',
        'foundation.activeKey !== "words"',
        'foundation.activeKey !== "mental"',
    ):
        if needle not in src:
            errors.append(f"missing {needle}")

    words_tick = re.search(
        r"words\.timer = setInterval\(function \(\) \{([\s\S]*?)\}, 1000\)",
        src,
    )
    mental_tick = re.search(
        r"mental\.timer = setInterval\(function \(\) \{([\s\S]*?)\}, 1000\)",
        src,
    )
    if not words_tick:
        errors.append("words tick missing")
    else:
        body = words_tick.group(1)
        if "isFoundationSession(\"words\"" not in body:
            errors.append("words tick missing session guard")
        if "paintWords()" in body:
            errors.append("words tick still calls paintWords (must be HUD-only)")
        if "updateFoundationTimerHud" not in body:
            errors.append("words tick missing updateFoundationTimerHud")

    if not mental_tick:
        errors.append("mental tick missing")
    else:
        body = mental_tick.group(1)
        if "isFoundationSession(\"mental\"" not in body:
            errors.append("mental tick missing session guard")
        if "paintMental()" in body:
            errors.append("mental tick still calls paintMental (must be HUD-only)")
        if "updateFoundationTimerHud" not in body:
            errors.append("mental tick missing updateFoundationTimerHud")

    if not re.search(
        r"function enterLiveDuel\([\s\S]*?(stopFoundationGames|exitFoundationUi)\(\)",
        src,
    ):
        errors.append("enterLiveDuel must stop foundation games")

    try:
        proc = subprocess.run(
            ["node", "-e", NODE_SMOKE],
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
        if proc.returncode != 0:
            errors.append("node smoke failed: " + (proc.stderr or proc.stdout or "")[:300])
        else:
            print(proc.stdout.strip())
    except FileNotFoundError:
        errors.append("node not available")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(
        "OK",
        {
            "file": str(GAMES_JS.relative_to(ROOT)),
            "guards": ["sessionId", "activeKey", "hud-only-tick"],
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
