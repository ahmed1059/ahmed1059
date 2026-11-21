(function () {
    window.BOARD1059_TRIAL = window.BOARD1059_TRIAL || { enabled: false };
    fetch("/api/trial-launch", { cache: "no-store" })
        .then(function (response) {
            return response.ok ? response.json() : null;
        })
        .then(function (payload) {
            if (payload) {
                window.BOARD1059_TRIAL = payload;
            }
        })
        .catch(function () {});
    var icon = '<span class="erp-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3"/></svg></span>';
    var menus = [
        {
            id: "tasks",
            label: "المهام",
            title: "مهام اليوم والأسبوع والمتابعة",
            columns: [
                ["مهام اليوم", [
                    { label: "لوحة المهام اليومية", board: "tasks-today" },
                    { label: "الفترات اللاصفية", board: "soft-periods" },
                    { label: "غياب وتأخر اليوم", board: "tasks-absence" },
                    { label: "دوام المنسوبين", board: "attendance" }
                ]],
                ["مهام الأسبوع", [
                    { label: "مناسبات الأسبوع", board: "tasks-week" },
                    { label: "متابعة اللاصفية", board: "soft-periods", filter: "week" },
                    { label: "متابعات الأسبوع", board: "tasks-follow", filter: "week" }
                ]],
                ["مهام المتابعة", [
                    { label: "متابعات المجالس والسلوك", board: "tasks-follow" }
                ]]
            ]
        },
        {
            id: "committees",
            label: "اللجان",
            title: "لجان القيادة والتعليم والرعاية",
            columns: [
                ["لجان القيادة", [
                    { label: "اللجنة الإدارية", board: "committees-home", filter: "admin" },
                    { label: "لجنة التميز", board: "committees-home", filter: "excellence" }
                ]],
                ["لجان التعليم", [
                    { label: "لجنة التحصيل الدراسي", board: "committees-home", filter: "achievement" },
                    { label: "فريق التربية الخاصة", board: "committees-home", filter: "special" }
                ]],
                ["لجان الرعاية", [
                    { label: "لجنة التوجيه والإرشاد", board: "committees-home", filter: "guidance" },
                    { label: "فريق الصندوق المدرسي", board: "committees-home", filter: "fund" },
                    { label: "فريق الأمن والسلامة المدرسية", board: "committees-home", filter: "safety" }
                ]]
            ]
        },
        {
            id: "plans",
            label: "إعداد الخطط",
            title: "إعداد الخطط التشغيلية والتنفيذية",
            columns: [
                ["الخطة التشغيلية", [
                    { label: "الخطة التشغيلية للمدرسة", board: "school-plan" },
                    { label: "الغلاف والبسملة وصفحات الكتيب", board: "plan-book" },
                    { label: "معاينة الخطة", board: "plan-deck" },
                    { label: "البرامج", board: "programs" },
                    { label: "جدول تسكين البرامج", board: "plan-seat" },
                    { label: "سجل البرامج", board: "program-records" },
                    { label: "السجلات الستة", board: "six-registers" },
                    { label: "لوحة القيادة", board: "command-board" }
                ]],
                ["الخطة التنفيذية", [{ label: "بنود التنفيذ والتوليد", board: "plan-exec" }]],
                ["متابعة التنفيذ", [{ label: "تقييم ذاتي", board: "plan-follow" }]]
            ]
        },
        {
            id: "indicators",
            label: "المؤشرات",
            title: "مؤشرات الاعتماد ونافس والإنجاز",
            columns: [
                ["مؤشرات الاعتماد", [{ label: "إطار هيئة تقويم التعليم", board: "indicators-etec" }]],
                ["مؤشرات نافس", [{ label: "أسبوع نافس المحفوظ", board: "indicators-nafes" }]],
                ["مؤشرات الإنجاز", [{ label: "ما أُنجز في السجلات", board: "indicators-progress" }]]
            ]
        }
    ];

    var host = document.querySelector(".erp-ops");
    if (!host) {
        return;
    }

    menus.forEach(function (menu) {
        var item = document.createElement("div");
        item.className = "erp-item";
        item.setAttribute("data-erp-menu", menu.id);
        item.setAttribute("data-erp-window", menu.id);
        var button = document.createElement("button");
        button.type = "button";
        button.className = "erp-trigger";
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-controls", "erp-panel-" + menu.id);
        if (menu.title) {
            button.setAttribute("title", menu.title);
            button.setAttribute("aria-label", menu.title);
        }
        var labelSpan = document.createElement("span");
        labelSpan.className = "erp-trigger-label";
        labelSpan.textContent = menu.label;
        button.appendChild(labelSpan);
        var caret = document.createElement("span");
        caret.className = "erp-caret";
        caret.setAttribute("aria-hidden", "true");
        button.appendChild(caret);
        var panel = document.createElement("div");
        panel.className = "erp-panel";
        panel.id = "erp-panel-" + menu.id;
        panel.hidden = true;
        menu.columns.forEach(function (column) {
            var col = document.createElement("div");
            var head = document.createElement("div");
            head.className = "erp-col-head";
            head.innerHTML = icon;
            var title = document.createElement("p");
            title.textContent = column[0];
            head.appendChild(title);
            col.appendChild(head);
            column[1].forEach(function (entry) {
                var label = typeof entry === "string" ? entry : entry.label;
                var link = document.createElement("a");
                link.href = "#erp-stage";
                link.textContent = label;
                link.setAttribute("data-erp-group", menu.label);
                link.setAttribute("data-erp-column", column[0]);
                link.setAttribute("data-erp-label", label);
                if (entry && entry.board) {
                    link.setAttribute("data-erp-board", entry.board);
                }
                if (entry && entry.filter) {
                    link.setAttribute("data-erp-filter", entry.filter);
                }
                col.appendChild(link);
            });
            panel.appendChild(col);
        });
        item.appendChild(button);
        item.appendChild(panel);
        var pin = host.querySelector("[data-erp-pin='end']");
        if (pin) {
            host.insertBefore(item, pin);
        } else {
            host.appendChild(item);
        }
    });

    function place(panel) {
        var bar = document.querySelector(".app-header");
        if (!bar) {
            return;
        }
        var rect = bar.getBoundingClientRect();
        panel.style.top = rect.bottom + "px";
        panel.style.left = "0";
        panel.style.right = "0";
    }

    function closeItem(item) {
        item.classList.remove("is-open");
        var button = item.querySelector(".erp-trigger");
        var panel = item.querySelector(".erp-panel, .erp-drop");
        if (button) {
            button.setAttribute("aria-expanded", "false");
        }
        if (panel) {
            panel.hidden = true;
        }
    }

    function closeAll(except) {
        Array.prototype.forEach.call(document.querySelectorAll(".erp-item.is-open"), function (item) {
            if (item !== except) {
                closeItem(item);
            }
        });
    }

    function openItem(item) {
        if (item.classList.contains("is-open")) {
            return;
        }
        closeAll(item);
        var panel = item.querySelector(".erp-panel, .erp-drop");
        var button = item.querySelector(".erp-trigger");
        if (!panel || !button) {
            return;
        }
        panel.hidden = false;
        if (panel.classList.contains("erp-panel")) {
            place(panel);
        }
        item.classList.add("is-open");
        item.dataset.openedAt = String(Date.now());
        button.setAttribute("aria-expanded", "true");
    }

    function stageName(schoolName) {
        if (schoolName.indexOf("متوسطة") >= 0) {
            return "المتوسطة";
        }
        if (schoolName.indexOf("ثانوية") >= 0) {
            return "الثانوية";
        }
        if (schoolName.indexOf("ابتدائية") >= 0) {
            return "الابتدائية";
        }
        return "—";
    }

    function officialIdentityHeader() {
        if (window.OfficialFrameCore && typeof window.OfficialFrameCore.header === "function") {
            return window.OfficialFrameCore.header({ strictIdentity: true });
        }
        return "<header class=\"doc-official-header\">"
            + "<div class=\"header-logo-right\"><img src=\"/assets/ministry_logo.png\" alt=\"وزارة التعليم\"></div>"
            + "<div class=\"header-center-titles\">"
            + "<div>المملكة العربية السعودية</div>"
            + "<div>وزارة التعليم</div>"
            + "<div>الإدارة العامة للتعليم بمنطقة المدينة المنورة</div>"
            + "<div class=\"school-name-title\">متوسطة سعد بن الربيع الأنصاري</div>"
            + "</div>"
            + "<div class=\"header-logo-left\"><img src=\"/assets/vision_2030.png\" alt=\"رؤية 2030\"></div>"
            + "</header><div class=\"header-divider-bar\"></div>";
    }

    function washMarkup(imageUrl, sheetClass, inner) {
        var raw = String(inner || "");
        var hasOfficial = raw.indexOf("doc-official-header") >= 0 || raw.indexOf("print-header-table") >= 0;
        var head = hasOfficial ? "" : officialIdentityHeader();
        return "<div class=\"wash-board\" style=\"--wash-image:url('" + imageUrl + "')\">"
            + "<div class=\"wash-board-art\"></div>"
            + "<div class=\"" + sheetClass + "\">" + head + inner + "</div></div>";
    }

    function readStore(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || "null");
        } catch (error) {
            return null;
        }
    }

    function refreshLinked() {
        if (window.erpRefreshSignals) {
            window.erpRefreshSignals();
        }
    }

    function fieldValue(form, name) {
        var field = form.elements[name];
        if (!field) {
            return "";
        }
        return field.value || "";
    }

    function applyValues(form, values) {
        Object.keys(values).forEach(function (name) {
            var field = form.elements[name];
            if (!field) {
                return;
            }
            if (field.length && field[0] && field[0].type === "radio") {
                Array.prototype.forEach.call(field, function (radio) {
                    radio.checked = radio.value === String(values[name] || "");
                });
                return;
            }
            field.value = values[name] || "";
        });
    }

    function facilityHeaders() {
        var user = null;
        try {
            user = JSON.parse(sessionStorage.getItem("sessionUser") || "null");
        } catch (error) {
            user = null;
        }
        return {
            "Content-Type": "application/json",
            "X-Session-Token": user && user.token ? user.token : ""
        };
    }

    function applyFacilityBank(form, fields) {
        if (form && form.contains(document.activeElement)) {
            return;
        }
        if (form) {
            applyValues(form, fields);
        }
        localStorage.setItem("board1059.facility", JSON.stringify(fields));
    }

    function loadFacilityBank(form) {
        fetch("/api/settings/facility", { headers: facilityHeaders() }).then(function (response) {
            if (!response.ok) {
                return null;
            }
            return response.json();
        }).then(function (payload) {
            if (!payload || !payload.saved || !payload.fields) {
                return;
            }
            applyFacilityBank(form, payload.fields);
        }).catch(function () {
            return null;
        });
    }

    function saveFacilityBank(data, form) {
        var note = form.querySelector(".wash-note");
        fetch("/api/settings/facility", {
            method: "POST",
            headers: facilityHeaders(),
            body: JSON.stringify({ fields: data })
        }).then(function (response) {
            if (!response.ok) {
                throw new Error("save");
            }
            if (note) {
                note.textContent = "تم حفظ البيانات في بنك المعلومات";
            }
        }).catch(function () {
            if (note) {
                note.textContent = "حُفظ في هذا المتصفح وتعذر حفظ بنك المعلومات";
            }
        });
    }

    function bindBoardForm(form, key, names, initial, savedNote) {
        var current = initial;
        applyValues(form, current);
        if (key === "board1059.facility") {
            loadFacilityBank(form);
        }
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var data = {};
            names.forEach(function (name) {
                data[name] = fieldValue(form, name);
            });
            localStorage.setItem(key, JSON.stringify(data));
            current = data;
            if (key === "board1059.facility") {
                saveFacilityBank(data, form);
                return;
            }
            form.querySelector(".wash-note").textContent = savedNote || "تم حفظ التعديلات";
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            applyValues(form, current);
            form.querySelector(".wash-note").textContent = "";
        });
    }

    function actionsHtml(saveLabel, extraClass) {
        return "<div class=\"wash-actions" + (extraClass ? " " + extraClass : "") + "\">"
            + "<button class=\"wash-save\" type=\"submit\">" + (saveLabel || "حفظ التعديلات") + "</button>"
            + "<button class=\"wash-cancel\" type=\"button\">إلغاء</button>"
            + "<button class=\"wash-back\" type=\"button\">العودة</button>"
            + "</div><p class=\"wash-note\"></p>";
    }

    function fillPeopleBoard(host, people) {
        if (!host) {
            return;
        }
        host.classList.add("people-board");
        host.innerHTML = "";
        var groups = [
            { title: "القيادة والإداريون", items: [] },
            { title: "المعلمون", items: [] }
        ];
        (people || []).forEach(function (person) {
            if (String(person.role || "").indexOf("معلم") === 0) {
                groups[1].items.push(person);
            } else {
                groups[0].items.push(person);
            }
        });
        groups.forEach(function (group) {
            if (!group.items.length) {
                return;
            }
            var head = document.createElement("li");
            head.className = "people-group";
            head.textContent = group.title + " (" + group.items.length + ")";
            host.appendChild(head);
            group.items.forEach(function (person) {
                var item = document.createElement("li");
                item.className = "people-chip" + (person.active === false ? " is-off" : "");
                var label = document.createElement("label");
                var input = document.createElement("input");
                input.type = "checkbox";
                input.value = person.id;
                var copy = document.createElement("span");
                copy.className = "council-person";
                var name = document.createElement("b");
                name.textContent = person.name;
                var role = document.createElement("small");
                role.textContent = person.role;
                copy.appendChild(name);
                copy.appendChild(role);
                if (person.active === false) {
                    var badge = document.createElement("span");
                    badge.className = "staff-badge is-inactive";
                    badge.textContent = "غير نشط";
                    copy.appendChild(badge);
                }
                label.appendChild(input);
                label.appendChild(copy);
                item.appendChild(label);
                host.appendChild(item);
            });
        });
    }

    function restorePlanLayout() {
        var body = document.querySelector("#results .card-body");
        var title = document.querySelector(".matrix-title");
        var wrap = document.querySelector(".matrix-wrap");
        if (body && title && title.parentNode !== body) {
            body.appendChild(title);
        }
        if (body && wrap && wrap.parentNode !== body) {
            body.appendChild(wrap);
        }
        var genTitle = document.querySelector("#plan-generator .card-header h2");
        if (genTitle && genTitle.getAttribute("data-plan-title")) {
            genTitle.textContent = genTitle.getAttribute("data-plan-title");
        }
        var save = document.getElementById("btn-save-plan");
        if (save && save.getAttribute("data-plan-label")) {
            save.textContent = save.getAttribute("data-plan-label");
        }
        var submit = document.querySelector("#plan-form .form-actions button");
        if (submit) {
            submit.type = "submit";
        }
        ["plan-generator", "results"].forEach(function (id) {
            var node = document.getElementById(id);
            if (node) {
                node.classList.remove("board-card");
                node.classList.remove("board-span");
            }
        });
    }

    function restoreParked() {
        restorePlanLayout();
        ["booklet", "plan-generator", "results"].forEach(function (id) {
            var node = document.getElementById(id);
            if (!node || !node._parkHome) {
                return;
            }
            var home = node._parkHome;
            var next = node._parkNext;
            if (next && next.parentNode === home) {
                home.insertBefore(node, next);
            } else {
                home.appendChild(node);
            }
            node.hidden = !!node._parkHidden;
        });
    }

    function returnToWelcome() {
        var welcome = document.getElementById("erp-welcome");
        var pane = document.getElementById("erp-pane");
        restoreParked();
        if (pane) {
            pane.hidden = true;
            pane.classList.remove("is-board");
            pane.classList.remove("is-booklet");
            pane.classList.remove("is-deck");
            pane.innerHTML = "";
        }
        document.body.classList.remove("deck-open");
        if (welcome) {
            welcome.hidden = false;
        }
    }

    var FACILITY_FIELDS = [
        "schoolName", "statisticalNumber", "foundedHijri", "foundedGregorian", "stage",
        "educationAdministration", "district", "address",
        "phone", "fax", "email", "website",
        "distanceAdminKm", "distanceSecondary", "distanceSecondaryUnit",
        "distanceMiddle", "distanceMiddleUnit", "distancePrimary", "distancePrimaryUnit",
        "buildingType", "builtArea", "yardArea",
        "roomCount", "classroomCount", "bathroomCount",
        "adminRoomCount", "labCount", "teacherRoomCount", "workshopCount", "warehouseCount"
    ];

    function facilityInput(label, name, type, wide) {
        return "<label class=\"wash-field" + (wide ? " is-wide" : "") + "\">"
            + "<span>" + label + "</span>"
            + "<input name=\"" + name + "\" type=\"" + (type || "text") + "\" autocomplete=\"off\">"
            + "</label>";
    }

    function facilityDualDate(label, hijriName, gregName) {
        return "<div class=\"wash-field is-wide dual-date-block\"><span>" + label + "</span>"
            + "<span class=\"dual-date-pair\">"
            + "<label><b>هجري</b><input class=\"doc-hijri\" name=\"" + hijriName + "\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 17 ربيع الأول 1448هـ\" autocomplete=\"off\"></label>"
            + "<label><b>ميلادي</b><input class=\"doc-date-picker\" name=\"" + gregName + "\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 30 أغسطس 2026م\" autocomplete=\"off\"></label>"
            + "</span></div>";
    }

    function facilityMeasure(label, name, unitName) {
        var unit = unitName
            ? "<select name=\"" + unitName + "\"><option value=\"كم\">كم</option><option value=\"متر\">متر</option></select>"
            : "<b>كم</b>";
        return "<label class=\"wash-field wash-measure\"><span>" + label + "</span>"
            + "<span class=\"wash-measure-row\">"
            + "<input name=\"" + name + "\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\">"
            + unit
            + "</span></label>";
    }

    function facilitySeed(school) {
        var source = school || {};
        var stage = stageName(source.name || "");
        return {
            schoolName: source.name || "",
            statisticalNumber: source.statistical_number || "",
            foundedHijri: "1430هـ",
            foundedGregorian: "",
            stage: stage === "—" ? "" : stage,
            educationAdministration: source.education_administration || "",
            district: "قباء",
            address: "حي الراية، المدينة المنورة",
            phone: "",
            fax: "",
            email: "Zt.naif001@hotmail.com",
            website: "",
            distanceAdminKm: "",
            distanceSecondary: "",
            distanceSecondaryUnit: "كم",
            distanceMiddle: "",
            distanceMiddleUnit: "كم",
            distancePrimary: "",
            distancePrimaryUnit: "كم",
            buildingType: source.building_type === "مستأجر" ? "مستأجر" : "حكومي",
            builtArea: "",
            yardArea: "",
            roomCount: "",
            classroomCount: source.classrooms || "",
            bathroomCount: "",
            adminRoomCount: "",
            labCount: "",
            teacherRoomCount: "",
            workshopCount: source.labs || "",
            warehouseCount: ""
        };
    }

    function paintFacility(pane) {
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup("/assets/dashboard/board-facility.jpg", "wash-board-sheet wash-facility", ""
            + "<form id=\"facility-form\">"
            + "<h1>بيانات المنشأة</h1>"
            + "<div class=\"facility-layout\">"
            + "<section class=\"facility-card\">"
            + "<h2>الهوية الأساسية والتواصل</h2>"
            + "<div class=\"facility-fields\">"
            + facilityInput("اسم المدرسة", "schoolName", "text", true)
            + facilityInput("الرقم الوزاري (الإحصائي)", "statisticalNumber")
            + facilityDualDate("تاريخ التأسيس", "foundedHijri", "foundedGregorian")
            + facilityInput("المرحلة الدراسية", "stage")
            + facilityInput("المحافظة / المركز", "district")
            + facilityInput("الإدارة التعليمية", "educationAdministration", "text", true)
            + facilityInput("العنوان (الحي)", "address", "text", true)
            + facilityInput("الهاتف", "phone", "tel")
            + facilityInput("الفاكس", "fax", "tel")
            + facilityInput("البريد الإلكتروني", "email", "email")
            + facilityInput("الموقع الإلكتروني", "website", "url")
            + "</div></section>"
            + "<section class=\"facility-card\">"
            + "<h2>البيئة المكانية والمسافات</h2>"
            + "<div class=\"facility-fields cols-1\">"
            + facilityMeasure("تبعد عن الإدارة العامة للتعليم", "distanceAdminKm")
            + facilityMeasure("تبعد عن أقرب مدرسة ثانوية", "distanceSecondary", "distanceSecondaryUnit")
            + facilityMeasure("تبعد عن أقرب مدرسة متوسطة", "distanceMiddle", "distanceMiddleUnit")
            + facilityMeasure("تبعد عن أقرب مدرسة ابتدائية", "distancePrimary", "distancePrimaryUnit")
            + "</div></section>"
            + "<section class=\"facility-card is-wide\">"
            + "<h2>تفاصيل المبنى المدرسي</h2>"
            + "<div class=\"facility-fields cols-3\">"
            + "<label class=\"wash-field\"><span>نوع المبنى</span>"
            + "<select name=\"buildingType\"><option value=\"حكومي\">حكومي</option><option value=\"مستأجر\">مستأجر</option></select></label>"
            + facilityInput("مساحة البناء (متر مربع)", "builtArea")
            + facilityInput("مساحة الفناء (متر مربع)", "yardArea")
            + facilityInput("العدد الكلي للغرف", "roomCount")
            + facilityInput("عدد الفصول الدراسية", "classroomCount")
            + facilityInput("عدد دورات المياه", "bathroomCount")
            + facilityInput("عدد غرف الإدارة", "adminRoomCount")
            + facilityInput("عدد المختبرات", "labCount")
            + facilityInput("عدد غرف المدرسين", "teacherRoomCount")
            + facilityInput("عدد المعامل", "workshopCount")
            + facilityInput("عدد المستودعات", "warehouseCount")
            + "</div></section>"
            + "</div>"
            + actionsHtml("حفظ البيانات", "facility-actions")
            + "</form>");
        var form = pane.querySelector("#facility-form");
        var saved = readStore("board1059.facility");
        if (saved && !saved.foundedHijri && saved.founded) {
            saved.foundedHijri = saved.founded;
        }
        if (saved) {
            bindBoardForm(form, "board1059.facility", FACILITY_FIELDS, saved, "تم حفظ البيانات");
            return;
        }
        fetch("/api/settings").then(function (response) {
            return response.json();
        }).then(function (data) {
            bindBoardForm(form, "board1059.facility", FACILITY_FIELDS, facilitySeed(data.school), "تم حفظ البيانات");
        }).catch(function () {
            bindBoardForm(form, "board1059.facility", FACILITY_FIELDS, facilitySeed(null), "تم حفظ البيانات");
        });
    }

    function calendarPair(hijriValue, gregorianValue, legacy) {
        var hijri = hijriValue || "";
        var gregorian = gregorianValue || "";
        if (!hijri && !gregorian && legacy && typeof gregorianFromDate === "function") {
            if (/^\d{4}-\d{2}-\d{2}$/.test(legacy)) {
                return { hijri: hijriFromDate(legacy), gregorian: gregorianFromDate(legacy) };
            }
            hijri = typeof formatDisplayDate === "function" ? formatDisplayDate(legacy, "hijri") : normalizeDateOrder(legacy);
        }
        if (typeof formatDisplayDate === "function") {
            hijri = formatDisplayDate(hijri, "hijri");
            gregorian = formatDisplayDate(gregorian, "gregorian");
        } else if (typeof normalizeDateOrder === "function") {
            hijri = normalizeDateOrder(hijri);
            gregorian = normalizeDateOrder(gregorian);
        }
        return { hijri: hijri, gregorian: gregorian };
    }

    function nextYearLabel(value) {
        var pair = /^(\d{4})\s*-\s*(\d{4})$/.exec(value || "");
        if (pair) {
            return String(Number(pair[1]) + 1) + "-" + String(Number(pair[2]) + 1);
        }
        var single = /^(\d{4})$/.exec(value || "");
        if (single) {
            return String(Number(single[1]) + 1);
        }
        return "";
    }

    function paintCalendar(pane) {
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup("/assets/dashboard/board-calendar.jpg", "wash-board-sheet wash-facility", ""
            + "<form id=\"calendar-form\">"
            + "<h1>التقويم المعتمد</h1>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card board-span\">"
            + "<h2>بنية العام الدراسي</h2>"
            + "<div class=\"calendar-top\">"
            + "<div class=\"calendar-years\">"
            + "<h3>العام والفصول</h3>"
            + "<div class=\"wash-years\" id=\"year-list\"></div>"
            + "<div class=\"wash-add-row calendar-year-add\">"
            + "<button class=\"wash-add\" id=\"add-year\" type=\"button\">عام جديد</button>"
            + "<input id=\"new-year\" type=\"text\" placeholder=\"اكتب العام، مثل 1446 أو 1446-1447\" aria-label=\"عام دراسي جديد\">"
            + "</div>"
            + "<input name=\"year\" type=\"hidden\">"
            + "<input name=\"years\" type=\"hidden\">"
            + "<fieldset class=\"wash-choice\"><legend>عدد الفصول في العام الدراسي</legend>"
            + "<label><input type=\"radio\" name=\"termCount\" value=\"1\"> فصل واحد</label>"
            + "<label><input type=\"radio\" name=\"termCount\" value=\"2\"> فصلان</label>"
            + "<label><input type=\"radio\" name=\"termCount\" value=\"3\"> ثلاثة فصول</label>"
            + "</fieldset>"
            + "<p class=\"wash-hint\">هذا العدد بنية العام الدراسي، وتُبنى عليه الخطط والسجلات.</p>"
            + "</div>"
            + "<div class=\"calendar-region\">"
            + "<h3>المنطقة التعليمية</h3>"
            + "<fieldset class=\"wash-choice\">"
            + "<label><input type=\"radio\" name=\"region\" value=\"makkah\"> مكة والمدينة وجدة والطائف</label>"
            + "<label><input type=\"radio\" name=\"region\" value=\"general\"> بقية المناطق</label>"
            + "</fieldset>"
            + "<button class=\"wash-add\" id=\"fill-official\" type=\"button\">تعبئة التواريخ الرسمية</button>"
            + "<p class=\"wash-hint\">المدينة المنورة ضمن المجموعة الأولى، وانطلاق الدراسة فيها يختلف عن بقية المناطق.</p>"
            + "</div>"
            + "</div>"
            + "<div class=\"date-rail\">"
            + "<div class=\"wash-field dual-date-block\"><span class=\"wash-block-title\">تاريخ بداية العام</span><span class=\"dual-date-pair\">"
            + "<label><b>هجري</b><input class=\"doc-hijri\" id=\"start-hijri\" name=\"startHijri\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 17 ربيع الأول 1448هـ\" autocomplete=\"off\"></label>"
            + "<label><b>ميلادي</b><input class=\"doc-date-picker\" id=\"start-gregorian\" name=\"startGregorian\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 30 أغسطس 2026م\" autocomplete=\"off\"></label>"
            + "</span></div>"
            + "<div class=\"wash-field dual-date-block\"><span class=\"wash-block-title\">تاريخ بداية الاختبارات</span><span class=\"dual-date-pair\">"
            + "<label><b>هجري</b><input class=\"doc-hijri\" id=\"exam-hijri\" name=\"examHijri\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 17 ربيع الأول 1448هـ\" autocomplete=\"off\"></label>"
            + "<label><b>ميلادي</b><input class=\"doc-date-picker\" id=\"exam-gregorian\" name=\"examGregorian\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 30 أغسطس 2026م\" autocomplete=\"off\"></label>"
            + "</span></div>"
            + "<div class=\"wash-field dual-date-block\"><span class=\"wash-block-title\">تاريخ نهاية العام</span><span class=\"dual-date-pair\">"
            + "<label><b>هجري</b><input class=\"doc-hijri\" id=\"end-hijri\" name=\"endHijri\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 17 ربيع الأول 1448هـ\" autocomplete=\"off\"></label>"
            + "<label><b>ميلادي</b><input class=\"doc-date-picker\" id=\"end-gregorian\" name=\"endGregorian\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 30 أغسطس 2026م\" autocomplete=\"off\"></label>"
            + "</span></div>"
            + "</div>"
            + "<p class=\"wash-hint\">التاريخ بأسماء الأشهر: الهجري مثل 17 ربيع الأول 1448هـ، والميلادي مثل 30 أغسطس 2026م. قائمة السنة والشهر أعلى التقويم للتنقل السريع.</p>"
            + "</section>"
            + "<section class=\"board-card board-span\" aria-labelledby=\"year-track-title\">"
            + "<h2 id=\"year-track-title\">المحطات الزمنية والإجازات</h2>"
            + "<ol class=\"station-grid\" id=\"year-track\"></ol>"
            + "</section>"
            + "</div>"
            + actionsHtml("حفظ التعديلات", "facility-actions")
            + "</form>");
        var form = pane.querySelector("#calendar-form");
        var saved = readStore("board1059.calendar") || {};
        var years = Array.isArray(saved.years) ? saved.years.slice() : [];
        if (saved.year && years.indexOf(saved.year) < 0) {
            years.push(saved.year);
        }
        if (!years.length) {
            years = ["1448-1449"];
        }
        var startPair = calendarPair(saved.startHijri, saved.startGregorian, saved.start);
        var examPair = calendarPair(saved.examHijri, saved.examGregorian, "");
        var endPair = calendarPair(saved.endHijri, saved.endGregorian, saved.end);
        var state = {
            years: years,
            year: saved.year || years[0] || "1448-1449",
            termCount: saved.termCount || "2",
            region: saved.region || "makkah",
            startHijri: startPair.hijri,
            startGregorian: startPair.gregorian,
            examHijri: examPair.hijri,
            examGregorian: examPair.gregorian,
            endHijri: endPair.hijri,
            endGregorian: endPair.gregorian
        };
        var initial = {
            years: state.years.slice(),
            year: state.year,
            termCount: state.termCount,
            region: state.region,
            startHijri: state.startHijri,
            startGregorian: state.startGregorian,
            examHijri: state.examHijri,
            examGregorian: state.examGregorian,
            endHijri: state.endHijri,
            endGregorian: state.endGregorian
        };
        var list = form.querySelector("#year-list");
        var trackMeta = {
            holiday: "إجازة",
            national: "مناسبة وطنية",
            admin: "عودة الكوادر",
            teachers: "عودة المعلمين",
            academic: "بداية الدراسة",
            exam: "اختبارات",
            activity: "نشاط",
            measurement: "قياس وموهبة"
        };
        function dated(start, end, suffix) {
            var prefer = suffix === "هـ" ? "hijri" : "gregorian";
            if (typeof formatDisplayDateRange === "function") {
                return formatDisplayDateRange(start, end, prefer);
            }
            var first = trackDate(start, suffix);
            var last = end ? trackDate(end, suffix) : "";
            if (!last || last === first) {
                return first;
            }
            return first + " – " + last;
        }
        function rowsForYear() {
            if (state.year === "1448-1449" && typeof occasionsFor === "function") {
                return occasionsFor(state.year, state.region || "makkah").map(function (item) {
                    return {
                        type: item.type,
                        title: item.title,
                        id: item.id,
                        hijri: dated(item.hijriStart, item.hijriEnd, "هـ"),
                        gregorian: dated(item.gregorianStart, item.gregorianEnd, "م"),
                        note: item.note || ""
                    };
                });
            }
            return (window.academicCalendarData || []).filter(function (item) {
                return item.year === state.year;
            }).map(function (item) {
                return {
                    type: item.type,
                    title: item.title,
                    hijri: dated(item.hijri, "", "هـ"),
                    gregorian: dated(item.gregorian, "", "م"),
                    note: ""
                };
            });
        }
        function trackDate(value, suffix) {
            var text = String(value || "").trim();
            if (!text) {
                return "";
            }
            var prefer = suffix === "هـ" ? "hijri" : (suffix === "م" ? "gregorian" : "");
            if (typeof formatDisplayDate === "function") {
                return formatDisplayDate(text, prefer);
            }
            if (typeof normalizeDateOrder === "function") {
                return normalizeDateOrder(text.indexOf(suffix) >= 0 || !suffix ? text : text + suffix);
            }
            if (text.indexOf(suffix) >= 0) {
                return text;
            }
            return text + suffix;
        }
        function paintTrack() {
            var track = form.querySelector("#year-track");
            if (!track) {
                return;
            }
            var rows = rowsForYear();
            track.innerHTML = "";
            if (!state.year) {
                var choose = document.createElement("li");
                choose.className = "year-track-empty";
                choose.textContent = "اختر العام الدراسي لعرض محطاته.";
                track.appendChild(choose);
                return;
            }
            if (!rows.length) {
                var empty = document.createElement("li");
                empty.className = "year-track-empty";
                empty.textContent = "لا محطات محفوظة لهذا العام.";
                track.appendChild(empty);
                return;
            }
            rows.forEach(function (item) {
                var row = document.createElement("li");
                row.className = "year-track-item";
                row.setAttribute("data-type", item.type || "");
                if (item.id) {
                    row.setAttribute("data-occasion-id", item.id);
                }
                var mark = document.createElement("span");
                mark.className = "year-track-mark";
                mark.setAttribute("aria-hidden", "true");
                var card = document.createElement("article");
                var kind = document.createElement("p");
                kind.className = "year-track-kind";
                kind.textContent = trackMeta[item.type] || "";
                var title = document.createElement("h3");
                title.textContent = item.title || "";
                var dates = document.createElement("p");
                dates.className = "year-track-dates";
                var hijri = document.createElement("span");
                hijri.textContent = trackDate(item.hijri, "هـ");
                var gregorian = document.createElement("span");
                gregorian.textContent = trackDate(item.gregorian, "م");
                dates.appendChild(hijri);
                dates.appendChild(gregorian);
                card.appendChild(kind);
                card.appendChild(title);
                card.appendChild(dates);
                if (item.note) {
                    var note = document.createElement("p");
                    note.className = "year-track-note";
                    note.textContent = item.note;
                    card.appendChild(note);
                }
                row.appendChild(mark);
                row.appendChild(card);
                track.appendChild(row);
            });
        }
        function paintYears() {
            list.innerHTML = "";
            form.elements.years.value = JSON.stringify(state.years);
            form.elements.year.value = state.year;
            if (!state.years.length) {
                list.textContent = "";
                paintTrack();
                return;
            }
            state.years.forEach(function (item) {
                var chip = document.createElement("span");
                chip.className = "year-chip" + (item === state.year ? " is-current" : "");
                var pick = document.createElement("button");
                pick.type = "button";
                pick.className = "year-pick";
                pick.textContent = item;
                pick.addEventListener("click", function () {
                    state.year = item;
                    paintYears();
                });
                var remove = document.createElement("button");
                remove.type = "button";
                remove.className = "year-remove";
                remove.setAttribute("aria-label", "حذف العام " + item);
                remove.textContent = "×";
                remove.addEventListener("click", function () {
                    state.years = state.years.filter(function (year) {
                        return year !== item;
                    });
                    if (state.year === item) {
                        state.year = state.years[state.years.length - 1] || "";
                    }
                    paintYears();
                });
                chip.appendChild(pick);
                chip.appendChild(remove);
                list.appendChild(chip);
            });
            paintTrack();
        }
        function applyOfficialDates() {
            if (state.year !== "1448-1449" || typeof occasionAnchors !== "function") {
                form.querySelector(".wash-note").textContent = "التعبئة الرسمية المتاحة الآن لعام 1448-1449.";
                return;
            }
            var anchors = occasionAnchors(state.region || "makkah");
            function put(item, hijriName, gregorianName) {
                if (!item) {
                    return;
                }
                state[hijriName] = trackDate(item.hijriStart, "هـ");
                state[gregorianName] = trackDate(item.gregorianStart, "م");
                form.elements[hijriName].value = state[hijriName];
                form.elements[gregorianName].value = state[gregorianName];
            }
            put(anchors.yearStart, "startHijri", "startGregorian");
            put(anchors.examStart, "examHijri", "examGregorian");
            put(anchors.yearEnd, "endHijri", "endGregorian");
            if (typeof syncHijriGregorianDates === "function") {
                syncHijriGregorianDates("start-gregorian", "start-hijri");
                syncHijriGregorianDates("exam-gregorian", "exam-hijri");
                syncHijriGregorianDates("end-gregorian", "end-hijri");
            }
            form.querySelector(".wash-note").textContent = "";
        }
        form.elements.region.value = state.region;
        form.elements.termCount.value = state.termCount;
        form.elements.startHijri.value = state.startHijri;
        form.elements.startGregorian.value = state.startGregorian;
        form.elements.examHijri.value = state.examHijri;
        form.elements.examGregorian.value = state.examGregorian;
        form.elements.endHijri.value = state.endHijri;
        form.elements.endGregorian.value = state.endGregorian;
        if (typeof syncHijriGregorianDates === "function") {
            syncHijriGregorianDates("start-gregorian", "start-hijri");
            syncHijriGregorianDates("exam-gregorian", "exam-hijri");
            syncHijriGregorianDates("end-gregorian", "end-hijri");
        }
        paintYears();
        form.querySelector("#add-year").addEventListener("click", function () {
            var input = form.querySelector("#new-year");
            var typed = input.value.replace(/\s+/g, "").replace("–", "-");
            if (!typed) {
                typed = nextYearLabel(state.year || state.years[state.years.length - 1] || "");
            }
            if (!typed) {
                input.focus();
                return;
            }
            if (state.years.indexOf(typed) < 0) {
                state.years.push(typed);
            }
            state.year = typed;
            input.value = "";
            paintYears();
        });
        var datesEmpty = !state.startHijri && !state.startGregorian && !state.examHijri && !state.examGregorian && !state.endHijri && !state.endGregorian;
        if (datesEmpty && state.year === "1448-1449") {
            applyOfficialDates();
        }
        Array.prototype.forEach.call(form.elements.region, function (radio) {
            radio.addEventListener("change", function () {
                state.region = form.elements.region.value;
                if (state.year === "1448-1449") {
                    applyOfficialDates();
                }
                paintTrack();
            });
        });
        form.querySelector("#fill-official").addEventListener("click", function () {
            applyOfficialDates();
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var data = {
                years: state.years,
                year: state.year,
                termCount: form.elements.termCount.value || "2",
                region: form.elements.region.value || "makkah",
                startHijri: form.elements.startHijri.value,
                startGregorian: form.elements.startGregorian.value,
                examHijri: form.elements.examHijri.value,
                examGregorian: form.elements.examGregorian.value,
                endHijri: form.elements.endHijri.value,
                endGregorian: form.elements.endGregorian.value,
                start: form.elements.startHijri.value,
                end: form.elements.endHijri.value
            };
            localStorage.setItem("board1059.calendar", JSON.stringify(data));
            state.termCount = data.termCount;
            state.region = data.region;
            state.startHijri = data.startHijri;
            state.startGregorian = data.startGregorian;
            state.examHijri = data.examHijri;
            state.examGregorian = data.examGregorian;
            state.endHijri = data.endHijri;
            state.endGregorian = data.endGregorian;
            if (window.dataHub && typeof window.dataHub.publish === "function") {
                window.dataHub.publish("calendar");
            } else {
                window.dispatchEvent(new CustomEvent("dataChanged", {
                    detail: { source: "calendar" }
                }));
            }
            form.querySelector(".wash-note").textContent = "تم حفظ التعديلات";
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            var stored = readStore("board1059.calendar");
            if (stored) {
                state.years = Array.isArray(stored.years) ? stored.years.slice() : [];
                state.year = stored.year || "";
                var storedStart = calendarPair(stored.startHijri, stored.startGregorian, stored.start);
                var storedExam = calendarPair(stored.examHijri, stored.examGregorian, "");
                var storedEnd = calendarPair(stored.endHijri, stored.endGregorian, stored.end);
                state.termCount = stored.termCount || "2";
                state.region = stored.region || "makkah";
                state.startHijri = storedStart.hijri;
                state.startGregorian = storedStart.gregorian;
                state.examHijri = storedExam.hijri;
                state.examGregorian = storedExam.gregorian;
                state.endHijri = storedEnd.hijri;
                state.endGregorian = storedEnd.gregorian;
            } else {
                state.years = initial.years.slice();
                state.year = initial.year;
                state.termCount = initial.termCount;
                state.region = initial.region;
                state.startHijri = initial.startHijri;
                state.startGregorian = initial.startGregorian;
                state.examHijri = initial.examHijri;
                state.examGregorian = initial.examGregorian;
                state.endHijri = initial.endHijri;
                state.endGregorian = initial.endGregorian;
            }
            form.elements.region.value = state.region;
            form.elements.termCount.value = state.termCount;
            form.elements.startHijri.value = state.startHijri;
            form.elements.startGregorian.value = state.startGregorian;
            form.elements.examHijri.value = state.examHijri;
            form.elements.examGregorian.value = state.examGregorian;
            form.elements.endHijri.value = state.endHijri;
            form.elements.endGregorian.value = state.endGregorian;
            if (typeof syncHijriGregorianDates === "function") {
                syncHijriGregorianDates("start-gregorian", "start-hijri");
                syncHijriGregorianDates("exam-gregorian", "exam-hijri");
                syncHijriGregorianDates("end-gregorian", "end-hijri");
            }
            paintYears();
            form.querySelector(".wash-note").textContent = "";
        });
    }

    function paintOccasionList(list, region) {
        var kinds = {
            holiday: "إجازة",
            national: "مناسبة وطنية",
            admin: "عودة الكوادر",
            teachers: "عودة المعلمين",
            academic: "بداية الدراسة",
            exam: "اختبارات",
            activity: "نشاط",
            measurement: "قياس وموهبة"
        };
        list.innerHTML = "";
        var rows = typeof occasionsFor === "function" ? occasionsFor("1448-1449", region) : [];
        rows.forEach(function (item) {
            var row = document.createElement("li");
            row.className = "year-track-item";
            row.setAttribute("data-type", item.type || "");
            row.setAttribute("data-occasion-id", item.id);
            var mark = document.createElement("span");
            mark.className = "year-track-mark";
            mark.setAttribute("aria-hidden", "true");
            var card = document.createElement("article");
            var kind = document.createElement("p");
            kind.className = "year-track-kind";
            kind.textContent = kinds[item.type] || "";
            var title = document.createElement("h3");
            title.textContent = item.title || "";
            var dates = document.createElement("p");
            dates.className = "year-track-dates";
            var hijri = document.createElement("span");
            hijri.textContent = typeof formatDisplayDateRange === "function"
                ? formatDisplayDateRange(item.hijriStart, item.hijriEnd, "hijri")
                : (item.hijriEnd ? item.hijriStart + "هـ – " + item.hijriEnd + "هـ" : item.hijriStart + "هـ");
            var gregorian = document.createElement("span");
            gregorian.textContent = typeof formatDisplayDateRange === "function"
                ? formatDisplayDateRange(item.gregorianStart, item.gregorianEnd, "gregorian")
                : (item.gregorianEnd ? item.gregorianStart + "م – " + item.gregorianEnd + "م" : item.gregorianStart + "م");
            dates.appendChild(hijri);
            dates.appendChild(gregorian);
            card.appendChild(kind);
            card.appendChild(title);
            card.appendChild(dates);
            if (item.note) {
                var note = document.createElement("p");
                note.className = "year-track-note";
                note.textContent = item.note;
                card.appendChild(note);
            }
            row.appendChild(mark);
            row.appendChild(card);
            list.appendChild(row);
        });
    }

    function paintOccasions(pane) {
        var saved = readStore("board1059.calendar") || {};
        var region = saved.region || "makkah";
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-calendar.jpg",
            "wash-board-sheet wash-facility",
            "<form id=\"erp-board-form\">"
            + "<h1>المناسبات والفعاليات</h1>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card\">"
            + "<h2>المنطقة التعليمية</h2>"
            + "<fieldset class=\"wash-choice\">"
            + "<label><input type=\"radio\" name=\"region\" value=\"makkah\"> مكة والمدينة وجدة والطائف</label>"
            + "<label><input type=\"radio\" name=\"region\" value=\"general\"> بقية المناطق</label>"
            + "</fieldset>"
            + "<p class=\"wash-hint\">مرجع عام 1448-1449. البرامج والسجلات والأنشطة ترتبط بمعرّف المناسبة.</p>"
            + "</section>"
            + "<section class=\"board-card\">"
            + "<h2>ما يُعبأ في التقويم</h2>"
            + "<div id=\"occasion-anchors\"></div>"
            + "</section>"
            + "<section class=\"board-span\">"
            + "<h2>قائمة المناسبات</h2>"
            + "<ol class=\"station-grid\" id=\"occasion-list\"></ol>"
            + "</section>"
            + "</div>"
            + actionsHtml("حفظ التعديلات", "facility-actions")
            + "</form>"
        );
        var form = pane.querySelector("#erp-board-form");
        var list = form.querySelector("#occasion-list");
        var anchors = form.querySelector("#occasion-anchors");
        form.elements.region.value = region;
        paintOccasionList(list, region);
        paintOccasionAnchors(anchors, region);
        Array.prototype.forEach.call(form.elements.region, function (radio) {
            radio.addEventListener("change", function () {
                region = form.elements.region.value;
                paintOccasionList(list, region);
                paintOccasionAnchors(anchors, region);
            });
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var current = readStore("board1059.calendar") || {};
            current.region = form.elements.region.value || "makkah";
            localStorage.setItem("board1059.calendar", JSON.stringify(current));
            form.querySelector(".wash-note").textContent = "تم حفظ المنطقة التعليمية";
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            var stored = readStore("board1059.calendar") || {};
            region = stored.region || "makkah";
            form.elements.region.value = region;
            paintOccasionList(list, region);
            paintOccasionAnchors(anchors, region);
            form.querySelector(".wash-note").textContent = "";
        });
    }

    function paintOccasionAnchors(box, region) {
        var anchors = typeof occasionAnchors === "function" ? occasionAnchors(region) : {};
        var rows = [
            ["بداية العام", anchors.yearStart],
            ["بداية الاختبارات", anchors.examStart],
            ["نهاية العام", anchors.yearEnd]
        ];
        box.innerHTML = "";
        rows.forEach(function (pair) {
            var item = pair[1];
            var block = document.createElement("p");
            block.className = "anchor-line";
            var title = document.createElement("b");
            title.textContent = pair[0];
            var hijri = document.createElement("span");
            var gregorian = document.createElement("span");
            hijri.textContent = item
                ? (typeof formatDisplayDate === "function" ? formatDisplayDate(item.hijriStart, "hijri") : item.hijriStart + "هـ")
                : "";
            gregorian.textContent = item
                ? (typeof formatDisplayDate === "function" ? formatDisplayDate(item.gregorianStart, "gregorian") : item.gregorianStart + "م")
                : "";
            block.appendChild(title);
            block.appendChild(hijri);
            block.appendChild(gregorian);
            box.appendChild(block);
        });
    }

    function leadershipSeed(data) {
        var approval = data && data.approval ? data.approval : {};
        var principal = approval.principal && approval.principal.name ? approval.principal.name : (data && data.principal_name) || "";
        var studentsVice = "";
        var schoolVice = "";
        var authorities = approval.authorities || [];
        authorities.forEach(function (item) {
            if (item.title && item.title.indexOf("المعلمين") >= 0) {
                schoolVice = item.name || "";
            }
            if (item.title && item.title.indexOf("شؤون الطلاب") >= 0) {
                studentsVice = item.name || "";
            }
        });
        return {
            principal: principal,
            educationalGuide: "",
            schoolVice: schoolVice,
            studentsVice: studentsVice,
            studentCounselor: "منور بن محمد اللهيبي"
        };
    }

    function paintLeadership(pane) {
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup("/assets/dashboard/board-leadership.jpg", "wash-board-sheet wash-facility", ""
            + "<form id=\"leadership-form\">"
            + "<h1>التشكيل القيادي</h1>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card\">"
            + "<h2>الإدارة</h2>"
            + "<label class=\"wash-field\"><span>مدير المدرسة</span><select name=\"principal\"></select></label>"
            + "<label class=\"wash-field\"><span>الموجه التربوي</span><input name=\"educationalGuide\" type=\"text\" autocomplete=\"off\"></label>"
            + "</section>"
            + "<section class=\"board-card\">"
            + "<h2>الوكلاء والتوجيه</h2>"
            + "<label class=\"wash-field\"><span>وكيل الشؤون المدرسية</span><select name=\"schoolVice\"></select></label>"
            + "<div class=\"wash-people\" data-people=\"viceTeachers\" data-label=\"وكيل الشؤون التعليمية\"></div>"
            + "<button class=\"wash-add\" type=\"button\" data-add=\"viceTeachers\">إضافة وكيل تعليمي</button>"
            + "<div class=\"wash-people\" data-people=\"studentsVice\" data-label=\"وكيل شؤون الطلاب\"></div>"
            + "<button class=\"wash-add\" type=\"button\" data-add=\"studentsVice\">إضافة وكيل طلاب</button>"
            + "<div class=\"wash-people\" data-people=\"studentCounselor\" data-label=\"الموجه الطلابي\"></div>"
            + "<button class=\"wash-add\" type=\"button\" data-add=\"studentCounselor\">إضافة موجه</button>"
            + "<label class=\"wash-field\"><span>الموجه الطلابي الرئيسي</span><select name=\"primaryCounselor\"></select></label>"
            + "<label class=\"wash-field\"><span>رائد النشاط الطلابي</span><select name=\"activityLeader\"></select></label>"
            + "</section>"
            + "</div>"
            + actionsHtml("حفظ التعديلات", "facility-actions")
            + "</form>");
        var form = pane.querySelector("#leadership-form");
        var saved = readStore("board1059.leadership");
        if (saved) {
            bindLeadershipForm(form, saved);
            return;
        }
        fetch("/api/settings").then(function (response) {
            return response.json();
        }).then(function (data) {
            bindLeadershipForm(form, leadershipSeed(data));
        }).catch(function () {
            bindLeadershipForm(form, leadershipSeed(null));
        });
    }

    var LEADERSHIP_LISTS = {
        viceTeachers: "viceTeachersList",
        studentsVice: "studentsVices",
        studentCounselor: "studentCounselors"
    };

    function leadershipNames(data, singleKey) {
        var listKey = LEADERSHIP_LISTS[singleKey];
        if (data && listKey && Array.isArray(data[listKey]) && data[listKey].length) {
            return data[listKey].map(function (item) { return String(item || ""); });
        }
        if (data && data[singleKey]) {
            return [String(data[singleKey])];
        }
        return [""];
    }

    function leadershipView(data) {
        return Object.assign({}, data || {});
    }

    function fillStaffSelect(select, currentId, options) {
        if (!select) {
            return;
        }
        var people = options || [];
        select.innerHTML = "";
        var blank = document.createElement("option");
        blank.value = "";
        blank.textContent = people.length ? "اختر من سجل المنسوبين" : "ارفع بيانات المنسوبين أولًا";
        select.appendChild(blank);
        people.forEach(function (person) {
            if (!person || !person.id || !person.name) {
                return;
            }
            var option = document.createElement("option");
            option.value = person.id;
            option.textContent = person.name;
            select.appendChild(option);
        });
        var id = String(currentId || "");
        var exists = Array.prototype.some.call(select.options, function (option) {
            return option.value === id;
        });
        select.value = exists ? id : "";
    }

    function paintPeople(host, names, options) {
        var label = host.getAttribute("data-label") || "";
        host.innerHTML = "";
        names.forEach(function (name, index) {
            var row = document.createElement("div");
            row.className = "wash-repeat";
            var field = document.createElement("label");
            field.className = "wash-field";
            var caption = document.createElement("span");
            caption.textContent = index ? label + " " + (index + 1) : label;
            var select = document.createElement("select");
            fillStaffSelect(select, name, options);
            field.appendChild(caption);
            field.appendChild(select);
            row.appendChild(field);
            if (index > 0) {
                var drop = document.createElement("button");
                drop.type = "button";
                drop.className = "wash-drop";
                drop.textContent = "حذف";
                drop.addEventListener("click", function () {
                    row.remove();
                });
                row.appendChild(drop);
            }
            host.appendChild(row);
        });
    }

    function readPeople(host) {
        return Array.prototype.map.call(host.querySelectorAll("select"), function (select) {
            return select.value || "";
        });
    }

    function bindLeadershipForm(form, initial) {
        var current = leadershipView(initial);
        var options = [];
        function fill(data) {
            Array.prototype.forEach.call(form.querySelectorAll("[data-people]"), function (host) {
                paintPeople(host, leadershipNames(data, host.getAttribute("data-people")), options);
            });
            fillStaffSelect(form.elements.principal, data.principal || "", options);
            fillStaffSelect(form.elements.schoolVice, data.schoolVice || "", options);
            var guide = form.elements.educationalGuide;
            if (guide && !guide.dataset.touched) {
                var guideValue = String(data.educationalGuide || "").trim();
                var guidePerson = options.filter(function (person) {
                    return person && person.id === guideValue;
                })[0];
                guide.value = guidePerson && guidePerson.name ? guidePerson.name : (/^\d{10,}$/.test(guideValue) ? "" : guideValue);
            }
            fillStaffSelect(form.elements.activityLeader, data.activityLeader || "", options);
            fillStaffSelect(form.elements.primaryCounselor, data.primaryCounselor || data.studentCounselor || "", options);
        }
        Array.prototype.forEach.call(form.querySelectorAll("[data-add]"), function (button) {
            button.addEventListener("click", function () {
                var key = button.getAttribute("data-add");
                var host = form.querySelector('[data-people="' + key + '"]');
                var names = readPeople(host);
                names.push("");
                paintPeople(host, names, options);
                var selects = host.querySelectorAll("select");
                if (selects.length) {
                    selects[selects.length - 1].focus();
                }
            });
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var data = {
                principal: fieldValue(form, "principal"),
                educationalGuide: fieldValue(form, "educationalGuide"),
                schoolVice: fieldValue(form, "schoolVice"),
                activityLeader: fieldValue(form, "activityLeader"),
                primaryCounselor: fieldValue(form, "primaryCounselor")
            };
            Object.keys(LEADERSHIP_LISTS).forEach(function (singleKey) {
                var host = form.querySelector('[data-people="' + singleKey + '"]');
                var names = readPeople(host).map(function (item) { return item.trim(); }).filter(Boolean);
                data[LEADERSHIP_LISTS[singleKey]] = names;
                data[singleKey] = names[0] || "";
            });
            if (data.primaryCounselor) {
                data.studentCounselor = data.primaryCounselor;
            }
            localStorage.setItem("board1059.leadership", JSON.stringify(data));
            current = data;
            fill(current);
            form.querySelector(".wash-note").textContent = "تم حفظ التعديلات";
            if (window.dataHub) {
                window.dataHub.publish("leadership");
            }
        });
        form.elements.educationalGuide.addEventListener("input", function () {
            form.elements.educationalGuide.dataset.touched = "1";
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            delete form.elements.educationalGuide.dataset.touched;
            fill(current);
            form.querySelector(".wash-note").textContent = "";
        });
        fetch("/api/noor/staff").then(function (response) {
            return response.json();
        }).then(function (payload) {
            options = payload.people || [];
        }).catch(function () {
            options = [];
        }).finally(function () {
            fill(current);
        });
        window.addEventListener("dataChanged", function (event) {
            if (!event.detail || event.detail.source !== "staff" || !window.dataHub) {
                return;
            }
            options = window.dataHub.people();
            Array.prototype.forEach.call(form.querySelectorAll("select"), function (select) {
                fillStaffSelect(select, select.value, options);
            });
        });
    }

    var staffDirectory = [];

    function paintStaff(pane) {
        var roles = [
            "مدير المدرسة",
            "وكيل المدرسة للشؤون التعليمية",
            "وكيل المدرسة لشؤون الطلاب",
            "وكيل المدرسة للشؤون المدرسية",
            "معلم",
            "معلم الموهوبين",
            "معلم التربية الخاصة",
            "الموجه الطلابي",
            "الموجه الصحي",
            "رائد النشاط",
            "أمين مصادر التعلم",
            "محضر المختبر",
            "مساعد إداري",
            "مسجل معلومات",
            "سكرتير",
            "حارس",
            "عامل خدمات"
        ];
        var specialties = [
            "التربية الإسلامية",
            "اللغة العربية",
            "اللغة الإنجليزية",
            "الدراسات الاجتماعية",
            "الرياضيات",
            "العلوم",
            "المهارات الرقمية",
            "التربية الفنية",
            "التربية البدنية",
            "المهارات الحياتية والأسرية",
            "التفكير الناقد",
            "الكيمياء",
            "الأحياء",
            "الفيزياء",
            "علم الأرض والفضاء",
            "العلوم الإدارية",
            "التربية الفكرية",
            "التوحد",
            "صعوبات التعلم"
        ];
        var rows = [];
        var query = "";
        var group = "all";
        var editing = "";
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<form id=\"staff-form\">"
            + "<h1>سجل المنسوبين</h1>"
            + "<p class=\"wash-hint\">الأسماء من ملفات نور المدمجة. التعديل و«عضو جديد» يحفظان هذا الشخص ولا يمسّان بقية السجل. «الكل» يعرض الجميع.</p>"
            + "<p class=\"wash-hint\" id=\"staff-count\"></p>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card board-span staff-toolbar\">"
            + "<div class=\"staff-toolbar-row\">"
            + "<input id=\"staff-search\" type=\"search\" placeholder=\"ابحث بالاسم أو السجل المدني\" autocomplete=\"off\">"
            + "<select id=\"staff-filter\" aria-label=\"تصفية المنسوبين\">"
            + "<option value=\"all\">الكل</option>"
            + "<option value=\"teacher\">المعلمون</option>"
            + "<option value=\"admin\">الإداريون</option>"
            + "</select>"
            + "<button class=\"staff-add\" id=\"staff-open\" type=\"button\">عضو جديد</button>"
            + "<button class=\"wash-back\" type=\"button\">العودة</button>"
            + "</div>"
            + "<p class=\"wash-note\"></p>"
            + "</section>"
            + "<section class=\"board-card board-span\" id=\"staff-editor\" hidden>"
            + "<h2 id=\"staff-editor-title\">عضو جديد</h2>"
            + "<div class=\"facility-fields\">"
            + "<label class=\"wash-field\"><span>الاسم الرباعي</span><input name=\"name\" type=\"text\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>السجل المدني</span><input name=\"nationalId\" type=\"text\" inputmode=\"numeric\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>المسمى الوظيفي</span><select name=\"role\"></select></label>"
            + "<label class=\"wash-field\"><span>التخصص</span><select name=\"specialty\"></select></label>"
            + "<label class=\"wash-field\"><span>رقم الجوال</span><input name=\"phone\" type=\"tel\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>حالة الحساب</span><select name=\"active\"><option value=\"1\">نشط</option><option value=\"0\">غير نشط</option></select></label>"
            + "</div>"
            + "<div class=\"staff-editor-actions\">"
            + "<button class=\"wash-save\" id=\"staff-commit\" type=\"button\">إضافة</button>"
            + "<button class=\"wash-cancel\" id=\"staff-dismiss\" type=\"button\">إلغاء</button>"
            + "</div>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<table class=\"staff-table\">"
            + "<thead><tr>"
            + "<th>الاسم الرباعي</th><th>السجل المدني</th><th>المسمى الوظيفي</th><th>التخصص</th><th>رقم الجوال</th><th>حالة الحساب</th><th>الإجراءات</th>"
            + "</tr></thead>"
            + "<tbody id=\"staff-rows\"></tbody>"
            + "</table>"
            + "</section>"
            + "</div>"
            + "</form>"
        );
        var form = pane.querySelector("#staff-form");
        var body = form.querySelector("#staff-rows");
        var editor = form.querySelector("#staff-editor");
        var note = form.querySelector(".wash-note");
        function fillSelect(select, values, blank) {
            select.innerHTML = "";
            if (blank) {
                var empty = document.createElement("option");
                empty.value = "";
                empty.textContent = blank;
                select.appendChild(empty);
            }
            values.forEach(function (value) {
                var option = document.createElement("option");
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            });
        }
        fillSelect(form.elements.role, roles);
        fillSelect(form.elements.specialty, specialties, "بدون تخصص");
        function matches(row) {
            var needle = query.replace(/\s+/g, "");
            var found = !needle || (row.name + row.nationalId).replace(/\s+/g, "").indexOf(needle) >= 0;
            var kind = row.role.indexOf("معلم") === 0 ? "teacher" : "admin";
            return found && (group === "all" || group === kind);
        }
        function render() {
            body.innerHTML = "";
            var list = rows.filter(matches);
            var counter = form.querySelector("#staff-count");
            if (counter) {
                counter.textContent = "المعروض " + list.length + " من أصل " + rows.length + ".";
            }
            if (!list.length) {
                var empty = document.createElement("tr");
                var cell = document.createElement("td");
                cell.colSpan = 7;
                cell.className = "staff-empty";
                cell.textContent = "لا نتائج مطابقة.";
                empty.appendChild(cell);
                body.appendChild(empty);
                return;
            }
            list.forEach(function (row) {
                var tr = document.createElement("tr");
                ["name", "nationalId", "role", "specialty", "phone"].forEach(function (key) {
                    var cell = document.createElement("td");
                    cell.textContent = row[key];
                    tr.appendChild(cell);
                });
                var status = document.createElement("td");
                var badge = document.createElement("span");
                badge.className = "staff-badge " + (row.active ? "is-active" : "is-inactive");
                badge.textContent = row.active ? "نشط" : "غير نشط";
                status.appendChild(badge);
                tr.appendChild(status);
                var actions = document.createElement("td");
                actions.className = "staff-actions";
                var edit = document.createElement("button");
                edit.type = "button";
                edit.className = "staff-icon";
                edit.setAttribute("aria-label", "تعديل");
                edit.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 20h4l10-10-4-4L4 16v4z\"/><path d=\"M13 7l4 4\"/></svg>";
                edit.addEventListener("click", function () {
                    openEditor(row);
                });
                var remove = document.createElement("button");
                remove.type = "button";
                remove.className = "staff-icon is-delete";
                remove.setAttribute("aria-label", "حذف");
                remove.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 8h14\"/><path d=\"M9 8V5h6v3\"/><path d=\"M8 8l1 12h6l1-12\"/></svg>";
                remove.addEventListener("click", function () {
                    if (!window.confirm("هل أنت متأكد من حذف هذا المنسوب؟")) {
                        return;
                    }
                    var places = window.dataHub ? window.dataHub.places(row.nationalId) : [];
                    var dropFromTeam = false;
                    if (places.length) {
                        dropFromTeam = window.confirm("هذا المنسوب موجود في فريق التخطيط. هل تريد حذفه من الفريق أيضًا؟");
                    }
                    fetch("/api/noor/staff/" + encodeURIComponent(row.nationalId), { method: "DELETE" }).then(function (response) {
                        if (!response.ok) {
                            throw new Error("تعذر الحذف");
                        }
                        if (dropFromTeam && window.dataHub) {
                            window.dataHub.remove(row.nationalId);
                        }
                        if (editing === row.id) {
                            closeEditor();
                        }
                        note.textContent = dropFromTeam ? "حُذف المنسوب من السجل ومن التشكيل." : "حُذف المنسوب من السجل.";
                        loadRows();
                        if (window.dataHub) {
                            window.dataHub.publish("staff");
                        }
                    }).catch(function () {
                        note.textContent = "تعذر حذف المنسوب.";
                    });
                });
                actions.appendChild(edit);
                actions.appendChild(remove);
                tr.appendChild(actions);
                body.appendChild(tr);
            });
        }
        function closeEditor() {
            editing = "";
            editor.hidden = true;
        }
        function ensureOption(select, value) {
            if (!value) {
                return;
            }
            var exists = Array.prototype.some.call(select.options, function (option) {
                return option.value === value;
            });
            if (!exists) {
                var option = document.createElement("option");
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            }
        }
        function openEditor(row) {
            editing = row ? row.id : "";
            editor.hidden = false;
            form.querySelector("#staff-editor-title").textContent = row ? "تعديل البيانات" : "عضو جديد";
            form.querySelector("#staff-commit").textContent = row ? "حفظ التعديل" : "إضافة";
            form.elements.name.value = row ? row.name : "";
            form.elements.nationalId.value = row ? row.nationalId : "";
            ensureOption(form.elements.role, row ? row.role : "");
            ensureOption(form.elements.specialty, row ? row.specialty : "");
            form.elements.role.value = row && row.role ? row.role : roles[0];
            form.elements.specialty.value = row ? row.specialty : "";
            form.elements.phone.value = row ? row.phone : "";
            form.elements.active.value = row && !row.active ? "0" : "1";
            form.elements.name.focus();
        }
        form.querySelector("#staff-search").addEventListener("input", function (event) {
            query = event.target.value || "";
            render();
        });
        form.querySelector("#staff-filter").addEventListener("change", function (event) {
            group = event.target.value;
            render();
        });
        form.querySelector("#staff-open").addEventListener("click", function () {
            openEditor(null);
        });
        form.querySelector("#staff-dismiss").addEventListener("click", function () {
            closeEditor();
            note.textContent = "";
        });
        form.querySelector("#staff-commit").addEventListener("click", function () {
            var next = {
                name: form.elements.name.value.replace(/\s+/g, " ").trim(),
                nationalId: form.elements.nationalId.value.trim(),
                role: form.elements.role.value,
                specialty: form.elements.specialty.value.trim(),
                phone: form.elements.phone.value.trim(),
                active: form.elements.active.value === "1"
            };
            if (!next.name || !next.nationalId) {
                note.textContent = "الاسم والسجل المدني مطلوبان.";
                return;
            }
            fetch("/api/noor/staff", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    national_id: next.nationalId,
                    original_id: editing || "",
                    name: next.name,
                    role: next.role,
                    specialty: next.specialty,
                    mobile: next.phone,
                    active: next.active
                })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر الحفظ");
                    }
                    return payload;
                });
            }).then(function () {
                if (editing && editing !== next.nationalId && window.dataHub) {
                    window.dataHub.rename(editing, next.nationalId);
                }
                note.textContent = editing ? "حُفظ التعديل." : "أُضيف المنسوب إلى السجل.";
                closeEditor();
                loadRows();
                if (window.dataHub) {
                    window.dataHub.publish("staff");
                }
            }).catch(function (error) {
                note.textContent = error.message || "تعذر الحفظ.";
            });
        });
        function loadRows() {
            fetch("/api/noor/staff").then(function (response) {
                return response.json();
            }).then(function (payload) {
                rows = (payload.people || []).map(function (person) {
                    return {
                        id: person.id,
                        name: person.name,
                        nationalId: person.id,
                        role: person.role || "",
                        specialty: person.specialty || "",
                        phone: person.mobile || "",
                        active: person.active !== false
                    };
                });
                render();
            }).catch(function () {
                note.textContent = "تعذر قراءة سجل المنسوبين.";
            });
        }
        form.addEventListener("submit", function (event) {
            event.preventDefault();
        });
        loadRows();
    }

    function paintPermissions(pane) {
        var windows = [
            { id: "settings", label: "شاشة الإعدادات" },
            { id: "schoolRegisters", label: "السجلات المدرسية" },
            { id: "viceRegisters", label: "سجلات الوكيل" },
            { id: "teacherRegisters", label: "سجلات المعلم" },
            { id: "tasks", label: "إدارة المهام" },
            { id: "committees", label: "اللجان" },
            { id: "plans", label: "الخطط" },
            { id: "indicators", label: "المؤشرات" }
        ];
        var levels = [
            { id: "system", label: "مدير نظام بكامل الصلاحيات" },
            { id: "leadership", label: "صلاحيات إدارة عليا" },
            { id: "teacher", label: "صلاحيات معلم" },
            { id: "guest", label: "ضيف / مشرف للاطلاع فقط" }
        ];
        var selected = null;
        function suggestedLevel(role) {
            if (role.indexOf("مدير") === 0 || role.indexOf("وكيل") === 0) {
                return "leadership";
            }
            if (role.indexOf("معلم") === 0 || role === "الموجه الطلابي" || role === "الموجه الصحي" || role === "رائد النشاط" || role === "أمين مصادر التعلم" || role === "محضر المختبر") {
                return "teacher";
            }
            return "guest";
        }
        function windowsFor(level) {
            var values = {};
            windows.forEach(function (item) {
                values[item.id] = level === "system" || level === "leadership";
            });
            if (level === "teacher") {
                values.teacherRegisters = true;
                values.tasks = true;
            }
            return values;
        }
        var levelMarkup = levels.map(function (item) {
            return "<label class=\"perm-level\"><input type=\"radio\" name=\"level\" value=\"" + item.id + "\"><span>" + item.label + "</span></label>";
        }).join("");
        var windowMarkup = windows.map(function (item) {
            return "<label class=\"perm-row\"><span>" + item.label + "</span><span class=\"perm-switch\"><input type=\"checkbox\" data-window=\"" + item.id + "\"><span></span></span></label>";
        }).join("");
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<form id=\"perm-form\">"
            + "<h1>هندسة الصلاحيات</h1>"
            + "<p class=\"wash-hint\">الصلاحية تُربط بالمنسوب في سجل المعاينة. الحساب غير النشط تُحفظ صلاحيته ولا يفتح الدخول.</p>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card\">"
            + "<h2>استدعاء المنسوب</h2>"
            + "<div class=\"perm-pick\">"
            + "<input id=\"perm-search\" type=\"search\" placeholder=\"ابحث بالاسم أو السجل المدني\" autocomplete=\"off\" role=\"combobox\" aria-expanded=\"false\" aria-controls=\"perm-list\">"
            + "<ul id=\"perm-list\" class=\"perm-results\" hidden></ul>"
            + "</div>"
            + "</section>"
            + "<section class=\"board-card\" id=\"perm-profile\">"
            + "<h2>بيانات المنسوب</h2>"
            + "<p class=\"perm-empty\">اختر منسوبًا لعرض اسمه ومسماه وحالة حسابه.</p>"
            + "</section>"
            + "<section class=\"board-card\">"
            + "<h2>مستوى الوصول العام</h2>"
            + levelMarkup
            + "</section>"
            + "<section class=\"board-card\">"
            + "<h2>صلاحيات النوافذ</h2>"
            + windowMarkup
            + "</section>"
            + "<p class=\"perm-warning board-span\" id=\"perm-warning\" hidden>هذا الدور للاطلاع فقط: يخفي أزرار الإضافة والتعديل والحذف في النظام، ويبقي تصفح البيانات.</p>"
            + "</div>"
            + actionsHtml("حفظ الصلاحيات", "facility-actions")
            + "</form>"
        );
        var form = pane.querySelector("#perm-form");
        var search = form.querySelector("#perm-search");
        var list = form.querySelector("#perm-list");
        var profile = form.querySelector("#perm-profile");
        var warning = form.querySelector("#perm-warning");
        var note = form.querySelector(".wash-note");
        function paintProfile(person) {
            profile.innerHTML = "";
            var title = document.createElement("h2");
            title.textContent = "بيانات المنسوب";
            profile.appendChild(title);
            if (!person) {
                var empty = document.createElement("p");
                empty.className = "perm-empty";
                empty.textContent = "اختر منسوبًا لعرض اسمه ومسماه وحالة حسابه.";
                profile.appendChild(empty);
                return;
            }
            var name = document.createElement("p");
            name.className = "perm-name";
            name.textContent = person.name;
            var role = document.createElement("p");
            role.className = "perm-role";
            role.textContent = person.role;
            var badge = document.createElement("span");
            badge.className = "staff-badge " + (person.active ? "is-active" : "is-inactive");
            badge.textContent = person.active ? "نشط" : "غير نشط";
            profile.appendChild(name);
            profile.appendChild(role);
            profile.appendChild(badge);
            if (!person.active) {
                var inactive = document.createElement("p");
                inactive.className = "wash-hint";
                inactive.textContent = "الحساب غير نشط. الصلاحية تُحفظ ولا تفتح الدخول حتى يُفعّل الحساب.";
                profile.appendChild(inactive);
            }
        }
        function applyAccess(level, values) {
            form.elements.level.value = level;
            var locked = level === "system" || level === "guest";
            var source = locked ? windowsFor(level) : values;
            windows.forEach(function (item) {
                var input = form.querySelector("[data-window=\"" + item.id + "\"]");
                input.checked = !!source[item.id];
                input.disabled = locked;
            });
            warning.hidden = level !== "guest";
        }
        function recordFor(person) {
            var saved = readStore("board1059.permissions") || {};
            var record = saved[person.id];
            if (record && record.level) {
                return { level: record.level, windows: record.windows || windowsFor(record.level) };
            }
            var level = suggestedLevel(person.role);
            return { level: level, windows: windowsFor(level) };
        }
        function choose(person) {
            selected = person;
            search.value = person.name;
            list.hidden = true;
            search.setAttribute("aria-expanded", "false");
            paintProfile(person);
            var record = recordFor(person);
            applyAccess(record.level, record.windows);
            note.textContent = "";
        }
        function paintMatches() {
            var needle = search.value.replace(/\s+/g, "");
            list.innerHTML = "";
            var matches = staffDirectory.filter(function (person) {
                return !needle || (person.name + person.nationalId).replace(/\s+/g, "").indexOf(needle) >= 0;
            });
            if (!matches.length) {
                var empty = document.createElement("li");
                empty.textContent = "لا نتائج مطابقة.";
                list.appendChild(empty);
            }
            matches.forEach(function (person) {
                var item = document.createElement("li");
                var button = document.createElement("button");
                button.type = "button";
                button.textContent = person.name + " — " + person.role;
                button.addEventListener("mousedown", function (event) {
                    event.preventDefault();
                });
                button.addEventListener("click", function () {
                    choose(person);
                });
                item.appendChild(button);
                list.appendChild(item);
            });
            list.hidden = false;
            search.setAttribute("aria-expanded", "true");
        }
        search.addEventListener("focus", paintMatches);
        search.addEventListener("input", function () {
            selected = null;
            paintProfile(null);
            warning.hidden = true;
            paintMatches();
        });
        Array.prototype.forEach.call(form.elements.level, function (radio) {
            radio.addEventListener("change", function () {
                if (!selected) {
                    note.textContent = "اختر المنسوب أولًا.";
                    radio.checked = false;
                    return;
                }
                applyAccess(form.elements.level.value, windowsFor(form.elements.level.value));
            });
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            if (!selected) {
                note.textContent = "اختر المنسوب أولًا.";
                return;
            }
            var saved = readStore("board1059.permissions") || {};
            var values = {};
            windows.forEach(function (item) {
                values[item.id] = !!form.querySelector("[data-window=\"" + item.id + "\"]").checked;
            });
            saved[selected.id] = { level: form.elements.level.value, windows: values };
            localStorage.setItem("board1059.permissions", JSON.stringify(saved));
            note.textContent = "تم حفظ الصلاحيات";
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            if (!selected) {
                note.textContent = "";
                return;
            }
            var record = recordFor(selected);
            applyAccess(record.level, record.windows);
            note.textContent = "";
        });
    }

    function paintNoorImport(pane) {
        var cards = [
            { id: "students", title: "بيانات الطلاب والفصول", exts: "xlsx,csv", accept: ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv", note: "ملف الطلاب من نور، ولو كان الصف والفصل في رأس كل ورقة. الكشف بلا رقم هوية يكتب الفصل على الاسم الموجود ولا ينشئ طلابًا جددًا." },
            { id: "timetable", title: "الجدول المدرسي", exts: "json,xlsx,xls", accept: ".json,.xlsx,.xls", note: "نسخة واضح أو إكسل فيه اليوم والحصة والمادة. ملف بلا حصص لا يُدخل صفوفًا." },
            { id: "teachers", multiple: true, title: "بيانات المعلمين", exts: "xlsx,csv", accept: ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv", note: "اختر ملفات نور معًا: المدير، والوكيل، والمعلمين، والموجه. الصفة تُؤخذ من اسم الملف، والرفع يضيف إلى السجل ولا يمسحه." },
            { id: "enrich", title: "استيراد بيانات إضافية", exts: "xlsx,csv", accept: ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv", note: "ملف بثلاثة أعمدة: رقم الهوية، والتخصص أو الصف، والفصل. يحدّث السجلات الموجودة ولا ينشئ صفوفًا جديدة." }
        ];
        var cloud = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 18h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.5-1.5A3.5 3.5 0 0 0 7 18z\"/><path d=\"M12 12v6\"/><path d=\"M9.5 14.5L12 12l2.5 2.5\"/></svg>";
        var markup = cards.map(function (card) {
            return "<section class=\"board-card import-card\" data-import=\"" + card.id + "\" data-exts=\"" + card.exts + "\"" + (card.multiple ? " data-multiple=\"1\"" : "") + ">"
                + "<h2>" + card.title + "</h2>"
                + "<p class=\"wash-hint\">" + card.note + "</p>"
                + "<button class=\"import-drop\" type=\"button\">" + cloud + "<span>" + (card.multiple ? "أفلت الملفات هنا" : "أفلت الملف هنا") + "</span><strong class=\"import-name\" hidden></strong></button>"
                + "<input class=\"import-input\" type=\"file\" accept=\"" + card.accept + "\"" + (card.multiple ? " multiple" : "") + " hidden>"
                + "<div class=\"import-actions\">"
                + "<button class=\"import-browse\" type=\"button\">تصفح الملفات</button>"
                + "<button class=\"import-upload\" type=\"button\">رفع</button>"
                + "</div>"
                + "<div class=\"import-progress\" hidden><span></span></div>"
                + "<p class=\"wash-note\"></p>"
                + "</section>";
        }).join("");
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-facility.jpg",
            "wash-board-sheet wash-facility",
            "<div class=\"import-board\">"
            + "<h1>استيراد بيانات نور</h1>"
            + "<p class=\"wash-hint\">ملفات المنسوبين تُرفع دفعة واحدة وتُضاف إلى السجل. ملف الطلاب والجدول يبقى كل منهما ملفًا واحدًا. العمود الغائب يُذكر باسمه.</p>"
            + "<div class=\"import-grid\">" + markup + "</div>"
            + "<div class=\"wash-actions facility-actions\"><button class=\"wash-back\" type=\"button\">العودة</button></div>"
            + "</div>"
        );
        function allowed(file, exts) {
            var name = String(file && file.name || "").toLowerCase();
            var ext = name.indexOf(".") < 0 ? "" : name.split(".").pop();
            return exts.indexOf(ext) >= 0;
        }
        Array.prototype.forEach.call(pane.querySelectorAll(".import-card"), function (card) {
            var input = card.querySelector(".import-input");
            var drop = card.querySelector(".import-drop");
            var name = card.querySelector(".import-name");
            var note = card.querySelector(".wash-note");
            var bar = card.querySelector(".import-progress");
            var fill = bar.querySelector("span");
            var exts = (card.getAttribute("data-exts") || "").split(",");
            var multiple = card.getAttribute("data-multiple") === "1";
            var chosen = [];
            var running = false;
            function take(list) {
                var files = Array.prototype.filter.call(list || [], function (file) {
                    return allowed(file, exts);
                });
                if (!files.length) {
                    chosen = [];
                    name.hidden = true;
                    name.textContent = "";
                    note.textContent = "الصيغ المقبولة هنا: " + exts.join("، ") + ".";
                    return;
                }
                chosen = multiple ? files : [files[0]];
                name.hidden = false;
                name.textContent = chosen.length > 1 ? (chosen.length + " ملفات") : chosen[0].name;
                note.textContent = "";
            }
            drop.addEventListener("click", function () {
                input.click();
            });
            drop.addEventListener("dragover", function (event) {
                event.preventDefault();
                drop.classList.add("is-over");
            });
            drop.addEventListener("dragleave", function () {
                drop.classList.remove("is-over");
            });
            drop.addEventListener("drop", function (event) {
                event.preventDefault();
                drop.classList.remove("is-over");
                take(event.dataTransfer.files);
            });
            card.querySelector(".import-browse").addEventListener("click", function () {
                input.click();
            });
            input.addEventListener("change", function () {
                take(input.files);
            });
            card.querySelector(".import-upload").addEventListener("click", function () {
                if (!chosen.length) {
                    note.textContent = multiple ? "اختر الملفات أولًا." : "اختر ملفًا أولًا.";
                    return;
                }
                if (running) {
                    return;
                }
                running = true;
                bar.hidden = false;
                fill.style.width = "35%";
                var body = new FormData();
                body.append("kind", card.getAttribute("data-import"));
                if (multiple) {
                    chosen.forEach(function (item) {
                        body.append("files", item);
                    });
                } else {
                    body.append("file", chosen[0]);
                }
                fetch("/api/noor/import", { method: "POST", body: body }).then(function (response) {
                    return response.json().then(function (payload) {
                        if (!response.ok) {
                            throw new Error(payload.detail || "تعذر قراءة الملف");
                        }
                        return payload;
                    });
                }).then(function (payload) {
                    fill.style.width = "100%";
                    var lines = payload.summary
                        ? [payload.summary]
                        : (payload.kind === "enrich"
                        ? ["قُرئ " + payload.read + " صفًا. حُدّث تخصص " + (payload.staff_updated || 0) + " معلمًا، وصف أو فصل " + (payload.students_updated || 0) + " طالبًا. لم يُطابق " + (payload.missing_ids || 0) + " رقمًا."]
                        : ["قُرئ " + payload.read + " سجلًا، وأُدخل " + payload.inserted + "."]);
                    if (payload.skipped) {
                        lines.push("تُرك " + payload.skipped + " سطرًا بلا اسم أو رقم هوية.");
                    }
                    (payload.errors || []).forEach(function (item) { lines.push(item); });
                    (payload.warnings || []).forEach(function (item) { lines.push(item); });
                    note.textContent = lines.join(" ");
                    if (window.dataHub) {
                        var kind = card.getAttribute("data-import");
                        if (kind === "teachers" || kind === "enrich") {
                            window.dataHub.publish("staff");
                        }
                        if (kind === "students" || kind === "enrich") {
                            window.dataHub.publish("students");
                        }
                    }
                }).catch(function (error) {
                    note.textContent = error.message || "تعذر قراءة الملف.";
                }).finally(function () {
                    running = false;
                });
            });
        });
    }

    function todayIso() {
        var now = new Date();
        var month = String(now.getMonth() + 1);
        var day = String(now.getDate());
        if (month.length < 2) {
            month = "0" + month;
        }
        if (day.length < 2) {
            day = "0" + day;
        }
        return now.getFullYear() + "-" + month + "-" + day;
    }

    function paintAttendance(pane) {
        var statuses = [
            { id: "present", label: "حاضر" },
            { id: "late", label: "متأخر" },
            { id: "absent", label: "غائب" },
            { id: "mission", label: "مستأذن" }
        ];
        var drafts = {};
        var currentIso = todayIso();
        var query = "";
        var group = "all";
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<form id=\"roll-form\">"
            + "<h1>سجل الدوام والانصراف</h1>"
            + "<p class=\"wash-hint\">الأسماء من سجل المنسوبين. الحاضر هو الأصل، والملاحظة تُكتب عند التأخر أو الاستئذان.</p>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card board-span\">"
            + "<h2>لوحة اليوم</h2>"
            + "<div class=\"roll-toolbar\">"
            + "<div class=\"wash-field dual-date-block roll-dates\"><span>تاريخ السجل</span><span class=\"dual-date-pair\">"
            + "<label><b>هجري</b><input class=\"doc-hijri\" id=\"roll-hijri\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 17 ربيع الأول 1448هـ\" autocomplete=\"off\"></label>"
            + "<label><b>ميلادي</b><input class=\"doc-date-picker\" id=\"roll-gregorian\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 30 أغسطس 2026م\" autocomplete=\"off\"></label>"
            + "</span></div>"
            + "<label class=\"roll-search-label\"><span>بحث بالاسم</span><input id=\"roll-search\" type=\"search\" placeholder=\"الاسم الرباعي\" autocomplete=\"off\"></label>"
            + "<div class=\"roll-filters\" role=\"radiogroup\" aria-label=\"تصفية المنسوبين\">"
            + "<button type=\"button\" class=\"is-on\" data-roll-filter=\"all\">الكل</button>"
            + "<button type=\"button\" data-roll-filter=\"admin\">إداريون</button>"
            + "<button type=\"button\" data-roll-filter=\"teacher\">معلمون</button>"
            + "</div>"
            + "</div>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<h2>جدول التحضير اليومي</h2>"
            + "<p class=\"roll-print-line\" id=\"roll-print-line\"></p>"
            + "<table class=\"staff-table roll-table\">"
            + "<thead><tr><th>الاسم الرباعي</th><th>المسمى الوظيفي</th><th>حالة الحضور</th><th>وقت الحضور / ملاحظات</th></tr></thead>"
            + "<tbody id=\"roll-rows\"></tbody>"
            + "</table>"
            + "</section>"
            + "</div>"
            + actionsHtml("اعتماد سجل اليوم", "facility-actions")
            + "</form>"
        );
        var form = pane.querySelector("#roll-form");
        mountDocumentWitness(form, "كشف دوام");
        var greg = pane.querySelector("#roll-gregorian");
        var hijri = pane.querySelector("#roll-hijri");
        var tbody = pane.querySelector("#roll-rows");
        var note = form.querySelector(".wash-note");
        var printLine = pane.querySelector("#roll-print-line");
        var actions = form.querySelector(".wash-actions");
        var printBtn = document.createElement("button");
        printBtn.type = "button";
        printBtn.className = "wash-print";
        printBtn.textContent = "طباعة التقرير";
        actions.insertBefore(printBtn, actions.querySelector(".wash-cancel"));
        greg.value = gregorianFromDate(currentIso);
        hijri.value = hijriFromDate(currentIso);
        syncHijriGregorianDates(greg, hijri);

        function blankRow() {
            return { status: "present", note: "" };
        }

        function dayDraft(iso) {
            if (drafts[iso]) {
                return drafts[iso];
            }
            var store = readStore("board1059.attendance") || {};
            var saved = store[iso] || {};
            var rows = {};
            staffDirectory.forEach(function (person) {
                var item = saved.rows && saved.rows[person.id];
                var status = item && item.status;
                if (status !== "present" && status !== "late" && status !== "absent" && status !== "mission") {
                    status = "present";
                }
                rows[person.id] = { status: status, note: item && item.note ? item.note : "" };
            });
            drafts[iso] = { rows: rows, adopted: !!saved.adopted };
            return drafts[iso];
        }

        function readIso() {
            return isoFromGregorianText(greg.value) || isoFromHijriText(hijri.value) || "";
        }

        function matches(person) {
            var kind = person.role.indexOf("معلم") === 0 ? "teacher" : "admin";
            if (group !== "all" && kind !== group) {
                return false;
            }
            return !query || person.name.indexOf(query) !== -1;
        }

        function paintPrintLine() {
            var draft = dayDraft(currentIso);
            var school = document.getElementById("command-school-name");
            printLine.textContent = (school ? school.textContent : "") + " — سجل الدوام والانصراف — " + hijri.value + " — " + greg.value + " — " + (draft.adopted ? "سجل معتمد" : "لم يُعتمد بعد");
        }

        function render() {
            var draft = dayDraft(currentIso);
            tbody.innerHTML = "";
            var shown = staffDirectory.filter(matches);
            if (!shown.length) {
                var empty = document.createElement("tr");
                var cell = document.createElement("td");
                cell.colSpan = 4;
                cell.className = "staff-empty";
                cell.textContent = "لا منسوبين في هذا التصفية.";
                empty.appendChild(cell);
                tbody.appendChild(empty);
                paintPrintLine();
                return;
            }
            shown.forEach(function (person) {
                var record = draft.rows[person.id] || blankRow();
                draft.rows[person.id] = record;
                var tr = document.createElement("tr");
                tr.className = "is-" + record.status;
                var nameCell = document.createElement("td");
                nameCell.textContent = person.name;
                if (!person.active) {
                    var badge = document.createElement("span");
                    badge.className = "staff-badge is-inactive";
                    badge.textContent = "غير نشط";
                    nameCell.appendChild(document.createTextNode(" "));
                    nameCell.appendChild(badge);
                }
                var roleCell = document.createElement("td");
                roleCell.textContent = person.role;
                var statusCell = document.createElement("td");
                var pills = document.createElement("div");
                pills.className = "roll-pills";
                pills.setAttribute("role", "radiogroup");
                pills.setAttribute("aria-label", "حالة " + person.name);
                statuses.forEach(function (item) {
                    var label = document.createElement("label");
                    label.className = "roll-pill is-" + item.id;
                    var input = document.createElement("input");
                    input.type = "radio";
                    input.name = "roll-" + person.id;
                    input.value = item.id;
                    input.checked = record.status === item.id;
                    var caption = document.createElement("span");
                    caption.textContent = item.label;
                    label.appendChild(input);
                    label.appendChild(caption);
                    pills.appendChild(label);
                });
                statusCell.appendChild(pills);
                var noteCell = document.createElement("td");
                var field = document.createElement("input");
                field.type = "text";
                field.className = "roll-note";
                field.value = record.note;
                field.placeholder = "وقت التأخر أو العذر";
                field.hidden = record.status !== "late" && record.status !== "mission";
                field.setAttribute("aria-label", "ملاحظة " + person.name);
                noteCell.appendChild(field);
                tr.appendChild(nameCell);
                tr.appendChild(roleCell);
                tr.appendChild(statusCell);
                tr.appendChild(noteCell);
                tbody.appendChild(tr);
            });
            paintPrintLine();
        }

        tbody.addEventListener("change", function (event) {
            var input = event.target;
            if (!input || input.type !== "radio") {
                return;
            }
            var personId = input.name.replace("roll-", "");
            var draft = dayDraft(currentIso);
            if (!draft.rows[personId]) {
                draft.rows[personId] = blankRow();
            }
            draft.rows[personId].status = input.value;
            draft.adopted = false;
            var row = input.closest("tr");
            row.className = "is-" + input.value;
            var field = row.querySelector(".roll-note");
            field.hidden = input.value !== "late" && input.value !== "mission";
            paintPrintLine();
        });
        tbody.addEventListener("input", function (event) {
            var field = event.target;
            if (!field || !field.classList.contains("roll-note")) {
                return;
            }
            var row = field.closest("tr");
            var input = row.querySelector("input[type='radio']:checked");
            if (!input) {
                return;
            }
            var draft = dayDraft(currentIso);
            draft.rows[input.name.replace("roll-", "")].note = field.value;
            draft.adopted = false;
            paintPrintLine();
        });
        pane.querySelector("#roll-search").addEventListener("input", function (event) {
            query = event.target.value.trim();
            render();
        });
        pane.querySelector(".roll-filters").addEventListener("click", function (event) {
            var button = event.target.closest ? event.target.closest("[data-roll-filter]") : null;
            if (!button) {
                return;
            }
            group = button.getAttribute("data-roll-filter");
            Array.prototype.forEach.call(pane.querySelectorAll("[data-roll-filter]"), function (item) {
                item.classList.toggle("is-on", item === button);
            });
            render();
        });
        function applyDate() {
            var iso = readIso();
            if (!iso || iso === currentIso) {
                return;
            }
            currentIso = iso;
            note.textContent = "";
            render();
        }
        pane.addEventListener("change", function (event) {
            if (event.target === greg || event.target === hijri || event.target.classList.contains("date-picker-native")) {
                window.setTimeout(applyDate, 0);
            }
        });
        if (paintAttendance.onHijri) {
            document.removeEventListener("click", paintAttendance.onHijri);
        }
        paintAttendance.onHijri = function (event) {
            var day = event.target.closest ? event.target.closest("[data-hijri-day]") : null;
            if (!day || !hijri.isConnected) {
                return;
            }
            window.setTimeout(applyDate, 0);
        };
        document.addEventListener("click", paintAttendance.onHijri);
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var iso = readIso();
            if (!iso) {
                note.textContent = "اختر تاريخ السجل.";
                return;
            }
            currentIso = iso;
            var draft = dayDraft(iso);
            var rows = {};
            staffDirectory.forEach(function (person) {
                var item = draft.rows[person.id] || blankRow();
                rows[person.id] = { status: item.status, note: item.note.trim() };
            });
            var store = readStore("board1059.attendance") || {};
            store[iso] = { adopted: true, rows: rows };
            localStorage.setItem("board1059.attendance", JSON.stringify(store));
            refreshLinked();
            draft.rows = rows;
            draft.adopted = true;
            note.textContent = "اعتُمد سجل اليوم.";
            paintPrintLine();
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            delete drafts[currentIso];
            note.textContent = "";
            render();
        });
        printBtn.addEventListener("click", function () {
            var draft = dayDraft(currentIso);
            var statusLabel = {
                present: "حاضر",
                late: "متأخر",
                absent: "غائب",
                mission: "مستأذن"
            };
            var rows = (staffDirectory || []).map(function (person) {
                var item = (draft.rows && draft.rows[person.id]) || {};
                return [
                    person.name || person.id || "",
                    person.role || "",
                    statusLabel[item.status] || item.status || "—",
                    item.note || ""
                ];
            });
            if (window.PrintTemplates && typeof window.PrintTemplates.renderTable === "function") {
                var html = window.PrintTemplates.renderTable({
                    title: "سجل دوام المنسوبين",
                    orientation: "landscape",
                    note: currentIso ? ("تاريخ السجل: " + currentIso) : "",
                    columns: ["الاسم", "الدور", "الحالة", "ملاحظة"],
                    rows: rows,
                    signoff: true
                });
                window.PrintTemplates.openAndPrint(html, "print-tpl-table", { orientation: "landscape" });
                return;
            }
            if (window.openPrintPreview) {
                window.openPrintPreview("print-roll");
            }
        });
        if (!paintAttendance.printBound) {
            paintAttendance.printBound = true;
        }
        render();
    }

    function paintAbsence(pane) {
        var statuses = [
            { id: "present", label: "حاضر" },
            { id: "late", label: "متأخر" },
            { id: "absent", label: "غائب" },
            { id: "mission", label: "مستأذن" }
        ];
        var drafts = {};
        var currentIso = todayIso();
        var query = "";
        var classFilter = "all";
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<form id=\"absence-form\">"
            + "<h1>سجل غياب وتأخر الطلاب</h1>"
            + "<p class=\"wash-hint\">الأسماء من سجل الطلاب المستورد. الحاضر هو الأصل، والملاحظة تُكتب عند التأخر أو الاستئذان.</p>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card board-span\">"
            + "<h2>لوحة اليوم</h2>"
            + "<div class=\"roll-toolbar\">"
            + "<div class=\"wash-field dual-date-block roll-dates\"><span>تاريخ السجل</span><span class=\"dual-date-pair\">"
            + "<label><b>هجري</b><input class=\"doc-hijri\" id=\"absence-hijri\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 17 ربيع الأول 1448هـ\" autocomplete=\"off\"></label>"
            + "<label><b>ميلادي</b><input class=\"doc-date-picker\" id=\"absence-gregorian\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 30 أغسطس 2026م\" autocomplete=\"off\"></label>"
            + "</span></div>"
            + "<label class=\"roll-search-label\"><span>بحث بالاسم</span><input id=\"absence-search\" type=\"search\" placeholder=\"اسم الطالب\" autocomplete=\"off\"></label>"
            + "<label class=\"roll-search-label\"><span>الصف والفصل</span><select id=\"absence-class\"><option value=\"all\">الكل</option></select></label>"
            + "</div>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<h2>جدول الغياب والتأخر</h2>"
            + "<p class=\"roll-print-line\" id=\"absence-print-line\"></p>"
            + "<table class=\"staff-table roll-table\">"
            + "<thead><tr><th>اسم الطالب</th><th>الصف والفصل</th><th>حالة الحضور</th><th>ملاحظة</th></tr></thead>"
            + "<tbody id=\"absence-rows\"></tbody>"
            + "</table>"
            + "</section>"
            + "</div>"
            + actionsHtml("اعتماد سجل اليوم", "facility-actions")
            + "</form>"
        );
        var form = pane.querySelector("#absence-form");
        mountDocumentWitness(form, "سجل غياب");
        var greg = pane.querySelector("#absence-gregorian");
        var hijri = pane.querySelector("#absence-hijri");
        var tbody = pane.querySelector("#absence-rows");
        var classSelect = pane.querySelector("#absence-class");
        var note = form.querySelector(".wash-note");
        var printLine = pane.querySelector("#absence-print-line");
        var actions = form.querySelector(".wash-actions");
        var printBtn = document.createElement("button");
        printBtn.type = "button";
        printBtn.className = "wash-print";
        printBtn.textContent = "طباعة التقرير";
        actions.insertBefore(printBtn, actions.querySelector(".wash-cancel"));
        greg.value = gregorianFromDate(currentIso);
        hijri.value = hijriFromDate(currentIso);
        syncHijriGregorianDates(greg, hijri);

        function students() {
            if (typeof loadStudents !== "function") {
                return [];
            }
            return loadStudents().filter(function (student) {
                return student && student.student_name && student.student_nid;
            });
        }

        function classKey(student) {
            return (student.grade || "") + "|" + (student.section || "");
        }

        function classLabel(student) {
            var parts = [student.grade, student.section].filter(Boolean);
            return parts.length ? parts.join(" / ") : "دون صف";
        }

        var seen = {};
        students().forEach(function (student) {
            var key = classKey(student);
            if (seen[key]) {
                return;
            }
            seen[key] = true;
            var option = document.createElement("option");
            option.value = key;
            option.textContent = classLabel(student);
            classSelect.appendChild(option);
        });

        function blankRow() {
            return { status: "present", note: "" };
        }

        function dayDraft(iso) {
            if (drafts[iso]) {
                return drafts[iso];
            }
            var store = readStore("board1059.studentAbsence") || {};
            var saved = store[iso] || {};
            var rows = {};
            students().forEach(function (student) {
                var item = saved.rows && saved.rows[student.student_nid];
                var status = item && item.status;
                if (status !== "present" && status !== "late" && status !== "absent" && status !== "mission") {
                    status = "present";
                }
                rows[student.student_nid] = { status: status, note: item && item.note ? item.note : "" };
            });
            drafts[iso] = { rows: rows, adopted: !!saved.adopted };
            return drafts[iso];
        }

        function readIso() {
            return isoFromGregorianText(greg.value) || isoFromHijriText(hijri.value) || "";
        }

        function matches(student) {
            if (classFilter !== "all" && classKey(student) !== classFilter) {
                return false;
            }
            return !query || student.student_name.indexOf(query) !== -1;
        }

        function paintPrintLine() {
            var draft = dayDraft(currentIso);
            var school = document.getElementById("command-school-name");
            printLine.textContent = (school ? school.textContent : "") + " — سجل غياب وتأخر الطلاب — " + hijri.value + " — " + greg.value + " — " + (draft.adopted ? "سجل معتمد" : "لم يُعتمد بعد");
        }

        function render() {
            var draft = dayDraft(currentIso);
            var list = students();
            tbody.innerHTML = "";
            if (!list.length) {
                var missing = document.createElement("tr");
                var missingCell = document.createElement("td");
                missingCell.colSpan = 4;
                missingCell.className = "staff-empty";
                missingCell.textContent = "لا طلاب في السجل. يُستوردون من نور، ولا يُخترع اسم.";
                missing.appendChild(missingCell);
                tbody.appendChild(missing);
                paintPrintLine();
                return;
            }
            var shown = list.filter(matches);
            if (!shown.length) {
                var empty = document.createElement("tr");
                var cell = document.createElement("td");
                cell.colSpan = 4;
                cell.className = "staff-empty";
                cell.textContent = "لا طلاب في هذا التصفية.";
                empty.appendChild(cell);
                tbody.appendChild(empty);
                paintPrintLine();
                return;
            }
            shown.forEach(function (student) {
                var record = draft.rows[student.student_nid] || blankRow();
                draft.rows[student.student_nid] = record;
                var tr = document.createElement("tr");
                tr.className = "is-" + record.status;
                var nameCell = document.createElement("td");
                nameCell.textContent = student.student_name;
                var classCell = document.createElement("td");
                classCell.textContent = classLabel(student);
                var statusCell = document.createElement("td");
                var pills = document.createElement("div");
                pills.className = "roll-pills";
                pills.setAttribute("role", "radiogroup");
                pills.setAttribute("aria-label", "حالة " + student.student_name);
                statuses.forEach(function (item) {
                    var label = document.createElement("label");
                    label.className = "roll-pill is-" + item.id;
                    var input = document.createElement("input");
                    input.type = "radio";
                    input.name = "absence-" + student.student_nid;
                    input.value = item.id;
                    input.checked = record.status === item.id;
                    var caption = document.createElement("span");
                    caption.textContent = item.label;
                    label.appendChild(input);
                    label.appendChild(caption);
                    pills.appendChild(label);
                });
                statusCell.appendChild(pills);
                var noteCell = document.createElement("td");
                var field = document.createElement("input");
                field.type = "text";
                field.className = "roll-note";
                field.value = record.note;
                field.placeholder = "وقت التأخر أو العذر";
                field.hidden = record.status !== "late" && record.status !== "mission";
                field.setAttribute("aria-label", "ملاحظة " + student.student_name);
                noteCell.appendChild(field);
                tr.appendChild(nameCell);
                tr.appendChild(classCell);
                tr.appendChild(statusCell);
                tr.appendChild(noteCell);
                tbody.appendChild(tr);
            });
            paintPrintLine();
        }

        tbody.addEventListener("change", function (event) {
            var input = event.target;
            if (!input || input.type !== "radio") {
                return;
            }
            var studentId = input.name.replace("absence-", "");
            var draft = dayDraft(currentIso);
            if (!draft.rows[studentId]) {
                draft.rows[studentId] = blankRow();
            }
            draft.rows[studentId].status = input.value;
            draft.adopted = false;
            var row = input.closest("tr");
            row.className = "is-" + input.value;
            var field = row.querySelector(".roll-note");
            field.hidden = input.value !== "late" && input.value !== "mission";
            paintPrintLine();
        });
        tbody.addEventListener("input", function (event) {
            var field = event.target;
            if (!field || !field.classList.contains("roll-note")) {
                return;
            }
            var row = field.closest("tr");
            var input = row.querySelector("input[type='radio']:checked");
            if (!input) {
                return;
            }
            var draft = dayDraft(currentIso);
            draft.rows[input.name.replace("absence-", "")].note = field.value;
            draft.adopted = false;
            paintPrintLine();
        });
        pane.querySelector("#absence-search").addEventListener("input", function (event) {
            query = event.target.value.trim();
            render();
        });
        classSelect.addEventListener("change", function () {
            classFilter = classSelect.value;
            render();
        });
        function applyDate() {
            var iso = readIso();
            if (!iso || iso === currentIso) {
                return;
            }
            currentIso = iso;
            note.textContent = "";
            render();
        }
        pane.addEventListener("change", function (event) {
            if (event.target === greg || event.target === hijri || event.target.classList.contains("date-picker-native")) {
                window.setTimeout(applyDate, 0);
            }
        });
        if (paintAbsence.onHijri) {
            document.removeEventListener("click", paintAbsence.onHijri);
        }
        paintAbsence.onHijri = function (event) {
            var day = event.target.closest ? event.target.closest("[data-hijri-day]") : null;
            if (!day || !hijri.isConnected) {
                return;
            }
            window.setTimeout(applyDate, 0);
        };
        document.addEventListener("click", paintAbsence.onHijri);
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var list = students();
            var iso = readIso();
            if (!list.length) {
                note.textContent = "لا طلاب للاعتماد. استوردهم من نور أولًا.";
                return;
            }
            if (!iso) {
                note.textContent = "اختر تاريخ السجل.";
                return;
            }
            currentIso = iso;
            var draft = dayDraft(iso);
            var rows = {};
            list.forEach(function (student) {
                var item = draft.rows[student.student_nid] || blankRow();
                rows[student.student_nid] = { status: item.status, note: item.note.trim() };
            });
            var store = readStore("board1059.studentAbsence") || {};
            store[iso] = { adopted: true, rows: rows };
            localStorage.setItem("board1059.studentAbsence", JSON.stringify(store));
            refreshLinked();
            draft.rows = rows;
            draft.adopted = true;
            note.textContent = "اعتُمد سجل اليوم.";
            paintPrintLine();
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            delete drafts[currentIso];
            note.textContent = "";
            render();
        });
        printBtn.addEventListener("click", function () {
            if (window.openPrintPreview) {
                window.openPrintPreview("print-roll");
            }
        });
        if (!paintAbsence.printBound) {
            paintAbsence.printBound = true;
        }
        render();
    }

    function paintCouncils(pane) {
        var councils = [
            {
                id: "admin",
                label: "اللجنة الإدارية",
                suggest: "يُقترح المدير والوكلاء والموجه الطلابي ورائد النشاط والمعلمون والمساعد الإداري. الاجتماع شهري.",
                topics: ["مناقشة الخطة التشغيلية وإقرارها", "متابعة تنفيذ الخطة ومؤشرات الأداء", "مناقشة تقارير التحصيل ونواتج التعلم", "توزيع الموارد المالية والتقارير المالية", "مناقشة الجوانب التطويرية للمدرسة", "مناقشة التحديات التي تواجه أهداف المدرسة", "الاستعداد للعام القادم واحتياجات الموارد", "مناقشة القضايا والظواهر السلوكية", "إقرار الأنشطة والفعاليات السنوية", "إقرار الشراكات الداعمة لبرامج المدرسة", "مراجعة تقارير الشراكة المجتمعية"]
            },
            {
                id: "guidance",
                label: "لجنة التوجيه والإرشاد",
                suggest: "يُقترح وكيل شؤون الطلاب ووكيل الشؤون التعليمية والمعلمون والموجه الطلابي. الاجتماع شهري.",
                topics: ["متابعة الخطة السنوية للإرشاد الطلابي", "متابعة قواعد السلوك والمواظبة", "توزيع الطلاب على الفصول", "دراسة الحصص العلاجية والإثرائية", "دراسة سلوك الطلاب ومواظبتهم", "متابعة مجالس الحوار الطلابية", "التقارير الفصلية للتوجيه والإرشاد", "دراسة المخالفين لإجراءات الاختبارات", "دراسة أعذار الغائبين عن الاختبارات", "حالات الحد الأدنى والتأخر الدراسي", "متابعة برامج رعاية الطلاب"]
            },
            {
                id: "achievement",
                label: "لجنة التحصيل الدراسي",
                suggest: "يُقترح المدير والوكلاء والموجه الطلابي ورائد النشاط والمعلمون. اجتماعان في كل فصل على الأقل.",
                topics: ["متابعة المستوى التحصيلي وتحليل النتائج", "مراجعة نتائج الاختبارات الوطنية", "اقتراح برامج رفع التحصيل", "تهيئة الاختبارات الوطنية والدولية", "إعداد جدول الاختبارات", "الإشراف على سير الاختبارات", "متابعة التصحيح والرصد", "برامج معالجة التأخر الدراسي", "إشراك أولياء الأمور في معالجة ضعف التحصيل"]
            },
            {
                id: "excellence",
                label: "لجنة التميز",
                suggest: "يُقترح المدير والوكلاء والموجه الطلابي ورائد النشاط والمعلمون. الاجتماع شهري.",
                topics: ["إعداد الخطة التشغيلية وربطها بمؤشرات الأداء", "تبادل الممارسات ورفع التحصيل", "استطلاع المستفيدين وتحليل نتائجه", "رصد اتجاهات الطلاب نحو المدرسة", "دراسة بيئة المدرسة", "الإشراف على التقويم الذاتي", "دراسة تقارير تقويم الأداء المؤسسي", "ترشيح المدرسة ومنسوبيها لجوائز التميز"]
            },
            {
                id: "fund",
                label: "فريق الصندوق المدرسي",
                suggest: "يُقترح وكيل الشؤون المدرسية والموجه الطلابي ورائد النشاط ومعلم والمساعد الإداري. الاجتماع شهري، ويرتبط باللجنة الإدارية.",
                topics: ["إعداد الميزانية التشغيلية", "الصرف من الميزانية وفق البنود", "مراقبة الصرف وتوثيق المستندات", "مراجعة التقارير الدورية للميزانية", "إعداد التقرير المالي الختامي", "تنمية موارد المدرسة", "حصر التبرعات وتوثيقها"]
            },
            {
                id: "safety",
                label: "فريق الأمن والسلامة المدرسية",
                suggest: "يُقترح وكيل الشؤون المدرسية والموجه الطلابي والموجه الصحي ومعلمون. الاجتماع شهري.",
                topics: ["تنفيذ برامج الأمن والسلامة", "تقويم وضع الأمن والسلامة", "التدريب على خطة الإخلاء", "احتياجات أجهزة الأمن والسلامة", "متابعة عمل الحارس", "تنظيم دخول الزوار", "مراجعة سجل الأمن والسلامة"]
            },
            {
                id: "activity",
                label: "لجنة النشاط والمناسبات",
                suggest: "يُقترح رائد النشاط ووكيل شؤون الطلاب والمعلمون. الاجتماع بحسب خطة النشاط.",
                topics: ["اعتماد البرنامج الأسبوعي للنشاط", "متابعة شواهد التنفيذ للفعاليات", "تنظيم المناسبات الوطنية والمدرسية", "توثيق برامج النشاط في السجل"]
            },
            {
                id: "discipline",
                label: "لجنة الانضباط والتدخل السريع",
                suggest: "يُقترح وكيل شؤون الطلاب والموجه الطلابي والمعلمون. تُعقد عند الحاجة العاجلة.",
                topics: ["مراجعة حالات الغياب والتأخر", "دراسة حالة سلوكية محالة", "متابعة تنفيذ التعهدات", "خفض المخالفات وفق التدرج المعتمد"]
            },
            {
                id: "special",
                label: "فريق التربية الخاصة",
                suggest: "يُقترح وكيل شؤون الطلاب والموجه الطلابي ومعلم التربية الخاصة. يُشكّل عند وجود برنامج تربية خاصة.",
                topics: ["المشاركة في القياس والتشخيص", "تحديد المكان التربوي المناسب", "تقويم البرنامج التربوي الفردي", "متابعة صعوبات التعلم", "تدريب منسوبي المدرسة على التربية الخاصة"]
            }
        ];
        var currentId = "";
        var touched = false;
        var formationCache = { formations: {}, committees: [] };
        var evidenceItems = [];
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<form id=\"council-form\">"
            + "<div class=\"council-title-row\">"
            + "<h1>سجل المجالس المدرسية</h1>"
            + "<button type=\"button\" class=\"people-tool\" id=\"council-new-top\">محضر جديد</button>"
            + "</div>"
            + "<p class=\"wash-hint\">محضر حكومي رسمي من ثلاث صفحات: الصياغة الذكية، وكشف الحضور والتوقيعات، وتوثيق الصور. الأعضاء من تشكيل اللجنة المحفوظ عند توافره.</p>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card board-span\">"
            + "<h2>بيانات المجلس والاجتماع</h2>"
            + "<div class=\"council-meta\">"
            + "<label class=\"wash-field\"><span>نوع المجلس</span><select id=\"council-type\"></select></label>"
            + "<div class=\"wash-field dual-date-block roll-dates\"><span>تاريخ الاجتماع</span><span class=\"dual-date-pair\">"
            + "<label><b>هجري</b><input class=\"doc-hijri\" id=\"council-hijri\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 17 ربيع الأول 1448هـ\" autocomplete=\"off\"></label>"
            + "<label><b>ميلادي</b><input class=\"doc-date-picker\" id=\"council-gregorian\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 30 أغسطس 2026م\" autocomplete=\"off\"></label>"
            + "</span></div>"
            + "<label class=\"wash-field is-wide\"><span>موضوع الاجتماع / جدول الأعمال</span><select id=\"council-agenda\"></select></label>"
            + "<label class=\"wash-field is-wide\"><span>موضوع حر (اختياري)</span><input id=\"council-agenda-free\" type=\"text\" placeholder=\"إن تُرك فارغًا يُعتمد الموضوع من القائمة\" autocomplete=\"off\"></label>"
            + "<p class=\"wash-hint\" id=\"council-register-hint\"></p>"
            + "</div>"
            + "<div id=\"council-saved\" class=\"council-saved\" aria-live=\"polite\"></div>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<h2>الأعضاء والحضور</h2>"
            + "<p class=\"wash-hint\" id=\"council-suggest\"></p>"
            + "<div class=\"people-toolbar\"><span id=\"council-present-count\">الحضور: 0</span>"
            + "<button type=\"button\" class=\"people-tool\" id=\"council-pick-formation\">أعضاء التشكيل</button>"
            + "<button type=\"button\" class=\"people-tool\" id=\"council-pick-suggest\">اختيار المقترحين</button>"
            + "<button type=\"button\" class=\"people-tool\" id=\"council-clear-people\">مسح الحضور</button></div>"
            + "<ul class=\"council-list people-board\" id=\"council-people\"></ul>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<h2>القرارات والتوصيات</h2>"
            + "<label class=\"wash-field is-wide\"><span>القرار</span><select id=\"council-decision-pick\"></select></label>"
            + "<label class=\"wash-field is-wide\"><span>نص القرارات</span><textarea id=\"council-decisions\" rows=\"4\" placeholder=\"يمكن تعديل نص القرارات قبل الحفظ والطباعة\"></textarea></label>"
            + "<label class=\"wash-field is-wide\"><span>ملاحظات إضافية</span><textarea id=\"council-extra\" rows=\"2\" placeholder=\"اختياري\"></textarea></label>"
            + "<div class=\"wash-field dual-date-block roll-dates\"><span>تاريخ المتابعة / التنفيذ</span><span class=\"dual-date-pair\">"
            + "<label><b>هجري</b><input class=\"doc-hijri\" id=\"follow-hijri\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 17 ربيع الأول 1448هـ\" autocomplete=\"off\"></label>"
            + "<label><b>ميلادي</b><input class=\"doc-date-picker\" id=\"follow-gregorian\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 30 أغسطس 2026م\" autocomplete=\"off\"></label>"
            + "</span></div>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<h2>نص المحضر</h2>"
            + "<p class=\"wash-hint\">يُصاغ تلقائيًا ويمكنك تعديله كلمةً بكلمة قبل الحفظ والطباعة.</p>"
            + "<label class=\"wash-field is-wide\"><span>نص المحضر</span><textarea id=\"council-minutes-edit\" class=\"council-minutes-edit\" rows=\"12\" placeholder=\"نص المحضر الرسمي\"></textarea></label>"
            + "<div class=\"people-toolbar\"><button type=\"button\" class=\"people-tool\" id=\"council-redraft\">إعادة الصياغة من الحقول</button></div>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<h2>توثيق الاجتماع بالصور</h2>"
            + "<p class=\"wash-hint\">رفع أو كاميرا أو رابط — يظهر في الصفحة الثالثة من المحضر.</p>"
            + "<div id=\"council-evidence-host\"></div>"
            + "</section>"
            + "</div>"
            + actionsHtml("حفظ المحضر", "facility-actions")
            + "</form>"
            + "<section class=\"council-sheet\" id=\"council-sheet\"></section>"
        );
        var form = pane.querySelector("#council-form");
        // المحضر الرسمي يُطبع عبر المحرك الثلاثي — لا مسار الشاهد القديم
        Array.prototype.forEach.call(form.querySelectorAll(".evidence-field"), function (node) {
            node.remove();
        });
        var typeSelect = pane.querySelector("#council-type");
        var greg = pane.querySelector("#council-gregorian");
        var hijri = pane.querySelector("#council-hijri");
        var followGreg = pane.querySelector("#follow-gregorian");
        var followHijri = pane.querySelector("#follow-hijri");
        var agenda = pane.querySelector("#council-agenda");
        var agendaFree = pane.querySelector("#council-agenda-free");
        var decisionPick = pane.querySelector("#council-decision-pick");
        var decisionsField = pane.querySelector("#council-decisions");
        var extra = pane.querySelector("#council-extra");
        var minutesEdit = pane.querySelector("#council-minutes-edit");
        var list = pane.querySelector("#council-people");
        var savedHost = pane.querySelector("#council-saved");
        var suggest = pane.querySelector("#council-suggest");
        var registerHint = pane.querySelector("#council-register-hint");
        var evidenceHost = pane.querySelector("#council-evidence-host");
        var note = form.querySelector(".wash-note");
        var sheet = pane.querySelector("#council-sheet");
        var actions = form.querySelector(".wash-actions");
        var minutesDirty = false;
        var decisionsDirty = false;
        var printBtn = document.createElement("button");
        printBtn.type = "button";
        printBtn.className = "wash-print";
        printBtn.textContent = "طباعة المحضر (3 صفحات)";
        actions.insertBefore(printBtn, actions.querySelector(".wash-cancel"));
        var previewBtn = document.createElement("button");
        previewBtn.type = "button";
        previewBtn.className = "wash-print";
        previewBtn.textContent = "معاينة المحضر";
        actions.insertBefore(previewBtn, printBtn);
        councils.forEach(function (item) {
            var option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.label;
            typeSelect.appendChild(option);
        });
        fillPeopleBoard(list, staffDirectory);
        syncHijriGregorianDates(greg, hijri);
        syncHijriGregorianDates(followGreg, followHijri);

        function engine() {
            return window.councilMinutesEngine || null;
        }

        function activeAgenda() {
            var free = agendaFree && agendaFree.value.trim();
            return free || (agenda.value || "").trim();
        }

        function schoolName() {
            var school = document.getElementById("command-school-name");
            if (window.IdentityBind && IdentityBind.current && IdentityBind.current()) {
                return IdentityBind.current();
            }
            return school && school.textContent ? school.textContent.trim() : "متوسطة سعد بن الربيع الأنصاري";
        }

        function currentSeats() {
            if (!engine()) {
                return [];
            }
            return engine().resolveSeats(typeSelect.value, formationCache.formations, formationCache.committees);
        }

        function draftContext() {
            var iso = isoFromGregorianText(greg.value) || isoFromHijriText(hijri.value) || "";
            return {
                type: typeSelect.value,
                school: schoolName(),
                hijri: hijri.value,
                gregorian: greg.value,
                iso: iso,
                agenda: activeAgenda(),
                decisions: (decisionsField && decisionsField.value.trim()) || "",
                addition: extra.value.trim(),
                present: checkedPeople(),
                seats: currentSeats(),
                followHijri: followHijri.value,
                followGregorian: followGreg.value,
                evidenceItems: evidenceItems
            };
        }

        function paintRegisterHint() {
            if (!registerHint || !engine()) {
                return;
            }
            var profile = engine().profileFor(typeSelect.value);
            registerHint.textContent = "يُحفظ المحضر ويرتبط بـ: " + profile.registerLabel;
        }

        function ensureCouncilKey() {
            if (!currentId) {
                currentId = "council-" + String(Date.now());
            }
            return currentId;
        }

        function paintEvidencePanel() {
            if (!evidenceHost || !window.board1059VisualEvidence) {
                return;
            }
            var key = ensureCouncilKey();
            evidenceHost.innerHTML = window.board1059VisualEvidence.panelHtml({
                entityType: "council_minutes",
                entityKey: key,
                registerKey: engine() ? engine().profileFor(typeSelect.value).registerKey : "councils",
                items: evidenceItems
            });
            evidenceHost.setAttribute("data-council-ve", "1");
        }

        function loadEvidence(key) {
            evidenceItems = [];
            if (!key || key === "draft") {
                paintEvidencePanel();
                return Promise.resolve([]);
            }
            return fetch("/api/visual-evidence?entity_type=council_minutes&entity_key=" + encodeURIComponent(key))
                .then(function (response) { return response.json(); })
                .then(function (payload) {
                    evidenceItems = (payload && payload.items) || [];
                    paintEvidencePanel();
                    return evidenceItems;
                })
                .catch(function () {
                    paintEvidencePanel();
                    return [];
                });
        }

        function onCouncilEvidenceChanged(items) {
            evidenceItems = Array.isArray(items) ? items : [];
            paintEvidencePanel();
            if (note) {
                note.textContent = "حُفظ المرفق البصري مع المحضر.";
            }
        }
        pane._onCouncilEvidenceChanged = onCouncilEvidenceChanged;

        function typeLabel(id) {
            var found = councils.filter(function (item) { return item.id === id; })[0];
            if (found) {
                return found.label;
            }
            if (id === "teachers") {
                return "مجلس المعلمين";
            }
            return "";
        }

        function councilById(id) {
            return councils.filter(function (item) { return item.id === id; })[0] || null;
        }

        function fillAgenda(selected) {
            var council = councilById(typeSelect.value);
            var topics = council ? council.topics.slice() : [];
            agenda.innerHTML = "";
            if (selected && topics.indexOf(selected) === -1) {
                topics.unshift(selected);
            }
            topics.forEach(function (topic) {
                var option = document.createElement("option");
                option.value = topic;
                option.textContent = topic;
                agenda.appendChild(option);
            });
            if (selected) {
                agenda.value = selected;
            }
            fillDecisionPick();
            paintDecree();
            paintRegisterHint();
        }

        function fillDecisionPick() {
            if (!decisionPick) {
                return;
            }
            var topic = activeAgenda();
            var preset = decreeActs[topic] || "";
            decisionPick.innerHTML = "";
            var blank = document.createElement("option");
            blank.value = "";
            blank.textContent = "— اختر قرارًا مقترحًا أو اكتب حرًا —";
            decisionPick.appendChild(blank);
            if (preset) {
                var option = document.createElement("option");
                option.value = preset;
                option.textContent = preset.slice(0, 90) + (preset.length > 90 ? "…" : "");
                decisionPick.appendChild(option);
            }
            Object.keys(decreeActs).forEach(function (key) {
                if (key === topic) {
                    return;
                }
                var opt = document.createElement("option");
                opt.value = decreeActs[key];
                opt.textContent = key;
                decisionPick.appendChild(opt);
            });
            syncDecisionPreset(false);
        }

        var decreeActs = {
            "مناقشة الخطة التشغيلية وإقرارها": "قررت اللجنة إقرار الخطة التشغيلية واعتمادها مرجعًا لأعمال المدرسة، وتكليف أصحاب المهام بمتابعتها وفق المؤشرات المحفوظة.",
            "متابعة تنفيذ الخطة ومؤشرات الأداء": "اطلعت اللجنة على سير الخطة ومؤشرات الأداء، وأوصت بسد ما ظهر من فجوة وفق الشواهد المحفوظة، ورفع المتبقي إلى الرئيس.",
            "مناقشة تقارير التحصيل ونواتج التعلم": "ناقشت اللجنة تقارير التحصيل ونواتج التعلم، وأوصت بمعالجة مواضع الضعف بالخطط المعتمدة، من غير زيادة على الأرقام المحفوظة.",
            "توزيع الموارد المالية والتقارير المالية": "نظرت اللجنة في توزيع الموارد والتقارير المالية، وقررت الالتزام بالبنود المعتمدة ورفع ما جاوز الضابط إلى الجهة المختصة.",
            "مناقشة الجوانب التطويرية للمدرسة": "ناقشت اللجنة الجوانب التطويرية، وأوصت بترتيب الأولويات وفق حاجة المدرسة المحفوظة، وتكليف المختصين بإعداد ما يلزم.",
            "مناقشة التحديات التي تواجه أهداف المدرسة": "وقفت اللجنة على التحديات التي تعترض أهداف المدرسة، وقررت رفع ما تعذر علاجه إلى إدارة التعليم، ومتابعة الممكن منها داخل المدرسة.",
            "الاستعداد للعام القادم واحتياجات الموارد": "استعرضت اللجنة الاستعداد للعام القادم، وقررت حصر الاحتياجات البشرية والمادية ورفعها في وقتها عبر القنوات المعتمدة.",
            "مناقشة القضايا والظواهر السلوكية": "ناقشت اللجنة القضايا والظواهر السلوكية، وأوصت بمعالجتها وفق قواعد السلوك والمواظبة، وبالتنسيق مع لجنة التوجيه والإرشاد.",
            "إقرار الأنشطة والفعاليات السنوية": "أقرت اللجنة الأنشطة والفعاليات السنوية، على أن تُنفذ بما يخدم رسالة المدرسة ويُوثق شاهدها في سجل النشاط.",
            "إقرار الشراكات الداعمة لبرامج المدرسة": "أقرت اللجنة الشراكات الداعمة، بشرط موافقتها للأنظمة والتعليمات، وأن يُرفع كل اتفاق قبل البدء في تنفيذه.",
            "مراجعة تقارير الشراكة المجتمعية": "راجعت اللجنة تقارير الشراكة المجتمعية، وأوصت باستمرار النافع منها وتصحيح ما ضعف أثره.",
            "متابعة الخطة السنوية للإرشاد الطلابي": "قررت اللجنة اعتماد الخطة السنوية للإرشاد وتوزيع أسابيعها وفق التعاميم المنظمة، ومتابعة تنفيذها مع الموجه الطلابي.",
            "متابعة قواعد السلوك والمواظبة": "أوصت اللجنة بالالتزام بقواعد السلوك والمواظبة، وإبراز الحوافز المحفوظة، من غير استحداث بند لم يُعتمد.",
            "توزيع الطلاب على الفصول": "قررت اللجنة توزيع الطلاب على الفصول في مطلع العام وفق الطاقة والإمكان، ورفع التشكيل إلى مدير المدرسة.",
            "دراسة الحصص العلاجية والإثرائية": "درست اللجنة الحصص العلاجية والإثرائية، وأوصت بتنسيقها مع لجنة التحصيل بحيث تكتمل الأنصبة ولا تختل خطة المدرسة.",
            "دراسة سلوك الطلاب ومواظبتهم": "درست اللجنة سلوك الطلاب ومواظبتهم، وأوصت بتعزيز السلوك الإيجابي ومعالجة السلوك السلبي وفق التدرج المعتمد.",
            "متابعة مجالس الحوار الطلابية": "اطلعت اللجنة على مجالس الحوار الطلابية، وأوصت بدعمها ورفع خلاصتها إلى إدارة المدرسة.",
            "التقارير الفصلية للتوجيه والإرشاد": "اعتمدت اللجنة التقارير الفصلية للتوجيه والإرشاد، تمهيدًا لرفعها بعد اعتماد مدير المدرسة.",
            "دراسة المخالفين لإجراءات الاختبارات": "درست اللجنة حالات المخالفة لإجراءات الاختبارات، وأقرت البرامج الإرشادية المناسبة لها.",
            "دراسة أعذار الغائبين عن الاختبارات": "درست اللجنة أعذار الغائبين عن الاختبارات، وقررت قبول العذر الموجب لدخول الاختبار البديل في مدته، ورد ما لم يوجبه.",
            "حالات الحد الأدنى والتأخر الدراسي": "نظرت اللجنة في حالات الحد الأدنى والتأخر الدراسي، وأوصت بالبرامج العلاجية المعتمدة وبالتنسيق مع لجنة التحصيل.",
            "متابعة برامج رعاية الطلاب": "تابعت اللجنة برامج الرعاية، وأوصت باستمرار دعم الطلاب المستحقين وتوثيق المتابعة في سجلها.",
            "متابعة المستوى التحصيلي وتحليل النتائج": "اطلعت اللجنة على المستوى التحصيلي، وقررت تحليل النتائج ورفع التقرير إلى مدير المدرسة لعرضه على اللجنة الإدارية.",
            "مراجعة نتائج الاختبارات الوطنية": "راجعت اللجنة نتائج الاختبارات الوطنية، وأوصت بتعزيز مواطن القوة ومعالجة مواطن الضعف وفق النتائج المحفوظة.",
            "اقتراح برامج رفع التحصيل": "أوصت اللجنة بإدراج برامج رفع التحصيل في خطة المدرسة، وقياس أثرها بعد التنفيذ.",
            "تهيئة الاختبارات الوطنية والدولية": "قررت اللجنة تهيئة الطلاب والمتطلبات قبل الاختبارات الوطنية والدولية، وتوعية الهيئة التعليمية بأسسها.",
            "إعداد جدول الاختبارات": "قررت اللجنة إعداد جدول الاختبارات وحفظ الملفات المتعلقة بها في مواضعها.",
            "الإشراف على سير الاختبارات": "قررت اللجنة الإشراف على سير الاختبارات وبرامجها، والتأكد من سلامة إجراءاتها.",
            "متابعة التصحيح والرصد": "أوصت اللجنة بمتابعة التصحيح والمراجعة والرصد، وحفظ النتائج وتسليمها وفق التنظيم.",
            "برامج معالجة التأخر الدراسي": "أوصت اللجنة ببرامج معالجة التأخر الدراسي واعتماد الحصص الإضافية لها، وتكليف المعلمين ضمن أنصبتهم.",
            "إشراك أولياء الأمور في معالجة ضعف التحصيل": "أوصت اللجنة بإشراك أولياء الأمور في معالجة ضعف التحصيل عبر القنوات المعتمدة.",
            "إعداد الخطة التشغيلية وربطها بمؤشرات الأداء": "قررت اللجنة إعداد الخطة التشغيلية وربطها بمؤشرات الأداء، ورفع توصيات التحسين الدورية.",
            "تبادل الممارسات ورفع التحصيل": "أوصت اللجنة بتبادل الممارسات بين المعلمين بما يرفع التحصيل، وتطوير طرق التدريس والتقويم.",
            "استطلاع المستفيدين وتحليل نتائجه": "قررت اللجنة إعداد استطلاع المستفيدين، عدا استطلاع التحصيل، وتحليل نتائجه ورفع التوصية.",
            "رصد اتجاهات الطلاب نحو المدرسة": "قررت اللجنة رصد اتجاهات الطلاب نحو المدرسة، ورفع التوصية إلى مدير المدرسة.",
            "دراسة بيئة المدرسة": "درست اللجنة بيئة المدرسة، وأوصت بما يحسنها وفق الممكن والمعتمد.",
            "الإشراف على التقويم الذاتي": "قررت اللجنة الإشراف على التقويم الذاتي والتوثيق الداخلي، وتحسينه وفق معايير التقويم والاعتماد.",
            "دراسة تقارير تقويم الأداء المؤسسي": "درست اللجنة تقارير تقويم الأداء المؤسسي، وأوصت باستثمار نتائجها في التخطيط.",
            "ترشيح المدرسة ومنسوبيها لجوائز التميز": "أوصت اللجنة بترشيح المدرسة ومنسوبيها لجوائز التميز، ورفع ذلك إلى اللجنة الإدارية.",
            "إعداد الميزانية التشغيلية": "أعد الفريق الميزانية التشغيلية بما فيها الإيرادات المتوقعة والمصروفات، وقرر عرضها على اللجنة الإدارية لإقرارها.",
            "الصرف من الميزانية وفق البنود": "قرر الفريق الصرف من الميزانية وفق البنود المعتمدة بعد إقرار اللجنة الإدارية.",
            "مراقبة الصرف وتوثيق المستندات": "قرر الفريق مراقبة الصرف وتوثيق مستنداته في السجل المخصص.",
            "مراجعة التقارير الدورية للميزانية": "راجع الفريق التقارير الدورية، وقرر رفعها إلى اللجنة الإدارية.",
            "إعداد التقرير المالي الختامي": "أعد الفريق التقرير المالي الختامي، وقرر رفعه إلى اللجنة الإدارية لإقراره.",
            "تنمية موارد المدرسة": "أوصى الفريق بتنمية موارد المدرسة وفق الأنظمة والتعليمات، وعرض ما يستجد على اللجنة الإدارية.",
            "حصر التبرعات وتوثيقها": "قرر الفريق حصر التبرعات وتوثيقها وفق الضوابط، ورفع التقرير المالي السنوي إلى إدارة التعليم.",
            "تنفيذ برامج الأمن والسلامة": "قرر الفريق تنفيذ البرامج المعتمدة للأمن والسلامة، ورفع تقرير التنفيذ إلى اللجنة الإدارية.",
            "تقويم وضع الأمن والسلامة": "قرر الفريق تقويم وضع الأمن والسلامة وفق الاستمارات والأدوات المعتمدة.",
            "التدريب على خطة الإخلاء": "قرر الفريق تدريب المنسوبين على خطة الإخلاء، والاستعانة بمختص للإسعافات عند الحاجة.",
            "احتياجات أجهزة الأمن والسلامة": "حصر الفريق احتياجات أجهزة السلامة، وقرر رفعها إلى اللجنة الإدارية.",
            "متابعة عمل الحارس": "قرر الفريق متابعة عمل الحارس والتأكد من انتظامه.",
            "تنظيم دخول الزوار": "قرر الفريق تنظيم دخول الزوار أثناء اليوم الدراسي وتوثيق ذلك.",
            "مراجعة سجل الأمن والسلامة": "راجع الفريق سجل الأمن والسلامة، وأوصى باستكمال النقص ورفعه إلى اللجنة الإدارية.",
            "المشاركة في القياس والتشخيص": "شارك الفريق في إجراءات القياس والتشخيص، وأوصى بتوثيق النتيجة في ملف الطالب.",
            "تحديد المكان التربوي المناسب": "أوصى الفريق بالمكان التربوي المناسب بناء على نتيجة القياس، ورفع التوصية إلى إدارة المدرسة.",
            "تقويم البرنامج التربوي الفردي": "قوّم الفريق البرنامج التربوي الفردي، وأوصى بتعديله عند الحاجة ومتابعة تنفيذه.",
            "متابعة صعوبات التعلم": "تابع الفريق مستوى الطلاب ذوي صعوبات التعلم، وأوصى باستمرار الدعم وتوثيقه.",
            "تدريب منسوبي المدرسة على التربية الخاصة": "أوصى الفريق بتدريب منسوبي المدرسة على التعامل مع طلاب التربية الخاصة وفق اللوائح.",
            "اعتماد البرنامج الأسبوعي للنشاط": "أقرت اللجنة البرنامج الأسبوعي للنشاط وفق الخطة المعتمدة، وتكليف رائد النشاط بتوثيق الشواهد.",
            "متابعة شواهد التنفيذ للفعاليات": "اطلعت اللجنة على شواهد التنفيذ، وأوصت باستكمال الناقص منها قبل الإغلاق.",
            "تنظيم المناسبات الوطنية والمدرسية": "قررت اللجنة تنظيم المناسبات وفق التعاميم، ورفع جدول التنفيذ إلى إدارة المدرسة.",
            "توثيق برامج النشاط في السجل": "قررت اللجنة توثيق برامج النشاط في السجل المخصص وربطها بالخطة التشغيلية.",
            "مراجعة حالات الغياب والتأخر": "راجعت اللجنة حالات الغياب والتأخر، وقررت معالجتها وفق قواعد السلوك والمواظبة.",
            "دراسة حالة سلوكية محالة": "درست اللجنة الحالة المحالة، وأقرت الإجراء التربوي المناسب وفق التدرج المعتمد.",
            "متابعة تنفيذ التعهدات": "تابعت اللجنة تنفيذ التعهدات، وأوصت باستكمال ما تبقى ورفعه إلى مدير المدرسة.",
            "خفض المخالفات وفق التدرج المعتمد": "أوصت اللجنة بخفض المخالفات عبر التدرج التربوي المعتمد، وتوثيق المتابعة في السجل."
        };

        function composeDecree() {
            if (!engine()) {
                return "";
            }
            if (!activeAgenda()) {
                return "";
            }
            return engine().draftMinutes(draftContext());
        }

        function fullText() {
            if (minutesEdit && minutesEdit.value.trim()) {
                return minutesEdit.value.trim();
            }
            return composeDecree();
        }

        function paintDecree(force) {
            if (!minutesEdit) {
                return;
            }
            if (minutesDirty && !force) {
                return;
            }
            minutesEdit.value = composeDecree();
            minutesDirty = false;
        }

        function syncDecisionPreset(force) {
            if (!decisionsField) {
                return;
            }
            if (decisionsDirty && !force) {
                return;
            }
            var topic = activeAgenda();
            var preset = decreeActs[topic] || "";
            if (preset) {
                decisionsField.value = preset;
                if (decisionPick) {
                    decisionPick.value = preset;
                }
                decisionsDirty = false;
            }
        }

        function suggestedIds(type) {
            return staffDirectory.filter(function (person) {
                if (!person.active) {
                    return false;
                }
                var role = person.role;
                var director = role.indexOf("مدير") === 0;
                var vice = role.indexOf("وكيل") === 0;
                var eduVice = role.indexOf("التعليمية") !== -1;
                var stuVice = role.indexOf("الطلاب") !== -1;
                var schoolVice = role.indexOf("وكيل") === 0 && role.indexOf("المدرسية") !== -1;
                var teacher = role.indexOf("معلم") === 0;
                var counselor = role === "الموجه الطلابي";
                var health = role === "الموجه الصحي";
                var activity = role === "رائد النشاط";
                var assistant = role === "مساعد إداري";
                var specialTeacher = role === "معلم التربية خاصة" || role === "معلم التربية الخاصة";
                if (type === "admin") {
                    return director || vice || counselor || activity || teacher || assistant;
                }
                if (type === "excellence" || type === "achievement") {
                    return director || vice || counselor || activity || teacher;
                }
                if (type === "guidance") {
                    return stuVice || eduVice || teacher || counselor;
                }
                if (type === "fund") {
                    return schoolVice || counselor || activity || teacher || assistant;
                }
                if (type === "safety") {
                    return schoolVice || counselor || health || teacher;
                }
                if (type === "special") {
                    return stuVice || counselor || specialTeacher;
                }
                if (type === "activity") {
                    return activity || stuVice || teacher;
                }
                if (type === "discipline") {
                    return stuVice || counselor || teacher;
                }
                return false;
            }).map(function (person) {
                return person.id;
            });
        }

        function clearSyntheticPeople() {
            Array.prototype.forEach.call(list.querySelectorAll("[data-synthetic='1']"), function (node) {
                node.remove();
            });
        }

        function ensurePersonRow(person) {
            var existing = list.querySelector("input[value=\"" + String(person.id).replace(/"/g, "") + "\"]");
            if (existing) {
                existing.checked = true;
                if (person.name) {
                    existing.setAttribute("data-name", person.name);
                }
                if (person.role) {
                    existing.setAttribute("data-role", person.role);
                }
                return;
            }
            var li = document.createElement("li");
            li.setAttribute("data-synthetic", "1");
            var label = document.createElement("label");
            var input = document.createElement("input");
            input.type = "checkbox";
            input.value = person.id;
            input.checked = true;
            input.setAttribute("data-name", person.name || "");
            input.setAttribute("data-role", person.role || "");
            label.appendChild(input);
            label.appendChild(document.createTextNode(" " + (person.name || "") + " — " + (person.role || "عضو")));
            li.appendChild(label);
            list.appendChild(li);
        }

        function applyFormationMembers() {
            var seats = currentSeats();
            clearSyntheticPeople();
            Array.prototype.forEach.call(list.querySelectorAll("input"), function (input) {
                input.checked = false;
            });
            if (!seats.length) {
                applySuggestion();
                return;
            }
            seats.forEach(function (seat) {
                if (!seat.name) {
                    return;
                }
                var found = staffDirectory.filter(function (person) {
                    return person.name === seat.name || (person.name && seat.name.indexOf(person.name) >= 0);
                })[0];
                if (found) {
                    ensurePersonRow({ id: found.id, name: found.name, role: seat.title || found.role });
                    return;
                }
                ensurePersonRow({
                    id: "seat-" + String(seat.name).replace(/\s+/g, "-"),
                    name: seat.name,
                    role: seat.title || "عضواً"
                });
            });
            paintDecree();
            paintPresentCount();
        }

        function applySuggestion() {
            clearSyntheticPeople();
            var ids = {};
            suggestedIds(typeSelect.value).forEach(function (id) {
                ids[id] = true;
            });
            Array.prototype.forEach.call(list.querySelectorAll("input"), function (input) {
                input.checked = !!ids[input.value];
            });
            paintDecree();
            paintPresentCount();
        }

        function paintSuggest() {
            var council = councilById(typeSelect.value);
            suggest.textContent = council ? council.suggest : "";
        }

        function setPair(gregField, hijriField, gregText, hijriText) {
            gregField.value = typeof formatDisplayDate === "function" ? formatDisplayDate(gregText || "", "gregorian") : (gregText || "");
            hijriField.value = typeof formatDisplayDate === "function" ? formatDisplayDate(hijriText || "", "hijri") : (hijriText || "");
            var native = gregField.parentNode ? gregField.parentNode.querySelector(".date-picker-native") : null;
            if (native) {
                native.value = isoFromGregorianText(gregField.value) || "";
            }
            if (gregField.value || hijriField.value) {
                syncHijriGregorianDates(gregField, hijriField);
            }
        }

        function checkedPeople() {
            var out = [];
            var seen = {};
            Array.prototype.forEach.call(list.querySelectorAll("input:checked"), function (input) {
                var id = input.value;
                if (seen[id]) {
                    return;
                }
                seen[id] = true;
                var seatRole = input.getAttribute("data-role") || "";
                var seatName = input.getAttribute("data-name") || "";
                var fromStaff = staffDirectory.filter(function (person) {
                    return String(person.id) === String(id);
                })[0];
                if (fromStaff) {
                    out.push({
                        id: fromStaff.id,
                        name: seatName || fromStaff.name,
                        role: seatRole || fromStaff.role
                    });
                    return;
                }
                out.push({
                    id: id,
                    name: seatName || id,
                    role: seatRole || "عضواً"
                });
            });
            return out;
        }

        function paintPresentCount() {
            var countNode = pane.querySelector("#council-present-count");
            if (countNode) {
                countNode.textContent = "الحضور: " + checkedPeople().length;
            }
        }

        function readAll() {
            var data = readStore("board1059.councils");
            return Array.isArray(data) ? data : [];
        }

        function mergeCouncilLists(primary, secondary) {
            var map = {};
            function score(item) {
                return String(item.minutes || "").length
                    + String(item.decisions || "").length
                    + String(item.iso || "").length
                    + ((item.present && item.present.length) || 0);
            }
            function ingest(list) {
                (list || []).forEach(function (item) {
                    if (!item || !item.id) {
                        return;
                    }
                    var prev = map[item.id];
                    if (!prev || score(item) >= score(prev)) {
                        map[item.id] = item;
                    }
                });
            }
            ingest(secondary);
            ingest(primary);
            return Object.keys(map).map(function (key) {
                return map[key];
            }).sort(function (a, b) {
                return String(b.iso || "").localeCompare(String(a.iso || ""));
            });
        }

        function writeAll(all, syncServer) {
            var list = Array.isArray(all) ? all : [];
            try {
                localStorage.setItem("board1059.councils", JSON.stringify(list));
            } catch (error) {
                /* ignore quota */
            }
            if (syncServer === false) {
                return Promise.resolve(list);
            }
            return fetch("/api/councils", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ minutes: list })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error((payload && payload.detail) || "تعذر مزامنة المحاضر");
                    }
                    var remote = payload && Array.isArray(payload.minutes) ? payload.minutes : list;
                    try {
                        localStorage.setItem("board1059.councils", JSON.stringify(remote));
                    } catch (error) {
                        /* ignore */
                    }
                    return remote;
                });
            }).catch(function () {
                return list;
            });
        }

        function hydrateCouncils() {
            return fetch("/api/councils").then(function (response) {
                return response.json();
            }).then(function (payload) {
                var remote = payload && Array.isArray(payload.minutes) ? payload.minutes : [];
                var merged = mergeCouncilLists(readAll(), remote);
                return writeAll(merged, true);
            }).catch(function () {
                return readAll();
            });
        }

        function renderSaved() {
            var all = readAll();
            savedHost.innerHTML = "";
            savedHost.hidden = false;
            var head = document.createElement("div");
            head.className = "council-saved-head";
            var title = document.createElement("p");
            title.textContent = "المحاضر المحفوظة (" + all.length + ")";
            var fresh = document.createElement("button");
            fresh.type = "button";
            fresh.textContent = "محضر جديد";
            fresh.addEventListener("click", clearForm);
            head.appendChild(title);
            head.appendChild(fresh);
            savedHost.appendChild(head);
            if (!all.length) {
                var empty = document.createElement("p");
                empty.className = "wash-hint council-saved-empty";
                empty.textContent = "لا محاضر محفوظة بعد. عبّئ الحقول ثم اضغط «حفظ المحضر».";
                savedHost.appendChild(empty);
                return;
            }
            all.forEach(function (record) {
                var button = document.createElement("button");
                button.type = "button";
                var savedDate = typeof formatDisplayDate === "function"
                    ? (formatDisplayDate(record.hijri || "", "hijri") || formatDisplayDate(record.gregorian || "", "gregorian"))
                    : (record.hijri || record.gregorian || "");
                button.textContent = typeLabel(record.type) + " — " + savedDate + " — " + (record.agenda || "");
                if (record.id === currentId) {
                    button.className = "is-on";
                }
                button.addEventListener("click", function () {
                    loadRecord(record);
                });
                savedHost.appendChild(button);
            });
        }

        function loadRecord(record) {
            currentId = record.id;
            touched = true;
            typeSelect.value = record.type || "admin";
            if (!councilById(typeSelect.value) && record.type) {
                var legacy = document.createElement("option");
                legacy.value = record.type;
                legacy.textContent = typeLabel(record.type) || record.type;
                typeSelect.appendChild(legacy);
                typeSelect.value = record.type;
            }
            setPair(greg, hijri, record.gregorian, record.hijri);
            setPair(followGreg, followHijri, record.followGregorian, record.followHijri);
            if (agendaFree) {
                agendaFree.value = "";
            }
            fillAgenda(record.agenda || "");
            var knownTopics = (councilById(typeSelect.value) || { topics: [] }).topics || [];
            if (record.agenda && knownTopics.indexOf(record.agenda) === -1 && agendaFree) {
                agendaFree.value = record.agenda;
            }
            clearSyntheticPeople();
            Array.prototype.forEach.call(list.querySelectorAll("input"), function (input) {
                input.checked = false;
            });
            (record.present || []).forEach(function (person) {
                ensurePersonRow(person);
            });
            if (decisionsField) {
                decisionsField.value = record.decisions || "";
                decisionsDirty = !!record.decisions;
            }
            extra.value = record.addition || "";
            if (minutesEdit) {
                minutesEdit.value = record.minutes || "";
                minutesDirty = !!record.minutes;
            }
            if (!record.minutes) {
                paintDecree(true);
            }
            paintSuggest();
            paintRegisterHint();
            paintPresentCount();
            note.textContent = "";
            renderSaved();
            loadEvidence(currentId);
        }

        function clearForm() {
            touched = false;
            minutesDirty = false;
            decisionsDirty = false;
            evidenceItems = [];
            // معرّف جديد صريح حتى لا يُحفظ فوق محضر سابق
            currentId = "council-" + String(Date.now());
            typeSelect.value = "admin";
            setPair(greg, hijri, "", "");
            setPair(followGreg, followHijri, "", "");
            extra.value = "";
            if (agendaFree) {
                agendaFree.value = "";
            }
            if (decisionsField) {
                decisionsField.value = "";
            }
            if (minutesEdit) {
                minutesEdit.value = "";
            }
            if (decisionPick) {
                decisionPick.value = "";
            }
            sheet.innerHTML = "";
            fillAgenda("");
            applyFormationMembers();
            paintDecree(true);
            paintSuggest();
            paintRegisterHint();
            paintPresentCount();
            paintEvidencePanel();
            renderSaved();
            note.textContent = "محضر جديد — اختر التاريخ والموضوع ثم احفظ.";
            if (typeSelect && typeSelect.focus) {
                typeSelect.focus();
            }
        }

        function councilPrintHost() {
            var host = document.getElementById("council-print-host");
            if (!host) {
                host = document.createElement("div");
                host.id = "council-print-host";
                host.className = "council-print-host";
                document.body.appendChild(host);
            }
            return host;
        }

        function clearCouncilPrintHost() {
            var host = document.getElementById("council-print-host");
            if (host) {
                host.innerHTML = "";
            }
            if (sheet) {
                sheet.innerHTML = "";
                sheet.style.display = "";
            }
        }

        function paintSheet() {
            var host = councilPrintHost();
            if (!engine()) {
                host.innerHTML = "<p>محرك الصياغة غير محمّل.</p>";
                if (sheet) {
                    sheet.innerHTML = host.innerHTML;
                }
                return;
            }
            var ctx = draftContext();
            ctx.minutes = fullText();
            ctx.evidenceItems = evidenceItems;
            var html = engine().buildThreePages(ctx, "");
            host.innerHTML = html;
            if (sheet) {
                sheet.innerHTML = html;
            }
        }

        function prepareCouncilSheet() {
            var oldHost = document.getElementById("improvement-print-host");
            if (oldHost) {
                oldHost.innerHTML = "";
            }
            document.body.classList.remove("print-mode", "print-improvement", "print-visit", "print-roll");
            paintSheet();
            var host = councilPrintHost();
            host.hidden = false;
            // النواة تضع .doc-official-header — لا تُضف ترويسة قديمة فوقها
            Array.prototype.forEach.call(host.querySelectorAll(".council-official-page, .official-document-frame"), function (page) {
                if (page.querySelector(".doc-official-header")) {
                    return;
                }
                page.insertAdjacentHTML("afterbegin", officialIdentityHeader());
            });
        }

        function openCouncilPreview() {
            if (window.openPrintPreview) {
                window.openPrintPreview("print-council");
            } else {
                document.body.classList.add("print-council", "is-print-preview");
            }
            document.body.classList.add("print-official-core", "print-official-multi");
            prepareCouncilSheet();
        }

        function openCouncilPrint() {
            if (window.openPrintPreview) {
                window.openPrintPreview("print-council");
            } else {
                document.body.classList.add("print-council", "is-print-preview");
            }
            document.body.classList.add("print-official-core", "print-official-multi");
            prepareCouncilSheet();
            window.setTimeout(function () {
                document.body.classList.add("print-mode", "print-council", "print-official-core", "print-official-multi");
                if (window.OfficialFrameCore && typeof window.OfficialFrameCore.armPrintPage === "function") {
                    window.OfficialFrameCore.armPrintPage({ multiPage: true });
                }
                function restore() {
                    document.body.classList.remove("print-mode", "print-official-multi");
                    if (window.closePrintPreview) {
                        window.closePrintPreview();
                    } else {
                        clearCouncilPrintHost();
                        document.body.classList.remove("print-official-core", "print-council");
                    }
                }
                var host = councilPrintHost();
                var html = host ? host.innerHTML : "";
                if (!window.PrintEngine || typeof window.PrintEngine.open !== "function") {
                    console.error("PrintEngine غير محمّل.");
                    restore();
                    return;
                }
                var printed = window.PrintEngine.open("raw-html", {
                    html: html,
                    autoPrint: true,
                    multiPage: true,
                    orientation: "portrait",
                    docTitle: "محضر مجلس"
                });
                if (printed && typeof printed.finally === "function") {
                    printed.finally(restore);
                } else if (printed && typeof printed.then === "function") {
                    printed.then(restore, restore);
                } else {
                    restore();
                }
            }, 120);
        }

        // إن وُجدت أزرار الشاهد القديمة في النموذج حوّلها للمحضر الرسمي
        form.addEventListener("click", function (event) {
            var witnessBtn = event.target.closest && event.target.closest(".evidence-print, .evidence-edit");
            if (!witnessBtn) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            openCouncilPrint();
        }, true);

        typeSelect.addEventListener("change", function () {
            if (!touched) {
                applyFormationMembers();
            }
            fillAgenda("");
            paintSuggest();
            paintRegisterHint();
            paintEvidencePanel();
        });
        list.addEventListener("change", function () {
            touched = true;
            paintDecree();
            paintPresentCount();
        });
        var pickFormation = pane.querySelector("#council-pick-formation");
        if (pickFormation) {
            pickFormation.addEventListener("click", function () {
                touched = true;
                applyFormationMembers();
            });
        }
        var pickSuggest = pane.querySelector("#council-pick-suggest");
        if (pickSuggest) {
            pickSuggest.addEventListener("click", function () {
                touched = true;
                applySuggestion();
                paintPresentCount();
            });
        }
        var clearPeople = pane.querySelector("#council-clear-people");
        if (clearPeople) {
            clearPeople.addEventListener("click", function () {
                touched = true;
                clearSyntheticPeople();
                Array.prototype.forEach.call(list.querySelectorAll("input"), function (input) {
                    input.checked = false;
                });
                paintDecree();
                paintPresentCount();
            });
        }
        agenda.addEventListener("change", function () {
            if (agendaFree) {
                agendaFree.value = "";
            }
            decisionsDirty = false;
            fillDecisionPick();
            paintDecree(false);
        });
        if (decisionPick) {
            decisionPick.addEventListener("change", function () {
                if (decisionPick.value && decisionsField) {
                    decisionsField.value = decisionPick.value;
                    decisionsDirty = false;
                }
                paintDecree(false);
            });
        }
        if (decisionsField) {
            decisionsField.addEventListener("input", function () {
                decisionsDirty = true;
                paintDecree(false);
            });
        }
        if (minutesEdit) {
            minutesEdit.addEventListener("input", function () {
                minutesDirty = true;
            });
        }
        var redraftBtn = pane.querySelector("#council-redraft");
        if (redraftBtn) {
            redraftBtn.addEventListener("click", function () {
                minutesDirty = false;
                decisionsDirty = false;
                syncDecisionPreset(true);
                paintDecree(true);
                note.textContent = "أُعيدت صياغة المحضر من الحقول الحالية. يمكنك تعديله قبل الطباعة.";
            });
        }
        pane.addEventListener("input", function (event) {
            if (event.target === minutesEdit || event.target === decisionsField) {
                return;
            }
            if (event.target === extra) {
                paintDecree(false);
                return;
            }
            paintDecree(false);
        });
        if (paintCouncils.onHijri) {
            document.removeEventListener("click", paintCouncils.onHijri);
        }
        paintCouncils.onHijri = function (event) {
            var day = event.target.closest ? event.target.closest("[data-hijri-day]") : null;
            if (!day || !hijri.isConnected) {
                return;
            }
            window.setTimeout(paintDecree, 0);
        };
        document.addEventListener("click", paintCouncils.onHijri);
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var iso = isoFromGregorianText(greg.value) || isoFromHijriText(hijri.value) || "";
            if (!iso) {
                note.textContent = "اختر تاريخ الاجتماع.";
                return;
            }
            if (!activeAgenda()) {
                note.textContent = "حدد موضوع الاجتماع.";
                return;
            }
            var followIso = isoFromGregorianText(followGreg.value) || isoFromHijriText(followHijri.value) || "";
            var profile = engine() ? engine().profileFor(typeSelect.value) : {};
            var record = {
                id: ensureCouncilKey(),
                type: typeSelect.value,
                hijri: hijri.value,
                gregorian: greg.value,
                iso: iso,
                agenda: activeAgenda(),
                present: checkedPeople(),
                decisions: decisionsField ? decisionsField.value.trim() : "",
                minutes: fullText(),
                addition: extra.value.trim(),
                followHijri: followHijri.value,
                followGregorian: followGreg.value,
                followIso: followIso,
                registerKey: profile.registerKey || "",
                registerLabel: profile.registerLabel || "",
                dayKey: iso,
                evidenceCount: evidenceItems.length
            };
            var all = readAll();
            var index = -1;
            all.forEach(function (item, itemIndex) {
                if (item.id === record.id) {
                    index = itemIndex;
                }
            });
            if (index >= 0) {
                all[index] = record;
            } else {
                all.push(record);
            }
            note.textContent = "جاري حفظ المحضر…";
            writeAll(all, true).then(function () {
                refreshLinked();
                if (window.dataHub && typeof window.dataHub.announce === "function") {
                    window.dataHub.announce("councils");
                } else {
                    window.dispatchEvent(new CustomEvent("dataChanged", { detail: { source: "councils" } }));
                }
                currentId = record.id;
                touched = true;
                note.textContent = "حُفظ المحضر ورُبط بـ " + (record.registerLabel || "السجل المناسب") + ".";
                renderSaved();
                paintEvidencePanel();
                loadEvidence(currentId);
            });
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            var found = null;
            readAll().forEach(function (record) {
                if (record.id === currentId) {
                    found = record;
                }
            });
            if (found) {
                loadRecord(found);
                return;
            }
            clearForm();
        });
        previewBtn.addEventListener("click", openCouncilPreview);
        printBtn.addEventListener("click", openCouncilPrint);
        var newTop = pane.querySelector("#council-new-top");
        if (newTop) {
            newTop.addEventListener("click", function () {
                clearForm();
            });
        }
        window.addEventListener("dataChanged", function (event) {
            if (!pane.isConnected) {
                return;
            }
            var source = event.detail && event.detail.source;
            if (source === "staff" || source === "leadership" || source === "councils") {
                if (source !== "councils") {
                    applyFormationMembers();
                }
                paintDecree();
            }
        });
        if (!paintCouncils.printBound) {
            paintCouncils.printBound = true;
        }
        fetch("/api/committees").then(function (response) {
            return response.json();
        }).then(function (payload) {
            formationCache.formations = payload.formations || {};
            formationCache.committees = payload.committees || [];
            applyFormationMembers();
            paintRegisterHint();
        }).catch(function () {
            applyFormationMembers();
        });
        fillAgenda("");
        paintSuggest();
        paintRegisterHint();
        paintPresentCount();
        paintEvidencePanel();
        renderSaved();
        hydrateCouncils().then(function () {
            if (!pane.isConnected) {
                return;
            }
            renderSaved();
        });
    }

    function paintVisits(pane) {
        var specialties = ["الإدارة المدرسية", "التوجيه الطلابي", "الأمن والسلامة", "النشاط الطلابي", "التربية الإسلامية", "اللغة العربية", "اللغة الإنجليزية", "الدراسات الاجتماعية", "الرياضيات", "العلوم", "المهارات الرقمية", "التربية الفنية", "التربية البدنية", "المهارات الحياتية والأسرية", "التفكير الناقد", "الكيمياء", "الأحياء", "الفيزياء", "علم الأرض والفضاء", "العلوم الإدارية", "التربية الفكرية", "التوحد", "صعوبات التعلم"];
        var visitTypes = [
            { id: "round", label: "زيارة تفقدية", act: "للاطمئنان على سير العمل وانتظام اليوم الدراسي" },
            { id: "performance", label: "متابعة أداء", act: "لمتابعة الأداء المهني للزملاء المستهدفين" },
            { id: "environment", label: "تقييم بيئة مدرسية", act: "لتقييم البيئة المدرسية وما يحيط بالعملية التعليمية" }
        ];
        var offices = [
            { group: "الإمارة", items: ["أمير المنطقة", "نائب أمير المنطقة"] },
            { group: "وزارة التعليم", items: ["وزير التعليم", "نائب وزير التعليم", "نائب وزير التعليم للتعليم العام", "مساعد الوزير", "مساعد الوزير للتطوير والتحول", "مساعد الوزير للتعليم الخاص والاستثمار", "أمين إدارات التعليم", "مدير عام بالوزارة"] },
            { group: "إدارة التعليم", items: ["مدير عام التعليم", "مساعد المدير العام للشؤون التعليمية", "مساعد المدير العام للشؤون المدرسية", "مدير الإشراف التربوي", "مدير مكتب التعليم"] }
        ];
        var officeTitles = offices.reduce(function (list, group) { return list.concat(group.items); }, []);
        var currentId = "";
        var visitorKind = "supervisor";
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<form id=\"visit-form\">"
            + "<h1>سجل الزيارات الإشرافية</h1>"
            + "<p class=\"wash-hint\">الإفادة تُصاغ من الحقول المحفوظة. تاريخ الزيارة يبقى فارغًا حتى يُختار.</p>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card board-span\">"
            + "<h2>بيانات الزيارة والزائر</h2>"
            + "<div class=\"roll-filters\" id=\"visit-kind\">"
            + "<button type=\"button\" class=\"is-on\" data-visit-kind=\"supervisor\">مشرف تربوي</button>"
            + "<button type=\"button\" data-visit-kind=\"official\">مسؤول زائر</button>"
            + "</div>"
            + "<p class=\"wash-hint\" id=\"visit-kind-note\">المشرف يُقيَّد بتخصصه. المسؤول يُقيَّد بمسمّاه، والاسم يُكتب عند الزيارة.</p>"
            + "<div class=\"council-meta\">"
            + "<label class=\"wash-field\"><span id=\"visit-name-label\">اسم المشرف الزائر</span><input id=\"visit-name\" type=\"text\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\" id=\"visit-specialty-field\"><span>تخصص المشرف</span><select id=\"visit-specialty\"></select></label>"
            + "<label class=\"wash-field\" id=\"visit-office-field\" hidden><span>المسمى الوظيفي</span><select id=\"visit-office\"></select></label>"
            + "<div class=\"visit-when\">"
            + "<label class=\"wash-field\"><span>نوع الزيارة</span><select id=\"visit-type\"></select></label>"
            + "<div class=\"wash-field dual-date-block roll-dates\"><span>تاريخ الزيارة</span><span class=\"dual-date-pair\">"
            + "<label><b>هجري</b><input class=\"doc-hijri\" id=\"visit-hijri\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 17 ربيع الأول 1448هـ\" autocomplete=\"off\"></label>"
            + "<label><b>ميلادي</b><input class=\"doc-date-picker\" id=\"visit-gregorian\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 30 أغسطس 2026م\" autocomplete=\"off\"></label>"
            + "</span></div>"
            + "</div>"
            + "</div>"
            + "<div id=\"visit-saved\" class=\"council-saved\" hidden></div>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<h2>المستهدفون بالزيارة</h2>"
            + "<p class=\"wash-hint\">حدّد من شملتهم الزيارة من سجل المنسوبين.</p>"
            + "<ul class=\"council-list people-board\" id=\"visit-people\"></ul>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<h2>الإفادة والتوصيات</h2>"
            + "<p class=\"visit-preamble\" id=\"visit-preamble\"></p>"
            + "<label class=\"wash-field\"><span id=\"visit-notes-label\">ملاحظات المشرف وتوصياته</span><textarea id=\"visit-notes\"></textarea></label>"
            + "</section>"
            + "</div>"
            + actionsHtml("حفظ سجل الزيارة", "facility-actions")
            + "</form>"
            + "<section class=\"visit-sheet\" id=\"visit-sheet\"></section>"
        );
        var form = pane.querySelector("#visit-form");
        mountDocumentWitness(form, "تقرير زيارة");
        var nameField = pane.querySelector("#visit-name");
        var specialty = pane.querySelector("#visit-specialty");
        var office = pane.querySelector("#visit-office");
        var officeField = pane.querySelector("#visit-office-field");
        var specialtyField = pane.querySelector("#visit-specialty-field");
        var nameLabel = pane.querySelector("#visit-name-label");
        var notesLabel = pane.querySelector("#visit-notes-label");
        var typeSelect = pane.querySelector("#visit-type");
        var greg = pane.querySelector("#visit-gregorian");
        var hijri = pane.querySelector("#visit-hijri");
        var notes = pane.querySelector("#visit-notes");
        var preamble = pane.querySelector("#visit-preamble");
        var list = pane.querySelector("#visit-people");
        var savedHost = pane.querySelector("#visit-saved");
        var note = form.querySelector(".wash-note");
        var sheet = pane.querySelector("#visit-sheet");
        var actions = form.querySelector(".wash-actions");
        var printBtn = document.createElement("button");
        printBtn.type = "button";
        printBtn.className = "wash-print";
        printBtn.textContent = "طباعة الإفادة";
        actions.insertBefore(printBtn, actions.querySelector(".wash-cancel"));
        offices.forEach(function (group) {
            var box = document.createElement("optgroup");
            box.label = group.group;
            group.items.forEach(function (item) {
                var option = document.createElement("option");
                option.value = item;
                option.textContent = item;
                box.appendChild(option);
            });
            office.appendChild(box);
        });
        specialties.forEach(function (item) {
            var option = document.createElement("option");
            option.value = item;
            option.textContent = item;
            specialty.appendChild(option);
        });
        visitTypes.forEach(function (item) {
            var option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.label;
            typeSelect.appendChild(option);
        });
        fillPeopleBoard(list, staffDirectory);
        syncHijriGregorianDates(greg, hijri);

        function typeById(id) {
            return visitTypes.filter(function (item) { return item.id === id; })[0] || visitTypes[0];
        }

        function checkedPeople() {
            var chosen = {};
            Array.prototype.forEach.call(list.querySelectorAll("input:checked"), function (input) {
                chosen[input.value] = true;
            });
            return staffDirectory.filter(function (person) {
                return chosen[person.id];
            }).map(function (person) {
                return { id: person.id, name: person.name, role: person.role };
            });
        }

        function principalName() {
            var saved = readStore("board1059.leadership");
            if (saved && saved.principal && window.dataHub) {
                return window.dataHub.display(saved.principal);
            }
            var option = document.querySelector("#plan-role option[value='principal']");
            if (!option) {
                return "";
            }
            var parts = option.textContent.split(":");
            return (parts[1] || "").trim();
        }

        function composePreamble() {
            var schoolNode = document.getElementById("command-school-name");
            var school = schoolNode && schoolNode.textContent ? schoolNode.textContent : "المدرسة";
            var kind = typeById(typeSelect.value);
            var when = hijri.value || greg.value ? "في يوم " + [hijri.value, greg.value].filter(Boolean).join(" الموافق ") + " " : "";
            var named = nameField.value.trim();
            var visitor = visitorKind === "official"
                ? ((named ? office.value + " " + named : office.value + "، ويُستكمل الاسم عند القيد"))
                : (named ? "المشرف التربوي " + named : "مشرف تربوي يُستكمل اسمه عند القيد");
            var focus = visitorKind === "official" ? "" : "، تخصص " + specialty.value;
            var people = checkedPeople();
            var targets = people.length ? people.map(function (person) { return person.name; }).join("، ") : "ويُستكمل قيد المستهدفين عند تحديدهم";
            return when + "زار " + school + " " + visitor + focus + "، في " + kind.label + " " + kind.act + ". وشملت الزيارة: " + targets + ". وقد دوّن التوصيات التالية:";
        }

        function paintPreamble() {
            preamble.textContent = composePreamble();
        }

        function setPair(gregText, hijriText) {
            greg.value = typeof formatDisplayDate === "function" ? formatDisplayDate(gregText || "", "gregorian") : (gregText || "");
            hijri.value = typeof formatDisplayDate === "function" ? formatDisplayDate(hijriText || "", "hijri") : (hijriText || "");
            var native = greg.parentNode ? greg.parentNode.querySelector(".date-picker-native") : null;
            if (native) {
                native.value = isoFromGregorianText(greg.value) || "";
            }
            if (greg.value || hijri.value) {
                syncHijriGregorianDates(greg, hijri);
            }
        }

        function readAll() {
            var data = readStore("board1059.visits");
            return Array.isArray(data) ? data : [];
        }

        function renderSaved() {
            var all = readAll();
            savedHost.innerHTML = "";
            if (!all.length) {
                savedHost.hidden = true;
                return;
            }
            savedHost.hidden = false;
            var head = document.createElement("div");
            head.className = "council-saved-head";
            var title = document.createElement("p");
            title.textContent = "الزيارات المحفوظة";
            var fresh = document.createElement("button");
            fresh.type = "button";
            fresh.textContent = "زيارة جديدة";
            fresh.addEventListener("click", clearForm);
            head.appendChild(title);
            head.appendChild(fresh);
            savedHost.appendChild(head);
            all.forEach(function (record) {
                var button = document.createElement("button");
                button.type = "button";
                var visitDate = typeof formatDisplayDate === "function"
                    ? (formatDisplayDate(record.hijri || "", "hijri") || formatDisplayDate(record.gregorian || "", "gregorian"))
                    : (record.hijri || record.gregorian || "");
                button.textContent = (record.visitorKind === "official" ? (record.officeTitle || "مسؤول") : (record.visitorName || "مشرف")) + " — " + visitDate + " — " + (typeById(record.visitType).label);
                if (record.id === currentId) {
                    button.className = "is-on";
                }
                button.addEventListener("click", function () {
                    loadRecord(record);
                });
                savedHost.appendChild(button);
            });
        }

        function applyKind(kind) {
            visitorKind = kind === "official" ? "official" : "supervisor";
            specialtyField.hidden = visitorKind === "official";
            officeField.hidden = visitorKind !== "official";
            specialtyField.style.display = visitorKind === "official" ? "none" : "";
            officeField.style.display = visitorKind === "official" ? "" : "none";
            nameLabel.textContent = visitorKind === "official" ? "اسم المسؤول" : "اسم المشرف الزائر";
            notesLabel.textContent = visitorKind === "official" ? "ملاحظات المسؤول وتوصياته" : "ملاحظات المشرف وتوصياته";
            Array.prototype.forEach.call(pane.querySelectorAll("#visit-kind button"), function (button) {
                button.classList.toggle("is-on", button.getAttribute("data-visit-kind") === visitorKind);
            });
            paintPreamble();
        }

        function loadRecord(record) {
            currentId = record.id;
            applyKind(record.visitorKind);
            nameField.value = record.visitorName || "";
            if (specialties.indexOf(record.specialty) !== -1) {
                specialty.value = record.specialty;
            }
            if (officeTitles.indexOf(record.officeTitle) !== -1) {
                office.value = record.officeTitle;
            }
            if (typeById(record.visitType).id === record.visitType) {
                typeSelect.value = record.visitType;
            }
            setPair(record.gregorian, record.hijri);
            notes.value = record.notes || "";
            var ids = {};
            (record.targets || []).forEach(function (person) {
                ids[person.id] = true;
            });
            Array.prototype.forEach.call(list.querySelectorAll("input"), function (input) {
                input.checked = !!ids[input.value];
            });
            note.textContent = "";
            paintPreamble();
            renderSaved();
        }

        function clearForm() {
            currentId = "";
            applyKind("supervisor");
            nameField.value = "";
            specialty.selectedIndex = 0;
            office.selectedIndex = 0;
            typeSelect.selectedIndex = 0;
            setPair("", "");
            notes.value = "";
            Array.prototype.forEach.call(list.querySelectorAll("input"), function (input) {
                input.checked = false;
            });
            note.textContent = "";
            paintPreamble();
            renderSaved();
        }

        function paintSheet() {
            sheet.innerHTML = "";
            var heading = document.createElement("h1");
            heading.textContent = "إفادة زيارة إشرافية";
            var body = document.createElement("p");
            body.textContent = composePreamble();
            var written = document.createElement("p");
            written.textContent = notes.value.trim() || "لم تُضف توصيات نصية في هذا القيد.";
            sheet.appendChild(heading);
            sheet.appendChild(body);
            sheet.appendChild(written);
            var grid = document.createElement("div");
            grid.className = "council-signs";
            function sign(title, person) {
                var card = document.createElement("article");
                var role = document.createElement("b");
                role.textContent = title;
                var who = document.createElement("span");
                who.textContent = person || "";
                var caption = document.createElement("em");
                caption.textContent = "التوقيع";
                var stroke = document.createElement("i");
                card.appendChild(role);
                card.appendChild(who);
                card.appendChild(caption);
                card.appendChild(stroke);
                grid.appendChild(card);
            }
            sign(visitorKind === "official" ? office.value : "المشرف التربوي", nameField.value.trim());
            sign("مدير المدرسة", principalName());
            sheet.appendChild(grid);
        }

        pane.querySelector("#visit-kind").addEventListener("click", function (event) {
            var button = event.target.closest ? event.target.closest("[data-visit-kind]") : null;
            if (!button) {
                return;
            }
            applyKind(button.getAttribute("data-visit-kind"));
        });
        nameField.addEventListener("input", paintPreamble);
        specialty.addEventListener("change", paintPreamble);
        typeSelect.addEventListener("change", paintPreamble);
        list.addEventListener("change", paintPreamble);
        pane.addEventListener("change", paintPreamble);
        pane.addEventListener("input", function (event) {
            if (event.target === notes) {
                return;
            }
            paintPreamble();
        });
        if (paintVisits.onHijri) {
            document.removeEventListener("click", paintVisits.onHijri);
        }
        paintVisits.onHijri = function (event) {
            var day = event.target.closest ? event.target.closest("[data-hijri-day]") : null;
            if (!day || !hijri.isConnected) {
                return;
            }
            window.setTimeout(paintPreamble, 0);
        };
        document.addEventListener("click", paintVisits.onHijri);
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var iso = isoFromGregorianText(greg.value) || isoFromHijriText(hijri.value) || "";
            if (!nameField.value.trim() || !iso) {
                note.textContent = visitorKind === "official" ? "اكتب اسم المسؤول واختر تاريخ الزيارة." : "اكتب اسم المشرف واختر تاريخ الزيارة.";
                return;
            }
            var record = {
                id: currentId || ("visit-" + String(Date.now())),
                visitorKind: visitorKind,
                visitorName: nameField.value.trim(),
                specialty: visitorKind === "official" ? "" : specialty.value,
                officeTitle: visitorKind === "official" ? office.value : "",
                visitType: typeSelect.value,
                hijri: hijri.value,
                gregorian: greg.value,
                iso: iso,
                targets: checkedPeople(),
                notes: notes.value.trim(),
                preamble: composePreamble()
            };
            var all = readAll();
            var index = -1;
            all.forEach(function (item, itemIndex) {
                if (item.id === record.id) {
                    index = itemIndex;
                }
            });
            if (index >= 0) {
                all[index] = record;
            } else {
                all.push(record);
            }
            localStorage.setItem("board1059.visits", JSON.stringify(all));
            refreshLinked();
            currentId = record.id;
            note.textContent = "حُفظ سجل الزيارة.";
            renderSaved();
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            var found = null;
            readAll().forEach(function (record) {
                if (record.id === currentId) {
                    found = record;
                }
            });
            if (found) {
                loadRecord(found);
                return;
            }
            clearForm();
        });
        printBtn.addEventListener("click", function () {
            var control = form.querySelector("[name='witnessKind'], [data-label='الشاهد']");
            if (control) {
                openWitnessPrint(form, control);
                return;
            }
            paintSheet();
            if (!sheet.querySelector(".print-header-table")) {
                sheet.insertAdjacentHTML("afterbegin", officialIdentityHeader());
            }
            if (window.sealRepeatingLetterhead) {
                window.sealRepeatingLetterhead(sheet);
            }
            if (window.openPrintPreview) {
                window.openPrintPreview("print-visit");
            }
        });
        if (!paintVisits.printBound) {
            paintVisits.printBound = true;
        }
        applyKind("supervisor");
        renderSaved();
    }

    function paintPrograms(pane) {
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<div class=\"program-board\">"
            + "<h1>البرامج</h1>"
            + "<p class=\"wash-hint\">احفظ البرنامج مسودة أولًا. اعتماد المدير ينقله إلى خطة كل صاحب مختار وإلى سجل برنامجه. القوالب تملأ الحقول من المحفوظ، ويمكن اختيار أكثر من صاحب.</p>"
            + "<section class=\"board-card board-span program-overview\">"
            + "<div class=\"program-stats\" id=\"program-stats\"></div>"
            + "<div class=\"program-toolbar\">"
            + "<label class=\"program-search\"><span>بحث</span><input id=\"program-search\" type=\"search\" placeholder=\"اسم البرنامج أو السجل أو الصاحب\" autocomplete=\"off\"></label>"
            + "<label><span>الحالة</span><select id=\"program-status\" aria-label=\"تصفية الحالة\"><option value=\"\">كل الحالات</option></select></label>"
            + "<label><span>صاحب البرنامج</span><select id=\"program-owner\" aria-label=\"تصفية صاحب البرنامج\"><option value=\"\">كل أصحاب البرامج</option></select></label>"
            + "<label><span>السجل</span><select id=\"program-register\" aria-label=\"تصفية السجل\"><option value=\"\">كل السجلات</option></select></label>"
            + "<button class=\"staff-add\" id=\"program-add\" type=\"button\">إضافة برنامج جديد</button>"
            + "<button class=\"wash-back\" type=\"button\">العودة</button>"
            + "</div>"
            + "<p class=\"wash-note\" id=\"program-list-note\"></p>"
            + "<div class=\"program-table-wrap\"><table class=\"program-table data-table\"><thead><tr><th>البرنامج</th><th>المجال</th><th>صاحب البرنامج</th><th>السجل</th><th>القياس</th><th>الحالة</th><th class=\"is-fit\">إجراء</th></tr></thead><tbody id=\"program-rows\"></tbody></table></div>"
            + "</section>"
            + "<form id=\"program-form\" class=\"board-card board-span\" hidden>"
            + "<header class=\"program-form-head\">"
            + "<div><h2 id=\"program-form-title\">بطاقة البرنامج</h2><p class=\"program-path\" id=\"program-path\"></p></div>"
            + "<button type=\"button\" class=\"program-close\" id=\"program-close\">إغلاق البطاقة</button>"
            + "</header>"
            + "<details class=\"form-fold\" open><summary>القالب والتصنيف</summary>"
            + "<div class=\"program-templates\" id=\"program-templates\"></div>"
            + "<div class=\"facility-fields\">"
            + "<label class=\"wash-field\"><span>اسم البرنامج</span><input name=\"programName\" type=\"text\" autocomplete=\"off\" required></label>"
            + "<label class=\"wash-field\"><span>المجال</span><select name=\"domain\"><option value=\"\"></option></select></label>"
            + "<label class=\"wash-field\"><span>المستوى</span><select name=\"levelName\"><option value=\"\"></option></select></label>"
            + "<label class=\"wash-field\"><span>السجل</span><select name=\"registerId\" required></select></label>"
            + "<div class=\"wash-field wash-span\"><span>صاحب البرنامج</span><div class=\"owner-choices\" id=\"program-owners\"></div></div>"
            + "<label class=\"wash-field\"><span>الحالة</span><select name=\"status\"></select></label>"
            + "</div></details>"
            + "<details class=\"form-fold\" open><summary>الأهداف والمستهدفون</summary><div class=\"facility-fields\">"
            + "<label class=\"wash-field\"><span>الهدف الاستراتيجي</span><input name=\"strategicGoal\" type=\"text\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field wash-span\"><span>يخدم هدف الخطة الأم</span><select name=\"goalRef\"><option value=\"\">بلا ربط</option></select></label>"
            + "<label class=\"wash-field\"><span>الهدف التنفيذي</span><input name=\"executiveGoal\" type=\"text\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>الفئة المستهدفة</span><select name=\"audienceChoice\"><option value=\"\"></option></select></label>"
            + "<label class=\"wash-field\"><span>المستهدفون</span><input name=\"targetAudience\" type=\"text\" autocomplete=\"off\" required></label>"
            + "<label class=\"wash-field\"><span>الفترة الزمنية</span><input name=\"duration\" type=\"text\" autocomplete=\"off\" required></label>"
            + "<label class=\"wash-field\"><span>المنفذون</span><input name=\"implementers\" type=\"text\" autocomplete=\"off\" required></label>"
            + "<label class=\"wash-field\"><span>الميزانية</span><input name=\"budget\" type=\"text\" autocomplete=\"off\"></label>"
            + "</div></details>"
            + "<details class=\"form-fold\"><summary>التنفيذ والمخاطر</summary><div class=\"facility-fields\">"
            + "<label class=\"wash-field wash-span\"><span>آلية التنفيذ</span>"
            + "<div class=\"phrase-tools\"><select name=\"mechanismPhrase\" aria-label=\"عبارات آلية التنفيذ\"></select></div>"
            + "<div class=\"phrase-add\"><input name=\"mechanismPhraseNew\" type=\"text\" placeholder=\"عبارة جديدة\" autocomplete=\"off\"><button type=\"button\" class=\"phrase-add-btn\" data-phrase-field=\"mechanism\">إضافة عبارة جديدة</button></div>"
            + "<textarea name=\"mechanism\" rows=\"3\" required></textarea></label>"
            + "<label class=\"wash-field wash-span\"><span>مؤشر النجاح</span>"
            + "<div class=\"phrase-tools\"><select name=\"successPhrase\" aria-label=\"عبارات مؤشر النجاح\"></select></div>"
            + "<div class=\"phrase-add\"><input name=\"successPhraseNew\" type=\"text\" placeholder=\"عبارة جديدة\" autocomplete=\"off\"><button type=\"button\" class=\"phrase-add-btn\" data-phrase-field=\"success_indicator\">إضافة عبارة جديدة</button></div>"
            + "<textarea name=\"successIndicator\" rows=\"2\" required></textarea></label>"
            + "<label class=\"wash-field wash-span\"><span>إدارة المخاطر</span>"
            + "<div class=\"phrase-tools\"><select name=\"riskPhrase\" aria-label=\"عبارات إدارة المخاطر\"></select></div>"
            + "<div class=\"phrase-add\"><input name=\"riskPhraseNew\" type=\"text\" placeholder=\"عبارة جديدة\" autocomplete=\"off\"><button type=\"button\" class=\"phrase-add-btn\" data-phrase-field=\"risk_management\">إضافة عبارة جديدة</button></div>"
            + "<textarea name=\"riskManagement\" rows=\"2\"></textarea></label>"
            + "</div></details>"
            + "<details class=\"form-fold\"><summary>القياس وربط المؤشرات</summary><div class=\"facility-fields\">"
            + "<label class=\"wash-field\"><span>خط الأساس</span><select name=\"baselineChoice\"><option value=\"\"></option></select><input name=\"baselineValue\" type=\"text\" autocomplete=\"off\" placeholder=\"يمكن تعديل الرقم\"></label>"
            + "<label class=\"wash-field\"><span>القراءة الحالية</span><select name=\"currentChoice\"><option value=\"\"></option></select><input name=\"currentValue\" type=\"text\" autocomplete=\"off\" placeholder=\"يمكن تعديل الرقم\"></label>"
            + "<label class=\"wash-field\"><span>المستهدف الرقمي</span><select name=\"targetChoice\"><option value=\"\"></option></select><input name=\"targetValue\" type=\"text\" autocomplete=\"off\" placeholder=\"يمكن تعديل الرقم\"></label>"
            + "<label class=\"wash-field\"><span>الوحدة</span><select name=\"measureUnit\"><option value=\"\"></option><option value=\"%\">%</option><option value=\"عدد\">عدد</option><option value=\"نسبة\">نسبة</option></select></label>"
            + "<label class=\"wash-field wash-span\"><span>وصف مؤشر الأداء</span><select name=\"kpiChoice\"><option value=\"\"></option></select><textarea name=\"kpiDescription\" rows=\"2\"></textarea></label>"
            + "<label class=\"wash-field wash-span\"><span>المؤشرات</span><select name=\"indicatorIds\" multiple size=\"6\"></select></label>"
            + "<label class=\"wash-field\"><span>المرجع</span><input name=\"dutyLabel\" type=\"text\" readonly></label>"
            + "</div></details>"
            + "<details class=\"form-fold\" open><summary>الشواهد البصرية والطباعة</summary>"
            + "<p class=\"wash-hint\">المرفقات تُحفظ مع البرنامج وترتبط بسجله المختار. الطباعة تستخدم نموذج Portrait Official من النواة الرسمية.</p>"
            + "<div id=\"program-evidence-host\"></div>"
            + "</details>"
            + actionsHtml("حفظ", "facility-actions")
            + "</form></div>"
        );
        var form = pane.querySelector("#program-form");
        var note = pane.querySelector("#program-list-note");
        var formNote = form.querySelector(".wash-note");
        var evidenceHost = pane.querySelector("#program-evidence-host");
        var catalog = { programs: [], templates: [], registers: [], owners: [], statuses: [], indicators: [], phrases: {} };
        var editing = null;
        var evidenceItems = [];
        var phraseFields = [
            { key: "mechanism", select: "mechanismPhrase", input: "mechanismPhraseNew", target: "mechanism" },
            { key: "success_indicator", select: "successPhrase", input: "successPhraseNew", target: "successIndicator" },
            { key: "risk_management", select: "riskPhrase", input: "riskPhraseNew", target: "riskManagement" }
        ];
        function escapeHtml(value) {
            return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        }
        function templateKeyFor(record) {
            if (record && record.key) {
                return record.key;
            }
            var name = String((record && record.program_name) || "");
            var exact = catalog.templates.filter(function (item) {
                return item.program_name === name;
            })[0];
            if (exact) {
                return exact.key;
            }
            var hints = [
                ["الفاقد", "loss"],
                ["الانضباط", "discipline"],
                ["التوجيه المهني", "career"],
                ["الموهوب", "gifted"],
                ["الشراكة المجتمعية", "partnership"],
                ["ارتقاء", "irtiqaa"],
                ["الأمن والسلامة", "safety"],
                ["فرضيات الإخلاء", "evacuation"],
                ["صيانة المبنى", "building"],
                ["نافس", "nafs"],
                ["الدعم والتقوية", "support"],
                ["الزيارات الصفية", "visits"],
                ["مجتمعات التعلم", "plc"],
                ["أولياء الأمور", "parent_meet"],
                ["التطوع", "volunteer"],
                ["التخطيط الاستراتيجي", "planning"],
                ["التطوير المهني", "pd"]
            ];
            for (var i = 0; i < hints.length; i += 1) {
                if (name.indexOf(hints[i][0]) >= 0) {
                    return hints[i][1];
                }
            }
            return "";
        }
        function applyTemplateMeasures(template) {
            if (!template) {
                return;
            }
            if (template.domain) {
                form.elements.domain.value = template.domain;
            }
            if (template.level_name) {
                form.elements.levelName.value = template.level_name;
            }
            if (template.goal_ref) {
                drawPlanGoals(template.goal_ref);
            }
            if (template.baseline_value) {
                form.elements.baselineValue.value = template.baseline_value;
            }
            if (template.current_value) {
                form.elements.currentValue.value = template.current_value;
            }
            if (template.target_value) {
                form.elements.targetValue.value = template.target_value;
            }
            if (template.unit) {
                form.elements.measureUnit.value = template.unit;
            }
            if (template.kpi_description) {
                form.elements.kpiDescription.value = template.kpi_description;
            }
            syncKpiChoices();
            markEvalLevels(document.getElementById("erp-pane"));
        }
        function drawPhraseLists() {
            var key = form.dataset.templateKey || "";
            var bank = (catalog.phrases && catalog.phrases[key]) || {};
            phraseFields.forEach(function (item) {
                var phrases = bank[item.key] || [];
                var blank = phrases.length ? "اختر عبارة" : "لا عبارات لهذا البرنامج بعد";
                form.elements[item.select].innerHTML = "<option value=\"\">" + blank + "</option>" + phrases.map(function (phrase) {
                    return "<option value=\"" + escapeHtml(phrase) + "\">" + escapeHtml(phrase) + "</option>";
                }).join("");
            });
        }
        function appendPhrase(targetName, phrase) {
            var field = form.elements[targetName];
            var text = String(phrase || "").trim();
            if (!text) {
                return;
            }
            var lines = field.value.split("\n").map(function (line) {
                return line.trim();
            });
            if (lines.indexOf(text) >= 0) {
                return;
            }
            field.value = field.value.trim() ? field.value.replace(/\s*$/, "") + "\n" + text : text;
        }
        function ownerRolesOf(record) {
            if (record && record.owner_roles && record.owner_roles.length) {
                return record.owner_roles;
            }
            return record && record.owner_role ? [record.owner_role] : [];
        }
        function fillChoice(select, rows, selected) {
            select.innerHTML = "<option value=\"\"></option>" + (rows || []).map(function (item) {
                var value = item.value || "";
                var label = item.label || value;
                return "<option value=\"" + escapeHtml(value) + "\"" + (String(value) === String(selected || "") ? " selected" : "") + ">" + escapeHtml(label) + "</option>";
            }).join("");
        }
        function drawKnowledge() {
            var knowledge = catalog.knowledge || {};
            fillChoice(form.elements.domain, knowledge.domain, form.elements.domain.value);
            fillChoice(form.elements.levelName, knowledge.level, form.elements.levelName.value);
            fillChoice(form.elements.audienceChoice, knowledge.audience, "");
        }
        function leadingNumber(text) {
            var match = String(text || "").match(/^\d+(?:\.\d+)?/);
            return match ? match[0] : "";
        }
        function drawKpi() {
            var kpi = catalog.kpi || {};
            fillChoice(form.elements.baselineChoice, kpi.baseline, "");
            fillChoice(form.elements.currentChoice, kpi.current, "");
            fillChoice(form.elements.targetChoice, kpi.target, "");
            fillChoice(form.elements.kpiChoice, kpi.kpi_description, "");
            syncKpiChoices();
        }
        function pickKpi(select, stored) {
            var wanted = String(stored || "");
            var found = "";
            Array.prototype.forEach.call(select.options, function (option) {
                if (found || !option.value) {
                    return;
                }
                if (option.value === wanted || leadingNumber(option.value) === wanted) {
                    found = option.value;
                }
            });
            select.value = found;
        }
        function syncKpiChoices() {
            pickKpi(form.elements.baselineChoice, form.elements.baselineValue.value);
            pickKpi(form.elements.currentChoice, form.elements.currentValue.value);
            pickKpi(form.elements.targetChoice, form.elements.targetValue.value);
            pickKpi(form.elements.kpiChoice, form.elements.kpiDescription.value);
        }
        function drawPlanGoals(selected) {
            var goals = catalog.plan_goals || [];
            form.elements.goalRef.innerHTML = "<option value=\"\">بلا ربط</option>" + goals.map(function (goal) {
                return "<option value=\"" + escapeHtml(goal.id) + "\"" + (goal.id === selected ? " selected" : "") + ">" + escapeHtml(goal.id + " — " + goal.text) + "</option>";
            }).join("");
        }
        function drawOwners(selected) {
            var chosen = selected || [];
            form.querySelector("#program-owners").innerHTML = catalog.owners.map(function (owner) {
                var checked = chosen.indexOf(owner.role) >= 0 ? " checked" : "";
                return "<label class=\"owner-choice" + (checked ? " is-on" : "") + "\"><input type=\"checkbox\" name=\"ownerRoles\" value=\"" + owner.role + "\"" + checked + "><span>" + escapeHtml(owner.label) + "</span></label>";
            }).join("");
        }

        function paintProgramPath() {
            var title = pane.querySelector("#program-form-title");
            var path = pane.querySelector("#program-path");
            var name = form.elements.programName.value.trim() || "برنامج جديد";
            var register = form.elements.registerId;
            var registerLabel = register && register.selectedIndex >= 0 ? register.options[register.selectedIndex].textContent : "";
            var owners = selectedOwners().map(function (role) {
                var found = catalog.owners.filter(function (item) { return item.role === role; })[0];
                return found ? found.label : role;
            }).filter(Boolean);
            var status = form.elements.status.value || "مسودة";
            if (title) {
                title.textContent = name;
            }
            if (path) {
                path.textContent = [
                    registerLabel && registerLabel !== "اختر السجل" ? registerLabel : "بلا سجل بعد",
                    owners.length ? owners.join("، ") : "بلا صاحب بعد",
                    status === "معتمد" ? "يظهر في خطة الصاحب بعد الاعتماد" : "مسودة — لا يظهر في الخطة حتى الاعتماد"
                ].join(" ← ");
            }
        }
        function selectedOwners() {
            return Array.prototype.filter.call(form.querySelectorAll("[name=ownerRoles]"), function (input) {
                return input.checked;
            }).map(function (input) {
                return input.value;
            });
        }
        function selectedIndicators() {
            return Array.prototype.filter.call(form.elements.indicatorIds.options, function (option) {
                return option.selected;
            }).map(function (option) {
                return Number(option.value);
            });
        }
        var evidenceLoadSeq = 0;
        function programEvidenceKey() {
            if (editing && editing.id) {
                form.dataset.evidenceKey = "program-" + String(editing.id);
                return form.dataset.evidenceKey;
            }
            if (form.dataset.evidenceKey) {
                return form.dataset.evidenceKey;
            }
            form.dataset.evidenceKey = "program-draft-" + String(Date.now());
            return form.dataset.evidenceKey;
        }
        function registerKeyForProgram() {
            var id = Number(form.elements.registerId.value || (editing && editing.register_id) || 0);
            var map = {
                1: "leadership",
                2: "pd",
                3: "curriculum",
                4: "discipline",
                5: "activity",
                6: "facility"
            };
            return map[id] || "programs";
        }
        function paintProgramEvidence() {
            if (!evidenceHost || !window.board1059VisualEvidence) {
                return;
            }
            var key = programEvidenceKey();
            var programId = editing && editing.id ? editing.id : "";
            evidenceHost.innerHTML = window.board1059VisualEvidence.panelHtml({
                entityType: "program",
                entityKey: key,
                entityId: programId,
                programId: programId,
                registerKey: registerKeyForProgram(),
                items: evidenceItems
            });
        }
        function hydrateProgramEvidencePreview(items) {
            var headers = {};
            if (window.board1059Access && typeof window.board1059Access.headers === "function") {
                Object.assign(headers, window.board1059Access.headers() || {});
            }
            headers.Accept = "application/octet-stream";
            return Promise.all((items || []).map(function (item) {
                var copy = item && typeof item === "object" ? Object.assign({}, item) : {};
                var kind = String(copy.kind || "");
                var isPdf = kind === "pdf" || /\.pdf$/i.test(String(copy.name || copy.url || ""));
                var isImage = kind === "image";
                var fileUrl = copy.id ? "/api/session/evidence/" + encodeURIComponent(String(copy.id)) + "/file" : "";
                if (!fileUrl || (!isPdf && !isImage)) {
                    return copy;
                }
                return fetch(fileUrl, { headers: headers, cache: "no-store" }).then(function (response) {
                    if (!response.ok) {
                        return copy;
                    }
                    return response.blob().then(function (blob) {
                        if (!blob || blob.size < 500) {
                            return copy;
                        }
                        var mime = isPdf ? "application/pdf" : (blob.type && blob.type.indexOf("image/") === 0 ? blob.type : "image/jpeg");
                        copy.url = URL.createObjectURL(new Blob([blob], { type: mime }));
                        copy.kind = isPdf ? "pdf" : "image";
                        return copy;
                    });
                }).catch(function () {
                    return copy;
                });
            }));
        }
        function loadProgramEvidence(key) {
            var entityKey = key || programEvidenceKey();
            var seq = ++evidenceLoadSeq;
            // المسودة محلية: لا تُفرَّغ الشواهد المرفوعة ولا تُجلب من API بمفتاح مشترك.
            if (!entityKey || entityKey.indexOf("program-draft-") === 0) {
                paintProgramEvidence();
                return Promise.resolve(evidenceItems.slice());
            }
            evidenceItems = [];
            paintProgramEvidence();
            return fetch("/api/visual-evidence?entity_type=program&entity_key=" + encodeURIComponent(entityKey))
                .then(function (response) { return response.json(); })
                .then(function (payload) {
                    if (seq !== evidenceLoadSeq) {
                        return evidenceItems.slice();
                    }
                    evidenceItems = (payload && payload.items) || [];
                    paintProgramEvidence();
                    return evidenceItems.slice();
                })
                .catch(function () {
                    if (seq !== evidenceLoadSeq) {
                        return evidenceItems.slice();
                    }
                    paintProgramEvidence();
                    return [];
                });
        }
        function rebindProgramEvidence(fromKey, toKey) {
            if (!fromKey || !toKey || fromKey === toKey) {
                return Promise.resolve(null);
            }
            if (fromKey.indexOf("program-draft-") !== 0) {
                return Promise.resolve(null);
            }
            var headers = { "Content-Type": "application/json" };
            if (window.board1059Access && typeof window.board1059Access.headers === "function") {
                Object.assign(headers, window.board1059Access.headers() || {});
            }
            return fetch("/api/visual-evidence/rebind", {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    entity_type: "program",
                    from_key: fromKey,
                    to_key: toKey
                })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error((payload && payload.detail) || "تعذر ترحيل الشواهد");
                    }
                    return payload;
                });
            });
        }
        pane._onProgramEvidenceChanged = function (items) {
            evidenceItems = Array.isArray(items) ? items : [];
            paintProgramEvidence();
            if (formNote) {
                formNote.textContent = "حُفظ المرفق البصري مع البرنامج.";
            }
        };
        function currentProgramSnapshot() {
            var register = form.elements.registerId;
            var registerLabel = register && register.selectedIndex >= 0
                ? register.options[register.selectedIndex].textContent
                : ((editing && editing.register_label) || "");
            if (registerLabel === "اختر السجل") {
                registerLabel = "";
            }
            var owners = selectedOwners().map(function (role) {
                var found = catalog.owners.filter(function (item) { return item.role === role; })[0];
                return found ? found.label : role;
            }).filter(Boolean);
            var codes = selectedIndicators().map(function (id) {
                var found = catalog.indicators.filter(function (item) { return Number(item.id) === Number(id); })[0];
                return found ? found.code : "";
            }).filter(Boolean);
            return {
                id: editing && editing.id || 0,
                program_name: form.elements.programName.value.trim(),
                status: form.elements.status.value || "مسودة",
                register_id: Number(form.elements.registerId.value || 0),
                register_label: registerLabel,
                owner_label: owners.join("، "),
                owner_roles: selectedOwners(),
                domain: form.elements.domain.value,
                level_name: form.elements.levelName.value,
                goal_ref: form.elements.goalRef.value,
                strategic_goal: form.elements.strategicGoal.value.trim(),
                executive_goal: form.elements.executiveGoal.value.trim(),
                target_audience: form.elements.targetAudience.value.trim(),
                duration: form.elements.duration.value.trim(),
                implementers: form.elements.implementers.value.trim(),
                budget: form.elements.budget.value.trim(),
                mechanism: form.elements.mechanism.value.trim(),
                success_indicator: form.elements.successIndicator.value.trim(),
                risk_management: form.elements.riskManagement.value.trim(),
                baseline_value: form.elements.baselineValue.value.trim(),
                current_value: form.elements.currentValue.value.trim(),
                target_value: form.elements.targetValue.value.trim(),
                unit: form.elements.measureUnit.value,
                kpi_description: form.elements.kpiDescription.value.trim(),
                indicator_codes: codes
            };
        }
        function openProgramPrint(doPrint) {
            if (!window.PrintTemplates || typeof window.PrintTemplates.openProgramCard !== "function") {
                formNote.textContent = "نماذج الطباعة غير محمّلة.";
                return;
            }
            var snap = currentProgramSnapshot();
            if (!snap.program_name) {
                formNote.textContent = "أدخل اسم البرنامج قبل المعاينة أو الطباعة.";
                return;
            }
            if (!snap.register_id) {
                formNote.textContent = "اختر السجل المرتبط قبل طباعة بطاقة البرنامج.";
                return;
            }
            var key = programEvidenceKey();
            loadProgramEvidence(key).then(function (items) {
                return hydrateProgramEvidencePreview(items || evidenceItems);
            }).then(function (items) {
                window.PrintTemplates.openProgramCard(snap, items || evidenceItems, !!doPrint);
                formNote.textContent = doPrint
                    ? "جاري طباعة بطاقة البرنامج (Portrait Official)."
                    : "معاينة بطاقة البرنامج جاهزة.";
            });
        }
        function fillSelect(select, rows, valueKey, labelKey, selected, blank) {
            var markup = blank ? "<option value=\"\">" + blank + "</option>" : "";
            markup += (rows || []).map(function (row) {
                var value = row[valueKey];
                return "<option value=\"" + value + "\"" + (String(value) === String(selected) ? " selected" : "") + ">" + row[labelKey] + "</option>";
            }).join("");
            select.innerHTML = markup;
        }
        function applyRecord(record) {
            editing = record || {};
            fillSelect(form.elements.registerId, catalog.registers, "id", "label", editing.register_id || "", "اختر السجل");
            drawOwners(ownerRolesOf(editing));
            fillSelect(form.elements.status, catalog.statuses.map(function (status) {
                return { id: status, label: status };
            }), "id", "label", editing.status || "مسودة", "");
            form.elements.programName.value = editing.program_name || "";
            form.elements.strategicGoal.value = editing.strategic_goal || "";
            drawPlanGoals(editing.goal_ref || "");
            form.elements.executiveGoal.value = editing.executive_goal || "";
            form.elements.targetAudience.value = editing.target_audience || "";
            form.elements.duration.value = editing.duration || "";
            form.elements.implementers.value = editing.implementers || "";
            form.elements.budget.value = editing.budget || "";
            form.elements.mechanism.value = editing.mechanism || "";
            form.elements.successIndicator.value = editing.success_indicator || "";
            form.elements.riskManagement.value = editing.risk_management || "";
            form.elements.domain.value = editing.domain || "";
            form.elements.levelName.value = editing.level_name || "";
            markEvalLevels(document.getElementById("erp-pane"));
            form.elements.baselineValue.value = editing.baseline_value || "";
            form.elements.currentValue.value = editing.current_value || "";
            form.elements.targetValue.value = editing.target_value || "";
            form.elements.measureUnit.value = editing.unit || "";
            form.elements.kpiDescription.value = editing.kpi_description || "";
            form.elements.dutyLabel.value = editing.duty_label || "";
            var chosen = editing.indicator_ids || [];
            Array.prototype.forEach.call(form.elements.indicatorIds.options, function (option) {
                option.selected = chosen.indexOf(Number(option.value)) >= 0;
            });
            form.dataset.templateKey = templateKeyFor(editing);
            evidenceItems = [];
            if (editing && editing.id) {
                form.dataset.evidenceKey = "program-" + String(editing.id);
            } else {
                delete form.dataset.evidenceKey;
            }
            syncKpiChoices();
            drawPhraseLists();
            drawTemplates();
            paintProgramPath();
            paintProgramEvidence();
            loadProgramEvidence(form.dataset.evidenceKey || "");
            form.hidden = false;
            form.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        function drawTemplates() {
            var key = form.dataset.templateKey || "";
            pane.querySelector("#program-templates").innerHTML = catalog.templates.map(function (item) {
                var on = item.key === key ? " is-on" : "";
                return "<button type=\"button\" class=\"program-template" + on + "\" data-template=\"" + item.key + "\">" + item.label + "</button>";
            }).join("");
        }
        function drawFilters() {
            fillSelect(pane.querySelector("#program-status"), catalog.statuses.map(function (status) {
                return { id: status, label: status };
            }), "id", "label", "", "");
            pane.querySelector("#program-status").insertAdjacentHTML("afterbegin", "<option value=\"\">كل الحالات</option>");
            fillSelect(pane.querySelector("#program-owner"), catalog.owners, "role", "label", "", "");
            pane.querySelector("#program-owner").insertAdjacentHTML("afterbegin", "<option value=\"\">كل أصحاب البرامج</option>");
            fillSelect(pane.querySelector("#program-register"), catalog.registers, "id", "label", "", "");
            pane.querySelector("#program-register").insertAdjacentHTML("afterbegin", "<option value=\"\">كل السجلات</option>");
            pane.querySelector("#program-status").value = "";
            pane.querySelector("#program-owner").value = "";
            pane.querySelector("#program-register").value = "";
        }
        function drawStats() {
            var host = pane.querySelector("#program-stats");
            if (!host) {
                return;
            }
            var total = catalog.programs.length;
            var approved = catalog.programs.filter(function (item) { return item.status === "معتمد"; }).length;
            var draft = catalog.programs.filter(function (item) { return item.status === "مسودة"; }).length;
            var current = pane.querySelector("#program-status").value;
            host.innerHTML = [
                { key: "", label: "الكل", value: total },
                { key: "معتمد", label: "معتمد", value: approved },
                { key: "مسودة", label: "مسودة", value: draft }
            ].map(function (item) {
                return "<button type=\"button\" class=\"program-stat" + (current === item.key ? " is-on" : "") + "\" data-status-filter=\"" + item.key + "\"><b>" + item.value + "</b><span>" + item.label + "</span></button>";
            }).join("");
        }

        function drawRows() {
            var query = pane.querySelector("#program-search").value.trim();
            var status = pane.querySelector("#program-status").value;
            var owner = pane.querySelector("#program-owner").value;
            var registerId = pane.querySelector("#program-register").value;
            var rows = catalog.programs.filter(function (item) {
                if (status && item.status !== status) {
                    return false;
                }
                var owners = item.owner_roles && item.owner_roles.length ? item.owner_roles : [item.owner_role];
                if (owner && owners.indexOf(owner) < 0) {
                    return false;
                }
                if (registerId && String(item.register_id) !== registerId) {
                    return false;
                }
                if (!query) {
                    return true;
                }
                var hay = [item.program_name, item.owner_label, item.register_label, item.domain, item.level_name].join(" ");
                return hay.indexOf(query) >= 0;
            });
            pane.querySelector("#program-rows").innerHTML = rows.map(function (item) {
                var canApprove = window.board1059Access && window.board1059Access.isPrincipal();
                var approve = canApprove && item.status === "مسودة"
                    ? "<button type=\"button\" class=\"program-approve\" data-approve=\"" + item.id + "\">اعتماد</button>"
                    : "";
                var statusClass = item.status === "معتمد" ? "is-ok" : (item.status === "مسودة" ? "is-draft" : "is-other");
                var measure = [item.baseline_value, item.target_value].filter(Boolean).join(" → ");
                if (measure && item.unit) {
                    measure += " " + item.unit;
                }
                var domain = [item.domain, item.level_name].filter(Boolean).join(" · ");
                var codes = Array.isArray(item.indicator_codes)
                    ? item.indicator_codes
                    : String(item.indicator_codes || "").split(/[،,]/).map(function (part) { return part.trim(); }).filter(Boolean);
                return "<tr>"
                    + "<td class=\"is-name\"><strong>" + escapeHtml(item.program_name) + "</strong>"
                    + (codes.length ? "<small class=\"program-meta\">" + escapeHtml(codes.join("، ")) + "</small>" : "")
                    + "</td>"
                    + "<td>" + escapeHtml(domain) + "</td>"
                    + "<td>" + escapeHtml(item.owner_label || "") + "</td>"
                    + "<td>" + escapeHtml(item.register_label || "") + "</td>"
                    + "<td class=\"is-fit\">" + escapeHtml(measure) + "</td>"
                    + "<td><span class=\"status-chip " + statusClass + "\">" + escapeHtml(item.status || "") + "</span></td>"
                    + "<td class=\"is-fit program-actions\"><button type=\"button\" class=\"program-edit\" data-edit=\"" + item.id + "\">تعديل</button>" + approve + "</td>"
                    + "</tr>";
            }).join("");
            drawStats();
            note.textContent = rows.length
                ? rows.length + " برنامج في هذا العرض. المعتمد يظهر في خطة الصاحب وسجله."
                : "لا برامج في هذا التصفية.";
        }
        function loadIndicators() {
            return fetch("/api/evaluation").then(function (response) {
                return response.json();
            }).then(function (payload) {
                catalog.indicators = payload.indicators || [];
                form.elements.indicatorIds.innerHTML = catalog.indicators.map(function (item) {
                    return "<option value=\"" + item.id + "\">" + item.code + " — " + item.statement + "</option>";
                }).join("");
            });
        }
        function loadPrograms() {
            return fetch("/api/programs").then(function (response) {
                return response.json();
            }).then(function (payload) {
                catalog.programs = payload.programs || [];
                catalog.templates = payload.templates || [];
                catalog.registers = payload.registers || [];
                catalog.owners = payload.owners || [];
                catalog.statuses = payload.statuses || [];
                catalog.phrases = payload.phrases || {};
                catalog.plan_goals = payload.plan_goals || [];
                catalog.knowledge = payload.knowledge || {};
                catalog.kpi = payload.kpi_options || {};
                drawKnowledge();
                drawKpi();
                drawPlanGoals(form.elements.goalRef.value);
                drawTemplates();
                drawFilters();
                drawRows();
            });
        }
        Promise.all([loadPrograms(), loadIndicators()]).catch(function (error) {
            note.textContent = "تعذر قراءة البرامج" + (error && error.message ? ": " + error.message : ".");
        });
        phraseFields.forEach(function (item) {
            form.elements[item.select].addEventListener("change", function () {
                appendPhrase(item.target, this.value);
                this.value = "";
            });
        });
        form.addEventListener("click", function (event) {
            var button = event.target.closest("[data-phrase-field]");
            if (!button || !form.contains(button)) {
                return;
            }
            event.preventDefault();
            var item = phraseFields.filter(function (entry) {
                return entry.key === button.getAttribute("data-phrase-field");
            })[0];
            var phrase = form.elements[item.input].value.trim();
            var key = form.dataset.templateKey || "";
            if (!key) {
                formNote.textContent = "اختر قالب البرنامج قبل إضافة عبارة.";
                return;
            }
            if (!phrase) {
                formNote.textContent = "اكتب العبارة ثم أضفها.";
                return;
            }
            fetch("/api/programs/phrases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ template_key: key, field: item.key, phrase: phrase })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر إضافة العبارة");
                    }
                    return payload;
                });
            }).then(function (payload) {
                catalog.phrases = payload.phrases || {};
                form.elements[item.input].value = "";
                drawPhraseLists();
                appendPhrase(item.target, phrase);
                formNote.textContent = "أُضيفت العبارة إلى البنك والحقل.";
            }).catch(function (error) {
                formNote.textContent = error.message || "تعذر إضافة العبارة.";
            });
        });
        form.elements.audienceChoice.addEventListener("change", function () {
            if (this.value) {
                form.elements.targetAudience.value = this.value;
            }
        });
        ["baseline", "current", "target"].forEach(function (name) {
            form.elements[name + "Choice"].addEventListener("change", function () {
                var number = leadingNumber(this.value);
                if (!number) {
                    return;
                }
                form.elements[name + "Value"].value = number;
                form.elements.measureUnit.value = "%";
            });
        });
        form.elements.kpiChoice.addEventListener("change", function () {
            if (this.value) {
                form.elements.kpiDescription.value = this.value;
            }
        });
        pane.querySelector("#program-search").addEventListener("input", drawRows);
        pane.querySelector("#program-status").addEventListener("change", drawRows);
        pane.querySelector("#program-owner").addEventListener("change", drawRows);
        pane.querySelector("#program-register").addEventListener("change", drawRows);
        pane.querySelector("#program-stats").addEventListener("click", function (event) {
            var button = event.target.closest("[data-status-filter]");
            if (!button) {
                return;
            }
            pane.querySelector("#program-status").value = button.getAttribute("data-status-filter") || "";
            drawRows();
        });
        form.addEventListener("change", function (event) {
            if (event.target && event.target.name === "ownerRoles") {
                event.target.closest(".owner-choice").classList.toggle("is-on", event.target.checked);
            }
            paintProgramPath();
        });
        form.elements.programName.addEventListener("input", paintProgramPath);
        pane.querySelector("#program-close").addEventListener("click", function () {
            form.hidden = true;
            formNote.textContent = "";
        });
        var programActions = form.querySelector(".wash-actions");
        if (programActions) {
            var previewProgramBtn = document.createElement("button");
            previewProgramBtn.type = "button";
            previewProgramBtn.className = "wash-print";
            previewProgramBtn.textContent = "معاينة بطاقة البرنامج";
            var printProgramBtn = document.createElement("button");
            printProgramBtn.type = "button";
            printProgramBtn.className = "wash-print";
            printProgramBtn.textContent = "طباعة بطاقة البرنامج";
            var cancelBtn = programActions.querySelector(".wash-cancel");
            if (cancelBtn) {
                programActions.insertBefore(previewProgramBtn, cancelBtn);
                programActions.insertBefore(printProgramBtn, cancelBtn);
            } else {
                programActions.appendChild(previewProgramBtn);
                programActions.appendChild(printProgramBtn);
            }
            previewProgramBtn.addEventListener("click", function () {
                openProgramPrint(false);
            });
            printProgramBtn.addEventListener("click", function () {
                openProgramPrint(true);
            });
        }
        form.elements.registerId.addEventListener("change", function () {
            paintProgramEvidence();
            paintProgramPath();
        });
        pane.querySelector("#program-add").addEventListener("click", function () {
            evidenceItems = [];
            applyRecord({ status: "مسودة", indicator_ids: [] });
            formNote.textContent = "مسودة جديدة. املأ الحقول أو اختر قالبًا ثم احفظ.";
        });
        pane.querySelector("#program-templates").addEventListener("click", function (event) {
            var button = event.target.closest("[data-template]");
            if (!button) {
                return;
            }
            var template = catalog.templates.filter(function (item) {
                return item.key === button.getAttribute("data-template");
            })[0];
            if (!template) {
                return;
            }
            applyRecord(Object.assign({ id: editing && editing.id || 0, status: editing && editing.status || "مسودة" }, template));
            applyTemplateMeasures(template);
            var codes = (template.indicator_codes || []).join("، ");
            formNote.textContent = "امتلأت الحقول من المصدر التربوي للقالب"
                + (template.goal_ref ? " وربط الهدف " + template.goal_ref : "")
                + (codes ? " والمؤشرات " + codes : "")
                + ". راجعها ثم احفظ؛ لا يُحفظ إلا بالزر.";
        });
        pane.querySelector("#program-rows").addEventListener("click", function (event) {
            var edit = event.target.closest("[data-edit]");
            var approve = event.target.closest("[data-approve]");
            if (edit) {
                var found = catalog.programs.filter(function (item) {
                    return String(item.id) === edit.getAttribute("data-edit");
                })[0];
                applyRecord(found);
                formNote.textContent = "";
            }
            if (approve) {
                fetch("/api/programs/approve", {
                    method: "POST",
                    headers: window.board1059Access ? window.board1059Access.headers() : { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: Number(approve.getAttribute("data-approve")) })
                }).then(function (response) {
                    return response.json().then(function (payload) {
                        if (!response.ok) {
                            throw new Error(payload.detail || "تعذر الاعتماد");
                        }
                        return payload;
                    });
                }).then(function () {
                    note.textContent = "اعتُمد البرنامج، ويظهر الآن في خطة كل صاحب مختار وفي سجل برنامجه.";
                    if (window.dataHub) {
                        window.dataHub.publish("programs");
                    }
                    return loadPrograms();
                }).catch(function (error) {
                    note.textContent = error.message || "تعذر الاعتماد.";
                });
            }
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var source = editing || {};
            fetch("/api/programs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: source.id || 0,
                    program_name: form.elements.programName.value.trim(),
                    strategic_goal: form.elements.strategicGoal.value.trim(),
                    goal_ref: form.elements.goalRef.value,
                    executive_goal: form.elements.executiveGoal.value.trim(),
                    target_audience: form.elements.targetAudience.value.trim(),
                    duration: form.elements.duration.value.trim(),
                    implementers: form.elements.implementers.value.trim(),
                    budget: form.elements.budget.value.trim(),
                    mechanism: form.elements.mechanism.value.trim(),
                    success_indicator: form.elements.successIndicator.value.trim(),
                    risk_management: form.elements.riskManagement.value.trim(),
                    baseline_value: form.elements.baselineValue.value.trim(),
                    current_value: form.elements.currentValue.value.trim(),
                    target_value: form.elements.targetValue.value.trim(),
                    unit: form.elements.measureUnit.value,
                    kpi_description: form.elements.kpiDescription.value.trim(),
                    domain: form.elements.domain.value,
                    level_name: form.elements.levelName.value,
                    register_id: Number(form.elements.registerId.value),
                    owner_role: selectedOwners()[0] || "",
                    owner_roles: selectedOwners(),
                    indicator_ids: selectedIndicators(),
                    status: form.elements.status.value,
                    duty_ref: source.duty_ref || "",
                    task_ref: source.task_ref || ""
                })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر الحفظ");
                    }
                    return payload;
                });
            }).then(function (payload) {
                var status = form.elements.status.value;
                var name = form.elements.programName.value.trim();
                var programs = (payload && payload.programs) || [];
                var saved = null;
                if (source.id) {
                    saved = programs.filter(function (item) {
                        return Number(item.id) === Number(source.id);
                    })[0];
                }
                if (!saved) {
                    saved = programs.filter(function (item) {
                        return item.program_name === name;
                    }).sort(function (a, b) {
                        return Number(b.id || 0) - Number(a.id || 0);
                    })[0];
                }
                if (saved) {
                    var previousKey = form.dataset.evidenceKey || "";
                    var targetKey = "program-" + String(saved.id);
                    editing = saved;
                    form.dataset.evidenceKey = targetKey;
                    return rebindProgramEvidence(previousKey, targetKey)
                        .catch(function () { return null; })
                        .then(function (rebound) {
                            if (rebound && Array.isArray(rebound.items)) {
                                evidenceItems = rebound.items;
                            }
                            paintProgramEvidence();
                            return loadProgramEvidence(targetKey);
                        })
                        .then(function () {
                            note.textContent = status === "معتمد"
                                ? "حُفظ البرنامج معتمدًا، ويظهر في خطة كل صاحب مختار وفي سجل برنامجه."
                                : "حُفظ البرنامج مسودة. يظهر في الخطة بعد اعتماد المدير. يمكنك رفع الشواهد وطباعة البطاقة.";
                            formNote.textContent = "حُفظ. معاينة/طباعة بطاقة البرنامج متاحة الآن.";
                            if (window.dataHub) {
                                window.dataHub.publish("programs");
                            }
                            return loadPrograms();
                        });
                }
                note.textContent = status === "معتمد"
                    ? "حُفظ البرنامج معتمدًا، ويظهر في خطة كل صاحب مختار وفي سجل برنامجه."
                    : "حُفظ البرنامج مسودة. يظهر في الخطة بعد اعتماد المدير. يمكنك رفع الشواهد وطباعة البطاقة.";
                formNote.textContent = "حُفظ. معاينة/طباعة بطاقة البرنامج متاحة الآن.";
                if (window.dataHub) {
                    window.dataHub.publish("programs");
                }
                return loadPrograms();
            }).catch(function (error) {
                formNote.textContent = error.message || "تعذر الحفظ.";
            });
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            form.hidden = true;
            formNote.textContent = "";
        });
    }


    function paintPlanSeat(pane) {
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<div class=\"plan-seat\">"
            + "<div class=\"plan-seat-tools no-print\">"
            + "<button class=\"wash-save\" id=\"plan-seat-save\" type=\"button\">حفظ</button>"
            + "<button class=\"wash-save\" id=\"plan-seat-print\" type=\"button\">طباعة</button>"
            + "<button class=\"wash-save\" id=\"plan-seat-zoom-in\" type=\"button\">تكبير</button>"
            + "<button class=\"wash-save\" id=\"plan-seat-zoom-out\" type=\"button\">تصغير</button>"
            + "<button class=\"wash-back\" type=\"button\">العودة</button>"
            + "</div>"
            + "<p class=\"wash-note no-print\" id=\"plan-seat-note\"></p>"
            + "<header class=\"print-header-table\">"
            + "<div class=\"plan-seat-side identity-stack\"><div>المملكة العربية السعودية</div><div>وزارة التعليم</div><div>الإدارة العامة للتعليم بمنطقة المدينة المنورة</div><div>متوسطة سعد بن الربيع الأنصاري</div></div>"
            + "<div class=\"print-header-logo\"><img src=\"/assets/ministry_logo.png\" alt=\"وزارة التعليم\"></div>"
            + "<div class=\"plan-seat-side is-end\"><div>الخطة التشغيلية</div><div id=\"plan-seat-year\"></div></div>"
            + "</header>"
            + "<div class=\"table-wrapper\" id=\"plan-seat-groups\"></div>"
            + "</div>"
        );
        var plainBoard = pane.querySelector(".wash-board");
        if (plainBoard) {
            plainBoard.classList.add("is-plain");
        }
        var note = pane.querySelector("#plan-seat-note");
        var groupsHost = pane.querySelector("#plan-seat-groups");
        var records = [];
        var seatScale = 1;
        function escapeHtml(value) {
            return String(value == null ? "" : value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
        }
        var seatedIds = [1, 2, 4, 5];
        function fieldBox(id, field, value) {
            return "<td><textarea class=\"editable-cell\" data-id=\"" + id + "\" data-field=\"" + field + "\">" + escapeHtml(value) + "</textarea></td>";
        }
        function lockedCell(value) {
            return "<td><input class=\"plan-seat-locked\" type=\"text\" value=\"" + escapeHtml(value || "") + "\" disabled readonly tabindex=\"-1\"></td>";
        }
        function goalRow(label, text, kind) {
            var mark = kind === "general" ? " is-general" : "";
            return "<tr class=\"plan-seat-goal-row" + mark + "\"><td colspan=\"13\"><span>" + label + "</span> " + escapeHtml(text) + "</td></tr>";
        }
        function applyScale() {
            var table = groupsHost.querySelector(".plan-seat-table");
            if (!table) {
                groupsHost.style.minHeight = "";
                return;
            }
            table.style.transform = seatScale === 1 ? "" : "scale(" + seatScale + ")";
            table.style.transformOrigin = "top center";
            groupsHost.style.minHeight = seatScale === 1 ? "" : Math.ceil(table.offsetHeight * seatScale) + "px";
        }
        function fitCells() {
            groupsHost.querySelectorAll("textarea.editable-cell").forEach(function (node) {
                node.style.height = "auto";
                node.style.height = node.scrollHeight + "px";
            });
            applyScale();
        }
        function draw(list) {
            if (!list.length) {
                groupsHost.innerHTML = "";
                return;
            }
            var body = list.map(function (item, index) {
                return goalRow("الهدف العام", item.strategic_goal, "general")
                    + goalRow("الهدف التفصيلي", item.executive_goal, "detail")
                    + "<tr class=\"program-row\" data-program=\"" + item.id + "\">"
                    + "<td class=\"plan-seat-index\">" + (index + 1) + "</td>"
                    + "<td></td>"
                    + fieldBox(item.id, "program_name", item.program_name)
                    + fieldBox(item.id, "duration", item.duration)
                    + lockedCell()
                    + fieldBox(item.id, "target_audience", item.target_audience)
                    + fieldBox(item.id, "budget", item.budget)
                    + lockedCell()
                    + fieldBox(item.id, "mechanism", item.mechanism)
                    + fieldBox(item.id, "implementers", item.implementers)
                    + lockedCell()
                    + fieldBox(item.id, "success_indicator", item.success_indicator)
                    + lockedCell(item.status)
                    + "</tr>";
            }).join("");
            groupsHost.innerHTML = "<table class=\"plan-seat-table\"><thead><tr>"
                + "<th>م</th><th>الهدف العام / التفصيلي</th><th>اسم البرنامج</th>"
                + "<th>زمن التنفيذ (الفصل)</th><th>زمن التنفيذ (الأسبوع)</th><th>المستهدفون</th>"
                + "<th>المتطلبات المالية</th><th>المتطلبات غير المالية</th><th>أسلوب التنفيذ</th>"
                + "<th>مسؤول التنفيذ (رئيس)</th><th>مسؤول التنفيذ (مساند)</th><th>مؤشر الإنجاز</th><th>الحالة</th>"
                + "</tr></thead><tbody>" + body + "</tbody></table>";
            fitCells();
        }
        function valueOf(scope, field) {
            var node = scope.querySelector("[data-field=\"" + field + "\"]");
            return node ? node.value.trim() : "";
        }
        function saveAll() {
            var chain = Promise.resolve();
            records.forEach(function (record) {
                chain = chain.then(function () {
                    var row = groupsHost.querySelector("tr[data-program=\"" + record.id + "\"]");
                    if (!row) {
                        return null;
                    }
                    return fetch("/api/programs", {
                        method: "POST",
                        headers: window.board1059Access ? window.board1059Access.headers() : { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            id: record.id,
                            program_name: valueOf(row, "program_name"),
                            strategic_goal: record.strategic_goal || "",
                            goal_ref: record.goal_ref || "",
                            executive_goal: record.executive_goal || "",
                            target_audience: valueOf(row, "target_audience"),
                            duration: valueOf(row, "duration"),
                            implementers: valueOf(row, "implementers"),
                            budget: valueOf(row, "budget"),
                            mechanism: valueOf(row, "mechanism"),
                            success_indicator: valueOf(row, "success_indicator"),
                            risk_management: record.risk_management || "",
                            baseline_value: record.baseline_value || "",
                            current_value: record.current_value || "",
                            target_value: record.target_value || "",
                            unit: record.unit || "",
                            kpi_description: record.kpi_description || "",
                            domain: record.domain || "",
                            level_name: record.level_name || "",
                            register_id: record.register_id,
                            owner_role: record.owner_role || "",
                            owner_roles: record.owner_roles || [],
                            indicator_ids: record.indicator_ids || [],
                            status: record.status || "",
                            duty_ref: record.duty_ref || "",
                            task_ref: record.task_ref || ""
                        })
                    }).then(function (response) {
                        return response.json().then(function (payload) {
                            if (!response.ok) {
                                throw new Error((record.program_name || "البرنامج") + ": " + (payload.detail || "تعذر الحفظ"));
                            }
                        });
                    });
                });
            });
            chain.then(function () {
                note.textContent = "حُفظت حقول البرنامج. الأهداف والحالة كما هما في القاعدة.";
                if (window.dataHub) {
                    window.dataHub.publish("programs");
                }
                return load();
            }).catch(function (error) {
                note.textContent = error.message || "تعذر الحفظ.";
            });
        }
        function load() {
            return fetch("/api/programs").then(function (response) {
                return response.json();
            }).then(function (payload) {
                records = (payload.programs || []).filter(function (item) {
                    return seatedIds.indexOf(item.id) >= 0;
                }).sort(function (a, b) {
                    return seatedIds.indexOf(a.id) - seatedIds.indexOf(b.id);
                });
                draw(records);
            });
        }
        groupsHost.addEventListener("input", function (event) {
            var node = event.target;
            if (!node || !node.classList || !node.classList.contains("editable-cell")) {
                return;
            }
            node.style.height = "auto";
            node.style.height = node.scrollHeight + "px";
        });
        function changeScale(step) {
            var next = Math.round((seatScale + step) * 10) / 10;
            if (next < 0.8 || next > 1.4) {
                return;
            }
            seatScale = next;
            applyScale();
        }
        pane.querySelector("#plan-seat-zoom-in").addEventListener("click", function () {
            changeScale(0.1);
        });
        pane.querySelector("#plan-seat-zoom-out").addEventListener("click", function () {
            changeScale(-0.1);
        });
        pane.querySelector("#plan-seat-save").addEventListener("click", saveAll);
        pane.querySelector("#plan-seat-print").addEventListener("click", function () {
            if (window.openPrintPreview) {
                window.openPrintPreview("print-plan-seat");
            }
        });
        Promise.all([
            fetch("/api/operational-plan").then(function (response) { return response.json(); }).catch(function () { return {}; }),
            load()
        ]).then(function (payloads) {
            pane.querySelector("#plan-seat-year").textContent = (payloads[0] && payloads[0].academic_year) || "";
        });
    }

    function paintSchoolPlan(pane) {
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<form id=\"school-plan-form\" class=\"program-board\">"
            + "<h1>الخطة التشغيلية للمدرسة</h1>"
            + "<p class=\"wash-hint\" id=\"school-plan-source\"></p>"
            + "<section class=\"board-card board-span\">"
            + "<p class=\"wash-section\">الرؤية والرسالة والقيم</p>"
            + "<label class=\"wash-field wash-span\"><span>الرؤية</span><textarea name=\"vision\" rows=\"2\"></textarea></label>"
            + "<label class=\"wash-field wash-span\"><span>الرسالة</span><textarea name=\"mission\" rows=\"2\"></textarea></label>"
            + "<label class=\"wash-field wash-span\"><span>القيم</span><textarea name=\"values\" rows=\"3\"></textarea></label>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<p class=\"wash-section\">تحليل الواقع</p>"
            + "<label class=\"wash-field\"><span>نقاط القوة</span><textarea name=\"strength\" rows=\"2\"></textarea></label>"
            + "<label class=\"wash-field\"><span>نقاط الضعف</span><textarea name=\"weakness\" rows=\"2\"></textarea></label>"
            + "<label class=\"wash-field\"><span>الفرص</span><textarea name=\"opportunity\" rows=\"2\"></textarea></label>"
            + "<label class=\"wash-field\"><span>التهديدات</span><textarea name=\"threat\" rows=\"2\"></textarea></label>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<p class=\"wash-section\">الأهداف الاستراتيجية</p>"
            + "<div id=\"school-plan-goals\"></div>"
            + "<button class=\"phrase-add-btn\" id=\"school-plan-add-goal\" type=\"button\">إضافة هدف</button>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<p class=\"wash-section\">الميزانية</p>"
            + "<label class=\"wash-field wash-span\"><span>توزيع الصلاحيات</span><textarea name=\"budget\" rows=\"2\"></textarea></label>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<p class=\"wash-section\">فريق التخطيط</p>"
            + "<div id=\"school-plan-team\"></div>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<p class=\"wash-section\">المتابعة والتقييم</p>"
            + "<label class=\"wash-field wash-span\"><span>آلية المتابعة</span><textarea name=\"monitoring\" rows=\"3\"></textarea></label>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<p class=\"wash-section\">ربط بند بهدف</p>"
            + "<p class=\"wash-hint\">الربط يُحفظ للبند الذي تختاره فقط.</p>"
            + "<label class=\"wash-field\"><span>الدور</span><select name=\"linkRole\"></select></label>"
            + "<label class=\"wash-field\"><span>البند</span><select name=\"linkTask\"><option value=\"\"></option></select></label>"
            + "<label class=\"wash-field\"><span>الهدف</span><select name=\"linkGoal\"><option value=\"\">بلا ربط</option></select></label>"
            + "<button class=\"phrase-add-btn\" id=\"school-plan-link\" type=\"button\">حفظ الربط</button>"
            + "<div id=\"school-plan-links\"></div>"
            + "</section>"
            + actionsHtml("حفظ الخطة", "facility-actions")
            + "</form>"
        );
        var form = pane.querySelector("#school-plan-form");
        var note = form.querySelector(".wash-note");
        var source = form.querySelector("#school-plan-source");
        var goalsHost = form.querySelector("#school-plan-goals");
        var teamHost = form.querySelector("#school-plan-team");
        var linksHost = form.querySelector("#school-plan-links");
        var plan = null;
        var roles = [
            ["principal", "مدير المدرسة"],
            ["vice_teachers", "وكيل الشؤون التعليمية"],
            ["vice_students", "وكيل شؤون الطلاب"],
            ["student_counselor", "الموجه الطلابي"],
            ["activity_leader", "رائد النشاط"]
        ];
        function escapeText(value) {
            return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        }
        function liveTeam() {
            var data = readStore("board1059.leadership") || {};
            var seats = [
                ["principal", "مدير المدرسة"],
                ["schoolVice", "وكيل الشؤون المدرسية"],
                ["educationalGuide", "الموجه التربوي"],
                ["viceTeachers", "وكيل الشؤون التعليمية"],
                ["studentsVice", "وكيل شؤون الطلاب"],
                ["primaryCounselor", "الموجه الطلابي"],
                ["activityLeader", "رائد النشاط"]
            ];
            var seen = {};
            var rows = [];
            seats.forEach(function (seat) {
                var ids = [];
                if (seat[0] === "viceTeachers" && data.viceTeachersList && data.viceTeachersList.length) {
                    ids = data.viceTeachersList;
                } else if (seat[0] === "studentsVice" && data.studentsVices && data.studentsVices.length) {
                    ids = data.studentsVices;
                } else if (data[seat[0]]) {
                    ids = [data[seat[0]]];
                }
                ids.forEach(function (id) {
                    var name = "";
                    if (seat[0] === "educationalGuide" && window.dataHub && window.dataHub.displayWritten) {
                        name = window.dataHub.displayWritten(id);
                    } else if (window.dataHub && window.dataHub.display) {
                        name = window.dataHub.display(id);
                    }
                    var key = seat[1] + "|" + name;
                    if (!name || seen[key]) {
                        return;
                    }
                    seen[key] = true;
                    rows.push({ role: seat[1], name: name });
                });
            });
            return rows;
        }
        function goalMarkup(goal, index) {
            var indicators = goal.indicators && goal.indicators.length ? goal.indicators : [{ kpi: "", target: "", measurement: "" }];
            var rows = indicators.map(function (item) {
                return "<div class=\"facility-fields\">"
                    + "<label class=\"wash-field\"><span>المؤشر</span><input data-kpi=\"kpi\" type=\"text\" value=\"" + escapeText(item.kpi) + "\"></label>"
                    + "<label class=\"wash-field\"><span>المستهدف</span><input data-kpi=\"target\" type=\"text\" value=\"" + escapeText(item.target) + "\"></label>"
                    + "<label class=\"wash-field\"><span>القياس</span><input data-kpi=\"measurement\" type=\"text\" value=\"" + escapeText(item.measurement) + "\"></label>"
                    + "</div>";
            }).join("");
            return "<article class=\"goal-editor\" data-goal-id=\"" + escapeText(goal.id || "") + "\">"
                + "<label class=\"wash-field\"><span>المجال</span><input data-goal=\"domain\" type=\"text\" value=\"" + escapeText(goal.domain) + "\"></label>"
                + "<label class=\"wash-field wash-span\"><span>نص الهدف</span><textarea data-goal=\"text\" rows=\"2\">" + escapeText(goal.text) + "</textarea></label>"
                + "<label class=\"wash-field\"><span>نسبة الإنجاز</span><input data-goal=\"progress\" type=\"text\" inputmode=\"decimal\" value=\"" + escapeText(goal.progress) + "\"></label>"
                + rows
                + "<button class=\"phrase-add-btn\" type=\"button\" data-remove-goal=\"" + index + "\">حذف الهدف</button>"
                + "</article>";
        }
        function draw(payload) {
            plan = payload;
            source.textContent = payload.source === "saved"
                ? "هذه النصوص محفوظة في جدول الخطة التشغيلية."
                : "الرؤية والأهداف من ملف المدير، ولم تُحفظ بعد في جدول الخطة. الميزانية والمتابعة فارغتان.";
            form.elements.vision.value = payload.vision || "";
            form.elements.mission.value = payload.mission || "";
            form.elements.values.value = (payload.values || []).join("\n");
            form.elements.strength.value = (payload.swot && payload.swot.strength) || "";
            form.elements.weakness.value = (payload.swot && payload.swot.weakness) || "";
            form.elements.opportunity.value = (payload.swot && payload.swot.opportunity) || "";
            form.elements.threat.value = (payload.swot && payload.swot.threat) || "";
            form.elements.budget.value = payload.budget || "";
            form.elements.monitoring.value = payload.monitoring_plan || "";
            goalsHost.innerHTML = (payload.strategic_goals || []).map(goalMarkup).join("");
            var team = liveTeam();
            if (!team.length && payload.planning_team && payload.planning_team.length) {
                team = payload.planning_team;
            }
            teamHost.innerHTML = team.length
                ? "<ul class=\"school-plan-team\">" + team.map(function (item) {
                    return "<li data-role=\"" + escapeText(item.role) + "\" data-name=\"" + escapeText(item.name) + "\">" + escapeText(item.role) + ": " + escapeText(item.name) + "</li>";
                }).join("") + "</ul>"
                : "<p class=\"wash-hint\">لا أسماء محفوظة في التشكيل القيادي.</p>";
            var goalOptions = "<option value=\"\">بلا ربط</option>" + (payload.strategic_goals || []).map(function (goal) {
                return "<option value=\"" + escapeText(goal.id) + "\">" + escapeText(goal.id + " — " + goal.text) + "</option>";
            }).join("");
            form.elements.linkGoal.innerHTML = goalOptions;
            linksHost.innerHTML = (payload.task_links || []).length
                ? "<ul class=\"school-plan-team\">" + payload.task_links.map(function (link) {
                    return "<li>" + escapeText(link.role_label) + " — " + escapeText(link.title || link.task_code) + " — " + escapeText(link.goal_id) + "</li>";
                }).join("") + "</ul>"
                : "<p class=\"wash-hint\">لا بند مربوط بهدف.</p>";
        }
        function readGoals() {
            return Array.prototype.map.call(goalsHost.querySelectorAll(".goal-editor"), function (article, index) {
                var indicators = Array.prototype.map.call(article.querySelectorAll(".facility-fields"), function (row) {
                    return {
                        kpi: row.querySelector("[data-kpi=kpi]").value.trim(),
                        target: row.querySelector("[data-kpi=target]").value.trim(),
                        measurement: row.querySelector("[data-kpi=measurement]").value.trim()
                    };
                }).filter(function (item) {
                    return item.kpi || item.target || item.measurement;
                });
                return {
                    id: article.getAttribute("data-goal-id") || ("G" + (index + 1)),
                    domain: article.querySelector("[data-goal=domain]").value.trim(),
                    text: article.querySelector("[data-goal=text]").value.trim(),
                    progress: article.querySelector("[data-goal=progress]").value.trim(),
                    indicators: indicators
                };
            }).filter(function (goal) {
                return goal.text;
            });
        }
        function readTeam() {
            return Array.prototype.map.call(teamHost.querySelectorAll("[data-name]"), function (item) {
                return { role: item.getAttribute("data-role") || "", name: item.getAttribute("data-name") || "" };
            }).filter(function (item) {
                return item.name;
            });
        }
        function load() {
            return fetch("/api/operational-plan").then(function (response) {
                return response.json();
            }).then(draw).catch(function () {
                note.textContent = "تعذر قراءة الخطة التشغيلية.";
            });
        }
        function loadTasks() {
            var role = form.elements.linkRole.value;
            fetch("/api/operational-plan/tasks?role=" + encodeURIComponent(role)).then(function (response) {
                return response.json();
            }).then(function (payload) {
                form.elements.linkTask.innerHTML = "<option value=\"\"></option>" + (payload.tasks || []).map(function (task) {
                    return "<option value=\"" + escapeText(task.task_code) + "\">" + escapeText(task.task_code + " — " + task.title) + "</option>";
                }).join("");
            }).catch(function () {
                form.elements.linkTask.innerHTML = "<option value=\"\"></option>";
            });
        }
        form.elements.linkRole.innerHTML = roles.map(function (role) {
            return "<option value=\"" + role[0] + "\">" + role[1] + "</option>";
        }).join("");
        form.elements.linkRole.addEventListener("change", loadTasks);
        form.querySelector("#school-plan-add-goal").addEventListener("click", function () {
            if (goalsHost.querySelectorAll(".goal-editor").length >= 7) {
                note.textContent = "حد الأهداف في هذه الخطة سبعة.";
                return;
            }
            goalsHost.insertAdjacentHTML("beforeend", goalMarkup({ id: "", domain: "", text: "", progress: "", indicators: [] }, goalsHost.children.length));
        });
        goalsHost.addEventListener("click", function (event) {
            var button = event.target.closest("[data-remove-goal]");
            if (!button) {
                return;
            }
            var article = button.closest(".goal-editor");
            if (article) {
                article.remove();
            }
        });
        form.querySelector("#school-plan-link").addEventListener("click", function () {
            fetch("/api/operational-plan/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    role: form.elements.linkRole.value,
                    task_code: form.elements.linkTask.value,
                    goal_id: form.elements.linkGoal.value
                })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر الربط");
                    }
                    return payload;
                });
            }).then(function (payload) {
                draw(payload);
                note.textContent = "حُفظ ربط البند.";
                if (window.dataHub) {
                    window.dataHub.publish("operational-plan");
                }
            }).catch(function (error) {
                note.textContent = error.message || "تعذر الربط.";
            });
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            fetch("/api/operational-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    academic_year: plan && plan.academic_year || "",
                    vision: form.elements.vision.value.trim(),
                    mission: form.elements.mission.value.trim(),
                    values: form.elements.values.value.split("\n").map(function (line) { return line.trim(); }).filter(Boolean),
                    swot: {
                        strength: form.elements.strength.value.trim(),
                        weakness: form.elements.weakness.value.trim(),
                        opportunity: form.elements.opportunity.value.trim(),
                        threat: form.elements.threat.value.trim()
                    },
                    strategic_goals: readGoals(),
                    budget: form.elements.budget.value.trim(),
                    planning_team: readTeam(),
                    monitoring_plan: form.elements.monitoring.value.trim()
                })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر الحفظ");
                    }
                    return payload;
                });
            }).then(function (payload) {
                draw(payload);
                note.textContent = "حُفظت الخطة التشغيلية.";
                if (window.dataHub) {
                    window.dataHub.publish("operational-plan");
                }
            }).catch(function (error) {
                note.textContent = error.message || "تعذر الحفظ.";
            });
        });
        window.addEventListener("dataChanged", function (event) {
            var eventSource = event.detail && event.detail.source;
            if (pane.isConnected && (eventSource === "operational-plan" || eventSource === "programs" || eventSource === "leadership")) {
                load();
            }
        });
        load().then(loadTasks);
    }

    function paintSixRegisters(pane) {
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<div class=\"program-board\">"
            + "<h1>السجلات الستة</h1>"
            + "<p class=\"wash-hint\">كل سجل وعاء لبرامجه والإجراءات والشواهد المربوطة به. الحقل الفارغ يبقى فارغًا.</p>"
            + "<div class=\"register-grid\" id=\"six-register-cards\"></div>"
            + "<section class=\"board-card board-span\" id=\"six-register-detail\" hidden></section>"
            + "<div class=\"wash-actions\"><button class=\"wash-back\" type=\"button\">العودة</button></div>"
            + "</div>"
        );
        var cards = pane.querySelector("#six-register-cards");
        var detail = pane.querySelector("#six-register-detail");
        var bundle = { programs: [], registers: [], actions: [] };
        var selected = 0;
        function escapeText(value) {
            return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        }
        function linkedActions(programs) {
            var ids = {};
            programs.forEach(function (item) {
                var ref = String(item.duty_ref || "");
                if (ref.indexOf("improvement:") === 0 && /^\d+$/.test(ref.split(":")[1] || "")) {
                    ids[ref.split(":")[1]] = true;
                }
            });
            return bundle.actions.filter(function (action) {
                return ids[String(action.id)];
            });
        }
        function drawDetail() {
            var register = bundle.registers.filter(function (item) {
                return Number(item.id) === selected;
            })[0];
            if (!register) {
                detail.hidden = true;
                return;
            }
            var programs = bundle.programs.filter(function (item) {
                return Number(item.register_id) === selected;
            });
            var actions = linkedActions(programs);
            var programRows = programs.length ? programs.map(function (item) {
                return "<tr><td>" + escapeText(item.program_name) + "</td><td>" + escapeText(item.owner_label) + "</td><td>" + escapeText(item.status) + "</td><td>" + escapeText(item.indicator_codes) + "</td></tr>";
            }).join("") : "<tr><td colspan=\"4\">لا برامج في هذا السجل.</td></tr>";
            var actionRows = actions.length ? actions.map(function (action) {
                return "<tr><td>" + escapeText(action.title) + "</td><td>" + escapeText(action.status || "غير محددة") + "</td><td>" + escapeText(action.progress_percentage) + "</td><td>" + escapeText(action.evidence) + "</td></tr>";
            }).join("") : "<tr><td colspan=\"4\">لا إجراءات مربوطة ببرامج هذا السجل.</td></tr>";
            detail.hidden = false;
            detail.innerHTML = "<p class=\"wash-section\">" + escapeText(register.label) + "</p>"
                + "<p class=\"wash-hint\">البرامج</p><table class=\"program-table\"><thead><tr><th>البرنامج</th><th>أصحاب البرنامج</th><th>الحالة</th><th>المؤشرات</th></tr></thead><tbody>" + programRows + "</tbody></table>"
                + "<p class=\"wash-hint\">الإجراءات والشواهد</p><table class=\"program-table\"><thead><tr><th>الإجراء</th><th>الحالة</th><th>نسبة الإنجاز</th><th>الشاهد</th></tr></thead><tbody>" + actionRows + "</tbody></table>";
        }
        var shortNames = {
            1: "سجل القيادة",
            2: "سجل التطوير المهني",
            3: "سجل المناهج",
            4: "سجل الانضباط",
            5: "سجل الأنشطة والرعاية",
            6: "سجل البيئة"
        };
        function drawCards() {
            cards.innerHTML = bundle.registers.map(function (register) {
                var count = bundle.programs.filter(function (item) {
                    return Number(item.register_id) === Number(register.id);
                }).length;
                var title = shortNames[Number(register.id)] || register.label;
                return "<button type=\"button\" class=\"register-card" + (Number(register.id) === selected ? " is-open" : "") + "\" data-register=\"" + register.id + "\"><b>" + escapeText(title) + "</b><span>" + count + " برامج</span></button>";
            }).join("");
            drawDetail();
        }
        function load() {
            return Promise.all([
                fetch("/api/programs").then(function (response) { return response.json(); }),
                fetch("/api/improvement").then(function (response) { return response.json(); })
            ]).then(function (payloads) {
                bundle.programs = payloads[0].programs || [];
                bundle.registers = payloads[0].registers || [];
                bundle.actions = payloads[1].actions || [];
                drawCards();
            }).catch(function () {
                cards.innerHTML = "<p class=\"wash-note\">تعذر قراءة السجلات.</p>";
            });
        }
        cards.addEventListener("click", function (event) {
            var button = event.target.closest("[data-register]");
            if (!button) {
                return;
            }
            selected = Number(button.getAttribute("data-register"));
            drawCards();
            detail.scrollIntoView({ block: "nearest" });
        });
        window.addEventListener("dataChanged", function (event) {
            var source = event.detail && event.detail.source;
            if (pane.isConnected && (source === "programs" || source === "improvement")) {
                load();
            }
        });
        load();
    }

    function paintCommandBoard(pane) {
        pane.classList.add("is-board");
        if (!isCommandLeadership()) {
            pane.innerHTML = washMarkup(
                "/assets/dashboard/board-leadership.jpg",
                "wash-board-sheet wash-facility",
                "<div class=\"program-board\">"
                + "<h1>غرفة القيادة الذكية</h1>"
                + "<p class=\"wash-hint\">هذه الغرفة للقيادات فقط (مدير · وكيل · مسؤول النظام).</p>"
                + actionsHtml()
                + "</div>"
            );
            return;
        }
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<div class=\"program-board\">"
            + "<h1>غرفة القيادة الذكية</h1>"
            + "<p class=\"wash-hint\">اليوم يحتاج انتباهًا أولًا، ثم أرقام البرامج والإجراءات من المحفوظ فقط.</p>"
            + "<section class=\"board-card board-span command-attention is-inline\" id=\"command-attention-board\">"
            + "<header class=\"command-attention__head\"><div><h2>اليوم يحتاج انتباهًا</h2>"
            + "<p>إشارات من المهام والفترات والمؤشرات والشواهد</p></div>"
            + "<button type=\"button\" class=\"command-attention__refresh\" data-command-refresh>تحديث</button></header>"
            + "<div id=\"command-attention-list-board\" class=\"command-attention__list\"></div>"
            + "<p id=\"command-attention-empty-board\" class=\"command-attention__empty\" hidden>لا توجد إشارات حالياً. جميع المهام محدثة.</p>"
            + "</section>"
            + "<section class=\"board-card board-span\" id=\"command-board-body\"></section>"
            + "<div class=\"wash-actions\"><button class=\"wash-back\" type=\"button\">العودة</button></div>"
            + "</div>"
        );
        var body = pane.querySelector("#command-board-body");
        fetch("/api/command-room/today?refresh=1").then(function (response) {
            return response.json();
        }).then(function (payload) {
            var list = pane.querySelector("#command-attention-list-board");
            var empty = pane.querySelector("#command-attention-empty-board");
            var signals = (payload && payload.signals) || [];
            if (!list) {
                return;
            }
            if (!signals.length) {
                list.innerHTML = "";
                if (empty) {
                    empty.hidden = false;
                }
                return;
            }
            if (empty) {
                empty.hidden = true;
            }
            list.innerHTML = signals.map(function (item) {
                return "<article class=\"command-card " + severityClass(item.severity) + "\" data-signal-id=\"" + String(item.id || "") + "\">"
                    + "<div class=\"command-card__meta\">"
                    + "<span class=\"command-card__chip\">" + escapeHtml(item.signal_type || "") + "</span>"
                    + "<span class=\"command-card__chip is-sev\">" + escapeHtml(item.severity || "") + "</span>"
                    + "</div>"
                    + "<p class=\"command-card__title\">" + escapeHtml(item.message || "") + "</p>"
                    + (item.why
                        ? "<details class=\"command-why-more\"><summary>لماذا؟</summary>"
                          + "<p class=\"command-card__why\">" + escapeHtml(item.why) + "</p></details>"
                        : "")
                    + "<div class=\"command-card__actions\">"
                    + "<button type=\"button\" data-command-open=\"" + escapeHtml(item.action_url || "") + "\">"
                    + escapeHtml(item.action_label || "فتح") + "</button>"
                    + "<button type=\"button\" data-command-act=\"accept\">قبِل</button>"
                    + "<button type=\"button\" data-command-act=\"defer\">أجّل</button>"
                    + "<button type=\"button\" data-command-act=\"dismiss\">تجاهل</button>"
                    + "</div></article>";
            }).join("");
        }).catch(function () {});
        function escapeText(value) {
            return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        }
        function numeric(value) {
            var text = String(value || "").replace("%", "").replace("٪", "").trim();
            if (!text) {
                return null;
            }
            var number = Number(text);
            return Number.isFinite(number) ? number : null;
        }
        function improved(item) {
            var base = numeric(item.baseline_value);
            var current = numeric(item.current_value);
            var target = numeric(item.target_value);
            if (base === null || current === null || target === null) {
                return false;
            }
            return target >= base ? current > base : current < base;
        }
        function load() {
            return Promise.all([
                fetch("/api/programs").then(function (response) { return response.json(); }),
                fetch("/api/improvement").then(function (response) { return response.json(); })
            ]).then(function (payloads) {
                var programs = payloads[0].programs || [];
                var actions = payloads[1].actions || [];
                var stalled = actions.filter(function (action) {
                    return action.status === "متعثر";
                });
                var better = programs.filter(improved);
                var done = programs.filter(function (item) {
                    return item.status === "مكتمل";
                }).length;
                var programRows = programs.length ? programs.map(function (item) {
                    var linked = actions.filter(function (action) {
                        return item.duty_ref === "improvement:" + action.id;
                    })[0];
                    var progress = linked && linked.progress_percentage ? linked.progress_percentage : "";
                    return "<tr><td>" + escapeText(item.program_name) + "</td><td>" + escapeText(item.status) + "</td><td>" + escapeText(item.baseline_value) + "</td><td>" + escapeText(item.current_value) + "</td><td>" + escapeText(item.target_value) + "</td><td>" + escapeText(item.unit) + "</td><td>" + escapeText(progress) + "</td></tr>";
                }).join("") : "<tr><td colspan=\"7\">لا برامج محفوظة.</td></tr>";
                var stalledRows = stalled.length ? stalled.map(function (action) {
                    return "<tr><td>" + escapeText(action.title) + "</td><td>" + escapeText(action.owner_label) + "</td><td>" + escapeText(action.progress_percentage) + "</td><td>" + escapeText(action.evidence) + "</td></tr>";
                }).join("") : "<tr><td colspan=\"4\">لا إجراءات متعثرة.</td></tr>";
                var betterRows = better.length ? better.map(function (item) {
                    return "<tr><td>" + escapeText(item.program_name) + "</td><td>" + escapeText(item.kpi_description) + "</td><td>" + escapeText(item.baseline_value) + "</td><td>" + escapeText(item.current_value) + "</td><td>" + escapeText(item.target_value) + "</td></tr>";
                }).join("") : "<tr><td colspan=\"5\">لا مؤشر له قراءة أعلى أو أدنى من خط الأساس حسب اتجاه المستهدف.</td></tr>";
                body.innerHTML = "<div class=\"command-metrics\">"
                    + "<p class=\"command-metric\"><span>البرامج المحفوظة</span><b>" + programs.length + "</b></p>"
                    + "<p class=\"command-metric\"><span>المكتمل</span><b>" + done + "</b></p>"
                    + "<p class=\"command-metric\"><span>إجراءات متعثرة</span><b>" + stalled.length + "</b></p>"
                    + "</div>"
                    + "<p class=\"wash-section\">البرامج ونسب إنجازها</p>"
                    + "<table class=\"program-table\"><thead><tr><th>البرنامج</th><th>الحالة</th><th>خط الأساس</th><th>القراءة الحالية</th><th>المستهدف</th><th>الوحدة</th><th>نسبة الإجراء</th></tr></thead><tbody>" + programRows + "</tbody></table>"
                    + "<p class=\"wash-section\">الإجراءات المتعثرة</p>"
                    + "<table class=\"program-table\"><thead><tr><th>الإجراء</th><th>المسؤول</th><th>نسبة الإنجاز</th><th>الشاهد</th></tr></thead><tbody>" + stalledRows + "</tbody></table>"
                    + "<p class=\"wash-section\">المؤشرات التي تحسنت</p>"
                    + "<table class=\"program-table\"><thead><tr><th>البرنامج</th><th>المؤشر</th><th>خط الأساس</th><th>القراءة الحالية</th><th>المستهدف</th></tr></thead><tbody>" + betterRows + "</tbody></table>";
            }).catch(function () {
                body.innerHTML = "<p class=\"wash-note\">تعذر قراءة لوحة القيادة.</p>";
            });
        }
        window.addEventListener("dataChanged", function (event) {
            var source = event.detail && event.detail.source;
            if (pane.isConnected && (source === "programs" || source === "improvement" || source === "indicators" || source === "nafs")) {
                load();
            }
        });
        load();
    }

    function paintProgramRecords(pane) {
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "",
            "wash-board-sheet wash-facility",
            "<div class=\"program-records\">"
            + "<div class=\"plan-seat-tools no-print\">"
            + "<button class=\"wash-save\" id=\"record-print\" type=\"button\">طباعة</button>"
            + "<button class=\"wash-back\" type=\"button\">العودة</button>"
            + "</div>"
            + "<header class=\"print-header-table\">"
            + "<div class=\"plan-seat-side identity-stack\"><div>المملكة العربية السعودية</div><div>وزارة التعليم</div><div>الإدارة العامة للتعليم بمنطقة المدينة المنورة</div><div>متوسطة سعد بن الربيع الأنصاري</div></div>"
            + "<div class=\"print-header-logo\"><img src=\"/assets/ministry_logo.png\" alt=\"وزارة التعليم\"></div>"
            + "<div class=\"plan-seat-side is-end\"><div>سجل البرامج</div><div id=\"record-year\"></div></div>"
            + "</header>"
            + "<section id=\"program-record-groups\"></section>"
            + "</div>"
        );
        var board = pane.querySelector(".wash-board");
        if (board) {
            board.classList.add("is-plain");
        }
        var box = pane.querySelector("#program-record-groups");
        function escapeRecord(value) {
            return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        }
        function indicatorText(value) {
            if (Array.isArray(value)) {
                return value.filter(Boolean).join("، ");
            }
            return String(value == null ? "" : value);
        }
        pane.querySelector("#record-print").addEventListener("click", function () {
            if (window.openPrintPreview) {
                window.openPrintPreview("print-records");
            }
        });
        Promise.all([
            fetch("/api/programs").then(function (response) { return response.json(); }),
            fetch("/api/operational-plan").then(function (response) { return response.json(); }).catch(function () { return {}; })
        ]).then(function (payloads) {
            var payload = payloads[0] || {};
            pane.querySelector("#record-year").textContent = (payloads[1] && payloads[1].academic_year) || "";
            var programs = payload.programs || [];
            var registers = payload.registers || [];
            box.innerHTML = registers.map(function (register) {
                var rows = programs.filter(function (item) {
                    return Number(item.register_id) === Number(register.id);
                });
                var body = rows.length ? rows.map(function (item) {
                    return "<tr><td>" + escapeRecord(item.program_name) + "</td><td>" + escapeRecord(item.owner_label) + "</td><td>" + escapeRecord(item.status) + "</td><td>" + escapeRecord(indicatorText(item.indicator_codes)) + "</td></tr>";
                }).join("") : "<tr><td colspan=\"4\">لا برامج في هذا السجل.</td></tr>";
                return "<p class=\"wash-section\">" + escapeRecord(register.label) + "</p>"
                    + "<table class=\"record-table\"><thead><tr><th>البرنامج</th><th>أصحاب البرنامج</th><th>الحالة</th><th>المؤشرات</th></tr></thead><tbody>"
                    + body + "</tbody></table>";
            }).join("");
        }).catch(function () {
            box.innerHTML = "<p class=\"wash-note\">تعذر قراءة سجل البرامج.</p>";
        });
    }

    function paintImprovement(pane) {
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<form id=\"improvement-form\">"
            + "<div class=\"improvement-title-row\">"
            + "<h1>خطة التحسين</h1>"
            + "<button class=\"wash-save no-print\" id=\"improvement-print-btn\" type=\"button\">طباعة / تصدير PDF</button>"
            + "</div>"
            + "<p class=\"wash-hint\">تُبنى من فجوات التقويم المحفوظة. الشريحة تعرض الإجراء ومالكه ومؤشره وشاهده. اجتماع الجبر موجود أيضًا في بنود وكيل الشؤون التعليمية. الحقل الفارغ يبقى فارغًا.</p>"
            + "<header class=\"print-header-table\">"
            + "<div class=\"plan-seat-side identity-stack\"><div>المملكة العربية السعودية</div><div>وزارة التعليم</div><div>الإدارة العامة للتعليم بمنطقة المدينة المنورة</div><div>متوسطة سعد بن الربيع الأنصاري</div></div>"
            + "<div class=\"print-header-logo\"><img src=\"/assets/ministry_logo.png\" alt=\"وزارة التعليم\"></div>"
            + "<div class=\"plan-seat-side is-end\"><div>خطة التحسين المدرسي</div><div id=\"improvement-year\"></div></div>"
            + "</header>"
            + "<div id=\"improvement-print-sheet\" class=\"improvement-print-sheet\"></div>"
            + "<section class=\"board-card board-span improvement-screen\">"
            + "<p class=\"wash-section\">التشخيص</p>"
            + "<div id=\"improvement-diagnosis\"></div>"
            + "</section>"
            + "<section class=\"board-card board-span improvement-screen\">"
            + "<p class=\"wash-section\">منهج البناء</p>"
            + "<ol class=\"improvement-steps\">"
            + "<li>التشخيص يُقرأ من دورة التقويم. بطاقة نافس تقيس مهارة الصف، وهي مصدر مستقل عن نسبة المجال.</li>"
            + "<li>الأولوية للمسافة الأكبر إلى المستوى التالي. الإجراء لا يُرتَّب من جديد إن كان ترتيبه محفوظًا.</li>"
            + "<li>كل إجراء يُربط بمؤشر واحد، فيظهر مجاله ومعياره ومستواه ونسبته.</li>"
            + "<li>السبب الجذري يفسر الفجوة. لا يُكتب سبب غير محفوظ.</li>"
            + "<li>هدف التحسين محدد، قابل للقياس، واقعي، وله بداية ونهاية.</li>"
            + "<li>الإجراء عمل واحد: مالك، وموارد، ومدة.</li>"
            + "<li>القياس: خط أساس ومستهدف ووحدة. الشاهد يثبت التحقق، ولا تُنسخ نسبة المجال إلى خط الأساس إلا إذا كُتبت في حقله.</li>"
            + "<li>المتابعة تاريخ مراجعة ونسبة إنجاز وحالة. الأثر يُقاس بالمؤشر.</li>"
            + "</ol>"
            + "</section>"
            + "<section class=\"board-card board-span improvement-screen\">"
            + "<p class=\"wash-section\">الإجراءات</p>"
            + "<div id=\"improvement-rows\"></div>"
            + "</section>"
            + actionsHtml("حفظ الخطة", "facility-actions")
            + "</form>"
        );
        var form = pane.querySelector("#improvement-form");
        var note = form.querySelector(".wash-note");
        var box = form.querySelector("#improvement-rows");
        var diagnosis = pane.querySelector("#improvement-diagnosis");
        var indicators = [];
        var indicatorByCode = {};
        var nafsCard = null;
        var printCycle = null;
        var impactOrder = {
            "نواتج التعلم": "ترتيب الأثر 1",
            "البيئة المدرسية": "ترتيب الأثر 2",
            "التعليم والتعلم": "ترتيب الأثر 3",
            "الإدارة المدرسية": "تُحفظ وتيرة الأداء"
        };
        function fieldValue(value) {
            return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        }
        function levelMark(word) {
            var tones = { "تهيئة": "eval-seed", "انطلاق": "eval-start", "تقدم": "eval-rise", "تميز": "eval-peak" };
            var tone = tones[word] || "";
            return "<b class=\"" + tone + "\">" + fieldValue(word) + "</b>";
        }
        function gapNumber(value) {
            var number = parseFloat(String(value || "").replace("%", ""));
            return isNaN(number) ? null : number;
        }
        function paintDiagnosis(cycle, nafs) {
            printCycle = cycle || null;
            var yearNode = document.getElementById("improvement-year");
            if (yearNode) {
                var yearText = cycle && cycle.academic_year ? String(cycle.academic_year) : "";
                if (yearText && yearText.indexOf("هـ") < 0) {
                    yearText += "هـ";
                }
                yearNode.textContent = yearText ? "العام الدراسي " + yearText : "";
            }
            var head = cycle
                ? "<p>دورة التقويم: " + fieldValue(cycle.title) + " — العام " + fieldValue(cycle.academic_year)
                    + " — النتيجة العامة " + fieldValue(cycle.overall_score)
                    + " — المستوى " + levelMark(cycle.overall_level) + "</p>"
                : "<p>لا دورة تقويم محفوظة.</p>";
            var domains = (cycle && cycle.domains || []).slice().sort(function (a, b) {
                var left = gapNumber(a.gap_to_next);
                var right = gapNumber(b.gap_to_next);
                if (left == null && right == null) {
                    return 0;
                }
                if (left == null) {
                    return 1;
                }
                if (right == null) {
                    return -1;
                }
                return right - left;
            });
            var rank = 0;
            var cards = domains.map(function (item) {
                var gap = gapNumber(item.gap_to_next);
                var order = gap == null ? "" : "ترتيب الفجوة " + (++rank);
                var impact = impactOrder[item.name] || "";
                return "<article class=\"improvement-domain\"><span>" + fieldValue(item.name) + "</span><b>"
                    + fieldValue(item.score) + "</b><span>المسافة " + fieldValue(item.gap_to_next) + "</span><span>"
                    + order + "</span><span>" + fieldValue(impact) + "</span></article>";
            }).join("");
            var impactNames = ["نواتج التعلم", "البيئة المدرسية", "التعليم والتعلم", "الإدارة المدرسية"];
            var present = {};
            (cycle && cycle.domains || []).forEach(function (item) {
                present[item.name] = true;
            });
            var impactList = impactNames.every(function (name) { return present[name]; })
                ? "<p class=\"wash-section\">ترتيب الأثر</p><ol class=\"improvement-impact\"><li>نواتج التعلم — نافس أولًا</li><li>البيئة المدرسية</li><li>التعليم والتعلم</li><li>الإدارة المدرسية — تُحفظ وتيرتها</li></ol><p>ترتيب الفجوة من مسافة المستوى التالي. ترتيب الأثر من تحليل الواقع، لأن قرب نواتج التعلم من التقدم لا يلغي ضعف مهارة الصف.</p>"
                : "";
            var facts = "";
            if (nafs) {
                [["الصف", nafs.grade], ["المقيدون", nafs.enrolled], ["المختبرون", nafs.tested], ["القراءة", nafs.reading_score], ["العلوم", nafs.science_score], ["الرياضيات", nafs.math_score], ["أضعف مهارة", nafs.weakest_skill], ["نسبة المهارة", nafs.weakest_score]].forEach(function (pair) {
                    if (pair[1]) {
                        facts += "<li><span>" + pair[0] + "</span><b>" + fieldValue(pair[1]) + "</b></li>";
                    }
                });
            }
            diagnosis.innerHTML = head
                + (cards ? "<div class=\"improvement-diagnosis\">" + cards + "</div>" : "")
                + impactList
                + (facts ? "<ul class=\"improvement-facts\">" + facts + "</ul><p>بطاقة نافس مصدر مهارة الصف. تظهر مع مؤشر المادة، ولا تُنسخ إلى خط الأساس إلا إذا كُتبت في حقله ثم حُفظت.</p>" : "");
        }
        function sourceHtml(code) {
            var item = indicatorByCode[code];
            if (!item) {
                return "<p>" + (code ? "هذا الرمز غير موجود في سجل المؤشرات." : "اختر مؤشرًا من السجل ليظهر مجاله ومستواه ومسافته.") + "</p>";
            }
            return "<div><span>المجال</span><b>" + fieldValue(item.domain) + "</b></div>"
                + "<div><span>المعيار</span><b>" + fieldValue(item.standard_name) + "</b></div>"
                + "<div><span>المستوى</span>" + levelMark(item.level) + "</div>"
                + "<div><span>نسبة المجال</span><b>" + fieldValue(item.domain_score) + "</b></div>"
                + "<div><span>المسافة</span><b>" + fieldValue(item.gap_to_next) + "</b></div>"
                + "<div class=\"is-wide\"><span>نص المؤشر</span><b>" + fieldValue(item.statement) + "</b></div>"
                + nafsLink(item.statement);
        }
        function nafsLink(statement) {
            if (!nafsCard) {
                return "";
            }
            var text = String(statement || "");
            var parts = [];
            if (text.indexOf("مجال الرياضيات") >= 0 && nafsCard.math_score) {
                parts.push("الرياضيات " + nafsCard.math_score);
                if (nafsCard.weakest_skill) {
                    parts.push("أضعف مهارة محفوظة " + nafsCard.weakest_skill + (nafsCard.weakest_score ? " " + nafsCard.weakest_score : ""));
                }
            } else if (text.indexOf("مجال القراءة") >= 0 && nafsCard.reading_score) {
                parts.push("القراءة " + nafsCard.reading_score);
            } else if (text.indexOf("مجال العلوم") >= 0 && nafsCard.science_score) {
                parts.push("العلوم " + nafsCard.science_score);
            }
            if (!parts.length) {
                return "";
            }
            return "<div class=\"is-wide\"><span>مهارة نافس المحفوظة</span><b>" + fieldValue(parts.join(" — ")) + "</b></div>";
        }
        function datePair(id, label, hijri, gregorian) {
            return "<div class=\"wash-field dual-date-block\"><span>" + label + "</span><span class=\"dual-date-pair\">"
                + "<label><b>هجري</b><input class=\"doc-hijri\" id=\"imp-" + id + "-hijri\" name=\"" + hijri + "\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 17 ربيع الأول 1448هـ\" autocomplete=\"off\"></label>"
                + "<label><b>ميلادي</b><input class=\"doc-date-picker\" id=\"imp-" + id + "-gregorian\" name=\"" + gregorian + "\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 30 أغسطس 2026م\" autocomplete=\"off\"></label>"
                + "</span></div>";
        }
        function draw(actions) {
            box.innerHTML = (actions || []).map(function (action) {
                var units = ["", "%", "عدد", "نسبة"];
                if (action.unit && units.indexOf(action.unit) < 0) {
                    units.push(action.unit);
                }
                var known = false;
                var options = indicators.map(function (item) {
                    if (item.code === action.indicator_code) {
                        known = true;
                    }
                    return "<option value=\"" + fieldValue(item.code) + "\"" + (item.code === action.indicator_code ? " selected" : "") + ">"
                        + fieldValue(item.code + " — " + item.statement) + "</option>";
                }).join("");
                if (action.indicator_code && !known) {
                    options = "<option value=\"" + fieldValue(action.indicator_code) + "\" selected>" + fieldValue(action.indicator_code) + "</option>" + options;
                }
                return "<article class=\"improvement-card\" data-action-id=\"" + action.id + "\">"
                    + "<p class=\"wash-section\">" + fieldValue(action.title || "إجراء بلا عنوان") + "</p>"
                    + "<div class=\"improvement-source\" data-source>" + sourceHtml(action.indicator_code) + "</div>"
                    + "<div class=\"facility-fields\">"
                    + "<label class=\"wash-field is-wide\"><span>المؤشر</span><select name=\"indicator\"><option value=\"\"></option>" + options + "</select></label>"
                    + "<label class=\"wash-field is-wide\"><span>السبب الجذري</span><textarea name=\"rootCause\" rows=\"2\">" + fieldValue(action.root_cause) + "</textarea></label>"
                    + "<label class=\"wash-field is-wide\"><span>هدف التحسين</span><textarea name=\"objective\" rows=\"2\">" + fieldValue(action.objective) + "</textarea></label>"
                    + "<label class=\"wash-field is-wide\"><span>الإجراء</span><textarea name=\"title\" rows=\"2\">" + fieldValue(action.title) + "</textarea></label>"
                    + "<label class=\"wash-field\"><span>المسؤول</span><input name=\"owner\" type=\"text\" autocomplete=\"off\" value=\"" + fieldValue(action.owner_label) + "\"></label>"
                    + "<label class=\"wash-field is-wide\"><span>الموارد</span><textarea name=\"resources\" rows=\"2\">" + fieldValue(action.resources) + "</textarea></label>"
                    + datePair(action.id + "-start", "تاريخ البداية", "startHijri", "startGregorian")
                    + datePair(action.id + "-end", "تاريخ النهاية", "endHijri", "endGregorian")
                    + "<label class=\"wash-field\"><span>خط الأساس</span><input name=\"baseline\" type=\"text\" autocomplete=\"off\" value=\"" + fieldValue(action.baseline_value) + "\"></label>"
                    + "<label class=\"wash-field\"><span>المستهدف</span><input name=\"target\" type=\"text\" autocomplete=\"off\" value=\"" + fieldValue(action.target_value) + "\"></label>"
                    + "<label class=\"wash-field\"><span>الوحدة</span><select name=\"unit\">"
                    + units.map(function (unit) {
                        return "<option value=\"" + fieldValue(unit) + "\"" + (action.unit === unit ? " selected" : "") + ">" + fieldValue(unit) + "</option>";
                    }).join("")
                    + "</select></label>"
                    + "<label class=\"wash-field is-wide evidence-field\"><span>الشاهد</span><span class=\"evidence-tools\"><input name=\"evidence\" type=\"text\" autocomplete=\"off\" value=\"" + fieldValue(action.evidence) + "\"><button class=\"evidence-edit no-print\" type=\"button\">تحرير / معاينة</button><button class=\"evidence-print no-print\" type=\"button\">توليد وطباعة</button></span></label>"
                    + datePair(action.id + "-follow", "تاريخ المتابعة", "followHijri", "followGregorian")
                    + "<label class=\"wash-field is-wide\"><span>ملاحظة المتابعة</span><textarea name=\"followNote\" rows=\"2\">" + fieldValue(action.follow_note) + "</textarea></label>"
                    + "<label class=\"wash-field\"><span>الحالة</span><select name=\"status\">"
                    + ["", "مسودة", "معتمد", "قيد التنفيذ", "مكتمل", "متعثر"].map(function (status) {
                        return "<option value=\"" + status + "\"" + (action.status === status ? " selected" : "") + ">" + (status || "غير محددة") + "</option>";
                    }).join("")
                    + "</select></label>"
                    + "<label class=\"wash-field\"><span>نسبة الإنجاز</span><input name=\"progress\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\" value=\"" + fieldValue(action.progress_percentage) + "\"></label>"
                    + "</div></article>";
            }).join("");
            (actions || []).forEach(function (action) {
                ["start", "end", "follow"].forEach(function (kind) {
                    var node = box.querySelector("#imp-" + action.id + "-" + kind + "-hijri");
                    if (node) {
                        var names = { start: ["start_hijri", "start_gregorian"], end: ["end_hijri", "end_gregorian"], follow: ["follow_hijri", "follow_gregorian"] };
                        var hijriRaw = action[names[kind][0]] || "";
                        var gregRaw = action[names[kind][1]] || "";
                        node.value = typeof formatDisplayDate === "function" ? formatDisplayDate(hijriRaw, "hijri") : hijriRaw;
                        box.querySelector("#imp-" + action.id + "-" + kind + "-gregorian").value = typeof formatDisplayDate === "function" ? formatDisplayDate(gregRaw, "gregorian") : gregRaw;
                    }
                    if (typeof syncHijriGregorianDates === "function") {
                        syncHijriGregorianDates("imp-" + action.id + "-" + kind + "-gregorian", "imp-" + action.id + "-" + kind + "-hijri");
                    }
                });
            });
            markEvalLevels(document.getElementById("erp-pane"));
        }
        function readRows() {
            return Array.prototype.map.call(box.querySelectorAll("[data-action-id]"), function (row) {
                function value(name) {
                    var node = row.querySelector("[name=\"" + name + "\"]");
                    return node ? node.value.trim() : "";
                }
                return {
                    id: Number(row.getAttribute("data-action-id")),
                    title: value("title"),
                    owner_label: value("owner"),
                    indicator_code: value("indicator"),
                    evidence: value("evidence"),
                    status: value("status"),
                    progress_percentage: value("progress"),
                    root_cause: value("rootCause"),
                    objective: value("objective"),
                    baseline_value: value("baseline"),
                    target_value: value("target"),
                    unit: value("unit"),
                    resources: value("resources"),
                    start_hijri: value("startHijri"),
                    start_gregorian: value("startGregorian"),
                    end_hijri: value("endHijri"),
                    end_gregorian: value("endGregorian"),
                    follow_hijri: value("followHijri"),
                    follow_gregorian: value("followGregorian"),
                    follow_note: value("followNote")
                };
            });
        }
        box.addEventListener("change", function (event) {
            if (!event.target || event.target.name !== "indicator") {
                return;
            }
            var card = event.target.closest("[data-action-id]");
            var host = card && card.querySelector("[data-source]");
            if (host) {
                host.innerHTML = sourceHtml(event.target.value);
                markEvalLevels(document.getElementById("erp-pane"));
            }
        });
        function pairedDate(hijri, gregorian) {
            var h = typeof formatDisplayDate === "function" ? formatDisplayDate(hijri || "", "hijri") : (hijri || "");
            var g = typeof formatDisplayDate === "function" ? formatDisplayDate(gregorian || "", "gregorian") : (gregorian || "");
            if (h && g) {
                return h + " الموافق " + g;
            }
            return h || g || "";
        }
        function printLine(label, value) {
            if (!value) {
                return "";
            }
            return "<tr><th>" + fieldValue(label) + "</th><td>" + fieldValue(value) + "</td></tr>";
        }
        function signTable() {
            return witnessSignTable();
        }
        function evidencePieces(text) {
            return String(text || "").split(/[،,\n]/).map(function (part) {
                return part.trim();
            }).filter(Boolean);
        }
        function renderEvidence(action) {
            var item = indicatorByCode[action.indicator_code] || {};
            var pieces = evidencePieces(action.evidence);
            var sentences = ["يوثّق هذا الشاهد تحقق الإجراء المحفوظ من حقوله المكتوبة."];
            if (action.title) {
                sentences.push("الإجراء: " + action.title + ".");
            }
            if (action.indicator_code || item.statement) {
                sentences.push("المؤشر: " + [action.indicator_code, item.statement].filter(Boolean).join(" — ") + ".");
            }
            if (action.objective) {
                sentences.push("غاية التحقق: " + action.objective);
            }
            if (pieces.length) {
                sentences.push("عناصر الشاهد المكتوبة: " + pieces.join("، ") + ".");
            }
            if (action.baseline_value || action.target_value) {
                sentences.push("القياس المحفوظ من " + [action.baseline_value, action.unit].filter(Boolean).join(" ")
                    + " إلى " + [action.target_value, action.unit].filter(Boolean).join(" ") + ".");
            }
            if (action.owner_label) {
                sentences.push("المسؤول عن الشاهد: " + action.owner_label + ".");
            }
            var rows = pieces.map(function (part, index) {
                return "<tr><td>" + (index + 1) + "</td><td>" + fieldValue(part) + "</td></tr>";
            }).join("");
            if (!rows) {
                rows = "<tr><td></td><td>لم يُكتب نص في حقل الشاهد.</td></tr>";
            }
            return "<section class=\"improvement-print-page\"><h2>" + fieldValue(action.title || action.evidence || "") + "</h2><p>" + fieldValue(sentences.join(" ")) + "</p><table>"
                + printLine("المؤشر", [action.indicator_code, item.statement].filter(Boolean).join(" — "))
                + printLine("الإجراء", action.title)
                + printLine("المسؤول", action.owner_label)
                + printLine("المدة", [pairedDate(action.start_hijri, action.start_gregorian), pairedDate(action.end_hijri, action.end_gregorian)].filter(Boolean).join(" — "))
                + printLine("خط الأساس", [action.baseline_value, action.unit].filter(Boolean).join(" "))
                + printLine("المستهدف", [action.target_value, action.unit].filter(Boolean).join(" "))
                + printLine("المتابعة", [pairedDate(action.follow_hijri, action.follow_gregorian), action.follow_note].filter(Boolean).join(" — "))
                + "</table><table class=\"improvement-gap\"><thead><tr><th>م</th><th>عنصر الشاهد</th></tr></thead><tbody>"
                + rows + "</tbody></table>" + signTable() + "</section>";
        }
        function renderPrint(actions) {
            var sheet = document.getElementById("improvement-print-sheet");
            if (!sheet) {
                return;
            }
            var cycle = printCycle;
            var domains = (cycle && cycle.domains || []).slice().sort(function (a, b) {
                var left = gapNumber(a.gap_to_next);
                var right = gapNumber(b.gap_to_next);
                if (left == null && right == null) {
                    return 0;
                }
                if (left == null) {
                    return 1;
                }
                if (right == null) {
                    return -1;
                }
                return right - left;
            });
            var rank = 0;
            var rows = domains.map(function (item) {
                var gap = gapNumber(item.gap_to_next);
                var order = gap == null ? "" : String(++rank);
                return "<tr><td>" + fieldValue(item.name) + "</td><td>" + fieldValue(item.score) + "</td><td>"
                    + fieldValue(item.gap_to_next) + "</td><td>" + order + "</td></tr>";
            }).join("");
            var summary = cycle
                ? "دورة التقويم: " + (cycle.title || "") + " — العام " + (cycle.academic_year || "")
                    + " — النتيجة العامة " + (cycle.overall_score || "") + " — المستوى " + (cycle.overall_level || "")
                : "";
            var impact = "";
            var names = {};
            domains.forEach(function (item) { names[item.name] = true; });
            if (names["نواتج التعلم"] && names["البيئة المدرسية"] && names["التعليم والتعلم"] && names["الإدارة المدرسية"]) {
                impact = "ترتيب الأثر: نواتج التعلم، ثم البيئة المدرسية، ثم التعليم والتعلم، وتُحفظ وتيرة الإدارة المدرسية.";
            }
            var nafsLine = "";
            if (nafsCard && (nafsCard.math_score || nafsCard.reading_score || nafsCard.science_score)) {
                nafsLine = "نافس " + (nafsCard.grade || "")
                    + " — القراءة " + (nafsCard.reading_score || "")
                    + " — العلوم " + (nafsCard.science_score || "")
                    + " — الرياضيات " + (nafsCard.math_score || "");
                if (nafsCard.weakest_skill) {
                    nafsLine += " — أضعف مهارة محفوظة " + nafsCard.weakest_skill
                        + (nafsCard.weakest_score ? " " + nafsCard.weakest_score : "");
                }
            }
            var sign = signTable();
            var cards = (actions || []).map(function (action, index) {
                var item = indicatorByCode[action.indicator_code] || {};
                var last = index === actions.length - 1;
                return "<section class=\"improvement-print-page\"><h2>" + fieldValue(action.title || ("الإجراء " + (index + 1))) + "</h2><table>"
                    + printLine("المؤشر", [action.indicator_code, item.statement].filter(Boolean).join(" — "))
                    + printLine("المجال", item.domain)
                    + printLine("المستوى", item.level)
                    + printLine("المسافة", item.gap_to_next)
                    + printLine("السبب الجذري", action.root_cause)
                    + printLine("هدف التحسين", action.objective)
                    + printLine("الإجراء", action.title)
                    + printLine("المسؤول", action.owner_label)
                    + printLine("الموارد", action.resources)
                    + printLine("البداية", pairedDate(action.start_hijri, action.start_gregorian))
                    + printLine("النهاية", pairedDate(action.end_hijri, action.end_gregorian))
                    + printLine("خط الأساس", [action.baseline_value, action.unit].filter(Boolean).join(" "))
                    + printLine("المستهدف", [action.target_value, action.unit].filter(Boolean).join(" "))
                    + printLine("الشاهد", action.evidence)
                    + printLine("المتابعة", [pairedDate(action.follow_hijri, action.follow_gregorian), action.follow_note].filter(Boolean).join(" — "))
                    + printLine("الحالة", action.status)
                    + printLine("نسبة الإنجاز", action.progress_percentage)
                    + "</table>" + (last ? sign : "") + "</section>";
            }).join("");
            sheet.innerHTML = "<section class=\"improvement-print-page\">"
                + (summary ? "<p>" + fieldValue(summary) + "</p>" : "")
                + "<table class=\"improvement-gap\"><thead><tr><th>المجال</th><th>النسبة</th><th>المسافة</th><th>ترتيب الفجوة</th></tr></thead><tbody>"
                + rows + "</tbody></table>"
                + (impact ? "<p>" + fieldValue(impact) + "</p>" : "")
                + (nafsLine ? "<p>" + fieldValue(nafsLine) + "</p>" : "")
                + (cards ? "" : sign)
                + "</section>"
                + cards;
        }
        function load() {
            return Promise.all([
                fetch("/api/improvement").then(function (response) { return response.json(); }),
                fetch("/api/evaluation").then(function (response) { return response.json(); }),
                fetch("/api/nafs").then(function (response) { return response.json(); })
            ]).then(function (payloads) {
                indicators = (payloads[1] && payloads[1].indicators) || [];
                indicatorByCode = {};
                indicators.forEach(function (item) {
                    indicatorByCode[item.code] = item;
                });
                nafsCard = payloads[2] || null;
                paintDiagnosis(payloads[1] && payloads[1].cycle, nafsCard);
                draw(payloads[0].actions || []);
            });
        }
        load().catch(function () {
            note.textContent = "تعذر قراءة خطة التحسين.";
        });
        function openImprovementPrint() {
            var sheet = document.getElementById("improvement-print-sheet");
            var header = form.querySelector(".print-header-table");
            var host = document.getElementById("improvement-print-host");
            if (!host) {
                host = document.createElement("div");
                host.id = "improvement-print-host";
                host.className = "improvement-print-host improvement-print-sheet";
                document.body.appendChild(host);
            }
            var head = header ? header.outerHTML : "";
            var foot = "<p class=\"improvement-print-foot\">متوسطة سعد بن الربيع الأنصاري</p>";
            var pages = sheet ? sheet.querySelectorAll(".improvement-print-page") : [];
            host.innerHTML = Array.prototype.map.call(pages, function (page) {
                return "<section class=\"improvement-print-page\"><table class=\"print-repeat-frame\"><thead><tr><td>" + head + "</td></tr></thead><tbody><tr><td><div class=\"print-repeat-fill\"><div class=\"improvement-print-body\">" + page.innerHTML + "</div><div class=\"improvement-print-end\">" + foot + "</div></div></td></tr></tbody></table></section>";
            }).join("");
            var previousTitle = document.title;
            document.title = "";
            document.body.classList.add("print-mode", "print-improvement");
            function restore() {
                document.title = previousTitle;
                document.body.classList.remove("print-mode", "print-improvement");
                host.innerHTML = "";
            }
            window.setTimeout(function () {
                if (!window.PrintEngine || typeof window.PrintEngine.gate !== "function") {
                    console.error("PrintEngine غير محمّل.");
                    restore();
                    return;
                }
                var printed = window.PrintEngine.gate(host.innerHTML, {
                    multiPage: true,
                    orientation: "portrait",
                    docTitle: "خطة التحسين"
                });
                if (printed && typeof printed.finally === "function") {
                    printed.finally(restore);
                } else if (printed && typeof printed.then === "function") {
                    printed.then(restore, restore);
                } else {
                    restore();
                }
            }, 80);
        }
        form.querySelector("#improvement-print-btn").addEventListener("click", function () {
            renderPrint(readRows());
            openImprovementPrint();
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            fetch("/api/improvement", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actions: readRows() })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر الحفظ");
                    }
                    return payload;
                });
            }).then(function (payload) {
                draw(payload.actions || []);
                note.textContent = "حُفظت خطة التحسين.";
                if (window.dataHub) {
                    window.dataHub.publish("improvement");
                }
            }).catch(function (error) {
                note.textContent = error.message || "تعذر الحفظ.";
            });
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            load().then(function () {
                note.textContent = "";
            });
        });
    }

    function paintNafs(pane) {
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<form id=\"nafs-form\">"
            + "<h1>بطاقة نافس</h1>"
            + "<p class=\"wash-hint\">نتائج الصف المحفوظة هنا. الحفظ يحدّث شريحة نتائج نافس، ولا يغيّر عدد طلاب المدرسة.</p>"
            + "<section class=\"board-card board-span\">"
            + "<p class=\"wash-section\">الصف والأعداد</p>"
            + "<div class=\"facility-fields\">"
            + "<label class=\"wash-field\"><span>الصف</span><input name=\"grade\" type=\"text\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>عدد المقيدين</span><input name=\"enrolled\" type=\"text\" inputmode=\"numeric\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>عدد المختبرين</span><input name=\"tested\" type=\"text\" inputmode=\"numeric\" autocomplete=\"off\"></label>"
            + "</div>"
            + "<p class=\"wash-section\">نسب الإتقان</p>"
            + "<div class=\"facility-fields\">"
            + "<label class=\"wash-field\"><span>القراءة</span><input name=\"readingScore\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>العلوم</span><input name=\"scienceScore\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>الرياضيات</span><input name=\"mathScore\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>أضعف مهارة</span><input name=\"weakestSkill\" type=\"text\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>نسبة المهارة</span><input name=\"weakestScore\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\"></label>"
            + "</div>"
            + "</section>"
            + actionsHtml("حفظ البطاقة", "facility-actions")
            + "</form>"
        );
        var form = pane.querySelector("#nafs-form");
        var note = form.querySelector(".wash-note");
        function fill(card) {
            var data = card || {};
            form.elements.grade.value = data.grade || "";
            form.elements.enrolled.value = data.enrolled || "";
            form.elements.tested.value = data.tested || "";
            form.elements.readingScore.value = data.reading_score || "";
            form.elements.scienceScore.value = data.science_score || "";
            form.elements.mathScore.value = data.math_score || "";
            form.elements.weakestSkill.value = data.weakest_skill || "";
            form.elements.weakestScore.value = data.weakest_score || "";
        }
        fetch("/api/nafs").then(function (response) {
            return response.json();
        }).then(fill).catch(function () {
            note.textContent = "تعذر قراءة بطاقة نافس.";
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            fetch("/api/nafs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    grade: form.elements.grade.value.trim(),
                    enrolled: form.elements.enrolled.value.trim(),
                    tested: form.elements.tested.value.trim(),
                    reading_score: form.elements.readingScore.value.trim(),
                    science_score: form.elements.scienceScore.value.trim(),
                    math_score: form.elements.mathScore.value.trim(),
                    weakest_skill: form.elements.weakestSkill.value.trim(),
                    weakest_score: form.elements.weakestScore.value.trim()
                })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر الحفظ");
                    }
                    return payload;
                });
            }).then(function (payload) {
                fill(payload);
                note.textContent = "حُفظت بطاقة نافس.";
                if (window.dataHub) {
                    window.dataHub.publish("nafs");
                }
            }).catch(function (error) {
                note.textContent = error.message || "تعذر الحفظ.";
            });
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            fetch("/api/nafs").then(function (response) {
                return response.json();
            }).then(function (payload) {
                fill(payload);
                note.textContent = "";
            });
        });
    }

    function paintEvaluation(pane) {
        var levels = ["تهيئة", "انطلاق", "تقدم", "تميز"];
        var cycle = null;
        var rows = [];
        var query = "";
        var domainFilter = "all";
        var levelFilter = "all";
        var editing = 0;
        pane.classList.add("is-board");
        pane.innerHTML = washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<form id=\"indicator-form\">"
            + "<h1>سجل المؤشرات</h1>"
            + "<p class=\"wash-hint\">دورة التقويم محفوظة هنا. نسب المجالات والمسافات تظهر على شريحة المجالات بعد الحفظ.</p>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card board-span\">"
            + "<p class=\"wash-section\">دورة التقويم</p>"
            + "<div class=\"facility-fields indicator-cycle\">"
            + "<label class=\"wash-field\"><span>عنوان الدورة</span><input name=\"title\" type=\"text\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>العام</span><input name=\"year\" type=\"text\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>النتيجة العامة</span><input name=\"overall\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>مستوى الأداء</span><select name=\"overallLevel\"></select></label>"
            + "</div>"
            + "<p class=\"wash-section\">نسب المجالات</p>"
            + "<div id=\"domain-scores\" class=\"indicator-domains\"></div>"
            + "<div class=\"staff-editor-actions\">"
            + "<button class=\"wash-save\" id=\"cycle-save\" type=\"button\">حفظ الدورة</button>"
            + "<button class=\"wash-back\" type=\"button\">العودة</button>"
            + "</div>"
            + "</section>"
            + "<section class=\"board-card board-span staff-toolbar\">"
            + "<div class=\"staff-toolbar-row\">"
            + "<input id=\"indicator-search\" type=\"search\" placeholder=\"ابحث بالرمز أو النص\" autocomplete=\"off\">"
            + "<select id=\"indicator-domain\" aria-label=\"تصفية المجال\"><option value=\"all\">كل المجالات</option></select>"
            + "<select id=\"indicator-level\" aria-label=\"تصفية المستوى\"><option value=\"all\">كل المستويات</option></select>"
            + "<button class=\"staff-add\" id=\"indicator-open\" type=\"button\">مؤشر جديد</button>"
            + "<button class=\"wash-back\" type=\"button\">العودة</button>"
            + "</div>"
            + "<p class=\"wash-hint\" id=\"indicator-count\"></p>"
            + "<p class=\"wash-note\"></p>"
            + "</section>"
            + "<section class=\"board-card board-span\" id=\"indicator-editor\" hidden>"
            + "<p class=\"wash-section\" id=\"indicator-editor-title\">مؤشر جديد</p>"
            + "<div class=\"facility-fields\">"
            + "<label class=\"wash-field\"><span>الرمز</span><input name=\"code\" type=\"text\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>المجال</span><input name=\"domain\" type=\"text\" list=\"indicator-domain-list\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>المعيار</span><input name=\"standardName\" type=\"text\" list=\"indicator-standard-list\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>المستوى</span><select name=\"level\"></select></label>"
            + "<label class=\"wash-field\"><span>نسبة المجال</span><input name=\"domainScore\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>المسافة للمستوى التالي</span><input name=\"gap\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field is-wide\"><span>نص المؤشر</span><textarea name=\"statement\"></textarea></label>"
            + "</div>"
            + "<datalist id=\"indicator-domain-list\"></datalist>"
            + "<datalist id=\"indicator-standard-list\"></datalist>"
            + "<div class=\"staff-editor-actions\">"
            + "<button class=\"wash-save\" id=\"indicator-commit\" type=\"button\">إضافة</button>"
            + "<button class=\"wash-cancel\" id=\"indicator-dismiss\" type=\"button\">إلغاء</button>"
            + "<button class=\"wash-back\" type=\"button\">العودة</button>"
            + "</div>"
            + "</section>"
            + "<section class=\"board-card board-span\">"
            + "<table class=\"staff-table indicator-table\">"
            + "<thead><tr>"
            + "<th class=\"is-fit\">الرمز</th><th class=\"is-name\">المجال</th><th class=\"is-name\">المعيار</th><th class=\"is-text\">النص</th><th class=\"is-fit\">المستوى</th><th class=\"is-fit\">نسبة المجال</th><th class=\"is-fit\">المسافة</th><th class=\"is-fit\">الإجراءات</th>"
            + "</tr></thead>"
            + "<tbody id=\"indicator-rows\"></tbody>"
            + "</table>"
            + "</section>"
            + "</div></form>"
        );
        var form = pane.querySelector("#indicator-form");
        var note = form.querySelector(".wash-note");
        var body = form.querySelector("#indicator-rows");
        var editor = form.querySelector("#indicator-editor");
        function fillLevel(select, blank) {
            select.innerHTML = "";
            if (blank) {
                var empty = document.createElement("option");
                empty.value = "";
                empty.textContent = blank;
                select.appendChild(empty);
            }
            levels.forEach(function (level) {
                var option = document.createElement("option");
                option.value = level;
                option.textContent = level;
                select.appendChild(option);
            });
        }
        fillLevel(form.elements.overallLevel, "بدون مستوى");
        fillLevel(form.elements.level, "اختر المستوى");
        levels.forEach(function (level) {
            var option = document.createElement("option");
            option.value = level;
            option.textContent = level;
            form.querySelector("#indicator-level").appendChild(option);
        });
        function domainMap() {
            var map = {};
            ((cycle && cycle.domains) || []).forEach(function (item) {
                map[item.name] = item;
            });
            return map;
        }
        function paintDomains() {
            var host = form.querySelector("#domain-scores");
            host.innerHTML = "";
            ((cycle && cycle.domains) || []).forEach(function (item, index) {
                var row = document.createElement("div");
                row.className = "facility-fields cols-3";
                var name = document.createElement("label");
                name.className = "wash-field";
                var nameCaption = document.createElement("span");
                nameCaption.textContent = "المجال";
                var nameInput = document.createElement("input");
                nameInput.type = "text";
                nameInput.readOnly = true;
                nameInput.value = item.name || "";
                nameInput.setAttribute("data-domain-name", String(index));
                name.appendChild(nameCaption);
                name.appendChild(nameInput);
                var score = document.createElement("label");
                score.className = "wash-field";
                var scoreCaption = document.createElement("span");
                scoreCaption.textContent = "النسبة";
                var scoreInput = document.createElement("input");
                scoreInput.type = "text";
                scoreInput.inputMode = "decimal";
                scoreInput.value = item.score || "";
                scoreInput.setAttribute("data-domain-score", String(index));
                score.appendChild(scoreCaption);
                score.appendChild(scoreInput);
                var gap = document.createElement("label");
                gap.className = "wash-field";
                var gapCaption = document.createElement("span");
                gapCaption.textContent = "المسافة للمستوى التالي";
                var gapInput = document.createElement("input");
                gapInput.type = "text";
                gapInput.inputMode = "decimal";
                gapInput.value = item.gap_to_next || "";
                gapInput.setAttribute("data-domain-gap", String(index));
                gap.appendChild(gapCaption);
                gap.appendChild(gapInput);
                row.appendChild(name);
                row.appendChild(score);
                row.appendChild(gap);
                host.appendChild(row);
            });
        }
        function paintLists() {
            var domains = {};
            var standards = {};
            rows.forEach(function (row) {
                if (row.domain) {
                    domains[row.domain] = true;
                }
                if (row.standard_name) {
                    standards[row.standard_name] = true;
                }
            });
            var domainSelect = form.querySelector("#indicator-domain");
            var current = domainSelect.value;
            domainSelect.innerHTML = "";
            var all = document.createElement("option");
            all.value = "all";
            all.textContent = "كل المجالات";
            domainSelect.appendChild(all);
            Object.keys(domains).forEach(function (name) {
                var option = document.createElement("option");
                option.value = name;
                option.textContent = name;
                domainSelect.appendChild(option);
            });
            domainSelect.value = domains[current] || current === "all" ? current : "all";
            domainFilter = domainSelect.value;
            function fillData(id, values) {
                var list = form.querySelector(id);
                list.innerHTML = "";
                Object.keys(values).forEach(function (value) {
                    var option = document.createElement("option");
                    option.value = value;
                    list.appendChild(option);
                });
            }
            fillData("#indicator-domain-list", domains);
            fillData("#indicator-standard-list", standards);
        }
        function codeKey(code) {
            return String(code || "").split("-").map(function (piece) {
                return piece.padStart(4, "0");
            }).join("-");
        }
        function matches(row) {
            var needle = query.replace(/\s+/g, "");
            var found = !needle || (row.code + row.statement).replace(/\s+/g, "").indexOf(needle) >= 0;
            return found && (domainFilter === "all" || row.domain === domainFilter) && (levelFilter === "all" || row.level === levelFilter);
        }
        function render() {
            body.innerHTML = "";
            var list = rows.filter(matches).sort(function (a, b) {
                return codeKey(a.code) < codeKey(b.code) ? -1 : 1;
            });
            var counter = form.querySelector("#indicator-count");
            counter.textContent = "المعروض " + list.length + " من أصل " + rows.length + ".";
            if (!list.length) {
                var empty = document.createElement("tr");
                var cell = document.createElement("td");
                cell.colSpan = 8;
                cell.textContent = "لا مؤشرات في هذا التصفية.";
                empty.appendChild(cell);
                body.appendChild(empty);
                return;
            }
            var columnKind = {
                code: "is-fit",
                domain: "is-name",
                standard_name: "is-name",
                statement: "is-text",
                level: "is-fit",
                domain_score: "is-fit",
                gap_to_next: "is-fit"
            };
            list.forEach(function (row) {
                var tr = document.createElement("tr");
                ["code", "domain", "standard_name", "statement", "level", "domain_score", "gap_to_next"].forEach(function (key) {
                    var cell = document.createElement("td");
                    cell.className = columnKind[key];
                    cell.textContent = row[key] || "";
                    tr.appendChild(cell);
                });
                var actions = document.createElement("td");
                actions.className = "staff-actions is-fit";
                var edit = document.createElement("button");
                edit.type = "button";
                edit.className = "staff-icon";
                edit.setAttribute("aria-label", "تعديل");
                edit.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 20h4l10-10-4-4L4 16v4z\"/><path d=\"M13 7l4 4\"/></svg>";
                edit.addEventListener("click", function () {
                    openEditor(row);
                });
                var remove = document.createElement("button");
                remove.type = "button";
                remove.className = "staff-icon is-delete";
                remove.setAttribute("aria-label", "حذف");
                remove.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 8h14\"/><path d=\"M9 8V5h6v3\"/><path d=\"M8 8l1 12h6l1-12\"/></svg>";
                remove.addEventListener("click", function () {
                    if (!window.confirm("حذف المؤشر " + row.code + " من السجل؟")) {
                        return;
                    }
                    fetch("/api/evaluation/indicators/" + encodeURIComponent(row.id), { method: "DELETE" }).then(function (response) {
                        if (!response.ok) {
                            throw new Error("تعذر الحذف");
                        }
                        if (editing === row.id) {
                            closeEditor();
                        }
                        note.textContent = "حُذف المؤشر من السجل.";
                        loadRows();
                    }).catch(function () {
                        note.textContent = "تعذر حذف المؤشر.";
                    });
                });
                actions.appendChild(edit);
                actions.appendChild(remove);
                tr.appendChild(actions);
                body.appendChild(tr);
            });
        }
        function closeEditor() {
            editing = 0;
            editor.hidden = true;
        }
        function openEditor(row) {
            editing = row ? row.id : 0;
            editor.hidden = false;
            form.querySelector("#indicator-editor-title").textContent = row ? "تعديل المؤشر" : "مؤشر جديد";
            form.querySelector("#indicator-commit").textContent = row ? "حفظ التعديل" : "إضافة";
            form.elements.code.value = row ? row.code : "";
            form.elements.domain.value = row ? row.domain : "";
            form.elements.standardName.value = row ? row.standard_name : "";
            form.elements.level.value = row ? row.level : "";
            markEvalLevels(document.getElementById("erp-pane"));
            form.elements.domainScore.value = row ? row.domain_score : "";
            form.elements.gap.value = row ? row.gap_to_next : "";
            form.elements.statement.value = row ? row.statement : "";
            form.elements.code.focus();
        }
        function applyCycle(next) {
            cycle = next;
            form.elements.title.value = next ? next.title : "";
            form.elements.year.value = next ? next.academic_year : "";
            form.elements.overall.value = next ? next.overall_score : "";
            form.elements.overallLevel.value = next && next.overall_level ? next.overall_level : "";
            markEvalLevels(document.getElementById("erp-pane"));
            paintDomains();
        }
        form.elements.domain.addEventListener("change", function () {
            var item = domainMap()[form.elements.domain.value.trim()];
            if (!item) {
                return;
            }
            form.elements.domainScore.value = item.score || "";
            form.elements.gap.value = item.gap_to_next || "";
        });
        form.querySelector("#indicator-search").addEventListener("input", function (event) {
            query = event.target.value || "";
            render();
        });
        form.querySelector("#indicator-domain").addEventListener("change", function (event) {
            domainFilter = event.target.value;
            render();
        });
        form.querySelector("#indicator-level").addEventListener("change", function (event) {
            levelFilter = event.target.value;
            render();
        });
        form.querySelector("#indicator-open").addEventListener("click", function () {
            openEditor(null);
        });
        form.querySelector("#indicator-dismiss").addEventListener("click", function () {
            closeEditor();
            note.textContent = "";
        });
        form.querySelector("#cycle-save").addEventListener("click", function () {
            var domains = ((cycle && cycle.domains) || []).map(function (item, index) {
                var score = form.querySelector("[data-domain-score=\"" + index + "\"]");
                var gap = form.querySelector("[data-domain-gap=\"" + index + "\"]");
                return {
                    name: item.name,
                    score: score ? score.value.trim() : "",
                    gap_to_next: gap ? gap.value.trim() : ""
                };
            });
            fetch("/api/evaluation/cycle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: form.elements.title.value.trim(),
                    academic_year: form.elements.year.value.trim(),
                    overall_score: form.elements.overall.value.trim(),
                    overall_level: form.elements.overallLevel.value,
                    domains: domains
                })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر حفظ الدورة");
                    }
                    return payload;
                });
            }).then(function () {
                note.textContent = "حُفظت دورة التقويم.";
                loadRows();
                if (window.dataHub) {
                    window.dataHub.publish("indicators");
                }
            }).catch(function (error) {
                note.textContent = error.message || "تعذر حفظ الدورة.";
            });
        });
        form.querySelector("#indicator-commit").addEventListener("click", function () {
            if (!cycle) {
                note.textContent = "تُحفظ الدورة أولًا.";
                return;
            }
            var next = {
                id: editing || 0,
                cycle_id: cycle.id,
                code: form.elements.code.value.trim(),
                domain: form.elements.domain.value.trim(),
                standard_name: form.elements.standardName.value.trim(),
                statement: form.elements.statement.value.trim(),
                level: form.elements.level.value,
                domain_score: form.elements.domainScore.value.trim(),
                gap_to_next: form.elements.gap.value.trim()
            };
            if (!next.code || !next.domain || !next.standard_name || !next.statement || !next.level) {
                note.textContent = "الرمز والمجال والمعيار والنص والمستوى مطلوبة.";
                return;
            }
            fetch("/api/evaluation/indicators", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(next)
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر الحفظ");
                    }
                    return payload;
                });
            }).then(function () {
                note.textContent = editing ? "حُفظ تعديل المؤشر." : "أُضيف المؤشر إلى السجل.";
                closeEditor();
                loadRows();
                if (window.dataHub) {
                    window.dataHub.publish("indicators");
                }
            }).catch(function (error) {
                note.textContent = error.message || "تعذر الحفظ.";
            });
        });
        function loadRows() {
            fetch("/api/evaluation").then(function (response) {
                return response.json();
            }).then(function (payload) {
                applyCycle(payload.cycle || null);
                rows = payload.indicators || [];
                paintLists();
                render();
            }).catch(function () {
                note.textContent = "تعذر قراءة سجل المؤشرات.";
            });
        }
        form.addEventListener("submit", function (event) {
            event.preventDefault();
        });
        loadRows();
    }

    function showPane(link) {
        if (window.board1059Access && !window.board1059Access.allowsLink(link)) {
            return;
        }
        var welcome = document.getElementById("erp-welcome");
        var pane = document.getElementById("erp-pane");
        if (!pane) {
            return;
        }
        if (welcome) {
            welcome.hidden = true;
        }
        restoreParked();
        pane.hidden = false;
        pane.classList.remove("is-board");
        pane.classList.remove("is-booklet");
        pane.classList.remove("is-deck");
        document.body.classList.remove("deck-open");
        pane.innerHTML = "";
        var board = link.getAttribute("data-erp-board");
        if (board === "facility") {
            paintFacility(pane);
            return;
        }
        if (board === "calendar") {
            paintCalendar(pane);
            return;
        }
        if (board === "occasions") {
            paintOccasions(pane);
            return;
        }
        if (board === "leadership") {
            paintLeadership(pane);
            return;
        }
        if (board === "indicators") {
            paintEvaluation(pane);
            return;
        }
        if (board === "nafs") {
            paintNafs(pane);
            return;
        }
        if (board === "improvement") {
            paintImprovement(pane);
            return;
        }
        if (board === "programs") {
            paintPrograms(pane);
            return;
        }
        if (board === "plan-seat") {
            paintPlanSeat(pane);
            return;
        }
        if (board === "school-plan") {
            paintSchoolPlan(pane);
            return;
        }
        if (board === "program-records") {
            paintProgramRecords(pane);
            return;
        }
        if (board === "six-registers") {
            paintSixRegisters(pane);
            return;
        }
        if (board === "command-board") {
            paintCommandBoard(pane);
            return;
        }
        if (board === "staff") {
            paintStaff(pane);
            return;
        }
        if (board === "permissions") {
            paintPermissions(pane);
            return;
        }
        if (board === "noor") {
            paintNoorImport(pane);
            return;
        }
        if (board === "attendance") {
            paintAttendance(pane);
            return;
        }
        if (board === "absence") {
            paintAbsence(pane);
            return;
        }
        if (board === "councils") {
            paintCouncils(pane);
            return;
        }
        if (board === "visits") {
            paintVisits(pane);
            return;
        }
        if (board && window.erpBoards && typeof window.erpBoards[board] === "function") {
            window.erpBoards[board](pane, link);
            return;
        }
        var label = link.getAttribute("data-erp-label");
        var heading = document.createElement("h1");
        heading.textContent = label || link.getAttribute("data-erp-column") || link.textContent;
        var note = document.createElement("p");
        note.textContent = link.getAttribute("data-erp-group") + " — " + (label || link.textContent) + ". نص تجريبي، والمحتوى سيُعرض في هذه المساحة.";
        pane.appendChild(heading);
        pane.appendChild(note);
    }

    var closeTimer = 0;
    document.addEventListener("mouseover", function (event) {
        var item = event.target.closest ? event.target.closest(".erp-item") : null;
        if (!item) {
            return;
        }
        window.clearTimeout(closeTimer);
        openItem(item);
    });
    document.addEventListener("mouseout", function (event) {
        var item = event.target.closest ? event.target.closest(".erp-item") : null;
        if (!item) {
            return;
        }
        var next = event.relatedTarget;
        if (next && item.contains(next)) {
            return;
        }
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(function () {
            closeAll(null);
        }, 180);
    });
    document.addEventListener("click", function (event) {
        var back = event.target.closest ? event.target.closest(".wash-back") : null;
        if (back) {
            returnToWelcome();
            return;
        }
        var trigger = event.target.closest ? event.target.closest(".erp-trigger") : null;
        if (trigger) {
            var item = trigger.closest(".erp-item");
            /* قرار 166-ب · روابط صفحة كاملة (مثل خطتي) لا تُمنع */
            if (trigger.tagName === "A") {
                var href = String(trigger.getAttribute("href") || "").trim();
                if (href && href.charAt(0) !== "#") {
                    closeAll(null);
                    return;
                }
            }
            event.preventDefault();
            if (!item) {
                return;
            }
            var openedAt = Number(item.dataset.openedAt || 0);
            if (item.classList.contains("is-open") && Date.now() - openedAt > 350) {
                closeItem(item);
            } else if (!item.classList.contains("is-open")) {
                openItem(item);
            }
            return;
        }
        var choice = event.target.closest ? event.target.closest(".erp-panel a") : null;
        if (choice && choice.closest("#erp-about")) {
            closeAll(null);
            return;
        }
        if (choice) {
            event.preventDefault();
            closeAll(null);
            showPane(choice);
            return;
        }
        if (!event.target.closest || !event.target.closest(".erp-item")) {
            closeAll(null);
        }
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeAll(null);
        }
    });
    window.addEventListener("resize", function () {
        var open = document.querySelector(".erp-item.is-open .erp-panel");
        if (open) {
            place(open);
        }
    });

    function cellPlain(cell) {
        var field = cell.querySelector("textarea, input");
        var text = field ? field.value : cell.textContent;
        return String(text || "").replace(/\s+/g, " ").trim();
    }

    function fitBoardTables(root) {
        if (!root) {
            return;
        }
        root.querySelectorAll("table").forEach(function (table) {
            if (table.closest("#booklet") || table.closest(".deck-slide")) {
                return;
            }
            var head = table.tHead && table.tHead.rows[0];
            if (!head) {
                return;
            }
            var bodyRows = [];
            [].forEach.call(table.tBodies, function (body) {
                [].forEach.call(body.rows, function (row) {
                    bodyRows.push(row);
                });
            });
            [].forEach.call(head.cells, function (th, index) {
                if (th.colSpan > 1) {
                    return;
                }
                var longest = cellPlain(th).length;
                bodyRows.forEach(function (row) {
                    var cell = row.cells[index];
                    if (!cell || cell.colSpan > 1) {
                        return;
                    }
                    var size = cellPlain(cell).length;
                    if (size > longest) {
                        longest = size;
                    }
                });
                var kind = longest > 42 ? "is-text" : (longest > 16 ? "is-name" : "is-fit");
                th.classList.remove("is-fit", "is-name", "is-text");
                th.classList.add(kind);
                bodyRows.forEach(function (row) {
                    var cell = row.cells[index];
                    if (!cell || cell.colSpan > 1) {
                        return;
                    }
                    cell.classList.remove("is-fit", "is-name", "is-text");
                    cell.classList.add(kind);
                });
            });
        });
    }

    var boardPane = document.getElementById("erp-pane");
    var fitFrame = 0;
    if (boardPane && window.MutationObserver) {
        new MutationObserver(function () {
            window.cancelAnimationFrame(fitFrame);
            fitFrame = window.requestAnimationFrame(function () {
                fitBoardTables(boardPane);
                markEvalLevels(boardPane);
            });
        }).observe(boardPane, { childList: true, subtree: true });
        boardPane.addEventListener("change", function (event) {
            if (event.target && event.target.tagName === "SELECT") {
                markEvalLevels(boardPane);
            }
        });
    }

    function markEvalLevels(root) {
        if (!root) {
            return;
        }
        var tones = { "تهيئة": "eval-seed", "انطلاق": "eval-start", "تقدم": "eval-rise", "تميز": "eval-peak" };
        var names = ["eval-seed", "eval-start", "eval-rise", "eval-peak"];
        function paint(node, kind) {
            var current = "";
            names.forEach(function (name) {
                if (node.classList.contains(name)) {
                    current = name;
                }
            });
            if (current === (kind || "")) {
                return;
            }
            names.forEach(function (name) {
                if (name !== kind) {
                    node.classList.remove(name);
                }
            });
            if (kind) {
                node.classList.add(kind);
            }
        }
        root.querySelectorAll("td, option, select").forEach(function (node) {
            if (node.closest("#booklet") || node.closest(".deck-slide")) {
                return;
            }
            var text = "";
            if (node.tagName === "SELECT") {
                var chosen = node.options[node.selectedIndex];
                text = chosen ? chosen.textContent : "";
            } else if (node.tagName === "TD" && node.children.length) {
                return;
            } else {
                text = node.textContent;
            }
            text = String(text || "").replace(/\s+/g, " ").trim();
            paint(node, tones[text] || "");
        });
    }

    var heroSlides = Array.prototype.slice.call(document.querySelectorAll(".dash-hero-slide"));
    var heroTitle = document.getElementById("dash-hero-title");
    var heroLine = document.getElementById("dash-hero-line");
    var heroDots = Array.prototype.slice.call(document.querySelectorAll(".dash-hero-dots button"));
    var heroLines = [
        ["قيادةٌ مدرسية مبتكرة.. لجيلٍ يصنع الفارق ويحقق الرؤية.", "نصنع المستقبل برؤية طموحة.. وعزمٍ لا يلين."],
        ["من هنا تبدأ رحلة التميز.. نحو آفاق 2030.", "تنافسيةٌ في العطاء.. وريادةٌ في بناء العقول."]
    ];
    var heroIndex = 0;
    function showHero(next) {
        if (!heroSlides.length || !heroTitle || !heroLine) {
            return;
        }
        heroIndex = (next + heroSlides.length) % heroSlides.length;
        heroSlides.forEach(function (slide, index) {
            slide.classList.toggle("is-active", index === heroIndex);
        });
        heroDots.forEach(function (dot, index) {
            dot.classList.toggle("is-active", index === heroIndex);
        });
        heroTitle.textContent = heroLines[heroIndex][0];
        heroLine.textContent = heroLines[heroIndex][1];
    }
    heroDots.forEach(function (dot) {
        dot.addEventListener("click", function () {
            showHero(Number(dot.getAttribute("data-hero")));
        });
    });
    window.setInterval(function () {
        var welcome = document.getElementById("erp-welcome");
        if (welcome && !welcome.hidden) {
            showHero(heroIndex + 1);
        }
    }, 7000);
    if (window.dataHub) {
        window.dataHub.attach(staffDirectory);
    }
    function paintSchoolPlanSummary() {
        var body = document.getElementById("school-plan-summary-body");
        if (!body) {
            return;
        }
        fetch("/api/operational-plan").then(function (response) {
            return response.json();
        }).then(function (payload) {
            var card = payload.summary || {};
            var origin = card.source === "saved" ? "محفوظة في الجدول" : "من ملف المدير، ولم تُحفظ بعد";
            body.textContent = (card.goal_count || 0) + " أهداف " + origin
                + " — نسبة الإنجاز: " + (card.progress_label || "لا نسبة محفوظة")
                + " — البرامج النشطة: " + (card.active_programs || 0);
        }).catch(function () {
            body.textContent = "تعذر قراءة ملخص الخطة.";
        });
    }
    paintSchoolPlanSummary();
    window.addEventListener("dataChanged", function (event) {
        var source = event.detail && event.detail.source;
        if (source === "operational-plan" || source === "programs") {
            paintSchoolPlanSummary();
        }
    });

    window.board1059Access = {
        session: function () {
            try {
                return JSON.parse(sessionStorage.getItem("sessionUser") || "null");
            } catch (error) {
                return null;
            }
        },
        headers: function () {
            var user = this.session() || {};
            return {
                "Content-Type": "application/json",
                "X-Session-Token": user.token || ""
            };
        },
        isPrincipal: function () {
            var user = this.session();
            var role = String(user && user.role || "");
            return role.indexOf("مدير") === 0 || role.indexOf("مسؤول النظام") === 0;
        },
        windows: function () {
            var user = this.session();
            if (!user) {
                return {};
            }
            var trial = window.BOARD1059_TRIAL || null;
            if (trial && trial.enabled && trial.open_all_windows) {
                return null;
            }
            var saved = {};
            try {
                saved = (JSON.parse(localStorage.getItem("board1059.permissions") || "{}") || {})[user.id] || {};
            } catch (error) {
                saved = {};
            }
            if (this.isPrincipal() || saved.level === "system") {
                return null;
            }
            if (saved.windows) {
                return saved.windows;
            }
            var role = user.role || "";
            var open = {
                settings: false,
                schoolRegisters: false,
                viceRegisters: false,
                teacherRegisters: false,
                tasks: false,
                committees: false,
                plans: false,
                indicators: false
            };
            if (role.indexOf("وكيل") === 0) {
                Object.keys(open).forEach(function (key) {
                    open[key] = true;
                });
            } else if (role.indexOf("معلم") === 0 || role === "الموجه الطلابي" || role === "رائد النشاط") {
                open.teacherRegisters = true;
                open.tasks = true;
            }
            return open;
        },
        allows: function (windowId) {
            var map = this.windows();
            if (map === null) {
                return true;
            }
            return !!map[windowId];
        },
        allowsLink: function (link) {
            var user = this.session();
            if (!user || !user.token) {
                window.location.replace("login.html");
                return false;
            }
            var windowId = link.getAttribute("data-erp-window");
            if (!windowId) {
                var menu = link.closest ? link.closest("[data-erp-menu]") : null;
                windowId = menu ? menu.getAttribute("data-erp-window") || menu.getAttribute("data-erp-menu") : "";
            }
            if (windowId === "registers") {
                return this.allows("schoolRegisters") || this.allows("viceRegisters") || this.allows("teacherRegisters");
            }
            return !windowId || this.allows(windowId);
        },
        applyMenu: function () {
            var self = this;
            document.querySelectorAll(".erp-item[data-erp-menu]").forEach(function (item) {
                var menu = item.getAttribute("data-erp-menu");
                if (menu === "registers") {
                    item.hidden = !(self.allows("schoolRegisters") || self.allows("viceRegisters") || self.allows("teacherRegisters"));
                    return;
                }
                var windowId = item.getAttribute("data-erp-window") || menu;
                item.hidden = !self.allows(windowId);
            });
            document.querySelectorAll("[data-erp-window]").forEach(function (link) {
                if (link.classList.contains("erp-item")) {
                    return;
                }
                link.hidden = !self.allows(link.getAttribute("data-erp-window"));
            });
            document.querySelectorAll(".erp-panel > div").forEach(function (column) {
                var links = column.querySelectorAll("a[data-erp-window]");
                if (!links.length) {
                    return;
                }
                var visible = false;
                links.forEach(function (link) {
                    if (!link.hidden) {
                        visible = true;
                    }
                });
                column.hidden = !visible;
            });
        }
    };
    window.board1059Access.applyMenu();
    fetch("/api/session", { headers: window.board1059Access.headers() }).then(function (response) {
        if (response.status === 401) {
            sessionStorage.removeItem("sessionUser");
            window.location.replace("login.html");
        }
    });

    var witnessLabels = { "الشاهد": true, "الشواهد": true, "نوع الشاهد": true };

    function witnessEscape(value) {
        return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    }

    function witnessControlValue(node) {
        if (!node || node.disabled || node.type === "file" || node.type === "button" || node.type === "submit" || node.type === "checkbox" || node.type === "radio") {
            return "";
        }
        if (node.type === "hidden") {
            if (node.closest && node.closest(".witness-scope") && node.getAttribute("data-label")) {
                return String(node.value || "").trim();
            }
            return "";
        }
        if (node.tagName === "SELECT" && node.multiple) {
            return Array.prototype.filter.call(node.selectedOptions, function (option) {
                return option.value;
            }).map(function (option) {
                return option.textContent.trim();
            }).join("، ");
        }
        if (node.tagName === "SELECT") {
            if (!node.value) {
                return "";
            }
            var option = node.options[node.selectedIndex];
            return option ? option.textContent.trim() : String(node.value).trim();
        }
        return String(node.value || "").trim();
    }

    function isWitnessControl(node) {
        if (!node || !node.getAttribute) {
            return false;
        }
        var label = node.getAttribute("data-label") || "";
        return witnessLabels[label] || node.getAttribute("name") === "evidence" || label.indexOf("شاهد") >= 0;
    }

    function witnessControlNear(button) {
        var host = button.closest(".witness-scope, .wash-field, .evidence-cell, td, label") || button.parentElement;
        if (!host) {
            return null;
        }
        var nodes = host.querySelectorAll("[data-label], [name='evidence']");
        var found = null;
        Array.prototype.forEach.call(nodes, function (node) {
            if (!found && isWitnessControl(node)) {
                found = node;
            }
        });
        return found;
    }

    function witnessScope(button) {
        return button.closest("tr")
            || button.closest(".improvement-card")
            || button.closest(".register-section")
            || button.closest(".scenario-box")
            || button.closest(".witness-scope")
            || button.closest("form")
            || button.parentElement;
    }

    function witnessContext(scope) {
        if (!scope || !scope.closest) {
            return "السجل";
        }
        if (scope.closest("#improvement-form, .improvement-card")) {
            return "خطة التحسين";
        }
        if (scope.closest(".soft-periods-board, .soft-day-block, .soft-follow-row")) {
            return "الفترات اللاصفية";
        }
        if (scope.closest("#exec-rows")) {
            return "الخطة التنفيذية";
        }
        var body = scope.closest(".register-form-body");
        var note = body && body.querySelector(".register-identity");
        if (note && note.textContent.trim()) {
            return note.textContent.trim();
        }
        var editor = scope.closest("#register-editor");
        var heading = editor && editor.querySelector(".register-editor-head h3");
        if (heading && heading.textContent.trim()) {
            return heading.textContent.trim();
        }
        return "السجل";
    }

    function witnessLabelOf(control) {
        var explicit = control.getAttribute("data-label");
        if (explicit) {
            return explicit;
        }
        var field = control.closest(".wash-field");
        if (!field) {
            return control.getAttribute("name") || "";
        }
        var span = field.querySelector("span");
        if (!span) {
            return "";
        }
        var copy = span.cloneNode(true);
        copy.querySelectorAll(".evidence-print, .evidence-edit").forEach(function (button) {
            button.remove();
        });
        return copy.textContent.replace(/\s+/g, " ").trim();
    }

    function witnessLines(scope, witnessControl) {
        var lines = [];
        var seen = {};
        function add(label, value) {
            label = String(label || "").replace(/\s+/g, " ").trim();
            value = String(value || "").replace(/\s+/g, " ").trim();
            if (!label || !value || seen[label] || witnessLabels[label]) {
                return;
            }
            seen[label] = true;
            lines.push({ label: label, value: value });
        }
        scope.querySelectorAll(".dual-date-block, label.dual-date").forEach(function (block) {
            var hijri = "";
            var gregorian = "";
            var nodes = block.querySelectorAll("input");
            Array.prototype.forEach.call(nodes, function (node) {
                var name = node.getAttribute("name") || "";
                var data = node.getAttribute("data-label") || "";
                var value = witnessControlValue(node);
                if (name.indexOf("Hijri") >= 0 || data.indexOf("هجري") >= 0 || node.classList.contains("doc-hijri")) {
                    hijri = value;
                } else {
                    gregorian = value;
                }
                node.dataset.witnessSkip = "1";
            });
            var head = block.querySelector(":scope > span");
            var caption = head ? head.textContent.replace(/\s+/g, " ").trim() : "";
            if (!caption && nodes[0]) {
                caption = String(nodes[0].getAttribute("data-label") || "").replace(/\s+هجري$/, "").replace(/\s+ميلادي$/, "");
            }
            var joined = hijri && gregorian ? hijri + " الموافق " + gregorian : (hijri || gregorian);
            add(caption, joined);
        });
        scope.querySelectorAll("input, select, textarea").forEach(function (node) {
            if (node.dataset.witnessSkip === "1" || node === witnessControl) {
                return;
            }
            add(witnessLabelOf(node), witnessControlValue(node));
        });
        scope.querySelectorAll("[data-witness-skip]").forEach(function (node) {
            delete node.dataset.witnessSkip;
        });
        return lines;
    }

    function witnessPieces(text) {
        return String(text || "").split(/[،,\n]/).map(function (part) {
            return part.trim();
        }).filter(Boolean);
    }

    function witnessLine(lines, label) {
        var found = null;
        lines.forEach(function (line) {
            if (!found && line.label === label) {
                found = line;
            }
        });
        return found;
    }

    function leadershipSeat(role) {
        var keys = {
            principal: ["principal"],
            vice_teachers: ["viceTeachersList", "viceTeachers"],
            students_vice: ["studentsVices", "studentsVice"]
        };
        var data = {};
        try {
            data = JSON.parse(localStorage.getItem("board1059.leadership") || "null") || {};
        } catch (error) {
            data = {};
        }
        var stored = "";
        (keys[role] || []).forEach(function (key) {
            if (stored) {
                return;
            }
            var value = data[key];
            if (Array.isArray(value) && value.length) {
                stored = value[0] || "";
            } else if (value) {
                stored = value;
            }
        });
        stored = String(stored || "").trim();
        var id = /^\d{10,}$/.test(stored) ? stored : "";
        var name = "";
        if (stored && window.dataHub && typeof window.dataHub.display === "function") {
            name = String(window.dataHub.display(stored) || "").trim();
        }
        if ((!name || name === stored) && id && window.dataHub && typeof window.dataHub.displayWritten === "function") {
            name = String(window.dataHub.displayWritten(id) || name || "").trim();
        }
        if (!name && stored && !/^\d{10,}$/.test(stored)) {
            name = stored;
        }
        if (name && /^\d{10,}$/.test(name)) {
            name = "";
        }
        return { id: id, name: name || "" };
    }

    function signImage(id, roleFile) {
        var primary = id ? "signatures/sig_" + id + ".png" : roleFile;
        var fallback = id && roleFile ? roleFile : "";
        var handler = fallback
            ? "if(this.dataset.fallback){var n=this.dataset.fallback;this.dataset.fallback='';this.src=n;}else{this.remove();}"
            : "this.remove()";
        return "<img class=\"improvement-sign-img\" src=\"" + witnessEscape(primary) + "\""
            + (fallback ? " data-fallback=\"" + witnessEscape(fallback) + "\"" : "")
            + " alt=\"\" onerror=\"" + handler + "\">";
    }

    function signName(name) {
        return name ? "<b class=\"improvement-sign-name\">" + witnessEscape(name) + "</b>" : "";
    }

    function witnessSignTable() {
        var reviewer = leadershipSeat("vice_teachers");
        var principal = leadershipSeat("principal");
        return "<table class=\"improvement-sign\"><thead><tr><th>إعداد</th><th>مراجعة</th><th>اعتماد</th></tr></thead><tbody>"
            + "<tr><td>فريق التميز المدرسي</td><td>وكيل الشؤون التعليمية</td><td>مدير المدرسة</td></tr>"
            + "<tr class=\"improvement-sign-space\"><td></td>"
            + "<td>" + signImage(reviewer.id, "signatures/sig_teachers.png") + signName(reviewer.name) + "</td>"
            + "<td class=\"improvement-sign-approve\"><span class=\"improvement-sign-mark\">" + signImage(principal.id, "signatures/sig_manager.png")
            + "<img class=\"improvement-sign-stamp\" src=\"/assets/img/official_school_stamp.png\" alt=\"\"></span>" + signName(principal.name) + "</td>"
            + "</tr></tbody></table>";
    }

    function witnessHeader(scope, title) {
        var form = scope && scope.closest ? scope.closest("#improvement-form") : null;
        var live = form && form.querySelector(".print-header-table");
        if (live) {
            var copy = live.cloneNode(true);
            var corner = copy.querySelector(".plan-seat-side.is-end div");
            if (corner && title) {
                corner.textContent = title;
            }
            return copy.outerHTML;
        }
        return "<header class=\"print-header-table\">"
            + "<div class=\"plan-seat-side identity-stack\">"
            + "<div>المملكة العربية السعودية</div><div>وزارة التعليم</div>"
            + "<div>الإدارة العامة للتعليم بمنطقة المدينة المنورة</div>"
            + "<div>متوسطة سعد بن الربيع الأنصاري</div></div>"
            + "<div class=\"print-header-logo\"><img src=\"/assets/ministry_logo.png\" alt=\"وزارة التعليم\"></div>"
            + "<div class=\"plan-seat-side is-end\">" + (title ? "<div>" + witnessEscape(title) + "</div>" : "") + "</div></header>";
    }

    function witnessKind(text) {
        var value = String(text || "");
        if (value.indexOf("عقد") >= 0 || value.indexOf("عقود") >= 0) {
            return "contract";
        }
        if (value.indexOf("محضر") >= 0 || value.indexOf("محاضر") >= 0) {
            return "minutes";
        }
        if (value.indexOf("سجل") >= 0) {
            return "register";
        }
        if (value.indexOf("تقرير") >= 0 || value.indexOf("تقارير") >= 0) {
            return "report";
        }
        if (value.indexOf("كشف") >= 0 || value.indexOf("كشوف") >= 0) {
            return "roster";
        }
        return "record";
    }

    function witnessValue(lines, labels) {
        var found = "";
        labels.forEach(function (label) {
            if (found) {
                return;
            }
            var line = witnessLine(lines, label);
            if (line && line.value) {
                found = line.value;
            }
        });
        return found;
    }

    function witnessMeasure(lines) {
        var baseline = witnessValue(lines, ["خط الأساس"]);
        var target = witnessValue(lines, ["المستهدف"]);
        var unit = witnessValue(lines, ["الوحدة"]);
        var from = [baseline, unit].filter(Boolean).join(" ");
        var to = [target, unit].filter(Boolean).join(" ");
        if (from && to) {
            return "من " + from + " إلى " + to;
        }
        return from || to;
    }

    function witnessRow(label, value) {
        return value ? "<tr><th>" + witnessEscape(label) + "</th><td>" + witnessEscape(value) + "</td></tr>" : "";
    }

    var kernelRoles = [
        { role: "when", title: "التاريخ", test: function (label) { return /تاريخ (الاجتماع|الزيارة|السجل|البداية)/.test(label) || label === "التاريخ"; } },
        { role: "followDate", title: "المتابعة", test: function (label) { return label.indexOf("تاريخ") >= 0 && label.indexOf("متابعة") >= 0; } },
        { role: "end", title: "النهاية", test: function (label) { return label.indexOf("تاريخ النهاية") >= 0; } },
        { role: "owner", title: "المسؤول", test: function (label) { return /المسؤول|المنفذ|^المعلم|المشرف الزائر|اسم الطالب/.test(label); } },
        { role: "cause", title: "المضمون", test: function (label) { return /السبب الجذري|ملاحظات/.test(label); } },
        { role: "followNote", title: "المتابعة", test: function (label) { return label === "ملاحظة المتابعة"; } },
        { role: "goal", title: "القرار", test: function (label) { return /هدف التحسين|^الهدف$|إضافة خاصة/.test(label); } },
        { role: "indicator", title: "المؤشر", test: function (label) { return label.indexOf("المؤشر") >= 0; } },
        { role: "resources", title: "الموارد", test: function (label) { return label.indexOf("الموارد") >= 0; } },
        { role: "subject", title: "الموضوع", test: function (label) { return /موضوع|الإجراء|البند|النشاط|^العنوان|نوع الزيارة/.test(label); } },
        { role: "measure", title: "القياس", test: function (label) { return label === "خط الأساس" || label === "المستهدف" || label === "الوحدة"; } }
    ];

    function witnessPeople(scope) {
        var names = [];
        if (!scope || !scope.querySelectorAll) {
            return "";
        }
        scope.querySelectorAll("input[type='checkbox']:checked").forEach(function (input) {
            var card = input.closest("label");
            var name = card && card.querySelector("b");
            var role = card && card.querySelector("small");
            var text = name ? name.textContent.replace(/\s+/g, " ").trim() : "";
            if (!text) {
                return;
            }
            if (role && role.textContent.trim()) {
                text += " (" + role.textContent.replace(/\s+/g, " ").trim() + ")";
            }
            names.push(text);
        });
        return names.join("، ");
    }

    function witnessBind(lines, people) {
        var bound = {};
        var used = {};
        var bindings = [];
        kernelRoles.forEach(function (rule) {
            lines.forEach(function (line) {
                if (used[line.label] || !rule.test(line.label)) {
                    return;
                }
                if (rule.role === "measure") {
                    used[line.label] = rule.role;
                    bindings.push({ role: rule.title, label: line.label, value: line.value });
                    return;
                }
                if (bound[rule.role]) {
                    return;
                }
                bound[rule.role] = line.value;
                used[line.label] = rule.role;
                bindings.push({ role: rule.title, label: line.label, value: line.value });
            });
        });
        if (people) {
            bound.people = people;
            bindings.push({ role: "الحضور", label: "الأسماء المحددة", value: people });
        }
        return {
            bound: bound,
            rest: lines.filter(function (line) { return !used[line.label]; }),
            bindings: bindings
        };
    }

    function witnessFacts(lines, bound) {
        bound = bound || {};
        function pick(role, labels) {
            return bound[role] || witnessValue(lines, labels);
        }
        return {
            owner: pick("owner", ["المسؤول", "المنفذ", "المعلم"]),
            cause: pick("cause", ["السبب الجذري"]),
            goal: pick("goal", ["هدف التحسين", "الهدف"]),
            follow: bound.followNote || witnessValue(lines, ["ملاحظة المتابعة"]),
            followDate: pick("followDate", ["تاريخ المتابعة"]),
            start: pick("when", ["تاريخ البداية"]),
            end: pick("end", ["تاريخ النهاية"]),
            indicator: pick("indicator", ["المؤشر"]),
            resources: pick("resources", ["الموارد"]),
            people: bound.people || "",
            measure: witnessMeasure(lines)
        };
    }

    function witnessPack(scope, control) {
        var lines = witnessLines(scope, control);
        var pack = witnessBind(lines, witnessPeople(scope));
        return { lines: lines, pack: pack, facts: witnessFacts(lines, pack.bound) };
    }

    function kernelEntity(scope) {
        var node = scope && scope.closest ? scope : null;
        var map = [
            ["#improvement-form, .improvement-card", "improvement", "خطة التحسين"],
            ["#council-form, .committee-witness", "council", "سجل المجالس"],
            ["#visit-form", "visit", "سجل الزيارات"],
            ["#roll-form", "roll", "كشف الدوام"],
            ["#absence-form", "absence", "سجل الغياب"],
            ["#behavior-form", "behavior", "سجل السلوك"],
            ["#book-form", "books", "سجل تسليم المقررات"],
            ["#prep-form", "prep", "سجل التحضير"],
            ["#grade-form", "grades", "سجل الدرجات"],
            ["#support-form", "support", "سجل المتابعة"],
            ["#exec-rows", "exec", "الخطة التنفيذية"]
        ];
        var found = null;
        if (node) {
            map.forEach(function (item) {
                if (!found && node.closest(item[0])) {
                    found = { id: item[1], title: item[2] };
                }
            });
        }
        if (found) {
            return found;
        }
        var title = witnessContext(scope);
        return { id: "ctx:" + title, title: title };
    }

    function kernelMemory() {
        try {
            return JSON.parse(localStorage.getItem("board1059.kernelMap") || "null") || {};
        } catch (error) {
            return {};
        }
    }

    function kernelAbsorb(entity, labels) {
        var map = kernelMemory();
        var known = map[entity.id] || [];
        var born = [];
        labels.forEach(function (label) {
            label = String(label || "").replace(/\s+/g, " ").trim();
            if (!label || known.indexOf(label) >= 0 || born.indexOf(label) >= 0) {
                return;
            }
            born.push(label);
            known.push(label);
        });
        if (born.length) {
            map[entity.id] = known.slice(0, 80);
            try {
                localStorage.setItem("board1059.kernelMap", JSON.stringify(map));
            } catch (error) {
                return { known: known, born: born };
            }
        }
        return { known: map[entity.id] || known, born: born };
    }

    function kernelLinks(entity, facts, control) {
        var links = [];
        function add(from, to, because) {
            if (!from || !to) {
                return;
            }
            links.push({ from: from, to: to, because: because });
        }
        var kindText = control ? witnessControlValue(control) : "";
        if (kindText) {
            add(entity.title, kernelKindTitle[witnessKind(kindText)] || "بيان", "الشاهد يحدد قالب الوثيقة");
        }
        if (facts.indicator) {
            add(entity.title, "مؤشر " + facts.indicator, "رمز المؤشر محفوظ في البند");
        }
        if (facts.followDate) {
            add(entity.title, "متابعة " + facts.followDate, "تاريخ المتابعة محفوظ");
        }
        if (facts.owner) {
            add(entity.title, facts.owner, "المسؤول محفوظ في البند");
        }
        if (facts.start) {
            add(entity.title, facts.start, "التاريخ محفوظ في البند");
        }
        var seats = [
            { role: "principal", title: "مدير المدرسة" },
            { role: "vice_teachers", title: "وكيل الشؤون التعليمية" }
        ];
        var haystack = [facts.owner, facts.people].filter(Boolean).join(" ");
        seats.forEach(function (seat) {
            var person = leadershipSeat(seat.role);
            if (person.name && haystack.indexOf(person.name) >= 0) {
                add(seat.title, person.name, "الاسم يطابق المقعد المحفوظ");
            }
        });
        return links;
    }

    function kernelSee(scope, control) {
        var read = witnessPack(scope, control);
        var entity = kernelEntity(scope);
        var labels = read.lines.map(function (line) { return line.label; });
        if (control) {
            labels.push(witnessLabelOf(control));
        }
        var memory = kernelAbsorb(entity, labels);
        return {
            entity: entity,
            read: read,
            born: memory.born,
            known: memory.known,
            links: kernelLinks(entity, read.facts, control)
        };
    }

    function kernelNotice(root) {
        if (!root || root.nodeType !== 1 || (root.closest && root.closest("#improvement-print-host, .witness-editor"))) {
            return;
        }
        var labels = [];
        function take(node) {
            var label = node.getAttribute && node.getAttribute("data-label");
            if (label) {
                labels.push(label);
            }
        }
        take(root);
        if (root.querySelectorAll) {
            root.querySelectorAll("[data-label]").forEach(take);
        }
        if (!labels.length) {
            return;
        }
        var scope = root.closest ? (root.closest("form, .improvement-card, .witness-scope, #register-editor, #exec-rows") || root) : root;
        kernelAbsorb(kernelEntity(scope), labels);
    }

    function witnessKicker(text) {
        return text ? "<p><b>" + witnessEscape(text) + "</b></p>" : "";
    }

    function witnessRest(rest) {
        if (!rest || !rest.length) {
            return "";
        }
        return "<p><b>حقول محفوظة مرتبطة</b></p><table>" + rest.map(function (line) {
            return witnessRow(line.label, line.value);
        }).join("") + "</table>";
    }

    function witnessSection(piece, lines, subject, showHeading, facts, rest) {
        var kind = witnessKind(piece);
        var fact = facts || witnessFacts(lines);
        var head = showHeading ? witnessKicker(piece) : "";
        var duration = [fact.start, fact.end].filter(Boolean).join(" — ");
        var followText = [fact.followDate, fact.follow].filter(Boolean).join(" — ");
        var statement = [subject, fact.goal].filter(Boolean).join(" — ") || piece;
        if (kind === "minutes") {
            var lead = "تم بعون الله وتوفيقه عقد الاجتماع";
            if (subject) {
                lead += " بشأن «" + subject + "»";
            }
            if (fact.start) {
                lead += "، بتاريخ " + fact.start;
            }
            var proceedings = fact.cause
                ? "<p><b>وقائع الاجتماع</b></p><p>وقد تمت مناقشة الآتي:</p><p>" + witnessEscape(fact.cause) + "</p>"
                : "";
            var decisions = fact.goal
                ? "<p><b>القرارات والتوصيات</b></p><p>وقد أسفر الاجتماع عن الآتي:</p><table class=\"improvement-gap\"><thead><tr><th>م</th><th>القرار</th><th>المسؤول عن التنفيذ</th><th>موعد التنفيذ</th></tr></thead><tbody><tr><td>1</td><td>"
                    + witnessEscape(fact.goal) + "</td><td>" + witnessEscape(fact.owner) + "</td><td>" + witnessEscape(fact.end || fact.followDate) + "</td></tr></tbody></table>"
                : "";
            var followBlock = followText ? "<p><b>المتابعة</b></p><p>" + witnessEscape(followText) + "</p>" : "";
            var attendance = fact.people ? "<p><b>الحضور</b></p><p>" + witnessEscape(fact.people) + "</p>" : "";
            var agenda = subject
                ? "<p><b>جدول الأعمال</b></p><ol><li>" + witnessEscape(subject) + "</li></ol>"
                : "";
            return head + "<p>" + witnessEscape(lead + ".") + "</p><table>"
                + witnessRow("موضوع الاجتماع", subject)
                + witnessRow("تاريخ الانعقاد", fact.start)
                + witnessRow("المؤشر", fact.indicator)
                + witnessRow("المسؤول", fact.owner)
                + witnessRow("الموارد", fact.resources)
                + witnessRow("القياس", fact.measure)
                + "</table>" + agenda + attendance + proceedings + decisions + followBlock
                + witnessRest(rest)
                + "<p>حُرر هذا المحضر من البيانات المحفوظة، ويُعتمد بتوقيع من يلي.</p>";
        }
        if (kind === "register" || kind === "roster") {
            var registerLead = kind === "roster"
                ? "يُثبت في هذا الكشف القيد المحفوظ، دون بنود غير مكتوبة."
                : "يُثبت في هذا السجل القيد المحفوظ، دون بنود غير مكتوبة.";
            return head + "<p>" + registerLead + "</p><table class=\"improvement-gap\"><thead><tr><th>م</th><th>التاريخ</th><th>البيان</th><th>المسؤول</th><th>الملاحظات</th></tr></thead><tbody><tr><td>1</td><td>"
                + witnessEscape(fact.start || fact.followDate) + "</td><td>" + witnessEscape(statement) + "</td><td>" + witnessEscape(fact.owner) + "</td><td>" + witnessEscape(fact.follow) + "</td></tr></tbody></table>"
                + (fact.people ? "<p><b>الحضور</b></p><p>" + witnessEscape(fact.people) + "</p>" : "")
                + witnessRest(rest);
        }
        if (kind === "contract") {
            return head + "<p>يُوثَّق هذا العقد من البيانات المحفوظة.</p><table>"
                + witnessRow("موضوع العقد", subject)
                + witnessRow("الطرف الأول", "متوسطة سعد بن الربيع الأنصاري")
                + witnessRow("مدة العقد", duration)
                + witnessRow("الالتزام", fact.goal)
                + witnessRow("المتابع", fact.owner)
                + witnessRow("المتابعة", followText)
                + "</table>" + witnessRest(rest);
        }
        if (kind === "report") {
            var substance = fact.cause || fact.follow || fact.goal;
            var recommendation = fact.goal && substance !== fact.goal ? fact.goal : "";
            return head + "<p>" + witnessEscape(subject ? "تقرير عن «" + subject + "»." : "تقرير من البيانات المحفوظة.") + "</p><table>"
                + witnessRow("التاريخ", fact.start || fact.followDate)
                + witnessRow("الموضوع", subject)
                + witnessRow("المؤشر", fact.indicator)
                + witnessRow("المضمون", substance)
                + witnessRow("القياس", fact.measure)
                + witnessRow("التوصية", recommendation)
                + witnessRow("المسؤول", fact.owner)
                + witnessRow("الحضور", fact.people)
                + "</table>" + witnessRest(rest) + "<p>رُفع هذا التقرير للاعتماد.</p>";
        }
        return head + "<table>"
            + witnessRow("البيان", piece)
            + witnessRow("الموضوع", subject)
            + witnessRow("التاريخ", fact.start)
            + witnessRow("المؤشر", fact.indicator)
            + witnessRow("التفصيل", fact.cause || fact.goal)
            + witnessRow("المسؤول", fact.owner)
            + witnessRow("المتابعة", followText)
            + "</table>" + witnessRest(rest);
    }

    function witnessSubject(scope, lines, bound) {
        var cardTitle = scope.classList && scope.classList.contains("improvement-card")
            ? (scope.querySelector(".wash-section") || {}).textContent || ""
            : "";
        var subject = cardTitle.trim();
        if (!subject && bound && bound.subject) {
            subject = bound.subject;
        }
        if (!subject) {
            subject = witnessValue(lines, ["الإجراء", "البند", "النشاط", "العنوان", "الموضوع", "الطالب", "اسم الطالب"]);
        }
        return subject;
    }

    function witnessBody(scope, control) {
        var read = witnessPack(scope, control);
        var pieces = witnessPieces(witnessControlValue(control));
        var subject = witnessSubject(scope, read.lines, read.pack.bound);
        var title = pieces.length === 1 ? pieces[0] : (subject || "");
        var body = pieces.length
            ? pieces.map(function (piece, index) {
                return witnessSection(piece, read.lines, subject, pieces.length > 1, read.facts, index === pieces.length - 1 ? read.pack.rest : []);
            }).join("")
            : "<p>لم يُكتب نص في حقل الشاهد.</p>";
        return (title ? "<h2>" + witnessEscape(title) + "</h2>" : "") + body;
    }

    function witnessDrafts() {
        try {
            return JSON.parse(localStorage.getItem("board1059.witnessDrafts") || "null") || {};
        } catch (error) {
            return {};
        }
    }

    function witnessDraftId(scope, control) {
        var card = scope.closest ? scope.closest("[data-action-id]") : null;
        var id = card ? card.getAttribute("data-action-id") : "";
        var label = control.getAttribute("name") || control.getAttribute("data-label") || "witness";
        return [witnessContext(scope), id, label, witnessControlValue(control)].join("::");
    }

    function witnessDraftRead(key) {
        var saved = witnessDrafts()[key];
        return saved ? String(saved) : "";
    }

    function witnessDraftWrite(key, html) {
        var all = witnessDrafts();
        if (!html) {
            delete all[key];
        } else {
            all[key] = html;
        }
        try {
            localStorage.setItem("board1059.witnessDrafts", JSON.stringify(all));
        } catch (error) {
            return;
        }
    }

    function witnessClean(html) {
        var holder = document.createElement("div");
        holder.innerHTML = String(html || "");
        holder.querySelectorAll("script, iframe, object, link").forEach(function (node) {
            node.remove();
        });
        holder.querySelectorAll("*").forEach(function (node) {
            Array.prototype.slice.call(node.attributes).forEach(function (attr) {
                if (/^on/i.test(attr.name) || attr.name === "srcdoc") {
                    node.removeAttribute(attr.name);
                }
            });
        });
        return holder.innerHTML.trim();
    }

    function witnessPage(scope, control) {
        var saved = witnessDraftRead(witnessDraftId(scope, control));
        return (saved || witnessBody(scope, control)) + witnessSignTable();
    }

    var witnessEditing = null;

    function ensureWitnessEditor() {
        var box = document.getElementById("witness-editor");
        if (box && !box.querySelector(".witness-gate-advanced")) {
            box.remove();
            box = null;
        }
        if (box) {
            return box;
        }
        box = document.createElement("div");
        box.id = "witness-editor";
        box.className = "witness-editor no-print";
        box.hidden = true;
        box.innerHTML = "<div class=\"witness-editor-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"witness-editor-title\">"
            + "<header><h2 id=\"witness-editor-title\">بوابة المعاينة والطباعة</h2>"
            + "<p id=\"witness-editor-entity\"></p>"
            + "<p id=\"witness-editor-kind\"></p>"
            + "<details class=\"witness-gate-advanced\">"
            + "<summary>تفاصيل الربط (للمراجعة المتقدمة)</summary>"
            + "<ol class=\"document-gate-relations\"></ol>"
            + "<ol class=\"document-gate-links\"></ol>"
            + "<p class=\"witness-gate-help\">الصياغة من الحقول الظاهرة في الروابط. التعديل في الورقة للطباعة وحدها، ولا يغيّر الحقول. ما لا يظهر في الروابط لم يُحفظ.</p>"
            + "</details></header>"
            + "<div class=\"witness-editor-sheet\" contenteditable=\"true\"></div>"
            + "<footer><button type=\"button\" data-witness-act=\"close\">إغلاق</button>"
            + "<button type=\"button\" data-witness-act=\"reset\">إعادة</button>"
            + "<button type=\"button\" data-witness-act=\"save\">حفظ</button>"
            + "<button type=\"button\" data-witness-act=\"print\">طباعة</button></footer></div>";
        document.body.appendChild(box);
        box.addEventListener("click", function (event) {
            if (event.target === box) {
                box.hidden = true;
                return;
            }
            var act = event.target.closest && event.target.closest("[data-witness-act]");
            if (!act || !witnessEditing) {
                return;
            }
            var sheet = box.querySelector(".witness-editor-sheet");
            var key = box.dataset.key || "";
            var action = act.getAttribute("data-witness-act");
            if (action === "close") {
                box.hidden = true;
            } else if (action === "reset") {
                witnessDraftWrite(key, "");
                sheet.innerHTML = witnessBody(witnessEditing.scope, witnessEditing.control);
            } else if (action === "save") {
                witnessDraftWrite(key, witnessClean(sheet.innerHTML));
                box.hidden = true;
            } else if (action === "print") {
                witnessDraftWrite(key, witnessClean(sheet.innerHTML));
                openWitnessPrint(witnessEditing.scope, witnessEditing.control);
            }
        });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !box.hidden) {
                box.hidden = true;
            }
        });
        return box;
    }

    var kernelKindTitle = {
        minutes: "محضر",
        register: "سجل",
        roster: "كشف",
        contract: "عقد",
        report: "تقرير",
        record: "بيان"
    };

    function paintDocumentGate(scope, control) {
        var box = ensureWitnessEditor();
        var seen = kernelSee(scope, control);
        var read = seen.read;
        var kindText = witnessControlValue(control);
        var kind = witnessKind(kindText);
        var entityNode = box.querySelector("#witness-editor-entity");
        var kindNode = box.querySelector("#witness-editor-kind");
        var relations = box.querySelector(".document-gate-relations");
        var links = box.querySelector(".document-gate-links");
        entityNode.textContent = "الكيان: " + seen.entity.title;
        kindNode.textContent = "نوع التصميم: " + (kernelKindTitle[kind] || "بيان") + (kindText ? " — " + kindText : "");
        relations.innerHTML = "";
        links.innerHTML = "";
        seen.links.forEach(function (link) {
            var item = document.createElement("li");
            item.textContent = link.from + " ← " + link.to;
            item.title = link.because;
            relations.appendChild(item);
        });
        seen.born.forEach(function (label) {
            var item = document.createElement("li");
            item.textContent = "انضم إلى الكيان: " + label;
            relations.appendChild(item);
        });
        var rows = read.pack.bindings.concat(read.pack.rest.map(function (line) {
            return { role: "حقل محفوظ", label: line.label, value: line.value };
        }));
        if (!rows.length) {
            var empty = document.createElement("li");
            empty.textContent = "لا حقول محفوظة في هذا الموضع بعد.";
            links.appendChild(empty);
            return;
        }
        rows.forEach(function (row) {
            var item = document.createElement("li");
            var role = document.createElement("b");
            role.textContent = row.role;
            item.appendChild(role);
            item.appendChild(document.createTextNode(" ← " + row.label));
            links.appendChild(item);
        });
    }

    function openWitnessEditor(scope, control) {
        var box = ensureWitnessEditor();
        var key = witnessDraftId(scope, control);
        witnessEditing = { scope: scope, control: control };
        box.dataset.key = key;
        paintDocumentGate(scope, control);
        box.querySelector(".witness-editor-sheet").innerHTML = witnessDraftRead(key) || witnessBody(scope, control);
        box.hidden = false;
    }

    function witnessDecode(value) {
        return String(value || "").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&lt;/g, "<");
    }

    function witnessSheets(scope, control) {
        var saved = witnessDraftRead(witnessDraftId(scope, control));
        if (saved) {
            return [saved];
        }
        var read = witnessPack(scope, control);
        var pieces = witnessPieces(witnessControlValue(control));
        var subject = witnessSubject(scope, read.lines, read.pack.bound);
        if (pieces.length > 1) {
            return pieces.map(function (piece, index) {
                return "<h2>" + witnessEscape(piece) + "</h2>" + witnessSection(piece, read.lines, subject, false, read.facts, index === pieces.length - 1 ? read.pack.rest : []);
            });
        }
        return [witnessBody(scope, control)];
    }

    function softWitnessField(scope, label) {
        if (!scope || !scope.querySelector) {
            return "";
        }
        var node = scope.querySelector("[data-label=\"" + label + "\"]");
        return node ? witnessControlValue(node) : "";
    }

    function softWitnessRecordNo(scope) {
        var explicit = softWitnessField(scope, "رقم السجل");
        if (explicit) {
            return explicit;
        }
        var row = scope && scope.closest ? scope.closest(".soft-follow-row") : null;
        var id = row && row.getAttribute("data-record-id");
        if (id && id !== "0") {
            return "SOFT-" + id;
        }
        var day = row && row.getAttribute("data-day");
        var slot = row && row.getAttribute("data-slot");
        if (day && slot) {
            return "SOFT-" + day + "-" + slot;
        }
        return "";
    }

    function softWitnessMediaItems(scope) {
        var row = scope && scope.closest ? scope.closest(".soft-follow-row") : scope;
        var raw = "";
        if (row && row.getAttribute) {
            raw = row.getAttribute("data-media") || row.getAttribute("data-images") || "";
        }
        if (!raw) {
            raw = softWitnessField(scope, "صور الشاهد");
        }
        if (!raw) {
            return [];
        }
        try {
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed.map(function (item) {
                if (typeof item === "string") {
                    return { kind: "image", url: item, name: "" };
                }
                return item;
            }).filter(function (item) {
                return item && item.url;
            });
        } catch (error) {
            return [];
        }
    }

    function softWitnessMediaTile(item, index) {
        var kind = item.kind || "image";
        var label = item.name || item.url || ("مرفق " + (index + 1));
        if (kind === "image") {
            return "<figure class=\"soft-witness-tile is-image\">"
                + "<span class=\"soft-witness-fit-frame\">"
                + "<img src=\"" + witnessEscape(item.url) + "\" data-soft-src=\"" + witnessEscape(item.url) + "\" alt=\"شاهد " + (index + 1) + "\" data-soft-fit=\"pending\">"
                + "</span></figure>";
        }
        var kindLabel = kind === "video" ? "فيديو" : (kind === "pdf" ? "PDF" : "رابط");
        var icon = kind === "video" ? "▶" : (kind === "pdf" ? "PDF" : "🔗");
        return "<figure class=\"soft-witness-tile is-" + witnessEscape(kind) + "\">"
            + "<span class=\"soft-witness-fit-frame is-file\">"
            + "<span class=\"soft-witness-tile-icon\" aria-hidden=\"true\">" + icon + "</span>"
            + "<span class=\"soft-witness-tile-kind\">" + kindLabel + "</span>"
            + "<span class=\"soft-witness-tile-name\">" + witnessEscape(label) + "</span>"
            + "</span></figure>";
    }

    function softWitnessApplyCssFit(img) {
        img.style.width = "auto";
        img.style.height = "auto";
        img.style.maxWidth = "100%";
        img.style.maxHeight = "100%";
        img.style.objectFit = "contain";
        img.style.objectPosition = "center";
        img.style.display = "block";
    }

    function softWitnessFitOneImage(img) {
        if (!img) {
            return;
        }
        softWitnessApplyCssFit(img);
        img.setAttribute("data-soft-fit", "css");
    }

    function softWitnessFitImages(root) {
        var host = root || document.getElementById("soft-witness-print-host");
        if (!host) {
            return;
        }
        Array.prototype.forEach.call(host.querySelectorAll(".soft-witness-tile.is-image img"), function (img) {
            var source = img.getAttribute("data-soft-src") || img.getAttribute("src") || "";
            if (source && String(img.src || "").indexOf("data:image") === 0) {
                img.src = source;
            }
            softWitnessFitOneImage(img);
        });
    }

    function softWitnessGalleryHtml(items) {
        var list = items || [];
        var countClass = "is-count-" + Math.min(Math.max(list.length || 1, 1), 5);
        var html = "<section class=\"soft-witness-gallery soft-witness-stage " + countClass + "\">";
        if (list.length) {
            html += "<div class=\"soft-witness-gallery-grid\">"
                + list.map(softWitnessMediaTile).join("")
                + "</div>";
        } else {
            html += "<p class=\"soft-witness-stage-empty\">لا مرفقات بصرية — النص والاعتماد كافيان للتوثيق.</p>";
        }
        return html + "</section>";
    }

    function softWitnessIdentityHeader(scope) {
        if (window.OfficialFrameCore && typeof window.OfficialFrameCore.header === "function") {
            return window.OfficialFrameCore.header({ strictIdentity: true });
        }
        return witnessHeader(scope || null, "");
    }

    function softWitnessSignUrl(path) {
        var value = String(path || "").trim();
        if (!value) {
            return "";
        }
        if (value.indexOf("data:") === 0 || value.indexOf("http") === 0 || value.charAt(0) === "/") {
            return value;
        }
        return "/" + value.replace(/^\/+/, "");
    }

    function softWitnessSignPerson(person, roleLabel, roleFile) {
        var id = person && person.id ? person.id : "";
        var name = person && person.name ? person.name : "";
        /* ملفات الهوية غير متوفرة حاليًا — نعتمد ملف الدور الموجود مع احتياطي الهوية */
        var primary = softWitnessSignUrl(roleFile || (id ? "signatures/sig_" + id + ".png" : ""));
        var fallback = id ? softWitnessSignUrl("signatures/sig_" + id + ".png") : "";
        if (fallback && fallback === primary) {
            fallback = "";
        }
        var handler = fallback
            ? "if(this.dataset.fallback){var n=this.dataset.fallback;this.dataset.fallback='';this.src=n;}else{this.style.visibility='hidden';}"
            : "this.style.visibility='hidden';";
        var sig = primary
            ? "<img class=\"soft-witness-sig-img\" src=\"" + witnessEscape(primary) + "\""
                + " data-soft-sig-src=\"" + witnessEscape(primary) + "\""
                + (fallback ? " data-fallback=\"" + witnessEscape(fallback) + "\"" : "")
                + " alt=\"توقيع\" data-soft-sig=\"pending\" onerror=\"" + handler + "\">"
            : "";
        return "<div class=\"soft-witness-sign-person\">"
            + "<p class=\"soft-witness-sign-role\">" + witnessEscape(roleLabel || "") + "</p>"
            + "<div class=\"soft-witness-sig-slot\">" + sig + "</div>"
            + "<span class=\"soft-witness-sign-line\" aria-hidden=\"true\"></span>"
            + (name ? "<b class=\"soft-witness-sign-name\">" + witnessEscape(name) + "</b>" : "<b class=\"soft-witness-sign-name is-empty\">&nbsp;</b>")
            + "</div>";
    }

    function softWitnessEmbedOneImage(img) {
        return new Promise(function (resolve) {
            if (!img) {
                resolve(false);
                return;
            }
            var source = img.getAttribute("data-soft-sig-src") || img.getAttribute("src") || "";
            if (!source) {
                resolve(false);
                return;
            }
            if (String(img.src || "").indexOf("data:image") === 0 && img.naturalWidth) {
                img.setAttribute("data-soft-sig", "done");
                resolve(true);
                return;
            }
            var loader = new Image();
            loader.onload = function () {
                try {
                    var canvas = document.createElement("canvas");
                    canvas.width = Math.max(1, loader.naturalWidth);
                    canvas.height = Math.max(1, loader.naturalHeight);
                    canvas.getContext("2d").drawImage(loader, 0, 0);
                    var dataUrl = canvas.toDataURL("image/png");
                    img.onload = null;
                    img.src = dataUrl;
                    img.setAttribute("data-soft-sig-src", dataUrl);
                    img.setAttribute("data-soft-sig", "done");
                    img.style.visibility = "visible";
                    img.style.display = "block";
                    img.style.maxWidth = "75%";
                    img.style.maxHeight = "11mm";
                    img.style.width = "auto";
                    img.style.height = "auto";
                    img.style.objectFit = "contain";
                    resolve(true);
                } catch (error) {
                    img.src = source;
                    resolve(false);
                }
            };
            loader.onerror = function () {
                var fallback = img.getAttribute("data-fallback") || "";
                if (fallback && fallback !== source) {
                    img.setAttribute("data-soft-sig-src", fallback);
                    img.removeAttribute("data-fallback");
                    softWitnessEmbedOneImage(img).then(resolve);
                    return;
                }
                img.setAttribute("data-soft-sig", "error");
                resolve(false);
            };
            loader.src = source;
        });
    }

    function softWitnessEmbedSignatures(root) {
        var host = root || document.getElementById("soft-witness-print-host");
        if (!host) {
            return Promise.resolve();
        }
        var tasks = Array.prototype.map.call(
            host.querySelectorAll(
                ".soft-witness-sig-img, .soft-witness-center-stamp img, .doc-signoff-block img.sig-image"
            ),
            softWitnessEmbedOneImage
        );
        return Promise.all(tasks);
    }

    function softWitnessFitSignatures(root) {
        softWitnessEmbedSignatures(root);
    }

    function softWitnessSignoffColumns() {
        var reviewer = leadershipSeat("vice_teachers");
        var students = leadershipSeat("students_vice");
        var principal = leadershipSeat("principal");
        return [
            {
                roleTitle: "وكيل الشؤون التعليمية",
                name: reviewer.name || "",
                signature: "signatures/sig_teachers.png",
                signatureFallback: reviewer.id ? ("signatures/sig_" + reviewer.id + ".png") : ""
            },
            {
                roleTitle: "وكيل شؤون الطلاب",
                name: students.name || "",
                signature: "signatures/sig_students.png",
                signatureFallback: students.id ? ("signatures/sig_" + students.id + ".png") : ""
            },
            {
                roleTitle: "مدير المدرسة",
                name: principal.name || "",
                signature: "signatures/sig_manager.png",
                signatureFallback: principal.id ? ("signatures/sig_" + principal.id + ".png") : ""
            }
        ];
    }

    function softWitnessSheetHtml(options) {
        options = options || {};
        var title = options.title || "نموذج متابعة (الاصطفاف والاستراحة والصلاة)";
        var middle = options.middleHtml || "";
        if (window.OfficialFrameCore && typeof window.OfficialFrameCore.page === "function") {
            return window.OfficialFrameCore.page({
                strictIdentity: true,
                title: title,
                bodyHtml: "<div class=\"tpl-landscape-body soft-witness-core-body\">" + middle + "</div>",
                frameClass: "tpl-landscape-official soft-witness-core-frame",
                signoff: true,
                columns: softWitnessSignoffColumns(),
                page: 1,
                total: 1
            });
        }
        var reviewer = leadershipSeat("vice_teachers");
        var principal = leadershipSeat("principal");
        return "<section class=\"soft-witness-sheet\">"
            + "<header class=\"soft-witness-zone soft-witness-header\">"
            + softWitnessIdentityHeader(options.scope || null)
            + "</header>"
            + "<div class=\"soft-witness-zone soft-witness-body\">"
            + "<h1 class=\"soft-witness-title\">" + witnessEscape(title) + "</h1>"
            + middle
            + "</div>"
            + "<footer class=\"soft-witness-zone soft-witness-footer\">"
            + "<div class=\"soft-witness-signs\">"
            + softWitnessSignPerson(reviewer, "وكيل الشؤون التعليمية", "signatures/sig_teachers.png")
            + "<div class=\"soft-witness-center-stamp\" aria-hidden=\"true\">"
            + "<img src=\"/assets/img/official_school_stamp.png\" alt=\"\">"
            + "</div>"
            + softWitnessSignPerson(principal, "مدير المدرسة", "signatures/sig_manager.png")
            + "</div>"
            + "<div class=\"soft-witness-foot-bar\">"
            + "<span class=\"soft-witness-foot-school\">متوسطة سعد بن الربيع الأنصاري</span>"
            + "<span class=\"soft-witness-foot-page\">صفحة 1 من 1</span>"
            + "</div>"
            + "</footer>"
            + "</section>";
    }

    function softWitnessCardHtml(scope, control) {
        var period = softWitnessField(scope, "الفترة") || "الفترة اللاصفية";
        var hijri = softWitnessField(scope, "التاريخ الهجري");
        var gregorian = softWitnessField(scope, "التاريخ الميلادي");
        var status = softWitnessField(scope, "حالة التنفيذ");
        var note = softWitnessField(scope, "ملاحظة");
        var description = control ? witnessControlValue(control) : "";
        var dateLine = hijri && gregorian ? hijri + " الموافق " + gregorian : (hijri || gregorian);
        var images = softWitnessMediaItems(scope);
        var descLine = description || note || "";
        var middle = "<dl class=\"soft-witness-meta is-compact\">"
            + "<div><dt>الفترة</dt><dd>" + witnessEscape(period) + "</dd></div>"
            + "<div><dt>التاريخ</dt><dd>" + witnessEscape(dateLine || "—") + "</dd></div>"
            + "<div><dt>الحالة</dt><dd>" + witnessEscape(status || "—") + "</dd></div>"
            + "</dl>"
            + (descLine ? "<p class=\"soft-witness-desc-line\">" + witnessEscape(descLine) + "</p>" : "")
            + softWitnessGalleryHtml(images);
        return softWitnessSheetHtml({
            scope: scope,
            title: "نموذج متابعة — " + period,
            middleHtml: middle
        });
    }

    function softWitnessTripleCardHtml(dayPayload) {
        var day = dayPayload || {};
        var cols = day.columns || [];
        var meta = "<div class=\"soft-witness-doc-meta\">"
            + "<div><b>الأسبوع</b>" + witnessEscape(day.weekLabel || "—") + "</div>"
            + "<div><b>اليوم</b>" + witnessEscape(day.weekday || "—") + "</div>"
            + "<div><b>التاريخ</b>" + witnessEscape(day.dateDisplay || day.dateLine || "—") + "</div>"
            + "</div>";
        var middle = meta
            + "<div class=\"soft-witness-periods-wrap\">"
            + "<table class=\"soft-witness-periods\">"
            + "<thead><tr>"
            + cols.map(function (col) {
                return "<th>" + witnessEscape(col.title || "") + "</th>";
            }).join("")
            + "</tr></thead><tbody>"
            + "<tr class=\"soft-witness-period-meta\">"
            + cols.map(function (col) {
                return "<td><span>" + witnessEscape(col.status || "—") + "</span></td>";
            }).join("")
            + "</tr>"
            + "<tr class=\"soft-witness-period-media\">"
            + cols.map(function (col) {
                var media = (col.images || []).slice(0, 2);
                return "<td class=\"" + (media.length ? "has-media" : "is-empty") + "\">"
                    + (media.length
                        ? "<div class=\"soft-witness-col-stage\">" + media.map(softWitnessMediaTile).join("") + "</div>"
                        : "<p class=\"soft-witness-stage-empty\">بلا مرفق</p>")
                    + "</td>";
            }).join("")
            + "</tr></tbody></table></div>";
        return softWitnessSheetHtml({
            title: "نموذج متابعة (الاصطفاف والاستراحة والصلاة)",
            middleHtml: middle
        });
    }

    function softWitnessHost() {
        var host = document.getElementById("soft-witness-print-host");
        if (!host) {
            host = document.createElement("div");
            host.id = "soft-witness-print-host";
            host.className = "soft-witness-print-host";
            document.body.appendChild(host);
        }
        return host;
    }

    function softWitnessScalePreview(host) {
        var page = host && (
            host.querySelector(".soft-witness-core-frame")
            || host.querySelector(".soft-witness-sheet")
        );
        var stage = host && host.querySelector(".soft-witness-scale-stage");
        var bar = host && host.querySelector(".soft-witness-preview-bar");
        if (!page || !stage) {
            return;
        }
        page.style.transform = "none";
        page.style.width = "297mm";
        page.style.height = "210mm";
        page.style.maxHeight = "none";
        var availW = Math.max(120, host.clientWidth - 24);
        var availH = Math.max(120, host.clientHeight - ((bar && bar.offsetHeight) || 0) - 20);
        var naturalW = page.offsetWidth || 1;
        var naturalH = page.offsetHeight || 1;
        var scale = Math.min(1, availW / naturalW, availH / naturalH);
        if (!isFinite(scale) || scale <= 0) {
            scale = 1;
        }
        stage.style.height = Math.round(naturalH * scale) + "px";
        stage.style.width = Math.round(naturalW * scale) + "px";
        page.style.transformOrigin = "top center";
        page.style.transform = "scale(" + scale + ")";
        host.setAttribute("data-soft-scale", String(Math.round(scale * 100) / 100));
    }

    function softWitnessShow(hostHtml, previewOnly, previewLabel) {
        var host = softWitnessHost();
        host.innerHTML = previewOnly
            ? "<div class=\"soft-witness-preview-bar no-print\">"
                + "<strong>" + witnessEscape(previewLabel || "معاينة نموذج المتابعة (A4 أفقي)") + "</strong>"
                + "<button type=\"button\" data-soft-witness-act=\"fullscreen\">ملء الشاشة</button>"
                + "<button type=\"button\" data-soft-witness-act=\"print\">طباعة</button>"
                + "<button type=\"button\" data-soft-witness-act=\"close\">إغلاق المعاينة</button>"
                + "</div>"
                + "<div class=\"soft-witness-scale-stage\">" + hostHtml + "</div>"
            : hostHtml;
        var previousTitle = document.title;
        document.title = "";
        function restore() {
            document.title = previousTitle;
            document.body.classList.remove("print-mode", "print-soft-witness", "preview-soft-witness", "preview-soft-witness-full");
            window.removeEventListener("resize", onResize);
            host.innerHTML = "";
            host.onclick = null;
        }
        function onResize() {
            softWitnessScalePreview(host);
        }
        function prepareFit(thenFn, options) {
            options = options || {};
            var force = !!options.force;
            if (force) {
                Array.prototype.forEach.call(host.querySelectorAll("[data-soft-fit]"), function (img) {
                    var src = img.getAttribute("data-soft-src");
                    if (src && String(img.src || "").indexOf("data:image") !== 0) {
                        img.src = src;
                    }
                    if (src && String(img.getAttribute("data-soft-fit") || "") !== "done") {
                        img.setAttribute("data-soft-fit", "pending");
                    }
                });
            }
            softWitnessScalePreview(host);
            softWitnessFitImages(host);
            softWitnessEmbedSignatures(host).then(function () {
                softWitnessScalePreview(host);
                softWitnessFitImages(host);
                if (typeof thenFn === "function") {
                    thenFn();
                }
            });
        }
        function runPrint() {
            softWitnessEmbedSignatures(host).then(function () {
                var bar = host.querySelector(".soft-witness-preview-bar");
                var page = host.querySelector(".soft-witness-core-frame")
                    || host.querySelector(".soft-witness-sheet");
                var stage = host.querySelector(".soft-witness-scale-stage");
                if (bar) {
                    bar.setAttribute("hidden", "hidden");
                }
                if (page) {
                    page.style.transform = "none";
                    page.style.width = "297mm";
                    page.style.height = "210mm";
                    page.style.maxHeight = "none";
                }
                if (stage) {
                    stage.style.width = "297mm";
                    stage.style.height = "210mm";
                }
                document.body.classList.remove("preview-soft-witness-full");
                document.body.classList.add("print-mode", "print-soft-witness", "print-official-core", "print-official-landscape");
                document.body.classList.remove("preview-soft-witness");
                if (window.OfficialFrameCore && typeof window.OfficialFrameCore.armPrintPage === "function") {
                    window.OfficialFrameCore.armPrintPage({ orientation: "landscape" });
                } else {
                    var pageStyle = document.getElementById("soft-witness-page-style");
                    if (!pageStyle) {
                        pageStyle = document.createElement("style");
                        pageStyle.id = "soft-witness-page-style";
                        document.head.appendChild(pageStyle);
                    }
                    pageStyle.textContent = "@page{size:A4 landscape;margin:0;}";
                }
                function restoreSoft() {
                    document.body.classList.remove(
                        "print-mode",
                        "print-soft-witness",
                        "print-official-core",
                        "print-official-landscape"
                    );
                    var armed = document.getElementById("official-core-page-style");
                    if (armed) {
                        armed.remove();
                    }
                    var softStyle = document.getElementById("soft-witness-page-style");
                    if (softStyle && softStyle.parentNode) {
                        softStyle.parentNode.removeChild(softStyle);
                    }
                    if (previewOnly) {
                        if (bar) {
                            bar.removeAttribute("hidden");
                        }
                        document.body.classList.add("preview-soft-witness");
                        softWitnessScalePreview(host);
                    } else {
                        restore();
                    }
                }
                window.setTimeout(function () {
                    if (!window.PrintEngine || typeof window.PrintEngine.gate !== "function") {
                        console.error("PrintEngine غير محمّل.");
                        restoreSoft();
                        return;
                    }
                    var printed = window.PrintEngine.gate(host.innerHTML, {
                        multiPage: false,
                        orientation: "landscape",
                        docTitle: "شاهد المتابعة"
                    });
                    if (printed && typeof printed.finally === "function") {
                        printed.finally(restoreSoft);
                    } else if (printed && typeof printed.then === "function") {
                        printed.then(restoreSoft, restoreSoft);
                    } else {
                        restoreSoft();
                    }
                }, 200);
            });
        }
        if (previewOnly) {
            document.body.classList.add("preview-soft-witness");
            window.addEventListener("resize", onResize);
            prepareFit(null, { force: true });
            host.onclick = function (event) {
                var act = event.target.closest && event.target.closest("[data-soft-witness-act]");
                if (!act) {
                    return;
                }
                var action = act.getAttribute("data-soft-witness-act");
                if (action === "close") {
                    restore();
                } else if (action === "print") {
                    prepareFit(function () {
                        runPrint();
                    }, { force: false });
                } else if (action === "fullscreen") {
                    document.body.classList.toggle("preview-soft-witness-full");
                    act.textContent = document.body.classList.contains("preview-soft-witness-full")
                        ? "تصغير المعاينة"
                        : "ملء الشاشة";
                    softWitnessScalePreview(host);
                }
            };
            return host;
        }
        document.body.classList.add("preview-soft-witness");
        prepareFit(function () {
            runPrint();
        }, { force: true });
        return host;
    }

    function openSoftWitnessCard(scope, control, previewOnly) {
        return softWitnessShow(softWitnessCardHtml(scope, control), previewOnly, "معاينة نموذج المتابعة (صفحة واحدة)");
    }

    function openSoftWitnessTriple(dayPayload, previewOnly) {
        return softWitnessShow(
            softWitnessTripleCardHtml(dayPayload),
            previewOnly !== false,
            "معاينة نموذج متابعة الفترات الثلاث"
        );
    }

    function openWitnessPrint(scope, control) {
        if (scope && scope.closest && scope.closest(".soft-follow-row, .soft-day-row, .soft-periods-board")) {
            openSoftWitnessCard(scope, control, true);
            return;
        }
        var sheets = witnessSheets(scope, control);
        var core = window.OfficialFrameCore;
        if (core && typeof core.page === "function" && typeof core.ensureHost === "function") {
            var frameHost = core.ensureHost();
            frameHost.innerHTML = sheets.map(function (pageHtml, index) {
                var titleNode = pageHtml.match(/^<h2>([^<]*)<\/h2>/);
                var title = titleNode ? witnessDecode(titleNode[1]) : "بطاقة شاهد";
                var body = pageHtml.replace(/^<h2>[^<]*<\/h2>/, "");
                return core.page({
                    strictIdentity: true,
                    title: title,
                    bodyHtml: "<div class=\"improvement-print-body\">" + body + "</div>",
                    page: index + 1,
                    total: sheets.length,
                    signoff: true
                });
            }).join("");
            frameHost.hidden = false;
            var previousTitle = document.title;
            document.title = "";
            document.body.classList.add("print-mode", "print-official-core", "is-print-preview");
            if (typeof core.armPrintPage === "function") {
                core.armPrintPage({ multiPage: sheets.length > 1 });
            }
            function restoreCore() {
                document.title = previousTitle;
                document.body.classList.remove("print-mode", "print-official-core", "print-official-multi");
                if (window.closePrintPreview) {
                    window.closePrintPreview();
                }
                core.hideHost();
            }
            window.setTimeout(function () {
                if (!window.PrintEngine || typeof window.PrintEngine.open !== "function") {
                    console.error("PrintEngine غير محمّل.");
                    restoreCore();
                    return;
                }
                var printed = window.PrintEngine.open("raw-html", {
                    html: frameHost.innerHTML,
                    autoPrint: true,
                    multiPage: sheets.length > 1,
                    orientation: "portrait",
                    docTitle: "بطاقة شاهد"
                });
                if (printed && typeof printed.finally === "function") {
                    printed.finally(restoreCore);
                } else if (printed && typeof printed.then === "function") {
                    printed.then(restoreCore, restoreCore);
                } else {
                    restoreCore();
                }
            }, 80);
            return;
        }
        var host = document.getElementById("improvement-print-host");
        if (!host) {
            host = document.createElement("div");
            host.id = "improvement-print-host";
            host.className = "improvement-print-host improvement-print-sheet";
            document.body.appendChild(host);
        }
        var foot = "<p class=\"improvement-print-foot\">متوسطة سعد بن الربيع الأنصاري</p>";
        host.innerHTML = sheets.map(function (page) {
            var titleNode = page.match(/^<h2>([^<]*)<\/h2>/);
            var title = titleNode ? witnessDecode(titleNode[1]) : "";
            return "<section class=\"improvement-print-page\"><table class=\"print-repeat-frame\"><thead><tr><td>" + witnessHeader(scope, title) + "</td></tr></thead><tbody><tr><td><div class=\"print-repeat-fill\"><div class=\"improvement-print-body\">" + page + "</div><div class=\"improvement-print-end\">" + witnessSignTable() + foot + "</div></div></td></tr></tbody></table></section>";
        }).join("");
        var legacyTitle = document.title;
        document.title = "";
        document.body.classList.add("print-mode", "print-improvement");
        function restore() {
            document.title = legacyTitle;
            document.body.classList.remove("print-mode", "print-improvement");
            host.innerHTML = "";
        }
        window.setTimeout(function () {
            if (!window.PrintEngine || typeof window.PrintEngine.gate !== "function") {
                console.error("PrintEngine غير محمّل.");
                restore();
                return;
            }
            var printed = window.PrintEngine.gate(host.innerHTML, {
                multiPage: true,
                orientation: "portrait",
                docTitle: "بطاقة شاهد"
            });
            if (printed && typeof printed.finally === "function") {
                printed.finally(restore);
            } else if (printed && typeof printed.then === "function") {
                printed.then(restore, restore);
            } else {
                restore();
            }
        }, 80);
    }

    function mountDocumentWitness(scope, kind) {
        if (!scope || scope.querySelector(".evidence-print, [data-label='الشاهد'], [data-label='الشواهد'], [data-label='نوع الشاهد'], [name='evidence']")) {
            return;
        }
        var field = document.createElement("label");
        field.className = "wash-field is-wide evidence-field";
        field.innerHTML = "<span>الشاهد</span><span class=\"evidence-tools\"><input data-label=\"الشاهد\" name=\"witnessKind\" type=\"text\" autocomplete=\"off\" value=\""
            + witnessEscape(kind) + "\"><button class=\"evidence-edit no-print\" type=\"button\">تحرير / معاينة</button><button class=\"evidence-print no-print\" type=\"button\">توليد وطباعة</button></span>";
        var actions = scope.querySelector(".wash-actions");
        if (actions && actions.parentElement) {
            actions.parentElement.insertBefore(field, actions);
        } else {
            scope.appendChild(field);
        }
    }

    window.mountDocumentWitness = mountDocumentWitness;

    function placeWitnessButton(control) {
        if (!control || control.type === "hidden" || control.disabled || control.readOnly) {
            return;
        }
        if (control.closest(".improvement-card, #improvement-print-host, .improvement-print-sheet, .witness-editor, .soft-evidence-media")) {
            return;
        }
        var host = control.closest(".evidence-cell") || control.closest("td") || control.closest("label") || control.parentElement;
        if (!host) {
            return;
        }
        var tools = control.closest(".evidence-tools");
        if (!tools) {
            tools = document.createElement("span");
            tools.className = "evidence-tools";
            control.parentElement.insertBefore(tools, control);
            tools.appendChild(control);
        }
        if (tools.querySelector(".evidence-edit") && tools.querySelector(".evidence-print")) {
            return;
        }
        if (host.querySelector(".evidence-edit") && host.querySelector(".evidence-print")) {
            return;
        }
        var edit = tools.querySelector(".evidence-edit");
        var print = tools.querySelector(".evidence-print");
        if (!edit) {
            edit = document.createElement("button");
            edit.type = "button";
            edit.className = "evidence-edit no-print";
            edit.textContent = "تحرير / معاينة";
        }
        if (!print) {
            print = document.createElement("button");
            print.type = "button";
            print.className = "evidence-print no-print";
            print.textContent = "توليد وطباعة";
        }
        tools.appendChild(edit);
        tools.appendChild(print);
    }

    function scanWitnessControls(root) {
        if (!root || root.nodeType !== 1 || (root.closest && root.closest("#improvement-print-host"))) {
            return;
        }
        var found = [];
        if (isWitnessControl(root)) {
            found.push(root);
        }
        if (root.querySelectorAll) {
            root.querySelectorAll("[data-label], [name='evidence']").forEach(function (node) {
                if (isWitnessControl(node)) {
                    found.push(node);
                }
            });
        }
        found.forEach(placeWitnessButton);
        kernelNotice(root);
    }

    document.addEventListener("click", function (event) {
        var edit = event.target.closest && event.target.closest(".evidence-edit");
        var print = !edit && event.target.closest && event.target.closest(".evidence-print");
        var button = edit || print;
        if (!button) {
            return;
        }
        // سجل المجالس: المحضر الرسمي الثلاثي فقط (لا مسار الشاهد القديم)
        if (button.closest("#council-form, #council-sheet, .council-official-book")) {
            event.preventDefault();
            event.stopPropagation();
            var previewCouncil = document.querySelector("#council-form ~ .wash-actions .wash-print, #council-form .wash-print");
            var councilPreview = Array.prototype.find.call(document.querySelectorAll("#council-form button.wash-print, .erp-pane.is-board button.wash-print"), function (node) {
                return /معاينة المحضر|طباعة المحضر/.test(node.textContent || "");
            });
            if (councilPreview) {
                councilPreview.click();
            }
            return;
        }
        event.preventDefault();
        var control = witnessControlNear(button);
        var scope = witnessScope(button);
        if (!control || !scope) {
            return;
        }
        if (edit) {
            if (scope.closest && scope.closest(".soft-follow-row")) {
                openSoftWitnessCard(scope, control, true);
            } else {
                openWitnessEditor(scope, control);
            }
        } else {
            openWitnessPrint(scope, control);
        }
    });
    scanWitnessControls(document.body);
    if (window.MutationObserver) {
        var witnessObserver = new MutationObserver(function (records) {
            records.forEach(function (record) {
                Array.prototype.forEach.call(record.addedNodes, function (node) {
                    scanWitnessControls(node);
                });
            });
        });
        witnessObserver.observe(document.body, { childList: true, subtree: true });
    }

    window.board1059Kernel = {
        read: witnessPack,
        see: kernelSee,
        preview: openWitnessEditor,
        print: openWitnessPrint,
        softCard: openSoftWitnessCard,
        softCardHtml: softWitnessCardHtml,
        softTriple: openSoftWitnessTriple,
        map: kernelMemory
    };

    /**
     * مكوّن الشاهد البصري الموحّد — للمهام والبرامج والمحاضر والفعاليات واللاصفية.
     * الآلية: زر إرفاق + رفع ملف + كاميرا + رابط + سحب وإفلات على المعرض.
     */
    window.board1059VisualEvidence = {
        maxImages: 5,
        accept: "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf",
        parseItems: function (raw) {
            if (!raw) {
                return [];
            }
            if (Array.isArray(raw)) {
                return raw.map(function (item) {
                    if (typeof item === "string") {
                        return { kind: "image", url: item, name: "" };
                    }
                    return item;
                }).filter(function (item) {
                    return item && item.url;
                });
            }
            if (raw && Array.isArray(raw.items)) {
                return window.board1059VisualEvidence.parseItems(raw.items);
            }
            var text = String(raw || "").trim();
            if (!text) {
                return [];
            }
            try {
                return window.board1059VisualEvidence.parseItems(JSON.parse(text));
            } catch (error) {
                return [];
            }
        },
        galleryHtml: function (items, removable) {
            var list = window.board1059VisualEvidence.parseItems(items);
            if (!list.length) {
                return "<p class=\"ve-empty\">أسقط الصور هنا أو استخدم الأزرار أدناه — حتى 5 صور.</p>";
            }
            return "<div class=\"ve-gallery\">" + list.map(function (item) {
                var id = item.id != null ? String(item.id) : "";
                if (item.kind === "image") {
                    return "<figure class=\"ve-thumb\" data-ve-id=\"" + witnessEscape(id) + "\">"
                        + "<img src=\"" + witnessEscape(item.url) + "\" alt=\"" + witnessEscape(item.name || "شاهد") + "\">"
                        + (removable && id ? "<button type=\"button\" class=\"ve-remove\" data-ve-remove=\"" + witnessEscape(id) + "\" title=\"حذف\">×</button>" : "")
                        + "</figure>";
                }
                var kindLabel = item.kind === "video" ? "فيديو" : (item.kind === "pdf" ? "PDF" : "رابط");
                var icon = item.kind === "video" ? "▶" : (item.kind === "pdf" ? "PDF" : "🔗");
                return "<figure class=\"ve-thumb ve-file-thumb is-" + witnessEscape(item.kind || "link") + "\" data-ve-id=\"" + witnessEscape(id) + "\">"
                    + "<a href=\"" + witnessEscape(item.url) + "\" target=\"_blank\" rel=\"noopener\">"
                    + "<span class=\"ve-file-icon\">" + icon + "</span>"
                    + "<span class=\"ve-file-kind\">" + kindLabel + "</span>"
                    + "<span class=\"ve-file-name\">" + witnessEscape(item.name || item.url) + "</span>"
                    + "</a>"
                    + (removable && id ? "<button type=\"button\" class=\"ve-remove\" data-ve-remove=\"" + witnessEscape(id) + "\" title=\"حذف\">×</button>" : "")
                    + "</figure>";
            }).join("") + "</div>";
        },
        panelHtml: function (options) {
            options = options || {};
            var programId = options.programId || options.entityId || "";
            return "<div class=\"ve-root no-print\" data-ve-root"
                + " data-entity-type=\"" + witnessEscape(options.entityType || "") + "\""
                + " data-entity-key=\"" + witnessEscape(options.entityKey || "") + "\""
                + (programId ? " data-program-id=\"" + witnessEscape(String(programId)) + "\"" : "")
                + " data-register-key=\"" + witnessEscape(options.registerKey || "") + "\">"
                + "<div class=\"ve-drop\" data-ve-drop tabindex=\"0\">"
                + window.board1059VisualEvidence.galleryHtml(options.items || [], true)
                + "</div>"
                + "<div class=\"ve-tools\">"
                + "<button type=\"button\" class=\"ve-btn\" data-ve-act=\"upload\">رفع ملف</button>"
                + "<button type=\"button\" class=\"ve-btn is-camera\" data-ve-act=\"camera\">كاميرا</button>"
                + "<button type=\"button\" class=\"ve-btn is-link\" data-ve-act=\"link\">رابط</button>"
                + "<input type=\"file\" accept=\"" + window.board1059VisualEvidence.accept + "\" multiple hidden data-ve-file>"
                + "<input type=\"file\" accept=\"image/*\" capture=\"environment\" hidden data-ve-camera>"
                + "</div>"
                + "<div class=\"ve-link-row\" hidden>"
                + "<input type=\"url\" data-ve-link-url placeholder=\"https://...\" autocomplete=\"off\">"
                + "<input type=\"text\" data-ve-link-name placeholder=\"اسم الرابط (اختياري)\" autocomplete=\"off\">"
                + "<button type=\"button\" class=\"ve-btn\" data-ve-act=\"save-link\">حفظ الرابط</button>"
                + "</div>"
                + "</div>";
        },
        openCamera: function (onCapture, onFallback) {
            var media = navigator.mediaDevices;
            if (!media || !media.getUserMedia) {
                if (typeof onFallback === "function") {
                    onFallback();
                }
                return;
            }
            var existing = document.getElementById("ve-camera-modal");
            if (existing) {
                existing.remove();
            }
            var box = document.createElement("div");
            box.id = "ve-camera-modal";
            box.className = "ve-camera-modal no-print";
            box.innerHTML = "<div class=\"ve-camera-card\" role=\"dialog\" aria-modal=\"true\" aria-label=\"التقاط شاهد بالكاميرا\">"
                + "<header><strong>التقاط شاهد بالكاميرا</strong>"
                + "<button type=\"button\" data-ve-cam=\"close\">إغلاق</button></header>"
                + "<video autoplay playsinline></video>"
                + "<p class=\"ve-camera-note\">اسمح للمتصفح بالكاميرا إن طُلب منك ذلك.</p>"
                + "<footer>"
                + "<button type=\"button\" class=\"ve-btn is-camera\" data-ve-cam=\"shot\">التقاط</button>"
                + "<button type=\"button\" class=\"ve-btn\" data-ve-cam=\"fallback\">اختيار من الجهاز</button>"
                + "</footer></div>";
            document.body.appendChild(box);
            var video = box.querySelector("video");
            var stream = null;
            function stop() {
                if (stream) {
                    stream.getTracks().forEach(function (track) {
                        track.stop();
                    });
                    stream = null;
                }
                box.remove();
            }
            media.getUserMedia({
                video: { facingMode: { ideal: "environment" } },
                audio: false
            }).then(function (active) {
                stream = active;
                video.srcObject = active;
            }).catch(function () {
                stop();
                if (typeof onFallback === "function") {
                    onFallback();
                }
            });
            box.addEventListener("click", function (event) {
                if (event.target === box) {
                    stop();
                    return;
                }
                var act = event.target.closest && event.target.closest("[data-ve-cam]");
                if (!act) {
                    return;
                }
                var kind = act.getAttribute("data-ve-cam");
                if (kind === "close") {
                    stop();
                    return;
                }
                if (kind === "fallback") {
                    stop();
                    if (typeof onFallback === "function") {
                        onFallback();
                    }
                    return;
                }
                if (kind === "shot") {
                    var canvas = document.createElement("canvas");
                    var width = video.videoWidth || 1280;
                    var height = video.videoHeight || 720;
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext("2d").drawImage(video, 0, 0, width, height);
                    canvas.toBlob(function (blob) {
                        stop();
                        if (blob && typeof onCapture === "function") {
                            onCapture(blob, "camera-" + Date.now() + ".jpg");
                        } else if (typeof onFallback === "function") {
                            onFallback();
                        }
                    }, "image/jpeg", 0.92);
                }
            });
        }
    };

    // توافق خلفي مع الاسم السابق.
    window.board1059Media = {
        maxSoft: 5,
        accept: window.board1059VisualEvidence.accept,
        parsePaths: function (raw) {
            return window.board1059VisualEvidence.parseItems(raw).filter(function (item) {
                return item.kind === "image";
            }).map(function (item) {
                return item.url;
            });
        },
        galleryHtml: function (paths, removable) {
            var items = window.board1059VisualEvidence.parseItems(paths);
            return window.board1059VisualEvidence.galleryHtml(items, removable);
        },
        toolsHtml: function () {
            return "";
        }
    };

    /**
     * ربط عام لأزرار الشاهد البصري خارج شاشة اللاصفية
     * (المحاضر / أي لوحة فيها data-ve-root).
     */
    (function bindGlobalVisualEvidence() {
        if (window.__veGlobalBound) {
            return;
        }
        window.__veGlobalBound = true;

        function veAuthHeaders() {
            if (window.board1059Access && typeof window.board1059Access.headers === "function") {
                var auth = window.board1059Access.headers() || {};
                var out = {};
                Object.keys(auth).forEach(function (key) {
                    if (String(key).toLowerCase() !== "content-type") {
                        out[key] = auth[key];
                    }
                });
                return out;
            }
            return {};
        }

        function veJsonHeaders() {
            var headers = veAuthHeaders();
            headers["Content-Type"] = "application/json";
            return headers;
        }

        function refreshVeRoot(root, items) {
            if (!root) {
                return;
            }
            var drop = root.querySelector("[data-ve-drop]");
            if (drop && window.board1059VisualEvidence) {
                drop.innerHTML = window.board1059VisualEvidence.galleryHtml(items || [], true);
            }
            var host = root.closest("#council-evidence-host, #program-evidence-host");
            var pane = host && host.closest(".erp-pane");
            if (pane && host && host.id === "council-evidence-host" && typeof pane._onCouncilEvidenceChanged === "function") {
                pane._onCouncilEvidenceChanged(items || []);
            }
            if (pane && host && host.id === "program-evidence-host" && typeof pane._onProgramEvidenceChanged === "function") {
                pane._onProgramEvidenceChanged(items || []);
            }
            window.dispatchEvent(new CustomEvent("dataChanged", {
                detail: { source: "visual-evidence", entityType: root.getAttribute("data-entity-type") || "" }
            }));
        }

        function veEntityPrefix(entityType) {
            if (entityType === "program") {
                return "program-";
            }
            if (entityType === "council_minutes") {
                return "council-";
            }
            return String(entityType || "entity") + "-";
        }

        function uploadFromRoot(root, fileList) {
            if (!root || !fileList || !fileList.length) {
                return;
            }
            var entityType = root.getAttribute("data-entity-type") || "council_minutes";
            var key = String(root.getAttribute("data-entity-key") || "").trim();
            if (!key || key === "draft") {
                key = veEntityPrefix(entityType) + String(Date.now());
                root.setAttribute("data-entity-key", key);
            }
            var form = new FormData();
            form.append("entity_type", entityType);
            form.append("entity_key", key);
            form.append("register_key", root.getAttribute("data-register-key") || "councils");
            Array.prototype.forEach.call(fileList, function (file) {
                form.append("files", file, file.name || "capture.jpg");
            });
            fetch("/api/visual-evidence", {
                method: "POST",
                headers: veAuthHeaders(),
                body: form
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error((payload && payload.detail) || "تعذر رفع المرفق");
                    }
                    return payload;
                });
            }).then(function (payload) {
                refreshVeRoot(root, (payload && payload.items) || []);
            }).catch(function (error) {
                window.alert(error.message || "تعذر رفع المرفق.");
            });
        }

        function saveLinkFromRoot(root) {
            var urlInput = root.querySelector("[data-ve-link-url]");
            var nameInput = root.querySelector("[data-ve-link-name]");
            var entityType = root.getAttribute("data-entity-type") || "council_minutes";
            var key = String(root.getAttribute("data-entity-key") || "").trim()
                || (veEntityPrefix(entityType) + String(Date.now()));
            root.setAttribute("data-entity-key", key);
            var form = new FormData();
            form.append("entity_type", entityType);
            form.append("entity_key", key);
            form.append("register_key", root.getAttribute("data-register-key") || "councils");
            form.append("link_url", urlInput ? urlInput.value.trim() : "");
            form.append("link_name", nameInput ? nameInput.value.trim() : "");
            fetch("/api/visual-evidence", {
                method: "POST",
                headers: veAuthHeaders(),
                body: form
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error((payload && payload.detail) || "تعذر حفظ الرابط");
                    }
                    return payload;
                });
            }).then(function (payload) {
                refreshVeRoot(root, (payload && payload.items) || []);
                var row = root.querySelector(".ve-link-row");
                if (row) {
                    row.hidden = true;
                }
            }).catch(function (error) {
                window.alert(error.message || "تعذر حفظ الرابط.");
            });
        }

        document.addEventListener("click", function (event) {
            var veAct = event.target.closest ? event.target.closest("[data-ve-act]") : null;
            if (!veAct) {
                var removeBtn = event.target.closest ? event.target.closest("[data-ve-remove]") : null;
                if (!removeBtn) {
                    return;
                }
                // لا تسرق أحداث اللاصفية التي لها مستمع خاص
                if (removeBtn.closest("#soft-follow-host")) {
                    return;
                }
                event.preventDefault();
                var rmRoot = removeBtn.closest("[data-ve-root]");
                fetch("/api/visual-evidence/delete", {
                    method: "POST",
                    headers: veJsonHeaders(),
                    body: JSON.stringify({ id: Number(removeBtn.getAttribute("data-ve-remove") || 0) })
                }).then(function (response) {
                    return response.json().then(function (payload) {
                        if (!response.ok) {
                            throw new Error((payload && payload.detail) || "تعذر الحذف");
                        }
                        return payload;
                    });
                }).then(function (payload) {
                    refreshVeRoot(rmRoot, (payload && payload.items) || []);
                }).catch(function (error) {
                    window.alert(error.message || "تعذر الحذف.");
                });
                return;
            }
            if (veAct.closest("#soft-follow-host")) {
                return;
            }
            var veRoot = veAct.closest("[data-ve-root]");
            if (!veRoot) {
                return;
            }
            event.preventDefault();
            var act = veAct.getAttribute("data-ve-act");
            if (act === "upload") {
                var filePicker = veRoot.querySelector("[data-ve-file]");
                if (filePicker) {
                    filePicker.click();
                }
                return;
            }
            if (act === "camera") {
                var camFallback = function () {
                    var camPicker = veRoot.querySelector("[data-ve-camera]");
                    if (camPicker) {
                        camPicker.click();
                    }
                };
                if (window.board1059VisualEvidence && window.board1059VisualEvidence.openCamera) {
                    window.board1059VisualEvidence.openCamera(function (blob, filename) {
                        var file = new File([blob], filename || "camera.jpg", { type: blob.type || "image/jpeg" });
                        uploadFromRoot(veRoot, [file]);
                    }, camFallback);
                } else {
                    camFallback();
                }
                return;
            }
            if (act === "link") {
                var linkRow = veRoot.querySelector(".ve-link-row");
                if (linkRow) {
                    linkRow.hidden = !linkRow.hidden;
                }
                return;
            }
            if (act === "save-link") {
                saveLinkFromRoot(veRoot);
            }
        });

        document.addEventListener("change", function (event) {
            var input = event.target.closest ? event.target.closest("[data-ve-file], [data-ve-camera]") : null;
            if (!input || !input.files || !input.files.length) {
                return;
            }
            if (input.closest("#soft-follow-host")) {
                return;
            }
            var root = input.closest("[data-ve-root]");
            uploadFromRoot(root, input.files);
            input.value = "";
        });

        document.addEventListener("dragover", function (event) {
            if (!event.target.closest || !event.target.closest("[data-ve-drop]")) {
                return;
            }
            if (event.target.closest("#soft-follow-host")) {
                return;
            }
            event.preventDefault();
            event.target.closest("[data-ve-drop]").classList.add("is-drag");
        });
        document.addEventListener("drop", function (event) {
            var drop = event.target.closest ? event.target.closest("[data-ve-drop]") : null;
            if (!drop || drop.closest("#soft-follow-host")) {
                return;
            }
            event.preventDefault();
            drop.classList.remove("is-drag");
            uploadFromRoot(drop.closest("[data-ve-root]"), event.dataTransfer && event.dataTransfer.files);
        });
    }());

    function openErpBoardByName(boardName) {
        var name = String(boardName || "").replace(/^board:/, "").trim();
        if (!name) {
            return false;
        }
        var link = document.querySelector("[data-erp-board=\"" + name + "\"]");
        if (!link && name === "indicators") {
            link = document.querySelector("[data-erp-board=\"indicators-etec\"]")
                || document.querySelector("[data-erp-board=\"indicators\"]");
        }
        if (link) {
            showPane(link);
            return true;
        }
        var fake = document.createElement("a");
        fake.setAttribute("data-erp-board", name);
        fake.setAttribute("data-erp-label", name);
        fake.setAttribute("data-erp-group", "غرفة القيادة");
        showPane(fake);
        return true;
    }

    function severityClass(value) {
        if (value === "عالية") {
            return "is-high";
        }
        if (value === "متوسطة") {
            return "is-medium";
        }
        return "is-low";
    }

    function isCommandLeadership() {
        var user = null;
        try {
            user = JSON.parse(sessionStorage.getItem("sessionUser") || "null");
        } catch (error) {
            user = null;
        }
        var role = String((user && user.role) || "");
        return (
            role.indexOf("مدير") === 0 ||
            role.indexOf("وكيل") === 0 ||
            role.indexOf("مسؤول النظام") === 0
        );
    }

    function syncCommandRoomFab(count) {
        var fab = document.getElementById("command-room-fab");
        var badge = document.getElementById("command-room-fab-count");
        var panel = document.getElementById("command-attention");
        if (!fab) {
            return;
        }
        if (!isCommandLeadership()) {
            fab.hidden = true;
            if (panel) {
                panel.hidden = true;
                fab.setAttribute("aria-expanded", "false");
            }
            return;
        }
        fab.hidden = false;
        if (badge) {
            var n = Number(count) || 0;
            badge.textContent = String(n);
            badge.hidden = n < 1;
        }
    }

    function setCommandRoomOpen(open) {
        var fab = document.getElementById("command-room-fab");
        var panel = document.getElementById("command-attention");
        if (!panel || !fab || !isCommandLeadership()) {
            return;
        }
        panel.hidden = !open;
        fab.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function renderCommandAttention(payload, host) {
        var root = host || document.getElementById("command-attention");
        var list = document.getElementById("command-attention-list");
        var empty = document.getElementById("command-attention-empty");
        if (!root || !list) {
            return;
        }
        if (!isCommandLeadership()) {
            syncCommandRoomFab(0);
            root.hidden = true;
            return;
        }
        var signals = (payload && payload.signals) || [];
        syncCommandRoomFab(signals.length);
        var waiting = Number((payload && payload.deferred_waiting) || 0);
        var emptyText = waiting > 0
            ? ("لا توجد إشارات حالياً. جميع المهام محدثة. (" + waiting + " مؤجلة ليوم لاحق)")
            : "لا توجد إشارات حالياً. جميع المهام محدثة.";
        if (empty) {
            empty.textContent = emptyText;
        }
        if (!signals.length) {
            list.innerHTML = "";
            if (empty) {
                empty.hidden = false;
            }
            return;
        }
        if (empty) {
            empty.hidden = true;
        }
        list.innerHTML = signals.map(function (item) {
            return "<article class=\"command-card " + severityClass(item.severity) + "\" data-signal-id=\"" + String(item.id || "") + "\">"
                + "<div class=\"command-card__meta\">"
                + "<span class=\"command-card__chip\">" + escapeHtml(item.signal_type || "") + "</span>"
                + "<span class=\"command-card__chip is-sev\">" + escapeHtml(item.severity || "") + "</span>"
                + (item.returned_from_defer ? "<span class=\"command-card__chip\">عادت بعد التأجيل</span>" : "")
                + "</div>"
                + "<p class=\"command-card__title\">" + escapeHtml(item.message || "") + "</p>"
                + ((item.why || item.recommendation)
                    ? "<details class=\"command-why-more\"><summary>لماذا؟</summary>"
                      + "<p class=\"command-card__why\">" + escapeHtml(item.why || item.recommendation || "") + "</p></details>"
                    : "")
                + "<div class=\"command-card__actions\">"
                + "<button type=\"button\" data-command-open=\"" + escapeHtml(item.action_url || "") + "\">"
                + escapeHtml(item.action_label || "فتح") + "</button>"
                + "<button type=\"button\" data-command-act=\"accept\">قبِل</button>"
                + "<button type=\"button\" data-command-act=\"defer\">أجّل</button>"
                + "<button type=\"button\" data-command-act=\"dismiss\">تجاهل</button>"
                + "</div></article>";
        }).join("");
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function loadCommandAttention() {
        return fetch("/api/command-room/today?refresh=1")
            .then(function (response) {
                return response.json();
            })
            .then(function (payload) {
                renderCommandAttention(payload);
                return payload;
            })
            .catch(function () {
                renderCommandAttention({ signals: [] });
            });
    }

    function renderCommandAttentionPayload(payload) {
        renderCommandAttention(payload);
        var boardList = document.getElementById("command-attention-list-board");
        var boardEmpty = document.getElementById("command-attention-empty-board");
        if (!boardList) {
            return;
        }
        var signals = (payload && payload.signals) || [];
        var waitingBoard = Number((payload && payload.deferred_waiting) || 0);
        if (boardEmpty) {
            boardEmpty.textContent = waitingBoard > 0
                ? ("لا توجد إشارات حالياً. جميع المهام محدثة. (" + waitingBoard + " مؤجلة ليوم لاحق)")
                : "لا توجد إشارات حالياً. جميع المهام محدثة.";
        }
        if (!signals.length) {
            boardList.innerHTML = "";
            if (boardEmpty) {
                boardEmpty.hidden = false;
            }
            return;
        }
        if (boardEmpty) {
            boardEmpty.hidden = true;
        }
        boardList.innerHTML = signals.map(function (item) {
            return "<article class=\"command-card " + severityClass(item.severity) + "\" data-signal-id=\"" + String(item.id || "") + "\">"
                + "<div class=\"command-card__meta\">"
                + "<span class=\"command-card__chip\">" + escapeHtml(item.signal_type || "") + "</span>"
                + "<span class=\"command-card__chip is-sev\">" + escapeHtml(item.severity || "") + "</span>"
                + (item.returned_from_defer ? "<span class=\"command-card__chip\">عادت بعد التأجيل</span>" : "")
                + "</div>"
                + "<p class=\"command-card__title\">" + escapeHtml(item.message || "") + "</p>"
                + (item.why
                    ? "<details class=\"command-why-more\"><summary>لماذا؟</summary>"
                      + "<p class=\"command-card__why\">" + escapeHtml(item.why) + "</p></details>"
                    : "")
                + "<div class=\"command-card__actions\">"
                + "<button type=\"button\" data-command-open=\"" + escapeHtml(item.action_url || "") + "\">"
                + escapeHtml(item.action_label || "فتح") + "</button>"
                + "<button type=\"button\" data-command-act=\"accept\">قبِل</button>"
                + "<button type=\"button\" data-command-act=\"defer\">أجّل</button>"
                + "<button type=\"button\" data-command-act=\"dismiss\">تجاهل</button>"
                + "</div></article>";
        }).join("");
    }

    function postCommandAction(signalId, action) {
        return fetch("/api/command-room/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signal_id: Number(signalId), action: action, defer_days: 1 })
        }).then(function (response) {
            return response.json();
        }).then(function (payload) {
            renderCommandAttentionPayload(payload);
            return payload;
        });
    }

    document.addEventListener("click", function (event) {
        var fab = event.target.closest ? event.target.closest("#command-room-fab") : null;
        if (fab) {
            var panel = document.getElementById("command-attention");
            setCommandRoomOpen(panel ? panel.hidden : true);
            if (panel && !panel.hidden) {
                loadCommandAttention();
            }
            return;
        }
        if (event.target.closest && event.target.closest("#command-room-close")) {
            setCommandRoomOpen(false);
            return;
        }
        var refresh = event.target.closest ? event.target.closest("[data-command-refresh]") : null;
        if (refresh) {
            loadCommandAttention();
            return;
        }
        var openBtn = event.target.closest ? event.target.closest("[data-command-open]") : null;
        if (openBtn) {
            openErpBoardByName(openBtn.getAttribute("data-command-open") || "");
            return;
        }
        var actBtn = event.target.closest ? event.target.closest("[data-command-act]") : null;
        if (!actBtn) {
            return;
        }
        var card = actBtn.closest(".command-card");
        if (!card) {
            return;
        }
        var action = actBtn.getAttribute("data-command-act");
        var openTarget = "";
        if (action === "accept") {
            var go = card.querySelector("[data-command-open]");
            openTarget = go ? (go.getAttribute("data-command-open") || "") : "";
        }
        postCommandAction(card.getAttribute("data-signal-id"), action).then(function () {
            if (action === "accept" && openTarget) {
                openErpBoardByName(openTarget);
            }
        });
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            setCommandRoomOpen(false);
        }
    });

    window.addEventListener("dataChanged", function () {
        if (document.getElementById("command-attention") || document.getElementById("command-attention-board")) {
            loadCommandAttention();
        }
    });

    loadFacilityBank(null);

    if (document.getElementById("command-attention") || document.getElementById("command-room-fab")) {
        if (isCommandLeadership()) {
            loadCommandAttention();
        } else {
            syncCommandRoomFab(0);
        }
    }

    window.erp1059 = {
        washMarkup: washMarkup,
        actionsHtml: actionsHtml,
        readStore: readStore,
        todayIso: todayIso,
        staffDirectory: staffDirectory,
        returnToWelcome: returnToWelcome,
        openBoard: showPane,
        openErpBoardByName: openErpBoardByName,
        loadCommandAttention: loadCommandAttention
    };
})();
