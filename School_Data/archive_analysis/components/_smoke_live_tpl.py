# -*- coding: utf-8 -*-
"""دخان حي خ-مك-3: HTTP 200 لكل صفحات registry + أصول shared."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASE = "http://127.0.0.1:8061"


def get(url: str) -> tuple[int, int]:
    try:
        with urllib.request.urlopen(url, timeout=6) as res:
            return res.status, len(res.read())
    except urllib.error.HTTPError as e:
        return e.code, 0
    except Exception:
        return 0, 0


def main() -> int:
    reg = json.loads((ROOT / "registry.json").read_text(encoding="utf-8"))
    urls = [
        f"{BASE}/preview-tpl-hub.html",
        f"{BASE}/preview-tpl01.html",
        f"{BASE}/components/registry.json",
        f"{BASE}/components/_shared/tpl-common.js",
        f"{BASE}/components/_shared/identity.json",
        f"{BASE}/components/_shared/indicators.json",
        f"{BASE}/components/_shared/programs.json",
        f"{BASE}/components/_shared/committees.json",
    ]
    for item in reg["templates"]:
        urls.append(f"{BASE}/components/{item['html']}")
        urls.append(f"{BASE}/components/{item['folder']}/{item['id']}.js")

    fails = []
    for u in urls:
        status, size = get(u)
        mark = "OK" if status == 200 and size > 0 else "FAIL"
        if mark == "FAIL":
            fails.append(f"{status} {u}")
        print(mark, status, size, u.replace(BASE, ""))

    print("checked", len(urls), "fails", len(fails))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
