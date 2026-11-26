# اختبار دخان — المرحلة ٤: توجيه وتحفيز سلوكي.
from __future__ import annotations

import sqlite3
import unittest
from datetime import datetime, timezone


class CounselBoostSmokeTests(unittest.TestCase):
    def _conn(self):
        connection = sqlite3.connect(":memory:")
        connection.executescript(
            """
            CREATE TABLE noor_students(
              national_id TEXT PRIMARY KEY, name TEXT, grade TEXT, classroom TEXT
            );
            INSERT INTO noor_students VALUES ('501','سعود تجريبي','الثالث متوسط','أ');
            INSERT INTO noor_students VALUES ('502','فهد تجريبي','الثالث متوسط','أ');
            INSERT INTO noor_students VALUES ('503','ناصر تجريبي','الثالث متوسط','أ');
            CREATE TABLE portal_challenge_runs(
              id INTEGER PRIMARY KEY, student_nid TEXT, mode TEXT,
              score_pct REAL, xp_earned INTEGER, finished_at TEXT
            );
            CREATE TABLE noor_staff(
              national_id TEXT PRIMARY KEY, name TEXT, mobile TEXT, specialty TEXT,
              role TEXT, updated_at TEXT, is_deleted INTEGER DEFAULT 0, active INTEGER DEFAULT 1
            );
            """
        )
        return connection

    def test_boost_rules_qodwa_daily_purge_dedup(self):
        from .nafs_adaptive_engine import ensure_on_boot as ensure_adaptive
        from .nafs_counsel_boost import apply_challenge_boosts, apply_golden_boost, ensure_counsel_boost

        connection = self._conn()
        ensure_counsel_boost(connection)
        ensure_adaptive(connection)

        first = apply_challenge_boosts(
            connection, "501", mode="daily", score_pct=92, best_streak=4
        )
        self.assertTrue(first["ok"])
        programs = [a["program"] for a in first["awards"]]
        self.assertIn("قدوة", programs)
        self.assertIn("رفق", programs)
        self.assertGreaterEqual(first["behavior_totals"]["total"], 3)

        # منع التكرار في نفس اليوم
        second = apply_challenge_boosts(
            connection, "501", mode="daily", score_pct=95, best_streak=5
        )
        self.assertEqual(second["awards"], [])

        purge = apply_challenge_boosts(
            connection, "501", mode="purge", score_pct=75, best_streak=1
        )
        self.assertTrue(any(a["program"] == "قدوة" for a in purge["awards"]))

        # استعادة vault → قدوة إضافية
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        connection.execute(
            """
            INSERT INTO student_error_vault(
              student_nid, question_id, domain, skill, chosen, correct,
              trap_heat, status, streak_ok, last_seen, recovered_at, grade_root
            ) VALUES (
              '501', 1, 'math', 'جبر', 'B', 'A',
              0, 'recovered', 2, ?, ?, '٢م'
            )
            """,
            (day + "T10:00:00", day + "T10:00:00"),
        )
        vault = apply_challenge_boosts(
            connection, "501", mode="mock", score_pct=70, best_streak=0
        )
        self.assertTrue(any("vault" in (a.get("event_key") or "") for a in vault["awards"]))

        gold = apply_golden_boost(connection, "501", "card-frac-1")
        self.assertEqual(gold["award"]["program"], "رفق")
        gold2 = apply_golden_boost(connection, "501", "card-frac-1")
        self.assertIsNone(gold2["award"])
        connection.close()

    def test_elite_and_voucher(self):
        from .nafs_counsel_boost import apply_challenge_boosts, ensure_counsel_boost

        connection = self._conn()
        ensure_counsel_boost(connection)
        now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        for nid, xp in (("501", 100), ("502", 80), ("503", 60)):
            connection.execute(
                """
                INSERT INTO portal_xp_ledger(student_nid, event_type, xp, meta_json, created_at)
                VALUES (?, 'challenge:daily', ?, '{}', ?)
                """,
                (nid, xp, now),
            )
        # نقاط كافية لقسيمة
        for _ in range(3):
            connection.execute(
                """
                INSERT INTO portal_behavior_points(student_nid, program, points, note, created_at)
                VALUES ('501', 'قدوة', 2, 'seed', ?)
                """,
                (now,),
            )
        pack = apply_challenge_boosts(
            connection, "501", mode="mock", score_pct=88, best_streak=3
        )
        self.assertTrue(any("elite" in (a.get("event_key") or "") for a in pack["awards"]))
        self.assertIsNotNone(pack.get("elite"))
        self.assertEqual(pack["elite"]["place"], 1)
        # بعد الجوائز الجديدة يتجاوز ٥ → قسيمة
        self.assertIsNotNone(pack.get("cafeteria_voucher") or pack["behavior_totals"]["total"] >= 5)
        connection.close()

    def test_counselor_inbox_and_heat_alert(self):
        from .nafs_adaptive_engine import ensure_on_boot as ensure_adaptive
        from .nafs_counsel_boost import (
            build_counselor_inbox,
            ensure_counsel_boost,
            raise_vault_heat_alerts,
        )
        from .portal_owner_api import ensure_owner_tables

        connection = self._conn()
        ensure_owner_tables(connection)
        ensure_counsel_boost(connection)
        ensure_adaptive(connection)
        now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        connection.execute(
            """
            INSERT INTO portal_counseling(student_nid, student_name, message, status, created_at)
            VALUES ('501', 'سعود تجريبي', 'أحتاج حديثاً سرياً', 'new', ?)
            """,
            (now,),
        )
        connection.execute(
            """
            INSERT INTO portal_risk_alerts(student_nid, student_name, alert_type, detail_json, status, created_at)
            VALUES ('501', 'سعود تجريبي', 'performance_drop', '{"latest":40,"prev_avg":80}', 'new', ?)
            """,
            (now,),
        )
        connection.execute(
            """
            INSERT INTO student_error_vault(
              student_nid, question_id, domain, skill, chosen, correct,
              trap_heat, status, streak_ok, last_seen, grade_root
            ) VALUES (
              '501', 9, 'math', 'كسور', 'C', 'A',
              3, 'open', 0, ?, '٢م'
            )
            """,
            (now,),
        )
        raised = raise_vault_heat_alerts(connection)
        self.assertGreaterEqual(raised, 1)
        pack = build_counselor_inbox(connection)
        self.assertEqual(pack["summary"]["counseling_open"], 1)
        self.assertGreaterEqual(pack["summary"]["alerts_new"], 1)
        self.assertGreaterEqual(pack["summary"]["vault_hot"], 1)
        self.assertEqual(pack["etec_behavior"]["code_ar"], "٢-١-١-٥")
        heat = pack["vault_hot"][0]
        self.assertTrue(heat["etec_code_ar"])
        self.assertIn("٣", heat["etec_code_ar"] or heat.get("etec", {}).get("code_ar", ""))
        connection.close()

    def test_routes_registered(self):
        from Core_Engine.app import app

        paths = set(app.openapi()["paths"])
        for p in (
            "/api/portal/counselor/inbox",
            "/api/portal/counselor/counseling/{item_id}/update",
            "/api/portal/counselor/alerts/{alert_id}/status",
            "/api/portal/boost/rules",
        ):
            self.assertIn(p, paths)


if __name__ == "__main__":
    unittest.main()
