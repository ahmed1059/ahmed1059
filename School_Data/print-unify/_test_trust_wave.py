# -*- coding: utf-8 -*-
"""تحقق موجة الثقة: soft_no_media يرى visual_evidence."""
import json
import sqlite3
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:8060"
DB = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059\School_Data\school_1059.db")


def get(url):
    with urllib.request.urlopen(url, timeout=15) as res:
        return json.loads(res.read().decode("utf-8"))


def main():
    conn = sqlite3.connect(str(DB))
    # اختر صف منفّذ إن وُجد، أو أنشئ سيناريو اختبارًا
    row = conn.execute(
        """
        SELECT day_iso, slot_code, status, evidence_images
        FROM soft_period_follow
        WHERE status IN ('منفّذ', 'منفذ', 'تم')
        ORDER BY day_iso DESC LIMIT 1
        """
    ).fetchone()
    if not row:
        print("SKIP: لا صف لاصفي منفّذ للاختبار")
        return
    day_iso, slot, status, images = row
    key = f"{day_iso}|{slot}"
    print("target:", key, "status:", status, "legacy_images:", (images or "")[:40])

    ve = conn.execute(
        "SELECT COUNT(*) FROM visual_evidence WHERE entity_type='soft_period' AND entity_key=?",
        (key,),
    ).fetchone()[0]
    print("visual_evidence count for key:", ve)

    # إن لم يوجد شاهد visual لهذا المفتاح، أضف رابطًا مؤقتًا عبر API ثم افحص الإشارات
    created = False
    if ve == 0:
        # إدراج مباشر للاختبار
        conn.execute(
            """
            INSERT INTO visual_evidence(entity_type, entity_key, register_key, kind, url, name, created_at)
            VALUES('soft_period', ?, 'soft-periods', 'link', 'https://example.com/trust-wave', 'trust-wave-probe', datetime('now'))
            """,
            (key,),
        )
        conn.commit()
        created = True
        print("inserted probe visual_evidence")

    payload = get(BASE + "/api/command-room/today?refresh=1")
    signals = payload.get("signals") or []
    soft_hits = [
        s
        for s in signals
        if s.get("rule_code") == "soft_no_media" and str(s.get("entity_id") or "") == key
    ]
    print("soft_no_media for key:", len(soft_hits))
    assert len(soft_hits) == 0, "الإشارة ظهرت رغم وجود visual_evidence"
    print("OK: soft_no_media suppressed when visual_evidence exists")

    if created:
        conn.execute(
            "DELETE FROM visual_evidence WHERE entity_type='soft_period' AND entity_key=? AND name='trust-wave-probe'",
            (key,),
        )
        conn.commit()
        print("cleaned probe")
    conn.close()


if __name__ == "__main__":
    main()
