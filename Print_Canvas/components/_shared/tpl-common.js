/**
 * TplCommon — طبقة مشتركة لموجة المكوّنات (خ-مك / قرار 138)
 * OfficialFrameCore · قوائم مشتركة · تقويم هـ/م · عنوان ديناميكي
 */
(function (root) {
  "use strict";

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) {
        throw new Error("فشل جلب " + url + " (" + res.status + ")");
      }
      return res.json();
    });
  }

  function ensurePreviewSession() {
    try {
      var raw = sessionStorage.getItem("sessionUser");
      var ok = false;
      if (raw) {
        var s = JSON.parse(raw);
        ok = !!(s && s.token && s.id);
      }
      if (!ok) {
        sessionStorage.setItem(
          "sessionUser",
          JSON.stringify({
            token: "tpl-preview",
            id: "tpl-preview",
            name: "معاينة مكوّن"
          })
        );
      }
    } catch (e) {
      /* تجاهل */
    }
  }

  function clearSelect(selectEl) {
    while (selectEl && selectEl.firstChild) {
      selectEl.removeChild(selectEl.firstChild);
    }
  }

  function addOption(selectEl, value, label, selected) {
    var opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    if (selected) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  }

  function populatePersons(scope, persons) {
    scope.querySelectorAll("select[data-tpl-persons]").forEach(function (sel) {
      var previous = sel.value;
      clearSelect(sel);
      addOption(sel, "", "— اختر —", !previous);
      persons.forEach(function (p) {
        var label = p.name + (p.role ? " — " + p.role : "");
        var value = p.person_id || p.name;
        addOption(sel, value, label, previous && previous === value);
      });
    });
  }

  function populateIndicators(scope, inds, defaults) {
    defaults = defaults || [];
    scope.querySelectorAll("select[data-tpl-indicators]").forEach(function (sel) {
      var multi = !!sel.multiple;
      clearSelect(sel);
      if (!multi) {
        addOption(sel, "", "— اختر مؤشراً —", true);
      }
      inds.forEach(function (ind) {
        var code = ind.code || "";
        var label = code + (ind.label_ar ? " — " + ind.label_ar : "");
        var selected = defaults.indexOf(code) !== -1;
        addOption(sel, code, label, multi ? selected : false);
      });
    });
  }

  function populateCommittees(scope, committees) {
    scope.querySelectorAll("select[data-tpl-committees]").forEach(function (sel) {
      var previous = sel.value;
      clearSelect(sel);
      addOption(sel, "", "— اختر لجنة / فريقاً —", !previous);
      (committees || []).forEach(function (c) {
        var vacant =
          String(c.has_rapporteur_named || "") === "no" ||
          c.rapporteur_vacant === true
            ? " · مقرّر شاغر"
            : "";
        var label =
          (c.body_name || c.name || "") +
          (c.kind ? " [" + c.kind + "]" : "") +
          vacant;
        var value = c.body_id || c.id || c.body_name || "";
        addOption(sel, value, label, previous && previous === value);
      });
    });
  }

  function populateDropdowns(opts) {
    opts = opts || {};
    var scope = opts.root || document;
    var jobs = [
      fetchJson(opts.identityUrl || "identity.json"),
      fetchJson(opts.indicatorsUrl || "indicators.json")
    ];
    if (opts.committeesUrl) {
      jobs.push(fetchJson(opts.committeesUrl));
    }
    return Promise.all(jobs).then(function (pair) {
      var persons = (pair[0] && pair[0].persons) || [];
      var inds = (pair[1] && pair[1].indicators) || [];
      var committees =
        pair[2] && pair[2].committees ? pair[2].committees : [];
      populatePersons(scope, persons);
      populateIndicators(scope, inds, opts.defaultIndicators || []);
      if (opts.committeesUrl) {
        populateCommittees(scope, committees);
      }
      return {
        persons: persons.length,
        indicators: inds.length,
        committees: committees.length
      };
    });
  }

  function normalizeProgramList(rawList, source) {
    var seen = {};
    var out = [];
    (rawList || []).forEach(function (p, index) {
      var name = p.program_name || p.name || p.label || "";
      if (!name || seen[name]) {
        return;
      }
      seen[name] = true;
      var kind = p.kind || "برنامج";
      if (!p.kind) {
        if (/مسابقة|أولمبياد|جائزة|منافسة/.test(name)) {
          kind = "مسابقة";
        } else if (/مبادرة|ارتقاء/.test(name)) {
          kind = "مبادرة";
        }
      }
      out.push({
        id: String(p.id || p.key || p.template_key || index),
        name: name,
        kind: kind,
        target_audience: p.target_audience || "",
        domain: p.domain || "",
        source: source
      });
    });
    return out;
  }

  function loadPrograms(programsUrl) {
    var localUrl = programsUrl || "programs.json";
    return fetch("/api/programs", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) {
          throw new Error("api");
        }
        return res.json();
      })
      .then(function (payload) {
        var live = normalizeProgramList(payload.programs || [], "api");
        if (live.length) {
          return live;
        }
        return normalizeProgramList(payload.templates || [], "api-templates");
      })
      .catch(function () {
        return fetchJson(localUrl).then(function (payload) {
          return normalizeProgramList(payload.programs || [], "programs.json");
        });
      });
  }

  function populatePrograms(selectEl, programs) {
    if (!selectEl) {
      return;
    }
    clearSelect(selectEl);
    addOption(selectEl, "", "— اختر برنامجاً / مسابقة / مبادرة —", true);
    (programs || []).forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = (p.kind ? "[" + p.kind + "] " : "") + p.name;
      opt.dataset.kind = p.kind || "برنامج";
      opt.dataset.name = p.name || "";
      opt.dataset.audience = p.target_audience || "";
      selectEl.appendChild(opt);
    });
  }

  function setDynamicTitle(title, host) {
    var el = (host || document).querySelector(".doc-official-title");
    if (el) {
      el.textContent = title;
    }
    return title;
  }

  function bindSystemCalendars(host) {
    var bind =
      typeof root.bindDualDatePickers === "function"
        ? root.bindDualDatePickers
        : typeof bindDualDatePickers === "function"
          ? bindDualDatePickers
          : null;
    if (bind) {
      bind(host || document);
      return true;
    }
    return false;
  }

  function dualDateHtml(label) {
    return (
      '<div class="tpl-field full">' +
      "<label>" +
      label +
      "</label>" +
      '<div class="dual-date-pair tpl-dual-date">' +
      '<input class="doc-hijri tpl-input" type="text" inputmode="numeric" autocomplete="off" placeholder="هـ — مثال: 17 ربيع الأول 1448هـ" aria-label="تاريخ هجري">' +
      '<input class="doc-date-picker tpl-input" type="text" inputmode="numeric" autocomplete="off" placeholder="م — مثال: 30 أغسطس 2026م" aria-label="تاريخ ميلادي">' +
      "</div></div>"
    );
  }

  function fieldSelect(id, label, attrs) {
    return (
      '<div class="tpl-field">' +
      '<label for="' +
      id +
      '">' +
      label +
      "</label>" +
      '<select id="' +
      id +
      '" class="tpl-input" ' +
      (attrs || "") +
      "></select></div>"
    );
  }

  function fieldText(id, label, full) {
    return (
      '<div class="tpl-field' +
      (full ? " full" : "") +
      '">' +
      '<label for="' +
      id +
      '">' +
      label +
      "</label>" +
      '<input id="' +
      id +
      '" class="tpl-input" type="text" autocomplete="off"></div>'
    );
  }

  function fieldTextarea(id, label) {
    return (
      '<div class="tpl-field full">' +
      '<label for="' +
      id +
      '">' +
      label +
      "</label>" +
      '<textarea id="' +
      id +
      '" class="tpl-input" rows="3"></textarea></div>'
    );
  }

  function mountOfficial(opts) {
    opts = opts || {};
    var core = root.OfficialFrameCore;
    if (!core) {
      return Promise.reject(new Error("OfficialFrameCore غير محمّل"));
    }
    var html = core.page({
      strictIdentity: true,
      title: opts.title || "",
      frameClass: opts.frameClass || "tpl-portrait-official",
      bodyHtml: opts.bodyHtml || "",
      signoff: opts.signoff !== false,
      page: 1,
      total: 1,
      columns: opts.columns || [
        {
          roleTitle: "إعداد",
          name: "",
          signature: "",
          signatureFallback: "signatures/sig_teachers.png"
        },
        {
          roleTitle: "اعتماد أول",
          name: "",
          signature: "",
          signatureFallback: "signatures/sig_students.png"
        },
        {
          roleTitle: "اعتماد المدير",
          name: "",
          signature: "",
          signatureFallback: "signatures/sig_manager.png"
        }
      ]
    });
    var host = core.ensureHost();
    host.innerHTML = html;
    host.hidden = false;
    document.body.classList.add("is-print-preview", "print-official-core");
    return host;
  }

  function printOfficial(armOpts) {
    var core = root.OfficialFrameCore;
    document.body.classList.add("print-mode", "print-official-core");
    if (core && typeof core.armPrintPage === "function") {
      core.armPrintPage(armOpts || {});
    }
    root.print();
  }

  var SHELL_CSS =
    "body.tpl-sample{margin:0;background:#e8ece9;font-family:Tajawal,sans-serif}" +
    ".tpl-toolbar{position:sticky;top:0;z-index:20;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 14px;background:#0b5e56;color:#fff}" +
    ".tpl-toolbar button{font:inherit;cursor:pointer;border:0;border-radius:6px;padding:8px 14px;background:#fff;color:#0b5e56;font-weight:700}" +
    "#official-frame-host{display:flex;justify-content:center;padding:16px}" +
    ".tpl-field-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin:8px 0 14px}" +
    ".tpl-field{border:1px solid #c5d0cb;border-radius:4px;padding:8px 10px;background:#fff}" +
    ".tpl-field label{display:block;font-size:13px;color:#5c675f;margin-bottom:4px}" +
    ".tpl-field.full{grid-column:1/-1}" +
    ".tpl-input{width:100%;box-sizing:border-box;font:inherit;font-size:15px;border:0;border-bottom:1px dashed #9aab9f;background:transparent;color:#1a1a1a;padding:4px 0}" +
    "select.tpl-input,textarea.tpl-input{border:1px solid #c5d0cb;border-radius:4px;padding:4px 6px;background:#fff}" +
    ".dual-date-pair.tpl-dual-date{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start}" +
    ".tpl-act-table{width:100%;border-collapse:collapse;font-size:14px}" +
    ".tpl-act-table th,.tpl-act-table td{border:1px solid #b7c4bc;padding:6px 8px;text-align:right}" +
    ".tpl-act-table th{background:#eef3f0;color:#0b5e56}" +
    ".tpl-empty{color:#8a968e;font-style:italic;font-size:12px}" +
    ".tpl-section-title{font-size:16px;color:#0b5e56;margin:12px 0 6px}" +
    "@media print{.tpl-toolbar{display:none!important}body.tpl-sample{background:#fff}#official-frame-host{padding:0}.date-picker-open,.hijri-picker-open{display:none!important}}";

  root.TplCommon = {
    fetchJson: fetchJson,
    ensurePreviewSession: ensurePreviewSession,
    populateDropdowns: populateDropdowns,
    loadPrograms: loadPrograms,
    populatePrograms: populatePrograms,
    setDynamicTitle: setDynamicTitle,
    bindSystemCalendars: bindSystemCalendars,
    dualDateHtml: dualDateHtml,
    fieldSelect: fieldSelect,
    fieldText: fieldText,
    fieldTextarea: fieldTextarea,
    mountOfficial: mountOfficial,
    printOfficial: printOfficial,
    SHELL_CSS: SHELL_CSS
  };
})(window);
