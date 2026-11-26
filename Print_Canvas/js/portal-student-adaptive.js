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

  function east(value) {
    if (!api || typeof api.toEastern !== "function") {
      return value == null ? "" : String(value);
    }
    return api.toEastern(value == null ? "" : value);
  }

  function etecHtml(code) {
    if (api && typeof api.formatEtecCode === "function") {
      return api.formatEtecCode(code);
    }
    var raw = east(code);
    return raw ? '<span class="etec-code" dir="ltr">' + raw + "</span>" : "";
  }

  function esc(value) {
    if (!api || typeof api.escapeHtml !== "function") {
      return value == null ? "" : String(value);
    }
    return api.escapeHtml(value == null ? "" : value);
  }

  function paintHomeExtras(home) {
    if (!api) {
      return;
    }
    home = home || {};
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
                esc(row.domain || "") +
                "\"><strong>" +
                esc(row.skill || "") +
                " · حرارة " +
                east(row.trap_heat || 1) +
                "</strong><div class=\"trap-examples\">" +
                "<div class=\"trap-ex wrong\"><b>❌ الخطأ</b>" +
                (api.renderArabicMath
                  ? api.renderArabicMath(row.wrong_example || row.common_mistake || "")
                  : esc(row.wrong_example || row.common_mistake || "")) +
                "</div><div class=\"trap-ex correct\"><b>✅ الصواب</b>" +
                (api.renderArabicMath
                  ? api.renderArabicMath(row.correct_example || row.golden_rule || "")
                  : esc(row.correct_example || row.golden_rule || "")) +
                "</div></div><small>" +
                esc((visual && visual.hint) || "") +
                " · " +
                etecHtml(((row.etec || {}).code_ar || (row.etec || {}).code || "")) +
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
        east(mastery.overall || 0) +
        "٪</strong></div>" +
        ["reading", "math", "science"]
          .map(function (key) {
            var d = domains[key] || {};
            var pct = Number(d.mastery_index || 0);
            return (
              "<div class=\"mastery-row\"><span>" +
              esc(((d.etec || {}).label) || key) +
              " · " +
              etecHtml(((d.etec || {}).code_ar || (d.etec || {}).code || "")) +
              "</span><div class=\"mastery-track\"><i style=\"width:" +
              pct +
              "%\"></i></div><strong>" +
              east(pct) +
              "٪</strong><small>استعادة " +
              east(d.recovery_rate || 0) +
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
    if (!api) return;
    api
      .fetchJson("/api/portal/readalong/passages", { headers: api.authHeaders(), cache: "no-store" })
      .then(function (pack) {
        var host = el("readalong-list");
        if (!host) return;
        host.innerHTML = (pack.passages || [])
          .map(function (p) {
            return (
              "<button type=\"button\" class=\"ra-card\" data-passage=\"" +
              esc(p.id) +
              "\">" +
              sceneSvg((p.image && p.image.scene) || "", (p.image && p.image.gradient) || null) +
              "<strong>" +
              esc(p.title || "") +
              "</strong><span>" +
              esc(p.kind || "") +
              " · " +
              east(p.questions_count || 5) +
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
      esc((passage.image && passage.image.alt) || "") +
      "</p></div>" +
      "<div class=\"ra-text-pane\">" +
      "<h3>" +
      esc(passage.title || "") +
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
          return "<p class=\"ra-sentence\" data-si=\"" + i + "\">" + esc(s) + "</p>";
        })
        .join("") +
      "</div>" +
      "<div class=\"ra-vocab\">" +
      (passage.vocab || [])
        .map(function (v) {
          return (
            "<button type=\"button\" class=\"ra-word\" data-word=\"" +
            esc(v.word) +
            "\" data-meaning=\"" +
            esc(v.meaning || "") +
            "\" data-antonym=\"" +
            esc(v.antonym || "") +
            "\">" +
            esc(v.word) +
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
            esc(q.level || "") +
            "</strong><p>" +
            esc(q.stem || "") +
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
                  esc((q.choices && q.choices[L]) || "") +
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
            east(pack.score || 0) +
            " / " +
            east(pack.total || 5) +
            " · +" +
            east(pack.xp_earned || 0) +
            " XP</p>" +
            (pack.review || [])
              .map(function (r) {
                if (r.ok) return "";
                return (
                  "<div class=\"trap-ex wrong\" data-jump-sentence=\"" +
                  (r.sentence_index || 0) +
                  "\">أعد قراءة الجملة المظللة: " +
                  esc(r.evidence || "") +
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

  function homeMockCssHref() {
    var links = document.querySelectorAll("link[rel=\"stylesheet\"]");
    for (var i = 0; i < links.length; i += 1) {
      var href = links[i].getAttribute("href") || "";
      if (href.indexOf("nafs-wave-c-answer-sheet.css") !== -1) return href;
    }
    return "css/nafs-wave-c-answer-sheet.css";
  }

  function printHomeMock(pack) {
    var items = pack.items || [];
    var key = pack.answer_key || [];
    var letters = { A: "أ", B: "ب", C: "ج", D: "د" };
    var sheetApi = window.NafsWaveCAnswerSheet || {};
    var omrHtml = "";
    if (pack.omr_sheet && typeof sheetApi.renderOmrOnly === "function") {
      omrHtml = sheetApi.renderOmrOnly(pack.omr_sheet);
    } else if (typeof sheetApi.renderOmrOnly === "function" && items.length) {
      omrHtml = sheetApi.renderOmrOnly({
        omr_only: true,
        title: "ورقة التظليل OMR — اختبار منزلي",
        school: {
          name: pack.school || "",
          code: pack.code || "40341",
          code_ar: pack.code_ar || east(pack.code || "40341"),
          ministry_id_ar: pack.ministry_id_ar || ""
        },
        student: {
          name: pack.student_name || "",
          national_id: pack.student_nid || "",
          grade: pack.grade || "",
          section: pack.section || ""
        },
        answer_sheet: {
          item_count: items.length,
          item_count_ar: east(items.length),
          columns: [
            {
              items: items.map(function (q) {
                return { n: q.n, n_ar: east(q.n), choices: ["أ", "ب", "ج", "د"] };
              })
            }
          ],
          school_code_grid: { columns: 6, label: "رمز المدرسة", digits: [] },
          national_id_grid: { columns: 10, label: "رقم السجل المدني / رقم الإقامة", digits: [] }
        },
        labels_ar: { ministry_no: "الرقم الوزاري", answers: "إجابات الأسئلة" }
      });
    } else {
      omrHtml =
        "<p class=\"portal-empty\">تعذر تحميل قالب OMR المعتمد (Sky Blue). أعد تحميل الصفحة.</p>";
    }

    var booklet =
      "<section class=\"home-mock-booklet\" dir=\"rtl\">" +
      "<h2 style=\"color:#0b5e56;text-align:center;\">اختبار منزلي بإشراف ولي الأمر</h2>" +
      "<p><strong>الطالب:</strong> " +
      esc(pack.student_name || "") +
      " · الصف " +
      esc(pack.grade || "") +
      " / فصل " +
      east(pack.section || "") +
      " · المدرسة " +
      esc(pack.school || "") +
      " · الرقم الوزاري <span class=\"etec-ltr\" dir=\"ltr\">" +
      esc(pack.ministry_id_ar || pack.code_ar || east(pack.code || "40341")) +
      "</span>" +
      " · شاهد <span class=\"etec-code\" dir=\"ltr\">" +
      esc(pack.evidence_code_ar || "١-٣-١-٢") +
      "</span></p>" +
      items
        .map(function (q) {
          return (
            "<p style=\"margin:10px 0;\"><strong>" +
            east(q.n) +
            ".</strong> " +
            esc(q.stem || "") +
            "<br>" +
            ["A", "B", "C", "D"]
              .map(function (L) {
                return (
                  "<span style=\"margin-left:10px;\">" +
                  letters[L] +
                  ") " +
                  esc((q.choices || {})[L] || "") +
                  "</span>"
                );
              })
              .join(" ") +
            "</p>"
          );
        })
        .join("") +
      "</section>";

    var keyHtml =
      "<section class=\"home-mock-key\" dir=\"rtl\" style=\"page-break-before:always\">" +
      "<h2 style=\"color:#0b5e56;\">مفتاح التصحيح لولي الأمر</h2>" +
      (key.length
        ? "<ol>" +
          key
            .map(function (r) {
              return (
                "<li>" +
                east(r.n) +
                " → " +
                esc(r.answer || "") +
                " · " +
                esc(r.skill || "") +
                "</li>"
              );
            })
            .join("") +
          "</ol>"
        : "<p>لا مفتاح محفوظ لهذه الحزمة — تُعرض الإجابات المعتمدة فقط عند توفرها في البنك.</p>") +
      "<h3 style=\"color:#0b5e56;\">إقرار ولي الأمر المراقب (شاهد <span class=\"etec-code\" dir=\"ltr\">" +
      esc(pack.evidence_code_ar || "١-٣-١-٢") +
      "</span>)</h3>" +
      "<p>" +
      esc(pack.parent_pledge || "") +
      "</p>" +
      "<p style=\"margin-top:28px;\">اسم ولي الأمر: ........................ &nbsp;&nbsp; التوقيع: ........................ &nbsp;&nbsp; التاريخ: ............</p>" +
      "</section>";

    var wrapped =
      "<link rel=\"stylesheet\" href=\"" +
      esc(homeMockCssHref()) +
      "\">" +
      "<div class=\"nafs-c-print-root home-mock-print\" dir=\"rtl\" lang=\"ar\">" +
      booklet +
      "<div style=\"page-break-before:always\"></div>" +
      omrHtml +
      keyHtml +
      "</div>";

    function openVisiblePreview() {
      var w = window.open("", "_blank");
      if (!w) return false;
      w.document.write(
        "<!DOCTYPE html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\"><title>اختبار منزلي</title>" +
          "<link rel=\"stylesheet\" href=\"" +
          esc(homeMockCssHref()) +
          "\"></head><body>" +
          booklet +
          "<div style=\"page-break-before:always\"></div>" +
          omrHtml +
          keyHtml +
          "<script>window.addEventListener('load',function(){try{window.focus();window.print();}catch(e){}});<\/script>" +
          "</body></html>"
      );
      w.document.close();
      return true;
    }

    if (window.PrintEngine && typeof window.PrintEngine.open === "function") {
      var opened = window.PrintEngine.open("raw-html", {
        html: wrapped,
        docTitle: "اختبار منزلي بإشراف ولي الأمر + OMR",
        multiPage: true,
        orientation: "portrait",
        arm: { orientation: "portrait", multiPage: true }
      });
      if (opened && opened.ok) {
        return { ok: true, via: opened.via || "print-engine", preview: !!opened.preview };
      }
    }
    if (openVisiblePreview()) {
      return { ok: true, via: "window-open", preview: true };
    }
    return { ok: false, error: "تعذر فتح المعاينة أو حوار الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة." };
  }

  function requestHomeMock() {
    api.status("جارٍ توليد الاختبار المنزلي…");
    api
      .fetchJson("/api/portal/home-mock/pack", { headers: api.authHeaders(), cache: "no-store" })
      .then(function (pack) {
        var result = printHomeMock(pack.pack || {});
        if (result && result.ok) {
          api.status(
            result.preview
              ? "المعاينة جاهزة — اطبع من النافذة أو حوار الطباعة."
              : "حوار الطباعة جاهز (كراسة + OMR + مفتاح). إن لم يظهر اسمح بالنوافذ المنبثقة."
          );
          return;
        }
        api.status((result && result.error) || "تعذر فتح المعاينة أو الطباعة.", true);
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
    var answerSheetBtn = el("btn-nafs-answer-sheet");
    if (answerSheetBtn) {
      answerSheetBtn.addEventListener("click", function () {
        api.status("جارٍ تجهيز نموذج الإجابة التدريبي…");
        api
          .fetchJson("/api/portal/answer-sheet-training", { headers: api.authHeaders(), cache: "no-store" })
          .then(function (pack) {
            if (window.NafsWaveCAnswerSheet && typeof window.NafsWaveCAnswerSheet.openPrint === "function") {
              window.NafsWaveCAnswerSheet.openPrint(pack);
              api.status("نموذج الإجابة واستبانة الطالب جاهزان للطباعة/التدريب.");
              return;
            }
            api.status("وحدة النموذج غير محمّلة.", true);
          })
          .catch(function (err) {
            api.status(err.message || "تعذر تجهيز النموذج.", true);
          });
      });
    }

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
            esc(word.getAttribute("data-word") || "") +
            "</strong><div>المعنى: " +
            esc(word.getAttribute("data-meaning") || "") +
            "</div><div>الضد: " +
            esc(word.getAttribute("data-antonym") || "") +
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
