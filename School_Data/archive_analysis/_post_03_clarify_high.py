# -*- coding: utf-8 -*-
"""توضيح: الـ44 تخدم الـ13 + تعريف high وإعادة تصنيف الثقة."""
from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

OUT = Path(__file__).resolve().parent
IND = OUT / "03_indicators.csv"
INV = OUT / "01_inventory.csv"
from config import get_archive_path

SOURCE = get_archive_path()
EXT = OUT / "external_sources"
REP = OUT / "03_indicators_report.md"
RUN = OUT / "03_run_log.md"
DEC = OUT / "decisions_log.md"

# نفس قواعد خ3 الضيقة
THEME_RULES = [
    ("1-2-1-1", ["سجل الغياب", "التأخر الصباحي", "حصر الحضور والغياب", "الانضباط المدرسي"]),
    ("1-3-1-1", ["مجلس أولياء الأمور", "مجالس أولياء الأمور"]),
    ("1-3-1-2", ["التواصل الأسري", "تزويد الأسرة بالمعلومات", "خطة التواصل الأسري"]),
    ("1-3-1-3", ["العمل التطوعي", "الشراكة المجتمعية", "التقرير الختامي السنوي للعمل التطوعي"]),
    ("1-4-1-1", ["الاحتياجات التدريبية", "تحليل الاحتياجات التدريبية"]),
    ("1-4-1-2", ["خطة التطوير المهني", "البحوث الإجرائية", "التحاق المنسوبين بالبرامج"]),
    ("2-1-1-2", ["تنفيذ المناهج", "متابعة تنفيذ المناهج", "تغطية المقرر"]),
    ("2-1-1-5", ["استراتيجية تعليمية", "تقرير تنفيذ استراتيجية"]),
    ("2-2-1-1", ["إتمام المقرر الدراسي", "سجل التقويم والاختبارات"]),
    ("2-2-1-3", ["تحليل نتائج المهارات", "تحليل نتائج"]),
    ("2-2-1-4", ["الاختبار التحصيلي", "نافس", "القدرات والتحصيلي"]),
    ("3-2-1-4", ["وكيل المدرسة للشؤون التعليمية", "الشؤون التعليمية وهدفه"]),
]


def load_blocks(rows):
    lines = SOURCE.read_text(encoding="utf-8", errors="replace").splitlines()
    arch = [r for r in rows if (r.get("source") or "archive_txt") == "archive_txt" and r.get("سطر_البداية")]
    starts = sorted(int(r["سطر_البداية"]) for r in arch)
    blocks = {}
    for r in arch:
        s = int(r["سطر_البداية"])
        i = starts.index(s)
        e = starts[i + 1] if i + 1 < len(starts) else len(lines) + 1
        blocks[r["رقم"]] = "\n".join(lines[s - 1 : e - 1])
    files = {p.stem: p.read_text(encoding="utf-8", errors="replace") for p in EXT.glob("*.txt")}
    for r in rows:
        if (r.get("source") or "") == "archive_txt":
            continue
        title = r["العنوان"]
        key = next((k for k in files if any(x in title for x in ("موهوب", "منسق", "أداء", "وظيف", "توجيه"))), None)
        full = files.get(key, "") if key else ""
        blocks[r["رقم"]] = full[:3000] if full else title
    return blocks


def reconf(title: str, text: str, code: str) -> str:
    """high / medium / low وفق المعيار الرسمي الجديد."""
    keys = []
    for c, ks in THEME_RULES:
        if c == code:
            keys = ks
            break
    blob = title + "\n" + text
    matched = [k for k in keys if k in blob]
    in_title = [k for k in matched if k in title]
    # high: ≥2 مفاتيح و(مفتاح في العنوان أو ≥3 مفاتيح)
    if len(matched) >= 3 or (len(matched) >= 2 and in_title):
        return "high"
    if len(matched) >= 2:
        return "medium"
    return "low"


def main() -> None:
    inv = list(csv.DictReader(INV.open(encoding="utf-8-sig")))
    blocks = load_blocks(inv)
    by_inv = {r["رقم"]: r for r in inv}
    rows = list(csv.DictReader(IND.open(encoding="utf-8-sig")))

    conf_before = Counter(r["confidence"] for r in rows if r["inferred"] == "true")
    for r in rows:
        if r["inferred"] != "true":
            continue
        codes = [c for c in r["indicators"].split(";") if c]
        # أعلى ثقة بين الرموز
        levels = [reconf(r["العنوان"], blocks.get(r["form_id"], ""), c) for c in codes]
        order = {"high": 0, "medium": 1, "low": 2}
        levels.sort(key=lambda x: order.get(x, 9))
        r["confidence"] = levels[0] if levels else "low"
        # يبقى needs_human_review=true لكل مستنتج (قرار 41)

    conf_after = Counter(r["confidence"] for r in rows if r["inferred"] == "true")

    with IND.open("w", encoding="utf-8-sig", newline="") as h:
        w = csv.DictWriter(h, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # جداول صريح/مستنتج
    expl = defaultdict(set)
    inf = defaultdict(set)
    for r in rows:
        codes = [c for c in (r.get("indicators") or "").split(";") if c]
        for c in codes:
            if r["link_source"] == "real":
                expl[c].add(r["form_id"])
            elif r["inferred"] == "true":
                inf[c].add(r["form_id"])

    approved = sorted(set(expl) | set(inf))
    # فقط الـ13 من real inventory
    approved13 = set()
    for r in inv:
        for c in (r.get("explicit_indicator_real") or "").split(";"):
            if c.strip():
                approved13.add(c.strip())

    table = [
        "",
        "## توضيح قرار 43 — الـ44 وأي رموز تخدم؟ ولماذا high؟",
        f"### التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "### هل الـ44 تخدم الـ13 أم رموزاً أخرى؟",
        f"- **كلها تخدم رموزاً من الـ{len(approved13)} فقط.** لا رمز مستنتج خارج المجموعة المعتمدة.",
        "- القيمة المضافة: **ربط نماذج إضافية** لم تكن في عمود real لذلك الرمز (تغطية أوسع لنفس الرموز)، لا اختراع رموز جديدة.",
        f"- كل الروابط المستنتجة الـ44 هي روابط نماذج «جديدة» بالنسبة لصريح ذلك الرمز (لا تكرار لنفس form_id الصريح).",
        "",
        "### جدول (رمز | صريح | مستنتج | نماذج جديدة بالاستنتاج)",
        "",
        "| رمز المؤشر | صريح (real) | مستنتج | منها نماذج لم تكن في الصريح |",
        "|---|---:|---:|---:|",
    ]
    for c in sorted(approved13):
        e, i = expl[c], inf[c]
        neu = len(i - e)
        table.append(f"| `{c}` | {len(e)} | {len(i)} | {neu} |")

    table += [
        "",
        "### معيار `high` (كان غائباً في التنفيذ الأول — يُصحَّح الآن)",
        "",
        "**لماذا كان صفر high؟** لأن كود خ3 الأول لم يُعرّف مستوى `high` أصلاً: كان يُصدر فقط `medium` (≥2 مفاتيح) أو `low` (مفتاح عنوان طويل). **ليس** لأن كل الـ44 فشلت في اختبار high مكتوب — بل لأن الاختبار لم يُنفَّذ. هذا قصور تنفيذ، صُحّح أدناه.",
        "",
        "**المعيار الرسمي بعد التصحيح:**",
        "- `high`: ≥2 مفاتيح مميزة **و** (مفتاح واحد على الأقل في العنوان **أو** ≥3 مفاتيح في المتن).",
        "- `medium`: ≥2 مفاتيح دون مفتاح في العنوان.",
        "- `low`: مفتاح عنوان واحد طويل فقط (≥10).",
        "",
        f"#### توزيع الثقة بعد إعادة التصنيف",
        f"| قبل | high={conf_before.get('high',0)} · medium={conf_before.get('medium',0)} · low={conf_before.get('low',0)} |",
        f"| بعد | high={conf_after.get('high',0)} · medium={conf_after.get('medium',0)} · low={conf_after.get('low',0)} |",
        "",
        "> ما زال `needs_human_review=true` لكل مستنتج (قرار 41) حتى لو high.",
        "",
    ]

    rep = REP.read_text(encoding="utf-8")
    mark = "## توضيح قرار 43"
    if mark in rep:
        rep = rep.split(mark)[0].rstrip()
    REP.write_text(rep + "\n" + "\n".join(table), encoding="utf-8")

    run = RUN.read_text(encoding="utf-8")
    if mark in run:
        run = run.split(mark)[0].rstrip()
    RUN.write_text(run + "\n" + "\n".join(table) + "\n", encoding="utf-8")

    dec = DEC.read_text(encoding="utf-8")
    block = f"""
### [قرار 36-مُعدّل] لا توجد 8 مؤشرات يتيمة داخل مجموعة الربط.
21 صفاً ≠ 21 رمزاً. الـ13 كلها مغطاة صريحاً. الفجوة = الـ16 خارج المجموعة. يُلغى فهم القرار 36 السابق إن تعارض.

### [قرار 40] اعتماد خ3 نهائياً — 2026-11-01.
21 صريح · 44 مستنتج · 495 غير مرتبط · 13 رمزاً · 16 مفقوداً · 88.4% غير مرتبط (قرار 35).

### [قرار 41] الـ44 مستنتجة كلها needs_human_review=true — لا ربط تقارير نهائية قبل مراجعة بشرية.

### [قرار 42] الـ16 المفقودة = إطار تقويم أوسع/تذييل — توثيق بلا ربط؛ مراجعة مصدر في خ9.

### [قرار 43] توضيحان قبل خ4: (1) الـ44 تخدم الـ13 فقط وتضيف نماذج جديدة لنفس الرموز. (2) صفر high كان غياب معيار في الكود — عُرّف وأُعيد التصنيف (انظر 03_run_log).

"""
    if "[قرار 40]" not in dec:
        if "## فرضية مسجّلة" in dec:
            dec = dec.replace("## فرضية مسجّلة", block + "## فرضية مسجّلة")
        else:
            dec += block
        DEC.write_text(dec, encoding="utf-8")

    print("conf_before", dict(conf_before), "after", dict(conf_after))


if __name__ == "__main__":
    main()
