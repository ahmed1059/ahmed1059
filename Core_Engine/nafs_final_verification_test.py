# موجة التحقق النهائي بعد دمج #78 — تشغيل: python3 -m Core_Engine.nafs_final_verification_test
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Core_Engine.nafs_final_verification import (  # noqa: E402
    EXPECTED_BANK,
    EXPECTED_REVISION,
    run_final_verification,
)


def main() -> int:
    report = run_final_verification()
    if not report.get("ok"):
        print("FAIL nafs-final-verification")
        for err in report.get("errors") or []:
            print(" -", err)
        return 1
    bank = report["bank"]
    endround = report["endround"]
    sheet = report["answer_sheet"]
    print(
        "OK nafs-final-verification",
        {
            "revision": report["revision"],
            "bank": bank["bank"],
            "expected": EXPECTED_BANK,
            "by_domain": bank["by_domain"],
            "wave_b": bank["wave_b"],
            "wave_d": bank["wave_d"],
            "tiers": bank["tiers"],
            "mocks": bank["mocks"],
            "golden": bank["golden"],
            "traps": bank["traps"],
            "legend": endround["legend_title"],
            "columns_ar": endround["columns_ar"],
            "pages": sheet["pages"],
            "school_code_ar": sheet["school_code_ar"],
            "fortified_ok": report["fortified_ok"],
            "seed_revision": EXPECTED_REVISION,
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
