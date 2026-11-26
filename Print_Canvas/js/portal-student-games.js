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
  var words = { rounds: [], index: 0, answers: [], combo: 0, best: 0, timer: null, left: 60, started: 0, track: "lang", sessionId: 0 };
  var mental = {
    items: [],
    index: 0,
    answers: [],
    level: 1,
    mode: "solo",
    timer: null,
    left: 60,
    started: 0,
    sessionId: 0,
    tierId: "amateur",
    tierLabel: "الهواة"
  };
  var TIER_BY_LEVEL = {
    1: { id: "amateur", label: "الهواة" },
    3: { id: "pro", label: "المحترفين" },
    5: { id: "elite", label: "النخبة" }
  };
  var LEVEL_BY_TIER = { amateur: 1, pro: 3, elite: 5 };
  var foundation = {
    activeKey: "",
    sessionId: 0,
    uiOpen: false,
    label: "",
    phase: "", // lobby | play | celebrate
    pendingKey: "",
    pendingTrack: "lang",
    pendingLevel: 1,
    pendingMode: "solo",
    pendingTier: "amateur",
    lastReplay: null
  };
  var scratch = { ink: "#111827", erasing: false, drawing: false, expanded: false };

  function stopWordsTimer() {
    if (words.timer) clearInterval(words.timer);
    words.timer = null;
  }

  function stopMentalTimer() {
    if (mental.timer) clearInterval(mental.timer);
    mental.timer = null;
  }

  function foundationLabel(key, track) {
    if (key === "mental") return "الحساب الذهني";
    if (key === "words" && track === "quran") return "ألفاظ القرآن الكريم";
    return "لعبة الكلمات";
  }

  function foundationPanel() {
    return document.querySelector('[data-station="games"]');
  }

  /** عزل واجهة الجلسة: إخفاء قائمة البطاقات وإظهار عنوان الجلسة + زر العودة */
  function enterFoundationUi(key, track) {
    foundation.uiOpen = true;
    foundation.label = foundationLabel(key, track);
    var tiles = el("foundation-game-tiles");
    var bar = el("foundation-session-bar");
    var title = el("foundation-active-title");
    var sectionTitle = el("foundation-section-title");
    var panel = foundationPanel();
    if (tiles) {
      tiles.hidden = true;
      tiles.setAttribute("aria-hidden", "true");
      tiles.classList.add("is-hidden-session");
    }
    if (bar) bar.hidden = false;
    if (title) title.textContent = foundation.label;
    if (sectionTitle) sectionTitle.hidden = true;
    if (panel) panel.classList.add("is-foundation-session");
  }

  /** العودة لقائمة الألعاب: إلغاء المؤقت وإغلاق النطاق */
  function exitFoundationUi() {
    stopFoundationGames();
    foundation.uiOpen = false;
    foundation.label = "";
    foundation.phase = "";
    foundation.pendingKey = "";
    var tiles = el("foundation-game-tiles");
    var bar = el("foundation-session-bar");
    var sectionTitle = el("foundation-section-title");
    var stage = document.getElementById("mini-game-stage");
    var panel = foundationPanel();
    if (tiles) {
      tiles.hidden = false;
      tiles.removeAttribute("aria-hidden");
      tiles.classList.remove("is-hidden-session");
    }
    if (bar) bar.hidden = true;
    if (sectionTitle) {
      sectionTitle.hidden = false;
      sectionTitle.textContent = "ألعاب التأسيس السريع";
    }
    if (panel) panel.classList.remove("is-foundation-session");
    if (stage) {
      stage.hidden = true;
      stage.innerHTML = "";
      stage.removeAttribute("data-active-game");
      stage.removeAttribute("data-session");
      stage.removeAttribute("data-qid");
      stage.removeAttribute("data-phase");
    }
  }

  /** إيقاف كل ألعاب التأسيس السريع (كلمات / قرآن / حساب) ومنع نبضات قديمة */
  function stopFoundationGames() {
    stopWordsTimer();
    stopMentalTimer();
    foundation.activeKey = "";
    foundation.sessionId += 1;
    var host = document.getElementById("mini-game-stage");
    if (host) {
      host.removeAttribute("data-active-game");
      host.removeAttribute("data-session");
      host.removeAttribute("data-qid");
    }
  }

  function beginFoundationSession(key, track) {
    stopWordsTimer();
    stopMentalTimer();
    foundation.activeKey = key;
    foundation.phase = "play";
    foundation.sessionId += 1;
    enterFoundationUi(key, track || (key === "words" ? words.track : ""));
    return foundation.sessionId;
  }

  function isFoundationSession(key, sessionId) {
    return foundation.activeKey === key && foundation.sessionId === sessionId;
  }

  function lobbyBlurb(key, track) {
    if (key === "mental") {
      return "اختر مسار التحدي (الهواة · المحترفين · النخبة). لن يبدأ العدّاد إلا بعد «ابدأ اللعبة».";
    }
    if (key === "words" && track === "quran") {
      return "معاني قرآنية مبسّطة. لن يبدأ العدّاد إلا بعد الضغط على «ابدأ اللعبة».";
    }
    return "معنى · مرادف · ضد خلال ٦٠ ثانية. لن يبدأ العدّاد إلا بعد الضغط على «ابدأ اللعبة».";
  }

  function tierChipClass(tierId) {
    return foundation.pendingTier === tierId ? "portal-btn" : "portal-btn secondary";
  }

  /** شاشة تمهيد قبل السؤال والمؤقت */
  function paintFoundationLobby() {
    var host = stageHost();
    if (!host) return;
    host.hidden = false;
    host.setAttribute("data-phase", "lobby");
    host.removeAttribute("data-qid");
    var etec =
      foundation.pendingKey === "mental"
        ? '<span dir="ltr" class="etec-code">٣-١-١-٢</span>'
        : '<span dir="ltr" class="etec-code">٣-١-١-١</span>';
    var tierBlock = "";
    if (foundation.pendingKey === "mental") {
      tierBlock =
        '<div class="foundation-tier-row" role="group" aria-label="مسار التحدي">' +
        '<button type="button" class="' +
        tierChipClass("amateur") +
        '" data-lobby-tier="amateur">الهواة</button>' +
        '<button type="button" class="' +
        tierChipClass("pro") +
        '" data-lobby-tier="pro">المحترفين</button>' +
        '<button type="button" class="' +
        tierChipClass("elite") +
        '" data-lobby-tier="elite">النخبة</button>' +
        '<button type="button" class="portal-btn secondary" data-lobby-mode="tournament">بطولة فصول</button>' +
        "</div>";
    }
    host.innerHTML =
      '<div class="foundation-lobby">' +
      "<h3 class=\"foundation-lobby-title\">" +
      esc(foundation.label) +
      "</h3>" +
      '<p class="foundation-lobby-blurb">' +
      esc(lobbyBlurb(foundation.pendingKey, foundation.pendingTrack)) +
      " " +
      etec +
      "</p>" +
      tierBlock +
      '<div class="portal-actions foundation-lobby-actions">' +
      '<button type="button" class="portal-btn" data-foundation-start="1">ابدأ اللعبة</button>' +
      '<button type="button" class="portal-btn secondary" data-foundation-exit="1">العودة</button>' +
      "</div></div>";
  }

  function openFoundationLobby(key, track) {
    stopFoundationGames();
    foundation.pendingKey = key;
    foundation.pendingTrack = track || "lang";
    foundation.pendingLevel = 1;
    foundation.pendingMode = "solo";
    foundation.pendingTier = "amateur";
    foundation.phase = "lobby";
    foundation.activeKey = "";
    foundation.sessionId += 1;
    enterFoundationUi(key, track);
    paintFoundationLobby();
  }

  function launchFoundationPlay() {
    if (!foundation.uiOpen || foundation.phase !== "lobby") return;
    if (foundation.pendingKey === "mental") {
      var lvl = LEVEL_BY_TIER[foundation.pendingTier] || foundation.pendingLevel || 1;
      startMental(lvl, foundation.pendingMode || "solo", foundation.pendingTier);
      return;
    }
    startWords(foundation.pendingTrack || "lang");
  }

  function formatElapsed(sec) {
    var s = Math.max(0, Math.round(Number(sec) || 0));
    if (s < 60) return east(s) + " ث";
    var m = Math.floor(s / 60);
    var r = s % 60;
    var rs = r < 10 ? "0" + r : String(r);
    return east(m) + ":" + east(rs);
  }

  function badgeLabel(key, labels) {
    var map = labels || {};
    if (key === "start") return map.start || "نقطة البداية";
    if (key === "best") return map.best || "أفضل رقم";
    if (key === "improved") return map.improved || "↑ تحسّن";
    return "";
  }

  /** مخطط أعمدة المحاولات ١…ن — ارتفاع = صحيحة/دقة، نقطة = سرعة */
  function renderProgressPulse(pulse) {
    if (!pulse || !pulse.attempts || !pulse.attempts.length) {
      return "";
    }
    var labels = pulse.labels || {};
    var cols = pulse.attempts
      .map(function (a) {
        var h = Math.max(4, Math.min(100, Number(a.height_pct) || 0));
        var speed = a.speed_mark_pct;
        var speedHtml =
          speed == null
            ? ""
            : '<span class="progress-speed-mark" style="--speed:' +
              Math.max(0, Math.min(100, Number(speed))) +
              '%" title="مؤشر السرعة"></span>';
        var scoreTxt =
          a.total > 0
            ? east(a.score) + "/" + east(a.total)
            : east(a.score);
        var badges = (a.badges || [])
          .map(function (b) {
            return (
              '<span class="progress-badge progress-badge-' +
              esc(b) +
              '">' +
              esc(badgeLabel(b, labels)) +
              "</span>"
            );
          })
          .join("");
        return (
          '<div class="progress-col' +
          (a.is_latest ? " is-latest" : "") +
          '" data-n="' +
          esc(String(a.n || "")) +
          '">' +
          '<div class="progress-col-track" aria-hidden="true">' +
          '<div class="progress-col-fill" style="--h:' +
          h +
          '%"></div>' +
          speedHtml +
          "</div>" +
          '<div class="progress-col-meta">' +
          '<span class="progress-col-n foundation-hud-num" dir="ltr">' +
          east(a.n) +
          "</span>" +
          '<span class="progress-col-score foundation-hud-num" dir="ltr">' +
          scoreTxt +
          "</span>" +
          (a.elapsed_sec != null
            ? '<span class="progress-col-time foundation-hud-num" dir="ltr">' +
              east(Math.round(Number(a.elapsed_sec))) +
              " ث</span>"
            : "") +
          "</div>" +
          (badges ? '<div class="progress-col-badges">' + badges + "</div>" : "") +
          "</div>"
        );
      })
      .join("");
    var headTitle = pulse.title || (pulse.source === "challenge_runs" ? "تحدياتك" : "محاولاتك");
    return (
      '<section class="progress-pulse" aria-label="' +
      esc(headTitle) +
      '">' +
      '<div class="progress-pulse-head">' +
      "<strong>" +
      esc(headTitle) +
      "</strong>" +
      '<span class="progress-pulse-legend">' +
      "<span>ارتفاع العمود = الصحيحة</span>" +
      "<span>النقطة = السرعة</span>" +
      "</span></div>" +
      '<div class="progress-pulse-chart" dir="rtl">' +
      cols +
      "</div></section>"
    );
  }

  function renderLegendBar(legend) {
    if (!legend) return "";
    var pct = Math.max(0, Math.min(100, Number(legend.progress_pct) || 0));
    return (
      '<section class="nafs-legend-bar" aria-label="أسطورة نافس">' +
      '<div class="nafs-legend-head">' +
      "<strong>أسطورة نافس</strong>" +
      '<span class="foundation-hud-num" dir="ltr">' +
      east(legend.xp_total) +
      " XP</span></div>" +
      '<p class="nafs-legend-title">' +
      esc(legend.title || "") +
      (legend.next_title && legend.remain_xp > 0
        ? " → " + esc(legend.next_title) + " (يتبقّى " + east(legend.remain_xp) + ")"
        : "") +
      "</p>" +
      '<div class="nafs-legend-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      pct +
      '"><span class="nafs-legend-fill" style="--pct:' +
      pct +
      '%"></span></div></section>'
    );
  }

  function renderRankGap(rank) {
    if (!rank || !rank.visible) return "";
    var avgRound =
      rank.round_avg_score != null ? rank.round_avg_score : rank.avg_metric;
    return (
      '<section class="end-round-rank" aria-label="الترتيب الآمن">' +
      '<p class="end-round-rank-msg">' +
      esc(rank.message || "") +
      "</p>" +
      '<div class="end-round-rank-meta">' +
      '<span>المركز <strong class="foundation-hud-num" dir="ltr">' +
      east(rank.rank) +
      "</strong></span>" +
      (avgRound != null
        ? '<span>متوسط الجولة <strong class="foundation-hud-num" dir="ltr">' +
          east(avgRound) +
          "</strong></span>"
        : "") +
      (rank.gap_to_next != null && Number(rank.gap_to_next) > 0
        ? '<span>الفارق للقفزة <strong class="foundation-hud-num" dir="ltr">' +
          east(rank.gap_to_next) +
          "</strong></span>"
        : "") +
      "</div></section>"
    );
  }

  function renderPathHint(hint) {
    if (!hint) return "";
    return (
      '<section class="end-round-path-hint">' +
      "<strong>" +
      esc(hint.label || "مسار داعم") +
      "</strong>" +
      "<p>" +
      esc(hint.blurb || "") +
      "</p>" +
      (hint.station
        ? '<button type="button" class="portal-btn secondary" data-end-station="' +
          esc(hint.station) +
          '">افتح المسار</button>'
        : "") +
      "</section>"
    );
  }

  function mathOrEsc(text) {
    if (api && typeof api.renderArabicMath === "function") {
      return api.renderArabicMath(text || "");
    }
    return esc(text || "");
  }

  function shortStem(stem) {
    var t = String(stem || "").replace(/\s+/g, " ").trim();
    if (t.length <= 96) return t;
    return t.slice(0, 94) + "…";
  }

  function answerDisplay(row, side) {
    var letter =
      side === "yours"
        ? row.choice_ar || row.choice || ""
        : row.correct_ar || row.correct || "";
    var label =
      side === "yours" ? row.choice_label || "" : row.correct_label || "";
    var parts = [];
    if (letter) parts.push(String(letter));
    if (label) parts.push(String(label));
    return parts.join(" — ") || "—";
  }

  /** بطاقة مراجعة موحّدة: ملخص + أخطاء أولاً + إجابتك/الصحيحة + تعليل محفوظ فقط */
  function renderRoundReview(pack) {
    var items = (pack && pack.review) || [];
    var summary = (pack && pack.review_summary) || {};
    if (!items.length && !summary.total && summary.total !== 0) return "";
    var total = summary.total != null ? Number(summary.total) : items.length;
    var correctN =
      summary.correct_count != null
        ? Number(summary.correct_count)
        : items.filter(function (r) {
            return r && r.ok;
          }).length;
    var wrongN =
      summary.wrong_count != null
        ? Number(summary.wrong_count)
        : Math.max(0, total - correctN);
    var totalAr = summary.total_ar || east(total);
    var correctAr = summary.correct_count_ar || east(correctN);
    var wrongAr = summary.wrong_count_ar || east(wrongN);
    var defaultMode = wrongN > 0 ? "wrong" : "all";

    function rowHtml(row) {
      var rationale = String((row && row.rationale) || "").trim();
      return (
        '<li class="round-review-item' +
        (row && row.ok ? " is-ok" : " is-wrong") +
        '">' +
        '<div class="round-review-stem">' +
        (row && row.ok ? "✓ " : "✗ ") +
        mathOrEsc(shortStem((row && row.stem) || "")) +
        "</div>" +
        '<div class="round-review-pair">' +
        '<span class="round-review-yours"><em>إجابتك</em> ' +
        mathOrEsc(answerDisplay(row || {}, "yours")) +
        "</span>" +
        '<span class="round-review-correct"><em>الصحيحة</em> ' +
        mathOrEsc(answerDisplay(row || {}, "correct")) +
        "</span>" +
        "</div>" +
        (rationale
          ? '<p class="round-review-rationale">' + mathOrEsc(rationale) + "</p>"
          : "") +
        "</li>"
      );
    }

    var wrongItems = items.filter(function (r) {
      return r && !r.ok;
    });
    var wrongList =
      wrongItems.length > 0
        ? wrongItems.map(rowHtml).join("")
        : '<li class="round-review-empty">لا أخطاء في هذه الجولة.</li>';
    var allList =
      items.length > 0
        ? items.map(rowHtml).join("")
        : '<li class="round-review-empty">لا بنود مراجعة محفوظة.</li>';

    return (
      '<section class="round-review-card" data-review-mode="' +
      defaultMode +
      '">' +
      '<header class="round-review-head">' +
      "<strong>مراجعة الجولة</strong>" +
      '<div class="round-review-summary" dir="ltr">' +
      '<span><em>صحيحة</em> ' +
      esc(correctAr) +
      "</span>" +
      '<span><em>أخطاء</em> ' +
      esc(wrongAr) +
      "</span>" +
      '<span><em>المجموع</em> ' +
      esc(totalAr) +
      "</span>" +
      "</div>" +
      "</header>" +
      '<div class="round-review-tabs" role="tablist">' +
      '<button type="button" class="portal-btn secondary' +
      (defaultMode === "wrong" ? " is-active" : "") +
      '" data-review-tab="wrong" role="tab" aria-selected="' +
      (defaultMode === "wrong" ? "true" : "false") +
      '">الأخطاء (' +
      esc(wrongAr) +
      ")</button>" +
      '<button type="button" class="portal-btn secondary' +
      (defaultMode === "all" ? " is-active" : "") +
      '" data-review-tab="all" role="tab" aria-selected="' +
      (defaultMode === "all" ? "true" : "false") +
      '">الكل (' +
      esc(totalAr) +
      ")</button>" +
      "</div>" +
      '<ul class="round-review-list" data-review-panel="wrong"' +
      (defaultMode === "wrong" ? "" : " hidden") +
      ">" +
      wrongList +
      "</ul>" +
      '<ul class="round-review-list" data-review-panel="all"' +
      (defaultMode === "all" ? "" : " hidden") +
      ">" +
      allList +
      "</ul>" +
      "</section>"
    );
  }

  function bindRoundReviewTabs(root) {
    if (!root) return;
    var card = root.querySelector(".round-review-card");
    if (!card || card.getAttribute("data-bound") === "1") return;
    card.setAttribute("data-bound", "1");
    card.addEventListener("click", function (event) {
      var tab = event.target.closest("[data-review-tab]");
      if (!tab || !card.contains(tab)) return;
      var mode = tab.getAttribute("data-review-tab") || "wrong";
      card.setAttribute("data-review-mode", mode);
      Array.prototype.forEach.call(card.querySelectorAll("[data-review-tab]"), function (btn) {
        var on = btn.getAttribute("data-review-tab") === mode;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      Array.prototype.forEach.call(card.querySelectorAll("[data-review-panel]"), function (panel) {
        panel.hidden = panel.getAttribute("data-review-panel") !== mode;
      });
    });
  }

  /** بطاقة ختام الجولة — مرآة + أعمدة + ترتيب + أسطورة نافس */
  function paintEndRound(pack, meta) {
    var host = stageHost();
    if (!host) return;
    foundation.phase = "celebrate";
    foundation.lastReplay = meta || null;
    host.hidden = false;
    host.setAttribute("data-phase", "celebrate");
    host.removeAttribute("data-qid");
    host.removeAttribute("data-active-game");

    var tier = (pack && pack.tier) || {};
    var coach = (pack && pack.coaching) || {};
    var endround = (pack && pack.endround) || {};
    var score = Number((pack && pack.score) || 0);
    var total = Number((pack && pack.total) || (meta && meta.total) || 1);
    var xp = Number((pack && pack.xp_earned) || 0);
    var combo = Number((pack && pack.combo_best) || (meta && meta.combo) || 0);
    var elapsed = Number((pack && pack.elapsed_sec) || (meta && meta.elapsed) || 0);
    var etecAr = (pack && pack.etec_ar) || (meta && meta.etec_ar) || "٣-١-١-١";
    var title = (meta && meta.title) || "انتهت الجولة";
    var tierLabel = tier.label || (meta && meta.tierLabel) || "";
    var accuracy = coach.accuracy_pct || String(Math.round((score / Math.max(1, total)) * 100));
    var pulseHtml = renderProgressPulse((pack && pack.progress_pulse) || null);
    var legendHtml = renderLegendBar(endround.legend);
    var rankHtml = renderRankGap(endround.rank);
    var hintHtml = renderPathHint(endround.path_hint);
    var reviewHtml = renderRoundReview(pack || {});

    host.innerHTML =
      '<article class="end-round-card" aria-live="polite">' +
      '<header class="end-round-head">' +
      "<h3>" +
      esc(title) +
      "</h3>" +
      (tierLabel
        ? '<span class="end-round-tier" data-tier="' +
          esc(tier.id || "") +
          '">' +
          esc(tierLabel) +
          "</span>"
        : "") +
      '<span dir="ltr" class="etec-code end-round-etec">' +
      esc(etecAr) +
      "</span>" +
      "</header>" +
      '<div class="end-round-metrics">' +
      '<div class="end-round-metric"><span class="lbl">الدقة</span><strong class="foundation-hud-num" dir="ltr">' +
      east(accuracy) +
      "٪</strong></div>" +
      '<div class="end-round-metric"><span class="lbl">الصحيحة</span><strong class="foundation-hud-num" dir="ltr">' +
      east(score) +
      " / " +
      east(total) +
      "</strong></div>" +
      '<div class="end-round-metric"><span class="lbl">الزمن</span><strong class="foundation-hud-num" dir="ltr">' +
      formatElapsed(elapsed) +
      "</strong></div>" +
      (Number(combo) > 0
        ? '<div class="end-round-metric"><span class="lbl">أفضل سلسلة</span><strong class="foundation-hud-num" dir="ltr">×' +
          east(combo) +
          "</strong></div>"
        : "") +
      '<div class="end-round-metric"><span class="lbl">XP</span><strong class="foundation-hud-num" dir="ltr">+' +
      east(xp) +
      "</strong></div>" +
      "</div>" +
      '<p class="end-round-message">' +
      esc(coach.message || "أحسنت على إكمال الجولة.") +
      "</p>" +
      '<ul class="end-round-coach">' +
      "<li><strong>قوتك:</strong> " +
      esc(coach.strength || "الاستمرار") +
      "</li>" +
      "<li><strong>خطوتك التالية:</strong> " +
      esc(coach.next_step || "أعد الجولة أو جرّب مسارًا أعلى.") +
      "</li>" +
      "</ul>" +
      reviewHtml +
      pulseHtml +
      legendHtml +
      rankHtml +
      hintHtml +
      '<div class="portal-actions end-round-actions">' +
      '<button type="button" class="portal-btn" data-end-replay="1">لعب مرة أخرى</button>' +
      '<button type="button" class="portal-btn secondary" data-end-games="1">ألعاب التأسيس</button>' +
      '<button type="button" class="portal-btn secondary" data-end-arena="1">الميدان</button>' +
      "</div>" +
      '<p class="end-round-footnote">بيانات حقيقية فقط — يُخفى الترتيب إن قلّ المشاركون.</p>' +
      "</article>";
    bindRoundReviewTabs(host);

    // إن غاب الملخص/السياق من الاستجابة، نجلبهما دون اختلاق
    if (meta && meta.pulseGame && api) {
      if (!pulseHtml) {
        api
          .fetchJson(
            "/api/portal/games/progress-pulse?game=" +
              encodeURIComponent(meta.pulseGame) +
              "&limit=7",
            { headers: api.authHeaders(), cache: "no-store" }
          )
          .then(function (pulsePack) {
            if (foundation.phase !== "celebrate") return;
            var slot = host.querySelector(".end-round-actions");
            if (!slot || !pulsePack) return;
            var html = renderProgressPulse(pulsePack);
            if (!html) return;
            slot.insertAdjacentHTML("beforebegin", html);
          })
          .catch(function () {});
      }
      if (!legendHtml) {
        api
          .fetchJson(
            "/api/portal/games/endround-context?game=" +
              encodeURIComponent(meta.pulseGame) +
              "&accuracy=" +
              encodeURIComponent(accuracy),
            { headers: api.authHeaders(), cache: "no-store" }
          )
          .then(function (ctx) {
            if (foundation.phase !== "celebrate" || !ctx) return;
            var slot = host.querySelector(".end-round-actions");
            if (!slot) return;
            var block =
              renderLegendBar(ctx.legend) +
              renderRankGap(ctx.rank) +
              renderPathHint(ctx.path_hint);
            if (block) slot.insertAdjacentHTML("beforebegin", block);
          })
          .catch(function () {});
      }
    }
  }

  function replayLastRound() {
    var last = foundation.lastReplay;
    if (!last || !last.kind) {
      exitFoundationUi();
      return;
    }
    if (last.kind === "mental") {
      openFoundationLobby("mental", "");
      foundation.pendingTier = last.tierId || "amateur";
      foundation.pendingLevel = LEVEL_BY_TIER[foundation.pendingTier] || last.level || 1;
      foundation.pendingMode = last.mode || "solo";
      paintFoundationLobby();
      return;
    }
    openFoundationLobby("words", last.track || "lang");
  }

  function goToArenaStation() {
    exitFoundationUi();
    if (window.PortalStudentStations && typeof window.PortalStudentStations.open === "function") {
      window.PortalStudentStations.open("live");
    }
  }

  /** نبضة العداد فقط — دون إعادة رسم السؤال أو تبديل اللعبة */
  function updateFoundationTimerHud(leftSeconds) {
    var timerEl = el("foundation-timer");
    if (!timerEl) return;
    timerEl.textContent = east(leftSeconds) + " ث";
  }

  function formatComboHud(combo) {
    return "سلسلة ×" + east(combo);
  }

  function updateFoundationComboHud(combo) {
    var comboEl = el("foundation-combo");
    if (!comboEl) return;
    comboEl.textContent = formatComboHud(combo);
  }

  function el(id) {
    return document.getElementById(id);
  }

  function east(value) {
    if (!api || typeof api.toEastern !== "function") {
      return value == null ? "" : String(value);
    }
    return api.toEastern(value == null ? "" : value);
  }

  function esc(value) {
    if (!api || typeof api.escapeHtml !== "function") {
      return value == null ? "" : String(value);
    }
    return api.escapeHtml(value == null ? "" : value);
  }

  function pingPresence() {
    if (!api) return;
    api.fetchJson("/api/portal/presence/ping", { method: "POST", headers: api.authHeaders(), body: "{}" }).catch(function () {});
  }

  function paintOnline(pack) {
    var host = el("online-list");
    if (!host) return;
    if (!api) {
      host.innerHTML = "<p class=\"portal-empty\">جارٍ تهيئة الرادار…</p>";
      return;
    }
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
          esc(row.name || "زميل") +
          " · " +
          esc(row.grade || "") +
          "/" +
          east(row.section || "") +
          "</span>" +
          "<button type=\"button\" class=\"portal-btn\" data-challenge=\"" +
          esc(row.national_id || "") +
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
          esc(row.other_name || row.challenger_name || "زميل") +
          "</strong>" +
          "<div class=\"portal-actions\">" +
          "<button type=\"button\" class=\"portal-btn\" data-duel-accept=\"" +
          esc(id) +
          "\">قبول</button>" +
          "<button type=\"button\" class=\"portal-btn secondary\" data-duel-reject=\"" +
          esc(id) +
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
    if (el("duel-you-label")) el("duel-you-label").textContent = east(youPct) + "٪";
    if (el("duel-ghost-label")) el("duel-ghost-label").textContent = east(otherPct) + "٪";
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
      "سؤال " + east(live.index + 1) + " من " + east(live.questions.length);
    var html =
      "<p class=\"q-stem\">" +
      esc(q.stem || "") +
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
        esc((q.choices && q.choices[letter]) || "") +
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
              ? "فزت بالمبارزة · +" + east(50) + " XP ولقب بطل الجولة!"
              : pack.winner
                ? "انتهت المبارزة — حاول مرة أخرى."
                : "تعادل شريف!"
          );
          if (win && window.PortalStudentFx) window.PortalStudentFx.confetti();
          paintEndRound(pack, {
            kind: "live",
            title: win
              ? "انتهت المبارزة — فوز"
              : pack.winner
                ? "انتهت المبارزة"
                : "انتهت المبارزة — تعادل",
            total: Number(pack.total || (live.questions && live.questions.length) || 0),
            elapsed: Math.max(0, 60 - Number(live.secondsLeft || 0)),
            etec_ar: pack.etec_ar || "٣-١-١-٤"
          });
          if (api.refresh) api.refresh();
        }
      })
      .catch(function () {});
  }

  function enterLiveDuel(pack) {
    stopLiveTimers();
    exitFoundationUi();
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
        t.textContent = east(m) + ":" + east(String(s).padStart(2, "0"));
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
    if (foundation.activeKey !== "words") return;
    var host = stageHost();
    var r = words.rounds[words.index];
    if (!host || !r) return;
    host.hidden = false;
    var kindClass = r.kind === "synonym" ? "kind-syn" : r.kind === "antonym" ? "kind-ant" : "kind-mean";
    host.setAttribute("data-active-game", "words");
    host.setAttribute("data-phase", "play");
    host.setAttribute("data-session", String(words.sessionId || foundation.sessionId));
    host.setAttribute("data-qid", String(r.id || words.index));
    host.innerHTML =
      "<div class=\"mini-hud\"><strong>" +
      esc(foundation.label || (words.track === "quran" ? "ألفاظ القرآن الكريم" : "لعبة الكلمات")) +
      "</strong><span id=\"foundation-combo\" class=\"foundation-hud-num\" dir=\"ltr\">" +
      formatComboHud(words.combo) +
      "</span><span id=\"foundation-timer\" class=\"foundation-hud-num\" dir=\"ltr\">" +
      east(words.left) +
      " ث</span><span dir=\"ltr\" class=\"etec-code\">٣-١-١-١</span></div>" +
      "<div class=\"word-card " +
      kindClass +
      "\"><em>" +
      esc(r.kind_ar || "") +
      "</em><p>" +
      esc(r.prompt || "") +
      "</p></div><div class=\"q-choices\">" +
      ["A", "B", "C", "D"]
        .map(function (letter) {
          return (
            "<button type=\"button\" class=\"q-choice\" data-word-choice=\"" +
            letter +
            "\"><span class=\"letter\">" +
            ({ A: "أ", B: "ب", C: "ج", D: "د" }[letter] || letter) +
            "</span>" +
            esc((r.choices && r.choices[letter]) || "") +
            "</button>"
          );
        })
        .join("") +
      "</div>";
  }

  function finishWords(sessionId) {
    if (sessionId != null && !isFoundationSession("words", sessionId)) {
      stopWordsTimer();
      return;
    }
    stopWordsTimer();
    if (foundation.activeKey === "words") {
      foundation.activeKey = "";
      foundation.sessionId += 1;
    }
    var total = Math.max(words.rounds.length, 1);
    var trackLabel = words.track === "quran" ? "جولة ألفاظ القرآن" : "لعبة الكلمات";
    var elapsed = (Date.now() - words.started) / 1000;
    api
      .fetchJson("/api/portal/games/words/finish", {
        method: "POST",
        headers: api.authHeaders(),
        body: JSON.stringify({
          answers: words.answers,
          combo_best: words.best,
          elapsed_sec: elapsed
        })
      })
      .then(function (pack) {
        if (foundation.activeKey) return;
        paintEndRound(pack, {
          kind: "words",
          title: "انتهت " + trackLabel,
          track: words.track,
          total: total,
          combo: words.best,
          elapsed: elapsed,
          pulseGame: "words",
          etec_ar: "٣-١-١-١"
        });
        if (api.refresh) api.refresh();
      })
      .catch(function (err) {
        api.status(err.message || "تعذر حفظ النتيجة.", true);
      });
  }

  function startWords(track) {
    track = track || "lang";
    var sessionId = beginFoundationSession("words", track);
    words.sessionId = sessionId;
    api
      .fetchJson("/api/portal/games/words/start?track=" + encodeURIComponent(track), {
        headers: api.authHeaders(),
        cache: "no-store"
      })
      .then(function (pack) {
        if (!isFoundationSession("words", sessionId)) return;
        words.rounds = pack.rounds || [];
        words.index = 0;
        words.answers = [];
        words.combo = 0;
        words.best = 0;
        words.track = pack.track || track;
        words.left = Number(pack.seconds || 60);
        words.started = Date.now();
        stopWordsTimer();
        words.timer = setInterval(function () {
          if (!isFoundationSession("words", sessionId)) {
            stopWordsTimer();
            return;
          }
          words.left -= 1;
          updateFoundationTimerHud(words.left);
          if (words.left <= 0) finishWords(sessionId);
        }, 1000);
        paintWords();
      })
      .catch(function (err) {
        if (isFoundationSession("words", sessionId) || foundation.uiOpen) {
          exitFoundationUi();
        }
        api.status(err.message || "تعذر بدء لعبة الكلمات.", true);
      });
  }

  function paintMental() {
    if (foundation.activeKey !== "mental") return;
    var host = stageHost();
    var item = mental.items[mental.index];
    if (!host || !item) return;
    host.hidden = false;
    host.setAttribute("data-active-game", "mental");
    host.setAttribute("data-phase", "play");
    host.setAttribute("data-session", String(mental.sessionId || foundation.sessionId));
    host.setAttribute("data-qid", String(item.id || mental.index));
    var tierLabel = mental.tierLabel || (TIER_BY_LEVEL[mental.level] || {}).label || "الهواة";
    host.innerHTML =
      "<div class=\"mini-hud\"><strong>" +
      esc(foundation.label || "الحساب الذهني") +
      " · " +
      esc(tierLabel) +
      "</strong><span id=\"foundation-timer\" class=\"foundation-hud-num\" dir=\"ltr\">" +
      east(mental.left) +
      " ث</span><span dir=\"ltr\" class=\"etec-code\">٣-١-١-٢</span></div>" +
      "<p class=\"q-stem mental-stem\">" +
      esc(item.stem || "") +
      "</p><div class=\"q-choices\">" +
      ["A", "B", "C", "D"]
        .map(function (letter) {
          return (
            "<button type=\"button\" class=\"q-choice\" data-mental-choice=\"" +
            letter +
            "\"><span class=\"letter\">" +
            ({ A: "أ", B: "ب", C: "ج", D: "د" }[letter] || letter) +
            "</span>" +
            esc((item.choices && item.choices[letter]) || "") +
            "</button>"
          );
        })
        .join("") +
      "</div>";
  }

  function finishMental(sessionId) {
    if (sessionId != null && !isFoundationSession("mental", sessionId)) {
      stopMentalTimer();
      return;
    }
    stopMentalTimer();
    if (foundation.activeKey === "mental") {
      foundation.activeKey = "";
      foundation.sessionId += 1;
    }
    var elapsed = (Date.now() - mental.started) / 1000;
    var total = Math.max(mental.items.length, 1);
    api
      .fetchJson("/api/portal/games/mental/finish", {
        method: "POST",
        headers: api.authHeaders(),
        body: JSON.stringify({
          mode: mental.mode,
          level: mental.level,
          answers: mental.answers,
          elapsed_sec: elapsed
        })
      })
      .then(function (pack) {
        if (foundation.activeKey) return;
        paintEndRound(pack, {
          kind: "mental",
          title: "انتهى الحساب الذهني",
          level: mental.level,
          mode: mental.mode,
          tierId: mental.tierId || (TIER_BY_LEVEL[mental.level] || {}).id || "amateur",
          tierLabel: mental.tierLabel || (TIER_BY_LEVEL[mental.level] || {}).label || "الهواة",
          total: total,
          elapsed: elapsed,
          pulseGame: "mental",
          etec_ar: "٣-١-١-٢"
        });
        if (api.refresh) api.refresh();
      })
      .catch(function (err) {
        api.status(err.message || "تعذر حفظ النتيجة.", true);
      });
  }

  function startMental(level, mode, tierId) {
    mental.level = Number(level || 1);
    mental.mode = mode || "solo";
    var mapped = TIER_BY_LEVEL[mental.level] || { id: "amateur", label: "الهواة" };
    mental.tierId = tierId || mapped.id;
    mental.tierLabel = (TIER_BY_LEVEL[LEVEL_BY_TIER[mental.tierId] || mental.level] || mapped).label;
    if (tierId && LEVEL_BY_TIER[tierId]) {
      mental.level = LEVEL_BY_TIER[tierId];
      mental.tierId = tierId;
      mental.tierLabel = (TIER_BY_LEVEL[mental.level] || mapped).label;
    }
    var sessionId = beginFoundationSession("mental");
    mental.sessionId = sessionId;
    api
      .fetchJson(
        "/api/portal/games/mental/start?level=" +
          encodeURIComponent(mental.level) +
          "&tier=" +
          encodeURIComponent(mental.tierId) +
          "&count=10",
        { headers: api.authHeaders(), cache: "no-store" }
      )
      .then(function (pack) {
        if (!isFoundationSession("mental", sessionId)) return;
        mental.items = pack.items || [];
        mental.index = 0;
        mental.answers = [];
        mental.left = Number(pack.seconds || 60);
        mental.started = Date.now();
        if (pack.tier && pack.tier.label) {
          mental.tierLabel = pack.tier.label;
          mental.tierId = pack.tier.id || mental.tierId;
        }
        if (pack.level) mental.level = Number(pack.level);
        stopMentalTimer();
        mental.timer = setInterval(function () {
          if (!isFoundationSession("mental", sessionId)) {
            stopMentalTimer();
            return;
          }
          mental.left -= 1;
          updateFoundationTimerHud(mental.left);
          if (mental.left <= 0) finishMental(sessionId);
        }, 1000);
        paintMental();
      })
      .catch(function (err) {
        if (isFoundationSession("mental", sessionId) || foundation.uiOpen) {
          exitFoundationUi();
        }
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
    if (wordsBtn) {
      wordsBtn.addEventListener("click", function () {
        openFoundationLobby("words", "lang");
      });
    }
    var quranBtn = el("btn-quran-words");
    if (quranBtn) {
      quranBtn.addEventListener("click", function () {
        openFoundationLobby("words", "quran");
      });
    }
    var mentalBtn = el("btn-mental");
    if (mentalBtn) {
      mentalBtn.addEventListener("click", function () {
        openFoundationLobby("mental", "");
      });
    }
    var backBtn = el("btn-foundation-back");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        exitFoundationUi();
      });
    }
    var stage = stageHost();
    if (stage) {
      stage.addEventListener("click", function (event) {
        if (event.target.closest("[data-foundation-exit]") || event.target.closest("[data-end-games]")) {
          exitFoundationUi();
          return;
        }
        if (event.target.closest("[data-end-replay]")) {
          replayLastRound();
          return;
        }
        if (event.target.closest("[data-end-arena]")) {
          goToArenaStation();
          return;
        }
        var stationBtn = event.target.closest("[data-end-station]");
        if (stationBtn) {
          var sid = stationBtn.getAttribute("data-end-station") || "";
          exitFoundationUi();
          if (sid && window.PortalStudentStations && typeof window.PortalStudentStations.open === "function") {
            window.PortalStudentStations.open(sid);
          }
          return;
        }
        if (event.target.closest("[data-foundation-start]")) {
          launchFoundationPlay();
          return;
        }
        var lobbyTier = event.target.closest("[data-lobby-tier]");
        if (lobbyTier && foundation.phase === "lobby") {
          foundation.pendingTier = lobbyTier.getAttribute("data-lobby-tier") || "amateur";
          foundation.pendingLevel = LEVEL_BY_TIER[foundation.pendingTier] || 1;
          paintFoundationLobby();
          return;
        }
        var lobbyMode = event.target.closest("[data-lobby-mode]");
        if (lobbyMode && foundation.phase === "lobby") {
          foundation.pendingMode = lobbyMode.getAttribute("data-lobby-mode") || "solo";
          api.status(foundation.pendingMode === "tournament" ? "وضع: بطولة الفصول" : "وضع: فردي");
          return;
        }
        var wc = event.target.closest("[data-word-choice]");
        if (wc) {
          if (foundation.activeKey !== "words") return;
          var r = words.rounds[words.index];
          var choice = wc.getAttribute("data-word-choice");
          var ok = r && choice === r.correct;
          words.answers.push({
            id: r.id,
            choice: choice,
            ok: !!ok,
            kind: (r && r.kind) || "meaning",
            stem: (r && r.prompt) || "",
            correct: (r && r.correct) || "",
            choices: (r && r.choices) || null,
            choice_label:
              r && r.choices && choice ? String(r.choices[choice] || "") : "",
            correct_label:
              r && r.choices && r.correct
                ? String(r.choices[r.correct] || "")
                : "",
            rationale: (r && r.rationale) || ""
          });
          words.combo = ok ? words.combo + 1 : 0;
          if (words.combo > words.best) words.best = words.combo;
          words.index += 1;
          if (words.index >= words.rounds.length) finishWords(words.sessionId);
          else paintWords();
          return;
        }
        var mc = event.target.closest("[data-mental-choice]");
        if (mc) {
          if (foundation.activeKey !== "mental") return;
          var item = mental.items[mental.index];
          var ch = mc.getAttribute("data-mental-choice");
          var good = item && ch === item.correct;
          mental.answers.push({
            id: item.id,
            choice: ch,
            ok: !!good,
            tier: mental.tierId || "amateur",
            stem: (item && item.stem) || "",
            correct: (item && item.correct) || "",
            choices: (item && item.choices) || null,
            choice_label:
              item && item.choices && ch ? String(item.choices[ch] || "") : "",
            correct_label:
              item && item.choices && item.correct
                ? String(item.choices[item.correct] || "")
                : "",
            rationale: (item && item.rationale) || ""
          });
          mental.index += 1;
          if (mental.index >= mental.items.length) finishMental(mental.sessionId);
          else paintMental();
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
    onQuestionPainted: onQuestionPainted,
    renderProgressPulse: renderProgressPulse,
    renderLegendBar: renderLegendBar,
    renderRankGap: renderRankGap,
    renderPathHint: renderPathHint,
    renderRoundReview: renderRoundReview,
    bindRoundReviewTabs: bindRoundReviewTabs,
    paintEndRound: paintEndRound
  };
})();
