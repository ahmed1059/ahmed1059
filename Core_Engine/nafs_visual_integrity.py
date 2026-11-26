# سلامة العرض البصري لأسئلة نافس — عزل placeholders · حجب الناقص · رسوم SVG
# بلا اختلاق نصوص قراءة · أرقام هندية · RTL/LTR منضبط.
from __future__ import annotations

import re
from typing import Any

EASTERN = "٠١٢٣٤٥٦٧٨٩"

# عبارات وصفية مصدرية يجب ألا تُعرض كقطعة قراءة للطالب
PLACEHOLDER_MARKERS = (
    "نص التدريب في المصدر المطبوع",
    "يُعرض السؤال والخيارات المعتمدة بعد التنقية",
    "يُعرض السؤال والخيارات المعتمدة بعد التنقيه",
)

# إشارات إلى شكل/رسم يتطلب تمثيلاً بصرياً مرتبطاً
DIAGRAM_NEED_RE = re.compile(
    r"(يبين\s+شكل|شكل\s+انتشار|مدرج\s+تكراري|الصندوق\s+وطرفاه|"
    r"قطاع\s+دائري|التمثيل\s+البياني|انظر\s+الشكل|كما\s+في\s+الشكل|"
    r"الرسم\s+التالي|الشكل\s+التالي)",
    re.UNICODE,
)

# بقايا مسح شائعة: مسافة قبل واو وسط الكلمة
_WAW_SOFT_SUFFIXES = {
    "وم",
    "وفر",
    "ون",
    "ول",
    "ود",
    "وق",
    "وية",
    "وليات",
    "اء",
    "انب",
    "ادات",
    "اداتد",
    "ورات",
    "ود؟",
    "ور؟",
    "وي",
    "اهر",
    "امل",
    "اولة",
    "لات",
    "رات",
    "ايا",
    "اية",
    "ود.",
}

_KNOWN_OCR_FIXES = (
    ("الي وم", "اليوم"),
    ("الن وم", "النوم"),
    ("المقص ود", "المقصود"),
    ("المعل ومات", "المعلومات"),
    ("المعل وماتد", "المعلومات"),
    ("اله واء", "الهواء"),
    ("الج وانب", "الجوانب"),
    ("الصخ ور", "الصخور"),
    ("الأ ولويات", "الأولويات"),
    ("الوق ود", "الوقود"),
    ("الم وارد", "الموارد"),
    ("الضر ورة", "الضرورة"),
    ("الم واد", "المواد"),
    ("المحا ولة", "المحاولة"),
    ("الع وامل", "العوامل"),
    ("الج وي", "الجوي"),
    ("الظ واهر", "الظواهر"),
    ("المت وفر", "المتوفر"),
    ("يمتلك ون", "يمتلكون"),
    ("تتح ول", "تتحول"),
    ("الت وازن", "التوازن"),
    ("التط ور", "التطور"),
    ("التل وث", "التلوث"),
    ("الش وارع", "الشوارع"),
    ("الحك ومية", "الحكومية"),
    ("مسؤ ولية", "مسؤولية"),
    ("الذيت واجه", "الذي تواجه"),
    ("الذيتواجه", "الذي تواجه"),
    ("الصحرا وية", "الصحراوية"),
    ("مادةتج معها", "مادة تتجمد معها"),
    ("نوع منح بوب اللقاح", "نوع من حبوب اللقاح"),
    ("غذاءمصن وعداخل الخلية", "غذاء مصنوع داخل الخلية"),
    ("دةتستخدم لحماية الخليةم", "مادة تستخدم لحماية الخلية"),
    ("الت وجدعلقة", "لا توجد علاقة"),
        ("؟ب", "؟"),
    ("؟ا", "؟"),
    ("؟م", "؟"),
    ("الزراعةفي", "الزراعة في"),
    ("المناطق الصحراوية", "المناطق الصحراوية"),
)


def _e(value: Any) -> str:
    return "".join(EASTERN[int(c)] if c.isdigit() else c for c in str(value))


def is_placeholder_passage(text: str) -> bool:
    raw = (text or "").strip()
    if not raw:
        return False
    return any(m in raw for m in PLACEHOLDER_MARKERS)


def is_real_passage(text: str) -> bool:
    raw = (text or "").strip()
    if not raw or is_placeholder_passage(raw):
        return False
    # سطر مصدر قصير (مذكرة · مرجع) ليس نص قراءة
    if raw.count("·") >= 1 and len(raw) < 120 and "مذكرة" in raw:
        return False
    arabic = len(re.findall(r"[\u0600-\u06FF]", raw))
    return arabic >= 80


def stem_needs_diagram(stem: str) -> bool:
    return bool(DIAGRAM_NEED_RE.search(stem or ""))


def clean_ocr_ar(text: str) -> str:
    """تنقية محافظة لبقايا المسح دون اختلاق محتوى جديد."""
    if not text:
        return text
    t = text.replace("\u200e", "").replace("\u200f", "").replace("\ufeff", "")
    for bad, good in _KNOWN_OCR_FIXES:
        t = t.replace(bad, good)
    # ال + مسافة
    t = re.sub(r"(?<![\u0600-\u06FF])ال ([\u0600-\u06FF])", r"ال\1", t)

    def waw_soft(m: re.Match) -> str:
        left, right = m.group(1), m.group(2)
        if right in _WAW_SOFT_SUFFIXES or right.rstrip("؟.?!") in _WAW_SOFT_SUFFIXES:
            return left + "و" + right
        return m.group(0)

    t = re.sub(r"(\S+) و(\S{1,6})", waw_soft, t)
    # حرف مفرد غير أداة + مسافة + تتمة
    part = set("وفبلكأإآا")

    def join_single(m: re.Match) -> str:
        left, right = m.group(1), m.group(2)
        if left in part:
            return m.group(0)
        return left + right

    prev = None
    while prev != t:
        prev = t
        t = re.sub(
            r"(?<![\u0600-\u06FF])([\u0600-\u06FF]) ([\u0600-\u06FF]{2,})",
            join_single,
            t,
        )
    t = re.sub(r" {2,}", " ", t)
    t = re.sub(r"([؟?])[أ-يa-zA-Z]$", r"\1", t)
    return t.strip()


def sanitize_passage_for_student(passage_text: str, *, domain: str = "") -> str:
    """ما يُسمح بعرضه كقطعة قراءة — فارغ إن كان وصفياً/مصدر فقط."""
    raw = (passage_text or "").strip()
    if not raw or is_placeholder_passage(raw):
        return ""
    if domain and domain != "reading" and not is_real_passage(raw):
        # سطور مصدر الرياضيات/العلوم لا تُعرض كـ blockquote قراءة
        return ""
    if not is_real_passage(raw) and is_placeholder_passage(raw):
        return ""
    if not is_real_passage(raw) and ("مذكرة" in raw or "المصدر المطبوع" in raw):
        return ""
    return raw


def student_displayable(q: dict[str, Any]) -> bool:
    """
    جاهزية العرض للطالب:
    - قراءة بلا نص حقيقي → غير جاهز
    - يذكر شكلاً بلا diagram_svg → غير جاهز
    - نص وصفي مضلّل → يُصفّى من العرض (حتى لو بقي في البنك للأرشيف)
    """
    domain = str(q.get("domain") or "")
    stem = str(q.get("stem") or "")
    passage = str(q.get("passage_text") or "")
    diagram = str(q.get("diagram_svg") or "").strip()

    if is_placeholder_passage(passage):
        # حتى مع وجود stem: لا نعرض جولة قراءة بلا نص
        if domain == "reading":
            return False
    if domain == "reading" and not is_real_passage(passage):
        return False
    if stem_needs_diagram(stem) and not diagram:
        return False
    return True


def filter_student_questions(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [q for q in questions if student_displayable(q)]


def prepare_public_question(q: dict[str, Any]) -> dict[str, Any]:
    """حقول آمنة للعميل بعد تعقيم النص والرسم."""
    domain = str(q.get("domain") or "")
    out = dict(q)
    out["passage_text"] = sanitize_passage_for_student(q.get("passage_text") or "", domain=domain)
    if not out["passage_text"]:
        # لا عنوان قراءة بلا نص
        if domain != "reading" or not is_real_passage(q.get("passage_text") or ""):
            out["passage_title"] = ""
    if out.get("diagram_svg"):
        out["diagram_alt"] = out.get("diagram_alt") or "شكل توضيحي للسؤال"
    elif "diagram_svg" in out:
        out.pop("diagram_svg", None)
        out.pop("diagram_alt", None)
    return out


# ——— رسوم SVG (أرقام هندية · اتجاه محاور واضح) ———


def _svg_shell(body: str, *, alt: str, width: int = 420, height: int = 260) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'role="img" aria-label="{alt}" class="nafs-q-diagram-svg" '
        f'width="100%" height="auto">'
        f'<rect x="0" y="0" width="{width}" height="{height}" fill="#f7fbf9" stroke="#0b5e56" stroke-width="2"/>'
        f"{body}</svg>"
    )


def scatter_trend_svg(
    *,
    points: list[tuple[float, float]],
    x_label: str,
    y_label: str,
    title: str,
    x_max: float | None = None,
    y_max: float | None = None,
    predict_x: float | None = None,
) -> str:
    """شكل انتشار + خط اتجاه تقريبي."""
    pad_l, pad_r, pad_t, pad_b = 48, 24, 28, 40
    w, h = 420, 260
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    xmin, xmax = min(xs), max(x_max or max(xs), max(xs))
    ymin, ymax = 0.0, max(y_max or max(ys), max(ys)) * 1.15
    if predict_x is not None:
        xmax = max(xmax, predict_x)

    def sx(x: float) -> float:
        return pad_l + (x - xmin) / max(xmax - xmin, 1e-6) * (w - pad_l - pad_r)

    def sy(y: float) -> float:
        return h - pad_b - (y - ymin) / max(ymax - ymin, 1e-6) * (h - pad_t - pad_b)

    # خط اتجاه بسيط عبر أول وآخر نقطة
    x1, y1 = points[0]
    x2, y2 = points[-1]
    slope = (y2 - y1) / max(x2 - x1, 1e-6)
    x_end = predict_x if predict_x is not None else x2
    y_end = y1 + slope * (x_end - x1)
    line = (
        f'<line x1="{sx(x1):.1f}" y1="{sy(y1):.1f}" x2="{sx(x_end):.1f}" y2="{sy(y_end):.1f}" '
        f'stroke="#c45c26" stroke-width="2.5" stroke-dasharray="6 4"/>'
    )
    dots = "".join(
        f'<circle cx="{sx(x):.1f}" cy="{sy(y):.1f}" r="5" fill="#0b5e56"/>' for x, y in points
    )
    if predict_x is not None:
        dots += (
            f'<circle cx="{sx(predict_x):.1f}" cy="{sy(y_end):.1f}" r="5" fill="#c45c26" '
            f'stroke="#0b5e56" stroke-width="1.5"/>'
        )
    axes = (
        f'<line x1="{pad_l}" y1="{h-pad_b}" x2="{w-pad_r}" y2="{h-pad_b}" stroke="#333" stroke-width="1.5"/>'
        f'<line x1="{pad_l}" y1="{pad_t}" x2="{pad_l}" y2="{h-pad_b}" stroke="#333" stroke-width="1.5"/>'
    )
    labels = (
        f'<text x="{w/2:.0f}" y="18" text-anchor="middle" font-size="13" fill="#0b5e56" '
        f'font-family="Tahoma, Arial">{title}</text>'
        f'<text x="{w/2:.0f}" y="{h-8}" text-anchor="middle" font-size="11" fill="#333" '
        f'font-family="Tahoma, Arial">{x_label}</text>'
        f'<text x="14" y="{h/2:.0f}" text-anchor="middle" font-size="11" fill="#333" '
        f'font-family="Tahoma, Arial" transform="rotate(-90 14 {h/2:.0f})">{y_label}</text>'
    )
    # علامات محور س هندية
    ticks = ""
    for x, y in points:
        ticks += (
            f'<text x="{sx(x):.1f}" y="{h-pad_b+14}" text-anchor="middle" font-size="10" '
            f'fill="#333" font-family="Tahoma">{_e(int(x))}</text>'
        )
    body = axes + line + dots + labels + ticks
    return _svg_shell(body, alt=title)


def histogram_svg(
    *,
    categories: list[str],
    values: list[int],
    title: str,
    y_label: str = "التكرار",
) -> str:
    pad_l, pad_r, pad_t, pad_b = 48, 20, 28, 48
    w, h = 420, 260
    vmax = max(values) * 1.2 if values else 1
    n = max(len(values), 1)
    gap = 4
    bar_w = (w - pad_l - pad_r - gap * (n - 1)) / n
    bars = ""
    for i, (lab, val) in enumerate(zip(categories, values)):
        bh = (val / vmax) * (h - pad_t - pad_b)
        x = pad_l + i * (bar_w + gap)
        y = h - pad_b - bh
        bars += (
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{bh:.1f}" '
            f'fill="#4aa3d9" stroke="#0b5e56" stroke-width="1"/>'
            f'<text x="{x+bar_w/2:.1f}" y="{h-pad_b+14}" text-anchor="middle" font-size="9" '
            f'fill="#333" font-family="Tahoma">{lab}</text>'
            f'<text x="{x+bar_w/2:.1f}" y="{y-4:.1f}" text-anchor="middle" font-size="10" '
            f'fill="#0b5e56" font-family="Tahoma">{_e(val)}</text>'
        )
    axes = (
        f'<line x1="{pad_l}" y1="{h-pad_b}" x2="{w-pad_r}" y2="{h-pad_b}" stroke="#333" stroke-width="1.5"/>'
        f'<line x1="{pad_l}" y1="{pad_t}" x2="{pad_l}" y2="{h-pad_b}" stroke="#333" stroke-width="1.5"/>'
    )
    labels = (
        f'<text x="{w/2:.0f}" y="18" text-anchor="middle" font-size="13" fill="#0b5e56" '
        f'font-family="Tahoma">{title}</text>'
        f'<text x="14" y="{h/2:.0f}" text-anchor="middle" font-size="11" fill="#333" '
        f'font-family="Tahoma" transform="rotate(-90 14 {h/2:.0f})">{y_label}</text>'
    )
    return _svg_shell(axes + bars + labels, alt=title)


def pie_quarter_svg(*, title: str, highlight: str = "ب") -> str:
    """قطاع دائري رباعي يبرز الربع (ب)."""
    cx, cy, r = 210, 140, 90
    # أربعة أرباع: أ يمين-أعلى، ب يسار-أعلى (ربع)، ج يسار-أسفل، د يمين-أسفل — تبسيط بصري
    colors = {"أ": "#7ec4e8", "ب": "#0b5e56", "ج": "#c5e6f5", "د": "#4aa3d9"}
    # مسارات أرباع تقريبية
    paths = {
        "أ": f"M {cx} {cy} L {cx+r} {cy} A {r} {r} 0 0 0 {cx} {cy-r} Z",
        "ب": f"M {cx} {cy} L {cx} {cy-r} A {r} {r} 0 0 0 {cx-r} {cy} Z",
        "ج": f"M {cx} {cy} L {cx-r} {cy} A {r} {r} 0 0 0 {cx} {cy+r} Z",
        "د": f"M {cx} {cy} L {cx} {cy+r} A {r} {r} 0 0 0 {cx+r} {cy} Z",
    }
    body = "".join(
        f'<path d="{paths[k]}" fill="{colors[k]}" stroke="#fff" stroke-width="2"/>'
        for k in ("أ", "ب", "ج", "د")
    )
    labels = (
        f'<text x="{cx+r/2:.0f}" y="{cy-r/2:.0f}" text-anchor="middle" fill="#123" font-size="14">أ</text>'
        f'<text x="{cx-r/2:.0f}" y="{cy-r/2:.0f}" text-anchor="middle" fill="#fff" font-size="16" font-weight="700">ب</text>'
        f'<text x="{cx-r/2:.0f}" y="{cy+r/2:.0f}" text-anchor="middle" fill="#123" font-size="14">ج</text>'
        f'<text x="{cx+r/2:.0f}" y="{cy+r/2:.0f}" text-anchor="middle" fill="#123" font-size="14">د</text>'
        f'<text x="210" y="24" text-anchor="middle" font-size="13" fill="#0b5e56" font-family="Tahoma">{title}</text>'
        f'<text x="210" y="248" text-anchor="middle" font-size="11" fill="#333" font-family="Tahoma">'
        f"القطاع ({highlight}) ≈ ربع الدائرة</text>"
    )
    return _svg_shell(body + labels, alt=title)


def boxplot_svg(
    *,
    min_v: int,
    q1: int,
    median: int,
    q3: int,
    max_v: int,
    title: str,
) -> str:
    pad_l, pad_r, pad_t, pad_b = 40, 40, 36, 40
    w, h = 420, 200
    lo, hi = min_v - 2, max_v + 2

    def sx(v: float) -> float:
        return pad_l + (v - lo) / max(hi - lo, 1) * (w - pad_l - pad_r)

    cy = 110
    box_h = 36
    body = (
        f'<line x1="{sx(min_v):.1f}" y1="{cy}" x2="{sx(max_v):.1f}" y2="{cy}" stroke="#0b5e56" stroke-width="2"/>'
        f'<line x1="{sx(min_v):.1f}" y1="{cy-18}" x2="{sx(min_v):.1f}" y2="{cy+18}" stroke="#0b5e56" stroke-width="2"/>'
        f'<line x1="{sx(max_v):.1f}" y1="{cy-18}" x2="{sx(max_v):.1f}" y2="{cy+18}" stroke="#0b5e56" stroke-width="2"/>'
        f'<rect x="{sx(q1):.1f}" y="{cy-box_h/2:.1f}" width="{sx(q3)-sx(q1):.1f}" height="{box_h}" '
        f'fill="#d7eef8" stroke="#0b5e56" stroke-width="2"/>'
        f'<line x1="{sx(median):.1f}" y1="{cy-box_h/2:.1f}" x2="{sx(median):.1f}" y2="{cy+box_h/2:.1f}" '
        f'stroke="#c45c26" stroke-width="3"/>'
    )
    for val, lab in (
        (min_v, "أدنى"),
        (q1, "ر١"),
        (median, "وسيط"),
        (q3, "ر٣"),
        (max_v, "أعلى"),
    ):
        body += (
            f'<text x="{sx(val):.1f}" y="{cy+42}" text-anchor="middle" font-size="10" fill="#333" '
            f'font-family="Tahoma">{_e(val)}</text>'
            f'<text x="{sx(val):.1f}" y="{cy-28}" text-anchor="middle" font-size="9" fill="#0b5e56" '
            f'font-family="Tahoma">{lab}</text>'
        )
    body += (
        f'<text x="210" y="22" text-anchor="middle" font-size="13" fill="#0b5e56" '
        f'font-family="Tahoma">{title}</text>'
    )
    return _svg_shell(body, alt=title, height=200)


def attach_wave_b_diagrams(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """يربط رسوم SVG الموثّقة بأسئلة الإحصاء التي تشير إلى شكل."""
    out = []
    for r in rows:
        item = dict(r)
        stem = item.get("stem") or ""
        ref = item.get("source_ref") or ""
        if "شكل انتشار أرباح" in stem or ref == "س٩٨":
            item["diagram_svg"] = scatter_trend_svg(
                points=[(1, 11), (2, 12), (3, 12.5), (4, 13.5), (5, 14), (6, 15)],
                x_label="الأشهر (محرم → جمادى الآخرة)",
                y_label="الأرباح (ألف ريال)",
                title="شكل انتشار أرباح محل الملابس",
                predict_x=8,
                y_max=18,
            )
            item["diagram_alt"] = "شكل انتشار لأرباح المحل مع خط اتجاه صاعد"
            item["diagram_kind"] = "scatter"
        elif "شكل انتشار عدد المسجلين" in stem or ref == "س٩٩":
            item["diagram_svg"] = scatter_trend_svg(
                points=[(2, 10), (4, 18), (6, 24), (8, 30), (10, 35)],
                x_label="رقم الشهر",
                y_label="عدد المسجلين",
                title="شكل انتشار المسجلين في النادي",
                predict_x=10,
                y_max=40,
            )
            item["diagram_alt"] = "شكل انتشار لعدد المسجلين وخط الاتجاه عند الشهر ١٠"
            item["diagram_kind"] = "scatter"
        elif "مدرج تكراري للعمر" in stem:
            item["diagram_svg"] = histogram_svg(
                categories=["٢٠–٢٤", "٢٥–٢٩"],
                values=[12, 6],
                title="مدرج تكراري — العمر عند أول وظيفة",
            )
            item["diagram_alt"] = "مدرج تكراري لأعمار بداية الوظيفة (١٢ و٦)"
            item["diagram_kind"] = "histogram"
        elif "الصندوق وطرفاه" in stem:
            item["diagram_svg"] = boxplot_svg(
                min_v=44, q1=52, median=56, q3=64, max_v=72, title="الصندوق وطرفاه"
            )
            item["diagram_alt"] = "تمثيل الصندوق وطرفاه للبيانات المعطاة"
            item["diagram_kind"] = "boxplot"
        elif "قطاع دائري رباعي" in stem:
            item["diagram_svg"] = pie_quarter_svg(title="قطاع دائري رباعي")
            item["diagram_alt"] = "قطاع دائري يبرز القطاع ب كربع تقريباً"
            item["diagram_kind"] = "pie"
        # لا نعرض سطر المصدر كقطعة قراءة
        item["passage_text"] = ""
        out.append(item)
    return out


def ensure_diagram_columns(connection) -> None:
    cols = {row[1] for row in connection.execute("PRAGMA table_info(nafs_question_bank)")}
    if "diagram_svg" not in cols:
        connection.execute(
            "ALTER TABLE nafs_question_bank ADD COLUMN diagram_svg TEXT NOT NULL DEFAULT ''"
        )
    if "diagram_alt" not in cols:
        connection.execute(
            "ALTER TABLE nafs_question_bank ADD COLUMN diagram_alt TEXT NOT NULL DEFAULT ''"
        )
    if "student_ready" not in cols:
        connection.execute(
            "ALTER TABLE nafs_question_bank ADD COLUMN student_ready INTEGER NOT NULL DEFAULT 1"
        )
