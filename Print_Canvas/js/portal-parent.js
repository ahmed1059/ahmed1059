/* بوابة ولي الأمر — المرحلة ٣: إغلاق حلقة الشراكة الأسرية */
(function () {
  "use strict";

  var TOKEN_KEY = "portalSession";
  var EASTERN = "٠١٢٣٤٥٦٧٨٩";

  function toEastern(t) {
    return String(t == null ? "" : t).replace(/[0-9]/g, function (d) {
      return EASTERN.charAt(Number(d));
    });
  }

  function escapeHtml(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatEtecCode(code) {
    var raw = toEastern(code == null ? "" : code);
    if (!raw) return "";
    return '<span class="etec-code" dir="ltr">' + escapeHtml(raw) + "</span>";
  }

  function maskId(id) {
    return window.NationalIdMask
      ? window.NationalIdMask.mask(id, 3)
      : toEastern(String(id || "").replace(/\d(?=\d{3})/g, "*"));
  }

  function status(msg, err) {
    var el = document.getElementById("parent-status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!err);
  }

  function session() {
    try {
      return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function headers() {
    var raw = session();
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Portal-Token": (raw && raw.token) || ""
    };
  }

  function fetchJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) {
          var detail = body.detail || body.message || "تعذر التنفيذ";
          if (Array.isArray(detail)) {
            detail = detail.map(function (r) { return r.msg || JSON.stringify(r); }).join(" · ");
          }
          var err = new Error(detail);
          err.status = response.status;
          throw err;
        }
        return body;
      });
    });
  }

  function post(path, body) {
    return fetchJson(path, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body || {})
    });
  }

  function paintTraining(links) {
    return (
      "<div class=\"family-train\">" +
      (links || [])
        .map(function (link) {
          return (
            "<a class=\"family-train-card\" href=\"" +
            escapeHtml(link.url || "#") +
            "\" target=\"_blank\" rel=\"noopener\">" +
            "<div class=\"family-qr\">" +
            (link.qr_svg || "") +
            "</div>" +
            "<strong>" +
            escapeHtml(link.label || "") +
            "</strong>" +
            "<small class=\"etec-code\" dir=\"ltr\">" +
            escapeHtml(link.barcode_label || link.code || "") +
            "</small>" +
            "<span>" +
            escapeHtml(link.note || "") +
            "</span></a>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function paintChild(row) {
    var s = row.student || {};
    var nid = s.national_id || "";
    var card = row.partnership_card || {};
    var pledge = row.pledge || {};
    var omr = row.omr || {};
    var loop = row.loop_progress || {};
    var rem = row.remedial || [];
    var runs = row.runs || [];
    var steps = card.steps || [];
    var evidence = row.evidence_feed || [];

    return (
      "<section class=\"portal-card family-child\" data-child=\"" +
      escapeHtml(nid) +
      "\">" +
      "<header class=\"family-child-head\">" +
      "<div><h2>" +
      escapeHtml(s.name || "") +
      "</h2><p>" +
      escapeHtml(s.grade || "") +
      " / فصل " +
      toEastern(s.section || "") +
      " · هوية " +
      maskId(nid) +
      " · XP " +
      toEastern(row.xp || 0) +
      "</p></div>" +
      "<div class=\"family-loop-chip\">" +
      escapeHtml(loop.label_ar || "") +
      "<br><small>مؤشر " +
      formatEtecCode((card.evidence_code_ar || row.evidence_code_ar || "١-٣-١-٢")) +
      "</small></div></header>" +
      "<article class=\"family-partnership\">" +
      "<h3>" +
      escapeHtml(card.title || "الشراكة الأسرية وخطوات الـ ٢٠ دقيقة اليومية") +
      "</h3>" +
      "<p class=\"family-sub\">" +
      escapeHtml(card.subtitle || "") +
      " · أسبوع " +
      escapeHtml(card.week_key || "") +
      " · مكتمل " +
      escapeHtml(card.completed_ar || "") +
      "</p>" +
      "<div class=\"family-steps\" data-weekly-nid=\"" +
      escapeHtml(nid) +
      "\">" +
      steps
        .map(function (step) {
          return (
            "<label class=\"family-step" +
            (step.done ? " is-done" : "") +
            "\"><input type=\"checkbox\" data-check=\"" +
            escapeHtml(step.id) +
            "\"" +
            (step.done ? " checked" : "") +
            "><span><strong>" +
            escapeHtml(step.title || step.label || "") +
            "</strong><small>" +
            escapeHtml(step.hint || step.label || "") +
            "</small></span></label>"
          );
        })
        .join("") +
      "</div>" +
      "<textarea class=\"weekly-note\" rows=\"2\" placeholder=\"ملاحظة أسبوعية اختيارية\">" +
      escapeHtml(card.note || "") +
      "</textarea>" +
      "<div class=\"portal-actions\" style=\"margin-top:8px;\">" +
      "<button type=\"button\" class=\"portal-btn\" data-weekly-save=\"" +
      escapeHtml(nid) +
      "\">حفظ التحقق الأسبوعي</button></div>" +
      "<h4 style=\"margin:14px 0 8px;color:#0b5e56;font-size:15px;\">باركودات وروابط التدريب الإضافية</h4>" +
      paintTraining(card.training_links) +
      "</article>" +
      "<article class=\"family-pledge-box\">" +
      "<h3>التعهد الإلكتروني</h3>" +
      "<p>" +
      escapeHtml(pledge.pledge_text || "أتعهد بدعم ابني وتطبيق الخطة المنزلية") +
      "</p>" +
      "<input class=\"pact-name\" placeholder=\"اسم ولي الأمر\" value=\"" +
      escapeHtml(pledge.signed_name || "") +
      "\">" +
      (pledge.signed
        ? "<p class=\"family-signed\">مُوثَّق في " +
          escapeHtml(toEastern(pledge.signed_at || "")) +
          " · شاهد " +
          formatEtecCode(pledge.evidence_code_ar || "١-٣-١-٢") +
          "</p>"
        : "") +
      "<div class=\"portal-actions\" style=\"margin-top:8px;\">" +
      "<button type=\"button\" class=\"portal-btn\" data-pledge=\"" +
      escapeHtml(nid) +
      "\">" +
      escapeHtml(pledge.button_label || "أتعهد بدعم ابني وتطبيق الخطة المنزلية") +
      "</button></div></article>" +
      "<article class=\"family-omr-box\">" +
      "<h3>الاختبار المنزلي الورقي (OMR)</h3>" +
      "<p class=\"portal-empty\">" +
      escapeHtml(omr.status_ar || "ولّد الورقة ثم أقرّ بالمراجعة المنزلية.") +
      (omr.acknowledged_at
        ? " · " + escapeHtml(toEastern(omr.acknowledged_at))
        : "") +
      "</p>" +
      "<input class=\"home-ack-name\" placeholder=\"اسم ولي الأمر لإقرار المراجعة\">" +
      "<input type=\"hidden\" class=\"home-pack-id\" value=\"" +
      escapeHtml(omr.pack_id || "") +
      "\">" +
      "<div class=\"portal-actions\" style=\"margin-top:8px;\">" +
      "<button type=\"button\" class=\"portal-btn\" data-home-mock=\"" +
      escapeHtml(nid) +
      "\">توليد وطباعة الاختبار المنزلي</button>" +
      "<button type=\"button\" class=\"portal-btn secondary\" data-omr-review=\"" +
      escapeHtml(nid) +
      "\">تأكيد المراجعة المنزلية وإغلاق OMR</button></div>" +
      "<p class=\"family-link-note\">يرتبط الإقرار بتقدم الطالب والعيادات العلاجية المفتوحة (" +
      toEastern(row.open_clinics || 0) +
      ").</p></article>" +
      "<h3 style=\"color:#0b5e56;font-size:16px;\">تطور درجات نافس</h3>" +
      (runs.length
        ? "<ul class=\"portal-list\">" +
          runs
            .map(function (r) {
              return (
                "<li>" +
                escapeHtml(r.label || r.mode) +
                ": " +
                toEastern(r.score_pct) +
                "٪ · +" +
                toEastern(r.xp_earned) +
                " XP</li>"
              );
            })
            .join("") +
          "</ul>"
        : "<p class=\"portal-empty\">لا جولات بعد.</p>") +
      "<h3 style=\"color:#0b5e56;font-size:16px;\">العيادات العلاجية</h3>" +
      (rem.length
        ? "<ul class=\"portal-list\">" +
          rem
            .map(function (r) {
              return (
                "<li>" +
                escapeHtml(r.subject || "") +
                " — " +
                escapeHtml(r.skill || "") +
                (r.grade_root ? " · جذر " + toEastern(r.grade_root) : "") +
                " · " +
                escapeHtml(r.status || "") +
                (r.etec_code_ar || r.etec_code
                  ? " · " + formatEtecCode(r.etec_code_ar || r.etec_code)
                  : "") +
                "</li>"
              );
            })
            .join("") +
          "</ul>"
        : "<p class=\"portal-empty\">لا مهام علاجية حالياً.</p>") +
      "<h3 style=\"color:#0b5e56;font-size:16px;\">سجل الشواهد الحية " +
      formatEtecCode("١-٣-١-٢") +
      "</h3>" +
      (evidence.length
        ? "<ul class=\"portal-list\">" +
          evidence
            .map(function (ev) {
              return (
                "<li>" +
                escapeHtml(ev.name || "") +
                "<br><small>" +
                escapeHtml(toEastern(ev.created_at || "")) +
                " · " +
                escapeHtml(ev.register_key || "") +
                "</small></li>"
              );
            })
            .join("") +
          "</ul>"
        : "<p class=\"portal-empty\">ستظهر التعهدات وإقرارات OMR هنا تلقائياً.</p>") +
      "<details class=\"family-more\"><summary>عذر غياب / تحديث الجوال</summary>" +
      "<input class=\"excuse-date\" type=\"text\" placeholder=\"تاريخ العذر (هجري/ميلادي)\">" +
      "<textarea class=\"excuse-reason\" rows=\"2\" placeholder=\"سبب العذر\"></textarea>" +
      "<div class=\"portal-actions\" style=\"margin-top:8px;\">" +
      "<button type=\"button\" class=\"portal-btn secondary\" data-absence=\"" +
      escapeHtml(nid) +
      "\">رفع العذر</button></div>" +
      "<input class=\"phone-new\" type=\"text\" placeholder=\"الجوال الجديد\">" +
      "<div class=\"portal-actions\" style=\"margin-top:8px;\">" +
      "<button type=\"button\" class=\"portal-btn secondary\" data-phone=\"" +
      escapeHtml(nid) +
      "\">إرسال طلب تحديث الجوال</button></div></details>" +
      "</section>"
    );
  }

  function printHomeMock(pack) {
    var p = pack.pack || pack || {};
    var body =
      "<h2>اختبار منزلي — " +
      escapeHtml(p.student_name || "") +
      "</h2><p>" +
      escapeHtml(p.parent_pledge || "") +
      "</p>" +
      (p.items || [])
        .map(function (q) {
          return (
            "<p><strong>" +
            toEastern(q.n) +
            ".</strong> " +
            escapeHtml(q.stem || "") +
            "</p>"
          );
        })
        .join("") +
      "<h3>مفتاح التصحيح</h3><ol>" +
      (p.answer_key || [])
        .map(function (r) {
          return (
            "<li>" + toEastern(r.n) + " → " + escapeHtml(r.answer || "") + "</li>"
          );
        })
        .join("") +
      "</ol><h3>OMR</h3><div>" +
      (p.items || [])
        .map(function (q) {
          return "<div>" + toEastern(q.n) + ": أ ○ ب ○ ج ○ د ○</div>";
        })
        .join("") +
      "</div>";
    if (window.PrintEngine && window.PrintEngine.open) {
      window.PrintEngine.open("master-sheet", {
        docTitle: "اختبار منزلي",
        title: "اختبار منزلي بإشراف ولي الأمر",
        kind: "document",
        orientation: "portrait",
        multiPage: true,
        school: p.school || "متوسطة سعد بن الربيع الأنصاري",
        bodyHtml: body,
        signoff: true,
        pageTotal: 2
      });
    } else {
      var w = window.open("", "_blank");
      if (w) {
        w.document.write("<html lang=ar dir=rtl><body>" + body + "</body></html>");
        w.document.close();
        w.print();
      }
    }
  }

  function bindHost(host) {
    host.addEventListener("click", function (event) {
      var card = event.target.closest(".portal-card");
      if (!card) return;
      var pledge = event.target.closest("[data-pledge]");
      var weekly = event.target.closest("[data-weekly-save]");
      var homeMock = event.target.closest("[data-home-mock]");
      var omrReview = event.target.closest("[data-omr-review]");
      var absence = event.target.closest("[data-absence]");
      var phone = event.target.closest("[data-phone]");

      if (homeMock) {
        fetchJson(
          "/api/portal/parent/home-mock?student_nid=" +
            encodeURIComponent(homeMock.getAttribute("data-home-mock")),
          { headers: headers(), cache: "no-store" }
        )
          .then(function (pack) {
            var p = pack.pack || {};
            var idInput = card.querySelector(".home-pack-id");
            if (idInput) idInput.value = String(p.pack_id || "");
            printHomeMock(pack);
            status("تم توليد الاختبار المنزلي ومفتاح التصحيح.");
          })
          .catch(function (e) {
            status(e.message, true);
          });
      }

      if (omrReview) {
        post("/api/portal/parent/omr-review", {
          student_nid: omrReview.getAttribute("data-omr-review"),
          pack_id: Number((card.querySelector(".home-pack-id") || {}).value || 0),
          parent_name: (card.querySelector(".home-ack-name") || {}).value || "",
          reviewed_answers: true
        })
          .then(function (b) {
            status(b.message || "أُغلق إقرار OMR.");
            return loadHome();
          })
          .catch(function (e) {
            status(e.message, true);
          });
      }

      if (weekly) {
        var checks = {};
        Array.prototype.forEach.call(card.querySelectorAll("[data-check]"), function (input) {
          checks[input.getAttribute("data-check")] = !!input.checked;
        });
        post("/api/portal/parent/family-weekly", {
          student_nid: weekly.getAttribute("data-weekly-save"),
          checks: checks,
          note: (card.querySelector(".weekly-note") || {}).value || ""
        })
          .then(function (b) {
            status(b.message || "حُفظ التحقق الأسبوعي.");
            return loadHome();
          })
          .catch(function (e) {
            status(e.message, true);
          });
      }

      if (pledge) {
        post("/api/portal/parent/pledge", {
          student_nid: pledge.getAttribute("data-pledge"),
          signed_name: (card.querySelector(".pact-name") || {}).value || ""
        })
          .then(function (b) {
            status(b.message || "وُثّق التعهد.");
            return loadHome();
          })
          .catch(function (e) {
            status(e.message, true);
          });
      }

      if (absence) {
        post("/api/portal/parent/absence", {
          student_nid: absence.getAttribute("data-absence"),
          excuse_date: (card.querySelector(".excuse-date") || {}).value || "",
          reason: (card.querySelector(".excuse-reason") || {}).value || ""
        })
          .then(function (b) {
            status(b.message || "تم رفع العذر.");
          })
          .catch(function (e) {
            status(e.message, true);
          });
      }

      if (phone) {
        post("/api/portal/parent/phone-request", {
          student_nid: phone.getAttribute("data-phone"),
          new_phone: (card.querySelector(".phone-new") || {}).value || "",
          note: "طلب تحديث من بوابة ولي الأمر"
        })
          .then(function (b) {
            status(b.message || "تم إرسال الطلب.");
          })
          .catch(function (e) {
            status(e.message, true);
          });
      }
    });
  }

  function loadHome() {
    return fetchJson("/api/portal/parent/home", {
      headers: headers(),
      cache: "no-store"
    }).then(function (pack) {
      var host = document.getElementById("parent-children");
      var kids = pack.children || [];
      if (!host) return pack;
      if (!kids.length) {
        host.innerHTML = "<p class=\"portal-empty\">لا أبناء مرتبطون بهذا الجوال.</p>";
        return pack;
      }
      host.innerHTML = kids.map(paintChild).join("");
      status(
        "بوابة الشراكة الأسرية جاهزة · شاهد " +
          toEastern(pack.evidence_code_ar || pack.evidence_code || "١-٣-١-٢")
      );
      return pack;
    });
  }

  function boot() {
    var raw = session();
    if (!raw || !raw.token || raw.actor_type !== "parent") {
      location.href = "login.html";
      return;
    }
    var host = document.getElementById("parent-children");
    if (host) bindHost(host);
    var logout = document.getElementById("parent-logout");
    if (logout) {
      logout.onclick = function () {
        fetch("/api/portal/logout", {
          method: "POST",
          headers: headers(),
          body: "{}"
        }).finally(function () {
          sessionStorage.removeItem(TOKEN_KEY);
          location.href = "login.html";
        });
      };
    }
    loadHome().catch(function (err) {
      status(err.message || "خطأ", true);
      if (err.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        location.href = "login.html";
      }
    });
  }

  boot();
})();
