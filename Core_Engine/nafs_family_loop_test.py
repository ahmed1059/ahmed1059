# اختبار دخان — إغلاق حلقة الشراكة الأسرية (المرحلة ٣).
from __future__ import annotations

import sqlite3
import unittest


class FamilyLoopSmokeTests(unittest.TestCase):
    def test_build_pledge_omr_evidence(self):
        from .nafs_adaptive_engine import ensure_on_boot as ensure_adaptive
        from .nafs_family_loop import (
            EVIDENCE_CODE,
            FAMILY_STEPS,
            TRAINING_LINKS,
            build_child_loop,
            ensure_family_loop,
        )
        from .nafs_unit2_ssot import ensure_on_boot as ensure_weekly
        from .portal_owner_api import ensure_owner_tables
        from .teacher_record_tables import ensure_teacher_record_tables
        from .visual_evidence import ensure_visual_evidence_table

        connection = sqlite3.connect(":memory:")
        connection.executescript(
            """
            CREATE TABLE noor_students(
              national_id TEXT PRIMARY KEY, name TEXT, grade TEXT, classroom TEXT
            );
            INSERT INTO noor_students VALUES ('401','فارس تجريبي','الثالث متوسط','ب');
            CREATE TABLE noor_staff(
              national_id TEXT PRIMARY KEY, name TEXT, mobile TEXT, specialty TEXT,
              role TEXT, updated_at TEXT, is_deleted INTEGER DEFAULT 0, active INTEGER DEFAULT 1
            );
            CREATE TABLE portal_challenge_runs(
              id INTEGER PRIMARY KEY, student_nid TEXT, mode TEXT,
              score_pct REAL, xp_earned INTEGER, finished_at TEXT
            );
            CREATE TABLE portal_behavior_points(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              student_nid TEXT, program TEXT, points INTEGER, note TEXT, created_at TEXT
            );
            """
        )
        ensure_owner_tables(connection)
        ensure_weekly(connection)
        ensure_adaptive(connection)
        ensure_teacher_record_tables(connection)
        ensure_visual_evidence_table(connection)
        ensure_family_loop(connection)
        try:
            from .nafs_remedial_clinics import ensure_clinic_columns

            ensure_clinic_columns(connection)
        except Exception:
            pass

        self.assertEqual(len(FAMILY_STEPS), 4)
        self.assertEqual(len(TRAINING_LINKS), 3)

        child = {
            "national_id": "401",
            "name": "فارس تجريبي",
            "grade": "الثالث متوسط",
            "section": "ب",
        }
        pack = build_child_loop(connection, "0500000000", child, xp=12, runs=[])
        self.assertIn("partnership_card", pack)
        self.assertEqual(len(pack["partnership_card"]["steps"]), 4)
        self.assertEqual(len(pack["partnership_card"]["training_links"]), 3)
        self.assertIn("أتعهد", pack["pledge"]["button_label"])
        self.assertEqual(pack["partnership_card"]["evidence_code"], EVIDENCE_CODE)

        # تعهد مباشر في الجدول
        connection.execute(
            """
            INSERT INTO portal_family_pact(
              parent_phone, student_nid, signed_name, signed_at, evidence_code, pledge_kind, pledge_text
            ) VALUES ('0500000000','401','ولي أمر','2026-01-01T00:00:00','1-3-1-2','home-support','تعهد')
            """
        )
        connection.execute(
            """
            INSERT INTO portal_home_mock_packs(student_nid, pack_json, created_at, acknowledged_at, parent_name)
            VALUES ('401','{}','2026-01-01T00:00:00','2026-01-02T00:00:00','ولي أمر')
            """
        )
        connection.execute(
            """
            INSERT INTO teacher_remedial(national_id, subject, student_id, skill, plan, status, source, grade_root)
            VALUES ('1011057906','رياضيات','401','الجبر','خطة','مفتوح','vault-clinic-v1','٢م')
            """
        )
        pack2 = build_child_loop(connection, "0500000000", child, xp=12, runs=[{"score_pct": 80}])
        self.assertTrue(pack2["pledge"]["signed"])
        self.assertTrue(pack2["omr"]["acknowledged"])
        self.assertGreaterEqual(pack2["open_clinics"], 1)
        self.assertEqual(pack2["loop_progress"]["parts"]["pledge"], True)
        self.assertEqual(pack2["loop_progress"]["parts"]["omr"], True)
        connection.close()

    def test_routes_registered(self):
        from Core_Engine.app import app

        paths = set(app.openapi()["paths"])
        for p in (
            "/api/portal/parent/family-loop",
            "/api/portal/parent/pledge",
            "/api/portal/parent/omr-review",
            "/api/portal/parent/evidence/1-3-1-2",
            "/api/portal/parent/home",
            "/api/portal/parent/home-mock/ack",
            "/api/portal/parent/family-weekly",
        ):
            self.assertIn(p, paths)


if __name__ == "__main__":
    unittest.main()
