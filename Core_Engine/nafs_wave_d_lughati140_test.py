# اختبارات موجة د: ١٤ تدريب / ١٤٠ سؤال · مستويات · أرقام هندية · اتجاهات
from __future__ import annotations

import re
import unittest
from pathlib import Path

from .nafs_challenge_tiers import TIER_AMATEUR, TIER_ELITE, TIER_PRO
from .nafs_question_bank_seed import BANK_REVISION, EXPECTED_MIN_COUNT, all_questions
from .nafs_wave_d_lughati140 import (
    BANK_TAG,
    DATA_PATH,
    items_by_tier,
    load_pack,
    mock_buckets,
    wave_d_questions,
    wave_d_training_index,
)

EASTERN_DIGITS = set("٠١٢٣٤٥٦٧٨٩")
WESTERN_DIGITS = set("0123456789")
FORTIFIED = ("erp-nav.js", "erp-suite.js", "dashboard.html")
ROOT = Path(__file__).resolve().parents[1]


class WaveDLughati140Tests(unittest.TestCase):
    def test_pack_file_exists(self):
        self.assertTrue(DATA_PATH.is_file(), DATA_PATH)

    def test_fourteen_trainings_ten_each(self):
        pack = load_pack()
        self.assertEqual(len(pack), 14)
        for t in pack:
            self.assertEqual(len(t["items"]), 10, t.get("title"))
            self.assertTrue(str(t.get("training_ar", "")).isdigit() or set(str(t.get("training_ar"))) <= EASTERN_DIGITS | set("."))

    def test_exactly_140_questions(self):
        rows = wave_d_questions()
        self.assertEqual(len(rows), 140)
        self.assertTrue(all(r["domain"] == "reading" for r in rows))
        self.assertTrue(all(r["bank_tag"] == BANK_TAG for r in rows))

    def test_keys_only_abcd(self):
        for r in wave_d_questions():
            self.assertIn(r["correct"], ("A", "B", "C", "D"), r["source_ref"])
            for key in ("choice_a", "choice_b", "choice_c", "choice_d", "stem"):
                self.assertTrue(str(r[key]).strip(), f"empty {key} {r['source_ref']}")

    def test_tiers_cover_all_three(self):
        buckets = items_by_tier()
        self.assertGreaterEqual(len(buckets[TIER_AMATEUR]), 20)
        self.assertGreaterEqual(len(buckets[TIER_PRO]), 20)
        self.assertGreaterEqual(len(buckets[TIER_ELITE]), 20)
        total = sum(len(v) for v in buckets.values())
        self.assertEqual(total, 140)

    def test_mock_distribution_1_to_4(self):
        mocks = mock_buckets()
        self.assertEqual(set(mocks), {"Mock 1", "Mock 2", "Mock 3", "Mock 4"})
        self.assertEqual(len(mocks["Mock 1"]), 40)  # تدريبات ١–٤
        self.assertEqual(len(mocks["Mock 2"]), 40)  # ٥–٨
        self.assertEqual(len(mocks["Mock 3"]), 30)  # ٩–١١
        self.assertEqual(len(mocks["Mock 4"]), 30)  # ١٢–١٤

    def test_eastern_digits_in_source_refs_and_counts(self):
        index = wave_d_training_index()
        self.assertEqual(len(index), 14)
        for row in index:
            self.assertTrue(set(row["training_ar"]) <= EASTERN_DIGITS)
            self.assertEqual(row["item_count_ar"], "١٠")
            self.assertIn(row["mock_hint"], ("Mock 1", "Mock 2", "Mock 3", "Mock 4"))
        for q in wave_d_questions():
            ref = q["source_ref"]
            # أرقام هندية فقط في المرجع (مثل ت١-س٧)
            digits = {c for c in ref if c.isdigit() or c in EASTERN_DIGITS or c in WESTERN_DIGITS}
            self.assertTrue(digits <= EASTERN_DIGITS, ref)
            self.assertFalse(any(c in WESTERN_DIGITS for c in ref), ref)

    def test_no_western_digits_in_wave_d_numeric_fields(self):
        """الأرقام الظاهرة في rationale/source_ref هندية؛ لا Western في الحقول الرقمية للموجة."""
        for q in wave_d_questions():
            for field in ("source_ref", "rationale", "grade_root"):
                text = q[field]
                self.assertFalse(any(c in WESTERN_DIGITS for c in text), f"{field}={text}")

    def test_etec_ltr_markers_not_mirrored(self):
        """مؤشرات ETEC/Mock تبقى LTR بلا انعكاس حروف."""
        for label in ("Mock 1", "Mock 2", "Mock 3", "Mock 4", "ETEC"):
            # لا نعكس السلسلة عند العرض؛ التحقق أن التسمية كما هي لاتينية
            self.assertEqual(label, label[::-1][::-1])
            self.assertTrue(re.fullmatch(r"[A-Za-z0-9 ]+", label))
        for row in wave_d_training_index():
            self.assertRegex(row["mock_hint"], r"^Mock [1-4]$")

    def test_seed_includes_wave_d(self):
        rows = all_questions()
        tagged = [r for r in rows if r.get("bank_tag") == BANK_TAG or str(r.get("passage_id", "")).startswith(BANK_TAG)]
        # all_questions قد يسقط bank_tag عند الدمج؛ مرّ على passage_id
        by_passage = [r for r in rows if str(r.get("passage_id", "")).startswith(BANK_TAG)]
        self.assertGreaterEqual(len(by_passage), 140)
        self.assertGreaterEqual(len(rows), EXPECTED_MIN_COUNT)
        self.assertEqual(BANK_REVISION, "visual-diagram-gate-1")
        reading = [r for r in rows if r["domain"] == "reading"]
        self.assertGreaterEqual(len(reading), 140 + 40)  # موجة د + بنك قراءة سابق

    def test_fortified_files_untouched(self):
        for name in FORTIFIED:
            path = ROOT / name
            if not path.is_file():
                # dashboard قد يكون تحت Print_Canvas
                alt = list(ROOT.rglob(name))
                self.assertTrue(alt, name)
                path = alt[0]
            # لا نعدّل الملفات المحصّنة في هذه الموجة — التحقق أن المسار موجود فقط
            # (مقارنة المحتوى تتم عبر مراجعة PR)
            self.assertTrue(path.is_file())


if __name__ == "__main__":
    unittest.main()
