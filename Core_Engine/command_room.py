# غرفة القيادة الذكية — إشارات وقواعد وتوصيات قابلة للتنفيذ (المرحلة 1)

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from .database import connect
from .visual_evidence import ensure_visual_evidence_table


SIGNAL_TYPES = (
    "تأخر مهمة",
    "شاهد ناقص",
    "فترة بلا مرفق",
    "مؤشر دون عتبة",
)

SEVERITIES = ("عالية", "متوسطة", "منخفضة")
ACTIONS = ("accept", "defer", "dismiss")

DEFAULT_RULES = (
    {
        "code": "task_overdue",
        "condition": "مهمة يومية متأخرة عن تاريخ الاستحقاق وغير مكتملة",
        "severity": "عالية",
        "recommendation": "راجع المهمة المتأخرة وأنهِها أو أعد جدولتها اليوم.",
        "action": "board:tasks-today",
        "role_scope": "all",
        "signal_type": "تأخر مهمة",
        "action_label": "فتح لوحة المهام",
    },
    {
        "code": "task_evidence_missing",
        "condition": "مهمة مستحقة أو قيد التنفيذ وشاهدها ناقص",
        "severity": "متوسطة",
        "recommendation": "ارفع شاهد المهمة أو وثّق المرفق قبل إغلاقها.",
        "action": "board:tasks-today",
        "role_scope": "all",
        "signal_type": "شاهد ناقص",
        "action_label": "استكمال الشاهد",
    },
    {
        "code": "soft_no_media",
        "condition": "فترة لاصفية منفّذة بلا مرفق بصري",
        "severity": "عالية",
        "recommendation": "أرفق صورة/ملفًا أو اطبع بطاقة الشاهد للفترة المنفّذة.",
        "action": "board:soft-periods",
        "role_scope": "all",
        "signal_type": "فترة بلا مرفق",
        "action_label": "فتح متابعة اللاصفية",
    },
    {
        "code": "soft_today_pending",
        "condition": "فترة لاصفية لليوم بلا حالة تنفيذ",
        "severity": "متوسطة",
        "recommendation": "حدّث حالة تنفيذ فترات اليوم (اصطفاف/استراحة/صلاة).",
        "action": "board:soft-periods",
        "role_scope": "all",
        "signal_type": "فترة بلا مرفق",
        "action_label": "تعبئة متابعة اليوم",
    },
    {
        "code": "indicator_below",
        "condition": "مؤشر اعتماد بدرجة دون عتبة 60",
        "severity": "عالية",
        "recommendation": "راجع المؤشر الضعيف واربطه ببرنامج أو إجراء تحسين.",
        "action": "board:indicators",
        "role_scope": "principal,vice_teachers",
        "signal_type": "مؤشر دون عتبة",
        "action_label": "فتح إطار المؤشرات",
    },
    {
        "code": "improvement_stalled",
        "condition": "إجراء تحسين متعثر أو بلا تقدّم",
        "severity": "متوسطة",
        "recommendation": "افتح الإجراء المتعثر وحدّث نسبة الإنجاز أو الشاهد.",
        "action": "board:improvement",
        "role_scope": "all",
        "signal_type": "تأخر مهمة",
        "action_label": "فتح إجراءات التحسين",
    },
    {
        "code": "program_no_progress",
        "condition": "برنامج معتمد بلا قراءة حالية للمؤشر",
        "severity": "منخفضة",
        "recommendation": "حدّث القراءة الحالية لمؤشر البرنامج المعتمد.",
        "action": "board:programs",
        "role_scope": "all",
        "signal_type": "مؤشر دون عتبة",
        "action_label": "فتح البرامج",
    },
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return date.today().isoformat()


def ensure_command_room_tables(connection=None):
    owns = connection is None
    if owns:
        connection = connect()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                condition_text TEXT NOT NULL,
                severity TEXT NOT NULL,
                recommendation TEXT NOT NULL,
                action TEXT NOT NULL,
                role_scope TEXT NOT NULL DEFAULT 'all',
                signal_type TEXT NOT NULL,
                action_label TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS signals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                signal_type TEXT NOT NULL,
                entity_id TEXT,
                entity_type TEXT,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                action_label TEXT,
                action_url TEXT,
                rule_code TEXT,
                fingerprint TEXT NOT NULL UNIQUE,
                signal_day TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS signal_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                signal_id INTEGER,
                fingerprint TEXT NOT NULL,
                action TEXT NOT NULL,
                defer_until TEXT,
                note TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_signals_day ON signals(signal_day, severity)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_signal_actions_fp ON signal_actions(fingerprint, created_at)"
        )
        if owns:
            connection.commit()
    finally:
        if owns:
            connection.close()


def seed_default_rules(connection=None):
    owns = connection is None
    if owns:
        connection = connect()
    try:
        ensure_command_room_tables(connection)
        moment = _now()
        for rule in DEFAULT_RULES:
            connection.execute(
                """
                INSERT OR IGNORE INTO rules (
                    code, condition_text, severity, recommendation, action, role_scope,
                    signal_type, action_label, is_active, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                """,
                (
                    rule["code"],
                    rule["condition"],
                    rule["severity"],
                    rule["recommendation"],
                    rule["action"],
                    rule["role_scope"],
                    rule["signal_type"],
                    rule["action_label"],
                    moment,
                ),
            )
        if owns:
            connection.commit()
    finally:
        if owns:
            connection.close()


def _rule_map(connection) -> dict[str, dict]:
    rows = connection.execute(
        """
        SELECT code, condition_text, severity, recommendation, action, role_scope,
               signal_type, action_label, is_active
        FROM rules WHERE is_active = 1
        """
    ).fetchall()
    out = {}
    for row in rows:
        out[str(row[0])] = {
            "code": row[0],
            "condition": row[1],
            "severity": row[2],
            "recommendation": row[3],
            "action": row[4],
            "role_scope": row[5],
            "signal_type": row[6],
            "action_label": row[7] or "فتح",
        }
    # إن خلت القاعدة من البذرة نُرجع الافتراضي
    if not out:
        for rule in DEFAULT_RULES:
            out[rule["code"]] = rule
    return out


def _stable_fingerprint(rule_code: str, entity_type: str, entity_id: str) -> str:
    """بصمة الكيان بلا يوم التقويم حتى يبقى التأجيل/القبول عبر الأيام."""
    return f"{rule_code}:{entity_type}:{entity_id}"


def _normalize_fingerprint(value: str) -> str:
    """يزيل لاحقة :YYYY-MM-DD إن وُجدت من بصمات المرحلة الأولى."""
    text = str(value or "").strip()
    if len(text) >= 11 and text[-11] == ":" and text[-10:].replace("-", "").isdigit():
        # شكل ...:2026-10-31
        try:
            date.fromisoformat(text[-10:])
            return text[:-11]
        except ValueError:
            return text
    return text


def _migrate_action_fingerprints(connection) -> None:
    rows = connection.execute("SELECT id, fingerprint FROM signal_actions").fetchall()
    for row in rows:
        old = str(row[1] or "")
        new = _normalize_fingerprint(old)
        if new != old:
            connection.execute(
                "UPDATE signal_actions SET fingerprint = ? WHERE id = ?",
                (new, row[0]),
            )


def _suppressed(connection, fingerprint: str, day: str) -> bool:
    """يخفي المقبول/المتجاهل دائمًا، والمؤجّل فقط إلى أن يحين defer_until."""
    fp = _normalize_fingerprint(fingerprint)
    row = connection.execute(
        """
        SELECT action, defer_until FROM signal_actions
        WHERE fingerprint = ? OR fingerprint = ?
        ORDER BY id DESC LIMIT 1
        """,
        (fp, fingerprint),
    ).fetchone()
    if not row:
        return False
    action = str(row[0] or "")
    if action in {"dismiss", "accept"}:
        return True
    if action == "defer":
        until = str(row[1] or "").strip()
        if not until:
            until = (date.fromisoformat(day) + timedelta(days=1)).isoformat()
        # مؤجّل ليوم لاحق → أخفِه؛ إذا حان الموعد (until <= day) أعد العرض
        return until > day
    return False


def _upsert_signal(connection, payload: dict):
    fingerprint = _normalize_fingerprint(payload["fingerprint"])
    day = payload["signal_day"]
    if _suppressed(connection, fingerprint, day):
        return
    connection.execute(
        """
        INSERT INTO signals (
            signal_type, entity_id, entity_type, severity, message,
            action_label, action_url, rule_code, fingerprint, signal_day, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(fingerprint) DO UPDATE SET
            signal_type = excluded.signal_type,
            entity_id = excluded.entity_id,
            entity_type = excluded.entity_type,
            severity = excluded.severity,
            message = excluded.message,
            action_label = excluded.action_label,
            action_url = excluded.action_url,
            rule_code = excluded.rule_code,
            signal_day = excluded.signal_day,
            created_at = excluded.created_at
        """,
        (
            payload["signal_type"],
            payload.get("entity_id") or "",
            payload.get("entity_type") or "",
            payload["severity"],
            payload["message"],
            payload.get("action_label") or "",
            payload.get("action_url") or "",
            payload.get("rule_code") or "",
            fingerprint,
            day,
            _now(),
        ),
    )


def _collect_candidates(connection, day: str, rules: dict[str, dict]) -> list[dict]:
    found: list[dict] = []

    def add(rule_code: str, entity_type: str, entity_id: str, message: str):
        rule = rules.get(rule_code)
        if not rule:
            return
        fingerprint = _stable_fingerprint(rule_code, entity_type, str(entity_id))
        found.append(
            {
                "signal_type": rule["signal_type"],
                "entity_id": str(entity_id),
                "entity_type": entity_type,
                "severity": rule["severity"],
                "message": message,
                "action_label": rule["action_label"],
                "action_url": rule["action"],
                "rule_code": rule_code,
                "fingerprint": fingerprint,
                "signal_day": day,
                "why": rule["condition"],
                "recommendation": rule["recommendation"],
            }
        )

    # 1–2 مهام
    task_rows = connection.execute(
        """
        SELECT id, title, status, evidence_status, due_iso, task_date
        FROM daily_tasks
        WHERE status NOT IN ('مكتملة', 'ملغاة')
        ORDER BY due_iso, id
        LIMIT 40
        """
    ).fetchall()
    for row in task_rows:
        tid, title, status, evidence_status, due_iso, task_date = row
        due = str(due_iso or task_date or "")
        title = str(title or "مهمة")
        if due and due < day:
            add("task_overdue", "daily_task", tid, f"مهمة متأخرة: {title} (استحقاق {due})")
        if str(evidence_status or "") == "ناقص" and str(status or "") in {"مستحقة", "قيد التنفيذ", ""}:
            add("task_evidence_missing", "daily_task", tid, f"شاهد ناقص للمهمة: {title}")

    # 3–4 فترات لاصفية
    soft_rows = connection.execute(
        """
        SELECT id, day_iso, slot_code, status, evidence_status, evidence_images
        FROM soft_period_follow
        WHERE day_iso BETWEEN ? AND ?
        ORDER BY day_iso DESC, id
        LIMIT 60
        """,
        ((date.fromisoformat(day) - timedelta(days=7)).isoformat(), day),
    ).fetchall()
    # شواهد visual_evidence تُحسب مرفقًا صالحًا (لا تعتمد على evidence_images وحدها).
    ensure_visual_evidence_table(connection)
    soft_ve_keys = {
        str(row[0] or "")
        for row in connection.execute(
            "SELECT DISTINCT entity_key FROM visual_evidence WHERE entity_type = 'soft_period'"
        ).fetchall()
        if str(row[0] or "").strip()
    }
    for row in soft_rows:
        fid, day_iso, slot_code, status, evidence_status, evidence_images = row
        slot = str(slot_code or "")
        label = {"lineup": "الاصطفاف", "break": "الاستراحة", "prayer": "الصلاة"}.get(slot, slot)
        status_text = str(status or "").strip()
        media = str(evidence_images or "").strip()
        entity_key = f"{day_iso}|{slot}"
        has_legacy_media = media not in {"", "[]", "null", "None"}
        has_visual = entity_key in soft_ve_keys
        has_media = has_legacy_media or has_visual
        if day_iso == day and status_text in {"", "—", "قيد التنفيذ", "لم تُنفَّذ", "غير منفذ"}:
            add(
                "soft_today_pending",
                "soft_period",
                entity_key,
                f"فترة اليوم بلا تحديث: {label}",
            )
        if status_text in {"منفّذ", "منفذ", "تم"} and not has_media:
            add(
                "soft_no_media",
                "soft_period",
                entity_key,
                f"فترة منفّذة بلا مرفق: {label} ({day_iso})",
            )

    # 5 مؤشرات دون عتبة
    ind_rows = connection.execute(
        """
        SELECT id, code, domain, standard_name, domain_score
        FROM evaluation_indicators
        ORDER BY id DESC
        LIMIT 80
        """
    ).fetchall()
    for row in ind_rows:
        iid, code, domain, standard_name, domain_score = row
        raw = str(domain_score or "").replace("%", "").replace("٪", "").strip()
        try:
            score = float(raw) if raw else None
        except ValueError:
            score = None
        if score is not None and score < 60:
            name = str(standard_name or code or domain or "مؤشر")
            add(
                "indicator_below",
                "evaluation_indicator",
                iid,
                f"مؤشر دون العتبة ({score}): {name}",
            )

    # 6 تحسين متعثر
    try:
        imp_rows = connection.execute(
            """
            SELECT id, title, status, progress_percentage
            FROM improvement_actions
            WHERE status IN ('متعثر', 'معلق', 'متأخر')
               OR CAST(REPLACE(REPLACE(COALESCE(progress_percentage,''),'%',''),'٪','') AS REAL) = 0
            ORDER BY id DESC
            LIMIT 20
            """
        ).fetchall()
    except Exception:
        imp_rows = connection.execute(
            """
            SELECT id, title, status, progress_percentage
            FROM improvement_actions
            WHERE status IN ('متعثر', 'معلق', 'متأخر')
            ORDER BY id DESC
            LIMIT 20
            """
        ).fetchall()
    for row in imp_rows:
        add(
            "improvement_stalled",
            "improvement_action",
            row[0],
            f"إجراء يحتاج متابعة: {row[1] or 'إجراء تحسين'}",
        )

    # 7 برامج معتمدة بلا قراءة
    prog_rows = connection.execute(
        """
        SELECT id, program_name, status, current_value
        FROM school_programs
        WHERE status IN ('معتمد', 'قيد التنفيذ')
        ORDER BY id DESC
        LIMIT 30
        """
    ).fetchall()
    for row in prog_rows:
        current = str(row[3] or "").strip()
        if not current:
            add(
                "program_no_progress",
                "school_program",
                row[0],
                f"برنامج بلا قراءة حالية: {row[1] or 'برنامج'}",
            )

    return found


def refresh_signals(day: str | None = None) -> dict[str, Any]:
    """يعيد توليد إشارات اليوم مع احترام ذاكرة القرار."""
    ensure_command_room_tables()
    seed_default_rules()
    day = day or _today()
    try:
        from .daily_tasks import autofill_daily_tasks
        from .soft_periods import autofill_week_follow, week_start_sunday

        autofill_daily_tasks(day)
        autofill_week_follow(week_start_sunday(day))
    except Exception:
        pass
    connection = connect()
    try:
        _migrate_action_fingerprints(connection)
        rules = _rule_map(connection)
        # إزالة إشارات اليوم ثم إعادة توليدها مع احترام ذاكرة القرار
        connection.execute("DELETE FROM signals WHERE signal_day = ?", (day,))
        # أزل أيضًا صفوف البصمة القديمة إن تغيّر شكل البصمة
        connection.execute("DELETE FROM signals")
        for item in _collect_candidates(connection, day, rules):
            _upsert_signal(connection, item)
        connection.commit()
        return list_today_signals(day, connection)
    finally:
        connection.close()


def _severity_rank(value: str) -> int:
    return {"عالية": 0, "متوسطة": 1, "منخفضة": 2}.get(str(value or ""), 9)


def list_today_signals(day: str | None = None, connection=None) -> dict[str, Any]:
    owns = connection is None
    if owns:
        ensure_command_room_tables()
        seed_default_rules()
        connection = connect()
    day = day or _today()
    try:
        rules = _rule_map(connection)
        rows = connection.execute(
            """
            SELECT id, signal_type, entity_id, entity_type, severity, message,
                   action_label, action_url, rule_code, fingerprint, signal_day, created_at
            FROM signals
            WHERE signal_day = ?
            """,
            (day,),
        ).fetchall()
        deferred_waiting = 0
        act_rows = connection.execute(
            """
            SELECT fingerprint, action, defer_until FROM signal_actions
            ORDER BY id DESC
            """
        ).fetchall()
        latest_by_fp: dict[str, tuple[str, str]] = {}
        for act in act_rows:
            fp = _normalize_fingerprint(str(act[0] or ""))
            if fp not in latest_by_fp:
                latest_by_fp[fp] = (str(act[1] or ""), str(act[2] or ""))
        for fp, (action, until) in latest_by_fp.items():
            if action == "defer" and until and until > day:
                deferred_waiting += 1

        cards = []
        for row in rows:
            fingerprint = _normalize_fingerprint(str(row[9]))
            if _suppressed(connection, fingerprint, day):
                continue
            rule = rules.get(str(row[8] or ""), {})
            last = latest_by_fp.get(fingerprint)
            returned_from_defer = bool(
                last and last[0] == "defer" and last[1] and last[1] <= day
            )
            cards.append(
                {
                    "id": row[0],
                    "signal_type": row[1],
                    "entity_id": row[2],
                    "entity_type": row[3],
                    "severity": row[4],
                    "message": row[5],
                    "action_label": row[6] or rule.get("action_label") or "فتح",
                    "action_url": row[7] or rule.get("action") or "",
                    "rule_code": row[8],
                    "fingerprint": fingerprint,
                    "signal_day": row[10],
                    "created_at": row[11],
                    "why": rule.get("condition") or row[1],
                    "recommendation": rule.get("recommendation") or row[5],
                    "returned_from_defer": returned_from_defer,
                }
            )
        cards.sort(key=lambda item: (_severity_rank(item["severity"]), item["id"]))
        cards = cards[:8]
        return {
            "day": day,
            "count": len(cards),
            "signals": cards,
            "rules_count": len(rules),
            "deferred_waiting": deferred_waiting,
            "empty_message": "لا توجد إشارات حالياً. جميع المهام محدثة.",
        }
    finally:
        if owns:
            connection.close()


def record_signal_action(
    signal_id: int,
    action: str,
    note: str = "",
    defer_days: int = 1,
) -> dict[str, Any]:
    action = str(action or "").strip().lower()
    if action not in ACTIONS:
        raise ValueError("إجراء غير معروف")
    ensure_command_room_tables()
    connection = connect()
    try:
        row = connection.execute(
            "SELECT id, fingerprint FROM signals WHERE id = ?",
            (signal_id,),
        ).fetchone()
        if not row:
            raise ValueError("الإشارة غير موجودة")
        fingerprint = _normalize_fingerprint(str(row[1]))
        defer_until = None
        if action == "defer":
            defer_until = (date.today() + timedelta(days=max(1, int(defer_days or 1)))).isoformat()
        connection.execute(
            """
            INSERT INTO signal_actions (signal_id, fingerprint, action, defer_until, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (signal_id, fingerprint, action, defer_until, note or "", _now()),
        )
        connection.commit()
        return list_today_signals(_today(), connection)
    finally:
        connection.close()


def list_rules() -> list[dict]:
    ensure_command_room_tables()
    seed_default_rules()
    connection = connect()
    try:
        rows = connection.execute(
            """
            SELECT id, code, condition_text, severity, recommendation, action, role_scope,
                   signal_type, action_label, is_active
            FROM rules
            ORDER BY id
            """
        ).fetchall()
        return [
            {
                "id": row[0],
                "code": row[1],
                "condition": row[2],
                "severity": row[3],
                "recommendation": row[4],
                "action": row[5],
                "role_scope": row[6],
                "signal_type": row[7],
                "action_label": row[8],
                "is_active": bool(row[9]),
            }
            for row in rows
        ]
    finally:
        connection.close()
