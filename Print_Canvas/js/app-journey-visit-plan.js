/* الخطة السنوية للزيارات الصفية. صف لكل معلم، بلا عدد مفروض. */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var state = { items: [], visitors: [], weeks: { "1": 0, "2": 0 } };

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
    }, 3200);
  }

  function subjectOf(value) {
    var text = String(value || "").replace(/\s+/g, "");
    if (!text) {
      return "";
    }
    if (text.indexOf("أحي") !== -1 || text.indexOf("احي") !== -1 || text.indexOf("فيز") !== -1 || text.indexOf("كيم") !== -1 || text.indexOf("علوم") !== -1) {
      return "العلوم";
    }
    return String(value || "").trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function dateLabel(iso) {
    if (!iso || !window.AjDates) {
      return "";
    }
    var hijri = window.AjDates.hijri(iso);
    var gregorian = window.AjDates.gregorian(iso);
    if (hijri && gregorian) {
      return hijri + " — " + gregorian;
    }
    return hijri || gregorian || "";
  }

  function visitorOptions(selected) {
    var html = "<option value=\"\"></option>";
    state.visitors.forEach(function (person) {
      var label = person.role && person.name ? person.role + " — " + person.name : (person.name || person.role || "");
      html += "<option value=\"" + escapeHtml(person.id) + "\"" + (person.id === selected ? " selected" : "") + ">"
        + escapeHtml(label) + "</option>";
    });
    return html;
  }

  function periodOptions(selected) {
    var html = "<option value=\"\"></option>";
    var number;
    for (number = 1; number <= 7; number += 1) {
      var value = String(number);
      html += "<option value=\"" + value + "\"" + (value === String(selected || "") ? " selected" : "") + ">" + value + "</option>";
    }
    return html;
  }

  function visitCell(prefix, item) {
    var iso = item[prefix + "_date"] || "";
    return "<div class=\"aj-plan-visit\">"
      + "<span class=\"aj-visit-dates\"><input type=\"date\" data-field=\"" + prefix + "_date\" value=\"" + escapeHtml(iso) + "\">"
      + "<span class=\"aj-plan-hijri\">" + escapeHtml(dateLabel(iso)) + "</span></span>"
      + "<select data-field=\"" + prefix + "_period\">" + periodOptions(item[prefix + "_period"]) + "</select>"
      + "<select data-field=\"" + prefix + "_visitor\">" + visitorOptions(item[prefix + "_visitor"]) + "</select>"
      + "</div>";
  }

  function paint() {
    var body = document.getElementById("aj-plan-body");
    var status = document.getElementById("aj-plan-status");
    if (!body) {
      return;
    }
    body.innerHTML = state.items.map(function (item, index) {
      return "<tr data-teacher=\"" + escapeHtml(item.teacher_id) + "\">"
        + "<td>" + (index + 1) + "</td>"
        + "<td>" + escapeHtml(item.teacher_name || "") + "</td>"
        + "<td><input data-field=\"specialization\" type=\"text\" value=\"" + escapeHtml(item.specialization || "") + "\"></td>"
        + "<td><input data-field=\"subject\" type=\"text\" value=\"" + escapeHtml(subjectOf(item.subject) || "") + "\"></td>"
        + "<td>" + visitCell("visit_1", item) + "</td>"
        + "<td>" + visitCell("visit_2", item) + "</td>"
        + "<td>" + visitCell("visit_3", item) + "</td>"
        + "<td><textarea data-field=\"notes\" rows=\"2\">" + escapeHtml(item.notes || "") + "</textarea></td>"
        + "</tr>";
    }).join("");
    if (status) {
      var weeks = (state.weeks["1"] || 0) + (state.weeks["2"] || 0);
      status.textContent = "المعلمون في السجل: " + state.items.length
        + (weeks ? "، وأسابيع التقويم المحفوظة: " + weeks + "." : "، ولا أسابيع محفوظة في التقويم.");
    }
  }

  function readRows() {
    var body = document.getElementById("aj-plan-body");
    if (!body) {
      return [];
    }
    return Array.prototype.map.call(body.querySelectorAll("tr[data-teacher]"), function (row) {
      var item = { teacher_id: row.getAttribute("data-teacher") };
      row.querySelectorAll("[data-field]").forEach(function (field) {
        item[field.getAttribute("data-field")] = field.value.trim();
      });
      return item;
    });
  }

  function load() {
    return fetch("/api/session/visit-plans", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("تعذر فتح الخطة");
      }
      return response.json();
    }).then(function (pack) {
      state.items = pack.items || [];
      state.visitors = pack.visitors || [];
      state.weeks = pack.weeks || { "1": 0, "2": 0 };
      paint();
    }).catch(function (error) {
      toast(error.message || "تعذر فتح الخطة", "error");
    });
  }

  function save() {
    return fetch("/api/session/visit-plans", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ items: readRows() })
    }).then(function (response) {
      if (!response.ok) {
        return response.json().then(function (body) {
          throw new Error(body.detail || "تعذر الحفظ");
        });
      }
      toast("حُفظت الخطة.", "success");
      return load();
    }).catch(function (error) {
      toast(error.message || "تعذر الحفظ", "error");
    });
  }

  function distribute() {
    fetch("/api/session/visit-plans/distribute", {
      method: "POST",
      headers: authHeaders()
    }).then(function (response) {
      if (!response.ok) {
        return response.json().then(function (body) {
          throw new Error(body.detail || "تعذر التوزيع");
        });
      }
      return response.json();
    }).then(function (pack) {
      state.items = pack.items || [];
      state.visitors = pack.visitors || [];
      state.weeks = pack.weeks || { "1": 0, "2": 0 };
      paint();
      var weeks = (state.weeks["1"] || 0) + (state.weeks["2"] || 0);
      toast(weeks
        ? "وُزّعت الزيارتان على أسابيع التقويم المحفوظة."
        : "وُزّع المعلمون والمنفّذون. لا أسابيع محفوظة في التقويم، فبقيت التواريخ فارغة.",
      weeks ? "success" : "error");
    }).catch(function (error) {
      toast(error.message || "تعذر التوزيع", "error");
    });
  }

  function visitorName(id) {
    var found = "";
    state.visitors.forEach(function (person) {
      if (person.id === id) {
        found = [person.role, person.name].filter(Boolean).join(" — ");
      }
    });
    return found;
  }

  function printPlan() {
    var master = window.PrintMasterCore;
    if (!master || typeof master.sheet !== "function" || !window.AJPrint) {
      toast("نواة الطباعة غير محمّلة.", "error");
      return;
    }
    var rows = readRows();
    var names = {};
    state.items.forEach(function (item) {
      names[item.teacher_id] = item.teacher_name || "";
    });
    var ids = state.visitors.map(function (person) {
      return person.id;
    });
    fetch("/api/session/signatures?ids=" + encodeURIComponent(ids.join(",")), {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (response) {
      return response.ok ? response.json() : { signatures: {} };
    }).catch(function () {
      return { signatures: {} };
    }).then(function (payload) {
      var signs = payload.signatures || {};
      function cell(item, prefix) {
        var parts = [dateLabel(item[prefix + "_date"]), item[prefix + "_period"] ? "الحصة " + item[prefix + "_period"] : "", visitorName(item[prefix + "_visitor"])];
        return escapeHtml(parts.filter(Boolean).join(" · "));
      }
      var body = "<p class=\"tpl-p\">نموذج رقم (م.م.ع.ن-20-24). لا تقل الزيارات عن زيارتين لكل معلم في السنة الدراسية.</p>"
        + "<table style=\"width:100%;border-collapse:collapse;table-layout:fixed;\">"
        + "<thead><tr>"
        + "<th style=\"width:4%;border:1px solid #0b5e56;font-size:9px;padding:0.6mm;\">م</th>"
        + "<th style=\"width:16%;border:1px solid #0b5e56;font-size:9px;padding:0.6mm;\">اسم المعلم</th>"
        + "<th style=\"width:9%;border:1px solid #0b5e56;font-size:9px;padding:0.6mm;\">التخصص</th>"
        + "<th style=\"width:9%;border:1px solid #0b5e56;font-size:9px;padding:0.6mm;\">المادة</th>"
        + "<th style=\"width:18%;border:1px solid #0b5e56;font-size:9px;padding:0.6mm;\">الزيارة الأولى</th>"
        + "<th style=\"width:18%;border:1px solid #0b5e56;font-size:9px;padding:0.6mm;\">الزيارة الثانية</th>"
        + "<th style=\"width:14%;border:1px solid #0b5e56;font-size:9px;padding:0.6mm;\">زيارة إضافية</th>"
        + "<th style=\"width:12%;border:1px solid #0b5e56;font-size:9px;padding:0.6mm;\">ملحوظات</th>"
        + "</tr></thead><tbody>"
        + rows.map(function (item, index) {
          return "<tr>"
            + "<td style=\"border:1px solid #9db8b2;font-size:9px;padding:0.5mm;text-align:center;\">" + (index + 1) + "</td>"
            + "<td style=\"border:1px solid #9db8b2;font-size:9px;padding:0.5mm;\">" + escapeHtml(names[item.teacher_id] || "") + "</td>"
            + "<td style=\"border:1px solid #9db8b2;font-size:9px;padding:0.5mm;\">" + escapeHtml(item.specialization || "") + "</td>"
            + "<td style=\"border:1px solid #9db8b2;font-size:9px;padding:0.5mm;\">" + escapeHtml(subjectOf(item.subject) || "") + "</td>"
            + "<td style=\"border:1px solid #9db8b2;font-size:9px;padding:0.5mm;\">" + cell(item, "visit_1") + "</td>"
            + "<td style=\"border:1px solid #9db8b2;font-size:9px;padding:0.5mm;\">" + cell(item, "visit_2") + "</td>"
            + "<td style=\"border:1px solid #9db8b2;font-size:9px;padding:0.5mm;\">" + cell(item, "visit_3") + "</td>"
            + "<td style=\"border:1px solid #9db8b2;font-size:9px;padding:0.5mm;\">" + escapeHtml(item.notes || "") + "</td>"
            + "</tr>";
        }).join("")
        + "</tbody></table>"
        + "<p class=\"tpl-p\">منفذ الزيارة: قائد المدرسة أو وكيل الشؤون التعليمية.</p>";
      var columns = state.visitors.map(function (person) {
        return {
          roleTitle: person.role,
          name: person.name || "",
          signature: signs[person.id] || ""
        };
      });
      var html = master.sheet({
        strictIdentity: true,
        orientation: "landscape",
        title: "خطة الزيارات الصفية السنوية للمعلمين",
        bodyHtml: body,
        signoff: true,
        columns: columns,
        kind: "document",
        fileName: "خطة الزيارات الصفية السنوية"
      });
      window.AJPrint.show(html, {
        pdfTitle: "خطة الزيارات الصفية السنوية",
        arm: { orientation: "landscape", multiPage: true }
      });
    });
  }

  function bind() {
    var table = document.getElementById("aj-plan-table");
    var distributeButton = document.getElementById("aj-plan-distribute");
    var saveButton = document.getElementById("aj-plan-save");
    var printButton = document.getElementById("aj-plan-print");
    if (!table || table.dataset.bound === "1") {
      return;
    }
    table.dataset.bound = "1";
    table.addEventListener("change", function (event) {
      if (event.target.getAttribute("data-field") && event.target.getAttribute("data-field").slice(-5) === "_date") {
        var label = event.target.parentNode.querySelector(".aj-plan-hijri");
        if (label) {
          label.textContent = dateLabel(event.target.value);
        }
      }
    });
    if (distributeButton) {
      distributeButton.addEventListener("click", distribute);
    }
    if (saveButton) {
      saveButton.addEventListener("click", save);
    }
    if (printButton) {
      printButton.addEventListener("click", printPlan);
    }
  }

  bind();
  window.AjVisitPlan = { load: load };
})();
