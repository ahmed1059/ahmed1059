# حزمة شواهد المهنة والكادر من الصفوف المحفوظة فقط.
# خانة المتابعة اليومية تبقى فارغة لأن الالتزام لم يُرصد صفًا صفًا.

from __future__ import annotations

import base64
import json
import sqlite3
from datetime import date, timedelta
from pathlib import Path

from hijri_converter import Gregorian

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "School_Data" / "school_1059.db"
SIGNATURES = ROOT / "School_Data" / "signatures"
LOGOS = ROOT / "School_Data" / "assets"
FONTS = ROOT / "Print_Canvas" / "fonts"
OUT = ROOT / "Print_Canvas" / "previews"
COUNCILS = ROOT / "School_Data" / "council_minutes.json"

HIJRI_MONTHS = [
    "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
    "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
]
GREG_MONTHS = [
    "", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]
SEAT_TITLE = {
    "manager": "مدير المدرسة",
    "education_agents": "وكيل الشؤون التعليمية",
    "student_agents": "وكيل شؤون الطلاب",
    "school_affairs_agent": "وكيل الشؤون المدرسية",
    "counselors": "الموجه الطلابي",
    "activity_leader": "رائد النشاط",
    "librarian": "أمين المصادر",
    "lab_tech": "محضر المختبر",
    "safety_supervisor": "مشرف السلامة",
}
COMMITTEES = (
    ("admin", "اللجنة الإدارية"),
    ("guidance", "لجنة التوجيه والإرشاد"),
    ("achievement", "لجنة التحصيل الدراسي"),
    ("excellence", "لجنة التميز"),
    ("fund", "فريق الصندوق المدرسي"),
    ("budget", "لجنة الميزانية التشغيلية"),
    ("safety", "فريق الأمن والسلامة المدرسية"),
    ("activity", "لجنة النشاط والمناسبات"),
    ("discipline", "لجنة الانضباط والتدخل السريع"),
    ("special", "فريق التربية الخاصة"),
)
SEAT_NAME = {"chair": "رئيس", "member": "عضو", "exofficio": "بحكم المنصب"}
SCIENCE = ("علوم", "أحياء", "احياء", "فيزياء", "فيزيا", "كيمياء", "كيميا")
YEAR_START = date(2026, 8, 23)


def data_uri(path: Path) -> str:
    if not path.is_file():
        return ""
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    kind = "png" if path.suffix.lower() == ".png" else "octet-stream"
    return f"data:image/{kind};base64,{encoded}"


def font_uri(name: str) -> str:
    path = FONTS / name
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:font/ttf;base64,{encoded}"


def esc(value) -> str:
    return (
        str(value if value is not None else "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def hijri_label(value: date) -> str:
    converted = Gregorian(value.year, value.month, value.day).to_hijri()
    return f"{converted.day} {HIJRI_MONTHS[converted.month - 1]} {converted.year}هـ"


def greg_label(value: date) -> str:
    return f"{value.day} {GREG_MONTHS[value.month]} {value.year}م"


def both(value: date) -> str:
    return f"{hijri_label(value)} · {greg_label(value)}"


def signature(national_id: str) -> str:
    return data_uri(SIGNATURES / f"sig_{national_id}.png")


def is_science(value: str) -> bool:
    return any(token in (value or "") for token in SCIENCE)


def same_subject(specialty: str, subject: str) -> bool:
    if not specialty or not subject:
        return False
    if is_science(specialty) and is_science(subject):
        return True
    return specialty.strip() == subject.strip()


def load() -> dict:
    connection = sqlite3.connect(DB)
    connection.row_factory = sqlite3.Row
    people = {
        str(row["national_id"]): dict(row)
        for row in connection.execute(
            """
            SELECT national_id, name, specialty, role
            FROM noor_staff
            WHERE COALESCE(is_deleted, 0) = 0
            """
        )
    }
    seats = []
    for row in connection.execute(
        "SELECT role, national_id, sort_order FROM leadership_seat ORDER BY role, sort_order"
    ):
        person = people.get(str(row["national_id"]), {})
        seats.append(
            {
                "key": row["role"],
                "title": SEAT_TITLE.get(row["role"], row["role"]),
                "id": str(row["national_id"]),
                "name": person.get("name") or "",
                "specialty": person.get("specialty") or "",
                "staff_role": person.get("role") or "",
            }
        )
    committees: dict[str, list] = {key: [] for key, _title in COMMITTEES}
    for row in connection.execute(
        "SELECT committee_id, national_id, seat, sort_order FROM committee_seat ORDER BY sort_order"
    ):
        person = people.get(str(row["national_id"]), {})
        committees.setdefault(row["committee_id"], []).append(
            {
                "name": person.get("name") or "",
                "seat": SEAT_NAME.get(row["seat"] or "", row["seat"] or ""),
                "id": str(row["national_id"]),
            }
        )
    active = [
        dict(row)
        for row in connection.execute(
            """
            SELECT national_id, name, specialty, role
            FROM noor_staff
            WHERE active = 1 AND COALESCE(is_deleted, 0) = 0
            ORDER BY role, name
            """
        )
    ]
    loads: dict[str, dict[str, int]] = {}
    for row in connection.execute(
        """
        SELECT staff_id, subject, COUNT(*) AS total
        FROM nafes_timetable
        WHERE COALESCE(is_deleted, 0) = 0 AND staff_id IS NOT NULL AND staff_id != ''
        GROUP BY staff_id, subject
        """
    ):
        loads.setdefault(str(row["staff_id"]), {})[row["subject"] or ""] = int(row["total"])
    licenses = [dict(row) for row in connection.execute(
        """
        SELECT person_name, national_id, license_no, level_name, major, expires_on
        FROM witness_license_rows
        ORDER BY person_name
        """
    )]
    marks = {}
    try:
        for row in connection.execute(
            "SELECT national_id, day_iso, mark FROM indicator_follow_marks"
        ):
            marks[(str(row["national_id"]), str(row["day_iso"]))] = row["mark"] or ""
    except sqlite3.OperationalError:
        marks = {}
    connection.close()
    minutes = []
    if COUNCILS.is_file():
        payload = json.loads(COUNCILS.read_text(encoding="utf-8"))
        minutes = payload.get("minutes") or []
    return {
        "seats": seats,
        "committees": committees,
        "active": active,
        "loads": loads,
        "licenses": licenses,
        "minutes": minutes,
        "people": people,
        "marks": marks,
    }


def by_key(seats: list[dict], key: str) -> list[dict]:
    return [item for item in seats if item["key"] == key]


def person_line(items: list[dict]) -> str:
    return "، ".join(item["name"] for item in items if item["name"])


def header() -> str:
    ministry = data_uri(LOGOS / "ministry_logo.png")
    vision = data_uri(LOGOS / "vision_2030.png")
    return (
        '<header class="doc-official-header">'
        f'<div><img src="{ministry}" alt="وزارة التعليم"></div>'
        '<div class="header-center-titles">'
        "<div>المملكة العربية السعودية</div><div>وزارة التعليم</div>"
        "<div>الإدارة العامة للتعليم بمنطقة المدينة المنورة</div>"
        '<div class="school-name-title">متوسطة سعد بن الربيع الأنصاري</div>'
        "</div>"
        f'<div><img src="{vision}" alt="رؤية 2030"></div>'
        '</header><div class="header-divider-bar"></div>'
    )


def sign_image(source: str) -> str:
    if not source:
        return ""
    return f'<img class="sig-image" src="{source}" alt="">'


def signoff(columns: list[dict], page: int, total: int) -> str:
    cells = []
    for column in columns:
        cells.append(
            '<div class="signoff-col">'
            f'<span class="role-title">{esc(column["title"])}</span>'
            f'<div class="sig-placeholder">{sign_image(column["signature"])}</div>'
            f'<span class="person-name">{esc(column["name"])}</span>'
            "</div>"
        )
    return (
        '<footer class="doc-signoff-block"><div class="signoff-title-bar">اعتماد الوثيقة</div>'
        f'<div class="signoff-grid cols-{len(columns)}">{"".join(cells)}</div>'
        '<div class="doc-bottom-bar"><span>متوسطة سعد بن الربيع الأنصاري</span>'
        f"<span>الصفحة {page} من {total}</span></div></footer>"
    )


def pagebar(page: int, total: int) -> str:
    return (
        '<footer class="doc-pagebar"><span>حزمة شواهد المهنة والكادر</span>'
        f"<span>الصفحة {page} من {total}</span></footer>"
    )


def frame(title: str, body: str, foot: str) -> str:
    kind = "official-document-frame is-cover" if title.startswith("غلاف") else "official-document-frame"
    return (
        f'<article class="{kind}">'
        + header()
        + f'<div class="doc-official-body"><h1 class="doc-official-title">{esc(title.removeprefix("غلاف "))}</h1>{body}</div>'
        + foot
        + "</article>"
    )


def table(headers: list[str], rows: list[str]) -> str:
    head = "".join(f"<th>{esc(name)}</th>" for name in headers)
    return f'<table class="reg-table"><thead><tr>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table>'


def chunks(items: list, size: int) -> list[list]:
    return [items[index : index + size] for index in range(0, len(items), size)] or [[]]


def signer(seats: list[dict], key: str, title: str) -> dict:
    found = by_key(seats, key)
    person = found[0] if found else {"name": "", "id": ""}
    return {"title": title, "name": person["name"], "signature": signature(person["id"])}


def build(book: dict) -> list[tuple[str, str, list[dict]]]:
    seats = book["seats"]
    principal = signer(seats, "manager", "مدير المدرسة")
    education = signer(seats, "education_agents", "وكيل الشؤون التعليمية")
    students = signer(seats, "student_agents", "وكيل شؤون الطلاب")
    activity = signer(seats, "activity_leader", "رائد النشاط")
    guidance = book["committees"].get("guidance", [])
    teachers = [item for item in book["active"] if str(item["role"]).startswith("معلم")]
    admins = [item for item in book["active"] if not str(item["role"]).startswith("معلم")]
    trio = [principal, education, students]
    documents: list[tuple[str, str, list[dict]]] = []
    window = [
        item for item in book["minutes"]
        if "2026-08-11" <= str(item.get("iso") or "") <= "2026-11-04"
    ]

    guidance_rows = []
    for index, member in enumerate(guidance, 1):
        guidance_rows.append(
            f"<tr><td>{index}</td><td>{esc(member['name'])}</td><td>{esc(member['seat'])}</td></tr>"
        )
    charter = (
        f'<p class="reg-meta">المؤشر 1-2-1-2 · مجال الإدارة المدرسية · {both(YEAR_START)}</p>'
        '<p class="reg-note">تلتزم المدرسة بقيم مهنة التعليم وأخلاقياتها. '
        f"التعميم على {len(teachers)} معلمًا و{len(admins)} إداريين، وتوثيقه في لجنة التوجيه والإرشاد.</p>"
        + table(["م", "عضو لجنة التوجيه والإرشاد", "الصفة"], guidance_rows)
    )
    documents.append(("برنامج ميثاق أخلاقيات مهنة التعليم", charter, trio))
    circulate_rows = []
    for index, person in enumerate(admins + teachers, 1):
        circulate_rows.append(
            f"<tr><td>{index}</td><td>{esc(person['name'])}</td><td>{esc(person['role'])}</td><td>{esc(person['specialty'])}</td></tr>"
        )
    documents.append((
        "التعميم على المعلمين والإداريين",
        f'<p class="reg-meta">المؤشر 1-2-1-2 · المنسوبون النشطون {len(book["active"])}</p>'
        + table(["م", "الاسم", "العمل", "التخصص"], circulate_rows),
        trio,
    ))
    documents.append((
        "محاضر التوجيه المرتبطة بالميثاق",
        f'<p class="reg-meta">من 28 صفر 1448هـ حتى 24 جمادى الأولى 1448هـ</p>'
        + minute_table([item for item in window if item.get("type") in {"guidance", "teachers", "admin"}]),
        trio,
    ))

    days = [YEAR_START + timedelta(days=offset) for offset in range(5)]
    day_headers = ["م", "الاسم", "العمل"] + [hijri_label(day) for day in days]
    follow_rows = []
    for index, person in enumerate(book["active"], 1):
        cells = "".join(
            f"<td>{esc(book['marks'].get((str(person['national_id']), day.isoformat()), ''))}</td>"
            for day in days
        )
        follow_rows.append(
            f"<tr><td>{index}</td><td>{esc(person['name'])}</td><td>{esc(person['role'])}</td>{cells}</tr>"
        )
    follow = (
        f'<p class="reg-meta">المؤشر 1-2-1-2 · الأسبوع الدراسي الأول · {both(YEAR_START)}</p>'
        + table(day_headers, follow_rows)
    )
    documents.append(("سجل المتابعة اليومية للالتزام المهني والقدوة الحسنة", follow, trio))

    task_rows = []
    for index, seat in enumerate(seats, 1):
        task_rows.append(
            "<tr>"
            f"<td>{index}</td><td>{esc(seat['title'])}</td><td>{esc(seat['name'])}</td>"
            f"<td>{esc(seat['staff_role'])}</td><td>{esc(seat['specialty'])}</td>"
            "</tr>"
        )
    tasks = (
        f'<p class="reg-meta">المؤشر 1-4-1-2 · مجال الإدارة المدرسية · {both(date(2026, 8, 11))}</p>'
        '<p class="reg-note">المقاعد العشرة من التشكيل المحفوظ، ومسماها هو وصف المهمة.</p>'
        + table(["م", "المهمة", "الاسم", "العمل في بطاقة المنسوب", "التخصص"], task_rows)
    )
    documents.append(("سجل توزيع المهام الإدارية", tasks, trio))

    cover_rows = []
    for key, title in COMMITTEES:
        members = book["committees"].get(key, [])
        names = "، ".join(
            f"{item['name']}" + (f" ({item['seat']})" if item["seat"] else "")
            for item in members if item["name"]
        )
        cover_rows.append(f"<tr><td>{esc(title)}</td><td>{len(members)}</td><td>{esc(names)}</td></tr>")
    coverage = (
        '<p class="reg-meta">المؤشر 1-4-1-2 · التشكيل المسجل '
        f'{both(date(2026, 11, 12))} · التغطية من {both(YEAR_START)}</p>'
        + table(["التشكيل", "العدد", "الأعضاء والصفة"], cover_rows)
    )
    documents.append(("خطة تغطية التشكيلات الإدارية وتوزيع المسؤوليات", coverage, trio))
    documents.append((
        "محضر اعتماد التشكيل",
        '<p class="reg-meta">المؤشر 1-4-1-2 · اللجنة الإدارية · 28 صفر 1448هـ</p>'
        + minute_table([item for item in window if item.get("iso") == "2026-08-11"]),
        trio,
    ))

    load_rows = []
    for index, person in enumerate(teachers, 1):
        subjects = book["loads"].get(str(person["national_id"]), {})
        filled = {name: count for name, count in subjects.items() if name and "تطوير مهني" not in name}
        total = sum(subjects.values())
        odd = [name for name in filled if not same_subject(person["specialty"] or "", name)]
        if not filled:
            match = ""
        elif odd:
            match = "غير مطابق: " + "، ".join(odd)
        else:
            match = "مطابق"
        shown = "، ".join(f"{name} ({count})" for name, count in filled.items()) if filled else ""
        load_rows.append(
            "<tr>"
            f"<td>{index}</td><td>{esc(person['name'])}</td><td>{esc(person['specialty'])}</td>"
            f"<td>{total or ''}</td><td>{esc(shown)}</td><td>{esc(match)}</td>"
            "</tr>"
        )
    loads_body = (
        f'<p class="reg-meta">المؤشر 1-4-1-1 · مجال الإدارة المدرسية · {both(YEAR_START)}</p>'
        '<p class="reg-note">الحصص من الجدول المحفوظ. مادة الحصة غير مكتوبة، وصف تطوير مهني لا يُحتسب مادة تدريس، فتبقى خانة التطابق فارغة.</p>'
        + table(["م", "المعلم", "التخصص", "الحصص", "المواد في الجدول", "التطابق"], load_rows)
    )
    documents.append(("سجل التشكيلات المدرسية والأنصبة وتطابق المؤهلات", loads_body, trio))

    license_by_id = {str(row["national_id"]): row for row in book["licenses"]}
    cadre_rows = []
    for index, person in enumerate(book["active"], 1):
        lic = license_by_id.get(str(person["national_id"]), {})
        cadre_rows.append(
            "<tr>"
            f"<td>{index}</td><td>{esc(person['name'])}</td><td>{esc(person['role'])}</td>"
            f"<td>{esc(person['specialty'])}</td><td>{esc(lic.get('license_no', ''))}</td>"
            f"<td>{esc(lic.get('level_name', ''))}</td><td>{esc(lic.get('major', ''))}</td>"
            f"<td>{esc(lic.get('expires_on', ''))}</td>"
            "</tr>"
        )
    cadre = (
        f'<p class="reg-meta">المؤشر 1-4-1-1 · الرخص المحفوظة {len(book["licenses"])} من {len(book["active"])} · {both(YEAR_START)}</p>'
        + table(
            ["م", "الاسم", "العمل", "التخصص", "رقم الرخصة", "المستوى", "التخصص في الرخصة", "الانتهاء"],
            cadre_rows,
        )
    )
    documents.append(("تقرير تسكين الكادر التعليمي", cadre, trio))

    positive_types = {"guidance", "activity", "students", "admin"}
    positive = (
        f'<p class="reg-meta">المؤشر 1-3-1-1 · مجال الإدارة المدرسية · {both(YEAR_START)}</p>'
        '<p class="reg-note">تعزز المدرسة بناء العلاقات الإيجابية والتعاون في المجتمع المدرسي. '
        f"رائد النشاط: {esc(activity['name'])}. الموجهون: {esc(person_line(by_key(seats, 'counselors')))}.</p>"
        + minute_table([item for item in window if item.get("type") in positive_types])
    )
    documents.append(('برنامج «بيئتنا الإيجابية»', positive, trio))

    councils = (
        '<p class="reg-meta">المؤشر 1-3-1-1 · المحاضر من 28 صفر حتى 24 جمادى الأولى 1448هـ</p>'
        + minute_table(window)
    )
    documents.append(("تقرير الشراكة الداخلية وتفعيل المجالس المدرسية", councils, trio))
    return documents


def minute_table(items: list[dict]) -> str:
    labels = {key: title for key, title in COMMITTEES}
    labels.update({"teachers": "مجلس المعلمين", "students": "مجلس الطلاب"})
    rows = []
    for index, item in enumerate(items, 1):
        present = "، ".join(person.get("name") or "" for person in item.get("present") or [])
        rows.append(
            "<tr>"
            f"<td>{index}</td><td>{esc(labels.get(item.get('type'), item.get('type') or ''))}</td>"
            f"<td>{esc(item.get('hijri') or '')}<div class=\"reg-detail\">{esc(item.get('gregorian') or '')}</div></td>"
            f"<td>{esc(item.get('agenda') or '')}</td><td>{esc(present)}</td>"
            "</tr>"
        )
    return table(["م", "المجلس", "التاريخ", "جدول الأعمال", "الحضور"], rows)


def pages_of(documents: list[tuple[str, str, list[dict]]]) -> list[tuple[str, str, list[dict], bool]]:
    packed: list[tuple[str, str, list[dict], bool]] = []
    limits = {
        "التعميم على المعلمين والإداريين": 16,
        "سجل المتابعة اليومية للالتزام المهني والقدوة الحسنة": 18,
        "سجل التشكيلات المدرسية والأنصبة وتطابق المؤهلات": 14,
        "تقرير تسكين الكادر التعليمي": 12,
        "محاضر التوجيه المرتبطة بالميثاق": 6,
        'برنامج «بيئتنا الإيجابية»': 6,
        "تقرير الشراكة الداخلية وتفعيل المجالس المدرسية": 6,
    }
    for title, body, signs in documents:
        limit = limits.get(title)
        if not limit or "<tbody>" not in body:
            packed.append((title, body, signs, False))
            continue
        start = body.find("<tbody>")
        end = body.find("</tbody>")
        pre, inner, post = body[:start], body[start + len("<tbody>") : end], body[end + len("</tbody>") :]
        rows = [row + "</tr>" for row in inner.split("</tr>") if "<tr>" in row]
        for index, group in enumerate(chunks(rows, limit)):
            piece = pre + "<tbody>" + "".join(group) + "</tbody>" + post
            packed.append((title, piece if index == 0 else table_only(piece), signs, index > 0))
    return packed


def table_only(piece: str) -> str:
    start = piece.find("<table")
    return piece[start:] if start >= 0 else piece


def render(packed: list, page_title: str) -> str:
    total = len(packed)
    parts = []
    for number, (title, body, signs, continued) in enumerate(packed, 1):
        foot = signoff(signs, number, total) if signs and number == _last_of(packed, title) else pagebar(number, total)
        shown = title + (" (تابع)" if continued else "")
        parts.append(frame(shown, body, foot))
    style = STYLE.replace("__REG__", font_uri("Tajawal-Regular.ttf")).replace("__BOLD__", font_uri("Tajawal-Bold.ttf"))
    return (
        "<!DOCTYPE html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\">"
        f"<title>{esc(page_title)}</title>"
        f"<style>{style}</style></head><body>{''.join(parts)}</body></html>"
    )


def charter_pages(book: dict) -> list[tuple]:
    seats = book["seats"]
    trio = [
        signer(seats, "manager", "مدير المدرسة"),
        signer(seats, "education_agents", "وكيل الشؤون التعليمية"),
        signer(seats, "student_agents", "وكيل شؤون الطلاب"),
    ]
    teachers = [item for item in book["active"] if str(item["role"]).startswith("معلم")]
    admins = [item for item in book["active"] if not str(item["role"]).startswith("معلم")]
    window = [
        item for item in book["minutes"]
        if "2026-08-11" <= str(item.get("iso") or "") <= "2026-11-04"
        and item.get("type") in {"guidance", "teachers", "admin"}
    ]
    people = admins + teachers
    pages: list[tuple] = []
    pages.append((
        "غلاف ملف برنامج ميثاق أخلاقيات مهنة التعليم",
        '<p class="reg-meta">شواهد وأدلة التقويم والاعتماد المدرسي</p>'
        '<p class="reg-meta">المجال 1 · الإدارة المدرسية</p>'
        '<p class="reg-meta">المؤشر 1-2-1-2 · قيم مهنة التعليم وأخلاقياتها</p>'
        '<p class="reg-meta">وتوثيق الالتزام المهني والقدوة الحسنة</p>'
        '<p class="reg-meta">العام الدراسي 1448-1449هـ · الفصل الأول</p>'
        '<p class="reg-meta">الرقم الإحصائي S-40341</p>'
        f'<p class="reg-note">إعداد وتوثيق: لجنة التوجيه والإرشاد. المستهدفون: {len(teachers)} معلمًا و{len(admins)} إداريين.</p>',
        trio,
        False,
    ))
    pages.append((
        "مقدمة البرنامج",
        '<p class="reg-note">أُعد هذا الملف في متوسطة سعد بن الربيع الأنصاري لترسيخ قيم مهنة التعليم وأخلاقياتها '
        "بين الهيئة التعليمية والهيئة الإدارية، ومتابعة الالتزام بها. المنطلق: معايير التقويم والاعتماد المدرسي، "
        "والأدلة التنظيمية لمدارس التعليم العام، ورؤية المملكة 2030.</p>",
        [],
        False,
    ))
    pages.append((
        "بطاقة المؤشر 1-2-1-2",
        table(
            ["البند", "البيان"],
            [
                "<tr><td>المجال</td><td>الإدارة المدرسية</td></tr>",
                "<tr><td>رقم المؤشر</td><td>1-2-1-2</td></tr>",
                "<tr><td>نص المؤشر</td><td>تلتزم المدرسة بقيم مهنة التعليم وأخلاقياتها.</td></tr>",
                "<tr><td>الهدف</td><td>متابعة التزام المعلمين والإداريين بقيم المهنة.</td></tr>",
                f"<tr><td>الفئة</td><td>{len(teachers)} معلمًا و{len(admins)} إداريين.</td></tr>",
            ],
        ),
        [],
        False,
    ))
    pages.append((
        "خطة تفعيل الميثاق",
        table(
            ["المرحلة", "الإجراء", "التاريخ"],
            [
                f"<tr><td>التهيئة</td><td>اعتماد التشكيل في اللجنة الإدارية</td><td>{both(date(2026, 8, 11))}</td></tr>",
                f"<tr><td>التعميم</td><td>توزيع بيان الميثاق على المنسوبين النشطين</td><td>{both(YEAR_START)}</td></tr>",
                f"<tr><td>المتابعة</td><td>فتح سجل الالتزام للأسبوع الدراسي الأول</td><td>{both(YEAR_START)}</td></tr>",
                "<tr><td>التقييم</td><td>محضر لجنة التوجيه في 17 جمادى الأولى 1448هـ</td><td>17 جمادى الأولى 1448هـ</td></tr>",
            ],
        ),
        [],
        False,
    ))
    committee_rows = []
    for index, member in enumerate(book["committees"].get("guidance", []), 1):
        committee_rows.append(
            "<tr>"
            f"<td>{index}</td><td>{esc(member['name'])}</td><td>{esc(member['seat'])}</td>"
            f"<td>{sign_image(signature(member['id']))}</td></tr>"
        )
    pages.append((
        "لجنة التوجيه والإرشاد",
        table(["م", "الاسم", "الصفة", "التوقيع"], committee_rows),
        [],
        False,
    ))
    circulate = []
    for index, person in enumerate(people, 1):
        circulate.append(
            f"<tr><td>{index}</td><td>{esc(person['name'])}</td><td>{esc(person['role'])}</td><td>{esc(person['specialty'])}</td></tr>"
        )
    for index, group in enumerate(chunks(circulate, 16)):
        pages.append((
            "التعميم على المعلمين والإداريين",
            table(["م", "الاسم", "العمل", "التخصص"], group),
            [],
            index > 0,
        ))
    days = [YEAR_START + timedelta(days=offset) for offset in range(5)]
    day_headers = ["م", "الاسم", "العمل"] + [hijri_label(day) for day in days]
    follow = []
    for index, person in enumerate(people, 1):
        cells = "".join(
            f"<td>{esc(book['marks'].get((str(person['national_id']), day.isoformat()), ''))}</td>"
            for day in days
        )
        follow.append(f"<tr><td>{index}</td><td>{esc(person['name'])}</td><td>{esc(person['role'])}</td>{cells}</tr>")
    for index, group in enumerate(chunks(follow, 16)):
        pages.append((
            "سجل المتابعة اليومية للالتزام المهني",
            (f'<p class="reg-meta">الأسبوع الأول · {both(YEAR_START)}</p>' if index == 0 else "")
            + table(day_headers, group),
            [],
            index > 0,
        ))
    pages.append((
        "الشواهد الإجرائية",
        '<p class="reg-meta">محاضر التوجيه ومجلس المعلمين واعتماد الانطلاقة، من 28 صفر حتى 24 جمادى الأولى 1448هـ</p>'
        + minute_table(window),
        [],
        False,
    ))
    pages.append((
        "اعتماد الملف",
        '<p class="reg-note">يجمع هذا الملف تشكيل لجنة التوجيه، وأسماء المنسوبين النشطين، '
        "ومحاضر الفترة من 28 صفر حتى 24 جمادى الأولى 1448هـ.</p>",
        trio,
        False,
    ))
    return with_index(pages)


def with_index(pages: list[tuple]) -> list[tuple]:
    labels = []
    seen = set()
    for number, item in enumerate(pages, 1):
        if item[0] in seen:
            continue
        seen.add(item[0])
        shown = 1 if number == 1 else number + 1
        labels.append(
            f"<tr><td>{len(labels) + 1}</td><td>{esc(item[0].removeprefix('غلاف '))}</td><td>{shown}</td></tr>"
        )
    index = ("فهرس الملف", table(["م", "المحتوى", "الصفحة"], labels), [], False)
    return [pages[0], index, *pages[1:]]


def window_minutes(book: dict) -> list[dict]:
    items = [
        item for item in book["minutes"]
        if "2026-08-11" <= str(item.get("iso") or "") <= "2026-11-04"
    ]
    return sorted(items, key=lambda item: str(item.get("iso") or ""))


def add_table(pages: list[tuple], title: str, headers: list[str], rows: list[str], size: int, lead: str = "") -> None:
    groups = chunks(rows, size) or [[]]
    for index, group in enumerate(groups):
        pages.append((title, (lead if index == 0 else "") + table(headers, group), [], index > 0))


def add_minutes(pages: list[tuple], title: str, items: list[dict], lead: str, size: int = 4) -> None:
    groups = chunks(items, size) or [[]]
    for index, group in enumerate(groups):
        pages.append((title, (lead if index == 0 else "") + minute_table(group), [], index > 0))


def positive_pages(book: dict) -> list[tuple]:
    trio = [
        signer(book["seats"], "manager", "مدير المدرسة"),
        signer(book["seats"], "education_agents", "وكيل الشؤون التعليمية"),
        signer(book["seats"], "student_agents", "وكيل شؤون الطلاب"),
    ]
    activity = signer(book["seats"], "activity_leader", "رائد النشاط")
    counselors = by_key(book["seats"], "counselors")
    window = window_minutes(book)
    named = [item for item in window if item.get("iso") in {"2026-09-09", "2026-10-21", "2026-11-04"}]
    pages: list[tuple] = [(
        "غلاف ملف برنامج بيئتنا الإيجابية وتوثيق الشراكة الداخلية",
        '<p class="reg-meta">شواهد وأدلة التقويم والاعتماد المدرسي</p>'
        '<p class="reg-meta">المجال 1 · الإدارة المدرسية</p>'
        '<p class="reg-meta">المؤشر 1-3-1-1 · العلاقات الإيجابية والشراكة</p>'
        '<p class="reg-meta">وتفعيل المجالس ومحاضر الاجتماعات المدرسية</p>'
        '<p class="reg-meta">العام الدراسي 1448-1449هـ · الفصل الأول</p>'
        '<p class="reg-meta">الرقم الإحصائي S-40341</p>'
        '<p class="reg-note">إعداد وتوثيق: إدارة المدرسة ورائد النشاط واللجان المدرسية. '
        "المستهدفون: القيادة والمعلمون والإداريون والطلاب.</p>",
        trio,
        False,
    ), (
        "بطاقة المؤشر 1-3-1-1",
        table(
            ["البند", "البيان"],
            [
                "<tr><td>المجال</td><td>الإدارة المدرسية</td></tr>",
                "<tr><td>المعيار</td><td>المجتمع المدرسي</td></tr>",
                "<tr><td>رقم المؤشر</td><td>1-3-1-1</td></tr>",
                "<tr><td>نص المؤشر</td><td>تعزز المدرسة بناء العلاقات الإيجابية والتعاون في المجتمع المدرسي.</td></tr>",
                "<tr><td>النطاق</td><td>المجتمع الداخلي: القيادة والمعلمون والطلاب.</td></tr>",
            ],
        ),
        [],
        False,
    )]
    role_rows = [f"<tr><td>رائد النشاط</td><td>{esc(activity['name'])}</td></tr>"]
    role_rows.extend(f"<tr><td>موجه طلابي</td><td>{esc(person['name'])}</td></tr>" for person in counselors)
    pages.append((
        "إطار برنامج بيئتنا الإيجابية",
        table(["الصفة", "الاسم"], role_rows),
        [],
        False,
    ))
    add_minutes(
        pages,
        "اللقاءات الموثقة",
        named,
        "اللقاءات من المحاضر المحفوظة في الفصل الأول.",
    )
    add_minutes(
        pages,
        "الشراكة الداخلية وتفعيل المجالس",
        window,
        "المحاضر المحفوظة من 28 صفر حتى 24 جمادى الأولى 1448هـ.",
    )
    pages.append((
        "اعتماد الملف",
        '<p class="reg-note">يجمع هذا الملف إطار البرنامج واللقاءات الثلاثة ومحاضر المجالس في الفترة نفسها.</p>',
        trio,
        False,
    ))
    return with_index(pages)


def qualifications_pages(book: dict) -> list[tuple]:
    trio = [
        signer(book["seats"], "manager", "مدير المدرسة"),
        signer(book["seats"], "education_agents", "وكيل الشؤون التعليمية"),
        signer(book["seats"], "student_agents", "وكيل شؤون الطلاب"),
    ]
    teachers = [item for item in book["active"] if str(item["role"]).startswith("معلم")]
    license_by_id = {str(row["national_id"]): row for row in book["licenses"]}
    pages: list[tuple] = [(
        "غلاف سجل التشكيلات المدرسية والأنصبة وتطابق المؤهلات",
        '<p class="reg-meta">شواهد وأدلة التقويم والاعتماد المدرسي</p>'
        '<p class="reg-meta">المجال 1 · الإدارة المدرسية</p>'
        '<p class="reg-meta">المؤشر 1-4-1-1 · الكادر التعليمي وتطابق المؤهلات</p>'
        '<p class="reg-meta">مع الجداول الدراسية والرخص المحفوظة</p>'
        '<p class="reg-meta">العام الدراسي 1448-1449هـ · الفصل الأول</p>'
        '<p class="reg-meta">الرقم الإحصائي S-40341</p>'
        f'<p class="reg-note">إعداد وتوثيق: إدارة المدرسة والشؤون التعليمية. المعلمون النشطون: {len(teachers)}.</p>',
        trio,
        False,
    ), (
        "بطاقة المؤشر 1-4-1-1",
        table(
            ["البند", "البيان"],
            [
                "<tr><td>المجال</td><td>الإدارة المدرسية</td></tr>",
                "<tr><td>المعيار</td><td>التطوير المؤسسي</td></tr>",
                "<tr><td>رقم المؤشر</td><td>1-4-1-1</td></tr>",
                "<tr><td>نص المؤشر</td><td>توفر المدرسة كادرًا تعليميًّا مكتملاً ومؤهلاً بما يتسق مع المهام الموكلة له.</td></tr>",
                f"<tr><td>الكادر</td><td>{len(teachers)} معلمًا نشطًا، والتطابق يُقرأ من الجدول المحفوظ.</td></tr>",
            ],
        ),
        [],
        False,
    )]
    seat_rows = []
    for index, seat in enumerate(book["seats"], 1):
        seat_rows.append(
            f"<tr><td>{index}</td><td>{esc(seat['title'])}</td><td>{esc(seat['name'])}</td><td>{esc(seat['specialty'])}</td></tr>"
        )
    pages.append(("مقاعد القيادة", table(["م", "المهمة", "الاسم", "التخصص"], seat_rows), [], False))
    load_rows = []
    for index, person in enumerate(teachers, 1):
        subjects = book["loads"].get(str(person["national_id"]), {})
        filled = {name: count for name, count in subjects.items() if name and "تطوير مهني" not in name}
        total = sum(subjects.values())
        odd = [name for name in filled if not same_subject(person["specialty"] or "", name)]
        if not filled:
            match = ""
        elif odd:
            match = "غير مطابق: " + "، ".join(odd)
        else:
            match = "مطابق"
        shown = "، ".join(f"{name} ({count})" for name, count in filled.items()) if filled else ""
        load_rows.append(
            "<tr>"
            f"<td>{index}</td><td>{esc(person['name'])}</td><td>{esc(person['specialty'])}</td>"
            f"<td>{total or ''}</td><td>{esc(shown)}</td><td>{esc(match)}</td></tr>"
        )
    add_table(
        pages,
        "تطابق التخصص مع الجدول",
        ["م", "المعلم", "التخصص", "الحصص", "المواد في الجدول", "التطابق"],
        load_rows,
        12,
        "<p class=\"reg-note\">الحصص من الجدول المحفوظ. مادة الحصة غير مكتوبة، وصف تطوير مهني لا يُحتسب مادة تدريس.</p>",
    )
    license_rows = []
    for person in book["active"]:
        lic = license_by_id.get(str(person["national_id"]))
        if not lic:
            continue
        license_rows.append(
            "<tr>"
            f"<td>{len(license_rows) + 1}</td><td>{esc(person['name'])}</td><td>{esc(person['role'])}</td>"
            f"<td>{esc(lic.get('license_no') or '')}</td><td>{esc(lic.get('level_name') or '')}</td>"
            f"<td>{esc(lic.get('major') or '')}</td><td>{esc(lic.get('expires_on') or '')}</td></tr>"
        )
    add_table(
        pages,
        "الرخص المحفوظة",
        ["م", "الاسم", "العمل", "رقم الرخصة", "المستوى", "التخصص في الرخصة", "الانتهاء"],
        license_rows,
        12,
        f'<p class="reg-meta">الرخص ذات الصف المحفوظ: {len(license_rows)}.</p>',
    )
    pages.append((
        "اعتماد الملف",
        '<p class="reg-note">يجمع هذا الملف مقاعد القيادة، وتطابق تخصص المعلمين مع الجدول، والرخص ذات الصف المحفوظ.</p>',
        trio,
        False,
    ))
    return with_index(pages)


def coverage_pages(book: dict) -> list[tuple]:
    trio = [
        signer(book["seats"], "manager", "مدير المدرسة"),
        signer(book["seats"], "education_agents", "وكيل الشؤون التعليمية"),
        signer(book["seats"], "student_agents", "وكيل شؤون الطلاب"),
    ]
    admins = [item for item in book["active"] if not str(item["role"]).startswith("معلم")]
    pages: list[tuple] = [(
        "غلاف خطة تغطية التشكيلات الإدارية وتوزيع المسؤوليات",
        '<p class="reg-meta">شواهد وأدلة التقويم والاعتماد المدرسي</p>'
        '<p class="reg-meta">المجال 1 · الإدارة المدرسية</p>'
        '<p class="reg-meta">المؤشر 1-4-1-2 · الكادر الإداري وتوزيع المسؤوليات</p>'
        '<p class="reg-meta">تشكيل اللجان المدرسية والفرق التنفيذية والإشرافية</p>'
        '<p class="reg-meta">العام الدراسي 1448-1449هـ · الفصل الأول</p>'
        '<p class="reg-meta">الرقم الإحصائي S-40341</p>'
        f'<p class="reg-note">إعداد وتوثيق: الإدارة المدرسية. الإداريون النشطون: {len(admins)}. '
        f"التشكيلات المحفوظة: {len(COMMITTEES)}.</p>",
        trio,
        False,
    ), (
        "بطاقة المؤشر 1-4-1-2",
        table(
            ["البند", "البيان"],
            [
                "<tr><td>المجال</td><td>الإدارة المدرسية</td></tr>",
                "<tr><td>المعيار</td><td>التطوير المؤسسي</td></tr>",
                "<tr><td>رقم المؤشر</td><td>1-4-1-2</td></tr>",
                "<tr><td>نص المؤشر</td><td>توفر المدرسة كادرًا إداريًّا مكتملاً ومؤهلاً بما يتسق مع المهام الموكلة له.</td></tr>",
                f"<tr><td>التغطية</td><td>{len(admins)} إداريين نشطين، و{len(book['seats'])} مقاعد محفوظة.</td></tr>",
            ],
        ),
        [],
        False,
    )]
    seat_rows = []
    for index, seat in enumerate(book["seats"], 1):
        seat_rows.append(
            f"<tr><td>{index}</td><td>{esc(seat['title'])}</td><td>{esc(seat['name'])}</td><td>{esc(seat['specialty'])}</td></tr>"
        )
    pages.append((
        "توزيع المهام",
        f'<p class="reg-meta">اعتماد التشكيل · {both(date(2026, 8, 11))}</p>'
        + table(["م", "المهمة", "الاسم", "التخصص"], seat_rows),
        [],
        False,
    ))
    committee_rows = []
    for _key, title in COMMITTEES:
        members = book["committees"].get(_key, [])
        names = "، ".join(
            f"{item['name']}" + (f" ({item['seat']})" if item["seat"] else "")
            for item in members if item["name"]
        )
        committee_rows.append(f"<tr><td>{esc(title)}</td><td>{len(members)}</td><td>{esc(names)}</td></tr>")
    add_table(pages, "اللجان والفرق", ["التشكيل", "العدد", "الأعضاء والصفة"], committee_rows, 4)
    adoption = [item for item in window_minutes(book) if item.get("iso") == "2026-08-11"]
    add_minutes(pages, "محضر اعتماد التشكيل", adoption, "اللجنة الإدارية · 28 صفر 1448هـ.")
    pages.append((
        "اعتماد الملف",
        '<p class="reg-note">يجمع هذا الملف المقاعد العشرة، واللجان المحفوظة، ومحضر اعتماد الانطلاقة.</p>',
        trio,
        False,
    ))
    return with_index(pages)


FILES = {
    "شواهد_1-2-1-2_ميثاق_المهنة.html": {
        "برنامج ميثاق أخلاقيات مهنة التعليم",
        "التعميم على المعلمين والإداريين",
        "محاضر التوجيه المرتبطة بالميثاق",
    },
    "شواهد_1-3-1-1_بيئتنا_الإيجابية.html": {
        "برنامج «بيئتنا الإيجابية»",
        "تقرير الشراكة الداخلية وتفعيل المجالس المدرسية",
    },
    "شواهد_1-4-1-1_التشكيلات_والمؤهلات.html": {
        "سجل التشكيلات المدرسية والأنصبة وتطابق المؤهلات",
        "تقرير تسكين الكادر التعليمي",
    },
    "شواهد_1-4-1-2_تغطية_التشكيلات.html": {
        "سجل توزيع المهام الإدارية",
        "خطة تغطية التشكيلات الإدارية وتوزيع المسؤوليات",
        "محضر اعتماد التشكيل",
    },
}


def _last_of(packed, title: str) -> int:
    last = 1
    for number, item in enumerate(packed, 1):
        if item[0] == title:
            last = number
    return last


STYLE = """
@font-face { font-family: Tajawal; src: url("__REG__") format("truetype"); font-weight: 400; }
@font-face { font-family: Tajawal; src: url("__BOLD__") format("truetype"); font-weight: 700; }
@page register-a4 { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: Tajawal, sans-serif; color: #1c2b28; font-size: 12px; }
.official-document-frame {
  page: register-a4; width: 210mm; height: 297mm; padding: 12mm 15mm 10mm; margin: 0;
  border: 2px solid #005a53; display: flex; flex-direction: column; overflow: hidden;
  break-after: page; page-break-after: always;
}
.official-document-frame:last-child { break-after: auto; page-break-after: auto; }
.doc-official-header {
  display: grid; grid-template-columns: 140px 1fr 140px; align-items: center; text-align: center;
  padding-bottom: 4px; border-bottom: 2px solid #005a53;
}
.doc-official-header img { max-height: 52px; max-width: 140px; object-fit: contain; }
.header-center-titles { color: #005a53; font-weight: 700; line-height: 1.3; font-size: 12px; }
.school-name-title { font-size: 15px; }
.header-divider-bar { height: 4px; background: #e8f2f0; border: 1px solid #c5ddd8; margin: 3px 0 6px; }
.doc-official-body { flex: 1; min-height: 0; }
.is-cover .doc-official-body { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.is-cover .doc-official-title { font-size: 22px; width: 100%; }
.is-cover .reg-meta, .is-cover .reg-note { text-align: center; width: 100%; }
.doc-official-title {
  margin: 0 0 6px; text-align: center; color: #0b5e56; font-size: 18px; font-weight: 700;
  border-bottom: 2px solid #0b5e56; padding-bottom: 2px;
}
.reg-meta, .reg-note { font-size: 11px; line-height: 1.45; margin: 3px 0; text-align: center; }
.reg-note { text-align: right; color: #24312e; }
.reg-detail { color: #5c675f; font-size: 9px; }
.reg-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
.reg-table th { background: #E8F5E9; color: #111; font-weight: 700; font-size: 9px; padding: 2px; border: 1px solid #CBD5E1; }
.reg-table td { border: 1px solid #CBD5E1; padding: 1px 3px; font-size: 9px; text-align: center; vertical-align: middle; line-height: 1.25; }
.reg-table tbody tr:nth-child(even) td { background: #F8FAFC; }
.reg-table td:nth-child(2), .reg-table td:last-child { text-align: right; }
.doc-signoff-block { margin-top: auto; border-top: 2px solid #005a53; }
.signoff-title-bar { background: #004d46; color: #fff; text-align: center; font-weight: 700; font-size: 12px; padding: 2px 0; }
.signoff-grid { display: grid; border: 1px solid #005a53; border-top: none; }
.cols-1 { grid-template-columns: 1fr; }
.cols-2 { grid-template-columns: 1fr 1fr; }
.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
.signoff-col { min-height: 22mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 3px; }
.role-title { color: #004d46; font-weight: 700; font-size: 11px; }
.person-name { font-size: 11px; text-align: center; }
.sig-image { max-height: 12mm; max-width: 32mm; object-fit: contain; }
.doc-bottom-bar, .doc-pagebar {
  display: flex; justify-content: space-between; color: #5c675f; font-size: 10px; margin-top: 2px;
}
.doc-pagebar { margin-top: auto; border-top: 1px solid #c5ddd8; padding-top: 2px; }
"""


def main() -> None:
    probe = hijri_label(date(2026, 11, 12))
    if "جمادى الآخرة" not in probe:
        raise SystemExit(probe)
    book = load()
    OUT.mkdir(parents=True, exist_ok=True)
    packed = pages_of(build(book))
    path = OUT / "حزمة_شواهد_المهنة_والكادر.html"
    html = render(packed, "حزمة شواهد المهنة والكادر")
    path.write_text(html, encoding="utf-8")
    for name, titles in FILES.items():
        builders = {
            "شواهد_1-2-1-2_ميثاق_المهنة.html": charter_pages,
            "شواهد_1-3-1-1_بيئتنا_الإيجابية.html": positive_pages,
            "شواهد_1-4-1-1_التشكيلات_والمؤهلات.html": qualifications_pages,
            "شواهد_1-4-1-2_تغطية_التشكيلات.html": coverage_pages,
        }
        subset = builders[name](book) if name in builders else [item for item in packed if item[0] in titles]
        (OUT / name).write_text(render(subset, name), encoding="utf-8")
        print(name, len(subset))
    print(
        f"صفحات {html.count('<article')} | مقاعد {len(book['seats'])} | "
        f"معلمون {sum(1 for item in book['active'] if str(item['role']).startswith('معلم'))} | "
        f"رخص {len(book['licenses'])} | محاضر {len(book['minutes'])} | {path}"
    )


if __name__ == "__main__":
    main()
