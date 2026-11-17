# -*- coding: utf-8 -*-
"""دخان خ-مك-2: يتحقق من وجود الملفات ومسارات الأصول وخلو JS من أخطاء تركيب شائعة."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent.parent.parent
PC = PROJECT / "Print_Canvas"
PC_COMP = PC / "components"


def main() -> int:
    reg = json.loads((ROOT / "registry.json").read_text(encoding="utf-8"))
    failures = []
    for item in reg["templates"]:
        folder = item["folder"]
        tid = item["id"]
        for base in (ROOT / folder, PC_COMP / folder):
            html = base / f"{tid}.html"
            js = base / f"{tid}.js"
            if not html.exists():
                failures.append(f"missing html: {html}")
                continue
            if not js.exists():
                failures.append(f"missing js: {js}")
            text = html.read_text(encoding="utf-8")
            js_text = js.read_text(encoding="utf-8") if js.exists() else ""
            if "+;" in js_text.replace(" ", "").replace("\n", ""):
                failures.append(f"syntax trailing +; in {js}")
            if "OfficialFrameCore" not in text and "official-frame-core" not in text:
                failures.append(f"no OfficialFrameCore script: {html}")
            if "tpl-common" not in text:
                failures.append(f"no tpl-common: {html}")
            # مسارات Print_Canvas
            if base.parent == PC_COMP:
                if "../../../Print_Canvas/" in text:
                    failures.append(f"unrewritten archive path: {html}")
                if re.search(r'src="\.\./js/', text):
                    failures.append(f"wrong js depth ../js (need ../../js): {html}")

    # أصول مشتركة
    for name in (
        "tpl-common.js",
        "identity.json",
        "indicators.json",
        "programs.json",
        "committees.json",
    ):
        if not (PC_COMP / "_shared" / name).exists():
            failures.append(f"missing shared: {name}")

    if not (PC / "preview-tpl-hub.html").exists():
        failures.append("missing preview-tpl-hub.html")
    if not (PC / "preview-tpl01.html").exists():
        failures.append("missing preview-tpl01.html")

    print("templates", len(reg["templates"]))
    if failures:
        print("FAIL", len(failures))
        for f in failures:
            print(" -", f)
        return 1
    print("SMOKE OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
