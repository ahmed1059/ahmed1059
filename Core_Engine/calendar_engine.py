# محرك التقويم لعام 1448 — لا يُنفَّذ شيء عند الاستيراد
# تواريخ calendar_1448.json مبدئية، وتُستبدل بالتواريخ الرسمية عند توفرها.
# المنطقة الغربية تبدأ بعد الرياض بأسبوع: المدينة المنورة، مكة المكرمة، جدة، الطائف.
# الهجري: مكتبة hijri-converter إن كانت مثبتة، وإلا تُزاح قيمة JSON بعدد الأيام.

import datetime
import json
from pathlib import Path

CALENDAR_PATH = Path(__file__).resolve().parent / "calendars" / "calendar_1448.json"

try:
    from hijri_converter import Gregorian
except ImportError:
    Gregorian = None


def _format_converted(gregorian_date):
    """يحوّل تاريخًا ميلاديًا إلى نص هجري عبر المكتبة المثبتة."""
    converted = Gregorian(
        gregorian_date.year, gregorian_date.month, gregorian_date.day
    ).to_hijri()
    return f"{converted.year}-{converted.month:02d}-{converted.day:02d}"


def _shift_hijri(anchor, days):
    """يزيح تاريخ JSON الهجري. بدون المحول يُحسب الشهر 30 يومًا كقيمة مبدئية."""
    year, month, day = (int(part) for part in anchor.split("-"))
    day += days
    while day > 30:
        day -= 30
        month += 1
        if month > 12:
            month = 1
            year += 1
    while day < 1:
        month -= 1
        if month < 1:
            month = 12
            year -= 1
        day += 30
    return f"{year}-{month:02d}-{day:02d}"


def load_calendar(region: str, semester: str, year: str = "1448", weeks_count: int = 18) -> dict:
    """يقرأ ملف التقويم ويعيد أسابيع الفصل بحسب العدد المطلوب."""
    payload = json.loads(CALENDAR_PATH.read_text(encoding="utf-8"))
    try:
        term = payload[str(year)][region][str(semester)]
    except KeyError as error:
        raise ValueError("لا يوجد تقويم لهذا العام أو المنطقة أو الفصل") from error

    start = datetime.date.fromisoformat(term["start"])
    try:
        total = int(weeks_count)
    except (TypeError, ValueError):
        total = 18
    if total < 10 or total > 20:
        total = 18
    hijri_anchor = term["hijri_start"]
    weeks = []
    for number in range(1, total + 1):
        week_start = start + datetime.timedelta(days=(number - 1) * 7)
        week_end = week_start + datetime.timedelta(days=4)
        if Gregorian is not None:
            hijri_start = _format_converted(week_start)
            hijri_end = _format_converted(week_end)
        else:
            offset = (number - 1) * 7
            hijri_start = _shift_hijri(hijri_anchor, offset)
            hijri_end = _shift_hijri(hijri_anchor, offset + 4)
        weeks.append(
            {
                "number": number,
                "start_date": week_start.isoformat(),
                "end_date": week_end.isoformat(),
                "hijri_start": hijri_start,
                "hijri_end": hijri_end,
            }
        )
    return {
        "region": region,
        "semester": str(semester),
        "weeks": weeks,
        "end_date": weeks[-1]["end_date"] if weeks else "",
    }
