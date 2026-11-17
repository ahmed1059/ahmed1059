/* محرك تعبئة عام: يقرأ مخطط JSON ويبني النموذج ويجمع القيم ويطبع عبر OfficialFrameCore. */
(function (root) {
    "use strict";

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function loadSchema(url) {
        return fetch(url).then(function (response) {
            if (!response.ok) {
                throw new Error("تعذر تحميل مخطط النموذج.");
            }
            return response.json();
        });
    }

    function storageKey(schema) {
        return (schema && schema.storageKey) || ("board1059.form." + (schema && schema.id || "unknown"));
    }

    function readSaved(schema) {
        try {
            return JSON.parse(localStorage.getItem(storageKey(schema)) || "null") || null;
        } catch (error) {
            return null;
        }
    }

    function writeSaved(schema, data) {
        localStorage.setItem(storageKey(schema), JSON.stringify(data || {}));
    }

    function fieldName(field) {
        return "ffe-" + String(field.id || "");
    }

    function renderTextField(field) {
        var value = field.default != null ? field.default : "";
        return "<label class=\"wash-field" + (field.wide ? " wash-span" : "") + "\">"
            + "<span>" + escapeHtml(field.label || "") + (field.required ? " *" : "") + "</span>"
            + "<input name=\"" + escapeHtml(fieldName(field)) + "\" type=\"text\" value=\"" + escapeHtml(value) + "\""
            + (field.placeholder ? " placeholder=\"" + escapeHtml(field.placeholder) + "\"" : "")
            + (field.required ? " required" : "")
            + " autocomplete=\"off\">"
            + (field.hint ? "<small class=\"wash-hint\">" + escapeHtml(field.hint) + "</small>" : "")
            + "</label>";
    }

    function renderSelect(field) {
        var options = ["<option value=\"\"></option>"].concat((field.options || []).map(function (item) {
            var selected = field.default === item ? " selected" : "";
            return "<option value=\"" + escapeHtml(item) + "\"" + selected + ">" + escapeHtml(item) + "</option>";
        }));
        return "<label class=\"wash-field\">"
            + "<span>" + escapeHtml(field.label || "") + "</span>"
            + "<select name=\"" + escapeHtml(fieldName(field)) + "\">" + options.join("") + "</select>"
            + (field.hint ? "<small class=\"wash-hint\">" + escapeHtml(field.hint) + "</small>" : "")
            + "</label>";
    }

    function renderTextarea(field) {
        return "<label class=\"wash-field wash-span\">"
            + "<span>" + escapeHtml(field.label || "") + "</span>"
            + "<textarea name=\"" + escapeHtml(fieldName(field)) + "\" rows=\"" + (field.rows || 4) + "\">"
            + escapeHtml(field.default || "")
            + "</textarea>"
            + (field.hint ? "<small class=\"wash-hint\">" + escapeHtml(field.hint) + "</small>" : "")
            + "</label>";
    }

    function renderDate(field, kind) {
        var cls = kind === "hijri" ? "doc-hijri" : "doc-date-picker";
        return "<label class=\"wash-field\">"
            + "<span>" + escapeHtml(field.label || "") + "</span>"
            + "<input class=\"" + cls + "\" name=\"" + escapeHtml(fieldName(field)) + "\" type=\"text\""
            + " inputmode=\"numeric\" autocomplete=\"off\""
            + (field.placeholder ? " placeholder=\"" + escapeHtml(field.placeholder) + "\"" : "")
            + " data-ffe-pair=\"" + escapeHtml(field.pairWith || "") + "\">"
            + "</label>";
    }

    function renderChecklist(field) {
        var boxes = (field.options || []).map(function (item, index) {
            var id = fieldName(field) + "-" + index;
            return "<label class=\"ffe-check\"><input type=\"checkbox\" name=\"" + escapeHtml(fieldName(field)) + "\" value=\""
                + escapeHtml(item) + "\" id=\"" + escapeHtml(id) + "\"><span>" + escapeHtml(item) + "</span></label>";
        }).join("");
        var custom = field.allowCustom
            ? "<label class=\"wash-field wash-span\"><span>" + escapeHtml(field.customHint || "خيارات إضافية") + "</span>"
                + "<textarea name=\"" + escapeHtml(fieldName(field)) + "-custom\" rows=\"3\" placeholder=\"سطر لكل خيار\"></textarea></label>"
            : "";
        return "<fieldset class=\"ffe-checklist wash-span\" data-ffe-checklist=\"" + escapeHtml(field.id) + "\">"
            + "<legend>" + escapeHtml(field.label || "") + "</legend>"
            + "<div class=\"ffe-check-grid\">" + boxes + "</div>"
            + custom
            + "</fieldset>";
    }

    function renderEvidence(field) {
        return "<div class=\"ffe-evidence wash-span\" data-ffe-evidence=\"" + escapeHtml(field.id) + "\">"
            + "<label class=\"wash-field wash-span\"><span>" + escapeHtml(field.label || "الشواهد") + "</span>"
            + "<input type=\"file\" name=\"" + escapeHtml(fieldName(field)) + "\" accept=\"" + escapeHtml(field.accept || "image/*") + "\" multiple>"
            + "</label>"
            + "<p class=\"wash-hint\">أقصى حد للشواهد " + (field.max || 10) + " شواهد"
            + (field.compressHint ? " — " + escapeHtml(field.compressHint) : "")
            + "</p>"
            + "<div class=\"ffe-evidence-preview\" hidden></div>"
            + "</div>";
    }

    function renderField(field) {
        if (!field || !field.id) {
            return "";
        }
        if (field.type === "select") {
            return renderSelect(field);
        }
        if (field.type === "textarea") {
            return renderTextarea(field);
        }
        if (field.type === "hijri") {
            return renderDate(field, "hijri");
        }
        if (field.type === "gregorian") {
            return renderDate(field, "gregorian");
        }
        if (field.type === "checklist") {
            return renderChecklist(field);
        }
        if (field.type === "evidence") {
            return renderEvidence(field);
        }
        return renderTextField(field);
    }

    function formHtml(schema) {
        var sections = (schema.sections || []).map(function (section) {
            var fields = (section.fields || []).map(renderField).join("");
            return "<section class=\"board-card board-span ffe-section\" data-section=\"" + escapeHtml(section.id || "") + "\">"
                + "<h2>" + escapeHtml(section.label || "") + "</h2>"
                + "<div class=\"council-meta ffe-fields\">" + fields + "</div>"
                + "</section>";
        }).join("");
        return "<form class=\"ffe-form\" id=\"ffe-form-" + escapeHtml(schema.id || "form") + "\" novalidate>"
            + "<h1>" + escapeHtml(schema.title || "نموذج") + "</h1>"
            + (schema.description ? "<p class=\"wash-hint\">" + escapeHtml(schema.description) + "</p>" : "")
            + "<div class=\"board-layout\">" + sections + "</div>"
            + "<div class=\"wash-actions facility-actions ffe-actions\">"
            + "<button class=\"wash-save\" type=\"submit\">حفظ البيانات</button>"
            + "<button class=\"wash-add\" type=\"button\" data-ffe-preview>معاينة</button>"
            + "<button class=\"wash-save\" type=\"button\" data-ffe-print>طباعة</button>"
            + "<button class=\"wash-cancel\" type=\"button\" data-ffe-clear>إفراغ</button>"
            + "<button class=\"wash-back\" type=\"button\">العودة</button>"
            + "</div>"
            + "<p class=\"wash-note\" data-ffe-note></p>"
            + "</form>";
    }

    function checklistValues(root, field) {
        var selected = [];
        Array.prototype.forEach.call(root.querySelectorAll("[name=\"" + fieldName(field) + "\"]:checked"), function (input) {
            selected.push(input.value);
        });
        var custom = root.querySelector("[name=\"" + fieldName(field) + "-custom\"]");
        if (custom && custom.value.trim()) {
            custom.value.split(/\n+/).forEach(function (line) {
                var text = String(line || "").trim();
                if (text && selected.indexOf(text) < 0) {
                    selected.push(text);
                }
            });
        }
        return selected;
    }

    function collect(root, schema) {
        var data = { id: schema.id, title: schema.title, values: {}, evidence: [] };
        (schema.sections || []).forEach(function (section) {
            (section.fields || []).forEach(function (field) {
                if (field.type === "checklist") {
                    data.values[field.id] = checklistValues(root, field);
                    return;
                }
                if (field.type === "evidence") {
                    data.evidence = root._ffeEvidence || [];
                    return;
                }
                var input = root.querySelector("[name=\"" + fieldName(field) + "\"]");
                data.values[field.id] = input ? String(input.value || "").trim() : "";
            });
        });
        return data;
    }

    function apply(root, schema, data) {
        var values = (data && data.values) || {};
        (schema.sections || []).forEach(function (section) {
            (section.fields || []).forEach(function (field) {
                if (field.type === "checklist") {
                    var chosen = values[field.id] || [];
                    Array.prototype.forEach.call(root.querySelectorAll("[name=\"" + fieldName(field) + "\"]"), function (input) {
                        input.checked = chosen.indexOf(input.value) >= 0;
                    });
                    var extras = chosen.filter(function (item) {
                        return (field.options || []).indexOf(item) < 0;
                    });
                    var custom = root.querySelector("[name=\"" + fieldName(field) + "-custom\"]");
                    if (custom) {
                        custom.value = extras.join("\n");
                    }
                    return;
                }
                if (field.type === "evidence") {
                    root._ffeEvidence = (data && data.evidence) || [];
                    paintEvidencePreview(root, field);
                    return;
                }
                var input = root.querySelector("[name=\"" + fieldName(field) + "\"]");
                if (input) {
                    input.value = values[field.id] != null ? values[field.id] : (field.default || "");
                }
            });
        });
        wireDatePairs(root, schema);
    }

    function wireDatePairs(root, schema) {
        (schema.sections || []).forEach(function (section) {
            (section.fields || []).forEach(function (field) {
                if (field.type !== "hijri" && field.type !== "gregorian") {
                    return;
                }
                if (!field.pairWith || typeof root.syncHijriGregorianDates !== "function" && typeof syncHijriGregorianDates !== "function") {
                    return;
                }
                var a = root.querySelector("[name=\"" + fieldName(field) + "\"]");
                var pairField = null;
                (schema.sections || []).forEach(function (sec) {
                    (sec.fields || []).forEach(function (item) {
                        if (item.id === field.pairWith) {
                            pairField = item;
                        }
                    });
                });
                if (!a || !pairField) {
                    return;
                }
                var b = root.querySelector("[name=\"" + fieldName(pairField) + "\"]");
                if (!b) {
                    return;
                }
                var sync = typeof syncHijriGregorianDates === "function" ? syncHijriGregorianDates : root.syncHijriGregorianDates;
                var greg = field.type === "gregorian" ? a : b;
                var hijri = field.type === "hijri" ? a : b;
                sync(greg, hijri);
            });
        });
    }

    function paintEvidencePreview(root, field) {
        var box = root.querySelector("[data-ffe-evidence=\"" + field.id + "\"] .ffe-evidence-preview");
        if (!box) {
            return;
        }
        var list = root._ffeEvidence || [];
        if (!list.length) {
            box.hidden = true;
            box.innerHTML = "";
            return;
        }
        box.hidden = false;
        box.innerHTML = list.map(function (item, index) {
            return "<figure class=\"ffe-evidence-tile\" data-index=\"" + index + "\">"
                + "<img src=\"" + escapeHtml(item.url) + "\" alt=\"\">"
                + "<button type=\"button\" data-ffe-remove-evidence=\"" + index + "\" title=\"حذف\">×</button>"
                + "</figure>";
        }).join("");
    }

    function bindEvidence(root, schema) {
        root._ffeEvidence = root._ffeEvidence || [];
        (schema.sections || []).forEach(function (section) {
            (section.fields || []).forEach(function (field) {
                if (field.type !== "evidence") {
                    return;
                }
                var input = root.querySelector("[name=\"" + fieldName(field) + "\"]");
                var max = field.max || 10;
                if (!input) {
                    return;
                }
                input.addEventListener("change", function () {
                    var files = Array.prototype.slice.call(input.files || [], 0);
                    var chain = Promise.resolve();
                    files.forEach(function (file) {
                        chain = chain.then(function () {
                            if (root._ffeEvidence.length >= max) {
                                return null;
                            }
                            return new Promise(function (resolve) {
                                var reader = new FileReader();
                                reader.onload = function () {
                                    root._ffeEvidence.push({
                                        name: file.name || "شاهد",
                                        url: String(reader.result || ""),
                                        kind: "image"
                                    });
                                    resolve();
                                };
                                reader.onerror = function () { resolve(); };
                                reader.readAsDataURL(file);
                            });
                        });
                    });
                    chain.then(function () {
                        input.value = "";
                        paintEvidencePreview(root, field);
                    });
                });
                root.addEventListener("click", function (event) {
                    var btn = event.target.closest("[data-ffe-remove-evidence]");
                    if (!btn) {
                        return;
                    }
                    var index = Number(btn.getAttribute("data-ffe-remove-evidence") || -1);
                    if (index < 0) {
                        return;
                    }
                    root._ffeEvidence.splice(index, 1);
                    paintEvidencePreview(root, field);
                });
            });
        });
    }

    function listHtml(items) {
        if (!items || !items.length) {
            return "<p class=\"tpl-empty\">—</p>";
        }
        return "<ul class=\"tpl-list\">" + items.map(function (item) {
            return "<li>" + escapeHtml(item) + "</li>";
        }).join("") + "</ul>";
    }

    function buildPrintPayload(schema, data) {
        var values = (data && data.values) || {};
        var title = values.report_title || schema.print && schema.print.title || schema.title || "";
        return {
            title: title,
            frameClass: (schema.print && schema.print.frameClass) || "tpl-portrait-official tpl-remedial-plan",
            pairedMeta: [
                { label: "الصف / الفصل", value: values.grade_class || "" },
                { label: "المادة", value: values.subject || "" },
                { label: "اسم الطالب", value: values.student_name || "" },
                { label: "نتيجة التحسن", value: values.improvement || "" },
                { label: "تاريخ المتابعة", value: [values.follow_hijri, values.follow_gregorian].filter(Boolean).join(" — ") }
            ],
            sections: [
                { title: "نقاط الضعف", html: listHtml(values.weaknesses) },
                { title: "الخطط العلاجية", html: listHtml(values.remedial_plans) },
                { title: "الإجراءات المتخذة", html: listHtml(values.actions_taken) },
                { title: "ملاحظات", text: values.notes || "", maxLines: 8 }
            ],
            evidenceItems: data.evidence || [],
            evidenceOptions: { maxImages: 4, centered: false },
            signoff: true,
            signoffColumns: [
                {
                    roleTitle: "المعلم",
                    name: values.sig_right || "",
                    signature: "signatures/sig_teachers.png",
                    signatureFallback: "signatures/sig_teachers.png"
                },
                {
                    roleTitle: "المتابع",
                    name: values.sig_mid || "",
                    signature: "signatures/sig_students.png",
                    signatureFallback: "signatures/sig_students.png"
                },
                {
                    roleTitle: "مدير المدرسة",
                    name: values.sig_left || "",
                    signature: "signatures/sig_manager.png",
                    signatureFallback: "signatures/sig_manager.png"
                }
            ],
            page: 1,
            total: 1
        };
    }

    function openPrint(schema, data, doPrint) {
        if (!root.PrintTemplates || typeof root.PrintTemplates.renderPortraitOfficial !== "function") {
            window.alert("قوالب الطباعة غير محمّلة.");
            return "";
        }
        var payload = buildPrintPayload(schema, data);
        var html = root.PrintTemplates.renderPortraitOfficial(payload);
        if (doPrint && root.PrintTemplates.openAndPrint) {
            return root.PrintTemplates.openAndPrint(html, "print-tpl-remedial", {});
        }
        if (root.PrintTemplates.openHtml) {
            root.PrintTemplates.openHtml(html, "print-tpl-remedial");
        }
        return html;
    }

    function mount(host, schema, options) {
        options = options || {};
        if (!host || !schema) {
            return null;
        }
        var wrap = document.createElement("div");
        wrap.className = "ffe-host wash-board wash-board-sheet wash-facility";
        if (schema.washImage) {
            wrap.style.setProperty("--wash-image", "url('" + schema.washImage + "')");
        }
        wrap.innerHTML = formHtml(schema);
        host.innerHTML = "";
        host.appendChild(wrap);
        var form = wrap.querySelector("form");
        var note = wrap.querySelector("[data-ffe-note]");
        var saved = readSaved(schema);
        if (saved) {
            apply(wrap, schema, saved);
        } else {
            apply(wrap, schema, { values: {}, evidence: [] });
        }
        bindEvidence(wrap, schema);
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var data = collect(wrap, schema);
            if (!data.values.student_name) {
                note.textContent = "اسم الطالب مطلوب.";
                return;
            }
            writeSaved(schema, data);
            note.textContent = "حُفظت بيانات الخطة العلاجية.";
            if (typeof options.onSave === "function") {
                options.onSave(data);
            }
        });
        wrap.querySelector("[data-ffe-preview]").addEventListener("click", function () {
            openPrint(schema, collect(wrap, schema), false);
            note.textContent = "معاينة الطباعة جاهزة.";
        });
        wrap.querySelector("[data-ffe-print]").addEventListener("click", function () {
            openPrint(schema, collect(wrap, schema), true);
            note.textContent = "جاري الطباعة.";
        });
        wrap.querySelector("[data-ffe-clear]").addEventListener("click", function () {
            localStorage.removeItem(storageKey(schema));
            wrap._ffeEvidence = [];
            apply(wrap, schema, { values: {}, evidence: [] });
            (schema.sections || []).forEach(function (section) {
                (section.fields || []).forEach(function (field) {
                    if (field.type === "evidence") {
                        paintEvidencePreview(wrap, field);
                    }
                    if (field.default != null && field.type !== "checklist" && field.type !== "evidence") {
                        var input = wrap.querySelector("[name=\"" + fieldName(field) + "\"]");
                        if (input) {
                            input.value = field.default;
                        }
                    }
                });
            });
            note.textContent = "أُفرغ النموذج.";
        });
        var back = wrap.querySelector(".wash-back");
        if (back) {
            back.addEventListener("click", function () {
                if (typeof options.onBack === "function") {
                    options.onBack();
                    return;
                }
                if (root.closeErpBoard) {
                    root.closeErpBoard();
                }
            });
        }
        return {
            root: wrap,
            schema: schema,
            collect: function () { return collect(wrap, schema); },
            print: function (doPrint) { return openPrint(schema, collect(wrap, schema), !!doPrint); }
        };
    }

    function mountFromUrl(host, url, options) {
        return loadSchema(url).then(function (schema) {
            return mount(host, schema, options);
        });
    }

    root.FormFillEngine = {
        loadSchema: loadSchema,
        mount: mount,
        mountFromUrl: mountFromUrl,
        collect: collect,
        apply: apply,
        openPrint: openPrint,
        buildPrintPayload: buildPrintPayload,
        formHtml: formHtml
    };
}(window));
