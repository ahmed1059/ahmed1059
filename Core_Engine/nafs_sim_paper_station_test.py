# محطة «اختبار محاكي» في ميدان نافس
# تشغيل: python3 -m Core_Engine.nafs_sim_paper_station_test
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

HTML = ROOT / "Print_Canvas" / "portal-student.html"
STATIONS_JS = ROOT / "Print_Canvas" / "js" / "portal-student-stations.js"
ADAPTIVE_JS = ROOT / "Print_Canvas" / "js" / "portal-student-adaptive.js"
CSS = ROOT / "Print_Canvas" / "css" / "portal-student.css"
FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)


def main() -> int:
    errors: list[str] = []
    html = HTML.read_text(encoding="utf-8")
    stations = STATIONS_JS.read_text(encoding="utf-8")
    adaptive = ADAPTIVE_JS.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")

    if 'id: "sim"' not in stations and "id: 'sim'" not in stations:
        errors.append("stations must register sim")
    if "اختبار محاكي" not in stations:
        errors.append("station title اختبار محاكي")
    if "OMR · نموذج" not in stations and "OMR" not in stations:
        errors.append("sim subtitle should mention OMR")
    if 'icon: "sim"' not in stations and "sim:" not in stations:
        errors.append("sim icon svg missing")
    if 'Vault · مؤشر إتقان · OMR' in stations:
        errors.append("purge subtitle must no longer advertise OMR")

    if 'data-station="sim"' not in html:
        errors.append("html missing sim panel")
    if 'id="btn-home-mock"' not in html or 'id="btn-nafs-answer-sheet"' not in html:
        errors.append("action button ids must remain for adaptive bind")
    # الزرّان داخل محطة sim لا purge
    purge_chunk = html.split('data-station="purge"')[1].split("data-station=")[0]
    if "btn-home-mock" in purge_chunk or "btn-nafs-answer-sheet" in purge_chunk:
        errors.append("OMR/answer-sheet buttons must leave purge station")
    sim_chunk = html.split('data-station="sim"')[1].split("data-station=")[0]
    if "btn-home-mock" not in sim_chunk or "btn-nafs-answer-sheet" not in sim_chunk:
        errors.append("both actions must live inside sim station")

    if 'btn-home-mock' not in adaptive or "btn-nafs-answer-sheet" not in adaptive:
        errors.append("adaptive must still bind action ids")

    if "tone-indigo" not in css or "sim-action-grid" not in css:
        errors.append("css missing indigo tone / sim-action-grid")

    if "doc-official-header" in html.split('data-station="sim"')[1].split("data-station=")[0]:
        errors.append("must not use fortified official header in sim station")

    for path in FORTIFIED:
        if not path.exists():
            errors.append(f"fortified missing {path.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK nafs_sim_paper_station_test")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
