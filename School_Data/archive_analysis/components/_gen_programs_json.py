# -*- coding: utf-8 -*-
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "Core_Engine" / "program_registry.py"
OUT = Path(__file__).resolve().parent / "tpl01" / "programs.json"
text = SRC.read_text(encoding="utf-8")
# استخراج كتل القوالب عبر مفاتيح program_name داخل TEMPLATES حتى نهاية OWNERS تقريباً
block = text.split("TEMPLATES = (", 1)[1].split("\nOWNERS", 1)[0]
chunks = re.split(r"\n\s*\{\s*\n", block)
programs = []
for chunk in chunks:
    name_m = re.search(r'"program_name":\s*"([^"]+)"', chunk)
    if not name_m:
        continue
    key_m = re.search(r'"key":\s*"([^"]+)"', chunk)
    label_m = re.search(r'"label":\s*"([^"]+)"', chunk)
    aud_m = re.search(r'"target_audience":\s*"([^"]+)"', chunk)
    dom_m = re.search(r'"domain":\s*"([^"]+)"', chunk)
    name = name_m.group(1)
    kind = "برنامج"
    if any(k in name for k in ("مسابقة", "أولمبياد", "جائزة", "منافسة")):
        kind = "مسابقة"
    elif "مبادرة" in name:
        kind = "مبادرة"
    programs.append(
        {
            "id": (key_m.group(1) if key_m else name),
            "name": name,
            "label": label_m.group(1) if label_m else name,
            "kind": kind,
            "target_audience": aud_m.group(1) if aud_m else "",
            "domain": dom_m.group(1) if dom_m else "",
            "source": "program_registry.TEMPLATES",
        }
    )

payload = {
    "meta": {
        "count": len(programs),
        "source": "Core_Engine/program_registry.py TEMPLATES",
        "note": "fallback when /api/programs unavailable; live API preferred on :8080",
    },
    "programs": programs,
}
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("wrote", len(programs), "->", OUT)
