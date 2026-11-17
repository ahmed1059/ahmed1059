# بنك المعرفة للأهداف G1–G7 — ملف جديد معزول.
# يقرأ الخطة عبر read_plan() ولا ينسخ الأهداف ولا يخترع مؤشراً.

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(tags=["knowledge-bank"])

_EXPECTED = ("G1", "G2", "G3", "G4", "G5", "G6", "G7")


def _token(x_session_token: str) -> str:
    return str(x_session_token or "").strip()


def _require_user(x_session_token: str) -> dict:
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _plain(value) -> str:
    return str(value or "").strip()


def _indicators(raw) -> list:
    rows = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        rows.append({
            "kpi": _plain(item.get("kpi")),
            "target": _plain(item.get("target")),
            "measurement": _plain(item.get("measurement")),
        })
    return rows


def _goals(plan: dict) -> list:
    rows = []
    for item in plan.get("strategic_goals") or []:
        if not isinstance(item, dict):
            continue
        goal_id = _plain(item.get("id"))
        text = _plain(item.get("text"))
        if not goal_id or not text:
            continue
        rows.append({
            "id": goal_id,
            "domain": _plain(item.get("domain")),
            "text": text,
            "indicators": _indicators(item.get("indicators")),
        })
    return rows


@router.get("/api/session/plans-bank")
def plans_bank(x_session_token: str = Header(default="")):
    """يعيد بنك خطط التحسين كما حُفظ في الملف. لا يُختَرع مؤشر."""
    _require_user(x_session_token)
    path = Path(__file__).resolve().parent.parent / "School_Data" / "knowledge_bases" / "plans-bank.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="بنك الخطط غير موجود")
    return FileResponse(path, media_type="application/json")


@router.get("/api/knowledge-bank")
def knowledge_bank(x_session_token: str = Header(default="")):
    """يعيد أهداف الخطة ومؤشراتها كما حُفظت. الهدف الغائب من G1–G7 يُذكر في missing."""
    _require_user(x_session_token)
    from .operational_plan import read_plan

    plan = read_plan()
    goals = _goals(plan)
    present = {goal["id"] for goal in goals}
    return {
        "source": _plain(plan.get("source")),
        "academic_year": _plain(plan.get("academic_year")),
        "goals": goals,
        "missing": [goal_id for goal_id in _EXPECTED if goal_id not in present],
    }
