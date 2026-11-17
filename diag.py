# -*- coding: utf-8 -*-
"""تشخيص nafes_timetable — للقراءة فقط."""
import sqlite3
from pathlib import Path

DB = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059\School_Data\school_1059.db")
conn = sqlite3.connect(str(DB))
c = conn.cursor()

def header(t):
    print("\n" + "=" * 70)
    print(t)
    print("=" * 70)

# ═══════════════════════════════════════════════════════════
header("1) الثلاثة OPEN: من يملك staff_id حالياً؟")
c.execute("""
    SELECT teacher, staff_id, COUNT(*) as n
    FROM nafes_timetable
    WHERE teacher IN ('عبدالمحسن الحربي', 'محمد الصاعدي', 'احمد العوفي')
    GROUP BY teacher, staff_id
""")
rows = c.fetchall()
if not rows:
    print("⚠️ لا صفوف للثلاثة OPEN في nafes_timetable")
for t, sid, n in rows:
    sid_str = "(NULL)" if sid is None else str(sid)
    print(f"  {t:30s} | staff_id={sid_str:15s} | حصص={n}")

# ═══════════════════════════════════════════════════════════
header("2) الصفوف المكررة (540→438): هل الدمج صحيح؟")
c.execute("""
    SELECT teacher, day, period,
           COUNT(*) as n,
           COUNT(DISTINCT classroom) as cls_diff,
           COUNT(DISTINCT subject) as subj_diff,
           COUNT(DISTINCT grade) as grade_diff
    FROM nafes_timetable
    GROUP BY teacher, day, period
    HAVING n > 1
    ORDER BY n DESC
    LIMIT 20
""")
rows = c.fetchall()
if not rows:
    print("لا صفوف مكررة (الفهرس يمنع التكرار أصلاً)")
else:
    print(f"عدد المجموعات المكررة: {len(rows)}+")
    print(f"{'teacher':30s} day p  n   cls subj grade")
    for t, d, p, n, cls, subj, grade in rows:
        flag = "✅" if (cls == 1 and subj == 1 and grade == 1) else "🔴"
        print(f"{t:30s} {d}  {p}  {n}   {cls}   {subj}    {grade}   {flag}")

# إجمالي عدد الصفوف المكررة
c.execute("""
    SELECT COUNT(*) FROM (
        SELECT teacher, day, period
        FROM nafes_timetable
        GROUP BY teacher, day, period
        HAVING COUNT(*) > 1
    )
""")
print(f"\nإجمالي المجموعات المكررة: {c.fetchone()[0]}")

# ═══════════════════════════════════════════════════════════
header("3) توزيع كل teacher على staff_id")
c.execute("""
    SELECT teacher, staff_id, COUNT(*) as n
    FROM nafes_timetable
    GROUP BY teacher, staff_id
    ORDER BY teacher
""")
rows = c.fetchall()
print(f"{'teacher':30s} {'staff_id':15s} حصص")
print("-" * 60)
for t, sid, n in rows:
    sid_str = "(NULL)" if sid is None else str(sid)
    print(f"{t:30s} {sid_str:15s} {n}")

# ═══════════════════════════════════════════════════════════
header("4) للثلاثة OPEN: مرشحو noor_staff بالتخصص")
c.execute("""
    SELECT national_id, name, specialty, role
    FROM noor_staff
    WHERE name LIKE '%الصاعدي%'
       OR name LIKE '%العوفي%'
       OR name LIKE '%العلوي%'
       OR name LIKE '%الحربي%'
    ORDER BY name
""")
print(f"{'national_id':12s} {'name':45s} {'specialty':20s} role")
print("-" * 100)
for nid, name, spec, role in c.fetchall():
    print(f"{nid:12s} {name:45s} {str(spec or ''):20s} {role or ''}")

# ═══════════════════════════════════════════════════════════
header("5) إجماليات noor_staff")
c.execute("SELECT COUNT(*) FROM noor_staff")
print(f"إجمالي noor_staff: {c.fetchone()[0]}")
c.execute("SELECT role, COUNT(*) FROM noor_staff GROUP BY role ORDER BY COUNT(*) DESC")
print("\nالتوزيع حسب الصفة:")
for role, n in c.fetchall():
    print(f"  {str(role or '(بلا صفة)'):25s} {n}")

conn.close()
print("\n✅ انتهى التشخيص.")
