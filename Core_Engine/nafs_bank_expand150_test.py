# اختبار توسيع بنك نافس إلى ١٥٠+ — تشغيل: python3 -m Core_Engine.nafs_bank_expand150_test
from __future__ import annotations

import sqlite3
import sys
import tempfile
from pathlib import Path


def main() -> int:
    errors: list[str] = []
    from .nafs_question_bank_expand150 import expand_questions
    from .nafs_question_bank_seed import (
        BANK_REVISION,
        EXPECTED_MIN_COUNT,
        all_questions,
        ensure_nafs_question_bank,
    )

    expanded = expand_questions()
    if len(expanded) != 75:
        errors.append(f"expand count={len(expanded)}")
    rows = all_questions()
    if len(rows) < EXPECTED_MIN_COUNT:
        errors.append(f"all_questions={len(rows)} < {EXPECTED_MIN_COUNT}")
    stems = [(r["domain"], r["stem"]) for r in rows]
    if len(stems) != len(set(stems)):
        errors.append("duplicate stems detected")
    by_domain = {"math": 0, "reading": 0, "science": 0}
    correct_dist = {"A": 0, "B": 0, "C": 0, "D": 0}
    for r in rows:
        by_domain[r["domain"]] = by_domain.get(r["domain"], 0) + 1
        correct_dist[str(r["correct"]).upper()] = correct_dist.get(str(r["correct"]).upper(), 0) + 1
    for key in ("math", "reading", "science"):
        if by_domain[key] < 50:
            errors.append(f"{key} only {by_domain[key]}")
    if min(correct_dist.values()) < 1 or max(correct_dist.values()) - min(correct_dist.values()) > 40:
        errors.append(f"correct distribution skewed: {correct_dist}")
    # عيّنة أرقام هندية في توسيع الرياضيات
    math_expand = [r for r in expanded if r["domain"] == "math"]
    if not any("٠" in r["stem"] or "١" in r["stem"] or "٢" in r["stem"] for r in math_expand):
        errors.append("eastern digits missing in expand math")
    if not any("/" in r["stem"] for r in math_expand):
        errors.append("fraction slash missing in expand math")
    if BANK_REVISION != "wave-b-212223-1":
        errors.append("revision tag")
    # الأساس + التوسيع بلا أرقام غربية في الرياضيات/العلوم
    import re

    for r in rows:
        if r["domain"] not in ("math", "science"):
            continue
        blob = " ".join(
            [
                r.get("stem") or "",
                r.get("choice_a") or "",
                r.get("choice_b") or "",
                r.get("choice_c") or "",
                r.get("choice_d") or "",
                r.get("rationale") or "",
            ]
        )
        if re.search(r"[0-9]", blob):
            errors.append(f"western digit in {r['domain']}: {r['stem'][:40]}")
            break

    with tempfile.TemporaryDirectory() as tmp:
        conn = sqlite3.connect(str(Path(tmp) / "t.db"))
        result = ensure_nafs_question_bank(conn, force_reseed=True)
        conn.commit()
        stored = conn.execute(
            "SELECT COUNT(*) FROM nafs_question_bank WHERE COALESCE(active,1)=1"
        ).fetchone()[0]
        if stored < EXPECTED_MIN_COUNT:
            errors.append(f"stored={stored}")
        if not result.get("seeded"):
            errors.append("expected seeded=True on force")
        again = ensure_nafs_question_bank(conn, force_reseed=False)
        if again.get("seeded"):
            errors.append("unexpected reseed when fresh")
        p5 = conn.execute(
            "SELECT COUNT(*) FROM nafs_question_bank WHERE passage_id='p5'"
        ).fetchone()[0]
        if int(p5 or 0) < 5:
            errors.append("p5 passage questions missing")
        conn.close()

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(
        "OK",
        {
            "total": len(rows),
            "by_domain": by_domain,
            "correct_dist": correct_dist,
            "revision": BANK_REVISION,
            "stored": stored,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
