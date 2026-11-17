# فحص النظام للمدير. يقرأ الأعداد ولا يكتب.

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

router = APIRouter(tags=["health"])


def _principal(token: str) -> dict:
    from .access import require_principal

    try:
        return require_principal(str(token or "").strip())
    except PermissionError as error:
        text = str(error)
        status = 403 if "مدير" in text else 401
        raise HTTPException(status_code=status, detail=text) from error


@router.get("/api/session/health")
def health(x_session_token: str = Header(default="")):
    _principal(x_session_token)
    import audit_data

    report = audit_data.collect()
    return report
