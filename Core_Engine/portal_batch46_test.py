# اختبار دفعة PR #46: هوية + نظائر مهارية + مبارزة + مرصد.
# تشغيل: python3 -m Core_Engine.portal_batch46_test

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path


def main() -> int:
    errors: list[str] = []

    from .portal_parametric import generate_parametric_batch, to_eastern

    batch = generate_parametric_batch(6, domains=["math", "science"])
    if len(batch) != 6:
        errors.append(f"parametric count={len(batch)}")
    if not any(q.get("parametric") for q in batch):
        errors.append("parametric flag missing")
    if not any("/" in (q.get("stem") or "") or "^" in (q.get("stem") or "") for q in batch):
        # قد تكون مسائل خطية فقط بالصدفة — أعد المحاولة الموجّهة
        frac = generate_parametric_batch(8, domains=["math"])
        if not any("/" in (q.get("stem") or "") for q in frac):
            # استدعاء مباشر
            from . import portal_parametric as pp

            sample = pp._math_frac_percent()
            if "/" not in sample["stem"]:
                errors.append("frac stem missing slash")
    if to_eastern(40341) != "٤٠٣٤١":
        errors.append("eastern digits failed")

    from .portal_identity_api import DEFAULT_CONTENT, ensure_identity_content
    from .portal_radar_api import (
        ensure_radar_tables,
        evaluate_performance_risk,
        maybe_nominate_talent,
    )
    from .portal_session_api import MODE_CONFIG, MODE_DUEL, _pick_ghost

    if MODE_DUEL not in MODE_CONFIG:
        errors.append("duel mode missing")
    if DEFAULT_CONTENT.get("statistical_number") != "40341":
        errors.append("identity SSOT statistical_number")
    if DEFAULT_CONTENT.get("display_students") != 338:
        errors.append("identity SSOT students")
    if "موهبة" not in (DEFAULT_CONTENT.get("partners") or []):
        errors.append("identity partners incomplete")

    # قاعدة مؤقتة خفيفة
    import sqlite3

    with tempfile.TemporaryDirectory() as tmp:
        db = Path(tmp) / "t.db"
        conn = sqlite3.connect(str(db))
        conn.execute(
            """
            CREATE TABLE noor_students(
              national_id TEXT, name TEXT, grade TEXT, classroom TEXT, is_deleted INTEGER DEFAULT 0
            )
            """
        )
        conn.execute(
            "INSERT INTO noor_students VALUES ('111','طالب أ','أول متوسط','1',0)"
        )
        conn.execute(
            "INSERT INTO noor_students VALUES ('222','طالب ب','أول متوسط','1',0)"
        )
        conn.execute(
            """
            CREATE TABLE portal_challenge_runs(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              student_nid TEXT, mode TEXT, started_at TEXT, finished_at TEXT DEFAULT '',
              duration_sec INTEGER DEFAULT 0, total_questions INTEGER DEFAULT 0,
              correct_count INTEGER DEFAULT 0, score_pct REAL DEFAULT 0,
              xp_earned INTEGER DEFAULT 0, streak_best INTEGER DEFAULT 0,
              domain_focus TEXT DEFAULT '', detail_json TEXT DEFAULT '{}', active INTEGER DEFAULT 1
            )
            """
        )
        content = ensure_identity_content(conn)
        if content.get("principal_name", "").find("نايف") < 0:
            errors.append("identity seed principal")
        ensure_radar_tables(conn)
        flag = maybe_nominate_talent(conn, "111", 96.0, 1)
        if not flag:
            errors.append("talent nomination failed at 96%")
        none_flag = maybe_nominate_talent(conn, "222", 80.0, 2)
        if none_flag is not None:
            errors.append("talent should skip below 95%")
        # ثلاث جولات لتراجع الأداء
        for score in (90, 88, 85, 40):
            conn.execute(
                """
                INSERT INTO portal_challenge_runs(student_nid, mode, started_at, finished_at, score_pct, total_questions)
                VALUES ('111','daily','2026-01-01T00:00:00+00:00','2026-01-01T00:10:00+00:00',?,10)
                """,
                (score,),
            )
        risk = evaluate_performance_risk(conn, "111")
        if not risk:
            errors.append("performance risk not raised")
        ghost = _pick_ghost(conn, "111", 8, 480)
        if not ghost.get("ghost_pace_sec") or len(ghost["ghost_pace_sec"]) != 8:
            errors.append("ghost pace incomplete")
        conn.commit()
        conn.close()

    # تحقق ملفات الواجهة
    root = Path(__file__).resolve().parent.parent / "Print_Canvas"
    identity = (root / "identity.html").read_text(encoding="utf-8")
    if "العودة إلى تسجيل الدخول" not in identity:
        errors.append("identity back button missing")
    if "identity-tabs" not in identity:
        errors.append("identity tabs missing")
    if "خروج" in identity and "command-exit" in identity:
        errors.append("misleading exit button still present")
    login_css = (root / "css" / "login-opening.css").read_text(encoding="utf-8")
    if "visibility: hidden" not in login_css:
        errors.append("login inactive slide visibility fix missing")

    if errors:
        print("FAIL:")
        for e in errors:
            print(" -", e)
        return 1
    print("OK portal_batch46_test")
    print(json.dumps({"parametric": len(batch), "duel": MODE_DUEL, "school": DEFAULT_CONTENT["school_name"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
