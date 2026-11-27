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
        "@media print",
        "210mm",
    ):
        if needle not in css:
            errors.append(f"css missing: {needle}")

    js = JS.read_text(encoding="utf-8")
    for needle in (
        "function renderBooklet",
        "function dividerPage",
        "function choiceGrid",
        "nafs-b-choices",
        "INSTR_READING",
        "diagram_svg",
        "groupByDomain",
        "القسم ",
        "نموذج تدريبي",
    ):
        if needle not in js:
            errors.append(f"js missing: {needle}")
    # لا اختلاق رسوم: لا مسارات صور وهمية
    if "placeholder.svg" in js or "fake-diagram" in js:
        errors.append("must not invent diagram assets")

    adaptive_js = ADAPTIVE_JS.read_text(encoding="utf-8")
    if "NafsHomeMockBooklet" not in adaptive_js or "renderBooklet" not in adaptive_js:
        errors.append("adaptive must print via NafsHomeMockBooklet")
    if "home-mock-booklet" not in adaptive_js and "nafs-home-mock-booklet.css" not in adaptive_js:
        errors.append("adaptive must load booklet css")

    adaptive_py = ADAPTIVE_PY.read_text(encoding="utf-8")
    if 'row["diagram_svg"]' not in adaptive_py and "diagram_svg" not in adaptive_py:
        errors.append("home mock pack must pass saved diagram_svg")

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
