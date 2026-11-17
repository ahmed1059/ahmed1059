# قارئ ملفات نور: معلمون وطلاب وجدول. لا يُنفَّذ شيء عند الاستيراد ولا يكتب في القاعدة.

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import openpyxl
from openpyxl.cell.cell import MergedCell

_ALIASES = {
    "name": ("الاسم", "الإسم", "اسم المعلم", "اسم الموظف", "الاسم الرباعي", "الاسم الكامل", "اسم الطالب", "student's name"),
    "national_id": (
        "رقم الهوية",
        "رقم الهوية الوطنية",
        "الهوية الوطنية",
        "السجل المدني",
        "رقم السجل",
        "رقم السجل المدني",
        "رقم الطالب",
        "رقمها",
        "national id",
        "civil id",
    ),
    "specialty": ("التخصص", "التخصص الدقيق", "المادة"),
    "mobile": ("الجوال", "رقم الجوال", "رقم الجوال/الهاتف"),
    "role": ("الوظيفة", "المسمى الوظيفي", "المسمى", "الصفة"),
    "grade": ("الصف", "المرحلة"),
    "classroom": ("الفصل", "الشعبة"),
    "status": ("حالة القيد", "سجل الطالب"),
    "nationality": ("الجنسية", "nationality"),
    "birth_date": ("تاريخ الميلاد", "date of birth"),
    "birth_place": ("مكان الميلاد",),
    "mother_name": ("اسم الأم", "الأم", "mother name"),
    "document_type": ("نوع الوثيقة", "نوعها", "نوع الهوية"),
    "day": ("اليوم",),
    "period": ("الحصة", "الحصه"),
    "subject": ("المادة", "المقرر"),
    "teacher": ("المعلم", "اسم المعلم"),
}

_TEACHER_REQUIRED = (("name", "اسم المعلم"), ("national_id", "رقم الهوية"))
_TEACHER_OPTIONAL = (("specialty", "التخصص"),)
_STUDENT_REQUIRED = (("name", "اسم الطالب"), ("national_id", "رقم الهوية"))
_STUDENT_OPTIONAL = (("grade", "الصف"), ("classroom", "الفصل"))
_TIMETABLE_REQUIRED = (("day", "اليوم"), ("period", "الحصة"), ("subject", "المادة"))


def _fold_letters(value) -> str:
    text = "" if value is None else str(value).replace("\n", " ")
    text = re.sub(r"[\u064B-\u065F\u0670\u0640]", "", text)
    text = text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ى", "ي").replace("ة", "ه")
    return text


def _norm(value) -> str:
    return re.sub(r"\s+", "", _fold_letters(value)).strip().lower()


def fold_words(value: str) -> str:
    """تطبيع الحروف مع الإبقاء على المسافات بين الكلمات."""
    return re.sub(r"\s+", " ", _fold_letters(value)).strip().lower()


def _alias(value) -> str:
    """يربط عنوان العمود بالحقل. التطابق التام أولًا، ثم احتواء العبارة الأطول."""
    token = _norm(value)
    if not token:
        return ""
    exact = {}
    for key, names in _ALIASES.items():
        for name in names:
            exact.setdefault(_norm(name), key)
    if token in exact:
        return exact[token]
    best_key = ""
    best_len = 0
    for key, names in _ALIASES.items():
        for name in names:
            needle = _norm(name)
            if len(needle) < 8 or needle not in token or len(needle) <= best_len:
                continue
            best_key = key
            best_len = len(needle)
    return best_key


def _clean(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value).strip()
    if text.endswith(".0") and text[:-2].isdigit():
        text = text[:-2]
    return text


def is_wadeh_backup(name: str) -> bool:
    """ملف وضح ليس جدولاً مدرسياً ولا يُقرأ في مركز الاستيراد."""
    text = Path(str(name or "")).name.lower()
    return "wadeh-backup" in text


def is_thin_teachers_report(name: str) -> bool:
    """تقرير المعلمين المبسط بلا صفة ولا تخصص. يُستبعد لصالح GetEmployeeDataList."""
    text = Path(str(name or "")).name.lower().replace(" ", "")
    return "getschoolteachersdatareport" in text


def is_student_workbook(name: str) -> bool:
    """كشف طلاب رُفع على مسار غير الطلاب."""
    text = Path(str(name or "")).name.lower().replace(" ", "")
    return "student" in text or "el_" in text or "elstudent" in text


def is_staff_workbook(name: str) -> bool:
    """كشف منسوبين رُفع على مسار الطلاب."""
    text = Path(str(name or "")).name.lower().replace(" ", "")
    return "getemployeedatalist" in text


def _set_cell(sheet, row: int, col: int, value) -> None:
    cell = sheet.cell(row, col)
    if isinstance(cell, MergedCell):
        return
    cell.value = value


def _fill_merges(sheet) -> None:
    """ينسخ قيمة الخلية الأصل إلى النطاق بعد فك الدمج. لا يكتب على MergedCell."""
    ranges = list(sheet.merged_cells.ranges)
    copies = []
    for merged in ranges:
        min_col, min_row, max_col, max_row = merged.bounds
        copies.append((min_row, min_col, max_row, max_col, sheet.cell(min_row, min_col).value))
    for merged in ranges:
        try:
            sheet.unmerge_cells(range_string=str(merged))
        except ValueError:
            continue
    for min_row, min_col, max_row, max_col, value in copies:
        for row in range(min_row, max_row + 1):
            for col in range(min_col, max_col + 1):
                _set_cell(sheet, row, col, value)


def _rows(path: Path) -> list[tuple]:
    workbook = openpyxl.load_workbook(path, data_only=True)
    try:
        sheet = workbook[workbook.sheetnames[0]]
        _fill_merges(sheet)
        return [tuple(row) for row in sheet.iter_rows(values_only=True)]
    finally:
        workbook.close()


def _row_keys(row: tuple, parent: tuple | None = None) -> dict:
    """يربط خلايا صف العناوين بالحقول. «رقم الوظيفة» رقم وظيفي لا مسمى."""
    found = {}
    if row is None:
        return found
    for index, cell in enumerate(row):
        key = _alias(cell)
        if not key or key in found:
            continue
        if key == "role" and parent is not None and index < len(parent) and _norm(parent[index]) == "رقم":
            continue
        found[key] = index
    return found


def _row_looks_like_data(row: tuple | None) -> bool:
    """صف بيانات فيه اسم شخص، لا صف عناوين."""
    if row is None:
        return False
    for cell in row:
        text = _clean(cell)
        if not text or _alias(text) or _banner_key(text):
            continue
        if re.search(r"[\u0600-\u06FF]", text) and " " in text and len(text) >= 8:
            return True
    return False


def _header_block(rows: list[tuple], limit: int = 40, require_name: bool = False) -> tuple[dict, int]:
    """يختار صف العناوين، ويدمج الصف الذي يليه إن كان عناوين هو الآخر."""
    cap = min(max(limit, 0), len(rows))
    labels = []
    for index, row in enumerate(rows[:cap]):
        parent = rows[index - 1] if index else None
        labels.append(_row_keys(row, parent))
    best_map = {}
    best_end = 0
    best_score = 0
    for index, found in enumerate(labels):
        merged = dict(found)
        end = index + 1
        nxt = rows[index + 1] if index + 1 < len(rows) else None
        if index + 1 < len(labels) and labels[index + 1] and not _row_looks_like_data(nxt):
            for key, column in labels[index + 1].items():
                if key not in merged:
                    merged[key] = column
            end = index + 2
        if require_name and "name" not in merged:
            continue
        score = len(merged)
        if score > best_score or (score == best_score and score and end > best_end):
            best_map = merged
            best_end = end
            best_score = score
    return best_map, best_end


def _missing(found: dict, pairs: tuple) -> list[str]:
    return [label for key, label in pairs if key not in found]


def _cell(row: tuple, found: dict, key: str) -> str:
    if key not in found:
        return ""
    position = found[key]
    if position >= len(row):
        return ""
    return _clean(row[position])


def _sheet_records(path: Path, required: tuple, optional: tuple, fields: tuple, identity_only: bool = False) -> dict:
    rows = _rows(path)
    found, start = _header_block(rows)
    missing = _missing(found, required)
    optional_missing = _missing(found, optional)
    records = []
    seen = set()
    skipped = 0
    if not missing:
        for row in rows[start:]:
            if row is None or all(cell is None or str(cell).strip() == "" for cell in row):
                continue
            item = {key: _cell(row, found, key) for key in fields}
            if identity_only:
                identity = item.get("national_id", "")
                if not identity or identity in seen:
                    skipped += 1
                    continue
                seen.add(identity)
                records.append(item)
                continue
            if not item.get("name") and not item.get("national_id") and not item.get("subject"):
                continue
            if not item.get("name") and not item.get("subject"):
                skipped += 1
                continue
            identity = item.get("national_id") or item.get("name") or item.get("subject")
            if identity in seen:
                skipped += 1
                continue
            seen.add(identity)
            records.append(item)
    return {
        "records": records,
        "read": len(records) + skipped,
        "skipped": skipped,
        "missing": missing,
        "warnings": [f"العمود «{label}» غير موجود." for label in optional_missing],
    }


def role_from_filename(filename: str) -> str:
    """الصفة من ذيل اسم الملف: GetEmployeeDataListمعلم أو GetEmployeeDataList_مدير مدرسة."""
    stem = Path(str(filename or "")).stem
    stem = stem.replace("\u200f", "").replace("\u200e", "").strip()
    match = re.match(
        r"(?i)^(?:teachers-)?(?:GetEmployeeDataList|GetSchoolTeachersDataReport)[_\-\s]*",
        stem,
    )
    if match:
        stem = stem[match.end():]
    elif "_" in stem:
        stem = stem.split("_")[-1]
    else:
        return ""
    stem = re.sub(r"\s+", " ", stem).strip(" _-")
    if not re.search(r"[\u0600-\u06FF]", stem):
        return ""
    return stem


def _role_from_sheet(rows: list[tuple]) -> str:
    """عبارة نوع المستخدم في ترويسة تقرير نور، إن خلا اسم الملف من صفة."""
    for row in rows[:12]:
        if not any(_norm(cell) == _norm("نوع المستخدم") for cell in row):
            continue
        for cell in row:
            text = _clean(cell)
            if not text or _norm(text) == _norm("نوع المستخدم") or _alias(text):
                continue
            if re.search(r"[\u0600-\u06FF]", text) and len(text) <= 40:
                return re.sub(r"\s+", " ", text).strip()
    return ""


def _job_number(value: str) -> bool:
    token = (value or "").strip()
    return bool(token) and token.lstrip("-").isdigit()


def parse_teachers(path: Path, filename: str = "") -> dict:
    """يقرأ الاسم ورقم الهوية. الصفة من اسم الملف، ورقم الوظيفة لا يُحفظ مسمى."""
    label = filename or path.name
    if is_wadeh_backup(label):
        raise ValueError("ملف وضح ليس جدولاً مدرسياً ولا يُستورد.")
    if is_thin_teachers_report(label):
        return {
            "records": [],
            "read": 0,
            "skipped": 0,
            "missing": [],
            "warnings": ["تقرير المعلمين المبسط بلا صفة يُستبعد. المصدر: GetEmployeeDataList."],
            "excluded": True,
        }
    parsed = _sheet_records(
        path,
        _TEACHER_REQUIRED,
        _TEACHER_OPTIONAL,
        ("name", "national_id", "specialty", "mobile", "role"),
    )
    parsed = _keep_identified(parsed)
    label = role_from_filename(filename or path.name) or _role_from_sheet(_rows(path))
    for row in parsed["records"]:
        column_role = "" if _job_number(row.get("role", "")) else (row.get("role") or "")
        row["role"] = column_role or label
    return parsed


_BANNER = (
    ("grade", ("الصف",)),
    ("classroom", ("الفصل", "الشعبة")),
    ("year", ("العام الدراسي",)),
)


def _banner_key(value) -> str:
    token = _norm(value).replace(":", "").replace("：", "")
    if not token:
        return ""
    for key, names in _BANNER:
        if token in {_norm(name) for name in names}:
            return key
    return ""


def _split_banner_cell(value: str) -> tuple[str, str]:
    """يفك «الصف: الأول المتوسط» إن كان العنوان والقيمة في الخلية نفسها."""
    text = _clean(value)
    if ":" not in text and "：" not in text:
        return "", ""
    left, right = re.split(r"[:：]", text, maxsplit=1)
    key = _banner_key(left) or _banner_key(right)
    if not key:
        return "", ""
    other = (right if _banner_key(left) else left).strip()
    if not other or _banner_key(other):
        return key, ""
    return key, other


def _beside(row: tuple, index: int) -> str:
    """أقرب قيمة في الصف نفسه، يسارًا ثم يمينًا، ويتخطى النقطتين والخلايا الفارغة."""
    for step in range(index - 1, -1, -1):
        text = _clean(row[step]) if step < len(row) else ""
        if not text or _norm(text) in {":", "："} or _banner_key(text):
            continue
        return text
    for step in range(index + 1, len(row)):
        text = _clean(row[step])
        if not text or _norm(text) in {":", "："} or _banner_key(text):
            continue
        return text
    return ""


def _sheet_banner(rows: list[tuple], header_index: int) -> dict:
    """يقرأ الصف والفصل والعام من أول 20 صفاً (قيمة يسار أو يمين العنوان)."""
    found = {}
    limit = min(20, len(rows))
    if header_index and header_index < limit:
        limit = max(header_index, 15)
        limit = min(limit, 20)
    for row in rows[:limit]:
        if row is None:
            continue
        for index, cell in enumerate(row):
            key, inline = _split_banner_cell(cell)
            if key and inline and key not in found:
                found[key] = inline
                continue
            key = _banner_key(cell)
            if not key or key in found:
                continue
            value = _beside(row, index)
            if value:
                found[key] = value
    return found


def _workbook(path: Path) -> list[tuple[str, list[tuple]]]:
    workbook = openpyxl.load_workbook(path, data_only=True, read_only=False)
    try:
        out = []
        for name in workbook.sheetnames:
            sheet = workbook[name]
            _fill_merges(sheet)
            out.append((name, [tuple(row) for row in sheet.iter_rows(values_only=True)]))
        return out
    finally:
        workbook.close()


_STUDENT_FIELDS = (
    "name",
    "national_id",
    "nationality",
    "birth_date",
    "birth_place",
    "mother_name",
    "status",
    "grade",
    "classroom",
    "document_type",
)

_SHORT_DOC_MARKERS = ("جواز", "تصريح")


def _is_short_document_id(number: str, doc_type: str) -> bool:
    """جواز/تصريح أو رقم أقصر من 10 لا يُستخدم كمفتاح هوية وطنية."""
    nid = str(number or "").strip()
    if len(nid) >= 10:
        return False
    if not nid:
        return False
    kind = fold_words(doc_type)
    if any(marker in kind for marker in _SHORT_DOC_MARKERS):
        return True
    return len(nid) < 10


def parse_students(path: Path) -> dict:
    """يقرأ كل أوراق الكشف. الصف والفصل في رأس الورقة يُلحقان بكل طالب فيها."""
    if is_wadeh_backup(path.name):
        raise ValueError("ملف وضح ليس جدولاً مدرسياً ولا يُستورد.")
    records = []
    skipped = 0
    read = 0
    classes = []
    named_sheets = 0
    empty_sheets = []
    sheet_total = 0
    short_docs = 0
    for sheet_name, rows in _workbook(path):
        sheet_total += 1
        banner = _sheet_banner(rows, 0)
        found, start = _header_block(rows, 30, require_name=True)
        if "name" not in found:
            empty_sheets.append(sheet_name)
            classes.append(
                {
                    "sheet": sheet_name,
                    "grade": banner.get("grade", ""),
                    "classroom": banner.get("classroom", ""),
                    "year": banner.get("year", ""),
                    "count": 0,
                    "names": [],
                }
            )
            continue
        named_sheets += 1
        batch = []
        seen = set()
        for row in rows[start:]:
            if row is None or all(cell is None or str(cell).strip() == "" for cell in row):
                continue
            item = {key: _cell(row, found, key) for key in _STUDENT_FIELDS}
            if not item["grade"]:
                item["grade"] = banner.get("grade", "")
            if not item["classroom"]:
                item["classroom"] = banner.get("classroom", "")
            item["section"] = item["classroom"]
            if _is_short_document_id(item.get("national_id") or "", item.get("document_type") or ""):
                item["document_number"] = item["national_id"]
                item["national_id"] = ""
                short_docs += 1
            else:
                item["document_number"] = ""
            read += 1
            if not item["name"]:
                skipped += 1
                continue
            if re.search(r"[A-Za-z]", item["name"]) and not re.search(r"[\u0600-\u06FF]", item["name"]):
                skipped += 1
                continue
            if item.get("national_id"):
                identity = item["national_id"]
            else:
                identity = _norm(item["name"]) + "|" + item["grade"] + "|" + item["classroom"]
            if identity in seen:
                skipped += 1
                continue
            seen.add(identity)
            batch.append(item)
        records.extend(batch)
        if not batch:
            empty_sheets.append(sheet_name)
        classes.append(
            {
                "sheet": sheet_name,
                "grade": banner.get("grade") or (batch[0]["grade"] if batch else ""),
                "classroom": banner.get("classroom") or (batch[0]["classroom"] if batch else ""),
                "year": banner.get("year", ""),
                "count": len(batch),
                "names": [row["name"] for row in batch],
            }
        )
    missing = [] if named_sheets else ["اسم الطالب"]
    mode = "roster" if records and any(not row.get("national_id") for row in records) else "registry"
    warnings = []
    if mode == "roster":
        warnings.append("الكشف بلا عمود رقم هوية، فيُكتب الصف والفصل على الاسم المطابق في السجل.")
    if short_docs:
        warnings.append(
            "أرقام وثائق أقصر من 10 خانات (جواز/تصريح) لم تُستخدم كهوية وطنية: " + str(short_docs)
        )
    if empty_sheets:
        warnings.append("أوراق بلا طلاب: " + "، ".join(empty_sheets))
    grouped = {}
    order = []
    for row in classes:
        key = (row.get("grade") or "", row.get("classroom") or "")
        if key not in grouped:
            grouped[key] = {
                "grade": key[0],
                "classroom": key[1],
                "count": 0,
                "names": [],
                "sheet": row.get("sheet") or "",
            }
            order.append(key)
        grouped[key]["count"] += int(row.get("count") or 0)
        grouped[key]["names"].extend(row.get("names") or [])
    return {
        "records": records,
        "read": read,
        "skipped": skipped,
        "missing": missing,
        "warnings": warnings,
        "sheets": sheet_total,
        "classes": classes,
        "distribution": [grouped[key] for key in order],
        "empty_sheets": empty_sheets,
        "mode": mode,
        "short_docs": short_docs,
    }


def enrich_students_from_el(path: Path, connection) -> dict:
    """يثري noor_students من كشف EL بالاسم. لا إدراج ولا تغيير للهوية أو الاسم."""
    parsed = parse_students(path)
    records = parsed.get("records") or []
    staff_rows = connection.execute(
        "SELECT national_id, name, grade, classroom FROM noor_students"
    ).fetchall()
    index = {}
    for identity, name, grade, classroom in staff_rows:
        index.setdefault(fold_name(name), []).append(
            {
                "national_id": identity,
                "name": name,
                "grade": grade or "",
                "classroom": classroom or "",
            }
        )
    moment = datetime.now(timezone.utc).isoformat()
    source = Path(path).name
    matched = 0
    ambiguous = []
    unmatched = []
    for row in records:
        el_name = str(row.get("name") or "").strip()
        if not el_name:
            continue
        hits = list(index.get(fold_name(el_name)) or [])
        if len(hits) > 1:
            el_grade = fold_name(row.get("grade") or "")
            el_section = str(row.get("classroom") or row.get("section") or "").strip()
            narrowed = [
                hit
                for hit in hits
                if fold_name(hit["grade"]) == el_grade
                and str(hit["classroom"] or "").strip() == el_section
            ]
            if len(narrowed) == 1:
                hits = narrowed
            else:
                ambiguous.append(
                    {
                        "name": el_name,
                        "grade": row.get("grade") or "",
                        "classroom": row.get("classroom") or "",
                        "hits": [hit["national_id"] for hit in hits],
                    }
                )
                continue
        if not hits:
            unmatched.append(el_name)
            continue
        target = hits[0]
        connection.execute(
            """
            UPDATE noor_students
            SET nationality = ?,
                birth_date = ?,
                birth_place = ?,
                mother_name = ?,
                el_grade = ?,
                el_section = ?,
                enriched_at = ?,
                enrichment_source = ?
            WHERE national_id = ?
            """,
            (
                str(row.get("nationality") or "").strip(),
                str(row.get("birth_date") or "").strip(),
                str(row.get("birth_place") or "").strip(),
                str(row.get("mother_name") or "").strip(),
                str(row.get("grade") or "").strip(),
                str(row.get("classroom") or row.get("section") or "").strip(),
                moment,
                source,
                target["national_id"],
            ),
        )
        matched += 1
    return {
        "read": parsed.get("read") or 0,
        "records": len(records),
        "matched": matched,
        "ambiguous": ambiguous,
        "unmatched": unmatched,
        "warnings": parsed.get("warnings") or [],
        "sheets": parsed.get("sheets") or 0,
    }


def _id_fingerprint(value: str) -> str:
    """يزيل الأصفار البادئة لأرقام الوثائق حتى تطابق 07270835 و0007270835."""
    text = str(value or "").strip()
    if not text or not text.isdigit():
        return ""
    return text.lstrip("0") or "0"


def apply_student_records(connection, records: list[dict]) -> dict:
    """مفتاح واحد للطالب: هوية عشرية، أو بصمة رقمية، أو اسم مطوي فريد. لا إدراج لجواز قصير."""
    moment = stamp()
    rows = connection.execute(
        """
        SELECT national_id, name, grade, classroom, status,
               nationality, birth_date, birth_place, mother_name
        FROM noor_students
        """
    ).fetchall()
    by_id = {}
    by_fold = {}
    by_fp = {}
    for row in rows:
        identity = str(row[0] or "")
        by_id[identity] = row
        by_fold.setdefault(fold_name(row[1]), []).append(identity)
        finger = _id_fingerprint(identity)
        if finger:
            by_fp.setdefault(finger, []).append(identity)

    inserted = 0
    updated = 0
    unmatched = []
    ambiguous = []
    failed = []

    def keep(current, incoming):
        text = str(incoming or "").strip()
        return text if text else str(current or "")

    def bind_index(identity, name):
        by_fold.setdefault(fold_name(name), []).append(identity)
        finger = _id_fingerprint(identity)
        if finger:
            by_fp.setdefault(finger, []).append(identity)

    for row in records:
        name = str(row.get("name") or "").strip()
        if not name:
            failed.append({"name": "", "reason": "اسم ناقص"})
            continue
        nid = str(row.get("national_id") or "").strip()
        if _is_short_document_id(nid, str(row.get("document_type") or "")):
            row["document_number"] = nid
            nid = ""
        folded = fold_name(name)
        grade = str(row.get("grade") or "").strip()
        classroom = str(row.get("classroom") or row.get("section") or "").strip()
        target = ""
        if nid and nid in by_id:
            target = nid
        elif nid and _id_fingerprint(nid) in by_fp:
            hits = list(by_fp.get(_id_fingerprint(nid)) or [])
            named = [item for item in hits if fold_name(by_id[item][1]) == folded]
            pool = named or hits
            if len(pool) == 1:
                target = pool[0]
            else:
                ambiguous.append({"name": name, "reason": "بصمة هوية متعددة", "hits": pool})
                continue
        elif folded in by_fold:
            hits = list(by_fold.get(folded) or [])
            if len(hits) == 1:
                target = hits[0]
            else:
                narrowed = [
                    item
                    for item in hits
                    if fold_name(by_id[item][2] or "") == fold_name(grade)
                    and str(by_id[item][3] or "").strip() == classroom
                ]
                if len(narrowed) == 1:
                    target = narrowed[0]
                else:
                    ambiguous.append({"name": name, "reason": "اسم متعدد", "hits": hits})
                    continue
        elif nid and len(nid) >= 10:
            connection.execute(
                """
                INSERT INTO noor_students (
                    national_id, name, grade, classroom, status,
                    nationality, birth_date, birth_place, mother_name,
                    el_grade, el_section, enriched_at, enrichment_source, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    nid,
                    name,
                    grade,
                    classroom,
                    str(row.get("status") or "").strip(),
                    str(row.get("nationality") or "").strip(),
                    str(row.get("birth_date") or "").strip(),
                    str(row.get("birth_place") or "").strip(),
                    str(row.get("mother_name") or "").strip(),
                    grade,
                    classroom,
                    moment if (row.get("nationality") or grade) else "",
                    "import" if (row.get("nationality") or grade) else "",
                    moment,
                ),
            )
            by_id[nid] = (nid, name, grade, classroom, str(row.get("status") or ""), "", "", "", "")
            bind_index(nid, name)
            inserted += 1
            continue
        else:
            unmatched.append(name)
            failed.append({"name": name, "reason": "لا مطابقة ولا هوية عشرية"})
            continue

        current = by_id[target]
        connection.execute(
            """
            UPDATE noor_students
            SET grade = ?, classroom = ?, status = ?,
                nationality = ?, birth_date = ?, birth_place = ?, mother_name = ?,
                el_grade = CASE WHEN ? != '' THEN ? ELSE el_grade END,
                el_section = CASE WHEN ? != '' THEN ? ELSE el_section END,
                enriched_at = CASE WHEN ? != '' THEN ? ELSE enriched_at END,
                enrichment_source = CASE WHEN ? != '' THEN ? ELSE enrichment_source END,
                updated_at = ?
            WHERE national_id = ?
            """,
            (
                keep(current[2], grade),
                keep(current[3], classroom),
                keep(current[4], row.get("status")),
                keep(current[5] if len(current) > 5 else "", row.get("nationality")),
                keep(current[6] if len(current) > 6 else "", row.get("birth_date")),
                keep(current[7] if len(current) > 7 else "", row.get("birth_place")),
                keep(current[8] if len(current) > 8 else "", row.get("mother_name")),
                grade,
                grade,
                classroom,
                classroom,
                grade or str(row.get("nationality") or ""),
                moment,
                grade or str(row.get("nationality") or ""),
                "import",
                moment,
                target,
            ),
        )
        by_id[target] = (
            target,
            current[1],
            keep(current[2], grade),
            keep(current[3], classroom),
            keep(current[4], row.get("status")),
            keep(current[5] if len(current) > 5 else "", row.get("nationality")),
            keep(current[6] if len(current) > 6 else "", row.get("birth_date")),
            keep(current[7] if len(current) > 7 else "", row.get("birth_place")),
            keep(current[8] if len(current) > 8 else "", row.get("mother_name")),
        )
        updated += 1

    return {
        "inserted": inserted,
        "updated": updated,
        "failed": failed,
        "unmatched": unmatched,
        "ambiguous": ambiguous,
    }


def fold_name(value: str) -> str:
    """يطوي الاسم مع الإبقاء على مسافة واحدة بين الكلمات. لا يحذف كل المسافات."""
    return fold_words(value)


_NAME_SKIP = frozenset(_norm(item) for item in ("بن", "ابن", "بنت", "آل"))


def name_tokens(value: str) -> set[str]:
    """كلمات الاسم بعد التطبيع. بن/ابن/بنت/آل تُستبعد ككلمات كاملة. أل التعريف داخل اللقب تبقى (الحربي ≠ حربي)."""
    return set(fold_name(value).split()) - _NAME_SKIP


def match_teacher_name(query: str, staff: list[tuple[str, str]]) -> dict:
    """مطابقة subset: كل كلمات المختصر موجودة في الكامل. واحد مطابق، أكثر غامض، صفر غير مطابق."""
    tokens_short = name_tokens(query)
    if not tokens_short:
        return {"status": "unmatched", "hits": [], "reason": "اسم فارغ"}
    hits = []
    for identity, full in staff:
        tokens_full = name_tokens(full)
        if tokens_short.issubset(tokens_full):
            hits.append((str(identity or ""), str(full or "")))
    if len(hits) == 1:
        return {"status": "matched", "hits": hits, "reason": "مطابقة جزئية"}
    if len(hits) > 1:
        names = "، ".join(item[1] for item in hits)
        return {"status": "ambiguous", "hits": hits, "reason": "غامض — مرشحون: " + names}
    short_words = [word for word in fold_name(query).split() if _norm(word) not in _NAME_SKIP]
    if len(short_words) >= 2:
        first, last = short_words[0], short_words[-1]
        conflicts = []
        for identity, full in staff:
            full_words = [word for word in fold_name(full).split() if _norm(word) not in _NAME_SKIP]
            if not full_words or full_words[0] != first:
                continue
            if last not in full_words:
                conflicts.append((str(identity or ""), str(full or "")))
        if len(conflicts) == 1:
            return {
                "status": "unmatched",
                "hits": [],
                "reason": "تناقض: في DB " + conflicts[0][1] + "، في الملف " + query,
            }
    return {"status": "unmatched", "hits": [], "reason": "غير مطابق"}


def _keep_identified(parsed: dict) -> dict:
    kept = [row for row in parsed["records"] if row.get("name") and row.get("national_id")]
    dropped = len(parsed["records"]) - len(kept)
    parsed["records"] = kept
    parsed["skipped"] += dropped
    return parsed


def parse_timetable(path: Path) -> dict:
    """يقرأ جدول واضح أو إكسل فيه اليوم والحصة والمادة."""
    if is_wadeh_backup(path.name):
        raise ValueError("ملف وضح ليس جدولاً مدرسياً ولا يُستورد.")
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        records = _json_lessons(payload)
        notice = ""
        if not records:
            notice = "ملف الجدول قُرئ، وليس فيه حصص محفوظة."
        return {"records": records, "read": len(records), "skipped": 0, "missing": [], "warnings": [notice] if notice else []}
    parsed = _sheet_records(path, _TIMETABLE_REQUIRED, (), ("day", "period", "subject", "teacher", "classroom"))
    return parsed


def _json_lessons(payload) -> list[dict]:
    if isinstance(payload, list):
        return [_lesson(item) for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("lessons", "schedule", "timetable", "periods", "entries"):
        value = payload.get(key)
        if isinstance(value, list) and value:
            return [_lesson(item) for item in value if isinstance(item, dict)]
    return []


def _lesson(item: dict) -> dict:
    return {
        "day": _clean(item.get("day") or item.get("اليوم")),
        "period": _clean(item.get("period") or item.get("الحصة")),
        "subject": _clean(item.get("subject") or item.get("المادة")),
        "teacher": _clean(item.get("teacher") or item.get("المعلم")),
        "classroom": _clean(item.get("classroom") or item.get("الفصل")),
    }


def parse_enrichment(path: Path) -> dict:
    """يقرأ رقم الهوية مع التخصص أو الصف أو الفصل. لا يُنشئ سجلًا جديدًا."""
    parsed = _sheet_records(
        path,
        (("national_id", "رقم الهوية"),),
        (),
        ("national_id", "specialty", "grade", "classroom"),
        identity_only=True,
    )
    found, _start = _header_block(_rows(path))
    if not ({"specialty", "grade", "classroom"} & set(found)):
        parsed["missing"] = ["التخصص أو الصف أو الفصل"]
        parsed["records"] = []
    return parsed


def stamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


_DAY_NUM = (
    ("الخميس", "5"),
    ("الاربعاء", "4"),
    ("الثلاثاء", "3"),
    ("الاثنين", "2"),
    ("الاحد", "1"),
)
_PERIOD_NUM = (
    ("السابعه", "7"),
    ("السادسه", "6"),
    ("الخامسه", "5"),
    ("الرابعه", "4"),
    ("الثالثه", "3"),
    ("الثانيه", "2"),
    ("الاولى", "1"),
    ("الاولي", "1"),
)
_GRADE_CANON = (
    (("الثالثالمتوسط", "ثالثمتوسط", "3م", "0925"), "الثالث متوسط"),
    (("الثانيالمتوسط", "ثانيمتوسط", "2م", "0825"), "الثاني متوسط"),
    (("الاولالمتوسط", "اولمتوسط", "1م", "0725"), "الأول متوسط"),
)


def _day_num(value) -> str:
    token = _norm(value)
    for name, number in _DAY_NUM:
        if name in token:
            return number
    return ""


def _period_num(value) -> str:
    token = _norm(value)
    if token.isdigit() and 1 <= int(token) <= 7:
        return token
    for name, number in _PERIOD_NUM:
        if name in token:
            return number
    return ""


def _split_lesson_cell(value) -> dict | None:
    raw = re.sub(r"\s+", " ", _clean(value))
    if not raw:
        return None
    folded = _norm(raw)
    if "تطويرمهني" in folded:
        return {
            "kind": "development",
            "grade": "",
            "section": "",
            "subject": raw,
            "classroom": "",
        }
    if folded == "نشاط" or folded.startswith("نشاط"):
        return {
            "kind": "activity",
            "grade": "",
            "section": "",
            "subject": raw,
            "classroom": "",
        }
    grade = ""
    rest = raw
    for keys, canon in _GRADE_CANON:
        for key in keys:
            idx = folded.find(key)
            if idx < 0:
                continue
            grade = canon
            pattern = re.compile(re.escape(key), re.I)
            # قصّ الصف من النص الأصلي بأقرب عبارة عربية شائعة
            rest = re.sub(
                r"(?:ال)?(?:أول|الأول|ثاني|الثاني|ثالث|الثالث)\s*(?:ال)?متوسط(?:ة)?|(?:اول|ثاني|ثالث)\s*متوسط|[123]\s*م",
                " ",
                raw,
                count=1,
                flags=re.I,
            )
            break
        if grade:
            break
    rest = re.sub(r"\s+", " ", rest).strip()
    section = ""
    match = re.match(r"^(\d{1,2}|[أابجدا])\s+(.*)$", rest)
    if match:
        section = match.group(1)
        if section in ("أ", "ا"):
            section = "1"
        elif section == "ب":
            section = "2"
        rest = match.group(2).strip()
    elif rest.isdigit():
        section = rest
        rest = ""
    classroom = " ".join(part for part in (grade, section) if part)
    return {
        "kind": "regular",
        "grade": grade,
        "section": section,
        "subject": rest,
        "classroom": classroom,
    }


def _matrix_rows(path: Path) -> list[tuple]:
    workbook = openpyxl.load_workbook(path, data_only=True)
    try:
        names = list(workbook.sheetnames)
        chosen = ""
        for name in names:
            if "wadeh" in name.lower() or "وضح" in name:
                continue
            if "allschoolschedule" in name.lower().replace(" ", "") or "شامل" in name:
                chosen = name
                break
        if not chosen:
            for name in names:
                if "wadeh" not in name.lower() and "وضح" not in name:
                    chosen = name
                    break
        if not chosen:
            return []
        sheet = workbook[chosen]
        _fill_merges(sheet)
        return [tuple(row) for row in sheet.iter_rows(values_only=True)]
    finally:
        workbook.close()


def _header_maps(rows: list[tuple]) -> tuple[dict, int]:
    """يعيد خريطة العمود -> (يوم، حصة) وبداية صفوف المعلمين."""
    best = {}
    data_start = 0
    best_count = 0
    scan = min(len(rows), 40)
    for index in range(scan):
        day_row = rows[index]
        period_row = rows[index + 1] if index + 1 < len(rows) else ()
        colmap = {}
        for col, cell in enumerate(day_row):
            day = _day_num(cell)
            period = _period_num(cell)
            if not period and col < len(period_row):
                period = _period_num(period_row[col])
            if day and period:
                colmap[col] = (day, period)
        if len(colmap) > best_count:
            best = colmap
            best_count = len(colmap)
            data_start = index + 2 if period_row else index + 1
    return best, data_start


def _teacher_column(rows: list[tuple], colmap: dict, start: int) -> int:
    width = max((len(row) for row in rows[start:start + 40]), default=0)
    best_col = -1
    best_score = 0
    blocked = set(colmap)
    for col in range(width):
        if col in blocked:
            continue
        score = 0
        for row in rows[start:start + 80]:
            if col >= len(row):
                continue
            text = _clean(row[col])
            if len(text) < 4 or not re.search(r"[\u0600-\u06FF]", text):
                continue
            if _day_num(text) or _period_num(text):
                continue
            score += 1
        if score > best_score or (score == best_score and score and col > best_col):
            best_score = score
            best_col = col
    return best_col


def parse_teacher_matrix(path: Path) -> dict:
    """يقرأ جدول المعلمين×الأيام×الحصص. لا يكتب في القاعدة."""
    if is_wadeh_backup(path.name):
        raise ValueError("ملف وضح ليس جدولاً مدرسياً ولا يُستورد.")
    rows = _matrix_rows(path)
    colmap, start = _header_maps(rows)
    if len(colmap) < 3:
        return {
            "records": [],
            "read": 0,
            "skipped": 0,
            "missing": ["صف أيام الأسبوع والحصص"],
            "warnings": [],
            "unmatched_teachers": [],
            "teachers_seen": [],
        }
    teacher_col = _teacher_column(rows, colmap, start)
    if teacher_col < 0:
        return {
            "records": [],
            "read": 0,
            "skipped": 0,
            "missing": ["عمود اسم المعلم"],
            "warnings": [],
            "unmatched_teachers": [],
            "teachers_seen": [],
        }
    records = []
    skipped = 0
    read = 0
    seen_teachers = []
    for row in rows[start:]:
        if row is None or teacher_col >= len(row):
            continue
        teacher = re.sub(r"\s+", " ", _clean(row[teacher_col]))
        if not teacher or _day_num(teacher) or _period_num(teacher):
            continue
        if teacher not in seen_teachers:
            seen_teachers.append(teacher)
        for col, (day, period) in colmap.items():
            if col >= len(row):
                continue
            parsed = _split_lesson_cell(row[col])
            read += 1
            if not parsed:
                skipped += 1
                continue
            records.append(
                {
                    "day": day,
                    "period": period,
                    "subject": parsed["subject"],
                    "teacher": teacher,
                    "classroom": parsed["classroom"],
                    "grade": parsed["grade"],
                    "section": parsed["section"],
                    "kind": parsed["kind"],
                    "staff_id": "",
                }
            )
    return {
        "records": records,
        "read": read,
        "skipped": skipped,
        "missing": [],
        "warnings": [],
        "unmatched_teachers": [],
        "teachers_seen": seen_teachers,
    }
