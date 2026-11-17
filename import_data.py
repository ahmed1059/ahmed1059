# يستورد school_1059_dump.sql إلى قاعدة فارغة يحددها DATABASE_PATH.
# يرفض الكتابة على School_Data/school_1059.db المحلية. لا يحذف ملفات.

from __future__ import annotations

import base64
import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOCAL_DB = (ROOT / "School_Data" / "school_1059.db").resolve()
APP_SIGNATURES = ROOT / "School_Data" / "signatures"
MARKER = "-- PM_SIGNATURES"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def split_dump(text: str) -> tuple[str, list[tuple[str, bytes]]]:
    sql, marker, trailer = text.partition("\n" + MARKER + "\n")
    if not marker:
        return text, []
    files = []
    name = ""
    chunks = []
    for line in trailer.splitlines():
        if line.startswith("-- FILE "):
            name = Path(line.removeprefix("-- FILE ").strip()).name
            chunks = []
            continue
        if line.startswith("-- B64 ") and name:
            chunks.append(line.removeprefix("-- B64 ").strip())
            continue
        if line.startswith("-- END") and name:
            raw = base64.b64decode("".join(chunks), validate=True)
            if not name.startswith("sig_") or not name.endswith(".png") or not raw.startswith(PNG_MAGIC):
                raise ValueError("ملف توقيع غير مقبول: " + name)
            files.append((name, raw))
            name = ""
            chunks = []
    return sql, files


def row_count(connection: sqlite3.Connection) -> int:
    names = [
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
    ]
    total = 0
    for name in names:
        total += connection.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
    return total


def apply_sql(connection: sqlite3.Connection, sql: str) -> None:
    adapted = (
        sql.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
        .replace("CREATE UNIQUE INDEX ", "CREATE UNIQUE INDEX IF NOT EXISTS ")
        .replace("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ")
    )
    buffer = ""
    connection.execute("BEGIN")
    try:
        for line in adapted.splitlines(keepends=True):
            buffer += line
            if not sqlite3.complete_statement(buffer):
                continue
            statement = buffer.strip()
            buffer = ""
            if not statement or statement in {"BEGIN TRANSACTION;", "COMMIT;"}:
                continue
            try:
                connection.execute(statement)
            except sqlite3.OperationalError as error:
                if "already exists" not in str(error).lower():
                    raise
        if buffer.strip():
            raise ValueError("تعذر قراءة نهاية ملف التفريغ")
        connection.commit()
    except Exception:
        connection.rollback()
        raise


def write_signatures(target_db: Path, files: list[tuple[str, bytes]]) -> int:
    folders = [APP_SIGNATURES]
    parent = target_db.parent
    if parent.name == "School_Data" and parent.resolve() != APP_SIGNATURES.parent.resolve():
        folders.append(parent / "signatures")
    for folder in folders:
        folder.mkdir(parents=True, exist_ok=True)
        for name, raw in files:
            destination = folder / name
            if destination.exists():
                continue
            destination.write_bytes(raw)
    return len(files)


def main() -> int:
    dump_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "school_1059_dump.sql"
    configured = os.environ.get("DATABASE_PATH", "").strip()
    if not configured:
        print("حدد DATABASE_PATH لقاعدة السحابة. لن تُمس القاعدة المحلية.")
        return 1
    target = Path(configured)
    if not target.is_absolute():
        target = ROOT / target
    target = target.resolve()
    if target == LOCAL_DB:
        print("المسار هو القاعدة المحلية. توقف.")
        return 1
    if not dump_path.is_file():
        print("ملف التفريغ غير موجود")
        return 1
    sql, files = split_dump(dump_path.read_text(encoding="utf-8"))
    target.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(target)
    try:
        if row_count(connection):
            print("القاعدة المستهدفة ليست فارغة. توقف.")
            return 1
        apply_sql(connection, sql)
        students = connection.execute("SELECT COUNT(*) FROM noor_students").fetchone()[0]
        staff = connection.execute("SELECT COUNT(*) FROM noor_staff").fetchone()[0]
        lessons = connection.execute("SELECT COUNT(*) FROM noor_timetable").fetchone()[0]
        nafes = connection.execute("SELECT COUNT(*) FROM nafes_timetable").fetchone()[0]
        seats = connection.execute("SELECT COUNT(*) FROM leadership_seat").fetchone()[0]
    finally:
        connection.close()
    written = write_signatures(target, files)
    print(f"الطلاب: {students}")
    print(f"المنسوبون: {staff}")
    print(f"حصص نور: {lessons}")
    print(f"حصص نافس: {nafes}")
    print(f"المقاعد: {seats}")
    print(f"ملفات التوقيع: {written}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
