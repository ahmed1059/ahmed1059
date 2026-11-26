# اختبار سلامة العرض البصري — تشغيل: python3 -m Core_Engine.nafs_visual_integrity_test
from __future__ import annotations

import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Core_Engine.nafs_question_bank_seed import (  # noqa: E402
    BANK_REVISION,
    all_questions,
    ensure_nafs_question_bank,
)
from Core_Engine.nafs_visual_integrity import (  # noqa: E402
    PLACEHOLDER_MARKERS,
    clean_ocr_ar,
    filter_student_questions,
    is_placeholder_passage,
    prepare_public_question,
    stem_needs_diagram,
    student_displayable,
)
from Core_Engine.nafs_wave_b_212223 import wave_b_questions  # noqa: E402
from Core_Engine.nafs_wave_d_lughati140 import wave_d_questions  # noqa: E402
from Core_Engine.portal_session_api import _pick_questions, _public_question  # noqa: E402

FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)
JS = ROOT / "Print_Canvas" / "js" / "portal-student.js"
CSS = ROOT / "Print_Canvas" / "css" / "portal-student.css"


def main() -> int:
    errors: list[str] = []

    if BANK_REVISION != "visual-diagram-gate-1":
        errors.append(f"revision={BANK_REVISION}")

    # placeholders
    bogus = "مذكرة · تدريب · نص التدريب في المصدر المطبوع · يُعرض السؤال والخيارات المعتمدة بعد التنقية"
    if not is_placeholder_passage(bogus):
        errors.append("placeholder detector")
    for m in PLACEHOLDER_MARKERS:
        if not is_placeholder_passage(m):
            errors.append(f"marker miss {m[:20]}")

    # OCR cleanup
    if clean_ocr_ar("الي وم") != "اليوم":
        errors.append("ocr اليوم")
    if "يمتلكون" not in clean_ocr_ar("يمتلك ون"):
        errors.append("ocr يمتلكون")
    if clean_ocr_ar("المقص ود") != "المقصود":
        errors.append("ocr المقصود")

    # Wave D: لا نص وصفي · غير جاهز للطالب بلا مقطع حقيقي
    d_rows = wave_d_questions()
    if len(d_rows) != 140:
        errors.append(f"wave_d={len(d_rows)}")
    if any(is_placeholder_passage(r.get("passage_text") or "") for r in d_rows):
        errors.append("wave_d still ships placeholder passage_text")
    if any(student_displayable(r) for r in d_rows):
        errors.append("wave_d without real passage must not be student_displayable")
    if any(r.get("student_ready") not in (0, "0", False) for r in d_rows):
        # all should be 0
        ready = sum(1 for r in d_rows if int(r.get("student_ready") or 0) == 1)
        if ready:
            errors.append(f"wave_d student_ready={ready}")

    # Wave B diagrams for shape stems
    b_rows = wave_b_questions()
    need = [r for r in b_rows if stem_needs_diagram(r.get("stem") or "") or "مدرج تكراري للعمر" in (r.get("stem") or "") or "الصندوق وطرفاه" in (r.get("stem") or "") or "قطاع دائري رباعي" in (r.get("stem") or "")]
    if len(need) < 4:
        errors.append(f"expected diagram stems got {len(need)}")
    for r in need:
        if not (r.get("diagram_svg") or "").strip():
            errors.append(f"missing svg {r.get('source_ref')}")
        if "<svg" not in (r.get("diagram_svg") or ""):
            errors.append(f"svg markup {r.get('source_ref')}")
        # إحداثيات SVG غربية بالضرورة؛ نتحقق أن التسميات النصية (إن وُجدت أرقام) هندية
        svg = r.get("diagram_svg") or ""
        import re as _re

        for text in _re.findall(r"<text[^>]*>([^<]*)</text>", svg):
            if any(c in "0123456789" for c in text) and not any(c in "٠١٢٣٤٥٦٧٨٩" for c in text):
                errors.append(f"svg label western digits {r.get('source_ref')}: {text}")
                break

    # بنك: لا أسئلة معروضة للطالب بنص وصفي أو شكل ناقص
    bank = all_questions()
    shown = filter_student_questions(bank)
    for q in shown:
        if is_placeholder_passage(q.get("passage_text") or ""):
            errors.append("filtered bank still has placeholder")
            break
        if stem_needs_diagram(q.get("stem") or "") and not (q.get("diagram_svg") or "").strip():
            # بعض الأسئلة القديمة قد تُستبعد عبر student_displayable
            if student_displayable(q):
                errors.append(f"displayable without diagram: {q.get('stem','')[:40]}")
                break

    pub = prepare_public_question(
        {
            "domain": "reading",
            "passage_text": bogus,
            "passage_title": "تدريب",
            "stem": "س",
            "choices": {},
            "id": 1,
            "skill": "",
        }
    )
    if pub.get("passage_text"):
        errors.append("prepare_public must blank placeholder")

    with tempfile.TemporaryDirectory() as tmp:
        conn = sqlite3.connect(str(Path(tmp) / "v.db"))
        ensure_nafs_question_bank(conn, force_reseed=True)
        conn.commit()
        cols = {r[1] for r in conn.execute("PRAGMA table_info(nafs_question_bank)")}
        for col in ("diagram_svg", "diagram_alt", "student_ready"):
            if col not in cols:
                errors.append(f"missing col {col}")
        ready = conn.execute(
            "SELECT COUNT(*) FROM nafs_question_bank WHERE COALESCE(student_ready,1)=1"
        ).fetchone()[0]
        blocked = conn.execute(
            "SELECT COUNT(*) FROM nafs_question_bank WHERE COALESCE(student_ready,1)=0"
        ).fetchone()[0]
        if blocked < 100:
            errors.append(f"expected many gated wave-d rows blocked={blocked}")
        picked = _pick_questions(conn, "daily", "math", 8)
        if any(is_placeholder_passage(p.get("passage_text") or "") for p in picked):
            errors.append("pick leaked placeholder")
        if any(stem_needs_diagram(p.get("stem") or "") and not p.get("diagram_svg") for p in picked):
            errors.append("pick leaked diagram-less stem")
        for p in picked:
            pub_q = _public_question(p)
            if is_placeholder_passage(pub_q.get("passage_text") or ""):
                errors.append("public placeholder")
                break
        # قراءة جاهزة للطالب من البنك القديم فقط
        reading_pick = _pick_questions(conn, "daily", "reading", 10)
        if any(is_placeholder_passage(p.get("passage_text") or "") for p in reading_pick):
            errors.append("reading pick placeholder")
        if any(str(p.get("passage_id") or "").startswith("wave-d-lughati140") for p in reading_pick):
            errors.append("wave-d leaked into student pick")
        diagrams = conn.execute(
            "SELECT COUNT(*) FROM nafs_question_bank WHERE trim(diagram_svg) != ''"
        ).fetchone()[0]
        if diagrams < 4:
            errors.append(f"diagrams stored={diagrams}")
        conn.close()

    js = JS.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")
    if "q.diagram_svg" not in js or "q-diagram" not in js:
        errors.append("portal-student missing diagram paint")
    if "نص التدريب في المصدر المطبوع" not in js:
        errors.append("portal-student missing placeholder guard")
    if ".q-diagram" not in css:
        errors.append("css missing q-diagram")

    for path in FORTIFIED:
        if not path.is_file():
            errors.append(f"fortified missing {path.name}")

    if errors:
        print("FAIL nafs-visual-integrity")
        for e in errors:
            print(" -", e)
        return 1
    print(
        "OK nafs-visual-integrity",
        {
            "revision": BANK_REVISION,
            "bank": len(bank),
            "student_shown_estimate": len(shown),
            "wave_d_gated": len(d_rows),
            "wave_b_diagrams": len(need),
            "ready_rows": ready,
            "blocked_rows": blocked,
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
