# ألعاب ميدان نافس: تواجد حي، مبارزة مباشرة، كلمات، حساب ذهني.
from __future__ import annotations

import json
import random
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect

router = APIRouter(tags=["portal-games"])

EASTERN = "٠١٢٣٤٥٦٧٨٩"


def _e(v) -> str:
    return "".join(EASTERN[int(c)] if c.isdigit() else c for c in str(v))


def _iso(dt: datetime | None = None) -> str:
    return (dt or datetime.now(timezone.utc)).replace(microsecond=0).isoformat()


def _now() -> datetime:
    return datetime.now(timezone.utc)


SCHEMA = """
CREATE TABLE IF NOT EXISTS portal_presence (
    student_nid TEXT PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT '',
    grade TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_live_duels (
    id TEXT PRIMARY KEY,
    challenger_nid TEXT NOT NULL,
    opponent_nid TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    detail_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_game_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL,
    game_type TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    combo_best INTEGER NOT NULL DEFAULT 0,
    detail_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_portal_games_student ON portal_game_runs(student_nid, game_type);
"""

WORD_BANK = [
    {"word": "راسخة", "meaning": "ثابتة متمكنة", "synonym": "ثابتة", "antonym": "متزعزعة"},
    {"word": "يُهدر", "meaning": "يُضيَّع بلا فائدة", "synonym": "يُبدّد", "antonym": "يُحفظ"},
    {"word": "مستدام", "meaning": "مستمر بعناية", "synonym": "متواصل", "antonym": "مؤقت"},
    {"word": "الحصيف", "meaning": "الواعي المتأني", "synonym": "الرزين", "antonym": "المتهور"},
    {"word": "شامخة", "meaning": "عالية معتزة", "synonym": "مرتفعة", "antonym": "منخفضة"},
    {"word": "يضيء", "meaning": "يرشد وينير", "synonym": "ينير", "antonym": "يظلم"},
    {"word": "استراتيجية", "meaning": "خطة حل مناسبة", "synonym": "خطة", "antonym": "عشوائية"},
    {"word": "أنظف", "meaning": "أقل تلويثاً", "synonym": "أنقى", "antonym": "أوسخ"},
    {"word": "دقيقة", "meaning": "منضبطة وصحيحة", "synonym": "محكمة", "antonym": "غامضة"},
    {"word": "قدوة", "meaning": "مثال يُحتذى", "synonym": "أسوة", "antonym": "منفّر"},
    {"word": "ترشيد", "meaning": "استخدام معتدل", "synonym": "اقتصاد", "antonym": "تبذير"},
    {"word": "تعجّل", "meaning": "أسرع بلا تروٍّ", "synonym": "تسرّع", "antonym": "تأنّى"},
]


def ensure_on_boot(connection) -> dict:
    connection.executescript(SCHEMA)
    return {"ok": True}


def _require_student(token: str) -> dict:
    from .portal_session_api import _require_portal

    return _require_portal(token, ("student",))


class PresenceBody(BaseModel):
    pass


class ChallengeBody(BaseModel):
    opponent_nid: str = ""


class DuelActionBody(BaseModel):
    duel_id: str = ""
    action: str = ""  # accept | reject | progress
    answered: int = 0
    correct: int = 0
    answers: list[dict] = Field(default_factory=list)


class WordFinishBody(BaseModel):
    answers: list[dict] = Field(default_factory=list)
    combo_best: int = 0
    elapsed_sec: float = 0


class MentalFinishBody(BaseModel):
    mode: str = "solo"  # solo | tournament
    level: int = 1
    answers: list[dict] = Field(default_factory=list)
    elapsed_sec: float = 0


@router.post("/api/portal/presence/ping")
def presence_ping(x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        ensure_on_boot(connection)
        student = session.get("payload") or {}
        from .portal_ssot import find_student

        st = find_student(connection, session["student_nid"]) or {}
        connection.execute(
            """
            INSERT INTO portal_presence(student_nid, display_name, grade, section, last_seen)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(student_nid) DO UPDATE SET
              display_name=excluded.display_name,
              grade=excluded.grade,
              section=excluded.section,
              last_seen=excluded.last_seen
            """,
            (
                session["student_nid"],
                st.get("name") or session.get("display_name") or "طالب",
                st.get("grade") or student.get("grade") or "",
                st.get("section") or student.get("section") or "",
                _iso(),
            ),
        )
        connection.commit()
        return {"ok": True}
    finally:
        connection.close()


@router.get("/api/portal/presence/online")
def presence_online(x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        ensure_on_boot(connection)
        since = _iso(_now() - timedelta(seconds=45))
        rows = connection.execute(
            """
            SELECT student_nid, display_name, grade, section, last_seen
            FROM portal_presence
            WHERE last_seen >= ? AND student_nid != ?
            ORDER BY last_seen DESC LIMIT 40
            """,
            (since, session["student_nid"]),
        ).fetchall()
        from .portal_owner_api import mask_nid

        return {
            "ok": True,
            "online": [
                {
                    "national_id": r[0],
                    "national_id_masked": mask_nid(r[0]),
                    "name": (r[1] or "").split()[0] if r[1] else "زميل",
                    "grade": r[2] or "",
                    "section": r[3] or "",
                    "last_seen": r[4],
                }
                for r in rows
            ],
        }
    finally:
        connection.close()


def _duel_questions() -> list[dict]:
    from .portal_parametric import generate_parametric_batch

    batch = generate_parametric_batch(5, domains=["math", "science"])
    out = []
    for i, q in enumerate(batch):
        q["id"] = -(5000 + i)
        out.append(
            {
                "id": q["id"],
                "stem": q["stem"],
                "choices": q["choices"],
                "correct": q["correct"],
                "domain": q.get("domain") or "math",
            }
        )
    return out


@router.post("/api/portal/live-duel/challenge")
def live_duel_challenge(body: ChallengeBody, x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    opp = "".join(ch for ch in str(body.opponent_nid or "") if ch.isdigit())
    if not opp or opp == session["student_nid"]:
        raise HTTPException(status_code=400, detail="خصم غير صالح.")
    connection = connect()
    try:
        ensure_on_boot(connection)
        since = _iso(_now() - timedelta(seconds=45))
        online = connection.execute(
            "SELECT 1 FROM portal_presence WHERE student_nid = ? AND last_seen >= ?",
            (opp, since),
        ).fetchone()
        if not online:
            raise HTTPException(status_code=409, detail="الخصم غير متصل حالياً.")
        duel_id = secrets.token_hex(8)
        questions = _duel_questions()
        detail = {
            "questions": questions,
            "correct_map": {str(q["id"]): q["correct"] for q in questions},
            "seconds": 60,
            "xp_win": 50,
            "progress": {
                session["student_nid"]: {"answered": 0, "correct": 0},
                opp: {"answered": 0, "correct": 0},
            },
        }
        now = _iso()
        connection.execute(
            """
            INSERT INTO portal_live_duels(id, challenger_nid, opponent_nid, status, detail_json, created_at, updated_at)
            VALUES (?, ?, ?, 'pending', ?, ?, ?)
            """,
            (duel_id, session["student_nid"], opp, json.dumps(detail, ensure_ascii=False), now, now),
        )
        connection.commit()
        return {"ok": True, "duel_id": duel_id, "status": "pending", "seconds": 60}
    finally:
        connection.close()


@router.get("/api/portal/live-duel/inbox")
def live_duel_inbox(x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        ensure_on_boot(connection)
        since = _iso(_now() - timedelta(minutes=5))
        rows = connection.execute(
            """
            SELECT id, challenger_nid, opponent_nid, status, created_at
            FROM portal_live_duels
            WHERE (opponent_nid = ? OR challenger_nid = ?) AND created_at >= ?
              AND status IN ('pending','active')
            ORDER BY created_at DESC LIMIT 10
            """,
            (session["student_nid"], session["student_nid"], since),
        ).fetchall()
        from .portal_ssot import find_student

        items = []
        for r in rows:
            other = r[1] if r[2] == session["student_nid"] else r[2]
            st = find_student(connection, other) or {}
            items.append(
                {
                    "duel_id": r[0],
                    "role": "opponent" if r[2] == session["student_nid"] else "challenger",
                    "status": r[3],
                    "other_name": (st.get("name") or "زميل").split()[0],
                    "created_at": r[4],
                    "incoming": r[2] == session["student_nid"] and r[3] == "pending",
                }
            )
        return {"ok": True, "items": items}
    finally:
        connection.close()


@router.post("/api/portal/live-duel/action")
def live_duel_action(body: DuelActionBody, x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        ensure_on_boot(connection)
        row = connection.execute(
            "SELECT challenger_nid, opponent_nid, status, detail_json FROM portal_live_duels WHERE id = ?",
            (body.duel_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="مبارزة غير موجودة.")
        if session["student_nid"] not in (row[0], row[1]):
            raise HTTPException(status_code=403, detail="لست طرفاً في هذه المبارزة.")
        detail = json.loads(row[3] or "{}")
        action = (body.action or "").lower()
        status = row[2]
        if action == "reject" and status == "pending" and session["student_nid"] == row[1]:
            status = "rejected"
        elif action == "accept" and status == "pending" and session["student_nid"] == row[1]:
            status = "active"
        elif action == "progress" and status == "active":
            prog = detail.setdefault("progress", {})
            cmap = detail.get("correct_map") or {}
            scored = 0
            answered_n = int(body.answered or 0)
            if body.answers:
                for row in body.answers:
                    qid = str((row or {}).get("id") or "")
                    if qid and str((row or {}).get("choice") or "") == str(cmap.get(qid) or ""):
                        scored += 1
                answered_n = max(answered_n, len(body.answers))
            else:
                scored = int(body.correct or 0)
            prog[session["student_nid"]] = {
                "answered": answered_n,
                "correct": scored,
                "answers": body.answers or [],
            }
            # إنهاء عند اكتمال الطرفين
            a = prog.get(row[0]) or {}
            b = prog.get(row[1]) or {}
            if int(a.get("answered") or 0) >= 5 and int(b.get("answered") or 0) >= 5:
                status = "finished"
                ac, bc = int(a.get("correct") or 0), int(b.get("correct") or 0)
                winner = row[0] if ac >= bc else row[1]
                if ac == bc:
                    winner = ""
                detail["winner"] = winner
                if winner:
                    connection.execute(
                        """
                        INSERT INTO portal_xp_ledger(student_nid, event_type, xp, meta_json, created_at)
                        VALUES (?, 'live_duel_win', 50, ?, ?)
                        """,
                        (
                            winner,
                            json.dumps({"duel_id": body.duel_id}, ensure_ascii=False),
                            _iso(),
                        ),
                    )
        else:
            raise HTTPException(status_code=400, detail="إجراء غير مسموح في هذه الحالة.")
        connection.execute(
            "UPDATE portal_live_duels SET status = ?, detail_json = ?, updated_at = ? WHERE id = ?",
            (status, json.dumps(detail, ensure_ascii=False), _iso(), body.duel_id),
        )
        connection.commit()
        public_qs = [
            {"id": q["id"], "stem": q["stem"], "choices": q["choices"], "domain": q.get("domain")}
            for q in (detail.get("questions") or [])
        ]
        return {
            "ok": True,
            "status": status,
            "duel_id": body.duel_id,
            "seconds": detail.get("seconds") or 60,
            "questions": public_qs if status in ("active", "finished") else [],
            "progress": detail.get("progress") or {},
            "winner": detail.get("winner") or "",
            "correct_map": detail.get("correct_map") if status == "finished" else {},
        }
    finally:
        connection.close()


@router.get("/api/portal/live-duel/{duel_id}")
def live_duel_get(duel_id: str, x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        ensure_on_boot(connection)
        row = connection.execute(
            "SELECT challenger_nid, opponent_nid, status, detail_json FROM portal_live_duels WHERE id = ?",
            (duel_id,),
        ).fetchone()
        if not row or session["student_nid"] not in (row[0], row[1]):
            raise HTTPException(status_code=404, detail="مبارزة غير موجودة.")
        detail = json.loads(row[3] or "{}")
        public_qs = [
            {"id": q["id"], "stem": q["stem"], "choices": q["choices"], "domain": q.get("domain")}
            for q in (detail.get("questions") or [])
        ]
        return {
            "ok": True,
            "status": row[2],
            "duel_id": duel_id,
            "seconds": detail.get("seconds") or 60,
            "questions": public_qs if row[2] in ("active", "finished") else [],
            "progress": detail.get("progress") or {},
            "winner": detail.get("winner") or "",
            "you": session["student_nid"],
            "challenger": row[0],
            "opponent": row[1],
        }
    finally:
        connection.close()


@router.get("/api/portal/games/words/start")
def words_start(x_portal_token: str = Header(default="")):
    _require_student(x_portal_token)
    rounds = []
    sample = random.sample(WORD_BANK, k=min(10, len(WORD_BANK)))
    kinds = ["meaning", "synonym", "antonym"]
    for i, item in enumerate(sample):
        kind = kinds[i % 3]
        if kind == "meaning":
            prompt = f"ما معنى «{item['word']}»؟"
            correct = item["meaning"]
            distractors = [w["meaning"] for w in WORD_BANK if w["word"] != item["word"]]
        elif kind == "synonym":
            prompt = f"مرادف «{item['word']}»:"
            correct = item["synonym"]
            distractors = [w["synonym"] for w in WORD_BANK if w["word"] != item["word"]]
        else:
            prompt = f"ضد «{item['word']}»:"
            correct = item["antonym"]
            distractors = [w["antonym"] for w in WORD_BANK if w["word"] != item["word"]]
        opts = [correct] + random.sample(distractors, k=min(3, len(distractors)))
        random.shuffle(opts)
        letters = ["A", "B", "C", "D"]
        choices = {letters[j]: opts[j] for j in range(4)}
        correct_letter = letters[opts.index(correct)]
        rounds.append(
            {
                "id": i + 1,
                "kind": kind,
                "kind_ar": {"meaning": "معنى", "synonym": "مرادف", "antonym": "ضد"}[kind],
                "prompt": prompt,
                "choices": choices,
                "correct": correct_letter,
                "etec": "3-1-1-1",
            }
        )
    return {"ok": True, "seconds": 60, "rounds": rounds, "etec": "3-1-1-1"}


@router.post("/api/portal/games/words/finish")
def words_finish(body: WordFinishBody, x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        ensure_on_boot(connection)
        score = sum(1 for a in body.answers if a.get("ok"))
        xp = score * 3 + (5 if body.combo_best >= 3 else 0)
        connection.execute(
            """
            INSERT INTO portal_game_runs(student_nid, game_type, score, combo_best, detail_json, created_at)
            VALUES (?, 'words', ?, ?, ?, ?)
            """,
            (
                session["student_nid"],
                score,
                int(body.combo_best or 0),
                json.dumps({"answers": body.answers, "elapsed": body.elapsed_sec}, ensure_ascii=False),
                _iso(),
            ),
        )
        if xp:
            connection.execute(
                """
                INSERT INTO portal_xp_ledger(student_nid, event_type, xp, meta_json, created_at)
                VALUES (?, 'game_words', ?, '{}', ?)
                """,
                (session["student_nid"], xp, _iso()),
            )
        connection.commit()
        return {"ok": True, "score": score, "xp_earned": xp, "etec": "3-1-1-1"}
    finally:
        connection.close()


def _mental_item(level: int) -> dict:
    level = max(1, min(5, int(level or 1)))
    if level == 1:
        a, b = random.randint(2, 9), random.randint(2, 9)
        stem, ans = f"{_e(a)} × {_e(b)} = ؟", a * b
    elif level == 2:
        b = random.randint(2, 9)
        ans = random.randint(2, 9)
        a = b * ans
        stem = f"{_e(a)} ÷ {_e(b)} = ؟"
    elif level == 3:
        a, b = random.randint(10, 40), random.randint(10, 40)
        stem, ans = f"{_e(a)} + {_e(b)} = ؟", a + b
    elif level == 4:
        a, b = random.randint(20, 60), random.randint(5, 19)
        stem, ans = f"{_e(a)} − {_e(b)} = ؟", a - b
    else:
        a, b, c = random.randint(-9, 9), random.randint(2, 9), random.randint(-5, 5)
        stem, ans = f"({_e(a)}) × {_e(b)} + ({_e(c)}) = ؟", a * b + c
    distractors = {ans + 1, ans - 1, ans + 2, ans - 2, ans * 2}
    distractors.discard(ans)
    while len(distractors) < 3:
        distractors.add(ans + random.randint(-7, 7))
    opts = [ans] + list(distractors)[:3]
    random.shuffle(opts)
    letters = ["A", "B", "C", "D"]
    choices = {letters[i]: _e(opts[i]) for i in range(4)}
    return {
        "stem": stem,
        "choices": choices,
        "correct": letters[opts.index(ans)],
        "level": level,
    }


@router.get("/api/portal/games/mental/start")
def mental_start(level: int = 1, count: int = 10, x_portal_token: str = Header(default="")):
    _require_student(x_portal_token)
    items = [_mental_item(level) for _ in range(max(5, min(20, count)))]
    for i, it in enumerate(items):
        it["id"] = i + 1
    return {
        "ok": True,
        "level": level,
        "seconds": 90 if level >= 3 else 60,
        "items": items,
        "etec": "3-1-1-2",
        "modes": {"solo": "تسلق المستويات", "tournament": "بطولة الفصول"},
    }


@router.post("/api/portal/games/mental/finish")
def mental_finish(body: MentalFinishBody, x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        ensure_on_boot(connection)
        score = sum(1 for a in body.answers if a.get("ok"))
        xp = score * 2 + (int(body.level or 1) * 2)
        connection.execute(
            """
            INSERT INTO portal_game_runs(student_nid, game_type, score, combo_best, detail_json, created_at)
            VALUES (?, ?, ?, 0, ?, ?)
            """,
            (
                session["student_nid"],
                f"mental:{body.mode}:{body.level}",
                score,
                json.dumps(
                    {"answers": body.answers, "elapsed": body.elapsed_sec, "mode": body.mode},
                    ensure_ascii=False,
                ),
                _iso(),
            ),
        )
        if xp:
            connection.execute(
                """
                INSERT INTO portal_xp_ledger(student_nid, event_type, xp, meta_json, created_at)
                VALUES (?, 'game_mental', ?, '{}', ?)
                """,
                (session["student_nid"], xp, _iso()),
            )
        connection.commit()
        return {"ok": True, "score": score, "xp_earned": xp, "etec": "3-1-1-2", "level": body.level}
    finally:
        connection.close()
