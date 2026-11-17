# -*- coding: utf-8 -*-
"""D5/D12 واسم الطالب في صفوف EL الخمسة — قراءة فقط."""
from pathlib import Path
import openpyxl

xlsx = Path(
    r"C:\Users\Toshiba\Desktop\School_Governance_System_1059\School_Data\imports\_pending\0775081d236d43549c01db8205d9ff49.xlsx"
)
wb = openpyxl.load_workbook(xlsx, data_only=True)
targets = {
    "Sheet3": 28,
    "Sheet5": 38,
    "Sheet7": 42,
    "Sheet8": 25,
    "Sheet15": 32,
}
for name, row_n in targets.items():
    sh = wb[name]
    d5 = sh["D5"].value
    e5 = sh["E5"].value
    d12 = sh["D12"].value
    e12 = sh["E12"].value
    l12 = sh["L12"].value
    print(f"\n{name} D5={d5!r} E5={e5!r} D12={d12!r} E12={e12!r} L12={l12!r}")
    for col in range(1, 40):
        val = sh.cell(12, col).value
        if val not in (None, ""):
            print(f"  row12 col{col}={val!r}")
    print(f"  hit row {row_n}:")
    for col in range(1, 40):
        val = sh.cell(row_n, col).value
        if val not in (None, ""):
            print(f"    col{col}={val!r}")
    print("  header row 20/21 sample:")
    for r in (19, 20, 21):
        filled = [(c, sh.cell(r, c).value) for c in range(1, 40) if sh.cell(r, c).value not in (None, "")]
        if filled:
            print(f"    r{r}: {filled[:15]}")
wb.close()
