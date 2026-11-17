# فحص مسارات الطباعة. يفتح الشاشات ويلتقط المعاينة، ولا يكتب بيانات المدرسة.
# جلسة الدخول صف في auth_sessions فقط، حتى تُفتح الشاشات المحمية.

from __future__ import annotations

import json
import os
import sqlite3
import sys
import unicodedata
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE = os.environ.get("AUDIT_BASE", "http://127.0.0.1:8060").rstrip("/")
DB_PATH = ROOT / "School_Data" / "school_1059.db"
OUT_DIR = ROOT / "audit_screenshots"
HEADER = "المملكة العربية السعودية"
SIGNOFF = "اعتماد"


def principal_id() -> str:
    connection = sqlite3.connect(DB_PATH)
    try:
        row = connection.execute(
            """
            SELECT national_id FROM users
            WHERE COALESCE(is_active, 1) = 1
              AND role LIKE 'مدير%'
              AND TRIM(COALESCE(national_id, '')) != ''
            LIMIT 1
            """
        ).fetchone()
    finally:
        connection.close()
    if not row or not str(row[0]).strip():
        raise SystemExit("لا حساب مدير لقراءة الشاشات.")
    return str(row[0]).strip()


def http_json(url: str, payload: dict | None = None) -> dict:
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def login_payload() -> dict:
    trial = http_json(BASE + "/api/trial-launch")
    password = str(trial.get("password") or "").strip() if trial.get("enabled") else ""
    if not password:
        password = os.environ.get("AUDIT_PASSWORD", "").strip()
    if not password:
        raise SystemExit("وضع التجربة مغلق، ولا تُخزَّن كلمة مرور داخل السكربت.")
    body = http_json(
        BASE + "/api/login",
        {"national_id": principal_id(), "password": password},
    )
    if not body.get("token"):
        raise SystemExit("الدخول لم يعد رمزاً للجلسة.")
    return body


def first_program_id() -> str:
    payload = http_json(BASE + "/api/programs")
    programs = payload.get("programs") if isinstance(payload, dict) else []
    for item in programs or []:
        if isinstance(item, dict) and item.get("id"):
            return str(item["id"])
    return ""


def first_council_id() -> str:
    payload = http_json(BASE + "/api/councils")
    minutes = payload.get("minutes") if isinstance(payload, dict) else []
    for item in minutes or []:
        if isinstance(item, dict) and str(item.get("id") or "").strip():
            return str(item["id"]).strip()
    return ""


def routes() -> list[dict]:
    program_id = first_program_id()
    council_id = first_council_id()
    items = [
        {
            "name": "سجل الطلاب",
            "file": "students",
            "hash": "view-student-registry",
            "button": "#aj-sr-print",
            "ready": "#aj-sr-status",
            "ready_js": "() => document.querySelectorAll('#aj-sr-table tr').length > 2",
        },
        {
            "name": "المنسوبون",
            "file": "staff",
            "hash": "view-staff",
            "button": "#aj-staff-print",
            "ready": "#aj-staff-status",
            "ready_js": "() => document.querySelectorAll('#aj-staff-table-wrap tbody tr').length > 2",
        },
        {
            "name": "اللجان",
            "file": "committees",
            "hash": "view-council-details?id=" + council_id if council_id else "view-committees",
            "button": "#aj-council-print" if council_id else "",
            "ready": "#view-council-details, #view-committees",
            "ready_js": """() => {
                const title = document.querySelector('#aj-council-detail-title');
                const body = document.querySelector('#aj-council-detail-body');
                const label = title ? title.textContent.trim() : '';
                return label && label !== 'محضر المجلس' && body && body.textContent.trim().length > 8;
            }""",
            "blocked": "" if council_id else "لا محضر محفوظ، وزر اعتماد التشكيل يكتب بيانات فلم يُضغط",
        },
        {
            "name": "بطاقة البرنامج",
            "file": "program-card",
            "hash": "view-plan-details?id=" + program_id if program_id else "view-planning",
            "button": "#aj-plan-print" if program_id else "",
            "ready": "#aj-plan-print, #aj-plan-detail-error",
            "ready_js": """() => {
                const goals = document.querySelector('#aj-plan-detail-goals');
                const text = goals ? goals.textContent.trim() : '';
                return text.length > 12 && text.indexOf('ستُعرض هنا') < 0;
            }""",
            "blocked": "" if program_id else "لا برنامج محفوظ لفتح بطاقته",
        },
        {
            "name": "الخطط",
            "file": "plans",
            "hash": "view-plan-details?id=operational-plan",
            "button": "#aj-plan-print",
            "ready": "#aj-plan-print",
        },
    ]
    return items


def judge(html: str, opened: bool) -> tuple[bool, str]:
    if not opened:
        return False, "لم تُفتح المعاينة"
    has_header = HEADER in html
    has_signoff = SIGNOFF in html
    has_core = 'class="pm-document' in html or "pm-document" in html
    if has_header and has_signoff and has_core:
        return True, ""
    if has_header and has_signoff and not has_core:
        return False, "الترويسة والاعتماد ظاهران دون PrintMasterCore"
    missing = []
    if not has_header:
        missing.append("لا ترويسة")
    if not has_signoff:
        missing.append("لا اعتماد")
    if not has_core:
        missing.append("لا PrintMasterCore")
    return False, "، ".join(missing)


def analyze_pdf(path: Path) -> tuple[bool, str]:
    try:
        from pypdf import PdfReader
    except ImportError:
        return False, "تعذر قراءة PDF"
    reader = PdfReader(str(path))
    pages = list(reader.pages)
    if not pages:
        return False, "PDF بلا صفحات"
    problems = []
    header_pages = []
    sign_pages = []
    footer_pages = []
    for index, pdf_page in enumerate(pages, start=1):
        width_mm = float(pdf_page.mediabox.width) * 25.4 / 72
        height_mm = float(pdf_page.mediabox.height) * 25.4 / 72
        portrait = abs(width_mm - 210) <= 3 and abs(height_mm - 297) <= 3
        landscape = abs(width_mm - 297) <= 3 and abs(height_mm - 210) <= 3
        if not portrait and not landscape:
            problems.append("صفحة " + str(index) + " أبعادها " + format(width_mm, ".0f") + "×" + format(height_mm, ".0f") + "مم")
        text = unicodedata.normalize("NFKC", pdf_page.extract_text() or "")
        if "المملكة" in text or "السعودية" in text:
            header_pages.append(index)
        if "الصفحة" in text:
            footer_pages.append(index)
        if "التوقيعات والاعتمادات" in text:
            sign_pages.append(index)
    count = len(pages)
    if header_pages and len(header_pages) != count:
        problems.append("الترويسة لا تتكرر في كل صفحات PDF")
    if header_pages and len(footer_pages) != count:
        problems.append("التذييل أو رقم الصفحة لا يتكرر")
    if sign_pages != [count]:
        problems.append("الاعتماد ليس في الصفحة الأخيرة فقط")
    note = str(count) + " صفحة، عرض " + format(float(pages[0].mediabox.width) * 25.4 / 72, ".0f") + "مم"
    if not header_pages:
        note += "، نص الترويسة غير مستخرج"
    if problems:
        return False, note + " — " + "، ".join(problems)
    return True, note


def open_route(page, item: dict) -> tuple[bool, str]:
    if item.get("blocked"):
        page.goto(BASE + "/app-journey.html#" + item["hash"], wait_until="domcontentloaded")
        page.wait_for_timeout(1200)
        page.screenshot(path=str(OUT_DIR / (item["file"] + ".png")), full_page=True)
        return False, item["blocked"]
    page.goto(BASE + "/app-journey.html#" + item["hash"], wait_until="domcontentloaded")
    if item.get("ready_js"):
        page.wait_for_function(item["ready_js"], timeout=25000)
    button = page.locator(item["button"])
    button.wait_for(state="attached", timeout=20000)
    page.wait_for_function(
        """(selector) => {
            const node = document.querySelector(selector);
            return node && !node.hidden && !node.disabled;
        }""",
        arg=item["button"],
        timeout=25000,
    )
    page.evaluate(
        """(selector) => {
            const node = document.querySelector(selector);
            if (!node) {
                throw new Error('الزر غير موجود');
            }
            node.click();
        }""",
        item["button"],
    )
    opened = False
    try:
        page.wait_for_selector("#aj-print-stage:not([hidden]) #aj-print-stage-page", timeout=25000)
        opened = True
    except Exception:
        opened = False
    page.wait_for_timeout(800)
    if opened:
        page.evaluate("() => { window.__auditPrintArmed = false; }")
        go = page.locator("#aj-print-preview-go")
        if go.count() and go.is_visible():
            go.click()
            try:
                page.wait_for_function("() => window.__auditPrintArmed === true", timeout=20000)
            except Exception:
                pass
        pdf_path = OUT_DIR / (item["file"] + ".pdf")
        page.pdf(
            path=str(pdf_path),
            print_background=True,
            prefer_css_page_size=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        )
        pdf_ok, pdf_note = analyze_pdf(pdf_path)
        item["pdf"] = {"ok": pdf_ok, "note": pdf_note}
    html = ""
    if opened:
        html = page.locator("#aj-print-stage-page").inner_html()
        measure = page.evaluate(
            """() => {
                const doc = document.querySelector('#aj-print-stage-page .pm-document, #aj-print-stage-page .pm-sheet');
                const width = doc ? doc.getBoundingClientRect().width : 0;
                return {
                    width: Math.round(width),
                    headers: document.querySelectorAll('#aj-print-stage-page thead').length,
                    footers: document.querySelectorAll('#aj-print-stage-page tfoot, #aj-print-stage-page .pm-page-num').length,
                    signoffs: document.querySelectorAll('#aj-print-stage-page .doc-signoff-block, #aj-print-stage-page .pm-signoff').length
                };
            }"""
        )
        item["measure"] = measure
    try:
        page.screenshot(path=str(OUT_DIR / (item["file"] + "-shot.png")), full_page=False)
    except Exception:
        pass
    page.evaluate(
        """() => {
            const stage = document.getElementById('aj-print-stage');
            if (stage) {
                stage.hidden = true;
            }
            document.body.classList.remove(
                'is-print-preview',
                'print-official-core',
                'print-official-multi',
                'print-official-list',
                'print-official-landscape',
                'print-master',
                'print-master-landscape'
            );
        }"""
    )
    if not opened:
        toast = page.evaluate(
            """() => {
                const node = document.querySelector('.aj-toast');
                return node ? (node.textContent || '').trim() : '';
            }"""
        )
        if toast:
            item["toast"] = toast
    ok, reason = judge(html, opened)
    if not ok and item.get("toast"):
        reason = reason + " — " + item["toast"]
    pdf = item.get("pdf")
    if ok and pdf and not pdf.get("ok"):
        return False, pdf.get("note") or "PDF غير مطابق"
    measure = item.get("measure") or {}
    if ok and measure:
        if not measure.get("headers"):
            return False, "لا ترويسة في المعاينة"
        if not measure.get("footers"):
            return False, "لا تذييل في المعاينة"
        if not measure.get("signoffs"):
            return False, "لا اعتماد في المعاينة"
    return ok, reason


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    user = login_payload()
    stored = {
        "id": user.get("id") or "",
        "name": user.get("name") or "",
        "role": user.get("role") or "",
        "roles": user.get("roles") or [],
        "token": user.get("token") or "",
    }
    lines = []
    failed = 0
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, channel="chrome")
        context = browser.new_context(viewport={"width": 1440, "height": 900}, locale="ar-SA")
        context.add_init_script(
            "window.confirm = function () { return true; };"
            "window.__auditPrintArmed = false;"
            "window.print = function () { window.__auditPrintArmed = true; };"
        )
        page = context.new_page()
        page.on("dialog", lambda dialog: dialog.accept())
        page.goto(BASE + "/login.html", wait_until="domcontentloaded")
        page.evaluate("(user) => sessionStorage.setItem('sessionUser', JSON.stringify(user))", stored)
        for item in routes():
            try:
                ok, reason = open_route(page, item)
            except Exception as error:
                ok = False
                reason = str(error).splitlines()[0][:180] or "تعذر فتح المسار"
                shot = OUT_DIR / (item["file"] + ".png")
                if not shot.is_file():
                    try:
                        page.screenshot(path=str(shot), full_page=True)
                    except Exception:
                        pass
            if ok:
                measure = item.get("measure") or {}
                extra = ""
                if measure:
                    extra = " (عرض " + str(measure.get("width") or 0) + "px، ترويسات " + str(measure.get("headers") or 0) + "، تذييل " + str(measure.get("footers") or 0) + "، اعتماد " + str(measure.get("signoffs") or 0) + ")"
                pdf = item.get("pdf") or {}
                if pdf.get("note"):
                    extra += " | PDF " + pdf["note"]
                line = "المسار " + item["name"] + ": ✅ ناجح" + extra
            else:
                failed += 1
                line = "المسار " + item["name"] + ": ❌ فاشل (" + reason + ")"
            print(line)
            lines.append(line)
        browser.close()
    report = OUT_DIR / "report.txt"
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
