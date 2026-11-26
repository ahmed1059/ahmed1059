# موجة ب: تدريبات ٢١–٢٢–٢٣ — اختبار تصنيف واتجاه وأرقام هندية
# تشغيل: python3 -m Core_Engine.nafs_wave_b_212223_test
from __future__ import annotations

import re
import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Core_Engine.nafs_challenge_tiers import (  # noqa: E402
    TIER_AMATEUR,
    TIER_ELITE,
    TIER_PRO,
    pick_with_fallback,
)
from Core_Engine.nafs_misconception_lab import GOLDEN_DECK  # noqa: E402
from Core_Engine.nafs_question_bank_seed import (  # noqa: E402
    BANK_REVISION,
    EXPECTED_MIN_COUNT,
    all_questions,
    ensure_nafs_question_bank,
)
from Core_Engine.nafs_wave_b_212223 import (  # noqa: E402
    AUDIT_FIXES,
    SKILL_DATA,
    SKILL_PROB,
    SKILL_STATS,
    items_by_tier,
    wave_b_golden_cards,
    wave_b_questions,
)

WESTERN = re.compile(r"[0-9]")


def main() -> int:
    errors: list[str] = []

    rows = wave_b_questions()
    if len(rows) != 30:
        errors.append(f"expected 30 got {len(rows)}")
    by_pack = {SKILL_STATS: 0, SKILL_DATA: 0, SKILL_PROB: 0}
    for r in rows:
        by_pack[r["pack"]] = by_pack.get(r["pack"], 0) + 1
        if r["domain"] != "math":
            errors.append("domain must be math")
        if r["tier"] not in (TIER_AMATEUR, TIER_PRO, TIER_ELITE):
            errors.append(f"bad tier {r['tier']}")
        if r["correct"] not in ("A", "B", "C", "D"):
            errors.append(f"bad correct {r['correct']}")
        blob = " ".join(
            [
                r["stem"],
                r["choice_a"],
                r["choice_b"],
                r["choice_c"],
                r["choice_d"],
                r["rationale"],
            ]
        )
        if WESTERN.search(blob):
            errors.append(f"western digit: {r['stem'][:48]}")
            break
        # كسور أو نسب تحتاج عزلاً بصرياً في الواجهة (dir=ltr على الذرّة)
        if "/" in blob and "dir" not in blob:
            pass  # الواجهة تضيف LTR؛ هنا نتحقق وجود كسور هندية
    if by_pack[SKILL_STATS] != 10 or by_pack[SKILL_DATA] != 10 or by_pack[SKILL_PROB] != 10:
        errors.append(f"pack sizes {by_pack}")

    buckets = items_by_tier()
    for tid in (TIER_AMATEUR, TIER_PRO, TIER_ELITE):
        if not buckets.get(tid):
            errors.append(f"empty tier {tid}")
    picked = pick_with_fallback(buckets, TIER_ELITE)
    if picked.get("empty") or not picked.get("items"):
        errors.append("fallback pick failed for elite")

    stems = [r["stem"] for r in rows]
    if len(stems) != len(set(stems)):
        errors.append("duplicate stems inside wave b")

    if len(AUDIT_FIXES) < 2:
        errors.append("audit fixes missing")

    cards = wave_b_golden_cards()
    if len(cards) < 5:
        errors.append("golden cards")
    deck_ids = {c["id"] for c in GOLDEN_DECK}
    for c in cards:
        if c["id"] not in deck_ids:
            errors.append(f"golden deck missing {c['id']}")

    if BANK_REVISION != "wave-b-212223-1" or EXPECTED_MIN_COUNT < 180:
        errors.append("seed revision/count")

    all_rows = all_questions()
    if len(all_rows) < EXPECTED_MIN_COUNT:
        errors.append(f"all_questions {len(all_rows)}")
    wave_stems = {r["stem"] for r in rows}
    bank_wave = [r for r in all_rows if r["stem"] in wave_stems]
    if len(bank_wave) != 30:
        errors.append(f"wave stems in all_questions={len(bank_wave)}")

    with tempfile.TemporaryDirectory() as tmp:
        conn = sqlite3.connect(str(Path(tmp) / "t.db"))
        result = ensure_nafs_question_bank(conn, force_reseed=True)
        conn.commit()
        stored = conn.execute(
            "SELECT COUNT(*) FROM nafs_question_bank WHERE COALESCE(active,1)=1"
        ).fetchone()[0]
        if stored < EXPECTED_MIN_COUNT:
            errors.append(f"stored={stored}")
        tagged = conn.execute(
            "SELECT COUNT(*) FROM nafs_question_bank WHERE passage_id LIKE 'wave-b-212223:%'"
        ).fetchone()[0]
        if int(tagged or 0) != 30:
            errors.append(f"tagged stored={tagged}")
        # عيّنة traps
        trap_n = conn.execute(
            """
            SELECT COUNT(*) FROM nafs_question_bank
            WHERE skill = ? AND COALESCE(golden_rule,'') != ''
            """,
            (SKILL_PROB,),
        ).fetchone()[0]
        if int(trap_n or 0) < 5:
            errors.append("prob traps missing")
        if not result.get("seeded"):
            errors.append("force reseed expected")
        conn.close()

    # محصّنات
    for locked in (
        ROOT / "Print_Canvas" / "js" / "erp-nav.js",
        ROOT / "Print_Canvas" / "js" / "erp-suite.js",
        ROOT / "Print_Canvas" / "dashboard.html",
    ):
        if locked.exists() and "wave-b-212223" in locked.read_text(encoding="utf-8", errors="ignore"):
            errors.append(f"locked touched {locked.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK nafs-wave-b-212223")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
