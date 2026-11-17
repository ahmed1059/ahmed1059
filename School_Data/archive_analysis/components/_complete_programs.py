# -*- coding: utf-8 -*-
"""استكمال برامج المدرسة من TEMPLATES + تحديث programs.json للاحتياطي."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from Core_Engine.program_registry import (  # noqa: E402
    TEMPLATES,
    ensure_school_programs_from_templates,
    list_programs,
)

SHARED = Path(__file__).resolve().parent / "_shared"


def infer_kind(name: str) -> str:
    text = name or ""
    if any(k in text for k in ("مسابقة", "أولمبياد", "جائزة", "منافسة")):
        return "مسابقة"
    if "مبادرة" in text or "ارتقاء" in text:
        return "مبادرة"
    return "برنامج"


def write_fallback() -> int:
    programs = []
    for item in TEMPLATES:
        name = item.get("program_name") or ""
        programs.append(
            {
                "id": item.get("key"),
                "name": name,
                "label": item.get("label") or "",
                "kind": infer_kind(name),
                "target_audience": item.get("target_audience") or "",
                "domain": item.get("domain") or "",
                "duration": item.get("duration") or "",
                "owner_role": item.get("owner_role") or "",
                "goal_ref": item.get("goal_ref") or "",
                "success_indicator": item.get("success_indicator") or "",
                "source": "program_registry.TEMPLATES",
            }
        )
    payload = {
        "meta": {
            "count": len(programs),
            "source": "Core_Engine/program_registry.py TEMPLATES",
            "note": "fallback when /api/programs unavailable; live API preferred",
        },
        "programs": programs,
    }
    SHARED.mkdir(parents=True, exist_ok=True)
    path = SHARED / "programs.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return len(programs)


def main() -> int:
    report = ensure_school_programs_from_templates()
    live = list_programs()
    fallback = write_fallback()
    print(
        json.dumps(
            {
                "ensure": report,
                "api_count": len(live),
                "fallback_count": fallback,
                "api_names": [p["program_name"] for p in live],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if len(live) >= len(TEMPLATES) else 1


if __name__ == "__main__":
    raise SystemExit(main())
