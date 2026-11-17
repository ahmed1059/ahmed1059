# محرك الضمائر — التحويل عند الاستدعاء فقط، وبمكتبة re القياسية

import json
import re
from pathlib import Path

DICT_PATH = Path(__file__).resolve().parent / "pronoun_dict.json"

# المقتبس، ثم التاريخ، ثم الرقم؛ في مرور واحد حتى لا تُعاد معالجة المواضع المحمية
_PROTECTED = re.compile(
    r"\[!.*?\!]|\d{4}-\d{1,2}-\d{1,2}|[0-9\u0660-\u0669]+",
    flags=re.DOTALL,
)

_PAIRS = None


def _pairs():
    """يجمع أزواج القاموس من الأطول إلى الأقصر لتجنب التداخل."""
    global _PAIRS
    if _PAIRS is None:
        payload = json.loads(DICT_PATH.read_text(encoding="utf-8"))
        pairs = []
        for group in payload.values():
            pairs.extend(group.items())
        pairs.sort(key=lambda item: len(item[0]), reverse=True)
        _PAIRS = pairs
    return _PAIRS


def convert(text: str, gender: str) -> str:
    """يحوّل النص من المذكر إلى الصيغة المطابقة لجنس المدرسة."""
    if gender == "male":
        return text
    if gender != "female":
        raise ValueError("جنس المدرسة يجب أن يكون male أو female")

    protected = []

    def hold(match):
        protected.append(match.group(0))
        return f"\ue000{len(protected) - 1}\ue001"

    masked = _PROTECTED.sub(hold, text)
    for source, target in _pairs():
        # حرف عطف أو جر واحد قد يلتصق بالكلمة، وحد \b لا يراه
        _ARABIC = r"\u0621-\u064A"
        _PREFIX = r"[وفبلك]"
        pattern = re.compile(
            rf"(?<![{_ARABIC}])({_PREFIX}?)({re.escape(source)})(?![{_ARABIC}])"
        )
        masked = pattern.sub(
            lambda m, replacement=target: (m.group(1) or "") + replacement,
            masked,
        )

    def restore(match):
        return protected[int(match.group(1))]

    return re.sub(r"\ue000(\d+)\ue001", restore, masked)
