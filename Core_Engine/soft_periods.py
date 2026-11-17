# الطبقة 5 — الفترات اللاصفية: خطة زمنية يومية 60 دقيقة + متابعة أسبوعية.
# المبدأ: تعبئة تلقائية من القالب المعتمد، ثم Override دون إفراغ المصدر.

from __future__ import annotations

import json
import re
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

from .database import connect
from .noor_import import stamp
from .visual_evidence import (
    KIND_IMAGE,
    dump_media_summary,
    list_visual_evidence,
    migrate_legacy_paths,
    soft_entity_key,
)

SLOT_STATUSES = ("منفّذ", "جزئي", "لم يُنفّذ", "إجازة")
EVIDENCE_STATES = ("غير مطلوب", "ناقص", "مرفوع")
EVIDENCE_ROOT = Path(__file__).resolve().parent.parent / "School_Data" / "evidence"
ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_SOFT_IMAGES = 5

# كتلة يومية رسمية ≈ 60 دقيقة وفق دليل الخطط الدراسية.
DEFAULT_SLOTS = (
    {
        "slot_code": "lineup",
        "title": "الاصطفاف الصباحي",
        "minutes": 15,
        "time_hint": "قبل الحصة الأولى",
        "owner_role": "vice_students",
        "skill_focus": "الانضباط والانتماء والقيم الوطنية",
        "sort_order": 1,
    },
    {
        "slot_code": "break",
        "title": "الاستراحة",
        "minutes": 30,
        "time_hint": "بين الحصص / الفسحة",
        "owner_role": "activity_leader",
        "skill_focus": "المهارات الاجتماعية والسلامة المدرسية",
        "sort_order": 2,
    },
    {
        "slot_code": "prayer",
        "title": "الصلاة",
        "minutes": 15,
        "time_hint": "وقت صلاة الظهر المدرسي",
        "owner_role": "vice_students",
        "skill_focus": "العبادة والسلوك القيمي",
        "sort_order": 3,
    },
)

WEEKDAY_LABELS = {
    0: "الإثنين",
    1: "الثلاثاء",
    2: "الأربعاء",
    3: "الخميس",
    4: "الجمعة",
    5: "السبت",
    6: "الأحد",
}


def ensure_soft_periods_tables(connection=None):
    """ينشئ جداول الخطة والمتابعة إن لم تكن موجودة."""
    own = connection is None
    if own:
        connection = connect()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS soft_period_slots (
                id INTEGER PRIMARY KEY,
                slot_code TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                minutes INTEGER NOT NULL,
                time_hint TEXT,
                owner_role TEXT,
                skill_focus TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_auto INTEGER NOT NULL DEFAULT 1,
                is_overridden INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS soft_period_follow (
                id INTEGER PRIMARY KEY,
                week_start TEXT NOT NULL,
                day_iso TEXT NOT NULL,
                slot_code TEXT NOT NULL,
                status TEXT NOT NULL,
                note TEXT,
                evidence_status TEXT,
                evidence_note TEXT,
                evidence_images TEXT,
                is_auto INTEGER NOT NULL DEFAULT 1,
                is_overridden INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT,
                UNIQUE(day_iso, slot_code)
            )
            """
        )
        columns = {
            row[1]
            for row in connection.execute("PRAGMA table_info(soft_period_follow)").fetchall()
        }
        if "evidence_images" not in columns:
            connection.execute(
                "ALTER TABLE soft_period_follow ADD COLUMN evidence_images TEXT"
            )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_soft_follow_week
            ON soft_period_follow(week_start, day_iso)
            """
        )
        if own:
            connection.commit()
    finally:
        if own:
            connection.close()


def parse_evidence_images(raw):
    """يفك مصفوفة مسارات الصور المحفوظة دون اختراع قيم."""
    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item or "").strip()]
    text = str(raw or "").strip()
    if not text:
        return []
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    return [str(item).strip() for item in data if str(item or "").strip()]


def dump_evidence_images(paths):
    """يخزّن مسارات الصور كمصفوفة JSON."""
    clean = [str(item).strip() for item in (paths or []) if str(item or "").strip()]
    return json.dumps(clean, ensure_ascii=False)


def _slot_dict(row):
    keys = (
        "id",
        "slot_code",
        "title",
        "minutes",
        "time_hint",
        "owner_role",
        "skill_focus",
        "sort_order",
        "is_auto",
        "is_overridden",
        "updated_at",
    )
    item = {key: row[index] for index, key in enumerate(keys)}
    item["is_auto"] = bool(item["is_auto"])
    item["is_overridden"] = bool(item["is_overridden"])
    item["minutes"] = int(item["minutes"] or 0)
    item["sort_order"] = int(item["sort_order"] or 0)
    return item


def _follow_dict(row):
    keys = (
        "id",
        "week_start",
        "day_iso",
        "slot_code",
        "status",
        "note",
        "evidence_status",
        "evidence_note",
        "evidence_images",
        "is_auto",
        "is_overridden",
        "updated_at",
    )
    # يدعم الصفوف القديمة بلا عمود الصور عبر الطول.
    if len(row) < len(keys):
        keys = (
            "id",
            "week_start",
            "day_iso",
            "slot_code",
            "status",
            "note",
            "evidence_status",
            "evidence_note",
            "is_auto",
            "is_overridden",
            "updated_at",
        )
        item = {key: row[index] for index, key in enumerate(keys)}
        item["evidence_images"] = []
    else:
        item = {key: row[index] for index, key in enumerate(keys)}
        item["evidence_images"] = parse_evidence_images(item.get("evidence_images"))
    item["is_auto"] = bool(item["is_auto"])
    item["is_overridden"] = bool(item["is_overridden"])
    return item


def list_slots(connection=None):
    own = connection is None
    if own:
        connection = connect()
    try:
        ensure_soft_periods_tables(connection)
        rows = connection.execute(
            """
            SELECT id, slot_code, title, minutes, time_hint, owner_role, skill_focus,
                   sort_order, is_auto, is_overridden, updated_at
            FROM soft_period_slots
            ORDER BY sort_order, id
            """
        ).fetchall()
        return [_slot_dict(row) for row in rows]
    finally:
        if own:
            connection.close()


def seed_default_slots(connection=None, force=False):
    """يزرع الاصطفاف والاستراحة والصلاة إن خلت الخطة، دون مسح Override."""
    own = connection is None
    if own:
        connection = connect()
    try:
        ensure_soft_periods_tables(connection)
        count = connection.execute("SELECT COUNT(*) FROM soft_period_slots").fetchone()[0]
        if count and not force:
            return list_slots(connection)
        now = stamp()
        for item in DEFAULT_SLOTS:
            connection.execute(
                """
                INSERT OR IGNORE INTO soft_period_slots (
                    slot_code, title, minutes, time_hint, owner_role, skill_focus,
                    sort_order, is_auto, is_overridden, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
                """,
                (
                    item["slot_code"],
                    item["title"],
                    item["minutes"],
                    item["time_hint"],
                    item["owner_role"],
                    item["skill_focus"],
                    item["sort_order"],
                    now,
                ),
            )
        if own:
            connection.commit()
        return list_slots(connection)
    finally:
        if own:
            connection.close()


def save_slot(body):
    """يحفظ تعديلاً على فترة ضمن الخطة اليومية (Override)."""
    slot_code = str(getattr(body, "slot_code", "") or "").strip()
    if not slot_code:
        raise ValueError("رمز الفترة مطلوب.")
    title = str(getattr(body, "title", "") or "").strip()
    if not title:
        raise ValueError("عنوان الفترة مطلوب.")
    try:
        minutes = int(getattr(body, "minutes", 0) or 0)
    except (TypeError, ValueError) as error:
        raise ValueError("المدة بالدقائق رقم صحيح.") from error
    if minutes < 1 or minutes > 120:
        raise ValueError("المدة بين دقيقة واحدة و120.")
    connection = connect()
    try:
        ensure_soft_periods_tables(connection)
        seed_default_slots(connection)
        now = stamp()
        existing = connection.execute(
            "SELECT id FROM soft_period_slots WHERE slot_code = ?",
            (slot_code,),
        ).fetchone()
        values = (
            title,
            minutes,
            str(getattr(body, "time_hint", "") or "").strip(),
            str(getattr(body, "owner_role", "") or "").strip(),
            str(getattr(body, "skill_focus", "") or "").strip(),
            int(getattr(body, "sort_order", 0) or 0),
            now,
            slot_code,
        )
        if existing:
            connection.execute(
                """
                UPDATE soft_period_slots
                SET title = ?, minutes = ?, time_hint = ?, owner_role = ?,
                    skill_focus = ?, sort_order = ?, is_overridden = 1, updated_at = ?
                WHERE slot_code = ?
                """,
                values,
            )
        else:
            connection.execute(
                """
                INSERT INTO soft_period_slots (
                    slot_code, title, minutes, time_hint, owner_role, skill_focus,
                    sort_order, is_auto, is_overridden, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
                """,
                (
                    slot_code,
                    title,
                    minutes,
                    str(getattr(body, "time_hint", "") or "").strip(),
                    str(getattr(body, "owner_role", "") or "").strip(),
                    str(getattr(body, "skill_focus", "") or "").strip(),
                    int(getattr(body, "sort_order", 0) or 0),
                    0,
                    1,
                    now,
                ),
            )
        connection.commit()
        return plan_payload(connection)
    finally:
        connection.close()


def week_start_sunday(iso_text=""):
    """بداية الأسبوع من الأحد (التقويم المدرسي الشائع)."""
    text = str(iso_text or "").strip()
    if text:
        try:
            day = date.fromisoformat(text)
        except ValueError:
            day = date.today()
    else:
        day = date.today()
    # Python: Monday=0 ... Sunday=6 → rewind to Sunday
    rewind = (day.weekday() + 1) % 7
    return (day - timedelta(days=rewind)).isoformat()


def school_days_for_week(week_start):
    """أيام الدراسة من الأحد إلى الخميس."""
    start = date.fromisoformat(week_start)
    days = []
    for offset in range(5):
        day = start + timedelta(days=offset)
        days.append(
            {
                "day_iso": day.isoformat(),
                "weekday": WEEKDAY_LABELS[day.weekday()],
            }
        )
    return days


def autofill_week_follow(week_start="", connection=None):
    """يملأ صفوف المتابعة للأسبوع دون مسح الصفوف المعدَّلة."""
    own = connection is None
    if own:
        connection = connect()
    try:
        ensure_soft_periods_tables(connection)
        slots = seed_default_slots(connection)
        start = week_start_sunday(week_start)
        days = school_days_for_week(start)
        now = stamp()
        for day in days:
            for slot in slots:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO soft_period_follow (
                        week_start, day_iso, slot_code, status, note,
                        evidence_status, evidence_note, is_auto, is_overridden, updated_at
                    ) VALUES (?, ?, ?, 'لم يُنفّذ', '', 'ناقص', '', 1, 0, ?)
                    """,
                    (start, day["day_iso"], slot["slot_code"], now),
                )
        if own:
            connection.commit()
        return follow_payload(start, connection)
    finally:
        if own:
            connection.close()


def list_follow(week_start="", connection=None):
    own = connection is None
    if own:
        connection = connect()
    try:
        ensure_soft_periods_tables(connection)
        start = week_start_sunday(week_start)
        rows = connection.execute(
            """
            SELECT id, week_start, day_iso, slot_code, status, note,
                   evidence_status, evidence_note, evidence_images,
                   is_auto, is_overridden, updated_at
            FROM soft_period_follow
            WHERE week_start = ?
            ORDER BY day_iso, slot_code
            """,
            (start,),
        ).fetchall()
        return [_follow_dict(row) for row in rows]
    finally:
        if own:
            connection.close()


def _apply_follow_row(connection, day_iso, slot_code, status, evidence, note="", evidence_note=""):
    """يحدّث صفاً واحداً بعد التحقق."""
    try:
        date.fromisoformat(day_iso)
    except ValueError as error:
        raise ValueError("صيغة اليوم غير صحيحة.") from error
    if status not in SLOT_STATUSES:
        raise ValueError("حالة التنفيذ غير معتمدة.")
    if evidence not in EVIDENCE_STATES:
        raise ValueError("حالة الشاهد غير معتمدة.")
    week = week_start_sunday(day_iso)
    now = stamp()
    connection.execute(
        """
        UPDATE soft_period_follow
        SET status = ?, note = ?, evidence_status = ?, evidence_note = ?,
            is_overridden = 1, updated_at = ?, week_start = ?
        WHERE day_iso = ? AND slot_code = ?
        """,
        (status, note, evidence, evidence_note, now, week, day_iso, slot_code),
    )
    return week


def save_follow(body):
    """يحفظ حالة تنفيذ فترة في يوم محدد (Override)."""
    day_iso = str(getattr(body, "day_iso", "") or "").strip()
    slot_code = str(getattr(body, "slot_code", "") or "").strip()
    if not day_iso or not slot_code:
        raise ValueError("اليوم ورمز الفترة مطلوبان.")
    status = str(getattr(body, "status", "") or "").strip() or "لم يُنفّذ"
    evidence = str(getattr(body, "evidence_status", "") or "").strip() or "ناقص"
    connection = connect()
    try:
        ensure_soft_periods_tables(connection)
        seed_default_slots(connection)
        week = week_start_sunday(day_iso)
        autofill_week_follow(week, connection)
        _apply_follow_row(
            connection,
            day_iso,
            slot_code,
            status,
            evidence,
            str(getattr(body, "note", "") or "").strip(),
            str(getattr(body, "evidence_note", "") or "").strip(),
        )
        connection.commit()
        return follow_payload(week, connection)
    finally:
        connection.close()


def compose_soft_evidence(title, day_iso=""):
    """نص شاهد افتراضي من المحفوظ فقط؛ لا يُخترع محتوى خارج العنوان والتاريخ."""
    title = str(title or "").strip() or "الفترة اللاصفية"
    day = str(day_iso or "").strip()
    if day:
        return "بطاقة شاهد: " + title + " — " + day
    return "بطاقة شاهد: " + title


def _safe_soft_folder(day_iso, slot_code):
    """مجلد صور الشاهد داخل evidence/soft مع منع الخروج عن الجذر."""
    day = str(day_iso or "").strip()
    slot = re.sub(r"[^a-zA-Z0-9_-]+", "", str(slot_code or "").strip())
    date.fromisoformat(day)
    if not slot:
        raise ValueError("رمز الفترة غير صالح.")
    folder = (EVIDENCE_ROOT / "soft" / day / slot).resolve()
    root = EVIDENCE_ROOT.resolve()
    if root not in folder.parents and folder != root:
        raise ValueError("مسار الشاهد غير مسموح.")
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _public_evidence_path(path: Path):
    """مسار عام للعرض تحت /evidence/..."""
    root = EVIDENCE_ROOT.resolve()
    resolved = path.resolve()
    if root not in resolved.parents and resolved != root:
        raise ValueError("مسار الشاهد غير مسموح.")
    relative = resolved.relative_to(root).as_posix()
    return "/evidence/" + relative


def add_soft_evidence_images(day_iso, slot_code, uploads):
    """يرفع صوراً متعددة لفترة/يوم ويحفظ المسارات دون مسح السابق (Override).

    uploads: قائمة من dict بمفتاحي filename و content (bytes).
    """
    day_iso = str(day_iso or "").strip()
    slot_code = str(slot_code or "").strip()
    if not day_iso or not slot_code:
        raise ValueError("اليوم ورمز الفترة مطلوبان.")
    files = list(uploads or [])
    if not files:
        raise ValueError("اختر صورة واحدة على الأقل.")
    connection = connect()
    try:
        ensure_soft_periods_tables(connection)
        week = week_start_sunday(day_iso)
        autofill_week_follow(week, connection)
        row = connection.execute(
            """
            SELECT evidence_images FROM soft_period_follow
            WHERE day_iso = ? AND slot_code = ?
            """,
            (day_iso, slot_code),
        ).fetchone()
        current = parse_evidence_images(row[0] if row else "")
        if len(current) >= MAX_SOFT_IMAGES:
            raise ValueError("بلغ الحد الأقصى لصور الشاهد (" + str(MAX_SOFT_IMAGES) + ").")
        folder = _safe_soft_folder(day_iso, slot_code)
        added = []
        for upload in files:
            if len(current) + len(added) >= MAX_SOFT_IMAGES:
                break
            name = Path(str((upload or {}).get("filename") or "")).name
            ext = Path(name).suffix.lower() or ".jpg"
            if ext not in ALLOWED_IMAGE_EXT:
                raise ValueError("صيغة الصورة غير معتمدة: " + (ext or "بدون امتداد"))
            data = (upload or {}).get("content") or b""
            if not data:
                continue
            target = folder / (uuid.uuid4().hex + ext)
            target.write_bytes(data)
            added.append(_public_evidence_path(target))
        if not added:
            raise ValueError("تعذر حفظ الصور.")
        merged = current + added
        now = stamp()
        connection.execute(
            """
            UPDATE soft_period_follow
            SET evidence_images = ?, is_overridden = 1, updated_at = ?, week_start = ?
            WHERE day_iso = ? AND slot_code = ?
            """,
            (dump_evidence_images(merged), now, week, day_iso, slot_code),
        )
        connection.commit()
        return follow_payload(week, connection)
    finally:
        connection.close()


def remove_soft_evidence_image(day_iso, slot_code, image_path):
    """يحذف صورة شاهد واحدة من الصف والقرص إن كانت داخل evidence/soft."""
    day_iso = str(day_iso or "").strip()
    slot_code = str(slot_code or "").strip()
    image_path = str(image_path or "").strip()
    if not day_iso or not slot_code or not image_path:
        raise ValueError("اليوم والفترة ومسار الصورة مطلوبة.")
    connection = connect()
    try:
        ensure_soft_periods_tables(connection)
        week = week_start_sunday(day_iso)
        row = connection.execute(
            """
            SELECT evidence_images FROM soft_period_follow
            WHERE day_iso = ? AND slot_code = ?
            """,
            (day_iso, slot_code),
        ).fetchone()
        current = parse_evidence_images(row[0] if row else "")
        if image_path not in current:
            raise ValueError("الصورة غير مرتبطة بهذا الصف.")
        relative = image_path[len("/evidence/") :] if image_path.startswith("/evidence/") else image_path
        disk = (EVIDENCE_ROOT / relative).resolve()
        root = EVIDENCE_ROOT.resolve()
        if root in disk.parents and disk.is_file():
            disk.unlink()
        kept = [item for item in current if item != image_path]
        now = stamp()
        connection.execute(
            """
            UPDATE soft_period_follow
            SET evidence_images = ?, is_overridden = 1, updated_at = ?
            WHERE day_iso = ? AND slot_code = ?
            """,
            (dump_evidence_images(kept), now, day_iso, slot_code),
        )
        connection.commit()
        return follow_payload(week, connection)
    finally:
        connection.close()


def save_follow_bulk(body):
    """يملأ عدة صفوف أو أسبوعاً كاملاً بنفس الحالة والشاهد ثم يسمح بالتعديل الفردي."""
    status = str(getattr(body, "status", "") or "").strip() or "منفّذ"
    evidence = str(getattr(body, "evidence_status", "") or "").strip() or "غير مطلوب"
    week = week_start_sunday(str(getattr(body, "week_start", "") or "").strip())
    only_day = str(getattr(body, "day_iso", "") or "").strip()
    rows = getattr(body, "rows", None)
    connection = connect()
    try:
        ensure_soft_periods_tables(connection)
        slots = {item["slot_code"]: item for item in seed_default_slots(connection)}
        autofill_week_follow(week, connection)

        def note_for(item, evidence_status, evidence_note):
            text = str(evidence_note or "").strip()
            if text:
                return text
            if evidence_status != "مرفوع":
                return ""
            title = (slots.get(item.get("slot_code") or "") or {}).get("title") or item.get("title") or ""
            return compose_soft_evidence(title, item.get("day_iso") or "")

        if isinstance(rows, list) and rows:
            for item in rows:
                day_iso = str((item or {}).get("day_iso") or "").strip()
                slot_code = str((item or {}).get("slot_code") or "").strip()
                if not day_iso or not slot_code:
                    continue
                row_evidence = str((item or {}).get("evidence_status") or evidence)
                _apply_follow_row(
                    connection,
                    day_iso,
                    slot_code,
                    str((item or {}).get("status") or status),
                    row_evidence,
                    str((item or {}).get("note") or "").strip(),
                    note_for(item or {}, row_evidence, (item or {}).get("evidence_note")),
                )
        else:
            current = list_follow(week, connection)
            for item in current:
                if only_day and item["day_iso"] != only_day:
                    continue
                _apply_follow_row(
                    connection,
                    item["day_iso"],
                    item["slot_code"],
                    status,
                    evidence,
                    item.get("note") or "",
                    note_for(item, evidence, item.get("evidence_note")),
                )
        connection.commit()
        return follow_payload(week, connection)
    finally:
        connection.close()


def plan_payload(connection=None):
    slots = seed_default_slots(connection)
    total = sum(item["minutes"] for item in slots)
    return {
        "slots": slots,
        "total_minutes": total,
        "target_minutes": 60,
        "balanced": total == 60,
        "hint": "دليل الخطط الدراسية يشترط تخصيص نحو 60 دقيقة يومياً للفترات اللاصفية.",
    }


def follow_payload(week_start="", connection=None):
    start = week_start_sunday(week_start)
    slots = seed_default_slots(connection)
    rows = list_follow(start, connection)
    if not rows:
        return autofill_week_follow(start, connection)
    days = school_days_for_week(start)
    by_key = {(item["day_iso"], item["slot_code"]): item for item in rows}
    grid = []
    for day in days:
        for slot in slots:
            item = by_key.get((day["day_iso"], slot["slot_code"]))
            key = soft_entity_key(day["day_iso"], slot["slot_code"])
            legacy = item["evidence_images"] if item else []
            media_items = list_visual_evidence("soft_period", key, connection)
            if legacy:
                if not media_items:
                    media_items = migrate_legacy_paths(
                        "soft_period",
                        key,
                        legacy,
                        register_key="soft-periods",
                        connection=connection,
                    )
                # visual_evidence هو المصدر؛ تفريغ العمود القديم يمنع إعادة إحياء المحذوف
                own_clear = connection is None
                clear_conn = connection or connect()
                try:
                    clear_conn.execute(
                        """
                        UPDATE soft_period_follow
                        SET evidence_images = NULL
                        WHERE day_iso = ? AND slot_code = ?
                        """,
                        (day["day_iso"], slot["slot_code"]),
                    )
                    if own_clear:
                        clear_conn.commit()
                finally:
                    if own_clear:
                        clear_conn.close()
            summary = dump_media_summary(media_items)
            image_urls = [entry["url"] for entry in summary["images"]]
            grid.append(
                {
                    "day_iso": day["day_iso"],
                    "weekday": day["weekday"],
                    "slot_code": slot["slot_code"],
                    "title": slot["title"],
                    "minutes": slot["minutes"],
                    "status": item["status"] if item else "لم يُنفّذ",
                    "note": item["note"] if item else "",
                    "evidence_status": item["evidence_status"] if item else "ناقص",
                    "evidence_note": item["evidence_note"] if item else "",
                    "evidence_images": image_urls,
                    "evidence_media": summary,
                    "entity_type": "soft_period",
                    "entity_key": key,
                    "register_key": "soft-periods",
                    "is_overridden": bool(item["is_overridden"]) if item else False,
                    "id": item["id"] if item else 0,
                }
            )
    done = sum(1 for item in grid if item["status"] in ("منفّذ", "إجازة"))
    return {
        "week_start": start,
        "days": days,
        "slots": slots,
        "rows": grid,
        "stats": {
            "total": len(grid),
            "done": done,
            "pending": len(grid) - done,
            "missing_evidence": sum(1 for item in grid if item["evidence_status"] == "ناقص" and item["status"] == "منفّذ"),
        },
    }


def dashboard_bundle(week_start=""):
    """حمولة الشاشة: الخطة اليومية + متابعة الأسبوع."""
    connection = connect()
    try:
        plan = plan_payload(connection)
        follow = follow_payload(week_start, connection)
        return {
            "plan": plan,
            "follow": follow,
            "generated_at": datetime.now().isoformat(timespec="seconds"),
        }
    finally:
        connection.close()
