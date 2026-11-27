/**
 * موجة ج: نموذج إجابة نافس التدريبي + استبانة الطالب (A4 / Sky Blue).
 * بلا مفاتيح إجابة · نصوص بنود الاستبانة لا تُختلق (خانة نص من الكتيب الرسمي).
 */
(function (global) {
  "use strict";

  var EASTERN = "٠١٢٣٤٥٦٧٨٩";
  var PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

  function east(value) {
    return String(value == null ? "" : value)
      .replace(/[۰-۹]/g, function (d) {
        var i = PERSIAN.indexOf(d);
        return i >= 0 ? EASTERN.charAt(i) : d;
      })
      .replace(/[0-9]/g, function (d) {
        return EASTERN.charAt(Number(d)) || d;
      })
      .replace(/%/g, "٪");
  }

  function ltrForce(text) {
    var raw = east(text);
    if (!raw) return "";
    return (
      "<span class=\"etec-ltr etec-force\" dir=\"ltr\">\u2066" +
      esc(raw) +
      "\u2069</span>"
    );
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bubble(letter, key) {
    return (
      "<button type=\"button\" class=\"nafs-c-bubble\" data-nafs-c=\"" +
      esc(key) +
      "\" data-choice=\"" +
      esc(letter) +
      "\" aria-pressed=\"false\" title=\"" +
      esc(letter) +
      "\">" +
      esc(letter) +
      "</button>"
    );
  }

  function timingMarks(count) {
    var n = count || 28;
    var html = "";
    for (var i = 0; i < n; i += 1) html += "<span></span>";
    return html;
  }

  function digitGridHtml(grid, prefix) {
    var cols = Number(grid.columns) || 5;
    var digits = grid.digits || [];
    var colHtml = "";
    for (var c = 0; c < cols; c += 1) {
      colHtml += "<div class=\"nafs-c-digit-col\">";
      for (var r = 0; r < digits.length; r += 1) {
        var d = digits[r];
        colHtml += bubble(d.d_ar || east(d.d), prefix + ":" + c + ":" + d.d);
      }
      colHtml += "</div>";
    }
    return (
      "<div class=\"nafs-c-digit-grid\">" +
      "<h4>" +
      esc(grid.label || "") +
      (grid.label_en
        ? " <span class=\"nafs-c-en etec-ltr\" dir=\"ltr\">" + esc(grid.label_en) + "</span>"
        : "") +
      "</h4>" +
      "<div class=\"nafs-c-digit-wrap\">" +
      colHtml +
      "</div></div>"
    );
  }

  function answerSheetPage(pack) {
    var school = pack.school || {};
    var student = pack.student || {};
    var sheet = pack.answer_sheet || {};
    var labels = pack.labels_ar || {};
    var cols = sheet.columns || [];
    var colHtml = cols
      .map(function (col) {
        var rows = (col.items || [])
          .map(function (it) {
            return (
              "<div class=\"nafs-c-qrow\">" +
              "<span class=\"nafs-c-qnum\">" +
              ltrForce(it.n_ar || it.n) +
              "</span>" +
              (it.choices || ["أ", "ب", "ج", "د"])
                .map(function (ch) {
                  return bubble(ch, "ans:" + it.n + ":" + ch);
                })
                .join("") +
              "</div>"
            );
          })
          .join("");
        return (
          "<div class=\"nafs-c-answer-col\">" +
          "<div class=\"nafs-c-col-head\"><span></span><span>أ</span><span>ب</span><span>ج</span><span>د</span></div>" +
          rows +
          "</div>"
        );
      })
      .join("");

    var sectionChips = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي"]
      .map(function (ch, idx) {
        return (
          "<button type=\"button\" class=\"nafs-c-chip\" data-nafs-c=\"sec:" +
          esc(ch) +
          "\" aria-pressed=\"false\">" +
          esc(east(idx + 1)) +
          "</button>"
        );
      })
      .join("");

    var omrOnly = !!pack.omr_only;
    var pageCode = omrOnly ? "omr" : "1-4";
    var pageCodeAr = omrOnly ? "OMR" : "١-٤";
    var bannerTitle = omrOnly
      ? esc(pack.title || pack.title_ar || "ورقة التظليل الضوئي (OMR)")
      : "ورقة الإجابة صفحة ( " + east(1) + " ) — إجابات الأسئلة";

    var logoBase = "/assets/";
    try {
      if (typeof location !== "undefined" && location.origin) {
        logoBase = location.origin + "/assets/";
      }
    } catch (err) {}
    var brandRow =
      "<div class=\"nafs-c-brand-row\">" +
      "<img class=\"nafs-c-brand-logo\" src=\"" +
      logoBase +
      "ministry_logo.png\" alt=\"وزارة التعليم\" width=\"120\" height=\"40\" loading=\"eager\" decoding=\"sync\">" +
      "<img class=\"nafs-c-brand-logo nafs-c-brand-nafs\" src=\"" +
      logoBase +
      "nafs_logo.png\" alt=\"نافس\" width=\"90\" height=\"36\" loading=\"eager\" decoding=\"sync\">" +
      "</div>";

    return (
      "<section class=\"nafs-c-page\" data-page=\"" +
      pageCode +
      "\">" +
      "<div class=\"nafs-c-timing is-start\" aria-hidden=\"true\">" +
      timingMarks(30) +
      "</div>" +
      brandRow +
      "<div class=\"nafs-c-banner\">" +
      bannerTitle +
      " · <span class=\"etec-ltr\" dir=\"ltr\">ETEC / Qiyas / NAFS</span></div>" +
      "<div class=\"nafs-c-etec-row\">" +
      "<div><span class=\"etec-ltr\" dir=\"ltr\">Education &amp; Training Evaluation Commission</span></div>" +
      "<div class=\"nafs-c-page-box\">صفحة رقم ( " +
      east(1) +
      " ) · " +
      pageCodeAr +
      "</div></div>" +
      "<div class=\"nafs-c-shade-guide\">" +
      "<span class=\"ok\">صواب: تظليل كامل</span>" +
      "<span class=\"bad\">خطأ: ✓ · ✗ · جزئي · خارج الدائرة</span></div>" +
      "<div class=\"nafs-c-id-box\">" +
      "<div><label>" +
      esc(labels.full_name || "الاسم الرباعي") +
      "</label><div class=\"nafs-c-field\">" +
      esc(student.name || "") +
      "</div></div>" +
      "<div><label>" +
      esc(labels.national_id || "السجل المدني") +
      "</label><div class=\"nafs-c-field\">" +
      ltrForce(student.national_id || "") +
      "</div></div>" +
      "<div><label>" +
      esc(labels.school_name || "اسم المدرسة") +
      "</label><div class=\"nafs-c-field\">" +
      esc(school.name || "") +
      "</div></div>" +
      "<div><label>" +
      esc(labels.ministry_no || "الرقم الوزاري") +
      "</label><div class=\"nafs-c-field\">" +
      ltrForce(
        school.ministry_id_ar ||
          school.ministry_id ||
          school.code_ar ||
          school.code ||
          "S-40341"
      ) +
      "</div></div>" +
      "<div><label>" +
      esc(labels.grade || "الصف") +
      "</label><div class=\"nafs-c-field\">" +
      esc(student.grade || school.grade_default || "") +
      "</div></div>" +
      "<div><label>" +
      esc(labels.section || "الفصل") +
      "</label><div class=\"nafs-c-section-grid\">" +
      sectionChips +
      "</div></div></div>" +
      "<div class=\"nafs-c-grids\">" +
      digitGridHtml(sheet.national_id_grid || { columns: 10, label: "رقم السجل المدني / رقم الإقامة", digits: [] }, "nid") +
      digitGridHtml(sheet.school_code_grid || { columns: 5, label: "رمز المدرسة", digits: [] }, "scode") +
      "</div>" +
      "<div class=\"nafs-c-sky-bar\">" +
      esc(labels.answers || "إجابات الأسئلة") +
      " ( " +
      ltrForce(sheet.item_count_ar || sheet.item_count || 66) +
      " )</div>" +
      "<div class=\"nafs-c-answer-block\"><div class=\"nafs-c-answer-cols\">" +
      colHtml +
      "</div></div>" +
      "<div class=\"nafs-c-vlabel\" aria-hidden=\"true\">الاختبارات الوطنية (نافس) — " +
      esc(student.grade || school.grade_default || "") +
      "</div>" +
      "</section>"
    );
  }

  function questionnaireItemHtml(item) {
    var multi =
      item.multi || item.kind === "multi"
        ? "<div class=\"nafs-c-multi-banner\">" + esc(item.banner || "يمكن للطالب تعبئة أكثر من إجابة") + "</div>"
        : "";
    var stem =
      "<div class=\"nafs-c-stem-slot\" title=\"" +
      esc(item.stem_source || "") +
      "\">" +
      esc(item.stem || "") +
      "</div>";

    var body = "";
    if (item.kind === "matrix" && item.matrix) {
      var cols = item.matrix.cols || ["صفر", "١", "٢", "٣ أو أكثر"];
      var colKeys = item.choices || ["أ", "ب", "ج", "د"];
      var head =
        "<tr><th></th>" +
        cols
          .map(function (c) {
            return "<th>" + esc(c) + "</th>";
          })
          .join("") +
        "</tr>";
      var rows = (item.matrix.rows || [])
        .map(function (r) {
          return (
            "<tr><td class=\"nafs-c-matrix-label\">" +
            esc(r.label || r.i_ar || east(r.i)) +
            "</td>" +
            cols
              .map(function (_c, idx) {
                var key = colKeys[idx] || east(idx + 1);
                return (
                  "<td>" +
                  bubble("·", "q:" + item.n + ":r" + r.i + ":" + key) +
                  "</td>"
                );
              })
              .join("") +
            "</tr>"
          );
        })
        .join("");
      body = "<table class=\"nafs-c-matrix\"><thead>" + head + "</thead><tbody>" + rows + "</tbody></table>";
    } else {
      var keys = item.choices || ["أ", "ب", "ج", "د"];
      var labels = item.choice_labels || [];
      body =
        "<div class=\"nafs-c-choices\">" +
        keys
          .map(function (ch, idx) {
            var label = labels[idx] || "";
            return (
              "<span class=\"nafs-c-choice\">" +
              (label ? "<span class=\"nafs-c-choice-label\">" + esc(label) + "</span>" : "") +
              bubble(ch, "q:" + item.n + ":" + ch) +
              "</span>"
            );
          })
          .join("") +
        "</div>";
    }

    return (
      "<article class=\"nafs-c-q-item\" data-item=\"" +
      esc(item.n) +
      "\" data-section=\"" +
      esc(item.section || "") +
      "\">" +
      multi +
      "<div class=\"nafs-c-q-head\"><span class=\"nafs-c-badge\">" +
      esc(item.n_ar || east(item.n)) +
      "</span>" +
      stem +
      "</div>" +
      body +
      "</article>"
    );
  }

  function questionnairePage(pack, pageCode, pageIndex) {
    var q = pack.questionnaire || {};
    var byPage = q.by_page || {};
    var items = byPage[pageCode] || [];
    var pageMeta = (pack.pages || []).filter(function (p) {
      return p.code === pageCode;
    })[0] || {};
    var closing =
      pageCode === "4-4"
        ? "<div class=\"nafs-c-closing\">" + esc(q.closing || "شكرًا لإجابتكم على هذه الاستبانة") + "</div>"
        : "";

    var bodyHtml = "";
    var lastSection = "";
    items.forEach(function (it) {
      var sec = it.section || "";
      if (sec && sec !== lastSection) {
        bodyHtml +=
          "<div class=\"nafs-c-sky-bar nafs-c-section-banner\">" + esc(sec) + "</div>";
        lastSection = sec;
      }
      bodyHtml += questionnaireItemHtml(it);
    });

    return (
      "<section class=\"nafs-c-page\" data-page=\"" +
      esc(pageCode) +
      "\">" +
      "<div class=\"nafs-c-timing is-end\" aria-hidden=\"true\">" +
      timingMarks(30) +
      "</div>" +
      "<div class=\"nafs-c-banner\">استبانة الطالب — صفحة ( " +
      east(pageIndex) +
      " ) · " +
      esc(pageMeta.code_ar || east(String(pageCode || "").replace("-", "–"))) +
      "</div>" +
      "<div class=\"nafs-c-etec-row\">" +
      "<div class=\"nafs-c-page-box\">صفحة رقم ( " +
      east(pageIndex) +
      " ) · " +
      esc(pageMeta.code_ar || east(String(pageCode || "").replace("-", "–"))) +
      "</div></div>" +
      "<p class=\"nafs-c-note\">نصوص البنود من نموذج نافس الرسمي — صيغة موحّدة لجميع الطلاب.</p>" +
      bodyHtml +
      closing +
      "</section>"
    );
  }

  function renderPack(pack) {
    pack = pack || {};
    if (pack.omr_only) {
      return renderOmrOnly(pack);
    }
    return (
      "<div class=\"nafs-c-host\" dir=\"rtl\" lang=\"ar\">" +
      answerSheetPage(pack) +
      questionnairePage(pack, "2-4", 2) +
      questionnairePage(pack, "3-4", 3) +
      questionnairePage(pack, "4-4", 4) +
      "</div>"
    );
  }

  /** ورقة OMR فقط (اختبار منزلي / محاكاة) بنفس قالب Sky Blue وTiming Marks */
  function renderOmrOnly(pack) {
    pack = Object.assign({}, pack || {}, { omr_only: true });
    return (
      "<div class=\"nafs-c-host nafs-c-omr-host\" dir=\"rtl\" lang=\"ar\">" +
      answerSheetPage(pack) +
      "</div>"
    );
  }

  function openOmrPrint(pack) {
    return openPrint(Object.assign({}, pack || {}, { omr_only: true }));
  }

  function bindBubbles(root) {
    if (!root) return;
    root.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-nafs-c]");
      if (!btn) return;
      var key = btn.getAttribute("data-nafs-c") || "";
      var multi = key.indexOf(":r") !== -1 || (btn.closest(".nafs-c-q-item") && btn.closest(".nafs-c-q-item").querySelector(".nafs-c-multi-banner"));
      if (key.indexOf("ans:") === 0 || key.indexOf("nid:") === 0 || key.indexOf("scode:") === 0 || key.indexOf("sec:") === 0) {
        multi = key.indexOf("sec:") === 0 ? false : multi;
        if (key.indexOf("ans:") === 0) {
          var prefix = key.split(":").slice(0, 2).join(":");
          root.querySelectorAll("[data-nafs-c^=\"" + prefix + ":\"]").forEach(function (el) {
            if (el !== btn) {
              el.classList.remove("is-on");
              el.setAttribute("aria-pressed", "false");
            }
          });
        } else if (key.indexOf("nid:") === 0 || key.indexOf("scode:") === 0) {
          var parts = key.split(":");
          var colPrefix = parts[0] + ":" + parts[1] + ":";
          root.querySelectorAll("[data-nafs-c^=\"" + colPrefix + "\"]").forEach(function (el) {
            if (el !== btn) {
              el.classList.remove("is-on");
              el.setAttribute("aria-pressed", "false");
            }
          });
        } else if (key.indexOf("sec:") === 0) {
          root.querySelectorAll("[data-nafs-c^=\"sec:\"]").forEach(function (el) {
            if (el !== btn) {
              el.classList.remove("is-on");
              el.setAttribute("aria-pressed", "false");
            }
          });
        }
      } else if (key.indexOf("q:") === 0 && !multi) {
        var qParts = key.split(":");
        var qPrefix = "q:" + qParts[1] + ":";
        if (key.indexOf(":r") === -1) {
          root.querySelectorAll("[data-nafs-c^=\"" + qPrefix + "\"]").forEach(function (el) {
            if (el !== btn && (el.getAttribute("data-nafs-c") || "").indexOf(":r") === -1) {
              el.classList.remove("is-on");
              el.setAttribute("aria-pressed", "false");
            }
          });
        } else {
          var rowKey = qParts[0] + ":" + qParts[1] + ":" + qParts[2] + ":";
          root.querySelectorAll("[data-nafs-c^=\"" + rowKey + "\"]").forEach(function (el) {
            if (el !== btn) {
              el.classList.remove("is-on");
              el.setAttribute("aria-pressed", "false");
            }
          });
        }
      }
      var on = !btn.classList.contains("is-on");
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function printCssHref() {
    var links = document.querySelectorAll("link[rel=\"stylesheet\"]");
    for (var i = 0; i < links.length; i += 1) {
      var href = links[i].getAttribute("href") || "";
      if (href.indexOf("nafs-wave-c-answer-sheet.css") !== -1) return href;
    }
    return "css/nafs-wave-c-answer-sheet.css";
  }

  function openPrint(pack) {
    var html = renderPack(pack);
    var docTitle = "نموذج إجابة نافس التدريبي — " + ((pack.school && pack.school.name) || "");
    if (global.PrintEngine && typeof global.PrintEngine.open === "function") {
      var wrapped =
        "<link rel=\"stylesheet\" href=\"" +
        esc(printCssHref()) +
        "\">" +
        "<div class=\"nafs-c-print-root\">" +
        html +
        "</div>";
      return global.PrintEngine.open("raw-html", {
        html: wrapped,
        docTitle: docTitle,
        multiPage: true,
        orientation: "portrait",
        arm: { orientation: "portrait", multiPage: true }
      });
    }
    var w = global.open("", "_blank");
    if (!w) return { ok: false, error: "تعذر فتح نافذة الطباعة." };
    w.document.write(
      "<!DOCTYPE html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\"><title>" +
        esc(docTitle) +
        "</title><link rel=\"stylesheet\" href=\"" +
        esc(printCssHref()) +
        "\"></head><body class=\"nafs-c-print\">" +
        html +
        "<script>(function(){document.addEventListener('click',function(e){var b=e.target.closest('[data-nafs-c]');if(!b)return;b.classList.toggle('is-on');});})();<\/script></body></html>"
    );
    w.document.close();
    return { ok: true };
  }

  function collectSurveyAnswers(root) {
    /* طبقة الاستبانة فقط — يتجاهل ans/nid/scode/sec */
    var answers = {};
    if (!root) return answers;
    root.querySelectorAll(".nafs-c-bubble.is-on[data-nafs-c^=\"q:\"]").forEach(function (btn) {
      var key = btn.getAttribute("data-nafs-c") || "";
      var parts = key.split(":");
      if (parts.length < 3) return;
      var n = String(parts[1] || "");
      if (!n) return;
      if (parts[2] && parts[2].charAt(0) === "r") {
        var row = String(parts[2]).replace(/^r/, "");
        var choice = parts[3] || "";
        if (!answers[n]) answers[n] = { kind: "matrix", rows: {} };
        answers[n].rows[row] = choice;
        return;
      }
      var ch = parts[2] || "";
      var item = btn.closest(".nafs-c-q-item");
      var multi = !!(item && item.querySelector(".nafs-c-multi-banner"));
      if (!answers[n]) answers[n] = { kind: multi ? "multi" : "single", choices: [] };
      if (answers[n].choices.indexOf(ch) === -1) answers[n].choices.push(ch);
    });
    return answers;
  }

  function applySurveyAnswers(root, answers) {
    if (!root || !answers) return;
    Object.keys(answers).forEach(function (n) {
      var entry = answers[n] || {};
      if (entry.kind === "matrix" && entry.rows) {
        Object.keys(entry.rows).forEach(function (rk) {
          var ch = entry.rows[rk];
          var sel =
            '[data-nafs-c="q:' + n + ":r" + rk + ":" + ch + '"]';
          var btn = root.querySelector(sel);
          if (btn) {
            btn.classList.add("is-on");
            btn.setAttribute("aria-pressed", "true");
          }
        });
        return;
      }
      (entry.choices || []).forEach(function (ch) {
        var btn = root.querySelector('[data-nafs-c="q:' + n + ":" + ch + '"]');
        if (btn) {
          btn.classList.add("is-on");
          btn.setAttribute("aria-pressed", "true");
        }
      });
    });
  }

  function mountInteractive(host, pack, opts) {
    if (!host) return null;
    opts = opts || {};
    var surveyTools = opts.surveyTools
      ? "<button type=\"button\" class=\"aj-detail-btn portal-btn\" data-nafs-c-draft>حفظ مسودة الاستبانة</button>" +
        "<button type=\"button\" class=\"aj-detail-btn portal-btn\" data-nafs-c-snapshot>اعتماد لقطة استبانة</button>"
      : "";
    host.innerHTML =
      "<div class=\"nafs-c-toolbar\">" +
      surveyTools +
      "<button type=\"button\" class=\"aj-detail-btn portal-btn\" data-nafs-c-print>طباعة النموذج A4 (١-٤…٤-٤)</button>" +
      "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary portal-btn secondary\" data-nafs-c-reset>مسح التظليل</button>" +
      "</div>" +
      "<p class=\"nafs-c-train-hint\">وضع تدريب تفاعلي: اضغط الدوائر للتظليل كما في الورقة الرسمية. حفظ المسودة واعتماد اللقطة يخصّان <strong>بنود الاستبانة فقط</strong> ولا يرصدان تظليل صفحة الإجابات.</p>" +
      renderPack(pack);
    host.classList.add("nafs-c-train-host");
    bindBubbles(host);
    if (opts.surveyDraft) applySurveyAnswers(host, opts.surveyDraft);
    var printBtn = host.querySelector("[data-nafs-c-print]");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        openPrint(pack);
      });
    }
    var resetBtn = host.querySelector("[data-nafs-c-reset]");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        host.querySelectorAll(".nafs-c-bubble.is-on, .nafs-c-chip.is-on").forEach(function (el) {
          el.classList.remove("is-on");
          el.setAttribute("aria-pressed", "false");
        });
      });
    }
    if (typeof opts.onReady === "function") {
      opts.onReady({
        host: host,
        collectSurveyAnswers: function () {
          return collectSurveyAnswers(host);
        },
        applySurveyAnswers: function (a) {
          applySurveyAnswers(host, a);
        }
      });
    }
    return host;
  }

  global.NafsWaveCAnswerSheet = {
    east: east,
    ltrForce: ltrForce,
    renderPack: renderPack,
    renderOmrOnly: renderOmrOnly,
    openPrint: openPrint,
    openOmrPrint: openOmrPrint,
    mountInteractive: mountInteractive,
    bindBubbles: bindBubbles,
    collectSurveyAnswers: collectSurveyAnswers,
    applySurveyAnswers: applySurveyAnswers
  };
})(typeof window !== "undefined" ? window : globalThis);
