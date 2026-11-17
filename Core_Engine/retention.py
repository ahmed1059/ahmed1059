# إخفاء قابل للاستعادة. لا DELETE على الجداول الأربعة. قرار 292.
# programs في الطلب = school_programs. الجدول الدراسي الحي = noor_timetable، وnafes_timetable جدول نافس.

from __future__ import annotations

from .audit_log import log_action

SOFT_TABLES = {
    "noor_students": "national_id",
    "noor_staff": "national_id",
    "school_programs": "id",
    "nafes_timetable": "id",
    "noor_timetable": "id",
}

TABLE_LABELS = {
    "noor_students": "الطلاب",
    "noor_staff": "المنسوبون",
    "school_programs": "البرامج",
    "nafes_timetable": "جدول نافس",
    "noor_timetable": "الجدول الدراسي",
}


def ensure_soft_delete(connection) -> None:
    for table in SOFT_TABLES:
        found = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table,),
        ).fetchone()
        if not found:
            continue
        columns = {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}
        if "is_deleted" not in columns:
            connection.execute(
                f"ALTER TABLE {table} ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0"
            )


def alive_sql(alias: str = "") -> str:
    column = f"{alias}.is_deleted" if alias else "is_deleted"
    return f"COALESCE({column}, 0) = 0"


def hide(connection, table: str, record_id, user_id: str = "", label: str = "") -> int:
    key = SOFT_TABLES.get(table)
    if not key:
        raise ValueError("جدول غير معتمد للإخفاء")
    cursor = connection.execute(
        f"UPDATE {table} SET is_deleted = 1 WHERE {key} = ? AND COALESCE(is_deleted, 0) = 0",
        (record_id,),
    )
    if cursor.rowcount:
        log_action(
            user_id,
            "إخفاء",
            table,
            record_id,
            label,
            "is_deleted=1",
            connection,
        )
    return int(cursor.rowcount or 0)


def restore(connection, table: str, record_id, user_id: str = "") -> int:
    key = SOFT_TABLES.get(table)
    if not key:
        raise ValueError("جدول غير معتمد للاستعادة")
    cursor = connection.execute(
        f"UPDATE {table} SET is_deleted = 0 WHERE {key} = ? AND COALESCE(is_deleted, 0) = 1",
        (record_id,),
    )
    if cursor.rowcount:
        log_action(
            user_id,
            "استعادة",
            table,
            record_id,
            "is_deleted=1",
            "is_deleted=0",
            connection,
        )
    return int(cursor.rowcount or 0)


def trash_rows(connection) -> list[dict]:
    items = []
    queries = {
        "noor_students": "SELECT national_id, name FROM noor_students WHERE COALESCE(is_deleted, 0) = 1 ORDER BY name",
        "noor_staff": "SELECT national_id, name FROM noor_staff WHERE COALESCE(is_deleted, 0) = 1 ORDER BY name",
        "school_programs": "SELECT id, program_name FROM school_programs WHERE COALESCE(is_deleted, 0) = 1 ORDER BY id",
        "nafes_timetable": "SELECT id, teacher || ' / ' || day || ' / ' || period FROM nafes_timetable WHERE COALESCE(is_deleted, 0) = 1 ORDER BY id",
        "noor_timetable": "SELECT id, day || ' / ' || period || ' / ' || COALESCE(subject, '') FROM noor_timetable WHERE COALESCE(is_deleted, 0) = 1 ORDER BY id",
    }
    for table, sql in queries.items():
        found = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table,),
        ).fetchone()
        if not found:
            continue
        for record_id, label in connection.execute(sql):
            items.append(
                {
                    "table": table,
                    "table_label": TABLE_LABELS[table],
                    "record_id": str(record_id),
                    "label": str(label or "").strip() or TABLE_LABELS[table],
                }
            )
    return items
