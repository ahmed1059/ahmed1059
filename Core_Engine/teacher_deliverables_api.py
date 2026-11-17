# تسليمات المعلم — المدير يرفع نيابة عن المعلم. لا واجهة معلم.
# الملفات خارج المسارات العامة. الحذف لا يبدأ إلا بعد نسخة احتياطية.

from __future__ import annotations

import json
import re
import shutil
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from .database import connect

router = APIRouter(tags=["teacher-deliverables"])

_ROOT = Path(__file__).resolve().parents[1]
_DIR = _ROOT / "School_Data" / "teacher_deliverables"
_BACKUPS = _ROOT / "School_Data" / "backups"
_LOG = _ROOT / "docs" / "سجل_1059.md"
_MAX_BYTES = 10 * 1024 * 1024
_PLAN = "plan"
_TYPE_LABELS = {
    "plan": "الخطة الدراسية",
    "prep": "التحضير اليومي",
    "visits": "الزيارات الصفية",
    "tests": "أدوات التقويم",
    "results": "تحليل النتائج",
    "portfolio": "ملف إنجاز المعلم",
    "growth": "التطوير المهني",
}
_KINDS = {
    "pdf": {"ext": ".pdf", "media": "application/pdf", "magic": b"%PDF"},
    "jpg": {"ext": ".jpg", "media": "image/jpeg", "magic": b"\xff\xd8\xff"},
    "png": {"ext": ".png", "media": "image/png", "magic": b"\x89PNG"},
}


def attachment_name(teacher_name: str, stored_name: str, original_name: str = "", kind: str = _PLAN) -> str:
    """اسم التحميل من اسم المرفق الأصلي ولاحقة الملف المحفوظ. الملفات التجريبية لا تُستخدم اسماً."""
    suffix = Path(str(stored_name or original_name or "")).suffix.lower()
    if suffix == ".jpeg":
        suffix = ".jpg"
    if suffix not in {".pdf", ".jpg", ".png"}:
        suffix = ".pdf"
    stem = Path(str(original_name or "")).name
    stem = Path(stem).stem
    stem = re.sub(r"[\\/:*?\"<>|]+", " ", stem)
    stem = re.sub(r"\s+", " ", stem).strip()
    weak = {"", "trial", "file", "plan"}
    if stem.lower() in weak or stem.lower().startswith("png_"):
        teacher = re.sub(r"[\\/:*?\"<>|]+", " ", str(teacher_name or ""))
        teacher = re.sub(r"\s+", " ", teacher).strip() or "معلم"
        stem = _TYPE_LABELS.get(str(kind or ""), "تسليم") + " - " + teacher
    return stem + suffix


def stored_academic_year() -> str:
    """العام المحفوظ في دورة التقويم. لا يُخترع عام إن غاب الصف."""
    connection = connect()
    try:
        row = connection.execute(
            """
            SELECT academic_year FROM evaluation_cycles
            WHERE academic_year IS NOT NULL AND TRIM(academic_year) != ''
            ORDER BY id DESC LIMIT 1
            """
        ).fetchone()
    except sqlite3.Error:
        return ""
    finally:
        connection.close()
    if not row:
        return ""
    return str(row[0] or "").strip()


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


def _require_actor(x_session_token: str) -> dict:
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _is_principal(user: dict) -> bool:
    return str((user or {}).get("role") or "").startswith("مدير")


def _ensure(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS teacher_deliverables (
            id TEXT PRIMARY KEY,
            teacher_id TEXT NOT NULL,
            deliverable_type TEXT NOT NULL,
            subject TEXT NOT NULL,
            file_path TEXT NOT NULL,
            original_name TEXT NOT NULL,
            upload_date TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            academic_year TEXT NOT NULL
        )
        """
    )


def _kind_of(payload: bytes, filename: str) -> dict:
    name = Path(str(filename or "")).name.lower()
    suffix = Path(name).suffix
    allowed_suffix = {".pdf": "pdf", ".jpg": "jpg", ".jpeg": "jpg", ".png": "png"}
    hinted = allowed_suffix.get(suffix, "")
    found = ""
    for key, spec in _KINDS.items():
        if payload.startswith(spec["magic"]):
            found = key
            break
    if not found or (hinted and hinted != found):
        raise HTTPException(status_code=400, detail="الملف يجب أن يكون PDF أو JPG أو PNG")
    return _KINDS[found]


def _teacher_name(connection, teacher_id: str) -> str:
    row = connection.execute(
        "SELECT name FROM noor_staff WHERE national_id = ?",
        (teacher_id,),
    ).fetchone()
    if not row or not str(row[0] or "").strip():
        raise HTTPException(status_code=400, detail="رقم الهوية غير موجود في سجل المنسوبين")
    return str(row[0]).strip()


def _append_log(action: str, record: dict, teacher_name: str) -> None:
    kind = _TYPE_LABELS.get(str(record.get("deliverable_type") or ""), "تسليم")
    line = (
        "- " + datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        + " — " + action
        + " — النوع: " + kind
        + " — المعلم: " + teacher_name
        + " — المعرّف: " + str(record.get("id") or "")
        + "\n"
    )
    with _LOG.open("a", encoding="utf-8") as handle:
        handle.write(line)


def _backup_row(record: dict, source: Path) -> None:
    _BACKUPS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    meta = _BACKUPS / ("teacher_deliverable-" + str(record["id"]) + "-" + stamp + ".json")
    meta.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    if source.is_file():
        target = _BACKUPS / ("teacher_deliverable-" + str(record["id"]) + "-" + stamp + source.suffix)
        shutil.copy2(source, target)
        if not target.is_file() or target.stat().st_size != source.stat().st_size:
            raise HTTPException(status_code=500, detail="تعذر إنشاء النسخة الاحتياطية")
    if not meta.is_file():
        raise HTTPException(status_code=500, detail="تعذر إنشاء النسخة الاحتياطية")


def _section_text(rows) -> str:
    return "\n".join(str(row or "").strip() for row in rows if str(row or "").strip())


def teacher_file_sections(connection, national_id: str) -> dict:
    """سبعة أقسام من الجداول المزروعة. لا يمس ملفات الرفع الأربعة."""
    identity = str(national_id or "").strip()
    person = connection.execute(
        "SELECT name FROM noor_staff WHERE national_id = ? AND COALESCE(is_deleted, 0) = 0",
        (identity,),
    ).fetchone()
    if not person:
        raise HTTPException(status_code=404, detail="المعلم غير موجود في السجل")
    docs = {}
    for kind, content in connection.execute(
        "SELECT doc_type, content_json FROM teacher_documents WHERE national_id = ?",
        (identity,),
    ):
        try:
            payload = json.loads(content or "{}")
        except json.JSONDecodeError:
            payload = {}
        docs[str(kind)] = str(payload.get("text") or "").strip()
    exams = connection.execute(
        """
        SELECT exam_type, exam_date, subject, grade, section, total_students, notes
        FROM teacher_exams WHERE national_id = ? ORDER BY exam_date
        """,
        (identity,),
    ).fetchall()
    exam_text = _section_text(
        f"{row[0]} · {row[1]} · {row[2]} · {row[3]}/{row[4]} · طلاب الفصل {row[5]}. {row[6] or ''}"
        for row in exams
    )
    analysis = connection.execute(
        """
        SELECT subject, strengths, recommendations FROM teacher_analysis
        WHERE national_id = ? ORDER BY id DESC LIMIT 1
        """,
        (identity,),
    ).fetchone()
    analysis_text = ""
    if analysis:
        analysis_text = f"المادة: {analysis[0]}\nمؤشرات القوة: {analysis[1]}\nجوانب التحسين والتوصية: {analysis[2]}"
    remedial = connection.execute(
        """
        SELECT s.name, r.skill, r.plan FROM teacher_remedial r
        LEFT JOIN noor_students s ON s.national_id = r.student_id
        WHERE r.national_id = ? ORDER BY s.name
        """,
        (identity,),
    ).fetchall()
    remedial_text = _section_text(
        f"{row[0] or ''} — {row[1] or ''}. {row[2] or ''}" for row in remedial
    )
    enrichment = connection.execute(
        """
        SELECT s.name, e.activity FROM teacher_enrichment e
        LEFT JOIN noor_students s ON s.national_id = e.student_id
        WHERE e.national_id = ? ORDER BY s.name
        """,
        (identity,),
    ).fetchall()
    enrichment_text = _section_text(f"{row[0] or ''} — {row[1] or ''}" for row in enrichment)
    subject = ""
    if exams:
        subject = str(exams[0][2] or "")
    sections = [
        {"key": "curriculum", "title": "توزيع المنهج", "text": docs.get("curriculum", "")},
        {"key": "prep", "title": "التحضير الأسبوعي", "text": docs.get("prep", "")},
        {"key": "exams", "title": "الاختبارات", "text": exam_text},
        {"key": "analysis", "title": "تحليل النتائج", "text": analysis_text},
        {"key": "remedial", "title": "الخطة العلاجية", "text": remedial_text},
        {"key": "enrichment", "title": "الخطة الإثرائية", "text": enrichment_text},
        {"key": "visits", "title": "تبادل الزيارات", "text": docs.get("visits", "")},
    ]
    return {
        "national_id": identity,
        "name": str(person[0] or ""),
        "subject": subject,
        "sections": sections,
    }


@router.get("/api/session/teacher-deliverables")
def list_teacher_deliverables(
    teacher_id: str = "",
    national_id: str = "",
    deliverable_type: str = "",
    x_session_token: str = Header(default=""),
):
    """قائمة التسليمات. مع national_id تعيد الأقسام السبعة المزروعة."""
    actor = _require_actor(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        if national_id.strip():
            scope = national_id.strip()
            if not _is_principal(actor) and scope != str(actor.get("id") or "").strip():
                raise HTTPException(status_code=403, detail="لا يُعرض ملف معلم آخر")
            payload = teacher_file_sections(connection, scope)
            upload_rows = connection.execute(
                """
                SELECT d.id, d.teacher_id, s.name, d.deliverable_type, d.original_name
                FROM teacher_deliverables d
                LEFT JOIN noor_staff s ON s.national_id = d.teacher_id
                ORDER BY d.id
                """
            ).fetchall()
            uploads = []
            for row in upload_rows:
                owner = str(row[1] or "")
                if _is_principal(actor) or owner == scope:
                    uploads.append({
                        "id": row[0],
                        "teacher_id": owner,
                        "teacher_name": str(row[2] or ""),
                        "deliverable_type": str(row[3] or ""),
                        "original_name": str(row[4] or ""),
                    })
            payload["uploads"] = uploads
            connection.commit()
            return payload
        connection.commit()
        query = """
            SELECT d.id, d.teacher_id, s.name, d.deliverable_type, d.subject,
                   d.original_name, d.upload_date, d.notes, d.academic_year, d.file_path
            FROM teacher_deliverables d
            LEFT JOIN noor_staff s ON s.national_id = d.teacher_id
            WHERE 1 = 1
        """
        params = []
        scope = teacher_id.strip()
        if not _is_principal(actor):
            scope = str(actor.get("id") or "").strip()
        if scope:
            query += " AND d.teacher_id = ?"
            params.append(scope)
        if deliverable_type.strip():
            query += " AND d.deliverable_type = ?"
            params.append(deliverable_type.strip())
        query += " ORDER BY d.upload_date DESC, d.id DESC"
        rows = connection.execute(query, params).fetchall()
    finally:
        connection.close()
    items = []
    for row in rows:
        stored = _DIR / Path(str(row[9] or "")).name
        size = stored.stat().st_size if stored.is_file() else 0
        suffix = stored.suffix.lower() if stored.is_file() else Path(str(row[5] or "")).suffix.lower()
        kind_file = "pdf" if suffix == ".pdf" else ("image" if suffix in {".jpg", ".jpeg", ".png"} else "")
        items.append({
            "id": row[0],
            "teacher_id": row[1],
            "teacher_name": row[2] or "",
            "deliverable_type": row[3],
            "subject": row[4],
            "original_name": row[5],
            "file_name": attachment_name(row[2] or "", row[9] or "", row[5] or "", row[3] or ""),
            "upload_date": row[6],
            "notes": row[7] or "",
            "academic_year": row[8],
            "byte_size": size,
            "displayable": size >= 500,
            "file_kind": kind_file,
            "file_url": "/api/session/teacher-deliverables/" + str(row[0]) + "/file",
        })
    return {"items": items, "academic_year": stored_academic_year()}


@router.post("/api/session/teacher-deliverables")
async def create_teacher_deliverable(
    teacher_id: str = Form(default=""),
    subject: str = Form(default=""),
    notes: str = Form(default=""),
    deliverable_type: str = Form(default=_PLAN),
    upload: UploadFile = File(...),
    x_session_token: str = Header(default=""),
):
    """يرفع تسليم معلم. العام يُؤخذ من السجل المحفوظ ولا يُقبل فارغًا."""
    actor = _require_actor(x_session_token)
    identity = teacher_id.strip()
    if not _is_principal(actor):
        identity = str(actor.get("id") or "").strip()
    topic = subject.strip()
    kind = deliverable_type.strip() or _PLAN
    if kind not in _TYPE_LABELS:
        raise HTTPException(status_code=400, detail="نوع التسليم غير مسموح")
    if not identity:
        raise HTTPException(status_code=400, detail="المعلم والمادة مطلوبان")
    year = stored_academic_year()
    if not year:
        raise HTTPException(status_code=400, detail="العام الدراسي غير محفوظ")
    payload = await upload.read()
    if not payload or len(payload) > _MAX_BYTES:
        raise HTTPException(status_code=400, detail="الملف فارغ أو يتجاوز 10 ميجابايت")
    spec = _kind_of(payload, upload.filename or "")
    connection = connect()
    try:
        _ensure(connection)
        if not topic:
            spec_row = connection.execute(
                "SELECT specialty FROM noor_staff WHERE national_id = ?",
                (identity,),
            ).fetchone()
            topic = str(spec_row[0] or "").strip() if spec_row else ""
        if not topic:
            raise HTTPException(status_code=400, detail="المعلم والمادة مطلوبان")
        teacher_name = _teacher_name(connection, identity)
        record_id = uuid.uuid4().hex
        _DIR.mkdir(parents=True, exist_ok=True)
        stored = _DIR / (record_id + spec["ext"])
        stored.write_bytes(payload)
        moment = datetime.now().strftime("%Y-%m-%d")
        original = Path(str(upload.filename or "file")).name or ("file" + spec["ext"])
        try:
            connection.execute(
            """
            INSERT INTO teacher_deliverables (
                id, teacher_id, deliverable_type, subject, file_path,
                original_name, upload_date, notes, academic_year
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (record_id, identity, kind, topic, stored.name, original, moment, notes.strip(), year),
            )
            connection.commit()
        except Exception:
            connection.rollback()
            if stored.is_file():
                stored.unlink()
            raise
    except HTTPException:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "id": record_id,
        "teacher_id": identity,
        "teacher_name": teacher_name,
        "deliverable_type": kind,
        "subject": topic,
        "original_name": original,
        "file_name": attachment_name(teacher_name, stored.name, original, kind),
        "upload_date": moment,
        "notes": notes.strip(),
        "academic_year": year,
    }


@router.get("/api/session/teacher-deliverables/{record_id}/file")
def download_teacher_deliverable(
    record_id: str,
    download: int = 0,
    x_session_token: str = Header(default=""),
):
    """تنزيل الملف المحمي. الرفض 403 حتى لا يفتح المتصفح صندوق اسم المستخدم."""
    actor = _require_actor(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        row = connection.execute(
            """
            SELECT d.file_path, d.original_name, s.name, d.deliverable_type, d.teacher_id
            FROM teacher_deliverables d
            LEFT JOIN noor_staff s ON s.national_id = d.teacher_id
            WHERE d.id = ?
            """,
            (record_id.strip(),),
        ).fetchone()
    finally:
        connection.close()
    if not row:
        raise HTTPException(status_code=404, detail="التسليم غير موجود")
    owner = str(row[4] or "").strip()
    if not _is_principal(actor) and owner != str(actor.get("id") or "").strip():
        raise HTTPException(status_code=403, detail="لا صلاحية على هذا الملف")
    path = _DIR / Path(str(row[0])).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    suffix = path.suffix.lower()
    media = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }.get(suffix, "application/octet-stream")
    filename = attachment_name(row[2] or "", row[0] or "", row[1] or "", row[3] or "")
    if download:
        return FileResponse(
            path,
            media_type=media,
            filename=filename,
            content_disposition_type="attachment",
        )
    # المعاينة: بدون اسم .pdf حتى لا يعترض مدير التحميل الجسم فيصبح «تالف».
    payload = path.read_bytes()
    return Response(
        content=payload,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "no-store",
            "X-File-Name": filename,
            "X-File-Kind": "pdf" if suffix == ".pdf" else ("image" if suffix in {".jpg", ".jpeg", ".png"} else "file"),
            "X-File-Size": str(len(payload)),
        },
    )


@router.post("/api/session/teacher-deliverables/{record_id}/evidence")
def attach_deliverable_evidence(record_id: str, x_session_token: str = Header(default="")):
    """ينسخ ملف التسليم إلى visual_evidence دون حذف الأصل."""
    actor = _require_actor(x_session_token)
    from .visual_evidence import add_visual_files

    connection = connect()
    try:
        _ensure(connection)
        row = connection.execute(
            """
            SELECT d.id, d.file_path, d.original_name, d.teacher_id
            FROM teacher_deliverables d WHERE d.id = ?
            """,
            (record_id.strip(),),
        ).fetchone()
    finally:
        connection.close()
    if not row:
        raise HTTPException(status_code=404, detail="التسليم غير موجود")
    owner = str(row[3] or "").strip()
    if not _is_principal(actor) and owner != str(actor.get("id") or "").strip():
        raise HTTPException(status_code=403, detail="لا صلاحية على هذا الملف")
    path = _DIR / Path(str(row[1])).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    data = path.read_bytes()
    if len(data) < 500:
        raise HTTPException(status_code=400, detail="الملف تالف ولا يُرفق كشاهد")
    try:
        result = add_visual_files(
            "teacher_deliverable",
            str(row[0]),
            [{"filename": row[2] or path.name, "content": data}],
            uploaded_by=str(actor.get("id") or "").strip(),
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return result


@router.delete("/api/session/teacher-deliverables/{record_id}")
def delete_teacher_deliverable(record_id: str, x_session_token: str = Header(default="")):
    """يحذف تسليمًا بعد نسخ الملف وصفّه. فشل النسخ يوقف الحذف."""
    _require_principal(x_session_token)
    connection = connect()
    try:
        _ensure(connection)
        row = connection.execute(
            """
            SELECT d.id, d.teacher_id, s.name, d.deliverable_type, d.subject,
                   d.file_path, d.original_name, d.upload_date, d.notes, d.academic_year
            FROM teacher_deliverables d
            LEFT JOIN noor_staff s ON s.national_id = d.teacher_id
            WHERE d.id = ?
            """,
            (record_id.strip(),),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="التسليم غير موجود")
        record = {
            "id": row[0],
            "teacher_id": row[1],
            "teacher_name": row[2] or "",
            "deliverable_type": row[3],
            "subject": row[4],
            "file_path": row[5],
            "original_name": row[6],
            "upload_date": row[7],
            "notes": row[8] or "",
            "academic_year": row[9],
        }
        source = _DIR / Path(str(row[5])).name
        _backup_row(record, source)
        connection.execute("DELETE FROM teacher_deliverables WHERE id = ?", (row[0],))
        connection.commit()
        if source.is_file():
            source.unlink()
        _append_log("حذف", record, record["teacher_name"] or record["teacher_id"])
    except HTTPException:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {"ok": True, "id": record_id.strip()}
