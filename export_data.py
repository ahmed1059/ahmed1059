# يقرأ School_Data/school_1059.db ويكتب school_1059_dump.sql. لا يعدل القاعدة ولا يحذف ملفاً.

from __future__ import annotations

import base64
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "School_Data" / "school_1059.db"
DUMP = ROOT / "school_1059_dump.sql"
SIGNATURES = ROOT / "School_Data" / "signatures"
MARKER = "-- PM_SIGNATURES"
REQUIRED = (
    "noor_students",
    "noor_staff",
    "noor_timetable",
    "nafes_timetable",
    "leadership_seat",
    "users",
)


def counts(connection: sqlite3.Connection) -> dict[str, int]:
    found = {}
    for name in REQUIRED:
        row = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
            (name,),
        ).fetchone()
        if row is None:
            found[name] = -1
            continue
        found[name] = connection.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
    return found


def signature_rows(connection: sqlite3.Connection) -> int:
    columns = [
        row[1]
        for row in connection.execute("PRAGMA table_info(users)").fetchall()
    ]
    if "signature_path" not in columns:
        return 0
    return connection.execute(
        """
        SELECT COUNT(*) FROM users
        WHERE signature_path IS NOT NULL AND TRIM(signature_path) != ''
        """
    ).fetchone()[0]


def signature_files() -> list[Path]:
    if not SIGNATURES.is_dir():
        return []
    return sorted(
        path
        for path in SIGNATURES.glob("sig_*.png")
        if path.is_file() and path.name.startswith("sig_") and path.suffix.lower() == ".png"
    )


def main() -> int:
    if not SOURCE.is_file():
        print("القاعدة المحلية غير موجودة")
        return 1
    connection = sqlite3.connect(f"file:{SOURCE.as_posix()}?mode=ro", uri=True)
    try:
        table_counts = counts(connection)
        linked = signature_rows(connection)
        missing = [name for name, total in table_counts.items() if total < 0]
        lines = [f"-- source {SOURCE.name}"]
        lines.extend(connection.iterdump())
    finally:
        connection.close()

    files = signature_files()
    lines.append(MARKER)
    for path in files:
        payload = base64.b64encode(path.read_bytes()).decode("ascii")
        lines.append(f"-- FILE {path.name}")
        for offset in range(0, len(payload), 76):
            lines.append("-- B64 " + payload[offset:offset + 76])
        lines.append("-- END")
    lines.append("")
    DUMP.write_text("\n".join(lines), encoding="utf-8")

    labels = {
        "noor_students": "الطلاب",
        "noor_staff": "المنسوبون",
        "noor_timetable": "حصص نور",
        "nafes_timetable": "حصص نافس",
        "leadership_seat": "المقاعد",
        "users": "المستخدمون",
    }
    for name in REQUIRED:
        total = table_counts[name]
        text = "غير موجود" if total < 0 else str(total)
        print(f"{labels[name]}: {text}")
    print(f"مسارات التوقيع في users: {linked}")
    print(f"ملفات التوقيع: {len(files)}")
    print(f"البايت: {DUMP.stat().st_size}")
    print(f"الملف: {DUMP.name}")
    if missing:
        print("جداول ناقصة: " + "، ".join(missing))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
