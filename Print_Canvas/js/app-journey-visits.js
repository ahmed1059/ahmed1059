/* زيارة المدير والوكيل للمعلمين. البنود والدرجات من واجهة الزيارة. */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var RATIO = { none: 0, partial: 0.5, met: 0.75, high: 1 };
  var LEVELS = [
    ["", ""],
    ["none", "لم يتحقق"],
    ["partial", "متحقق جزئياً"],
    ["met", "متحقق"],
    ["high", "متحقق بدرجة عالية"]
  ];
  var GRADES = ["الأول المتوسط", "الثاني المتوسط", "الثالث المتوسط"];
  var RANKS = ["معلم", "معلم ممارس", "معلم متقدم", "معلم خبير"];
  var ACTIONS = {
    planning: "يُعاد صياغة هدف الحصة بحيث يُلاحظ في عمل المتعلم.",
    warmup: "تبدأ الحصة بسؤال يربط الخبرة السابقة بالهدف.",
    strategies: "تُضاف استراتيجية تُشرك المتعلمين، لا عرضاً واحداً متصلاً.",
    content: "يُراجع المثال قبل الحصة ويُربط بالمهارة.",
    differences: "يُعد نشاط مساند لمن لم يبلغ الهدف، ونشاط أقصر لمن أتقن.",
    environment: "يُتفق على روتين قصير لبدء الحصة وإنهائها.",
    assessment: "يُطرح سؤال بنائي في منتصف الحصة وسؤال ختامي على الهدف نفسه.",
    closure: "تُختم الحصة بجملة تربط ما تحقق بالهدف، مع تغذية راجعة لطالبين."
  };
  var state = {
    items: [],
    criteria: [],
    phrases: {},
    types: [],
    indicators: [],
    ranks: RANKS,
    staff: [],
    visitors: [],
    peopleById: {},
    managerId: "",
    editing: 0
  };

  /** اسم صريح من السجل أو مقاعد الزوار — بلا عبارة دور جامدة. */
  function personNameById(nationalId) {
    var id = String(nationalId || "").trim();
    if (!id) {
      return "";
    }
    var fromMap = state.peopleById[id];
    if (fromMap && fromMap.name) {
      return String(fromMap.name);
    }
    var visitor = (state.visitors || []).filter(function (item) {
      return String(item.value) === id;
    })[0];
    if (visitor && visitor.name) {
      return String(visitor.name);
    }
    var teacher = (state.staff || []).filter(function (item) {
      return String(item.id) === id;
    })[0];
    return teacher && teacher.name ? String(teacher.name) : "";
  }

  /**
   * مصفوفة التوقيعات حسب صفة الزائر (Dynamic Signoff Matrix).
   * المدير زائر → خانتان 50/50؛ غير ذلك → ثلاث خانات.
   */
  function buildVisitSignatures(record, signs, managerId, managerName) {
    var signsMap = signs || {};
    var principalId = String(managerId || "").trim();
    var principalName = String(managerName || "").trim() || personNameById(principalId);
    var visitorId = String(record.visitor_id || "").trim();
    var teacherId = String(record.teacher_id || "").trim();
    var teacherName = personNameById(teacherId) || String(record.teacher_name || "").trim();
    var visitorName = personNameById(visitorId) || String(record.visitor_name || "").trim();
    var visitorIsPrincipal = !!(principalId && visitorId && visitorId === principalId);
    var teacherCol = {
      roleTitle: "المعلم المُزار",
      name: teacherName,
      id: teacherId,
      signature: signsMap[teacherId] || ""
    };
    if (visitorIsPrincipal) {
      return [
        teacherCol,
        {
          roleTitle: "الزائر المقيّم ومدير المدرسة",
          name: principalName,
          id: principalId,
          signature: signsMap[principalId] || signsMap[visitorId] || ""
        }
      ];
    }
    return [
      teacherCol,
      {
        roleTitle: "الزائر المقيّم",
        name: visitorName,
        id: visitorId,
        signature: signsMap[visitorId] || ""
      },
      {
        roleTitle: "اعتماد مدير المدرسة",
        name: principalName,
        id: principalId,
        signature: signsMap[principalId] || ""
      }
    ];
  }

  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function authHeaders() {
    var headers = { "Content-Type": "application/json" };
    var user = currentUser();
    if (user && user.token) {
      headers["X-Session-Token"] = user.token;
    }
    return headers;
  }

  function toast(message, kind) {
    var node = document.getElementById("aj-toast");
    if (!node) {
      return;
    }
    node.hidden = false;
    node.className = "aj-toast" + (kind ? " is-" + kind : "");
    node.textContent = message || "";
    window.setTimeout(function () {
      node.hidden = true;
    }, 2600);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function subjectOf(value) {
    var text = String(value || "").replace(/\s+/g, "");
    if (!text) {
      return "";
    }
    if (text.indexOf("أحي") !== -1 || text.indexOf("احي") !== -1 || text.indexOf("فيز") !== -1 || text.indexOf("كيم") !== -1 || text.indexOf("علوم") !== -1) {
      return "العلوم";
    }
    if (text.indexOf("رياض") !== -1 || text.indexOf("حساب") !== -1) {
      return "رياضيات";
    }
    if (text.indexOf("لغتي") !== -1 || text.indexOf("عربي") !== -1 || text.indexOf("لغةعربية") !== -1 || text.indexOf("اللغةالعربية") !== -1) {
      return "اللغة العربية";
    }
    if (text.indexOf("إسلام") !== -1 || text.indexOf("اسلام") !== -1 || text.indexOf("توحيد") !== -1 || text.indexOf("فقه") !== -1) {
      return "الدراسات الإسلامية";
    }
    if (text.indexOf("English") !== -1 || text.indexOf("انجليز") !== -1 || text.indexOf("إنجليز") !== -1 || text.indexOf("انجلي") !== -1) {
      return "اللغة الإنجليزية";
    }
    if (text.indexOf("اجتماع") !== -1 || text.indexOf("دراساتاجتماع") !== -1 || text.indexOf("وطني") !== -1) {
      return "الدراسات الاجتماعية";
    }
    if (text.indexOf("رقمي") !== -1 || text.indexOf("حاسب") !== -1 || text.indexOf("حاسوب") !== -1 || text.indexOf("تقنية") !== -1) {
      return "المهارات الرقمية";
    }
    return String(value || "").trim();
  }

  function curriculumSubjectKey(value) {
    var normalized = subjectOf(value);
    var map = (curriculumMap && curriculumMap.subjects) || {};
    if (normalized && map[normalized]) {
      return normalized;
    }
    if (normalized === "اللغة العربية" && map["لغتي الخالدة"]) {
      return "لغتي الخالدة";
    }
    var raw = String(value || "").trim();
    if (raw && map[raw]) {
      return raw;
    }
    if (map["لغتي الخالدة"] && /لغتي|عربي/.test(raw.replace(/\s+/g, ""))) {
      return "لغتي الخالدة";
    }
    return normalized && map[normalized] ? normalized : "";
  }

  function gradeKey(value) {
    var text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) {
      return "";
    }
    if (/أول|1\s*م|الأول/.test(text)) {
      return "الأول المتوسط";
    }
    if (/ثان|2\s*م|الثاني/.test(text)) {
      return "الثاني المتوسط";
    }
    if (/ثالث|3\s*م|الثالث/.test(text)) {
      return "الثالث المتوسط";
    }
    return text;
  }

  function subjectBankKey(value) {
    var normalized = subjectOf(value);
    var bank = (phraseBank && phraseBank.subjects) || {};
    if (normalized && bank[normalized]) {
      return normalized;
    }
    var raw = String(value || "").trim();
    if (raw && bank[raw]) {
      return raw;
    }
    var compact = raw.replace(/\s+/g, "");
    if (compact.indexOf("لغتي") !== -1 && bank["لغتي"]) {
      return "لغتي";
    }
    if ((compact.indexOf("عربي") !== -1 || compact.indexOf("لغةعربية") !== -1 || compact.indexOf("اللغةالعربية") !== -1) && bank["اللغة العربية"]) {
      return "اللغة العربية";
    }
    if (compact.indexOf("رياض") !== -1 && bank["رياضيات"]) {
      return "رياضيات";
    }
    if ((compact.indexOf("علوم") !== -1 || compact.indexOf("أحي") !== -1 || compact.indexOf("احي") !== -1 || compact.indexOf("فيز") !== -1 || compact.indexOf("كيم") !== -1) && bank["العلوم"]) {
      return "العلوم";
    }
    return "";
  }

  function visitContext() {
    function value(id) {
      var node = document.getElementById(id);
      return node ? String(node.value || "").trim() : "";
    }
    return {
      subject: value("aj-visit-subject"),
      lesson: value("aj-visit-lesson") || "الدرس",
      skill: value("aj-visit-skill") || "المهارة المستهدفة",
      unit: value("aj-visit-unit") || "",
      week: value("aj-visit-week") || "",
      grade: value("aj-visit-grade") || "",
      visitType: value("aj-visit-type"),
      visitDate: value("aj-visit-date")
    };
  }

  function fillTokens(text, ctx) {
    var lesson = (ctx && ctx.lesson) || "الدرس";
    var subject = subjectOf((ctx && ctx.subject) || "") || "المادة";
    var skill = (ctx && ctx.skill) || "المهارة المستهدفة";
    return String(text || "")
      .replace(/\{\{\s*lesson\s*\}\}/g, lesson)
      .replace(/\{\{\s*subject\s*\}\}/g, subject)
      .replace(/\{\{\s*skill\s*\}\}/g, skill);
  }

  function mapFill(list, ctx) {
    return (list || []).map(function (sentence) {
      return fillTokens(sentence, ctx);
    });
  }

  function cleanHijri(text) {
    return String(text || "")
      .replace(/هـ\s*هـ/g, "هـ")
      .replace(/(هـ)+/g, "هـ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeOverlap(a, b) {
    var left = String(a || "").replace(/\s+/g, " ").trim();
    var right = String(b || "").replace(/\s+/g, " ").trim();
    if (!left || !right) {
      return false;
    }
    if (left === right) {
      return true;
    }
    if (left.indexOf(right) >= 0 || right.indexOf(left) >= 0) {
      return true;
    }
    var leftCore = left.replace(/[0-9.\-–—]/g, " ").replace(/\s+/g, " ").trim();
    var rightCore = right.replace(/[0-9.\-–—]/g, " ").replace(/\s+/g, " ").trim();
    return leftCore && rightCore && (leftCore === rightCore || leftCore.indexOf(rightCore) >= 0 || rightCore.indexOf(leftCore) >= 0);
  }

  function options(list, selected, placeholder) {
    var html = "<option value=\"\">" + escapeHtml(placeholder || "") + "</option>";
    list.forEach(function (item) {
      var value = typeof item === "string" ? item : item.value;
      var label = typeof item === "string" ? item : item.label;
      html += "<option value=\"" + escapeHtml(value) + "\""
        + (String(value) === String(selected || "") ? " selected" : "")
        + ">" + escapeHtml(label) + "</option>";
    });
    return html;
  }

  function levelName(id) {
    var found = "";
    LEVELS.forEach(function (pair) {
      if (pair[0] === id) {
        found = pair[1];
      }
    });
    return found;
  }

  function phraseEntry(id, subject) {
    var key = subjectBankKey(subject);
    var subjectEntry = key && phraseBank && phraseBank.subjects && phraseBank.subjects[key]
      ? ((phraseBank.subjects[key].phrases || {})[id] || null)
      : null;
    if (subjectEntry && subjectEntry.lines) {
      return subjectEntry;
    }
    return ((phraseBank && phraseBank.phrases) || {})[id] || {};
  }

  function linePack(id, level, ctx) {
    ctx = ctx || visitContext();
    var entry = phraseEntry(id, ctx.subject);
    var lines = (entry.lines || {})[level] || {};
    var observe = mapFill(lines.observe || [], ctx);
    if (!observe.length) {
      var legacy = (state.phrases[id] || {})[level];
      if (legacy) {
        observe = [fillTokens(legacy, ctx)];
      }
    }
    return {
      observe: observe,
      strength: mapFill(lines.strength || [], ctx),
      feedback: mapFill(lines.feedback || [], ctx),
      need: mapFill(lines.need || [], ctx)
    };
  }

  function knownPhrase(id, text, ctx) {
    ctx = ctx || visitContext();
    var filled = String(text || "").trim();
    if (!filled) {
      return true;
    }
    var lesson = (ctx && ctx.lesson) || "الدرس";
    var asTemplate = lesson && lesson !== "الدرس"
      ? filled.split(lesson).join("{{lesson}}")
      : filled;
    var book = state.phrases[id] || {};
    if (Object.keys(book).some(function (key) {
      var legacy = book[key];
      return fillTokens(legacy, ctx) === filled || legacy === filled || legacy === asTemplate;
    })) {
      return true;
    }
    var packs = [phraseEntry(id, ctx.subject), ((phraseBank && phraseBank.phrases) || {})[id] || {}];
    var subjects = (phraseBank && phraseBank.subjects) || {};
    Object.keys(subjects).forEach(function (key) {
      packs.push((subjects[key].phrases || {})[id] || {});
    });
    return packs.some(function (pack) {
      return Object.keys((pack && pack.lines) || {}).some(function (level) {
        var observes = ((pack.lines[level] || {}).observe || []);
        return observes.some(function (raw) {
          return fillTokens(raw, ctx) === filled || raw === filled || raw === asTemplate;
        });
      });
    });
  }

  function pointsOf(weight, level) {
    return Math.round((RATIO[level] || 0) * Number(weight) * 100) / 100;
  }

  function paintTotal() {
    var form = document.getElementById("aj-visit-form");
    var total = 0;
    var any = false;
    if (!form) {
      return;
    }
    form.querySelectorAll("[data-visit-row]").forEach(function (row) {
      var level = row.querySelector("[data-visit-level]").value;
      var weight = Number(row.getAttribute("data-weight") || "0");
      var points = pointsOf(weight, level);
      if (level) {
        any = true;
        total += points;
      }
      row.querySelector("[data-visit-points]").textContent = level ? String(points) : "";
    });
    total = Math.round(total * 100) / 100;
    var node = document.getElementById("aj-visit-total");
    var band = document.getElementById("aj-visit-band");
    if (node) {
      node.textContent = any ? String(total) : "";
    }
    if (band) {
      band.textContent = !any ? "" : total >= 90 ? "ممتاز" : total >= 75 ? "متقدم" : total >= 60 ? "متمكن" : "بحاجة إلى دعم";
    }
    suggestFollowUp(false);
  }

  function syncPhrase(row, force, ctx) {
    ctx = ctx || visitContext();
    var id = row.getAttribute("data-visit-row");
    var level = row.querySelector("[data-visit-level]").value;
    var area = row.querySelector("[data-visit-phrase]");
    var choice = row.querySelector("[data-visit-choice]");
    var pack = linePack(id, level, ctx);
    var current = area.value.trim();
    var selected = pack.observe.indexOf(current) >= 0 ? current : (pack.observe[0] || "");
    if (choice) {
      choice.innerHTML = options(pack.observe, selected, "");
    }
    if (force || !current || knownPhrase(id, current, ctx)) {
      area.value = selected;
    }
  }

  function refreshPhrases(force) {
    var form = document.getElementById("aj-visit-form");
    var ctx = visitContext();
    if (!form) {
      return;
    }
    form.querySelectorAll("[data-visit-row]").forEach(function (row) {
      syncPhrase(row, !!force, ctx);
    });
    writeAdvice(!!force);
  }

  function field(label, control) {
    return "<label class=\"aj-field\"><span>" + escapeHtml(label) + "</span>" + control + "</label>";
  }

  function paintForm(item) {
    var form = document.getElementById("aj-visit-form");
    if (!form) {
      return;
    }
    item = item || {};
    state.editing = item.id || 0;
    var saved = {};
    (item.criteria || []).forEach(function (row) {
      saved[row.id] = row;
    });
    var subjects = [];
    state.staff.forEach(function (person) {
      var subject = subjectOf(person.specialty);
      if (subject && subjects.indexOf(subject) < 0) {
        subjects.push(subject);
      }
    });
    var teacherSpecialty = "";
    state.staff.forEach(function (person) {
      if (String(person.id) === String(item.teacher_id || "")) {
        teacherSpecialty = person.specialty || "";
      }
    });
    var subjectValue = subjectOf(item.subject) || subjectOf(teacherSpecialty);
    if (subjectValue && subjects.indexOf(subjectValue) < 0) {
      subjects.push(subjectValue);
    }
    var formCtx = {
      subject: subjectValue,
      lesson: item.lesson || "الدرس",
      skill: item.skill || "المهارة المستهدفة",
      visitType: item.visit_type || ""
    };
    var rows = state.criteria.map(function (spec) {
      var current = saved[spec.id] || {};
      var pack = linePack(spec.id, current.level || "", formCtx);
      var phrase = current.phrase || pack.observe[0] || "";
      return "<tr data-visit-row=\"" + escapeHtml(spec.id) + "\" data-weight=\"" + spec.weight + "\">"
        + "<td>" + escapeHtml(spec.label) + "</td>"
        + "<td>" + spec.weight + "</td>"
        + "<td><select data-visit-level>" + options(LEVELS.map(function (pair) {
          return { value: pair[0], label: pair[1] };
        }), current.level || "", "") + "</select></td>"
        + "<td data-visit-points>" + (current.level ? pointsOf(spec.weight, current.level) : "") + "</td>"
        + "<td><select data-visit-choice style=\"width:100%;margin-bottom:4px;\">" + options(pack.observe, phrase, "") + "</select>"
        + "<textarea data-visit-phrase rows=\"2\">" + escapeHtml(phrase) + "</textarea></td>"
        + "</tr>";
    }).join("");
    form.innerHTML = "<div class=\"aj-visit-grid\">"
      + field("الزائر", "<select id=\"aj-visit-visitor\" name=\"visitor\">" + options(state.visitors, item.visitor_id, "") + "</select>")
      + field("المعلم", "<select id=\"aj-visit-teacher\" name=\"teacher\">" + options(state.staff.map(function (person) {
        return { value: person.id, label: person.name + (person.specialty ? " — " + person.specialty : "") };
      }), item.teacher_id, "") + "</select>")
      + field("المسمى الوظيفي", "<select id=\"aj-visit-rank\">" + options(state.ranks, item.teacher_rank || rankMatch(item.teacher_id), "") + "</select>")
      + field("نوع الزيارة", "<select id=\"aj-visit-type\">" + options(state.types, item.visit_type || "تقويمية", "") + "</select>")
      + field("المؤشر", "<select id=\"aj-visit-indicator\">" + options(state.indicators, item.indicator || "2-1 بناء خبرات التعلم", "") + "</select>")
      + field("الصف", "<select id=\"aj-visit-grade\">" + options(GRADES, item.grade, "") + "</select>")
      + field("الفصل", "<select id=\"aj-visit-section\">" + options(["1", "2", "3", "4"], item.section_no, "") + "</select>")
      + field("المادة", "<select id=\"aj-visit-subject\">" + options(subjects, subjectValue, "") + "</select>")
      + field("الحصة", "<select id=\"aj-visit-period\">" + options(["1", "2", "3", "4", "5", "6", "7"], item.period_no, "") + "</select>")
      + field("أسبوع المقرر", "<select id=\"aj-visit-week\">" + options(weekOptionsFor(subjectValue, item.grade), item.week || "", "أسبوع المقرر") + "</select>")
      + field("الوحدة", "<input id=\"aj-visit-unit\" type=\"text\" value=\"" + escapeHtml(item.unit || "") + "\">")
      + field("موضوع الدرس", "<input id=\"aj-visit-lesson\" type=\"text\" value=\"" + escapeHtml(item.lesson || "") + "\">")
      + field("المهارة", "<input id=\"aj-visit-skill\" type=\"text\" value=\"" + escapeHtml(item.skill || "") + "\">")
      + field("تاريخ الزيارة", "<span class=\"aj-visit-dates\"><input id=\"aj-visit-date\" type=\"date\" value=\"" + escapeHtml(item.visit_date || "") + "\"><input id=\"aj-visit-hijri\" type=\"text\" value=\"" + escapeHtml(cleanHijri(item.visit_date_hijri || "")) + "\" placeholder=\"التاريخ الهجري\"></span>")
      + "</div>"
      + "<h2 class=\"aj-group-title\">بنود التقويم</h2>"
      + "<table class=\"aj-visit-table\"><thead><tr><th>البند</th><th>الوزن</th><th>المستوى</th><th>الدرجة</th><th>العبارة</th></tr></thead><tbody>"
      + rows
      + "</tbody></table>"
      + "<p class=\"aj-summary\">المجموع <strong id=\"aj-visit-total\">" + (item.total != null && item.band ? item.total : "") + "</strong> <span id=\"aj-visit-band\">" + escapeHtml(item.band || "") + "</span></p>"
      + field("افتتاحية الزائر", "<select id=\"aj-visit-intro\">" + options((function () {
        var survey = /استطلاع/.test(String(item.visit_type || ""));
        var surveyList = (phraseBank && phraseBank.intros_survey) || [];
        var generalList = (phraseBank && phraseBank.intros) || [];
        return survey ? surveyList.concat(generalList) : generalList;
      })(), item.visit_intro || "", "") + "</select>")
      + field("أبرز جوانب التميز", "<select id=\"aj-visit-strength-pick\">" + options([], "", "النص المرتبط بالمستويات") + "</select><textarea id=\"aj-visit-strengths\" rows=\"2\">" + escapeHtml(item.strengths || "") + "</textarea>")
      + field("التغذية الراجعة المقدمة", "<select id=\"aj-visit-feedback-pick\">" + options([], "", "النص المرتبط بالمستويات") + "</select><textarea id=\"aj-visit-notes\" rows=\"2\">" + escapeHtml(item.recommendations || "") + "</textarea>")
      + field("خطة التحسين", "<textarea id=\"aj-visit-plan\" rows=\"2\">" + escapeHtml(item.improvement || "") + "</textarea>")
      + field("موعد المتابعة", "<span class=\"aj-visit-dates\"><input id=\"aj-visit-follow-g\" type=\"date\" value=\"" + escapeHtml(item.follow_gregorian || "") + "\"><input id=\"aj-visit-follow-h\" type=\"text\" value=\"" + escapeHtml(cleanHijri(item.follow_hijri || "")) + "\" placeholder=\"التاريخ الهجري\"></span>")
      + "<div class=\"aj-visit-actions\">"
      + "<button type=\"submit\" class=\"aj-detail-btn\">حفظ</button>"
      + "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary\" id=\"aj-visit-full\">توليد الدرجة الكاملة</button>"
      + "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary\" id=\"aj-visit-all\">توليد زيارة كاملة لكل المعلمين</button>"
      + "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary\" id=\"aj-visit-print\">طباعة</button>"
      + "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary\" id=\"aj-visit-new\">زيارة جديدة</button>"
      + "<button type=\"button\" class=\"aj-detail-btn aj-council-delete\" id=\"aj-visit-clear\">حذف جميع الزيارات</button>"
      + "<a class=\"aj-detail-btn aj-detail-btn-secondary\" href=\"#view-desk\">العودة</a>"
      + "</div>";
    var known = {};
    [
      "الاستمرار على الممارسات المتحققة، وتوثيق الشواهد في ملف المعلم.",
      "لا توجد فجوة ظاهرة في هذه الزيارة. تُراجع البنود عند الزيارة التالية.",
      "الممارسات متحققة في التخطيط والتهيئة والتنفيذ والتقويم. يُوثَّق شاهد من الحصة في ملف المعلم.",
      "تُثبَّت هذه الممارسات في الزيارة التالية، مع نشاط قصير يساند المتعلم الذي يحتاج وقتاً أطول."
    ].forEach(function (sentence) {
      known[sentence] = true;
    });
    var introBox = document.getElementById("aj-visit-intro");
    var strengthBox = document.getElementById("aj-visit-strengths");
    var notesBox = document.getElementById("aj-visit-notes");
    var planBox = document.getElementById("aj-visit-plan");
    if (introBox && !introBox.value) {
      introBox.dataset.auto = "1";
    }
    if (strengthBox && !strengthBox.value.trim()) {
      strengthBox.dataset.auto = "1";
    }
    if (notesBox && isAutoText(notesBox.value)) {
      notesBox.dataset.auto = "1";
    }
    if (planBox && (isAutoText(planBox.value) || (notesBox && notesBox.dataset.auto === "1"))) {
      planBox.dataset.auto = "1";
    }
    ["aj-visit-unit", "aj-visit-lesson", "aj-visit-skill", "aj-visit-follow-g"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node && !String(node.value || "").trim()) {
        node.dataset.auto = "1";
      }
    });
    applyCurriculumFill(false);
    writeAdvice(false);
    paintTotal();
    suggestFollowUp(false);
  }

  function readCriteria() {
    var form = document.getElementById("aj-visit-form");
    var rows = [];
    if (!form) {
      return rows;
    }
    form.querySelectorAll("[data-visit-row]").forEach(function (row) {
      rows.push({
        id: row.getAttribute("data-visit-row"),
        level: row.querySelector("[data-visit-level]").value,
        phrase: row.querySelector("[data-visit-phrase]").value.trim()
      });
    });
    return rows;
  }

  function payloadFromForm() {
    function value(id) {
      var node = document.getElementById(id);
      return node ? String(node.value || "").trim() : "";
    }
    return {
      teacher_id: value("aj-visit-teacher"),
      visitor_id: value("aj-visit-visitor"),
      visit_type: value("aj-visit-type"),
      indicator: value("aj-visit-indicator"),
      grade: value("aj-visit-grade"),
      section_no: value("aj-visit-section"),
      subject: value("aj-visit-subject"),
      period_no: value("aj-visit-period"),
      week: value("aj-visit-week"),
      unit: value("aj-visit-unit"),
      lesson: value("aj-visit-lesson"),
      skill: value("aj-visit-skill"),
      teacher_rank: value("aj-visit-rank"),
      visit_date: value("aj-visit-date"),
      visit_date_hijri: cleanHijri(value("aj-visit-hijri")),
      visit_intro: value("aj-visit-intro"),
      strengths: value("aj-visit-strengths"),
      recommendations: value("aj-visit-notes"),
      improvement: value("aj-visit-plan"),
      follow_hijri: cleanHijri(value("aj-visit-follow-h")),
      follow_gregorian: value("aj-visit-follow-g"),
      criteria: readCriteria()
    };
  }

  function rankMatch(id) {
    var role = rankOf(id);
    return state.ranks.indexOf(role) >= 0 ? role : "";
  }

  var phraseBank = null;
  var curriculumMap = null;
  var calendarStarts = null;

  function loadCurriculumMap() {
    if (curriculumMap) {
      return Promise.resolve(curriculumMap);
    }
    return fetch("data/curriculum-map.json", { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("تعذر قراءة خريطة المناهج");
      }
      return response.json();
    }).then(function (pack) {
      curriculumMap = pack && pack.subjects ? pack : { subjects: {} };
      return curriculumMap;
    }).catch(function () {
      curriculumMap = { subjects: {} };
      return curriculumMap;
    });
  }

  function loadCalendarStarts() {
    if (calendarStarts) {
      return Promise.resolve(calendarStarts);
    }
    return fetch("data/calendar_1448.json", { cache: "no-store" }).then(function (response) {
      return response && response.ok ? response.json() : {};
    }).catch(function () {
      return {};
    }).then(function (pack) {
      var year = (pack && pack["1448"]) || pack || {};
      var region = year["المدينة المنورة"] || year["مكة المكرمة"] || Object.keys(year).map(function (key) {
        return year[key];
      })[0] || {};
      calendarStarts = region;
      return calendarStarts;
    });
  }

  function isoAddDays(iso, days) {
    var date = new Date(String(iso || "") + "T12:00:00");
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    date.setDate(date.getDate() + Number(days || 0));
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1);
    var d = String(date.getDate());
    if (m.length < 2) m = "0" + m;
    if (d.length < 2) d = "0" + d;
    return y + "-" + m + "-" + d;
  }

  function schoolWeekOf(iso) {
    var starts = calendarStarts || {};
    var visit = new Date(String(iso || "") + "T12:00:00");
    if (Number.isNaN(visit.getTime())) {
      return 0;
    }
    var best = null;
    Object.keys(starts).forEach(function (sem) {
      var info = starts[sem] || {};
      var start = new Date(String(info.start || "") + "T12:00:00");
      if (Number.isNaN(start.getTime()) || visit < start) {
        return;
      }
      var weeks = Number(info.weeks || 18) || 18;
      var diff = Math.floor((visit.getTime() - start.getTime()) / 86400000);
      var week = Math.floor(diff / 7) + 1;
      if (week < 1 || week > weeks) {
        return;
      }
      if (!best || start > best.start) {
        best = { week: week, start: start, semester: sem };
      }
    });
    return best ? best.week : 0;
  }

  function curriculumEntry(subject, grade, week) {
    var subjects = (curriculumMap && curriculumMap.subjects) || {};
    var subj = curriculumSubjectKey(subject);
    var grd = gradeKey(grade);
    var book = subjects[subj] || {};
    var gradeBook = book[grd] || {};
    return gradeBook[String(week || "")] || null;
  }

  function weekOptionsFor(subject, grade) {
    var subjects = (curriculumMap && curriculumMap.subjects) || {};
    var subj = curriculumSubjectKey(subject);
    var grd = gradeKey(grade);
    var gradeBook = ((subjects[subj] || {})[grd]) || {};
    return Object.keys(gradeBook).sort(function (a, b) {
      return Number(a) - Number(b);
    }).map(function (week) {
      var entry = gradeBook[week] || {};
      return {
        value: week,
        label: "أ" + week + " — " + (entry.lesson || entry.unit || week)
      };
    });
  }

  function applyCurriculumFill(force) {
    var ctx = visitContext();
    var weekNode = document.getElementById("aj-visit-week");
    var unitNode = document.getElementById("aj-visit-unit");
    var lessonNode = document.getElementById("aj-visit-lesson");
    var skillNode = document.getElementById("aj-visit-skill");
    var optionsList = weekOptionsFor(ctx.subject, ctx.grade);
    var selectedWeek = ctx.week;
    if (weekNode) {
      if (!selectedWeek || force) {
        var autoWeek = schoolWeekOf(ctx.visitDate);
        if (autoWeek) {
          selectedWeek = String(autoWeek);
        }
      }
      weekNode.innerHTML = options(optionsList, selectedWeek, "أسبوع المقرر");
      if (selectedWeek) {
        weekNode.value = selectedWeek;
      }
    }
    var entry = curriculumEntry(ctx.subject, ctx.grade, weekNode ? weekNode.value : selectedWeek);
    if (!entry) {
      return null;
    }
    if (unitNode && (force || unitNode.dataset.auto === "1" || !unitNode.value.trim())) {
      unitNode.value = entry.unit || "";
      unitNode.dataset.auto = "1";
    }
    if (lessonNode && (force || lessonNode.dataset.auto === "1" || !lessonNode.value.trim())) {
      lessonNode.value = entry.lesson || "";
      lessonNode.dataset.auto = "1";
    }
    if (skillNode && (force || skillNode.dataset.auto === "1" || !skillNode.value.trim())) {
      skillNode.value = entry.skill || "";
      skillNode.dataset.auto = "1";
    }
    return entry;
  }

  function suggestFollowUp(force) {
    var dateNode = document.getElementById("aj-visit-date");
    var followG = document.getElementById("aj-visit-follow-g");
    var band = document.getElementById("aj-visit-band");
    if (!dateNode || !followG || !dateNode.value) {
      return;
    }
    var needsSupport = band && /بحاجة/.test(String(band.textContent || ""));
    var totalNode = document.getElementById("aj-visit-total");
    var total = totalNode ? Number(totalNode.textContent || "") : NaN;
    if (!needsSupport && !(isFinite(total) && total < 60)) {
      return;
    }
    if (!force && followG.value && followG.dataset.auto !== "1") {
      return;
    }
    // 14–21 يوماً: نأخذ 18 يوماً وسط المجال
    followG.value = isoAddDays(dateNode.value, 18);
    followG.dataset.auto = "1";
    applyHijri("aj-visit-follow-g", "aj-visit-follow-h");
  }

  function loadPhraseBank() {
    if (phraseBank) {
      return Promise.resolve(phraseBank);
    }
    return fetch("data/pedagogical-phrases.json", { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("تعذر قراءة بنك العبارات");
      }
      return response.json();
    }).then(function (pack) {
      phraseBank = pack && (pack.phrases || pack.subjects) ? pack : { phrases: {} };
      return phraseBank;
    }).catch(function () {
      phraseBank = { phrases: {} };
      return phraseBank;
    });
  }

  function pickIntro(ctx) {
    var survey = /استطلاع/.test(String((ctx && ctx.visitType) || ""));
    var list = survey
      ? ((phraseBank && phraseBank.intros_survey) || []).concat((phraseBank && phraseBank.intros) || [])
      : ((phraseBank && phraseBank.intros) || []);
    return list[0] || "";
  }

  function textFromLevels(rows, ctx) {
    ctx = ctx || visitContext();
    var ranked = rows.filter(function (row) {
      return row.level;
    }).slice().sort(function (a, b) {
      return (RATIO[a.level] || 0) - (RATIO[b.level] || 0);
    });
    var byId = {};
    ranked.forEach(function (row) {
      byId[row.id] = row;
    });
    var planningNone = byId.planning && byId.planning.level === "none";
    var strengths = [];
    var feedback = [];
    var improvement = [];
    var picks = { strength: [], feedback: [] };
    var usedFeedback = [];

    function acceptableStrength(row, sentence) {
      if (!sentence) {
        return false;
      }
      if (planningNone && row.id === "strategies" && /وافق الهدف|ناسب الهدف|هدف الحصة|هدف \{\{lesson\}\}/.test(sentence)) {
        return false;
      }
      if (planningNone && /وافق الهدف|وافقت الهدف/.test(sentence)) {
        return false;
      }
      return true;
    }

    ranked.forEach(function (row) {
      var pack = linePack(row.id, row.level, ctx);
      pack.strength.forEach(function (sentence) {
        if (acceptableStrength(row, sentence) && picks.strength.indexOf(sentence) < 0) {
          picks.strength.push(sentence);
        }
      });
      // التغذية الراجعة للبنود الناقصة فقط (أقل من الدرجة الكاملة)
      if (row.level && row.level !== "high") {
        pack.feedback.forEach(function (sentence) {
          if (sentence && picks.feedback.indexOf(sentence) < 0) {
            picks.feedback.push(sentence);
          }
        });
        var tip = pack.feedback[0] || "";
        if (tip && usedFeedback.indexOf(tip) < 0 && feedback.length < 5) {
          feedback.push(tip);
          usedFeedback.push(tip);
        }
        var need = pack.need[0] || "";
        if (need && improvement.length < 4) {
          var clash = feedback.some(function (line) {
            return normalizeOverlap(line, need);
          }) || improvement.some(function (line) {
            return normalizeOverlap(line, need);
          });
          if (!clash) {
            improvement.push(need);
          }
        }
      }
      if (row.level === "high" || row.level === "met") {
        var strength = pack.strength[0] || "";
        if (acceptableStrength(row, strength) && strengths.indexOf(strength) < 0 && strengths.length < 3) {
          // إن كانت strategies met مع تخطيط صفر، استبدل بعبارة محتوى الدرس
          if (planningNone && row.id === "strategies") {
            strength = fillTokens("اختيار الاستراتيجية ناسب محتوى {{lesson}} المعروض دون ادعاء وضوح هدف مكتوب.", ctx);
          }
          if (strength) {
            strengths.push(strength);
          }
        }
      }
    });

    // لا تُملأ التغذية الراجعة من بنود مكتملة حتى لو بقيت قصيرة
    var intro = pickIntro(ctx);
    if (!strengths.length && !feedback.length && !improvement.length && !intro) {
      return null;
    }
    var numbered = improvement.slice(0, 4).map(function (step, index) {
      return (index + 1) + ". " + step;
    });
    return {
      intro: intro,
      strengths: strengths.join(" "),
      recommendations: feedback.slice(0, 5).join(" "),
      improvement: numbered.join("\n"),
      picks: picks
    };
  }

  function isAutoText(value) {
    var text = String(value || "").trim();
    if (!text) {
      return true;
    }
    return text.indexOf("يُستمر على") === 0
      || text.indexOf("يُدعم") === 0
      || text.indexOf("الاستمرار على الممارسات") === 0
      || text.indexOf("الممارسات متحققة") === 0
      || text.indexOf("لا توجد فجوة") === 0
      || text.indexOf("تُثبَّت هذه الممارسات") === 0;
  }

  function adviceText() {
    var rows = readCriteria().filter(function (row) {
      return row.level;
    });
    if (!rows.length) {
      return null;
    }
    return textFromLevels(rows, visitContext());
  }

  function fillPick(id, sentences) {
    var node = document.getElementById(id);
    if (!node) {
      return;
    }
    var current = node.value;
    node.innerHTML = options(sentences || [], sentences.indexOf(current) >= 0 ? current : "", "النص المرتبط بالمستويات");
  }

  function writeAdvice(force) {
    var text = adviceText();
    var intro = document.getElementById("aj-visit-intro");
    var strengths = document.getElementById("aj-visit-strengths");
    var notes = document.getElementById("aj-visit-notes");
    var plan = document.getElementById("aj-visit-plan");
    if (!text || !notes || !plan) {
      return;
    }
    fillPick("aj-visit-strength-pick", text.picks.strength);
    fillPick("aj-visit-feedback-pick", text.picks.feedback);
    if (intro && (force || intro.dataset.auto === "1" || !intro.value)) {
      if (!intro.value) {
        intro.value = text.intro;
      }
      intro.dataset.auto = intro.value === text.intro ? "1" : "";
    }
    if (strengths && (force || !strengths.value.trim() || strengths.dataset.auto === "1")) {
      strengths.value = text.strengths;
      strengths.dataset.auto = "1";
    }
    if (force || !notes.value.trim() || notes.dataset.auto === "1") {
      notes.value = text.recommendations;
      notes.dataset.auto = "1";
    }
    if (force || !plan.value.trim() || plan.dataset.auto === "1") {
      plan.value = text.improvement;
      plan.dataset.auto = "1";
    }
  }

  function rankOf(id) {
    var found = "";
    state.staff.forEach(function (person) {
      if (String(person.id) === String(id || "")) {
        found = person.role || "";
      }
    });
    return found;
  }

  function personName(id) {
    var found = "";
    state.staff.concat(state.visitors).forEach(function (person) {
      if (String(person.id || person.value) === String(id)) {
        found = person.name || person.label || found;
      }
    });
    return found;
  }

  function paintList() {
    var list = document.getElementById("aj-visit-list");
    if (!list) {
      return;
    }
    if (!state.items.length) {
      list.innerHTML = "<li class=\"aj-meta\">لا زيارات محفوظة بعد.</li>";
      return;
    }
    list.innerHTML = state.items.map(function (item) {
      var bits = [item.teacher_name, subjectOf(item.subject), item.visit_type, item.band, item.total != null ? String(item.total) : ""];
      return "<li><span>" + escapeHtml(bits.filter(Boolean).join(" · ")) + "</span>"
        + "<span class=\"aj-visit-actions\">"
        + "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary\" data-visit-open=\"" + item.id + "\">فتح</button>"
        + "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary\" data-visit-print=\"" + item.id + "\">طباعة</button>"
        + "<button type=\"button\" class=\"aj-council-delete\" data-visit-delete=\"" + item.id + "\">حذف</button>"
        + "</span></li>";
    }).join("");
  }

  function applyHijri(dateId, hijriId) {
    var date = document.getElementById(dateId);
    var hijri = document.getElementById(hijriId);
    if (!date || !hijri || !date.value || !window.AjDates) {
      return;
    }
    var text = cleanHijri(window.AjDates.hijri(date.value));
    if (text) {
      hijri.value = text;
    }
  }

  function fillFull() {
    var form = document.getElementById("aj-visit-form");
    if (!form) {
      return;
    }
    var type = document.getElementById("aj-visit-type");
    var indicator = document.getElementById("aj-visit-indicator");
    if (type && !type.value) {
      type.value = "تقويمية";
    }
    if (indicator && !indicator.value) {
      indicator.value = "2-1 بناء خبرات التعلم";
    }
    form.querySelectorAll("[data-visit-row]").forEach(function (row) {
      row.querySelector("[data-visit-level]").value = "high";
      syncPhrase(row, true);
    });
    writeAdvice(true);
    paintTotal();
  }

  function save(event) {
    event.preventDefault();
    var body = payloadFromForm();
    if (!body.teacher_id || !body.visitor_id) {
      toast("اختر الزائر والمعلم.", "error");
      return;
    }
    var url = state.editing
      ? "/api/session/classroom-visits/" + state.editing
      : "/api/session/classroom-visits";
    fetch(url, {
      method: state.editing ? "PUT" : "POST",
      headers: authHeaders(),
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error((payload && payload.detail) || "تعذر الحفظ.");
        }
        return payload;
      });
    }).then(function () {
      toast("حُفظت الزيارة.", "success");
      return load();
    }).catch(function (error) {
      toast(error.message || "تعذر الحفظ.", "error");
    });
  }

  function generateAll() {
    var body = payloadFromForm();
    fetch("/api/session/classroom-visits/generate-full", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        visitor_id: body.visitor_id,
        visit_type: body.visit_type || "تقويمية",
        indicator: body.indicator || "2-1 بناء خبرات التعلم",
        visit_date: body.visit_date,
        visit_date_hijri: body.visit_date_hijri
      })
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error((payload && payload.detail) || "تعذر التوليد.");
        }
        return payload;
      });
    }).then(function (payload) {
      toast("أُنشئت " + (payload.created || 0) + " زيارة بالدرجة الكاملة.", "success");
      return load();
    }).catch(function (error) {
      toast(error.message || "تعذر التوليد.", "error");
    });
  }

  function dateLine(hijri, iso) {
    var clean = cleanHijri(hijri);
    var gregorian = iso && window.AjDates ? window.AjDates.gregorian(iso) : "";
    if (clean && gregorian) {
      return clean + "، الموافق " + gregorian;
    }
    return clean || gregorian || "";
  }

  function printRecord(record) {
    if (!window.PrintEngine || typeof window.PrintEngine.open !== "function") {
      toast("بوابة PrintEngine غير محمّلة.", "error");
      return;
    }
    if (!window.PrintMasterCore || typeof window.PrintMasterCore.sheet !== "function") {
      toast("نواة الطباعة غير محمّلة.", "error");
      return;
    }
    Promise.all([
      loadPhraseBank(),
      loadCurriculumMap(),
      fetch("/api/session/leadership", { headers: authHeaders(), cache: "no-store" })
        .then(function (response) {
          return response.ok ? response.json() : {};
        }).catch(function () {
          return {};
        }),
      fetch("/api/noor/staff", { headers: authHeaders(), cache: "no-store" })
        .then(function (response) {
          return response.ok ? response.json() : { people: [] };
        }).catch(function () {
          return { people: [] };
        })
    ]).then(function (parts) {
      var leadership = parts[2] || {};
      var people = (parts[3] && parts[3].people) || [];
      if (people.length) {
        var map = {};
        people.forEach(function (person) {
          if (!person) {
            return;
          }
          map[String(person.id || person.national_id || "")] = person;
        });
        state.peopleById = map;
      }
      var managerId = String(state.managerId || leadership.manager || "").trim();
      var managerName = personNameById(managerId);
      var ids = [record.visitor_id, record.teacher_id, managerId].filter(Boolean);
      return fetch("/api/session/signatures?ids=" + encodeURIComponent(ids.join(",")), {
        headers: authHeaders(),
        cache: "no-store"
      }).then(function (response) {
        return response.ok ? response.json() : { signatures: {} };
      }).catch(function () {
        return { signatures: {} };
      }).then(function (sigBody) {
        return {
          signs: (sigBody && sigBody.signatures) || {},
          managerId: managerId,
          managerName: managerName
        };
      });
    }).then(function (pack) {
      var signs = pack.signs || {};
      var managerId = pack.managerId || "";
      var managerName = pack.managerName || "";
      var printCtx = {
        subject: record.subject || "",
        lesson: record.lesson || "الدرس",
        skill: record.skill || "المهارة المستهدفة",
        visitType: record.visit_type || ""
      };
      var spoken = textFromLevels(record.criteria || [], printCtx);
      var recAuto = isAutoText(record.recommendations);
      var planAuto = isAutoText(record.improvement);
      if (spoken && recAuto) {
        record.visit_intro = record.visit_intro || spoken.intro;
        record.strengths = record.strengths || spoken.strengths;
        record.recommendations = spoken.recommendations;
        record.improvement = spoken.improvement;
      } else if (spoken && planAuto) {
        record.improvement = spoken.improvement;
      }
      if (record.improvement) {
        var planBits = String(record.improvement).split(/\n+/).filter(Boolean);
        if (planBits.length === 1) {
          planBits = String(record.improvement).split(/\s*(?=\d+\.\s)/).filter(Boolean);
        }
        record.improvement = planBits.map(function (step, index) {
          var cleaned = String(step).replace(/^\d+\.\s*/, "").trim();
          return (index + 1) + ". " + cleaned;
        }).join("\n");
      }
      var rows = (record.criteria || []).map(function (row) {
        return "<tr><td style=\"width:24%;padding:1mm 1.5mm;border:1px solid #9db8b2;font-size:11px;\">" + escapeHtml(row.label) + "</td>"
          + "<td style=\"width:14%;padding:1mm;border:1px solid #9db8b2;font-size:11px;\">" + escapeHtml(levelName(row.level)) + "</td>"
          + "<td style=\"width:52%;padding:1mm;border:1px solid #9db8b2;font-size:11px;\">" + escapeHtml(fillTokens(row.phrase || "", printCtx)) + "</td>"
          + "<td style=\"width:10%;padding:1mm;border:1px solid #9db8b2;font-size:11px;text-align:center;\">" + escapeHtml(row.points) + "</td></tr>";
      }).join("");
      var metaGrid = [
        ["المعلم", record.teacher_name],
        ["المسمى الوظيفي", record.teacher_rank || rankMatch(record.teacher_id)],
        ["المادة", subjectOf(record.subject)],
        ["الصف", [record.grade, record.section_no ? "فصل " + record.section_no : ""].filter(Boolean).join(" · ")],
        ["الحصة", record.period_no],
        ["الوحدة", record.unit],
        ["الدرس", record.lesson],
        ["المهارة", record.skill],
        ["نوع الزيارة", record.visit_type],
        ["المؤشر", record.indicator],
        ["التاريخ", dateLine(record.visit_date_hijri, record.visit_date)],
        ["الزائر", [record.visitor_role, record.visitor_name].filter(Boolean).join(" · ")]
      ].filter(function (pair) {
        return String(pair[1] || "").trim();
      });
      var sections = [];
      sections.push("<table style=\"width:100%;border-collapse:collapse;table-layout:fixed;margin:0 auto;\"><thead><tr>"
        + "<th style=\"width:24%;padding:1mm;border:1px solid #0b5e56;font-size:11px;\">البند</th>"
        + "<th style=\"width:14%;padding:1mm;border:1px solid #0b5e56;font-size:11px;\">المستوى</th>"
        + "<th style=\"width:52%;padding:1mm;border:1px solid #0b5e56;font-size:11px;\">العبارة</th>"
        + "<th style=\"width:10%;padding:1mm;border:1px solid #0b5e56;font-size:11px;\">الدرجة</th>"
        + "</tr></thead><tbody>" + rows + "</tbody></table>");
      if (record.band) {
        sections.push("<p class=\"tpl-p\"><strong>المجموع:</strong> " + escapeHtml(record.total) + " — " + escapeHtml(record.band) + "</p>");
      }
      if (record.visit_intro) {
        sections.push("<p class=\"tpl-p\">" + escapeHtml(record.visit_intro) + "</p>");
      }
      if (record.strengths) {
        sections.push("<p class=\"tpl-p\"><strong>أبرز جوانب التميز:</strong> " + escapeHtml(record.strengths) + "</p>");
      }
      if (record.recommendations) {
        sections.push("<p class=\"tpl-p\"><strong>التغذية الراجعة المقدمة:</strong> " + escapeHtml(record.recommendations) + "</p>");
      }
      if (record.improvement) {
        sections.push("<p class=\"tpl-p\" style=\"white-space:pre-line;\"><strong>خطة التحسين:</strong>\n" + escapeHtml(record.improvement) + "</p>");
      }
      var follow = dateLine(record.follow_hijri, record.follow_gregorian);
      if (follow) {
        sections.push("<p class=\"tpl-p\"><strong>موعد المتابعة:</strong> " + escapeHtml(follow) + "</p>");
      }
      var visitorLabel = personNameById(record.visitor_id) || record.visitor_name || "";
      var visitorRole = "";
      (state.visitors || []).forEach(function (item) {
        if (String(item.value) === String(record.visitor_id || "")) {
          visitorRole = item.role || "";
          if (!visitorLabel) {
            visitorLabel = item.name || "";
          }
        }
      });
      if (!visitorRole && String(record.visitor_id || "") === String(managerId)) {
        visitorRole = "مدير المدرسة";
      }
      metaGrid = metaGrid.map(function (pair) {
        if (pair[0] === "الزائر") {
          return ["الزائر", [visitorRole, visitorLabel].filter(Boolean).join(" · ")];
        }
        return pair;
      }).filter(function (pair) {
        return String(pair[1] || "").trim();
      });
      window.PrintEngine.open("master-sheet", {
        docTitle: "تقرير زيارة صفية",
        orientation: "landscape",
        kind: "document",
        fileName: "تقرير زيارة - " + (record.teacher_name || ""),
        metaGrid: metaGrid,
        sectionsHtml: sections.join(""),
        signatures: buildVisitSignatures(record, signs, managerId, managerName),
        multiPage: true
      });
    });
  }

  function printCurrent() {
    var body = payloadFromForm();
    var teacher = state.staff.filter(function (person) {
      return person.id === body.teacher_id;
    })[0];
    var visitor = state.visitors.filter(function (person) {
      return person.value === body.visitor_id;
    })[0];
    var total = 0;
    var any = false;
    var criteria = state.criteria.map(function (spec) {
      var row = body.criteria.filter(function (item) {
        return item.id === spec.id;
      })[0] || {};
      var points = pointsOf(spec.weight, row.level);
      if (row.level) {
        any = true;
        total += points;
      }
      return {
        label: spec.label,
        level: row.level,
        phrase: row.phrase,
        points: row.level ? points : ""
      };
    });
    printRecord({
      teacher_id: body.teacher_id,
      teacher_name: teacher ? teacher.name : "",
      teacher_rank: body.teacher_rank,
      visitor_id: body.visitor_id,
      visitor_name: visitor ? visitor.name : "",
      visitor_role: visitor ? visitor.role : "",
      subject: body.subject,
      grade: body.grade,
      section_no: body.section_no,
      period_no: body.period_no,
      week: body.week,
      unit: body.unit,
      lesson: body.lesson,
      skill: body.skill,
      visit_type: body.visit_type,
      indicator: body.indicator,
      visit_date: body.visit_date,
      visit_date_hijri: body.visit_date_hijri,
      visit_intro: body.visit_intro,
      strengths: body.strengths,
      recommendations: body.recommendations,
      improvement: body.improvement,
      follow_hijri: body.follow_hijri,
      follow_gregorian: body.follow_gregorian,
      criteria: criteria,
      total: any ? Math.round(total * 100) / 100 : "",
      band: !any ? "" : total >= 90 ? "ممتاز" : total >= 75 ? "متقدم" : total >= 60 ? "متمكن" : "بحاجة إلى دعم"
    });
  }

  function bind() {
    var form = document.getElementById("aj-visit-form");
    var list = document.getElementById("aj-visit-list");
    if (!form || form.dataset.bound === "1") {
      return;
    }
    form.dataset.bound = "1";
    form.addEventListener("submit", save);
    form.addEventListener("change", function (event) {
      var row = event.target.closest ? event.target.closest("[data-visit-row]") : null;
      if (row && event.target.hasAttribute("data-visit-level")) {
        syncPhrase(row, false);
        paintTotal();
        writeAdvice(false);
      }
      if (row && event.target.hasAttribute("data-visit-choice")) {
        row.querySelector("[data-visit-phrase]").value = event.target.value;
      }
      if (event.target.id === "aj-visit-strength-pick") {
        var strengthBox = document.getElementById("aj-visit-strengths");
        if (strengthBox) {
          if (!event.target.value) {
            strengthBox.dataset.auto = "1";
            writeAdvice(false);
          } else {
            strengthBox.value = event.target.value;
            strengthBox.dataset.auto = "";
          }
        }
      }
      if (event.target.id === "aj-visit-feedback-pick") {
        var feedbackBox = document.getElementById("aj-visit-notes");
        if (feedbackBox) {
          if (!event.target.value) {
            feedbackBox.dataset.auto = "1";
            writeAdvice(false);
          } else {
            feedbackBox.value = event.target.value;
            feedbackBox.dataset.auto = "";
          }
        }
      }
      if (event.target.id === "aj-visit-intro") {
        event.target.dataset.auto = "";
      }
      if (event.target.id === "aj-visit-notes" || event.target.id === "aj-visit-plan" || event.target.id === "aj-visit-strengths") {
        event.target.dataset.auto = "";
      }
      if (event.target.id === "aj-visit-date") {
        applyHijri("aj-visit-date", "aj-visit-hijri");
        applyCurriculumFill(true);
        refreshPhrases(false);
        suggestFollowUp(true);
      }
      if (event.target.id === "aj-visit-follow-g") {
        event.target.dataset.auto = "";
        applyHijri("aj-visit-follow-g", "aj-visit-follow-h");
      }
      if (event.target.id === "aj-visit-teacher") {
        var teacher = state.staff.filter(function (person) {
          return person.id === event.target.value;
        })[0];
        var rank = document.getElementById("aj-visit-rank");
        if (rank) {
          rank.value = teacher ? rankMatch(teacher.id) : "";
        }
        var subject = document.getElementById("aj-visit-subject");
        if (teacher && subject) {
          var taught = subjectOf(teacher.specialty);
          if (taught && !subject.querySelector("option[value=\"" + taught.replace(/"/g, "") + "\"]")) {
            subject.insertAdjacentHTML("beforeend", "<option value=\"" + escapeHtml(taught) + "\">" + escapeHtml(taught) + "</option>");
          }
          subject.value = taught;
          applyCurriculumFill(true);
          refreshPhrases(false);
        }
      }
      if (event.target.id === "aj-visit-subject" || event.target.id === "aj-visit-grade" || event.target.id === "aj-visit-week") {
        if (event.target.id === "aj-visit-week") {
          var unitNode = document.getElementById("aj-visit-unit");
          var lessonNode = document.getElementById("aj-visit-lesson");
          var skillNode = document.getElementById("aj-visit-skill");
          if (unitNode) unitNode.dataset.auto = "1";
          if (lessonNode) lessonNode.dataset.auto = "1";
          if (skillNode) skillNode.dataset.auto = "1";
        }
        applyCurriculumFill(event.target.id !== "aj-visit-week");
        refreshPhrases(false);
      }
      if (event.target.id === "aj-visit-type") {
        refreshPhrases(false);
      }
      if (event.target.id === "aj-visit-unit" || event.target.id === "aj-visit-skill") {
        event.target.dataset.auto = "";
      }
    });
    form.addEventListener("input", function (event) {
      if (event.target && (event.target.id === "aj-visit-lesson" || event.target.id === "aj-visit-skill")) {
        event.target.dataset.auto = "";
        refreshPhrases(false);
      }
    });
    form.addEventListener("click", function (event) {
      if (event.target.id === "aj-visit-full") {
        fillFull();
      }
      if (event.target.id === "aj-visit-all") {
        generateAll();
      }
      if (event.target.id === "aj-visit-print") {
        printCurrent();
      }
      if (event.target.id === "aj-visit-new") {
        state.editing = 0;
        paintForm({});
      }
      if (event.target.id === "aj-visit-clear") {
        if (!window.confirm("ستُحذف جميع الزيارات الصفية المحفوظة.\nالخطة السنوية لا تُمس.\nهل توافق على الحذف؟")) {
          return;
        }
        fetch("/api/session/classroom-visits", {
          method: "DELETE",
          headers: authHeaders()
        }).then(function (response) {
          if (!response.ok) {
            throw new Error("تعذر الحذف");
          }
          state.editing = 0;
          toast("حُذفت الزيارات الصفية.");
          return load();
        }).catch(function () {
          toast("تعذر حذف الزيارات.", "error");
        });
      }
    });
    if (list) {
      list.addEventListener("click", function (event) {
        var open = event.target.getAttribute("data-visit-open");
        var printId = event.target.getAttribute("data-visit-print");
        var remove = event.target.getAttribute("data-visit-delete");
        if (open) {
          var found = state.items.filter(function (item) {
            return String(item.id) === open;
          })[0];
          if (found) {
            paintForm(found);
          }
        }
        if (printId) {
          var row = state.items.filter(function (item) {
            return String(item.id) === printId;
          })[0];
          if (row) {
            printRecord(row);
          }
        }
        if (remove && window.confirm("حذف هذه الزيارة؟")) {
          fetch("/api/session/classroom-visits/" + remove, {
            method: "DELETE",
            headers: authHeaders()
          }).then(function () {
            if (String(state.editing) === remove) {
              state.editing = 0;
            }
            return load();
          }).catch(function () {
            toast("تعذر الحذف.", "error");
          });
        }
      });
    }
  }

  function load() {
    var status = document.getElementById("aj-visit-status");
    if (status) {
      status.textContent = "";
    }
    return Promise.all([
      fetch("/api/session/classroom-visits", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error((body && body.detail) || "تعذر تحميل الزيارات.");
          }
          return body;
        });
      }),
      fetch("/api/noor/staff", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.ok ? response.json() : { people: [] };
      }).catch(function () {
        return { people: [] };
      }),
      fetch("/api/session/leadership", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.ok ? response.json() : {};
      }).catch(function () {
        return {};
      }),
      loadPhraseBank(),
      loadCurriculumMap(),
      loadCalendarStarts()
    ]).then(function (parts) {
      var pack = parts[0];
      var people = (parts[1].people || []).filter(function (person) {
        return person && (person.id || person.national_id) && person.name;
      });
      var byId = {};
      people.forEach(function (person) {
        byId[String(person.id || person.national_id)] = person;
      });
      state.peopleById = byId;
      var seats = parts[2] || {};
      state.managerId = String(seats.manager || "");
      var visitorIds = [seats.manager].concat(seats.education_agents || [], seats.student_agents || []).filter(Boolean);
      var roleOf = {};
      roleOf[String(seats.manager || "")] = "مدير المدرسة";
      (seats.education_agents || []).forEach(function (id) {
        roleOf[String(id)] = "وكيل الشؤون التعليمية";
      });
      (seats.student_agents || []).forEach(function (id) {
        roleOf[String(id)] = "وكيل شؤون الطلاب";
      });
      state.visitors = visitorIds.map(function (id) {
        var person = byId[String(id)] || {};
        return {
          value: String(id),
          label: (person.name || id) + (roleOf[String(id)] ? " — " + roleOf[String(id)] : ""),
          name: person.name || "",
          role: roleOf[String(id)] || ""
        };
      });
      state.staff = people.filter(function (person) {
        return String(person.role || "").indexOf("معلم") === 0 && person.active !== false;
      }).map(function (person) {
        return {
          id: String(person.id || person.national_id),
          name: person.name,
          role: person.role || "",
          specialty: person.specialty || ""
        };
      });
      state.items = pack.items || [];
      state.criteria = pack.criteria || [];
      state.phrases = pack.phrases || {};
      state.types = pack.visit_types || [];
      state.indicators = pack.indicators || [];
      state.ranks = pack.ranks && pack.ranks.length ? pack.ranks : RANKS;
      bind();
      if (!state.editing) {
        paintForm({});
      }
      paintList();
    }).catch(function (error) {
      if (status) {
        status.textContent = error.message || "تعذر تحميل الزيارات.";
      }
    });
  }

  window.AjVisits = { load: load };
}());
