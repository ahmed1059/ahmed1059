# -*- coding: utf-8 -*-
import sys
from pathlib import Path
ROOT = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059")
sys.path.insert(0, str(ROOT))
from Core_Engine.noor_import import parse_students
p = parse_students(ROOT / "School_Data" / "imports" / "students-StudentDataList.xlsx")
print("read", p["read"], "records", len(p["records"]), "skipped", p["skipped"], "short", p.get("short_docs"))
print("warnings", p["warnings"])
print("nid<10", sum(1 for r in p["records"] if r.get("national_id") and len(r["national_id"]) < 10))
print("empty nid", sum(1 for r in p["records"] if not r.get("national_id")))
