# يجهّز قاعدة السحابة من school_1059_dump.sql عند DATABASE_PATH.
# التفريغ نص SQL، فيُنفَّذ داخل ملف SQLite. لا يُنسخ النص فوق الامتداد .db.
# إن وُجدت صفوف يتوقف ولا يحذف شيئاً.

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

from import_data import apply_sql, row_count, split_dump, write_signatures

ROOT = Path(__file__).resolve().parent
DUMP = ROOT / "school_1059_dump.sql"


def target_path() -> Path:
    configured = os.environ.get("DATABASE_PATH", "School_Data/school_1059.db")
    path = Path(configured)
    if not path.is_absolute():
        path = ROOT / path
    return path.resolve()


def main() -> int:
    target = target_path()
    if not DUMP.is_file():
        print("ملف التفريغ غير موجود")
        return 1
    target.parent.mkdir(parents=True, exist_ok=True)
    sql, files = split_dump(DUMP.read_text(encoding="utf-8"))
    connection = sqlite3.connect(target)
    try:
        if row_count(connection):
            print("القاعدة تحتوي بيانات. لم يُستبدل شيء.")
            print(target)
            return 0
        apply_sql(connection, sql)
        students = connection.execute("SELECT COUNT(*) FROM noor_students").fetchone()[0]
        staff = connection.execute("SELECT COUNT(*) FROM noor_staff").fetchone()[0]
    finally:
        connection.close()
    written = write_signatures(target, files)
    print("تم تجهيز القاعدة")
    print(target)
    print(f"الطلاب: {students}")
    print(f"المنسوبون: {staff}")
    print(f"ملفات التوقيع: {written}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
