# تعريب السلسلة + بطاقة شرح قدوة/رفق/المقصف للطالب
# تشغيل: python3 -m Core_Engine.nafs_combo_counsel_explain_test
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Core_Engine.nafs_counsel_boost import (  # noqa: E402
    CAFETERIA_POINTS_PER_VOUCHER,
    STUDENT_BOOST_HOWTO,
    STUDENT_BOOST_LEGEND,
    student_boost_explain,
)

GAMES_JS = ROOT / "Print_Canvas" / "js" / "portal-student-games.js"
PORTAL_JS = ROOT / "Print_Canvas" / "js" / "portal-student.js"
PORTAL_HTML = ROOT / "Print_Canvas" / "portal-student.html"
CSS = ROOT / "Print_Canvas" / "css" / "portal-student.css"
BOOST_PY = ROOT / "Core_Engine" / "nafs_counsel_boost.py"
SESSION_API = ROOT / "Core_Engine" / "portal_session_api.py"
FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)


def main() -> int:
    errors: list[str] = []

    pack = student_boost_explain()
    if not pack.get("ok"):
        errors.append("student_boost_explain.ok missing")
    titles = [p.get("title") for p in pack.get("programs") or []]
    if titles != ["قدوة", "رفق", "المقصف"]:
        errors.append(f"unexpected program titles: {titles}")
    for key in ("قدوة", "رفق", "مقصف"):
        if key not in STUDENT_BOOST_LEGEND or key not in STUDENT_BOOST_HOWTO:
            errors.append(f"legend/howto missing for {key}")
    caf = next((p for p in pack["programs"] if p.get("id") == "cafeteria"), None)
    if not caf:
        errors.append("cafeteria program missing")
    elif int(caf.get("threshold") or 0) != CAFETERIA_POINTS_PER_VOUCHER:
        errors.append("cafeteria threshold must match saved rule (5)")
    elif caf.get("threshold_ar") != "٥":
        errors.append("cafeteria threshold_ar must be eastern ٥")
    blob = " ".join(
        [
            pack.get("blurb") or "",
            *(p.get("meaning") or "" for p in pack["programs"]),
            *(p.get("howto") or "" for p in pack["programs"]),
        ]
    )
    for banned in ("rifq-", "qodwa-", "vault-recover", "event_key", "portal_behavior"):
        if banned in blob:
            errors.append(f"student card leaked technical key: {banned}")
    if pack.get("etec_ar") != "٢-١-١-٥":
        errors.append("etec_ar must stay eastern from ETEC_BEHAVIOR")

    games_js = GAMES_JS.read_text(encoding="utf-8")
    if "function formatComboHud" not in games_js:
        errors.append("formatComboHud missing")
    if 'سلسلة ×"' not in games_js and "سلسلة ×" not in games_js:
        errors.append("Arabic combo label missing in games js")
    if "Combo ×" in games_js:
        errors.append("English Combo label must be removed from games HUD")
    if "أفضل سلسلة" not in games_js:
        errors.append("end-round best-combo label missing")
    if "Number(combo) > 0" not in games_js:
        errors.append("end-round combo must require real saved best > 0")

    portal_js = PORTAL_JS.read_text(encoding="utf-8")
    if "behavior_explain" not in portal_js or "behavior-explain-card" not in portal_js:
        errors.append("portal-student must render behavior_explain card")

    html = PORTAL_HTML.read_text(encoding="utf-8")
    if 'id="behavior-explain"' not in html:
        errors.append("portal-student.html missing behavior-explain host")

    css = CSS.read_text(encoding="utf-8")
    if ".behavior-explain-card" not in css:
        errors.append("behavior-explain CSS missing")

    session_api = SESSION_API.read_text(encoding="utf-8")
    if "student_boost_explain" not in session_api or "behavior_explain" not in session_api:
        errors.append("home payload must attach behavior_explain")

    boost_py = BOOST_PY.read_text(encoding="utf-8")
    if "/api/portal/boost/explain" not in boost_py:
        errors.append("student boost explain endpoint missing")
    if "CAFETERIA_POINTS_PER_VOUCHER" not in boost_py:
        errors.append("cafeteria threshold constant missing")

    for path in FORTIFIED:
        # محصّنات: التحقق من الوجود فقط — لا تعديل في هذه الموجة
        if not path.exists():
            errors.append(f"fortified path missing: {path.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK nafs_combo_counsel_explain_test")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
