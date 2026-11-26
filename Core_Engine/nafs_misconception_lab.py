# مرصد الأخطاء الشائعة + حقيبة المراجعة الذهبية + بيانات الجذر التراكمي (الوحدة ١ بعد #47).
from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect

router = APIRouter(tags=["nafs-misconception"])

EASTERN = "٠١٢٣٤٥٦٧٨٩"


def _e(value) -> str:
    return "".join(EASTERN[int(c)] if c.isdigit() else ("٪" if c == "%" else c) for c in str(value))


def _iso(dt: datetime | None = None) -> str:
    return (dt or datetime.now(timezone.utc)).replace(microsecond=0).isoformat()


# جذور مهارية افتراضية حسب المجال/المهارة (١م / ٢م / ٣م)
SKILL_ROOTS = {
    "الجبر": "٢م",
    "الأعداد": "١م",
    "الهندسة": "٢م",
    "الإحصاء": "٢م",
    "النسب": "١م",
    "العلوم الفيزيائية": "٢م",
    "العلوم الكيميائية": "٢م",
    "علوم الحياة": "١م",
    "الأرض والفضاء": "١م",
    "القياس": "١م",
    "دلالات الألفاظ": "١م",
    "الفهم الحرفي": "١م",
    "الفهم الاستنتاجي": "٢م",
    "الفهم الناقد": "٣م",
    "التذوق": "٣م",
}

# قواعد ذهبية + خطأ شائع حسب المهارة
SKILL_TRAPS = {
    "الجبر": (
        "عند ضرب وحيدات الحد: نضرب المعاملات ونجمع الأسس (مثل س³×س² = س⁵)، ولا نضرب الأسس.",
        "ضرب الأسس بدل جمعها (مثل ٣×٢ بدل ٣+٢).",
    ),
    "الأعداد": (
        "القيمة المطلقة دائماً ≥ ٠؛ والنسبة المئوية = الجزء÷الكل ×١٠٠٪.",
        "نسيان إشارة السالب أو تحويل خاطئ للكسر إلى نسبة.",
    ),
    "الهندسة": (
        "في المثلث القائم: أ² + ب² = ج² (ج هو الوتر).",
        "جمع الضلعين بدل الجذر، أو الخلط بين المحيط والمساحة.",
    ),
    "الإحصاء": (
        "الوسط = المجموع÷العدد؛ الاحتمال = الملائم÷الممكن.",
        "خلط الوسط بالوسيط أو نسيان ترتيب البيانات قبل الوسيط.",
    ),
    "النسب": (
        "التناسب الطردي: س١/ص١ = س٢/ص٢ مع ثبات الوحدات؛ إن زادت س زادت ص بنفس النسبة.",
        "عكس النسبة أو نسيان وحدة القياس.",
    ),
    "العلوم الفيزيائية": (
        "ق = ك×ت ؛ ض = ق/م ؛ راقب الوحدات دائماً.",
        "الخلط بين القوة والطاقة أو الضغط والقوة.",
    ),
    "العلوم الكيميائية": (
        "العدد الذري = البروتونات؛ والتفاعل يكوّن مادة جديدة.",
        "الخلط بين التغير الفيزيائي والكيميائي أو العدد الكتلي والذري.",
    ),
    "علوم الحياة": (
        "المنتجات تصنع الغذاء؛ المحللات تعيد المغذيات.",
        "عكس السلسلة الغذائية أو تجاهل دور المحللات.",
    ),
    "الأرض والفضاء": (
        "الفصول بسبب ميل المحور؛ والمد بسبب جاذبية القمر.",
        "اعتبار الفصول ناتجة عن قرب الشمس فقط.",
    ),
    "القياس": (
        "حوّل الوحدات قبل الحساب (كيلو=١٠٠٠).",
        "خلط المللتر باللتر أو المتر بالسنتيمتر.",
    ),
    "دلالات الألفاظ": (
        "المعنى من السياق لا من الكلمة المعزولة فقط.",
        "اختيار مرادف شكلي دون مراعاة السياق.",
    ),
    "الفهم الحرفي": (
        "الإجابة مذكورة صراحة في النص.",
        "القفز إلى الاستنتاج قبل التأكد من النص.",
    ),
    "الفهم الاستنتاجي": (
        "استخرج الضمني من القرائن دون إضافة معلومات خارجية.",
        "تحميل النص معنىً غير مدعوم.",
    ),
    "الفهم الناقد": (
        "ميّز ما ينسجم مع رسالة النص وما يناقضها.",
        "قبول كل الآراء دون معيار النص.",
    ),
    "التذوق": (
        "الصورة البلاغية تخدم المعنى والعاطفة معاً.",
        "الاكتفاء بالتعريف الشكلي للتشبيه.",
    ),
}

GOLDEN_DECK = [
    # رياضيات — أخضر
    {"id": "m1", "domain": "math", "title": "نظرية فيثاغورس", "front": "نظرية فيثاغورس", "back": "في المثلث القائم: أ² + ب² = ج² حيث ج الوتر. مثال: ٣-٤-٥.", "xp": 5},
    {"id": "m2", "domain": "math", "title": "ضرب وحيدات الحد", "front": "ضرب وحيدات الحد", "back": "نضرب المعاملات ونجمع الأسس: (٢ص³)(٣ص²)=٦ص⁵.", "xp": 5},
    {"id": "m3", "domain": "math", "title": "النسبة المئوية", "front": "النسبة المئوية", "back": "الجزء ÷ الكل × ١٠٠٪. مثال: ١٥٪ من ٢٠٠ = ٣٠.", "xp": 5},
    {"id": "m4", "domain": "math", "title": "المعادلة الخطية", "front": "حل معادلة خطية", "back": "اعزل المجهول بعمليات عكسية متوازنة على الطرفين.", "xp": 5},
    {"id": "m5", "domain": "math", "title": "القيمة المطلقة", "front": "القيمة المطلقة", "back": "|س| ≥ ٠ دائماً. |−٨| = ٨.", "xp": 5},
    {"id": "m6", "domain": "math", "title": "مساحة ومحيط", "front": "المساحة والمحيط", "back": "محيط المربع ٤×ض؛ مساحة المستطيل ط×ع.", "xp": 5},
    {"id": "m7", "domain": "math", "title": "الوسط والوسيط", "front": "الوسط والوسيط", "back": "الوسط متوسط حسابي؛ الوسيط قيمة وسطى بعد الترتيب.", "xp": 5},
    {"id": "m8", "domain": "math", "title": "التناسب الطردي", "front": "التناسب الطردي", "back": "إذا تناسب س و ص طردياً: س١/ص١ = س٢/ص٢؛ تزداد ص بزيادة س بنفس النسبة مع ثبات الوحدات.", "xp": 5},
    # علوم — تركوازي
    {"id": "s1", "domain": "science", "title": "ضبط المتغيرات", "front": "ضبط المتغيرات", "back": "مستقل يُغيَّر، تابع يُقاس، ثابت يُضبط.", "xp": 5},
    {"id": "s2", "domain": "science", "title": "ق = ك×ت", "front": "قانون نيوتن الثاني", "back": "القوة المحصلة = الكتلة × التسارع (نيوتن).", "xp": 5},
    {"id": "s3", "domain": "science", "title": "دورة الماء", "front": "دورة الماء", "back": "تبخر ← تكاثف ← هطول.", "xp": 5},
    {"id": "s4", "domain": "science", "title": "العدد الذري", "front": "العدد الذري", "back": "يساوي عدد البروتونات ويحدد هوية العنصر.", "xp": 5},
    # قراءة — عنابي
    {"id": "r1", "domain": "reading", "title": "القراءة الحرفية", "front": "الفهم الحرفي", "back": "أجب بما هو مذكور صراحة دون زيادة.", "xp": 5},
    {"id": "r2", "domain": "reading", "title": "القراءة الاستنتاجية", "front": "الفهم الاستنتاجي", "back": "اربط القرائن لاستخراج معنى ضمني مدعوم.", "xp": 5},
    {"id": "r3", "domain": "reading", "title": "القراءة الناقدة", "front": "الفهم الناقد", "back": "احكم على الأفكار وفق رسالة النص ومنطقه.", "xp": 5},
    {"id": "r4", "domain": "reading", "title": "الاستفهام المنفي", "front": "الاستفهام المنفي", "back": "بعد استفهام منفي: «بلى» للإثبات (نقض النفي)، و«نعم» لتأكيد النفي. مثال: ألم تدرس؟ بلى (أي درست).", "xp": 5},
    {"id": "r5", "domain": "reading", "title": "دلالات السياق", "front": "دلالات الألفاظ", "back": "المعنى الأدق من سياق الجملة لا من القاموس وحده.", "xp": 5},
]

ETEC_INDICATORS = {
    "reading": {"code": "3-1-1-1", "code_ar": "٣-١-١-١", "label": "القراءة"},
    "math": {"code": "3-1-1-2", "code_ar": "٣-١-١-٢", "label": "الرياضيات"},
    "science": {"code": "3-1-1-3", "code_ar": "٣-١-١-٣", "label": "العلوم"},
}

SCHEMA_EXTRA = """
CREATE TABLE IF NOT EXISTS portal_misconception_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_nid TEXT NOT NULL DEFAULT '',
    question_id INTEGER NOT NULL DEFAULT 0,
    domain TEXT NOT NULL DEFAULT '',
    skill TEXT NOT NULL DEFAULT '',
    chosen TEXT NOT NULL DEFAULT '',
    correct TEXT NOT NULL DEFAULT '',
    trap_key TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_portal_misc_week ON portal_misconception_events(created_at, domain);

CREATE TABLE IF NOT EXISTS portal_golden_mastery (
    student_nid TEXT NOT NULL,
    card_id TEXT NOT NULL,
    xp_awarded INTEGER NOT NULL DEFAULT 5,
    mastered_at TEXT NOT NULL,
    PRIMARY KEY(student_nid, card_id)
);
"""


def ensure_question_columns(connection) -> None:
    cols = {row[1] for row in connection.execute("PRAGMA table_info(nafs_question_bank)")}
    if "common_mistake" not in cols:
        connection.execute(
            "ALTER TABLE nafs_question_bank ADD COLUMN common_mistake TEXT NOT NULL DEFAULT ''"
        )
    if "grade_root" not in cols:
        connection.execute(
            "ALTER TABLE nafs_question_bank ADD COLUMN grade_root TEXT NOT NULL DEFAULT ''"
        )
    if "golden_rule" not in cols:
        connection.execute(
            "ALTER TABLE nafs_question_bank ADD COLUMN golden_rule TEXT NOT NULL DEFAULT ''"
        )


def enrich_question_traps(connection) -> int:
    """تعبئة common_mistake / grade_root / golden_rule للأسئلة الفارغة."""
    ensure_question_columns(connection)
    rows = connection.execute(
        """
        SELECT id, domain, skill, common_mistake, grade_root, golden_rule
        FROM nafs_question_bank WHERE COALESCE(active,1)=1
        """
    ).fetchall()
    updated = 0
    for row in rows:
        qid, domain, skill, mistake, root, rule = row
        skill = (skill or "").strip()
        trap = SKILL_TRAPS.get(skill) or (
            "راجع القاعدة الأساسية للمجال ثم استبعد الخيارات المتناقضة.",
            "الاستعجال دون قراءة المعطيات.",
        )
        new_rule, new_mistake = trap
        new_root = root or SKILL_ROOTS.get(skill) or "٣م"
        new_mistake = mistake or new_mistake
        new_rule = rule or new_rule
        if (mistake, root, rule) != (new_mistake, new_root, new_rule):
            connection.execute(
                """
                UPDATE nafs_question_bank
                SET common_mistake = ?, grade_root = ?, golden_rule = ?
                WHERE id = ?
                """,
                (new_mistake, new_root, new_rule, qid),
            )
            updated += 1
    return updated


def build_trap_album() -> list[dict]:
    """ألبوم ٦٦ فخاً فريداً (٢٢ لكل مجال) مع مثال الخطأ والصواب."""
    from .nafs_trap_bank_66 import build_unique_trap_album

    return build_unique_trap_album()


def ensure_on_boot(connection) -> dict:
    connection.executescript(SCHEMA_EXTRA)
    ensure_question_columns(connection)
    n = enrich_question_traps(connection)
    return {"ok": True, "enriched": n, "traps": 66, "golden_cards": len(GOLDEN_DECK)}


class TrapEventBody(BaseModel):
    question_id: int = 0
    domain: str = ""
    skill: str = ""
    chosen: str = ""
    correct: str = ""


class MasteryBody(BaseModel):
    card_id: str = ""


class RescueBody(BaseModel):
    run_id: int = 0
    domain: str = "math"
    skill: str = ""
    grade_root: str = ""


def _portal_student(token: str) -> dict:
    from .portal_session_api import _require_portal

    return _require_portal(token, ("student",))


@router.get("/api/portal/misconceptions/album")
def misconceptions_album(x_portal_token: str = Header(default="")):
    _portal_student(x_portal_token)
    album = build_trap_album()
    doors = {
        "math": [t for t in album if t["domain"] == "math"],
        "science": [t for t in album if t["domain"] == "science"],
        "reading": [t for t in album if t["domain"] == "reading"],
    }
    return {"ok": True, "total": 66, "doors": doors, "indicators": ETEC_INDICATORS}


@router.get("/api/portal/golden-deck")
def golden_deck(x_portal_token: str = Header(default="")):
    session = _portal_student(x_portal_token)
    connection = connect()
    try:
        connection.executescript(SCHEMA_EXTRA)
        mastered = {
            r[0]
            for r in connection.execute(
                "SELECT card_id FROM portal_golden_mastery WHERE student_nid = ?",
                (session["student_nid"],),
            )
        }
        cards = [{**c, "mastered": c["id"] in mastered} for c in GOLDEN_DECK]
        return {"ok": True, "cards": cards, "mastered_count": len(mastered)}
    finally:
        connection.close()


@router.post("/api/portal/golden-deck/master")
def golden_master(body: MasteryBody, x_portal_token: str = Header(default="")):
    session = _portal_student(x_portal_token)
    card = next((c for c in GOLDEN_DECK if c["id"] == body.card_id), None)
    if not card:
        raise HTTPException(status_code=404, detail="بطاقة غير موجودة.")
    connection = connect()
    try:
        connection.executescript(SCHEMA_EXTRA)
        exists = connection.execute(
            "SELECT 1 FROM portal_golden_mastery WHERE student_nid = ? AND card_id = ?",
            (session["student_nid"], body.card_id),
        ).fetchone()
        xp = 0
        if not exists:
            connection.execute(
                """
                INSERT INTO portal_golden_mastery(student_nid, card_id, xp_awarded, mastered_at)
                VALUES (?, ?, ?, ?)
                """,
                (session["student_nid"], body.card_id, card["xp"], _iso()),
            )
            connection.execute(
                """
                INSERT INTO portal_xp_ledger(student_nid, event_type, xp, meta_json, created_at)
                VALUES (?, 'golden_deck', ?, ?, ?)
                """,
                (
                    session["student_nid"],
                    card["xp"],
                    json.dumps({"card_id": body.card_id}, ensure_ascii=False),
                    _iso(),
                ),
            )
            xp = card["xp"]
            try:
                from .nafs_counsel_boost import apply_golden_boost

                boost = apply_golden_boost(connection, session["student_nid"], body.card_id)
            except Exception:
                boost = None
        else:
            boost = None
        connection.commit()
        return {
            "ok": True,
            "xp_earned": xp,
            "card_id": body.card_id,
            "behavior_award": (boost or {}).get("award"),
            "behavior_totals": (boost or {}).get("behavior_totals"),
            "cafeteria_voucher": (boost or {}).get("cafeteria_voucher"),
        }
    finally:
        connection.close()


@router.post("/api/portal/misconceptions/event")
def record_misconception(body: TrapEventBody, x_portal_token: str = Header(default="")):
    session = _portal_student(x_portal_token)
    connection = connect()
    try:
        connection.executescript(SCHEMA_EXTRA)
        ensure_question_columns(connection)
        skill = body.skill
        domain = body.domain
        mistake = ""
        rule = ""
        root = ""
        if body.question_id:
            row = connection.execute(
                """
                SELECT domain, skill, common_mistake, golden_rule, grade_root
                FROM nafs_question_bank WHERE id = ?
                """,
                (body.question_id,),
            ).fetchone()
            if row:
                domain = domain or row[0] or ""
                skill = skill or row[1] or ""
                mistake = row[2] or ""
                rule = row[3] or ""
                root = row[4] or ""
        if not mistake:
            trap = SKILL_TRAPS.get(skill) or ("راجع القاعدة.", "خطأ شائع في المهارة.")
            rule, mistake = trap
            root = root or SKILL_ROOTS.get(skill, "٣م")
        connection.execute(
            """
            INSERT INTO portal_misconception_events(
              student_nid, question_id, domain, skill, chosen, correct, trap_key, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session["student_nid"],
                body.question_id,
                domain,
                skill,
                (body.chosen or "").upper(),
                (body.correct or "").upper(),
                skill or domain,
                _iso(),
            ),
        )
        connection.commit()
        return {
            "ok": True,
            "card": {
                "title": "احذر الفخ!",
                "common_mistake": mistake,
                "golden_rule": rule,
                "grade_root": root or SKILL_ROOTS.get(skill, "٣م"),
                "domain": domain,
                "skill": skill,
                "etec": ETEC_INDICATORS.get(domain, {}),
            },
        }
    finally:
        connection.close()


@router.post("/api/portal/misconceptions/rescue")
def rescue_question(body: RescueBody, x_portal_token: str = Header(default="")):
    """تمرين علاجي على الجذر التراكمي أو نظير رقمي فوري لاستعادة نصف النقاط."""
    session = _portal_student(x_portal_token)
    from .portal_parametric import generate_parametric_batch

    connection = connect()
    try:
        domain = (body.domain or "math").lower()
        if domain not in ("math", "science", "reading"):
            domain = "math"
        skill = (body.skill or "").strip()
        root = (body.grade_root or "").strip() or SKILL_ROOTS.get(skill, "٣م")
        q = None
        # أولوية: سؤال من البنك على نفس المهارة + الجذر التراكمي (١م/٢م)
        try:
            ensure_question_columns(connection)
            row = connection.execute(
                """
                SELECT id, domain, skill, stem, choice_a, choice_b, choice_c, choice_d,
                       correct, rationale, common_mistake, grade_root, golden_rule
                FROM nafs_question_bank
                WHERE COALESCE(active,1)=1
                  AND domain = ?
                  AND (? = '' OR skill = ?)
                  AND (? = '' OR grade_root = ?)
                ORDER BY RANDOM()
                LIMIT 1
                """,
                (domain, skill, skill, root, root),
            ).fetchone()
            if not row and root in ("١م", "٢م", "1م", "2م"):
                row = connection.execute(
                    """
                    SELECT id, domain, skill, stem, choice_a, choice_b, choice_c, choice_d,
                           correct, rationale, common_mistake, grade_root, golden_rule
                    FROM nafs_question_bank
                    WHERE COALESCE(active,1)=1
                      AND domain = ?
                      AND grade_root = ?
                    ORDER BY RANDOM()
                    LIMIT 1
                    """,
                    (domain, root),
                ).fetchone()
            if row:
                correct = (row[8] or "A").strip().upper()[:1] or "A"
                q = {
                    "id": int(row[0]),
                    "domain": row[1] or domain,
                    "skill": row[2] or skill,
                    "stem": row[3] or "",
                    "choices": {
                        "A": row[4] or "",
                        "B": row[5] or "",
                        "C": row[6] or "",
                        "D": row[7] or "",
                    },
                    "correct": correct,
                    "rationale": row[9] or "",
                    "common_mistake": row[10] or "",
                    "grade_root": row[11] or root,
                    "golden_rule": row[12] or "",
                    "from_bank": True,
                }
        except Exception:
            q = None
        if not q:
            gen_domain = domain if domain in ("math", "science") else "math"
            generated = generate_parametric_batch(1, domains=[gen_domain])
            q = generated[0]
            q["id"] = -9000 - abs(hash((session["student_nid"], body.run_id, skill, root)) % 1000)
            q["skill"] = skill or q.get("skill") or ""
            q["grade_root"] = root
            q["from_bank"] = False
        q["rescue"] = True
        q["half_xp"] = True
        q["grade_root"] = q.get("grade_root") or root
        if body.run_id:
            row = connection.execute(
                "SELECT detail_json FROM portal_challenge_runs WHERE id = ? AND student_nid = ?",
                (body.run_id, session["student_nid"]),
            ).fetchone()
            if row:
                detail = json.loads(row[0] or "{}")
                cmap = detail.setdefault("correct_map", {})
                cmap[str(q["id"])] = q["correct"]
                full = detail.setdefault("questions_full", {})
                full[str(q["id"])] = {
                    "stem": q.get("stem") or "",
                    "rationale": q.get("rationale") or "",
                    "choices": q.get("choices") or {},
                    "parametric": not q.get("from_bank"),
                    "rescue": True,
                    "domain": q.get("domain") or domain,
                    "skill": q.get("skill") or skill,
                    "grade_root": q.get("grade_root") or root,
                    "common_mistake": q.get("common_mistake") or "",
                    "golden_rule": q.get("golden_rule") or "",
                }
                connection.execute(
                    "UPDATE portal_challenge_runs SET detail_json = ? WHERE id = ?",
                    (json.dumps(detail, ensure_ascii=False), body.run_id),
                )
                connection.commit()
        root_msg = {
            "١م": "تمرين علاجي على جذر الصف الأول متوسط — أجب صح لاستعادة نصف النقاط.",
            "٢م": "تمرين علاجي على جذر الصف الثاني متوسط — أجب صح لاستعادة نصف النقاط.",
            "1م": "تمرين علاجي على جذر الصف الأول متوسط — أجب صح لاستعادة نصف النقاط.",
            "2م": "تمرين علاجي على جذر الصف الثاني متوسط — أجب صح لاستعادة نصف النقاط.",
        }.get(root, "أجب صح لاستعادة نصف نقاط السؤال.")
        return {
            "ok": True,
            "question": {
                "id": q["id"],
                "domain": q.get("domain") or domain,
                "skill": q.get("skill") or skill,
                "stem": q["stem"],
                "choices": q["choices"],
                "rescue": True,
                "half_xp": True,
                "grade_root": q.get("grade_root") or root,
            },
            "grade_root": q.get("grade_root") or root,
            "message": root_msg,
        }
    finally:
        connection.close()


@router.get("/api/session/nafs/misconceptions/top")
def nafs_top_misconceptions(x_session_token: str = Header(default="")):
    """أكثر ٥ أخطاء شائعة أسبوعياً لكل مؤشر ETEC."""
    from .access import require_user

    try:
        require_user(str(x_session_token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    connection = connect()
    try:
        connection.executescript(SCHEMA_EXTRA)
        ensure_question_columns(connection)
        enrich_question_traps(connection)
        since = _iso(datetime.now(timezone.utc) - timedelta(days=7))
        by_domain: dict[str, list] = {"math": [], "reading": [], "science": []}
        for domain in by_domain:
            rows = connection.execute(
                """
                SELECT skill, COUNT(*) AS c
                FROM portal_misconception_events
                WHERE domain = ? AND created_at >= ?
                GROUP BY skill
                ORDER BY c DESC
                LIMIT 5
                """,
                (domain, since),
            ).fetchall()
            if not rows:
                # احتياطي من بنك الأسئلة إن لم تُسجَّل أحداث بعد
                skills = connection.execute(
                    """
                    SELECT skill, common_mistake, golden_rule, grade_root, COUNT(*) AS c
                    FROM nafs_question_bank
                    WHERE domain = ? AND COALESCE(active,1)=1 AND trim(skill) != ''
                    GROUP BY skill
                    ORDER BY c DESC
                    LIMIT 5
                    """,
                    (domain,),
                ).fetchall()
                total = sum(int(r[4] or 0) for r in skills) or 1
                by_domain[domain] = [
                    {
                        "skill": r[0],
                        "common_mistake": r[1],
                        "golden_rule": r[2],
                        "grade_root": r[3],
                        "count": int(r[4] or 0),
                        "pct": round(100.0 * int(r[4] or 0) / total, 1),
                        "source": "bank_fallback",
                    }
                    for r in skills
                ]
            else:
                total = sum(int(r[1] or 0) for r in rows) or 1
                enriched = []
                for skill, count in rows:
                    trap = SKILL_TRAPS.get(skill) or ("راجع القاعدة.", "خطأ شائع.")
                    rule, mistake = trap
                    qrow = connection.execute(
                        """
                        SELECT common_mistake, golden_rule, grade_root
                        FROM nafs_question_bank
                        WHERE domain = ? AND skill = ? AND trim(common_mistake) != ''
                        LIMIT 1
                        """,
                        (domain, skill),
                    ).fetchone()
                    enriched.append(
                        {
                            "skill": skill,
                            "common_mistake": (qrow[0] if qrow else "") or mistake,
                            "golden_rule": (qrow[1] if qrow else "") or rule,
                            "grade_root": (qrow[2] if qrow else "") or SKILL_ROOTS.get(skill, "٣م"),
                            "count": int(count),
                            "pct": round(100.0 * int(count) / total, 1),
                            "source": "events",
                        }
                    )
                by_domain[domain] = enriched
        connection.commit()
        return {
            "ok": True,
            "week_start": since,
            "indicators": ETEC_INDICATORS,
            "top": by_domain,
        }
    finally:
        connection.close()


@router.get("/api/session/nafs/national-pack")
def national_pack(x_session_token: str = Header(default="")):
    """حزمة المحاكاة الوطنية ٦٦ سؤالاً للطباعة (كراسة + OMR + مفتاح)."""
    from .access import require_user
    from .nafs_question_bank_seed import ensure_nafs_question_bank

    try:
        require_user(str(x_session_token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    connection = connect()
    try:
        ensure_nafs_question_bank(connection)
        ensure_question_columns(connection)
        pack = {}
        for domain, label in (("math", "رياضيات"), ("science", "علوم"), ("reading", "قراءة ولغتي")):
            rows = connection.execute(
                """
                SELECT id, skill, stem, choice_a, choice_b, choice_c, choice_d, correct,
                       rationale, common_mistake, grade_root
                FROM nafs_question_bank
                WHERE domain = ? AND COALESCE(active,1)=1
                ORDER BY RANDOM() LIMIT 22
                """,
                (domain,),
            ).fetchall()
            pack[domain] = {
                "label": label,
                "etec": ETEC_INDICATORS[domain],
                "items": [
                    {
                        "id": r[0],
                        "skill": r[1],
                        "stem": r[2],
                        "choices": {"A": r[3], "B": r[4], "C": r[5], "D": r[6]},
                        "correct": (r[7] or "A").upper(),
                        "rationale": r[8] or "",
                        "common_mistake": r[9] or "",
                        "grade_root": r[10] or "",
                    }
                    for r in rows
                ],
            }
        connection.commit()
        return {
            "ok": True,
            "title": "المحاكاة الوطنية الشاملة",
            "total": 66,
            "minutes": 90,
            "domains": pack,
        }
    finally:
        connection.close()
