# -*- coding: utf-8 -*-
"""تعديل مخرجات الخوارزمية 1: layer + fillable + explicit_indicator."""
from __future__ import annotations

import csv
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

from config import OUTPUT_DIR as OUT_DIR, get_archive_path

SOURCE = get_archive_path()
CSV_PATH = OUT_DIR / "01_inventory.csv"
REPORT_PATH = OUT_DIR / "01_inventory_report.md"

PRESENTATION_TITLES = {
    "غلاف لأي تقرير أو ملف",
    "غلاف لأي تقرير أو ملف بالعرض (أفقي)",
    "غلاف فرعي داخلي لأي تقرير أو ملف",
    "فهرس تفاعلي لأي تقرير أو ملف",
    "فواصل لأي تقرير أو ملف",
}

# ضوضاء واجهة المنصة — لا تُحسب وحدها قالباً ولا تمنع التصنيف
CHROME_NOISE = [
    "ّلم يتمّ اختيار أيّ ملفّ",
    "لم يتم اختيار أي ملف",
    "أكتب هنا خيار إضافي",
    "أكتب خيارات إضافية",
    "إضافة شواهد (صور)",
    "أقصى حد للشواهد",
    "ضغط الشواهد",
    "ضع رابط الشواهد",
    "محاولة تصغير الشواهد للحصول على صفحة واحدة",
]

# تعليمات تعبئة حقيقية فقط (ليست تسميات حقول عامة مثل «اسم المعلم»)
TEMPLATE_MARKERS = [
    "اكتب هنا",
    "أكتب هنا",
    "اكتب الأهداف",
    "اضف الاسم هنا",
    "أضف الاسم هنا",
    "الهدف الأول.",
    "الخطوة الأولى.",
    "الخطولة الخامسة",
    "يتكون من سطرين",
    "عنوان الملف",
    "لخّص الغاية",
    "لخص الغاية",
    "اذكر الأهداف",
    "اذكر عناصر",
    "وضح الغاية",
    "اذكر الأهداف المحددة",
]

# أنواع يغلب عليها كونها قالباً قابلاً لإعادة الاستخدام
TEMPLATE_KINDS = {"نموذج", "خطة", "استمارة", "استبانة", "بطاقة"}

# إشارات تعبئة مدرسية/حقيقية (نادرة في هذا الأرشيف)
SCHOOL_REAL = [
    "سعد بن الربيع",
    "الأنصاري",
    "الإدارة العامة للتعليم بمنطقة المدينة",
]

DEMO_NAMES = [
    "محمد الفيصل",
    "طالب تجريبي",
    "خالد ناصر",
    "هاني سالم",
    "ماهر عبدالله",
    "بشير فهد",
]

PHONE_RE = re.compile(r"(?:05\d{8}|٠٥[٠-٩]{8})")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
ID_RE = re.compile(r"(?<!\d)\d{10}(?!\d)")
AR_NUM_RE = re.compile(r"[٠-٩]{2,}")
LAT_NUM_RE = re.compile(r"(?<!\d)\d{2,}(?!\d)")
INDICATOR_RE = re.compile(r"(?<!\d)(\d{1,2}-\d{1,2}-\d{1,2}-\d{1,2})(?!\d)")
INSTRUCTION_PREFIXES = (
    "اكتب",
    "أكتب",
    "اذكر",
    "وضح",
    "لخّص",
    "لخص",
    "أضف",
    "اضف",
    "ضع ",
    "اختر",
)


def load_rows() -> list[dict]:
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def blocks_by_start(lines: list[str], rows: list[dict]) -> dict[int, str]:
    starts = sorted(int(r["سطر_البداية"]) for r in rows)
    mapping: dict[int, str] = {}
    for i, start in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else len(lines) + 1
        mapping[start] = "\n".join(lines[start - 1 : end - 1])
    return mapping


def _strip_chrome(text: str) -> str:
    out = text
    for noise in CHROME_NOISE:
        out = out.replace(noise, " ")
    return out


def _template_score(text: str) -> int:
    return sum(1 for marker in TEMPLATE_MARKERS if marker in text)


def _school_real_score(text: str) -> int:
    return sum(1 for token in SCHOOL_REAL if token in text)


def _filled_score(text: str) -> int:
    """محتوى معبأ بعد عزل ضوضاء الواجهة — لا يشمل إشارات القالب."""
    score = 0
    score += sum(1 for name in DEMO_NAMES if name in text)
    score += len(PHONE_RE.findall(text))
    score += len(EMAIL_RE.findall(text))
    score += len(ID_RE.findall(text))
    for line in text.splitlines():
        line = line.strip()
        if len(line) < 45:
            continue
        if any(line.startswith(p) for p in INSTRUCTION_PREFIXES):
            continue
        if any(m in line for m in TEMPLATE_MARKERS):
            continue
        letters = sum(1 for ch in line if "\u0600" <= ch <= "\u06ff")
        if letters >= 35:
            score += 1
    nums = len(AR_NUM_RE.findall(text)) + len(LAT_NUM_RE.findall(text))
    if nums >= 3:
        score += 1
    return score


def classify_fillable(text: str, kind: str = "") -> str:
    """
    قاعدة متوازنة بعد التحقق 1 (ضيّقة→واسعة→وسط):
    1) عزل ضوضاء edu-forms.
    2) أنواع هيكلية (نموذج/خطة/استمارة/استبانة/بطاقة) بلا مرساة مدرسية → template.
    3) تعليمات تعبئة صريحة («اضف الاسم هنا»/«اكتب…») → template ما لم توجد مرساة مدرسية.
    4) مرساة مدرسية حقيقية → filled (أو unknown إن رافقتها تعليمات صريحة).
    5) مضمون وصفي بلا تعليمات → filled؛ وإلا unknown.
    """
    cleaned = _strip_chrome(text)
    t = _template_score(cleaned)
    f = _filled_score(cleaned)
    real = _school_real_score(cleaned)
    structural = kind in TEMPLATE_KINDS

    if real >= 1 and t >= 1:
        return "unknown"
    if real >= 1:
        return "filled"
    if structural or t >= 1:
        return "template"
    if f >= 2:
        return "filled"
    return "unknown"


def explicit_indicators(text: str) -> str:
    found = sorted(set(INDICATOR_RE.findall(text)))
    return ";".join(found)


def enrich(rows: list[dict], lines: list[str]) -> list[dict]:
    blocks = blocks_by_start(lines, rows)
    out = []
    for row in rows:
        title = row["العنوان"]
        start = int(row["سطر_البداية"])
        block = blocks.get(start, "")
        layer = "presentation" if title in PRESENTATION_TITLES else "operational"
        if layer == "presentation":
            fillable = "template"
        else:
            fillable = classify_fillable(block, kind=row.get("النوع") or "")
        row = dict(row)
        row["layer"] = layer
        row["fillable"] = fillable
        row["explicit_indicator"] = explicit_indicators(block) if layer == "operational" else ""
        out.append(row)
    return out


def write_csv(rows: list[dict]) -> None:
    fields = [
        "رقم",
        "العنوان",
        "النوع",
        "القسم",
        "عدد_الحقول",
        "عدد_الجداول_الداخلية",
        "layer",
        "fillable",
        "explicit_indicator",
        "سطر_البداية",
        "سطر_العنوان",
        "مصدر_العنوان",
        "علامة_العنوان",
        "طول_المقطع_أسطر",
    ]
    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def write_report(rows: list[dict]) -> None:
    by_type = Counter(r["النوع"] for r in rows)
    by_layer = Counter(r["layer"] for r in rows)
    by_fill = Counter(r["fillable"] for r in rows)
    with_ind = sum(1 for r in rows if str(r.get("explicit_indicator") or "").strip())
    operational = [r for r in rows if r["layer"] == "operational"]
    presentation = [r for r in rows if r["layer"] == "presentation"]

    lines = [
        "# 01_inventory — الجرد الكامل (محدّث بعد مراجعة رئيس المشروع)",
        "## الغرض:",
        "حصر عناصر الأرشيف مع تمييز الطبقة التشغيلية/الإخراجية، وحالة القالب/التعبئة، والمؤشر الصريح إن وُجد.",
        "## المصدر:",
        f"`{SOURCE}`",
        f"حجم الملف: {SOURCE.stat().st_size} بايت — عدد الأسطر: {len(SOURCE.read_text(encoding='utf-8', errors='replace').splitlines())}",
        "## التاريخ:",
        datetime.now().strftime("%Y-%m-%d %H:%M"),
        "## المسؤول:",
        "مهندس المنظومة (تعديل اعتماد الخوارزمية 1)",
        "## الحالة: مراجعة — بانتظار الاعتماد النهائي",
        "",
        "## الخط الأساس",
        f"- إجمالي الجرد: **{len(rows)}** (لا حذف)",
        f"- operational: **{by_layer.get('operational', 0)}**",
        f"- presentation: **{by_layer.get('presentation', 0)}**",
        f"- الخط الأساس التشغيلي المقترح للخوارزميات 2/4/5/6/7/10: **{by_layer.get('operational', 0)}**",
        "",
        "## إحصاءات الأعمدة الجديدة",
        "",
        "### layer",
        "",
        "| القيمة | العدد |",
        "|---|---:|",
        f"| operational | {by_layer.get('operational', 0)} |",
        f"| presentation | {by_layer.get('presentation', 0)} |",
        "",
        "### fillable",
        "",
        "| القيمة | العدد |",
        "|---|---:|",
        f"| template | {by_fill.get('template', 0)} |",
        f"| filled | {by_fill.get('filled', 0)} |",
        f"| unknown | {by_fill.get('unknown', 0)} |",
        "",
        f"### explicit_indicator",
        f"- نماذج تحمل مؤشراً صريحاً واحداً على الأقل: **{with_ind}**",
        f"- بدون مؤشر صريح: **{len(rows) - with_ind}**",
        "",
        "## عناصر presentation (مُستثناة من خوارزميات 2/4/5/6/7/10)",
        "",
    ]
    for row in presentation:
        lines.append(f"- [{row['رقم']}] {row['العنوان']}")
    lines += [
        "",
        "## إحصائية النوع (أولية — غير معتمدة رسمياً قبل خوارزمية 2)",
        "",
        "| النوع | العدد |",
        "|---|---:|",
    ]
    for kind, count in by_type.most_common():
        lines.append(f"| {kind} | {count} |")
    lines += [
        "",
        "## تحفظات معتمدة من رئيس المشروع",
        "1. الرقم 543 خط أساس للجرد الكامل؛ أي تعديل لاحق يُسجَّل في decisions_log.",
        "2. التصنيف النوعي أولي ولا يدخل تقارير رسمية قبل اعتماد ما بعد الخوارزمية 2.",
        "3. 200 غير مصنّف تبقى كما هي حتى الخوارزمية 3.",
        "4. عمود fillable يجهّز فرضية القالب/التعبئة دون دمج الآن.",
        "",
        "## حدود تصنيف fillable (موسّعة بعد التحقق 1)",
        "- عُزلت ضوضاء edu-forms (رفع الشواهد / خيار إضافي) قبل الحكم.",
        "- `template`: تعليمات تعبئة حقيقية، أو نوع هيكلي (نموذج/خطة/استمارة/استبانة/بطاقة) بلا مرساة مدرسية.",
        "- `filled`: مرساة مدرسية حقيقية، أو مضمون وصفي بلا تعليمات قالب.",
        "- `unknown`: مختلط حقيقي+قالب، أو إشارات ضعيفة.",
        "- العمود مُجهَّز لخ2؛ لا دمج/حذف الآن.",
        "",
        f"## الملفات",
        f"- `{CSV_PATH.name}`",
        f"- `{REPORT_PATH.name}`",
        "",
        "## قرار التوقف",
        "بانتظار اعتماد رئيس المشروع بعد التحققات — لا بدء لخ2.",
    ]
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("STATS", dict(by_layer), dict(by_fill), "with_indicator", with_ind)


def main() -> None:
    lines = SOURCE.read_text(encoding="utf-8", errors="replace").splitlines()
    rows = enrich(load_rows(), lines)
    write_csv(rows)
    write_report(rows)


if __name__ == "__main__":
    main()
