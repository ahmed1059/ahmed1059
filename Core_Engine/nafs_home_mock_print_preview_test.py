# إصلاح معاينة/طباعة الاختبار المنزلي في بوابة الطالب (بلا AJPrint)
# تشغيل: python3 -m Core_Engine.nafs_home_mock_print_preview_test
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

ENGINE = ROOT / "Print_Canvas" / "js" / "print-engine.js"
ADAPTIVE = ROOT / "Print_Canvas" / "js" / "portal-student-adaptive.js"
PORTAL = ROOT / "Print_Canvas" / "portal-student.html"
FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)


def main() -> int:
    errors: list[str] = []
    engine = ENGINE.read_text(encoding="utf-8")
    if "sandbox-iframe-print" not in engine:
        errors.append("print-engine must fall back to sandbox iframe print")
    if 'error: "لوحة المعاينة غير جاهزة."' in engine and "printHtml(html, opts)" not in engine.split("function preview")[1][:800]:
        errors.append("preview must not die silently without AJPrint")
    if "AJPrint.show" not in engine:
        errors.append("AJPrint stage path must remain for app-journey")

    adaptive = ADAPTIVE.read_text(encoding="utf-8")
    for needle in (
        "openVisiblePreview",
        "printHomeMock(pack.pack",
        "result.ok",
        "allow بالنوافذ" if False else "النوافذ المنبثقة",
    ):
        if needle not in adaptive:
            errors.append(f"adaptive missing: {needle}")
    if "جاهزة للطباعة." in adaptive and "result.ok" not in adaptive:
        errors.append("must not claim ready without open result")

    html = PORTAL.read_text(encoding="utf-8")
    if "print-engine.js?v=pe2" not in html:
        errors.append("portal-student cache bump for print-engine")
    if "portal-student-adaptive.js?v=" not in html:
        errors.append("portal-student cache bump for adaptive")

    for path in FORTIFIED:
        if not path.exists():
            errors.append(f"fortified missing: {path.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK nafs_home_mock_print_preview_test")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
