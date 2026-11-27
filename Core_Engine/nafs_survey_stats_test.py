# اختبار موجة التقرير الإحصائي للاستبانة — فصل المسودة/اللقطة + Δ + أرقام هندية
# تشغيل: python3 -m Core_Engine.nafs_survey_stats_test
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
    from Core_Engine.nafs_survey_stats import (
        LAYER,
        approve_snapshot,
        build_aggregate,
        ensure_survey_stats,
        get_draft,
        list_student_snapshots,
        sanitize_survey_answers,
        save_draft,
        _e,
        _item_catalog,
    )

    if LAYER != "questionnaire":
        errors.append("layer must be questionnaire")

    catalog = _item_catalog()
    if len(catalog) != 22:
        errors.append(f"catalog={len(catalog)}")
    sens = [it for it in catalog if it["sensitive_teacher"]]
    if not sens:
        errors.append("expected teacher-sensitive items")
    if any(not it.get("stem") for it in catalog):
        errors.append("empty stems not allowed")

    # sanitize: رفض طبقة التدريب
    dirty = {
        "1": {"choices": ["أ"]},
        "ans": {"choices": ["ب"]},
        "999": {"choices": ["أ"]},
        "2": {"choices": ["أ", "ج", "ز"]},
    }
    clean = sanitize_survey_answers(dirty, catalog)
    if "1" not in clean or "999" in clean or "ans" in clean:
        errors.append("sanitize failed to keep survey-only keys")
    if set(clean.get("2", {}).get("choices") or []) != {"أ", "ج"}:
        errors.append("sanitize must drop illegal choices")

    if _e(12) != "١٢" or _e("S-40341") != "S-٤٠٣٤١" or "٪" not in _e("10%"):
        errors.append("eastern digits helper")

    with tempfile.TemporaryDirectory() as tmp:
        conn = sqlite3.connect(str(Path(tmp) / "survey.db"))
        ensure_survey_stats(conn)

        save_draft(
            conn,
            "2402989277",
            {"1": {"choices": ["أ"]}, "14": {"choices": ["ب"]}},
            grade="الأول متوسط",
            section="أ",
        )
        draft1 = get_draft(conn, "2402989277")
        if not draft1.get("is_draft") or draft1.get("is_snapshot"):
            errors.append("draft flags wrong")
        if draft1["answers"].get("1", {}).get("choices") != ["أ"]:
            errors.append("draft content")

        snap1 = approve_snapshot(
            conn,
            "2402989277",
            round_key="2026-R1",
            answers={"1": {"choices": ["أ"]}, "9": {"choices": ["أ"]}, "14": {"choices": ["ب"]}},
            grade="الأول متوسط",
            section="أ",
        )
        if not snap1.get("is_snapshot") or snap1.get("is_draft"):
            errors.append("snapshot flags wrong")
        if not snap1.get("draft_preserved"):
            errors.append("draft must remain after snapshot")

        # تعديل المسودة بعد الاعتماد لا يغيّر اللقطة
        save_draft(
            conn,
            "2402989277",
            {"1": {"choices": ["د"]}},
            grade="الأول متوسط",
            section="أ",
        )
        draft2 = get_draft(conn, "2402989277")
        if draft2["answers"].get("1", {}).get("choices") != ["د"]:
            errors.append("draft editable after snapshot")

        snap2 = approve_snapshot(
            conn,
            "2402989277",
            round_key="2026-R2",
            answers={"1": {"choices": ["ب"]}, "9": {"choices": ["ب"]}, "14": {"choices": ["أ"]}},
            grade="الأول متوسط",
            section="أ",
        )
        # طالب ثانٍ في فصل آخر
        approve_snapshot(
            conn,
            "2402989278",
            round_key="2026-R1",
            answers={"1": {"choices": ["أ"]}, "9": {"choices": ["ج"]}},
            grade="الأول متوسط",
            section="ب",
        )
        approve_snapshot(
            conn,
            "2402989278",
            round_key="2026-R2",
            answers={"1": {"choices": ["أ"]}, "9": {"choices": ["أ"]}},
            grade="الأول متوسط",
            section="ب",
        )
        conn.commit()

        listed = list_student_snapshots(conn, "2402989277")
        if listed["count"] != 2:
            errors.append(f"student snapshots={listed['count']}")

        agg = build_aggregate(conn, "2026-R1", "2026-R2", include_teacher_sensitive=True)
        if agg["respondents_a"] != 2 or agg["respondents_b"] != 2:
            errors.append("respondents mismatch")
        if not agg.get("drafts_excluded") or not agg.get("shading_training_excluded"):
            errors.append("source flags")
        if not agg.get("by_section_a") or not agg.get("by_grade_a"):
            errors.append("grade/section aggregates missing")

        item1 = next((it for it in agg["items"] if it["n"] == 1), None)
        if not item1:
            errors.append("item 1 missing")
        else:
            main = (item1["slots"] or [{}])[0]
            choice_a = next((c for c in main.get("choices") or [] if c["choice"] == "أ"), None)
            choice_b = next((c for c in main.get("choices") or [] if c["choice"] == "ب"), None)
            # R1: كلا الطالبين أ → count_a(أ)=2 ؛ R2: واحد أ وواحد ب → count_b(أ)=1
            if not choice_a or choice_a["count_a"] != 2 or choice_a["count_b"] != 1:
                errors.append(f"item1 choice أ counts {choice_a}")
            if not choice_b or choice_b["count_b"] != 1:
                errors.append(f"item1 choice ب counts {choice_b}")
            if choice_a and abs(choice_a["delta_pp"] - (-50.0)) > 0.1:
                errors.append(f"delta_pp أ expected -50 got {choice_a['delta_pp']}")
            if choice_a and choice_a["delta_pp_ar"] != _e(choice_a["delta_pp"]):
                errors.append("delta eastern mismatch")

        agg_hide = build_aggregate(conn, "2026-R1", "2026-R2", include_teacher_sensitive=False)
        if any(it.get("sensitive_teacher") for it in agg_hide["items"]):
            errors.append("teacher-sensitive items must hide when flag false")
        if not any(it.get("sensitive_teacher") for it in agg["items"]):
            errors.append("teacher-sensitive should appear when allowed")

        # المسودة المعدّلة ليست في التجميع
        if draft2["answers"]["1"]["choices"] == ["د"]:
            # تأكيد أن التجميع ما زال على اللقطات
            if choice_a and choice_a["count_b"] == 1:
                pass
            else:
                errors.append("aggregate leaked draft")

        conn.close()

    # واجهات وربط
    html_s = (ROOT / "Print_Canvas" / "portal-student.html").read_text(encoding="utf-8")
    adaptive = (ROOT / "Print_Canvas" / "js" / "portal-student-adaptive.js").read_text(encoding="utf-8")
    wave = (ROOT / "Print_Canvas" / "js" / "nafs-wave-c-answer-sheet.js").read_text(encoding="utf-8")
    owner_html = (ROOT / "Print_Canvas" / "portal-owner.html").read_text(encoding="utf-8")
    owner_js = (ROOT / "Print_Canvas" / "js" / "portal-owner.js").read_text(encoding="utf-8")
    app_py = (ROOT / "Core_Engine" / "app.py").read_text(encoding="utf-8")
    db_py = (ROOT / "Core_Engine" / "database.py").read_text(encoding="utf-8")

    for needle in (
        "/api/portal/survey/draft",
        "/api/portal/survey/snapshot",
        "collectSurveyAnswers",
        "data-nafs-c-draft",
        "data-nafs-c-snapshot",
    ):
        if needle not in adaptive and needle not in wave:
            errors.append(f"student wiring missing {needle}")

    if "panel-survey-stats" not in owner_html or "loadSurveyStats" not in owner_js:
        errors.append("owner survey panel missing")
    if "nafs_survey_stats" not in app_py or "ensure_nafs_survey_stats" not in db_py:
        errors.append("router/boot wiring")

    for path in FORTIFIED:
        if not path.exists():
            errors.append(f"fortified missing {path.name}")

    # تأكد أن هذه الموجة لم تمس المحصّن عبر git? — فحص محتوى محلي كافٍ لعدم وجود survey في المحصّن
    for path in FORTIFIED:
        text = path.read_text(encoding="utf-8", errors="ignore")
        if "survey-stats" in text or "portal_survey_" in text:
            errors.append(f"fortified touched? {path.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(
        "OK nafs_survey_stats_test",
        {
            "items": len(catalog),
            "sensitive": len(sens),
            "delta_check": True,
            "snap1": snap1.get("round_key"),
            "snap2": snap2.get("round_key"),
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
