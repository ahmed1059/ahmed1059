# -*- coding: utf-8 -*-
"""خ10 — توزيع الصلاحيات (توصيات فقط · لا تعيين آلي · لا خ6/خ7)."""
from __future__ import annotations

import csv
import importlib.util
from collections import Counter
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent

TEMPLATE_TYPES = {
    "TPL-01": {
        "template_type": "تقرير",
        "type_note": "169 تقرير + 1 بطاقة — عائلة تقارير برامج/مسابقات/مبادرات",
        "prepared_by_role": "رائد نشاط / منسق البرنامج / المعلم المنفّذ",
        "approved_by_role": "وكيل الشؤون التعليمية (اعتماد أول) · مدير المدرسة (عند اللزوم فقط)",
        "rapporteur_vacant": "لا",
        "notes": "approved_by اختياري — لا يمر كل تقرير على المدير (تحفظ 3).",
    },
    "TPL-02": {
        "template_type": "خطة",
        "type_note": "44 خطة + 4 تقارير ملاصقة لخطط",
        "prepared_by_role": "وكيل الشؤون التعليمية أو رئيس اللجنة المعنية",
        "approved_by_role": "مدير المدرسة",
        "rapporteur_vacant": "لا",
        "notes": "الخطط التشغيلية/العلاجية تحتاج اعتماداً إدارياً.",
    },
    "TPL-03": {
        "template_type": "محضر",
        "type_note": "25 محضر + 1 قرار مُصنَّف محضراً",
        "prepared_by_role": "مقرّر اللجنة (أو وكيل إلى حين التعيين)",
        "approved_by_role": "مدير المدرسة (محاضر حساسة) / وكيل مختص (محاضر روتينية — توصية)",
        "rapporteur_vacant": "نعم",
        "notes": "rapporteur_vacant=نعم للجان التوجيه/التحصيل/المصادر حتى تعيين بشري.",
    },
    "TPL-04": {
        "template_type": "قرار",
        "type_note": "12 قرار تشكيل/تكليف",
        "prepared_by_role": "وكيل الشؤون المدرسية أو الإدارية",
        "approved_by_role": "مدير المدرسة",
        "rapporteur_vacant": "نعم",
        "notes": "حقل المقرّر في التشكيل يبقى قابلاً للملء.",
    },
    "TPL-05": {
        "template_type": "سجل",
        "type_note": "104 سجل — كامل تقريباً من سجلات الجرد",
        "prepared_by_role": "صاحب الدور التشغيلي (موجه/أمين مصادر/رائد/وكيل طلاب)",
        "approved_by_role": "— (لا اعتماد مدير روتيني)",
        "rapporteur_vacant": "لا",
        "notes": "سجل تشغيلي يومي — لا يُحمَّل على المدير.",
    },
    "TPL-06": {
        "template_type": "كشف",
        "type_note": "20 كشفاً",
        "prepared_by_role": "وكيل شؤون الطلاب / لجنة الاختبارات / المنسق المعني",
        "approved_by_role": "— (اختياري وكيل فقط)",
        "rapporteur_vacant": "لا",
        "notes": "كشوف غياب/تسليم — بلا اعتماد مدير.",
    },
    "TPL-07": {
        "template_type": "استمارة",
        "type_note": "17 استمارة + 10 نماذج + 2 استبانة",
        "prepared_by_role": "المعلم / المنسق / الموجه",
        "approved_by_role": "وكيل مختص عند الحاجة",
        "rapporteur_vacant": "لا",
        "notes": "قياس أثر وتحويل — ليس مسار اعتماد مدير افتراضياً.",
    },
    "TPL-08": {
        "template_type": "شراكة_تطوع",
        "type_note": "كتلة موضوعية متعددة الأنواع تحت 1-3-1-3 (ليس نوع جرد واحد)",
        "prepared_by_role": "منسق التطوع / رائد النشاط",
        "approved_by_role": "وكيل شؤون الطلاب أو التعليمية · مدير عند المبادرات المعتمدة رسمياً",
        "rapporteur_vacant": "لا",
        "notes": "needs_expert_review على المؤشر؛ صلاحيات إعداد ≠ اعتماد.",
    },
    "TPL-09": {
        "template_type": "مفرد",
        "type_note": "67 نموذج + 24 تقرير تعريف/غلاف + 5 خطاب + 2 بطاقة — بلا عائلة",
        "prepared_by_role": "حسب النموذج (متغيّر)",
        "approved_by_role": "— (none) إلا إن نصّ النموذج على اعتماد",
        "rapporteur_vacant": "لا",
        "notes": "أغلفة/تعريفات/خطابات — لا اعتماد مدير جماعي.",
    },
}

# مرشحو المقرّرين من 09b + هوية 06 (معايير: عضوية لجنة · مصدر نور إن وُجد · فصل عن الرئاسة)
RAPPORTEURS = [
    # توجيه
    ("COM-guidance", "لجنة التوجيه الطلابي", "PERS-014", "خالد بن علي بن حجري العمري", "عضواً — لجنة التوجيه", "high",
     "عضو اللجنة + ملف نور يشير لوكيل — مهارة تنظيمية مرشّحة؛ ليس رئيساً"),
    ("COM-guidance", "لجنة التوجيه الطلابي", "PERS-033", "منور بن محمد بن عليان اللهيبي", "عضواً — لجنة التوجيه", "high",
     "عضو اللجنة + ملف نور «موجه طلابي» — يطابق تعريف الأرشيف للمقرّر؛ مفضّل وظيفياً"),
    ("COM-guidance", "لجنة التوجيه الطلابي", "ROLE-counselor", "(شاغر) موجه طلابي", "موجه طلابي — role_slot", "low",
     "المفضّل الوزاري عند شغل الدور؛ ليس تعييناً الآن"),
    # تحصيل
    ("COM-exams", "لجنة التحصيل الدراسي", "PERS-019", "عبدالمجيد محمد رميزان المرواني", "عضواً — لجنة التحصيل", "high",
     "عضو اللجنة — مرشّح أول داخل التشكيل"),
    ("COM-exams", "لجنة التحصيل الدراسي", "PERS-027", "ماجد فهد محمد الحربي", "عضواً — لجنة التحصيل", "high",
     "عضو اللجنة — بديل"),
    ("COM-exams", "لجنة التحصيل الدراسي", "ROLE-counselor", "(شاغر) موجه طلابي", "موجه طلابي — role_slot", "low",
     "تعريف الأرشيف يضع المقرّر على الموجه عند التوفر"),
    # مصادر
    ("COM-resources", "لجنة مصادر التعلم", "PERS-005", "احمد علي هيازع الشهري", "عضواً — لجنة مصادر التعلم", "high",
     "عضو اللجنة — مرشّح أول"),
    ("COM-resources", "لجنة مصادر التعلم", "PERS-039", "ياسر فالح مسعد السحيمي", "عضواً — لجنة مصادر التعلم", "high",
     "عضو اللجنة — بديل"),
    ("COM-resources", "لجنة مصادر التعلم", "PERS-030", "محمد حامد عماش السهلي", "رائد نشاط", "medium",
     "ليس عضواً مثبتاً في التشكيل — ثانوي عند الحاجة التنظيمية فقط"),
]


def load_u():
    spec = importlib.util.spec_from_file_location("u08", str(BASE / "_run_08_unification.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def patch_unified_templates(u) -> dict:
    """يضيف template_type إلى 08_unified_templates.csv ويعيد الصفوف."""
    path = BASE / "08_unified_templates.csv"
    rows = list(csv.DictReader(path.open(encoding="utf-8-sig")))
    inv = {
        r["رقم"]: r
        for r in csv.DictReader((BASE / "01_inventory.csv").open(encoding="utf-8-sig"))
    }
    # إعادة حساب type_composition للتوثيق في العمود
    mix = Counter()
    form_tpl = {}
    for fid, r in inv.items():
        inds = u.parse_inds(r.get("explicit_indicator_real") or "")
        tpl = u.classify_title(r.get("العنوان") or "", r.get("النوع") or "")
        if "1-3-1-3" in inds:
            tpl = "TPL-08"
        form_tpl[fid] = tpl
        mix[(tpl, r.get("النوع") or "")] += 1

    out_rows = []
    fieldnames = [
        "template_id",
        "template_type",
        "name_ar",
        "description",
        "form_count",
        "template_shared_form_count",
        "type_composition",
        "indicators_adopted_13",
        "needs_expert_review",
        "rapporteur_vacant",
        "prepared_by",
        "approved_by",
        "sample_form_ids",
        "sample_titles",
    ]
    for r in rows:
        tid = r["template_id"]
        meta = TEMPLATE_TYPES[tid]
        comp_parts = []
        for (t, typ), n in sorted(mix.items()):
            if t == tid and n:
                comp_parts.append(f"{typ}:{n}")
        row = {
            "template_id": tid,
            "template_type": meta["template_type"],
            "name_ar": r["name_ar"],
            "description": r["description"],
            "form_count": r["form_count"],
            "template_shared_form_count": r["template_shared_form_count"],
            "type_composition": ";".join(comp_parts) or meta["type_note"],
            "indicators_adopted_13": r["indicators_adopted_13"],
            "needs_expert_review": r["needs_expert_review"],
            "rapporteur_vacant": r["rapporteur_vacant"],
            "prepared_by": r["prepared_by"],
            "approved_by": r["approved_by"],
            "sample_form_ids": r["sample_form_ids"],
            "sample_titles": r["sample_titles"],
        }
        out_rows.append(row)

    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(out_rows)
    return {"rows": out_rows, "form_tpl": form_tpl, "inv": inv}


def write_role_permissions(ut_rows):
    path = BASE / "10_role_permissions.csv"
    fields = [
        "template_id",
        "template_type",
        "name_ar",
        "prepared_by",
        "approved_by",
        "rapporteur_vacant",
        "form_count",
        "notes",
    ]
    rows = []
    for r in ut_rows:
        tid = r["template_id"]
        m = TEMPLATE_TYPES[tid]
        rows.append(
            {
                "template_id": tid,
                "template_type": m["template_type"],
                "name_ar": r["name_ar"],
                "prepared_by": m["prepared_by_role"],
                "approved_by": m["approved_by_role"],
                "rapporteur_vacant": m["rapporteur_vacant"],
                "form_count": r["form_count"],
                "notes": m["notes"],
            }
        )
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    return rows


def write_rapporteur_csv():
    path = BASE / "10_rapporteur_candidates.csv"
    fields = [
        "committee_id",
        "committee_name",
        "candidate_id",
        "candidate_name",
        "role",
        "confidence",
        "qualification_notes",
        "recommendation_rank",
        "auto_appointed",
    ]
    rows = []
    rank = {"COM-guidance": 0, "COM-exams": 0, "COM-resources": 0}
    for cid, cname, pid, pname, role, conf, notes in RAPPORTEURS:
        rank[cid] += 1
        rows.append(
            {
                "committee_id": cid,
                "committee_name": cname,
                "candidate_id": pid,
                "candidate_name": pname,
                "role": role,
                "confidence": conf,
                "qualification_notes": notes,
                "recommendation_rank": str(rank[cid]),
                "auto_appointed": "no",
            }
        )
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    return rows


def write_manager_delegation(form_tpl, inv):
    cards = list(csv.DictReader((BASE / "04_person_task_cards.csv").open(encoding="utf-8-sig")))
    mgr = next(x for x in cards if "نايف" in x["person_name"] or "مدير" in (x.get("role") or ""))
    tasks = [t.strip() for t in mgr["tasks"].split("|") if t.strip()]
    approved_ids = [x for x in (mgr.get("forms_approved") or "").split(";") if x]

    # تصنيف تفويض المهام الـ12 النصية (+ الإشارة إلى tasks_count=37 المجمّد)
    task_plans = [
        (1, "keep", "مدير المدرسة", "مدير المدرسة", "قيم وطنية وانتماء — مسؤولية قيادية غير قابلة للتفويض الكامل"),
        (2, "delegate_prep", "مدير المدرسة", "وكيل الشؤون التعليمية (إعداد) · مدير (اعتماد)", "قيادة الخطة: الإعداد يُفوَّض · الاعتماد يبقى"),
        (3, "delegate_ops", "مدير المدرسة", "وكلاء + رؤساء لجان", "كفاءة الأداء اليومية — تشغيل مفوَّض · رقابة مدير"),
        (4, "delegate_prep", "مدير المدرسة", "وكيل شؤون الطلاب / التوعية (تنفيذ) · مدير (إشراف)", "وعي فكري: التنفيذ والمتابعة اليومية مفوَّضان"),
        (5, "keep", "مدير المدرسة", "مدير المدرسة", "حماية المجتمع المدرسي — قرار سيادي"),
        (6, "share", "مدير المدرسة", "وكيل طلاب + موجه (رصد) · مدير (تصعيد)", "الرصد يُفوَّض · التصعيد للمدير"),
        (7, "share", "مدير المدرسة", "وكيل/موجه (رصد أولي) · مدير (معالجة حساسة)", "المعالجة الحساسة تبقى"),
        (8, "keep", "مدير المدرسة", "مدير المدرسة", "الرفع لصاحب الصلاحية — صلاحية المدير"),
        (9, "delegate_prep", "مدير المدرسة", "وكيل (مسودة التقرير) · مدير (اعتماد الإرسال)", "التقرير الدوري: إعداد مفوَّض"),
        (10, "keep", "مدير المدرسة", "مدير المدرسة", "مفاضلة الكوادر واعتماد التقويم — غير مفوَّض"),
        (11, "delegate_ops", "مدير المدرسة", "وكلاء (توزيع تشغيلي) · مدير (تكاليف حساسة)", "التوزيع الروتيني للوكلاء"),
        (12, "keep", "مدير المدرسة", "مدير المدرسة", "اعتماد التقويم النهائي للمنسوبين — يبقى"),
    ]

    # تفويض الاعتمادات الـ36 حسب القالب
    appr_rows = []
    keep_mgr = 0
    del_first = 0
    for fid in approved_ids:
        row = inv.get(fid, {})
        title = (row.get("العنوان") or "")[:60]
        typ = row.get("النوع") or ""
        tpl = form_tpl.get(fid, "TPL-09")
        # قواعد
        if tpl == "TPL-03" and any(
            k in title
            for k in (
                "اللجنة الإدارية",
                "الميزانية",
                "الخطة التشغيلية",
                "ضبط واقعة",
                "مخالفة",
                "مجلس المدرسة",
                "توزيع المهام الإدارية",
            )
        ):
            decision = "keep_manager"
            proposed = "مدير المدرسة"
            reason = "محضر حساس/إداري — اعتماد مدير"
            keep_mgr += 1
        elif tpl in ("TPL-03", "TPL-08") and "اعتماد" not in title:
            decision = "first_line_vice"
            proposed = "وكيل مختص (اعتماد أول) · إخطار المدير"
            reason = "محضر لجنة روتيني — يُخفَّف عبء المدير (يحتاج قرار صلاحيات إداري)"
            del_first += 1
        elif tpl == "TPL-09" or "اعتماد" in title:
            decision = "keep_manager_or_policy"
            proposed = "مدير المدرسة أو تفويض كتابي لوكيل"
            reason = "نموذج اعتماد صريح — يبقى أو يُفوَّض بقرار إداري مكتوب"
            keep_mgr += 1
        elif tpl == "TPL-01":
            decision = "first_line_vice"
            proposed = "وكيل الشؤون التعليمية"
            reason = "تقرير تكريم/برنامج — لا يلزم مدير كاعتماد أول"
            del_first += 1
        else:
            decision = "first_line_vice"
            proposed = "وكيل مختص"
            reason = "منخفض المخاطر نسبياً"
            del_first += 1
        appr_rows.append((fid, tpl, typ, title, decision, proposed, reason))

    lines = [
        "# 10_manager_delegation — تفويض عبء المدير (خ10)",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "## الحالة: **توصية فقط** · التفعيل صلاحية المدير · قد يحتاج قرار تغيير صلاحيات",
        "## المراجع: 04_person_task_cards · 09c · 08_unified_templates · قرار 97",
        "",
        "## 1) الأرقام المرجعية",
        f"| البند | القيمة | مصدر |",
        f"|---|---|---|",
        f"| tasks_count في بطاقة المدير | **{mgr.get('tasks_count')}** | خ4 (مجمّد) |",
        f"| نصوص مهام مفصولة في الحقل | **{len(tasks)}** | خ4 نص البطاقة |",
        f"| نماذج اعتماد (forms_approved) | **{len(approved_ids)}** | خ4 |",
        f"| الشخص | {mgr.get('person_name')} ({mgr.get('role')}) | هوية |",
        "",
        "> ملاحظة: العدد 37 مجمّد في البطاقة؛ النص المستخرج حالياً يعرض "
        f"{len(tasks)} بنداً قيادياً صريحاً. خ10 تُفوّض على الاثنين: البنود النصية + الـ36 اعتماداً.",
        "",
        "## 2) تفويض المهام النصية",
        "| # | المهمة (مختصر) | الدور الحالي | الدور المقترح | القرار | المبرر |",
        "|---:|---|---|---|---|---|",
    ]
    for idx, action, cur, prop, why in task_plans:
        short = tasks[idx - 1][:70] + ("…" if len(tasks[idx - 1]) > 70 else "")
        lines.append(f"| {idx} | {short} | {cur} | {prop} | {action} | {why} |")

    keep_tasks = sum(1 for _, a, *_ in task_plans if a == "keep")
    del_tasks = len(task_plans) - keep_tasks

    lines += [
        "",
        f"- مهام تبقى للمدير (من الـ{len(tasks)}): **{keep_tasks}**",
        f"- مهام قابلة لتفويض إعداد/تشغيل/مشاركة: **{del_tasks}**",
        "",
        "## 3) تفويض الاعتمادات (36 نموذجاً)",
        f"| الإحصاء بعد التوصية | العدد |",
        f"|---|---:|",
        f"| يبقى اعتماد مدير (أو يحتاج تفويضاً كتابياً) | **{keep_mgr}** |",
        f"| اعتماد أول مقترح لوكيل | **{del_first}** |",
        f"| المجموع | **{len(approved_ids)}** |",
        "",
        "### التفصيل",
        "| form_id | القالب | النوع | العنوان | القرار | الدور المقترح | المبرر |",
        "|---|---|---|---|---|---|---|",
    ]
    for fid, tpl, typ, title, decision, proposed, reason in appr_rows:
        lines.append(
            f"| {fid} | {tpl} | {typ} | {title} | {decision} | {proposed} | {reason} |"
        )

    lines += [
        "",
        "## 4) التوصية النهائية لعدد اعتمادات المدير",
        f"- **قبل التفويض:** {len(approved_ids)} اعتماداً.",
        f"- **بعد التفويض المقترح:** يبقى نحو **{keep_mgr}** اعتماداً للمدير "
        f"(حساسة/صريحة)، ويُنقل نحو **{del_first}** لاعتماد أول لدى الوكيل.",
        "- **شرط:** بعض النقل يحتاج قراراً إدارياً بتعديل صلاحيات الاعتماد (تحفظ 3).",
        "- لا تعيين آلي في النظام.",
        "",
        "## 5) حدود",
        "- لم تُمسح لجان إضافية بلا مقرّر (تحفظ 2 — ثلاث فقط).",
        "- لا خ6/خ7.",
        "",
    ]
    (BASE / "10_manager_delegation.md").write_text("\n".join(lines), encoding="utf-8")
    return {
        "tasks_text": len(tasks),
        "tasks_count_card": mgr.get("tasks_count"),
        "approvals": len(approved_ids),
        "keep_mgr": keep_mgr,
        "del_first": del_first,
        "keep_tasks": keep_tasks,
        "del_tasks": del_tasks,
    }


def write_report(perm_rows, rapp_rows, dele_stats, ut_rows):
    n_prep = sum(1 for r in perm_rows if r["prepared_by"] and r["prepared_by"] != "—")
    n_appr = sum(
        1
        for r in perm_rows
        if r["approved_by"] and not r["approved_by"].startswith("—")
    )
    n_rapp = sum(1 for r in perm_rows if r["rapporteur_vacant"] == "نعم")
    lines = f"""# 10_permissions_report — تقرير توزيع الصلاحيات (خ10)
## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}
## الحالة: مُسلَّم · توصيات فقط · قرارات 95–97 · لا خ6/خ7

## 1) جواب قرار 96 — أنواع القوالب (أ) لا (ب)
القوالب **ثمانية عائلات وظيفية مختلفة + مفرد**، وليست تقارير بأشكال متعددة فقط:

| القالب | template_type | العدد | تركيب النوع |
|---|---|---:|---|
"""
    for r in ut_rows:
        lines += f"| {r['template_id']} | {r['template_type']} | {r['form_count']} | {r['type_composition']} |\n"

    lines += f"""
### توضيح رئيس المشروع عن TPL-01 / 05 / 09
- **TPL-01 (170):** نوعه **تقرير** (169 تقرير + 1 بطاقة). من أصل 230 تقريراً في الجرد: 169 هنا + 33 في TPL-08 + 24 في TPL-09 + 4 في TPL-02 = 230.
- **TPL-05 (104):** نوعه **سجل** بالكامل (104/112 تقريباً من سجلات الجرد؛ الباقي في كتلة التطوع TPL-08).
- **TPL-09 (98):** مفردات — غالباً **نماذج** (67) وتعريفات/أغلفة تقارير (24) وخطابات (5) وبطاقات (2).

## 2) إحصاء الصلاحيات على القوالب
| المقياس | العدد |
|---|---:|
| قوالب لها prepared_by معرّف | **{n_prep}** / 9 |
| قوالب لها approved_by غير فارغ/شرطي | **{n_appr}** / 9 |
| قوالب rapporteur_vacant=نعم | **{n_rapp}** (TPL-03 · TPL-04) |

## 3) عبء المدير بعد التفويض المقترح
| البند | قبل | بعد (توصية) |
|---|---:|---:|
| اعتمادات النماذج | {dele_stats['approvals']} | **{dele_stats['keep_mgr']}** تبقى للمدير · **{dele_stats['del_first']}** اعتماد أول لوكيل |
| مهام نصية مفصولة | {dele_stats['tasks_text']} | **{dele_stats['keep_tasks']}** تبقى · **{dele_stats['del_tasks']}** تفويض/مشاركة |
| tasks_count البطاقة (مجمّد) | {dele_stats['tasks_count_card']} | يُعاد احتسابه تشغيلياً بعد قرار المدرسة |

## 4) المقرّرون
- **3 لجان فقط** (التوجيه · التحصيل · المصادر) — بلا توسيع (تحفظ 2).
- مرشحون من الهوية: **{sum(1 for r in rapp_rows if not r['candidate_id'].startswith('ROLE'))}** أشخاص + role_slot للموجه.
- `auto_appointed=no` لجميع الصفوف.
- معيار الاختيار: عضوية اللجنة + إشارة نور (موجه/وكيل) عند وجودها + فصل عن الرئاسة.

## 5) المخرجات
- `10_role_permissions.csv`
- `10_manager_delegation.md`
- `10_rapporteur_candidates.csv`
- `10_permissions_report.md`
- `10_run_log.md`
- تحديث: `08_unified_templates.csv` (+`template_type` +`type_composition`)

## 6) الخطوة التالية المقترحة
الدليل التشغيلي (المرحلة هـ) — يشرح القوالب التسعة وصلاحيات الإعداد/الاعتماد والمقرّرين المرشّحين.
"""
    (BASE / "10_permissions_report.md").write_text(lines, encoding="utf-8")


def write_run_log(dele_stats):
    text = f"""# 10_run_log — سجل تنفيذ خ10
## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}

| الخطوة | الحالة | تفصيل |
|---|---|---|
| إضافة template_type لـ 08_unified_templates.csv | OK | + type_composition |
| 10_role_permissions.csv | OK | 9 صفوف |
| 10_manager_delegation.md | OK | {dele_stats['tasks_text']} مهام نصية · {dele_stats['approvals']} اعتماداً |
| 10_rapporteur_candidates.csv | OK | 3 لجان · مرشحون · auto_appointed=no |
| 10_permissions_report.md | OK | — |
| تعيين آلي | لا | — |
| خ6/خ7 | لم تُفتح | — |

## ملخص
- اعتمادات المدير المقترح إبقاؤها: **{dele_stats['keep_mgr']}**
- اعتمادات أول لوكيل: **{dele_stats['del_first']}**
"""
    (BASE / "10_run_log.md").write_text(text, encoding="utf-8")


def main():
    u = load_u()
    patched = patch_unified_templates(u)
    perm = write_role_permissions(patched["rows"])
    rapp = write_rapporteur_csv()
    dele = write_manager_delegation(patched["form_tpl"], patched["inv"])
    write_report(perm, rapp, dele, patched["rows"])
    write_run_log(dele)
    print("OK templates", len(patched["rows"]))
    print("DELE", dele)
    for r in patched["rows"]:
        print(r["template_id"], r["template_type"], r["form_count"], r["type_composition"])


if __name__ == "__main__":
    main()
