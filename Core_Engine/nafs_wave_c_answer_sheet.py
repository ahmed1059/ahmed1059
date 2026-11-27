# موجة ج: نموذج إجابة نافس التدريبي + استبانة الطالب (A4)
# مرجع: نموذج الإجابة الرسمي الممسوح (١-٤…٤-٤) للثالث المتوسط + دليل نافس/ETEC.
# بلا مفاتيح إجابة. نصوص الاستبانة من الأصل الرسمي فقط (لا اختلاق).
from __future__ import annotations

from typing import Any

EASTERN = "٠١٢٣٤٥٦٧٨٩"

SCHOOL_CODE = "40341"
SCHOOL_MINISTRY_ID = "S-40341"
SCHOOL_NAME = "متوسطة سعد بن الربيع الأنصاري"
GRADE = "الثالث المتوسط"
EDUCATION_OFFICE = "الإدارة العامة للتعليم بمنطقة المدينة المنورة"

# شبكة إجابات النموذج الرسمي للثالث المتوسط: ١–٦٦ في ٥ أعمدة رأسية (RTL)
ANSWER_ITEM_COUNT = 66
ANSWER_COLUMNS = 5
ANSWER_CHOICES = ("أ", "ب", "ج", "د")

# شبكات التظليل العمودية (رمز المدرسة ٥ خانات في النموذج الرسمي)
SCHOOL_CODE_DIGITS = 5
NATIONAL_ID_DIGITS = 10

FORM_LABELS = {
    "1-4": "ورقة الإجابات",
    "2-4": "استبانة الطالب — عن الطالب",
    "3-4": "استبانة الطالب — عن المدرسة والمعلمين",
    "4-4": "استبانة الطالب — عن المعلمين والمواد الدراسية",
}

MULTI_SELECT_BANNER = "يمكن للطالب تعبئة أكثر من إجابة"
CLOSING_PHRASE = "شكرًا لإجابتكم على هذه الاستبانة"

SOURCE_REF = (
    "نموذج الإجابة اختبار نافس (مسح رسمي ١-٤…٤-٤) · "
    "هيئة تقويم التعليم والتدريب / المركز الوطني للقياس"
)
WAVE_TAG = "wave-c-answer-sheet"
STEM_SOURCE = "نموذج الإجابة اختبار نافس الرسمي — استبانة الطالب"


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
    stem: str,
    choices: tuple[str, ...] | list[str] = ANSWER_CHOICES,
    choice_labels: tuple[str, ...] | list[str] | None = None,
    multi: bool = False,
    matrix_cols: tuple[str, ...] | list[str] | None = None,
    matrix_row_labels: tuple[str, ...] | list[str] | None = None,
) -> dict[str, Any]:
    """بند استبانة من النص الرسمي — بلا اختلاق."""
    labels = list(choice_labels) if choice_labels is not None else list(choices)
    if choice_labels is not None and kind != "matrix":
        keys = list(ANSWER_CHOICES[: len(labels)]) if len(choices) != len(labels) else list(choices)
        if len(keys) != len(labels):
            keys = list(ANSWER_CHOICES[: len(labels)])
    else:
        keys = list(choices)
    row: dict[str, Any] = {
        "n": n,
        "n_ar": _e(n),
        "section": section,
        "page": page,
        "kind": kind,
        "choices": keys,
        "choice_labels": labels,
        "multi": bool(multi),
        "stem": stem,
        "stem_source": STEM_SOURCE,
    }
    if multi:
        row["banner"] = MULTI_SELECT_BANNER
    if kind == "matrix":
        row_labels = list(matrix_row_labels or [])
        cols = list(matrix_cols or ("صفر", "١", "٢", "٣ أو أكثر"))
        row["matrix"] = {
            "rows": [
                {
                    "i": i + 1,
                    "i_ar": _e(i + 1),
                    "label": row_labels[i] if i < len(row_labels) else "",
                    "key": ANSWER_CHOICES[i] if i < len(ANSWER_CHOICES) else _e(i + 1),
                }
                for i in range(len(row_labels))
            ],
            "cols": cols,
        }
        # مفاتيح تظليل الأعمدة أ…د بعدد أعمدة المصفوفة
        row["choices"] = list(ANSWER_CHOICES[: len(cols)])
    return row


def questionnaire_items() -> list[dict[str, Any]]:
    """٢٢ بنداً بنصوص النموذج الرسمي — صفحات ٢-٤…٤-٤."""
    freq4 = ("دائمًا", "غالبًا", "أحيانًا", "مطلقًا")
    abs_late = ("أسبوعيًا", "شهريًا", "نادرًا", "لا أتغيب")
    late4 = ("أسبوعيًا", "شهريًا", "نادرًا", "لا أتأخر")
    enjoy4 = ("كبير", "متوسط", "ضعيف", "لا أستمتع بدراستها")
    benefit4 = ("كبير", "متوسط", "ضعيف", "لا أستفيد منه")
    difficulty3 = ("صعبة", "متوسطة الصعوبة", "سهلة")
    count4 = ("صفر", "١", "٢", "٣ أو أكثر")
    peer4 = ("أسبوعيًا", "شهريًا", "نادرًا", "أبدًا")

    student = [
        _item(
            1,
            section="عن الطالب",
            page="2-4",
            kind="single",
            stem="أتحدث باللغة العربية في المنزل:",
            choice_labels=freq4,
        ),
        _item(
            2,
            section="عن الطالب",
            page="2-4",
            kind="multi",
            multi=True,
            stem="أي مما يلي لديك في المنزل؟",
            choice_labels=("حاسب آلي", "جوال", "إنترنت", "ألعاب إلكترونية"),
        ),
        _item(
            3,
            section="عن الطالب",
            page="2-4",
            kind="single",
            stem="أستخدم الإنترنت في الأغراض الدراسية:",
            choice_labels=freq4,
        ),
        _item(
            4,
            section="عن الطالب",
            page="2-4",
            kind="yn",
            stem="هل درست في مرحلة التمهيدي؟",
            choices=("أ", "ب"),
            choice_labels=("نعم", "لا"),
        ),
        _item(
            5,
            section="عن الطالب",
            page="2-4",
            kind="multi",
            multi=True,
            stem="أسكن مع:",
            choice_labels=("أبي", "أمي", "إخواني وأخواتي", "أشخاص آخرين"),
        ),
        _item(
            6,
            section="عن الطالب",
            page="2-4",
            kind="single",
            stem="أتغيب عن المدرسة:",
            choice_labels=abs_late,
        ),
        _item(
            7,
            section="عن الطالب",
            page="2-4",
            kind="single",
            stem="أتأخر عن المدرسة:",
            choice_labels=late4,
        ),
        _item(
            8,
            section="عن الطالب",
            page="2-4",
            kind="matrix",
            stem="كم عندكم في المنزل مما يلي؟",
            matrix_cols=count4,
            matrix_row_labels=("أ. سيارة", "ب. عاملة منزلية", "ج. سائق"),
        ),
    ]

    # صفحة ٣-٤: عن المدرسة (٩–١٠) ثم بداية المعلمين (١١–١٦)
    school = [
        _item(
            9,
            section="عن المدرسة",
            page="3-4",
            kind="single",
            stem="أحب مدرستي بشكل:",
            choices=("أ", "ب", "ج"),
            choice_labels=("قوي", "متوسط", "ضعيف"),
        ),
        _item(
            10,
            section="عن المدرسة",
            page="3-4",
            kind="matrix",
            stem="خلال هذه السنة الدراسية، هل قام زملاؤك في المدرسة بتصرفات غير جيدة معك؟",
            matrix_cols=peer4,
            matrix_row_labels=(
                "أ. سخروا مني",
                "ب. ضربوني أو هددوني",
                "ج. نشروا معلومات محرجة عني",
            ),
        ),
    ]
    teachers_p3 = [
        _item(
            11,
            section="عن المعلمين والمواد الدراسية",
            page="3-4",
            kind="single",
            stem="أستمتع بدراسة اللغة العربية بشكل:",
            choice_labels=enjoy4,
        ),
        _item(
            12,
            section="عن المعلمين والمواد الدراسية",
            page="3-4",
            kind="single",
            stem="أستمتع بدراسة الرياضيات بشكل:",
            choice_labels=enjoy4,
        ),
        _item(
            13,
            section="عن المعلمين والمواد الدراسية",
            page="3-4",
            kind="single",
            stem="أستمتع بدراسة العلوم بشكل:",
            choice_labels=enjoy4,
        ),
        _item(
            14,
            section="عن المعلمين والمواد الدراسية",
            page="3-4",
            kind="single",
            stem="أستفيد من معلم اللغة العربية بشكل:",
            choice_labels=benefit4,
        ),
        _item(
            15,
            section="عن المعلمين والمواد الدراسية",
            page="3-4",
            kind="single",
            stem="أستفيد من معلم الرياضيات بشكل:",
            choice_labels=benefit4,
        ),
        _item(
            16,
            section="عن المعلمين والمواد الدراسية",
            page="3-4",
            kind="single",
            stem="أستفيد من معلم العلوم بشكل:",
            choice_labels=benefit4,
        ),
    ]

    teachers_p4 = [
        _item(
            17,
            section="عن المعلمين والمواد الدراسية",
            page="4-4",
            kind="single",
            stem="تُعد مادة اللغة العربية بالنسبة لي:",
            choices=("أ", "ب", "ج"),
            choice_labels=difficulty3,
        ),
        _item(
            18,
            section="عن المعلمين والمواد الدراسية",
            page="4-4",
            kind="single",
            stem="تُعد مادة الرياضيات بالنسبة لي:",
            choices=("أ", "ب", "ج"),
            choice_labels=difficulty3,
        ),
        _item(
            19,
            section="عن المعلمين والمواد الدراسية",
            page="4-4",
            kind="single",
            stem="تُعد مادة العلوم بالنسبة لي:",
            choices=("أ", "ب", "ج"),
            choice_labels=difficulty3,
        ),
        _item(
            20,
            section="عن المعلمين والمواد الدراسية",
            page="4-4",
            kind="single",
            stem="كم مرة يعطيك المعلمون واجبًا منزليًا؟",
            choice_labels=("يوميًا", "أسبوعيًا", "شهريًا", "لا يعطونني أي واجب"),
        ),
        _item(
            21,
            section="عن المعلمين والمواد الدراسية",
            page="4-4",
            kind="single",
            stem="كم تقضي من الوقت في حل الواجبات المنزلية؟",
            choices=("أ", "ب", "ج"),
            choice_labels=("ساعة", "أكثر من ساعة", "لا شيء"),
        ),
        _item(
            22,
            section="عن المعلمين والمواد الدراسية",
            page="4-4",
            kind="matrix",
            stem="خلال آخر فصل دراسي، كم درسًا خصوصيًا أو إضافيًا حضرته للمواد التالية؟",
            matrix_cols=count4,
            matrix_row_labels=("أ. الرياضيات", "ب. العلوم", "ج. اللغة العربية"),
        ),
    ]
    return student + school + teachers_p3 + teachers_p4


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
            "stems_from_official": True,
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
