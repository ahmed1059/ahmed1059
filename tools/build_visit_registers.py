# يُخرج السجل الرسمي للزيارات الصفية من الصفوف المحفوظة فقط.
# لا يُعاد تصنيف الزيارة، ولا تُملأ خانة بلا قيمة محفوظة.

from __future__ import annotations

import base64
import sqlite3
from datetime import date, timedelta
from pathlib import Path

try:
    from hijri_converter import Gregorian
except ImportError:
    Gregorian = None

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "School_Data" / "school_1059.db"
SIGNATURES = ROOT / "School_Data" / "signatures"
LOGOS = ROOT / "School_Data" / "assets"
FONTS = ROOT / "Print_Canvas" / "fonts"
OUT = ROOT / "Print_Canvas" / "previews"

YEAR_START = date(2026, 8, 23)
AUTUMN_BREAK = date(2026, 11, 20)
NATIONAL_DAY = date(2026, 9, 23)
TODAY = date(2026, 11, 16)

HIJRI_MONTHS = [
    "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
    "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
]
GREG_MONTHS = [
    "", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]
SCIENCE = ("علوم", "أحياء", "احياء", "فيزياء", "فيزيا", "كيمياء", "كيميا")


def data_uri(path: Path) -> str:
    if not path.is_file():
        return ""
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    kind = "png" if path.suffix.lower() == ".png" else "octet-stream"
    return f"data:image/{kind};base64,{encoded}"


def font_uri(name: str) -> str:
    path = FONTS / name
    if not path.is_file():
        return ""
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


def band_name(total: float) -> str:
    if total >= 90:
        return "ممتاز"
    if total >= 75:
        return "متقدم"
    if total >= 60:
        return "متمكن"
    return "بحاجة إلى دعم"


def is_science(value: str) -> bool:
    text = value or ""
    return any(token in text for token in SCIENCE)


def subject_of(subject: str, specialty: str) -> str:
    if subject and not is_science(subject):
        return subject
    if is_science(subject) or (not subject and is_science(specialty)):
        return "العلوم"
    return subject or ""


def signature(national_id: str) -> str:
    return data_uri(SIGNATURES / f"sig_{national_id}.png")


def greg_label(value: date | None) -> str:
    if value is None:
        return ""
    return f"{value.day} {GREG_MONTHS[value.month]} {value.year}م"


def hijri_label(value: date | None) -> str:
    if value is None or Gregorian is None:
        return ""
    converted = Gregorian(value.year, value.month, value.day).to_hijri()
    return f"{converted.day} {HIJRI_MONTHS[converted.month - 1]} {converted.year}هـ"


def date_stack(hijri: str, gregorian: str) -> str:
    if not hijri and not gregorian:
        return ""
    return f"<div>{esc(hijri)}</div><div class=\"reg-detail\">{esc(gregorian)}</div>"


def first_sentence(text: str) -> str:
    compact = " ".join((text or "").split())
    if not compact:
        return ""
    if "." in compact:
        return compact.split(".", 1)[0].strip() + "."
    return compact


def load() -> dict:
    connection = sqlite3.connect(DB)
    connection.row_factory = sqlite3.Row
    visits = []
    rows = connection.execute(
        """
        SELECT v.teacher_id, v.teacher_name, v.visitor_id, v.visitor_name, v.visitor_role,
               v.visit_type, v.subject, v.period_no, v.visit_date, v.visit_date_hijri,
               v.recommendations, v.total, v.band, s.specialty
        FROM classroom_visits v
        LEFT JOIN noor_staff s ON s.national_id = v.teacher_id
        ORDER BY v.visit_date, v.teacher_name
        """
    ).fetchall()
    for row in rows:
        total = float(row["total"] or 0)
        visits.append(
            {
                "teacher_id": str(row["teacher_id"] or ""),
                "teacher": row["teacher_name"] or "",
                "visitor_id": str(row["visitor_id"] or ""),
                "visitor": row["visitor_name"] or "",
                "role": row["visitor_role"] or "",
                "type": row["visit_type"] or "",
                "subject": subject_of(row["subject"] or "", row["specialty"] or ""),
                "specialty": row["specialty"] or "",
                "period": str(row["period_no"] or "").strip(),
                "day": date.fromisoformat(row["visit_date"]) if row["visit_date"] else None,
                "hijri": row["visit_date_hijri"] or "",
                "feedback": first_sentence(row["recommendations"] or ""),
                "total": total,
                "band": band_name(total),
                "signature": signature(str(row["teacher_id"] or "")),
                "visitor_signature": signature(str(row["visitor_id"] or "")),
            }
        )
    teachers = []
    staff_rows = connection.execute(
        """
        SELECT national_id, name, specialty
        FROM noor_staff
        WHERE role LIKE 'معلم%' AND active = 1 AND COALESCE(is_deleted, 0) = 0
        ORDER BY name
        """
    ).fetchall()
    by_teacher: dict[str, list] = {}
    for visit in visits:
        by_teacher.setdefault(visit["teacher_id"], []).append(visit)
    for row in staff_rows:
        identity = str(row["national_id"])
        teachers.append(
            {
                "id": identity,
                "name": row["name"] or "",
                "specialty": row["specialty"] or "",
                "visits": by_teacher.get(identity, []),
            }
        )
    connection.close()
    owners = []
    seen = set()
    for visit in visits:
        if visit["visitor_id"] in seen:
            continue
        seen.add(visit["visitor_id"])
        owners.append(
            {
                "id": visit["visitor_id"],
                "name": visit["visitor"],
                "role": visit["role"],
                "signature": visit["visitor_signature"],
            }
        )
    owners.sort(key=lambda item: 0 if "قائد" in item["role"] or "مدير" in item["role"] else 1)
    return {"visits": visits, "teachers": teachers, "owners": owners}


def weeks() -> list[dict]:
    rows = []
    for number in range(1, 19):
        sunday = YEAR_START + timedelta(days=7 * (number - 1))
        if sunday >= AUTUMN_BREAK:
            rows.append({"n": number, "start": None, "end": None, "note": "", "visits": []})
            continue
        days = []
        for offset in range(5):
            current = sunday + timedelta(days=offset)
            if current == NATIONAL_DAY or current >= AUTUMN_BREAK:
                continue
            days.append(current)
        note = ""
        if sunday <= NATIONAL_DAY <= sunday + timedelta(days=4):
            note = "إجازة اليوم الوطني"
        rows.append(
            {
                "n": number,
                "start": days[0] if days else None,
                "end": days[-1] if days else None,
                "note": note,
                "visits": [],
            }
        )
    return rows


def place(visits: list[dict]) -> list[dict]:
    rows = weeks()
    for visit in visits:
        if visit["day"] is None:
            continue
        for row in rows:
            if row["start"] and row["start"] <= visit["day"] <= row["end"]:
                row["visits"].append(visit)
                break
    return rows


def execution(row: dict) -> str:
    if row["visits"]:
        return "تم"
    if row["end"] and row["end"] < TODAY:
        return "لم يتم"
    return ""


def chunks(items: list, size: int) -> list[list]:
    return [items[index : index + size] for index in range(0, len(items), size)] or [[]]


def header() -> str:
    ministry = data_uri(LOGOS / "ministry_logo.png")
    vision = data_uri(LOGOS / "vision_2030.png")
    return (
        '<header class="doc-official-header">'
        f'<div class="header-logo-right"><img src="{ministry}" alt="وزارة التعليم"></div>'
        '<div class="header-center-titles">'
        "<div>المملكة العربية السعودية</div>"
        "<div>وزارة التعليم</div>"
        "<div>الإدارة العامة للتعليم بمنطقة المدينة المنورة</div>"
        '<div class="school-name-title">متوسطة سعد بن الربيع الأنصاري</div>'
        "</div>"
        f'<div class="header-logo-left"><img src="{vision}" alt="رؤية 2030"></div>'
        '</header><div class="header-divider-bar"></div>'
    )


def sign_image(source: str) -> str:
    if not source:
        return ""
    return f'<img class="sig-image" src="{source}" alt="">'


def signoff(owners: list[dict], page: int, total: int) -> str:
    columns = []
    for owner in owners:
        columns.append(
            '<div class="signoff-col">'
            f'<span class="role-title">{esc(owner["role"])}</span>'
            f'<div class="sig-placeholder">{sign_image(owner["signature"])}</div>'
            f'<span class="person-name">{esc(owner["name"])}</span>'
            "</div>"
        )
    return (
        '<footer class="doc-signoff-block">'
        '<div class="signoff-title-bar">اعتماد السجل</div>'
        f'<div class="signoff-grid">{"".join(columns)}</div>'
        '<div class="doc-bottom-bar">'
        "<span>سجل الزيارات الصفية — متوسطة سعد بن الربيع الأنصاري</span>"
        f"<span>الصفحة {page} من {total}</span>"
        "</div></footer>"
    )


def pagebar(page: int, total: int) -> str:
    return (
        '<footer class="doc-pagebar">'
        "<span>سجل الزيارات الصفية — متوسطة سعد بن الربيع الأنصاري</span>"
        f"<span>الصفحة {page} من {total}</span>"
        "</footer>"
    )


def frame(owners: list[dict], title: str, body: str, page: int, total: int, continued: bool, cover: bool) -> str:
    extra = " (تابع)" if continued else ""
    heading = f'<h1 class="doc-official-title">{esc(title)}{extra}</h1>' if title else ""
    foot = signoff(owners, page, total) if page == total else pagebar(page, total)
    kind = "official-document-frame is-cover" if cover else "official-document-frame"
    return (
        f'<article class="{kind}">'
        + header()
        + f'<div class="doc-official-body">{heading}{body}</div>'
        + foot
        + "</article>"
    )


def table(headers: list[str], rows: list[str]) -> str:
    head = "".join(f"<th>{esc(name)}</th>" for name in headers)
    return f'<table class="reg-table"><thead><tr>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table>'


def cover_body(book: dict) -> str:
    owners = "، و".join(f'{owner["role"]} {owner["name"]}' for owner in book["owners"])
    return (
        '<p class="reg-sub">وفق الدليل الإجرائي لدعم وتطوير أداء الهيئة التعليمية</p>'
        '<p class="reg-year">العام الدراسي 1448-1449هـ</p>'
        f'<p class="reg-owner-line">صاحب السجل: {esc(owners)}</p>'
    )


def contents_body(starts: dict[str, int]) -> str:
    entries = [
        ("cover", "الغلاف الرسمي"),
        ("contents", "محتويات السجل والتعليمات"),
        ("guide", "الدليل الإجرائي"),
        ("plan", "خطة الزيارات السنوية"),
        ("term1", "الخطة الفصلية — الفصل الأول"),
        ("term2", "الخطة الفصلية — الفصل الثاني"),
        ("follow", "سجل متابعة تنفيذ الزيارات والتغذية الراجعة"),
        ("stats", "إحصائية الزيارات واعتماد السجل"),
    ]
    rows = []
    for index, (key, label) in enumerate(entries, 1):
        rows.append(
            "<tr>"
            f"<td>{index}</td><td>{esc(label)}</td><td>{starts[key]}</td>"
            "</tr>"
        )
    return (
        table(["م", "القسم", "الصفحة"], rows)
        + '<h2>تعليمات السجل</h2>'
        + "<ul>"
        + "<li>تُنفذ زيارتان لكل معلم في الفصل الدراسي الواحد: الأولى استطلاعية (تشخيصية) في الأسابيع 3-5، والثانية تقويمية في الأسابيع 12-15.</li>"
        + "<li>الدرجة من بنود الاستمارة الثمانية. السلم: ممتاز من 90، ومتقدم من 75، ومتمكن من 60، ودون ذلك بحاجة إلى دعم.</li>"
        + "<li>المنفّذ قائد المدرسة أو وكيل الشؤون التعليمية.</li>"
        + "<li>جداول هذا السجل تعرض المحفوظ كما هو، ولا تُعاد تسمية الزيارة لتطابق النافذة الزمنية أعلاه.</li>"
        + "</ul>"
    )


def guide_body() -> str:
    rows = [
        ("الهدف", "دعم أداء المعلم وتطويره بزيارة صفية تُسجَّل درجتها من بنود الاستمارة الثمانية."),
        ("نطاق العمل", "معلمو المدرسة النشطون. ينفّذ الزيارة قائد المدرسة أو وكيل الشؤون التعليمية."),
        (
            "التعريفات",
            "الاستطلاعية زيارة تشخيصية. التقويمية زيارة تُحتسب درجتها على السلم: ممتاز من 90، ومتقدم من 75، ومتمكن من 60، ودون ذلك بحاجة إلى دعم.",
        ),
        (
            "العملية",
            "الزيارة الأولى للمعلم استطلاعية، والثانية تقويمية. الزيارة المحفوظة تبقى بنوعها وتاريخها، ولا تُنقل إلى النافذة المقترحة إن وقع تنفيذها في أسبوع آخر.",
        ),
    ]
    body = "".join(f"<tr><th>{esc(label)}</th><td>{esc(text)}</td></tr>" for label, text in rows)
    return f'<table class="reg-table reg-defs"><tbody>{body}</tbody></table>'


def plan_rows(teachers: list[dict]) -> list[str]:
    rendered = []
    for index, teacher in enumerate(teachers, 1):
        exploratory = next((item for item in teacher["visits"] if item["type"] == "استطلاعية"), None)
        evaluative = next((item for item in teacher["visits"] if item["type"] == "تقويمية"), None)
        subject = ""
        if evaluative:
            subject = evaluative["subject"]
        elif exploratory:
            subject = exploratory["subject"]
        else:
            subject = subject_of("", teacher["specialty"])
        rendered.append(
            "<tr>"
            f"<td>{index}</td>"
            f"<td>{esc(teacher['name'])}</td>"
            f"<td>{esc(teacher['specialty'])}</td>"
            f"<td>{esc(subject)}</td>"
            f"<td>{visit_cell(exploratory)}</td>"
            f"<td>{visit_cell(evaluative)}</td>"
            "<td></td>"
            "</tr>"
        )
    return rendered


def visit_cell(visit: dict | None) -> str:
    if not visit:
        return ""
    period = f"الحصة {visit['period']}" if visit["period"] else ""
    meta = " · ".join(part for part in (greg_label(visit["day"]), period, visit["role"]) if part)
    return f"<div>{esc(visit['hijri'])}</div><div class=\"reg-detail\">{esc(meta)}</div>"


def plan_note() -> str:
    return (
        '<p class="reg-note">الزيارة الأولى بقيت فارغة لأنه لم تُحفظ زيارة استطلاعية. '
        "الزيارة الثانية تعرض الزيارة التقويمية المحفوظة. الحصة والمنفّذ من السجل نفسه.</p>"
    )


def term_rows(rows: list[dict]) -> list[str]:
    rendered = []
    for row in rows:
        names = "، ".join(item["teacher"] for item in row["visits"])
        kinds = "، ".join(dict.fromkeys(item["type"] for item in row["visits"] if item["type"]))
        roles = "، ".join(dict.fromkeys(item["role"] for item in row["visits"] if item["role"]))
        rendered.append(
            "<tr>"
            f"<td>{row['n']}</td>"
            f"<td>{date_stack(hijri_label(row['start']), greg_label(row['start']))}</td>"
            f"<td>{date_stack(hijri_label(row['end']), greg_label(row['end']))}</td>"
            f"<td>{esc(names)}</td>"
            f"<td>{esc(kinds)}</td>"
            f"<td>{esc(roles)}</td>"
            f"<td>{esc(execution(row))}</td>"
            f"<td>{esc(row['note'])}</td>"
            "</tr>"
        )
    return rendered


TERM_HEADERS = ["الأسبوع", "من", "إلى", "المعلمون المستهدفون", "نوع الزيارة", "منفّذ الزيارة", "التنفيذ", "ملاحظات"]


def term_note(second: bool) -> str:
    if second:
        return (
            '<p class="reg-note">لا زيارات محفوظة للفصل الثاني، ويوم العودة بعد إجازة منتصف العام غير محفوظ، فبقيت التواريخ فارغة.</p>'
        )
    return (
        '<p class="reg-note">التنظيم: 1-2 إعداد، و3-5 استطلاعية، و12-15 تقويمية، و16-18 تحليل. '
        "الجدول يعرض المحفوظ. من 20 نوفمبر 2026 تبدأ إجازة الخريف ولم يُحفظ يوم العودة.</p>"
    )


def follow_rows(visits: list[dict]) -> list[str]:
    rendered = []
    for index, visit in enumerate(visits, 1):
        rendered.append(
            "<tr>"
            f"<td>{index}</td>"
            f"<td>{esc(visit['teacher'])}</td>"
            f"<td>{esc(visit['type'])}</td>"
            f"<td>{esc(visit['hijri'])}<div class=\"reg-detail\">{esc(greg_label(visit['day']))}</div></td>"
            f"<td>{esc(visit['total'])} {esc(visit['band'])}</td>"
            f'<td><div class="reg-clip">{esc(visit["feedback"])}</div></td>'
            f"<td class=\"sig-cell\">{sign_image(visit['signature'])}</td>"
            f"<td class=\"sig-cell\">{sign_image(visit['visitor_signature'])}</td>"
            "</tr>"
        )
    return rendered


FOLLOW_HEADERS = ["م", "المعلم", "نوع الزيارة", "تاريخ الزيارة", "الدرجة", "التغذية الراجعة", "توقيع المعلم", "توقيع الزائر"]


def stats_body(visits: list[dict]) -> str:
    average = round(sum(item["total"] for item in visits) / len(visits), 2) if visits else 0
    counts = {"ممتاز": 0, "متقدم": 0, "متمكن": 0, "بحاجة إلى دعم": 0}
    for item in visits:
        counts[item["band"]] = counts.get(item["band"], 0) + 1
    exploratory = sum(1 for item in visits if item["type"] == "استطلاعية")
    evaluative = sum(1 for item in visits if item["type"] == "تقويمية")
    rows = [
        ("الزيارات المحفوظة", str(len(visits))),
        ("الاستطلاعية", str(exploratory)),
        ("التقويمية", str(evaluative)),
        ("متوسط الدرجة", str(average)),
        ("ممتاز (من 90)", str(counts["ممتاز"])),
        ("متقدم (من 75)", str(counts["متقدم"])),
        ("متمكن (من 60)", str(counts["متمكن"])),
        ("بحاجة إلى دعم", str(counts["بحاجة إلى دعم"])),
    ]
    body = "".join(f"<tr><td>{esc(label)}</td><td>{esc(value)}</td></tr>" for label, value in rows)
    return (
        f'<table class="reg-table reg-stats"><thead><tr><th>البيان</th><th>القيمة</th></tr></thead><tbody>{body}</tbody></table>'
        + '<p class="reg-note">الدرجة من بنود الاستمارة الثمانية. التوزيع على السلم المحفوظ، بلا رسم بياني.</p>'
    )


def document(book: dict) -> str:
    placed = place(book["visits"])
    blank_term = [{"n": number, "start": None, "end": None, "note": "", "visits": []} for number in range(1, 19)]
    pages: list[dict] = [
        {"key": "cover", "title": "سجل الزيارات الصفية", "body": cover_body(book), "continued": False},
        {"key": "contents", "title": "محتويات السجل والتعليمات", "body": "", "continued": False},
        {"key": "guide", "title": "الدليل الإجرائي", "body": guide_body(), "continued": False},
    ]
    for index, group in enumerate(chunks(plan_rows(book["teachers"]), 30)):
        pages.append(
            {
                "key": "plan",
                "title": "خطة الزيارات السنوية",
                "body": (plan_note() if index == 0 else "")
                + table(
                    ["م", "المعلم", "التخصص", "المادة", "الزيارة الأولى (استطلاعية)", "الزيارة الثانية (تقويمية)", "ملاحظات"],
                    group,
                ),
                "continued": index > 0,
            }
        )
    for index, group in enumerate(chunks(term_rows(placed), 18)):
        pages.append(
            {
                "key": "term1",
                "title": "الخطة الفصلية — الفصل الأول",
                "body": (term_note(False) if index == 0 else "") + table(TERM_HEADERS, group),
                "continued": index > 0,
            }
        )
    for index, group in enumerate(chunks(term_rows(blank_term), 18)):
        pages.append(
            {
                "key": "term2",
                "title": "الخطة الفصلية — الفصل الثاني",
                "body": (term_note(True) if index == 0 else "") + table(TERM_HEADERS, group),
                "continued": index > 0,
            }
        )
    for index, group in enumerate(chunks(follow_rows(book["visits"]), 30)):
        pages.append(
            {
                "key": "follow",
                "title": "سجل متابعة تنفيذ الزيارات والتغذية الراجعة",
                "body": table(FOLLOW_HEADERS, group).replace('class="reg-table"', 'class="reg-table reg-follow"', 1),
                "continued": index > 0,
            }
        )
    pages.append({"key": "stats", "title": "إحصائية الزيارات واعتماد السجل", "body": stats_body(book["visits"]), "continued": False})
    starts: dict[str, int] = {}
    for number, page in enumerate(pages, 1):
        starts.setdefault(page["key"], number)
    pages[1]["body"] = contents_body(starts)
    total = len(pages)
    parts = [
        frame(book["owners"], page["title"], page["body"], number, total, page["continued"], page["key"] == "cover")
        for number, page in enumerate(pages, 1)
    ]
    regular = font_uri("Tajawal-Regular.ttf")
    bold = font_uri("Tajawal-Bold.ttf")
    style = STYLE.replace("__REG__", regular).replace("__BOLD__", bold)
    return (
        "<!DOCTYPE html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\">"
        "<title>سجل الزيارات الصفية الرسمي</title>"
        f"<style>{style}</style></head><body>{''.join(parts)}</body></html>"
    )


STYLE = """
@font-face { font-family: Tajawal; src: url("__REG__") format("truetype"); font-weight: 400; }
@font-face { font-family: Tajawal; src: url("__BOLD__") format("truetype"); font-weight: 700; }
@page register-a4 { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: Tajawal, sans-serif; color: #1c2b28; font-size: 12px; line-height: 1.45; }
.official-document-frame {
  page: register-a4; width: 210mm; height: 297mm; padding: 12mm 15mm 10mm; margin: 0;
  border: 2px solid #005a53; display: flex; flex-direction: column; overflow: hidden;
  break-after: page; page-break-after: always;
}
.official-document-frame:last-child { break-after: auto; page-break-after: auto; }
.doc-official-header {
  display: grid; grid-template-columns: 140px 1fr 140px; align-items: center; text-align: center;
  padding-bottom: 6px; border-bottom: 2px solid #005a53;
}
.doc-official-header img { max-height: 52px; max-width: 140px; object-fit: contain; }
.header-center-titles { color: #005a53; font-weight: 700; line-height: 1.35; font-size: 13px; }
.school-name-title { font-size: 16px; }
.header-divider-bar { height: 4px; background: #e8f2f0; border: 1px solid #c5ddd8; margin: 4px 0 8px; }
.doc-official-body { flex: 1; min-height: 0; }
.is-cover .doc-official-body {
  display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
}
.doc-official-title {
  margin: 0 0 8px; width: 100%; text-align: center; color: #0b5e56; font-size: 22px; font-weight: 700;
  border-bottom: 2px solid #0b5e56; padding-bottom: 3px;
}
.is-cover .doc-official-title { font-size: 26px; margin-bottom: 12px; }
h2 { margin: 10px 0 4px; color: #0b5e56; font-size: 16px; }
.reg-sub, .reg-year, .reg-note, li { font-size: 12px; }
.reg-sub, .reg-year { text-align: center; color: #5c675f; margin: 6px 0 0; width: 100%; }
.reg-year { color: #0b5e56; font-size: 16px; font-weight: 700; }
.reg-owner-line { margin: 14px 0 0; text-align: center; color: #0b5e56; font-size: 16px; font-weight: 700; width: 100%; }
.reg-fact, .reg-note { line-height: 1.7; margin: 8px 0; }
ul { margin: 4px 0; padding: 0 18px 0 0; }
li { margin: 4px 0; }
.reg-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
.reg-table th { background: #E8F5E9; color: #111; font-weight: 700; font-size: 9px; padding: 2px; border: 1px solid #CBD5E1; text-align: center; }
.reg-table td { border: 1px solid #CBD5E1; background: #fff; padding: 1px 2px; vertical-align: middle; font-size: 9px; text-align: center; line-height: 1.25; }
.reg-table tbody tr:nth-child(even) td { background: #F8FAFC; }
.reg-defs th { width: 28mm; text-align: center; }
.reg-defs td { text-align: right; }
.reg-stats { width: 120mm; margin: 8px auto; }
.reg-detail { color: #5c675f; font-size: 10px; }
.sig-cell { height: 8mm; }
.reg-follow td { padding: 0 1px; font-size: 8px; line-height: 1.15; }
.reg-follow .sig-cell { height: 6mm; }
.reg-follow .reg-detail { font-size: 7px; }
.reg-clip {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; text-align: right; line-height: 1.25;
}
.reg-follow .reg-clip { -webkit-line-clamp: 1; }
.sig-image { max-height: 7mm; max-width: 24mm; object-fit: contain; }
.doc-pagebar { margin-top: auto; display: flex; justify-content: space-between; color: #5c675f; font-size: 11px; border-top: 1px solid #c5ddd8; padding-top: 2px; }
.doc-signoff-block { margin-top: auto; border-top: 2px solid #005a53; }
.signoff-title-bar { background: #004d46; color: #fff; text-align: center; font-weight: 700; font-size: 13px; padding: 2px 0; }
.signoff-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #005a53; border-top: none; }
.signoff-col { min-height: 24mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 4px; }
.role-title { color: #004d46; font-weight: 700; font-size: 12px; }
.person-name { font-size: 12px; text-align: center; }
.doc-bottom-bar { display: flex; justify-content: space-between; color: #5c675f; font-size: 11px; margin-top: 3px; }
"""


def main() -> None:
    probe = hijri_label(date(2026, 11, 12))
    if probe != "2 جمادى الآخرة 1448هـ":
        raise SystemExit(f"تعذر اعتماد تحويل أم القرى: {probe}")
    book = load()
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "سجل_الزيارات_الصفية_الرسمي.html"
    html = document(book)
    path.write_text(html, encoding="utf-8")
    visits = book["visits"]
    average = round(sum(item["total"] for item in visits) / len(visits), 2)
    pages = html.count('class="official-document-frame"')
    print(
        f"صفحات {pages} | زيارات {len(visits)} | معلمون {len(book['teachers'])} | "
        f"استطلاعية {sum(1 for item in visits if item['type'] == 'استطلاعية')} | "
        f"تقويمية {sum(1 for item in visits if item['type'] == 'تقويمية')} | "
        f"المتوسط {average} | {path}"
    )


if __name__ == "__main__":
    main()
