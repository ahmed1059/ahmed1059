# التقويم الذاتي المدرسي (SSOT) — الوحدة 2-أ: رصد ذاتي + شواهد حية قرائية.
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .database import connect

router = APIRouter(tags=["accreditation-self"])

SELF_LEVELS = {
    1: "التهيئة",
    2: "الانطلاق",
    3: "التقدم",
    4: "التميز",
}

COMMITTEE_TITLES = {
    "admin": "اللجنة الإدارية",
    "guidance": "لجنة التوجيه والإرشاد",
    "achievement": "لجنة التحصيل الدراسي",
    "excellence": "لجنة التميز والجودة",
    "fund": "فريق عمل الصندوق المدرسي",
    "budget": "لجنة الميزانية التشغيلية",
    "safety": "فريق عمل الأمن والسلامة المدرسية",
    "activity": "لجنة النشاط الطلابي",
    "discipline": "لجنة الانضباط المدرسي",
    "special": "لجنة التربية الخاصة",
}


class SelfRatingBody(BaseModel):
    cycle_id: int = 0
    indicator_code: str = ""
    level: int = Field(default=0, ge=0, le=4)
    note: str = ""


def _stamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _user(token: str) -> dict:
    from .access import require_user

    try:
        return require_user(str(token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _leadership(token: str) -> dict:
    user = _user(token)
    role = str(user.get("role") or "")
    if role.startswith("مدير") or "وكيل" in role:
        return user
    raise HTTPException(status_code=403, detail="التقويم الذاتي المدرسي للمدير والوكيل")


def ensure_accreditation_self_tables(connection) -> None:
    columns = {row[1] for row in connection.execute("PRAGMA table_info(evaluation_indicators)")}
    if columns and "score_percent" not in columns:
        connection.execute(
            "ALTER TABLE evaluation_indicators ADD COLUMN score_percent TEXT"
        )
    if columns and "recommendation" not in columns:
        connection.execute(
            "ALTER TABLE evaluation_indicators ADD COLUMN recommendation TEXT"
        )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS accred_self_ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cycle_id INTEGER NOT NULL,
            indicator_code TEXT NOT NULL,
            level INTEGER NOT NULL DEFAULT 0,
            note TEXT NOT NULL DEFAULT '',
            updated_by TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL,
            UNIQUE (cycle_id, indicator_code),
            FOREIGN KEY (cycle_id) REFERENCES evaluation_cycles(id)
        )
        """
    )


def ensure_on_boot(connection) -> None:
    ensure_accreditation_self_tables(connection)


def _resolve_cycle(connection, cycle_id: int = 0) -> dict | None:
    if cycle_id:
        row = connection.execute(
            """
            SELECT id, title, academic_year, overall_score, overall_level, source_note
            FROM evaluation_cycles WHERE id = ?
            """,
            (cycle_id,),
        ).fetchone()
        if row:
            return {
                "id": int(row[0]),
                "title": row[1] or "",
                "academic_year": row[2] or "",
                "overall_score": row[3] or "",
                "overall_level": row[4] or "",
                "source_note": row[5] or "",
            }
    preferred = connection.execute(
        """
        SELECT id, title, academic_year, overall_score, overall_level, source_note
        FROM evaluation_cycles
        WHERE academic_year LIKE '%1448%'
        ORDER BY id DESC
        LIMIT 1
        """
    ).fetchone()
    if not preferred:
        preferred = connection.execute(
            """
            SELECT c.id, c.title, c.academic_year, c.overall_score, c.overall_level, c.source_note
            FROM evaluation_cycles c
            WHERE EXISTS (
                SELECT 1 FROM evaluation_indicators i WHERE i.cycle_id = c.id
            )
            ORDER BY c.id DESC
            LIMIT 1
            """
        ).fetchone()
    if not preferred:
        return None
    return {
        "id": int(preferred[0]),
        "title": preferred[1] or "",
        "academic_year": preferred[2] or "",
        "overall_score": preferred[3] or "",
        "overall_level": preferred[4] or "",
        "source_note": preferred[5] or "",
    }


def _code_key(code: str) -> tuple:
    parts = []
    for bit in str(code or "").split("-"):
        try:
            parts.append(int(bit))
        except ValueError:
            parts.append(bit)
    return tuple(parts)


def _dedupe(items: list[dict]) -> list[dict]:
    seen = set()
    out = []
    for item in items:
        key = (
            str(item.get("source_kind") or ""),
            str(item.get("source_id") or ""),
            str(item.get("title") or ""),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def _committee_ids_for_code(code: str) -> list[str]:
    if code.startswith("4-2") or code.startswith("4-1"):
        return ["safety", "admin"]
    if code.startswith("3-2"):
        return ["guidance", "activity", "discipline", "special"]
    if code.startswith("3-1"):
        return ["achievement", "excellence"]
    if code.startswith("2-"):
        return ["achievement", "excellence", "admin"]
    if code.startswith("1-3"):
        return ["guidance", "admin", "activity"]
    if code.startswith("1-4"):
        return ["excellence", "admin"]
    if code.startswith("1-2"):
        return ["admin", "excellence", "achievement"]
    if code.startswith("1-"):
        return ["admin", "excellence", "budget", "fund"]
    return ["admin", "excellence"]


def gather_live_evidence(connection, code: str) -> list[dict]:
    """تجميع قرائي من SSOT دون فرض درجة ذاتية."""
    code = str(code or "").strip()
    items: list[dict] = []

    committee_ids = _committee_ids_for_code(code)
    for cid in committee_ids:
        count = connection.execute(
            "SELECT COUNT(*) FROM committee_seat WHERE committee_id = ?",
            (cid,),
        ).fetchone()[0]
        if not count:
            continue
        items.append(
            {
                "source_kind": "committee",
                "source_id": cid,
                "title": COMMITTEE_TITLES.get(cid, cid),
                "summary": f"تشكيل محفوظ · {count} مقعداً",
                "date": "",
            }
        )

    if code.startswith("2-") or code.startswith("1-2") or code.startswith("3-1"):
        visits = connection.execute(
            """
            SELECT id, teacher_name, visit_type, total, band, visit_date, visit_date_hijri, indicator
            FROM classroom_visits
            WHERE total IS NOT NULL AND CAST(total AS REAL) > 0
            ORDER BY id DESC
            LIMIT 8
            """
        ).fetchall()
        for row in visits:
            date_bit = row[6] or row[5] or ""
            total = row[3]
            try:
                total_txt = f"{float(total):g}%"
            except (TypeError, ValueError):
                total_txt = str(total or "")
            items.append(
                {
                    "source_kind": "classroom_visit",
                    "source_id": str(row[0]),
                    "title": f"زيارة صفية — {row[1] or 'معلم'}",
                    "summary": " · ".join(
                        bit
                        for bit in [
                            row[2] or "",
                            total_txt,
                            row[4] or "",
                            row[7] or "",
                        ]
                        if bit
                    ),
                    "date": date_bit,
                }
            )

    if code.startswith("1-") or code.startswith("2-") or code.startswith("1-4"):
        perf = connection.execute(
            """
            SELECT COUNT(*),
                   AVG(CASE WHEN mid_percent IS NOT NULL THEN mid_percent END),
                   SUM(CASE WHEN readiness_mid >= 99.9 AND mid_percent IS NOT NULL THEN 1 ELSE 0 END)
            FROM perf_records
            """
        ).fetchone()
        if perf and int(perf[0] or 0) > 0:
            avg = round(float(perf[1] or 0), 2) if perf[1] is not None else None
            items.append(
                {
                    "source_kind": "job_performance",
                    "source_id": "perf_records",
                    "title": "تقويم الأداء الوظيفي (ملخص المدرسة)",
                    "summary": (
                        f"سجلات {int(perf[0])} · منجز {int(perf[2] or 0)}"
                        + (f" · متوسط {avg}%" if avg is not None else "")
                    ),
                    "date": "",
                }
            )
        gaps = connection.execute(
            """
            SELECT COUNT(*) FROM perf_gap_plans
            """
        ).fetchone()[0]
        if gaps:
            items.append(
                {
                    "source_kind": "job_performance",
                    "source_id": "perf_gap_plans",
                    "title": "خطط تحسين فجوة الأداء",
                    "summary": f"{int(gaps)} خطة فجوة محفوظة",
                    "date": "",
                }
            )

    if code.startswith("3-1") or code.startswith("3-2") or code.startswith("2-"):
        for category, label in (("gifted", "الموهوبون"), ("struggling", "الاحتياج للدعم")):
            row = connection.execute(
                """
                SELECT COUNT(*),
                       SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END)
                FROM students_support
                WHERE category = ?
                """,
                (category,),
            ).fetchone()
            total = int(row[0] or 0) if row else 0
            approved = int(row[1] or 0) if row else 0
            if not total:
                continue
            items.append(
                {
                    "source_kind": "students_support",
                    "source_id": category,
                    "title": f"قائمة {label}",
                    "summary": f"{total} اسماً · معتمد {approved}",
                    "date": "",
                }
            )

    if code.startswith("3-1") or code.startswith("2-2") or code.startswith("2-1"):
        nafs = connection.execute(
            """
            SELECT id, grade, enrolled, tested, reading_score, science_score, math_score,
                   weakest_skill, weakest_score, updated_at
            FROM nafs_cards
            ORDER BY id DESC
            LIMIT 5
            """
        ).fetchall()
        for row in nafs:
            items.append(
                {
                    "source_kind": "nafes",
                    "source_id": str(row[0]),
                    "title": f"نتائج نافس — {row[1] or 'مرحلة'}",
                    "summary": " · ".join(
                        bit
                        for bit in [
                            f"مختبرون {row[3] or '—'}/{row[2] or '—'}",
                            f"قراءة {row[4] or '—'}",
                            f"علوم {row[5] or '—'}",
                            f"رياضيات {row[6] or '—'}",
                            (f"أضعف مهارة: {row[7]} ({row[8]})" if row[7] else ""),
                        ]
                        if bit
                    ),
                    "date": row[9] or "",
                }
            )
        timetable = connection.execute(
            """
            SELECT COUNT(*) FROM nafes_timetable WHERE COALESCE(is_deleted, 0) = 0
            """
        ).fetchone()[0]
        if timetable:
            items.append(
                {
                    "source_kind": "nafes",
                    "source_id": "nafes_timetable",
                    "title": "جدول حصص نافس",
                    "summary": f"{int(timetable)} حصة محفوظة",
                    "date": "",
                }
            )

    # محاضر المجالس من ملف الجلسة إن وُجد.
    minutes_path = (
        Path(__file__).resolve().parent.parent / "School_Data" / "council_minutes.json"
    )
    if minutes_path.is_file() and (
        code.startswith("1-") or code.startswith("3-2") or code.startswith("4-")
    ):
        try:
            payload = json.loads(minutes_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            payload = []
        rows = payload if isinstance(payload, list) else payload.get("items") or []
        for row in rows[:6]:
            if not isinstance(row, dict):
                continue
            cid = str(row.get("id") or row.get("council_id") or "").strip()
            title = str(row.get("title") or row.get("type") or "محضر مجلس/لجنة").strip()
            date_bit = str(row.get("date") or row.get("meeting_date") or "").strip()
            items.append(
                {
                    "source_kind": "council",
                    "source_id": cid or title,
                    "title": title,
                    "summary": str(row.get("agenda") or row.get("type_label") or "")[:160],
                    "date": date_bit,
                }
            )

    return _dedupe(items)[:24]


def _bank_payload(connection, cycle: dict) -> dict:
    cycle_id = int(cycle["id"])
    rows = connection.execute(
        """
        SELECT id, code, domain, standard_name, statement, level,
               COALESCE(score_percent, ''), COALESCE(recommendation, ''),
               COALESCE(domain_score, ''), COALESCE(gap_to_next, '')
        FROM evaluation_indicators
        WHERE cycle_id = ?
        """,
        (cycle_id,),
    ).fetchall()
    self_rows = connection.execute(
        """
        SELECT indicator_code, level, note, updated_by, updated_at
        FROM accred_self_ratings
        WHERE cycle_id = ?
        """,
        (cycle_id,),
    ).fetchall()
    self_map = {
        str(row[0]): {
            "level": int(row[1] or 0),
            "level_label": SELF_LEVELS.get(int(row[1] or 0), ""),
            "note": row[2] or "",
            "updated_by": row[3] or "",
            "updated_at": row[4] or "",
        }
        for row in self_rows
    }
    indicators = []
    domains = set()
    rated_levels = []
    for row in rows:
        code = str(row[1] or "")
        domain = str(row[2] or "")
        domains.add(domain)
        self_pack = self_map.get(code) or {
            "level": 0,
            "level_label": "",
            "note": "",
            "updated_by": "",
            "updated_at": "",
        }
        level = int(self_pack["level"] or 0)
        if level >= 1:
            rated_levels.append(level)
        indicators.append(
            {
                "id": int(row[0]),
                "code": code,
                "domain": domain,
                "standard_name": row[3] or "",
                "statement": row[4] or "",
                "external_level": row[5] or "",
                "external_score_percent": row[6] or "",
                "recommendation": row[7] or "",
                "domain_score": row[8] or "",
                "gap_to_next": row[9] or "",
                "self_level": level,
                "self_level_label": self_pack["level_label"],
                "self_note": self_pack["note"],
                "self_updated_by": self_pack["updated_by"],
                "self_updated_at": self_pack["updated_at"],
                "is_rated": level >= 1,
            }
        )
    indicators.sort(key=lambda item: _code_key(item["code"]))
    total = len(indicators)
    rated = len(rated_levels)
    avg = round(sum(rated_levels) / rated, 2) if rated else None
    return {
        "ok": True,
        "cycle": cycle,
        "self_levels": SELF_LEVELS,
        "domains": sorted(domains),
        "stats": {
            "total": total,
            "rated": rated,
            "pending": total - rated,
            "avg_level": avg,
        },
        "indicators": indicators,
    }


@router.get("/api/session/accreditation/bank")
def accreditation_bank(
    cycle_id: int = 0,
    x_session_token: str = Header(default=""),
):
    """بنك المؤشرات الحية + حالة الرصد الذاتي لدورة الاعتماد."""
    _user(x_session_token)
    connection = connect()
    try:
        ensure_accreditation_self_tables(connection)
        cycle = _resolve_cycle(connection, cycle_id)
        if not cycle:
            connection.commit()
            return {
                "ok": True,
                "cycle": None,
                "self_levels": SELF_LEVELS,
                "domains": [],
                "stats": {"total": 0, "rated": 0, "pending": 0, "avg_level": None},
                "indicators": [],
            }
        payload = _bank_payload(connection, cycle)
        connection.commit()
        return payload
    finally:
        connection.close()


@router.get("/api/session/accreditation/self")
def accreditation_self_get(
    cycle_id: int = 0,
    x_session_token: str = Header(default=""),
):
    """قائمة درجات الرصد الذاتي المحفوظة فقط."""
    _user(x_session_token)
    connection = connect()
    try:
        ensure_accreditation_self_tables(connection)
        cycle = _resolve_cycle(connection, cycle_id)
        if not cycle:
            connection.commit()
            return {"ok": True, "cycle_id": 0, "items": []}
        rows = connection.execute(
            """
            SELECT indicator_code, level, note, updated_by, updated_at
            FROM accred_self_ratings
            WHERE cycle_id = ?
            ORDER BY indicator_code
            """,
            (cycle["id"],),
        ).fetchall()
        connection.commit()
        return {
            "ok": True,
            "cycle_id": cycle["id"],
            "items": [
                {
                    "indicator_code": row[0],
                    "level": int(row[1] or 0),
                    "level_label": SELF_LEVELS.get(int(row[1] or 0), ""),
                    "note": row[2] or "",
                    "updated_by": row[3] or "",
                    "updated_at": row[4] or "",
                }
                for row in rows
            ],
        }
    finally:
        connection.close()


@router.put("/api/session/accreditation/self")
def accreditation_self_put(
    body: SelfRatingBody,
    x_session_token: str = Header(default=""),
):
    """حفظ مستوى رصد ذاتي وملاحظة لمؤشر واحد."""
    user = _leadership(x_session_token)
    code = str(body.indicator_code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="رمز المؤشر مطلوب")
    level = int(body.level or 0)
    if level < 1 or level > 4:
        raise HTTPException(status_code=400, detail="المستوى الذاتي من 1 إلى 4")
    note = str(body.note or "").strip()
    if len(note) > 500:
        raise HTTPException(status_code=400, detail="الملاحظة ≤ 500 حرفاً")
    connection = connect()
    try:
        ensure_accreditation_self_tables(connection)
        cycle = _resolve_cycle(connection, body.cycle_id)
        if not cycle:
            raise HTTPException(status_code=404, detail="دورة الاعتماد غير موجودة")
        found = connection.execute(
            """
            SELECT id FROM evaluation_indicators
            WHERE cycle_id = ? AND code = ?
            """,
            (cycle["id"], code),
        ).fetchone()
        if not found:
            raise HTTPException(status_code=404, detail="المؤشر غير موجود في بنك الدورة")
        moment = _stamp()
        actor = str(user.get("national_id") or user.get("id") or "")
        connection.execute(
            """
            INSERT INTO accred_self_ratings (
                cycle_id, indicator_code, level, note, updated_by, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(cycle_id, indicator_code) DO UPDATE SET
                level = excluded.level,
                note = excluded.note,
                updated_by = excluded.updated_by,
                updated_at = excluded.updated_at
            """,
            (cycle["id"], code, level, note, actor, moment),
        )
        connection.commit()
        return {
            "ok": True,
            "saved": True,
            "cycle_id": cycle["id"],
            "indicator_code": code,
            "level": level,
            "level_label": SELF_LEVELS[level],
            "note": note,
            "updated_at": moment,
        }
    finally:
        connection.close()


@router.get("/api/session/accreditation/evidence")
def accreditation_evidence(
    code: str = "",
    x_session_token: str = Header(default=""),
):
    """شواهد حية قرائية مرتبطة برمز المؤشر — بلا فرض درجة."""
    _user(x_session_token)
    indicator_code = str(code or "").strip()
    if not indicator_code:
        raise HTTPException(status_code=400, detail="رمز المؤشر مطلوب")
    connection = connect()
    try:
        ensure_accreditation_self_tables(connection)
        items = gather_live_evidence(connection, indicator_code)
        connection.commit()
        return {
            "ok": True,
            "code": indicator_code,
            "count": len(items),
            "items": items,
        }
    finally:
        connection.close()
