# -*- coding: utf-8 -*-
"""تحقق: لا مسارات Windows مطلقة في سكربتات التشغيل الرئيسية."""
import re
import unittest
from pathlib import Path

OUT = Path(__file__).resolve().parents[1]
ABS_RE = re.compile(r"C:\\\\Users\\\\Toshiba|Path\(r?[\"']C:")

SCRIPTS = [
    "_build_01_inventory.py",
    "_enrich_01_inventory.py",
    "_run_02_duplicates.py",
    "_run_03_indicators.py",
    "_run_04_person_tasks.py",
    "_run_05_committees.py",
    "config.py",
    "run_all.py",
]


class TestNoAbsolutePaths(unittest.TestCase):
    def test_main_scripts_clean(self):
        offenders = []
        for name in SCRIPTS:
            text = (OUT / name).read_text(encoding="utf-8")
            if ABS_RE.search(text):
                offenders.append(name)
        self.assertEqual(offenders, [], msg=f"مسارات مطلقة متبقية: {offenders}")


if __name__ == "__main__":
    unittest.main()
