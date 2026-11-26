# موجة أ: سجل نافس المدرسي المتكامل 40341 — اختبار دخان
# تشغيل: python3 -m Core_Engine.nafs_school_record_40341_test
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Core_Engine.nafs_school_record_40341 import (  # noqa: E402
    AVERAGE_MASTERY_PCT,
    ENRICHMENT_N,
    ENROLLED,
    QUESTION_BANK_BASELINE,
    REMEDIAL_N,
    TESTED,
    build_school_record_pack,
    mock_schedule,
    tracks_pack,
)
ANALYTICS_JS = ROOT / "Print_Canvas" / "js" / "app-journey-nafs-analytics.js"
ANALYTICS_CSS = ROOT / "Print_Canvas" / "css" / "app-journey-nafs-analytics.css"
SHELL_CSS = ROOT / "Print_Canvas" / "css" / "print-shell.css"
MASTER_CSS = ROOT / "Print_Canvas" / "css" / "print-master.css"
SESSION_API = ROOT / "Core_Engine" / "nafs_session_api.py"
RECORD_PY = ROOT / "Core_Engine" / "nafs_school_record_40341.py"
CANONICAL = ROOT / "config" / "performance_metrics.json"


def main() -> int:
    errors: list[str] = []

    if ENROLLED != 111 or TESTED != 101 or AVERAGE_MASTERY_PCT != 29.7:
        errors.append("core card constants")
    if REMEDIAL_N != 76 or ENRICHMENT_N != 25:
        errors.append("tracks must be 76/25")
    if QUESTION_BANK_BASELINE != 86:
        errors.append("bank baseline 86")

    tracks = tracks_pack(tested=101)
    if tracks["remedial"] != 76 or tracks["enrichment"] != 25:
        errors.append(f"tracks_pack unexpected {tracks}")
    # لا إعادة توزيع مختلقة عند اختلاف tested
    tracks2 = tracks_pack(tested=90)
    if tracks2["remedial"] != 76 or tracks2["enrichment"] != 25:
        errors.append("must not reinvent track split")

    mocks = mock_schedule()
    if len(mocks) != 4 or mocks[0]["name"] != "Mock 1":
        errors.append("mock schedule")
    if not all(m.get("tier_label") for m in mocks):
        errors.append("mock tiers labels")
    # Mock 3 → محترفين عبر mode=mock في taxonomy
    if mocks[2].get("tier") != "pro":
        errors.append(f"Mock 3 should map to pro got {mocks[2]}")

    pack = build_school_record_pack(question_bank_count=86)
    if pack["meta"]["enrolled"] != 111 or pack["school"]["code"] != "40341":
        errors.append("school pack identity")
    if pack["question_bank"]["baseline"] != 86:
        errors.append("pack bank baseline")
    if len(pack.get("etec") or []) != 3:
        errors.append("etec 3-1-1-1..3")

    api = SESSION_API.read_text(encoding="utf-8")
    record_src = RECORD_PY.read_text(encoding="utf-8")
    if "school-record" not in api:
        errors.append("api school-record missing")
    if "remedial_share" in api:
        errors.append("invented remedial_share must be removed from dossier")
    if "tracks_pack" not in api or "mock_tiers" not in api:
        errors.append("dossier must wire tracks_pack + mock_tiers")
    if "REMEDIAL_N = 76" not in record_src:
        errors.append("documented remedial constant")

    js = ANALYTICS_JS.read_text(encoding="utf-8")
    css = ANALYTICS_CSS.read_text(encoding="utf-8")
    for needle in ("مسار علاجي / إثرائي", "etec-code", "mock_tiers", "question_bank_baseline"):
        if needle not in js:
            errors.append(f"js missing {needle}")
    if "table-layout: fixed" not in css or "etec-code" not in css:
        errors.append("css print column / etec")

    shell = SHELL_CSS.read_text(encoding="utf-8")
    master = MASTER_CSS.read_text(encoding="utf-8")
    if "counter-reset: page" in shell or "counter-reset: page" in master:
        errors.append("page counter-reset must be removed to fix ٠ من ٠")
    if "pm-pages-num[data-total]" not in shell:
        errors.append("shell must honor data-total")

    canonical = json.loads(CANONICAL.read_text(encoding="utf-8"))
    meta = (canonical.get("nafes") or {}).get("meta") or {}
    if meta.get("enrolled_count") != 111 or meta.get("remedial_count") != 76:
        errors.append("canonical metrics missing enrolled/tracks")

    for locked in (
        ROOT / "Print_Canvas" / "js" / "erp-nav.js",
        ROOT / "Print_Canvas" / "js" / "erp-suite.js",
        ROOT / "Print_Canvas" / "dashboard.html",
    ):
        if not locked.exists():
            continue
        # لا نلمس المحصّنات في هذه الموجة
        pass

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK nafs-school-record-40341")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
