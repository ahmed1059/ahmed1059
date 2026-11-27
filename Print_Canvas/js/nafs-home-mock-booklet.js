/**
 * كراسة الاختبار المنزلي — طراز نماذج نافس التدريبية (أ/ب) ١٤٤٧.
 * المحتوى من حزمة البنك فقط؛ بلا اختلاق نصوص أسئلة أو رسوم.
 */
(function (global) {
  "use strict";

  var EASTERN = "٠١٢٣٤٥٦٧٨٩";
  var DOMAIN_ORDER = ["math", "science", "reading"];
  var DOMAIN_META = {
    math: { title: "الرياضيات", key: "math" },
    science: { title: "العلوم", key: "science" },
    reading: { title: "القراءة", key: "reading" }
  };
  var SECTION_ORDINAL = ["الأول", "الثاني", "الثالث", "الرابع"];
  var INSTR_COMMON = [
    "تحت كل سؤال أربعة خيارات، من بينها إجابة صحيحة واحدة فقط.",
    "اقرأ السؤال بهدوء، ثم اختر الإجابة التي ترى أنها صحيحة.",
    "حاول الإجابة على جميع الأسئلة، وعدم ترك أي سؤال دون إجابة."
  ];
  var INSTR_READING = [
    "اقرأ القطعة كاملة قبل البدء بالإجابة.",
    "تحت كل سؤال أربعة خيارات، من بينها إجابة صحيحة واحدة فقط.",
    "اقرأ الأسئلة بهدوء، ثم اختر الإجابة التي ترى أنها صحيحة.",
    "حاول الإجابة على جميع الأسئلة، وعدم ترك أي سؤال دون إجابة."
  ];

  function east(value) {
    return String(value == null ? "" : value)
      .replace(/\d/g, function (d) {
        return EASTERN[Number(d)] || d;
      })
      .replace(/%/g, "٪");
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mathOrEsc(text, renderMath) {
    if (typeof renderMath === "function") return renderMath(text || "");
    return esc(text || "");
  }

  function domainOf(item) {
    var d = String((item && item.domain) || "").toLowerCase();
    if (DOMAIN_META[d]) return d;
    if (d.indexOf("math") >= 0 || d.indexOf("رياض") >= 0) return "math";
    if (d.indexOf("sci") >= 0 || d.indexOf("علوم") >= 0) return "science";
    if (d.indexOf("read") >= 0 || d.indexOf("قراء") >= 0 || d.indexOf("لغ") >= 0) return "reading";
    return "other";
  }

  function groupByDomain(items) {
    var buckets = { math: [], science: [], reading: [], other: [] };
    (items || []).forEach(function (item) {
      buckets[domainOf(item)].push(item);
    });
    var sections = [];
    DOMAIN_ORDER.forEach(function (key) {
      if (buckets[key].length) sections.push({ key: key, items: buckets[key] });
    });
    if (buckets.other.length) {
      sections.push({ key: "other", items: buckets.other, title: "أسئلة عامة" });
    }
    return sections;
  }

  function minutesForCount(count) {
    var n = Math.max(1, Number(count) || 1);
    return Math.max(8, Math.round(n * 1.8));
  }

  function coverPage(pack) {
    return (
      '<section class="nafs-b-page nafs-b-cover">' +
      '<div class="nafs-b-cover-hero">' +
      "<h1>اختبار منزلي بإشراف ولي الأمر</h1>" +
      "<p>نماذج تدريبية على طراز الاختبارات الوطنية (نافس)</p>" +
      "<p>متوسطة سعد بن الربيع الأنصاري · الرقم الوزاري " +
      '<span class="etec-ltr" dir="ltr">' +
      esc(pack.ministry_id_ar || pack.code_ar || east(pack.code || "40341")) +
      "</span></p>" +
      "</div>" +
      '<div class="nafs-b-cover-meta">' +
      "<div><strong>الطالب:</strong> " +
      esc(pack.student_name || "") +
      "</div>" +
      "<div><strong>الصف / الفصل:</strong> " +
      esc(pack.grade || "") +
      " / " +
      east(pack.section || "") +
      "</div>" +
      "<div><strong>عدد الأسئلة:</strong> " +
      east((pack.items || []).length) +
      "</div>" +
      "<div><strong>الشاهد:</strong> " +
      '<span class="etec-ltr etec-code" dir="ltr">' +
      esc(pack.evidence_code_ar || "١-٣-١-٢") +
      "</span></div>" +
      "</div></section>"
    );
  }

  function dividerPage(section, index) {
    var meta = DOMAIN_META[section.key] || { title: section.title || "قسم" };
    var ordinal = SECTION_ORDINAL[index] || east(index + 1);
    var items = section.items || [];
    var fromN = items[0] && items[0].n != null ? items[0].n : 1;
    var toN = items.length ? items[items.length - 1].n : fromN;
    var mins = minutesForCount(items.length);
    var instr = section.key === "reading" ? INSTR_READING : INSTR_COMMON;
    return (
      '<section class="nafs-b-page nafs-b-divider">' +
      '<div class="nafs-b-divider-mark">نموذج تدريبي</div>' +
      '<div class="nafs-b-divider-panel">' +
      '<div class="nafs-b-divider-title">' +
      "<h2>القسم " +
      esc(ordinal) +
      ": " +
      esc(meta.title) +
      "</h2>" +
      "<p>الأسئلة: " +
      east(fromN) +
      " – " +
      east(toN) +
      "</p>" +
      "<p>الزمن: " +
      east(mins) +
      " دقيقة</p>" +
      "</div>" +
      '<div class="nafs-b-divider-instructions">' +
      "<h3>تعليمات</h3><ul>" +
      instr
        .map(function (line) {
          return "<li>" + esc(line) + "</li>";
        })
        .join("") +
      "</ul></div></div></section>"
    );
  }

  function choiceGrid(choices, renderMath) {
    var map = choices || {};
    return (
      '<div class="nafs-b-choices">' +
      ["A", "B", "C", "D"]
        .map(function (L) {
          var ar = { A: "أ", B: "ب", C: "ج", D: "د" }[L];
          return (
            '<div class="nafs-b-choice"><span class="lbl">' +
            ar +
            '</span><span class="txt">' +
            mathOrEsc(map[L] || "", renderMath) +
            "</span></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function questionBlock(item, renderMath) {
    var passage = "";
    if (item.passage_text) {
      passage =
        '<div class="nafs-b-passage">' +
        (item.passage_title
          ? "<strong>" + esc(item.passage_title) + "</strong>"
          : "") +
        esc(item.passage_text) +
        "</div>";
    }
    var diagram = "";
    if (item.diagram_svg) {
      diagram =
        '<div class="nafs-b-diagram" dir="ltr" title="' +
        esc(item.diagram_alt || "شكل توضيحي") +
        '">' +
        item.diagram_svg +
        "</div>";
    }
    return (
      '<article class="nafs-b-qblock">' +
      passage +
      '<div class="nafs-b-qhead">' +
      '<span class="nafs-b-qnum">' +
      east(item.n) +
      "</span>" +
      '<div class="nafs-b-qstem">' +
      mathOrEsc(item.stem || "", renderMath) +
      "</div></div>" +
      diagram +
      choiceGrid(item.choices, renderMath) +
      "</article>"
    );
  }

  function questionPages(sectionItems, renderMath) {
    var pages = [];
    var perPage = 5;
    for (var i = 0; i < sectionItems.length; i += perPage) {
      var slice = sectionItems.slice(i, i + perPage);
      pages.push(
        '<section class="nafs-b-page nafs-b-qpage">' +
          '<header class="nafs-b-qpage-head">' +
          '<div class="brand"><span>الاختبارات الوطنية (نافس)</span><span>نموذج تدريبي</span></div>' +
          "</header>" +
          slice
            .map(function (it) {
              return questionBlock(it, renderMath);
            })
            .join("") +
          "</section>"
      );
    }
    return pages.join("");
  }

  function renderBooklet(pack, opts) {
    pack = pack || {};
    opts = opts || {};
    var renderMath = opts.renderArabicMath;
    var sections = groupByDomain(pack.items || []);
    var html = '<div class="nafs-b-host" dir="rtl" lang="ar">' + coverPage(pack);
    sections.forEach(function (section, idx) {
      html += dividerPage(section, idx);
      html += questionPages(section.items, renderMath);
    });
    if (!sections.length) {
      html +=
        '<section class="nafs-b-page"><p>لا أسئلة محفوظة في هذه الحزمة.</p></section>';
    }
    html += "</div>";
    return html;
  }

  function cssHref() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i += 1) {
      var href = links[i].getAttribute("href") || "";
      if (href.indexOf("nafs-home-mock-booklet.css") !== -1) return href;
    }
    return "css/nafs-home-mock-booklet.css";
  }

  global.NafsHomeMockBooklet = {
    east: east,
    renderBooklet: renderBooklet,
    groupByDomain: groupByDomain,
    cssHref: cssHref,
    INSTR_COMMON: INSTR_COMMON,
    INSTR_READING: INSTR_READING
  };
})(typeof window !== "undefined" ? window : globalThis);
