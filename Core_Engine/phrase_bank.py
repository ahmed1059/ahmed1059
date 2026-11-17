# بنك الصياغات التربوية: أساس التعبئة التلقائية للمهام والشواهد والمحاضر.

from __future__ import annotations

import json
import re
from pathlib import Path

from .database import connect
from .noor_import import stamp

_SEED_PATH = Path(__file__).resolve().parent / "banks" / "pedagogy_phrases.json"
_VAR_PATTERN = re.compile(r"\{\{\s*([^\{\}]+?)\s*\}\}")

CATEGORIES = ("سلوكي", "أكاديمي", "إداري", "تقويم", "شاهد", "محضر")


def ensure_pedagogy_phrase_bank(connection=None):
    """ينشئ جدول phrase_bank التربوي بعد عزل صياغات البرامج إن لزم."""
    own = connection is None
    if own:
        connection = connect()
    try:
        _migrate_program_phrases_aside(connection)
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS phrase_bank (
                id INTEGER PRIMARY KEY,
                category TEXT NOT NULL,
                sub_category TEXT NOT NULL,
                field_name TEXT NOT NULL,
                template_text TEXT NOT NULL,
                variables TEXT,
                sort_order INTEGER,
                created_at TEXT,
                UNIQUE(category, sub_category, field_name, template_text)
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_phrase_bank_lookup
            ON phrase_bank(category, sub_category, field_name)
            """
        )
        if own:
            connection.commit()
    finally:
        if own:
            connection.close()


def _migrate_program_phrases_aside(connection):
    """ينقل جدول البرامج القديم إلى program_phrase_bank دون فقد الصياغات."""
    tables = {
        str(row[0])
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        )
    }
    if "phrase_bank" not in tables:
        return
    columns = {row[1] for row in connection.execute("PRAGMA table_info(phrase_bank)")}
    if "template_key" not in columns:
        return
    if "program_phrase_bank" not in tables:
        connection.execute("ALTER TABLE phrase_bank RENAME TO program_phrase_bank")
        return
    # إن وُجد الاثنان، انسخ ثم أسقط القديم القديم
    connection.execute(
        """
        INSERT OR IGNORE INTO program_phrase_bank (
            template_key, field_key, phrase, sort_order, created_at
        )
        SELECT template_key, field_key, phrase, sort_order, created_at
        FROM phrase_bank
        """
    )
    connection.execute("DROP TABLE phrase_bank")


def seed_phrase_bank(connection=None, force=False):
    """يبذر بنك الصياغات التربوية مرة واحدة من ملف التأسيس."""
    own = connection is None
    if own:
        connection = connect()
    try:
        ensure_pedagogy_phrase_bank(connection)
        count = connection.execute("SELECT COUNT(*) FROM phrase_bank").fetchone()[0]
        if count and not force:
            if own:
                connection.commit()
            return int(count)
        if not _SEED_PATH.is_file():
            if own:
                connection.commit()
            return 0
        try:
            payload = json.loads(_SEED_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return 0
        if not isinstance(payload, list):
            return 0
        moment = stamp()
        inserted = 0
        for index, item in enumerate(payload, start=1):
            if not isinstance(item, dict):
                continue
            category = str(item.get("category") or "").strip()
            sub = str(item.get("sub_category") or "").strip()
            field = str(item.get("field_name") or "").strip()
            text = str(item.get("template_text") or "").strip()
            if not (category and sub and field and text):
                continue
            variables = item.get("variables") or extract_variables(text)
            if isinstance(variables, str):
                try:
                    variables = json.loads(variables)
                except json.JSONDecodeError:
                    variables = extract_variables(text)
            if not isinstance(variables, list):
                variables = extract_variables(text)
            connection.execute(
                """
                INSERT OR IGNORE INTO phrase_bank (
                    category, sub_category, field_name, template_text, variables, sort_order, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    category,
                    sub,
                    field,
                    text,
                    json.dumps(variables, ensure_ascii=False),
                    index,
                    moment,
                ),
            )
            inserted += 1
        if own:
            connection.commit()
        return inserted or int(
            connection.execute("SELECT COUNT(*) FROM phrase_bank").fetchone()[0]
        )
    finally:
        if own:
            connection.close()


def extract_variables(template_text):
    found = []
    for match in _VAR_PATTERN.finditer(str(template_text or "")):
        name = match.group(1).strip()
        if name and name not in found:
            found.append(name)
    return found


def render_phrase(template_text, context=None):
    """يدمج المتغيرات المحفوظة؛ ما لم يُمرَّر يبقى كرمز مفهوم دون اختراع قيمة."""
    context = context if isinstance(context, dict) else {}
    text = str(template_text or "")

    def replacer(match):
        key = match.group(1).strip()
        value = context.get(key)
        if value is None or str(value).strip() == "":
            return match.group(0)
        return str(value).strip()

    return _VAR_PATTERN.sub(replacer, text)


def _as_item(row):
    try:
        variables = json.loads(row[5] or "[]")
    except json.JSONDecodeError:
        variables = extract_variables(row[4])
    if not isinstance(variables, list):
        variables = extract_variables(row[4])
    return {
        "id": row[0],
        "category": str(row[1] or "").strip(),
        "sub_category": str(row[2] or "").strip(),
        "field_name": str(row[3] or "").strip(),
        "template_text": str(row[4] or "").strip(),
        "variables": [str(item).strip() for item in variables if str(item).strip()],
        "sort_order": row[6],
        "created_at": str(row[7] or "").strip(),
    }


def list_phrases(category="", sub_category="", field_name=""):
    """يرجع الصياغات المفلترة للواجهة والمحرك."""
    ensure_pedagogy_phrase_bank()
    seed_phrase_bank()
    clauses = []
    values = []
    if category:
        clauses.append("category = ?")
        values.append(str(category).strip())
    if sub_category:
        clauses.append("sub_category = ?")
        values.append(str(sub_category).strip())
    if field_name:
        clauses.append("field_name = ?")
        values.append(str(field_name).strip())
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    connection = connect()
    try:
        rows = connection.execute(
            f"""
            SELECT id, category, sub_category, field_name, template_text, variables, sort_order, created_at
            FROM phrase_bank
            {where}
            ORDER BY category, sub_category, field_name, sort_order, id
            """,
            values,
        ).fetchall()
    finally:
        connection.close()
    return [_as_item(row) for row in rows]


def phrase_catalog():
    """شجرة الفئات والحقول للاستخدام في القوائم المنسدلة."""
    rows = list_phrases()
    tree = {}
    for item in rows:
        bucket = tree.setdefault(item["category"], {})
        fields = bucket.setdefault(item["sub_category"], {})
        phrases = fields.setdefault(item["field_name"], [])
        phrases.append(
            {
                "id": item["id"],
                "template_text": item["template_text"],
                "variables": item["variables"],
                "rendered": item["template_text"],
            }
        )
    return {
        "categories": list(tree.keys()),
        "tree": tree,
        "count": len(rows),
        "principle": "بنك الصياغات أساس التعبئة؛ الحقل يُملأ ثم يُعدَّل",
    }


def phrases_for_context(field_name="", context=None, category="", sub_category=""):
    """صياغات حقل معيّن بعد دمج المتغيرات من سياق المهمة/الشاهد/المحضر."""
    context = context if isinstance(context, dict) else {}
    items = list_phrases(category=category, sub_category=sub_category, field_name=field_name)
    rendered = []
    for item in items:
        text = render_phrase(item["template_text"], context)
        rendered.append(
            {
                "id": item["id"],
                "category": item["category"],
                "sub_category": item["sub_category"],
                "field_name": item["field_name"],
                "template_text": item["template_text"],
                "rendered_text": text,
                "variables": item["variables"],
            }
        )
    return rendered


def suggest_for_task(task=None):
    """اقتراحات وصف وملاحظة شاهد لمهمة يومية حسب نوع المصدر."""
    task = task if isinstance(task, dict) else {}
    source = str(task.get("source_type") or "").strip()
    title = str(task.get("title") or "").strip()
    context = {
        "عنوان_المهمة": title,
        "التاريخ_الميلادي": str(task.get("due_iso") or task.get("task_date") or "").strip(),
        "التاريخ_الهجري": str(task.get("hijri_date") or "").strip(),
        "نوع_الشاهد": "تقرير/محضر/صورة موثّقة",
        "اسم_السجل": "سجل الغياب والتأخر",
        "اسم_البرنامج": title.replace("تنفيذ/متابعة برنامج: ", "").strip(),
        "عنوان_الإجراء": title.replace("متابعة تحسين: ", "").strip(),
        "رمز_المؤشر": "",
        "المادة": "",
        "اسم_الطالب": "",
    }
    if source == "improvement":
        category, sub = "تقويم", "خطة تحسين"
    elif source == "program":
        category, sub = "شاهد", "تنفيذ برنامج"
    elif source == "standing" and "غياب" in title:
        category, sub = "شاهد", "اعتماد سجل"
    elif source == "follow" and "سلوك" in title:
        category, sub = "سلوكي", "مخالفة سلوكية"
    elif source == "follow" and "تعثر" in title:
        category, sub = "أكاديمي", "فاقد تعليمي"
    else:
        category, sub = "إداري", "متابعة يومية"
    return {
        "category": category,
        "sub_category": sub,
        "description": phrases_for_context("الوصف", context, category, sub),
        "evidence_note": phrases_for_context("ملاحظة الشاهد", context, category, sub)
        or phrases_for_context("الإجراء", context, category, sub),
        "context": context,
    }
