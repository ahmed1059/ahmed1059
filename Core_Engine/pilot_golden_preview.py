# معاينة النماذج الثلاثة. لا يكتب في جداول الاختبارات أو التحليل أو الخطط.

from __future__ import annotations

import json
import re
import shutil
from datetime import datetime
from pathlib import Path

from .database import DB_PATH, connect
from .students_support_api import draw_pilot_support
from .teacher_record_tables import ensure_teacher_record_tables

ROOT = Path(__file__).resolve().parent.parent
PREVIEW = ROOT / "Print_Canvas" / "pilot-prep-preview.html"
OUT = ROOT / "backups" / "pilot-golden-dry-run.json"

MATRIX = {
    "رياضيات": ("الأعداد والعمليات", "الأعداد الصحيحة والعمليات عليها"),
    "لغتي": ("التراكيب والتعبير", "الجملة الاسمية"),
    "فيزياء": ("الفيزياء", "الحركة والقوى"),
}
TEACHERS = (
    ("حسن نافع مساعد الهرساني", "رياضيات"),
    ("خالد سعود مسعود الأحمدي", "لغتي"),
    ("ايمن سليم محمد البلادي", "فيزياء"),
)
EXCLUDED = (
    "إبراهيم سالم شذيان الحمدي",
    "احمد بن سعيد بن سلمي اللقماني العوفي",
    "عدنان صلاح بن عويد الحربي",
)
DISPLAY = {
    "رياضيات": "الرياضيات",
    "لغتي": "لغتي الخالدة",
    "عربي": "لغتي الخالدة",
    "فيزياء": "العلوم",
    "كيمياء": "العلوم",
    "أحياء": "العلوم",
    "علوم": "العلوم",
    "تاريخ": "الدراسات الاجتماعية",
    "جغرافيا": "الدراسات الاجتماعية",
    "حاسب": "المهارات الرقمية",
    "فنية": "التربية الفنية",
    "بدنية": "التربية البدنية",
    "دين": "الدراسات الإسلامية",
    "إنجليزي": "اللغة الإنجليزية",
    "انجليزي": "اللغة الإنجليزية",
}
SKILL = {
    "رياضيات": ("الأعداد والعمليات", "الأعداد الصحيحة والعمليات عليها"),
    "عربي": ("التراكيب والتعبير", "الجملة الاسمية"),
    "فيزياء": ("الفيزياء", "الحركة والقوى"),
    "أحياء": ("الأحياء", "الخلية ووظائفها"),
    "جغرافيا": ("الجغرافيا", "موقع وطني"),
    "دين": ("أركان الإيمان", "أنواع التوحيد"),
    "إنجليزي": ("التواصل الشفهي", "التحيات والتعارف"),
    "انجليزي": ("التواصل الشفهي", "التحيات والتعارف"),
    "فنية": ("التربية الفنية", "التشكيل البصري"),
    "بدنية": ("التربية البدنية", "التربية البدنية"),
    "حاسب": ("المهارات الرقمية", "المهارات الرقمية"),
}
NEARBY = (
    {"فيزياء", "كيمياء", "أحياء", "علوم"},
    {"تاريخ", "جغرافيا"},
)
EXAMS = (
    ("قبلي", "2026-09-09", "تشخيص بداية الوحدة قبل الشرح"),
    ("فترة_أولى", "2026-10-07", "قياس منتصف الوحدة بعد المهارات الأساسية"),
    ("بعدي", "2026-12-06", "قياس ختامي مخطط مع اختبارات الفصل، ولم يُعقد بعد"),
)


def _phrase(key: str, variables: dict) -> str:
    bank = {
        "plan.objective": "العنصر المراد تحسينه: {{title}}.",
        "plan.procedures": "تُنفَّذ الإجراءات التالية: {{procedures}}.",
        "plan.evidence": "الشواهد المطلوبة: {{evidence}}.",
        "report.closing": "وفي الختام نوصي بـ {{recommendation}}.",
    }
    text = bank[key]
    for name, value in variables.items():
        text = text.replace("{{" + name + "}}", str(value).strip().rstrip("."))
    return text.replace("..", ".").strip()


def _staff(connection, name: str):
    row = connection.execute(
        """
        SELECT national_id, name, role, COALESCE(specialty, '')
        FROM noor_staff
        WHERE name = ? AND COALESCE(is_deleted, 0) = 0
        """,
        (name,),
    ).fetchone()
    if not row:
        raise SystemExit("المعلم غير موجود في السجل: " + name)
    return {"id": row[0], "name": row[1], "role": row[2], "specialty": row[3]}


def _sections(connection, staff_id: str) -> list[dict]:
    rows = connection.execute(
        """
        SELECT grade, section, COUNT(*)
        FROM nafes_timetable
        WHERE staff_id = ? AND COALESCE(is_deleted, 0) = 0
        GROUP BY grade, section
        ORDER BY COUNT(*) DESC
        """,
        (staff_id,),
    ).fetchall()
    return [{"grade": row[0], "section": row[1], "lessons": row[2]} for row in rows]


def _grade_forms(grade: str) -> list[str]:
    forms = {str(grade or "").strip()}
    if grade.endswith(" متوسط"):
        forms.add(grade.replace(" متوسط", " المتوسط"))
    if grade.endswith(" المتوسط"):
        forms.add(grade.replace(" المتوسط", " متوسط"))
    return [item for item in forms if item]


def _class_size(connection, grade: str, section: str) -> int:
    forms = _grade_forms(grade)
    marks = ",".join("?" for _ in forms)
    row = connection.execute(
        f"""
        SELECT COUNT(*) FROM noor_students
        WHERE COALESCE(is_deleted, 0) = 0 AND classroom = ? AND grade IN ({marks})
        """,
        (section, *forms),
    ).fetchone()
    return int(row[0] or 0)


def _support(connection, grade: str, section: str, label: str) -> list[dict]:
    forms = _grade_forms(grade)
    marks = ",".join("?" for _ in forms)
    rows = connection.execute(
        f"""
        SELECT national_id, student_name, grade, section
        FROM students_support
        WHERE source LIKE 'pilot-1448%' AND support_type = ? AND section = ? AND grade IN ({marks})
        ORDER BY student_name
        """,
        (label, section, *forms),
    ).fetchall()
    return [{"id": row[0], "name": row[1], "grade": row[2], "section": row[3]} for row in rows]


def _deliverables(connection, staff_id: str) -> list[dict]:
    rows = connection.execute(
        """
        SELECT deliverable_type, subject, original_name, upload_date
        FROM teacher_deliverables
        WHERE teacher_id = ?
        """,
        (staff_id,),
    ).fetchall()
    return [
        {"type": row[0], "subject": row[1], "file": row[2], "date": row[3]}
        for row in rows
    ]


def _clean_name(name: str) -> str:
    return re.sub(r"\s{2,}", " ", re.sub(r"\s*-\s*", " ", str(name or ""))).strip()


def _official(subject: str) -> str:
    return DISPLAY.get(subject, subject)


def _peer(connection, teacher: dict) -> dict:
    rows = connection.execute(
        """
        SELECT s.name, COALESCE(s.specialty, ''),
               (SELECT COUNT(*) FROM nafes_timetable n
                WHERE n.staff_id = s.national_id AND COALESCE(n.is_deleted, 0) = 0)
        FROM noor_staff s
        WHERE COALESCE(s.is_deleted, 0) = 0
          AND s.role LIKE 'معلم%'
          AND s.national_id != ?
        ORDER BY s.name
        """,
        (teacher["id"],),
    ).fetchall()
    people = [
        {"name": row[0], "specialty": row[1]}
        for row in rows
        if int(row[2] or 0) > 0 and row[0] not in EXCLUDED and "هيازع الشهري" not in str(row[0])
    ]
    specialty = str(teacher.get("specialty") or "")
    same = [item for item in people if item["specialty"] == specialty]
    family = next((group for group in NEARBY if specialty in group), set())
    close = [item for item in people if item["specialty"] in family] if not same else []
    if specialty == "بدنية":
        close = [item for item in people if item["specialty"] in {"فيزياء", "أحياء", "كيمياء", "علوم"}]
    chosen = (same or close or people)[0]
    return chosen


def build_files(connection) -> list[dict]:
    files = []
    for name, subject in TEACHERS:
        teacher = _staff(connection, name)
        sections = _sections(connection, teacher["id"])
        if not sections:
            raise SystemExit("لا شعب في نافس لـ " + name)
        primary = sections[0]
        grade, section = primary["grade"], primary["section"]
        lessons = sum(item["lessons"] for item in sections)
        domain, unit = MATRIX[subject]
        official = _official(subject)
        size = _class_size(connection, grade, section)
        saved = _deliverables(connection, teacher["id"])
        plan = next((item for item in saved if item["type"] == "plan"), None)
        prep = next((item for item in saved if item["type"] == "prep"), None)
        gifted = []
        struggling = []
        for item in sections:
            gifted.extend(_support(connection, item["grade"], item["section"], "موهوب"))
            struggling.extend(_support(connection, item["grade"], item["section"], "متدن"))
        gifted = gifted[:3]
        struggling = struggling[:5]
        taught = "، ".join(
            f"{item['grade']}/{item['section']} ({item['lessons']} حصص)"
            for item in sections
            if item["grade"] and item["section"]
        )
        blank = sum(item["lessons"] for item in sections if not item["grade"] or not item["section"])
        if blank:
            taught += f"، وحصة بلا صف محفوظ ({blank})"
        distribution = (
            f"الملف المحفوظ: {plan['file']} بتاريخ {plan['date']}."
            if plan
            else f"وحدة «{unit}» من مجال «{domain}» في {official}، على الشعب: {taught}."
        )
        preparation = (
            f"الملف المحفوظ: {prep['file']} بتاريخ {prep['date']}."
            if prep
            else "\n".join(
                [
                    f"تحضير الأسبوع 6 أكتوبر 2026، {official}، {grade}/{section}.",
                    f"1. التهيئة والتمهيد باستدعاء الخبرات السابقة وربطها بمفهوم ({unit}).",
                    "2. العرض التدريسي التفاعلي وتوضيح المفاهيم الأساسية مع نمذجة الأمثلة.",
                    "3. التطبيق المتدرج (فردي وتعاوني) لمراعاة الفروق الفردية.",
                    "4. التقويم البنائي والغلق الختامي للتحقق من إتقان الهدف.",
                ]
            )
        )
        exams = []
        for kind, day, purpose in EXAMS:
            exams.append(
                {
                    "exam_type": kind,
                    "exam_date": day,
                    "subject": official,
                    "grade": grade,
                    "section": section,
                    "total_students": size,
                    "passed": None,
                    "avg_score": None,
                    "notes": purpose + " عدد طلاب الفصل من السجل " + str(size) + ". الدرجات تُرصد بعد التصحيح.",
                    "source": "pilot-1448-exam",
                }
            )
        analysis = {
            "subject": official,
            "grade": grade,
            "section": section,
            "period": "الفترة حتى 12 نوفمبر 2026",
            "pass_rate": None,
            "avg_score": None,
            "strengths": f"انتظام سير الخطة الدراسية في وحدة ({unit})، وتفاعل الطلاب مع التطبيقات الصفية وأدوات التقويم المستمر خلال الفترة الأولى.",
            "weaknesses": f"تكثيف التدريبات الموجهة للطلاب المشمولين بالخطة العلاجية في مهارات ({unit})، واستكمال قياس الأثر التراكمي بعد عقد الاختبار البعدي المجدول بتاريخ 6 ديسمبر 2026م.",
            "recommendations": f"تكثيف التدريبات الموجهة للطلاب المشمولين بالخطة العلاجية في مهارات ({unit})، واستكمال قياس الأثر التراكمي بعد عقد الاختبار البعدي المجدول بتاريخ 6 ديسمبر 2026م.",
            "analysis_date": "2026-11-12",
            "source": "pilot-1448-analysis",
        }
        remedial = [
            {
                "student": _clean_name(item["name"]),
                "skill": unit,
                "plan": f"عقد جلسات دعم مركزة ومجدولة زمنياً باستخدام النمذجة المبسطة وأوراق العمل التدريبية المتدرجة في مهارة ({unit})، مع متابعة التقدم حتى 2 ديسمبر 2026م.",
                "follow_up_date": "2026-12-02",
                "status": "قيد التنفيذ",
                "source": "pilot-1448-remedial",
            }
            for item in struggling[:5]
        ]
        enrichment = [
            {
                "student": _clean_name(item["name"]),
                "program": "رعاية الموهوبين والمبتكرين",
                "activity": f"تكليف الطلاب المتميزين بمهام بحثية وتطبيقات تفكير عليا في وحدة ({unit}) وعرض نواتج تعلمهم أمام زملائهم لتعزيز القيادة الطلابية.",
                "follow_up_date": "2026-12-02",
                "status": "قيد التنفيذ",
                "source": "pilot-1448-enrichment",
            }
            for item in gifted[:3]
        ]
        peer = _peer(connection, teacher)
        specialty = str(teacher.get("specialty") or "")
        family = next((group for group in NEARBY if specialty in group), set())
        same_field = peer["specialty"] == specialty or (family and peer["specialty"] in family)
        topic = unit if same_field else "استراتيجيات إدارة الصف والتحفيز"
        visits = []
        if "حسن نافع" in teacher["name"]:
            visits.append(
                "الزيارة الإشرافية: حصة واحدة ضمن زيارات الوكيل الأربع، ورُصد فيها تطبيق جزئي للتقويم البنائي يوم 14 أكتوبر 2026م، مع زيارة متابعة بعد إجازة الخريف."
            )
        visits.append(
            f"تبادل الزيارات: زار {teacher['name']} زميله {peer['name']} يوم الأربعاء 21 أكتوبر 2026م في {official}، وتناولا {topic}."
        )
        files.append(
            {
                "teacher": teacher["name"],
                "national_id": teacher["id"],
                "subject": official,
                "specialty": teacher["specialty"],
                "lessons": lessons,
                "sections": sections,
                "primary_section": primary,
                "distribution": distribution,
                "preparation": preparation,
                "exams": exams,
                "analysis": analysis,
                "remedial": remedial,
                "enrichment": enrichment,
                "visits": visits,
            }
        )
    return files


def _preview(packet: dict) -> None:
    parts = ["<h2>التحضير الأسبوعي</h2>"]
    parts.extend(f"<p>{line}</p>" for line in str(packet["preparation"]).split("\n") if line.strip())
    analysis = packet["analysis"]
    parts.append("<h2>تحليل النتائج</h2>")
    parts.append("<p><strong>مؤشرات القوة:</strong> " + analysis["strengths"] + "</p>")
    parts.append("<p><strong>جوانب التحسين والتوصية:</strong> " + analysis["recommendations"] + "</p>")
    parts.append("<h2>الخطة العلاجية</h2>")
    if packet["remedial"]:
        parts.append("<p>" + packet["remedial"][0]["plan"] + "</p>")
        parts.append("<p>الطلاب: " + "، ".join(item["student"] for item in packet["remedial"]) + ".</p>")
    parts.append("<h2>الخطة الإثرائية</h2>")
    if packet["enrichment"]:
        parts.append("<p>" + packet["enrichment"][0]["activity"] + "</p>")
        parts.append("<p>الطلاب: " + "، ".join(item["student"] for item in packet["enrichment"]) + ".</p>")
    parts.append("<h2>تبادل الزيارات</h2>")
    parts.extend(f"<p>{line}</p>" for line in packet["visits"])
    body = "".join(parts)
    html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>معاينة التحضير</title>
  <link rel="stylesheet" href="/css/fonts.css?v=font1">
  <link rel="stylesheet" href="/css/media-governance.css?v=aj146">
  <style>body {{ margin: 16px; background: #e7e5e4; }} p {{ line-height: 1.8; }}</style>
</head>
<body>
  <div id="official-frame-host"></div>
  <script src="/js/official-frame-core.js"></script>
  <script>
    document.getElementById("official-frame-host").innerHTML = OfficialFrameCore.page({{
      strictIdentity: true,
      title: {json.dumps("ملف المعلم — " + packet["teacher"] + " — " + packet["subject"], ensure_ascii=False)},
      bodyHtml: {json.dumps("<div>" + body + "</div>", ensure_ascii=False)},
      signoff: true,
      page: 1,
      total: 1
    }});
  </script>
</body>
</html>
"""
    PREVIEW.write_text(html, encoding="utf-8")


def write_files() -> None:
    connection = connect()
    try:
        files = build_files(connection)
        seating = json.loads(OUT.read_text(encoding="utf-8")).get("seating")
        tables = json.loads(OUT.read_text(encoding="utf-8")).get("tables")
    finally:
        connection.close()
    _preview(files[1])
    OUT.write_text(
        json.dumps(
            {"seating": seating, "tables": tables, "excluded": list(EXCLUDED), "files": files},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def main() -> None:
    moment = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = ROOT / "backups" / f"phase2-before-{moment}"
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(DB_PATH, backup / "school_1059.db")
    connection = connect()
    try:
        ensure_teacher_record_tables(connection)
        report = draw_pilot_support(connection)
        connection.commit()
        tables = {}
        for name in ("teacher_exams", "teacher_analysis", "teacher_remedial", "teacher_enrichment"):
            tables[name] = connection.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
            indexes = connection.execute(f"PRAGMA index_list({name})").fetchall()
            tables[name + "_indexes"] = [row[1] for row in indexes]
        files = build_files(connection)
        students = connection.execute(
            "SELECT COUNT(*) FROM noor_students WHERE COALESCE(is_deleted,0)=0"
        ).fetchone()[0]
    finally:
        connection.close()
    _preview(files[1])
    OUT.write_text(
        json.dumps({"seating": report, "tables": tables, "students": students, "excluded": list(EXCLUDED), "files": files}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("backup", backup)
    print("tables", tables)
    print("seating", report["gifted"], report["struggling"], report["unseated"], "/", report["students"])
    for row in report["classes"]:
        print(row["grade"], row["section"], row["struggling"], "/", row["size"])
    print("preview", PREVIEW)
    print("dry", OUT)


def _practicing(connection) -> list[dict]:
    rows = connection.execute(
        """
        SELECT national_id, name, role, COALESCE(specialty, '')
        FROM noor_staff
        WHERE COALESCE(is_deleted, 0) = 0 AND role LIKE 'معلم%'
        ORDER BY name
        """
    ).fetchall()
    people = []
    for row in rows:
        teacher = {"id": row[0], "name": row[1], "role": row[2], "specialty": row[3]}
        sections = [item for item in _sections(connection, teacher["id"]) if item["grade"] and item["section"]]
        lessons = sum(item["lessons"] for item in _sections(connection, teacher["id"]))
        if lessons <= 0 or teacher["name"] in EXCLUDED:
            continue
        teacher["sections"] = sections
        teacher["lessons"] = lessons
        teacher["primary"] = sections[0]
        people.append(teacher)
    return people


def _collect(connection, teacher: dict, label: str) -> list[dict]:
    found = []
    seen = set()
    for item in teacher["sections"]:
        for student in _support(connection, item["grade"], item["section"], label):
            if student["id"] in seen:
                continue
            seen.add(student["id"])
            found.append(student)
    found.sort(key=lambda item: item["name"])
    return found


def _packet(connection, teacher: dict) -> dict:
    skill = SKILL.get(teacher["specialty"])
    if not skill:
        raise SystemExit("لا وحدة محفوظة للتخصص: " + teacher["specialty"] + " / " + teacher["name"])
    domain, unit = skill
    official = _official(teacher["specialty"])
    primary = teacher["primary"]
    grade, section = primary["grade"], primary["section"]
    size = _class_size(connection, grade, section)
    taught = "، ".join(
        f"{item['grade']}/{item['section']} ({item['lessons']} حصص)" for item in teacher["sections"]
    )
    struggling = _collect(connection, teacher, "متدن")
    gifted = _collect(connection, teacher, "موهوب")
    peer = _peer(connection, teacher)
    specialty = teacher["specialty"]
    family = next((group for group in NEARBY if specialty in group), set())
    same_field = peer["specialty"] == specialty or bool(family and peer["specialty"] in family)
    topic = unit if same_field else "استراتيجيات إدارة الصف والتحفيز"
    visits = []
    if "حسن نافع" in teacher["name"]:
        visits.append(
            "الزيارة الإشرافية: حصة واحدة ضمن زيارات الوكيل الأربع، ورُصد فيها تطبيق جزئي للتقويم البنائي يوم 14 أكتوبر 2026م، مع زيارة متابعة بعد إجازة الخريف."
        )
    visits.append(
        f"تبادل الزيارات: زار {teacher['name']} زميله {peer['name']} يوم الأربعاء 21 أكتوبر 2026م في {official}، وتناولا {topic}."
    )
    return {
        "teacher": teacher,
        "official": official,
        "domain": domain,
        "unit": unit,
        "grade": grade,
        "section": section,
        "size": size,
        "distribution": f"وحدة «{unit}» من مجال «{domain}» في {official}، على الشعب: {taught}.",
        "preparation": "\n".join(
            [
                f"تحضير الأسبوع 6 أكتوبر 2026، {official}، {grade}/{section}.",
                f"1. التهيئة والتمهيد باستدعاء الخبرات السابقة وربطها بمفهوم ({unit}).",
                "2. العرض التدريسي التفاعلي وتوضيح المفاهيم الأساسية مع نمذجة الأمثلة.",
                "3. التطبيق المتدرج (فردي وتعاوني) لمراعاة الفروق الفردية.",
                "4. التقويم البنائي والغلق الختامي للتحقق من إتقان الهدف.",
            ]
        ),
        "struggling": struggling[:5],
        "gifted": gifted[:3],
        "struggling_available": len(struggling),
        "gifted_available": len(gifted),
        "visits": visits,
        "peer": peer["name"],
        "topic": topic,
    }


def apply_records() -> None:
    connection = connect()
    try:
        ensure_teacher_record_tables(connection)
        packets = [_packet(connection, teacher) for teacher in _practicing(connection)]
        problems = []
        if len(packets) != 28:
            problems.append(f"المعلمون الممارسون {len(packets)} وليس 28")
        for packet in packets:
            if packet["size"] <= 0:
                problems.append(packet["teacher"]["name"] + ": عدد الفصل صفر")
            if not (3 <= packet["struggling_available"] and packet["struggling"]):
                problems.append(
                    packet["teacher"]["name"] + f": المتدنون في شعبه {packet['struggling_available']}"
                )
            if packet["gifted_available"] < 2:
                problems.append(
                    packet["teacher"]["name"] + f": الموهوبون في شعبه {packet['gifted_available']}"
                )
        if problems:
            print("STOP")
            for line in problems:
                print(line)
            raise SystemExit(2)
        moment = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = ROOT / "backups" / f"phase-apply-before-{moment}.db"
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DB_PATH, backup)
        stamp = datetime.now().replace(microsecond=0).isoformat(sep=" ")
        for table in ("teacher_exams", "teacher_analysis", "teacher_remedial", "teacher_enrichment", "teacher_documents"):
            connection.execute(f"DELETE FROM {table} WHERE source LIKE 'pilot-1448%'")
        for packet in packets:
            teacher = packet["teacher"]
            for kind, day, purpose in EXAMS:
                connection.execute(
                    """
                    INSERT INTO teacher_exams (
                        national_id, subject, grade, section, exam_type, exam_date,
                        total_students, passed, avg_score, notes, source
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'pilot-1448-exam')
                    """,
                    (
                        teacher["id"], packet["official"], packet["grade"], packet["section"],
                        kind, day, packet["size"],
                        purpose + " عدد طلاب الفصل من السجل " + str(packet["size"]) + ". الدرجات تُرصد بعد التصحيح.",
                    ),
                )
            connection.execute(
                """
                INSERT INTO teacher_analysis (
                    national_id, subject, grade, section, period, pass_rate, avg_score,
                    strengths, weaknesses, recommendations, analysis_date, source
                ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, '2026-11-12', 'pilot-1448-analysis')
                """,
                (
                    teacher["id"], packet["official"], packet["grade"], packet["section"],
                    "الفترة حتى 12 نوفمبر 2026",
                    f"انتظام سير الخطة الدراسية في وحدة ({packet['unit']})، وتفاعل الطلاب مع التطبيقات الصفية وأدوات التقويم المستمر خلال الفترة الأولى.",
                    f"تكثيف التدريبات الموجهة للطلاب المشمولين بالخطة العلاجية في مهارات ({packet['unit']})، واستكمال قياس الأثر التراكمي بعد عقد الاختبار البعدي المجدول بتاريخ 6 ديسمبر 2026م.",
                    f"تكثيف التدريبات الموجهة للطلاب المشمولين بالخطة العلاجية في مهارات ({packet['unit']})، واستكمال قياس الأثر التراكمي بعد عقد الاختبار البعدي المجدول بتاريخ 6 ديسمبر 2026م.",
                ),
            )
            plan = f"عقد جلسات دعم مركزة ومجدولة زمنياً باستخدام النمذجة المبسطة وأوراق العمل التدريبية المتدرجة في مهارة ({packet['unit']})، مع متابعة التقدم حتى 2 ديسمبر 2026م."
            for student in packet["struggling"]:
                connection.execute(
                    """
                    INSERT INTO teacher_remedial (
                        national_id, subject, student_id, skill, plan, follow_up_date, status, source
                    ) VALUES (?, ?, ?, ?, ?, '2026-12-02', 'قيد التنفيذ', 'pilot-1448-remedial')
                    """,
                    (teacher["id"], packet["official"], student["id"], packet["unit"], plan),
                )
            activity = f"تكليف الطلاب المتميزين بمهام بحثية وتطبيقات تفكير عليا في وحدة ({packet['unit']}) وعرض نواتج تعلمهم أمام زملائهم لتعزيز القيادة الطلابية."
            for student in packet["gifted"]:
                connection.execute(
                    """
                    INSERT INTO teacher_enrichment (
                        national_id, subject, student_id, program, activity, follow_up_date, status, source
                    ) VALUES (?, ?, ?, 'رعاية الموهوبين والمبتكرين', ?, '2026-12-02', 'قيد التنفيذ', 'pilot-1448-enrichment')
                    """,
                    (teacher["id"], packet["official"], student["id"], activity),
                )
            docs = (
                ("curriculum", "الفصل الأول 1448", {"text": packet["distribution"]}),
                ("prep", "أسبوع 6 أكتوبر 2026", {"text": packet["preparation"]}),
                ("visits", "2026-10-21", {"text": "\n".join(packet["visits"]), "host": packet["peer"], "topic": packet["topic"]}),
            )
            for doc_type, period, content in docs:
                connection.execute(
                    """
                    INSERT INTO teacher_documents (
                        national_id, doc_type, subject, grade, section, period,
                        content_json, created_at, updated_at, source
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        teacher["id"], doc_type, packet["official"], packet["grade"], packet["section"], period,
                        json.dumps(content, ensure_ascii=False), stamp, stamp, "pilot-1448-" + doc_type,
                    ),
                )
        connection.commit()
        print("backup", backup)
        print("teachers", len(packets))
        for table in ("teacher_exams", "teacher_analysis", "teacher_remedial", "teacher_enrichment"):
            print(table, connection.execute(f"SELECT COUNT(*) FROM {table} WHERE source LIKE 'pilot-1448%'").fetchone()[0])
        for kind in ("curriculum", "prep", "visits"):
            print(
                "documents", kind,
                connection.execute(
                    "SELECT COUNT(*) FROM teacher_documents WHERE doc_type = ? AND source LIKE 'pilot-1448%'",
                    (kind,),
                ).fetchone()[0],
            )
        print(
            "truth",
            connection.execute("SELECT COUNT(*) FROM noor_students WHERE COALESCE(is_deleted,0)=0").fetchone()[0],
            connection.execute("SELECT COUNT(*) FROM noor_staff WHERE COALESCE(is_deleted,0)=0").fetchone()[0],
            connection.execute("SELECT COUNT(*) FROM nafes_timetable WHERE COALESCE(is_deleted,0)=0").fetchone()[0],
        )
    except SystemExit:
        connection.rollback()
        raise
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    import sys

    if "--apply" in sys.argv:
        apply_records()
    elif "--files-only" in sys.argv:
        write_files()
    else:
        main()
