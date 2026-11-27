# قياس رضا المستفيد — مسودة / لقطة معتمدة / Δ
# منفصل عن استبانة نافس الرسمية وعن مؤشرات الإتقان المعرفي. بلا اختلاق مفاتيح إجابة.
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect

router = APIRouter(tags=["beneficiary-satisfaction"])

EASTERN = "٠١٢٣٤٥٦٧٨٩"
SCHOOL_CODE = "40341"
LAYER = "beneficiary_satisfaction"
EVIDENCE_CODE = "1-3-1-3"
EVIDENCE_CODE_AR = "١-٣-١-٣"
STEM_SOURCE = "محاور قياس رضا المستفيد — مرجع التقويم والشواهد المدرسية (S-40341)"
FORM_TITLE = "قياس رضا المستفيد"

# مقياس ليكرت رباعي — بلا مفاتيح «صحيحة»
LIKERT_KEYS = ("أ", "ب", "ج", "د")
LIKERT_LABELS = ("موافق بشدة", "موافق", "إلى حد ما", "غير موافق")

AXES: tuple[dict[str, str], ...] = (
    {
        "id": "access",
        "title": "وضوح الخدمات وسهولة الوصول",
        "etec_hint": "1-3-1",
    },
    {
        "id": "quality",
        "title": "جودة المحتوى والتجربة التعليمية/التفاعلية",
        "etec_hint": "3-1-1",
    },
    {
        "id": "partnership",
        "title": "التواصل والشراكة والمتابعة",
        "etec_hint": "1-3-1-2",
    },
    {
        "id": "climate",
        "title": "البيئة المدرسية والمناخ الداعم",
        "etec_hint": "1-3-1",
    },
    {
        "id": "impact",
        "title": "الأثر العام والتحسين المستمر",
        "etec_hint": "1-3-1-3",
    },
)

DDL_DRAFT = """
CREATE TABLE IF NOT EXISTS portal_benef_sat_drafts (
    actor_type TEXT NOT NULL,
    actor_key TEXT NOT NULL,
    answers_json TEXT NOT NULL DEFAULT '{}',
    grade TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    student_nid TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (actor_type, actor_key)
)
"""

DDL_SNAPSHOT = """
CREATE TABLE IF NOT EXISTS portal_benef_sat_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_type TEXT NOT NULL,
    actor_key TEXT NOT NULL,
    round_key TEXT NOT NULL,
    answers_json TEXT NOT NULL DEFAULT '{}',
    grade TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    student_nid TEXT NOT NULL DEFAULT '',
    approved_at TEXT NOT NULL,
    UNIQUE(actor_type, actor_key, round_key)
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


def ensure_beneficiary_satisfaction(connection) -> None:
    connection.execute(DDL_DRAFT)
    connection.execute(DDL_SNAPSHOT)
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_benef_sat_round ON portal_benef_sat_snapshots(round_key)"
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_benef_sat_grade ON portal_benef_sat_snapshots(grade, section)"
    )


def ensure_on_boot(connection) -> None:
    ensure_beneficiary_satisfaction(connection)


def _item(
    n: int,
    *,
    axis_id: str,
    axis_title: str,
    stem: str,
    etec_hint: str,
) -> dict[str, Any]:
    return {
        "n": n,
        "n_ar": _e(n),
        "axis_id": axis_id,
        "axis_title": axis_title,
        "section": axis_title,
        "kind": "single",
        "multi": False,
        "choices": list(LIKERT_KEYS),
        "choice_labels": list(LIKERT_LABELS),
        "stem": stem,
        "stem_source": STEM_SOURCE,
        "etec_hint": etec_hint,
        "etec_hint_ar": _e(etec_hint),
        "sensitive_teacher": False,
        "nafs_questionnaire": False,
        "mastery_indicator": False,
    }


def beneficiary_items() -> list[dict[str, Any]]:
    """١٠ بنود على ٥ محاور معتمدة — ليست استبانة نافس."""
    stems = {
        "access": (
            "خدمات المدرسة وإجراءاتها واضحة ويمكنني الوصول إليها بسهولة.",
            "قنوات الاستفسار والمواعيد ميسّرة وتلبي احتياجي كمستفيد.",
        ),
        "quality": (
            "المحتوى والأنشطة التعليمية/التفاعلية ذات جودة مناسبة لمستوى المستفيد.",
            "تجربة التعلم أو المتابعة عبر القنوات المدرسية مريحة وواضحة.",
        ),
        "partnership": (
            "التواصل مع المدرسة منتظم ويشملني في المتابعة والشراكة.",
            "أتلقى تغذية راجعة مفيدة حول تقدم المستفيد أو احتياجاته.",
        ),
        "climate": (
            "البيئة المدرسية آمنة ومحفّزة وتدعم التعلم والسلوك الإيجابي.",
            "المناخ العام في المدرسة يحترم المستفيد ويعزز الثقة.",
        ),
        "impact": (
            "أشعر بأثر إيجابي ملموس من خدمات المدرسة وبرامجها.",
            "تسعى المدرسة لتحسين خدماتها بناءً على ملاحظات المستفيدين.",
        ),
    }
    out: list[dict[str, Any]] = []
    n = 1
    for axis in AXES:
        for stem in stems[axis["id"]]:
            out.append(
                _item(
                    n,
                    axis_id=axis["id"],
                    axis_title=axis["title"],
                    stem=stem,
                    etec_hint=axis["etec_hint"],
                )
            )
            n += 1
    return out


def form_pack() -> dict[str, Any]:
    items = beneficiary_items()
    by_axis: dict[str, list[dict[str, Any]]] = {}
    for it in items:
        by_axis.setdefault(it["axis_id"], []).append(it)
    return {
        "ok": True,
        "layer": LAYER,
        "title": FORM_TITLE,
        "school_code": SCHOOL_CODE,
        "school_code_ar": _e(SCHOOL_CODE),
        "evidence_code": EVIDENCE_CODE,
        "evidence_code_ar": EVIDENCE_CODE_AR,
        "stem_source": STEM_SOURCE,
        "stems_invented_as_nafs": False,
        "separated_from_nafs_questionnaire": True,
        "separated_from_mastery": True,
        "likert_keys": list(LIKERT_KEYS),
        "likert_labels": list(LIKERT_LABELS),
        "axes": [
            {
                **axis,
                "etec_hint_ar": _e(axis["etec_hint"]),
                "items": by_axis.get(axis["id"], []),
            }
            for axis in AXES
        ],
        "items": items,
        "count": len(items),
        "count_ar": _e(len(items)),
    }


def sanitize_answers(raw: Any, catalog: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    catalog = catalog or beneficiary_items()
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
        allowed = set(meta["choices"] or [])
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
        clean[str(n)] = {"kind": "single", "choices": picks[:1]}
    return clean


def save_draft(
    connection,
    *,
    actor_type: str,
    actor_key: str,
    answers: dict[str, Any],
    grade: str = "",
    section: str = "",
    student_nid: str = "",
) -> dict[str, Any]:
    ensure_beneficiary_satisfaction(connection)
    at = str(actor_type or "").strip()
    ak = str(actor_key or "").strip()
    if at not in ("parent", "student") or not ak:
        raise ValueError("مفتاح المستفيد غير صالح.")
    clean = sanitize_answers(answers)
    stamp = _iso()
    nid = "".join(ch for ch in str(student_nid or "") if ch.isdigit())
    connection.execute(
        """
        INSERT INTO portal_benef_sat_drafts(
          actor_type, actor_key, answers_json, grade, section, student_nid, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(actor_type, actor_key) DO UPDATE SET
          answers_json=excluded.answers_json,
          grade=CASE WHEN excluded.grade != '' THEN excluded.grade ELSE portal_benef_sat_drafts.grade END,
          section=CASE WHEN excluded.section != '' THEN excluded.section ELSE portal_benef_sat_drafts.section END,
          student_nid=CASE WHEN excluded.student_nid != '' THEN excluded.student_nid ELSE portal_benef_sat_drafts.student_nid END,
          updated_at=excluded.updated_at
        """,
        (at, ak, json.dumps(clean, ensure_ascii=False), grade or "", section or "", nid, stamp),
    )
    return {
        "ok": True,
        "layer": LAYER,
        "actor_type": at,
        "answers": clean,
        "updated_at": stamp,
        "updated_at_ar": _e(stamp.replace("T", " ").replace("Z", "")),
        "is_draft": True,
        "is_snapshot": False,
        "separated_from_nafs_questionnaire": True,
    }


def get_draft(connection, *, actor_type: str, actor_key: str) -> dict[str, Any]:
    ensure_beneficiary_satisfaction(connection)
    row = connection.execute(
        """
        SELECT answers_json, grade, section, student_nid, updated_at
        FROM portal_benef_sat_drafts
        WHERE actor_type=? AND actor_key=?
        """,
        (actor_type, actor_key),
    ).fetchone()
    if not row:
        return {
            "ok": True,
            "layer": LAYER,
            "answers": {},
            "grade": "",
            "section": "",
            "student_nid_tail": "",
            "updated_at": "",
            "is_draft": True,
            "is_snapshot": False,
            "empty": True,
        }
    answers = sanitize_answers(json.loads(row[0] or "{}"))
    nid = row[3] or ""
    return {
        "ok": True,
        "layer": LAYER,
        "answers": answers,
        "grade": row[1] or "",
        "section": row[2] or "",
        "student_nid_tail": nid[-3:] if nid else "",
        "updated_at": row[4] or "",
        "updated_at_ar": _e((row[4] or "").replace("T", " ").replace("Z", "")),
        "is_draft": True,
        "is_snapshot": False,
        "empty": not bool(answers),
    }


def approve_snapshot(
    connection,
    *,
    actor_type: str,
    actor_key: str,
    round_key: str = "",
    answers: dict[str, Any] | None = None,
    grade: str = "",
    section: str = "",
    student_nid: str = "",
) -> dict[str, Any]:
    ensure_beneficiary_satisfaction(connection)
    draft = get_draft(connection, actor_type=actor_type, actor_key=actor_key)
    payload = sanitize_answers(answers if answers is not None else draft.get("answers") or {})
    if not payload:
        raise ValueError("لا توجد استجابات لاعتمادها. احفظ مسودة قياس الرضا أولاً.")
    g = grade or draft.get("grade") or ""
    s = section or draft.get("section") or ""
    nid = "".join(ch for ch in str(student_nid or "") if ch.isdigit())
    stamp = _iso()
    rk = (round_key or "").strip() or stamp[:10]
    if not re.fullmatch(r"[A-Za-z0-9_.\-]+", rk):
        raise ValueError("معرّف الجولة غير صالح.")
    connection.execute(
        """
        INSERT INTO portal_benef_sat_snapshots(
          actor_type, actor_key, round_key, answers_json, grade, section, student_nid, approved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(actor_type, actor_key, round_key) DO UPDATE SET
          answers_json=excluded.answers_json,
          grade=excluded.grade,
          section=excluded.section,
          student_nid=excluded.student_nid,
          approved_at=excluded.approved_at
        """,
        (
            actor_type,
            actor_key,
            rk,
            json.dumps(payload, ensure_ascii=False),
            g,
            s,
            nid,
            stamp,
        ),
    )
    row = connection.execute(
        """
        SELECT id FROM portal_benef_sat_snapshots
        WHERE actor_type=? AND actor_key=? AND round_key=?
        """,
        (actor_type, actor_key, rk),
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
        "is_draft": False,
        "is_snapshot": True,
        "draft_preserved": True,
        "evidence_code": EVIDENCE_CODE,
        "evidence_code_ar": EVIDENCE_CODE_AR,
        "separated_from_nafs_questionnaire": True,
        "separated_from_mastery": True,
    }


def list_actor_snapshots(connection, *, actor_type: str, actor_key: str) -> dict[str, Any]:
    ensure_beneficiary_satisfaction(connection)
    rows = connection.execute(
        """
        SELECT id, round_key, grade, section, approved_at
        FROM portal_benef_sat_snapshots
        WHERE actor_type=? AND actor_key=?
        ORDER BY approved_at DESC, id DESC
        """,
        (actor_type, actor_key),
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
    ensure_beneficiary_satisfaction(connection)
    rows = connection.execute(
        "SELECT DISTINCT round_key FROM portal_benef_sat_snapshots ORDER BY round_key DESC"
    ).fetchall()
    return [r[0] for r in rows]


def _pct(part: int, whole: int) -> float:
    if whole <= 0:
        return 0.0
    return round(100.0 * part / whole, 1)


def build_aggregate(
    connection,
    round_a: str,
    round_b: str,
) -> dict[str, Any]:
    ensure_beneficiary_satisfaction(connection)
    catalog = beneficiary_items()
    if not round_a or not round_b:
        raise ValueError("يلزم تحديد جولتين للمقارنة.")

    def load(rk: str) -> list[dict[str, Any]]:
        rows = connection.execute(
            """
            SELECT answers_json, grade, section, actor_type
            FROM portal_benef_sat_snapshots
            WHERE round_key=?
            """,
            (rk,),
        ).fetchall()
        return [
            {
                "answers": sanitize_answers(json.loads(r[0] or "{}")),
                "grade": r[1] or "",
                "section": r[2] or "",
                "actor_type": r[3] or "",
            }
            for r in rows
        ]

    snaps_a = load(round_a)
    snaps_b = load(round_b)

    def group(snaps: list[dict[str, Any]]) -> dict[str, Any]:
        by_grade: dict[str, int] = defaultdict(int)
        by_section: dict[str, int] = defaultdict(int)
        by_actor: dict[str, int] = defaultdict(int)
        by_axis_score: dict[str, list[float]] = defaultdict(list)
        hits: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        # أوزان ليكرت للمتوسط المحوري (أ=٤ … د=١) — مؤشر رضا لا إتقان معرفي
        weight = {"أ": 4, "ب": 3, "ج": 2, "د": 1}
        for snap in snaps:
            g = snap["grade"] or "—"
            s = snap["section"] or "—"
            by_grade[g] += 1
            by_section[f"{g}::{s}"] += 1
            by_actor[snap["actor_type"] or "—"] += 1
            axis_vals: dict[str, list[int]] = defaultdict(list)
            for item in catalog:
                entry = snap["answers"].get(str(item["n"])) or {}
                choices = entry.get("choices") if isinstance(entry, dict) else []
                if not choices:
                    continue
                ch = str(choices[0])
                hits[str(item["n"])][ch] += 1
                if ch in weight:
                    axis_vals[item["axis_id"]].append(weight[ch])
            for axis_id, vals in axis_vals.items():
                if vals:
                    by_axis_score[axis_id].append(sum(vals) / len(vals))
        return {
            "respondents": len(snaps),
            "by_grade": dict(by_grade),
            "by_section": dict(by_section),
            "by_actor": dict(by_actor),
            "by_axis_score": {
                k: round(sum(v) / len(v), 2) if v else 0.0 for k, v in by_axis_score.items()
            },
            "hits": hits,
        }

    agg_a = group(snaps_a)
    agg_b = group(snaps_b)

    def map_ar(d: dict[str, Any]) -> list[dict[str, Any]]:
        rows = []
        for k, v in sorted(d.items(), key=lambda x: (-float(x[1]), str(x[0]))):
            rows.append({"key": k, "key_ar": _e(k), "count": v, "count_ar": _e(v)})
        return rows

    axes_out = []
    for axis in AXES:
        sa = float(agg_a["by_axis_score"].get(axis["id"], 0.0))
        sb = float(agg_b["by_axis_score"].get(axis["id"], 0.0))
        delta = round(sb - sa, 2)
        axes_out.append(
            {
                "id": axis["id"],
                "title": axis["title"],
                "etec_hint": axis["etec_hint"],
                "etec_hint_ar": _e(axis["etec_hint"]),
                "score_a": sa,
                "score_b": sb,
                "score_a_ar": _e(sa),
                "score_b_ar": _e(sb),
                "delta": delta,
                "delta_ar": _e(delta),
            }
        )

    items_out = []
    for item in catalog:
        n = str(item["n"])
        choices_out = []
        for i, ch in enumerate(item["choices"]):
            ca = int(agg_a["hits"].get(n, {}).get(ch, 0))
            cb = int(agg_b["hits"].get(n, {}).get(ch, 0))
            pa = _pct(ca, agg_a["respondents"])
            pb = _pct(cb, agg_b["respondents"])
            delta = round(pb - pa, 1)
            choices_out.append(
                {
                    "choice": ch,
                    "label": item["choice_labels"][i] if i < len(item["choice_labels"]) else ch,
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
        items_out.append(
            {
                "n": item["n"],
                "n_ar": item["n_ar"],
                "stem": item["stem"],
                "axis_id": item["axis_id"],
                "axis_title": item["axis_title"],
                "etec_hint": item["etec_hint"],
                "etec_hint_ar": item["etec_hint_ar"],
                "choices": choices_out,
            }
        )

    return {
        "ok": True,
        "layer": LAYER,
        "title": FORM_TITLE,
        "school_code": SCHOOL_CODE,
        "school_code_ar": _e(SCHOOL_CODE),
        "evidence_code": EVIDENCE_CODE,
        "evidence_code_ar": EVIDENCE_CODE_AR,
        "round_a": round_a,
        "round_b": round_b,
        "round_a_ar": _e(round_a),
        "round_b_ar": _e(round_b),
        "respondents_a": agg_a["respondents"],
        "respondents_b": agg_b["respondents"],
        "respondents_a_ar": _e(agg_a["respondents"]),
        "respondents_b_ar": _e(agg_b["respondents"]),
        "by_grade_a": map_ar(agg_a["by_grade"]),
        "by_grade_b": map_ar(agg_b["by_grade"]),
        "by_section_a": map_ar(agg_a["by_section"]),
        "by_section_b": map_ar(agg_b["by_section"]),
        "by_actor_a": map_ar(agg_a["by_actor"]),
        "by_actor_b": map_ar(agg_b["by_actor"]),
        "axes": axes_out,
        "items": items_out,
        "source": "approved_snapshots_only",
        "drafts_excluded": True,
        "nafs_questionnaire_excluded": True,
        "mastery_excluded": True,
        "students_listed": False,
    }


# ——— هوية المستفيد من الجلسة ———


def _actor_from_portal(session: dict) -> tuple[str, str, str, str, str]:
    """يعيد (actor_type, actor_key, grade, section, student_nid)."""
    atype = str(session.get("actor_type") or "")
    payload = session.get("payload") or {}
    if atype == "student":
        nid = str(session.get("student_nid") or "")
        return (
            "student",
            nid,
            str(payload.get("grade") or ""),
            str(payload.get("section") or ""),
            nid,
        )
    if atype == "parent":
        phone = str(payload.get("phone_norm") or session.get("actor_key") or "")
        kids = payload.get("children") or []
        grade = ""
        section = ""
        snid = ""
        if kids:
            grade = str(kids[0].get("grade") or "")
            section = str(kids[0].get("section") or kids[0].get("classroom") or "")
            snid = str(kids[0].get("national_id") or "")
        return ("parent", phone, grade, section, snid)
    raise HTTPException(status_code=403, detail="هذه الخدمة للمستفيد (ولي أمر / طالب) فقط.")


class DraftBody(BaseModel):
    answers: dict[str, Any] = Field(default_factory=dict)
    grade: str = ""
    section: str = ""
    student_nid: str = ""


class SnapshotBody(BaseModel):
    answers: dict[str, Any] | None = None
    round_key: str = ""
    grade: str = ""
    section: str = ""
    student_nid: str = ""


def _require_benef(token: str) -> dict:
    from .portal_session_api import _require_portal

    return _require_portal(token, ("student", "parent"))


@router.get("/api/portal/beneficiary-satisfaction/form")
def api_form(x_portal_token: str = Header(default="")):
    _require_benef(x_portal_token)
    return form_pack()


@router.get("/api/portal/beneficiary-satisfaction/draft")
def api_get_draft(x_portal_token: str = Header(default="")):
    session = _require_benef(x_portal_token)
    at, ak, _g, _s, _nid = _actor_from_portal(session)
    connection = connect()
    try:
        return get_draft(connection, actor_type=at, actor_key=ak)
    finally:
        connection.close()


@router.put("/api/portal/beneficiary-satisfaction/draft")
def api_put_draft(body: DraftBody, x_portal_token: str = Header(default="")):
    session = _require_benef(x_portal_token)
    at, ak, g0, s0, nid0 = _actor_from_portal(session)
    connection = connect()
    try:
        result = save_draft(
            connection,
            actor_type=at,
            actor_key=ak,
            answers=body.answers,
            grade=body.grade or g0,
            section=body.section or s0,
            student_nid=body.student_nid or nid0,
        )
        connection.commit()
        return result
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    finally:
        connection.close()


@router.post("/api/portal/beneficiary-satisfaction/snapshot")
def api_post_snapshot(body: SnapshotBody, x_portal_token: str = Header(default="")):
    session = _require_benef(x_portal_token)
    at, ak, g0, s0, nid0 = _actor_from_portal(session)
    connection = connect()
    try:
        result = approve_snapshot(
            connection,
            actor_type=at,
            actor_key=ak,
            round_key=body.round_key,
            answers=body.answers,
            grade=body.grade or g0,
            section=body.section or s0,
            student_nid=body.student_nid or nid0,
        )
        connection.commit()
        return result
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    finally:
        connection.close()


@router.get("/api/portal/beneficiary-satisfaction/snapshots")
def api_list_snapshots(x_portal_token: str = Header(default="")):
    session = _require_benef(x_portal_token)
    at, ak, _g, _s, _nid = _actor_from_portal(session)
    connection = connect()
    try:
        return list_actor_snapshots(connection, actor_type=at, actor_key=ak)
    finally:
        connection.close()


@router.get("/api/portal/owner/beneficiary-satisfaction")
def api_owner_stats(
    round_a: str = "",
    round_b: str = "",
    x_session_token: str = Header(default=""),
):
    from .portal_owner_api import _require_level

    _require_level(x_session_token, 1)
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
                    "message": "لا توجد لقطات معتمدة لقياس رضا المستفيد بعد.",
                    "rounds": [],
                }
        pack = build_aggregate(connection, ra, rb)
        pack["rounds_available"] = [{"key": r, "key_ar": _e(r)} for r in rounds]
        return pack
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    finally:
        connection.close()
