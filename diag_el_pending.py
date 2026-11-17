# -*- coding: utf-8 -*-
"""معاينات EL في _pending — قراءة ملفات فقط."""
import json
from pathlib import Path

PENDING = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059\School_Data\imports\_pending")
for path in sorted(PENDING.glob("*.json")):
    data = json.loads(path.read_text(encoding="utf-8"))
    name = str(data.get("filename") or "")
    if "EL" not in name and "Student" not in name and "student" not in name.lower():
        continue
    parsed = data.get("parsed") or {}
    recs = parsed.get("records") or []
    with_id = sum(1 for r in recs if str(r.get("national_id") or "").strip())
    with_grade = sum(1 for r in recs if str(r.get("grade") or "").strip())
    print("-" * 60)
    print("file:", name)
    print("token:", data.get("token"))
    print("kind:", data.get("kind"))
    print("read:", parsed.get("read"), "records:", len(recs), "skipped:", parsed.get("skipped"))
    print("with national_id:", with_id, "with grade:", with_grade)
    print("warnings:", parsed.get("warnings"))
    print("missing:", parsed.get("missing"))
    classes = parsed.get("classes") or parsed.get("groups") or []
    if classes:
        print("classes/groups:", len(classes))
