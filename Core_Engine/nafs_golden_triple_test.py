# بطاقات الرياضيات الذهبية — بنية ثلاثية منضبطة
# تشغيل: python3 -m Core_Engine.nafs_golden_triple_test
from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    errors: list[str] = []
    from .nafs_misconception_lab import GOLDEN_DECK

    math_cards = [c for c in GOLDEN_DECK if c.get("domain") == "math"]
    if len(math_cards) != 8:
        errors.append(f"math cards={len(math_cards)}")

    required = ("line_title", "line_concept", "line_example", "layout")
    for c in math_cards:
        for key in required:
            if not c.get(key):
                errors.append(f"{c.get('id')} missing {key}")
        if c.get("layout") != "triple":
            errors.append(f"{c.get('id')} layout")
        # كل طبقة مستقلة وغير فارغة
        title, concept, example = c["line_title"], c["line_concept"], c["line_example"]
        if title != c.get("front"):
            errors.append(f"{c['id']} title/front mismatch")
        if "مثال:" in concept or "مثال:" in example:
            errors.append(f"{c['id']} still uses مثال: glue")
        if re.search(r"[0-9]", f"{title}{concept}{example}"):
            errors.append(f"{c['id']} western digit")
        # المثال يحمل رقماً هندياً أو رمزاً تطبيقياً
        if not re.search(r"[٠-٩]", example):
            errors.append(f"{c['id']} example lacks eastern digit")
        # لا تدمج مفهومين بفاصل «؛» في المفهوم
        if "؛" in concept:
            errors.append(f"{c['id']} compound concept")

    m1 = next(c for c in math_cards if c["id"] == "m1")
    if "أ² + ب² = ج²" not in m1["line_concept"]:
        errors.append("m1 concept formula")
    if "ج = ٥" not in m1["line_example"]:
        errors.append("m1 example incomplete")

    m3 = next(c for c in math_cards if c["id"] == "m3")
    if "١٥٪ من ٢٠٠ = ٣٠" not in m3["line_example"]:
        errors.append("m3 example")

    m6 = next(c for c in math_cards if c["id"] == "m6")
    if "مستطيل" in m6["line_title"] or "مساحة" in m6["line_title"]:
        errors.append("m6 still mixed area/perimeter title")

    m7 = next(c for c in math_cards if c["id"] == "m7")
    if "وسيط" in m7["line_title"] or "وسيط" in m7["line_concept"]:
        errors.append("m7 still mixes median")

    js = (Path(__file__).resolve().parents[1] / "Print_Canvas/js/portal-student.js").read_text(
        encoding="utf-8"
    )
    css = (Path(__file__).resolve().parents[1] / "Print_Canvas/css/portal-student.css").read_text(
        encoding="utf-8"
    )
    if "renderGoldenBack" not in js or "flip-triple" not in js:
        errors.append("portal-student.js missing triple renderer")
    if ".flip-triple" not in css or ".line-concept" not in css:
        errors.append("portal-student.css missing triple styles")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(
        "OK",
        {
            "math": len(math_cards),
            "ids": [c["id"] for c in math_cards],
            "m1": [m1["line_title"], m1["line_concept"], m1["line_example"]],
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
