# -*- coding: utf-8 -*-
"""تشخيص EL / noor_students — قراءة فقط."""
import sqlite3
from pathlib import Path

DB = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059\School_Data\school_1059.db")
conn = sqlite3.connect(str(DB))
c = conn.cursor()

def header(t):
    print("\n" + "=" * 70)
    print(t)
    print("=" * 70)

header("sqlite_master: جداول استيراد / طلاب")
c.execute("""
    SELECT name FROM sqlite_master
    WHERE type='table'
      AND (name LIKE '%import%' OR name LIKE '%student%' OR name LIKE '%log%')
    ORDER BY name
""")
print([r[0] for r in c.fetchall()])

header("5) PRAGMA table_info(noor_students)")
c.execute("PRAGMA table_info(noor_students)")
for r in c.fetchall():
    print(f"  cid={r[0]} name={r[1]} type={r[2]} notnull={r[3]} default={r[4]} pk={r[5]}")

header("1) COUNT(*)")
c.execute("SELECT COUNT(*) FROM noor_students")
print(c.fetchone()[0])

header("2) grade, classroom")
c.execute("""
    SELECT grade, classroom, COUNT(*) as n
    FROM noor_students
    GROUP BY grade, classroom
    ORDER BY grade, classroom
""")
print(f"{'grade':30s} {'section':12s} n")
total = 0
for g, sec, n in c.fetchall():
    total += n
    print(f"{str(g or '(فارغ)'):30s} {str(sec or '(فارغ)'):12s} {n}")
print("sum:", total)

header("4) آخر 5 (updated_at — لا created_at)")
c.execute("""
    SELECT name, grade, classroom, updated_at
    FROM noor_students
    ORDER BY updated_at DESC, name
    LIMIT 5
""")
for row in c.fetchall():
    print(" ", row)

header("3) بحث جداول السجل")
for tbl in ("student_imports", "import_logs", "imports", "noor_import_log"):
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tbl,))
    print(f"  {tbl}: {'موجود' if c.fetchone() else 'غير موجود'}")

header("دفعات updated_at")
c.execute("SELECT updated_at, COUNT(*) FROM noor_students GROUP BY updated_at ORDER BY updated_at")
for row in c.fetchall():
    print(" ", row)

conn.close()
print("\n✅")
