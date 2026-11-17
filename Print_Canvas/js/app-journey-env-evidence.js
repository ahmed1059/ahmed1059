/* شواهد البيئة المدرسية — تواريخ الخطة 1448–1449 ومواضع صور فارغة */
(function () {
  "use strict";

  var SESSION_KEY = "sessionUser";
  var cache = null;
  var attachBusy = false;
  var MAX_SOURCE_BYTES = 12 * 1024 * 1024;
  var MAX_READY_BYTES = 5 * 1024 * 1024;

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

  function toast(message, kind) {
    var node = document.getElementById("aj-toast");
    if (!node) {
      return;
    }
    node.hidden = false;
    node.className = "aj-toast" + (kind ? " is-" + kind : "");
    node.textContent = message || "";
    window.setTimeout(function () {
      node.hidden = true;
    }, 2400);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function dateLine(item) {
    return item && item.date && item.date.line ? item.date.line : "";
  }

  function closeLine(item) {
    return item && item.close_date && item.close_date.line ? item.close_date.line : "";
  }

  function personName(person) {
    return person && person.name ? String(person.name) : "";
  }

  function personId(person) {
    return person && person.id ? String(person.id).replace(/\D+/g, "") : "";
  }

  function pickSignature(signatures, id) {
    var raw = String(id || "").trim();
    var key = personId({ id: id });
    if (!signatures) {
      return "";
    }
    return signatures[raw] || (key ? signatures[key] : "") || "";
  }

  function samePerson(left, right) {
    var a = personId(left);
    var b = personId(right);
    return !!(a && b && a === b);
  }

  function fieldOrder(item) {
    return (item && item.field_order) || Object.keys((item && item.fields) || {});
  }

  function studentsTableHtml(item) {
    var rows = (item && item.students) || [];
    if (!rows.length) {
      return "";
    }
    var body = rows.map(function (row, index) {
      return "<tr><td>" + (index + 1) + "</td><td>" + escapeHtml(row.name) + "</td><td>"
        + escapeHtml(row.grade) + "</td><td>" + escapeHtml(row.section) + "</td></tr>";
    }).join("");
    return "<div class=\"tpl-table-wrap\"><table class=\"tpl-data-table aj-env-students-table\">"
      + "<thead><tr><th>م</th><th>الاسم</th><th>الصف</th><th>الفصل</th></tr></thead>"
      + "<tbody>" + body + "</tbody></table></div>";
  }

  function readCard(card) {
    if (!card) {
      return { narrative: "", fields: {} };
    }
    var narrativeEl = card.querySelector("[data-env-narrative]");
    var fields = {};
    Array.prototype.forEach.call(card.querySelectorAll("[data-env-field]"), function (node) {
      fields[node.getAttribute("data-env-field")] = node.value || "";
    });
    return {
      narrative: narrativeEl ? narrativeEl.value : "",
      fields: fields
    };
  }

  function fetchSignatures(ids) {
    var unique = [];
    (ids || []).forEach(function (id) {
      var text = String(id || "").replace(/\D+/g, "");
      if (text && unique.indexOf(text) < 0) {
        unique.push(text);
      }
    });
    if (!unique.length) {
      return Promise.resolve({});
    }
    return fetch(
      "/api/session/signatures?ids=" + encodeURIComponent(unique.join(",")),
      { headers: authHeaders(), cache: "no-store" }
    ).then(function (response) {
      return response.json().then(function (payload) {
        return response.ok ? (payload.signatures || payload || {}) : {};
      });
    }).catch(function () {
      return {};
    });
  }

  function hydratePhotos(item) {
    var entityType = (item && item.entity_type) || "register";
    var entityKey = item && item.entity_key ? item.entity_key : "";
    return fetch(
      "/api/session/visual-evidence?entity_type=" + encodeURIComponent(entityType) + "&entity_key=" + encodeURIComponent(entityKey),
      { headers: authHeaders(), cache: "no-store" }
    ).then(function (response) {
      return response.json().then(function (payload) {
        var items = (payload && payload.items) || [];
        return Promise.all(items.map(function (item) {
          var copy = Object.assign({}, item);
          if (!copy.id || copy.kind === "link") {
            return copy;
          }
          if (!copy.id || Number(copy.id) < 1) {
            return copy;
          }
          var headers = authHeaders();
          delete headers["Content-Type"];
          return fetch("/api/session/evidence/" + encodeURIComponent(String(copy.id)) + "/file", {
            headers: headers,
            cache: "no-store"
          }).then(function (fileResponse) {
            if (!fileResponse.ok) {
              return copy;
            }
            return fileResponse.blob().then(function (blob) {
              if (!blob || blob.size < 500) {
                return copy;
              }
              var mime = copy.kind === "pdf"
                ? "application/pdf"
                : (blob.type && blob.type.indexOf("image/") === 0 ? blob.type : "image/jpeg");
              copy.url = URL.createObjectURL(new Blob([blob], { type: mime }));
              return copy;
            });
          }).catch(function () {
            return copy;
          });
        }));
      });
    }).catch(function () {
      return [];
    });
  }

  function isSafetyItem(item) {
    var core = window.IdentityCore;
    if (!core || typeof core.isSafetyProgram !== "function") {
      return false;
    }
    return core.isSafetyProgram(item.title || item.program_name, {
      code: item.code,
      domain: item.domain,
      title: item.title
    });
  }

  function signoffColumns(item, signatures) {
    signatures = signatures || {};
    function column(role, person) {
      var id = personId(person);
      return {
        role: role,
        roleTitle: role,
        name: personName(person),
        signature: pickSignature(signatures, id)
      };
    }
    if (isSafetyItem(item)) {
      var columns = [];
      if (personId(item.owner)) {
        columns.push(column("مشرف الأمن والسلامة", item.owner));
      }
      if (personId(item.manager) && !samePerson(item.manager, item.owner)) {
        columns.push(column("مدير المدرسة", item.manager));
      }
      return columns;
    }
    var firstRole = (item.kind || "") === "program"
      ? "منفّذ البرنامج"
      : (item.owner_role || "وكيل الشؤون المدرسية");
    var midRole = "وكيل الشؤون التعليمية";
    var midPerson = item.education;
    if (samePerson(item.owner, midPerson) || samePerson(midPerson, item.manager)) {
      if (item.affairs && !samePerson(item.owner, item.affairs) && !samePerson(item.manager, item.affairs)) {
        midRole = "وكيل الشؤون المدرسية";
        midPerson = item.affairs;
      } else {
        midPerson = { id: "", name: "" };
      }
    }
    var columns = [column(firstRole, item.owner)];
    if (personId(midPerson)) {
      columns.push(column(midRole, midPerson));
    }
    if (personId(item.manager)) {
      columns.push(column("مدير المدرسة", item.manager));
    }
    return columns;
  }

  function refreshItemSeats(item) {
    return fetch("/api/session/env-evidence", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (payload) {
          return response.ok ? payload : null;
        });
      })
      .then(function (payload) {
        var found = null;
        ((payload && payload.items) || []).forEach(function (row) {
          if (row && row.entity_key === item.entity_key) {
            found = row;
          }
        });
        if (!found) {
          return item;
        }
        return Object.assign({}, item, {
          owner: found.owner,
          education: found.education,
          manager: found.manager,
          affairs: found.affairs,
          owner_role: found.owner_role || item.owner_role
        });
      })
      .catch(function () {
        return item;
      });
  }

  function printItem(item, draft, onlyPhoto) {
    if (!window.PrintTemplates || typeof window.PrintTemplates.renderPortraitOfficial !== "function") {
      toast("نموذج الطباعة غير محمّل.", "error");
      return;
    }
    draft = draft || { narrative: item.narrative || "", fields: item.fields || {} };
    refreshItemSeats(item).then(function (fresh) {
      item = fresh;
      var core = window.IdentityCore;
      if (isSafetyItem(item) && core && typeof core.getActiveSeat === "function") {
        return core.getActiveSeat("safety_supervisor").then(function (seat) {
          if (seat && seat.id) {
            item.owner = { id: seat.id, name: seat.name };
            item.owner_role = "مشرف الأمن والسلامة";
          }
          return item;
        });
      }
      return item;
    }).then(function (fresh) {
      item = fresh;
      return Promise.all([
      hydratePhotos(item),
      fetchSignatures([
        personId(item.owner),
        personId(item.education),
        personId(item.manager),
        personId(item.affairs)
      ])
    ]);
    }).then(function (parts) {
      var photos = (parts[0] || []).filter(function (photo) {
        return photo && photo.url;
      });
      if (onlyPhoto && onlyPhoto.url) {
        photos = [{
          url: onlyPhoto.url,
          kind: onlyPhoto.kind || "image",
          name: onlyPhoto.name || ""
        }];
      }
      var bandPhotos = onlyPhoto
        ? photos.filter(function (photo) {
          return String(photo.kind || "") !== "pdf";
        })
        : photos;
      var fieldHtml = fieldOrder(item).filter(function (label) {
        return label !== "ملاحظة التوثيق" && label !== "ضابط الخصوصية";
      }).map(function (label) {
        var value = (draft.fields && draft.fields[label]) || "";
        return "<p class=\"tpl-p\"><strong>" + escapeHtml(label) + ":</strong> " + escapeHtml(value) + "</p>";
      }).join("");
      var sections = [
        { title: "التقرير الفني التربوي", text: draft.narrative || "", maxLines: 8 },
        { title: "بنود السجل", html: fieldHtml }
      ];
      var tableHtml = studentsTableHtml(item);
      if (tableHtml) {
        sections.push({ title: item.students_title || "الأسماء المعتمدة", html: tableHtml });
      }
      if (item.code === "4-2-1-2") {
        sections.unshift({
          title: "الطلب والإغلاق",
          html: "<p class=\"tpl-p\">تاريخ الطلب: " + escapeHtml(dateLine(item)) + "</p>"
            + "<p class=\"tpl-p\">تاريخ الإغلاق: " + escapeHtml(closeLine(item)) + "</p>"
        });
      }
      var html = window.PrintTemplates.renderPortraitOfficial({
        title: item.title,
        pairedMeta: [
          { label: "المؤشر", value: (window.PrintTemplates && typeof window.PrintTemplates.cleanIndicatorText === "function"
            ? window.PrintTemplates.cleanIndicatorText(item.code, item.indicator_text || "")
            : (item.indicator_text || item.code)) },
          { label: "المجال", value: item.domain || "البيئة المدرسية" },
          { label: "العام الدراسي", value: item.year || "1448-1449" },
          { label: "صاحب السجل", value: (isSafetyItem(item) ? "مشرف الأمن والسلامة" : item.owner_role)
            + (personName(item.owner) ? " · " + personName(item.owner) : "") },
          { label: item.date_label || "التاريخ", value: dateLine(item) },
          { label: item.close_label || "", value: closeLine(item) }
        ].filter(function (row) {
          return row.label && row.value;
        }),
        sections: sections,
        evidenceItems: [],
        evidenceOptions: { emptySlot: false },
        signoff: true,
        signoffColumns: signoffColumns(item, parts[1])
      });
      html = String(html).replace(
        /<section class="tpl-section">\s*<h2 class="tpl-section-title">الشواهد المصورة والمرفقات<\/h2>[\s\S]*?<\/section>/,
        ""
      );
      if (window.AJPrint && typeof window.AJPrint.injectPhotoBand === "function") {
        html = window.AJPrint.injectPhotoBand(
          html,
          bandPhotos.slice(0, 4).map(function (photo) {
            return { dataUrl: photo.url, caption: "" };
          }),
          "الشواهد المصورة"
        );
      }
      if (window.AJPrint && typeof window.AJPrint.show === "function") {
        window.AJPrint.show(html, {
          pdfTitle: item.title,
          arm: tableHtml ? { multiPage: true } : {},
          files: photos.filter(function (photo) {
            return String((photo && photo.kind) || "") === "pdf";
          })
        });
        return;
      }
      window.PrintTemplates.openHtml(html);
    }).catch(function () {
      toast("تعذر تجهيز السجل.", "error");
    });
  }

  function setSpin(on, text) {
    var node = document.getElementById("aj-upload-spin");
    if (!node) {
      return;
    }
    node.hidden = !on;
    if (text) {
      node.textContent = text;
    }
  }

  function preparePhoto(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("اختر صورة."));
        return;
      }
      var name = String(file.name || "").toLowerCase();
      var type = String(file.type || "").toLowerCase();
      if (file.size > MAX_SOURCE_BYTES) {
        reject(new Error("الملف أكبر من 12 ميغابايت."));
        return;
      }
      if (/\.(heic|heif|tif|tiff)$/.test(name) || type.indexOf("heic") >= 0 || type.indexOf("heif") >= 0) {
        reject(new Error("صيغة HEIC غير مدعومة. احفظ الصورة JPG أو PNG ثم أرفقها."));
        return;
      }
      if (type.indexOf("video/") === 0) {
        reject(new Error("هذا الزر للصور فقط."));
        return;
      }
      if (type === "application/pdf" || /\.pdf$/.test(name)) {
        if (file.size > 8 * 1024 * 1024) {
          reject(new Error("ملف PDF أكبر من 8 ميغابايت."));
          return;
        }
        resolve(file);
        return;
      }
      if (type && type.indexOf("image/") !== 0 && !/\.(jpe?g|png|webp|gif)$/.test(name)) {
        reject(new Error("أرفق صورة JPG أو PNG."));
        return;
      }
      var url = URL.createObjectURL(file);
      var done = false;
      var timer = window.setTimeout(function () {
        finish(new Error("انتهت مهلة قراءة الصورة."));
      }, 20000);
      function finish(error, value) {
        if (done) {
          return;
        }
        done = true;
        window.clearTimeout(timer);
        URL.revokeObjectURL(url);
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      }
      var img = new Image();
      img.onload = function () {
        window.requestAnimationFrame(function () {
          try {
            var max = 1200;
            var width = img.width || max;
            var height = img.height || max;
            if (width > max || height > max) {
              if (width >= height) {
                height = Math.round(height * max / width);
                width = max;
              } else {
                width = Math.round(width * max / height);
                height = max;
              }
            }
            var canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext("2d");
            if (!ctx) {
              finish(new Error("تعذر ضغط الصورة."));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(function (blob) {
              if (!blob) {
                finish(new Error("تعذر ضغط الصورة."));
                return;
              }
              if (blob.size > MAX_READY_BYTES) {
                finish(new Error("الصورة أكبر من 5 ميغابايت بعد الضغط."));
                return;
              }
              var base = String(file.name || "photo").replace(/\.[^.]+$/, "");
              finish(null, new File([blob], base + ".jpg", { type: "image/jpeg" }));
            }, "image/jpeg", 0.8);
          } catch (error) {
            finish(error || new Error("تعذر ضغط الصورة."));
          }
        });
      };
      img.onerror = function () {
        finish(new Error("تعذر قراءة الصورة."));
      };
      img.src = url;
    });
  }

  function attachItem(item) {
    if (attachBusy) {
      toast("رفع سابق ما زال جارياً.", "error");
      return;
    }
    var input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.pdf";
    input.addEventListener("change", function () {
      var files = Array.prototype.slice.call(input.files || []);
      input.value = "";
      if (!files.length) {
        return;
      }
      var remain = Math.max(0, 5 - Number(item.photo_count || 0));
      if (!remain) {
        toast("الحد الأقصى خمس صور لهذا السجل.", "error");
        return;
      }
      if (files.length > remain) {
        files = files.slice(0, remain);
      }
      attachBusy = true;
      setSpin(true, "جارٍ تجهيز الصور ورفعها...");
      var ok = 0;
      var chain = Promise.resolve();
      files.forEach(function (file, index) {
        chain = chain.then(function () {
          setSpin(true, "رفع الصورة " + (index + 1) + " من " + files.length + "...");
          return preparePhoto(file).then(function (ready) {
            var body = new FormData();
            body.append("entity_type", item.entity_type || "register");
            body.append("entity_key", item.entity_key);
            body.append("register_key", item.register_key || "environment-1448");
            body.append("files", ready, ready.name || "evidence.jpg");
            var headers = authHeaders();
            return fetch("/api/visual-evidence", {
              method: "POST",
              headers: headers,
              body: body
            }).then(function (response) {
              return response.json().then(function (payload) {
                if (!response.ok) {
                  throw new Error((payload && payload.detail) || "تعذر إرفاق الصورة.");
                }
                ok += 1;
                return payload;
              });
            });
          });
        });
      });
      chain.then(function () {
        toast(ok ? ("أُرفقت " + ok + " صور.") : "لم تُرفق صور.", ok ? "success" : "error");
        return load();
      }).catch(function (error) {
        toast((error && error.message) || "تعذر إرفاق الصورة.", "error");
        if (ok) {
          return load();
        }
      }).finally(function () {
        attachBusy = false;
        setSpin(false);
      });
    });
    input.click();
  }

  function listPhotoMeta(item) {
    return fetch(
      "/api/session/visual-evidence?entity_type="
        + encodeURIComponent(item.entity_type || "register")
        + "&entity_key="
        + encodeURIComponent(item.entity_key || ""),
      { headers: authHeaders(), cache: "no-store" }
    ).then(function (response) {
      return response.json().then(function (payload) {
        return ((payload && payload.items) || []).filter(function (row) {
          return row && Number(row.id) > 0;
        });
      });
    }).catch(function () {
      return [];
    });
  }

  function deletePhoto(item, photoId) {
    if (!photoId || !window.confirm("حذف هذه الصورة؟")) {
      return;
    }
    fetch("/api/visual-evidence/delete", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({ id: photoId })
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error((payload && payload.detail) || "تعذر الحذف.");
        }
        return payload;
      });
    }).then(function () {
      toast("حُذفت الصورة.", "success");
      return load();
    }).catch(function (error) {
      toast((error && error.message) || "تعذر الحذف.", "error");
    });
  }

  function replacePhoto(item, photoId) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) {
        return;
      }
      attachBusy = true;
      setSpin(true, "جارٍ استبدال الصورة...");
      fetch("/api/visual-evidence/delete", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
        body: JSON.stringify({ id: photoId })
      }).then(function (response) {
        if (!response.ok) {
          throw new Error("تعذر حذف الصورة السابقة.");
        }
        return preparePhoto(file);
      }).then(function (ready) {
        var body = new FormData();
        body.append("entity_type", item.entity_type || "register");
        body.append("entity_key", item.entity_key);
        body.append("register_key", item.register_key || "environment-1448");
        body.append("files", ready, ready.name || "evidence.jpg");
        return fetch("/api/visual-evidence", {
          method: "POST",
          headers: authHeaders(),
          body: body
        }).then(function (response) {
          return response.json().then(function (payload) {
            if (!response.ok) {
              throw new Error((payload && payload.detail) || "تعذر رفع الصورة البديلة.");
            }
            return payload;
          });
        });
      }).then(function () {
        toast("استُبدلت الصورة.", "success");
        return load();
      }).catch(function (error) {
        toast((error && error.message) || "تعذر الاستبدال.", "error");
        return load();
      }).finally(function () {
        attachBusy = false;
        setSpin(false);
      });
    });
    input.click();
  }

  function mountPhotoList(host, item) {
    if (!host || !item || !item.photo_count) {
      return;
    }
    listPhotoMeta(item).then(function (photos) {
      host.innerHTML = "";
      photos.forEach(function (photo) {
        var chip = document.createElement("div");
        chip.className = "aj-env-photo-chip";
        var name = document.createElement("p");
        name.className = "aj-card-meta";
        name.textContent = photo.name || ("صورة " + photo.id);
        var row = document.createElement("div");
        row.className = "aj-task-actions";
        var replaceBtn = document.createElement("button");
        replaceBtn.type = "button";
        replaceBtn.className = "aj-detail-btn aj-detail-btn-secondary";
        replaceBtn.textContent = "استبدال";
        replaceBtn.addEventListener("click", function () {
          replacePhoto(item, photo.id);
        });
        if (photo.can_delete) {
          row.appendChild(replaceBtn);
          var delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "aj-council-delete";
          delBtn.textContent = "حذف";
          delBtn.addEventListener("click", function () {
            deletePhoto(item, photo.id);
          });
          row.appendChild(delBtn);
        }
        chip.appendChild(name);
        chip.appendChild(row);
        host.appendChild(chip);
      });
    });
  }

  function saveItem(item, card, reset) {
    var draft = reset
      ? { narrative: item.trial_narrative || "", fields: item.trial_fields || {} }
      : readCard(card);
    return fetch("/api/session/env-evidence/" + encodeURIComponent(item.entity_key), {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({
        narrative: draft.narrative,
        fields: draft.fields,
        reset: !!reset
      })
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error((payload && payload.detail) || "تعذر الحفظ.");
        }
        return payload;
      });
    }).then(function () {
      toast(reset ? "أُعيد النص المعتمد." : "حُفظت الصياغة.", "success");
      return load();
    }).catch(function (error) {
      toast((error && error.message) || "تعذر الحفظ.", "error");
    });
  }

  function renderCard(item) {
    var li = document.createElement("li");
    li.className = "aj-card aj-env-card";
    li.setAttribute("data-env-group", item.group || "");
    var heading = document.createElement("h2");
    heading.className = "aj-group-title";
    heading.textContent = (item.code ? item.code + " · " : "") + item.title;
    var meta = document.createElement("p");
    meta.className = "aj-card-meta";
    var bits = [
      (item.owner_role || "") + (personName(item.owner) ? " · " + personName(item.owner) : ""),
      (item.date_label || "التاريخ") + ": " + dateLine(item)
    ];
    if (closeLine(item)) {
      bits.push((item.close_label || "الإغلاق") + ": " + closeLine(item));
    }
    bits.push(item.photo_count ? ("صور مرفقة: " + item.photo_count) : "شاهد نصي معتمد — متاح إرفاق الصور");
    bits.push(item.is_saved ? "الصياغة معتمدة" : "الصياغة جاهزة للاعتماد");
    meta.textContent = bits.join(" — ");
    var body = document.createElement("div");
    if (item.indicator_text) {
      var indicator = document.createElement("p");
      indicator.className = "aj-env-gaps";
      indicator.textContent = "المؤشر: " + item.indicator_text;
      body.appendChild(indicator);
    }
    var form = document.createElement("form");
    form.className = "aj-form aj-env-form";
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      saveItem(item, li, false);
    });
    var narrativeWrap = document.createElement("div");
    narrativeWrap.className = "aj-field";
    var narrativeLabel = document.createElement("label");
    narrativeLabel.textContent = "التقرير الفني التربوي";
    var narrative = document.createElement("textarea");
    narrative.setAttribute("data-env-narrative", "1");
    narrative.rows = 5;
    narrative.value = item.narrative || "";
    narrativeWrap.appendChild(narrativeLabel);
    narrativeWrap.appendChild(narrative);
    form.appendChild(narrativeWrap);
    fieldOrder(item).forEach(function (label) {
      var wrap = document.createElement("div");
      wrap.className = "aj-field";
      var fieldLabel = document.createElement("label");
      fieldLabel.textContent = label;
      var area = document.createElement("textarea");
      area.setAttribute("data-env-field", label);
      area.rows = 3;
      area.value = (item.fields && item.fields[label]) || "";
      wrap.appendChild(fieldLabel);
      wrap.appendChild(area);
      form.appendChild(wrap);
    });
    var actions = document.createElement("div");
    actions.className = "aj-detail-actions";
    var saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "aj-detail-btn";
    saveBtn.textContent = "حفظ";
    var printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.className = "aj-detail-btn";
    printBtn.textContent = "معاينة السجل";
    printBtn.addEventListener("click", function () {
      printItem(item, readCard(li));
    });
    var attachBtn = document.createElement("button");
    attachBtn.type = "button";
    attachBtn.className = "aj-detail-btn aj-detail-btn-secondary";
    attachBtn.textContent = "إرفاق صور";
    attachBtn.addEventListener("click", function () {
      attachItem(item);
    });
    var resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "aj-detail-btn aj-detail-btn-secondary";
    resetBtn.textContent = "إعادة النص المعتمد";
    resetBtn.addEventListener("click", function () {
      saveItem(item, li, true);
    });
    actions.appendChild(saveBtn);
    actions.appendChild(printBtn);
    actions.appendChild(attachBtn);
    actions.appendChild(resetBtn);
    form.appendChild(actions);
    var photoHost = document.createElement("div");
    photoHost.className = "aj-env-photo-host";
    form.appendChild(photoHost);
    mountPhotoList(photoHost, item);
    body.appendChild(form);
    var tableHtml = studentsTableHtml(item);
    if (tableHtml) {
      var tableTitle = document.createElement("h3");
      tableTitle.className = "aj-group-title";
      tableTitle.textContent = item.students_title || "الأسماء المعتمدة";
      var tableWrap = document.createElement("div");
      tableWrap.className = "aj-env-students-wrap";
      tableWrap.innerHTML = tableHtml;
      body.appendChild(tableTitle);
      body.appendChild(tableWrap);
    } else if (item.entity_key === "eq-2111-4" || item.entity_key === "eq-2111-6") {
      var missing = document.createElement("p");
      missing.className = "aj-env-gaps";
      missing.textContent = "تُستكمل الأسماء بعد اعتماد القائمة، بما يراعي الفروق الفردية.";
      body.appendChild(missing);
    }
    if (item.open) {
      li.appendChild(heading);
      li.appendChild(meta);
      li.appendChild(body);
    } else {
      var details = document.createElement("details");
      var summary = document.createElement("summary");
      summary.appendChild(heading);
      details.appendChild(summary);
      details.appendChild(meta);
      details.appendChild(body);
      li.appendChild(details);
    }
    return li;
  }

  function applyFilter(group) {
    var selected = String(group || "").trim();
    Array.prototype.forEach.call(document.querySelectorAll("#aj-env-cards [data-env-group]"), function (card) {
      var value = card.getAttribute("data-env-group") || "";
      var hide = !!(selected && value !== selected);
      card.hidden = hide;
      if (hide) {
        card.classList.add("is-filtered-out");
      } else {
        card.classList.remove("is-filtered-out");
      }
    });
  }

  function render(items) {
    var list = document.getElementById("aj-env-cards");
    var filter = document.getElementById("aj-env-filter");
    if (!list) {
      return;
    }
    list.innerHTML = "";
    var groups = [];
    (items || []).forEach(function (item) {
      var name = item.group || "أخرى";
      if (groups.indexOf(name) < 0) {
        groups.push(name);
      }
    });
    if (filter) {
      var current = filter.value || "";
      filter.innerHTML = "";
      var all = document.createElement("option");
      all.value = "";
      all.textContent = "كل المجموعات";
      filter.appendChild(all);
      groups.forEach(function (name) {
        var option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        filter.appendChild(option);
      });
      if (current) {
        filter.value = current;
      }
      filter.onchange = function () {
        applyFilter(filter.value);
      };
    }
    groups.forEach(function (name) {
      var head = document.createElement("li");
      head.className = "aj-env-group-head";
      head.setAttribute("data-env-group", name);
      head.textContent = name;
      list.appendChild(head);
      items.forEach(function (item) {
        if ((item.group || "أخرى") === name) {
          list.appendChild(renderCard(item));
        }
      });
    });
    applyFilter(filter ? filter.value : "");
  }

  function load() {
    var status = document.getElementById("aj-env-status");
    if (status) {
      status.textContent = "جارٍ التحميل...";
    }
    return fetch("/api/session/env-evidence", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error((payload && payload.detail) || "تعذر تحميل شواهد البيئة.");
          }
          return payload;
        });
      })
      .then(function (payload) {
        cache = payload;
        render((payload && payload.items) || []);
        if (status) {
          status.textContent = "";
        }
        return payload;
      })
      .catch(function (error) {
        if (status) {
          status.textContent = (error && error.message) || "تعذر التحميل.";
        }
      });
  }

  window.addEventListener("app:evidence:attached", function (event) {
    var detail = event && event.detail ? event.detail : {};
    if (String(detail.entity_type || "") === "register" || String(detail.entity_type || "") === "program") {
      load();
    }
  });

  function printLinked(entityKey, photo) {
    return fetch("/api/session/env-evidence", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error((payload && payload.detail) || "تعذر تحميل السجل.");
          }
          return payload;
        });
      })
      .then(function (payload) {
        var found = null;
        ((payload && payload.items) || []).forEach(function (row) {
          if (row && String(row.entity_key || "") === String(entityKey || "")) {
            found = row;
          }
        });
        if (!found) {
          return false;
        }
        printItem(found, {
          narrative: found.narrative || "",
          fields: found.fields || {}
        }, photo || null);
        return true;
      });
  }

  window.AjEnvEvidence = {
    load: load,
    printLinked: printLinked
  };
}());
