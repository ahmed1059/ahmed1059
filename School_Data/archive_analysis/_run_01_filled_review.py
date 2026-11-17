# -*- coding: utf-8 -*-
"""الخطوة 4 — مراجعة عيّنة filled=201 (قرار 79). لا تعديل على 01_inventory.csv."""
from __future__ import annotations

import csv
import random
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

from config import OUTPUT_DIR, get_archive_path

INV = OUTPUT_DIR / "01_inventory.csv"
REPORT = OUTPUT_DIR / "01_filled_review.md"
RUN = OUTPUT_DIR / "01_filled_review_run_log.md"
EXT_DIR = OUTPUT_DIR / "external_sources"

# علامات محتوى قالب فقط — لا واجهة edu-forms العامة (عنوان التقرير*/صف لكل سطر) فهي تظهر مع التعبئة الحقيقية أيضاً
TEMPLATE_MARKERS = [
    "الاسم الأول",
    "الاسم الثاني",
    "الاسم الثالث",
    "الاسم الرابع",
    "الاسم الخامس",
    "الاسم السادس",
    "الاسم السابع",
    "الاسم الثامن",
    "الاسم التاسع",
    "اكتب هنا",
    "أكتب هنا",
    "اضف الاسم هنا",
    "أضف الاسم هنا",
    "لخّص الغاية",
    "اذكر الأهداف",
    "وضح الغاية",
    "ّلم يتمّ اختيار أيّ ملفّ",
    "لم يتم اختيار أي ملف",
    "مقرِّر اللجنة الإدارية / الاسم",
    "مدير المدرسة / اسم المدير",
    "مقرِّر اللجنة / الاسم",
]

# تواريخ قالب شائعة تتكرر كنص افتراضي في edu-forms (ليست دليلاً وحدها)
TEMPLATE_DATES = [
    "١٤٤٨/٠١/١٠",
    "1448/01/10",
    "١٤٤٨/٠٣/١٠",
]

REAL_NAME_HINT = re.compile(
    r"(?:نايف|محمد|فهد|خالد|ماجد|عبد|احمد|أحمد|منور|ياسر|هشام|يوسف|جواد|داود|أنس|سلمان|علي)\s+[\u0600-\u06ff]{2,}"
)
REAL_NUMBER_HINT = re.compile(r"(?:٢٤|٢٥|٣٠|٣|١٢|٧٤|١٠٠|\d{2,})\s*(?:طالب|ساعات|من ١٠٠|حضور|حصة)")


def load_archive_block(r: dict, lines: list[str], starts: list[int], max_lines: int = 70) -> str:
    if (r.get("source") or "archive_txt") != "archive_txt" or not r.get("سطر_البداية"):
        return ""
    start = int(r["سطر_البداية"])
    i = starts.index(start)
    end = starts[i + 1] if i + 1 < len(starts) else len(lines) + 1
    return "\n".join(lines[start - 1 : min(end - 1, start - 1 + max_lines)])


def load_external_snippet(r: dict, max_chars: int = 2800) -> str:
    """قراءة نص external_sources حسب نوع الملف/العنوان."""
    title = (r.get("العنوان") or "").strip()
    if not EXT_DIR.exists():
        return ""
    prefer = []
    if any(k in title for k in ("موهوب", "إثرائ", "تفعيل", "موهبة")):
        prefer.append("موهوب")
    if any(k in title for k in ("أداء", "وظيفي", "تظلم", "ميثاق")):
        prefer.append("أداء")
    if any(k in title for k in ("توجيه", "إرشاد", "خطة-التوجيه", "خطة التوجيه")):
        prefer.append("توجيه")
    files = list(EXT_DIR.glob("*.txt"))
    ordered = []
    for key in prefer:
        ordered.extend([p for p in files if key in p.name])
    ordered.extend([p for p in files if p not in ordered])
    for p in ordered:
        text = p.read_text(encoding="utf-8", errors="replace")
        key = title[:24] if title else ""
        if key and key in text:
            idx = text.find(key)
            return text[max(0, idx) : max(0, idx) + max_chars]
        # عنوان قصير بديل
        for part in re.split(r"\s+", title)[:4]:
            if len(part) >= 4 and part in text:
                idx = text.find(part)
                return f"[file:{p.name}]\n" + text[max(0, idx) : max(0, idx) + max_chars]
    if ordered:
        p = ordered[0]
        return f"[file:{p.name}]\n" + p.read_text(encoding="utf-8", errors="replace")[:max_chars]
    return ""


def classify_text(block: str, title: str) -> tuple[str, str]:
    b = block or ""
    tmpl_hits = [m for m in TEMPLATE_MARKERS if m in b]
    date_tmpl = [d for d in TEMPLATE_DATES if d in b]
    name_hits = REAL_NAME_HINT.findall(b)
    # استبعد أسماء عامة جداً إن ظهرت في سياق قالب فقط
    realish_names = [n for n in name_hits if "هنا" not in n and len(n) >= 8]

    # إشارات تعبئة حقيقية إضافية
    has_specific_program = bool(
        re.search(r"ورشة\s+[\u0600-\u06ff].{3,}|برنامج\s+[\u0600-\u06ff].{3,}", b)
    ) and "عنوان البرنامج" in b
    has_real_date_variety = len(set(re.findall(r"١٤٤٨/\d{2}/\d{2}|1448/\d{2}/\d{2}", b))) >= 2

    score_real = 0
    score_tmpl = 0
    evidence_bits = []

    if tmpl_hits:
        score_tmpl += min(3, len(tmpl_hits))
        evidence_bits.append("قالب:" + "،".join(tmpl_hits[:3]))
    if date_tmpl and not has_real_date_variety:
        score_tmpl += 1
        evidence_bits.append("تاريخ_قالب:" + date_tmpl[0])
    if "الاسم رباعياً" in b or "الاسم الأول" in b:
        score_tmpl += 1
    if realish_names:
        score_real += min(3, len(set(realish_names)))
        evidence_bits.append("أسماء:" + "؛".join(list(dict.fromkeys(realish_names))[:3]))
    if has_specific_program:
        score_real += 1
        evidence_bits.append("برنامج/ورشة محددة")
    if has_real_date_variety:
        score_real += 1
        evidence_bits.append("تواريخ متعددة")
    if re.search(r"٧٤ من ١٠٠|٢٤ طالبا|عدد الحضور\n٢٤|عدد الحضور\r?\n٢٤", b):
        score_real += 1
        evidence_bits.append("أرقام تشغيلية")

    # قرار
    if score_real >= 2 and score_tmpl >= 2:
        cls = "mixed"
    elif score_real >= 2 and score_tmpl <= 1:
        cls = "filled_real"
    elif score_tmpl >= 2 and score_real == 0:
        cls = "filled_template"
    elif score_tmpl >= 1 and score_real >= 1:
        cls = "mixed"
    elif score_real >= 1:
        cls = "filled_real"
    elif score_tmpl >= 1:
        cls = "filled_template"
    else:
        # بلا إشارات قوية — إن وُجدت جداول فارغة/تعليمات → قالب
        if "صف لكل سطر" in b or "عنوان التقرير *" in b:
            cls = "filled_template"
            evidence_bits.append("هيكل edu-forms بدون بيانات اسمية")
        else:
            cls = "mixed"
            evidence_bits.append("إشارات ضعيفة — خليط/غير محسوم")

    ev = " | ".join(evidence_bits) if evidence_bits else f"عنوان:{title[:40]}"
    # اقتباس قصير
    quote = ""
    for ln in b.splitlines():
        s = ln.strip()
        if len(s) >= 8 and not s.startswith("***"):
            quote = s[:90]
            break
    if quote:
        ev = f"«{quote}» · {ev}"
    return cls, ev[:280]


def main() -> None:
    inv = list(csv.DictReader(INV.open(encoding="utf-8-sig")))
    lines = get_archive_path().read_text(encoding="utf-8", errors="replace").splitlines()
    starts = sorted(
        int(r["سطر_البداية"])
        for r in inv
        if r.get("سطر_البداية") and (r.get("source") or "archive_txt") == "archive_txt"
    )

    filled = [r for r in inv if r.get("fillable") == "filled"]
    op = [r for r in filled if (r.get("source") or "") == "archive_txt"]
    ext = [r for r in filled if str(r.get("source") or "").startswith("external")]
    pres = [r for r in inv if r.get("layer") == "presentation"]

    random.seed(1059)
    sample_op = random.sample(sorted(op, key=lambda r: int(r["رقم"])), 15)
    sample_ext = random.sample(sorted(ext, key=lambda r: int(r["رقم"])), min(10, len(ext)))
    # presentation: ليست ضمن الـ201 — ضابطة مقارنة (كلها template في الجرد)
    sample_pres = random.sample(sorted(pres, key=lambda r: int(r["رقم"])), min(5, len(pres)))

    rows_out = []

    def add(r, stratum: str, in_filled: bool):
        if (r.get("source") or "").startswith("external"):
            block = load_external_snippet(r)
            if not block:
                block = (r.get("العنوان") or "") + "\n[تعذر اقتطاع نص external — يُحكم من العنوان/المصدر]"
        elif r.get("layer") == "presentation":
            block = load_archive_block(r, lines, starts, 40)
        else:
            block = load_archive_block(r, lines, starts, 70)
        cls, ev = classify_text(block, r.get("العنوان") or "")
        if r.get("layer") == "presentation":
            # ضابطة: الجرد يصفها template
            cls = "filled_template"
            ev = f"ضابطة presentation · fillable الأصلي={r.get('fillable')} · {ev}"
        rows_out.append(
            {
                "item_id": r["رقم"],
                "item_name": r.get("العنوان") or "",
                "stratum": stratum,
                "in_filled_201": "yes" if in_filled else "no",
                "source": r.get("source") or "",
                "layer": r.get("layer") or "",
                "current_fillable": r.get("fillable") or "",
                "new_classification": cls,
                "evidence": ev,
                "notes": "",
            }
        )

    for r in sample_op:
        add(r, "operational_archive", True)
    for r in sample_ext:
        add(r, "external", True)
    for r in sample_pres:
        add(r, "presentation_control", False)

    # إحصاء على عيّنة الـ201 فقط (25) ثم الكل 30
    from_201 = [x for x in rows_out if x["in_filled_201"] == "yes"]
    ctr201 = Counter(x["new_classification"] for x in from_201)
    ctr_all = Counter(x["new_classification"] for x in rows_out)
    n201 = len(from_201)

    # توصية
    pct_tmpl = 100 * ctr201.get("filled_template", 0) / n201 if n201 else 0
    pct_real = 100 * ctr201.get("filled_real", 0) / n201 if n201 else 0
    pct_mix = 100 * ctr201.get("mixed", 0) / n201 if n201 else 0
    mix_n = ctr201.get("mixed", 0)
    if mix_n > 10:
        recommendation = (
            f"نعم — إعادة تصنيف كل الـ201 (تحفظ 4): mixed={mix_n} من {n201} (>10). "
            "وسم filled في خ1 يخلط بيانات حقيقية ونص قالب؛ يلزم معيار آلي/يدوي يفصل filled_real عن filled_template قبل أي حديث عن «تعبئة المدرسة»."
        )
        expand = "يمكن توسيع العيّنة إلى 50 لتقوية النسبة، لكن عتبة mixed>10 وحدها كافية لفتح إعادة التصنيف."
    elif pct_tmpl >= 70:
        recommendation = (
            "نعم — إعادة تصنيف كل الـ201: غالبية filled_template؛ وسم filled مضلّل غالباً."
        )
        expand = "لا حاجة لتوسيع العيّنة (نتيجة واضحة)."
    elif pct_tmpl > 50:
        recommendation = "مرجح إعادة تصنيف الـ201 بعد تثبيت معيار آلي؛ العيّنة >50% template."
        expand = "اختياري توسيع إلى 50."
    elif max(pct_real, pct_tmpl, pct_mix) < 50:
        recommendation = "النتائج متباينة — توسيع العيّنة إلى 50–60 قبل قرار إعادة تصنيف شامل."
        expand = "توسيع العيّنة مطلوب."
    else:
        recommendation = (
            "لا إعادة تصنيف شاملة فورية؛ راقب الطبقات (archive vs external) كلّاً على حدة."
        )
        expand = "عيّنة كافية مبدئياً."

    # ملاحظات صفوف
    for x in rows_out:
        if x["stratum"] == "presentation_control":
            x["notes"] = "ليست من الـ201؛ ضابطة مقارنة (presentation كلها template في الجرد)."
        elif x["stratum"] == "external":
            x["notes"] = "طبقة ضمّ خارجي — قد تختلف عن قالب الأرشيف النصي."

    md = [
        "# 01_filled_review — مراجعة عيّنة fillable=filled",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "## الحالة: مُسلَّم — قرار 79 · لا تعديل على 01_inventory.csv · لا خ6/خ7",
        "",
        "## سياق الجرد (حقيقة مهمة)",
        f"- إجمالي filled في خ1: **{len(filled)}** (كلها `layer=operational`).",
        f"- منها archive_txt: **{len(op)}** · external: **{len(ext)}**.",
        f"- presentation ضمن filled: **0** (الخمسة كلها `fillable=template`).",
        "- لذلك: **تعذّر** أخذ 5 presentation من الـ201. وُضعت 5 ضوابط presentation خارج الـ201.",
        "- عيّنة الـ201 الفعلية هنا: **15 operational + 10 external = 25** (+5 ضوابط = 30 صفاً في التقرير).",
        "- Seed: **1059**.",
        "",
        "## المنهجية",
        "- إشارات قالب: الاسم الأول/اكتب هنا/صف لكل سطر/تواريخ افتراضية متكررة…",
        "- إشارات حقيقة: أسماء أعلام، ورش محددة، تواريخ متعددة، أرقام تشغيلية.",
        "- mixed عند اجتماع الإشارتين.",
        "",
        "## الإحصاء — عيّنة من الـ201 فقط (n=25)",
        "| التصنيف | العدد | النسبة |",
        "|---|---:|---:|",
        f"| filled_real | {ctr201.get('filled_real', 0)} | {pct_real:.1f}% |",
        f"| filled_template | {ctr201.get('filled_template', 0)} | {pct_tmpl:.1f}% |",
        f"| mixed | {ctr201.get('mixed', 0)} | {pct_mix:.1f}% |",
        f"| **المجموع** | **{n201}** | 100% |",
        "",
        f"## الإحصاء — كل صفوف التقرير بما فيها ضوابط presentation (n={len(rows_out)})",
        f"- {dict(ctr_all)}",
        "",
        "## التوصية",
        recommendation,
        "",
        f"**توسيع العيّنة:** {expand}",
        "",
        "## أثر استراتيجي",
        "- إن غلب القالب: يتسق مع قرار 58/77 (الأرشيف قالب) ومع خ3/خ4.",
        "- إن برز external كـ filled_real: طبقة الضمّ الخارجي أقرب لتطبيق مدرسة من نص الأرشيف.",
        "",
        "## جدول العيّنة",
        "",
        "| item_id | الاسم | stratum | in_201 | current | new | evidence |",
        "|---|---|---|---|---|---|---|",
    ]
    for x in rows_out:
        md.append(
            f"| {x['item_id']} | {x['item_name'][:40]} | {x['stratum']} | {x['in_filled_201']} | "
            f"{x['current_fillable']} | {x['new_classification']} | {x['evidence'][:90].replace('|', '/')} |"
        )

    md += [
        "",
        "## تفاصيل notes",
        "",
    ]
    for x in rows_out:
        if x["notes"]:
            md.append(f"- **{x['item_id']}** {x['item_name'][:40]}: {x['notes']}")

    md += ["", "## حدود", "- تصنيف آلي بمساعدة قواعد — ليس مراجعة بشرية سطراً بسطر لكل الحقول.", "- نص external مأخوذ من `external_sources/*.txt` عند التوفر.", ""]
    REPORT.write_text("\n".join(md), encoding="utf-8")

    # CSV مساعد اختياري للتحقق
    csv_path = OUTPUT_DIR / "01_filled_review_sample.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as h:
        w = csv.DictWriter(h, fieldnames=list(rows_out[0].keys()))
        w.writeheader()
        w.writerows(rows_out)

    run = [
        "# 01_filled_review_run_log",
        f"## {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "| الوقت | الخطوة | المخرج |",
        "|---|---|---|",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | بدء | قرار 79 · seed=1059 |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | حقيقة | filled={len(filled)} · presentation_filled=0 · ext_filled={len(ext)} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | عيّنة | op=15 · ext={len(sample_ext)} · pres_control=5 |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | إحصاء_201 | {dict(ctr201)} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | توصية | انظر التقرير |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | انتهاء | لا تعديل inventory · لا خ6/خ7 |",
        "",
    ]
    RUN.write_text("\n".join(run), encoding="utf-8")
    print("from_201", dict(ctr201), "all", dict(ctr_all))
    print(recommendation[:120])


if __name__ == "__main__":
    main()
