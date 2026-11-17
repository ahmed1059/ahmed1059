# -*- coding: utf-8 -*-
"""مقارنة school_programs مع أهداف الخطة التشغيلية."""
from __future__ import annotations

import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from Core_Engine.operational_plan import TEMPLATE_GOALS, read_plan  # noqa: E402
from Core_Engine.program_registry import TEMPLATES, list_programs  # noqa: E402


def norm(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def main() -> int:
    plan = read_plan()
    goals = {g["id"]: g for g in plan["strategic_goals"]}
    programs = list_programs()

    report = {
        "plan": {
            "academic_year": plan.get("academic_year"),
            "source": plan.get("source"),
            "goals_count": len(goals),
            "kpis_count": len(plan.get("kpis") or []),
        },
        "programs": {
            "school_programs_count": len(programs),
            "templates_count": len(TEMPLATES),
        },
        "coverage_by_goal": [],
        "orphan_programs": [],
        "invalid_goal_ref": [],
        "template_vs_live": {},
        "goal_ref_mismatches": [],
        "kpi_matches": [],
        "verdict": [],
    }

    for goal_id, goal in goals.items():
        linked = [p for p in programs if p.get("goal_ref") == goal_id]
        report["coverage_by_goal"].append(
            {
                "goal_id": goal_id,
                "domain": goal.get("domain"),
                "text": goal.get("text"),
                "programs_count": len(linked),
                "programs": [
                    {
                        "name": p["program_name"],
                        "status": p.get("status"),
                        "strategic_goal_matches_plan": norm(p.get("strategic_goal"))
                        == norm(goal.get("text")),
                    }
                    for p in linked
                ],
            }
        )

    for program in programs:
        ref = program.get("goal_ref") or ""
        if not ref:
            report["orphan_programs"].append(program["program_name"])
        elif ref not in goals:
            report["invalid_goal_ref"].append(
                {"name": program["program_name"], "goal_ref": ref}
            )

    template_names = {item["program_name"] for item in TEMPLATES}
    live_names = {item["program_name"] for item in programs}
    report["template_vs_live"] = {
        "shared": sorted(template_names & live_names),
        "templates_only": sorted(template_names - live_names),
        "live_only": sorted(live_names - template_names),
    }

    by_name = {item["program_name"]: item["key"] for item in TEMPLATES}
    for program in programs:
        key = by_name.get(program["program_name"])
        expected = TEMPLATE_GOALS.get(key) if key else None
        actual = program.get("goal_ref") or ""
        if expected != actual:
            report["goal_ref_mismatches"].append(
                {
                    "name": program["program_name"],
                    "expected_from_TEMPLATE_GOALS": expected,
                    "live_goal_ref": actual or None,
                }
            )

    for kpi_row in plan.get("kpis") or []:
        kpi = kpi_row.get("kpi") or ""
        hits = []
        for program in programs:
            desc = program.get("kpi_description") or ""
            blob = " ".join(
                [
                    desc,
                    program.get("success_indicator") or "",
                    program.get("program_name") or "",
                ]
            )
            ratio = SequenceMatcher(None, norm(kpi), norm(desc)).ratio()
            if ratio >= 0.45 or (len(kpi) >= 12 and kpi[:12] in blob):
                hits.append(
                    {
                        "ratio": round(ratio, 2),
                        "program": program["program_name"],
                        "kpi_description": desc,
                    }
                )
        hits = sorted(hits, key=lambda item: item["ratio"], reverse=True)[:3]
        report["kpi_matches"].append(
            {
                "goal_id": kpi_row.get("goal_id"),
                "kpi": kpi,
                "target": kpi_row.get("target"),
                "nearest_programs": hits,
            }
        )

    uncovered = [
        row["goal_id"] for row in report["coverage_by_goal"] if row["programs_count"] == 0
    ]
    text_mismatch = [
        f"{row['goal_id']}:{item['name']}"
        for row in report["coverage_by_goal"]
        for item in row["programs"]
        if not item["strategic_goal_matches_plan"]
    ]
    kpi_unmatched = [
        row["kpi"] for row in report["kpi_matches"] if not row["nearest_programs"]
    ]

    report["verdict"] = [
        f"أهداف الخطة: {len(goals)} · برامج المدرسة: {len(programs)} · قوالب TEMPLATES: {len(TEMPLATES)}",
        "تطابق أسماء TEMPLATES مع school_programs: "
        + (
            "كامل"
            if not report["template_vs_live"]["templates_only"]
            and not report["template_vs_live"]["live_only"]
            else "ناقص"
        ),
        "أهداف بلا برنامج مربوط: " + (", ".join(uncovered) if uncovered else "لا يوجد"),
        "برامج بلا goal_ref: "
        + (
            ", ".join(report["orphan_programs"])
            if report["orphan_programs"]
            else "لا يوجد"
        ),
        "اختلاف goal_ref عن TEMPLATE_GOALS: "
        + (
            str(len(report["goal_ref_mismatches"]))
            if report["goal_ref_mismatches"]
            else "لا يوجد"
        ),
        "برامج نص هدفها لا يطابق نص هدف الخطة: "
        + (", ".join(text_mismatch) if text_mismatch else "لا يوجد"),
        "مؤشرات خطة بلا تطابق قريب في البرامج: "
        + (str(len(kpi_unmatched)) if kpi_unmatched else "لا يوجد"),
    ]

    out = Path(__file__).resolve().parent / "_compare_programs_plan_report.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md = Path(__file__).resolve().parent.parent / "16_programs_vs_operational_plan.md"
    lines = [
        "# مقارنة البرامج مع الخطة التشغيلية",
        f"## العام: {plan.get('academic_year')} · مصدر الخطة: {plan.get('source')}",
        "",
        "## الخلاصة",
    ]
    for item in report["verdict"]:
        lines.append(f"- {item}")
    lines.extend(["", "## تغطية الأهداف", ""])
    lines.append("| الهدف | المجال | عدد البرامج | البرامج |")
    lines.append("|---|---|---:|---|")
    for row in report["coverage_by_goal"]:
        names = "؛ ".join(item["name"] for item in row["programs"]) or "—"
        lines.append(
            f"| {row['goal_id']} | {row['domain']} | {row['programs_count']} | {names} |"
        )
    lines.extend(["", "## مؤشرات الخطة الأقرب لبرامج", ""])
    for row in report["kpi_matches"]:
        lines.append(f"- **{row['goal_id']}** — {row['kpi']} (هدف: {row['target']})")
        if row["nearest_programs"]:
            for hit in row["nearest_programs"]:
                lines.append(
                    f"  - قرب {hit['ratio']}: {hit['program']} — `{hit['kpi_description']}`"
                )
        else:
            lines.append("  - لا تطابق قريب")
    md.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"verdict": report["verdict"], "md": str(md), "json": str(out)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
