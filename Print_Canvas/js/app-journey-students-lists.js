/* قوائم الموهوبين والمتدني — جلسة فقط */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var cache = null;
  var directory = null;

  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function authHeaders() {
    var headers = {};
    var user = currentUser();
    if (user && user.token) {
      headers["X-Session-Token"] = user.token;
    }
    return headers;
  }

  function jsonHeaders() {
    var headers = authHeaders();
    headers["Content-Type"] = "application/json";
    return headers;
  }

  function isPrincipal() {
    var user = currentUser();
    return !!(user && String(user.role || "").indexOf("مدير") === 0);
  }

  function apiError(body, fallback) {
    if (body && body.detail) {
      if (typeof body.detail === "string") {
        return body.detail;
      }
      if (Array.isArray(body.detail) && body.detail[0] && body.detail[0].msg) {
        return body.detail[0].msg;
      }
    }
    return fallback;
  }

  function jsonFetch(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error(apiError(body, "تعذر إكمال الطلب."));
        }
        return body;
      });
    });
  }

  function setStatus(text, isError) {
    var node = document.getElementById("aj-sl-status");
    if (!node) {
      return;
    }
    node.textContent = text || "";
    node.classList.toggle("is-error", !!isError);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function kindForProgram(name, templateKey) {
    var key = String(templateKey || "");
    if (key === "gifted") {
      return "gifted";
    }
    if (key === "loss") {
      return "struggling";
    }
    var text = String(name || "");
    if (text.indexOf("موهوبين") >= 0) {
      return "gifted";
    }
    if (text.indexOf("الفاقد") >= 0 || text.indexOf("المتدني") >= 0) {
      return "struggling";
    }
    return "";
  }

  function packOf(kind) {
    return cache && cache.lists && cache.lists[kind] ? cache.lists[kind] : null;
  }

  function approvedRows(kind) {
    var pack = packOf(kind);
    if (!pack) {
      return [];
    }
    return (pack.items || []).filter(function (item) {
      return item.status === "approved";
    }).map(function (item) {
      return {
        name: item.student_name,
        grade: item.grade,
        section: item.section
      };
    });
  }

  function tableHtml(rows, title) {
    var list = rows || [];
    if (!list.length) {
      return "";
    }
    var body = list.map(function (row, index) {
      return "<tr><td>" + (index + 1) + "</td><td>" + escapeHtml(row.name) + "</td><td>"
        + escapeHtml(row.grade) + "</td><td>" + escapeHtml(row.section) + "</td></tr>";
    }).join("");
    var heading = title
      ? "<h2 class=\"tpl-section-title\">" + escapeHtml(title) + "</h2>"
      : "";
    return "<section class=\"tpl-section\">" + heading
      + "<div class=\"tpl-table-wrap\"><table class=\"tpl-data-table aj-env-students-table\">"
      + "<thead><tr><th>م</th><th>الاسم</th><th>الصف</th><th>الفصل</th></tr></thead>"
      + "<tbody>" + body + "</tbody></table></div></section>";
  }

  function injectStudentsTable(html, rows, title) {
    var block = tableHtml(rows, title);
    if (!block) {
      return html;
    }
    var marker = 'class="doc-signoff-block"';
    var idx = String(html || "").lastIndexOf(marker);
    if (idx < 0) {
      return html + block;
    }
    var open = html.lastIndexOf("<", idx);
    if (open < 0) {
      return html + block;
    }
    return html.slice(0, open) + block + html.slice(open);
  }

  function paintBanner() {
    var box = document.getElementById("aj-program-list-banner");
    if (!box) {
      return;
    }
    var templateEl = document.getElementById("aj-program-template");
    var nameEl = document.getElementById("aj-program-name");
    var templateKey = templateEl ? templateEl.value : "";
    var name = nameEl ? nameEl.value : "";
    var kind = kindForProgram(name, templateKey);
    if (!kind) {
      box.hidden = true;
      box.textContent = "";
      box.classList.remove("is-ready", "is-warn");
      return;
    }
    var ready = cache
      ? Promise.resolve(cache)
      : jsonFetch("/api/session/students-support", { headers: authHeaders(), cache: "no-store" })
        .then(function (payload) {
          cache = payload;
          return payload;
        });
    ready.then(function () {
      var pack = packOf(kind);
      var label = kind === "gifted" ? "الموهوبين" : "المتدني";
      box.hidden = false;
      if (pack && pack.is_approved) {
        box.classList.add("is-ready");
        box.classList.remove("is-warn");
        box.innerHTML = "هذا البرنامج يعتمد على قائمة " + label
          + ". القائمة معتمدة (" + pack.approved_count + " طالباً) — جاهزة."
          + (pack.approved_by ? " اعتماد: " + escapeHtml(pack.approved_by) + "." : "");
      } else {
        box.classList.add("is-warn");
        box.classList.remove("is-ready");
        box.innerHTML = "هذا البرنامج يعتمد على قائمة " + label
          + ". تحتاج إلى اعتماد القائمة أولاً (<a href=\"#view-students-lists\">الإعدادات ← قوائم الطلاب</a>).";
      }
    }).catch(function () {
      box.hidden = false;
      box.classList.add("is-warn");
      box.classList.remove("is-ready");
      box.textContent = "تعذر قراءة حالة قائمة الطلاب.";
    });
  }

  function renderPanel(kind) {
    var pack = packOf(kind);
    var summary = document.getElementById("aj-sl-" + kind + "-summary");
    var host = document.getElementById("aj-sl-" + kind + "-table");
    if (!pack || !host) {
      return;
    }
    if (summary) {
      if (!pack.count) {
        summary.textContent = "لا أسماء مودعة. أضف يدوياً أو استورد CSV (اسم، صف، فصل).";
      } else if (pack.is_approved) {
        summary.textContent = "معتمدة · " + pack.approved_count + " طالباً"
          + (pack.approved_by ? " · " + pack.approved_by : "");
      } else {
        summary.textContent = "مسودة: " + pack.draft_count + " · معتمد: " + pack.approved_count
          + " · الإجمالي " + pack.count + " — بانتظار اعتماد المدير.";
      }
    }
    var panel = document.querySelector("[data-sl-category=\"" + kind + "\"]");
    if (panel) {
      var addBtn = panel.querySelector("[data-sl-add]");
      var importLbl = panel.querySelector(".aj-sl-import");
      var approveBtn = panel.querySelector("[data-sl-approve]");
      var unapproveBtn = panel.querySelector("[data-sl-unapprove]");
      var locked = !!pack.is_approved;
      if (addBtn) {
        addBtn.hidden = locked;
      }
      if (importLbl) {
        importLbl.hidden = locked;
      }
      if (approveBtn) {
        approveBtn.hidden = locked || !isPrincipal();
      }
      if (unapproveBtn) {
        unapproveBtn.hidden = !locked || !isPrincipal();
      }
    }
    if (!pack.items.length) {
      host.innerHTML = "<p class=\"aj-empty\">لا صفوف في هذه القائمة.</p>";
      return;
    }
    var body = pack.items.map(function (item) {
      var badge = item.status === "approved"
        ? "<span class=\"aj-sl-badge\">معتمد</span>"
        : "<span class=\"aj-sl-badge is-draft\">مسودة</span>";
      var actions = pack.is_approved
        ? ""
        : "<button type=\"button\" class=\"aj-link-btn\" data-sl-edit=\"" + item.id + "\">تعديل</button> "
          + "<button type=\"button\" class=\"aj-link-btn\" data-sl-del=\"" + item.id + "\">حذف</button>";
      return "<tr><td>" + escapeHtml(item.student_name) + "</td><td>"
        + escapeHtml(item.grade) + "</td><td>" + escapeHtml(item.section) + "</td><td>"
        + badge + "</td><td>" + actions + "</td></tr>";
    }).join("");
    host.innerHTML = "<table class=\"aj-env-students-table\"><thead><tr>"
      + "<th>الاسم</th><th>الصف</th><th>الفصل</th><th>الحالة</th><th></th>"
      + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function baseLabel(student) {
    var place = [student.grade, student.classroom].filter(Boolean).join(" ");
    return place ? student.name + " - " + place : student.name;
  }

  function paintDirectory(students) {
    var counts = {};
    (students || []).forEach(function (student) {
      var base = baseLabel(student);
      counts[base] = (counts[base] || 0) + 1;
    });
    directory = (students || []).map(function (student) {
      var base = baseLabel(student);
      return {
        national_id: student.national_id,
        name: student.name,
        grade: student.grade || "",
        classroom: student.classroom || "",
        label: counts[base] > 1 ? base + " (" + student.national_id + ")" : base
      };
    });
    var list = document.getElementById("aj-sl-students");
    if (!list) {
      return;
    }
    list.innerHTML = directory.map(function (student) {
      return "<option value=\"" + escapeHtml(student.label) + "\"></option>";
    }).join("");
  }

  function loadDirectory() {
    if (directory) {
      return Promise.resolve(directory);
    }
    return jsonFetch("/api/session/noor-students", {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (payload) {
      paintDirectory(payload.students || []);
      return directory;
    });
  }

  function findStudent(value) {
    var text = String(value || "").trim();
    if (!text || !directory) {
      return null;
    }
    var index;
    for (index = 0; index < directory.length; index += 1) {
      if (directory[index].label === text || directory[index].national_id === text) {
        return directory[index];
      }
    }
    return null;
  }

  function applyPickedStudent() {
    var nameEl = document.getElementById("aj-sl-name");
    var gradeEl = document.getElementById("aj-sl-grade");
    var sectionEl = document.getElementById("aj-sl-section");
    var nidEl = document.getElementById("aj-sl-nid");
    if (!nameEl || !gradeEl || !sectionEl || !nidEl) {
      return;
    }
    var match = findStudent(nameEl.value);
    if (!match) {
      nidEl.value = "";
      gradeEl.value = "";
      sectionEl.value = "";
      return;
    }
    nidEl.value = match.national_id;
    gradeEl.value = match.grade;
    sectionEl.value = match.classroom;
  }

  function showForm(kind, item) {
    var form = document.getElementById("aj-sl-form");
    var back = document.getElementById("aj-sl-back-row");
    if (!form) {
      return;
    }
    form.hidden = false;
    if (back) {
      back.hidden = true;
    }
    document.getElementById("aj-sl-id").value = item && item.id ? String(item.id) : "";
    document.getElementById("aj-sl-category").value = kind;
    document.getElementById("aj-sl-nid").value = item && item.national_id ? item.national_id : "";
    document.getElementById("aj-sl-name").value = item ? item.student_name : "";
    document.getElementById("aj-sl-grade").value = item ? item.grade : "";
    document.getElementById("aj-sl-section").value = item ? item.section : "";
    loadDirectory().then(function () {
      var match = null;
      if (item && item.national_id) {
        match = findStudent(item.national_id);
      }
      if (!match && item) {
        match = (directory || []).filter(function (student) {
          return student.name === item.student_name
            && student.grade === (item.grade || "")
            && student.classroom === (item.section || "");
        })[0] || null;
      }
      if (match) {
        document.getElementById("aj-sl-name").value = match.label;
        document.getElementById("aj-sl-nid").value = match.national_id;
        document.getElementById("aj-sl-grade").value = match.grade;
        document.getElementById("aj-sl-section").value = match.classroom;
      }
    }).catch(function () {
      setStatus("تعذر تحميل أسماء الطلاب.", true);
    });
    document.getElementById("aj-sl-name").focus();
  }

  function hideForm() {
    var form = document.getElementById("aj-sl-form");
    var back = document.getElementById("aj-sl-back-row");
    if (form) {
      form.hidden = true;
      form.reset();
    }
    if (back) {
      back.hidden = false;
    }
  }

  function findItem(id) {
    var needle = Number(id);
    var found = null;
    ["gifted", "struggling"].forEach(function (kind) {
      var pack = packOf(kind);
      (pack && pack.items || []).forEach(function (item) {
        if (Number(item.id) === needle) {
          found = item;
        }
      });
    });
    return found;
  }

  function load() {
    setStatus("جارٍ التحميل...");
    return Promise.all([
      jsonFetch("/api/session/students-support", {
        headers: authHeaders(),
        cache: "no-store"
      }),
      loadDirectory().catch(function () {
        return [];
      })
    ]).then(function (parts) {
      var payload = parts[0];
      cache = payload;
      renderPanel("gifted");
      renderPanel("struggling");
      setStatus("العام " + (payload.academic_year || "") + ".");
      paintBanner();
      return payload;
    }).catch(function (error) {
      setStatus((error && error.message) || "تعذر تحميل القوائم.", true);
    });
  }

  function saveStudent(event) {
    event.preventDefault();
    var rowId = String(document.getElementById("aj-sl-id").value || "").trim();
    applyPickedStudent();
    var nationalId = String(document.getElementById("aj-sl-nid").value || "").trim();
    if (!nationalId) {
      setStatus("اختر طالباً من القائمة.", true);
      return;
    }
    var body = {
      national_id: nationalId,
      student_name: document.getElementById("aj-sl-name").value,
      grade: document.getElementById("aj-sl-grade").value,
      section: document.getElementById("aj-sl-section").value,
      category: document.getElementById("aj-sl-category").value
    };
    var url = "/api/session/students-support";
    var method = "POST";
    if (rowId) {
      url += "/" + encodeURIComponent(rowId);
      method = "PUT";
    }
    jsonFetch(url, {
      method: method,
      headers: jsonHeaders(),
      body: JSON.stringify(body)
    }).then(function () {
      hideForm();
      setStatus("حُفظ الصف مسودة.");
      return load();
    }).catch(function (error) {
      setStatus((error && error.message) || "تعذر الحفظ.", true);
    });
  }

  function approve(kind) {
    if (!isPrincipal()) {
      setStatus("اعتماد القائمة للمدير فقط.", true);
      return;
    }
    jsonFetch("/api/session/students-support/approve", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ category: kind })
    }).then(function (payload) {
      setStatus("اعتُمدت قائمة " + ((payload.list && payload.list.label) || "") + ".");
      return load();
    }).catch(function (error) {
      setStatus((error && error.message) || "تعذر الاعتماد.", true);
    });
  }

  function unapprove(kind) {
    if (!isPrincipal()) {
      setStatus("إلغاء الاعتماد للمدير فقط.", true);
      return;
    }
    jsonFetch("/api/session/students-support/unapprove", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ category: kind })
    }).then(function (payload) {
      setStatus("أُلغي اعتماد قائمة " + ((payload.list && payload.list.label) || "") + ".");
      return load();
    }).catch(function (error) {
      setStatus((error && error.message) || "تعذر إلغاء الاعتماد.", true);
    });
  }

  function importFile(kind, file) {
    if (!file) {
      return;
    }
    var form = new FormData();
    form.append("category", kind);
    form.append("file", file, file.name);
    fetch("/api/session/students-support/import", {
      method: "POST",
      headers: authHeaders(),
      body: form
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error(apiError(body, "تعذر الاستيراد."));
        }
        return body;
      });
    }).then(function (payload) {
      setStatus("استُورد " + (payload.imported || 0) + " صفاً كمسودة.");
      return load();
    }).catch(function (error) {
      setStatus((error && error.message) || "تعذر الاستيراد.", true);
    });
  }

  function onClick(event) {
    var add = event.target.closest("[data-sl-add]");
    if (add) {
      showForm(add.getAttribute("data-sl-add"), null);
      return;
    }
    var printBtn = event.target.closest("[data-sl-print]");
    if (printBtn) {
      var kind = printBtn.getAttribute("data-sl-print");
      var pack = packOf(kind);
      var rows = ((pack && pack.items) || []).map(function (item) {
        return {
          name: item.student_name || "",
          grade: item.grade || "",
          section: item.section || ""
        };
      });
      var title = (pack && pack.label ? pack.label : "قائمة الطلاب") + " - " + (cache && cache.academic_year ? cache.academic_year : "");
      if (window.AjStudentRegistry && typeof window.AjStudentRegistry.printRows === "function") {
        window.AjStudentRegistry.printRows(title, rows);
      }
      return;
    }
    var approveBtn = event.target.closest("[data-sl-approve]");
    if (approveBtn) {
      approve(approveBtn.getAttribute("data-sl-approve"));
      return;
    }
    var unapproveBtn = event.target.closest("[data-sl-unapprove]");
    if (unapproveBtn) {
      unapprove(unapproveBtn.getAttribute("data-sl-unapprove"));
      return;
    }
    var edit = event.target.closest("[data-sl-edit]");
    if (edit) {
      var item = findItem(edit.getAttribute("data-sl-edit"));
      if (item && item.status === "approved") {
        setStatus("القائمة معتمدة. ألغِ الاعتماد أولاً.", true);
        return;
      }
      if (item) {
        showForm(item.category, item);
      }
      return;
    }
    var del = event.target.closest("[data-sl-del]");
    if (del) {
      var id = del.getAttribute("data-sl-del");
      jsonFetch("/api/session/students-support/" + encodeURIComponent(id), {
        method: "DELETE",
        headers: authHeaders()
      }).then(function () {
        setStatus("حُذف الصف من قائمة الدعم.");
        return load();
      }).catch(function (error) {
        setStatus((error && error.message) || "تعذر الحذف.", true);
      });
    }
  }

  function bind() {
    var view = document.getElementById("view-students-lists");
    if (view) {
      view.addEventListener("click", onClick);
    }
    var form = document.getElementById("aj-sl-form");
    if (form) {
      form.addEventListener("submit", saveStudent);
    }
    var nameInput = document.getElementById("aj-sl-name");
    if (nameInput) {
      nameInput.addEventListener("input", applyPickedStudent);
      nameInput.addEventListener("change", applyPickedStudent);
    }
    var cancel = document.getElementById("aj-sl-cancel");
    if (cancel) {
      cancel.addEventListener("click", hideForm);
    }
    Array.prototype.forEach.call(document.querySelectorAll("[data-sl-import]"), function (input) {
      input.addEventListener("change", function () {
        var kind = input.getAttribute("data-sl-import");
        var file = input.files && input.files[0];
        importFile(kind, file);
        input.value = "";
      });
    });
    var templateEl = document.getElementById("aj-program-template");
    if (templateEl) {
      templateEl.addEventListener("change", paintBanner);
    }
    var nameEl = document.getElementById("aj-program-name");
    if (nameEl) {
      nameEl.addEventListener("input", paintBanner);
    }
  }

  bind();

  window.AjStudentsLists = {
    load: load,
    paintBanner: paintBanner,
    kindForProgram: kindForProgram,
    approvedRows: approvedRows,
    tableHtml: tableHtml,
    injectStudentsTable: injectStudentsTable,
    fetchLists: function () {
      return jsonFetch("/api/session/students-support", {
        headers: authHeaders(),
        cache: "no-store"
      }).then(function (payload) {
        cache = payload;
        return payload;
      });
    }
  };
})();
