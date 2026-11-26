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
    boardTab: "day"
  };

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
    text = text.replace(/(^|[^\w⁰¹²³⁴⁵⁶⁷⁸⁹])(\d+)\s*\/\s*(\d+)(?!\w)/g, function (_m, lead, num, den) {
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
    text = text.replace(/([0-9٠-٩أ-يA-Za-zسصقع])\^(\d+)/g, function (_m, base, exp) {
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
    document.getElementById("portal-meta").textContent =
      (student.grade || "—") +
      " · فصل " +
      toEastern(student.section || "—") +
      " · هوية " +
      toEastern(student.national_id || "—");
    document.getElementById("portal-xp").textContent = toEastern(home.xp || 0) + " XP";

    var modes = home.modes || {};
    var modeHost = document.getElementById("mode-grid");
    modeHost.innerHTML = [
      ["daily", modes.daily],
      ["mock", modes.mock],
      ["rescue", modes.rescue]
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
    document.getElementById("q-box").innerHTML =
      passage +
      "<p class=\"q-stem\">" +
      renderArabicMath(q.stem || "") +
      "</p>" +
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
    paintPowerups();
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
        state.streak = 0;
        state.secondsLeft = Number(pack.seconds || 600);
        stopTimer();
        state.timer = setInterval(tick, 1000);
        tick();
        document.getElementById("result-box").innerHTML = "";
        paintQuestion();
        status("بدأت الجولة — بالتوفيق فارس نافس.");
      })
      .catch(function (error) {
        status(error.message || "تعذر بدء التحدي.", true);
      });
  }

  function selectChoice(letter) {
    var q = currentQuestion();
    if (!q) {
      return;
    }
    var elapsed = Math.max(0, (Date.now() - state.questionStartedAt) / 1000);
    state.answers[q.id] = { question_id: q.id, choice: letter, elapsed_sec: elapsed };
    paintQuestion();
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

  function bind() {
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
    refresh().catch(function (error) {
      status(error.message || "تعذر تحميل البوابة.", true);
      if (error.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        window.location.href = "login.html";
      }
    });
  }

  boot();
})();
