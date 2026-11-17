"""يعيد صفوف التجربة 1448 من data/pilot-1448-seed.json. الحذف يقتصر على وسم التجربة."""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

from .database import connect

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "data" / "pilot-1448-seed.json"

FILTERS = (
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


def seed_exists() -> bool:
    return SEED.is_file()


def load_seed() -> dict:
    return json.loads(SEED.read_text(encoding="utf-8"))


def _count(connection: sqlite3.Connection, table: str, where: str) -> int:
    row = connection.execute(f"SELECT COUNT(*) FROM {table} WHERE {where}").fetchone()
    return int(row[0]) if row else 0


def plan(connection: sqlite3.Connection | None = None) -> list[tuple[str, int, int, str]]:
    """كل جدول: الاسم، ما سيُحذف، ما سيُضاف، ملاحظة."""
    own = connection is None
    connection = connection or connect()
    payload = load_seed()
    tables = payload.get("tables") or {}
    rows = []
    try:
        for table, where in FILTERS:
            incoming = tables.get(table) or []
            note = ""
            if table == "leadership_seat" and incoming:
                note = "admin_assistant = عبدالمجيد"
            rows.append((table, _count(connection, table, where), len(incoming), note))
    finally:
        if own:
            connection.close()
    return rows


def support_split() -> tuple[int, int]:
    payload = load_seed()
    gifted = 0
    struggling = 0
    for row in (payload.get("tables") or {}).get("students_support") or []:
        source = str(row.get("source") or "")
        if source != "pilot-1448-support" and not source.startswith("pilot-1448-"):
            continue
        category = str(row.get("category") or "")
        if category == "gifted":
            gifted += 1
        elif category == "struggling":
            struggling += 1
    return gifted, struggling


def already_imported() -> bool:
    if not seed_exists():
        return False
    connection = connect()
    try:
        counts = {table: _count(connection, table, where) for table, where in FILTERS}
    finally:
        connection.close()
    return (
        counts.get("teacher_documents", 0) >= 84
        and counts.get("teacher_exams", 0) >= 84
        and counts.get("students_support", 0) >= 89
        and counts.get("improvement_actions", 0) >= 1
        and counts.get("school_programs", 0) >= 3
        and counts.get("leadership_seat", 0) >= 1
    )


def _insert(connection: sqlite3.Connection, table: str, row: dict) -> None:
    columns = [name for name in row.keys() if name != "id"]
    placeholders = ", ".join("?" for _ in columns)
    quoted = ", ".join(columns)
    connection.execute(
        f"INSERT INTO {table} ({quoted}) VALUES ({placeholders})",
        [row[name] for name in columns],
    )


def apply() -> int:
    payload = load_seed()
    tables = payload.get("tables") or {}
    connection = connect()
    written = 0
    try:
        connection.execute("BEGIN")
        for table, where in FILTERS:
            connection.execute(f"DELETE FROM {table} WHERE {where}")
            for row in tables.get(table) or []:
                if not isinstance(row, dict):
                    continue
                _insert(connection, table, row)
                written += 1
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return written


def render() -> str:
    lines = ["جدول                    | سيُحذف | سيُضاف"]
    deleted = 0
    added = 0
    for table, will_delete, will_add, note in plan():
        deleted += will_delete
        added += will_add
        extra = f"  ({note})" if note else ""
        lines.append(f"{table:<23} | {will_delete:<6} | {will_add}{extra}")
    lines.append(f"{'الإجمالي':<23} | {deleted:<6} | {added}")
    gifted, struggling = support_split()
    lines.append(f"students_support: موهوب {gifted} + متدن {struggling}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not seed_exists():
        print("ملف البذرة غير موجود.")
        return 1
    if args.apply:
        written = apply()
        print(render())
        print(f"طُبّق: {written}")
        return 0
    print(render())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
