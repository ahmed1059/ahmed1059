(function () {
  "use strict";

  function sessionToken() {
    try {
      var user = JSON.parse(sessionStorage.getItem("sessionUser") || "{}");
      return user && user.token ? String(user.token) : "";
    } catch (error) {
      return "";
    }
  }

  function call(path, method) {
    return fetch(path, {
      method: method,
      headers: { "X-Session-Token": sessionToken(), "Content-Type": "application/json" }
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error((body && body.detail) || "تعذر تنفيذ الطلب");
        }
        return body;
      });
    });
  }

  var clearBtn = document.getElementById("aj-pilot-support-clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!window.confirm("هل أنت متأكد؟ سيتم حذف التسكين التجريبي فقط، ولن تتأثر البيانات الأصلية.")) {
        return;
      }
      call("/api/session/students-support/pilot", "DELETE").then(function (body) {
        window.alert("حُذف التسكين التجريبي. العدد: " + (body.removed || 0));
      }).catch(function (error) {
        window.alert(error.message || "تعذر الحذف");
      });
    });
  }

  var drawBtn = document.getElementById("aj-pilot-support-draw");
  if (drawBtn) {
    drawBtn.addEventListener("click", function () {
      call("/api/session/students-support/pilot-draw", "POST").then(function (body) {
        window.alert("أُعيد التسكين. الموهوبون: " + body.gifted + "، المتدنون: " + body.struggling);
      }).catch(function (error) {
        window.alert(error.message || "تعذر التسكين");
      });
    });
  }
})();
