# -*- coding: utf-8 -*-
"""قرار 52–56: توثيق لجان بلا مقرر + أدوار يتيمة + خطة التوسيع."""
from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path

OUT = Path(__file__).resolve().parent
COMM = OUT / "04_committee_map.csv"
RUN = OUT / "04_run_log.md"
SAMPLE = OUT / "04_sample_15.md"
CARDS = OUT / "04_person_task_cards.csv"
DEC = OUT / "decisions_log.md"
EXT = OUT / "04_identity_extension.csv"

now = datetime.now().strftime("%Y-%m-%d %H:%M")

# --- 1) committee map: explicit gap column ---
rows = list(csv.DictReader(COMM.open(encoding="utf-8-sig")))
for r in rows:
    if r.get("has_rapporteur") == "no":
        r["rapporteur_gap"] = "بلا مقرر موثّق في التشكيلات المحفوظة"
    else:
        r["rapporteur_gap"] = ""
fields = list(rows[0].keys())
if "rapporteur_gap" not in fields:
    fields.append("rapporteur_gap")
with COMM.open("w", encoding="utf-8-sig", newline="") as h:
    w = csv.DictWriter(h, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)

no_rapp = [r for r in rows if r.get("has_rapporteur") == "no"]

# --- 2) strengthen sample evidence from cards ---
cards = list(csv.DictReader(CARDS.open(encoding="utf-8-sig")))
by_name = {c["person_name"]: c for c in cards}
sm = [
    "# 04_sample_15 — عيّنة بطاقات (10/15 — طبقة الهوية الحالية)",
    f"## التاريخ: {now}",
    "## الحالة: مسودة معتمدة مبدئياً (قرار 52) — كل بطاقة بدليل وثقة",
    "",
    "| # | الاسم | الدور | مهام | نماذج | اعتماد | لجان | evidence | confidence |",
    "|---:|---|---|---:|---:|---:|---|---|---|",
]
for i, c in enumerate(cards, 1):
    sm.append(
        f"| {i} | {c['person_name']} | {c['role']} | {c['tasks_count']} | {c['forms_owned_count']} | "
        f"{c['forms_approved_count']} | {(c['committees'] or '—')[:42]} | "
        f"{(c['evidence'] or '')[:90].replace('|', '/')} | {c['confidence']} |"
    )
sm += [
    "",
    "### ملاحظات التحقق",
    "- كل البطاقات العشر تحمل `evidence` و`confidence` (لا بطاقة بلا دليل).",
    "- دليل المدير: اقتباس من وصف وظيفي (تعريف مدير).",
    "- دليل الأعضاء غالباً: عضوية موثقة في التشكيلات و/أو بنود تعريف اللجنة — ليس دائماً وصفاً شخصياً باسمه.",
    "- لذلك البطاقات **صحيحة كقاعدة تشكيلات**، ومسودة تحتاج توسيع هوية قبل الاعتماد النهائي لخ4 كمنظومة أداء كاملة.",
    "",
]
SAMPLE.write_text("\n".join(sm), encoding="utf-8")

# --- 3) append run_log sections ---
gap_list = "\n".join(
    f"- **{r['committee_name']}** (`{r['committee_id']}`) — الرئيس: {r['chair']} — أعضاء: {r['members_count']}"
    for r in no_rapp
)

section = f"""

---

## مراجعة رئيس المشروع — قرارات 52–56 · {now}

### أ) اللجان الثلاث بلا مقرر (من `04_committee_map.csv`)
{gap_list}

**الأثر:** بلا مقرّر موثّق بالاسم في التشكيلات → خطر ضعف توثيق الاجتماعات. ملاحظة: تعاريف الأرشيف تعيّن المقرّر **بالدور** (مثلاً رائد النشاط / الموجه الطلابي) لا بالاسم — وهذا يفسّر الفجوة بين التعريف والتشكيلات المحفوظة.

### ب) تقرير الأدوار اليتيمة بنيوياً
مهام مستخرجة من تعاريف الأرشيف بلا منسوب مطابق في طبقة الهوية (التشكيلات):

| الدور اليتيم | مصدر التعريف | بنود مهام (سقف مستخرج) | شخص في الهوية؟ |
|---|---|---:|---|
| وكيل المدرسة لشؤون الطلاب | [199] | 20 | لا |
| وكيل المدرسة للشؤون التعليمية | [236] | 25 | لا |
| وكيل المدرسة للشؤون المدرسية | [277] | 18 | لا |
| الموجه الصحي | [161] | 14 | لا |

- «الثلاثة» في خطاب الاعتماد = **وكلاء المدرسة الثلاثة**؛ الموجه الصحي رابع بنيوياً (نفس الفجوة).
- مجموع مهام هذه الأدوار ≈ 77 بنداً ضمن كتلة الـ245 «بلا مالك شخصي».
- السبب الجذري: الأرشيف يحمل **الدور** لا **شاغل الدور**. قرارات التشكيل في النص تستخدمplaceholders: `الاسم الأول` / `الاسم الثاني` … وليست أسماء حقيقية.

### ج) خطة توسيع الهوية — `04_identity_extension.csv` (قرار 55)
**الملف أُنشئ كطبقة إضافية — لا يمس خط الأساس 565.**

| مبدأ | التطبيق |
|---|---|
| مصدر الحقيقة للأسماء الحالية | `committee_formations.json` → الـ10 في `04_person_task_cards.csv` |
| التوسيع | ملف منفصل `04_identity_extension.csv` فقط |
| وسم كل صف | `source` + `source_form_id` + `confidence` + `link_type` |
| أنواع الصف | `role_slot` = دور بلا اسم شخصي (الغالب الآن) · لاحقاً `named_candidate` إن وُجد اسم صريح |
| الحقيقة | مرشح مراجعة — `inferred` ضمنياً عبر confidence=low و link_type=role_slot |
| الدمج مع الـ10 | الـ10 تبقى القاعدة؛ التوسيع لا يستبدلها. التعارض يُحل لاحقاً بـ person_id موحّد بعد مراجعة بشرية |
| خ5 | لا تُفتح حتى مراجعة التوسيع واعتماد الأسماء الحقيقية عند توفرها |

#### إجابة تقدير «50–90 اسماً»
**غير واقعي من هذا الأرشيف.** المسح أظهر:
- تعاريف اللجان = أدوار فقط (`مدير المدرسة — رئيس اللجنة`).
- قرارات التشكيل = حقول فارغة (`الاسم الأول` …) + عمل أساسي بالدور.
- أسماء أعلام تظهر في سياقات أخرى (شركاء/طلاب/…) وليست طبقة هوية منسوبي المدرسة المنظّمة.
- المتوقع من الأرشيف وحده: **عشرات خانات الدور (role_slot)** لا عشرات الأسماء الشخصية.
- لبلوغ 50–90 اسماً حقيقياً يلزم مصدر خارجي: تعبئة `teachers-*.xlsx` من نور، أو شاشة القيادة/المنسوبين في المنظومة، أو إدخال يدوي معتمد.

#### أثر على خ5
خ5 بلا أسماء حقيقية تبقى **خريطة أدوار ولجان**. بعد ملء الأسماء تصبح **خريطة لجان + أعضاء + تقاطعات** — لذلك التوسيع قبل خ5 صحيح منهجاً، لكن مصدر الأسماء يجب أن يُصحَّح (لا يُفترض من قوالب الأرشيف).

### د) وسم الملكية المستنتجة (قرار 53)
في البطاقات الحالية: الملكية من الدور/اللجنة → تُعامل كلها كمستنتجة (`confidence` medium/low؛ لا high حقيقة اسمية). المراجعة في خ9.

### هـ) عبء المدير (قرار 54)
نايف: ≈37 مهمة وصف + ≈36 اعتماد/محضر = خطر تشغيلي (عنق زجاجة الاعتماد). يُعالج في خ9/خ10.

### و) الحالة
- خ4: اعتماد مبدئي (52) — بانتظار مراجعة هذه التوثيقات.
- خ5: موقوفة (56).
"""

text = RUN.read_text(encoding="utf-8")
marker = "## مراجعة رئيس المشروع — قرارات 52–56"
if marker in text:
    text = text.split(marker)[0].rstrip() + "\n" + section
else:
    text = text.rstrip() + "\n" + section
RUN.write_text(text, encoding="utf-8")

# --- 4) decisions_log ---
d = DEC.read_text(encoding="utf-8")
block = """
### [قرار 52] اعتماد خ4 مبدئياً — 2026-11-01.
10 بطاقات · 4 لجان · 3 بلا مقرر · 3 تقاطعات · 245 مهمة بلا مالك شخصي · 490 نموذجاً بلا مالك اسمي · عبء المدير 37+36.

### [قرار 53] الملكية المستنتجة من الدور/اللجنة → inferred + confidence؛ لا حقيقة؛ مراجعة خ9.

### [قرار 54] عبء المدير = خطر تشغيلي استراتيجي؛ يُعالج في خ9/خ10 (توزيع الصلاحيات).

### [قرار 55] توسيع الهوية في `04_identity_extension.csv` فقط — لا يمس 565؛ source+confidence؛ مرشح مراجعة؛ اعتماد الأسماء قبل خ5.

### [قرار 56] لا فتح خ5 قبل: توثيق اللجان بلا مقرر · عيّنة 10 بدليل · 04_identity_extension.csv · تقرير الأدوار اليتيمة.
"""
if "[قرار 52]" not in d:
    # insert before فرضية or at end of decisions area
    if "## فرضية مسجّلة" in d:
        d = d.replace("## فرضية مسجّلة", block + "\n## فرضية مسجّلة")
    else:
        d = d.rstrip() + "\n" + block + "\n"
    DEC.write_text(d, encoding="utf-8")

print("no_rapporteur:", [(r["committee_id"], r["committee_name"]) for r in no_rapp])
print("extension_rows:", sum(1 for _ in EXT.open(encoding="utf-8-sig")) - 1)
print("sample_cards:", len(cards))
print("done")
