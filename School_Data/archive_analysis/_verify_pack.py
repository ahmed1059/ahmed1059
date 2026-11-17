# -*- coding: utf-8 -*-
"""تحققات ما قبل الاعتماد: عيّنة fillable + تدقيق المؤشرات + تصنيف المؤجلات."""
from __future__ import annotations

import csv
import importlib.util
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

OUT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("en", OUT / "_enrich_01_inventory.py")
en = importlib.util.module_from_spec(spec)
spec.loader.exec_module(en)

SOURCE = en.SOURCE
CSV_PATH = en.CSV_PATH
lines = SOURCE.read_text(encoding="utf-8", errors="replace").splitlines()
rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8-sig")))
blocks = en.blocks_by_start(lines, rows)

# ——— تحقق 1: عيّنة unknown ———
EDU_NOISE = [
    "أكتب هنا خيار إضافي",
    "أكتب خيارات إضافية",
    "اكتب هنا",
    "أكتب هنا",
    "لخّص الغاية",
    "لخص الغاية",
    "اذكر الأهداف",
    "اذكر عناصر",
    "وضح الغاية",
    "ّلم يتمّ اختيار أيّ ملفّ",
    "لم يتم اختيار أي ملف",
    "ضع رابط الشواهد",
    "أقصى حد للشواهد",
    "ضغط الشواهد",
    "إضافة شواهد (صور)",
]


def reason_unknown(title: str, block: str) -> str:
    t = en._template_score(block)
    f = en._filled_score(block)
    markers = [m for m in en.TEMPLATE_MARKERS if m in block]
    has_long = any(
        len(ln.strip()) >= 45
        and sum(1 for ch in ln if "\u0600" <= ch <= "\u06ff") >= 35
        for ln in block.splitlines()
    )
    return (
        f"template_score={t} ({', '.join(markers[:3]) or '—'}); "
        f"filled_score={f}; "
        f"فقرات_طويلة={'نعم' if has_long else 'لا'}; "
        f"النوع={next((r['النوع'] for r in rows if r['العنوان']==title), '?')}; "
        f"السبب=مختلط (تعليمات+محتوى) حسب القاعدة الضيقة"
    )


unknowns = [r for r in rows if r["fillable"] == "unknown"]
# عيّنة متنوعة حسب النوع
by_type: dict[str, list] = {}
for r in unknowns:
    by_type.setdefault(r["النوع"], []).append(r)
sample = []
for kind in ["نموذج", "خطة", "تقرير", "سجل", "محضر", "استمارة", "غير مصنّف بعد", "كشف", "قرار", "خطاب"]:
    for r in by_type.get(kind, [])[:2]:
        if len(sample) < 20:
            sample.append(r)
# أكمل إلى 20
for r in unknowns:
    if len(sample) >= 20:
        break
    if r not in sample:
        sample.append(r)

v1_lines = [
    "# verification_01_fillable_sample",
    f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
    "## القاعدة الحالية (ضيقة): أي تعليمات + أي محتوى معبأ ⇒ unknown",
    f"## إحصاء حالي: {Counter(r['fillable'] for r in rows)}",
    "",
    "| # | رقم | العنوان | النوع | لماذا ليست template |",
    "|---:|---:|---|---|---|",
]
for i, r in enumerate(sample[:20], 1):
    block = blocks[int(r["سطر_البداية"])]
    v1_lines.append(
        f"| {i} | {r['رقم']} | {r['العنوان'][:60]} | {r['النوع']} | {reason_unknown(r['العنوان'], block)} |"
    )

# تحليل الضيق
type_fill = Counter((r["النوع"], r["fillable"]) for r in rows if r["layer"] == "operational")
v1_lines += [
    "",
    "## ملاحظة الضيق",
    "تحت القاعدة الحالية، كل مقطع فيه جملة وصفية طويلة + جملة تعليمية واحدة يُصنَّف unknown.",
    "أرشيف edu-forms تقريباً كله كذلك → template≈5 (كلها presentation) فقط.",
    "هذا ضيق منهجي بالنسبة لغرض العمود (تمييز القالب القابل لإعادة الاستخدام).",
    "",
    "### توزيع النوع×fillable (تشغيلي)",
    "",
    "| النوع | template | filled | unknown |",
    "|---|---:|---:|---:|",
]
kinds = sorted({k for k, _ in type_fill})
for kind in kinds:
    v1_lines.append(
        f"| {kind} | {type_fill.get((kind,'template'),0)} | {type_fill.get((kind,'filled'),0)} | {type_fill.get((kind,'unknown'),0)} |"
    )

(OUT / "verification_01_fillable_sample.md").write_text(
    "\n".join(v1_lines) + "\n", encoding="utf-8"
)

# ——— تحقق 2: مؤشرات ———
IND_RE = en.INDICATOR_RE
literal = []
title_only = []
both = []
for r in rows:
    ind = (r.get("explicit_indicator") or "").strip()
    if not ind:
        continue
    codes = [c for c in ind.split(";") if c]
    title = r["العنوان"]
    block = blocks[int(r["سطر_البداية"])]
    # أسطر بعد العنوان
    body = "\n".join(block.splitlines()[1:])
    in_title = [c for c in codes if c in title]
    in_body = [c for c in codes if c in body]
    # هل الرمز في العنوان فقط؟
    if in_title and not in_body:
        title_only.append((r, codes, in_title))
    elif in_body and not in_title:
        literal.append((r, codes, in_body))
    else:
        both.append((r, codes, in_title, in_body))

v2 = [
    "# verification_02_indicators",
    f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
    f"## إجمالي الصفوف ذات explicit_indicator: {sum(1 for r in rows if (r.get('explicit_indicator') or '').strip())}",
    f"- مؤشر في الجسم فقط (صريح حرفياً في النص): **{len(literal)}**",
    f"- مؤشر في العنوان فقط: **{len(title_only)}**",
    f"- في العنوان والجسم معاً: **{len(both)}**",
    "",
    "## 10 أمثلة — مؤشر صريح في جسم النموذج (ليس العنوان وحده)",
    "",
    "| # | رقم | العنوان | الرموز في الجسم | مقتطف |",
    "|---:|---:|---|---|---|",
]
for i, (r, codes, in_body) in enumerate(literal[:10], 1):
    block = blocks[int(r["سطر_البداية"])]
    # مقتطف حول أول رمز
    snippet = ""
    for ln in block.splitlines():
        if in_body[0] in ln and r["العنوان"] not in ln:
            snippet = ln.strip()[:80]
            break
    if not snippet:
        for ln in block.splitlines():
            if in_body[0] in ln:
                snippet = ln.strip()[:80]
                break
    v2.append(
        f"| {i} | {r['رقم']} | {r['العنوان'][:50]} | {';'.join(in_body[:4])} | {snippet} |"
    )

v2 += [
    "",
    "## عيّنة — مؤشر في العنوان فقط (للتفرقة)",
    "",
    "| رقم | العنوان | الرموز |",
    "|---:|---|---|",
]
for r, codes, in_title in title_only[:8]:
    v2.append(f"| {r['رقم']} | {r['العنوان'][:70]} | {';'.join(in_title)} |")

(OUT / "verification_02_indicators.md").write_text("\n".join(v2) + "\n", encoding="utf-8")
print("V1 sample", len(sample), "V2 literal", len(literal), "title_only", len(title_only), "both", len(both))
print("wrote verification_01 and verification_02")
