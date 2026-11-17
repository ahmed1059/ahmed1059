# -*- coding: utf-8 -*-
"""إبراهيم + التحقق بعد المحوّل."""
import sqlite3
import sys
from pathlib import Path

ROOT = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059")
sys.path.insert(0, str(ROOT))

from Core_Engine.database import connect, ensure_noor_students_enrichment_columns
from Core_Engine.noor_import import apply_student_records, parse_students

SDL = ROOT / "School_Data" / "imports" / "students-StudentDataList.xlsx"
EL = ROOT / "School_Data" / "imports" / "students-EL_StudentInfoReport.xlsx"

conn = connect()
ensure_noor_students_enrichment_columns(conn)
conn.commit()

cur = conn.cursor()
cur.execute(
    """
    UPDATE noor_staff
    SET role = CASE WHEN role IS NULL OR trim(role) = '' THEN 'معلم' ELSE role END,
        notes = CASE
            WHEN notes IS NULL OR trim(notes) = '' THEN 'منقول من المدرسة'
            ELSE notes
        END,
        updated_at = datetime('now')
    WHERE national_id = '1065175380'
    """
)
print("ibrahim rowcount", cur.rowcount)
conn.commit()
cur.execute("SELECT national_id, name, role, notes FROM noor_staff WHERE national_id = '1065175380'")
print("ibrahim", cur.fetchone())

print("\n=== StudentDataList apply (dry write idempotent) ===")
parsed = parse_students(SDL)
print("records", len(parsed["records"]), "short_docs", parsed.get("short_docs"), "skipped", parsed.get("skipped"))
before = cur.execute("SELECT COUNT(*) FROM noor_students").fetchone()[0]
res = apply_student_records(conn, parsed["records"])
conn.commit()
after = cur.execute("SELECT COUNT(*) FROM noor_students").fetchone()[0]
print("apply", res["inserted"], "upd", res["updated"], "fail", len(res["failed"]), "unmatch", len(res["unmatched"]), "amb", len(res["ambiguous"]))
print("count before/after", before, after)
if res["unmatched"][:8]:
    print("unmatched sample", res["unmatched"][:8])
if res["ambiguous"][:5]:
    print("ambiguous sample", res["ambiguous"][:5])

print("\n=== EL apply ===")
el = parse_students(EL)
print("el records", len(el["records"]))
res2 = apply_student_records(conn, el["records"])
conn.commit()
print("apply", res2["inserted"], "upd", res2["updated"], "fail", len(res2["failed"]), "unmatch", len(res2["unmatched"]), "amb", len(res2["ambiguous"]))
print("count", cur.execute("SELECT COUNT(*) FROM noor_students").fetchone()[0])
print("empty grade", cur.execute("SELECT COUNT(*) FROM noor_students WHERE grade IS NULL OR grade=''").fetchone()[0])
print("enriched", cur.execute("SELECT COUNT(*) FROM noor_students WHERE enriched_at IS NOT NULL AND enriched_at!=''").fetchone()[0])
print("staff", cur.execute("SELECT COUNT(*) FROM noor_staff").fetchone()[0])
print("roles:")
for row in cur.execute("SELECT role, COUNT(*) FROM noor_staff GROUP BY role ORDER BY 2 DESC"):
    print(" ", row)
print("timetable", cur.execute("SELECT COUNT(*) FROM nafes_timetable").fetchone()[0])
print("linked", cur.execute("SELECT COUNT(*) FROM nafes_timetable WHERE staff_id IS NOT NULL AND trim(staff_id)!=''").fetchone()[0])
conn.close()
print("\n✅")
