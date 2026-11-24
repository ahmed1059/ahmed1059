/* طباعة رسمية لتقويم الأداء الوظيفي عبر print-official-core / PrintEngine. */
(function (root) {
  "use strict";

  var SCHOOL_STAT = "40341";
  var SCHOOL_NAME = "متوسطة سعد بن الربيع الأنصاري";

  function escapeHtml(value) {
    if (root.OfficialFrameCore && typeof root.OfficialFrameCore.escapeHtml === "function") {
      return root.OfficialFrameCore.escapeHtml(value);
    }
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function phaseLabel(phase) {
    return phase === "final" ? "التقييم الختامي" : "المراجعة النصف سنوية";
  }

  function docTitle(phase) {
    return "بطاقة تقييم الأداء الوظيفي — " + phaseLabel(phase);
  }

  function ratingMap(scores, phase) {
    var map = {};
    (scores && scores[phase] ? scores[phase] : []).forEach(function (row) {
      if (!row || !row.element_id) {
        return;
      }
      map[row.element_id] = row.rating;
      if (row.note) {
        map["note_" + row.element_id] = row.note;
      }
    });
    return map;
  }

  function metaCell(label, value) {
    return (
      "<td class=\"aj-jp-print-meta-cell\"><strong>" +
      escapeHtml(label) +
      ":</strong> " +
      escapeHtml(value == null || value === "" ? "—" : value) +
      "</td>"
    );
  }

  function metaTable(pairs) {
    var cells = (pairs || [])
      .filter(function (pair) {
        return pair && pair[0];
      })
      .map(function (pair) {
        return metaCell(pair[0], pair[1]);
      });
    var rows = [];
    var i;
    for (i = 0; i < cells.length; i += 2) {
      rows.push(
        "<tr>" + cells[i] + (cells[i + 1] || "<td class=\"aj-jp-print-meta-cell\"></td>") + "</tr>"
      );
    }
    if (!rows.length) {
      return "";
    }
    return "<table class=\"aj-jp-print-meta\" role=\"presentation\">" + rows.join("") + "</table>";
  }

  function scoresTable(elements, ratings) {
    var head =
      "<thead><tr>" +
      "<th class=\"aj-jp-print-serial\">م</th>" +
      "<th>عنصر التقييم</th>" +
      "<th class=\"aj-jp-print-num\">الوزن %</th>" +
      "<th class=\"aj-jp-print-num\">التقدير</th>" +
      "<th class=\"aj-jp-print-num\">الموزون %</th>" +
      "<th>ملاحظة</th>" +
      "</tr></thead>";
    var body = (elements || [])
      .map(function (item, index) {
        var rating = ratings[item.id];
        var hasRating = rating != null && rating !== "";
        var weighted = "—";
        if (hasRating) {
          var n = Number(rating);
          var w = Number(item.weight || 0);
          if (n >= 1 && n <= 5) {
            weighted = (Math.round((n / 5) * w * 100) / 100).toFixed(2);
          }
        }
        var note = ratings["note_" + item.id] || "";
        var section = item.section_label || item.section || "";
        var label = item.label || item.id;
        if (section) {
          label = label;
        }
        return (
          "<tr>" +
          "<td class=\"aj-jp-print-serial\">" +
          (index + 1) +
          "</td>" +
          "<td>" +
          escapeHtml(label) +
          (section
            ? "<div class=\"aj-jp-print-section-tag\">" + escapeHtml(section) + "</div>"
            : "") +
          "</td>" +
          "<td class=\"aj-jp-print-num\">" +
          escapeHtml(String(item.weight == null ? "" : item.weight)) +
          "</td>" +
          "<td class=\"aj-jp-print-num\">" +
          (hasRating ? escapeHtml(String(rating)) : "—") +
          "</td>" +
          "<td class=\"aj-jp-print-num\">" +
          escapeHtml(weighted) +
          "</td>" +
          "<td>" +
          escapeHtml(note) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
    return (
      "<table class=\"aj-jp-print-scores\">" +
      head +
      "<tbody>" +
      body +
      "</tbody></table>"
    );
  }

  function resultBox(record, phase) {
    var percent =
      phase === "final" ? record.final_percent : record.mid_percent;
    var band =
      phase === "final" ? record.final_band_label : record.mid_band_label;
    var readiness =
      phase === "final" ? record.readiness_final : record.readiness_mid;
    return (
      "<div class=\"aj-jp-print-result\">" +
      "<p><strong>النتيجة الرسمية من 100%:</strong> " +
      escapeHtml(percent == null || percent === "" ? "—" : Number(percent).toFixed(2) + " %") +
      "</p>" +
      "<p><strong>التقدير اللفظي الرسمي:</strong> " +
      escapeHtml(band || "—") +
      "</p>" +
      "<p><strong>جاهزية البنود:</strong> " +
      escapeHtml(readiness == null || readiness === "" ? "—" : Number(readiness).toFixed(1) + " %") +
      "</p>" +
      "<p class=\"aj-jp-print-ssot\">عمود الموزون = (التقدير ÷ 5) × الوزن، ومجموعه يطابق النتيجة من 100%. التقييم الذاتي مرجع بصري فقط ولا يدخل في المجموع الرسمي. المرجع الاعتمادي النهائي: النظام التقني الرسمي لوزارة التعليم.</p>" +
      "</div>"
    );
  }

  function gapAppendix(gapPlans, elements) {
    var plans = (gapPlans || []).filter(function (plan) {
      return plan && plan.element_id;
    });
    if (!plans.length) {
      return "";
    }
    var byId = {};
    (elements || []).forEach(function (item) {
      byId[item.id] = item;
    });
    var blocks = plans
      .map(function (plan, index) {
        var label = (byId[plan.element_id] && byId[plan.element_id].label) || plan.element_id;
        var step = (plan.action_steps && plan.action_steps[0]) || {};
        return (
          "<section class=\"aj-jp-print-gap-item\">" +
          "<h3>" +
          (index + 1) +
          ". " +
          escapeHtml(label) +
          " — درجة التمكن: " +
          escapeHtml(String(plan.current_rating == null ? "—" : plan.current_rating)) +
          "</h3>" +
          "<p><strong>أسباب الدرجة:</strong> " +
          escapeHtml(plan.reasons || "—") +
          "</p>" +
          "<p><strong>نقاط القوة:</strong> " +
          escapeHtml(plan.strengths || "—") +
          "</p>" +
          "<p><strong>جوانب التحسين:</strong> " +
          escapeHtml(plan.improve_areas || "—") +
          "</p>" +
          "<p><strong>الخطوة الإجرائية:</strong> " +
          escapeHtml(step.step || "—") +
          "</p>" +
          "<p><strong>زمن التنفيذ / المكلف:</strong> " +
          escapeHtml([step.when, step.owner].filter(Boolean).join(" · ") || "—") +
          "</p>" +
          "<p><strong>مؤشر الأداء / الشواهد:</strong> " +
          escapeHtml([step.indicator, step.evidence].filter(Boolean).join(" · ") || "—") +
          "</p>" +
          "</section>"
        );
      })
      .join("");
    return (
      "<div class=\"aj-jp-print-appendix aj-jp-print-break\">" +
      "<h2 class=\"aj-jp-print-appendix-title\">ملحق: خطة تحسين فجوة الأداء</h2>" +
      "<p class=\"aj-jp-print-note\">وفق الدليل الإرشادي لإدارة الأداء الوظيفي (ص 11) — تُفعَّل عند التقدير 1 أو 2 في المراجعة النصف سنوية.</p>" +
      blocks +
      "</div>"
    );
  }

  function idpHasContent(idp) {
    if (!idp || !Array.isArray(idp.goals)) {
      return false;
    }
    return idp.goals.some(function (goal) {
      return goal && String(goal.title || "").trim();
    });
  }

  function idpAppendix(idp) {
    if (!idpHasContent(idp)) {
      return "";
    }
    var goals = (idp.goals || [])
      .filter(function (goal) {
        return goal && String(goal.title || "").trim();
      })
      .map(function (goal, index) {
        var act = goal.activities || {};
        return (
          "<section class=\"aj-jp-print-idp-item\">" +
          "<h3>الهدف التطويري " +
          (index + 1) +
          ": " +
          escapeHtml(goal.title) +
          "</h3>" +
          "<p><strong>70% تجارب وخبرات:</strong> " +
          escapeHtml(act["70"] || "—") +
          "</p>" +
          "<p><strong>20% تعلم من الآخرين:</strong> " +
          escapeHtml(act["20"] || "—") +
          "</p>" +
          "<p><strong>10% تعلم مباشر:</strong> " +
          escapeHtml(act["10"] || "—") +
          "</p>" +
          "<p><strong>الداعم / معايير النجاح:</strong> " +
          escapeHtml([goal.supporter, goal.success].filter(Boolean).join(" · ") || "—") +
          "</p>" +
          "</section>"
        );
      })
      .join("");
    return (
      "<div class=\"aj-jp-print-appendix aj-jp-print-break\">" +
      "<h2 class=\"aj-jp-print-appendix-title\">ملحق: خطة التطوير الفردية IDP (70 / 20 / 10)</h2>" +
      "<p class=\"aj-jp-print-note\">وفق الدليل الإرشادي لإدارة الأداء الوظيفي (ص 68).</p>" +
      "<p><strong>الفترة:</strong> " +
      escapeHtml([idp.start_date, idp.end_date].filter(Boolean).join(" → ") || "—") +
      "</p>" +
      (idp.notes
        ? "<p><strong>ملاحظات:</strong> " + escapeHtml(idp.notes) + "</p>"
        : "") +
      goals +
      "</div>"
    );
  }

  function buildBodyParts(ctx) {
    ctx = ctx || {};
    var record = ctx.record || {};
    var person = ctx.person || {};
    var phase = ctx.phase === "final" ? "final" : "mid";
    var elements = record.weights_snapshot || ctx.elements || [];
    var ratings = ratingMap(record.scores, phase);
    var roleTitle = ctx.roleTitle || record.assignment_role || "";
    var framework =
      ctx.regulatoryFramework ||
      (record.assignment_role === "admin_staff"
        ? "لائحة الموارد البشرية العامة"
        : "دليل إدارة الأداء الوظيفي لشاغلي الوظائف التعليمية");
    var cycleLabel = ctx.cycleLabel || "";
    var main = [];
    main.push("<div class=\"aj-jp-print\">");
    main.push(
      metaTable([
        ["اسم المنسوب", person.name || record.staff_name || ""],
        ["الصفة / المسمى", person.role || ""],
        ["التخصص", person.specialty || ""],
        ["رقم الهوية", person.id || record.staff_id || ""],
        ["قالب التقويم", roleTitle],
        ["الإطار النظامي", framework],
        ["مرحلة التقييم", phaseLabel(phase)],
        ["دورة الأداء", cycleLabel],
        ["المدرسة", SCHOOL_NAME],
        ["الرقم الإحصائي", SCHOOL_STAT]
      ])
    );
    main.push("<h2 class=\"aj-jp-print-section-title\">عناصر التقييم والأوزان</h2>");
    main.push(scoresTable(elements, ratings));
    main.push(resultBox(record, phase));
    main.push("</div>");
    var appendices = [];
    appendices.push(gapAppendix(record.gap_plans, elements));
    if (phase === "final") {
      appendices.push(idpAppendix(record.idp));
    }
    return {
      mainHtml: main.join(""),
      appendixHtml: appendices.join(""),
      hasAppendix: /aj-jp-print-appendix/.test(appendices.join(""))
    };
  }

  function buildBodyHtml(ctx) {
    var parts = buildBodyParts(ctx);
    return parts.mainHtml + parts.appendixHtml;
  }

  function defaultSignatures(ctx) {
    ctx = ctx || {};
    var evaluator = ctx.evaluatorName || "";
    var staff = (ctx.person && ctx.person.name) || (ctx.record && ctx.record.staff_name) || "";
    var principal = ctx.principalName || "";
    return [
      {
        roleTitle: "المقوّم",
        name: evaluator,
        signature: ctx.evaluatorSignature || "",
        signatureFallback: "signatures/sig_teachers.png"
      },
      {
        roleTitle: "المنسوب",
        name: staff,
        signature: ctx.staffSignature || "",
        signatureFallback: "signatures/sig_students.png"
      },
      {
        roleTitle: "مدير المدرسة",
        name: principal,
        signature: ctx.principalSignature || "",
        signatureFallback: "signatures/sig_manager.png"
      }
    ];
  }

  function resolvePrincipal(columns) {
    var list = Array.isArray(columns) ? columns : [];
    var found = list.filter(function (col) {
      return col && String(col.roleTitle || col.role || "").indexOf("مدير") >= 0;
    })[0];
    if (!found) {
      found = list[list.length - 1];
    }
    return found || {};
  }

  function openPrint(ctx) {
    ctx = ctx || {};
    if (!ctx.record || !ctx.record.id) {
      return { ok: false, error: "لا سجل تقويم مفتوح للطباعة." };
    }
    var evaluatorId = String(ctx.evaluatorId || "").trim();
    var staffId = String(
      (ctx.person && ctx.person.id) || (ctx.record && ctx.record.staff_id) || ""
    ).trim();
    if (evaluatorId && staffId && evaluatorId === staffId) {
      return {
        ok: false,
        error: "لا يجوز اعتماد/طباعة تقويم رسمي للمنسوب لنفسه."
      };
    }
    if (!root.PrintEngine || typeof root.PrintEngine.open !== "function") {
      return { ok: false, error: "محرك الطباعة الموحد غير محمّل." };
    }
    var phase = ctx.phase === "final" ? "final" : "mid";
    var title = docTitle(phase);
    var staffName =
      (ctx.person && ctx.person.name) || ctx.record.staff_name || "";
    var elementCount = (ctx.record.weights_snapshot || ctx.elements || []).length;
    var parts = buildBodyParts(ctx);
    var hasAppendix = !!parts.hasAppendix;
    var frameClass =
      "aj-jp-print-doc" + (elementCount >= 15 ? " aj-jp-print-dense" : "");

    function launch(signatures) {
      var signHtml = "";
      if (root.OfficialFrameCore && typeof root.OfficialFrameCore.signoff === "function") {
        signHtml =
          "<div class=\"aj-jp-print-signoff-keep\">" +
          root.OfficialFrameCore.signoff({
            school: SCHOOL_NAME,
            columns: signatures,
            omitBottomBar: true,
            pageLabel: " "
          }) +
          "</div>";
      }
      return root.PrintEngine.open("master-sheet", {
        docTitle: title,
        title: title,
        kind: "document",
        fileName:
          "تقويم_أداء_" +
          (staffName || "منسوب") +
          "_" +
          (phase === "final" ? "ختامي" : "نصف_سنوي"),
        bodyHtml: parts.mainHtml + signHtml + parts.appendixHtml,
        frameClass: frameClass,
        signatures: [],
        signoff: false,
        orientation: "portrait",
        multiPage: hasAppendix,
        footerHeight: hasAppendix ? 12 : 10,
        omitSignoffBottom: true,
        unifiedFooter: true,
        pageFootLabel: " ",
        strictIdentity: true,
        school: SCHOOL_NAME
      });
    }

    var baseSig = defaultSignatures(ctx);
    if (root.AJPrint && typeof root.AJPrint.leadership === "function") {
      return root.AJPrint.leadership("admin")
        .then(function (columns) {
          var principal = resolvePrincipal(columns);
          baseSig[2].name = principal.name || baseSig[2].name;
          if (principal.signature || principal.signaturePath) {
            baseSig[2].signature = principal.signature || principal.signaturePath;
          }
          return launch(baseSig);
        })
        .catch(function () {
          return launch(baseSig);
        });
    }
    return Promise.resolve(launch(baseSig));
  }

  root.AjJobPerformancePrint = {
    buildBodyHtml: buildBodyHtml,
    buildBodyParts: buildBodyParts,
    openPrint: openPrint,
    docTitle: docTitle,
    phaseLabel: phaseLabel,
    SCHOOL_STAT: SCHOOL_STAT
  };
})(window);
