/* مؤثرات ميدان الطالب: Living Avatars + Wave Mesh + ثيمات + Confetti */
(function () {
  "use strict";

  var waveState = { raf: 0, t: 0, theme: "royal" };
  var activeCategory = "falcons";

  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8);
  }

  function livingShell(inner, glow) {
    var gid = uid("ag");
    return (
      '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" class="living-avatar" aria-hidden="true">' +
      "<defs>" +
      '<radialGradient id="' +
      gid +
      '" cx="35%" cy="30%" r="70%">' +
      '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>' +
      '<stop offset="45%" stop-color="' +
      (glow || "#34d399") +
      '" stop-opacity="0.35"/>' +
      '<stop offset="100%" stop-color="#0f172a" stop-opacity="0.15"/>' +
      "</radialGradient>" +
      '<filter id="' +
      gid +
      's" x="-20%" y="-20%" width="140%" height="140%">' +
      '<feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#000" flood-opacity="0.28"/>' +
      "</filter>" +
      "</defs>" +
      '<rect width="80" height="80" rx="20" fill="url(#' +
      gid +
      ')"/>' +
      '<g filter="url(#' +
      gid +
      's)" class="avatar-pulse">' +
      inner +
      "</g></svg>"
    );
  }

  var AVATAR_SVG = {
    "falcon-island": function () {
      return livingShell(
        '<path d="M18 46 C22 28 34 18 42 16 C48 22 58 30 62 42 C54 40 48 42 44 48 C40 54 34 58 28 56 C24 52 20 50 18 46 Z" fill="#0f766e"/>' +
          '<path d="M42 16 C46 20 52 24 56 28 C50 30 46 28 42 24 Z" fill="#fbbf24"/>' +
          '<circle cx="36" cy="30" r="3.2" fill="#fff"/><circle cx="36.8" cy="30" r="1.4" fill="#111"/>' +
          '<path d="M28 40 L40 38 L34 46 Z" fill="#134e4a"/>',
        "#34d399"
      );
    },
    "falcon-peregrine": function () {
      return livingShell(
        '<ellipse cx="40" cy="42" rx="18" ry="16" fill="#1e3a8a"/>' +
          '<path d="M28 28 C36 18 52 20 58 30 C50 28 44 30 40 34 Z" fill="#93c5fd"/>' +
          '<path d="M34 34 L48 32 L42 42 Z" fill="#f59e0b"/>' +
          '<circle cx="34" cy="32" r="3" fill="#fff"/><circle cx="34.7" cy="32" r="1.3" fill="#0f172a"/>' +
          '<path d="M22 48 C30 54 48 56 58 48" stroke="#60a5fa" stroke-width="3" fill="none"/>',
        "#60a5fa"
      );
    },
    "falcon-golden": function () {
      return livingShell(
        '<path d="M20 48 C26 30 40 18 50 20 C58 28 62 40 58 50 C48 46 40 50 34 56 C28 54 22 52 20 48 Z" fill="#b45309"/>' +
          '<path d="M50 20 C54 24 58 30 60 36 C54 34 50 32 46 28 Z" fill="#fde68a"/>' +
          '<circle cx="38" cy="32" r="3.4" fill="#fff"/><circle cx="38.8" cy="32" r="1.5" fill="#111"/>' +
          '<path d="M32 40 L46 36 L40 48 Z" fill="#92400e"/>',
        "#fbbf24"
      );
    },
    "lion-den": function () {
      return livingShell(
        '<circle cx="40" cy="40" r="22" fill="#b45309"/>' +
          '<circle cx="40" cy="42" r="14" fill="#fbbf24"/>' +
          '<circle cx="34" cy="40" r="2.4" fill="#111"/><circle cx="46" cy="40" r="2.4" fill="#111"/>' +
          '<path d="M36 48 Q40 52 44 48" stroke="#7c2d12" stroke-width="2.5" fill="none"/>' +
          '<path d="M40 44 L38 48 L42 48 Z" fill="#9a3412"/>',
        "#f59e0b"
      );
    },
    "lion-king": function () {
      return livingShell(
        '<path d="M18 40 L24 24 L36 18 L48 22 L58 34 L56 50 L42 58 L26 54 L18 40 Z" fill="#d97706"/>' +
          '<circle cx="40" cy="40" r="13" fill="#fde68a"/>' +
          '<circle cx="35" cy="38" r="2.2" fill="#111"/><circle cx="45" cy="38" r="2.2" fill="#111"/>' +
          '<path d="M34 46 Q40 50 46 46" stroke="#92400e" stroke-width="2.2" fill="none"/>' +
          '<path d="M28 22 L32 12 L36 20" fill="#fbbf24"/>',
        "#fbbf24"
      );
    },
    "lion-peak": function () {
      return livingShell(
        '<circle cx="40" cy="42" r="20" fill="#92400e"/>' +
          '<circle cx="40" cy="44" r="13" fill="#f59e0b"/>' +
          '<path d="M22 30 L30 18 L40 26 L50 16 L58 30" fill="#b45309"/>' +
          '<circle cx="35" cy="42" r="2.3" fill="#111"/><circle cx="45" cy="42" r="2.3" fill="#111"/>' +
          '<ellipse cx="40" cy="50" rx="4" ry="2.5" fill="#7c2d12"/>',
        "#fb923c"
      );
    },
    "cheetah-speed": function () {
      return livingShell(
        '<ellipse cx="42" cy="44" rx="20" ry="14" fill="#f59e0b"/>' +
          '<ellipse cx="28" cy="36" rx="10" ry="8" fill="#fbbf24"/>' +
          '<circle cx="24" cy="34" r="2" fill="#111"/><circle cx="30" cy="34" r="1.2" fill="#111"/>' +
          '<circle cx="36" cy="40" r="1.6" fill="#78350f"/><circle cx="46" cy="38" r="1.4" fill="#78350f"/>' +
          '<circle cx="50" cy="46" r="1.5" fill="#78350f"/><circle cx="40" cy="48" r="1.3" fill="#78350f"/>' +
          '<path d="M18 34 L12 28" stroke="#92400e" stroke-width="2"/>',
        "#fbbf24"
      );
    },
    "cheetah-night": function () {
      return livingShell(
        '<ellipse cx="42" cy="44" rx="20" ry="14" fill="#334155"/>' +
          '<ellipse cx="28" cy="36" rx="10" ry="8" fill="#64748b"/>' +
          '<circle cx="24" cy="34" r="2" fill="#fbbf24"/><circle cx="30" cy="34" r="1.2" fill="#fbbf24"/>' +
          '<circle cx="38" cy="42" r="1.5" fill="#0f172a"/><circle cx="48" cy="40" r="1.4" fill="#0f172a"/>' +
          '<circle cx="52" cy="48" r="1.3" fill="#0f172a"/>',
        "#94a3b8"
      );
    },
    "cheetah-arena": function () {
      return livingShell(
        '<ellipse cx="42" cy="44" rx="20" ry="14" fill="#ea580c"/>' +
          '<ellipse cx="28" cy="36" rx="10" ry="8" fill="#fdba74"/>' +
          '<circle cx="24" cy="34" r="2" fill="#111"/>' +
          '<path d="M34 40 L58 36" stroke="#7c2d12" stroke-width="2"/>' +
          '<circle cx="40" cy="46" r="1.5" fill="#7c2d12"/><circle cx="50" cy="44" r="1.5" fill="#7c2d12"/>' +
          '<text x="52" y="58" font-size="10" fill="#fff" font-family="Tajawal,sans-serif">⚡</text>',
        "#fb923c"
      );
    },
    "tiger-challenge": function () {
      return livingShell(
        '<ellipse cx="40" cy="44" rx="20" ry="16" fill="#f97316"/>' +
          '<path d="M28 30 Q40 22 52 30" fill="#fdba74"/>' +
          '<path d="M30 36 L34 48 M38 32 L40 52 M46 34 L50 48" stroke="#111" stroke-width="2.4"/>' +
          '<circle cx="33" cy="40" r="2.3" fill="#111"/><circle cx="47" cy="40" r="2.3" fill="#111"/>' +
          '<path d="M36 48 Q40 52 44 48" stroke="#7c2d12" stroke-width="2" fill="none"/>',
        "#fb923c"
      );
    },
    "tiger-shadow": function () {
      return livingShell(
        '<ellipse cx="40" cy="44" rx="20" ry="16" fill="#1f2937"/>' +
          '<path d="M28 30 Q40 22 52 30" fill="#4b5563"/>' +
          '<path d="M30 36 L34 48 M38 32 L40 52 M46 34 L50 48" stroke="#fbbf24" stroke-width="2.2"/>' +
          '<circle cx="33" cy="40" r="2.3" fill="#fbbf24"/><circle cx="47" cy="40" r="2.3" fill="#fbbf24"/>',
        "#fbbf24"
      );
    },
    "tiger-cup": function () {
      return livingShell(
        '<ellipse cx="40" cy="46" rx="18" ry="14" fill="#ea580c"/>' +
          '<path d="M30 34 L34 48 M40 30 L42 52 M48 34 L52 48" stroke="#111" stroke-width="2.2"/>' +
          '<path d="M28 24 H52 L48 34 H32 Z" fill="#fbbf24"/>' +
          '<rect x="36" y="18" width="8" height="8" rx="2" fill="#fde68a"/>' +
          '<circle cx="34" cy="42" r="2" fill="#111"/><circle cx="46" cy="42" r="2" fill="#111"/>',
        "#fbbf24"
      );
    },
    "knight-arab": function () {
      return livingShell(
        '<path d="M24 28 H56 V42 Q40 62 24 42 Z" fill="#0b5e56"/>' +
          '<circle cx="40" cy="24" r="10" fill="#fde68a"/>' +
          '<path d="M30 22 H50 V28 H30 Z" fill="#134e4a"/>' +
          '<path d="M52 36 L66 28 L64 34 L70 38 L62 40 L64 46 Z" fill="#cbd5e1"/>' +
          '<circle cx="36" cy="24" r="1.5" fill="#111"/><circle cx="44" cy="24" r="1.5" fill="#111"/>',
        "#34d399"
      );
    },
    "knight-gold": function () {
      return livingShell(
        '<path d="M24 28 H56 V42 Q40 62 24 42 Z" fill="#b45309"/>' +
          '<circle cx="40" cy="24" r="10" fill="#fde68a"/>' +
          '<path d="M26 34 H54 V48 Q40 58 26 48 Z" fill="#fbbf24"/>' +
          '<path d="M36 38 H44 V50 H36 Z" fill="#92400e"/>' +
          '<circle cx="36" cy="24" r="1.5" fill="#111"/><circle cx="44" cy="24" r="1.5" fill="#111"/>',
        "#fbbf24"
      );
    },
    "knight-duel": function () {
      return livingShell(
        '<path d="M24 28 H56 V42 Q40 62 24 42 Z" fill="#1d4ed8"/>' +
          '<circle cx="40" cy="24" r="10" fill="#93c5fd"/>' +
          '<path d="M18 40 L30 34 L28 42 Z" fill="#e2e8f0"/>' +
          '<path d="M50 34 L66 30 L62 38 L68 44 L58 42 Z" fill="#f8fafc"/>' +
          '<circle cx="36" cy="24" r="1.5" fill="#111"/><circle cx="44" cy="24" r="1.5" fill="#111"/>',
        "#60a5fa"
      );
    },
    "club-hilal": function () {
      return livingShell(
        '<circle cx="40" cy="40" r="22" fill="#1d4ed8"/>' +
          '<path d="M28 44 A14 14 0 1 1 40 26" fill="none" stroke="#fff" stroke-width="5"/>' +
          '<circle cx="48" cy="28" r="3" fill="#fbbf24"/>',
        "#60a5fa"
      );
    },
    "club-nasr": function () {
      return livingShell(
        '<circle cx="40" cy="40" r="22" fill="#fbbf24"/>' +
          '<polygon points="40,18 44,34 60,34 47,44 52,60 40,50 28,60 33,44 20,34 36,34" fill="#111"/>' +
          '<circle cx="40" cy="40" r="6" fill="#fff"/>',
        "#fde68a"
      );
    },
    "club-ittihad": function () {
      return livingShell(
        '<circle cx="40" cy="40" r="22" fill="#111"/>' +
          '<path d="M22 40 H58 M40 22 V58" stroke="#fbbf24" stroke-width="5"/>' +
          '<circle cx="40" cy="40" r="8" fill="#fff"/><text x="34" y="45" font-size="14" fill="#111" font-family="Tajawal,sans-serif">ا</text>',
        "#fbbf24"
      );
    },
    "club-ahly": function () {
      return livingShell(
        '<circle cx="40" cy="40" r="22" fill="#b91c1c"/>' +
          '<circle cx="40" cy="40" r="14" fill="#fff"/>' +
          '<circle cx="40" cy="40" r="8" fill="#b91c1c"/>' +
          '<path d="M40 26 L42 34 L50 34 L44 38 L46 46 L40 41 L34 46 L36 38 L30 34 L38 34 Z" fill="#fbbf24"/>',
        "#f87171"
      );
    },
    "club-zamalek": function () {
      return livingShell(
        '<circle cx="40" cy="40" r="22" fill="#fff" stroke="#111" stroke-width="3"/>' +
          '<path d="M22 40 H58 M40 22 V58" stroke="#b91c1c" stroke-width="5"/>' +
          '<circle cx="40" cy="40" r="7" fill="#111"/>',
        "#f87171"
      );
    },
    "club-madrid": function () {
      return livingShell(
        '<circle cx="40" cy="40" r="22" fill="#fff" stroke="#1e3a8a" stroke-width="3"/>' +
          '<path d="M28 48 Q40 20 52 48" fill="none" stroke="#1d4ed8" stroke-width="4"/>' +
          '<circle cx="40" cy="34" r="5" fill="#fbbf24"/>' +
          '<text x="33" y="52" font-size="11" fill="#1e3a8a" font-family="Tajawal,sans-serif">RM</text>',
        "#93c5fd"
      );
    },
    "club-liverpool": function () {
      return livingShell(
        '<circle cx="40" cy="40" r="22" fill="#b91c1c"/>' +
          '<path d="M26 46 C30 28 50 28 54 46 L48 50 L32 50 Z" fill="#fff"/>' +
          '<circle cx="40" cy="36" r="4" fill="#fbbf24"/>' +
          '<text x="30" y="58" font-size="10" fill="#fff" font-family="Tajawal,sans-serif">LFC</text>',
        "#f87171"
      );
    },
    "club-hilal-sd": function () {
      return livingShell(
        '<circle cx="40" cy="40" r="22" fill="#0369a1"/>' +
          '<path d="M30 46 A12 12 0 1 1 42 28" fill="none" stroke="#fff" stroke-width="5"/>' +
          '<path d="M48 24 L52 32 L60 32 L54 37 L56 45 L48 40 L40 45 L42 37 L36 32 L44 32 Z" fill="#fbbf24"/>',
        "#38bdf8"
      );
    }
  };

  // توافق خلفي
  var LEGACY = {
    a1: "falcon-island",
    a2: "falcon-golden",
    a3: "falcon-peregrine",
    a4: "knight-arab",
    a5: "tiger-challenge",
    a6: "cheetah-speed",
    a7: "club-hilal",
    a8: "lion-king",
    a9: "cheetah-arena",
    a10: "lion-peak",
    a11: "tiger-shadow",
    a12: "knight-gold"
  };

  function resolveId(id) {
    id = String(id || "falcon-island");
    if (LEGACY[id]) return LEGACY[id];
    if (AVATAR_SVG[id]) return id;
    return "falcon-island";
  }

  function svgAvatar(id) {
    var key = resolveId(id);
    return (AVATAR_SVG[key] || AVATAR_SVG["falcon-island"])();
  }

  function setAvatar(id, targets) {
    var html = svgAvatar(id);
    var list = targets || ["player-avatar-preview", "settings-avatar-chip"];
    list.forEach(function (tid) {
      var node = document.getElementById(tid);
      if (node) node.innerHTML = html;
    });
  }

  function renderAvatarGrid(activeId, avatars, categories) {
    var host = document.getElementById("avatar-grid");
    var tabs = document.getElementById("avatar-cats");
    if (!host) return;
    activeId = resolveId(activeId);
    var cats =
      categories && categories.length
        ? categories
        : [
            {
              id: "all",
              label: "الكل",
              items: (avatars || []).map(function (a) {
                return a;
              })
            }
          ];
    if (!cats.some(function (c) {
      return c.id === activeCategory;
    })) {
      activeCategory = cats[0].id;
    }
    if (tabs) {
      tabs.innerHTML = cats
        .map(function (c) {
          return (
            '<button type="button" class="avatar-cat' +
            (c.id === activeCategory ? " is-active" : "") +
            '" data-cat="' +
            c.id +
            '">' +
            (c.label || c.id) +
            "</button>"
          );
        })
        .join("");
      tabs.onclick = function (event) {
        var btn = event.target.closest("[data-cat]");
        if (!btn) return;
        activeCategory = btn.getAttribute("data-cat");
        renderAvatarGrid(activeId, avatars, categories);
      };
    }
    var cat = cats.filter(function (c) {
      return c.id === activeCategory;
    })[0] || cats[0];
    var list = (cat && cat.items) || avatars || [];
    host.innerHTML = list
      .map(function (row) {
        var id = resolveId(row.id || "falcon-island");
        return (
          '<button type="button" class="avatar-pick' +
          (id === activeId ? " is-active" : "") +
          '" data-avatar="' +
          id +
          '" title="' +
          (row.label || id) +
          '">' +
          svgAvatar(id) +
          "<span>" +
          (row.label || id) +
          "</span></button>"
        );
      })
      .join("");
    host.onclick = function (event) {
      var btn = event.target.closest("[data-avatar]");
      if (!btn) return;
      Array.prototype.forEach.call(host.querySelectorAll(".avatar-pick"), function (el) {
        el.classList.toggle("is-active", el === btn);
      });
      setAvatar(btn.getAttribute("data-avatar"));
    };
  }

  function themeWaveColors(theme) {
    if (theme === "neon") {
      return {
        a: "rgba(34,211,238,0.22)",
        b: "rgba(168,85,247,0.18)",
        c: "rgba(56,189,248,0.14)",
        base: "rgba(15,23,42,0.35)"
      };
    }
    if (theme === "day") {
      return {
        a: "rgba(14,165,233,0.14)",
        b: "rgba(16,185,129,0.12)",
        c: "rgba(148,163,184,0.12)",
        base: "rgba(248,250,252,0.25)"
      };
    }
    return {
      a: "rgba(11,94,86,0.16)",
      b: "rgba(52,211,153,0.12)",
      c: "rgba(14,165,233,0.10)",
      base: "rgba(232,242,239,0.2)"
    };
  }

  function setTheme(theme) {
    theme = theme || "royal";
    waveState.theme = theme;
    document.body.classList.remove("theme-neon", "theme-royal", "theme-day");
    document.body.classList.add("theme-" + theme);
    Array.prototype.forEach.call(document.querySelectorAll(".theme-switch [data-theme]"), function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-theme") === theme);
    });
  }

  function bootWaveMesh() {
    var canvas = document.getElementById("portal-particles");
    if (!canvas || canvas._wave) return;
    canvas._wave = true;
    var ctx = canvas.getContext("2d");
    function resize() {
      canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
      canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function drawWave(yBase, amp, len, speed, color, phase) {
      var w = window.innerWidth;
      var h = window.innerHeight;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (var x = 0; x <= w; x += 8) {
        var y =
          yBase +
          Math.sin((x / len) * Math.PI * 2 + waveState.t * speed + phase) * amp +
          Math.cos((x / (len * 1.4)) * Math.PI * 2 + waveState.t * (speed * 0.7)) * (amp * 0.35);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    function tick() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      var colors = themeWaveColors(waveState.theme);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colors.base;
      ctx.fillRect(0, 0, w, h);
      drawWave(h * 0.42, 28, 520, 0.6, colors.a, 0.2);
      drawWave(h * 0.55, 36, 640, 0.45, colors.b, 1.1);
      drawWave(h * 0.68, 42, 720, 0.35, colors.c, 2.2);
      waveState.t += 0.012;
      waveState.raf = requestAnimationFrame(tick);
    }
    tick();
  }

  function confetti() {
    var canvas = document.getElementById("portal-confetti");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var pieces = Array.from({ length: 90 }).map(function () {
      return {
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.3,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        vy: 2 + Math.random() * 4,
        vx: -2 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: -0.2 + Math.random() * 0.4,
        color: ["#fbbf24", "#34d399", "#38bdf8", "#f472b6", "#a78bfa"][Math.floor(Math.random() * 5)]
      };
    });
    var frames = 0;
    function tick() {
      frames += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (frames < 90) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    tick();
  }

  function boot() {
    bootWaveMesh();
    setTheme("royal");
    setAvatar("falcon-island");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.PortalStudentFx = {
    setAvatar: setAvatar,
    renderAvatarGrid: renderAvatarGrid,
    setTheme: setTheme,
    confetti: confetti,
    svgAvatar: svgAvatar,
    resolveId: resolveId
  };
})();
