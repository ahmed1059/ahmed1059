"""دخول المدير، جلساته، ونسخ قاعدة المدرسة."""

import hashlib
import json
import re
import secrets
import sqlite3
from datetime import datetime
from pathlib import Path

BACKUP_NAME = re.compile(r"^school_1059_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}(?:-\d{2})?\.db$")


def _connect():
    from .database import connect

    return connect()


def _db_path():
    from .database import DB_PATH

    return DB_PATH


def trial_config_path():
    return Path(__file__).resolve().parent.parent / "config" / "trial_launch.json"


def load_trial_config():
    path = trial_config_path()
    if not path.is_file():
        return {"enabled": False}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"enabled": False}
    return data if isinstance(data, dict) else {"enabled": False}


def seed_trial_accounts(connection=None, password=None, overwrite=False):
    """ينشئ حساب دخول لكل منسوب في noor_staff لمرحلة التجربة المدرسية."""
    own = connection is None
    if own:
        connection = _connect()
    created = 0
    updated = 0
    skipped = 0
    try:
        cfg = load_trial_config()
        secret = str(password or cfg.get("password") or "1448")
        if len(secret) < 4:
            raise ValueError("كلمة المرور قصيرة")
        stored = hash_password(secret)
        rows = connection.execute(
            """
            SELECT national_id, name, role, specialty
            FROM noor_staff
            WHERE national_id IS NOT NULL AND trim(national_id) != ''
            ORDER BY national_id
            """
        ).fetchall()
        for national_id, name, role, specialty in rows:
            identity = str(national_id or "").strip()
            if not identity:
                skipped += 1
                continue
            current = connection.execute(
                "SELECT id, password_hash FROM users WHERE national_id = ?",
                (identity,),
            ).fetchone()
            if current:
                has_secret = bool(str(current[1] or "").strip())
                if has_secret and not overwrite:
                    skipped += 1
                    continue
                connection.execute(
                    """
                    UPDATE users
                    SET password_hash = ?, name = ?, role = ?, specialty = ?
                    WHERE national_id = ?
                    """,
                    (stored, name or "", role or "", specialty or "", identity),
                )
                updated += 1
            else:
                connection.execute(
                    """
                    INSERT INTO users (
                        national_id, name, role, specialty, password_hash, failed_attempts
                    ) VALUES (?, ?, ?, ?, ?, 0)
                    """,
                    (identity, name or "", role or "", specialty or "", stored),
                )
                created += 1
        if own:
            connection.commit()
        return {
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "total": len(rows),
            "password_set": secret,
        }
    finally:
        if own:
            connection.close()


def backup_dir():
    folder = _db_path().parent.parent / "backups"
    folder.mkdir(exist_ok=True)
    return folder


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        str(password or "").encode("utf-8"),
        bytes.fromhex(salt),
        200_000,
    ).hex()
    return f"{salt}${digest}"


def verify_password(password, stored):
    text = str(stored or "")
    if "$" not in text:
        return False
    salt, digest = text.split("$", 1)
    try:
        check = hash_password(password, salt).split("$", 1)[1]
    except ValueError:
        return False
    return secrets.compare_digest(check, digest)


def prepare_access(connection):
    """جدول الجلسة، ومستخدم المدير مرة واحدة، وإصلاحات البيانات المتفق عليها."""
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_sessions (
            token TEXT PRIMARY KEY,
            national_id TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(auth_sessions)")}
    if "limited" not in columns:
        connection.execute(
            "ALTER TABLE auth_sessions ADD COLUMN limited INTEGER NOT NULL DEFAULT 0"
        )
    if "chosen_role" not in columns:
        connection.execute(
            "ALTER TABLE auth_sessions ADD COLUMN chosen_role TEXT NOT NULL DEFAULT ''"
        )
    principal = connection.execute(
        """
        SELECT national_id, name, role, specialty
        FROM noor_staff
        WHERE role LIKE 'مدير%'
        ORDER BY national_id
        LIMIT 1
        """
    ).fetchone()
    if principal and not connection.execute(
        "SELECT id FROM users WHERE national_id = ?",
        (principal[0],),
    ).fetchone():
        connection.execute(
            """
            INSERT INTO users (
                national_id, name, role, specialty, password_hash, failed_attempts
            ) VALUES (?, ?, ?, ?, ?, 0)
            """,
            (principal[0], principal[1], principal[2], principal[3] or "", hash_password("admin")),
        )
    for (national_id,) in connection.execute("SELECT national_id FROM noor_students"):
        text = str(national_id or "").strip()
        if not text.isdigit() or len(text) >= 10:
            continue
        padded = text.zfill(10)
        if connection.execute(
            "SELECT 1 FROM noor_students WHERE national_id = ?",
            (padded,),
        ).fetchone():
            continue
        connection.execute(
            "UPDATE noor_students SET national_id = ? WHERE national_id = ?",
            (padded, text),
        )
    first = connection.execute(
        "SELECT id FROM school_programs WHERE id = 2 AND program_name = ?",
        ("التوجيه المهني والتعليمي",),
    ).fetchone()
    second = connection.execute(
        "SELECT id FROM school_programs WHERE id = 3 AND program_name = ?",
        ("التوجيه المهني والتعليمي",),
    ).fetchone()
    if first and second:
        connection.execute(
            "UPDATE school_programs SET is_deleted = 1 WHERE id = 3 AND COALESCE(is_deleted, 0) = 0"
        )
    cfg = load_trial_config()
    if cfg.get("enabled") and cfg.get("seed_accounts"):
        seed_trial_accounts(
            connection,
            password=cfg.get("password"),
            overwrite=bool(cfg.get("overwrite_passwords")),
        )


def _user_row(connection, national_id):
    return connection.execute(
        """
        SELECT national_id, name, role, password_hash
        FROM users
        WHERE national_id = ?
        """,
        (national_id,),
    ).fetchone()


def _session_role(account_role, staff_role):
    """دور الحساب يغلب سجل المنسوب إذا كان الحساب مدير النظام أو مدير المدرسة."""
    account = str(account_role or "").strip()
    staff = str(staff_role or "").strip()
    if account in {"visitor", "مشرف زائر"}:
        return "مشرف زائر"
    if account.startswith("مدير"):
        return account
    return staff or account


def entry_roles(account_role, staff_role):
    """خيار الدخول يظهر فقط إذا كان الحساب مديرًا وسجل المنسوب دورًا آخر."""
    account = str(account_role or "").strip()
    staff = str(staff_role or "").strip()
    primary = _session_role(account, staff)
    if account.startswith("مدير") and staff and staff != account and not staff.startswith("مدير"):
        return [account, staff]
    return [primary] if primary else []


def login(national_id, password):
    identity = str(national_id or "").strip()
    connection = _connect()
    try:
        row = _user_row(connection, identity)
        if not row or not verify_password(password, row[3]):
            return None
        try:
            flag = connection.execute(
                "SELECT COALESCE(is_active, 1) FROM users WHERE national_id = ?",
                (identity,),
            ).fetchone()
        except sqlite3.OperationalError:
            flag = (1,)
        if flag and int(flag[0] or 0) != 1:
            return None
        token = secrets.token_urlsafe(32)
        moment = datetime.now().replace(microsecond=0).isoformat(sep=" ")
        cfg = load_trial_config()
        trial = str(cfg.get("password") or "")
        limited = 0
        if not cfg.get("open_all_windows") and trial and secrets.compare_digest(str(password or ""), trial):
            limited = 1
        connection.execute(
            """
            INSERT INTO auth_sessions (token, national_id, created_at, limited)
            VALUES (?, ?, ?, ?)
            """,
            (token, identity, moment, limited),
        )
        connection.commit()
        staff = connection.execute(
            "SELECT role FROM noor_staff WHERE national_id = ?",
            (identity,),
        ).fetchone()
        staff_role = staff[0] if staff else ""
        roles = entry_roles(row[2], staff_role)
        role = roles[0] if roles else ""
        return {
            "id": row[0],
            "name": row[1] or "",
            "role": role,
            "roles": roles,
            "token": token,
            "must_change_password": bool(limited),
        }
    finally:
        connection.close()


def session_is_limited(token):
    if load_trial_config().get("open_all_windows"):
        return False
    key = str(token or "").strip()
    if not key:
        return False
    connection = _connect()
    try:
        row = connection.execute(
            "SELECT COALESCE(limited, 0) FROM auth_sessions WHERE token = ?",
            (key,),
        ).fetchone()
    except sqlite3.OperationalError:
        return False
    finally:
        connection.close()
    if not row:
        return False
    try:
        return int(row[0] or 0) == 1
    except (TypeError, ValueError):
        return False


def session_user(token):
    key = str(token or "").strip()
    if not key:
        return None
    connection = _connect()
    try:
        row = connection.execute(
            """
            SELECT users.national_id, users.name, users.role, noor_staff.role,
                   COALESCE(users.is_active, 1),
                   COALESCE(auth_sessions.limited, 0),
                   COALESCE(auth_sessions.chosen_role, '')
            FROM auth_sessions
            JOIN users ON users.national_id = auth_sessions.national_id
            LEFT JOIN noor_staff ON noor_staff.national_id = users.national_id
            WHERE auth_sessions.token = ?
            """,
            (key,),
        ).fetchone()
    finally:
        connection.close()
    if not row:
        return None
    try:
        if int(row[4] or 0) != 1:
            return None
    except (TypeError, ValueError, IndexError):
        pass
    roles = entry_roles(row[2], row[3])
    chosen = str(row[6] or "").strip() if len(row) > 6 else ""
    role = chosen if chosen in roles else (roles[0] if roles else "")
    try:
        limited = int(row[5] or 0) == 1
    except (TypeError, ValueError, IndexError):
        limited = False
    if load_trial_config().get("open_all_windows"):
        limited = False
    return {
        "id": row[0],
        "name": row[1] or "",
        "role": role,
        "roles": roles,
        "must_change_password": limited,
    }


def set_session_role(token, role):
    """يثبت دور هذه الجلسة فقط. لا يغيّر users.role ولا سجل المنسوبين."""
    key = str(token or "").strip()
    wanted = " ".join(str(role or "").split())
    if not key or not wanted:
        raise ValueError("الدور مطلوب")
    connection = _connect()
    try:
        row = connection.execute(
            """
            SELECT users.role, noor_staff.role
            FROM auth_sessions
            JOIN users ON users.national_id = auth_sessions.national_id
            LEFT JOIN noor_staff ON noor_staff.national_id = users.national_id
            WHERE auth_sessions.token = ?
            """,
            (key,),
        ).fetchone()
        if not row:
            raise PermissionError("لا جلسة")
        allowed = entry_roles(row[0], row[1])
        if wanted not in allowed:
            raise ValueError("هذا الدور غير متاح لهذا الحساب")
        connection.execute(
            "UPDATE auth_sessions SET chosen_role = ? WHERE token = ?",
            (wanted, key),
        )
        connection.commit()
    finally:
        connection.close()
    return wanted


def require_user(token):
    user = session_user(token)
    if not user:
        raise PermissionError("لا جلسة")
    return user


def require_principal(token):
    user = require_user(token)
    if not str(user["role"]).startswith("مدير"):
        raise PermissionError("هذا الإجراء للمدير")
    return user


def change_own_password(national_id, password):
    """يبدّل كلمة الحساب وحده، ولا يمس الدور ولا سجل المنسوبين."""
    identity = str(national_id or "").strip()
    secret = str(password or "")
    if len(secret) < 6:
        raise ValueError("كلمة المرور لا تقل عن 6 أحرف")
    trial = str(load_trial_config().get("password") or "")
    if trial and secrets.compare_digest(secret, trial):
        raise ValueError("اختر كلمة غير كلمة التجربة")
    connection = _connect()
    try:
        current = connection.execute(
            "SELECT id FROM users WHERE national_id = ?",
            (identity,),
        ).fetchone()
        if not current:
            raise ValueError("الحساب غير موجود")
        connection.execute(
            "UPDATE users SET password_hash = ? WHERE national_id = ?",
            (hash_password(secret), identity),
        )
        connection.execute(
            "UPDATE auth_sessions SET limited = 0 WHERE national_id = ?",
            (identity,),
        )
        connection.commit()
    finally:
        connection.close()


def set_password(national_id, password):
    identity = str(national_id or "").strip()
    secret = str(password or "")
    if len(secret) < 4:
        raise ValueError("كلمة المرور قصيرة")
    connection = _connect()
    try:
        staff = connection.execute(
            "SELECT name, role, specialty FROM noor_staff WHERE national_id = ?",
            (identity,),
        ).fetchone()
        if not staff:
            raise ValueError("المنسوب غير موجود في السجل")
        stored = hash_password(secret)
        current = connection.execute(
            "SELECT id, role FROM users WHERE national_id = ?",
            (identity,),
        ).fetchone()
        role = staff[1] or ""
        if current and str(current[1] or "").startswith("مدير") and not role.startswith("مدير"):
            role = current[1]
        if current:
            connection.execute(
                "UPDATE users SET password_hash = ?, name = ?, role = ? WHERE national_id = ?",
                (stored, staff[0], role, identity),
            )
        else:
            connection.execute(
                """
                INSERT INTO users (
                    national_id, name, role, specialty, password_hash, failed_attempts
                ) VALUES (?, ?, ?, ?, ?, 0)
                """,
                (identity, staff[0], staff[1] or "", staff[2] or "", stored),
            )
        connection.commit()
    finally:
        connection.close()


def users_with_password():
    connection = _connect()
    try:
        rows = connection.execute(
            """
            SELECT national_id,
                   CASE WHEN password_hash IS NULL OR trim(password_hash) = '' THEN 0 ELSE 1 END
            FROM users
            """
        ).fetchall()
    finally:
        connection.close()
    return [{"national_id": row[0], "has_password": bool(row[1])} for row in rows]


def _backup_path(name):
    filename = Path_name(name)
    folder = backup_dir()
    path = (folder / filename).resolve()
    if path.parent != folder.resolve() or not BACKUP_NAME.match(filename):
        raise ValueError("اسم النسخة غير صالح")
    return path


def Path_name(name):
    return str(name or "").strip()


def list_backups():
    folder = backup_dir()
    rows = []
    for path in folder.glob("school_1059_*.db"):
        if not BACKUP_NAME.match(path.name):
            continue
        stamp = path.stat()
        rows.append({
            "name": path.name,
            "bytes": stamp.st_size,
            "modified": datetime.fromtimestamp(stamp.st_mtime).replace(microsecond=0).isoformat(sep=" "),
        })
    rows.sort(key=lambda item: item["name"], reverse=True)
    return rows


def create_backup():
    folder = backup_dir()
    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    name = f"school_1059_{stamp}.db"
    path = folder / name
    if path.exists():
        name = datetime.now().strftime("school_1059_%Y-%m-%d_%H-%M-%S.db")
        path = folder / name
    source = sqlite3.connect(_db_path())
    target = sqlite3.connect(path)
    try:
        source.backup(target)
    finally:
        source.close()
        target.close()
    return {"name": path.name, "bytes": path.stat().st_size}


def restore_backup(name):
    path = _backup_path(name)
    if not path.is_file():
        raise ValueError("النسخة غير موجودة")
    source = sqlite3.connect(path)
    target = sqlite3.connect(_db_path())
    try:
        source.backup(target)
    finally:
        source.close()
        target.close()
    return {"name": path.name}
