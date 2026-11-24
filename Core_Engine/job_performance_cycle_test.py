# اختبار دورة كاملة لتقويم أداء معلم تجريبي (الخطوة 6).
# تشغيل: python3 -m Core_Engine.job_performance_cycle_test

from __future__ import annotations

import secrets
from datetime import datetime

from fastapi.testclient import TestClient

from .app import app
from .database import connect, init_db
from .job_performance_seed import compute_totals


TEACHER_ID = "1000000002"  # معلم رياضيات تجريبي — له زيارات محفوظة
MANAGER_ID = "1046940365"


def _session_token(national_id: str) -> str:
    connection = connect()
    try:
        token = secrets.token_urlsafe(24)
        moment = datetime.now().replace(microsecond=0).isoformat(sep=" ")
        connection.execute(
            """
            INSERT INTO auth_sessions (token, national_id, created_at, limited)
            VALUES (?, ?, ?, 0)
            """,
            (token, national_id, moment),
        )
        connection.commit()
        return token
    finally:
        connection.close()


def _cleanup(cycle_id: int, staff_id: str) -> None:
    connection = connect()
    try:
        rows = connection.execute(
            "SELECT id FROM perf_records WHERE cycle_id = ? AND staff_id = ?",
            (cycle_id, staff_id),
        ).fetchall()
        for row in rows:
            rid = row[0]
            connection.execute("DELETE FROM perf_evidence_links WHERE record_id = ?", (rid,))
            connection.execute("DELETE FROM perf_element_scores WHERE record_id = ?", (rid,))
            connection.execute("DELETE FROM perf_gap_plans WHERE record_id = ?", (rid,))
            connection.execute("DELETE FROM perf_idp WHERE record_id = ?", (rid,))
            connection.execute("DELETE FROM perf_records WHERE id = ?", (rid,))
        connection.commit()
    finally:
        connection.close()


def run() -> dict:
    init_db()
    client = TestClient(app)
    headers = {"X-Session-Token": _session_token(MANAGER_ID)}

    cycles = client.get("/api/session/job-performance/cycles", headers=headers).json()["items"]
    assert cycles, "لا توجد دورة أداء"
    cycle_id = cycles[0]["id"]
    _cleanup(cycle_id, TEACHER_ID)

    # 1) إنشاء السجل + لقطة أوزان
    created = client.post(
        "/api/session/job-performance/records",
        headers=headers,
        json={"cycle_id": cycle_id, "staff_id": TEACHER_ID, "assignment_role": "teacher"},
    )
    assert created.status_code == 200, created.text
    record = created.json()
    record_id = record["id"]
    elements = record["weights_snapshot"]
    assert len(elements) == 11
    assert abs(sum(float(e["weight"]) for e in elements) - 100) < 0.01

    # 2) التقييم الذاتي (غير محتسب)
    self_scores = [{"element_id": e["id"], "rating": 3} for e in elements]
    self_res = client.put(
        f"/api/session/job-performance/records/{record_id}/self-scores",
        headers=headers,
        json={"phase": "self_mid", "scores": self_scores},
    )
    assert self_res.status_code == 200, self_res.text
    assert self_res.json().get("counted") is False

    # 3) رصد نصف العام (عنصر أول بدرجة 2 لفتح خطة فجوة)
    mid_scores = [
        {"element_id": e["id"], "rating": (2 if i == 0 else 4), "note": "نصف"}
        for i, e in enumerate(elements)
    ]
    mid_res = client.put(
        f"/api/session/job-performance/records/{record_id}/scores",
        headers=headers,
        json={"phase": "mid", "scores": mid_scores},
    )
    assert mid_res.status_code == 200, mid_res.text
    mid_totals = mid_res.json()["totals"]["mid"]
    expected_mid = compute_totals(
        elements, {s["element_id"]: s["rating"] for s in mid_scores}
    )
    assert abs(mid_totals["percent"] - expected_mid["percent"]) < 0.01

    # 4) خطة فجوة
    gap_res = client.put(
        f"/api/session/job-performance/records/{record_id}/gap-plan",
        headers=headers,
        json={
            "element_id": elements[0]["id"],
            "current_rating": 2,
            "reasons": "فجوة اختبار الدورة",
            "strengths": "التزام أساسي",
            "improve_areas": "تحسين الواجبات",
            "action_steps": [{"step": "متابعة أسبوعية", "when": "أسبوعان", "owner": "الوكيل"}],
            "status": "open",
        },
    )
    assert gap_res.status_code == 200, gap_res.text

    # 5) التقييم الختامي
    final_scores = [{"element_id": e["id"], "rating": 5} for e in elements]
    final_res = client.put(
        f"/api/session/job-performance/records/{record_id}/scores",
        headers=headers,
        json={"phase": "final", "scores": final_scores},
    )
    assert final_res.status_code == 200, final_res.text
    final_totals = final_res.json()["totals"]["final"]
    assert final_totals["percent"] == 100.0
    assert final_totals["band"] == 5

    # 6) IDP
    idp_res = client.put(
        f"/api/session/job-performance/records/{record_id}/idp",
        headers=headers,
        json={
            "goals": [
                {
                    "title": "تطوير إستراتيجيات التدريس",
                    "priority": 1,
                    "activities": {
                        "70": "تطبيق صفّي أسبوعي",
                        "20": "زيارة تبادلية",
                        "10": "دورة قصيرة",
                    },
                }
            ],
            "notes": "خطة اختبار الدورة الكاملة",
        },
    )
    assert idp_res.status_code == 200, idp_res.text

    # 7) الشواهد المربوطة
    evidence = client.get(
        f"/api/session/job-performance/records/{record_id}/evidence",
        headers=headers,
    )
    assert evidence.status_code == 200, evidence.text
    pack = evidence.json()
    assert pack.get("auto_score") is False
    assert pack.get("count", 0) >= 1
    kinds = {item["source_kind"] for item in pack.get("items") or []}
    assert "classroom_visit" in kinds or "nafes" in kinds or "committee" in kinds

    # تحقق قاعدة البيانات
    connection = connect()
    try:
        db_scores = connection.execute(
            "SELECT phase, COUNT(*) FROM perf_element_scores WHERE record_id = ? GROUP BY phase",
            (record_id,),
        ).fetchall()
        phases = {row[0]: row[1] for row in db_scores}
        assert phases.get("self_mid", 0) == 11
        assert phases.get("mid", 0) == 11
        assert phases.get("final", 0) == 11
        gap_n = connection.execute(
            "SELECT COUNT(*) FROM perf_gap_plans WHERE record_id = ?",
            (record_id,),
        ).fetchone()[0]
        idp_n = connection.execute(
            "SELECT COUNT(*) FROM perf_idp WHERE record_id = ?",
            (record_id,),
        ).fetchone()[0]
        ev_n = connection.execute(
            "SELECT COUNT(*) FROM perf_evidence_links WHERE record_id = ?",
            (record_id,),
        ).fetchone()[0]
        row = connection.execute(
            "SELECT final_percent, final_band, readiness_final FROM perf_records WHERE id = ?",
            (record_id,),
        ).fetchone()
    finally:
        connection.close()

    assert gap_n == 1
    assert idp_n == 1
    assert ev_n >= 1
    assert float(row[0]) == 100.0
    assert int(row[1]) == 5
    assert float(row[2]) == 100.0

    return {
        "ok": True,
        "record_id": record_id,
        "teacher_id": TEACHER_ID,
        "mid_percent": mid_totals["percent"],
        "final_percent": final_totals["percent"],
        "evidence_count": pack["count"],
        "evidence_kinds": sorted(kinds),
        "db_phases": phases,
    }


if __name__ == "__main__":
    result = run()
    print("CYCLE_TEST_OK", result)
