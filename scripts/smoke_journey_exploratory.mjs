#!/usr/bin/env node
/**
 * فحص دخان استكشافي لرحلة المدير (app-journey.html)
 * قبل التسليم: تنقل متسلسل/عشوائي، تكيف 390/1366، emulateMedia('print')،
 * ورصد Console + استجابات 4xx/5xx.
 *
 * الاستخدام:
 *   BASE_URL=http://127.0.0.1:8060 \
 *   SMOKE_NATIONAL_ID=1046940365 \
 *   SMOKE_PASSWORD=... \
 *   node scripts/smoke_journey_exploratory.mjs
 *
 * إن لم تُمرَّر كلمة المرور تُقرأ محلياً من School_Data/.initial_admin_password (إن وُجد).
 */
import { chromium, request } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = String(process.env.BASE_URL || "http://127.0.0.1:8060").replace(/\/$/, "");
const OUT_DIR = path.resolve(ROOT, "artifacts", "smoke");
const NATIONAL_ID = String(process.env.SMOKE_NATIONAL_ID || "1046940365").trim();
const SEED = Number(process.env.SMOKE_SEED || Date.now() % 1e9);

fs.mkdirSync(OUT_DIR, { recursive: true });

function readPassword() {
  const fromEnv = String(process.env.SMOKE_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || "").trim();
  if (fromEnv) return fromEnv;
  const marker = path.join(ROOT, "School_Data", ".initial_admin_password");
  if (fs.existsSync(marker)) {
    return fs.readFileSync(marker, "utf8").trim();
  }
  throw new Error("SMOKE_PASSWORD غير معيّنة ولا يوجد School_Data/.initial_admin_password");
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);

const STATION_HUBS = [
  "view-station-foundation",
  "view-station-planning",
  "view-station-registers",
  "view-station-measurement"
];

const CORE_VIEWS = [
  "view-desk",
  "view-home",
  "view-school",
  "view-letterhead",
  "view-import-center",
  "view-staff",
  "view-students-lists",
  "view-leadership",
  "view-committees",
  "view-access-hub",
  "view-calendar-hub",
  "view-system-care",
  "view-planning",
  "view-smart-planning",
  "view-program-add",
  "view-term-schedule",
  "view-execution",
  "view-visits-plan",
  "view-visits",
  "view-deliverables",
  "view-env-evidence",
  "view-evidence",
  "view-performance",
  "view-nafes",
  "view-external-eval",
  "view-tasks"
];

function pickRandom(list, count) {
  const copy = list.slice();
  const out = [];
  while (copy.length && out.length < count) {
    const i = Math.floor(rand() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

function isIgnorableConsole(text) {
  const t = String(text || "");
  if (/WebSocket connection to .*\/ws\/events/.test(t)) return true;
  if (/Failed to load resource: net::ERR_CONNECTION_REFUSED.*\/ws\//.test(t)) return true;
  return false;
}

function isIgnorableRequest(url, status) {
  const u = String(url || "");
  if (u.includes("/ws/events")) return true;
  if (status === 401 && u.includes("/api/session/events")) return true;
  return false;
}

async function loginViaApi(api) {
  const password = readPassword();
  const res = await api.post("/api/login", {
    data: { national_id: NATIONAL_ID, password }
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error("فشل الدخول للفحص: HTTP " + res.status() + " " + body.slice(0, 200));
  }
  return res.json();
}

async function injectSession(context, session) {
  await context.addInitScript((payload) => {
    try {
      sessionStorage.setItem("sessionUser", JSON.stringify(payload));
    } catch (error) {
      /* ignore */
    }
  }, session);
}

async function activeViewMeta(page) {
  return page.evaluate(() => {
    const active = document.querySelector(".aj-main > .aj-view.is-active, .aj-main > .aj-view:not([hidden])");
    const all = Array.from(document.querySelectorAll(".aj-main > .aj-view"));
    const visible = all.filter((el) => {
      const style = window.getComputedStyle(el);
      return !el.hidden && style.display !== "none" && style.visibility !== "hidden";
    });
    const desk = document.getElementById("view-desk");
    const deskVisible =
      !!desk &&
      !desk.hidden &&
      desk.classList.contains("is-active") &&
      window.getComputedStyle(desk).display !== "none";
    const rect = active ? active.getBoundingClientRect() : null;
    const text = active ? String(active.innerText || "").replace(/\s+/g, " ").trim() : "";
    return {
      hash: location.hash.replace(/^#/, "") || "",
      activeId: active ? active.id : "",
      visibleCount: visible.length,
      visibleIds: visible.map((el) => el.id),
      deskVisible,
      height: rect ? Math.round(rect.height) : 0,
      textLen: text.length,
      textSample: text.slice(0, 120)
    };
  });
}

async function gotoView(page, viewId) {
  await page.goto(BASE + "/app-journey.html#" + viewId, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.classList.contains("aj-auth-ready"), null, {
    timeout: 20000
  });
  await page.waitForTimeout(350);
  return activeViewMeta(page);
}

async function assertIsolation(meta, expectDesk) {
  const failures = [];
  if (meta.visibleCount !== 1) {
    failures.push("screens=" + meta.visibleCount + " ids=" + meta.visibleIds.join(","));
  }
  if (meta.activeId && meta.hash && !meta.hash.startsWith(meta.activeId)) {
    failures.push("hash≠active hash=" + meta.hash + " active=" + meta.activeId);
  }
  if (expectDesk) {
    if (!meta.deskVisible) failures.push("desk-hidden");
  } else if (meta.deskVisible && meta.activeId !== "view-desk") {
    failures.push("desk-leak");
  }
  if (meta.height < 40) failures.push("height=" + meta.height);
  if (meta.textLen < 8 && meta.activeId !== "view-system-care") {
    failures.push("empty-text len=" + meta.textLen);
  }
  return failures;
}

async function checkPrintEmulation(page, report) {
  await page.emulateMedia({ media: "print" });
  const printMeta = await page.evaluate(() => {
    const stage = document.getElementById("aj-print-stage");
    const pageEl = document.getElementById("aj-print-stage-page");
    const shell = document.querySelector(".aj-shell");
    const stageStyle = stage ? window.getComputedStyle(stage) : null;
    const pageStyle = pageEl ? window.getComputedStyle(pageEl) : null;
    return {
      preview: document.body.classList.contains("is-print-preview"),
      stageHidden: !stage || stage.hidden,
      stageDisplay: stageStyle ? stageStyle.display : "missing",
      stageVisibility: stageStyle ? stageStyle.visibility : "missing",
      pageDisplay: pageStyle ? pageStyle.display : "missing",
      pageText: pageEl ? String(pageEl.innerText || "").replace(/\s+/g, " ").trim().slice(0, 160) : "",
      pageHtmlLen: pageEl ? pageEl.innerHTML.length : 0,
      shellDisplay: shell ? window.getComputedStyle(shell).display : "missing"
    };
  });
  await page.emulateMedia({ media: "screen" });
  report.printChecks.push(printMeta);
  const fails = [];
  if (!printMeta.preview) fails.push("not-in-preview");
  if (printMeta.stageHidden) fails.push("stage-hidden");
  if (printMeta.stageDisplay === "none") fails.push("stage-display-none");
  if (printMeta.pageHtmlLen < 40) fails.push("blank-stage");
  if (/موهوبين/.test(printMeta.pageText) && /visits-plan|زيارات/.test(report.lastPrintContext || "")) {
    fails.push("wrong-doc-gifted");
  }
  return fails;
}

async function openVisitPlanPrint(page, report) {
  await gotoView(page, "view-visits-plan");
  report.lastPrintContext = "visits-plan";
  const btn = page.locator("#aj-visit-plan-print");
  await btn.waitFor({ state: "visible", timeout: 15000 });
  await btn.click();
  await page.waitForSelector("#aj-print-stage:not([hidden])", { timeout: 20000 });
  await page.waitForTimeout(600);
  const text = await page.locator("#aj-print-stage-page").innerText().catch(() => "");
  report.visitPrintSample = String(text || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const fails = [];
  if (!/خطة الزيارات|الزيارات الصفية/.test(text)) {
    fails.push("visit-print-missing-title");
  }
  if (/رعاية الموهوبين|بطاقة برنامج/.test(text)) {
    fails.push("visit-print-shows-gifted-program");
  }
  const printFails = await checkPrintEmulation(page, report);
  fails.push(...printFails);
  const closeBtn = page.locator("#aj-print-preview-close");
  if (await closeBtn.count()) {
    await closeBtn.click();
    await page.waitForTimeout(200);
  }
  return fails;
}

async function runViewport(browser, size, report) {
  const consoleErrors = [];
  const netFailures = [];
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    locale: "ar-SA"
  });
  await injectSession(context, report.session);
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsole(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err && err.message ? err.message : err));
  });
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 400 && !isIgnorableRequest(res.url(), status)) {
      netFailures.push({ status, url: res.url() });
    }
  });

  await page.goto(BASE + "/app-journey.html#view-desk", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.classList.contains("aj-auth-ready"), null, {
    timeout: 20000
  });
  // تأكيد الجلسة بعد التحميل ثم إعادة توجيه واحدة إن لزم
  const hasToken = await page.evaluate(() => {
    try {
      const raw = sessionStorage.getItem("sessionUser");
      const user = raw ? JSON.parse(raw) : null;
      return !!(user && user.token);
    } catch (error) {
      return false;
    }
  });
  if (!hasToken) {
    await page.evaluate((payload) => {
      sessionStorage.setItem("sessionUser", JSON.stringify(payload));
    }, report.session);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.classList.contains("aj-auth-ready"), null, {
      timeout: 20000
    });
  }

  const label = size.width + "x" + size.height;
  const viewFails = [];

  for (const hub of STATION_HUBS) {
    const meta = await gotoView(page, hub);
    const fails = await assertIsolation(meta, false);
    if (fails.length) viewFails.push({ view: hub, viewport: label, fails, meta });
  }

  const sequential = CORE_VIEWS.slice();
  const exploratory = pickRandom(CORE_VIEWS.filter((v) => v !== "view-desk"), 8);
  const tour = Array.from(new Set(sequential.concat(exploratory)));

  for (const viewId of tour) {
    const meta = await gotoView(page, viewId);
    const fails = await assertIsolation(meta, viewId === "view-desk");
    if (fails.length) viewFails.push({ view: viewId, viewport: label, fails, meta });
  }

  let printFails = [];
  try {
    printFails = await openVisitPlanPrint(page, report);
  } catch (error) {
    printFails = ["visit-print-exception:" + (error && error.message ? error.message : error)];
  }

  const shot = path.join(OUT_DIR, "viewport-" + size.width + ".png");
  await page.screenshot({ path: shot, fullPage: false });

  await context.close();
  return {
    viewport: label,
    viewFails,
    printFails,
    consoleErrors,
    netFailures,
    screenshot: shot
  };
}

async function main() {
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    seed: SEED,
    nationalId: NATIONAL_ID,
    session: null,
    printChecks: [],
    lastPrintContext: "",
    visitPrintSample: "",
    results: [],
    ok: false
  };

  const requestContext = await request.newContext({ baseURL: BASE });
  try {
    const login = await loginViaApi(requestContext);
    const roles = login.roles && login.roles.length ? login.roles : [login.role || "مدير مدرسة"];
    report.session = {
      id: String(login.id || NATIONAL_ID),
      name: login.name || "",
      role: roles[0] || login.role || "مدير مدرسة",
      roles: roles,
      token: login.token || ""
    };
  } finally {
    await requestContext.dispose();
  }

  const browser = await chromium.launch({ headless: true });
  try {
    for (const size of [
      { width: 390, height: 844 },
      { width: 1366, height: 768 }
    ]) {
      report.results.push(await runViewport(browser, size, report));
    }
  } finally {
    await browser.close();
  }

  const allViewFails = report.results.flatMap((r) => r.viewFails);
  const allPrintFails = report.results.flatMap((r) => r.printFails);
  const allConsole = report.results.flatMap((r) => r.consoleErrors);
  const allNet = report.results.flatMap((r) => r.netFailures);
  report.ok =
    allViewFails.length === 0 &&
    allPrintFails.length === 0 &&
    allConsole.length === 0 &&
    allNet.length === 0;

  const outFile = path.join(OUT_DIR, "smoke-report.json");
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");

  const summary = {
    ok: report.ok,
    seed: SEED,
    viewFails: allViewFails.length,
    printFails: allPrintFails,
    consoleErrors: allConsole.slice(0, 20),
    netFailures: allNet.slice(0, 20),
    visitPrintSample: report.visitPrintSample,
    report: outFile
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error) }, null, 2));
  process.exit(1);
});
