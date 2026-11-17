# -*- coding: utf-8 -*-
"""الخمسة بلا صف — قراءة فقط."""
import sqlite3
from pathlib import Path

DB = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059\School_Data\school_1059.db")
conn = sqlite3.connect(str(DB))
c = conn.cursor()
c.execute("""
    SELECT national_id, name, grade, classroom, status, updated_at
    FROM noor_students
    WHERE grade IS NULL OR grade = '' OR classroom IS NULL OR classroom = ''
    ORDER BY name
""")
print("بلا صف/فصل:")
for row in c.fetchall():
    print(" ", row)

c.execute("""
    SELECT name, COUNT(*) n
    FROM noor_students
    GROUP BY name
    HAVING n > 1
""")
print("\nأسماء مكررة:")
for row in c.fetchall():
    print(" ", row)
    c.execute("SELECT national_id, grade, classroom, status, updated_at FROM noor_students WHERE name=?", (row[0],))
    for r in c.fetchall():
        print("   ", r)
conn.close()
