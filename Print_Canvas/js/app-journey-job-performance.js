/* تقويم الأداء الوظيفي — نموذج المعلم (11 عنصراً). SSOT عبر API الجلسة فقط. */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var API = "/api/session/job-performance";
  var state = {
    cycles: [],
    staff: [],
    roleCodes: {},
    template: null,
    record: null,
    phase: "mid",
    dirty: false,
    gapDrafts: {},
    idpDraft: null,
    evidence: null,
    bound: false,
    roleSaveTimer: 0
  };

  function inferAssignmentRole(person) {
    var saved = String((person && person.assignment_role) || "").trim();
    if (saved) {
      return saved;
    }
    var role = String((person && person.role) || "");
    if (role.indexOf("مدير") === 0 || role.indexOf("مدير ") >= 0) {
      return "principal";
    }
    if (role.indexOf("وكيل") >= 0) {
      return "vice_principal";
    }
    if (role.indexOf("موجه") >= 0 && role.indexOf("طلاب") >= 0) {
      return "counselor";
    }
    if (role.indexOf("مختبر") >= 0 || role.indexOf("مصادر") >= 0 || role.indexOf("محضر") >= 0) {
      return "lab_tech";
    }
    if (role.indexOf("صحي") >= 0) {
      return "teacher_health";
    }
    if (role.indexOf("نشاط") >= 0) {
      return "teacher_activity";
    }
    if (
      role.indexOf("مساعد إداري") >= 0 ||
      role.indexOf("مساعد اداري") >= 0 ||
      role.indexOf("مساعد أداري") >= 0 ||
      role.indexOf("مسجل معلومات") >= 0 ||
      role.indexOf("مسجل") >= 0 ||
      role.indexOf("حارس") >= 0 ||
      role.indexOf("مراسل") >= 0 ||
      role.indexOf("كاتب") >= 0 ||
      role.indexOf("مستخدم") >= 0 ||
      role.indexOf("إداري") >= 0 ||
      role.indexOf("اداري") >= 0 ||
      role.indexOf("أداري") >= 0
    ) {
      return "admin_staff";
    }
    if (role.indexOf("معلم") === 0) {
      return "teacher";
    }
    return "teacher";
  }

  function paintRegulatoryBadge() {
    var badge = document.getElementById("aj-jp-framework-badge");
    if (!badge) {
      return;
    }
    var framework =
      (state.template && state.template.regulatory_framework) ||
      (selectedRoleCode() === "admin_staff" ? "لائحة الموارد البشرية العامة" : "");
    if (framework) {
      badge.hidden = false;
      badge.textContent = "الإطار النظامي: " + framework;
      badge.classList.toggle("is-hr-general", framework.indexOf("الموارد البشرية") >= 0);
    } else {
      badge.hidden = true;
      badge.textContent = "";
      badge.classList.remove("is-hr-general");
    }
  }

  function selectedPerson() {
    var sel = document.getElementById("aj-jp-teacher");
    var id = sel ? sel.value : "";
    return state.staff.filter(function (item) {
      return String(item.id) === String(id);
    })[0] || null;
  }

  function selectedRoleCode() {
    var sel = document.getElementById("aj-jp-role");
    return sel && sel.value ? sel.value : "teacher";
  }

  function paintRoleOptions(selected) {
    var sel = document.getElementById("aj-jp-role");
    if (!sel) {
      return;
    }
    var codes = state.roleCodes || {};
    var keys = Object.keys(codes);
    if (!keys.length) {
      keys = ["teacher"];
      codes = { teacher: "معلم" };
    }
    sel.innerHTML = keys
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
    if (selected && codes[selected]) {
      sel.value = selected;
    }
  }

  function evidenceLine(item) {
    var title = String((item && item.title) || "").trim();
    var summary = String((item && item.summary) || "").trim();
    if (title && summary && summary.indexOf(title) === 0) {
      return summary;
    }
    if (title && summary && title.indexOf(summary) >= 0) {
      return title;
    }
    if (title && summary) {
      return title + " · " + summary;
    }
    return title || summary || (item && item.source_kind) || "";
  }

  function evidenceFor(elementId) {
    var pack = state.evidence || (state.record && state.record.evidence) || null;
    if (!pack || !pack.by_element) {
      return [];
    }
    return pack.by_element[elementId] || [];
  }

  function paintEvidenceSummary() {
    var host = document.getElementById("aj-jp-evidence-summary");
    if (!host) {
      return;
    }
    var pack = state.evidence || (state.record && state.record.evidence) || null;
    if (!pack || !(pack.items || []).length) {
      host.innerHTML = "<p class=\"aj-jp-evidence-empty\">لا شواهد مربوطة لهذا المعلم حالياً.</p>";
      return;
    }
    var seen = {};
    var unique = [];
    (pack.items || []).forEach(function (item) {
      var key = item.source_kind + ":" + item.source_id;
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      unique.push(item);
    });
    host.innerHTML = unique
      .map(function (item) {
        return (
          "<div class=\"aj-jp-evidence-chip\">" +
          escapeHtml(evidenceLine(item)) +
          "</div>"
        );
      })
      .join("");
  }

  function weightedPercent(rating, weight) {
    var n = Number(rating);
    var w = Number(weight || 0);
    if (!(n >= 1 && n <= 5)) {
      return null;
    }
    return Math.round((n / 5) * w * 100) / 100;
  }

  function noteOptionsHtml(elementId, rating, currentNote) {
    var bank =
      window.AjJobPerformanceNotes && typeof window.AjJobPerformanceNotes.optionsFor === "function"
        ? window.AjJobPerformanceNotes.optionsFor(elementId, rating)
        : [];
    var options =
      "<option value=\"\">— اختر ملاحظة جاهزة أو اكتب حراً —</option>" +
      bank
        .map(function (text) {
          return (
            "<option value=\"" +
            escapeHtml(text) +
            "\"" +
            (String(currentNote || "") === String(text) ? " selected" : "") +
            ">" +
            escapeHtml(text) +
            "</option>"
          );
        })
        .join("");
    return (
      "<select class=\"aj-jp-note-pick\" data-aj-jp-note-pick=\"" +
      escapeHtml(elementId) +
      "\" aria-label=\"ملاحظة جاهزة\">" +
      options +
      "</select>"
    );
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

  function status(msg, isError) {
    var el = document.getElementById("aj-jp-status");
    if (!el) {
      return;
    }
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  function elements() {
    if (state.record && state.record.weights_snapshot && state.record.weights_snapshot.length) {
      return state.record.weights_snapshot;
    }
    return (state.template && state.template.elements) || [];
  }

  function bandLabels() {
    return (
      (state.template && state.template.band_labels) || {
        1: "غير مرض",
        2: "بحاجة إلى تطوير",
        3: "وافق التوقعات",
        4: "تخطى التوقعات",
        5: "مثالي"
      }
    );
  }

  function scoreMaps() {
    var maps = { mid: {}, final: {}, self_mid: {}, self_final: {}, note_mid: {}, note_final: {} };
    if (!state.record || !state.record.scores) {
      return maps;
    }
    ["mid", "final", "self_mid", "self_final"].forEach(function (phase) {
      (state.record.scores[phase] || []).forEach(function (row) {
        maps[phase][row.element_id] = row.rating;
        if (phase === "mid" || phase === "final") {
          maps["note_" + phase][row.element_id] = row.note || "";
        }
      });
    });
    return maps;
  }

  function liveTotals() {
    var els = elements();
    var maps = scoreMaps();
    var phase = state.phase;
    var weighted = 0;
    var scored = 0;
    els.forEach(function (item) {
      var rating = maps[phase][item.id];
      if (rating == null || rating === "") {
        return;
      }
      var n = Number(rating);
      if (!(n >= 1 && n <= 5)) {
        return;
      }
      weighted += n * Number(item.weight || 0);
      scored += 1;
    });
    var percent = scored ? Math.round((weighted / 5) * 100) / 100 : 0;
    var avg5 = scored ? Math.round((weighted / 100) * 100) / 100 : 0;
    var band = 0;
    var label = "—";
    if (scored) {
      if (percent >= 90) {
        band = 5;
      } else if (percent >= 80) {
        band = 4;
      } else if (percent >= 70) {
        band = 3;
      } else if (percent >= 60) {
        band = 2;
      } else {
        band = 1;
      }
      label = bandLabels()[band] || label;
    }
    return {
      weighted: Math.round(weighted * 100) / 100,
      percent: percent,
      avg5: avg5,
      band: band,
      band_label: label,
      scored: scored,
      total: els.length,
      readiness: els.length ? Math.round((scored / els.length) * 1000) / 10 : 0
    };
  }

  function paintCalc() {
    var t = liveTotals();
    var set = function (id, value) {
      var el = document.getElementById(id);
      if (el) {
        el.textContent = value;
      }
    };
    set("aj-jp-calc-percent", t.scored ? t.percent.toFixed(2) + " %" : "—");
    set("aj-jp-calc-avg", t.scored ? t.avg5.toFixed(2) + " / 5.00" : "—");
    set("aj-jp-calc-band", t.scored ? t.band_label : "—");
    set("aj-jp-calc-scored", t.scored + " / " + t.total);
    set("aj-jp-ready-text", t.readiness.toFixed(1) + " %");
    var bar = document.getElementById("aj-jp-ready-fill");
    if (bar) {
      bar.style.width = Math.max(0, Math.min(100, t.readiness)) + "%";
    }
  }

  function paintCycles() {
    var sel = document.getElementById("aj-jp-cycle");
    if (!sel) {
      return;
    }
    var current = sel.value;
    sel.innerHTML = state.cycles
      .map(function (cycle) {
        return (
          "<option value=\"" +
          cycle.id +
          "\">" +
          escapeHtml(cycle.label || cycle.academic_year || "") +
          "</option>"
        );
      })
      .join("");
    if (current && state.cycles.some(function (c) {
      return String(c.id) === String(current);
    })) {
      sel.value = current;
    } else if (state.cycles.length) {
      sel.value = String(state.cycles[0].id);
    }
  }

  function paintStaff() {
    var sel = document.getElementById("aj-jp-teacher");
    if (!sel) {
      return;
    }
    var current = sel.value;
    sel.innerHTML =
      "<option value=\"\">— اختر المنسوب —</option>" +
      state.staff
        .map(function (person) {
          var roleCode = inferAssignmentRole(person);
          var roleTitle = (state.roleCodes && state.roleCodes[roleCode]) || roleCode;
          var label =
            (person.name || "") +
            (person.specialty ? " — " + person.specialty : "") +
            (person.role ? " · " + person.role : "") +
            " [" +
            roleTitle +
            "]";
          return (
            "<option value=\"" +
            escapeHtml(person.id) +
            "\">" +
            escapeHtml(label) +
            "</option>"
          );
        })
        .join("");
    if (current) {
      sel.value = current;
    }
  }

  function paintTeacherMeta() {
    var meta = document.getElementById("aj-jp-teacher-meta");
    var countEl = document.getElementById("aj-jp-elements-count");
    if (!meta) {
      return;
    }
    var person = selectedPerson();
    if (!person) {
      meta.textContent = "";
      if (countEl) {
        countEl.textContent = "(— = 100%)";
      }
      return;
    }
    var roleCode = selectedRoleCode();
    var roleTitle = (state.roleCodes && state.roleCodes[roleCode]) || roleCode;
    var n = elements().length;
    meta.textContent =
      "التخصص: " +
      (person.specialty || "—") +
      " · الصفة: " +
      (person.role || "—") +
      " · قالب التقويم: " +
      roleTitle +
      " (" +
      roleCode +
      ")";
    if (countEl) {
      countEl.textContent = "(" + n + " = 100%)";
    }
    paintRegulatoryBadge();
  }

  function setPhaseButtons() {
    document.querySelectorAll("[data-aj-jp-phase]").forEach(function (btn) {
      var on = btn.getAttribute("data-aj-jp-phase") === state.phase;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var gap = document.getElementById("aj-jp-gap-panel");
    var idp = document.getElementById("aj-jp-idp-panel");
    if (gap) {
      gap.hidden = state.phase !== "mid";
    }
    if (idp) {
      idp.hidden = state.phase !== "final";
    }
  }

  function levelText(element, rating) {
    if (!rating) {
      return "اختر تقديراً من 1 إلى 5 لعرض وصف مستوى الإتقان.";
    }
    var levels = element.levels || {};
    var labels = bandLabels();
    return (
      labels[rating] +
      ": " +
      (levels[String(rating)] || levels[rating] || "")
    );
  }

  function paintElements() {
    var host = document.getElementById("aj-jp-elements");
    if (!host) {
      return;
    }
    var maps = scoreMaps();
    var phase = state.phase;
    var selfPhase = phase === "mid" ? "self_mid" : "self_final";
    var lastSection = "";
    host.innerHTML = elements()
      .map(function (item) {
        var rating = maps[phase][item.id];
        var selfRating = maps[selfPhase][item.id];
        var note = maps["note_" + phase][item.id] || "";
        var weightedVal = weightedPercent(rating, item.weight);
        var weighted = weightedVal == null ? "—" : weightedVal.toFixed(2) + "%";
        var gapClass = phase === "mid" && (rating === 1 || rating === 2) ? " is-gap" : "";
        var scale = [1, 2, 3, 4, 5]
          .map(function (n) {
            return (
              "<button type=\"button\" data-aj-jp-rate=\"" +
              escapeHtml(item.id) +
              "\" data-rating=\"" +
              n +
              "\" class=\"" +
              (Number(rating) === n ? "is-on" : "") +
              "\" aria-label=\"تقدير " +
              n +
              "\">" +
              n +
              "</button>"
            );
          })
          .join("");
        var selfScale = [1, 2, 3, 4, 5]
          .map(function (n) {
            return (
              "<button type=\"button\" data-aj-jp-self=\"" +
              escapeHtml(item.id) +
              "\" data-rating=\"" +
              n +
              "\" class=\"" +
              (Number(selfRating) === n ? "is-on" : "") +
              "\">" +
              n +
              "</button>"
            );
          })
          .join("");
        var sectionHtml = "";
        var sectionKey = String(item.section || "");
        if (sectionKey && sectionKey !== lastSection) {
          lastSection = sectionKey;
          sectionHtml =
            "<h3 class=\"aj-jp-section-title\">" +
            escapeHtml(item.section_label || item.section) +
            "</h3>";
        }
        return (
          sectionHtml +
          "<article class=\"aj-jp-card" +
          gapClass +
          "\" data-element=\"" +
          escapeHtml(item.id) +
          "\">" +
          "<div class=\"aj-jp-card-head\">" +
          "<h3>" +
          escapeHtml(item.label || item.id) +
          "</h3>" +
          "<span class=\"aj-jp-weight\">الوزن: " +
          escapeHtml(String(item.weight)) +
          "%</span>" +
          "</div>" +
          "<p class=\"aj-jp-desc\">" +
          escapeHtml(item.description || "") +
          "</p>" +
          "<div class=\"aj-jp-scale\" role=\"group\" aria-label=\"تقدير المقوّم\">" +
          scale +
          "</div>" +
          "<p class=\"aj-jp-level-hint\" data-aj-jp-hint=\"" +
          escapeHtml(item.id) +
          "\">" +
          escapeHtml(levelText(item, rating)) +
          "</p>" +
          "<div class=\"aj-jp-row\">" +
          "<div class=\"aj-jp-mgr-note\">" +
          "<label>ملاحظة المقوّم (اختيارية)</label>" +
          noteOptionsHtml(item.id, rating, note) +
          "<input type=\"text\" maxlength=\"120\" data-aj-jp-note=\"" +
          escapeHtml(item.id) +
          "\" value=\"" +
          escapeHtml(note) +
          "\" placeholder=\"أو اكتب ملاحظة حرة (≤120)\">" +
          "</div>" +
          "<div class=\"aj-jp-self\">" +
          "<label>التقييم الذاتي (غير محتسب)</label>" +
          "<div class=\"aj-jp-scale\" role=\"group\">" +
          selfScale +
          "</div>" +
          "<p class=\"aj-jp-self-note\">مرجع بصري وفق الدليل — لا يدخل في الدرجة النهائية.</p>" +
          "</div>" +
          "</div>" +
          "<p class=\"aj-jp-weighted\">الدرجة الموزونة من 100%: <strong data-aj-jp-weighted=\"" +
          escapeHtml(item.id) +
          "\">" +
          weighted +
          "</strong></p>" +
          "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary\" data-aj-jp-excel=\"" +
          escapeHtml(item.id) +
          "\">كيف أحقق 5/5 (مثالي)؟</button>" +
          "<div class=\"aj-jp-excel\" data-aj-jp-excel-box=\"" +
          escapeHtml(item.id) +
          "\" hidden></div>" +
          (function () {
            var ev = evidenceFor(item.id);
            if (!ev.length) {
              return "";
            }
            return (
              "<details class=\"aj-jp-card-evidence-box\">" +
              "<summary class=\"aj-jp-card-evidence-title\">📎 " +
              ev.length +
              " شواهد مرتبطة (اضغط للعرض)</summary>" +
              "<ul class=\"aj-jp-card-evidence\">" +
              ev
                .map(function (row) {
                  return "<li>" + escapeHtml(evidenceLine(row)) + "</li>";
                })
                .join("") +
              "</ul></details>"
            );
          })() +
          "</article>"
        );
      })
      .join("");
    paintRegulatoryBadge();
    paintCalc();
    paintEvidenceSummary();
    paintGapPanel();
    paintIdpPanel();
  }

  function ensureGapDrafts() {
    var maps = scoreMaps();
    elements().forEach(function (item) {
      var rating = maps.mid[item.id];
      if (!(rating === 1 || rating === 2)) {
        return;
      }
      if (!state.gapDrafts[item.id]) {
        var saved =
          ((state.record && state.record.gap_plans) || []).filter(function (row) {
            return row.element_id === item.id;
          })[0] || null;
        state.gapDrafts[item.id] = {
          element_id: item.id,
          current_rating: rating,
          reasons: (saved && saved.reasons) || "",
          strengths: (saved && saved.strengths) || "",
          improve_areas: (saved && saved.improve_areas) || "",
          requirements: (saved && saved.requirements) || "",
          team: (saved && saved.team) || "",
          partners: (saved && saved.partners) || "",
          action_steps: (saved && saved.action_steps) || [
            { step: "", when: "", owner: "", indicator: "", evidence: "" }
          ],
          status: (saved && saved.status) || "open"
        };
      } else {
        state.gapDrafts[item.id].current_rating = rating;
      }
    });
    Object.keys(state.gapDrafts).forEach(function (eid) {
      var rating = maps.mid[eid];
      if (!(rating === 1 || rating === 2)) {
        delete state.gapDrafts[eid];
      }
    });
  }

  function paintGapPanel() {
    var host = document.getElementById("aj-jp-gap-list");
    var panel = document.getElementById("aj-jp-gap-panel");
    if (!host || !panel) {
      return;
    }
    ensureGapDrafts();
    var ids = Object.keys(state.gapDrafts);
    if (!ids.length) {
      host.innerHTML =
        "<p class=\"aj-lede\">لا فجوة حالياً (لا توجد عناصر بدرجة 1 أو 2 في المراجعة النصف سنوية).</p>";
      return;
    }
    var byId = {};
    elements().forEach(function (item) {
      byId[item.id] = item;
    });
    host.innerHTML = ids
      .map(function (eid) {
        var draft = state.gapDrafts[eid];
        var label = (byId[eid] && byId[eid].label) || eid;
        var step = (draft.action_steps && draft.action_steps[0]) || {};
        return (
          "<div class=\"aj-jp-gap-item\" data-gap=\"" +
          escapeHtml(eid) +
          "\">" +
          "<h3>" +
          escapeHtml(label) +
          " — درجة التمكن الحالية: " +
          escapeHtml(String(draft.current_rating)) +
          "</h3>" +
          "<label>أسباب الحصول على هذه الدرجة</label>" +
          "<textarea rows=\"2\" data-gap-field=\"reasons\">" +
          escapeHtml(draft.reasons) +
          "</textarea>" +
          "<label>نقاط القوة</label>" +
          "<textarea rows=\"2\" data-gap-field=\"strengths\">" +
          escapeHtml(draft.strengths) +
          "</textarea>" +
          "<label>الجوانب التي تحتاج إلى التحسين</label>" +
          "<textarea rows=\"2\" data-gap-field=\"improve_areas\">" +
          escapeHtml(draft.improve_areas) +
          "</textarea>" +
          "<label>الخطوة الإجرائية</label>" +
          "<textarea rows=\"2\" data-gap-step=\"step\">" +
          escapeHtml(step.step || "") +
          "</textarea>" +
          "<div class=\"aj-jp-row\">" +
          "<div><label>زمن التنفيذ</label><input data-gap-step=\"when\" value=\"" +
          escapeHtml(step.when || "") +
          "\"></div>" +
          "<div><label>المكلف</label><input data-gap-step=\"owner\" value=\"" +
          escapeHtml(step.owner || "") +
          "\"></div>" +
          "</div>" +
          "<div class=\"aj-jp-row\">" +
          "<div><label>مؤشر الأداء</label><input data-gap-step=\"indicator\" value=\"" +
          escapeHtml(step.indicator || "") +
          "\"></div>" +
          "<div><label>شواهد الإنجاز</label><input data-gap-step=\"evidence\" value=\"" +
          escapeHtml(step.evidence || "") +
          "\"></div>" +
          "</div>" +
          "<button type=\"button\" class=\"aj-detail-btn\" data-aj-jp-save-gap=\"" +
          escapeHtml(eid) +
          "\">حفظ خطة الفجوة لهذا العنصر</button>" +
          "</div>"
        );
      })
      .join("");
  }

  function paintIdpPanel() {
    var host = document.getElementById("aj-jp-idp-goals");
    if (!host) {
      return;
    }
    if (!state.idpDraft) {
      var saved = state.record && state.record.idp;
      state.idpDraft = {
        goals: (saved && saved.goals && saved.goals.length
          ? saved.goals
          : [
              { title: "", priority: 1, activities: { "70": "", "20": "", "10": "" }, success: "", supporter: "" },
              { title: "", priority: 2, activities: { "70": "", "20": "", "10": "" }, success: "", supporter: "" },
              { title: "", priority: 3, activities: { "70": "", "20": "", "10": "" }, success: "", supporter: "" }
            ]
        ).slice(0, 3),
        start_date: (saved && saved.start_date) || "",
        end_date: (saved && saved.end_date) || "",
        notes: (saved && saved.notes) || ""
      };
      while (state.idpDraft.goals.length < 3) {
        state.idpDraft.goals.push({
          title: "",
          priority: state.idpDraft.goals.length + 1,
          activities: { "70": "", "20": "", "10": "" },
          success: "",
          supporter: ""
        });
      }
    }
    host.innerHTML = state.idpDraft.goals
      .map(function (goal, index) {
        var act = goal.activities || {};
        return (
          "<div class=\"aj-jp-idp-goal\" data-idp-index=\"" +
          index +
          "\">" +
          "<h3>الهدف التطويري " +
          (index + 1) +
          "</h3>" +
          "<label>عنوان الهدف</label>" +
          "<input data-idp-field=\"title\" value=\"" +
          escapeHtml(goal.title || "") +
          "\">" +
          "<label>70% تجارب وخبرات</label>" +
          "<textarea rows=\"2\" data-idp-act=\"70\">" +
          escapeHtml(act["70"] || "") +
          "</textarea>" +
          "<label>20% تعلم من الآخرين</label>" +
          "<textarea rows=\"2\" data-idp-act=\"20\">" +
          escapeHtml(act["20"] || "") +
          "</textarea>" +
          "<label>10% تعلم مباشر</label>" +
          "<textarea rows=\"2\" data-idp-act=\"10\">" +
          escapeHtml(act["10"] || "") +
          "</textarea>" +
          "<div class=\"aj-jp-row\">" +
          "<div><label>الداعم الرئيسي</label><input data-idp-field=\"supporter\" value=\"" +
          escapeHtml(goal.supporter || "") +
          "\"></div>" +
          "<div><label>معايير النجاح</label><input data-idp-field=\"success\" value=\"" +
          escapeHtml(goal.success || "") +
          "\"></div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function setLocalRating(elementId, rating, isSelf) {
    if (!state.record) {
      status("افتح سجلاً أولاً باختيار المعلم.", true);
      return;
    }
    if (!state.record.scores) {
      state.record.scores = { mid: [], final: [], self_mid: [], self_final: [] };
    }
    var phase = isSelf ? (state.phase === "mid" ? "self_mid" : "self_final") : state.phase;
    var list = state.record.scores[phase] || [];
    var found = list.filter(function (row) {
      return row.element_id === elementId;
    })[0];
    if (found) {
      if (Number(found.rating) === Number(rating)) {
        found.rating = null;
      } else {
        found.rating = Number(rating);
      }
    } else {
      list.push({ element_id: elementId, rating: Number(rating), note: "" });
    }
    state.record.scores[phase] = list;
    state.dirty = true;
    paintElements();
  }

  function setLocalNote(elementId, note) {
    if (!state.record || !state.record.scores) {
      return;
    }
    var list = state.record.scores[state.phase] || [];
    var found = list.filter(function (row) {
      return row.element_id === elementId;
    })[0];
    if (found) {
      found.note = note;
    } else {
      list.push({ element_id: elementId, rating: null, note: note });
      state.record.scores[state.phase] = list;
    }
    state.dirty = true;
  }

  function fetchJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (body) {
        if (!response.ok) {
          var err = new Error(body.detail || body.message || "تعذر تنفيذ الطلب");
          err.status = response.status;
          throw err;
        }
        return body;
      });
    });
  }

  function loadTemplateForRole(roleCode) {
    return fetchJson(API + "/templates/" + encodeURIComponent(roleCode || "teacher"), {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (tpl) {
      state.template = tpl;
      return tpl;
    });
  }

  function persistAssignmentRole(staffId, roleCode) {
    return fetchJson(API + "/staff/" + encodeURIComponent(staffId) + "/assignment-role", {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({ assignment_role: roleCode })
    }).then(function (pack) {
      state.staff.forEach(function (person) {
        if (String(person.id) === String(staffId)) {
          person.assignment_role = pack.assignment_role || roleCode;
        }
      });
      return pack;
    });
  }

  function onStaffChanged() {
    var person = selectedPerson();
    var roleCode = inferAssignmentRole(person || {});
    paintRoleOptions(roleCode);
    paintTeacherMeta();
    return loadTemplateForRole(roleCode).then(function () {
      paintTeacherMeta();
      return loadRecord();
    });
  }

  function onRoleChanged() {
    var person = selectedPerson();
    var roleCode = selectedRoleCode();
    if (!person) {
      return loadTemplateForRole(roleCode).then(function () {
        paintTeacherMeta();
        paintElements();
      });
    }
    status("جارٍ تحديث إسناد القالب…");
    return persistAssignmentRole(person.id, roleCode)
      .then(function () {
        return loadTemplateForRole(roleCode);
      })
      .then(function () {
        paintStaff();
        var sel = document.getElementById("aj-jp-teacher");
        if (sel) {
          sel.value = person.id;
        }
        paintRoleOptions(roleCode);
        paintTeacherMeta();
        // سجل جديد بالقالب الحالي إن لم يوجد؛ الموجود يحتفظ بلقطة أوزانه التاريخية.
        return loadRecord();
      })
      .catch(function (error) {
        status(error.message || "تعذر تحديث الإسناد.", true);
      });
  }

  function loadRecord() {
    var cycleEl = document.getElementById("aj-jp-cycle");
    var teacherEl = document.getElementById("aj-jp-teacher");
    var cycleId = cycleEl ? Number(cycleEl.value) : 0;
    var staffId = teacherEl ? teacherEl.value : "";
    var roleCode = selectedRoleCode();
    if (!cycleId || !staffId) {
      state.record = null;
      state.gapDrafts = {};
      state.idpDraft = null;
      state.evidence = null;
      paintElements();
      return Promise.resolve();
    }
    status("جارٍ تحميل سجل التقويم…");
    return fetchJson(API + "/records?cycle_id=" + encodeURIComponent(cycleId), {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (pack) {
      var existing = (pack.items || []).filter(function (row) {
        return String(row.staff_id) === String(staffId);
      })[0];
      if (existing) {
        return fetchJson(API + "/records/" + existing.id, {
          headers: authHeaders(),
          cache: "no-store"
        });
      }
      return fetchJson(API + "/records", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
        body: JSON.stringify({
          cycle_id: cycleId,
          staff_id: staffId,
          assignment_role: roleCode
        })
      });
    }).then(function (record) {
      state.record = record;
      state.evidence = record.evidence || null;
      state.gapDrafts = {};
      state.idpDraft = null;
      state.dirty = false;
      if (record.assignment_role) {
        paintRoleOptions(record.assignment_role);
      }
      paintTeacherMeta();
      paintElements();
      var snapNote = "";
      if (record.assignment_role && roleCode && record.assignment_role !== roleCode) {
        snapNote = " · تنبيه: السجل الحالي مجمّد على قالب " + record.assignment_role + " (لا تُستبدل اللقطة التاريخية).";
      }
      status(
        "السجل جاهز — القالب: " +
          ((state.roleCodes && state.roleCodes[record.assignment_role]) || record.assignment_role || roleCode) +
          " · عناصر " +
          ((record.weights_snapshot || []).length || elements().length) +
          " · شواهد للمرجعية فقط." +
          snapNote
      );
      if (record.id) {
        return fetchJson(API + "/records/" + record.id + "/evidence", {
          headers: authHeaders(),
          cache: "no-store"
        }).then(function (pack) {
          state.evidence = pack;
          if (state.record) {
            state.record.evidence = pack;
          }
          paintEvidenceSummary();
          paintElements();
        }).catch(function () {
          return null;
        });
      }
      return null;
    }).catch(function (error) {
      state.record = null;
      state.evidence = null;
      paintElements();
      status(error.message || "تعذر فتح السجل.", true);
    });
  }

  function collectPhaseScores(phase) {
    var maps = scoreMaps();
    var notes = maps["note_" + phase] || {};
    return elements().map(function (item) {
      return {
        element_id: item.id,
        rating: maps[phase][item.id],
        note: notes[item.id] || ""
      };
    }).filter(function (row) {
      return row.rating != null && row.rating !== "";
    });
  }

  function saveManagerScores() {
    if (!state.record || !state.record.id) {
      status("لا يوجد سجل للحفظ.", true);
      return;
    }
    var scores = collectPhaseScores(state.phase);
    status("جارٍ حفظ تقديرات المقوّم…");
    fetchJson(API + "/records/" + state.record.id + "/scores", {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({ phase: state.phase, scores: scores })
    })
      .then(function () {
        return fetchJson(API + "/records/" + state.record.id, {
          headers: authHeaders(),
          cache: "no-store"
        });
      })
      .then(function (record) {
        state.record = record;
        state.dirty = false;
        state.gapDrafts = {};
        state.idpDraft = null;
        paintElements();
        status("حُفظت تقديرات " + (state.phase === "mid" ? "المراجعة النصف سنوية" : "التقييم الختامي") + ".");
      })
      .catch(function (error) {
        status(error.message || "تعذر الحفظ.", true);
      });
  }

  function saveSelfScores() {
    if (!state.record || !state.record.id) {
      status("لا يوجد سجل للحفظ.", true);
      return;
    }
    var phase = state.phase === "mid" ? "self_mid" : "self_final";
    var scores = collectPhaseScores(phase);
    status("جارٍ حفظ التقييم الذاتي…");
    fetchJson(API + "/records/" + state.record.id + "/self-scores", {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({ phase: phase, scores: scores })
    })
      .then(function () {
        return fetchJson(API + "/records/" + state.record.id, {
          headers: authHeaders(),
          cache: "no-store"
        });
      })
      .then(function (record) {
        state.record = record;
        paintElements();
        status("حُفظ التقييم الذاتي (غير محتسب في الدرجة النهائية).");
      })
      .catch(function (error) {
        status(error.message || "تعذر حفظ التقييم الذاتي.", true);
      });
  }

  function saveGap(elementId) {
    var draft = state.gapDrafts[elementId];
    if (!draft || !state.record) {
      return;
    }
    fetchJson(API + "/records/" + state.record.id + "/gap-plan", {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify(draft)
    })
      .then(function () {
        status("حُفظت خطة تحسين فجوة الأداء للعنصر.");
      })
      .catch(function (error) {
        status(error.message || "تعذر حفظ خطة الفجوة.", true);
      });
  }

  function saveIdp() {
    if (!state.record || !state.idpDraft) {
      return;
    }
    var goals = (state.idpDraft.goals || []).filter(function (goal) {
      return String(goal.title || "").trim();
    });
    fetchJson(API + "/records/" + state.record.id + "/idp", {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({
        goals: goals,
        start_date: state.idpDraft.start_date || "",
        end_date: state.idpDraft.end_date || "",
        notes: state.idpDraft.notes || ""
      })
    })
      .then(function () {
        status("حُفظت خطة التطوير الفردية (IDP) بمنهجية 70-20-10.");
      })
      .catch(function (error) {
        status(error.message || "تعذر حفظ خطة IDP.", true);
      });
  }

  function bind() {
    if (state.bound) {
      return;
    }
    state.bound = true;
    var root = document.getElementById("view-job-performance");
    if (!root) {
      return;
    }
    root.addEventListener("change", function (event) {
      var t = event.target;
      if (!t) {
        return;
      }
      if (t.id === "aj-jp-cycle") {
        loadRecord();
        return;
      }
      if (t.id === "aj-jp-teacher") {
        onStaffChanged();
        return;
      }
      if (t.id === "aj-jp-role") {
        onRoleChanged();
        return;
      }
      if (t.getAttribute("data-aj-jp-note")) {
        setLocalNote(t.getAttribute("data-aj-jp-note"), t.value);
        return;
      }
      if (t.getAttribute("data-aj-jp-note-pick")) {
        var picked = t.value || "";
        var eidPick = t.getAttribute("data-aj-jp-note-pick");
        setLocalNote(eidPick, picked);
        var noteInput = root.querySelector('[data-aj-jp-note="' + eidPick + '"]');
        if (noteInput) {
          noteInput.value = picked;
        }
        return;
      }
      var gapItem = t.closest("[data-gap]");
      if (gapItem && t.getAttribute("data-gap-field")) {
        var eid = gapItem.getAttribute("data-gap");
        if (state.gapDrafts[eid]) {
          state.gapDrafts[eid][t.getAttribute("data-gap-field")] = t.value;
        }
        return;
      }
      if (gapItem && t.getAttribute("data-gap-step")) {
        var gid = gapItem.getAttribute("data-gap");
        if (state.gapDrafts[gid]) {
          if (!state.gapDrafts[gid].action_steps || !state.gapDrafts[gid].action_steps[0]) {
            state.gapDrafts[gid].action_steps = [{}];
          }
          state.gapDrafts[gid].action_steps[0][t.getAttribute("data-gap-step")] = t.value;
        }
        return;
      }
      var idpGoal = t.closest("[data-idp-index]");
      if (idpGoal && state.idpDraft) {
        var idx = Number(idpGoal.getAttribute("data-idp-index"));
        var goal = state.idpDraft.goals[idx];
        if (!goal) {
          return;
        }
        if (t.getAttribute("data-idp-field")) {
          goal[t.getAttribute("data-idp-field")] = t.value;
        }
        if (t.getAttribute("data-idp-act")) {
          goal.activities = goal.activities || {};
          goal.activities[t.getAttribute("data-idp-act")] = t.value;
        }
      }
    });
    root.addEventListener("click", function (event) {
      var t = event.target;
      if (!t || !t.closest) {
        return;
      }
      var phaseBtn = t.closest("[data-aj-jp-phase]");
      if (phaseBtn) {
        state.phase = phaseBtn.getAttribute("data-aj-jp-phase") || "mid";
        setPhaseButtons();
        paintElements();
        return;
      }
      var rateBtn = t.closest("[data-aj-jp-rate]");
      if (rateBtn) {
        setLocalRating(rateBtn.getAttribute("data-aj-jp-rate"), rateBtn.getAttribute("data-rating"), false);
        return;
      }
      var selfBtn = t.closest("[data-aj-jp-self]");
      if (selfBtn) {
        setLocalRating(selfBtn.getAttribute("data-aj-jp-self"), selfBtn.getAttribute("data-rating"), true);
        return;
      }
      var excelBtn = t.closest("[data-aj-jp-excel]");
      if (excelBtn) {
        var eid = excelBtn.getAttribute("data-aj-jp-excel");
        var box = root.querySelector('[data-aj-jp-excel-box="' + eid + '"]');
        var item = elements().filter(function (row) {
          return row.id === eid;
        })[0];
        if (box && item) {
          var open = box.hasAttribute("hidden");
          if (open) {
            box.hidden = false;
            box.textContent =
              "مسطرة التميّز (المستوى 5 — مثالي): " +
              ((item.levels && (item.levels["5"] || item.levels[5])) || "");
          } else {
            box.hidden = true;
          }
        }
        return;
      }
      if (t.closest("#aj-jp-save-scores")) {
        saveManagerScores();
        return;
      }
      if (t.closest("#aj-jp-save-self")) {
        saveSelfScores();
        return;
      }
      if (t.closest("#aj-jp-save-idp")) {
        saveIdp();
        return;
      }
      if (t.closest("#aj-jp-print-official")) {
        printOfficial();
        return;
      }
      var gapSave = t.closest("[data-aj-jp-save-gap]");
      if (gapSave) {
        saveGap(gapSave.getAttribute("data-aj-jp-save-gap"));
      }
    });
  }

  function printOfficial() {
    if (!state.record || !state.record.id) {
      status("افتح سجلاً أولاً باختيار المنسوب والدورة.", true);
      return;
    }
    if (!window.AjJobPerformancePrint || typeof window.AjJobPerformancePrint.openPrint !== "function") {
      status("وحدة الطباعة الرسمية غير محمّلة.", true);
      return;
    }
    var user = sessionUser() || {};
    var person = selectedPerson() || {};
    var evaluatorId = String(user.id || user.national_id || "").trim();
    var staffId = String(person.id || state.record.staff_id || "").trim();
    if (evaluatorId && staffId && evaluatorId === staffId) {
      status("لا يجوز اعتماد/طباعة تقويم رسمي للمنسوب لنفسه. اختر منسوبًا آخر أو ادخل بحساب المقوّم المختص.", true);
      return;
    }
    var recordId = state.record.id;
    var cycleEl = document.getElementById("aj-jp-cycle");
    var cycleLabel = "";
    if (cycleEl && cycleEl.selectedIndex >= 0) {
      cycleLabel = cycleEl.options[cycleEl.selectedIndex].text || "";
    }
    status("جارٍ تجهيز الطباعة الرسمية…");
    fetchJson(API + "/records/" + recordId, { headers: authHeaders(), cache: "no-store" })
      .then(function (record) {
        state.record = record;
        var roleCode = record.assignment_role || selectedRoleCode();
        return window.AjJobPerformancePrint.openPrint({
          record: record,
          person: person,
          phase: state.phase,
          roleTitle: (state.roleCodes && state.roleCodes[roleCode]) || roleCode,
          regulatoryFramework:
            (state.template && state.template.regulatory_framework) ||
            (roleCode === "admin_staff" ? "لائحة الموارد البشرية العامة" : ""),
          cycleLabel: cycleLabel,
          evaluatorName: user.name || user.full_name || "",
          evaluatorId: evaluatorId,
          elements: record.weights_snapshot || elements()
        });
      })
      .then(function (pack) {
        if (pack && pack.ok === false) {
          status(pack.error || "تعذر فتح معاينة الطباعة.", true);
          return;
        }
        status("معاينة الطباعة الرسمية جاهزة.");
      })
      .catch(function (error) {
        status((error && error.message) || "تعذر فتح الطباعة الرسمية.", true);
      });
  }

  function load() {
    bind();
    setPhaseButtons();
    status("جارٍ التحميل…");
    Promise.all([
      fetchJson(API + "/cycles", { headers: authHeaders(), cache: "no-store" }),
      fetchJson(API + "/meta", { headers: authHeaders(), cache: "no-store" }),
      fetchJson(API + "/templates/teacher", { headers: authHeaders(), cache: "no-store" }),
      fetchJson("/api/noor/staff", { headers: authHeaders(), cache: "no-store" })
    ])
      .then(function (parts) {
        state.cycles = parts[0].items || [];
        state.roleCodes = parts[1].role_codes || {};
        state.template = parts[2];
        var people = parts[3].people || parts[3].items || [];
        state.staff = people
          .filter(function (person) {
            return person.active !== false;
          })
          .map(function (person) {
            return {
              id: String(person.id || person.national_id),
              name: person.name || "",
              role: person.role || "",
              specialty: person.specialty || "",
              assignment_role: person.assignment_role || ""
            };
          });
        paintCycles();
        paintStaff();
        paintRoleOptions("teacher");
        paintTeacherMeta();
        if (!state.record) {
          paintElements();
        }
        status("اختر الدورة والمنسوب؛ يُحمَّل القالب تلقائياً من الإسناد.");
        var teacherEl = document.getElementById("aj-jp-teacher");
        if (teacherEl && teacherEl.value) {
          return onStaffChanged();
        }
        return null;
      })
      .catch(function (error) {
        status(error.message || "تعذر تحميل وحدة تقويم الأداء.", true);
      });
  }

  window.AjJobPerformance = {
    load: load,
    printOfficial: printOfficial
  };
})();
