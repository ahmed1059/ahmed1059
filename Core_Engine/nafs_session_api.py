# نواتج التعلم ونافس — الوحدة 3-أ: لوحة تحليل + خطة معالجة (قراءة فقط من SSOT).
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from .database import connect

router = APIRouter(tags=["nafs-analytics"])

DOMAIN_ORDER = (
    ("math", "الرياضيات", "3-1-1-2", "math_score"),
    ("reading", "القراءة", "3-1-1-1", "reading_score"),
    ("science", "العلوم", "3-1-1-3", "science_score"),
)

EMPTY_TIMETABLE_MSG = (
    "لا حصص مستوردة في هذه البيئة بعد "
    "(تُغذّى تلقائياً عند استيراد الجدول الشامل من مركز الاستيراد)"
)


def _user(token: str) -> dict:
    from .access import require_user

    try:
        return require_user(str(token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _num(value) -> float | None:
    text = str(value if value is not None else "").strip().replace("%", "")
    if not text:
        return None
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def _load_metrics_nafes() -> dict:
    try:
        from .binding_guard import load_canonical, sync_performance_mirror

        sync_performance_mirror(force=False)
        pack = load_canonical() or {}
        return pack.get("nafes") or {}
    except Exception:
        return {}


def _card_row(connection) -> dict:
    row = connection.execute(
        """
        SELECT id, grade, enrolled, tested, reading_score, science_score, math_score,
               weakest_skill, weakest_score, updated_at
        FROM nafs_cards
        ORDER BY id
        LIMIT 1
        """
    ).fetchone()
    if not row:
        return {
            "id": 0,
            "grade": "",
            "enrolled": "",
            "tested": "",
            "reading_score": "",
            "science_score": "",
            "math_score": "",
            "weakest_skill": "",
            "weakest_score": "",
            "updated_at": "",
        }
    return {
        "id": int(row[0] or 0),
        "grade": row[1] or "",
        "enrolled": row[2] or "",
        "tested": row[3] or "",
        "reading_score": row[4] or "",
        "science_score": row[5] or "",
        "math_score": row[6] or "",
        "weakest_skill": row[7] or "",
        "weakest_score": row[8] or "",
        "updated_at": row[9] or "",
    }


def _indicator_map(connection) -> dict[str, str]:
    codes = [item[2] for item in DOMAIN_ORDER]
    placeholders = ",".join("?" for _ in codes)
    rows = connection.execute(
        f"""
        SELECT code, statement
        FROM evaluation_indicators
        WHERE code IN ({placeholders})
        """,
        tuple(codes),
    ).fetchall()
    return {str(row[0]): (row[1] or "") for row in rows}


def _improvement_actions(connection) -> list[dict]:
    codes = [item[2] for item in DOMAIN_ORDER]
    placeholders = ",".join("?" for _ in codes)
    rows = connection.execute(
        f"""
        SELECT id, title, owner_role, owner_label, indicator_code, evidence,
               status, progress_percentage, objective, baseline_value, target_value
        FROM improvement_actions
        WHERE indicator_code IN ({placeholders})
           OR title LIKE '%جبر%'
           OR title LIKE '%نافس%'
           OR title LIKE '%قراء%'
           OR title LIKE '%رياض%'
           OR title LIKE '%علوم%'
        ORDER BY sort_order, id
        """,
        tuple(codes),
    ).fetchall()
    return [
        {
            "id": int(row[0] or 0),
            "title": row[1] or "",
            "owner_role": row[2] or "",
            "owner_label": row[3] or "",
            "indicator_code": row[4] or "",
            "evidence": row[5] or "",
            "status": row[6] or "",
            "progress_percentage": row[7] or "",
            "objective": row[8] or "",
            "baseline_value": row[9] or "",
            "target_value": row[10] or "",
        }
        for row in rows
    ]


def _timetable_pack(connection) -> dict:
    try:
        total = int(
            connection.execute(
                """
                SELECT COUNT(*) FROM nafes_timetable
                WHERE COALESCE(is_deleted, 0) = 0
                """
            ).fetchone()[0]
            or 0
        )
    except Exception:
        total = 0
    if total <= 0:
        return {
            "total": 0,
            "empty": True,
            "message": EMPTY_TIMETABLE_MSG,
            "by_subject": [],
            "by_teacher": [],
        }

    by_subject = []
    for row in connection.execute(
        """
        SELECT COALESCE(NULLIF(trim(subject), ''), '—'), COUNT(*)
        FROM nafes_timetable
        WHERE COALESCE(is_deleted, 0) = 0
        GROUP BY 1
        ORDER BY COUNT(*) DESC, 1
        """
    ).fetchall():
        by_subject.append({"subject": row[0], "count": int(row[1] or 0)})

    by_teacher = []
    for row in connection.execute(
        """
        SELECT
            COALESCE(NULLIF(trim(n.teacher), ''), '—') AS teacher_name,
            COALESCE(NULLIF(trim(n.staff_id), ''), '') AS staff_id,
            COALESCE(NULLIF(trim(s.name), ''), '') AS staff_name,
            COALESCE(NULLIF(trim(s.role), ''), '') AS staff_role,
            COUNT(*) AS cnt
        FROM nafes_timetable n
        LEFT JOIN noor_staff s
          ON s.national_id = n.staff_id AND COALESCE(s.is_deleted, 0) = 0
        WHERE COALESCE(n.is_deleted, 0) = 0
        GROUP BY 1, 2, 3, 4
        ORDER BY cnt DESC, teacher_name
        LIMIT 40
        """
    ).fetchall():
        by_teacher.append(
            {
                "teacher": row[2] or row[0],
                "timetable_name": row[0],
                "staff_id": row[1],
                "role": row[3],
                "count": int(row[4] or 0),
            }
        )

    return {
        "total": total,
        "empty": False,
        "message": "",
        "by_subject": by_subject,
        "by_teacher": by_teacher,
    }


def _domains(card: dict, metrics: dict, statements: dict[str, str]) -> list[dict]:
    domains: list[dict] = []
    for index, (key, label, code, score_field) in enumerate(DOMAIN_ORDER, start=1):
        metric = (metrics.get(key) or {}) if isinstance(metrics, dict) else {}
        score = _num(card.get(score_field))
        if score is None:
            score = _num(metric.get("score"))
        target = _num(metric.get("target"))
        gap = None
        if score is not None and target is not None:
            gap = round(target - score, 2)
        weakest = metric.get("weakest_subskill") or {}
        weakest_name = ""
        weakest_score = None
        if key == "math" and card.get("weakest_skill"):
            weakest_name = str(card.get("weakest_skill") or "")
            weakest_score = _num(card.get("weakest_score"))
        if not weakest_name and isinstance(weakest, dict):
            weakest_name = str(weakest.get("name") or "")
            weakest_score = _num(weakest.get("score"))
        domains.append(
            {
                "key": key,
                "label": label,
                "score": score,
                "target": target,
                "gap": gap,
                "etec_indicator": code,
                "indicator_statement": statements.get(code, ""),
                "weakest_skill": weakest_name,
                "weakest_score": weakest_score,
                "priority": index,
                "metric_label": metric.get("label") or label,
            }
        )
    return domains


def build_nafs_analytics(connection) -> dict:
    card = _card_row(connection)
    metrics = _load_metrics_nafes()
    statements = _indicator_map(connection)
    domains = _domains(card, metrics, statements)
    priority = {
        "name": card.get("weakest_skill") or "",
        "score": _num(card.get("weakest_score")),
        "domain_key": "math",
        "domain_label": "الرياضيات",
    }
    if not priority["name"]:
        math = next((row for row in domains if row["key"] == "math"), None)
        if math and math.get("weakest_skill"):
            priority = {
                "name": math["weakest_skill"],
                "score": math.get("weakest_score"),
                "domain_key": "math",
                "domain_label": "الرياضيات",
            }
    meta = metrics.get("meta") if isinstance(metrics, dict) else {}
    return {
        "ok": True,
        "card": card,
        "meta": {
            "grade": card.get("grade") or (meta or {}).get("grade") or "",
            "enrolled": card.get("enrolled") or "",
            "tested": card.get("tested") or (meta or {}).get("tested_count") or "",
            "average_mastery_pct": (meta or {}).get("average_mastery_pct"),
            "source": (meta or {}).get("source") or "",
        },
        "priority_skill": priority,
        "domains": domains,
        "indicators": [
            {
                "code": code,
                "statement": statements.get(code, ""),
                "domain_key": key,
                "domain_label": label,
            }
            for key, label, code, _score in DOMAIN_ORDER
        ],
        "improvement_actions": _improvement_actions(connection),
        "timetable": _timetable_pack(connection),
    }


@router.get("/api/session/nafs/analytics")
def nafs_analytics(x_session_token: str = Header(default="")):
    """لوحة تحليل نافس الحية: بطاقة + مجالات + حصص + إجراءات تحسين."""
    _user(x_session_token)
    connection = connect()
    try:
        payload = build_nafs_analytics(connection)
        connection.commit()
        return payload
    finally:
        connection.close()
