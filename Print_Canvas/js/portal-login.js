/* تبويبات دخول البوابة: طالب / ولي أمر — مستقل عن دخول المنسوبين */
(function () {
  "use strict";

  var TOKEN_KEY = "portalSession";

  function switchGate(gate) {
    Array.prototype.forEach.call(document.querySelectorAll(".portal-gate-tab"), function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-gate") === gate);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-gate-panel]"), function (panel) {
      panel.classList.toggle("is-active", panel.getAttribute("data-gate-panel") === gate);
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll(".portal-gate-tab"), function (btn) {
    btn.addEventListener("click", function () {
      switchGate(btn.getAttribute("data-gate"));
    });
  });

  var studentForm = document.getElementById("student-login-form");
  if (studentForm) {
    studentForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var message = document.getElementById("student-login-message");
      var nid = (document.getElementById("student-nid").value || "").replace(/\D/g, "");
      var last4 = (document.getElementById("student-last4").value || "").replace(/\D/g, "").slice(-4);
      var qr = (document.getElementById("student-qr").value || "").trim();
      if (!qr && (!nid || last4.length !== 4)) {
        message.textContent = "أدخل الهوية وآخر ٤ أرقام، أو رمز QR Pass.";
        return;
      }
      message.textContent = "جارٍ التحقق…";
      fetch("/api/portal/login/student", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ national_id: nid, phone_last4: last4, qr_code: qr })
      })
        .then(function (response) {
          return response.json().then(function (payload) {
            if (!response.ok) {
              throw new Error(payload.detail || "تعذر دخول الطالب");
            }
            return payload;
          });
        })
        .then(function (payload) {
          sessionStorage.setItem(
            TOKEN_KEY,
            JSON.stringify({
              token: payload.token,
              actor_type: "student",
              student: payload.student,
              expires_at: payload.expires_at
            })
          );
          window.location.href = payload.redirect || "portal-student.html";
        })
        .catch(function (error) {
          message.textContent = error.message || "تعذر دخول الطالب";
        });
    });
  }

  var parentForm = document.getElementById("parent-login-form");
  if (parentForm) {
    parentForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var message = document.getElementById("parent-login-message");
      var phone = (document.getElementById("parent-phone").value || "").trim();
      if (!phone) {
        message.textContent = "أدخل رقم جوال ولي الأمر.";
        return;
      }
      message.textContent = "جارٍ التحقق…";
      fetch("/api/portal/login/parent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ phone: phone })
      })
        .then(function (response) {
          return response.json().then(function (payload) {
            if (!response.ok) {
              throw new Error(payload.detail || "تعذر دخول ولي الأمر");
            }
            return payload;
          });
        })
        .then(function (payload) {
          sessionStorage.setItem(
            TOKEN_KEY,
            JSON.stringify({
              token: payload.token,
              actor_type: "parent",
              children: payload.children,
              expires_at: payload.expires_at
            })
          );
          window.location.href = payload.redirect || "portal-parent.html";
        })
        .catch(function (error) {
          message.textContent = error.message || "تعذر دخول ولي الأمر";
        });
    });
  }
})();
