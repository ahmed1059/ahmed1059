# سجل التدقيق. الصف يُضاف ولا يُحذف. قرار 295.

from __future__ import annotations

import json
from datetime import datetime, timezone

from .database import connect


def ensure_audit_table(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY,
            user_id TEXT,
            action TEXT NOT NULL,
            table_name TEXT,
            record_id TEXT,
            old_value TEXT,
            new_value TEXT,
            timestamp TEXT NOT NULL
        )
        """
    )


def _clip(value) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        value = json.dumps(value, ensure_ascii=False)
    return str(value)[:2000]


def log_action(user_id, action, table_name, record_id, old_value="", new_value="", connection=None) -> None:
    """يسجّل تعديلاً. إن مُرّر الاتصال لا يُغلق ولا يُثبَّت من هنا."""
    owns = connection is None
    if owns:
        connection = connect()
    try:
        ensure_audit_table(connection)
        connection.execute(
            """
            INSERT INTO audit_logs (
                user_id, action, table_name, record_id, old_value, new_value, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(user_id or ""),
                str(action or "").strip() or "تعديل",
                str(table_name or ""),
                str(record_id or ""),
                _clip(old_value),
                _clip(new_value),
                datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            ),
        )
        if owns:
            connection.commit()
    finally:
        if owns:
            connection.close()
