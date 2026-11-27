# تلميع إخراج الطباعة: أرقام هندية + LTR قسري + صيغ + OMR
# تشغيل: python3 -m Core_Engine.nafs_home_mock_print_polish_test
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

BOOKLET_JS = ROOT / "Print_Canvas" / "js" / "nafs-home-mock-booklet.js"
BOOKLET_CSS = ROOT / "Print_Canvas" / "css" / "nafs-home-mock-booklet.css"
OMR_JS = ROOT / "Print_Canvas" / "js" / "nafs-wave-c-answer-sheet.js"
OMR_CSS = ROOT / "Print_Canvas" / "css" / "nafs-wave-c-answer-sheet.css"
FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)


def main() -> int:
    errors: list[str] = []
    booklet_js = BOOKLET_JS.read_text(encoding="utf-8")
    booklet_css = BOOKLET_CSS.read_text(encoding="utf-8")
    omr_js = OMR_JS.read_text(encoding="utf-8")
    omr_css = OMR_CSS.read_text(encoding="utf-8")

    for needle in (
        "function ltrForce",
        "function renderBookletMathLocal",
        "etec-force",
        "PERSIAN",
        "EASTERN = \"٠١٢٣٤٥٦٧٨٩\"",
        "\\u2066",
        "frac",
        "math-atom",
        "سم|مم|م|غ|كغ|نيوتن|ث",
    ):
        if needle not in booklet_js:
            errors.append(f"booklet_js missing {needle}")

    # لا شرطة | بعد حرف الخيار (كانت تنقلب وتبدو زائدة)
    if 'content: " |"' in booklet_css or "content: ' |'" in booklet_css:
        errors.append("choice lbl must not use pipe separator")
    if 'content: ")"' not in booklet_css:
        errors.append("choice lbl should use ) after letter")

    for needle in (
        "bidi-override",
        "etec-force",
        "object-fit: contain",
        "transform: none",
    ):
        if needle not in booklet_css:
            errors.append(f"booklet_css missing {needle}")

    for needle in (
        "function ltrForce",
        "PERSIAN",
        "etec-force",
        "ltrForce(student.national_id",
    ):
        if needle not in omr_js:
            errors.append(f"omr_js missing {needle}")

    if "ltrForce(" not in omr_js or "ministry_id_ar" not in omr_js:
        errors.append("omr must ltrForce ministry id")
    if "ltrForce(student.national_id" not in omr_js:
        errors.append("omr must easternize national id display")

    # التسمية العمودية أُبعدت عن الحافة
    if "writing-mode: vertical-rl" in omr_css and "nafs-c-vlabel" in omr_css:
        block = omr_css.split(".nafs-c-vlabel")[1][:400]
        if "vertical-rl" in block:
            errors.append("omr vlabel must not stay vertical on timing edge")
    if "bottom: 3.5mm" not in omr_css and "bottom: 3mm" not in omr_css:
        errors.append("omr vlabel should sit at page bottom away from marks")

    if "bidi-override" not in omr_css:
        errors.append("omr css needs bidi-override for etec-force")

    # لا اختلاق مفاتيح في مسار OMR
    if "answer_key" in omr_js and "مفتاح التصحيح" in omr_js:
        errors.append("omr js must not invent answer keys")

    for path in FORTIFIED:
        if not path.exists():
            errors.append(f"fortified missing {path.name}")

    # محاكاة تحويل شرقية سريعة عبر منطق مكافئ
    eastern = "٠١٢٣٤٥٦٧٨٩"
    persian = "۰۱۲۳۴۵۶۷۸۹"

    def east(val: str) -> str:
        out = []
        for ch in str(val):
            if ch in persian:
                out.append(eastern[persian.index(ch)])
            elif ch.isdigit():
                out.append(eastern[int(ch)])
            elif ch == "%":
                out.append("٪")
            else:
                out.append(ch)
        return "".join(out)

    if east("40341") != "٤٠٣٤١":
        errors.append("east 40341")
    if east("۸") != "٨":  # Persian 8 → Arabic-Indic 8
        errors.append(f"persian 8 normalize got {east('۸')!r}")
    if east("S-40341") != "S-٤٠٣٤١":
        errors.append("ministry east")
    if re.search(r"[0-9]", east("20-10")):
        errors.append("western digits leaked after east")

    # المنزلية: مفتاح يرتبط بـ ١…ن
    if "nafs-b-key-list" not in booklet_js or "ltrForce(r.n)" not in booklet_js:
        errors.append("answer key must ltrForce item numbers")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK nafs_home_mock_print_polish_test")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
