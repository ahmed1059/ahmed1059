/* تشكيل اللجان — جلسة فقط. المصدر /api/session/committees */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var BANK_URL = "data/committees-bank.json";
  var SEAT_LABEL = {
    chair: "رئيس",
    deputy: "نائب",
    secretary: "مقرر",
    member: "عضو",
    student: "ممثل طلاب",
    parent: "ممثل أولياء الأمور",
    exofficio: "بحكم المنصب"
  };
  var committeesBank = null;
  var committeesBankPromise = null;

  function seatLabel(seat, body) {
    var fromBank = body && body.bank_meta && body.bank_meta.seat_labels;
    if (fromBank && fromBank[seat]) {
      return fromBank[seat];
    }
    return SEAT_LABEL[seat] || seat || "";
  }

  function missingLine(quota) {
    var missing = (quota && quota.missing) || [];
    if (!missing.length) {
      return "";
    }
    return missing.map(function (item) {
      return (item.count || 1) + " " + (item.label || item.seat || "");
    }).join(" + ");
  }

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
      li.textContent = item.title + " — " + seatLabel(item.seat, body);
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
      var quota = committee.quota || {};
      var board = document.createElement("section");
      board.className = "aj-committee-board aj-governance-card" + (quota.complete ? " is-complete" : " is-incomplete");
      board.setAttribute("data-committee", committee.id || "");

      var head = document.createElement("div");
      head.className = "aj-committee-board-head";
      var titleWrap = document.createElement("div");
      titleWrap.className = "aj-governance-title-wrap";
      var title = document.createElement("h2");
      title.className = "aj-group-title";
      title.textContent = committee.title || "";
      titleWrap.appendChild(title);
      var badge = document.createElement("span");
      badge.className = "aj-quota-badge";
      badge.textContent = quota.badge || ((committee.members || []).length + "/?");
      titleWrap.appendChild(badge);
      head.appendChild(titleWrap);

      var printBtn = document.createElement("button");
      printBtn.type = "button";
      printBtn.className = "aj-detail-btn aj-detail-btn-secondary";
      printBtn.textContent = "طباعة قرار اللجنة";
      printBtn.setAttribute("data-print-committee", committee.id || "");
      printBtn.disabled = !(committee.members || []).length;
      printBtn.addEventListener("click", function () {
        printFormation(body, { committeeId: committee.id });
      });
      head.appendChild(printBtn);
      board.appendChild(head);

      var status = document.createElement("p");
      status.className = "aj-quota-status";
      status.setAttribute("role", "status");
      if (quota.complete) {
        status.textContent = "✅ مكتملة النصاب (" + (quota.badge || "") + " أعضاء).";
      } else {
        var gap = missingLine(quota);
        status.textContent = gap
          ? "⚠️ غير مكتملة — متبقي: (" + gap + ")"
          : "⚠️ غير مكتملة — (" + (quota.badge || "") + ")";
      }
      board.appendChild(status);

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
        if (member.by_office) {
          row.classList.add("is-by-office");
        }
        var seat = seatLabel(member.seat, body);
        row.innerHTML = "<td></td><td></td><td class=\"aj-formation-sign\"></td><td></td>";
        row.children[0].textContent = seat;
        if (member.by_office) {
          var office = document.createElement("span");
          office.className = "aj-office-chip";
          office.textContent = "بحكم المنصب";
          row.children[0].appendChild(document.createTextNode(" "));
          row.children[0].appendChild(office);
        }
        row.children[1].textContent = member.name || member.display_name || "";
        if (body.is_principal && !member.by_office) {
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
        tbody.appendChild(addRow(committee, body));
      }
      table.appendChild(tbody);
      scroller.appendChild(table);
      board.appendChild(scroller);
      host.appendChild(board);
    });
    paintSignatures(body);
  }

  function firstMissing(committee) {
    var missing = (committee.quota && committee.quota.missing) || [];
    return missing.length
      ? missing[0]
      : { seat: "member", kind: "staff", role_category: "staff", label: "عضو" };
  }

  /** فئة الدور الأساسية من النصاب — لا تُستنتج من النص الوصفي الطويل. */
  function needRoleCategory(need) {
    var raw = String((need && (need.role_category || need.kind)) || "staff").trim();
    if (raw === "teacher" || raw === "admin" || raw === "student"
        || raw === "parent" || raw === "student_or_parent" || raw === "staff") {
      return raw;
    }
    return "staff";
  }

  function personStaffCategory(person) {
    var role = String((person && person.role) || "");
    return role.indexOf("معلم") >= 0 ? "teacher" : "admin";
  }

  function fillStaffOptions(select, category, showAll) {
    while (select.options.length > 1) {
      select.remove(1);
    }
    var emptyLabel = showAll || category === "staff"
      ? "اختر منسوباً"
      : (category === "admin" ? "اختر إدارياً" : "اختر معلماً");
    select.options[0].textContent = emptyLabel;
    (window.AjCommittees.staff || []).forEach(function (person) {
      if (!person || person.active === false) {
        return;
      }
      var personCat = personStaffCategory(person);
      if (!showAll) {
        if (category === "teacher" && personCat !== "teacher") {
          return;
        }
        if (category === "admin" && personCat !== "admin") {
          return;
        }
      }
      var option = document.createElement("option");
      option.value = person.id || person.national_id || "";
      option.textContent = person.name || option.value;
      select.appendChild(option);
    });
  }

  function addRow(committee, body) {
    var need = firstMissing(committee);
    var kind = needRoleCategory(need);
    var row = document.createElement("tr");
    row.className = "aj-committee-add-row";
    row.setAttribute("data-committee", committee.id || "");
    var cell = document.createElement("td");
    cell.colSpan = 4;
    var bar = document.createElement("div");
    bar.className = "aj-committee-add-bar";

    var seat = document.createElement("select");
    seat.className = "aj-soft-note aj-committee-add-seat";
    seat.setAttribute("aria-label", "الدور");
    [["chair", "رئيس"], ["deputy", "نائب"], ["secretary", "مقرر"], ["member", "عضو"], ["student", "ممثل طلاب"], ["parent", "ممثل أولياء الأمور"]].forEach(function (pair) {
      var option = document.createElement("option");
      option.value = pair[0];
      option.textContent = pair[1];
      if (pair[0] === (need.seat || "member")) {
        option.selected = true;
      }
      seat.appendChild(option);
    });

    var hint = document.createElement("span");
    hint.className = "aj-add-hint";
    hint.textContent = need.label ? ("المطلوب: " + need.label) : "";

    var add = document.createElement("button");
    add.type = "button";
    add.className = "aj-detail-btn";
    add.textContent = "إضافة +";

    if (kind === "student" || (kind === "student_or_parent" && need.seat === "student")) {
      var studentSelect = document.createElement("select");
      studentSelect.className = "aj-soft-note aj-committee-add-person";
      studentSelect.setAttribute("aria-label", "اختر طالباً");
      var emptyS = document.createElement("option");
      emptyS.value = "";
      emptyS.textContent = "اختر طالباً";
      studentSelect.appendChild(emptyS);
      (window.AjCommittees.students || []).forEach(function (student) {
        var option = document.createElement("option");
        option.value = student.id || student.national_id || "";
        option.textContent = (student.name || "") + (student.grade || student.section
          ? " — " + [student.grade, student.section].filter(Boolean).join("/")
          : "");
        studentSelect.appendChild(option);
      });
      add.addEventListener("click", function () {
        if (!studentSelect.value) {
          toast("اختر طالباً من السجل.", "error");
          return;
        }
        var picked = (window.AjCommittees.students || []).find(function (item) {
          return String(item.id || item.national_id) === String(studentSelect.value);
        });
        changeSeat("/api/session/committees/seat", {
          committee_id: committee.id,
          national_id: studentSelect.value,
          seat: seat.value || "student",
          member_kind: "student",
          display_name: picked ? picked.name : ""
        });
      });
      bar.appendChild(hint);
      bar.appendChild(studentSelect);
      bar.appendChild(seat);
      bar.appendChild(add);
    } else if (kind === "parent" || kind === "student_or_parent") {
      var nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "aj-soft-note aj-committee-add-person";
      nameInput.setAttribute("aria-label", "اسم ولي الأمر");
      nameInput.placeholder = "اسم ولي الأمر";
      add.addEventListener("click", function () {
        var name = String(nameInput.value || "").trim();
        if (!name) {
          toast("أدخل اسم ولي الأمر للاعتماد.", "error");
          return;
        }
        changeSeat("/api/session/committees/seat", {
          committee_id: committee.id,
          national_id: "parent:" + name,
          seat: seat.value || "parent",
          member_kind: "parent",
          display_name: name
        });
      });
      bar.appendChild(hint);
      bar.appendChild(nameInput);
      bar.appendChild(seat);
      bar.appendChild(add);
    } else {
      var select = document.createElement("select");
      select.className = "aj-soft-note aj-committee-add-person";
      select.setAttribute("aria-label", "اختر منسوباً");
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "اختر منسوباً";
      select.appendChild(empty);

      var showAllWrap = document.createElement("label");
      showAllWrap.className = "aj-add-show-all";
      var showAll = document.createElement("input");
      showAll.type = "checkbox";
      showAll.setAttribute("aria-label", "إظهار جميع المنسوبين");
      showAllWrap.appendChild(showAll);
      showAllWrap.appendChild(document.createTextNode(" إظهار جميع المنسوبين"));

      function refreshStaffList() {
        fillStaffOptions(select, kind, !!showAll.checked);
      }
      showAll.addEventListener("change", refreshStaffList);
      refreshStaffList();

      add.addEventListener("click", function () {
        if (!select.value) {
          toast("اختر منسوباً من السجل.", "error");
          return;
        }
        changeSeat("/api/session/committees/seat", {
          committee_id: committee.id,
          national_id: select.value,
          seat: seat.value || "member",
          member_kind: "staff"
        });
      });
      bar.appendChild(hint);
      bar.appendChild(select);
      bar.appendChild(showAllWrap);
      bar.appendChild(seat);
      bar.appendChild(add);
    }

    cell.appendChild(bar);
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
    var printGeneralBtn = document.getElementById("aj-committee-print-general");
    var hint = document.getElementById("aj-committee-hint");
    if (drawBtn) {
      drawBtn.hidden = !body.is_principal;
    }
    if (approveBtn) {
      approveBtn.hidden = !(body.is_leader && body.has_formation && body.needs_approval);
    }
    if (printGeneralBtn) {
      printGeneralBtn.hidden = !body.has_formation;
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
    var studentsLoad = window.AjCommittees.students
      ? Promise.resolve(window.AjCommittees.students)
      : fetch("/api/session/noor-students", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.ok ? response.json() : { students: [] };
      }).then(function (body) {
        var list = (body && (body.students || body.people || body.items)) || [];
        window.AjCommittees.students = list.map(function (row) {
          return {
            id: row.id || row.national_id || row.student_id || "",
            national_id: row.national_id || row.id || "",
            name: row.name || row.student_name || "",
            grade: row.grade || row.class_name || "",
            section: row.section || row.فصل || ""
          };
        }).filter(function (row) {
          return row.id || row.name;
        });
        return window.AjCommittees.students;
      }).catch(function () {
        window.AjCommittees.students = [];
        return [];
      });
    return Promise.all([staffLoad, studentsLoad]).then(function () {
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
    var printGeneralBtn = document.getElementById("aj-committee-print-general");
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
    if (printGeneralBtn) {
      printGeneralBtn.addEventListener("click", function () {
        var cached = window.AjCommittees.cache;
        if (!cached || !cached.has_formation) {
          toast("لا تشكيل محفوظ للطباعة.", "error");
          return;
        }
        printFormation(cached);
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

  function loadCommitteesBank() {
    if (committeesBank) {
      return Promise.resolve(committeesBank);
    }
    if (committeesBankPromise) {
      return committeesBankPromise;
    }
    committeesBankPromise = fetch(BANK_URL, { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("تعذر تحميل بنك اللجان.");
      }
      return response.json();
    }).then(function (payload) {
      committeesBank = payload || {};
      return committeesBank;
    }).catch(function () {
      committeesBankPromise = null;
      committeesBank = { decree: {}, committees: {} };
      return committeesBank;
    });
    return committeesBankPromise;
  }

  function bankEntry(bank, committee) {
    var map = (bank && bank.committees) || {};
    var byId = map[committee && committee.id] || null;
    if (byId) {
      return byId;
    }
    var title = String((committee && committee.title) || "").trim();
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i += 1) {
      if (String(map[keys[i]].title || "").trim() === title) {
        return map[keys[i]];
      }
    }
    return { title: title, tasks: [] };
  }

  function fillToken(text, committeeName) {
    return String(text || "").replace(/\{\{\s*committee_name\s*\}\}/g, committeeName || "");
  }

  function formationDateLine(body) {
    // تاريخ صدور القرار = بداية العام (أسبوع 1) من المرجع؛ لا تاريخ السحب/الطباعة
    var iso = String((body && body.decree_date) || "").trim();
    if (!iso) {
      iso = String((body && body.drawn_at) || "").trim();
    }
    if (!iso) {
      return "";
    }
    var day = iso.indexOf("T") >= 0 ? iso.slice(0, 10) : iso.slice(0, 10);
    if (window.AjDates) {
      var hijri = window.AjDates.hijri(day);
      var gregorian = window.AjDates.gregorian(day);
      if (hijri && gregorian) {
        return hijri + "، الموافق " + gregorian;
      }
      return hijri || gregorian || "";
    }
    return day;
  }

  function decreePreambleHtml(bank, opts) {
    opts = opts || {};
    var decree = (bank && bank.decree) || {};
    var single = !!opts.single;
    var committeeName = opts.committeeName || "";
    var entry = opts.entry || { tasks: [] };
    var parts = [];
    var dateLine = opts.dateLine || "";
    var stamp = opts.stamp || "";
    if (dateLine || stamp) {
      parts.push("<p class=\"aj-committee-decree-meta\">"
        + (dateLine ? ("التاريخ: " + escapePrint(dateLine)) : "")
        + (dateLine && stamp ? " — " : "")
        + (stamp ? ("مرجع التشكيل: " + escapePrint(stamp)) : "")
        + "</p>");
    }
    if (decree.basis) {
      parts.push("<p>" + escapePrint(decree.basis) + "</p>");
    }
    if (single) {
      parts.push("<p>" + escapePrint(fillToken(decree.intro_single || "", committeeName)) + "</p>");
    } else if (decree.intro_general) {
      parts.push("<p>" + escapePrint(decree.intro_general) + "</p>");
    }
    if (single && entry.tasks && entry.tasks.length) {
      parts.push("<p><strong>مهام اللجنة:</strong></p><ul class=\"aj-committee-decree-tasks\">"
        + entry.tasks.map(function (task) {
          return "<li>" + escapePrint(task) + "</li>";
        }).join("")
        + "</ul>");
    }
    if (decree.charge) {
      parts.push("<p>" + escapePrint(decree.charge) + "</p>");
    }
    if (decree.duration) {
      parts.push("<p>" + escapePrint(decree.duration) + "</p>");
    }
    if (decree.enactment) {
      parts.push("<p>" + escapePrint(decree.enactment) + "</p>");
    }
    return "<div class=\"aj-committee-decree\">" + parts.join("") + "</div>";
  }

  function membersTableHtml(committee, signs) {
    var members = (committee && committee.members) || [];
    if (!members.length) {
      return "";
    }
    var rows = members.map(function (member) {
      var sigSrc = signs[member.national_id] || "";
      var sigHtml = sigSrc
        ? "<img class=\"sig-image aj-committee-print-sig\" src=\"" + escapePrint(sigSrc) + "\" alt=\"\">"
        : "<span class=\"aj-committee-print-sig-line\" aria-hidden=\"true\"></span>";
      return "<tr>"
        + "<td>" + escapePrint(SEAT_LABEL[member.seat] || member.seat || "") + "</td>"
        + "<td>" + escapePrint(member.name || "") + "</td>"
        + "<td class=\"aj-committee-print-sign\">" + sigHtml + "</td>"
        + "</tr>";
    }).join("");
    return "<table class=\"aj-committee-print-table\">"
      + "<thead><tr><th>الدور</th><th>الاسم</th><th>التوقيع</th></tr></thead>"
      + "<tbody>" + rows + "</tbody></table>";
  }

  function committeeBlockHtml(committee, bank, signs, opts) {
    opts = opts || {};
    var entry = bankEntry(bank, committee);
    var title = committee.title || entry.title || "";
    var tasksHtml = "";
    if (!opts.single && entry.tasks && entry.tasks.length) {
      tasksHtml = "<p><strong>مهام اللجنة:</strong></p><ul class=\"aj-committee-decree-tasks\">"
        + entry.tasks.map(function (task) {
          return "<li>" + escapePrint(task) + "</li>";
        }).join("")
        + "</ul>";
    }
    return "<section class=\"aj-committee-print-block\">"
      + "<h2 class=\"aj-committee-print-title\">" + escapePrint(title) + "</h2>"
      + tasksHtml
      + membersTableHtml(committee, signs)
      + "</section>";
  }

  function resolveSignatures(ids) {
    var seats = (ids || []).filter(Boolean).map(function (id) {
      return { role: "", national_id: id, name: "" };
    });
    var headers = authHeaders();
    delete headers["Content-Type"];
    if (window.SignatureCore && typeof window.SignatureCore.resolve === "function") {
      return window.SignatureCore.resolve(seats, { headers: headers }).then(function (rows) {
        var map = {};
        (rows || []).forEach(function (row) {
          if (row && row.id && row.signature) {
            map[row.id] = row.signature;
          }
        });
        return map;
      }).catch(function () {
        return {};
      });
    }
    if (!seats.length) {
      return Promise.resolve({});
    }
    return fetch("/api/session/signatures?ids=" + encodeURIComponent(ids.join(",")), {
      headers: headers,
      cache: "no-store"
    }).then(function (response) {
      return response.ok ? response.json() : { signatures: {} };
    }).then(function (payload) {
      return (payload && payload.signatures) || {};
    }).catch(function () {
      return {};
    });
  }

  function printFormation(body, options) {
    options = options || {};
    if (!window.PrintEngine || typeof window.PrintEngine.open !== "function") {
      toast("بوابة PrintEngine غير محمّلة.", "error");
      return;
    }
    if (!window.PrintMasterCore || typeof window.PrintMasterCore.sheet !== "function") {
      toast("نواة الطباعة غير محمّلة.", "error");
      return;
    }
    var committeeId = options.committeeId || "";
    var targetCommittees = (body.committees || []).filter(function (committee) {
      if (committeeId) {
        return committee.id === committeeId;
      }
      return (committee.members || []).length > 0;
    });
    if (committeeId && !targetCommittees.length) {
      toast("اللجنة غير موجودة أو بلا أعضاء.", "error");
      return;
    }
    var ids = [];
    targetCommittees.forEach(function (committee) {
      (committee.members || []).forEach(function (member) {
        if (member && member.national_id && ids.indexOf(member.national_id) < 0) {
          ids.push(member.national_id);
        }
      });
    });
    (body.approvals || []).forEach(function (item) {
      if (item && item.national_id && ids.indexOf(item.national_id) < 0) {
        ids.push(item.national_id);
      }
    });

    Promise.all([loadCommitteesBank(), resolveSignatures(ids)]).then(function (parts) {
      var bank = parts[0] || {};
      var signs = parts[1] || {};
      var decree = bank.decree || {};
      var single = !!committeeId;
      var focus = single ? targetCommittees[0] : null;
      var entry = focus ? bankEntry(bank, focus) : null;
      var committeeName = focus ? (focus.title || entry.title || "") : "";
      var dateLine = formationDateLine(body);
      var stamp = String((body && body.stamp) || "").trim();
      var preamble = decreePreambleHtml(bank, {
        single: single,
        committeeName: committeeName,
        entry: entry || { tasks: [] },
        dateLine: dateLine,
        stamp: stamp
      });
      var sections = [];
      if (!targetCommittees.length) {
        sections.push("<p class=\"aj-committee-print-empty\">لا عضوية محفوظة في التشكيل بعد.</p>");
      } else {
        targetCommittees.forEach(function (committee) {
          sections.push(committeeBlockHtml(committee, bank, signs, { single: single }));
        });
      }
      var columns = (body.approvals || []).filter(function (item) {
        return item && item.name;
      }).map(function (item) {
        return {
          role: "اعتماد",
          roleTitle: "اعتماد",
          name: item.name,
          signature: signs[item.national_id] || ""
        };
      });
      var docTitle = single
        ? fillToken(decree.title_single || "قرار إداري بتشكيل {{committee_name}}", committeeName)
        : (decree.title_general || "قرار إداري بتشكيل اللجان المدرسية");
      var kind = single ? "committee_decree" : "committees";
      var fileName = single
        ? ("قرار_تشكيل_" + committeeName + "_1448")
        : "تشكيل_اللجان";
      window.PrintEngine.open("master-sheet", {
        docTitle: docTitle,
        title: docTitle,
        kind: kind,
        committeeName: committeeName,
        fileName: fileName,
        file: {
          kind: kind,
          committeeName: committeeName,
          title: docTitle
        },
        bodyHtml: preamble + sections.join(""),
        signatures: columns,
        signoff: columns.length > 0,
        multiPage: !single,
        orientation: "portrait"
      });
    });
  }

  window.AjCommittees = {
    cache: null,
    staff: null,
    students: null,
    gateRequired: false,
    load: load,
    afterAuth: afterAuth,
    shouldRedirect: shouldRedirect,
    chairOf: chairOf,
    memberIds: memberIds
  };

  bind();
})();
