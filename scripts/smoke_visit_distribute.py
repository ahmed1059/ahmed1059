#!/usr/bin/env python3
# فحص توزيع الزيارات: تحليل التاريخ، النطاقات المحجوبة، وشريحة الأسبوع 5+.
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Core_Engine.visit_plan_api import (  # noqa: E402
    _blocked_ranges,
    _eligible_weeks,
    _parse_dmY,
)


def main() -> int:
    assert _parse_dmY("06/12/2026") == "2026-12-06"
    assert _parse_dmY("2026-12-06") == "2026-12-06"
    assert _parse_dmY("") == ""
    assert _parse_dmY("bad") == ""

    occasions = [
        {
            "type": "exam",
            "gregorian_start": "06/12/2026",
            "gregorian_end": "17/12/2026",
        },
        {
            "type": "holiday",
            "gregorian_start": "23/09/2026",
            "gregorian_end": "",
        },
        {
            "type": "activity",
            "gregorian_start": "05/10/2026",
            "gregorian_end": "05/10/2026",
        },
    ]
    blocked = _blocked_ranges(occasions)
    assert ("2026-12-06", "2026-12-17") in blocked
    assert ("2026-09-23", "2026-09-23") in blocked
    assert len(blocked) == 2

    weeks = [
        "2026-08-30",  # 1
        "2026-09-06",  # 2
        "2026-09-13",  # 3
        "2026-09-20",  # 4 — includes holiday day 23/09 when week starts 20?
        "2026-09-27",  # 5
        "2026-10-04",  # 6
        "2026-12-06",  # 7 exam start — blocked
        "2026-12-13",  # 8 exam — blocked
        "2026-12-20",  # 9
    ]
    # Week-start 2026-09-20 is NOT inside 23/09..23/09, so eligible from week 5:
    eligible = _eligible_weeks(weeks, blocked, min_week=5)
    assert eligible[0] == "2026-09-27"
    assert "2026-08-30" not in eligible
    assert "2026-09-20" not in eligible
    assert "2026-12-06" not in eligible
    assert "2026-12-13" not in eligible
    assert "2026-12-20" in eligible
    assert "2026-10-04" in eligible

    # Single-day start with empty end blocks only that exact week-start.
    weeks_holiday_start = ["2026-09-16", "2026-09-23", "2026-09-30"]
    holiday_only = _blocked_ranges(
        [{"type": "holiday", "gregorian_start": "23/09/2026", "gregorian_end": ""}]
    )
    filtered = _eligible_weeks(weeks_holiday_start, holiday_only, min_week=1)
    assert filtered == ["2026-09-16", "2026-09-30"]

    print("smoke_visit_distribute: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
