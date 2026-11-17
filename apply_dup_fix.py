# -*- coding: utf-8 -*-
"""دمج يتامى نوفمبر في أصل أكتوبر — خطوة 1ب فقط."""
import sqlite3
from pathlib import Path

DB = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059\School_Data\school_1059.db")
NAMES = (
    "بشير ماجد احمد ناجي",
    "عبدالرحمن حسين شوعي عيد",
    "عبدالعزيز عبدالغني يحي احمد",
    "عبدالعزيز علي احمد يحيى",
    "عبدالكريم صلاح محمد رماد",
)

conn = sqlite3.connect(str(DB))
c = conn.cursor()

c.execute("SELECT COUNT(*) FROM noor_students")
before = c.fetchone()[0]
print("before COUNT:", before)

c.execute(
    """
    UPDATE noor_students
    SET status = (
      SELECT status FROM noor_students n2
      WHERE n2.name = noor_students.name
        AND n2.updated_at = '2026-11-09T20:04:42+00:00'
        AND (n2.grade IS NULL OR n2.grade = '')
      LIMIT 1
    ),
    updated_at = '2026-11-09T20:04:42+00:00'
    WHERE updated_at = '2026-10-24T17:30:00+00:00'
      AND name IN (?, ?, ?, ?, ?)
    """,
    NAMES,
)
print("updated oct rows:", c.rowcount)

print("\nبعد نسخ status (قبل الحذف):")
c.execute(
    """
    SELECT national_id, name, grade, classroom, status, updated_at
    FROM noor_students
    WHERE name IN (?, ?, ?, ?, ?)
    ORDER BY name, national_id
    """,
    NAMES,
)
for row in c.fetchall():
    print(" ", row)

c.execute(
    """
    SELECT COUNT(*) FROM noor_students
    WHERE updated_at = '2026-11-09T20:04:42+00:00'
      AND name IN (?, ?, ?, ?, ?)
      AND grade IS NOT NULL AND grade != ''
    """,
    NAMES,
)
filled = c.fetchone()[0]
print("oct-now-nov with grade:", filled)

c.execute("SELECT COUNT(*) FROM noor_students WHERE grade IS NULL OR grade = ''")
empty = c.fetchone()[0]
print("empty grade before delete:", empty)

if filled != 5 or empty != 5:
    conn.rollback()
    conn.close()
    raise SystemExit("توقف: العدد بعد UPDATE لا يطابق 5+5. لا حذف.")

c.execute(
    """
    DELETE FROM noor_students
    WHERE updated_at = '2026-11-09T20:04:42+00:00'
      AND (grade IS NULL OR grade = '')
    """
)
print("deleted:", c.rowcount)
if c.rowcount != 5:
    conn.rollback()
    conn.close()
    raise SystemExit("توقف: الحذف لم يساوِ 5. تراجع.")

conn.commit()

c.execute("SELECT COUNT(*) FROM noor_students")
total = c.fetchone()[0]
c.execute("SELECT COUNT(*) FROM noor_students WHERE grade IS NULL OR grade = ''")
empty = c.fetchone()[0]
c.execute("SELECT COUNT(DISTINCT name) FROM noor_students")
names = c.fetchone()[0]
c.execute("SELECT COUNT(DISTINCT national_id) FROM noor_students")
ids = c.fetchone()[0]
print("\nCOUNT:", total)
print("empty grade:", empty)
print("distinct name:", names)
print("distinct national_id:", ids)
print("\nالخمسة بعد الدمج:")
c.execute(
    """
    SELECT national_id, name, grade, classroom, status, updated_at
    FROM noor_students
    WHERE name IN (?, ?, ?, ?, ?)
    ORDER BY name
    """,
    NAMES,
)
for row in c.fetchall():
    print(" ", row)

if total != 338 or empty != 0 or names != 338 or ids != 338:
    print("تحذير: العدد لا يطابق 338/0/338/338")
else:
    print("تحقق نهائي مطابق.")
conn.close()
