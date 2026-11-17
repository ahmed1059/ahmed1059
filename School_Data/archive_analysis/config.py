# -*- coding: utf-8 -*-
"""مسارات نسبية لطبقة تحليل الأرشيف (المرحلة أ — خطوة 2 / قرار 74)."""
from __future__ import annotations

import os
from pathlib import Path

# School_Data/archive_analysis/
ANALYSIS_DIR = Path(__file__).resolve().parent
# School_Data/
SCHOOL_DATA_DIR = ANALYSIS_DIR.parent
# جذر المشروع School_Governance_System_1059/
PROJECT_ROOT = SCHOOL_DATA_DIR.parent
# غالباً Desktop (أب جذر المشروع على جهاز التطوير)
WORKSPACE_PARENT = PROJECT_ROOT.parent

OUTPUT_DIR = ANALYSIS_DIR
FORMATIONS_PATH = SCHOOL_DATA_DIR / "committee_formations.json"
EXTERNAL_SOURCES_DIR = ANALYSIS_DIR / "external_sources"

# اسم ملف الأرشيف النصي المعتمد
ARCHIVE_FILENAME = "البرامج والتقارير والسجلات والمحاضر .txt"

# مرشحون نسبيون / بيئة — بلا مسار مطلق مضمّن في الكود
_ARCHIVE_CANDIDATES = [
    Path(os.environ["SCHOOL_ARCHIVE_PATH"]) if os.environ.get("SCHOOL_ARCHIVE_PATH") else None,
    WORKSPACE_PARENT / ARCHIVE_FILENAME,
    PROJECT_ROOT / "School_Data" / "imports" / ARCHIVE_FILENAME,
    PROJECT_ROOT / ARCHIVE_FILENAME,
]


def get_archive_path() -> Path:
    """يعيد مسار الأرشيف النصي أو يرفع خطأ توضيحياً."""
    tried: list[str] = []
    for cand in _ARCHIVE_CANDIDATES:
        if cand is None:
            continue
        tried.append(str(cand))
        if cand.is_file():
            return cand.resolve()
    raise FileNotFoundError(
        "لم يُعثر على ملف الأرشيف النصي. عيّن المتغير SCHOOL_ARCHIVE_PATH "
        "أو ضع الملف بجانب مجلد المشروع.\nTried:\n- " + "\n- ".join(tried)
    )


def get_optional_archive_path() -> Path | None:
    try:
        return get_archive_path()
    except FileNotFoundError:
        return None


# تجميد أرقام الاعتماد (حماية انحدار — قرار 74 تحفظ 1)
FROZEN = {
    "inventory_rows": 565,
    "operational": 560,
    "presentation": 5,
    "duplicate_pairs": 441,
    "groups": 37,
    "group_members": 150,
    "indicators_rows": 560,
    "indicators_real": 21,
    "indicators_inferred": 44,
    "indicators_none": 495,
    "person_cards": 10,
    "identity_extension": 27,
    "orphan_tasks": 245,
    "committee_bodies": 15,
    "role_map_rows": 57,
    "gaps_rows": 30,
    "base_index_rows": 6,
}
