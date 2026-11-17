/* خطتي · صفحة الإنتاج داخل الصدفة · قرار 166 · اعتماد التركيب */
(function () {
  "use strict";

  var PAGE_SIZE = 10;
  var PRINTING = false;
  var CORE_ROLES = [
    "principal",
    "vice_teachers",
    "vice_students",
    "vice_admin",
    "student_counselor",
    "health_counselor",
    "teacher",
    "activity_leader",
    "librarian",
    "lab_tech",
    "admin_assistant"
  ];
  var ROLE_ALIASES = {
    principal: ["مدير المدرسة", "مدير"],
    vice_teachers: ["وكيل الشؤون التعليمية", "وكيل شؤون المعلمين", "وكيل المعلمين"],
    vice_students: ["وكيل شؤون الطلاب", "وكيل الطلاب"],
    vice_admin: ["وكيل الشؤون المدرسية", "وكيل الشؤون الإدارية"],
    student_counselor: ["الموجه الطلابي", "موجه طلابي"],
    health_counselor: ["الموجه الصحي", "موجه صحي"],
    teacher: ["المعلم", "معلم"],
    activity_leader: ["رائد النشاط الطلابي", "رائد النشاط"],
    librarian: ["أمين مصادر التعلم", "أمين المصادر"],
    lab_tech: ["محضر المختبر", "محضر معامل"],
    admin_assistant: ["المساعد الإداري", "مساعد إداري"]
  };

  var state = {
    roleId: "principal",
    pack: null,
    goalFilter: "all",
    page: 1,
    showSeasonal: false,
    metrics: null,
    goalMap: null
  };

  var METRICS_URL = "/api/performance-metrics";
  var METRICS_FALLBACK = "../_shared/performance_metrics.json";
  var GOAL_MAP_URL = "../_shared/program_goal_indicator_map.json";

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveRoleToken(token) {
    var v = String(token == null ? "" : token).trim();
    if (!v) return "";
    if (CORE_ROLES.indexOf(v) !== -1) return v;
    var keys = Object.keys(ROLE_ALIASES);
    for (var i = 0; i < keys.length; i++) {
      var id = keys[i];
      var aliases = ROLE_ALIASES[id];
      if (aliases.indexOf(v) !== -1) return id;
      for (var j = 0; j < aliases.length; j++) {
        if (v.indexOf(aliases[j]) !== -1) return id;
      }
    }
    return "";
  }

  function readSessionRole() {
    var params = new URLSearchParams(window.location.search || "");
    var fromQuery = resolveRoleToken(params.get("role") || "");
    if (fromQuery) return fromQuery;
    try {
      var raw = sessionStorage.getItem("sessionUser");
      if (!raw) return "principal";
      var s = JSON.parse(raw);
      var candidates = [s.owner_role, s.role_id, s.roleKey, s.role];
      for (var i = 0; i < candidates.length; i++) {
        var hit = resolveRoleToken(candidates[i]);
        if (hit) return hit;
      }
    } catch (e) {}
    return "principal";
  }

  function bindShellMenus() {
    var ops = document.querySelector(".erp-ops");
    if (!ops) return;
    ops.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".erp-trigger");
      if (!btn || btn.tagName === "A") return;
      var item = btn.closest(".erp-item");
      if (!item || item.classList.contains("is-current")) return;
      var panel = item.querySelector(".erp-panel");
      var open = btn.getAttribute("aria-expanded") === "true";
      ops.querySelectorAll(".erp-item").forEach(function (it) {
        var b = it.querySelector(".erp-trigger");
        var p = it.querySelector(".erp-panel");
        if (b && b.tagName !== "A") b.setAttribute("aria-expanded", "false");
        if (p) p.hidden = true;
      });
      if (!open && panel) {
        btn.setAttribute("aria-expanded", "true");
        panel.hidden = false;
      }
    });
    document.addEventListener("click", function (ev) {
      if (ev.target.closest(".erp-ops")) return;
      ops.querySelectorAll(".erp-panel").forEach(function (p) {
        p.hidden = true;
      });
      ops.querySelectorAll("button.erp-trigger").forEach(function (b) {
        b.setAttribute("aria-expanded", "false");
      });
    });
  }

  function softJson(url) {
    return fetch(url, { cache: "no-store" }).then(
      function (r) {
        return r.ok ? r.json() : null;
      },
      function () {
        return null;
      }
    );
  }

  function resolveMetric(key) {
    var m = state.metrics;
    if (!m || !key) return null;
    var parts = String(key).split(".");
    if (parts[0] === "nafes" && parts[1] && m.nafes && m.nafes[parts[1]]) {
      return m.nafes[parts[1]];
    }
    if (parts[0] === "external" && parts[1] && m.external_evaluation && m.external_evaluation[parts[1]]) {
      return m.external_evaluation[parts[1]];
    }
    if (parts[0] === "indicators" && parts[1] && m.indicators && m.indicators[parts[1]]) {
      var ind = m.indicators[parts[1]];
      return {
        score: ind.score != null ? ind.score : ind.score_max,
        unit: "%",
        label: parts[1] + (ind.level_current ? " · " + ind.level_current : ""),
        target: null,
        score_note: ind.score_note || ""
      };
    }
    return null;
  }

  function formatMetricValue(row) {
    if (!row) return "—";
    if (row.score_note && row.score == null) return row.score_note;
    if (row.score == null) return "—";
    return String(row.score) + (row.unit || "");
  }

  function renderMetrics() {
    var host = $("pi-metrics");
    if (!host) return;
    var m = state.metrics;
    if (!m) {
      host.innerHTML = '<p class="pi-empty">مركز الأداء غير متاح.</p>';
      return;
    }
    var cells = [];
    var ext = m.external_evaluation || {};
    ["overall", "administration", "teaching", "outcomes", "environment"].forEach(function (k) {
      if (!ext[k]) return;
      cells.push({
        n: formatMetricValue(ext[k]),
        l: ext[k].label || k,
        t: ""
      });
    });
    var naf = m.nafes || {};
    ["math", "reading", "science"].forEach(function (k) {
      if (!naf[k]) return;
      cells.push({
        n: formatMetricValue(naf[k]),
        l: naf[k].label || k,
        t: naf[k].target != null ? "المستهدف " + naf[k].target + (naf[k].unit || "") : ""
      });
    });
    if (!cells.length) {
      host.innerHTML = "";
      return;
    }
    function cellHtml(c, extra) {
      return (
        '<div class="pi-metric' +
        (extra ? " " + extra : "") +
        '"><span class="n">' +
        esc(c.n) +
        '</span><span class="l">' +
        esc(c.l) +
        "</span>" +
        (c.t ? '<span class="t">' + esc(c.t) + "</span>" : "") +
        "</div>"
      );
    }
    var primary = cellHtml(cells[0], "pi-metric--primary");
    var rest = cells.slice(1);
    host.innerHTML =
      primary +
      (rest.length
        ? '<details class="pi-metrics-more">' +
          '<summary>بقية المؤشرات <span class="pi-metrics-more__count">' +
          rest.length +
          "</span></summary>" +
          '<div class="pi-metrics pi-metrics__rest">' +
          rest.map(function (c) {
            return cellHtml(c);
          }).join("") +
          "</div></details>"
        : "");
  }

  function mapRec(programId) {
    var list = (state.goalMap && state.goalMap.programs) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].program_id === programId) return list[i];
    }
    return null;
  }

  function enrichProgram(p) {
    var out = {
      id: p.id,
      name: p.name || p.label,
      seasonal: !!p.seasonal,
      duplicate_of: p.duplicate_of,
      goal_ref: p.goal_ref || "",
      target_audience: p.target_audience || "",
      duration: p.duration || "",
      owner_role: p.owner_role || "",
      success_indicator: p.success_indicator || "",
      status: p.status || "معتمد",
      executive_goal: "",
      indicator_codes: p.indicator_codes || []
    };
    var rec = mapRec(p.id);
    if (rec && rec.executive_fields) {
      var ef = rec.executive_fields;
      if (ef.executive_goal && ef.executive_goal !== "فارغ معتمد") {
        out.executive_goal = ef.executive_goal;
      }
      if (ef.duration && ef.duration !== "فارغ معتمد") out.duration = ef.duration;
      if (ef.implementers && ef.implementers !== "فارغ معتمد") {
        out.owner_display = ef.implementers;
      }
      if (ef.success_indicator && ef.success_indicator !== "فارغ معتمد") {
        out.success_indicator = ef.success_indicator;
      }
    }
    if (rec && rec.decision && rec.decision.final_indicator_codes) {
      out.indicator_codes = rec.decision.final_indicator_codes;
    }
    var bind =
      state.metrics &&
      state.metrics.program_bindings &&
      state.metrics.program_bindings[p.id];
    if (bind && bind.improvement_goal_key && state.metrics.improvement_goals) {
      var ig = state.metrics.improvement_goals[bind.improvement_goal_key];
      if (ig) {
        if (!out.executive_goal && ig.text) out.executive_goal = ig.text;
        if (ig.duration) out.duration = ig.duration;
        if (ig.implementers) out.owner_display = ig.implementers;
        if (ig.success_binding && ig.success_binding.length) {
          out.success_indicator = ig.success_binding
            .map(function (key) {
              var row = resolveMetric(key);
              if (!row) return "";
              var cur = formatMetricValue(row);
              var tgt =
                row.target != null ? " ← " + row.target + (row.unit || "") : "";
              return (row.label || key) + ": " + cur + tgt;
            })
            .filter(Boolean)
            .join(" · ");
        }
      }
    }
    return out;
  }

  function renderStats(pack) {
    var host = $("pi-stats");
    if (!host) return;
    var programs = pack.programs || [];
    var visible = programs.filter(function (p) {
      return state.showSeasonal ? true : !p.seasonal;
    });
    var tasks = pack.tasks || [];
    var cells = [
      { n: visible.length, l: "برامج معتمدة" },
      { n: tasks.length, l: "بنود تنفيذ" },
      { n: visible.filter(function (p) { return !!p.seasonal; }).length, l: "موسمي ظاهر" },
      { n: (pack.indicators || []).length, l: "مؤشرات الدور" }
    ];
    host.innerHTML = cells
      .map(function (c) {
        return (
          '<div class="pi-stat"><span class="n">' +
          esc(c.n) +
          '</span><span class="l">' +
          esc(c.l) +
          "</span></div>"
        );
      })
      .join("");
  }

  function renderPrograms(pack) {
    var host = $("pi-programs");
    if (!host) return;
    var rows = (pack.programs || []).filter(function (p) {
      return state.showSeasonal ? true : !p.seasonal;
    });
    /* لا تُعرض الموسومة مكرر كنسخ تشغيلية للمستخدم */
    rows = rows.filter(function (p) {
      return !p.duplicate_of;
    });
    if (!rows.length) {
      host.innerHTML =
        '<p class="pi-empty">لا برامج ظاهرة لهذا الدور' +
        (pack.pack_note ? " · " + esc(pack.pack_note) : "") +
        "</p>";
      return;
    }
    var body = rows
      .map(function (raw, i) {
        var p = enrichProgram(raw);
        var goalCell = p.executive_goal
          ? esc(p.goal_ref || "—") +
            '<div class="pi-field-label" style="margin:4px 0 0;font-size:11px">' +
            esc(p.executive_goal) +
            "</div>"
          : esc(p.goal_ref || "—");
        var codes =
          p.indicator_codes && p.indicator_codes.length
            ? '<div class="pi-field-label" style="margin:4px 0 0;font-size:11px">' +
              esc(p.indicator_codes.join(" · ")) +
              "</div>"
            : "";
        return (
          "<tr><td>" +
          (i + 1) +
          "</td><td>" +
          esc(p.name) +
          (raw.seasonal ? ' <span class="pi-badge seasonal">موسمي</span>' : "") +
          codes +
          "</td><td>" +
          goalCell +
          '</td><td class="col-hide-md">' +
          esc(p.target_audience || "—") +
          '</td><td class="col-hide-md">' +
          esc(p.duration || "—") +
          "</td><td>" +
          esc(p.owner_display || pack.role_label || p.owner_role || "—") +
          "</td><td>" +
          esc(p.success_indicator || "—") +
          "</td><td>" +
          esc(p.status || "معتمد") +
          "</td></tr>"
        );
      })
      .join("");
    host.innerHTML =
      '<div class="pi-fit-wrap"><table class="pi-plan-table">' +
      "<colgroup>" +
      '<col class="c-n"><col class="c-name"><col class="c-goal"><col class="c-aud">' +
      '<col class="c-dur"><col class="c-own"><col class="c-kpi"><col class="c-st">' +
      "</colgroup>" +
      "<thead><tr>" +
      "<th>م</th><th>البرنامج / المبادرة</th><th>الهدف</th>" +
      '<th class="col-hide-md">المستهدفون</th><th class="col-hide-md">الفترة</th>' +
      "<th>المنفّذ</th><th>مؤشر النجاح</th><th>الحالة</th>" +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table></div>";
  }

  function renderKnowledge() {
    /* مرشّحو المعرفة للأرشيف/المراجعة فقط — لا تُعرض للمستخدم ولا تُطبع */
    var host = $("pi-knowledge");
    if (host) {
      host.hidden = true;
      host.innerHTML = "";
    }
  }

  function filteredTasks(pack) {
    var rows = pack.tasks || [];
    if (state.goalFilter === "all") return rows;
    return rows.filter(function (t) {
      return String(t.goal_id || "unmapped") === state.goalFilter;
    });
  }

  function renderTasks(pack) {
    var host = $("pi-tasks");
    if (!host) return;
    var rows = filteredTasks(pack);
    var summary = pack.task_goal_summary || {};
    var goals = {};
    (pack.tasks || []).forEach(function (t) {
      goals[String(t.goal_id || "unmapped")] = true;
    });
    var goalOpts = Object.keys(goals)
      .sort()
      .map(function (g) {
        return (
          '<option value="' +
          esc(g) +
          '"' +
          (state.goalFilter === g ? " selected" : "") +
          ">" +
          esc(g) +
          "</option>"
        );
      })
      .join("");

    var filterBar =
      '<div class="pi-toolbar">' +
      '<span class="pi-field-label" style="margin:0">مربوط: ' +
      esc(summary.mapped || 0) +
      " · غير مربوط: " +
      esc(summary.unmapped || 0) +
      "</span>" +
      '<label class="pi-field-label" style="margin:0">تصفية الهدف ' +
      '<select class="pi-goal-filter" id="pi-goal-filter">' +
      '<option value="all"' +
      (state.goalFilter === "all" ? " selected" : "") +
      ">الكل</option>" +
      goalOpts +
      "</select></label></div>";

    if (!rows.length) {
      host.innerHTML =
        filterBar +
        '<p class="pi-empty">لا بنود مطابقة للتصفية (أو بنك فارغ موثّق).</p>';
      return;
    }

    var pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    var slice = PRINTING
      ? rows
      : rows.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    var table =
      '<table class="pi-table"><thead><tr><th>الرمز</th><th>البند</th><th>الهدف</th></tr></thead><tbody>' +
      slice
        .map(function (t) {
          return (
            "<tr><td>" +
            esc(t.task_code) +
            "</td><td>" +
            esc(t.title) +
            "</td><td>" +
            esc(t.goal_id || "unmapped") +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";

    var pager = PRINTING
      ? ""
      : '<div class="pi-pager no-print">' +
        '<button type="button" id="pi-prev"' +
        (state.page <= 1 ? " disabled" : "") +
        ">السابق</button>" +
        "<span>صفحة " +
        state.page +
        " / " +
        pages +
        " · عرض " +
        slice.length +
        " من " +
        rows.length +
        "</span>" +
        '<button type="button" id="pi-next"' +
        (state.page >= pages ? " disabled" : "") +
        ">التالي</button></div>";

    host.innerHTML =
      (PRINTING ? "" : filterBar) +
      '<div class="pi-fit-wrap">' +
      table +
      "</div>" +
      pager;

    var sel = $("pi-goal-filter");
    if (sel) {
      sel.addEventListener("change", function () {
        state.goalFilter = sel.value;
        state.page = 1;
        renderTasks(pack);
      });
    }
    var prev = $("pi-prev");
    var next = $("pi-next");
    if (prev)
      prev.addEventListener("click", function () {
        if (state.page > 1) {
          state.page -= 1;
          renderTasks(pack);
        }
      });
    if (next)
      next.addEventListener("click", function () {
        state.page += 1;
        renderTasks(pack);
      });
  }

  function renderCover(pack) {
    var el = $("pi-cover");
    if (!el) return;
    el.textContent =
      (pack.role_label || pack.role_id) +
      " · من الجلسة/الرابط · موسمي " +
      (state.showSeasonal ? "ظاهر" : "مخفي");
    var pm = $("pi-print-meta");
    if (pm) {
      pm.textContent =
        " · " +
        (pack.role_label || "") +
        " · " +
        new Date().toLocaleDateString("ar-SA");
    }
  }

  function renderAll(pack) {
    state.pack = pack;
    renderCover(pack);
    renderStats(pack);
    renderMetrics();
    renderPrograms(pack);
    renderKnowledge();
    renderTasks(pack);
    var st = $("pi-status");
    if (st) st.textContent = "جاهز · " + (pack.role_label || pack.role_id);
    var name = $("command-user-name");
    var role = $("command-user-role");
    try {
      var raw = sessionStorage.getItem("sessionUser");
      var s = raw ? JSON.parse(raw) : null;
      if (name) name.textContent = (s && s.name) || "مستخدم النظام";
      if (role) role.textContent = (s && s.role) || pack.role_label || "";
    } catch (e) {
      if (role) role.textContent = pack.role_label || "";
    }
  }

  function persistRole(roleId) {
    try {
      var raw = sessionStorage.getItem("sessionUser");
      var s = raw ? JSON.parse(raw) : {};
      s.owner_role = roleId;
      sessionStorage.setItem("sessionUser", JSON.stringify(s));
    } catch (e) {}
    var url = new URL(window.location.href);
    url.searchParams.set("role", roleId);
    window.history.replaceState({}, "", url.toString());
  }

  function loadHub() {
    var metricsPromise =
      window.PerformanceBind && PerformanceBind.load
        ? PerformanceBind.invalidate() || PerformanceBind.load()
        : softJson(METRICS_URL).then(function (data) {
            return data || softJson(METRICS_FALLBACK);
          });
    return Promise.all([metricsPromise, softJson(GOAL_MAP_URL)]).then(
      function (pair) {
        state.metrics = pair[0];
        state.goalMap = pair[1];
        return pair;
      }
    );
  }

  function loadRole(roleId) {
    state.roleId = roleId;
    state.page = 1;
    state.goalFilter = "all";
    var st = $("pi-status");
    if (st) st.textContent = "جاري التحميل…";
    return loadHub()
      .then(function () {
        return RolePlanPack.loadPack(roleId, {
          rolesUrl: "roles.json",
          programsUrl: "../_shared/programs.json",
          indicatorsUrl: "../_shared/indicators.json",
          linksUrl: "task_goal_links.json",
          knowledgeUrl: "../_shared/programs_knowledge.json"
        });
      })
      .then(renderAll, function (err) {
        if (st) st.textContent = "فشل التحميل";
        console.error(err);
      });
  }

  function fillRoles(selected) {
    return RolePlanPack.listRoles({ rolesUrl: "roles.json" }).then(function (roles) {
      var sel = $("pi-role-select");
      if (!sel) return;
      sel.innerHTML = roles
        .map(function (r) {
          return (
            '<option value="' +
            esc(r.id) +
            '"' +
            (r.id === selected ? " selected" : "") +
            ">" +
            esc(r.label_ar || r.id) +
            "</option>"
          );
        })
        .join("");
      sel.addEventListener("change", function () {
        persistRole(sel.value);
        loadRole(sel.value);
      });
    });
  }

  function bindSchoolFromSettings() {
    return fetch("/api/settings", { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        var name =
          data && data.school && data.school.name
            ? String(data.school.name).trim()
            : "";
        if (!name) return;
        document.querySelectorAll(".school-name").forEach(function (node) {
          node.textContent = name;
        });
      })
      .catch(function () {});
  }

  function boot() {
    bindShellMenus();
    bindSchoolFromSettings();
    var seasonal = $("pi-seasonal");
    if (seasonal) {
      seasonal.addEventListener("change", function () {
        state.showSeasonal = !!seasonal.checked;
        if (state.pack) renderAll(state.pack);
      });
    }
    var reload = $("pi-reload");
    if (reload)
      reload.addEventListener("click", function () {
        loadRole(state.roleId);
      });
    var printBtn = $("pi-print");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        if (!state.pack) return;
        PRINTING = true;
        renderTasks(state.pack);
        window.setTimeout(function () {
          window.print();
          PRINTING = false;
          renderTasks(state.pack);
        }, 50);
      });
    }

    var q = new URLSearchParams(location.search);
    if (q.get("seasonal") === "1") {
      state.showSeasonal = true;
      if (seasonal) seasonal.checked = true;
    }
    state.roleId = readSessionRole();
    fillRoles(state.roleId).then(function () {
      return loadRole(state.roleId);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
