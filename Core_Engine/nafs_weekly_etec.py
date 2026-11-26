# المرحلة ٥: محرك الخطة الأسبوعية (٨ أسابيع) + أرشفة شواهد التعلّم في مؤشرات ETEC + تصدير Word.
from __future__ import annotations

import io
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .database import connect
from .nafs_unit2_ssot import SKILLS_MATRIX, WEEKLY_PLAN_8, ensure_on_boot as ensure_unit2

router = APIRouter(tags=["nafs-weekly-etec"])

SCHOOL_STAT = "40341"
SCHOOL_STAT_AR = "٤٠٣٤١"
SCHOOL_NAME = "متوسطة سعد بن الربيع الأنصاري"
FONT_NAME = "Tajawal"
FONT_FALLBACK = "Tahoma"
FONT_TTF = Path(__file__).resolve().parents[1] / "Print_Canvas" / "fonts" / "Tajawal-Regular.ttf"

EASTERN = "٠١٢٣٤٥٦٧٨٩"

ETEC_MAP = {
    "3-1-1-1": {
        "code": "3-1-1-1",
        "code_ar": "٣-١-١-١",
        "label": "نواتج التعلم — القراءة",
        "domain": "reading",
    },
    "3-1-1-2": {
        "code": "3-1-1-2",
        "code_ar": "٣-١-١-٢",
        "label": "نواتج التعلم — الرياضيات",
        "domain": "math",
    },
    "3-1-1-3": {
        "code": "3-1-1-3",
        "code_ar": "٣-١-١-٣",
        "label": "نواتج التعلم — العلوم",
        "domain": "science",
    },
    "1-3-1-2": {
        "code": "1-3-1-2",
        "code_ar": "١-٣-١-٢",
        "label": "الشراكة الأسرية والتعلّم المنزلي",
        "domain": "family",
    },
    "2-1-1-5": {
        "code": "2-1-1-5",
        "code_ar": "٢-١-١-٥",
        "label": "السلوك والانضباط الإيجابي",
        "domain": "behavior",
    },
}

# أسابيع المحاكاة المرحلية ضمن الخطة الثمانية
MOCK_WEEKS = {4: "محاكاة مصغّرة ١", 6: "محاكاة ٢ + دوري فصول", 7: "المحاكاة الوطنية ٦٦"}


def _e(value: Any) -> str:
    return "".join(EASTERN[int(c)] if c.isdigit() else ("٪" if c == "%" else c) for c in str(value))


def _iso(dt: datetime | None = None) -> str:
    return (dt or datetime.now(timezone.utc)).replace(microsecond=0).isoformat()


def _current_week_index() -> int:
    iso_week = datetime.now(timezone.utc).isocalendar().week
    return ((iso_week - 1) % 8) + 1


def ensure_weekly_etec(connection) -> None:
    """توسيع جداول قائمة فقط — بلا قواعد موازية."""
    ensure_unit2(connection)
    from .visual_evidence import ensure_visual_evidence_table

    ensure_visual_evidence_table(connection)
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS portal_etec_archive_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            indicator_code TEXT NOT NULL,
            summary_json TEXT NOT NULL DEFAULT '{}',
            barcode TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_etec_arch_code
          ON portal_etec_archive_log(indicator_code, created_at);
        """
    )


def enrich_week(week_row: dict) -> dict:
    """يشتق هدف المعلمين والطلاب من صف الخطة دون إدخال يدوي أسبوعي."""
    w = dict(week_row)
    n = int(w.get("week") or 0)
    mock = MOCK_WEEKS.get(n)
    teacher = (
        f"تركيز الأسبوع {_e(n)}: {w.get('focus')}. "
        f"رياضيات: {w.get('math')} · علوم: {w.get('science')} · قراءة: {w.get('reading')}. "
        f"وثّق الشاهد: {w.get('evidence')}."
    )
    student = (
        f"هدف أسبوعك {_e(n)}: أتقن «{w.get('math')}» و«{w.get('science')}» و«{w.get('reading')}». "
        f"أكمل تحديات الميدان"
        + (f" واستعد لـ{mock}." if mock else ".")
    )
    w["teacher_goal"] = teacher
    w["student_goal"] = student
    w["mock_label"] = mock or ""
    w["is_mock_week"] = bool(mock)
    w["week_ar"] = _e(n)
    w["etec_codes"] = ["3-1-1-1", "3-1-1-2", "3-1-1-3"]
    w["etec_codes_ar"] = ["٣-١-١-١", "٣-١-١-٢", "٣-١-١-٣"]
    w["barcode"] = f"NAFS-{SCHOOL_STAT}-W{n:02d}"
    return w


def build_week_goal(connection=None) -> dict:
    current_idx = _current_week_index()
    weeks = [enrich_week(w) for w in WEEKLY_PLAN_8]
    current = weeks[current_idx - 1]
    return {
        "ok": True,
        "school": {"name": SCHOOL_NAME, "stat_no": SCHOOL_STAT, "stat_no_ar": SCHOOL_STAT_AR},
        "current_week": current_idx,
        "current_week_ar": _e(current_idx),
        "current": current,
        "weeks": weeks,
        "teacher_goal": current["teacher_goal"],
        "student_goal": current["student_goal"],
        "skills_matrix": SKILLS_MATRIX,
        "schedule_engine": {
            "source": "WEEKLY_PLAN_8",
            "auto": True,
            "manual_weekly_edit": False,
            "note": "يُبث هدف الأسبوع تلقائياً من محرك الجدولة الثماني دون تعديل يدوي أسبوعي.",
        },
    }


def _safe_count(connection, sql: str, params: tuple = ()) -> int:
    try:
        return int(connection.execute(sql, params).fetchone()[0] or 0)
    except Exception:
        return 0


def build_etec_archive(connection) -> dict:
    """ملخصات مؤشرات وشواهد حيّة من جداول SSOT القائمة فقط."""
    ensure_weekly_etec(connection)
    week = build_week_goal(connection)

    runs_total = _safe_count(connection, "SELECT COUNT(*) FROM portal_challenge_runs WHERE finished_at != ''")
    runs_week = _safe_count(
        connection,
        """
        SELECT COUNT(*) FROM portal_challenge_runs
        WHERE finished_at != '' AND finished_at >= datetime('now', '-7 days')
        """,
    )
    avg_score = 0.0
    try:
        avg_score = float(
            connection.execute(
                "SELECT COALESCE(AVG(score_pct),0) FROM portal_challenge_runs WHERE finished_at != ''"
            ).fetchone()[0]
            or 0
        )
    except Exception:
        avg_score = 0.0

    vault_open = _safe_count(
        connection,
        "SELECT COUNT(*) FROM student_error_vault WHERE status IN ('open','recovering')",
    )
    vault_recovered = _safe_count(
        connection,
        "SELECT COUNT(*) FROM student_error_vault WHERE status = 'recovered'",
    )

    clinics_open = _safe_count(
        connection,
        """
        SELECT COUNT(*) FROM teacher_remedial
        WHERE COALESCE(status,'') NOT IN ('مغلق','مكتمل','closed','done')
        """,
    )
    clinics_approved = _safe_count(
        connection,
        """
        SELECT COUNT(*) FROM teacher_remedial
        WHERE COALESCE(source,'') LIKE '%clinic%' OR COALESCE(source,'') LIKE '%vault%'
        """,
    )

    pledges = _safe_count(connection, "SELECT COUNT(*) FROM portal_family_pact")
    omr_ack = _safe_count(
        connection,
        "SELECT COUNT(*) FROM portal_home_mock_packs WHERE COALESCE(acknowledged_at,'') != ''",
    )
    family_weekly_done = _safe_count(
        connection,
        "SELECT COUNT(*) FROM portal_family_weekly WHERE checks_json LIKE '%true%'",
    )

    qodwa = _safe_count(
        connection,
        "SELECT COALESCE(SUM(points),0) FROM portal_behavior_points WHERE program = 'قدوة'",
    )
    rifq = _safe_count(
        connection,
        "SELECT COALESCE(SUM(points),0) FROM portal_behavior_points WHERE program = 'رفق'",
    )

    by_domain = {}
    for domain, code in (("reading", "3-1-1-1"), ("math", "3-1-1-2"), ("science", "3-1-1-3")):
        heat = _safe_count(
            connection,
            """
            SELECT COUNT(*) FROM student_error_vault
            WHERE domain = ? AND status IN ('open','recovering')
            """,
            (domain,),
        )
        recovered = _safe_count(
            connection,
            "SELECT COUNT(*) FROM student_error_vault WHERE domain = ? AND status = 'recovered'",
            (domain,),
        )
        by_domain[code] = {
            **ETEC_MAP[code],
            "vault_open": heat,
            "vault_recovered": recovered,
            "vault_open_ar": _e(heat),
            "vault_recovered_ar": _e(recovered),
            "sources": ["ميدان نافس", "مخزن الإتقان", "عيادات علاجية"],
        }

    indicators = {
        **{k: by_domain[k] for k in ("3-1-1-1", "3-1-1-2", "3-1-1-3")},
        "1-3-1-2": {
            **ETEC_MAP["1-3-1-2"],
            "pledges": pledges,
            "omr_ack": omr_ack,
            "family_weekly": family_weekly_done,
            "pledges_ar": _e(pledges),
            "omr_ack_ar": _e(omr_ack),
            "family_weekly_ar": _e(family_weekly_done),
            "sources": ["تعهد أسري", "إقرار OMR", "ميثاق ٢٠ دقيقة"],
        },
        "2-1-1-5": {
            **ETEC_MAP["2-1-1-5"],
            "qodwa": qodwa,
            "rifq": rifq,
            "qodwa_ar": _e(qodwa),
            "rifq_ar": _e(rifq),
            "sources": ["قدوة", "رفق", "قسائم مقصف"],
        },
    }

    summary = {
        "nafs_runs_total": runs_total,
        "nafs_runs_week": runs_week,
        "avg_score": round(avg_score, 1),
        "avg_score_ar": _e(round(avg_score, 1)),
        "vault_open": vault_open,
        "vault_recovered": vault_recovered,
        "clinics_open": clinics_open,
        "clinics_approved": clinics_approved,
        "nafs_runs_total_ar": _e(runs_total),
        "nafs_runs_week_ar": _e(runs_week),
        "vault_open_ar": _e(vault_open),
        "vault_recovered_ar": _e(vault_recovered),
        "clinics_open_ar": _e(clinics_open),
        "clinics_approved_ar": _e(clinics_approved),
    }

    return {
        "ok": True,
        "school": week["school"],
        "week_goal": {
            "current_week": week["current_week"],
            "current_week_ar": week["current_week_ar"],
            "teacher_goal": week["teacher_goal"],
            "student_goal": week["student_goal"],
            "current": week["current"],
        },
        "summary": summary,
        "indicators": indicators,
        "legend": {
            "ltr": "رموز ETEC باتجاه LTR",
            "digits": "الأرقام الهندية ٠–٩",
            "ssot": "بلا قواعد بيانات موازية — قراءة من جداول البوابة والعيادات والشواهد",
        },
        "barcode_master": f"ETEC-ARCHIVE-{SCHOOL_STAT}-{_iso()[:10]}",
        "generated_at": _iso(),
    }


def refresh_etec_archive(connection, actor_name: str = "قيادة") -> dict:
    """أرشفة ملخصات المؤشرات في visual_evidence + سجل خفيف للمراجعة الفورية."""
    ensure_weekly_etec(connection)
    pack = build_etec_archive(connection)
    stamped = _iso()
    written = []
    for code, block in (pack.get("indicators") or {}).items():
        barcode = f"ETEC-{SCHOOL_STAT}-{code}-{stamped[:10]}"
        summary = {
            "indicator": code,
            "label": block.get("label"),
            "metrics": {k: v for k, v in block.items() if k not in ("sources", "label", "domain")},
            "week": pack["week_goal"]["current_week"],
            "at": stamped,
        }
        name = (
            f"أرشيف شاهد {block.get('code_ar') or code} — أسبوع "
            f"{pack['week_goal']['current_week_ar']} · {SCHOOL_NAME}"
        )
        try:
            connection.execute(
                """
                INSERT INTO visual_evidence(
                  entity_type, entity_key, register_key, kind, url, name, created_at, uploaded_by
                ) VALUES ('accreditation', ?, 'nafs-etec-archive', 'note', '', ?, ?, ?)
                """,
                (code, name, stamped, actor_name or "قيادة"),
            )
        except Exception:
            pass
        connection.execute(
            """
            INSERT INTO portal_etec_archive_log(indicator_code, summary_json, barcode, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (code, json.dumps(summary, ensure_ascii=False), barcode, stamped),
        )
        written.append({"code": code, "code_ar": block.get("code_ar"), "barcode": barcode, "name": name})
    return {
        "ok": True,
        "written": written,
        "count": len(written),
        "pack": pack,
        "at": stamped,
    }


def _docx_font() -> str:
    return FONT_NAME if FONT_TTF.exists() else FONT_FALLBACK


def _apply_run_font(run, size: int = 12, bold: bool = False, color_hex: str | None = None) -> None:
    from docx.oxml import parse_xml
    from docx.oxml.ns import nsdecls
    from docx.shared import Pt, RGBColor

    font = _docx_font()
    run.bold = bold
    run.font.size = Pt(size)
    run.font.name = font
    if color_hex:
        run.font.color.rgb = RGBColor(
            int(color_hex[0:2], 16), int(color_hex[2:4], 16), int(color_hex[4:6], 16)
        )
    rPr = run._r.get_or_add_rPr()
    rPr.append(
        parse_xml(
            f'<w:rFonts {nsdecls("w")} w:ascii="{font}" w:hAnsi="{font}" w:cs="{font}" w:eastAsia="{font}"/>'
        )
    )
    rPr.append(parse_xml(f'<w:rtl {nsdecls("w")}/>'))


def build_official_docx(kind: str = "weekly", connection=None) -> tuple[io.BytesIO, str]:
    """تصدير Word رسمي: ترويسة ثلاثية + مهند/تجوال + باركود حي."""
    try:
        import docx
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.oxml import parse_xml
        from docx.oxml.ns import nsdecls, qn
    except ImportError as error:
        raise HTTPException(status_code=500, detail="مكتبة python-docx غير متاحة على الخادم.") from error

    own_conn = False
    if connection is None:
        connection = connect()
        own_conn = True
    try:
        ensure_weekly_etec(connection)
        week = build_week_goal(connection)
        archive = build_etec_archive(connection)
        doc = docx.Document()

        # ترويسة ثلاثية نصية (هوية المدرسة)
        header = doc.add_paragraph()
        header.alignment = WD_ALIGN_PARAGRAPH.CENTER
        h = header.add_run(
            "المملكة العربية السعودية\n"
            "وزارة التعليم\n"
            "الإدارة العامة للتعليم بمنطقة المدينة المنورة\n"
            f"{SCHOOL_NAME} ({SCHOOL_STAT_AR})"
        )
        _apply_run_font(h, size=12, bold=True, color_hex="0B5E56")
        pPr = header._p.get_or_add_pPr()
        if pPr.find(qn("w:bidi")) is None:
            pPr.append(parse_xml(f'<w:bidi {nsdecls("w")}/>'))

        kind = (kind or "weekly").strip().lower()
        titles = {
            "weekly": "الخطة التشغيلية الأسبوعية (٨ أسابيع) — هدف الأسبوع",
            "matrix": "مصفوفة المهارات التراكمية (١م–٣م)",
            "evidence": "أرشيف شواهد التعلّم الحيّة — مؤشرات ETEC",
            "workbook": "كراسة تدريب أسبوعية للمعلمين والطلاب",
        }
        title = doc.add_paragraph()
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        tr = title.add_run(titles.get(kind, titles["weekly"]))
        _apply_run_font(tr, size=15, bold=True, color_hex="0B5E56")

        goal_p = doc.add_paragraph()
        goal_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        gr = goal_p.add_run(
            f"الأسبوع الحالي: {_e(week['current_week'])}\n"
            f"هدف المعلمين: {week['teacher_goal']}\n"
            f"هدف الطلاب: {week['student_goal']}"
        )
        _apply_run_font(gr, size=11)

        if kind == "matrix":
            for _domain, block in SKILLS_MATRIX.items():
                doc.add_paragraph()
                hp = doc.add_paragraph()
                hr = hp.add_run(f"{block['label']} — مؤشر {_e(block['etec'])}")
                _apply_run_font(hr, size=12, bold=True, color_hex="0B5E56")
                for sk in block["skills"]:
                    sp = doc.add_paragraph()
                    sr = sp.add_run(
                        f"• {sk['name']} | الجذر {sk['root']} | الصف {sk['grade']}"
                    )
                    _apply_run_font(sr, size=11)
        elif kind == "evidence":
            summary = archive["summary"]
            sp = doc.add_paragraph()
            sr = sp.add_run(
                f"جولات نافس: {_e(summary['nafs_runs_total'])} "
                f"(آخر ٧ أيام: {_e(summary['nafs_runs_week'])}) · "
                f"متوسط {_e(summary['avg_score'])}٪ · "
                f"vault مفتوح {_e(summary['vault_open'])} · "
                f"عيادات مفتوحة {_e(summary['clinics_open'])}"
            )
            _apply_run_font(sr, size=11)
            for code, block in (archive.get("indicators") or {}).items():
                ip = doc.add_paragraph()
                ir = ip.add_run(f"المؤشر {block.get('code_ar') or _e(code)} — {block.get('label')}")
                _apply_run_font(ir, size=12, bold=True, color_hex="0B5E56")
                metrics = []
                for key, label in (
                    ("vault_open_ar", "تعثر مفتوح"),
                    ("vault_recovered_ar", "مستعاد"),
                    ("pledges_ar", "تعهدات"),
                    ("omr_ack_ar", "OMR"),
                    ("family_weekly_ar", "ميثاق أسبوعي"),
                    ("qodwa_ar", "قدوة"),
                    ("rifq_ar", "رفق"),
                ):
                    if key in block:
                        metrics.append(f"{label}: {block[key]}")
                mp = doc.add_paragraph()
                mr = mp.add_run(" · ".join(metrics) if metrics else "لا مقاييس بعد")
                _apply_run_font(mr, size=11)
                src = doc.add_paragraph()
                srr = src.add_run("المصادر: " + " · ".join(block.get("sources") or []))
                _apply_run_font(srr, size=10)
        elif kind == "workbook":
            cur = week["current"]
            wp = doc.add_paragraph()
            wr = wp.add_run(
                f"كراسة الأسبوع {_e(cur['week'])}: {cur['focus']}\n"
                f"رياضيات: {cur['math']}\nعلوم: {cur['science']}\nقراءة: {cur['reading']}\n"
                f"الشاهد المطلوب: {cur['evidence']}"
                + (f"\nمحاكاة مرحلية: {cur['mock_label']}" if cur.get("mock_label") else "")
            )
            _apply_run_font(wr, size=11)
            tip = doc.add_paragraph()
            trun = tip.add_run(
                "للمعلم: راجع العيادات المعتمدة ومخزن الإتقان لهذا التركيز.\n"
                "للطالب: أنجز تحدي اليوم ثم راجع بطاقة الحقيبة الذهبية المرتبطة بالمهارة."
            )
            _apply_run_font(trun, size=11)
        else:
            for w in week["weeks"]:
                wp = doc.add_paragraph()
                mark = "◀ " if int(w["week"]) == int(week["current_week"]) else ""
                wr = wp.add_run(
                    f"{mark}الأسبوع {_e(w['week'])}: {w['focus']} | "
                    f"رياضيات: {w['math']} | علوم: {w['science']} | قراءة: {w['reading']} | "
                    f"الشاهد: {w['evidence']} | باركود: {w['barcode']}"
                )
                _apply_run_font(wr, size=10, bold=int(w["week"]) == int(week["current_week"]))

        footer = doc.add_paragraph()
        footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
        fr = footer.add_run(
            f"باركود حي: {archive.get('barcode_master') or week['current']['barcode']} | "
            f"المدرسة {SCHOOL_STAT_AR} | خط {_docx_font()} | "
            f"مؤشرات ٣-١-١-١ / ٣-١-١-٢ / ٣-١-١-٣ / ١-٣-١-٢"
        )
        _apply_run_font(fr, size=9)

        buf = io.BytesIO()
        doc.save(buf)
        buf.seek(0)
        filename = f"nafs_{kind}_{SCHOOL_STAT}_{_iso()[:10]}.docx"
        return buf, filename
    finally:
        if own_conn:
            connection.close()


@router.get("/api/session/nafs/week-goal")
def api_week_goal_session(x_session_token: str = Header(default="")):
    from .access import require_user

    try:
        require_user(str(x_session_token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    connection = connect()
    try:
        ensure_weekly_etec(connection)
        return build_week_goal(connection)
    finally:
        connection.close()


@router.get("/api/portal/week-goal")
def api_week_goal_portal(x_portal_token: str = Header(default="")):
    from .portal_session_api import _require_portal

    _require_portal(x_portal_token)
    connection = connect()
    try:
        ensure_weekly_etec(connection)
        pack = build_week_goal(connection)
        # بوابة الطالب/ولي الأمر ترى هدف الطلاب أساساً
        return {
            "ok": True,
            "current_week": pack["current_week"],
            "current_week_ar": pack["current_week_ar"],
            "student_goal": pack["student_goal"],
            "teacher_goal": pack["teacher_goal"],
            "current": pack["current"],
            "school": pack["school"],
            "barcode": pack["current"]["barcode"],
        }
    finally:
        connection.close()


@router.get("/api/session/nafs/etec-archive")
def api_etec_archive(x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level

    _require_level(x_session_token, 2)
    connection = connect()
    try:
        return build_etec_archive(connection)
    finally:
        connection.close()


class ArchiveRefreshBody(BaseModel):
    note: str = ""


@router.post("/api/session/nafs/etec-archive/refresh")
def api_etec_archive_refresh(body: ArchiveRefreshBody = ArchiveRefreshBody(), x_session_token: str = Header(default="")):
    from .portal_owner_api import _require_level, _audit

    user, _level = _require_level(x_session_token, 1)
    connection = connect()
    try:
        result = refresh_etec_archive(connection, actor_name=str(user.get("name") or "قيادة"))
        _audit(
            connection,
            user,
            "nafs.etec.archive.refresh",
            str(result.get("count") or 0),
            {"note": (body.note or "").strip()[:200]},
        )
        connection.commit()
        return result
    finally:
        connection.close()


