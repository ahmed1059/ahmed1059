# يحزم الملفات المصدرية فقط. لا يحذف شيئاً ولا يضم النسخ أو قاعدة البيانات.

from __future__ import annotations

import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT_NAME = "School_Governance_Code_2026-11-12.zip"
EXTENSIONS = {".py", ".js", ".css", ".html", ".json", ".md"}
SKIP_DIRS = {"backups", "__pycache__", "node_modules", ".git"}
SKIP_FILES = {"school_1059.db", OUT_NAME}


def excluded(path: Path) -> bool:
    if path.name in SKIP_FILES:
        return True
    if set(path.parts) & SKIP_DIRS:
        return True
    if "School_Data" in path.parts and "backups" in path.parts:
        return True
    return False


def main() -> int:
    target = ROOT / OUT_NAME
    count = 0
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in ROOT.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in EXTENSIONS:
                continue
            if excluded(path):
                continue
            archive.write(path, path.relative_to(ROOT).as_posix())
            count += 1
    size = target.stat().st_size
    print("files", count)
    print("bytes", size)
    print("path", target)
    return 0


if __name__ == "__main__":
    sys.exit(main())
