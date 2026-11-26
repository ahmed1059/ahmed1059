# موجة ج: نموذج إجابة نافس التدريبي + استبانة الطالب (A4)
# مرجع بصري: دليل تطبيق نافس 2026 (ETEC) — ورقة الإجابة وجهان.
# بلا مفاتيح إجابة، وبلا اختلاق نصوص بنود الاستبانة.
from __future__ import annotations

from typing import Any

EASTERN = "٠١٢٣٤٥٦٧٨٩"

SCHOOL_CODE = "40341"
SCHOOL_MINISTRY_ID = "S-40341"
SCHOOL_NAME = "متوسطة سعد بن الربيع الأنصاري"
GRADE = "الثالث المتوسط"
EDUCATION_OFFICE = "الإدارة العامة للتعليم بمنطقة المدينة المنورة"

# شبكة إجابات التدريب: ١–٧٥ في ٥ أعمدة رأسية (RTL)
ANSWER_ITEM_COUNT = 75
ANSWER_COLUMNS = 5
ANSWER_CHOICES = ("أ", "ب", "ج", "د")

# شبكات التظليل العمودية
SCHOOL_CODE_DIGITS = 6
NATIONAL_ID_DIGITS = 10

FORM_LABELS = {
    "1-4": "ورقة الإجابات",
    "2-4": "استبانة الطالب — عن الطالب",
    "3-4": "استبانة الطالب — عن المدرسة",
    "4-4": "استبانة الطالب — عن المعلمين والمواد الدراسية",
}

# بنود الاستبانة ١–٢٢: هيكل موثّق من مواصفات الموجة فقط.
# نصوص الأسئلة (stem) تُترك فارغة عمداً — مصدرها كتيب نافس الرسمي، لا تُختلق هنا.
# أنواع الخيارات والأنماط (تعدد / مصفوفة) وفق مواصفات الطلب والمرجع البصري.
MULTI_SELECT_BANNER = "يمكن للطالب تعبئة أكثر من إجابة"
CLOSING_PHRASE = "انتهت استبانة الطالب — راجع تظليلك وفق تعليمات الملاحظ قبل التسليم."

SOURCE_REF = (
    "دليل تطبيق الاختبارات الوطنية نافس 2026 · هيئة تقويم التعليم والتدريب / المركز الوطني للقياس"
)
WAVE_TAG = "wave-c-answer-sheet"


def _e(value: Any) -> str:
    out: list[str] = []
    for ch in str(value):
        if ch.isdigit():
            out.append(EASTERN[int(ch)])
        elif ch == "%":
            out.append("٪")
        else:
            out.append(ch)
    return "".join(out)


def eastern_digits(value: Any) -> str:
    return _e(value)


def _item(
    n: int,
    *,
    section: str,
    page: str,
    kind: str,
    choices: tuple[str, ...] | list[str],
    multi: bool = False,
    matrix_rows: int = 0,
    matrix_cols: tuple[str, ...] | list[str] | None = None,
) -> dict[str, Any]:
    """بند استبانة هيكلي — stem فارغ (لا اختلاق)."""
    row: dict[str, Any] = {
        "n": n,
        "n_ar": _e(n),
        "section": section,
        "page": page,
        "kind": kind,
        "choices": list(choices),
        "multi": bool(multi),
        "stem": "",
        "stem_source": "كتيب استبانة نافس الرسمي — يُعرض عند التوفر دون اختلاق",
    }
    if multi:
        row["banner"] = MULTI_SELECT_BANNER
    if kind == "matrix":
        rows = max(0, int(matrix_rows))
        cols = list(matrix_cols or ANSWER_CHOICES)
        row["matrix"] = {
            "rows": [{"i": i + 1, "i_ar": _e(i + 1), "label": ""} for i in range(rows)],
            "cols": cols,
        }
    return row


def questionnaire_items() -> list[dict[str, Any]]:
    """٢٢ بنداً موزّعة على ٣ صفحات استبانة (٢-٤…٤-٤)."""
    # عن الطالب — صفحة ٢-٤ · بنود ١–٨
    # ٢ و٥ متعددة الاختيار · ٨ مصفوفة
    student = [
        _item(1, section="عن الطالب", page="2-4", kind="yn", choices=("أ", "ب")),
        _item(2, section="عن الطالب", page="2-4", kind="multi", choices=("أ", "ب", "ج", "د"), multi=True),
        _item(3, section="عن الطالب", page="2-4", kind="single", choices=("أ", "ب", "ج", "د")),
        _item(4, section="عن الطالب", page="2-4", kind="single", choices=("أ", "ب", "ج", "د")),
        _item(5, section="عن الطالب", page="2-4", kind="multi", choices=("أ", "ب", "ج", "د"), multi=True),
        _item(6, section="عن الطالب", page="2-4", kind="single", choices=("أ", "ب", "ج", "د")),
        _item(7, section="عن الطالب", page="2-4", kind="single", choices=("أ", "ب", "ج", "د")),
        _item(
            8,
            section="عن الطالب",
            page="2-4",
            kind="matrix",
            choices=ANSWER_CHOICES,
            matrix_rows=4,
            matrix_cols=ANSWER_CHOICES,
        ),
    ]
    # عن المدرسة — صفحة ٣-٤ · بنود ٩–١٥ · ١٠ مصفوفة
    school = [
        _item(9, section="عن المدرسة", page="3-4", kind="single", choices=("أ", "ب", "ج", "د")),
        _item(
            10,
            section="عن المدرسة",
            page="3-4",
            kind="matrix",
            choices=ANSWER_CHOICES,
            matrix_rows=4,
            matrix_cols=ANSWER_CHOICES,
        ),
        _item(11, section="عن المدرسة", page="3-4", kind="yn", choices=("أ", "ب")),
        _item(12, section="عن المدرسة", page="3-4", kind="single", choices=("أ", "ب", "ج", "د")),
        _item(13, section="عن المدرسة", page="3-4", kind="single", choices=("أ", "ب", "ج", "د")),
        _item(14, section="عن المدرسة", page="3-4", kind="yn", choices=("أ", "ب")),
        _item(15, section="عن المدرسة", page="3-4", kind="single", choices=("أ", "ب", "ج", "د")),
    ]
    # عن المعلمين والمواد — صفحة ٤-٤ · بنود ١٦–٢٢ · ٢٢ مصفوفة
    teachers = [
        _item(16, section="عن المعلمين والمواد الدراسية", page="4-4", kind="single", choices=("أ", "ب", "ج", "د")),
        _item(17, section="عن المعلمين والمواد الدراسية", page="4-4", kind="single", choices=("أ", "ب", "ج", "د")),
        _item(18, section="عن المعلمين والمواد الدراسية", page="4-4", kind="single", choices=("أ", "ب", "ج", "د")),
        _item(19, section="عن المعلمين والمواد الدراسية", page="4-4", kind="yn", choices=("أ", "ب")),
        _item(20, section="عن المعلمين والمواد الدراسية", page="4-4", kind="single", choices=("أ", "ب", "ج", "د")),
        _item(21, section="عن المعلمين والمواد الدراسية", page="4-4", kind="single", choices=("أ", "ب", "ج", "د")),
        _item(
            22,
            section="عن المعلمين والمواد الدراسية",
            page="4-4",
            kind="matrix",
            choices=ANSWER_CHOICES,
            matrix_rows=5,
            matrix_cols=ANSWER_CHOICES,
        ),
    ]
    return student + school + teachers


def answer_columns(item_count: int | None = None) -> list[dict[str, Any]]:
    """٥ أعمدة رأسية من اليمين إلى اليسار لشبكة الإجابات (١…ن)."""
    total = max(1, int(item_count or ANSWER_ITEM_COUNT))
    per_col = total // ANSWER_COLUMNS
    rem = total % ANSWER_COLUMNS
    cols: list[dict[str, Any]] = []
    start = 1
    for c in range(ANSWER_COLUMNS):
        count = per_col + (1 if c < rem else 0)
        if count <= 0:
            continue
        end = start + count - 1
        nums = list(range(start, end + 1))
        cols.append(
            {
                "index": c + 1,
                "index_ar": _e(c + 1),
                "from": start,
                "to": end,
                "from_ar": _e(start),
                "to_ar": _e(end),
                "items": [{"n": n, "n_ar": _e(n), "choices": list(ANSWER_CHOICES)} for n in nums],
            }
        )
        start = end + 1
    return cols


def ministry_id_eastern() -> str:
    """S-40341 → S-٤٠٣٤١ مع الإبقاء على البادئة اللاتينية."""
    return "".join(EASTERN[int(ch)] if ch.isdigit() else ch for ch in SCHOOL_MINISTRY_ID)


def school_block() -> dict[str, Any]:
    return {
        "code": SCHOOL_CODE,
        "code_ar": _e(SCHOOL_CODE),
        "ministry_id": SCHOOL_MINISTRY_ID,
        "ministry_id_ar": ministry_id_eastern(),
        "name": SCHOOL_NAME,
        "office": EDUCATION_OFFICE,
        "grade_default": GRADE,
    }


def build_omr_sheet_pack(
    item_count: int,
    *,
    student_name: str = "",
    national_id: str = "",
    section: str = "",
    grade: str = "",
    title: str = "ورقة التظليل الضوئي (OMR)",
    purpose: str = "home-mock",
) -> dict[str, Any]:
    """ورقة OMR بنفس قالب Sky Blue / Timing Marks — بعدد البنود المعتمد فقط، بلا اختلاق مفاتيح."""
    total = max(1, int(item_count))
    return {
        "ok": True,
        "wave": WAVE_TAG,
        "purpose": purpose,
        "omr_only": True,
        "no_answer_key": True,
        "source": SOURCE_REF,
        "title": title,
        "title_ar": title,
        "school": school_block(),
        "student": {
            "name": student_name or "",
            "national_id": national_id or "",
            "section": section or "",
            "grade": grade or GRADE,
        },
        "palette": {
            "sky": "#4aa3d9",
            "sky_light": "#d7eef8",
            "sky_mid": "#7ec4e8",
            "ink": "#12324a",
            "mark": "#111111",
            "banner": "#e67e22",
        },
        "pages": [
            {
                "code": "omr",
                "code_ar": "OMR",
                "title": title,
                "kind": "answer_sheet",
            }
        ],
        "answer_sheet": {
            "item_count": total,
            "item_count_ar": _e(total),
            "columns": answer_columns(total),
            "choices": list(ANSWER_CHOICES),
            "school_code_grid": digit_grid(
                columns=SCHOOL_CODE_DIGITS,
                label="رمز المدرسة",
                label_en="School Code",
            ),
            "national_id_grid": digit_grid(
                columns=NATIONAL_ID_DIGITS,
                label="رقم السجل المدني / رقم الإقامة",
                label_en="National / Iqama ID",
            ),
            "etec_ltr": ["ETEC", "Qiyas", "NAFS"],
            "shading_guide": {
                "correct": "تظليل كامل للدائرة",
                "wrong": ["✓", "✗", "تظليل جزئي", "خارج الدائرة"],
            },
        },
        "labels_ar": {
            "full_name": "الاسم الرباعي",
            "school_name": "اسم المدرسة",
            "grade": "الصف",
            "section": "الفصل",
            "national_id": "السجل المدني",
            "ministry_no": "الرقم الوزاري",
            "answers": "إجابات الأسئلة",
            "timing_marks": "علامات ضبط المسح",
            "page_of": "صفحة",
        },
    }


def digit_grid(*, columns: int, label: str, label_en: str = "") -> dict[str, Any]:
    return {
        "label": label,
        "label_en": label_en,
        "columns": columns,
        "digits": [{"d": i, "d_ar": EASTERN[i]} for i in range(10)],
    }


def build_training_form_pack(
    *,
    student_name: str = "",
    national_id: str = "",
    section: str = "",
    grade: str = "",
) -> dict[str, Any]:
    """حزمة نموذج التدريب التفاعلي/القابل للطباعة — بلا مفاتيح."""
    items = questionnaire_items()
    by_page: dict[str, list[dict[str, Any]]] = {"2-4": [], "3-4": [], "4-4": []}
    for it in items:
        by_page.setdefault(it["page"], []).append(it)

    return {
        "ok": True,
        "wave": WAVE_TAG,
        "source": SOURCE_REF,
        "no_answer_key": True,
        "school": school_block(),
        "student": {
            "name": student_name or "",
            "national_id": national_id or "",
            "section": section or "",
            "grade": grade or GRADE,
        },
        "palette": {
            "sky": "#4aa3d9",
            "sky_light": "#d7eef8",
            "sky_mid": "#7ec4e8",
            "ink": "#12324a",
            "mark": "#111111",
            "banner": "#e67e22",
        },
        "pages": [
            {
                "code": "1-4",
                "code_ar": "١-٤",
                "title": FORM_LABELS["1-4"],
                "kind": "answer_sheet",
            },
            {
                "code": "2-4",
                "code_ar": "٢-٤",
                "title": FORM_LABELS["2-4"],
                "kind": "questionnaire",
                "section": "عن الطالب",
            },
            {
                "code": "3-4",
                "code_ar": "٣-٤",
                "title": FORM_LABELS["3-4"],
                "kind": "questionnaire",
                "section": "عن المدرسة",
            },
            {
                "code": "4-4",
                "code_ar": "٤-٤",
                "title": FORM_LABELS["4-4"],
                "kind": "questionnaire",
                "section": "عن المعلمين والمواد الدراسية",
            },
        ],
        "answer_sheet": {
            "item_count": ANSWER_ITEM_COUNT,
            "item_count_ar": _e(ANSWER_ITEM_COUNT),
            "columns": answer_columns(),
            "choices": list(ANSWER_CHOICES),
            "school_code_grid": digit_grid(
                columns=SCHOOL_CODE_DIGITS,
                label="رمز المدرسة",
                label_en="School Code",
            ),
            "national_id_grid": digit_grid(
                columns=NATIONAL_ID_DIGITS,
                label="رقم السجل المدني / رقم الإقامة",
                label_en="National / Iqama ID",
            ),
            "etec_ltr": ["ETEC", "Qiyas", "NAFS"],
            "shading_guide": {
                "correct": "تظليل كامل للدائرة",
                "wrong": ["✓", "✗", "تظليل جزئي", "خارج الدائرة"],
            },
        },
        "questionnaire": {
            "item_count": len(items),
            "item_count_ar": _e(len(items)),
            "items": items,
            "by_page": by_page,
            "multi_banner": MULTI_SELECT_BANNER,
            "closing": CLOSING_PHRASE,
            "stems_invented": False,
        },
        "labels_ar": {
            "full_name": "الاسم الرباعي",
            "school_name": "اسم المدرسة",
            "grade": "الصف",
            "section": "الفصل",
            "national_id": "السجل المدني",
            "ministry_no": "الرقم الوزاري",
            "answers": "إجابات الأسئلة",
            "student_survey": "استبانة الطالب",
            "timing_marks": "علامات ضبط المسح",
            "page_of": "صفحة",
        },
    }
