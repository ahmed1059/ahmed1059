# -*- coding: utf-8 -*-
"""الخوارزمية 5 — خريطة أدوار اللجان/الفرق (قرار 65). الدور لا الشخص."""
from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from config import FORMATIONS_PATH, OUTPUT_DIR as OUT, SCHOOL_DATA_DIR, get_archive_path

ROOT = SCHOOL_DATA_DIR
FORMATIONS = FORMATIONS_PATH
INV = OUT / "01_inventory.csv"
SOURCE = get_archive_path()
CROSS4 = OUT / "04_cross_membership.csv"
ORPH_EXT = OUT / "04_identity_extension.csv"

RUN = OUT / "05_run_log.md"
ROLES = OUT / "05_role_map.csv"
STRUCT = OUT / "05_committee_structure.csv"
GAPS = OUT / "05_gaps.csv"
CROSS = OUT / "05_cross_membership.csv"
REPORT = OUT / "05_committee_report.md"
SAMPLE = OUT / "05_sample_5.md"
RISKS = OUT / "05_governance_risks.md"
DEC = OUT / "decisions_log.md"

# هيئات مرجعية من الأرشيف (تعريف و/أو قرار تشكيل) + مصادر التعلم من التشكيلات
BODIES = [
    {
        "id": "admin",
        "name": "اللجنة الإدارية",
        "kind": "لجنة",
        "def_ids": ["188"],
        "form_ids": ["189"],
        "formation_key": None,
        "sample": True,
    },
    {
        "id": "quality",
        "name": "لجنة التميز / الجودة",
        "kind": "لجنة",
        "def_ids": ["321"],
        "form_ids": ["322"],
        "formation_key": "quality",
        "sample": True,
    },
    {
        "id": "exams",
        "name": "لجنة التحصيل الدراسي / الاختبارات",
        "kind": "لجنة",
        "def_ids": ["376"],
        "form_ids": ["379"],
        "formation_key": "exams",
        "sample": True,
    },
    {
        "id": "guidance",
        "name": "لجنة التوجيه الطلابي",
        "kind": "لجنة",
        "def_ids": ["394"],
        "form_ids": ["395"],
        "formation_key": "guidance",
        "sample": True,
    },
    {
        "id": "resources",
        "name": "لجنة مصادر التعلم",
        "kind": "لجنة",
        "def_ids": [],
        "form_ids": [],
        "formation_key": "resources",
        "sample": True,
        "note": "موجودة في التشكيلات فقط — بلا تعريف/قرار تشكيل مستقل في عناوين الأرشيف المفهرسة",
    },
    {
        "id": "fund",
        "name": "فريق عمل الصندوق المدرسي",
        "kind": "فريق",
        "def_ids": [],
        "form_ids": ["165"],
        "formation_key": None,
    },
    {
        "id": "disability",
        "name": "فريق عمل الطلاب ذوي الإعاقة",
        "kind": "فريق",
        "def_ids": ["347"],
        "form_ids": ["348"],
        "formation_key": None,
    },
    {
        "id": "volunteer",
        "name": "فريق العمل التطوعي",
        "kind": "فريق",
        "def_ids": ["438"],
        "form_ids": ["443"],
        "formation_key": None,
    },
    {
        "id": "partnership",
        "name": "فريق الشراكة المجتمعية",
        "kind": "فريق",
        "def_ids": [],
        "form_ids": ["495"],
        "formation_key": None,
    },
    {
        "id": "gifted",
        "name": "رعاية الموهوبين (مسار/معلم)",
        "kind": "مسار",
        "def_ids": ["407"],
        "form_ids": [],
        "formation_key": None,
    },
    {
        "id": "discipline",
        "name": "لجنة الانضباط المدرسي",
        "kind": "لجنة",
        "def_ids": [],
        "form_ids": [],
        "formation_key": None,
        "note": "مذكورة في عناوين الأرشيف — بلا تعريف/تشكيل مستقل مفهرس كقرار",
        "title_hint": "الانضباط",
    },
    {
        "id": "admission",
        "name": "لجنة المفاضلة وقبول الطلبة",
        "kind": "لجنة",
        "def_ids": [],
        "form_ids": [],
        "formation_key": None,
        "note": "مذكورة في عناوين الأرشيف — بلا هيكل أدوار مستخرج",
        "title_hint": "المفاضلة",
    },
    {
        "id": "school_council",
        "name": "مجلس المدرسة",
        "kind": "مجلس",
        "def_ids": [],
        "form_ids": [],
        "formation_key": None,
        "note": "مذكور في العناوين — بلا هيكل أدوار مستخرج",
        "title_hint": "مجلس المدرسة",
    },
    {
        "id": "parents_council",
        "name": "مجلس أولياء الأمور",
        "kind": "مجلس",
        "def_ids": [],
        "form_ids": [],
        "formation_key": None,
        "note": "مذكور في العناوين — بلا هيكل أدوار مستخرج",
        "title_hint": "أولياء الأمور",
    },
    {
        "id": "students_council",
        "name": "المجلس الطلابي",
        "kind": "مجلس",
        "def_ids": [],
        "form_ids": [],
        "formation_key": None,
        "note": "مذكور في العناوين — بلا هيكل أدوار مستخرج",
        "title_hint": "مجلس الطلابي",
    },
]

ORPHAN_ROLES = [
    ("وكيل المدرسة لشؤون الطلاب", "199", "20"),
    ("وكيل المدرسة للشؤون التعليمية", "236", "25"),
    ("وكيل المدرسة للشؤون المدرسية", "277", "18"),
    ("الموجه الصحي", "161", "14"),
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
                "# 05_run_log — سجل تنفيذ الخوارزمية 5",
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


def write_csv(path: Path, rows: list[dict], fields: list[str] | None = None) -> None:
    if not rows:
        fields = fields or ["note"]
        rows = [{fields[0]: ""}]
    fields = fields or list(rows[0].keys())
    with path.open("w", encoding="utf-8-sig", newline="") as h:
        w = csv.DictWriter(h, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def load_block(inv_by_id: dict, lines: list[str], starts: list[int], fid: str) -> tuple[str, list[str]]:
    r = inv_by_id.get(fid)
    if not r or not r.get("سطر_البداية"):
        return "", []
    start = int(r["سطر_البداية"])
    i = starts.index(start)
    end = starts[i + 1] if i + 1 < len(starts) else len(lines) + 1
    block = lines[start - 1 : min(end - 1, start + 100)]
    return r.get("العنوان") or "", block


def parse_role_bullets(block: list[str]) -> list[dict]:
    """استخراج أدوار من بنود • الدور — الصفة."""
    out = []
    for ln in block:
        s = ln.strip()
        if not s.startswith("•"):
            continue
        s = s.lstrip("•").strip()
        if not any(k in s for k in ("رئيس", "مقرر", "مقرِّر", "نائب", "عضو", "أعضاء", "منسق")):
            continue
        if "تجتمع" in s or ("لرئيس" in s and "دعوة" in s):
            continue
        if "التصويت" in s or "يُغلَّب" in s or "يغلب" in s:
            continue
        if any(k in s for k in ("الاستعانة", "لا يُصرف", "لا يخل", "يُستدعى", "يستدعى", "وفق مرئيات")):
            continue
        # فصل الدور عن الصفة
        role_label = s
        seat = "عضو"
        if "نائب" in s:
            seat = "نائب رئيس"
        elif "مقرر" in s or "مقرِّر" in s:
            seat = "مقرر"
        elif "رئيس" in s:
            seat = "رئيس"
        elif "منسق" in s:
            seat = "منسق"
        elif "أعضاء" in s or "عضوان" in s:
            seat = "أعضاء"
        # الدور الوظيفي قبل الشرطة إن وُجد
        job = s
        for sep in ("—", "–", "-", "ـ"):
            if sep in s:
                left, right = s.split(sep, 1)
                job = left.strip()
                # عدّل seat من الطرف الأيمن إن أوضح
                if "نائب" in right:
                    seat = "نائب رئيس"
                elif "مقرر" in right or "مقرِّر" in right:
                    seat = "مقرر" if "عضو" not in right else "عضو ومقرر"
                elif "رئيس" in right:
                    seat = "رئيس"
                break
        # تعدد: وكلاء / ثلاثة معلمين
        multiplicity = 1
        if "وكلاء" in job or "ثلاثة" in job or "معلم" in job and "معلمان" not in job and "ثلاثة" in s:
            if "ثلاثة" in s or "ثلاثة" in job:
                multiplicity = 3
            elif "وكلاء" in job:
                multiplicity = 3  # تقديري من الدليل: وكلاء المدرسة
            elif "معلمان" in s:
                multiplicity = 2
        if "معلمان" in s:
            multiplicity = 2
        out.append(
            {
                "role_text": role_label[:160],
                "job_role": job[:80],
                "seat": seat,
                "multiplicity": multiplicity,
                "evidence": ("• " + role_label)[:200],
            }
        )
    return out


def parse_formation_slots(block: list[str]) -> list[dict]:
    """من قرار التشكيل: العمل الأساسي + الصفة (بدون أسماء)."""
    text = "\n".join(block)
    jobs = re.findall(r"العمل الأساسي\n([^\n]+)", text)
    # صفات تقريبية بعد كل عمل
    seats = []
    for i, ln in enumerate(block):
        if ln.strip() == "العمل الأساسي" and i + 1 < len(block):
            job = block[i + 1].strip()
            seat = "عضو"
            window = " ".join(x.strip() for x in block[i : i + 12])
            if "رئيس الفريق" in window or "رئيس اللجنة" in window:
                # إن وُجد خيار رئيس في النافذة دون تحديد أي زر مفعّل — نأخذ أول صفة ظاهرة في القالب
                if "رئيس" in window:
                    seat = "رئيس/عضو/مقرر (قالب اختيار)"
            seats.append({"job_role": job, "seat": seat, "role_text": f"{job} — مقعد في قرار التشكيل", "multiplicity": 1, "evidence": f"العمل الأساسي: {job}"})
    # تبسيط: صف لكل عمل أساسي
    out = []
    for job in jobs:
        job = job.strip()
        if not job or job.startswith("الاسم"):
            continue
        out.append(
            {
                "role_text": f"{job} (مقعد تشكيل)",
                "job_role": job,
                "seat": "مقعد تشكيل (غير معيّن بالاسم)",
                "multiplicity": 1,
                "evidence": f"العمل الأساسي: {job}",
            }
        )
    return out


def normalize_job(j: str) -> str:
    j = re.sub(r"\s+", " ", (j or "").strip())
    return j


def match_filled(job: str, seat: str, formation_members: list[dict], body_id: str) -> tuple[str, str]:
    """لا تُملأ خانة الدور الوظيفي الأرشيفي باسم من التشكيلات تلقائياً.
    الأسماء تُدرج صفوفاً منفصلة من طبقة التطبيق — تجنّب نسبة «رائد النشاط = محمد» دون دليل مهنة.
    """
    return "vacant", ""


def main() -> None:
    log("بدء خ5", "قرار 65 — خريطة أدوار")
    formations = json.loads(FORMATIONS.read_text(encoding="utf-8"))
    inv = list(csv.DictReader(INV.open(encoding="utf-8-sig")))
    inv_by_id = {r["رقم"]: r for r in inv}
    lines = SOURCE.read_text(encoding="utf-8", errors="replace").splitlines()
    starts = sorted(
        int(r["سطر_البداية"])
        for r in inv
        if r.get("سطر_البداية") and (r.get("source") or "archive_txt") == "archive_txt"
    )
    log("هيئات مرجعية", f"n={len(BODIES)} (الأرشيف أوسع من 4 التشكيلات)")

    role_rows = []
    struct_rows = []
    gap_rows = []
    manager_chair_of = []

    for body in BODIES:
        bid = body["id"]
        roles: list[dict] = []
        evidence_sources = []
        for fid in body.get("def_ids") or []:
            title, block = load_block(inv_by_id, lines, starts, fid)
            if block:
                evidence_sources.append(f"تعريف:{fid}:{title[:40]}")
                roles.extend(parse_role_bullets(block))
        if not roles:
            for fid in body.get("form_ids") or []:
                title, block = load_block(inv_by_id, lines, starts, fid)
                if block:
                    evidence_sources.append(f"تشكيل:{fid}:{title[:40]}")
                    roles.extend(parse_formation_slots(block))

        fkey = body.get("formation_key")
        fmembers = formations.get(fkey, []) if fkey else []
        has_chair_role = any(r["seat"] == "رئيس" for r in roles)
        has_rapporteur_role = any("مقرر" in r["seat"] for r in roles)
        has_chair_named = any("رئيس" in (m.get("title") or "") for m in fmembers)
        has_rapporteur_named = any("مقرر" in (m.get("title") or "") for m in fmembers)

        filled_n = 0
        vacant_n = 0
        for r in roles:
            status, person = match_filled(r["job_role"], r["seat"], fmembers, bid)
            # إن وُجدت أسماء في التشكيل ولم نربط الدور الوظيفي: المقاعد الاسمية تُحسب منفصلة
            if status == "filled":
                filled_n += 1
            else:
                vacant_n += 1
            if r["seat"] == "رئيس" and ("مدير" in r["job_role"] or r["job_role"].startswith("مدير")):
                manager_chair_of.append(body["name"])
            role_rows.append(
                {
                    "body_id": bid,
                    "body_name": body["name"],
                    "kind": body["kind"],
                    "seat": r["seat"],
                    "job_role": r["job_role"],
                    "multiplicity": r["multiplicity"],
                    "status": status,
                    "holder_name": person,
                    "holder_source": "committee_formations.json" if person else "",
                    "evidence": r["evidence"],
                    "evidence_source": ";".join(evidence_sources[:3]),
                }
            )

        # صفوف التشكيل الاسمية (طبقة تطبيق) — للشفافية
        for m in fmembers:
            role_rows.append(
                {
                    "body_id": bid,
                    "body_name": body["name"],
                    "kind": body["kind"],
                    "seat": m.get("title") or "عضواً",
                    "job_role": "(اسم من طبقة التطبيق — بلا مسمى وظيفي أرشيفي مربوط)",
                    "multiplicity": 1,
                    "status": "filled",
                    "holder_name": m.get("name") or "",
                    "holder_source": "committee_formations.json",
                    "evidence": f"{m.get('name')} — {m.get('title')}",
                    "evidence_source": "committee_formations.json",
                }
            )
            filled_n += 1

        in_formations = "yes" if fkey else "no"
        archive_presence = "yes" if (body.get("def_ids") or body.get("form_ids") or body.get("title_hint")) else "partial"

        # فجوات
        if roles and not has_rapporteur_role and not has_rapporteur_named:
            gap_rows.append(
                {
                    "gap_type": "no_rapporteur_role",
                    "body_id": bid,
                    "body_name": body["name"],
                    "detail": "لا دور مقرر في التعريف المستخرج ولا مقرّر بالاسم في التشكيلات",
                    "severity": "admin",
                }
            )
        if fkey and not has_rapporteur_named:
            gap_rows.append(
                {
                    "gap_type": "no_rapporteur_named",
                    "body_id": bid,
                    "body_name": body["name"],
                    "detail": "في التشكيلات المحفوظة: بلا مقرّر بالاسم",
                    "severity": "admin",
                }
            )
        if roles and not has_chair_role and not has_chair_named:
            gap_rows.append(
                {
                    "gap_type": "no_chair",
                    "body_id": bid,
                    "body_name": body["name"],
                    "detail": "لا رئيس في التعريف ولا في التشكيلات",
                    "severity": "admin",
                }
            )
        if not fkey and (body.get("def_ids") or body.get("form_ids") or body.get("title_hint")):
            gap_rows.append(
                {
                    "gap_type": "not_in_formations",
                    "body_id": bid,
                    "body_name": body["name"],
                    "detail": body.get("note") or "موجودة في الأرشيف وغير مُشكَّلة بالاسم في committee_formations.json",
                    "severity": "identity",
                }
            )
        if body.get("note") and not (body.get("def_ids") or body.get("form_ids")):
            gap_rows.append(
                {
                    "gap_type": "mentioned_no_structure",
                    "body_id": bid,
                    "body_name": body["name"],
                    "detail": body["note"],
                    "severity": "documentation",
                }
            )

        struct_rows.append(
            {
                "body_id": bid,
                "body_name": body["name"],
                "kind": body["kind"],
                "in_archive_defs": "yes" if body.get("def_ids") else "no",
                "in_archive_formation_decision": "yes" if body.get("form_ids") else "no",
                "in_app_formations": in_formations,
                "roles_from_archive_count": len(roles),
                "named_members_count": len(fmembers),
                "has_chair_role": "yes" if has_chair_role or has_chair_named else "no",
                "has_deputy_role": "yes" if any(r["seat"] == "نائب رئيس" for r in roles) else "no",
                "has_rapporteur_role": "yes" if has_rapporteur_role or has_rapporteur_named else "no",
                "has_rapporteur_named": "yes" if has_rapporteur_named else "no",
                "filled_slots": filled_n,
                "vacant_role_slots": vacant_n,
                "evidence_sources": ";".join(evidence_sources) or body.get("note", ""),
                "note": body.get("note", ""),
            }
        )
        log("هيئة", f"{bid}: archive_roles={len(roles)} named={len(fmembers)}")

    for role, fid, tasks in ORPHAN_ROLES:
        gap_rows.append(
            {
                "gap_type": "orphan_identity_role",
                "body_id": "identity",
                "body_name": role,
                "detail": f"تعريف [{fid}] · ≈{tasks} مهمة · بلا شاغل في طبقة الهوية",
                "severity": "identity",
            }
        )

    # تقاطعات من خ4
    cross_rows = list(csv.DictReader(CROSS4.open(encoding="utf-8-sig"))) if CROSS4.exists() else []
    # تركيز رئاسة المدير من التعاريف
    mgr_chairs = sorted(set(manager_chair_of))

    write_csv(ROLES, role_rows)
    write_csv(STRUCT, struct_rows)
    write_csv(GAPS, gap_rows)
    write_csv(CROSS, cross_rows)

    no_rapp_named = [r for r in struct_rows if r["in_app_formations"] == "yes" and r["has_rapporteur_named"] == "no"]
    not_in_f = [r for r in struct_rows if r["in_app_formations"] == "no"]
    with_structure = [r for r in struct_rows if int(r["roles_from_archive_count"]) > 0 or int(r["named_members_count"]) > 0]

    report = [
        "# 05_committee_report — تقرير الخوارزمية 5 (خريطة أدوار)",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "## الحالة: مُسلَّم للمراجعة — لا خ6",
        "",
        "## ملخص تنفيذي",
        f"- جواب قرار الاعتماد: الـ4 لجان في `04_committee_map.csv` **ليست** كل هيئات الأرشيف — هي فقط ما في `committee_formations.json`.",
        f"- هيئات مُفهرسة في خ5: **{len(struct_rows)}** (لجان/فرق/مجالس/مسارات).",
        f"- منها بهيكل أدوار أو أسماء: **{len(with_structure)}** · مذكورة بلا هيكل: **{len(struct_rows)-len(with_structure)}**.",
        f"- في التشكيلات التطبيقية: **4** فقط · خارج التشكيلات: **{len(not_in_f)}**.",
        f"- لجان التشكيلات بلا مقرّر بالاسم: **{len(no_rapp_named)}**.",
        f"- أدوار يتيمة في الهوية: **4** (وكلاء×3 + موجه صحي).",
        f"- تقاطعات عضوية (طبقة التطبيق): **{len(cross_rows)}**.",
        f"- رئاسة `مدير المدرسة` في التعاريف الأرشفية: **{len(mgr_chairs)}** هيئة — {('؛ '.join(mgr_chairs) if mgr_chairs else '—')}.",
        "- البناء: **أدوار** أولاً؛ الأسماء حيث وُجدت فقط في طبقة التطبيق.",
        "",
        "## أعداد",
        "| البند | العدد |",
        "|---|---:|",
        f"| هيئات خ5 | {len(struct_rows)} |",
        f"| صفوف خريطة الأدوار | {len(role_rows)} |",
        f"| فجوات موثّقة | {len(gap_rows)} |",
        f"| خارج التشكيلات الأربع | {len(not_in_f)} |",
        "",
        "## هيكل موجز",
        "",
    ]
    for r in struct_rows:
        report.append(
            f"- **{r['body_name']}** ({r['kind']}) — أرشيف أدوار:{r['roles_from_archive_count']} · أسماء تطبيق:{r['named_members_count']} · "
            f"رئيس:{r['has_chair_role']} · نائب:{r['has_deputy_role']} · مقرر:{r['has_rapporteur_role']} · في التشكيلات:{r['in_app_formations']}"
        )
    report += [
        "",
        "## الفجوات",
        f"- بلا مقرّر بالاسم (تشكيلات): {', '.join(x['body_name'] for x in no_rapp_named) or '—'}",
        f"- أدوار يتيمة: وكيل طلاب / وكيل تعليمية / وكيل مدرسية / الموجه الصحي",
        f"- هيئات أرشيفية غير مُشكَّلة بالاسم: {len(not_in_f)}",
        "",
        "## تركيز السلطة (خطر)",
        f"- من التعاريف: مدير المدرسة رئيس في: {', '.join(mgr_chairs) or 'غير مستخرج'}",
        "- من خ4: عبء اعتماد المدير ≈36 نموذج — يتسق مع عنق الزجاجة.",
        "- ملاحظة: التشكيلات تُظهر رؤساء بأسماء أخرى لبعض اللجان (لا تطابق حرفياً كل تعريف أرشيفي) — يُراجع في خ9.",
        "",
        "## توصيات لخ6",
        "1. ربط البرامج/المهام بالهيئات عبر الدور لا الاسم.",
        "2. معالجة فجوات المقرر والرئاسة في طبقة الحوكمة (خ9/خ10).",
        "3. عدم دمج الأسماء العشرة مع قوالب الأرشيف دون مراجعة.",
        "",
        "## حدود",
        "- بعض قرارات التشكيل قوالب بلا صفة مفعّلة — المقاعد تُوسم شاغرة وظيفياً.",
        "- لا فتح لخ6 هنا.",
        "",
    ]
    REPORT.write_text("\n".join(report), encoding="utf-8")

    # عيّنة 5
    sample_ids = ["quality", "guidance", "exams", "resources", "admin"]
    sm = [
        "# 05_sample_5 — عيّنة خمس هيئات (أدوار + دليل)",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
    ]
    for sid in sample_ids:
        body = next(b for b in BODIES if b["id"] == sid)
        srow = next(r for r in struct_rows if r["body_id"] == sid)
        rrows = [r for r in role_rows if r["body_id"] == sid and r["holder_source"] != "committee_formations.json" or (r["body_id"] == sid and "(اسم من طبقة" not in r["job_role"])]
        # أوضح: أدوار أرشيف أولاً
        arch = [r for r in role_rows if r["body_id"] == sid and r["evidence_source"] != "committee_formations.json"]
        named = [r for r in role_rows if r["body_id"] == sid and r["holder_source"] == "committee_formations.json"]
        sm += [
            f"## {body['name']}",
            f"- في التشكيلات: {srow['in_app_formations']} · أدوار أرشيف: {srow['roles_from_archive_count']} · أسماء: {srow['named_members_count']}",
            f"- رئيس/نائب/مقرر (أدوار): {srow['has_chair_role']}/{srow['has_deputy_role']}/{srow['has_rapporteur_role']}",
            f"- دليل مصادر: {srow['evidence_sources'] or srow['note'] or '—'}",
            "",
            "| مقعد | دور وظيفي | حالة | شاغل | دليل |",
            "|---|---|---|---|---|",
        ]
        for r in (arch or named)[:12]:
            sm.append(
                f"| {r['seat']} | {r['job_role'][:40]} | {r['status']} | {r['holder_name'] or '—'} | {(r['evidence'] or '')[:70]} |"
            )
        if named and arch:
            sm.append("")
            sm.append("أسماء طبقة التطبيق:")
            for r in named:
                sm.append(f"- {r['holder_name']} ({r['seat']})")
        sm.append("")
    SAMPLE.write_text("\n".join(sm), encoding="utf-8")

    risks = [
        "# 05_governance_risks — المخاطر الحوكمية (خ5)",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "## 1) تركيز الاعتماد والرئاسة",
        f"- تعاريف الأرشيف تسند رئاسة `مدير المدرسة` إلى: {', '.join(mgr_chairs) or '—'}.",
        "- خ4: ≈36 نموذج اعتماد/محضر مرتبطة بالمدير — عنق زجاجة تشغيلي (قرار 54).",
        "- التوصية المؤجلة لخ9/خ10: توزيع اعتماد روتيني وفصل الرئاسة حيث يسمح الدليل.",
        "",
        "## 2) لجان بلا مقرّر بالاسم (تشكيلات)",
        *[f"- {r['body_name']}" for r in no_rapp_named],
        "- الأثر: ضعف توثيق المحاضر والشواهد.",
        "",
        "## 3) أدوار يتيمة في الهوية",
        "- وكيل شؤون الطلاب · وكيل الشؤون التعليمية · وكيل الشؤون المدرسية · الموجه الصحي.",
        "- مهام موجودة في التعاريف بلا شاغل في طبقة الهوية الحالية.",
        "",
        "## 4) هيئات في الأرشيف خارج التشكيلات الأربع",
        *[f"- {r['body_name']}" for r in not_in_f],
        "- الخطر: حوكمة جزئية — جزء من المنظومة موصوف قالبياً وغير مُفعَّل بالأسماء.",
        "",
        "## 5) تعارض محتمل تعريف↔تشكيل",
        "- مثال: تعريف التحصيل يضع المدير رئيساً والموجه مقرراً؛ التشكيلات تضع رئيساً باسم آخر وبلا مقرّر.",
        "- يُوثَّق ولا يُحل في خ5 — مراجعة خ9.",
        "",
    ]
    RISKS.write_text("\n".join(risks), encoding="utf-8")

    # قرارات
    d = DEC.read_text(encoding="utf-8")
    block = """
### [قرار 62] تصحيح: الأسماء العشرة من طبقة التطبيق (تشكيلات + محاضر) لمدرسة سعد بن الربيع — ليست تلقائياً تجريبية/مؤسسين.
الأرشيف النصي لا يثبتها ولا ينفيها. قرار 58 (الأرشيف قالب) يبقى مع هذا التدقيق.

### [قرار 63] المسار = قالب + طبقة هوية قابلة للملء. خ5←خ10 توصيفية للقالب؛ ملء الهوية لاحقاً بلا إعادة خوارزميات.

### [قرار 64] اعتماد خ4 نهائياً بقوالبها العشرة وجميع إحصاءاتها المعتمدة.

### [قرار 65] فتح خ5 رسمياً — خريطة أدوار؛ توثيق الفجوات؛ لا خ6 قبل التسليم والمراجعة.
"""
    if "[قرار 62]" not in d:
        d = d.replace("## فرضية مسجّلة", block + "\n## فرضية مسجّلة")
        DEC.write_text(d, encoding="utf-8")

    log("فجوات", f"n={len(gap_rows)}")
    log("كتابة المخرجات", f"bodies={len(struct_rows)} roles={len(role_rows)}")
    log("انتهاء خ5", "بانتظار المراجعة — لا خ6")
    flush()


if __name__ == "__main__":
    main()
