/* لوحة المتابعة التنفيذية لتقويم الأداء — ملف مستقل (قراءة + تقارير A4). */
(function (root) {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var API = "/api/session/job-performance";
  var SCHOOL_NAME = "متوسطة سعد بن الربيع الأنصاري";
  var state = {
    pack: null,
    statusFilter: "all",
    roleFilter: "all",
    bound: false,
    loading: false
  };

  function sessionUser() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function authHeaders() {
    var user = sessionUser() || {};
    var headers = { Accept: "application/json" };
    if (user.token) {
      headers["X-Session-Token"] = String(user.token);
    }
    return headers;
  }

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function status(msg, isError) {
    var el = document.getElementById("aj-jp-status");
    if (!el) {
      return;
    }
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  function fetchJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (body) {
          if (!response.ok) {
            var detail = body.detail || body.message || "تعذر تنفيذ الطلب";
            if (Array.isArray(detail)) {
              detail = detail
                .map(function (row) {
                  return row.msg || JSON.stringify(row);
                })
                .join(" · ");
            }
            var err = new Error(detail);
            err.status = response.status;
            throw err;
          }
          return body;
        });
    });
  }

  function selectedCycleId() {
    var sel = document.getElementById("aj-jp-cycle");
    return sel && sel.value ? Number(sel.value) : 0;
  }

  function selectedPhase() {
    var active = document.querySelector("#view-job-performance .aj-jp-phase-btn.is-active");
    var phase = active && active.getAttribute("data-aj-jp-phase");
    return phase === "final" ? "final" : "mid";
  }

  function statusLabel(code) {
    if (code === "done") {
      return "منجز";
    }
    if (code === "in_progress") {
      return "قيد الرصد";
    }
    return "متبقي";
  }

  function statusClass(code) {
    if (code === "done") {
      return "is-done";
    }
    if (code === "in_progress") {
      return "is-progress";
    }
    return "is-pending";
  }

  function filteredItems() {
    var items = (state.pack && state.pack.items) || [];
    return items.filter(function (row) {
      if (state.statusFilter === "done" && row.status !== "done") {
        return false;
      }
      if (state.statusFilter === "pending" && row.status === "done") {
        return false;
      }
      if (state.statusFilter === "gap" && !row.has_gap) {
        return false;
      }
      if (state.roleFilter !== "all" && row.assignment_role !== state.roleFilter) {
        return false;
      }
      return true;
    });
  }

  function paintCards() {
    var stats = (state.pack && state.pack.stats) || {};
    var set = function (id, value) {
      var el = document.getElementById(id);
      if (el) {
        el.textContent = value;
      }
    };
    set("aj-jp-dash-total", String(stats.total != null ? stats.total : "—"));
    set("aj-jp-dash-done", String(stats.done != null ? stats.done : "—"));
    set("aj-jp-dash-pending", String(stats.pending != null ? stats.pending : "—"));
    set(
      "aj-jp-dash-avg",
      stats.school_avg_percent != null ? Number(stats.school_avg_percent).toFixed(2) + " %" : "—"
    );
  }

  function paintRoleFilter() {
    var sel = document.getElementById("aj-jp-dash-role");
    if (!sel) {
      return;
    }
    var codes = (state.pack && state.pack.role_codes) || {};
    var keys = Object.keys(codes);
    var current = state.roleFilter || "all";
    sel.innerHTML =
      "<option value=\"all\">كل التشكيلات</option>" +
      keys
        .map(function (code) {
          return (
            "<option value=\"" +
            escapeHtml(code) +
            "\">" +
            escapeHtml(codes[code] || code) +
            "</option>"
          );
        })
        .join("");
    sel.value = current;
  }

  function paintTable() {
    var host = document.getElementById("aj-jp-dash-tbody");
    var countEl = document.getElementById("aj-jp-dash-count");
    if (!host) {
      return;
    }
    var rows = filteredItems();
    if (countEl) {
      countEl.textContent = String(rows.length);
    }
    if (!rows.length) {
      host.innerHTML =
        "<tr><td colspan=\"8\"><p class=\"aj-jp-dash-empty\">لا منسوبون مطابقون للفلتر الحالي.</p></td></tr>";
      return;
    }
    host.innerHTML = rows
      .map(function (row, index) {
        var percent =
          row.percent != null && row.percent !== ""
            ? Number(row.percent).toFixed(2) + " %"
            : "—";
        var gapHtml = row.has_gap
          ? "<span class=\"aj-jp-dash-pill is-gap\">" +
            escapeHtml(String(row.gap_count)) +
            " عنصر</span>"
          : "—";
        return (
          "<tr>" +
          "<td>" +
          (index + 1) +
          "</td>" +
          "<td>" +
          escapeHtml(row.name || "") +
          "</td>" +
          "<td>" +
          escapeHtml(row.role || "—") +
          "</td>" +
          "<td>" +
          escapeHtml(row.assignment_label || row.assignment_role || "—") +
          "</td>" +
          "<td><span class=\"aj-jp-dash-pill " +
          statusClass(row.status) +
          "\">" +
          escapeHtml(statusLabel(row.status)) +
          "</span></td>" +
          "<td>" +
          escapeHtml(percent) +
          (row.band_label ? "<br><small>" + escapeHtml(row.band_label) + "</small>" : "") +
          "</td>" +
          "<td>" +
          gapHtml +
          "</td>" +
          "<td><button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary aj-jp-dash-open\" data-aj-jp-dash-open=\"" +
          escapeHtml(row.staff_id) +
          "\">فتح البطاقة</button></td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function paint() {
    paintCards();
    paintRoleFilter();
    paintTable();
  }

  function applyPaneVisibility(wantDash) {
    var dash = document.getElementById("aj-jp-dashboard");
    var card = document.getElementById("aj-jp-card-workspace");
    var tabCard = document.getElementById("aj-jp-tab-card");
    var tabDash = document.getElementById("aj-jp-tab-dashboard");
    if (dash) {
      dash.hidden = !wantDash;
      dash.classList.toggle("aj-jp-pane-hidden", !wantDash);
      dash.setAttribute("aria-hidden", wantDash ? "false" : "true");
    }
    if (card) {
      card.hidden = wantDash;
      card.classList.toggle("aj-jp-pane-hidden", wantDash);
      card.setAttribute("aria-hidden", wantDash ? "true" : "false");
    }
    if (tabCard) {
      tabCard.classList.toggle("is-active", !wantDash);
      tabCard.setAttribute("aria-selected", wantDash ? "false" : "true");
    }
    if (tabDash) {
      tabDash.classList.toggle("is-active", wantDash);
      tabDash.setAttribute("aria-selected", wantDash ? "true" : "false");
    }
  }

  function scrollJobPerfTop() {
    var view = document.getElementById("view-job-performance");
    var tabs = document.querySelector("#view-job-performance .aj-jp-tabs");
    var target = tabs || view;
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      window.scrollTo(0, 0);
    }
  }

  function setTab(tab) {
    var wantDash = tab === "dashboard";
    applyPaneVisibility(wantDash);
    if (wantDash) {
      refresh();
    } else {
      scrollJobPerfTop();
    }
  }

  function openStaffCard(staffId) {
    applyPaneVisibility(false);
    scrollJobPerfTop();
    var openPromise;
    if (root.AjJobPerformance && typeof root.AjJobPerformance.openStaff === "function") {
      openPromise = root.AjJobPerformance.openStaff(staffId);
    } else {
      var teacherEl = document.getElementById("aj-jp-teacher");
      if (teacherEl) {
        teacherEl.value = String(staffId || "");
        teacherEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
      openPromise = Promise.resolve();
    }
    return Promise.resolve(openPromise).then(function (result) {
      scrollJobPerfTop();
      return result;
    });
  }

  function leadershipSignoffColumns() {
    var user = sessionUser() || {};
    var userId = String(user.national_id || user.id || "").trim();
    var userName = String(user.name || "").trim();
    return [
      {
        roleTitle: "وكيل المدرسة",
        name: userName,
        id: userId,
        signature: userId ? "signatures/sig_" + userId + ".png" : "",
        signatureFallback: "signatures/sig_students.png"
      },
      {
        roleTitle: "مدير المدرسة",
        name: "",
        signatureFallback: "signatures/sig_manager.png"
      }
    ];
  }

  function enrichSignoff() {
    var base = leadershipSignoffColumns();
    if (!root.AJPrint || typeof root.AJPrint.leadership !== "function") {
      return Promise.resolve(base);
    }
    return root.AJPrint.leadership("admin")
      .then(function (cols) {
        var list = Array.isArray(cols) ? cols : [];
        var principal = list.filter(function (col) {
          return col && String(col.roleTitle || col.role || "").indexOf("مدير") >= 0;
        })[0];
        var vice = list.filter(function (col) {
          return col && String(col.roleTitle || col.role || "").indexOf("وكيل") >= 0;
        })[0];
        // الوكيل: الجلسة الحالية أولاً، ثم مقعد القيادة إن خلت الجلسة.
        if (!base[0].name && vice) {
          base[0].name = vice.name || base[0].name;
          if (vice.id) {
            base[0].id = vice.id;
          }
          if (vice.signature || vice.signaturePath) {
            base[0].signature = vice.signature || vice.signaturePath;
          }
        } else if (vice && (vice.signature || vice.signaturePath) && !base[0].signature) {
          base[0].signature = vice.signature || vice.signaturePath;
        }
        if (principal) {
          base[1].name = principal.name || base[1].name;
          if (principal.id) {
            base[1].id = principal.id;
          }
          if (principal.signature || principal.signaturePath) {
            base[1].signature = principal.signature || principal.signaturePath;
          }
        }
        return base.slice(0, 2);
      })
      .catch(function () {
        return base.slice(0, 2);
      });
  }

  function tableHtml(headers, rows) {
    var head = headers
      .map(function (h) {
        return "<th>" + escapeHtml(h) + "</th>";
      })
      .join("");
    var body = (rows || [])
      .map(function (row) {
        return (
          "<tr>" +
          row
            .map(function (cell) {
              return "<td>" + escapeHtml(cell) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    if (!body) {
      body =
        "<tr><td colspan=\"" +
        Math.max(headers.length, 1) +
        "\">لا بيانات محفوظة.</td></tr>";
    }
    return (
      "<table class=\"tpl-master-sheet tpl-data-table\" style=\"width:100%;border-collapse:collapse;font-size:11px;\">" +
      "<thead><tr>" +
      head +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table>"
    );
  }

  function printFollowupSheet() {
    if (!state.pack) {
      status("حمّل لوحة المتابعة أولاً.", true);
      return;
    }
    if (!root.PrintEngine || typeof root.PrintEngine.open !== "function") {
      status("محرك الطباعة الموحد غير محمّل.", true);
      return;
    }
    var cycle = state.pack.cycle || {};
    var stats = state.pack.stats || {};
    var rows = (state.pack.items || []).map(function (row, index) {
      return [
        String(index + 1),
        row.name || "",
        row.role || "",
        row.assignment_label || "",
        statusLabel(row.status),
        row.percent != null ? Number(row.percent).toFixed(2) + "%" : "—",
        row.band_label || "—",
        row.has_gap ? String(row.gap_count) : "—"
      ];
    });
    var note =
      "<p class=\"tpl-p\">إجمالي المنسوبين: " +
      escapeHtml(String(stats.total || 0)) +
      " · المنجز: " +
      escapeHtml(String(stats.done || 0)) +
      " · المتبقي: " +
      escapeHtml(String(stats.pending || 0)) +
      " · متوسط الأداء العام: " +
      escapeHtml(
        stats.school_avg_percent != null
          ? Number(stats.school_avg_percent).toFixed(2) + "%"
          : "—"
      ) +
      " · الدورة: " +
      escapeHtml(cycle.label || cycle.academic_year || "—") +
      "</p>";

    enrichSignoff().then(function (signCols) {
      root.PrintEngine.open("master-sheet", {
        docTitle: "كشف متابعة إنجاز تقويم الأداء الوظيفي لمنسوبي المدرسة",
        title: "كشف متابعة إنجاز تقويم الأداء الوظيفي لمنسوبي المدرسة",
        kind: "document",
        fileName: "كشف_متابعة_تقويم_الأداء_الوظيفي",
        orientation: "portrait",
        multiPage: true,
        list: true,
        strictIdentity: true,
        school: SCHOOL_NAME,
        bodyHtml:
          note +
          tableHtml(
            [
              "م",
              "الاسم",
              "الصفة",
              "القالب",
              "حالة الرصد",
              "النتيجة %",
              "التقدير اللفظي",
              "خطط فجوة"
            ],
            rows
          ),
        signoff: true,
        maxColumns: 2,
        signatures: (signCols || []).slice(0, 2)
      });
      status("معاينة كشف المتابعة الإجمالي جاهزة.");
    });
  }

  function printTrainingMatrix() {
    if (!state.pack) {
      status("حمّل لوحة المتابعة أولاً.", true);
      return;
    }
    if (!root.PrintEngine || typeof root.PrintEngine.open !== "function") {
      status("محرك الطباعة الموحد غير محمّل.", true);
      return;
    }
    var needs = state.pack.training_needs || [];
    var rows = needs.map(function (row, index) {
      var names = (row.staff || [])
        .map(function (s) {
          return s.name || "";
        })
        .filter(Boolean)
        .join("، ");
      var actions = (row.sample_actions || []).slice(0, 3).join(" · ");
      return [
        String(index + 1),
        row.element_label || row.element_id || "",
        String(row.count || 0),
        names || "—",
        actions || "يُستكمل من خطة فجوة الأداء عند الحفظ"
      ];
    });
    if (!rows.length) {
      rows = [["—", "لا فجوات مرصودة حالياً (تقدير 1 أو 2)", "0", "—", "—"]];
    }
    enrichSignoff().then(function (signCols) {
      root.PrintEngine.open("master-sheet", {
        docTitle: "مصفوفة الاحتياجات التدريبية من فجوات الأداء الوظيفي",
        title: "مصفوفة الاحتياجات التدريبية المستخلصة من فجوات الأداء",
        kind: "document",
        fileName: "مصفوفة_الاحتياجات_التدريبية_فجوات_الأداء",
        orientation: "portrait",
        multiPage: true,
        list: true,
        strictIdentity: true,
        school: SCHOOL_NAME,
        bodyHtml:
          "<p class=\"tpl-p\">تجميع تلقائي للعناصر ذات التقدير 1 أو 2 لتغذية ملف التدريب والقياس (SSOT).</p>" +
          tableHtml(
            ["م", "عنصر الفجوة", "التكرار", "المنسوبون", "خطوات إجرائية مقترحة"],
            rows
          ),
        signoff: true,
        maxColumns: 2,
        signatures: (signCols || []).slice(0, 2)
      });
      status("معاينة مصفوفة الاحتياجات التدريبية جاهزة.");
    });
  }

  function refresh() {
    if (state.loading) {
      return Promise.resolve(state.pack);
    }
    var cycleId = selectedCycleId();
    var phase = selectedPhase();
    state.loading = true;
    status("جارٍ تحميل لوحة المتابعة التنفيذية…");
    return fetchJson(
      API +
        "/summary?cycle_id=" +
        encodeURIComponent(cycleId || 0) +
        "&phase=" +
        encodeURIComponent(phase),
      { headers: authHeaders(), cache: "no-store" }
    )
      .then(function (pack) {
        state.pack = pack;
        paint();
        var stats = pack.stats || {};
        status(
          "لوحة المتابعة: " +
            (stats.done || 0) +
            " منجز / " +
            (stats.total || 0) +
            " · متوسط المدرسة " +
            (stats.school_avg_percent != null
              ? Number(stats.school_avg_percent).toFixed(2) + "%"
              : "—")
        );
        return pack;
      })
      .catch(function (error) {
        status((error && error.message) || "تعذر تحميل لوحة المتابعة.", true);
        throw error;
      })
      .finally(function () {
        state.loading = false;
      });
  }

  function bind() {
    if (state.bound) {
      return;
    }
    state.bound = true;
    var rootView = document.getElementById("view-job-performance");
    if (!rootView) {
      return;
    }
    rootView.addEventListener("click", function (event) {
      var t = event.target;
      if (!t || !t.closest) {
        return;
      }
      var tabBtn = t.closest("[data-aj-jp-tab]");
      if (tabBtn) {
        setTab(tabBtn.getAttribute("data-aj-jp-tab") === "dashboard" ? "dashboard" : "card");
        return;
      }
      if (t.closest("#aj-jp-dash-refresh")) {
        refresh();
        return;
      }
      if (t.closest("#aj-jp-dash-print-followup")) {
        printFollowupSheet();
        return;
      }
      if (t.closest("#aj-jp-dash-print-training")) {
        printTrainingMatrix();
        return;
      }
      var openBtn = t.closest("[data-aj-jp-dash-open]");
      if (openBtn) {
        openStaffCard(openBtn.getAttribute("data-aj-jp-dash-open"));
      }
    });
    rootView.addEventListener("change", function (event) {
      var t = event.target;
      if (!t) {
        return;
      }
      if (t.id === "aj-jp-dash-status") {
        state.statusFilter = t.value || "all";
        paintTable();
        return;
      }
      if (t.id === "aj-jp-dash-role") {
        state.roleFilter = t.value || "all";
        paintTable();
        return;
      }
      if (t.id === "aj-jp-cycle") {
        var dash = document.getElementById("aj-jp-dashboard");
        if (dash && !dash.hidden) {
          refresh();
        }
      }
    });
  }

  function load() {
    bind();
    var dash = document.getElementById("aj-jp-dashboard");
    var wantDash = !!(dash && !dash.hidden && !dash.classList.contains("aj-jp-pane-hidden"));
    applyPaneVisibility(wantDash);
    if (wantDash) {
      return refresh();
    }
    return Promise.resolve(null);
  }

  root.AjJobPerformanceDashboard = {
    load: load,
    refresh: refresh,
    setTab: setTab,
    openStaffCard: openStaffCard
  };
})(window);
