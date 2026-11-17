# -*- coding: utf-8 -*-
"""الخطوة 3 — إعادة تصنيف أزواج خ2 (قرار 76). 441 ثابتاً — بلا حذف."""
from __future__ import annotations

import csv
import re
import unicodedata
from collections import Counter
from datetime import datetime
from pathlib import Path

from config import FROZEN, OUTPUT_DIR

DUP = OUTPUT_DIR / "02_duplicates.csv"
OUT_CSV = OUTPUT_DIR / "02_reclassified.csv"
REPORT = OUTPUT_DIR / "02_reclassification_report.md"
RUN = OUTPUT_DIR / "02_reclassification_run_log.md"

# أنماط عنوان وظيفية مشتركة (هيكل تقرير/مبادرة/مسابقة…)
PATTERN_STEMS = [
    r"^مبادرة\s+",
    r"^تقرير\s+مسابقة\s+",
    r"^تقرير\s+أولمبياد\s+",
    r"^تقرير\s+برنامج\s+",
    r"^تقرير\s+عن\s+تطبيق\s+استراتيجية",
    r"^مواضيع\s+مقترحة\s+لاجتماعات\s+",
    r"^خطة\s+اجتماعات\s+",
    r"^تعريف\s+",
    r"^قرار\s+تشكيل\s+",
    r"^سجل\s+",
]


def norm_title(t: str) -> str:
    t = unicodedata.normalize("NFKC", t or "")
    t = t.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه")
    t = re.sub(r"[\(\)\[\]\{\}«»\"'ًٌٍَُِّْـ]", "", t)
    t = re.sub(r"\s+", " ", t).strip().lower()
    return t


def stem_family(t: str) -> str | None:
    for pat in PATTERN_STEMS:
        if re.search(pat, t or ""):
            return pat
    return None


def classify(row: dict) -> dict:
    title_a = row.get("عنوان_أ") or ""
    title_b = row.get("عنوان_ب") or ""
    na, nb = norm_title(title_a), norm_title(title_b)
    same_title = na == nb and bool(na)
    score = float(row.get("درجة_نصية") or row.get("text_score") or 0)
    rec = row.get("توصية") or row.get("recommendation") or ""
    type_a, type_b = row.get("نوع_أ") or "", row.get("نوع_ب") or ""
    same_type = type_a == type_b
    fam_a, fam_b = stem_family(title_a), stem_family(title_b)
    same_family = fam_a and fam_a == fam_b and not same_title

    # 1) تكرار تشغيلي — دليل قاطع فقط
    if same_title and score >= 95 and rec == "دمج_مرشّح":
        return dict(
            new_classification="operational_duplicate",
            classification_reason=f"عنوان متطابق + درجة {score:.1f}≥95 + توصية دمج_مرشّح — نفس النموذج ظاهرياً",
            confidence="high",
            evidence_type="both",
        )
    if same_title and score >= 90 and rec == "دمج_مرشّح":
        return dict(
            new_classification="operational_duplicate",
            classification_reason=f"عنوان متطابق + درجة {score:.1f}≥90 + دمج_مرشّح",
            confidence="high",
            evidence_type="title",
        )
    if same_title and score >= 95:
        return dict(
            new_classification="operational_duplicate",
            classification_reason=f"عنوان متطابق + درجة {score:.1f}≥95 (حتى دون وسم دمج)",
            confidence="medium",
            evidence_type="title",
        )

    # أجزاء ملف واحد: أقسام داخل ملف — غالباً قالب/حاوية مشتركة لا نسختان تشغيليتان عبر الأرشيف
    if rec == "أجزاء_ملف_واحد":
        if same_title and score >= 90:
            return dict(
                new_classification="operational_duplicate",
                classification_reason="قسمان بنفس العنوان داخل ملف خارجي واحد ودرجة عالية — تكرار قسم محتمل",
                confidence="medium",
                evidence_type="title",
            )
        return dict(
            new_classification="template_shared",
            classification_reason="أجزاء_ملف_واحد: أقسام متجاورة في ملف واحد بهيكل مشترك ووظائف/عناوين قد تختلف",
            confidence="medium",
            evidence_type="structure",
        )

    # عائلة عنوان واحدة (مبادرة X vs مبادرة Y) بهيكل متشابه
    if same_family and same_type and score >= 70:
        return dict(
            new_classification="template_shared",
            classification_reason=f"نفس عائلة العنوان ({fam_a}) مع عناوين مختلفة ودرجة {score:.1f} — هيكل مشترك وظيفة مختلفة",
            confidence="high" if score >= 80 else "medium",
            evidence_type="title",
        )

    # عناوين مختلفة + تشابه عالٍ: افتراض القالب المشترك (قرار رئيس المشروع)
    if not same_title and score >= 70:
        conf = "high" if score >= 85 else ("medium" if score >= 75 else "low")
        ev = "structure" if score >= 80 else "title"
        return dict(
            new_classification="template_shared",
            classification_reason=f"عناوين مختلفة («{title_a[:28]}» ≠ «{title_b[:28]}») مع تشابه {score:.1f}≥70 — هيكل مشترك لا نسخة تشغيلية واحدة",
            confidence=conf,
            evidence_type=ev,
        )

    # عنوان متطابق لكن درجة متوسطة / بلا دمج — حذر
    if same_title and score >= 70:
        return dict(
            new_classification="undetermined",
            classification_reason=f"عنوان متطابق لكن درجة {score:.1f}<90 أو بلا دمج_مرشّح — يحتاج مراجعة بشرية",
            confidence="low",
            evidence_type="title",
        )

    return dict(
        new_classification="undetermined",
        classification_reason="لا دليل قاطع على تكرار تشغيلي ولا على عائلة قالب واضحة",
        confidence="low",
        evidence_type="title",
    )


def main() -> None:
    rows = list(csv.DictReader(DUP.open(encoding="utf-8-sig")))
    assert len(rows) == FROZEN["duplicate_pairs"], f"انحدار: {len(rows)} ≠ 441"

    out_rows = []
    for r in rows:
        c = classify(r)
        out_rows.append(
            {
                "pair_id": r.get("pair_id"),
                "form_a": r.get("رقم_أ"),
                "form_b": r.get("رقم_ب"),
                "title_a": r.get("عنوان_أ"),
                "title_b": r.get("عنوان_ب"),
                "type_a": r.get("نوع_أ"),
                "type_b": r.get("نوع_ب"),
                "text_score": r.get("درجة_نصية") or r.get("text_score"),
                "operational_gate": r.get("بوابة_تشغيلية") or r.get("operational_gate"),
                "original_recommendation": r.get("توصية") or r.get("recommendation"),
                "new_classification": c["new_classification"],
                "classification_reason": c["classification_reason"],
                "confidence": c["confidence"],
                "evidence_type": c["evidence_type"],
            }
        )

    fields = list(out_rows[0].keys())
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as h:
        w = csv.DictWriter(h, fieldnames=fields)
        w.writeheader()
        w.writerows(out_rows)

    ctr = Counter(r["new_classification"] for r in out_rows)
    conf = Counter(r["confidence"] for r in out_rows)
    ev = Counter(r["evidence_type"] for r in out_rows)
    by_orig = Counter(
        (r["original_recommendation"], r["new_classification"]) for r in out_rows
    )

    assert len(out_rows) == 441
    und = ctr.get("undetermined", 0)
    und_ok = und < 50

    report = [
        "# 02_reclassification_report — إعادة تصنيف أزواج خ2",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "## الحالة: مُسلَّم — قرار 76 · لا خ6/خ7 · 441 ثابتاً",
        "",
        "## المنهجية",
        "1. **operational_duplicate** فقط بدليل قاطع: عنوان متطابق + درجة عالية (≥90 مع دمج_مرشّح، أو ≥95).",
        "2. **template_shared** هو الافتراض عند عناوين مختلفة وتشابه ≥70، أو عائلات عنوان (مبادرة/مسابقة/…)، أو أجزاء_ملف_واحد بعناوين مختلفة.",
        "3. **undetermined** للحالات الرمادية (عنوان متطابق بلا عتبة دمج كافية، أو بلا عائلة).",
        "4. التوصية الأصلية محفوظة في `original_recommendation` — بلا حذف ولا استبدال.",
        "5. `evidence_type` إلزامي: title / structure / both.",
        "",
        "## النتائج",
        f"| التصنيف | العدد | النسبة |",
        f"|---|---:|---:|",
        f"| template_shared | {ctr.get('template_shared', 0)} | {100*ctr.get('template_shared', 0)/441:.1f}% |",
        f"| operational_duplicate | {ctr.get('operational_duplicate', 0)} | {100*ctr.get('operational_duplicate', 0)/441:.1f}% |",
        f"| undetermined | {ctr.get('undetermined', 0)} | {100*ctr.get('undetermined', 0)/441:.1f}% |",
        f"| **المجموع** | **{len(out_rows)}** | 100% |",
        "",
        f"- قيد undetermined < 50: **{'محقق' if und_ok else 'مخالف'}** (العدد={und}).",
        "",
        "## توزيع الثقة وevidence_type",
        f"- confidence: {dict(conf)}",
        f"- evidence_type: {dict(ev)}",
        "",
        "## تقاطع التوصية الأصلية × التصنيف الجديد",
        "",
        "| توصية أصلية | تصنيف جديد | العدد |",
        "|---|---|---:|",
    ]
    for (orig, neu), n in sorted(by_orig.items(), key=lambda x: (-x[1], x[0][0], x[0][1])):
        report.append(f"| {orig} | {neu} | {n} |")

    report += [
        "",
        "## أثر على خ8 (تحفظ رئيس المشروع)",
        f"- الغالبية **template_shared** ({ctr.get('template_shared', 0)}) → خ8 أقرب لـ**بناء/توحيد قوالب** لا دمج سجلات تشغيلية.",
        f"- الأقلية **operational_duplicate** ({ctr.get('operational_duplicate', 0)}) → مرشّحو دمج بشري محدودون.",
        f"- **undetermined** ({und}) → مراجعة بشرية موجّهة لاحقاً.",
        "",
        "## حدود",
        "- لا درجات هيكل/جداول منفصلة في CSV؛ الاستدلال من العنوان + الدرجة المركّبة + التوصية الأصلية.",
        "- التصنيف آلي محافظ؛ ليس حكماً نهائياً للدمج.",
        "",
    ]
    REPORT.write_text("\n".join(report), encoding="utf-8")

    run = [
        "# 02_reclassification_run_log",
        f"## {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "| الوقت | الحدث |",
        "|---|---|",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | بدء إعادة التصنيف | قرار 76 |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | قراءة | 02_duplicates.csv n={len(rows)} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | كتابة | 02_reclassified.csv n={len(out_rows)} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | إحصاء | {dict(ctr)} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | undetermined | {und} {'<50 OK' if und_ok else 'FAIL'} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | انتهاء | لا خ6/خ7 · بلا حذف |",
        "",
    ]
    # fix table - I mixed columns. Rewrite run log cleanly
    run = [
        "# 02_reclassification_run_log",
        f"## {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "| الوقت | الخطوة | المخرج |",
        "|---|---|---|",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | بدء | قرار 76 |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | قراءة | 02_duplicates.csv = {len(rows)} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | كتابة | 02_reclassified.csv = {len(out_rows)} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | template_shared | {ctr.get('template_shared', 0)} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | operational_duplicate | {ctr.get('operational_duplicate', 0)} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | undetermined | {und} ({'OK <50' if und_ok else 'FAIL'}) |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | تقرير | 02_reclassification_report.md |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | انتهاء | لا خ6/خ7 |",
        "",
    ]
    RUN.write_text("\n".join(run), encoding="utf-8")
    print(dict(ctr), "undetermined", und, "ok", und_ok)


if __name__ == "__main__":
    main()
