# -*- coding: utf-8 -*-
"""مرحلة 1أ: نوع national_id في StudentDataList — قراءة فقط."""
import sqlite3
from pathlib import Path

import openpyxl

ROOT = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059")
DB = ROOT / "School_Data" / "school_1059.db"
XLSX = ROOT / "School_Data" / "imports" / "students-StudentDataList.xlsx"
PENDING = ROOT / "School_Data" / "imports" / "_pending" / "f9665762432f4cc389cdd2ad898e6872.xlsx"

NAMES = {
    "بشير ماجد احمد ناجي",
    "عبدالرحمن حسين شوعي عيد",
    "عبدالعزيز عبدالغني يحي احمد",
    "عبدالعزيز علي احمد يحيى",
    "عبدالكريم صلاح محمد رماد",
}


def header(t):
    print("\n" + "=" * 70)
    print(t)
    print("=" * 70)


def inspect(path):
    print(f"\nfile: {path} exists={path.is_file()}")
    if not path.is_file():
        return
    wb = openpyxl.load_workbook(path, data_only=False)
    sh = wb.active
    print(f"sheet={sh.title} dims={sh.dimensions}")
    # header scan rows 1-20
    for r in range(1, 21):
        filled = []
        for c in range(1, 40):
            cell = sh.cell(r, c)
            if cell.value not in (None, ""):
                filled.append((c, cell.value, cell.data_type))
        if filled:
            print(f"  r{r}: {filled[:12]}")
    hits = 0
    for r in range(1, sh.max_row + 1):
        name_cell = None
        id_cell = None
        grade_cells = []
        for c in range(1, sh.max_column + 1):
            cell = sh.cell(r, c)
            val = cell.value
            if val in NAMES:
                name_cell = cell
            if isinstance(val, str) and val in (
                "07270835",
                "064544444",
                "00678634",
                "6877",
                "07938966",
                "0007270835",
                "0064544444",
                "0000678634",
                "0000006877",
                "0007938966",
            ):
                id_cell = cell
            if isinstance(val, (int, float)):
                as_int = int(val) if float(val).is_integer() else None
                if as_int in {7270835, 64544444, 678634, 6877, 7938966, 7270835}:
                    id_cell = cell
        if name_cell is None and id_cell is None:
            continue
        hits += 1
        print(f"\n  HIT row {r}")
        for c in range(1, min(sh.max_column, 40) + 1):
            cell = sh.cell(r, c)
            if cell.value in (None, ""):
                continue
            print(
                f"    col{c} value={cell.value!r} type={type(cell.value).__name__} "
                f"data_type={cell.data_type} num_fmt={cell.number_format}"
            )
    print(f"hits={hits}")
    wb.close()


header("PRAGMA table_info(noor_students)")
conn = sqlite3.connect(str(DB))
c = conn.cursor()
c.execute("PRAGMA table_info(noor_students)")
for row in c.fetchall():
    print(f"  cid={row[0]} name={row[1]} type={row[2]} notnull={row[3]} default={row[4]} pk={row[5]}")
conn.close()

header("StudentDataList (imports copy)")
inspect(XLSX)
header("StudentDataList (pending copy)")
inspect(PENDING)
print("\n✅ 1أ انتهى.")
