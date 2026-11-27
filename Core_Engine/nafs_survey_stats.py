# موجة التقرير الإحصائي للاستبانة: مسودة طالب قابلة للتعديل + لقطات معتمدة + تجميع/Δ
# طبقة الاستبانة فقط (q:*) — بلا خلط بتدريب تظليل الإجابات أو اختلاق stems/مفاتيح.
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect

router = APIRouter(tags=["nafs-survey-stats"])

EASTERN = "٠١٢٣٤٥٦٧٨٩"
SCHOOL_CODE = "40341"
LAYER = "questionnaire"  # ثابت: لا ترصد ans/nid/scode/sec

DDL_DRAFT = """
CREATE TABLE IF NOT EXISTS portal_survey_drafts (
    student_nid TEXT PRIMARY KEY,
    answers_json TEXT NOT NULL DEFAULT '{}',
    grade TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
)
"""

DDL_SNAPSHOT = """
CREATE TABLE IF NOT EXISTS portal_survey_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    round_key TEXT NOT NULL,
    answers_json TEXT NOT NULL DEFAULT '{}',
    grade TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    approved_at TEXT NOT NULL,
    UNIQUE(student_nid, round_key)
)
"""


def _e(value: Any) -> str:
    out = []
    for c in str(value if value is not None else ""):
        if c.isdigit():
            out.append(EASTERN[int(c)])
        elif c == "%":
            out.append("٪")
        else:
            out.append(c)
    return "".join(out)


def _iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_survey_stats(connection) -> None:
    connection.execute(DDL_DRAFT)
    connection.execute(DDL_SNAPSHOT)
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_survey_snap_round ON portal_survey_snapshots(round_key)"
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_survey_snap_grade ON portal_survey_snapshots(grade, section)"
    )


def ensure_on_boot(connection) -> None:
    ensure_survey_stats(connection)


def _item_catalog() -> list[dict[str, Any]]:
    from .nafs_wave_c_answer_sheet import questionnaire_items

    items = questionnaire_items()
    out = []
    for it in items:
        stem = str(it.get("stem") or "")
        sensitive = "معلم" in stem
        out.append(
            {
                "n": int(it["n"]),
                "n_ar": it.get("n_ar") or _e(it["n"]),
                "stem": stem,
                "section": it.get("section") or "",
                "page": it.get("page") or "",
                "kind": it.get("kind") or "single",
                "multi": bool(it.get("multi")),
                "choices": list(it.get("choices") or []),
                "choice_labels": list(it.get("choice_labels") or []),
                "sensitive_teacher": sensitive,
                "matrix": it.get("matrix"),
            }
        )
    return out


def sanitize_survey_answers(raw: Any, catalog: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """يقبل إجابات طبقة الاستبانة فقط — يرفض مفاتيح ans/nid/scode/sec وأي اختلاق لبنود غير رسمية."""
    catalog = catalog or _item_catalog()
    by_n = {int(it["n"]): it for it in catalog}
    if not isinstance(raw, dict):
        return {}
    clean: dict[str, Any] = {}
    for key, val in raw.items():
        try:
            n = int(str(key).strip())
        except (TypeError, ValueError):
            continue
        meta = by_n.get(n)
        if not meta:
            continue
        kind = meta["kind"]
        allowed = set(meta["choices"] or [])
        if kind == "matrix":
            rows_in = {}
            src = val.get("rows") if isinstance(val, dict) else None
            if not isinstance(src, dict):
                continue
            row_ids = {str(r.get("i")) for r in ((meta.get("matrix") or {}).get("rows") or [])}
            for rk, rv in src.items():
                rs = str(rk).replace("r", "")
                if rs not in row_ids:
                    continue
                choice = str(rv or "").strip()
                if choice in allowed:
                    rows_in[rs] = choice
            if rows_in:
                clean[str(n)] = {"kind": "matrix", "rows": rows_in}
            continue
        choices_raw = val.get("choices") if isinstance(val, dict) else val
        if isinstance(choices_raw, str):
            choices_raw = [choices_raw]
        if not isinstance(choices_raw, list):
            continue
        picks = []
        for c in choices_raw:
            cs = str(c or "").strip()
            if cs in allowed and cs not in picks:
                picks.append(cs)
        if not picks:
            continue
        if kind != "multi" and not meta["multi"]:
            picks = picks[:1]
        clean[str(n)] = {"kind": "multi" if meta["multi"] or kind == "multi" else "single", "choices": picks}
    return clean


def save_draft(
    connection,
    student_nid: str,
    answers: dict[str, Any],
    *,
    grade: str = "",
    section: str = "",
) -> dict[str, Any]:
    ensure_survey_stats(connection)
    nid = "".join(ch for ch in str(student_nid or "") if ch.isdigit())
    if not nid:
        raise ValueError("رقم هوية الطالب مطلوب.")
    clean = sanitize_survey_answers(answers)
    stamp = _iso()
    connection.execute(
        """
        INSERT INTO portal_survey_drafts(student_nid, answers_json, grade, section, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(student_nid) DO UPDATE SET
          answers_json=excluded.answers_json,
          grade=CASE WHEN excluded.grade != '' THEN excluded.grade ELSE portal_survey_drafts.grade END,
          section=CASE WHEN excluded.section != '' THEN excluded.section ELSE portal_survey_drafts.section END,
          updated_at=excluded.updated_at
        """,
        (nid, json.dumps(clean, ensure_ascii=False), grade or "", section or "", stamp),
    )
    return {
        "ok": True,
        "layer": LAYER,
        "student_nid_tail": nid[-3:],
        "answers": clean,
        "updated_at": stamp,
        "updated_at_ar": _e(stamp.replace("T", " ").replace("Z", "")),
        "is_draft": True,
        "is_snapshot": False,
    }


def get_draft(connection, student_nid: str) -> dict[str, Any]:
    ensure_survey_stats(connection)
    nid = "".join(ch for ch in str(student_nid or "") if ch.isdigit())
    row = connection.execute(
        "SELECT answers_json, grade, section, updated_at FROM portal_survey_drafts WHERE student_nid=?",
        (nid,),
    ).fetchone()
    if not row:
        return {
            "ok": True,
            "layer": LAYER,
            "answers": {},
            "grade": "",
            "section": "",
            "updated_at": "",
            "is_draft": True,
            "is_snapshot": False,
            "empty": True,
        }
    answers = sanitize_survey_answers(json.loads(row[0] or "{}"))
    return {
        "ok": True,
        "layer": LAYER,
        "answers": answers,
        "grade": row[1] or "",
        "section": row[2] or "",
        "updated_at": row[3] or "",
        "updated_at_ar": _e((row[3] or "").replace("T", " ").replace("Z", "")),
        "is_draft": True,
        "is_snapshot": False,
        "empty": not bool(answers),
    }


def approve_snapshot(
    connection,
    student_nid: str,
    *,
    round_key: str = "",
    answers: dict[str, Any] | None = None,
    grade: str = "",
    section: str = "",
) -> dict[str, Any]:
    """تجميد لقطة معتمدة من الإجابات الممرَّرة أو من المسودة — لا تُفرَّغ المسودة."""
    ensure_survey_stats(connection)
    nid = "".join(ch for ch in str(student_nid or "") if ch.isdigit())
    if not nid:
        raise ValueError("رقم هوية الطالب مطلوب.")
    draft = get_draft(connection, nid)
    payload = sanitize_survey_answers(answers if answers is not None else draft.get("answers") or {})
    if not payload:
        raise ValueError("لا توجد استجابات استبانة لاعتمادها. احفظ المسودة أولاً (طبقة الاستبانة فقط).")
    g = grade or draft.get("grade") or ""
    s = section or draft.get("section") or ""
    stamp = _iso()
    rk = (round_key or "").strip() or stamp[:10]
    if not re.fullmatch(r"[A-Za-z0-9_.\-]+", rk):
        raise ValueError("معرّف الجولة غير صالح.")
    connection.execute(
        """
        INSERT INTO portal_survey_snapshots(
          student_nid, round_key, answers_json, grade, section, approved_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(student_nid, round_key) DO UPDATE SET
          answers_json=excluded.answers_json,
          grade=excluded.grade,
          section=excluded.section,
          approved_at=excluded.approved_at
        """,
        (nid, rk, json.dumps(payload, ensure_ascii=False), g, s, stamp),
    )
    row = connection.execute(
        "SELECT id FROM portal_survey_snapshots WHERE student_nid=? AND round_key=?",
        (nid, rk),
    ).fetchone()
    return {
        "ok": True,
        "layer": LAYER,
        "snapshot_id": int(row[0]) if row else 0,
        "round_key": rk,
        "round_key_ar": _e(rk),
        "approved_at": stamp,
        "approved_at_ar": _e(stamp.replace("T", " ").replace("Z", "")),
        "answers": payload,
        "grade": g,
        "section": s,
        "is_draft": False,
        "is_snapshot": True,
        "draft_preserved": True,
    }


def list_student_snapshots(connection, student_nid: str) -> dict[str, Any]:
    ensure_survey_stats(connection)
    nid = "".join(ch for ch in str(student_nid or "") if ch.isdigit())
    rows = connection.execute(
        """
        SELECT id, round_key, grade, section, approved_at
        FROM portal_survey_snapshots
        WHERE student_nid=?
        ORDER BY approved_at DESC, id DESC
        """,
        (nid,),
    ).fetchall()
    items = [
        {
            "id": int(r[0]),
            "id_ar": _e(r[0]),
            "round_key": r[1],
            "round_key_ar": _e(r[1]),
            "grade": r[2] or "",
            "section": r[3] or "",
            "approved_at": r[4],
            "approved_at_ar": _e((r[4] or "").replace("T", " ").replace("Z", "")),
            "is_snapshot": True,
            "is_draft": False,
        }
        for r in rows
    ]
    return {"ok": True, "layer": LAYER, "count": len(items), "count_ar": _e(len(items)), "snapshots": items}


def list_rounds(connection) -> list[str]:
    ensure_survey_stats(connection)
    rows = connection.execute(
        "SELECT DISTINCT round_key FROM portal_survey_snapshots ORDER BY round_key DESC"
    ).fetchall()
    return [r[0] for r in rows]


def _flatten_choice_hits(answers: dict[str, Any], item: dict[str, Any]) -> list[tuple[str, str]]:
    """يعيد قائمة (slot, choice) للعدّ. matrix → slot=r{i}."""
    n = str(item["n"])
    entry = answers.get(n)
    if not entry:
        return []
    if item["kind"] == "matrix":
        rows = entry.get("rows") if isinstance(entry, dict) else {}
        if not isinstance(rows, dict):
            return []
        return [(f"r{rk}", str(rv)) for rk, rv in rows.items() if rv]
    choices = entry.get("choices") if isinstance(entry, dict) else []
    if not isinstance(choices, list):
        return []
    return [("main", str(c)) for c in choices if c]


def _load_round_snapshots(connection, round_key: str) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT student_nid, answers_json, grade, section, approved_at, id
        FROM portal_survey_snapshots
        WHERE round_key=?
        """,
        (round_key,),
    ).fetchall()
    out = []
    for r in rows:
        out.append(
            {
                "student_nid": r[0],
                "answers": sanitize_survey_answers(json.loads(r[1] or "{}")),
                "grade": r[2] or "",
                "section": r[3] or "",
                "approved_at": r[4],
                "id": int(r[5]),
            }
        )
    return out


def _pct(part: int, whole: int) -> float:
    if whole <= 0:
        return 0.0
    return round(100.0 * part / whole, 1)


def build_aggregate(
    connection,
    round_a: str,
    round_b: str,
    *,
    include_teacher_sensitive: bool = True,
) -> dict[str, Any]:
    """تجميع عنصر/فصل/صف + Δ بين جولتين — من اللقطات المعتمدة فقط."""
    ensure_survey_stats(connection)
    catalog = _item_catalog()
    if not round_a or not round_b:
        raise ValueError("يلزم تحديد جولتين للمقارنة.")
    snaps_a = _load_round_snapshots(connection, round_a)
    snaps_b = _load_round_snapshots(connection, round_b)

    def group_counts(snaps: list[dict[str, Any]]) -> dict[str, Any]:
        by_grade: dict[str, int] = defaultdict(int)
        by_section: dict[str, int] = defaultdict(int)
        # item_n -> slot -> choice -> count
        hits: dict[str, dict[str, dict[str, int]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        respondents = len(snaps)
        for snap in snaps:
            g = snap["grade"] or "—"
            s = snap["section"] or "—"
            by_grade[g] += 1
            by_section[f"{g}::{s}"] += 1
            for item in catalog:
                for slot, choice in _flatten_choice_hits(snap["answers"], item):
                    hits[str(item["n"])][slot][choice] += 1
        return {
            "respondents": respondents,
            "by_grade": dict(by_grade),
            "by_section": dict(by_section),
            "hits": hits,
        }

    agg_a = group_counts(snaps_a)
    agg_b = group_counts(snaps_b)

    items_out = []
    for item in catalog:
        if item["sensitive_teacher"] and not include_teacher_sensitive:
            continue
        n = str(item["n"])
        slots = sorted(set(list(agg_a["hits"].get(n, {})) + list(agg_b["hits"].get(n, {}))) or {"main"})
        slot_rows = []
        for slot in slots:
            choice_keys = list(item["choices"] or [])
            labels = item.get("choice_labels") or []
            label_map = {choice_keys[i]: labels[i] if i < len(labels) else choice_keys[i] for i in range(len(choice_keys))}
            for extra in set(list(agg_a["hits"].get(n, {}).get(slot, {})) + list(agg_b["hits"].get(n, {}).get(slot, {}))):
                if extra not in choice_keys:
                    choice_keys.append(extra)
                    label_map[extra] = extra
            choices_out = []
            for ch in choice_keys:
                ca = int(agg_a["hits"].get(n, {}).get(slot, {}).get(ch, 0))
                cb = int(agg_b["hits"].get(n, {}).get(slot, {}).get(ch, 0))
                pa = _pct(ca, agg_a["respondents"])
                pb = _pct(cb, agg_b["respondents"])
                delta = round(pb - pa, 1)
                choices_out.append(
                    {
                        "choice": ch,
                        "label": label_map.get(ch, ch),
                        "count_a": ca,
                        "count_b": cb,
                        "count_a_ar": _e(ca),
                        "count_b_ar": _e(cb),
                        "pct_a": pa,
                        "pct_b": pb,
                        "pct_a_ar": _e(pa),
                        "pct_b_ar": _e(pb),
                        "delta_pp": delta,
                        "delta_pp_ar": _e(delta),
                    }
                )
            slot_rows.append({"slot": slot, "slot_ar": _e(slot.replace("r", "")), "choices": choices_out})
        items_out.append(
            {
                "n": item["n"],
                "n_ar": item["n_ar"],
                "stem": item["stem"],
                "section": item["section"],
                "page": item["page"],
                "kind": item["kind"],
                "sensitive_teacher": item["sensitive_teacher"],
                "slots": slot_rows,
            }
        )

    def map_ar(d: dict[str, int]) -> list[dict[str, Any]]:
        rows = []
        for k, v in sorted(d.items(), key=lambda x: (-x[1], x[0])):
            rows.append({"key": k, "key_ar": _e(k), "count": v, "count_ar": _e(v)})
        return rows

    return {
        "ok": True,
        "layer": LAYER,
        "school_code": SCHOOL_CODE,
        "school_code_ar": _e(SCHOOL_CODE),
        "etec_axis": "1-3-1",
        "etec_axis_ar": _e("1-3-1"),
        "round_a": round_a,
        "round_b": round_b,
        "round_a_ar": _e(round_a),
        "round_b_ar": _e(round_b),
        "respondents_a": agg_a["respondents"],
        "respondents_b": agg_b["respondents"],
        "respondents_a_ar": _e(agg_a["respondents"]),
        "respondents_b_ar": _e(agg_b["respondents"]),
        "include_teacher_sensitive": include_teacher_sensitive,
        "by_grade_a": map_ar(agg_a["by_grade"]),
        "by_grade_b": map_ar(agg_b["by_grade"]),
        "by_section_a": map_ar(agg_a["by_section"]),
        "by_section_b": map_ar(agg_b["by_section"]),
        "items": items_out,
        "source": "approved_snapshots_only",
        "drafts_excluded": True,
        "shading_training_excluded": True,
    }


# ——— API ———


class DraftBody(BaseModel):
    answers: dict[str, Any] = Field(default_factory=dict)
    grade: str = ""
    section: str = ""


class SnapshotBody(BaseModel):
    answers: dict[str, Any] | None = None
    round_key: str = ""
    grade: str = ""
    section: str = ""


def _require_student(token: str) -> dict:
    from .portal_session_api import _require_portal

    return _require_portal(token, ("student",))


@router.get("/api/portal/survey/catalog")
def api_survey_catalog(x_portal_token: str = Header(default="")):
    _require_student(x_portal_token)
    items = _item_catalog()
    return {
        "ok": True,
        "layer": LAYER,
        "count": len(items),
        "count_ar": _e(len(items)),
        "items": items,
        "stems_invented": False,
    }


@router.get("/api/portal/survey/draft")
def api_get_draft(x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        return get_draft(connection, session["student_nid"])
    finally:
        connection.close()


@router.put("/api/portal/survey/draft")
def api_put_draft(body: DraftBody, x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    payload = session.get("payload") or {}
    connection = connect()
    try:
        result = save_draft(
            connection,
            session["student_nid"],
            body.answers,
            grade=body.grade or str(payload.get("grade") or ""),
            section=body.section or str(payload.get("section") or ""),
        )
        connection.commit()
        return result
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    finally:
        connection.close()


@router.post("/api/portal/survey/snapshot")
def api_post_snapshot(body: SnapshotBody, x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    payload = session.get("payload") or {}
    connection = connect()
    try:
        result = approve_snapshot(
            connection,
            session["student_nid"],
            round_key=body.round_key,
            answers=body.answers,
            grade=body.grade or str(payload.get("grade") or ""),
            section=body.section or str(payload.get("section") or ""),
        )
        connection.commit()
        return result
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    finally:
        connection.close()


@router.get("/api/portal/survey/snapshots")
def api_list_snapshots(x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        return list_student_snapshots(connection, session["student_nid"])
    finally:
        connection.close()


@router.get("/api/portal/owner/survey-stats/rounds")
def api_owner_rounds(x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level

    _require_level(x_session_token, 1)
    connection = connect()
    try:
        rounds = list_rounds(connection)
        return {
            "ok": True,
            "layer": LAYER,
            "count": len(rounds),
            "count_ar": _e(len(rounds)),
            "rounds": [{"key": r, "key_ar": _e(r)} for r in rounds],
        }
    finally:
        connection.close()


@router.get("/api/portal/owner/survey-stats")
def api_owner_survey_stats(
    round_a: str = "",
    round_b: str = "",
    include_teacher_sensitive: bool = True,
    x_session_token: str = Header(default=""),
):
    from .portal_owner_api import _require_level

    user, level = _require_level(x_session_token, 1)
    # المستوى ٠–١ فقط يرون بنود المعلمين الحساسة مجمّعة؛ غير ذلك تُحجب حتى لو طُلبت
    allow_sensitive = include_teacher_sensitive and level <= 1
    connection = connect()
    try:
        rounds = list_rounds(connection)
        ra = (round_a or "").strip()
        rb = (round_b or "").strip()
        if not ra or not rb:
            if len(rounds) >= 2:
                ra = ra or rounds[0]
                rb = rb or rounds[1]
            elif len(rounds) == 1:
                ra = ra or rounds[0]
                rb = rb or rounds[0]
            else:
                return {
                    "ok": True,
                    "layer": LAYER,
                    "empty": True,
                    "message": "لا توجد لقطات معتمدة بعد.",
                    "rounds": [],
                }
        pack = build_aggregate(
            connection,
            ra,
            rb,
            include_teacher_sensitive=allow_sensitive,
        )
        pack["viewer_level"] = level
        pack["viewer_level_ar"] = _e(level)
        pack["rounds_available"] = [{"key": r, "key_ar": _e(r)} for r in rounds]
        # لا تُرجع أرقام هوية طلاب في التقرير التجميعي
        pack["students_listed"] = False
        return pack
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    finally:
        connection.close()
