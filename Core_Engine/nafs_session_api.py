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
    from .nafs_school_record_40341 import (
        AVERAGE_MASTERY_PCT,
        ENROLLED,
        GRADE,
        SOURCE_CARD,
        TESTED,
        build_school_record_pack,
        tracks_pack,
    )

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
    enrolled = card.get("enrolled") or (meta or {}).get("enrolled_count") or ENROLLED
    tested = card.get("tested") or (meta or {}).get("tested_count") or TESTED
    mastery = (meta or {}).get("average_mastery_pct")
    if mastery is None:
        mastery = AVERAGE_MASTERY_PCT
    bank_count = int(
        connection.execute(
            "SELECT COUNT(*) FROM nafs_question_bank WHERE COALESCE(active,1)=1"
        ).fetchone()[0]
        or 0
    )
    school_record = build_school_record_pack(
        enrolled=enrolled,
        tested=tested,
        average_mastery_pct=mastery,
        question_bank_count=bank_count,
    )
    return {
        "ok": True,
        "card": card,
        "meta": {
            "grade": card.get("grade") or (meta or {}).get("grade") or GRADE,
            "enrolled": enrolled,
            "tested": tested,
            "average_mastery_pct": mastery,
            "source": (meta or {}).get("source") or SOURCE_CARD,
        },
        "tracks": tracks_pack(tested=tested),
        "school_record": school_record,
        "priority_skill": priority,
        "domains": domains,
        "indicators": _ordered_indicators(statements),
        "improvement_actions": _improvement_actions(connection),
        "timetable": _timetable_pack(connection),
    }


def _ordered_indicators(statements: dict[str, str]) -> list[dict]:
    """ترتيب رموز الاعتماد: 3-1-1-1 قراءة، 3-1-1-2 رياضيات، 3-1-1-3 علوم."""
    order = (
        ("reading", "القراءة", "3-1-1-1"),
        ("math", "الرياضيات", "3-1-1-2"),
        ("science", "العلوم", "3-1-1-3"),
    )
    return [
        {
            "code": code,
            "statement": statements.get(code, ""),
            "domain_key": key,
            "domain_label": label,
        }
        for key, label, code in order
    ]


def _qr_svg(url: str, scale: int = 3) -> str:
    try:
        import segno

        return segno.make(str(url or ""), error="m").svg_inline(scale=scale)
    except Exception:
        safe = (
            str(url or "")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">'
            f'<rect width="96" height="96" fill="#fff" stroke="#0b5e56"/>'
            f'<text x="48" y="52" text-anchor="middle" font-size="8" fill="#0b5e56">QR</text>'
            f"<title>{safe}</title></svg>"
        )


def _list_questions(connection, domain: str = "") -> list[dict]:
    from .nafs_question_bank_seed import ensure_nafs_question_bank

    ensure_nafs_question_bank(connection)
    params: list = []
    where = "WHERE COALESCE(active,1)=1"
    key = str(domain or "").strip().lower()
    if key in ("math", "reading", "science"):
        where += " AND domain = ?"
        params.append(key)
    try:
        from .nafs_misconception_lab import ensure_question_columns, enrich_question_traps

        ensure_question_columns(connection)
        enrich_question_traps(connection)
    except Exception:
        pass
    rows = connection.execute(
        f"""
        SELECT id, domain, skill, stem, choice_a, choice_b, choice_c, choice_d,
               correct, rationale, passage_id, passage_title, passage_text, sort_order,
               COALESCE(common_mistake,''), COALESCE(grade_root,''), COALESCE(golden_rule,'')
        FROM nafs_question_bank
        {where}
        ORDER BY
          CASE domain WHEN 'math' THEN 1 WHEN 'reading' THEN 2 WHEN 'science' THEN 3 ELSE 9 END,
          sort_order, id
        """,
        tuple(params),
    ).fetchall()
    return [
        {
            "id": int(row[0]),
            "domain": row[1] or "",
            "skill": row[2] or "",
            "stem": row[3] or "",
            "choices": {
                "A": row[4] or "",
                "B": row[5] or "",
                "C": row[6] or "",
                "D": row[7] or "",
            },
            "correct": (row[8] or "A").upper(),
            "rationale": row[9] or "",
            "passage_id": row[10] or "",
            "passage_title": row[11] or "",
            "passage_text": row[12] or "",
            "sort_order": int(row[13] or 0),
            "common_mistake": row[14] or "",
            "grade_root": row[15] or "",
            "golden_rule": row[16] or "",
        }
        for row in rows
    ]


def _achievement_team(connection) -> list[dict]:
    rows = connection.execute(
        """
        SELECT c.seat, c.national_id, COALESCE(n.name, ''), COALESCE(n.role, ''),
               COALESCE(n.specialty, '')
        FROM committee_seat c
        LEFT JOIN noor_staff n ON n.national_id = c.national_id
        WHERE c.committee_id = 'achievement'
        ORDER BY
          CASE c.seat WHEN 'chair' THEN 1 WHEN 'deputy' THEN 2 ELSE 3 END,
          c.sort_order, c.national_id
        """
    ).fetchall()
    seat_ar = {"chair": "رئيس", "deputy": "نائب", "member": "عضو"}
    return [
        {
            "seat": row[0] or "",
            "seat_label": seat_ar.get(str(row[0] or ""), row[0] or ""),
            "national_id": row[1] or "",
            "name": row[2] or "",
            "role": row[3] or "",
            "specialty": row[4] or "",
        }
        for row in rows
    ]


def _nafs_teachers(connection) -> list[dict]:
    rows = connection.execute(
        """
        SELECT national_id, name, role, specialty
        FROM noor_staff
        WHERE COALESCE(is_deleted, 0) = 0
          AND (
            specialty LIKE '%رياض%' OR specialty LIKE '%عربي%'
            OR specialty LIKE '%علوم%' OR specialty LIKE '%علم%'
          )
        ORDER BY specialty, name
        LIMIT 24
        """
    ).fetchall()
    return [
        {
            "national_id": row[0] or "",
            "name": row[1] or "",
            "role": row[2] or "",
            "specialty": row[3] or "",
        }
        for row in rows
    ]


def build_nafs_dossier(connection) -> dict:
    from .nafs_school_record_40341 import (
        EXAM_WINDOW,
        INITIATIVES,
        PLAN_WEEKS,
        QUESTION_BANK_BASELINE,
        mock_schedule,
        school_identity,
        tracks_pack,
    )

    analytics = build_nafs_analytics(connection)
    domains = analytics.get("domains") or []
    by_key = {row["key"]: row for row in domains}
    tested = _num(analytics.get("meta", {}).get("tested")) or 101
    # مسارات موثّقة (٧٦ علاجي / ٢٥ إثرائي) — بلا اشتقاق نسبي مختلق
    tracks = analytics.get("tracks") or tracks_pack(tested=tested)
    challenges = [
        {
            "key": "math",
            "label": "تحدي الأرقام",
            "url": "https://school1059.local/nafs/challenge/math",
        },
        {
            "key": "reading",
            "label": "قارئ الحصيف",
            "url": "https://school1059.local/nafs/challenge/reading",
        },
        {
            "key": "science",
            "label": "مختبر العلوم التفاعلي",
            "url": "https://school1059.local/nafs/challenge/science",
        },
    ]
    for item in challenges:
        item["qr_svg"] = _qr_svg(item["url"])
    sample_questions = _list_questions(connection)[:9]
    bank_count = connection.execute(
        "SELECT COUNT(*) FROM nafs_question_bank WHERE COALESCE(active,1)=1"
    ).fetchone()[0]
    mocks = mock_schedule()
    return {
        "ok": True,
        "school": school_identity(),
        "analytics": analytics,
        "school_record": analytics.get("school_record"),
        "tracks": tracks,
        "skills_matrix": {
            "math": 15,
            "science": 10,
            "reading_levels": [
                "الفهم الحرفي",
                "الفهم الاستنتاجي",
                "الفهم الناقد",
                "التذوق البلاغي",
            ],
            "priority_skills": [
                {
                    "domain": "الرياضيات",
                    "name": (by_key.get("math") or {}).get("weakest_skill") or "الجبر",
                    "score": (by_key.get("math") or {}).get("weakest_score"),
                },
                {
                    "domain": "القراءة",
                    "name": (by_key.get("reading") or {}).get("weakest_skill")
                    or "دلالات الألفاظ",
                    "score": (by_key.get("reading") or {}).get("weakest_score"),
                },
                {
                    "domain": "العلوم",
                    "name": (by_key.get("science") or {}).get("weakest_skill")
                    or "العلوم الفيزيائية والكيميائية",
                    "score": (by_key.get("science") or {}).get("weakest_score"),
                },
            ],
        },
        "achievement_committee": _achievement_team(connection),
        "nafs_teachers": _nafs_teachers(connection),
        "initiatives": list(INITIATIVES),
        "mocks": [row["name"] for row in mocks],
        "mock_tiers": mocks,
        "exam_window": EXAM_WINDOW,
        "weeks": PLAN_WEEKS,
        "challenges": challenges,
        "sample_questions": sample_questions,
        "question_bank_count": bank_count,
        "question_bank_baseline": QUESTION_BANK_BASELINE,
    }


def ensure_on_boot(connection) -> None:
    from .nafs_question_bank_seed import ensure_nafs_question_bank

    ensure_nafs_question_bank(connection)


@router.get("/api/session/nafs/analytics")
def nafs_analytics(x_session_token: str = Header(default="")):
    """لوحة تحليل نافس الحية: بطاقة + مجالات + حصص + إجراءات تحسين."""
    _user(x_session_token)
    connection = connect()
    try:
        from .nafs_question_bank_seed import ensure_nafs_question_bank

        ensure_nafs_question_bank(connection)
        payload = build_nafs_analytics(connection)
        connection.commit()
        return payload
    finally:
        connection.close()


@router.get("/api/session/nafs/questions")
def nafs_questions(
    domain: str = "",
    x_session_token: str = Header(default=""),
):
    """بنك أسئلة نافس المصحّح (١٥٠+) — للتصفح والتحضير وللسجل المطبوع."""
    _user(x_session_token)
    connection = connect()
    try:
        items = _list_questions(connection, domain=domain)
        counts = {"math": 0, "reading": 0, "science": 0, "total": len(items)}
        for row in connection.execute(
            """
            SELECT domain, COUNT(*) FROM nafs_question_bank
            WHERE COALESCE(active,1)=1
            GROUP BY domain
            """
        ).fetchall():
            key = str(row[0] or "")
            if key in counts:
                counts[key] = int(row[1] or 0)
        counts["total"] = sum(counts[k] for k in ("math", "reading", "science"))
        connection.commit()
        return {"ok": True, "counts": counts, "items": items}
    finally:
        connection.close()


@router.get("/api/session/nafs/dossier")
def nafs_dossier(x_session_token: str = Header(default="")):
    """حزمة سجل نافس المدرسي المتكامل (7 صفحات) من SSOT."""
    _user(x_session_token)
    connection = connect()
    try:
        from .nafs_question_bank_seed import ensure_nafs_question_bank

        ensure_nafs_question_bank(connection)
        payload = build_nafs_dossier(connection)
        connection.commit()
        return payload
    finally:
        connection.close()


@router.get("/api/session/nafs/school-record")
def nafs_school_record(x_session_token: str = Header(default="")):
    """مرجع قراءة سجل 40341 للوحة المعلم/المالك — أرقام موثّقة فقط."""
    _user(x_session_token)
    connection = connect()
    try:
        from .nafs_question_bank_seed import ensure_nafs_question_bank

        ensure_nafs_question_bank(connection)
        analytics = build_nafs_analytics(connection)
        connection.commit()
        pack = analytics.get("school_record") or {}
        pack["ok"] = True
        return pack
    finally:
        connection.close()


@router.get("/api/session/nafs/answer-sheet-training")
def nafs_answer_sheet_training(x_session_token: str = Header(default="")):
    """موجة ج: نموذج إجابة نافس + استبانة الطالب (A4) — بلا مفاتيح وبلا اختلاق نصوص البنود."""
    _user(x_session_token)
    from .nafs_wave_c_answer_sheet import build_training_form_pack

    return build_training_form_pack()
