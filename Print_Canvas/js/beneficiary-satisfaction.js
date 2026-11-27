/**
 * قياس رضا المستفيد — واجهة تفاعلية (مسودة / لقطة)
 * منفصل عن استبانة نافس وعن مؤشرات الإتقان.
 */
(function (global) {
  "use strict";

  var EASTERN = "٠١٢٣٤٥٦٧٨٩";

  function east(value) {
    return String(value == null ? "" : value).replace(/[0-9]/g, function (d) {
      return EASTERN.charAt(Number(d));
    }).replace(/%/g, "٪");
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ltr(code) {
    var raw = east(code);
    if (!raw) return "";
    return (
      "<span class=\"etec-code etec-force\" dir=\"ltr\">\u2066" +
      esc(raw) +
      "\u2069</span>"
    );
  }

  function collectAnswers(root) {
    var answers = {};
    if (!root) return answers;
    root.querySelectorAll(".benef-sat-choice.is-on[data-benef-n]").forEach(function (btn) {
      var n = btn.getAttribute("data-benef-n") || "";
      var ch = btn.getAttribute("data-benef-choice") || "";
      if (!n || !ch) return;
      answers[n] = { kind: "single", choices: [ch] };
    });
    return answers;
  }

  function applyAnswers(root, answers) {
    if (!root || !answers) return;
    Object.keys(answers).forEach(function (n) {
      var entry = answers[n] || {};
      var ch = (entry.choices || [])[0];
      if (!ch) return;
      var btn = root.querySelector(
        '.benef-sat-choice[data-benef-n="' + n + '"][data-benef-choice="' + ch + '"]'
      );
      if (!btn) return;
      root.querySelectorAll('.benef-sat-choice[data-benef-n="' + n + '"]').forEach(function (el) {
        el.classList.remove("is-on");
        el.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("is-on");
      btn.setAttribute("aria-pressed", "true");
    });
  }

  function bindChoices(root) {
    if (!root || root._benefBound) return;
    root._benefBound = true;
    root.addEventListener("click", function (event) {
      var btn = event.target.closest(".benef-sat-choice");
      if (!btn || !root.contains(btn)) return;
      var n = btn.getAttribute("data-benef-n") || "";
      root.querySelectorAll('.benef-sat-choice[data-benef-n="' + n + '"]').forEach(function (el) {
        if (el !== btn) {
          el.classList.remove("is-on");
          el.setAttribute("aria-pressed", "false");
        }
      });
      var on = !btn.classList.contains("is-on");
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function renderForm(pack, draftAnswers) {
    var axes = pack.axes || [];
    var body = axes
      .map(function (axis) {
        var items = (axis.items || [])
          .map(function (it) {
            var choices = (it.choices || [])
              .map(function (ch, idx) {
                var label = (it.choice_labels || [])[idx] || ch;
                return (
                  "<button type=\"button\" class=\"benef-sat-choice\" data-benef-n=\"" +
                  esc(it.n) +
                  "\" data-benef-choice=\"" +
                  esc(ch) +
                  "\" aria-pressed=\"false\">" +
                  "<span class=\"benef-sat-key\">" +
                  esc(ch) +
                  "</span>" +
                  "<span class=\"benef-sat-label\">" +
                  esc(label) +
                  "</span></button>"
                );
              })
              .join("");
            return (
              "<article class=\"benef-sat-item\" data-item=\"" +
              esc(it.n) +
              "\">" +
              "<div class=\"benef-sat-item-head\"><span class=\"benef-sat-badge\">" +
              esc(it.n_ar || east(it.n)) +
              "</span><p>" +
              esc(it.stem || "") +
              "</p></div>" +
              "<div class=\"benef-sat-choices\">" +
              choices +
              "</div></article>"
            );
          })
          .join("");
        return (
          "<section class=\"benef-sat-axis\">" +
          "<h3>" +
          esc(axis.title || "") +
          " <small>" +
          ltr(axis.etec_hint || "") +
          "</small></h3>" +
          items +
          "</section>"
        );
      })
      .join("");

    return (
      "<div class=\"benef-sat-shell wash-board\">" +
      "<header class=\"benef-sat-head\">" +
      "<h2>" +
      esc(pack.title || "قياس رضا المستفيد") +
      "</h2>" +
      "<p>شاهد " +
      ltr(pack.evidence_code || "1-3-1-3") +
      " · مدرسة " +
      ltr("S-" + (pack.school_code || "40341")) +
      " · " +
      east(pack.count_ar || pack.count || 0) +
      " بنود · منفصل عن استبانة نافس وعن مؤشر الإتقان</p>" +
      "</header>" +
      "<div class=\"benef-sat-toolbar\">" +
      "<button type=\"button\" class=\"portal-btn\" data-benef-draft>حفظ المسودة</button>" +
      "<button type=\"button\" class=\"portal-btn\" data-benef-snapshot>اعتماد لقطة</button>" +
      "<button type=\"button\" class=\"portal-btn secondary\" data-benef-reset>مسح الاختيارات</button>" +
      "</div>" +
      "<p class=\"benef-sat-hint\">المسودة قابلة للتعديل دائمًا. الرصد الإحصائي يعتمد اللقطات المعتمدة فقط.</p>" +
      body +
      "</div>"
    );
  }

  function mount(host, pack, opts) {
    if (!host) return null;
    opts = opts || {};
    host.innerHTML = renderForm(pack || {}, opts.draftAnswers || {});
    host.classList.add("benef-sat-host");
    bindChoices(host);
    if (opts.draftAnswers) applyAnswers(host, opts.draftAnswers);
    var draftBtn = host.querySelector("[data-benef-draft]");
    var snapBtn = host.querySelector("[data-benef-snapshot]");
    var resetBtn = host.querySelector("[data-benef-reset]");
    if (draftBtn && typeof opts.onSaveDraft === "function") {
      draftBtn.addEventListener("click", function () {
        opts.onSaveDraft(collectAnswers(host));
      });
    }
    if (snapBtn && typeof opts.onSnapshot === "function") {
      snapBtn.addEventListener("click", function () {
        opts.onSnapshot(collectAnswers(host));
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        host.querySelectorAll(".benef-sat-choice.is-on").forEach(function (el) {
          el.classList.remove("is-on");
          el.setAttribute("aria-pressed", "false");
        });
      });
    }
    return host;
  }

  global.BeneficiarySatisfaction = {
    east: east,
    ltr: ltr,
    collectAnswers: collectAnswers,
    applyAnswers: applyAnswers,
    renderForm: renderForm,
    mount: mount
  };
})(typeof window !== "undefined" ? window : globalThis);
