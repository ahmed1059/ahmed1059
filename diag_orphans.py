# -*- coding: utf-8 -*-
"""تشخيص اليتامى الخمسة — قراءة فقط."""
import json
import re
import sqlite3
from pathlib import Path

import openpyxl

ROOT = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059")
DB = ROOT / "School_Data" / "school_1059.db"
PENDING = ROOT / "School_Data" / "imports" / "_pending"
IMPORTS = ROOT / "School_Data" / "imports"

ORPHAN_IDS = ("07270835", "064544444", "00678634", "6877", "07938966")
ORPHAN_NAMES = (
    "بشير ماجد احمد ناجي",
    "عبدالرحمن حسين شوعي عيد",
    "عبدالعزيز عبدالغني يحي احمد",
    "عبدالعزيز علي احمد يحيى",
    "عبدالكريم صلاح محمد رماد",
)


def header(t):
    print("\n" + "=" * 70)
    print(t)
    print("=" * 70)


def fold(value):
    text = "" if value is None else str(value)
    text = re.sub(r"[\u064B-\u065F\u0670\u0640]", "", text)
    text = text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ى", "ي").replace("ة", "ه")
    return re.sub(r"\s+", " ", text).strip().lower()


FOLDED_NAMES = {fold(n): n for n in ORPHAN_NAMES}
ID_SET = set(ORPHAN_IDS)
ID_STRIP = {i.lstrip("0") or "0" for i in ORPHAN_IDS}


def cell_id_hit(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        text = str(int(value))
    else:
        text = str(value).strip()
        if text.endswith(".0") and text[:-2].isdigit():
            text = text[:-2]
    if text in ID_SET:
        return text
    stripped = text.lstrip("0") or "0"
    if text in ID_SET or stripped in ID_STRIP:
        return text
    return ""


def name_hit(value):
    key = fold(value)
    return FOLDED_NAMES.get(key, "")


conn = sqlite3.connect(str(DB))
c = conn.cursor()

header("1) خمسة 2026-10-24")
c.execute(
    """
    SELECT national_id, name, grade, classroom, status, updated_at
    FROM noor_students
    WHERE updated_at = '2026-10-24T17:30:00+00:00'
    ORDER BY name
    """
)
oct_rows = c.fetchall()
print("count:", len(oct_rows))
for row in oct_rows:
    filled = "مملوء" if (row[2] and row[3]) else "ناقص"
    print(f"  {row}  [{filled}]")

header("2) يتامى 2026-11-09 بلا grade")
c.execute(
    """
    SELECT national_id, name, grade, classroom, status, updated_at
    FROM noor_students
    WHERE updated_at = '2026-11-09T20:04:42+00:00'
      AND (grade IS NULL OR grade = '')
    ORDER BY name
    """
)
orphans = c.fetchall()
print("count:", len(orphans))
for row in orphans:
    print(" ", row)

header("3) students_support")
c.execute("PRAGMA table_info(students_support)")
print("columns:", [r[1] for r in c.fetchall()])
c.execute("SELECT COUNT(*) FROM students_support")
print("rows:", c.fetchone()[0])
c.execute("SELECT id, student_name, grade, section, category, status FROM students_support")
all_support = c.fetchall()
hits = []
for row in all_support:
    key = fold(row[1])
    if key in FOLDED_NAMES or any(fold(n) in key or key in fold(n) for n in ORPHAN_NAMES):
        hits.append(row)
print("matches:", len(hits))
for row in hits:
    print(" ", row)
if not hits:
    print("  لا صفوف مطابقة للأسماء الخمسة")

conn.close()

header("4) StudentDataList.xlsx")
sdl_paths = []
for path in PENDING.glob("*.json"):
    meta = json.loads(path.read_text(encoding="utf-8"))
    if "StudentDataList" in str(meta.get("filename") or ""):
        xlsx = PENDING / (path.stem + ".xlsx")
        if xlsx.is_file():
            sdl_paths.append((meta.get("filename"), xlsx))
for path in IMPORTS.glob("*.xlsx"):
    if "student" in path.name.lower() or "Student" in path.name:
        sdl_paths.append((path.name, path))

seen_sdl = set()
for label, xlsx in sdl_paths:
    if xlsx in seen_sdl:
        continue
    seen_sdl.add(xlsx)
    print(f"\n-- {label} | {xlsx}")
    wb = openpyxl.load_workbook(xlsx, data_only=True, read_only=True)
    print("sheets:", wb.sheetnames)
    for sheet in wb.worksheets:
        print(f"  sheet={sheet.title}")
        header_row = None
        found = 0
        for i, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            if i <= 25 and header_row is None:
                cells = [str(x or "") for x in row]
                joined = " ".join(cells)
                if "هوية" in joined or "اسم" in joined or "الصف" in joined:
                    print(f"    row {i} headers: {cells[:20]}")
            id_hit = ""
            nm_hit = ""
            for cell in row or ():
                if not id_hit:
                    id_hit = cell_id_hit(cell)
                if not nm_hit:
                    nm_hit = name_hit(cell)
            if id_hit or nm_hit:
                found += 1
                print(f"    HIT row {i} id={id_hit or '-'} name={nm_hit or '-'} cells={list(row)[:18]}")
        print(f"    hits_in_sheet={found}")
    wb.close()

header("5) EL_StudentInfoReport.xlsx")
el_paths = []
for path in PENDING.glob("*.json"):
    meta = json.loads(path.read_text(encoding="utf-8"))
    if "EL_Student" in str(meta.get("filename") or ""):
        xlsx = PENDING / (path.stem + ".xlsx")
        if xlsx.is_file():
            el_paths.append((meta.get("filename"), meta.get("kind"), xlsx))
            break

seen_el = set()
for label, kind, xlsx in el_paths:
    if xlsx in seen_el:
        continue
    seen_el.add(xlsx)
    print(f"\n-- {label} kind={kind} | {xlsx}")
    wb = openpyxl.load_workbook(xlsx, data_only=True, read_only=True)
    print("sheet_count:", len(wb.sheetnames))
    total_hits = 0
    for sheet in wb.worksheets:
        banner = []
        hits_here = []
        for i, row in enumerate(sheet.iter_rows(max_row=20, values_only=True), start=1):
            if i <= 15:
                banner.append((i, list(row)[:8] if row else []))
        for i, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            id_hit = ""
            nm_hit = ""
            for cell in row or ():
                if not id_hit:
                    id_hit = cell_id_hit(cell)
                if not nm_hit:
                    nm_hit = name_hit(cell)
            if id_hit or nm_hit:
                hits_here.append((i, id_hit, nm_hit, list(row)[:12]))
        if hits_here:
            total_hits += len(hits_here)
            print(f"  sheet={sheet.title} hits={len(hits_here)}")
            print(f"    banner_sample={banner[:12]}")
            for item in hits_here:
                print(f"    HIT row {item[0]} id={item[1] or '-'} name={item[2] or '-'} cells={item[3]}")
    print("total_name_or_id_hits:", total_hits)
    wb.close()

print("\n✅ انتهى التشخيص.")
