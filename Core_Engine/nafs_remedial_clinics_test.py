# اختبار دخان — جسر العيادات العلاجية (المرحلة ٢).
from __future__ import annotations

import sqlite3
import unittest


class RemedialClinicsSmokeTests(unittest.TestCase):
    def test_propose_approve_purge(self):
        from .nafs_adaptive_engine import ensure_on_boot, upsert_error_vault
        from .nafs_remedial_clinics import (
            ApproveClinicBody,
            PurgePassBody,
            approve_clinic,
            ensure_clinic_columns,
            list_open_clinics,
            mark_purge_pass,
            propose_clinics,
        )
        from .teacher_record_tables import ensure_teacher_record_tables

        connection = sqlite3.connect(":memory:")
        connection.executescript(
            """
            CREATE TABLE noor_students(
              national_id TEXT PRIMARY KEY, name TEXT, grade TEXT, classroom TEXT
            );
            INSERT INTO noor_students VALUES
              ('301','طالب أ','الثالث متوسط','أ'),
              ('302','طالب ب','الثالث متوسط','أ');
            """
        )
        ensure_teacher_record_tables(connection)
        ensure_on_boot(connection)
        ensure_clinic_columns(connection)
        for nid in ("301", "302"):
            upsert_error_vault(
                connection,
                nid,
                {
                    "id": 40 + int(nid[-1]),
                    "domain": "math",
                    "skill": "الجبر",
                    "stem": "س^٢",
                    "common_mistake": "ضرب الأسس",
                    "golden_rule": "اجمع الأسس",
                    "grade_root": "٢م",
                },
                "A",
                "B",
                False,
            )
        pack = propose_clinics(connection, grade="ثالث", section="أ")
        self.assertTrue(pack["ok"])
        self.assertGreaterEqual(pack["count"], 1)
        prop = pack["proposals"][0]
        self.assertEqual(prop["teacher_name"], "أ. حسن نافع الحرساني")
        self.assertEqual(prop["grade_root"], "٢م")
        self.assertIn(prop["etec"]["code_ar"], ("٣-١-١-٢", "3-1-1-2"))

        result = approve_clinic(
            connection,
            ApproveClinicBody(
                clinic_key=prop["clinic_key"],
                section=prop["section"],
                domain=prop["domain"],
                skill=prop["skill"],
                grade_root=prop["grade_root"],
                student_nids=prop["student_nids"],
                generate_worksheet=False,
            ),
            {"national_id": "1008379958", "name": "مالك"},
        )
        self.assertTrue(result["ok"])
        self.assertEqual(result["inserted"], 2)
        opened = list_open_clinics(connection)
        self.assertGreaterEqual(opened["count"], 2)

        passed = mark_purge_pass(
            connection,
            PurgePassBody(
                student_nid="301",
                skill="الجبر",
                domain="math",
                clinic_key=prop["clinic_key"],
            ),
            {"name": "معلم"},
        )
        self.assertTrue(passed["ok"])
        status = connection.execute(
            "SELECT status FROM teacher_remedial WHERE student_id='301' LIMIT 1"
        ).fetchone()[0]
        self.assertEqual(status, "مُتقَن")
        vault = connection.execute(
            "SELECT status FROM student_error_vault WHERE student_nid='301' LIMIT 1"
        ).fetchone()[0]
        self.assertEqual(vault, "recovered")
        connection.close()

    def test_routes_registered(self):
        from Core_Engine.app import app

        paths = set(app.openapi()["paths"])
        for p in (
            "/api/portal/teacher/clinics/proposals",
            "/api/portal/teacher/clinics/approve",
            "/api/portal/teacher/clinics/open",
            "/api/portal/teacher/clinics/purge-pass",
            "/api/portal/teacher/clinics/worksheet",
        ):
            self.assertIn(p, paths)


if __name__ == "__main__":
    unittest.main()
