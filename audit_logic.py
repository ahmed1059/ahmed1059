# يفحص بنك الخطط والنص التربوي على الشاشة. لا يحفظ برنامجاً ولا يكتب في القاعدة.

from __future__ import annotations

import sys

from playwright.sync_api import sync_playwright

import audit_print

INDICATOR = "2-1-1-2"
EXPECTED_PROCEDURES = 26


def main() -> int:
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
        context = browser.new_context(viewport={"width": 1440, "height": 900}, locale="ar-SA")
        page = context.new_page()
        page.goto(audit_print.BASE + "/login.html", wait_until="domcontentloaded")
        page.evaluate("(user) => sessionStorage.setItem('sessionUser', JSON.stringify(user))", stored)
        page.goto(audit_print.BASE + "/app-journey.html#view-program-add", wait_until="domcontentloaded")
        page.wait_for_selector("#aj-program-bank-q", timeout=20000)
        page.evaluate(
            """(code) => {
                const field = document.getElementById('aj-program-bank-q');
                field.value = code;
                field.dispatchEvent(new Event('input', { bubbles: true }));
            }""",
            INDICATOR,
        )
        page.wait_for_function(
            """(code) => {
                const hits = document.querySelectorAll('#aj-program-bank-hits button');
                return Array.from(hits).some((node) => (node.textContent || '').indexOf(code) === 0);
            }""",
            arg=INDICATOR,
            timeout=20000,
        )
        page.evaluate(
            """(code) => {
                const hits = document.querySelectorAll('#aj-program-bank-hits button');
                const button = Array.from(hits).find((node) => (node.textContent || '').indexOf(code) === 0);
                button.click();
            }""",
            INDICATOR,
        )
        page.wait_for_function(
            "() => document.querySelectorAll('#aj-program-bank-actions input[type=checkbox]').length > 0",
            timeout=15000,
        )
        result = page.evaluate(
            """(expected) => {
                const boxes = document.querySelectorAll('#aj-program-bank-actions input[type=checkbox]');
                const name = document.querySelector('[name="program_name"], #aj-program-name');
                const narrative = window.NarrativeCore && typeof window.NarrativeCore.generateText === 'function'
                    ? window.NarrativeCore.generateText('program.objective', {
                        program_name: 'برنامج فحص',
                        domain: 'التعليم والتعلم'
                    })
                    : '';
                const indicator = window.PlanningCore && typeof window.PlanningCore.getIndicator === 'function'
                    ? window.PlanningCore.getIndicator(expected)
                    : null;
                const fromBank = window.NarrativeCore && typeof window.NarrativeCore.fromBank === 'function'
                    ? window.NarrativeCore.fromBank(expected)
                    : null;
                return {
                    boxes: boxes.length,
                    title: name ? (name.value || '') : '',
                    narrative: narrative,
                    procedures: indicator && indicator.procedures ? indicator.procedures.length : 0,
                    bankText: fromBank && fromBank.procedures ? fromBank.procedures : ''
                };
            }""",
            INDICATOR,
        )
        print("الإجراءات على الشاشة:", result["boxes"])
        print("إجراءات المؤشر:", result["procedures"])
        print("عنوان البرنامج:", "موجود" if result["title"] else "فارغ")
        print("النص التربوي:", result["narrative"] or "فارغ")
        if result["boxes"] != EXPECTED_PROCEDURES or result["procedures"] != EXPECTED_PROCEDURES:
            failed += 1
            print("فشل: عدد الإجراءات ليس", EXPECTED_PROCEDURES)
        if not result["title"]:
            failed += 1
            print("فشل: اسم البرنامج لم يُملأ من عنوان المؤشر")
        if not result["narrative"] or "يهدف البرنامج" not in result["narrative"]:
            failed += 1
            print("فشل: النص التربوي لم يظهر")
        browser.close()
    print("النتيجة: نجاح" if not failed else "النتيجة: فشل")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
