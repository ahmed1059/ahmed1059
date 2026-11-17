# ناقل أحداث داخل العملية — قرار 282، والاحتفاظ الأخير قرار 294.
# الكتابة تُعلَن للمتصلين، وتبقى آخر الرسائل للاستطلاع إن غاب WebSocket.

from __future__ import annotations

import asyncio
import json
import re
from collections import deque
from datetime import datetime, timezone

_loop: asyncio.AbstractEventLoop | None = None
_queue: asyncio.Queue | None = None
_sockets: set = set()
_recent: deque = deque(maxlen=200)
_seq = 0
_WRITE = re.compile(
    r"^\s*(INSERT|UPDATE|DELETE|REPLACE)\s+(?:OR\s+\w+\s+)*(?:INTO|FROM)?\s+\"?([A-Za-z_][A-Za-z0-9_]*)",
    re.IGNORECASE,
)
_SKIP = {"sqlite_sequence"}


def bind_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop, _queue
    _loop = loop
    if _queue is None:
        _queue = asyncio.Queue()


def register(socket) -> None:
    _sockets.add(socket)


def unregister(socket) -> None:
    _sockets.discard(socket)


def publish(topic: str, payload: dict | None = None) -> None:
    global _seq
    _seq += 1
    message = json.dumps(
        {
            "topic": topic,
            "at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "payload": payload or {},
        },
        ensure_ascii=False,
    )
    _recent.append({"id": _seq, "raw": message})
    if _loop is None or _queue is None or not _sockets:
        return
    _loop.call_soon_threadsafe(_queue.put_nowait, message)


def since(after: int = 0) -> dict:
    """رسائل أحدث من المؤشر. تُقرأ من الجلسة حين لا يعمل WebSocket."""
    cursor = int(after or 0)
    events = []
    for item in _recent:
        if item["id"] <= cursor:
            continue
        events.append({"id": item["id"], "event": json.loads(item["raw"])})
    return {"next": _seq, "events": events}


def trace_sql(statement: str) -> None:
    matched = _WRITE.match(statement or "")
    if not matched:
        return
    table = matched.group(2)
    if table in _SKIP:
        return
    publish("db.change", {"table": table, "verb": matched.group(1).upper()})


async def hub() -> None:
    if _queue is None:
        return
    while True:
        message = await _queue.get()
        dead = []
        for socket in list(_sockets):
            try:
                await socket.send_text(message)
            except Exception:
                dead.append(socket)
        for socket in dead:
            _sockets.discard(socket)
