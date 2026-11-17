# فحص المساحة المتبقية على قرص بيانات المدرسة. قرار 293.

from __future__ import annotations

import asyncio
import shutil
from pathlib import Path

_DATA = Path(__file__).resolve().parent.parent / "School_Data"
LOW_RATIO = 0.10


def snapshot(path: Path | None = None) -> dict:
    target = path or _DATA
    target.mkdir(parents=True, exist_ok=True)
    usage = shutil.disk_usage(target)
    ratio = (usage.free / usage.total) if usage.total else 1
    return {
        "free_bytes": int(usage.free),
        "total_bytes": int(usage.total),
        "free_percent": round(ratio * 100, 2),
        "low": ratio < LOW_RATIO,
    }


def publish_if_low() -> dict:
    state = snapshot()
    if state["low"]:
        from .event_bus import publish

        publish("disk.low", {"free_percent": state["free_percent"]})
    return state


async def watch() -> None:
    while True:
        try:
            publish_if_low()
        except Exception:
            pass
        await asyncio.sleep(3600)
