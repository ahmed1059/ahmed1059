# اختبارات دخان للمحرك التكيّفي والقراءة المتزامنة.
from __future__ import annotations

import sqlite3
import unittest


class AdaptiveReadalongSmokeTests(unittest.TestCase):
    def test_passages_eight(self):
        from .nafs_readalong_data import READALONG_PASSAGES, list_passages_public

        self.assertEqual(len(READALONG_PASSAGES), 8)
        self.assertEqual(len(list_passages_public()), 8)
        for p in READALONG_PASSAGES:
            self.assertGreaterEqual(len(p["sentences"]), 2)
            self.assertEqual(len(p["questions"]), 5)
            self.assertTrue(p["vocab"])

    def test_adaptive_schema_and_vault(self):
        from .nafs_adaptive_engine import (
            ensure_on_boot,
            mastery_index,
            upsert_error_vault,
            vault_summary,
        )

        connection = sqlite3.connect(":memory:")
        # جداول مساندة لمؤشر الإتقان
        connection.executescript(
            """
            CREATE TABLE portal_challenge_runs(
              id INTEGER PRIMARY KEY, student_nid TEXT, finished_at TEXT, score_pct REAL
            );
            """
        )
        self.assertTrue(ensure_on_boot(connection)["ok"])
        q = {
            "id": 11,
            "domain": "math",
            "skill": "الجبر",
            "stem": "٢×٣",
            "common_mistake": "جمع بدل ضرب",
            "golden_rule": "اضرب",
            "wrong_example": "٢+٣=٥",
            "correct_example": "٢×٣=٦",
            "grade_root": "٢م",
        }
        upsert_error_vault(connection, "100", q, "A", "B", False)
        summary_open = vault_summary(connection, "100")
        self.assertGreaterEqual(summary_open["open_count"], 1)
        open_rows = summary_open.get("items") or []
        self.assertTrue(open_rows)
        self.assertEqual(open_rows[0].get("grade_root"), "٢م")
        upsert_error_vault(connection, "100", q, "B", "B", True)
        upsert_error_vault(connection, "100", q, "B", "B", True)
        summary = vault_summary(connection, "100")
        self.assertEqual(summary["recovered_count"], 1)
        pack = mastery_index(connection, "100")
        self.assertIn("math", pack["domains"])
        connection.close()

    def test_teacher_peek_by_root(self):
        from .nafs_adaptive_engine import ensure_on_boot, teacher_peek, upsert_error_vault

        connection = sqlite3.connect(":memory:")
        connection.executescript(
            """
            CREATE TABLE noor_students(
              national_id TEXT PRIMARY KEY,
              name TEXT,
              grade TEXT,
              classroom TEXT
            );
            INSERT INTO noor_students VALUES ('200','طالب تجريبي','الثالث متوسط','أ');
            """
        )
        ensure_on_boot(connection)
        upsert_error_vault(
            connection,
            "200",
            {
                "id": 22,
                "domain": "math",
                "skill": "الأعداد",
                "stem": "نسبة",
                "common_mistake": "عكس النسبة",
                "golden_rule": "احفظ الترتيب",
                "grade_root": "١م",
            },
            "A",
            "C",
            False,
        )
        pack = teacher_peek(connection, grade="ثالث", section="أ", limit=10)
        self.assertTrue(pack["ok"])
        self.assertGreaterEqual(pack["count"], 1)
        self.assertIn("١م", pack["by_root"])
        self.assertEqual(pack["items"][0]["grade_root"], "١م")
        self.assertEqual(pack["items"][0]["status_ar"], "يحتاج تطهيراً")
        connection.close()

    def test_routes_registered(self):
        from Core_Engine.app import app

        paths = set(app.openapi()["paths"])
        for p in (
            "/api/portal/error-vault",
            "/api/portal/mastery-index",
            "/api/portal/home-mock/pack",
            "/api/portal/parent/home-mock",
            "/api/portal/readalong/passages",
            "/api/portal/readalong/passages/{passage_id}",
            "/api/portal/readalong/finish",
            "/api/portal/teacher/peek",
            "/api/portal/challenge/check",
            "/api/portal/misconceptions/rescue",
        ):
            self.assertIn(p, paths)


if __name__ == "__main__":
    unittest.main()
