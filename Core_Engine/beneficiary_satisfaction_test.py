# اختبار قياس رضا المستفيد — فصل المسودة/اللقطة + أرقام هندية + انفصال عن نافس
# تشغيل: python3 -m Core_Engine.beneficiary_satisfaction_test
from __future__ import annotations

import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)


def main() -> int:
    errors: list[str] = []
    from Core_Engine.beneficiary_satisfaction import (
        AXES,
        EVIDENCE_CODE,
        LAYER,
        approve_snapshot,
        beneficiary_items,
        build_aggregate,
        ensure_beneficiary_satisfaction,
        form_pack,
        get_draft,
        sanitize_answers,
        save_draft,
        _e,
    )

    if LAYER != "beneficiary_satisfaction":
        errors.append("layer")
    if EVIDENCE_CODE != "1-3-1-3":
        errors.append("evidence code")
    if len(AXES) != 5:
        errors.append(f"axes={len(AXES)}")

    items = beneficiary_items()
    if len(items) != 10:
        errors.append(f"items={len(items)}")
    if any(it.get("nafs_questionnaire") for it in items):
        errors.append("must not mark as nafs questionnaire")
    if any(it.get("mastery_indicator") for it in items):
        errors.append("must not mark as mastery")
    if any(not it.get("stem") for it in items):
        errors.append("empty stem")

    pack = form_pack()
    if not pack.get("separated_from_nafs_questionnaire") or not pack.get("separated_from_mastery"):
        errors.append("form separation flags")
    if pack.get("stems_invented_as_nafs") is not False:
        errors.append("must declare not nafs stems")

    dirty = {"1": {"choices": ["أ"]}, "99": {"choices": ["أ"]}, "2": {"choices": ["ز", "ب"]}}
    clean = sanitize_answers(dirty)
    if "1" not in clean or "99" in clean:
        errors.append("sanitize keep/drop")
    if clean.get("2", {}).get("choices") != ["ب"]:
        errors.append("sanitize illegal choice")

    if _e(13) != "١٣" or _e("1-3-1-3") != "١-٣-١-٣" or "٪" not in _e("25%"):
        errors.append("eastern helper")

    with tempfile.TemporaryDirectory() as tmp:
        conn = sqlite3.connect(str(Path(tmp) / "benef.db"))
        ensure_beneficiary_satisfaction(conn)

        save_draft(
            conn,
            actor_type="parent",
            actor_key="0500000001",
            answers={"1": {"choices": ["أ"]}, "3": {"choices": ["ب"]}},
            grade="الأول متوسط",
            section="أ",
        )
        d1 = get_draft(conn, actor_type="parent", actor_key="0500000001")
        if not d1["is_draft"] or d1["is_snapshot"]:
            errors.append("draft flags")

        s1 = approve_snapshot(
            conn,
            actor_type="parent",
            actor_key="0500000001",
            round_key="2026-B1",
            answers={str(i): {"choices": ["أ"]} for i in range(1, 11)},
            grade="الأول متوسط",
            section="أ",
        )
        if not s1["is_snapshot"] or not s1.get("draft_preserved"):
            errors.append("snapshot flags")

        save_draft(
            conn,
            actor_type="parent",
            actor_key="0500000001",
            answers={"1": {"choices": ["د"]}},
            grade="الأول متوسط",
            section="أ",
        )
        d2 = get_draft(conn, actor_type="parent", actor_key="0500000001")
        if d2["answers"].get("1", {}).get("choices") != ["د"]:
            errors.append("draft editable after snapshot")

        approve_snapshot(
            conn,
            actor_type="parent",
            actor_key="0500000001",
            round_key="2026-B2",
            answers={str(i): {"choices": ["ب" if i == 1 else "أ"]} for i in range(1, 11)},
            grade="الأول متوسط",
            section="أ",
        )
        approve_snapshot(
            conn,
            actor_type="student",
            actor_key="2402989277",
            round_key="2026-B1",
            answers={str(i): {"choices": ["أ"]} for i in range(1, 11)},
            grade="الأول متوسط",
            section="ب",
            student_nid="2402989277",
        )
        approve_snapshot(
            conn,
            actor_type="student",
            actor_key="2402989277",
            round_key="2026-B2",
            answers={str(i): {"choices": ["ج"]} for i in range(1, 11)},
            grade="الأول متوسط",
            section="ب",
            student_nid="2402989277",
        )
        conn.commit()

        agg = build_aggregate(conn, "2026-B1", "2026-B2")
        if agg["respondents_a"] != 2 or agg["respondents_b"] != 2:
            errors.append("respondents")
        if not agg.get("nafs_questionnaire_excluded") or not agg.get("mastery_excluded"):
            errors.append("aggregate separation")
        if not agg.get("axes") or len(agg["axes"]) != 5:
            errors.append("axis scores missing")
        item1 = next((it for it in agg["items"] if it["n"] == 1), None)
        if not item1:
            errors.append("item1")
        else:
            ch_a = next((c for c in item1["choices"] if c["choice"] == "أ"), None)
            # B1: كلاهما أ → 2؛ B2: ولي أمر ب + طالب ج → count_b(أ)=0
            if not ch_a or ch_a["count_a"] != 2 or ch_a["count_b"] != 0:
                errors.append(f"item1 أ counts {ch_a}")
            if ch_a and abs(ch_a["delta_pp"] - (-100.0)) > 0.1:
                errors.append(f"delta {ch_a['delta_pp']}")
            if ch_a and ch_a["delta_pp_ar"] != _e(ch_a["delta_pp"]):
                errors.append("delta eastern")

        # تأكد المسودة المعدّلة لا تتسرب
        if d2["answers"]["1"]["choices"] == ["د"] and ch_a and ch_a["count_b"] == 0:
            pass
        else:
            errors.append("draft leaked into aggregate")

        conn.close()

    # واجهات
    student_html = (ROOT / "Print_Canvas" / "portal-student.html").read_text(encoding="utf-8")
    parent_html = (ROOT / "Print_Canvas" / "portal-parent.html").read_text(encoding="utf-8")
    owner_html = (ROOT / "Print_Canvas" / "portal-owner.html").read_text(encoding="utf-8")
    stations = (ROOT / "Print_Canvas" / "js" / "portal-student-stations.js").read_text(encoding="utf-8")
    adaptive = (ROOT / "Print_Canvas" / "js" / "portal-student-adaptive.js").read_text(encoding="utf-8")
    benef_js = (ROOT / "Print_Canvas" / "js" / "beneficiary-satisfaction.js").read_text(encoding="utf-8")
    owner_js = (ROOT / "Print_Canvas" / "js" / "portal-owner.js").read_text(encoding="utf-8")
    app_py = (ROOT / "Core_Engine" / "app.py").read_text(encoding="utf-8")
    db_py = (ROOT / "Core_Engine" / "database.py").read_text(encoding="utf-8")

    for needle in (
        'data-station="satisfaction"',
        "beneficiary-satisfaction.js",
        "benef-sat-host",
    ):
        if needle not in student_html:
            errors.append(f"student html missing {needle}")
    if 'id: "satisfaction"' not in stations:
        errors.append("station missing")
    if "loadBeneficiarySatisfaction" not in adaptive:
        errors.append("adaptive load missing")
    if "parent-benef-sat-host" not in parent_html:
        errors.append("parent host missing")
    if "panel-benef-sat" not in owner_html or "loadBenefSatStats" not in owner_js:
        errors.append("owner panel missing")
    if "etec-force" not in benef_js or 'dir="ltr"' not in benef_js.replace('\\"', '"'):
        errors.append("LTR etec missing in UI")
    if "beneficiary_satisfaction" not in app_py or "ensure_beneficiary_satisfaction" not in db_py:
        errors.append("router/boot")

    # لا خلط مع جداول استبانة نافس
    mod = (ROOT / "Core_Engine" / "beneficiary_satisfaction.py").read_text(encoding="utf-8")
    if "portal_survey_drafts" in mod or "questionnaire_items" in mod:
        errors.append("must not reuse nafs survey tables/catalog")

    for path in FORTIFIED:
        if not path.exists():
            errors.append(f"fortified missing {path.name}")
        text = path.read_text(encoding="utf-8", errors="ignore")
        if "benef-sat" in text or "portal_benef_sat" in text:
            errors.append(f"fortified touched? {path.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(
        "OK beneficiary_satisfaction_test",
        {"items": len(items), "axes": len(AXES), "evidence": EVIDENCE_CODE},
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
