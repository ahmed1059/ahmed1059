# محرّك توليد النظائر المهارية — أرقام هندية وكسور عمودية داخل قوالب متغيّرة.
from __future__ import annotations

import random
from typing import Any

EASTERN = "٠١٢٣٤٥٦٧٨٩"


def to_eastern(value: Any) -> str:
    text = str(value)
    return "".join(EASTERN[int(ch)] if ch.isdigit() else ch for ch in text)


def frac_text(num: int, den: int) -> str:
    """نص كسر عمودي يُحوَّل لاحقاً في الواجهة عبر renderArabicMath."""
    return f"{to_eastern(num)}/{to_eastern(den)}"


def _choices(correct: str, distractors: list[str]) -> tuple[dict[str, str], str]:
    opts = [correct] + distractors[:3]
    while len(opts) < 4:
        opts.append(to_eastern(random.randint(1, 20)))
    random.shuffle(opts)
    letters = ["A", "B", "C", "D"]
    mapping = {letters[i]: opts[i] for i in range(4)}
    correct_letter = letters[opts.index(correct)]
    return mapping, correct_letter


def generate_parametric_batch(count: int = 4, domains: list[str] | None = None) -> list[dict]:
    """يولّد مسائل جديدة بقيم عشوائية لمنع حفظ الإجابات."""
    domains = domains or ["math", "science"]
    out: list[dict] = []
    builders = []
    if "math" in domains:
        builders.extend([_math_linear, _math_frac_percent, _math_area, _math_power])
    if "science" in domains:
        builders.extend([_sci_speed, _sci_density])
    if not builders:
        builders = [_math_linear]
    for i in range(max(1, count)):
        fn = random.choice(builders)
        q = fn()
        q["id"] = -(1000 + i)  # معرف سالب = نظير مولَّد
        q["parametric"] = True
        out.append(q)
    return out


def _math_linear() -> dict:
    a = random.randint(2, 9)
    x = random.randint(2, 12)
    b = random.randint(1, 15)
    right = a * x + b
    stem = f"إذا كان {to_eastern(a)}س + {to_eastern(b)} = {to_eastern(right)} فإن قيمة س تساوي:"
    correct = to_eastern(x)
    distractors = [to_eastern(x + 1), to_eastern(x - 1 if x > 2 else x + 2), to_eastern(a + b)]
    choices, letter = _choices(correct, distractors)
    return {
        "domain": "math",
        "skill": "الجبر",
        "stem": stem,
        "choices": choices,
        "correct": letter,
        "rationale": f"بطرح {to_eastern(b)} ثم القسمة على {to_eastern(a)}: س = {to_eastern(x)}.",
        "passage_title": "",
        "passage_text": "",
    }


def _math_frac_percent() -> dict:
    den = random.choice([4, 5, 8, 10])
    num = random.randint(1, den - 1)
    pct = int(round(100 * num / den))
    stem = f"حوّل الكسر {frac_text(num, den)} إلى نسبة مئوية:"
    correct = to_eastern(pct) + "٪"
    distractors = [
        to_eastern(pct + 5) + "٪",
        to_eastern(max(1, pct - 10)) + "٪",
        to_eastern(num * 10) + "٪",
    ]
    choices, letter = _choices(correct, distractors)
    return {
        "domain": "math",
        "skill": "الأعداد",
        "stem": stem,
        "choices": choices,
        "correct": letter,
        "rationale": f"{frac_text(num, den)} = {to_eastern(pct)}٪.",
        "passage_title": "",
        "passage_text": "",
    }


def _math_area() -> dict:
    length = random.randint(4, 14)
    width = random.randint(2, 9)
    area = length * width
    stem = f"مساحة مستطيل طوله {to_eastern(length)} وعرضه {to_eastern(width)} تساوي:"
    correct = to_eastern(area)
    distractors = [to_eastern(length + width), to_eastern(2 * (length + width)), to_eastern(area + length)]
    choices, letter = _choices(correct, distractors)
    return {
        "domain": "math",
        "skill": "الهندسة",
        "stem": stem,
        "choices": choices,
        "correct": letter,
        "rationale": f"المساحة = الطول × العرض = {to_eastern(area)}.",
        "passage_title": "",
        "passage_text": "",
    }


def _math_power() -> dict:
    base = random.randint(2, 5)
    exp = random.randint(2, 4)
    val = base ** exp
    stem = f"ناتج {to_eastern(base)}^{to_eastern(exp)} يساوي:"
    correct = to_eastern(val)
    distractors = [to_eastern(base * exp), to_eastern(base + exp), to_eastern(val + base)]
    choices, letter = _choices(correct, distractors)
    return {
        "domain": "math",
        "skill": "الأعداد",
        "stem": stem,
        "choices": choices,
        "correct": letter,
        "rationale": f"{to_eastern(base)}^{to_eastern(exp)} = {to_eastern(val)}.",
        "passage_title": "",
        "passage_text": "",
    }


def _sci_speed() -> dict:
    distance = random.choice([60, 80, 90, 120])
    time_h = random.choice([2, 3, 4])
    speed = distance // time_h
    stem = f"إذا قطع جسم مسافة {to_eastern(distance)} كم في {to_eastern(time_h)} ساعات فسرعته المتوسطة:"
    correct = to_eastern(speed) + " كم/س"
    distractors = [
        to_eastern(distance + time_h) + " كم/س",
        to_eastern(distance * time_h) + " كم/س",
        to_eastern(max(1, speed - 5)) + " كم/س",
    ]
    choices, letter = _choices(correct, distractors)
    return {
        "domain": "science",
        "skill": "العلوم الفيزيائية",
        "stem": stem,
        "choices": choices,
        "correct": letter,
        "rationale": f"السرعة = المسافة ÷ الزمن = {to_eastern(speed)} كم/س.",
        "passage_title": "",
        "passage_text": "",
    }


def _sci_density() -> dict:
    mass = random.choice([10, 12, 20, 24])
    volume = random.choice([2, 4, 5])
    density = mass // volume
    stem = f"كثافة جسم كتلته {to_eastern(mass)} غ وحجمه {to_eastern(volume)} سم³ تساوي تقريباً:"
    correct = to_eastern(density) + " غ/سم³"
    distractors = [
        to_eastern(mass + volume) + " غ/سم³",
        to_eastern(mass * volume) + " غ/سم³",
        to_eastern(max(1, density - 1)) + " غ/سم³",
    ]
    choices, letter = _choices(correct, distractors)
    return {
        "domain": "science",
        "skill": "العلوم الفيزيائية",
        "stem": stem,
        "choices": choices,
        "correct": letter,
        "rationale": f"الكثافة = الكتلة ÷ الحجم = {to_eastern(density)} غ/سم³.",
        "passage_title": "",
        "passage_text": "",
    }
