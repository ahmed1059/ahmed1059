# مولّد الخطط — يجمع التقويم وملف نور وبنك المهام ومحرك الضمائر
# لا يُنفَّذ شيء عند الاستيراد، ولا يكتب في قاعدة البيانات

import json
import re
from pathlib import Path

from .calendar_engine import load_calendar
from .excel_parser import parse_noor_workbook
from .pronoun_engine import convert

_TASK_BANK_DIR = Path(__file__).resolve().parent / "task_bank"
# ملف مهام المدير في المجلد اسمه executive.json
_ROLE_BANK = {
    "principal": "executive.json",
    "vice_teachers": "vice_academic.json",
    "vice_students": "vice_students.json",
    "student_counselor": "student_counselor.json",
    "activity_leader": "activity_leader.json",
    "teacher": "teacher.json",
    "librarian": "librarian.json",
    "lab_tech": "lab_tech.json",
    "admin_assistant": "admin_assistant.json",
    "vice_admin": "vice_admin.json",
    "health_counselor": "health_counselor.json",
}
_ROLE_TITLES = {
    "principal": "مدير المدرسة",
    "vice_teachers": "وكيل الشؤون التعليمية",
    "vice_students": "وكيل شؤون الطلاب",
    "student_counselor": "الموجه الطلابي",
    "activity_leader": "رائد النشاط الطلابي",
    "teacher": "المعلم",
    "librarian": "أمين مصادر التعلم",
    "lab_tech": "محضر المختبر",
    "admin_assistant": "المساعد الإداري",
    "vice_admin": "وكيل الشؤون المدرسية",
    "health_counselor": "الموجه الصحي",
}
_TEXT_FIELDS = ("title", "execution_method", "execution_time", "evidence")
_CUSTOM_CODE = re.compile(r"^custom\.(\d+)$")
_PROGRAM_ROWS = 8
_WEEK_ORDINALS = (
    "",
    "الأول",
    "الثاني",
    "الثالث",
    "الرابع",
    "الخامس",
    "السادس",
    "السابع",
    "الثامن",
    "التاسع",
    "العاشر",
    "الحادي عشر",
    "الثاني عشر",
    "الثالث عشر",
    "الرابع عشر",
    "الخامس عشر",
    "السادس عشر",
    "السابع عشر",
    "الثامن عشر",
    "التاسع عشر",
    "العشرون",
)


def _load_task_bank(role: str) -> list:
    """يحمّل ملف المهام أو يعيد قائمة فارغة إن لم يوجد."""
    path = _TASK_BANK_DIR / _ROLE_BANK.get(role, f"{role}.json")
    if not path.is_file():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _executor(entry):
    """يعيد منفذًا واحدًا من خريطة الأدوار، أو None إن غاب."""
    if isinstance(entry, dict) and entry.get("name") and entry.get("id"):
        return {"name": entry["name"], "id": entry["id"]}
    # إن تعدد أصحاب الدور، بنية الأسبوع تحمل منفذًا واحدًا فيُؤخذ الأول
    if isinstance(entry, list):
        for person in entry:
            found = _executor(person)
            if found:
                return found
    return None


def settle_week(original, weeks_count: int) -> int:
    """يرحّل المهمة إلى أسبوع ضمن العدد المعتمد دون إسقاطها."""
    try:
        source = int(original)
    except (TypeError, ValueError):
        source = 1
    try:
        count = int(weeks_count)
    except (TypeError, ValueError):
        count = 18
    if count < 10 or count > 20:
        count = 18
    if count >= 18:
        if source < 1:
            return 1
        return source if source <= count else count
    if source == 17:
        return max(1, count - 1)
    if source == 18:
        return count
    if 1 <= source <= count:
        return source
    early = max(1, count - 3)
    late = max(1, count - 2)
    overflow = list(range(count + 1, 17))
    if source not in overflow or len(overflow) <= 1:
        return late
    split = (len(overflow) + 1) // 2
    return early if overflow.index(source) < split else late


def generate_plans(
    region: str,
    stage: str,
    gender: str,
    semester: str,
    excel_path: str,
    roles_filter: list = None,
    weeks_count: int = 18,
) -> dict:
    """يولّد الخطط لكل الأدوار المتوفرة في roles_map."""
    calendar = load_calendar(region, semester, "1448", weeks_count)
    parsed = parse_noor_workbook(excel_path)
    roles_map = parsed["roles_map"]
    if roles_filter is None:
        selected = roles_map
    else:
        selected = {role: roles_map[role] for role in roles_filter if role in roles_map}

    plans = {}
    for role, entry in selected.items():
        bank = _load_task_bank(role)
        if not bank:
            continue
        executor = _executor(entry)
        if executor is None:
            # لا يوجد موظف لهذا الدور في ملف نور
            continue
        weeks = []
        for week in calendar["weeks"]:
            number = week["number"]
            tasks = []
            for task in bank:
                if settle_week(task.get("week_target", 1), weeks_count) != number:
                    continue
                tasks.append(_render_task(task, gender))
            weeks.append(
                {
                    "week_number": number,
                    "start_date": week["start_date"],
                    "end_date": week["end_date"],
                    "hijri_start": week["hijri_start"],
                    "hijri_end": week["hijri_end"],
                    "executor": {"name": executor["name"], "id": executor["id"]},
                    "tasks": tasks,
                }
            )
        plans[role] = {"weeks": weeks}

    return {
        "school": {"region": region, "stage": stage, "gender": gender},
        "plans": plans,
    }


def _render_task(task: dict, gender: str) -> dict:
    """ينسخ حقول المهمة المعروضة دون المساس بتاريخ الأسبوع."""
    rendered = {"task_code": task.get("task_code", "")}
    for field in _TEXT_FIELDS:
        rendered[field] = convert(str(task.get(field, "")), gender)
    rendered["category"] = task.get("category", "")
    shared_with = str(task.get("shared_with") or "").strip()
    if shared_with:
        rendered["shared_with"] = shared_with
    return rendered


def ensure_role_plan(plans: dict, role: str, gender: str, executor: dict) -> None:
    """يكمل خطة دور غاب عن ملف نور بنسخ تواريخ خطة المدير نفسها."""
    existing = plans.get(role) or {}
    weeks = existing.get("weeks") or []
    if weeks:
        for week in weeks:
            current = week.get("executor") or {}
            week["executor"] = {
                "name": executor.get("name") or current.get("name", ""),
                "id": executor.get("id") or current.get("id", ""),
            }
        return
    source = (plans.get("principal") or {}).get("weeks") or []
    if not source:
        return
    bank = _load_task_bank(role)
    built = []
    for week in source:
        number = int(week["week_number"])
        tasks = [
            _render_task(task, gender)
            for task in bank
            if settle_week(task.get("week_target", 1), len(source)) == number
        ]
        built.append(
            {
                "week_number": number,
                "start_date": week["start_date"],
                "end_date": week["end_date"],
                "hijri_start": week["hijri_start"],
                "hijri_end": week["hijri_end"],
                "executor": {"name": executor.get("name", ""), "id": executor.get("id", "")},
                "tasks": tasks,
            }
        )
    plans[role] = {"weeks": built}


def _cell(path: str, value: str, overridden: bool = False) -> dict:
    """خلية عرض: المسار ثابت، والقيمة نص التسكين، والعلامة للتعديل اليدوي."""
    return {"path": path, "value": value, "overridden": overridden}


def _plain(value) -> str:
    """نص نظيف، والفارغ يبقى فارغًا."""
    if value is None:
        return ""
    return str(value).strip()


def _spoken(text: str, gender: str) -> str:
    """يصرف النص إن وُجد، ويمر على محرك الضمائر مرة واحدة."""
    cleaned = _plain(text)
    if not cleaned:
        return ""
    return convert(cleaned, gender)


def _year_label(preferred: str, fallback: str) -> str:
    """العام الهجري كما حُفظ، مع لاحقة هـ إن غابت."""
    text = _plain(preferred) or _plain(fallback)
    if not text:
        return ""
    if not text.endswith("هـ"):
        text += "هـ"
    return text


def _week_label(number: int, gender: str) -> str:
    """اسم الأسبوع بعد الترحيل."""
    name = _WEEK_ORDINALS[number] if 0 < number < len(_WEEK_ORDINALS) else str(number)
    return _spoken(f"الأسبوع {name}", gender)


def _page_span(pages: list) -> str:
    """رقم صفحة واحدة أو مدى صفحات."""
    if not pages:
        return ""
    if pages[0] == pages[-1]:
        return str(pages[0])
    return f"{pages[0]}-{pages[-1]}"


def _has_override(overrides: dict, path: str) -> bool:
    """التعديل المحفوظ يفوز حتى لو فرّغ المستخدم الخلية."""
    return path in overrides


def _manual_cell(overrides: dict, path: str) -> dict:
    """نص المستخدم كما حُفظ، بلا تصريف."""
    return _cell(path, _plain(overrides.get(path)), True)


def _bank_cell(overrides: dict, path: str, spoken: str) -> dict:
    """نص البنك المصروف، أو النص اليدوي إن وُجد شاهد تعديل."""
    if _has_override(overrides, path):
        return _manual_cell(overrides, path)
    return _cell(path, spoken, False)


def _is_dropped(overrides: dict, code: str) -> bool:
    """شاهد الحذف يبقى بعد إعادة التسكين."""
    return _plain(overrides.get(f"tasks.{code}.deleted")) == "1"


def _custom_codes(overrides: dict) -> list:
    """بنود custom.N بالترتيب، قبل تقسيم الشرائح."""
    numbers = set()
    for path in overrides:
        parts = path.split(".")
        if len(parts) >= 4 and parts[0] == "tasks" and parts[1] == "custom" and parts[2].isdigit():
            numbers.add(int(parts[2]))
    return [f"custom.{number}" for number in sorted(numbers)]


def _program_row(code: str, cells: list) -> dict:
    return {"task_code": code, "cells": cells}


def _school_pages(role: str, content: dict) -> dict:
    """نصوص البسملة والمقدمة والرؤية من بنك المدير، والتعديل المحفوظ يفوز."""
    source = content if role == "principal" and isinstance(content, dict) else {}
    intro = source.get("introduction") if isinstance(source.get("introduction"), dict) else None
    vision = source.get("vision") if isinstance(source.get("vision"), dict) else None
    if intro and vision:
        return source
    try:
        from .content_loader import ContentError, load_role_content
    except ImportError:
        return source
    try:
        loaded = load_role_content("principal")
    except ContentError:
        return source
    return loaded if isinstance(loaded, dict) else source


def _named(item) -> str:
    """اسم القيمة كما حُفظ، والفارغ يبقى فارغًا."""
    if isinstance(item, dict):
        return _plain(item.get("name"))
    return _plain(item)


def _intro_slide(pages: dict) -> dict:
    """المقدمة من الفقرات المحفوظة، بلا صورة ولا توقيع مكتوب."""
    intro = pages.get("introduction") if isinstance(pages.get("introduction"), dict) else {}
    paragraphs = intro.get("paragraphs") if isinstance(intro.get("paragraphs"), list) else []
    cells = []
    for index, paragraph in enumerate(paragraphs):
        text = _plain(paragraph)
        if text:
            cells.append(_cell(f"introduction.paragraphs.{index}", text))
    return {
        "id": "intro",
        "kind": "intro",
        "title": _plain(intro.get("title")) or "المقدمة",
        "paragraphs": cells,
    }


def _vision_slide(pages: dict) -> dict:
    """الرؤية والرسالة والقيم من النصوص المحفوظة فقط."""
    vision = pages.get("vision") if isinstance(pages.get("vision"), dict) else {}
    mission = pages.get("mission") if isinstance(pages.get("mission"), dict) else {}
    values = pages.get("values") if isinstance(pages.get("values"), list) else []
    cells = []
    for index, item in enumerate(values):
        name = _named(item)
        if name:
            cells.append(_cell(f"values.{index}.name", name))
    return {
        "id": "vision",
        "kind": "vision",
        "title": "الرؤية والرسالة",
        "vision": _cell("vision.text", _plain(vision.get("text"))),
        "mission": _cell("mission.text", _plain(mission.get("text"))),
        "values": cells,
    }


_SWOT_QUADRANTS = (
    ("strength", "نقاط القوة", "كوادر تعليمية مؤهلة، وبيئة صفية تشجّع على التعلم النشط."),
    ("weakness", "نقاط الضعف", "ضعف البنية التحتية في بعض المرافق، وتفاوت نواتج التعلم بين الطلاب."),
    ("opportunity", "الفرص", "برامج تنمية القدرات البشرية، وشراكة أولياء الأمور والمجتمع المحلي."),
    ("threat", "التهديدات", "انخفاض دافعية بعض الطلاب، وأثر الغياب على التحصيل الدراسي."),
)
_DOMAIN_ORDINALS = ("الأول", "الثاني", "الثالث", "الرابع")
_PROFILE_HEADLINE = (
    ("students", "الطلاب", False),
    ("classrooms", "الفصول", False),
    ("teachers", "المعلمون", False),
)
_PROFILE_IDENTITY = (
    ("stage", "المرحلة", False),
    ("number", "الرقم الوزاري/الإحصائي", False),
    ("founded", "تاريخ التأسيس", False),
    ("district", "المحافظة أو المركز", False),
    ("address", "العنوان", True),
    ("administration", "الإدارة التعليمية", True),
    ("phone", "الهاتف", False),
    ("fax", "الفاكس", False),
    ("email", "البريد الإلكتروني", False),
    ("website", "الموقع الإلكتروني", False),
    ("principal", "مدير المدرسة", True),
)
_PROFILE_DISTANCES = (
    ("distance_admin", "الإدارة العامة للتعليم", False),
    ("distance_secondary", "أقرب مدرسة ثانوية", False),
    ("distance_middle", "أقرب مدرسة متوسطة", False),
    ("distance_primary", "أقرب مدرسة ابتدائية", False),
)
_PROFILE_BUILDING = (
    ("built_area", "مساحة البناء", "م²"),
    ("yard_area", "مساحة الفناء", "م²"),
    ("room_count", "الغرف", ""),
    ("bathroom_count", "دورات المياه", ""),
    ("admin_room_count", "غرف الإدارة", ""),
    ("lab_count", "المختبرات", ""),
    ("teacher_room_count", "غرف المدرسين", ""),
    ("workshop_count", "المعامل", ""),
    ("warehouse_count", "المستودعات", ""),
)


def _swot_slide(overrides: dict) -> dict:
    """تحليل رباعي بنصوص مقترحة، والتعديل المحفوظ يحل محل المقترح."""
    quadrants = []
    for key, label, suggested in _SWOT_QUADRANTS:
        path = f"swot.{key}"
        if _has_override(overrides, path):
            quadrants.append({"key": key, "label": label, **_cell(path, _plain(overrides.get(path)), True)})
        else:
            quadrants.append({"key": key, "label": label, **_cell(path, suggested, False)})
    return {"id": "swot", "kind": "swot", "title": "التحليل الرباعي", "quadrants": quadrants}


_TEAM_ROWS = 8


def _team_slides(team: list | None) -> list[dict]:
    """فريق التخطيط من الأسماء المرسلة. فوق ثمانية صفوف تُفتح شريحة تابع."""
    members = []
    for item in team or []:
        if not isinstance(item, dict):
            continue
        title = _plain(item.get("title"))
        name = _plain(item.get("name"))
        if not title and not name:
            continue
        members.append({"title": title, "name": name})
    chunks = [members[index:index + _TEAM_ROWS] for index in range(0, len(members), _TEAM_ROWS)] or [[]]
    slides = []
    for index, chunk in enumerate(chunks):
        slides.append({
            "id": "team" if index == 0 else f"team-{index + 1}",
            "kind": "team",
            "title": "فريق التخطيط" if index == 0 else "فريق التخطيط (تابع)",
            "members": chunk,
        })
    return slides


def _profile_spec(source: dict, rows: tuple) -> list:
    """تسمية وقيمة. العرض الزائد للحقول الطويلة، والقيمة الفارغة تبقى فارغة."""
    specs = []
    for key, label, wide in rows:
        specs.append({"label": label, "value": _plain(source.get(key)), "wide": wide})
    return specs


def _with_unit(value, unit: str) -> str:
    """يلحق الوحدة بالقيمة المحفوظة. بلا قيمة تبقى الخانة فارغة."""
    text = _plain(value)
    if not text:
        return ""
    mark = _plain(unit)
    return f"{text} {mark}".strip() if mark else text


def _profile_slide(profile: dict | None) -> dict:
    """بيانات المدرسة من المحفوظ: هوية، مسافات، ومبنى. الحقل بلا قيمة يبقى فارغًا."""
    source = profile if isinstance(profile, dict) else {}
    building = [
        {"label": label, "value": _with_unit(source.get(key), unit)}
        for key, label, unit in _PROFILE_BUILDING
    ]
    return {
        "id": "profile",
        "kind": "profile",
        "title": "بيانات المدرسة",
        "name": _plain(source.get("name")),
        "building_type": _plain(source.get("building_type")),
        "headline": _profile_spec(source, _PROFILE_HEADLINE),
        "identity": _profile_spec(source, _PROFILE_IDENTITY),
        "distances": _profile_spec(source, _PROFILE_DISTANCES),
        "building": building,
    }


_DOMAIN_SCORE_KEYS = {
    "القيادة المدرسية": "الإدارة المدرسية",
    "الإدارة المدرسية": "الإدارة المدرسية",
    "التعليم والتعلم": "التعليم والتعلم",
    "نواتج التعلم": "نواتج التعلم",
    "البيئة المدرسية": "البيئة المدرسية",
}


def _domain_measure(short: str, measures: dict | None) -> tuple[str, str]:
    """نسبة المجال ومسافته من سجل المؤشرات. القيادة المدرسية تقابل الإدارة المدرسية."""
    key = _DOMAIN_SCORE_KEYS.get(short, short)
    found = (measures or {}).get(key) or {}
    return _plain(found.get("score")), _plain(found.get("gap"))


def _domains_slide(pages: dict, measures: dict | None = None) -> dict:
    """المجالات الأربعة من بنك المدير، ونسبها من سجل المؤشرات."""
    block = pages.get("strategic_domains") if isinstance(pages.get("strategic_domains"), dict) else {}
    items = block.get("items") if isinstance(block.get("items"), list) else []
    cards = []
    for index, item in enumerate(items[:4]):
        if not isinstance(item, dict):
            continue
        raw = _plain(item.get("name"))
        short = raw[len("مجال "):] if raw.startswith("مجال ") else raw
        if not short or index >= len(_DOMAIN_ORDINALS):
            continue
        subs = item.get("sub_domains") if isinstance(item.get("sub_domains"), list) else []
        score, gap = _domain_measure(short, measures)
        cards.append({
            "label": f"المجال {_DOMAIN_ORDINALS[index]}: {short}",
            "subs": [_plain(name) for name in subs if _plain(name)],
            "score": score,
            "gap": gap,
        })
    title = _plain(block.get("title")) or "مجالات التقويم"
    return {"id": "domains", "kind": "domains", "title": title, "cards": cards}


def _nafs_weakest(card: dict) -> str:
    """المادة ذات النسبة الأقل. التعادل يترك الإبراز فارغًا."""
    scored = []
    for key in ("reading_score", "science_score", "math_score"):
        raw = _plain(card.get(key)).replace("%", "")
        try:
            scored.append((key, float(raw)))
        except ValueError:
            continue
    if not scored:
        return ""
    lowest = min(value for _key, value in scored)
    winners = [key for key, value in scored if value == lowest]
    return winners[0] if len(winners) == 1 else ""


def _nafs_slide(card: dict | None) -> dict | None:
    """نتائج نافس من البطاقة المحفوظة. السجل الفارغ لا ينشئ شريحة."""
    source = card if isinstance(card, dict) else {}
    if not any(_plain(source.get(key)) for key in ("reading_score", "science_score", "math_score", "grade")):
        return None
    weak = _nafs_weakest(source)
    subjects = [
        {"key": "reading_score", "icon": "reading", "label": "القراءة"},
        {"key": "science_score", "icon": "science", "label": "العلوم"},
        {"key": "math_score", "icon": "math", "label": "الرياضيات"},
    ]
    return {
        "id": "nafs",
        "kind": "nafs",
        "title": "نتائج نافس",
        "grade": _plain(source.get("grade")),
        "enrolled": _plain(source.get("enrolled")),
        "tested": _plain(source.get("tested")),
        "weakest_skill": _plain(source.get("weakest_skill")),
        "weakest_score": _plain(source.get("weakest_score")),
        "subjects": [
            {
                "label": item["label"],
                "icon": item["icon"],
                "score": _plain(source.get(item["key"])),
                "weak": item["key"] == weak,
            }
            for item in subjects
        ],
    }


def _improvement_slide(actions: list | None, team: list | None) -> dict | None:
    """خطة التحسين من السجل. الاسم الحي يُلحق بالمسمى إن وُجد في فريق التخطيط."""
    rows = []
    names = {}
    for member in team or []:
        if isinstance(member, dict):
            role_id = _plain(member.get("role_id"))
            name = _plain(member.get("name"))
            if role_id and name and role_id not in names:
                names[role_id] = name
    for item in actions or []:
        if not isinstance(item, dict):
            continue
        title = _plain(item.get("title"))
        if not title:
            continue
        label = _plain(item.get("owner_label"))
        live = names.get(_plain(item.get("owner_role")), "")
        owner = f"{label}: {live}" if label and live else (live or label)
        rows.append({
            "title": title,
            "owner": owner,
            "indicator": _plain(item.get("indicator_code")),
            "evidence": _plain(item.get("evidence")),
        })
    if not rows:
        return None
    return {"id": "improvement", "kind": "improvement", "title": "خطة التحسين", "rows": rows}


def _school_plan_slides(plan: dict | None, programs: list | None, task_links: list | None) -> list:
    """شريحة الخطة الأم في كل الأدوار. هدفان في الشريحة حتى تبقى المؤشرات داخل الصفحة."""
    if not isinstance(plan, dict):
        return []
    goals = [item for item in plan.get("strategic_goals") or [] if isinstance(item, dict) and _plain(item.get("text"))]
    linked = {}
    for program in programs or []:
        if not isinstance(program, dict):
            continue
        goal_id = _plain(program.get("goal_ref"))
        name = _plain(program.get("program_name"))
        if goal_id and name and program.get("status") in {"معتمد", "قيد التنفيذ", "مكتمل", "متعثر"}:
            linked.setdefault(goal_id, []).append(name)
    tasks = {}
    for link in task_links or []:
        if not isinstance(link, dict):
            continue
        goal_id = _plain(link.get("goal_id"))
        title = _plain(link.get("title"))
        if goal_id and title:
            tasks.setdefault(goal_id, []).append(title)
    prepared = []
    for goal in goals:
        goal_id = _plain(goal.get("id"))
        prepared.append({
            "id": goal_id,
            "domain": _plain(goal.get("domain")),
            "text": _plain(goal.get("text")),
            "indicators": [
                {
                    "kpi": _plain(item.get("kpi")),
                    "target": _plain(item.get("target")),
                    "measurement": _plain(item.get("measurement")),
                }
                for item in goal.get("indicators") or []
                if isinstance(item, dict)
            ],
            "programs": linked.get(goal_id, []),
            "tasks": tasks.get(goal_id, []),
        })
    if not prepared:
        prepared = []
    chunk_size = 2
    slides = []
    chunks = [prepared[index:index + chunk_size] for index in range(0, max(len(prepared), 1), chunk_size)]
    if not prepared:
        chunks = [[]]
    for index, chunk in enumerate(chunks, start=1):
        slides.append({
            "id": "school-plan" if index == 1 else f"school-plan-{index}",
            "kind": "school_plan",
            "title": "الخطة التشغيلية للمدرسة" if index == 1 else "الخطة التشغيلية للمدرسة (تابع)",
            "source": _plain(plan.get("source")),
            "year": _plain(plan.get("academic_year")),
            "goals": chunk,
        })
    return slides


def _program_follow_slide(programs: list | None, actions: list | None) -> dict | None:
    """متابعة البرامج المحفوظة. النسبة تُقرأ من الإجراء المربوط إن وُجدت."""
    by_id = {}
    for action in actions or []:
        if isinstance(action, dict) and action.get("id") is not None:
            by_id[int(action["id"])] = action
    rows = []
    for item in programs or []:
        if not isinstance(item, dict) or not _plain(item.get("program_name")):
            continue
        progress = ""
        action_status = ""
        ref = _plain(item.get("duty_ref"))
        if ref.startswith("improvement:"):
            raw = ref.split(":", 1)[1]
            if raw.isdigit() and int(raw) in by_id:
                linked = by_id[int(raw)]
                progress = _plain(linked.get("progress_percentage"))
                action_status = _plain(linked.get("status"))
        rows.append({
            "name": _plain(item.get("program_name")),
            "status": _plain(item.get("status")),
            "baseline": _plain(item.get("baseline_value")),
            "current": _plain(item.get("current_value")),
            "target": _plain(item.get("target_value")),
            "unit": _plain(item.get("unit")),
            "progress": progress,
            "action_status": action_status,
        })
    if not rows:
        return None
    return {"id": "program-follow", "kind": "program_follow", "title": "متابعة البرامج", "rows": rows}


def _school_program_slides(programs: list | None) -> list:
    """بطاقات خطة البرامج. بطاقتان في الشريحة حتى يبقى النص 14pt داخل الإطار."""
    rows = []
    for item in programs or []:
        if not isinstance(item, dict):
            continue
        name = _plain(item.get("program_name"))
        if not name:
            continue
        goal = _plain(item.get("executive_goal")) or _plain(item.get("strategic_goal"))
        rows.append({
            "name": name,
            "goal": goal,
            "audience": _plain(item.get("target_audience")),
            "duration": _plain(item.get("duration")),
            "implementers": _plain(item.get("implementers")),
            "success": _plain(item.get("success_indicator")),
            "register": _plain(item.get("register_label")),
            "baseline": _plain(item.get("baseline_value")),
            "current": _plain(item.get("current_value")),
            "target": _plain(item.get("target_value")),
            "unit": _plain(item.get("unit")),
            "kpi": _plain(item.get("kpi_description")),
            "status": _plain(item.get("status")),
        })
    slides = []
    for offset in range(0, len(rows), 4):
        number = len(slides) + 1
        slides.append({
            "id": "school-programs" if number == 1 else f"school-programs-{number}",
            "kind": "school_programs",
            "title": "خطة البرامج" if number == 1 else "خطة البرامج (تابع)",
            "start": offset,
            "rows": rows[offset:offset + 4],
        })
    return slides


def seat_role(
    role: str,
    content: dict,
    *,
    gender: str,
    weeks_count: int,
    school_name: str,
    administration: str,
    year_label: str,
    author_name: str,
    author_role: str,
    overrides: dict | None = None,
    school_profile: dict | None = None,
    team: list | None = None,
    teacher_names: dict | None = None,
    domain_scores: dict | None = None,
    nafs_card: dict | None = None,
    improvement_actions: list | None = None,
    school_programs: list | None = None,
    operational_plan: dict | None = None,
    linked_programs: list | None = None,
) -> dict:
    """يبني الشرائح: غلاف، بسملة، محتويات، مقدمة، رؤية، ثم التحليل والفريق والبيانات والمجالات، ثم البرامج."""
    if role not in _ROLE_BANK:
        raise ValueError("تسكين هذا الدور يأتي لاحقاً")
    kept = overrides or {}
    bank = _load_task_bank(role)
    ordered = []
    for index, task in enumerate(bank):
        week = settle_week(task.get("week_target", 1), weeks_count)
        ordered.append((week, index, task))
    ordered.sort(key=lambda item: (item[0], item[1]))

    rows = []
    for week, _index, task in ordered:
        code = _plain(task.get("task_code"))
        if not code or _is_dropped(kept, code):
            continue
        rows.append(
            _program_row(
                code,
                [
                    _bank_cell(kept, f"tasks.{code}.title", _spoken(task.get("title"), gender)),
                    _bank_cell(kept, f"tasks.{code}.execution_time", _week_label(week, gender)),
                    _bank_cell(kept, f"tasks.{code}.execution_method", _spoken(task.get("execution_method"), gender)),
                    _bank_cell(kept, f"tasks.{code}.evidence", _spoken(task.get("evidence"), gender)),
                ],
            )
        )
    for code in _custom_codes(kept):
        if not _CUSTOM_CODE.match(code) or _is_dropped(kept, code):
            continue
        cells = [
            _bank_cell(kept, f"tasks.{code}.title", ""),
            _bank_cell(kept, f"tasks.{code}.execution_time", ""),
            _bank_cell(kept, f"tasks.{code}.execution_method", ""),
            _bank_cell(kept, f"tasks.{code}.evidence", ""),
        ]
        if not any(_plain(cell.get("value")) for cell in cells):
            continue
        rows.append(_program_row(code, cells))

    follow_last = 8
    seated_weeks = set()
    follow_owners = {}
    known_teachers = teacher_names or {}
    for week, _index, task in ordered:
        code = _plain(task.get("task_code"))
        if not code or _is_dropped(kept, code):
            continue
        seated_weeks.add(week)
        follow_last = 18
        owner = known_teachers.get(_plain(kept.get(f"tasks.{code}.executor")), "")
        if owner and owner not in follow_owners.setdefault(week, []):
            follow_owners[week].append(owner)
    follow_last = 18
    follow = {
        "id": "follow",
        "kind": "follow",
        "title": "متابعة التنفيذ",
        "weeks": [
            {
                "week": _week_label(number, gender),
                "done": number <= 11,
                "mark": "✓" if number <= 11 else "⏳",
                "responsible": "، ".join(follow_owners.get(number, [])),
            }
            for number in range(1, follow_last + 1)
        ],
    }
    sign = {
        "id": "sign",
        "kind": "sign",
        "title": "اعتماد الخطة التشغيلية",
        "closing": "اعتماد الخطة التشغيلية",
        "signature": "signatures/sig_manager.png",
    }

    year = _year_label(year_label, content.get("academic_year", ""))
    school = _plain(school_name)
    admin = _plain(administration)
    author = _plain(author_name)
    role_title = _plain(author_role) or _ROLE_TITLES.get(role, "")
    identity = {
        "school": school,
        "administration": admin,
        "year": year,
        "author_name": author,
        "author_role": role_title,
    }
    cover = {
        "id": "cover",
        "kind": "cover",
        "kicker": "الخطة",
        "plan_kind": "التشغيلية",
        "note": _spoken(content.get("plan_subtitle"), gender),
        "stripe": f"الخطة التشغيلية للعام الدراسي {year}" if year else "",
    }
    program_slides = []
    for chunk_index in range(0, len(rows), _PROGRAM_ROWS):
        chunk = rows[chunk_index:chunk_index + _PROGRAM_ROWS]
        number = len(program_slides) + 1
        program_slides.append(
            {
                "id": "programs" if number == 1 else f"programs-{number}",
                "kind": "programs",
                "title": "برامج الخطة التشغيلية" if number == 1 else "برامج الخطة التشغيلية (تابع)",
                "rows": chunk,
            }
        )
    pages = _school_pages(role, content)
    basmala = {"id": "basmala", "kind": "basmala", "title": "البسملة"}
    intro = _intro_slide(pages)
    vision = _vision_slide(pages)
    swot = _swot_slide(kept)
    planning = _team_slides(team)
    profile = _profile_slide(school_profile)
    domains = _domains_slide(pages, domain_scores)
    nafs = _nafs_slide(nafs_card)
    improvement = _improvement_slide(improvement_actions, team)
    school_program_slides = _school_program_slides(school_programs)
    program_follow = _program_follow_slide(school_programs, improvement_actions)
    school_plan_slides = _school_plan_slides(
        operational_plan,
        linked_programs if linked_programs is not None else school_programs,
        (operational_plan or {}).get("task_links") if isinstance(operational_plan, dict) else [],
    )
    toc = {"id": "toc", "kind": "toc", "entries": []}
    slides = [cover, basmala, toc, intro, vision]
    slides.extend(school_plan_slides)
    slides.append(swot)
    slides.extend(planning)
    slides.extend([profile, domains])
    if nafs:
        slides.append(nafs)
    if improvement:
        slides.append(improvement)
    slides.extend(school_program_slides)
    slides.extend(program_slides)
    slides.append(follow)
    if program_follow:
        slides.append(program_follow)
    slides.append(sign)
    for page, slide in enumerate(slides, start=1):
        slide["page"] = page
    catalog = {
        "cover": "الغلاف",
        "basmala": "البسملة",
        "toc": "المحتويات",
        "intro": "المقدمة",
        "vision": "الرؤية والرسالة",
        "school_plan": "الخطة التشغيلية للمدرسة",
        "swot": "التحليل الرباعي",
        "team": "فريق التخطيط",
        "profile": "بيانات المدرسة",
        "domains": "مجالات التقويم",
        "nafs": "نتائج نافس",
        "improvement": "خطة التحسين",
        "school_programs": "خطة البرامج",
        "programs": "البرامج",
        "follow": "المتابعة",
        "program_follow": "متابعة البرامج",
        "sign": "اعتماد الخطة التشغيلية",
    }
    toc["entries"] = [
        {"label": _plain(slide.get("title")) or catalog.get(slide.get("kind"), ""), "pages": str(slide["page"])}
        for slide in slides
    ]
    return {"role": role, "identity": identity, "slides": slides}
