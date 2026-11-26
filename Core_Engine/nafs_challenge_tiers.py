# مرجعية مستويات التحدي غير المباشرة — الهواة · المحترفين · النخبة
# تصنيف خفيف عبر أقسام البوابة الستة مع إرجاع آمن عند شحّ البنك.
from __future__ import annotations

from typing import Any

TIER_AMATEUR = "amateur"
TIER_PRO = "pro"
TIER_ELITE = "elite"

TIERS = (
    {
        "id": TIER_AMATEUR,
        "label": "الهواة",
        "blurb": "تأسيس واثق وخطوات ثابتة",
        "order": 1,
    },
    {
        "id": TIER_PRO,
        "label": "المحترفين",
        "blurb": "دقة أعلى وثبات تحت الوقت",
        "order": 2,
    },
    {
        "id": TIER_ELITE,
        "label": "النخبة",
        "blurb": "تحدٍ متقدم وسرعة واعية",
        "order": 3,
    },
)

# جذور الأخطاء الشائعة في ألبوم ٦٦
ROOT_TO_TIER = {
    "١م": TIER_AMATEUR,
    "2م": TIER_AMATEUR,  # احتياط إن وُجدت غربية
    "٢م": TIER_PRO,
    "٣م": TIER_ELITE,
    "3م": TIER_ELITE,
}

# مستويات الحساب الذهني الداخلية → المستوى غير المباشر
MENTAL_LEVEL_TO_TIER = {
    1: TIER_AMATEUR,
    2: TIER_AMATEUR,
    3: TIER_PRO,
    4: TIER_PRO,
    5: TIER_ELITE,
}

TIER_TO_MENTAL_LEVEL = {
    TIER_AMATEUR: 1,
    TIER_PRO: 3,
    TIER_ELITE: 5,
}

# أنماط التحدي في البوابة
MODE_TO_TIER = {
    "daily": TIER_AMATEUR,
    "rescue": TIER_AMATEUR,
    "mock": TIER_PRO,
    "duel": TIER_PRO,
    "purge": TIER_ELITE,
    "national": TIER_ELITE,
}

# القراءة المتزامنة — مستويات الأسئلة الوصفية
READALONG_LEVEL_TO_TIER = {
    "حرفي": TIER_AMATEUR,
    "دلالات": TIER_AMATEUR,
    "تفسيري": TIER_PRO,
    "استنتاجي": TIER_PRO,
    "تطبيقي": TIER_PRO,
    "ناقد": TIER_ELITE,
    "فكرة رئيسة": TIER_ELITE,
}

# أنواع جولات الكلمات
WORD_KIND_TO_TIER = {
    "meaning": TIER_AMATEUR,
    "synonym": TIER_PRO,
    "antonym": TIER_ELITE,
}

# أقسام المنظومة الستة — مرجع تصنيفي خفيف (بدون اختلاق أسئلة)
SECTION_CATALOG = {
    "readalong": {
        "id": "readalong",
        "label": "القراءة المتزامنة",
        "maps_via": "readalong_level",
    },
    "challenge_modes": {
        "id": "challenge_modes",
        "label": "أنماط التحدي",
        "maps_via": "mode",
    },
    "foundation_games": {
        "id": "foundation_games",
        "label": "ألعاب التأسيس",
        "maps_via": "mental_level|word_kind",
    },
    "trap_doors": {
        "id": "trap_doors",
        "label": "أبواب الأخطاء",
        "maps_via": "grade_root",
    },
    "golden_trap": {
        "id": "golden_trap",
        "label": "فخ شائع + قاعدة ذهبية",
        "maps_via": "grade_root|domain_default",
    },
    "live_arena": {
        "id": "live_arena",
        "label": "الميدان الحي",
        "maps_via": "mode|duel_default_pro",
    },
}


def tier_by_id(tier_id: str) -> dict:
    for row in TIERS:
        if row["id"] == tier_id:
            return dict(row)
    return dict(TIERS[0])


def resolve_tier(
    *,
    grade_root: str = "",
    mental_level: int | None = None,
    mode: str = "",
    readalong_level: str = "",
    word_kind: str = "",
    default: str = TIER_AMATEUR,
) -> dict:
    """استخراج المستوى غير المباشر من إشارات موجودة فقط."""
    if grade_root and grade_root in ROOT_TO_TIER:
        return tier_by_id(ROOT_TO_TIER[grade_root])
    if mental_level is not None and int(mental_level) in MENTAL_LEVEL_TO_TIER:
        return tier_by_id(MENTAL_LEVEL_TO_TIER[int(mental_level)])
    if mode and mode in MODE_TO_TIER:
        return tier_by_id(MODE_TO_TIER[mode])
    if readalong_level and readalong_level in READALONG_LEVEL_TO_TIER:
        return tier_by_id(READALONG_LEVEL_TO_TIER[readalong_level])
    if word_kind and word_kind in WORD_KIND_TO_TIER:
        return tier_by_id(WORD_KIND_TO_TIER[word_kind])
    return tier_by_id(default)


def fallback_tier_chain(preferred: str) -> list[str]:
    """سلسلة إرجاع آمنة عند شحّ المحتوى في مستوى معيّن."""
    order = [TIER_AMATEUR, TIER_PRO, TIER_ELITE]
    if preferred not in order:
        return list(order)
    idx = order.index(preferred)
    # نبدأ بالمفضّل ثم نهبط ثم نصعد للأعلى إن لزم
    down = list(reversed(order[: idx + 1]))
    up = order[idx + 1 :]
    seen: list[str] = []
    for t in down + up:
        if t not in seen:
            seen.append(t)
    return seen


def pick_with_fallback(items_by_tier: dict[str, list], preferred: str) -> dict[str, Any]:
    """اختيار عناصر المستوى مع إرجاع للمستوى الأقرب غير الفارغ."""
    preferred = preferred if preferred in (TIER_AMATEUR, TIER_PRO, TIER_ELITE) else TIER_AMATEUR
    for tid in fallback_tier_chain(preferred):
        pool = items_by_tier.get(tid) or []
        if pool:
            return {
                "tier": tier_by_id(tid),
                "items": list(pool),
                "fallback_from": None if tid == preferred else tier_by_id(preferred),
                "used_fallback": tid != preferred,
            }
    return {
        "tier": tier_by_id(preferred),
        "items": [],
        "fallback_from": None,
        "used_fallback": False,
        "empty": True,
    }


def coaching_from_round(
    *,
    score: int,
    total: int,
    combo_best: int = 0,
    elapsed_sec: float = 0.0,
    seconds_budget: float = 60.0,
    tier_label: str = "",
) -> dict[str, str]:
    """تغذية راجعة تربوية من أرقام الجولة فقط — بلا اختلاق."""
    total = max(1, int(total or 1))
    score = max(0, int(score or 0))
    accuracy = score / total
    elapsed = max(0.0, float(elapsed_sec or 0.0))
    budget = max(1.0, float(seconds_budget or 60.0))
    pace = elapsed / total  # ثوانٍ لكل سؤال تقريباً
    tier_bit = f" في مسار {tier_label}" if tier_label else ""

    if accuracy >= 0.85:
        message = f"أداء متين{tier_bit}: دقّتك عالية وواضحة."
        strength = "ثبات الإجابة الصحيحة"
        next_step = "أعد الجولة لكسر رقمك أو ارتقِ للمستوى التالي بثقة."
    elif accuracy >= 0.6:
        message = f"تقدم جيد{tier_bit}: أنت في المسار الصحيح."
        strength = "الاستمرار دون استسلام"
        next_step = "راجع بطاقة ذهبية واحدة ثم أعد المحاولة لتحسين الدقة."
    else:
        message = f"بداية صادقة{tier_bit}: كل محاولة تبني خبرتك."
        strength = "الشجاعة في خوض الجولة"
        next_step = "افتح باب الأخطاء أو الحقيبة الذهبية، ثم عد لجولة قصيرة."

    if combo_best >= 3 and accuracy >= 0.5:
        strength = "سلسلة إجابات متتالية (Combo)"
        if accuracy >= 0.6:
            message = f"سلسلة قوية{tier_bit}: حافظ على إيقاعك الواعي."

    # سرعة واعية vs تسرّع
    if pace > 0 and pace <= (budget / total) * 0.45 and accuracy < 0.55:
        next_step = "أبطئ قليلاً: اقرأ السؤال ثم اختر؛ الدقة قبل السرعة."
    elif pace > 0 and elapsed <= budget * 0.55 and accuracy >= 0.75:
        strength = "سرعة واعية مع دقة"
        message = f"إيقاع ممتاز{tier_bit}: سرعة دون تسرّع ظاهر."

    return {
        "message": message,
        "strength": strength,
        "next_step": next_step,
        "accuracy_pct": str(int(round(accuracy * 100))),
    }


def taxonomy_snapshot() -> dict[str, Any]:
    """مرجع خفيف للأقسام الستة + المستويات — للواجهة والاختبارات."""
    return {
        "tiers": list(TIERS),
        "sections": SECTION_CATALOG,
        "maps": {
            "grade_root": ROOT_TO_TIER,
            "mental_level": {str(k): v for k, v in MENTAL_LEVEL_TO_TIER.items()},
            "mode": MODE_TO_TIER,
            "readalong_level": READALONG_LEVEL_TO_TIER,
            "word_kind": WORD_KIND_TO_TIER,
            "tier_to_mental_level": TIER_TO_MENTAL_LEVEL,
        },
        "fallback_policy": "prefer → softer tiers first → higher tiers if needed",
    }
