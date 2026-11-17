"""يصدّر صفوف التجربة 1448 فقط إلى data/pilot-1448-seed.json."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from Core_Engine.database import DB_PATH

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "pilot-1448-seed.json"

TABLES = (
    ("teacher_documents", "source LIKE 'pilot-1448%'"),
    ("teacher_exams", "source LIKE 'pilot-1448%'"),
    ("teacher_analysis", "source LIKE 'pilot-1448%'"),
    ("teacher_remedial", "source LIKE 'pilot-1448%'"),
    ("teacher_enrichment", "source LIKE 'pilot-1448%'"),
    (
        "students_support",
        "source = 'pilot-1448-support' OR source LIKE 'pilot-1448-%'",
    ),
    ("improvement_actions", "evidence LIKE 'pilot-1448-%'"),
    ("school_programs", "duty_ref LIKE 'pilot-1448-%'"),
    (
        "leadership_seat",
        "role = 'school_affairs_agent' AND national_id = '1036307674'",
    ),
)


def _columns(connection: sqlite3.Connection, table: str) -> list[str]:
    found = [row[1] for row in connection.execute(f"PRAGMA table_info({table})")]
    return [name for name in found if name != "id"]


def export_seed() -> dict:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    payload = {"tables": {}}
    try:
        for table, where in TABLES:
            columns = _columns(connection, table)
            quoted = ", ".join(columns)
            rows = connection.execute(
                f"SELECT {quoted} FROM {table} WHERE {where}"
            ).fetchall()
            payload["tables"][table] = [dict(row) for row in rows]
    finally:
        connection.close()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


if __name__ == "__main__":
    written = export_seed()
    for name, rows in written["tables"].items():
        print(f"{name}: {len(rows)}")
