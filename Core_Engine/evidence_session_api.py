# قراءة ملف شاهد واحد بجلسة. لا يغيّر visual_evidence.py ولا يحذف الملفات.

from __future__ import annotations

import io
import zipfile
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import FileResponse, Response

from .database import connect
from .visual_evidence import (
    EVIDENCE_ROOT,
    can_delete_visual,
    ensure_visual_evidence_table,
    list_visual_evidence,
)

router = APIRouter(tags=["session-evidence-file"])

_MIN_DISPLAY_BYTES = 500
_MEDIA = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
}


def _token(value: str) -> str:
    return str(value or "").strip()


def _require_user(x_session_token: str) -> dict:
    from .access import require_user

    try:
        return require_user(_token(x_session_token))
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _row(item_id: int):
    connection = connect()
    try:
        ensure_visual_evidence_table(connection)
        return connection.execute(
            """
            SELECT id, entity_type, entity_key, register_key, kind, url, name, created_at
            FROM visual_evidence WHERE id = ?
            """,
            (int(item_id),),
        ).fetchone()
    finally:
        connection.close()


def _disk_from_url(url: str) -> Path | None:
    text = str(url or "").strip()
    if not text.startswith("/evidence/"):
        return None
    relative = Path(text[len("/evidence/") :].lstrip("/"))
    if relative.is_absolute() or ".." in relative.parts:
        return None
    disk = (EVIDENCE_ROOT / relative).resolve()
    root = EVIDENCE_ROOT.resolve()
    if root != disk and root not in disk.parents:
        return None
    if not disk.is_file():
        return None
    return disk


def _enrich(item: dict, user: dict | None = None) -> dict:
    out = dict(item)
    kind = str(out.get("kind") or "")
    disk = _disk_from_url(out.get("url") or "")
    size = disk.stat().st_size if disk else 0
    out["byte_size"] = size
    out["can_delete"] = can_delete_visual(user, out)
    out["can_replace"] = out["can_delete"] and str(out.get("kind") or "") != "link"
    if kind == "link":
        out["file_url"] = ""
        out["displayable"] = bool(str(out.get("url") or "").strip())
    else:
        item_id = out.get("id")
        out["file_url"] = "/api/session/evidence/" + str(item_id) + "/file" if item_id else ""
        out["displayable"] = size >= _MIN_DISPLAY_BYTES
    return out


@router.get("/api/session/visual-evidence")
def session_list_visual_evidence(
    entity_type: str = "",
    entity_key: str = "",
    x_session_token: str = Header(default=""),
):
    """قائمة شواهد الكيان مع الحجم ومسار الجلسة. لا يحذف التالف."""
    user = _require_user(x_session_token)
    try:
        items = list_visual_evidence(entity_type, entity_key)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {
        "entity_type": entity_type,
        "entity_key": entity_key,
        "items": [_enrich(item, user) for item in items],
    }


@router.get("/api/session/visual-evidence/export")
def export_visual_evidence(ids: str = "", x_session_token: str = Header(default="")):
    """يجمع مرفقات المعاينة في ملف مضغوط واحد. لا يحذف الأصل."""
    user = _require_user(x_session_token)
    wanted = []
    for part in str(ids or "").split(","):
        text = part.strip()
        if text.isdigit() and int(text) > 0:
            wanted.append(int(text))
    if not wanted:
        raise HTTPException(status_code=400, detail="لا مرفقات للتصدير.")
    buffer = io.BytesIO()
    added = 0
    used = set()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for item_id in wanted:
            row = _row(item_id)
            if not row:
                continue
            entity_type = str(row[1] or "")
            if entity_type == "teacher_portfolio" and str(row[2] or "").strip() != str(user.get("id") or "").strip():
                continue
            if str(row[4] or "") == "link":
                continue
            disk = _disk_from_url(str(row[5] or ""))
            if not disk:
                continue
            raw_name = Path(str(row[6] or "").strip() or disk.name).name
            arcname = str(item_id) + "-" + raw_name
            if arcname in used:
                arcname = str(item_id) + "-" + disk.name
            used.add(arcname)
            archive.write(disk, arcname=arcname)
            added += 1
    if added < 1:
        raise HTTPException(status_code=404, detail="لا ملفات محفوظة للتصدير.")
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": "attachment; filename=attachments.zip",
            "Cache-Control": "no-store",
            "X-Export-Count": str(added),
        },
    )


@router.get("/api/session/evidence/{item_id}/file")
def session_evidence_file(item_id: int, download: int = 0, x_session_token: str = Header(default="")):
    """يعيد ملف الشاهد بجلسة. المعاينة بلا اسم .pdf حتى لا يعترضها مدير التحميل."""
    _require_user(x_session_token)
    if int(item_id or 0) < 1:
        raise HTTPException(status_code=400, detail="معرف الشاهد غير صالح")
    row = _row(item_id)
    if not row:
        raise HTTPException(status_code=404, detail="الشاهد غير موجود")
    kind = str(row[4] or "")
    if kind == "link":
        raise HTTPException(status_code=400, detail="هذا الشاهد رابط وليس ملفاً")
    disk = _disk_from_url(str(row[5] or ""))
    if not disk:
        raise HTTPException(status_code=404, detail="ملف الشاهد غير موجود")
    suffix = disk.suffix.lower()
    media = _MEDIA.get(suffix, "application/octet-stream")
    name = str(row[6] or "").strip() or disk.name
    if download:
        return FileResponse(
            path=str(disk),
            media_type=media,
            filename=name,
            content_disposition_type="attachment",
        )
    payload = disk.read_bytes()
    kind_file = "pdf" if suffix == ".pdf" else ("image" if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"} else "file")
    ascii_name = "evidence-" + str(item_id) + (suffix if suffix else "")
    return Response(
        content=payload,
        media_type=media if media != "application/octet-stream" else "application/octet-stream",
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "no-store",
            "X-File-Name": ascii_name,
            "X-File-Kind": kind_file,
            "X-File-Size": str(len(payload)),
        },
    )
