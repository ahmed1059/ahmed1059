# آراء المعاينة. تُحفظ وحدها ولا تكتب في البرامج أو الإعدادات.

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["staff-opinions"])


def ensure_staff_opinions_table(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS staff_opinions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            national_id TEXT NOT NULL,
            author_name TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT '',
            screen TEXT NOT NULL DEFAULT '',
            body TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )


def _require_user(token: str) -> dict:
    from .access import require_user

    try:
        return require_user(str(token or "").strip())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def _principal(role: str) -> bool:
    return str(role or "").startswith("مدير")


class OpinionBody(BaseModel):
    text: str = ""
    screen: str = ""


def _row(item) -> dict:
    return {
        "id": item[0],
        "national_id": item[1] or "",
        "author_name": item[2] or "",
        "role": item[3] or "",
        "screen": item[4] or "",
        "text": item[5] or "",
        "created_at": item[6] or "",
    }


@router.get("/api/session/opinions")
def list_opinions(x_session_token: str = Header(default="")):
    user = _require_user(x_session_token)
    from .database import connect

    connection = connect()
    try:
        ensure_staff_opinions_table(connection)
        if _principal(user.get("role") or ""):
            rows = connection.execute(
                """
                SELECT id, national_id, author_name, role, screen, body, created_at
                FROM staff_opinions
                ORDER BY id DESC
                LIMIT 200
                """
            ).fetchall()
            scope = "all"
        else:
            rows = connection.execute(
                """
                SELECT id, national_id, author_name, role, screen, body, created_at
                FROM staff_opinions
                WHERE national_id = ?
                ORDER BY id DESC
                LIMIT 50
                """,
                (user.get("id") or "",),
            ).fetchall()
            scope = "mine"
    finally:
        connection.close()
    return {"scope": scope, "items": [_row(item) for item in rows]}


@router.post("/api/session/opinions")
def add_opinion(body: OpinionBody, x_session_token: str = Header(default="")):
    user = _require_user(x_session_token)
    text = " ".join(str(body.text or "").split())
    if len(text) < 2:
        raise HTTPException(status_code=400, detail="اكتب الرأي أولاً")
    if len(text) > 2000:
        text = text[:2000]
    screen = str(body.screen or "").strip()[:120]
    moment = datetime.now().replace(microsecond=0).isoformat(sep=" ")
    from .database import connect

    connection = connect()
    try:
        ensure_staff_opinions_table(connection)
        cursor = connection.execute(
            """
            INSERT INTO staff_opinions (
                national_id, author_name, role, screen, body, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                user.get("id") or "",
                user.get("name") or "",
                user.get("role") or "",
                screen,
                text,
                moment,
            ),
        )
        connection.commit()
        opinion_id = cursor.lastrowid
    finally:
        connection.close()
    return {"ok": True, "id": opinion_id}
