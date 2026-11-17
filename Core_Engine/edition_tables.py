# -*- coding: utf-8 -*-
"""جدولا الإصدار الناقصان. القراءة من المحفوظ فقط، والحقل الفارغ يبقى فارغاً."""

import json
from pathlib import Path

from .database import connect
from .program_registry import _as_ids, _indicator_catalog

_MINUTES_PATH = Path(__file__).resolve().parent.parent / "School_Data" / "council_minutes.json"

_EVIDENCE_DISPLAY = {
    "pilot-1448-improve-formative": "سجل الزيارات الصفية وتقارير مجتمعات التعلم المهنية",
}
_FOLLOW_LIMIT = 15
_PROGRAM_FOLLOW = 6
_MINUTE_FOLLOW = 5


def _plain(value) -> str:
    return str(value or "").strip()


def _actions() -> list[dict]:
    connection = connect()
    try:
        rows = connection.execute(
            """
            SELECT id, title, owner_label, status, progress_percentage, evidence, follow_note
            FROM improvement_actions
            ORDER BY sort_order, id
            """
        ).fetchall()
    finally:
        connection.close()
    return [
        {
            "id": row[0],
            "title": _plain(row[1]),
            "owner": _plain(row[2]),
            "status": _plain(row[3]),
            "percent": _plain(row[4]),
            "evidence": _EVIDENCE_DISPLAY.get(_plain(row[5]), _plain(row[5])),
            "note": _plain(row[6]),
        }
        for row in rows
    ]


def _statements() -> dict[str, str]:
    connection = connect()
    try:
        rows = connection.execute(
            "SELECT code, statement FROM evaluation_indicators"
        ).fetchall()
    finally:
        connection.close()
    return {_plain(row[0]): _plain(row[1]) for row in rows if _plain(row[0])}


def _minutes() -> list[dict]:
    if not _MINUTES_PATH.is_file():
        return []
    payload = json.loads(_MINUTES_PATH.read_text(encoding="utf-8"))
    rows = payload.get("minutes") if isinstance(payload, dict) else payload
    return rows if isinstance(rows, list) else []


def _programs() -> list[dict]:
    connection = connect()
    try:
        id_to_code, _code_to_id = _indicator_catalog(connection)
        rows = connection.execute(
            """
            SELECT program_name, strategic_goal, target_audience, duration, implementers,
                   success_indicator, indicator_ids, status, duty_ref
            FROM school_programs
            WHERE COALESCE(is_deleted, 0) = 0
            ORDER BY id
            """
        ).fetchall()
    finally:
        connection.close()
    programs = []
    for row in rows:
        _ids, codes = _as_ids(row[6], id_to_code)
        programs.append({
            "program_name": _plain(row[0]),
            "strategic_goal": _plain(row[1]),
            "target_audience": _plain(row[2]),
            "duration": _plain(row[3]),
            "implementers": _plain(row[4]),
            "success_indicator": _plain(row[5]),
            "indicator_codes": [part.strip() for part in _plain(codes).split("،") if part.strip()],
            "status": _plain(row[7]),
            "duty_ref": _plain(row[8]),
        })
    return programs


def _indicator_text(item: dict, statements: dict[str, str]) -> str:
    parts = []
    for code in item.get("indicator_codes") or []:
        saved = _plain(code)
        if not saved:
            continue
        statement = statements.get(saved, "")
        parts.append(f"{saved} {statement}".strip() if statement else saved)
    return "؛ ".join(parts)


def _program_rows(programs: list[dict], statements: dict[str, str]) -> list[dict]:
    rows = []
    for index, item in enumerate(programs, start=1):
        rows.append({
            "n": index,
            "program": _plain(item.get("program_name")),
            "goal": _plain(item.get("strategic_goal")),
            "indicator": _indicator_text(item, statements),
            "audience": _plain(item.get("target_audience")),
            "period": _plain(item.get("duration")),
            "owner": _plain(item.get("implementers")),
            "success": _plain(item.get("success_indicator")),
        })
    return rows


def _linked_percent(item: dict, by_id: dict[int, dict]) -> str:
    ref = _plain(item.get("duty_ref"))
    if not ref.startswith("improvement:"):
        return ""
    raw = ref.split(":", 1)[1]
    if not raw.isdigit():
        return ""
    linked = by_id.get(int(raw))
    return _plain(linked.get("percent")) if linked else ""


def _chair(minute: dict) -> str:
    present = minute.get("present") if isinstance(minute, dict) else None
    if not isinstance(present, list) or not present:
        return ""
    first = present[0] if isinstance(present[0], dict) else {}
    return _plain(first.get("name"))


def _follow_rows(programs: list[dict], actions: list[dict], minutes: list[dict]) -> list[dict]:
    by_id = {action["id"]: action for action in actions}
    rows = []
    for action in actions:
        rows.append({
            "item": action["title"],
            "owner": action["owner"],
            "status": action["status"],
            "percent": action["percent"],
            "note": action["note"] or action["evidence"],
        })
    for item in programs:
        if len(rows) >= 4 + _PROGRAM_FOLLOW:
            break
        if not _plain(item.get("program_name")):
            continue
        rows.append({
            "item": _plain(item.get("program_name")),
            "owner": _plain(item.get("implementers")),
            "status": _plain(item.get("status")),
            "percent": _linked_percent(item, by_id),
            "note": "",
        })
    for minute in minutes:
        if len(rows) >= _FOLLOW_LIMIT:
            break
        if not isinstance(minute, dict):
            continue
        agenda = _plain(minute.get("agenda"))
        if not agenda:
            continue
        rows.append({
            "item": agenda,
            "owner": _chair(minute),
            "status": "",
            "percent": "",
            "note": _plain(minute.get("hijri")),
        })
    for index, row in enumerate(rows[:_FOLLOW_LIMIT], start=1):
        row["n"] = index
    return rows[:_FOLLOW_LIMIT]


def edition_tables() -> dict:
    """البرنامجان الناقصان في الإصدار. لا يُحسب أسبوع غير محفوظ."""
    programs = _programs()
    actions = _actions()
    statements = _statements()
    minutes = _minutes()
    program_rows = _program_rows(programs, statements)
    follow_rows = _follow_rows(programs, actions, minutes)
    empty_goals = [
        row["program"] for row in program_rows if row["program"] and not row["goal"]
    ]
    return {
        "programs": {
            "title": "البرامج وفق أهداف الخطة",
            "columns": ["م", "البرنامج", "الهدف الاستراتيجي", "المؤشر", "المستهدفون", "الفترة", "المنفذ", "مؤشر النجاح"],
            "keys": ["n", "program", "goal", "indicator", "audience", "period", "owner", "success"],
            "rows": program_rows,
        },
        "follow": {
            "title": "متابعة الخطة",
            "columns": ["م", "البند", "المسؤول", "الحالة", "النسبة", "الملاحظات"],
            "keys": ["n", "item", "owner", "status", "percent", "note"],
            "rows": follow_rows,
        },
        "gaps": {
            "programs_saved": len(program_rows),
            "empty_goal": empty_goals,
            "actions_saved": len(actions),
            "minutes_saved": len(minutes),
            "percent_saved": sum(1 for action in actions if action["percent"]),
            "week_status": "لا حقل أسبوع في البرامج ولا المحاضر ولا إجراءات التحسين.",
        },
    }
