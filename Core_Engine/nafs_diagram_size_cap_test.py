# موجة أ: سقف أبعاد الرسوم في واجهة الطالب
# تشغيل: python3 -m Core_Engine.nafs_diagram_size_cap_test
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "Print_Canvas" / "css" / "portal-student.css"
FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)


def main() -> int:
    errors: list[str] = []
    css = CSS.read_text(encoding="utf-8")
    block = re.search(
        r"\.q-diagram svg,\s*\.q-diagram \.nafs-q-diagram-svg\s*\{([^}]+)\}",
        css,
        re.S,
    )
    if not block:
        errors.append("missing .q-diagram svg rule block")
    else:
        body = block.group(1)
        if "max-height: 200px" not in body:
            errors.append("max-height: 200px required")
        if "max-width: min(100%, 340px)" not in body and "max-width:min(100%,340px)" not in body.replace(
            " ", ""
        ):
            errors.append("max-width: min(100%, 340px) required")
        if "direction: ltr" not in body:
            errors.append("direction: ltr required for axes")
        if re.search(r"max-width:\s*100%\s*;", body) and "min(100%" not in body:
            errors.append("uncapped max-width:100% must not remain alone")

    for path in FORTIFIED:
        if not path.is_file():
            errors.append(f"fortified missing {path.name}")

    if errors:
        print("FAIL nafs-diagram-size-cap")
        for e in errors:
            print(" -", e)
        return 1
    print(
        "OK nafs-diagram-size-cap",
        {"max_height": "200px", "max_width": "min(100%, 340px)", "axes": "ltr"},
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
