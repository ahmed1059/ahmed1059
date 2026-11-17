# تعديل محضر واحد وحذفه بجلسة. لا يستبدل الملف كاملًا.
# النسخ الاحتياطي شرط قبل أي كتابة. فشل النسخ يوقف العملية.

from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(tags=["session-councils"])

_ROOT = Path(__file__).resolve().parents[1]
_MINUTES = _ROOT / "School_Data" / "council_minutes.json"
_BACKUPS = _ROOT / "School_Data" / "backups"
_LOG = _ROOT / "docs" / "سجل_1059.md"

_TYPE_LABELS = {
    "admin": "اللجنة الإدارية",
    "guidance": "لجنة التوجيه والإرشاد",
    "achievement": "لجنة التحصيل الدراسي",
    "excellence": "لجنة التميز",
    "fund": "فريق الصندوق المدرسي",
    "safety": "فريق الأمن والسلامة المدرسية",
    "activity": "لجنة النشاط والمناسبات",
    "discipline": "لجنة الانضباط والتدخل السريع",
    "special": "فريق التربية الخاصة",
}


class CouncilUpdate(BaseModel):
    type: str = ""
    hijri: str = ""
    gregorian: str = ""
    iso: str = ""
    agenda: str = ""
    present: list = Field(default_factory=list)
    minutes: str = ""
    registerKey: str = ""
    registerLabel: str = ""
    dayKey: str = ""


def _token(value: str) -> str:
    return str(value or "").strip()


def _require_user(x_session_token: str) -> dict:
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _now_label() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def load_minutes() -> list:
    if not _MINUTES.is_file():
        return []
    payload = json.loads(_MINUTES.read_text(encoding="utf-8"))
    minutes = payload.get("minutes") if isinstance(payload, dict) else []
    if not isinstance(minutes, list):
        return []
    return minutes


def _index_of(minutes: list, council_id: str) -> int:
    identity = str(council_id or "").strip()
    for index, item in enumerate(minutes):
        if isinstance(item, dict) and str(item.get("id") or "").strip() == identity:
            return index
    return -1


def backup_council_minutes() -> Path:
    """ينسخ الملف قبل الكتابة. أي فشل يرفع خطأ ولا يُكمل الحفظ."""
    if not _MINUTES.is_file():
        raise HTTPException(status_code=500, detail="تعذر إنشاء النسخة الاحتياطية")
    _BACKUPS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    target = _BACKUPS / ("council_minutes-" + stamp + ".json")
    if target.exists():
        target = _BACKUPS / ("council_minutes-" + stamp + "-2.json")
    shutil.copy2(_MINUTES, target)
    if not target.is_file() or target.stat().st_size != _MINUTES.stat().st_size:
        raise HTTPException(status_code=500, detail="تعذر إنشاء النسخة الاحتياطية")
    return target


def _append_log(action: str, record: dict) -> None:
    kind = str(record.get("type") or "").strip()
    label = _TYPE_LABELS.get(kind, kind or "غير محدد")
    identity = str(record.get("id") or "").strip()
    line = "- " + _now_label() + " — " + action + " — النوع: " + label + " — المعرّف: " + identity + "\n"
    with _LOG.open("a", encoding="utf-8") as handle:
        handle.write(line)


def commit_minutes(minutes: list, action: str, record: dict) -> None:
    backup = backup_council_minutes()
    _MINUTES.write_text(
        json.dumps({"minutes": minutes}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    try:
        _append_log(action, record)
    except OSError as error:
        shutil.copy2(backup, _MINUTES)
        raise HTTPException(status_code=500, detail="تعذر توثيق العملية") from error


def _apply_update(current: dict, body: CouncilUpdate) -> dict:
    updated = dict(current)
    updated["id"] = str(current.get("id") or "").strip()
    updated["type"] = body.type.strip()
    updated["hijri"] = body.hijri.strip()
    updated["gregorian"] = body.gregorian.strip()
    updated["iso"] = body.iso.strip()
    updated["agenda"] = body.agenda.strip()
    updated["present"] = body.present if isinstance(body.present, list) else []
    updated["minutes"] = body.minutes.strip()
    updated["registerKey"] = body.registerKey.strip()
    updated["registerLabel"] = body.registerLabel.strip()
    updated["dayKey"] = body.dayKey.strip() or body.iso.strip()
    return updated


@router.get("/api/session/councils/{council_id}")
def get_session_council(council_id: str, x_session_token: str = Header(default="")):
    """يعيد محضرًا واحدًا. الغائب 404 ولا يُنشأ محضر."""
    _require_user(x_session_token)
    minutes = load_minutes()
    index = _index_of(minutes, council_id)
    if index < 0:
        raise HTTPException(status_code=404, detail="المحضر غير موجود")
    return minutes[index]


@router.put("/api/session/councils/{council_id}")
def update_session_council(
    council_id: str,
    body: CouncilUpdate,
    x_session_token: str = Header(default=""),
):
    """يحدّث حقول المحضر الموجود ويبقي رقمه. الغائب 404."""
    _require_user(x_session_token)
    if not body.type.strip() or not body.agenda.strip() or not body.minutes.strip():
        raise HTTPException(status_code=400, detail="النوع والموضوع والنص مطلوبة")
    if len(body.iso.strip()) != 10:
        raise HTTPException(status_code=400, detail="تاريخ الاجتماع غير مكتمل")
    minutes = load_minutes()
    index = _index_of(minutes, council_id)
    if index < 0:
        raise HTTPException(status_code=404, detail="المحضر غير موجود")
    updated = _apply_update(minutes[index], body)
    if updated["id"] != str(council_id).strip():
        raise HTTPException(status_code=404, detail="المحضر غير موجود")
    minutes[index] = updated
    commit_minutes(minutes, "تعديل", updated)
    return updated


@router.delete("/api/session/councils/{council_id}")
def delete_session_council(council_id: str, x_session_token: str = Header(default="")):
    """يحذف محضرًا واحدًا بعد نسخة احتياطية. الغائب 404."""
    _require_user(x_session_token)
    minutes = load_minutes()
    index = _index_of(minutes, council_id)
    if index < 0:
        raise HTTPException(status_code=404, detail="المحضر غير موجود")
    removed = minutes.pop(index)
    commit_minutes(minutes, "حذف", removed)
    return {"ok": True, "id": str(council_id).strip()}
