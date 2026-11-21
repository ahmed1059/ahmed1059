#!/usr/bin/env node
/**
 * فحص دخان استكشافي لرحلة المدير (app-journey.html)
 * قبل التسليم: تنقل متسلسل/عشوائي، تكيف 390/1366، emulateMedia('print')،
 * حارس PrintEngine (قرار 301)، ورصد Console + استجابات 4xx/5xx.
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

function auditPrintGuardStatic() {
  const fails = [];
  const notes = [];
  const shellCss = path.join(ROOT, "Print_Canvas", "css", "print-shell.css");
  const engineJs = path.join(ROOT, "Print_Canvas", "js", "print-engine.js");
  const journeyJs = path.join(ROOT, "Print_Canvas", "js", "app-journey.js");
  const journeyHtml = path.join(ROOT, "Print_Canvas", "app-journey.html");
  const visitsJs = path.join(ROOT, "Print_Canvas", "js", "app-journey-visits.js");
  const curriculumPath = path.join(ROOT, "Print_Canvas", "data", "curriculum-map.json");
  const phrasesPath = path.join(ROOT, "Print_Canvas", "data", "pedagogical-phrases.json");
  const calendarPath = path.join(ROOT, "Print_Canvas", "data", "calendar_1448.json");

  if (!fs.existsSync(shellCss)) fails.push("missing-print-shell.css");
  if (!fs.existsSync(engineJs)) fails.push("missing-print-engine.js");

  const html = fs.existsSync(journeyHtml) ? fs.readFileSync(journeyHtml, "utf8") : "";
  if (!/print-engine\.js/.test(html)) fails.push("app-journey.html-missing-print-engine");

  const journeySource = fs.existsSync(journeyJs) ? fs.readFileSync(journeyJs, "utf8") : "";
  if (/window\.print\s*\(/.test(journeySource)) {
    fails.push("app-journey.js-has-window.print");
  }
  if (!/PrintEngine\.printFromStage/.test(journeySource)) {
    fails.push("app-journey.js-missing-PrintEngine.printFromStage");
  }

  const engineSource = fs.existsSync(engineJs) ? fs.readFileSync(engineJs, "utf8") : "";
  if (!/sandbox/.test(engineSource) || !/print-shell\.css/.test(engineSource)) {
    fails.push("print-engine-missing-sandbox-or-shell");
  }
  if (!/\.print\s*\(/.test(engineSource)) {
    fails.push("print-engine-missing-iframe-print");
  }

  const visitsSource = fs.existsSync(visitsJs) ? fs.readFileSync(visitsJs, "utf8") : "";
  if (!/PrintEngine\.open\s*\(\s*["']master-sheet["']/.test(visitsSource)) {
    fails.push("visits-missing-PrintEngine.open-master-sheet");
  }
  if (!/المعلم المُزار/.test(visitsSource) || !/الزائر المقيّم/.test(visitsSource) || !/مدير المدرسة/.test(visitsSource)) {
    fails.push("visits-missing-three-official-signatures");
  }
  if (!/curriculum-map\.json/.test(visitsSource) || !/suggestFollowUp/.test(visitsSource)) {
    fails.push("visits-missing-curriculum-or-followup");
  }
  if (!/isoAddDays\(dateNode\.value,\s*18\)/.test(visitsSource)) {
    fails.push("visits-followup-not-14-21-days");
  }
  if (/window\.print\s*\(/.test(visitsSource)) {
    fails.push("visits-has-window.print");
  }

  if (!fs.existsSync(curriculumPath)) {
    fails.push("missing-curriculum-map.json");
  } else {
    try {
      const map = JSON.parse(fs.readFileSync(curriculumPath, "utf8"));
      const subjects = Object.keys((map && map.subjects) || {});
      if (subjects.length < 7) fails.push("curriculum-subjects-lt-7");
      for (const subject of subjects) {
        const grades = Object.keys(map.subjects[subject] || {});
        if (grades.length !== 3) fails.push("curriculum-grades-" + subject);
        for (const grade of grades) {
          if (Object.keys(map.subjects[subject][grade] || {}).length !== 18) {
            fails.push("curriculum-weeks-" + subject + "-" + grade);
          }
        }
      }
    } catch (error) {
      fails.push("curriculum-map-invalid-json");
    }
  }

  if (!fs.existsSync(phrasesPath)) {
    fails.push("missing-pedagogical-phrases.json");
  } else {
    try {
      const phrases = JSON.parse(fs.readFileSync(phrasesPath, "utf8"));
      const version = String((phrases.metadata && phrases.metadata.version) || "");
      if (!/^2\./.test(version)) fails.push("phrases-version-not-2x");
      const blob = JSON.stringify(phrases);
      if (blob.includes("من غير نشاط منفصل طويل")) fails.push("phrases-legacy-generic-present");
      if (!blob.includes("{{skill}}") || !blob.includes("{{lesson}}")) fails.push("phrases-missing-tokens");
      const subjectKeys = Object.keys(phrases.subjects || {});
      if (!subjectKeys.includes("رياضيات") || !subjectKeys.includes("العلوم")) {
        fails.push("phrases-missing-specialty-subjects");
      }
    } catch (error) {
      fails.push("phrases-invalid-json");
    }
  }

  if (!fs.existsSync(calendarPath)) {
    fails.push("missing-calendar_1448.json");
  }

  const journeyCss = path.join(ROOT, "Print_Canvas", "css", "app-journey.css");
  if (fs.existsSync(journeyCss)) {
    const css = fs.readFileSync(journeyCss, "utf8");
    const mediaCount = (css.match(/@media\s+print/g) || []).length;
    if (mediaCount > 2) {
      notes.push("app-journey.css-legacy-@media-print=" + mediaCount);
    }
  }

  const legacyPrintCallers = [];
  const jsRoot = path.join(ROOT, "Print_Canvas", "js");
  if (fs.existsSync(jsRoot)) {
    for (const name of fs.readdirSync(jsRoot)) {
      if (!name.endsWith(".js") || name === "print-engine.js" || name.endsWith(".min.js")) continue;
      const full = path.join(jsRoot, name);
      const text = fs.readFileSync(full, "utf8");
      if (/window\.print\s*\(/.test(text)) {
        legacyPrintCallers.push("Print_Canvas/js/" + name);
      }
    }
  }
  if (legacyPrintCallers.length) {
    fails.push("legacy-window.print:" + legacyPrintCallers.join("|"));
  }

  return { fails, notes, legacyPrintCallers };
}

async function auditPrintGuardRuntime(page) {
  const fails = [];
  const meta = await page.evaluate(async () => {
    const engine = window.PrintEngine || null;
    let shellOk = false;
    try {
      const href = engine && engine.shellHref ? engine.shellHref : "/css/print-shell.css";
      const res = await fetch(href, { cache: "no-store" });
      shellOk = !!(res && res.ok);
    } catch (error) {
      shellOk = false;
    }
    return {
      hasEngine: !!(engine && typeof engine.open === "function" && typeof engine.printFromStage === "function"),
      version: engine && engine.version ? String(engine.version) : "",
      frameId: engine && engine.frameId ? String(engine.frameId) : "",
      shellOk: shellOk,
      ajPrint: !!(window.AJPrint && typeof window.AJPrint.show === "function"),
      master: !!(window.PrintMasterCore && typeof window.PrintMasterCore.sheet === "function")
    };
  });
  if (!meta.hasEngine) fails.push("runtime-missing-PrintEngine");
  if (!meta.shellOk) fails.push("runtime-print-shell-unreachable");
  if (!meta.ajPrint) fails.push("runtime-missing-AJPrint");
  if (!meta.master) fails.push("runtime-missing-PrintMasterCore");
  return { fails, meta };
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

async function probePrintEngineIframe(page, report) {
  const engineProbe = await page.evaluate(async () => {
    if (!window.PrintEngine || typeof window.PrintEngine.open !== "function") {
      return { ok: false, error: "no-engine" };
    }
    // مرحلة صفر: افتح وثيقة عبر البوابة إن كانت المعاينة فارغة
    let html = document.getElementById("aj-print-stage-page")
      ? document.getElementById("aj-print-stage-page").innerHTML
      : "";
    if (!html || html.length < 40) {
      if (window.PrintMasterCore && typeof window.PrintMasterCore.stressSheet === "function") {
        window.PrintEngine.open("raw-html", {
          html: window.PrintMasterCore.stressSheet(),
          docTitle: "اختبار_نواة_الطباعة",
          arm: { multiPage: true }
        });
      } else {
        window.PrintEngine.open("master-sheet", {
          docTitle: "فحص بوابة الطباعة",
          metaGrid: [["المدرسة", "متوسطة سعد بن الربيع الأنصاري"], ["الفحص", "مرحلة صفر"]],
          sectionsHtml: "<p>نص فحص عزل الإطار.</p>",
          multiPage: true
        });
      }
      await new Promise((r) => setTimeout(r, 300));
      html = document.getElementById("aj-print-stage-page")
        ? document.getElementById("aj-print-stage-page").innerHTML
        : "";
    }
    if (!html || html.length < 40) {
      return { ok: false, error: "empty-stage" };
    }
    const frame = document.getElementById(window.PrintEngine.frameId || "pe-print-frame") || (function () {
      const el = document.createElement("iframe");
      el.id = window.PrintEngine.frameId || "pe-print-frame";
      el.setAttribute("sandbox", "allow-modals allow-same-origin allow-scripts");
      el.style.cssText = "position:fixed;width:0;height:0;opacity:0;border:0;";
      document.body.appendChild(el);
      return el;
    })();
    const doc = frame.contentDocument;
    if (!doc) return { ok: false, error: "no-frame-doc" };
    const base = location.origin + "/";
    doc.open();
    doc.write(
      "<!DOCTYPE html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\">"
      + "<base href=\"" + base + "\">"
      + "<link rel=\"stylesheet\" href=\"/css/print-shell.css?v=pe0\">"
      + "</head><body class=\"print-shell print-master print-official-core\">"
      + html
      + "</body></html>"
    );
    doc.close();
    await new Promise((r) => setTimeout(r, 200));
    const bodyClass = doc.body ? doc.body.className : "";
    const parentLeak = !!(doc.querySelector(".aj-shell") || doc.querySelector(".aj-topbar"));
    const hasShellLink = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).some((link) =>
      String(link.getAttribute("href") || "").indexOf("print-shell.css") >= 0
    );
    return {
      ok: true,
      bodyClass: bodyClass,
      parentLeak: parentLeak,
      hasShellLink: hasShellLink,
      textLen: String((doc.body && doc.body.innerText) || "").trim().length,
      stageLen: html.length
    };
  });
  report.printEngineProbe = engineProbe;
  const fails = [];
  if (!engineProbe || !engineProbe.ok) {
    fails.push("print-engine-probe:" + ((engineProbe && engineProbe.error) || "failed"));
    return fails;
  }
  if (engineProbe.parentLeak) fails.push("print-iframe-spa-leak");
  if (!/print-shell/.test(engineProbe.bodyClass || "")) fails.push("print-iframe-missing-shell-class");
  if (!engineProbe.hasShellLink) fails.push("print-iframe-missing-shell-css");
  if (engineProbe.textLen < 40) fails.push("print-iframe-blank");
  return fails;
}

async function openVisitPlanPrint(page, report) {
  await gotoView(page, "view-visits-plan");
  report.lastPrintContext = "visits-plan";
  const fails = [];
  const btn = page.locator("#aj-visit-plan-print");
  const visible = await btn.isVisible().catch(() => false);
  if (visible) {
    await btn.click();
    await page.waitForSelector("#aj-print-stage:not([hidden])", { timeout: 20000 });
    await page.waitForTimeout(600);
    const text = await page.locator("#aj-print-stage-page").innerText().catch(() => "");
    report.visitPrintSample = String(text || "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!/خطة الزيارات|الزيارات الصفية/.test(text)) {
      fails.push("visit-print-missing-title");
    }
    if (/رعاية الموهوبين|بطاقة برنامج/.test(text)) {
      fails.push("visit-print-shows-gifted-program");
    }
    fails.push(...(await checkPrintEmulation(page, report)));
  } else {
    report.visitPrintSample = "skipped-hidden-visit-plan-print";
  }

  fails.push(...(await probePrintEngineIframe(page, report)));

  const closeBtn = page.locator("#aj-print-preview-close");
  if (await closeBtn.count()) {
    await closeBtn.click().catch(() => {});
    await page.waitForTimeout(200);
  }
  return fails;
}

async function probePhase1ClassroomVisit(page, report) {
  const fails = [];
  report.lastPrintContext = "classroom-visit-phase1";
  // أغلق معاينة الطباعة وبوابة اللجان المؤقتة حتى يُفتح نموذج الزيارة للفحص
  await page.evaluate(() => {
    document.body.classList.remove("is-print-preview", "aj-modal-open", "aj-committee-lock");
    const stage = document.getElementById("aj-print-stage");
    if (stage) stage.hidden = true;
    const close = document.getElementById("aj-print-preview-close");
    if (close) close.click();
    const sigModal = document.getElementById("signature-modal");
    if (sigModal) sigModal.hidden = true;
    if (window.AjCommittees) {
      window.AjCommittees.gateRequired = false;
    }
  }).catch(() => {});
  await gotoView(page, "view-visits");
  await page.waitForFunction(() => {
    const view = document.getElementById("view-visits");
    const form = document.getElementById("aj-visit-form");
    const teacher = document.getElementById("aj-visit-teacher");
    return !!(
      view &&
      !view.hidden &&
      view.classList.contains("is-active") &&
      form &&
      teacher &&
      teacher.options &&
      teacher.options.length > 1
    );
  }, null, { timeout: 25000 });

  const probe = await page.evaluate(async () => {
    function wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    const out = {
      ok: false,
      error: "",
      curriculum: {},
      phrases: {},
      follow: {},
      print: {}
    };
    try {
      const teacher = document.getElementById("aj-visit-teacher");
      const visitor = document.getElementById("aj-visit-visitor");
      const subject = document.getElementById("aj-visit-subject");
      const grade = document.getElementById("aj-visit-grade");
      const type = document.getElementById("aj-visit-type");
      const date = document.getElementById("aj-visit-date");
      if (!teacher || !teacher.options || teacher.options.length < 2) {
        out.error = "no-teachers";
        return out;
      }
      // اختر معلماً تخصصه رياضيات إن وُجد
      let mathIdx = -1;
      for (let i = 0; i < teacher.options.length; i += 1) {
        if (/رياض/.test(teacher.options[i].textContent || "")) {
          mathIdx = i;
          break;
        }
      }
      teacher.selectedIndex = mathIdx > 0 ? mathIdx : 1;
      teacher.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(200);
      if (visitor && visitor.options.length > 1 && !visitor.value) {
        visitor.selectedIndex = 1;
        visitor.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (type) {
        // زيارة استطلاعية — الطبقة التخصصية يجب أن تبقى فعّالة
        let surveyIdx = -1;
        for (let i = 0; i < type.options.length; i += 1) {
          if (/استطلاع/.test(type.options[i].textContent || "")) {
            surveyIdx = i;
            break;
          }
        }
        if (surveyIdx >= 0) {
          type.selectedIndex = surveyIdx;
          type.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      if (grade && grade.options.length > 1) {
        grade.value = "الأول المتوسط";
        grade.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (subject) {
        let mathSub = -1;
        for (let i = 0; i < subject.options.length; i += 1) {
          if (/رياض/.test(subject.options[i].textContent || "")) {
            mathSub = i;
            break;
          }
        }
        if (mathSub >= 0) {
          subject.selectedIndex = mathSub;
          subject.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      if (date) {
        date.value = "2026-09-13"; // أسبوع 3 تقريباً من 2026-08-30
        date.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await wait(400);

      const week = document.getElementById("aj-visit-week");
      const unit = document.getElementById("aj-visit-unit");
      const lesson = document.getElementById("aj-visit-lesson");
      const skill = document.getElementById("aj-visit-skill");
      out.curriculum = {
        week: week ? week.value : "",
        unit: unit ? unit.value : "",
        lesson: lesson ? lesson.value : "",
        skill: skill ? skill.value : "",
        subject: subject ? subject.value : "",
        grade: grade ? grade.value : "",
        type: type ? type.value : ""
      };

      // تخطيط=none + استراتيجيات=met + بنود ناقصة → مجموع < 60 لمتابعة 14–21 يوماً
      const rows = Array.from(document.querySelectorAll("[data-visit-row]"));
      rows.forEach((row) => {
        const id = row.getAttribute("data-visit-row");
        const level = row.querySelector("[data-visit-level]");
        if (!level) return;
        if (id === "planning" || id === "warmup" || id === "assessment") level.value = "none";
        else if (id === "strategies") level.value = "met";
        else level.value = "partial";
        level.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await wait(400);

      const strengths = document.getElementById("aj-visit-strengths");
      const notes = document.getElementById("aj-visit-notes");
      const plan = document.getElementById("aj-visit-plan");
      const followG = document.getElementById("aj-visit-follow-g");
      const band = document.getElementById("aj-visit-band");
      out.phrases = {
        strengths: strengths ? strengths.value : "",
        feedback: notes ? notes.value : "",
        improvement: plan ? plan.value : "",
        band: band ? band.textContent : "",
        hasGoalContradiction: strengths ? /وافق الهدف|ناسب الهدف/.test(strengths.value) : false,
        hasContentStrategy: strengths ? /محتوى/.test(strengths.value) : false,
        improvementNumbers: plan
          ? (plan.value.match(/^\d+\./gm) || []).map((x) => x.replace(".", ""))
          : [],
        specialtyHint: (() => {
          const choice = document.querySelector("[data-visit-row='strategies'] [data-visit-choice]");
          const blob = choice ? choice.innerText || "" : "";
          return /{{lesson}}|حل|معادلة|قوى|جبر|مسألة/.test(blob + (lesson ? lesson.value : ""));
        })()
      };
      out.follow = {
        value: followG ? followG.value : "",
        band: band ? band.textContent : ""
      };

      const printBtn = document.getElementById("aj-visit-print");
      if (printBtn) {
        printBtn.click();
        await wait(700);
      }
      const stage = document.getElementById("aj-print-stage-page");
      const text = stage ? String(stage.innerText || "") : "";
      out.print = {
        len: text.length,
        hasTitle: /تقرير زيارة صفية/.test(text),
        hasTeacherSig: /المعلم المُزار/.test(text),
        hasVisitorSig: /الزائر المقيّم/.test(text),
        hasManagerSig: /مدير المدرسة/.test(text),
        sample: text.replace(/\s+/g, " ").trim().slice(0, 220)
      };
      out.ok = true;
    } catch (error) {
      out.error = String(error && error.message ? error.message : error);
    }
    return out;
  });

  report.phase1 = probe;
  if (!probe || !probe.ok) {
    fails.push("phase1-probe:" + ((probe && probe.error) || "failed"));
    return fails;
  }
  if (!probe.curriculum.week) fails.push("phase1-week-empty");
  if (!probe.curriculum.unit) fails.push("phase1-unit-empty");
  if (!probe.curriculum.lesson) fails.push("phase1-lesson-empty");
  if (!probe.curriculum.skill) fails.push("phase1-skill-empty");
  if (probe.phrases.hasGoalContradiction) fails.push("phase1-strength-goal-contradiction");
  if (!Array.isArray(probe.phrases.improvementNumbers) || probe.phrases.improvementNumbers.length < 2) {
    fails.push("phase1-improvement-numbering");
  }
  if (probe.follow.value) {
    const visit = new Date("2026-09-13T12:00:00");
    const follow = new Date(probe.follow.value + "T12:00:00");
    const days = Math.round((follow - visit) / 86400000);
    if (days < 14 || days > 21) fails.push("phase1-followup-days=" + days);
  } else if (/بحاجة/.test(String(probe.follow.band || ""))) {
    fails.push("phase1-followup-empty");
  }
  if (!probe.print.hasTitle) fails.push("phase1-print-missing-title");
  if (!probe.print.hasTeacherSig || !probe.print.hasVisitorSig || !probe.print.hasManagerSig) {
    fails.push("phase1-print-missing-signatures");
  }

  const closeBtn = page.locator("#aj-print-preview-close");
  if (await closeBtn.count()) {
    await closeBtn.click().catch(() => {});
    await page.waitForTimeout(150);
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

  let phase1Fails = [];
  if (size.width >= 1200) {
    try {
      phase1Fails = await probePhase1ClassroomVisit(page, report);
    } catch (error) {
      phase1Fails = ["phase1-exception:" + (error && error.message ? error.message : error)];
    }
  }

  const shot = path.join(OUT_DIR, "viewport-" + size.width + ".png");
  await page.screenshot({ path: shot, fullPage: false });

  await context.close();
  return {
    viewport: label,
    viewFails,
    printFails: printFails.concat(phase1Fails),
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
    printGuard: null,
    printEngineProbe: null,
    lastPrintContext: "",
    visitPrintSample: "",
    phase1: null,
    results: [],
    ok: false
  };

  const staticGuard = auditPrintGuardStatic();
  report.printGuard = { static: staticGuard, runtime: null };

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
    // حارس وقت التشغيل مرة واحدة على سطح مكتب بعد انتهاء الجولات
    const guardContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: "ar-SA"
    });
    await injectSession(guardContext, report.session);
    const guardPage = await guardContext.newPage();
    await guardPage.goto(BASE + "/app-journey.html#view-desk", { waitUntil: "domcontentloaded" });
    await guardPage.waitForFunction(() => document.body.classList.contains("aj-auth-ready"), null, {
      timeout: 20000
    });
    const runtimeGuard = await auditPrintGuardRuntime(guardPage);
    report.printGuard.runtime = runtimeGuard;
    await guardContext.close();
  } finally {
    await browser.close();
  }

  const allViewFails = report.results.flatMap((r) => r.viewFails);
  const allPrintFails = report.results.flatMap((r) => r.printFails);
  const allConsole = report.results.flatMap((r) => r.consoleErrors);
  const allNet = report.results.flatMap((r) => r.netFailures);
  const guardFails = []
    .concat((report.printGuard.static && report.printGuard.static.fails) || [])
    .concat((report.printGuard.runtime && report.printGuard.runtime.fails) || []);
  report.ok =
    allViewFails.length === 0 &&
    allPrintFails.length === 0 &&
    allConsole.length === 0 &&
    allNet.length === 0 &&
    guardFails.length === 0;

  const outFile = path.join(OUT_DIR, "smoke-report.json");
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");

  const summary = {
    ok: report.ok,
    seed: SEED,
    viewFails: allViewFails.length,
    printFails: allPrintFails,
    printGuardFails: guardFails,
    printGuardNotes: (report.printGuard.static && report.printGuard.static.notes) || [],
    printEngineRuntime: report.printGuard.runtime && report.printGuard.runtime.meta,
    consoleErrors: allConsole.slice(0, 20),
    netFailures: allNet.slice(0, 20),
    visitPrintSample: report.visitPrintSample,
    phase1: report.phase1,
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
