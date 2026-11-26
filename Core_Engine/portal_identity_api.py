# هوية المدرسة العامة + محتوى «من نحن» القابل للتعديل من لوحة المالك.
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect

router = APIRouter(tags=["portal-identity"])

DEFAULT_CONTENT = {
    "school_name": "متوسطة سعد بن الربيع الأنصاري",
    "statistical_number": "40341",
    "education_administration": "الإدارة العامة للتعليم بمنطقة المدينة المنورة",
    "principal_name": "أ. نايف بن سمير حجيف المخلفي",
    "display_students": 338,
    "display_staff": 39,
    "about": (
        "متوسطة سعد بن الربيع الأنصاري مدرسة حكومية للبنين في المدينة المنورة، "
        "تعمل تحت إشراف الإدارة العامة للتعليم بمنطقة المدينة المنورة، "
        "وتسعى لبناء متعلم واعٍ بالقيم الإسلامية، متقنٍ للمهارات، ومشاركٍ في خدمة وطنه."
    ),
    "vision": "بيئة تعليمية محفّزة تُخرج متعلماً متمكناً قيمياً ومعرفياً ومهارياً.",
    "mission": (
        "تقديم تعليم متوسط نوعي يعتمد على التخطيط التشغيلي والشواهد الحية، "
        "ويربط نواتج التعلم بتقويم نافس والشراكة الأسرية والمجتمعية."
    ),
    "values": ["الأمانة", "الإتقان", "الانتماء", "التعاون", "المسؤولية"],
    "goals": [
        "رفع نواتج التعلم في القراءة والرياضيات والعلوم وفق مؤشرات الاعتماد.",
        "تعزيز السلوك الإيجابي وبرامج قدوة ورفق والانضباط المدرسي.",
        "تفعيل الشراكة مع الأسرة والمجتمع ومؤسسات التعليم.",
        "تمكين المعلمين رقمياً ومهنياً عبر شواهد الأداء والزيارات الصفية.",
    ],
    "partners": ["وزارة التعليم", "هيئة تقويم التعليم والتدريب (ETEC)", "موهبة", "الأسرة"],
    "contact_note": "للاستفسار عبر إدارة المدرسة أو الموجه الطلابي خلال الدوام الرسمي.",
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS portal_identity_content (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    content_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT ''
);
"""


def _iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_identity_content(connection) -> dict:
    connection.executescript(SCHEMA)
    row = connection.execute(
        "SELECT content_json FROM portal_identity_content WHERE id = 1"
    ).fetchone()
    if not row:
        connection.execute(
            "INSERT INTO portal_identity_content(id, content_json, updated_at) VALUES (1, ?, ?)",
            (json.dumps(DEFAULT_CONTENT, ensure_ascii=False), _iso()),
        )
        return dict(DEFAULT_CONTENT)
    try:
        data = json.loads(row[0] or "{}")
    except json.JSONDecodeError:
        data = {}
    merged = dict(DEFAULT_CONTENT)
    if isinstance(data, dict):
        merged.update({k: v for k, v in data.items() if v not in (None, "")})
    return merged


def live_counts(connection) -> dict:
    students = connection.execute(
        "SELECT COUNT(*) FROM noor_students WHERE COALESCE(is_deleted,0)=0"
    ).fetchone()[0]
    staff = connection.execute(
        "SELECT COUNT(*) FROM noor_staff WHERE COALESCE(active,1)=1"
    ).fetchone()[0]
    return {"students_live": int(students or 0), "staff_live": int(staff or 0)}


def ensure_on_boot(connection) -> dict:
    content = ensure_identity_content(connection)
    return {"ok": True, "school_name": content.get("school_name")}


class IdentityBody(BaseModel):
    school_name: str = ""
    statistical_number: str = ""
    education_administration: str = ""
    principal_name: str = ""
    display_students: int = 338
    display_staff: int = 39
    about: str = ""
    vision: str = ""
    mission: str = ""
    values: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    partners: list[str] = Field(default_factory=list)
    contact_note: str = ""


@router.get("/api/public/school-identity")
def public_school_identity():
    """واجهة عامة لصفحة من نحن — بلا جلسة."""
    connection = connect()
    try:
        content = ensure_identity_content(connection)
        counts = live_counts(connection)
        connection.commit()
        return {
            "ok": True,
            "content": content,
            "stats": {
                "students": int(content.get("display_students") or 338),
                "staff": int(content.get("display_staff") or 39),
                "students_live": counts["students_live"],
                "staff_live": counts["staff_live"],
            },
        }
    finally:
        connection.close()


@router.get("/api/portal/owner/identity")
def owner_get_identity(x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level

    _require_level(x_session_token, 1)
    connection = connect()
    try:
        content = ensure_identity_content(connection)
        counts = live_counts(connection)
        connection.commit()
        return {"content": content, "live": counts}
    finally:
        connection.close()


@router.post("/api/portal/owner/identity")
def owner_save_identity(body: IdentityBody, x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level, _audit

    user, _level = _require_level(x_session_token, 0)
    connection = connect()
    try:
        ensure_identity_content(connection)
        payload = body.model_dump()
        # لا تُفرَّغ الحقول الأساسية
        for key, default in DEFAULT_CONTENT.items():
            if payload.get(key) in (None, "", []):
                payload[key] = default
        connection.execute(
            """
            UPDATE portal_identity_content
            SET content_json = ?, updated_at = ?
            WHERE id = 1
            """,
            (json.dumps(payload, ensure_ascii=False), _iso()),
        )
        _audit(connection, user, "identity.content.save", payload.get("school_name") or "")
        connection.commit()
        return {"ok": True, "content": payload}
    finally:
        connection.close()
