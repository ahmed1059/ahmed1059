# المرحلة ٢: ملخص محاولات portal_game_runs + أعمدة التقدّم والشارات
# تشغيل: python3 -m Core_Engine.nafs_endround_phase2_test
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Core_Engine.nafs_endround_progress import (  # noqa: E402
    annotate_progress,
    build_progress_pulse,
    game_type_clause,
    normalize_attempt,
)

GAMES_JS = ROOT / "Print_Canvas" / "js" / "portal-student-games.js"
GAMES_CSS = ROOT / "Print_Canvas" / "css" / "portal-student.css"
GAMES_API = ROOT / "Core_Engine" / "portal_games_api.py"
PROGRESS_PY = ROOT / "Core_Engine" / "nafs_endround_progress.py"


def _row(score, total, elapsed, created, gid=1, gtype="words", combo=0):
    return {
        "id": gid,
        "game_type": gtype,
        "score": score,
        "combo_best": combo,
        "detail_json": json.dumps({"total": total, "elapsed": elapsed}, ensure_ascii=False),
        "created_at": created,
    }


def main() -> int:
    errors: list[str] = []

    clause, params = game_type_clause("mental")
    if "LIKE" not in clause or params != ("mental:%",):
        errors.append("mental game_type clause")
    clause_w, params_w = game_type_clause("words")
    if params_w != ("words",):
        errors.append("words game_type clause")

    rows = [
        _row(3, 10, 55, "2026-01-01T10:00:00+00:00", 1),
        _row(5, 10, 48, "2026-01-01T10:05:00+00:00", 2),
        _row(8, 10, 40, "2026-01-01T10:10:00+00:00", 3),
        _row(6, 10, 42, "2026-01-01T10:15:00+00:00", 4),
    ]
    pulse = build_progress_pulse(rows, limit=7)
    attempts = pulse["attempts"]
    if len(attempts) != 4:
        errors.append(f"expected 4 attempts got {len(attempts)}")
    if "start" not in attempts[0]["badges"]:
        errors.append("first abs attempt must have نقطة البداية/start")
    if "best" not in attempts[2]["badges"]:
        errors.append("best should be score 8/10")
    if "improved" not in attempts[1]["badges"] or "improved" not in attempts[2]["badges"]:
        errors.append("improved badges missing on rises")
    if attempts[-1].get("is_latest") is not True:
        errors.append("latest flag")
    if attempts[2]["height_pct"] != 80:
        errors.append(f"height for 8/10 should be 80 got {attempts[2]['height_pct']}")
    if attempts[2].get("speed_mark_pct") is None:
        errors.append("speed mark missing")
    # الأسرع (٤٠ث) يجب أن تكون علامة سرعته أعلى من الأبطأ
    if attempts[2]["speed_mark_pct"] < attempts[0]["speed_mark_pct"]:
        errors.append("faster attempt should have higher speed mark")
    if pulse["labels"].get("start") != "نقطة البداية":
        errors.append("arabic label start")

    # نافذة آخر محاولتين — نقطة البداية فقط إن abs_index==1 داخل النافذة؟ 
    # abs_index=3,4 → لا start على النافذة
    window = build_progress_pulse(rows, limit=2)
    if any("start" in a["badges"] for a in window["attempts"]):
        errors.append("start badge must not appear when first-ever run is outside window")
    if window["total_runs"] != 4 or window["count"] != 2:
        errors.append("window counts")

    # سجل قديم بلا total — لا اختلاق؛ height نسبي للدرجات
    legacy = [
        normalize_attempt(
            {"id": 1, "game_type": "words", "score": 2, "combo_best": 0, "detail_json": "{}", "created_at": "t1"},
            abs_index=1,
        ),
        normalize_attempt(
            {
                "id": 2,
                "game_type": "words",
                "score": 5,
                "combo_best": 1,
                "detail_json": json.dumps({"elapsed": 30}),
                "created_at": "t2",
            },
            abs_index=2,
        ),
    ]
    ann = annotate_progress(legacy)
    if ann[0]["height_pct"] != 40 or ann[1]["height_pct"] != 100:
        errors.append("legacy relative height")
    if "start" not in ann[0]["badges"] or "best" not in ann[1]["badges"]:
        errors.append("legacy badges")

    # ملفات الواجهة والمسار
    if not PROGRESS_PY.exists():
        errors.append("progress module missing")
    api = GAMES_API.read_text(encoding="utf-8")
    for needle in (
        "progress-pulse",
        "progress_pulse",
        "_attach_progress_pulse",
        "build_progress_pulse",
    ):
        if needle not in api:
            errors.append(f"api missing {needle}")

    js = GAMES_JS.read_text(encoding="utf-8")
    css = GAMES_CSS.read_text(encoding="utf-8")
    for needle in (
        "renderProgressPulse",
        "progress-pulse",
        "progress-badge",
        "نقطة البداية",
        "أفضل رقم",
        "↑ تحسّن",
        "pulseGame",
    ):
        if needle not in js:
            errors.append(f"js missing {needle}")
    for needle in (
        ".progress-pulse",
        ".progress-col-fill",
        ".progress-speed-mark",
        ".progress-badge-best",
    ):
        if needle not in css:
            errors.append(f"css missing {needle}")

    # محصّنات
    for locked in ("erp-nav.js", "erp-suite.js", "dashboard.html"):
        # لا نعدّل؛ وجود الملف كافٍ للتحقق من المسار فقط
        pass

    if "أسطورة نافس" in js and "فارق" in js and "leaderboard" in js.lower():
        # المرحلة ٣ لم تُنفَّذ بعد — لا مانع من ذكرها في الحاشية
        pass
    if "leaderboards" in js and "progress-pulse-rank" in js:
        errors.append("phase3 rank UI leaked into phase2")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK endround-phase2")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
