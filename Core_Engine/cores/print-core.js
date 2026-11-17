/* print-core — عقل الطباعة (غلاف).
 * لا يولّد إطاراً جديداً. يستدعي PrintTemplates + OfficialFrameCore المعتمدين.
 * الترتيب قائم في النواة: ترويسة ← عنوان ← محتوى ← صور ← توقيعات.
 * البطاقة: renderPortraitOfficial. الكشف: renderMasterList (مسلسل + thead متكرر).
 */
(function (root) {
  "use strict";

  function sessionHeaders(options) {
    if (options && options.headers) {
      return options.headers;
    }
    var headers = { "Content-Type": "application/json" };
    try {
      var user = JSON.parse(sessionStorage.getItem("sessionUser") || "null");
      if (user && user.token) {
        headers["X-Session-Token"] = user.token;
      }
    } catch (error) {
      return headers;
    }
    return headers;
  }

  function columnsFromSeats(rows) {
    return (rows || []).map(function (row) {
      return {
        role: (row && row.role) || "",
        roleTitle: (row && (row.roleTitle || row.role)) || "",
        name: (row && row.name) || "",
        signature: (row && row.signature) || ""
      };
    });
  }

  function applyIndicatorCleanup(payload) {
    if (!payload || !payload.pairedMeta || !payload.pairedMeta.length) {
      return payload;
    }
    var clean = root.PrintTemplates && root.PrintTemplates.cleanIndicatorText;
    if (typeof clean !== "function") {
      return payload;
    }
    var fallback = "";
    payload.pairedMeta.forEach(function (row) {
      if (row && row.label === "نص المؤشر") {
        fallback = row.value || "";
      }
    });
    var record = payload.record || {};
    fallback = fallback || record.executive_goal || record.success_indicator || "";
    payload.pairedMeta = payload.pairedMeta.map(function (row) {
      if (!row || (row.label !== "المؤشر" && row.label !== "المؤشرات")) {
        return row;
      }
      return { label: row.label, value: clean(row.value, fallback) };
    });
    return payload;
  }

  function firstIndicatorCode(record) {
    record = record || {};
    var bank = record.bank_indicator_codes;
    if (Array.isArray(bank) && bank.length && String(bank[0] || "").trim()) {
      return String(bank[0]).trim();
    }
    var raw = record.indicator_codes;
    if (Array.isArray(raw) && raw.length && String(raw[0] || "").trim()) {
      return String(raw[0]).trim();
    }
    if (typeof raw === "string" && raw.trim()) {
      return raw.split(/[،,]/)[0].trim();
    }
    return "";
  }

  function applyNarrative(options, payload) {
    var narrative = root.NarrativeCore;
    if (!narrative || typeof narrative.generateText !== "function") {
      return payload;
    }
    var record = (options.data && options.data.record) || payload.record || {};
    if (typeof narrative.fromBank === "function") {
      var packed = narrative.fromBank(firstIndicatorCode(record));
      if (packed && packed.item) {
        if (!String(record.executive_goal || payload.executive_goal || "").trim() && packed.item.title) {
          payload.executive_goal = packed.item.title;
        }
        if (!String(record.mechanism || payload.mechanism || "").trim() && packed.procedures) {
          payload.mechanism = packed.procedures;
        }
        if (!String(record.success_indicator || payload.success_indicator || "").trim() && packed.evidence) {
          payload.success_indicator = packed.evidence;
        }
      }
    }
    var strategic = String(record.strategic_goal || payload.strategic_goal || "").trim();
    if (strategic) {
      return payload;
    }
    var text = String(narrative.generateText(payload.narrativeKey || "program.objective", {
      program_name: record.program_name || payload.program_name || "",
      domain: record.domain || payload.domain || ""
    }) || "").trim();
    if (!text) {
      return payload;
    }
    payload.strategic_goal = text;
    return payload;
  }

  function resolveDocType(options) {
    options = options || {};
    if (options.docType) {
      return String(options.docType);
    }
    var type = String(options.type || options.kind || "");
    if (type === "students-list" || type === "students") {
      return "students-list";
    }
    if (type === "staff-list" || type === "staff") {
      return "staff-list";
    }
    if (type === "program-card" || type === "card") {
      return "program-card";
    }
    var title = String(options.title || (options.data && options.data.title) || "");
    if (title.indexOf("طلاب") >= 0) {
      return "students-list";
    }
    if (title.indexOf("منسوب") >= 0) {
      return "staff-list";
    }
    return type;
  }

  function runCheck(options, html) {
    var warnings = [];
    var core = root.DeficiencyCore;
    if (core && typeof core.check === "function") {
      try {
        warnings = core.check(resolveDocType(options), options.data || {}) || [];
      } catch (error) {
        warnings = [];
      }
    }
    if (warnings.length) {
      return { html: html || "", warnings: warnings };
    }
    return html || "";
  }

  function allowAfterWarning(warnings) {
    if (!warnings || !warnings.length) {
      return true;
    }
    return window.confirm(
      "تنبيه: هذه الوثيقة تحتوي على نواقص " + warnings.join("، ") + ". هل تريد الطباعة على أي حال؟"
    );
  }

  function htmlOf(result) {
    if (result && typeof result === "object" && !Array.isArray(result)) {
      return result.html || "";
    }
    return typeof result === "string" ? result : "";
  }

  function warningsOf(result) {
    if (result && typeof result === "object" && Array.isArray(result.warnings)) {
      return result.warnings;
    }
    return [];
  }

  function paint(options, columns) {
    var tpl = root.PrintTemplates;
    if (!tpl) {
      return "";
    }
    var type = options.type || options.kind || "card";
    var data = options.data || {};
    var title = options.title || data.title || "";
    var orientation = options.orientation || "portrait";
    if (type === "table" || type === "list" || type === "students-list" || type === "staff-list") {
      if (typeof tpl.renderMasterList !== "function") {
        return "";
      }
      return tpl.renderMasterList({
        title: title,
        columns: data.columns || [],
        rows: data.rows || [],
        serial: data.serial !== false,
        school: data.school,
        admin: data.admin,
        signoff: data.signoff !== false,
        signoffColumns: columns,
        kind: data.kind || "",
        grade: data.grade || "",
        section: data.section || "",
        specialty: data.specialty || "",
        programName: data.programName || ""
      });
    }
    var payload = applyIndicatorCleanup(applyNarrative(options, Object.assign({}, data, {
      title: title,
      signoff: true,
      signoffColumns: columns
    })));
    if (orientation === "landscape" && typeof tpl.renderLandscapeOfficial === "function") {
      return tpl.renderLandscapeOfficial(payload);
    }
    if (typeof tpl.renderPortraitOfficial === "function") {
      return tpl.renderPortraitOfficial(payload);
    }
    return "";
  }

  function resolveColumns(options) {
    var data = options.data || {};
    var ready = options.signoffColumns || data.signoffColumns;
    if (Array.isArray(ready) && ready.length) {
      return ready;
    }
    var seats = options.seats || data.seats || [];
    var sig = root.SignatureCore;
    if (sig && typeof sig.resolve === "function" && seats.length) {
      return sig.resolve(seats, { headers: sessionHeaders(options) }).then(columnsFromSeats).catch(function () {
        return columnsFromSeats(seats);
      });
    }
    return columnsFromSeats(seats);
  }

  var PrintCore = {
    SOVEREIGN_CARD: "program-card",
    SOVEREIGN_LIST: "master-list",

    /**
     * @param {{title?:string, type?:'card'|'table', data?:object, seats?:Array, orientation?:'portrait'|'landscape', headers?:object}} options
     * @returns {string|Promise<string>}
     */
    generate: function (options) {
      options = options || {};
      var columns = resolveColumns(options);
      if (columns && typeof columns.then === "function") {
        return columns.then(function (resolved) {
          return runCheck(options, paint(options, resolved));
        });
      }
      return runCheck(options, paint(options, columns));
    },

    htmlOf: htmlOf,
    warningsOf: warningsOf,
    allowAfterWarning: allowAfterWarning,

    render: function (spec) {
      spec = spec || {};
      return PrintCore.generate({
        title: spec.title,
        type: spec.kind === "list" ? "table" : (spec.kind || spec.type || "card"),
        data: spec.record || spec,
        seats: spec.seats,
        orientation: spec.orientation,
        signoffColumns: spec.signoffColumns
      });
    },

    injectPhotos: function (html, images, bandTitle) {
      if (root.AJPrint && typeof root.AJPrint.injectPhotoBand === "function") {
        return root.AJPrint.injectPhotoBand(html, images, bandTitle);
      }
      return html || "";
    },

    arm: function (opts) {
      if (root.OfficialFrameCore && typeof root.OfficialFrameCore.armPrintPage === "function") {
        return root.OfficialFrameCore.armPrintPage(opts || {});
      }
      return null;
    }
  };

  root.PrintCore = PrintCore;
}(typeof window !== "undefined" ? window : this));
