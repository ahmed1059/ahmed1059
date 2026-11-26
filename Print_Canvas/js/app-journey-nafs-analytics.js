/* نواتج التعلم ونافس — الوحدتان 3-أ و 3-ب */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var API = "/api/session/nafs";
  var SCHOOL_NAME = "متوسطة سعد بن الربيع الأنصاري";
  var state = {
    pack: null,
    dossier: null,
    questions: null,
    bound: false,
    whatIf: { math: null, reading: null, science: null },
    bankDomain: "all",
    includeWhatIfInPrint: false,
    misc: null,
    unit2: { matrix: null, weekly: null },
    weekGoal: null,
    etecArchive: null,
    enrichBridge: null,
    honorReport: null
  };

  function formatEtecLtr(code) {
    var raw = toEasternDigits(code == null ? "" : code);
    if (!raw) return "";
    return '<span class="etec-code" dir="ltr">' + escapeHtml(raw) + "</span>";
  }

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

  var EASTERN_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  var CHOICE_AR = { A: "أ", B: "ب", C: "ج", D: "د" };

  function toEasternDigits(text) {
    return String(text == null ? "" : text)
      .replace(/[0-9]/g, function (digit) {
        return EASTERN_DIGITS.charAt(Number(digit));
      })
      .replace(/%/g, "٪");
  }

  function choiceLetterAr(letter) {
    var key = String(letter || "").toUpperCase();
    return CHOICE_AR[key] || key;
  }

  function renderArabicMath(raw) {
    var source = String(raw == null ? "" : raw);
    if (!source) {
      return "";
    }
    var tokens = [];
    function keep(html) {
      tokens.push(html);
      return "\uE000" + (tokens.length - 1) + "\uE001";
    }
    var text = source;
    // كسور اعتيادية: بسط/مقام → عمودي
    text = text.replace(
      /(^|[^\w⁰¹²³⁴⁵⁶⁷⁸⁹])(\d+)\s*\/\s*(\d+)(?!\w)/g,
      function (_m, lead, num, den) {
        return (
          lead +
          keep(
            '<span class="frac"><span class="num">' +
              toEasternDigits(num) +
              '</span><span class="den">' +
              toEasternDigits(den) +
              "</span></span>"
          )
        );
      }
    );
    // أسس بصيغة ^
    text = text.replace(/([0-9٠-٩أ-يA-Za-zسصقع])\^(\d+)/g, function (_m, base, exp) {
      return keep(toEasternDigits(base) + "<sup>" + toEasternDigits(exp) + "</sup>");
    });
    // أسس يونيكود شائعة
    text = text.replace(/([0-9٠-٩أ-يA-Za-zس])([²³⁴⁵⁶⁷⁸⁹⁰¹])/g, function (_m, base, exp) {
      var map = { "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁰": "0" };
      return keep(toEasternDigits(base) + "<sup>" + toEasternDigits(map[exp] || exp) + "</sup>");
    });
    text = text.replace(/\uE000\d+\uE001|[^\uE000]+/g, function (part) {
      if (part.charAt(0) === "\uE000") {
        return part;
      }
      return toEasternDigits(escapeHtml(part));
    });
    text = text.replace(/\uE000(\d+)\uE001/g, function (_m, idx) {
      return tokens[Number(idx)] || "";
    });
    return text;
  }

  function pageLabelAr(page, total) {
    return "الصفحة " + toEasternDigits(page) + " من " + toEasternDigits(total);
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
      return toEasternDigits(value);
    }
    return toEasternDigits(num.toFixed(1));
  }

  function fmtGap(value) {
    if (value == null || value === "") {
      return "—";
    }
    var num = Number(value);
    if (isNaN(num)) {
      return toEasternDigits(value);
    }
    return toEasternDigits((num > 0 ? "+" : "") + num.toFixed(1));
  }

  function etecBand(avg) {
    var n = Number(avg);
    if (!(n >= 0)) {
      return "—";
    }
    if (n < 25) {
      return "١ · التهيئة";
    }
    if (n < 50) {
      return "٢ · الانطلاق";
    }
    if (n < 75) {
      return "٣ · التقدم";
    }
    return "٤ · التميز";
  }

  function domainMap(pack) {
    var map = {};
    ((pack && pack.domains) || []).forEach(function (row) {
      map[row.key] = row;
    });
    return map;
  }

  function currentScores() {
    var map = domainMap(state.pack);
    return {
      math: state.whatIf.math != null ? state.whatIf.math : Number((map.math || {}).score || 0),
      reading:
        state.whatIf.reading != null
          ? state.whatIf.reading
          : Number((map.reading || {}).score || 0),
      science:
        state.whatIf.science != null
          ? state.whatIf.science
          : Number((map.science || {}).score || 0)
    };
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
              return "<td>" + cell + "</td>";
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
      "<table class=\"tpl-master-sheet tpl-data-table aj-nafs-print-table\" style=\"width:100%;border-collapse:collapse;font-size:10.5px;\">" +
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
      toEasternDigits(String(meta.enrolled != null ? meta.enrolled : "—")) +
      " / " +
      toEasternDigits(String(meta.tested != null ? meta.tested : "—")) +
      "</strong></article>" +
      "<article class=\"aj-nafs-card\"><span>متوسط الإتقان</span><strong>" +
      escapeHtml(
        meta.average_mastery_pct != null
          ? toEasternDigits(Number(meta.average_mastery_pct).toFixed(1)) + "٪"
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
          toEasternDigits(escapeHtml(row.etec_indicator || "—")) +
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
    host.innerHTML =
      "<ul>" +
      rows
        .map(function (row) {
          return (
            "<li><strong>" +
            toEasternDigits(escapeHtml(row.code || "")) +
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
    host.innerHTML =
      "<p>إجمالي الحصص المحفوظة: <strong>" +
      escapeHtml(String(tt.total || 0)) +
      "</strong></p>";
  }

  function paintWhatIf() {
    var host = document.getElementById("aj-nafs-whatif");
    if (!host || !state.pack) {
      return;
    }
    var map = domainMap(state.pack);
    ["math", "reading", "science"].forEach(function (key) {
      if (state.whatIf[key] == null && map[key] && map[key].score != null) {
        state.whatIf[key] = Number(map[key].score);
      }
    });
    var scores = currentScores();
    var avg = (scores.math + scores.reading + scores.science) / 3;
    host.innerHTML =
      "<div class=\"aj-nafs-whatif-grid\">" +
      [
        ["math", "الرياضيات"],
        ["reading", "القراءة"],
        ["science", "العلوم"]
      ]
        .map(function (pair) {
          var key = pair[0];
          var label = pair[1];
          var val = scores[key];
          var target = (map[key] || {}).target;
          return (
            "<label class=\"aj-nafs-slider\">" +
            "<span>" +
            escapeHtml(label) +
            " · <strong id=\"aj-nafs-wi-val-" +
            key +
            "\">" +
            escapeHtml(fmtScore(val)) +
            "٪</strong>" +
            (target != null ? " / مستهدف " + escapeHtml(fmtScore(target)) + "٪" : "") +
            "</span>" +
            "<input type=\"range\" min=\"0\" max=\"100\" step=\"0.1\" data-aj-nafs-wi=\"" +
            key +
            "\" value=\"" +
            escapeHtml(String(val)) +
            "\">" +
            "</label>"
          );
        })
        .join("") +
      "</div>" +
      "<p class=\"aj-nafs-whatif-result\">المتوسط العام الجديد: <strong id=\"aj-nafs-wi-avg\">" +
      escapeHtml(toEasternDigits(avg.toFixed(1))) +
      "٪</strong> · التصنيف المتوقع (ETEC): <strong id=\"aj-nafs-wi-band\">" +
      escapeHtml(etecBand(avg)) +
      "</strong></p>" +
      "<label class=\"aj-nafs-check\"><input type=\"checkbox\" id=\"aj-nafs-wi-print\"" +
      (state.includeWhatIfInPrint ? " checked" : "") +
      "> تضمين سيناريو «ماذا لو؟» في الطباعة</label>";
  }

  function updateWhatIfLive() {
    var scores = currentScores();
    var avg = (scores.math + scores.reading + scores.science) / 3;
    ["math", "reading", "science"].forEach(function (key) {
      var el = document.getElementById("aj-nafs-wi-val-" + key);
      if (el) {
        el.textContent = fmtScore(scores[key]) + "٪";
      }
    });
    var avgEl = document.getElementById("aj-nafs-wi-avg");
    var bandEl = document.getElementById("aj-nafs-wi-band");
    if (avgEl) {
      avgEl.textContent = toEasternDigits(avg.toFixed(1)) + "٪";
    }
    if (bandEl) {
      bandEl.textContent = etecBand(avg);
    }
  }

  function domainLabelAr(key) {
    return { math: "الرياضيات", reading: "القراءة", science: "العلوم" }[key] || key;
  }

  function paintBank() {
    var host = document.getElementById("aj-nafs-bank");
    if (!host) {
      return;
    }
    var pack = state.questions || { items: [], counts: {} };
    var items = (pack.items || []).filter(function (row) {
      return state.bankDomain === "all" || row.domain === state.bankDomain;
    });
    var counts = pack.counts || {};
    var titleEl = document.getElementById("aj-nafs-bank-title");
    if (titleEl) {
      titleEl.textContent =
        "بنك أسئلة نافس المصحّح (" +
        toEasternDigits(counts.total || 0) +
        " سؤالاً)";
    }
    host.innerHTML =
      "<div class=\"aj-nafs-bank-filters\" role=\"group\" aria-label=\"تصفية بنك الأسئلة\">" +
      [
        ["all", "الكل (" + toEasternDigits(counts.total || 0) + ")"],
        ["math", "رياضيات (" + toEasternDigits(counts.math || 0) + ")"],
        ["reading", "قراءة (" + toEasternDigits(counts.reading || 0) + ")"],
        ["science", "علوم (" + toEasternDigits(counts.science || 0) + ")"]
      ]
        .map(function (pair) {
          return (
            "<button type=\"button\" class=\"aj-filter" +
            (state.bankDomain === pair[0] ? " is-active" : "") +
            "\" data-aj-nafs-bank=\"" +
            pair[0] +
            "\">" +
            escapeHtml(pair[1]) +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      "<div class=\"aj-nafs-bank-list\">" +
      items
        .map(function (row, index) {
          var choices = row.choices || {};
          return (
            "<article class=\"aj-nafs-q\">" +
            "<header><strong>س" +
            toEasternDigits(String(index + 1)) +
            "</strong> · " +
            escapeHtml(domainLabelAr(row.domain)) +
            " · " +
            escapeHtml(row.skill || "") +
            "</header>" +
            (row.passage_text
              ? "<blockquote class=\"aj-nafs-passage\"><strong>" +
                escapeHtml(row.passage_title || "نص قرائي") +
                "</strong><br>" +
                escapeHtml(row.passage_text) +
                "</blockquote>"
              : "") +
            "<p class=\"aj-nafs-stem\">" +
            renderArabicMath(row.stem || "") +
            "</p>" +
            "<ul class=\"aj-nafs-choices\">" +
            ["A", "B", "C", "D"]
              .map(function (letter) {
                var on = letter === row.correct;
                return (
                  "<li class=\"" +
                  (on ? "is-correct" : "") +
                  "\"><span>" +
                  choiceLetterAr(letter) +
                  "</span> " +
                  renderArabicMath(choices[letter] || "") +
                  (on ? " ✓" : "") +
                  "</li>"
                );
              })
              .join("") +
            "</ul>" +
            "<p class=\"aj-nafs-why\"><strong>التعليل:</strong> " +
            renderArabicMath(row.rationale || "") +
            "</p>" +
            "</article>"
          );
        })
        .join("") +
      (items.length ? "" : "<p class=\"aj-nafs-empty\">لا أسئلة في هذا التصفية.</p>") +
      "</div>";
  }

  function paintWeekGoal() {
    var host = document.getElementById("aj-nafs-week-goal");
    if (!host) return;
    var pack = state.weekGoal || (state.unit2 && state.unit2.weekly) || {};
    var current = pack.current || {};
    host.innerHTML =
      "<div style=\"display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));\">" +
      "<article class=\"aj-nafs-misc-block\" style=\"padding:14px;border:1px solid #fcd34d;border-radius:14px;background:#fffbeb;\">" +
      "<h3 style=\"margin:0 0 8px;color:#0b5e56;font-size:16px;\">هدف المعلمين — الأسبوع " +
      toEasternDigits(pack.current_week || current.week || "—") +
      "</h3>" +
      "<p style=\"margin:0;line-height:1.7;font-weight:700;\">" +
      escapeHtml(pack.teacher_goal || current.teacher_goal || "—") +
      "</p>" +
      (current.mock_label
        ? "<p style=\"margin:8px 0 0;color:#9a3412;font-size:13px;\">محاكاة مرحلية: " +
          escapeHtml(current.mock_label) +
          "</p>"
        : "") +
      "</article>" +
      "<article class=\"aj-nafs-misc-block\" style=\"padding:14px;border:1px solid #b7e4d8;border-radius:14px;background:#f3faf7;\">" +
      "<h3 style=\"margin:0 0 8px;color:#0b5e56;font-size:16px;\">هدف الطلاب</h3>" +
      "<p style=\"margin:0;line-height:1.7;font-weight:700;\">" +
      escapeHtml(pack.student_goal || current.student_goal || "—") +
      "</p>" +
      "<p style=\"margin:8px 0 0;font-size:12px;color:#0b5e56;direction:ltr;unicode-bidi:isolate;\">" +
      escapeHtml(current.barcode || "") +
      "</p></article></div>" +
      "<p class=\"aj-nafs-empty\" style=\"margin:10px 0 0;\">يُبث تلقائياً من محرك الجدولة الثماني — بلا تعديل يدوي أسبوعي.</p>";
  }

  function paintEtecArchive() {
    var host = document.getElementById("aj-nafs-etec-archive");
    if (!host) return;
    var pack = state.etecArchive;
    if (!pack) {
      host.innerHTML = "<p class=\"aj-nafs-empty\">اضغط «أرشفة شواهد ETEC الآن» أو حدّث التحليل لعرض الملخص.</p>";
      return;
    }
    var s = pack.summary || {};
    var inds = pack.indicators || {};
    host.innerHTML =
      "<div class=\"aj-nafs-summary\" style=\"margin-bottom:12px;\">" +
      "<article class=\"aj-nafs-card\"><span>جولات نافس</span><strong>" +
      toEasternDigits(s.nafs_runs_total_ar || s.nafs_runs_total || 0) +
      "</strong></article>" +
      "<article class=\"aj-nafs-card\"><span>آخر ٧ أيام</span><strong>" +
      toEasternDigits(s.nafs_runs_week_ar || s.nafs_runs_week || 0) +
      "</strong></article>" +
      "<article class=\"aj-nafs-card\"><span>متوسط</span><strong>" +
      toEasternDigits(s.avg_score_ar || s.avg_score || 0) +
      "٪</strong></article>" +
      "<article class=\"aj-nafs-card is-priority\"><span>vault مفتوح</span><strong>" +
      toEasternDigits(s.vault_open_ar || s.vault_open || 0) +
      "</strong></article>" +
      "<article class=\"aj-nafs-card\"><span>عيادات</span><strong>" +
      toEasternDigits(s.clinics_open_ar || s.clinics_open || 0) +
      "</strong></article>" +
      "</div>" +
      Object.keys(inds)
        .map(function (code) {
          var b = inds[code] || {};
          var metrics = [];
          if (b.vault_open_ar != null) metrics.push("تعثر " + toEasternDigits(b.vault_open_ar));
          if (b.vault_recovered_ar != null) metrics.push("مستعاد " + toEasternDigits(b.vault_recovered_ar));
          if (b.pledges_ar != null) metrics.push("تعهدات " + toEasternDigits(b.pledges_ar));
          if (b.omr_ack_ar != null) metrics.push("OMR " + toEasternDigits(b.omr_ack_ar));
          if (b.qodwa_ar != null) metrics.push("قدوة " + toEasternDigits(b.qodwa_ar));
          if (b.rifq_ar != null) metrics.push("رفق " + toEasternDigits(b.rifq_ar));
          return (
            "<article class=\"aj-nafs-misc-block\" style=\"margin:0 0 10px;padding:12px;border:1px solid #d7e8e3;border-radius:14px;background:#fff;\">" +
            "<h3 style=\"margin:0 0 6px;color:#0b5e56;font-size:15px;\">" +
            formatEtecLtr(b.code_ar || code) +
            " — " +
            escapeHtml(b.label || "") +
            "</h3>" +
            "<p style=\"margin:0;font-size:13px;\">" +
            escapeHtml(metrics.join(" · ") || "لا مقاييس بعد") +
            "</p>" +
            "<p style=\"margin:6px 0 0;font-size:12px;color:#5c675f;\">المصادر: " +
            escapeHtml((b.sources || []).join(" · ")) +
            "</p></article>"
          );
        })
        .join("") +
      "<p style=\"margin:8px 0 0;font-size:12px;direction:ltr;unicode-bidi:isolate;color:#0b5e56;font-weight:800;\">" +
      escapeHtml(pack.barcode_master || "") +
      "</p>";
  }

  function paintUnit2() {
    var host = document.getElementById("aj-nafs-unit2");
    if (!host) {
      return;
    }
    var weekly = (state.unit2 && state.unit2.weekly) || {};
    var matrix = ((state.unit2 && state.unit2.matrix) || {}).matrix || {};
    var current = weekly.current || {};
    var weeks = weekly.weeks || [];
    var matrixHtml = ["math", "science", "reading"]
      .map(function (key) {
        var block = matrix[key] || {};
        var skills = block.skills || [];
        return (
          "<article class=\"aj-nafs-misc-block\" style=\"margin:0 0 12px;padding:12px;border:1px solid #d7e8e3;border-radius:14px;background:#fff;\">" +
          "<h3 style=\"margin:0 0 8px;color:#0b5e56;font-size:15px;\">" +
          escapeHtml(block.label || key) +
          " · " +
          formatEtecLtr(block.etec || "") +
          "</h3>" +
          "<ul style=\"margin:0;padding:0 16px 0 0;\">" +
          skills
            .map(function (sk) {
              return (
                "<li>" +
                escapeHtml(sk.name || "") +
                " — الجذر " +
                escapeHtml(sk.root || "") +
                " · الصف " +
                escapeHtml(sk.grade || "") +
                "</li>"
              );
            })
            .join("") +
          "</ul></article>"
        );
      })
      .join("");
    host.innerHTML =
      "<div style=\"margin:0 0 14px;padding:14px;border:1px solid #fcd34d;border-radius:14px;background:#fffbeb;\">" +
      "<strong>الأسبوع التشغيلي الحالي: " +
      toEasternDigits(weekly.current_week || current.week || "—") +
      "</strong>" +
      "<p style=\"margin:6px 0 0;\">التركيز: " +
      escapeHtml(current.focus || "—") +
      " · شاهد: " +
      escapeHtml(current.evidence || "—") +
      "</p>" +
      (weekly.teacher_goal
        ? "<p style=\"margin:8px 0 0;font-size:13px;\"><strong>هدف المعلمين:</strong> " +
          escapeHtml(weekly.teacher_goal) +
          "</p>"
        : "") +
      (weekly.student_goal
        ? "<p style=\"margin:4px 0 0;font-size:13px;\"><strong>هدف الطلاب:</strong> " +
          escapeHtml(weekly.student_goal) +
          "</p>"
        : "") +
      "</div>" +
      "<div style=\"overflow:auto;\"><table class=\"tpl-data-table\" style=\"width:100%;border-collapse:collapse;font-size:13px;\">" +
      "<thead><tr><th>أسبوع</th><th>التركيز</th><th>رياضيات</th><th>علوم</th><th>قراءة</th><th>الشاهد</th></tr></thead><tbody>" +
      weeks
        .map(function (w) {
          var on = Number(w.week) === Number(weekly.current_week);
          return (
            "<tr" +
            (on ? " style=\"background:#ecfdf5;font-weight:700;\"" : "") +
            "><td>" +
            toEasternDigits(w.week) +
            "</td><td>" +
            escapeHtml(w.focus || "") +
            "</td><td>" +
            escapeHtml(w.math || "") +
            "</td><td>" +
            escapeHtml(w.science || "") +
            "</td><td>" +
            escapeHtml(w.reading || "") +
            "</td><td>" +
            escapeHtml(w.evidence || "") +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>" +
      "<h3 style=\"margin:16px 0 8px;color:#0b5e56;font-size:16px;\">مصفوفة المهارات التراكمية (١م–٣م)</h3>" +
      matrixHtml;
  }

  function downloadDocx(kind) {
    var user = sessionUser() || {};
    var url = API + "/export-docx?kind=" + encodeURIComponent(kind || "weekly");
    status("جارٍ تجهيز ملف Word…");
    return fetch(url, { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          return response.json().then(function (body) {
            throw new Error((body && body.detail) || "تعذر التصدير");
          });
        }
        return response.blob();
      })
      .then(function (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "nafs_" + (kind || "weekly") + ".docx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        status("تم تنزيل ملف Word الرسمي.");
      })
      .catch(function (error) {
        status((error && error.message) || "تعذر تصدير Word.", true);
      });
  }

  function paintMisc() {
    var host = document.getElementById("aj-nafs-misc");
    if (!host) {
      return;
    }
    var pack = state.misc || { top: {}, indicators: {} };
    var top = pack.top || {};
    var indicators = pack.indicators || {};
    host.innerHTML = ["math", "reading", "science"]
      .map(function (domain) {
        var ind = indicators[domain] || {};
        var rows = top[domain] || [];
        return (
          "<article class=\"aj-nafs-misc-block\" style=\"margin:0 0 14px;padding:14px;border:1px solid #d7e8e3;border-radius:14px;background:#fafcfb;\">" +
          "<h3 style=\"margin:0 0 8px;color:#0b5e56;font-size:16px;\">" +
          toEasternDigits(escapeHtml(ind.code || "")) +
          " — " +
          escapeHtml(ind.label || domainLabelAr(domain)) +
          "</h3>" +
          (rows.length
            ? "<ol style=\"margin:0;padding:0 18px 0 0;\">" +
              rows
                .map(function (row, idx) {
                  return (
                    "<li style=\"margin:0 0 10px;\"><strong>" +
                    toEasternDigits(idx + 1) +
                    ". " +
                    escapeHtml(row.skill || "") +
                    "</strong> — " +
                    toEasternDigits(String(row.pct || 0)) +
                    "٪ · جذر " +
                    escapeHtml(row.grade_root || "") +
                    "<br><span style=\"color:#8a3b32;\">الفخ: " +
                    escapeHtml(row.common_mistake || "") +
                    "</span><br><span style=\"color:#0b5e56;\">القاعدة: " +
                    escapeHtml(row.golden_rule || "") +
                    "</span><br>" +
                    "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary\" data-aj-nafs-trap-sheet=\"" +
                    escapeHtml(domain) +
                    "|" +
                    escapeHtml(row.skill || "") +
                    "\">توليد ورقة علاجية مركّزة لهذا الفخ</button></li>"
                  );
                })
                .join("") +
              "</ol>"
            : "<p class=\"portal-empty\">لا أحداث مسجّلة بعد — تُعرض المهارات الأعلى من البنك.</p>") +
          "</article>"
        );
      })
      .join("");
  }

  function printTrapSheet(domain, skill) {
    if (!window.PrintEngine || typeof window.PrintEngine.open !== "function") {
      status("محرك الطباعة الموحد غير محمّل.", true);
      return;
    }
    var rows = ((state.misc || {}).top || {})[domain] || [];
    var hit = rows.filter(function (r) {
      return r.skill === skill;
    })[0] || { skill: skill, common_mistake: "", golden_rule: "", grade_root: "" };
    var ind = ((state.misc || {}).indicators || {})[domain] || {};
    var body =
      "<h2 style=\"color:#0b5e56;\">ورقة علاجية مركّزة — " +
      escapeHtml(ind.code || "") +
      "</h2>" +
      "<p><strong>المهارة:</strong> " +
      escapeHtml(hit.skill || "") +
      " · <strong>الجذر التراكمي:</strong> " +
      escapeHtml(hit.grade_root || "") +
      "</p>" +
      "<p><strong>الفخ الشائع:</strong> " +
      escapeHtml(hit.common_mistake || "") +
      "</p>" +
      "<p><strong>القاعدة الذهبية:</strong> " +
      escapeHtml(hit.golden_rule || "") +
      "</p>" +
      "<p>نشاط صفّي: ٣ مسائل نظيرة + تحقق ثنائي + قياس بعدي قصير (٥ دقائق).</p>" +
      "<p>يُوثَّق التحسّن كشاهد في المؤشر " +
      escapeHtml(ind.code || "") +
      ".</p>";
    window.PrintEngine.open("master-sheet", {
      docTitle: "ورقة علاجية لفخ مفاهيمي",
      title: "ورقة علاجية مركّزة للمفاهيم المغلوطة",
      kind: "document",
      orientation: "portrait",
      school: SCHOOL_NAME,
      bodyHtml: body,
      signoff: true,
      maxColumns: 2,
      pageTotal: 1
    });
    status("وُلدت الورقة العلاجية المركّزة للفخ.");
  }

  function printNationalOmr() {
    if (!window.PrintEngine || typeof window.PrintEngine.open !== "function") {
      status("محرك الطباعة الموحد غير محمّل.", true);
      return;
    }
    status("جارٍ تجهيز كراسة المحاكاة وورقة OMR…");
    fetchJson(API + "/national-pack", { headers: authHeaders(), cache: "no-store" })
      .then(function (pack) {
        var letters = { A: "أ", B: "ب", C: "ج", D: "د" };
        var n = 0;
        var booklet = "";
        var keyRows = [];
        ["math", "science", "reading"].forEach(function (domain) {
          var block = (pack.domains || {})[domain] || { items: [], label: domain };
          booklet +=
            "<h2 style=\"color:#0b5e56;font-size:15px;\">" +
            escapeHtml(block.label || domain) +
            " (" +
            toEasternDigits(22) +
            ")</h2>";
          (block.items || []).forEach(function (item) {
            n += 1;
            booklet +=
              "<p style=\"margin:8px 0;\"><strong>" +
              toEasternDigits(n) +
              ".</strong> " +
              escapeHtml(item.stem || "") +
              "<br>" +
              ["A", "B", "C", "D"]
                .map(function (L) {
                  return (
                    "<span style=\"margin-left:12px;\">" +
                    letters[L] +
                    ") " +
                    escapeHtml((item.choices || {})[L] || "") +
                    "</span>"
                  );
                })
                .join(" ") +
              "</p>";
            keyRows.push([toEasternDigits(n), letters[item.correct] || item.correct, escapeHtml(item.skill || "")]);
          });
        });
        var omr =
          "<h2 style=\"color:#0b5e56;\">ورقة التظليل الضوئي (OMR) — ٦٦ بنداً</h2>" +
          "<p>ظلّل الحرف الصحيح لكل سؤال. لا تستخدم قلماً رصاصياً خفيفاً.</p>" +
          "<div style=\"display:grid;grid-template-columns:repeat(6,1fr);gap:6px;\">" +
          Array.from({ length: 66 })
            .map(function (_x, i) {
              return (
                "<div style=\"border:1px solid #ccc;padding:6px;font-size:12px;\">" +
                toEasternDigits(i + 1) +
                "<br>أ ○ ب ○ ج ○ د ○</div>"
              );
            })
            .join("") +
          "</div>";
        var keyHtml =
          "<h2 style=\"color:#0b5e56;\">مفتاح التصحيح المعتمد</h2>" +
          tableHtml(["رقم السؤال", "الإجابة", "المهارة"], keyRows);
        window.PrintEngine.open("master-sheet", {
          docTitle: "المحاكاة الوطنية الشاملة",
          title: "كراسة المحاكاة الوطنية + OMR + مفتاح التصحيح",
          kind: "document",
          orientation: "portrait",
          multiPage: true,
          school: SCHOOL_NAME,
          bodyHtml: booklet + "<div style=\"page-break-before:always\"></div>" + omr + "<div style=\"page-break-before:always\"></div>" + keyHtml,
          signoff: true,
          maxColumns: 2,
          pageTotal: 3
        });
        status("معاينة المحاكاة الوطنية (كراسة + OMR + مفتاح) جاهزة.");
      })
      .catch(function (error) {
        status((error && error.message) || "تعذر تجهيز حزمة المحاكاة.", true);
      });
  }

  function paint() {
    var pack = state.pack || {};
    paintSummary(pack);
    paintDomains(pack);
    paintIndicators(pack);
    paintActions(pack);
    paintTimetable(pack);
    paintWhatIf();
    paintBank();
    paintWeekGoal();
    paintEtecArchive();
    paintEnrichBridge();
    paintUnit2();
    paintMisc();
  }

  function paintEnrichBridge() {
    var host = document.getElementById("aj-nafs-enrich-bridge");
    if (!host) return;
    var pack = state.enrichBridge;
    if (!pack) {
      host.innerHTML =
        "<p class=\"aj-nafs-empty\">اضغط «تحديث جسر الإثراء والموهبة» لاشتقاق المرشحين من نافس.</p>";
      return;
    }
    var tracks = pack.tracks || {};
    var grouped = pack.grouped || {};
    var s = pack.summary_ar || pack.summary || {};
    host.innerHTML =
      "<div class=\"aj-nafs-summary\" style=\"margin-bottom:12px;\">" +
      Object.keys(tracks)
        .map(function (k) {
          var t = tracks[k] || {};
          return (
            "<article class=\"aj-nafs-card\"><span>" +
            escapeHtml(t.label || k) +
            "</span><strong>" +
            toEasternDigits(s[k] || 0) +
            "</strong><small style=\"display:block;margin-top:4px;\">" +
            formatEtecLtr(t.etec_ar || t.etec || "") +
            "</small></article>"
          );
        })
        .join("") +
      "</div>" +
      Object.keys(tracks)
        .map(function (k) {
          var t = tracks[k] || {};
          var rows = grouped[k] || [];
          return (
            "<article class=\"aj-nafs-misc-block\" style=\"margin:0 0 12px;padding:12px;border:1px solid #d7e8e3;border-radius:14px;background:#fff;\">" +
            "<h3 style=\"margin:0 0 8px;color:#0b5e56;font-size:15px;\">" +
            escapeHtml(t.label || k) +
            " · " +
            formatEtecLtr(t.etec_ar || t.etec || "") +
            "</h3>" +
            (rows.length
              ? "<ol style=\"margin:0;padding:0 18px 0 0;\">" +
                rows
                  .slice(0, 8)
                  .map(function (row) {
                    return (
                      "<li><strong>" +
                      escapeHtml(row.name || "") +
                      "</strong> — " +
                      toEasternDigits(row.score_ar || row.score || 0) +
                      " · " +
                      escapeHtml(row.section || "") +
                      "<br><span style=\"color:#5c675f;font-size:12px;\">" +
                      escapeHtml(row.reason || "") +
                      "</span></li>"
                    );
                  })
                  .join("") +
                "</ol>"
              : "<p class=\"aj-nafs-empty\">لا مرشحين في هذا المسار بعد.</p>") +
            "</article>"
          );
        })
        .join("");
  }

  function refreshEnrichBridge() {
    return fetchJson(API + "/enrich-bridge/refresh", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({ limit_students: 150 })
    }).then(function (pack) {
      state.enrichBridge = pack.pack || pack;
      paintEnrichBridge();
      status(
        "جسر الإثراء: " +
          toEasternDigits((pack.written || 0)) +
          " ترشيحاً من " +
          toEasternDigits(pack.scanned || 0) +
          " طالباً نشطاً."
      );
      return pack;
    });
  }

  function printHonorReport() {
    return fetchJson(API + "/honor-report", { headers: authHeaders(), cache: "no-store" }).then(
      function (pack) {
        state.honorReport = pack;
        if (!window.PrintEngine || typeof window.PrintEngine.open !== "function") {
          status("محرك الطباعة الموحد غير محمّل.", true);
          return pack;
        }
        var boards = pack.boards || {};
        function ol(title, rows, mapFn) {
          rows = rows || [];
          return (
            "<h3 style=\"color:#0b5e56;\">" +
            escapeHtml(title) +
            "</h3><ol>" +
            rows
              .slice(0, 10)
              .map(function (r, i) {
                return "<li>" + escapeHtml(mapFn(r, i)) + "</li>";
              })
              .join("") +
            "</ol>"
          );
        }
        var body =
          "<h2 style=\"text-align:center;color:#0b5e56;\">" +
          escapeHtml(pack.title || "") +
          "</h2>" +
          "<p style=\"text-align:center;\">" +
          escapeHtml((pack.school && pack.school.name) || SCHOOL_NAME) +
          " (" +
          toEasternDigits((pack.school && pack.school.stat_no) || "40341") +
          ")</p>" +
          ol("أبطال اليوم", boards.day, function (r) {
            return (r.name || "") + " — " + toEasternDigits(r.xp_ar || r.xp || 0) + " XP";
          }) +
          ol("فرسان الأسبوع", boards.week, function (r) {
            return (r.name || "") + " — " + toEasternDigits(r.xp_ar || r.xp || 0) + " XP";
          }) +
          ol("دوري الفصول", boards.classes_week, function (r) {
            return (r.label || "") + " — " + toEasternDigits(r.xp_ar || r.xp || 0) + " XP";
          }) +
          ol("نخبة الصف", boards.elite_class, function (r) {
            return (
              (r.name || "") +
              " · فصل " +
              (r.section || "") +
              " — المركز " +
              toEasternDigits(r.place_ar || r.place || "") +
              " · " +
              toEasternDigits(r.xp_ar || r.xp || 0) +
              " XP"
            );
          }) +
          "<p style=\"text-align:center;direction:ltr;unicode-bidi:isolate;font-weight:800;color:#0b5e56;\">" +
          escapeHtml(pack.barcode || "") +
          "</p>";
        window.PrintEngine.open("master-sheet", {
          docTitle: pack.title || "تقرير التتويج",
          title: pack.title || "تقرير منصات التتويج",
          kind: "document",
          orientation: "portrait",
          school: SCHOOL_NAME,
          bodyHtml: body,
          signoff: true,
          maxColumns: 2,
          pageTotal: 1,
          fileName: "تقرير_التتويج_والبرامج_النوعية"
        });
        status("معاينة تقرير التتويج والبرامج جاهزة.");
        return pack;
      }
    );
  }

  function loadEtecArchive() {
    return fetchJson(API + "/etec-archive", { headers: authHeaders(), cache: "no-store" }).then(
      function (pack) {
        state.etecArchive = pack;
        if (pack.week_goal) {
          state.weekGoal = Object.assign({}, pack.week_goal, {
            teacher_goal: pack.week_goal.teacher_goal,
            student_goal: pack.week_goal.student_goal,
            current: pack.week_goal.current,
            current_week: pack.week_goal.current_week
          });
        }
        paintWeekGoal();
        paintEtecArchive();
        return pack;
      }
    );
  }

  function refreshEtecArchive() {
    return fetchJson(API + "/etec-archive/refresh", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({ note: "أرشفة فورية من لوحة نافس" })
    }).then(function (pack) {
      state.etecArchive = pack.pack || pack;
      paintEtecArchive();
      status(
        "أُرشف " +
          toEasternDigits((pack.written || []).length || pack.count || 0) +
          " ملخص مؤشر في شواهد الاعتماد."
      );
      return pack;
    });
  }

  function printWeekGoalA4() {
    if (!window.PrintEngine || typeof window.PrintEngine.open !== "function") {
      status("محرك الطباعة الموحد غير محمّل.", true);
      return;
    }
    var pack = state.weekGoal || (state.unit2 && state.unit2.weekly) || {};
    var current = pack.current || {};
    var body =
      "<h2 style=\"color:#0b5e56;text-align:center;\">هدف الأسبوع التشغيلي</h2>" +
      "<p style=\"text-align:center;\">الأسبوع " +
      toEasternDigits(pack.current_week || current.week || "") +
      " · " +
      escapeHtml(SCHOOL_NAME) +
      " (" +
      toEasternDigits("40341") +
      ")</p>" +
      "<section style=\"margin:14px 0;padding:12px;border:1px solid #fcd34d;border-radius:12px;background:#fffbeb;\">" +
      "<h3 style=\"color:#0b5e56;margin:0 0 8px;\">هدف المعلمين</h3>" +
      "<p style=\"margin:0;line-height:1.7;\">" +
      escapeHtml(pack.teacher_goal || current.teacher_goal || "") +
      "</p></section>" +
      "<section style=\"margin:14px 0;padding:12px;border:1px solid #b7e4d8;border-radius:12px;background:#f3faf7;\">" +
      "<h3 style=\"color:#0b5e56;margin:0 0 8px;\">هدف الطلاب</h3>" +
      "<p style=\"margin:0;line-height:1.7;\">" +
      escapeHtml(pack.student_goal || current.student_goal || "") +
      "</p></section>" +
      "<p><strong>التركيز:</strong> " +
      escapeHtml(current.focus || "") +
      " · <strong>الشاهد:</strong> " +
      escapeHtml(current.evidence || "") +
      "</p>" +
      "<p style=\"direction:ltr;unicode-bidi:isolate;text-align:center;font-weight:800;color:#0b5e56;\">" +
      escapeHtml(current.barcode || "") +
      "</p>";
    window.PrintEngine.open("master-sheet", {
      docTitle: "هدف الأسبوع التشغيلي",
      title: "هدف الأسبوع — نافس",
      kind: "document",
      orientation: "portrait",
      school: SCHOOL_NAME,
      bodyHtml: body,
      signoff: true,
      maxColumns: 2,
      pageTotal: 1,
      fileName: "هدف_الاسبوع_نافس"
    });
    status("معاينة هدف الأسبوع A4 جاهزة.");
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
        "» ومتابعة أسبوعية حتى ردم فجوة المستهدف."
      );
    }
    if (domain.key === "reading") {
      return "خطة قراءة صفية مكثّفة وربطها بمؤشر الاعتماد ٣-١-١-١ مع قياس بعدي نصف فصلي.";
    }
    return "مراجعات علوم موجّهة للفجوة المسجّلة وربطها بمؤشر الاعتماد ٣-١-١-٣.";
  }

  function domainOwner(domain, pack) {
    var actions = (pack.improvement_actions || []).filter(function (row) {
      return row.indicator_code === domain.etec_indicator && row.owner_label;
    });
    if (actions.length) {
      return actions[0].owner_label;
    }
    return "وكيل الشؤون التعليمية / معلمو المجال";
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
    var rows = (pack.domains || []).map(function (row, index) {
      return [
        escapeHtml(String(index + 1)),
        escapeHtml(row.label || ""),
        escapeHtml(row.etec_indicator || ""),
        escapeHtml(fmtScore(row.score) + "٪"),
        escapeHtml(fmtScore(row.target) + "٪"),
        escapeHtml(fmtGap(row.gap)),
        escapeHtml(
          row.weakest_skill
            ? row.weakest_skill +
                (row.weakest_score != null ? " (" + fmtScore(row.weakest_score) + ")" : "")
            : "—"
        ),
        escapeHtml(domainAction(row, pack)),
        escapeHtml(domainOwner(row, pack)),
        escapeHtml("خلال الفصل الدراسي الحالي")
      ];
    });
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
          "<p class=\"tpl-p\">خطة معالجة مدرسية — " +
          escapeHtml(meta.grade || "") +
          " · مقيدون " +
          escapeHtml(String(meta.enrolled || "—")) +
          " · مختبرون " +
          escapeHtml(String(meta.tested || "—")) +
          " · أولوية: " +
          escapeHtml(priority.name || "—") +
          ".</p>" +
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

  function barChartSvg(domains) {
    var width = 520;
    var height = 220;
    var pad = 36;
    var groupW = (width - pad * 2) / Math.max(domains.length, 1);
    var bars = "";
    domains.forEach(function (row, i) {
      var x0 = pad + i * groupW;
      var score = Number(row.score || 0);
      var target = Number(row.target || 0);
      var hScore = (score / 100) * (height - pad * 2);
      var hTarget = (target / 100) * (height - pad * 2);
      var base = height - pad;
      bars +=
        "<rect x=\"" +
        (x0 + 18) +
        "\" y=\"" +
        (base - hScore) +
        "\" width=\"28\" height=\"" +
        hScore +
        "\" fill=\"#0b5e56\"/>" +
        "<rect x=\"" +
        (x0 + 52) +
        "\" y=\"" +
        (base - hTarget) +
        "\" width=\"28\" height=\"" +
        hTarget +
        "\" fill=\"#7aa8a1\"/>" +
        "<text x=\"" +
        (x0 + groupW / 2) +
        "\" y=\"" +
        (height - 12) +
        "\" text-anchor=\"middle\" font-size=\"11\" fill=\"#24312c\">" +
        escapeHtml(row.label || "") +
        "</text>" +
        "<text x=\"" +
        (x0 + 32) +
        "\" y=\"" +
        (base - hScore - 4) +
        "\" text-anchor=\"middle\" font-size=\"10\" fill=\"#0b5e56\">" +
        escapeHtml(fmtScore(score)) +
        "</text>";
    });
    return (
      "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100%\" viewBox=\"0 0 " +
      width +
      " " +
      height +
      "\" class=\"aj-nafs-svg\">" +
      "<rect width=\"" +
      width +
      "\" height=\"" +
      height +
      "\" fill=\"#fff\"/>" +
      "<line x1=\"" +
      pad +
      "\" y1=\"" +
      (height - pad) +
      "\" x2=\"" +
      (width - pad) +
      "\" y2=\"" +
      (height - pad) +
      "\" stroke=\"#9db8b2\"/>" +
      bars +
      "<text x=\"" +
      pad +
      "\" y=\"18\" font-size=\"12\" fill=\"#0b5e56\">■ حي (SSOT)  ■ مستهدف</text>" +
      "</svg>"
    );
  }

  function radarSvg(skills, tracks) {
    var cx = 160;
    var cy = 130;
    var r = 90;
    var n = Math.max(skills.length, 1);
    var pts = skills.map(function (skill, i) {
      var ang = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
      var score = Number(skill.score || 0);
      var rr = (Math.max(0, Math.min(100, score)) / 100) * r;
      return [cx + rr * Math.cos(ang), cy + rr * Math.sin(ang), skill, ang];
    });
    var poly = pts
      .map(function (p) {
        return p[0].toFixed(1) + "," + p[1].toFixed(1);
      })
      .join(" ");
    var axes = pts
      .map(function (p) {
        var ang = p[3];
        var x = cx + r * Math.cos(ang);
        var y = cy + r * Math.sin(ang);
        var lx = cx + (r + 22) * Math.cos(ang);
        var ly = cy + (r + 22) * Math.sin(ang);
        return (
          "<line x1=\"" +
          cx +
          "\" y1=\"" +
          cy +
          "\" x2=\"" +
          x +
          "\" y2=\"" +
          y +
          "\" stroke=\"#c9d7d3\"/>" +
          "<text x=\"" +
          lx +
          "\" y=\"" +
          ly +
          "\" text-anchor=\"middle\" font-size=\"10\" fill=\"#24312c\">" +
          escapeHtml((p[2].name || "") + " " + fmtScore(p[2].score)) +
          "</text>"
        );
      })
      .join("");
    return (
      "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100%\" viewBox=\"0 0 320 270\" class=\"aj-nafs-svg\">" +
      "<circle cx=\"" +
      cx +
      "\" cy=\"" +
      cy +
      "\" r=\"" +
      r +
      "\" fill=\"none\" stroke=\"#c9d7d3\"/>" +
      axes +
      "<polygon points=\"" +
      poly +
      "\" fill=\"rgba(11,94,86,0.25)\" stroke=\"#0b5e56\" stroke-width=\"2\"/>" +
      "<text x=\"160\" y=\"258\" text-anchor=\"middle\" font-size=\"11\" fill=\"#5c675f\">مسار علاجي " +
      escapeHtml(String((tracks && tracks.remedial) || "—")) +
      " · إثرائي " +
      escapeHtml(String((tracks && tracks.enrichment) || "—")) +
      " من " +
      escapeHtml(String((tracks && tracks.tested) || "—")) +
      "</text></svg>"
    );
  }

  function pageBreak() {
    return "<div class=\"aj-nafs-page-break\" style=\"page-break-before:always;break-before:page;height:0;\"></div>";
  }

  function pageFoot(page, total) {
    return (
      "<div class=\"aj-nafs-page-foot\">" + escapeHtml(pageLabelAr(page, total)) + "</div>"
    );
  }

  function wrapPrintPage(pageNum, total, innerHtml) {
    return (
      "<section class=\"aj-nafs-print-page\" data-page=\"" +
      pageNum +
      "\">" +
      innerHtml +
      pageFoot(pageNum, total) +
      "</section>"
    );
  }

  function buildRecordHtml(dossier, signNote) {
    var analytics = dossier.analytics || {};
    var domains = analytics.domains || [];
    var meta = analytics.meta || {};
    var school = dossier.school || {};
    var skills = (dossier.skills_matrix && dossier.skills_matrix.priority_skills) || [];
    var committee = dossier.achievement_committee || [];
    var teachers = dossier.nafs_teachers || [];
    var challenges = dossier.challenges || [];
    var samples = dossier.sample_questions || [];
    var totalPages = 7;
    var initiativesLine = (dossier.initiatives || ["قارئ الحصيف", "تحدي الأرقام", "قدوة", "رفق"]).join(
      " - "
    );
    var weeks = Number(dossier.weeks || 18);
    var weekRows = [];
    var i;
    for (i = 1; i <= weeks; i += 1) {
      var mocks = dossier.mocks || [];
      var mockName = mocks[Math.min(mocks.length - 1, Math.max(0, i - 11))] || "Mock";
      var focus =
        i <= 4
          ? "تشخيص ومعالجة الجبر/القراءة"
          : i <= 10
            ? "مبادرات قارئ الحصيف وتحدي الأرقام"
            : i <= 14
              ? "محاكاة " + mockName
              : "تكثيف ما قبل نافذة " + (dossier.exam_window || "");
      weekRows.push([
        toEasternDigits(String(i)),
        escapeHtml(focus),
        "<span class=\"aj-nafs-init-cell\">" + escapeHtml(initiativesLine) + "</span>",
        escapeHtml(
          i % 4 === 0
            ? "Mock " + toEasternDigits(Math.min(4, Math.ceil(i / 4)))
            : "متابعة صفية"
        )
      ]);
    }
    var whatIfBlock = "";
    if (state.includeWhatIfInPrint) {
      var sc = currentScores();
      var avg = (sc.math + sc.reading + sc.science) / 3;
      whatIfBlock =
        "<p class=\"tpl-p\"><strong>سيناريو ماذا لو؟</strong> رياضيات " +
        escapeHtml(fmtScore(sc.math)) +
        "٪ · قراءة " +
        escapeHtml(fmtScore(sc.reading)) +
        "٪ · علوم " +
        escapeHtml(fmtScore(sc.science)) +
        "٪ · متوسط " +
        escapeHtml(toEasternDigits(avg.toFixed(1))) +
        "٪ · تصنيف " +
        escapeHtml(etecBand(avg)) +
        ".</p>";
    }

    var page1 = wrapPrintPage(
      1,
      totalPages,
      "<h2 style=\"color:#0b5e56;font-size:18px;margin:0 0 6px;\">سجل نافس المدرسي المتكامل</h2>" +
        "<p class=\"tpl-p\">" +
        escapeHtml(school.name || SCHOOL_NAME) +
        " (" +
        toEasternDigits(school.code || "40341") +
        ") — " +
        escapeHtml(meta.grade || "الثالث المتوسط") +
        " · مقيدون " +
        toEasternDigits(String(meta.enrolled != null ? meta.enrolled : "—")) +
        " / مختبرون " +
        toEasternDigits(String(meta.tested != null ? meta.tested : "—")) +
        " · متوسط الإتقان " +
        (meta.average_mastery_pct != null
          ? toEasternDigits(Number(meta.average_mastery_pct).toFixed(1)) + "٪"
          : "—") +
        ".</p>" +
        whatIfBlock +
        "<h3 style=\"color:#0b5e56;font-size:14px;\">مقارنة الأداء الحي والمستهدف</h3>" +
        barChartSvg(domains) +
        "<h3 style=\"color:#0b5e56;font-size:14px;\">رادار الأولوية المهارية وتوزيع المسارات</h3>" +
        radarSvg(skills, dossier.tracks) +
        "<h3 style=\"color:#0b5e56;font-size:14px;\">مؤشرات الاعتماد</h3>" +
        "<ul>" +
        (analytics.indicators || [])
          .map(function (row) {
            return (
              "<li><strong>" +
              toEasternDigits(row.code) +
              "</strong> — " +
              escapeHtml(row.domain_label) +
              ": " +
              escapeHtml(row.statement || "") +
              "</li>"
            );
          })
          .join("") +
        "</ul>"
    );

    var page2 =
      pageBreak() +
      wrapPrintPage(
        2,
        totalPages,
        "<h2 style=\"color:#0b5e56;font-size:16px;\">القرار الإداري وتشكيل لجنة التحصيل / فريق نافس</h2>" +
          "<p class=\"tpl-p\">يُعتمد تشغيل محطة نافس تحت إشراف وكيل الشؤون التعليمية، بربط مباشر بمؤشرات نواتج التعلم ٣-١-١-١ إلى ٣-١-١-٣، وتنسيق المبادرات الصفية والأسرية.</p>" +
          "<h3 style=\"color:#0b5e56;font-size:14px;\">لجنة التحصيل الدراسي (SSOT)</h3>" +
          tableHtml(
            ["الدور", "الاسم", "الصفة", "التخصص"],
            committee.map(function (row) {
              return [
                escapeHtml(row.seat_label || row.seat || ""),
                escapeHtml(row.name || ""),
                escapeHtml(row.role || ""),
                escapeHtml(row.specialty || "")
              ];
            })
          ) +
          "<h3 style=\"color:#0b5e56;font-size:14px;\">معلمو المجالات من المنسوبين</h3>" +
          tableHtml(
            ["الاسم", "الصفة", "التخصص"],
            teachers.map(function (row) {
              return [
                escapeHtml(row.name || ""),
                escapeHtml(row.role || ""),
                escapeHtml(row.specialty || "")
              ];
            })
          )
      );

    var page3 =
      pageBreak() +
      wrapPrintPage(
        3,
        totalPages,
        "<h2 style=\"color:#0b5e56;font-size:16px;\">الخطة الزمنية الأسبوعية (" +
          toEasternDigits(18) +
          " أسبوعاً) حتى " +
          escapeHtml(dossier.exam_window || "") +
          "</h2>" +
          "<p class=\"tpl-p aj-nafs-initiatives-line\">المبادرات المدرسية: <span class=\"aj-nafs-init-cell\">" +
          escapeHtml(initiativesLine) +
          "</span> · اختبارات المحاكاة: " +
          escapeHtml((dossier.mocks || []).join("، ")) +
          ".</p>" +
          tableHtml(["الأسبوع", "التركيز التشغيلي", "المبادرات", "القياس"], weekRows)
      );

    var page4 =
      pageBreak() +
      wrapPrintPage(
        4,
        totalPages,
        "<h2 style=\"color:#0b5e56;font-size:16px;\">مصفوفة المهارات وعينة الأسئلة وبطاقات QR</h2>" +
          "<p class=\"tpl-p\">مهارات أساسية: رياضيات " +
          toEasternDigits(String((dossier.skills_matrix || {}).math || 15)) +
          " · علوم " +
          toEasternDigits(String((dossier.skills_matrix || {}).science || 10)) +
          " · مستويات الفهم القرائي: " +
          escapeHtml(((dossier.skills_matrix || {}).reading_levels || []).join("، ")) +
          " · بنك الأسئلة المصحّح: " +
          toEasternDigits(String(dossier.question_bank_count || 0)) +
          " سؤالاً.</p>" +
          tableHtml(
            ["م", "المجال", "المهارة", "نص السؤال", "الإجابة"],
            samples.slice(0, 6).map(function (row, idx) {
              return [
                toEasternDigits(String(idx + 1)),
                escapeHtml(domainLabelAr(row.domain)),
                escapeHtml(row.skill || ""),
                renderArabicMath(row.stem || ""),
                escapeHtml(choiceLetterAr(row.correct || ""))
              ];
            })
          ) +
          "<div style=\"display:flex;gap:12px;justify-content:space-around;margin-top:8px;\">" +
          challenges
            .map(function (ch) {
              return (
                "<div style=\"text-align:center;width:30%;\">" +
                (ch.qr_svg || "") +
                "<div style=\"font-size:11px;color:#0b5e56;margin-top:4px;\">" +
                escapeHtml(ch.label || "") +
                "</div></div>"
              );
            })
            .join("") +
          "</div>"
      );

    var page5 =
      pageBreak() +
      wrapPrintPage(
        5,
        totalPages,
        "<h2 style=\"color:#0b5e56;font-size:16px;\">الشراكة الأسرية وميثاق الالتزام وتحفيز فرسان نافس</h2>" +
          "<p class=\"tpl-p\">ميثاق أسري: متابعة واجب يومي قصير، وتشجيع القراءة المنزلية، وحضور لقاءات محاكاة نافس، والإبلاغ المبكر عن التعثر.</p>" +
          tableHtml(
            ["المستوى", "المعيار", "الحافز"],
            [
              ["الذهبي", "٩٠٪ فأكثر", "شهادة تميز + وسام فارس نافس الذهبي"],
              ["الفضي", "٨٠–٨٩٪", "شهادة تقدير + وسام فضي"],
              ["فارس التحدي", "+٢٠ نقطة تحسن", "تكريم التحسن الملحوظ"],
              ["فصل التميز", "أعلى متوسط شعبة", "درع فصل التميز"]
            ].map(function (row) {
              return row.map(function (cell) {
                return escapeHtml(toEasternDigits(cell));
              });
            })
          ) +
          "<div style=\"border:2px dashed #0b5e56;padding:10px;margin-top:10px;text-align:center;\">" +
          "<strong>بطاقة تكريم قابلة للقص</strong><br>يُكرَّم الطالب: ........................ في مجال ............ لنيله مستوى ............ في مسار نافس.</div>"
      );

    var members = committee
      .map(function (row) {
        return row.name;
      })
      .filter(Boolean);
    var page6 =
      pageBreak() +
      wrapPrintPage(
        6,
        totalPages,
        "<h2 style=\"color:#0b5e56;font-size:16px;\">سجل محاضر لجنة التحصيل ونافس (" +
          toEasternDigits(4) +
          " محاضر)</h2>" +
          tableHtml(
            ["المحضر", "التاريخ الإرشادي", "الحضور من SSOT", "محور النقاش"],
            [
              ["١", "الأسبوع ٢", members.slice(0, 4).join("، "), "إطلاق التشخيص وتحديد فجوة الجبر"],
              [
                "٢",
                "الأسبوع ٦",
                members.slice(0, 5).join("، "),
                "متابعة مبادرات قارئ الحصيف وتحدي الأرقام"
              ],
              ["٣", "الأسبوع ١٢", members.join("، "), "تحليل Mock ١–٢ وتعديل المسارات"],
              ["٤", "الأسبوع ١٦", members.join("، "), "جاهزية نافذة شوال/ذو القعدة"]
            ].map(function (row) {
              return row.map(function (cell) {
                return escapeHtml(toEasternDigits(cell));
              });
            })
          )
      );

    var tt = analytics.timetable || {};
    var page7 =
      pageBreak() +
      wrapPrintPage(
        7,
        totalPages,
        "<h2 style=\"color:#0b5e56;font-size:16px;\">أدوات التنفيذ الصفّي والملاحق</h2>" +
          "<p class=\"tpl-p\"><strong>بطاقة ملاحظة صفية:</strong> سؤال نافس + تعليم متمايز (مسار علاجي / إثرائي) + تغذية راجعة فورية.</p>" +
          "<p class=\"tpl-p\"><strong>استمارة العيادة العلاجية:</strong> المهارة المستهدفة · عدد الطلاب · الجلسات · القياس البعدي.</p>" +
          "<p class=\"tpl-p\"><strong>ورقة تظليل مصغّرة (Scantron):</strong> " +
          toEasternDigits(20) +
          " بنداً · خيارات أ–د · للاستخدام مع بنك الأسئلة المصحّح.</p>" +
          tableHtml(
            ["المحاكاة", "الأسبوع المقترح", "الهدف"],
            (dossier.mocks || []).map(function (name, idx) {
              return [
                escapeHtml(toEasternDigits(name)),
                toEasternDigits(String(11 + idx)),
                escapeHtml("قياس جاهزية المجال الثلاثي قبل النافذة الوطنية")
              ];
            })
          ) +
          "<p class=\"tpl-p\">كشف الحصص (nafes_timetable): " +
          (tt.total
            ? toEasternDigits(String(tt.total)) + " حصة محفوظة"
            : escapeHtml(tt.message || "لا حصص مستوردة بعد")) +
          ".</p>" +
          (signNote || "")
      );

    return page1 + page2 + page3 + page4 + page5 + page6 + page7;
  }

  function printIntegratedRecord() {
    if (!window.PrintEngine || typeof window.PrintEngine.open !== "function") {
      status("محرك الطباعة الموحد غير محمّل.", true);
      return;
    }
    status("جارٍ تجهيز سجل نافس المتكامل…");
    var chk = document.getElementById("aj-nafs-wi-print");
    state.includeWhatIfInPrint = !!(chk && chk.checked);
    fetchJson(API + "/dossier", { headers: authHeaders(), cache: "no-store" })
      .then(function (dossier) {
        state.dossier = dossier;
        return enrichSignoff().then(function (signCols) {
          window.PrintEngine.open("master-sheet", {
            docTitle: "سجل نافس المدرسي المتكامل",
            title: "سجل نافس المدرسي المتكامل (" + toEasternDigits(7) + " صفحات)",
            kind: "document",
            fileName: "سجل_نافس_المدرسي_المتكامل",
            orientation: "portrait",
            multiPage: true,
            list: true,
            strictIdentity: true,
            school: SCHOOL_NAME,
            bodyHtml: buildRecordHtml(dossier, ""),
            signoff: true,
            maxColumns: 2,
            pageTotal: 7,
            signatures: (signCols || []).slice(0, 2)
          });
          status("معاينة سجل نافس المتكامل (" + toEasternDigits(7) + " صفحات) جاهزة.");
        });
      })
      .catch(function (error) {
        status((error && error.message) || "تعذر تجهيز السجل المتكامل.", true);
      });
  }

  function refresh() {
    var loading = document.getElementById("aj-nafes-loading");
    if (loading) {
      loading.hidden = false;
    }
    status("جارٍ تحميل تحليل نافس…");
    return Promise.all([
      fetchJson(API + "/analytics", { headers: authHeaders(), cache: "no-store" }),
      fetchJson(API + "/questions", { headers: authHeaders(), cache: "no-store" }),
      fetchJson(API + "/misconceptions/top", { headers: authHeaders(), cache: "no-store" }).catch(function () {
        return { top: {}, indicators: {} };
      }),
      fetchJson(API + "/skills-matrix", { headers: authHeaders(), cache: "no-store" }).catch(function () {
        return { matrix: {} };
      }),
      fetchJson(API + "/weekly-plan", { headers: authHeaders(), cache: "no-store" }).catch(function () {
        return { weeks: [], current: {} };
      }),
      fetchJson(API + "/week-goal", { headers: authHeaders(), cache: "no-store" }).catch(function () {
        return null;
      }),
      fetchJson(API + "/etec-archive", { headers: authHeaders(), cache: "no-store" }).catch(function () {
        return null;
      }),
      fetchJson(API + "/enrich-bridge", { headers: authHeaders(), cache: "no-store" }).catch(function () {
        return null;
      })
    ])
      .then(function (parts) {
        state.pack = parts[0];
        state.questions = parts[1];
        state.misc = parts[2];
        state.unit2 = { matrix: parts[3], weekly: parts[4] };
        state.weekGoal = parts[5] || parts[4] || null;
        state.etecArchive = parts[6] || null;
        state.enrichBridge = parts[7] || null;
        state.whatIf = { math: null, reading: null, science: null };
        paint();
        var meta = state.pack.meta || {};
        var tt = state.pack.timetable || {};
        var counts = (state.questions && state.questions.counts) || {};
        status(
          "نافس حي · " +
            (meta.grade || "") +
            " · مختبرون " +
            (meta.tested || "—") +
            " · حصص " +
            (tt.total || 0) +
            " · بنك الأسئلة " +
            (counts.total || 0)
        );
        return state.pack;
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
        return;
      }
      if (t.closest("#aj-nafs-print-record")) {
        printIntegratedRecord();
        return;
      }
      if (t.closest("#aj-nafs-print-omr")) {
        printNationalOmr();
        return;
      }
      if (t.closest("#aj-nafs-docx-weekly")) {
        downloadDocx("weekly");
        return;
      }
      if (t.closest("#aj-nafs-docx-matrix")) {
        downloadDocx("matrix");
        return;
      }
      if (t.closest("#aj-nafs-docx-evidence")) {
        downloadDocx("evidence");
        return;
      }
      if (t.closest("#aj-nafs-docx-workbook")) {
        downloadDocx("workbook");
        return;
      }
      if (t.closest("#aj-nafs-print-week-goal")) {
        printWeekGoalA4();
        return;
      }
      if (t.closest("#aj-nafs-etec-refresh")) {
        refreshEtecArchive().catch(function (error) {
          status((error && error.message) || "تعذر أرشفة الشواهد.", true);
        });
        return;
      }
      if (t.closest("#aj-nafs-enrich-refresh")) {
        refreshEnrichBridge().catch(function (error) {
          status((error && error.message) || "تعذر تحديث جسر الإثراء.", true);
        });
        return;
      }
      if (t.closest("#aj-nafs-honor-print")) {
        printHonorReport().catch(function (error) {
          status((error && error.message) || "تعذر تجهيز تقرير التتويج.", true);
        });
        return;
      }
      var trapBtn = t.closest("[data-aj-nafs-trap-sheet]");
      if (trapBtn) {
        var parts = String(trapBtn.getAttribute("data-aj-nafs-trap-sheet") || "").split("|");
        printTrapSheet(parts[0] || "math", parts[1] || "");
        return;
      }
      var bankBtn = t.closest("[data-aj-nafs-bank]");
      if (bankBtn) {
        state.bankDomain = bankBtn.getAttribute("data-aj-nafs-bank") || "all";
        paintBank();
      }
    });
    root.addEventListener("input", function (event) {
      var t = event.target;
      if (!t) {
        return;
      }
      if (t.getAttribute && t.getAttribute("data-aj-nafs-wi")) {
        var key = t.getAttribute("data-aj-nafs-wi");
        state.whatIf[key] = Number(t.value);
        updateWhatIfLive();
      }
    });
    root.addEventListener("change", function (event) {
      var t = event.target;
      if (t && t.id === "aj-nafs-wi-print") {
        state.includeWhatIfInPrint = !!t.checked;
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
    printRemedialPlan: printRemedialPlan,
    printIntegratedRecord: printIntegratedRecord
  };
})();
