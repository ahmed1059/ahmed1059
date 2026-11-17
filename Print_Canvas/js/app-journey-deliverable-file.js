/* ملف تسليمات المعلم — يقرأ المنسوب وبنك الخطط والتوقيع والإعدادات، ثم يطبع عبر PrintMasterCore. */
(function (root) {
  "use strict";

  function headers() {
    var result = {};
    try {
      var user = JSON.parse(sessionStorage.getItem("sessionUser") || "null");
      if (user && user.token) {
        result["X-Session-Token"] = user.token;
      }
    } catch (error) {
      return result;
    }
    return result;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readJson(url) {
    return fetch(url, { headers: headers(), cache: "no-store" }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error((body && body.detail) || "تعذر قراءة البيانات");
        }
        return body;
      });
    });
  }

  function firstId(value) {
    if (Array.isArray(value)) {
      return String(value[0] || "").trim();
    }
    return String(value || "").trim();
  }

  function setStatus(text, isError) {
    var node = document.getElementById("aj-deliver-auto-status");
    if (!node) {
      return;
    }
    node.textContent = text || "";
    node.className = isError ? "aj-status is-error" : "aj-status";
  }

  function fillTeachers(people) {
    var select = document.getElementById("aj-deliver-auto-teacher");
    if (!select) {
      return;
    }
    var current = select.value;
    select.innerHTML = "";
    var empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "اختر المعلم";
    select.appendChild(empty);
    (people || []).forEach(function (person) {
      if (!person || person.active === false || !person.id || !person.name) {
        return;
      }
      var option = document.createElement("option");
      option.value = String(person.id);
      option.textContent = String(person.name);
      option.setAttribute("data-specialty", String(person.specialty || ""));
      select.appendChild(option);
    });
    if (current) {
      select.value = current;
    }
  }

  function selectedTeacher() {
    var select = document.getElementById("aj-deliver-auto-teacher");
    var option = select && select.selectedOptions ? select.selectedOptions[0] : null;
    if (!select || !select.value || !option) {
      return null;
    }
    return {
      id: select.value,
      name: option.textContent || "",
      specialty: option.getAttribute("data-specialty") || ""
    };
  }

  function syncSubject() {
    var person = selectedTeacher();
    var subject = document.getElementById("aj-deliver-auto-subject");
    if (subject) {
      subject.value = person ? person.specialty : "";
    }
  }

  function chart(items) {
    var row = 22;
    var height = Math.max(row, items.length * row);
    var max = 1;
    items.forEach(function (item) {
      if (item.count > max) {
        max = item.count;
      }
    });
    var marks = items.map(function (item, index) {
      var width = Math.max(2, Math.round((item.count / max) * 360));
      var y = index * row;
      return "<text x=\"0\" y=\"" + (y + 15) + "\" font-size=\"12\" fill=\"#1a1a1a\">" + esc(item.code) + "</text>"
        + "<rect x=\"150\" y=\"" + (y + 4) + "\" width=\"" + width + "\" height=\"12\" fill=\"#0b5e56\"></rect>";
    }).join("");
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 640 " + height + "\" width=\"100%\" height=\"" + Math.min(height, 240) + "\" role=\"img\">"
      + marks + "</svg>";
  }

  function buildDocument(person, subject, year, settings, indicators, seats) {
    var school = (settings && settings.school) || {};
    var engine = root.TemplateEngine;
    var meta = engine && typeof engine.fill === "function"
      ? engine.fill(
        "<table class=\"tpl-data-table\"><tbody>"
          + "<tr><th>الاسم</th><td>{{teacher.name}}</td></tr>"
          + "<tr><th>التخصص</th><td>{{teacher.specialty}}</td></tr>"
          + "<tr><th>المادة</th><td>{{subject}}</td></tr>"
          + "<tr><th>العام الدراسي</th><td>{{year}}</td></tr>"
          + "<tr><th>المدرسة</th><td>{{school.name}}</td></tr>"
          + "<tr><th>الرقم الإحصائي</th><td>{{school.number}}</td></tr>"
          + "</tbody></table>",
        {
          teacher: { name: esc(person.name), specialty: esc(person.specialty) },
          subject: esc(subject),
          year: esc(year),
          school: { name: esc(school.name || ""), number: esc(school.statistical_number || "") }
        }
      )
      : "";
    var rows = indicators.map(function (item) {
      var steps = (item.procedures || []).map(esc).join(" · ");
      return "<tr><td>" + esc(item.code) + "</td><td>" + esc(item.title) + "</td><td>" + steps + "</td></tr>";
    }).join("");
    var plan = rows
      ? "<table class=\"tpl-data-table\"><thead><tr><th>الرمز</th><th>المؤشر</th><th>الإجراءات المحفوظة</th></tr></thead><tbody>" + rows + "</tbody></table>"
      : "<p class=\"tpl-p\">لا مؤشرات محفوظة لهذه المادة في بنك الخطط.</p>";
    var counts = indicators.map(function (item) {
      return { code: item.code, count: (item.procedures || []).length };
    }).filter(function (item) {
      return item.count > 0;
    });
    var evidence = counts.length
      ? "<figure style=\"width:100%;height:42mm;margin:4mm 0;\"><div style=\"width:100%;height:100%;\">" + chart(counts) + "</div></figure>"
      : "<p class=\"tpl-p\">لا إجراءات محفوظة لرسم الشاهد.</p>";
    var fileName = ["تسليمات_المعلم", person.name, subject, year].join("_");
    return root.PrintMasterCore.sheet({
      strictIdentity: true,
      title: "ملف تسليمات المعلم: " + person.name + " - " + subject,
      bodyHtml: meta
        + "<h2 class=\"tpl-section-title\">الخطة الدراسية</h2>" + plan
        + "<h2 class=\"tpl-section-title\">الشواهد</h2>" + evidence,
      columns: (seats || []).map(function (seat) {
        return {
          roleTitle: seat.role || "",
          name: seat.name || "",
          signature: seat.signature || ""
        };
      }),
      signoff: true,
      school: school.name || "",
      fileName: fileName,
      kind: "document",
      frameClass: "tpl-portrait-official"
    });
  }

  function generate(event) {
    event.preventDefault();
    var person = selectedTeacher();
    var subjectNode = document.getElementById("aj-deliver-auto-subject");
    var yearNode = document.getElementById("aj-deliver-auto-year");
    var subject = subjectNode ? String(subjectNode.value || "").trim() : "";
    var year = yearNode ? String(yearNode.value || "").trim() : "";
    if (!person) {
      setStatus("اختر المعلم من سجل المنسوبين.", true);
      return;
    }
    if (!subject) {
      setStatus("لا مادة محفوظة لهذا المعلم.", true);
      return;
    }
    if (!year) {
      setStatus("العام الدراسي مطلوب.", true);
      return;
    }
    if (!root.PrintMasterCore || typeof root.PrintMasterCore.sheet !== "function" || !root.AJPrint) {
      setStatus("نواة الطباعة غير محمّلة.", true);
      return;
    }
    setStatus("جارٍ تجميع البيانات المحفوظة...");
    var planning = root.PlanningCore && typeof root.PlanningCore.load === "function"
      ? root.PlanningCore.load({ headers: headers() })
      : Promise.resolve([]);
    Promise.all([
      readJson("/api/settings"),
      readJson("/api/session/leadership").catch(function () { return {}; }),
      readJson("/api/noor/staff"),
      planning
    ]).then(function (parts) {
      var settings = parts[0] || {};
      var leadership = parts[1] || {};
      var staff = (parts[2] && parts[2].people) || [];
      var managerId = firstId(leadership.manager);
      var managerName = "";
      staff.forEach(function (member) {
        if (member && String(member.id) === managerId && member.name) {
          managerName = String(member.name);
        }
      });
      if (!managerName && settings.committee && settings.committee.chair_name) {
        managerName = String(settings.committee.chair_name);
      }
      var seats = [
        { role: "المعلم", id: person.id, name: person.name },
        { role: "مدير المدرسة", id: managerId, name: managerName }
      ];
      var indicators = root.PlanningCore && typeof root.PlanningCore.search === "function"
        ? root.PlanningCore.search(subject)
        : [];
      var resolve = root.SignatureCore && typeof root.SignatureCore.resolve === "function"
        ? root.SignatureCore.resolve(seats, { headers: headers() })
        : Promise.resolve(seats);
      return resolve.then(function (signed) {
        var html = buildDocument(person, subject, year, settings, indicators, signed || seats);
        root.AJPrint.show(html, {
          pdfTitle: ["تسليمات_المعلم", person.name, subject, year].join("_"),
          arm: { multiPage: true }
        });
        setStatus("");
      });
    }).catch(function (error) {
      setStatus((error && error.message) || "تعذر توليد الوثيقة.", true);
    });
  }

  var filePack = null;
  var fileIndex = 0;

  function leadershipColumns() {
    return Promise.all([
      readJson("/api/session/leadership").catch(function () { return {}; }),
      readJson("/api/noor/staff").catch(function () { return { people: [] }; })
    ]).then(function (parts) {
      var leadership = parts[0] || {};
      var people = (parts[1] && parts[1].people) || [];
      function person(id) {
        var found = "";
        people.forEach(function (member) {
          if (member && String(member.id) === String(id) && member.name) {
            found = String(member.name);
          }
        });
        return found;
      }
      var rows = [
        { role: "education_agents", title: "وكيل الشؤون التعليمية", fallback: "signatures/sig_teachers.png" },
        { role: "student_agents", title: "وكيل شؤون الطلاب", fallback: "signatures/sig_students.png" },
        { role: "manager", title: "مدير المدرسة", fallback: "signatures/sig_manager.png" }
      ];
      return rows.map(function (row) {
        var id = firstId(leadership[row.role]);
        return {
          roleTitle: row.title,
          id: id,
          name: person(id),
          signature: id ? ("signatures/sig_" + id + ".png") : "",
          signatureFallback: row.fallback
        };
      }).filter(function (column) {
        return column.name;
      });
    });
  }

  function paintFile(index) {
    if (!filePack || !filePack.sections || !filePack.sections[index]) {
      return;
    }
    fileIndex = index;
    var section = filePack.sections[index];
    var title = document.getElementById("aj-file-panel-title");
    var body = document.getElementById("aj-file-panel-body");
    var panel = document.getElementById("aj-file-panel");
    if (title) {
      title.textContent = section.title || "";
    }
    if (body) {
      body.innerHTML = String(section.text || "").split("\n").filter(Boolean).map(function (line) {
        return "<p>" + esc(line) + "</p>";
      }).join("");
    }
    if (panel) {
      panel.hidden = false;
    }
    document.querySelectorAll("[data-file-tab]").forEach(function (button) {
      button.setAttribute("aria-selected", button.getAttribute("data-file-tab") === String(index) ? "true" : "false");
    });
  }

  function loadTeacherFiles(id) {
    if (!id) {
      return;
    }
    readJson("/api/session/teacher-deliverables?national_id=" + encodeURIComponent(id)).then(function (pack) {
      filePack = pack;
      var tabs = document.getElementById("aj-file-tabs");
      if (!tabs) {
        return;
      }
      tabs.innerHTML = (pack.sections || []).map(function (section, index) {
        return "<button type=\"button\" class=\"aj-detail-btn\" data-file-tab=\"" + index + "\">" + esc(section.title) + "</button>";
      }).join("");
      var uploads = document.getElementById("aj-file-uploads");
      if (uploads) {
        var files = pack.uploads || [];
        uploads.innerHTML = files.length
          ? files.map(function (file) {
            return "<li>" + esc(file.original_name || file.deliverable_type || "") + (file.teacher_name ? " — " + esc(file.teacher_name) : "") + "</li>";
          }).join("")
          : "<li>لا ملفات مرفوعة لهذا العرض.</li>";
      }
      tabs.querySelectorAll("[data-file-tab]").forEach(function (button) {
        button.addEventListener("click", function () {
          paintFile(Number(button.getAttribute("data-file-tab") || 0));
        });
      });
      paintFile(0);
    }).catch(function (error) {
      setStatus((error && error.message) || "تعذر قراءة ملفات المعلم.", true);
    });
  }

  function bindFiles() {
    var select = document.getElementById("aj-file-teacher");
    var printBtn = document.getElementById("aj-file-print");
    if (!select || select.getAttribute("data-bound") === "1") {
      return;
    }
    select.setAttribute("data-bound", "1");
    readJson("/api/noor/staff").then(function (body) {
      fillTeachers(body.people || []);
      var target = document.getElementById("aj-file-teacher");
      if (!target) {
        return;
      }
      target.innerHTML = document.getElementById("aj-deliver-auto-teacher").innerHTML;
    }).catch(function () {
      return null;
    });
    select.addEventListener("change", function () {
      loadTeacherFiles(select.value);
    });
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        var section = filePack && filePack.sections ? filePack.sections[fileIndex] : null;
        if (!section || !root.PrintMasterCore || typeof root.PrintMasterCore.sheet !== "function" || !root.AJPrint) {
          setStatus("نواة الطباعة غير محمّلة.", true);
          return;
        }
        var body = String(section.text || "").split("\n").filter(Boolean).map(function (line) {
          return "<p>" + esc(line) + "</p>";
        }).join("");
        leadershipColumns().then(function (columns) {
          var html = root.PrintMasterCore.sheet({
            strictIdentity: true,
            title: (filePack.name || "") + " — " + (section.title || ""),
            bodyHtml: body,
            columns: columns,
            signoff: true,
            kind: "document"
          });
          root.AJPrint.show(html, { pdfTitle: section.title || "ملف المعلم", arm: { multiPage: true } });
        });
      });
    }
  }

  function bind() {
    var openBtn = document.getElementById("aj-deliver-auto");
    var form = document.getElementById("aj-deliver-auto-form");
    var cancel = document.getElementById("aj-deliver-auto-cancel");
    var teacher = document.getElementById("aj-deliver-auto-teacher");
    if (!openBtn || !form || openBtn.getAttribute("data-bound") === "1") {
      return;
    }
    openBtn.setAttribute("data-bound", "1");
    openBtn.addEventListener("click", function () {
      form.hidden = false;
      readJson("/api/noor/staff").then(function (body) {
        fillTeachers(body.people || []);
      }).catch(function (error) {
        setStatus((error && error.message) || "تعذر قراءة سجل المنسوبين.", true);
      });
    });
    if (teacher) {
      teacher.addEventListener("change", syncSubject);
    }
    form.addEventListener("submit", generate);
    if (cancel) {
      cancel.addEventListener("click", function () {
        form.hidden = true;
        setStatus("");
      });
    }
  }

  function start() {
    bind();
    bindFiles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}(window));
