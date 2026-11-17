# مركز الاستيراد: معاينة ثم إدراج. لا يمس noor_timetable.

from __future__ import annotations

import hashlib
import json
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from .database import DB_PATH, connect, ensure_noor_students_enrichment_columns
from .noor_import import (
    apply_student_records,
    is_staff_workbook,
    is_student_workbook,
    is_thin_teachers_report,
    is_wadeh_backup,
    match_teacher_name,
    parse_students,
    parse_teacher_matrix,
    parse_teachers,
    stamp,
)

router = APIRouter(tags=["session-import-center"])

ROOT = Path(__file__).resolve().parent.parent
IMPORTS = ROOT / "School_Data" / "imports"
PENDING = IMPORTS / "_pending"
BACKUP_DIR = ROOT / "School_Data" / "backups" / "2026-11-09_import_center"
TIMETABLE_HASH = IMPORTS / "_timetable.sha256"


class CommitBody(BaseModel):
    token: str = ""
    tokens: list[str] = []


class AssignBody(BaseModel):
    token: str = ""
    teacher: str = ""
    national_id: str = ""


def _token(value: str) -> str:
    return str(value or "").strip()


def _require_principal(x_session_token: str) -> dict:
    from .access import require_principal

    try:
        return require_principal(_token(x_session_token))
    except PermissionError as error:
        message = str(error)
        status = 401 if message == "لا جلسة" else 403
        raise HTTPException(status_code=status, detail=message) from error


def ensure_nafes_timetable(connection=None) -> None:
    owns = connection is None
    if owns:
        connection = connect()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS nafes_timetable (
                id INTEGER PRIMARY KEY,
                day TEXT NOT NULL,
                period TEXT NOT NULL,
                subject TEXT,
                teacher TEXT NOT NULL,
                classroom TEXT,
                grade TEXT,
                section TEXT,
                kind TEXT NOT NULL DEFAULT 'regular',
                staff_id TEXT,
                updated_at TEXT
            )
            """
        )
        connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS ux_nafes_timetable_slot
            ON nafes_timetable(teacher, day, period)
            """
        )
        if owns:
            connection.commit()
    finally:
        if owns:
            connection.close()


def _attach_staff(records: list[dict]) -> tuple[list[dict], list[str], list[dict]]:
    connection = connect()
    unmatched: list[str] = []
    report: list[dict] = []
    try:
        extra: dict[str, dict] = {}
        staff = []
        for row in connection.execute("SELECT national_id, name, specialty, role FROM noor_staff"):
            identity = str(row[0] or "")
            staff.append((identity, str(row[1] or "")))
            extra[identity] = {
                "national_id": identity,
                "name": str(row[1] or ""),
                "specialty": str(row[2] or ""),
                "role": str(row[3] or ""),
            }
        by_name: dict[str, dict] = {}
        for row in records:
            teacher = str(row.get("teacher") or "").strip()
            if not teacher:
                row["staff_id"] = ""
                continue
            if teacher not in by_name:
                found = match_teacher_name(teacher, staff)
                hits = found.get("hits") or []
                status = found.get("status") or "unmatched"
                by_name[teacher] = found
                chosen = hits[0] if status == "matched" and hits else ("", "")
                report.append(
                    {
                        "name": teacher,
                        "status": "مطابق" if status == "matched" else ("غامض" if status == "ambiguous" else "غير مطابق"),
                        "reason": found.get("reason") or "",
                        "national_id": chosen[0],
                        "staff_name": chosen[1],
                        "candidates": [
                            extra.get(
                                item[0],
                                {"national_id": item[0], "name": item[1], "specialty": "", "role": ""},
                            )
                            for item in hits
                        ],
                    }
                )
                if status != "matched":
                    unmatched.append(teacher)
            status = (by_name[teacher].get("status") or "")
            hits = by_name[teacher].get("hits") or []
            row["staff_id"] = hits[0][0] if status == "matched" and hits else ""
    finally:
        connection.close()
    return records, unmatched, report


def _staff_options() -> list[dict]:
    connection = connect()
    try:
        rows = connection.execute(
            """
            SELECT national_id, name, specialty, role
            FROM noor_staff
            WHERE TRIM(COALESCE(national_id,'')) != ''
            ORDER BY name
            """
        ).fetchall()
    finally:
        connection.close()
    return [
        {
            "national_id": str(row[0] or ""),
            "name": str(row[1] or ""),
            "specialty": str(row[2] or ""),
            "role": str(row[3] or ""),
        }
        for row in rows
    ]


def _roles_payload(records: list[dict]) -> list[dict]:
    counts: dict[str, int] = {}
    for row in records:
        role = str(row.get("role") or "").strip() or "بلا صفة"
        counts[role] = counts.get(role, 0) + 1
    return [{"role": role, "count": counts[role]} for role in counts]


def _preview(records: list[dict], limit: int = 40) -> list[dict]:
    out = []
    for row in records[:limit]:
        out.append(
            {
                "day": row.get("day") or "",
                "period": row.get("period") or "",
                "subject": row.get("subject") or "",
                "teacher": row.get("teacher") or "",
                "classroom": row.get("classroom") or "",
                "grade": row.get("grade") or "",
                "section": row.get("section") or "",
                "kind": row.get("kind") or "",
                "staff_id": row.get("staff_id") or "",
                "name": row.get("name") or "",
                "national_id": row.get("national_id") or "",
                "role": row.get("role") or "",
                "specialty": row.get("specialty") or "",
            }
        )
    return out


def _analyze_bytes(kind: str, raw_name: str, raw: bytes) -> dict:
    kind = str(kind or "").strip()
    if kind not in {"matrix", "students", "teachers"}:
        raise HTTPException(status_code=400, detail="نوع الاستيراد: matrix أو students أو teachers")
    name = Path(raw_name or "").name
    if not name or name in {".", ".."}:
        raise HTTPException(status_code=400, detail="اسم الملف غير صالح")
    if is_wadeh_backup(name):
        raise HTTPException(status_code=400, detail="ملف وضح ليس جدولاً مدرسياً ولا يُستورد.")
    if kind == "teachers" and is_thin_teachers_report(name):
        return {
            "token": "",
            "kind": kind,
            "filename": name,
            "read": 0,
            "count": 0,
            "skipped": 0,
            "missing": [],
            "warnings": ["تقرير المعلمين المبسط بلا صفة يُستبعد. المصدر: GetEmployeeDataList."],
            "unmatched_teachers": [],
            "teachers_seen": [],
            "preview": [],
            "excluded": True,
            "sheets": 0,
            "match_report": [],
        }
    if kind == "teachers" and is_student_workbook(name):
        return {
            "token": "",
            "kind": kind,
            "filename": name,
            "read": 0,
            "count": 0,
            "skipped": 0,
            "missing": [],
            "warnings": ["هذا ملف طلاب، ارفعه في خانة استيراد الطلاب."],
            "unmatched_teachers": [],
            "teachers_seen": [],
            "preview": [],
            "excluded": True,
            "sheets": 0,
            "match_report": [],
        }
    if kind == "students" and (is_thin_teachers_report(name) or is_staff_workbook(name)):
        return {
            "token": "",
            "kind": kind,
            "filename": name,
            "read": 0,
            "count": 0,
            "skipped": 0,
            "missing": [],
            "warnings": ["هذا ملف منسوبين، ارفعه في خانة استيراد المنسوبين."],
            "unmatched_teachers": [],
            "teachers_seen": [],
            "preview": [],
            "excluded": True,
            "sheets": 0,
            "match_report": [],
        }
    file_hash = hashlib.sha256(raw).hexdigest()
    if kind == "matrix" and TIMETABLE_HASH.is_file() and TIMETABLE_HASH.read_text(encoding="utf-8").strip() == file_hash:
        return {
            "token": "",
            "kind": kind,
            "filename": name,
            "read": 0,
            "count": 0,
            "skipped": 0,
            "missing": [],
            "warnings": ["الجدول مكرر."],
            "unmatched_teachers": [],
            "teachers_seen": [],
            "preview": [],
            "excluded": True,
            "sheets": 0,
            "match_report": [],
        }
    PENDING.mkdir(parents=True, exist_ok=True)
    token = uuid.uuid4().hex
    suffix = Path(name).suffix.lower() or ".xlsx"
    path = PENDING / (token + suffix)
    path.write_bytes(raw)
    try:
        match_report = []
        if kind == "matrix":
            parsed = parse_teacher_matrix(path)
            parsed["records"], unmatched, match_report = _attach_staff(parsed.get("records") or [])
            parsed["unmatched_teachers"] = unmatched
            parsed["match_report"] = match_report
        elif kind == "students":
            parsed = parse_students(path)
            parsed["unmatched_teachers"] = []
            parsed["match_report"] = []
        else:
            parsed = parse_teachers(path, name)
            parsed["unmatched_teachers"] = []
            parsed["match_report"] = []
    except Exception as error:
        path.unlink(missing_ok=True)
        return {
            "token": "",
            "kind": kind,
            "filename": name,
            "read": 0,
            "count": 0,
            "skipped": 0,
            "missing": [],
            "warnings": ["تعذر قراءة الملف: " + str(error)],
            "unmatched_teachers": [],
            "teachers_seen": [],
            "preview": [],
            "excluded": True,
            "sheets": 0,
            "match_report": [],
        }
    payload = {
        "token": token,
        "kind": kind,
        "filename": name,
        "path": str(path),
        "file_hash": file_hash,
        "parsed": parsed,
    }
    (PENDING / (token + ".json")).write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )
    records = parsed.get("records") or []
    return {
        "token": token,
        "kind": kind,
        "filename": name,
        "read": parsed.get("read") or len(records),
        "count": len(records),
        "skipped": parsed.get("skipped") or 0,
        "missing": parsed.get("missing") or [],
        "warnings": parsed.get("warnings") or [],
        "unmatched_teachers": parsed.get("unmatched_teachers") or [],
        "teachers_seen": parsed.get("teachers_seen") or [],
        "preview": _preview(records) if kind == "matrix" else [],
        "excluded": bool(parsed.get("excluded")),
        "sheets": parsed.get("sheets") or 0,
        "classes": parsed.get("classes") or [],
        "distribution": parsed.get("distribution") or parsed.get("classes") or [],
        "empty_sheets": parsed.get("empty_sheets") or [],
        "roles": _roles_payload(records) if kind == "teachers" else [],
        "match_report": parsed.get("match_report") or [],
        "staff_options": _staff_options() if kind == "matrix" else [],
    }


def _preview_payload(token: str) -> dict:
    key = str(token or "").strip()
    if not key or not key.isalnum() or len(key) > 40:
        raise HTTPException(status_code=400, detail="رمز المعاينة غير صالح")
    meta_path = PENDING / (key + ".json")
    if not meta_path.is_file():
        raise HTTPException(status_code=404, detail="لا معاينة محفوظة. ارفع الملف أولاً.")
    payload = json.loads(meta_path.read_text(encoding="utf-8"))
    parsed = payload.get("parsed") or {}
    records = parsed.get("records") or []
    return {
        "token": key,
        "kind": payload.get("kind") or "",
        "filename": payload.get("filename") or "",
        "read": parsed.get("read") or len(records),
        "count": len(records),
        "skipped": parsed.get("skipped") or 0,
        "missing": parsed.get("missing") or [],
        "warnings": parsed.get("warnings") or [],
        "unmatched_teachers": parsed.get("unmatched_teachers") or [],
        "teachers_seen": parsed.get("teachers_seen") or [],
        "preview": _preview(records) if (payload.get("kind") or "") == "matrix" else [],
        "excluded": bool(parsed.get("excluded")),
        "sheets": parsed.get("sheets") or 0,
        "classes": parsed.get("classes") or [],
        "distribution": parsed.get("distribution") or parsed.get("classes") or [],
        "empty_sheets": parsed.get("empty_sheets") or [],
        "roles": _roles_payload(records) if (payload.get("kind") or "") == "teachers" else [],
        "match_report": parsed.get("match_report") or [],
        "staff_options": _staff_options() if (payload.get("kind") or "") == "matrix" else [],
    }


@router.post("/api/session/import-center/analyze")
async def analyze_import(
    kind: str = Form(...),
    file: UploadFile | None = File(None),
    files: list[UploadFile] | None = File(None),
    x_session_token: str = Header(default=""),
):
    """يقرأ ملفاً أو عدة ملفات ويعيد معاينة. لا يدرج في القاعدة."""
    _require_principal(x_session_token)
    uploads = [item for item in (files or []) if item is not None and item.filename]
    if file is not None and file.filename:
        uploads.append(file)
    if not uploads:
        raise HTTPException(status_code=400, detail="اختر ملفاً واحداً على الأقل")
    batches = []
    kind_key = str(kind or "").strip()
    matrix_hash = ""
    matrix_kept = 0
    for item in uploads:
        raw = await item.read()
        name = item.filename or ""
        if kind_key == "matrix" and matrix_kept:
            digest = hashlib.sha256(raw).hexdigest()
            reason = (
                "نسخة مكررة من نفس الملف."
                if matrix_hash and digest == matrix_hash
                else "رُفع أكثر من جدول. اختر جدولاً واحداً فقط."
            )
            batches.append(
                {
                    "token": "",
                    "kind": "matrix",
                    "filename": name,
                    "read": 0,
                    "count": 0,
                    "skipped": 0,
                    "missing": [],
                    "warnings": [reason],
                    "unmatched_teachers": [],
                    "teachers_seen": [],
                    "preview": [],
                    "excluded": True,
                    "sheets": 0,
                    "match_report": [],
                }
            )
            continue
        if kind_key == "matrix":
            matrix_hash = hashlib.sha256(raw).hexdigest()
            matrix_kept = 1
        batches.append(_analyze_bytes(kind_key, name, raw))
    if len(batches) == 1:
        return batches[0]
    return {
        "kind": str(kind or "").strip(),
        "batches": batches,
        "tokens": [row.get("token") or "" for row in batches if row.get("token")],
        "filename": "، ".join(row.get("filename") or "" for row in batches),
        "read": sum(int(row.get("read") or 0) for row in batches),
        "count": sum(int(row.get("count") or 0) for row in batches),
        "skipped": sum(int(row.get("skipped") or 0) for row in batches),
        "unmatched_teachers": [],
        "preview": [],
    }


@router.post("/api/session/import/timetable")
async def import_timetable(
    file: UploadFile = File(...),
    x_session_token: str = Header(default=""),
):
    """يرفع الجدول الشامل ويعيد رمز المعاينة. لا يدرج حتى التأكيد."""
    _require_principal(x_session_token)
    return _analyze_bytes("matrix", file.filename or "", await file.read())


@router.get("/api/session/import/preview")
def import_preview(token: str = "", x_session_token: str = Header(default="")):
    """يعيد معاينة الملف المحلَّل بالرمز. لا يدرج."""
    _require_principal(x_session_token)
    return _preview_payload(token)


def _backup_before_commit() -> str:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp_name = "school-" + stamp().replace(":", "") + ".db"
    target = BACKUP_DIR / stamp_name
    if DB_PATH.is_file():
        shutil.copy2(DB_PATH, target)
    return str(target)


def _upsert_matrix(records: list[dict]) -> dict:
    connection = connect()
    inserted = 0
    updated = 0
    failed = []
    moment = stamp()
    try:
        ensure_nafes_timetable(connection)
        for row in records:
            teacher = str(row.get("teacher") or "").strip()
            day = str(row.get("day") or "").strip()
            period = str(row.get("period") or "").strip()
            if not teacher or not day or not period:
                failed.append({"teacher": teacher, "reason": "يوم أو حصة أو معلم ناقص"})
                continue
            existing = connection.execute(
                "SELECT id FROM nafes_timetable WHERE teacher = ? AND day = ? AND period = ?",
                (teacher, day, period),
            ).fetchone()
            values = (
                str(row.get("subject") or ""),
                str(row.get("classroom") or ""),
                str(row.get("grade") or ""),
                str(row.get("section") or ""),
                str(row.get("kind") or "regular"),
                str(row.get("staff_id") or ""),
                moment,
                teacher,
                day,
                period,
            )
            if existing:
                connection.execute(
                    """
                    UPDATE nafes_timetable
                    SET subject = ?, classroom = ?, grade = ?, section = ?, kind = ?,
                        staff_id = ?, updated_at = ?, is_deleted = 0
                    WHERE teacher = ? AND day = ? AND period = ?
                    """,
                    values,
                )
                updated += 1
            else:
                connection.execute(
                    """
                    INSERT INTO nafes_timetable (
                        subject, classroom, grade, section, kind, staff_id, updated_at,
                        teacher, day, period
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    values,
                )
                inserted += 1
        connection.commit()
    finally:
        connection.close()
    return {"inserted": inserted, "updated": updated, "failed": failed}


def _upsert_people(kind: str, records: list[dict]) -> dict:
    connection = connect()
    inserted = 0
    updated = 0
    failed = []
    unmatched = []
    ambiguous = []
    moment = stamp()
    try:
        if kind == "teachers":
            for row in records:
                identity = str(row.get("national_id") or "").strip()
                name = str(row.get("name") or "").strip()
                if not identity or not name:
                    failed.append({"name": name, "reason": "هوية أو اسم ناقص"})
                    continue
                current = connection.execute(
                    "SELECT name, mobile, specialty, role FROM noor_staff WHERE national_id = ?",
                    (identity,),
                ).fetchone()
                if current:
                    kept_name = str(current[0] or "").strip() or name
                    mobile = str(row.get("mobile") or "").strip() or str(current[1] or "")
                    specialty = str(row.get("specialty") or "").strip() or str(current[2] or "")
                    role = str(row.get("role") or "").strip() or str(current[3] or "")
                    connection.execute(
                        """
                        UPDATE noor_staff
                        SET name = ?, mobile = ?, specialty = ?, role = ?, updated_at = ?
                        WHERE national_id = ?
                        """,
                        (kept_name, mobile, specialty, role, moment, identity),
                    )
                    updated += 1
                else:
                    connection.execute(
                        """
                        INSERT INTO noor_staff (
                            national_id, name, mobile, specialty, role, active, updated_at
                        ) VALUES (?, ?, ?, ?, ?, 1, ?)
                        """,
                        (
                            identity,
                            name,
                            str(row.get("mobile") or ""),
                            str(row.get("specialty") or ""),
                            str(row.get("role") or ""),
                            moment,
                        ),
                    )
                    inserted += 1
        else:
            ensure_noor_students_enrichment_columns(connection)
            result = apply_student_records(connection, records)
            inserted = int(result.get("inserted") or 0)
            updated = int(result.get("updated") or 0)
            failed = list(result.get("failed") or [])
            unmatched = list(result.get("unmatched") or [])
            ambiguous = list(result.get("ambiguous") or [])
        connection.commit()
    finally:
        connection.close()
    return {
        "inserted": inserted,
        "updated": updated,
        "failed": failed,
        "unmatched": unmatched,
        "ambiguous": ambiguous,
    }


def _commit_one(token: str, backup: str) -> dict:
    key = str(token or "").strip()
    if not key or not key.isalnum() or len(key) > 40:
        raise HTTPException(status_code=400, detail="رمز المعاينة غير صالح")
    meta_path = PENDING / (key + ".json")
    if not meta_path.is_file():
        raise HTTPException(status_code=400, detail="لا معاينة محفوظة. حلّل الملف أولاً.")
    payload = json.loads(meta_path.read_text(encoding="utf-8"))
    kind = str(payload.get("kind") or "")
    parsed = payload.get("parsed") or {}
    records = parsed.get("records") or []
    if kind == "matrix":
        digest = str(payload.get("file_hash") or "").strip()
        stored = TIMETABLE_HASH.read_text(encoding="utf-8").strip() if TIMETABLE_HASH.is_file() else ""
        if digest and stored and digest == stored:
            raise HTTPException(status_code=400, detail="الجدول مكرر.")
        result = _upsert_matrix(records)
        if digest:
            TIMETABLE_HASH.write_text(digest, encoding="utf-8")
    elif kind in {"students", "teachers"}:
        result = _upsert_people(kind, records)
    else:
        raise HTTPException(status_code=400, detail="نوع غير معروف")
    xlsx = Path(str(payload.get("path") or ""))
    if xlsx.is_file() and PENDING in xlsx.parents:
        xlsx.unlink(missing_ok=True)
    meta_path.unlink(missing_ok=True)
    failed = result.get("failed") or []
    return {
        "ok": True,
        "kind": kind,
        "filename": payload.get("filename") or "",
        "read": parsed.get("read") or len(records),
        "success": int(result.get("inserted") or 0) + int(result.get("updated") or 0),
        "inserted": result.get("inserted") or 0,
        "updated": result.get("updated") or 0,
        "failed": len(failed),
        "failed_rows": failed[:50],
        "unmatched_teachers": parsed.get("unmatched_teachers") or [],
        "unmatched": result.get("unmatched") or [],
        "ambiguous": result.get("ambiguous") or [],
        "backup": backup,
        "snapshot": _live_snapshot(),
    }


def _live_snapshot() -> dict:
    connection = connect()
    try:
        ensure_noor_students_enrichment_columns(connection)
        students = int(
            connection.execute(
                "SELECT COUNT(*) FROM noor_students WHERE COALESCE(is_deleted, 0) = 0"
            ).fetchone()[0]
        )
        empty_grade = int(
            connection.execute(
                """
                SELECT COUNT(*) FROM noor_students
                WHERE COALESCE(is_deleted, 0) = 0 AND (grade IS NULL OR grade = '')
                """
            ).fetchone()[0]
        )
        enriched = int(
            connection.execute(
                """
                SELECT COUNT(*) FROM noor_students
                WHERE COALESCE(is_deleted, 0) = 0
                  AND enriched_at IS NOT NULL AND enriched_at != ''
                """
            ).fetchone()[0]
        )
        classes = [
            {"grade": row[0] or "", "classroom": row[1] or "", "count": row[2]}
            for row in connection.execute(
                """
                SELECT grade, classroom, COUNT(*)
                FROM noor_students
                WHERE COALESCE(is_deleted, 0) = 0
                GROUP BY grade, classroom
                ORDER BY grade, classroom
                """
            ).fetchall()
        ]
        roles = [
            {"role": row[0] or "(بلا صفة)", "count": row[1]}
            for row in connection.execute(
                "SELECT role, COUNT(*) FROM noor_staff WHERE COALESCE(is_deleted, 0) = 0 GROUP BY role ORDER BY COUNT(*) DESC"
            ).fetchall()
        ]
        staff = int(
            connection.execute(
                "SELECT COUNT(*) FROM noor_staff WHERE COALESCE(is_deleted, 0) = 0"
            ).fetchone()[0]
        )
        empty_role = int(
            connection.execute(
                """
                SELECT COUNT(*) FROM noor_staff
                WHERE COALESCE(is_deleted, 0) = 0 AND (role IS NULL OR trim(role) = '')
                """
            ).fetchone()[0]
        )
        timetable = 0
        try:
            timetable = int(
                connection.execute(
                    "SELECT COUNT(*) FROM nafes_timetable WHERE COALESCE(is_deleted, 0) = 0"
                ).fetchone()[0]
            )
        except Exception:
            timetable = 0
        linked = 0
        try:
            linked = int(
                connection.execute(
                    """
                    SELECT COUNT(*) FROM nafes_timetable
                    WHERE COALESCE(is_deleted, 0) = 0
                      AND staff_id IS NOT NULL AND trim(staff_id) != ''
                    """
                ).fetchone()[0]
            )
        except Exception:
            linked = 0
    finally:
        connection.close()
    return {
        "ok": True,
        "students": students,
        "empty_grade": empty_grade,
        "enriched": enriched,
        "classes": classes,
        "staff": staff,
        "roles": roles,
        "empty_role": empty_role,
        "timetable": timetable,
        "linked": linked,
        "unlinked": max(0, timetable - linked),
        "gaps": _integrity_gaps(empty_grade, empty_role, timetable, linked),
    }


def _integrity_gaps(empty_grade: int, empty_role: int, timetable: int, linked: int) -> list:
    gaps = []
    if empty_grade:
        gaps.append({"key": "empty_grade", "label": "طلاب بلا صف", "count": empty_grade})
    if empty_role:
        gaps.append({"key": "empty_role", "label": "منسوبون بلا صفة", "count": empty_role})
    unlinked = max(0, int(timetable or 0) - int(linked or 0))
    if unlinked:
        gaps.append({"key": "unlinked", "label": "حصص بلا ربط منسوب", "count": unlinked})
    return gaps


@router.get("/api/session/import-center/snapshot")
def import_center_snapshot(x_session_token: str = Header(default="")):
    """ملخص القاعدة الحالي لمركز الاستيراد."""
    _require_principal(x_session_token)
    return _live_snapshot()


@router.post("/api/session/import-center/assign")
def assign_import_teacher(body: AssignBody, x_session_token: str = Header(default="")):
    """يربط اسم الجدول بمنسوب يدوياً في المعاينة قبل الإدراج."""
    _require_principal(x_session_token)
    key = str(body.token or "").strip()
    teacher = str(body.teacher or "").strip()
    identity = str(body.national_id or "").strip()
    if not key or not key.isalnum() or len(key) > 40:
        raise HTTPException(status_code=400, detail="رمز المعاينة غير صالح")
    if not teacher or not identity:
        raise HTTPException(status_code=400, detail="الاسم والهوية مطلوبان")
    meta_path = PENDING / (key + ".json")
    if not meta_path.is_file():
        raise HTTPException(status_code=404, detail="لا معاينة محفوظة. ارفع الملف أولاً.")
    connection = connect()
    try:
        row = connection.execute(
            "SELECT national_id, name FROM noor_staff WHERE national_id = ?",
            (identity,),
        ).fetchone()
    finally:
        connection.close()
    if not row:
        raise HTTPException(status_code=400, detail="الهوية ليست في المنسوبين")
    payload = json.loads(meta_path.read_text(encoding="utf-8"))
    parsed = payload.get("parsed") or {}
    records = parsed.get("records") or []
    for item in records:
        if str(item.get("teacher") or "").strip() == teacher:
            item["staff_id"] = identity
    report = parsed.get("match_report") or []
    unmatched = parsed.get("unmatched_teachers") or []
    found = False
    for item in report:
        if str(item.get("name") or "").strip() != teacher:
            continue
        item["status"] = "مطابق"
        item["national_id"] = identity
        item["staff_name"] = str(row[1] or "")
        item["reason"] = "تعيين يدوي"
        found = True
    if not found:
        report.append(
            {
                "name": teacher,
                "status": "مطابق",
                "national_id": identity,
                "staff_name": str(row[1] or ""),
                "reason": "تعيين يدوي",
                "candidates": [],
            }
        )
    parsed["records"] = records
    parsed["match_report"] = report
    parsed["unmatched_teachers"] = [name for name in unmatched if name != teacher]
    payload["parsed"] = parsed
    meta_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return {
        "ok": True,
        "token": key,
        "match_report": report,
        "unmatched_teachers": parsed["unmatched_teachers"],
        "staff_options": _staff_options(),
    }


@router.post("/api/session/import-center/commit")
def commit_import(body: CommitBody, x_session_token: str = Header(default="")):
    """يدرج المعاينة المؤكدة. نسخ احتياطي ثم upsert بلا حذف الجدول القائم."""
    _require_principal(x_session_token)
    tokens = []
    for item in [body.token] + list(body.tokens or []):
        text = str(item or "").strip()
        if text and text not in tokens:
            tokens.append(text)
    if not tokens:
        raise HTTPException(status_code=400, detail="رمز المعاينة غير صالح")
    backup = _backup_before_commit()
    if len(tokens) == 1:
        return _commit_one(tokens[0], backup)
    inserted = 0
    updated = 0
    failed = 0
    read = 0
    kinds = []
    for key in tokens:
        row = _commit_one(key, backup)
        inserted += int(row.get("inserted") or 0)
        updated += int(row.get("updated") or 0)
        failed += int(row.get("failed") or 0)
        read += int(row.get("read") or 0)
        if row.get("kind"):
            kinds.append(row["kind"])
    return {
        "ok": True,
        "kind": kinds[0] if kinds else "",
        "read": read,
        "success": inserted + updated,
        "inserted": inserted,
        "updated": updated,
        "failed": failed,
        "failed_rows": [],
        "unmatched_teachers": [],
        "backup": backup,
    }
