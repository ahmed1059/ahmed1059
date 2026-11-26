# واجهات القراءة المتزامنة (صوت + تظليل + مفردات + أسئلة).
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect
from .nafs_readalong_data import READALONG_PASSAGES, get_passage, list_passages_public

router = APIRouter(tags=["nafs-readalong"])

SCHEMA = """
CREATE TABLE IF NOT EXISTS portal_readalong_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    passage_id TEXT NOT NULL,
    listened INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    detail_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    UNIQUE(student_nid, passage_id)
);
"""


def _iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_on_boot(connection) -> dict:
    connection.executescript(SCHEMA)
    return {"ok": True, "passages": len(READALONG_PASSAGES)}


def _require_student(token: str) -> dict:
    from .portal_session_api import _require_portal

    return _require_portal(token, ("student",))


class FinishBody(BaseModel):
    passage_id: str = ""
    answers: list[dict] = Field(default_factory=list)
    listened: bool = True


@router.get("/api/portal/readalong/passages")
def readalong_list(x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        ensure_on_boot(connection)
        done = {
            r[0]: {"score": r[1], "listened": r[2]}
            for r in connection.execute(
                "SELECT passage_id, score, listened FROM portal_readalong_progress WHERE student_nid=?",
                (session["student_nid"],),
            )
        }
        items = list_passages_public()
        for it in items:
            prog = done.get(it["id"]) or {}
            it["progress"] = prog
            it["completed"] = bool(prog)
        return {"ok": True, "passages": items, "etec": "٣-١-١-١"}
    finally:
        connection.close()


@router.get("/api/portal/readalong/passages/{passage_id}")
def readalong_get(passage_id: str, x_portal_token: str = Header(default="")):
    _require_student(x_portal_token)
    passage = get_passage(passage_id)
    if not passage:
        raise HTTPException(status_code=404, detail="القطعة غير موجودة.")
    # لا نكشف correct في الطبقة العامة للأسئلة أثناء القراءة
    public_qs = [
        {
            "id": q["id"],
            "level": q["level"],
            "stem": q["stem"],
            "choices": q["choices"],
            "sentence_index": q.get("sentence_index", 0),
        }
        for q in passage["questions"]
    ]
    return {
        "ok": True,
        "passage": {
            "id": passage["id"],
            "title": passage["title"],
            "kind": passage["kind"],
            "etec": passage["etec"],
            "etec_ar": "٣-١-١-١",
            "image": passage["image"],
            "text": passage["text"],
            "sentences": passage["sentences"],
            "vocab": passage["vocab"],
            "audio": {"lang": "ar-SA", "rate_options": [0.75, 1.0, 1.2], "mp3": ""},
            "questions": public_qs,
        },
    }


@router.post("/api/portal/readalong/finish")
def readalong_finish(body: FinishBody, x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    passage = get_passage(body.passage_id)
    if not passage:
        raise HTTPException(status_code=404, detail="القطعة غير موجودة.")
    key = {str(q["id"]): q for q in passage["questions"]}
    score = 0
    review = []
    for ans in body.answers or []:
        qid = str(ans.get("id") or ans.get("question_id") or "")
        q = key.get(qid)
        if not q:
            continue
        choice = str(ans.get("choice") or "").upper()
        ok = choice == str(q["correct"]).upper()
        if ok:
            score += 1
        review.append(
            {
                "id": q["id"],
                "ok": ok,
                "correct": q["correct"],
                "choice": choice,
                "evidence": q.get("evidence") or "",
                "sentence_index": q.get("sentence_index", 0),
                "level": q.get("level") or "",
            }
        )
    xp = score * 4 + (5 if score >= 4 else 0)
    connection = connect()
    try:
        ensure_on_boot(connection)
        connection.execute(
            """
            INSERT INTO portal_readalong_progress(student_nid, passage_id, listened, score, detail_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_nid, passage_id) DO UPDATE SET
              listened=excluded.listened, score=excluded.score,
              detail_json=excluded.detail_json, updated_at=excluded.updated_at
            """,
            (
                session["student_nid"],
                body.passage_id,
                1 if body.listened else 0,
                score,
                json.dumps({"review": review}, ensure_ascii=False),
                _iso(),
            ),
        )
        if xp:
            connection.execute(
                """
                INSERT INTO portal_xp_ledger(student_nid, event_type, xp, meta_json, created_at)
                VALUES (?, 'readalong', ?, ?, ?)
                """,
                (
                    session["student_nid"],
                    xp,
                    json.dumps({"passage_id": body.passage_id, "score": score}, ensure_ascii=False),
                    _iso(),
                ),
            )
        # ربط أخطاء القراءة بـ Error Vault عند الإخفاق
        try:
            from .nafs_adaptive_engine import upsert_error_vault

            for row in review:
                if row["ok"]:
                    continue
                q = key[str(row["id"])]
                upsert_error_vault(
                    connection,
                    session["student_nid"],
                    {
                        "id": 900000 + hash(body.passage_id + str(row["id"])) % 100000,
                        "domain": "reading",
                        "skill": "الفهم القرائي",
                        "stem": q["stem"],
                        "common_mistake": "اختيار بديل مغرٍ دون دليل نصي",
                        "golden_rule": row.get("evidence") or "ارجع إلى الجملة المظللة",
                        "wrong_example": f"اخترت {row['choice']}",
                        "correct_example": row.get("evidence") or "",
                    },
                    row["choice"],
                    row["correct"],
                    False,
                )
        except Exception:
            pass
        connection.commit()
        return {
            "ok": True,
            "score": score,
            "total": len(passage["questions"]),
            "xp_earned": xp,
            "review": review,
            "etec": "٣-١-١-١",
        }
    finally:
        connection.close()
