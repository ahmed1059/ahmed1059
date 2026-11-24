/* التقويم الذاتي المدرسي (SSOT) — الوحدة 2-أ */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var API = "/api/session/accreditation";
  var state = {
    pack: null,
    domainFilter: "all",
    statusFilter: "all",
    evidenceCache: {},
    bound: false,
    saving: {}
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
    var el = document.getElementById("aj-ac-status");
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

  function levelLabel(level, labels) {
    var map = labels || (state.pack && state.pack.self_levels) || {};
    return map[String(level)] || map[level] || "";
  }

  function filteredIndicators() {
    var items = (state.pack && state.pack.indicators) || [];
    return items.filter(function (row) {
      if (state.domainFilter !== "all" && row.domain !== state.domainFilter) {
        return false;
      }
      var level = Number(row.self_level || 0);
      if (state.statusFilter === "pending" && level >= 1) {
        return false;
      }
      if (state.statusFilter === "priority" && !(level === 1 || level === 2)) {
        return false;
      }
      if (state.statusFilter === "advanced" && !(level === 3 || level === 4)) {
        return false;
      }
      return true;
    });
  }

  function paintStats() {
    var stats = (state.pack && state.pack.stats) || {};
    var set = function (id, value) {
      var el = document.getElementById(id);
      if (el) {
        el.textContent = value;
      }
    };
    set("aj-ac-total", String(stats.total != null ? stats.total : "—"));
    set("aj-ac-rated", String(stats.rated != null ? stats.rated : "—"));
    set("aj-ac-pending", String(stats.pending != null ? stats.pending : "—"));
    set(
      "aj-ac-avg",
      stats.avg_level != null ? Number(stats.avg_level).toFixed(2) + " / 4.00" : "—"
    );
  }

  function paintFilters() {
    var domainSel = document.getElementById("aj-ac-domain");
    if (!domainSel) {
      return;
    }
    var domains = (state.pack && state.pack.domains) || [];
    var current = state.domainFilter || "all";
    domainSel.innerHTML =
      "<option value=\"all\">كل المجالات</option>" +
      domains
        .map(function (name) {
          return (
            "<option value=\"" +
            escapeHtml(name) +
            "\">" +
            escapeHtml(name) +
            "</option>"
          );
        })
        .join("");
    domainSel.value = current;
    var statusSel = document.getElementById("aj-ac-status-filter");
    if (statusSel) {
      statusSel.value = state.statusFilter || "all";
    }
  }

  function evidenceHtml(code, pack) {
    if (!pack) {
      return "<p class=\"aj-ac-evidence-empty\">اضغط لجلب الشواهد الحية المرتبطة.</p>";
    }
    var items = pack.items || [];
    if (!items.length) {
      return "<p class=\"aj-ac-evidence-empty\">لا شواهد حية مرتبطة حالياً بهذا المؤشر.</p>";
    }
    return (
      "<ul>" +
      items
        .map(function (item) {
          var line = item.title || item.source_kind || "";
          if (item.summary) {
            line += " — " + item.summary;
          }
          if (item.date) {
            line += " · " + item.date;
          }
          return "<li>" + escapeHtml(line) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function paintList() {
    var host = document.getElementById("aj-ac-list");
    var countEl = document.getElementById("aj-ac-visible-count");
    if (!host) {
      return;
    }
    var rows = filteredIndicators();
    if (countEl) {
      countEl.textContent = String(rows.length);
    }
    if (!rows.length) {
      host.innerHTML = "<p class=\"aj-lede\">لا مؤشرات مطابقة للفلتر الحالي.</p>";
      return;
    }
    var labels = (state.pack && state.pack.self_levels) || {};
    host.innerHTML = rows
      .map(function (row) {
        var code = row.code || "";
        var level = Number(row.self_level || 0);
        var levelBtns = [1, 2, 3, 4]
          .map(function (n) {
            return (
              "<button type=\"button\" class=\"aj-ac-level-btn" +
              (level === n ? " is-on" : "") +
              "\" data-aj-ac-level=\"" +
              n +
              "\" data-code=\"" +
              escapeHtml(code) +
              "\">" +
              n +
              " · " +
              escapeHtml(levelLabel(n, labels) || "") +
              "</button>"
            );
          })
          .join("");
        var externalBits = [];
        if (row.external_level) {
          externalBits.push("المستوى الخارجي المرجعي: " + row.external_level);
        }
        if (row.external_score_percent) {
          externalBits.push("النسبة: " + row.external_score_percent + "%");
        }
        var cached = state.evidenceCache[code];
        return (
          "<article class=\"aj-ac-item\" data-code=\"" +
          escapeHtml(code) +
          "\">" +
          "<div class=\"aj-ac-item-head\">" +
          "<h3 class=\"aj-ac-code\">" +
          escapeHtml(code) +
          "</h3>" +
          "<span class=\"aj-ac-domain\">" +
          escapeHtml(row.domain || "") +
          (row.standard_name ? " · " + escapeHtml(row.standard_name) : "") +
          "</span>" +
          "</div>" +
          "<p class=\"aj-ac-statement\">" +
          escapeHtml(row.statement || "") +
          "</p>" +
          (externalBits.length
            ? "<p class=\"aj-ac-external\">" + escapeHtml(externalBits.join(" · ")) + "</p>"
            : "") +
          "<div class=\"aj-ac-levels\" role=\"group\" aria-label=\"المستوى الذاتي\">" +
          levelBtns +
          "</div>" +
          "<label class=\"aj-ac-note-label\" for=\"aj-ac-note-" +
          escapeHtml(code) +
          "\">ملاحظة تنفيذية</label>" +
          "<textarea class=\"aj-ac-note\" id=\"aj-ac-note-" +
          escapeHtml(code) +
          "\" data-aj-ac-note=\"" +
          escapeHtml(code) +
          "\" maxlength=\"500\" placeholder=\"ملاحظة اختيارية ≤ 500 حرفاً\">" +
          escapeHtml(row.self_note || "") +
          "</textarea>" +
          "<div class=\"aj-ac-actions\">" +
          "<button type=\"button\" class=\"aj-detail-btn\" data-aj-ac-save=\"" +
          escapeHtml(code) +
          "\">حفظ الرصد</button>" +
          "<span class=\"aj-ac-domain\" data-aj-ac-saved=\"" +
          escapeHtml(code) +
          "\">" +
          (level
            ? "محفوظ: " + escapeHtml(levelLabel(level, labels) || String(level))
            : "غير مرصود") +
          "</span>" +
          "</div>" +
          "<details class=\"aj-ac-evidence\" data-aj-ac-evidence=\"" +
          escapeHtml(code) +
          "\">" +
          "<summary>الشواهد الحية المرتبطة</summary>" +
          "<div data-aj-ac-evidence-body=\"" +
          escapeHtml(code) +
          "\">" +
          evidenceHtml(code, cached) +
          "</div>" +
          "</details>" +
          "</article>"
        );
      })
      .join("");
  }

  function paint() {
    paintStats();
    paintFilters();
    paintList();
  }

  function cssCode(code) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(String(code || ""));
    }
    return String(code || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function selectedLevel(code) {
    var btn = document.querySelector(
      '.aj-ac-level-btn.is-on[data-code="' + cssCode(code) + '"]'
    );
    return btn ? Number(btn.getAttribute("data-aj-ac-level") || 0) : 0;
  }

  function noteValue(code) {
    var el = document.getElementById("aj-ac-note-" + code);
    return el ? String(el.value || "").trim() : "";
  }

  function saveOne(code) {
    if (state.saving[code]) {
      return Promise.resolve();
    }
    var level = selectedLevel(code);
    if (!(level >= 1 && level <= 4)) {
      status("اختر مستوى ذاتياً من 1 إلى 4 قبل الحفظ.", true);
      return Promise.resolve();
    }
    var cycleId = state.pack && state.pack.cycle ? state.pack.cycle.id : 0;
    state.saving[code] = true;
    status("جارٍ حفظ رصد " + code + "…");
    return fetchJson(API + "/self", {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({
        cycle_id: cycleId,
        indicator_code: code,
        level: level,
        note: noteValue(code)
      })
    })
      .then(function (body) {
        var rows = (state.pack && state.pack.indicators) || [];
        rows.forEach(function (row) {
          if (row.code === code) {
            row.self_level = body.level;
            row.self_level_label = body.level_label || "";
            row.self_note = body.note || "";
            row.is_rated = true;
            row.self_updated_at = body.updated_at || "";
          }
        });
        if (state.pack && state.pack.stats) {
          var rated = rows.filter(function (row) {
            return Number(row.self_level || 0) >= 1;
          });
          var sum = rated.reduce(function (acc, row) {
            return acc + Number(row.self_level || 0);
          }, 0);
          state.pack.stats.rated = rated.length;
          state.pack.stats.pending = rows.length - rated.length;
          state.pack.stats.avg_level = rated.length ? Math.round((sum / rated.length) * 100) / 100 : null;
        }
        paint();
        status("تم حفظ رصد «" + code + "» — " + (body.level_label || body.level));
      })
      .catch(function (error) {
        status((error && error.message) || "تعذر حفظ الرصد.", true);
      })
      .finally(function () {
        state.saving[code] = false;
      });
  }

  function loadEvidence(code, force) {
    if (!force && state.evidenceCache[code]) {
      var body = document.querySelector('[data-aj-ac-evidence-body="' + code.replace(/"/g, '\\"') + '"]');
      if (body) {
        body.innerHTML = evidenceHtml(code, state.evidenceCache[code]);
      }
      return Promise.resolve(state.evidenceCache[code]);
    }
    return fetchJson(API + "/evidence?code=" + encodeURIComponent(code), {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (pack) {
      state.evidenceCache[code] = pack;
      var body = document.querySelector('[data-aj-ac-evidence-body="' + code.replace(/"/g, '\\"') + '"]');
      if (body) {
        body.innerHTML = evidenceHtml(code, pack);
      }
      return pack;
    });
  }

  function refresh() {
    status("جارٍ تحميل بنك الاعتماد…");
    return fetchJson(API + "/bank", { headers: authHeaders(), cache: "no-store" })
      .then(function (pack) {
        state.pack = pack;
        paint();
        var stats = pack.stats || {};
        var cycle = pack.cycle || {};
        status(
          "بنك الاعتماد: " +
            (stats.total || 0) +
            " مؤشراً · مرصود " +
            (stats.rated || 0) +
            (cycle.academic_year ? " · الدورة " + cycle.academic_year : "")
        );
        return pack;
      })
      .catch(function (error) {
        status((error && error.message) || "تعذر تحميل بنك الاعتماد.", true);
        throw error;
      });
  }

  function bind() {
    if (state.bound) {
      return;
    }
    state.bound = true;
    var root = document.getElementById("view-accreditation-self");
    if (!root) {
      return;
    }
    root.addEventListener("click", function (event) {
      var t = event.target;
      if (!t || !t.closest) {
        return;
      }
      if (t.closest("#aj-ac-refresh")) {
        refresh();
        return;
      }
      var levelBtn = t.closest("[data-aj-ac-level]");
      if (levelBtn) {
        var code = levelBtn.getAttribute("data-code") || "";
        var article = levelBtn.closest(".aj-ac-item");
        if (article) {
          Array.prototype.forEach.call(article.querySelectorAll(".aj-ac-level-btn"), function (btn) {
            btn.classList.toggle("is-on", btn === levelBtn);
          });
        }
        var rows = (state.pack && state.pack.indicators) || [];
        rows.forEach(function (row) {
          if (row.code === code) {
            row.self_level = Number(levelBtn.getAttribute("data-aj-ac-level") || 0);
          }
        });
        return;
      }
      var saveBtn = t.closest("[data-aj-ac-save]");
      if (saveBtn) {
        saveOne(saveBtn.getAttribute("data-aj-ac-save") || "");
      }
    });
    root.addEventListener("change", function (event) {
      var t = event.target;
      if (!t) {
        return;
      }
      if (t.id === "aj-ac-domain") {
        state.domainFilter = t.value || "all";
        paintList();
        return;
      }
      if (t.id === "aj-ac-status-filter") {
        state.statusFilter = t.value || "all";
        paintList();
      }
    });
    root.addEventListener("toggle", function (event) {
      var details = event.target;
      if (!details || !details.getAttribute || details.tagName !== "DETAILS") {
        return;
      }
      if (!details.open) {
        return;
      }
      var code = details.getAttribute("data-aj-ac-evidence") || "";
      if (!code) {
        return;
      }
      loadEvidence(code, false).catch(function (error) {
        status((error && error.message) || "تعذر جلب الشواهد.", true);
      });
    }, true);
  }

  function load() {
    bind();
    return refresh();
  }

  window.AjAccreditationSelf = {
    load: load,
    refresh: refresh
  };
})();
