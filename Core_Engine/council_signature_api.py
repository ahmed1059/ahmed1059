# توقيعات حضور محضر واحد — ملف جديد معزول.
# يقرأ سجل council_minutes.json، ويعيد صور School_Data/signatures دفعة واحدة.
# لا يغيّر مسار المجالس القديم ولا يفتح مجلد التوقيعات للعموم.

from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException

from .session_signature_api import SIGNATURES_DIR, _file_to_data_url

router = APIRouter(tags=["session-council-signatures"])

_ROOT = Path(__file__).resolve().parent.parent
_COUNCILS_PATH = _ROOT / "School_Data" / "council_minutes.json"
_NATIONAL_ID = re.compile(r"^\d{8,12}$")


def _token(x_session_token: str) -> str:
    return str(x_session_token or "").strip()


def _require_user(x_session_token: str) -> dict:
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _load_minutes() -> list:
    if not _COUNCILS_PATH.is_file():
        return []
    try:
        payload = json.loads(_COUNCILS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    minutes = payload.get("minutes") if isinstance(payload, dict) else []
    return minutes if isinstance(minutes, list) else []


def _find_council(council_id: str) -> dict | None:
    needle = str(council_id or "").strip()
    if not needle:
        return None
    for item in _load_minutes():
        if isinstance(item, dict) and str(item.get("id") or "").strip() == needle:
            return item
    return None


def _signature_data_url(national_id: str) -> str:
    path = SIGNATURES_DIR / f"sig_{national_id}.png"
    if not path.is_file():
        return ""
    return _file_to_data_url(path)


@router.get("/api/session/councils/{council_id}/signatures")
def council_attendance_signatures(
    council_id: str,
    x_session_token: str = Header(default=""),
):
    """يعيد توقيعات حضور محضر واحد في كائن واحد. المفتاح رقم الهوية والقيمة data URL."""
    _require_user(x_session_token)
    council = _find_council(council_id)
    if not council:
        raise HTTPException(status_code=404, detail="المحضر غير موجود")
    present = council.get("present")
    if not isinstance(present, list):
        present = []
    batch: dict[str, str] = {}
    for person in present:
        if not isinstance(person, dict):
            continue
        national_id = str(person.get("id") or "").strip()
        if not _NATIONAL_ID.fullmatch(national_id) or national_id in batch:
            continue
        data_url = _signature_data_url(national_id)
        if data_url:
            batch[national_id] = data_url
    return batch
