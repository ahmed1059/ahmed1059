# الوحدة الثانية: مصفوفة تراكمية + خطة ٨ أسابيع + ميثاق ٢٠ دقيقة + تصدير Word.
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .database import connect

router = APIRouter(tags=["nafs-unit2"])

SKILLS_MATRIX = {
    "math": {
        "etec": "3-1-1-2",
        "label": "الرياضيات",
        "skills": [
            {"id": "m-num-1", "name": "الأعداد والعمليات", "root": "١م", "grade": "١م"},
            {"id": "m-num-2", "name": "الكسور والنسب", "root": "١م", "grade": "٢م"},
            {"id": "m-alg-1", "name": "المعادلات الخطية", "root": "٢م", "grade": "٢م"},
            {"id": "m-alg-2", "name": "وحيدات الحد والأسس", "root": "٢م", "grade": "٣م"},
            {"id": "m-geo-1", "name": "المساحة والمحيط", "root": "١م", "grade": "٢م"},
            {"id": "m-geo-2", "name": "فيثاغورس والقياس", "root": "٢م", "grade": "٣م"},
            {"id": "m-stat-1", "name": "الوسط والوسيط", "root": "٢م", "grade": "٣م"},
            {"id": "m-prob-1", "name": "الاحتمال البسيط", "root": "٢م", "grade": "٣م"},
        ],
    },
    "science": {
        "etec": "3-1-1-3",
        "label": "العلوم",
        "skills": [
            {"id": "s-phys-1", "name": "القوة والحركة", "root": "٢م", "grade": "٣م"},
            {"id": "s-phys-2", "name": "الطاقة والكهرباء", "root": "٢م", "grade": "٣م"},
            {"id": "s-chem-1", "name": "المادة والتفاعلات", "root": "٢م", "grade": "٣م"},
            {"id": "s-chem-2", "name": "الجدول الدوري", "root": "٢م", "grade": "٣م"},
            {"id": "s-bio-1", "name": "الخلية والأنظمة", "root": "١م", "grade": "٢م"},
            {"id": "s-earth-1", "name": "الأرض والفضاء", "root": "١م", "grade": "٢م"},
        ],
    },
    "reading": {
        "etec": "3-1-1-1",
        "label": "القراءة ولغتي",
        "skills": [
            {"id": "r-lit-1", "name": "الفهم الحرفي", "root": "١م", "grade": "١م"},
            {"id": "r-inf-1", "name": "الفهم الاستنتاجي", "root": "٢م", "grade": "٢م"},
            {"id": "r-crit-1", "name": "الفهم الناقد", "root": "٣م", "grade": "٣م"},
            {"id": "r-lex-1", "name": "دلالات الألفاظ", "root": "١م", "grade": "٢م"},
            {"id": "r-rhe-1", "name": "التذوق البلاغي", "root": "٣م", "grade": "٣م"},
            {"id": "r-gram-1", "name": "كفايات نحوية وإملائية", "root": "٢م", "grade": "٣م"},
        ],
    },
}

WEEKLY_PLAN_8 = [
    {"week": 1, "focus": "تشخيص قبلي وخريطة الفاقد", "math": "أعداد وكسور", "science": "ضبط المتغيرات", "reading": "فهم حرفي", "evidence": "اختبار تشخيصي"},
    {"week": 2, "focus": "إطلاق العيادات العلاجية", "math": "معادلات خطية", "science": "القوة والحركة", "reading": "دلالات الألفاظ", "evidence": "سجل عيادة"},
    {"week": 3, "focus": "تحدي الأرقام وقارئ الحصيف", "math": "نسب وتناسب", "science": "الطاقة", "reading": "فهم استنتاجي", "evidence": "نتائج تحدي"},
    {"week": 4, "focus": "محاكاة مصغّرة ١", "math": "هندسة ومساحة", "science": "المادة", "reading": "فهم ناقد", "evidence": "Mock مصغّر"},
    {"week": 5, "focus": "معالجة أفخاخ شائعة", "math": "أسس ووحيدات حد", "science": "كهرباء", "reading": "تذوق", "evidence": "ورقة علاجية"},
    {"week": 6, "focus": "محاكاة ٢ + دوري فصول", "math": "إحصاء", "science": "حياة وأرض", "reading": "كفايات لغوية", "evidence": "دوري الفصول"},
    {"week": 7, "focus": "المحاكاة الوطنية ٦٦", "math": "مراجعة شاملة", "science": "مراجعة شاملة", "reading": "مراجعة شاملة", "evidence": "كراسة + OMR"},
    {"week": 8, "focus": "جاهزية النافذة الوطنية", "math": "حساب ذهني سريع", "science": "تجارب قصيرة", "reading": "قراءة حرة", "evidence": "تقرير جاهزية"},
]

FAMILY_CHECKLIST = [
    {"id": "c1", "label": "تخصيص ٢٠ دقيقة يومياً للمراجعة المنزلية"},
    {"id": "c2", "label": "القراءة الحرة (١٠ دقائق على الأقل)"},
    {"id": "c3", "label": "متابعة الاختبار / التحدي الأسبوعي"},
    {"id": "c4", "label": "الانضباط في الحضور والمتابعة مع الموجه عند الحاجة"},
]


def _iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


SCHEMA = """
CREATE TABLE IF NOT EXISTS portal_family_weekly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_phone TEXT NOT NULL,
    student_nid TEXT NOT NULL,
    week_key TEXT NOT NULL,
    checks_json TEXT NOT NULL DEFAULT '{}',
    note TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    UNIQUE(parent_phone, student_nid, week_key)
);
"""


def ensure_on_boot(connection) -> dict:
    connection.executescript(SCHEMA)
    return {"ok": True, "weeks": 8, "domains": list(SKILLS_MATRIX.keys())}


def _week_key() -> str:
    now = datetime.now(timezone.utc)
    return f"{now.isocalendar().year}-W{now.isocalendar().week:02d}"


class FamilyWeeklyBody(BaseModel):
    student_nid: str = ""
    checks: dict[str, bool] = Field(default_factory=dict)
    note: str = ""


@router.get("/api/session/nafs/skills-matrix")
def skills_matrix(x_session_token: str = Header(default="")):
    from .access import require_user

    try:
        require_user(str(x_session_token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    return {"ok": True, "matrix": SKILLS_MATRIX}


@router.get("/api/session/nafs/weekly-plan")
def weekly_plan(x_session_token: str = Header(default="")):
    from .access import require_user

    try:
        require_user(str(x_session_token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    from .nafs_weekly_etec import build_week_goal

    pack = build_week_goal()
    return {
        "ok": True,
        "current_week": pack["current_week"],
        "weeks": pack["weeks"],
        "current": pack["current"],
        "teacher_goal": pack["teacher_goal"],
        "student_goal": pack["student_goal"],
        "schedule_engine": pack["schedule_engine"],
    }


@router.get("/api/portal/parent/family-weekly")
def family_weekly_get(student_nid: str = "", x_portal_token: str = Header(default="")):
    from .portal_owner_api import _require_parent

    session = _require_parent(x_portal_token)
    phone = (session.get("payload") or {}).get("phone_norm") or session.get("actor_key") or ""
    nid = "".join(ch for ch in student_nid if ch.isdigit())
    kids = {(c.get("national_id") or "") for c in ((session.get("payload") or {}).get("children") or [])}
    if nid and nid not in kids:
        raise HTTPException(status_code=403, detail="هذا الطالب غير مرتبط بجلستك.")
    connection = connect()
    try:
        ensure_on_boot(connection)
        week = _week_key()
        row = None
        if nid:
            row = connection.execute(
                """
                SELECT checks_json, note, updated_at FROM portal_family_weekly
                WHERE parent_phone = ? AND student_nid = ? AND week_key = ?
                """,
                (phone, nid, week),
            ).fetchone()
        checks = json.loads(row[0]) if row and row[0] else {c["id"]: False for c in FAMILY_CHECKLIST}
        return {
            "ok": True,
            "week_key": week,
            "checklist": FAMILY_CHECKLIST,
            "checks": checks,
            "note": (row[1] if row else "") or "",
            "updated_at": (row[2] if row else "") or "",
            "evidence_code": "1-3-1-2",
            "message_template": (
                "ميثاق الـ ٢٠ دقيقة اليومية: نشارك ابننا في مراجعة قصيرة يومياً، "
                "وقراءة حرة، ومتابعة تحدي نافس الأسبوعي، مع الالتزام بالحضور."
            ),
        }
    finally:
        connection.close()


@router.post("/api/portal/parent/family-weekly")
def family_weekly_save(body: FamilyWeeklyBody, x_portal_token: str = Header(default="")):
    from .portal_owner_api import _require_parent, mask_nid

    session = _require_parent(x_portal_token)
    phone = (session.get("payload") or {}).get("phone_norm") or session.get("actor_key") or ""
    nid = "".join(ch for ch in body.student_nid if ch.isdigit())
    kids = {(c.get("national_id") or "") for c in ((session.get("payload") or {}).get("children") or [])}
    if nid not in kids:
        raise HTTPException(status_code=403, detail="هذا الطالب غير مرتبط بجلستك.")
    connection = connect()
    try:
        ensure_on_boot(connection)
        week = _week_key()
        checks = {c["id"]: bool((body.checks or {}).get(c["id"])) for c in FAMILY_CHECKLIST}
        connection.execute(
            """
            INSERT INTO portal_family_weekly(parent_phone, student_nid, week_key, checks_json, note, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(parent_phone, student_nid, week_key) DO UPDATE SET
              checks_json=excluded.checks_json, note=excluded.note, updated_at=excluded.updated_at
            """,
            (phone, nid, week, json.dumps(checks, ensure_ascii=False), str(body.note or "").strip(), _iso()),
        )
        # توثيق شاهد 1-3-1-2 عند اكتمال البنود
        done = sum(1 for v in checks.values() if v)
        if done >= 3:
            try:
                connection.execute(
                    """
                    INSERT INTO visual_evidence(
                      entity_type, entity_key, register_key, kind, url, name, created_at, uploaded_by
                    ) VALUES ('accreditation', '1-3-1-2', 'family-weekly', 'note', '', ?, ?, ?)
                    """,
                    (
                        f"ميثاق ٢٠ دقيقة أسبوعي — {mask_nid(nid)} · {done}/4",
                        _iso(),
                        "ولي أمر",
                    ),
                )
            except Exception:
                pass
        connection.commit()
        return {
            "ok": True,
            "week_key": week,
            "checks": checks,
            "completed": done,
            "evidence_code": "1-3-1-2",
            "message": "حُفظت قائمة التحقق الأسبوعية ووثّقت ضمن شاهد 1-3-1-2 عند اكتمالها.",
        }
    finally:
        connection.close()


@router.get("/api/session/nafs/export-docx")
def export_nafs_docx(kind: str = "weekly", x_session_token: str = Header(default="")):
    """تصدير Word رسمي (خط تجوال/المهند) مع ترويسة ثلاثية وباركود حي — عبر محرك المرحلة ٥."""
    from .access import require_user

    try:
        require_user(str(x_session_token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    from .nafs_weekly_etec import build_official_docx

    buf, filename = build_official_docx(kind=kind or "weekly")
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
