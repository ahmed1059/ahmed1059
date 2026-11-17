# -*- coding: utf-8 -*-
"""عمق إضافي: هل المؤشر في تذييل شواهد متكرر أم في حقل خاص؟"""
from __future__ import annotations

import csv
import importlib.util
from pathlib import Path

OUT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("en", OUT / "_enrich_01_inventory.py")
en = importlib.util.module_from_spec(spec)
spec.loader.exec_module(en)

lines = en.SOURCE.read_text(encoding="utf-8", errors="replace").splitlines()
rows = list(csv.DictReader(en.CSV_PATH.open(encoding="utf-8-sig")))
blocks = en.blocks_by_start(lines, rows)

FOOTER = "شواهد التقويم المدرسي"
footer_only = 0
field_like = 0
examples_field = []
examples_footer = []
for r in rows:
    ind = (r.get("explicit_indicator") or "").strip()
    if not ind:
        continue
    block = blocks[int(r["سطر_البداية"])]
    codes = ind.split(";")
    # أسطر تحتوي الرمز
    hit_lines = [ln.strip() for ln in block.splitlines() if any(c in ln for c in codes)]
    only_footer = hit_lines and all(FOOTER in ln or "المؤشر:" in ln for ln in hit_lines)
    if only_footer:
        footer_only += 1
        if len(examples_footer) < 5:
            examples_footer.append((r["رقم"], r["العنوان"][:50], hit_lines[0][:70]))
    else:
        field_like += 1
        if len(examples_field) < 10:
            examples_field.append((r["رقم"], r["العنوان"][:50], hit_lines[0][:70] if hit_lines else "?"))

print("footer_boilerplate", footer_only, "other_literal", field_like)
print("FIELD examples:")
for e in examples_field:
    print(e)
print("FOOTER examples:")
for e in examples_footer:
    print(e)
