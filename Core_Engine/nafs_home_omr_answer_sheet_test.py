# اختبار منزلي OMR + استكمال نموذج الإجابة ١-٤…٤-٤
# تشغيل: python3 -m Core_Engine.nafs_home_omr_answer_sheet_test
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Core_Engine.nafs_wave_c_answer_sheet import (  # noqa: E402
    ANSWER_ITEM_COUNT,
    SCHOOL_CODE,
    SCHOOL_MINISTRY_ID,
    answer_columns,
    build_omr_sheet_pack,
    build_training_form_pack,
    ministry_id_eastern,
)

WAVE_PY = ROOT / "Core_Engine" / "nafs_wave_c_answer_sheet.py"
ADAPTIVE = ROOT / "Core_Engine" / "nafs_adaptive_engine.py"
LAB = ROOT / "Core_Engine" / "nafs_misconception_lab.py"
JS = ROOT / "Print_Canvas" / "js" / "nafs-wave-c-answer-sheet.js"
ADAPTIVE_JS = ROOT / "Print_Canvas" / "js" / "portal-student-adaptive.js"
ANALYTICS_JS = ROOT / "Print_Canvas" / "js" / "app-journey-nafs-analytics.js"
CSS = ROOT / "Print_Canvas" / "css" / "nafs-wave-c-answer-sheet.css"
FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)


def main() -> int:
    errors: list[str] = []

    if ministry_id_eastern() != "S-٤٠٣٤١":
        errors.append(f"ministry_id_eastern={ministry_id_eastern()}")

    training = build_training_form_pack()
    school = training.get("school") or {}
    if school.get("ministry_id") != SCHOOL_MINISTRY_ID:
        errors.append("training ministry_id")
    if school.get("ministry_id_ar") != "S-٤٠٣٤١":
        errors.append("training ministry_id_ar")
    if school.get("code_ar") != "٤٠٣٤١" or school.get("code") != SCHOOL_CODE:
        errors.append("training school code")
    if training.get("no_answer_key") is not True:
        errors.append("training must keep no_answer_key")

    cols75 = answer_columns(75)
    flat75 = [it["n"] for c in cols75 for it in c["items"]]
    if flat75 != list(range(1, 76)) or len(cols75) != 5:
        errors.append("75-col grid broken")

    omr20 = build_omr_sheet_pack(20, purpose="home-mock", title="اختبار منزلي")
    if not omr20.get("omr_only"):
        errors.append("omr_only flag")
    if omr20.get("no_answer_key") is not True:
        errors.append("omr pack must not invent keys")
    sheet = omr20.get("answer_sheet") or {}
    if sheet.get("item_count") != 20 or sheet.get("item_count_ar") != "٢٠":
        errors.append("omr20 count")
    flat20 = [it["n"] for c in sheet.get("columns") or [] for it in c["items"]]
    if flat20 != list(range(1, 21)):
        errors.append("omr20 numbering")
    if "ETEC" not in (sheet.get("etec_ltr") or []):
        errors.append("omr ETEC LTR")
    if omr20["school"].get("ministry_id_ar") != "S-٤٠٣٤١":
        errors.append("omr ministry eastern")

    omr66 = build_omr_sheet_pack(66, purpose="national-mock")
    if omr66["answer_sheet"]["item_count"] != 66:
        errors.append("omr66 count")

    # لا اختلاق مفاتيح في حزم النموذج/الـ OMR
    for pack in (training, omr20, omr66):
        dumped = str(pack)
        if '"answer_key"' in dumped or "مفتاح التصحيح" in dumped:
            errors.append("answer key leaked into sheet pack")

    js = JS.read_text(encoding="utf-8")
    for needle in (
        "ministry_id_ar",
        "function renderOmrOnly",
        "nafs-c-brand-row",
        "nafs_logo.png",
        "openOmrPrint",
        "omr_only",
        'dir=\\"ltr\\"',
        "nafs-c-timing",
    ):
        if needle not in js:
            errors.append(f"js missing: {needle}")
    if "pageCode.replace" in js and "code_ar" not in js:
        errors.append("questionnaire page codes must prefer code_ar")

    css = CSS.read_text(encoding="utf-8")
    if "--nafs-c-sky" not in css or "nafs-c-timing" not in css or "@media print" not in css:
        errors.append("css sky/timing/print incomplete")
    if "A4" not in css and "210mm" not in css:
        errors.append("css A4 sizing missing")

    adaptive = ADAPTIVE.read_text(encoding="utf-8")
    if "build_omr_sheet_pack" not in adaptive or "omr_sheet" not in adaptive:
        errors.append("home mock must attach omr_sheet")
    if 'or "A"' in adaptive and "letters.get(str(q.get(\"correct\") or \"A\")" in adaptive:
        errors.append("home mock must not invent correct=A")
    if "correct = str(q.get(\"correct\")" not in adaptive:
        errors.append("home mock key must require saved correct")

    adaptive_js = ADAPTIVE_JS.read_text(encoding="utf-8")
    if "renderOmrOnly" not in adaptive_js or "omr_sheet" not in adaptive_js:
        errors.append("portal adaptive must print via wave-c OMR")
    if "repeat(5,1fr)" in adaptive_js and "أ ○ ب ○ ج ○ د ○" in adaptive_js:
        errors.append("crude OMR grid must be removed from home mock print")

    lab = LAB.read_text(encoding="utf-8")
    if "build_omr_sheet_pack" not in lab or "omr_sheet" not in lab:
        errors.append("national-pack must return omr_sheet")

    analytics = ANALYTICS_JS.read_text(encoding="utf-8")
    if "renderOmrOnly" not in analytics or "omr_sheet" not in analytics:
        errors.append("analytics national OMR must use wave-c sheet")
    if "Array.from({ length: 66 })" in analytics:
        errors.append("crude 66 OMR grid must be removed")

    if ANSWER_ITEM_COUNT != 75:
        errors.append("training answer count must stay 75")

    for path in FORTIFIED:
        if not path.exists():
            errors.append(f"fortified missing: {path.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK nafs_home_omr_answer_sheet_test")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
