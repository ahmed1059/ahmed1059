# -*- coding: utf-8 -*-
import sqlite3
from pathlib import Path

db = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059\School_Data\school_1059.db")
c = sqlite3.connect(str(db))
print("=== program visual_evidence ===")
for r in c.execute(
    "SELECT id, entity_type, entity_key, register_key, kind, name FROM visual_evidence "
    "WHERE entity_type='program' ORDER BY id"
):
    print(r)
print("=== grouped ===")
for r in c.execute(
    "SELECT entity_type, entity_key, COUNT(*) FROM visual_evidence GROUP BY 1, 2 ORDER BY 1, 2"
):
    print(r)
print("=== programs ===")
for r in c.execute("SELECT id, program_name FROM school_programs ORDER BY id"):
    print(r)
print("=== draft keys ===")
for r in c.execute(
    "SELECT id, entity_key, name FROM visual_evidence WHERE entity_key LIKE 'program-draft%' OR entity_key LIKE 'program-%'"
):
    print(r)
