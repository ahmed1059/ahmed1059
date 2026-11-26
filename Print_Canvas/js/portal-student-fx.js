/* مؤثرات ميدان الطالب: صور رمزية SVG + جسيمات + ثيمات + Confetti */
(function () {
  "use strict";

  var AVATAR_PALETTES = {
    a1: ["#0b5e56", "#34d399"],
    a2: ["#a16207", "#fbbf24"],
    a3: ["#1d4ed8", "#93c5fd"],
    a4: ["#7c2d12", "#fdba74"],
    a5: ["#9f1239", "#fb7185"],
    a6: ["#0e7490", "#67e8f9"],
    a7: ["#334155", "#cbd5e1"],
    a8: ["#854d0e", "#fde68a"],
    a9: ["#075985", "#38bdf8"],
    a10: ["#14532d", "#86efac"],
    a11: ["#5b21b6", "#c4b5fd"],
    a12: ["#713f12", "#f59e0b"]
  };

  var particleState = { raf: 0, dots: [], theme: "royal" };

  function svgAvatar(id) {
    var colors = AVATAR_PALETTES[id] || AVATAR_PALETTES.a1;
    var shapes = {
      a1: '<path d="M32 10 L52 22 L52 42 L32 54 L12 42 L12 22 Z" fill="' + colors[0] + '"/><circle cx="32" cy="30" r="8" fill="' + colors[1] + '"/>',
      a2: '<polygon points="32,8 38,24 56,24 42,34 48,50 32,40 16,50 22,34 8,24 26,24" fill="' + colors[1] + '" stroke="' + colors[0] + '" stroke-width="2"/>',
      a3: '<path d="M12 40 Q32 8 52 40 Z" fill="' + colors[0] + '"/><circle cx="40" cy="28" r="4" fill="' + colors[1] + '"/>',
      a4: '<path d="M16 18 H48 V34 Q32 52 16 34 Z" fill="' + colors[0] + '"/><path d="M24 26 H40 V34 Q32 42 24 34 Z" fill="' + colors[1] + '"/>',
      a5: '<path d="M28 8 L36 8 L34 28 L46 28 L22 56 L28 34 L16 34 Z" fill="' + colors[1] + '" stroke="' + colors[0] + '"/>',
      a6: '<circle cx="32" cy="32" r="20" fill="none" stroke="' + colors[0] + '" stroke-width="4"/><circle cx="32" cy="32" r="4" fill="' + colors[1] + '"/><path d="M32 32 L48 20" stroke="' + colors[1] + '" stroke-width="3"/>',
      a7: '<path d="M16 40 A16 16 0 1 1 48 40" fill="none" stroke="' + colors[1] + '" stroke-width="6"/><circle cx="32" cy="40" r="6" fill="' + colors[0] + '"/>',
      a8: '<circle cx="32" cy="22" r="10" fill="' + colors[1] + '"/><rect x="28" y="30" width="8" height="22" rx="2" fill="' + colors[0] + '"/>',
      a9: '<path d="M8 36 Q20 16 32 36 Q44 16 56 36" fill="none" stroke="' + colors[0] + '" stroke-width="5"/><circle cx="32" cy="40" r="6" fill="' + colors[1] + '"/>',
      a10: '<path d="M8 48 L20 20 L32 36 L44 14 L56 48 Z" fill="' + colors[0] + '"/><path d="M20 48 L32 28 L44 48" fill="' + colors[1] + '"/>',
      a11: '<path d="M30 8 L34 8 L36 28 L50 30 L36 34 L34 56 L30 56 L28 34 L14 30 L28 28 Z" fill="' + colors[1] + '"/>',
      a12: '<path d="M12 22 L20 14 L32 20 L44 14 L52 22 L46 28 L48 40 L16 40 L18 28 Z" fill="' + colors[1] + '" stroke="' + colors[0] + '" stroke-width="2"/>'
    };
    return (
      '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect width="64" height="64" rx="14" fill="#0f172a22"/>' +
      (shapes[id] || shapes.a1) +
      "</svg>"
    );
  }

  function setAvatar(id) {
    var preview = document.getElementById("player-avatar-preview");
    if (preview) preview.innerHTML = svgAvatar(id || "a1");
  }

  function renderAvatarGrid(activeId, avatars) {
    var host = document.getElementById("avatar-grid");
    if (!host) return;
    var list = avatars && avatars.length ? avatars : Object.keys(AVATAR_PALETTES).map(function (id) {
      return { id: id };
    });
    host.innerHTML = list
      .map(function (row) {
        var id = row.id || "a1";
        return (
          '<button type="button" class="avatar-pick' +
          (id === activeId ? " is-active" : "") +
          '" data-avatar="' +
          id +
          '" title="' +
          (row.label || id) +
          '">' +
          svgAvatar(id) +
          "</button>"
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

  function setTheme(theme) {
    theme = theme || "royal";
    particleState.theme = theme;
    document.body.classList.remove("theme-neon", "theme-royal", "theme-day");
    document.body.classList.add("theme-" + theme);
    Array.prototype.forEach.call(document.querySelectorAll(".theme-switch [data-theme]"), function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-theme") === theme);
    });
  }

  function bootParticles() {
    var canvas = document.getElementById("portal-particles");
    if (!canvas || canvas._fx) return;
    canvas._fx = true;
    var ctx = canvas.getContext("2d");
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);
    particleState.dots = Array.from({ length: 42 }).map(function () {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 1.2 + Math.random() * 2.4,
        vx: -0.35 + Math.random() * 0.7,
        vy: -0.25 + Math.random() * 0.5
      };
    });
    function color() {
      if (particleState.theme === "neon") return "rgba(103,232,249,0.55)";
      if (particleState.theme === "day") return "rgba(15,118,110,0.28)";
      return "rgba(11,94,86,0.35)";
    }
    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color();
      particleState.dots.forEach(function (d) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0) d.x = canvas.width;
        if (d.x > canvas.width) d.x = 0;
        if (d.y < 0) d.y = canvas.height;
        if (d.y > canvas.height) d.y = 0;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      });
      particleState.raf = requestAnimationFrame(tick);
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
    bootParticles();
    setTheme("royal");
    setAvatar("a1");
    renderAvatarGrid("a1");
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
    svgAvatar: svgAvatar
  };
})();
