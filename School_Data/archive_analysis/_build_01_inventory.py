# -*- coding: utf-8 -*-
"""الخوارزمية 1 — الجرد الكامل لأرشيف البرامج والتقارير والسجلات والمحاضر."""
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

TITLE_MARKERS = [
    ("عنوان التقرير", "تقرير"),
    ("عنوان السجل", "سجل"),
    ("عنوان الخطة", "خطة"),
    ("عنوان الكشف", "كشف"),
    ("عنوان الاستمارة", "استمارة"),
    ("عنوان النموذج", "نموذج"),
    ("عنوان القرار", "قرار"),
    ("عنوان المحضر", "محضر"),
    ("عنوان الخطاب", "خطاب"),
    ("عنوان الاستبانة", "استبانة"),
    ("عنوان البطاقة", "بطاقة"),
]

SECTION_RULES = [
    (r"مبادرة|اليوم الوطني|اليوم العالمي|مناسبة", "مبادرات ومناسبات"),
    (r"استراتيج", "استراتيجيات التدريس"),
    (r"برنامج|نشاط(?! )|تغطية", "برامج وأنشطة"),
    (r"خطة علاجية|خطة إثرائية|فاقد|متعثر|تحسين نتائج|تشخيص", "تحسين نتائج المتعلمين"),
    (r"قياس الأثر", "قياس الأثر"),
    (r"زيارة صفية|إشراف|دعم وتطوير أداء|تقويم أداء المعل", "إشراف وتطوير مهني"),
    (r"غياب|تأخر|مناوبة|انتظار|سلوك|مواظبة|مخالف", "انضباط ودوام طلابي"),
    (r"اختبار|إجابة|لجنة اختبار|رصد|نتيجة|تحليل نتائج", "اختبارات ونتائج"),
    (r"لجنة|محضر|قرار تشكيل|تميز|تدقيق داخلي", "لجان ومحاضر"),
    (r"شراكة|ولي أمر|مجتمع|تطوع", "شراكة مجتمعية"),
    (r"أمن|سلامة|إخلاء|طوارئ", "أمن وسلامة"),
    (r"مصادر|مختبر|وسائل|تقنية|مدرستي", "مصادر وتقنية"),
    (r"موهوب", "موهوبون"),
    (r"ذوي إعاقة|تربية خاصة|دمج", "تربية خاصة"),
    (r"توجيه|إرشاد|دراسة حالة|صحة", "توجيه طلابي وصحة"),
    (r"مراسل|صادر|وارد|تعميم|خطاب", "اتصالات إدارية"),
    (r"أداء وظيفي|اطلاع على تقويم|تكليف", "شؤون وظيفية"),
    (r"غلاف|فهرس|فواصل", "قوالب وثائقية"),
    (r"منتظر|جدول|توزيع", "جداول وتنظيم"),
    (r"صندوق|مالي|ميزانية", "شؤون مالية"),
]

TYPE_RULES = [
    (r"^قرار\b|قرار ", "قرار"),
    (r"^محضر\b|محضر ", "محضر"),
    (r"^خطاب\b|تعميم\b|إشعار\b", "خطاب"),
    (r"^استبانة\b|استبيان\b", "استبانة"),
    (r"^بطاقة\b", "بطاقة"),
    (r"^كشف\b|بيان\b", "كشف"),
    (r"^استمارة\b", "استمارة"),
    (r"^خطة\b", "خطة"),
    (r"^سجل\b", "سجل"),
    (r"^نموذج\b", "نموذج"),
    (r"^تقرير\b|مبادرة\b|توثيق\b|تنفيذ\b|تفعيل\b", "تقرير"),
]

FIELD_HINTS = {
    "المعلومات الأساسية",
    "محتوى التقرير",
    "القوائم",
    "التوقيعات",
    "إضافة شواهد",
    "إعدادات التقرير",
    "الترويسة والشعارات",
    "صورة الشاهد",
    "توقيع يمين",
    "توقيع وسط",
    "توقيع يسار",
    "أكتب خيارات إضافية",
    "أقصى حد للشواهد",
    "ضغط الشواهد",
    "إضافة صف",
}

SKIP_AS_FIELD = {
    "",
    "المعلومات الأساسية",
    "محتوى التقرير",
    "القوائم",
    "التوقيعات",
    "إضافة شواهد (صور)",
    "إضافة شواهد",
    "إعدادات التقرير",
    "الترويسة والشعارات",
    "ّلم يتمّ اختيار أيّ ملفّ",
    "لم يتم اختيار أي ملف",
}


def classify_type(title: str, marker_hint: str = "") -> str:
    text = (title or "").strip()
    for pattern, kind in TYPE_RULES:
        if re.search(pattern, text):
            return kind
    if marker_hint:
        return marker_hint
    return "نموذج"


def classify_section(title: str) -> str:
    text = title or ""
    for pattern, section in SECTION_RULES:
        if re.search(pattern, text):
            return section
    return "غير مصنّف بعد"


def next_nonempty(lines: list[str], start: int) -> tuple[int, str]:
    j = start
    while j < len(lines):
        text = lines[j].strip()
        if text:
            return j, text
        j += 1
    return start, ""


def is_title_marker(line: str) -> tuple[str, str] | None:
    text = line.strip()
    for marker, hint in TITLE_MARKERS:
        if text.startswith(marker):
            return marker, hint
    return None


def count_fields_and_tables(block: list[str]) -> tuple[int, int]:
    field_labels: list[str] = []
    tables = 0
    i = 0
    while i < len(block):
        raw = block[i]
        text = raw.strip()
        if "إضافة صف" in text or text.startswith("+ إضافة") or text == "إضافة صف":
            tables += 1
        if text in SKIP_AS_FIELD:
            i += 1
            continue
        if is_title_marker(text):
            i += 1
            continue
        if text.startswith("أنشئ وخصص"):
            i += 1
            continue
        # label-like: short-ish Arabic line, not a long paragraph
        if 1 <= len(text) <= 60 and not text.endswith(".") and "\n" not in text:
            # likely a field if next line exists and is a value or empty-ish, OR ends with space in source
            looks_label = (
                text.endswith(" ")
                or text.endswith("*")
                or text in FIELD_HINTS
                or re.match(r"^[\u0600-\u06FFA-Za-z0-9 /_()\-–—]+$", text)
            )
            if looks_label and not re.match(r"^\d+[\.\)]", text):
                # avoid counting long narrative bullets as fields if very sentence-like
                if "،" in text and len(text) > 40:
                    i += 1
                    continue
                cleaned = text.rstrip(" *")
                if cleaned and cleaned not in field_labels:
                    field_labels.append(cleaned)
        i += 1
    # tables: also count repeated numbered blocks like "أسئلة التدقيق 1"
    numbered = sum(1 for line in block if re.search(r"(١|1)\s*$", line.strip()) and len(line.strip()) < 40)
    if numbered >= 2 and tables == 0:
        # approximate dynamic lists
        tables = 1
    return len(field_labels), tables


def extract_inventory(lines: list[str]) -> list[dict]:
    markers: list[dict] = []
    for idx, line in enumerate(lines):
        hit = is_title_marker(line)
        if not hit:
            continue
        marker, hint = hit
        title_idx, title = next_nonempty(lines, idx + 1)
        if not title:
            continue
        markers.append(
            {
                "line": idx + 1,
                "title_line": title_idx + 1,
                "title": title,
                "marker": marker,
                "marker_hint": hint,
                "source": "عنوان_صريح",
            }
        )

    # standalone titles before "أنشئ وخصص"
    for idx, line in enumerate(lines):
        if not line.strip().startswith("أنشئ وخصص"):
            continue
        prev = ""
        prev_line = 0
        for j in range(idx - 1, -1, -1):
            if lines[j].strip():
                prev = lines[j].strip()
                prev_line = j + 1
                break
        if not prev:
            continue
        # skip if this title already captured nearby
        if any(abs(m["line"] - prev_line) <= 2 or m["title"] == prev for m in markers):
            continue
        markers.append(
            {
                "line": prev_line,
                "title_line": prev_line,
                "title": prev,
                "marker": "عنوان_مستنتج_أنشئ_وخصص",
                "marker_hint": "",
                "source": "مستنتج_من_وصف_إنشاء",
            }
        )

    # opening block if first non-empty isn't in markers
    first_idx, first = next_nonempty(lines, 0)
    if first and not any(m["title"] == first for m in markers):
        markers.append(
            {
                "line": first_idx + 1,
                "title_line": first_idx + 1,
                "title": first,
                "marker": "عنوان_افتتاحي",
                "marker_hint": "نموذج",
                "source": "مستنتج_افتتاح_الملف",
            }
        )

    markers.sort(key=lambda item: item["line"])

    # dedupe exact consecutive same title at same line neighborhood
    cleaned: list[dict] = []
    for item in markers:
        if cleaned and cleaned[-1]["title"] == item["title"] and abs(cleaned[-1]["line"] - item["line"]) <= 3:
            # keep explicit marker over inferred
            if item["source"] == "عنوان_صريح" and cleaned[-1]["source"] != "عنوان_صريح":
                cleaned[-1] = item
            continue
        cleaned.append(item)

    rows: list[dict] = []
    for i, item in enumerate(cleaned):
        start = item["line"] - 1
        end = (cleaned[i + 1]["line"] - 1) if i + 1 < len(cleaned) else len(lines)
        block = lines[start:end]
        fields, tables = count_fields_and_tables(block)
        title = item["title"]
        rows.append(
            {
                "رقم": i + 1,
                "العنوان": title,
                "النوع": classify_type(title, item["marker_hint"]),
                "القسم": classify_section(title),
                "عدد_الحقول": fields,
                "عدد_الجداول_الداخلية": tables,
                "سطر_البداية": item["line"],
                "سطر_العنوان": item["title_line"],
                "مصدر_العنوان": item["source"],
                "علامة_العنوان": item["marker"],
                "طول_المقطع_أسطر": end - start,
            }
        )
    return rows


def write_csv(rows: list[dict], path: Path) -> None:
    fields = [
        "رقم",
        "العنوان",
        "النوع",
        "القسم",
        "عدد_الحقول",
        "عدد_الجداول_الداخلية",
        "سطر_البداية",
        "سطر_العنوان",
        "مصدر_العنوان",
        "علامة_العنوان",
        "طول_المقطع_أسطر",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def write_report(rows: list[dict], path: Path, source: Path) -> None:
    by_type = Counter(r["النوع"] for r in rows)
    by_section = Counter(r["القسم"] for r in rows)
    by_source = Counter(r["مصدر_العنوان"] for r in rows)
    explicit = sum(1 for r in rows if r["مصدر_العنوان"] == "عنوان_صريح")
    total_lines = sum(1 for _ in source.open(encoding="utf-8", errors="replace"))
    # verify source line count from earlier read
    text = source.read_text(encoding="utf-8", errors="replace")
    total_lines = len(text.splitlines())
    source_size = source.stat().st_size

    lines = [
        "# 01_inventory — الجرد الكامل",
        "## الغرض:",
        "حصر كل نموذج/سجل/تقرير/استمارة/خطة/محضر/كشف/قرار ظاهر في أرشيف البرامج والتقارير والسجلات والمحاضر، دون حذف أو دمج.",
        "## المصدر:",
        f"`{source}`",
        f"حجم الملف: {source_size} بايت — عدد الأسطر: {total_lines}",
        "## التاريخ:",
        datetime.now().strftime("%Y-%m-%d %H:%M"),
        "## المسؤول:",
        "مهندس المنظومة (خوارزمية الجرد 1)",
        "## الحالة: مسودة/مراجعة",
        "",
        "## ملخص تنفيذي",
        f"- إجمالي العناصر المجردة: **{len(rows)}**",
        f"- منها بعناوين صريحة (`عنوان …`): **{explicit}**",
        f"- مستنتجة (افتتاح الملف / وصف «أنشئ وخصص»): **{len(rows) - explicit}**",
        "",
        "## إحصائية حسب النوع",
        "",
        "| النوع | العدد |",
        "|---|---:|",
    ]
    for kind, count in by_type.most_common():
        lines.append(f"| {kind} | {count} |")
    lines += [
        "",
        "## إحصائية حسب القسم (تصنيف أولي بالكلمات المفتاحية)",
        "",
        "> ملاحظة منهجية: التصنيف القسمي هنا **استنتاجي أولي** من العنوان فقط، وليس من دليل تنظيمي. يُراجع في خوارزميات لاحقة.",
        "",
        "| القسم | العدد |",
        "|---|---:|",
    ]
    for section, count in by_section.most_common():
        lines.append(f"| {section} | {count} |")
    lines += [
        "",
        "## مصدر اكتشاف العنوان",
        "",
        "| المصدر | العدد |",
        "|---|---:|",
    ]
    for src, count in by_source.most_common():
        lines.append(f"| {src} | {count} |")
    lines += [
        "",
        "## منهجية الاستخراج (قابلة لإعادة الإنتاج)",
        "1. قراءة الملف سطراً بسطر بترميز UTF-8.",
        "2. اعتبار أي سطر يبدأ بـ: عنوان التقرير / السجل / الخطة / الكشف / الاستمارة / النموذج / القرار / المحضر علامة بداية عنصر.",
        "3. أخذ أول سطر غير فارغ بعد العلامة كعنوان العنصر.",
        "4. إضافة العناوين التي تسبق مباشرة جملة «أنشئ وخصص…» إن لم تُلتقط سابقاً.",
        "5. إضافة عنوان افتتاح الملف إن لم يكن ضمن القائمة.",
        "6. حدود المقطع: من سطر بداية العنصر حتى بداية العنصر التالي.",
        "7. عدّ الحقول: تسميات قصيرة محتملة داخل المقطع (تقريبي قابل للمراجعة).",
        "8. عدّ الجداول الداخلية: ظهور «إضافة صف» أو ما يكافئه داخل المقطع.",
        "9. **لا حذف ولا دمج** في هذه المرحلة.",
        "",
        "## حدود الجرد الحالي (شفافية)",
        "- بعض النماذج قد تظهر أكثر من مرة بنفس العنوان (تكرار لاحق لخوارزمية 2) — تُحسب هنا كصفوف مستقلة إذا ظهرت في مواضع مختلفة.",
        "- عدّ الحقول تقريبي؛ الحقول داخل جداول متكررة قد تُحسب مرة أو تُبالغ حسب البنية.",
        "- القسم «غير مصنّف بعد» يحتاج مراجعة بشرية أو قواعد أدق لاحقاً.",
        "- الصور المرفقة من edu-forms داعمة للفهم وليست جزءاً من ملف النص؛ الجرد مبني على الملف النصي فقط.",
        "",
        "## عيّنة من أول 15 عنصراً",
        "",
        "| رقم | العنوان | النوع | القسم | حقول | جداول | سطر |",
        "|---:|---|---|---|---:|---:|---:|",
    ]
    for row in rows[:15]:
        lines.append(
            f"| {row['رقم']} | {row['العنوان']} | {row['النوع']} | {row['القسم']} | "
            f"{row['عدد_الحقول']} | {row['عدد_الجداول_الداخلية']} | {row['سطر_البداية']} |"
        )
    lines += [
        "",
        "## عيّنة من آخر 10 عناصر",
        "",
        "| رقم | العنوان | النوع | القسم | سطر |",
        "|---:|---|---|---|---:|",
    ]
    for row in rows[-10:]:
        lines.append(
            f"| {row['رقم']} | {row['العنوان']} | {row['النوع']} | {row['القسم']} | {row['سطر_البداية']} |"
        )
    lines += [
        "",
        "## أسئلة معلّقة (للمراجعة قبل الخوارزمية 2)",
        "1. هل نعتبر قوالب الغلاف/الفهرس/الفواصل «نماذج تشغيلية» أم «قوالب وثائقية مساعدة» في الإحصاء النهائي؟",
        "2. هل نُبقي كل مبادرة موضوعية صفاً مستقلاً (نعم حسب القاعدة الذهبية حالياً) أم نؤجل توحيدها لخوارزمية 9 فقط؟",
        "3. هل يوجد أرشيف إضافي غير هذا الملف يجب ضمّه قبل خوارزمية التكرار؟",
        "",
        "## الملفات",
        f"- الجدول: `{CSV_PATH.name}`",
        f"- التقرير: `{REPORT_PATH.name}`",
        "",
        "## قرار التوقف",
        "انتهت الخوارزمية 1 فقط. لا تنفيذ لخوارزمية كشف التكرار قبل اعتماد هذا الجرد.",
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    lines = SOURCE.read_text(encoding="utf-8", errors="replace").splitlines()
    rows = extract_inventory(lines)
    write_csv(rows, CSV_PATH)
    write_report(rows, REPORT_PATH, SOURCE)
    print(f"rows={len(rows)}")
    print(f"csv={CSV_PATH}")
    print(f"report={REPORT_PATH}")
    print("by_type=", dict(Counter(r["النوع"] for r in rows)))


if __name__ == "__main__":
    main()
