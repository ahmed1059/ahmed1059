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

CREATE TABLE IF NOT EXISTS portal_player_profile (
    student_nid TEXT PRIMARY KEY,
    nickname TEXT NOT NULL DEFAULT '',
    avatar_id TEXT NOT NULL DEFAULT 'falcon-island',
    theme TEXT NOT NULL DEFAULT 'royal',
    updated_at TEXT NOT NULL
);
"""

AVATAR_CATEGORIES = [
    {
        "id": "falcons",
        "label": "الصقور",
        "items": [
            {"id": "falcon-island", "label": "صقر الجزيرة"},
            {"id": "falcon-peregrine", "label": "صقر الشاهين"},
            {"id": "falcon-golden", "label": "الصقر الذهبي"},
        ],
    },
    {
        "id": "lions",
        "label": "الأسود",
        "items": [
            {"id": "lion-den", "label": "أسد العرين"},
            {"id": "lion-king", "label": "ملك الأسود"},
            {"id": "lion-peak", "label": "أسد القمة"},
        ],
    },
    {
        "id": "cheetahs",
        "label": "الفهود",
        "items": [
            {"id": "cheetah-speed", "label": "فهد السرعة"},
            {"id": "cheetah-night", "label": "فهد الليل"},
            {"id": "cheetah-arena", "label": "فهد الميدان"},
        ],
    },
    {
        "id": "tigers",
        "label": "النمور",
        "items": [
            {"id": "tiger-challenge", "label": "النمر المتحدي"},
            {"id": "tiger-shadow", "label": "نمر الظل"},
            {"id": "tiger-cup", "label": "نمر البطولة"},
        ],
    },
    {
        "id": "knights",
        "label": "الفرسان",
        "items": [
            {"id": "knight-arab", "label": "فارس عربي"},
            {"id": "knight-gold", "label": "فارس الدرع الذهبي"},
            {"id": "knight-duel", "label": "فارس التحدي"},
        ],
    },
    {
        "id": "clubs",
        "label": "شعارات الأندية",
        "items": [
            {"id": "club-hilal", "label": "الهلال"},
            {"id": "club-nasr", "label": "النصر"},
            {"id": "club-ittihad", "label": "الاتحاد"},
            {"id": "club-ahly", "label": "الأهلي"},
            {"id": "club-zamalek", "label": "الزمالك"},
            {"id": "club-madrid", "label": "ريال مدريد"},
            {"id": "club-liverpool", "label": "ليفربول"},
            {"id": "club-hilal-sd", "label": "الهلال السوداني"},
        ],
    },
]

# توافق خلفي مع المعرفات القديمة a1–a12
_AVATAR_LEGACY = {
    "a1": "falcon-island",
    "a2": "falcon-golden",
    "a3": "falcon-peregrine",
    "a4": "knight-arab",
    "a5": "tiger-challenge",
    "a6": "cheetah-speed",
    "a7": "club-hilal",
    "a8": "lion-king",
    "a9": "cheetah-arena",
    "a10": "lion-peak",
    "a11": "tiger-shadow",
    "a12": "knight-gold",
}

AVATARS = [item for cat in AVATAR_CATEGORIES for item in cat["items"]]
_AVATAR_IDS = {a["id"] for a in AVATARS} | set(_AVATAR_LEGACY.keys())


def normalize_avatar_id(avatar_id: str) -> str:
    raw = str(avatar_id or "").strip() or "falcon-island"
    if raw in _AVATAR_LEGACY:
        return _AVATAR_LEGACY[raw]
    if raw in {a["id"] for a in AVATARS}:
        return raw
    return "falcon-island"


def get_player_profile(connection, student_nid: str) -> dict:
    ensure_on_boot(connection)
    row = connection.execute(
        "SELECT nickname, avatar_id, theme FROM portal_player_profile WHERE student_nid = ?",
        (student_nid,),
    ).fetchone()
    if not row:
        return {
            "nickname": "",
            "avatar_id": "falcon-island",
            "theme": "royal",
            "avatars": AVATARS,
            "avatar_categories": AVATAR_CATEGORIES,
        }
    return {
        "nickname": row[0] or "",
        "avatar_id": normalize_avatar_id(row[1] or "falcon-island"),
        "theme": row[2] or "royal",
        "avatars": AVATARS,
        "avatar_categories": AVATAR_CATEGORIES,
    }


def player_display_name(connection, student_nid: str, formal_name: str = "") -> str:
    profile = get_player_profile(connection, student_nid)
    nick = (profile.get("nickname") or "").strip()
    if nick:
        return nick
    formal = (formal_name or "").strip()
    return formal.split()[0] if formal else "لاعب"

WORD_BANK = [
    {"word": "راسخة", "meaning": "ثابتة متمكنة", "synonym": "ثابتة", "antonym": "متزعزعة", "track": "lang"},
    {"word": "يُهدر", "meaning": "يُضيَّع بلا فائدة", "synonym": "يُبدّد", "antonym": "يُحفظ", "track": "lang"},
    {"word": "مستدام", "meaning": "مستمر بعناية", "synonym": "متواصل", "antonym": "مؤقت", "track": "lang"},
    {"word": "الحصيف", "meaning": "الواعي المتأني", "synonym": "الرزين", "antonym": "المتهور", "track": "lang"},
    {"word": "شامخة", "meaning": "عالية معتزة", "synonym": "مرتفعة", "antonym": "منخفضة", "track": "lang"},
    {"word": "يضيء", "meaning": "يرشد وينير", "synonym": "ينير", "antonym": "يظلم", "track": "lang"},
    {"word": "استراتيجية", "meaning": "خطة حل مناسبة", "synonym": "خطة", "antonym": "عشوائية", "track": "lang"},
    {"word": "أنظف", "meaning": "أقل تلويثاً", "synonym": "أنقى", "antonym": "أوسخ", "track": "lang"},
    {"word": "دقيقة", "meaning": "منضبطة وصحيحة", "synonym": "محكمة", "antonym": "غامضة", "track": "lang"},
    {"word": "قدوة", "meaning": "مثال يُحتذى", "synonym": "أسوة", "antonym": "منفّر", "track": "lang"},
    {"word": "ترشيد", "meaning": "استخدام معتدل", "synonym": "اقتصاد", "antonym": "تبذير", "track": "lang"},
    {"word": "تعجّل", "meaning": "أسرع بلا تروٍّ", "synonym": "تسرّع", "antonym": "تأنّى", "track": "lang"},
    {"word": "مثابرة", "meaning": "استمرار في الجهد", "synonym": "مداومة", "antonym": "تراخٍ", "track": "lang"},
    {"word": "إتقان", "meaning": "إحكام العمل بجودة", "synonym": "إحسان", "antonym": "إهمال", "track": "lang"},
    {"word": "تأمّل", "meaning": "نظر عميق بتدبّر", "synonym": "تفكّر", "antonym": "غفلة", "track": "lang"},
    {"word": "تعاون", "meaning": "عمل مشترك بنظام", "synonym": "تكاتف", "antonym": "تفرّق", "track": "lang"},
    {"word": "مسؤولية", "meaning": "تحمّل الأمانة والواجب", "synonym": "تكليف", "antonym": "تهرّب", "track": "lang"},
    {"word": "انضباط", "meaning": "التزام بالقواعد", "synonym": "نظام", "antonym": "فوضى", "track": "lang"},
    {"word": "طموح", "meaning": "سعي عالٍ للهدف", "synonym": "همّة", "antonym": "قنوط", "track": "lang"},
    {"word": "إنصات", "meaning": "استماع بتركيز", "synonym": "إصغاء", "antonym": "تشويش", "track": "lang"},
    # ألفاظ قرآنية مبسّطة للمرحلة المتوسطة (معنى · مرادف · ضد تربوي)
    {"word": "هدى", "meaning": "رشد وإرشاد إلى الحق", "synonym": "رشاد", "antonym": "ضلال", "track": "quran"},
    {"word": "تقوى", "meaning": "امتثال أوامر الله واجتناب نواهيه", "synonym": "خشية", "antonym": "غفلة", "track": "quran"},
    {"word": "صبر", "meaning": "ثبات على الحق بلا جزع", "synonym": "ثبات", "antonym": "جزع", "track": "quran"},
    {"word": "رزق", "meaning": "ما يسوقه الله من عطاء", "synonym": "عطاء", "antonym": "منع", "track": "quran"},
    {"word": "شكر", "meaning": "الثناء على المنعم اعترافاً بنعمته", "synonym": "حمد", "antonym": "كفران", "track": "quran"},
    {"word": "أمانة", "meaning": "حفظ الحقوق وأداؤها", "synonym": "عهد", "antonym": "خيانة", "track": "quran"},
    {"word": "عدل", "meaning": "إنصاف بلا ميل", "synonym": "قسط", "antonym": "ظلم", "track": "quran"},
    {"word": "رحمة", "meaning": "رفق وإحسان ولين", "synonym": "رأفة", "antonym": "قسوة", "track": "quran"},
    {"word": "علم", "meaning": "معرفة صحيحة نافعة", "synonym": "معرفة", "antonym": "جهل", "track": "quran"},
    {"word": "برّ", "meaning": "إحسان وطاعة وخير", "synonym": "خير", "antonym": "إثم", "track": "quran"},
    {"word": "توبة", "meaning": "رجوع إلى الله بندم", "synonym": "أوبة", "antonym": "إصرار", "track": "quran"},
    {"word": "يقين", "meaning": "إيمان راسخ بلا شك", "synonym": "طُمأنينة", "antonym": "ريب", "track": "quran"},
    {"word": "إخلاص", "meaning": "تجريد العمل لله", "synonym": "صفاء", "antonym": "رياء", "track": "quran"},
    {"word": "عفو", "meaning": "صفح عن الزلة", "synonym": "صفح", "antonym": "انتقام", "track": "quran"},
    {"word": "حكمة", "meaning": "وضع الشيء في موضعه", "synonym": "بصيرة", "antonym": "طيش", "track": "quran"},
    {"word": "فلاح", "meaning": "نجاح ونجاة", "synonym": "نجاح", "antonym": "خسارة", "track": "quran"},
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


class PlayerProfileBody(BaseModel):
    nickname: str = ""
    avatar_id: str = "falcon-island"
    theme: str = "royal"


@router.get("/api/portal/player/profile")
def player_profile_get(x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        return {"ok": True, **get_player_profile(connection, session["student_nid"])}
    finally:
        connection.close()


@router.post("/api/portal/player/profile")
def player_profile_save(body: PlayerProfileBody, x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    nick = str(body.nickname or "").strip()[:24]
    avatar = normalize_avatar_id(body.avatar_id)
    theme = body.theme if body.theme in ("neon", "royal", "day") else "royal"
    connection = connect()
    try:
        ensure_on_boot(connection)
        connection.execute(
            """
            INSERT INTO portal_player_profile(student_nid, nickname, avatar_id, theme, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(student_nid) DO UPDATE SET
              nickname=excluded.nickname,
              avatar_id=excluded.avatar_id,
              theme=excluded.theme,
              updated_at=excluded.updated_at
            """,
            (session["student_nid"], nick, avatar, theme, _iso()),
        )
        connection.commit()
        return {
            "ok": True,
            "nickname": nick,
            "avatar_id": avatar,
            "theme": theme,
            "avatars": AVATARS,
            "avatar_categories": AVATAR_CATEGORIES,
        }
    finally:
        connection.close()


@router.post("/api/portal/presence/ping")
def presence_ping(x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        ensure_on_boot(connection)
        student = session.get("payload") or {}
        from .portal_ssot import find_student

        st = find_student(connection, session["student_nid"]) or {}
        shown = player_display_name(connection, session["student_nid"], st.get("name") or session.get("display_name") or "")
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
                shown,
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
        review_items: list = []
        review_summary: dict = {}
        if status == "finished":
            from .nafs_endround_review import review_from_game_answers

            cmap = detail.get("correct_map") or {}
            q_by_id = {str(q.get("id")): q for q in (detail.get("questions") or [])}
            mine = ((detail.get("progress") or {}).get(session["student_nid"]) or {}).get(
                "answers"
            ) or []
            enriched = []
            for ans in mine:
                qid = str((ans or {}).get("id") or "")
                q = q_by_id.get(qid) or {}
                enriched.append(
                    {
                        "id": qid,
                        "choice": (ans or {}).get("choice") or "",
                        "correct": cmap.get(qid) or q.get("correct") or "",
                        "stem": q.get("stem") or "",
                        "choices": q.get("choices") if isinstance(q.get("choices"), dict) else None,
                        "rationale": q.get("rationale") or "",
                    }
                )
            review_pack = review_from_game_answers(enriched)
            review_items = review_pack.get("items") or []
            review_summary = {
                "total": review_pack.get("total"),
                "correct_count": review_pack.get("correct_count"),
                "wrong_count": review_pack.get("wrong_count"),
                "total_ar": review_pack.get("total_ar"),
                "correct_count_ar": review_pack.get("correct_count_ar"),
                "wrong_count_ar": review_pack.get("wrong_count_ar"),
            }
            detail["review"] = review_items
            detail["review_summary"] = review_summary
            connection.execute(
                "UPDATE portal_live_duels SET detail_json = ? WHERE id = ?",
                (json.dumps(detail, ensure_ascii=False), body.duel_id),
            )
            connection.commit()
        return {
            "ok": True,
            "status": status,
            "duel_id": body.duel_id,
            "seconds": detail.get("seconds") or 60,
            "questions": public_qs if status in ("active", "finished") else [],
            "progress": detail.get("progress") or {},
            "winner": detail.get("winner") or "",
            "correct_map": detail.get("correct_map") if status == "finished" else {},
            "review": review_items,
            "review_summary": review_summary,
            "score": (
                int(
                    ((detail.get("progress") or {}).get(session["student_nid"]) or {}).get(
                        "correct"
                    )
                    or 0
                )
                if status == "finished"
                else 0
            ),
            "total": len(review_items) if status == "finished" else 0,
            "xp_earned": (
                50
                if status == "finished" and detail.get("winner") == session["student_nid"]
                else 0
            ),
            "etec": "3-1-1-4",
            "etec_ar": "٣-١-١-٤",
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
def words_start(track: str = "lang", x_portal_token: str = Header(default="")):
    _require_student(x_portal_token)
    track = (track or "lang").strip().lower()
    if track not in ("lang", "quran", "mixed"):
        track = "lang"
    if track == "mixed":
        pool = list(WORD_BANK)
    else:
        pool = [w for w in WORD_BANK if w.get("track") == track] or list(WORD_BANK)
    rounds = []
    sample = random.sample(pool, k=min(12, len(pool)))
    kinds = ["meaning", "synonym", "antonym"]
    for i, item in enumerate(sample):
        kind = kinds[i % 3]
        same_track = [w for w in pool if w["word"] != item["word"]]
        if kind == "meaning":
            prompt = (
                f"ما معنى اللفظ القرآني «{item['word']}»؟"
                if item.get("track") == "quran"
                else f"ما معنى «{item['word']}»؟"
            )
            correct = item["meaning"]
            distractors = [w["meaning"] for w in same_track]
        elif kind == "synonym":
            prompt = f"مرادف «{item['word']}»:"
            correct = item["synonym"]
            distractors = [w["synonym"] for w in same_track]
        else:
            prompt = f"ضد «{item['word']}»:"
            correct = item["antonym"]
            distractors = [w["antonym"] for w in same_track]
        distractors = list(dict.fromkeys(distractors))
        opts = [correct] + random.sample(distractors, k=min(3, len(distractors)))
        while len(opts) < 4:
            opts.append(correct + "·")
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
                "track": item.get("track") or track,
                "etec": "3-1-1-1",
            }
        )
    return {
        "ok": True,
        "seconds": 60,
        "rounds": rounds,
        "track": track,
        "bank_size": len(pool),
        "etec": "3-1-1-1",
        "etec_ar": "٣-١-١-١",
    }


@router.get("/api/portal/games/challenge-tiers")
def challenge_tiers_catalog(x_portal_token: str = Header(default="")):
    _require_student(x_portal_token)
    from .nafs_challenge_tiers import taxonomy_snapshot

    return {"ok": True, **taxonomy_snapshot()}


@router.get("/api/portal/games/progress-pulse")
def progress_pulse(
    game: str = "words",
    limit: int = 7,
    x_portal_token: str = Header(default=""),
):
    """ملخص محاولات الطالب: ألعاب التأسيس أو امتداد challenges من السجلات الحقيقية."""
    session = _require_student(x_portal_token)
    from .nafs_endround_progress import build_progress_pulse, fetch_runs, is_challenge_game

    connection = connect()
    try:
        ensure_on_boot(connection)
        rows = fetch_runs(connection, session["student_nid"], game)
        pulse = build_progress_pulse(rows, limit=limit)
        g = (game or "words").strip().lower()
        if g.startswith("mental"):
            etec = "3-1-1-2"
        elif is_challenge_game(g):
            etec = "3-1-1-3"
        else:
            etec = "3-1-1-1"
        etec_ar = {"3-1-1-1": "٣-١-١-١", "3-1-1-2": "٣-١-١-٢", "3-1-1-3": "٣-١-١-٣"}.get(etec, "٣-١-١-١")
        return {
            "ok": True,
            "game": g,
            "etec": etec,
            "etec_ar": etec_ar,
            **pulse,
        }
    finally:
        connection.close()


@router.get("/api/portal/games/endround-context")
def endround_context(
    game: str = "words",
    accuracy: float | None = None,
    x_portal_token: str = Header(default=""),
):
    """حزمة المرحلة ٣–٤: أسطورة نافس + فارق القفزة + أعمدة تحدٍ عند الطلب."""
    session = _require_student(x_portal_token)
    from .nafs_endround_legend import build_endround_context
    from .nafs_endround_progress import build_progress_pulse, fetch_runs
    from .portal_session_api import _period_start

    connection = connect()
    try:
        ensure_on_boot(connection)
        rows = fetch_runs(connection, session["student_nid"], game)
        pulse = build_progress_pulse(rows, limit=7)
        ctx = build_endround_context(
            connection,
            student_nid=session["student_nid"],
            game=game,
            accuracy_pct=accuracy,
            attempts_asc=pulse.get("attempts") or [],
            period_start=_period_start("week"),
        )
        return {"ok": True, "game": (game or "words").strip().lower(), "progress_pulse": pulse, **ctx}
    finally:
        connection.close()


def _attach_progress_pulse(connection, student_nid: str, game: str, limit: int = 7) -> dict:
    from .nafs_endround_progress import build_progress_pulse, fetch_runs

    rows = fetch_runs(connection, student_nid, game)
    return build_progress_pulse(rows, limit=limit)


def _attach_endround_context(
    connection,
    student_nid: str,
    game: str,
    *,
    accuracy_pct: float | None = None,
    attempts_asc: list | None = None,
) -> dict:
    from .nafs_endround_legend import build_endround_context
    from .portal_session_api import _period_start

    return build_endround_context(
        connection,
        student_nid=student_nid,
        game=game,
        accuracy_pct=accuracy_pct,
        attempts_asc=attempts_asc or [],
        period_start=_period_start("week"),
    )


@router.post("/api/portal/games/words/finish")
def words_finish(body: WordFinishBody, x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        ensure_on_boot(connection)
        from .nafs_challenge_tiers import coaching_from_round, resolve_tier

        from .nafs_endround_review import review_from_game_answers

        score = sum(1 for a in body.answers if a.get("ok"))
        total = max(1, len(body.answers or []))
        xp = score * 3 + (5 if body.combo_best >= 3 else 0)
        # أغلب أنواع الجولة يحدد المستوى غير المباشر؛ وإلا معنى = هواة
        kinds = [str(a.get("kind") or "") for a in (body.answers or []) if a.get("kind")]
        kind = "meaning"
        if kinds:
            counts: dict[str, int] = {}
            for k in kinds:
                counts[k] = counts.get(k, 0) + 1
            kind = max(counts.items(), key=lambda kv: kv[1])[0]
        tier = resolve_tier(word_kind=kind, default="amateur")
        review_pack = review_from_game_answers(body.answers or [])
        connection.execute(
            """
            INSERT INTO portal_game_runs(student_nid, game_type, score, combo_best, detail_json, created_at)
            VALUES (?, 'words', ?, ?, ?, ?)
            """,
            (
                session["student_nid"],
                score,
                int(body.combo_best or 0),
                json.dumps(
                    {
                        "answers": body.answers,
                        "elapsed": body.elapsed_sec,
                        "tier": tier.get("id"),
                        "total": total,
                        "review": review_pack.get("items") or [],
                        "review_summary": {
                            "total": review_pack.get("total"),
                            "correct_count": review_pack.get("correct_count"),
                            "wrong_count": review_pack.get("wrong_count"),
                            "total_ar": review_pack.get("total_ar"),
                            "correct_count_ar": review_pack.get("correct_count_ar"),
                            "wrong_count_ar": review_pack.get("wrong_count_ar"),
                        },
                    },
                    ensure_ascii=False,
                ),
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
        coach = coaching_from_round(
            score=score,
            total=total,
            combo_best=int(body.combo_best or 0),
            elapsed_sec=float(body.elapsed_sec or 0),
            seconds_budget=60.0,
            tier_label=tier.get("label") or "",
        )
        pulse = _attach_progress_pulse(connection, session["student_nid"], "words")
        acc = round(100.0 * score / max(1, total), 1)
        ctx = _attach_endround_context(
            connection,
            session["student_nid"],
            "words",
            accuracy_pct=acc,
            attempts_asc=pulse.get("attempts") or [],
        )
        return {
            "ok": True,
            "score": score,
            "total": total,
            "xp_earned": xp,
            "combo_best": int(body.combo_best or 0),
            "elapsed_sec": float(body.elapsed_sec or 0),
            "seconds_budget": 60,
            "tier": tier,
            "coaching": coach,
            "progress_pulse": pulse,
            "endround": ctx,
            "review": review_pack.get("items") or [],
            "review_summary": {
                "total": review_pack.get("total"),
                "correct_count": review_pack.get("correct_count"),
                "wrong_count": review_pack.get("wrong_count"),
                "total_ar": review_pack.get("total_ar"),
                "correct_count_ar": review_pack.get("correct_count_ar"),
                "wrong_count_ar": review_pack.get("wrong_count_ar"),
            },
            "etec": "3-1-1-1",
            "etec_ar": "٣-١-١-١",
        }
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
def mental_start(
    level: int = 1,
    count: int = 10,
    tier: str = "",
    x_portal_token: str = Header(default=""),
):
    _require_student(x_portal_token)
    from .nafs_challenge_tiers import TIER_TO_MENTAL_LEVEL, resolve_tier, tier_by_id

    if tier in TIER_TO_MENTAL_LEVEL:
        level = int(TIER_TO_MENTAL_LEVEL[tier])
    level = max(1, min(5, int(level or 1)))
    tier_meta = resolve_tier(mental_level=level)
    items = [_mental_item(level) for _ in range(max(5, min(20, count)))]
    for i, it in enumerate(items):
        it["id"] = i + 1
        it["tier"] = tier_meta.get("id")
    return {
        "ok": True,
        "level": level,
        "tier": tier_meta,
        "tiers": [tier_by_id(t) for t in ("amateur", "pro", "elite")],
        "seconds": 90 if level >= 3 else 60,
        "items": items,
        "etec": "3-1-1-2",
        "etec_ar": "٣-١-١-٢",
        "modes": {"solo": "تسلق المستويات", "tournament": "بطولة الفصول"},
    }


@router.post("/api/portal/games/mental/finish")
def mental_finish(body: MentalFinishBody, x_portal_token: str = Header(default="")):
    session = _require_student(x_portal_token)
    connection = connect()
    try:
        ensure_on_boot(connection)
        from .nafs_challenge_tiers import coaching_from_round, resolve_tier

        from .nafs_endround_review import review_from_game_answers

        score = sum(1 for a in body.answers if a.get("ok"))
        total = max(1, len(body.answers or []))
        level = max(1, min(5, int(body.level or 1)))
        xp = score * 2 + (level * 2)
        tier = resolve_tier(mental_level=level)
        budget = 90.0 if level >= 3 else 60.0
        review_pack = review_from_game_answers(body.answers or [])
        connection.execute(
            """
            INSERT INTO portal_game_runs(student_nid, game_type, score, combo_best, detail_json, created_at)
            VALUES (?, ?, ?, 0, ?, ?)
            """,
            (
                session["student_nid"],
                f"mental:{body.mode}:{level}",
                score,
                json.dumps(
                    {
                        "answers": body.answers,
                        "elapsed": body.elapsed_sec,
                        "mode": body.mode,
                        "tier": tier.get("id"),
                        "total": total,
                        "level": level,
                        "review": review_pack.get("items") or [],
                        "review_summary": {
                            "total": review_pack.get("total"),
                            "correct_count": review_pack.get("correct_count"),
                            "wrong_count": review_pack.get("wrong_count"),
                            "total_ar": review_pack.get("total_ar"),
                            "correct_count_ar": review_pack.get("correct_count_ar"),
                            "wrong_count_ar": review_pack.get("wrong_count_ar"),
                        },
                    },
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
        coach = coaching_from_round(
            score=score,
            total=total,
            combo_best=0,
            elapsed_sec=float(body.elapsed_sec or 0),
            seconds_budget=budget,
            tier_label=tier.get("label") or "",
        )
        pulse = _attach_progress_pulse(connection, session["student_nid"], "mental")
        acc = round(100.0 * score / max(1, total), 1)
        ctx = _attach_endround_context(
            connection,
            session["student_nid"],
            "mental",
            accuracy_pct=acc,
            attempts_asc=pulse.get("attempts") or [],
        )
        return {
            "ok": True,
            "score": score,
            "total": total,
            "xp_earned": xp,
            "combo_best": 0,
            "elapsed_sec": float(body.elapsed_sec or 0),
            "seconds_budget": int(budget),
            "level": level,
            "tier": tier,
            "coaching": coach,
            "progress_pulse": pulse,
            "endround": ctx,
            "review": review_pack.get("items") or [],
            "review_summary": {
                "total": review_pack.get("total"),
                "correct_count": review_pack.get("correct_count"),
                "wrong_count": review_pack.get("wrong_count"),
                "total_ar": review_pack.get("total_ar"),
                "correct_count_ar": review_pack.get("correct_count_ar"),
                "wrong_count_ar": review_pack.get("wrong_count_ar"),
            },
            "etec": "3-1-1-2",
            "etec_ar": "٣-١-١-٢",
        }
    finally:
        connection.close()
