# -*- coding: utf-8 -*-
"""يحول ورقة طلاب نور إلى students_registry.json."""
import json
import sys
from pathlib import Path

import xlrd

ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = [
    ROOT / "Core_Engine" / "database" / "students_registry.json",
    ROOT / "Print_Canvas" / "banks" / "students_registry.json",
]
GRADES = {
    "0725": "الأول متوسط",
    "725": "الأول متوسط",
    "0825": "الثاني متوسط",
    "825": "الثاني متوسط",
    "0925": "الثالث متوسط",
    "925": "الثالث متوسط",
}


def cell_text(cell):
    if cell.ctype == xlrd.XL_CELL_NUMBER and cell.value == int(cell.value):
        return str(int(cell.value))
    return " ".join(str(cell.value or "").split())


def import_workbook(path):
    book = xlrd.open_workbook(str(path))
    sheet = book.sheet_by_name("Sheet2")
    students = []
    for index in range(sheet.nrows):
        nid = cell_text(sheet.cell(index, 5))
        name = cell_text(sheet.cell(index, 4))
        grade_code = cell_text(sheet.cell(index, 3))
        if grade_code not in GRADES or not name or not nid:
            continue
        students.append({
            "student_nid": nid,
            "student_name": name,
            "grade": GRADES[grade_code],
            "section": cell_text(sheet.cell(index, 2)),
            "guardian_phone": cell_text(sheet.cell(index, 1)),
        })
    return students


def main():
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Users\Toshiba\Desktop\StudentGuidance (1).xls")
    students = import_workbook(source)
    payload = json.dumps({"students": students}, ensure_ascii=False, indent=2)
    for output in OUTPUTS:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(payload + "\n", encoding="utf-8")
    print(len(students))


if __name__ == "__main__":
    main()
