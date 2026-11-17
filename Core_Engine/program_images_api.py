# صور بطاقة البرنامج. الملفات خارج المسارات العامة. لا يمس visual_evidence.

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .database import connect
from .noor_import import stamp

router = APIRouter(tags=["session-program-images"])

_ROOT = Path(__file__).resolve().parents[1]
_DIR = _ROOT / "School_Data" / "program_images"
_MAX_BYTES = 3 * 1024 * 1024
_MAX_PER_PROGRAM = 5
_KINDS = {
    "jpg": {"ext": ".jpg", "media": "image/jpeg", "magic": b"\xff\xd8\xff"},
    "png": {"ext": ".png", "media": "image/png", "magic": b"\x89PNG"},
    "webp": {"ext": ".webp", "media": "image/webp"},
}


def _token(value: str) -> str:
    return str(value or "").strip()


def _require_user(x_session_token: str) -> dict:
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _require_principal(x_session_token: str) -> dict:
    from .access import require_principal

    try:
        return require_principal(_token(x_session_token))
    except PermissionError as error:
        message = str(error)
        status = 401 if message == "لا جلسة" else 403
        raise HTTPException(status_code=status, detail=message) from error


def ensure_program_plan_table(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS program_plan_files (
            program_id INTEGER PRIMARY KEY,
            file_path TEXT NOT NULL,
            original_name TEXT NOT NULL DEFAULT '',
            created_at TEXT
        )
        """
    )


def ensure_program_images_table(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS program_images (
            id INTEGER PRIMARY KEY,
            program_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            original_name TEXT NOT NULL DEFAULT '',
            caption TEXT NOT NULL DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT
        )
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_program_images_program
        ON program_images(program_id, sort_order, id)
        """
    )


def _kind_of(payload: bytes, filename: str) -> dict:
    name = Path(str(filename or "")).name.lower()
    suffix = Path(name).suffix
    if suffix == ".jpeg":
        suffix = ".jpg"
    hinted = {".jpg": "jpg", ".png": "png", ".webp": "webp"}.get(suffix, "")
    found = ""
    if payload.startswith(_KINDS["jpg"]["magic"]):
        found = "jpg"
    elif payload.startswith(_KINDS["png"]["magic"]):
        found = "png"
    elif len(payload) >= 12 and payload[:4] == b"RIFF" and payload[8:12] == b"WEBP":
        found = "webp"
    if not found or (hinted and hinted != found):
        raise HTTPException(status_code=400, detail="الصورة يجب أن تكون JPG أو PNG أو WebP")
    return _KINDS[found]


def _safe_file(stored: str) -> Path:
    relative = Path(str(stored or "").replace("\\", "/"))
    if relative.is_absolute() or ".." in relative.parts:
        raise HTTPException(status_code=400, detail="مسار الملف غير صالح")
    path = (_DIR / relative).resolve()
    root = _DIR.resolve()
    if root != path and root not in path.parents:
        raise HTTPException(status_code=400, detail="مسار الملف غير صالح")
    return path


def _item(row) -> dict:
    image_id = row[0]
    return {
        "id": image_id,
        "program_id": row[1],
        "caption": str(row[4] or "").strip(),
        "sort_order": int(row[5] or 0),
        "created_at": str(row[6] or "").strip(),
        "original_name": str(row[3] or "").strip(),
        "url": "/api/session/program-images/" + str(image_id) + "/file",
    }


def _program_exists(connection, program_id: int) -> bool:
    row = connection.execute(
        "SELECT id FROM school_programs WHERE id = ?",
        (program_id,),
    ).fetchone()
    return bool(row)


def _list_rows(connection, program_id: int):
    return connection.execute(
        """
        SELECT id, program_id, file_path, original_name, caption, sort_order, created_at
        FROM program_images
        WHERE program_id = ?
        ORDER BY sort_order, id
        """,
        (program_id,),
    ).fetchall()


@router.get("/api/session/programs/{program_id}/images")
def list_program_images(program_id: int, x_session_token: str = Header(default="")):
    """صور بطاقة البرنامج. جلسة مطلوبة."""
    _require_user(x_session_token)
    connection = connect()
    try:
        ensure_program_images_table(connection)
        connection.commit()
        if not _program_exists(connection, program_id):
            raise HTTPException(status_code=404, detail="البرنامج غير موجود")
        rows = _list_rows(connection, program_id)
    finally:
        connection.close()
    return {"program_id": program_id, "items": [_item(row) for row in rows]}


@router.post("/api/session/programs/{program_id}/images")
async def upload_program_images(
    program_id: int,
    caption: str = Form(""),
    files: list[UploadFile] | None = File(None),
    file: UploadFile | None = File(None),
    x_session_token: str = Header(default=""),
):
    """يرفع حتى خمس صور لبطاقة البرنامج. أي صاحب جلسة."""
    _require_user(x_session_token)
    uploads = [item for item in (files or []) if item is not None and item.filename]
    if file is not None and file.filename:
        uploads.append(file)
    if not uploads:
        raise HTTPException(status_code=400, detail="اختر صورة واحدة على الأقل")
    note = str(caption or "").strip()
    saved = []
    connection = connect()
    try:
        ensure_program_images_table(connection)
        if not _program_exists(connection, program_id):
            raise HTTPException(status_code=404, detail="البرنامج غير موجود")
        current = connection.execute(
            "SELECT COUNT(*) FROM program_images WHERE program_id = ?",
            (program_id,),
        ).fetchone()[0]
        if current + len(uploads) > _MAX_PER_PROGRAM:
            raise HTTPException(
                status_code=400,
                detail="الحد الأقصى خمس صور لكل برنامج",
            )
        order_row = connection.execute(
            "SELECT COALESCE(MAX(sort_order), 0) FROM program_images WHERE program_id = ?",
            (program_id,),
        ).fetchone()
        next_order = int(order_row[0] or 0) + 1
        folder = _DIR / str(program_id)
        folder.mkdir(parents=True, exist_ok=True)
        for upload in uploads:
            payload = await upload.read()
            if not payload:
                raise HTTPException(status_code=400, detail="الملف فارغ")
            if len(payload) > _MAX_BYTES:
                raise HTTPException(status_code=400, detail="حجم الصورة لا يتجاوز 3 ميغابايت")
            kind = _kind_of(payload, upload.filename or "")
            stored_name = uuid.uuid4().hex + kind["ext"]
            relative = str(program_id) + "/" + stored_name
            target = folder / stored_name
            target.write_bytes(payload)
            cursor = connection.execute(
                """
                INSERT INTO program_images
                    (program_id, file_path, original_name, caption, sort_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    program_id,
                    relative,
                    Path(str(upload.filename or stored_name)).name,
                    note,
                    next_order,
                    stamp(),
                ),
            )
            next_order += 1
            row = connection.execute(
                """
                SELECT id, program_id, file_path, original_name, caption, sort_order, created_at
                FROM program_images WHERE id = ?
                """,
                (cursor.lastrowid,),
            ).fetchone()
            saved.append(_item(row))
        connection.commit()
    except HTTPException:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {"ok": True, "program_id": program_id, "items": saved}


@router.get("/api/session/program-images/{image_id}/file")
def download_program_image(image_id: int, x_session_token: str = Header(default="")):
    """يُرجع ملف الصورة بعد التحقق من الجلسة."""
    _require_user(x_session_token)
    connection = connect()
    try:
        ensure_program_images_table(connection)
        row = connection.execute(
            "SELECT file_path, original_name FROM program_images WHERE id = ?",
            (image_id,),
        ).fetchone()
    finally:
        connection.close()
    if not row:
        raise HTTPException(status_code=404, detail="الصورة غير موجودة")
    path = _safe_file(row[0])
    if not path.is_file():
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    suffix = path.suffix.lower()
    media = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(suffix, "application/octet-stream")
    return FileResponse(
        path,
        media_type=media,
        filename=str(row[1] or path.name),
        content_disposition_type="inline",
    )


@router.delete("/api/session/program-images/{image_id}")
def delete_program_image(image_id: int, x_session_token: str = Header(default="")):
    """يحذف صورة البطاقة وصفّها. لا يمس school_programs ولا visual_evidence."""
    _require_user(x_session_token)
    connection = connect()
    try:
        ensure_program_images_table(connection)
        row = connection.execute(
            "SELECT id, file_path FROM program_images WHERE id = ?",
            (image_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="الصورة غير موجودة")
        path = _safe_file(row[1])
        connection.execute("DELETE FROM program_images WHERE id = ?", (row[0],))
        connection.commit()
    except HTTPException:
        connection.rollback()
        raise
    finally:
        connection.close()
    if path.is_file():
        path.unlink()
    return {"success": True}


_PLAN_DIR = _ROOT / "School_Data" / "program_plans"
_PLAN_MAX_BYTES = 15 * 1024 * 1024


def _plan_path(stored: str) -> Path:
    relative = Path(str(stored or "").replace("\\", "/"))
    if relative.is_absolute() or ".." in relative.parts:
        raise HTTPException(status_code=400, detail="مسار الملف غير صالح")
    path = (_PLAN_DIR / relative).resolve()
    root = _PLAN_DIR.resolve()
    if root != path and root not in path.parents:
        raise HTTPException(status_code=400, detail="مسار الملف غير صالح")
    return path


def _plan_item(row) -> dict:
    program_id = row[0]
    return {
        "program_id": program_id,
        "original_name": str(row[2] or "").strip(),
        "created_at": str(row[3] or "").strip(),
        "url": "/api/session/programs/" + str(program_id) + "/plan-file/file",
    }


def _require_pdf(payload: bytes, filename: str) -> None:
    name = Path(str(filename or "")).name.lower()
    if not name.endswith(".pdf") or not payload.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="الملف يجب أن يكون PDF")
    if len(payload) > _PLAN_MAX_BYTES:
        raise HTTPException(status_code=400, detail="حجم الملف لا يتجاوز 15 ميغابايت")


@router.get("/api/session/programs/{program_id}/plan-file")
def read_program_plan(program_id: int, x_session_token: str = Header(default="")):
    """بيانات الخطة التفصيلية. جلسة مطلوبة. لا صف يعني أن الملف غير مرفق."""
    _require_user(x_session_token)
    connection = connect()
    try:
        ensure_program_plan_table(connection)
        connection.commit()
        if not _program_exists(connection, program_id):
            raise HTTPException(status_code=404, detail="البرنامج غير موجود")
        row = connection.execute(
            """
            SELECT program_id, file_path, original_name, created_at
            FROM program_plan_files WHERE program_id = ?
            """,
            (program_id,),
        ).fetchone()
    finally:
        connection.close()
    return {"program_id": program_id, "item": _plan_item(row) if row else None}


@router.post("/api/session/programs/{program_id}/plan-file")
async def upload_program_plan(
    program_id: int,
    file: UploadFile | None = File(None),
    x_session_token: str = Header(default=""),
):
    """يرفع خطة تفصيلية واحدة ويستبدل السابقة. أي صاحب جلسة. لا يمس صور البطاقة."""
    _require_user(x_session_token)
    if file is None or not file.filename:
        raise HTTPException(status_code=400, detail="اختر ملف PDF")
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="الملف فارغ")
    _require_pdf(payload, file.filename or "")
    stored_name = uuid.uuid4().hex + ".pdf"
    relative = str(program_id) + "/" + stored_name
    folder = _PLAN_DIR / str(program_id)
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / stored_name
    target.write_bytes(payload)
    previous = ""
    connection = connect()
    try:
        ensure_program_plan_table(connection)
        if not _program_exists(connection, program_id):
            raise HTTPException(status_code=404, detail="البرنامج غير موجود")
        current = connection.execute(
            "SELECT file_path FROM program_plan_files WHERE program_id = ?",
            (program_id,),
        ).fetchone()
        previous = str(current[0] or "") if current else ""
        original = Path(str(file.filename or stored_name)).name
        if current:
            connection.execute(
                """
                UPDATE program_plan_files
                SET file_path = ?, original_name = ?, created_at = ?
                WHERE program_id = ?
                """,
                (relative, original, stamp(), program_id),
            )
        else:
            connection.execute(
                """
                INSERT INTO program_plan_files (program_id, file_path, original_name, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (program_id, relative, original, stamp()),
            )
        connection.commit()
        row = connection.execute(
            """
            SELECT program_id, file_path, original_name, created_at
            FROM program_plan_files WHERE program_id = ?
            """,
            (program_id,),
        ).fetchone()
    except HTTPException:
        connection.rollback()
        if target.is_file():
            target.unlink()
        raise
    except Exception:
        connection.rollback()
        if target.is_file():
            target.unlink()
        raise
    finally:
        connection.close()
    if previous and previous != relative:
        old = _plan_path(previous)
        if old.is_file():
            old.unlink()
    return {"ok": True, "program_id": program_id, "item": _plan_item(row)}


@router.get("/api/session/programs/{program_id}/plan-file/file")
def download_program_plan(program_id: int, x_session_token: str = Header(default="")):
    """يعرض ملف الخطة التفصيلية داخل الصفحة بعد التحقق من الجلسة."""
    _require_user(x_session_token)
    connection = connect()
    try:
        ensure_program_plan_table(connection)
        row = connection.execute(
            "SELECT file_path, original_name FROM program_plan_files WHERE program_id = ?",
            (program_id,),
        ).fetchone()
    finally:
        connection.close()
    if not row:
        raise HTTPException(status_code=404, detail="لا خطة تفصيلية مرفقة")
    path = _plan_path(row[0])
    if not path.is_file():
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=str(row[1] or path.name),
        content_disposition_type="inline",
    )


@router.delete("/api/session/programs/{program_id}/plan-file")
def delete_program_plan(program_id: int, x_session_token: str = Header(default="")):
    """يحذف الخطة التفصيلية. لا يمس البرنامج ولا صور البطاقة."""
    _require_user(x_session_token)
    connection = connect()
    try:
        ensure_program_plan_table(connection)
        row = connection.execute(
            "SELECT file_path FROM program_plan_files WHERE program_id = ?",
            (program_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="لا خطة تفصيلية مرفقة")
        path = _plan_path(row[0])
        connection.execute(
            "DELETE FROM program_plan_files WHERE program_id = ?",
            (program_id,),
        )
        connection.commit()
    except HTTPException:
        connection.rollback()
        raise
    finally:
        connection.close()
    if path.is_file():
        path.unlink()
    return {"success": True}
