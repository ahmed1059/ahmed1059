# -*- coding: utf-8 -*-
"""
أمر اعتماد الخوارزمية 1:
1) عمودا المؤشرات real/raw
2) ضمّ 3 ملفات Word/Doc
3) تحديث التقرير والمانيفست
"""
from __future__ import annotations

import csv
import importlib.util
import re
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime
from pathlib import Path

OUT = Path(__file__).resolve().parent
CSV_PATH = OUT / "01_inventory.csv"
REPORT_PATH = OUT / "01_inventory_report.md"
EXTERNAL_DIR = OUT / "external_sources"
EXTERNAL_DIR.mkdir(exist_ok=True)

spec = importlib.util.spec_from_file_location("en", OUT / "_enrich_01_inventory.py")
en = importlib.util.module_from_spec(spec)
spec.loader.exec_module(en)

FOOTER_MARKERS = (
    "شواهد التقويم المدرسي",
    "في التقويم المدرسي",
)
IND_RE = en.INDICATOR_RE
W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

EXTERNAL_FILES = [
    {
        "path": Path(
            r"C:\Users\Toshiba\Desktop\سجل (منسق الموهوبين) في مدارس (التعليم العام) - العام الدراسي (1447 هـ - 2025 م) - أ- ماجد الغامدي.docx"
        ),
        "source_tag": "external_docx",
        "default_kind": "سجل",
    },
    {
        "path": Path(r"C:\Users\Toshiba\Desktop\نموذج الأداء الوظيفي معلم.docx"),
        "source_tag": "external_docx",
        "default_kind": "نموذج",
    },
    {
        "path": Path(r"C:\Users\Toshiba\Desktop\خطة الارشاد\خطة-التوجيه-الطلابي-لعام-1447.doc"),
        "source_tag": "external_doc",
        "default_kind": "خطة",
    },
]

XLSX_DEFERRED = (
    "توثيق شواهد التقويم والاعتماد المدرسي - متوسطة سعد بن الربيع الأنصاري (الردود).xlsx"
)


def extract_docx(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        root = ET.fromstring(zf.read("word/document.xml"))
    parts: list[str] = []
    for node in root.iter():
        if node.tag == W_NS + "t" and node.text:
            parts.append(node.text)
        if node.tag == W_NS + "tab":
            parts.append("\t")
        if node.tag in (W_NS + "br", W_NS + "cr"):
            parts.append("\n")
        if node.tag == W_NS + "p":
            parts.append("\n")
    text = "".join(parts)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_doc_ole(path: Path) -> str:
    """استخراج تقريبي من .doc ثنائي عبر UTF-16LE مع تنقية عربية."""
    data = path.read_bytes()
    raw = data.decode("utf-16le", errors="ignore")
    cleaned_chars: list[str] = []
    for ch in raw:
        if "\u0600" <= ch <= "\u06ff" or ch in "\n\r\t -–—()[]:./0123456789٠١٢٣٤٥٦٧٨٩":
            cleaned_chars.append(ch)
        elif ch.isascii() and ch.isprintable():
            cleaned_chars.append(ch)
        else:
            cleaned_chars.append("\n")
    text = "".join(cleaned_chars)
    lines = []
    for ln in text.splitlines():
        ln = ln.strip()
        if len(ln) < 2:
            continue
        # تجاهل ضوضاء ثنائية قصيرة بلا أحرف عربية
        ar = sum(1 for c in ln if "\u0600" <= c <= "\u06ff")
        if ar == 0 and len(ln) < 8:
            continue
        if ar == 0 and not any(c.isalpha() for c in ln):
            continue
        lines.append(ln)
    return "\n".join(lines)


def extract_doc_via_word(path: Path) -> str | None:
    """محاولة Word COM عبر PowerShell إن وُجد."""
    ps = f'''
$ErrorActionPreference = "Stop"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {{
  $doc = $word.Documents.Open("{str(path).replace(chr(92), chr(92)+chr(92))}")
  $doc.SaveAs([ref]"{str(EXTERNAL_DIR / (path.stem + "_word.txt")).replace(chr(92), chr(92)+chr(92))}", [ref]2)
  $doc.Close()
}} finally {{
  $word.Quit()
}}
'''
    import subprocess

    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
        out = EXTERNAL_DIR / f"{path.stem}_word.txt"
        if out.exists():
            return out.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None
    return None


def save_external_text(meta: dict) -> Path:
    path: Path = meta["path"]
    if path.suffix.lower() == ".docx":
        text = extract_docx(path)
    else:
        text = extract_doc_via_word(path)
        if not text:
            text = extract_doc_ole(path)
    out = EXTERNAL_DIR / f"{path.stem}.txt"
    # أسماء Windows قد تكون طويلة جداً
    if len(out.name) > 120:
        out = EXTERNAL_DIR / f"{meta['source_tag']}_{abs(hash(path.name)) & 0xfffffff}.txt"
    out.write_text(text, encoding="utf-8")
    meta["text_path"] = out
    meta["text"] = text
    return out


def split_external_items(text: str, default_title: str, default_kind: str) -> list[dict]:
    """تقسيم أولي: عنوان رئيسي + أقسام بعنوان واضح إن وُجدت علامات قوية."""
    lines = [ln.rstrip() for ln in text.splitlines()]
    # علامات أقسام شائعة
    section_re = re.compile(
        r"^(?:أولاً|ثانياً|ثالثاً|رابعاً|خامساً|سادساً|سابعاً|ثامناً|تاسعاً|عاشراً|"
        r"الباب\s+\S+|الفصل\s+\S+|المبحث\s+\S+|سجل\s+\S+|نموذج\s+\S+|خطة\s+\S+|"
        r"محضر\s+\S+|تقرير\s+\S+)(?:.*)$"
    )
    # إن كان الملف قصيراً أو بلا أقسام واضحة → عنصر واحد
    starts = [0]
    for i, ln in enumerate(lines):
        s = ln.strip()
        if i < 3:
            continue
        if section_re.match(s) and len(s) <= 80:
            # لا تكرار متقارب
            if i - starts[-1] >= 15:
                starts.append(i)
    # سقف: لا نفرط في التقسيم قبل خ2
    if len(starts) > 12:
        starts = starts[:12]
    items = []
    for idx, start in enumerate(starts):
        end = starts[idx + 1] if idx + 1 < len(starts) else len(lines)
        block_lines = lines[start:end]
        block = "\n".join(block_lines).strip()
        if len(block) < 40:
            continue
        title = block_lines[0].strip() if block_lines else default_title
        if len(title) > 90:
            title = title[:90]
        if idx == 0 and not title:
            title = default_title
        if idx == 0:
            title = default_title if len(default_title) > 5 else title
        items.append(
            {
                "title": title if idx > 0 else default_title,
                "kind": default_kind,
                "block": block,
                "lines": len(block_lines),
            }
        )
    if not items:
        items.append(
            {
                "title": default_title,
                "kind": default_kind,
                "block": text.strip(),
                "lines": len(lines),
            }
        )
    return items


def classify_indicator_context(block: str, codes: list[str]) -> str:
    """real | footer | empty"""
    if not codes:
        return "empty"
    hit_lines = [ln.strip() for ln in block.splitlines() if any(c in ln for c in codes)]
    if not hit_lines:
        return "empty"
    only_footer = all(
        any(m in ln for m in FOOTER_MARKERS) or ln.startswith("المؤشر:")
        for ln in hit_lines
    )
    return "footer" if only_footer else "real"


def guess_kind(title: str, fallback: str) -> str:
    mapping = [
        ("محضر", "محضر"),
        ("سجل", "سجل"),
        ("نموذج", "نموذج"),
        ("خطة", "خطة"),
        ("تقرير", "تقرير"),
        ("استمارة", "استمارة"),
        ("استبانة", "استبانة"),
        ("قرار", "قرار"),
        ("خطاب", "خطاب"),
        ("كشف", "كشف"),
        ("بطاقة", "بطاقة"),
    ]
    for key, kind in mapping:
        if key in title:
            return kind
    return fallback or "غير مصنّف بعد"


def load_rows() -> list[dict]:
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def rebuild_primary_indicators(rows: list[dict]) -> list[dict]:
    lines = en.SOURCE.read_text(encoding="utf-8", errors="replace").splitlines()
    archive_rows = [
        r
        for r in rows
        if (r.get("source") or "archive_txt") == "archive_txt" and str(r.get("سطر_البداية") or "").strip()
    ]
    blocks = en.blocks_by_start(lines, archive_rows)
    out = []
    for row in rows:
        row = dict(row)
        src = row.get("source") or "archive_txt"
        if src != "archive_txt":
            out.append(row)
            continue
        start = int(row["سطر_البداية"])
        block = blocks.get(start, "")
        raw = en.explicit_indicators(block) if row.get("layer") == "operational" else ""
        codes = [c for c in raw.split(";") if c] if raw else []
        ctx = classify_indicator_context(block, codes) if codes else "empty"
        row["explicit_indicator_raw"] = raw
        row["explicit_indicator_real"] = raw if ctx == "real" else ""
        # قرار تقني: explicit_indicator = real فقط (للاستخدام في خ3)
        row["explicit_indicator"] = row["explicit_indicator_real"]
        row["source"] = "archive_txt"
        out.append(row)
    return out


def append_external(rows: list[dict]) -> tuple[list[dict], dict]:
    stats = {"files": 0, "items": 0, "per_file": {}}
    next_num = max(int(r["رقم"]) for r in rows) + 1
    for meta in EXTERNAL_FILES:
        save_external_text(meta)
        default_title = meta["path"].stem
        # عناوين أوضح
        name = meta["path"].name
        if "موهوبين" in name:
            default_title = "سجل منسق الموهوبين (مصدر خارجي 1447)"
        elif "الأداء الوظيفي" in name:
            default_title = "نموذج الأداء الوظيفي معلم (مصدر خارجي)"
        elif "التوجيه" in name or "الارشاد" in str(meta["path"]):
            default_title = "خطة التوجيه الطلابي لعام 1447 (مصدر خارجي)"
        items = split_external_items(meta["text"], default_title, meta["default_kind"])
        stats["files"] += 1
        stats["per_file"][meta["path"].name] = len(items)
        for item in items:
            kind = guess_kind(item["title"], meta["default_kind"])
            fillable = en.classify_fillable(item["block"], kind=kind)
            raw = en.explicit_indicators(item["block"])
            codes = [c for c in raw.split(";") if c] if raw else []
            ctx = classify_indicator_context(item["block"], codes) if codes else "empty"
            real = raw if ctx == "real" else ""
            rows.append(
                {
                    "رقم": str(next_num),
                    "العنوان": item["title"],
                    "النوع": kind,
                    "القسم": "غير مصنّف بعد",
                    "عدد_الحقول": "",
                    "عدد_الجداول_الداخلية": "",
                    "layer": "operational",
                    "fillable": fillable,
                    "explicit_indicator": real,
                    "explicit_indicator_real": real,
                    "explicit_indicator_raw": raw,
                    "سطر_البداية": "",
                    "سطر_العنوان": "",
                    "مصدر_العنوان": "external_import",
                    "علامة_العنوان": "",
                    "طول_المقطع_أسطر": str(item["lines"]),
                    "source": meta["source_tag"],
                }
            )
            next_num += 1
            stats["items"] += 1
    return rows, stats


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
        "explicit_indicator_real",
        "explicit_indicator_raw",
        "source",
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


def write_report(rows: list[dict], ext_stats: dict) -> None:
    by_type = Counter(r["النوع"] for r in rows)
    by_layer = Counter(r["layer"] for r in rows)
    by_fill = Counter(r["fillable"] for r in rows)
    by_src = Counter(r.get("source") or "archive_txt" for r in rows)
    real_n = sum(1 for r in rows if str(r.get("explicit_indicator_real") or "").strip())
    raw_n = sum(1 for r in rows if str(r.get("explicit_indicator_raw") or "").strip())
    lines = [
        "# 01_inventory — الجرد الكامل (بعد الاعتماد الرسمي للخوارزمية 1)",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "## الحالة: معتمد رسمياً (قرار 5) — خ2 موقوفة حتى إغلاق اتجاه التصميم",
        "",
        "## الخط الأساس",
        "- المرجع التاريخي المعتمد: **543** (أرشيف txt فقط)",
        f"- الخط الأساس الحالي بعد ضمّ المصادر الخارجية: **{len(rows)}**",
        f"- operational: **{by_layer.get('operational', 0)}**",
        f"- presentation: **{by_layer.get('presentation', 0)}**",
        "",
        "### المصادر",
        "",
        "| source | العدد |",
        "|---|---:|",
    ]
    for k, v in by_src.most_common():
        lines.append(f"| {k} | {v} |")
    lines += [
        "",
        f"### ضمّ خارجي (أمر 3): ملفات={ext_stats['files']} · عناصر مستخرجة={ext_stats['items']}",
    ]
    for name, n in ext_stats.get("per_file", {}).items():
        lines.append(f"- `{name}` → {n} عنصر/عناصر")
    lines += [
        "",
        "### fillable",
        "",
        "| القيمة | العدد |",
        "|---|---:|",
        f"| template | {by_fill.get('template', 0)} |",
        f"| filled | {by_fill.get('filled', 0)} |",
        f"| unknown | {by_fill.get('unknown', 0)} |",
        "",
        "### المؤشرات",
        f"- `explicit_indicator_real` (صفوف غير فارغة): **{real_n}**",
        f"- `explicit_indicator_raw` (صفوف غير فارغة): **{raw_n}**",
        "- قرار تقني: `explicit_indicator` = نسخة من `explicit_indicator_real` (للاستخدام في خ3).",
        "",
        "## إحصائية النوع (أولية)",
        "",
        "| النوع | العدد |",
        "|---|---:|",
    ]
    for kind, count in by_type.most_common():
        lines.append(f"| {kind} | {count} |")
    lines += [
        "",
        "## قرارات مرتبطة",
        "انظر `decisions_log.md` قرارات 5–10.",
        "",
        "## قرار التوقف",
        "لا بدء للخوارزمية 2 قبل إغلاق اتجاه التصميم (قرار 9).",
    ]
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        "BASELINE",
        len(rows),
        "real",
        real_n,
        "raw",
        raw_n,
        "fill",
        dict(by_fill),
        "ext",
        ext_stats,
    )


def main() -> None:
    rows = load_rows()
    # صفوف قديمة بلا source
    for r in rows:
        r.setdefault("source", "archive_txt")
        r["source"] = r.get("source") or "archive_txt"
    # أزل أي ضمّ خارجي سابق من تشغيل تجريبي
    rows = [r for r in rows if (r.get("source") or "archive_txt") == "archive_txt"]
    rows = rebuild_primary_indicators(rows)
    rows, ext_stats = append_external(rows)
    # إعادة ترقيم متسلسلة
    for i, r in enumerate(rows, 1):
        r["رقم"] = str(i)
    write_csv(rows)
    write_report(rows, ext_stats)


if __name__ == "__main__":
    main()
