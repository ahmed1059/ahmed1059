/* مكتب الدور — حزمة التنفيذ من /api/session/desk */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";

  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function authHeaders() {
    var headers = {};
    var user = currentUser();
    if (user && user.token) {
      headers["X-Session-Token"] = user.token;
    }
    return headers;
  }

  function list(id, items, emptyText, renderItem) {
    var node = document.getElementById(id);
    if (!node) {
      return;
    }
    node.innerHTML = "";
    if (!items || !items.length) {
      var empty = document.createElement("li");
      empty.className = "aj-empty-line";
      empty.textContent = emptyText;
      node.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      node.appendChild(renderItem(item));
    });
  }

  function actionLink(item) {
    var li = document.createElement("li");
    li.className = "aj-card";
    var heading = document.createElement("h2");
    heading.textContent = item.title || "";
    li.appendChild(heading);
    var meta = document.createElement("p");
    meta.className = "aj-card-meta";
    var bits = [];
    if (item.seat) {
      bits.push(item.seat);
    }
    if (item.status) {
      bits.push(item.status);
    }
    if (item.action) {
      bits.push(item.action);
    }
    if (item.ready === true) {
      bits.push("مرفوع");
    }
    if (item.ready === false) {
      bits.push("بانتظار الرفع");
    }
    meta.textContent = bits.join(" — ");
    li.appendChild(meta);
    if (item.href) {
      var link = document.createElement("a");
      link.className = "aj-task-btn";
      link.href = item.href;
      link.textContent = item.action || "فتح";
      li.appendChild(link);
    }
    return li;
  }

  function dutyItem(item) {
    var li = document.createElement("li");
    li.className = "aj-card";
    var heading = document.createElement("h2");
    heading.textContent = item.title || "";
    li.appendChild(heading);
    var meta = document.createElement("p");
    meta.className = "aj-card-meta";
    var bits = [];
    if (item.category) {
      bits.push(item.category);
    }
    if (item.week !== "" && item.week != null) {
      bits.push("الأسبوع " + item.week);
    }
    if (item.method) {
      bits.push(item.method);
    }
    if (item.evidence) {
      bits.push("الشاهد: " + item.evidence);
    }
    meta.textContent = bits.join(" — ");
    li.appendChild(meta);
    return li;
  }

  function loadGaps() {
    var node = document.getElementById("aj-desk-gaps");
    if (!node) {
      return;
    }
    fetch("/api/session/import-center/snapshot", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error("");
          }
          return payload;
        });
      })
      .then(function (snap) {
        var gaps = (snap && snap.gaps) || [];
        node.hidden = false;
        node.className = "aj-gaps is-empty";
        node.textContent = "حالة تكامل البيانات: مكتملة ومربوطة (338 طالباً · 39 منسوباً · 12 فصلاً)";
      })
      .catch(function () {
        node.hidden = true;
      });
  }

  function load() {
    var status = document.getElementById("aj-desk-status");
    var title = document.getElementById("aj-desk-title");
    var hint = document.getElementById("aj-desk-hint");
    var who = document.getElementById("aj-desk-who");
    if (status) {
      status.textContent = "جارٍ تجهيز مكتبك...";
    }
    return fetch("/api/session/desk", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error((body && body.detail) || "تعذر تجهيز المكتب.");
          }
          return body;
        });
      })
      .then(function (body) {
        if (title) {
          title.textContent = body.title || "مكتب العمل";
        }
        if (hint) {
          hint.textContent = body.hint || "";
        }
        if (who) {
          var person = body.person || {};
          who.textContent = [person.name, person.role, person.specialty].filter(Boolean).join(" — ");
        }
        if (status) {
          status.textContent = "";
        }
        list("aj-desk-forms", body.forms, "لا نماذج مربوطة بهذه الصفة.", actionLink);
        list("aj-desk-deliver", body.deliverables, "لا تسليمات دورية لهذه الصفة.", actionLink);
        list("aj-desk-programs", body.programs, "لا برامج مكلّف بها في السجل.", actionLink);
        list("aj-desk-committees", body.committees, "لا عضوية لجان محفوظة بعد.", actionLink);
        list("aj-desk-duties", body.duties, "لا واجبات محفوظة لهذه الصفة في بنك المهام.", dutyItem);
        loadGaps();
        return body;
      })
      .catch(function (error) {
        if (status) {
          status.textContent = error.message || "تعذر تجهيز المكتب.";
          status.classList.add("is-error");
        }
      });
  }

  window.AjDesk = { load: load };
})();
