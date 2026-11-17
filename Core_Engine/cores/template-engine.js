/* template-engine — قرار 286. يدمج سياقاً محفوظاً في قالب، ولا يخترع حقلاً فارغاً. */
(function (root) {
  "use strict";

  function headers() {
    var result = { "Content-Type": "application/json" };
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

  function dig(bag, path) {
    var node = bag;
    String(path || "").split(".").forEach(function (part) {
      if (node == null) {
        return;
      }
      node = node[part];
    });
    return node == null ? "" : String(node);
  }

  function fill(template, context) {
    return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, function (_all, key) {
      return dig(context || {}, key);
    });
  }

  function context() {
    return fetch("/api/session/template-context", { headers: headers(), cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("تعذر قراءة سياق القالب");
        }
        return response.json();
      });
  }

  function audit() {
    var consistency = root.ConsistencyCore && typeof root.ConsistencyCore.check === "function"
      ? root.ConsistencyCore.check()
      : Promise.resolve({ ok: true, issues: [] });
    return Promise.all([consistency, context()]).then(function (parts) {
      var report = parts[0] || { issues: [] };
      var bag = parts[1] || {};
      var issues = (report.issues || []).slice();
      if (!bag.school || !String(bag.school.name || "").trim()) {
        issues.push({ kind: "school", fix: "manual", message: "اسم المدرسة غير محفوظ في الإعدادات." });
      }
      (bag.programs || []).forEach(function (program) {
        if (program.owner_linked === false) {
          issues.push({
            kind: "program",
            fix: "manual",
            message: "البرنامج «" + (program.name || "") + "» بدور «" + program.owner_role + "» بلا اسم في التشكيل."
          });
        }
      });
      return { ok: issues.length === 0, count: issues.length, issues: issues, context: bag };
    });
  }

  root.TemplateEngine = {
    version: "286",
    fill: fill,
    context: context,
    audit: audit
  };

  var button = document.getElementById("aj-integrity-check");
  if (button) {
    button.addEventListener("click", function () {
      var list = document.getElementById("aj-integrity-report");
      var status = document.getElementById("aj-school-status");
      if (status) {
        status.textContent = "جارٍ فحص التكامل...";
      }
      audit().then(function (report) {
        if (status) {
          status.textContent = report.ok ? "الروابط سليمة." : ("تنبيهات: " + report.count);
        }
        if (!list) {
          return;
        }
        list.hidden = !report.issues.length;
        list.innerHTML = "";
        (report.issues || []).forEach(function (issue) {
          var li = document.createElement("li");
          li.textContent = issue.message || "";
          list.appendChild(li);
        });
      }).catch(function (error) {
        if (status) {
          status.textContent = error.message || "تعذر الفحص.";
        }
      });
    });
  }
}(window));
