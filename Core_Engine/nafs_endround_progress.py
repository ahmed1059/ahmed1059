# ملخص محاولات ختام الجولة — أعمدة التقدّم من portal_game_runs
# وامتداد المرحلة ٤ لـ portal_challenge_runs (بلا اختلاق).
from __future__ import annotations

import json
from typing import Any


EASTERN = "٠١٢٣٤٥٦٧٨٩"
DEFAULT_LIMIT = 7
MAX_LIMIT = 12

# مفاتيح توجيه إلى سجلات الميدان/التحدي
CHALLENGE_GAME_KEYS = frozenset(
    {"challenge", "challenges", "tests", "modes", "arena", "mock", "daily", "rescue", "duel", "purge", "national"}
)
CHALLENGE_MODE_KEYS = frozenset({"daily", "rescue", "mock", "duel", "purge", "national"})


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


def is_challenge_game(game: str) -> bool:
    return (game or "").strip().lower() in CHALLENGE_GAME_KEYS


def normalize_attempt(row: dict, *, abs_index: int) -> dict:
    """صف موحّد (ألعاب أو تحدٍ) → حقول عرض نظيفة بلا اختلاق total."""
    detail = parse_detail(row.get("detail_json"))
    score = int(row.get("score") or 0)
    total = int(detail.get("total") or 0)
    if total <= 0:
        # سجلات قديمة بلا total: لا نخترع أسئلة؛ نستخدم score/score_pct كسقف نسبي لاحقاً
        total = 0
    elapsed = detail.get("elapsed")
    try:
        elapsed_sec = float(elapsed) if elapsed is not None else None
    except (TypeError, ValueError):
        elapsed_sec = None
    accuracy_pct = None
    if total > 0:
        accuracy_pct = int(round(100.0 * score / total))
    elif detail.get("score_pct") is not None and detail.get("score_pct") != "":
        # تحدٍ محفوظ بـ score_pct دون عدّ أسئلة — لا اختلاق total
        try:
            accuracy_pct = int(round(float(detail.get("score_pct"))))
        except (TypeError, ValueError):
            accuracy_pct = None
    source = detail.get("source") or "game_runs"
    mode = detail.get("mode") or ""
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
        "mode": mode,
        "source": source,
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
    rows_asc: كل محاولات اللعبة/التحدي للطالب مرتبة من الأقدم للأحدث.
    نعرض آخر limit محاولات مع الحفاظ على abs_index الحقيقي.
    """
    limit = max(1, min(MAX_LIMIT, int(limit or DEFAULT_LIMIT)))
    normalized = [
        normalize_attempt(r, abs_index=i + 1) for i, r in enumerate(rows_asc)
    ]
    window = normalized[-limit:] if normalized else []
    attempts = annotate_progress(window)
    source = "challenge_runs" if any(a.get("source") == "challenge_runs" for a in attempts) else "game_runs"
    return {
        "attempts": attempts,
        "count": len(attempts),
        "total_runs": len(normalized),
        "limit": limit,
        "has_history": len(normalized) > 0,
        "source": source,
        "title": "تحدياتك" if source == "challenge_runs" else "محاولاتك",
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


def fetch_challenge_runs(
    connection,
    student_nid: str,
    *,
    mode: str | None = None,
) -> list[dict]:
    """
    امتداد المرحلة ٤: portal_challenge_runs → صفوف متوافقة مع normalize_attempt.
    لا اختلاق لـ total عند غيابه؛ يعتمد score_pct المحفوظ عند الحاجة.
    """
    sql = """
        SELECT id, mode, correct_count, total_questions, score_pct,
               streak_best, duration_sec, finished_at, detail_json
        FROM portal_challenge_runs
        WHERE student_nid = ? AND finished_at != ''
    """
    params: list[Any] = [student_nid]
    mode_key = (mode or "").strip().lower()
    if mode_key in CHALLENGE_MODE_KEYS:
        sql += " AND mode = ?"
        params.append(mode_key)
    sql += " ORDER BY datetime(finished_at) ASC, id ASC"
    cur = connection.execute(sql, tuple(params))
    rows: list[dict] = []
    for row in cur.fetchall():
        detail = parse_detail(row[8])
        total = int(row[3] or 0)
        score = int(row[2] or 0)
        try:
            duration = float(row[6] or 0)
        except (TypeError, ValueError):
            duration = 0.0
        detail_out = {
            "total": total if total > 0 else 0,
            "elapsed": duration if duration > 0 else None,
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
    """توجيه موحّد: أنماط التحدي/الميدان → challenge_runs؛ وإلا ألعاب التأسيس."""
    key = (game or "").strip().lower()
    if key in CHALLENGE_MODE_KEYS:
        return fetch_challenge_runs(connection, student_nid, mode=key)
    if key in CHALLENGE_GAME_KEYS:
        return fetch_challenge_runs(connection, student_nid)
    return fetch_runs_for_game(connection, student_nid, game)


