# اختبار دخان — المرحلة ٥: هدف الأسبوع + أرشيف ETEC + تصدير Word.
from __future__ import annotations

import sqlite3
import unittest


class WeeklyEtecSmokeTests(unittest.TestCase):
    def _conn(self):
        connection = sqlite3.connect(":memory:")
        connection.executescript(
            """
            CREATE TABLE noor_students(
              national_id TEXT PRIMARY KEY, name TEXT, grade TEXT, classroom TEXT
            );
            INSERT INTO noor_students VALUES ('601','طلال تجريبي','الثالث متوسط','أ');
            CREATE TABLE portal_challenge_runs(
              id INTEGER PRIMARY KEY, student_nid TEXT, mode TEXT,
              score_pct REAL, xp_earned INTEGER, finished_at TEXT
            );
            INSERT INTO portal_challenge_runs VALUES
              (1,'601','daily',88,40,'2026-11-20T10:00:00'),
              (2,'601','mock',72,30,'2026-11-25T10:00:00');
            CREATE TABLE teacher_remedial(
              id INTEGER PRIMARY KEY, national_id TEXT, subject TEXT, student_id TEXT,
              skill TEXT, plan TEXT, status TEXT, source TEXT, grade_root TEXT,
              follow_up_date TEXT DEFAULT ''
            );
            INSERT INTO teacher_remedial VALUES
              (1,'101','رياضيات','601','كسور','خطة','مفتوح','vault-clinic-v1','٢م','');
            CREATE TABLE portal_family_pact(
              id INTEGER PRIMARY KEY, parent_phone TEXT, student_nid TEXT,
              signed_name TEXT, signed_at TEXT, evidence_code TEXT,
              pledge_kind TEXT DEFAULT 'pact', pledge_text TEXT DEFAULT ''
            );
            INSERT INTO portal_family_pact(parent_phone, student_nid, signed_name, signed_at, evidence_code)
            VALUES ('0500000001','601','ولي','2026-11-01T00:00:00','1-3-1-2');
            CREATE TABLE portal_home_mock_packs(
              id INTEGER PRIMARY KEY, student_nid TEXT, pack_json TEXT,
              created_at TEXT, acknowledged_at TEXT, parent_name TEXT
            );
            INSERT INTO portal_home_mock_packs VALUES
              (1,'601','{}','2026-11-01','2026-11-02','ولي');
            CREATE TABLE portal_behavior_points(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              student_nid TEXT, program TEXT, points INTEGER, note TEXT, created_at TEXT
            );
            INSERT INTO portal_behavior_points(student_nid, program, points, note, created_at)
            VALUES ('601','قدوة',2,'تميز','2026-11-20'), ('601','رفق',1,'التزام','2026-11-21');
            CREATE TABLE portal_family_weekly(
              id INTEGER PRIMARY KEY, parent_phone TEXT, student_nid TEXT, week_key TEXT,
              checks_json TEXT, note TEXT, updated_at TEXT,
              UNIQUE(parent_phone, student_nid, week_key)
            );
            """
        )
        return connection

    def test_week_goal_teacher_student(self):
        from .nafs_weekly_etec import build_week_goal, enrich_week
        from .nafs_unit2_ssot import WEEKLY_PLAN_8

        pack = build_week_goal()
        self.assertEqual(len(pack["weeks"]), 8)
        self.assertTrue(1 <= pack["current_week"] <= 8)
        self.assertIn("تركيز الأسبوع", pack["teacher_goal"])
        self.assertIn("هدف أسبوعك", pack["student_goal"])
        self.assertFalse(pack["schedule_engine"]["manual_weekly_edit"])
        self.assertEqual(pack["school"]["stat_no"], "40341")
        enriched = enrich_week(WEEKLY_PLAN_8[6])  # week 7 mock
        self.assertTrue(enriched["is_mock_week"])
        self.assertIn("NAFS-40341-W07", enriched["barcode"])

    def test_etec_archive_and_refresh(self):
        from .nafs_adaptive_engine import ensure_on_boot as ensure_adaptive
        from .nafs_weekly_etec import build_etec_archive, ensure_weekly_etec, refresh_etec_archive
        from .visual_evidence import ensure_visual_evidence_table

        connection = self._conn()
        ensure_adaptive(connection)
        ensure_visual_evidence_table(connection)
        ensure_weekly_etec(connection)
        connection.execute(
            """
            INSERT INTO student_error_vault(
              student_nid, question_id, domain, skill, chosen, correct,
              trap_heat, status, streak_ok, last_seen, grade_root
            ) VALUES ('601', 3, 'math', 'كسور', 'B', 'A', 2, 'open', 0, '2026-11-25', '٢م')
            """
        )
        pack = build_etec_archive(connection)
        self.assertIn("3-1-1-2", pack["indicators"])
        self.assertEqual(pack["indicators"]["3-1-1-2"]["code_ar"], "٣-١-١-٢")
        self.assertGreaterEqual(pack["summary"]["nafs_runs_total"], 2)
        self.assertGreaterEqual(pack["indicators"]["1-3-1-2"]["pledges"], 1)
        self.assertGreaterEqual(pack["indicators"]["2-1-1-5"]["qodwa"], 2)
        result = refresh_etec_archive(connection, actor_name="اختبار")
        self.assertGreaterEqual(result["count"], 5)
        logs = connection.execute("SELECT COUNT(*) FROM portal_etec_archive_log").fetchone()[0]
        self.assertGreaterEqual(int(logs), 5)
        evidence = connection.execute(
            "SELECT COUNT(*) FROM visual_evidence WHERE register_key = 'nafs-etec-archive'"
        ).fetchone()[0]
        self.assertGreaterEqual(int(evidence), 5)
        connection.close()

    def test_docx_kinds(self):
        from .nafs_weekly_etec import build_official_docx

        for kind in ("weekly", "matrix", "evidence", "workbook"):
            buf, filename = build_official_docx(kind=kind)
            data = buf.read()
            self.assertGreater(len(data), 1000)
            self.assertTrue(filename.endswith(".docx"))
            self.assertIn("40341", filename)

    def test_routes_registered(self):
        from Core_Engine.app import app

        paths = set(app.openapi()["paths"])
        for p in (
            "/api/session/nafs/week-goal",
            "/api/portal/week-goal",
            "/api/session/nafs/etec-archive",
            "/api/session/nafs/etec-archive/refresh",
            "/api/session/nafs/export-docx",
            "/api/session/nafs/weekly-plan",
        ):
            self.assertIn(p, paths)


if __name__ == "__main__":
    unittest.main()
