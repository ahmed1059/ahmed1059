# -*- coding: utf-8 -*-
"""تشغيل/تحقق موحّد لخ1–خ5 (قرار 74). الافتراضي: تحقق فقط — بلا إعادة حساب."""
from __future__ import annotations

import argparse
import csv
import subprocess
import sys
import unittest
from datetime import datetime
from pathlib import Path

from config import FROZEN, OUTPUT_DIR, get_optional_archive_path

LOG = OUTPUT_DIR / "run_log.md"
log_buf: list[str] = []


def log(msg: str) -> None:
    line = f"| {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | {msg} |"
    log_buf.append(line)
    print(msg)


def count_csv(name: str) -> int:
    path = OUTPUT_DIR / name
    with path.open(encoding="utf-8-sig", newline="") as h:
        return sum(1 for _ in csv.DictReader(h))


def validate_frozen() -> list[str]:
    """يعيد قائمة أخطاء انحدار إن وُجدت."""
    errors: list[str] = []
    checks = [
        ("01_inventory.csv", FROZEN["inventory_rows"]),
        ("02_duplicates.csv", FROZEN["duplicate_pairs"]),
        ("02_groups.csv", FROZEN["groups"]),
        ("03_indicators.csv", FROZEN["indicators_rows"]),
        ("04_person_task_cards.csv", FROZEN["person_cards"]),
        ("04_identity_extension.csv", FROZEN["identity_extension"]),
        ("04_orphan_tasks.csv", FROZEN["orphan_tasks"]),
        ("05_committee_structure.csv", FROZEN["committee_bodies"]),
        ("05_role_map.csv", FROZEN["role_map_rows"]),
        ("05_gaps.csv", FROZEN["gaps_rows"]),
        ("05a_base_index.csv", FROZEN["base_index_rows"]),
    ]
    for name, expected in checks:
        path = OUTPUT_DIR / name
        if not path.exists():
            errors.append(f"مفقود: {name}")
            continue
        n = count_csv(name)
        if n != expected:
            errors.append(f"انحدار {name}: {n} ≠ {expected}")
        else:
            log(f"OK {name} = {n}")

    # تفصيل خ3
    ind = list(csv.DictReader((OUTPUT_DIR / "03_indicators.csv").open(encoding="utf-8-sig")))
    real = sum(1 for r in ind if (r.get("link_source") or "") == "real")
    inferred = sum(1 for r in ind if (r.get("inferred") or "") == "true")
    none = sum(1 for r in ind if (r.get("link_source") or "") == "لا يوجد")
    for label, got, exp in (
        ("real", real, FROZEN["indicators_real"]),
        ("inferred", inferred, FROZEN["indicators_inferred"]),
        ("none", none, FROZEN["indicators_none"]),
    ):
        if got != exp:
            errors.append(f"انحدار خ3 {label}: {got} ≠ {exp}")
        else:
            log(f"OK indicators {label} = {got}")
    return errors


def run_tests() -> int:
    loader = unittest.TestLoader()
    suite = loader.discover(str(OUTPUT_DIR / "tests"), pattern="test_*.py")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


def run_script(script: str) -> int:
    path = OUTPUT_DIR / script
    if not path.exists():
        log(f"فشل: السكربت غير موجود {script}")
        return 1
    log(f"تشغيل {script}")
    proc = subprocess.run([sys.executable, str(path)], cwd=str(OUTPUT_DIR))
    return proc.returncode


ALGO = {
    1: ["_build_01_inventory.py", "_enrich_01_inventory.py", "_adopt_algo1.py"],
    2: ["_run_02_duplicates.py"],
    3: ["_run_03_indicators.py"],
    4: ["_run_04_person_tasks.py"],
    5: ["_run_05_committees.py"],
}


def flush_log(header_extra: str = "") -> None:
    body = [
        "# run_log — سجل تشغيل موحّد (المرحلة أ / خطوة 2)",
        f"## تحديث: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        header_extra,
        "",
        "| الوقت | الحدث |",
        "|---|---|",
        *log_buf,
        "",
    ]
    LOG.write_text("\n".join(body), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description="تحقق/تشغيل خ1–خ5")
    ap.add_argument("--validate-only", action="store_true", help="تحقق مجمّد + اختبارات (افتراضي إن لم يُمرَّر شيء)")
    ap.add_argument("--execute", action="store_true", help="إعادة تشغيل خ1←خ5 كاملة")
    ap.add_argument("--algo", type=int, choices=[1, 2, 3, 4, 5], help="تشغيل خوارزمية واحدة")
    args = ap.parse_args()

    # الافتراضي: تحقق فقط
    if not args.execute and args.algo is None:
        args.validate_only = True

    log("بدء run_all.py")
    arch = get_optional_archive_path()
    log(f"archive={'found: '+str(arch) if arch else 'MISSING (validate لا يحتاج إعادة حساب)'}")

    code = 0
    if args.algo is not None:
        if not arch:
            log("لا يمكن --algo بدون أرشيف")
            flush_log("## الحالة: فشل — أرشيف مفقود")
            return 1
        for script in ALGO[args.algo]:
            rc = run_script(script)
            if rc != 0:
                code = rc
                break
        errs = validate_frozen()
        if errs:
            log("تحذير انحدار بعد --algo: " + " ؛ ".join(errs))
            code = 1

    elif args.execute:
        if not arch:
            log("لا يمكن --execute بدون أرشيف")
            flush_log("## الحالة: فشل — أرشيف مفقود")
            return 1
        for n in range(1, 6):
            for script in ALGO[n]:
                rc = run_script(script)
                if rc != 0:
                    log(f"توقف عند خ{n} / {script} code={rc}")
                    flush_log("## الحالة: فشل جزئي — موثّق كاكتشاف")
                    return rc
            # تحقق وسيط
            errs = validate_frozen()
            # بعد إعادة الحساب الكاملة قد تختلف الأرقام — نوثّق فقط
            if n < 5 and errs:
                log(f"ملاحظة بعد خ{n}: " + " ؛ ".join(errs[:5]))

    if args.validate_only or args.execute or args.algo is not None:
        errs = validate_frozen()
        if errs and args.validate_only:
            for e in errs:
                log("ERROR " + e)
            code = 1
        tcode = run_tests()
        if tcode != 0:
            log("فشل اختبارات unittest")
            code = tcode

    flush_log("## الحالة: " + ("نجاح" if code == 0 else "فشل/انحدار — راجع الجدول"))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
