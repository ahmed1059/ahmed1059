/* لوحة مالك المنظومة والدعم السريع — 3-ج-2 */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var EASTERN = "٠١٢٣٤٥٦٧٨٩";
  var state = { token: "", settings: null };

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

  function bind() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-owner-panel]"), function (btn) {
      btn.addEventListener("click", function () {
        showPanel(btn.getAttribute("data-owner-panel"));
      });
    });
    document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
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
