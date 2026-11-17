# بحث الجلسة: برامج، محاضر، خطط، سجلات، لجان. بلا أرقام هوية في الناتج.

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException

from .access import require_user
from .committee_session_api import COMMITTEES
from .database import connect
from .operational_plan import read_plan
from .program_registry import REGISTERS

router = APIRouter(tags=["search"])

_ROOT = Path(__file__).resolve().parents[1]
_MINUTES = _ROOT / "School_Data" / "council_minutes.json"
_LIMIT = 12


def _clean(value: str) -> str:
    return " ".join(str(value or "").split())


def _hit(kind: str, title: str, note: str, href: str) -> dict:
    return {
        "kind": kind,
        "title": _clean(title)[:160],
        "note": _clean(note)[:160],
        "href": href,
    }


def _leader(role: str) -> bool:
    text = str(role or "")
    return text.startswith("مدير") or "وكيل" in text


def _contains(needle: str, *parts: str) -> bool:
    haystack = " ".join(_clean(part) for part in parts if part)
    return needle in haystack


@router.get("/api/session/search")
def search_saved(q: str = "", x_session_token: str = Header(default="")):
    try:
        user = require_user(str(x_session_token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    needle = _clean(q)[:80]
    if len(needle) < 2:
        return {"items": []}
    leader = _leader(str(user.get("role") or ""))
    identity = str(user.get("id") or "").strip()
    items = []
    items.extend(_programs(needle, leader, identity))
    items.extend(_minutes(needle, leader, identity))
    if leader:
        items.extend(_plans(needle))
        items.extend(_registers(needle))
    items.extend(_committees(needle, leader, identity))
    return {"items": items[:_LIMIT]}


def _programs(needle: str, leader: bool, identity: str) -> list:
    connection = connect()
    try:
        rows = connection.execute(
            """
            SELECT id, program_name, status, executive_goal, assignee_staff_id, implementers
            FROM school_programs
            WHERE trim(COALESCE(program_name, '')) != ''
            ORDER BY id DESC
            """
        ).fetchall()
    except Exception:
        rows = []
    finally:
        connection.close()
    found = []
    for row in rows:
        if not leader and str(row[4] or "").strip() != identity and identity not in str(row[5] or ""):
            continue
        if not _contains(needle, row[1], row[2], row[3]):
            continue
        found.append(_hit("برنامج", row[1], row[2] or "", "app-journey.html#view-program-add?id=" + str(row[0])))
        if len(found) >= _LIMIT:
            break
    return found


def _minutes(needle: str, leader: bool, identity: str) -> list:
    try:
        payload = json.loads(_MINUTES.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    minutes = payload.get("minutes") if isinstance(payload, dict) else []
    if not isinstance(minutes, list):
        return []
    found = []
    for item in minutes:
        if not isinstance(item, dict):
            continue
        present = item.get("present") if isinstance(item.get("present"), list) else []
        present_ids = [str(person.get("id") or "").strip() for person in present if isinstance(person, dict)]
        if not leader and identity not in present_ids:
            continue
        if not _contains(needle, item.get("agenda"), item.get("minutes"), item.get("decisions"), item.get("registerLabel")):
            continue
        note = " · ".join(part for part in [item.get("hijri") or "", item.get("gregorian") or ""] if part)
        found.append(_hit(
            "محضر",
            item.get("agenda") or item.get("registerLabel") or "محضر",
            note,
            "app-journey.html#view-council-details?id=" + str(item.get("id") or ""),
        ))
        if len(found) >= _LIMIT:
            break
    return found


def _plans(needle: str) -> list:
    try:
        plan = read_plan()
    except Exception:
        return []
    found = []
    for goal in plan.get("strategic_goals") or []:
        if not isinstance(goal, dict):
            continue
        if not _contains(needle, goal.get("text"), goal.get("domain")):
            continue
        found.append(_hit("خطة", goal.get("text") or "", goal.get("domain") or "", "app-journey.html#view-planning"))
        if len(found) >= _LIMIT:
            break
    return found


def _registers(needle: str) -> list:
    found = []
    for number, label in REGISTERS:
        if needle not in str(label):
            continue
        found.append(_hit("سجل", label, "سجل " + str(number), "app-journey.html#view-execution"))
    return found


def _committees(needle: str, leader: bool, identity: str) -> list:
    mine = set()
    if not leader:
        connection = connect()
        try:
            rows = connection.execute(
                "SELECT committee_id FROM committee_seat WHERE national_id = ?",
                (identity,),
            ).fetchall()
            mine = {str(row[0] or "") for row in rows}
        except Exception:
            mine = set()
        finally:
            connection.close()
    found = []
    for cid, title in COMMITTEES:
        if not leader and cid not in mine:
            continue
        if needle not in title:
            continue
        found.append(_hit("لجنة", title, "", "app-journey.html#view-committees"))
    return found
