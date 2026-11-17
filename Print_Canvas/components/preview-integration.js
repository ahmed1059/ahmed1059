/* معاينة تكامل خطتي · قرار 165 · حية · بطاقات برامج + جدول بنود مرقّم */
(function () {
  "use strict";

  var PAGE_SIZE = 10;
  var state = {
    roleId: "teacher",
    pack: null,
    goalFilter: "all",
    page: 1,
    showSeasonal: false
  };

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

  function bindShellMenus() {
    var ops = document.querySelector(".erp-ops");
    if (!ops) return;
    ops.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".erp-trigger");
      if (!btn) return;
      var item = btn.closest(".erp-item");
      if (!item || item.classList.contains("is-current")) return;
      var panel = item.querySelector(".erp-panel");
      var open = btn.getAttribute("aria-expanded") === "true";
      ops.querySelectorAll(".erp-item").forEach(function (it) {
        var b = it.querySelector(".erp-trigger");
        var p = it.querySelector(".erp-panel");
        if (b) b.setAttribute("aria-expanded", "false");
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
      ops.querySelectorAll(".erp-trigger").forEach(function (b) {
        b.setAttribute("aria-expanded", "false");
      });
    });
  }

  function renderStats(pack) {
    var host = $("pi-stats");
    if (!host) return;
    var programs = pack.programs || [];
    var visible = programs.filter(function (p) {
      return state.showSeasonal ? true : !p.seasonal;
    });
    var tasks = pack.tasks || [];
    var cands = pack.knowledge_candidates || [];
    var dups = visible.filter(function (p) {
      return !!p.duplicate_of;
    }).length;
    var cells = [
      { n: visible.length, l: "برامج معتمدة" },
      { n: tasks.length, l: "بنود تنفيذ" },
      { n: cands.length, l: "مرشّحو معرفة" },
      { n: dups, l: "موسوم مكرر" }
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
    if (!rows.length) {
      host.innerHTML =
        '<p class="pi-empty">لا برامج ظاهرة لهذا الدور' +
        (pack.pack_note ? " · " + esc(pack.pack_note) : "") +
        "</p>";
      return;
    }
    host.innerHTML =
      '<div class="pi-cards">' +
      rows
        .map(function (p) {
          var badges = "";
          if (p.seasonal) badges += '<span class="pi-badge seasonal">موسمي</span>';
          if (p.duplicate_of)
            badges +=
              '<span class="pi-badge dup" title="' +
              esc(p.duplicate_reason || "") +
              '">مكرر ← ' +
              esc(p.duplicate_of) +
              "</span>";
          return (
            '<article class="pi-card' +
            (p.duplicate_of ? " is-dup" : "") +
            '"><h3>' +
            esc(p.label || p.name) +
            badges +
            '</h3><div class="meta">هدف ' +
            esc(p.goal_ref || "—") +
            (p.batch ? " · دفعة " + esc(p.batch) : "") +
            "</div></article>"
          );
        })
        .join("") +
      "</div>";
  }

  function renderKnowledge(pack) {
    var host = $("pi-knowledge");
    if (!host) return;
    var rows = pack.knowledge_candidates || [];
    if (!rows.length) {
      host.innerHTML = '<p class="pi-empty">لا مرشحين معرفة لهذا الدور.</p>';
      return;
    }
    host.innerHTML =
      '<div class="pi-cards">' +
      rows
        .slice(0, 12)
        .map(function (k) {
          var badges = '<span class="pi-badge cand">مرشّح</span>';
          if (k.duplicate_of)
            badges +=
              '<span class="pi-badge dup">مكرر ← ' + esc(k.duplicate_of) + "</span>";
          return (
            '<article class="pi-card"><h3>#' +
            esc(k.archive_ref) +
            " · " +
            esc(k.title) +
            badges +
            '</h3><div class="meta">' +
            esc(k.status) +
            " · " +
            esc(k.goal_ref || "—") +
            "</div></article>"
          );
        })
        .join("") +
      "</div>" +
      (rows.length > 12
        ? '<p class="pi-field-label">عرض 12 من ' + rows.length + " مرشّحاً في المعاينة.</p>"
        : "");
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
      var g = String(t.goal_id || "unmapped");
      goals[g] = true;
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
      "<span class=\"pi-field-label\" style=\"margin:0\">مربوط: " +
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
    var start = (state.page - 1) * PAGE_SIZE;
    var slice = rows.slice(start, start + PAGE_SIZE);

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

    var pager =
      '<div class="pi-pager">' +
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
      " (حجم الصفحة " +
      PAGE_SIZE +
      ")</span>" +
      '<button type="button" id="pi-next"' +
      (state.page >= pages ? " disabled" : "") +
      ">التالي</button></div>";

    host.innerHTML = filterBar + table + pager;

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
      " · برامج من النواة فقط لهذا الدور · موسمي " +
      (state.showSeasonal ? "ظاهر" : "مخفي") +
      " · معاينة تكامل (قرار 165)";
  }

  function renderAll(pack) {
    state.pack = pack;
    renderCover(pack);
    renderStats(pack);
    renderPrograms(pack);
    renderKnowledge(pack);
    renderTasks(pack);
    var st = $("pi-status");
    if (st) st.textContent = "جاهز · " + (pack.role_label || pack.role_id);
  }

  function loadRole(roleId) {
    state.roleId = roleId;
    state.page = 1;
    state.goalFilter = "all";
    var st = $("pi-status");
    if (st) st.textContent = "جاري التحميل…";
    return RolePlanPack.loadPack(roleId, {
      rolesUrl: "my-plan/roles.json",
      programsUrl: "_shared/programs.json",
      indicatorsUrl: "_shared/indicators.json",
      linksUrl: "my-plan/task_goal_links.json",
      knowledgeUrl: "_shared/programs_knowledge.json"
    }).then(renderAll, function (err) {
      if (st) st.textContent = "فشل التحميل";
      console.error(err);
    });
  }

  function fillRoles() {
    return RolePlanPack.listRoles({ rolesUrl: "my-plan/roles.json" }).then(
      function (roles) {
        var sel = $("pi-role-select");
        if (!sel) return;
        sel.innerHTML = roles
          .map(function (r) {
            return (
              '<option value="' +
              esc(r.id) +
              '"' +
              (r.id === state.roleId ? " selected" : "") +
              ">" +
              esc(r.label_ar || r.id) +
              "</option>"
            );
          })
          .join("");
        sel.addEventListener("change", function () {
          loadRole(sel.value);
        });
      }
    );
  }

  function boot() {
    try {
      sessionStorage.setItem(
        "sessionUser",
        JSON.stringify({
          token: "preview-integration",
          id: "preview",
          name: "معاينة تكامل",
          role: "teacher",
          owner_role: "teacher"
        })
      );
    } catch (e) {}

    bindShellMenus();
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

    var q = new URLSearchParams(location.search);
    if (q.get("role")) state.roleId = q.get("role");
    if (q.get("seasonal") === "1") {
      state.showSeasonal = true;
      if (seasonal) seasonal.checked = true;
    }

    fillRoles().then(function () {
      return loadRole(state.roleId);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
