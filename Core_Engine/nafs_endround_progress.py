# ملخص محاولات ختام الجولة — أعمدة التقدّم من portal_game_runs فقط (بلا اختلاق).
from __future__ import annotations

import json
from typing import Any


EASTERN = "٠١٢٣٤٥٦٧٨٩"
DEFAULT_LIMIT = 7
MAX_LIMIT = 12


def _e(v: Any) -> str:
    return "".join(EASTERN[int(c)] if c.isdigit() else c for c in str(v))


def parse_detail(raw: Any) -> dict:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


def game_type_clause(game: str) -> tuple[str, tuple]:
    """مطابقة عائلات اللعبة: words | mental (بادئة mental:)."""
    key = (game or "").strip().lower()
    if key in ("words", "word"):
        return "game_type = ?", ("words",)
    if key.startswith("mental"):
        return "game_type LIKE ?", ("mental:%",)
    # مسار صريح كامل إن مُرّر (مثل mental:solo:3)
    return "game_type = ?", (key,)


def normalize_attempt(row: dict, *, abs_index: int) -> dict:
    """صف واحد من portal_game_runs → حقول عرض نظيفة."""
    detail = parse_detail(row.get("detail_json"))
    score = int(row.get("score") or 0)
    total = int(detail.get("total") or 0)
    if total <= 0:
        # سجلات قديمة بلا total: لا نخترع أسئلة؛ نستخدم score كسقف نسبي لاحقاً
        total = 0
    elapsed = detail.get("elapsed")
    try:
        elapsed_sec = float(elapsed) if elapsed is not None else None
    except (TypeError, ValueError):
        elapsed_sec = None
    accuracy_pct = None
    if total > 0:
        accuracy_pct = int(round(100.0 * score / total))
    return {
        "id": row.get("id"),
        "abs_index": abs_index,
        "game_type": row.get("game_type") or "",
        "score": score,
        "total": total,
        "combo_best": int(row.get("combo_best") or 0),
        "elapsed_sec": elapsed_sec,
        "accuracy_pct": accuracy_pct,
        "tier": detail.get("tier") or "",
        "created_at": row.get("created_at") or "",
    }


def _score_key(attempt: dict) -> tuple:
    """أعلى إنجاز: دقة إن وُجدت وإلا الدرجة، ثم سرعة أفضل (زمن أقل)، ثم الأحدث."""
    acc = attempt.get("accuracy_pct")
    score = int(attempt.get("score") or 0)
    elapsed = attempt.get("elapsed_sec")
    # زمن أقل أفضل؛ إن غاب الزمن نضع قيمة كبيرة حتى لا يفوز بلا بيانات
    speed_rank = -(float(elapsed)) if elapsed is not None and elapsed >= 0 else -10_000.0
    primary = float(acc) if acc is not None else float(score)
    return (primary, speed_rank, int(attempt.get("abs_index") or 0))


def _improved(prev: dict, curr: dict) -> bool:
    """تحسّن مقارنة بالمحاولة السابقة من بيانات حقيقية فقط."""
    pa, ca = prev.get("accuracy_pct"), curr.get("accuracy_pct")
    if pa is not None and ca is not None:
        if ca > pa:
            return True
        if ca == pa:
            pe, ce = prev.get("elapsed_sec"), curr.get("elapsed_sec")
            if pe is not None and ce is not None and ce < pe and ca > 0:
                return True
        return False
    ps, cs = int(prev.get("score") or 0), int(curr.get("score") or 0)
    if cs > ps:
        return True
    if cs == ps and cs > 0:
        pe, ce = prev.get("elapsed_sec"), curr.get("elapsed_sec")
        if pe is not None and ce is not None and ce < pe:
            return True
    return False


def annotate_progress(attempts_asc: list[dict]) -> list[dict]:
    """شارات: نقطة البداية · أفضل رقم · ↑ تحسّن — على سلسلة تصاعدية زمنياً."""
    if not attempts_asc:
        return []
    best_idx = max(range(len(attempts_asc)), key=lambda i: _score_key(attempts_asc[i]))
    # سقف الارتفاع: أفضل دقة أو أعلى score في السلسلة
    max_acc = max((a.get("accuracy_pct") or 0) for a in attempts_asc)
    max_score = max(int(a.get("score") or 0) for a in attempts_asc)
    elapseds = [a["elapsed_sec"] for a in attempts_asc if a.get("elapsed_sec") is not None and a["elapsed_sec"] >= 0]
    min_e = min(elapseds) if elapseds else None
    max_e = max(elapseds) if elapseds else None

    out: list[dict] = []
    for i, raw in enumerate(attempts_asc):
        row = dict(raw)
        badges: list[str] = []
        if int(row.get("abs_index") or 0) == 1:
            badges.append("start")  # نقطة البداية
        if i == best_idx:
            badges.append("best")  # أفضل رقم
        if i > 0 and _improved(attempts_asc[i - 1], row):
            badges.append("improved")  # ↑ تحسّن

        # ارتفاع العمود ٠–١٠٠ من الدقة أو نسبة للدرجة القصوى في السلسلة
        if row.get("accuracy_pct") is not None:
            height = max(0, min(100, int(row["accuracy_pct"])))
        elif max_score > 0:
            height = max(0, min(100, int(round(100.0 * int(row.get("score") or 0) / max_score))))
        else:
            height = 0

        # مؤشر السرعة: أسرع = أعلى على العمود (١٠٠) — بلا اختلاق إن غاب الزمن
        speed_mark = None
        el = row.get("elapsed_sec")
        if el is not None and min_e is not None and max_e is not None:
            if max_e <= min_e:
                speed_mark = 100
            else:
                # عكس: الأقل زمناً → علامة أعلى
                speed_mark = int(round(100.0 * (max_e - float(el)) / (max_e - min_e)))
                speed_mark = max(0, min(100, speed_mark))

        row["n"] = i + 1  # رقم العمود داخل النافذة المعروضة ١…ن
        row["n_ar"] = _e(row["n"])
        row["abs_index_ar"] = _e(row.get("abs_index") or 0)
        row["score_ar"] = _e(row.get("score") or 0)
        row["total_ar"] = _e(row.get("total") or 0) if row.get("total") else ""
        row["accuracy_ar"] = _e(row["accuracy_pct"]) if row.get("accuracy_pct") is not None else ""
        row["elapsed_ar"] = _e(int(round(el))) if el is not None else ""
        row["height_pct"] = height
        row["speed_mark_pct"] = speed_mark
        row["badges"] = badges
        row["is_latest"] = i == len(attempts_asc) - 1
        out.append(row)

    # إن تساوى الجميع ولم نضع best (قائمة فارغة) — best_idx دائماً موجود
    return out


def build_progress_pulse(rows_asc: list[dict], *, limit: int = DEFAULT_LIMIT) -> dict[str, Any]:
    """
    rows_asc: كل محاولات اللعبة للطالب مرتبة من الأقدم للأحدث.
    نعرض آخر limit محاولات مع الحفاظ على abs_index الحقيقي.
    """
    limit = max(1, min(MAX_LIMIT, int(limit or DEFAULT_LIMIT)))
    normalized = [
        normalize_attempt(r, abs_index=i + 1) for i, r in enumerate(rows_asc)
    ]
    window = normalized[-limit:] if normalized else []
    attempts = annotate_progress(window)
    return {
        "attempts": attempts,
        "count": len(attempts),
        "total_runs": len(normalized),
        "limit": limit,
        "has_history": len(normalized) > 0,
        "labels": {
            "start": "نقطة البداية",
            "best": "أفضل رقم",
            "improved": "↑ تحسّن",
        },
    }


def fetch_runs_for_game(connection, student_nid: str, game: str) -> list[dict]:
    """قراءة حقيقية من portal_game_runs — الأقدم أولاً."""
    clause, params = game_type_clause(game)
    cur = connection.execute(
        f"""
        SELECT id, game_type, score, combo_best, detail_json, created_at
        FROM portal_game_runs
        WHERE student_nid = ? AND {clause}
        ORDER BY datetime(created_at) ASC, id ASC
        """,
        (student_nid, *params),
    )
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def fetch_challenge_runs(connection, student_nid: str) -> list[dict]:
    """
    امتداد آمن لـ portal_challenge_runs (المرحلة ٤ الخفيفة).
    يُحوَّل إلى شكل صفوف متوافق مع normalize_attempt دون اختلاق.
    """
    cur = connection.execute(
        """
        SELECT id, mode, correct_count, total_questions, score_pct,
               streak_best, duration_sec, finished_at, detail_json
        FROM portal_challenge_runs
        WHERE student_nid = ? AND finished_at != ''
        ORDER BY datetime(finished_at) ASC, id ASC
        """,
        (student_nid,),
    )
    rows = []
    for row in cur.fetchall():
        detail = parse_detail(row[8])
        total = int(row[3] or 0)
        score = int(row[2] or 0)
        # إن غاب العدّ نترك total=0 لسلوك legacy النسبي — لا نخترع أسئلة
        detail_out = {
            "total": total,
            "elapsed": float(row[6] or 0) or None,
            "tier": detail.get("tier") or "",
            "mode": row[1] or "",
            "score_pct": float(row[4] or 0),
            "source": "challenge_runs",
        }
        rows.append(
            {
                "id": row[0],
                "game_type": f"challenge:{row[1] or 'run'}",
                "score": score,
                "combo_best": int(row[5] or 0),
                "detail_json": detail_out,
                "created_at": row[7] or "",
            }
        )
    return rows


def fetch_runs(connection, student_nid: str, game: str) -> list[dict]:
    """توجيه موحّد: challenges|tests → challenge_runs؛ وإلا ألعاب التأسيس."""
    key = (game or "").strip().lower()
    if key in ("challenge", "challenges", "tests", "mock", "modes"):
        return fetch_challenge_runs(connection, student_nid)
    return fetch_runs_for_game(connection, student_nid, game)
