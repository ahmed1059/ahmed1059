/* Error Vault + مؤشر إتقان + قراءة متزامنة + اختبار منزلي OMR */
(function () {
  "use strict";

  var api = null;
  var readState = {
    passage: null,
    sentenceIndex: 0,
    speaking: false,
    rate: 1,
    answers: {},
    utter: null
  };

  function el(id) {
    return document.getElementById(id);
  }

  function paintHomeExtras(home) {
    var vault = home.error_vault || {};
    var mastery = home.mastery || {};
    var banner = el("purge-banner");
    if (banner) {
      banner.textContent =
        vault.purge_label ||
        "لا أخطاء عالقة حالياً — واصل التحدي لبناء مؤشر إتقان أقوى.";
    }
    var vaultHost = el("vault-list");
    if (vaultHost) {
      var items = vault.items || [];
      vaultHost.innerHTML = items.length
        ? items
            .map(function (row) {
              var visual = row.visual || {};
              return (
                "<article class=\"vault-tile domain-" +
                api.escapeHtml(row.domain || "") +
                "\"><strong>" +
                api.escapeHtml(row.skill || "") +
                " · حرارة " +
                api.toEastern(row.trap_heat || 1) +
                "</strong><div class=\"trap-examples\">" +
                "<div class=\"trap-ex wrong\"><b>❌ " +
                api.escapeHtml(visual.title ? "الخطأ" : "الخطأ") +
                "</b>" +
                (api.renderArabicMath
                  ? api.renderArabicMath(row.wrong_example || row.common_mistake || "")
                  : api.escapeHtml(row.wrong_example || row.common_mistake || "")) +
                "</div><div class=\"trap-ex correct\"><b>✅ الصواب</b>" +
                (api.renderArabicMath
                  ? api.renderArabicMath(row.correct_example || row.golden_rule || "")
                  : api.escapeHtml(row.correct_example || row.golden_rule || "")) +
                "</div></div><small>" +
                api.escapeHtml((visual && visual.hint) || "") +
                " · " +
                api.toEastern(((row.etec || {}).code_ar || (row.etec || {}).code || "")) +
                "</small></article>"
              );
            })
            .join("")
        : "<p class=\"portal-empty\">سجل الأخطاء فارغ — ممتاز.</p>";
    }
    var bars = el("mastery-bars");
    if (bars) {
      var domains = mastery.domains || {};
      bars.innerHTML =
        "<div class=\"mastery-overall\">مؤشر الإتقان العام: <strong>" +
        api.toEastern(mastery.overall || 0) +
        "٪</strong></div>" +
        ["reading", "math", "science"]
          .map(function (key) {
            var d = domains[key] || {};
            var pct = Number(d.mastery_index || 0);
            return (
              "<div class=\"mastery-row\"><span>" +
              api.escapeHtml(((d.etec || {}).label) || key) +
              " · " +
              api.toEastern(((d.etec || {}).code_ar || (d.etec || {}).code || "")) +
              "</span><div class=\"mastery-track\"><i style=\"width:" +
              pct +
              "%\"></i></div><strong>" +
              api.toEastern(pct) +
              "٪</strong><small>استعادة " +
              api.toEastern(d.recovery_rate || 0) +
              "٪</small></div>"
            );
          })
          .join("");
    }
  }

  function sceneSvg(scene, gradient) {
    var g = gradient || ["#0b5e56", "#67e8f9"];
    return (
      '<svg viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg" class="ra-scene" aria-hidden="true">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="' +
      g[0] +
      '"/><stop offset="100%" stop-color="' +
      g[1] +
      '"/></linearGradient></defs>' +
      '<rect width="320" height="160" rx="18" fill="url(#g)"/>' +
      '<circle cx="260" cy="36" r="22" fill="rgba(255,255,255,0.35)"/>' +
      '<path d="M20 120 Q80 70 140 110 T260 100 L300 160 L20 160 Z" fill="rgba(255,255,255,0.22)"/>' +
      "</svg>"
    );
  }

  function loadReadalongList() {
    api
      .fetchJson("/api/portal/readalong/passages", { headers: api.authHeaders(), cache: "no-store" })
      .then(function (pack) {
        var host = el("readalong-list");
        if (!host) return;
        host.innerHTML = (pack.passages || [])
          .map(function (p) {
            return (
              "<button type=\"button\" class=\"ra-card\" data-passage=\"" +
              api.escapeHtml(p.id) +
              "\">" +
              sceneSvg((p.image && p.image.scene) || "", (p.image && p.image.gradient) || null) +
              "<strong>" +
              api.escapeHtml(p.title || "") +
              "</strong><span>" +
              api.escapeHtml(p.kind || "") +
              " · " +
              api.toEastern(p.questions_count || 5) +
              " أسئلة" +
              (p.completed ? " · مكتملة" : "") +
              "</span></button>"
            );
          })
          .join("");
      })
      .catch(function () {});
  }

  function stopSpeech() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    readState.speaking = false;
    readState.utter = null;
  }

  function highlightSentence(idx) {
    Array.prototype.forEach.call(document.querySelectorAll(".ra-sentence"), function (node, i) {
      node.classList.toggle("is-active", i === idx);
    });
    var active = document.querySelector(".ra-sentence.is-active");
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function speakFrom(index) {
    if (!readState.passage || !window.speechSynthesis) {
      api.status("محرك النطق غير متاح في هذا المتصفح — يمكنك القراءة يدوياً.", true);
      return;
    }
    stopSpeech();
    var sentences = readState.passage.sentences || [];
    function next(i) {
      if (i >= sentences.length) {
        readState.speaking = false;
        highlightSentence(-1);
        return;
      }
      readState.sentenceIndex = i;
      highlightSentence(i);
      var u = new SpeechSynthesisUtterance(sentences[i]);
      u.lang = "ar-SA";
      u.rate = readState.rate || 1;
      u.onend = function () {
        next(i + 1);
      };
      readState.utter = u;
      readState.speaking = true;
      window.speechSynthesis.speak(u);
    }
    next(Math.max(0, index || 0));
  }

  function paintPassage(passage) {
    readState.passage = passage;
    readState.answers = {};
    var stage = el("readalong-stage");
    if (!stage) return;
    stage.hidden = false;
    var sentences = passage.sentences || [];
    stage.innerHTML =
      "<div class=\"ra-layout\">" +
      "<div class=\"ra-visual\">" +
      sceneSvg((passage.image && passage.image.scene) || "", (passage.image && passage.image.gradient) || null) +
      "<p>" +
      api.escapeHtml((passage.image && passage.image.alt) || "") +
      "</p></div>" +
      "<div class=\"ra-text-pane\">" +
      "<h3>" +
      api.escapeHtml(passage.title || "") +
      "</h3>" +
      "<div class=\"ra-controls\">" +
      "<button type=\"button\" class=\"portal-btn\" id=\"ra-play\">تشغيل القراءة</button>" +
      "<button type=\"button\" class=\"portal-btn secondary\" id=\"ra-pause\">إيقاف</button>" +
      "<button type=\"button\" class=\"portal-btn secondary\" data-rate=\"0.75\">بطيء</button>" +
      "<button type=\"button\" class=\"portal-btn secondary\" data-rate=\"1\">طبيعي</button>" +
      "<button type=\"button\" class=\"portal-btn secondary\" data-rate=\"1.2\">سريع</button>" +
      "</div>" +
      "<div class=\"ra-sentences\">" +
      sentences
        .map(function (s, i) {
          return "<p class=\"ra-sentence\" data-si=\"" + i + "\">" + api.escapeHtml(s) + "</p>";
        })
        .join("") +
      "</div>" +
      "<div class=\"ra-vocab\">" +
      (passage.vocab || [])
        .map(function (v) {
          return (
            "<button type=\"button\" class=\"ra-word\" data-word=\"" +
            api.escapeHtml(v.word) +
            "\" data-meaning=\"" +
            api.escapeHtml(v.meaning || "") +
            "\" data-antonym=\"" +
            api.escapeHtml(v.antonym || "") +
            "\">" +
            api.escapeHtml(v.word) +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      "<div id=\"ra-word-card\" class=\"ra-word-card\" hidden></div>" +
      "<h3>أسئلة الفهم</h3>" +
      "<div id=\"ra-questions\" class=\"ra-questions\">" +
      (passage.questions || [])
        .map(function (q) {
          return (
            "<article class=\"ra-q\" data-qid=\"" +
            q.id +
            "\"><strong>" +
            api.escapeHtml(q.level || "") +
            "</strong><p>" +
            api.escapeHtml(q.stem || "") +
            "</p><div class=\"q-choices\">" +
            ["A", "B", "C", "D"]
              .map(function (L) {
                return (
                  "<button type=\"button\" class=\"q-choice\" data-ra-choice=\"" +
                  L +
                  "\" data-qid=\"" +
                  q.id +
                  "\"><span class=\"letter\">" +
                  ({ A: "أ", B: "ب", C: "ج", D: "د" }[L] || L) +
                  "</span>" +
                  api.escapeHtml((q.choices && q.choices[L]) || "") +
                  "</button>"
                );
              })
              .join("") +
            "</div></article>"
          );
        })
        .join("") +
      "</div>" +
      "<div class=\"portal-actions\"><button type=\"button\" class=\"portal-btn\" id=\"ra-finish\">إنهاء القطعة وحفظ النتيجة</button></div>" +
      "<div id=\"ra-result\"></div>" +
      "</div></div>";
  }

  function openPassage(id) {
    api.status("جارٍ فتح القطعة القرائية…");
    api
      .fetchJson("/api/portal/readalong/passages/" + encodeURIComponent(id), {
        headers: api.authHeaders(),
        cache: "no-store"
      })
      .then(function (pack) {
        paintPassage(pack.passage || {});
        api.status("جاهز للقراءة المتزامنة.");
      })
      .catch(function (err) {
        api.status(err.message || "تعذر فتح القطعة.", true);
      });
  }

  function finishPassage() {
    if (!readState.passage) return;
    var answers = Object.keys(readState.answers).map(function (id) {
      return { id: Number(id), choice: readState.answers[id] };
    });
    api
      .fetchJson("/api/portal/readalong/finish", {
        method: "POST",
        headers: api.authHeaders(),
        body: JSON.stringify({
          passage_id: readState.passage.id,
          answers: answers,
          listened: true
        })
      })
      .then(function (pack) {
        var host = el("ra-result");
        if (host) {
          host.innerHTML =
            "<p class=\"portal-empty\">النتيجة: " +
            api.toEastern(pack.score || 0) +
            " / " +
            api.toEastern(pack.total || 5) +
            " · +" +
            api.toEastern(pack.xp_earned || 0) +
            " XP</p>" +
            (pack.review || [])
              .map(function (r) {
                if (r.ok) return "";
                return (
                  "<div class=\"trap-ex wrong\" data-jump-sentence=\"" +
                  (r.sentence_index || 0) +
                  "\">أعد قراءة الجملة المظللة: " +
                  api.escapeHtml(r.evidence || "") +
                  "</div>"
                );
              })
              .join("");
        }
        (pack.review || []).forEach(function (r) {
          if (!r.ok) highlightSentence(Number(r.sentence_index || 0));
        });
        if (pack.score >= 4 && window.PortalStudentFx) window.PortalStudentFx.confetti();
        loadReadalongList();
        if (api.refresh) api.refresh();
      })
      .catch(function (err) {
        api.status(err.message || "تعذر الحفظ.", true);
      });
  }

  function printHomeMock(pack) {
    var items = pack.items || [];
    var key = pack.answer_key || [];
    var letters = { A: "أ", B: "ب", C: "ج", D: "د" };
    var body =
      "<h2 style=\"color:#0b5e56;text-align:center;\">اختبار منزلي بإشراف ولي الأمر</h2>" +
      "<p><strong>الطالب:</strong> " +
      api.escapeHtml(pack.student_name || "") +
      " · الصف " +
      api.escapeHtml(pack.grade || "") +
      " / فصل " +
      api.toEastern(pack.section || "") +
      " · المدرسة " +
      api.escapeHtml(pack.school || "") +
      " (" +
      api.toEastern(pack.code || "40341") +
      ")</p>" +
      items
        .map(function (q) {
          return (
            "<p style=\"margin:10px 0;\"><strong>" +
            api.toEastern(q.n) +
            ".</strong> " +
            api.escapeHtml(q.stem || "") +
            "<br>" +
            ["A", "B", "C", "D"]
              .map(function (L) {
                return (
                  "<span style=\"margin-left:10px;\">" +
                  letters[L] +
                  ") " +
                  api.escapeHtml((q.choices || {})[L] || "") +
                  "</span>"
                );
              })
              .join(" ") +
            "</p>"
          );
        })
        .join("") +
      "<div style=\"page-break-before:always\"></div>" +
      "<h2 style=\"color:#0b5e56;\">ورقة التظليل OMR</h2>" +
      "<div style=\"display:grid;grid-template-columns:repeat(5,1fr);gap:8px;\">" +
      items
        .map(function (q) {
          return (
            "<div style=\"border:1px solid #ccc;padding:8px;font-size:12px;\">" +
            api.toEastern(q.n) +
            "<br>أ ○ ب ○ ج ○ د ○</div>"
          );
        })
        .join("") +
      "</div>" +
      "<div style=\"page-break-before:always\"></div>" +
      "<h2 style=\"color:#0b5e56;\">مفتاح التصحيح لولي الأمر</h2>" +
      "<ol>" +
      key
        .map(function (r) {
          return (
            "<li>" +
            api.toEastern(r.n) +
            " → " +
            api.escapeHtml(r.answer || "") +
            " · " +
            api.escapeHtml(r.skill || "") +
            "</li>"
          );
        })
        .join("") +
      "</ol>" +
      "<h3 style=\"color:#0b5e56;\">إقرار ولي الأمر المراقب (شاهد ١-٣-١-٢)</h3>" +
      "<p>" +
      api.escapeHtml(pack.parent_pledge || "") +
      "</p>" +
      "<p style=\"margin-top:28px;\">اسم ولي الأمر: ........................ &nbsp;&nbsp; التوقيع: ........................ &nbsp;&nbsp; التاريخ: ............</p>";

    if (window.PrintEngine && typeof window.PrintEngine.open === "function") {
      window.PrintEngine.open("master-sheet", {
        docTitle: "اختبار منزلي",
        title: "اختبار منزلي بإشراف ولي الأمر + OMR",
        kind: "document",
        orientation: "portrait",
        multiPage: true,
        school: pack.school || "متوسطة سعد بن الربيع الأنصاري",
        bodyHtml: body,
        signoff: true,
        maxColumns: 2,
        pageTotal: 3
      });
    } else {
      var w = window.open("", "_blank");
      if (w) {
        w.document.write("<html lang=\"ar\" dir=\"rtl\"><head><title>اختبار منزلي</title></head><body>" + body + "</body></html>");
        w.document.close();
        w.print();
      }
    }
  }

  function requestHomeMock() {
    api.status("جارٍ توليد الاختبار المنزلي…");
    api
      .fetchJson("/api/portal/home-mock/pack", { headers: api.authHeaders(), cache: "no-store" })
      .then(function (pack) {
        printHomeMock(pack.pack || {});
        api.status("ورقة الاختبار وOMR ومفتاح ولي الأمر جاهزة للطباعة.");
      })
      .catch(function (err) {
        api.status(err.message || "تعذر التوليد.", true);
      });
  }

  function bind() {
    var list = el("readalong-list");
    if (list) {
      list.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-passage]");
        if (btn) openPassage(btn.getAttribute("data-passage"));
      });
    }
    var purge = el("btn-purge");
    if (purge && api.startMode) {
      purge.addEventListener("click", function () {
        api.startMode("purge");
      });
    }
    var homeMock = el("btn-home-mock");
    if (homeMock) homeMock.addEventListener("click", requestHomeMock);

    document.body.addEventListener("click", function (event) {
      if (!el("readalong-stage") || el("readalong-stage").hidden) return;
      if (event.target.id === "ra-play") {
        speakFrom(readState.sentenceIndex || 0);
        return;
      }
      if (event.target.id === "ra-pause") {
        stopSpeech();
        return;
      }
      var rateBtn = event.target.closest("[data-rate]");
      if (rateBtn) {
        readState.rate = Number(rateBtn.getAttribute("data-rate") || 1);
        return;
      }
      var word = event.target.closest(".ra-word");
      if (word) {
        stopSpeech();
        var card = el("ra-word-card");
        if (card) {
          card.hidden = false;
          card.innerHTML =
            "<strong>" +
            api.escapeHtml(word.getAttribute("data-word") || "") +
            "</strong><div>المعنى: " +
            api.escapeHtml(word.getAttribute("data-meaning") || "") +
            "</div><div>الضد: " +
            api.escapeHtml(word.getAttribute("data-antonym") || "") +
            "</div><button type=\"button\" class=\"portal-btn secondary\" id=\"ra-say-word\">سماع النطق</button>";
          var say = el("ra-say-word");
          if (say && window.speechSynthesis) {
            say.onclick = function () {
              var u = new SpeechSynthesisUtterance(word.getAttribute("data-word") || "");
              u.lang = "ar-SA";
              window.speechSynthesis.speak(u);
            };
          }
        }
        return;
      }
      var choice = event.target.closest("[data-ra-choice]");
      if (choice) {
        var qid = choice.getAttribute("data-qid");
        readState.answers[qid] = choice.getAttribute("data-ra-choice");
        var article = choice.closest(".ra-q");
        if (article) {
          Array.prototype.forEach.call(article.querySelectorAll(".q-choice"), function (node) {
            node.classList.toggle("is-selected", node === choice);
          });
        }
        return;
      }
      if (event.target.id === "ra-finish") {
        finishPassage();
        return;
      }
      var jump = event.target.closest("[data-jump-sentence]");
      if (jump) {
        highlightSentence(Number(jump.getAttribute("data-jump-sentence") || 0));
      }
    });
  }

  function boot(helpers) {
    api = helpers;
    bind();
    loadReadalongList();
  }

  window.PortalStudentAdaptive = {
    boot: boot,
    paintHomeExtras: paintHomeExtras,
    loadReadalongList: loadReadalongList
  };
})();
