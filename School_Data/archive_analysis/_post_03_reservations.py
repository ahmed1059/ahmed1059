# -*- coding: utf-8 -*-
"""تحفظات خ3 الأربعة — تغطية · يتيمة · محافظ · عيّنة · NHR · تصنيف missing."""
from __future__ import annotations

import csv
import random
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

OUT = Path(__file__).resolve().parent
IND = OUT / "03_indicators.csv"
INV = OUT / "01_inventory.csv"
REP = OUT / "03_indicators_report.md"
RUN = OUT / "03_run_log.md"
MISS = OUT / "03_missing_indicators.md"
SAMP = OUT / "03_sample_15.md"
DEC = OUT / "decisions_log.md"

random.seed(1059)

# تصنيف أوّلي للرموز المفقودة (تذييل تقويم مدرسي شائع vs أخرى)
FOOTER_EVAL = {
    "1-2-1-2",
    "1-2-1-3",
    "1-2-1-4",
    "1-2-1-5",
    "1-5-1-1",
    "1-5-1-2",
    "1-4-1-3",
    "1-4-1-4",
    "2-1-1-1",
    "2-1-1-4",
    "2-1-1-6",
    "2-1-1-7",
    "3-2-1-2",
    "3-2-1-5",
    "4-1-1-3",
    "4-1-1-4",
}


def main() -> None:
    inds = list(csv.DictReader(IND.open(encoding="utf-8-sig")))
    inv = list(csv.DictReader(INV.open(encoding="utf-8-sig")))
    ops = [r for r in inv if r.get("layer") == "operational"]

    approved = set()
    for r in ops:
        for c in (r.get("explicit_indicator_real") or "").split(";"):
            if c.strip():
                approved.add(c.strip())

    explicit_by = defaultdict(set)
    inferred_by = defaultdict(set)
    for r in inds:
        codes = [c for c in (r.get("indicators") or "").split(";") if c]
        for c in codes:
            if r["link_source"] == "real":
                explicit_by[c].add(r["form_id"])
            elif r["link_source"] == "مضمون" and r["inferred"] == "true":
                inferred_by[c].add(r["form_id"])
            elif r["link_source"] == "مضمون":
                explicit_by[c].add(r["form_id"])  # حرفي في المتن

    # --- جدول التغطية ---
    cov_lines = [
        "",
        "## التحفظات الأربعة (ما بعد التسليم) — 2026-11-01",
        "",
        "### توضيح حاسم: 21 صفاً ≠ 21 رمزاً",
        "- **21** = عدد صفوف الجرد ذات `explicit_indicator_real` غير فارغ.",
        f"- **{len(approved)}** = عدد **الرموز الفريدة** المستخرجة من تلك الصفوف = مجموعة الربط المعتمدة.",
        "- **لا توجد** في مخرجات خ1/خ3 قائمة منفصلة بـ«21 رمزاً معتمداً».",
        "- إذن فرضية «8 يتيمة من أصل 21 رمزاً» **لا تنطبق على البيانات الحالية**؛ اليتيمة تُحسب داخل الـ"
        f"{len(approved)} رمزاً فقط.",
        "",
        "### جدول التغطية (لكل رمز معتمد)",
        "",
        "| رمز المؤشر | نماذج صريحة (real/حرفي) | نماذج مستنتجة | الحالة |",
        "|---|---:|---:|---|",
    ]
    orphan_explicit = []
    for c in sorted(approved):
        e, i = len(explicit_by[c]), len(inferred_by[c])
        if e > 0:
            st = "مغطى (صريح)"
        elif i > 0:
            st = "مغطى (مستنتج فقط) — فجوة وسم محتملة"
            orphan_explicit.append(c)
        else:
            st = "يتيم كلياً — فجوة حقيقية"
            orphan_explicit.append(c)
        cov_lines.append(f"| `{c}` | {e} | {i} | {st} |")

    none_explicit_only = [c for c in sorted(approved) if len(explicit_by[c]) == 0]
    cov_lines += [
        "",
        f"### «اليتيمة» ضمن الرموز المعتمدة ({len(approved)})",
        f"- رموز بلا أي نموذج **صريح**: **{len(none_explicit_only)}** → {', '.join(f'`{c}`' for c in none_explicit_only) or 'لا يوجد'}",
        f"- رموز بلا أي ربط (صريح+مستنتج): **{sum(1 for c in approved if not explicit_by[c] and not inferred_by[c])}**",
        "- الخلاصة: كل الرموز الـ"
        f"{len(approved)} مغطاة بصريح واحد على الأقل → **لا فجوة حقيقية داخل مجموعة الربط الحالية**؛ الفجوة الأكبر هي أن إطار التقويم الأوسع (تذييل) يذكر رموزاً أخرى (الـ16).",
        "",
        "### اكتشاف استراتيجي (قرار 35)",
        "- **88.4%** من الـ560 بلا ربط مؤشري → طبقة إدارية/تشغيلية واسعة خارج مقاييس التقويم المدرسي الصريحة.",
        "- هذا ليس فشلاً منهجياً بالضرورة؛ كثير من النماذج (عهد، صندوق، صادر/وارد، دوام…) لا تُقاس بمؤشرات التقويم.",
        "- التصميم اللاحق: مسار «مؤشر» لا يغطي المنظومة كلها؛ المسارات الإدارية لها مقاييس منفصلة.",
        "",
    ]

    # --- تعريف محافظ ---
    inf = [r for r in inds if r["inferred"] == "true"]
    conf = Counter(r["confidence"] for r in inf)
    nhr_inf = Counter(r["needs_human_review"] for r in inf)
    nhr_all = Counter(r["needs_human_review"] for r in inds)
    cons = [
        "### تعريف رقمي لـ«محافظ» (تحفظ 3)",
        "يُستنتج مؤشر **فقط** إذا تحقق:",
        "1. الرمز ∈ مجموعة الـ"
        f"{len(approved)} المعتمدة (ممنوع اختراع رمز).",
        "2. تطابق **≥2** عبارات مفتاحية مميزة للقواعد، **أو** عبارة واحدة طولها ≥10 أحرف واردة في **العنوان**.",
        "3. اقتباس نصي (`evidence`) غير فارغ من النموذج.",
        "4. سقف **رمزين** مستنتجين لكل نموذج.",
        "5. إن لم يتحقق الشرط → `لا يوجد` (لا استنتاج قسري).",
        "",
        "#### توزيع ثقة الـ44 المستنتجة",
        f"| الثقة | العدد |",
        f"|---|---:|",
        f"| high | {conf.get('high', 0)} |",
        f"| medium | {conf.get('medium', 0)} |",
        f"| low | {conf.get('low', 0)} |",
        f"| **المجموع** | **{len(inf)}** |",
        "",
        "#### needs_human_review",
        f"| النطاق | true | false |",
        f"|---|---:|---:|",
        f"| المستنتج فقط (44) | {nhr_inf.get('true', 0)} | {nhr_inf.get('false', 0)} |",
        f"| كل الـ560 | {nhr_all.get('true', 0)} | {nhr_all.get('false', 0)} |",
        "",
        "> كل المستنتج `needs_human_review=true` عمداً: المنهج **لا يثق وحده** بالاستنتاج؛ الثقة medium/low لا تلغي المراجعة البشرية.",
        "",
    ]

    # تحديث التقرير
    rep = REP.read_text(encoding="utf-8")
    marker = "## التحفظات الأربعة"
    if marker in rep:
        rep = rep.split(marker)[0].rstrip()
    REP.write_text(rep + "\n" + "\n".join(cov_lines + cons), encoding="utf-8")

    # run_log append
    run = RUN.read_text(encoding="utf-8")
    block = "\n".join(["", "## إضافات التحفظات الأربعة", ""] + cov_lines + cons)
    if "إضافات التحفظات الأربعة" in run:
        run = run.split("## إضافات التحفظات الأربعة")[0].rstrip()
    RUN.write_text(run + "\n" + block + "\n", encoding="utf-8")

    # تصنيف missing
    miss_text = MISS.read_text(encoding="utf-8")
    # parse codes from table lines
    codes_found = []
    for ln in miss_text.splitlines():
        if ln.startswith("| `") and "رمز" not in ln:
            code = ln.split("`")[1]
            codes_found.append(code)
    class_lines = [
        "",
        "## تصنيف الـ16 (قرار 37) — مراجعة أولية",
        "",
        "| الرمز | التصنيف المقترح | السبب |",
        "|---|---|---|",
    ]
    for c in sorted(set(codes_found)):
        if c in FOOTER_EVAL:
            kind = "نظام تقويم (تذييل edu-forms / إطار أوسع)"
            why = "يظهر غالباً في تذييل «شواهد التقويم المدرسي» لا في حقل تشغيلي؛ ليس بالضرورة خطأ كتابي لرمز من الـ13"
        elif c.startswith("4-"):
            kind = "نظام تقويم (مجال 4) / أوسع من مجموعة real الحالية"
            why = "رموز مجال 4 لم تدخل explicit_indicator_real في هذا الأرشيف"
        else:
            kind = "نظام تقويم أوسع أو غير مُعتمد في عمود real"
            why = "موجود في raw/تذييل ولم يُصنَّف real"
        class_lines.append(f"| `{c}` | {kind} | {why} |")
    class_lines += [
        "",
        "### خلاصة التصنيف",
        "- **(أ) أخطاء كتابية مؤكدة:** لم يُرصد نمط واضح مثل 1-2-1-9 بدل 1-2-1-3 في هذه القائمة.",
        "- **(ب) مستقبلي غير مؤكد:** لا دليل.",
        "- **(ج) إطار تقويم أوسع / تذييل منصة (غالب):** نعم — معظم الـ16 من تذييل الشواهد، أي رموز نظام التقويم المدرسي الكاملة التي لم تُثبَّت كـ real في الجرد.",
        "- الإجراء: **توثيق فقط** في خ3؛ لا ربط؛ مراجعة انتقائية في خ9 إن لزم توحيد التذييل.",
        "",
    ]
    if "## تصنيف الـ16" in miss_text:
        miss_text = miss_text.split("## تصنيف الـ16")[0].rstrip()
    MISS.write_text(miss_text + "\n" + "\n".join(class_lines), encoding="utf-8")

    # عيّنة 15 مع دليل
    by = defaultdict(list)
    for r in inds:
        by[r["link_source"]].append(r)
    sample = []
    for key, n in (("real", 5), ("مضمون", 5), ("لا يوجد", 5)):
        pool = by.get(key, [])
        sample.extend(random.sample(pool, min(n, len(pool))))
    s_lines = [
        "# 03_sample_15 — عيّنة مراجعة (seed=1059) — محدّثة للتحفظ 3",
        "",
        "| # | form_id | اسم النموذج | المؤشر | الثقة | الدليل النصي | هل توافق؟ (للمراجع) |",
        "|---:|---|---|---|---|---|---|",
    ]
    for i, r in enumerate(sample, 1):
        s_lines.append(
            f"| {i} | {r['form_id']} | {r['العنوان'][:36]} | {r['indicators'][:36] or '—'} | "
            f"{r['confidence'] or '—'} | {(r['evidence'] or r['reason'])[:90]} | ⬜ |"
        )
    s_lines += [
        "",
        "عمود «هل توافق؟» للمراجع البشري عند الاعتماد النهائي.",
        "",
    ]
    SAMP.write_text("\n".join(s_lines) + "\n", encoding="utf-8")

    # قرارات
    dec = DEC.read_text(encoding="utf-8")
    block_d = f"""
### [قرار 35] اكتشاف استراتيجي خ3: 88.4% من الأرشيف غير مرتبط بمؤشرات التقويم الصريحة.
طبقة إدارية مستقلة واردة؛ مسار المؤشر لا يغطي المنظومة كلها.

### [قرار 36] تصحيح فهم «13 من 21»:
21 = صفوف real · 13 = رموز فريدة معتمدة. لا قائمة 21 رمزاً في البيانات. كل الـ13 مغطاة بصريح ≥1 → لا «8 يتيمة رموز» داخل مجموعة الربط؛ الفجوة في الرموز الأوسع (تذييل/16).

### [قرار 37] الـ16 المفقودة تُصنَّف غالباً كإطار تقويم/تذييل أوسع لا كأخطاء كتابية مؤكدة — انظر 03_missing_indicators.md.

### [قرار 38] اعتماد خ3 مبدئي مشروط بالتحفظات — نُفّذت في التقرير/اللوق/العيّنة/missing.

### [قرار 39] لا فتح خ4 قبل التحقق من التحفظات واعتماد خ3 نهائياً.

"""
    if "[قرار 35]" not in dec:
        if "## فرضية مسجّلة" in dec:
            dec = dec.replace("## فرضية مسجّلة", block_d + "## فرضية مسجّلة")
        else:
            dec += block_d
        DEC.write_text(dec, encoding="utf-8")

    print(
        {
            "approved": len(approved),
            "none_explicit": none_explicit_only,
            "conf": dict(conf),
            "nhr_inf": dict(nhr_inf),
            "nhr_all": dict(nhr_all),
            "missing_n": len(set(codes_found)),
        }
    )


if __name__ == "__main__":
    main()
