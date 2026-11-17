# -*- coding: utf-8 -*-
import csv
import unittest
from pathlib import Path

OUT = Path(__file__).resolve().parents[1]


class TestInventory(unittest.TestCase):
    def setUp(self):
        self.path = OUT / "01_inventory.csv"
        self.rows = list(csv.DictReader(self.path.open(encoding="utf-8-sig")))

    def test_row_count_565(self):
        self.assertEqual(len(self.rows), 565)

    def test_required_columns(self):
        cols = set(self.rows[0].keys())
        for c in ("رقم", "العنوان", "layer", "fillable"):
            self.assertIn(c, cols)

    def test_operational_560(self):
        op = sum(1 for r in self.rows if r.get("layer") == "operational")
        self.assertEqual(op, 560)


if __name__ == "__main__":
    unittest.main()
