# مسارا تدريب + طباعة لنموذج الإجابة ١-٤…٤-٤ في محطة اختبار محاكي
# تشغيل: python3 -m Core_Engine.nafs_answer_sheet_train_print_test
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

HTML = ROOT / "Print_Canvas" / "portal-student.html"
ADAPTIVE = ROOT / "Print_Canvas" / "js" / "portal-student-adaptive.js"
WAVE_JS = ROOT / "Print_Canvas" / "js" / "nafs-wave-c-answer-sheet.js"
CSS = ROOT / "Print_Canvas" / "css" / "portal-student.css"
FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)


def main() -> int:
    errors: list[str] = []
    html = HTML.read_text(encoding="utf-8")
    adaptive = ADAPTIVE.read_text(encoding="utf-8")
    wave = WAVE_JS.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")

    for needle in (
        'id="btn-nafs-answer-sheet-train"',
        'id="btn-nafs-answer-sheet-print"',
        'id="answer-sheet-train-stage"',
        'id="portal-nafs-answer-sheet-host"',
        'id="btn-answer-sheet-train-back"',
        'id="sim-action-hub"',
    ):
        if needle not in html:
            errors.append(f"html missing {needle}")

    sim = html.split('data-station="sim"')[1].split("data-station=")[0]
    if "معاينة وتدريب" not in sim or "طباعة نموذج" not in sim:
        errors.append("sim station must offer train + print cards")

    for needle in (
        "openAnswerSheetTraining",
        "openAnswerSheetPrint",
        "mountInteractive",
        "showAnswerSheetTrainStage",
        "btn-nafs-answer-sheet-train",
        "btn-nafs-answer-sheet-print",
    ):
        if needle not in adaptive:
            errors.append(f"adaptive missing {needle}")

    if "nafs-c-train-hint" not in wave or "nafs-c-train-host" not in wave:
        errors.append("wave-c mountInteractive must mark train mode")
    if "mountInteractive" not in wave or "openPrint" not in wave:
        errors.append("wave-c API incomplete")

    if "answer-sheet-train-stage" not in css or "portal-nafs-answer-sheet-host" not in css:
        errors.append("css missing train stage styles")

    for path in FORTIFIED:
        if not path.exists():
            errors.append(f"fortified missing {path.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK nafs_answer_sheet_train_print_test")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
