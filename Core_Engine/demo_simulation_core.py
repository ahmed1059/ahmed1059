# نواة محاكاة العام 1448. القراءة من القاعدة، والكتابة لا تتم إلا بأمر --apply.
# السقف الافتراضي 2026-11-12. الأسابيع ثابتة على تقويم المدينة، ولا تُحسب من ساعة الجهاز.

from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import subprocess
from datetime import date, datetime
from pathlib import Path

from .database import DB_PATH, connect

ROOT = Path(__file__).resolve().parent.parent
BANK_PATH = ROOT / "School_Data" / "knowledge_bases" / "plans-bank.json"
COUNCIL_PATH = ROOT / "School_Data" / "council_minutes.json"
PREVIEW_PATH = ROOT / "Print_Canvas" / "pilot-diagnosis-preview.html"
ANCHOR_DEFAULT = "2026-11-12"
FOLLOW_AFTER_BREAK = "2026-12-02"
HOLIDAYS = (
    (date(2026, 9, 23), date(2026, 9, 24)),
    (date(2026, 11, 20), date(2026, 11, 28)),
)
TAG_SUFFIXES = (
    "منفذ ميدانيًا",
    "بنك الخطط",
    "إجراء الخطة",
    "مقترح إشرافي",
    "إشرافي-استدامة",
    "إشرافي-ابتكار",
    "توصية تحسين",
)
BANNED_IN_PROSE = (
    "لأن السجل",
    "ليست محضر",
    "درجة مئوية",
    "لا تُعرض",
    "لا يحتوي",
    "JSON",
    "pilot-",
)
REGISTERS = {
    "admin": ("leadership", "سجل القيادة والإدارة المدرسية"),
    "guidance": ("behavior", "سجل التوجيه والإرشاد والسلوك"),
    "achievement": ("grades", "سجل التحصيل ونواتج التعلم"),
    "excellence": ("indicators", "سجل الاعتماد والتميز والجودة"),
    "activity": ("activity", "سجل خطة النشاط"),
    "fund": ("accounts", "سجل الصندوق المدرسي"),
    "safety": ("facility", "سجل الأمن والسلامة"),
    "special": ("support", "سجل التربية الخاصة والدعم"),
    "teachers": ("leadership", "سجل مجلس المعلمين"),
    "students": ("behavior", "سجل مجلس الطلاب"),
}
LABELS = {
    "admin": "اللجنة الإدارية",
    "teachers": "مجلس المعلمين",
    "guidance": "لجنة التوجيه والإرشاد",
    "achievement": "لجنة التحصيل الدراسي",
    "activity": "لجنة النشاط والمناسبات",
    "safety": "فريق الأمن والسلامة المدرسية",
    "fund": "فريق الصندوق المدرسي",
    "excellence": "لجنة التميز",
    "special": "فريق التربية الخاصة",
    "students": "مجلس الطلاب",
}


def _clean_procedure(text: str) -> str:
    value = str(text or "")
    for suffix in TAG_SUFFIXES:
        value = value.replace(suffix, "")
    replacements = (
        ("الطلاب/الطالبات", "الطلاب"),
        ("طلاب/طالبات", "طلاب"),
        ("الطالبات", "الطلاب"),
        ("طالبات", "طلاب"),
        ("المعلمين/ات", "المعلمين"),
        ("معلمين/ات", "معلمي"),
        ("المعلمات", "المعلمين"),
        ("معلمات", "معلمين"),
        ("لمنسوبي/ات", "لمنسوبي"),
        ("معلم/ة", "معلم"),
    )
    for source, target in replacements:
        value = value.replace(source, target)
    return " ".join(value.split())


def _dates(isos: list[str]) -> dict[str, dict[str, str]]:
    script = r"""
const isos = JSON.parse(process.argv[1]);
const hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {day:"numeric", month:"long", year:"numeric"});
const day = new Intl.DateTimeFormat("ar-EG", {weekday:"long"});
const gregorian = new Intl.DateTimeFormat("ar-EG", {day:"numeric", month:"long", year:"numeric"});
const out = {};
for (const iso of isos) {
  const value = new Date(iso + "T12:00:00");
  out[iso] = {
    hijri: hijri.format(value),
    weekday: day.format(value),
    gregorian: gregorian.format(value)
  };
}
process.stdout.write(JSON.stringify(out));
"""
    completed = subprocess.run(
        ["node", "-e", script, json.dumps(isos)],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return json.loads(completed.stdout)


def _person(row) -> dict:
    return {
        "id": str(row[0] or "").strip(),
        "name": str(row[1] or "").strip(),
        "role": str(row[2] or "").strip(),
        "specialty": str(row[3] or "").strip() if len(row) > 3 else "",
    }


def _load_school(connection: sqlite3.Connection) -> dict:
    staff = [
        _person(row)
        for row in connection.execute(
            """
            SELECT national_id, name, role, COALESCE(specialty, '')
            FROM noor_staff
            WHERE COALESCE(is_deleted, 0) = 0
            ORDER BY name
            """
        ).fetchall()
    ]
    by_id = {person["id"]: person for person in staff if person["id"]}
    seats = {"manager": "", "education": "", "students": "", "counselor": "", "activity": ""}
    try:
        for role, identity, _order in connection.execute(
            "SELECT role, national_id, sort_order FROM leadership_seat ORDER BY sort_order, role"
        ):
            ident = str(identity or "").strip()
            if role == "manager" and ident and not seats["manager"]:
                seats["manager"] = ident
            elif role == "education_agents" and ident and not seats["education"]:
                seats["education"] = ident
            elif role == "student_agents" and ident and not seats["students"]:
                seats["students"] = ident
            elif role == "counselors" and ident and not seats["counselor"]:
                seats["counselor"] = ident
            elif role == "activity_leader" and ident and not seats["activity"]:
                seats["activity"] = ident
    except sqlite3.OperationalError:
        seats = seats
    counselors = [person for person in staff if "موجه" in person["role"]]
    teachers = [person for person in staff if person["role"].startswith("معلم")]
    activity = by_id.get(seats["activity"])
    if activity is None:
        activity = next((person for person in staff if "نشاط" in person["role"]), None)
    clerks = [person for person in staff if "دار" in person["role"]]
    evaluation = connection.execute(
        """
        SELECT score, level FROM external_evaluations
        WHERE year = 2025 AND indicator_code = 'OVERALL'
        """
    ).fetchone()
    students = [
        _person(row)
        for row in connection.execute(
            """
            SELECT national_id, name, grade, COALESCE(classroom, '')
            FROM noor_students
            WHERE COALESCE(is_deleted, 0) = 0 AND TRIM(COALESCE(name, '')) != ''
            ORDER BY grade, classroom, name
            """
        ).fetchall()
    ]
    return {
        "by_id": by_id,
        "seats": seats,
        "counselors": counselors,
        "teachers": teachers,
        "activity": activity,
        "clerks": clerks,
        "evaluation": evaluation,
        "students": students,
        "signatures": _signatures(connection),
    }


def _signatures(connection: sqlite3.Connection) -> dict[str, str]:
    try:
        rows = connection.execute(
            """
            SELECT national_id, signature_path FROM users
            WHERE TRIM(COALESCE(signature_path, '')) != ''
            """
        ).fetchall()
    except sqlite3.OperationalError:
        return {}
    return {str(row[0]).strip(): str(row[1]).strip() for row in rows if row[0]}


def _require(school: dict, bank: list[dict]) -> None:
    missing = []
    evaluation = school["evaluation"]
    if not evaluation or float(evaluation[0]) != 71.0 or str(evaluation[1] or "") != "انطلاق":
        missing.append("الدرجة الكلية 71 بمستوى انطلاق لعام 2025")
    codes = {str(item.get("code") or "") for item in bank}
    for code in ("2-1-1-2", "1-1-1-1", "1-3-1-1", "1-2-1-1", "4-2-1-1", "1-4-1-2", "2-1-1-1"):
        if code not in codes:
            missing.append("المؤشر " + code)
    seats = school["seats"]
    for key, label in (
        ("manager", "مدير المدرسة"),
        ("education", "وكيل الشؤون التعليمية"),
        ("students", "وكيل شؤون الطلاب"),
        ("counselor", "الموجه الطلابي"),
    ):
        person = school["by_id"].get(seats.get(key) or "")
        if not person or not person["name"]:
            missing.append(label)
    if school["activity"] is None or not school["activity"]["name"]:
        missing.append("رائد النشاط")
    if len(school["teachers"]) < 4:
        missing.append("أربعة معلمين للزيارات")
    if len(school["students"]) < 4:
        missing.append("طلاب مجلس الطلاب ودراسة الحالة")
    if missing:
        raise SystemExit("توقف الفحص قبل الكتابة: " + "؛ ".join(missing))


def _procedure(bank: list[dict], code: str, needle: str) -> str:
    for item in bank:
        if str(item.get("code") or "") != code:
            continue
        for procedure in item.get("procedures") or []:
            cleaned = _clean_procedure(procedure)
            if needle in cleaned:
                return cleaned
    raise SystemExit("توقف الفحص: الإجراء «" + needle + "» غير موجود تحت " + code)


def _titled(bank: list[dict], code: str) -> str:
    for item in bank:
        if str(item.get("code") or "") == code:
            return _clean_procedure(item.get("title") or "")
    return ""


def _visit_blocked(person: dict, blocked_ids: set[str]) -> bool:
    if person["id"] in blocked_ids:
        return True
    if "هيازع الشهري" in person["name"]:
        return True
    return not str(person["role"]).startswith("معلم")


def _pick_teachers(teachers: list[dict], blocked_ids: set[str]) -> tuple[list[dict], dict]:
    pool = [person for person in teachers if not _visit_blocked(person, blocked_ids)]
    math = [person for person in pool if "رياض" in person["specialty"]]
    if not math:
        raise SystemExit("توقف الفحص: لا معلم رياضيات خارج القيادة لزيارة التقويم البنائي")
    partial = math[0]
    chosen = [partial]
    seen = {partial["specialty"]}
    for person in pool:
        if person["id"] == partial["id"]:
            continue
        key = person["specialty"] or person["id"]
        if key in seen:
            continue
        seen.add(key)
        chosen.append(person)
        if len(chosen) == 4:
            break
    if len(chosen) < 4:
        raise SystemExit("توقف الفحص: عينة الزيارات أقل من أربعة معلمين")
    return chosen, partial


def _pick_students(students: list[dict]) -> tuple[list[dict], dict]:
    council = []
    seen = set()
    for person in students:
        grade = person["role"]
        if not grade or grade in seen:
            continue
        seen.add(grade)
        council.append(person)
        if len(council) == 3:
            break
    used = {person["id"] for person in council}
    case = next((person for person in students if person["id"] not in used), students[0])
    return council, case


def _arabic_join(names: list[str]) -> str:
    if not names:
        return ""
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return names[0] + " و" + names[1]
    return "، ".join(names[:-1]) + "، و" + names[-1]


def _member(person: dict, role: str = "") -> dict:
    return {
        "id": person["id"],
        "name": person["name"],
        "role": role or person["role"],
    }


def _on_holiday(iso: str) -> bool:
    current = date.fromisoformat(iso)
    return any(start <= current <= end for start, end in HOLIDAYS)


def _stamp(spec: dict, labels: dict[str, dict[str, str]]) -> dict:
    iso = spec["iso"]
    if iso > ANCHOR_DEFAULT or _on_holiday(iso):
        raise SystemExit("تاريخ خارج السقف أو داخل إجازة: " + iso)
    follow = spec.get("followIso") or ""
    if follow and (follow <= ANCHOR_DEFAULT or _on_holiday(follow)):
        raise SystemExit("متابعة غير صالحة: " + follow)
    stamp = labels[iso]
    follow_stamp = labels.get(follow) or {}
    register_key, register_label = REGISTERS[spec["type"]]
    text = spec["minutes"]
    decisions = spec["decisions"]
    for banned in BANNED_IN_PROSE:
        if banned in text or banned in decisions:
            raise SystemExit("تسرب تعليق تقني في " + spec["id"] + ": " + banned)
    record = {
        "id": spec["id"],
        "type": spec["type"],
        "hijri": stamp["hijri"],
        "gregorian": stamp["weekday"] + " " + stamp["gregorian"],
        "iso": iso,
        "agenda": spec["agenda"],
        "present": spec["present"],
        "decisions": decisions,
        "minutes": text,
        "addition": "",
        "followHijri": follow_stamp.get("hijri", ""),
        "followGregorian": (follow_stamp.get("weekday", "") + " " + follow_stamp.get("gregorian", "")).strip(),
        "followIso": follow,
        "registerKey": register_key,
        "registerLabel": register_label,
        "dayKey": iso,
        "evidenceCount": 0,
        "indicator": spec["indicator"],
        "purpose": spec["purpose"],
    }
    if spec.get("approvedIso"):
        record["approvedIso"] = spec["approvedIso"]
        record["approvedHijri"] = labels[spec["approvedIso"]]["hijri"]
    return record


def build(connection: sqlite3.Connection) -> dict:
    school = _load_school(connection)
    bank = json.loads(BANK_PATH.read_text(encoding="utf-8"))
    _require(school, bank)
    seats = school["seats"]
    manager = school["by_id"][seats["manager"]]
    education = school["by_id"][seats["education"]]
    students_vice = school["by_id"][seats["students"]]
    counselor = school["by_id"][seats["counselor"]]
    guides = school["counselors"] or [counselor]
    activity = school["activity"]
    blocked = {value for value in seats.values() if value}
    visit_teachers, partial = _pick_teachers(school["teachers"], blocked)
    council_students, case_student = _pick_students(school["students"])
    clerk = school["clerks"][0] if school["clerks"] else students_vice
    sample = "مراجعة عينة أسبوعية من خطط المعلمين عبر منصة مدرستي مع تغذية راجعة مكتوبة"
    study = _procedure(bank, "2-1-1-2", "دراسة نتائج تعلم الطلاب")
    strength = _procedure(bank, "2-1-1-2", "دعم جوانب القوة")
    community = _procedure(bank, "2-1-1-2", "جلسات مجتمعات مهنية")
    follow_curriculum = _procedure(bank, "2-1-1-2", "متابعة تنفيذ المناهج")
    plan_build = _procedure(bank, "1-1-1-1", "بناء الخطة التشغيلية")
    relations = _procedure(bank, "1-3-1-1", "تعزيز العلاقات الإنسانية")
    identity = _procedure(bank, "1-2-1-1", "توظيف المناسبات الوطنية")
    safety = _procedure(bank, "4-2-1-1", "حصر متطلبات الأمن والسلامة")
    growth = _procedure(bank, "1-4-1-2", "تحليل الاحتياجات التدريبية")
    equity = _procedure(bank, "2-1-1-1", "فرص تعلم متكافئة")
    teamwork = _procedure(bank, "1-3-1-1", "التعاون والعمل بروح الفريق")
    subject = partial["specialty"] or "تخصصه"
    others = _arabic_join([person["name"] for person in visit_teachers if person["id"] != partial["id"]])
    isos = [
        "2026-08-11", "2026-09-02", "2026-09-09", "2026-09-16", "2026-09-22",
        "2026-09-30", "2026-10-01", "2026-10-07", "2026-10-14", "2026-10-21",
        "2026-10-28", "2026-11-02", "2026-11-04", "2026-11-11", "2026-11-12",
        FOLLOW_AFTER_BREAK,
    ]
    labels = _dates(isos)
    specs = [
        {
            "id": "pilot-1448-admin-2026-08-11",
            "type": "admin",
            "iso": "2026-08-11",
            "indicator": "1-1-1-1",
            "purpose": "اعتماد التشكيل ومسوّدة الخطة التشغيلية",
            "agenda": "انطلاقة العام واعتماد التشكيل والخطة التشغيلية",
            "present": [
                _member(manager, "مدير المدرسة"),
                _member(education, "وكيل الشؤون التعليمية"),
                _member(students_vice, "وكيل شؤون الطلاب"),
                _member(counselor, "موجه طلابي"),
            ],
            "followIso": "",
            "minutes": (
                f"اجتمعت اللجنة الإدارية في يوم عودة الهيئة الإدارية برئاسة {manager['name']}، "
                f"وبحضور {education['name']} و{students_vice['name']} و{counselor['name']}. "
                "نُظر في جاهزية العام الدراسي 1448–1449 قبل وصول الطلاب يوم 17 ربيع الأول 1448هـ، "
                f"وفي الإجراء المحفوظ ضمن المؤشر 1-1-1-1: «{plan_build}»."
                "\n\n"
                "ويرتكز العمل في هذه المرحلة على متابعة الخطط وتجويد الممارسات التدريسية الميدانية. "
                "اتفق المجتمعون على أن تكون الدرجة الكلية للتقويم الخارجي لعام 2025، وهي 71 بمستوى انطلاق، "
                "مرجعية عامة لهذا التجويد، وعلى أن تباشر المكاتب ما خُصص لها في الخطة التشغيلية."
            ),
            "decisions": (
                "1. اعتماد تشكيل اللجان المحفوظ، ومباشرة كل مكتب ما أُسند إليه من تاريخ هذا الاجتماع.\n"
                f"2. يتولى {education['name']} جمع عينة من الخطط الأسبوعية في الأسبوع الأول بعد انطلاق الدراسة.\n"
                f"3. يُعد {counselor['name']} برنامج التهيئة والتعارف، ويُعرض على لجنة التوجيه في الأسبوع الثاني."
            ),
        },
        {
            "id": "pilot-1448-teachers-2026-09-02",
            "type": "teachers",
            "iso": "2026-09-02",
            "indicator": "2-1-1-2",
            "purpose": "إطلاق الخطط الأسبوعية ومتابعتها",
            "agenda": "خطط الأسبوع الأول بعد انطلاق الدراسة",
            "present": [_member(education, "وكيل الشؤون التعليمية")] + [
                _member(person) for person in visit_teachers[:3]
            ],
            "followIso": "",
            "minutes": (
                f"اجتمع مجلس المعلمين برئاسة {education['name']} في الأسبوع الأول من الدراسة. "
                f"عُرض المؤشر 2-1-1-2: «{_titled(bank, '2-1-1-2')}»، "
                f"والإجراء «{sample}»."
                "\n\n"
                "استمع المجلس إلى ما أعدّه المعلمون لحصص هذا الأسبوع، واتفقوا على أن التغذية الراجعة المكتوبة "
                "تصل صاحب الخطة خلال الأسبوع نفسه، لتُستكمل عليها الزيارات الاستطلاعية لاحقًا."
            ),
            "decisions": (
                "1. اعتماد عينة الخطط الأسبوعية المعروضة في هذا الاجتماع.\n"
                f"2. يزوّد {education['name']} كل معلم في العينة بملحوظة مكتوبة قبل نهاية الأسبوع.\n"
                "3. تُؤجل الزيارة الصفية إلى الأسبوعين الخامس والسادس بعد اكتمال التعارف واستقرار الجدول."
            ),
        },
        {
            "id": "pilot-1448-guidance-2026-09-09",
            "type": "guidance",
            "iso": "2026-09-09",
            "indicator": "1-3-1-1",
            "purpose": "برنامج التهيئة والتعارف",
            "agenda": "تهيئة الطلاب وبناء العلاقة الإيجابية في بداية العام",
            "present": [_member(person, "موجه طلابي") for person in guides[:2]] + [
                _member(students_vice, "وكيل شؤون الطلاب")
            ],
            "followIso": "",
            "minutes": (
                f"اجتمعت لجنة التوجيه والإرشاد برئاسة {counselor['name']}. "
                f"عُرض المؤشر 1-3-1-1: «{_titled(bank, '1-3-1-1')}»، "
                f"والإجراء «{relations}»."
                "\n\n"
                "أقرت اللجنة برنامج تهيئة يمتد هذا الأسبوع في الطابور وحصص الإرشاد، "
                "ويعرّف الطلاب بقواعد المدرسة وبالموجه ووكيل شؤون الطلاب."
            ),
            "decisions": (
                f"1. تنفيذ برنامج التهيئة خلال هذا الأسبوع بإشراف {counselor['name']}.\n"
                f"2. يحضر {students_vice['name']} لقاء التعارف في كل صف مرة واحدة هذا الأسبوع.\n"
                "3. تُرفع ملحوظات البرنامج إلى لجنة التوجيه في اجتماعها اللاحق دون فتح دراسة حالة في هذا الأسبوع."
            ),
        },
    ]
    specs.extend(_remaining_specs(
        bank, manager, education, students_vice, counselor, guides, activity, clerk,
        visit_teachers, partial, council_students, case_student, subject, others,
        study, strength, community, follow_curriculum, identity, safety, growth, equity, teamwork, relations,
    ))
    minutes = [_stamp(spec, labels) for spec in specs]
    desks = [
        {
            "store": "improvement_actions",
            "key": "pilot-1448-improve-formative",
            "title": "متابعة جودة التقويم البنائي في الحصة",
            "owner": education["name"],
            "owner_role": "vice_education",
            "indicator": "2-1-1-2",
            "status": "قيد المتابعة",
            "followIso": FOLLOW_AFTER_BREAK,
        },
        {
            "store": "school_programs",
            "key": "pilot-1448-program-orientation",
            "title": "برنامج التهيئة والتعارف",
            "owner": counselor["name"],
            "owner_role": "counselor",
            "indicator": "1-3-1-1",
            "status": "نُفّذ",
            "followIso": None,
        },
        {
            "store": "school_programs",
            "key": "pilot-1448-program-national",
            "title": "برنامج اليوم الوطني",
            "owner": activity["name"],
            "owner_role": "activity",
            "indicator": "1-2-1-1",
            "status": "نُفّذ",
            "followIso": None,
        },
        {
            "store": "school_programs",
            "key": "pilot-1448-program-visits",
            "title": "زيارات استطلاعية لأربع حصص",
            "owner": education["name"],
            "owner_role": "vice_education",
            "indicator": "2-1-1-2",
            "status": "نُفّذ، والمتابعة مفتوحة",
            "followIso": FOLLOW_AFTER_BREAK,
        },
    ]
    return {"minutes": minutes, "desks": desks, "partial": partial, "school": {
        "manager": manager["name"],
        "education": education["name"],
        "students": students_vice["name"],
        "counselor": counselor["name"],
        "activity": activity["name"],
    }}


def _remaining_specs(bank, manager, education, students_vice, counselor, guides, activity, clerk,
                     visit_teachers, partial, council_students, case_student, subject, others,
                     study, strength, community, follow_curriculum, identity, safety, growth, equity, teamwork, relations):
    student_names = "، ".join(
        f"{person['name']} ({person['role']})" for person in council_students
    )
    return [
        {
            "id": "pilot-1448-achievement-2026-09-16",
            "type": "achievement",
            "iso": "2026-09-16",
            "indicator": "2-1-1-2",
            "purpose": "تشخيص تنفيذ المناهج في ضوء التقويم الخارجي",
            "agenda": "مؤشر 2-1-1-2 ودعم تنفيذ المناهج",
            "present": [
                _member(education, "وكيل الشؤون التعليمية"),
                _member(counselor, "موجه طلابي"),
                _member(partial),
            ],
            "followIso": "",
            "minutes": (
                f"اجتمعت لجنة التحصيل الدراسي برئاسة {education['name']} بعد ثلاثة أسابيع من انطلاق الدراسة. "
                f"عُرض مؤشر 2-1-1-2: «{_titled(bank, '2-1-1-2')}». "
                "ارتكز النقاش على الدرجة الكلية للتقويم الخارجي لعام 2025، وهي 71 بمستوى انطلاق، "
                "مرجعية عامة لتجويد الممارسات التدريسية داخل الصف."
                "\n\n"
                f"نظرت اللجنة في الإجراء «{study}»، ثم في الإجراء «{strength}». "
                "ورأت أن أول عمل ميداني هو رؤية التخطيط والتنفيذ داخل الحصة قبل الحكم على مسار بعينه."
            ),
            "decisions": (
                f"1. يزور {education['name']} أربع حصص استطلاعية في الأسبوعين الخامس والسادس "
                f"لـ {partial['name']} و{others}، وفق معايير الزيارة المعتمدة.\n"
                "2. تُرفع خلاصة الزيارات إلى اجتماع اللجنة يوم الأربعاء 14 أكتوبر 2026م.\n"
                f"3. يفعّل مجلس المعلمين الإجراء «{community}» في اجتماعه يوم 7 أكتوبر 2026م."
            ),
        },
        {
            "id": "pilot-1448-activity-2026-09-22",
            "type": "activity",
            "iso": "2026-09-22",
            "indicator": "1-2-1-1",
            "purpose": "برنامج اليوم الوطني قبل الإجازة",
            "agenda": "برنامج اليوم الوطني السعودي",
            "present": [
                _member(activity, "رائد النشاط"),
                _member(students_vice, "وكيل شؤون الطلاب"),
                _member(manager, "مدير المدرسة"),
            ],
            "followIso": "",
            "minutes": (
                f"اجتمعت لجنة النشاط والمناسبات برئاسة {activity['name']} قبل إجازة اليوم الوطني. "
                f"عُرض المؤشر 1-2-1-1: «{_titled(bank, '1-2-1-1')}»، والإجراء «{identity}»."
                "\n\n"
                "اعتمدت اللجنة برنامجًا إذاعيًا وفقرة صفية قصيرة في يوم الثلاثاء 22 سبتمبر 2026م، "
                "على أن تتوقف الأنشطة مع بدء الإجازة في اليوم التالي."
            ),
            "decisions": (
                f"1. تنفيذ البرنامج الإذاعي يوم الثلاثاء بإشراف {activity['name']}.\n"
                f"2. يتابع {students_vice['name']} النظام أثناء الخروج إلى الإجازة.\n"
                "3. يُحفظ وصف البرنامج في سجل النشاط."
            ),
        },
        {
            "id": "pilot-1448-safety-2026-09-30",
            "type": "safety",
            "iso": "2026-09-30",
            "indicator": "4-2-1-1",
            "purpose": "حصر متطلبات الأمن والسلامة",
            "agenda": "متطلبات الأمن والسلامة في المبنى",
            "present": [
                _member(education, "وكيل الشؤون التعليمية"),
                _member(students_vice, "وكيل شؤون الطلاب"),
                _member(clerk, clerk["role"] or "عضو"),
            ],
            "followIso": "",
            "minutes": (
                f"اجتمع فريق الأمن والسلامة المدرسية. عُرض المؤشر 4-2-1-1: «{_titled(bank, '4-2-1-1')}»، "
                f"والإجراء «{safety}»."
                "\n\n"
                "دار الفريق على المخارج والطفايات ونقاط التجمع المسجلة في متابعة المبنى، "
                f"ورفع ملخصًا إلى {manager['name']} ليشاهده في جولته يوم 21 أكتوبر 2026م."
            ),
            "decisions": (
                "1. اعتماد الحصر المعروض لما هو قائم في المبنى.\n"
                f"2. يتابع {students_vice['name']} نقطة التجمع خلال الفسحة هذا الأسبوع.\n"
                f"3. تُعرض الخلاصة على {manager['name']} في الجولة الميدانية يوم 21 أكتوبر 2026م."
            ),
        },
        {
            "id": "pilot-1448-fund-2026-10-01",
            "type": "fund",
            "iso": "2026-10-01",
            "indicator": "—",
            "purpose": "الاطلاع على سجل الصندوق المعتمد",
            "agenda": "مستندات الصندوق المدرسي",
            "present": [
                _member(education, "وكيل الشؤون التعليمية"),
                _member(students_vice, "وكيل شؤون الطلاب"),
                _member(clerk, clerk["role"] or "عضو"),
            ],
            "followIso": "",
            "minutes": (
                f"اجتمع فريق الصندوق المدرسي برئاسة {education['name']}. "
                "اطلع على سجل الصندوق المعتمد، وأقر استمرار الصرف وفق الأوامر المحفوظة فيه."
                "\n\n"
                "لم يُضف الفريق بندًا جديدًا في هذا الاجتماع. أحال أي طلب لاحق إلى اللجنة الإدارية "
                "مع أصل المستند."
            ),
            "decisions": (
                "1. اعتماد الاستمرار على سجل الصندوق المحفوظ.\n"
                "2. لا يُصرف مبلغ إلا بأمر محفوظ في السجل نفسه.\n"
                "3. يُعرض أي طلب جديد على اللجنة الإدارية قبل التنفيذ."
            ),
        },
        {
            "id": "pilot-1448-teachers-2026-10-07",
            "type": "teachers",
            "iso": "2026-10-07",
            "indicator": "2-1-1-2",
            "purpose": "مجتمع تعلم تخصصي",
            "agenda": "جلسات مجتمعات التعلم بين معلمي التخصص",
            "present": [_member(education, "وكيل الشؤون التعليمية")] + [
                _member(person) for person in visit_teachers
            ],
            "followIso": "",
            "minutes": (
                f"اجتمع مجلس المعلمين برئاسة {education['name']} تنفيذًا لقرار لجنة التحصيل. "
                f"نُفّذ الإجراء «{community}» بين معلمي التخصصات الحاضرة."
                "\n\n"
                f"عرض الأستاذ {partial['name']} تخطيط حصة في {subject}، وتداول المجتمعون طريقة إغلاق الحصة "
                "وتوزيع الأسئلة أثناء الشرح بوصفها خبرة تُتبادل بين معلمي التخصص. خُتمت الجلسة بملخص مكتوب يُرفق بمتابعة الوكيل."
            ),
            "decisions": (
                f"1. اعتماد انعقاد مجتمع التعلم بحضور المعلمين المكلفين.\n"
                f"2. يواصل الأستاذ {partial['name']} تجويد إغلاق الحصة مع معلمي التخصص في حصص هذا الأسبوع.\n"
                "3. تُراجع لجنة التحصيل الأثر ضمن خلاصة الزيارات يوم 14 أكتوبر 2026م."
            ),
        },
        {
            "id": "pilot-1448-achievement-2026-10-14",
            "type": "achievement",
            "iso": "2026-10-14",
            "indicator": "2-1-1-2",
            "purpose": "قراءة خلاصة الزيارات وإبقاء التحسين مفتوحًا",
            "agenda": "خلاصة الزيارات الاستطلاعية",
            "present": [
                _member(education, "وكيل الشؤون التعليمية"),
                _member(counselor, "موجه طلابي"),
                _member(partial),
            ],
            "followIso": FOLLOW_AFTER_BREAK,
            "minutes": (
                f"اجتمعت لجنة التحصيل لقراءة خلاصة الزيارات التي كلّف بها {education['name']} "
                "في محضر 16 سبتمبر 2026م. اكتملت الزيارات الأربع. "
                f"في حصة الأستاذ {partial['name']} رُصد تطبيق جزئي لأداة التقويم البنائي، "
                "واتفق المجتمعون على تجويدها في الحصة القادمة ضمن خطة التطوير المهني التشاركي. "
                "وبقية الحصص الأربع ظهرت معاييرها بمستوى «متحقق»."
                "\n\n"
                "وقد اعتمدت اللجنة هذا الرصد مدخلاً لتبادل الخبرة بين معلمي التخصص. "
                f"والإجراء «{follow_curriculum}» يبقى مفتوحًا حتى زيارة المتابعة بعد إجازة الخريف."
            ),
            "decisions": (
                f"1. يستمر تبادل الخبرة في التقويم البنائي على مكتب {education['name']} ضمن المؤشر 2-1-1-2.\n"
                f"2. يزور {education['name']} الأستاذ {partial['name']} زيارة متابعة تشاركية بعد العودة من إجازة الخريف، "
                "ويُعرض أثرها يوم الأربعاء 2 ديسمبر 2026م.\n"
                f"3. يضمّن {manager['name']} هذه الخلاصة في جولته يوم 21 أكتوبر 2026م، "
                "وفي اجتماع اللجنة الإدارية يوم 11 نوفمبر 2026م."
            ),
        },
        {
            "id": "pilot-1448-excellence-2026-10-21",
            "type": "excellence",
            "iso": "2026-10-21",
            "indicator": "1-4-1-2",
            "purpose": "تجويد الممارسة بعد الزيارات",
            "agenda": "دعم التطوير المهني في ضوء متابعة الحصص",
            "present": [
                _member(education, "وكيل الشؤون التعليمية"),
                _member(manager, "مدير المدرسة"),
                _member(activity, "رائد النشاط"),
            ],
            "followIso": "",
            "minutes": (
                f"اجتمعت لجنة التميز برئاسة {education['name']}، وبحضور {manager['name']}. "
                f"عُرض المؤشر 1-4-1-2: «{_titled(bank, '1-4-1-2')}»، والإجراء «{growth}»."
                "\n\n"
                f"اطلع المجتمعون على خلاصة الزيارات، وأقروا تثبيت الممارسة التي ظهرت بمستوى «متحقق» "
                f"ونشرها بين معلمي التخصص، مع مواصلة تجويد أداة التقويم البنائي مع الأستاذ {partial['name']}."
            ),
            "decisions": (
                "1. تعميم ملخص الممارسات المتحققة على معلمي التخصصات التي زارها الوكيل.\n"
                f"2. تستمر جلسة التبادل مع الأستاذ {partial['name']} ضمن إجراء المتابعة المفتوح.\n"
                f"3. يختم {manager['name']} جولته الميدانية في هذا اليوم ويودع ملخصها لدى اللجنة الإدارية."
            ),
        },
        {
            "id": "pilot-1448-guidance-2026-10-28",
            "type": "guidance",
            "iso": "2026-10-28",
            "indicator": "1-3-1-1",
            "purpose": "متابعة حالة واحدة من سجل الطلاب",
            "agenda": "متابعة توافق طالب مع بداية الفصل",
            "present": [_member(person, "موجه طلابي") for person in guides[:2]] + [
                _member(students_vice, "وكيل شؤون الطلاب")
            ],
            "followIso": FOLLOW_AFTER_BREAK,
            "minutes": (
                f"اجتمعت لجنة التوجيه والإرشاد برئاسة {counselor['name']}. "
                f"عُرضت متابعة {case_student['name']} من {case_student['role']}، "
                "وهو طالب مقيد في سجل الطلاب، للنظر في توافقه مع نظام اليوم الدراسي منذ انطلاقة العام."
                "\n\n"
                f"استندت اللجنة إلى الإجراء «{relations}». "
                "اتفق المجتمعون على مواصلة المتابعة بعد إجازة الخريف مع وكيل شؤون الطلاب."
            ),
            "decisions": (
                f"1. تستمر متابعة {case_student['name']} بإشراف {counselor['name']}.\n"
                f"2. يطلع {students_vice['name']} على المواظبة المحفوظة للطالب كل أسبوع.\n"
                "3. تُعرض حصيلة المتابعة على اللجنة يوم الأربعاء 2 ديسمبر 2026م."
            ),
        },
        {
            "id": "pilot-1448-special-2026-11-02",
            "type": "special",
            "iso": "2026-11-02",
            "indicator": "2-1-1-1",
            "purpose": "متابعة فرص التعلم في سجل الدعم",
            "agenda": "احتياجات الطلاب في سجل الدعم",
            "present": [
                _member(education, "وكيل الشؤون التعليمية"),
                _member(counselor, "موجه طلابي"),
                _member(students_vice, "وكيل شؤون الطلاب"),
            ],
            "followIso": "",
            "minutes": (
                f"اجتمع فريق التربية الخاصة برئاسة {education['name']}. "
                f"عُرض المؤشر 2-1-1-1: «{_titled(bank, '2-1-1-1')}»، والإجراء «{equity}»."
                "\n\n"
                "راجع الفريق سجل الدعم المحفوظ، ووزع المتابعة بين الموجه ووكيل الشؤون التعليمية "
                "ووكيل شؤون الطلاب بحسب ما هو مقيد أمام كل طالب في السجل."
            ),
            "decisions": (
                "1. اعتماد توزيع المتابعة كما هو في سجل الدعم.\n"
                f"2. يتابع {counselor['name']} الجانب الإرشادي للطلاب المقيدين في السجل.\n"
                f"3. يُبلغ {education['name']} معلمي الحصص بالمواءمات المكتوبة في السجل نفسه."
            ),
        },
        {
            "id": "pilot-1448-students-2026-11-04",
            "type": "students",
            "iso": "2026-11-04",
            "indicator": "1-3-1-1",
            "purpose": "توصية مجلس الطلاب قبل التوقف",
            "agenda": "مقترحات الطلاب لتنظيم الفسحة",
            "present": [_member(students_vice, "وكيل شؤون الطلاب")] + [
                _member(person, "طالب") for person in council_students
            ],
            "followIso": FOLLOW_AFTER_BREAK,
            "minutes": (
                f"اجتمع مجلس الطلاب برئاسة {students_vice['name']}. "
                f"حضر عن الصفوف: {student_names}. "
                f"عُرض المؤشر 1-3-1-1 والإجراء «{teamwork}»."
                "\n\n"
                "اقترح الطلاب ترتيبًا أوضح لطابور الفسحة والعودة إلى الفصل. "
                "قبل وكيل شؤون الطلاب الاقتراح مبدأً، وأجّل تطبيقه إلى ما بعد إجازة الخريف."
            ),
            "decisions": (
                "1. قبول مقترح تنظيم الفسحة والعودة إلى الفصل.\n"
                f"2. يُعد {students_vice['name']} ترتيب التنفيذ بعد العودة من الإجازة.\n"
                "3. يُعرض التطبيق على المجلس يوم الأربعاء 2 ديسمبر 2026م."
            ),
        },
        {
            "id": "pilot-1448-admin-2026-11-11",
            "type": "admin",
            "iso": "2026-11-11",
            "approvedIso": "2026-11-12",
            "indicator": "1-1-1-1",
            "purpose": "اعتماد تقارير المرحلة وإبقاء المعلّق لما بعد الخريف",
            "agenda": "تقارير الإنجاز حتى 11 نوفمبر 2026م",
            "present": [
                _member(manager, "مدير المدرسة"),
                _member(education, "وكيل الشؤون التعليمية"),
                _member(students_vice, "وكيل شؤون الطلاب"),
                _member(counselor, "موجه طلابي"),
            ],
            "followIso": FOLLOW_AFTER_BREAK,
            "minutes": (
                f"اجتمعت اللجنة الإدارية يوم الأربعاء 11 نوفمبر 2026م برئاسة {manager['name']}، "
                "في آخر اجتماع قبل التوقف المعتمد. استعرضت تقارير اللجان ومكاتب القيادة منذ 11 أغسطس: "
                "التشكيل، وبرنامج التهيئة، وزيارات الحصص، ومجتمع التعلم، ومجلس الطلاب."
                "\n\n"
                "وقف المجتمعون عند ما بقي مفتوحًا من مؤشر 2-1-1-2، وهو متابعة التقويم البنائي، "
                "وعند مقترح مجلس الطلاب. وفي يوم الخميس 12 نوفمبر 2026م وقّع رئيس اللجنة هذا المحضر، "
                "وأجّل المعلّق إلى الأربعاء 2 ديسمبر 2026م بعد إجازة الخريف."
            ),
            "decisions": (
                "1. اعتماد تقارير الإنجاز المرحلية للجان ومكاتب القيادة حتى تاريخه وحفظ شواهدها في السجل.\n"
                "2. تبقى إجراءات التحسين المرتبطة بالمؤشر 2-1-1-2 قيد المتابعة، ولا تُقفل في هذا الاجتماع.\n"
                "3. موعد عرض أثر زيارة المتابعة وأعمال المكاتب بعد الإجازة: الأربعاء 2 ديسمبر 2026م."
            ),
        },
    ]


def _print_report(payload: dict) -> None:
    print("الفحص: الدرجة 71 بمستوى انطلاق، والمؤشرات والأسماء موجودة في القاعدة.")
    print("السقف: 2026-11-12. المتابعة المعلقة: 2026-12-02. لم تُكتب القاعدة.")
    print("المحاضر:", len(payload["minutes"]))
    for index, minute in enumerate(payload["minutes"], start=1):
        follow = minute["followIso"] or "فارغ"
        print(
            f"{index}. {LABELS[minute['type']]} | {minute['iso']} | {minute['indicator']} | "
            f"{minute['purpose']} | متابعة {follow}"
        )
    print("مكاتب القيادة:")
    for desk in payload["desks"]:
        print(
            f"- {desk['store']} | {desk['key']} | {desk['title']} | {desk['owner']} | "
            f"{desk['status']} | {desk['followIso'] or 'فارغ'}"
        )


def _preview(minute: dict, payload: dict) -> None:
    paragraphs = "".join(f"<p>{_escape(part)}</p>" for part in minute["minutes"].split("\n\n"))
    decisions = "".join(
        f"<p>{_escape(line)}</p>" for line in minute["decisions"].split("\n") if line.strip()
    )
    attendance = "".join(
        "<tr><td>{}</td><td>{}</td><td></td></tr>".format(_escape(person["name"]), _escape(person["role"]))
        for person in minute["present"]
    )
    education = payload["school"]["education"]
    manager = payload["school"]["manager"]
    html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>معاينة محضر التشخيص</title>
  <link rel="stylesheet" href="/css/fonts.css?v=font1">
  <link rel="stylesheet" href="/css/media-governance.css?v=aj146">
  <style>
    body {{ margin: 16px; background: #e7e5e4; }}
    .aj-minutes-prose p {{ margin: 0 0 8px; line-height: 1.8; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 8px; }}
    th, td {{ border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 13px; }}
  </style>
</head>
<body>
  <div id="official-frame-host"></div>
  <script src="/js/official-frame-core.js"></script>
  <script>
    document.getElementById("official-frame-host").innerHTML = OfficialFrameCore.page({{
      strictIdentity: true,
      title: "محضر لجنة التحصيل الدراسي",
      bodyHtml: "<div class=\\"aj-minutes-prose\\">{paragraphs}<p>القرارات:</p>{decisions}<table><thead><tr><th>الاسم</th><th>الصفة</th><th>التوقيع</th></tr></thead><tbody>{attendance}</tbody></table></div>",
      signoff: true,
      page: 1,
      total: 1,
      columns: [
        {{roleTitle: "وكيل شؤون المعلمين", name: {_js(education)}, signature: "/signatures/sig_teachers.png", signatureFallback: "/signatures/sig_teachers.png"}},
        {{roleTitle: " ", name: "", signature: ""}},
        {{roleTitle: "مدير المدرسة", name: {_js(manager)}, signature: "/signatures/sig_manager.png", signatureFallback: "/signatures/sig_manager.png"}}
      ]
    }});
  </script>
</body>
</html>
"""
    PREVIEW_PATH.write_text(html, encoding="utf-8")
    print("المعاينة:", PREVIEW_PATH)


def _escape(value: str) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _js(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def _apply(payload: dict) -> None:
    moment = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = ROOT / "backups" / f"pilot-before-{moment}"
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(DB_PATH, backup / "school_1059.db")
    if COUNCIL_PATH.is_file():
        shutil.copy2(COUNCIL_PATH, backup / "council_minutes.json")
    stored = []
    for minute in payload["minutes"]:
        item = dict(minute)
        item.pop("indicator", None)
        item.pop("purpose", None)
        stored.append(item)
    COUNCIL_PATH.write_text(
        json.dumps({"minutes": stored}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    connection = connect()
    try:
        connection.execute("BEGIN")
        connection.execute("DELETE FROM improvement_actions WHERE evidence LIKE 'pilot-1448-%'")
        connection.execute("DELETE FROM school_programs WHERE duty_ref LIKE 'pilot-1448-%'")
        now = datetime.now().replace(microsecond=0).isoformat(sep=" ")
        for desk in payload["desks"]:
            if desk["store"] == "improvement_actions":
                connection.execute(
                    """
                    INSERT INTO improvement_actions
                    (title, owner_role, owner_label, indicator_code, evidence, sort_order, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (desk["title"], desk["owner_role"], desk["owner"], desk["indicator"], desk["key"], 0, now),
                )
            else:
                connection.execute(
                    """
                    INSERT INTO school_programs
                    (program_name, owner_role, indicator_ids, status, duty_ref, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (desk["title"], desk["owner_role"], desk["indicator"], desk["status"], desk["key"], now, now),
                )
        connection.commit()
    except Exception:
        connection.rollback()
        shutil.copy2(backup / "council_minutes.json", COUNCIL_PATH)
        raise
    finally:
        connection.close()
    print("كُتب بعد النسخ إلى", backup)


def _archive_rows(path: Path, key: str, rows: list[dict]) -> None:
    current = {"archived_at": "", key: []}
    if path.is_file():
        current = json.loads(path.read_text(encoding="utf-8"))
    found = current.get(key) if isinstance(current, dict) else []
    if not isinstance(found, list):
        found = []
    found.extend(rows)
    path.write_text(
        json.dumps({"archived_at": datetime.now().isoformat(timespec="seconds"), key: found}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def plant_linked_tasks() -> None:
    """يؤرشف التجريبي الواضح ويربط قرارات المحاضر الأربعة عشر بمهام. لا يمس قوائم الطلاب."""
    moment = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = ROOT / "backups" / f"pilot-before-tasks-{moment}"
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(DB_PATH, backup / "school_1059.db")
    connection = connect()
    try:
        program_rows = connection.execute(
            """
            SELECT id, program_name, status, duty_ref, owner_role, indicator_ids, created_at, updated_at
            FROM school_programs
            WHERE program_name LIKE '%تجربة%' OR program_name LIKE '%تجريب%'
            """
        ).fetchall()
        task_rows = connection.execute(
            """
            SELECT id, task_date, title, description, source_type, source_ref, owner_role, status
            FROM daily_tasks
            WHERE title LIKE '%تجربة%' OR title LIKE '%تجريب%'
            """
        ).fetchall()
        programs = [
            {
                "id": row[0],
                "program_name": row[1],
                "status": row[2],
                "duty_ref": row[3],
                "owner_role": row[4],
                "indicator_ids": row[5],
                "created_at": row[6],
                "updated_at": row[7],
            }
            for row in program_rows
        ]
        tasks = [
            {
                "id": row[0],
                "task_date": row[1],
                "title": row[2],
                "description": row[3],
                "source_type": row[4],
                "source_ref": row[5],
                "owner_role": row[6],
                "status": row[7],
            }
            for row in task_rows
        ]
        if programs:
            _archive_rows(ROOT / "School_Data" / "school_programs_archive.json", "programs", programs)
            connection.execute(
                "DELETE FROM school_programs WHERE id IN (%s)" % ",".join("?" for _ in programs),
                [row["id"] for row in programs],
            )
        if tasks:
            _archive_rows(ROOT / "School_Data" / "daily_tasks_archive.json", "tasks", tasks)
            connection.execute(
                "DELETE FROM daily_tasks WHERE id IN (%s)" % ",".join("?" for _ in tasks),
                [row["id"] for row in tasks],
            )
        connection.execute("DELETE FROM daily_tasks WHERE source_ref LIKE 'pilot-1448-task-%'")
        minutes = json.loads(COUNCIL_PATH.read_text(encoding="utf-8")).get("minutes") or []
        owners = {
            "admin": "principal",
            "teachers": "vice_education",
            "achievement": "vice_education",
            "excellence": "vice_education",
            "guidance": "counselor",
            "students": "vice_students",
            "activity": "activity",
            "safety": "vice_students",
            "fund": "vice_education",
            "special": "counselor",
        }
        now = datetime.now().replace(microsecond=0).isoformat(sep=" ")
        created = 0
        opened = 0
        for minute in minutes:
            if not str(minute.get("id") or "").startswith("pilot-1448-"):
                continue
            lines = [line.strip() for line in str(minute.get("decisions") or "").splitlines() if line.strip()]
            open_follow = str(minute.get("followIso") or "") == FOLLOW_AFTER_BREAK
            for index, line in enumerate(lines, start=1):
                status = "قيد التنفيذ" if open_follow else "مكتملة"
                due = FOLLOW_AFTER_BREAK if open_follow else minute.get("iso") or ""
                connection.execute(
                    """
                    INSERT INTO daily_tasks (
                        task_date, hijri_date, title, description, source_type, source_ref,
                        owner_role, status, priority, evidence_status, evidence_note,
                        is_auto, is_overridden, due_iso, completed_at, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, 'follow', ?, ?, ?, 'عادي', ?, '', 0, 1, ?, ?, ?, ?)
                    """,
                    (
                        minute.get("iso") or "",
                        minute.get("hijri") or "",
                        line,
                        "مرتبطة بالمحضر " + str(minute.get("id") or ""),
                        f"pilot-1448-task-{minute.get('id')}-{index}",
                        owners.get(minute.get("type") or "", "principal"),
                        status,
                        "ناقص" if open_follow else "غير مطلوب",
                        due,
                        "" if open_follow else (minute.get("iso") or ""),
                        now,
                        now,
                    ),
                )
                created += 1
                opened += 1 if open_follow else 0
        connection.commit()
    finally:
        connection.close()
    print("نسخة", backup)
    print("برامج أُرشفت", len(programs))
    print("مهام تجريبية أُرشفت", len(tasks))
    print("مهام المحاضر", created, "منها قيد التنفيذ", opened)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--tasks", action="store_true")
    parser.add_argument("--anchor-date", default=ANCHOR_DEFAULT)
    args = parser.parse_args()
    if args.tasks:
        plant_linked_tasks()
        return
    if args.anchor_date != ANCHOR_DEFAULT:
        raise SystemExit("السقف المعتمد لهذه المرحلة 2026-11-12. غيّره صراحة في النواة بعد موافقة مستقلة.")
    connection = connect()
    try:
        payload = build(connection)
    finally:
        connection.close()
    if args.apply:
        _apply(payload)
        return
    _print_report(payload)
    if args.preview or args.dry_run:
        diagnosis = next(item for item in payload["minutes"] if item["id"].endswith("2026-09-16"))
        _preview(diagnosis, payload)
        out = ROOT / "backups" / "pilot-dry-run.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        slim = {
            "minutes": payload["minutes"],
            "desks": payload["desks"],
        }
        out.write_text(json.dumps(slim, ensure_ascii=False, indent=2), encoding="utf-8")
        print("النص الكامل:", out)


if __name__ == "__main__":
    main()
