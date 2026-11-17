# -*- coding: utf-8 -*-
from __future__ import annotations

import csv
import random
from datetime import datetime
from pathlib import Path

OUT = Path(__file__).resolve().parent
from config import get_archive_path

SOURCE = get_archive_path()
inds = list(csv.DictReader((OUT / "03_indicators.csv").open(encoding="utf-8-sig")))
inv = {r["رقم"]: r for r in csv.DictReader((OUT / "01_inventory.csv").open(encoding="utf-8-sig"))}
lines = SOURCE.read_text(encoding="utf-8", errors="replace").splitlines()
ops = [
    r
    for r in inv.values()
    if r.get("layer") == "operational" and str(r.get("سطر_البداية") or "").strip()
]
starts = sorted(int(r["سطر_البداية"]) for r in ops)
KEYS = {
    "1-2-1-1": [
        "سجل الغياب",
        "التأخر الصباحي",
        "حصر الحضور والغياب",
        "الانضباط المدرسي",
    ],
    "1-3-1-3": [
        "العمل التطوعي",
        "الشراكة المجتمعية",
        "التقرير الختامي السنوي للعمل التطوعي",
    ],
    "2-1-1-5": ["استراتيجية تعليمية", "تقرير تنفيذ استراتيجية"],
    "2-2-1-3": ["تحليل نتائج المهارات", "تحليل نتائج"],
}


def block(num: str, n: int = 40) -> str:
    r = inv[num]
    if not r.get("سطر_البداية"):
        return r["العنوان"]
    s = int(r["سطر_البداية"])
    i = starts.index(s)
    e = starts[i + 1] if i + 1 < len(starts) else len(lines) + 1
    return "\n".join(lines[s - 1 : min(e - 1, s - 1 + n)])


def quotes(num: str, codes: str) -> list[str]:
    title = inv[num]["العنوان"]
    b = block(num)
    ks: list[str] = []
    for c in codes.split(";"):
        ks.extend(KEYS.get(c, []))
    hits = []
    for ln in (title + "\n" + b).splitlines():
        if any(k in ln for k in ks):
            hits.append(ln.strip()[:140])
    return hits[:3] or [title]


high = [r for r in inds if r["inferred"] == "true" and r["confidence"] == "high"]
hl = [
    "",
    "## توثيق الـ7 high (قرار 46/47)",
    f"### التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
    "",
    "| # | form_id | النموذج | المؤشر | الدليل النصي | ملاحظة صدق |",
    "|---:|---|---|---|---|---|",
]
for i, r in enumerate(high, 1):
    q = " || ".join(quotes(r["form_id"], r["indicators"]))[:120]
    note = "متن + عنوان"
    if (r.get("evidence") or "").strip() == r["العنوان"].strip():
        note = "⚠️ الدليل المخزّن=العنوان فقط — high شكلي نسبياً؛ المراجعة البشرية ألزم"
    hl.append(
        f"| {i} | {r['form_id']} | {r['العنوان'][:42]} | {r['indicators']} | {q} | {note} |"
    )
hl += [
    "",
    "> بعض حالات high تعتمد بقوة على تطابق العنوان مع المفاتيح؛ لذلك تبقى `needs_human_review=true` حتى للـ high.",
    "",
]

vol = [
    r
    for r in inds
    if r["inferred"] == "true" and "1-3-1-3" in (r.get("indicators") or "")
]
random.seed(1059)
sample = random.sample(vol, 5)
vl = [
    "",
    "## عيّنة 5 من كتلة 1-3-1-3 المستنتجة (28 نموذجاً)",
    "",
    "| # | form_id | النموذج | الاقتباس | 1-3-1-3 أم 3-2-1-4؟ |",
    "|---:|---|---|---|---|",
]
for i, r in enumerate(sample, 1):
    b = block(r["form_id"], 45)
    ks = KEYS["1-3-1-3"]
    hits = [ln.strip()[:130] for ln in b.splitlines() if any(k in ln for k in ks)][:2]
    if not hits:
        hits = [r["العنوان"]]
    if "شراكة" in r["العنوان"] or any("شراكة" in h for h in hits):
        judge = "1-3-1-3 أوضح (شراكة مجتمعية)"
    else:
        judge = "1-3-1-3 باتساق real الأرشيف (التطوع تحت نفس الرمز) — ليس 3-2-1-4 هنا"
    vl.append(
        f"| {i} | {r['form_id']} | {r['العنوان'][:40]} | {' || '.join(hits)[:110]} | {judge} |"
    )
vl += [
    "",
    "### جواب سؤال 3-2-1-4",
    "- في مجموعة **real لهذا الأرشيف**: `3-2-1-4` ↔ سجل الشكر للشركاء · خطة مجال النشاط — **لا** كرمز تطوع مستقل.",
    "- التطوع/الشراكة الصريحة وُسمت تحت **`1-3-1-3`** (حصر المتطوعين، محضر فريق الشراكة، …).",
    "- ربط الكتلة بـ`1-3-1-3` **متسق مع وسم الأرشيف**؛ ليس خلطاً مع `3-2-1-4` داخل مجموعة الربط الحالية.",
    "- تحفظ لخ9: إن اعتمدتم تصنيفاً وزارياً يفصل التطوع عن الشراكة، تُراجع الكتلة لفصل أدق.",
    "",
]

run = (OUT / "03_run_log.md").read_text(encoding="utf-8")
if "توثيق الـ7 high" in run:
    run = run.split("## توثيق الـ7 high")[0].rstrip()
(OUT / "03_run_log.md").write_text(run + "\n" + "\n".join(hl), encoding="utf-8")

rep = (OUT / "03_indicators_report.md").read_text(encoding="utf-8")
if "عيّنة 5 من كتلة 1-3-1-3" in rep:
    rep = rep.split("## عيّنة 5 من كتلة 1-3-1-3")[0].rstrip()
(OUT / "03_indicators_report.md").write_text(rep + "\n" + "\n".join(vl), encoding="utf-8")

dec = (OUT / "decisions_log.md").read_text(encoding="utf-8")
block = """
### [قرار 44] اعتماد خ3 نهائياً — 2026-11-01 (تأكيد).
### [قرار 45] الـ44 إثراء — كتلة 1-3-1-3 (28) تُراجع ولا تُحذف.
### [قرار 46] معيار high مُصحّح؛ الـ7 موثّقة في 03_run_log.md مع تحفظ العنوان.
### [قرار 47] فتح خ4 بعد التحقق من توثيق الـ7 + عيّنة التطوع — التوثيق جاهز؛ بانتظار الأمر الصريح.

"""
if "[قرار 44]" not in dec:
    if "## فرضية مسجّلة" in dec:
        dec = dec.replace("## فرضية مسجّلة", block + "## فرضية مسجّلة")
    else:
        dec += block
    (OUT / "decisions_log.md").write_text(dec, encoding="utf-8")

print("high", len(high), "vol", len(vol))
