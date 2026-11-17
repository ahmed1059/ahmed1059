# -*- coding: utf-8 -*-
"""قرار 168-ب: تحديث خريطة الربط + مركز الأداء."""
import json
from pathlib import Path
from datetime import date

root = Path(__file__).resolve().parents[2]
map_path = root / "Print_Canvas/components/_shared/program_goal_indicator_map.json"
data = json.loads(map_path.read_text(encoding="utf-8"))

SRC_EXT = "التقرير الخارجي لمدرسة سعد بن الربيع (قرار رئيس المشروع 2026-11-01)"
SRC_IMP = "خطة التحسين الرسمية لمدرسة سعد بن الربيع (قرار رئيس المشروع 2026-11-01)"
SRC_NAF = "بطاقة نافس للمدرسة (قرار رئيس المشروع 2026-11-01)"
SRC_DEC = "اعتماد رئيس المشروع — جدول التعارضات النهائي"

FINAL_CODES = {
    "school_broadcast": ["1-3-1-3"],
    "radio_program": ["1-3-1-3"],
    "national_day": ["1-3-1-3", "3-2-1-1"],
    "speech_contest": ["1-3-1-3"],
    "sports_contests": ["1-3-1-3", "3-2-1-3"],
    "calligraphy_speech_contest": ["1-3-1-3"],
    "white_cane_day": ["1-3-1-3"],
    "rifq": ["1-2-1-1"],
    "disciplined_class": ["1-2-1-1", "3-2-1-5"],
    "reading_init": ["2-1-1-2", "2-1-1-6"],
    "reading_for_all": ["2-1-1-2", "2-1-1-6"],
    "reading_club": ["2-1-1-2", "2-1-1-6"],
    "free_reading_week": ["2-1-1-2", "2-1-1-6"],
    "library_free_reading": ["2-1-1-2", "2-1-1-6"],
    "sources_research": ["2-1-1-2", "2-1-1-6"],
}

PARTNERSHIP_GOAL = (
    "تفعيل شراكات مجتمعية فعلية مع مؤسسات محلية، وتطوير خطة تشغيلية أكثر مرونة وطموحاً."
)

etec = json.loads(
    (root / "Core_Engine/registers_bank/registers_lookup_data.json").read_text(
        encoding="utf-8"
    )
)["etec_framework"]
ind_text = {}
for dom in etec["domains"]:
    for st in dom["standards"]:
        for line in st["indicators"]:
            code = line.split(" ", 1)[0]
            ind_text[code] = line[len(code) :].strip()


def make_inds(codes):
    rows = []
    for c in codes:
        rows.append(
            {
                "code": c,
                "text": ind_text.get(c, ""),
                "confidence": "decision_approved",
                "source": SRC_DEC + " · " + SRC_EXT,
                "note": "معتمد بقرار رئيس المشروع استنادًا للتقرير الخارجي",
            }
        )
    return rows


by_id = {p["program_id"]: p for p in data["programs"]}

for pid, codes in FINAL_CODES.items():
    if pid not in by_id:
        continue
    rec = by_id[pid]
    rec["indicators"] = make_inds(codes)
    rec["conflicts"] = []
    rec["link_status"] = "decision_approved"
    rec["decision"] = {
        "approved": True,
        "final_indicator_codes": codes,
        "source": SRC_DEC,
        "external_report": SRC_EXT,
    }

for pid in ("national_day", "school_broadcast", "radio_program"):
    rec = by_id[pid]
    rec["detailed_objectives"] = [
        {
            "text": PARTNERSHIP_GOAL,
            "confidence": "source_explicit",
            "source": SRC_IMP,
            "note": "من خطة التحسين — يخدم مؤشر الشراكة (تهيئة). رمز التقرير 3-1-3-1 ↔ ETEC 1-3-1-3",
        }
    ]
    rec["executive_fields"] = {
        "executive_goal": PARTNERSHIP_GOAL,
        "duration": "فصل دراسي كامل",
        "implementers": "مدير المدرسة",
        "shared_with": "لجنة التميز",
        "external_support": "فارغ معتمد",
        "success_indicator": "فارغ معتمد",
        "source_duration": SRC_IMP,
        "source_roles": SRC_IMP,
        "note": "مؤشرات إنجاز نافس تخص مواد التحصيل؛ هذه البرامج بلا نسبة نافس مباشرة.",
    }
    if pid == "national_day":
        rec["notes"] = "الإبقاء على 1-3-1-3 + إضافة 3-2-1-1 (الهوية — تميز في التقرير)."
    elif pid == "radio_program":
        rec["notes"] = "مكرر (موسوم) · الإبقاء على 1-3-1-3."
    else:
        rec["notes"] = "الإبقاء على 1-3-1-3 — الإذاعة تخدم الشراكة (تهيئة)."

data["meta"]["updated"] = str(date.today())
data["meta"]["decision_wave"] = (
    "168-b / أمر رئيس المشروع — اعتماد تعارضات + برامج المدير الثلاثة"
)
data["meta"]["not_applied_to_programs_json"] = True
data["meta"]["scope"] = "خطتي فقط · لا كتيب · لا programs.json"
data["meta"]["code_schema_note"] = (
    "رموز خطة التحسين (مثل 3-1-3-1) قد تختلف عن ETEC 2026؛ التقابل في performance_metrics.code_aliases."
)
data["meta"]["stats"] = {
    "total": len(data["programs"]),
    "decision_approved": sum(
        1 for p in data["programs"] if p.get("link_status") == "decision_approved"
    ),
    "with_executive_fields": sum(
        1 for p in data["programs"] if p.get("executive_fields")
    ),
    "open_conflicts": sum(1 for p in data["programs"] if p.get("conflicts")),
}

map_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print("MAP_UPDATED", data["meta"]["stats"])

perf = {
    "meta": {
        "title": "مركز بيانات الأداء — مصدر الحقيقة الواحد",
        "school": "متوسطة سعد بن الربيع الأنصاري",
        "updated": str(date.today()),
        "rule": "لا تُكتب هذه الأرقام يدويًا في HTML/JS؛ تُقرأ من هذا الملف فقط",
        "sources": {
            "nafes": SRC_NAF,
            "external_evaluation": SRC_EXT,
            "improvement_plan": SRC_IMP,
        },
        "level_vocabulary": ["تهيئة", "انطلاق", "تقدم", "تميز"],
        "sustainability_adopted": False,
        "canonical_path": "config/performance_metrics.json",
        "serve_mirror": "Print_Canvas/components/_shared/performance_metrics.json",
    },
    "code_aliases": {
        "note": "رموز كما وردت في رد الرئيس ↔ إطار المشروع ETEC 2026",
        "map": [
            {
                "report_code": "3-1-3-1",
                "etec_code": "1-3-1-3",
                "label": "الشراكة المجتمعية",
                "level": "تهيئة",
            },
            {
                "report_code": "7-1-1-2",
                "etec_code": "",
                "label": "مهارات التفكير العليا",
                "level": "تهيئة",
                "note": "لا تطابق مباشر مؤكد — مرشّح 2-1-1-7 · يُراجع بشريًا",
            },
            {
                "report_code": "1-1-1-4",
                "etec_code": "",
                "label": "المبنى",
                "level": "تهيئة",
                "note": "في إطار المشروع المبنى تحت 4-1-* · يُراجع بشريًا",
            },
            {
                "report_code": "3-1-1-4",
                "etec_code": "",
                "label": "ذوو الإعاقة / مرافق",
                "level": "تهيئة",
                "note": "مرشّح 4-1-1-4 أو 2-1-1-1 · يُراجع بشريًا",
            },
            {
                "report_code": "3-1-1-2",
                "etec_code": "3-1-1-2",
                "label": "رياضيات — اختبارات وطنية",
                "level": "تهيئة",
            },
            {
                "report_code": "3-1-1-3",
                "etec_code": "3-1-1-3",
                "label": "علوم — اختبارات وطنية",
                "level": "تهيئة",
            },
        ],
    },
    "nafes": {
        "math": {
            "score": 18.8,
            "target": 25.0,
            "unit": "%",
            "label": "نسبة الإتقان — الرياضيات",
            "binding_key": "nafes.math",
        },
        "reading": {
            "score": 27.7,
            "target": 35.0,
            "unit": "%",
            "label": "نسبة الإتقان — القراءة",
            "binding_key": "nafes.reading",
        },
        "science": {
            "score": 42.5,
            "target": 50.0,
            "unit": "%",
            "label": "نسبة الإتقان — العلوم",
            "binding_key": "nafes.science",
        },
    },
    "external_evaluation": {
        "overall": {
            "score": 71.0,
            "unit": "%",
            "label": "الدرجة الكلية للتقرير الخارجي",
            "binding_key": "external.overall",
        },
        "administration": {
            "score": 78.75,
            "unit": "%",
            "label": "مجال الإدارة المدرسية",
            "binding_key": "external.administration",
        },
        "teaching": {
            "score": 65.5,
            "unit": "%",
            "label": "مجال التعليم والتعلم",
            "binding_key": "external.teaching",
        },
        "outcomes": {
            "score": 74.75,
            "unit": "%",
            "label": "مجال نواتج التعلم",
            "binding_key": "external.outcomes",
        },
        "environment": {
            "score": 60.5,
            "unit": "%",
            "label": "مجال البيئة المدرسية",
            "binding_key": "external.environment",
        },
    },
    "indicators": {
        "1-3-1-1": {
            "score": 78.75,
            "level_current": "تميز",
            "level_target": "تميز",
            "target_note": "الحفاظ على التميز",
            "source": SRC_EXT,
        },
        "1-4-1-3": {
            "score": 78.75,
            "level_current": "تميز",
            "level_target": "تميز",
            "target_note": "الحفاظ على التميز",
            "source": SRC_EXT,
            "schema_note": "موضع التقويم الذاتي قد يختلف بين ترقيم التقرير وإطار 2026",
        },
        "3-2-1-1": {
            "score": 78.75,
            "level_current": "تميز",
            "level_target": "تميز",
            "target_note": "الحفاظ على التميز",
            "source": SRC_EXT,
        },
        "3-2-1-2": {
            "score": 78.75,
            "level_current": "تميز",
            "level_target": "تميز",
            "target_note": "الحفاظ على التميز",
            "source": SRC_EXT,
        },
        "3-2-1-3": {
            "score": 78.75,
            "level_current": "تميز",
            "level_target": "تميز",
            "source": SRC_EXT,
            "target_note": "الحفاظ على التميز",
        },
        "3-2-1-7": {
            "score": 78.75,
            "level_current": "تميز",
            "level_target": "تميز",
            "target_note": "الحفاظ على التميز",
            "source": SRC_EXT,
        },
        "1-3-1-3": {
            "score_max": 50,
            "score_note": "أقل من 50%",
            "level_current": "تهيئة",
            "level_target": "انطلاق",
            "source": SRC_EXT,
            "report_alias": "3-1-3-1",
        },
        "2-1-1-7": {
            "score_max": 50,
            "score_note": "أقل من 50%",
            "level_current": "تهيئة",
            "level_target": "انطلاق",
            "source": SRC_EXT,
            "report_alias": "7-1-1-2",
            "provisional": True,
        },
        "4-1-1-1": {
            "score_max": 50,
            "score_note": "أقل من 50%",
            "level_current": "تهيئة",
            "level_target": "انطلاق",
            "source": SRC_EXT,
            "report_alias": "1-1-1-4",
            "provisional": True,
        },
        "4-1-1-4": {
            "score_max": 50,
            "score_note": "أقل من 50%",
            "level_current": "تهيئة",
            "level_target": "انطلاق",
            "source": SRC_EXT,
            "report_alias": "3-1-1-4",
            "provisional": True,
        },
    },
    "improvement_goals": {
        "partnership": {
            "text": PARTNERSHIP_GOAL,
            "binds_indicators": ["1-3-1-3"],
            "report_codes": ["3-1-3-1"],
            "duration": "فصل دراسي كامل",
            "implementers": "مدير المدرسة",
            "shared_with": "لجنة التميز",
            "external_support": "فارغ معتمد",
            "source": SRC_IMP,
        },
        "higher_thinking": {
            "text": "تفعيل استراتيجيات تدريس متنوعة تنمّي مهارات التفكير العليا، وتطوير أساليب التقويم الصفي.",
            "binds_indicators": ["2-1-1-7"],
            "report_codes": ["7-1-1-2"],
            "duration": "فصل دراسي كامل",
            "implementers": "وكيل الشؤون التعليمية",
            "shared_with": "لجنة التميز",
            "external_support": "فارغ معتمد",
            "source": SRC_IMP,
            "provisional_etec": True,
        },
        "building": {
            "text": "متابعة الجهات ذات العلاقة لتطوير المبنى المدرسي وتجهيزاته، وتوفير مرافق وخدمات مساندة.",
            "binds_indicators": ["4-1-1-1"],
            "report_codes": ["1-1-1-4"],
            "duration": "فصل دراسي كامل",
            "implementers": "وكيل الشؤون المدرسية",
            "shared_with": "فريق الأمن والسلامة",
            "external_support": "الإدارة العامة للتعليم",
            "source": SRC_IMP,
            "provisional_etec": True,
        },
        "disability_facilities": {
            "text": "حصر احتياجات الطلاب ذوي الإعاقة وتوفير المرافق المناسبة.",
            "binds_indicators": ["4-1-1-4"],
            "report_codes": ["3-1-1-4"],
            "duration": "فصل دراسي كامل",
            "implementers": "وكيل الشؤون المدرسية",
            "shared_with": "فارغ معتمد",
            "external_support": "فارغ معتمد",
            "source": SRC_IMP,
            "provisional_etec": True,
        },
        "math_science_boost": {
            "text": "تكثيف برامج التقوية في الرياضيات والعلوم استنادًا لتحليل نتائج الاختبارات الوطنية.",
            "binds_indicators": ["3-1-1-2", "3-1-1-3"],
            "report_codes": ["3-1-1-2", "3-1-1-3"],
            "duration": "فصل دراسي كامل",
            "implementers": "معلمو الرياضيات والعلوم",
            "shared_with": "وكيل الشؤون التعليمية",
            "external_support": "فارغ معتمد",
            "success_binding": ["nafes.math", "nafes.science"],
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
    },
}

config_dir = root / "config"
config_dir.mkdir(exist_ok=True)
perf_path = config_dir / "performance_metrics.json"
blob = json.dumps(perf, ensure_ascii=False, indent=2)
perf_path.write_text(blob, encoding="utf-8")
shared = root / "Print_Canvas/components/_shared/performance_metrics.json"
shared.write_text(blob, encoding="utf-8")
print("PERF_WRITTEN", perf_path)
print("PERF_MIRROR", shared)
