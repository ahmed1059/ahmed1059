/* L7 — اسم المدرسة والهوية من /api/settings فقط (بلا اختراع) */
(function (global) {
  "use strict";

  var cache = null;

  function applyName(name) {
    var text = String(name || "").trim();
    if (!text) return;
    cache = text;
    document.querySelectorAll(
      [
        ".school-name",
        ".school-name-title",
        "#command-school-name",
        "#official-school",
        "#profile-name",
        ".soft-witness-foot-school",
        ".improvement-print-foot"
      ].join(",")
    ).forEach(function (node) {
      if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") {
        node.value = text;
      } else {
        node.textContent = text;
      }
    });
    document.querySelectorAll(".identity-stack").forEach(function (stack) {
      var lines = stack.querySelectorAll(":scope > div");
      if (lines.length) {
        lines[lines.length - 1].textContent = text;
      }
    });
  }

  function load() {
    return fetch("/api/settings", { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        var name =
          data && data.school && data.school.name
            ? String(data.school.name).trim()
            : "";
        if (name) applyName(name);
        return name || cache;
      })
      .catch(function () {
        return cache;
      });
  }

  function current() {
    return cache || "";
  }

  function boot() {
    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.addEventListener("dataChanged", function (event) {
    var source = event && event.detail && event.detail.source;
    if (!source || source === "settings" || source === "facility" || source === "leadership") {
      load();
    }
  });

  global.IdentityBind = {
    load: load,
    applyName: applyName,
    current: current
  };
})(window);
