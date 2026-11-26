# توحيد SSOT الطلاب للبوابة: students_registry.json مرجعي + دمج مع noor_students.
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATHS = [
    ROOT / "Print_Canvas" / "banks" / "students_registry.json",
    ROOT / "Core_Engine" / "database" / "students_registry.json",
]

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS portal_ssot_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS portal_guardian_index (
    phone_norm TEXT NOT NULL,
    student_nid TEXT NOT NULL,
    student_name TEXT NOT NULL DEFAULT '',
    grade TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (phone_norm, student_nid)
);
CREATE INDEX IF NOT EXISTS ix_portal_guardian_phone ON portal_guardian_index(phone_norm);
"""


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _load_registry() -> list[dict]:
    for path in REGISTRY_PATHS:
        if not path.is_file():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        rows = data.get("students") if isinstance(data, dict) else data
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]
    return []


def normalize_phone(value: str) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if digits.startswith("00966"):
        digits = digits[5:]
    elif digits.startswith("966"):
        digits = digits[3:]
    if digits.startswith("0") and len(digits) == 10:
        digits = digits[1:]
    return digits


def phone_last4(value: str) -> str:
    digits = normalize_phone(value)
    return digits[-4:] if len(digits) >= 4 else ""


def ensure_student_portal_columns(connection) -> None:
    columns = {row[1] for row in connection.execute("PRAGMA table_info(noor_students)")}
    if "guardian_phone" not in columns:
        connection.execute("ALTER TABLE noor_students ADD COLUMN guardian_phone TEXT")
    if "portal_source" not in columns:
        connection.execute("ALTER TABLE noor_students ADD COLUMN portal_source TEXT")
    if "portal_synced_at" not in columns:
        connection.execute("ALTER TABLE noor_students ADD COLUMN portal_synced_at TEXT")


def sync_student_ssot(connection, force: bool = False) -> dict:
    """يدمج السجل المرجعي (341) مع جدول نور الحي ويبني فهرس الجوال←الأبناء."""
    connection.executescript(SCHEMA_SQL)
    ensure_student_portal_columns(connection)
    last = connection.execute(
        "SELECT value FROM portal_ssot_meta WHERE key = 'synced_at' LIMIT 1"
    ).fetchone()
    if last and last[0] and not force:
        count = connection.execute(
            "SELECT COUNT(*) FROM noor_students WHERE COALESCE(is_deleted,0)=0"
        ).fetchone()[0]
        phones = connection.execute("SELECT COUNT(*) FROM portal_guardian_index").fetchone()[0]
        return {
            "ok": True,
            "synced": False,
            "students": int(count or 0),
            "guardian_links": int(phones or 0),
            "synced_at": last[0],
        }

    registry = _load_registry()
    db_rows = {
        str(row[0] or "").strip(): {
            "name": str(row[1] or "").strip(),
            "grade": str(row[2] or "").strip(),
            "classroom": str(row[3] or "").strip(),
            "status": str(row[4] or "").strip(),
            "guardian_phone": str(row[5] or "").strip() if len(row) > 5 else "",
        }
        for row in connection.execute(
            """
            SELECT national_id, name, grade, classroom, status, guardian_phone
            FROM noor_students
            WHERE COALESCE(is_deleted, 0) = 0
            """
        ).fetchall()
        if str(row[0] or "").strip()
    }

    reg_ids = set()
    updated = 0
    inserted = 0
    with_phone = 0
    stamp = _now()

    for row in registry:
        nid = str(row.get("student_nid") or row.get("national_id") or "").strip()
        name = str(row.get("student_name") or row.get("name") or "").strip()
        grade = str(row.get("grade") or "").strip()
        section = str(row.get("section") or row.get("classroom") or "").strip()
        phone = str(row.get("guardian_phone") or "").strip()
        if not nid or not name:
            continue
        reg_ids.add(nid)
        if phone:
            with_phone += 1
        if nid in db_rows:
            connection.execute(
                """
                UPDATE noor_students
                SET name = ?,
                    grade = CASE WHEN ? != '' THEN ? ELSE grade END,
                    classroom = CASE WHEN ? != '' THEN ? ELSE classroom END,
                    guardian_phone = CASE WHEN ? != '' THEN ? ELSE guardian_phone END,
                    portal_source = 'registry+noor',
                    portal_synced_at = ?,
                    is_deleted = 0
                WHERE national_id = ?
                """,
                (name, grade, grade, section, section, phone, phone, stamp, nid),
            )
            updated += 1
        else:
            connection.execute(
                """
                INSERT INTO noor_students (
                    national_id, name, grade, classroom, status, updated_at, is_deleted,
                    guardian_phone, portal_source, portal_synced_at
                ) VALUES (?, ?, ?, ?, 'مستجد', ?, 0, ?, 'registry', ?)
                """,
                (nid, name, grade, section, stamp, phone, stamp),
            )
            inserted += 1

    only_db = sorted(set(db_rows) - reg_ids)
    only_reg = sorted(reg_ids - set(db_rows))
    for nid in only_db:
        connection.execute(
            """
            UPDATE noor_students
            SET portal_source = COALESCE(NULLIF(portal_source,''), 'noor-only'),
                portal_synced_at = ?
            WHERE national_id = ?
            """,
            (stamp, nid),
        )

    connection.execute("DELETE FROM portal_guardian_index")
    links = 0
    for row in connection.execute(
        """
        SELECT national_id, name, grade, classroom, guardian_phone
        FROM noor_students
        WHERE COALESCE(is_deleted,0)=0
          AND TRIM(COALESCE(guardian_phone,'')) != ''
        """
    ).fetchall():
        phone_norm = normalize_phone(row[4])
        if len(phone_norm) < 8:
            continue
        connection.execute(
            """
            INSERT OR REPLACE INTO portal_guardian_index
            (phone_norm, student_nid, student_name, grade, section)
            VALUES (?, ?, ?, ?, ?)
            """,
            (phone_norm, row[0], row[1] or "", row[2] or "", row[3] or ""),
        )
        links += 1

    report = {
        "registry_count": len(registry),
        "db_before": len(db_rows),
        "updated": updated,
        "inserted": inserted,
        "with_phone_registry": with_phone,
        "guardian_links": links,
        "only_db_count": len(only_db),
        "only_reg_count": len(only_reg),
        "only_db_sample": only_db[:15],
        "only_reg_sample": only_reg[:15],
        "synced_at": stamp,
    }
    connection.execute(
        """
        INSERT INTO portal_ssot_meta(key, value) VALUES('synced_at', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (stamp,),
    )
    connection.execute(
        """
        INSERT INTO portal_ssot_meta(key, value) VALUES('diff_report', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (json.dumps(report, ensure_ascii=False),),
    )
    total = connection.execute(
        "SELECT COUNT(*) FROM noor_students WHERE COALESCE(is_deleted,0)=0"
    ).fetchone()[0]
    return {"ok": True, "synced": True, "students": int(total or 0), "report": report}


def find_student(connection, national_id: str) -> dict | None:
    nid = str(national_id or "").strip()
    if not nid:
        return None
    row = connection.execute(
        """
        SELECT national_id, name, grade, classroom, status, guardian_phone
        FROM noor_students
        WHERE national_id = ? AND COALESCE(is_deleted,0)=0
        LIMIT 1
        """,
        (nid,),
    ).fetchone()
    if not row:
        return None
    return {
        "national_id": row[0] or "",
        "name": row[1] or "",
        "grade": row[2] or "",
        "section": row[3] or "",
        "status": row[4] or "",
        "guardian_phone": row[5] or "",
        "phone_last4": phone_last4(row[5] or ""),
    }


def children_by_phone(connection, phone: str) -> list[dict]:
    norm = normalize_phone(phone)
    if len(norm) < 8:
        return []
    rows = connection.execute(
        """
        SELECT student_nid, student_name, grade, section
        FROM portal_guardian_index
        WHERE phone_norm = ?
        ORDER BY student_name
        """,
        (norm,),
    ).fetchall()
    # fallback: match last 9 digits if stored with country code variance
    if not rows and len(norm) >= 9:
        rows = connection.execute(
            """
            SELECT student_nid, student_name, grade, section
            FROM portal_guardian_index
            WHERE phone_norm LIKE ?
            ORDER BY student_name
            """,
            ("%" + norm[-9:],),
        ).fetchall()
    return [
        {
            "national_id": r[0],
            "name": r[1],
            "grade": r[2],
            "section": r[3],
        }
        for r in rows
    ]
