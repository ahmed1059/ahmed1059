# موجة ب: تدريبات نافس ٢١–٢٢–٢٣ — حزم الإحصاء / تحليل البيانات / الاحتمالات
# المصدر: نماذج أسئلة نافس ثالث متوسط («نوافذ على نافس») — مفاتيح مطبوعة بعد تدقيق.
# بلا اختلاق مفاتيح؛ التصحيحات الموثّقة أدناه فقط عند تعارض المسح مع الحساب الصريح.
from __future__ import annotations

from .nafs_challenge_tiers import TIER_AMATEUR, TIER_ELITE, TIER_PRO, tier_by_id

EASTERN = "٠١٢٣٤٥٦٧٨٩"
PACK_SOURCE = "تدريبات نافس ٢١–٢٢–٢٣ · نوافذ على نافس · ثالث متوسط"
BANK_TAG = "wave-b-212223"

# تصحيحات تدقيق (مسح/مفتاح مطبوع متعارض مع الحساب الصريح)
AUDIT_FIXES = (
    {
        "ref": "س٩٤",
        "issue": "مفتاح مطبوع/OCR أشار للأعمدة؛ التغيّر عبر الزمن يناسب التمثيل بالخطوط",
        "adopted": "د",
    },
    {
        "ref": "س١٠٤",
        "issue": "بيانات اسمية (ألوان مفضلة)؛ الأنسب المنوال لا الوسيط",
        "adopted": "ج",
    },
)


def _e(value) -> str:
    out = []
    for ch in str(value):
        if ch.isdigit():
            out.append(EASTERN[int(ch)])
        elif ch == "%":
            out.append("٪")
        else:
            out.append(ch)
    return "".join(out)


def _frac(num, den) -> str:
    return f"{_e(num)}/{_e(den)}"


def _q(
    *,
    pack: str,
    skill: str,
    stem: str,
    a: str,
    b: str,
    c: str,
    d: str,
    correct: str,
    rationale: str,
    grade_root: str,
    tier_id: str,
    common_mistake: str,
    golden_rule: str,
    sort_order: int,
    source_ref: str,
) -> dict:
    tier = tier_by_id(tier_id)
    return {
        "domain": "math",
        "skill": skill,
        "stem": stem,
        "choice_a": a,
        "choice_b": b,
        "choice_c": c,
        "choice_d": d,
        "correct": str(correct or "A").upper(),
        "rationale": rationale,
        "passage_id": f"{BANK_TAG}:{pack}",
        "passage_title": pack,
        "passage_text": f"{PACK_SOURCE} · {source_ref}",
        "sort_order": sort_order,
        "common_mistake": common_mistake,
        "grade_root": grade_root,
        "golden_rule": golden_rule,
        "pack": pack,
        "tier": tier.get("id"),
        "tier_label": tier.get("label"),
        "source_ref": source_ref,
        "bank_tag": BANK_TAG,
    }


SKILL_STATS = "الإحصاء والتمثيلات البيانية"
SKILL_DATA = "تحليل البيانات وتفسيرها"
SKILL_PROB = "حساب الاحتمالات"


def build_stats_pack() -> list[dict]:
    """١٠ أسئلة — الإحصاء والتمثيلات البيانية."""
    rows = [
        _q(
            pack=SKILL_STATS,
            skill=SKILL_STATS,
            stem=(
                "لتمثيل مدرسة متوسطة في تجمع طلابي اختير طالبان عشوائياً من كل صف "
                "من الصفوف: الأول والثاني والثالث المتوسط. فما أفضل وصف لهذه العينة؟"
            ),
            a="بسيطة",
            b="طبقية",
            c="منتظمة",
            d="لا شيء مما ذُكر",
            correct="B",
            rationale="اختيار من كل صف (طبقة) يجعل العينة طبقية.",
            grade_root="٣م",
            tier_id=TIER_ELITE,
            common_mistake="اعتبار أي اختيار عشوائي عينة بسيطة دون طبقات.",
            golden_rule="العينة الطبقية تأخذ من كل طبقة بنسبة أو بعدد محدد.",
            sort_order=2101,
            source_ref="س٨٩",
        ),
        _q(
            pack=SKILL_STATS,
            skill=SKILL_STATS,
            stem=(
                "يفحص مراقب جودة في أحد معامل الحلوى كل عاشر علبة من خط الإنتاج. "
                "ما نوع هذه العينة؟"
            ),
            a="العينة العشوائية البسيطة",
            b="العينة العشوائية الطبقية",
            c="العينة العشوائية المنتظمة",
            d="غير ذلك",
            correct="C",
            rationale="أخذ كل عاشر عنصر نمط منتظم.",
            grade_root="٣م",
            tier_id=TIER_ELITE,
            common_mistake="خلط العينة المنتظمة بالعينة البسيطة.",
            golden_rule="العينة المنتظمة: اختيار بفاصل ثابت من قائمة أو خط إنتاج.",
            sort_order=2102,
            source_ref="س٩٠",
        ),
        _q(
            pack=SKILL_STATS,
            skill=SKILL_STATS,
            stem=(
                "في مدرج تكراري للعمر عند بداية أول وظيفة كانت أعداد الأشخاص: "
                f"الفئة {_e('20')}–{_e('24')} فيها {_e(12)} شخصاً، والفئة {_e('25')}–{_e('29')} فيها {_e(6)}. "
                f"كم شخصاً بدأوا وظائفهم عندما كانت أعمارهم من {_e(20)} إلى {_e(29)} سنة؟"
            ),
            a=_e(18),
            b=_e(10),
            c=_e(9),
            d=_e(8),
            correct="A",
            rationale=f"{_e(12)}+{_e(6)}={_e(18)}.",
            grade_root="٢م",
            tier_id=TIER_PRO,
            common_mistake="قراءة عمود واحد فقط من المدرج.",
            golden_rule="عند جمع فئتين متجاورتين نجمع تكراراهما.",
            sort_order=2103,
            source_ref="س٩١",
        ),
        _q(
            pack=SKILL_STATS,
            skill=SKILL_STATS,
            stem=(
                "في تمثيل الصندوق وطرفاه: الحد الأدنى ٤٤، الربيع الأدنى ٥٢، الوسيط ٥٦، "
                "الربيع الأعلى ٦٤، الحد الأعلى ٧٢. أي الجمل الآتية ليست صحيحة؟"
            ),
            a="القيمة ٥٨ متطرفة",
            b="نصف القيم أكبر من ٥٥ تقريباً",
            c="ربع القيم تقع قرب الفترة ٥٨–٦٩",
            d="توجد قيم في الفترة ٤٢–٥١ أكثر من الفترة ٥٥–٥٨",
            correct="A",
            rationale="٥٨ قرب الوسيط داخل الصندوق؛ ليست قيمة متطرفة.",
            grade_root="٣م",
            tier_id=TIER_ELITE,
            common_mistake="اعتبار أي قيمة داخل الصندوق متطرفة.",
            golden_rule="المتطرف خارج السياج؛ القيم داخل الصندوق ليست متطرفة.",
            sort_order=2104,
            source_ref="س٩٢",
        ),
        _q(
            pack=SKILL_STATS,
            skill=SKILL_STATS,
            stem=(
                "ما هو التمثيل الأمثل لتوضيح تغيّر البيانات في فترة زمنية معينة؟"
            ),
            a="التمثيل بالأعمدة",
            b="القطاعات الدائرية",
            c="الساق والورقة",
            d="التمثيل بالخطوط",
            correct="D",
            rationale="الخطوط الأنسب لإظهار التغيّر عبر الزمن (تصحيح تدقيق س٩٤).",
            grade_root="٢م",
            tier_id=TIER_PRO,
            common_mistake="اختيار الأعمدة أو القطاعات لتتبع التغيّر الزمني.",
            golden_rule="التغيّر عبر الزمن → تمثيل بالخطوط.",
            sort_order=2105,
            source_ref="س٩٤",
        ),
        _q(
            pack=SKILL_STATS,
            skill=SKILL_STATS,
            stem=(
                "ما التمثيل الأنسب لعرض مجموعة بيانات عن نوع الفاكهة المفضلة "
                "لدى مجموعة من الأصدقاء؟"
            ),
            a="الصندوق وطرفاه",
            b="الأعمدة البيانية",
            c="القطاعات الدائرية",
            d="الخطوط البيانية",
            correct="C",
            rationale="البيانات نوعية/نسب أجزاء من كل؛ القطاعات الدائرية مناسبة.",
            grade_root="٣م",
            tier_id=TIER_ELITE,
            common_mistake="خلط المدرج التكراري (كمّي متصل) بالقطاعات (أجزاء من كل).",
            golden_rule="نسب أجزاء من مجموعة كلية → قطاعات دائرية (أو أعمدة للفئات).",
            sort_order=2106,
            source_ref="س٩٥",
        ),
        _q(
            pack=SKILL_STATS,
            skill=SKILL_STATS,
            stem=(
                "في قطاع دائري رباعي، القطاع (ب) ربع الدائرة تقريباً. "
                "ما النسبة المئوية التي يمثلها القطاع (ب)؟"
            ),
            a=f"{_e(75)}٪",
            b=f"{_e(50)}٪",
            c=f"{_e(25)}٪",
            d=f"{_e(10)}٪",
            correct="C",
            rationale="ربع الدائرة = ٢٥٪.",
            grade_root="٢م",
            tier_id=TIER_AMATEUR,
            common_mistake="خلط ربع الدائرة بنصفها.",
            golden_rule="القطاع الكامل ٣٦٠°؛ الربع ٩٠° أي ٢٥٪.",
            sort_order=2107,
            source_ref="س٩٦",
        ),
        _q(
            pack=SKILL_STATS,
            skill=SKILL_STATS,
            stem=(
                f"صرّح {_e(40)} طالباً عن عدد الأقلام في حقائبهم: "
                f"٠←{_e(1)}، ١←{_e(5)}، ٢←{_e(24)}، ٣←{_e(7)}، ٤←{_e(3)}. "
                "ما عدد الطلاب الذين يملكون أكثر من قلمين؟"
            ),
            a=f"{_e(7)} طلاب",
            b=f"{_e(3)} طلاب",
            c=f"{_e(10)} طلاب",
            d=f"{_e(34)} طالباً",
            correct="C",
            rationale=f"{_e(7)}+{_e(3)}={_e(10)}.",
            grade_root="٢م",
            tier_id=TIER_PRO,
            common_mistake="إضافة فئة قلمين أو نسيانها.",
            golden_rule="«أكثر من ٢» تعني ٣ فأكثر.",
            sort_order=2108,
            source_ref="س٩٧",
        ),
        _q(
            pack=SKILL_STATS,
            skill=SKILL_STATS,
            stem=(
                "يبين شكل انتشار أرباح محل ملابس ارتفاعاً خطياً تقريباً عبر الأشهر "
                "من محرم إلى جمادى الآخرة (من نحو ١١ إلى ١٥ ألف ريال). "
                "ما التوقع الأنسب لأرباح شهر شعبان من العام نفسه؟"
            ),
            a=f"{_e(18000)} تقريباً",
            b=f"{_e(16000)} تقريباً",
            c=f"{_e(14000)} تقريباً",
            d=f"{_e(12000)} تقريباً",
            correct="B",
            rationale="امتداد خط الاتجاه صعوداً نحو ١٦ ألفاً تقريباً.",
            grade_root="٣م",
            tier_id=TIER_ELITE,
            common_mistake="القراءة من آخر نقطة دون امتداد الخط.",
            golden_rule="التنبؤ من شكل الانتشار يتبع خط الاتجاه.",
            sort_order=2109,
            source_ref="س٩٨",
        ),
        _q(
            pack=SKILL_STATS,
            skill=SKILL_STATS,
            stem=(
                "أي العبارات الآتية تميّز المدرج التكراري عن التمثيل بالأعمدة؟"
            ),
            a="المدرج للفئات الكمية المتصلة وبدون فراغات بين المستطيلات عادة",
            b="المدرج دائماً للبيانات النوعية فقط",
            c="الأعمدة لا تُستخدم إلا للزمن",
            d="لا فرق بينهما أبداً",
            correct="A",
            rationale="المدرج للمتصل الكمي؛ الأعمدة شائعة للفئات المنفصلة/النوعية.",
            grade_root="٢م",
            tier_id=TIER_AMATEUR,
            common_mistake="استخدام المدرج والأعمدة كمترادفين بلا تمييز.",
            golden_rule="مدرج تكراري ↔ فئات كمية متصلة؛ أعمدة ↔ فئات منفصلة أو نوعية.",
            sort_order=2110,
            source_ref="قاعدة-تمثيلات",
        ),
    ]
    assert len(rows) == 10
    return rows


def build_data_pack() -> list[dict]:
    """١٠ أسئلة — تحليل البيانات وتفسيرها."""
    rows = [
        _q(
            pack=SKILL_DATA,
            skill=SKILL_DATA,
            stem=(
                "يبين شكل انتشار عدد المسجلين في نادٍ رياضي ارتفاعاً خطياً؛ "
                f"عند الشهر {_e(10)} يمر خط الاتجاه تقريباً عند {_e(35)}. "
                f"ما العدد المتوقع للمسجلين في الشهر {_e(10)}؟"
            ),
            a=f"{_e(8)} أشخاص",
            b=f"{_e(19)} شخصاً",
            c=f"{_e(30)} شخصاً",
            d=f"{_e(35)} شخصاً",
            correct="D",
            rationale="قراءة خط الاتجاه عند ١٠ تعطي ٣٥.",
            grade_root="٣م",
            tier_id=TIER_ELITE,
            common_mistake="اختيار أقرب نقطة مبعثرة بدل خط الاتجاه.",
            golden_rule="التوقع من الانتشار = قراءة خط الاتجاه عند القيمة المطلوبة.",
            sort_order=2201,
            source_ref="س٩٩",
        ),
        _q(
            pack=SKILL_DATA,
            skill=SKILL_DATA,
            stem=(
                f"اعتماداً على البيانات {_e('41')}، {_e('43')}، {_e('36')}، {_e('44')}، "
                f"{_e('77')}، {_e('38')}، {_e('42')}، {_e('45')}؛ أي العبارات صحيحة؟"
            ),
            a="المنوال أكثر المقاييس تأثراً بالقيم المتطرفة",
            b="الوسيط لا يتأثر بالقيم المتطرفة",
            c="المتوسط أكثر تأثراً بالقيم المتطرفة",
            d="لا يتأثر أي من مقاييس النزعة المركزية بالقيم المتطرفة",
            correct="C",
            rationale="٧٧ قيمة متطرفة تسحب المتوسط؛ الوسيط أقل تأثراً.",
            grade_root="٣م",
            tier_id=TIER_ELITE,
            common_mistake="اختيار الوسيط كأكثر تأثراً بالمتطرف.",
            golden_rule="عند وجود قيم متطرفة فضّل الوسيط؛ المتوسط يتأثر بها بقوة.",
            sort_order=2202,
            source_ref="س١٠٠",
        ),
        _q(
            pack=SKILL_DATA,
            skill=SKILL_DATA,
            stem=(
                f"درجات {_e(24)} طالباً في اللغة العربية حدّاها {_e(65)} و{_e(100)} "
                f"(المدى {_e(35)}). إذا أُضيفت درجة {_e(83)} فكيف يتغير المدى؟"
            ),
            a=f"يبقى المدى {_e(45)} دون تغيير",
            b=f"يبقى المدى {_e(35)} دون تغيير",
            c=f"يتغير المدى من {_e(45)} إلى {_e(83)}",
            d=f"يتغير المدى من {_e(35)} إلى {_e(17)}",
            correct="B",
            rationale="٨٣ داخل المدى الحالي؛ الأكبر والأصغر لا يتغيران.",
            grade_root="٣م",
            tier_id=TIER_PRO,
            common_mistake="إعادة حساب المدى من القيمة المضافة وحدها.",
            golden_rule="المدى = أكبر − أصغر؛ إضافة قيمة داخلية لا تغيّره.",
            sort_order=2203,
            source_ref="س١٠١",
        ),
        _q(
            pack=SKILL_DATA,
            skill=SKILL_DATA,
            stem=(
                "معدلات أمطار ١٢ مدينة (سم) متوسطها أقل من ١٠. "
                f"إذا أُضيفت القيمة {_e('10.3')} فأي جملة صحيحة؟"
            ),
            a="يزداد المنوال",
            b="ينقص الوسط الحسابي",
            c="ينقص الوسيط",
            d="يزداد الوسط الحسابي",
            correct="D",
            rationale="إضافة قيمة أكبر من المتوسط ترفع الوسط.",
            grade_root="٢م",
            tier_id=TIER_PRO,
            common_mistake="افتراض أن أي إضافة تنقص المتوسط.",
            golden_rule="قيمة أعلى من المتوسط الحالي ترفع المتوسط.",
            sort_order=2204,
            source_ref="س١٠٢",
        ),
        _q(
            pack=SKILL_DATA,
            skill=SKILL_DATA,
            stem=(
                "أعداد طلاب صفوف مدرسة: الأول ١٣٨، الثاني ١٢٥، الثالث ٨٩، "
                "الرابع ١١٠، الخامس ١٣٠، السادس ؟. "
                "ما عدد طلاب السادس إذا كان الوسيط يساوي المنوال؟"
            ),
            a=_e(89),
            b=_e(110),
            c=_e(125),
            d=_e(130),
            correct="C",
            rationale="لجعل المنوال ١٢٥ يتكرر، ولضبط الوسيط عند ١٢٥.",
            grade_root="٢م",
            tier_id=TIER_PRO,
            common_mistake="مساواة الوسيط بأصغر أو أكبر قيمة دون ترتيب.",
            golden_rule="رتّب البيانات أولاً؛ المنوال الأكثر تكراراً والوسيط الأوسط.",
            sort_order=2205,
            source_ref="س١٠٣",
        ),
        _q(
            pack=SKILL_DATA,
            skill=SKILL_DATA,
            stem=(
                "ألوان مفضلة لصف: أصفر ١٢، أحمر ١٣، أزرق ١٠، أخرى ٣٢، أبيض ١٥، أخضر ١١. "
                "أي المقاييس الأنسب لوصف هذه البيانات؟"
            ),
            a="المتوسط الحسابي",
            b="الوسيط",
            c="المنوال",
            d="المدى",
            correct="C",
            rationale="بيانات اسمية فئوية؛ المنوال الأنسب (تصحيح تدقيق س١٠٤).",
            grade_root="٣م",
            tier_id=TIER_AMATEUR,
            common_mistake="حساب متوسط لأصناف اسمية.",
            golden_rule="البيانات النوعية/الاسمية → المنوال.",
            sort_order=2206,
            source_ref="س١٠٤",
        ),
        _q(
            pack=SKILL_DATA,
            skill=SKILL_DATA,
            stem=(
                f"الكيلومترات في {_e(12)} أسبوعاً: "
                f"{_e(7)}، {_e(6)}، {_e(8)}، {_e(8)}، {_e(11)}، {_e(10)}، "
                f"{_e(5)}، {_e(5)}، {_e(6)}، {_e(7)}، {_e(8)}، {_e(14)}. "
                "أي الجمل صحيحة؟"
            ),
            a=f"الوسيط يساوي {_e(11)}",
            b=f"المدى يساوي {_e(9)}",
            c=f"المنوال يساوي {_e(5)}",
            d=f"المتوسط يساوي {_e(8)}",
            correct="B",
            rationale=f"المدى = {_e(14)}−{_e(5)}={_e(9)}.",
            grade_root="٢م",
            tier_id=TIER_AMATEUR,
            common_mistake="حساب المدى من وسيطين أو نسيان ترتيب القيم.",
            golden_rule="المدى = أكبر قيمة − أصغر قيمة.",
            sort_order=2207,
            source_ref="س١٠٥",
        ),
        _q(
            pack=SKILL_DATA,
            skill=SKILL_DATA,
            stem=(
                "درجات اختبار نهائي: ١٥، ١٦، ١٧، ١٨، ١٨، ١٩، ١٩، ٢٠، ٢٠. "
                "أوجد المدى الربيعي (بطريقة تضمين الوسيط في نصفي البيانات)."
            ),
            a=_e(2),
            b=_e("19.5"),
            c=_e("3.5"),
            d=_e(4),
            correct="A",
            rationale="Q١=١٧ و Q٣=١٩ في هذه الطريقة المدرسية → المدى الربيعي ٢.",
            grade_root="٢م",
            tier_id=TIER_PRO,
            common_mistake="طرح أصغر من أكبر بدل الربيعين.",
            golden_rule="المدى الربيعي = الربيع الأعلى − الربيع الأدنى.",
            sort_order=2208,
            source_ref="س١٠٦",
        ),
        _q(
            pack=SKILL_DATA,
            skill=SKILL_DATA,
            stem=(
                f"أوجد المتوسط الحسابي للبيانات: {_e(12)}، {_e(7)}، {_e(8)}، {_e(3)}."
            ),
            a=_e(7),
            b=_e("7.5"),
            c=_e(8),
            d=_e("8.5"),
            correct="B",
            rationale=f"({_e(12)}+{_e(7)}+{_e(8)}+{_e(3)})÷{_e(4)}={_e('7.5')}.",
            grade_root="٢م",
            tier_id=TIER_AMATEUR,
            common_mistake="القسمة على ٣ بدل ٤ أو نسيان قيمة.",
            golden_rule="المتوسط = المجموع ÷ عدد القيم.",
            sort_order=2209,
            source_ref="س١٠٩",
        ),
        _q(
            pack=SKILL_DATA,
            skill=SKILL_DATA,
            stem=(
                "أطوال طالبات (سم): ١٥٨، ١٥٩، ١٥٥، ١٦٢، ١٦٠، ١٥٦، ١٥٥، ١٤٩، ١٥٢. "
                "أحسب المدى."
            ),
            a=_e(10),
            b=_e(11),
            c=_e(12),
            d=_e(13),
            correct="D",
            rationale=f"{_e(162)}−{_e(149)}={_e(13)}.",
            grade_root="٣م",
            tier_id=TIER_AMATEUR,
            common_mistake="طرح قيمتين غير طرفيتين.",
            golden_rule="المدى = الأكبر − الأصغر بعد المسح الكامل للقيم.",
            sort_order=2210,
            source_ref="س١١٠",
        ),
    ]
    assert len(rows) == 10
    return rows


def build_prob_pack() -> list[dict]:
    """١٠ أسئلة — حساب الاحتمالات."""
    rows = [
        _q(
            pack=SKILL_PROB,
            skill=SKILL_PROB,
            stem=(
                f"أحسب عدد النواتج الممكنة عند اختيار حذاء إذا توافر {_e(4)} ألوان "
                f"و{_e(2)} مقاسات مختلفة منه."
            ),
            a=_e(3),
            b=_e(4),
            c=_e(7),
            d=_e(8),
            correct="D",
            rationale=f"{_e(4)}×{_e(2)}={_e(8)} بمبدأ العد.",
            grade_root="٢م",
            tier_id=TIER_AMATEUR,
            common_mistake="جمع ٤+٢ بدل الضرب.",
            golden_rule="مبدأ العد الأساسي: نضرب خيارات المراحل المستقلة.",
            sort_order=2301,
            source_ref="س١١١",
        ),
        _q(
            pack=SKILL_PROB,
            skill=SKILL_PROB,
            stem=(
                "يمكنك استعارة رواية أو لغز أو كتاب ديني، وشراء لعبة تركيب أو شطرنج. "
                "كم ناتجاً في فضاء العينة لجميع الأزواج الممكنة؟"
            ),
            a=_e(5),
            b=_e(6),
            c=_e(8),
            d=_e(9),
            correct="B",
            rationale=f"{_e(3)}×{_e(2)}={_e(6)}.",
            grade_root="٢م",
            tier_id=TIER_AMATEUR,
            common_mistake="عدّ العناصر دون تكوين الأزواج.",
            golden_rule="فضاء العينة للأزواج = حاصل ضرب خيارات كل مرحلة.",
            sort_order=2302,
            source_ref="س١١٢",
        ),
        _q(
            pack=SKILL_PROB,
            skill=SKILL_PROB,
            stem=(
                f"وصل {_e(8)} طلاب إلى المرحلة النهائية. "
                "فبكم طريقة يمكن أن يقفوا في صف واحد على المنصة؟"
            ),
            a=_e(40320),
            b=_e(5040),
            c=_e(3201),
            d=_e(1202),
            correct="A",
            rationale=f"{_e(8)}! = {_e(40320)}.",
            grade_root="٣م",
            tier_id=TIER_ELITE,
            common_mistake="حساب توافيق بدل تباديل الصف.",
            golden_rule="ترتيب صف كامل من n عنصراً = n!.",
            sort_order=2303,
            source_ref="س١١٣",
        ),
        _q(
            pack=SKILL_PROB,
            skill=SKILL_PROB,
            stem=(
                f"بكم طريقة يمكن اختيار لجنة من {_e(4)} أشخاص من بين {_e(12)} شخصاً؟"
            ),
            a=_e(48),
            b=_e(495),
            c=_e(483),
            d=_e(11880),
            correct="B",
            rationale=f"توافيق C({_e(12)}،{_e(4)})={_e(495)}.",
            grade_root="٣م",
            tier_id=TIER_ELITE,
            common_mistake="استخدام التباديل P حين لا يهم الترتيب.",
            golden_rule="اللجنة بلا ترتيب → توافيق.",
            sort_order=2304,
            source_ref="س١١٤",
        ),
        _q(
            pack=SKILL_PROB,
            skill=SKILL_PROB,
            stem=(
                f"أربع بطاقات ({_e(1)}،{_e(2)}،{_e(3)}،{_e(4)}). سحب عبدالله بطاقة واحتفظ بها "
                f"(كانت {_e(4)}) ثم سحب سعد. ما احتمال أن تكون بطاقة سعد {_e(2)}؟"
            ),
            a=_frac(1, 2),
            b=_frac(1, 3),
            c=_frac(1, 4),
            d=_frac(1, 5),
            correct="B",
            rationale="تبقى ٣ بطاقات؛ واحدة منها ٢ → ١/٣ (حادثة غير مستقلة).",
            grade_root="٢م",
            tier_id=TIER_PRO,
            common_mistake="حساب ١/٤ كأن السحب مع الإعادة.",
            golden_rule="بدون إعادة: يتغير فضاء العينة → حوادث غير مستقلة.",
            sort_order=2305,
            source_ref="س١١٥",
        ),
        _q(
            pack=SKILL_PROB,
            skill=SKILL_PROB,
            stem=(
                f"ما احتمال الحصول على عدد يقبل القسمة على {_e(3)} عند رمي مكعب أرقام مرة واحدة؟"
            ),
            a=_frac(2, 3),
            b=_frac(3, 6),
            c=_frac(1, 3),
            d=_frac(1, 6),
            correct="C",
            rationale="الملائم {٣،٦} من ٦ → ١/٣ (و٣/٦ تكافئ لكن المفتاح المعتمد ج).",
            grade_root="٢م",
            tier_id=TIER_AMATEUR,
            common_mistake="عدّ ١ و٣ و٦ أو نسيان ٦.",
            golden_rule="الاحتمال النظري = عدد الملائم ÷ عدد الممكن.",
            sort_order=2306,
            source_ref="س١١٧",
        ),
        _q(
            pack=SKILL_PROB,
            skill=SKILL_PROB,
            stem=(
                f"قرص مقسّم إلى {_e(20)} منطقة متطابقة مرقمة من {_e(1)} إلى {_e(20)}. "
                "أوجد ح(عدد أولي)."
            ),
            a=_frac(1, 5),
            b=_frac(2, 5),
            c=_frac(3, 5),
            d=_frac(4, 5),
            correct="B",
            rationale=f"الأوليّة {_e(8)} أعداد → {_e(8)}/{_e(20)}={_frac(2, 5)}.",
            grade_root="٢م",
            tier_id=TIER_PRO,
            common_mistake="عدّ ١ ضمن الأولية أو نسيان ١٧ و١٩.",
            golden_rule="١ ليس أولياً؛ راجع قائمة الأولية قبل القسمة.",
            sort_order=2307,
            source_ref="س١١٨",
        ),
        _q(
            pack=SKILL_PROB,
            skill=SKILL_PROB,
            stem=(
                f"إذا كان احتمال أن يسجل رائد هدفاً في مباراة هو {_frac(3, 5)}، "
                f"فكم هدفاً تتوقع أن يسجل في {_e(60)} مباراة؟"
            ),
            a=_e(50),
            b=_e(36),
            c=_e(30),
            d=_e(24),
            correct="B",
            rationale=f"{_frac(3, 5)}×{_e(60)}={_e(36)}.",
            grade_root="٢م",
            tier_id=TIER_AMATEUR,
            common_mistake="ضرب في ٥/٣ أو نسيان الاختزال.",
            golden_rule="التوقع = الاحتمال × عدد المحاولات.",
            sort_order=2308,
            source_ref="س١١٩",
        ),
        _q(
            pack=SKILL_PROB,
            skill=SKILL_PROB,
            stem=(
                f"صندوق فيه {_e(6)} بطاقات تركيب و{_e(4)} شطرنج و{_e(7)} كرة "
                f"(المجموع {_e(17)}). سُحبت بطاقة ثم أُعيدت ثم سُحبت أخرى. "
                "أوجد احتمال سحب تركيب ثم شطرنج."
            ),
            a=f"{_e('8.2')}٪",
            b=f"{_e('7.5')}٪",
            c=f"{_e('6.6')}٪",
            d=f"{_e('5.4')}٪",
            correct="A",
            rationale=f"({_e(6)}/{_e(17)})×({_e(4)}/{_e(17)})≈{_e('8.2')}٪ مع الإعادة (مستقلة).",
            grade_root="٢م",
            tier_id=TIER_PRO,
            common_mistake="الحساب بدون إعادة أو عكس الترتيب.",
            golden_rule="مع الإعادة تبقى الاحتمالات مستقلة ويُعاد المقام نفسه.",
            sort_order=2309,
            source_ref="س١٢٠",
        ),
        _q(
            pack=SKILL_PROB,
            skill=SKILL_PROB,
            stem=(
                "أي العبارات الآتية تصف الحوادث المتنافية؟"
            ),
            a="لا يمكن وقوعهما معاً في التجربة نفسها",
            b="وقوع أحدهما لا يؤثر في الآخر أبداً",
            c="هما دائماً متتامتان فقط",
            d="مجموعهما دائماً أكبر من ١",
            correct="A",
            rationale="المتنافية = لا تتقاطع؛ المستقلة مفهوم مختلف.",
            grade_root="٢م",
            tier_id=TIER_AMATEUR,
            common_mistake="خلط المتنافية بالمستقلة أو بالمتممة.",
            golden_rule="متنافية: لا معاً. مستقلة: أحدهما لا يغيّر احتمال الآخر.",
            sort_order=2310,
            source_ref="قاعدة-حوادث",
        ),
    ]
    assert len(rows) == 10
    return rows


def wave_b_questions() -> list[dict]:
    from .nafs_visual_integrity import attach_wave_b_diagrams

    rows = build_stats_pack() + build_data_pack() + build_prob_pack()
    assert len(rows) == 30, len(rows)
    rows = attach_wave_b_diagrams(rows)
    # توزيع المستويات: هواة / محترفين / نخبة موجودة كلها
    tiers = {r["tier"] for r in rows}
    assert tiers >= {TIER_AMATEUR, TIER_PRO, TIER_ELITE}
    # كل سؤال يذكر شكلاً يجب أن يحمل رسماً
    for r in rows:
        stem = r.get("stem") or ""
        if "يبين شكل" in stem or "مدرج تكراري للعمر" in stem or "الصندوق وطرفاه" in stem or "قطاع دائري رباعي" in stem:
            assert (r.get("diagram_svg") or "").strip(), stem[:60]
        r.setdefault("student_ready", 1)
    return rows


def wave_b_golden_cards() -> list[dict]:
    """بطاقات فخ شائع + قاعدة ذهبية من حزم ٢١–٢٢–٢٣."""
    from .nafs_misconception_lab import _golden_math

    return [
        _golden_math(
            "m-wbb-1",
            "الوسيط والمتطرف",
            "عند وجود قيم متطرفة فضّل الوسيط؛ المتوسط ينجذب نحو المتطرف",
            "بيانات فيها ٧٧ شاذة → لا تعتمد المتوسط وحده",
        ),
        _golden_math(
            "m-wbb-2",
            "مدرج أم أعمدة؟",
            "المدرج للفئات الكمية المتصلة؛ الأعمدة للفئات المنفصلة أو النوعية",
            "أعمار بفئات → مدرج · أنواع فاكهة → أعمدة أو قطاعات",
        ),
        _golden_math(
            "m-wbb-3",
            "احتمال نظري وتجريبي",
            "النظري = ملائم÷ممكن · التجريبي = تكرار الحدوث÷عدد المحاولات",
            "مكعب: ح(زوجي)=٣/٦ · بعد ٦٠ رمية راقب التكرار النسبي",
        ),
        _golden_math(
            "m-wbb-4",
            "مستقلة ومتنافية",
            "مستقلة: لا يغيّر أحدهما احتمال الآخر · متنافية: لا يقعان معاً",
            "سحب مع إعادة ≈ استقلال · وجهان لنفس الرمية متنافيان",
        ),
        _golden_math(
            "m-wbb-5",
            "المدى الربيعي",
            "IQR = Q٣ − Q١ ويقاوم القيم المتطرفة أفضل من المدى",
            "Q١=١٧ و Q٣=١٩ → IQR=٢",
        ),
    ]


def wave_b_skill_traps() -> dict[str, tuple[str, str]]:
    return {
        SKILL_STATS: (
            "اختر التمثيل وفق نوع البيانات والهدف (زمن→خطوط، أجزاء→قطاعات، متصل→مدرج).",
            "خلط المدرج بالأعمدة أو اختيار قطاعات لتتبع الزمن.",
        ),
        SKILL_DATA: (
            "عند القيم المتطرفة استخدم الوسيط؛ المدى = أكبر−أصغر بعد المسح الكامل.",
            "الاعتماد على المتوسط مع متطرف واضح أو حساب مدى خاطئ.",
        ),
        SKILL_PROB: (
            "ميّز الإعادة/بدونها قبل الضرب؛ النظري ملائم÷ممكن.",
            "خلط الحوادث المستقلة بالمتنافية أو نسيان تغيّر المقام بدون إعادة.",
        ),
    }


def items_by_tier() -> dict[str, list[dict]]:
    buckets = {TIER_AMATEUR: [], TIER_PRO: [], TIER_ELITE: []}
    for row in wave_b_questions():
        buckets.setdefault(row["tier"], []).append(row)
    return buckets
