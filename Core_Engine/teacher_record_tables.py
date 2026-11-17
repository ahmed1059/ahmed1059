# جداول سجل المعلم التي لم تكن موجودة. الإنشاء عند تهيئة القاعدة، بلا زرع صفوف.

from __future__ import annotations


def ensure_teacher_record_tables(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS teacher_exams (
            id INTEGER PRIMARY KEY,
            national_id TEXT,
            subject TEXT,
            grade TEXT,
            section TEXT,
            exam_type TEXT,
            exam_date TEXT,
            total_students INTEGER,
            passed INTEGER,
            avg_score REAL,
            notes TEXT,
            source TEXT NOT NULL DEFAULT 'pilot-1448',
            FOREIGN KEY (national_id) REFERENCES noor_staff(national_id)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS teacher_analysis (
            id INTEGER PRIMARY KEY,
            national_id TEXT,
            subject TEXT,
            grade TEXT,
            section TEXT,
            period TEXT,
            pass_rate REAL,
            avg_score REAL,
            strengths TEXT,
            weaknesses TEXT,
            recommendations TEXT,
            analysis_date TEXT,
            source TEXT NOT NULL DEFAULT 'pilot-1448',
            FOREIGN KEY (national_id) REFERENCES noor_staff(national_id)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS teacher_remedial (
            id INTEGER PRIMARY KEY,
            national_id TEXT,
            subject TEXT,
            student_id TEXT,
            skill TEXT,
            plan TEXT,
            follow_up_date TEXT,
            status TEXT,
            source TEXT NOT NULL DEFAULT 'pilot-1448',
            FOREIGN KEY (national_id) REFERENCES noor_staff(national_id),
            FOREIGN KEY (student_id) REFERENCES noor_students(national_id)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS teacher_enrichment (
            id INTEGER PRIMARY KEY,
            national_id TEXT,
            subject TEXT,
            student_id TEXT,
            program TEXT,
            activity TEXT,
            follow_up_date TEXT,
            status TEXT,
            source TEXT NOT NULL DEFAULT 'pilot-1448',
            FOREIGN KEY (national_id) REFERENCES noor_staff(national_id),
            FOREIGN KEY (student_id) REFERENCES noor_students(national_id)
        )
        """
    )
    for table in ("teacher_exams", "teacher_analysis", "teacher_remedial", "teacher_enrichment"):
        connection.execute(
            f"CREATE INDEX IF NOT EXISTS ix_{table}_staff_subject ON {table}(national_id, subject)"
        )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS teacher_documents (
            id INTEGER PRIMARY KEY,
            national_id TEXT NOT NULL,
            doc_type TEXT NOT NULL,
            subject TEXT,
            grade TEXT,
            section TEXT,
            period TEXT,
            content_json TEXT NOT NULL,
            created_at TEXT,
            updated_at TEXT,
            source TEXT,
            UNIQUE(national_id, doc_type, subject, grade, section, period)
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_tdoc_type ON teacher_documents(doc_type, national_id)"
    )
