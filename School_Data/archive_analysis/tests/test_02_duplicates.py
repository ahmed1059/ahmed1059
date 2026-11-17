# -*- coding: utf-8 -*-
import csv
import unittest
from pathlib import Path

OUT = Path(__file__).resolve().parents[1]


class TestDuplicates(unittest.TestCase):
    def test_pairs_441(self):
        rows = list(csv.DictReader((OUT / "02_duplicates.csv").open(encoding="utf-8-sig")))
        self.assertEqual(len(rows), 441)

    def test_groups_37(self):
        rows = list(csv.DictReader((OUT / "02_groups.csv").open(encoding="utf-8-sig")))
        self.assertEqual(len(rows), 37)

    def test_unique_members_150(self):
        rows = list(csv.DictReader((OUT / "02_groups.csv").open(encoding="utf-8-sig")))
        ids = set()
        for r in rows:
            for x in (r.get("الأعضاء") or "").split(";"):
                if x.strip():
                    ids.add(x.strip())
        self.assertEqual(len(ids), 150)


if __name__ == "__main__":
    unittest.main()
