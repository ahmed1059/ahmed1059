# -*- coding: utf-8 -*-
"""قرار 48: عمود evidence_type + تخفيض title_only في التقييم النهائي."""
from __future__ import annotations

import csv
from collections import Counter
from datetime import datetime
from pathlib import Path

OUT = Path(__file__).resolve().parent
IND = OUT / "03_indicators.csv"
RUN = OUT / "03_run_log.md"
DEC = OUT / "decisions_log.md"

rows = list(csv.DictReader(IND.open(encoding="utf-8-sig")))
for r in rows:
    ev = (r.get("evidence") or "").strip()
    title = (r.get("العنوان") or "").strip()
    if not ev:
        r["evidence_type"] = ""
    elif ev == title:
        r["evidence_type"] = "title"
    elif title and title in ev and len(ev) > len(title) + 10:
        r["evidence_type"] = "both"
    elif title and any(p in ev for p in title.split()[:3] if len(p) > 3) and len(ev) > 40:
        r["evidence_type"] = "both"
    else:
        r["evidence_type"] = "body"

# تقييم نهائي للـ high المستنتج
high = [r for r in rows if r.get("inferred") == "true" and r.get("confidence") == "high"]
title_only_high = [r for r in high if r.get("evidence_type") == "title"]
# لا نغيّر confidence في CSV دون إذن — نسجّل التقييم النهائي في اللوق
# لكن القرار يقول تُخفَّض في التقييم النهائي — نضيف عمود confidence_final
for r in rows:
    if r.get("inferred") == "true" and r.get("confidence") == "high" and r.get("evidence_type") == "title":
        r["confidence_final"] = "medium"
    else:
        r["confidence_final"] = r.get("confidence") or ""

fields = list(rows[0].keys())
if "evidence_type" not in fields:
    fields.append("evidence_type")
if "confidence_final" not in fields:
    fields.append("confidence_final")
with IND.open("w", encoding="utf-8-sig", newline="") as h:
    w = csv.DictWriter(h, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    w.writerows(rows)

cf = Counter(r["confidence_final"] for r in rows if r.get("inferred") == "true")
et = Counter(r["evidence_type"] for r in rows if r.get("inferred") == "true")
note = f"""
## قرار 48 — evidence_type والتقييم النهائي للـ high
### التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}
- أُضيف عمود `evidence_type`: title / body / both.
- أُضيف عمود `confidence_final`: يُخفَّض high→medium إذا كان الدليل title فقط.
- الـ7 high الأصلية: **كلها title** → high الفعلي بعد التخفيض = **0** · medium المستنتج الفعلي = 3+7 = **10** · low = **34**.
- توزيع evidence_type للمستنتج: {dict(et)}
- توزيع confidence_final للمستنتج: {dict(cf)}
"""
run = RUN.read_text(encoding="utf-8")
if "قرار 48 — evidence_type" in run:
    run = run.split("## قرار 48 — evidence_type")[0].rstrip()
RUN.write_text(run + "\n" + note + "\n", encoding="utf-8")

dec = DEC.read_text(encoding="utf-8")
block = """
### [قرار 48] evidence_type في 03_indicators.csv؛ high ذات دليل title فقط → medium في confidence_final.
الـ7 high الأصلية كلها title → high الفعلي 0 · medium 10 · low 34.

### [قرار 49] ربط التطوع بـ1-3-1-3 التزام بوسم الأرشيف؛ تدقيق احتمال خلط الوسوم في خ9.

### [قرار 50] اعتماد خ3 نهائياً (مؤكد مع 48–49).

### [قرار 51] فتح الخوارزمية 4 رسمياً — 2026-11-01. لا فتح لخ5 قبل التسليم والمراجعة.

"""
if "[قرار 48]" not in dec:
    if "## فرضية مسجّلة" in dec:
        dec = dec.replace("## فرضية مسجّلة", block + "## فرضية مسجّلة")
    else:
        dec += block
    DEC.write_text(dec, encoding="utf-8")

print("title_only_high", len(title_only_high), "final", dict(cf))
