/* صفحة الهوية — تبويبات تفاعلية + تعبئة من SSOT العامة. */
(function () {
  "use strict";

  var EASTERN = "٠١٢٣٤٥٦٧٨٩";
  var PARTNER_ICONS = {
    "وزارة التعليم": "◈",
    "هيئة تقويم التعليم والتدريب (ETEC)": "▣",
    ETEC: "▣",
    موهبة: "★",
    الأسرة: "♡"
  };

  function toEastern(value) {
    return String(value == null ? "" : value).replace(/[0-9]/g, function (d) {
      return EASTERN.charAt(Number(d));
    });
  }

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function activateTab(id) {
    var key = String(id || "about").replace(/^#/, "");
    if (!document.getElementById(key)) {
      key = "about";
    }
    Array.prototype.forEach.call(document.querySelectorAll("[data-tab]"), function (btn) {
      var on = btn.getAttribute("data-tab") === key;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    Array.prototype.forEach.call(document.querySelectorAll(".identity-panel"), function (panel) {
      var on = panel.id === key;
      panel.classList.toggle("is-active", on);
      if (on) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "");
      }
    });
    if (location.hash !== "#" + key) {
      history.replaceState(null, "", "#" + key);
    }
  }

  function paint(pack) {
    var c = (pack && pack.content) || {};
    var stats = (pack && pack.stats) || {};
    document.getElementById("id-school-name").textContent = c.school_name || "متوسطة سعد بن الربيع الأنصاري";
    document.getElementById("about-copy").textContent = c.about || "";
    document.getElementById("about-stats").innerHTML =
      '<div class="identity-stat"><strong>' +
      toEastern(stats.students != null ? stats.students : c.display_students || 338) +
      "</strong><span>طالب</span></div>" +
      '<div class="identity-stat"><strong>' +
      toEastern(stats.staff != null ? stats.staff : c.display_staff || 39) +
      "</strong><span>منسوب</span></div>" +
      '<div class="identity-stat"><strong>' +
      toEastern(c.statistical_number || "40341") +
      "</strong><span>الرقم الإحصائي</span></div>";
    document.getElementById("about-meta").innerHTML =
      "<dl>" +
      "<div><dt>المدرسة</dt><dd>" +
      escapeHtml(c.school_name || "") +
      "</dd></div>" +
      "<div><dt>الإدارة</dt><dd>" +
      escapeHtml(c.education_administration || "") +
      "</dd></div>" +
      "<div><dt>مدير المدرسة</dt><dd>" +
      escapeHtml(c.principal_name || "") +
      "</dd></div>" +
      "</dl>";

    document.getElementById("vision-copy").textContent = c.vision || "";
    document.getElementById("mission-copy").textContent = c.mission || "";
    document.getElementById("values-copy").innerHTML = (c.values || [])
      .map(function (v) {
        return "<li>" + escapeHtml(v) + "</li>";
      })
      .join("");
    document.getElementById("goals-copy").innerHTML = (c.goals || [])
      .map(function (g) {
        return "<li>" + escapeHtml(g) + "</li>";
      })
      .join("");
    document.getElementById("partners-list").innerHTML = (c.partners || [])
      .map(function (p) {
        var icon = PARTNER_ICONS[p] || "●";
        return (
          '<article class="identity-tile"><div class="identity-tile-icon" aria-hidden="true">' +
          icon +
          "</div><h3>" +
          escapeHtml(p) +
          "</h3><p>شريك استراتيجي في منظومة التعليم والرعاية.</p></article>"
        );
      })
      .join("");
    document.getElementById("contact-list").innerHTML =
      "<li><span>المدرسة</span>" +
      escapeHtml(c.school_name || "") +
      "</li>" +
      "<li><span>مدير المدرسة</span>" +
      escapeHtml(c.principal_name || "") +
      "</li>" +
      "<li><span>الرقم الإحصائي</span>" +
      toEastern(c.statistical_number || "") +
      "</li>" +
      "<li><span>الإدارة</span>" +
      escapeHtml(c.education_administration || "") +
      "</li>";
    document.getElementById("contact-note").textContent = c.contact_note || "";
  }

  function bind() {
    document.getElementById("identity-tabs").addEventListener("click", function (event) {
      var btn = event.target.closest("[data-tab]");
      if (btn) {
        activateTab(btn.getAttribute("data-tab"));
      }
    });
    window.addEventListener("hashchange", function () {
      activateTab(location.hash || "about");
    });
  }

  bind();
  activateTab(location.hash || "about");
  fetch("/api/public/school-identity", { cache: "no-store" })
    .then(function (r) {
      return r.json();
    })
    .then(paint)
    .catch(function () {
      paint({
        content: {
          school_name: "متوسطة سعد بن الربيع الأنصاري",
          statistical_number: "40341",
          education_administration: "الإدارة العامة للتعليم بمنطقة المدينة المنورة",
          principal_name: "أ. نايف بن سمير حجيف المخلفي",
          display_students: 338,
          display_staff: 39,
          about:
            "متوسطة سعد بن الربيع الأنصاري مدرسة حكومية للبنين في المدينة المنورة، تعمل تحت إشراف الإدارة العامة للتعليم بمنطقة المدينة المنورة.",
          vision: "بيئة تعليمية محفّزة تُخرج متعلماً متمكناً قيمياً ومعرفياً ومهارياً.",
          mission: "تقديم تعليم متوسط نوعي يعتمد على التخطيط التشغيلي والشواهد الحية.",
          values: ["الأمانة", "الإتقان", "الانتماء", "التعاون", "المسؤولية"],
          goals: [
            "رفع نواتج التعلم في القراءة والرياضيات والعلوم وفق مؤشرات الاعتماد.",
            "تعزيز السلوك الإيجابي وبرامج قدوة ورفق والانضباط المدرسي.",
            "تفعيل الشراكة مع الأسرة والمجتمع ومؤسسات التعليم.",
            "تمكين المعلمين رقمياً ومهنياً عبر شواهد الأداء والزيارات الصفية."
          ],
          partners: ["وزارة التعليم", "هيئة تقويم التعليم والتدريب (ETEC)", "موهبة", "الأسرة"],
          contact_note: "للاستفسار عبر إدارة المدرسة أو الموجه الطلابي خلال الدوام الرسمي."
        },
        stats: { students: 338, staff: 39 }
      });
    });
})();
