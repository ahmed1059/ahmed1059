/* print-master-core — قرار 281، والتسمية الذكية قرار 287، وإعدادات المليمتر قرار 296.
 * ورقة واحدة متدفقة: رأس يتكرر، تذييل يتكرر، اعتماد في آخر المحتوى فقط.
 * الهامش من options.contentMargin ويُكتب في @page بالمليمتر.
 * لا يغيّر قواعد .official-document-frame / .doc-official-header / .doc-signoff-block.
 * التكرار عبر thead/tfoot لأن position:running غير ثابت في Chrome.
 * اسم ملف PDF من document.title قبل window.print، بلا مكتبة خارجية.
 */
(function (root) {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function printDateLine() {
    var now = new Date();
    var hijri = "";
    var gregorian = "";
    try {
      hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(now);
    } catch (error) {
      hijri = "";
    }
    try {
      gregorian = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(now);
    } catch (error) {
      gregorian = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();
    }
    if (hijri && gregorian) {
      return "تاريخ الطباعة: " + hijri + "هـ — " + gregorian + "م";
    }
    return "تاريخ الطباعة: " + (hijri || gregorian);
  }

  function pad(value) {
    var text = String(value);
    return text.length < 2 ? "0" + text : text;
  }

  function hijriYear(now) {
    try {
      var text = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura-nu-latn", {
        year: "numeric"
      }).format(now);
      var match = String(text || "").match(/\d{4}/);
      return match ? match[0] : "";
    } catch (error) {
      return "";
    }
  }

  function fileStamp() {
    var now = new Date();
    var year = hijriYear(now);
    var gregorian = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
    return year ? (year + "_" + gregorian) : gregorian;
  }

  function safePart(value) {
    return String(value || "").trim()
      .replace(/\.pdf$/i, "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
      .replace(/[\s—–]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  function inferKind(opts) {
    var title = String(opts.title || "");
    var frame = String(opts.frameClass || "");
    if (opts.kind) {
      return String(opts.kind);
    }
    if (opts.programName || frame.indexOf("program-card") >= 0 || title.indexOf("بطاقة") >= 0) {
      return "program";
    }
    if (title.indexOf("طلاب") >= 0) {
      return "students";
    }
    if (title.indexOf("منسوب") >= 0) {
      return "staff";
    }
    if (title.indexOf("قرار") >= 0 && (title.indexOf("تشكيل") >= 0 || title.indexOf("لجنة") >= 0)) {
      return "committee_decree";
    }
    if (title.indexOf("لجان") >= 0) {
      return "committees";
    }
    return "document";
  }

  /** اسم الملف بلا الامتداد. Chrome يضيف .pdf عند «حفظ كـ PDF». */
  function fileName(opts) {
    opts = opts || {};
    var date = fileStamp();
    var kind = inferKind(opts);
    var parts = [];
    if (kind === "students") {
      parts = ["كشف_الطلاب", safePart(opts.grade), safePart(opts.section), date];
    } else if (kind === "staff") {
      parts = ["كشف_المنسوبين", safePart(opts.specialty), date];
    } else if (kind === "program") {
      var program = safePart(opts.programName);
      if (!program) {
        program = safePart(String(opts.title || "").replace(/^بطاقة\s*برنامج\s*/, ""));
      }
      parts = ["بطاقة_برنامج", program, date];
    } else if (kind === "committee_decree") {
      parts = ["قرار_تشكيل", safePart(opts.committeeName || opts.title), "1448"];
    } else if (kind === "committees") {
      parts = ["تشكيل_اللجان", date];
    } else {
      parts = [safePart(opts.title) || "وثيقة", date];
    }
    return parts.filter(Boolean).join("_");
  }

  function applyTitle(name) {
    var next = safePart(name).replace(/_+/g, "_");
    if (!next) {
      return document.title;
    }
    document.title = next;
    return next;
  }

  var options = {
    headerHeight: 40,
    footerHeight: 20,
    contentMargin: 15,
    showSignoff: true
  };

  function mm(value, fallback) {
    var number = Number(value);
    if (!isFinite(number) || number < 0) {
      number = fallback;
    }
    return (Math.round(number * 100) / 100) + "mm";
  }

  function resolveOptions(opts) {
    opts = opts || {};
    return {
      headerHeight: mm(opts.headerHeight != null ? opts.headerHeight : options.headerHeight, 40),
      footerHeight: mm(opts.footerHeight != null ? opts.footerHeight : options.footerHeight, 20),
      contentMargin: mm(opts.contentMargin != null ? opts.contentMargin : options.contentMargin, 15),
      showSignoff: typeof opts.showSignoff === "boolean" ? opts.showSignoff : options.showSignoff !== false
    };
  }

  function wantsSignoff(opts, settings) {
    if (opts && typeof opts.signoff === "boolean") {
      return opts.signoff;
    }
    return settings.showSignoff;
  }

  /**
   * @param {{orientation?:string, title?:string, bodyHtml?:string, signoff?:boolean, columns?:Array, school?:string, admin?:string, frameClass?:string, strictIdentity?:boolean, kind?:string, grade?:string, section?:string, specialty?:string, programName?:string, headerHeight?:number, footerHeight?:number, contentMargin?:number, showSignoff?:boolean}} opts
   */
  function sheet(opts) {
    opts = opts || {};
    var settings = resolveOptions(opts);
    var core = root.OfficialFrameCore;
    if (!core || typeof core.header !== "function") {
      return "<p>نواة الإطار الرسمي غير محمّلة.</p>";
    }
    var landscape = opts.orientation === "landscape";
    var headerHtml = core.header({
      strictIdentity: opts.strictIdentity !== false,
      school: opts.school,
      admin: opts.admin,
      ministryLogo: opts.ministryLogo,
      visionLogo: opts.visionLogo
    });
    var title = opts.title
      ? "<h1 class=\"doc-official-title pm-title\">" + escapeHtml(opts.title) + "</h1>"
      : "";
    var sign = "";
    if (wantsSignoff(opts, settings) && typeof core.signoff === "function") {
      sign = "<div class=\"pm-signoff\">" + core.signoff({
        school: opts.school,
        admin: opts.admin,
        columns: opts.columns,
        maxColumns: opts.maxColumns || opts.cols || undefined,
        pageLabel: opts.pageLabel || "اعتماد الصفحة الأخيرة",
        omitBottomBar: !!opts.omitSignoffBottom || !!opts.unifiedFooter
      }) + "</div>";
    }
    var headStyle = "height:auto;min-height:0;max-height:none;overflow:visible";
    var footStyle = "height:" + settings.footerHeight + ";min-height:" + settings.footerHeight;
    var gapStyle = "height:" + settings.footerHeight + ";min-height:" + settings.footerHeight;
    var frameClass = opts.frameClass ? (" " + String(opts.frameClass)) : "";
    var storedName = opts.fileName ? safePart(opts.fileName) : fileName(opts);
    var schoolLabel = opts.school || root.bookletSchoolName || "متوسطة سعد بن الربيع الأنصاري";
    var footInner;
    if (opts.unifiedFooter) {
      footInner = "<span class=\"pm-foot-school\">وثيقة رسمية — " + escapeHtml(schoolLabel) + "</span>"
        + "<span class=\"pm-foot-date\">" + escapeHtml(printDateLine()) + "</span>"
        + "<span class=\"pm-foot-page\">" + escapeHtml(opts.pageFootLabel || "الصفحة 1 من 1") + "</span>";
    } else {
      footInner = "<span class=\"pm-foot-date\">" + escapeHtml(printDateLine()) + "</span>"
        + "<span class=\"pm-foot-page\">الصفحة <span class=\"pm-page-num\"></span> من <span class=\"pm-pages-num\"></span></span>";
    }
    return "<article class=\"pm-document" + (landscape ? " pm-landscape" : "") + frameClass + "\" data-file-name=\"" + escapeHtml(storedName) + "\">"
      + "<table class=\"pm-sheet\">"
      + "<thead><tr><td><div class=\"pm-head\" style=\"" + headStyle + "\">" + headerHtml + "</div></td></tr></thead>"
      + "<tfoot><tr><td><div class=\"pm-foot-slot\" style=\"" + footStyle + "\" aria-hidden=\"true\"></div></td></tr></tfoot>"
      + "<tbody><tr><td>"
      + "<div class=\"pm-stack\">"
      + "<div class=\"pm-body\">" + title + (opts.bodyHtml || "") + "</div>"
      + "<div class=\"pm-end\">"
      + sign
      + "<div class=\"pm-clearance\" style=\"" + gapStyle + "\" aria-hidden=\"true\"></div>"
      + "</div>"
      + "</div>"
      + "</td></tr></tbody>"
      + "</table>"
      + "<div class=\"pm-foot" + (opts.unifiedFooter ? " pm-foot-unified" : "") + "\" style=\"" + footStyle + "\">"
      + footInner
      + "</div></article>";
  }

  function applyMetrics(settings) {
    var target = document.documentElement;
    target.style.setProperty("--pm-header-height", settings.headerHeight);
    target.style.setProperty("--pm-footer-height", settings.footerHeight);
    target.style.setProperty("--pm-content-margin", settings.contentMargin);
  }

  function arm(opts) {
    opts = opts || {};
    var settings = resolveOptions(opts);
    var landscape = opts.orientation === "landscape";
    var list = !!opts.list;
    var multi = list || !!opts.multiPage;
    var size = landscape ? "A4 landscape" : "A4 portrait";
    var named = landscape ? "print-master-a4-landscape" : "print-master-a4";
    var margin = multi ? settings.contentMargin : "0";
    var style = document.getElementById("official-core-page-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "official-core-page-style";
      document.head.appendChild(style);
    }
    applyMetrics(settings);
    style.textContent = [
      "@page{size:" + size + " !important;margin:" + margin + " !important;}",
      "@page " + named + "{size:" + size + ";margin:" + margin + ";}",
      "html,body{margin:0!important;padding:0!important;}"
    ].join("");
    document.body.classList.add("print-official-core", "print-master");
    document.body.classList.toggle("print-official-multi", multi);
    document.body.classList.toggle("print-official-list", list);
    document.body.classList.toggle("print-master-landscape", landscape);
    document.body.classList.toggle("print-official-landscape", landscape);
    return style;
  }

  function stressSheet() {
    var sentence = "هذه فقرة اختبار لتدفق النص داخل نواة الطباعة، وتُعاد حتى تعبر أكثر من صفحة، وليست بياناً مدرسياً محفوظاً. ";
    var paragraph = "";
    var index;
    for (index = 0; index < 24; index += 1) {
      paragraph += sentence;
    }
    var rows = "";
    for (index = 1; index <= 50; index += 1) {
      rows += "<tr><td>" + index + "</td><td>بند اختبار " + index + "</td></tr>";
    }
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='220' viewBox='0 0 1600 220'>"
      + "<rect width='1600' height='220' fill='#e7f2ef'/>"
      + "<rect x='24' y='34' width='1552' height='152' fill='none' stroke='#0b5e56' stroke-width='10'/>"
      + "</svg>";
    var body = "<p class=\"pm-stress-copy\">" + escapeHtml(paragraph) + "</p>"
      + "<table class=\"pm-stress-table\"><thead><tr><th>م</th><th>البند</th></tr></thead><tbody>"
      + rows
      + "</tbody></table>"
      + "<figure class=\"pm-stress-figure\"><img alt=\"\" src=\"data:image/svg+xml;charset=utf-8,"
      + encodeURIComponent(svg)
      + "\"></figure>";
    return sheet({
      title: "اختبار إجهاد نواة الطباعة",
      kind: "document",
      frameClass: "pm-stress",
      strictIdentity: true,
      bodyHtml: body,
      showSignoff: options.showSignoff
    });
  }

  function openStress() {
    var html = stressSheet();
    arm({ multiPage: true });
    if (root.AJPrint && typeof root.AJPrint.show === "function") {
      root.AJPrint.show(html, {
        pdfTitle: "اختبار_نواة_الطباعة",
        arm: { multiPage: true }
      });
      return true;
    }
    return false;
  }

  function bootStress() {
    var button = document.getElementById("aj-print-stress");
    if (button && button.getAttribute("data-bound") !== "1") {
      button.setAttribute("data-bound", "1");
      button.addEventListener("click", openStress);
    }
    if (String(root.location.hash || "") === "#print-stress") {
      openStress();
    }
  }

  root.addEventListener("hashchange", function () {
    if (String(root.location.hash || "") === "#print-stress") {
      openStress();
    }
  });
  if (document.readyState === "complete") {
    bootStress();
  } else {
    root.addEventListener("load", bootStress);
  }

  root.PrintMasterCore = {
    version: "296",
    options: options,
    sheet: sheet,
    render: sheet,
    arm: arm,
    fileName: fileName,
    applyTitle: applyTitle,
    stressSheet: stressSheet,
    openStress: openStress
  };
}(typeof window !== "undefined" ? window : this));
