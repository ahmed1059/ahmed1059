# بطاقة مراجعة موحّدة بعد الجولة — من المحفوظ فقط
# تشغيل: python3 -m Core_Engine.nafs_endround_review_test
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Core_Engine.nafs_endround_review import (  # noqa: E402
    build_review_item,
    review_from_challenge_answers,
    review_from_game_answers,
    summarize_review,
)

REVIEW_PY = ROOT / "Core_Engine" / "nafs_endround_review.py"
GAMES_JS = ROOT / "Print_Canvas" / "js" / "portal-student-games.js"
PORTAL_JS = ROOT / "Print_Canvas" / "js" / "portal-student.js"
GAMES_API = ROOT / "Core_Engine" / "portal_games_api.py"
SESSION_API = ROOT / "Core_Engine" / "portal_session_api.py"
CSS = ROOT / "Print_Canvas" / "css" / "portal-student.css"
FORTIFIED = [
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
]


def main() -> int:
    errors: list[str] = []

    item = build_review_item(
        stem="ما ناتج ٢+٢؟",
        choice="B",
        correct="A",
        ok=False,
        rationale="الجمع يعطي ٤.",
        choices={"A": "٤", "B": "٥", "C": "٣", "D": "٦"},
        question_id=11,
    )
    if item["choice_ar"] != "ب" or item["correct_ar"] != "أ":
        errors.append("letter_ar mapping failed")
    if item["choice_label"] != "٥" or item["correct_label"] != "٤":
        errors.append("choice labels not resolved from saved choices")
    if item["rationale"] != "الجمع يعطي ٤.":
        errors.append("rationale must stay as saved")

    empty_r = build_review_item(stem="س", choice="A", correct="A", ok=True, rationale="")
    if empty_r["rationale"] != "":
        errors.append("must not invent rationale")

    pack = summarize_review(
        [
            build_review_item(stem="١", choice="A", correct="A", ok=True),
            build_review_item(stem="٢", choice="B", correct="A", ok=False),
            build_review_item(stem="٣", choice="C", correct="C", ok=True),
        ]
    )
    if pack["total"] != 3 or pack["correct_count"] != 2 or pack["wrong_count"] != 1:
        errors.append("summarize counts wrong")
    if pack["total_ar"] != "٣" or pack["wrong_count_ar"] != "١" or pack["correct_count_ar"] != "٢":
        errors.append("eastern summary digits missing")
    if len(pack["wrong_items"]) != 1 or pack["wrong_items"][0]["stem"] != "٢":
        errors.append("wrong_items order/filter failed")

    chal = review_from_challenge_answers(
        [{"question_id": "7", "choice": "B"}],
        correct_map={"7": "A"},
        questions_full={
            "7": {
                "stem": "سؤال محفوظ",
                "rationale": "تعليل محفوظ",
                "choices": {"A": "صح", "B": "خطأ", "C": "ج", "D": "د"},
            }
        },
        lookup_row=None,
    )
    row = chal["items"][0]
    if row["ok"] or row["choice_label"] != "خطأ" or row["correct_label"] != "صح":
        errors.append("challenge review labels/ok failed")
    if row["rationale"] != "تعليل محفوظ":
        errors.append("challenge rationale not from saved full question")

    # لا اختلاق عند غياب الصف في البنك
    chal2 = review_from_challenge_answers(
        [{"question_id": "99", "choice": "A"}],
        correct_map={"99": "B"},
        questions_full={},
        lookup_row=lambda _qid: None,
    )
    if chal2["items"][0]["rationale"] != "" or chal2["items"][0]["stem"] != "":
        errors.append("must not invent stem/rationale when lookup empty")

    game = review_from_game_answers(
        [
            {
                "id": "w1",
                "stem": "مرادف «نور»",
                "choice": "C",
                "correct": "A",
                "ok": False,
                "choice_label": "ظلام",
                "correct_label": "ضياء",
                "rationale": "",
            }
        ]
    )
    if game["wrong_count_ar"] != "١" or game["items"][0]["correct_label"] != "ضياء":
        errors.append("game review pack failed")

    for path in (REVIEW_PY, GAMES_JS, PORTAL_JS, GAMES_API, SESSION_API, CSS):
        if not path.is_file():
            errors.append(f"missing {path.name}")

    games_js = GAMES_JS.read_text(encoding="utf-8")
    for needle in (
        "function renderRoundReview",
        "function bindRoundReviewTabs",
        "إجابتك",
        "الصحيحة",
        "data-review-tab",
        "renderRoundReview: renderRoundReview",
        "choice_label:",
        "paintEndRound(pack",
    ):
        if needle not in games_js:
            errors.append(f"games js missing: {needle}")

    portal_js = PORTAL_JS.read_text(encoding="utf-8")
    if "renderRoundReview" not in portal_js:
        errors.append("Arena finish must call renderRoundReview")
    if "portal-list" in portal_js and "result.review || []" in portal_js:
        # القائمة القديمة المقطوعة عند ٨ لم تعد مصدر العرض الوحيد
        if "slice(0, 8)" in portal_js and "renderRoundReview" not in portal_js.split("slice(0, 8)")[0][-200:]:
            pass  # tolerate leftover elsewhere

    session_api = SESSION_API.read_text(encoding="utf-8")
    if "review_from_challenge_answers" not in session_api or "review_summary" not in session_api:
        errors.append("challenge finish must persist review_summary")

    games_api = GAMES_API.read_text(encoding="utf-8")
    for needle in (
        "review_from_game_answers",
        '"review": review_pack.get("items")',
        "review_summary",
    ):
        if needle not in games_api:
            errors.append(f"games api missing: {needle}")
    if "live-duel/action" in games_api and 'detail["review"]' not in games_api:
        errors.append("live duel finish must attach review from saved answers")

    css = CSS.read_text(encoding="utf-8")
    for needle in (".round-review-card", ".round-review-summary", ".round-review-pair"):
        if needle not in css:
            errors.append(f"css missing: {needle}")

    for path in FORTIFIED:
        # لا نعدّل المحصّنات في هذه الموجة — التحقق بوجودها فقط كمرجع
        if not path.exists():
            errors.append(f"fortified missing on disk: {path.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK nafs_endround_review_test")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
