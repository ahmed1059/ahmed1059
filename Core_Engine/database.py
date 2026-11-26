# تهيئة SQLite — الجداول وفق docs/spec.md الأقسام 4 إلى 8، وجدول settings، وجدول content_overrides، وجدول school_settings
# لا يُنفَّذ شيء عند الاستيراد؛ الإنشاء يتم عبر init_db() فقط

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

# قاعدة البيانات داخل School_Data حسب القسم 3 من المواصفة.
# DATABASE_PATH إن وُجد يغطي المسار. المسار النسبي يُحسب من جذر المشروع لا من مجلد التشغيل.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_configured = os.environ.get("DATABASE_PATH", "School_Data/school_1059.db")
_configured_path = Path(_configured)
DB_PATH = _configured_path if _configured_path.is_absolute() else (_PROJECT_ROOT / _configured_path)
OFFICIAL_PRINCIPAL_NAME = "نايف بن سمير حجيف المخلفي"


def connect():
    """يفتح الاتصال ويضبط المفاتيح الأجنبية."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        from .event_bus import trace_sql

        connection.set_trace_callback(trace_sql)
    except Exception:
        pass
    return connection


def _seed_evaluation_cycle(connection):
    """يملأ دورة التقويم الأولى مرة واحدة إن كان السجل فارغًا."""
    existing = connection.execute("SELECT COUNT(*) FROM evaluation_cycles").fetchone()
    if existing and existing[0]:
        return
    path = Path(__file__).resolve().parent / "banks" / "evaluation_cycle_1448.json"
    if not path.is_file():
        return
    payload = json.loads(path.read_text(encoding="utf-8"))
    domains = payload.get("domains") or []
    scores = {
        item.get("name", ""): (item.get("score", ""), item.get("gap_to_next", ""))
        for item in domains
        if item.get("name")
    }
    moment = datetime.now(timezone.utc).isoformat()
    cursor = connection.execute(
        """
        INSERT INTO evaluation_cycles (
            title, academic_year, overall_score, overall_level, domains_json, source_note, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.get("title", ""),
            payload.get("academic_year", ""),
            payload.get("overall_score", ""),
            payload.get("overall_level", ""),
            json.dumps(domains, ensure_ascii=False),
            payload.get("source_note", ""),
            moment,
        ),
    )
    cycle_id = cursor.lastrowid
    for item in payload.get("indicators") or []:
        domain = item.get("domain", "")
        score, gap = scores.get(domain, ("", ""))
        connection.execute(
            """
            INSERT INTO evaluation_indicators (
                cycle_id, code, domain, standard_name, statement, level, domain_score, gap_to_next, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cycle_id,
                item.get("code", ""),
                domain,
                item.get("standard_name", ""),
                item.get("statement", ""),
                item.get("level", ""),
                score,
                gap,
                moment,
            ),
        )


def _seed_nafs_card(connection):
    """يملأ بطاقة نافس للصف الثالث مرة واحدة إن كان السجل فارغًا."""
    existing = connection.execute("SELECT COUNT(*) FROM nafs_cards").fetchone()
    if existing and existing[0]:
        return
    connection.execute(
        """
        INSERT INTO nafs_cards (
            grade, enrolled, tested, reading_score, science_score, math_score,
            weakest_skill, weakest_score, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "الثالث المتوسط",
            "111",
            "101",
            "27.7",
            "42.5",
            "18.8",
            "الجبر",
            "28.7",
            datetime.now(timezone.utc).isoformat(),
        ),
    )


def _seed_improvement_actions(connection):
    """يملأ إجراءات التحسين الثلاثة مرة واحدة، ويضيف اجتماع الجبر لخطة الوكيل إن غاب."""
    existing = connection.execute("SELECT COUNT(*) FROM improvement_actions").fetchone()
    moment = datetime.now(timezone.utc).isoformat()
    if not existing or not existing[0]:
        actions = (
            (
                "اجتماع عاجل لمعلمي الرياضيات لمراجعة الجبر",
                "vice_teachers",
                "وكيل الشؤون التعليمية",
                "3-1-1-2",
                "محضر اجتماع",
                1,
            ),
            (
                "وضع خطة صيانة دورية موثقة للمرافق والتجهيزات",
                "school_vice",
                "وكيل الشؤون المدرسية",
                "4-2-1-2",
                "",
                2,
            ),
            (
                "إطلاق مبادرات شراكة مجتمعية فعلية لدعم التعلم",
                "principal",
                "مدير المدرسة",
                "1-3-1-3",
                "",
                3,
            ),
        )
        connection.executemany(
            """
            INSERT INTO improvement_actions (
                title, owner_role, owner_label, indicator_code, evidence, sort_order, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [(*action, moment) for action in actions],
        )
    found = connection.execute(
        """
        SELECT 1 FROM content_overrides
        WHERE role = 'vice_teachers'
          AND field_path LIKE 'tasks.custom.%.title'
          AND value LIKE '%مراجعة الجبر%'
        """
    ).fetchone()
    if found:
        return
    codes = connection.execute(
        """
        SELECT field_path FROM content_overrides
        WHERE role = 'vice_teachers' AND field_path LIKE 'tasks.custom.%.title'
        """
    ).fetchall()
    highest = 0
    for (path,) in codes:
        parts = str(path).split(".")
        if len(parts) >= 3 and parts[2].isdigit():
            highest = max(highest, int(parts[2]))
    code = f"custom.{highest + 1}"
    fields = {
        "added": "1",
        "title": "اجتماع عاجل لمعلمي الرياضيات لمراجعة الجبر",
        "execution_time": "فصل دراسي",
        "execution_method": "وضع خطة علاجية سريعة، المؤشر 3-1-1-2",
        "evidence": "محضر اجتماع",
    }
    connection.executemany(
        """
        INSERT INTO content_overrides (school_id, role, field_path, value, updated_at)
        VALUES (NULL, 'vice_teachers', ?, ?, ?)
        """,
        [(f"tasks.{code}.{field}", value, moment) for field, value in fields.items()],
    )


def _migrate_school_programs(connection):
    """ينقل جدول البرامج القديم إلى الحقول الجديدة مرة واحدة."""
    columns = {row[1] for row in connection.execute("PRAGMA table_info(school_programs)")}
    if not columns or "program_name" in columns:
        return
    connection.execute(
        """
        CREATE TABLE school_programs_next (
            id INTEGER PRIMARY KEY,
            program_name TEXT NOT NULL,
            strategic_goal TEXT,
            executive_goal TEXT,
            target_audience TEXT,
            duration TEXT,
            implementers TEXT,
            budget TEXT,
            mechanism TEXT,
            success_indicator TEXT,
            risk_management TEXT,
            register_id INTEGER,
            owner_role TEXT,
            owner_roles TEXT,
            indicator_ids TEXT,
            status TEXT,
            duty_ref TEXT,
            task_ref TEXT,
            created_at TEXT,
            updated_at TEXT
        )
        """
    )
    register_ids = {
        "leadership": 1,
        "professional": 2,
        "curriculum": 3,
        "discipline": 4,
        "activities": 5,
        "environment": 6,
    }
    code_to_id = {
        row[1]: row[0]
        for row in connection.execute("SELECT id, code FROM evaluation_indicators")
    }
    rows = connection.execute(
        """
        SELECT name, goal, audience, period, executors, budget, method, success_indicator,
               risk_management, register_code, owner_role, indicator_codes, duty_ref, task_ref,
               approval_status, updated_at
        FROM school_programs
        """
    ).fetchall()
    for row in rows:
        try:
            codes = json.loads(row[11] or "[]")
        except json.JSONDecodeError:
            codes = []
        indicator_ids = [code_to_id[code] for code in codes if code in code_to_id]
        moment = row[15] or datetime.now(timezone.utc).isoformat()
        connection.execute(
            """
            INSERT INTO school_programs_next (
                program_name, strategic_goal, executive_goal, target_audience, duration, implementers,
                budget, mechanism, success_indicator, risk_management, register_id, owner_role,
                indicator_ids, status, duty_ref, task_ref, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row[0] or "",
                "",
                row[1] or "",
                row[2] or "",
                row[3] or "",
                row[4] or "",
                row[5] or "",
                row[6] or "",
                row[7] or "",
                row[8] or "",
                register_ids.get(row[9] or "", 0),
                row[10] or "",
                json.dumps(indicator_ids),
                "معتمد" if row[14] == "approved" else "مسودة",
                row[12] or "",
                row[13] or "",
                moment,
                moment,
            ),
        )
    connection.execute("DROP TABLE school_programs")
    connection.execute("ALTER TABLE school_programs_next RENAME TO school_programs")


def _seed_program_engine(connection):
    """يزرع القوالب الستة وبنك صياغات الفاقد والانضباط مرة واحدة إن كان الجدول فارغًا."""
    if connection.execute("SELECT COUNT(*) FROM program_templates").fetchone()[0] == 0:
        from .program_registry import TEMPLATES

        for index, item in enumerate(TEMPLATES, start=1):
            connection.execute(
                """
                INSERT INTO program_templates (
                    template_key, label, program_name, strategic_goal, executive_goal,
                    target_audience, duration, implementers, budget, mechanism,
                    success_indicator, risk_management, register_id, owner_role,
                    indicator_codes, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["key"],
                    item["label"],
                    item["program_name"],
                    item.get("strategic_goal") or "",
                    item.get("executive_goal") or "",
                    item.get("target_audience") or "",
                    item.get("duration") or "",
                    item.get("implementers") or "",
                    item.get("budget") or "",
                    item.get("mechanism") or "",
                    item.get("success_indicator") or "",
                    item.get("risk_management") or "",
                    item.get("register_id") or 0,
                    item.get("owner_role") or "",
                    json.dumps(item.get("indicator_codes") or [], ensure_ascii=False),
                    index,
                ),
            )
    if connection.execute("SELECT COUNT(*) FROM program_phrase_bank").fetchone()[0] == 0:
        path = Path(__file__).resolve().parent / "banks" / "program_phrases.json"
        if not path.is_file():
            return
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return
        if not isinstance(payload, dict):
            return
        moment = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        for template_key, fields in payload.items():
            if not isinstance(fields, dict):
                continue
            for field_key, phrases in fields.items():
                if not isinstance(phrases, list):
                    continue
                for index, phrase in enumerate(phrases, start=1):
                    text = str(phrase or "").strip()
                    if not text:
                        continue
                    connection.execute(
                        """
                        INSERT OR IGNORE INTO program_phrase_bank (
                            template_key, field_key, phrase, sort_order, created_at
                        ) VALUES (?, ?, ?, ?, ?)
                        """,
                        (str(template_key), str(field_key), text, index, moment),
                    )


def _ensure_owner_roles_columns(connection):
    """يضيف owner_roles قبل أي قراءة له. إن وُجد العمود لا يُعاد إنشاؤه ولا تُمس الصفوف."""
    for table in ("school_programs", "program_templates"):
        columns = {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}
        if columns and "owner_roles" not in columns:
            connection.execute(f"ALTER TABLE {table} ADD COLUMN owner_roles TEXT")


def _link_program_owners(connection):
    """يضيف أصحاب البرنامج المتعددين، ويربط الانضباط بالوكيل والموجه، ويملأ حقول الفاقد الفارغة من قالبه."""
    _ensure_owner_roles_columns(connection)
    for row in connection.execute("SELECT id, owner_role, owner_roles FROM school_programs"):
        if str(row[2] or "").strip():
            continue
        role = str(row[1] or "").strip()
        connection.execute(
            "UPDATE school_programs SET owner_roles = ? WHERE id = ?",
            (json.dumps([role] if role else [], ensure_ascii=False), row[0]),
        )
    for row in connection.execute("SELECT id, template_key, owner_role, owner_roles FROM program_templates"):
        current = str(row[3] or "")
        if row[1] == "discipline":
            if "vice_students" in current and "student_counselor" in current:
                continue
            roles = ["vice_students", "student_counselor"]
        elif current.strip():
            continue
        else:
            roles = [row[2]] if str(row[2] or "").strip() else []
        connection.execute(
            "UPDATE program_templates SET owner_roles = ? WHERE id = ?",
            (json.dumps(roles, ensure_ascii=False), row[0]),
        )
    loss = connection.execute(
        """
        SELECT strategic_goal, executive_goal, target_audience, duration, implementers,
               budget, mechanism, success_indicator, risk_management
        FROM program_templates
        WHERE template_key = 'loss'
        """
    ).fetchone()
    if not loss:
        return
    for row in connection.execute(
        """
        SELECT id, program_name, target_audience, duration, implementers, mechanism, success_indicator
        FROM school_programs
        """
    ):
        if "الفاقد" not in str(row[1] or ""):
            continue
        if any(str(row[index] or "").strip() for index in range(2, 7)):
            continue
        connection.execute(
            """
            UPDATE school_programs
            SET strategic_goal = ?, executive_goal = ?, target_audience = ?, duration = ?,
                implementers = ?, budget = ?, mechanism = ?, success_indicator = ?, risk_management = ?
            WHERE id = ?
            """,
            (*loss, row[0]),
        )


def _ensure_internal_assignments(connection):
    """جدول التكليف الداخلي وعمود هوية المكلَّف على البرنامج. لا يمس صفوف الـ47."""
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS internal_assignments (
            id INTEGER PRIMARY KEY,
            assignment_type TEXT NOT NULL,
            staff_id TEXT NOT NULL,
            academic_year TEXT NOT NULL,
            appointed_by TEXT,
            created_at TEXT,
            active INTEGER NOT NULL DEFAULT 1
        )
        """
    )
    connection.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_internal_assignments_active
        ON internal_assignments(assignment_type, academic_year)
        WHERE active = 1
        """
    )
    program_columns = {row[1] for row in connection.execute("PRAGMA table_info(school_programs)")}
    if program_columns and "assignee_staff_id" not in program_columns:
        connection.execute("ALTER TABLE school_programs ADD COLUMN assignee_staff_id TEXT")


def _extend_program_measures(connection):
    """يضيف حقول المؤشر الرقمي ونسبة إنجاز الإجراء دون تعبئة أرقام."""
    program_columns = {row[1] for row in connection.execute("PRAGMA table_info(school_programs)")}
    for name in ("baseline_value", "target_value", "current_value", "unit", "kpi_description"):
        if program_columns and name not in program_columns:
            connection.execute(f"ALTER TABLE school_programs ADD COLUMN {name} TEXT")
    action_columns = {row[1] for row in connection.execute("PRAGMA table_info(improvement_actions)")}
    for name in (
        "status",
        "progress_percentage",
        "root_cause",
        "objective",
        "baseline_value",
        "target_value",
        "unit",
        "resources",
        "start_hijri",
        "start_gregorian",
        "end_hijri",
        "end_gregorian",
        "follow_hijri",
        "follow_gregorian",
        "follow_note",
    ):
        if action_columns and name not in action_columns:
            connection.execute(f"ALTER TABLE improvement_actions ADD COLUMN {name} TEXT")


def _link_operational_goals(connection):
    """يربط القالب والبرنامج المحفوظ بهدف ملف المدير إن كان الحقل فارغًا."""
    program_columns = {row[1] for row in connection.execute("PRAGMA table_info(school_programs)")}
    if program_columns and "goal_ref" not in program_columns:
        connection.execute("ALTER TABLE school_programs ADD COLUMN goal_ref TEXT")
    template_columns = {row[1] for row in connection.execute("PRAGMA table_info(program_templates)")}
    if template_columns and "goal_ref" not in template_columns:
        connection.execute("ALTER TABLE program_templates ADD COLUMN goal_ref TEXT")
    from .program_registry import TEMPLATES

    for item in TEMPLATES:
        goal_id = str(item.get("goal_ref") or "").strip()
        key = str(item.get("key") or "").strip()
        if not key or not goal_id:
            continue
        connection.execute(
            """
            UPDATE program_templates
            SET goal_ref = ?
            WHERE template_key = ? AND (goal_ref IS NULL OR goal_ref = '')
            """,
            (goal_id, key),
        )
    connection.execute(
        """
        UPDATE school_programs
        SET goal_ref = 'G3'
        WHERE (goal_ref IS NULL OR goal_ref = '')
          AND program_name LIKE '%الفاقد%'
        """
    )


def _extend_knowledge_bank(connection):
    """يضيف صياغات البرامج وقوائم المجالات من ملفات البنك دون استبدال المحفوظ."""
    program_columns = {row[1] for row in connection.execute("PRAGMA table_info(school_programs)")}
    for name in ("domain", "level_name"):
        if program_columns and name not in program_columns:
            connection.execute(f"ALTER TABLE school_programs ADD COLUMN {name} TEXT")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS knowledge_options (
            id INTEGER PRIMARY KEY,
            list_key TEXT NOT NULL,
            option_value TEXT NOT NULL,
            option_label TEXT NOT NULL,
            sort_order INTEGER,
            UNIQUE(list_key, option_value)
        )
        """
    )
    banks = Path(__file__).resolve().parent / "banks"
    moment = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    phrases_path = banks / "program_phrases.json"
    if phrases_path.is_file():
        try:
            phrases = json.loads(phrases_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            phrases = {}
        if isinstance(phrases, dict):
            for template_key, fields in phrases.items():
                if not isinstance(fields, dict):
                    continue
                for field_key, rows in fields.items():
                    if not isinstance(rows, list):
                        continue
                    for index, phrase in enumerate(rows, start=1):
                        text = str(phrase or "").strip()
                        if not text:
                            continue
                        connection.execute(
                            """
                            INSERT OR IGNORE INTO program_phrase_bank (
                                template_key, field_key, phrase, sort_order, created_at
                            ) VALUES (?, ?, ?, ?, ?)
                            """,
                            (str(template_key), str(field_key), text, index, moment),
                        )
    lists_path = banks / "knowledge_lists.json"
    if lists_path.is_file():
        try:
            lists = json.loads(lists_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            lists = {}
        if isinstance(lists, dict):
            for list_key, rows in lists.items():
                if not isinstance(rows, list):
                    continue
                for index, item in enumerate(rows, start=1):
                    if isinstance(item, dict):
                        value = str(item.get("value") or "").strip()
                        label = str(item.get("label") or value).strip()
                    else:
                        value = str(item or "").strip()
                        label = value
                    if not value:
                        continue
                    connection.execute(
                        """
                        INSERT OR IGNORE INTO knowledge_options (
                            list_key, option_value, option_label, sort_order
                        ) VALUES (?, ?, ?, ?)
                        """,
                        (str(list_key), value, label, index),
                    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS kpi_options (
            id INTEGER PRIMARY KEY,
            list_key TEXT NOT NULL,
            option_value TEXT NOT NULL,
            option_label TEXT NOT NULL,
            sort_order INTEGER,
            UNIQUE(list_key, option_value)
        )
        """
    )
    kpi_path = banks / "kpi_options.json"
    if kpi_path.is_file():
        try:
            kpi_lists = json.loads(kpi_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            kpi_lists = {}
        if isinstance(kpi_lists, dict):
            for list_key, rows in kpi_lists.items():
                if not isinstance(rows, list):
                    continue
                for index, item in enumerate(rows, start=1):
                    text = str(item or "").strip()
                    if not text:
                        continue
                    connection.execute(
                        """
                        INSERT OR IGNORE INTO kpi_options (
                            list_key, option_value, option_label, sort_order
                        ) VALUES (?, ?, ?, ?)
                        """,
                        (str(list_key), text, text, index),
                    )


_STUDENT_ENRICH_COLUMNS = (
    "nationality",
    "birth_date",
    "birth_place",
    "mother_name",
    "el_grade",
    "el_section",
    "enriched_at",
    "enrichment_source",
)


def ensure_noor_students_enrichment_columns(connection) -> None:
    """حقول إثراء EL على noor_students إن لم توجد."""
    columns = {row[1] for row in connection.execute("PRAGMA table_info(noor_students)")}
    if not columns:
        return
    for name in _STUDENT_ENRICH_COLUMNS:
        if name not in columns:
            connection.execute(f"ALTER TABLE noor_students ADD COLUMN {name} TEXT")
    staff_columns = {row[1] for row in connection.execute("PRAGMA table_info(noor_staff)")}
    if staff_columns and "notes" not in staff_columns:
        connection.execute("ALTER TABLE noor_staff ADD COLUMN notes TEXT")


def init_db():
    """ينشئ الجداول إن لم تكن موجودة، دون بيانات أولية."""
    connection = connect()
    try:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS schools (
                id INTEGER PRIMARY KEY,
                name TEXT,
                region TEXT,
                stage TEXT,
                gender TEXT,
                logo_path TEXT,
                theme TEXT,
                font TEXT,
                academic_year TEXT
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                national_id TEXT,
                name TEXT,
                role TEXT,
                specialty TEXT,
                password_hash TEXT,
                school_id INTEGER,
                failed_attempts INTEGER,
                locked_until TEXT,
                FOREIGN KEY (school_id) REFERENCES schools(id)
            );

            CREATE TABLE IF NOT EXISTS calendars (
                id INTEGER PRIMARY KEY,
                region TEXT,
                semester TEXT,
                week_number INTEGER,
                start_date TEXT,
                end_date TEXT,
                hijri_start TEXT,
                hijri_end TEXT
            );

            CREATE TABLE IF NOT EXISTS task_bank (
                id INTEGER PRIMARY KEY,
                task_code TEXT,
                title TEXT,
                role TEXT,
                stage TEXT,
                week_target INTEGER,
                semester TEXT,
                execution_method TEXT,
                execution_time TEXT,
                evidence TEXT,
                category TEXT
            );

            CREATE TABLE IF NOT EXISTS plans (
                id INTEGER PRIMARY KEY,
                school_id INTEGER,
                user_id INTEGER,
                plan_type TEXT,
                week_number INTEGER,
                content TEXT,
                created_at TEXT,
                updated_at TEXT,
                FOREIGN KEY (school_id) REFERENCES schools(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY,
                school_id INTEGER,
                [key] TEXT,
                value TEXT,
                FOREIGN KEY (school_id) REFERENCES schools(id)
            );

            CREATE TABLE IF NOT EXISTS content_overrides (
                id INTEGER PRIMARY KEY,
                school_id INTEGER,
                role TEXT NOT NULL,
                field_path TEXT NOT NULL,
                value TEXT,
                updated_at TEXT,
                FOREIGN KEY (school_id) REFERENCES schools(id)
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_content_unique
                ON content_overrides(role, field_path, school_id);

            CREATE TABLE IF NOT EXISTS school_settings (
                id INTEGER PRIMARY KEY,
                school_name TEXT,
                statistical_number TEXT,
                education_office TEXT,
                building_type TEXT,
                classrooms TEXT,
                labs TEXT,
                sports_halls TEXT,
                total_students TEXT,
                total_staff TEXT,
                chair_name TEXT,
                members_json TEXT,
                parent_representative TEXT,
                student_representative TEXT,
                sources_json TEXT,
                term_weeks_count INTEGER DEFAULT 18,
                education_administration TEXT,
                approval_authorities_json TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS plan_custom_items (
                id INTEGER PRIMARY KEY,
                role TEXT NOT NULL UNIQUE,
                items_json TEXT NOT NULL,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS noor_staff (
                national_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                mobile TEXT,
                specialty TEXT,
                role TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS noor_students (
                national_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                grade TEXT,
                classroom TEXT,
                status TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS noor_timetable (
                id INTEGER PRIMARY KEY,
                day TEXT,
                period TEXT,
                subject TEXT,
                teacher TEXT,
                classroom TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS evaluation_cycles (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                academic_year TEXT,
                overall_score TEXT,
                overall_level TEXT,
                domains_json TEXT,
                source_note TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS evaluation_indicators (
                id INTEGER PRIMARY KEY,
                cycle_id INTEGER NOT NULL,
                code TEXT NOT NULL,
                domain TEXT NOT NULL,
                standard_name TEXT NOT NULL,
                statement TEXT NOT NULL,
                level TEXT NOT NULL,
                domain_score TEXT,
                gap_to_next TEXT,
                updated_at TEXT,
                UNIQUE(cycle_id, code),
                FOREIGN KEY (cycle_id) REFERENCES evaluation_cycles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS improvement_actions (
                id INTEGER PRIMARY KEY,
                title TEXT,
                owner_role TEXT,
                owner_label TEXT,
                indicator_code TEXT,
                evidence TEXT,
                sort_order INTEGER,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS school_programs (
                id INTEGER PRIMARY KEY,
                program_name TEXT NOT NULL,
                strategic_goal TEXT,
                executive_goal TEXT,
                target_audience TEXT,
                duration TEXT,
                implementers TEXT,
                budget TEXT,
                mechanism TEXT,
                success_indicator TEXT,
                risk_management TEXT,
                register_id INTEGER,
                owner_role TEXT,
                owner_roles TEXT,
                indicator_ids TEXT,
                status TEXT,
                duty_ref TEXT,
                task_ref TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS program_templates (
                id INTEGER PRIMARY KEY,
                template_key TEXT NOT NULL UNIQUE,
                label TEXT NOT NULL,
                program_name TEXT NOT NULL,
                strategic_goal TEXT,
                executive_goal TEXT,
                target_audience TEXT,
                duration TEXT,
                implementers TEXT,
                budget TEXT,
                mechanism TEXT,
                success_indicator TEXT,
                risk_management TEXT,
                register_id INTEGER,
                owner_role TEXT,
                owner_roles TEXT,
                indicator_codes TEXT,
                goal_ref TEXT,
                sort_order INTEGER
            );

            CREATE TABLE IF NOT EXISTS program_phrase_bank (
                id INTEGER PRIMARY KEY,
                template_key TEXT NOT NULL,
                field_key TEXT NOT NULL,
                phrase TEXT NOT NULL,
                sort_order INTEGER,
                created_at TEXT,
                UNIQUE(template_key, field_key, phrase)
            );

            CREATE TABLE IF NOT EXISTS phrase_bank (
                id INTEGER PRIMARY KEY,
                category TEXT NOT NULL,
                sub_category TEXT NOT NULL,
                field_name TEXT NOT NULL,
                template_text TEXT NOT NULL,
                variables TEXT,
                sort_order INTEGER,
                created_at TEXT,
                UNIQUE(category, sub_category, field_name, template_text)
            );

            CREATE TABLE IF NOT EXISTS school_operational_plan (
                id INTEGER PRIMARY KEY,
                academic_year TEXT,
                vision TEXT,
                mission TEXT,
                values_json TEXT,
                swot_analysis TEXT,
                strategic_goals TEXT,
                kpis TEXT,
                budget TEXT,
                planning_team TEXT,
                monitoring_plan TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS task_goal_links (
                role TEXT NOT NULL,
                task_code TEXT NOT NULL,
                goal_id TEXT,
                updated_at TEXT,
                PRIMARY KEY (role, task_code)
            );

            CREATE TABLE IF NOT EXISTS nafs_cards (
                id INTEGER PRIMARY KEY,
                grade TEXT,
                enrolled TEXT,
                tested TEXT,
                reading_score TEXT,
                science_score TEXT,
                math_score TEXT,
                weakest_skill TEXT,
                weakest_score TEXT,
                updated_at TEXT
            );
            """
        )
        _seed_evaluation_cycle(connection)
        _seed_nafs_card(connection)
        _seed_improvement_actions(connection)
        _migrate_school_programs(connection)
        _seed_program_engine(connection)
        from .daily_tasks import ensure_daily_tasks_table
        from .program_registry import sync_program_templates

        ensure_daily_tasks_table(connection)
        from .soft_periods import ensure_soft_periods_tables, seed_default_slots
        from .phrase_bank import ensure_pedagogy_phrase_bank, seed_phrase_bank

        ensure_soft_periods_tables(connection)
        seed_default_slots(connection)
        ensure_pedagogy_phrase_bank(connection)
        seed_phrase_bank(connection)
        from .command_room import ensure_command_room_tables, seed_default_rules

        ensure_command_room_tables(connection)
        seed_default_rules(connection)
        _ensure_owner_roles_columns(connection)
        _extend_program_measures(connection)
        _link_operational_goals(connection)
        _extend_knowledge_bank(connection)
        sync_program_templates(connection)
        from .retention import ensure_soft_delete

        ensure_soft_delete(connection)
        from .program_registry import ensure_school_programs_from_templates

        ensure_school_programs_from_templates(connection)
        _link_program_owners(connection)
        _extend_program_measures(connection)
        _ensure_internal_assignments(connection)
        from .students_support_api import ensure_students_support_table
        from .teacher_record_tables import ensure_teacher_record_tables

        ensure_students_support_table(connection)
        ensure_teacher_record_tables(connection)
        from .import_center_api import ensure_nafes_timetable

        ensure_nafes_timetable(connection)
        from .retention import ensure_soft_delete
        from .audit_log import ensure_audit_table

        ensure_soft_delete(connection)
        ensure_audit_table(connection)
        from .program_images_api import ensure_program_images_table, ensure_program_plan_table

        ensure_program_images_table(connection)
        ensure_program_plan_table(connection)
        from .staff_opinions_api import ensure_staff_opinions_table
        from .witness_files_api import ensure_witness_files_table

        ensure_staff_opinions_table(connection)
        ensure_witness_files_table(connection)
        _link_operational_goals(connection)
        _extend_knowledge_bank(connection)
        columns = {row[1] for row in connection.execute("PRAGMA table_info(school_settings)")}
        if "term_weeks_count" not in columns:
            connection.execute(
                "ALTER TABLE school_settings ADD COLUMN term_weeks_count INTEGER DEFAULT 18"
            )
        if "education_administration" not in columns:
            connection.execute(
                "ALTER TABLE school_settings ADD COLUMN education_administration TEXT"
            )
        if "approval_authorities_json" not in columns:
            connection.execute(
                "ALTER TABLE school_settings ADD COLUMN approval_authorities_json TEXT"
            )
        staff_columns = {row[1] for row in connection.execute("PRAGMA table_info(noor_staff)")}
        if staff_columns and "active" not in staff_columns:
            connection.execute("ALTER TABLE noor_staff ADD COLUMN active INTEGER DEFAULT 1")
        from .job_performance_api import ensure_on_boot

        ensure_on_boot(connection)
        from .accreditation_session_api import ensure_on_boot as ensure_accreditation_self

        ensure_accreditation_self(connection)
        from .nafs_session_api import ensure_on_boot as ensure_nafs_bank

        ensure_nafs_bank(connection)
        ensure_noor_students_enrichment_columns(connection)
        from .portal_session_api import ensure_on_boot as ensure_portal_ssot

        ensure_portal_ssot(connection)
        from .portal_owner_api import ensure_on_boot as ensure_portal_owner

        ensure_portal_owner(connection)
        from .portal_identity_api import ensure_on_boot as ensure_portal_identity

        ensure_portal_identity(connection)
        from .portal_radar_api import ensure_on_boot as ensure_portal_radar

        ensure_portal_radar(connection)
        from .nafs_misconception_lab import ensure_on_boot as ensure_misconception_lab

        ensure_misconception_lab(connection)
        from .portal_games_api import ensure_on_boot as ensure_portal_games

        ensure_portal_games(connection)
        from .nafs_unit2_ssot import ensure_on_boot as ensure_nafs_unit2

        ensure_nafs_unit2(connection)
        from .nafs_adaptive_engine import ensure_on_boot as ensure_nafs_adaptive

        ensure_nafs_adaptive(connection)
        from .nafs_counsel_boost import ensure_counsel_boost

        ensure_counsel_boost(connection)
        from .nafs_readalong_api import ensure_on_boot as ensure_nafs_readalong

        ensure_nafs_readalong(connection)
        approval_path = Path(__file__).resolve().parent.parent / "Print_Canvas" / "banks" / "approval_authorities.json"
        if approval_path.is_file():
            approval_text = approval_path.read_text(encoding="utf-8").strip()
            if approval_text:
                connection.execute(
                    """
                    UPDATE school_settings
                    SET approval_authorities_json = ?
                    WHERE id = 1
                      AND (
                        approval_authorities_json IS NULL
                        OR trim(approval_authorities_json) = ''
                      )
                    """,
                    (approval_text,),
                )
        connection.execute(
            """
            UPDATE school_settings
            SET chair_name = ?
            WHERE chair_name IS NULL
               OR trim(chair_name) = ''
               OR chair_name LIKE '%نائف%'
            """,
            (OFFICIAL_PRINCIPAL_NAME,),
        )
        from .access import prepare_access

        prepare_access(connection)
        connection.commit()
    finally:
        connection.close()
