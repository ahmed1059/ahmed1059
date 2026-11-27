# كراسة الاختبار المنزلي بطراز نماذج نافس أ/ب
# تشغيل: python3 -m Core_Engine.nafs_home_mock_booklet_design_test
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

CSS = ROOT / "Print_Canvas" / "css" / "nafs-home-mock-booklet.css"
JS = ROOT / "Print_Canvas" / "js" / "nafs-home-mock-booklet.js"
ADAPTIVE_JS = ROOT / "Print_Canvas" / "js" / "portal-student-adaptive.js"
ADAPTIVE_PY = ROOT / "Core_Engine" / "nafs_adaptive_engine.py"
PORTAL = ROOT / "Print_Canvas" / "portal-student.html"
FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)


def main() -> int:
    errors: list[str] = []

    for path in (CSS, JS, ADAPTIVE_JS, ADAPTIVE_PY, PORTAL):
        if not path.is_file():
            errors.append(f"missing {path.name}")

    css = CSS.read_text(encoding="utf-8")
    for needle in (
        "--nafs-b-purple",
        ".nafs-b-divider-panel",
        ".nafs-b-choices",
        "grid-template-columns: 1fr 1fr",
        ".nafs-b-qnum",
        ".nafs-b-school-header",
        ".nafs-b-key-grid",
        ".nafs-b-key-banner",
        ".math-atom",
        "break-inside: avoid",
        "is-sheet",
        "is-flow",
        "@media print",
        "210mm",
    ):
        if needle not in css:
            errors.append(f"css missing: {needle}")
    # الغلاف/الفواصل بلا ارتفاع A4؛ ورقة OMR تستعيد 297mm مع فصل المفتاح
    import re

    if re.search(r"\.nafs-b-page\.is-sheet[^{]*\{[^}]*height:\s*297mm", css, re.S):
        errors.append("booklet sheet pages must not force height:297mm")
    if "break-inside: avoid" not in css and "page-break-inside: avoid" not in css:
        errors.append("sheet pages need break-inside avoid")
    if "home-mock-print .nafs-c-page" not in css:
        errors.append("home-mock must style OMR pages")
    if "page-break-before: always" not in css and "break-before: page" not in css:
        errors.append("answer key must force new page before itself")
    if ".nafs-b-key" not in css:
        errors.append("key page styles required")

    js = JS.read_text(encoding="utf-8")
    for needle in (
        "function renderBooklet",
        "function renderAnswerKey",
        "function schoolHeader",
        "function dividerPage",
        "function choiceGrid",
        "function nRange",
        "function rangeHtml",
        "function paginateSection",
        "hidePassage",
        "nafs-b-choices",
        "nafs-b-school-header",
        "nafs-b-range",
        "INSTR_READING",
        "diagram_svg",
        "groupByDomain",
        "sortByN",
        "القسم ",
        "نموذج تدريبي",
        "/assets/ministry_logo.png",
        "/assets/vision_2030.png",
        "/assets/nafs_logo.png",
        "function assetUrl",
        "dir=\"ltr\"",
        "الإدارة العامة للتعليم بمنطقة المدينة المنورة",
        "متوسطة سعد بن الربيع الأنصاري",
    ):
        if needle not in js:
            errors.append(f"js missing: {needle}")
    if "items[0].n" in js and "nRange" not in js:
        errors.append("section range must use min/max nRange not first/last only")
    if not (ROOT / "School_Data" / "assets" / "nafs_logo.png").is_file():
        errors.append("missing School_Data/assets/nafs_logo.png")
    # لا اختلاق رسوم: لا مسارات صور وهمية
    if "placeholder.svg" in js or "fake-diagram" in js:
        errors.append("must not invent diagram assets")
    # لا استخدام القالب المحصّن في كراسة نافس المنزلية
    if "doc-official-header" in js or "official-document-frame" in js:
        errors.append("must not reuse fortified official-frame classes in booklet")

    adaptive_js = ADAPTIVE_JS.read_text(encoding="utf-8")
    if "NafsHomeMockBooklet" not in adaptive_js or "renderBooklet" not in adaptive_js:
        errors.append("adaptive must print via NafsHomeMockBooklet")
    if "renderAnswerKey" not in adaptive_js:
        errors.append("adaptive must print key via renderAnswerKey")
    if "home-mock-booklet" not in adaptive_js and "nafs-home-mock-booklet.css" not in adaptive_js:
        errors.append("adaptive must load booklet css")
    if 'مفتاح التصحيح لولي الأمر</h2>' in adaptive_js and "renderAnswerKey" not in adaptive_js:
        errors.append("legacy inline key markup must be replaced by renderAnswerKey")

    adaptive_py = ADAPTIVE_PY.read_text(encoding="utf-8")
    if 'row["diagram_svg"]' not in adaptive_py and "diagram_svg" not in adaptive_py:
        errors.append("home mock pack must pass saved diagram_svg")
    if "block_first_order" not in adaptive_py or 'sequencing": "block-first"' not in adaptive_py:
        errors.append("home mock pack must use block-first sequencing (wave α)")
    if "assertBlockFirstContiguous" not in js:
        errors.append("booklet must expose assertBlockFirstContiguous")
    if "nafs-b-key-list" not in js:
        errors.append("answer key must use sequential key list")

    html = PORTAL.read_text(encoding="utf-8")
    if "nafs-home-mock-booklet.css" not in html or "nafs-home-mock-booklet.js" not in html:
        errors.append("portal-student must include booklet assets")

    for path in FORTIFIED:
        if not path.exists():
            errors.append(f"fortified missing: {path.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK nafs_home_mock_booklet_design_test")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
