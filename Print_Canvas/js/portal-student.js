/* بوابة الطالب — ميدان نافس التفاعلي */
(function () {
  "use strict";

  var TOKEN_KEY = "portalSession";
  var CHOICE_AR = { A: "أ", B: "ب", C: "ج", D: "د" };
  var EASTERN = "٠١٢٣٤٥٦٧٨٩";
  var state = {
    token: "",
    home: null,
    boards: null,
    run: null,
    index: 0,
    answers: {},
    timer: null,
    secondsLeft: 0,
    streak: 0,
    questionStartedAt: 0,
    boardTab: "day",
    duelPoll: null,
    runStartedAt: 0,
    mainTab: "play",
    trapDoor: "math",
    trapAlbum: null,
    golden: null,
    checked: {},
    rescueActive: null
  };

  var RANK_TIERS = [
    { min: 0, title: "فارس مبتدئ", next: 50 },
    { min: 50, title: "فارس نشط", next: 150 },
    { min: 150, title: "بطل الأسبوع", next: 350 },
    { min: 350, title: "نخبة الصف", next: 700 },
    { min: 700, title: "أسطورة نافس", next: 1200 }
  ];

  function toEastern(text) {
    return String(text == null ? "" : text)
      .replace(/[0-9]/g, function (d) {
        return EASTERN.charAt(Number(d));
      })
      .replace(/%/g, "٪");
  }

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderArabicMath(raw) {
    var source = String(raw == null ? "" : raw);
    if (!source) {
      return "";
    }
    var tokens = [];
    function keep(html) {
      tokens.push(html);
      return "\uE000" + (tokens.length - 1) + "\uE001";
    }
    var text = source;
    text = text.replace(/(^|[^\w⁰¹²³⁴⁵⁶⁷⁸⁹٠-٩])([0-9٠-٩]+)\s*\/\s*([0-9٠-٩]+)(?!\w)/g, function (_m, lead, num, den) {
      return (
        lead +
        keep(
          '<span class="frac"><span class="num">' +
            toEastern(num) +
            '</span><span class="den">' +
            toEastern(den) +
            "</span></span>"
        )
      );
    });
    text = text.replace(/([0-9٠-٩أ-يA-Za-zسصقع])\^([0-9٠-٩]+)/g, function (_m, base, exp) {
      return keep(toEastern(base) + "<sup>" + toEastern(exp) + "</sup>");
    });
    text = text.replace(/([0-9٠-٩أ-يA-Za-zس])([²³⁴⁵⁶⁷⁸⁹⁰¹])/g, function (_m, base, exp) {
      var map = { "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁰": "0" };
      return keep(toEastern(base) + "<sup>" + toEastern(map[exp] || exp) + "</sup>");
    });
    text = text.replace(/\uE000\d+\uE001|[^\uE000]+/g, function (part) {
      if (part.charAt(0) === "\uE000") {
        return part;
      }
      return toEastern(escapeHtml(part));
    });
    return text.replace(/\uE000(\d+)\uE001/g, function (_m, idx) {
      return tokens[Number(idx)] || "";
    });
  }

  function status(msg, isError) {
    var el = document.getElementById("portal-status");
    if (!el) {
      return;
    }
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  function loadToken() {
    try {
      var raw = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null");
      if (raw && raw.token && raw.actor_type === "student") {
        state.token = raw.token;
        return raw;
      }
    } catch (error) {}
    return null;
  }

  function authHeaders() {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Portal-Token": state.token
    };
  }

  function fetchJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (body) {
          if (!response.ok) {
            var detail = body.detail || body.message || "تعذر تنفيذ الطلب";
            if (Array.isArray(detail)) {
              detail = detail
                .map(function (row) {
                  return row.msg || JSON.stringify(row);
                })
                .join(" · ");
            }
            var err = new Error(detail);
            err.status = response.status;
            throw err;
          }
          return body;
        });
    });
  }

  function paintHome() {
    var home = state.home || {};
    var student = home.student || {};
    document.getElementById("portal-name").textContent = student.name || "طالب";
    var maskedId =
      window.NationalIdMask && typeof window.NationalIdMask.mask === "function"
        ? window.NationalIdMask.mask(student.national_id || "", 3)
        : toEastern(String(student.national_id || "").replace(/\d(?=\d{3})/g, "*"));
    document.getElementById("portal-meta").textContent =
      (student.grade || "—") +
      " · فصل " +
      toEastern(student.section || "—") +
      " · هوية: " +
      maskedId;
    document.getElementById("portal-xp").textContent = toEastern(home.xp || 0) + " XP";
    paintRank(Number(home.xp || 0));

    var modes = home.modes || {};
    var modeHost = document.getElementById("mode-grid");
    modeHost.innerHTML = [
      ["daily", modes.daily],
      ["mock", modes.mock],
      ["rescue", modes.rescue],
      ["duel", modes.duel],
      ["national", modes.national]
    ]
      .map(function (pair) {
        var key = pair[0];
        var cfg = pair[1] || {};
        return (
          "<button type=\"button\" class=\"mode-card\" data-mode=\"" +
          key +
          "\"><strong>" +
          escapeHtml(cfg.label || key) +
          "</strong><span>" +
          toEastern(cfg.count || "") +
          " أسئلة · " +
          toEastern(Math.round((cfg.seconds || 0) / 60)) +
          " دقائق" +
          (cfg.xp_mult > 1 ? " · مضاعف ×" + toEastern(cfg.xp_mult) : "") +
          "</span></button>"
        );
      })
      .join("");

    var rem = home.remedial || [];
    document.getElementById("remedial-box").innerHTML = rem.length
      ? "<ul class=\"portal-list\">" +
        rem
          .map(function (row) {
            return (
              "<li><strong>" +
              escapeHtml(row.subject || "") +
              "</strong> — " +
              escapeHtml(row.skill || "") +
              " · " +
              escapeHtml(row.status || "") +
              "</li>"
            );
          })
          .join("") +
        "</ul>"
      : "<p class=\"portal-empty\">لا عيادات علاجية مسندة حالياً.</p>";

    var totals = home.behavior_totals || {};
    document.getElementById("behavior-totals").innerHTML =
      '<span class="portal-chip">قدوة: ' +
      toEastern(totals["قدوة"] || 0) +
      '</span><span class="portal-chip">رفق: ' +
      toEastern(totals["رفق"] || 0) +
      '</span><span class="portal-chip">الإجمالي: ' +
      toEastern(totals.total || 0) +
      "</span>";

    var beh = home.behavior || [];
    document.getElementById("behavior-box").innerHTML = beh.length
      ? "<ul class=\"portal-list\">" +
        beh
          .map(function (row) {
            return (
              "<li>" +
              escapeHtml(row.program || "") +
              ": +" +
              toEastern(row.points || 0) +
              " — " +
              escapeHtml(row.note || "") +
              "</li>"
            );
          })
          .join("") +
        "</ul>"
      : "<p class=\"portal-empty\">نقاط «قدوة» و«رفق» تظهر عند التميز السلوكي والتحصيلي.</p>";

    var vouchers = home.cafeteria_vouchers || [];
    document.getElementById("cafeteria-box").innerHTML = vouchers.length
      ? "<ul class=\"portal-list\">" +
        vouchers
          .map(function (row) {
            return (
              "<li>" +
              escapeHtml(row.title || "قسيمة مقصف") +
              " · " +
              escapeHtml(row.status === "available" ? "مستحقة" : row.status || "") +
              "</li>"
            );
          })
          .join("") +
        "</ul>"
      : "<p class=\"portal-empty\">اجمع ٥ نقاط سلوك إيجابي للحصول على قسيمة مقصف.</p>";

    var talentChip = document.getElementById("portal-talent");
    if (talentChip) {
      var nominated = home.talent && home.talent.nominated;
      talentChip.hidden = !nominated;
      if (nominated) {
        talentChip.textContent =
          "مرشّح موهوبون · " + toEastern(home.talent.best_score || "") + "٪";
      }
    }
  }

  function paintRank(xp) {
    var tier = RANK_TIERS[0];
    var i;
    for (i = 0; i < RANK_TIERS.length; i += 1) {
      if (xp >= RANK_TIERS[i].min) {
        tier = RANK_TIERS[i];
      }
    }
    var nextMin = tier.next;
    var prevMin = tier.min;
    var span = Math.max(1, nextMin - prevMin);
    var pct = Math.min(100, Math.round(((xp - prevMin) / span) * 100));
    var rankEl = document.getElementById("portal-rank");
    var nextEl = document.getElementById("portal-rank-next");
    var fill = document.getElementById("portal-rank-fill");
    if (rankEl) rankEl.textContent = tier.title;
    if (nextEl) {
      nextEl.textContent =
        xp >= 1200
          ? "وصلت أعلى رتبة"
          : "التالي «" +
            (RANK_TIERS[Math.min(RANK_TIERS.length - 1, RANK_TIERS.indexOf(tier) + 1)].title || "") +
            "» عند " +
            toEastern(nextMin) +
            " XP · تبقّى " +
            toEastern(Math.max(0, nextMin - xp));
    }
    if (fill) fill.style.width = pct + "%";
  }

  function paintBoards() {
    var boards = state.boards || {};
    var key = state.boardTab === "classes" ? "classes_week" : state.boardTab;
    var rows = boards[key] || boards[state.boardTab] || [];
    var host = document.getElementById("board-list");
    if (!rows.length) {
      host.innerHTML = "<p class=\"portal-empty\">لا نتائج في هذه الفترة بعد — كن أول الفرسان.</p>";
      return;
    }
    if (state.boardTab === "classes") {
      host.innerHTML =
        "<ol class=\"board-list\">" +
        rows
          .map(function (row) {
            return (
              "<li><span class=\"rank\">" +
              toEastern(row.rank) +
              "</span><span>" +
              escapeHtml(row.label || "") +
              "</span><strong>" +
              toEastern(row.xp || 0) +
              " XP</strong></li>"
            );
          })
          .join("") +
        "</ol>";
      return;
    }
    host.innerHTML =
      "<ol class=\"board-list\">" +
      rows
        .map(function (row) {
          return (
            "<li><span class=\"rank\">" +
            toEastern(row.rank) +
            "</span><span>" +
            escapeHtml(row.name || "") +
            "<br><small>" +
            escapeHtml((row.grade || "") + " / " + (row.section || "")) +
            "</small></span><strong>" +
            toEastern(row.xp || 0) +
            " XP</strong></li>"
          );
        })
        .join("") +
      "</ol>";
  }

  function stopTimer() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    if (state.duelPoll) {
      clearInterval(state.duelPoll);
      state.duelPoll = null;
    }
  }

  function updateDuelRails(pack) {
    var rails = document.getElementById("duel-rails");
    if (!rails || rails.hidden) {
      return;
    }
    var youPct = pack && pack.you_pct != null ? pack.you_pct : 0;
    var ghostPct = pack && pack.ghost_pct != null ? pack.ghost_pct : 0;
    document.getElementById("duel-you-bar").style.width = youPct + "%";
    document.getElementById("duel-ghost-bar").style.width = ghostPct + "%";
    document.getElementById("duel-you-label").textContent = toEastern(youPct) + "٪";
    document.getElementById("duel-ghost-label").textContent = toEastern(ghostPct) + "٪";
    if (pack && pack.ghost_name) {
      document.getElementById("duel-ghost-name").textContent = pack.ghost_name;
    }
  }

  function pollDuel() {
    if (!state.run || !state.run.duel) {
      return;
    }
    var elapsed = Math.max(0, (Date.now() - state.runStartedAt) / 1000);
    var answered = Object.keys(state.answers || {}).length;
    fetchJson(
      "/api/portal/challenge/duel-progress?run_id=" +
        encodeURIComponent(state.run.run_id) +
        "&elapsed_sec=" +
        encodeURIComponent(elapsed) +
        "&answered=" +
        encodeURIComponent(answered),
      { headers: authHeaders(), cache: "no-store" }
    )
      .then(updateDuelRails)
      .catch(function () {});
  }

  function tick() {
    state.secondsLeft -= 1;
    var el = document.getElementById("arena-timer");
    if (el) {
      var m = Math.max(0, Math.floor(state.secondsLeft / 60));
      var s = Math.max(0, state.secondsLeft % 60);
      el.textContent = toEastern(m) + ":" + toEastern(String(s).padStart(2, "0"));
      el.classList.toggle("is-low", state.secondsLeft <= 30);
    }
    if (state.run && state.run.duel) {
      pollDuel();
    }
    if (state.secondsLeft <= 0) {
      stopTimer();
      finishRun();
    }
  }

  function currentQuestion() {
    return (state.run && state.run.questions && state.run.questions[state.index]) || null;
  }

  function paintQuestion() {
    var q = currentQuestion();
    var stage = document.getElementById("arena-stage");
    var hub = document.getElementById("arena-hub");
    if (!q) {
      return;
    }
    hub.style.display = "none";
    stage.classList.add("is-open");
    document.getElementById("arena-progress").textContent =
      "سؤال " + toEastern(state.index + 1) + " من " + toEastern(state.run.questions.length);
    document.getElementById("arena-title").textContent = state.run.label || "التحدي";
    var passage = "";
    if (q.passage_text) {
      passage =
        "<blockquote class=\"passage\"><strong>" +
        escapeHtml(q.passage_title || "نص") +
        "</strong><br>" +
        escapeHtml(q.passage_text) +
        "</blockquote>";
    }
    var isMath = String(q.domain || "").toLowerCase() === "math" || /رياض|كسور|معادل|فيثاغور|حساب/.test(q.stem || "");
    document.getElementById("q-box").innerHTML =
      passage +
      "<div class=\"q-stem-row\">" +
      "<p class=\"q-stem\">" +
      renderArabicMath(q.stem || "") +
      "</p>" +
      (isMath
        ? "<button type=\"button\" class=\"scratch-toggle\" id=\"scratch-open\" title=\"مسودة الحل\">✏️ مسودة الحل</button>"
        : "") +
      "</div>" +
      "<div class=\"q-choices\">" +
      ["A", "B", "C", "D"]
        .map(function (letter) {
          var selected = state.answers[q.id] && state.answers[q.id].choice === letter;
          return (
            "<button type=\"button\" class=\"q-choice" +
            (selected ? " is-selected" : "") +
            "\" data-choice=\"" +
            letter +
            "\"><span class=\"letter\">" +
            CHOICE_AR[letter] +
            "</span>" +
            renderArabicMath((q.choices && q.choices[letter]) || "") +
            "</button>"
          );
        })
        .join("") +
      "</div>";
    state.questionStartedAt = Date.now();
    hideTrap();
    paintPowerups();
    paintNationalMap();
    if (window.PortalStudentGames && typeof window.PortalStudentGames.onQuestionPainted === "function") {
      window.PortalStudentGames.onQuestionPainted(q, isMath);
    }
  }

  function paintPowerups() {
    var left = (state.run && state.run.powerups_left) || {};
    var host = document.getElementById("powerups");
    host.innerHTML = [
      ["fifty", "٥٠:٥٠"],
      ["hint", "تلميح"],
      ["freeze", "+١٥ ث"]
    ]
      .map(function (pair) {
        var disabled = !left[pair[0]];
        return (
          "<button type=\"button\" class=\"portal-btn secondary\" data-powerup=\"" +
          pair[0] +
          "\"" +
          (disabled ? " disabled" : "") +
          ">" +
          pair[1] +
          "</button>"
        );
      })
      .join("");
  }

  function startMode(mode) {
    status("جارٍ تجهيز الجولة…");
    fetchJson("/api/portal/challenge/start", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ mode: mode })
    })
      .then(function (pack) {
        state.run = pack;
        state.index = 0;
        state.answers = {};
        state.checked = {};
        state.rescueActive = null;
        state.streak = 0;
        state.secondsLeft = Number(pack.seconds || 600);
        state.runStartedAt = Date.now();
        stopTimer();
        showMainTab("play");
        var rails = document.getElementById("duel-rails");
        if (rails) {
          rails.hidden = !pack.duel;
          if (pack.duel && pack.ghost) {
            document.getElementById("duel-ghost-name").textContent = pack.ghost.ghost_name || "الخصم";
            updateDuelRails({ you_pct: 0, ghost_pct: 0, ghost_name: pack.ghost.ghost_name });
            state.duelPoll = setInterval(pollDuel, 2000);
          }
        }
        state.timer = setInterval(tick, 1000);
        tick();
        document.getElementById("result-box").innerHTML = "";
        paintQuestion();
        status(
          pack.duel
            ? "بدأت المبارزة ضد " + ((pack.ghost && pack.ghost.ghost_name) || "زميل") + " — بالتوفيق!"
            : "بدأت الجولة — بالتوفيق فارس نافس."
        );
      })
      .catch(function (error) {
        status(error.message || "تعذر بدء التحدي.", true);
      });
  }

  function showTrap(trap, q) {
    var host = document.getElementById("trap-card");
    if (!host || !trap) {
      return;
    }
    host.hidden = false;
    host.innerHTML =
      "<h3>" +
      escapeHtml(trap.title || "احذر الفخ!") +
      "</h3><p><strong>تشريح الخطأ الشائع:</strong> " +
      escapeHtml(trap.common_mistake || "") +
      "</p><div class=\"rule\">القاعدة الذهبية: " +
      escapeHtml(trap.golden_rule || "") +
      (trap.grade_root ? " · الجذر: " + escapeHtml(trap.grade_root) : "") +
      "</div><div class=\"portal-actions\" style=\"margin-top:10px;\"><button type=\"button\" class=\"portal-btn\" id=\"rescue-btn\">سؤال إنقاذ فوري (نظير رقمي)</button></div>";
    var btn = document.getElementById("rescue-btn");
    if (btn) {
      btn.onclick = function () {
        startRescue(q);
      };
    }
  }

  function hideTrap() {
    var host = document.getElementById("trap-card");
    if (host) {
      host.hidden = true;
      host.innerHTML = "";
    }
  }

  function startRescue(q) {
    fetchJson("/api/portal/misconceptions/rescue", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        run_id: state.run.run_id,
        domain: (q && q.domain) || "math",
        skill: (q && q.skill) || ""
      })
    })
      .then(function (pack) {
        state.rescueActive = pack.question;
        if (state.run && state.run.questions) {
          state.run.questions.splice(state.index + 1, 0, pack.question);
        }
        hideTrap();
        status(pack.message || "سؤال إنقاذ جاهز.");
        state.index += 1;
        paintQuestion();
      })
      .catch(function (error) {
        status(error.message || "تعذر توليد سؤال الإنقاذ.", true);
      });
  }

  function paintNationalMap() {
    var host = document.getElementById("national-map");
    if (!host || !state.run || state.run.mode !== "national") {
      if (host) host.hidden = true;
      return;
    }
    host.hidden = false;
    var qs = state.run.questions || [];
    host.innerHTML = qs
      .map(function (qq, i) {
        var cls = i === state.index ? " is-current" : "";
        if (state.checked[qq.id] === false) cls += " is-wrong";
        else if (state.answers[qq.id]) cls += " is-done";
        return (
          "<button type=\"button\" data-jump=\"" +
          i +
          "\" class=\"" +
          cls.trim() +
          "\">" +
          toEastern(i + 1) +
          "</button>"
        );
      })
      .join("");
  }

  function selectChoice(letter) {
    var q = currentQuestion();
    if (!q) {
      return;
    }
    var elapsed = Math.max(0, (Date.now() - state.questionStartedAt) / 1000);
    state.answers[q.id] = { question_id: q.id, choice: letter, elapsed_sec: elapsed };
    paintQuestion();
    if (!state.run || !state.run.run_id) {
      return;
    }
    fetchJson("/api/portal/challenge/check", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ run_id: state.run.run_id, question_id: q.id, choice: letter })
    })
      .then(function (pack) {
        state.checked[q.id] = !!pack.ok;
        paintNationalMap();
        if (!pack.ok && pack.trap) {
          showTrap(pack.trap, q);
        } else {
          hideTrap();
          if (pack.ok && q.rescue) {
            status("أحسنت — أُغلق الفخ واستُعيد نصف النقاط عند الإنهاء.");
          }
        }
      })
      .catch(function () {});
  }

  function nextQuestion() {
    var q = currentQuestion();
    if (q && !state.answers[q.id]) {
      status("اختر إجابة قبل المتابعة.", true);
      return;
    }
    if (state.index >= state.run.questions.length - 1) {
      finishRun();
      return;
    }
    state.index += 1;
    paintQuestion();
  }

  function finishRun() {
    stopTimer();
    var answers = Object.keys(state.answers).map(function (key) {
      return state.answers[key];
    });
    status("جارٍ احتساب النتيجة…");
    fetchJson("/api/portal/challenge/finish", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ run_id: state.run.run_id, answers: answers })
    })
      .then(function (result) {
        var duelLine = "";
        if (result.duel) {
          duelLine =
            "<br>المبارزة ضد " +
            escapeHtml(result.duel.ghost_name || "زميل") +
            ": " +
            (result.duel.won ? "فوز" : "خسارة") +
            " (خصم " +
            toEastern(result.duel.ghost_target_score || "") +
            "٪)";
        }
        var extra = "";
        if (result.talent) {
          extra += "<br>ترشيح الموهوبين: نتيجتك ≥ ٩٥٪.";
        }
        if (result.cafeteria_voucher) {
          extra += "<br>حصلت على قسيمة مقصف مستحقة.";
        }
        var box = document.getElementById("result-box");
        box.innerHTML =
          "<div class=\"result-box\"><strong>انتهت الجولة</strong><br>النتيجة: " +
          toEastern(result.score_pct) +
          "٪ (" +
          toEastern(result.correct_count) +
          "/" +
          toEastern(result.total) +
          ") · XP +" +
          toEastern(result.xp_earned) +
          " · الإجمالي " +
          toEastern(result.xp_total) +
          (result.badge ? " · وسام: " + escapeHtml(result.badge) : "") +
          duelLine +
          extra +
          "</div>" +
          "<ul class=\"portal-list\">" +
          (result.review || [])
            .slice(0, 8)
            .map(function (row) {
              return (
                "<li>" +
                (row.ok ? "✓" : "✗") +
                " " +
                renderArabicMath(row.stem || "") +
                "<br><small>" +
                renderArabicMath(row.rationale || "") +
                "</small></li>"
              );
            })
            .join("") +
          "</ul>";
        document.getElementById("arena-stage").classList.remove("is-open");
        document.getElementById("arena-hub").style.display = "";
        document.getElementById("duel-rails").hidden = true;
        status("تم تحديث نقاطك ولوحات الصدارة.");
        return refresh();
      })
      .catch(function (error) {
        status(error.message || "تعذر إنهاء الجولة.", true);
      });
  }

  function usePowerup(kind) {
    var q = currentQuestion();
    fetchJson("/api/portal/challenge/powerup", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        run_id: state.run.run_id,
        powerup: kind,
        question_id: q ? q.id : 0
      })
    })
      .then(function (pack) {
        state.run.powerups_left = pack.powerups_left || state.run.powerups_left;
        if (kind === "freeze" && pack.extra_seconds) {
          state.secondsLeft += Number(pack.extra_seconds);
          tick();
        }
        if (kind === "hint" && pack.hint) {
          status("تلميح المعلم: " + pack.hint);
        }
        if (kind === "fifty" && pack.remove) {
          Array.prototype.forEach.call(document.querySelectorAll(".q-choice"), function (btn) {
            if (pack.remove.indexOf(btn.getAttribute("data-choice")) >= 0) {
              btn.classList.add("is-gone");
            }
          });
        }
        paintPowerups();
      })
      .catch(function (error) {
        status(error.message || "تعذر استخدام البطاقة.", true);
      });
  }

  function sendCounsel() {
    var input = document.getElementById("counsel-text");
    var message = (input && input.value) || "";
    fetchJson("/api/portal/counseling", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ message: message })
    })
      .then(function (pack) {
        if (input) {
          input.value = "";
        }
        status(pack.message || "تم الإرسال بسرية.");
      })
      .catch(function (error) {
        status(error.message || "تعذر إرسال الاستشارة.", true);
      });
  }

  function refresh() {
    return Promise.all([
      fetchJson("/api/portal/student/home", { headers: authHeaders(), cache: "no-store" }),
      fetchJson("/api/portal/leaderboards", { headers: authHeaders(), cache: "no-store" })
    ]).then(function (parts) {
      state.home = parts[0];
      state.boards = parts[1];
      paintHome();
      paintBoards();
    });
  }

  function showMainTab(id) {
    state.mainTab = id;
    Array.prototype.forEach.call(document.querySelectorAll("[data-main-tab]"), function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-main-tab") === id);
    });
    ["play", "boards", "plan", "counsel"].forEach(function (key) {
      var panel = document.getElementById("panel-" + key);
      if (!panel) return;
      var on = key === id;
      panel.classList.toggle("is-active", on);
      panel.hidden = !on;
    });
    if (id === "play") {
      loadTrapAlbum();
      loadGoldenDeck();
      if (window.PortalStudentGames && typeof window.PortalStudentGames.refreshPresence === "function") {
        window.PortalStudentGames.refreshPresence();
      }
    }
  }

  function loadTrapAlbum() {
    fetchJson("/api/portal/misconceptions/album", { headers: authHeaders(), cache: "no-store" })
      .then(function (pack) {
        state.trapAlbum = pack;
        paintTrapAlbum();
      })
      .catch(function (error) {
        status(error.message || "تعذر تحميل ألبوم الأخطاء.", true);
      });
  }

  function paintTrapAlbum() {
    var pack = state.trapAlbum || { doors: {} };
    var rows = (pack.doors && pack.doors[state.trapDoor]) || [];
    var host = document.getElementById("trap-album");
    host.innerHTML = rows
      .map(function (row) {
        return (
          "<article class=\"trap-tile\"><strong>" +
          escapeHtml(row.prompt || row.skill || "") +
          "</strong><div class=\"mistake\">الفخ: " +
          escapeHtml(row.common_mistake || "") +
          "</div><div class=\"rule\">القاعدة: " +
          escapeHtml(row.golden_rule || "") +
          "</div><small>الجذر " +
          escapeHtml(row.grade_root || "") +
          " · " +
          escapeHtml(((row.etec || {}).code) || "") +
          "</small></article>"
        );
      })
      .join("");
  }

  function loadGoldenDeck() {
    fetchJson("/api/portal/golden-deck", { headers: authHeaders(), cache: "no-store" })
      .then(function (pack) {
        state.golden = pack;
        paintGoldenDeck();
      })
      .catch(function (error) {
        status(error.message || "تعذر تحميل الحقيبة الذهبية.", true);
      });
  }

  function paintGoldenDeck() {
    var cards = (state.golden && state.golden.cards) || [];
    var host = document.getElementById("golden-deck");
    host.innerHTML = cards
      .map(function (card) {
        return (
          "<button type=\"button\" class=\"flip-card domain-" +
          escapeHtml(card.domain || "math") +
          (card.mastered ? " is-mastered" : "") +
          "\" data-card=\"" +
          escapeHtml(card.id) +
          "\"><span class=\"flip-inner\"><span class=\"flip-face front\">" +
          escapeHtml(card.front || card.title || "") +
          "</span><span class=\"flip-face back\">" +
          escapeHtml(card.back || "") +
          "<br><br><em>تم الإتقان (+" +
          toEastern(card.xp || 5) +
          " XP)</em></span></span></button>"
        );
      })
      .join("");
  }

  function bind() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-main-tab]"), function (btn) {
      btn.addEventListener("click", function () {
        showMainTab(btn.getAttribute("data-main-tab"));
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-trap-door]"), function (btn) {
      btn.addEventListener("click", function () {
        state.trapDoor = btn.getAttribute("data-trap-door");
        Array.prototype.forEach.call(document.querySelectorAll("[data-trap-door]"), function (el) {
          el.classList.toggle("is-active", el === btn);
        });
        paintTrapAlbum();
      });
    });
    document.getElementById("golden-deck").addEventListener("click", function (event) {
      var card = event.target.closest("[data-card]");
      if (!card) return;
      card.classList.toggle("is-flipped");
      if (card.classList.contains("is-flipped") && !card.classList.contains("is-mastered")) {
        fetchJson("/api/portal/golden-deck/master", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ card_id: card.getAttribute("data-card") })
        })
          .then(function (pack) {
            if (pack.xp_earned) {
              card.classList.add("is-mastered");
              status("أتقنت البطاقة · +" + toEastern(pack.xp_earned) + " XP");
              return refresh();
            }
          })
          .catch(function () {});
      }
    });
    document.getElementById("national-map").addEventListener("click", function (event) {
      var btn = event.target.closest("[data-jump]");
      if (!btn || !state.run) return;
      state.index = Number(btn.getAttribute("data-jump") || 0);
      paintQuestion();
    });
    document.getElementById("mode-grid").addEventListener("click", function (event) {
      var btn = event.target.closest("[data-mode]");
      if (btn) {
        startMode(btn.getAttribute("data-mode"));
      }
    });
    document.getElementById("q-box").addEventListener("click", function (event) {
      var btn = event.target.closest("[data-choice]");
      if (btn) {
        selectChoice(btn.getAttribute("data-choice"));
      }
    });
    document.getElementById("powerups").addEventListener("click", function (event) {
      var btn = event.target.closest("[data-powerup]");
      if (btn && !btn.disabled) {
        usePowerup(btn.getAttribute("data-powerup"));
      }
    });
    document.getElementById("arena-next").addEventListener("click", nextQuestion);
    document.getElementById("arena-exit").addEventListener("click", function () {
      stopTimer();
      document.getElementById("arena-stage").classList.remove("is-open");
      document.getElementById("arena-hub").style.display = "";
      refresh();
    });
    document.getElementById("counsel-send").addEventListener("click", sendCounsel);
    document.getElementById("portal-logout").addEventListener("click", function () {
      fetchJson("/api/portal/logout", { method: "POST", headers: authHeaders(), body: "{}" }).finally(function () {
        sessionStorage.removeItem(TOKEN_KEY);
        window.location.href = "login.html";
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-board]"), function (btn) {
      btn.addEventListener("click", function () {
        state.boardTab = btn.getAttribute("data-board");
        Array.prototype.forEach.call(document.querySelectorAll("[data-board]"), function (el) {
          el.classList.toggle("is-active", el === btn);
        });
        paintBoards();
      });
    });
  }

  function boot() {
    var session = loadToken();
    if (!session) {
      window.location.href = "login.html";
      return;
    }
    bind();
    refresh()
      .then(function () {
        showMainTab("play");
        if (window.PortalStudentGames && typeof window.PortalStudentGames.boot === "function") {
          window.PortalStudentGames.boot({
            token: state.token,
            fetchJson: fetchJson,
            authHeaders: authHeaders,
            status: status,
            toEastern: toEastern,
            escapeHtml: escapeHtml,
            refresh: refresh
          });
        }
      })
      .catch(function (error) {
        status(error.message || "تعذر تحميل البوابة.", true);
        if (error.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          window.location.href = "login.html";
        }
      });
  }

  boot();
})();
