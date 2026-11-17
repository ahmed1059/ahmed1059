# -*- coding: utf-8 -*-
"""الخوارزمية 4 — بطاقات المنسوب×المهمة×اللجان (قرار 51)."""
from __future__ import annotations

import csv
import json
import random
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import openpyxl

from config import FORMATIONS_PATH, OUTPUT_DIR as OUT, SCHOOL_DATA_DIR, get_archive_path

ROOT = SCHOOL_DATA_DIR
FORMATIONS = FORMATIONS_PATH
IMPORTS = ROOT / "imports"
INV = OUT / "01_inventory.csv"
IND = OUT / "03_indicators.csv"
SOURCE = get_archive_path()

RUN = OUT / "04_run_log.md"
CARDS = OUT / "04_person_task_cards.csv"
COMM = OUT / "04_committee_map.csv"
CROSS = OUT / "04_cross_membership.csv"
ORPH_T = OUT / "04_orphan_tasks.csv"
ORPH_P = OUT / "04_orphan_persons.csv"
ORPH_D = OUT / "04_orphan_data.md"
REPORT = OUT / "04_person_task_report.md"
SAMPLE = OUT / "04_sample_15.md"

COMMITTEE_LABELS = {
    "quality": "لجنة التميز / الجودة",
    "guidance": "لجنة التوجيه والإرشاد",
    "exams": "لجنة التحصيل الدراسي / الاختبارات",
    "resources": "لجنة مصادر التعلم",
}

ROLE_FORM_HINTS = [
    ("مدير", ["مدير المدرسة", "اعتماد مدير", "توقيع مدير", "اللجنة الإدارية"]),
    ("وكيل", ["وكيل المدرسة", "وكيل الشؤون", "وكيل"]),
    ("موجه", ["الموجه الطلابي", "التوجيه الطلابي", "موجه"]),
    ("رائد نشاط", ["رائد النشاط", "النشاط الطلابي"]),
    ("أمين مصادر", ["أمين مصادر", "مصادر التعلم"]),
    ("محضر مختبر", ["محضر مختبر", "المختبر"]),
    ("معلم", ["المعلم", "هيئة تعليمية", "خطة علاجية", "استراتيجية تعليمية"]),
]

log_lines: list[str] = []


def log(step: str, detail: str = "") -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_lines.append(f"| {ts} | {step} | {detail.replace('|', '/')} |")
    print(step, (detail or "")[:140])


def flush() -> None:
    RUN.write_text(
        "\n".join(
            [
                "# 04_run_log — سجل تنفيذ الخوارزمية 4",
                f"## بدء: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                "",
                "| الوقت | الخطوة | المخرج |",
                "|---|---|---|",
            ]
            + log_lines
        )
        + "\n",
        encoding="utf-8",
    )


def norm_name(n: str) -> str:
    n = re.sub(r"\s+", " ", (n or "").strip())
    n = n.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    return n


def person_id(name: str) -> str:
    return "p_" + re.sub(r"[^\w\u0600-\u06ff]+", "_", norm_name(name)).strip("_")[:48]


def load_formations() -> dict:
    return json.loads(FORMATIONS.read_text(encoding="utf-8"))


JUNK_NAMES = {
    "ملاحظات",
    "فحص الدمج",
    "اسم الموظف",
    "الاسم",
    "غير محدد",
    "بدون اسم",
}


def looks_like_person_name(name: str) -> bool:
    n = (name or "").strip()
    if len(n) < 8 or n.isdigit() or n in JUNK_NAMES:
        return False
    if any(k in n for k in ("ملاحظات", "فحص", "سجل", "نموذج", "محضر", "تقرير", "تعريف")):
        return False
    # اسم عربي مكتمل غالباً يحوي بن/ابن أو ثلاثة مقاطع
    parts = [p for p in n.split() if p]
    if len(parts) < 2:
        return False
    return True


def load_staff_from_xlsx() -> list[dict]:
    """طبقة هوية من ملفات المعلمين المستوردة (تجاهل فراغ/اختبار)."""
    people = []
    empty_files = 0
    if not IMPORTS.exists():
        return people
    for path in sorted(IMPORTS.glob("teachers-*.xlsx")):
        try:
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            ws = wb.active
            rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None and str(c).strip() for c in r)]
            if len(rows) < 2:
                empty_files += 1
                wb.close()
                continue
            header = [str(c or "").strip() for c in rows[0]]
            name_i = next((i for i, h in enumerate(header) if "اسم" in h or "name" in h.lower()), None)
            job_i = next(
                (
                    i
                    for i, h in enumerate(header)
                    if any(k in h for k in ("مسمى", "وظيفة", "المرتبة", "عمل", "job", "Job", "تخصص"))
                ),
                None,
            )
            id_i = next(
                (i for i, h in enumerate(header) if "هوية" in h or "رقم" in h),
                None,
            )
            if name_i is None:
                name_i = 0
            role_guess = "معلم"
            if "أداري" in path.name or "اداري" in path.name:
                role_guess = "إداري"
            elif "موجه" in path.name:
                role_guess = "موجه"
            elif "رائد" in path.name:
                role_guess = "رائد نشاط"
            elif "أمين" in path.name or "مصادر" in path.name:
                role_guess = "أمين مصادر"
            elif "مختبر" in path.name:
                role_guess = "محضر مختبر"
            elif "مدير" in path.name:
                role_guess = "مدير"
            elif "معلم" in path.name:
                role_guess = "معلم"
            added = 0
            for row in rows[1:]:
                if not row or name_i >= len(row):
                    continue
                name = str(row[name_i] or "").strip()
                if not looks_like_person_name(name):
                    continue
                # تخطّي هويات الاختبار الشائعة
                if id_i is not None and id_i < len(row) and row[id_i]:
                    nid = str(row[id_i]).strip()
                    if nid.startswith("900") or nid in ("0", "1234567890"):
                        continue
                job = ""
                if job_i is not None and job_i < len(row) and row[job_i]:
                    job = str(row[job_i]).strip()
                people.append(
                    {
                        "name": name,
                        "role": job or role_guess,
                        "source": f"imports/{path.name}",
                    }
                )
                added += 1
            if added == 0:
                empty_files += 1
            wb.close()
        except Exception as ex:
            log("تحذير xlsx", f"{path.name}: {ex}")
    log("xlsx فارغة/اختبار", f"files_skipped_or_empty≈{empty_files}")
    return people


def extract_role_tasks_from_archive(inv_rows: list[dict], lines: list[str]) -> dict[str, list[dict]]:
    """مهام من نماذج «تعريف … ومهامه»."""
    starts = sorted(
        int(r["سطر_البداية"])
        for r in inv_rows
        if (r.get("source") or "archive_txt") == "archive_txt" and r.get("سطر_البداية")
    )
    by_role: dict[str, list[dict]] = defaultdict(list)
    for r in inv_rows:
        title = r.get("العنوان") or ""
        if "تعريف" not in title or "مهام" not in title:
            continue
        if not r.get("سطر_البداية"):
            continue
        start = int(r["سطر_البداية"])
        i = starts.index(start)
        end = starts[i + 1] if i + 1 < len(starts) else len(lines) + 1
        block = "\n".join(lines[start - 1 : min(end - 1, start + 80)])
        role = "أخرى"
        if "مدير" in title:
            role = "مدير"
        elif "وكيل" in title and "تعليم" in title:
            role = "وكيل تعليمية"
        elif "وكيل" in title and "طلاب" in title:
            role = "وكيل طلاب"
        elif "وكيل" in title and "مدرس" in title:
            role = "وكيل مدرسة"
        elif "موجه" in title:
            role = "موجه"
        elif "رائد" in title:
            role = "رائد نشاط"
        elif "أمين" in title or "مصادر" in title:
            role = "أمين مصادر"
        # استخراج بنود مهام مرقمة
        tasks = []
        for ln in block.splitlines():
            s = ln.strip()
            if re.match(r"^[٠-٩0-9]+[\.\-\)]\s*\S+", s) or s.startswith("•") or s.startswith("-"):
                t = re.sub(r"^[٠-٩0-9•\.\-\)\s]+", "", s).strip()
                if 8 <= len(t) <= 160:
                    tasks.append(
                        {
                            "task": t,
                            "evidence": s[:180],
                            "form_id": r["رقم"],
                            "form_title": title,
                        }
                    )
        if tasks:
            by_role[role].extend(tasks[:25])
            log("مهام من تعريف", f"{role}: {len(tasks)} من [{r['رقم']}] {title[:40]}")
    return by_role


def guess_form_owner_roles(title: str) -> list[str]:
    roles = []
    for role, hints in ROLE_FORM_HINTS:
        if any(h in title for h in hints):
            roles.append(role)
    return roles or ["غير محدد"]


def main() -> None:
    log("بدء خ4", "قرار 51")
    formations = load_formations()
    log("تشكيلات اللجان", f"keys={list(formations.keys())}")

    # --- طبقة الهوية ---
    identity: dict[str, dict] = {}

    def upsert(name: str, role: str, source: str, extra: dict | None = None) -> None:
        key = norm_name(name)
        if key not in identity:
            identity[key] = {
                "person_id": person_id(name),
                "person_name": name.strip(),
                "role": role,
                "sources": [source],
                "committees": [],
                "committee_titles": [],
            }
        else:
            if source not in identity[key]["sources"]:
                identity[key]["sources"].append(source)
            # لا تستبدل دوراً أدق بدور عام
            if identity[key]["role"] in ("معلم", "إداري", "أخرى") and role not in (
                "معلم",
                "إداري",
                "أخرى",
            ):
                identity[key]["role"] = role
        if extra:
            identity[key].update(extra)

    # من التشكيلات (مصدر حقيقة للجان + أدوار رئاسة دقيقة قدر الإمكان)
    CHAIR_ROLE = {
        "quality": "مدير",
        "guidance": "رئيس توجيه",
        "exams": "رئيس تحصيل",
        "resources": "أمين مصادر",
    }
    for ck, members in formations.items():
        clabel = COMMITTEE_LABELS.get(ck, ck)
        for m in members:
            name = m.get("name") or ""
            title = m.get("title") or "عضواً"
            if not name or not looks_like_person_name(name):
                continue
            if "رئيس" in title:
                role = CHAIR_ROLE.get(ck, "رئيس لجنة")
            elif "مقرر" in title:
                role = "مقرر لجنة"
            else:
                role = "عضو لجنة"
            upsert(name, role, "committee_formations.json")
            identity[norm_name(name)]["committees"].append(clabel)
            identity[norm_name(name)]["committee_titles"].append(f"{clabel}:{title}")
            identity[norm_name(name)].setdefault("committee_keys", []).append(ck)

    staff = load_staff_from_xlsx()
    log("استيراد منسوبي xlsx", f"rows={len(staff)} (طبقة تكميلية؛ التشكيلات أصل اللجان)")
    for s in staff:
        if looks_like_person_name(s["name"]):
            upsert(s["name"], s["role"], s["source"])

    # تكرار أسماء في مصادر متعددة → وسم
    orphan_notes = []
    for key, p in identity.items():
        if len(p["sources"]) > 3:
            orphan_notes.append(
                f"- `{p['person_name']}` يظهر في {len(p['sources'])} مصادر هوية — يُراجع التوحيد لاحقاً."
            )

    inv = list(csv.DictReader(INV.open(encoding="utf-8-sig")))
    inds = {
        r["form_id"]: r
        for r in csv.DictReader(IND.open(encoding="utf-8-sig"))
    }
    lines = SOURCE.read_text(encoding="utf-8", errors="replace").splitlines()
    role_tasks = extract_role_tasks_from_archive(inv, lines)
    log("أدوار بمهام مستخرجة", str({k: len(v) for k, v in role_tasks.items()}))

    # ربط النماذج بالأدوار (لا بالأشخاص مباشرة إلا عبر الدور)
    forms_by_role: dict[str, list[str]] = defaultdict(list)
    form_meta = {}
    for r in inv:
        if r.get("layer") != "operational":
            continue
        title = r["العنوان"]
        roles = guess_form_owner_roles(title)
        form_meta[r["رقم"]] = {"title": title, "roles": roles}
        for role in roles:
            forms_by_role[role].append(r["رقم"])

    # مهام «أخرى» من تعاريف اللجان → تُربط بمفتاح اللجنة
    COMMITTEE_TASK_KEYS = {
        "quality": ("تميز", "جودة", "إدارية"),
        "guidance": ("توجيه", "إرشاد"),
        "exams": ("تحصيل", "اختبار"),
        "resources": ("مصادر", "تعلم"),
    }

    def tasks_for_committee(ck: str) -> list[dict]:
        keys = COMMITTEE_TASK_KEYS.get(ck, ())
        out = []
        for rk, tasks in role_tasks.items():
            if rk != "أخرى":
                continue
            for t in tasks:
                title = t.get("form_title") or ""
                if any(k in title for k in keys):
                    out.append(t)
        return out

    # بناء البطاقات
    cards = []
    for key, p in sorted(identity.items(), key=lambda x: x[1]["person_name"]):
        role = p["role"]
        # مطابقة مهام الدور
        task_bucket = []
        for rk, tasks in role_tasks.items():
            if rk == "أخرى":
                continue
            if rk in role or role in rk or (role == "مدير" and rk == "مدير"):
                task_bucket.extend(tasks)
            elif role.startswith("وكيل") and "وكيل" in rk:
                task_bucket.extend(tasks)
            elif "موجه" in role and "موجه" in rk:
                task_bucket.extend(tasks)
            elif "أمين مصادر" in role and "أمين" in rk:
                task_bucket.extend(tasks)
        # مهام تعريف اللجنة لرؤساء/مقررين/أعضاء حسب مفتاح اللجنة
        for ck in dict.fromkeys(p.get("committee_keys") or []):
            ctasks = tasks_for_committee(ck)
            # الرئيس يأخذ حتى 12؛ العضو حتى 4 من تعريف لجنته
            titles = " ".join(p.get("committee_titles") or [])
            lim = 12 if "رئيس" in titles else (8 if "مقرر" in titles else 4)
            task_bucket.extend(ctasks[:lim])
        # إزالة تكرار المهام بالنص
        seen_t = set()
        uniq = []
        for t in task_bucket:
            if t["task"] in seen_t:
                continue
            seen_t.add(t["task"])
            uniq.append(t)
        task_bucket = uniq

        # نماذج مملوكة حسب الدور + كلمات اللجنة
        owned = []
        for rk, fids in forms_by_role.items():
            if rk in role or role in rk or (role == "مدير" and rk == "مدير"):
                owned.extend(fids)
            elif "معلم" in role and rk == "معلم":
                owned.extend(fids[:40])
            elif "أمين مصادر" in role and rk == "أمين مصادر":
                owned.extend(fids)
        for ck in dict.fromkeys(p.get("committee_keys") or []):
            keys = COMMITTEE_TASK_KEYS.get(ck, ())
            for fid, meta in form_meta.items():
                if any(k in meta["title"] for k in keys):
                    owned.append(fid)
        owned = list(dict.fromkeys(owned))[:60]
        approved = []
        if role == "مدير":
            # المدير يعتمد كثيراً — وسم دون تضخيم مفرط
            approved = [fid for fid, meta in form_meta.items() if "اعتماد" in meta["title"] or "محضر" in meta["title"]][
                :40
            ]

        ind_served = set()
        for fid in owned[:30]:
            ir = inds.get(fid)
            if ir and ir.get("indicators"):
                for c in ir["indicators"].split(";"):
                    if c.strip():
                        ind_served.add(c.strip())

        evidence = ""
        conf = "low"
        if task_bucket:
            evidence = task_bucket[0]["evidence"]
            conf = "medium"
        elif p["committee_titles"]:
            evidence = "عضوية موثقة: " + "؛ ".join(p["committee_titles"][:3])
            conf = "medium"
        else:
            evidence = f"اسم من مصدر الهوية: {p['sources'][0]}"
            conf = "low"

        cards.append(
            {
                "person_id": p["person_id"],
                "person_name": p["person_name"],
                "role": role,
                "tasks": " | ".join(t["task"] for t in task_bucket[:12]),
                "tasks_count": len(task_bucket),
                "forms_owned": ";".join(owned[:40]),
                "forms_owned_count": len(owned),
                "forms_approved": ";".join(approved[:40]),
                "forms_approved_count": len(approved),
                "committees": " | ".join(dict.fromkeys(p["committees"])),
                "committee_roles": " | ".join(p["committee_titles"]),
                "indicators_served": ";".join(sorted(ind_served)),
                "evidence": evidence[:220],
                "confidence": conf,
                "identity_sources": ";".join(p["sources"][:5]),
            }
        )

    log("بطاقات", f"n={len(cards)}")

    # خريطة اللجان
    comm_rows = []
    for ck, members in formations.items():
        clabel = COMMITTEE_LABELS.get(ck, ck)
        has_rapporteur = any("مقرر" in (m.get("title") or "") for m in members)
        chair = next((m for m in members if "رئيس" in (m.get("title") or "")), None)
        # مهام مرتبطة باللجنة من عناوين الأرشيف
        related = [
            r["رقم"]
            for r in inv
            if r.get("layer") == "operational"
            and any(
                k in (r.get("العنوان") or "")
                for k in (
                    clabel.split("/")[0].strip(),
                    "التميز" if ck == "quality" else "",
                    "التوجيه" if ck == "guidance" else "",
                    "تحصيل" if ck == "exams" else "",
                    "مصادر" if ck == "resources" else "",
                )
                if k
            )
        ]
        comm_rows.append(
            {
                "committee_id": ck,
                "committee_name": clabel,
                "chair": (chair or {}).get("name", ""),
                "members_count": len(members),
                "members": " | ".join(f"{m.get('name')}({m.get('title')})" for m in members),
                "has_rapporteur": "yes" if has_rapporteur else "no",
                "related_forms_count": len(related),
                "related_forms": ";".join(related[:25]),
                "tasks_documented": "yes" if related else "partial/unknown",
            }
        )

    # تقاطعات
    cross_rows = []
    multi_chair = []
    for c in cards:
        coms = [x for x in c["committees"].split(" | ") if x]
        if len(coms) >= 2:
            cross_rows.append(
                {
                    "person_id": c["person_id"],
                    "person_name": c["person_name"],
                    "committees_count": len(coms),
                    "committees": c["committees"],
                    "committee_roles": c["committee_roles"],
                    "note": "عضوية متعددة — عبء محتمل",
                }
            )
        chairs = [p for p in c["committee_roles"].split(" | ") if "رئيس" in p]
        if len(chairs) >= 2:
            multi_chair.append(c["person_name"])
            cross_rows.append(
                {
                    "person_id": c["person_id"],
                    "person_name": c["person_name"],
                    "committees_count": len(chairs),
                    "committees": "؛ ".join(chairs),
                    "committee_roles": c["committee_roles"],
                    "note": "رئاسة متعددة — تركيز سلطة محتمل",
                }
            )

    # مهام يتيمة: مهام مستخرجة من تعاريف بلا شخص مطابق للدور بدقة
    orphan_tasks = []
    for role, tasks in role_tasks.items():
        holders = [c for c in cards if role in c["role"] or c["role"] in role]
        if not holders:
            for t in tasks:
                orphan_tasks.append(
                    {
                        "task": t["task"],
                        "role_expected": role,
                        "form_id": t["form_id"],
                        "form_title": t["form_title"],
                        "evidence": t["evidence"][:180],
                        "reason": "لا منسوب في طبقة الهوية يطابق هذا الدور بدقة",
                    }
                )

    # منسوبون بلا مهام
    orphan_persons = [
        {
            "person_id": c["person_id"],
            "person_name": c["person_name"],
            "role": c["role"],
            "committees": c["committees"],
            "reason": "لا مهام مستخرجة من وصف وظيفي مطابق",
        }
        for c in cards
        if int(c["tasks_count"]) == 0
    ]

    # نماذج بلا مالك واضح
    unowned_forms = [
        {"form_id": fid, "title": meta["title"], "guess_roles": ";".join(meta["roles"])}
        for fid, meta in form_meta.items()
        if meta["roles"] == ["غير محدد"]
    ]

    # كتابة الملفات
    def write_csv(path: Path, rows: list[dict], fields: list[str] | None = None) -> None:
        if not rows:
            rows = [{(fields or ["note"])[0]: ""}]
            fields = fields or ["note"]
        fields = fields or list(rows[0].keys())
        with path.open("w", encoding="utf-8-sig", newline="") as h:
            w = csv.DictWriter(h, fieldnames=fields, extrasaction="ignore")
            w.writeheader()
            w.writerows(rows)

    write_csv(CARDS, cards)
    write_csv(COMM, comm_rows)
    write_csv(CROSS, cross_rows or [{"note": "لا تقاطعات مكتشفة في التشكيلات الحالية"}])
    write_csv(ORPH_T, orphan_tasks or [{"note": "لا مهام يتيمة بهذا التعريف"}])
    write_csv(ORPH_P, orphan_persons)

    ORPH_D.write_text(
        "\n".join(
            [
                "# 04_orphan_data — ملاحظات جودة الهوية/الملكية",
                f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                "",
                f"- نماذج operational بلا مالك دور واضح: **{len(unowned_forms)}** من {len(form_meta)}",
                f"- أمثلة: "
                + "؛ ".join(f"{u['form_id']}:{u['title'][:40]}" for u in unowned_forms[:12]),
                "",
                "### تكرار مصادر الهوية",
                *(orphan_notes or ["- لا ملاحظات"]),
                "",
                "### اكتشاف استراتيجي مرصود",
                "- كثير من النماذج بلا حقل «المسؤول» الصريح في النص → الملكية تُستنتج من **الدور** لا من الاسم.",
                "- خطر عبء المدير: نماذج الاعتماد/المحاضر تُربط افتراضياً بالمدير عند غياب مالك أوضح.",
                "",
            ]
        ),
        encoding="utf-8",
    )

    # أعلى عبء
    by_forms = sorted(cards, key=lambda c: -int(c["forms_owned_count"]))[:5]
    by_approve = sorted(cards, key=lambda c: -int(c["forms_approved_count"]))[:5]
    by_tasks = sorted(cards, key=lambda c: -int(c["tasks_count"]))[:5]
    by_comm = sorted(
        [c for c in cards if c["committees"]],
        key=lambda c: -len([x for x in c["committees"].split(" | ") if x]),
    )[:5]

    report = [
        "# 04_person_task_report — تقرير الخوارزمية 4",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "## الحالة: مُسلَّم للمراجعة — لا خ5",
        "",
        "## ملخص تنفيذي",
        f"- منسوبون في طبقة الهوية: **{len(cards)}** (أصلها `committee_formations.json`؛ ملفات teachers-*.xlsx غالباً فارغة/اختبار).",
        f"- لجان موثقة في التشكيلات: **{len(comm_rows)}**.",
        f"- تقاطعات عضوية/رئاسة: **{len(cross_rows)}** صفوف.",
        f"- مهام مستخرجة من تعاريف الأرشيف مرتبطة بأدوار: **{sum(len(v) for v in role_tasks.values())}** بنداً.",
        f"- منسوبون بلا مهام وصف: **{len(orphan_persons)}** · مهام بلا مالك شخصي مطابق: **{len(orphan_tasks)}**.",
        f"- نماذج بلا مالك دور واضح: **{len(unowned_forms)}** — الأرشيف جزئياً «مفرّغ من المالك الاسمي» (تحفظ 2).",
        "- الملكية هنا غالباً **بالدور/اللجنة** لا بالاسم.",
        "- عبء المدير مرصود عبر نماذج الاعتماد/المحاضر (تحفظ 3).",
        "- تقاطع اللجان مرصود في التشكيلات الأربع (تحفظ 4).",
        "",
        "## أعداد",
        f"| البند | العدد |",
        f"|---|---:|",
        f"| منسوبون | {len(cards)} |",
        f"| مجموع بنود المهام المربوطة ببطاقات | {sum(int(c['tasks_count']) for c in cards)} |",
        f"| لجان | {len(comm_rows)} |",
        f"| لجان بلا مقرر موثق | {sum(1 for r in comm_rows if r['has_rapporteur']=='no')} |",
        "",
        "## أعلى 5 عبئاً (حسب عدد النماذج المربوطة بالدور/اللجنة)",
        "",
    ]
    for c in by_forms:
        report.append(
            f"- {c['person_name']} ({c['role']}) — forms_owned≈{c['forms_owned_count']} · لجان: {c['committees'] or '—'}"
        )
    report += ["", "## أعلى 5 عبء اعتماد (forms_approved — مؤشر عبء المدير)", ""]
    for c in by_approve:
        report.append(
            f"- {c['person_name']} ({c['role']}) — approved≈{c['forms_approved_count']}"
        )
    report += ["", "## أعلى 5 حسب بنود المهام المستخرجة", ""]
    for c in by_tasks:
        report.append(f"- {c['person_name']} — tasks={c['tasks_count']}")
    report += ["", "## أعلى 5 تقاطع لجان", ""]
    for c in by_comm:
        report.append(f"- {c['person_name']} — {c['committees']}")
    report += [
        "",
        f"## رؤساء متعددون (إن وُجدوا): {', '.join(multi_chair) or 'لا أحد برئاسة مزدوجة في التشكيلات الأربع'}",
        "",
        "## توصيات لخ5",
        "1. بناء خريطة لجان أوسع من الأرشيف (اللجنة الإدارية وغيرها) فوق التشكيلات الأربع المحفوظة.",
        "2. تخفيف عبء المدير: فصل اعتماد روتيني عن رئاسة كل لجنة.",
        "3. ملء فجوة المالك الاسمي في النماذج (حقل مسؤول إلزامي لاحقاً).",
        "4. مراجعة بشرية للبطاقات ذات confidence=low.",
        "",
        "## حدود",
        "- التشكيلات المحفوظة 4 لجان فقط — ليست كل لجان المدرسة.",
        "- استيراد xlsx قد يكرر/يشوّه أسماء؛ طبقة الهوية تحتاج تنظيفاً لاحقاً.",
        "- لا يُفتح خ5 هنا.",
        "",
    ]
    REPORT.write_text("\n".join(report) + "\n", encoding="utf-8")

    # عيّنة 15
    random.seed(1059)
    managers = [c for c in cards if c["role"] == "مدير" or "رئيس" in c["committee_roles"]]
    wakils = [
        c
        for c in cards
        if c not in managers
        and (
            "وكيل" in c["role"]
            or "موجه" in c["role"]
            or "رائد" in c["role"]
            or "أمين" in c["role"]
            or "مقرر" in c["role"]
            or "رئيس" in c["role"]
        )
    ]
    teachers = [c for c in cards if c not in managers and c not in wakils]
    # أكمل النواقص من الباقي دون تكرار
    used_ids = set()
    sample = []
    for pool, n, label in (
        (managers, 5, "قيادة/مدير"),
        (wakils, 5, "إشراف/مقرر"),
        (teachers, 5, "عضو/أخرى"),
    ):
        pool = [c for c in pool if c["person_id"] not in used_ids]
        take = min(n, len(pool))
        chosen = random.sample(pool, take) if take else []
        # إن نقصت الفئة: خذ من بقية البطاقات
        if take < n:
            rest = [c for c in cards if c["person_id"] not in used_ids and c not in chosen]
            need = min(n - take, len(rest))
            chosen = chosen + (random.sample(rest, need) if need else [])
        for c in chosen:
            c = dict(c)
            c["_bucket"] = label
            used_ids.add(c["person_id"])
            sample.append(c)
    sm = [
        "# 04_sample_15 — عيّنة بطاقات",
        f"## الحجم الفعلي: {len(sample)} من 15 المستهدف — طبقة الهوية الحالية = {len(cards)} فقط (تشكيلات 4 لجان؛ teachers-*.xlsx فارغة/اختبار)",
        "",
        "| # | الفئة | الاسم | الدور | مهام | لجان | دليل | ثقة |",
        "|---:|---|---|---|---|---|---|---|",
    ]
    for i, c in enumerate(sample, 1):
        sm.append(
            f"| {i} | {c.get('_bucket')} | {c['person_name'][:28]} | {c['role']} | {c['tasks_count']} | "
            f"{(c['committees'] or '—')[:40]} | {c['evidence'][:70]} | {c['confidence']} |"
        )
    SAMPLE.write_text("\n".join(sm) + "\n", encoding="utf-8")

    log("كتابة المخرجات", f"cards={len(cards)} cross={len(cross_rows)} orphan_p={len(orphan_persons)}")
    log("انتهاء خ4", "بانتظار المراجعة — لا خ5")
    flush()


if __name__ == "__main__":
    main()
