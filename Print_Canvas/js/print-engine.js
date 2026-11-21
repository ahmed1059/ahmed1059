/* PrintEngine — مرحلة صفر (قرار 301)
 * بوابة طباعة وحيدة: PrintEngine.open(templateType, payload)
 * التنفيذ عبر Sandboxed Hidden Iframe + print-shell.css فقط.
 * التركيب يبقى PrintMasterCore / OfficialFrameCore.
 */
(function (root) {
  "use strict";

  var VERSION = "301-phase0";
  var FRAME_ID = "pe-print-frame";
  var SHELL_HREF = "/css/print-shell.css?v=pe2";
  var lastPayload = null;
  var lastHtml = "";
  var lastArm = {};
  var lastTitle = "";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function ensureFrame() {
    var iframe = document.getElementById(FRAME_ID);
    if (iframe) {
      return iframe;
    }
    iframe = document.createElement("iframe");
    iframe.id = FRAME_ID;
    iframe.title = "طباعة معزولة";
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("sandbox", "allow-modals allow-same-origin allow-scripts");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(iframe);
    return iframe;
  }

  function resolveBaseHref() {
    try {
      return String(root.location.origin || "") + "/";
    } catch (error) {
      return "/";
    }
  }

  function resolveShellHref() {
    try {
      return new URL(SHELL_HREF, resolveBaseHref()).href;
    } catch (error) {
      return SHELL_HREF;
    }
  }

  function pageStyle(arm) {
    arm = arm || {};
    var landscape = arm.orientation === "landscape";
    var multi = !!(arm.multiPage || arm.list);
    var margin = multi ? "15mm" : "0";
    var size = landscape ? "A4 landscape" : "A4 portrait";
    var named = landscape ? "print-master-a4-landscape" : "print-master-a4";
    return [
      "@page{size:" + size + " !important;margin:" + margin + " !important;}",
      "@page " + named + "{size:" + size + ";margin:" + margin + ";}",
      "html,body{margin:0!important;padding:0!important;}",
      ":root{--pm-header-height:40mm;--pm-footer-height:20mm;--pm-content-margin:15mm;}"
    ].join("");
  }

  function bodyClass(arm) {
    arm = arm || {};
    var classes = ["print-shell", "print-master", "print-official-core"];
    if (arm.orientation === "landscape") {
      classes.push("print-master-landscape", "print-official-landscape");
    }
    if (arm.multiPage || arm.list) {
      classes.push("print-official-multi");
    }
    if (arm.list) {
      classes.push("print-official-list");
    }
    return classes.join(" ");
  }

  function waitAssets(doc, done) {
    var settled = false;
    function finish() {
      if (settled) {
        return;
      }
      settled = true;
      done();
    }
    var pending = 1;
    function tick() {
      pending -= 1;
      if (pending <= 0) {
        finish();
      }
    }
    Array.prototype.forEach.call(doc.images || [], function (img) {
      if (!img || !img.getAttribute("src") || (img.complete && img.naturalHeight !== 0)) {
        return;
      }
      pending += 1;
      img.addEventListener("load", tick);
      img.addEventListener("error", tick);
    });
    var links = doc.querySelectorAll('link[rel="stylesheet"]');
    Array.prototype.forEach.call(links, function (link) {
      pending += 1;
      link.addEventListener("load", tick);
      link.addEventListener("error", tick);
    });
    tick();
    root.setTimeout(finish, 4000);
  }

  function writeFrame(html, opts) {
    opts = opts || {};
    var iframe = ensureFrame();
    var win = iframe.contentWindow;
    var doc = iframe.contentDocument || (win && win.document);
    if (!doc) {
      throw new Error("تعذر تجهيز إطار الطباعة المعزول.");
    }
    var title = String(opts.pdfTitle || lastTitle || document.title || "وثيقة").trim();
    var arm = opts.arm || lastArm || {};
    lastHtml = String(html || "");
    lastArm = arm;
    lastTitle = title;
    doc.open();
    doc.write(
      "<!DOCTYPE html><html lang=\"ar\" dir=\"rtl\"><head>"
      + "<meta charset=\"utf-8\">"
      + "<base href=\"" + escapeHtml(resolveBaseHref()) + "\">"
      + "<title>" + escapeHtml(title) + "</title>"
      + "<link rel=\"stylesheet\" href=\"" + escapeHtml(resolveShellHref()) + "\">"
      + "<style id=\"pe-page-style\">" + pageStyle(arm) + "</style>"
      + "</head><body class=\"" + escapeHtml(bodyClass(arm)) + "\">"
      + lastHtml
      + "</body></html>"
    );
    doc.close();
    return iframe;
  }

  function printHtml(html, opts) {
    opts = opts || {};
    var iframe = writeFrame(html, opts);
    var win = iframe.contentWindow;
    var doc = iframe.contentDocument || (win && win.document);
    return new Promise(function (resolve) {
      waitAssets(doc, function () {
        try {
          if (win) {
            win.focus();
            win.print();
          }
        } catch (error) {
          resolve({ ok: false, error: String(error && error.message ? error.message : error) });
          return;
        }
        resolve({ ok: true, via: "sandbox-iframe", version: VERSION });
      });
    });
  }

  function stageHtml() {
    var page = document.getElementById("aj-print-stage-page");
    return page ? String(page.innerHTML || "") : "";
  }

  function printFromStage(opts) {
    opts = opts || {};
    var html = stageHtml();
    if (!html) {
      return Promise.resolve({ ok: false, error: "لا محتوى في لوحة المعاينة." });
    }
    if (!opts.arm && root.AJPrint && root.AJPrint._lastArm) {
      opts.arm = root.AJPrint._lastArm;
    }
    if (!opts.pdfTitle && root.AJPrint && root.AJPrint._lastTitle) {
      opts.pdfTitle = root.AJPrint._lastTitle;
    }
    return printHtml(html, opts);
  }

  function preview(html, opts) {
    opts = opts || {};
    lastHtml = String(html || "");
    lastArm = opts.arm || {};
    lastTitle = opts.pdfTitle || "";
    if (root.AJPrint && typeof root.AJPrint.show === "function") {
      root.AJPrint._lastArm = lastArm;
      root.AJPrint._lastTitle = lastTitle;
      root.AJPrint.show(html, opts);
      return { ok: true, preview: true };
    }
    return { ok: false, error: "لوحة المعاينة غير جاهزة." };
  }

  function openMasterSheet(payload) {
    payload = payload || {};
    var master = root.PrintMasterCore;
    if (!master || typeof master.sheet !== "function") {
      return { ok: false, error: "PrintMasterCore غير محمّل." };
    }
    var sheetOpts = Object.assign({}, payload, {
      title: payload.docTitle || payload.title || "",
      bodyHtml: payload.bodyHtml || "",
      orientation: payload.orientation || "portrait",
      kind: payload.kind || "document",
      fileName: payload.fileName || payload.docTitle || payload.title || "",
      signoff: payload.signoff !== false,
      columns: payload.signatures || payload.columns || [],
      strictIdentity: payload.strictIdentity !== false
    });
    if (Array.isArray(payload.metaGrid) && payload.metaGrid.length && !payload.bodyHtml) {
      var cells = payload.metaGrid.filter(function (pair) {
        return pair && String(pair[1] || "").trim();
      }).map(function (pair) {
        return "<td style=\"width:50%;padding:0.6mm 1.2mm;border:1px solid #9db8b2;font-size:11px;vertical-align:top;\">"
          + "<strong>" + escapeHtml(pair[0]) + ":</strong> " + escapeHtml(pair[1]) + "</td>";
      });
      var rows = [];
      var i;
      for (i = 0; i < cells.length; i += 2) {
        rows.push("<tr>" + cells[i] + (cells[i + 1] || "<td style=\"width:50%;border:1px solid #9db8b2;\"></td>") + "</tr>");
      }
      sheetOpts.bodyHtml = "<table style=\"width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 2mm;\">"
        + rows.join("") + "</table>" + (payload.sectionsHtml || "");
    } else if (payload.sectionsHtml) {
      sheetOpts.bodyHtml = (sheetOpts.bodyHtml || "") + payload.sectionsHtml;
    }
    var html = master.sheet(sheetOpts);
    var arm = {
      orientation: sheetOpts.orientation === "landscape" ? "landscape" : "portrait",
      multiPage: !!payload.multiPage,
      list: !!payload.list
    };
    lastPayload = { templateType: "master-sheet", payload: payload };
    var shown = preview(html, {
      pdfTitle: payload.docTitle || payload.title || "",
      arm: arm,
      file: Object.assign({
        kind: sheetOpts.kind,
        committeeName: payload.committeeName || "",
        title: sheetOpts.title,
        fileName: sheetOpts.fileName
      }, payload.file || {})
    });
    if (payload.autoPrint) {
      return printHtml(html, { pdfTitle: payload.docTitle || payload.title || "", arm: arm });
    }
    return shown;
  }

  function openRawHtml(payload) {
    payload = payload || {};
    var html = payload.html || payload.bodyHtml || "";
    if (!html) {
      return { ok: false, error: "لا HTML للطباعة." };
    }
    lastPayload = { templateType: "raw-html", payload: payload };
    var arm = payload.arm || {
      orientation: payload.orientation === "landscape" ? "landscape" : "portrait",
      multiPage: !!payload.multiPage,
      list: !!payload.list
    };
    var shown = preview(html, {
      pdfTitle: payload.docTitle || payload.pdfTitle || payload.title || "",
      arm: arm,
      files: payload.files || []
    });
    if (payload.autoPrint) {
      return printHtml(html, { pdfTitle: payload.docTitle || payload.pdfTitle || "", arm: arm });
    }
    return shown;
  }

  /**
   * @param {string} templateType raw-html | master-sheet
   * @param {object} payload
   */
  function open(templateType, payload) {
    var type = String(templateType || "raw-html").trim();
    payload = payload || {};
    lastPayload = { templateType: type, payload: payload };
    if (type === "master-sheet" || type === "sheet") {
      return openMasterSheet(payload);
    }
    if (type === "raw-html" || type === "html") {
      return openRawHtml(payload);
    }
    return { ok: false, error: "قالب غير مدعوم في مرحلة صفر: " + type };
  }

  function bindHotkey() {
    if (document.documentElement.getAttribute("data-pe-hotkey") === "1") {
      return;
    }
    document.documentElement.setAttribute("data-pe-hotkey", "1");
    document.addEventListener("keydown", function (event) {
      var key = String(event.key || "").toLowerCase();
      if (!(event.ctrlKey || event.metaKey) || key !== "p") {
        return;
      }
      if (!document.body.classList.contains("is-print-preview")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      printFromStage();
    }, true);
  }

  function patchAjPrint() {
    if (!root.AJPrint || root.AJPrint._printEngineBound === VERSION) {
      return;
    }
    var previousPrint = typeof root.AJPrint.print === "function" ? root.AJPrint.print.bind(root.AJPrint) : null;
    root.AJPrint.print = function () {
      return printFromStage().then(function (result) {
        if (result && result.ok) {
          return result;
        }
        if (previousPrint) {
          previousPrint();
        }
        return result;
      });
    };
    root.AJPrint._printEngineBound = VERSION;
  }

  function boot() {
    bindHotkey();
    patchAjPrint();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  root.addEventListener("load", patchAjPrint);

  root.PrintEngine = {
    version: VERSION,
    open: open,
    printHtml: printHtml,
    printFromStage: printFromStage,
    preview: preview,
    shellHref: SHELL_HREF,
    frameId: FRAME_ID,
    last: function () {
      return lastPayload;
    }
  };
}(typeof window !== "undefined" ? window : this));
