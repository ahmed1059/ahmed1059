# موجة ج: نموذج الإجابة + استبانة الطالب — اختبار دخان
# تشغيل: python3 -m Core_Engine.nafs_wave_c_answer_sheet_test
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Core_Engine.nafs_wave_c_answer_sheet import (  # noqa: E402
    ANSWER_COLUMNS,
    ANSWER_ITEM_COUNT,
    MULTI_SELECT_BANNER,
    SCHOOL_CODE,
    SCHOOL_NAME,
    WAVE_TAG,
    build_training_form_pack,
    eastern_digits,
    questionnaire_items,
)

WAVE_PY = ROOT / "Core_Engine" / "nafs_wave_c_answer_sheet.py"
SESSION_API = ROOT / "Core_Engine" / "nafs_session_api.py"
ADAPTIVE = ROOT / "Core_Engine" / "nafs_adaptive_engine.py"
JS = ROOT / "Print_Canvas" / "js" / "nafs-wave-c-answer-sheet.js"
CSS = ROOT / "Print_Canvas" / "css" / "nafs-wave-c-answer-sheet.css"
ANALYTICS_JS = ROOT / "Print_Canvas" / "js" / "app-journey-nafs-analytics.js"
ADAPTIVE_JS = ROOT / "Print_Canvas" / "js" / "portal-student-adaptive.js"
SHELL = ROOT / "Print_Canvas" / "app-journey.html"
PORTAL = ROOT / "Print_Canvas" / "portal-student.html"
FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)


def main() -> int:
    errors: list[str] = []

    if SCHOOL_CODE != "40341" or "سعد بن الربيع" not in SCHOOL_NAME:
        errors.append("school identity")

    if eastern_digits(66) != "٦٦" or eastern_digits("40341") != "٤٠٣٤١":
        errors.append("eastern digits")

    items = questionnaire_items()
    if len(items) != 22:
        errors.append(f"questionnaire must be 22 got {len(items)}")
    if any(not (it.get("stem") or "").strip() for it in items):
        errors.append("questionnaire stems must be filled from official form")
    # عيّنة من النص الرسمي — لا اختلاق
    by_n = {it["n"]: it for it in items}
    if by_n[1].get("stem") != "أتحدث باللغة العربية في المنزل:":
        errors.append("stem 1 mismatch")
    if by_n[22].get("stem") != "خلال آخر فصل دراسي، كم درسًا خصوصيًا أو إضافيًا حضرته للمواد التالية؟":
        errors.append("stem 22 mismatch")
    if by_n[11].get("page") != "3-4" or by_n[11].get("section") != "عن المعلمين والمواد الدراسية":
        errors.append("teachers section must start at item 11 on page 3-4")
    multi_ns = {it["n"] for it in items if it.get("multi")}
    if multi_ns != {2, 5}:
        errors.append(f"multi-select items expected {{2,5}} got {multi_ns}")
    matrix_ns = {it["n"] for it in items if it.get("kind") == "matrix"}
    if matrix_ns != {8, 10, 22}:
        errors.append(f"matrix items expected {{8,10,22}} got {matrix_ns}")
    pages = {it["page"] for it in items}
    if pages != {"2-4", "3-4", "4-4"}:
        errors.append(f"questionnaire pages {pages}")
    sections = {it["section"] for it in items}
    if "عن الطالب" not in sections or "عن المدرسة" not in sections:
        errors.append("section labels")
    if "عن المعلمين والمواد الدراسية" not in sections:
        errors.append("teachers section")

    pack = build_training_form_pack()
    if pack.get("wave") != WAVE_TAG or pack.get("no_answer_key") is not True:
        errors.append("pack meta / no_answer_key")
    if pack["questionnaire"].get("stems_invented") is not False:
        errors.append("stems_invented flag")
    if pack["questionnaire"].get("stems_from_official") is not True:
        errors.append("stems_from_official flag")
    if pack["questionnaire"].get("multi_banner") != MULTI_SELECT_BANNER:
        errors.append("multi banner")
    if pack["questionnaire"].get("closing") != "شكرًا لإجابتكم على هذه الاستبانة":
        errors.append("official closing phrase")
    if pack["answer_sheet"]["item_count"] != ANSWER_ITEM_COUNT:
        errors.append("answer item count")
    cols = pack["answer_sheet"]["columns"]
    if len(cols) != ANSWER_COLUMNS:
        errors.append("answer columns")
    flat = [n for c in cols for n in (x["n"] for x in c["items"])]
    if flat != list(range(1, ANSWER_ITEM_COUNT + 1)):
        errors.append("answer numbering 1..66 contiguous RTL columns")
    if pack["answer_sheet"]["school_code_grid"]["columns"] != 5:
        errors.append("school code grid width must be 5")
    if pack["answer_sheet"]["national_id_grid"]["columns"] != 10:
        errors.append("national id grid width")
    etec = pack["answer_sheet"].get("etec_ltr") or []
    if "ETEC" not in etec or "Qiyas" not in etec:
        errors.append("ETEC/Qiyas LTR markers")

    api = SESSION_API.read_text(encoding="utf-8")
    if "answer-sheet-training" not in api or "nafs_wave_c_answer_sheet" not in api:
        errors.append("session API endpoint missing")
    adaptive = ADAPTIVE.read_text(encoding="utf-8")
    if "/api/portal/answer-sheet-training" not in adaptive:
        errors.append("portal API endpoint missing")

    for path in (WAVE_PY, JS, CSS, ANALYTICS_JS, SHELL, PORTAL, ADAPTIVE_JS):
        if not path.is_file():
            errors.append(f"missing {path.name}")

    js = JS.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")
    analytics = ANALYTICS_JS.read_text(encoding="utf-8")
    shell = SHELL.read_text(encoding="utf-8")
    portal = PORTAL.read_text(encoding="utf-8")
    adaptive_js = ADAPTIVE_JS.read_text(encoding="utf-8")

    if "nafs-c-timing" not in css or "@media print" not in css or "A4" not in css:
        errors.append("css print/A4/timing")
    if "NafsWaveCAnswerSheet" not in js or "renderPack" not in js:
        errors.append("js module API")
    if "etec-ltr" not in js or "ltr" not in js:
        errors.append("js ETEC LTR")
    if "ministry_id_ar" not in js and "school.code_ar || east(school.code" not in js:
        errors.append("js school code must render eastern digits")
    if "ministry_id_ar" not in js:
        errors.append("js ministry_id_ar path missing")
    if "يمكن للطالب تعبئة أكثر من إجابة" not in js:
        errors.append("multi-select banner in js")
    if "printAnswerSheetTraining" not in analytics or "answer-sheet-training" not in analytics:
        errors.append("analytics wiring")
    if "aj-nafs-print-answer-sheet" not in shell or "nafs-wave-c-answer-sheet.js" not in shell:
        errors.append("app-journey shell wiring")
    if "aj-nafs-answer-sheet-host" not in shell:
        errors.append("interactive host missing")
    if "btn-nafs-answer-sheet" not in portal or "nafs-wave-c-answer-sheet.js" not in portal:
        errors.append("portal shell wiring")
    if "answer-sheet-training" not in adaptive_js:
        errors.append("portal adaptive wiring")

    # محصّنات: لا مساس
    for path in FORTIFIED:
        # الملفات موجودة ولم يُطلب تعديلها في هذه الموجة — نتحقق فقط من وجودها
        if not path.is_file():
            errors.append(f"fortified missing {path.name}")

    # لا مفاتيح إجابة في الحزمة (تجاهل علم no_answer_key)
    import json as _json

    dumped = _json.dumps(pack, ensure_ascii=False)
    if '"answer_key"' in dumped or '"correct_key"' in dumped or "مفتاح التصحيح" in dumped:
        errors.append("must not ship answer keys")
    if pack.get("no_answer_key") is not True:
        errors.append("no_answer_key must be true")

    if errors:
        print("FAIL nafs-wave-c-answer-sheet")
        for err in errors:
            print(" -", err)
        return 1
    print("OK nafs-wave-c-answer-sheet")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
