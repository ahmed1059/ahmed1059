# اختبارات دخان للوحدة الثانية: ألعاب + مصفوفة + خطة أسبوعية.
from __future__ import annotations

import unittest

from .nafs_unit2_ssot import FAMILY_CHECKLIST, SKILLS_MATRIX, WEEKLY_PLAN_8, ensure_on_boot as ensure_unit2
from .portal_games_api import WORD_BANK, _mental_item, ensure_on_boot


class Unit2SmokeTests(unittest.TestCase):
    def test_word_bank_and_mental(self):
        self.assertGreaterEqual(len(WORD_BANK), 10)
        item = _mental_item(1)
        self.assertIn(item["correct"], item["choices"])
        self.assertEqual(len(item["choices"]), 4)

    def test_matrix_and_weeks(self):
        self.assertEqual(set(SKILLS_MATRIX), {"math", "science", "reading"})
        self.assertEqual(len(WEEKLY_PLAN_8), 8)
        self.assertEqual(len(FAMILY_CHECKLIST), 4)
        self.assertEqual(WEEKLY_PLAN_8[0]["week"], 1)

    def test_schema_boot(self):
        import sqlite3

        connection = sqlite3.connect(":memory:")
        self.assertTrue(ensure_on_boot(connection)["ok"])
        self.assertTrue(ensure_unit2(connection)["ok"])
        tables = {
            r[0]
            for r in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        self.assertIn("portal_presence", tables)
        self.assertIn("portal_live_duels", tables)
        self.assertIn("portal_game_runs", tables)
        self.assertIn("portal_family_weekly", tables)
        connection.close()


if __name__ == "__main__":
    unittest.main()
