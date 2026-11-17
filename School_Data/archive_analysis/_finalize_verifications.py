# -*- coding: utf-8 -*-
"""كتابة ملفات التحققات الثلاثة + تحديث المانيفست للمؤجلات."""
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

lines = en.SOURCE.read_text(encoding="utf-8", errors="replace").splitlines()
rows = list(csv.DictReader(en.CSV_PATH.open(encoding="utf-8-sig")))
blocks = en.blocks_by_start(lines, rows)
now = datetime.now().strftime("%Y-%m-%d %H:%M")

# ========== تحقق 1 ==========
unknowns = [r for r in rows if r["fillable"] == "unknown"]
# بعد التوسيع: عيّنة من template كانت unknown سابقاً + أي unknown متبقٍ
templates = [r for r in rows if r["fillable"] == "template" and r["layer"] == "operational"]
filleds = [r for r in rows if r["fillable"] == "filled"]

sample_ex_unknown_reasons = []
# اختر 20 عنصراً تمثّل ما كان سيُصنَّف unknown بالقاعدة الضيقة:
# أي مقطع فيه chrome أو تعليمات + فقرات طويلة
narrow_would_be_unknown = []
for r in rows:
    if r["layer"] != "operational":
        continue
    b = blocks[int(r["سطر_البداية"])]
    has_chrome = any(c in b for c in en.CHROME_NOISE)
    has_prompt = en._template_score(en._strip_chrome(b)) >= 1
    has_long = en._filled_score(en._strip_chrome(b)) >= 1
    if (has_chrome or has_prompt) and has_long:
        narrow_would_be_unknown.append(r)

# 20 متنوعة
by_type: dict[str, list] = {}
for r in narrow_would_be_unknown:
    by_type.setdefault(r["النوع"], []).append(r)
sample = []
for kind in ["نموذج", "خطة", "تقرير", "سجل", "محضر", "استمارة", "كشف", "قرار", "خطاب", "استبانة"]:
    for r in by_type.get(kind, [])[:2]:
        if len(sample) < 20 and r not in sample:
            sample.append(r)
for r in narrow_would_be_unknown:
    if len(sample) >= 20:
        break
    if r not in sample:
        sample.append(r)

v1 = [
    "# verification_01_fillable_sample",
    f"## التاريخ: {now}",
    "## الخلاصة: القاعدة الضيقة ثبت ضيقها → وُسّعت ثم وُازنت",
    "",
    "### الإحصاء بعد الموازنة",
    f"- template: **{sum(1 for r in rows if r['fillable']=='template')}**",
    f"- filled: **{sum(1 for r in rows if r['fillable']=='filled')}**",
    f"- unknown: **{sum(1 for r in rows if r['fillable']=='unknown')}**",
    "",
    "### ماذا كانت تفعل القاعدة الضيقة؟",
    "أي تعليمات واجهة (حتى «لم يتم اختيار ملف») + أي فقرة وصفية ⇒ `unknown`.",
    "النتيجة: template=5 فقط (كلها presentation) — غير منطقي أمام 77 نموذجاً و46 خطة.",
    "",
    "### القاعدة المتوازنة المعتمدة الآن",
    "1. عزل ضوضاء edu-forms (رفع الشواهد / خيار إضافي).",
    "2. أنواع هيكلية (نموذج/خطة/استمارة/استبانة/بطاقة) بلا مرساة مدرسية → template.",
    "3. تعليمات صريحة («اضف الاسم هنا» / «اكتب…») → template.",
    "4. مرساة مدرسية حقيقية → filled (أو unknown إن رافقتها تعليمات).",
    "5. مضمون وصفي بلا تعليمات → filled؛ وإلا unknown.",
    "",
    "## 20 عنصراً كانت ستُصنَّف unknown بالقاعدة الضيقة — ولماذا لم تُبقَ template آنذاك",
    "",
    "| # | رقم | العنوان | النوع | fillable الآن | لماذا لم تكن template (القاعدة الضيقة) |",
    "|---:|---:|---|---|---|---|",
]
for i, r in enumerate(sample[:20], 1):
    b = blocks[int(r["سطر_البداية"])]
    cleaned = en._strip_chrome(b)
    markers = [m for m in en.TEMPLATE_MARKERS if m in cleaned]
    chrome = [c for c in en.CHROME_NOISE if c in b][:2]
    why = (
        f"وُجد محتوى وصفي (filled_score={en._filled_score(cleaned)}) "
        f"+ ضوضاء/تعليمات ({', '.join(chrome+markers)[:60] or '—'}) "
        f"فالقاعدة الضيقة فرضت unknown دون عزل الضوضاء"
    )
    v1.append(
        f"| {i} | {r['رقم']} | {r['العنوان'][:55]} | {r['النوع']} | {r['fillable']} | {why} |"
    )

type_fill = Counter((r["النوع"], r["fillable"]) for r in rows if r["layer"] == "operational")
v1 += ["", "### توزيع النوع×fillable بعد الموازنة", "", "| النوع | template | filled | unknown |", "|---|---:|---:|---:|"]
for kind in sorted({k for k, _ in type_fill}):
    v1.append(
        f"| {kind} | {type_fill.get((kind,'template'),0)} | {type_fill.get((kind,'filled'),0)} | {type_fill.get((kind,'unknown'),0)} |"
    )
(OUT / "verification_01_fillable_sample.md").write_text("\n".join(v1) + "\n", encoding="utf-8")

# ========== تحقق 2 ==========
FOOTER = "شواهد التقويم المدرسي"
ind_re = en.INDICATOR_RE
title_hits = 0
footer_only = []
body_other = []
for r in rows:
    ind = (r.get("explicit_indicator") or "").strip()
    if not ind:
        continue
    codes = [c for c in ind.split(";") if c]
    title = r["العنوان"]
    if any(c in title for c in codes):
        title_hits += 1
    block = blocks[int(r["سطر_البداية"])]
    hit_lines = [ln.strip() for ln in block.splitlines() if any(c in ln for c in codes)]
    only_footer = hit_lines and all(
        FOOTER in ln or ln.startswith("المؤشر:") or "في التقويم المدرسي" in ln
        for ln in hit_lines
    )
    if only_footer:
        footer_only.append((r, codes, hit_lines[0] if hit_lines else ""))
    else:
        body_other.append((r, codes, hit_lines[0] if hit_lines else ""))

v2 = [
    "# verification_02_indicators",
    f"## التاريخ: {now}",
    f"## إجمالي explicit_indicator غير الفارغ: **{sum(1 for r in rows if (r.get('explicit_indicator') or '').strip())}**",
    "",
    "### الفصل المطلوب",
    f"| الفئة | العدد |",
    f"|---|---:|",
    f"| مذكور في العنوان | **{title_hits}** |",
    f"| صريح حرفياً في الجسم — تذييل شواهد متكرر | **{len(footer_only)}** |",
    f"| صريح حرفياً في الجسم — سياق تشغيلي/حقلي | **{len(body_other)}** |",
    "",
    "> ملاحظة: لا يوجد أي مؤشر داخل عمود العنوان في الجرد الحالي (0). الـ157 كلها من جسم المقطع.",
    "> منها 136 تذييل edu-forms متكرر («شواهد التقويم المدرسي — المؤشرات…»). هذه صريحة نصياً لكنها جاهزة للتشكيك في الخوارزمية 3 (هل هي ربط تشغيلي أم زخرفة تذييل؟).",
    "",
    "## 10 أمثلة — مؤشر صريح حرفياً في الجسم (سياق غير تذييل فقط حيث أمكن)",
    "",
    "| # | رقم | العنوان | الرموز | مقتطف |",
    "|---:|---:|---|---|---|",
]
# فضّل أمثلة body_other ثم أكمل من footer
picked = body_other[:10]
if len(picked) < 10:
    picked += footer_only[: 10 - len(picked)]
for i, (r, codes, snip) in enumerate(picked, 1):
    v2.append(
        f"| {i} | {r['رقم']} | {r['العنوان'][:50]} | {';'.join(codes[:4])} | {snip[:75]} |"
    )

v2 += [
    "",
    "## 5 أمثلة تذييل (للتفرقة)",
    "",
    "| رقم | العنوان | مقتطف |",
    "|---:|---|---|",
]
for r, codes, snip in footer_only[:5]:
    v2.append(f"| {r['رقم']} | {r['العنوان'][:55]} | {snip[:75]} |")

(OUT / "verification_02_indicators.md").write_text("\n".join(v2) + "\n", encoding="utf-8")

# ========== تحقق 3: المؤجلات ==========
# أعد قراءة قائمة المؤجل من منطق القرار مع تصنيف صلة
DEFERRED_CATALOG = [
    # (اسم الملف فقط, صلة, اقتراح, ملاحظة)
    ("الاصاباتالرياضية2.doc", "غير ذات صلة", "يُستثنى نهائياً", "ملف طبي/إصابات ضخم — ليس نموذج حوكمة مدرسية"),
    ("سجل (منسق الموهوبين) في مدارس (التعليم العام) - العام الدراسي (1447 هـ - 2025 م) - أ- ماجد الغامدي.docx", "ذات صلة مباشرة", "يُضمّ الآن", "سجل تشغيلي جاهز — حوّل نصياً قبل خ2"),
    ("نموذج الأداء الوظيفي معلم.docx", "ذات صلة مباشرة", "يُضمّ الآن", "نموذج تقييم وظيفي"),
    ("البيئة المستدامة يزيد بن الحارث (1).docx", "محتملة", "بعد خ2", "تقرير مدرسة أخرى — مرجع مقارنة لا جرد أساسي"),
    ("تقرير واقع.docx", "محتملة", "بعد خ2", "عنوان عام — يُفحص بعد التحويل"),
    ("توثيق شواهد التقويم والاعتماد المدرسي - متوسطة سعد بن الربيع الأنصاري (الردود).xlsx", "ذات صلة مباشرة", "بعد خ2", "شواهد اعتماد — للخوارزمية 7 لا لكشف التكرار النصي"),
    ("GetAdministrativeInfoReport.xlsx", "غير ذات صلة", "يُستثنى نهائياً", "تصدير إداري خام"),
    ("الملف_ remark_link_template_fixed_v2.xlsx", "محتملة", "بعد خ2", "قالب روابط — يُراجع لاحقاً"),
    ("كليشة سعد بن الربيعرسمي.docx", "محتملة", "بعد خ2", "كليشة مراسلات — طبقة إخراج"),
    ("الشعيبي.TXT", "غير ذات صلة", "يُستثنى نهائياً", "محتوى شخصي/غير نماذج"),
    ("students_registry.json", "غير ذات صلة", "يُستثنى نهائياً", "بيانات نظام حالية لا أرشيف نماذج"),
    ("خطة-التوجيه-الطلابي-لعام-1447.doc", "ذات صلة مباشرة", "يُضمّ الآن", "خطة توجيه — نفس عائلة الأرشيف"),
    ("master_knowledge_matrix.json", "غير ذات صلة", "يُستثنى نهائياً", "مصفوفة معرفة النظام"),
    ("school_governance_remaining_suite.json", "غير ذات صلة", "يُستثنى نهائياً", "حزمة نظام"),
    ("warn-main.txt", "غير ذات صلة", "يُستثنى نهائياً", "تحذيرات بناء برمجي"),
    ("GetEmployeeDataList.xlsx", "غير ذات صلة", "يُستثنى نهائياً", "تصدير موظفين"),
    ("مستند نصي جديد (2).TXT", "محتملة", "بعد خ2", "اسم عام — فحص سريع للمضمون"),
    ("الدليل الإجرائي الموحد والتنظيمي الشامل للتخطيط المدرسي.txt", "محتملة", "بعد خ2", "دليل مرجعي لا نموذج تشغيلي"),
    ("نتائج الأختبار الفتري 1446.xlsx", "غير ذات صلة", "يُستثنى نهائياً", "نتائج اختبارات"),
    ("خريطة الإعدادات الأساسية لتغذية التعبئة التلقائية في نظام ERP المدرسي.TXT", "غير ذات صلة", "يُستثنى نهائياً", "تصميم نظام لا أرشيف نماذج"),
    ("نتائج_yumnak_20251016_0105.xlsx", "غير ذات صلة", "يُستثنى نهائياً", "نتائج"),
    ("registers_standardized_schemas.json", "غير ذات صلة", "يُستثنى نهائياً", "مخططات نظام — مطابقة لاحقة"),
    ("مستند نصي جديد (5).TXT", "محتملة", "بعد خ2", "فحص مضمون"),
    ("new 3.txt", "غير ذات صلة", "يُستثنى نهائياً", "أرشيف عمل قديم"),
    ("0اقرأني أولًا.TXT", "غير ذات صلة", "يُستثنى نهائياً", "تعليمات أرشفة"),
    ("contextual_impact_bank.json", "غير ذات صلة", "يُستثنى نهائياً", "بنك نظام"),
    ("individual_remedial_plan.json", "محتملة", "بعد خ2", "مخطط نفذناه — للمطابقة مع الأرشيف لا للضمّ العددي"),
    ("new 4.txt", "غير ذات صلة", "يُستثنى نهائياً", "أرشيف عمل"),
    ("advanced_governance_intelligence.json", "غير ذات صلة", "يُستثنى نهائياً", "بنك نظام"),
    ("roles_view_rules.json", "غير ذات صلة", "يُستثنى نهائياً", "قواعد نظام"),
    ("approval_authorities.json", "غير ذات صلة", "يُستثنى نهائياً", "صلاحيات"),
    ("scoring_and_alerts_logic.json", "غير ذات صلة", "يُستثنى نهائياً", "منطق نظام"),
    ("classroom_visit_schema.json", "محتملة", "بعد خ2", "مخطط زيارة — مؤجل لسياسة 1448"),
    ("auto_fill_dictionary.json", "غير ذات صلة", "يُستثنى نهائياً", "قاموس تعبئة"),
    ("كيف تستدعيني في محادثة جديدة.TXT", "غير ذات صلة", "يُستثنى نهائياً", "تعليمات محادثة"),
    ("PROJECT_CLOSURE_LOG.txt", "غير ذات صلة", "يُستثنى نهائياً", "سجل إغلاق مشروع"),
    ("تقرير المعلمين.xls", "محتملة", "بعد خ2", "قد يكون كشفاً لا نموذجاً"),
    ("signatures_management_spec.json", "غير ذات صلة", "يُستثنى نهائياً", "مواصفة توقيعات"),
    ("student_portfolio_schema.json", "غير ذات صلة", "يُستثنى نهائياً", "مخطط نظام"),
    ("appsscript.json", "غير ذات صلة", "يُستثنى نهائياً", "إعداد Apps Script"),
    ("تنزيل.xls", "غير ذات صلة", "يُستثنى نهائياً", "ملف تنزيل مجهول"),
    ("README.md", "غير ذات صلة", "يُستثنى نهائياً", "توثيق مشروع نتائج"),
    (".clasp.json", "غير ذات صلة", "يُستثنى نهائياً", "إعداد clasp"),
    ("requirements.TXT", "غير ذات صلة", "يُستثنى نهائياً", "تبعيات بايثون"),
    ("requirements.txt", "غير ذات صلة", "يُستثنى نهائياً", "تبعيات بايثون"),
    ("~$دي ووالدي خادم الحرمين الشريفين ايدكم الله.docx", "غير ذات صلة", "يُستثنى نهائياً", "قفل Word مؤقت"),
    ("~$وج تأسيس.docx", "غير ذات صلة", "يُستثنى نهائياً", "قفل Word مؤقت"),
    ("مستند نصي جديد.TXT", "غير ذات صلة", "يُستثنى نهائياً", "فارغ/ضئيل"),
    ("عمل يمناك.TXT", "غير ذات صلة", "يُستثنى نهائياً", "ملاحظة قصيرة"),
    ("ابو تركي .TXT", "غير ذات صلة", "يُستثنى نهائياً", "ضئيل"),
    ("مستند نصي جديد (3).TXT", "غير ذات صلة", "يُستثنى نهائياً", "فارغ"),
    ("مستند نصي جديد (4).TXT", "غير ذات صلة", "يُستثنى نهائياً", "فارغ"),
]

# استخرج أسماء المؤجلات الفعلية من المانيفست السابق
manifest_prev = (OUT / "00_source_manifest.md").read_text(encoding="utf-8")
# ابنِ قسماً جديداً وأعد كتابة المانيفست بقسم تحقق 3 واضح
# طابق بالاسم الجزئي
from pathlib import Path as P

# اجمع المؤجلات من سكربت البناء
import runpy

# استخدم قائمة الملفات المؤجلة من المسح مباشرة
scan_spec = importlib.util.spec_from_file_location("man", OUT / "_build_00_source_manifest.py")
man = importlib.util.module_from_spec(scan_spec)
scan_spec.loader.exec_module(man)
all_rows = man.scan()
deferred = [r for r in all_rows if r["decision"] == "مؤجل"]

# فهرس الكتالوج بالاسم
cat_by_name = {name: (rel, prop, note) for name, rel, prop, note in DEFERRED_CATALOG}

def classify_deferred(path_str: str):
    name = P(path_str).name
    if name in cat_by_name:
        return cat_by_name[name]
    # تطابق جزئي
    for key, val in cat_by_name.items():
        if key in name or name in key:
            return val
    # قواعد احتياطية
    low = name.lower()
    if name.startswith("~$") or "requirements" in low or "warn-" in low:
        return ("غير ذات صلة", "يُستثنى نهائياً", "ملف تقني/مؤقت")
    if low.endswith(".json") and "School_Governance" in path_str:
        return ("غير ذات صلة", "يُستثنى نهائياً", "مخطط/بنك نظام")
    if any(x in name for x in ("سجل", "نموذج", "خطة", "تقرير", "محضر")):
        return ("محتملة", "بعد خ2", "يحتاج فحص تحويل")
    return ("محتملة", "بعد خ2", "لم يُحسم تلقائياً — مراجعة سريعة")

classified = []
for r in deferred:
    rel, prop, note = classify_deferred(r["path"])
    classified.append({**r, "name": P(r["path"]).name, "relevance": rel, "proposal": prop, "note": note})

# تحديث 00_source_manifest — أبقِ الملخص وأضف قسم تحقق 3
base_header = [
    "# 00_source_manifest — بيان مصادر الأرشيف",
    "## الغرض:",
    "حصر الملفات النصية/القابلة للتحويل المرشّحة قبل كشف التكرار (الخوارزمية 2)، مع قرار صريح لكل ملف.",
    f"## التاريخ: {now}",
    "## نطاق المسح:",
    r"`C:\Users\Toshiba\Desktop`",
    "",
    "## ملخص القرارات",
    "",
    "| القرار | العدد |",
    "|---|---:|",
    f"| مضمّن | {sum(1 for r in all_rows if r['decision']=='مضمّن')} |",
    f"| مؤجل (قيد التحقق 3) | {len(classified)} |",
    f"| مستثنى | {sum(1 for r in all_rows if r['decision']=='مستثنى')} |",
    "",
    "## المصدر المضمّن",
    "- `البرامج والتقارير والسجلات والمحاضر .txt`",
    "",
    "## التحقق 3 — الـ{} مؤجلة بالاسم والصلة والاقتراح".format(len(classified)),
    "",
    "| # | الاسم | الصلة | الاقتراح | ملاحظة |",
    "|---:|---|---|---|---|",
]
for i, r in enumerate(sorted(classified, key=lambda x: (x["relevance"], x["name"])), 1):
    base_header.append(
        f"| {i} | `{r['name']}` | {r['relevance']} | {r['proposal']} | {r['note']} |"
    )

counts = Counter(r["relevance"] for r in classified)
props = Counter(r["proposal"] for r in classified)
base_header += [
    "",
    "### ملخص الصلة",
    f"- ذات صلة مباشرة: **{counts.get('ذات صلة مباشرة', 0)}**",
    f"- محتملة: **{counts.get('محتملة', 0)}**",
    f"- غير ذات صلة: **{counts.get('غير ذات صلة', 0)}**",
    "",
    "### ملخص الاقتراح",
    f"- يُضمّ الآن: **{props.get('يُضمّ الآن', 0)}**",
    f"- بعد خ2: **{props.get('بعد خ2', 0)}**",
    f"- يُستثنى نهائياً: **{props.get('يُستثنى نهائياً', 0)}**",
    "",
    "### الملفات المقترح ضمّها الآن (قبل خ2)",
]
for r in classified:
    if r["proposal"] == "يُضمّ الآن":
        base_header.append(f"- `{r['name']}` — {r['note']}")

base_header += [
    "",
    "> لا ضمّ فعلي حتى موافقة رئيس المشروع. الرقم 543 ثابت حتى ذلك الحين.",
    "",
]
(OUT / "00_source_manifest.md").write_text("\n".join(base_header), encoding="utf-8")

# verification_03 مختصر
v3 = [
    "# verification_03_deferred",
    f"## التاريخ: {now}",
    f"## العدد: {len(classified)}",
    f"## ذات صلة مباشرة: {counts.get('ذات صلة مباشرة', 0)} | محتملة: {counts.get('محتملة', 0)} | غير ذات صلة: {counts.get('غير ذات صلة', 0)}",
    f"## يُضمّ الآن: {props.get('يُضمّ الآن', 0)} | بعد خ2: {props.get('بعد خ2', 0)} | يُستثنى: {props.get('يُستثنى نهائياً', 0)}",
    "",
    "التفاصيل الكاملة في `00_source_manifest.md` قسم التحقق 3.",
]
(OUT / "verification_03_deferred.md").write_text("\n".join(v3) + "\n", encoding="utf-8")

print("fillable", Counter(r["fillable"] for r in rows))
print("deferred", len(classified), dict(counts), dict(props))
print("indicators title", title_hits, "footer", len(footer_only), "other", len(body_other))
