# لقطات ثلاثة مقاسات. لا يكتب بيانات. يعتمد جلسة التجربة مثل audit_print.

from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

import audit_print

OUT = Path(__file__).resolve().parent / "audit_screenshots" / "responsive"
VIEWS = [
    ("home", "view-home"),
    ("import", "view-import-center"),
    ("students", "view-student-registry"),
    ("settings", "view-school"),
]
SIZES = [
    ("desktop", 1280, 800),
    ("ipad", 820, 1180),
    ("iphone", 390, 844),
]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    user = audit_print.login_payload()
    stored = {
        "id": user.get("id") or "",
        "name": user.get("name") or "",
        "role": user.get("role") or "",
        "roles": user.get("roles") or [],
        "token": user.get("token") or "",
    }
    failed = 0
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, channel="chrome")
        for name, width, height in SIZES:
            context = browser.new_context(viewport={"width": width, "height": height}, locale="ar-SA")
            page = context.new_page()
            page.goto(audit_print.BASE + "/login.html", wait_until="domcontentloaded")
            page.evaluate("(user) => sessionStorage.setItem('sessionUser', JSON.stringify(user))", stored)
            for view_name, view in VIEWS:
                page.goto(audit_print.BASE + "/app-journey.html#" + view, wait_until="domcontentloaded")
                page.wait_for_timeout(1500)
                page.screenshot(path=str(OUT / f"{name}-{view_name}.png"), full_page=False)
            page.goto(audit_print.BASE + "/app-journey.html#view-student-registry", wait_until="domcontentloaded")
            page.wait_for_timeout(1200)
            metrics = page.evaluate(
                """() => {
                    const sidebar = document.querySelector('.aj-sidebar');
                    const menu = document.querySelector('.aj-menu-btn');
                    const scroller = document.querySelector('.aj-table-scroll');
                    const side = sidebar ? getComputedStyle(sidebar) : null;
                    const scroll = scroller ? getComputedStyle(scroller) : null;
                    return {
                        sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
                        sidebarTransform: side ? side.transform : '',
                        menuDisplay: menu ? getComputedStyle(menu).display : 'missing',
                        tableOverflow: scroll ? scroll.overflowX : 'missing'
                    };
                }"""
            )
            print(name, metrics)
            if name == "ipad" and not (40 <= metrics["sidebarWidth"] <= 120):
                failed += 1
                print("فشل: شريط الآيباد ليس شريط أيقونات")
            if name == "iphone":
                if metrics["menuDisplay"] == "none" or metrics["menuDisplay"] == "missing":
                    failed += 1
                    print("فشل: زر القائمة غير ظاهر في الجوال")
                if metrics["tableOverflow"] not in {"auto", "scroll"}:
                    failed += 1
                    print("فشل: الجدول لا يتمرر أفقياً في الجوال")
            context.close()
        browser.close()
    print("النتيجة: نجاح" if not failed else "النتيجة: فشل")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
