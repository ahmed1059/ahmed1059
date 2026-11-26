# موجة التحقق النهائي — تكامل بنك نافس + ختام الجولة + نموذج A4 بعد دمج #78
# بلا اختلاق بيانات · أرقام هندية · ETEC LTR · محصّنات بلا مساس.
from __future__ import annotations

import re
import sqlite3
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
EASTERN = set("٠١٢٣٤٥٦٧٨٩")
WESTERN = set("0123456789")
FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)
EXPECTED_BANK = 330
EXPECTED_REVISION = "visual-diagram-gate-1"
EXPECTED_WAVE_D = 140
EXPECTED_WAVE_B = 30
EXPECTED_GOLDEN = 22
EXPECTED_TRAPS = 66


def verify_fortified_untouched() -> list[str]:
    errors: list[str] = []
    for path in FORTIFIED:
        if not path.is_file():
            errors.append(f"fortified missing: {path.name}")
    return errors


def verify_question_bank() -> dict[str, Any]:
    from .nafs_challenge_tiers import TIER_AMATEUR, TIER_ELITE, TIER_PRO
    from .nafs_misconception_lab import GOLDEN_DECK, build_trap_album
    from .nafs_question_bank_seed import (
        BANK_REVISION,
        EXPECTED_MIN_COUNT,
        all_questions,
        ensure_nafs_question_bank,
    )
    from .nafs_wave_d_lughati140 import items_by_tier, mock_buckets, wave_d_questions

    errors: list[str] = []
    rows = all_questions()
    if BANK_REVISION != EXPECTED_REVISION:
        errors.append(f"revision={BANK_REVISION}")
    if EXPECTED_MIN_COUNT < 300:
        errors.append(f"EXPECTED_MIN_COUNT={EXPECTED_MIN_COUNT}")
    if len(rows) < EXPECTED_BANK:
        errors.append(f"bank={len(rows)} < {EXPECTED_BANK}")
    if len(rows) != len({(r["domain"], (r["stem"] or "").strip()) for r in rows}):
        errors.append("duplicate stems")

    by_domain = {"math": 0, "reading": 0, "science": 0}
    for r in rows:
        by_domain[r["domain"]] = by_domain.get(r["domain"], 0) + 1
        if not all(
            str(r.get(k) or "").strip()
            for k in ("stem", "choice_a", "choice_b", "choice_c", "choice_d", "correct")
        ):
            errors.append("incomplete row")
            break
        if str(r.get("correct") or "").upper() not in ("A", "B", "C", "D"):
            errors.append(f"bad key {r.get('correct')}")
            break
        if r["domain"] in ("math", "science"):
            blob = " ".join(
                str(r.get(k) or "")
                for k in ("stem", "choice_a", "choice_b", "choice_c", "choice_d", "rationale")
            )
            if re.search(r"[0-9]", blob):
                errors.append("western digit in math/science")
                break

    if by_domain["reading"] < 140:
        errors.append(f"reading={by_domain['reading']}")
    if by_domain["math"] < 50:
        errors.append(f"math={by_domain['math']}")
    if by_domain["science"] < 50:
        errors.append(f"science={by_domain['science']}")

    wave_b = [r for r in rows if str(r.get("passage_id") or "").startswith("wave-b-212223")]
    wave_d = [r for r in rows if str(r.get("passage_id") or "").startswith("wave-d-lughati140")]
    if len(wave_b) != EXPECTED_WAVE_B:
        errors.append(f"wave_b={len(wave_b)}")
    if len(wave_d) != EXPECTED_WAVE_D:
        errors.append(f"wave_d={len(wave_d)}")

    d_rows = wave_d_questions()
    if len(d_rows) != EXPECTED_WAVE_D:
        errors.append(f"wave_d_questions={len(d_rows)}")
    tiers = items_by_tier()
    for tid in (TIER_AMATEUR, TIER_PRO, TIER_ELITE):
        if len(tiers.get(tid) or []) < 20:
            errors.append(f"tier {tid} thin")
    mocks = mock_buckets()
    expected_mocks = {"Mock 1": 40, "Mock 2": 40, "Mock 3": 30, "Mock 4": 30}
    for name, count in expected_mocks.items():
        if len(mocks.get(name) or []) != count:
            errors.append(f"{name}={len(mocks.get(name) or [])}")
    for r in d_rows:
        root_map = {"١م": TIER_AMATEUR, "٢م": TIER_PRO, "٣م": TIER_ELITE}
        if r.get("tier") != root_map.get(r.get("grade_root")):
            errors.append("wave_d grade_root/tier mismatch")
            break
        if any(c in WESTERN for c in (r.get("source_ref") or "") + (r.get("grade_root") or "")):
            errors.append("wave_d western in refs")
            break
        if not (r.get("golden_rule") or "").strip() or not (r.get("common_mistake") or "").strip():
            errors.append("wave_d missing trap/golden fields")
            break

    album = build_trap_album()
    if len(GOLDEN_DECK) < EXPECTED_GOLDEN:
        errors.append(f"golden={len(GOLDEN_DECK)}")
    if len(album) != EXPECTED_TRAPS:
        errors.append(f"traps={len(album)}")
    if len({a.get("id") or a.get("trap_key") for a in album}) != EXPECTED_TRAPS:
        errors.append("trap album ids not unique")

    with tempfile.TemporaryDirectory() as tmp:
        conn = sqlite3.connect(str(Path(tmp) / "final.db"))
        result = ensure_nafs_question_bank(conn, force_reseed=True)
        conn.commit()
        stored = conn.execute(
            "SELECT COUNT(*) FROM nafs_question_bank WHERE COALESCE(active,1)=1"
        ).fetchone()[0]
        empty = conn.execute(
            "SELECT COUNT(*) FROM nafs_question_bank WHERE trim(stem)='' OR trim(choice_a)=''"
        ).fetchone()[0]
        bad = conn.execute(
            "SELECT COUNT(*) FROM nafs_question_bank WHERE UPPER(correct) NOT IN ('A','B','C','D')"
        ).fetchone()[0]
        conn.close()
        if stored < EXPECTED_BANK:
            errors.append(f"stored={stored}")
        if empty:
            errors.append(f"empty fields={empty}")
        if bad:
            errors.append(f"bad keys={bad}")
        if result.get("revision") != EXPECTED_REVISION:
            errors.append("seed revision mismatch")

    return {
        "ok": not errors,
        "errors": errors,
        "bank": len(rows),
        "by_domain": by_domain,
        "wave_b": len(wave_b),
        "wave_d": len(wave_d),
        "tiers": {k: len(v) for k, v in tiers.items()},
        "mocks": {k: len(v) for k, v in mocks.items()},
        "golden": len(GOLDEN_DECK),
        "traps": len(album),
        "revision": BANK_REVISION,
        "stored": stored,
    }


def verify_endround() -> dict[str, Any]:
    from .nafs_endround_legend import LEGEND_TIERS, build_rank_gap, legend_from_xp
    from .nafs_endround_progress import (
        annotate_progress,
        build_progress_pulse,
        normalize_attempt,
    )

    errors: list[str] = []
    bare = normalize_attempt(
        {
            "id": 1,
            "score": 4,
            "combo_best": 0,
            "detail_json": "{}",
            "game_type": "words",
            "created_at": "",
        },
        abs_index=1,
    )
    if bare.get("total") != 0 or bare.get("accuracy_pct") is not None:
        errors.append("invented total/accuracy without detail.total")

    filled = normalize_attempt(
        {
            "id": 2,
            "score": 8,
            "combo_best": 1,
            "detail_json": '{"total": 10, "elapsed": 12}',
            "game_type": "words",
            "created_at": "",
        },
        abs_index=2,
    )
    if filled.get("total") != 10 or filled.get("accuracy_pct") != 80:
        errors.append("accuracy from real total broken")

    pulse = build_progress_pulse(
        [
            {
                "id": 1,
                "score": 3,
                "combo_best": 0,
                "detail_json": '{"total": 5, "elapsed": 20}',
                "game_type": "words",
                "created_at": "2026-01-01",
            },
            {
                "id": 2,
                "score": 4,
                "combo_best": 1,
                "detail_json": '{"total": 5, "elapsed": 15}',
                "game_type": "words",
                "created_at": "2026-01-02",
            },
            {
                "id": 3,
                "score": 5,
                "combo_best": 2,
                "detail_json": '{"total": 5, "elapsed": 10}',
                "game_type": "words",
                "created_at": "2026-01-03",
            },
        ],
        limit=7,
    )
    if pulse.get("count") != 3 or pulse.get("total_runs") != 3:
        errors.append("progress pulse counts")
    cols = pulse.get("attempts") or []
    if [c.get("n_ar") for c in cols] != ["١", "٢", "٣"]:
        errors.append(f"column labels {[c.get('n_ar') for c in cols]}")
    if any(c in WESTERN for c in "".join(c.get("n_ar") or "" for c in cols)):
        errors.append("western in column labels")
    if "best" not in (cols[-1].get("badges") or []):
        errors.append("best badge missing on top attempt")
    if "start" not in (cols[0].get("badges") or []):
        errors.append("start badge missing")

    # annotate بدون total لا يخترع ارتفاع من أرقام وهمية فقط عبر score النسبي داخل السلسلة
    annotated = annotate_progress(
        [
            normalize_attempt(
                {
                    "id": 9,
                    "score": 2,
                    "combo_best": 0,
                    "detail_json": "{}",
                    "game_type": "words",
                    "created_at": "",
                },
                abs_index=1,
            )
        ]
    )
    if annotated and annotated[0].get("total_ar") not in ("", "٠"):
        # total_ar فارغ عندما total=0
        if annotated[0].get("total"):
            errors.append("total_ar invented")

    legend = legend_from_xp(700)
    if legend.get("title") != "أسطورة نافس":
        errors.append("legend title at 700")
    if legend.get("xp_total_ar") != "٧٠٠":
        errors.append("legend xp eastern")
    titles = [t["title"] for t in LEGEND_TIERS]
    if "أسطورة نافس" not in titles or len(LEGEND_TIERS) != 5:
        errors.append("legend ladder")

    gap_hidden = build_rank_gap(
        [{"national_id": "a", "xp": 10}, {"national_id": "b", "xp": 5}],
        "a",
    )
    if gap_hidden.get("visible") is not False:
        errors.append("rank gap should hide with few peers")

    gap_ok = build_rank_gap(
        [
            {"national_id": "a", "xp": 30},
            {"national_id": "b", "xp": 20},
            {"national_id": "c", "xp": 10},
        ],
        "b",
    )
    if gap_ok.get("visible") is not True or gap_ok.get("rank") != 2:
        errors.append("rank gap visibility/rank")

    # مسارات الملفات المرتبطة
    progress_py = ROOT / "Core_Engine" / "nafs_endround_progress.py"
    legend_py = ROOT / "Core_Engine" / "nafs_endround_legend.py"
    portal_js = ROOT / "Print_Canvas" / "js" / "portal-student.js"
    games_js = ROOT / "Print_Canvas" / "js" / "portal-student-games.js"
    session_api = ROOT / "Core_Engine" / "portal_session_api.py"
    for path in (progress_py, legend_py, portal_js, games_js, session_api):
        if not path.is_file():
            errors.append(f"missing {path.name}")
    api = session_api.read_text(encoding="utf-8")
    if "/api/portal/leaderboards" not in api:
        errors.append("leaderboards route missing")
    if "build_progress_pulse" not in api or "fetch_challenge_runs" not in api:
        errors.append("endround wiring in portal_session_api")
    if "SUM(r.xp_earned)" not in api:
        errors.append("leaderboards must aggregate real xp")

    js = portal_js.read_text(encoding="utf-8")
    if "أسطورة نافس" not in js or "endround" not in js:
        errors.append("portal endround UI")
    games = games_js.read_text(encoding="utf-8")
    if "nafs-legend-bar" not in games or "end-round-rank" not in games:
        errors.append("games endround widgets")

    return {
        "ok": not errors,
        "errors": errors,
        "legend_title": legend.get("title"),
        "pulse_count": pulse.get("count"),
        "columns_ar": [c.get("n_ar") for c in cols],
    }


def verify_answer_sheet_a4() -> dict[str, Any]:
    from .nafs_wave_c_answer_sheet import (
        ANSWER_ITEM_COUNT,
        SCHOOL_CODE,
        build_training_form_pack,
        eastern_digits,
        questionnaire_items,
    )

    errors: list[str] = []
    pack = build_training_form_pack()
    pages = [p["code"] for p in pack.get("pages") or []]
    if pages != ["1-4", "2-4", "3-4", "4-4"]:
        errors.append(f"pages={pages}")
    if pack.get("school", {}).get("code") != SCHOOL_CODE:
        errors.append("school code")
    if pack.get("school", {}).get("code_ar") != eastern_digits(SCHOOL_CODE):
        errors.append("school code_ar")
    if pack.get("no_answer_key") is not True:
        errors.append("answer key must stay absent")
    items = questionnaire_items()
    if len(items) != 22:
        errors.append("questionnaire count")
    if any((it.get("stem") or "").strip() for it in items):
        errors.append("invented questionnaire stems")
    sheet = pack.get("answer_sheet") or {}
    if sheet.get("item_count") != ANSWER_ITEM_COUNT:
        errors.append("answer items")
    flat = [n for c in sheet.get("columns") or [] for n in (x["n"] for x in c["items"])]
    if flat != list(range(1, ANSWER_ITEM_COUNT + 1)):
        errors.append("answer numbering")
    if any(not (x.get("n_ar") and set(x["n_ar"]) <= EASTERN) for c in sheet.get("columns") or [] for x in c["items"]):
        errors.append("answer n_ar eastern")
    etec = sheet.get("etec_ltr") or []
    if "ETEC" not in etec:
        errors.append("ETEC LTR marker")

    js = (ROOT / "Print_Canvas" / "js" / "nafs-wave-c-answer-sheet.js").read_text(encoding="utf-8")
    css = (ROOT / "Print_Canvas" / "css" / "nafs-wave-c-answer-sheet.css").read_text(encoding="utf-8")
    print_shell = (ROOT / "Print_Canvas" / "css" / "print-shell.css").read_text(encoding="utf-8")

    if "ministry_id_ar" not in js and "school.code_ar || east(school.code" not in js:
        errors.append("js school code eastern path")
    if "ministry_id_ar" not in js:
        errors.append("js ministry_id_ar path")
    if "renderOmrOnly" not in js:
        errors.append("js OMR-only renderer")
    # في مصدر JS تظهر السمات داخل سلاسل مُهرَّبة: dir=\"ltr\"
    if "etec-ltr" not in js or 'dir=\\"ltr\\"' not in js:
        errors.append("js ETEC LTR attrs")
    if 'dir=\\"rtl\\"' not in js:
        errors.append("js RTL host")
    if "nafs-c-timing" not in css or "@media print" not in css or "A4" not in css:
        errors.append("css A4/timing/print")
    if "grid-template-columns: repeat(5, 1fr)" not in css:
        errors.append("answer columns grid")
    if "direction: ltr" not in css or "direction: rtl" not in css:
        errors.append("css rtl/ltr mix")
    # إصلاح «الصفحة ٠ من ٠» ما زال قائماً في print-shell
    if "لا تُصفَّر عدّادات page/pages" not in print_shell and "pm-pages-num" not in print_shell:
        errors.append("print-shell page counter guard missing")
    if "content: attr(data-total)" not in print_shell:
        errors.append("print-shell data-total fallback")

    # أعمدة الإجابة شبكة ثابتة — لا position:absolute عليها (التوقيت منفصل)
    if re.search(r"\.nafs-c-answer-col\s*\{[^}]*position:\s*absolute", css, re.S):
        errors.append("absolute overlap risk on answer cols")

    return {
        "ok": not errors,
        "errors": errors,
        "pages": pages,
        "answer_items": sheet.get("item_count"),
        "questionnaire": len(items),
        "school_code_ar": pack.get("school", {}).get("code_ar"),
    }


def run_final_verification() -> dict[str, Any]:
    fortified = verify_fortified_untouched()
    bank = verify_question_bank()
    endround = verify_endround()
    sheet = verify_answer_sheet_a4()
    errors = fortified + bank["errors"] + endround["errors"] + sheet["errors"]
    return {
        "ok": not errors,
        "errors": errors,
        "bank": bank,
        "endround": endround,
        "answer_sheet": sheet,
        "fortified_ok": not fortified,
        "revision": EXPECTED_REVISION,
        "expected_bank": EXPECTED_BANK,
    }
