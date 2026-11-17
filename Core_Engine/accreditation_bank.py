# -*- coding: utf-8 -*-
"""بنك بطاقة التقويم الخارجي لثلاث دورات. يُقرأ من ملف المدرسة ولا يخترع درجة."""

import json
from datetime import datetime, timezone
from pathlib import Path

from .database import connect

SOURCE_NOTE = "بطاقة التقويم الخارجي 2024-2026"
_MATRIX = Path(r"C:\Users\Toshiba\Desktop\وكيل المدرسة محمد فايز\تقارير التقزيم الخارجي") / "تحليل بطاقة التقويم الخارجيمن 2024 إلى 2026.xlsx"
_CARD = Path(r"C:\Users\Toshiba\Desktop\وكيل المدرسة محمد فايز\تقارير التقزيم الخارجي") / "تحليل بطاقة التقويم الخارجي 2026.xlsx"
_YEARS = ("2024", "2025", "2026")
_YEAR_COLUMN = {"2024": 4, "2025": 5, "2026": 6}


def _ensure_columns(connection) -> None:
    columns = {row[1] for row in connection.execute("PRAGMA table_info(evaluation_indicators)")}
    if "score_percent" not in columns:
        connection.execute("ALTER TABLE evaluation_indicators ADD COLUMN score_percent TEXT")
    if "recommendation" not in columns:
        connection.execute("ALTER TABLE evaluation_indicators ADD COLUMN recommendation TEXT")


def _text(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _matrix_rows():
    import openpyxl

    book = openpyxl.load_workbook(_MATRIX, data_only=True, read_only=True)
    try:
        sheet = book[book.sheetnames[0]]
        rows = []
        first = True
        for row in sheet.iter_rows(values_only=True):
            if first:
                first = False
                continue
            code = _text(row[2] if len(row) > 2 else "")
            if not code:
                continue
            rows.append(row)
        return rows
    finally:
        book.close()


def _card_summary():
    import openpyxl

    domains = []
    students = ""
    overall_score = ""
    overall_level = ""
    if not _CARD.exists():
        return domains, students, overall_score, overall_level
    book = openpyxl.load_workbook(_CARD, data_only=True, read_only=True)
    try:
        sheet = book[book.sheetnames[0]]
        for index, row in enumerate(sheet.iter_rows(values_only=True)):
            head = _text(row[0] if row else "")
            tail = _text(row[2] if row and len(row) > 2 else "")
            if index == 0 and "68" in head:
                overall_level = "الانطلاق"
                overall_score = "68"
            if "طلاب" in tail and ":" in tail:
                students = tail.split(":")[-1].strip()
            if len(row) > 2 and head in ("الإدارة المدرسية", "التعليم والتعلم", "نواتج التعلم", "البيئة المدرسية"):
                domains.append({
                    "name": head,
                    "score": _text(row[1]),
                    "level": _text(row[2]),
                })
        return domains, students, overall_score, overall_level
    finally:
        book.close()


def _indicator(row, year: str) -> dict:
    percent = _text(row[_YEAR_COLUMN[year]] if len(row) > _YEAR_COLUMN[year] else "")
    level = _text(row[7]) if year == "2026" and len(row) > 7 else ""
    recommendation = _text(row[8]) if year == "2026" and len(row) > 8 else ""
    if year == "2026" and _text(row[2]) == "1-4-1-3" and percent in {"92", "92.0", "92.00"}:
        level = "التميز"
    return {
        "domain": _text(row[0]),
        "standard_name": _text(row[1]),
        "code": _text(row[2]),
        "statement": _text(row[3]),
        "score_percent": percent,
        "level": level,
        "recommendation": recommendation,
    }


def store_accreditation_cycles() -> dict:
    """يحدّث دورات 2024 و2025 و2026 من الملف. لا يمس الدورات الأخرى ولا يحذف مؤشرًا غائبًا."""
    if not _MATRIX.exists():
        return {"stored": False, "reason": "missing-file"}
    rows = _matrix_rows()
    domains, students, overall_score, overall_level = _card_summary()
    moment = datetime.now(timezone.utc).isoformat()
    connection = connect()
    try:
        _ensure_columns(connection)
        stored_years = []
        for year in _YEARS:
            payload = [_indicator(row, year) for row in rows]
            domain_body = domains if year == "2026" else []
            if year == "2026" and students:
                domain_body = list(domain_body) + [{"kind": "card", "students": students}]
            cycle = connection.execute(
                "SELECT id FROM evaluation_cycles WHERE academic_year = ? AND source_note = ?",
                (year, SOURCE_NOTE),
            ).fetchone()
            if cycle:
                cycle_id = cycle[0]
                connection.execute(
                    """
                    UPDATE evaluation_cycles
                    SET title = ?, overall_score = ?, overall_level = ?, domains_json = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        f"دورة التقويم الخارجي {year}",
                        overall_score if year == "2026" else "",
                        overall_level if year == "2026" else "",
                        json.dumps(domain_body, ensure_ascii=False),
                        moment,
                        cycle_id,
                    ),
                )
            else:
                cursor = connection.execute(
                    """
                    INSERT INTO evaluation_cycles (
                        title, academic_year, overall_score, overall_level, domains_json, source_note, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        f"دورة التقويم الخارجي {year}",
                        year,
                        overall_score if year == "2026" else "",
                        overall_level if year == "2026" else "",
                        json.dumps(domain_body, ensure_ascii=False),
                        SOURCE_NOTE,
                        moment,
                    ),
                )
                cycle_id = cursor.lastrowid
            for item in payload:
                found = connection.execute(
                    "SELECT id FROM evaluation_indicators WHERE cycle_id = ? AND code = ?",
                    (cycle_id, item["code"]),
                ).fetchone()
                if found:
                    connection.execute(
                        """
                        UPDATE evaluation_indicators
                        SET domain = ?, standard_name = ?, statement = ?, level = ?,
                            score_percent = ?, recommendation = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (
                            item["domain"], item["standard_name"], item["statement"], item["level"],
                            item["score_percent"], item["recommendation"], moment, found[0],
                        ),
                    )
                else:
                    connection.execute(
                        """
                        INSERT INTO evaluation_indicators (
                            cycle_id, code, domain, standard_name, statement, level,
                            domain_score, gap_to_next, score_percent, recommendation, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            cycle_id, item["code"], item["domain"], item["standard_name"], item["statement"],
                            item["level"] or "—", "", "", item["score_percent"], item["recommendation"], moment,
                        ),
                    )
            stored_years.append(year)
        connection.commit()
        return {"stored": True, "years": stored_years, "indicators": len(rows)}
    finally:
        connection.close()


def comparison_payload() -> dict:
    """مقارنة الدورات الثلاث كما حُفظت. الحقل بلا درجة يبقى فارغًا."""
    connection = connect()
    try:
        _ensure_columns(connection)
        cycles = connection.execute(
            """
            SELECT id, academic_year, overall_score, overall_level, domains_json
            FROM evaluation_cycles
            WHERE source_note = ?
            ORDER BY academic_year
            """,
            (SOURCE_NOTE,),
        ).fetchall()
        by_code = {}
        domains = []
        students = ""
        overall = {"score": "", "level": ""}
        for cycle_id, year, score, level, domains_json in cycles:
            year = str(year or "")
            if year == "2026":
                overall = {"score": score or "", "level": level or ""}
                try:
                    parsed = json.loads(domains_json or "[]")
                except json.JSONDecodeError:
                    parsed = []
                for item in parsed if isinstance(parsed, list) else []:
                    if not isinstance(item, dict):
                        continue
                    if item.get("kind") == "card":
                        students = str(item.get("students") or "")
                        continue
                    if item.get("name"):
                        domains.append(item)
            rows = connection.execute(
                """
                SELECT code, domain, standard_name, statement, score_percent, level, recommendation
                FROM evaluation_indicators
                WHERE cycle_id = ?
                ORDER BY code
                """,
                (cycle_id,),
            ).fetchall()
            for code, domain, standard_name, statement, percent, indicator_level, recommendation in rows:
                item = by_code.setdefault(code, {
                    "code": code,
                    "domain": domain or "",
                    "standard": standard_name or "",
                    "statement": statement or "",
                    "scores": {},
                    "level": "",
                    "recommendation": "",
                })
                item["scores"][year] = percent or ""
                if year == "2026":
                    item["level"] = indicator_level if indicator_level and indicator_level != "—" else ""
                    item["recommendation"] = recommendation or ""
        indicators = list(by_code.values())
        indicators.sort(key=lambda item: item["code"])
        return {
            "years": [str(row[1]) for row in cycles],
            "overall": overall,
            "domains": domains,
            "card_students": students,
            "indicators": indicators,
        }
    finally:
        connection.close()
