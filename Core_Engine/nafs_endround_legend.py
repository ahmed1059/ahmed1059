# مرحلة ٣: فارق القفزة الآمن + شريط أسطورة نافس من XP الحقيقي.
# سلّم الألقاب مرآة لـ RANK_TIERS في portal-student.js (بلا ألقاب مخترعة).
from __future__ import annotations

from typing import Any

EASTERN = "٠١٢٣٤٥٦٧٨٩"
MIN_PARTICIPANTS = 3

# مطابق لـ Print_Canvas/js/portal-student.js → RANK_TIERS
LEGEND_TIERS = (
    {"min": 0, "title": "فارس مبتدئ", "next": 50},
    {"min": 50, "title": "فارس نشط", "next": 150},
    {"min": 150, "title": "بطل الأسبوع", "next": 350},
    {"min": 350, "title": "نخبة الصف", "next": 700},
    {"min": 700, "title": "أسطورة نافس", "next": 1200},
)


def _e(v: Any) -> str:
    return "".join(EASTERN[int(c)] if c.isdigit() else c for c in str(v))


def legend_from_xp(xp_total: int) -> dict[str, Any]:
    """شريط التقدّم نحو اللقب التالي من مجموع portal_xp_ledger فقط."""
    xp = max(0, int(xp_total or 0))
    current = LEGEND_TIERS[0]
    for tier in LEGEND_TIERS:
        if xp >= int(tier["min"]):
            current = tier
    nxt = int(current.get("next") or 0)
    floor = int(current.get("min") or 0)
    # إن تجاوز آخر عتبة ظاهرة نثبت الشريط ممتلئاً دون اختلاق لقب جديد
    if xp >= nxt and current is LEGEND_TIERS[-1]:
        pct = 100
        remain = 0
        next_title = current["title"]
    else:
        span = max(1, nxt - floor)
        pct = max(0, min(100, int(round(100.0 * (xp - floor) / span))))
        remain = max(0, nxt - xp)
        next_title = None
        for tier in LEGEND_TIERS:
            if int(tier["min"]) >= nxt:
                next_title = tier["title"]
                break
        if next_title is None:
            next_title = current["title"]
    return {
        "xp_total": xp,
        "xp_total_ar": _e(xp),
        "title": current["title"],
        "next_title": next_title,
        "next_xp": nxt,
        "next_xp_ar": _e(nxt),
        "remain_xp": remain,
        "remain_xp_ar": _e(remain),
        "progress_pct": pct,
        "tiers": list(LEGEND_TIERS),
    }


def build_rank_gap(
    peers: list[dict],
    student_nid: str,
    *,
    metric_key: str = "xp",
    min_participants: int = MIN_PARTICIPANTS,
) -> dict[str, Any]:
    """
    peers: قائمة مرتبة تنازلياً بالحقل metric_key، كل صف فيه national_id و metric.
    يُخفى الترتيب إن قلّ المشاركون عن الحد — تجنّباً للإحراج.
    """
    clean = [p for p in peers if p.get("national_id")]
    if len(clean) < max(1, int(min_participants or MIN_PARTICIPANTS)):
        return {
            "visible": False,
            "reason": "few_participants",
            "participants": len(clean),
            "participants_ar": _e(len(clean)),
            "min_participants": min_participants,
        }

    you = None
    for i, row in enumerate(clean):
        if str(row.get("national_id")) == str(student_nid):
            you = {**row, "rank": i + 1}
            break
    if you is None:
        return {
            "visible": False,
            "reason": "not_ranked",
            "participants": len(clean),
            "participants_ar": _e(len(clean)),
        }

    rank = int(you["rank"])
    your_metric = float(you.get(metric_key) or 0)
    ahead = clean[rank - 2] if rank >= 2 else None
    behind = clean[rank] if rank < len(clean) else None
    metrics = [float(p.get(metric_key) or 0) for p in clean]
    avg = round(sum(metrics) / max(1, len(metrics)), 1)

    gap_up = None
    rival_name = ""
    if ahead is not None:
        gap_up = max(0, round(float(ahead.get(metric_key) or 0) - your_metric, 1))
        rival_name = (ahead.get("name") or "").strip() or "زميل في الصدارة"

    return {
        "visible": True,
        "reason": "",
        "participants": len(clean),
        "participants_ar": _e(len(clean)),
        "rank": rank,
        "rank_ar": _e(rank),
        "metric_key": metric_key,
        "your_metric": your_metric,
        "your_metric_ar": _e(int(your_metric) if float(your_metric).is_integer() else your_metric),
        "avg_metric": avg,
        "avg_metric_ar": _e(avg),
        "gap_to_next": gap_up,
        "gap_to_next_ar": _e(int(gap_up)) if gap_up is not None and float(gap_up).is_integer() else (_e(gap_up) if gap_up is not None else ""),
        "rival_name": rival_name,
        "behind_name": ((behind or {}).get("name") or "").strip(),
        "message": (
            f"المركز {_e(rank)} · يفصلك {_e(int(gap_up) if gap_up is not None and float(gap_up).is_integer() else gap_up)} عن {rival_name}"
            if gap_up is not None and gap_up > 0
            else f"المركز {_e(rank)} · أنت في الصدارة بين {_e(len(clean))} مشاركين"
            if rank == 1
            else f"المركز {_e(rank)} من {_e(len(clean))}"
        ),
    }


def path_hint_from_streak(*, low_streak: int, game: str = "words", accuracy_pct: float | None = None) -> dict[str, str] | None:
    """
    إشارة مسار علاجي/إثرائي خفيفة عند تكرار التعثر — بلا اختلاق تشخيص.
    low_streak: عدد المحاولات الأخيرة الضعيفة المتتالية (محسوب من بيانات حقيقية).
    """
    weak = int(low_streak or 0) >= 2 or (accuracy_pct is not None and float(accuracy_pct) < 55)
    if not weak:
        return None
    g = (game or "").lower()
    if g.startswith("mental"):
        return {
            "kind": "clinic",
            "label": "عيادة الأرقام",
            "blurb": "لاحظنا تعثراً متكرراً — جرّب عيادة قصيرة ثم عُد للجولة.",
            "station": "modes",
        }
    if g in ("words", "word", "quran"):
        return {
            "kind": "traps",
            "label": "باب الأخطاء / الحقيبة الذهبية",
            "blurb": "ثبّت قاعدة واحدة من أبواب الأخطاء أو بطاقة ذهبية ثم أعد المحاولة.",
            "station": "traps",
        }
    return {
        "kind": "golden",
        "label": "الحقيبة الذهبية",
        "blurb": "بطاقة ذهبية واحدة قد تضيء خطوتك التالية.",
        "station": "golden",
    }


def fetch_xp_total(connection, student_nid: str) -> int:
    row = connection.execute(
        "SELECT COALESCE(SUM(xp),0) FROM portal_xp_ledger WHERE student_nid = ?",
        (student_nid,),
    ).fetchone()
    return int((row[0] if row else 0) or 0)


def fetch_week_challenge_peers(connection, period_start: str) -> list[dict]:
    """أقران لوحة الأسبوع من portal_challenge_runs — بيانات حقيقية فقط."""
    rows = connection.execute(
        """
        SELECT r.student_nid, COALESCE(s.name, ''),
               SUM(r.xp_earned) AS xp, AVG(r.score_pct) AS avg_score, COUNT(*) AS runs
        FROM portal_challenge_runs r
        LEFT JOIN noor_students s ON s.national_id = r.student_nid
        WHERE r.finished_at >= ? AND r.finished_at != ''
        GROUP BY r.student_nid
        ORDER BY xp DESC, avg_score DESC
        """,
        (period_start,),
    ).fetchall()
    out = []
    for row in rows:
        name = (row[1] or "").strip()
        short = name.split()[0] if name else "زميل"
        out.append(
            {
                "national_id": row[0],
                "name": short,
                "xp": int(row[2] or 0),
                "avg_score": round(float(row[3] or 0), 1),
                "runs": int(row[4] or 0),
            }
        )
    return out


def fetch_game_peers(connection, game: str) -> list[dict]:
    """ترتيب أقران ألعاب التأسيس حسب أفضل درجة محفوظة في portal_game_runs."""
    from .nafs_endround_progress import game_type_clause

    clause, params = game_type_clause(game)
    rows = connection.execute(
        f"""
        SELECT g.student_nid, COALESCE(s.name, ''), MAX(g.score) AS best, COUNT(*) AS runs
        FROM portal_game_runs g
        LEFT JOIN noor_students s ON s.national_id = g.student_nid
        WHERE {clause}
        GROUP BY g.student_nid
        ORDER BY best DESC, runs DESC
        """,
        params,
    ).fetchall()
    out = []
    for row in rows:
        name = (row[1] or "").strip()
        short = name.split()[0] if name else "زميل"
        out.append(
            {
                "national_id": row[0],
                "name": short,
                "score": int(row[2] or 0),
                "runs": int(row[3] or 0),
            }
        )
    return out


def count_recent_low_attempts(attempts_desc_or_asc: list[dict], *, threshold_pct: float = 55.0, window: int = 3) -> int:
    """عدد المحاولات الأخيرة تحت العتبة (من نهاية السلسلة التصاعدية)."""
    if not attempts_desc_or_asc:
        return 0
    tail = attempts_desc_or_asc[-window:]
    low = 0
    for a in reversed(tail):
        acc = a.get("accuracy_pct")
        if acc is None:
            total = int(a.get("total") or 0)
            score = int(a.get("score") or 0)
            if total > 0:
                acc = 100.0 * score / total
            else:
                break
        if float(acc) < threshold_pct:
            low += 1
        else:
            break
    return low


def build_endround_context(
    connection,
    *,
    student_nid: str,
    game: str,
    accuracy_pct: float | None = None,
    attempts_asc: list[dict] | None = None,
    period_start: str = "",
) -> dict[str, Any]:
    """حزمة المرحلة ٣ لبطاقة الختام."""
    xp = fetch_xp_total(connection, student_nid)
    legend = legend_from_xp(xp)

    game_peers = fetch_game_peers(connection, game)
    rank = build_rank_gap(game_peers, student_nid, metric_key="score")
    rank["source"] = "game_runs"
    if not rank.get("visible") and period_start:
        week_peers = fetch_week_challenge_peers(connection, period_start)
        week_rank = build_rank_gap(week_peers, student_nid, metric_key="xp")
        week_rank["source"] = "challenge_week"
        if week_rank.get("visible"):
            rank = week_rank

    low = count_recent_low_attempts(attempts_asc or [])
    hint = path_hint_from_streak(low_streak=low, game=game, accuracy_pct=accuracy_pct)

    return {
        "legend": legend,
        "rank": rank,
        "path_hint": hint,
    }
