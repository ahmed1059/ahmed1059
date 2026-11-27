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
  var IDENTITY = {
    kingdom: "المملكة العربية السعودية",
    ministry: "وزارة التعليم",
    admin: "الإدارة العامة للتعليم بمنطقة المدينة المنورة",
    school: "متوسطة سعد بن الربيع الأنصاري",
    ministryLogo: "/assets/ministry_logo.png",
    visionLogo: "/assets/vision_2030.png",
    nafsLogo: "/assets/nafs_logo.png"
  };

  /** روابط مطلقة حتى لا تختفي الصور داخل إطار الطباعة / window.open */
  function assetUrl(path) {
    var raw = String(path || "");
    if (!raw) return "";
    if (/^(https?:|data:)/i.test(raw)) return raw;
    try {
      if (typeof location !== "undefined" && location.origin) {
        return new URL(raw, location.origin + "/").href;
      }
    } catch (err) {}
    return raw;
  }

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

  function cleanDisplay(text) {
    return String(text == null ? "" : text)
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim();
  }

  function mathOrEsc(text, renderMath) {
    var cleaned = cleanDisplay(text);
    if (typeof renderMath === "function") return renderMath(cleaned);
    return esc(cleaned);
  }

  function domainOf(item) {
    var block = String((item && item.block) || "").toLowerCase();
    if (DOMAIN_META[block]) return block;
    var d = String((item && item.domain) || "").toLowerCase();
    if (DOMAIN_META[d]) return d;
    if (d.indexOf("math") >= 0 || d.indexOf("رياض") >= 0) return "math";
    if (d.indexOf("sci") >= 0 || d.indexOf("علوم") >= 0) return "science";
    if (d.indexOf("read") >= 0 || d.indexOf("قراء") >= 0 || d.indexOf("لغ") >= 0) return "reading";
    return "other";
  }

  function sortByN(items) {
    return (items || []).slice().sort(function (a, b) {
      return Number(a && a.n) - Number(b && b.n);
    });
  }

  function nRange(items) {
    var list = sortByN(items);
    if (!list.length) return { from: 1, to: 1 };
    var nums = list.map(function (it) {
      return Number(it.n) || 0;
    });
    return { from: Math.min.apply(null, nums), to: Math.max.apply(null, nums) };
  }

  /**
   * عقد α: تحقق أن الترقيم ١…ن متصل عالميًا وأن كتل المجالات متجاورة بلا تداخل.
   * يفترض أن الحزمة بُنيت بـ block-first (ترتيب الكتل ثم إسناد n).
   */
  function assertBlockFirstContiguous(items) {
    var errors = [];
    var list = sortByN(items);
    var allN = list.map(function (it) {
      return Number(it.n) || 0;
    });
    for (var i = 0; i < allN.length; i += 1) {
      if (allN[i] !== i + 1) {
        errors.push("global n not 1..N");
        break;
      }
    }
    var order = DOMAIN_ORDER.concat(["other"]);
    var blocks = { math: [], science: [], reading: [], other: [] };
    list.forEach(function (it) {
      blocks[domainOf(it)].push(Number(it.n) || 0);
    });
    var seen = [];
    order.forEach(function (key) {
      var nums = blocks[key];
      if (!nums.length) return;
      var expected = [];
      for (var k = nums[0]; k < nums[0] + nums.length; k += 1) expected.push(k);
      if (nums.join(",") !== expected.join(",")) {
        errors.push(key + " not contiguous");
      }
      seen.forEach(function (prev) {
        if (!(nums[nums.length - 1] < prev.from || nums[0] > prev.to)) {
          errors.push(key + " overlaps " + prev.key);
        }
      });
      seen.push({ key: key, from: nums[0], to: nums[nums.length - 1] });
    });
    return errors;
  }

  /** نطاق الأسئلة داخل span LTR حتى لا يندمج ٢٠–٤ إلى ٢٠٠٤ في RTL/PDF */
  function rangeHtml(fromN, toN) {
    return (
      '<span class="nafs-b-range etec-ltr" dir="ltr">' +
      east(fromN) +
      " – " +
      east(toN) +
      "</span>"
    );
  }

  function groupByDomain(items) {
    var buckets = { math: [], science: [], reading: [], other: [] };
    (items || []).forEach(function (item) {
      buckets[domainOf(item)].push(item);
    });
    var sections = [];
    DOMAIN_ORDER.forEach(function (key) {
      if (buckets[key].length) {
        sections.push({ key: key, items: sortByN(buckets[key]) });
      }
    });
    if (buckets.other.length) {
      sections.push({
        key: "other",
        items: sortByN(buckets.other),
        title: "أسئلة عامة"
      });
    }
    return sections;
  }

  function itemWeight(item) {
    var w = 1;
    if (item && item.passage_text) w += 2;
    if (item && item.diagram_svg) w += 2;
    var stemLen = String((item && item.stem) || "").length;
    if (stemLen > 180) w += 1;
    return w;
  }

  function minutesForCount(count) {
    var n = Math.max(1, Number(count) || 1);
    return Math.max(8, Math.round(n * 1.8));
  }

  /** ترويسة المدرسة الثلاثية لكراسة نافس المنزلية (هوية + شعاران، خارج القالب الرسمي المحصّن). */
  function schoolHeader(extraClass) {
    var cls = "nafs-b-school-header" + (extraClass ? " " + extraClass : "");
    return (
      '<header class="' +
      cls +
      '">' +
      '<div class="logo logo-ministry">' +
      '<img src="' +
      esc(assetUrl(IDENTITY.ministryLogo)) +
      '" alt="وزارة التعليم" width="140" height="52" loading="eager" decoding="sync">' +
      "</div>" +
      '<div class="identity">' +
      "<span>" +
      esc(IDENTITY.kingdom) +
      "</span>" +
      "<span>" +
      esc(IDENTITY.ministry) +
      "</span>" +
      "<span>" +
      esc(IDENTITY.admin) +
      "</span>" +
      '<span class="school">' +
      esc(IDENTITY.school) +
      "</span>" +
      "</div>" +
      '<div class="logo logo-vision">' +
      '<img src="' +
      esc(assetUrl(IDENTITY.visionLogo)) +
      '" alt="رؤية ٢٠٣٠" width="140" height="52" loading="eager" decoding="sync">' +
      "</div>" +
      "</header>"
    );
  }

  function nafsMark() {
    return (
      '<div class="logo logo-nafs nafs-b-nafs-mark">' +
      '<img src="' +
      esc(assetUrl(IDENTITY.nafsLogo)) +
      '" alt="نافس" width="100" height="44" loading="eager" decoding="sync">' +
      "</div>"
    );
  }

  function coverPage(pack) {
    return (
      '<section class="nafs-b-page is-sheet nafs-b-cover">' +
      schoolHeader() +
      '<div class="nafs-b-brand-row">' +
      nafsMark() +
      "</div>" +
      '<div class="nafs-b-cover-hero">' +
      "<h1>اختبار منزلي بإشراف ولي الأمر</h1>" +
      "<p>نماذج تدريبية على طراز الاختبارات الوطنية (نافس)</p>" +
      "<p>متوسطة سعد بن الربيع الأنصاري · الرقم الوزاري " +
      '<bdi class="etec-ltr etec-code" dir="ltr">' +
      esc(pack.ministry_id_ar || pack.code_ar || east(pack.code || "40341")) +
      "</bdi></p>" +
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
      '<bdi class="etec-ltr" dir="ltr">' +
      east((pack.items || []).length) +
      "</bdi></div>" +
      "<div><strong>الشاهد:</strong> " +
      '<bdi class="etec-ltr etec-code" dir="ltr">' +
      esc(pack.evidence_code_ar || "١-٣-١-٢") +
      "</bdi></div>" +
      "</div></section>"
    );
  }

  function dividerPage(section, index) {
    var meta = DOMAIN_META[section.key] || { title: section.title || "قسم" };
    var ordinal = SECTION_ORDINAL[index] || east(index + 1);
    var items = section.items || [];
    var range = nRange(items);
    var mins = minutesForCount(items.length);
    var instr = section.key === "reading" ? INSTR_READING : INSTR_COMMON;
    return (
      '<section class="nafs-b-page is-sheet nafs-b-divider">' +
      schoolHeader("is-on-divider") +
      '<div class="nafs-b-divider-panel">' +
      '<div class="nafs-b-divider-title">' +
      "<h2>القسم " +
      esc(ordinal) +
      ": " +
      esc(meta.title) +
      "</h2>" +
      "<p>الأسئلة: " +
      rangeHtml(range.from, range.to) +
      " <span class=\"nafs-b-count\">( " +
      east(items.length) +
      " )</span></p>" +
      "<p>الزمن: " +
      '<span class="etec-ltr" dir="ltr">' +
      east(mins) +
      "</span> دقيقة</p>" +
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

  function passageKey(item) {
    return (
      String((item && item.passage_title) || "").trim() +
      "\n" +
      String((item && item.passage_text) || "").trim()
    );
  }

  function questionBlock(item, renderMath, opts) {
    opts = opts || {};
    var passage = "";
    if (item.passage_text && !opts.hidePassage) {
      passage =
        '<div class="nafs-b-passage">' +
        (item.passage_title
          ? "<strong>" + esc(cleanDisplay(item.passage_title)) + "</strong>"
          : "") +
        esc(cleanDisplay(item.passage_text)) +
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
      '<span class="nafs-b-qnum etec-ltr" dir="ltr">' +
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

  function paginateSection(sectionItems) {
    var pages = [];
    var current = [];
    var weight = 0;
    var maxWeight = 5;
    (sectionItems || []).forEach(function (item) {
      var w = itemWeight(item);
      if (current.length && weight + w > maxWeight) {
        pages.push(current);
        current = [];
        weight = 0;
      }
      current.push(item);
      weight += w;
      if (weight >= maxWeight) {
        pages.push(current);
        current = [];
        weight = 0;
      }
    });
    if (current.length) pages.push(current);
    return pages;
  }

  function questionPages(sectionItems, renderMath) {
    var pages = [];
    var lastPassage = "";
    paginateSection(sectionItems).forEach(function (slice) {
      pages.push(
        '<section class="nafs-b-page is-flow nafs-b-qpage">' +
          schoolHeader() +
          '<div class="nafs-b-qpage-head">' +
          '<div class="brand"><span>الاختبارات الوطنية (نافس)</span><span>نموذج تدريبي</span></div>' +
          "</div>" +
          slice
            .map(function (it) {
              var key = passageKey(it);
              var hide = !!(it.passage_text && key && key === lastPassage);
              if (it.passage_text && key) lastPassage = key;
              return questionBlock(it, renderMath, { hidePassage: hide });
            })
            .join("") +
          "</section>"
      );
    });
    return pages.join("");
  }

  function answerLetterAr(ans) {
    var s = String(ans || "").trim();
    var map = { A: "أ", B: "ب", C: "ج", D: "د", a: "أ", b: "ب", c: "ج", d: "د" };
    if (map[s]) return map[s];
    if (/^[أاببججدد]$/.test(s)) {
      if (s === "ا" || s === "أ") return "أ";
      if (s === "ب") return "ب";
      if (s === "ج") return "ج";
      if (s === "د") return "د";
    }
    return s || "—";
  }

  function renderAnswerKey(pack) {
    pack = pack || {};
    var key = sortByN(pack.answer_key || []);
    var total = (pack.items || []).length || key.length;
    var items =
      '<div class="nafs-b-key-banner">مفتاح التصحيح لولي الأمر</div>' +
      '<p class="nafs-b-key-meta">عدد الأسئلة: <bdi class="etec-ltr" dir="ltr">' +
      east(total) +
      "</bdi> · ترقيم متصل <bdi class=\"etec-ltr\" dir=\"ltr\">١…" +
      east(total || 1) +
      "</bdi></p>" +
      (key.length
        ? '<ol class="nafs-b-key-grid nafs-b-key-list" start="1">' +
          key
            .map(function (r) {
              return (
                '<li class="nafs-b-key-item" value="' +
                Number(r.n || 0) +
                '">' +
                '<span class="n etec-ltr" dir="ltr">' +
                east(r.n) +
                "</span>" +
                '<span class="ans" aria-label="الإجابة">' +
                esc(answerLetterAr(r.answer)) +
                "</span>" +
                '<span class="skill">' +
                esc(cleanDisplay(r.skill || "")) +
                "</span>" +
                "</li>"
              );
            })
            .join("") +
          "</ol>"
        : '<p class="nafs-b-key-empty">لا مفتاح محفوظ لهذه الحزمة — تُعرض الإجابات المعتمدة فقط عند توفرها في البنك.</p>');

    return (
      '<section class="nafs-b-page is-flow is-last nafs-b-key" dir="rtl">' +
      schoolHeader() +
      items +
      '<div class="nafs-b-pledge">' +
      "<h3>إقرار ولي الأمر المراقب (شاهد <bdi class=\"etec-ltr etec-code\" dir=\"ltr\">" +
      esc(pack.evidence_code_ar || "١-٣-١-٢") +
      "</bdi>)</h3>" +
      "<p>" +
      esc(pack.parent_pledge || "") +
      "</p>" +
      '<div class="nafs-b-pledge-signs">' +
      "<div>اسم ولي الأمر<span></span></div>" +
      "<div>التوقيع<span></span></div>" +
      "<div>التاريخ<span></span></div>" +
      "</div></div></section>"
    );
  }

  function renderBooklet(pack, opts) {
    pack = pack || {};
    opts = opts || {};
    var renderMath = opts.renderArabicMath;
    var items = pack.items || [];
    // α: لا نعيد ترقيمًا هنا؛ نعتمد n من الحزمة بعد ترتيب الكتل في الخادم
    assertBlockFirstContiguous(items);
    var sections = groupByDomain(items);
    var html =
      '<div class="nafs-b-host" dir="rtl" lang="ar" data-sequencing="block-first">' +
      coverPage(pack);
    sections.forEach(function (section, idx) {
      html += dividerPage(section, idx);
      html += questionPages(section.items, renderMath);
    });
    if (!sections.length) {
      html +=
        '<section class="nafs-b-page is-flow"><p>لا أسئلة محفوظة في هذه الحزمة.</p></section>';
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
    assetUrl: assetUrl,
    cleanDisplay: cleanDisplay,
    nRange: nRange,
    rangeHtml: rangeHtml,
    sortByN: sortByN,
    domainOf: domainOf,
    assertBlockFirstContiguous: assertBlockFirstContiguous,
    renderBooklet: renderBooklet,
    renderAnswerKey: renderAnswerKey,
    schoolHeader: schoolHeader,
    nafsMark: nafsMark,
    groupByDomain: groupByDomain,
    cssHref: cssHref,
    INSTR_COMMON: INSTR_COMMON,
    INSTR_READING: INSTR_READING,
    IDENTITY: IDENTITY,
    DOMAIN_ORDER: DOMAIN_ORDER
  };
})(typeof window !== "undefined" ? window : globalThis);
