# موجة د: مذكرة نافس لغتي — ١٤ تدريباً / ١٤٠ سؤالاً (فهم قرائي)
# المصدر: مذكرة أ. ذاكر الشمري · ثالث متوسط
# المفاتيح من تظليل النسخة المجابة (OMR) · بلا اختلاق مفاتيح.
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .nafs_challenge_tiers import TIER_AMATEUR, TIER_ELITE, TIER_PRO, tier_by_id

EASTERN = "٠١٢٣٤٥٦٧٨٩"
PACK_SOURCE = "مذكرة نافس لغتي · ثالث متوسط · أ. ذاكر الشمري"
BANK_TAG = "wave-d-lughati140"
DATA_PATH = Path(__file__).resolve().parent / "data" / "nafs_wave_d_lughati140.json"

TIER_TO_ROOT = {
    TIER_AMATEUR: "١م",
    TIER_PRO: "٢م",
    TIER_ELITE: "٣م",
}

SKILL_BY_TIER = {
    TIER_AMATEUR: "الفهم الصريح والفكرة الرئيسة",
    TIER_PRO: "المعنى من السياق والاستدلال",
    TIER_ELITE: "الرأي والحقيقة والتفكير الناقد",
}

LETTER_EN = {"أ": "A", "ب": "B", "ج": "C", "د": "D"}


def _e(value: Any) -> str:
    out: list[str] = []
    for ch in str(value):
        if ch.isdigit():
            out.append(EASTERN[int(ch)])
        else:
            out.append(ch)
    return "".join(out)


def load_pack() -> list[dict[str, Any]]:
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, list) or len(raw) != 14:
        raise ValueError("wave-d pack must contain 14 trainings")
    return raw


def _q_from_item(
    *,
    training: dict[str, Any],
    item: dict[str, Any],
    sort_order: int,
) -> dict[str, Any]:
    tier_id = str(item.get("tier") or TIER_PRO)
    if tier_id not in (TIER_AMATEUR, TIER_PRO, TIER_ELITE):
        tier_id = TIER_PRO
    tier = tier_by_id(tier_id)
    correct = str(item.get("correct_en") or LETTER_EN.get(item.get("correct") or "", "")).upper()
    if correct not in ("A", "B", "C", "D"):
        raise ValueError(f"invalid key training={training.get('training')} n={item.get('n')}")
    n = int(item["n"])
    t = int(training["training"])
    title = str(training.get("title") or f"تدريب نافس رقم {_e(t)}")
    passage = str(training.get("passage") or "").strip()
    passage_note = str(training.get("passage_note") or "").strip()
    skill = SKILL_BY_TIER[tier_id]
    stem = str(item.get("stem") or "").strip()
    a = str(item.get("choice_a") or "").strip()
    b = str(item.get("choice_b") or "").strip()
    c = str(item.get("choice_c") or "").strip()
    d = str(item.get("choice_d") or "").strip()
    if not (stem and a and b and c and d):
        raise ValueError(f"incomplete item T{t}Q{n}")
    # وسم المصدر داخل الجذع لمنع إسقاط التكرارات عبر التدريبات (نفس صياغة السؤال في أكثر من نص)
    source_ref = f"ت{_e(t)}-س{_e(n)}"
    stem_unique = f"﴿{source_ref}﴾ {stem}"
    # لا نختلق نص القراءة: إن كان المقطع المشوّه بالمسح قد صُفّي، نُبقي إحالة المصدر فقط
    if passage:
        passage_text = passage
    elif passage_note:
        passage_text = f"{PACK_SOURCE} · {title} · {passage_note}"
    else:
        passage_text = f"{PACK_SOURCE} · {title}"
    return {
        "domain": "reading",
        "skill": skill,
        "stem": stem_unique,
        "choice_a": a,
        "choice_b": b,
        "choice_c": c,
        "choice_d": d,
        "correct": correct,
        "rationale": f"{title} · البند {_e(n)} · مفتاح موثّق من النسخة المجابة",
        "passage_id": f"{BANK_TAG}:t{t:02d}",
        "passage_title": title,
        "passage_text": passage_text,
        "sort_order": sort_order,
        "common_mistake": "الإجابة من الذاكرة دون الرجوع إلى النص أو خلط الحقيقة بالرأي.",
        "grade_root": TIER_TO_ROOT[tier_id],
        "golden_rule": "ارجع إلى النص أولاً · ميّز الصريح من المستنتج · فرّق الحقيقة عن الرأي.",
        "pack": title,
        "tier": tier.get("id"),
        "tier_label": tier.get("label"),
        "source_ref": source_ref,
        "bank_tag": BANK_TAG,
        "training": t,
        "item_n": n,
    }


def wave_d_questions() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    sort_base = 14000
    for training in load_pack():
        items = training.get("items") or []
        if len(items) != 10:
            raise ValueError(f"training {training.get('training')} must have 10 items")
        for item in items:
            rows.append(
                _q_from_item(
                    training=training,
                    item=item,
                    sort_order=sort_base + int(training["training"]) * 10 + int(item["n"]),
                )
            )
    if len(rows) != 140:
        raise AssertionError(f"expected 140 got {len(rows)}")
    tiers = {r["tier"] for r in rows}
    if not tiers >= {TIER_AMATEUR, TIER_PRO, TIER_ELITE}:
        raise AssertionError(f"tiers incomplete {tiers}")
    return rows


def wave_d_training_index() -> list[dict[str, Any]]:
    out = []
    for training in load_pack():
        items = training.get("items") or []
        tier_counts: dict[str, int] = {}
        for item in items:
            tid = str(item.get("tier") or TIER_PRO)
            tier_counts[tid] = tier_counts.get(tid, 0) + 1
        out.append(
            {
                "training": int(training["training"]),
                "training_ar": training.get("training_ar") or _e(training["training"]),
                "title": training.get("title"),
                "item_count": len(items),
                "item_count_ar": _e(len(items)),
                "tiers": tier_counts,
                "mock_hint": _mock_hint(int(training["training"])),
            }
        )
    return out


def _mock_hint(training_no: int) -> str:
    """ربط تدريبي خفيف بمحاكاة Mock 1–4 دون اختلاق أسئلة."""
    if training_no <= 4:
        return "Mock 1"
    if training_no <= 8:
        return "Mock 2"
    if training_no <= 11:
        return "Mock 3"
    return "Mock 4"


def items_by_tier() -> dict[str, list[dict[str, Any]]]:
    buckets = {TIER_AMATEUR: [], TIER_PRO: [], TIER_ELITE: []}
    for row in wave_d_questions():
        buckets.setdefault(row["tier"], []).append(row)
    return buckets


def mock_buckets() -> dict[str, list[dict[str, Any]]]:
    """توزيع التدريبات على Mock 1–4."""
    out = {"Mock 1": [], "Mock 2": [], "Mock 3": [], "Mock 4": []}
    for row in wave_d_questions():
        hint = _mock_hint(int(row["training"]))
        out.setdefault(hint, []).append(row)
    return out
