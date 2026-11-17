# -*- coding: utf-8 -*-
import csv
import unittest
from pathlib import Path

OUT = Path(__file__).resolve().parents[1]


class TestIndicators(unittest.TestCase):
    def setUp(self):
        self.rows = list(csv.DictReader((OUT / "03_indicators.csv").open(encoding="utf-8-sig")))

    def test_rows_560(self):
        self.assertEqual(len(self.rows), 560)

    def test_distribution_21_44_495(self):
        real = sum(1 for r in self.rows if r.get("link_source") == "real")
        inferred = sum(1 for r in self.rows if r.get("inferred") == "true")
        none = sum(1 for r in self.rows if r.get("link_source") == "لا يوجد")
        self.assertEqual(real, 21)
        self.assertEqual(inferred, 44)
        self.assertEqual(none, 495)

    def test_evidence_type_column(self):
        self.assertIn("evidence_type", self.rows[0])
        self.assertIn("confidence_final", self.rows[0])


if __name__ == "__main__":
    unittest.main()
