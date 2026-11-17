# التقويم الخارجي — قرار 284.
# الصفوف الكلية 2024/2025/2026 من بيان المستخدم، ومستوى 2025 من ملف الأداء المحفوظ.
# لا تُستبدل الصفوف الموجودة، ولا تُحذف.

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from .database import connect

router = APIRouter(tags=["external-evaluations"])

_SEEDS = (
    (2024, "OVERALL", 70.0, "", "الأداء العام"),
    (2025, "OVERALL", 71.0, "انطلاق", "الدرجة الكلية للتقرير الخارجي"),
    (2026, "OVERALL", 68.0, "", "الأداء العام"),
)


def _user(token: str) -> dict:
    from .access import require_user

    try:
        return require_user(str(token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def ensure_external_evaluations(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS external_evaluations (
            id INTEGER PRIMARY KEY,
            year INTEGER NOT NULL,
            indicator_code TEXT NOT NULL,
            score REAL,
            level TEXT,
            description TEXT,
            UNIQUE (year, indicator_code)
        )
        """
    )
    for year, code, score, level, description in _SEEDS:
        connection.execute(
            """
            INSERT INTO external_evaluations (year, indicator_code, score, level, description)
            SELECT ?, ?, ?, ?, ?
            WHERE NOT EXISTS (
                SELECT 1 FROM external_evaluations
                WHERE year = ? AND indicator_code = ?
            )
            """,
            (year, code, score, level, description, year, code),
        )


@router.get("/api/session/external-evaluations")
def list_external_evaluations(x_session_token: str = Header(default="")):
    _user(x_session_token)
    connection = connect()
    try:
        ensure_external_evaluations(connection)
        connection.commit()
        rows = connection.execute(
            """
            SELECT id, year, indicator_code, score, level, description
            FROM external_evaluations
            ORDER BY indicator_code, year
            """
        ).fetchall()
        return {
            "items": [
                {
                    "id": row[0],
                    "year": row[1],
                    "indicator_code": row[2] or "",
                    "score": row[3],
                    "level": row[4] or "",
                    "description": row[5] or "",
                }
                for row in rows
            ]
        }
    finally:
        connection.close()
