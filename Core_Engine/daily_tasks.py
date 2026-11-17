# لوحة المهام اليومية: تعبئة تلقائية من المحفوظ، ثم صلاحية التعديل دون إفراغ المصدر.

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta

from .database import connect
from .noor_import import stamp

STATUSES = ("مستحقة", "قيد التنفيذ", "مكتملة", "ملغاة")
PRIORITIES = ("عاجل", "عادي", "منخفض")
EVIDENCE_STATES = ("غير مطلوب", "ناقص", "مرفوع")
SOURCE_TYPES = (
    "standing",
    "improvement",
    "program",
    "occasion",
    "follow",
    "manual",
)

_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DMY = re.compile(r"^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})")


def ensure_daily_tasks_table(connection=None):
    """ينشئ جدول daily_tasks إن لم يكن موجوداً."""
    own = connection is None
    if own:
        connection = connect()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_tasks (
                id INTEGER PRIMARY KEY,
                task_date TEXT NOT NULL,
                hijri_date TEXT,
                title TEXT NOT NULL,
                description TEXT,
                source_type TEXT NOT NULL,
                source_ref TEXT NOT NULL,
                owner_role TEXT,
                status TEXT NOT NULL,
                priority TEXT,
                evidence_status TEXT,
                evidence_note TEXT,
                is_auto INTEGER NOT NULL DEFAULT 1,
                is_overridden INTEGER NOT NULL DEFAULT 0,
                due_iso TEXT,
                completed_at TEXT,
                created_at TEXT,
                updated_at TEXT
            )
            """
        )
        connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_tasks_source
            ON daily_tasks(source_ref)
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_daily_tasks_date
            ON daily_tasks(task_date, status)
            """
        )
        if own:
            connection.commit()
    finally:
        if own:
            connection.close()


def iso_from_text(value):
    """يحيل نصاً ميلادياً محفوظاً إلى YYYY-MM-DD دون اختراع تاريخ."""
    text = str(value or "").strip().replace("م", "").replace("هـ", "").strip()
    if not text:
        return ""
    if _ISO.match(text):
        return text
    match = _DMY.match(text)
    if not match:
        return ""
    day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return ""


def today_iso():
    return date.today().isoformat()


def _row_dict(row):
    keys = (
        "id",
        "task_date",
        "hijri_date",
        "title",
        "description",
        "source_type",
        "source_ref",
        "owner_role",
        "status",
        "priority",
        "evidence_status",
        "evidence_note",
        "is_auto",
        "is_overridden",
        "due_iso",
        "completed_at",
        "created_at",
        "updated_at",
    )
    item = {key: row[index] for index, key in enumerate(keys)}
    item["is_auto"] = bool(item["is_auto"])
    item["is_overridden"] = bool(item["is_overridden"])
    for key in keys:
        if key in {"id", "is_auto", "is_overridden"}:
            continue
        item[key] = str(item[key] or "").strip()
    due = item["due_iso"] or item["task_date"]
    if item["status"] not in {"مكتملة", "ملغاة"} and due and due < today_iso():
        item["bucket"] = "متأخرة"
    elif due == today_iso() or item["task_date"] == today_iso():
        item["bucket"] = "اليوم"
    elif item["evidence_status"] == "ناقص":
        item["bucket"] = "شواهد ناقصة"
    else:
        item["bucket"] = "قادمة"
    return item


def _upsert_auto(connection, payload):
    """يدرج أو يحدّث مهمة تلقائية ما لم يُلغَ التعبئة بتعديل المستخدم."""
    source_ref = str(payload["source_ref"]).strip()
    existing = connection.execute(
        "SELECT id, is_overridden, status FROM daily_tasks WHERE source_ref = ?",
        (source_ref,),
    ).fetchone()
    moment = stamp()
    if existing and int(existing[1] or 0) == 1:
        return existing[0]
    values = (
        payload.get("task_date") or today_iso(),
        payload.get("hijri_date") or "",
        payload["title"].strip(),
        str(payload.get("description") or "").strip(),
        payload["source_type"],
        source_ref,
        str(payload.get("owner_role") or "").strip(),
        payload.get("status") or "مستحقة",
        payload.get("priority") or "عادي",
        payload.get("evidence_status") or "غير مطلوب",
        str(payload.get("evidence_note") or "").strip(),
        1,
        0,
        payload.get("due_iso") or payload.get("task_date") or today_iso(),
        "",
        moment,
        moment,
    )
    if existing:
        # لا نُسقط حالة أنجزها المستخدم على مهمة غير معلَّمة override إن بقيت مستحقة فقط
        status = values[7]
        if str(existing[2] or "") in {"مكتملة", "ملغاة", "قيد التنفيذ"} and status == "مستحقة":
            status = str(existing[2])
        connection.execute(
            """
            UPDATE daily_tasks
            SET task_date = ?, hijri_date = ?, title = ?, description = ?, source_type = ?,
                owner_role = ?, status = ?, priority = ?, evidence_status = ?, evidence_note = ?,
                is_auto = 1, due_iso = ?, updated_at = ?
            WHERE source_ref = ? AND is_overridden = 0
            """,
            (
                values[0],
                values[1],
                values[2],
                values[3],
                values[4],
                values[6],
                status,
                values[8],
                values[9],
                values[10],
                values[13],
                moment,
                source_ref,
            ),
        )
        return existing[0]
    connection.execute(
        """
        INSERT INTO daily_tasks (
            task_date, hijri_date, title, description, source_type, source_ref, owner_role,
            status, priority, evidence_status, evidence_note, is_auto, is_overridden,
            due_iso, completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        values,
    )
    return connection.execute("SELECT last_insert_rowid()").fetchone()[0]


def _standing_seeds(day):
    return [
        {
            "task_date": day,
            "title": "اعتماد سجل غياب وتأخر اليوم",
            "description": "يُملأ من سجل الغياب المعتمد لليوم الدراسي الجاري.",
            "source_type": "standing",
            "source_ref": f"standing:absence:{day}",
            "owner_role": "vice_students",
            "priority": "عاجل",
            "evidence_status": "ناقص",
            "evidence_note": "شاهد: اعتماد سجل الغياب",
            "due_iso": day,
        },
        {
            "task_date": day,
            "title": "مراجعة مهام اليوم في الخطة التشغيلية",
            "description": "تُستمد البنود من خطة المدير والبرامج المعتمدة.",
            "source_type": "standing",
            "source_ref": f"standing:plan-review:{day}",
            "owner_role": "principal",
            "priority": "عادي",
            "evidence_status": "غير مطلوب",
            "due_iso": day,
        },
        {
            "task_date": day,
            "title": "متابعة شواهد البرامج قيد التنفيذ",
            "description": "كل برنامج معتمد بلا شاهد مكتمل يظهر هنا تلقائياً.",
            "source_type": "standing",
            "source_ref": f"standing:program-evidence:{day}",
            "owner_role": "vice_teachers",
            "priority": "عادي",
            "evidence_status": "ناقص",
            "due_iso": day,
        },
    ]


def _improvement_candidates(connection, day):
    rows = connection.execute(
        """
        SELECT id, title, owner_role, owner_label, evidence, status, progress_percentage,
               end_gregorian, follow_gregorian, follow_note
        FROM improvement_actions
        ORDER BY sort_order, id
        """
    ).fetchall()
    items = []
    for row in rows:
        action_id = row[0]
        title = str(row[1] or "").strip() or f"إجراء تحسين {action_id}"
        owner = str(row[2] or "").strip()
        evidence = str(row[4] or "").strip()
        status = str(row[5] or "").strip()
        end_iso = iso_from_text(row[7])
        follow_iso = iso_from_text(row[8])
        due = follow_iso or end_iso
        if not due:
            continue
        # نافذة العرض: المتأخرة + اليوم + سبعة أيام قادمة
        if due > (date.fromisoformat(day) + timedelta(days=7)).isoformat():
            continue
        evidence_status = "مرفوع" if evidence else "ناقص"
        if status in {"مكتمل", "مكتملة"} and evidence:
            evidence_status = "مرفوع"
            task_status = "مكتملة"
        else:
            task_status = "مستحقة"
        items.append(
            {
                "task_date": due if due >= day else day,
                "title": "متابعة تحسين: " + title,
                "description": str(row[9] or "").strip()
                or ("المالك: " + (str(row[3] or "").strip() or owner or "غير محدد")),
                "source_type": "improvement",
                "source_ref": f"improvement:{action_id}:follow",
                "owner_role": owner,
                "status": task_status,
                "priority": "عاجل" if due <= day else "عادي",
                "evidence_status": evidence_status,
                "evidence_note": evidence[:240],
                "due_iso": due,
            }
        )
    return items


def _program_candidates(connection, day):
    rows = connection.execute(
        """
        SELECT id, program_name, status, owner_role, success_indicator, kpi_description
        FROM school_programs
        WHERE status IN ('معتمد', 'قيد التنفيذ')
        ORDER BY id
        """
    ).fetchall()
    items = []
    for row in rows:
        program_id = row[0]
        name = str(row[1] or "").strip() or f"برنامج {program_id}"
        status = str(row[2] or "").strip()
        items.append(
            {
                "task_date": day,
                "title": "تنفيذ/متابعة برنامج: " + name,
                "description": str(row[4] or row[5] or "").strip() or f"حالة البرنامج: {status}",
                "source_type": "program",
                "source_ref": f"program:{program_id}:daily",
                "owner_role": str(row[3] or "").strip(),
                "status": "قيد التنفيذ" if status == "قيد التنفيذ" else "مستحقة",
                "priority": "عادي",
                "evidence_status": "ناقص",
                "evidence_note": "شاهد تنفيذ البرنامج",
                "due_iso": day,
            }
        )
    return items


def autofill_daily_tasks(day=None, local_follows=None):
    """يولّد المهام من المصادر المحفوظة دون مسح تعديلات المستخدم."""
    ensure_daily_tasks_table()
    day = iso_from_text(day) or today_iso()
    connection = connect()
    try:
        for seed in _standing_seeds(day):
            _upsert_auto(connection, seed)
        for item in _improvement_candidates(connection, day):
            _upsert_auto(connection, item)
        for item in _program_candidates(connection, day):
            _upsert_auto(connection, item)
        for index, follow in enumerate(local_follows or []):
            if not isinstance(follow, dict):
                continue
            due = iso_from_text(follow.get("iso") or follow.get("due_iso") or follow.get("gregorian"))
            if not due:
                continue
            if due > (date.fromisoformat(day) + timedelta(days=7)).isoformat():
                continue
            kind = str(follow.get("kind") or "متابعة").strip() or "متابعة"
            title = str(follow.get("title") or "").strip() or kind
            ref = str(follow.get("source_ref") or "").strip() or f"follow:{kind}:{due}:{index}"
            _upsert_auto(
                connection,
                {
                    "task_date": due if due >= day else day,
                    "hijri_date": str(follow.get("hijri") or "").strip(),
                    "title": f"{kind}: {title}",
                    "description": str(follow.get("description") or "").strip(),
                    "source_type": "follow",
                    "source_ref": ref,
                    "owner_role": str(follow.get("owner_role") or "").strip(),
                    "priority": "عاجل" if due <= day else "عادي",
                    "evidence_status": "ناقص",
                    "due_iso": due,
                },
            )
        connection.commit()
    finally:
        connection.close()
    return dashboard_payload(day)


def _plan_progress(connection):
    programs = connection.execute(
        """
        SELECT status FROM school_programs
        """
    ).fetchall()
    total = len(programs)
    approved = sum(1 for row in programs if str(row[0] or "") in {"معتمد", "قيد التنفيذ", "مكتمل"})
    actions = connection.execute(
        """
        SELECT progress_percentage, status FROM improvement_actions
        """
    ).fetchall()
    percents = []
    for row in actions:
        raw = str(row[0] or "").replace("%", "").strip()
        if raw:
            try:
                percents.append(max(0.0, min(100.0, float(raw))))
                continue
            except ValueError:
                pass
        if str(row[1] or "") in {"مكتمل", "مكتملة"}:
            percents.append(100.0)
    improvement_avg = round(sum(percents) / len(percents), 1) if percents else None
    program_pct = round((approved / total) * 100, 1) if total else None
    pieces = [value for value in (program_pct, improvement_avg) if value is not None]
    overall = round(sum(pieces) / len(pieces), 1) if pieces else None
    return {
        "programs_total": total,
        "programs_active": approved,
        "programs_percent": program_pct,
        "improvement_percent": improvement_avg,
        "plan_percent": overall,
    }


def list_tasks(day=None, owner_role=""):
    ensure_daily_tasks_table()
    day = iso_from_text(day) or today_iso()
    connection = connect()
    try:
        rows = connection.execute(
            """
            SELECT id, task_date, hijri_date, title, description, source_type, source_ref, owner_role,
                   status, priority, evidence_status, evidence_note, is_auto, is_overridden,
                   due_iso, completed_at, created_at, updated_at
            FROM daily_tasks
            WHERE task_date = ?
               OR due_iso = ?
               OR (due_iso < ? AND status NOT IN ('مكتملة', 'ملغاة'))
               OR (due_iso BETWEEN ? AND ?)
            ORDER BY
                CASE WHEN due_iso < ? AND status NOT IN ('مكتملة', 'ملغاة') THEN 0 ELSE 1 END,
                due_iso, id
            """,
            (
                day,
                day,
                day,
                day,
                (date.fromisoformat(day) + timedelta(days=7)).isoformat(),
                day,
            ),
        ).fetchall()
    finally:
        connection.close()
    role = str(owner_role or "").strip()
    items = [_row_dict(row) for row in rows]
    if role and role not in {"principal", "system", "مسؤول النظام والقيادة الشاملة"}:
        items = [item for item in items if not item["owner_role"] or item["owner_role"] == role]
    return items


def dashboard_payload(day=None, owner_role=""):
    day = iso_from_text(day) or today_iso()
    tasks = list_tasks(day, owner_role)
    today_tasks = [item for item in tasks if item["bucket"] == "اليوم"]
    overdue = [item for item in tasks if item["bucket"] == "متأخرة"]
    missing = [item for item in tasks if item["evidence_status"] == "ناقص" and item["status"] != "ملغاة"]
    connection = connect()
    try:
        progress = _plan_progress(connection)
    finally:
        connection.close()
    alerts = []
    if overdue:
        alerts.append(f"لديك {len(overdue)} مهمة متأخرة تحتاج قراراً اليوم.")
    if missing:
        alerts.append(f"{len(missing)} إجراء بلا شاهد مكتمل.")
    if progress["plan_percent"] is not None and progress["plan_percent"] < 70:
        alerts.append("نسبة إنجاز الخطة دون 70٪ — راجع البرامج وإجراءات التحسين.")
    if not alerts:
        alerts.append("لا تنبيهات حرجة: تابع مهام اليوم المعبأة تلقائياً.")
    return {
        "date": day,
        "principle": "تعبئة تلقائية من المحفوظ ثم صلاحية التعديل",
        "tasks": tasks,
        "today": today_tasks,
        "overdue": overdue,
        "missing_evidence": missing,
        "progress": progress,
        "alerts": alerts,
        "counts": {
            "today": len(today_tasks),
            "overdue": len(overdue),
            "missing_evidence": len(missing),
            "all": len(tasks),
        },
    }


def save_task(body):
    """إنشاء يدوي أو تعديل مع تعليم override إن مُسّت مهمة تلقائية."""
    ensure_daily_tasks_table()
    title = str(getattr(body, "title", "") or "").strip()
    if not title:
        raise ValueError("عنوان المهمة مطلوب")
    status = str(getattr(body, "status", "") or "مستحقة").strip() or "مستحقة"
    if status not in STATUSES:
        raise ValueError("حالة المهمة غير معروفة")
    priority = str(getattr(body, "priority", "") or "عادي").strip() or "عادي"
    if priority not in PRIORITIES:
        raise ValueError("أولوية المهمة غير معروفة")
    evidence_status = str(getattr(body, "evidence_status", "") or "غير مطلوب").strip() or "غير مطلوب"
    if evidence_status not in EVIDENCE_STATES:
        raise ValueError("حالة الشاهد غير معروفة")
    task_date = iso_from_text(getattr(body, "task_date", "")) or today_iso()
    due_iso = iso_from_text(getattr(body, "due_iso", "")) or task_date
    moment = stamp()
    completed_at = moment if status == "مكتملة" else ""
    connection = connect()
    try:
        task_id = int(getattr(body, "id", 0) or 0)
        if task_id:
            current = connection.execute(
                "SELECT is_auto FROM daily_tasks WHERE id = ?",
                (task_id,),
            ).fetchone()
            if not current:
                raise ValueError("المهمة غير موجودة")
            overridden = 1 if int(current[0] or 0) == 1 else int(bool(getattr(body, "is_overridden", False)))
            connection.execute(
                """
                UPDATE daily_tasks
                SET task_date = ?, hijri_date = ?, title = ?, description = ?, owner_role = ?,
                    status = ?, priority = ?, evidence_status = ?, evidence_note = ?,
                    is_overridden = ?, due_iso = ?, completed_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    task_date,
                    str(getattr(body, "hijri_date", "") or "").strip(),
                    title,
                    str(getattr(body, "description", "") or "").strip(),
                    str(getattr(body, "owner_role", "") or "").strip(),
                    status,
                    priority,
                    evidence_status,
                    str(getattr(body, "evidence_note", "") or "").strip(),
                    overridden,
                    due_iso,
                    completed_at,
                    moment,
                    task_id,
                ),
            )
        else:
            source_ref = str(getattr(body, "source_ref", "") or "").strip() or f"manual:{moment}:{title[:24]}"
            connection.execute(
                """
                INSERT INTO daily_tasks (
                    task_date, hijri_date, title, description, source_type, source_ref, owner_role,
                    status, priority, evidence_status, evidence_note, is_auto, is_overridden,
                    due_iso, completed_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?)
                """,
                (
                    task_date,
                    str(getattr(body, "hijri_date", "") or "").strip(),
                    title,
                    str(getattr(body, "description", "") or "").strip(),
                    source_ref,
                    str(getattr(body, "owner_role", "") or "").strip(),
                    status,
                    priority,
                    evidence_status,
                    str(getattr(body, "evidence_note", "") or "").strip(),
                    due_iso,
                    completed_at,
                    moment,
                    moment,
                ),
            )
        connection.commit()
    finally:
        connection.close()
    return dashboard_payload(task_date, str(getattr(body, "filter_role", "") or ""))
