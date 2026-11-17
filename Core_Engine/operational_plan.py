# الخطة التشغيلية للمدرسة. ملف المدير يملأ العرض حتى يُحفظ صف في الجدول.

import json
from pathlib import Path

from .content_loader import list_swot_overrides, save_swot_override
from .database import connect
from .noor_import import stamp

_BANK_PATH = Path(__file__).resolve().parent / "content_bank" / "principal.json"
_TASK_DIR = Path(__file__).resolve().parent / "task_bank"
_ROLE_FILES = {
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
_ROLE_LABELS = {
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
_SWOT_SUGGESTED = {
    "strength": "كوادر تعليمية مؤهلة، وبيئة صفية تشجّع على التعلم النشط.",
    "weakness": "ضعف البنية التحتية في بعض المرافق، وتفاوت نواتج التعلم بين الطلاب.",
    "opportunity": "برامج تنمية القدرات البشرية، وشراكة أولياء الأمور والمجتمع المحلي.",
    "threat": "انخفاض دافعية بعض الطلاب، وأثر الغياب على التحصيل الدراسي.",
}
_SWOT_KEYS = tuple(_SWOT_SUGGESTED)
_ACTIVE = {"معتمد", "قيد التنفيذ"}
TEMPLATE_GOALS = {
    "loss": "G3",
    "discipline": "G5",
    "career": "G5",
    "gifted": "G3",
    "partnership": "G7",
    "safety": "G4",
    "nafs": "G3",
    "support": "G3",
    "visits": "G2",
    "plc": "G2",
    "evacuation": "G4",
    "building": "G4",
    "parent_meet": "G7",
    "irtiqaa": "G7",
    "volunteer": "G7",
    "planning": "G1",
    "pd": "G6",
}


def _plain(value):
    return str(value or "").strip()


def _load_bank():
    data = json.loads(_BANK_PATH.read_text(encoding="utf-8"))
    vision = data.get("vision") if isinstance(data.get("vision"), dict) else {}
    mission = data.get("mission") if isinstance(data.get("mission"), dict) else {}
    values = []
    for item in data.get("values") or []:
        name = _plain(item.get("name") if isinstance(item, dict) else item)
        if name:
            values.append(name)
    goals = []
    block = data.get("strategic_goals") if isinstance(data.get("strategic_goals"), dict) else {}
    for item in block.get("goals") or []:
        if not isinstance(item, dict):
            continue
        indicators = []
        for indicator in item.get("indicators") or []:
            if not isinstance(indicator, dict):
                continue
            indicators.append({
                "kpi": _plain(indicator.get("kpi")),
                "target": _plain(indicator.get("target")),
                "measurement": _plain(indicator.get("measurement")),
            })
        goals.append({
            "id": _plain(item.get("id")),
            "domain": _plain(item.get("domain")),
            "text": _plain(item.get("text")),
            "indicators": [row for row in indicators if row["kpi"] or row["target"] or row["measurement"]],
        })
    return {
        "academic_year": _plain(data.get("academic_year")),
        "vision": _plain(vision.get("text")),
        "mission": _plain(mission.get("text")),
        "values": values,
        "strategic_goals": [goal for goal in goals if goal["id"] and goal["text"]],
    }


def _flatten_kpis(goals):
    rows = []
    for goal in goals or []:
        for indicator in goal.get("indicators") or []:
            if indicator.get("kpi") or indicator.get("target"):
                rows.append({
                    "goal_id": goal.get("id") or "",
                    "kpi": indicator.get("kpi") or "",
                    "target": indicator.get("target") or "",
                    "measurement": indicator.get("measurement") or "",
                })
    return rows


def _swot_view():
    overrides = list_swot_overrides()
    found = {}
    for key, suggested in _SWOT_SUGGESTED.items():
        path = f"swot.{key}"
        if path in overrides:
            found[key] = overrides[path]
        else:
            found[key] = suggested
    return found


def _json_list(raw):
    try:
        parsed = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def _json_object(raw):
    try:
        parsed = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _task_links(connection):
    rows = connection.execute(
        """
        SELECT role, task_code, goal_id
        FROM task_goal_links
        ORDER BY role, task_code
        """
    ).fetchall()
    titles = {}
    links = []
    for role, task_code, goal_id in rows:
        role = _plain(role)
        code = _plain(task_code)
        if role not in titles:
            titles[role] = {item["task_code"]: item["title"] for item in task_choices(role)}
        links.append({
            "role": role,
            "role_label": _ROLE_LABELS.get(role, role),
            "task_code": code,
            "title": titles[role].get(code, ""),
            "goal_id": _plain(goal_id),
        })
    return links


def read_plan():
    """الصف المحفوظ إن وُجد، وإلا نص ملف المدير. الميزانية والمتابعة تبقى فارغة."""
    connection = connect()
    try:
        row = connection.execute(
            """
            SELECT id, academic_year, vision, mission, values_json, swot_analysis,
                   strategic_goals, kpis, budget, planning_team, monitoring_plan
            FROM school_operational_plan
            ORDER BY id
            LIMIT 1
            """
        ).fetchone()
        links = _task_links(connection)
    finally:
        connection.close()
    if not row:
        bank = _load_bank()
        goals = bank["strategic_goals"]
        return {
            "persisted": False,
            "source": "bank",
            "academic_year": bank["academic_year"],
            "vision": bank["vision"],
            "mission": bank["mission"],
            "values": bank["values"],
            "swot": _swot_view(),
            "strategic_goals": goals,
            "kpis": _flatten_kpis(goals),
            "budget": "",
            "planning_team": [],
            "monitoring_plan": "",
            "task_links": links,
        }
    payload = _saved_payload(row, links)
    return payload


def _saved_payload(row, links):
    goals = []
    for item in _json_list(row[6]):
        if not isinstance(item, dict):
            continue
        indicators = []
        for indicator in item.get("indicators") or []:
            if not isinstance(indicator, dict):
                continue
            indicators.append({
                "kpi": _plain(indicator.get("kpi")),
                "target": _plain(indicator.get("target")),
                "measurement": _plain(indicator.get("measurement")),
            })
        text = _plain(item.get("text"))
        goal_id = _plain(item.get("id"))
        if goal_id and text:
            goals.append({
                "id": goal_id,
                "domain": _plain(item.get("domain")),
                "text": text,
                "indicators": indicators,
                "progress": _plain(item.get("progress")),
            })
    swot = _swot_view()
    stored_swot = _json_object(row[5])
    for key in _SWOT_KEYS:
        if key in stored_swot:
            swot[key] = _plain(stored_swot.get(key))
    team = []
    for item in _json_list(row[9]):
        if isinstance(item, dict) and _plain(item.get("name")):
            team.append({"role": _plain(item.get("role")), "name": _plain(item.get("name"))})
    values = [_plain(item) for item in _json_list(row[4])]
    values = [item for item in values if item]
    return {
        "persisted": True,
        "source": "saved",
        "academic_year": _plain(row[1]),
        "vision": _plain(row[2]),
        "mission": _plain(row[3]),
        "values": values,
        "swot": swot,
        "strategic_goals": goals,
        "kpis": _flatten_kpis(goals),
        "budget": _plain(row[8]),
        "planning_team": team,
        "monitoring_plan": _plain(row[10]),
        "task_links": links,
    }


def goal_ids():
    return [goal["id"] for goal in read_plan()["strategic_goals"] if goal.get("id")]


def summary():
    """ملخص البطاقة. النسبة لا تُحسب من هدف بلا نسبة محفوظة."""
    from .program_registry import list_programs

    plan = read_plan()
    stored = []
    for goal in plan["strategic_goals"]:
        raw = _plain(goal.get("progress")).replace("%", "").replace("٪", "")
        if not raw:
            continue
        try:
            number = float(raw)
        except ValueError:
            continue
        if 0 <= number <= 100:
            stored.append(number)
    active = sum(1 for item in list_programs() if item["status"] in _ACTIVE)
    if stored:
        progress = str(round(sum(stored) / len(stored), 1)).rstrip("0").rstrip(".")
        progress_label = progress + "% من " + str(len(stored)) + " أهداف لها نسبة محفوظة"
    else:
        progress_label = "لا نسبة محفوظة"
    return {
        "goal_count": len(plan["strategic_goals"]),
        "source": plan["source"],
        "progress_label": progress_label,
        "active_programs": active,
        "academic_year": plan["academic_year"],
    }


def task_choices(role):
    """بنود دور واحد من بنك المهام. لا يُنشأ ربط من تلقاء نفسه."""
    filename = _ROLE_FILES.get(role)
    if not filename:
        return []
    path = _TASK_DIR / filename
    if not path.is_file():
        return []
    rows = []
    for item in json.loads(path.read_text(encoding="utf-8")):
        if not isinstance(item, dict):
            continue
        code = _plain(item.get("task_code"))
        title = _plain(item.get("title"))
        if code and title:
            rows.append({"task_code": code, "title": title})
    return rows


def _normalize_goals(goals):
    cleaned = []
    seen = set()
    for index, item in enumerate(goals or [], start=1):
        text = _plain(getattr(item, "text", ""))
        if not text:
            continue
        goal_id = _plain(getattr(item, "id", "")) or f"G{index}"
        if goal_id in seen:
            goal_id = f"G{index}"
        seen.add(goal_id)
        indicators = []
        for indicator in getattr(item, "indicators", []) or []:
            kpi = _plain(getattr(indicator, "kpi", ""))
            target = _plain(getattr(indicator, "target", ""))
            measurement = _plain(getattr(indicator, "measurement", ""))
            if kpi or target or measurement:
                indicators.append({"kpi": kpi, "target": target, "measurement": measurement})
        progress = _plain(getattr(item, "progress", ""))
        cleaned.append({
            "id": goal_id,
            "domain": _plain(getattr(item, "domain", "")),
            "text": text,
            "indicators": indicators[:4],
            "progress": progress,
        })
        if len(cleaned) >= 7:
            break
    return cleaned


def save_plan(body):
    """يحفظ صف الخطة الأم. تحليل الواقع يُكتب في تعديلات الشريحة إن تغيّر عن المقترح."""
    goals = _normalize_goals(body.strategic_goals)
    values = [_plain(item) for item in body.values if _plain(item)]
    swot = {}
    incoming = body.swot or {}
    current = list_swot_overrides()
    for key in _SWOT_KEYS:
        text = _plain(incoming.get(key))
        swot[key] = text
        path = f"swot.{key}"
        if path in current or text != _SWOT_SUGGESTED[key]:
            save_swot_override(path, text)
    team = []
    for item in body.planning_team or []:
        name = _plain(getattr(item, "name", ""))
        if name:
            team.append({"role": _plain(getattr(item, "role", "")), "name": name})
    kpis = _flatten_kpis(goals)
    moment = stamp()
    payload = (
        _plain(body.academic_year),
        _plain(body.vision),
        _plain(body.mission),
        json.dumps(values, ensure_ascii=False),
        json.dumps(swot, ensure_ascii=False),
        json.dumps(goals, ensure_ascii=False),
        json.dumps(kpis, ensure_ascii=False),
        _plain(body.budget),
        json.dumps(team, ensure_ascii=False),
        _plain(body.monitoring_plan),
        moment,
    )
    connection = connect()
    try:
        existing = connection.execute("SELECT id FROM school_operational_plan ORDER BY id LIMIT 1").fetchone()
        if existing:
            connection.execute(
                """
                UPDATE school_operational_plan
                SET academic_year = ?, vision = ?, mission = ?, values_json = ?, swot_analysis = ?,
                    strategic_goals = ?, kpis = ?, budget = ?, planning_team = ?, monitoring_plan = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (*payload, existing[0]),
            )
        else:
            connection.execute(
                """
                INSERT INTO school_operational_plan (
                    academic_year, vision, mission, values_json, swot_analysis, strategic_goals,
                    kpis, budget, planning_team, monitoring_plan, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                payload,
            )
        connection.commit()
    finally:
        connection.close()
    return read_plan()


def save_task_link(role, task_code, goal_id):
    """يربط بندًا بهدف أو يزيل الربط إن كان الهدف فارغًا. لا يربط البنود كلها دفعة واحدة."""
    role = _plain(role)
    code = _plain(task_code)
    goal = _plain(goal_id)
    if role not in _ROLE_FILES:
        raise ValueError("الدور غير معروف")
    known = {item["task_code"] for item in task_choices(role)}
    if code not in known:
        raise ValueError("البند غير موجود في خطة هذا الدور")
    if goal and goal not in goal_ids():
        raise ValueError("الهدف غير موجود في الخطة التشغيلية")
    connection = connect()
    try:
        if not goal:
            connection.execute(
                "DELETE FROM task_goal_links WHERE role = ? AND task_code = ?",
                (role, code),
            )
        else:
            connection.execute(
                """
                INSERT INTO task_goal_links (role, task_code, goal_id, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(role, task_code) DO UPDATE SET goal_id = excluded.goal_id, updated_at = excluded.updated_at
                """,
                (role, code, goal, stamp()),
            )
        connection.commit()
    finally:
        connection.close()
    return read_plan()
