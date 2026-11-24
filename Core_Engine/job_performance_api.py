# تقويم الأداء الوظيفي لشاغلي الوظائف التعليمية — المرحلة 1 (مخطط + API).
# المرجع: دليل إدارة الأداء الوظيفي (إصدار 2). النظام التقني للوزارة هو المرجع الاعتمادي النهائي.
# التقييم الذاتي مرجع بصري غير محتسب في الدرجة النهائية.

from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect
from .job_performance_role_bank import ROLE_ALIASES, all_extra_templates
from .job_performance_seed import (
    ROLE_CODES,
    compute_totals,
    teacher_template_payload,
)

router = APIRouter(tags=["job-performance"])

PHASES_MANAGER = ("mid", "final")
PHASES_SELF = ("self_mid", "self_final")
DEFAULT_CYCLE_YEAR = "1447/1448"


class CycleBody(BaseModel):
    academic_year: str = DEFAULT_CYCLE_YEAR
    label: str = ""
    starts_at: str = ""
    ends_at: str = ""
    status: str = "open"
    note: str = ""


class RecordBody(BaseModel):
    cycle_id: int
    staff_id: str = ""
    assignment_role: str = "teacher"


class ScoresBody(BaseModel):
    phase: str = "mid"
    scores: list[dict] = Field(default_factory=list)


class GapPlanBody(BaseModel):
    element_id: str = ""
    current_rating: int | None = None
    reasons: str = ""
    strengths: str = ""
    improve_areas: str = ""
    action_steps: list[dict] = Field(default_factory=list)
    requirements: str = ""
    team: str = ""
    partners: str = ""
    status: str = "open"


class IdpBody(BaseModel):
    goals: list[dict] = Field(default_factory=list)
    start_date: str = ""
    end_date: str = ""
    notes: str = ""


def _stamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _user(token: str) -> dict:
    from .access import require_user

    try:
        return require_user(str(token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _leadership(token: str) -> dict:
    user = _user(token)
    role = str(user.get("role") or "")
    if role.startswith("مدير") or "وكيل" in role:
        return user
    raise HTTPException(status_code=403, detail="تقويم الأداء الوظيفي للمدير والوكيل")


def ensure_assignment_role_column(connection) -> None:
    columns = {row[1] for row in connection.execute("PRAGMA table_info(noor_staff)")}
    if columns and "assignment_role" not in columns:
        connection.execute(
            "ALTER TABLE noor_staff ADD COLUMN assignment_role TEXT NOT NULL DEFAULT ''"
        )


def ensure_job_performance_tables(connection) -> None:
    ensure_assignment_role_column(connection)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS perf_role_templates (
            role_code TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            elements_json TEXT NOT NULL,
            source_note TEXT NOT NULL DEFAULT '',
            version INTEGER NOT NULL DEFAULT 1,
            active INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS perf_cycles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            academic_year TEXT NOT NULL,
            label TEXT NOT NULL DEFAULT '',
            starts_at TEXT NOT NULL DEFAULT '',
            ends_at TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'open',
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (academic_year)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS perf_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cycle_id INTEGER NOT NULL,
            staff_id TEXT NOT NULL,
            staff_name TEXT NOT NULL DEFAULT '',
            assignment_role TEXT NOT NULL DEFAULT 'teacher',
            template_version INTEGER NOT NULL DEFAULT 1,
            weights_snapshot_json TEXT NOT NULL,
            mid_percent REAL,
            final_percent REAL,
            mid_band INTEGER,
            final_band INTEGER,
            mid_band_label TEXT NOT NULL DEFAULT '',
            final_band_label TEXT NOT NULL DEFAULT '',
            readiness_mid REAL NOT NULL DEFAULT 0,
            readiness_final REAL NOT NULL DEFAULT 0,
            created_by TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (cycle_id, staff_id),
            FOREIGN KEY (cycle_id) REFERENCES perf_cycles(id)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS perf_element_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id INTEGER NOT NULL,
            phase TEXT NOT NULL,
            element_id TEXT NOT NULL,
            rating INTEGER,
            note TEXT NOT NULL DEFAULT '',
            updated_by TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL,
            UNIQUE (record_id, phase, element_id),
            FOREIGN KEY (record_id) REFERENCES perf_records(id)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS perf_gap_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id INTEGER NOT NULL,
            element_id TEXT NOT NULL,
            current_rating INTEGER,
            reasons TEXT NOT NULL DEFAULT '',
            strengths TEXT NOT NULL DEFAULT '',
            improve_areas TEXT NOT NULL DEFAULT '',
            action_steps_json TEXT NOT NULL DEFAULT '[]',
            requirements TEXT NOT NULL DEFAULT '',
            team TEXT NOT NULL DEFAULT '',
            partners TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'open',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (record_id, element_id),
            FOREIGN KEY (record_id) REFERENCES perf_records(id)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS perf_idp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id INTEGER NOT NULL UNIQUE,
            goals_json TEXT NOT NULL DEFAULT '[]',
            start_date TEXT NOT NULL DEFAULT '',
            end_date TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (record_id) REFERENCES perf_records(id)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS perf_evidence_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id INTEGER NOT NULL,
            element_id TEXT NOT NULL DEFAULT '',
            source_kind TEXT NOT NULL,
            source_id TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            summary TEXT NOT NULL DEFAULT '',
            meta_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            UNIQUE (record_id, source_kind, source_id, element_id),
            FOREIGN KEY (record_id) REFERENCES perf_records(id)
        )
        """
    )
    seed_teacher_template(connection)
    seed_role_templates(connection)
    seed_default_cycle(connection)
    ensure_staff_assignment_fixes(connection)


def normalize_role_code(role_code: str) -> str:
    key = str(role_code or "").strip() or "teacher"
    return ROLE_ALIASES.get(key, key)


def seed_role_templates(connection) -> None:
    moment = _stamp()
    for payload in all_extra_templates():
        role_code = payload["role_code"]
        blob = json.dumps(payload, ensure_ascii=False)
        existing = connection.execute(
            "SELECT version FROM perf_role_templates WHERE role_code = ?",
            (role_code,),
        ).fetchone()
        if existing:
            connection.execute(
                """
                UPDATE perf_role_templates
                SET title = ?, elements_json = ?, source_note = ?, active = 1, updated_at = ?
                WHERE role_code = ?
                """,
                (payload["title"], blob, payload["source"], moment, role_code),
            )
        else:
            connection.execute(
                """
                INSERT INTO perf_role_templates (
                    role_code, title, elements_json, source_note, version, active, updated_at
                ) VALUES (?, ?, ?, ?, 1, 1, ?)
                """,
                (role_code, payload["title"], blob, payload["source"], moment),
            )


COMMITTEE_TITLES = {
    "admin": "اللجنة الإدارية",
    "guidance": "لجنة التوجيه والإرشاد",
    "achievement": "لجنة التحصيل الدراسي",
    "excellence": "لجنة التميز",
    "fund": "فريق عمل الصندوق المدرسي",
    "budget": "لجنة الميزانية التشغيلية",
    "safety": "فريق عمل الأمن والسلامة المدرسية",
    "activity": "لجنة النشاط الطلابي",
    "discipline": "لجنة الانضباط المدرسي",
    "special": "لجنة التربية الخاصة",
}

SEAT_LABELS = {
    "chair": "رئيس",
    "deputy": "نائب",
    "secretary": "أمين سر",
    "member": "عضو",
    "student": "طالب",
    "parent": "ولي أمر",
}

# ربط شاهد → عناصر (مرجع بصري فقط — بلا فرض درجة).
EVIDENCE_ELEMENT_MAP = {
    "classroom_visit": ("strategies", "learning_env", "classroom_mgmt", "assessment_variety"),
    "committee": ("duties", "professional_community"),
    "nafes": ("learner_outcomes", "results_analysis"),
}


def _gather_live_evidence(connection, staff_id: str, specialty: str = "") -> list[dict]:
    """يجمع شواهد حية من النظام دون تعديل درجات التقويم."""
    items: list[dict] = []
    visits = connection.execute(
        """
        SELECT id, visit_type, subject, total, band, visit_date, visit_date_hijri, grade, lesson
        FROM classroom_visits
        WHERE teacher_id = ?
        ORDER BY id DESC
        LIMIT 20
        """,
        (staff_id,),
    ).fetchall()
    for row in visits:
        total = row[3]
        try:
            total_num = float(total) if total is not None else 0.0
        except (TypeError, ValueError):
            total_num = 0.0
        # استبعاد المسودات وزيارات الدرجة 0 من شواهد التقويم.
        if total is None or total_num <= 0:
            continue
        vid = str(row[0])
        date_bit = row[6] or row[5] or ""
        band = row[4] or ""
        lesson = row[8] or ""
        subject = row[2] or ""
        line_bits = [
            f"زيارة صفية ({date_bit})" if date_bit else "زيارة صفية",
            f"{total_num:g}%" + (f" — {band}" if band else ""),
            subject,
            lesson,
        ]
        line = " · ".join([b for b in line_bits if b])
        items.append(
            {
                "source_kind": "classroom_visit",
                "source_id": vid,
                "title": line,
                "summary": "",
                "meta": {
                    "visit_type": row[1] or "",
                    "subject": subject,
                    "total": total,
                    "band": band,
                },
                "element_ids": list(EVIDENCE_ELEMENT_MAP["classroom_visit"]),
            }
        )

    seats = connection.execute(
        """
        SELECT committee_id, seat, COALESCE(display_name, '')
        FROM committee_seat
        WHERE national_id = ?
        ORDER BY committee_id, sort_order
        """,
        (staff_id,),
    ).fetchall()
    for row in seats:
        cid = str(row[0] or "")
        seat = str(row[1] or "")
        title = COMMITTEE_TITLES.get(cid, cid or "لجنة مدرسية")
        seat_label = SEAT_LABELS.get(seat, seat) or "عضو"
        items.append(
            {
                "source_kind": "committee",
                "source_id": f"{cid}:{seat}:{staff_id}",
                "title": f"{seat_label}: {title}",
                "summary": "",
                "meta": {"committee_id": cid, "seat": seat},
                "element_ids": list(EVIDENCE_ELEMENT_MAP["committee"]),
            }
        )

    # نافس على مستوى المدرسة — يُعرض كسياق نتائج إن وُجدت بطاقات.
    nafs_rows = connection.execute(
        """
        SELECT id, grade, enrolled, tested, reading_score, science_score, math_score,
               weakest_skill, weakest_score
        FROM nafs_cards
        ORDER BY id DESC
        LIMIT 5
        """
    ).fetchall()
    spec = specialty or ""
    for row in nafs_rows:
        nid = str(row[0])
        focus = []
        if "رياض" in spec or "math" in spec.lower():
            focus.append(f"رياضيات {row[6] or '—'}")
        if "عربي" in spec or "قراء" in spec:
            focus.append(f"قراءة {row[4] or '—'}")
        if "علوم" in spec or "أحياء" in spec or "فيزياء" in spec or "كيمياء" in spec:
            focus.append(f"علوم {row[5] or '—'}")
        if not focus:
            focus = [
                f"قراءة {row[4] or '—'}",
                f"علوم {row[5] or '—'}",
                f"رياضيات {row[6] or '—'}",
            ]
        line = " · ".join(
            [
                f"نتائج نافس — {row[1] or 'مرحلة'}",
                f"مختبرون {row[3] or '—'}/{row[2] or '—'}",
                " · ".join(focus),
                (f"أضعف مهارة: {row[7]} ({row[8]})" if row[7] else ""),
            ]
        )
        items.append(
            {
                "source_kind": "nafes",
                "source_id": nid,
                "title": line,
                "summary": "",
                "meta": {
                    "grade": row[1] or "",
                    "school_level": True,
                    "note": "شاهد مدرسي سياقي — لا يفرض درجة على المعلم",
                },
                "element_ids": list(EVIDENCE_ELEMENT_MAP["nafes"]),
            }
        )
    return items


# تصحيحات إسناد معتمدة لمدرسة سعد بن الربيع (بيانات حقيقية).
STAFF_ASSIGNMENT_FIXES = {
    "1008379958": {"assignment_role": "vice_principal", "role": "وكيل"},  # احمد علي هيازع الشهري
    "1036307674": {"assignment_role": "admin_staff", "role": "أداري"},  # عبدالمجيد محمد رميزان المرواني
}


def ensure_staff_assignment_fixes(connection) -> None:
    ensure_assignment_role_column(connection)
    moment = _stamp()
    for staff_id, patch in STAFF_ASSIGNMENT_FIXES.items():
        row = connection.execute(
            """
            SELECT role, COALESCE(assignment_role, '')
            FROM noor_staff
            WHERE national_id = ? AND COALESCE(is_deleted, 0) = 0
            """,
            (staff_id,),
        ).fetchone()
        if not row:
            continue
        next_role = patch.get("role") or row[0] or ""
        next_assign = patch.get("assignment_role") or ""
        if str(row[0] or "") == next_role and str(row[1] or "") == next_assign:
            continue
        connection.execute(
            """
            UPDATE noor_staff
            SET role = ?, assignment_role = ?, updated_at = ?
            WHERE national_id = ?
            """,
            (next_role, next_assign, moment, staff_id),
        )


def sync_evidence_links(connection, record_id: int) -> dict:
    """يحدّث perf_evidence_links من المصادر الحية (قراءة/مزامنة عرض فقط)."""
    row = connection.execute(
        "SELECT staff_id FROM perf_records WHERE id = ?",
        (record_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="سجل التقويم غير موجود")
    staff_id = str(row[0])
    staff = connection.execute(
        "SELECT specialty FROM noor_staff WHERE national_id = ?",
        (staff_id,),
    ).fetchone()
    specialty = str(staff[0] or "") if staff else ""
    live = _gather_live_evidence(connection, staff_id, specialty)
    moment = _stamp()
    connection.execute(
        "DELETE FROM perf_evidence_links WHERE record_id = ?",
        (record_id,),
    )
    flat = []
    by_element: dict[str, list] = {}
    for item in live:
        element_ids = item.get("element_ids") or [""]
        for eid in element_ids:
            connection.execute(
                """
                INSERT INTO perf_evidence_links (
                    record_id, element_id, source_kind, source_id, title, summary, meta_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_id,
                    eid,
                    item["source_kind"],
                    item["source_id"],
                    item["title"],
                    item["summary"],
                    json.dumps(item.get("meta") or {}, ensure_ascii=False),
                    moment,
                ),
            )
            entry = {
                "element_id": eid,
                "source_kind": item["source_kind"],
                "source_id": item["source_id"],
                "title": item["title"],
                "summary": item["summary"],
                "meta": item.get("meta") or {},
            }
            flat.append(entry)
            by_element.setdefault(eid, []).append(entry)
    return {
        "record_id": record_id,
        "staff_id": staff_id,
        "count": len(flat),
        "items": flat,
        "by_element": by_element,
        "auto_score": False,
        "note": "شواهد حية للمرجعية البصرية فقط — لا تُفرض درجات تلقائياً.",
    }


def seed_teacher_template(connection) -> None:
    payload = teacher_template_payload()
    moment = _stamp()
    existing = connection.execute(
        "SELECT version FROM perf_role_templates WHERE role_code = ?",
        ("teacher",),
    ).fetchone()
    blob = json.dumps(payload, ensure_ascii=False)
    if existing:
        connection.execute(
            """
            UPDATE perf_role_templates
            SET title = ?, elements_json = ?, source_note = ?, active = 1, updated_at = ?
            WHERE role_code = ?
            """,
            (
                payload["title"],
                blob,
                payload["source"],
                moment,
                "teacher",
            ),
        )
    else:
        connection.execute(
            """
            INSERT INTO perf_role_templates (
                role_code, title, elements_json, source_note, version, active, updated_at
            ) VALUES (?, ?, ?, ?, 1, 1, ?)
            """,
            (
                "teacher",
                payload["title"],
                blob,
                payload["source"],
                moment,
            ),
        )


def seed_default_cycle(connection) -> None:
    row = connection.execute(
        "SELECT id FROM perf_cycles WHERE academic_year = ?",
        (DEFAULT_CYCLE_YEAR,),
    ).fetchone()
    if row:
        return
    moment = _stamp()
    connection.execute(
        """
        INSERT INTO perf_cycles (
            academic_year, label, starts_at, ends_at, status, note, created_at, updated_at
        ) VALUES (?, ?, '', '', 'open', ?, ?, ?)
        """,
        (
            DEFAULT_CYCLE_YEAR,
            "دورة الأداء الوظيفي " + DEFAULT_CYCLE_YEAR + "هـ",
            "تنتهي الدورة بنهاية العام الدراسي. المرجع الاعتمادي النهائي: النظام التقني الرسمي لوزارة التعليم.",
            moment,
            moment,
        ),
    )


def _template_row(connection, role_code: str) -> dict:
    code = normalize_role_code(role_code)
    row = connection.execute(
        """
        SELECT role_code, title, elements_json, source_note, version, active
        FROM perf_role_templates
        WHERE role_code = ? AND active = 1
        """,
        (code,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="قالب الدور غير موجود")
    payload = json.loads(row[2] or "{}")
    elements = payload.get("elements") or []
    return {
        "role_code": row[0],
        "title": row[1],
        "elements": elements,
        "band_labels": payload.get("band_labels") or {},
        "source_note": row[3] or "",
        "version": int(row[4] or 1),
        "regulatory_framework": payload.get("regulatory_framework") or "",
        "score_model": payload.get("score_model") or {},
        "excellence_ruler": {
            "level": 5,
            "label": "مثالي",
            "by_element": {
                str(item.get("id") or ""): str((item.get("levels") or {}).get("5") or "")
                for item in elements
            },
        },
    }


def _staff_name(connection, staff_id: str) -> str:
    row = connection.execute(
        "SELECT name FROM noor_staff WHERE national_id = ? AND COALESCE(is_deleted, 0) = 0",
        (staff_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="المنسوب غير موجود")
    return str(row[0] or "")


def _snapshot_from_template(template: dict) -> list[dict]:
    out = []
    for item in template.get("elements") or []:
        entry = {
            "id": item.get("id"),
            "label": item.get("label"),
            "weight": item.get("weight"),
            "description": item.get("description"),
            "levels": item.get("levels") or {},
        }
        if item.get("section"):
            entry["section"] = item.get("section")
        if item.get("section_label"):
            entry["section_label"] = item.get("section_label")
        out.append(entry)
    return out


def _scores_map(connection, record_id: int, phase: str) -> dict[str, int | None]:
    rows = connection.execute(
        """
        SELECT element_id, rating, note
        FROM perf_element_scores
        WHERE record_id = ? AND phase = ?
        """,
        (record_id, phase),
    ).fetchall()
    return {
        str(row[0]): (int(row[1]) if row[1] is not None else None)
        for row in rows
    }


def _scores_detail(connection, record_id: int, phase: str) -> list[dict]:
    rows = connection.execute(
        """
        SELECT element_id, rating, note, updated_by, updated_at
        FROM perf_element_scores
        WHERE record_id = ? AND phase = ?
        ORDER BY element_id
        """,
        (record_id, phase),
    ).fetchall()
    return [
        {
            "element_id": row[0],
            "rating": row[1],
            "note": row[2] or "",
            "updated_by": row[3] or "",
            "updated_at": row[4] or "",
        }
        for row in rows
    ]


def _refresh_record_totals(connection, record_id: int) -> dict:
    row = connection.execute(
        "SELECT weights_snapshot_json FROM perf_records WHERE id = ?",
        (record_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="سجل التقويم غير موجود")
    elements = json.loads(row[0] or "[]")
    mid = compute_totals(elements, _scores_map(connection, record_id, "mid"))
    final = compute_totals(elements, _scores_map(connection, record_id, "final"))
    moment = _stamp()
    connection.execute(
        """
        UPDATE perf_records
        SET mid_percent = ?, final_percent = ?,
            mid_band = ?, final_band = ?,
            mid_band_label = ?, final_band_label = ?,
            readiness_mid = ?, readiness_final = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            mid["percent"] if mid["scored_count"] else None,
            final["percent"] if final["scored_count"] else None,
            mid["band"] or None,
            final["band"] or None,
            mid["band_label"],
            final["band_label"],
            mid["readiness_percent"],
            final["readiness_percent"],
            moment,
            record_id,
        ),
    )
    return {"mid": mid, "final": final}


def _record_payload(connection, record_id: int) -> dict:
    row = connection.execute(
        """
        SELECT id, cycle_id, staff_id, staff_name, assignment_role, template_version,
               weights_snapshot_json, mid_percent, final_percent, mid_band, final_band,
               mid_band_label, final_band_label, readiness_mid, readiness_final,
               created_by, created_at, updated_at
        FROM perf_records WHERE id = ?
        """,
        (record_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="سجل التقويم غير موجود")
    elements = json.loads(row[6] or "[]")
    return {
        "id": row[0],
        "cycle_id": row[1],
        "staff_id": row[2],
        "staff_name": row[3],
        "assignment_role": row[4],
        "template_version": row[5],
        "weights_snapshot": elements,
        "excellence_ruler": {
            "level": 5,
            "label": "مثالي",
            "by_element": {
                str(item.get("id") or ""): str((item.get("levels") or {}).get("5") or "")
                for item in elements
            },
        },
        "mid_percent": row[7],
        "final_percent": row[8],
        "mid_band": row[9],
        "final_band": row[10],
        "mid_band_label": row[11] or "",
        "final_band_label": row[12] or "",
        "readiness_mid": row[13],
        "readiness_final": row[14],
        "created_by": row[15] or "",
        "created_at": row[16] or "",
        "updated_at": row[17] or "",
        "scores": {
            "mid": _scores_detail(connection, record_id, "mid"),
            "final": _scores_detail(connection, record_id, "final"),
            "self_mid": _scores_detail(connection, record_id, "self_mid"),
            "self_final": _scores_detail(connection, record_id, "self_final"),
        },
        "self_assessment_note": "التقييم الذاتي مرجع بصري ولا يدخل في احتساب الدرجة النهائية.",
        "ministry_ssot_note": "النظام التقني الرسمي لوزارة التعليم هو المرجع الاعتمادي النهائي.",
    }


@router.get("/api/session/job-performance/meta")
def job_performance_meta(x_session_token: str = Header(default="")):
    _user(x_session_token)
    return {
        "role_codes": ROLE_CODES,
        "role_aliases": ROLE_ALIASES,
        "phases_manager": list(PHASES_MANAGER),
        "phases_self": list(PHASES_SELF),
        "default_cycle_year": DEFAULT_CYCLE_YEAR,
        "self_assessment_counted": False,
        "ministry_ssot": True,
        "excluded_roles": ["kindergarten"],
        "deferred_roles": [],
        "regulatory_frameworks": {
            "educational": "دليل إدارة الأداء الوظيفي لشاغلي الوظائف التعليمية",
            "admin_staff": "لائحة الموارد البشرية العامة",
        },
    }


@router.get("/api/session/job-performance/templates")
def list_templates(x_session_token: str = Header(default="")):
    _user(x_session_token)
    connection = connect()
    try:
        ensure_job_performance_tables(connection)
        connection.commit()
        rows = connection.execute(
            """
            SELECT role_code, title, version, active, updated_at
            FROM perf_role_templates
            ORDER BY role_code
            """
        ).fetchall()
        return {
            "items": [
                {
                    "role_code": row[0],
                    "title": row[1],
                    "version": row[2],
                    "active": bool(row[3]),
                    "updated_at": row[4] or "",
                    "seeded": row[0] == "teacher",
                }
                for row in rows
            ],
            "planned_roles": ROLE_CODES,
        }
    finally:
        connection.close()


@router.get("/api/session/job-performance/templates/{role_code}")
def get_template(role_code: str, x_session_token: str = Header(default="")):
    _user(x_session_token)
    connection = connect()
    try:
        ensure_job_performance_tables(connection)
        connection.commit()
        return _template_row(connection, role_code.strip())
    finally:
        connection.close()


@router.get("/api/session/job-performance/cycles")
def list_cycles(x_session_token: str = Header(default="")):
    _user(x_session_token)
    connection = connect()
    try:
        ensure_job_performance_tables(connection)
        connection.commit()
        rows = connection.execute(
            """
            SELECT id, academic_year, label, starts_at, ends_at, status, note, created_at, updated_at
            FROM perf_cycles
            ORDER BY id DESC
            """
        ).fetchall()
        return {
            "items": [
                {
                    "id": row[0],
                    "academic_year": row[1],
                    "label": row[2] or "",
                    "starts_at": row[3] or "",
                    "ends_at": row[4] or "",
                    "status": row[5] or "",
                    "note": row[6] or "",
                    "created_at": row[7] or "",
                    "updated_at": row[8] or "",
                }
                for row in rows
            ]
        }
    finally:
        connection.close()


@router.post("/api/session/job-performance/cycles")
def create_cycle(body: CycleBody, x_session_token: str = Header(default="")):
    _leadership(x_session_token)
    year = body.academic_year.strip() or DEFAULT_CYCLE_YEAR
    moment = _stamp()
    connection = connect()
    try:
        ensure_job_performance_tables(connection)
        existing = connection.execute(
            "SELECT id FROM perf_cycles WHERE academic_year = ?",
            (year,),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="دورة هذا العام موجودة مسبقاً")
        cursor = connection.execute(
            """
            INSERT INTO perf_cycles (
                academic_year, label, starts_at, ends_at, status, note, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                year,
                body.label.strip() or ("دورة الأداء الوظيفي " + year + "هـ"),
                body.starts_at.strip(),
                body.ends_at.strip(),
                body.status.strip() or "open",
                body.note.strip(),
                moment,
                moment,
            ),
        )
        connection.commit()
        return {"id": int(cursor.lastrowid), "academic_year": year}
    finally:
        connection.close()


@router.get("/api/session/job-performance/records")
def list_records(cycle_id: int = 0, x_session_token: str = Header(default="")):
    _user(x_session_token)
    connection = connect()
    try:
        ensure_job_performance_tables(connection)
        connection.commit()
        if cycle_id:
            rows = connection.execute(
                """
                SELECT id, cycle_id, staff_id, staff_name, assignment_role,
                       mid_percent, final_percent, mid_band_label, final_band_label,
                       readiness_mid, readiness_final, updated_at
                FROM perf_records WHERE cycle_id = ?
                ORDER BY staff_name
                """,
                (cycle_id,),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT id, cycle_id, staff_id, staff_name, assignment_role,
                       mid_percent, final_percent, mid_band_label, final_band_label,
                       readiness_mid, readiness_final, updated_at
                FROM perf_records
                ORDER BY id DESC
                """
            ).fetchall()
        return {
            "items": [
                {
                    "id": row[0],
                    "cycle_id": row[1],
                    "staff_id": row[2],
                    "staff_name": row[3],
                    "assignment_role": row[4],
                    "mid_percent": row[5],
                    "final_percent": row[6],
                    "mid_band_label": row[7] or "",
                    "final_band_label": row[8] or "",
                    "readiness_mid": row[9],
                    "readiness_final": row[10],
                    "updated_at": row[11] or "",
                }
                for row in rows
            ]
        }
    finally:
        connection.close()


class AssignmentRoleBody(BaseModel):
    assignment_role: str = "teacher"


@router.put("/api/session/job-performance/staff/{staff_id}/assignment-role")
def set_assignment_role(
    staff_id: str, body: AssignmentRoleBody, x_session_token: str = Header(default="")
):
    """تحديد/تعديل إسناد قالب التقويم للمنسوب."""
    _leadership(x_session_token)
    role_code = normalize_role_code(body.assignment_role)
    if role_code not in ROLE_CODES:
        raise HTTPException(status_code=400, detail="رمز الدور غير معتمد")
    moment = _stamp()
    connection = connect()
    try:
        ensure_job_performance_tables(connection)
        exists = connection.execute(
            "SELECT national_id FROM noor_staff WHERE national_id = ? AND COALESCE(is_deleted,0)=0",
            (staff_id.strip(),),
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="المنسوب غير موجود")
        # تأكيد وجود القالب
        _template_row(connection, role_code)
        connection.execute(
            "UPDATE noor_staff SET assignment_role = ?, updated_at = ? WHERE national_id = ?",
            (role_code, moment, staff_id.strip()),
        )
        connection.commit()
        return {"staff_id": staff_id.strip(), "assignment_role": role_code}
    finally:
        connection.close()


@router.post("/api/session/job-performance/records")
def create_record(body: RecordBody, x_session_token: str = Header(default="")):
    user = _leadership(x_session_token)
    staff_id = body.staff_id.strip()
    role_code = normalize_role_code(body.assignment_role or "teacher")
    if role_code not in ROLE_CODES:
        raise HTTPException(status_code=400, detail="رمز الدور غير معتمد")
    if not staff_id:
        raise HTTPException(status_code=400, detail="معرّف المنسوب مطلوب")
    moment = _stamp()
    connection = connect()
    try:
        ensure_job_performance_tables(connection)
        cycle = connection.execute(
            "SELECT id, status FROM perf_cycles WHERE id = ?",
            (body.cycle_id,),
        ).fetchone()
        if not cycle:
            raise HTTPException(status_code=404, detail="الدورة غير موجودة")
        name = _staff_name(connection, staff_id)
        template = _template_row(connection, role_code)
        snapshot = _snapshot_from_template(template)
        if abs(sum(float(item.get("weight") or 0) for item in snapshot) - 100) > 0.01:
            raise HTTPException(status_code=500, detail="لقطة الأوزان غير مكتملة")
        existing = connection.execute(
            "SELECT id FROM perf_records WHERE cycle_id = ? AND staff_id = ?",
            (body.cycle_id, staff_id),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="سجل التقويم لهذا المعلم في الدورة موجود")
        connection.execute(
            """
            UPDATE noor_staff SET assignment_role = ?, updated_at = ?
            WHERE national_id = ?
            """,
            (role_code, moment, staff_id),
        )
        cursor = connection.execute(
            """
            INSERT INTO perf_records (
                cycle_id, staff_id, staff_name, assignment_role, template_version,
                weights_snapshot_json, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                body.cycle_id,
                staff_id,
                name,
                role_code,
                int(template["version"]),
                json.dumps(snapshot, ensure_ascii=False),
                str(user.get("id") or ""),
                moment,
                moment,
            ),
        )
        record_id = int(cursor.lastrowid)
        connection.commit()
        return _record_payload(connection, record_id)
    finally:
        connection.close()


@router.get("/api/session/job-performance/records/{record_id}")
def get_record(record_id: int, x_session_token: str = Header(default="")):
    _user(x_session_token)
    connection = connect()
    try:
        ensure_job_performance_tables(connection)
        connection.commit()
        payload = _record_payload(connection, record_id)
        gap = connection.execute(
            """
            SELECT id, element_id, current_rating, reasons, strengths, improve_areas,
                   action_steps_json, requirements, team, partners, status, updated_at
            FROM perf_gap_plans WHERE record_id = ?
            """,
            (record_id,),
        ).fetchall()
        idp = connection.execute(
            """
            SELECT goals_json, start_date, end_date, notes, updated_at
            FROM perf_idp WHERE record_id = ?
            """,
            (record_id,),
        ).fetchone()
        payload["gap_plans"] = [
            {
                "id": row[0],
                "element_id": row[1],
                "current_rating": row[2],
                "reasons": row[3] or "",
                "strengths": row[4] or "",
                "improve_areas": row[5] or "",
                "action_steps": json.loads(row[6] or "[]"),
                "requirements": row[7] or "",
                "team": row[8] or "",
                "partners": row[9] or "",
                "status": row[10] or "",
                "updated_at": row[11] or "",
            }
            for row in gap
        ]
        payload["idp"] = (
            {
                "goals": json.loads(idp[0] or "[]"),
                "start_date": idp[1] or "",
                "end_date": idp[2] or "",
                "notes": idp[3] or "",
                "updated_at": idp[4] or "",
                "method": "70-20-10",
            }
            if idp
            else None
        )
        evidence = sync_evidence_links(connection, record_id)
        connection.commit()
        payload["evidence"] = evidence
        return payload
    finally:
        connection.close()


@router.get("/api/session/job-performance/records/{record_id}/evidence")
def get_record_evidence(record_id: int, x_session_token: str = Header(default="")):
    """لوحة الشواهد الحية — قراءة فقط مع مزامنة روابط العرض."""
    _user(x_session_token)
    connection = connect()
    try:
        ensure_job_performance_tables(connection)
        pack = sync_evidence_links(connection, record_id)
        connection.commit()
        return pack
    finally:
        connection.close()


def _save_scores(connection, record_id: int, phase: str, scores: list[dict], user_id: str) -> None:
    row = connection.execute(
        "SELECT weights_snapshot_json FROM perf_records WHERE id = ?",
        (record_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="سجل التقويم غير موجود")
    allowed = {
        str(item.get("id") or "")
        for item in json.loads(row[0] or "[]")
    }
    moment = _stamp()
    for item in scores:
        eid = str(item.get("element_id") or item.get("id") or "").strip()
        if eid not in allowed:
            raise HTTPException(status_code=400, detail="عنصر غير معتمد في لقطة السجل: " + eid)
        rating = item.get("rating")
        if rating is not None and rating != "":
            try:
                rating_i = int(rating)
            except (TypeError, ValueError) as error:
                raise HTTPException(status_code=400, detail="تقدير غير صالح") from error
            if rating_i < 1 or rating_i > 5:
                raise HTTPException(status_code=400, detail="التقدير من 1 إلى 5")
        else:
            rating_i = None
        note = str(item.get("note") or "").strip()
        connection.execute(
            """
            INSERT INTO perf_element_scores (
                record_id, phase, element_id, rating, note, updated_by, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(record_id, phase, element_id) DO UPDATE SET
                rating = excluded.rating,
                note = excluded.note,
                updated_by = excluded.updated_by,
                updated_at = excluded.updated_at
            """,
            (record_id, phase, eid, rating_i, note, user_id, moment),
        )


@router.put("/api/session/job-performance/records/{record_id}/scores")
def save_manager_scores(
    record_id: int, body: ScoresBody, x_session_token: str = Header(default="")
):
    user = _leadership(x_session_token)
    phase = body.phase.strip()
    if phase not in PHASES_MANAGER:
        raise HTTPException(status_code=400, detail="المرحلة: mid أو final")
    connection = connect()
    try:
        ensure_job_performance_tables(connection)
        _save_scores(connection, record_id, phase, body.scores, str(user.get("id") or ""))
        totals = _refresh_record_totals(connection, record_id)
        connection.commit()
        return {"record_id": record_id, "phase": phase, "totals": totals, "counted": True}
    finally:
        connection.close()


@router.put("/api/session/job-performance/records/{record_id}/self-scores")
def save_self_scores(
    record_id: int, body: ScoresBody, x_session_token: str = Header(default="")
):
    user = _user(x_session_token)
    phase = body.phase.strip()
    if phase in PHASES_MANAGER:
        phase = "self_" + phase
    if phase not in PHASES_SELF:
        raise HTTPException(status_code=400, detail="مرحلة التقييم الذاتي: self_mid أو self_final")
    connection = connect()
    try:
        ensure_job_performance_tables(connection)
        row = connection.execute(
            "SELECT staff_id FROM perf_records WHERE id = ?",
            (record_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="سجل التقويم غير موجود")
        role = str(user.get("role") or "")
        is_lead = role.startswith("مدير") or "وكيل" in role
        if not is_lead and str(user.get("id") or "") != str(row[0]):
            raise HTTPException(status_code=403, detail="التقييم الذاتي لصاحب السجل أو القيادة")
        _save_scores(connection, record_id, phase, body.scores, str(user.get("id") or ""))
        connection.commit()
        return {
            "record_id": record_id,
            "phase": phase,
            "counted": False,
            "note": "التقييم الذاتي لا يدخل في احتساب الدرجة النهائية.",
        }
    finally:
        connection.close()


@router.put("/api/session/job-performance/records/{record_id}/gap-plan")
def save_gap_plan(
    record_id: int, body: GapPlanBody, x_session_token: str = Header(default="")
):
    _leadership(x_session_token)
    element_id = body.element_id.strip()
    if not element_id:
        raise HTTPException(status_code=400, detail="معرّف العنصر مطلوب")
    moment = _stamp()
    connection = connect()
    try:
        ensure_job_performance_tables(connection)
        row = connection.execute(
            "SELECT weights_snapshot_json FROM perf_records WHERE id = ?",
            (record_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="سجل التقويم غير موجود")
        allowed = {str(item.get("id") or "") for item in json.loads(row[0] or "[]")}
        if element_id not in allowed:
            raise HTTPException(status_code=400, detail="عنصر غير موجود في لقطة السجل")
        connection.execute(
            """
            INSERT INTO perf_gap_plans (
                record_id, element_id, current_rating, reasons, strengths, improve_areas,
                action_steps_json, requirements, team, partners, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(record_id, element_id) DO UPDATE SET
                current_rating = excluded.current_rating,
                reasons = excluded.reasons,
                strengths = excluded.strengths,
                improve_areas = excluded.improve_areas,
                action_steps_json = excluded.action_steps_json,
                requirements = excluded.requirements,
                team = excluded.team,
                partners = excluded.partners,
                status = excluded.status,
                updated_at = excluded.updated_at
            """,
            (
                record_id,
                element_id,
                body.current_rating,
                body.reasons.strip(),
                body.strengths.strip(),
                body.improve_areas.strip(),
                json.dumps(body.action_steps or [], ensure_ascii=False),
                body.requirements.strip(),
                body.team.strip(),
                body.partners.strip(),
                body.status.strip() or "open",
                moment,
                moment,
            ),
        )
        connection.commit()
        return {"saved": True, "record_id": record_id, "element_id": element_id}
    finally:
        connection.close()


@router.put("/api/session/job-performance/records/{record_id}/idp")
def save_idp(record_id: int, body: IdpBody, x_session_token: str = Header(default="")):
    _leadership(x_session_token)
    goals = body.goals or []
    if len(goals) > 3:
        raise HTTPException(status_code=400, detail="خطة IDP بحد أقصى ثلاثة أهداف تطويرية")
    moment = _stamp()
    connection = connect()
    try:
        ensure_job_performance_tables(connection)
        exists = connection.execute(
            "SELECT id FROM perf_records WHERE id = ?",
            (record_id,),
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="سجل التقويم غير موجود")
        connection.execute(
            """
            INSERT INTO perf_idp (
                record_id, goals_json, start_date, end_date, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(record_id) DO UPDATE SET
                goals_json = excluded.goals_json,
                start_date = excluded.start_date,
                end_date = excluded.end_date,
                notes = excluded.notes,
                updated_at = excluded.updated_at
            """,
            (
                record_id,
                json.dumps(goals, ensure_ascii=False),
                body.start_date.strip(),
                body.end_date.strip(),
                body.notes.strip(),
                moment,
                moment,
            ),
        )
        connection.commit()
        return {"saved": True, "record_id": record_id, "method": "70-20-10"}
    finally:
        connection.close()


def ensure_on_boot(connection) -> None:
    """يُستدعى من database.py عند تهيئة القاعدة."""
    ensure_job_performance_tables(connection)
