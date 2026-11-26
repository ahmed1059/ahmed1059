# المرحلة ٢: جسر العيادات العلاجية — vault SSOT → teacher_remedial باعتماد يدوي.
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect
from .nafs_adaptive_engine import ETEC, ensure_on_boot as ensure_vault, teacher_peek
from .teacher_record_tables import ensure_teacher_record_tables

router = APIRouter(tags=["nafs-remedial-clinics"])

EASTERN = "٠١٢٣٤٥٦٧٨٩"
SOURCE_CLINIC = "vault-clinic-v1"

# تعيين المادة → معلم المادة (هويات من noor_staff — SSOT)
SUBJECT_TEACHERS: dict[str, dict[str, str]] = {
    "math": {
        "domain": "math",
        "subject": "رياضيات",
        "teacher_name": "أ. حسن نافع الحرساني",
        "teacher_nid": "1011057906",
        "match_name": "حسن بن نافع",
        "etec_code": "3-1-1-2",
        "etec_code_ar": "٣-١-١-٢",
    },
    "reading": {
        "domain": "reading",
        "subject": "لغتي",
        "teacher_name": "أ. خالد سعود الأحمدي",
        "teacher_nid": "1022093361",
        "match_name": "خالد بن سعود",
        "etec_code": "3-1-1-1",
        "etec_code_ar": "٣-١-١-١",
    },
    "science": {
        "domain": "science",
        "subject": "علوم/فيزياء",
        "teacher_name": "أ. أيمن سليم البلادي",
        "teacher_nid": "1059972792",
        "match_name": "ايمن سليم",
        "etec_code": "3-1-1-3",
        "etec_code_ar": "٣-١-١-٣",
    },
}


def _e(value: Any) -> str:
    return "".join(EASTERN[int(c)] if c.isdigit() else ("٪" if c == "%" else c) for c in str(value))


def _iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_clinic_columns(connection) -> None:
    """توسيع teacher_remedial فقط — بلا جداول موازية."""
    ensure_teacher_record_tables(connection)
    ensure_vault(connection)
    cols = {r[1] for r in connection.execute("PRAGMA table_info(teacher_remedial)").fetchall()}
    alters = [
        ("grade_root", "TEXT NOT NULL DEFAULT ''"),
        ("domain", "TEXT NOT NULL DEFAULT ''"),
        ("section", "TEXT NOT NULL DEFAULT ''"),
        ("etec_code", "TEXT NOT NULL DEFAULT ''"),
        ("clinic_key", "TEXT NOT NULL DEFAULT ''"),
        ("approved_at", "TEXT NOT NULL DEFAULT ''"),
        ("approved_by", "TEXT NOT NULL DEFAULT ''"),
    ]
    for name, decl in alters:
        if name not in cols:
            connection.execute(f"ALTER TABLE teacher_remedial ADD COLUMN {name} {decl}")


def _domain_of(domain: str) -> str:
    d = (domain or "").strip().lower()
    if d in SUBJECT_TEACHERS:
        return d
    if d in ("رياضيات", "math"):
        return "math"
    if d in ("قراءة", "لغتي", "reading", "lang"):
        return "reading"
    if d in ("علوم", "فيزياء", "science"):
        return "science"
    return "math"


def _clinic_key(section: str, domain: str, grade_root: str, skill: str) -> str:
    return "|".join(
        [
            (section or "").strip() or "—",
            _domain_of(domain),
            (grade_root or "٣م").strip() or "٣م",
            (skill or "").strip() or "عام",
        ]
    )


def propose_clinics(
    connection,
    grade: str = "",
    section: str = "",
    limit: int = 80,
) -> dict:
    """تجميع تعثرات vault حسب الفصل والمادة والجذر → مقترحات عيادة."""
    ensure_clinic_columns(connection)
    peek = teacher_peek(connection, grade=grade, section=section, limit=limit)
    groups: dict[str, dict[str, Any]] = {}
    for item in peek.get("items") or []:
        domain = _domain_of(item.get("domain") or "")
        root = (item.get("grade_root") or "٣م").strip() or "٣م"
        skill = (item.get("skill") or "").strip() or "عام"
        sec = (item.get("section") or "").strip() or "—"
        key = _clinic_key(sec, domain, root, skill)
        teacher = SUBJECT_TEACHERS[domain]
        bucket = groups.get(key)
        if not bucket:
            bucket = {
                "clinic_key": key,
                "section": sec,
                "grade": item.get("grade") or "",
                "domain": domain,
                "subject": teacher["subject"],
                "skill": skill,
                "grade_root": root,
                "teacher_name": teacher["teacher_name"],
                "teacher_nid": teacher["teacher_nid"],
                "etec": {
                    "code": teacher["etec_code"],
                    "code_ar": teacher["etec_code_ar"],
                    "label": teacher["subject"],
                },
                "trap_heat_sum": 0,
                "students": [],
                "student_nids": [],
                "already_open": False,
            }
            groups[key] = bucket
        nid = item.get("student_nid") or ""
        if nid and nid not in bucket["student_nids"]:
            bucket["student_nids"].append(nid)
            bucket["students"].append(
                {
                    "student_nid": nid,
                    "student_nid_masked": item.get("student_nid_masked") or "",
                    "name": item.get("name") or "طالب",
                    "trap_heat": int(item.get("trap_heat") or 0),
                    "status": item.get("status") or "open",
                    "status_ar": item.get("status_ar") or "",
                    "common_mistake": item.get("common_mistake") or "",
                }
            )
        bucket["trap_heat_sum"] += int(item.get("trap_heat") or 0)

    # علّم المقترحات التي فُتحت مسبقاً ولم تُغلق
    open_keys = {
        r[0]
        for r in connection.execute(
            """
            SELECT DISTINCT clinic_key FROM teacher_remedial
            WHERE source = ? AND clinic_key != '' AND COALESCE(status,'') NOT IN ('مغلق','مُتقَن','recovered','closed')
            """,
            (SOURCE_CLINIC,),
        ).fetchall()
        if r[0]
    }
    proposals = []
    for key, bucket in groups.items():
        bucket["already_open"] = key in open_keys
        bucket["student_count"] = len(bucket["student_nids"])
        bucket["plan_preview"] = (
            f"عيادة علاجية — {bucket['subject']} · جذر {bucket['grade_root']} · مهارة {bucket['skill']} · "
            f"فصل {bucket['section']} · {_e(bucket['student_count'])} طلاب"
        )
        proposals.append(bucket)

    proposals.sort(key=lambda p: (-p["trap_heat_sum"], -p["student_count"], p["subject"]))
    by_subject: dict[str, int] = defaultdict(int)
    by_root: dict[str, int] = defaultdict(int)
    for p in proposals:
        by_subject[p["subject"]] += 1
        by_root[p["grade_root"]] += 1
    return {
        "ok": True,
        "count": len(proposals),
        "by_subject": dict(by_subject),
        "by_root": dict(by_root),
        "teachers": {k: {"name": v["teacher_name"], "subject": v["subject"]} for k, v in SUBJECT_TEACHERS.items()},
        "proposals": proposals,
        "legend": peek.get("legend") or {},
    }


class ApproveClinicBody(BaseModel):
    clinic_key: str = ""
    section: str = ""
    domain: str = "math"
    skill: str = ""
    grade_root: str = "٣م"
    student_nids: list[str] = Field(default_factory=list)
    generate_worksheet: bool = True
    worksheet_count: int = 5


class PurgePassBody(BaseModel):
    student_nid: str = ""
    skill: str = ""
    domain: str = ""
    clinic_key: str = ""


def _build_worksheet(connection, domain: str, skill: str, grade_root: str, count: int) -> list[dict]:
    from .nafs_question_bank_seed import ensure_nafs_question_bank
    from .nafs_misconception_lab import ensure_question_columns

    ensure_nafs_question_bank(connection)
    ensure_question_columns(connection)
    count = max(1, min(int(count or 5), 10))
    domain = _domain_of(domain)
    params: list[Any] = [domain]
    where = "WHERE COALESCE(active,1)=1 AND domain = ?"
    if skill:
        where += " AND skill LIKE ?"
        params.append(f"%{skill}%")
    if grade_root:
        where += " AND (grade_root = ? OR grade_root = '' OR grade_root IS NULL)"
        params.append(grade_root)
    rows = connection.execute(
        f"""
        SELECT id, domain, skill, stem, choice_a, choice_b, choice_c, choice_d,
               correct, rationale, COALESCE(grade_root,''), COALESCE(common_mistake,''), COALESCE(golden_rule,'')
        FROM nafs_question_bank {where}
        ORDER BY CASE WHEN grade_root = ? THEN 0 ELSE 1 END, RANDOM()
        LIMIT ?
        """,
        tuple(params + [grade_root or "", count]),
    ).fetchall()
    if len(rows) < count and grade_root:
        # احتياطي بلا قيد الجذر إن قلّ العدد
        rows = connection.execute(
            f"""
            SELECT id, domain, skill, stem, choice_a, choice_b, choice_c, choice_d,
                   correct, rationale, COALESCE(grade_root,''), COALESCE(common_mistake,''), COALESCE(golden_rule,'')
            FROM nafs_question_bank
            WHERE COALESCE(active,1)=1 AND domain = ?
            ORDER BY RANDOM() LIMIT ?
            """,
            (domain, count),
        ).fetchall()
    return [
        {
            "id": int(r[0]),
            "domain": r[1],
            "skill": r[2],
            "stem": r[3],
            "choices": {"A": r[4], "B": r[5], "C": r[6], "D": r[7]},
            "correct": (r[8] or "A").upper(),
            "rationale": r[9] or "",
            "grade_root": r[10] or grade_root,
            "common_mistake": r[11] or "",
            "golden_rule": r[12] or "",
        }
        for r in rows
    ]


def approve_clinic(connection, body: ApproveClinicBody, actor: dict) -> dict:
    """اعتماد يدوي بضغطة واحدة — يكتب في teacher_remedial دون إغراق تلقائي."""
    ensure_clinic_columns(connection)
    domain = _domain_of(body.domain)
    teacher = SUBJECT_TEACHERS[domain]
    root = (body.grade_root or "٣م").strip() or "٣م"
    skill = (body.skill or "").strip() or "عام"
    section = (body.section or "").strip() or "—"
    key = (body.clinic_key or "").strip() or _clinic_key(section, domain, root, skill)
    nids = ["".join(ch for ch in str(n) if ch.isdigit()) for n in (body.student_nids or [])]
    nids = [n for n in nids if n]
    if not nids:
        raise HTTPException(status_code=400, detail="لا طلاب في مقترح العيادة.")

    plan = (
        f"خطة تطهير مركّزة على جذر {root} لمهارة «{skill}» ({teacher['subject']}). "
        f"مؤشر ETEC {teacher['etec_code_ar']}. فصل {section}."
    )
    inserted = []
    for nid in nids:
        exists = connection.execute(
            """
            SELECT id FROM teacher_remedial
            WHERE student_id = ? AND clinic_key = ? AND source = ?
              AND COALESCE(status,'') NOT IN ('مغلق','مُتقَن','recovered','closed')
            LIMIT 1
            """,
            (nid, key, SOURCE_CLINIC),
        ).fetchone()
        if exists:
            continue
        connection.execute(
            """
            INSERT INTO teacher_remedial(
              national_id, subject, student_id, skill, plan, follow_up_date, status, source,
              grade_root, domain, section, etec_code, clinic_key, approved_at, approved_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                teacher["teacher_nid"],
                teacher["subject"],
                nid,
                skill,
                plan,
                "",
                "مفتوح",
                SOURCE_CLINIC,
                root,
                domain,
                section,
                teacher["etec_code"],
                key,
                _iso(),
                actor.get("national_id") or actor.get("nid") or "",
            ),
        )
        inserted.append(nid)

    worksheet = None
    if body.generate_worksheet:
        questions = _build_worksheet(
            connection, domain, skill, root, body.worksheet_count
        )
        worksheet = {
            "title": f"ورقة علاجية مصغّرة — جذر {root} · {teacher['subject']}",
            "domain": domain,
            "subject": teacher["subject"],
            "skill": skill,
            "grade_root": root,
            "etec_code_ar": teacher["etec_code_ar"],
            "teacher_name": teacher["teacher_name"],
            "questions": questions,
            "student_count": len(nids),
        }

    return {
        "ok": True,
        "clinic_key": key,
        "inserted": len(inserted),
        "skipped_existing": max(0, len(nids) - len(inserted)),
        "teacher_name": teacher["teacher_name"],
        "subject": teacher["subject"],
        "grade_root": root,
        "etec_code_ar": teacher["etec_code_ar"],
        "worksheet": worksheet,
        "message": f"اعتُمدت عيادة {teacher['subject']} لجذر {root} — {_e(len(inserted))} طالباً.",
    }


def mark_purge_pass(connection, body: PurgePassBody, actor: dict) -> dict:
    """تحديث حالة التطهير في teacher_remedial + vault عند اجتياز التطهير."""
    ensure_clinic_columns(connection)
    nid = "".join(ch for ch in str(body.student_nid or "") if ch.isdigit())
    if not nid:
        raise HTTPException(status_code=400, detail="هوية الطالب مطلوبة.")
    skill = (body.skill or "").strip()
    domain = _domain_of(body.domain) if body.domain else ""
    key = (body.clinic_key or "").strip()

    params: list[Any] = [nid, SOURCE_CLINIC]
    where = "student_id = ? AND source = ?"
    if key:
        where += " AND clinic_key = ?"
        params.append(key)
    if skill:
        where += " AND skill = ?"
        params.append(skill)
    if domain:
        where += " AND domain = ?"
        params.append(domain)

    updated = connection.execute(
        f"""
        UPDATE teacher_remedial
        SET status = 'مُتقَن', follow_up_date = ?
        WHERE {where} AND COALESCE(status,'') NOT IN ('مُتقَن','recovered','closed','مغلق')
        """,
        tuple([_iso()] + params),
    ).rowcount

    # حدّث vault للمهارات المطابقة
    vault_where = "student_nid = ? AND status IN ('open','recovering')"
    vparams: list[Any] = [nid]
    if skill:
        vault_where += " AND skill = ?"
        vparams.append(skill)
    if domain:
        vault_where += " AND domain = ?"
        vparams.append(domain)
    connection.execute(
        f"""
        UPDATE student_error_vault
        SET status='recovered', streak_ok=2, recovered_at=?, last_seen=?,
            trap_heat=CASE WHEN trap_heat>2 THEN trap_heat-2 ELSE 0 END
        WHERE {vault_where}
        """,
        tuple([_iso(), _iso()] + vparams),
    )
    return {
        "ok": True,
        "remedial_updated": int(updated or 0),
        "student_nid_masked": nid[-4:].rjust(4, "*"),
        "message": "حُدّثت حالة التطهير إلى مُتقَن.",
        "actor": actor.get("name") or "",
    }


def list_open_clinics(connection, teacher_nid: str = "", limit: int = 60) -> dict:
    ensure_clinic_columns(connection)
    limit = max(5, min(int(limit or 60), 120))
    params: list[Any] = [SOURCE_CLINIC]
    where = "r.source = ? AND COALESCE(r.status,'') IN ('مفتوح','open','قيد التنفيذ')"
    if teacher_nid:
        where += " AND r.national_id = ?"
        params.append("".join(ch for ch in teacher_nid if ch.isdigit()))
    rows = connection.execute(
        f"""
        SELECT r.id, r.national_id, r.subject, r.student_id, COALESCE(s.name,''),
               COALESCE(s.grade,''), COALESCE(s.classroom,''), r.skill, r.plan,
               r.status, COALESCE(r.grade_root,''), COALESCE(r.domain,''),
               COALESCE(r.section,''), COALESCE(r.etec_code,''), COALESCE(r.clinic_key,''),
               COALESCE(r.approved_at,'')
        FROM teacher_remedial r
        LEFT JOIN noor_students s ON s.national_id = r.student_id
        WHERE {where}
        ORDER BY r.id DESC
        LIMIT ?
        """,
        tuple(params + [limit]),
    ).fetchall()
    items = []
    for r in rows:
        domain = r[11] or _domain_of("")
        etec = ETEC.get(domain) or SUBJECT_TEACHERS.get(domain, {})
        code_ar = etec.get("code_ar") if isinstance(etec, dict) else ""
        if not code_ar and domain in SUBJECT_TEACHERS:
            code_ar = SUBJECT_TEACHERS[domain]["etec_code_ar"]
        items.append(
            {
                "id": r[0],
                "teacher_nid": r[1],
                "subject": r[2],
                "student_nid": r[3],
                "student_nid_masked": (r[3] or "")[-4:].rjust(4, "*") if r[3] else "",
                "student_name": r[4] or "طالب",
                "grade": r[5],
                "section": r[6] or r[12],
                "skill": r[7],
                "plan": r[8],
                "status": r[9],
                "grade_root": r[10],
                "domain": domain,
                "etec_code": r[13] or "",
                "etec_code_ar": code_ar or _e(r[13] or ""),
                "clinic_key": r[14],
                "approved_at": r[15],
            }
        )
    return {"ok": True, "count": len(items), "items": items}


class WorksheetRootBody(BaseModel):
    domain: str = "math"
    skill: str = ""
    grade_root: str = "٣م"
    count: int = 5
    student_nids: list[str] = Field(default_factory=list)


@router.get("/api/portal/teacher/clinics/proposals")
def api_clinic_proposals(
    grade: str = "",
    section: str = "",
    limit: int = 80,
    x_session_token: str = Header(default=""),
):
    from .portal_owner_api import _require_level

    user, level = _require_level(x_session_token, 2)
    connection = connect()
    try:
        pack = propose_clinics(connection, grade=grade, section=section, limit=limit)
        pack["viewer"] = {"name": user.get("name") or "", "level": level}
        return pack
    finally:
        connection.close()


@router.post("/api/portal/teacher/clinics/approve")
def api_clinic_approve(body: ApproveClinicBody, x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level

    user, level = _require_level(x_session_token, 2)
    connection = connect()
    try:
        result = approve_clinic(connection, body, user)
        connection.commit()
        result["viewer"] = {"name": user.get("name") or "", "level": level}
        return result
    finally:
        connection.close()


@router.get("/api/portal/teacher/clinics/open")
def api_clinic_open(
    teacher_nid: str = "",
    limit: int = 60,
    x_session_token: str = Header(default=""),
):
    from .portal_owner_api import _require_level

    user, level = _require_level(x_session_token, 2)
    connection = connect()
    try:
        pack = list_open_clinics(connection, teacher_nid=teacher_nid, limit=limit)
        pack["viewer"] = {"name": user.get("name") or "", "level": level}
        return pack
    finally:
        connection.close()


@router.post("/api/portal/teacher/clinics/purge-pass")
def api_clinic_purge_pass(body: PurgePassBody, x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level

    user, level = _require_level(x_session_token, 2)
    connection = connect()
    try:
        result = mark_purge_pass(connection, body, user)
        connection.commit()
        return result
    finally:
        connection.close()


@router.post("/api/portal/teacher/clinics/worksheet")
def api_clinic_worksheet(body: WorksheetRootBody, x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level, mask_nid
    from .portal_ssot import find_student

    user, level = _require_level(x_session_token, 2)
    connection = connect()
    try:
        ensure_clinic_columns(connection)
        domain = _domain_of(body.domain)
        teacher = SUBJECT_TEACHERS[domain]
        questions = _build_worksheet(
            connection, domain, body.skill, body.grade_root, body.count
        )
        students = []
        for nid in body.student_nids or []:
            st = find_student(connection, "".join(ch for ch in nid if ch.isdigit()))
            if st:
                students.append(
                    {
                        "name": st["name"],
                        "grade": st.get("grade") or "",
                        "section": st.get("section") or "",
                        "national_id_masked": mask_nid(st["national_id"]),
                    }
                )
        return {
            "ok": True,
            "title": f"ورقة علاجية مصغّرة — جذر {body.grade_root or '٣م'} · {teacher['subject']}",
            "domain": domain,
            "subject": teacher["subject"],
            "skill": body.skill,
            "grade_root": body.grade_root or "٣م",
            "etec_code_ar": teacher["etec_code_ar"],
            "teacher_name": teacher["teacher_name"],
            "students": students,
            "questions": questions,
            "viewer": {"name": user.get("name") or "", "level": level},
        }
    finally:
        connection.close()
