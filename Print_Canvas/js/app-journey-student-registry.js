/* سجل طلاب المدرسة — عرض وفلترة وطباعة رسمية */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var cache = { year: "", students: [] };
  var filtered = [];

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

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(text, isError) {
    var node = document.getElementById("aj-sr-status");
    if (!node) {
      return;
    }
    node.textContent = text || "";
    node.classList.toggle("is-error", !!isError);
  }

  function unique(values) {
    var seen = {};
    var out = [];
    values.forEach(function (value) {
      var text = String(value || "").trim();
      if (!text || seen[text]) {
        return;
      }
      seen[text] = true;
      out.push(text);
    });
    out.sort(function (a, b) {
      return a.localeCompare(b, "ar");
    });
    return out;
  }

  function fillSelect(id, values, label) {
    var select = document.getElementById(id);
    if (!select) {
      return;
    }
    var current = select.value;
    select.innerHTML = "";
    var all = document.createElement("option");
    all.value = "";
    all.textContent = label;
    select.appendChild(all);
    values.forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    if (current) {
      select.value = current;
    }
  }

  function applyFilters() {
    var grade = document.getElementById("aj-sr-grade");
    var section = document.getElementById("aj-sr-section");
    var q = document.getElementById("aj-sr-q");
    var gradeVal = grade ? String(grade.value || "").trim() : "";
    var sectionVal = section ? String(section.value || "").trim() : "";
    var query = q ? String(q.value || "").trim() : "";
    filtered = (cache.students || []).filter(function (row) {
      if (gradeVal && String(row.grade || "") !== gradeVal) {
        return false;
      }
      if (sectionVal && String(row.section || "") !== sectionVal) {
        return false;
      }
      if (query && String(row.name || "").indexOf(query) === -1) {
        return false;
      }
      return true;
    });
    var host = document.getElementById("aj-sr-table");
    if (!host) {
      return;
    }
    if (!filtered.length) {
      host.innerHTML = "<p class=\"aj-empty\">لا طلاب وفق التصفية.</p>";
      return;
    }
    var body = filtered.map(function (row) {
      return "<tr><td>" + escapeHtml(row.name) + "</td><td>" + escapeHtml(row.grade)
        + "</td><td>" + escapeHtml(row.section) + "</td><td>" + escapeHtml(row.status || "")
        + "</td></tr>";
    }).join("");
    host.innerHTML = "<table class=\"aj-env-students-table\"><thead><tr>"
      + "<th>الاسم</th><th>الصف</th><th>الفصل</th><th>الحالة</th>"
      + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function printRows(title, rows) {
    if (!window.PrintTemplates || typeof window.PrintTemplates.renderTable !== "function") {
      setStatus("قالب الطباعة غير محمّل.", true);
      return;
    }
    var school = document.getElementById("aj-school-name");
    var gradeNode = document.getElementById("aj-sr-grade");
    var sectionNode = document.getElementById("aj-sr-section");
    function chosen(node) {
      var value = node ? String(node.value || "").trim() : "";
      if (!value || value.indexOf("كل") === 0) {
        return "";
      }
      return value;
    }
    var grade = chosen(gradeNode);
    var section = chosen(sectionNode);
    var listData = {
      title: title,
      kind: "students",
      grade: grade,
      section: section,
      columns: ["الاسم", "الصف", "الفصل"],
      rows: rows.map(function (row) {
        return [row.name || row.student_name || "", row.grade || "", row.section || ""];
      }),
      students: rows,
      school: school ? String(school.textContent || "").trim() : "",
      serial: true,
      signoff: true
    };
    function show(html) {
      if (window.AJPrint && typeof window.AJPrint.show === "function") {
        window.AJPrint.show(html, {
          pdfTitle: title,
          file: { kind: "students", grade: listData.grade, section: listData.section },
          arm: { multiPage: true, list: true }
        });
      }
    }
    function fallback() {
      show(window.PrintTemplates.renderTable({
        title: title,
        columns: listData.columns,
        rows: listData.rows,
        school: listData.school,
        signoff: true,
        signoffColumns: [{ role: "مدير المدرسة", name: "" }]
      }));
    }
    function accept(result) {
      var html = window.PrintCore && typeof window.PrintCore.htmlOf === "function"
        ? window.PrintCore.htmlOf(result)
        : (result && result.html ? result.html : result);
      var warnings = window.PrintCore && typeof window.PrintCore.warningsOf === "function"
        ? window.PrintCore.warningsOf(result)
        : (result && result.warnings) || [];
      if (window.PrintCore && typeof window.PrintCore.allowAfterWarning === "function") {
        if (!window.PrintCore.allowAfterWarning(warnings)) {
          return;
        }
      }
      if (html) {
        show(html);
        return;
      }
      fallback();
    }
    var core = window.PrintCore;
    if (!core || typeof core.generate !== "function") {
      var gaps = window.DeficiencyCore && typeof window.DeficiencyCore.check === "function"
        ? window.DeficiencyCore.check("students-list", listData)
        : [];
      if (window.PrintCore && typeof window.PrintCore.allowAfterWarning === "function") {
        if (!window.PrintCore.allowAfterWarning(gaps)) {
          return;
        }
      } else if (gaps.length && !window.confirm(
        "تنبيه: هذه الوثيقة تحتوي على نواقص " + gaps.join("، ") + ". هل تريد الطباعة على أي حال؟"
      )) {
        return;
      }
      fallback();
      return;
    }
    var generated = core.generate({
      title: title,
      type: "students-list",
      docType: "students-list",
      data: listData,
      orientation: "portrait"
    });
    if (generated && typeof generated.then === "function") {
      generated.then(accept).catch(fallback);
      return;
    }
    if (generated) {
      accept(generated);
      return;
    }
    fallback();
  }

  function load() {
    setStatus("جارٍ التحميل...");
    return fetch("/api/session/student-registry", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error((body && body.detail) || "تعذر قراءة سجل الطلاب.");
          }
          return body;
        });
      })
      .then(function (payload) {
        cache = payload || { students: [] };
        fillSelect("aj-sr-grade", unique((cache.students || []).map(function (row) { return row.grade; })), "كل الصفوف");
        fillSelect("aj-sr-section", unique((cache.students || []).map(function (row) { return row.section; })), "كل الفصول");
        applyFilters();
        setStatus("عدد الطلاب " + (cache.count || 0) + " · العام " + (cache.year || "") + ".");
      })
      .catch(function (error) {
        setStatus((error && error.message) || "تعذر قراءة سجل الطلاب.", true);
      });
  }

  function bind() {
    ["aj-sr-grade", "aj-sr-section", "aj-sr-q"].forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) {
        return;
      }
      node.addEventListener(id === "aj-sr-q" ? "input" : "change", applyFilters);
    });
    var printBtn = document.getElementById("aj-sr-print");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        printRows("قائمة طلاب المدرسة - " + (cache.year || ""), filtered);
      });
    }
  }

  bind();

  window.AjStudentRegistry = {
    load: load,
    printRows: printRows
  };
})();
