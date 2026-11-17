# يفحص أعداد القاعدة والتوقيعات واليتامى. لا يكتب ولا يحذف.

from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXPECTED = {
    "students": 338,
    "staff": 39,
    "nafes": 438,
    "signatures": 31,
    "plans": 56,
    "procedures": 26,
}
INDICATOR = "2-1-1-2"


def db_path() -> Path:
    configured = os.environ.get("DATABASE_PATH", "School_Data/school_1059.db")
    path = Path(configured)
    if not path.is_absolute():
        path = ROOT / path
    return path.resolve()


def signature_dir() -> Path:
    return ROOT / "School_Data" / "signatures"


def _active(connection: sqlite3.Connection, table: str) -> str:
    columns = {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}
    if "is_deleted" in columns:
        return "COALESCE(is_deleted, 0) = 0"
    return "1 = 1"


def _count(connection: sqlite3.Connection, sql: str) -> int:
    return int(connection.execute(sql).fetchone()[0])


def collect(connection: sqlite3.Connection | None = None) -> dict:
    own = connection is None
    if own:
        connection = sqlite3.connect(db_path())
    checks = []
    try:
        students = _count(connection, f"SELECT COUNT(*) FROM noor_students WHERE {_active(connection, 'noor_students')}")
        staff = _count(connection, f"SELECT COUNT(*) FROM noor_staff WHERE {_active(connection, 'noor_staff')}")
        nafes = _count(connection, "SELECT COUNT(*) FROM nafes_timetable")
        no_grade = _count(
            connection,
            f"SELECT COUNT(*) FROM noor_students WHERE {_active(connection, 'noor_students')} AND TRIM(COALESCE(grade, '')) = ''",
        )
        no_role = _count(
            connection,
            f"SELECT COUNT(*) FROM noor_staff WHERE {_active(connection, 'noor_staff')} AND TRIM(COALESCE(role, '')) = ''",
        )
        linked = _count(
            connection,
            "SELECT COUNT(*) FROM users WHERE TRIM(COALESCE(signature_path, '')) != ''",
        )
        shown = _count(
            connection,
            f"""
            SELECT COUNT(*) FROM noor_students
            WHERE {_active(connection, 'noor_students')}
              AND (
                TRIM(COALESCE(national_id, '')) != ''
                OR TRIM(COALESCE(name, '')) != ''
              )
            """,
        )
    finally:
        if own:
            connection.close()
    files = len(list(signature_dir().glob("sig_*.png"))) if signature_dir().is_dir() else 0
    plans = 0
    procedures = 0
    bank = ROOT / "School_Data" / "knowledge_bases" / "plans-bank.json"
    if bank.is_file():
        import json

        rows = json.loads(bank.read_text(encoding="utf-8"))
        plans = len(rows) if isinstance(rows, list) else 0
        for row in rows if isinstance(rows, list) else []:
            if str(row.get("code") or "") == INDICATOR:
                procedures = len(row.get("procedures") or [])
                break
    sheet = ROOT / "Print_Canvas" / "css" / "print-master.css"
    sheet_text = sheet.read_text(encoding="utf-8") if sheet.is_file() else ""
    print_ok = "210mm" in sheet_text and "A4" in sheet_text and "pm-page-num" in sheet_text

    def add(name: str, ok: bool, detail: str) -> None:
        checks.append({"name": name, "ok": ok, "detail": detail})

    add("الطلاب", students == EXPECTED["students"], f"{students}")
    add("المنسوبون", staff == EXPECTED["staff"], f"{staff}")
    add("حصص نافس", nafes == EXPECTED["nafes"], f"{nafes}")
    add("التوقيعات", files == EXPECTED["signatures"] and linked == EXPECTED["signatures"], f"ملفات {files} / مسارات {linked}")
    add("طلاب بلا صف", no_grade == 0, f"{no_grade}")
    add("منسوبون بلا صفة", no_role == 0, f"{no_role}")
    add("تطابق سجل الطلاب", shown == students, f"{shown} = {students}")
    add("بنك الخطط", plans == EXPECTED["plans"] and procedures == EXPECTED["procedures"], f"{plans} مؤشراً / {INDICATOR} = {procedures} إجراء")
    add("قالب الطباعة", print_ok, "210mm وA4 ورقم الصفحة" if print_ok else "النقص في print-master.css")
    return {"ok": all(item["ok"] for item in checks), "checks": checks}


def main() -> int:
    if not db_path().is_file():
        print("فشل: القاعدة غير موجودة")
        return 1
    report = collect()
    failed = 0
    for item in report["checks"]:
        mark = "نجاح" if item["ok"] else "فشل"
        if not item["ok"]:
            failed += 1
        print(f"{mark}: {item['name']} — {item['detail']}")
    print("النتيجة: نجاح" if report["ok"] else "النتيجة: فشل")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
