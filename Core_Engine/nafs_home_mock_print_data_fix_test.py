# إصلاح إخراج الكراسة: نطاقات LTR + ترقيم + منع تكرار المقطع
# تشغيل: python3 -m Core_Engine.nafs_home_mock_print_data_fix_test
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

JS = ROOT / "Print_Canvas" / "js" / "nafs-home-mock-booklet.js"
CSS = ROOT / "Print_Canvas" / "css" / "nafs-home-mock-booklet.css"
FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)


def main() -> int:
    errors: list[str] = []
    js = JS.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")

    for needle in (
        "function nRange",
        "function rangeHtml",
        "function sortByN",
        "function paginateSection",
        "hidePassage",
        'dir="ltr"',
        "nafs-b-range",
        "cleanDisplay",
    ):
        if needle not in js:
            errors.append(f"js missing {needle}")

    # لا يعتمد النطاق على أول/آخر عنصر غير مفرز فقط
    if re.search(r"items\[0\]\.n.*items\.length.*n", js) and "nRange" not in js:
        errors.append("legacy first/last range without nRange")

    for needle in (
        "break-inside: avoid",
        ".nafs-b-qblock",
        ".math-atom",
        "page-break-inside: avoid",
    ):
        if needle not in css:
            errors.append(f"css missing {needle}")

    for path in FORTIFIED:
        if not path.exists():
            errors.append(f"fortified missing {path.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK nafs_home_mock_print_data_fix_test")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
