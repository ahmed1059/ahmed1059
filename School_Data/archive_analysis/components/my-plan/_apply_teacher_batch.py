# قرار 143 · ترقية دفعة المعلم (8) + مزامنة programs.json
# لا يُنفَّذ عند الاستيراد — تشغيل مباشر فقط
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PROG_PATHS = [
    ROOT / "Print_Canvas" / "components" / "_shared" / "programs.json",
    ROOT / "School_Data" / "archive_analysis" / "components" / "_shared" / "programs.json",
]
KNOWLEDGE_PATH = ROOT / "Print_Canvas" / "components" / "_shared" / "programs_knowledge.json"

TEACHER_EIGHT = [
    {
        "id": "fun_math",
        "archive_ref": 75,
        "name": "مبادرة الرياضيات الممتعة",
        "label": "الرياضيات الممتعة",
        "kind": "مبادرة",
        "target_audience": "",
        "domain": "نواتج التعلم",
        "duration": "",
        "owner_role": "teacher",
        "goal_ref": "G3",
        "register_id": 3,
        "success_indicator": "",
        "indicator_codes": ["2-1-1-5", "2-2-1-1"],
        "source": "archive:17_programs_by_staff_plan.md#75 · قرار 143",
    },
    {
        "id": "comm_skills",
        "archive_ref": 76,
        "name": "برنامج مهارات التواصل",
        "label": "مهارات التواصل",
        "kind": "برنامج",
        "target_audience": "",
        "domain": "نواتج التعلم",
        "duration": "",
        "owner_role": "teacher",
        "goal_ref": "G2",
        "register_id": 3,
        "success_indicator": "",
        "indicator_codes": ["2-1-1-2", "2-1-1-5"],
        "source": "archive:17_programs_by_staff_plan.md#76 · قرار 143",
    },
    {
        "id": "study_skills",
        "archive_ref": 77,
        "name": "برنامج مهارات المذاكرة",
        "label": "مهارات المذاكرة",
        "kind": "برنامج",
        "target_audience": "",
        "domain": "نواتج التعلم",
        "duration": "",
        "owner_role": "teacher",
        "goal_ref": "G3",
        "register_id": 3,
        "success_indicator": "",
        "indicator_codes": ["2-1-1-5", "2-2-1-1"],
        "source": "archive:17_programs_by_staff_plan.md#77 · قرار 143",
    },
    {
        "id": "basic_mastery",
        "archive_ref": 78,
        "name": "برنامج إتقان المهارات الأساسية",
        "label": "إتقان المهارات الأساسية",
        "kind": "برنامج",
        "target_audience": "",
        "domain": "نواتج التعلم",
        "duration": "",
        "owner_role": "teacher",
        "goal_ref": "G3",
        "register_id": 3,
        "success_indicator": "",
        "indicator_codes": ["2-2-1-1", "2-2-1-2"],
        "source": "archive:17_programs_by_staff_plan.md#78 · قرار 143",
    },
    {
        "id": "subject_support_teacher",
        "archive_ref": 79,
        "name": "برنامج دعم في المواد الأساسية",
        "label": "دعم المواد (خطة المعلم)",
        "kind": "برنامج",
        "target_audience": "",
        "domain": "نواتج التعلم",
        "duration": "",
        "owner_role": "teacher",
        "goal_ref": "G3",
        "register_id": 3,
        "success_indicator": "",
        "indicator_codes": ["2-2-1-1", "2-2-1-3"],
        "source": "archive:17_programs_by_staff_plan.md#79 · قرار 143 · ملاحظة: يختلف عن support (وكيل تعليمية)",
        "note": "تداخل لفظي مع برنامج support المملوك لـ vice_teachers — ملكيتان منفصلتان",
    },
    {
        "id": "critical_thinking",
        "archive_ref": 80,
        "name": "برنامج التفكير الناقد",
        "label": "التفكير الناقد",
        "kind": "برنامج",
        "target_audience": "",
        "domain": "التعليم والتعلم",
        "duration": "",
        "owner_role": "teacher",
        "goal_ref": "G2",
        "register_id": 3,
        "success_indicator": "",
        "indicator_codes": ["2-1-1-5", "2-2-1-1"],
        "source": "archive:17_programs_by_staff_plan.md#80 · قرار 143",
    },
    {
        "id": "creative_writing",
        "archive_ref": 81,
        "name": "برنامج الكتابة الإبداعية",
        "label": "الكتابة الإبداعية",
        "kind": "برنامج",
        "target_audience": "",
        "domain": "نواتج التعلم",
        "duration": "",
        "owner_role": "teacher",
        "goal_ref": "G3",
        "register_id": 3,
        "success_indicator": "",
        "indicator_codes": ["2-1-1-2", "2-2-1-1"],
        "source": "archive:17_programs_by_staff_plan.md#81 · قرار 143",
    },
    {
        "id": "creative_writing_club",
        "archive_ref": 82,
        "name": "نادي الكتابة الإبداعية",
        "label": "نادي الكتابة الإبداعية",
        "kind": "نادي",
        "target_audience": "",
        "domain": "نواتج التعلم",
        "duration": "",
        "owner_role": "teacher",
        "goal_ref": "G3",
        "register_id": 5,
        "success_indicator": "",
        "indicator_codes": ["2-1-1-2"],
        "source": "archive:17_programs_by_staff_plan.md#82 · قرار 143",
    },
]


def upsert_programs(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    programs = list(data.get("programs") or [])
    by_id = {str(p.get("id") or ""): i for i, p in enumerate(programs)}
    inserted = updated = 0
    for item in TEACHER_EIGHT:
        row = {
            "id": item["id"],
            "name": item["name"],
            "label": item["label"],
            "kind": item["kind"],
            "target_audience": item["target_audience"],
            "domain": item["domain"],
            "duration": item["duration"],
            "owner_role": item["owner_role"],
            "goal_ref": item["goal_ref"],
            "register_id": item["register_id"],
            "success_indicator": item["success_indicator"],
            "indicator_codes": item["indicator_codes"],
            "archive_ref": item["archive_ref"],
            "source": item["source"],
            "status": "معتمد",
        }
        if item["id"] in by_id:
            programs[by_id[item["id"]]] = row
            updated += 1
        else:
            programs.append(row)
            inserted += 1
    data["programs"] = programs
    data["meta"] = {
        "count": len(programs),
        "source": "TEMPLATES + teacher batch قرار 143",
        "note": "17 نواة + 8 معلم معتمدة من تصنيف الأرشيف · بلا اختراع مؤشر رقمي",
        "decision": 143,
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"path": str(path), "count": len(programs), "inserted": inserted, "updated": updated}


def write_knowledge() -> dict:
    payload = {
        "meta": {
            "decision": 143,
            "purpose": "وسم دفعة المعلم المرقّاة · بقية الـ92 تبقى لـ م2",
            "note": "ليس زرعاً جماعياً للـ92",
        },
        "items": [
            {
                "archive_ref": item["archive_ref"],
                "program_id": item["id"],
                "name": item["name"],
                "owner_plan": "خطة المعلم",
                "owner_role": "teacher",
                "status": "approved",
                "goal_ref": item["goal_ref"],
                "register_id": item["register_id"],
            }
            for item in TEACHER_EIGHT
        ],
    }
    KNOWLEDGE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    archive = (
        ROOT
        / "School_Data"
        / "archive_analysis"
        / "components"
        / "_shared"
        / "programs_knowledge.json"
    )
    archive.parent.mkdir(parents=True, exist_ok=True)
    archive.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"count": len(payload["items"]), "paths": [str(KNOWLEDGE_PATH), str(archive)]}


def main() -> None:
    reports = [upsert_programs(p) for p in PROG_PATHS]
    knowledge = write_knowledge()
    print(json.dumps({"programs": reports, "knowledge": knowledge}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
