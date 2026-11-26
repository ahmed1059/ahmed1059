/* ألعاب الميدان: تواجد حي، مبارزة مباشرة، كلمات، حساب ذهني، سبورة المسودة */
(function () {
  "use strict";

  var api = null;
  var presenceTimer = null;
  var inboxTimer = null;
  var live = {
    duelId: "",
    questions: [],
    index: 0,
    answers: {},
    correct: 0,
    secondsLeft: 60,
    timer: null,
    poll: null,
    you: "",
    challenger: "",
    opponent: ""
  };
  var words = { rounds: [], index: 0, answers: [], combo: 0, best: 0, timer: null, left: 60, started: 0 };
  var mental = { items: [], index: 0, answers: [], level: 1, mode: "solo", timer: null, left: 60, started: 0 };
  var scratch = { ink: "#111827", erasing: false, drawing: false, expanded: false };

  function el(id) {
    return document.getElementById(id);
  }

  function pingPresence() {
    if (!api) return;
    api.fetchJson("/api/portal/presence/ping", { method: "POST", headers: api.authHeaders(), body: "{}" }).catch(function () {});
  }

  function paintOnline(pack) {
    var host = el("online-list");
    if (!host) return;
    var rows = (pack && pack.online) || [];
    if (!rows.length) {
      host.innerHTML = "<p class=\"portal-empty\">لا زملاء متصلين الآن — ابقَ هنا وسيظهر الرادار فور دخول أحدهم.</p>";
      return;
    }
    host.innerHTML = rows
      .map(function (row) {
        return (
          "<div class=\"online-chip\">" +
          "<span class=\"dot-live\" aria-hidden=\"true\"></span>" +
          "<span>" +
          api.escapeHtml(row.name || "زميل") +
          " · " +
          api.escapeHtml(row.grade || "") +
          "/" +
          api.toEastern(row.section || "") +
          "</span>" +
          "<button type=\"button\" class=\"portal-btn\" data-challenge=\"" +
          api.escapeHtml(row.national_id || "") +
          "\">⚔️ تحدَّ الآن</button></div>"
        );
      })
      .join("");
  }

  function paintInbox(pack) {
    var host = el("duel-inbox");
    if (!host) return;
    var items = ((pack && pack.items) || []).filter(function (row) {
      return row.incoming || (row.status === "pending" && row.role === "opponent");
    });
    if (!items.length) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = items
      .map(function (row) {
        var id = row.duel_id || row.id || "";
        return (
          "<div class=\"duel-invite\">" +
          "<strong>دعوة مبارزة من " +
          api.escapeHtml(row.other_name || row.challenger_name || "زميل") +
          "</strong>" +
          "<div class=\"portal-actions\">" +
          "<button type=\"button\" class=\"portal-btn\" data-duel-accept=\"" +
          api.escapeHtml(id) +
          "\">قبول</button>" +
          "<button type=\"button\" class=\"portal-btn secondary\" data-duel-reject=\"" +
          api.escapeHtml(id) +
          "\">رفض</button></div></div>"
        );
      })
      .join("");
  }

  function refreshPresence() {
    if (!api) return;
    pingPresence();
    api
      .fetchJson("/api/portal/presence/online", { headers: api.authHeaders(), cache: "no-store" })
      .then(paintOnline)
      .catch(function () {});
    api
      .fetchJson("/api/portal/live-duel/inbox", { headers: api.authHeaders(), cache: "no-store" })
      .then(paintInbox)
      .catch(function () {});
  }

  function stopLiveTimers() {
    if (live.timer) clearInterval(live.timer);
    if (live.poll) clearInterval(live.poll);
    live.timer = null;
    live.poll = null;
  }

  function updateLiveRails(progress, youNid, challenger, opponent) {
    var you = progress[youNid] || { answered: 0 };
    var otherNid = youNid === challenger ? opponent : challenger;
    var other = progress[otherNid] || { answered: 0 };
    var youPct = Math.min(100, Math.round((Number(you.answered || 0) / 5) * 100));
    var otherPct = Math.min(100, Math.round((Number(other.answered || 0) / 5) * 100));
    var rails = el("duel-rails");
    if (rails) rails.hidden = false;
    if (el("duel-you-bar")) el("duel-you-bar").style.width = youPct + "%";
    if (el("duel-ghost-bar")) el("duel-ghost-bar").style.width = otherPct + "%";
    if (el("duel-you-label")) el("duel-you-label").textContent = api.toEastern(youPct) + "٪";
    if (el("duel-ghost-label")) el("duel-ghost-label").textContent = api.toEastern(otherPct) + "٪";
    if (el("duel-ghost-name")) el("duel-ghost-name").textContent = "المنافس";
  }

  function paintLiveQuestion() {
    var q = live.questions[live.index];
    var stage = el("arena-stage");
    var hub = el("arena-hub");
    if (!q || !stage) return;
    if (hub) hub.style.display = "none";
    stage.classList.add("is-open");
    el("arena-title").textContent = "مبارزة مباشرة";
    el("arena-progress").textContent =
      "سؤال " + api.toEastern(live.index + 1) + " من " + api.toEastern(live.questions.length);
    var html =
      "<p class=\"q-stem\">" +
      api.escapeHtml(q.stem || "") +
      "</p><div class=\"q-choices\">";
    ["A", "B", "C", "D"].forEach(function (letter) {
      var selected = live.answers[q.id] === letter;
      html +=
        "<button type=\"button\" class=\"q-choice" +
        (selected ? " is-selected" : "") +
        "\" data-live-choice=\"" +
        letter +
        "\"><span class=\"letter\">" +
        ({ A: "أ", B: "ب", C: "ج", D: "د" }[letter] || letter) +
        "</span>" +
        api.escapeHtml((q.choices && q.choices[letter]) || "") +
        "</button>";
    });
    html += "</div>";
    el("q-box").innerHTML = html;
    if (window.PortalStudentGames) {
      window.PortalStudentGames.onQuestionPainted(q, String(q.domain || "") === "math");
    }
  }

  function reportLiveProgress() {
    if (!live.duelId) return;
    var answerRows = Object.keys(live.answers).map(function (id) {
      return { id: id, choice: live.answers[id] };
    });
    api
      .fetchJson("/api/portal/live-duel/action", {
        method: "POST",
        headers: api.authHeaders(),
        body: JSON.stringify({
          duel_id: live.duelId,
          action: "progress",
          answered: answerRows.length,
          answers: answerRows
        })
      })
      .then(function (pack) {
        updateLiveRails(pack.progress || {}, live.you, live.challenger, live.opponent);
        if (pack.status === "finished") {
          stopLiveTimers();
          var win = pack.winner === live.you;
          api.status(
            win
              ? "فزت بالمبارزة · +٥٠ XP ولقب بطل الجولة!"
              : pack.winner
                ? "انتهت المبارزة — حاول مرة أخرى."
                : "تعادل شريف!"
          );
          if (api.refresh) api.refresh();
        }
      })
      .catch(function () {});
  }

  function enterLiveDuel(pack) {
    stopLiveTimers();
    live.duelId = pack.duel_id;
    live.questions = pack.questions || [];
    live.index = 0;
    live.answers = {};
    live.correct = 0;
    live.secondsLeft = Number(pack.seconds || 60);
    live.you = pack.you || "";
    live.challenger = pack.challenger || "";
    live.opponent = pack.opponent || "";
    el("national-map").hidden = true;
    updateLiveRails(pack.progress || {}, live.you, live.challenger, live.opponent);
    paintLiveQuestion();
    live.timer = setInterval(function () {
      live.secondsLeft -= 1;
      var t = el("arena-timer");
      if (t) {
        var m = Math.max(0, Math.floor(live.secondsLeft / 60));
        var s = Math.max(0, live.secondsLeft % 60);
        t.textContent = api.toEastern(m) + ":" + api.toEastern(String(s).padStart(2, "0"));
      }
      if (live.secondsLeft <= 0) {
        reportLiveProgress();
        stopLiveTimers();
      }
    }, 1000);
    live.poll = setInterval(function () {
      api
        .fetchJson("/api/portal/live-duel/" + encodeURIComponent(live.duelId), {
          headers: api.authHeaders(),
          cache: "no-store"
        })
        .then(function (p) {
          live.you = p.you || live.you;
          live.challenger = p.challenger || live.challenger;
          live.opponent = p.opponent || live.opponent;
          updateLiveRails(p.progress || {}, live.you, live.challenger, live.opponent);
        })
        .catch(function () {});
    }, 1500);
  }

  function challengeNow(nid) {
    api.status("جارٍ إرسال التحدي…");
    api
      .fetchJson("/api/portal/live-duel/challenge", {
        method: "POST",
        headers: api.authHeaders(),
        body: JSON.stringify({ opponent_nid: nid })
      })
      .then(function (pack) {
        api.status("أُرسل التحدي — بانتظار القبول خلال ثوانٍ.");
        var watch = setInterval(function () {
          api
            .fetchJson("/api/portal/live-duel/" + encodeURIComponent(pack.duel_id), {
              headers: api.authHeaders(),
              cache: "no-store"
            })
            .then(function (p) {
              if (p.status === "active") {
                clearInterval(watch);
                enterLiveDuel(p);
              } else if (p.status === "rejected") {
                clearInterval(watch);
                api.status("رفض الخصم التحدي.", true);
              }
            })
            .catch(function () {});
        }, 1200);
        setTimeout(function () {
          clearInterval(watch);
        }, 45000);
      })
      .catch(function (err) {
        api.status(err.message || "تعذر إرسال التحدي.", true);
      });
  }

  function duelAction(id, action) {
    api
      .fetchJson("/api/portal/live-duel/action", {
        method: "POST",
        headers: api.authHeaders(),
        body: JSON.stringify({ duel_id: id, action: action })
      })
      .then(function (pack) {
        if (action === "accept" && pack.status === "active") {
          api
            .fetchJson("/api/portal/live-duel/" + encodeURIComponent(id), {
              headers: api.authHeaders(),
              cache: "no-store"
            })
            .then(enterLiveDuel);
        } else {
          refreshPresence();
        }
      })
      .catch(function (err) {
        api.status(err.message || "تعذر تنفيذ الإجراء.", true);
      });
  }

  function stageHost() {
    return el("mini-game-stage");
  }

  function paintWords() {
    var host = stageHost();
    var r = words.rounds[words.index];
    if (!host || !r) return;
    host.hidden = false;
    var kindClass = r.kind === "synonym" ? "kind-syn" : r.kind === "antonym" ? "kind-ant" : "kind-mean";
    host.innerHTML =
      "<div class=\"mini-hud\"><strong>لعبة الكلمات</strong><span>Combo ×" +
      api.toEastern(words.combo) +
      "</span><span>" +
      api.toEastern(words.left) +
      " ث</span></div>" +
      "<div class=\"word-card " +
      kindClass +
      "\"><em>" +
      api.escapeHtml(r.kind_ar || "") +
      "</em><p>" +
      api.escapeHtml(r.prompt || "") +
      "</p></div><div class=\"q-choices\">" +
      ["A", "B", "C", "D"]
        .map(function (letter) {
          return (
            "<button type=\"button\" class=\"q-choice\" data-word-choice=\"" +
            letter +
            "\"><span class=\"letter\">" +
            ({ A: "أ", B: "ب", C: "ج", D: "د" }[letter] || letter) +
            "</span>" +
            api.escapeHtml((r.choices && r.choices[letter]) || "") +
            "</button>"
          );
        })
        .join("") +
      "</div>";
  }

  function finishWords() {
    if (words.timer) clearInterval(words.timer);
    words.timer = null;
    api
      .fetchJson("/api/portal/games/words/finish", {
        method: "POST",
        headers: api.authHeaders(),
        body: JSON.stringify({
          answers: words.answers,
          combo_best: words.best,
          elapsed_sec: (Date.now() - words.started) / 1000
        })
      })
      .then(function (pack) {
        stageHost().innerHTML =
          "<p class=\"portal-empty\">انتهت لعبة الكلمات · " +
          api.toEastern(pack.score || 0) +
          " / ١٠ · +" +
          api.toEastern(pack.xp_earned || 0) +
          " XP</p>";
        if (api.refresh) api.refresh();
      })
      .catch(function (err) {
        api.status(err.message || "تعذر حفظ النتيجة.", true);
      });
  }

  function startWords() {
    api
      .fetchJson("/api/portal/games/words/start", { headers: api.authHeaders(), cache: "no-store" })
      .then(function (pack) {
        words.rounds = pack.rounds || [];
        words.index = 0;
        words.answers = [];
        words.combo = 0;
        words.best = 0;
        words.left = Number(pack.seconds || 60);
        words.started = Date.now();
        if (words.timer) clearInterval(words.timer);
        words.timer = setInterval(function () {
          words.left -= 1;
          paintWords();
          if (words.left <= 0) finishWords();
        }, 1000);
        paintWords();
      })
      .catch(function (err) {
        api.status(err.message || "تعذر بدء لعبة الكلمات.", true);
      });
  }

  function paintMental() {
    var host = stageHost();
    var item = mental.items[mental.index];
    if (!host || !item) return;
    host.hidden = false;
    host.innerHTML =
      "<div class=\"mini-hud\"><strong>حساب ذهني · مستوى " +
      api.toEastern(mental.level) +
      "</strong><span>" +
      api.toEastern(mental.left) +
      " ث</span></div>" +
      "<p class=\"q-stem mental-stem\">" +
      api.escapeHtml(item.stem || "") +
      "</p><div class=\"q-choices\">" +
      ["A", "B", "C", "D"]
        .map(function (letter) {
          return (
            "<button type=\"button\" class=\"q-choice\" data-mental-choice=\"" +
            letter +
            "\"><span class=\"letter\">" +
            ({ A: "أ", B: "ب", C: "ج", D: "د" }[letter] || letter) +
            "</span>" +
            api.escapeHtml((item.choices && item.choices[letter]) || "") +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      "<div class=\"portal-actions\" style=\"margin-top:10px;\">" +
      "<button type=\"button\" class=\"portal-btn secondary\" data-mental-level=\"1\">مستوى ١</button>" +
      "<button type=\"button\" class=\"portal-btn secondary\" data-mental-level=\"3\">مستوى ٣</button>" +
      "<button type=\"button\" class=\"portal-btn secondary\" data-mental-level=\"5\">مستوى ٥</button>" +
      "<button type=\"button\" class=\"portal-btn secondary\" data-mental-mode=\"tournament\">بطولة فصول</button>" +
      "</div>";
  }

  function finishMental() {
    if (mental.timer) clearInterval(mental.timer);
    mental.timer = null;
    api
      .fetchJson("/api/portal/games/mental/finish", {
        method: "POST",
        headers: api.authHeaders(),
        body: JSON.stringify({
          mode: mental.mode,
          level: mental.level,
          answers: mental.answers,
          elapsed_sec: (Date.now() - mental.started) / 1000
        })
      })
      .then(function (pack) {
        stageHost().innerHTML =
          "<p class=\"portal-empty\">انتهى الحساب الذهني · " +
          api.toEastern(pack.score || 0) +
          " صحيحة · +" +
          api.toEastern(pack.xp_earned || 0) +
          " XP</p>";
        if (api.refresh) api.refresh();
      })
      .catch(function (err) {
        api.status(err.message || "تعذر حفظ النتيجة.", true);
      });
  }

  function startMental(level, mode) {
    mental.level = Number(level || 1);
    mental.mode = mode || "solo";
    api
      .fetchJson(
        "/api/portal/games/mental/start?level=" +
          encodeURIComponent(mental.level) +
          "&count=10",
        { headers: api.authHeaders(), cache: "no-store" }
      )
      .then(function (pack) {
        mental.items = pack.items || [];
        mental.index = 0;
        mental.answers = [];
        mental.left = Number(pack.seconds || 60);
        mental.started = Date.now();
        if (mental.timer) clearInterval(mental.timer);
        mental.timer = setInterval(function () {
          mental.left -= 1;
          paintMental();
          if (mental.left <= 0) finishMental();
        }, 1000);
        paintMental();
      })
      .catch(function (err) {
        api.status(err.message || "تعذر بدء الحساب الذهني.", true);
      });
  }

  function pointerPos(canvas, event) {
    var rect = canvas.getBoundingClientRect();
    var src = event.touches && event.touches[0] ? event.touches[0] : event;
    return {
      x: ((src.clientX - rect.left) / rect.width) * canvas.width,
      y: ((src.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function bindScratch() {
    var canvas = el("scratch-canvas");
    var dock = el("scratch-dock");
    if (!canvas || !dock || canvas._bound) return;
    canvas._bound = true;
    var ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;

    function startDraw(event) {
      scratch.drawing = true;
      var p = pointerPos(canvas, event);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      event.preventDefault();
    }
    function moveDraw(event) {
      if (!scratch.drawing) return;
      var p = pointerPos(canvas, event);
      ctx.strokeStyle = scratch.erasing ? "#ffffff" : scratch.ink;
      ctx.lineWidth = scratch.erasing ? 16 : 3;
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      event.preventDefault();
    }
    function endDraw() {
      scratch.drawing = false;
    }

    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", moveDraw);
    canvas.addEventListener("mouseup", endDraw);
    canvas.addEventListener("mouseleave", endDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", moveDraw, { passive: false });
    canvas.addEventListener("touchend", endDraw);

    dock.addEventListener("click", function (event) {
      var inkBtn = event.target.closest("[data-ink]");
      if (inkBtn) {
        scratch.ink = inkBtn.getAttribute("data-ink");
        scratch.erasing = false;
      }
      if (event.target.id === "scratch-erase") scratch.erasing = true;
      if (event.target.id === "scratch-clear") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      if (event.target.id === "scratch-expand") {
        scratch.expanded = !scratch.expanded;
        dock.classList.toggle("is-expanded", scratch.expanded);
        event.target.textContent = scratch.expanded ? "تصغير" : "تكبير";
      }
      if (event.target.id === "scratch-close") {
        dock.hidden = true;
        dock.classList.remove("is-expanded");
        scratch.expanded = false;
      }
    });
  }

  function onQuestionPainted(q, isMath) {
    var dock = el("scratch-dock");
    if (dock) dock.hidden = true;
    var open = el("scratch-open");
    if (open) {
      open.onclick = function () {
        if (!dock) return;
        dock.hidden = false;
        bindScratch();
      };
    }
  }

  function bindUi() {
    var online = el("online-list");
    if (online) {
      online.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-challenge]");
        if (btn) challengeNow(btn.getAttribute("data-challenge"));
      });
    }
    var inbox = el("duel-inbox");
    if (inbox) {
      inbox.addEventListener("click", function (event) {
        var accept = event.target.closest("[data-duel-accept]");
        var reject = event.target.closest("[data-duel-reject]");
        if (accept) duelAction(accept.getAttribute("data-duel-accept"), "accept");
        if (reject) duelAction(reject.getAttribute("data-duel-reject"), "reject");
      });
    }
    var wordsBtn = el("btn-words");
    if (wordsBtn) wordsBtn.addEventListener("click", startWords);
    var mentalBtn = el("btn-mental");
    if (mentalBtn) mentalBtn.addEventListener("click", function () {
      startMental(1, "solo");
    });
    var stage = stageHost();
    if (stage) {
      stage.addEventListener("click", function (event) {
        var wc = event.target.closest("[data-word-choice]");
        if (wc) {
          var r = words.rounds[words.index];
          var choice = wc.getAttribute("data-word-choice");
          var ok = r && choice === r.correct;
          words.answers.push({ id: r.id, choice: choice, ok: !!ok });
          words.combo = ok ? words.combo + 1 : 0;
          if (words.combo > words.best) words.best = words.combo;
          words.index += 1;
          if (words.index >= words.rounds.length) finishWords();
          else paintWords();
          return;
        }
        var mc = event.target.closest("[data-mental-choice]");
        if (mc) {
          var item = mental.items[mental.index];
          var ch = mc.getAttribute("data-mental-choice");
          var good = item && ch === item.correct;
          mental.answers.push({ id: item.id, choice: ch, ok: !!good });
          mental.index += 1;
          if (mental.index >= mental.items.length) finishMental();
          else paintMental();
          return;
        }
        var lvl = event.target.closest("[data-mental-level]");
        if (lvl) {
          startMental(lvl.getAttribute("data-mental-level"), mental.mode);
          return;
        }
        var modeBtn = event.target.closest("[data-mental-mode]");
        if (modeBtn) {
          startMental(mental.level, modeBtn.getAttribute("data-mental-mode"));
        }
      });
    }
    var qBox = el("q-box");
    if (qBox) {
      qBox.addEventListener("click", function (event) {
        var liveChoice = event.target.closest("[data-live-choice]");
        if (!liveChoice || !live.questions.length) return;
        var q = live.questions[live.index];
        if (!q) return;
        live.answers[q.id] = liveChoice.getAttribute("data-live-choice");
        live.index += 1;
        if (live.index >= live.questions.length) {
          reportLiveProgress();
          el("q-box").innerHTML = "<p class=\"portal-empty\">أنهيت أسئلتك — بانتظار المنافس أو النتيجة…</p>";
        } else {
          paintLiveQuestion();
          reportLiveProgress();
        }
      });
    }
    var next = el("arena-next");
    if (next) {
      next.addEventListener("click", function () {
        if (!live.questions.length) return;
        if (live.index < live.questions.length - 1) {
          live.index += 1;
          paintLiveQuestion();
        } else {
          reportLiveProgress();
        }
      });
    }
  }

  function boot(helpers) {
    api = helpers;
    bindUi();
    bindScratch();
    refreshPresence();
    if (presenceTimer) clearInterval(presenceTimer);
    if (inboxTimer) clearInterval(inboxTimer);
    presenceTimer = setInterval(refreshPresence, 8000);
  }

  window.PortalStudentGames = {
    boot: boot,
    refreshPresence: refreshPresence,
    onQuestionPainted: onQuestionPainted
  };
})();
