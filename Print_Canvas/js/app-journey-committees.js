/* تشكيل اللجان — جلسة فقط. المصدر /api/session/committees */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var SEAT_LABEL = {
    chair: "رئيس",
    member: "عضو",
    exofficio: "بحكم المنصب"
  };

  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function authHeaders() {
    var headers = { "Content-Type": "application/json" };
    var user = currentUser();
    if (user && user.token) {
      headers["X-Session-Token"] = user.token;
    }
    return headers;
  }

  function toast(text, kind) {
    var box = document.getElementById("aj-toast");
    if (!box) {
      return;
    }
    box.hidden = !text;
    box.textContent = text || "";
    box.className = "aj-toast" + (kind === "error" ? " is-error" : "");
  }

  function jsonFetch(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          var detail = body && body.detail;
          if (typeof detail === "string") {
            throw new Error(detail);
          }
          throw new Error("تعذر إكمال الطلب.");
        }
        return body;
      });
    });
  }

  function applyLock(on) {
    document.body.classList.toggle("aj-committee-lock", !!on);
  }

  function renderMine(body) {
    var box = document.getElementById("aj-committee-mine");
    if (!box) {
      return;
    }
    box.innerHTML = "";
    var mine = (body && body.my_committees) || [];
    if (!mine.length) {
      box.textContent = "لم تُدرج بعد في تشكيل معتمد.";
      return;
    }
    mine.forEach(function (item) {
      var li = document.createElement("li");
      li.textContent = item.title + " — " + (SEAT_LABEL[item.seat] || item.seat);
      box.appendChild(li);
    });
  }

  function renderApprovals(body) {
    var box = document.getElementById("aj-committee-approvals");
    if (!box) {
      return;
    }
    box.innerHTML = "";
    (body.approvals || []).forEach(function (item) {
      var li = document.createElement("li");
      li.textContent = (item.name || item.national_id) + " — " + (item.approved ? "معتمد" : "بانتظار الاعتماد");
      box.appendChild(li);
    });
  }

  function renderBoards(body) {
    var host = document.getElementById("aj-committee-boards");
    if (!host) {
      return;
    }
    host.innerHTML = "";
    host.className = "aj-committee-boards";
    (body.committees || []).forEach(function (committee) {
      var board = document.createElement("section");
      board.className = "aj-committee-board";
      board.setAttribute("data-committee", committee.id || "");
      var title = document.createElement("h2");
      title.className = "aj-group-title";
      title.textContent = committee.title || "";
      board.appendChild(title);
      var scroller = document.createElement("div");
      scroller.className = "aj-table-scroll";
      var table = document.createElement("table");
      table.className = "aj-formation-table";
      table.innerHTML = "<thead><tr><th>الدور</th><th>الاسم</th><th>التوقيع</th><th></th></tr></thead>";
      var tbody = document.createElement("tbody");
      var members = committee.members || [];
      if (!members.length) {
        var empty = document.createElement("tr");
        empty.className = "aj-committee-empty";
        empty.innerHTML = "<td colspan=\"4\">لا أعضاء في هذه اللجنة بعد.</td>";
        tbody.appendChild(empty);
      }
      members.forEach(function (member) {
        var row = document.createElement("tr");
        row.setAttribute("data-nid", member.national_id || "");
        row.setAttribute("data-committee", committee.id);
        var seat = SEAT_LABEL[member.seat] || member.seat || "";
        row.innerHTML = "<td></td><td></td><td class=\"aj-formation-sign\"></td><td></td>";
        row.children[0].textContent = seat;
        row.children[1].textContent = member.name || "";
        if (body.is_principal) {
          var remove = document.createElement("button");
          remove.type = "button";
          remove.className = "aj-detail-btn aj-detail-btn-secondary";
          remove.textContent = "حذف عضو -";
          remove.addEventListener("click", function () {
            changeSeat("/api/session/committees/seat/remove", {
              committee_id: committee.id,
              national_id: member.national_id,
              seat: member.seat
            });
          });
          row.children[3].appendChild(remove);
        }
        tbody.appendChild(row);
      });
      if (body.is_principal) {
        tbody.appendChild(addRow(committee));
      }
      table.appendChild(tbody);
      scroller.appendChild(table);
      board.appendChild(scroller);
      host.appendChild(board);
    });
    paintSignatures(body);
  }

  function addRow(committee) {
    var row = document.createElement("tr");
    row.className = "aj-committee-add-row";
    row.setAttribute("data-committee", committee.id || "");
    var select = document.createElement("select");
    select.className = "aj-soft-note";
    var empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "اختر منسوباً";
    select.appendChild(empty);
    (window.AjCommittees.staff || []).forEach(function (person) {
      if (!person || person.active === false) {
        return;
      }
      var option = document.createElement("option");
      option.value = person.id;
      option.textContent = person.name;
      select.appendChild(option);
    });
    var seat = document.createElement("select");
    seat.className = "aj-soft-note";
    [["member", "عضو"], ["chair", "رئيس"], ["exofficio", "بحكم المنصب"]].forEach(function (pair) {
      var option = document.createElement("option");
      option.value = pair[0];
      option.textContent = pair[1];
      seat.appendChild(option);
    });
    var add = document.createElement("button");
    add.type = "button";
    add.className = "aj-detail-btn";
    add.textContent = "إضافة عضو +";
    add.addEventListener("click", function () {
      if (!select.value) {
        toast("اختر منسوباً من السجل.", "error");
        return;
      }
      changeSeat("/api/session/committees/seat", {
        committee_id: committee.id,
        national_id: select.value,
        seat: seat.value
      });
    });
    var cell = document.createElement("td");
    cell.colSpan = 4;
    cell.appendChild(select);
    cell.appendChild(seat);
    cell.appendChild(add);
    row.appendChild(cell);
    return row;
  }

  function changeSeat(url, payload) {
    jsonFetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    }).then(function (body) {
      applyBody(body);
      toast("تم تحديث التشكيل.", "success");
    }).catch(function (error) {
      toast(error.message || "تعذر تحديث التشكيل.", "error");
    });
  }

  function paintSignatures(body) {
    var ids = [];
    (body.committees || []).forEach(function (committee) {
      (committee.members || []).forEach(function (member) {
        if (member.has_signature && member.national_id && ids.indexOf(member.national_id) < 0) {
          ids.push(member.national_id);
        }
      });
    });
    if (!ids.length) {
      return;
    }
    var headers = authHeaders();
    delete headers["Content-Type"];
    fetch("/api/session/signatures?ids=" + encodeURIComponent(ids.join(",")), {
      headers: headers,
      cache: "no-store"
    }).then(function (response) {
      return response.json();
    }).then(function (payload) {
      var map = payload && payload.signatures ? payload.signatures : {};
      document.querySelectorAll("#aj-committee-boards [data-nid]").forEach(function (row) {
        var ident = row.getAttribute("data-nid");
        var src = map[ident];
        var cell = row.querySelector(".aj-formation-sign");
        if (!src || !cell) {
          return;
        }
        var img = document.createElement("img");
        img.className = "aj-committee-sig";
        img.alt = "توقيع";
        img.src = src;
        cell.appendChild(img);
      });
    }).catch(function () {
      return;
    });
  }

  function syncActions(body) {
    var drawBtn = document.getElementById("aj-committee-draw");
    var approveBtn = document.getElementById("aj-committee-approve");
    var hint = document.getElementById("aj-committee-hint");
    if (drawBtn) {
      drawBtn.hidden = !body.is_principal;
    }
    if (approveBtn) {
      approveBtn.hidden = !(body.is_leader && body.has_formation && body.needs_approval);
    }
    if (hint) {
      if (body.needs_draw) {
        hint.textContent = "يلزمك إجراء القرعة واعتماد التشكيل قبل دخول بقية الرحلة.";
      } else if (body.needs_wait) {
        hint.textContent = "انتظار قرعة المدير. الاعتماد متطلب دخول للوكلاء بعد ظهور التشكيل.";
      } else if (body.needs_approval) {
        hint.textContent = "راجع التشكيل ثم اضغط اعتماد. هذا متطلب دخول بعد التوقيع.";
      } else if ((body.my_committees || []).length) {
        hint.textContent = "أنت عضو في اللجان أدناه. توقيعك يظهر في المحاضر والبرامج عند وجود الملف.";
      } else {
        hint.textContent = "التشكيل معتمد. العضوية تُقرأ من السجل.";
      }
    }
  }

  function applyBody(body) {
    window.AjCommittees.cache = body;
    window.AjCommittees.gateRequired = !!body.needs_committee_action;
    applyLock(body.needs_committee_action);
    renderMine(body);
    renderApprovals(body);
    renderBoards(body);
    syncActions(body);
    var status = document.getElementById("aj-committee-status");
    if (status) {
      status.textContent = body.has_formation
        ? (body.drawn_at ? "ختم التشكيل: " + body.stamp : "")
        : "لا تشكيل محفوظ بعد.";
    }
    return body;
  }

  function load() {
    var staffLoad = window.AjCommittees.staff
      ? Promise.resolve(window.AjCommittees.staff)
      : fetch("/api/noor/staff", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.json();
      }).then(function (body) {
        window.AjCommittees.staff = (body && body.people) || [];
        return window.AjCommittees.staff;
      }).catch(function () {
        window.AjCommittees.staff = [];
        return [];
      });
    return staffLoad.then(function () {
      return jsonFetch("/api/session/committees", {
        headers: authHeaders(),
        cache: "no-store"
      }).then(applyBody);
    });
  }

  function afterAuth(user) {
    if (!user || !String(user.signature_path || "").trim()) {
      return Promise.resolve(null);
    }
    return load().then(function (body) {
      if (body && body.needs_committee_action && window.location.hash.indexOf("view-committees") < 0) {
        window.location.replace("#view-committees");
      }
      return body;
    }).catch(function () {
      return null;
    });
  }

  function shouldRedirect(viewId) {
    return window.AjCommittees.gateRequired && viewId !== "view-committees";
  }

  function chairOf(committeeId) {
    var data = window.AjCommittees.cache;
    if (!data || !committeeId) {
      return "";
    }
    var list = data.committees || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id !== committeeId) {
        continue;
      }
      var members = list[i].members || [];
      for (var j = 0; j < members.length; j += 1) {
        if (members[j].seat === "chair") {
          return String(members[j].national_id || "");
        }
      }
    }
    return "";
  }

  function memberIds(committeeId) {
    var data = window.AjCommittees.cache;
    var ids = [];
    if (!data || !committeeId) {
      return ids;
    }
    (data.committees || []).forEach(function (committee) {
      if (committee.id !== committeeId) {
        return;
      }
      (committee.members || []).forEach(function (member) {
        if (member.national_id) {
          ids.push(String(member.national_id));
        }
      });
    });
    return ids;
  }

  function bind() {
    var drawBtn = document.getElementById("aj-committee-draw");
    var approveBtn = document.getElementById("aj-committee-approve");
    if (drawBtn) {
      drawBtn.addEventListener("click", function () {
        drawBtn.disabled = true;
        jsonFetch("/api/session/committees/draw", {
          method: "POST",
          headers: authHeaders(),
          body: "{}"
        }).then(function (body) {
          applyBody(body);
          toast("تم سحب التشكيل. اعتمده للدخول.", "success");
        }).catch(function (error) {
          toast(error.message || "تعذر سحب التشكيل.", "error");
        }).finally(function () {
          drawBtn.disabled = false;
        });
      });
    }
    if (approveBtn) {
      approveBtn.addEventListener("click", function () {
        approveBtn.disabled = true;
        jsonFetch("/api/session/committees/approve", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ acknowledged: true })
        }).then(function (body) {
          applyBody(body);
          toast("تم اعتماد التشكيل.", "success");
          printFormation(body);
        }).catch(function (error) {
          toast(error.message || "تعذر الاعتماد.", "error");
        }).finally(function () {
          approveBtn.disabled = false;
        });
      });
    }
    window.addEventListener("app:committees:changed", function () {
      var stored = currentUser();
      if (stored) {
        load();
      }
    });
    window.addEventListener("app:signature:saved", function () {
      var stored = currentUser();
      if (!stored) {
        return;
      }
      stored.signature_path = stored.signature_path || "saved";
      afterAuth(stored);
    });
  }

  function escapePrint(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function printFormation(body) {
    var core = window.PrintMasterCore;
    if (!core || typeof core.sheet !== "function" || !window.AJPrint) {
      return;
    }
    var sections = [];
    (body.committees || []).forEach(function (committee) {
      var members = committee.members || [];
      var rows = members.map(function (member) {
        return "<tr>"
          + "<td style=\"padding:1.5mm;border:1px solid #9db8b2;font-size:12px;\">"
          + escapePrint(SEAT_LABEL[member.seat] || member.seat || "")
          + "</td>"
          + "<td style=\"padding:1.5mm;border:1px solid #9db8b2;font-size:12px;\">"
          + escapePrint(member.name || "")
          + "</td></tr>";
      }).join("");
      if (!rows) {
        rows = "<tr><td colspan=\"2\" style=\"padding:1.5mm;border:1px solid #9db8b2;font-size:12px;\">لا أعضاء</td></tr>";
      }
      sections.push(
        "<h2 class=\"tpl-h2\" style=\"margin:3mm 0 1.5mm;font-size:14px;color:#0b5e56;\">"
        + escapePrint(committee.title || "")
        + "</h2>"
        + "<table style=\"width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 3mm;\">"
        + "<thead><tr>"
        + "<th style=\"width:30%;padding:1.5mm;border:1px solid #0b5e56;font-size:12px;\">الدور</th>"
        + "<th style=\"width:70%;padding:1.5mm;border:1px solid #0b5e56;font-size:12px;\">الاسم</th>"
        + "</tr></thead><tbody>" + rows + "</tbody></table>"
      );
    });
    var columns = (body.approvals || []).filter(function (item) {
      return item && item.name;
    }).map(function (item) {
      return { role: "اعتماد", roleTitle: "اعتماد", name: item.name, signature: "" };
    });
    var html = core.sheet({
      title: "تشكيل اللجان",
      kind: "committees",
      bodyHtml: sections.join(""),
      signoff: columns.length > 0,
      columns: columns
    });
    window.AJPrint.show(html, { pdfTitle: "تشكيل اللجان", arm: { multiPage: true } });
  }

  window.AjCommittees = {
    cache: null,
    staff: null,
    gateRequired: false,
    load: load,
    afterAuth: afterAuth,
    shouldRedirect: shouldRedirect,
    chairOf: chairOf,
    memberIds: memberIds
  };

  bind();
})();
