# اختبار مرصد الأخطاء والحقيبة والمحاكاة — python3 -m Core_Engine.nafs_misconception_lab_test
from __future__ import annotations

import sqlite3
import sys
import tempfile
from pathlib import Path


def main() -> int:
    errors: list[str] = []
    from .nafs_misconception_lab import (
        GOLDEN_DECK,
        build_trap_album,
        enrich_question_traps,
        ensure_on_boot,
        ensure_question_columns,
    )
    from .nafs_question_bank_seed import BANK_REVISION, ensure_nafs_question_bank
    from .portal_session_api import MODE_NATIONAL, MODE_CONFIG, _pick_questions

    album = build_trap_album()
    if len(album) != 66:
        errors.append(f"album={len(album)}")
    if len(GOLDEN_DECK) < 12:
        errors.append("golden deck too small")
    if MODE_NATIONAL not in MODE_CONFIG:
        errors.append("national mode missing")
    if BANK_REVISION != "wave-d-lughati140-1":
        errors.append("revision")
    r4 = next((c for c in GOLDEN_DECK if c["id"] == "r4"), None)
    if not r4 or "بلى" not in (r4.get("back") or "") or "نعم" not in (r4.get("back") or ""):
        errors.append("golden r4 بلى/نعم incomplete")

    with tempfile.TemporaryDirectory() as tmp:
        conn = sqlite3.connect(str(Path(tmp) / "t.db"))
        # جداول داعمة بسيطة
        conn.execute(
            "CREATE TABLE portal_xp_ledger(id INTEGER PRIMARY KEY, student_nid TEXT, event_type TEXT, xp INTEGER, meta_json TEXT, created_at TEXT)"
        )
        result = ensure_nafs_question_bank(conn, force_reseed=True)
        ensure_on_boot(conn)
        ensure_question_columns(conn)
        enriched = enrich_question_traps(conn)
        conn.commit()
        filled = conn.execute(
            "SELECT COUNT(*) FROM nafs_question_bank WHERE trim(common_mistake)!='' AND trim(grade_root)!=''"
        ).fetchone()[0]
        if int(filled or 0) < 100:
            errors.append(f"enriched traps only {filled}")
        qs = _pick_questions(conn, MODE_NATIONAL, "", 66)
        if len(qs) < 60:
            errors.append(f"national pick={len(qs)}")
        domains = {q["domain"] for q in qs}
        if not {"math", "science", "reading"}.issubset(domains):
            errors.append(f"national domains={domains}")
        conn.close()
        if not result.get("stored") or result["stored"] < 150:
            errors.append(f"stored={result.get('stored')}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(
        "OK",
        {
            "revision": BANK_REVISION,
            "album": len(album),
            "golden": len(GOLDEN_DECK),
            "enriched": enriched,
            "filled": filled,
            "national": len(qs),
            "stored": result.get("stored"),
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
