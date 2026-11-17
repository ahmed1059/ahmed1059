/* م1 · قرار 142 · واجهة خطتي */
(function () {
  "use strict";

  var CORE_ROLES = [
    "principal",
    "vice_teachers",
    "vice_students",
    "vice_admin",
    "student_counselor",
    "health_counselor",
    "teacher",
    "activity_leader",
    "librarian",
    "lab_tech",
    "admin_assistant"
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var ROLE_ALIASES = {
    principal: ["مدير المدرسة", "مدير"],
    vice_teachers: ["وكيل الشؤون التعليمية", "وكيل شؤون المعلمين", "وكيل المعلمين"],
    vice_students: ["وكيل شؤون الطلاب", "وكيل الطلاب"],
    vice_admin: ["وكيل الشؤون المدرسية", "وكيل الشؤون الإدارية"],
    student_counselor: ["الموجه الطلابي", "موجه طلابي"],
    health_counselor: ["الموجه الصحي", "موجه صحي"],
    teacher: ["المعلم", "معلم"],
    activity_leader: ["رائد النشاط الطلابي", "رائد النشاط"],
    librarian: ["أمين مصادر التعلم", "أمين المصادر"],
    lab_tech: ["محضر المختبر", "محضر معامل"],
    admin_assistant: ["المساعد الإداري", "مساعد إداري"]
  };

  function resolveRoleToken(token) {
    var v = String(token == null ? "" : token).trim();
    if (!v) return "";
    if (CORE_ROLES.indexOf(v) !== -1) return v;
    var keys = Object.keys(ROLE_ALIASES);
    for (var i = 0; i < keys.length; i++) {
      var id = keys[i];
      var aliases = ROLE_ALIASES[id];
      if (aliases.indexOf(v) !== -1) return id;
      for (var j = 0; j < aliases.length; j++) {
        if (v.indexOf(aliases[j]) !== -1) return id;
      }
    }
    return "";
  }

  function readSessionRole() {
    var params = new URLSearchParams(window.location.search || "");
    var fromQuery = resolveRoleToken(params.get("role") || "");
    if (fromQuery) return fromQuery;
    try {
      var raw = sessionStorage.getItem("sessionUser");
      if (!raw) return "principal";
      var s = JSON.parse(raw);
      var candidates = [s.owner_role, s.role_id, s.roleKey, s.role];
      for (var i = 0; i < candidates.length; i++) {
        var hit = resolveRoleToken(candidates[i]);
        if (hit) return hit;
      }
    } catch (e) {}
    return "principal";
  }

  function emptyHtml(msg) {
    return '<p class="mp-empty">' + esc(msg) + "</p>";
  }

  function renderGoals(pack) {
    var host = $("mp-goals");
    var rows = pack.goals || [];
    if (!rows.length) {
      host.innerHTML = emptyHtml("لا أهداف مربوطة بهذا الدور في roles.json.");
      return;
    }
    var html =
      '<table class="mp-table"><thead><tr><th>الرمز</th><th>نص الهدف (إن وُجد محفوظاً)</th></tr></thead><tbody>';
    rows.forEach(function (g) {
      html +=
        "<tr><td>" +
        esc(g.id) +
        "</td><td>" +
        (g.text ? esc(g.text) : '<span class="mp-empty">يُستكمل من التشغيلية عند توفر الخادم</span>') +
        "</td></tr>";
    });
    html += "</tbody></table>";
    host.innerHTML = html;
  }

  function renderPrograms(pack) {
    var host = $("mp-programs");
    var all = pack.programs || [];
    var params = new URLSearchParams(window.location.search || "");
    var showSeasonal = params.get("seasonal") === "1";
    var seasonalHidden = all.filter(function (p) {
      return !!p.seasonal;
    });
    var rows = all.filter(function (p) {
      return showSeasonal ? true : !p.seasonal;
    });
    if (!all.length) {
      var note = pack.pack_note
        ? pack.pack_note
        : "لا برامج مملوكة لهذا الدور في النواة المعتمدة بعد.";
      host.innerHTML = emptyHtml(note);
      return;
    }
    var filterNote =
      '<p class="mp-field-label">عدد برامج هذا الدور: ' +
      esc(all.length) +
      (seasonalHidden.length && !showSeasonal
        ? " · موسمي مخفي: " +
          esc(seasonalHidden.length) +
          ' — أضف <code>?seasonal=1</code> للإظهار'
        : "") +
      " · الفلترة حسب <strong>owner_role</strong> للدور المختار فقط</p>";
    if (!rows.length) {
      host.innerHTML =
        filterNote + emptyHtml("كل برامج هذا الدور موسمية ومخفية حالياً.");
      return;
    }
    var html =
      filterNote +
      '<table class="mp-table"><thead><tr><th>البرنامج</th><th>الهدف</th><th>الوسم</th></tr></thead><tbody>';
    rows.forEach(function (p) {
      var tag = p.seasonal
        ? '<span class="mp-badge-candidate" style="background:#0b5e56">موسمي</span>'
        : "معتمد";
      if (p.duplicate_of) {
        tag +=
          ' <span class="mp-badge-dup" title="' +
          esc(p.duplicate_reason || p.duplicate_of) +
          '">مكرر ← ' +
          esc(p.duplicate_of) +
          "</span>";
      }
      html +=
        "<tr" +
        (p.duplicate_of ? ' class="is-duplicate"' : "") +
        "><td>" +
        esc(p.label || p.name) +
        "</td><td>" +
        esc(p.goal_ref) +
        "</td><td>" +
        tag +
        "</td></tr>";
    });
    html += "</tbody></table>";
    host.innerHTML = html;
  }

  function renderKnowledge(pack) {
    var host = $("mp-knowledge");
    if (!host) return;
    var rows = pack.knowledge_candidates || [];
    if (!rows.length) {
      host.innerHTML = emptyHtml("لا مرشحين معرفة لهذا الدور (أو كلها معتمدة في النواة).");
      return;
    }
    var html =
      '<p class="mp-candidate-banner">⚠ هذه برامج <strong>مقترحة (مرشّحة)</strong> وليست معتمدة للتنفيذ. تحتاج اعتماداً من المدير قبل التنفيذ. لا تُعامل كبرامج النواة.</p>' +
      '<table class="mp-table"><thead><tr><th>#</th><th>العنوان</th><th>الحالة</th><th>الهدف</th></tr></thead><tbody>';
    rows.forEach(function (k) {
      html +=
        '<tr class="is-candidate"><td>' +
        esc(k.archive_ref) +
        '</td><td>' +
        esc(k.title) +
        ' <span class="mp-badge-candidate">مرشّح</span>' +
        (k.duplicate_of
          ? ' <span class="mp-badge-dup">مكرر ← ' + esc(k.duplicate_of) + "</span>"
          : "") +
        "</td><td>" +
        esc(k.status) +
        "</td><td>" +
        esc(k.goal_ref || "—") +
        "</td></tr>";
    });
    html += "</tbody></table>";
    host.innerHTML = html;
  }

  function renderTasks(pack) {
    var host = $("mp-tasks");
    var rows = pack.tasks || [];
    if (!rows.length) {
      host.innerHTML = emptyHtml(
        "لا بنود لهذا الدور في بنك المهام (قد يكون بنك فارغ موثّقاً للأدوار بلا مرشحين)."
      );
      return;
    }
    var summary = pack.task_goal_summary || {};
    var filterHtml =
      '<div class="mp-field-label" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
      "<span>مربوط: " +
      esc(summary.mapped || 0) +
      " · غير مربوط: " +
      esc(summary.unmapped || 0) +
      "</span>" +
      '<label>تصفية حسب الهدف ' +
      '<select id="mp-goal-filter">' +
      '<option value="">الكل</option>' +
      '<option value="G1">G1</option>' +
      '<option value="G2">G2</option>' +
      '<option value="G3">G3</option>' +
      '<option value="G4">G4</option>' +
      '<option value="G5">G5</option>' +
      '<option value="G6">G6</option>' +
      '<option value="G7">G7</option>' +
      '<option value="unmapped">unmapped</option>' +
      "</select></label></div>";

    var html =
      filterHtml +
      '<table class="mp-table" id="mp-tasks-table"><thead><tr><th>الرمز</th><th>البند</th><th>الهدف</th><th>الأسبوع</th></tr></thead><tbody>';
    rows.forEach(function (t) {
      var g = t.goal_id || "unmapped";
      html +=
        '<tr data-goal="' +
        esc(g) +
        '"><td>' +
        esc(t.task_code) +
        "</td><td>" +
        esc(t.title) +
        "</td><td>" +
        esc(g) +
        "</td><td>" +
        esc(t.week_target) +
        "</td></tr>";
    });
    html += "</tbody></table>";
    host.innerHTML = html;
    var sel = $("mp-goal-filter");
    if (sel) {
      sel.addEventListener("change", function () {
        var want = sel.value;
        var trs = host.querySelectorAll("#mp-tasks-table tbody tr");
        trs.forEach(function (tr) {
          var g = tr.getAttribute("data-goal") || "";
          tr.style.display = !want || g === want ? "" : "none";
        });
      });
    }
  }

  function renderIndicators(pack) {
    var host = $("mp-indicators");
    var rows = pack.indicators || [];
    if (!rows.length) {
      host.innerHTML = emptyHtml("لا مؤشرات مطابقة لرموز الدور في indicators.json.");
      return;
    }
    var html = '<ul class="mp-chips">';
    rows.forEach(function (ind) {
      html +=
        "<li><strong>" +
        esc(ind.code) +
        "</strong> — " +
        esc(ind.label_ar || "—") +
        "</li>";
    });
    html += "</ul>";
    host.innerHTML = html;
  }

  function renderRegisters(pack) {
    var host = $("mp-registers");
    var rows = pack.registers || [];
    if (!rows.length) {
      host.innerHTML = emptyHtml("لا سجلات مربوطة.");
      return;
    }
    var html = '<ul class="mp-chips">';
    rows.forEach(function (r) {
      html += "<li>" + esc(r.id) + " — " + esc(r.label_ar) + "</li>";
    });
    html += "</ul>";
    host.innerHTML = html;
  }

  function renderTemplates(pack) {
    var host = $("mp-templates");
    var rows = pack.templates || [];
    if (!rows.length) {
      host.innerHTML = emptyHtml("لا قوالب مربوطة.");
      return;
    }
    var html = '<ul class="mp-chips">';
    rows.forEach(function (t) {
      html +=
        "<li><a href=\"" +
        esc(t.href) +
        "\">" +
        esc(t.id) +
        "</a> — " +
        esc(t.label_ar) +
        "</li>";
    });
    html += "</ul>";
    host.innerHTML = html;
  }

  function renderPack(pack) {
    var root = $("mp-root");
    var status = $("mp-status");
    if (!pack || !pack.ok) {
      root.hidden = true;
      status.innerHTML = '<span class="mp-error">' + esc((pack && pack.error) || "فشل البناء") + "</span>";
      return;
    }
    root.hidden = false;
    $("mp-cover").textContent =
      "الدور: " +
      pack.role_label +
      " (" +
      pack.role_id +
      ") · برامج: " +
      (pack.programs || []).length +
      " · بنود: " +
      (pack.tasks || []).length +
      " · مصدر البرامج: " +
      ((pack.meta && pack.meta.programs_source) || "—") +
      " · مصدر البنود: " +
      ((pack.meta && pack.meta.tasks_source) || "—");
    renderGoals(pack);
    renderPrograms(pack);
    renderKnowledge(pack);
    renderTasks(pack);
    renderIndicators(pack);
    renderRegisters(pack);
    renderTemplates(pack);
    status.textContent =
      "م1 جاهز · " +
      pack.role_label +
      " · " +
      (pack.programs || []).length +
      " برنامج · " +
      (pack.tasks || []).length +
      " بند";
  }

  function fillRoleSelect(roles, selected) {
    var sel = $("mp-role-select");
    sel.innerHTML = "";
    roles.forEach(function (r) {
      var opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.label_ar;
      if (r.id === selected) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function load(roleId) {
    var status = $("mp-status");
    status.textContent = "جاري بناء الحزمة…";
    if (!window.RolePlanPack) {
      status.innerHTML = '<span class="mp-error">RolePlanPack غير محمّل</span>';
      return;
    }
    window.RolePlanPack.loadPack(roleId, {
      rolesUrl: "roles.json",
      programsUrl: "../_shared/programs.json",
      indicatorsUrl: "../_shared/indicators.json",
      linksUrl: "task_goal_links.json",
      knowledgeUrl: "../_shared/programs_knowledge.json"
    })
      .then(renderPack)
      .catch(function (err) {
        $("mp-root").hidden = true;
        status.innerHTML =
          '<span class="mp-error">' + esc(err && err.message ? err.message : err) + "</span>";
      });
  }

  function boot() {
    var initial = readSessionRole();
    var api = window.RolePlanPack;
    if (!api) {
      $("mp-status").innerHTML = '<span class="mp-error">RolePlanPack غير محمّل</span>';
      return;
    }
    api
      .listRoles({ rolesUrl: "roles.json" })
      .then(function (roles) {
        fillRoleSelect(roles, initial);
        load(initial);
      })
      .catch(function (err) {
        $("mp-status").innerHTML =
          '<span class="mp-error">' + esc(err && err.message ? err.message : err) + "</span>";
      });

    $("mp-role-select").addEventListener("change", function () {
      var role = $("mp-role-select").value;
      try {
        var raw = sessionStorage.getItem("sessionUser");
        var s = raw ? JSON.parse(raw) : {};
        s.owner_role = role;
        s.role = role;
        sessionStorage.setItem("sessionUser", JSON.stringify(s));
      } catch (e) {}
      var url = new URL(window.location.href);
      url.searchParams.set("role", role);
      window.history.replaceState({}, "", url.toString());
      load(role);
    });
    $("mp-reload").addEventListener("click", function () {
      load($("mp-role-select").value || readSessionRole());
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
