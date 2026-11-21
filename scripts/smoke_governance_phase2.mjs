#!/usr/bin/env node
/**
 * دخان المرحلة 2 + حوكمة اللجان + توزيع الزيارات.
 */
import { chromium, request } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
  if (fs.existsSync(marker)) return fs.readFileSync(marker, "utf8").trim();
  throw new Error("SMOKE_PASSWORD غير معيّنة");
}

function auditLegacyPrint() {
  const jsRoot = path.join(ROOT, "Print_Canvas", "js");
  const offenders = [];
  for (const name of fs.readdirSync(jsRoot)) {
    if (!name.endsWith(".js") || name === "print-engine.js" || name.endsWith(".min.js")) continue;
    const text = fs.readFileSync(path.join(jsRoot, name), "utf8");
    if (/window\.print\s*\(/.test(text)) offenders.push(name);
  }
  return offenders;
}

async function loginViaApi(api) {
  const res = await api.post("/api/login", {
    data: { national_id: NATIONAL_ID, password: readPassword() }
  });
  if (!res.ok()) throw new Error("فشل الدخول HTTP " + res.status());
  return res.json();
}

async function main() {
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    ok: false,
    errors: [],
    printGate: {},
    visitDistribute: {},
    committees: {},
    decree: {}
  };

  const offenders = auditLegacyPrint();
  report.printGate = {
    zeroWindowPrintOutsideEngine: offenders.length === 0,
    offenders,
    archiveExists: fs.existsSync(path.join(ROOT, "School_Data", "archive", "print-unify-phase2", "README.txt")),
    printUnifyGone: !fs.existsSync(path.join(ROOT, "School_Data", "print-unify"))
  };
  if (offenders.length) report.errors.push("window.print خارج النواة: " + offenders.join(","));

  const visitSmoke = spawnSync("python3", [path.join(ROOT, "scripts", "smoke_visit_distribute.py")], {
    cwd: ROOT,
    encoding: "utf8"
  });
  report.visitDistribute = {
    exitCode: visitSmoke.status,
    stdout: String(visitSmoke.stdout || "").trim(),
    stderr: String(visitSmoke.stderr || "").trim().slice(0, 400)
  };
  if (visitSmoke.status !== 0) report.errors.push("فشل دخان توزيع الزيارات");

  const bank = JSON.parse(fs.readFileSync(path.join(ROOT, "Print_Canvas", "data", "committees-bank.json"), "utf8"));
  const quotaIds = Object.keys(bank.committees || {});
  report.committees.bankCount = quotaIds.length;
  report.committees.allHaveQuotas = quotaIds.every((id) => bank.committees[id].quotas && bank.committees[id].size);
  if (!report.committees.allHaveQuotas || quotaIds.length !== 10) {
    report.errors.push("بنك اللجان بلا نصاب كامل للعشر");
  }

  const api = await request.newContext({ baseURL: BASE });
  try {
    const login = await loginViaApi(api);
    const token = login.token;
    const headers = { "X-Session-Token": token };

    let committees = await (await api.get("/api/session/committees", { headers })).json();
    if (!committees.has_formation) {
      committees = await (await api.post("/api/session/committees/draw", { headers, data: {} })).json();
    }
    if (committees.needs_approval) {
      committees = await (
        await api.post("/api/session/committees/approve", {
          headers,
          data: { acknowledged: true }
        })
      ).json();
    }

    report.committees.decree_date = committees.decree_date || "";
    report.committees.sample = (committees.committees || []).slice(0, 4).map((c) => ({
      id: c.id,
      badge: c.quota && c.quota.badge,
      complete: c.quota && c.quota.complete,
      missing: ((c.quota && c.quota.missing) || []).map((m) => m.label + "×" + m.count),
      members: (c.members || []).length,
      byOffice: (c.members || []).filter((m) => m.by_office).length
    }));
    if (!report.committees.decree_date) report.errors.push("decree_date فارغ");

    let dist = await api.post("/api/session/visit-plans/distribute", { headers, data: {} });
    let distBody = await dist.json();
    report.visitDistribute.http = dist.status();
    report.visitDistribute.ok = !!distBody.ok;
    const items = distBody.items || [];
    const withLesson = items.filter((row) => row.visit_1_lesson || (row.notes && /درس|مهارة|وحدة/.test(row.notes)));
    const visitors = new Set();
    let sameVisitorTwice = 0;
    items.forEach((row) => {
      if (row.visit_1_visitor) visitors.add(row.visit_1_visitor);
      if (row.visit_2_visitor) visitors.add(row.visit_2_visitor);
      if (row.visit_1_visitor && row.visit_2_visitor && row.visit_1_visitor === row.visit_2_visitor) {
        sameVisitorTwice += 1;
      }
    });
    report.visitDistribute.teachers = items.length;
    report.visitDistribute.withCurriculum = withLesson.length;
    report.visitDistribute.uniqueVisitors = visitors.size;
    report.visitDistribute.sameVisitorBothVisits = sameVisitorTwice;
    if (sameVisitorTwice > 0 && visitors.size > 1) {
      report.errors.push("تكرار زائر لنفس المعلم في الدورتين: " + sameVisitorTwice);
    }

    const session = {
      id: String(login.id || NATIONAL_ID),
      name: login.name || "",
      role: (login.roles && login.roles[0]) || login.role || "مدير مدرسة",
      roles: login.roles || [login.role || "مدير مدرسة"],
      token,
      signature_path: login.signature_path || "saved"
    };

    const browser = await chromium.launch({ headless: true, args: ["--font-render-hinting=none"] });
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "ar-SA" });
    await context.addInitScript((payload) => {
      sessionStorage.setItem("sessionUser", JSON.stringify(payload));
    }, session);
    const page = await context.newPage();
    await page.goto(BASE + "/app-journey.html#view-committees", { waitUntil: "networkidle" });
    await page.waitForSelector(".aj-governance-card", { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, "governance-boards.png"), fullPage: true });
    const firstCard = page.locator(".aj-governance-card").first();
    await firstCard.screenshot({ path: path.join(OUT_DIR, "governance-card-one.png") });

    const printBtn = page.locator("[data-print-committee]").first();
    await printBtn.click();
    await page.waitForFunction(() => document.body.classList.contains("is-print-preview"), null, {
      timeout: 10000
    });
    await page.waitForTimeout(700);
    report.decree.preview = await page.evaluate(() => {
      const decree = document.querySelector(".aj-committee-decree");
      const text = decree ? decree.innerText : "";
      return {
        hasDecree: !!decree,
        hasBasis: /الدليل التنظيمي/.test(text),
        hasDate: /التاريخ:/.test(text),
        title: (document.querySelector(".pm-document h1, .aj-print-stage h1") || {}).textContent || ""
      };
    });
    await page.locator(".aj-print-stage, #aj-print-stage, .pm-document").first().screenshot({
      path: path.join(OUT_DIR, "governance-decree-single.png")
    });
    await page.evaluate(() => {
      document.body.classList.remove("is-print-preview");
      const stage = document.getElementById("aj-print-stage");
      if (stage) {
        stage.hidden = true;
        stage.style.display = "none";
      }
      const pageEl = document.getElementById("aj-print-stage-page");
      if (pageEl) pageEl.innerHTML = "";
    });

    await page.goto(BASE + "/app-journey.html#view-visits-plan", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, "visit-plan-distributed.png"), fullPage: true });

    await browser.close();
  } catch (error) {
    report.errors.push(String(error && error.message ? error.message : error));
  } finally {
    await api.dispose();
  }

  report.ok =
    report.errors.length === 0 &&
    report.printGate.zeroWindowPrintOutsideEngine &&
    report.printGate.archiveExists &&
    report.committees.allHaveQuotas &&
    report.decree.preview &&
    report.decree.preview.hasDecree;

  const outPath = path.join(OUT_DIR, "governance-phase2-smoke.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
