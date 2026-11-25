/* التقويم الذاتي المدرسي (SSOT) — الوحدة 2-أ */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var API = "/api/session/accreditation";
  var SCHOOL_NAME = "متوسطة سعد بن الربيع الأنصاري";
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

  function leadershipSignoffColumns() {
    // توقيعان ثابتان لوثائق الاعتماد المدرسي (وكيل + مدير).
    return [
      {
        roleTitle: "وكيل المدرسة",
        name: "أحمد علي هيازع الشهري",
        id: "1008379958",
        signature: "signatures/sig_1008379958.png",
        signatureFallback: "signatures/sig_students.png"
      },
      {
        roleTitle: "مدير المدرسة",
        name: "نايف بن سمير حجيف المخلفي",
        id: "1046940365",
        signature: "signatures/sig_1046940365.png",
        signatureFallback: "signatures/sig_manager.png"
      }
    ];
  }

  function enrichSignoff() {
    var base = leadershipSignoffColumns();
    if (!window.AJPrint || typeof window.AJPrint.leadership !== "function") {
      return Promise.resolve(base);
    }
    return window.AJPrint.leadership("admin")
      .then(function (cols) {
        var list = Array.isArray(cols) ? cols : [];
        var principal = list.filter(function (col) {
          return col && String(col.roleTitle || col.role || "").indexOf("مدير") >= 0;
        })[0];
        var vice = list.filter(function (col) {
          return col && String(col.roleTitle || col.role || "").indexOf("وكيل") >= 0;
        })[0];
        // الأسماء مثبتة؛ نثرّي مسارات التوقيع فقط إن وُجدت من القيادة.
        if (vice && (vice.signature || vice.signaturePath)) {
          base[0].signature = vice.signature || vice.signaturePath;
        }
        if (principal && (principal.signature || principal.signaturePath)) {
          base[1].signature = principal.signature || principal.signaturePath;
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
      "<table class=\"tpl-master-sheet tpl-data-table\" style=\"width:100%;border-collapse:collapse;font-size:10.5px;\">" +
      "<thead><tr>" +
      head +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table>"
    );
  }

  function domainSummaryRows() {
    var map = {};
    ((state.pack && state.pack.indicators) || []).forEach(function (row) {
      var domain = row.domain || "—";
      if (!map[domain]) {
        map[domain] = { total: 0, rated: 0, sum: 0, priority: 0 };
      }
      map[domain].total += 1;
      var level = Number(row.self_level || 0);
      if (level >= 1) {
        map[domain].rated += 1;
        map[domain].sum += level;
      }
      if (level === 1 || level === 2) {
        map[domain].priority += 1;
      }
    });
    return Object.keys(map)
      .sort()
      .map(function (domain, index) {
        var pack = map[domain];
        var avg = pack.rated ? (pack.sum / pack.rated).toFixed(2) : "—";
        return [
          String(index + 1),
          domain,
          String(pack.total),
          String(pack.rated),
          String(pack.total - pack.rated),
          avg,
          String(pack.priority)
        ];
      });
  }

  function improveAction(row) {
    var note = String(row.self_note || "").trim();
    if (note) {
      return note;
    }
    return (
      "بناء خطة تطوير مركّزة للمؤشر «" +
      (row.code || "") +
      "» وربطها بالشواهد الحية ومتابعة نصف سنوية حتى الانتقال للمستوى الأعلى."
    );
  }

  function improveOwner(domain) {
    var text = String(domain || "");
    if (text.indexOf("نواتج") >= 0) {
      return "وكيل الشؤون التعليمية / لجنة التحصيل";
    }
    if (text.indexOf("تعليم والتعلم") >= 0) {
      return "وكيل الشؤون التعليمية / المعلمون";
    }
    if (text.indexOf("البيئة") >= 0) {
      return "وكيل الشؤون المدرسية / فريق الأمن والسلامة";
    }
    return "وكيل المدرسة / لجنة التميز والجودة";
  }

  function printSelfReport() {
    if (!state.pack || !(state.pack.indicators || []).length) {
      status("حمّل بنك الاعتماد أولاً.", true);
      return;
    }
    if (!window.PrintEngine || typeof window.PrintEngine.open !== "function") {
      status("محرك الطباعة الموحد غير محمّل.", true);
      return;
    }
    var stats = state.pack.stats || {};
    var cycle = state.pack.cycle || {};
    var labels = state.pack.self_levels || {};
    var domainRows = domainSummaryRows();
    var indicatorRows = (state.pack.indicators || []).map(function (row, index) {
      var level = Number(row.self_level || 0);
      return [
        String(index + 1),
        row.code || "",
        row.domain || "",
        row.statement || "",
        level
          ? level + " · " + (row.self_level_label || levelLabel(level, labels) || "")
          : "غير مرصود",
        row.external_level || "—",
        row.self_note || "—"
      ];
    });
    var note =
      "<p class=\"tpl-p\">إجمالي المؤشرات: " +
      escapeHtml(String(stats.total || 0)) +
      " · المرصود: " +
      escapeHtml(String(stats.rated || 0)) +
      " · المتبقي: " +
      escapeHtml(String(stats.pending || 0)) +
      " · متوسط الإتقان: " +
      escapeHtml(
        stats.avg_level != null ? Number(stats.avg_level).toFixed(2) + " / 4.00" : "—"
      ) +
      " · الدورة: " +
      escapeHtml(cycle.academic_year || cycle.title || "—") +
      "</p>" +
      "<h3 class=\"aj-group-title\" style=\"font-size:16px;color:#0b5e56;\">ملخص المجالات الأربعة</h3>" +
      tableHtml(
        ["م", "المجال", "المؤشرات", "مرصود", "متبقي", "متوسط ذاتي", "أولوية 1–2"],
        domainRows
      ) +
      "<h3 class=\"aj-group-title\" style=\"font-size:16px;color:#0b5e56;margin-top:4mm;\">سجل المؤشرات والرصد الذاتي</h3>";

    enrichSignoff().then(function (signCols) {
      window.PrintEngine.open("master-sheet", {
        docTitle: "تقرير التقويم الذاتي المدرسي الشامل",
        title: "تقرير التقويم الذاتي المدرسي الشامل",
        kind: "document",
        fileName: "تقرير_التقويم_الذاتي_المدرسي_الشامل",
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
              "الرمز",
              "المجال",
              "نص المؤشر",
              "المستوى الذاتي",
              "المستوى الخارجي",
              "الملاحظة"
            ],
            indicatorRows
          ),
        signoff: true,
        maxColumns: 2,
        signatures: (signCols || []).slice(0, 2)
      });
      status("معاينة تقرير التقويم الذاتي الشامل جاهزة.");
    });
  }

  function printImprovePlan() {
    if (!state.pack || !(state.pack.indicators || []).length) {
      status("حمّل بنك الاعتماد أولاً.", true);
      return;
    }
    if (!window.PrintEngine || typeof window.PrintEngine.open !== "function") {
      status("محرك الطباعة الموحد غير محمّل.", true);
      return;
    }
    var labels = state.pack.self_levels || {};
    var priority = (state.pack.indicators || []).filter(function (row) {
      var level = Number(row.self_level || 0);
      return level === 1 || level === 2;
    });
    var rows = priority.map(function (row, index) {
      var level = Number(row.self_level || 0);
      return [
        String(index + 1),
        row.code || "",
        row.statement || "",
        level + " · " + (row.self_level_label || levelLabel(level, labels) || ""),
        row.self_note || "فجوة أداء تتطلب خطة تحسين",
        improveAction(row),
        improveOwner(row.domain),
        "خلال الفصل الدراسي الحالي"
      ];
    });
    if (!rows.length) {
      rows = [
        [
          "—",
          "—",
          "لا مؤشرات مرصودة حالياً بمستوى التهيئة أو الانطلاق",
          "—",
          "—",
          "—",
          "—",
          "—"
        ]
      ];
    }
    enrichSignoff().then(function (signCols) {
      window.PrintEngine.open("master-sheet", {
        docTitle: "خطة التحسين والتطوير المدرسية",
        title: "خطة التحسين والتطوير المدرسية",
        kind: "document",
        fileName: "خطة_التحسين_والتطوير_المدرسية",
        orientation: "portrait",
        multiPage: true,
        list: true,
        strictIdentity: true,
        school: SCHOOL_NAME,
        bodyHtml:
          "<p class=\"tpl-p\">تُستخلص تلقائياً من الرصد الذاتي للمؤشرات ذات المستوى 1 (التهيئة) أو 2 (الانطلاق) لتغذية خطط التحسين المدرسية (SSOT).</p>" +
          tableHtml(
            [
              "م",
              "الرمز",
              "نص المؤشر",
              "المستوى الحالي",
              "فجوة التحسين / الملاحظة",
              "الإجراء التطويري المقترح",
              "الجهة المنفذة",
              "زمن التنفيذ"
            ],
            rows
          ),
        signoff: true,
        maxColumns: 2,
        signatures: (signCols || []).slice(0, 2)
      });
      status(
        "معاينة خطة التحسين جاهزة · " +
          priority.length +
          " مؤشراً أولوية (تهيئة/انطلاق)."
      );
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
      if (t.closest("#aj-ac-print-report")) {
        printSelfReport();
        return;
      }
      if (t.closest("#aj-ac-print-improve")) {
        printImprovePlan();
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
    refresh: refresh,
    printSelfReport: printSelfReport,
    printImprovePlan: printImprovePlan
  };
})();
