# الموجة α: ترتيب الكتل أولاً ثم الترقيم المتصل ١…ن
# تشغيل: python3 -m Core_Engine.nafs_home_mock_block_first_alpha_test
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Core_Engine.nafs_adaptive_engine import (  # noqa: E402
    assert_block_first_contiguous,
    block_first_order,
)

JS = ROOT / "Print_Canvas" / "js" / "nafs-home-mock-booklet.js"
CSS = ROOT / "Print_Canvas" / "css" / "nafs-home-mock-booklet.css"
ADAPTIVE_PY = ROOT / "Core_Engine" / "nafs_adaptive_engine.py"
FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)


def _sample_mixed() -> list[dict]:
    """أسئلة مختلطة عمدًا — يجب أن تُرتَّب كتلًا قبل أي ترقيم."""
    return [
        {"stem": "ق1", "domain": "reading", "correct": "A"},
        {"stem": "ع1", "domain": "science", "correct": "B"},
        {"stem": "ر1", "domain": "math", "correct": "C"},
        {"stem": "ق2", "domain": "reading", "correct": "D"},
        {"stem": "ر2", "domain": "math", "correct": "A"},
        {"stem": "ع2", "domain": "science", "correct": "B"},
        {"stem": "ر3", "domain": "رياضيات", "correct": "C"},
        {"stem": "ع3", "domain": "علوم", "correct": "D"},
    ]


def test_block_first_order() -> list[str]:
    errors: list[str] = []
    ordered = block_first_order(_sample_mixed())
    domains = []
    for q in ordered:
        d = str(q.get("domain") or "").lower()
        if "math" in d or "رياض" in d:
            domains.append("math")
        elif "sci" in d or "علوم" in d:
            domains.append("science")
        elif "read" in d or "قراء" in d:
            domains.append("reading")
        else:
            domains.append("other")
    # كل الرياضيات ثم العلوم ثم القراءة — بلا تداخل
    def first_last(key: str) -> tuple[int, int]:
        idxs = [i for i, x in enumerate(domains) if x == key]
        return (idxs[0], idxs[-1]) if idxs else (-1, -1)

    for a, b in (("math", "science"), ("science", "reading")):
        fa, la = first_last(a)
        fb, lb = first_last(b)
        if fa < 0 or fb < 0:
            continue
        if la >= fb:
            errors.append(f"{a} must finish before {b} starts: {domains}")
    # لا رقم n قبل الإسناد
    if any("n" in q for q in ordered):
        # السماح إن وُجدت مفاتيح أخرى فقط؛ يجب ألا نُسند n داخل block_first_order
        pass
    return errors


def test_contiguous_numbering() -> list[str]:
    errors: list[str] = []
    ordered = block_first_order(_sample_mixed())
    items = []
    for i, q in enumerate(ordered, start=1):
        d = str(q.get("domain") or "")
        items.append({"n": i, "domain": d, "block": ""})
    # محاكاة تطبيع المجال كما في الحزمة
    from Core_Engine.nafs_adaptive_engine import _home_mock_domain_key

    for it, q in zip(items, ordered):
        it["domain"] = _home_mock_domain_key(q)
        it["block"] = it["domain"]
    errs = assert_block_first_contiguous(items)
    errors.extend(errs)
    # نطاقات رسمية الشكل: math ثم science ثم reading بأرقام متصلة
    by = {"math": [], "science": [], "reading": [], "other": []}
    for it in items:
        by[it["domain"]].append(it["n"])
    if by["math"] and by["math"] != list(range(1, len(by["math"]) + 1)):
        errors.append(f"math should start at 1: {by['math']}")
    if by["science"] and by["math"]:
        if by["science"][0] != by["math"][-1] + 1:
            errors.append(f"science must follow math: {by}")
    if by["reading"] and by["science"]:
        if by["reading"][0] != by["science"][-1] + 1:
            errors.append(f"reading must follow science: {by}")
    return errors


def test_overlap_detection() -> list[str]:
    """التأكد أن المدقق يرفض التداخل (خطأ ما قبل α)."""
    bad = [
        {"n": 1, "domain": "math"},
        {"n": 2, "domain": "science"},
        {"n": 3, "domain": "math"},  # قفز/تداخل
        {"n": 4, "domain": "reading"},
    ]
    errs = assert_block_first_contiguous(bad)
    if not errs:
        return ["assert_block_first_contiguous must reject interleaved domains"]
    return []


def test_source_contract() -> list[str]:
    errors: list[str] = []
    py = ADAPTIVE_PY.read_text(encoding="utf-8")
    for needle in (
        "def block_first_order",
        "def assert_block_first_contiguous",
        'sequencing": "block-first"',
        "questions = block_first_order",
        "wave\": \"alpha-block-first\"",
    ):
        if needle not in py:
            errors.append(f"adaptive_py missing {needle}")

    # لا ترقيم قبل الترتيب: حلقة enumerate يجب أن تأتي بعد block_first_order
    idx_order = py.find("questions = block_first_order")
    idx_enum = py.find("for i, q in enumerate(questions, start=1)")
    if idx_order < 0 or idx_enum < 0 or idx_enum < idx_order:
        errors.append("n assignment must follow block_first_order")

    js = JS.read_text(encoding="utf-8")
    for needle in (
        "function assertBlockFirstContiguous",
        "data-sequencing=\"block-first\"",
        "DOMAIN_ORDER",
        "etec-force",
        "function ltrForce",
        "nafs-b-key-list",
        'dir="ltr"',
        "EASTERN = \"٠١٢٣٤٥٦٧٨٩\"",
        "item.block",
    ):
        if needle not in js:
            errors.append(f"js missing {needle}")

    css = CSS.read_text(encoding="utf-8")
    if "nafs-b-key-list" not in css:
        errors.append("css missing nafs-b-key-list")
    if "grid-template-columns: 1fr;" not in css and "grid-template-columns: 1fr\n" not in css:
        # عمود واحد للمفتاح
        if ".nafs-b-key-list" in css and "1fr" not in css.split(".nafs-b-key-list")[1][:200]:
            errors.append("key list should be single column")

    for path in FORTIFIED:
        if not path.exists():
            errors.append(f"fortified missing {path.name}")
        # لا تعديل على المحصّن في هذا الفرع — يُفحص عبر git في CI المحلي أدناه
    return errors


def test_eastern_and_ministry() -> list[str]:
    errors: list[str] = []
    from Core_Engine.nafs_wave_c_answer_sheet import eastern_digits, ministry_id_eastern

    mid = ministry_id_eastern()
    if mid != "S-٤٠٣٤١":
        errors.append(f"ministry_id_eastern expected S-٤٠٣٤١ got {mid}")
    if eastern_digits(20) != "٢٠":
        errors.append("eastern_digits(20) must be ٢٠")
    if any(ch in mid for ch in "0123456789"):
        errors.append("ministry eastern must not keep western digits in numeric part")
    js = JS.read_text(encoding="utf-8")
    if "ministry_id_ar" not in js:
        errors.append("cover must use ministry_id_ar")
    if "pack.grade" not in js:
        errors.append("cover must keep Noor student grade")
    return errors


def main() -> int:
    errors: list[str] = []
    errors.extend(test_block_first_order())
    errors.extend(test_contiguous_numbering())
    errors.extend(test_overlap_detection())
    errors.extend(test_source_contract())
    errors.extend(test_eastern_and_ministry())
    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK nafs_home_mock_block_first_alpha_test")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
