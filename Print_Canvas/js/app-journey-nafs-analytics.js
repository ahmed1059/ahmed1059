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
    includeWhatIfInPrint: false
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
    return (num > 0 ? "+" : "") + num.toFixed(1);
  }

  function etecBand(avg) {
    var n = Number(avg);
    if (!(n >= 0)) {
      return "—";
    }
    if (n < 25) {
      return "1 · التهيئة";
    }
    if (n < 50) {
      return "2 · الانطلاق";
    }
    if (n < 75) {
      return "3 · التقدم";
    }
    return "4 · التميز";
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
      escapeHtml(avg.toFixed(1)) +
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
      avgEl.textContent = avg.toFixed(1) + "٪";
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
    host.innerHTML =
      "<div class=\"aj-nafs-bank-filters\" role=\"group\" aria-label=\"تصفية بنك الأسئلة\">" +
      [
        ["all", "الكل (" + (counts.total || 0) + ")"],
        ["math", "رياضيات (" + (counts.math || 0) + ")"],
        ["reading", "قراءة (" + (counts.reading || 0) + ")"],
        ["science", "علوم (" + (counts.science || 0) + ")"]
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
            escapeHtml(String(index + 1)) +
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
            escapeHtml(row.stem || "") +
            "</p>" +
            "<ul class=\"aj-nafs-choices\">" +
            ["A", "B", "C", "D"]
              .map(function (letter) {
                var on = letter === row.correct;
                return (
                  "<li class=\"" +
                  (on ? "is-correct" : "") +
                  "\"><span>" +
                  letter +
                  "</span> " +
                  escapeHtml(choices[letter] || "") +
                  (on ? " ✓" : "") +
                  "</li>"
                );
              })
              .join("") +
            "</ul>" +
            "<p class=\"aj-nafs-why\"><strong>التعليل:</strong> " +
            escapeHtml(row.rationale || "") +
            "</p>" +
            "</article>"
          );
        })
        .join("") +
      (items.length ? "" : "<p class=\"aj-nafs-empty\">لا أسئلة في هذا التصفية.</p>") +
      "</div>";
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
        escapeHtml(String(i)),
        escapeHtml(focus),
        escapeHtml((dossier.initiatives || []).join(" · ")),
        escapeHtml(i % 4 === 0 ? "Mock " + Math.min(4, Math.ceil(i / 4)) : "متابعة صفية")
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
        escapeHtml(avg.toFixed(1)) +
        "٪ · تصنيف " +
        escapeHtml(etecBand(avg)) +
        ".</p>";
    }

    var page1 =
      "<section class=\"aj-nafs-print-page\">" +
      "<h2 style=\"color:#0b5e56;font-size:18px;margin:0 0 6px;\">سجل نافس المدرسي المتكامل</h2>" +
      "<p class=\"tpl-p\">" +
      escapeHtml(school.name || SCHOOL_NAME) +
      " (" +
      escapeHtml(school.code || "40341") +
      ") — " +
      escapeHtml(meta.grade || "الثالث المتوسط") +
      " · مقيدون " +
      escapeHtml(String(meta.enrolled || "—")) +
      " / مختبرون " +
      escapeHtml(String(meta.tested || "—")) +
      " · متوسط الإتقان " +
      escapeHtml(
        meta.average_mastery_pct != null ? Number(meta.average_mastery_pct).toFixed(1) + "٪" : "—"
      ) +
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
            escapeHtml(row.code) +
            "</strong> — " +
            escapeHtml(row.domain_label) +
            ": " +
            escapeHtml(row.statement || "") +
            "</li>"
          );
        })
        .join("") +
      "</ul></section>";

    var page2 =
      pageBreak() +
      "<section class=\"aj-nafs-print-page\">" +
      "<h2 style=\"color:#0b5e56;font-size:16px;\">القرار الإداري وتشكيل لجنة التحصيل / فريق نافس</h2>" +
      "<p class=\"tpl-p\">يُعتمد تشغيل محطة نافس تحت إشراف وكيل الشؤون التعليمية، بربط مباشر بمؤشرات نواتج التعلم 3-1-1-1 إلى 3-1-1-3، وتنسيق المبادرات الصفية والأسرية.</p>" +
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
      ) +
      "</section>";

    var page3 =
      pageBreak() +
      "<section class=\"aj-nafs-print-page\">" +
      "<h2 style=\"color:#0b5e56;font-size:16px;\">الخطة الزمنية الأسبوعية (18 أسبوعاً) حتى " +
      escapeHtml(dossier.exam_window || "") +
      "</h2>" +
      "<p class=\"tpl-p\">المبادرات المدرسية: " +
      escapeHtml((dossier.initiatives || []).join(" · ")) +
      " · اختبارات المحاكاة: " +
      escapeHtml((dossier.mocks || []).join("، ")) +
      ".</p>" +
      tableHtml(["الأسبوع", "التركيز التشغيلي", "المبادرات", "القياس"], weekRows) +
      "</section>";

    var page4 =
      pageBreak() +
      "<section class=\"aj-nafs-print-page\">" +
      "<h2 style=\"color:#0b5e56;font-size:16px;\">مصفوفة المهارات وعينة الأسئلة وبطاقات QR</h2>" +
      "<p class=\"tpl-p\">مهارات أساسية: رياضيات " +
      escapeHtml(String((dossier.skills_matrix || {}).math || 15)) +
      " · علوم " +
      escapeHtml(String((dossier.skills_matrix || {}).science || 10)) +
      " · مستويات الفهم القرائي: " +
      escapeHtml(((dossier.skills_matrix || {}).reading_levels || []).join("، ")) +
      " · بنك الأسئلة المصحّح: " +
      escapeHtml(String(dossier.question_bank_count || 86)) +
      " سؤالاً.</p>" +
      tableHtml(
        ["م", "المجال", "المهارة", "نص السؤال", "الإجابة"],
        samples.slice(0, 6).map(function (row, idx) {
          return [
            escapeHtml(String(idx + 1)),
            escapeHtml(domainLabelAr(row.domain)),
            escapeHtml(row.skill || ""),
            escapeHtml(row.stem || ""),
            escapeHtml(row.correct || "")
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
      "</div></section>";

    var page5 =
      pageBreak() +
      "<section class=\"aj-nafs-print-page\">" +
      "<h2 style=\"color:#0b5e56;font-size:16px;\">الشراكة الأسرية وميثاق الالتزام وتحفيز فرسان نافس</h2>" +
      "<p class=\"tpl-p\">ميثاق أسري: متابعة واجب يومي قصير، وتشجيع القراءة المنزلية، وحضور لقاءات محاكاة نافس، والإبلاغ المبكر عن التعثر.</p>" +
      tableHtml(
        ["المستوى", "المعيار", "الحافز"],
        [
          ["الذهبي", "90٪ فأكثر", "شهادة تميز + وسام فارس نافس الذهبي"],
          ["الفضي", "80–89٪", "شهادة تقدير + وسام فضي"],
          ["فارس التحدي", "+20 نقطة تحسن", "تكريم التحسن الملحوظ"],
          ["فصل التميز", "أعلى متوسط شعبة", "درع فصل التميز"]
        ].map(function (row) {
          return row.map(escapeHtml);
        })
      ) +
      "<div style=\"border:2px dashed #0b5e56;padding:10px;margin-top:10px;text-align:center;\">" +
      "<strong>بطاقة تكريم قابلة للقص</strong><br>يُكرَّم الطالب/ـة: ........................ في مجال ............ لنيله مستوى ............ في مسار نافس.</div>" +
      "</section>";

    var members = committee
      .map(function (row) {
        return row.name;
      })
      .filter(Boolean);
    var page6 =
      pageBreak() +
      "<section class=\"aj-nafs-print-page\">" +
      "<h2 style=\"color:#0b5e56;font-size:16px;\">سجل محاضر لجنة التحصيل ونافس (4 محاضر)</h2>" +
      tableHtml(
        ["المحضر", "التاريخ الإرشادي", "الحضور من SSOT", "محور النقاش"],
        [
          ["1", "الأسبوع 2", members.slice(0, 4).join("، "), "إطلاق التشخيص وتحديد فجوة الجبر"],
          ["2", "الأسبوع 6", members.slice(0, 5).join("، "), "متابعة مبادرات قارئ الحصيف وتحدي الأرقام"],
          ["3", "الأسبوع 12", members.join("، "), "تحليل Mock 1–2 وتعديل المسارات"],
          ["4", "الأسبوع 16", members.join("، "), "جاهزية نافذة شوال/ذو القعدة"]
        ].map(function (row) {
          return row.map(escapeHtml);
        })
      ) +
      "</section>";

    var tt = (analytics.timetable || {});
    var page7 =
      pageBreak() +
      "<section class=\"aj-nafs-print-page\">" +
      "<h2 style=\"color:#0b5e56;font-size:16px;\">أدوات التنفيذ الصفّي والملاحق</h2>" +
      "<p class=\"tpl-p\"><strong>بطاقة ملاحظة صفية:</strong> سؤال نافس + تعليم متمايز (مسار علاجي / إثرائي) + تغذية راجعة فورية.</p>" +
      "<p class=\"tpl-p\"><strong>استمارة العيادة العلاجية:</strong> المهارة المستهدفة · عدد الطلاب · الجلسات · القياس البعدي.</p>" +
      "<p class=\"tpl-p\"><strong>ورقة تظليل مصغّرة (Scantron):</strong> 20 بنداً · خيارات A–D · للاستخدام مع بنك الأسئلة المصحّح.</p>" +
      tableHtml(
        ["المحاكاة", "الأسبوع المقترح", "الهدف"],
        (dossier.mocks || []).map(function (name, idx) {
          return [
            escapeHtml(name),
            escapeHtml(String(11 + idx)),
            escapeHtml("قياس جاهزية المجال الثلاثي قبل النافذة الوطنية")
          ];
        })
      ) +
      "<p class=\"tpl-p\">كشف الحصص (nafes_timetable): " +
      (tt.total
        ? escapeHtml(String(tt.total)) + " حصة محفوظة"
        : escapeHtml(tt.message || "لا حصص مستوردة بعد")) +
      ".</p>" +
      (signNote || "") +
      "</section>";

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
            title: "سجل نافس المدرسي المتكامل (7 صفحات)",
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
            signatures: (signCols || []).slice(0, 2)
          });
          status("معاينة سجل نافس المتكامل (7 صفحات) جاهزة.");
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
      fetchJson(API + "/questions", { headers: authHeaders(), cache: "no-store" })
    ])
      .then(function (parts) {
        state.pack = parts[0];
        state.questions = parts[1];
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
