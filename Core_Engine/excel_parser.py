# قارئ ملف نور وملف شواهد الاعتماد — openpyxl فقط، ولا يُنفَّذ شيء عند الاستيراد

import re
from pathlib import Path

import openpyxl

# ترتيب الأدوار وفق docs/spec.md القسم 9
ROLE_ORDER = [
    "principal",
    "vice_teachers",
    "vice_students",
    "activity_leader",
    "gifted_coordinator",
    "student_counselor",
    "health_guide",
    "safety_officer",
    "teacher",
]

# عناوين الوظيفة في Excel إلى مفاتيح المواصفة
JOB_TO_ROLE = {
    "مدير": "principal",
    "وكيل شؤون تعليمية": "vice_teachers",
    "وكيل شؤون طلاب": "vice_students",
    "رائد نشاط": "activity_leader",
    "مسؤول موهوبين": "gifted_coordinator",
    "موجه طلابي": "student_counselor",
    "موجه صحي": "health_guide",
    "مسؤول أمن وسلامة": "safety_officer",
    "معلم": "teacher",
}

# أعمدة الورقة العربية إلى مفاتيح إنجليزية
COLUMN_KEYS = {
    "السجل المدني": "national_id",
    "الاسم الرباعي": "name",
    "الجنس": "gender",
    "الوظيفة": "role",
    "التخصص": "specialty",
    "الجوال": "mobile",
}


def parse_noor_workbook(path):
    """يقرأ ورقة الموظفون ويعيد الموظفين وخريطة الأدوار."""
    workbook = openpyxl.load_workbook(Path(path), data_only=True)
    sheet = workbook["الموظفون"]
    rows = sheet.iter_rows(values_only=True)
    headers = next(rows)
    index = {}
    for position, header in enumerate(headers):
        title = "" if header is None else str(header).strip()
        key = COLUMN_KEYS.get(title)
        if key:
            index[key] = position

    staff = []
    grouped = {role: [] for role in ROLE_ORDER}
    for row in rows:
        if row is None or all(cell is None or str(cell).strip() == "" for cell in row):
            continue
        person = {}
        for key, position in index.items():
            value = row[position] if position < len(row) else None
            person[key] = "" if value is None else str(value).strip()
        role_code = JOB_TO_ROLE.get(person.get("role", ""))
        if role_code:
            person["role"] = role_code
            grouped[role_code].append(
                {"name": person.get("name", ""), "id": person.get("national_id", "")}
            )
        staff.append(person)

    # دور واحد يبقى كائنًا، والدور المكرر يُجمع في قائمة حتى لا يُسقط المعلمون
    roles_map = {}
    for role in ROLE_ORDER:
        people = grouped[role]
        if not people:
            continue
        roles_map[role] = people[0] if len(people) == 1 else people

    return {"staff": staff, "roles_map": roles_map}


def _clean_id(value):
    """يبقي السجل المدني نصًا بلا لاحقة عشرية."""
    text = "" if value is None else str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    return text


def _name_tokens(value):
    """يفكك الاسم إلى كلمات المقارنة بعد توحيد الألف وحذف الصلة."""
    text = "" if value is None else str(value)
    text = text.split("-")[0].split("–")[0]
    text = text.replace("أ.", "").replace("ا.", "")
    text = text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    text = text.replace("ة", "ه").replace("ى", "ي").replace("ابن", "بن")
    text = re.sub(r"\s+", " ", text).strip()
    return [token for token in text.split(" ") if token and token != "بن"]


def _shared_tokens(left, right):
    """يعد الكلمات المشتركة بين اسمين."""
    return len(set(_name_tokens(left)) & set(_name_tokens(right)))


def _same_person(left, right):
    """يطابق الاسم المختصر في الردود بالاسم الرباعي في كشف الكادر."""
    short = _name_tokens(left)
    full = _name_tokens(right)
    if not short or not full:
        return False
    index = 0
    for token in full:
        if index < len(short) and (token == short[index] or token.startswith(short[index]) or short[index].startswith(token)):
            index += 1
    return index == len(short)


def _sheet_rows(workbook, sheet_name):
    """يعيد رؤوس الورقة وصفوفها النصية."""
    sheet = workbook[sheet_name]
    rows = sheet.iter_rows(values_only=True)
    headers = ["" if cell is None else str(cell).strip() for cell in next(rows)]
    records = []
    for row in rows:
        if row is None or all(cell is None or str(cell).strip() == "" for cell in row):
            continue
        record = {}
        for index, header in enumerate(headers):
            if not header or index >= len(row):
                continue
            value = row[index]
            record[header] = "" if value is None else str(value).strip()
        records.append(record)
    return records


_OFFICIAL_DEPUTIES = (
    ("محمد بن فايز بن هلال الحربي", "وكيل الشؤون التعليمية"),
    ("خالد بن علي بن حجري العمري", "وكيل شؤون الطلاب"),
)


def _is_placeholder_id(value):
    """يميز أرقام المرور التسلسلية في بوابة المعلمين عن السجل المدني."""
    text = _clean_id(value)
    return len(text) < 10


def _unique_staff(staff_rows):
    """يدمج صفوف Staff_All المكررة للشخص الواحد ويحفظ أدواره."""
    people = []
    index = {}
    for record in staff_rows:
        name = record.get("name_raw", "").strip()
        if not name:
            continue
        person_id = _clean_id(record.get("national_id", ""))
        role = record.get("role", "").strip()
        key = person_id or name
        if key in index:
            current = people[index[key]]
            if role and role not in current["role"].split(" / "):
                current["role"] = (current["role"] + " / " + role).strip(" / ")
            continue
        index[key] = len(people)
        people.append({"id": person_id, "name": name, "role": role})
    return people


def _known_person(label, people):
    """يربط الاسم المختصر بصاحبه في كشف الكادر دون إنشاء صف ثان."""
    for person in people:
        if _same_person(label, person["name"]) or _shared_tokens(label, person["name"]) >= 2:
            return person
    return None


def parse_evidence_staff(path):
    """يستخرج المدير والوكيلين وكامل المنسوبين من ملف الشواهد الرسمي."""
    workbook = openpyxl.load_workbook(Path(path), data_only=True, read_only=True)
    staff_rows = _sheet_rows(workbook, "Staff_All")
    portal_rows = _sheet_rows(workbook, "بيانات المعلمين")
    response_rows = _sheet_rows(workbook, "ردود النموذج 1")
    workbook.close()

    staff = _unique_staff(staff_rows)
    principal = next((person for person in staff if "مدير" in person["role"]), {"id": "", "name": "", "role": ""})
    deputies = []
    for official_name, official_role in _OFFICIAL_DEPUTIES:
        matched = next((person for person in staff if person["name"] == official_name), None)
        if matched is None:
            matched = _known_person(official_name, [person for person in staff if person["role"] == "وكيل"])
        if matched is None:
            continue
        deputies.append({"id": matched["id"], "name": matched["name"], "role": official_role})

    deputy_ids = {person["id"] for person in deputies if person["id"]}
    teachers = list(deputies)
    for person in staff:
        if person["name"] == principal.get("name"):
            continue
        if person["id"] and person["id"] in deputy_ids:
            continue
        teachers.append({"id": person["id"], "name": person["name"], "role": person["role"]})

    for record in portal_rows:
        label = record.get("اسم المعلم / الموظف", "").strip()
        short = label.split("-")[0].strip()
        if not short or _known_person(short, staff):
            continue
        portal_id = _clean_id(record.get("رقم السجل المدني (كلمة المرور)", ""))
        if not _is_placeholder_id(portal_id) and any(person["id"] == portal_id for person in staff):
            continue
        job = record.get("الصفة / الدور", "").strip() or "معلم"
        teachers.append({"id": "", "name": short, "role": job})
        staff.append({"id": "", "name": short, "role": job})

    participants = []
    seen = set()
    for record in response_rows:
        written = record.get("اسم المعلم أو الموظف", "").strip()
        if not written:
            continue
        matched = _known_person(written, staff)
        identity = matched["id"] if matched and matched["id"] else written
        if identity in seen:
            continue
        seen.add(identity)
        if matched:
            participants.append({"id": matched["id"], "name": matched["name"], "role": matched["role"]})
        else:
            name = written.split("-")[0].strip()
            participants.append({"id": "", "name": name, "role": ""})
            if not _known_person(name, teachers):
                teachers.append({"id": "", "name": name, "role": ""})

    return {
        "principal": principal,
        "deputies": deputies,
        "participants": participants,
        "teachers": teachers,
    }
