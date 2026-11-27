/* ميدان المحطات — أيقونات معبّرة تفتح صفحة محطة مع زر العودة للميدان */
(function (root) {
  "use strict";

  var ICONS = {
    readalong:
      '<svg viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="stRa" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#059669"/><stop offset="100%" stop-color="#34d399"/></linearGradient></defs><rect width="96" height="96" rx="28" fill="url(#stRa)"/><path d="M22 28h34c8 0 14 5 14 13v12c0 8-6 13-14 13H42l-12 11V66H22c-6 0-10-5-10-12V40c0-7 4-12 10-12z" fill="#fff"/><circle cx="36" cy="46" r="4" fill="#059669"/><circle cx="48" cy="46" r="4" fill="#059669"/><circle cx="60" cy="46" r="4" fill="#059669"/><path d="M68 30c8 4 14 12 14 22s-6 18-14 22" fill="none" stroke="#ecfdf5" stroke-width="4" stroke-linecap="round"/><path d="M76 36c5 3 9 9 9 16s-4 13-9 16" fill="none" stroke="#a7f3d0" stroke-width="3" stroke-linecap="round"/></svg>',
    modes:
      '<svg viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="stMd" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0284c7"/><stop offset="100%" stop-color="#67e8f9"/></linearGradient></defs><rect width="96" height="96" rx="28" fill="url(#stMd)"/><path d="M20 66l16-34 12 20 8-14 20 28H20z" fill="#fff"/><circle cx="70" cy="28" r="8" fill="#fbbf24"/><circle cx="70" cy="28" r="3" fill="#fff7ed"/></svg>',
    games:
      '<svg viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="stGm" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#c4b5fd"/></linearGradient></defs><rect width="96" height="96" rx="28" fill="url(#stGm)"/><rect x="22" y="28" width="52" height="40" rx="12" fill="#fff"/><circle cx="36" cy="44" r="5" fill="#7c3aed"/><circle cx="60" cy="44" r="5" fill="#7c3aed"/><path d="M44 52h8" stroke="#a78bfa" stroke-width="4" stroke-linecap="round"/><path d="M30 22h8M58 22h8M30 74h8M58 74h8" stroke="#ede9fe" stroke-width="4" stroke-linecap="round"/></svg>',
    golden:
      '<svg viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="stGd" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#b45309"/><stop offset="50%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#fde68a"/></linearGradient></defs><rect width="96" height="96" rx="28" fill="url(#stGd)"/><path d="M30 38h36l-4 34H34z" fill="#fff7ed"/><path d="M28 34h40v8H28z" fill="#fff"/><circle cx="48" cy="54" r="8" fill="#b45309"/><path d="M48 48v12M42 54h12" stroke="#fde68a" stroke-width="2"/></svg>',
    traps:
      '<svg viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="stTr" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#b91c1c"/><stop offset="100%" stop-color="#fb7185"/></linearGradient></defs><rect width="96" height="96" rx="28" fill="url(#stTr)"/><path d="M48 22l26 48H22z" fill="#fff"/><rect x="45" y="40" width="6" height="16" rx="2" fill="#b91c1c"/><circle cx="48" cy="64" r="4" fill="#b91c1c"/></svg>',
    purge:
      '<svg viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="stPg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#c2410c"/><stop offset="100%" stop-color="#fdba74"/></linearGradient></defs><rect width="96" height="96" rx="28" fill="url(#stPg)"/><path d="M30 58c0-12 8-22 18-22s18 10 18 22" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M34 58h28" stroke="#ffedd5" stroke-width="5" stroke-linecap="round"/><path d="M48 28v10" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="48" cy="66" r="5" fill="#fff"/></svg>',
    live:
      '<svg viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="stLv" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f766e"/><stop offset="100%" stop-color="#5eead4"/></linearGradient></defs><rect width="96" height="96" rx="28" fill="url(#stLv)"/><circle cx="36" cy="40" r="10" fill="#fff"/><circle cx="62" cy="40" r="10" fill="#ecfdf5"/><path d="M20 68c2-12 10-18 16-18s14 6 16 18" fill="#fff"/><path d="M48 68c2-10 8-16 14-16s12 6 14 16" fill="#ccfbf1"/><circle cx="70" cy="28" r="6" fill="#ef4444"/><circle cx="70" cy="28" r="3" fill="#fecaca"/></svg>',
    sim:
      '<svg viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="stSim" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#3730a3"/><stop offset="100%" stop-color="#818cf8"/></linearGradient></defs><rect width="96" height="96" rx="28" fill="url(#stSim)"/><rect x="24" y="20" width="48" height="56" rx="6" fill="#fff"/><rect x="30" y="28" width="20" height="4" rx="2" fill="#c7d2fe"/><rect x="30" y="36" width="28" height="3" rx="1.5" fill="#e0e7ff"/><circle cx="34" cy="48" r="3.2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><circle cx="44" cy="48" r="3.2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><circle cx="54" cy="48" r="3.2" fill="#4f46e5"/><circle cx="64" cy="48" r="3.2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><circle cx="34" cy="58" r="3.2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><circle cx="44" cy="58" r="3.2" fill="#4f46e5"/><circle cx="54" cy="58" r="3.2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><circle cx="64" cy="58" r="3.2" fill="none" stroke="#4f46e5" stroke-width="1.6"/><path d="M30 68h28" stroke="#a5b4fc" stroke-width="3" stroke-linecap="round"/></svg>'
  };

  var STATIONS = [
    {
      id: "readalong",
      title: "القراءة المتزامنة",
      subtitle: "صوت وصور · مؤشر ٣-١-١-١",
      tone: "emerald",
      icon: "readalong"
    },
    {
      id: "modes",
      title: "أنماط التحدي",
      subtitle: "يومي · محاكي · وطني · مبارزة",
      tone: "sky",
      icon: "modes"
    },
    {
      id: "sim",
      title: "اختبار محاكي",
      subtitle: "OMR · نموذج ١-٤…٤-٤",
      tone: "indigo",
      icon: "sim"
    },
    {
      id: "games",
      title: "ألعاب التأسيس",
      subtitle: "كلمات · قرآن · حساب ذهني",
      tone: "violet",
      icon: "games"
    },
    {
      id: "golden",
      title: "الحقيبة الذهبية",
      subtitle: "اقلب البطاقة وسجّل إتقانك",
      tone: "amber",
      icon: "golden"
    },
    {
      id: "traps",
      title: "أبواب الأخطاء",
      subtitle: "فخ شائع + قاعدة ذهبية",
      tone: "rose",
      icon: "traps"
    },
    {
      id: "purge",
      title: "تطهير الأخطاء",
      subtitle: "Vault · مؤشر إتقان",
      tone: "orange",
      icon: "purge"
    },
    {
      id: "live",
      title: "الميدان الحي",
      subtitle: "متواجدون الآن · دعوات مبارزة",
      tone: "teal",
      icon: "live"
    }
  ];

  var state = { station: "", api: null };

  function el(id) {
    return document.getElementById(id);
  }

  function paintHub() {
    var grid = el("field-icon-grid");
    if (!grid) return;
    grid.innerHTML = STATIONS.map(function (s, i) {
      return (
        '<button type="button" class="field-icon tone-' +
        s.tone +
        '" data-open-station="' +
        s.id +
        '" style="--delay:' +
        i * 45 +
        'ms">' +
        '<span class="field-icon-art">' +
        (ICONS[s.icon] || "") +
        "</span>" +
        '<span class="field-icon-copy"><strong>' +
        s.title +
        "</strong><small>" +
        s.subtitle +
        "</small></span>" +
        "</button>"
      );
    }).join("");
  }

  function showStation(id) {
    var hub = el("field-hub");
    var shell = el("station-shell");
    var title = el("station-title");
    var subtitle = el("station-subtitle");
    var meta = STATIONS.filter(function (s) {
      return s.id === id;
    })[0];
    if (!shell || !meta) return;
    state.station = id;
    if (hub) hub.hidden = true;
    shell.hidden = false;
    document.body.classList.add("station-open");
    if (title) title.textContent = meta.title;
    if (subtitle) subtitle.textContent = meta.subtitle;
    Array.prototype.forEach.call(document.querySelectorAll("[data-station]"), function (panel) {
      var on = panel.getAttribute("data-station") === id;
      panel.hidden = !on;
      panel.classList.toggle("is-station-active", on);
    });
    if (state.api && typeof state.api.status === "function") {
      state.api.status("محطة: " + meta.title);
    }
    if (id === "golden" && state.api && typeof state.api.loadGoldenDeck === "function") {
      state.api.loadGoldenDeck();
    }
    if (id === "traps" && state.api && typeof state.api.loadTrapAlbum === "function") {
      state.api.loadTrapAlbum();
    }
    if (id === "readalong" && window.PortalStudentAdaptive && typeof window.PortalStudentAdaptive.loadReadalongList === "function") {
      window.PortalStudentAdaptive.loadReadalongList();
    }
    if (id === "live" && window.PortalStudentGames && typeof window.PortalStudentGames.refreshPresence === "function") {
      window.PortalStudentGames.refreshPresence();
    }
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }

  function backToField() {
    var hub = el("field-hub");
    var shell = el("station-shell");
    state.station = "";
    document.body.classList.remove("station-open");
    if (shell) shell.hidden = true;
    if (hub) hub.hidden = false;
    Array.prototype.forEach.call(document.querySelectorAll("[data-station]"), function (panel) {
      panel.hidden = true;
      panel.classList.remove("is-station-active");
    });
    if (state.api && typeof state.api.status === "function") {
      state.api.status("عدتَ إلى الميدان — اختر محطة.");
    }
  }

  function bind() {
    var grid = el("field-icon-grid");
    if (grid) {
      grid.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-open-station]");
        if (!btn) return;
        showStation(btn.getAttribute("data-open-station"));
      });
    }
    var back = el("btn-back-field");
    if (back) {
      back.addEventListener("click", backToField);
    }
  }

  function boot(api) {
    state.api = api || {};
    paintHub();
    bind();
    backToField();
  }

  root.PortalStudentStations = {
    boot: boot,
    open: showStation,
    back: backToField,
    stations: STATIONS
  };
})(window);
