# المرحلة ٣: إغلاق حلقة الشراكة الأسرية — بطاقة ٢٠ دقيقة + تعهد + OMR + شاهد 1-3-1-2.
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect

router = APIRouter(tags=["nafs-family-loop"])

EASTERN = "٠١٢٣٤٥٦٧٨٩"
EVIDENCE_CODE = "1-3-1-2"
EVIDENCE_CODE_AR = "١-٣-١-٢"

# الخطوات الأربع المعتمدة لبطاقة الشراكة الأسرية
FAMILY_STEPS = [
    {
        "id": "c1",
        "title": "تخصيص ٢٠ دقيقة يومياً",
        "label": "تخصيص ٢٠ دقيقة يومياً للمراجعة المنزلية",
        "hint": "جلسة قصيرة ثابتة بعد العودة من المدرسة.",
    },
    {
        "id": "c2",
        "title": "القراءة الحرة",
        "label": "القراءة الحرة (١٠ دقائق على الأقل)",
        "hint": "كتاب أو نص قصير يناسب مستوى الطالب.",
    },
    {
        "id": "c3",
        "title": "متابعة الاختبارات الأسبوعية",
        "label": "متابعة الاختبار / التحدي الأسبوعي",
        "hint": "نافس المنزلي أو الاختبار الورقي بإشراف ولي الأمر.",
    },
    {
        "id": "c4",
        "title": "الانضباط في الحضور",
        "label": "الانضباط في الحضور والمتابعة مع الموجه عند الحاجة",
        "hint": "الحضور المنتظم أساس التقدم العلاجي.",
    },
]

# روابط/باركودات تدريب إضافية (عامة رسمية أو مسارات المدرسة)
TRAINING_LINKS = [
    {
        "id": "ayn",
        "label": "منصة عين",
        "url": "https://ien.edu.sa",
        "code": "AYN-40341",
        "note": "محتوى تعليمي إثرائي من وزارة التعليم",
    },
    {
        "id": "nafs",
        "label": "مسار نافس المدرسي",
        "url": "/portal-student.html",
        "code": "NAFS-40341",
        "note": "ميدان التحدي والقراءة داخل بوابة الطالب",
    },
    {
        "id": "youtube",
        "label": "قناة يوتيوب التعليمية",
        "url": "https://www.youtube.com/results?search_query=%D9%86%D8%A7%D9%81%D8%B3+%D9%88%D8%B2%D8%A7%D8%B1%D8%A9+%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85",
        "code": "YT-NAFS-40341",
        "note": "شروحات قصيرة داعمة للمراجعة المنزلية",
    },
]


def _e(value: Any) -> str:
    return "".join(EASTERN[int(c)] if c.isdigit() else ("٪" if c == "%" else c) for c in str(value))


def _iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _week_key() -> str:
    now = datetime.now(timezone.utc)
    return f"{now.isocalendar().year}-W{now.isocalendar().week:02d}"


def _qr_svg(url: str, scale: int = 2) -> str:
    try:
        from .nafs_session_api import _qr_svg as make_qr

        return make_qr(url, scale=scale)
    except Exception:
        safe = str(url or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">'
            '<rect width="72" height="72" fill="#fff" stroke="#0b5e56"/>'
            '<text x="36" y="40" text-anchor="middle" font-size="8" fill="#0b5e56">QR</text>'
            f"<title>{safe}</title></svg>"
        )


def ensure_family_loop(connection) -> None:
    """توسيع الجداول القائمة فقط — بلا قواعد موازية."""
    from .portal_owner_api import ensure_owner_tables
    from .nafs_unit2_ssot import ensure_on_boot as ensure_weekly
    from .nafs_adaptive_engine import ensure_on_boot as ensure_adaptive
    from .visual_evidence import ensure_visual_evidence_table

    ensure_owner_tables(connection)
    ensure_weekly(connection)
    ensure_adaptive(connection)
    ensure_visual_evidence_table(connection)
    cols = {r[1] for r in connection.execute("PRAGMA table_info(portal_family_pact)").fetchall()}
    if "pledge_kind" not in cols:
        connection.execute(
            "ALTER TABLE portal_family_pact ADD COLUMN pledge_kind TEXT NOT NULL DEFAULT 'pact'"
        )
    if "pledge_text" not in cols:
        connection.execute(
            "ALTER TABLE portal_family_pact ADD COLUMN pledge_text TEXT NOT NULL DEFAULT ''"
        )


def _insert_evidence(connection, register_key: str, name: str, uploaded_by: str = "ولي أمر") -> None:
    try:
        connection.execute(
            """
            INSERT INTO visual_evidence(
              entity_type, entity_key, register_key, kind, url, name, created_at, uploaded_by
            ) VALUES ('accreditation', ?, ?, 'note', '', ?, ?, ?)
            """,
            (EVIDENCE_CODE, register_key, name, _iso(), uploaded_by),
        )
    except Exception:
        pass


def _latest_pact(connection, phone: str, nid: str) -> dict | None:
    row = connection.execute(
        """
        SELECT signed_name, signed_at, COALESCE(pledge_kind,'pact'), COALESCE(pledge_text,''), evidence_code
        FROM portal_family_pact
        WHERE parent_phone = ? AND student_nid = ?
        ORDER BY id DESC LIMIT 1
        """,
        (phone, nid),
    ).fetchone()
    if not row:
        return None
    return {
        "signed_name": row[0] or "",
        "signed_at": row[1] or "",
        "pledge_kind": row[2] or "pact",
        "pledge_text": row[3] or "",
        "evidence_code": row[4] or EVIDENCE_CODE,
        "evidence_code_ar": EVIDENCE_CODE_AR,
    }


def _weekly_state(connection, phone: str, nid: str) -> dict:
    week = _week_key()
    row = connection.execute(
        """
        SELECT checks_json, note, updated_at FROM portal_family_weekly
        WHERE parent_phone = ? AND student_nid = ? AND week_key = ?
        """,
        (phone, nid, week),
    ).fetchone()
    checks = json.loads(row[0]) if row and row[0] else {s["id"]: False for s in FAMILY_STEPS}
    done = sum(1 for v in checks.values() if v)
    return {
        "week_key": week,
        "checks": checks,
        "note": (row[1] if row else "") or "",
        "updated_at": (row[2] if row else "") or "",
        "completed": done,
        "total": len(FAMILY_STEPS),
        "completed_ar": f"{_e(done)}/{_e(len(FAMILY_STEPS))}",
        "steps": [
            {
                **step,
                "done": bool(checks.get(step["id"])),
            }
            for step in FAMILY_STEPS
        ],
    }


def _omr_state(connection, nid: str) -> dict:
    row = connection.execute(
        """
        SELECT id, created_at, acknowledged_at, parent_name
        FROM portal_home_mock_packs
        WHERE student_nid = ?
        ORDER BY id DESC LIMIT 1
        """,
        (nid,),
    ).fetchone()
    if not row:
        return {
            "has_pack": False,
            "acknowledged": False,
            "pack_id": 0,
            "status_ar": "لم يُولَّد اختبار منزلي بعد",
        }
    acked = bool(row[2])
    return {
        "has_pack": True,
        "pack_id": int(row[0]),
        "created_at": row[1] or "",
        "acknowledged_at": row[2] or "",
        "parent_name": row[3] or "",
        "acknowledged": acked,
        "status_ar": "مُقَرّ من ولي الأمر" if acked else "بانتظار إقرار المراقبة",
    }


def _remedial_state(connection, nid: str) -> list[dict]:
    try:
        rows = connection.execute(
            """
            SELECT subject, skill, status, COALESCE(grade_root,''), COALESCE(domain,''),
                   COALESCE(etec_code,''), follow_up_date
            FROM teacher_remedial
            WHERE student_id = ?
            ORDER BY id DESC LIMIT 8
            """,
            (nid,),
        ).fetchall()
    except Exception:
        rows = connection.execute(
            """
            SELECT subject, skill, status, '', '', '', follow_up_date
            FROM teacher_remedial
            WHERE student_id = ?
            ORDER BY id DESC LIMIT 8
            """,
            (nid,),
        ).fetchall()
    out = []
    for r in rows:
        code = r[5] or ""
        out.append(
            {
                "subject": r[0] or "",
                "skill": r[1] or "",
                "status": r[2] or "",
                "grade_root": r[3] or "",
                "domain": r[4] or "",
                "etec_code": code,
                "etec_code_ar": _e(code) if code else "",
                "follow_up_date": r[6] or "",
            }
        )
    return out


def _evidence_feed(connection, nid_masked: str, limit: int = 8) -> list[dict]:
    rows = connection.execute(
        """
        SELECT register_key, name, created_at, uploaded_by
        FROM visual_evidence
        WHERE entity_type = 'accreditation' AND entity_key = ?
          AND (name LIKE ? OR name LIKE ?)
        ORDER BY id DESC LIMIT ?
        """,
        (EVIDENCE_CODE, f"%{nid_masked}%", "%ميثاق%", limit),
    ).fetchall()
    # احتياطي: آخر شواهد المعيار عامة إن لم تُطابق الهوية المقنّعة
    if not rows:
        rows = connection.execute(
            """
            SELECT register_key, name, created_at, uploaded_by
            FROM visual_evidence
            WHERE entity_type = 'accreditation' AND entity_key = ?
            ORDER BY id DESC LIMIT ?
            """,
            (EVIDENCE_CODE, limit),
        ).fetchall()
    return [
        {
            "register_key": r[0] or "",
            "name": r[1] or "",
            "created_at": r[2] or "",
            "uploaded_by": r[3] or "",
            "evidence_code": EVIDENCE_CODE,
            "evidence_code_ar": EVIDENCE_CODE_AR,
        }
        for r in rows
    ]


def _training_pack() -> list[dict]:
    items = []
    for link in TRAINING_LINKS:
        items.append(
            {
                **link,
                "qr_svg": _qr_svg(link["url"], scale=2),
                "barcode_label": link["code"],
            }
        )
    return items


def build_child_loop(connection, phone: str, child: dict, xp: int = 0, runs: list | None = None) -> dict:
    """حزمة بوابة ولي الأمر الحية لكل طالب."""
    from .portal_owner_api import mask_nid

    ensure_family_loop(connection)
    nid = child.get("national_id") or ""
    masked = mask_nid(nid)
    weekly = _weekly_state(connection, phone, nid)
    pact = _latest_pact(connection, phone, nid)
    omr = _omr_state(connection, nid)
    remedial = _remedial_state(connection, nid)
    open_clinics = sum(
        1 for r in remedial if (r.get("status") or "") not in ("مُتقَن", "recovered", "مغلق", "closed")
    )
    evidence = _evidence_feed(connection, masked, 6)
    progress_pct = 0
    if runs:
        try:
            progress_pct = round(sum(float(r.get("score_pct") or 0) for r in runs) / max(len(runs), 1), 1)
        except Exception:
            progress_pct = 0
    loop_score = 0
    if pact:
        loop_score += 1
    if weekly["completed"] >= 3:
        loop_score += 1
    if omr.get("acknowledged"):
        loop_score += 1
    if evidence:
        loop_score += 1
    return {
        "student": child,
        "student_nid_masked": masked,
        "xp": int(xp or 0),
        "runs": runs or [],
        "remedial": remedial,
        "open_clinics": open_clinics,
        "avg_score_pct": progress_pct,
        "partnership_card": {
            "title": f"الشراكة الأسرية وخطوات الـ ٢٠ دقيقة اليومية — {child.get('name') or 'الطالب'}",
            "subtitle": "أربع خطوات منزلية قصيرة تدعم التعلّم والتطهير العلاجي",
            "steps": weekly["steps"],
            "week_key": weekly["week_key"],
            "completed_ar": weekly["completed_ar"],
            "note": weekly["note"],
            "updated_at": weekly["updated_at"],
            "training_links": _training_pack(),
            "evidence_code": EVIDENCE_CODE,
            "evidence_code_ar": EVIDENCE_CODE_AR,
        },
        "pledge": {
            "button_label": "أتعهد بدعم ابني وتطبيق الخطة المنزلية",
            "signed": bool(pact),
            "signed_name": (pact or {}).get("signed_name") or "",
            "signed_at": (pact or {}).get("signed_at") or "",
            "pledge_text": (pact or {}).get("pledge_text")
            or "أتعهد بدعم ابني وتطبيق الخطة المنزلية وخطوات الـ ٢٠ دقيقة اليومية.",
            "evidence_code_ar": EVIDENCE_CODE_AR,
        },
        "omr": omr,
        "evidence_feed": evidence,
        "loop_progress": {
            "score": loop_score,
            "total": 4,
            "label_ar": f"{_e(loop_score)}/{_e(4)} حلقات مغلقة",
            "parts": {
                "pledge": bool(pact),
                "weekly": weekly["completed"] >= 3,
                "omr": bool(omr.get("acknowledged")),
                "evidence": bool(evidence),
            },
        },
    }


class PledgeBody(BaseModel):
    student_nid: str = ""
    signed_name: str = ""


class FamilyWeeklyBody(BaseModel):
    student_nid: str = ""
    checks: dict[str, bool] = Field(default_factory=dict)
    note: str = ""


class OmrReviewBody(BaseModel):
    student_nid: str = ""
    pack_id: int = 0
    parent_name: str = ""
    reviewed_answers: bool = True


def _parent_session(token: str) -> tuple[dict, str, set[str]]:
    from .portal_owner_api import _require_parent

    session = _require_parent(token)
    phone = (session.get("payload") or {}).get("phone_norm") or session.get("actor_key") or ""
    kids = {(c.get("national_id") or "") for c in ((session.get("payload") or {}).get("children") or [])}
    return session, phone, kids


@router.get("/api/portal/parent/family-loop")
def api_family_loop(x_portal_token: str = Header(default="")):
    """حزمة إغلاق الحلقة الأسرية لكل الأبناء في الجلسة."""
    from .portal_session_api import MODE_CONFIG, _xp_total

    session, phone, _kids = _parent_session(x_portal_token)
    children = (session.get("payload") or {}).get("children") or []
    connection = connect()
    try:
        ensure_family_loop(connection)
        out = []
        for child in children:
            nid = child.get("national_id") or ""
            runs_rows = connection.execute(
                """
                SELECT mode, score_pct, xp_earned, finished_at
                FROM portal_challenge_runs
                WHERE student_nid = ? AND finished_at != ''
                ORDER BY id DESC LIMIT 8
                """,
                (nid,),
            ).fetchall()
            runs = [
                {
                    "mode": r[0],
                    "label": MODE_CONFIG.get(r[0], {}).get("label", r[0]),
                    "score_pct": r[1],
                    "xp_earned": r[2],
                    "finished_at": r[3],
                }
                for r in runs_rows
            ]
            out.append(
                build_child_loop(
                    connection,
                    phone,
                    child,
                    xp=_xp_total(connection, nid),
                    runs=runs,
                )
            )
        return {
            "ok": True,
            "evidence_code": EVIDENCE_CODE,
            "evidence_code_ar": EVIDENCE_CODE_AR,
            "children": out,
        }
    finally:
        connection.close()


@router.post("/api/portal/parent/pledge")
def api_parent_pledge(body: PledgeBody, x_portal_token: str = Header(default="")):
    """زر التعهد الإلكتروني — طابع زمني + شاهد 1-3-1-2."""
    from .portal_owner_api import mask_nid

    session, phone, kids = _parent_session(x_portal_token)
    nid = "".join(ch for ch in body.student_nid if ch.isdigit())
    if nid not in kids:
        raise HTTPException(status_code=403, detail="هذا الطالب غير مرتبط بجلستك.")
    signed = (body.signed_name or "").strip() or "ولي أمر"
    pledge_text = "أتعهد بدعم ابني وتطبيق الخطة المنزلية وخطوات الـ ٢٠ دقيقة اليومية."
    stamped = _iso()
    connection = connect()
    try:
        ensure_family_loop(connection)
        connection.execute(
            """
            INSERT INTO portal_family_pact(
              parent_phone, student_nid, signed_name, signed_at, evidence_code, pledge_kind, pledge_text
            ) VALUES (?, ?, ?, ?, ?, 'home-support', ?)
            """,
            (phone, nid, signed, stamped, EVIDENCE_CODE, pledge_text),
        )
        _insert_evidence(
            connection,
            "family-pledge",
            f"تعهد دعم الخطة المنزلية — {mask_nid(nid)} · {signed}",
            f"ولي أمر …{(phone or '')[-4:]}",
        )
        # نقطة رفق خفيفة للطالب عند التعهد (بدون تضخم)
        try:
            connection.execute(
                """
                INSERT INTO portal_behavior_points(student_nid, program, points, note, created_at)
                VALUES (?, 'رفق', 1, 'تعهد أسري بدعم الخطة المنزلية', ?)
                """,
                (nid, stamped),
            )
        except Exception:
            pass
        connection.commit()
        return {
            "ok": True,
            "signed_name": signed,
            "signed_at": stamped,
            "pledge_text": pledge_text,
            "evidence_code": EVIDENCE_CODE,
            "evidence_code_ar": EVIDENCE_CODE_AR,
            "message": f"وُثّق التعهد الإلكتروني في {stamped} كشاهد {EVIDENCE_CODE_AR}.",
        }
    finally:
        connection.close()


@router.post("/api/portal/parent/omr-review")
def api_omr_review(body: OmrReviewBody, x_portal_token: str = Header(default="")):
    """إغلاق حلقة OMR: إقرار مراجعة منزلية + ربط بالتقدم والعيادات."""
    from .portal_owner_api import mask_nid

    session, phone, kids = _parent_session(x_portal_token)
    nid = "".join(ch for ch in body.student_nid if ch.isdigit())
    if nid not in kids:
        raise HTTPException(status_code=403, detail="هذا الطالب غير مرتبط بجلستك.")
    parent_name = (body.parent_name or "").strip() or "ولي أمر"
    connection = connect()
    try:
        ensure_family_loop(connection)
        pack_id = int(body.pack_id or 0)
        if pack_id <= 0:
            row = connection.execute(
                "SELECT id FROM portal_home_mock_packs WHERE student_nid=? ORDER BY id DESC LIMIT 1",
                (nid,),
            ).fetchone()
            pack_id = int(row[0]) if row else 0
        if pack_id <= 0:
            raise HTTPException(status_code=400, detail="لا توجد ورقة اختبار منزلي لإقرارها. ولّد الورقة أولاً.")
        stamped = _iso()
        connection.execute(
            """
            UPDATE portal_home_mock_packs
            SET acknowledged_at=?, parent_name=?, parent_phone=?
            WHERE id=? AND student_nid=?
            """,
            (stamped, parent_name, phone, pack_id, nid),
        )
        _insert_evidence(
            connection,
            "home-mock-review",
            f"إقرار مراجعة الاختبار المنزلي (OMR) — {mask_nid(nid)}",
            parent_name,
        )
        try:
            connection.execute(
                """
                INSERT INTO portal_behavior_points(student_nid, program, points, note, created_at)
                VALUES (?, 'رفق', 1, 'مراجعة منزلية مؤكدة للاختبار الورقي', ?)
                """,
                (nid, stamped),
            )
        except Exception:
            pass
        remedial = _remedial_state(connection, nid)
        open_n = sum(
            1 for r in remedial if (r.get("status") or "") not in ("مُتقَن", "recovered", "مغلق", "closed")
        )
        connection.commit()
        return {
            "ok": True,
            "pack_id": pack_id,
            "acknowledged_at": stamped,
            "parent_name": parent_name,
            "evidence_code": EVIDENCE_CODE,
            "evidence_code_ar": EVIDENCE_CODE_AR,
            "remedial_open": open_n,
            "remedial": remedial[:5],
            "message": (
                f"أُغلق إقرار OMR كشاهد {EVIDENCE_CODE_AR}. "
                f"العيادات المفتوحة المرتبطة: {_e(open_n)}."
            ),
        }
    finally:
        connection.close()


@router.get("/api/portal/parent/evidence/1-3-1-2")
def api_family_evidence(student_nid: str = "", x_portal_token: str = Header(default="")):
    from .portal_owner_api import mask_nid

    session, phone, kids = _parent_session(x_portal_token)
    nid = "".join(ch for ch in student_nid if ch.isdigit()) if student_nid else ""
    if nid and nid not in kids:
        raise HTTPException(status_code=403, detail="هذا الطالب غير مرتبط بجلستك.")
    connection = connect()
    try:
        ensure_family_loop(connection)
        masked = mask_nid(nid) if nid else ""
        items = _evidence_feed(connection, masked or "%", 20)
        return {
            "ok": True,
            "evidence_code": EVIDENCE_CODE,
            "evidence_code_ar": EVIDENCE_CODE_AR,
            "count": len(items),
            "items": items,
            "viewer_phone_tail": (phone or "")[-4:],
        }
    finally:
        connection.close()
