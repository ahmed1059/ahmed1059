# سجل نافس المدرسي المتكامل — S-40341 / 1059
# أرقام موثّقة فقط من بطاقة نافس والمركز الكنسي؛ بلا اختلاق مسارات أو نسب.
from __future__ import annotations

from typing import Any

from .nafs_challenge_tiers import MODE_TO_TIER, tier_by_id

SCHOOL_CODE = "40341"
SCHOOL_MINISTRY_ID = "S-40341"
SCHOOL_NAME = "متوسطة سعد بن الربيع الأنصاري"
EDUCATION_OFFICE = "الإدارة العامة للتعليم بمنطقة المدينة المنورة"
GRADE = "الثالث المتوسط"

# بطاقة نافس المعتمدة — ثالث متوسط
ENROLLED = 111
TESTED = 101
AVERAGE_MASTERY_PCT = 29.7
MATH_PCT = 18.8
READING_PCT = 27.7
SCIENCE_PCT = 42.5
ALGEBRA_PCT = 28.7
LEXICAL_PCT = 23.8
PHYS_CHEM_PCT = 30.7
REMEDIAL_N = 76
ENRICHMENT_N = 25
QUESTION_BANK_BASELINE = 86
PLAN_WEEKS = 18
EXAM_WINDOW = "شوال / ذو القعدة"

INITIATIVES = ("قارئ الحصيف", "تحدي الأرقام", "قدوة", "رفق")
MOCK_NAMES = ("Mock 1", "Mock 2", "Mock 3", "Mock 4")

# جدولة تشغيلية للمحاكاة على سلم المستويات غير المباشرة (بدون اختلاق أسئلة)
# Mock → taxonomy mode: مبكر = هواة، متوسط = محترفين، ختامي = نخبة
MOCK_MODE_HINTS = ("daily", "rescue", "mock", "national")

ETEC_BY_DOMAIN = {
    "reading": "3-1-1-1",
    "math": "3-1-1-2",
    "science": "3-1-1-3",
}
ETEC_AR = {
    "3-1-1-1": "٣-١-١-١",
    "3-1-1-2": "٣-١-١-٢",
    "3-1-1-3": "٣-١-١-٣",
}

SOURCE_CARD = "1448 تحليل بطاقة نافس.pdf · ثالث متوسط · S-40341"


def _num_or(value: Any, fallback: float | int) -> float | int:
    if value is None or value == "":
        return fallback
    try:
        text = str(value).strip().replace("%", "")
        if not text:
            return fallback
        num = float(text)
        if isinstance(fallback, int) and float(int(num)) == num:
            return int(num)
        return num
    except (TypeError, ValueError):
        return fallback


def mock_schedule() -> list[dict[str, Any]]:
    """Mock 1–4 مع مستوى التحدي من مرجعية الأقسام (MODE_TO_TIER) دون اختلاق."""
    out: list[dict[str, Any]] = []
    for name, mode in zip(MOCK_NAMES, MOCK_MODE_HINTS):
        tid = MODE_TO_TIER.get(mode, "pro")
        tier = tier_by_id(tid)
        out.append(
            {
                "name": name,
                "mode_hint": mode,
                "tier": tier.get("id"),
                "tier_label": tier.get("label"),
            }
        )
    return out


def tracks_pack(*, tested: Any = None) -> dict[str, int]:
    """مسارات علاجي/إثرائي الموثّقة (٧٦ / ٢٥ من ١٠١) — لا تُشتق من نسب مخترعة."""
    tested_n = int(_num_or(tested, TESTED))
    remedial = REMEDIAL_N
    enrichment = ENRICHMENT_N
    # إن تغيّر عدد المختبرين المحفوظ لاحقاً نحافظ على الأرقام المطلقة الموثّقة
    # ولا نُعيد توزيعاً نسبياً مختلقاً.
    if tested_n != TESTED:
        # نُبقي الموثّق ونُظهر tested كما هو دون إعادة حساب
        pass
    return {
        "tested": tested_n if tested_n > 0 else TESTED,
        "remedial": remedial,
        "enrichment": enrichment,
        "source": "بطاقة نافس المدرسية · مسار علاجي/إثرائي",
    }


def domains_reference() -> list[dict[str, Any]]:
    return [
        {
            "key": "math",
            "label": "الرياضيات",
            "score": MATH_PCT,
            "weakest_skill": "الجبر",
            "weakest_score": ALGEBRA_PCT,
            "etec_indicator": ETEC_BY_DOMAIN["math"],
            "etec_ar": ETEC_AR["3-1-1-2"],
        },
        {
            "key": "reading",
            "label": "القراءة",
            "score": READING_PCT,
            "weakest_skill": "دلالات الألفاظ",
            "weakest_score": LEXICAL_PCT,
            "etec_indicator": ETEC_BY_DOMAIN["reading"],
            "etec_ar": ETEC_AR["3-1-1-1"],
        },
        {
            "key": "science",
            "label": "العلوم",
            "score": SCIENCE_PCT,
            "weakest_skill": "العلوم الفيزيائية والكيميائية",
            "weakest_score": PHYS_CHEM_PCT,
            "etec_indicator": ETEC_BY_DOMAIN["science"],
            "etec_ar": ETEC_AR["3-1-1-3"],
        },
    ]


def school_identity() -> dict[str, str]:
    return {
        "name": SCHOOL_NAME,
        "code": SCHOOL_CODE,
        "ministry_id": SCHOOL_MINISTRY_ID,
        "education_office": EDUCATION_OFFICE,
    }


def build_school_record_pack(
    *,
    enrolled: Any = None,
    tested: Any = None,
    average_mastery_pct: Any = None,
    question_bank_count: int | None = None,
) -> dict[str, Any]:
    """حزمة قراءة موحّدة للوحة المعلم/المالك وللسجل المطبوع."""
    enrolled_n = int(_num_or(enrolled, ENROLLED))
    tested_n = int(_num_or(tested, TESTED))
    mastery = float(_num_or(average_mastery_pct, AVERAGE_MASTERY_PCT))
    tracks = tracks_pack(tested=tested_n)
    bank_live = int(question_bank_count) if question_bank_count is not None else None
    return {
        "ok": True,
        "school": school_identity(),
        "meta": {
            "grade": GRADE,
            "enrolled": enrolled_n,
            "tested": tested_n,
            "average_mastery_pct": mastery,
            "source": SOURCE_CARD,
        },
        "domains": domains_reference(),
        "tracks": tracks,
        "initiatives": list(INITIATIVES),
        "mocks": mock_schedule(),
        "exam_window": EXAM_WINDOW,
        "weeks": PLAN_WEEKS,
        "etec": [
            {"code": "3-1-1-1", "code_ar": ETEC_AR["3-1-1-1"], "domain": "القراءة"},
            {"code": "3-1-1-2", "code_ar": ETEC_AR["3-1-1-2"], "domain": "الرياضيات"},
            {"code": "3-1-1-3", "code_ar": ETEC_AR["3-1-1-3"], "domain": "العلوم"},
        ],
        "question_bank": {
            "baseline": QUESTION_BANK_BASELINE,
            "live_count": bank_live,
        },
        "print": {
            "pages": 7,
            "page_label_template": "الصفحة {page} من {total}",
        },
    }
