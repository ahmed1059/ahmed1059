#!/usr/bin/env node
/**
 * فحص دخان: قرار لجنة مستقلة + التشكيل العام عبر PrintEngine.
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

fs.mkdirSync(OUT_DIR, { recursive: true });

function readPassword() {
  const fromEnv = String(process.env.SMOKE_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || "").trim();
  if (fromEnv) return fromEnv;
  const marker = path.join(ROOT, "School_Data", ".initial_admin_password");
  if (fs.existsSync(marker)) {
    return fs.readFileSync(marker, "utf8").trim();
  }
  throw new Error("SMOKE_PASSWORD غير معيّنة");
}

async function loginViaApi(api) {
  const password = readPassword();
  const res = await api.post("/api/login", {
    data: { national_id: NATIONAL_ID, password }
  });
  if (!res.ok()) {
    throw new Error("فشل الدخول: HTTP " + res.status());
  }
  return res.json();
}

async function ensureFormation(api, token) {
  const headers = { "X-Session-Token": token };
  let res = await api.get("/api/session/committees", { headers });
  let body = await res.json();
  if (!body.has_formation) {
    res = await api.post("/api/session/committees/draw", { headers, data: {} });
    body = await res.json();
  }
  if (body.needs_approval) {
    res = await api.post("/api/session/committees/approve", {
      headers,
      data: { acknowledged: true }
    });
    body = await res.json();
  }
  return body;
}

function previewProbe(page) {
  return page.evaluate(() => {
    const stage = document.querySelector(".aj-print-stage, #aj-print-stage, .aj-print-preview");
    const body = document.body;
    const title = document.querySelector(".pm-document .pm-doc-title, .pm-body h1, .aj-print-stage h1, .pm-document h1");
    const decree = document.querySelector(".aj-committee-decree");
    const table = document.querySelector(".aj-committee-print-table");
    const foot = document.querySelector(".pm-foot");
    const clearance = document.querySelector(".pm-clearance");
    const text = (decree && decree.innerText) || (stage && stage.innerText) || "";
    return {
      preview: body.classList.contains("is-print-preview"),
      hasDecree: !!decree,
      hasTable: !!table,
      hasFoot: !!foot,
      hasClearance: !!clearance,
      clearanceH: clearance ? clearance.getBoundingClientRect().height : 0,
      title: title ? String(title.textContent || "").trim() : "",
      hasBasis: /الدليل التنظيمي/.test(text),
      hasTasks: /مهام اللجنة/.test(text),
      textLen: text.replace(/\s+/g, " ").trim().length
    };
  });
}

async function closePreview(page) {
  await page.evaluate(() => {
    document.body.classList.remove("is-print-preview", "print-official-core", "print-official-multi", "print-official-list", "print-master");
    const stage = document.getElementById("aj-print-stage");
    if (stage) {
      stage.hidden = true;
      stage.style.display = "none";
      stage.style.visibility = "hidden";
      stage.style.pointerEvents = "none";
    }
    const pageEl = document.getElementById("aj-print-stage-page");
    if (pageEl) {
      pageEl.innerHTML = "";
    }
  }).catch(() => {});
  await page.waitForFunction(() => {
    const stage = document.getElementById("aj-print-stage");
    return !document.body.classList.contains("is-print-preview") && (!stage || stage.hidden);
  }, null, { timeout: 5000 }).catch(() => {});
}

async function main() {
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    nationalId: NATIONAL_ID,
    bank: {},
    single: {},
    general: {},
    ok: false,
    errors: []
  };

  const api = await request.newContext({ baseURL: BASE });
  try {
    const bankRes = await api.get("/data/committees-bank.json");
    report.bank = {
      status: bankRes.status(),
      ok: bankRes.ok()
    };
    if (!bankRes.ok()) {
      throw new Error("committees-bank.json غير متاح");
    }
    const bank = await bankRes.json();
    report.bank.keys = Object.keys(bank.committees || {}).length;
    report.bank.hasDecree = !!(bank.decree && bank.decree.basis);

    const login = await loginViaApi(api);
    const roles = login.roles && login.roles.length ? login.roles : [login.role || "مدير مدرسة"];
    const session = {
      id: String(login.id || NATIONAL_ID),
      name: login.name || "",
      role: roles[0] || login.role || "مدير مدرسة",
      roles,
      token: login.token || "",
      signature_path: login.signature_path || "saved"
    };
    const formation = await ensureFormation(api, session.token);
    report.formation = {
      has_formation: !!formation.has_formation,
      committees: (formation.committees || []).filter((c) => (c.members || []).length).length,
      stamp: formation.stamp || ""
    };

    const browser = await chromium.launch({
      headless: true,
      args: ["--font-render-hinting=none"]
    });
    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      locale: "ar-SA"
    });
    await context.addInitScript((payload) => {
      sessionStorage.setItem("sessionUser", JSON.stringify(payload));
    }, session);

    const page = await context.newPage();
    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(BASE + "/app-journey.html#view-committees", { waitUntil: "networkidle" });
    await page.waitForSelector("#view-committees", { timeout: 15000 });
    await page.waitForTimeout(1200);

    const singleBtn = page.locator("[data-print-committee]").first();
    if (!(await singleBtn.count())) {
      throw new Error("لا زر طباعة قرار لجنة — التشكيل بلا أعضاء؟");
    }
    const committeeId = await singleBtn.getAttribute("data-print-committee");
    await singleBtn.click();
    await page.waitForFunction(() => document.body.classList.contains("is-print-preview"), null, {
      timeout: 10000
    });
    await page.waitForTimeout(800);
    report.single = await previewProbe(page);
    report.single.committeeId = committeeId;
    await page.screenshot({
      path: path.join(OUT_DIR, "committee-decree-single.png"),
      fullPage: true
    });
    // لقطة أقرب لمنطقة القرار
    const stage = page.locator(".aj-print-stage, #aj-print-stage, .pm-document").first();
    if (await stage.count()) {
      await stage.screenshot({ path: path.join(OUT_DIR, "committee-decree-single-frame.png") });
    }
    await closePreview(page);
    await page.waitForTimeout(400);

    const generalBtn = page.locator("#aj-committee-print-general");
    if (!(await generalBtn.count()) || (await generalBtn.isHidden())) {
      throw new Error("زر طباعة التشكيل العام مخفي أو غير موجود");
    }
    await generalBtn.click();
    await page.waitForFunction(() => document.body.classList.contains("is-print-preview"), null, {
      timeout: 10000
    });
    await page.waitForTimeout(900);
    report.general = await previewProbe(page);
    await page.screenshot({
      path: path.join(OUT_DIR, "committee-decree-general.png"),
      fullPage: true
    });
    if (await stage.count()) {
      await stage.screenshot({ path: path.join(OUT_DIR, "committee-decree-general-frame.png") });
    }
    await closePreview(page);

    report.consoleErrors = consoleErrors.slice(0, 20);
    report.ok = !!(
      report.bank.ok &&
      report.single.preview &&
      report.single.hasDecree &&
      report.single.hasTable &&
      report.single.hasBasis &&
      report.general.preview &&
      report.general.hasDecree &&
      report.general.hasTable &&
      report.general.hasBasis
    );
    if (!report.ok) {
      report.errors.push("فشل شروط المعاينة (ديباجة/جدول/معاينة)");
    }

    await browser.close();
  } catch (error) {
    report.ok = false;
    report.errors.push(String(error && error.message ? error.message : error));
  } finally {
    await api.dispose();
  }

  const outPath = path.join(OUT_DIR, "committee-decree-smoke.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

main();
