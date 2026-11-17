/* سجلات المؤشرات الأربعة داخل شواهد الممارسات. التعبئة من الواجهة، والتعديل للالتزام، والتسكين لملف الطباعة. */
(function () {
  "use strict";

  var CODES = ["1-2-1-2", "1-3-1-1", "1-4-1-1", "1-4-1-2"];
  var MARKS = [["", ""], ["ملتزم", "ملتزم"], ["ملاحظة", "ملاحظة"]];

  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem("sessionUser") || "null");
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

  function tableHtml(block) {
    var head = (block.headers || []).map(function (cell) {
      return "<th>" + escapeHtml(cell) + "</th>";
    }).join("");
    var body = (block.rows || []).map(function (row) {
      return "<tr>" + row.map(function (cell) {
        return "<td>" + escapeHtml(cell) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return "<h2 class=\"aj-detail-label\">" + escapeHtml(block.title) + "</h2>"
      + "<div class=\"aj-plan-wrap\"><table class=\"aj-formation-table\"><thead><tr>"
      + head + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function marksHtml(marks) {
    if (!marks) {
      return "";
    }
    var head = "<th>الاسم</th><th>العمل</th>" + marks.days.map(function (day) {
      return "<th>" + escapeHtml(day.label) + "</th>";
    }).join("");
    var body = marks.people.map(function (person) {
      var cells = marks.days.map(function (day) {
        var current = person.marks[day.iso] || "";
        var options = MARKS.map(function (pair) {
          return "<option value=\"" + escapeHtml(pair[0]) + "\"" + (pair[0] === current ? " selected" : "") + ">"
            + escapeHtml(pair[1]) + "</option>";
        }).join("");
        return "<td><select data-mark-id=\"" + escapeHtml(person.national_id) + "\" data-mark-day=\""
          + escapeHtml(day.iso) + "\">" + options + "</select></td>";
      }).join("");
      return "<tr><td>" + escapeHtml(person.name) + "</td><td>" + escapeHtml(person.role) + "</td>" + cells + "</tr>";
    }).join("");
    return "<h2 class=\"aj-detail-label\">سجل الالتزام للأسبوع الأول</h2>"
      + "<p class=\"aj-meta\">التعبئة للأسماء من سجل المنسوبين. خانة الالتزام تبقى فارغة حتى تُختار هنا.</p>"
      + "<div class=\"aj-plan-wrap\"><table class=\"aj-formation-table\"><thead><tr>" + head
      + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function render(box, dossier) {
    var links = (dossier.links || []).map(function (link) {
      return "<a class=\"aj-detail-btn aj-detail-btn-secondary\" href=\"" + escapeHtml(link.href) + "\">"
        + escapeHtml(link.label) + "</a>";
    }).join("");
    var tables = (dossier.tables || []).map(tableHtml).join("");
    box.innerHTML = "<p class=\"aj-meta\">" + escapeHtml(dossier.indicator)
      + " · العام " + escapeHtml(dossier.year)
      + " · الرقم الإحصائي " + escapeHtml(dossier.statistical_number) + "</p>"
      + tables
      + marksHtml(dossier.marks)
      + "<div class=\"aj-detail-actions\">"
      + "<button type=\"button\" class=\"aj-detail-btn\" data-indicator-fill=\"" + escapeHtml(dossier.code) + "\">تعبئة تلقائية</button>"
      + (dossier.marks ? "<button type=\"button\" class=\"aj-detail-btn\" data-indicator-save=\"" + escapeHtml(dossier.code) + "\">حفظ التعديل</button>" : "")
      + "<button type=\"button\" class=\"aj-detail-btn\" data-indicator-assign=\"" + escapeHtml(dossier.code) + "\">تسكين ملف الطباعة</button>"
      + links
      + "</div>";
  }

  function load(code, box) {
    box.textContent = "جارٍ التعبئة من السجلات المحفوظة.";
    fetch("/api/session/indicator-dossiers/" + encodeURIComponent(code), {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error((body && body.detail) || "تعذر قراءة السجل.");
        }
        render(box, body);
      });
    }).catch(function (error) {
      box.textContent = (error && error.message) || "تعذر قراءة السجل.";
    });
  }

  function save(box) {
    var items = [];
    box.querySelectorAll("[data-mark-id]").forEach(function (field) {
      items.push({
        national_id: field.getAttribute("data-mark-id") || "",
        day: field.getAttribute("data-mark-day") || "",
        mark: field.value || ""
      });
    });
    fetch("/api/session/indicator-dossiers/1-2-1-2/marks", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ items: items })
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error((body && body.detail) || "تعذر حفظ التعديل.");
        }
        render(box, body);
        toast("حُفظ تعديل الالتزام.", "success");
      });
    }).catch(function (error) {
      toast((error && error.message) || "تعذر حفظ التعديل.", "error");
    });
  }

  function assign(code) {
    fetch("/api/session/indicator-dossiers/" + encodeURIComponent(code) + "/assign", {
      method: "POST",
      headers: authHeaders()
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error((body && body.detail) || "تعذر تسكين الملف.");
        }
        toast("سُكّن ملف الطباعة في خانته.", "success");
        if (typeof window.AjIndicatorFiles.onAssigned === "function") {
          window.AjIndicatorFiles.onAssigned();
        }
      });
    }).catch(function (error) {
      toast((error && error.message) || "تعذر تسكين الملف.", "error");
    });
  }

  function paint(host) {
    if (!host) {
      return;
    }
    host.querySelectorAll("section.aj-witness-files").forEach(function (section) {
      var title = section.querySelector("h2");
      var code = "";
      CODES.forEach(function (item) {
        if (title && title.textContent.indexOf(item) === 0) {
          code = item;
        }
      });
      if (!code || section.querySelector("[data-indicator-file]")) {
        return;
      }
      var box = document.createElement("div");
      box.className = "aj-indicator-file";
      box.setAttribute("data-indicator-file", code);
      var firstSlot = section.querySelector(".aj-witness-files");
      section.insertBefore(box, firstSlot);
      load(code, box);
    });
  }

  document.addEventListener("click", function (event) {
    var fill = event.target.closest("[data-indicator-fill]");
    var saveButton = event.target.closest("[data-indicator-save]");
    var assignButton = event.target.closest("[data-indicator-assign]");
    if (fill) {
      load(fill.getAttribute("data-indicator-fill"), fill.closest("[data-indicator-file]"));
    } else if (saveButton) {
      save(saveButton.closest("[data-indicator-file]"));
    } else if (assignButton) {
      assign(assignButton.getAttribute("data-indicator-assign"));
    }
  });

  window.AjIndicatorFiles = {
    paint: paint,
    onAssigned: null
  };
}());
