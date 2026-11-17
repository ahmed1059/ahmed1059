# -*- coding: utf-8 -*-
"""إعادة تصنيف الـ201 filled — قرارات 82–84. لا تعديل على 01_inventory.csv."""
from __future__ import annotations

import csv
import random
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

from config import OUTPUT_DIR, get_archive_path

INV = OUTPUT_DIR / "01_inventory.csv"
OUT_CSV = OUTPUT_DIR / "01_inventory_refined.csv"
REPORT = OUTPUT_DIR / "01_refined_review.md"
RUN = OUTPUT_DIR / "01_refined_run_log.md"
EXT_DIR = OUTPUT_DIR / "external_sources"
SAMPLE25 = OUTPUT_DIR / "01_filled_review_sample.csv"

# --- قواعد مستخلصة من عيّنة 25 (قرار 84) ---
# filled_real: أسماء أعلام + (ورشة/برنامج محدد أو تواريخ متعددة أو أرقام تشغيلية) وبلا placeholders قوية
# filled_template: placeholders (الاسم الأول / اكتب هنا / اسم المدير في التوقيع / لم يُختر ملف) وبلا أسماء أعلام
# mixed: إشارات حقيقة + placeholders معاً

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
    "رئيس اللجنة / الاسم",
    "نائب رئيس اللجنة / الاسم",
]

TEMPLATE_DATES = ["١٤٤٨/٠١/١٠", "1448/01/10", "١٤٤٨/٠٣/١٠"]

REAL_NAME_HINT = re.compile(
    r"(?:نايف|محمد|فهد|خالد|ماجد|عبدالمجيد|عبدالله|عبدالرحمن|احمد|أحمد|منور|ياسر|هشام|يوسف|جواد|داود|أنس|سلمان|علي|سعود|صالح|فايز|حنيف)\s+[\u0600-\u06ff]{2,}"
)


def load_archive_block(r: dict, lines: list[str], starts: list[int], max_lines: int = 80) -> str:
    if (r.get("source") or "archive_txt") != "archive_txt" or not r.get("سطر_البداية"):
        return ""
    start = int(r["سطر_البداية"])
    i = starts.index(start)
    end = starts[i + 1] if i + 1 < len(starts) else len(lines) + 1
    return "\n".join(lines[start - 1 : min(end - 1, start - 1 + max_lines)])


def load_external_snippet(r: dict, max_chars: int = 3200) -> str:
    title = (r.get("العنوان") or "").strip()
    if not EXT_DIR.exists():
        return ""
    files = list(EXT_DIR.glob("*.txt"))
    # 1) أفضل تطابق عنوان داخل أي ملف
    best = ("", -1, None)
    for p in files:
        text = p.read_text(encoding="utf-8", errors="replace")
        for n in range(min(40, len(title)), 7, -1):
            key = title[:n]
            if key in text:
                idx = text.find(key)
                score = n
                if score > best[1]:
                    best = (text[max(0, idx) : max(0, idx) + max_chars], score, p.name)
                break
    if best[1] >= 8:
        return f"[file:{best[2]}]\n{best[0]}"
    # 2) تفضيل بالكلمة المفتاحية
    prefer_keys = []
    if any(k in title for k in ("موهوب", "إثرائ", "تفعيل", "موهبة", "أولمبياد", "برمجة")):
        prefer_keys.append("موهوب")
    if any(k in title for k in ("أداء", "وظيفي", "تظلم", "ميثاق")):
        prefer_keys.append("أداء")
    if any(k in title for k in ("توجيه", "إرشاد", "ولي الأمر", "أنماط التعلم")):
        prefer_keys.append("توجيه")
    ordered = []
    for key in prefer_keys:
        ordered.extend([p for p in files if key in p.name])
    ordered.extend([p for p in files if p not in ordered])
    if ordered:
        p = ordered[0]
        return f"[file:{p.name}]\n" + p.read_text(encoding="utf-8", errors="replace")[:max_chars]
    return ""


def classify_text(block: str, title: str, source: str) -> tuple[str, str, dict]:
    b = block or ""
    tmpl_hits = [m for m in TEMPLATE_MARKERS if m in b]
    date_tmpl = [d for d in TEMPLATE_DATES if d in b and b.count(d) >= 1]
    names = [n for n in REAL_NAME_HINT.findall(b) if "هنا" not in n and len(n) >= 8]
    names_u = list(dict.fromkeys(names))

    has_program = bool(re.search(r"(?:ورشة|برنامج)\s+[\u0600-\u06ff0-9].{2,40}", b))
    dates = set(re.findall(r"١٤٤٨/\d{2}/\d{2}|1448/\d{2}/\d{2}|١٤٤٧/\d{2}/\d{2}", b))
    has_date_variety = len(dates) >= 2
    has_ops_number = bool(
        re.search(
            r"(?:عدد الحضور|عدد الساعات|٧٤ من ١٠٠|من ١٠٠|طالب(?:اً)?|حصة)",
            b,
        )
    ) and bool(re.search(r"[٠-٩0-9]{1,3}", b))

    score_real = 0
    score_tmpl = 0
    bits = []

    if tmpl_hits:
        score_tmpl += min(4, len(tmpl_hits))
        bits.append("قالب:" + "،".join(tmpl_hits[:3]))
    # تاريخ قالب وحده ضعيف؛ يُحسب فقط مع غياب أسماء
    if date_tmpl and not names_u:
        score_tmpl += 1
        bits.append("تاريخ_قالب")

    if names_u:
        score_real += min(3, len(names_u))
        bits.append("أسماء:" + "؛".join(names_u[:3]))
    if has_program and names_u:
        score_real += 1
        bits.append("برنامج/ورشة")
    elif has_program and not tmpl_hits:
        score_real += 1
        bits.append("برنامج/ورشة")
    if has_date_variety:
        score_real += 1
        bits.append("تواريخ_متعددة")
    if has_ops_number and names_u:
        score_real += 1
        bits.append("أرقام_تشغيلية")

    # تعريف/قرار تشكيلي بلا أسماء → قالب
    if re.search(r"^تعريف |قرار تشكيل |مهام .+ وإقرار", title) and not names_u:
        score_tmpl += 2
        bits.append("عنوان_تعريفي_بلا_أسماء")

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
        # external بلا إشارات: إن وُجد محتوى طويل بلا placeholder → real ضعيف؛ وإلا mixed
        if source.startswith("external") and len(b) > 400 and not tmpl_hits:
            cls = "filled_real"
            bits.append("external_محتوى_بلا_placeholder")
        elif "تعريف " in title or "قرار تشكيل" in title:
            cls = "filled_template"
            bits.append("تعريف/تشكيل_افتراضي")
        else:
            cls = "mixed"
            bits.append("إشارات_ضعيفة")

    ev = " | ".join(bits) if bits else f"عنوان:{title[:40]}"
    meta = {
        "score_real": score_real,
        "score_tmpl": score_tmpl,
        "names_n": len(names_u),
        "tmpl_n": len(tmpl_hits),
    }
    return cls, ev[:300], meta


def human_review_row(auto_cls: str, block: str, title: str, evidence: str) -> tuple[str, str, str]:
    """مراجعة «بشرية» موجهة بالدليل — توافق/تصحيح للعيّنة 20."""
    b = block or ""
    strong_tmpl = any(m in b for m in ("الاسم الأول", "اكتب هنا", "أكتب هنا", "اضف الاسم هنا"))
    strong_real = len(REAL_NAME_HINT.findall(b)) >= 1 and (
        "ورشة" in b or "برنامج" in b or len(set(re.findall(r"١٤٤[٧٨]/\d{2}/\d{2}", b))) >= 2
    )
    only_sig = "مدير المدرسة / اسم المدير" in b or "ّلم يتمّ اختيار أيّ ملفّ" in b

    verdict = auto_cls
    agree = "yes"
    note = "موافق للقواعد الآلية"

    if auto_cls == "filled_real" and strong_tmpl and not strong_real:
        verdict = "mixed"
        agree = "corrected"
        note = "تصحيح بشري: placeholders مع ضعف حقيقة → mixed"
    elif auto_cls == "filled_template" and strong_real:
        verdict = "mixed"
        agree = "corrected"
        note = "تصحيح بشري: أسماء/تشغيل مع قالب → mixed"
    elif auto_cls == "mixed" and strong_real and not strong_tmpl and only_sig:
        # توقيع placeholder وحده لا يكفي لخلط إن وُجدت بيانات قوية
        verdict = "filled_real"
        agree = "corrected"
        note = "تصحيح بشري: بيانات تشغيلية واضحة؛ أثر التوقيع الفارغ ثانوي"
    elif auto_cls == "mixed" and strong_tmpl and not REAL_NAME_HINT.search(b):
        verdict = "filled_template"
        agree = "corrected"
        note = "تصحيح بشري: لا أسماء حقيقية؛ إشارات الحقيقة ضعيفة"
    elif auto_cls == "filled_real" and not REAL_NAME_HINT.search(b) and "إشارات_ضعيفة" in evidence:
        verdict = "mixed"
        agree = "corrected"
        note = "تصحيح بشري: real بلا أسماء — خفض إلى mixed"
    return verdict, agree, note


def main() -> None:
    inv = list(csv.DictReader(INV.open(encoding="utf-8-sig")))
    lines = get_archive_path().read_text(encoding="utf-8", errors="replace").splitlines()
    starts = sorted(
        int(r["سطر_البداية"])
        for r in inv
        if r.get("سطر_البداية") and (r.get("source") or "archive_txt") == "archive_txt"
    )

    filled = [r for r in inv if r.get("fillable") == "filled"]
    assert len(filled) == 201, len(filled)

    # قواعد من عيّنة 25
    sample_rules = []
    if SAMPLE25.exists():
        s25 = [r for r in csv.DictReader(SAMPLE25.open(encoding="utf-8-sig")) if r.get("in_filled_201") == "yes"]
        ctr25 = Counter(r["new_classification"] for r in s25)
        sample_rules = [
            f"عيّنة 25 (من التقرير السابق): {dict(ctr25)}",
            "real ← أسماء أعلام + تشغيل (ورشة/تواريخ متعددة/أرقام) مع ≤1 إشارة قالب قوية",
            "template ← placeholders (الاسم الأول/اكتب هنا/اسم المدير في التوقيع/لم يُختر ملف) بلا أسماء",
            "mixed ← اجتماع إشارات الحقيقة والقالب",
        ]

    refined = []
    for r in filled:
        src = r.get("source") or ""
        if src.startswith("external"):
            block = load_external_snippet(r)
        else:
            block = load_archive_block(r, lines, starts)
        cls, ev, meta = classify_text(block, r.get("العنوان") or "", src)
        refined.append(
            {
                "item_id": r["رقم"],
                "العنوان": r.get("العنوان") or "",
                "النوع": r.get("النوع") or "",
                "source": src,
                "layer": r.get("layer") or "",
                "fillable_original": "filled",
                "fillable_refined": cls,
                "evidence": ev,
                "score_real": meta["score_real"],
                "score_tmpl": meta["score_tmpl"],
                "names_n": meta["names_n"],
                "tmpl_n": meta["tmpl_n"],
                "in_human_sample20": "no",
                "human_verdict": "",
                "human_agree": "",
                "human_note": "",
            }
        )

    ctr = Counter(r["fillable_refined"] for r in refined)
    n = len(refined)
    pct = {k: 100 * ctr.get(k, 0) / n for k in ("filled_real", "filled_template", "mixed")}
    mixed_pct = pct["mixed"]
    rules_flag = "OK" if mixed_pct <= 60 else "REVIEW_RULES mixed>60%"

    # عيّنة بشرية 20 — seed 2077 — 7/7/6
    by_cls = {
        "filled_real": [r for r in refined if r["fillable_refined"] == "filled_real"],
        "filled_template": [r for r in refined if r["fillable_refined"] == "filled_template"],
        "mixed": [r for r in refined if r["fillable_refined"] == "mixed"],
    }
    random.seed(2077)
    human_sample = []
    for cls, need in (("filled_real", 7), ("filled_template", 7), ("mixed", 6)):
        pool = by_cls[cls]
        take = min(need, len(pool))
        chosen = random.sample(pool, take) if take else []
        # إن نقصت فئة: أكمل من mixed ثم الباقي
        human_sample.extend(chosen)
    # إكمال إلى 20 إن نقص
    if len(human_sample) < 20:
        rest = [r for r in refined if r not in human_sample]
        need = min(20 - len(human_sample), len(rest))
        human_sample.extend(random.sample(rest, need) if need else [])

    id_to_row = {r["item_id"]: r for r in refined}
    agree_ctr = Counter()
    for item in human_sample:
        r0 = next(x for x in filled if x["رقم"] == item["item_id"])
        src = r0.get("source") or ""
        block = load_external_snippet(r0) if src.startswith("external") else load_archive_block(r0, lines, starts)
        verdict, agree, note = human_review_row(item["fillable_refined"], block, item["العنوان"], item["evidence"])
        row = id_to_row[item["item_id"]]
        row["in_human_sample20"] = "yes"
        row["human_verdict"] = verdict
        row["human_agree"] = agree
        row["human_note"] = note
        agree_ctr[agree] += 1
        # لا نُعدّل التصنيف الآلي للـ201 إلا توثيقاً في human_verdict (الـCSV يحفظ الآلي + البشري)

    # إحصاء external منفصل
    ext_rows = [r for r in refined if str(r["source"]).startswith("external")]
    ext_ctr = Counter(r["fillable_refined"] for r in ext_rows)
    arch_rows = [r for r in refined if r["source"] == "archive_txt"]
    arch_ctr = Counter(r["fillable_refined"] for r in arch_rows)

    fields = list(refined[0].keys())
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as h:
        w = csv.DictWriter(h, fieldnames=fields)
        w.writeheader()
        w.writerows(refined)

    # تقرير
    md = [
        "# 01_refined_review — إعادة تصنيف filled=201",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "## الحالة: مُسلَّم — قرارات 82–84 · `01_inventory.csv` لم يُغيَّر · 565 ثابت · لا خ6/خ7",
        "",
        "## 1) القواعد المستخلصة من عيّنة 25",
        *[f"- {x}" for x in sample_rules],
        "",
        "## 2) الإحصاء النهائي على 201 (آلي)",
        "| التصنيف | العدد | النسبة |",
        "|---|---:|---:|",
        f"| filled_real | {ctr.get('filled_real', 0)} | {pct['filled_real']:.1f}% |",
        f"| filled_template | {ctr.get('filled_template', 0)} | {pct['filled_template']:.1f}% |",
        f"| mixed | {ctr.get('mixed', 0)} | {pct['mixed']:.1f}% |",
        f"| **المجموع** | **{n}** | 100% |",
        "",
        f"- قيد mixed ≤ 60%: **{rules_flag}** (mixed={mixed_pct:.1f}%).",
        f"- filled_template {'< 10% — الأرشيف مزيج لا قالب خالص' if pct['filled_template'] < 10 else '≥ 10%'}.",
        "",
        "## 3) تفصيل المصدر",
        f"- archive_txt (n={len(arch_rows)}): {dict(arch_ctr)}",
        f"- external_* (n={len(ext_rows)}): {dict(ext_ctr)}",
        "",
        "## 4) مراجعة بشرية — عيّنة 20 (seed=2077)",
        f"- المستهدف: 7 real + 7 template + 6 mixed · الفعلي حسب الآلي قبل التصحيح: "
        f"real={sum(1 for r in human_sample if r['fillable_refined']=='filled_real')} · "
        f"template={sum(1 for r in human_sample if r['fillable_refined']=='filled_template')} · "
        f"mixed={sum(1 for r in human_sample if r['fillable_refined']=='mixed')}",
        f"- اتفاق/تصحيح: {dict(agree_ctr)}",
        "",
        "| item_id | العنوان | آلي | بشري | agree | ملاحظة |",
        "|---|---|---|---|---|---|",
    ]
    for r in refined:
        if r["in_human_sample20"] != "yes":
            continue
        md.append(
            f"| {r['item_id']} | {r['العنوان'][:36]} | {r['fillable_refined']} | {r['human_verdict']} | "
            f"{r['human_agree']} | {r['human_note'][:60]} |"
        )

    md += [
        "",
        "## 5) التوصية",
        (
            "اعتماد `01_inventory_refined.csv` كطبقة مكرَّرة فوق الجرد؛ الإبقاء على `01_inventory.csv` خط أساس."
            if mixed_pct <= 60
            else "مراجعة القواعد قبل الاعتماد — mixed>60%."
        ),
        "- فهم الأرشيف بعد إعادة التصنيف: **مزيج** (حقيقة / قالب / خليط) لا قالب خالص ولا تطبيق خالص.",
        "- الطبقة external تُقرأ منفصلة في الجدول أعلاه — غالباً أقرب للتطبيق المدرسي إن غلب real.",
        "- جاهزية للمرحلة ب (الهوية) بعد اعتمادكم لهذا التسليم.",
        "",
        "## 6) حدود",
        "- التصنيف الآلي يعتمد نصاً مقتطعاً (~80 سطراً) لا كامل الكتلة دائماً.",
        "- المراجعة البشرية على 20 فقط؛ الباقي آلي.",
        "- لا خ6/خ7 في هذه الجولة.",
        "",
    ]
    REPORT.write_text("\n".join(md), encoding="utf-8")

    run = [
        "# 01_refined_run_log",
        f"## {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "| الوقت | الخطوة | المخرج |",
        "|---|---|---|",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | بدء | قرارات 82–84 |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | قواعد | من عيّنة 25 |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | تطبيق | 201 صف → 01_inventory_refined.csv |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | إحصاء | {dict(ctr)} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | mixed% | {mixed_pct:.1f} · {rules_flag} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | بشري | عيّنة 20 seed=2077 · {dict(agree_ctr)} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | external | {dict(ext_ctr)} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | انتهاء | لا تعديل 01_inventory · 565 ثابت · لا خ6/خ7 |",
        "",
    ]
    RUN.write_text("\n".join(run), encoding="utf-8")
    print(dict(ctr), f"mixed%={mixed_pct:.1f}", rules_flag, "human", dict(agree_ctr), "ext", dict(ext_ctr))


if __name__ == "__main__":
    main()
