# محرك التكيّف: منع التكرار + Error Vault + تصفية أخطاء + مؤشر إتقان + اختبار منزلي.
from __future__ import annotations

import json
import random
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect

router = APIRouter(tags=["nafs-adaptive"])

EASTERN = "٠١٢٣٤٥٦٧٨٩"
ETEC = {
    "reading": {"code": "3-1-1-1", "code_ar": "٣-١-١-١", "label": "القراءة"},
    "math": {"code": "3-1-1-2", "code_ar": "٣-١-١-٢", "label": "الرياضيات"},
    "science": {"code": "3-1-1-3", "code_ar": "٣-١-١-٣", "label": "العلوم"},
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS student_question_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    passage_id TEXT NOT NULL DEFAULT '',
    domain TEXT NOT NULL DEFAULT '',
    skill TEXT NOT NULL DEFAULT '',
    seen_at TEXT NOT NULL,
    outcome TEXT NOT NULL DEFAULT '', -- correct | wrong | seen
    mode TEXT NOT NULL DEFAULT '',
    UNIQUE(student_nid, question_id, seen_at)
);
CREATE INDEX IF NOT EXISTS ix_sqh_student ON student_question_history(student_nid, question_id);
CREATE INDEX IF NOT EXISTS ix_sqh_outcome ON student_question_history(student_nid, outcome, domain);

CREATE TABLE IF NOT EXISTS student_error_vault (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    question_id INTEGER NOT NULL DEFAULT 0,
    domain TEXT NOT NULL DEFAULT '',
    skill TEXT NOT NULL DEFAULT '',
    stem TEXT NOT NULL DEFAULT '',
    chosen TEXT NOT NULL DEFAULT '',
    correct TEXT NOT NULL DEFAULT '',
    wrong_example TEXT NOT NULL DEFAULT '',
    correct_example TEXT NOT NULL DEFAULT '',
    common_mistake TEXT NOT NULL DEFAULT '',
    golden_rule TEXT NOT NULL DEFAULT '',
    trap_heat INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'open', -- open | recovering | recovered
    streak_ok INTEGER NOT NULL DEFAULT 0,
    last_seen TEXT NOT NULL,
    recovered_at TEXT NOT NULL DEFAULT '',
    UNIQUE(student_nid, question_id, skill)
);
CREATE INDEX IF NOT EXISTS ix_sev_open ON student_error_vault(student_nid, status, trap_heat);

CREATE TABLE IF NOT EXISTS student_mastery_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    domain TEXT NOT NULL,
    mastery_pct REAL NOT NULL DEFAULT 0,
    recovery_rate REAL NOT NULL DEFAULT 0,
    stability REAL NOT NULL DEFAULT 0,
    detail_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_home_mock_packs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    parent_phone TEXT NOT NULL DEFAULT '',
    pack_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    acknowledged_at TEXT NOT NULL DEFAULT '',
    parent_name TEXT NOT NULL DEFAULT ''
);
"""


def _iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _e(value: Any) -> str:
    return "".join(EASTERN[int(c)] if c.isdigit() else ("٪" if c == "%" else c) for c in str(value))


def ensure_on_boot(connection) -> dict:
    connection.executescript(SCHEMA)
    cols = {r[1] for r in connection.execute("PRAGMA table_info(student_error_vault)").fetchall()}
    if "grade_root" not in cols:
        connection.execute(
            "ALTER TABLE student_error_vault ADD COLUMN grade_root TEXT NOT NULL DEFAULT ''"
        )
    return {"ok": True, "engine": "adaptive-v1"}


def record_question_seen(
    connection,
    student_nid: str,
    question: dict,
    mode: str = "",
    outcome: str = "seen",
) -> None:
    ensure_on_boot(connection)
    qid = int(question.get("id") or 0)
    if qid <= 0:
        return
    connection.execute(
        """
        INSERT INTO student_question_history(
          student_nid, question_id, passage_id, domain, skill, seen_at, outcome, mode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            student_nid,
            qid,
            str(question.get("passage_id") or ""),
            str(question.get("domain") or ""),
            str(question.get("skill") or ""),
            _iso(),
            outcome,
            mode or "",
        ),
    )


def upsert_error_vault(
    connection,
    student_nid: str,
    question: dict,
    chosen: str,
    correct: str,
    ok: bool,
) -> None:
    ensure_on_boot(connection)
    qid = int(question.get("id") or 0)
    skill = str(question.get("skill") or "") or str(question.get("domain") or "عام")
    domain = str(question.get("domain") or "")
    row = connection.execute(
        """
        SELECT id, trap_heat, status, streak_ok FROM student_error_vault
        WHERE student_nid = ? AND question_id = ? AND skill = ?
        """,
        (student_nid, qid, skill),
    ).fetchone()
    if ok:
        if not row:
            return
        streak = int(row[3] or 0) + 1
        if streak >= 2:
            connection.execute(
                """
                UPDATE student_error_vault
                SET status='recovered', streak_ok=?, trap_heat=CASE WHEN trap_heat>2 THEN trap_heat-2 ELSE 0 END,
                    recovered_at=?, last_seen=?
                WHERE id=?
                """,
                (streak, _iso(), _iso(), row[0]),
            )
        else:
            connection.execute(
                """
                UPDATE student_error_vault
                SET status='recovering', streak_ok=?, trap_heat=CASE WHEN trap_heat>1 THEN trap_heat-1 ELSE 0 END, last_seen=?
                WHERE id=?
                """,
                (streak, _iso(), row[0]),
            )
        return

    mistake = str(question.get("common_mistake") or "")
    rule = str(question.get("golden_rule") or "")
    root = str(question.get("grade_root") or "")
    wrong_ex = str(question.get("wrong_example") or question.get("stem") or "")[:240]
    correct_ex = str(question.get("correct_example") or rule or "")[:240]
    if row:
        connection.execute(
            """
            UPDATE student_error_vault
            SET trap_heat=trap_heat+1, status='open', streak_ok=0, chosen=?, correct=?,
                last_seen=?, common_mistake=?, golden_rule=?, grade_root=COALESCE(NULLIF(?, ''), grade_root)
            WHERE id=?
            """,
            (chosen, correct, _iso(), mistake, rule, root, row[0]),
        )
    else:
        connection.execute(
            """
            INSERT INTO student_error_vault(
              student_nid, question_id, domain, skill, stem, chosen, correct,
              wrong_example, correct_example, common_mistake, golden_rule,
              trap_heat, status, streak_ok, last_seen, grade_root
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'open', 0, ?, ?)
            """,
            (
                student_nid,
                qid,
                domain,
                skill,
                str(question.get("stem") or "")[:400],
                chosen,
                correct,
                wrong_ex,
                correct_ex,
                mistake,
                rule,
                _iso(),
                root,
            ),
        )


def mastered_question_ids(connection, student_nid: str) -> set[int]:
    rows = connection.execute(
        """
        SELECT question_id,
               SUM(CASE WHEN outcome='correct' THEN 1 ELSE 0 END) AS ok_n,
               SUM(CASE WHEN outcome='wrong' THEN 1 ELSE 0 END) AS bad_n
        FROM student_question_history
        WHERE student_nid = ? AND question_id > 0
        GROUP BY question_id
        HAVING ok_n >= 2 AND bad_n = 0
        """,
        (student_nid,),
    ).fetchall()
    return {int(r[0]) for r in rows}


def recent_wrong_ids(connection, student_nid: str, limit: int = 40) -> list[int]:
    rows = connection.execute(
        """
        SELECT question_id FROM student_error_vault
        WHERE student_nid = ? AND status IN ('open','recovering') AND question_id > 0
        ORDER BY trap_heat DESC, last_seen DESC LIMIT ?
        """,
        (student_nid, limit),
    ).fetchall()
    return [int(r[0]) for r in rows]


def smart_pick_questions(
    connection,
    student_nid: str,
    mode: str,
    domain: str,
    count: int,
    base_picker,
) -> list[dict]:
    """يلفّ على picker الأساسي مع استبعاد المتقن وإعادة جدولة الخاطئ وتجميع نصوص القراءة."""
    ensure_on_boot(connection)
    mastered = mastered_question_ids(connection, student_nid)
    wrongs = set(recent_wrong_ids(connection, student_nid))

    if mode == "purge":
        return pick_purge_questions(connection, student_nid, count)

    # اجلب ضعفي العدد ثم صفِّ
    pool = base_picker(connection, mode if mode != "purge" else "daily", domain, max(count * 3, count + 8))
    preferred: list[dict] = []
    fresh: list[dict] = []
    passages: dict[str, list[dict]] = defaultdict(list)

    for q in pool:
        qid = int(q.get("id") or 0)
        if qid in mastered and qid not in wrongs:
            continue
        pid = str(q.get("passage_id") or "")
        if pid:
            passages[pid].append(q)
            continue
        if qid in wrongs:
            preferred.append(q)
        else:
            fresh.append(q)

    out: list[dict] = []
    # أسئلة خاطئة أولاً (حتى ثلث الجولة)
    random.shuffle(preferred)
    out.extend(preferred[: max(1, count // 3)])
    # كتل نصوص قرائية متماسكة
    for pid, items in passages.items():
        if len(out) >= count:
            break
        chunk = items[: min(3, count - len(out))]
        out.extend(chunk)
    random.shuffle(fresh)
    for q in fresh:
        if len(out) >= count:
            break
        if q["id"] not in {x["id"] for x in out}:
            out.append(q)

    if len(out) < count:
        # املأ من الـ picker بلا فلتر صارم
        filler = base_picker(connection, mode if mode != "purge" else "daily", domain, count)
        for q in filler:
            if len(out) >= count:
                break
            if q["id"] not in {x["id"] for x in out}:
                out.append(q)

    # سجّل الظهور
    for q in out[:count]:
        record_question_seen(connection, student_nid, q, mode=mode, outcome="seen")
    return out[:count]


def pick_purge_questions(connection, student_nid: str, count: int = 8) -> list[dict]:
    ensure_on_boot(connection)
    ids = recent_wrong_ids(connection, student_nid, limit=max(count, 10))
    out: list[dict] = []
    if ids:
        placeholders = ",".join("?" for _ in ids)
        rows = connection.execute(
            f"""
            SELECT id, domain, skill, stem, choice_a, choice_b, choice_c, choice_d,
                   correct, rationale, passage_id, passage_title, passage_text,
                   COALESCE(common_mistake,''), COALESCE(grade_root,''), COALESCE(golden_rule,'')
            FROM nafs_question_bank WHERE id IN ({placeholders})
            """,
            tuple(ids),
        ).fetchall()
        from .portal_session_api import _row_to_question

        by_id = {_row_to_question(r)["id"]: _row_to_question(r) for r in rows}
        for qid in ids:
            if qid in by_id and len(out) < count:
                out.append(by_id[qid])
    if len(out) < count:
        from .portal_parametric import generate_parametric_batch

        need = count - len(out)
        generated = generate_parametric_batch(need, domains=["math", "science"])
        base = -7000 - random.randint(0, 500)
        for i, q in enumerate(generated):
            q["id"] = base - i
            out.append(q)
    for q in out:
        record_question_seen(connection, student_nid, q, mode="purge", outcome="seen")
    return out[:count]


def vault_summary(connection, student_nid: str) -> dict:
    ensure_on_boot(connection)
    open_rows = connection.execute(
        """
        SELECT id, question_id, domain, skill, stem, chosen, correct, wrong_example,
               correct_example, common_mistake, golden_rule, trap_heat, status, streak_ok,
               COALESCE(grade_root, '')
        FROM student_error_vault
        WHERE student_nid = ? AND status IN ('open','recovering')
        ORDER BY trap_heat DESC, last_seen DESC LIMIT 12
        """,
        (student_nid,),
    ).fetchall()
    recovered = connection.execute(
        "SELECT COUNT(*) FROM student_error_vault WHERE student_nid=? AND status='recovered'",
        (student_nid,),
    ).fetchone()[0]
    open_n = connection.execute(
        "SELECT COUNT(*) FROM student_error_vault WHERE student_nid=? AND status IN ('open','recovering')",
        (student_nid,),
    ).fetchone()[0]
    items = [
        {
            "id": r[0],
            "question_id": r[1],
            "domain": r[2],
            "skill": r[3],
            "stem": r[4],
            "chosen": r[5],
            "correct": r[6],
            "wrong_example": r[7],
            "correct_example": r[8],
            "common_mistake": r[9],
            "golden_rule": r[10],
            "trap_heat": r[11],
            "status": r[12],
            "streak_ok": r[13],
            "grade_root": r[14] or "",
            "etec": ETEC.get(r[2] or "", {}),
            "visual": _visual_card(r[2] or "", r[9] or "", r[10] or "", r[7] or "", r[8] or ""),
        }
        for r in open_rows
    ]
    return {
        "ok": True,
        "open_count": int(open_n or 0),
        "recovered_count": int(recovered or 0),
        "purge_label": f"لديك {_e(open_n or 0)} أخطاء عالقة — أتقنها لتحويلها إلى وسام إتقان",
        "items": items,
    }


def _visual_card(domain: str, mistake: str, rule: str, wrong: str, correct: str) -> dict:
    if domain == "math":
        return {
            "kind": "math_steps",
            "title": "مقارنة بصرية خطوة بخطوة",
            "wrong": wrong or mistake,
            "correct": correct or rule,
            "hint": "ظلّل الخطوة التي انحرفت عندك ثم جرّب نظيراً رقمياً.",
        }
    if domain == "science":
        return {
            "kind": "science_lab",
            "title": "مختبر التجربة الافتراضية",
            "wrong": wrong or mistake,
            "correct": correct or rule,
            "hint": "لاحظ ماذا يتغيّر في التجربة عند هذا الخطأ.",
        }
    return {
        "kind": "reading_lens",
        "title": "عدسة النص والدليل",
        "wrong": wrong or mistake,
        "correct": correct or rule,
        "hint": "ابحث عن الجملة المفتاحية التي تدعم الإجابة الصحيحة.",
    }


def mastery_index(connection, student_nid: str) -> dict:
    ensure_on_boot(connection)
    domains = {}
    for domain in ("reading", "math", "science"):
        hist = connection.execute(
            """
            SELECT outcome, COUNT(*) FROM student_question_history
            WHERE student_nid=? AND domain=? GROUP BY outcome
            """,
            (student_nid, domain),
        ).fetchall()
        counts = {r[0]: int(r[1]) for r in hist}
        ok = counts.get("correct", 0)
        bad = counts.get("wrong", 0)
        total = max(ok + bad, 1)
        initial = round(100.0 * ok / total, 1)
        open_n = connection.execute(
            "SELECT COUNT(*) FROM student_error_vault WHERE student_nid=? AND domain=? AND status IN ('open','recovering')",
            (student_nid, domain),
        ).fetchone()[0]
        rec_n = connection.execute(
            "SELECT COUNT(*) FROM student_error_vault WHERE student_nid=? AND domain=? AND status='recovered'",
            (student_nid, domain),
        ).fetchone()[0]
        denom = max(int(open_n or 0) + int(rec_n or 0), 1)
        recovery = round(100.0 * int(rec_n or 0) / denom, 1)
        # ثبات تقريبي من آخر ٥ جولات
        runs = connection.execute(
            """
            SELECT score_pct FROM portal_challenge_runs
            WHERE student_nid=? AND finished_at!='' AND finished_at IS NOT NULL
            ORDER BY id DESC LIMIT 5
            """,
            (student_nid,),
        ).fetchall()
        scores = [float(r[0] or 0) for r in runs]
        if len(scores) >= 2:
            mean = sum(scores) / len(scores)
            var = sum((s - mean) ** 2 for s in scores) / len(scores)
            stability = max(0.0, round(100 - (var ** 0.5), 1))
        else:
            stability = round(initial * 0.8, 1)
        composite = round(0.45 * initial + 0.35 * recovery + 0.20 * stability, 1)
        domains[domain] = {
            "etec": ETEC[domain],
            "initial_mastery": initial,
            "recovery_rate": recovery,
            "stability": stability,
            "mastery_index": composite,
            "open_errors": int(open_n or 0),
            "recovered": int(rec_n or 0),
        }
        connection.execute(
            """
            INSERT INTO student_mastery_snapshots(
              student_nid, domain, mastery_pct, recovery_rate, stability, detail_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                student_nid,
                domain,
                composite,
                recovery,
                stability,
                json.dumps(domains[domain], ensure_ascii=False),
                _iso(),
            ),
        )
    overall = round(sum(d["mastery_index"] for d in domains.values()) / 3.0, 1)
    return {"ok": True, "overall": overall, "domains": domains, "updated_at": _iso()}


def apply_run_outcomes(connection, student_nid: str, mode: str, reviewed: list[dict], questions_full: dict) -> None:
    ensure_on_boot(connection)
    for row in reviewed:
        qid = str(row.get("question_id") or "")
        q = questions_full.get(qid) or {
            "id": row.get("question_id") or 0,
            "stem": row.get("stem") or "",
            "domain": "",
            "skill": "",
        }
        q.setdefault("id", row.get("question_id") or 0)
        ok = bool(row.get("ok"))
        record_question_seen(
            connection,
            student_nid,
            q,
            mode=mode,
            outcome="correct" if ok else "wrong",
        )
        upsert_error_vault(
            connection,
            student_nid,
            q,
            str(row.get("choice") or ""),
            str(row.get("correct") or ""),
            ok,
        )


def build_home_mock_pack(connection, student_nid: str, count: int = 20) -> dict:
    from .portal_session_api import _pick_questions, _row_to_question  # noqa: F401
    from .portal_ssot import find_student

    ensure_on_boot(connection)
    student = find_student(connection, student_nid) or {}
    questions = smart_pick_questions(
        connection,
        student_nid,
        "mock",
        "",
        count,
        _pick_questions,
    )
    letters = {"A": "أ", "B": "ب", "C": "ج", "D": "د"}
    items = []
    key_rows = []
    for i, q in enumerate(questions, start=1):
        items.append(
            {
                "n": i,
                "stem": q.get("stem") or "",
                "choices": q.get("choices") or {},
                "domain": q.get("domain") or "",
                "skill": q.get("skill") or "",
                "passage_title": q.get("passage_title") or "",
                "passage_text": q.get("passage_text") or "",
            }
        )
        key_rows.append(
            {
                "n": i,
                "answer": letters.get(str(q.get("correct") or "A").upper(), "أ"),
                "skill": q.get("skill") or "",
            }
        )
    pack = {
        "student_nid": student_nid,
        "student_name": student.get("name") or "",
        "grade": student.get("grade") or "",
        "section": student.get("section") or "",
        "school": "متوسطة سعد بن الربيع الأنصاري",
        "code": "40341",
        "created_at": _iso(),
        "evidence_code": "1-3-1-2",
        "items": items,
        "answer_key": key_rows,
        "parent_pledge": (
            "أقر أنا ولي أمر الطالب بأنني راقبت ابني أثناء أداء هذا الاختبار المنزلي "
            "دون مساعدة في الإجابات، وأتعهد بتسليم الورقة للمعلم في اليوم التالي."
        ),
    }
    connection.execute(
        """
        INSERT INTO portal_home_mock_packs(student_nid, pack_json, created_at)
        VALUES (?, ?, ?)
        """,
        (student_nid, json.dumps(pack, ensure_ascii=False), _iso()),
    )
    return pack


class PurgeBody(BaseModel):
    pass


class HomeAckBody(BaseModel):
    pack_id: int = 0
    student_nid: str = ""
    parent_name: str = ""


def _require_student(token: str) -> dict:
    from .portal_session_api import _require_portal

    return _require_portal(token, ("student",))


@router.get("/api/portal/error-vault")
def api_error_vault(x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        return vault_summary(connection, session["student_nid"])
    finally:
        connection.close()


@router.get("/api/portal/mastery-index")
def api_mastery_index(x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        return mastery_index(connection, session["student_nid"])
    finally:
        connection.close()


@router.get("/api/portal/home-mock/pack")
def api_home_mock_pack(x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        pack = build_home_mock_pack(connection, session["student_nid"], 20)
        connection.commit()
        row = connection.execute(
            "SELECT id FROM portal_home_mock_packs WHERE student_nid=? ORDER BY id DESC LIMIT 1",
            (session["student_nid"],),
        ).fetchone()
        pack["pack_id"] = int(row[0]) if row else 0
        return {"ok": True, "pack": pack}
    finally:
        connection.close()


@router.get("/api/portal/parent/home-mock")
def api_parent_home_mock(student_nid: str = "", x_portal_token: str = Header(default="")):
    from .portal_owner_api import _require_parent, mask_nid

    session = _require_parent(x_portal_token)
    nid = "".join(ch for ch in student_nid if ch.isdigit())
    kids = {(c.get("national_id") or "") for c in ((session.get("payload") or {}).get("children") or [])}
    if nid not in kids:
        raise HTTPException(status_code=403, detail="هذا الطالب غير مرتبط بجلستك.")
    connection = connect()
    try:
        pack = build_home_mock_pack(connection, nid, 20)
        connection.commit()
        row = connection.execute(
            "SELECT id FROM portal_home_mock_packs WHERE student_nid=? ORDER BY id DESC LIMIT 1",
            (nid,),
        ).fetchone()
        pack["pack_id"] = int(row[0]) if row else 0
        pack["student_nid_masked"] = mask_nid(nid)
        return {"ok": True, "pack": pack}
    finally:
        connection.close()


@router.post("/api/portal/parent/home-mock/ack")
def api_parent_home_ack(body: HomeAckBody, x_portal_token: str = Header(default="")):
    from .portal_owner_api import _require_parent, mask_nid

    session = _require_parent(x_portal_token)
    phone = (session.get("payload") or {}).get("phone_norm") or session.get("actor_key") or ""
    nid = "".join(ch for ch in body.student_nid if ch.isdigit())
    kids = {(c.get("national_id") or "") for c in ((session.get("payload") or {}).get("children") or [])}
    if nid not in kids:
        raise HTTPException(status_code=403, detail="هذا الطالب غير مرتبط بجلستك.")
    connection = connect()
    try:
        ensure_on_boot(connection)
        connection.execute(
            """
            UPDATE portal_home_mock_packs
            SET acknowledged_at=?, parent_name=?, parent_phone=?
            WHERE id=? AND student_nid=?
            """,
            (_iso(), (body.parent_name or "").strip() or "ولي أمر", phone, body.pack_id, nid),
        )
        try:
            connection.execute(
                """
                INSERT INTO visual_evidence(
                  entity_type, entity_key, register_key, kind, url, name, created_at, uploaded_by
                ) VALUES ('accreditation', '1-3-1-2', 'home-mock', 'note', '', ?, ?, ?)
                """,
                (
                    f"اختبار منزلي بإشراف ولي الأمر — {mask_nid(nid)}",
                    _iso(),
                    "ولي أمر",
                ),
            )
        except Exception:
            pass
        connection.commit()
        return {
            "ok": True,
            "evidence_code": "1-3-1-2",
            "message": "وُثّق إقرار ولي الأمر للاختبار المنزلي كشاهد ١-٣-١-٢.",
        }
    finally:
        connection.close()


def teacher_peek(connection, grade: str = "", section: str = "", limit: int = 40) -> dict:
    """معاينة حيّة للمعلم: متعثرون + مهارة + جذر تراكمي + حالة التطهير."""
    ensure_on_boot(connection)
    limit = max(5, min(int(limit or 40), 80))
    params: list[Any] = []
    where = "v.status IN ('open','recovering')"
    join_extra = ""
    if grade:
        join_extra += " AND COALESCE(s.grade,'') LIKE ?"
        params.append(f"%{grade.strip()}%")
    if section:
        join_extra += " AND COALESCE(s.classroom, '') = ?"
        params.append(str(section).strip())
    rows = connection.execute(
        f"""
        SELECT v.student_nid,
               COALESCE(s.name, ''),
               COALESCE(s.grade, ''),
               COALESCE(s.classroom, ''),
               v.domain, v.skill, COALESCE(v.grade_root, ''),
               v.trap_heat, v.status, v.common_mistake, v.golden_rule, v.last_seen
        FROM student_error_vault v
        LEFT JOIN noor_students s ON s.national_id = v.student_nid
        WHERE {where}{join_extra}
        ORDER BY v.trap_heat DESC, v.last_seen DESC
        LIMIT ?
        """,
        tuple(params + [limit]),
    ).fetchall()
    items = []
    for r in rows:
        domain = r[4] or ""
        root = r[6] or ""
        status = r[8] or "open"
        items.append(
            {
                "student_nid_masked": (r[0] or "")[-4:].rjust(4, "*") if r[0] else "",
                "student_nid": r[0] or "",
                "name": r[1] or "طالب",
                "grade": r[2] or "",
                "section": r[3] or "",
                "domain": domain,
                "skill": r[5] or "",
                "grade_root": root,
                "trap_heat": int(r[7] or 0),
                "status": status,
                "status_ar": {
                    "open": "يحتاج تطهيراً",
                    "recovering": "قيد الاستعادة",
                    "recovered": "مُتقَن",
                }.get(status, status),
                "common_mistake": r[9] or "",
                "golden_rule": r[10] or "",
                "last_seen": r[11] or "",
                "etec": ETEC.get(domain, {}),
                "remedial_hint": (
                    f"وجّه لتمرين علاجي على جذر {root} قبل مهارة الصف الحالي."
                    if root in ("١م", "١", "1م", "٢م", "٢", "2م")
                    else "درّب على القاعدة الذهبية ثم نظير رقمي."
                ),
            }
        )
    by_root: dict[str, int] = defaultdict(int)
    for it in items:
        by_root[it["grade_root"] or "٣م"] += 1
    return {
        "ok": True,
        "count": len(items),
        "by_root": dict(by_root),
        "items": items,
        "legend": {
            "١م": "فاقد من الصف الأول متوسط",
            "٢م": "فاقد من الصف الثاني متوسط",
            "٣م": "مهارة الصف الحالي",
        },
    }


@router.get("/api/portal/teacher/peek")
def api_teacher_peek(
    grade: str = "",
    section: str = "",
    limit: int = 40,
    x_session_token: str = Header(default=""),
):
    """Teacher Peek — للمعلمين والقيادة (مستوى ≤ ٢)."""
    from .portal_owner_api import _require_level

    user, level = _require_level(x_session_token, 2)
    connection = connect()
    try:
        pack = teacher_peek(connection, grade=grade, section=section, limit=limit)
        pack["viewer"] = {
            "name": user.get("name") or "",
            "level": level,
        }
        return pack
    finally:
        connection.close()
