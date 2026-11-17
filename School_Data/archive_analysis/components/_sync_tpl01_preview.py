# -*- coding: utf-8 -*-
"""مهجور (قرار 140): المزامنة عبر `_build_wave_km.py` → sync_to_print_canvas."""
from pathlib import Path
import shutil

src = Path(__file__).resolve().parent / "tpl01"
root = Path(__file__).resolve().parents[3]
dst = root / "Print_Canvas" / "components" / "tpl01"
preview = root / "Print_Canvas" / "preview-tpl01.html"
dst.mkdir(parents=True, exist_ok=True)
for name in [
    "TPL-01.js",
    "identity.json",
    "indicators.json",
    "TPL-01.json",
    "programs.json",
]:
    if (src / name).exists():
        shutil.copy2(src / name, dst / name)

html = (src / "TPL-01.html").read_text(encoding="utf-8")
html = html.replace("../../../Print_Canvas/css/", "css/")
html = html.replace("../../../Print_Canvas/js/", "js/")
html = html.replace('src="TPL-01.js"', 'src="components/tpl01/TPL-01.js"')
html = html.replace(
    'identityUrl: "identity.json"',
    'identityUrl: "components/tpl01/identity.json"',
)
html = html.replace(
    'indicatorsUrl: "indicators.json"',
    'indicatorsUrl: "components/tpl01/indicators.json"',
)
html = html.replace(
    'programsUrl: "programs.json"',
    'programsUrl: "components/tpl01/programs.json"',
)
preview.write_text(html, encoding="utf-8")
print("synced", dst, "->", preview)
