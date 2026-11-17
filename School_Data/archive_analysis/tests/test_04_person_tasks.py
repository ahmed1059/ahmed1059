# -*- coding: utf-8 -*-
import csv
import unittest
from pathlib import Path

OUT = Path(__file__).resolve().parents[1]


class TestPersonTasks(unittest.TestCase):
    def test_cards_10(self):
        rows = list(csv.DictReader((OUT / "04_person_task_cards.csv").open(encoding="utf-8-sig")))
        self.assertEqual(len(rows), 10)

    def test_identity_extension_27(self):
        rows = list(csv.DictReader((OUT / "04_identity_extension.csv").open(encoding="utf-8-sig")))
        self.assertEqual(len(rows), 27)

    def test_orphan_tasks_245(self):
        rows = list(csv.DictReader((OUT / "04_orphan_tasks.csv").open(encoding="utf-8-sig")))
        self.assertEqual(len(rows), 245)


if __name__ == "__main__":
    unittest.main()
