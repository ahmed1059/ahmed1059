# قراءة بنك المحتوى ودمج تعديلات المدرسة دون تعديل ملف JSON الافتراضي
# لا يُنفَّذ شيء عند الاستيراد

import json
import re
from pathlib import Path

from .database import connect

_TASK_PATH = re.compile(
    r"^tasks\.(.+)\.(title|execution_method|execution_time|evidence|deleted|added)$"
)
_SWOT_PATH = re.compile(r"^swot\.(strength|weakness|opportunity|threat)$")
_DECK_ROLES = (
    "principal",
    "vice_teachers",
    "vice_students",
    "student_counselor",
    "activity_leader",
)

_BANK_DIR = Path(__file__).resolve().parent / "content_bank"


class ContentError(Exception):
    """خطأ محتوى برمز HTTP للمسار الذي يستدعي الدالة."""

    def __init__(self, detail, status):
        super().__init__(detail)
        self.status = status


def _role_path(role):
    """يبني مسار ملف الدور داخل مجلد البنك ويرفض الخروج منه."""
    if not role or Path(role).name != role or not role.replace("_", "").isalpha():
        raise ContentError("الدور غير صالح", 400)
    path = (_BANK_DIR / f"{role}.json").resolve()
    if path.parent != _BANK_DIR.resolve():
        raise ContentError("الدور غير صالح", 400)
    if not path.is_file():
        raise ContentError("ملف المحتوى غير موجود", 404)
    return path


def _ensure_deck_role(role):
    """أدوار الشرائح الخمسة، ولو لم يكن لها ملف محتوى."""
    if role not in _DECK_ROLES:
        raise ContentError("الدور غير صالح", 400)


def _task_code_ok(code):
    """رمز البند كما في البنك، بلا فراغ ولا شرطة مائلة."""
    if not code or code.strip() != code or code.startswith(".") or code.endswith("."):
        return False
    return "/" not in code and "\\" not in code


def _load_default(role):
    """يقرأ النص الافتراضي كما هو من ملف البنك."""
    return json.loads(_role_path(role).read_text(encoding="utf-8"))


def _walk(node, part):
    """ينزل مستوى واحدًا في القاموس أو القائمة."""
    if isinstance(node, list):
        try:
            return node[int(part)]
        except (ValueError, IndexError) as error:
            raise ContentError("مسار الحقل غير موجود", 400) from error
    if isinstance(node, dict) and part in node:
        return node[part]
    raise ContentError("مسار الحقل غير موجود", 400)


def _put(node, part, value):
    """يكتب القيمة في آخر جزء من المسار."""
    if isinstance(node, list):
        try:
            node[int(part)] = value
            return
        except (ValueError, IndexError) as error:
            raise ContentError("مسار الحقل غير موجود", 400) from error
    node[part] = value


def _as_json(value):
    """يحوّل النص إلى JSON إن كان صالحًا، وإلا يعيد None."""
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _coerce(current, value):
    """يبقي شكل الحقل الافتراضي: نص، أو قائمة أسماء، أو فقرات، أو JSON."""
    if isinstance(current, str):
        return value
    if not isinstance(current, list):
        parsed = _as_json(value)
        if isinstance(current, dict) and isinstance(parsed, dict):
            return parsed
        raise ContentError("قيمة الحقل لا تطابق شكله", 400)
    parsed = _as_json(value)
    if isinstance(parsed, list):
        return parsed
    text = value.replace("\r\n", "\n")
    if current and all(isinstance(item, dict) and "name" in item and "id" not in item for item in current):
        names = [line.strip() for line in text.split("\n") if line.strip()]
        rebuilt = []
        for index, name in enumerate(names):
            icon = current[index].get("icon", "") if index < len(current) else ""
            rebuilt.append({"name": name, "icon": icon})
        return rebuilt
    if not current or isinstance(current[0], str):
        return [part.strip() for part in text.split("\n\n") if part.strip()]
    raise ContentError("قيمة الحقل لا تطابق شكله", 400)


def _apply(data, field_path, value):
    """يدمج قيمة محفوظة في المسار مثل vision.text دون المساس بالملف."""
    parts = [part for part in field_path.split(".") if part]
    if not parts or len(parts) != len(field_path.split(".")):
        raise ContentError("مسار الحقل غير صالح", 400)
    node = data
    for part in parts[:-1]:
        node = _walk(node, part)
    current = _walk(node, parts[-1])
    _put(node, parts[-1], _coerce(current, value))


def _rows(role, school_id):
    """يقرأ تعديلات الدور للمدرسة، أو التعديل العام إن لم تُحدد مدرسة."""
    connection = connect()
    try:
        if school_id is None:
            return connection.execute(
                """
                SELECT field_path, value FROM content_overrides
                WHERE role = ? AND school_id IS NULL
                """,
                (role,),
            ).fetchall()
        return connection.execute(
            """
            SELECT field_path, value FROM content_overrides
            WHERE role = ? AND school_id = ?
            """,
            (role, school_id),
        ).fetchall()
    finally:
        connection.close()


def load_role_content(role, school_id=None):
    """يعيد النسخة المدمجة: التعديل يفوز على النص الافتراضي."""
    data = _load_default(role)
    for field_path, value in _rows(role, school_id):
        if field_path.startswith("tasks.") or field_path.startswith("swot."):
            continue
        _apply(data, field_path, value)
    return data


def list_swot_overrides(school_id=None):
    """تعديلات التحليل الرباعي المحفوظة لخطة المدير، وتظهر في كل الأدوار."""
    found = {}
    for field_path, value in _rows("principal", school_id):
        if _SWOT_PATH.match(field_path):
            found[field_path] = "" if value is None else str(value)
    return found


def save_swot_override(field_path, value, school_id=None):
    """يحفظ نص مربع التحليل كما كتبه المستخدم، على خطة المدير."""
    if not _SWOT_PATH.match(field_path):
        raise ContentError("مسار الحقل غير صالح", 400)
    stored = "" if value is None else str(value).strip()
    connection = connect()
    try:
        if school_id is None:
            connection.execute(
                """
                DELETE FROM content_overrides
                WHERE role = ? AND field_path = ? AND school_id IS NULL
                """,
                ("principal", field_path),
            )
        else:
            connection.execute(
                """
                DELETE FROM content_overrides
                WHERE role = ? AND field_path = ? AND school_id = ?
                """,
                ("principal", field_path, school_id),
            )
        connection.execute(
            """
            INSERT INTO content_overrides
                (school_id, role, field_path, value, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (school_id, "principal", field_path, stored),
        )
        connection.commit()
    finally:
        connection.close()
    return stored


def list_task_overrides(role, school_id=None):
    """تعديلات خلايا المهام فقط. مسارها لا يدخل بنك المحتوى."""
    _ensure_deck_role(role)
    found = {}
    for field_path, value in _rows(role, school_id):
        if _TASK_PATH.match(field_path):
            found[field_path] = "" if value is None else str(value)
    return found


def save_task_override(role, field_path, value, school_id=None):
    """يحفظ نص الخلية كما كتبه المستخدم، بلا مرور على بنك المحتوى."""
    _ensure_deck_role(role)
    match = _TASK_PATH.match(field_path)
    if not match or not _task_code_ok(match.group(1)):
        raise ContentError("مسار الحقل غير صالح", 400)
    stored = "" if value is None else str(value).strip()
    connection = connect()
    try:
        if school_id is None:
            connection.execute(
                """
                DELETE FROM content_overrides
                WHERE role = ? AND field_path = ? AND school_id IS NULL
                """,
                (role, field_path),
            )
        else:
            connection.execute(
                """
                DELETE FROM content_overrides
                WHERE role = ? AND field_path = ? AND school_id = ?
                """,
                (role, field_path, school_id),
            )
        connection.execute(
            """
            INSERT INTO content_overrides
                (school_id, role, field_path, value, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (school_id, role, field_path, stored),
        )
        connection.commit()
    finally:
        connection.close()
    return stored


def next_custom_code(overrides):
    """الرمز التالي لبند مضاف، مثل custom.1 ثم custom.2."""
    highest = 0
    for field_path in overrides:
        parts = field_path.split(".")
        if len(parts) >= 4 and parts[0] == "tasks" and parts[1] == "custom" and parts[2].isdigit():
            highest = max(highest, int(parts[2]))
    return f"custom.{highest + 1}"


def save_override(role, field_path, value, school_id=None):
    """يحفظ التعديل. الفهرس الفريد لا يطابق school_id الفارغ، فيُحذف الصف ثم يُدرج."""
    _load_default(role)
    probe = _load_default(role)
    _apply(probe, field_path, value)
    connection = connect()
    try:
        if school_id is None:
            connection.execute(
                """
                DELETE FROM content_overrides
                WHERE role = ? AND field_path = ? AND school_id IS NULL
                """,
                (role, field_path),
            )
        else:
            connection.execute(
                """
                DELETE FROM content_overrides
                WHERE role = ? AND field_path = ? AND school_id = ?
                """,
                (role, field_path, school_id),
            )
        connection.execute(
            """
            INSERT OR REPLACE INTO content_overrides
                (school_id, role, field_path, value, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (school_id, role, field_path, value),
        )
        connection.commit()
    finally:
        connection.close()


def reset_override(role, field_path, school_id=None):
    """يحذف تعديل حقل واحد فتعود قيمته من ملف البنك."""
    _ensure_deck_role(role) if role in _DECK_ROLES else _role_path(role)
    connection = connect()
    try:
        if school_id is None:
            connection.execute(
                """
                DELETE FROM content_overrides
                WHERE role = ? AND field_path = ? AND school_id IS NULL
                """,
                (role, field_path),
            )
        else:
            connection.execute(
                """
                DELETE FROM content_overrides
                WHERE role = ? AND field_path = ? AND school_id = ?
                """,
                (role, field_path, school_id),
            )
        connection.commit()
    finally:
        connection.close()


def reset_all_overrides(role, school_id=None):
    """يحذف كل تعديلات الدور فتعود الحقول إلى النص الافتراضي."""
    _ensure_deck_role(role) if role in _DECK_ROLES else _role_path(role)
    connection = connect()
    try:
        if school_id is None:
            connection.execute(
                "DELETE FROM content_overrides WHERE role = ? AND school_id IS NULL",
                (role,),
            )
        else:
            connection.execute(
                "DELETE FROM content_overrides WHERE role = ? AND school_id = ?",
                (role, school_id),
            )
        connection.commit()
    finally:
        connection.close()
