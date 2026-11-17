# -*- coding: utf-8 -*-
import csv
import unittest
from pathlib import Path

OUT = Path(__file__).resolve().parents[1]


class TestCommittees(unittest.TestCase):
    def test_bodies_15(self):
        rows = list(csv.DictReader((OUT / "05_committee_structure.csv").open(encoding="utf-8-sig")))
        self.assertEqual(len(rows), 15)

    def test_role_map_57(self):
        rows = list(csv.DictReader((OUT / "05_role_map.csv").open(encoding="utf-8-sig")))
        self.assertEqual(len(rows), 57)

    def test_gaps_30(self):
        rows = list(csv.DictReader((OUT / "05_gaps.csv").open(encoding="utf-8-sig")))
        self.assertEqual(len(rows), 30)

    def test_base_index_6(self):
        rows = list(csv.DictReader((OUT / "05a_base_index.csv").open(encoding="utf-8-sig")))
        self.assertEqual(len(rows), 6)
        layers = {r["layer"] for r in rows}
        self.assertEqual(layers, {"A", "B", "C"})
        self.assertTrue(all(r.get("source") for r in rows))
        gifted = next(r for r in rows if r["entity_id"] == "ENT-016")
        self.assertEqual(gifted["entity_type"], "track")


if __name__ == "__main__":
    unittest.main()
