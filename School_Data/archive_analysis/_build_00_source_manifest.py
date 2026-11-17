# -*- coding: utf-8 -*-
"""بناء 00_source_manifest.md — مسح مصادر نصية مرشّحة قبل الخوارزمية 2."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

OUT = Path(__file__).resolve().parent / "00_source_manifest.md"

# جذور المسح (سطح المكتب والمجلدات المجاورة ذات الصلة)
ROOTS = [
    Path(r"C:\Users\Toshiba\Desktop"),
]

EXTS = {".txt", ".md", ".csv", ".json", ".docx", ".doc", ".xlsx", ".xls"}
SKIP_DIR_NAMES = {
    "node_modules",
    ".git",
    "__pycache__",
    "venv",
    ".venv",
    ".cursor",
    "agent-transcripts",
    "terminals",
}


def count_lines(path: Path) -> str:
    if path.suffix.lower() not in {".txt", ".md", ".csv", ".json"}:
        return "—"
    try:
        return str(
            len(path.read_text(encoding="utf-8", errors="replace").splitlines())
        )
    except OSError:
        return "?"


def decide(path: Path) -> tuple[str, str]:
    """قرار: مضمّن / مستثنى / مؤجل + سبب مختصر."""
    name = path.name
    low = name.lower()
    parts = {p.lower() for p in path.parts}
    s = str(path)

    # المصدر الرسمي للجرد 1
    if name.strip() == "البرامج والتقارير والسجلات والمحاضر .txt" or name.startswith(
        "البرامج والتقارير والسجلات والمحاضر"
    ):
        return "مضمّن", "مصدر الخوارزمية 1 الرسمي (543 عنصراً)"

    # صور edu-forms أو مجلدات صور — خارج نطاق النص
    if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        return "مستثنى", "مرجع بصري فقط — لا يدخل كشف التكرار النصي"

    # نفايات/بروتوكول/كود
    if "project_bundle" in low:
        return "مستثنى", "مكبّ كود مشروع — ليس أرشيف نماذج"
    if name.upper() == "9999.TXT" or "9999.txt" in low:
        return "مستثنى", "بروتوكول/محرك داخلي — ليس نماذج تشغيلية"
    if "backup" in s.lower() or "School_Governance_System_1059_backup" in s:
        return "مستثنى", "نسخة احتياطية مكررة للمشروع"
    if "archive_analysis" in parts and path.suffix.lower() in {".csv", ".md", ".py"}:
        if path.name.startswith("01_") or path.name.startswith("00_") or path.name.startswith("_"):
            return "مستثنى", "مخرجات تحليل الجرد نفسها — ليست مصدراً جديداً"
    if path.suffix.lower() == ".json" and "School_Governance_System_1059" in s:
        if "schema" in low or "forms" in s.lower() or "Print_Canvas" in s:
            return "مؤجل", "مخططات نظام حالية — تُراجع لاحقاً للمطابقة لا للجرد الأوّلي"
        return "مستثنى", "بيانات/إعدادات نظام — ليست أرشيف نماذج نصي"

    # وثائق Word على سطح المكتب تبدو نماذج/سجلات
    if path.suffix.lower() in {".docx", ".doc"} and path.parent == Path(
        r"C:\Users\Toshiba\Desktop"
    ):
        return "مؤجل", "مرشّح تحويل نصي قبل الخوارزمية 2 (قرار رئيس المشروع)"

    # Excel نتائج/جداول — ليست نماذج أرشيفية بنفس طبيعة txt
    if path.suffix.lower() in {".xlsx", ".xls"}:
        if "نافس" in name or "تحليل" in name or "Student" in name or "EL_" in name:
            return "مستثنى", "جداول نتائج/بيانات تشغيل — خارج كشف تكرار النماذج"
        if path.parent == Path(r"C:\Users\Toshiba\Desktop") or "توثيق شواهد" in name:
            return "مؤجل", "قد يُستخرج منه هياكل لاحقاً — ليس أولوية قبل خ2"
        return "مستثنى", "جدول بيانات — ليس أرشيف نماذج نصي"

    # md توثيقي داخل المشروع
    if path.suffix.lower() == ".md" and "School_Governance_System_1059" in s:
        return "مستثنى", "توثيق هندسي — ليس أرشيف نماذج"

    # txt أخرى على سطح المكتب
    if path.suffix.lower() == ".txt" and path.parent == Path(r"C:\Users\Toshiba\Desktop"):
        return "مؤجل", "ملف نصي مجاور — يُفحص مضمونه قبل الضمّ"

    # csv داخل imports
    if path.suffix.lower() == ".csv":
        return "مستثنى", "بيانات مستوردة — ليست نماذج أرشيفية"

    return "مؤجل", "مرشّح مراجعة يدوية سريعة قبل خ2"


def scan() -> list[dict]:
    rows: list[dict] = []
    seen: set[str] = set()
    for root in ROOTS:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if any(part in SKIP_DIR_NAMES for part in path.parts):
                continue
            if path.suffix.lower() not in EXTS:
                continue
            key = str(path.resolve()).lower()
            if key in seen:
                continue
            seen.add(key)
            try:
                st = path.stat()
            except OSError:
                continue
            decision, reason = decide(path)
            rows.append(
                {
                    "path": str(path),
                    "size": st.st_size,
                    "lines": count_lines(path),
                    "type": path.suffix.lower().lstrip(".") or "?",
                    "mtime": datetime.fromtimestamp(st.st_mtime).strftime(
                        "%Y-%m-%d %H:%M"
                    ),
                    "decision": decision,
                    "reason": reason,
                }
            )
    rows.sort(key=lambda r: (-r["size"], r["path"]))
    return rows


def main() -> None:
    rows = scan()
    by_dec = {}
    for r in rows:
        by_dec[r["decision"]] = by_dec.get(r["decision"], 0) + 1

    # إبراز المرشّحين المهمّين أولاً في قسم ملخّص
    included = [r for r in rows if r["decision"] == "مضمّن"]
    deferred = [r for r in rows if r["decision"] == "مؤجل"]
    excluded_n = by_dec.get("مستثنى", 0)

    lines = [
        "# 00_source_manifest — بيان مصادر الأرشيف",
        "## الغرض:",
        "حصر الملفات النصية/القابلة للتحويل المرشّحة قبل كشف التكرار (الخوارزمية 2)، مع قرار صريح لكل ملف.",
        "## التاريخ:",
        datetime.now().strftime("%Y-%m-%d %H:%M"),
        "## نطاق المسح:",
        r"`C:\Users\Toshiba\Desktop` (شامل المجلدات الفرعية ذات الصلة)",
        "## الامتدادات:",
        "`.txt` `.md` `.csv` `.json` `.doc` `.docx` `.xls` `.xlsx`",
        "## مستثنى سلفاً من المسح:",
        "الصور والصوت والفيديو؛ ومجلدات `node_modules` / `.git` / النسخ الاحتياطية المكررة تُوسم مستثنى إن ظهرت.",
        "",
        "## ملخص القرارات",
        "",
        "| القرار | العدد |",
        "|---|---:|",
        f"| مضمّن | {by_dec.get('مضمّن', 0)} |",
        f"| مؤجل | {by_dec.get('مؤجل', 0)} |",
        f"| مستثنى | {excluded_n} |",
        f"| **المجموع الممسوح** | **{len(rows)}** |",
        "",
        "## المصادر المضمّنة الآن (خط أساس الجرد)",
        "",
    ]
    for r in included:
        lines.append(
            f"- `{r['path']}` — {r['size']} بايت — {r['lines']} سطر — {r['reason']}"
        )
    if not included:
        lines.append("- (لا يوجد)")

    lines += [
        "",
        "## مرشّحات مؤجّلة (قبل الخوارزمية 2 — تحويل/فحص مضمون)",
        "",
        "| المسار | الحجم | الأسطر | النوع | آخر تعديل | السبب |",
        "|---|---:|---:|---|---|---|",
    ]
    for r in deferred[:80]:
        lines.append(
            f"| `{r['path']}` | {r['size']} | {r['lines']} | {r['type']} | {r['mtime']} | {r['reason']} |"
        )
    if len(deferred) > 80:
        lines.append(f"| … | | | | | و{len(deferred) - 80} ملفاً إضافياً مؤجلاً في الجدول الكامل |")

    lines += [
        "",
        "## الجدول الكامل (كل الملفات الممسوحة)",
        "",
        "| المسار | الحجم | الأسطر | النوع | آخر تعديل | القرار | السبب |",
        "|---|---:|---:|---|---|---|---|",
    ]
    for r in rows:
        lines.append(
            f"| `{r['path']}` | {r['size']} | {r['lines']} | {r['type']} | {r['mtime']} | {r['decision']} | {r['reason']} |"
        )

    lines += [
        "",
        "## أثر على الرقم 543",
        "- حالياً: لا ضمّ إضافي → الخط الأساس يبقى **543** (منها 538 operational + 5 presentation).",
        "- إن اعتمد رئيس المشروع ضمّ ملف مؤجّل بعد التحويل النصي: يُعاد الجرد الجزئي ويُسجَّل الرقم الجديد في `decisions_log.md`.",
        "",
        "## قرار التوقف",
        "لا بدء للخوارزمية 2 قبل إشعار رئيس المشروع واعتماد هذا البيان.",
        "",
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print("wrote", OUT, "rows", len(rows), by_dec)


if __name__ == "__main__":
    main()
