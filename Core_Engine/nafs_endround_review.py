# بطاقة مراجعة موحّدة بعد الجولة — من السجلات المحفوظة فقط بلا اختلاق مفاتيح.
from __future__ import annotations

from typing import Any

EASTERN = "٠١٢٣٤٥٦٧٨٩"
LETTER_AR = {"A": "أ", "B": "ب", "C": "ج", "D": "د"}


def _e(value: Any) -> str:
    return "".join(EASTERN[int(c)] if c.isdigit() else c for c in str(value))


def letter_ar(code: str) -> str:
    key = str(code or "").strip().upper()
    return LETTER_AR.get(key, key)


def choice_text(choices: dict | None, code: str) -> str:
    if not isinstance(choices, dict):
        return ""
    key = str(code or "").strip().upper()
    return str(choices.get(key) or choices.get(letter_ar(key)) or "").strip()


def build_review_item(
    *,
    stem: str = "",
    choice: str = "",
    correct: str = "",
    ok: bool | None = None,
    rationale: str = "",
    choices: dict | None = None,
    choice_label: str = "",
    correct_label: str = "",
    question_id: Any = None,
) -> dict[str, Any]:
    """صف مراجعة واحد — لا يُختلق تعليل أو مفتاح إن غابا."""
    ch = str(choice or "").strip().upper()
    cr = str(correct or "").strip().upper()
    is_ok = bool(ok) if ok is not None else (bool(ch) and bool(cr) and ch == cr)
    your_label = (choice_label or choice_text(choices, ch) or "").strip()
    right_label = (correct_label or choice_text(choices, cr) or "").strip()
    return {
        "question_id": question_id if question_id is not None else "",
        "stem": str(stem or "").strip(),
        "choice": ch,
        "correct": cr,
        "choice_ar": letter_ar(ch) if ch else "",
        "correct_ar": letter_ar(cr) if cr else "",
        "choice_label": your_label,
        "correct_label": right_label,
        "ok": is_ok,
        "rationale": str(rationale or "").strip(),
    }


def summarize_review(items: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(items)
    correct_n = sum(1 for it in items if it.get("ok"))
    wrong_n = max(0, total - correct_n)
    return {
        "total": total,
        "total_ar": _e(total),
        "correct_count": correct_n,
        "correct_count_ar": _e(correct_n),
        "wrong_count": wrong_n,
        "wrong_count_ar": _e(wrong_n),
        "items": items,
        "wrong_items": [it for it in items if not it.get("ok")],
    }


def review_from_challenge_answers(
    answers: list[dict],
    *,
    correct_map: dict,
    questions_full: dict,
    lookup_row,  # callable(qid_int) -> (stem, rationale, a, b, c, d) | None
) -> dict[str, Any]:
    reviewed: list[dict[str, Any]] = []
    for ans in answers or []:
        qid = str(ans.get("question_id") or "")
        choice = str(ans.get("choice") or "").upper()
        expected = str(correct_map.get(qid) or "").upper()
        is_ok = bool(expected) and choice == expected
        q_full = (questions_full or {}).get(qid) or {}
        stem = q_full.get("stem") or ""
        rationale = q_full.get("rationale") or ""
        choices = q_full.get("choices") if isinstance(q_full.get("choices"), dict) else None
        if not choices:
            choices = {
                "A": q_full.get("choice_a") or "",
                "B": q_full.get("choice_b") or "",
                "C": q_full.get("choice_c") or "",
                "D": q_full.get("choice_d") or "",
            }
        qid_int = 0
        try:
            qid_int = int(qid)
        except ValueError:
            qid_int = 0
        if (not stem or not any(choices.values())) and qid_int > 0 and lookup_row:
            qrow = lookup_row(qid_int)
            if qrow:
                stem = stem or (qrow[0] or "")
                rationale = rationale or (qrow[1] or "")
                choices = {
                    "A": qrow[2] or "",
                    "B": qrow[3] or "",
                    "C": qrow[4] or "",
                    "D": qrow[5] or "",
                }
        reviewed.append(
            build_review_item(
                stem=stem,
                choice=choice,
                correct=expected,
                ok=is_ok,
                rationale=rationale,
                choices=choices,
                question_id=qid_int or qid,
            )
        )
    return summarize_review(reviewed)


def review_from_game_answers(answers: list[dict]) -> dict[str, Any]:
    """يبني المراجعة من إجابات اللعبة إن حملت stem/correct المحفوظة مع الجولة."""
    reviewed: list[dict[str, Any]] = []
    for ans in answers or []:
        reviewed.append(
            build_review_item(
                stem=str(ans.get("stem") or ""),
                choice=str(ans.get("choice") or ""),
                correct=str(ans.get("correct") or ""),
                ok=ans.get("ok"),
                rationale=str(ans.get("rationale") or ""),
                choice_label=str(ans.get("choice_label") or ""),
                correct_label=str(ans.get("correct_label") or ""),
                choices=ans.get("choices") if isinstance(ans.get("choices"), dict) else None,
                question_id=ans.get("id") or ans.get("question_id") or "",
            )
        )
    return summarize_review(reviewed)
