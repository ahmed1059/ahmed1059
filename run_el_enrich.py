# -*- coding: utf-8 -*-
"""إثراء noor_students من EL — لا إدراج."""
import sqlite3
import sys
from pathlib import Path

ROOT = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059")
sys.path.insert(0, str(ROOT))

from Core_Engine.database import connect, ensure_noor_students_enrichment_columns
from Core_Engine.noor_import import enrich_students_from_el, parse_students

EL = ROOT / "School_Data" / "imports" / "students-EL_StudentInfoReport.xlsx"
SDL = ROOT / "School_Data" / "imports" / "students-StudentDataList.xlsx"

print("=== فحص القارئ على StudentDataList ===")
parsed = parse_students(SDL)
print("read", parsed.get("read"), "records", len(parsed.get("records") or []), "skipped", parsed.get("skipped"), "short_docs", parsed.get("short_docs"))
print("warnings:", parsed.get("warnings"))
short_left = [r for r in (parsed.get("records") or []) if len(str(r.get("national_id") or "")) < 10]
print("records with nid<10:", len(short_left))

print("\n=== إثراء EL ===")
conn = connect()
ensure_noor_students_enrichment_columns(conn)
report = enrich_students_from_el(EL, conn)
conn.commit()
print("sheets", report["sheets"], "read", report["read"], "records", report["records"])
print("matched", report["matched"])
print("ambiguous", len(report["ambiguous"]))
for item in report["ambiguous"][:20]:
    print("  amb:", item)
print("unmatched", len(report["unmatched"]))
for name in report["unmatched"][:30]:
    print("  miss:", name)
print("warnings:", report["warnings"])

c = conn.cursor()
c.execute("PRAGMA table_info(noor_students)")
print("\nschema:")
for row in c.fetchall():
    print(" ", row[1], row[2])
c.execute("SELECT COUNT(*) FROM noor_students")
print("COUNT", c.fetchone()[0])
c.execute("SELECT COUNT(*) FROM noor_students WHERE enriched_at IS NOT NULL AND enriched_at != ''")
print("enriched", c.fetchone()[0])
c.execute(
    """
    SELECT national_id, name, status, nationality, birth_date, el_grade, el_section
    FROM noor_students
    WHERE name IN (
      'بشير ماجد احمد ناجي',
      'عبدالرحمن حسين شوعي عيد',
      'عبدالعزيز عبدالغني يحي احمد',
      'عبدالعزيز علي احمد يحيى',
      'عبدالكريم صلاح محمد رماد'
    )
    ORDER BY name
    """
)
print("\nالخمسة:")
for row in c.fetchall():
    print(" ", row)
conn.close()
print("\n✅")
