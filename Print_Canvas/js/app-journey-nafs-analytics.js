/* نواتج التعلم ونافس — الوحدة 3-أ: لوحة تحليل + خطة معالجة A4 */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var API = "/api/session/nafs/analytics";
  var SCHOOL_NAME = "متوسطة سعد بن الربيع الأنصاري";
  var state = { pack: null, bound: false };

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
    var el = document.getElementById("aj-nafes-status");
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

  function fmtScore(value) {
    if (value == null || value === "") {
      return "—";
    }
    var num = Number(value);
    if (isNaN(num)) {
      return String(value);
    }
    return num.toFixed(1);
  }

  function fmtGap(value) {
    if (value == null || value === "") {
      return "—";
    }
    var num = Number(value);
    if (isNaN(num)) {
      return String(value);
    }
    var sign = num > 0 ? "+" : "";
    return sign + num.toFixed(1);
  }

  function leadershipSignoffColumns() {
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

  function paintSummary(pack) {
    var host = document.getElementById("aj-nafs-summary");
    if (!host) {
      return;
    }
    var meta = pack.meta || {};
    var priority = pack.priority_skill || {};
    host.innerHTML =
      "<article class=\"aj-nafs-card\"><span>الصف / المرحلة</span><strong>" +
      escapeHtml(meta.grade || "—") +
      "</strong></article>" +
      "<article class=\"aj-nafs-card\"><span>المقيدون / المختبرون</span><strong>" +
      escapeHtml(String(meta.enrolled || "—")) +
      " / " +
      escapeHtml(String(meta.tested || "—")) +
      "</strong></article>" +
      "<article class=\"aj-nafs-card\"><span>متوسط الإتقان</span><strong>" +
      escapeHtml(
        meta.average_mastery_pct != null
          ? Number(meta.average_mastery_pct).toFixed(1) + "٪"
          : "—"
      ) +
      "</strong></article>" +
      "<article class=\"aj-nafs-card is-priority\"><span>أولوية المعالجة</span><strong>" +
      escapeHtml(priority.name || "—") +
      (priority.score != null ? " · " + escapeHtml(fmtScore(priority.score)) : "") +
      "</strong></article>";
  }

  function paintDomains(pack) {
    var host = document.getElementById("aj-nafs-domains");
    if (!host) {
      return;
    }
    var rows = pack.domains || [];
    if (!rows.length) {
      host.innerHTML = "<p class=\"aj-nafs-empty\">لا نتائج مجالات محفوظة.</p>";
      return;
    }
    host.innerHTML = rows
      .map(function (row, index) {
        return (
          "<article class=\"aj-nafs-domain" +
          (index === 0 ? " is-first" : "") +
          "\">" +
          "<h3>" +
          escapeHtml(row.label || "") +
          "</h3>" +
          "<p class=\"aj-nafs-score\">" +
          escapeHtml(fmtScore(row.score)) +
          "٪</p>" +
          "<p>المستهدف: " +
          escapeHtml(fmtScore(row.target)) +
          "٪ · الفجوة: " +
          escapeHtml(fmtGap(row.gap)) +
          "</p>" +
          "<p>مؤشر الاعتماد: " +
          escapeHtml(row.etec_indicator || "—") +
          "</p>" +
          (row.weakest_skill
            ? "<p>أضعف مهارة: " +
              escapeHtml(row.weakest_skill) +
              (row.weakest_score != null
                ? " (" + escapeHtml(fmtScore(row.weakest_score)) + ")"
                : "") +
              "</p>"
            : "") +
          "</article>"
        );
      })
      .join("");
  }

  function paintIndicators(pack) {
    var host = document.getElementById("aj-nafs-indicators");
    if (!host) {
      return;
    }
    var rows = pack.indicators || [];
    if (!rows.length) {
      host.innerHTML = "<p class=\"aj-nafs-empty\">لا مؤشرات اعتماد مربوطة.</p>";
      return;
    }
    host.innerHTML =
      "<ul>" +
      rows
        .map(function (row) {
          return (
            "<li><strong>" +
            escapeHtml(row.code || "") +
            "</strong> — " +
            escapeHtml(row.domain_label || "") +
            ": " +
            escapeHtml(row.statement || "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function paintActions(pack) {
    var host = document.getElementById("aj-nafs-actions");
    if (!host) {
      return;
    }
    var rows = pack.improvement_actions || [];
    if (!rows.length) {
      host.innerHTML = "<p class=\"aj-nafs-empty\">لا إجراءات تحسين مخزّنة لمجالات نافس حالياً.</p>";
      return;
    }
    host.innerHTML =
      "<ul>" +
      rows
        .map(function (row) {
          return (
            "<li><strong>" +
            escapeHtml(row.title || "") +
            "</strong>" +
            (row.indicator_code ? " · " + escapeHtml(row.indicator_code) : "") +
            (row.owner_label ? " · " + escapeHtml(row.owner_label) : "") +
            (row.evidence ? " · شاهد: " + escapeHtml(row.evidence) : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function paintTimetable(pack) {
    var host = document.getElementById("aj-nafs-timetable");
    if (!host) {
      return;
    }
    var tt = pack.timetable || {};
    if (tt.empty || !tt.total) {
      host.innerHTML =
        "<p class=\"aj-nafs-empty\">" +
        escapeHtml(tt.message || "لا حصص مستوردة في هذه البيئة بعد.") +
        "</p>";
      return;
    }
    var subjectRows = (tt.by_subject || [])
      .map(function (row) {
        return (
          "<tr><td>" +
          escapeHtml(row.subject || "—") +
          "</td><td>" +
          escapeHtml(String(row.count || 0)) +
          "</td></tr>"
        );
      })
      .join("");
    var teacherRows = (tt.by_teacher || [])
      .map(function (row) {
        return (
          "<tr><td>" +
          escapeHtml(row.teacher || row.timetable_name || "—") +
          "</td><td>" +
          escapeHtml(row.role || "—") +
          "</td><td>" +
          escapeHtml(String(row.count || 0)) +
          "</td></tr>"
        );
      })
      .join("");
    host.innerHTML =
      "<p>إجمالي الحصص المحفوظة: <strong>" +
      escapeHtml(String(tt.total || 0)) +
      "</strong></p>" +
      "<h3 class=\"aj-group-title\">حسب المادة</h3>" +
      "<div class=\"aj-nafs-table-wrap\" style=\"padding:0;border:0;background:transparent;\">" +
      "<table class=\"aj-nafs-table\"><thead><tr><th>المادة</th><th>الحصص</th></tr></thead><tbody>" +
      subjectRows +
      "</tbody></table></div>" +
      "<h3 class=\"aj-group-title\">حسب المعلم</h3>" +
      "<div class=\"aj-nafs-table-wrap\" style=\"padding:0;border:0;background:transparent;\">" +
      "<table class=\"aj-nafs-table\"><thead><tr><th>المعلم</th><th>الصفة</th><th>الحصص</th></tr></thead><tbody>" +
      teacherRows +
      "</tbody></table></div>";
  }

  function paint() {
    var pack = state.pack || {};
    paintSummary(pack);
    paintDomains(pack);
    paintIndicators(pack);
    paintActions(pack);
    paintTimetable(pack);
  }

  function domainAction(domain, pack) {
    var actions = (pack.improvement_actions || []).filter(function (row) {
      return row.indicator_code === domain.etec_indicator;
    });
    if (actions.length) {
      return actions
        .map(function (row) {
          return row.title || "";
        })
        .filter(Boolean)
        .join("؛ ");
    }
    if (domain.key === "math") {
      return (
        "تنفيذ حصص معالجة مركّزة في مهارة «" +
        (domain.weakest_skill || "الجبر") +
        "» ومتابعة أسبوعية حتى ردم فجوة المستهدف (" +
        fmtScore(domain.target) +
        "٪)."
      );
    }
    if (domain.key === "reading") {
      return "خطة قراءة صفية مكثّفة وربطها بمؤشر الاعتماد 3-1-1-1 مع قياس بعدي نصف فصلي.";
    }
    return "مراجعات علوم موجّهة للفجوة المسجّلة وربطها بمؤشر الاعتماد 3-1-1-3.";
  }

  function domainOwner(domain, pack) {
    var actions = (pack.improvement_actions || []).filter(function (row) {
      return row.indicator_code === domain.etec_indicator && row.owner_label;
    });
    if (actions.length) {
      return actions[0].owner_label;
    }
    if (domain.key === "math") {
      return "وكيل الشؤون التعليمية / معلمو الرياضيات";
    }
    if (domain.key === "reading") {
      return "وكيل الشؤون التعليمية / معلمو اللغة العربية";
    }
    return "وكيل الشؤون التعليمية / معلمو العلوم";
  }

  function printRemedialPlan() {
    var pack = state.pack;
    if (!pack || !(pack.domains || []).length) {
      status("حمّل لوحة نافس أولاً.", true);
      return;
    }
    if (!window.PrintEngine || typeof window.PrintEngine.open !== "function") {
      status("محرك الطباعة الموحد غير محمّل.", true);
      return;
    }
    var meta = pack.meta || {};
    var priority = pack.priority_skill || {};
    var domains = pack.domains || [];
    var rows = domains.map(function (row, index) {
      return [
        String(index + 1),
        row.label || "",
        row.etec_indicator || "",
        fmtScore(row.score) + "٪",
        fmtScore(row.target) + "٪",
        fmtGap(row.gap),
        row.weakest_skill
          ? row.weakest_skill +
            (row.weakest_score != null ? " (" + fmtScore(row.weakest_score) + ")" : "")
          : "—",
        domainAction(row, pack),
        domainOwner(row, pack),
        "خلال الفصل الدراسي الحالي"
      ];
    });
    var note =
      "<p class=\"tpl-p\">خطة معالجة مدرسية مستخلصة من بطاقة نافس الحية — " +
      escapeHtml(meta.grade || "") +
      " · مقيدون " +
      escapeHtml(String(meta.enrolled || "—")) +
      " · مختبرون " +
      escapeHtml(String(meta.tested || "—")) +
      " · أولوية المعالجة: " +
      escapeHtml(priority.name || "—") +
      (priority.score != null ? " (" + escapeHtml(fmtScore(priority.score)) + ")" : "") +
      ".</p>" +
      "<p class=\"tpl-p\">الترتيب المعتمد حسب الأولوية والفجوة: الرياضيات/الجبر أولاً، ثم القراءة، ثم العلوم.</p>";

    enrichSignoff().then(function (signCols) {
      window.PrintEngine.open("master-sheet", {
        docTitle: "خطة المعالجة ورفع نواتج التعلم (نافس)",
        title: "خطة المعالجة ورفع نواتج التعلم (نافس)",
        kind: "document",
        fileName: "خطة_المعالجة_ورفع_نواتج_التعلم_نافس",
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
              "المجال",
              "مؤشر الاعتماد",
              "النتيجة",
              "المستهدف",
              "الفجوة",
              "أضعف مهارة",
              "الإجراء التنفيذي",
              "الجهة المنفذة",
              "زمن التنفيذ"
            ],
            rows
          ),
        signoff: true,
        maxColumns: 2,
        signatures: (signCols || []).slice(0, 2)
      });
      status("معاينة خطة المعالجة (نافس) جاهزة.");
    });
  }

  function refresh() {
    var loading = document.getElementById("aj-nafes-loading");
    if (loading) {
      loading.hidden = false;
    }
    status("جارٍ تحميل تحليل نافس…");
    return fetchJson(API, { headers: authHeaders(), cache: "no-store" })
      .then(function (pack) {
        state.pack = pack;
        paint();
        var meta = pack.meta || {};
        var tt = pack.timetable || {};
        status(
          "نافس حي · " +
            (meta.grade || "") +
            " · مختبرون " +
            (meta.tested || "—") +
            " · حصص " +
            (tt.total || 0)
        );
        return pack;
      })
      .catch(function (error) {
        status((error && error.message) || "تعذر تحميل تحليل نافس.", true);
        throw error;
      })
      .finally(function () {
        if (loading) {
          loading.hidden = true;
        }
      });
  }

  function bind() {
    if (state.bound) {
      return;
    }
    state.bound = true;
    var root = document.getElementById("view-nafes");
    if (!root) {
      return;
    }
    root.addEventListener("click", function (event) {
      var t = event.target;
      if (!t || !t.closest) {
        return;
      }
      if (t.closest("#aj-nafs-refresh")) {
        refresh();
        return;
      }
      if (t.closest("#aj-nafs-print-plan")) {
        printRemedialPlan();
      }
    });
  }

  function load() {
    bind();
    return refresh();
  }

  window.AjNafsAnalytics = {
    load: load,
    refresh: refresh,
    printRemedialPlan: printRemedialPlan
  };
})();
