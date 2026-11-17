# مكوّن الشاهد البصري الموحّد: صور / فيديو / PDF / روابط لأي كيان.
# المبدأ: التخزين بالمسار أو الرابط المحفوظ فقط، مع Override دون مسح بالتعبئة التلقائية.

from __future__ import annotations

import io
import json
import re
import uuid
from pathlib import Path
from urllib.parse import urlparse

from .database import connect
from .noor_import import stamp

EVIDENCE_ROOT = Path(__file__).resolve().parent.parent / "School_Data" / "evidence"

ENTITY_TYPES = {
    "soft_period",
    "daily_task",
    "program",
    "action",
    "minutes",
    "council_minutes",  # محاضر سجل المجالس المدرسية
    "event",
    "lesson",
    "register",
    "teacher_portfolio",  # سجل إنجاز المعلم، والمفتاح رقم هويته
    "teacher_deliverable",  # تسليم معلم محفوظ، والمفتاح معرّف التسليم
}

KIND_IMAGE = "image"
KIND_VIDEO = "video"
KIND_PDF = "pdf"
KIND_LINK = "link"

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXT = {".mp4", ".webm"}
PDF_EXT = {".pdf"}

MAX_IMAGES = 5
MAX_VIDEOS = 2
MAX_PDFS = 3
MAX_LINKS = 5
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
_COMPRESS_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def ensure_visual_evidence_table(connection=None):
    """ينشئ جدول الشواهد البصرية إن لم يوجد."""
    own = connection is None
    if own:
        connection = connect()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS visual_evidence (
                id INTEGER PRIMARY KEY,
                entity_type TEXT NOT NULL,
                entity_key TEXT NOT NULL,
                register_key TEXT,
                kind TEXT NOT NULL,
                url TEXT NOT NULL,
                name TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_visual_evidence_entity
            ON visual_evidence(entity_type, entity_key)
            """
        )
        columns = [row[1] for row in connection.execute("PRAGMA table_info(visual_evidence)")]
        if "uploaded_by" not in columns:
            connection.execute("ALTER TABLE visual_evidence ADD COLUMN uploaded_by TEXT")
        if own:
            connection.commit()
    finally:
        if own:
            connection.close()


def _item_dict(row):
    return {
        "id": row[0],
        "entity_type": row[1],
        "entity_key": row[2],
        "register_key": row[3] or "",
        "kind": row[4],
        "url": row[5],
        "name": row[6] or "",
        "created_at": row[7] or "",
        "uploaded_by": (row[8] or "") if len(row) > 8 else "",
    }


def can_delete_visual(user, item):
    """إدارة الشاهد داخل المدرسة: الرافع، والمدير دائماً، والوكيل لغير السجل الشخصي."""
    if not user or not item:
        return False
    uid = str(user.get("id") or "").strip()
    if not uid:
        return False
    role = str(user.get("role") or "")
    entity = str(item.get("entity_type") or "")
    uploaded = str(item.get("uploaded_by") or "").strip()
    if uploaded == uid:
        return True
    if entity == "teacher_portfolio" and str(item.get("entity_key") or "").strip() == uid:
        return True
    if role.startswith("مدير"):
        return True
    if "وكيل" in role and entity != "teacher_portfolio":
        return True
    return False


def list_visual_evidence(entity_type, entity_key, connection=None):
    """يرجع مرفقات كيان واحد مرتبة زمنياً."""
    entity_type = str(entity_type or "").strip()
    entity_key = str(entity_key or "").strip()
    if entity_type not in ENTITY_TYPES:
        raise ValueError("نوع الكيان غير معتمد للشواهد البصرية.")
    if not entity_key:
        raise ValueError("معرّف الكيان مطلوب.")
    own = connection is None
    if own:
        connection = connect()
    try:
        ensure_visual_evidence_table(connection)
        rows = connection.execute(
            """
            SELECT id, entity_type, entity_key, register_key, kind, url, name, created_at, uploaded_by
            FROM visual_evidence
            WHERE entity_type = ? AND entity_key = ?
            ORDER BY id
            """,
            (entity_type, entity_key),
        ).fetchall()
        return [_item_dict(row) for row in rows]
    finally:
        if own:
            connection.close()


def rebind_visual_evidence(entity_type, from_key, to_key, connection=None):
    """ينقل صفوف الشواهد من مفتاح كيان إلى مفتاح آخر (مسودة → program-{id})."""
    entity_type = str(entity_type or "").strip()
    from_key = str(from_key or "").strip()
    to_key = str(to_key or "").strip()
    if entity_type not in ENTITY_TYPES:
        raise ValueError("نوع الكيان غير معتمد للشواهد البصرية.")
    if not from_key or not to_key:
        raise ValueError("مفتاحا المصدر والهدف مطلوبان.")
    if from_key == to_key:
        return {
            "entity_type": entity_type,
            "entity_key": to_key,
            "moved": 0,
            "items": list_visual_evidence(entity_type, to_key, connection),
        }
    own = connection is None
    if own:
        connection = connect()
    try:
        ensure_visual_evidence_table(connection)
        cursor = connection.execute(
            """
            UPDATE visual_evidence
            SET entity_key = ?
            WHERE entity_type = ? AND entity_key = ?
            """,
            (to_key, entity_type, from_key),
        )
        moved = int(cursor.rowcount or 0)
        if own:
            connection.commit()
        return {
            "entity_type": entity_type,
            "entity_key": to_key,
            "from_key": from_key,
            "moved": moved,
            "items": list_visual_evidence(entity_type, to_key, connection),
        }
    finally:
        if own:
            connection.close()


def soft_entity_key(day_iso, slot_code):
    """مفتاح موحّد لصف متابعة لاصفية."""
    return str(day_iso or "").strip() + "|" + str(slot_code or "").strip()


def _safe_folder(entity_type, entity_key):
    safe_type = re.sub(r"[^a-zA-Z0-9_-]+", "", entity_type)
    safe_key = re.sub(r"[^a-zA-Z0-9_|.-]+", "_", entity_key).replace("|", "__")
    folder = (EVIDENCE_ROOT / safe_type / safe_key).resolve()
    root = EVIDENCE_ROOT.resolve()
    if root not in folder.parents and folder != root:
        raise ValueError("مسار الشاهد غير مسموح.")
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _public_path(path: Path):
    root = EVIDENCE_ROOT.resolve()
    resolved = path.resolve()
    if root not in resolved.parents and resolved != root:
        raise ValueError("مسار الشاهد غير مسموح.")
    return "/evidence/" + resolved.relative_to(root).as_posix()


def _kind_from_name(filename):
    ext = Path(filename or "").suffix.lower()
    if ext in IMAGE_EXT:
        return KIND_IMAGE
    if ext in VIDEO_EXT:
        return KIND_VIDEO
    if ext in PDF_EXT:
        return KIND_PDF
    return ""


def _counts(items):
    return {
        KIND_IMAGE: sum(1 for item in items if item["kind"] == KIND_IMAGE),
        KIND_VIDEO: sum(1 for item in items if item["kind"] == KIND_VIDEO),
        KIND_PDF: sum(1 for item in items if item["kind"] == KIND_PDF),
        KIND_LINK: sum(1 for item in items if item["kind"] == KIND_LINK),
    }


def _limits():
    return {
        KIND_IMAGE: MAX_IMAGES,
        KIND_VIDEO: MAX_VIDEOS,
        KIND_PDF: MAX_PDFS,
        KIND_LINK: MAX_LINKS,
    }


def _mark_soft_override(connection, entity_type, entity_key):
    """عند اللاصفية: يثبت Override دون مسح بقية الحقول."""
    if entity_type != "soft_period" or "|" not in str(entity_key or ""):
        return
    day_iso, slot_code = str(entity_key).split("|", 1)
    from .soft_periods import autofill_week_follow, ensure_soft_periods_tables, week_start_sunday

    ensure_soft_periods_tables(connection)
    autofill_week_follow(week_start_sunday(day_iso), connection)
    connection.execute(
        """
        UPDATE soft_period_follow
        SET is_overridden = 1, updated_at = ?
        WHERE day_iso = ? AND slot_code = ?
        """,
        (stamp(), day_iso, slot_code),
    )


def _strip_soft_legacy_url(connection, entity_type, entity_key, url):
    """يزيل مسارًا محذوفًا من evidence_images القديم حتى لا يُعاد ترحيله."""
    if entity_type != "soft_period" or "|" not in str(entity_key or ""):
        return
    url = str(url or "").strip()
    if not url:
        return
    day_iso, slot_code = str(entity_key).split("|", 1)
    from .soft_periods import dump_evidence_images, parse_evidence_images

    row = connection.execute(
        """
        SELECT evidence_images FROM soft_period_follow
        WHERE day_iso = ? AND slot_code = ?
        """,
        (day_iso, slot_code),
    ).fetchone()
    if not row:
        return
    current = parse_evidence_images(row[0])
    if url not in current:
        return
    kept = [path for path in current if path != url]
    connection.execute(
        """
        UPDATE soft_period_follow
        SET evidence_images = ?, is_overridden = 1, updated_at = ?
        WHERE day_iso = ? AND slot_code = ?
        """,
        (dump_evidence_images(kept) if kept else None, stamp(), day_iso, slot_code),
    )


def compress_image(data: bytes, ext: str) -> tuple[bytes, str]:
    """يضغط صورة raster قبل الحفظ. الناتج أصغر يُحفظ JPEG، وإلا يُبقى الأصل."""
    suffix = str(ext or "").lower()
    if suffix not in _COMPRESS_EXT or not data:
        return data, suffix or ext
    from PIL import Image

    image = Image.open(io.BytesIO(data))
    if image.mode != "RGB":
        image = image.convert("RGB")
    image.thumbnail((1920, 1920))
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=80, optimize=True)
    compressed = output.getvalue()
    if compressed and len(compressed) < len(data):
        return compressed, ".jpg"
    return data, suffix


def add_visual_files(entity_type, entity_key, uploads, register_key="", uploaded_by=""):
    """يرفع ملفات شاهد بصري ويربطها بالكيان."""
    entity_type = str(entity_type or "").strip()
    entity_key = str(entity_key or "").strip()
    register_key = str(register_key or "").strip()
    uploaded_by = str(uploaded_by or "").strip()
    if entity_type not in ENTITY_TYPES:
        raise ValueError("نوع الكيان غير معتمد للشواهد البصرية.")
    if not entity_key:
        raise ValueError("معرّف الكيان مطلوب.")
    files = list(uploads or [])
    if not files:
        raise ValueError("اختر ملفاً واحداً على الأقل.")
    connection = connect()
    try:
        ensure_visual_evidence_table(connection)
        current = list_visual_evidence(entity_type, entity_key, connection)
        counts = _counts(current)
        limits = _limits()
        folder = _safe_folder(entity_type, entity_key)
        now = stamp()
        added = []
        for upload in files:
            name = Path(str((upload or {}).get("filename") or "")).name or "file.bin"
            kind = _kind_from_name(name)
            if not kind:
                raise ValueError("صيغة الملف غير معتمدة: " + (Path(name).suffix or "بدون امتداد"))
            if counts[kind] >= limits[kind]:
                raise ValueError("بلغ الحد الأقصى لمرفقات نوع «" + kind + "».")
            data = (upload or {}).get("content") or b""
            if not data:
                continue
            if len(data) > MAX_UPLOAD_BYTES:
                raise ValueError("الملف أكبر من 5 ميغابايت.")
            ext = Path(name).suffix.lower() or ".bin"
            if kind == KIND_IMAGE:
                data, ext = compress_image(data, ext)
            target = folder / (uuid.uuid4().hex + ext)
            target.write_bytes(data)
            url = _public_path(target)
            connection.execute(
                """
                INSERT INTO visual_evidence (
                    entity_type, entity_key, register_key, kind, url, name, created_at, uploaded_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (entity_type, entity_key, register_key, kind, url, name, now, uploaded_by),
            )
            counts[kind] += 1
            added.append(True)
        if not added:
            raise ValueError("تعذر حفظ الملفات.")
        _mark_soft_override(connection, entity_type, entity_key)
        connection.commit()
        return {
            "entity_type": entity_type,
            "entity_key": entity_key,
            "register_key": register_key,
            "items": list_visual_evidence(entity_type, entity_key, connection),
        }
    finally:
        connection.close()


def add_visual_link(entity_type, entity_key, url, name="", register_key="", uploaded_by=""):
    """يضيف رابطاً خارجياً كشاهد بصري محفوظ."""
    entity_type = str(entity_type or "").strip()
    entity_key = str(entity_key or "").strip()
    register_key = str(register_key or "").strip()
    uploaded_by = str(uploaded_by or "").strip()
    url = str(url or "").strip()
    name = str(name or "").strip() or url
    if entity_type not in ENTITY_TYPES:
        raise ValueError("نوع الكيان غير معتمد للشواهد البصرية.")
    if not entity_key:
        raise ValueError("معرّف الكيان مطلوب.")
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("الرابط يجب أن يبدأ بـ http أو https.")
    connection = connect()
    try:
        ensure_visual_evidence_table(connection)
        current = list_visual_evidence(entity_type, entity_key, connection)
        if _counts(current)[KIND_LINK] >= MAX_LINKS:
            raise ValueError("بلغ الحد الأقصى للروابط.")
        now = stamp()
        connection.execute(
            """
            INSERT INTO visual_evidence (
                entity_type, entity_key, register_key, kind, url, name, created_at, uploaded_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (entity_type, entity_key, register_key, KIND_LINK, url, name, now, uploaded_by),
        )
        _mark_soft_override(connection, entity_type, entity_key)
        connection.commit()
        return {
            "entity_type": entity_type,
            "entity_key": entity_key,
            "register_key": register_key,
            "items": list_visual_evidence(entity_type, entity_key, connection),
        }
    finally:
        connection.close()


def get_visual_item(item_id, connection=None):
    """يرجع مرفقاً واحداً أو None."""
    item_id = int(item_id or 0)
    if item_id <= 0:
        return None
    own = connection is None
    if own:
        connection = connect()
    try:
        ensure_visual_evidence_table(connection)
        row = connection.execute(
            """
            SELECT id, entity_type, entity_key, register_key, kind, url, name, created_at, uploaded_by
            FROM visual_evidence WHERE id = ?
            """,
            (item_id,),
        ).fetchone()
        return _item_dict(row) if row else None
    finally:
        if own:
            connection.close()


def remove_visual_item(item_id):
    """يحذف مرفقاً واحداً وملفه المحلي إن وُجد داخل evidence/."""
    item_id = int(item_id or 0)
    if item_id <= 0:
        raise ValueError("معرّف المرفق غير صالح.")
    connection = connect()
    try:
        ensure_visual_evidence_table(connection)
        row = connection.execute(
            """
            SELECT id, entity_type, entity_key, register_key, kind, url, name, created_at, uploaded_by
            FROM visual_evidence WHERE id = ?
            """,
            (item_id,),
        ).fetchone()
        if not row:
            raise ValueError("المرفق غير موجود.")
        item = _item_dict(row)
        url = item["url"]
        if url.startswith("/evidence/"):
            disk = (EVIDENCE_ROOT / url[len("/evidence/") :]).resolve()
            root = EVIDENCE_ROOT.resolve()
            if root in disk.parents and disk.is_file():
                disk.unlink()
        connection.execute("DELETE FROM visual_evidence WHERE id = ?", (item_id,))
        _strip_soft_legacy_url(connection, item["entity_type"], item["entity_key"], url)
        _mark_soft_override(connection, item["entity_type"], item["entity_key"])
        connection.commit()
        return {
            "entity_type": item["entity_type"],
            "entity_key": item["entity_key"],
            "register_key": item["register_key"],
            "items": list_visual_evidence(item["entity_type"], item["entity_key"], connection),
        }
    finally:
        connection.close()


def migrate_legacy_paths(entity_type, entity_key, paths, register_key="", connection=None):
    """ينقل مسارات صور قديمة إلى الجدول الموحّد إن لم تكن موجودة."""
    paths = [str(item).strip() for item in (paths or []) if str(item or "").strip()]
    if not paths:
        return list_visual_evidence(entity_type, entity_key, connection)
    own = connection is None
    if own:
        connection = connect()
    try:
        ensure_visual_evidence_table(connection)
        current = list_visual_evidence(entity_type, entity_key, connection)
        existing = {item["url"] for item in current}
        now = stamp()
        changed = False
        for path in paths:
            if path in existing:
                continue
            kind = KIND_IMAGE
            if path.lower().endswith(".pdf"):
                kind = KIND_PDF
            elif path.lower().endswith((".mp4", ".webm")):
                kind = KIND_VIDEO
            connection.execute(
                """
                INSERT INTO visual_evidence (
                    entity_type, entity_key, register_key, kind, url, name, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entity_type,
                    entity_key,
                    register_key,
                    kind,
                    path,
                    Path(path).name,
                    now,
                ),
            )
            changed = True
        if changed:
            connection.commit()
        return list_visual_evidence(entity_type, entity_key, connection)
    finally:
        if own:
            connection.close()


def dump_media_summary(items):
    """ملخص للطباعة والواجهات."""
    return {
        "items": items or [],
        "images": [item for item in (items or []) if item.get("kind") == KIND_IMAGE],
        "videos": [item for item in (items or []) if item.get("kind") == KIND_VIDEO],
        "pdfs": [item for item in (items or []) if item.get("kind") == KIND_PDF],
        "links": [item for item in (items or []) if item.get("kind") == KIND_LINK],
        "limits": {
            "images": MAX_IMAGES,
            "videos": MAX_VIDEOS,
            "pdfs": MAX_PDFS,
            "links": MAX_LINKS,
        },
    }
