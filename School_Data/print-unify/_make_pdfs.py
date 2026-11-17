# -*- coding: utf-8 -*-
import json, subprocess, time
from pathlib import Path

out = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059\School_Data\print-unify")
css = (out / "_bundle.css").read_text(encoding="utf-8")
desk = Path(r"C:\Users\Toshiba\Desktop")
chrome = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

# Load payloads dumped by companion step
payloads = json.loads((out / "_payloads.json").read_text(encoding="utf-8"))

def wrap(name, body, landscape=False, multi=False):
    classes = ["erp-shell", "print-mode", "print-official-core", "is-print-preview"]
    if landscape:
        classes.append("print-official-landscape")
    if multi:
        classes.append("print-official-multi")
        classes.append("print-council")
    size = "A4 landscape" if landscape else "A4 portrait"
    named = "official-core-a4-landscape" if landscape else "official-core-a4"
    inject = f"@page{{size:{size} !important;margin:0 !important;}}@page {named}{{size:{size};margin:0;}}"
    host = f'<div id="{"council-print-host" if multi else "official-frame-host"}" class="{"council-print-host" if multi else "official-frame-host"}">{body}</div>'
    return f"""<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><base href="http://127.0.0.1:8060/"><title>{name}</title><style>{css}\n{inject}</style></head><body class="{' '.join(classes)}">{host}</body></html>"""

specs = [
    ("01-program", payloads["program"], False, False),
    ("02-witness", payloads["witness"], False, False),
    ("03-council", payloads["council"], False, True),
    ("04-attendance", payloads["attendance"], True, False),
]

results = []
for name, body, landscape, multi in specs:
    html_path = out / f"{name}.html"
    pdf_path = out / f"{name}.pdf"
    desk_pdf = desk / f"unify-{name}.pdf"
    html_path.write_text(wrap(name, body, landscape, multi), encoding="utf-8")
    if pdf_path.exists():
        pdf_path.unlink()
    url = html_path.as_uri()
    subprocess.run([chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={pdf_path}", url], check=False)
    time.sleep(2)
    ok = pdf_path.exists()
    if ok:
        import shutil
        shutil.copy2(pdf_path, desk_pdf)
    results.append((name, ok, pdf_path.stat().st_size if ok else 0))

print(json.dumps(results, ensure_ascii=False))
