/* لوحة مالك المنظومة والدعم السريع — 3-ج-2 */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var EASTERN = "٠١٢٣٤٥٦٧٨٩";
  var state = { token: "", settings: null, clinicProposals: [], counselorPack: null };

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

  function status(msg, isError) {
    var el = document.getElementById("owner-status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  function session() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function headers() {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Session-Token": state.token
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

  function showPanel(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".owner-panel"), function (p) {
      p.classList.toggle("is-active", p.id === id);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-owner-panel]"), function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-owner-panel") === id);
    });
  }

  function formatEtecCode(code) {
    var raw = toEastern(code == null ? "" : code);
    if (!raw) return "";
    return '<span class="peek-etec" dir="ltr">' + escapeHtml(raw) + "</span>";
  }

  function paintClinicWorksheet(ws) {
    var host = document.getElementById("clinics-worksheet");
    if (!host) return;
    if (!ws || !(ws.questions || []).length) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    host.innerHTML =
      "<h3 style=\"margin:0 0 6px;color:#0b5e56;font-size:16px;\">" +
      escapeHtml(ws.title || "ورقة علاجية مصغّرة") +
      "</h3><p style=\"margin:0 0 8px;font-size:13px;color:#5c675f;\">المعلم: " +
      escapeHtml(ws.teacher_name || "") +
      " · الجذر " +
      toEastern(ws.grade_root || "") +
      " · مؤشر " +
      formatEtecCode(ws.etec_code_ar || "") +
      "</p><ol>" +
      (ws.questions || [])
        .map(function (q, i) {
          var choices = q.choices || {};
          return (
            "<li><strong>" +
            toEastern(i + 1) +
            ".</strong> " +
            escapeHtml(q.stem || "") +
            "<br><small>" +
            ["A", "B", "C", "D"]
              .map(function (L) {
                return L + ") " + escapeHtml(choices[L] || "");
              })
              .join(" · ") +
            "</small></li>"
          );
        })
        .join("") +
      "</ol>";
  }

  function loadClinicProposals() {
    var grade = (document.getElementById("clinic-grade") || {}).value || "";
    var section = (document.getElementById("clinic-section") || {}).value || "";
    var qs = [];
    if (grade) qs.push("grade=" + encodeURIComponent(grade.trim()));
    if (section) qs.push("section=" + encodeURIComponent(section.trim()));
    var url = "/api/portal/teacher/clinics/proposals" + (qs.length ? "?" + qs.join("&") : "");
    return fetchJson(url, { headers: headers(), cache: "no-store" }).then(function (pack) {
      state.clinicProposals = pack.proposals || [];
      var teachers = document.getElementById("clinics-teachers");
      var summary = document.getElementById("clinics-summary");
      var box = document.getElementById("clinics-box");
      var tmap = pack.teachers || {};
      if (teachers) {
        teachers.hidden = false;
        teachers.innerHTML = Object.keys(tmap)
          .map(function (k) {
            var t = tmap[k] || {};
            return (
              "<span class=\"peek-chip\">" +
              escapeHtml(t.subject || k) +
              ": " +
              escapeHtml(t.name || "") +
              "</span>"
            );
          })
          .join("");
      }
      if (summary) {
        summary.hidden = false;
        summary.innerHTML =
          "<span class=\"peek-chip is-hot\">مقترحات: " +
          toEastern(pack.count || 0) +
          "</span>" +
          Object.keys(pack.by_root || {})
            .map(function (root) {
              return (
                "<span class=\"peek-chip\">جذر " +
                toEastern(root) +
                ": " +
                toEastern((pack.by_root || {})[root] || 0) +
                "</span>"
              );
            })
            .join("");
      }
      if (!box) return pack;
      var rows = pack.proposals || [];
      if (!rows.length) {
        box.innerHTML = "<p class=\"portal-empty\">لا مقترحات عيادة حالياً — vault نظيف أو لا تعثرات مفتوحة.</p>";
        return pack;
      }
      box.innerHTML = rows
        .map(function (p, idx) {
          var etec = (p.etec && (p.etec.code_ar || p.etec.code)) || "";
          var students = (p.students || [])
            .map(function (s) {
              return (
                escapeHtml(s.name || "") +
                " (" +
                toEastern(s.trap_heat || 0) +
                ")"
              );
            })
            .join(" · ");
          return (
            "<article class=\"clinic-card" +
            (p.already_open ? " is-open" : "") +
            "\" data-clinic-idx=\"" +
            idx +
            "\"><h3>" +
            escapeHtml(p.subject || "") +
            " — " +
            escapeHtml(p.skill || "") +
            "</h3><div class=\"clinic-meta\">" +
            "<span class=\"peek-chip\">فصل " +
            escapeHtml(p.section || "—") +
            "</span>" +
            "<span class=\"peek-chip\">جذر " +
            toEastern(p.grade_root || "٣م") +
            "</span>" +
            "<span class=\"peek-chip\">طلاب " +
            toEastern(p.student_count || 0) +
            "</span>" +
            "<span class=\"peek-chip\">مؤشر " +
            formatEtecCode(etec) +
            "</span>" +
            "<span class=\"peek-chip\">" +
            escapeHtml(p.teacher_name || "") +
            "</span>" +
            (p.already_open ? "<span class=\"peek-status is-recovering\">مفتوحة مسبقاً</span>" : "") +
            "</div><p style=\"margin:0 0 8px;font-size:13px;color:#5c675f;\">" +
            students +
            "</p><div class=\"portal-actions\">" +
            "<button type=\"button\" class=\"portal-btn\" data-approve-clinic=\"" +
            idx +
            "\"" +
            (p.already_open ? " disabled" : "") +
            ">اعتماد العيادة</button></div></article>"
          );
        })
        .join("");
      return pack;
    });
  }

  function approveClinicAt(idx) {
    var list = state.clinicProposals || [];
    var p = list[idx];
    if (!p) return Promise.reject(new Error("مقترح غير موجود."));
    return fetchJson("/api/portal/teacher/clinics/approve", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        clinic_key: p.clinic_key || "",
        section: p.section || "",
        domain: p.domain || "math",
        skill: p.skill || "",
        grade_root: p.grade_root || "٣م",
        student_nids: p.student_nids || [],
        generate_worksheet: true,
        worksheet_count: 5
      })
    }).then(function (result) {
      paintClinicWorksheet(result.worksheet);
      status(result.message || "اعتُمدت العيادة.");
      return loadClinicProposals().then(function () {
        return result;
      });
    });
  }

  function loadOpenClinics() {
    return fetchJson("/api/portal/teacher/clinics/open", {
      headers: headers(),
      cache: "no-store"
    }).then(function (pack) {
      var box = document.getElementById("clinics-box");
      if (!box) return pack;
      var items = pack.items || [];
      if (!items.length) {
        box.innerHTML = "<p class=\"portal-empty\">لا عيادات مفتوحة حالياً.</p>";
        return pack;
      }
      box.innerHTML =
        "<table class=\"owner-table\"><thead><tr>" +
        "<th>الطالب</th><th>المادة</th><th>المهارة</th><th>الجذر</th><th>ETEC</th><th>الحالة</th><th></th>" +
        "</tr></thead><tbody>" +
        items
          .map(function (row) {
            return (
              "<tr><td>" +
              escapeHtml(row.student_name || "") +
              "<br><small>" +
              escapeHtml(row.student_nid_masked || "") +
              "</small></td><td>" +
              escapeHtml(row.subject || "") +
              "</td><td>" +
              escapeHtml(row.skill || "") +
              "</td><td>" +
              toEastern(row.grade_root || "") +
              "</td><td>" +
              formatEtecCode(row.etec_code_ar || row.etec_code || "") +
              "</td><td>" +
              escapeHtml(row.status || "") +
              "</td><td><button type=\"button\" class=\"portal-btn secondary\" data-purge-pass=\"" +
              escapeHtml(row.student_nid || "") +
              "\" data-purge-skill=\"" +
              escapeHtml(row.skill || "") +
              "\" data-purge-domain=\"" +
              escapeHtml(row.domain || "") +
              "\" data-purge-key=\"" +
              escapeHtml(row.clinic_key || "") +
              "\">اجتاز التطهير</button></td></tr>"
            );
          })
          .join("") +
        "</tbody></table>";
      return pack;
    });
  }

  function passPurge(btn) {
    return fetchJson("/api/portal/teacher/clinics/purge-pass", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        student_nid: btn.getAttribute("data-purge-pass") || "",
        skill: btn.getAttribute("data-purge-skill") || "",
        domain: btn.getAttribute("data-purge-domain") || "",
        clinic_key: btn.getAttribute("data-purge-key") || ""
      })
    }).then(function (result) {
      status(result.message || "حُدّث التطهير.");
      return loadOpenClinics();
    });
  }

  function loadTeacherPeek() {
    var grade = (document.getElementById("peek-grade") || {}).value || "";
    var section = (document.getElementById("peek-section") || {}).value || "";
    var qs = [];
    if (grade) qs.push("grade=" + encodeURIComponent(grade.trim()));
    if (section) qs.push("section=" + encodeURIComponent(section.trim()));
    var url = "/api/portal/teacher/peek" + (qs.length ? "?" + qs.join("&") : "");
    return fetchJson(url, { headers: headers(), cache: "no-store" }).then(function (pack) {
      var summary = document.getElementById("peek-summary");
      var box = document.getElementById("peek-box");
      var byRoot = pack.by_root || {};
      var legend = pack.legend || {};
      if (summary) {
        summary.hidden = false;
        summary.innerHTML =
          "<span class=\"peek-chip is-hot\">متعثرون: " +
          toEastern(pack.count || 0) +
          "</span>" +
          Object.keys(byRoot)
            .map(function (root) {
              return (
                "<span class=\"peek-chip\" title=\"" +
                escapeHtml(legend[root] || "") +
                "\">جذر " +
                toEastern(root) +
                ": " +
                toEastern(byRoot[root] || 0) +
                "</span>"
              );
            })
            .join("");
      }
      var items = pack.items || [];
      if (!box) return pack;
      if (!items.length) {
        box.innerHTML = "<p class=\"portal-empty\">لا تعثرات مفتوحة حالياً — مخزن الإتقان نظيف.</p>";
        return pack;
      }
      box.innerHTML =
        "<table class=\"owner-table\"><thead><tr>" +
        "<th>الطالب</th><th>الصف/الفصل</th><th>المهارة</th><th>الجذر</th>" +
        "<th>الحرارة</th><th>التطهير</th><th>ETEC</th><th>توجيه</th>" +
        "</tr></thead><tbody>" +
        items
          .map(function (row) {
            var etec = (row.etec && (row.etec.code_ar || row.etec.code)) || "";
            var st = row.status || "open";
            return (
              "<tr><td>" +
              escapeHtml(row.name || "طالب") +
              "<br><small>" +
              escapeHtml(row.student_nid_masked || "") +
              "</small></td><td>" +
              escapeHtml(row.grade || "—") +
              " / " +
              escapeHtml(row.section || "—") +
              "</td><td>" +
              escapeHtml(row.skill || "") +
              "<br><small>" +
              escapeHtml(row.common_mistake || "") +
              "</small></td><td><strong>" +
              toEastern(row.grade_root || "٣م") +
              "</strong></td><td>" +
              toEastern(row.trap_heat || 0) +
              "</td><td><span class=\"peek-status is-" +
              escapeHtml(st) +
              "\">" +
              escapeHtml(row.status_ar || st) +
              "</span></td><td>" +
              formatEtecCode(etec) +
              "</td><td>" +
              escapeHtml(row.remedial_hint || "") +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>";
      return pack;
    });
  }

  function paintSettings(pack) {
    state.settings = pack;
    var s = pack.settings || {};
    document.getElementById("owner-hero").textContent = s.owner_name || "";
    document.getElementById("owner-title").textContent = s.owner_title || "";
    document.getElementById("owner-nid-masked").textContent = "هوية: " + (s.owner_nid_masked || "");
    document.getElementById("f-owner-name").value = s.owner_name || "";
    document.getElementById("f-owner-title").value = s.owner_title || "";
    document.getElementById("f-sign-vice").value = s.a4_sign_vice || "";
    document.getElementById("f-sign-manager").value = s.a4_sign_manager || "";
    document.getElementById("f-sign-owner").value = s.a4_sign_owner || "";
    var levels = pack.levels || {};
    document.getElementById("rbac-pyramid").innerHTML = Object.keys(levels)
      .sort()
      .map(function (k) {
        var lv = levels[k];
        return "<li><strong>المستوى " + toEastern(k) + "</strong> — " + escapeHtml(lv.label) + " (" + escapeHtml(lv.scope) + ")</li>";
      })
      .join("");
    document.getElementById("rbac-table").innerHTML =
      "<table class=\"owner-table\"><thead><tr><th>المستوى</th><th>الاسم/الصفة</th><th>الهوية</th><th>المدرسة</th></tr></thead><tbody>" +
      (pack.assignments || [])
        .map(function (row) {
          return (
            "<tr><td>" +
            toEastern(row.level) +
            " · " +
            escapeHtml(row.level_label) +
            "</td><td>" +
            escapeHtml(row.label) +
            "</td><td>" +
            escapeHtml(row.national_id_masked) +
            "</td><td>" +
            escapeHtml(row.school_code) +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";
  }

  function loadSettings() {
    return fetchJson("/api/portal/owner/settings", { headers: headers(), cache: "no-store" }).then(paintSettings);
  }

  function saveSettings() {
    fetchJson("/api/portal/owner/settings", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        owner_name: document.getElementById("f-owner-name").value,
        owner_title: document.getElementById("f-owner-title").value,
        a4_sign_vice: document.getElementById("f-sign-vice").value,
        a4_sign_manager: document.getElementById("f-sign-manager").value,
        a4_sign_owner: document.getElementById("f-sign-owner").value
      })
    })
      .then(function () {
        status("حُفظت إعدادات المالك والتوقيعات.");
        return loadSettings();
      })
      .catch(function (e) {
        status(e.message, true);
      });
  }

  function readNid(id) {
    var el = document.getElementById(id);
    if (el && typeof el._nidGet === "function") {
      return el._nidGet();
    }
    return String((el && el.value) || "").replace(/\D/g, "");
  }

  function assignRbac() {
    fetchJson("/api/portal/owner/rbac", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        national_id: readNid("rbac-nid"),
        level: Number(document.getElementById("rbac-level").value),
        label: document.getElementById("rbac-label").value
      })
    })
      .then(function () {
        status("عُيّن المستوى في هرم الصلاحيات.");
        document.getElementById("rbac-nid").value = "";
        return loadSettings();
      })
      .catch(function (e) {
        status(e.message, true);
      });
  }

  function searchSupport() {
    var q = document.getElementById("support-q").value;
    fetchJson("/api/portal/support/search?q=" + encodeURIComponent(q), { headers: headers(), cache: "no-store" })
      .then(function (pack) {
        document.getElementById("support-results").innerHTML =
          "<table class=\"owner-table\"><thead><tr><th>الاسم</th><th>الهوية</th><th>الصف/الفصل</th><th>جوال ولي الأمر</th><th>إجراء</th></tr></thead><tbody>" +
          (pack.items || [])
            .map(function (row) {
              return (
                "<tr><td>" +
                escapeHtml(row.name) +
                "</td><td>" +
                escapeHtml(row.national_id_masked) +
                "</td><td>" +
                escapeHtml((row.grade || "") + " / " + (row.section || "")) +
                "</td><td>" +
                escapeHtml(row.guardian_phone_masked || "—") +
                "</td><td>" +
                "<button type=\"button\" class=\"portal-btn secondary\" data-pick-nid=\"" +
                escapeHtml(row.national_id) +
                "\" data-pick-phone=\"" +
                escapeHtml(row.guardian_phone || "") +
                "\">اختيار</button>" +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table>";
      })
      .catch(function (e) {
        status(e.message, true);
      });
  }

  function updatePhone() {
    fetchJson("/api/portal/support/phone", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        student_nid: readNid("sup-nid"),
        guardian_phone: document.getElementById("sup-phone").value
      })
    })
      .then(function (pack) {
        status("حُدّث الجوال · آخر ٤: " + toEastern(pack.phone_last4 || ""));
      })
      .catch(function (e) {
        status(e.message, true);
      });
  }

  function issueOtp() {
    fetchJson("/api/portal/support/otp", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ staff_nid: readNid("otp-nid") })
    })
      .then(function (pack) {
        document.getElementById("otp-out").textContent =
          "رمز ليوم واحد: " + toEastern(pack.code) + " · ينتهي " + (pack.expires_at || "");
        status(pack.note || "صدر الرمز.");
      })
      .catch(function (e) {
        status(e.message, true);
      });
  }

  function printQr() {
    fetchJson("/api/portal/support/qr-pass?student_nid=" + encodeURIComponent(readNid("qr-nid")), {
      headers: headers(),
      cache: "no-store"
    })
      .then(function (pack) {
        var s = pack.student || {};
        var html =
          "<div class=\"owner-print\" id=\"qr-print-card\">" +
          "<h3>" +
          escapeHtml(pack.card_title || "QR Pass") +
          "</h3>" +
          "<p><strong>" +
          escapeHtml(s.name || "") +
          "</strong><br>" +
          escapeHtml((s.grade || "") + " / فصل " + (s.section || "")) +
          "<br>هوية: " +
          escapeHtml(s.national_id_masked || "") +
          "</p>" +
          "<p style=\"font-size:18px;letter-spacing:1px;\"><code>" +
          escapeHtml(pack.qr_code || "") +
          "</code></p>" +
          "<p style=\"font-size:12px;color:#5c675f;\">للدخول السريع إلى ميدان نافس</p></div>";
        document.getElementById("qr-preview").innerHTML = html;
        status("بطاقة QR جاهزة للطباعة.");
        if (window.PrintEngine && typeof window.PrintEngine.open === "function") {
          window.PrintEngine.open("master-sheet", {
            docTitle: "بطاقة QR Pass",
            title: pack.card_title || "بطاقة دخول نافس",
            bodyHtml: html,
            signoff: false,
            pageTotal: 1
          });
        }
      })
      .catch(function (e) {
        status(e.message, true);
      });
  }

  function loadAudit() {
    fetchJson("/api/portal/support/audit?limit=40", { headers: headers(), cache: "no-store" })
      .then(function (pack) {
        document.getElementById("audit-box").innerHTML =
          "<table class=\"owner-table\"><thead><tr><th>الوقت</th><th>المُنفّذ</th><th>الإجراء</th><th>الهدف</th></tr></thead><tbody>" +
          (pack.items || [])
            .map(function (row) {
              return (
                "<tr><td>" +
                escapeHtml(row.created_at || "") +
                "</td><td>" +
                escapeHtml(row.actor_name || "") +
                " (" +
                escapeHtml(row.actor_nid_masked || "") +
                ")</td><td>" +
                escapeHtml(row.action || "") +
                "</td><td>" +
                escapeHtml(row.target || "") +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table>";
      })
      .catch(function (e) {
        status(e.message, true);
      });
  }

  function loadBrief() {
    fetchJson("/api/portal/morning-brief", { headers: headers(), cache: "no-store" })
      .then(function (pack) {
        document.getElementById("brief-box").innerHTML =
          "<div class=\"owner-print\">" +
          "<h3>نبض المدرسة الصباحي</h3>" +
          "<p>تاريخ: " +
          toEastern(pack.date || "") +
          "</p>" +
          "<ul class=\"portal-list\">" +
          "<li>تحديات اليوم: " +
          toEastern(pack.challenges_today) +
          " · XP " +
          toEastern(pack.xp_today) +
          " · متوسط " +
          toEastern(pack.avg_score_today) +
          "٪</li>" +
          "<li>استشارات جديدة: " +
          toEastern(pack.counseling_new) +
          "</li>" +
          "<li>أعذار غياب جديدة: " +
          toEastern(pack.absence_new) +
          "</li>" +
          "<li>طلبات تحديث جوال: " +
          toEastern(pack.phone_requests_pending) +
          "</li>" +
          "</ul>" +
          "<h3>أوائل اليوم</h3><ul class=\"portal-list\">" +
          (pack.top_students || [])
            .map(function (r) {
              return "<li>" + escapeHtml(r.name) + " — " + toEastern(r.xp) + " XP</li>";
            })
            .join("") +
          "</ul>" +
          "<p style=\"font-size:12px;color:#5c675f;\">ربط شواهد: " +
          escapeHtml((pack.evidence_hooks || []).join(" · ")) +
          "</p></div>";
      })
      .catch(function (e) {
        status(e.message, true);
      });
  }

  function makeWorksheet() {
    var nids = (document.getElementById("ws-nids").value || "")
      .split(/[\s,]+/)
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
    fetchJson("/api/portal/worksheet/remedial", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        domain: document.getElementById("ws-domain").value,
        skill: document.getElementById("ws-skill").value,
        student_nids: nids,
        count: 5
      })
    })
      .then(function (pack) {
        var CHOICE = { A: "أ", B: "ب", C: "ج", D: "د" };
        var body =
          "<h3>" +
          escapeHtml(pack.title) +
          "</h3>" +
          "<p>المهارة: " +
          escapeHtml(pack.skill || pack.domain) +
          "</p>" +
          ((pack.students || []).length
            ? "<p>المستهدفون: " +
              pack.students
                .map(function (s) {
                  return escapeHtml(s.name) + " (" + escapeHtml(s.national_id_masked) + ")";
                })
                .join("، ") +
              "</p>"
            : "") +
          "<ol>" +
          (pack.questions || [])
            .map(function (q, i) {
              return (
                "<li style=\"margin-bottom:10px;\"><strong>" +
                toEastern(i + 1) +
                ".</strong> " +
                escapeHtml(q.stem) +
                "<br>" +
                ["A", "B", "C", "D"]
                  .map(function (L) {
                    return CHOICE[L] + ") " + escapeHtml((q.choices || {})[L] || "");
                  })
                  .join(" · ") +
                "</li>"
              );
            })
            .join("") +
          "</ol>";
        document.getElementById("ws-preview").innerHTML = "<div class=\"owner-print\">" + body + "</div>";
        if (window.PrintEngine && typeof window.PrintEngine.open === "function") {
          window.PrintEngine.open("master-sheet", {
            docTitle: "ورقة عمل علاجية",
            title: pack.title,
            bodyHtml: body,
            signoff: true,
            maxColumns: 2,
            pageTotal: 1,
            signatures: [
              { role: (pack.signoffs || {}).owner_title || "مالك المنظومة", name: (pack.signoffs || {}).owner || "" },
              { role: "مدير المدرسة", name: "" }
            ]
          });
        }
        status("وُلدت ورقة العمل العلاجية (٥ أسئلة).");
      })
      .catch(function (e) {
        status(e.message, true);
      });
  }

  function lines(value) {
    return String(value || "")
      .split(/\n+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function paintIdentity(pack) {
    var c = (pack && pack.content) || {};
    document.getElementById("id-school-name").value = c.school_name || "";
    document.getElementById("id-stat-no").value = c.statistical_number || "";
    document.getElementById("id-admin").value = c.education_administration || "";
    document.getElementById("id-principal").value = c.principal_name || "";
    document.getElementById("id-students").value = c.display_students != null ? c.display_students : 338;
    document.getElementById("id-staff").value = c.display_staff != null ? c.display_staff : 39;
    document.getElementById("id-about").value = c.about || "";
    document.getElementById("id-vision").value = c.vision || "";
    document.getElementById("id-mission").value = c.mission || "";
    document.getElementById("id-values").value = (c.values || []).join("\n");
    document.getElementById("id-goals").value = (c.goals || []).join("\n");
    document.getElementById("id-partners").value = (c.partners || []).join("\n");
    document.getElementById("id-contact").value = c.contact_note || "";
    var live = (pack && pack.live) || {};
    document.getElementById("id-live").textContent =
      "حي من SSOT: " +
      (live.students_live != null ? live.students_live : "—") +
      " طالب · " +
      (live.staff_live != null ? live.staff_live : "—") +
      " منسوب (العرض المعتمد أعلاه لا يُستبدل تلقائياً).";
  }

  function loadIdentity() {
    return fetchJson("/api/portal/owner/identity", { headers: headers(), cache: "no-store" }).then(paintIdentity);
  }

  function saveIdentity() {
    fetchJson("/api/portal/owner/identity", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        school_name: document.getElementById("id-school-name").value,
        statistical_number: document.getElementById("id-stat-no").value,
        education_administration: document.getElementById("id-admin").value,
        principal_name: document.getElementById("id-principal").value,
        display_students: Number(document.getElementById("id-students").value || 338),
        display_staff: Number(document.getElementById("id-staff").value || 39),
        about: document.getElementById("id-about").value,
        vision: document.getElementById("id-vision").value,
        mission: document.getElementById("id-mission").value,
        values: lines(document.getElementById("id-values").value),
        goals: lines(document.getElementById("id-goals").value),
        partners: lines(document.getElementById("id-partners").value),
        contact_note: document.getElementById("id-contact").value
      })
    })
      .then(function (pack) {
        paintIdentity({ content: pack.content, live: {} });
        status("حُفظ محتوى الهوية المؤسسية.");
      })
      .catch(function (e) {
        status(e.message, true);
      });
  }

  function loadRadarTalent() {
    return fetchJson("/api/portal/radar/talent", { headers: headers(), cache: "no-store" }).then(function (pack) {
      var items = pack.items || [];
      document.getElementById("radar-talent-box").innerHTML = items.length
        ? "<table class=\"owner-table\"><thead><tr><th>الاسم</th><th>الصف</th><th>الهوية</th><th>أفضل نتيجة</th><th>الحالة</th></tr></thead><tbody>" +
          items
            .map(function (row) {
              return (
                "<tr><td>" +
                escapeHtml(row.name || "") +
                "</td><td>" +
                escapeHtml((row.grade || "") + " / " + (row.section || "")) +
                "</td><td>" +
                escapeHtml(row.national_id_masked || "") +
                "</td><td>" +
                escapeHtml(String(row.best_score || "")) +
                "٪</td><td>" +
                escapeHtml(row.status || "") +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table>"
        : "<p class=\"portal-empty\">لا مرشحين بعد — يظهر الطلاب عند تحقيق ٩٥٪ فأعلى.</p>";
    });
  }

  function loadRadarAlerts() {
    return fetchJson("/api/portal/radar/alerts", { headers: headers(), cache: "no-store" }).then(function (pack) {
      var items = pack.items || [];
      document.getElementById("radar-alerts-box").innerHTML = items.length
        ? "<table class=\"owner-table\"><thead><tr><th>الطالب</th><th>النوع</th><th>التفاصيل</th><th>الحالة</th></tr></thead><tbody>" +
          items
            .map(function (row) {
              return (
                "<tr><td>" +
                escapeHtml(row.name || "") +
                "<br><small>" +
                escapeHtml(row.national_id_masked || "") +
                "</small></td><td>" +
                escapeHtml(row.alert_type || "") +
                "</td><td>" +
                escapeHtml(JSON.stringify(row.detail || {})) +
                "</td><td>" +
                escapeHtml(row.status || "") +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table>"
        : "<p class=\"portal-empty\">لا تنبيهات تدخل مبكر حالياً.</p>";
    });
  }

  function loadCounselorInbox() {
    return fetchJson("/api/portal/counselor/inbox", { headers: headers(), cache: "no-store" }).then(
      function (pack) {
        state.counselorPack = pack;
        var summary = document.getElementById("counselor-summary");
        var legend = document.getElementById("counselor-legend");
        var s = pack.summary || {};
        if (summary) {
          summary.hidden = false;
          summary.innerHTML =
            '<span class="peek-chip">استشارات: ' +
            toEastern(s.counseling_open || 0) +
            "</span>" +
            '<span class="peek-chip is-hot">تنبيهات: ' +
            toEastern(s.alerts_new || 0) +
            "</span>" +
            '<span class="peek-chip is-hot">حرارة vault: ' +
            toEastern(s.vault_hot || 0) +
            "</span>" +
            (pack.etec_behavior
              ? '<span class="peek-chip">ETEC ' +
                formatEtecCode(pack.etec_behavior.code_ar || pack.etec_behavior.code || "") +
                "</span>"
              : "");
        }
        if (legend) {
          var L = pack.legend || {};
          legend.hidden = false;
          legend.innerHTML = Object.keys(L)
            .map(function (k) {
              return '<span class="peek-chip"><strong>' + escapeHtml(k) + "</strong> — " + escapeHtml(L[k]) + "</span>";
            })
            .join("");
        }
        var inbox = document.getElementById("counselor-inbox-box");
        var items = pack.counseling || [];
        if (inbox) {
          inbox.innerHTML = items.length
            ? items
                .map(function (row) {
                  return (
                    '<article class="counselor-card" data-counsel-id="' +
                    escapeHtml(row.id) +
                    '"><h4>' +
                    escapeHtml(row.name || "طالب") +
                    ' <small style="color:#5c675f;font-weight:600;">(' +
                    toEastern(row.student_nid_masked || "") +
                    ")</small></h4>" +
                    '<p style="margin:0;font-size:12px;color:#5c675f;">' +
                    escapeHtml(row.status_ar || row.status || "") +
                    " · " +
                    escapeHtml(row.category || "عام") +
                    " · " +
                    toEastern(row.created_at || "") +
                    "</p>" +
                    '<div class="counselor-msg">' +
                    escapeHtml(row.message || "") +
                    "</div>" +
                    "<label style=\"font-size:12px;color:#5c675f;\">ملاحظة الموجّه</label>" +
                    '<textarea data-counsel-note>' +
                    escapeHtml(row.counselor_note || "") +
                    "</textarea>" +
                    '<div class="counselor-actions">' +
                    '<select data-counsel-status>' +
                    ["new", "open", "in_progress", "closed"]
                      .map(function (st) {
                        var labels = {
                          new: "جديدة",
                          open: "مفتوحة",
                          in_progress: "قيد المتابعة",
                          closed: "مغلقة"
                        };
                        return (
                          '<option value="' +
                          st +
                          '"' +
                          (row.status === st ? " selected" : "") +
                          ">" +
                          labels[st] +
                          "</option>"
                        );
                      })
                      .join("") +
                    "</select>" +
                    '<button type="button" class="portal-btn" data-counsel-save>حفظ المتابعة</button>' +
                    "</div></article>"
                  );
                })
                .join("")
            : '<p class="portal-empty">لا استشارات مفتوحة حالياً.</p>';
        }
        var alertsBox = document.getElementById("counselor-alerts-box");
        var alerts = pack.alerts || [];
        if (alertsBox) {
          alertsBox.innerHTML = alerts.length
            ? '<table class="owner-table"><thead><tr><th>الطالب</th><th>النوع</th><th>التفاصيل</th><th>إجراء</th></tr></thead><tbody>' +
              alerts
                .map(function (row) {
                  var d = row.detail || {};
                  var detailTxt = [];
                  if (d.latest != null) detailTxt.push("آخر نتيجة " + toEastern(d.latest) + "٪");
                  if (d.prev_avg != null) detailTxt.push("متوسط سابق " + toEastern(d.prev_avg) + "٪");
                  if (d.trap_heat != null) detailTxt.push("حرارة " + toEastern(d.trap_heat));
                  if (d.absences_14d != null) detailTxt.push("غيابات " + toEastern(d.absences_14d));
                  return (
                    "<tr><td>" +
                    escapeHtml(row.name || "") +
                    "<br><small>" +
                    toEastern(row.student_nid_masked || "") +
                    "</small></td><td>" +
                    escapeHtml(row.alert_type_ar || row.alert_type || "") +
                    "</td><td>" +
                    escapeHtml(detailTxt.join(" · ") || JSON.stringify(d)) +
                    '</td><td><button type="button" class="portal-btn secondary" data-alert-ack="' +
                    escapeHtml(row.id) +
                    '">استلام</button></td></tr>'
                  );
                })
                .join("") +
              "</tbody></table>"
            : '<p class="portal-empty">لا تنبيهات جديدة.</p>';
        }
        var heatBox = document.getElementById("counselor-heat-box");
        var heat = pack.vault_hot || [];
        if (heatBox) {
          heatBox.innerHTML = heat.length
            ? '<table class="owner-table"><thead><tr><th>الطالب</th><th>المهارة</th><th>الجذر</th><th>الحرارة</th><th>ETEC</th></tr></thead><tbody>' +
              heat
                .map(function (row) {
                  return (
                    "<tr><td>" +
                    escapeHtml(row.name || "") +
                    "<br><small>" +
                    toEastern(row.student_nid_masked || "") +
                    " · " +
                    escapeHtml(row.section || "") +
                    "</small></td><td>" +
                    escapeHtml(row.skill || row.domain || "") +
                    "</td><td>" +
                    toEastern(row.grade_root || "—") +
                    '</td><td><span class="peek-status is-open">' +
                    toEastern(row.trap_heat || 0) +
                    "</span></td><td>" +
                    formatEtecCode(row.etec_code_ar || (row.etec && row.etec.code) || "") +
                    "</td></tr>"
                  );
                })
                .join("") +
              "</tbody></table>"
            : '<p class="portal-empty">لا حرارة عالية حالياً.</p>';
        }
        return pack;
      }
    );
  }

  function saveCounselNote(card) {
    var id = Number(card.getAttribute("data-counsel-id"));
    var note = (card.querySelector("[data-counsel-note]") || {}).value || "";
    var st = (card.querySelector("[data-counsel-status]") || {}).value || "in_progress";
    return fetchJson("/api/portal/counselor/counseling/" + id + "/update", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ note: note, status: st })
    }).then(function () {
      return loadCounselorInbox();
    });
  }

  function ackAlert(alertId) {
    return fetchJson("/api/portal/counselor/alerts/" + alertId + "/status", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ status: "acked" })
    }).then(function () {
      return loadCounselorInbox();
    });
  }

  function loadBoostRules() {
    return fetchJson("/api/portal/boost/rules", { headers: headers(), cache: "no-store" }).then(
      function (pack) {
        var box = document.getElementById("boost-rules-box");
        if (!box) return pack;
        box.hidden = false;
        box.innerHTML =
          "<h3 style=\"margin:0 0 8px;color:#0b5e56;font-size:15px;\">قواعد التحفيز الآلي · ETEC " +
          formatEtecCode((pack.etec && (pack.etec.code_ar || pack.etec.code)) || "") +
          "</h3>" +
          '<table><thead><tr><th>الشرط</th><th>المكافأة</th><th>السقف</th></tr></thead><tbody>' +
          (pack.rules || [])
            .map(function (r) {
              return (
                "<tr><td>" +
                escapeHtml(r.when || "") +
                "</td><td>" +
                escapeHtml(r.award || "") +
                "</td><td>" +
                escapeHtml(r.cap || "") +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table>";
        return pack;
      }
    );
  }

  function bind() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-owner-panel]"), function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-owner-panel");
        showPanel(id);
        if (id === "panel-identity") {
          loadIdentity().catch(function (e) {
            status(e.message, true);
          });
        }
        if (id === "panel-radar") {
          Promise.all([loadRadarTalent(), loadRadarAlerts()]).catch(function (e) {
            status(e.message, true);
          });
        }
        if (id === "panel-counselor") {
          loadCounselorInbox()
            .then(function () {
              status("صندوق الموجّه محدّث.");
            })
            .catch(function (e) {
              status(e.message, true);
            });
        }
        if (id === "panel-peek") {
          loadTeacherPeek()
            .then(function () {
              status("معاينة التعثر محدّثة.");
            })
            .catch(function (e) {
              status(e.message, true);
            });
        }
        if (id === "panel-clinics") {
          loadClinicProposals()
            .then(function () {
              status("مقترحات العيادات محدّثة.");
            })
            .catch(function (e) {
              status(e.message, true);
            });
        }
      });
    });
    document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
    var peekBtn = document.getElementById("btn-peek-refresh");
    if (peekBtn) {
      peekBtn.addEventListener("click", function () {
        loadTeacherPeek()
          .then(function () {
            status("معاينة التعثر محدّثة.");
          })
          .catch(function (e) {
            status(e.message, true);
          });
      });
    }
    var clinicsBtn = document.getElementById("btn-clinics-refresh");
    if (clinicsBtn) {
      clinicsBtn.addEventListener("click", function () {
        loadClinicProposals()
          .then(function () {
            status("مقترحات العيادات محدّثة.");
          })
          .catch(function (e) {
            status(e.message, true);
          });
      });
    }
    var clinicsOpenBtn = document.getElementById("btn-clinics-open");
    if (clinicsOpenBtn) {
      clinicsOpenBtn.addEventListener("click", function () {
        loadOpenClinics()
          .then(function () {
            status("العيادات المفتوحة محدّثة.");
          })
          .catch(function (e) {
            status(e.message, true);
          });
      });
    }
    var clinicsBox = document.getElementById("clinics-box");
    if (clinicsBox) {
      clinicsBox.addEventListener("click", function (event) {
        var approve = event.target.closest("[data-approve-clinic]");
        if (approve) {
          var idx = Number(approve.getAttribute("data-approve-clinic"));
          approveClinicAt(idx).catch(function (e) {
            status(e.message, true);
          });
          return;
        }
        var purge = event.target.closest("[data-purge-pass]");
        if (purge) {
          passPurge(purge).catch(function (e) {
            status(e.message, true);
          });
        }
      });
    }
    var counselRefresh = document.getElementById("btn-counselor-refresh");
    if (counselRefresh) {
      counselRefresh.addEventListener("click", function () {
        loadCounselorInbox()
          .then(function () {
            status("صندوق الموجّه محدّث.");
          })
          .catch(function (e) {
            status(e.message, true);
          });
      });
    }
    var boostRulesBtn = document.getElementById("btn-boost-rules");
    if (boostRulesBtn) {
      boostRulesBtn.addEventListener("click", function () {
        loadBoostRules()
          .then(function () {
            status("قواعد التحفيز معروضة.");
          })
          .catch(function (e) {
            status(e.message, true);
          });
      });
    }
    var counselInbox = document.getElementById("counselor-inbox-box");
    if (counselInbox) {
      counselInbox.addEventListener("click", function (event) {
        var saveBtn = event.target.closest("[data-counsel-save]");
        if (!saveBtn) return;
        var card = saveBtn.closest("[data-counsel-id]");
        if (!card) return;
        saveCounselNote(card)
          .then(function () {
            status("حُفظت متابعة الاستشارة.");
          })
          .catch(function (e) {
            status(e.message, true);
          });
      });
    }
    var counselAlerts = document.getElementById("counselor-alerts-box");
    if (counselAlerts) {
      counselAlerts.addEventListener("click", function (event) {
        var ack = event.target.closest("[data-alert-ack]");
        if (!ack) return;
        ackAlert(ack.getAttribute("data-alert-ack"))
          .then(function () {
            status("تم استلام التنبيه.");
          })
          .catch(function (e) {
            status(e.message, true);
          });
      });
    }
    document.getElementById("btn-save-identity").addEventListener("click", saveIdentity);
    document.getElementById("btn-radar-talent").addEventListener("click", function () {
      loadRadarTalent().catch(function (e) {
        status(e.message, true);
      });
    });
    document.getElementById("btn-radar-alerts").addEventListener("click", function () {
      loadRadarAlerts().catch(function (e) {
        status(e.message, true);
      });
    });
    document.getElementById("btn-rbac").addEventListener("click", assignRbac);
    document.getElementById("btn-support-search").addEventListener("click", searchSupport);
    document.getElementById("btn-phone").addEventListener("click", updatePhone);
    document.getElementById("btn-otp").addEventListener("click", issueOtp);
    document.getElementById("btn-qr").addEventListener("click", printQr);
    document.getElementById("btn-audit").addEventListener("click", loadAudit);
    document.getElementById("btn-brief").addEventListener("click", loadBrief);
    document.getElementById("btn-ws").addEventListener("click", makeWorksheet);
    document.getElementById("support-results").addEventListener("click", function (event) {
      var btn = event.target.closest("[data-pick-nid]");
      if (!btn) return;
      var nid = btn.getAttribute("data-pick-nid") || "";
      ["sup-nid", "qr-nid"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && typeof el._nidSet === "function") el._nidSet(nid);
        else if (el) el.value = nid;
      });
      document.getElementById("sup-phone").value = btn.getAttribute("data-pick-phone") || "";
      document.getElementById("ws-nids").value = nid;
    });
    if (window.NationalIdMask) {
      ["rbac-nid", "sup-nid", "otp-nid", "qr-nid"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) window.NationalIdMask.arm(el, { tail: 3 });
      });
    }
  }

  function boot() {
    var user = session();
    if (!user || !user.token) {
      location.href = "login.html";
      return;
    }
    state.token = user.token;
    bind();
    showPanel("panel-owner");
    loadSettings()
      .then(function () {
        status("لوحة المالك والدعم جاهزة.");
      })
      .catch(function (e) {
        status(e.message || "صلاحية غير كافية — يلزم مستوى ٠ أو ١.", true);
      });
  }

  boot();
})();
