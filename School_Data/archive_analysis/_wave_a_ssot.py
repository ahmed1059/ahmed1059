# -*- coding: utf-8 -*-
"""موجة أ: تصحيح SSOT وفق وثائق المدرسة الرسمية."""
import json
from pathlib import Path
from datetime import date

root = Path(__file__).resolve().parents[2]
today = str(date.today())

SRC_EXT = (
    "تحليل التقرير الخارجي لسعد بن الربيع.pdf · دورة التقويم الأولى 1448هـ"
)
SRC_NAF = "1448 تحليل بطاقة نافس.pdf · ثالث متوسط · S-40341"
SRC_IMP = "خطة_التحسين_متوسطة_سعد_بن_الربيع.pdf + خطة تحسين تقرير الخارجي 1448"
SRC_REAL = "تحليل_واقع_متوسطة_سعد_بن_الربيع.pdf"
SRC_ALG = "بنك المعلومات/بنك معلومات النظام 2.txt · موجة أ"

perf = {
    "meta": {
        "title": "مركز بيانات الأداء — مصدر الحقيقة الواحد",
        "school": "متوسطة سعد بن الربيع الأنصاري",
        "ministry_id": "S-40341",
        "stage": "المتوسطة",
        "gender": "بنين",
        "students_total": 354,
        "evaluation_cycle": "الدورة الأولى للتقويم الخارجي · 1448هـ",
        "updated": today,
        "wave": "A-SSOT-correct",
        "rule": "لا تُكتب هذه الأرقام يدويًا في HTML/JS؛ تُقرأ من هذا الملف فقط",
        "sources": {
            "nafes": SRC_NAF,
            "external_evaluation": SRC_EXT,
            "improvement_plan": SRC_IMP,
            "reality_swot": SRC_REAL,
            "algorithm": SRC_ALG,
        },
        "level_vocabulary": ["تهيئة", "انطلاق", "تقدم", "تميز"],
        "sustainability_adopted": False,
        "canonical_path": "config/performance_metrics.json",
        "serve_mirror": "Print_Canvas/components/_shared/performance_metrics.json",
        "corrections_from_prior_wave": [
            "إلغاء aliases الخاطئة 3-1-3-1 و7-1-1-2 و1-1-1-4 كرموز تهيئة",
            "اعتماد التهيئة الرسمية: 1-3-1-3 · 2-1-1-7 · 4-1-1-1 · 4-1-1-3",
            "إثراء نافس بأرقام البطاقة التفصيلية (101 مختبرًا)",
        ],
    },
    "code_aliases": {
        "note": "أخطاء ترقيم سابقة (محادثة) → الرمز الرسمي في إطار ETEC / خطة التحسين",
        "map": [
            {
                "wrong_or_legacy": "3-1-3-1",
                "etec_code": "1-3-1-3",
                "label": "الشراكة المجتمعية",
                "level": "تهيئة",
            },
            {
                "wrong_or_legacy": "7-1-1-2",
                "etec_code": "2-1-1-7",
                "label": "مهارات التفكير العليا",
                "level": "تهيئة",
            },
            {
                "wrong_or_legacy": "1-1-1-4",
                "etec_code": "4-1-1-1",
                "label": "تنظيم المبنى المدرسي",
                "level": "تهيئة",
            },
            {
                "wrong_or_legacy": "3-1-1-4",
                "etec_code": "4-1-1-3",
                "label": "المرافق المساندة وذوو الإعاقة",
                "level": "تهيئة",
                "note": "كان مرشّحًا خطأً؛ الرسمي في خطة التحسين 4-1-1-3",
            },
        ],
    },
    "school_profile": {
        "name": "متوسطة سعد بن الربيع الأنصاري",
        "ministry_id": "S-40341",
        "education_admin": "الإدارة العامة للتعليم بمنطقة المدينة المنورة",
        "students_total": 354,
        "nafes_tested": 101,
        "source": SRC_NAF + " · " + SRC_EXT,
    },
    "nafes": {
        "meta": {
            "grade": "ثالث متوسط",
            "tested_count": 101,
            "triple_domains_mastery_pct": 5.0,
            "triple_domains_mastery_approx_students": 5,
            "triple_domains_mastery_delta_points": -11.2,
            "average_mastery_pct": 29.7,
            "source": SRC_NAF,
        },
        "math": {
            "score": 18.8,
            "target": 25.0,
            "unit": "%",
            "label": "نسبة الإتقان — الرياضيات",
            "binding_key": "nafes.math",
            "delta_points": -10,
            "low_or_very_low_pct": 81.2,
            "weakest_subskill": {"name": "الجبر", "score": 28.7},
            "below_admin_and_kingdom_avg": True,
            "etec_indicator": "3-1-1-2",
            "source": SRC_NAF,
            "target_source": "مستهدف تشغيلي معتمد من رئيس المشروع (موجة سابقة) · يُراجع عند تحديث خطة نافس",
        },
        "reading": {
            "score": 27.7,
            "target": 35.0,
            "unit": "%",
            "label": "نسبة الإتقان — القراءة",
            "binding_key": "nafes.reading",
            "delta_points": -25.5,
            "low_or_very_low_pct": 72.3,
            "weakest_subskill": {"name": "دلالات الألفاظ", "score": 23.8},
            "above_admin_and_kingdom_avg": True,
            "etec_indicator": "3-1-1-1",
            "source": SRC_NAF,
            "target_source": "مستهدف تشغيلي معتمد من رئيس المشروع (موجة سابقة)",
        },
        "science": {
            "score": 42.5,
            "target": 50.0,
            "unit": "%",
            "label": "نسبة الإتقان — العلوم",
            "binding_key": "nafes.science",
            "delta_points": -5.3,
            "low_or_very_low_pct": 59.4,
            "weakest_subskill": {
                "name": "العلوم الفيزيائية والكيميائية",
                "score": 30.7,
            },
            "etec_indicator": "3-1-1-3",
            "source": SRC_NAF,
            "target_source": "مستهدف تشغيلي معتمد من رئيس المشروع (موجة سابقة)",
        },
    },
    "external_evaluation": {
        "overall": {
            "score": 71.0,
            "unit": "%",
            "level": "انطلاق",
            "label": "الدرجة الكلية للتقرير الخارجي",
            "binding_key": "external.overall",
            "source": SRC_EXT,
        },
        "administration": {
            "score": 78.75,
            "unit": "%",
            "level": "تقدم",
            "gap_to_excellence_pp": 11.25,
            "label": "مجال الإدارة المدرسية",
            "binding_key": "external.administration",
            "source": SRC_EXT,
        },
        "outcomes": {
            "score": 74.75,
            "unit": "%",
            "level": "انطلاق",
            "gap_to_progress_pp": 0.25,
            "label": "مجال نواتج التعلم",
            "binding_key": "external.outcomes",
            "source": SRC_EXT,
        },
        "teaching": {
            "score": 65.5,
            "unit": "%",
            "level": "انطلاق",
            "gap_to_progress_pp": 9.5,
            "label": "مجال التعليم والتعلم",
            "binding_key": "external.teaching",
            "source": SRC_EXT,
        },
        "environment": {
            "score": 60.5,
            "unit": "%",
            "level": "انطلاق",
            "gap_to_progress_pp": 14.5,
            "label": "مجال البيئة المدرسية",
            "binding_key": "external.environment",
            "priority": "قصوى",
            "domain_target_pct": 75.0,
            "domain_target_source": SRC_IMP,
            "source": SRC_EXT,
        },
        "indicator_distribution": {
            "total": 41,
            "excellence": 6,
            "progress": 13,
            "launch": 18,
            "preparation": 4,
            "source": SRC_EXT,
        },
    },
    "indicators": {
        "1-3-1-3": {
            "text": "تعزز المدرسة الشراكة المجتمعية لدعم التعلم والتأثير الإيجابي في المجتمع المحلي.",
            "level_current": "تهيئة",
            "level_target": "انطلاق",
            "score_note": "أقل من 50%",
            "priority": "عاجلة",
            "domain": "الإدارة المدرسية",
            "source": SRC_EXT + " · " + SRC_IMP,
        },
        "2-1-1-7": {
            "text": "تنمي المدرسة مهارات التفكير العليا لدى المتعلمين.",
            "level_current": "تهيئة",
            "level_target": "انطلاق",
            "score_note": "أقل من 50%",
            "priority": "عاجلة",
            "domain": "التعليم والتعلم",
            "source": SRC_EXT + " · " + SRC_IMP,
            "provisional": False,
        },
        "4-1-1-1": {
            "text": "تنظيم مبنى المدرسة ملائم لعدد المتعلمين والمرحلة العمرية.",
            "level_current": "تهيئة",
            "level_target": "انطلاق",
            "score_note": "أقل من 50%",
            "priority": "عاجلة",
            "domain": "البيئة المدرسية",
            "source": SRC_EXT + " · " + SRC_IMP,
            "provisional": False,
        },
        "4-1-1-3": {
            "text": "تلبي المرافق والخدمات المساندة احتياجات المتعلمين بمن فيهم ذوو الإعاقة.",
            "level_current": "تهيئة",
            "level_target": "انطلاق",
            "score_note": "أقل من 50%",
            "priority": "عاجلة",
            "domain": "البيئة المدرسية",
            "source": SRC_EXT + " · " + SRC_IMP,
            "provisional": False,
        },
        "1-3-1-1": {
            "score": 78.75,
            "level_current": "تميز",
            "level_target": "تميز",
            "target_note": "الحفاظ على التميز",
            "text": "تعزز المدرسة بناء العلاقات الإيجابية والتعاون في المجتمع المدرسي.",
            "source": SRC_EXT,
        },
        "1-4-1-3": {
            "score": 78.75,
            "level_current": "تميز",
            "level_target": "تميز",
            "target_note": "الحفاظ على التميز",
            "text": "تطبق المدرسة التقويم الذاتي المبني على المعايير المعتمدة من الهيئة.",
            "source": SRC_EXT,
        },
        "3-2-1-1": {
            "score": 78.75,
            "level_current": "تميز",
            "level_target": "تميز",
            "target_note": "الحفاظ على التميز",
            "text": "يظهر المتعلمون الاعتزاز بالقيم والهوية الوطنية.",
            "source": SRC_EXT,
        },
        "3-2-1-2": {
            "score": 78.75,
            "level_current": "تميز",
            "level_target": "تميز",
            "target_note": "الحفاظ على التميز",
            "text": "يظهر المتعلمون اتجاهات إيجابية نحو ذواتهم.",
            "source": SRC_EXT,
        },
        "3-2-1-3": {
            "score": 78.75,
            "level_current": "تميز",
            "level_target": "تميز",
            "target_note": "الحفاظ على التميز",
            "text": "يظهر المتعلمون التزامًا بالممارسات الصحية السليمة.",
            "source": SRC_EXT,
        },
        "3-2-1-7": {
            "score": 78.75,
            "level_current": "تميز",
            "level_target": "تميز",
            "target_note": "الحفاظ على التميز",
            "text": "يظهر المتعلمون اعتزازًا بثقافتهم واحترامًا للتنوع الثقافي.",
            "source": SRC_EXT,
        },
        "4-2-1-3": {
            "level_current": "تميز",
            "level_target": "تميز",
            "target_note": "الحفاظ على التميز — نقطة قوة تُبنى عليها في مجال البيئة",
            "text": "تعمل المدرسة على نظافة المبنى المدرسي وجميع مرافقه بانتظام.",
            "source": SRC_EXT + " · " + SRC_REAL,
        },
        "3-1-1-1": {
            "level_current": "تقدم",
            "level_target": "تميز",
            "score_approx_from_card": 82,
            "score_note": "≈ من بطاقة التحليل الخارجي لمؤشر القراءة · التفاصيل من نافس أدق",
            "nafes_binding": "nafes.reading",
            "source": SRC_EXT,
        },
        "3-1-1-2": {
            "level_current": "انطلاق",
            "level_target": "تقدم",
            "score_approx_from_card": 62,
            "nafes_binding": "nafes.math",
            "source": SRC_EXT,
        },
        "3-1-1-3": {
            "level_current": "انطلاق",
            "level_target": "تقدم",
            "score_approx_from_card": 62,
            "nafes_binding": "nafes.science",
            "source": SRC_EXT,
        },
    },
    "improvement_goals": {
        "partnership": {
            "text": "إطلاق مبادرات شراكة مجتمعية فعلية (مؤسسات محلية، أولياء أمور) لدعم التعلم.",
            "binds_indicators": ["1-3-1-3"],
            "duration": "العام الدراسي كاملاً",
            "implementers": ["مدير المدرسة"],
            "shared_with": ["لجنة التميز"],
            "external_support": "فارغ معتمد",
            "source": SRC_IMP,
        },
        "higher_thinking": {
            "text": "تنويع استراتيجيات التدريس ودمج التقنية وتنمية مهارات التفكير العليا ضمن الأنشطة الصفية.",
            "binds_indicators": ["2-1-1-7"],
            "duration": "فصل دراسي",
            "implementers": ["وكيل الشؤون التعليمية", "جميع المعلمين"],
            "shared_with": ["مجتمعات التعلم المهنية"],
            "external_support": "فارغ معتمد",
            "source": SRC_IMP,
            "provisional_etec": False,
        },
        "building": {
            "text": "متابعة الجهات ذات العلاقة لتطوير تنظيم المبنى وتجهيز الفصول والمعامل بما يراعي ذوي الإعاقة.",
            "binds_indicators": ["4-1-1-1"],
            "duration": "فصل دراسي كامل",
            "implementers": ["مدير المدرسة", "وكيل المدرسة"],
            "shared_with": ["فريق الأمن والسلامة"],
            "external_support": "الدفاع المدني، صيانة المباني، الإدارة العامة للتعليم",
            "source": SRC_IMP,
            "provisional_etec": False,
        },
        "disability_facilities": {
            "text": "توفير مرافق وخدمات مساندة ملائمة تلبي احتياجات جميع المتعلمين بمن فيهم ذوو الإعاقة.",
            "binds_indicators": ["4-1-1-3"],
            "duration": "فصل دراسي كامل",
            "implementers": ["مدير المدرسة", "وكيل المدرسة"],
            "shared_with": ["فارغ معتمد"],
            "external_support": "فارغ معتمد",
            "source": SRC_IMP,
            "provisional_etec": False,
        },
        "math_science_reading_boost": {
            "text": "بناء خطط علاجية عاجلة منفصلة للقراءة والرياضيات والعلوم تستهدف المجالات الفرعية الأضعف (دلالات الألفاظ، الجبر، العلوم الفيزيائية والكيميائية).",
            "binds_indicators": ["3-1-1-1", "3-1-1-2", "3-1-1-3"],
            "duration": "فصل دراسي",
            "implementers": [
                "معلمو اللغة العربية والرياضيات والعلوم",
                "وكيل الشؤون التعليمية",
                "المرشد الطلابي",
            ],
            "shared_with": ["مجتمعات التعلم المهنية"],
            "external_support": "فارغ معتمد",
            "success_binding": ["nafes.math", "nafes.reading", "nafes.science"],
            "first_action": "اجتماع عاجل لمعلمي الرياضيات لمراجعة أداء الجبر وخطة علاجية سريعة",
            "source": SRC_IMP,
        },
    },
    "program_bindings": {
        "national_day": {
            "indicator_codes": ["1-3-1-3", "3-2-1-1"],
            "improvement_goal_key": "partnership",
            "metrics_keys": [
                "external.administration",
                "indicators.1-3-1-3",
                "indicators.3-2-1-1",
            ],
        },
        "school_broadcast": {
            "indicator_codes": ["1-3-1-3"],
            "improvement_goal_key": "partnership",
            "metrics_keys": ["external.administration", "indicators.1-3-1-3"],
        },
        "radio_program": {
            "indicator_codes": ["1-3-1-3"],
            "improvement_goal_key": "partnership",
            "metrics_keys": ["external.administration", "indicators.1-3-1-3"],
            "duplicate_tagged": True,
        },
        "partnership": {
            "indicator_codes": ["1-3-1-3"],
            "improvement_goal_key": "partnership",
            "metrics_keys": ["indicators.1-3-1-3"],
        },
        "parent_meet": {
            "indicator_codes": ["1-3-1-2", "1-3-1-3"],
            "improvement_goal_key": "partnership",
            "metrics_keys": ["indicators.1-3-1-3"],
        },
        "critical_thinking": {
            "indicator_codes": ["2-1-1-7"],
            "improvement_goal_key": "higher_thinking",
            "metrics_keys": ["indicators.2-1-1-7", "external.teaching"],
        },
        "lab_setup": {
            "indicator_codes": ["4-1-1-1", "4-1-1-3"],
            "improvement_goal_key": "building",
            "metrics_keys": ["indicators.4-1-1-1", "external.environment"],
        },
        "building": {
            "indicator_codes": ["4-1-1-1", "4-2-1-2"],
            "improvement_goal_key": "building",
            "metrics_keys": ["indicators.4-1-1-1", "external.environment"],
        },
        "fun_math": {
            "indicator_codes": ["3-1-1-2", "2-1-1-6"],
            "improvement_goal_key": "math_science_reading_boost",
            "metrics_keys": ["nafes.math"],
        },
        "nafs": {
            "indicator_codes": ["3-1-1-1", "3-1-1-2", "3-1-1-3"],
            "improvement_goal_key": "math_science_reading_boost",
            "metrics_keys": ["nafes.math", "nafes.reading", "nafes.science"],
        },
        "support": {
            "indicator_codes": ["3-1-1-2", "3-1-1-3", "2-1-1-6"],
            "improvement_goal_key": "math_science_reading_boost",
            "metrics_keys": ["nafes.math", "nafes.science"],
        },
        "loss": {
            "indicator_codes": ["3-1-1-1", "3-1-1-2", "3-1-1-3"],
            "improvement_goal_key": "math_science_reading_boost",
            "metrics_keys": ["nafes.math", "nafes.reading", "nafes.science"],
        },
        "reading_init": {
            "indicator_codes": ["2-1-1-2", "2-1-1-6", "3-1-1-1"],
            "improvement_goal_key": "math_science_reading_boost",
            "metrics_keys": ["nafes.reading"],
        },
    },
}

blob = json.dumps(perf, ensure_ascii=False, indent=2)
canon = root / "config" / "performance_metrics.json"
mirror = root / "Print_Canvas/components/_shared/performance_metrics.json"
canon.parent.mkdir(exist_ok=True)
canon.write_text(blob, encoding="utf-8")
mirror.write_text(blob, encoding="utf-8")
print("WROTE", canon)
print("MIRROR", mirror)

# patch map meta
map_path = root / "Print_Canvas/components/_shared/program_goal_indicator_map.json"
m = json.loads(map_path.read_text(encoding="utf-8"))
m["meta"]["updated"] = today
m["meta"]["ssot_wave"] = "A-SSOT-correct"
m["meta"]["code_schema_note"] = (
    "رموز التهيئة الرسمية: 1-3-1-3 · 2-1-1-7 · 4-1-1-1 · 4-1-1-3. "
    "aliases الخاطئة السابقة موثّقة في performance_metrics.code_aliases."
)
# fix partnership detailed objective note if present
for p in m["programs"]:
    if p["program_id"] in ("national_day", "school_broadcast", "radio_program"):
        for d in p.get("detailed_objectives") or []:
            d["note"] = (
                "من خطة التحسين — يخدم 1-3-1-3 (تهيئة). "
                "تصحيح: ليس 3-1-3-1."
            )
        if p.get("executive_fields"):
            p["executive_fields"]["note"] = (
                "مؤشرات نافس تخص التحصيل؛ هذه البرامج مربوطة بالشراكة 1-3-1-3."
            )
map_path.write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding="utf-8")
print("MAP_PATCHED")

# gap report
progs = json.loads(
    (root / "Print_Canvas/components/_shared/programs.json").read_text(encoding="utf-8")
)["programs"]
bound = set((perf.get("program_bindings") or {}).keys())
approved = {
    p["program_id"]
    for p in m["programs"]
    if p.get("link_status") == "decision_approved"
}
rows = []
for p in progs:
    pid = p["id"]
    codes = p.get("indicator_codes") or []
    rows.append(
        {
            "id": pid,
            "name": p.get("name"),
            "owner": p.get("owner_role"),
            "has_saved_codes": bool(codes),
            "in_program_bindings": pid in bound,
            "decision_approved": pid in approved,
            "serves_prep": bool(
                set(codes or [])
                & {"1-3-1-3", "2-1-1-7", "4-1-1-1", "4-1-1-3"}
            )
            or pid in bound
            and any(
                c in (perf["program_bindings"][pid].get("indicator_codes") or [])
                for c in ["1-3-1-3", "2-1-1-7", "4-1-1-1", "4-1-1-3"]
            ),
        }
    )

gap_dir = root / "بنك المعلومات" / "cycles" / "1448_external"
gap_dir.mkdir(parents=True, exist_ok=True)
gap = {
    "meta": {
        "wave": "A-SSOT-correct",
        "date": today,
        "programs_total": len(progs),
        "decision_approved_count": len(approved),
        "program_bindings_count": len(bound),
        "prep_indicators": ["1-3-1-3", "2-1-1-7", "4-1-1-1", "4-1-1-3"],
        "not_touched": ["programs.json", "كتيب تشغيلي", "خ6/خ7"],
    },
    "gaps": {
        "no_program_binding": [
            r["id"] for r in rows if not r["in_program_bindings"]
        ],
        "no_saved_indicator_codes": [
            r["id"] for r in rows if not r["has_saved_codes"]
        ],
        "decision_approved_without_binding": [
            r["id"]
            for r in rows
            if r["decision_approved"] and not r["in_program_bindings"]
        ],
    },
    "rows": rows,
}
(gap_dir / "gap_report.json").write_text(
    json.dumps(gap, ensure_ascii=False, indent=2), encoding="utf-8"
)
md = []
md.append("# تقرير فجوات موجة أ — SSOT\n")
md.append(f"**التاريخ:** {today}\n")
md.append("## ما نُفّذ\n")
md.append("- تصحيح `config/performance_metrics.json` + المرآة.\n")
md.append("- رموز التهيئة الرسمية الأربعة مثبتة.\n")
md.append("- نافس مفصّل (101 مختبرًا · فرعيات · تراجعات).\n")
md.append("- `programs.json` لم يُمس.\n")
md.append("\n## فجوات متبقية (موجة ب)\n")
md.append(
    f"- بلا program_bindings: **{len(gap['gaps']['no_program_binding'])}** / {len(progs)}\n"
)
md.append(
    f"- بلا indicator_codes في النواة: **{len(gap['gaps']['no_saved_indicator_codes'])}**\n"
)
md.append(
    f"- معتمدة قرارًا بلا binding: {', '.join(gap['gaps']['decision_approved_without_binding']) or '—'}\n"
)
md.append("\n## اختبار يدوي مطلوب\n")
md.append("1. غيّر `nafes.math.score` في الكنسي وانسخ للمرآة.\n")
md.append("2. حدّث خطتي — يجب ظهور الرقم الجديد في شريط المقاييس.\n")
(gap_dir / "gap_report.md").write_text("".join(md), encoding="utf-8")
print("GAP", gap_dir)

log = root / "School_Data/archive_analysis/decisions_log.md"
t = log.read_text(encoding="utf-8")
if "قرار 169" not in t:
    block = """
### [قرار 169] موجة أ — تصحيح SSOT (أفضل قرار تنفيذي)
- اعتماد خوارزمية `بنك معلومات النظام 2.txt` موجة أ.
- تصحيح رموز التهيئة إلى: `1-3-1-3` · `2-1-1-7` · `4-1-1-1` · `4-1-1-3`.
- تحديث `config/performance_metrics.json` + المرآة + patch خفيف لخريطة الربط.
- تقرير فجوات: `بنك المعلومات/cycles/1448_external/gap_report.md`.
- لا مساس بـ `programs.json` · توقف بعد التسليم.
"""
    log.write_text(t.rstrip() + "\n" + block, encoding="utf-8")
    print("LOG_OK")
else:
    print("LOG_EXISTS")
