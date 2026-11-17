/* شاشات تخطيطي الإضافية — جلسة فقط، بلا localStorage للبيانات */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var calendarState = null;
  var permWindows = [];

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

  function toast(text, kind) {
    var box = document.getElementById("aj-toast");
    if (!box) {
      return;
    }
    box.hidden = !text;
    box.textContent = text || "";
    box.className = "aj-toast" + (kind === "error" ? " is-error" : "");
  }

  function apiError(body, fallback) {
    if (body && body.detail) {
      if (typeof body.detail === "string") {
        return body.detail;
      }
      if (Array.isArray(body.detail) && body.detail[0] && body.detail[0].msg) {
        return body.detail[0].msg;
      }
    }
    return fallback;
  }

  function jsonFetch(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error(apiError(body, "تعذر إكمال الطلب."));
        }
        return body;
      }).catch(function (error) {
        if (error && error.message && error.message !== "تعذر إكمال الطلب.") {
          throw error;
        }
        if (!response.ok) {
          throw new Error("تعذر إكمال الطلب.");
        }
        throw error;
      });
    });
  }

  function setStatus(id, text, isError) {
    var node = document.getElementById(id);
    if (!node) {
      return;
    }
    node.textContent = text || "";
    node.classList.toggle("is-error", !!isError);
  }

  function fillYears(select, years, current) {
    select.innerHTML = "";
    (years || []).forEach(function (year) {
      var option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      select.appendChild(option);
    });
    if (current) {
      select.value = current;
    }
  }

  function renderStations(items) {
    var list = document.getElementById("aj-calendar-stations");
    if (!list) {
      return;
    }
    list.innerHTML = "";
    (items || []).forEach(function (item) {
      var li = document.createElement("li");
      li.className = "aj-card";
      var title = document.createElement("p");
      title.textContent = item.title || "";
      var meta = document.createElement("p");
      meta.className = "aj-card-meta";
      meta.textContent = [item.hijriStart, item.gregorianStart, item.note].filter(Boolean).join(" — ");
      li.appendChild(title);
      li.appendChild(meta);
      list.appendChild(li);
    });
  }

  function applyCalendar(data) {
    calendarState = data;
    fillYears(document.getElementById("aj-calendar-year"), data.years, data.year);
    document.getElementById("aj-calendar-region").value = data.region || "makkah";
    document.getElementById("aj-calendar-terms").value = data.termCount || "2";
    document.getElementById("aj-cal-start-h").value = data.startHijri || "";
    document.getElementById("aj-cal-start-g").value = data.startGregorian || "";
    document.getElementById("aj-cal-exam-h").value = data.examHijri || "";
    document.getElementById("aj-cal-exam-g").value = data.examGregorian || "";
    document.getElementById("aj-cal-end-h").value = data.endHijri || "";
    document.getElementById("aj-cal-end-g").value = data.endGregorian || "";
  }

  function loadStations() {
    var year = document.getElementById("aj-calendar-year").value;
    var region = document.getElementById("aj-calendar-region").value;
    return jsonFetch("/api/session/calendar/stations?year=" + encodeURIComponent(year) + "&region=" + encodeURIComponent(region), {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (body) {
      renderStations(body.items || []);
      return body;
    });
  }

  function loadCalendar() {
    jsonFetch("/api/session/calendar", { headers: authHeaders(), cache: "no-store" })
      .then(function (data) {
        applyCalendar(data);
        return loadStations();
      })
      .catch(function (error) {
        setStatus("aj-calendar-status", error.message, true);
      });
  }

  function calendarPayload() {
    var years = [];
    Array.prototype.forEach.call(document.getElementById("aj-calendar-year").options, function (option) {
      years.push(option.value);
    });
    return {
      years: years,
      year: document.getElementById("aj-calendar-year").value,
      region: document.getElementById("aj-calendar-region").value,
      termCount: document.getElementById("aj-calendar-terms").value,
      startHijri: document.getElementById("aj-cal-start-h").value.trim(),
      startGregorian: document.getElementById("aj-cal-start-g").value.trim(),
      examHijri: document.getElementById("aj-cal-exam-h").value.trim(),
      examGregorian: document.getElementById("aj-cal-exam-g").value.trim(),
      endHijri: document.getElementById("aj-cal-end-h").value.trim(),
      endGregorian: document.getElementById("aj-cal-end-g").value.trim()
    };
  }

  function saveCalendar(event) {
    event.preventDefault();
    jsonFetch("/api/session/calendar", {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify(calendarPayload())
    }).then(function (data) {
      applyCalendar(data);
      setStatus("aj-calendar-status", "حُفظ التقويم.", false);
      toast("حُفظ التقويم.", "success");
      return loadStations();
    }).catch(function (error) {
      setStatus("aj-calendar-status", error.message, true);
      toast(error.message, "error");
    });
  }

  function fillOfficialDates() {
    loadStations().then(function (body) {
      var items = body.items || [];
      items.forEach(function (item) {
        if (item.anchor === "yearStart") {
          document.getElementById("aj-cal-start-h").value = item.hijriStart || "";
          document.getElementById("aj-cal-start-g").value = item.gregorianStart || "";
        }
        if (item.anchor === "examStart") {
          document.getElementById("aj-cal-exam-h").value = item.hijriStart || "";
          document.getElementById("aj-cal-exam-g").value = item.gregorianStart || "";
        }
        if (item.anchor === "yearEnd") {
          document.getElementById("aj-cal-end-h").value = item.hijriStart || "";
          document.getElementById("aj-cal-end-g").value = item.gregorianStart || "";
        }
      });
      setStatus("aj-calendar-status", "عُبئت التواريخ من المحطات المحفوظة إن وُجدت.", false);
    }).catch(function (error) {
      setStatus("aj-calendar-status", error.message, true);
    });
  }

  function renderOccasions(items) {
    var list = document.getElementById("aj-occasions-list");
    list.innerHTML = "";
    (items || []).forEach(function (item) {
      var li = document.createElement("li");
      li.className = "aj-card";
      var title = document.createElement("p");
      title.textContent = item.title;
      var meta = document.createElement("p");
      meta.className = "aj-card-meta";
      meta.textContent = item.year + " — " + (item.gregorianStart || item.hijriStart || "");
      var actions = document.createElement("div");
      actions.className = "aj-task-actions";
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "aj-detail-btn";
      edit.textContent = "تعديل";
      edit.addEventListener("click", function () {
        document.getElementById("aj-occ-id").value = item.id || "";
        document.getElementById("aj-occ-year").value = item.year || "";
        document.getElementById("aj-occ-title").value = item.title || "";
        document.getElementById("aj-occ-type").value = item.type || "";
        document.getElementById("aj-occ-scope").value = item.scope || "all";
        document.getElementById("aj-occ-hs").value = item.hijriStart || "";
        document.getElementById("aj-occ-he").value = item.hijriEnd || "";
        document.getElementById("aj-occ-gs").value = item.gregorianStart || "";
        document.getElementById("aj-occ-ge").value = item.gregorianEnd || "";
        document.getElementById("aj-occ-note").value = item.note || "";
      });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "aj-council-delete";
      remove.textContent = "حذف";
      remove.addEventListener("click", function () {
        if (!window.confirm("حذف المناسبة؟")) {
          return;
        }
        jsonFetch("/api/session/occasions/" + encodeURIComponent(item.id), {
          method: "DELETE",
          headers: authHeaders()
        }).then(loadOccasions).catch(function (error) {
          toast(error.message, "error");
        });
      });
      actions.appendChild(edit);
      actions.appendChild(remove);
      li.appendChild(title);
      li.appendChild(meta);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function loadOccasions() {
    jsonFetch("/api/session/occasions", { headers: authHeaders(), cache: "no-store" })
      .then(function (body) {
        renderOccasions(body.items || []);
      })
      .catch(function (error) {
        setStatus("aj-occasions-status", error.message, true);
      });
  }

  function saveOccasion(event) {
    event.preventDefault();
    jsonFetch("/api/session/occasions", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({
        id: document.getElementById("aj-occ-id").value.trim(),
        year: document.getElementById("aj-occ-year").value.trim(),
        title: document.getElementById("aj-occ-title").value.trim(),
        type: document.getElementById("aj-occ-type").value.trim(),
        scope: document.getElementById("aj-occ-scope").value,
        hijriStart: document.getElementById("aj-occ-hs").value.trim(),
        hijriEnd: document.getElementById("aj-occ-he").value.trim(),
        gregorianStart: document.getElementById("aj-occ-gs").value.trim(),
        gregorianEnd: document.getElementById("aj-occ-ge").value.trim(),
        note: document.getElementById("aj-occ-note").value.trim()
      })
    }).then(function () {
      document.getElementById("aj-occasion-form").reset();
      document.getElementById("aj-occ-id").value = "";
      toast("حُفظت المناسبة.", "success");
      loadOccasions();
    }).catch(function (error) {
      toast(error.message, "error");
    });
  }

  function renderLetterhead(data) {
    document.getElementById("aj-letter-note").value = data.stamp_note || "";
    var host = document.getElementById("aj-letter-previews");
    host.innerHTML = "";
    ["ministry", "vision", "stamp"].forEach(function (slot) {
      var meta = (data.files || {})[slot];
      var box = document.createElement("p");
      box.className = "aj-card-meta";
      if (!meta) {
        box.textContent = slot + ": لا ملف";
        host.appendChild(box);
        return;
      }
      box.textContent = slot + ": " + (meta.original_name || "") + (meta.displayable ? "" : " (تالف)");
      host.appendChild(box);
      if (meta.displayable && meta.file_url) {
        fetch(meta.file_url, { headers: authHeaders() }).then(function (response) {
          return response.ok ? response.blob() : null;
        }).then(function (blob) {
          if (!blob || blob.size < 500) {
            return;
          }
          var img = document.createElement("img");
          img.className = "aj-letter-thumb";
          img.alt = "";
          img.src = URL.createObjectURL(blob);
          host.appendChild(img);
        }).catch(function () {});
      }
    });
  }

  function loadLetterhead() {
    jsonFetch("/api/session/letterhead", { headers: authHeaders(), cache: "no-store" })
      .then(renderLetterhead)
      .catch(function (error) {
        setStatus("aj-letter-status", error.message, true);
      });
  }

  function saveLetterhead(event) {
    event.preventDefault();
    var noteReq = jsonFetch("/api/session/letterhead", {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({ stamp_note: document.getElementById("aj-letter-note").value })
    });
    var uploads = [];
    [["ministry", "aj-letter-ministry"], ["vision", "aj-letter-vision"], ["stamp", "aj-letter-stamp"]].forEach(function (pair) {
      var input = document.getElementById(pair[1]);
      var file = input && input.files && input.files[0];
      if (!file) {
        return;
      }
      var body = new FormData();
      body.append("slot", pair[0]);
      body.append("upload", file);
      uploads.push(fetch("/api/session/letterhead/file", {
        method: "POST",
        headers: authHeaders(),
        body: body
      }).then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiError(payload, "تعذر رفع الصورة."));
          }
          return payload;
        });
      }));
    });
    Promise.all([noteReq].concat(uploads)).then(function (results) {
      renderLetterhead(results[results.length - 1] || results[0]);
      toast("حُفظت الترويسة.", "success");
    }).catch(function (error) {
      toast(error.message, "error");
    });
  }

  function loadBackups() {
    jsonFetch("/api/backups", { headers: authHeaders(), cache: "no-store" })
      .then(function (body) {
        var list = document.getElementById("aj-backup-list");
        list.innerHTML = "";
        (body.backups || []).forEach(function (item) {
          var li = document.createElement("li");
          li.className = "aj-card";
          var title = document.createElement("p");
          title.textContent = item.name;
          var meta = document.createElement("p");
          meta.className = "aj-card-meta";
          meta.textContent = (item.modified || "") + " — " + item.bytes + " بايت";
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "aj-detail-btn";
          btn.textContent = "تنزيل";
          btn.addEventListener("click", function () {
            fetch("/api/session/backups/" + encodeURIComponent(item.name) + "/file", { headers: authHeaders() })
              .then(function (response) {
                if (!response.ok) {
                  throw new Error("تعذر التنزيل.");
                }
                return response.blob();
              })
              .then(function (blob) {
                var url = URL.createObjectURL(blob);
                var link = document.createElement("a");
                link.href = url;
                link.download = item.name;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
              })
              .catch(function (error) {
                toast(error.message, "error");
              });
          });
          li.appendChild(title);
          li.appendChild(meta);
          li.appendChild(btn);
          list.appendChild(li);
        });
      })
      .catch(function (error) {
        setStatus("aj-backup-status", error.message, true);
      });
  }

  function createBackup() {
    jsonFetch("/api/backups", { method: "POST", headers: authHeaders() })
      .then(function () {
        toast("أُنشئت النسخة.", "success");
        loadBackups();
      })
      .catch(function (error) {
        toast(error.message, "error");
      });
  }

  function saveNoor(event) {
    event.preventDefault();
    var file = document.getElementById("aj-noor-file").files[0];
    if (!file) {
      toast("اختر ملفًا.", "error");
      return;
    }
    var body = new FormData();
    body.append("kind", document.getElementById("aj-noor-kind").value);
    body.append("file", file);
    fetch("/api/noor/import", { method: "POST", headers: authHeaders(), body: body })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiError(payload, "تعذر الاستيراد."));
          }
          return payload;
        });
      })
      .then(function (payload) {
        setStatus("aj-noor-status", payload.summary || "اكتمل الاستيراد.", false);
        toast("اكتمل الاستيراد.", "success");
      })
      .catch(function (error) {
        setStatus("aj-noor-status", error.message, true);
        toast(error.message, "error");
      });
  }

  function loadAccounts() {
    jsonFetch("/api/session/accounts", { headers: authHeaders(), cache: "no-store" })
      .then(function (body) {
        var list = document.getElementById("aj-accounts-list");
        list.innerHTML = "";
        (body.items || []).forEach(function (item) {
          var li = document.createElement("li");
          li.className = "aj-card";
          var title = document.createElement("p");
          title.textContent = (item.name || "") + " — " + item.national_id;
          var meta = document.createElement("p");
          meta.className = "aj-card-meta";
          meta.textContent = (item.role || "") + (item.has_password ? " · كلمة مرور محفوظة" : " · بلا كلمة مرور") + (item.is_active ? " · نشط" : " · موقف");
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "aj-detail-btn";
          btn.textContent = item.is_active ? "إيقاف" : "تفعيل";
          btn.addEventListener("click", function () {
            jsonFetch("/api/session/accounts/active", {
              method: "POST",
              headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
              body: JSON.stringify({ national_id: item.national_id, is_active: !item.is_active })
            }).then(loadAccounts).catch(function (error) {
              toast(error.message, "error");
            });
          });
          var pick = document.createElement("button");
          pick.type = "button";
          pick.className = "aj-detail-btn aj-detail-btn-secondary";
          pick.textContent = "كلمة المرور";
          pick.addEventListener("click", function () {
            document.getElementById("aj-account-id").value = item.national_id;
          });
          li.appendChild(title);
          li.appendChild(meta);
          li.appendChild(btn);
          li.appendChild(pick);
          list.appendChild(li);
        });
      })
      .catch(function (error) {
        setStatus("aj-accounts-status", error.message, true);
      });
  }

  function savePassword(event) {
    event.preventDefault();
    jsonFetch("/api/users/password", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({
        national_id: document.getElementById("aj-account-id").value.trim(),
        password: document.getElementById("aj-account-pass").value
      })
    }).then(function () {
      document.getElementById("aj-account-pass").value = "";
      toast("عُدلت كلمة المرور.", "success");
      loadAccounts();
    }).catch(function (error) {
      toast(error.message, "error");
    });
  }

  function defaultWindows(level) {
    var values = {};
    permWindows.forEach(function (item) {
      values[item.id] = level === "system" || level === "leadership";
    });
    if (level === "teacher") {
      values.teacherRegisters = true;
      values.tasks = true;
      values.deliverables = true;
    }
    return values;
  }

  function paintWindowChecks(values) {
    var host = document.getElementById("aj-perm-windows");
    host.innerHTML = "";
    permWindows.forEach(function (item) {
      var label = document.createElement("label");
      label.className = "aj-checkbox";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("data-window", item.id);
      input.checked = !!(values && values[item.id]);
      var span = document.createElement("span");
      span.textContent = item.label;
      label.appendChild(input);
      label.appendChild(span);
      host.appendChild(label);
    });
  }

  function loadPermissions() {
    Promise.all([
      jsonFetch("/api/noor/staff", { headers: authHeaders(), cache: "no-store" }),
      jsonFetch("/api/session/permissions", { headers: authHeaders(), cache: "no-store" })
    ]).then(function (loaded) {
      var people = loaded[0].people || [];
      permWindows = loaded[1].windows || [];
      var select = document.getElementById("aj-perm-staff");
      select.innerHTML = "";
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "اختر المنسوب";
      select.appendChild(empty);
      people.forEach(function (person) {
        if (!person || !person.id || !person.name) {
          return;
        }
        var option = document.createElement("option");
        option.value = String(person.id);
        option.textContent = person.name;
        select.appendChild(option);
      });
      paintWindowChecks(defaultWindows("guest"));
    }).catch(function (error) {
      setStatus("aj-perm-status", error.message, true);
    });
  }

  function loadPersonPermissions() {
    var identity = document.getElementById("aj-perm-staff").value;
    if (!identity) {
      return;
    }
    jsonFetch("/api/session/permissions?national_id=" + encodeURIComponent(identity), {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (body) {
      var record = body.record;
      var level = record && record.level ? record.level : "guest";
      document.getElementById("aj-perm-level").value = level;
      paintWindowChecks(record && record.windows ? record.windows : defaultWindows(level));
    }).catch(function (error) {
      setStatus("aj-perm-status", error.message, true);
    });
  }

  function savePermissions(event) {
    event.preventDefault();
    var windows = {};
    Array.prototype.forEach.call(document.querySelectorAll("#aj-perm-windows [data-window]"), function (input) {
      windows[input.getAttribute("data-window")] = input.checked;
    });
    jsonFetch("/api/session/permissions", {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({
        national_id: document.getElementById("aj-perm-staff").value,
        level: document.getElementById("aj-perm-level").value,
        windows: windows
      })
    }).then(function () {
      toast("حُفظت الصلاحيات.", "success");
    }).catch(function (error) {
      toast(error.message, "error");
    });
  }

  function bind() {
    var calendarForm = document.getElementById("aj-calendar-form");
    if (calendarForm) {
      calendarForm.addEventListener("submit", saveCalendar);
    }
    var yearAdd = document.getElementById("aj-calendar-year-add");
    if (yearAdd) {
      yearAdd.addEventListener("click", function () {
        var value = document.getElementById("aj-calendar-year-new").value.trim();
        if (!value) {
          return;
        }
        var select = document.getElementById("aj-calendar-year");
        var option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
        select.value = value;
      });
    }
    var yearDel = document.getElementById("aj-calendar-year-del");
    if (yearDel) {
      yearDel.addEventListener("click", function () {
        var select = document.getElementById("aj-calendar-year");
        if (select.selectedIndex >= 0 && select.options.length > 1) {
          select.remove(select.selectedIndex);
        }
      });
    }
    var fill = document.getElementById("aj-calendar-fill");
    if (fill) {
      fill.addEventListener("click", fillOfficialDates);
    }
    var yearSel = document.getElementById("aj-calendar-year");
    if (yearSel) {
      yearSel.addEventListener("change", loadStations);
    }
    var regionSel = document.getElementById("aj-calendar-region");
    if (regionSel) {
      regionSel.addEventListener("change", loadStations);
    }
    var occForm = document.getElementById("aj-occasion-form");
    if (occForm) {
      occForm.addEventListener("submit", saveOccasion);
    }
    var occReset = document.getElementById("aj-occ-reset");
    if (occReset) {
      occReset.addEventListener("click", function () {
        document.getElementById("aj-occasion-form").reset();
        document.getElementById("aj-occ-id").value = "";
      });
    }
    var letterForm = document.getElementById("aj-letter-form");
    if (letterForm) {
      letterForm.addEventListener("submit", saveLetterhead);
    }
    var backupBtn = document.getElementById("aj-backup-create");
    if (backupBtn) {
      backupBtn.addEventListener("click", createBackup);
    }
    var noorForm = document.getElementById("aj-noor-form");
    if (noorForm) {
      noorForm.addEventListener("submit", saveNoor);
    }
    document.querySelectorAll(".password-masked").forEach(function (input) {
      input.setAttribute("type", "text");
      input.setAttribute("name", "access-key");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("autocorrect", "off");
      input.setAttribute("autocapitalize", "off");
      input.setAttribute("spellcheck", "false");
      input.style.setProperty("-webkit-text-security", "disc");
      input.style.setProperty("text-security", "disc");
      function unlock() {
        input.readOnly = false;
      }
      input.addEventListener("focus", unlock);
      input.addEventListener("pointerdown", unlock);
      if (window.MutationObserver) {
        var guard = new MutationObserver(function () {
          if (input.getAttribute("type") !== "text") {
            input.setAttribute("type", "text");
          }
        });
        guard.observe(input, { attributes: true, attributeFilter: ["type"] });
      }
    });
    var passForm = document.getElementById("aj-account-pass-form");
    if (passForm) {
      passForm.setAttribute("autocomplete", "off");
      passForm.addEventListener("submit", savePassword);
    }
    var permForm = document.getElementById("aj-perm-form");
    if (permForm) {
      permForm.addEventListener("submit", savePermissions);
    }
    var permStaff = document.getElementById("aj-perm-staff");
    if (permStaff) {
      permStaff.addEventListener("change", loadPersonPermissions);
    }
    var permLevel = document.getElementById("aj-perm-level");
    if (permLevel) {
      permLevel.addEventListener("change", function () {
        paintWindowChecks(defaultWindows(permLevel.value));
      });
    }
  }

  window.AJPlanning = {
    load: function (viewId) {
      if (viewId === "view-calendar") {
        loadCalendar();
        return true;
      }
      if (viewId === "view-occasions") {
        loadOccasions();
        return true;
      }
      if (viewId === "view-letterhead") {
        loadLetterhead();
        return true;
      }
      if (viewId === "view-backup") {
        loadBackups();
        return true;
      }
      if (viewId === "view-noor-import") {
        return true;
      }
      if (viewId === "view-accounts") {
        loadAccounts();
        return true;
      }
      if (viewId === "view-permissions") {
        loadPermissions();
        return true;
      }
      return false;
    }
  };

  bind();
})();
