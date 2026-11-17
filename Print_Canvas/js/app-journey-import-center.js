/* مركز الاستيراد — جلسة مدير، بلا localStorage للبيانات */
(function () {
  "use strict";

  var tokens = [];
  var staffOptions = [];
  var lastPayload = null;
  var SESSION_KEY = "sessionUser";

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

  function apiError(body, fallback) {
    if (body && body.detail) {
      if (typeof body.detail === "string") {
        return body.detail;
      }
    }
    return fallback;
  }

  function setStatus(text, isError) {
    var node = document.getElementById("aj-ic-status");
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
      .replace(/>/g, "&gt;");
  }

  function dash(value) {
    if (value === 0) {
      return "0";
    }
    return (value === undefined || value === null || value === "") ? "—" : String(value);
  }

  function liveReport(snap) {
    if (!snap) {
      return "";
    }
    var classBody = (snap.classes || []).map(function (row) {
      return "<tr><td>" + escapeHtml(row.grade)
        + "</td><td>" + escapeHtml(row.classroom)
        + "</td><td>" + dash(row.count) + "</td></tr>";
    }).join("");
    var roleBody = (snap.roles || []).map(function (row) {
      return "<tr><td>" + escapeHtml(row.role)
        + "</td><td>" + dash(row.count) + "</td></tr>";
    }).join("");
    var gapLine = (snap.gaps && snap.gaps.length)
      ? snap.gaps.map(function (gap) {
        return escapeHtml(gap.label) + " " + dash(gap.count);
      }).join(" · ")
      : "لا نواقص ظاهرة في الصف أو الصفة أو ربط الحصص";
    return "<h3 class=\"aj-ic-sub\">سجل القاعدة</h3>"
      + "<p class=\"aj-gaps" + ((snap.gaps && snap.gaps.length) ? "" : " is-empty") + "\">مؤشر النواقص: " + gapLine + "</p>"
      + "<p>طلاب " + dash(snap.students)
      + " · مثرى " + dash(snap.enriched)
      + " · بلا صف " + dash(snap.empty_grade)
      + " · منسوبون " + dash(snap.staff)
      + " · بلا صفة " + dash(snap.empty_role)
      + " · حصص " + dash(snap.timetable)
      + " · مربوطة " + dash(snap.linked)
      + " · غير مربوطة " + dash(snap.unlinked) + "</p>"
      + "<table class=\"aj-env-students-table\"><thead><tr><th>الصف</th><th>الفصل</th><th>عدد الطلاب</th></tr></thead><tbody>"
      + classBody + "</tbody></table>"
      + "<table class=\"aj-env-students-table\"><thead><tr><th>الصفة</th><th>عدد المنسوبين</th></tr></thead><tbody>"
      + roleBody + "</tbody></table>";
  }

  function loadLive() {
    var host = document.getElementById("aj-ic-live");
    if (!host) {
      return;
    }
    fetch("/api/session/import-center/snapshot", { headers: authHeaders() })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiError(payload, "تعذر الملخص."));
          }
          return payload;
        });
      })
      .then(function (payload) {
        host.innerHTML = liveReport(payload);
      })
      .catch(function () {
        host.innerHTML = "";
      });
  }

  function filesTable(batches) {
    var body = batches.map(function (batch) {
      if (batch.excluded) {
        return "<tr><td>" + escapeHtml(batch.filename || "")
          + "</td><td>—</td><td>0</td><td>0</td><td>مستبعد</td></tr>";
      }
      var sheets = batch.kind === "students" ? dash(batch.sheets) : "—";
      return "<tr><td>" + escapeHtml(batch.filename || "")
        + "</td><td>" + sheets
        + "</td><td>" + dash(batch.read)
        + "</td><td>" + dash(batch.count)
        + "</td><td>" + dash(batch.skipped)
        + "</td></tr>";
    }).join("");
    return "<table class=\"aj-env-students-table\"><thead><tr>"
      + "<th>اسم الملف</th><th>عدد الأوراق</th><th>مقروء</th><th>صالح</th><th>متجاوز</th>"
      + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function classTable(batch) {
    var classes = (batch.distribution && batch.distribution.length) ? batch.distribution : (batch.classes || []);
    if (!classes.length) {
      return "";
    }
    var total = 0;
    var body = classes.map(function (row, index) {
      total += Number(row.count) || 0;
      var names = (row.names || []).map(function (name) {
        return "<li>" + escapeHtml(name) + "</li>";
      }).join("");
      return "<tr><td>" + escapeHtml(row.grade)
        + "</td><td>" + escapeHtml(row.classroom)
        + "</td><td>" + dash(row.count)
        + "</td><td><details class=\"aj-ic-names\"><summary>الأسماء</summary><ol>"
        + names + "</ol></details></td></tr>";
    }).join("");
    return "<h3 class=\"aj-ic-sub\">توزيع الطلاب — " + escapeHtml(batch.filename || "")
      + "</h3><table class=\"aj-env-students-table\"><thead><tr>"
      + "<th>الصف</th><th>الفصل</th><th>عدد الطلاب</th><th></th>"
      + "</tr></thead><tbody>" + body
      + "<tr><th>الإجمالي</th><td>—</td><td>" + total + "</td><td></td></tr>"
      + "</tbody></table>";
  }

  function pickList(row, token) {
    if (row.status === "مطابق") {
      return "";
    }
    var list = (row.candidates && row.candidates.length) ? row.candidates : staffOptions;
    if (!list.length) {
      return "";
    }
    return "<ul class=\"aj-ic-picks\">" + list.map(function (item) {
      return "<li>" + escapeHtml(item.name)
        + " · " + escapeHtml(item.national_id)
        + " · " + escapeHtml(item.specialty)
        + " · " + escapeHtml(item.role)
        + " <button type=\"button\" class=\"aj-detail-btn\" data-ic-pick data-ic-token=\""
        + escapeHtml(token) + "\" data-ic-teacher=\"" + escapeHtml(row.name)
        + "\" data-ic-nid=\"" + escapeHtml(item.national_id)
        + "\">تعيين</button></li>";
    }).join("") + "</ul>";
  }

  function matchTable(batch) {
    var rows = batch.match_report || [];
    if (!rows.length) {
      return "";
    }
    var token = batch.token || (tokens[0] || "");
    var body = rows.map(function (row) {
      var staffName = row.staff_name || "";
      if (row.status === "غامض") {
        staffName = ((row.candidates || []).length) + " مرشحون";
      }
      return "<tr><td>" + escapeHtml(row.name)
        + "</td><td>" + escapeHtml(row.national_id)
        + "</td><td>" + escapeHtml(staffName)
        + "</td><td>" + escapeHtml(row.status)
        + "</td><td>" + pickList(row, token) + "</td></tr>";
    }).join("");
    return "<h3 class=\"aj-ic-sub\">مطابقة المعلمين</h3><table class=\"aj-env-students-table\"><thead><tr>"
      + "<th>اسم في الجدول</th><th>الهوية</th><th>الاسم في المنسوبين</th><th>الحالة</th><th></th>"
      + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function roleTable(batch) {
    var roles = batch.roles || [];
    if (!roles.length) {
      return "";
    }
    var total = 0;
    var body = roles.map(function (row) {
      total += Number(row.count) || 0;
      return "<tr><td>" + escapeHtml(row.role) + "</td><td>" + dash(row.count) + "</td></tr>";
    }).join("");
    return "<h3 class=\"aj-ic-sub\">توزيع المنسوبين — " + escapeHtml(batch.filename || "")
      + "</h3><table class=\"aj-env-students-table\"><thead><tr>"
      + "<th>الصفة</th><th>عدد المنسوبين</th>"
      + "</tr></thead><tbody>" + body
      + "<tr><th>الإجمالي</th><td>" + total + "</td></tr>"
      + "</tbody></table>";
  }

  function renderPreview(payload) {
    var summary = document.getElementById("aj-ic-summary");
    var unmatched = document.getElementById("aj-ic-unmatched");
    var host = document.getElementById("aj-ic-preview");
    var commit = document.getElementById("aj-ic-commit");
    lastPayload = payload;
    staffOptions = payload.staff_options || staffOptions;
    var batches = payload.batches && payload.batches.length ? payload.batches : [payload];
    var included = batches.filter(function (batch) {
      return !batch.excluded && batch.count;
    });
    if (summary) {
      summary.textContent = "ملفات " + batches.length
        + " · للإدراج " + included.length
        + " · سجلات " + (payload.count || 0)
        + " · مستبعد " + (batches.length - included.length);
    }
    if (unmatched) {
      unmatched.innerHTML = "";
      batches.forEach(function (batch) {
        (batch.warnings || []).forEach(function (text) {
          var li = document.createElement("li");
          li.textContent = text;
          unmatched.appendChild(li);
        });
      });
    }
    if (!host) {
      return;
    }
    var html = filesTable(batches);
    batches.forEach(function (batch) {
      if (batch.kind === "students") {
        html += classTable(batch);
      }
      if (batch.kind === "teachers") {
        html += roleTable(batch);
      }
      if (batch.kind === "matrix") {
        html += matchTable(batch);
      }
    });
    host.innerHTML = html;
    var ready = tokens.length > 0;
    if (commit) {
      commit.hidden = false;
      commit.disabled = !ready;
    }
  }

  function renderResult(payload) {
    var host = document.getElementById("aj-ic-result");
    if (!host) {
      return;
    }
    var ok = Number(payload.success || 0);
    var fail = Number(payload.failed || 0);
    var inserted = Number(payload.inserted || 0);
    var updated = Number(payload.updated || 0);
    var unmatched = payload.unmatched || [];
    var teachers = payload.unmatched_teachers || [];
    host.hidden = false;
    host.innerHTML = "<h3 class=\"aj-ic-sub\">ملخص الإدراج</h3>"
      + "<table class=\"aj-env-students-table\"><thead><tr>"
      + "<th>نجح</th><th>فشل</th><th>جديد</th><th>محدّث</th></tr></thead><tbody><tr>"
      + "<td>" + ok + "</td><td>" + fail + "</td><td>" + inserted + "</td><td>" + updated
      + "</td></tr></tbody></table>"
      + (unmatched.length || teachers.length
        ? "<p>غير مطابق: " + (unmatched.length + teachers.length) + "</p>"
        : "");
  }

  function analyze(event) {
    event.preventDefault();
    var form = event.target;
    var kind = form.getAttribute("data-ic-form") || "matrix";
    var fileEl = form.querySelector("input[type=\"file\"]");
    if (!fileEl || !fileEl.files || !fileEl.files[0]) {
      setStatus("اختر ملفاً.", true);
      return;
    }
    var body = new FormData();
    var url = "/api/session/import-center/analyze";
    body.append("kind", kind);
    Array.prototype.forEach.call(fileEl.files, function (file) {
      body.append("files", file, file.name || "import.xlsx");
    });
    setStatus("جارٍ التحليل...");
    fetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: body
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error(apiError(payload, "تعذر التحليل."));
        }
        return payload;
      });
    }).then(function (payload) {
      tokens = ((payload.tokens && payload.tokens.length)
        ? payload.tokens.slice()
        : (payload.token ? [payload.token] : [])).filter(Boolean);
      renderPreview(payload);
      setStatus("المعاينة جاهزة. راجع ثم أكّد الإدراج.");
      return payload;
    }).catch(function (error) {
      tokens = [];
      setStatus((error && error.message) || "تعذر التحليل.", true);
    });
  }

  function commit() {
    if (!tokens.length) {
      setStatus("حلّل الملف أولاً.", true);
      return;
    }
    fetch("/api/session/import-center/commit", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token: tokens[0], tokens: tokens })
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error(apiError(payload, "تعذر الإدراج."));
        }
        return payload;
      });
    }).then(function (payload) {
      tokens = [];
      var commitBtn = document.getElementById("aj-ic-commit");
      if (commitBtn) {
        commitBtn.hidden = false;
        commitBtn.disabled = true;
      }
      renderResult(payload);
      setStatus(
        (Number(payload.failed || 0) ? "اكتمل مع فشل. " : "اكتمل بنجاح. ")
          + "نجح " + (payload.success || 0)
          + " · فشل " + (payload.failed || 0)
          + " · جديد " + (payload.inserted || 0)
          + " · محدّث " + (payload.updated || 0)
      );
      if (payload.snapshot) {
        var live = document.getElementById("aj-ic-live");
        if (live) {
          live.innerHTML = liveReport(payload.snapshot);
        }
      } else {
        loadLive();
      }
    }).catch(function (error) {
      setStatus((error && error.message) || "تعذر الإدراج.", true);
    });
  }

  window.AjImportCenter = {
    load: loadLive
  };
  loadLive();
  Array.prototype.forEach.call(document.querySelectorAll("[data-ic-form]"), function (form) {
    form.addEventListener("submit", analyze);
  });
  var commitBtn = document.getElementById("aj-ic-commit");
  if (commitBtn) {
    commitBtn.addEventListener("click", commit);
  }
  var previewHost = document.getElementById("aj-ic-preview");
  if (previewHost) {
    previewHost.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-ic-pick]");
      if (!btn) {
        return;
      }
      fetch("/api/session/import-center/assign", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          token: btn.getAttribute("data-ic-token") || tokens[0] || "",
          teacher: btn.getAttribute("data-ic-teacher") || "",
          national_id: btn.getAttribute("data-ic-nid") || ""
        })
      }).then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiError(payload, "تعذر التعيين."));
          }
          return payload;
        });
      }).then(function (payload) {
        if (lastPayload) {
          lastPayload.match_report = payload.match_report || lastPayload.match_report;
          lastPayload.unmatched_teachers = payload.unmatched_teachers || [];
          if (lastPayload.batches && lastPayload.batches[0]) {
            lastPayload.batches[0].match_report = lastPayload.match_report;
          }
        }
        renderPreview(lastPayload || payload);
        setStatus("عُيّن يدوياً. راجع ثم أكّد الإدراج.");
      }).catch(function (error) {
        setStatus((error && error.message) || "تعذر التعيين.", true);
      });
    });
  }
})();
