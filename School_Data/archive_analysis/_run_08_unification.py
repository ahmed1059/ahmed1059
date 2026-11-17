# -*- coding: utf-8 -*-
"""خ8 — توحيد القوالب (توثيق + توصيات دمج بشرية). لا حذف من 01_inventory. لا خ6/خ7."""
from __future__ import annotations

import csv
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent
ADOPTED_13 = {
    "1-2-1-1",
    "1-3-1-1",
    "1-3-1-2",
    "1-3-1-3",
    "1-4-1-1",
    "1-4-1-2",
    "2-1-1-2",
    "2-1-1-5",
    "2-2-1-1",
    "2-2-1-2",
    "2-2-1-3",
    "2-2-1-4",
    "3-2-1-4",
}

# 8 قوالب موحدة + فئة standalone موثّقة (ضمن حد 6–9 القابل للتوسيع)
TEMPLATES = [
    {
        "template_id": "TPL-01",
        "name_ar": "تقرير برنامج / مسابقة / مبادرة",
        "description": "تقرير تفعيل أو ختام لبرنامج أو مسابقة أو مبادرة بنفس هيكل الشواهد.",
        "needs_expert_review": "false",
        "rapporteur_vacant": "false",
        "prepared_by": "required",
        "approved_by": "optional",
        "default_indicators": "1-4-1-2;2-2-1-1;2-2-1-2;2-2-1-3;2-2-1-4",
    },
    {
        "template_id": "TPL-02",
        "name_ar": "خطة تربوية / تشغيلية / اجتماعات",
        "description": "خطط علاجية وإثرائية وتشغيلية وخطط اجتماعات اللجان.",
        "needs_expert_review": "false",
        "rapporteur_vacant": "false",
        "prepared_by": "required",
        "approved_by": "required",
        "default_indicators": "1-4-1-1;1-4-1-2;2-1-1-2;2-1-1-5",
    },
    {
        "template_id": "TPL-03",
        "name_ar": "محضر لجنة / اجتماع",
        "description": "محاضر اللجان والاجتماعات مع حقل مقرّر قابل للملء عند الشغور.",
        "needs_expert_review": "false",
        "rapporteur_vacant": "true",
        "prepared_by": "required",
        "approved_by": "required",
        "default_indicators": "1-2-1-1;2-1-1-2",
    },
    {
        "template_id": "TPL-04",
        "name_ar": "قرار تشكيل لجنة / فريق",
        "description": "قرارات التشكيل والأسماء والأدوار (رئيس/عضو/مقرّر).",
        "needs_expert_review": "false",
        "rapporteur_vacant": "true",
        "prepared_by": "required",
        "approved_by": "required",
        "default_indicators": "1-2-1-1",
    },
    {
        "template_id": "TPL-05",
        "name_ar": "سجل متابعة تشغيلي",
        "description": "سجلات المتابعة الدورية (غياب، مقصف، مخالفات، تدريب، قيم…).",
        "needs_expert_review": "false",
        "rapporteur_vacant": "false",
        "prepared_by": "required",
        "approved_by": "optional",
        "default_indicators": "2-1-1-2;2-1-1-5;1-3-1-1",
    },
    {
        "template_id": "TPL-06",
        "name_ar": "كشف / قائمة تشغيلية",
        "description": "كشوف الغياب والتسليم والتشكيلات المجدولة.",
        "needs_expert_review": "false",
        "rapporteur_vacant": "false",
        "prepared_by": "required",
        "approved_by": "optional",
        "default_indicators": "2-1-1-5;1-3-1-2",
    },
    {
        "template_id": "TPL-07",
        "name_ar": "استمارة / نموذج تقويم وقياس أثر",
        "description": "استمارات قياس الأثر ونماذج التقويم والتحويل الفردي.",
        "needs_expert_review": "false",
        "rapporteur_vacant": "false",
        "prepared_by": "required",
        "approved_by": "optional",
        "default_indicators": "1-4-1-2;2-2-1-4",
    },
    {
        "template_id": "TPL-08",
        "name_ar": "شراكة مجتمعية / تطوع",
        "description": "كتلة التطوع والشراكة وفق وسم الأرشيف 1-3-1-3 (مراجعة خبير لاحقاً).",
        "needs_expert_review": "true",
        "rapporteur_vacant": "false",
        "prepared_by": "required",
        "approved_by": "optional",
        "default_indicators": "1-3-1-3",
    },
    {
        "template_id": "TPL-09",
        "name_ar": "قالب مفرد (standalone)",
        "description": "نماذج لا تنتمي بوضوح لعائلة مشتركة — تبقى منفصلة بلا إجبار.",
        "needs_expert_review": "false",
        "rapporteur_vacant": "false",
        "prepared_by": "optional",
        "approved_by": "none",
        "default_indicators": "",
    },
]


def parse_inds(raw: str) -> list[str]:
    if not raw:
        return []
    out = []
    for p in re.split(r"[;|,/\s]+", raw.strip()):
        p = p.strip()
        if p in ADOPTED_13 and p not in out:
            out.append(p)
    return out


def classify_title(title: str, form_type: str) -> str:
    t = (title or "").strip()
    low = t
    # تطوع / شراكة أولاً
    if any(k in low for k in ("تطوع", "الشراكة", "شركاء", "العمل التطوعي", "منسق التطوع")):
        return "TPL-08"
    if form_type == "محضر" or low.startswith("محضر"):
        return "TPL-03"
    if form_type == "قرار" or low.startswith("قرار تشكيل") or "تشكيل لجنة" in low:
        return "TPL-04"
    if form_type == "كشف" or low.startswith("كشف") or low.startswith("تشكيل مجالات"):
        return "TPL-06"
    if form_type in ("استمارة", "استبانة") or "قياس الأثر" in low or low.startswith("نموذج تقويم") or low.startswith("نموذج تحويل"):
        return "TPL-07"
    if form_type == "خطة" or low.startswith("خطة") or low.startswith("مواضيع مقترحة"):
        return "TPL-02"
    if form_type == "سجل" or low.startswith("سجل"):
        return "TPL-05"
    if form_type == "تقرير" or low.startswith("تقرير") or low.startswith("مبادرة") or "مسابقة" in low or "أولمبياد" in low:
        # تعريف أدوار → مفرد غالباً
        if low.startswith("تعريف ") or low.startswith("بيانات المدرسة") or low.startswith("البيانات الأساسية"):
            return "TPL-09"
        return "TPL-01"
    if form_type in ("خطاب", "بطاقة"):
        return "TPL-09"
    if form_type == "نموذج":
        if any(k in low for k in ("تحويل", "تقويم", "حصر")):
            return "TPL-07"
        return "TPL-09"
    return "TPL-09"


def main() -> None:
    inv_rows = list(csv.DictReader((BASE / "01_inventory.csv").open(encoding="utf-8-sig")))
    inv = {r["رقم"]: r for r in inv_rows}
    pairs = list(csv.DictReader((BASE / "02_reclassified.csv").open(encoding="utf-8-sig")))

    form_to_tpl: dict[str, str] = {}
    form_inds: dict[str, set[str]] = defaultdict(set)
    tpl_forms: dict[str, set[str]] = defaultdict(set)

    for fid, r in inv.items():
        inds = parse_inds(r.get("explicit_indicator_real") or "")
        for i in inds:
            form_inds[fid].add(i)
        tpl = classify_title(r.get("العنوان") or "", r.get("النوع") or "")
        # إن وُجد 1-3-1-3 صريحاً → كتلة تطوع
        if "1-3-1-3" in inds:
            tpl = "TPL-08"
        form_to_tpl[fid] = tpl
        tpl_forms[tpl].add(fid)

    # نماذج ظهرت في أزواج template_shared
    ts_forms: set[str] = set()
    for p in pairs:
        if p["new_classification"] != "template_shared":
            continue
        ts_forms.add(p["form_a"])
        ts_forms.add(p["form_b"])

    ops = [p for p in pairs if p["new_classification"] == "operational_duplicate"]
    und = [p for p in pairs if p["new_classification"] == "undetermined"]

    # --- 08_duplicates_merged.csv (توصيات دمج بشرية — لا تنفيذ حذف) ---
    # اختيار الأصل = الأصغر رقماً كمرجع أرشيف؛ المدمج = الآخر
    # تجميع تقييم أداء الهيئة: ثلاثة أزواج لنفس العنوان → أصل واحد 104
    merge_rows = []
    for p in ops:
        a, b = p["form_a"], p["form_b"]
        score = float(p["text_score"])
        # قرار بشري موثّق: مرشّح دمج مع إبقاء الأصل في الجرد
        keep, absorb = (a, b) if int(a) <= int(b) else (b, a)
        merge_decision = "merge_candidate_human_review"
        merge_reason = (
            f"عنوان متطابق/شبه متطابق · درجة {score} · تصنيف operational_duplicate — "
            f"يُراجع بشرياً؛ الأصل المرجعي المقترح={keep}؛ النسخة المدمجة المقترحة={absorb}؛ "
            f"لا حذف من 01_inventory"
        )
        # حالات خاصة: ثلاث نسخ تقييم الهيئة → الإبقاء على 104
        if {a, b} <= {"104", "105", "106"}:
            keep = "104"
            if a == "104":
                absorb = b
            elif b == "104":
                absorb = a
            else:
                absorb = f"{a};{b}"
            merge_reason = (
                "ثلاث نسخ لنفس العنوان (تقرير تقييم أداء الهيئة الإدارية) — "
                "الأصل المقترح=104؛ الباقي مرشّح دمج بشري؛ لا حذف آلي"
            )
        merge_rows.append(
            {
                "pair_id": p["pair_id"],
                "form_keep": keep,
                "form_merge_candidate": absorb,
                "title": p["title_a"],
                "type": p["type_a"],
                "text_score": p["text_score"],
                "merge_decision": merge_decision,
                "merge_reason": merge_reason,
                "human_review_required": "yes",
                "deleted_from_inventory": "no",
                "unified_template_id": form_to_tpl.get(keep, "TPL-09"),
                "confidence": p["confidence"],
                "evidence_type": p["evidence_type"],
            }
        )

    # تكرارات إضافية مكتشفة؟ (غير الـ25) — توثيق فقط إن وُجدت عناوين متطابقة خارج ops
    # سياسة: لا نغيّر رقم 25؛ أي جديد يُسجَّل كـ additional_candidate
    title_map: dict[str, list[str]] = defaultdict(list)
    for fid, r in inv.items():
        title_map[(r.get("العنوان") or "").strip()].append(fid)
    additional = []
    ops_ids = {(p["form_a"], p["form_b"]) for p in ops} | {(p["form_b"], p["form_a"]) for p in ops}
    for title, ids in title_map.items():
        if not title or len(ids) < 2:
            continue
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                a, b = ids[i], ids[j]
                if (a, b) in ops_ids:
                    continue
                # فقط إن لم يُصنَّف الزوج أصلاً كـ operational في الملف
                additional.append((a, b, title))

    # لا نُكثر: نسجّل عدداً فقط في التقرير؛ إن وُجدت أزواج عنوان متطابق غير في ops
    extra_count = len(additional)

    dup_path = BASE / "08_duplicates_merged.csv"
    with dup_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "pair_id",
                "form_keep",
                "form_merge_candidate",
                "title",
                "type",
                "text_score",
                "merge_decision",
                "merge_reason",
                "human_review_required",
                "deleted_from_inventory",
                "unified_template_id",
                "confidence",
                "evidence_type",
            ],
        )
        w.writeheader()
        w.writerows(merge_rows)

    # --- 08_unified_templates.csv ---
    ut_rows = []
    for t in TEMPLATES:
        forms = sorted(tpl_forms[t["template_id"]], key=lambda x: int(x))
        # مؤشرات: افتراضي + اتحاد صريح من النماذج (من الـ13 فقط)
        ind_set = set(parse_inds(t["default_indicators"]))
        for fid in forms:
            ind_set |= form_inds.get(fid, set())
        ind_set &= ADOPTED_13
        # عينة نماذج أصلية (حتى 12) + كل المرتبطة بـ template_shared إن أمكن
        sample = forms[:12]
        ts_hit = [fid for fid in forms if fid in ts_forms]
        ut_rows.append(
            {
                "template_id": t["template_id"],
                "name_ar": t["name_ar"],
                "description": t["description"],
                "form_count": str(len(forms)),
                "template_shared_form_count": str(len(ts_hit)),
                "indicators_adopted_13": ";".join(sorted(ind_set)),
                "needs_expert_review": t["needs_expert_review"],
                "rapporteur_vacant": t["rapporteur_vacant"],
                "prepared_by": t["prepared_by"],
                "approved_by": t["approved_by"],
                "sample_form_ids": ";".join(sample),
                "sample_titles": " | ".join(
                    (inv[fid].get("العنوان") or "")[:40] for fid in sample if fid in inv
                ),
            }
        )

    ut_path = BASE / "08_unified_templates.csv"
    with ut_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "template_id",
                "name_ar",
                "description",
                "form_count",
                "template_shared_form_count",
                "indicators_adopted_13",
                "needs_expert_review",
                "rapporteur_vacant",
                "prepared_by",
                "approved_by",
                "sample_form_ids",
                "sample_titles",
            ],
        )
        w.writeheader()
        w.writerows(ut_rows)

    # إحصاء
    counts = {t["template_id"]: len(tpl_forms[t["template_id"]]) for t in TEMPLATES}
    unified_non_standalone = sum(v for k, v in counts.items() if k != "TPL-09")
    standalone = counts.get("TPL-09", 0)
    # نماذج غطّاها مسار القالب المشترك (ظهرت في أزواج TS)
    ts_mapped = sum(1 for fid in ts_forms if form_to_tpl.get(fid) != "TPL-09")
    ts_standalone = sum(1 for fid in ts_forms if form_to_tpl.get(fid) == "TPL-09")
    ops_forms = set()
    for p in ops:
        ops_forms.add(p["form_a"])
        ops_forms.add(p["form_b"])

    # --- template structure md ---
    struct_lines = [
        "# 08_template_structure — هيكل القوالب الموحدة (خ8)",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "## الحالة: توصيف تصميمي · لا حذف من الجرد · لا دمج آلي",
        "## المراجع: قرارات 92–94 · 09a/b/c · 02_reclassified · 01_inventory",
        "",
        "### حقول مشتركة لكل القوالب (حيث ينطبق)",
        "| الحقل | المعنى | ملاحظة |",
        "|---|---|---|",
        "| `prepared_by` | مُعِدّ النموذج (وكيل/منسق/معلم) | required/optional حسب القالب |",
        "| `approved_by` | المعتمد (غالباً المدير) | `none` للقوالب البسيطة — تحفظ 3 |",
        "| `rapporteur_vacant` | حقل مقرّر قابل للملء عند الشغور | true في TPL-03 و TPL-04 |",
        "| `needs_expert_review` | مراجعة خبير تقويم | true في TPL-08 (1-3-1-3) |",
        "| `indicator_codes` | من الـ13 المعتمدة فقط | الـ16 التذييلية مستبعدة |",
        "| `hijri_date` / `gregorian_date` | تاريخ مزدوج في حقل واحد | قاعدة النظام |",
        "",
    ]
    field_specs = {
        "TPL-01": [
            "اسم البرنامج/المسابقة/المبادرة",
            "الفترة الزمنية (هـ/م)",
            "الفئة المستهدفة",
            "الأنشطة المنفذة (جدول)",
            "الشواهد المرفقة",
            "prepared_by · approved_by(optional)",
        ],
        "TPL-02": [
            "عنوان الخطة ونوعها (علاجية/إثرائية/تشغيلية/اجتماعات)",
            "المستهدفون",
            "الأهداف والإجراءات (جدول)",
            "مؤشرات المتابعة (من الـ13)",
            "prepared_by · approved_by(required)",
        ],
        "TPL-03": [
            "اسم اللجنة/الاجتماع",
            "التاريخ المزدوج · رقم المحضر",
            "الحاضرون (جدول)",
            "المقرّر (`rapporteur` أو شاغر rapporteur_vacant)",
            "البنود والتوصيات",
            "prepared_by · approved_by(required)",
        ],
        "TPL-04": [
            "اسم اللجنة/الفريق",
            "الأساس النظامي",
            "جدول الأعضاء: الاسم · الدور (رئيس/عضو/مقرّر)",
            "rapporteur_vacant إن لم يُعيَّن مقرّر",
            "prepared_by · approved_by(required)",
        ],
        "TPL-05": [
            "نوع السجل",
            "جدول المتابعة اليومي/الدوري",
            "الملاحظات والإجراء",
            "prepared_by · approved_by(optional)",
        ],
        "TPL-06": [
            "عنوان الكشف",
            "التاريخ المزدوج",
            "جدول الأسماء/الحالة",
            "prepared_by · approved_by(optional)",
        ],
        "TPL-07": [
            "موضوع التقويم/الأثر",
            "المحاور والدرجات (جدول)",
            "التوصية",
            "prepared_by · approved_by(optional)",
        ],
        "TPL-08": [
            "نوع النشاط: شراكة / تطوع",
            "الجهة الشريكة",
            "المشاركون والساعات",
            "indicator=1-3-1-3 · needs_expert_review=true",
            "prepared_by · approved_by(optional)",
            "لا يُنقل تلقائياً إلى 3-2-1-4",
        ],
        "TPL-09": [
            "يُحفظ العنوان والحقول كما في المصدر",
            "لا يُجبر على عائلة أخرى",
            "prepared_by(optional) · approved_by(none) للقوالب البسيطة (بطاقة/إشعار/خطاب)",
        ],
    }
    for t in TEMPLATES:
        tid = t["template_id"]
        struct_lines += [
            f"## {tid} — {t['name_ar']}",
            f"- الوصف: {t['description']}",
            f"- عدد النماذج المصنّفة: **{counts[tid]}**",
            f"- مؤشرات (13): `{ut_rows[[x['template_id'] for x in ut_rows].index(tid)]['indicators_adopted_13'] or '—'}`",
            f"- prepared_by=`{t['prepared_by']}` · approved_by=`{t['approved_by']}` · "
            f"rapporteur_vacant=`{t['rapporteur_vacant']}` · needs_expert_review=`{t['needs_expert_review']}`",
            "",
            "### الحقول/الجداول/التوقيعات",
        ]
        for item in field_specs[tid]:
            struct_lines.append(f"- {item}")
        struct_lines.append("")

    struct_lines += [
        "## أثر خ9 المبكر على الهيكل",
        "- اللجان بلا مقرّر → TPL-03/TPL-04 تحمل `rapporteur_vacant`.",
        "- عبء المدير → `approved_by` ليس إجبارياً على TPL-01/05/06/07/09.",
        "- تعارض المؤشرات → TPL-08 يبقى على 1-3-1-3 مع `needs_expert_review`.",
        "",
    ]
    (BASE / "08_template_structure.md").write_text("\n".join(struct_lines), encoding="utf-8")

    # --- report ---
    report = f"""# 08_unification_report — تقرير توحيد القوالب (خ8)
## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}
## الحالة: مُسلَّم للتدقيق · قرارات 92–94 · لا خ6/خ7 · لا حذف من الجرد

## 1) الخلاصة التنفيذية
| المؤشر | القيمة |
|---|---:|
| قوالب موحدة معرّفة | **{len(TEMPLATES)}** (ضمن 6–9 + توسعة standalone) |
| نماذج الجرد الكلي | **{len(inv)}** |
| نماذج مصنّفة تحت قوالب غير مفردة (TPL-01…08) | **{unified_non_standalone}** |
| نماذج مفردة (TPL-09 standalone) | **{standalone}** |
| أزواج template_shared (خ2) | **414** |
| نماذج فريدة ظهرت في أزواج TS | **{len(ts_forms)}** |
| منها مُسقطة على قالب عائلي | **{ts_mapped}** |
| منها بقيت مفردة رغم وجود زوج TS | **{ts_standalone}** |
| أزواج operational_duplicate | **{len(ops)}** (ثابت خ2) |
| نماذج فريدة في مسار الدمج المرشّح | **{len(ops_forms)}** |
| تكرارات عنوان متطابق إضافية خارج الـ25 | **{extra_count}** (توثيق فقط — لم تُغيَّر 25) |
| أزواج undetermined | **{len(und)}** |

## 2) توزيع القوالب
| القالب | الاسم | العدد |
|---|---|---:|
"""
    for t in TEMPLATES:
        report += f"| {t['template_id']} | {t['name_ar']} | {counts[t['template_id']]} |\n"

    report += f"""
## 3) مسار الدمج (25)
- كل صف في `08_duplicates_merged.csv` = **مرشّح دمج بشري** (`merge_candidate_human_review`).
- `deleted_from_inventory=no` دائماً.
- ثلاث نسخ «تقييم أداء الهيئة الإدارية» (104/105/106): الأصل المقترح **104**.
- لا دمج آلي نُفِّذ على الملفات المصدر.

## 4) الالتزام بقواعد خ8
| القاعدة | الحالة |
|---|---|
| لا حذف من 01_inventory | ✅ |
| لا دمج آلي | ✅ |
| الربط على 13 فقط | ✅ (الـ16 غير مستخدمة) |
| rapporteur_vacant | ✅ في TPL-03 و TPL-04 |
| prepared_by / approved_by منفصلان | ✅ |
| needs_expert_review | ✅ في TPL-08 |
| تحفظ 3: لا اعتماد إجباري على البسيط | ✅ approved_by=none/optional |
| تحفظ 4: standalone | ✅ TPL-09 = {standalone} نموذجاً |

## 5) أثر على الخطوات التالية
- **خ10 (صلاحيات):** ربط prepared_by/approved_by بالوكلاء والمدير وفق 09c.
- **الدليل التشغيلي:** يشرح القوالب الثمانية + المفرد.
- **خ6/خ7:** ما زالتا مؤجلتين.

## 6) حدود
- التصنيف بالعنوان+النوع+مؤشر صريح — ليس مطابقة هيكل جداول عميقة.
- الأعداد قابلة للمراجعة البشرية قبل اعتماد نهائي للدمج.
- تكرارات إضافية ({extra_count}) موثّقة عدداً فقط؛ لم تُفتح إعادة خ2.
"""
    (BASE / "08_unification_report.md").write_text(report, encoding="utf-8")

    # --- run log ---
    log = f"""# 08_run_log — سجل تنفيذ خ8
## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}

| الخطوة | الحالة | تفصيل |
|---|---|---|
| قراءة 01_inventory | OK | {len(inv)} نموذجاً |
| قراءة 02_reclassified | OK | 414 TS · 25 OD · 2 UND |
| توليد 08_unified_templates.csv | OK | {len(TEMPLATES)} قوالب |
| توليد 08_duplicates_merged.csv | OK | {len(merge_rows)} صف دمج مرشّح |
| توليد 08_template_structure.md | OK | — |
| توليد 08_unification_report.md | OK | — |
| خ6/خ7 | لم تُفتح | — |
| حذف من الجرد | لا | — |
| دمج آلي | لا | — |

## إحصاء التسليم
- قوالب: **{len(TEMPLATES)}**
- نماذج وُحّدت عائلياً (TPL-01…08): **{unified_non_standalone}**
- نماذج بقيت منفصلة (TPL-09): **{standalone}**
- مرشّحو دمج تشغيلي: **{len(ops)}** زوجاً / **{len(ops_forms)}** نموذجاً فريداً
- تكرارات إضافية (عنوان متطابق خارج 25): **{extra_count}** زوجاً محتملاً — توثيق فقط
"""
    (BASE / "08_run_log.md").write_text(log, encoding="utf-8")

    # ملخص stdout
    print("TEMPLATES", len(TEMPLATES))
    print("UNIFIED_FAMILY", unified_non_standalone)
    print("STANDALONE", standalone)
    print("OPS_PAIRS", len(ops), "OPS_FORMS", len(ops_forms))
    print("TS_FORMS", len(ts_forms), "TS_MAPPED", ts_mapped)
    print("EXTRA_TITLE_DUP_PAIRS", extra_count)
    for t in TEMPLATES:
        print(t["template_id"], counts[t["template_id"]])


if __name__ == "__main__":
    main()
