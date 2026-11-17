# -*- coding: utf-8 -*-
"""تشخيص noor_students — قراءة فقط."""
import sqlite3
from pathlib import Path

DB = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059\School_Data\school_1059.db")
conn = sqlite3.connect(str(DB))
c = conn.cursor()

def header(t):
    print("\n" + "=" * 70)
    print(t)
    print("=" * 70)

header("جداول الطلاب الموجودة")
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%student%' ORDER BY name")
print("tables:", [r[0] for r in c.fetchall()])
c.execute("PRAGMA table_info(noor_students)")
print("noor_students columns:", [(r[1], r[2]) for r in c.fetchall()])

header("1) COUNT(*)")
c.execute("SELECT COUNT(*) FROM noor_students")
print("noor_students:", c.fetchone()[0])
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='students'")
if c.fetchone():
    c.execute("SELECT COUNT(*) FROM students")
    print("students:", c.fetchone()[0])
else:
    print("students: الجدول غير موجود (المصدر: noor_students)")

header("2) COUNT(DISTINCT name)")
c.execute("SELECT COUNT(DISTINCT name) FROM noor_students")
print("distinct name:", c.fetchone()[0])
c.execute("SELECT COUNT(DISTINCT national_id) FROM noor_students")
print("distinct national_id:", c.fetchone()[0])

header("3) grade, classroom")
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
print("sum groups:", total)

header("4) آخر 5 حسب updated_at")
c.execute("""
    SELECT name, grade, classroom, updated_at
    FROM noor_students
    ORDER BY updated_at DESC, name
    LIMIT 5
""")
for name, g, sec, ts in c.fetchall():
    print(f"  {ts} | {g} / {sec} | {name}")

header("تواريخ التحديث (كم دفعة؟)")
c.execute("""
    SELECT updated_at, COUNT(*)
    FROM noor_students
    GROUP BY updated_at
    ORDER BY updated_at
""")
for ts, n in c.fetchall():
    print(f"  {ts}  {n}")

header("status")
c.execute("SELECT status, COUNT(*) FROM noor_students GROUP BY status")
for s, n in c.fetchall():
    print(f"  {s or '(فارغ)'}: {n}")

conn.close()
print("\n✅ انتهى.")
