# -*- coding: utf-8 -*-
"""المرحلة ب — توسيع الهوية (قرار 88). بلا اختراع أسماء · بلا خ6/خ7."""
from __future__ import annotations

import csv
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

import openpyxl

from config import FORMATIONS_PATH, OUTPUT_DIR, SCHOOL_DATA_DIR

OUT_CSV = OUTPUT_DIR / "06_identity_expansion.csv"
REPORT = OUTPUT_DIR / "06_identity_report.md"
RUN = OUTPUT_DIR / "06_identity_run_log.md"
EXT_DIR = OUTPUT_DIR / "external_sources"
IMPORTS = SCHOOL_DATA_DIR / "imports"
EXT_SLOTS = OUTPUT_DIR / "04_identity_extension.csv"

ROLE_FROM_FILE = [
    ("مدير", "مدير مدرسة"),
    ("وكيل", "وكيل"),
    ("موجه", "موجه طلابي"),
    ("رائد", "رائد نشاط"),
    ("أمين", "أمين مصادر"),
    ("مختبر", "محضر مختبر"),
    ("أداري", "إداري"),
    ("اداري", "إداري"),
    ("معلم", "معلم"),
]


def norm_name(n: str) -> str:
    n = re.sub(r"\s+", " ", (n or "").strip())
    n = n.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    return n


def looks_like_person(n: str) -> bool:
    n = (n or "").strip()
    if len(n) < 10:
        return False
    if any(k in n for k in ("متوسطة", "مدرسة", "إدارة", "وزارة", "المملكة", "تعليم", "قسم")):
        return False
    parts = n.split()
    if len(parts) < 3:
        return False
    return True


def conf_rank(c: str) -> int:
    return {"high": 3, "medium": 2, "low": 1}.get(c, 0)


def upsert(people: dict, name: str, role: str, source: str, confidence: str, notes: str) -> None:
    if not looks_like_person(name) and confidence != "low":
        # role_slot rows use person_name empty or role text — handled separately
        if confidence != "low":
            return
    key = norm_name(name) if name else f"slot::{norm_name(role)}"
    if key in people:
        cur = people[key]
        if conf_rank(confidence) > conf_rank(cur["confidence"]):
            cur["confidence"] = confidence
            cur["source"] = source
            cur["notes"] = notes
        if role and (cur["role"] in ("", "عضو لجنة", "قيادة/لجنة") or len(role) > len(cur["role"])):
            if confidence != "low" or not cur["role"]:
                cur["role"] = role or cur["role"]
        if source not in cur["sources_all"]:
            cur["sources_all"] += ";" + source
        return
    people[key] = {
        "person_name": name,
        "role": role,
        "source": source,
        "confidence": confidence,
        "notes": notes,
        "sources_all": source,
    }


def from_formations(people: dict) -> int:
    data = json.loads(FORMATIONS_PATH.read_text(encoding="utf-8"))
    n = 0
    labels = {
        "quality": "لجنة التميز",
        "guidance": "لجنة التوجيه",
        "exams": "لجنة التحصيل",
        "resources": "لجنة مصادر التعلم",
    }
    for ck, members in data.items():
        for m in members:
            name = (m.get("name") or "").strip()
            title = (m.get("title") or "").strip()
            if not looks_like_person(name):
                continue
            role = f"{title} — {labels.get(ck, ck)}"
            upsert(
                people,
                name,
                role,
                "committee_formations.json",
                "high",
                f"تشكيلة {ck}: {title}",
            )
            n += 1
    return n


def from_external(people: dict) -> int:
    n = 0
    # 1) اسم ملف منسق الموهوبين
    for p in EXT_DIR.glob("*موهوب*.txt"):
        m = re.search(r"أ[-–—]\s*([\u0600-\u06ff]+(?:\s+[\u0600-\u06ff]+){1,4})", p.name)
        if m:
            name = m.group(1).strip()
            # ماجد الغامدي — اسم مختصر من اسم الملف؛ medium حسب قرار 88
            if len(name.split()) >= 2:
                upsert(
                    people,
                    name if "بن" in name else name,  # قد يكون ثنائياً
                    "منسق موهوبين",
                    f"external_filename:{p.name}",
                    "medium",
                    "مستخرج من اسم ملف سجل منسق الموهوبين — تطبيق جزئي",
                )
                # ثنائي مقبول هنا كاستثناء موثّق من اسم الملف
                if not looks_like_person(name):
                    key = norm_name(name)
                    people[key] = {
                        "person_name": name,
                        "role": "منسق موهوبين",
                        "source": f"external_filename:{p.name}",
                        "confidence": "medium",
                        "notes": "اسم ثنائي من اسم الملف — medium (تطبيق جزئي)",
                        "sources_all": f"external_filename:{p.name}",
                    }
                n += 1
    # 2) نموذج الأداء — الاسم رباعياً
    perf = list(EXT_DIR.glob("*أداء*")) + list(EXT_DIR.glob("*اداء*"))
    for p in EXT_DIR.glob("*.txt"):
        if "أداء" not in p.name and "اداء" not in p.name:
            continue
        lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        for i, ln in enumerate(lines):
            if "الاسم رباعيا" in ln.replace("ً", "") or "الاسم رباعياً" in ln:
                # التالي غير الفارغ
                for j in range(i + 1, min(i + 5, len(lines))):
                    cand = lines[j].strip()
                    if looks_like_person(cand) or (len(cand.split()) >= 3 and cand[0].isalpha()):
                        # احمد علي الشهري — 3 مقاطع بدون بن — اقبل medium
                        if len(cand.split()) >= 3 and not any(k in cand for k in ("تقرير", "سجل", "نموذج")):
                            people[norm_name(cand)] = {
                                "person_name": cand,
                                "role": "معلم (نموذج أداء وظيفي)",
                                "source": f"external:{p.name}",
                                "confidence": "medium",
                                "notes": "حقل الاسم رباعياً في نموذج الأداء الوظيفي — تطبيق جزئي",
                                "sources_all": f"external:{p.name}",
                            }
                            n += 1
                            break
    # 3) لا نستخرج أسماء طلاب/ضوضاء من سجل الموهوبين (حقول الاسم فارغة قالبياً)
    return n


def from_nour(people: dict) -> int:
    if not IMPORTS.exists():
        return 0
    n = 0
    seen_files = 0
    for path in sorted(IMPORTS.glob("teachers-*.xlsx")):
        try:
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            wb.close()
        except Exception:
            continue
        # ابحث صف رأس يحوي اسم الموظف
        name_col = None
        job_col = None
        header_i = None
        for i, r in enumerate(rows[:25]):
            cells = [str(c).strip() if c is not None else "" for c in r]
            if "اسم الموظف" in cells:
                name_col = cells.index("اسم الموظف")
                header_i = i
                if "الوظيفة" in cells:
                    job_col = cells.index("الوظيفة")
                break
        if name_col is None:
            continue
        role_guess = "معلم"
        for key, role in ROLE_FROM_FILE:
            if key in path.name:
                role_guess = role
                break
        added = 0
        for r in rows[header_i + 1 :]:
            if name_col >= len(r) or r[name_col] is None:
                continue
            name = str(r[name_col]).strip()
            if not looks_like_person(name):
                continue
            # تخطّي اختبارات
            # رقم هوية تجريبي إن وُجد بالقرب
            job = role_guess
            if job_col is not None and job_col < len(r) and r[job_col]:
                job = str(r[job_col]).strip() or role_guess
            upsert(
                people,
                name,
                job,
                f"nour:{path.name}",
                "high",
                "اسم موظف من تصدير نور — عمود اسم الموظف",
            )
            added += 1
            n += 1
        if added:
            seen_files += 1
    return n


def from_role_slots(people: dict) -> int:
    if not EXT_SLOTS.exists():
        return 0
    n = 0
    for r in csv.DictReader(EXT_SLOTS.open(encoding="utf-8-sig")):
        role = (r.get("role") or "").strip()
        if not role:
            continue
        # لا تكرار إن وُجد شخص high يغطي الدور جزئياً — نُبقي slot كصف مستقل للشفافية
        key = f"slot::{norm_name(role)}"
        people[key] = {
            "person_name": "",
            "role": role,
            "source": "04_identity_extension.csv",
            "confidence": "low",
            "notes": (r.get("notes") or "role_slot — بلا شاغل اسمي")[:200],
            "sources_all": "04_identity_extension.csv",
        }
        n += 1
    return n


def main() -> None:
    people: dict = {}
    c_form = from_formations(people)
    c_ext = from_external(people)
    c_nour = from_nour(people)
    # role slots بعد الأسماء حتى لا تُستبدل
    before_slots = len(people)
    c_slot = from_role_slots(people)

    rows = []
    named = [(k, v) for k, v in people.items() if not k.startswith("slot::")]
    slots = [(k, v) for k, v in people.items() if k.startswith("slot::")]
    named.sort(key=lambda x: x[1]["person_name"])
    slots.sort(key=lambda x: x[1]["role"])

    i = 1
    for _, v in named + slots:
        rows.append(
            {
                "person_id": f"PERS-{i:03d}",
                "person_name": v["person_name"],
                "role": v["role"],
                "source": v["source"],
                "confidence": v["confidence"],
                "notes": v["notes"],
                "sources_all": v.get("sources_all", v["source"]),
            }
        )
        i += 1

    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as h:
        w = csv.DictWriter(h, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    ctr = Counter(r["confidence"] for r in rows)
    src_ctr = Counter(
        "nour" if r["source"].startswith("nour") else
        "committee_formations" if "committee_formations" in r["source"] else
        "external" if r["source"].startswith("external") else
        "role_slot" if r["confidence"] == "low" and not r["person_name"] else
        "other"
        for r in rows
    )
    named_n = sum(1 for r in rows if r["person_name"])
    slot_n = sum(1 for r in rows if not r["person_name"])

    report = [
        "# 06_identity_report — المرحلة ب (توسيع الهوية)",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "## الحالة: مُسلَّم — قرار 88 · لا اختراع أسماء · لا خ6/خ7 · 565 ثابت",
        "",
        "## المصادر",
        f"- committee_formations: إدخالات معالجة ≈ {c_form} (أسماء فريدة ضمن التشكيلات)",
        f"- external: إدخالات ≈ {c_ext} (medium — تطبيق جزئي)",
        f"- nour (imports/teachers-*.xlsx): إدخالات صفوف ≈ {c_nour}",
        f"- role_slot من 04_identity_extension: {c_slot}",
        "",
        "## الإحصاء",
        f"| الثقة | العدد |",
        f"|---|---:|",
        f"| high | {ctr.get('high', 0)} |",
        f"| medium | {ctr.get('medium', 0)} |",
        f"| low | {ctr.get('low', 0)} |",
        f"| **المجموع** | **{len(rows)}** |",
        "",
        f"- بأسماء: **{named_n}** · role_slot بلا اسم: **{slot_n}**",
        f"- توزيع مصدر تقريبي: {dict(src_ctr)}",
        "",
        "## قرارات الالتزام",
        "- external = medium (قرار التحفظ 2).",
        "- formations / نور الصريح = high.",
        "- role_slot = low — لا اختراع شاغلين.",
        "- `04_identity_extension.csv` لم يُستبدل؛ التوسيع في `06_identity_expansion.csv`.",
        "",
        "## ملاحظات",
        "- نور: أسماء من عمود «اسم الموظف» بعد صف الرأس الحقيقي (كانت خ4 تخطئ بسبب رؤوس فارغة).",
        "- خطة التوجيه النصية: لا أسماء منسوبين صريحة مستخرجة.",
        "- سجل الموهوبين: حقول الاسم فارغة قالبياً؛ الاسم من عنوان الملف فقط (ماجد الغامدي) medium.",
        "",
        "## التالي",
        "- بعد الاعتماد: المرحلة ج (خ9 المبكر) حسب قرار رئيس المشروع.",
        "",
    ]
    REPORT.write_text("\n".join(report), encoding="utf-8")

    run = [
        "# 06_identity_run_log",
        f"## {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "| الوقت | الخطوة | المخرج |",
        "|---|---|---|",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | بدء | قرار 88 |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | formations | ~{c_form} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | external | ~{c_ext} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | nour | ~{c_nour} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | role_slot | {c_slot} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | إجمالي | {len(rows)} · high={ctr.get('high',0)} medium={ctr.get('medium',0)} low={ctr.get('low',0)} |",
        f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | انتهاء | لا خ6/خ7 |",
        "",
    ]
    RUN.write_text("\n".join(run), encoding="utf-8")
    print(len(rows), dict(ctr), dict(src_ctr), "named", named_n)


if __name__ == "__main__":
    main()
