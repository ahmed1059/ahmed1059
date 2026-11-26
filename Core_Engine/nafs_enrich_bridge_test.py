# اختبار دخان — المرحلة ٦: جسر البرامج النوعية والإثراء ومنصات التتويج.
from __future__ import annotations

import sqlite3
import unittest
from datetime import datetime, timezone


class EnrichBridgeSmokeTests(unittest.TestCase):
    def _conn(self):
        now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        connection = sqlite3.connect(":memory:")
        connection.executescript(
            f"""
            CREATE TABLE noor_students(
              national_id TEXT PRIMARY KEY, name TEXT, grade TEXT, classroom TEXT
            );
            INSERT INTO noor_students VALUES
              ('701','ماجد تجريبي','الثالث متوسط','أ'),
              ('702','سامي تجريبي','الثالث متوسط','أ'),
              ('703','بندر تجريبي','الثالث متوسط','ب');
            CREATE TABLE portal_challenge_runs(
              id INTEGER PRIMARY KEY, student_nid TEXT, mode TEXT,
              score_pct REAL, xp_earned INTEGER, finished_at TEXT
            );
            INSERT INTO portal_challenge_runs VALUES
              (1,'701','daily',96,50,'{now}'),
              (2,'701','purge',80,20,'{now}'),
              (3,'702','daily',88,35,'{now}'),
              (4,'703','mock',70,15,'{now}');
            CREATE TABLE portal_xp_ledger(
              id INTEGER PRIMARY KEY, student_nid TEXT, event_type TEXT,
              xp INTEGER, meta_json TEXT, created_at TEXT
            );
            INSERT INTO portal_xp_ledger VALUES
              (1,'701','challenge:daily',50,'{{}}','{now}'),
              (2,'701','game_mental',40,'{{}}','{now}'),
              (3,'701','readalong',35,'{{}}','{now}'),
              (4,'702','challenge:daily',35,'{{}}','{now}');
            CREATE TABLE portal_talent_candidates(
              student_nid TEXT PRIMARY KEY, student_name TEXT, grade TEXT, section TEXT,
              best_score REAL, source_run_id INTEGER, status TEXT, created_at TEXT, updated_at TEXT
            );
            INSERT INTO portal_talent_candidates VALUES
              ('701','ماجد تجريبي','الثالث متوسط','أ',96,1,'nominated','{now}','{now}');
            CREATE TABLE portal_readalong_progress(
              student_nid TEXT, passage_id TEXT, listened INTEGER, score REAL,
              detail_json TEXT, updated_at TEXT,
              PRIMARY KEY(student_nid, passage_id)
            );
            INSERT INTO portal_readalong_progress VALUES
              ('701','p1',1,90,'{{}}','{now}');
            CREATE TABLE portal_risk_alerts(
              id INTEGER PRIMARY KEY, student_nid TEXT, student_name TEXT,
              alert_type TEXT, detail_json TEXT, status TEXT, created_at TEXT
            );
            CREATE TABLE noor_staff(
              national_id TEXT PRIMARY KEY, name TEXT, mobile TEXT, specialty TEXT,
              role TEXT, updated_at TEXT, is_deleted INTEGER DEFAULT 0, active INTEGER DEFAULT 1
            );
            """
        )
        return connection

    def test_evaluate_and_refresh_tracks(self):
        from .nafs_adaptive_engine import ensure_on_boot as ensure_adaptive
        from .nafs_enrich_bridge import (
            PROGRAM_TRACKS,
            build_bridge_pack,
            build_honor_report,
            ensure_enrich_bridge,
            evaluate_student_tracks,
            refresh_bridge,
        )

        connection = self._conn()
        ensure_adaptive(connection)
        ensure_enrich_bridge(connection)

        hits = evaluate_student_tracks(connection, "701")
        keys = {h["track_key"] for h in hits}
        self.assertIn("talent", keys)
        self.assertIn("numbers", keys)
        self.assertIn("reader", keys)
        self.assertTrue(keys & {"enrichment", "talent"})

        result = refresh_bridge(connection, limit_students=50)
        self.assertGreaterEqual(result["written"], 1)
        self.assertEqual(result["school"]["stat_no"], "40341")

        pack = build_bridge_pack(connection)
        self.assertEqual(set(pack["tracks"].keys()), set(PROGRAM_TRACKS.keys()))
        self.assertGreaterEqual(pack["summary"].get("talent", 0), 1)
        talent_items = pack["grouped"]["talent"]
        self.assertTrue(any(i["name"] == "ماجد تجريبي" for i in talent_items))
        self.assertEqual(talent_items[0]["etec_code_ar"], "٣-١-١-٢")

        honor = build_honor_report(connection)
        self.assertTrue(honor["boards"]["day"])
        self.assertIn("HONOR-40341", honor["barcode"])
        self.assertTrue(honor["boards"]["classes_week"] or honor["boards"]["week"])
        connection.close()

    def test_routes_registered(self):
        from Core_Engine.app import app

        paths = set(app.openapi()["paths"])
        for p in (
            "/api/session/nafs/enrich-bridge",
            "/api/session/nafs/enrich-bridge/refresh",
            "/api/session/nafs/honor-report",
            "/api/portal/student/programs",
            "/api/portal/leaderboards",
        ):
            self.assertIn(p, paths)


if __name__ == "__main__":
    unittest.main()
