# تدقيق محتوى نافس — أرقام هندية + بلى + شكر + ETEC code_ar
# تشغيل: python3 -m Core_Engine.nafs_content_audit_test
from __future__ import annotations

import re
import sys


def main() -> int:
    errors: list[str] = []
    from .nafs_misconception_lab import (
        ETEC_INDICATORS,
        GOLDEN_DECK,
        SKILL_TRAPS,
        build_trap_album,
    )
    from .nafs_question_bank_seed import BANK_REVISION, all_questions
    from .portal_games_api import WORD_BANK

    if BANK_REVISION != "wave-d-lughati140-1":
        errors.append(f"revision={BANK_REVISION}")

    rows = all_questions()
    if len(rows) < 150:
        errors.append(f"count={len(rows)}")

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
            errors.append(f"western digit: {r['stem'][:48]}")
            break

    r4 = next((c for c in GOLDEN_DECK if c["id"] == "r4"), None)
    if not r4:
        errors.append("missing golden r4")
    else:
        back = r4.get("back") or ""
        if "بلى" not in back or "نعم" not in back or "ألم تدرس" not in back:
            errors.append("golden r4 incomplete بلى rule")

    album = build_trap_album()
    if len(album) != 66:
        errors.append(f"album={len(album)}")
    bali = [t for t in album if "الاستفهام المنفي" in (t.get("skill") or "")]
    if not bali:
        errors.append("trap بلى missing")
    else:
        rule = bali[0].get("golden_rule") or ""
        correct = bali[0].get("correct_example") or ""
        if "بلى" not in rule or "نعم" not in rule:
            errors.append("trap بلى rule incomplete")
        if "بلى" not in correct:
            errors.append("trap بلى correct_example")

    shukr = next((w for w in WORD_BANK if w.get("word") == "شكر"), None)
    if not shukr:
        errors.append("شكر missing")
    elif "طاعته" in (shukr.get("meaning") or ""):
        errors.append("شكر meaning still weak")
    elif "المنعم" not in (shukr.get("meaning") or "") and "نعمة" not in (shukr.get("meaning") or ""):
        errors.append("شكر meaning incomplete")

    for domain, meta in ETEC_INDICATORS.items():
        if not meta.get("code_ar"):
            errors.append(f"etec code_ar missing for {domain}")
        elif re.search(r"[0-9]", meta["code_ar"]):
            errors.append(f"etec code_ar western for {domain}")

    prop = SKILL_TRAPS.get("النسب") or ("", "")
    if "س١/ص١" not in prop[0]:
        errors.append("proportion trap wording")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(
        "OK",
        {
            "revision": BANK_REVISION,
            "questions": len(rows),
            "golden": len(GOLDEN_DECK),
            "album": len(album),
            "etec": {k: v.get("code_ar") for k, v in ETEC_INDICATORS.items()},
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
