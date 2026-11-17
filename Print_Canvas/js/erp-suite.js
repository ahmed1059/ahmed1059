(function () {
    var api = window.erp1059;
    if (!api) {
        return;
    }

    var SUBJECTS = ["لغتي الخالدة", "الرياضيات", "العلوم", "اللغة الإنجليزية", "الدراسات الإسلامية", "الاجتماعيات", "المهارات الرقمية", "التربية الفنية", "التربية البدنية", "المهارات الحياتية"];
    var PERIODS = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة"];
    var FORMATIONS = [
        { id: "admin", label: "اللجنة الإدارية" },
        { id: "guidance", label: "لجنة التوجيه والإرشاد" },
        { id: "achievement", label: "لجنة التحصيل الدراسي" },
        { id: "excellence", label: "لجنة التميز" },
        { id: "activity", label: "لجنة النشاط والمناسبات" },
        { id: "discipline", label: "لجنة الانضباط والتدخل السريع" },
        { id: "fund", label: "فريق الصندوق المدرسي" },
        { id: "safety", label: "فريق الأمن والسلامة المدرسية" },
        { id: "special", label: "فريق التربية الخاصة" }
    ];
    var BOOK = [
        { id: "unset", label: "لم يُرصد" },
        { id: "received", label: "مستلم" },
        { id: "partial", label: "ناقص" },
        { id: "missing", label: "لم يُسلّم" }
    ];
    var LEVELS = [
        { id: "unset", label: "لم يُرصد" },
        { id: "recorded", label: "رُصدت درجة" },
        { id: "needs", label: "يحتاج دعمًا" }
    ];
    var BACKUP_KEYS = [
        "studentsRegistry1059",
        "nafesTargetWeek1059",
        "sidebar1059",
        "board1059.calendar",
        "board1059.facility",
        "board1059.leadership",
        "board1059.permissions",
        "board1059.attendance",
        "board1059.councils",
        "board1059.visits",
        "board1059.studentAbsence",
        "board1059.behavior",
        "board1059.textbooks",
        "board1059.preparations",
        "board1059.grades",
        "board1059.support",
        "board1059.supportRules",
        "board1059.accounts",
        "board1059.letterhead"
    ];

    function students() {
        if (typeof loadStudents !== "function") {
            return [];
        }
        return loadStudents().filter(function (student) {
            return student && student.student_name && student.student_nid;
        });
    }

    function studentById(id) {
        var found = null;
        students().forEach(function (student) {
            if (student.student_nid === id) {
                found = student;
            }
        });
        return found;
    }

    function classKey(student) {
        return (student.grade || "") + "|" + (student.section || "");
    }

    function classLabel(student) {
        var parts = [student.grade, student.section].filter(Boolean);
        return parts.length ? parts.join(" / ") : "دون صف";
    }

    function classOptions() {
        var seen = {};
        var list = [];
        students().forEach(function (student) {
            var key = classKey(student);
            if (seen[key]) {
                return;
            }
            seen[key] = true;
            list.push({ key: key, label: classLabel(student) });
        });
        return list;
    }

    function listStore(key) {
        var value = api.readStore(key);
        return Array.isArray(value) ? value : [];
    }

    function publishSuite(source) {
        if (window.dataHub && typeof window.dataHub.publish === "function") {
            window.dataHub.publish(source);
            return;
        }
        window.dispatchEvent(new CustomEvent("dataChanged", {
            detail: { source: source || "" }
        }));
    }

    function saveList(key, list) {
        localStorage.setItem(key, JSON.stringify(list));
        collectSignals();
        publishSuite("registers");
    }

    function collectSignals() {
        var absence = api.readStore("board1059.studentAbsence") || {};
        var rules = api.readStore("board1059.supportRules") || {};
        var map = {};
        function row(id) {
            if (!map[id]) {
                map[id] = { absent: 0, late: 0, mission: 0, behavior: 0, needsSupport: 0, support: 0, suggested: false };
            }
            return map[id];
        }
        Object.keys(absence).forEach(function (iso) {
            var day = absence[iso];
            if (!day || !day.adopted || !day.rows) {
                return;
            }
            Object.keys(day.rows).forEach(function (id) {
                var status = day.rows[id] && day.rows[id].status;
                var item = row(id);
                if (status === "absent") {
                    item.absent += 1;
                } else if (status === "late") {
                    item.late += 1;
                } else if (status === "mission") {
                    item.mission += 1;
                }
            });
        });
        listStore("board1059.behavior").forEach(function (item) {
            if (item && item.studentId) {
                row(item.studentId).behavior += 1;
            }
        });
        listStore("board1059.grades").forEach(function (sheet) {
            Object.keys(sheet && sheet.rows || {}).forEach(function (id) {
                if (sheet.rows[id] && sheet.rows[id].level === "needs") {
                    row(id).needsSupport += 1;
                }
            });
        });
        listStore("board1059.support").forEach(function (item) {
            if (item && item.studentId) {
                row(item.studentId).support += 1;
            }
        });
        var absenceLimit = Number(rules.absenceLimit);
        var lateLimit = Number(rules.lateLimit);
        Object.keys(map).forEach(function (id) {
            var item = map[id];
            if (rules.absenceLimit && absenceLimit > 0 && item.absent >= absenceLimit) {
                item.suggested = true;
            }
            if (rules.lateLimit && lateLimit > 0 && item.late >= lateLimit) {
                item.suggested = true;
            }
            if (item.needsSupport) {
                item.suggested = true;
            }
        });
        localStorage.setItem("board1059.studentSignals", JSON.stringify({ rows: map }));
        return map;
    }

    window.erpRefreshSignals = collectSignals;

    function applyAccounts() {
        var accounts = api.readStore("board1059.accounts") || {};
        api.staffDirectory.forEach(function (person) {
            if (accounts[person.id] && typeof accounts[person.id].active === "boolean") {
                person.active = accounts[person.id].active;
            }
        });
    }

    applyAccounts();

    function withDictionary(done) {
        var current = window.autoFillDictionary;
        if (current && current.behavior && current.academic_care) {
            done(current);
            return;
        }
        fetch("/banks/auto_fill_dictionary.json").then(function (response) {
            return response.ok ? response.json() : {};
        }).then(function (payload) {
            window.autoFillDictionary = payload || {};
            done(window.autoFillDictionary);
        }).catch(function () {
            done({ behavior: {}, academic_care: {} });
        });
    }

    function withEtec(done) {
        if (window.etecFramework1059) {
            done(window.etecFramework1059);
            return;
        }
        fetch("/api/registers-lookup").then(function (response) {
            return response.ok ? response.json() : {};
        }).then(function (payload) {
            window.etecFramework1059 = (payload && payload.etec_framework) || { domains: [] };
            done(window.etecFramework1059);
        }).catch(function () {
            done({ domains: [] });
        });
    }

    function paint(pane, image, html) {
        pane.classList.add("is-board");
        pane.innerHTML = api.washMarkup(image, "wash-board-sheet wash-facility", html);
    }

    function dual(prefix, label) {
        return "<div class=\"wash-field dual-date-block roll-dates is-wide\"><span>" + label + "</span><span class=\"dual-date-pair\">"
            + "<label><b>هجري</b><input class=\"doc-hijri\" id=\"" + prefix + "-hijri\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 17 ربيع الأول 1448هـ\" autocomplete=\"off\"></label>"
            + "<label><b>ميلادي</b><input class=\"doc-date-picker\" id=\"" + prefix + "-gregorian\" type=\"text\" inputmode=\"numeric\" placeholder=\"مثال: 30 أغسطس 2026م\" autocomplete=\"off\"></label>"
            + "</span></div>";
    }

    function fillToday(root, prefix) {
        var greg = root.querySelector("#" + prefix + "-gregorian");
        var hijri = root.querySelector("#" + prefix + "-hijri");
        var iso = api.todayIso();
        greg.value = gregorianFromDate(iso);
        hijri.value = hijriFromDate(iso);
        syncHijriGregorianDates(greg, hijri);
    }

    function isoOf(root, prefix) {
        var greg = root.querySelector("#" + prefix + "-gregorian");
        var hijri = root.querySelector("#" + prefix + "-hijri");
        return isoFromGregorianText(greg.value) || isoFromHijriText(hijri.value) || "";
    }

    function watchHijri(owner, hijri, onChange) {
        if (owner.onHijri) {
            document.removeEventListener("click", owner.onHijri);
        }
        owner.onHijri = function (event) {
            var day = event.target.closest ? event.target.closest("[data-hijri-day]") : null;
            if (!day || !hijri.isConnected) {
                return;
            }
            window.setTimeout(onChange, 0);
        };
        document.addEventListener("click", owner.onHijri);
    }

    function addOption(select, value, text) {
        var option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
    }

    function fillStudents(select) {
        select.innerHTML = "";
        addOption(select, "", "اختر الطالب");
        students().forEach(function (student) {
            addOption(select, student.student_nid, student.student_name + " — " + classLabel(student));
        });
    }

    function fillClasses(select, withAll) {
        select.innerHTML = "";
        if (withAll) {
            addOption(select, "all", "الكل");
        }
        classOptions().forEach(function (item) {
            addOption(select, item.key, item.label);
        });
    }

    function fillChoices(select, values, blank) {
        select.innerHTML = "";
        if (blank) {
            addOption(select, "", blank);
        }
        (values || []).forEach(function (value) {
            addOption(select, value, value);
        });
    }

    function emptyRow(tbody, cols, text) {
        var tr = document.createElement("tr");
        var cell = document.createElement("td");
        cell.colSpan = cols;
        cell.className = "staff-empty";
        cell.textContent = text;
        tr.appendChild(cell);
        tbody.appendChild(tr);
    }

    function backOnly() {
        return "<div class=\"wash-actions facility-actions\"><button class=\"wash-back\" type=\"button\">العودة</button></div>";
    }

    function uid(prefix) {
        return prefix + "-" + String(Date.now());
    }

    function addDays(iso, days) {
        var parts = String(iso || "").split("-");
        if (parts.length !== 3) {
            return "";
        }
        var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + days);
        var month = String(date.getMonth() + 1);
        var day = String(date.getDate());
        if (month.length < 2) {
            month = "0" + month;
        }
        if (day.length < 2) {
            day = "0" + day;
        }
        return date.getFullYear() + "-" + month + "-" + day;
    }

    function followUps() {
        var list = [];
        listStore("board1059.councils").forEach(function (item) {
            if (item && item.followIso) {
                var formation = FORMATIONS.filter(function (entry) { return entry.id === item.type; })[0];
                list.push({
                    kind: "مجلس",
                    title: formation ? formation.label : item.type,
                    iso: item.followIso,
                    hijri: item.followHijri || "",
                    gregorian: item.followGregorian || ""
                });
            }
        });
        listStore("board1059.behavior").forEach(function (item) {
            if (item && item.followIso) {
                list.push({
                    kind: "سلوك",
                    title: (item.studentName || "") + " — " + (item.violation || ""),
                    iso: item.followIso,
                    hijri: item.followHijri || "",
                    gregorian: item.followGregorian || ""
                });
            }
        });
        listStore("board1059.support").forEach(function (item) {
            if (item && item.followIso) {
                list.push({
                    kind: "تعثر",
                    title: (item.studentName || "") + " — " + (item.intervention || ""),
                    iso: item.followIso,
                    hijri: item.followHijri || "",
                    gregorian: item.followGregorian || ""
                });
            }
        });
        return list;
    }

    function paintBehavior(pane) {
        withDictionary(function (dictionary) {
            var violations = (dictionary.behavior || {}).violation_description || [];
            var actions = (dictionary.behavior || {}).educational_action || [];
            paint(pane, "/assets/dashboard/board-leadership.jpg",
                "<form id=\"behavior-form\">"
                + "<h1>سجل السلوك والمواظبة</h1>"
                + "<p class=\"wash-hint\">المخالفة والإجراء من القاموس المحفوظ. المواظبة تُحسب من سجل الغياب بعد اعتماده، ولا يُخترع اسم.</p>"
                + "<div class=\"board-layout\">"
                + "<section class=\"board-card board-span\"><h2>قيد سلوكي</h2><div class=\"council-meta\">"
                + "<label class=\"wash-field\"><span>الطالب</span><select id=\"behavior-student\"></select></label>"
                + "<label class=\"wash-field\"><span>الصف والفصل</span><input id=\"behavior-class\" type=\"text\" readonly></label>"
                + "<label class=\"wash-field\"><span>وصف المخالفة</span><select id=\"behavior-violation\"></select></label>"
                + "<label class=\"wash-field\"><span>الإجراء التربوي</span><select id=\"behavior-action\"></select></label>"
                + dual("behavior", "تاريخ القيد")
                + dual("behavior-follow", "تاريخ المتابعة")
                + "<label class=\"wash-field is-wide\"><span>نص حر</span><textarea id=\"behavior-notes\" rows=\"3\"></textarea></label>"
                + "</div></section>"
                + "<section class=\"board-card board-span\"><h2>المواظبة المحسوبة</h2>"
                + "<table class=\"staff-table roll-table\"><thead><tr><th>الطالب</th><th>غائب</th><th>متأخر</th><th>مستأذن</th><th>قيود سلوك</th></tr></thead><tbody id=\"behavior-signals\"></tbody></table>"
                + "</section>"
                + "<section class=\"board-card board-span\"><h2>القيود المحفوظة</h2><div id=\"behavior-saved\"></div></section>"
                + "</div>"
                + api.actionsHtml("حفظ القيد", "facility-actions")
                + "</form>");
            var form = pane.querySelector("#behavior-form");
            if (window.mountDocumentWitness) {
                window.mountDocumentWitness(form, "سجل سلوك");
            }
            var student = pane.querySelector("#behavior-student");
            var classField = pane.querySelector("#behavior-class");
            var violation = pane.querySelector("#behavior-violation");
            var action = pane.querySelector("#behavior-action");
            var notes = pane.querySelector("#behavior-notes");
            var saved = pane.querySelector("#behavior-saved");
            var signalBody = pane.querySelector("#behavior-signals");
            var message = form.querySelector(".wash-note");
            fillStudents(student);
            fillChoices(violation, violations, "اختر المخالفة");
            fillChoices(action, actions, "اختر الإجراء");
            fillToday(pane, "behavior");
            function showClass() {
                var person = studentById(student.value);
                classField.value = person ? classLabel(person) : "";
            }
            function paintSignals() {
                var rows = collectSignals();
                signalBody.innerHTML = "";
                var shown = students().filter(function (item) {
                    var signal = rows[item.student_nid];
                    return signal && (signal.absent || signal.late || signal.mission || signal.behavior);
                });
                if (!shown.length) {
                    emptyRow(signalBody, 5, "لا مواظبة محسوبة بعد. تظهر بعد اعتماد سجل الغياب أو حفظ قيد سلوكي.");
                    return;
                }
                shown.forEach(function (item) {
                    var signal = rows[item.student_nid];
                    var tr = document.createElement("tr");
                    [item.student_name, signal.absent, signal.late, signal.mission, signal.behavior].forEach(function (value) {
                        var cell = document.createElement("td");
                        cell.textContent = String(value);
                        tr.appendChild(cell);
                    });
                    signalBody.appendChild(tr);
                });
            }
            function paintSaved() {
                var list = listStore("board1059.behavior");
                saved.innerHTML = "";
                if (!list.length) {
                    var empty = document.createElement("p");
                    empty.className = "wash-hint";
                    empty.textContent = "لا قيود محفوظة.";
                    saved.appendChild(empty);
                    return;
                }
                list.forEach(function (item) {
                    var line = document.createElement("p");
                    var behaviorDate = typeof formatDisplayDate === "function" ? formatDisplayDate(item.hijri || "", "hijri") : (item.hijri || "");
                    line.textContent = behaviorDate + " — " + (item.studentName || "") + " — " + (item.violation || "") + " — " + (item.action || "");
                    var remove = document.createElement("button");
                    remove.type = "button";
                    remove.className = "staff-icon is-delete";
                    remove.textContent = "حذف";
                    remove.addEventListener("click", function () {
                        saveList("board1059.behavior", listStore("board1059.behavior").filter(function (entry) {
                            return entry.id !== item.id;
                        }));
                        paintSaved();
                        paintSignals();
                        message.textContent = "حُذف القيد.";
                    });
                    line.appendChild(document.createTextNode(" "));
                    line.appendChild(remove);
                    saved.appendChild(line);
                });
            }
            student.addEventListener("change", showClass);
            form.addEventListener("submit", function (event) {
                event.preventDefault();
                var person = studentById(student.value);
                var iso = isoOf(pane, "behavior");
                if (!person) {
                    message.textContent = "اختر الطالب من السجل المستورد.";
                    return;
                }
                if (!violation.value || !action.value) {
                    message.textContent = "اختر المخالفة والإجراء من القائمة.";
                    return;
                }
                if (!iso) {
                    message.textContent = "اختر تاريخ القيد.";
                    return;
                }
                var record = {
                    id: uid("behavior"),
                    studentId: person.student_nid,
                    studentName: person.student_name,
                    grade: person.grade || "",
                    section: person.section || "",
                    violation: violation.value,
                    action: action.value,
                    hijri: pane.querySelector("#behavior-hijri").value,
                    gregorian: pane.querySelector("#behavior-gregorian").value,
                    iso: iso,
                    followHijri: pane.querySelector("#behavior-follow-hijri").value,
                    followGregorian: pane.querySelector("#behavior-follow-gregorian").value,
                    followIso: isoOf(pane, "behavior-follow"),
                    notes: notes.value.trim(),
                    text: "في يوم " + pane.querySelector("#behavior-hijri").value + " الموافق " + pane.querySelector("#behavior-gregorian").value + " سُجّل على " + person.student_name + " " + violation.value + "، والإجراء " + action.value + "."
                };
                var list = listStore("board1059.behavior");
                list.push(record);
                saveList("board1059.behavior", list);
                notes.value = "";
                message.textContent = "حُفظ القيد، وتحدّث مؤشر الطالب.";
                paintSaved();
                paintSignals();
            });
            form.querySelector(".wash-cancel").addEventListener("click", function () {
                student.value = "";
                classField.value = "";
                notes.value = "";
                message.textContent = "";
            });
            paintSignals();
            paintSaved();
        });
    }

    function paintTextbooks(pane) {
        paint(pane, "/assets/dashboard/board-leadership.jpg",
            "<form id=\"book-form\">"
            + "<h1>سجل تسليم المقررات المدرسية</h1>"
            + "<p class=\"wash-hint\">المقرر من قائمة المقررات المحفوظة، والطلاب من الاستيراد. الأصل «لم يُرصد» حتى يُختار.</p>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card board-span\"><h2>التسليم</h2><div class=\"roll-toolbar\">"
            + "<label class=\"wash-field\"><span>المقرر</span><select id=\"book-subject\"></select></label>"
            + "<label class=\"wash-field\"><span>الصف والفصل</span><select id=\"book-class\"></select></label>"
            + dual("book", "تاريخ التسليم")
            + "</div></section>"
            + "<section class=\"board-card board-span\"><h2>الطلاب</h2>"
            + "<table class=\"staff-table roll-table\"><thead><tr><th>الطالب</th><th>الحالة</th><th>ملاحظة النقص</th></tr></thead><tbody id=\"book-rows\"></tbody></table>"
            + "</section></div>"
            + api.actionsHtml("اعتماد التسليم", "facility-actions")
            + "</form>");
        var form = pane.querySelector("#book-form");
        if (window.mountDocumentWitness) {
            window.mountDocumentWitness(form, "سجل تسليم المقررات");
        }
        var subject = pane.querySelector("#book-subject");
        var classSelect = pane.querySelector("#book-class");
        var tbody = pane.querySelector("#book-rows");
        var message = form.querySelector(".wash-note");
        var drafts = {};
        fillChoices(subject, SUBJECTS, "اختر المقرر");
        fillClasses(classSelect, true);
        if (classSelect.options.length > 2) {
            classSelect.selectedIndex = 1;
        }
        fillToday(pane, "book");
        function keyNow() {
            return subject.value + "|" + isoOf(pane, "book");
        }
        function draft() {
            var key = keyNow();
            if (!key || drafts[key]) {
                return drafts[key] || { rows: {} };
            }
            var found = listStore("board1059.textbooks").filter(function (item) {
                return item.subject === subject.value && item.iso === isoOf(pane, "book");
            })[0];
            drafts[key] = { rows: found && found.rows ? found.rows : {} };
            return drafts[key];
        }
        function render() {
            var current = draft();
            var filter = classSelect.value;
            var list = students().filter(function (student) {
                return filter === "all" || classKey(student) === filter;
            });
            tbody.innerHTML = "";
            if (!list.length) {
                emptyRow(tbody, 3, "لا طلاب في هذا التصفية.");
                return;
            }
            list.forEach(function (student) {
                var record = current.rows[student.student_nid] || { status: "unset", note: "" };
                var tr = document.createElement("tr");
                var name = document.createElement("td");
                name.textContent = student.student_name;
                var statusCell = document.createElement("td");
                var select = document.createElement("select");
                select.setAttribute("data-book-student", student.student_nid);
                BOOK.forEach(function (item) {
                    addOption(select, item.id, item.label);
                });
                select.value = record.status || "unset";
                statusCell.appendChild(select);
                var noteCell = document.createElement("td");
                var field = document.createElement("input");
                field.type = "text";
                field.value = record.note || "";
                field.hidden = select.value !== "partial";
                field.placeholder = "ما الذي نقص";
                field.setAttribute("data-book-note", student.student_nid);
                noteCell.appendChild(field);
                tr.appendChild(name);
                tr.appendChild(statusCell);
                tr.appendChild(noteCell);
                tbody.appendChild(tr);
            });
        }
        tbody.addEventListener("change", function (event) {
            var select = event.target;
            if (!select || !select.getAttribute("data-book-student")) {
                return;
            }
            var current = draft();
            var id = select.getAttribute("data-book-student");
            if (!current.rows[id]) {
                current.rows[id] = { status: "unset", note: "" };
            }
            current.rows[id].status = select.value;
            var field = select.closest("tr").querySelector("[data-book-note]");
            field.hidden = select.value !== "partial";
        });
        tbody.addEventListener("input", function (event) {
            var field = event.target;
            if (!field || !field.getAttribute("data-book-note")) {
                return;
            }
            var current = draft();
            var id = field.getAttribute("data-book-note");
            if (!current.rows[id]) {
                current.rows[id] = { status: "unset", note: "" };
            }
            current.rows[id].note = field.value;
        });
        subject.addEventListener("change", render);
        classSelect.addEventListener("change", render);
        pane.addEventListener("change", function (event) {
            if (event.target.id === "book-gregorian" || event.target.id === "book-hijri" || event.target.classList.contains("date-picker-native")) {
                window.setTimeout(render, 0);
            }
        });
        watchHijri(paintTextbooks, pane.querySelector("#book-hijri"), render);
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var iso = isoOf(pane, "book");
            if (!subject.value || !iso) {
                message.textContent = "اختر المقرر والتاريخ.";
                return;
            }
            var current = draft();
            var record = {
                id: uid("book"),
                subject: subject.value,
                hijri: pane.querySelector("#book-hijri").value,
                gregorian: pane.querySelector("#book-gregorian").value,
                iso: iso,
                rows: current.rows
            };
            var list = listStore("board1059.textbooks").filter(function (item) {
                return !(item.subject === record.subject && item.iso === record.iso);
            });
            list.push(record);
            saveList("board1059.textbooks", list);
            message.textContent = "اعتُمد تسليم المقرر.";
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            delete drafts[keyNow()];
            message.textContent = "";
            render();
        });
        render();
    }

    function paintPreparation(pane) {
        withEtec(function (framework) {
            var standards = [];
            (framework.domains || []).forEach(function (domain) {
                (domain.standards || []).forEach(function (standard) {
                    standards.push(standard.code + " " + standard.name);
                });
            });
            paint(pane, "/assets/dashboard/board-leadership.jpg",
                "<form id=\"prep-form\">"
                + "<h1>سجل التحضير اليومي والخطط</h1>"
                + "<p class=\"wash-hint\">المعلم من سجل المنسوبين، والحصة والمقرر من القوائم المحفوظة، والمعيار من إطار الهيئة إن وُجد.</p>"
                + "<div class=\"board-layout\"><section class=\"board-card board-span\"><h2>تحضير الحصة</h2><div class=\"council-meta\">"
                + "<label class=\"wash-field\"><span>المعلم</span><select id=\"prep-teacher\"></select></label>"
                + "<label class=\"wash-field\"><span>المقرر</span><select id=\"prep-subject\"></select></label>"
                + "<label class=\"wash-field\"><span>الصف والفصل</span><select id=\"prep-class\"></select></label>"
                + "<label class=\"wash-field\"><span>الحصة</span><select id=\"prep-period\"></select></label>"
                + dual("prep", "تاريخ الحصة")
                + "<label class=\"wash-field is-wide\"><span>المعيار المرتبط</span><select id=\"prep-standard\"></select></label>"
                + "<label class=\"wash-field is-wide\"><span>عنوان الدرس</span><input id=\"prep-title\" type=\"text\" autocomplete=\"off\"></label>"
                + "<label class=\"wash-field is-wide\"><span>الهدف</span><textarea id=\"prep-goal\" rows=\"3\"></textarea></label>"
                + "</div></section>"
                + "<section class=\"board-card board-span\"><h2>التحضيرات المحفوظة</h2><div id=\"prep-saved\"></div></section>"
                + "</div>"
                + api.actionsHtml("حفظ التحضير", "facility-actions")
                + "</form>");
            var form = pane.querySelector("#prep-form");
            if (window.mountDocumentWitness) {
                window.mountDocumentWitness(form, "سجل تحضير");
            }
            var teacher = pane.querySelector("#prep-teacher");
            var subject = pane.querySelector("#prep-subject");
            var classSelect = pane.querySelector("#prep-class");
            var period = pane.querySelector("#prep-period");
            var standard = pane.querySelector("#prep-standard");
            var title = pane.querySelector("#prep-title");
            var goal = pane.querySelector("#prep-goal");
            var saved = pane.querySelector("#prep-saved");
            var message = form.querySelector(".wash-note");
            addOption(teacher, "", "اختر المعلم");
            api.staffDirectory.forEach(function (person) {
                if (person.role.indexOf("معلم") === 0) {
                    addOption(teacher, person.id, person.name);
                }
            });
            fillChoices(subject, SUBJECTS, "اختر المقرر");
            fillClasses(classSelect, false);
            fillChoices(period, PERIODS, "اختر الحصة");
            fillChoices(standard, standards, "بدون ربط");
            fillToday(pane, "prep");
            function paintSaved() {
                var list = listStore("board1059.preparations");
                saved.innerHTML = "";
                if (!list.length) {
                    var empty = document.createElement("p");
                    empty.className = "wash-hint";
                    empty.textContent = "لا تحضير محفوظ.";
                    saved.appendChild(empty);
                    return;
                }
                list.forEach(function (item) {
                    var line = document.createElement("p");
                    var visitLineDate = typeof formatDisplayDate === "function" ? formatDisplayDate(item.hijri || "", "hijri") : (item.hijri || "");
                    line.textContent = visitLineDate + " — " + (item.teacherName || "") + " — " + (item.subject || "") + " — " + (item.period || "") + " — " + (item.title || "");
                    var remove = document.createElement("button");
                    remove.type = "button";
                    remove.className = "staff-icon is-delete";
                    remove.textContent = "حذف";
                    remove.addEventListener("click", function () {
                        saveList("board1059.preparations", listStore("board1059.preparations").filter(function (entry) {
                            return entry.id !== item.id;
                        }));
                        paintSaved();
                    });
                    line.appendChild(document.createTextNode(" "));
                    line.appendChild(remove);
                    saved.appendChild(line);
                });
            }
            teacher.addEventListener("change", function () {
                var person = api.staffDirectory.filter(function (item) { return item.id === teacher.value; })[0];
                if (person && SUBJECTS.indexOf(person.specialty) !== -1) {
                    subject.value = person.specialty;
                }
            });
            form.addEventListener("submit", function (event) {
                event.preventDefault();
                var person = api.staffDirectory.filter(function (item) { return item.id === teacher.value; })[0];
                var iso = isoOf(pane, "prep");
                if (!person || !subject.value || !classSelect.value || !period.value || !title.value.trim() || !iso) {
                    message.textContent = "أكمل المعلم والمقرر والصف والحصة والدرس والتاريخ.";
                    return;
                }
                var record = {
                    id: uid("prep"),
                    teacherId: person.id,
                    teacherName: person.name,
                    subject: subject.value,
                    classKey: classSelect.value,
                    classLabel: classSelect.options[classSelect.selectedIndex].textContent,
                    period: period.value,
                    standard: standard.value,
                    title: title.value.trim(),
                    goal: goal.value.trim(),
                    hijri: pane.querySelector("#prep-hijri").value,
                    gregorian: pane.querySelector("#prep-gregorian").value,
                    iso: iso
                };
                var list = listStore("board1059.preparations");
                list.push(record);
                saveList("board1059.preparations", list);
                title.value = "";
                goal.value = "";
                message.textContent = "حُفظ التحضير.";
                paintSaved();
            });
            form.querySelector(".wash-cancel").addEventListener("click", function () {
                title.value = "";
                goal.value = "";
                message.textContent = "";
            });
            paintSaved();
        });
    }

    function paintGrades(pane) {
        paint(pane, "/assets/dashboard/board-leadership.jpg",
            "<form id=\"grade-form\">"
            + "<h1>سجل رصد الدرجات والمشاركات</h1>"
            + "<p class=\"wash-hint\">لا تُوضع درجة حتى تُكتب. «يحتاج دعمًا» هو الذي يغذّي سجل المتعثرين.</p>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card board-span\"><h2>كشف الرصد</h2><div class=\"roll-toolbar\">"
            + "<label class=\"wash-field\"><span>المعلم</span><select id=\"grade-teacher\"></select></label>"
            + "<label class=\"wash-field\"><span>المقرر</span><select id=\"grade-subject\"></select></label>"
            + "<label class=\"wash-field\"><span>الصف والفصل</span><select id=\"grade-class\"></select></label>"
            + dual("grade", "تاريخ الرصد")
            + "</div></section>"
            + "<section class=\"board-card board-span\"><h2>الطلاب</h2>"
            + "<table class=\"staff-table roll-table\"><thead><tr><th>الطالب</th><th>حالة الرصد</th><th>الدرجة</th><th>المشاركة</th></tr></thead><tbody id=\"grade-rows\"></tbody></table>"
            + "</section></div>"
            + api.actionsHtml("حفظ الكشف", "facility-actions")
            + "</form>");
        var form = pane.querySelector("#grade-form");
        if (window.mountDocumentWitness) {
            window.mountDocumentWitness(form, "سجل درجات");
        }
        var teacher = pane.querySelector("#grade-teacher");
        var subject = pane.querySelector("#grade-subject");
        var classSelect = pane.querySelector("#grade-class");
        var tbody = pane.querySelector("#grade-rows");
        var message = form.querySelector(".wash-note");
        var drafts = {};
        addOption(teacher, "", "اختر المعلم");
        api.staffDirectory.forEach(function (person) {
            if (person.role.indexOf("معلم") === 0) {
                addOption(teacher, person.id, person.name);
            }
        });
        fillChoices(subject, SUBJECTS, "اختر المقرر");
        fillClasses(classSelect, false);
        fillToday(pane, "grade");
        function keyNow() {
            return [subject.value, classSelect.value, isoOf(pane, "grade")].join("|");
        }
        function draft() {
            var key = keyNow();
            if (!key || drafts[key]) {
                return drafts[key] || { rows: {} };
            }
            var iso = isoOf(pane, "grade");
            var found = listStore("board1059.grades").filter(function (item) {
                return item.subject === subject.value && item.classKey === classSelect.value && item.iso === iso;
            })[0];
            drafts[key] = { rows: found && found.rows ? found.rows : {} };
            return drafts[key];
        }
        function render() {
            var current = draft();
            var list = students().filter(function (student) {
                return classKey(student) === classSelect.value;
            });
            tbody.innerHTML = "";
            if (!classSelect.value || !list.length) {
                emptyRow(tbody, 4, "لا طلاب في الصف المختار.");
                return;
            }
            list.forEach(function (student) {
                var record = current.rows[student.student_nid] || { level: "unset", score: "", participation: "" };
                var tr = document.createElement("tr");
                var name = document.createElement("td");
                name.textContent = student.student_name;
                var levelCell = document.createElement("td");
                var select = document.createElement("select");
                select.setAttribute("data-grade-student", student.student_nid);
                LEVELS.forEach(function (item) {
                    addOption(select, item.id, item.label);
                });
                select.value = record.level || "unset";
                levelCell.appendChild(select);
                var scoreCell = document.createElement("td");
                var score = document.createElement("input");
                score.type = "text";
                score.inputMode = "decimal";
                score.value = record.score || "";
                score.placeholder = "تُكتب عند الرصد";
                score.hidden = select.value === "unset";
                score.setAttribute("data-grade-score", student.student_nid);
                scoreCell.appendChild(score);
                var partCell = document.createElement("td");
                var part = document.createElement("input");
                part.type = "text";
                part.value = record.participation || "";
                part.setAttribute("data-grade-part", student.student_nid);
                partCell.appendChild(part);
                tr.appendChild(name);
                tr.appendChild(levelCell);
                tr.appendChild(scoreCell);
                tr.appendChild(partCell);
                tbody.appendChild(tr);
            });
        }
        function ensure(id) {
            var current = draft();
            if (!current.rows[id]) {
                current.rows[id] = { level: "unset", score: "", participation: "" };
            }
            return current.rows[id];
        }
        tbody.addEventListener("change", function (event) {
            var select = event.target;
            if (!select || !select.getAttribute("data-grade-student")) {
                return;
            }
            var id = select.getAttribute("data-grade-student");
            ensure(id).level = select.value;
            var score = select.closest("tr").querySelector("[data-grade-score]");
            score.hidden = select.value === "unset";
        });
        tbody.addEventListener("input", function (event) {
            var field = event.target;
            if (!field) {
                return;
            }
            if (field.getAttribute("data-grade-score")) {
                ensure(field.getAttribute("data-grade-score")).score = field.value;
            }
            if (field.getAttribute("data-grade-part")) {
                ensure(field.getAttribute("data-grade-part")).participation = field.value;
            }
        });
        subject.addEventListener("change", render);
        classSelect.addEventListener("change", render);
        pane.addEventListener("change", function (event) {
            if (event.target.id === "grade-gregorian" || event.target.id === "grade-hijri" || event.target.classList.contains("date-picker-native")) {
                window.setTimeout(render, 0);
            }
        });
        watchHijri(paintGrades, pane.querySelector("#grade-hijri"), render);
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var person = api.staffDirectory.filter(function (item) { return item.id === teacher.value; })[0];
            var iso = isoOf(pane, "grade");
            if (!person || !subject.value || !classSelect.value || !iso) {
                message.textContent = "اختر المعلم والمقرر والصف والتاريخ.";
                return;
            }
            var record = {
                id: uid("grade"),
                teacherId: person.id,
                teacherName: person.name,
                subject: subject.value,
                classKey: classSelect.value,
                classLabel: classSelect.options[classSelect.selectedIndex].textContent,
                hijri: pane.querySelector("#grade-hijri").value,
                gregorian: pane.querySelector("#grade-gregorian").value,
                iso: iso,
                rows: draft().rows
            };
            var list = listStore("board1059.grades").filter(function (item) {
                return !(item.subject === record.subject && item.classKey === record.classKey && item.iso === record.iso);
            });
            list.push(record);
            saveList("board1059.grades", list);
            message.textContent = "حُفظ الكشف، وتحدّث مؤشر من يحتاج دعمًا.";
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            delete drafts[keyNow()];
            message.textContent = "";
            render();
        });
        render();
    }

    function paintRemedialPlan(pane) {
        pane.classList.add("is-board");
        pane.innerHTML = "<div class=\"ffe-mount\" id=\"remedial-plan-mount\"></div>";
        var host = pane.querySelector("#remedial-plan-mount");
        if (!window.FormFillEngine || typeof window.FormFillEngine.mountFromUrl !== "function") {
            host.innerHTML = "<p class=\"wash-hint\">محرك التعبئة غير محمّل.</p>";
            return;
        }
        window.FormFillEngine.mountFromUrl(host, "/schemas/forms/individual_remedial_plan.json", {
            onBack: function () {
                var back = document.querySelector(".erp-back, [data-erp-home], .wash-back");
                if (pane.querySelector(".wash-back")) {
                    /* handled inside engine */
                }
                if (window.erp1059 && typeof window.erp1059.closeBoard === "function") {
                    window.erp1059.closeBoard();
                }
            }
        }).catch(function (error) {
            host.innerHTML = "<p class=\"wash-hint\">" + String((error && error.message) || "تعذر فتح النموذج.") + "</p>";
        });
    }

    function paintSupport(pane) {
        withDictionary(function (dictionary) {
            var care = dictionary.academic_care || {};
            paint(pane, "/assets/dashboard/board-leadership.jpg",
                "<h1>سجل متابعة الطلاب المتعثرين</h1>"
                + "<p class=\"wash-hint\">المقترح يُحسب من حد الغياب الذي تكتبه، أو من «يحتاج دعمًا» في سجل الدرجات. لا يُقترح اسم من غير ذلك.</p>"
                + "<div class=\"board-layout\">"
                + "<section class=\"board-card board-span\"><h2>حد الاقتراح</h2><div class=\"council-meta\">"
                + "<label class=\"wash-field\"><span>حد أيام الغياب</span><input id=\"support-absence\" type=\"text\" inputmode=\"numeric\" placeholder=\"فارغ يعني بلا حد\"></label>"
                + "<label class=\"wash-field\"><span>حد أيام التأخر</span><input id=\"support-late\" type=\"text\" inputmode=\"numeric\" placeholder=\"فارغ يعني بلا حد\"></label>"
                + "<button type=\"button\" class=\"wash-save\" id=\"support-rules\">حفظ الحد</button>"
                + "</div><p class=\"wash-note\" id=\"support-rules-note\"></p></section>"
                + "<section class=\"board-card board-span\"><h2>المقترح للمتابعة</h2>"
                + "<table class=\"staff-table roll-table\"><thead><tr><th>الطالب</th><th>غائب</th><th>متأخر</th><th>يحتاج دعمًا</th></tr></thead><tbody id=\"support-suggested\"></tbody></table>"
                + "</section>"
                + "<form id=\"support-form\" class=\"board-card board-span\"><h2>قيد المتابعة</h2><div class=\"council-meta\">"
                + "<label class=\"wash-field\"><span>الطالب</span><select id=\"support-student\"></select></label>"
                + "<label class=\"wash-field\"><span>نوع الفاقد</span><select id=\"support-loss\"></select></label>"
                + "<label class=\"wash-field\"><span>المهارة</span><select id=\"support-skill\"></select></label>"
                + "<label class=\"wash-field\"><span>نوع التدخل</span><select id=\"support-action\"></select></label>"
                + dual("support", "تاريخ القيد")
                + dual("support-follow", "تاريخ المتابعة")
                + "<label class=\"wash-field is-wide\"><span>نص حر</span><textarea id=\"support-notes\" rows=\"3\"></textarea></label>"
                + "</div>"
                + api.actionsHtml("حفظ المتابعة", "facility-actions")
                + "</form></div>");
            var rules = api.readStore("board1059.supportRules") || {};
            var absence = pane.querySelector("#support-absence");
            var late = pane.querySelector("#support-late");
            var suggested = pane.querySelector("#support-suggested");
            var form = pane.querySelector("#support-form");
            if (window.mountDocumentWitness) {
                window.mountDocumentWitness(form, "سجل متابعة");
            }
            var student = pane.querySelector("#support-student");
            var message = form.querySelector(".wash-note");
            absence.value = rules.absenceLimit || "";
            late.value = rules.lateLimit || "";
            fillStudents(student);
            fillChoices(pane.querySelector("#support-loss"), care.loss_type || [], "اختر نوع الفاقد");
            fillChoices(pane.querySelector("#support-skill"), care.skill || [], "اختر المهارة");
            fillChoices(pane.querySelector("#support-action"), care.intervention || [], "اختر التدخل");
            fillToday(pane, "support");
            function paintSuggested() {
                var rows = collectSignals();
                suggested.innerHTML = "";
                var shown = students().filter(function (item) {
                    return rows[item.student_nid] && rows[item.student_nid].suggested;
                });
                if (!shown.length) {
                    emptyRow(suggested, 4, "لا طالب مقترح. اكتب حد الغياب أو حد التأخر، أو ضع «يحتاج دعمًا» في سجل الدرجات.");
                    return;
                }
                shown.forEach(function (item) {
                    var signal = rows[item.student_nid];
                    var tr = document.createElement("tr");
                    [item.student_name, signal.absent, signal.late, signal.needsSupport].forEach(function (value) {
                        var cell = document.createElement("td");
                        cell.textContent = String(value);
                        tr.appendChild(cell);
                    });
                    suggested.appendChild(tr);
                });
            }
            pane.querySelector("#support-rules").addEventListener("click", function () {
                var next = {
                    absenceLimit: absence.value.trim(),
                    lateLimit: late.value.trim()
                };
                localStorage.setItem("board1059.supportRules", JSON.stringify(next));
                collectSignals();
                pane.querySelector("#support-rules-note").textContent = "حُفظ الحد، وتحدّث المقترح.";
                paintSuggested();
            });
            form.addEventListener("submit", function (event) {
                event.preventDefault();
                var person = studentById(student.value);
                var iso = isoOf(pane, "support");
                var loss = pane.querySelector("#support-loss").value;
                var skill = pane.querySelector("#support-skill").value;
                var action = pane.querySelector("#support-action").value;
                if (!person || !loss || !skill || !action || !iso) {
                    message.textContent = "أكمل الطالب والقوائم والتاريخ.";
                    return;
                }
                var list = listStore("board1059.support");
                list.push({
                    id: uid("support"),
                    studentId: person.student_nid,
                    studentName: person.student_name,
                    grade: person.grade || "",
                    section: person.section || "",
                    loss: loss,
                    skill: skill,
                    intervention: action,
                    hijri: pane.querySelector("#support-hijri").value,
                    gregorian: pane.querySelector("#support-gregorian").value,
                    iso: iso,
                    followHijri: pane.querySelector("#support-follow-hijri").value,
                    followGregorian: pane.querySelector("#support-follow-gregorian").value,
                    followIso: isoOf(pane, "support-follow"),
                    notes: pane.querySelector("#support-notes").value.trim()
                });
                saveList("board1059.support", list);
                message.textContent = "حُفظت المتابعة.";
                paintSuggested();
            });
            form.querySelector(".wash-cancel").addEventListener("click", function () {
                student.value = "";
                pane.querySelector("#support-notes").value = "";
                message.textContent = "";
            });
            paintSuggested();
        });
    }

    function paintAccounts(pane) {
        applyAccounts();
        paint(pane, "/assets/dashboard/board-facility.jpg",
            "<form id=\"account-form\">"
            + "<h1>إدارة الحسابات والأمان</h1>"
            + "<p class=\"wash-hint\">الإيقاف يحدّث حالة المنسوب في السجل. كلمة المرور تُحفظ ولا تُعرض بعد حفظها.</p>"
            + "<div class=\"board-layout\"><section class=\"board-card board-span\"><h2>الحسابات</h2>"
            + "<table class=\"staff-table\"><thead><tr><th>الاسم</th><th>المسمى</th><th>الحالة</th><th>كلمة المرور</th><th>إيقاف</th></tr></thead><tbody id=\"account-rows\"></tbody></table>"
            + "</section></div>"
            + api.actionsHtml("حفظ الحسابات", "facility-actions")
            + "</form>");
        var form = pane.querySelector("#account-form");
        var tbody = pane.querySelector("#account-rows");
        var message = form.querySelector(".wash-note");
        api.staffDirectory.forEach(function (person) {
            var tr = document.createElement("tr");
            var name = document.createElement("td");
            name.textContent = person.name;
            var role = document.createElement("td");
            role.textContent = person.role;
            var state = document.createElement("td");
            state.textContent = person.active ? "نشط" : "موقوف";
            var secretCell = document.createElement("td");
            var secret = document.createElement("input");
            secret.type = "password";
            secret.autocomplete = "new-password";
            secret.placeholder = "اكتب لتعيين كلمة مرور";
            secret.setAttribute("data-account-secret", person.id);
            secretCell.appendChild(secret);
            var stopCell = document.createElement("td");
            var stop = document.createElement("input");
            stop.type = "checkbox";
            stop.checked = !person.active;
            stop.setAttribute("data-account-stop", person.id);
            stopCell.appendChild(stop);
            tr.appendChild(name);
            tr.appendChild(role);
            tr.appendChild(state);
            tr.appendChild(secretCell);
            tr.appendChild(stopCell);
            tbody.appendChild(tr);
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var next = api.readStore("board1059.accounts") || {};
            var pending = [];
            api.staffDirectory.forEach(function (person) {
                var box = tbody.querySelector("[data-account-stop='" + person.id + "']");
                var field = tbody.querySelector("[data-account-secret='" + person.id + "']");
                person.active = !(box && box.checked);
                next[person.id] = { active: person.active };
                if (field && field.value) {
                    pending.push({ id: person.id, password: field.value });
                    field.value = "";
                }
            });
            localStorage.setItem("board1059.accounts", JSON.stringify(next));
            var posts = pending.map(function (item) {
                return fetch("/api/users/password", {
                    method: "POST",
                    headers: window.board1059Access.headers(),
                    body: JSON.stringify({ national_id: item.id, password: item.password })
                });
            });
            Promise.all(posts).then(function () {
                paintAccounts(pane);
                var savedNote = pane.querySelector(".wash-note");
                if (savedNote) {
                    savedNote.textContent = pending.length ? "حُفظت الحسابات، وكُتبت كلمة المرور في القاعدة." : "حُفظت الحسابات.";
                }
            });
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            paintAccounts(pane);
        });
    }

    function paintLetterhead(pane) {
        var saved = api.readStore("board1059.letterhead") || {};
        var leadership = api.readStore("board1059.leadership") || {};
        var principalShown = window.dataHub ? window.dataHub.display(leadership.principal) : "";
        var school = document.getElementById("command-school-name");
        paint(pane, "/assets/dashboard/board-facility.jpg",
            "<form id=\"letter-form\">"
            + "<h1>الترويسة والأختام</h1>"
            + "<p class=\"wash-hint\">القالب الرسمي محصّن: الإطار، والترويسة الثلاثية، وشريط التوقيعات، وأبعاد الشعارين. هذه الشاشة لا تبدّلها.</p>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card\"><h2>ما يظهر الآن</h2>"
            + "<p id=\"letter-school\"></p><p id=\"letter-principal\"></p>"
            + "<p class=\"wash-hint\">وزارة التعليم يمينًا، ورؤية 2030 يسارًا، والبيانات في الوسط.</p></section>"
            + "<section class=\"board-card board-span\"><h2>عبارة تُحفظ مع النسخة</h2>"
            + "<label class=\"wash-field\"><span>عبارة تحت الختم</span><input name=\"stampNote\" type=\"text\" autocomplete=\"off\"></label>"
            + "</section></div>"
            + api.actionsHtml("حفظ العبارة", "facility-actions")
            + "</form>");
        pane.querySelector("#letter-school").textContent = school ? school.textContent : "";
        pane.querySelector("#letter-principal").textContent = principalShown ? "مدير المدرسة: " + principalShown : "لا اسم محفوظ لمدير المدرسة في التشكيل القيادي.";
        var form = pane.querySelector("#letter-form");
        form.elements.stampNote.value = saved.stampNote || "";
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            localStorage.setItem("board1059.letterhead", JSON.stringify({ stampNote: form.elements.stampNote.value.trim() }));
            form.querySelector(".wash-note").textContent = "حُفظت العبارة، والترويسة الرسمية كما هي.";
        });
        form.querySelector(".wash-cancel").addEventListener("click", function () {
            form.elements.stampNote.value = (api.readStore("board1059.letterhead") || {}).stampNote || "";
            form.querySelector(".wash-note").textContent = "";
        });
    }

    function paintBackup(pane) {
        paint(pane, "/assets/dashboard/board-facility.jpg",
            "<form id=\"backup-form\">"
            + "<h1>النسخ الاحتياطي</h1>"
            + "<p class=\"wash-hint\">النسخ يكتب ملف school_1059.db في مجلد backups. الاستعادة تستبدل القاعدة الحالية بعد التأكيد، وهي للمدير.</p>"
            + "<div class=\"board-layout\"><section class=\"board-card board-span\"><h2>نسخ القاعدة</h2>"
            + "<div class=\"wash-actions facility-actions\">"
            + "<button class=\"wash-save\" type=\"button\" id=\"backup-now\">نسخ احتياطي الآن</button>"
            + "<button class=\"wash-back\" type=\"button\">العودة</button>"
            + "</div>"
            + "<p class=\"wash-note\" id=\"backup-note\"></p>"
            + "<table class=\"program-table\"><thead><tr><th>النسخة</th><th>التاريخ</th><th>الحجم</th><th></th></tr></thead><tbody id=\"backup-rows\"></tbody></table>"
            + "<div id=\"backup-confirm\" hidden>"
            + "<p class=\"wash-hint\" id=\"backup-confirm-text\"></p>"
            + "<div class=\"wash-actions facility-actions\">"
            + "<button class=\"wash-save\" type=\"button\" id=\"backup-confirm-yes\">تأكيد الاستعادة</button>"
            + "<button class=\"wash-print\" type=\"button\" id=\"backup-confirm-no\">إلغاء</button>"
            + "</div></div>"
            + "</section></div></form>");
        var message = pane.querySelector("#backup-note");
        var rows = pane.querySelector("#backup-rows");
        var confirmBox = pane.querySelector("#backup-confirm");
        var pending = "";
        function sizeText(bytes) {
            var value = Number(bytes) || 0;
            if (value >= 1048576) {
                return (value / 1048576).toFixed(1) + " م.ب";
            }
            return Math.max(1, Math.round(value / 1024)) + " ك.ب";
        }
        function draw(list) {
            rows.innerHTML = (list || []).map(function (item) {
                return "<tr><td>" + item.name + "</td><td>" + item.modified + "</td><td>" + sizeText(item.bytes) + "</td><td><button type=\"button\" class=\"program-edit\" data-restore=\"" + item.name + "\">استعادة</button></td></tr>";
            }).join("") || "<tr><td colspan=\"4\">لا نسخ بعد.</td></tr>";
        }
        function load() {
            return fetch("/api/backups", { headers: window.board1059Access.headers() }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر قراءة النسخ");
                    }
                    draw(payload.backups || []);
                });
            }).catch(function (error) {
                message.textContent = error.message || "تعذر قراءة النسخ.";
            });
        }
        pane.querySelector("#backup-now").addEventListener("click", function () {
            message.textContent = "جارٍ النسخ…";
            fetch("/api/backups", { method: "POST", headers: window.board1059Access.headers() }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر النسخ");
                    }
                    message.textContent = "حُفظت النسخة " + payload.name;
                    return load();
                });
            }).catch(function (error) {
                message.textContent = error.message || "تعذر النسخ.";
            });
        });
        rows.addEventListener("click", function (event) {
            var button = event.target.closest("[data-restore]");
            if (!button) {
                return;
            }
            pending = button.getAttribute("data-restore");
            pane.querySelector("#backup-confirm-text").textContent = "استعادة " + pending + " تستبدل القاعدة الحالية. هل تؤكد؟";
            confirmBox.hidden = false;
        });
        pane.querySelector("#backup-confirm-no").addEventListener("click", function () {
            pending = "";
            confirmBox.hidden = true;
            message.textContent = "أُلغيت الاستعادة.";
        });
        pane.querySelector("#backup-confirm-yes").addEventListener("click", function () {
            if (!pending) {
                return;
            }
            var name = pending;
            pending = "";
            confirmBox.hidden = true;
            message.textContent = "جارٍ الاستعادة…";
            fetch("/api/backups/restore", {
                method: "POST",
                headers: window.board1059Access.headers(),
                body: JSON.stringify({ name: name })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر الاستعادة");
                    }
                    message.textContent = "استُعيدت " + payload.name + ". أعد فتح الصفحة لقراءة البيانات المستعادة.";
                });
            }).catch(function (error) {
                message.textContent = error.message || "تعذر الاستعادة.";
            });
        });
        load();
    }

    function localFollowPayload() {
        return followUps().map(function (item, index) {
            return {
                kind: item.kind,
                title: item.title,
                iso: item.iso,
                hijri: item.hijri || "",
                gregorian: item.gregorian || "",
                source_ref: "follow:" + (item.kind || "متابعة") + ":" + (item.iso || "") + ":" + index
            };
        });
    }

    function paintAbsenceToday(pane) {
        var iso = api.todayIso();
        var day = (api.readStore("board1059.studentAbsence") || {})[iso];
        paint(pane, "/assets/dashboard/board-calendar.jpg",
            "<h1>غياب وتأخر اليوم</h1><p class=\"wash-hint\">يُعرض ما اعتُمد في سجل الغياب لتاريخ اليوم فقط.</p>"
            + "<div class=\"board-layout\"><section class=\"board-card board-span\"><h2>" + hijriFromDate(iso) + " — " + gregorianFromDate(iso) + "</h2>"
            + "<table class=\"staff-table\"><thead><tr><th>الطالب</th><th>الحالة</th><th>الملاحظة</th></tr></thead><tbody id=\"today-rows\"></tbody></table>"
            + "</section></div>" + backOnly());
        var tbody = pane.querySelector("#today-rows");
        if (!day || !day.adopted) {
            emptyRow(tbody, 3, "سجل اليوم لم يُعتمد بعد.");
            return;
        }
        var labels = { late: "متأخر", absent: "غائب", mission: "مستأذن" };
        var count = 0;
        students().forEach(function (student) {
            var item = day.rows && day.rows[student.student_nid];
            if (!item || !labels[item.status]) {
                return;
            }
            count += 1;
            var tr = document.createElement("tr");
            [student.student_name, labels[item.status], item.note || ""].forEach(function (value) {
                var cell = document.createElement("td");
                cell.textContent = value;
                tr.appendChild(cell);
            });
            tbody.appendChild(tr);
        });
        if (!count) {
            emptyRow(tbody, 3, "لا غياب ولا تأخر ولا استئذان في السجل المعتمد لهذا اليوم.");
        }
    }

    function paintTasksToday(pane) {
        var iso = api.todayIso();
        paint(pane, "/assets/dashboard/board-calendar.jpg",
            "<div class=\"daily-board\">"
            + "<h1>لوحة المهام اليومية</h1>"
            + "<p class=\"wash-hint\">التعبئة تلقائية من التقويم والخطط والبرامج والتحسين والمتابعات المحفوظة، ثم لك صلاحية التعديل أو الإضافة. لا تبدأ من حقل فارغ.</p>"
            + "<div class=\"daily-stats\" id=\"daily-stats\"></div>"
            + "<div class=\"daily-alerts\" id=\"daily-alerts\"></div>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card board-span\"><h2>مهام اليوم والمتأخرة</h2>"
            + "<div class=\"daily-toolbar\">"
            + "<button type=\"button\" class=\"wash-add\" id=\"daily-refresh\">إعادة التعبئة التلقائية</button>"
            + "<button type=\"button\" class=\"staff-add\" id=\"daily-add\">إضافة مهمة</button>"
            + "<button class=\"wash-back\" type=\"button\">العودة</button>"
            + "</div>"
            + "<p class=\"wash-note\" id=\"daily-note\"></p>"
            + "<div class=\"program-table-wrap\"><table class=\"program-table data-table daily-table\"><thead><tr>"
            + "<th>المهمة</th><th>المصدر</th><th>الاستحقاق</th><th>الشاهد</th><th>الحالة</th><th class=\"is-fit\">تعديل</th>"
            + "</tr></thead><tbody id=\"daily-rows\"></tbody></table></div>"
            + "</section>"
            + "<section class=\"board-card board-span\" id=\"daily-editor\" hidden>"
            + "<h2 id=\"daily-editor-title\">تعديل المهمة</h2>"
            + "<form id=\"daily-form\" class=\"facility-fields\">"
            + "<input type=\"hidden\" name=\"id\" value=\"0\">"
            + "<label class=\"wash-field\"><span>عنوان المهمة</span><input name=\"title\" type=\"text\" required autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>الحالة</span><select name=\"status\"><option>مستحقة</option><option>قيد التنفيذ</option><option>مكتملة</option><option>ملغاة</option></select></label>"
            + "<label class=\"wash-field\"><span>الأولوية</span><select name=\"priority\"><option>عاجل</option><option selected>عادي</option><option>منخفض</option></select></label>"
            + "<label class=\"wash-field\"><span>حالة الشاهد</span><select name=\"evidence_status\"><option>غير مطلوب</option><option>ناقص</option><option>مرفوع</option></select></label>"
            + "<label class=\"wash-field\"><span>تاريخ الاستحقاق (ميلادي)</span><input name=\"due_iso\" type=\"text\" placeholder=\"مثال: 30 أغسطس 2026م\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field wash-span\"><span>صياغة الوصف من البنك</span><select name=\"descriptionPhrase\" aria-label=\"صياغات الوصف\"><option value=\"\">اختر صياغة تربوية</option></select></label>"
            + "<label class=\"wash-field wash-span\"><span>الوصف</span><textarea name=\"description\" rows=\"2\"></textarea></label>"
            + "<label class=\"wash-field wash-span\"><span>صياغة ملاحظة الشاهد من البنك</span><select name=\"evidencePhrase\" aria-label=\"صياغات الشاهد\"><option value=\"\">اختر صياغة شاهد</option></select></label>"
            + "<label class=\"wash-field wash-span\"><span>ملاحظة الشاهد</span><textarea name=\"evidence_note\" rows=\"2\"></textarea></label>"
            + "<div class=\"wash-actions facility-actions\">"
            + "<button class=\"wash-save\" type=\"submit\">حفظ التعديل</button>"
            + "<button class=\"wash-cancel\" type=\"button\" id=\"daily-cancel\">إلغاء</button>"
            + "</div><p class=\"wash-note\"></p></form>"
            + "</section>"
            + "</div></div>");
        var note = pane.querySelector("#daily-note");
        var formNote = pane.querySelector("#daily-form .wash-note");
        var editor = pane.querySelector("#daily-editor");
        var form = pane.querySelector("#daily-form");
        var state = { payload: null, phrases: null };

        function headers() {
            return window.board1059Access ? window.board1059Access.headers() : { "Content-Type": "application/json" };
        }
        function escapeHtml(value) {
            return String(value == null ? "" : value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/"/g, "&quot;");
        }
        function sourceLabel(type) {
            return ({
                standing: "ثابت يومي",
                improvement: "خطة التحسين",
                program: "برنامج",
                follow: "متابعة محفوظة",
                occasion: "مناسبة",
                manual: "يدوي"
            })[type] || type || "";
        }
        function fillPhraseSelect(select, rows, blank) {
            select.innerHTML = "<option value=\"\">" + (blank || "اختر صياغة تربوية") + "</option>"
                + (rows || []).map(function (item) {
                    var text = item.rendered_text || item.template_text || "";
                    return "<option value=\"" + escapeHtml(text) + "\">" + escapeHtml(text) + "</option>";
                }).join("");
        }
        function loadTaskPhrases(task) {
            return fetch("/api/phrase-bank/suggest-task", {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({ task: task || {} })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر قراءة بنك الصياغات");
                    }
                    return payload;
                });
            }).then(function (payload) {
                state.phrases = payload;
                fillPhraseSelect(form.elements.descriptionPhrase, payload.description || [], "اختر صياغة للوصف");
                fillPhraseSelect(form.elements.evidencePhrase, payload.evidence_note || [], "اختر صياغة للشاهد");
                if (!form.elements.description.value && payload.description && payload.description[0]) {
                    form.elements.description.value = payload.description[0].rendered_text || payload.description[0].template_text || "";
                }
                if (!form.elements.evidence_note.value && payload.evidence_note && payload.evidence_note[0]) {
                    form.elements.evidence_note.value = payload.evidence_note[0].rendered_text || payload.evidence_note[0].template_text || "";
                }
                return payload;
            }).catch(function () {
                fillPhraseSelect(form.elements.descriptionPhrase, [], "لا صياغات متاحة بعد");
                fillPhraseSelect(form.elements.evidencePhrase, [], "لا صياغات متاحة بعد");
            });
        }
        function render(payload) {
            state.payload = payload || {};
            var progress = state.payload.progress || {};
            var counts = state.payload.counts || {};
            pane.querySelector("#daily-stats").innerHTML = [
                { label: "مهام اليوم", value: counts.today || 0 },
                { label: "متأخرة", value: counts.overdue || 0 },
                { label: "شواهد ناقصة", value: counts.missing_evidence || 0 },
                { label: "إنجاز الخطة", value: progress.plan_percent == null ? "—" : progress.plan_percent + "%" }
            ].map(function (item) {
                return "<div class=\"daily-stat\"><b>" + escapeHtml(item.value) + "</b><span>" + escapeHtml(item.label) + "</span></div>";
            }).join("");
            pane.querySelector("#daily-alerts").innerHTML = (state.payload.alerts || []).map(function (text) {
                return "<p class=\"daily-alert\">" + escapeHtml(text) + "</p>";
            }).join("");
            var rows = state.payload.tasks || [];
            var body = pane.querySelector("#daily-rows");
            if (!rows.length) {
                body.innerHTML = "<tr><td colspan=\"6\">لا مهام بعد التعبئة. أضف مهمة أو راجع المصادر المحفوظة.</td></tr>";
            } else {
                body.innerHTML = rows.map(function (item) {
                    var badge = item.bucket === "متأخرة" ? "is-late" : (item.evidence_status === "ناقص" ? "is-warn" : "is-ok");
                    var mark = item.is_overridden ? "معدّلة" : (item.is_auto ? "تلقائية" : "يدوية");
                    return "<tr data-id=\"" + item.id + "\">"
                        + "<td class=\"is-name\"><strong>" + escapeHtml(item.title) + "</strong>"
                        + "<small class=\"program-meta\">" + escapeHtml(mark + (item.description ? " — " + item.description : "")) + "</small></td>"
                        + "<td>" + escapeHtml(sourceLabel(item.source_type)) + "</td>"
                        + "<td>" + escapeHtml((typeof formatDisplayDate === "function" ? formatDisplayDate(item.due_iso || item.task_date || "", "gregorian") : (item.due_iso || item.task_date || ""))) + "</td>"
                        + "<td><span class=\"status-chip " + (item.evidence_status === "ناقص" ? "is-draft" : "is-ok") + "\">" + escapeHtml(item.evidence_status) + "</span></td>"
                        + "<td><span class=\"status-chip " + badge + "\">" + escapeHtml(item.status) + (item.bucket === "متأخرة" ? " · متأخرة" : "") + "</span></td>"
                        + "<td class=\"is-fit\"><button type=\"button\" class=\"program-edit\" data-edit=\"" + item.id + "\">تعديل</button></td>"
                        + "</tr>";
                }).join("");
            }
            note.textContent = "آخر تعبئة ليوم " + (typeof formatDisplayDate === "function" ? formatDisplayDate(state.payload.date || iso, "gregorian") : (state.payload.date || iso)) + " — المبدأ: تعبئة تلقائية ثم Override.";
        }
        function load() {
            note.textContent = "جاري التعبئة التلقائية من المصادر المحفوظة…";
            return fetch("/api/daily-tasks/autofill", {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({ date: iso, follows: localFollowPayload() })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر تحميل المهام");
                    }
                    return payload;
                });
            }).then(render).catch(function (error) {
                note.textContent = error.message || "تعذر تحميل لوحة المهام.";
            });
        }
        function openEditor(task) {
            editor.hidden = false;
            pane.querySelector("#daily-editor-title").textContent = task && task.id ? "تعديل المهمة" : "إضافة مهمة";
            form.elements.id.value = task && task.id ? task.id : 0;
            form.elements.title.value = task && task.title ? task.title : "";
            form.elements.status.value = task && task.status ? task.status : "مستحقة";
            form.elements.priority.value = task && task.priority ? task.priority : "عادي";
            form.elements.evidence_status.value = task && task.evidence_status ? task.evidence_status : "غير مطلوب";
            form.elements.due_iso.value = task && (task.due_iso || task.task_date) ? (task.due_iso || task.task_date) : iso;
            form.elements.description.value = task && task.description ? task.description : "";
            form.elements.evidence_note.value = task && task.evidence_note ? task.evidence_note : "";
            formNote.textContent = task && task.is_auto
                ? "مهمة تلقائية: الصياغة من بنك التأسيس، وحفظك يثبت التعديل دون إعادة الكتابة من المحرك."
                : "الحقول تُملأ من بنك الصياغات التربوية، ويمكنك تعديل النص بعد الاختيار.";
            loadTaskPhrases(task || {
                title: form.elements.title.value,
                due_iso: form.elements.due_iso.value,
                task_date: iso,
                source_type: "manual"
            });
            editor.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        form.elements.descriptionPhrase.addEventListener("change", function () {
            if (this.value) {
                form.elements.description.value = this.value;
            }
        });
        form.elements.evidencePhrase.addEventListener("change", function () {
            if (this.value) {
                form.elements.evidence_note.value = this.value;
                if (form.elements.evidence_status.value === "غير مطلوب") {
                    form.elements.evidence_status.value = "ناقص";
                }
            }
        });
        pane.querySelector("#daily-refresh").addEventListener("click", load);
        pane.querySelector("#daily-add").addEventListener("click", function () {
            openEditor(null);
        });
        pane.querySelector("#daily-cancel").addEventListener("click", function () {
            editor.hidden = true;
            formNote.textContent = "";
        });
        pane.querySelector("#daily-rows").addEventListener("click", function (event) {
            var button = event.target.closest("[data-edit]");
            if (!button) {
                return;
            }
            var id = Number(button.getAttribute("data-edit"));
            var found = (state.payload.tasks || []).filter(function (item) { return item.id === id; })[0];
            openEditor(found || { id: id });
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            fetch("/api/daily-tasks", {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({
                    id: Number(form.elements.id.value || 0),
                    title: form.elements.title.value.trim(),
                    status: form.elements.status.value,
                    priority: form.elements.priority.value,
                    evidence_status: form.elements.evidence_status.value,
                    due_iso: form.elements.due_iso.value.trim(),
                    task_date: iso,
                    description: form.elements.description.value.trim(),
                    evidence_note: form.elements.evidence_note.value.trim(),
                    is_overridden: true
                })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر الحفظ");
                    }
                    return payload;
                });
            }).then(function (payload) {
                editor.hidden = true;
                render(payload);
                formNote.textContent = "";
                note.textContent = "حُفظ التعديل. المهام التلقائية غير المعدّلة تبقى تُحدَّث من المصادر.";
                publishSuite("tasks");
            }).catch(function (error) {
                formNote.textContent = error.message || "تعذر الحفظ.";
            });
        });
        load();
    }

    function paintTasksWeek(pane) {
        var start = api.todayIso();
        var end = addDays(start, 7);
        var calendar = api.readStore("board1059.calendar") || {};
        var region = calendar.region || "makkah";
        var year = calendar.year || "1448-1449";
        var events = typeof occasionsFor === "function" ? occasionsFor(year, region) : [];
        paint(pane, "/assets/dashboard/board-calendar.jpg",
            "<h1>مناسبات الأسبوع</h1><p class=\"wash-hint\">من ملف المناسبات المحفوظ، للمنطقة والعام المحفوظين، خلال سبعة أيام من اليوم.</p>"
            + "<div class=\"board-layout\"><section class=\"board-card board-span\"><h2>المناسبات</h2><div id=\"week-list\"></div></section></div>" + backOnly());
        var list = pane.querySelector("#week-list");
        var shown = 0;
        events.forEach(function (item) {
            var open = isoFromGregorianText(item.gregorianStart);
            var close = isoFromGregorianText(item.gregorianEnd || item.gregorianStart);
            if (!open) {
                return;
            }
            if (close < start || open > end) {
                return;
            }
            shown += 1;
            var line = document.createElement("p");
            var hijriLabel = typeof formatDisplayDateRange === "function"
                ? formatDisplayDateRange(item.hijriStart, item.hijriEnd, "hijri")
                : (item.hijriStart + (item.hijriEnd ? " إلى " + item.hijriEnd : ""));
            line.textContent = item.title + " — " + hijriLabel;
            list.appendChild(line);
        });
        if (!shown) {
            var empty = document.createElement("p");
            empty.className = "wash-hint";
            empty.textContent = "لا مناسبة محفوظة خلال الأيام السبعة القادمة.";
            list.appendChild(empty);
        }
    }

    function paintTasksFollow(pane, link) {
        var weekOnly = link && link.getAttribute("data-erp-filter") === "week";
        var start = api.todayIso();
        var end = addDays(start, 7);
        paint(pane, "/assets/dashboard/board-calendar.jpg",
            "<h1>" + (weekOnly ? "متابعات الأسبوع" : "متابعات المجالس والسلوك") + "</h1>"
            + "<p class=\"wash-hint\">تواريخ المتابعة المحفوظة في المجالس والسلوك والتعثر.</p>"
            + "<div class=\"board-layout\"><section class=\"board-card board-span\"><h2>المتابعات</h2><div id=\"follow-list\"></div></section></div>" + backOnly());
        var host = pane.querySelector("#follow-list");
        var shown = 0;
        followUps().forEach(function (item) {
            if (weekOnly && (item.iso < start || item.iso > end)) {
                return;
            }
            shown += 1;
            var line = document.createElement("p");
            var followHijri = item.hijri
                ? (typeof formatDisplayDate === "function" ? formatDisplayDate(item.hijri, "hijri") : item.hijri)
                : (item.iso && typeof hijriFromDate === "function" ? hijriFromDate(item.iso) : (item.iso || ""));
            var followGreg = item.gregorian
                ? (typeof formatDisplayDate === "function" ? formatDisplayDate(item.gregorian, "gregorian") : item.gregorian)
                : "";
            line.textContent = item.kind + " — " + item.title + " — " + followHijri + (followGreg ? " — " + followGreg : "");
            host.appendChild(line);
        });
        if (!shown) {
            var empty = document.createElement("p");
            empty.className = "wash-hint";
            empty.textContent = "لا تاريخ متابعة محفوظ.";
            host.appendChild(empty);
        }
    }

    function paintCommittees(pane, link) {
        var filter = link ? link.getAttribute("data-erp-filter") : "";
        var formation = FORMATIONS.filter(function (item) { return item.id === filter; })[0] || null;
        var meetings = listStore("board1059.councils").filter(function (item) {
            return !formation || item.type === formation.id;
        });
        paint(pane, "/assets/dashboard/board-leadership.jpg",
            "<h1>" + (formation ? formation.label : "اللجان والفرق") + "</h1>"
            + "<p class=\"wash-hint\">الاجتماعات المحفوظة في سجل المجالس. فتح السجل يبقى في شاشته.</p>"
            + "<div class=\"board-layout\"><section class=\"board-card board-span\"><h2>الاجتماعات المحفوظة</h2><div id=\"committee-list\"></div>"
            + "<div class=\"wash-actions facility-actions\"><button type=\"button\" class=\"wash-save\" id=\"committee-open\">فتح سجل المجالس</button><button class=\"wash-back\" type=\"button\">العودة</button></div>"
            + "</section></div>");
        var host = pane.querySelector("#committee-list");
        if (!meetings.length) {
            var empty = document.createElement("p");
            empty.className = "wash-hint";
            empty.textContent = "لا اجتماع محفوظ لهذا التشكيل.";
            host.appendChild(empty);
        }
        meetings.forEach(function (item) {
            var line = document.createElement("div");
            line.className = "witness-scope committee-witness";
            var names = (item.present || []).map(function (person) {
                return person.name || "";
            }).filter(Boolean).join("، ");
            function hidden(label, value) {
                var input = document.createElement("input");
                input.type = "hidden";
                input.setAttribute("data-label", label);
                input.value = value || "";
                line.appendChild(input);
            }
            hidden("نوع المجلس", item.type || "");
            hidden("الموضوع", item.agenda || "");
            var meetHijri = typeof formatDisplayDate === "function" ? formatDisplayDate(item.hijri || "", "hijri") : (item.hijri || "");
            var meetGreg = typeof formatDisplayDate === "function" ? formatDisplayDate(item.gregorian || "", "gregorian") : (item.gregorian || "");
            var followH = typeof formatDisplayDate === "function" ? formatDisplayDate(item.followHijri || "", "hijri") : (item.followHijri || "");
            var followG = typeof formatDisplayDate === "function" ? formatDisplayDate(item.followGregorian || "", "gregorian") : (item.followGregorian || "");
            hidden("تاريخ الاجتماع", [meetHijri, meetGreg].filter(Boolean).join(" — "));
            hidden("المحضر", item.minutes || item.addition || "");
            hidden("الحضور", names);
            hidden("تاريخ المتابعة", [followH, followG].filter(Boolean).join(" — "));
            var text = document.createElement("p");
            text.textContent = meetHijri + " — " + (item.agenda || "");
            var tools = document.createElement("span");
            tools.className = "evidence-tools";
            var witness = document.createElement("input");
            witness.type = "hidden";
            witness.setAttribute("data-label", "الشاهد");
            witness.value = "محضر اجتماع";
            tools.appendChild(witness);
            var edit = document.createElement("button");
            edit.type = "button";
            edit.className = "evidence-edit no-print";
            edit.textContent = "تحرير / معاينة";
            var print = document.createElement("button");
            print.type = "button";
            print.className = "evidence-print no-print";
            print.textContent = "توليد وطباعة";
            tools.appendChild(edit);
            tools.appendChild(print);
            line.appendChild(text);
            line.appendChild(tools);
            host.appendChild(line);
        });
        pane.querySelector("#committee-open").addEventListener("click", function () {
            var target = document.querySelector("[data-erp-board='councils']");
            if (target) {
                target.click();
            }
        });
    }

    function paintPlans(pane, link) {
        var filter = link ? link.getAttribute("data-erp-filter") : "";
        var leadership = api.readStore("board1059.leadership") || {};
        function shown(value) {
            return window.dataHub ? window.dataHub.display(value) : "";
        }
        var activity = api.staffDirectory.filter(function (person) { return person.role === "رائد النشاط"; })[0];
        paint(pane, "/assets/dashboard/board-leadership.jpg",
            "<h1>مقاعد الخطة</h1><p class=\"wash-hint\">الأسماء من التشكيل القيادي وسجل المنسوبين. بنود الخطة التشغيلية تبقى في مولّد الخطط.</p>"
            + "<div class=\"board-layout\" id=\"plan-seats\"></div>" + backOnly());
        var host = pane.querySelector("#plan-seats");
        var seats = [];
        if (!filter || filter === "principal") {
            seats.push(["خطة المدير", shown(leadership.principal) || "لا اسم محفوظ في التشكيل القيادي"]);
        }
        if (!filter || filter === "vice") {
            seats.push(["الوكيل التعليمي", shown(leadership.schoolVice) || shown(leadership.educationalGuide) || "لا اسم محفوظ"]);
            seats.push(["وكيل شؤون الطلاب", shown(leadership.studentsVice) || "لا اسم محفوظ"]);
        }
        if (!filter || filter === "activity") {
            seats.push(["رائد النشاط", activity ? activity.name : "لا رائد نشاط في سجل المنسوبين"]);
        }
        seats.forEach(function (seat) {
            var card = document.createElement("section");
            card.className = "board-card";
            var title = document.createElement("h2");
            title.textContent = seat[0];
            var body = document.createElement("p");
            body.textContent = seat[1];
            card.appendChild(title);
            card.appendChild(body);
            host.appendChild(card);
        });
    }

    function paintIndicators(pane) {
        withEtec(function (framework) {
            paint(pane, "/assets/dashboard/board-calendar.jpg",
                "<h1>إطار هيئة تقويم التعليم</h1><p class=\"wash-hint\" id=\"etec-source\"></p>"
                + "<div class=\"board-layout\" id=\"etec-list\"></div>" + backOnly());
            pane.querySelector("#etec-source").textContent = framework.source || "تعذر قراءة الإطار.";
            var host = pane.querySelector("#etec-list");
            var standards = 0;
            var indicators = 0;
            (framework.domains || []).forEach(function (domain) {
                var card = document.createElement("section");
                card.className = "board-card board-span";
                var title = document.createElement("h2");
                title.textContent = domain.display_name || domain.official_name || "";
                card.appendChild(title);
                (domain.standards || []).forEach(function (standard) {
                    standards += 1;
                    var line = document.createElement("p");
                    var own = (standard.indicators || []).filter(function (item) {
                        return String(item).indexOf("للمدارس الأهلية") === -1;
                    });
                    var privateCount = (standard.indicators || []).length - own.length;
                    indicators += (standard.indicators || []).length;
                    line.textContent = standard.code + " " + standard.name + " — " + own.length + " مؤشرًا"
                        + (privateCount ? "، و" + privateCount + " لا ينطبق على المدرسة الحكومية" : "");
                    card.appendChild(line);
                });
                host.appendChild(card);
            });
            if (!standards) {
                var empty = document.createElement("p");
                empty.className = "wash-hint";
                empty.textContent = "تعذر قراءة الإطار.";
                host.appendChild(empty);
            }
        });
    }

    function paintNafes(pane) {
        var stored = localStorage.getItem("nafesTargetWeek1059");
        paint(pane, "/assets/dashboard/board-calendar.jpg",
            "<h1>بطاقة نافس</h1><p class=\"wash-hint\">النسب من مركز الأداء فقط · بلا اختراع.</p>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card\"><h2>الأسبوع المستهدف</h2><p id=\"nafes-week\"></p></section>"
            + "<section class=\"board-card board-span\"><h2>نسب الإتقان (SSOT)</h2>"
            + "<div class=\"table-scroll\"><table class=\"data-table\" id=\"nafes-ssot-table\"><thead><tr>"
            + "<th>المهارة</th><th>الحالي</th><th>المستهدف</th><th>التغير</th><th>أضعف فرعي</th>"
            + "</tr></thead><tbody></tbody></table></div></section>"
            + "</div>" + backOnly());
        pane.querySelector("#nafes-week").textContent = stored ? "الأسبوع المحفوظ: " + stored : "لم يُحفظ أسبوع مستهدف بعد.";
        var body = pane.querySelector("#nafes-ssot-table tbody");
        if (!body || !window.PerformanceBind) {
            return;
        }
        PerformanceBind.invalidate();
        PerformanceBind.load().then(function (metrics) {
            if (!metrics || !metrics.nafes) {
                body.innerHTML = "<tr><td colspan=\"5\">مركز الأداء غير متاح.</td></tr>";
                return;
            }
            var n = metrics.nafes;
            function row(label, item) {
                if (!item) return "";
                var weak = item.weakest_subskill
                    ? item.weakest_subskill.name + " " + item.weakest_subskill.score + "%"
                    : "—";
                var delta = item.delta_points != null ? item.delta_points : "—";
                return "<tr><td>" + label + "</td><td>" + item.score + "%</td><td>"
                    + (item.target != null ? item.target + "%" : "—") + "</td><td>"
                    + delta + "</td><td>" + weak + "</td></tr>";
            }
            body.innerHTML = row("القراءة", n.reading) + row("الرياضيات", n.math) + row("العلوم", n.science);
        });
    }

    function paintProgress(pane) {
        var rows = collectSignals();
        var suggested = Object.keys(rows).filter(function (id) { return rows[id].suggested; }).length;
        var lines = [
            ["سجلات غياب معتمدة", Object.keys(api.readStore("board1059.studentAbsence") || {}).length],
            ["اجتماعات المجالس", listStore("board1059.councils").length],
            ["الزيارات", listStore("board1059.visits").length],
            ["قيود السلوك", listStore("board1059.behavior").length],
            ["كشوف الدرجات", listStore("board1059.grades").length],
            ["متابعات التعثر", listStore("board1059.support").length],
            ["طلاب مقترحون للمتابعة", suggested],
            ["تحضيرات الدروس", listStore("board1059.preparations").length]
        ];
        paint(pane, "/assets/dashboard/board-calendar.jpg",
            "<h1>ما أُنجز في السجلات</h1><p class=\"wash-hint\">أعداد القيود المحفوظة، وتُعاد بعد كل حفظ.</p>"
            + "<div class=\"board-layout\" id=\"progress-list\"></div>" + backOnly());
        var host = pane.querySelector("#progress-list");
        lines.forEach(function (line) {
            var card = document.createElement("section");
            card.className = "board-card";
            var title = document.createElement("h2");
            title.textContent = line[0];
            var body = document.createElement("p");
            body.textContent = String(line[1]);
            card.appendChild(title);
            card.appendChild(body);
            host.appendChild(card);
        });
    }

    function parkNode(node) {
        if (!node || node._parkHome) {
            return;
        }
        node._parkHome = node.parentNode;
        node._parkNext = node.nextSibling;
        node._parkHidden = node.hidden;
    }

    function syncOperationalBook() {
        var schoolNode = document.getElementById("command-school-name");
        var schoolName = schoolNode ? schoolNode.textContent.trim() : "";
        var leadership = api.readStore("board1059.leadership") || {};
        function shown(value) {
            return window.dataHub ? window.dataHub.display(value) : "";
        }
        var calendar = api.readStore("board1059.calendar") || {};
        var facility = api.readStore("board1059.facility") || {};
        var year = calendar.year ? String(calendar.year).replace(/هـ/g, "") : "";
        if (year) {
            var yearNode = document.getElementById("cover-year");
            if (yearNode) {
                yearNode.textContent = "للعام الدراسي " + year + "هـ";
            }
            var stripe = document.getElementById("cover-stripe-text");
            var kindNode = document.getElementById("cover-plan-kind");
            if (stripe) {
                stripe.textContent = "الخطة " + (kindNode && kindNode.textContent ? kindNode.textContent : "التشغيلية") + " " + year + "هـ";
            }
        }
        if (schoolName) {
            Array.prototype.forEach.call(document.querySelectorAll("#booklet .school-name"), function (node) {
                node.textContent = schoolName;
            });
            var coverSchool = document.getElementById("cover-school-name");
            if (coverSchool) {
                coverSchool.textContent = "لمدرسة " + schoolName.replace(/^متوسطة\s*/, "");
            }
            var profileName = document.getElementById("profile-name");
            if (profileName) {
                profileName.textContent = schoolName;
            }
        }
        var principalShown = shown(leadership.principal);
        if (principalShown) {
            var author = document.getElementById("cover-author");
            if (author) {
                author.textContent = "إعداد: مدير المدرسة / " + principalShown;
            }
            var principalSign = document.getElementById("sign-principal");
            if (principalSign) {
                principalSign.textContent = principalShown;
            }
            var introSign = document.getElementById("intro-sign");
            if (introSign) {
                introSign.textContent = principalShown + " / مدير " + (schoolName || "المدرسة");
            }
        }
        var schoolViceShown = shown(leadership.schoolVice);
        if (schoolViceShown) {
            var academicSign = document.getElementById("sign-academic");
            if (academicSign) {
                academicSign.textContent = schoolViceShown;
            }
        }
        var studentsViceShown = shown(leadership.studentsVice);
        if (studentsViceShown) {
            var studentsSign = document.getElementById("sign-students");
            if (studentsSign) {
                studentsSign.textContent = studentsViceShown;
            }
        }
        if (window.__bookletContent && typeof fillBookletFromContent === "function") {
            fillBookletFromContent(window.__bookletContent);
        }
        if (typeof applyBookletLeadership === "function") {
            applyBookletLeadership();
        }
        function put(id, value) {
            if (!value) {
                return;
            }
            var node = document.getElementById(id);
            if (node) {
                node.textContent = value;
            }
        }
        put("profile-building", facility.buildingType);
        put("profile-classrooms", facility.classroomCount);
        put("profile-labs", facility.labCount);
        if (typeof loadStudents === "function" && loadStudents().length) {
            put("profile-students", String(loadStudents().length));
        }
    }

    function readPrincipalItems() {
        var items = [];
        Array.prototype.forEach.call(document.querySelectorAll("#exec-rows tr"), function (row) {
            var inputs = row.querySelectorAll("select.cell-input");
            if (!inputs.length || !inputs[0].value) {
                return;
            }
            items.push({
                title: inputs[0].value,
                execution_time: inputs[1] ? inputs[1].value : "",
                execution_method: inputs[2] ? inputs[2].value : "",
                evidence: inputs[3] ? inputs[3].value : "",
                shared_with: row.dataset.sharedWith || ""
            });
        });
        return items;
    }

    function wordsOf(text) {
        return String(text || "").split(/\s+/).filter(function (word) {
            return word.length > 3 && word !== "المدرسة" && word !== "المدرسي" && word !== "المتعلمين";
        });
    }

    function fillOperationalPrograms() {
        var host = document.getElementById("booklet-programs");
        if (!host) {
            return;
        }
        host.innerHTML = "";
        function draw(framework, scores, items) {
            var executorNode = document.getElementById("executor-name");
            var executor = executorNode && executorNode.textContent.trim() ? executorNode.textContent.trim() : "";
            var buckets = {};
            (framework.domains || []).forEach(function (domain) {
                (domain.standards || []).forEach(function (standard) {
                    buckets[standard.code] = [];
                });
            });
            items.forEach(function (item) {
                var bestCode = "1-1";
                var best = 0;
                (framework.domains || []).forEach(function (domain) {
                    (domain.standards || []).forEach(function (standard) {
                        var hay = (standard.indicators || []).join(" ");
                        var score = 0;
                        wordsOf(item.title).forEach(function (word) {
                            if (hay.indexOf(word) !== -1) {
                                score += 1;
                            }
                        });
                        if (score > best) {
                            best = score;
                            bestCode = standard.code;
                        }
                    });
                });
                if (!buckets[bestCode]) {
                    buckets[bestCode] = [];
                }
                buckets[bestCode].push(item);
            });
            var html = "";
            (framework.domains || []).forEach(function (domain) {
                (domain.standards || []).forEach(function (standard) {
                    var indicators = (standard.indicators || []).filter(function (line) {
                        return line.indexOf("للمدارس الأهلية") === -1;
                    });
                    if (!indicators.length) {
                        return;
                    }
                    var head = standard.code + " " + standard.name;
                    html += "<section class=\"op-block\"><h3 class=\"op-band\">الإطار العام — " + head + "</h3>";
                    html += "<table class=\"op-table data-table\"><thead><tr>"
                        + "<th>المعيار</th><th>الرمز</th><th>المؤشرات</th><th>درجة المؤشر الحالية</th>"
                        + "<th>الهدف التحسيني</th><th>المستهدفون</th><th>المستوى الحالي</th><th>المستوى المستهدف</th>"
                        + "</tr></thead><tbody>";
                    indicators.forEach(function (line) {
                        var parts = line.split(" ");
                        var code = parts.shift();
                        var saved = scores[code] || {};
                        html += "<tr><td>" + standard.name + "</td><td>" + code + "</td><td>" + parts.join(" ")
                            + "</td><td>" + (saved.baseline || "") + "</td><td>" + (saved.goal || "")
                            + "</td><td></td><td>" + (saved.baseline || "") + "</td><td>" + (saved.target || "") + "</td></tr>";
                    });
                    html += "</tbody></table>";
                    html += "<h3 class=\"op-band op-band-exec\">الإطار التنفيذي — " + head + "</h3>";
                    html += "<table class=\"op-table data-table\"><thead><tr>"
                        + "<th>م</th><th>الأهداف التفصيلية</th><th>العمليات والبرامج والأنشطة والمبادرات</th>"
                        + "<th>وقت التنفيذ</th><th>المنفذ</th><th>المساند الداخلي</th><th>المساند الخارجي</th><th>مؤشر الإنجاز</th>"
                        + "</tr></thead><tbody>";
                    var rows = buckets[standard.code] || [];
                    if (!rows.length) {
                        html += "<tr><td colspan=\"8\" class=\"op-empty\">لا بند في خطة المدير مرتبط بهذا المعيار.</td></tr>";
                    }
                    rows.forEach(function (item, index) {
                        html += "<tr><td>" + (index + 1) + "</td><td>" + (item.execution_method || "")
                            + "</td><td>" + item.title + "</td><td>" + (item.execution_time || "")
                            + "</td><td>" + executor + "</td><td>" + (item.shared_with || "")
                            + "</td><td></td><td>" + (item.evidence || "") + "</td></tr>";
                    });
                    html += "</tbody></table></section>";
                });
            });
            if (!html) {
                html = "<p class=\"op-empty\">إطار الهيئة غير متاح.</p>";
            }
            host.innerHTML = "<div class=\"table-scroll\">" + html + "</div>";
        }
        var items = readPrincipalItems();
        function withItems(done) {
            if (items.length) {
                done(items);
                return;
            }
            fetch("/api/get-plan-items?role=principal")
                .then(function (response) {
                    return response.ok ? response.json() : { items: [] };
                })
                .then(function (payload) {
                    done((payload && payload.items) || []);
                })
                .catch(function () {
                    done([]);
                });
        }
        withItems(function (planItems) {
            withEtec(function (framework) {
                fetch("/banks/master_knowledge_matrix.json")
                    .then(function (response) {
                        return response.ok ? response.json() : {};
                    })
                    .then(function (matrix) {
                        var scores = {};
                        var goals = ((((matrix || {}).master_knowledge_matrix || {}).axis_1_plan_separation || {}).operational_plan || {}).strategic_goals_1448 || [];
                        goals.forEach(function (goal) {
                            var codes = [];
                            if (goal.linked_indicator) {
                                codes.push(goal.linked_indicator);
                            }
                            (goal.linked_indicators || []).forEach(function (code) {
                                codes.push(code);
                            });
                            codes.forEach(function (code) {
                                scores[code] = {
                                    baseline: goal.baseline || "",
                                    target: goal.target || "",
                                    goal: goal.goal || ""
                                };
                            });
                        });
                        draw(framework, scores, planItems);
                    })
                    .catch(function () {
                        draw(framework, {}, planItems);
                    });
            });
        });
    }

    function paintPlanDeck(pane) {
        pane.classList.add("is-board", "is-deck");
        document.body.classList.add("deck-open");
        if (window.mountSlideDeck) {
            window.mountSlideDeck(pane);
        }
    }

    function paintPlanBook(pane) {
        pane.classList.add("is-board", "is-booklet");
        pane.innerHTML = api.washMarkup(
            "/assets/dashboard/board-leadership.jpg",
            "wash-board-sheet wash-facility",
            "<h1>الخطة التشغيلية</h1>"
            + "<p class=\"wash-hint\">الغلاف ثم البسملة ثم صفحات الكتيب. الأسماء والعام من المحفوظ، والطباعة تُخرج الكتيب.</p>"
            + "<div class=\"plan-book-bar\"><button type=\"button\" class=\"wash-print\" id=\"plan-book-print\">طباعة الكتيب</button></div>"
            + "<div id=\"plan-book-host\"></div>"
            + backOnly()
        );
        var booklet = document.getElementById("booklet");
        var host = pane.querySelector("#plan-book-host");
        if (!booklet || !host) {
            return;
        }
        parkNode(booklet);
        host.appendChild(booklet);
        syncOperationalBook();
        fillOperationalPrograms();
        pane.querySelector("#plan-book-print").addEventListener("click", function () {
            if (window.openPrintPreview) {
                window.openPrintPreview("print-book");
            }
        });
    }

    function paintPlanExec(pane) {
        pane.classList.add("is-board", "is-plan-exec");
        pane.innerHTML = api.washMarkup(
            "/assets/dashboard/board-calendar.jpg",
            "wash-board-sheet wash-facility",
            "<h1>الخطة التنفيذية</h1>"
            + "<p class=\"wash-hint\">البنود من محرك الخطط. متابعة التنفيذ في لوحتها المستقلة.</p>"
            + "<div id=\"plan-exec-host\"></div>"
            + backOnly()
        );
        var host = pane.querySelector("#plan-exec-host");
        var formCard = document.getElementById("plan-generator");
        var results = document.getElementById("results");
        parkNode(formCard);
        parkNode(results);
        if (formCard) {
            var genTitle = formCard.querySelector(".card-header h2");
            if (genTitle && !genTitle.getAttribute("data-plan-title")) {
                genTitle.setAttribute("data-plan-title", genTitle.textContent);
            }
            if (genTitle) {
                genTitle.textContent = "معطيات الخطة";
            }
            formCard.classList.add("board-card", "board-span");
            host.appendChild(formCard);
        }
        if (results) {
            var save = document.getElementById("btn-save-plan");
            if (save && !save.getAttribute("data-plan-label")) {
                save.setAttribute("data-plan-label", save.textContent);
            }
            if (save) {
                save.textContent = "حفظ التعديلات";
            }
            results.hidden = false;
            results.classList.add("board-card", "board-span");
            host.appendChild(results);
        }
        var submit = formCard ? formCard.querySelector("button[type='submit']") : null;
        if (submit) {
            submit.type = "button";
        }
    }

    function paintPlanFollow(pane) {
        pane.classList.add("is-board", "is-plan-follow");
        pane.innerHTML = api.washMarkup(
            "/assets/dashboard/board-calendar.jpg",
            "wash-board-sheet wash-facility",
            "<h1>متابعة التنفيذ (تقييم ذاتي)</h1>"
            + "<p class=\"wash-hint\">أسابيع التنفيذ من بنود خطة المدير. التأشير هنا لا يغيّر نص البند.</p>"
            + "<div id=\"plan-follow-host\"></div>"
            + backOnly()
        );
        var host = pane.querySelector("#plan-follow-host");
        var results = document.getElementById("results");
        var title = document.querySelector(".matrix-title");
        var wrap = document.querySelector(".matrix-wrap");
        if (!host || !results || !title || !wrap) {
            return;
        }
        var card = document.createElement("section");
        card.id = "plan-follow-card";
        card.className = "board-card board-span";
        card.appendChild(title);
        card.appendChild(wrap);
        host.appendChild(card);
    }

    function paintSoftPeriods(pane, link) {
        var weekFocus = link && link.getAttribute("data-erp-filter") === "week";
        paint(pane, "/assets/dashboard/board-calendar.jpg",
            "<div class=\"soft-periods-board\">"
            + "<h1>الفترات اللاصفية</h1>"
            + "<p class=\"wash-hint\">بطاقة يوم واحدة للفترات الثلاث (اصطفاف، استراحة، صلاة). البيانات تبقى ثلاث صفوف في القاعدة، والشاهد من <b>visual_evidence</b> فقط.</p>"
            + "<div class=\"daily-stats\" id=\"soft-stats\"></div>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card board-span\" id=\"soft-plan-card\"" + (weekFocus ? " hidden" : "") + ">"
            + "<h2>الخطة الزمنية اليومية</h2>"
            + "<p class=\"wash-note\" id=\"soft-plan-note\"></p>"
            + "<div class=\"program-table-wrap\"><table class=\"program-table data-table\"><thead><tr>"
            + "<th>الفترة</th><th>المدة</th><th>التوقيت</th><th>المهارة المستهدفة</th><th class=\"is-fit\">تعديل</th>"
            + "</tr></thead><tbody id=\"soft-plan-rows\"></tbody></table></div>"
            + "</section>"
            + "<section class=\"board-card board-span soft-day-board\">"
            + "<h2>متابعة اليوم</h2>"
            + "<div class=\"soft-week-strip\" id=\"soft-week-picker\">"
            + "<div class=\"soft-week-strip-top\">"
            + "<label class=\"soft-term-field\"><span>الفصل</span>"
            + "<select id=\"soft-term-filter\" aria-label=\"الفصل الدراسي\">"
            + "<option value=\"all\">كل الأسابيع</option>"
            + "<option value=\"1\">الفصل الأول</option>"
            + "<option value=\"2\">الفصل الثاني</option>"
            + "</select></label>"
            + "<div class=\"soft-week-mid\">"
            + "<div class=\"soft-week-mid-row\">"
            + "<select id=\"soft-week-select\" class=\"soft-week-select\" aria-label=\"اختيار الأسبوع\"></select>"
            + "<button type=\"button\" class=\"soft-cal-toggle\" id=\"soft-cal-toggle\" aria-pressed=\"true\" title=\"تبديل التقويم\">هـ</button>"
            + "</div>"
            + "<span class=\"soft-week-range\" id=\"soft-week-range\"></span>"
            + "</div>"
            + "<button type=\"button\" class=\"wash-save\" id=\"soft-week-today\">اليوم</button>"
            + "</div>"
            + "<div class=\"soft-week-strip-row\" aria-label=\"شريط أيام الأسبوع\">"
            + "<button type=\"button\" class=\"soft-week-nav\" id=\"soft-week-prev\" aria-label=\"الأسبوع السابق\">‹</button>"
            + "<div class=\"soft-day-strip\" id=\"soft-day-chips\"></div>"
            + "<button type=\"button\" class=\"soft-week-nav\" id=\"soft-week-next\" aria-label=\"الأسبوع التالي\">›</button>"
            + "</div>"
            + "<p class=\"soft-dot-legend\" aria-hidden=\"true\">"
            + "<span class=\"soft-dot is-ready\"></span> منفّذ+شاهد"
            + "<span class=\"soft-dot is-warn\"></span> منفّذ بلا شاهد"
            + "<span class=\"soft-dot is-muted\"></span> لم يُحدَّث"
            + "</p>"
            + "</div>"
            + "<div class=\"daily-toolbar soft-day-toolbar\">"
            + "<button type=\"button\" class=\"wash-save\" id=\"soft-day-save\">حفظ اليوم</button>"
            + "<button type=\"button\" class=\"wash-add\" id=\"soft-day-preview\">معاينة</button>"
            + "<button type=\"button\" class=\"wash-save\" id=\"soft-day-print\">طباعة</button>"
            + "<button type=\"button\" class=\"wash-add\" id=\"soft-day-fill\">تعبئة اليوم</button>"
            + "<button type=\"button\" class=\"wash-add\" id=\"soft-refresh\">تحديث</button>"
            + "<button class=\"wash-back\" type=\"button\">العودة</button>"
            + "</div>"
            + "<p class=\"wash-note\" id=\"soft-follow-note\"></p>"
            + "<article class=\"soft-day-card\" id=\"soft-day-card\">"
            + "<header class=\"soft-day-card-head\" id=\"soft-day-card-head\"></header>"
            + "<div class=\"program-table-wrap\"><table class=\"program-table data-table soft-day-table\"><thead><tr>"
            + "<th>الفترة</th><th>التنفيذ</th><th>الشاهد</th><th>المرفق</th><th>ملاحظة</th>"
            + "</tr></thead><tbody id=\"soft-day-rows\"></tbody></table></div>"
            + "<div class=\"soft-day-tools\" id=\"soft-day-tools\">"
            + "<div class=\"soft-upload-menu\">"
            + "<button type=\"button\" class=\"wash-save\" id=\"soft-upload-toggle\" data-soft-upload-toggle>رفع شاهد ▾</button>"
            + "<div class=\"soft-upload-panel\" id=\"soft-upload-panel\" hidden>"
            + "<button type=\"button\" data-soft-upload=\"file\">ملف</button>"
            + "<button type=\"button\" data-soft-upload=\"camera\">كاميرا</button>"
            + "<button type=\"button\" data-soft-upload=\"link\">رابط</button>"
            + "</div></div>"
            + "<span class=\"soft-upload-hint\" id=\"soft-upload-hint\">اختر صف فترة ثم ارفع الشاهد.</span>"
            + "<div class=\"ve-link-row soft-day-link-row\" id=\"soft-link-row\" hidden>"
            + "<input type=\"url\" id=\"soft-link-url\" placeholder=\"https://...\" autocomplete=\"off\">"
            + "<input type=\"text\" id=\"soft-link-name\" placeholder=\"اسم الرابط (اختياري)\" autocomplete=\"off\">"
            + "<button type=\"button\" class=\"wash-save\" id=\"soft-link-save\">حفظ الرابط</button>"
            + "</div>"
            + "<input type=\"file\" id=\"soft-file-input\" accept=\"image/*,video/mp4,video/webm,application/pdf\" multiple hidden>"
            + "<input type=\"file\" id=\"soft-camera-input\" accept=\"image/*\" capture=\"environment\" hidden>"
            + "</div>"
            + "</article>"
            + "<div class=\"soft-fill-defaults no-print\">"
            + "<label class=\"soft-fill-field\"><span>حالة التعبئة</span><select id=\"soft-fill-status\">"
            + "<option value=\"منفّذ\" selected>منفّذ</option><option value=\"جزئي\">جزئي</option>"
            + "<option value=\"لم يُنفّذ\">لم يُنفّذ</option><option value=\"إجازة\">إجازة</option></select></label>"
            + "<label class=\"soft-fill-field\"><span>توثيق التعبئة</span><select id=\"soft-fill-evidence\">"
            + "<option value=\"غير مطلوب\">غير مطلوب</option><option value=\"ناقص\">ناقص</option>"
            + "<option value=\"مرفوع\" selected>مرفوع</option></select></label>"
            + "</div>"
            + "</section>"
            + "<section class=\"board-card board-span\" id=\"soft-editor\" hidden>"
            + "<h2 id=\"soft-editor-title\">تعديل الفترة</h2>"
            + "<form id=\"soft-slot-form\" class=\"facility-fields\">"
            + "<input type=\"hidden\" name=\"slot_code\" value=\"\">"
            + "<label class=\"wash-field\"><span>عنوان الفترة</span><input name=\"title\" type=\"text\" required autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>المدة (دقائق)</span><input name=\"minutes\" type=\"number\" min=\"1\" max=\"120\" required></label>"
            + "<label class=\"wash-field\"><span>التوقيت الإرشادي</span><input name=\"time_hint\" type=\"text\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field wash-span\"><span>المهارة المستهدفة</span><textarea name=\"skill_focus\" rows=\"2\"></textarea></label>"
            + "<div class=\"wash-actions facility-actions\">"
            + "<button class=\"wash-save\" type=\"submit\">حفظ التعديل</button>"
            + "<button class=\"wash-cancel\" type=\"button\" id=\"soft-cancel\">إلغاء</button>"
            + "</div><p class=\"wash-note\"></p></form>"
            + "</section>"
            + "</div></div>");

        var planNote = pane.querySelector("#soft-plan-note");
        var followNote = pane.querySelector("#soft-follow-note");
        var editor = pane.querySelector("#soft-editor");
        var form = pane.querySelector("#soft-slot-form");
        var formNote = form.querySelector(".wash-note");
        var state = {
            bundle: null,
            selectedWeekStart: "",
            selectedDayIso: "",
            selectedSlot: "",
            termFilter: "all",
            calendarMode: "hijri",
            loadSeq: 0,
            weeks: []
        };

        function headers() {
            return window.board1059Access ? window.board1059Access.headers() : { "Content-Type": "application/json" };
        }
        function escapeHtml(value) {
            return String(value == null ? "" : value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\"/g, "&quot;");
        }
        function roleLabel(code) {
            var map = {
                vice_students: "وكيل شؤون الطلاب",
                activity_leader: "رائد النشاط",
                principal: "مدير المدرسة"
            };
            return map[code] || code || "";
        }
        function todayKey() {
            return api.todayIso ? api.todayIso() : new Date().toISOString().slice(0, 10);
        }
        function sundayOf(iso) {
            var parts = String(iso || "").split("-");
            if (parts.length !== 3) {
                return todayKey();
            }
            var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
            d.setDate(d.getDate() - d.getDay());
            return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        }
        function addDaysIso(iso, days) {
            var parts = String(iso || "").split("-");
            var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
            d.setDate(d.getDate() + days);
            return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        }
        function formatShort(iso) {
            if (!iso) {
                return "";
            }
            if (state.calendarMode === "hijri") {
                if (typeof hijriParts === "function" && typeof pad2 === "function") {
                    var hp = hijriParts(iso);
                    return pad2(hp.day) + " / " + pad2(hp.month) + " / " + hp.year + " هـ";
                }
                if (typeof hijriFromDate === "function") {
                    return hijriFromDate(iso);
                }
            }
            if (typeof gregorianFromDate === "function") {
                return gregorianFromDate(iso);
            }
            if (typeof formatDisplayDate === "function") {
                return formatDisplayDate(iso, "gregorian");
            }
            return iso;
        }
        function syncCalToggle() {
            var btn = pane.querySelector("#soft-cal-toggle");
            if (!btn) {
                return;
            }
            var hijri = state.calendarMode === "hijri";
            btn.textContent = hijri ? "هـ" : "م";
            btn.setAttribute("aria-pressed", hijri ? "true" : "false");
            btn.title = hijri ? "عرض التاريخ الميلادي" : "عرض التاريخ الهجري";
        }
        function updateWeekNavBounds() {
            var prev = pane.querySelector("#soft-week-prev");
            var next = pane.querySelector("#soft-week-next");
            var filtered = state.weeks.filter(weekInTerm);
            var meta = currentWeekMeta();
            var num = Number(meta.number) || 0;
            var minNum = filtered.length ? Number(filtered[0].number) : 1;
            var maxNum = filtered.length ? Number(filtered[filtered.length - 1].number) : weekCountLimit();
            if (prev) {
                prev.disabled = !filtered.length || num <= minNum;
            }
            if (next) {
                next.disabled = !filtered.length || num >= maxNum;
            }
        }
        function calendarTextToIso(hijriText, gregorianText) {
            var iso = "";
            if (typeof isoFromGregorianText === "function") {
                iso = isoFromGregorianText(gregorianText || "") || "";
            }
            if (!iso && typeof isoFromHijriText === "function") {
                iso = isoFromHijriText(hijriText || "") || "";
            }
            return iso;
        }
        function approvedCalendarAnchors() {
            var cal = api.readStore("board1059.calendar") || {};
            var startIso = calendarTextToIso(cal.startHijri, cal.startGregorian);
            var examIso = calendarTextToIso(cal.examHijri, cal.examGregorian);
            if ((!startIso || !examIso) && typeof occasionAnchors === "function") {
                var anchors = occasionAnchors(cal.region || "makkah");
                if (!startIso && anchors.yearStart) {
                    startIso = calendarTextToIso(anchors.yearStart.hijriStart, anchors.yearStart.gregorianStart);
                }
                if (!examIso && anchors.examStart) {
                    examIso = calendarTextToIso(anchors.examStart.hijriStart, anchors.examStart.gregorianStart);
                }
            }
            return { startIso: startIso, examIso: examIso, region: cal.region || "makkah" };
        }
        function weekNumberBetween(startSunday, targetIso) {
            if (!startSunday || !targetIso) {
                return 0;
            }
            var targetSunday = sundayOf(targetIso);
            var a = String(startSunday).split("-");
            var b = String(targetSunday).split("-");
            if (a.length !== 3 || b.length !== 3) {
                return 0;
            }
            var startDate = new Date(Number(a[0]), Number(a[1]) - 1, Number(a[2]), 12, 0, 0);
            var targetDate = new Date(Number(b[0]), Number(b[1]) - 1, Number(b[2]), 12, 0, 0);
            var days = Math.round((targetDate.getTime() - startDate.getTime()) / 86400000);
            if (days < 0) {
                return 0;
            }
            return Math.floor(days / 7) + 1;
        }
        function yearStartIso() {
            var anchors = approvedCalendarAnchors();
            if (anchors.startIso) {
                return sundayOf(anchors.startIso);
            }
            var start = "2026-08-30";
            if (window.academicCalendarData && window.academicCalendarData.length) {
                var hit = window.academicCalendarData.filter(function (item) {
                    return String(item.title || "").indexOf("بداية العام") >= 0 && String(item.year || "").indexOf("1448") >= 0;
                })[0] || window.academicCalendarData.filter(function (item) {
                    return String(item.title || "").indexOf("بداية العام") >= 0;
                })[0];
                if (hit && hit.gregorian) {
                    var bits = String(hit.gregorian).split("/");
                    if (bits.length === 3) {
                        start = bits[2] + "-" + bits[1].padStart(2, "0") + "-" + bits[0].padStart(2, "0");
                    }
                }
            }
            return sundayOf(start);
        }
        function weekCountLimit() {
            var anchors = approvedCalendarAnchors();
            var start = yearStartIso();
            if (anchors.examIso) {
                var fromCalendar = weekNumberBetween(start, anchors.examIso);
                if (fromCalendar >= 1 && fromCalendar <= 24) {
                    return fromCalendar;
                }
            }
            if (typeof weekCount === "function") {
                return weekCount();
            }
            if (typeof termWeekCount === "number" && termWeekCount >= 10) {
                return termWeekCount;
            }
            return 18;
        }
        function buildWeeks() {
            var anchors = approvedCalendarAnchors();
            var start = yearStartIso();
            var total = weekCountLimit();
            var examWeekStart = anchors.examIso ? sundayOf(anchors.examIso) : "";
            var list = [];
            var i;
            for (i = 0; i < total; i += 1) {
                var ws = addDaysIso(start, i * 7);
                var we = addDaysIso(ws, 4);
                var isExam = Boolean(examWeekStart && ws === examWeekStart);
                list.push({
                    number: i + 1,
                    weekStart: ws,
                    weekEnd: we,
                    term: i < Math.ceil(total / 2) ? "1" : "2",
                    isExam: isExam
                });
            }
            if (typeof termWeekCount === "number") {
                termWeekCount = total;
            }
            return list;
        }
        function refreshWeeksFromCalendar() {
            var previous = state.selectedWeekStart;
            var previousDay = state.selectedDayIso;
            state.weeks = buildWeeks();
            var still = state.weeks.filter(function (week) {
                return week.weekStart === previous;
            })[0];
            if (still) {
                loadWeek(previous, previousDay);
                return;
            }
            var last = state.weeks[state.weeks.length - 1];
            loadWeek(last ? last.weekStart : yearStartIso(), previousDay);
        }
        function statusOptions(selected) {
            return ["منفّذ", "جزئي", "لم يُنفّذ", "إجازة"].map(function (status) {
                return "<option value=\"" + status + "\"" + (selected === status ? " selected" : "") + ">" + status + "</option>";
            }).join("");
        }
        function evidenceOptions(selected) {
            return ["غير مطلوب", "ناقص", "مرفوع"].map(function (status) {
                return "<option value=\"" + status + "\"" + (selected === status ? " selected" : "") + ">" + status + "</option>";
            }).join("");
        }
        function softEvidenceText(item) {
            var saved = String(item.evidence_note || "").trim();
            if (saved) {
                return saved;
            }
            if (item.evidence_status !== "مرفوع" && item.evidence_status !== "ناقص") {
                return "";
            }
            var dayText = formatShort(item.day_iso);
            return "بطاقة شاهد: " + (item.title || "الفترة اللاصفية") + (dayText ? " — " + dayText : "");
        }
        function softRecordNo(item) {
            if (item && item.id) {
                return "SOFT-" + item.id;
            }
            if (item && item.day_iso && item.slot_code) {
                return "SOFT-" + item.day_iso + "-" + item.slot_code;
            }
            return "";
        }
        function visualItemsOnly(item) {
            var raw = (item && item.evidence_media && item.evidence_media.items)
                ? item.evidence_media.items
                : [];
            return (window.board1059VisualEvidence
                ? window.board1059VisualEvidence.parseItems(raw)
                : raw).filter(function (entry) {
                return entry && Number(entry.id || 0) > 0;
            });
        }
        function mediaThumbsHtml(items) {
            var list = visualItemsOnly({ evidence_media: { items: items } });
            if (!list.length) {
                return "<span class=\"soft-day-empty-media\">—</span>";
            }
            return "<div class=\"soft-day-thumbs\">" + list.map(function (item) {
                var id = Number(item.id || 0);
                var inner = item.kind === "image"
                    ? "<img src=\"" + escapeHtml(item.url) + "\" alt=\"\">"
                    : "<span class=\"soft-day-file-kind\">" + escapeHtml(item.kind || "ملف") + "</span>";
                return "<figure class=\"soft-day-thumb\" data-ve-id=\"" + id + "\">"
                    + inner
                    + "<button type=\"button\" class=\"soft-day-thumb-del\" data-ve-remove=\"" + id + "\" title=\"حذف\">×</button>"
                    + "</figure>";
            }).join("") + "</div>";
        }
        function dayRows(dayIso) {
            var order = { lineup: 1, break: 2, prayer: 3 };
            return ((state.bundle && state.bundle.follow && state.bundle.follow.rows) || [])
                .filter(function (item) { return item.day_iso === dayIso; })
                .slice()
                .sort(function (a, b) {
                    return (order[a.slot_code] || 9) - (order[b.slot_code] || 9);
                });
        }
        function pickDefaultDay(follow) {
            var today = todayKey();
            var days = (follow && follow.days) || [];
            var i;
            for (i = 0; i < days.length; i += 1) {
                if (days[i].day_iso === today) {
                    return today;
                }
            }
            return days[0] ? days[0].day_iso : "";
        }
        function slotDotClass(item) {
            if (!item) {
                return "is-muted";
            }
            var media = visualItemsOnly(item);
            if (item.status === "منفّذ" && (item.evidence_status === "مرفوع" || media.length)) {
                return "is-ready";
            }
            if (item.status === "منفّذ" || item.status === "إجازة") {
                return "is-warn";
            }
            return "is-muted";
        }
        function currentWeekMeta() {
            var found = state.weeks.filter(function (week) {
                return week.weekStart === state.selectedWeekStart;
            })[0];
            if (found) {
                return found;
            }
            return {
                number: "—",
                weekStart: state.selectedWeekStart,
                weekEnd: addDaysIso(state.selectedWeekStart, 4),
                term: "all",
                isExam: false
            };
        }
        function weekInTerm(week) {
            return state.termFilter === "all" || week.term === state.termFilter;
        }
        function shiftWeek(delta) {
            var filtered = state.weeks.filter(weekInTerm);
            if (!filtered.length) {
                updateWeekNavBounds();
                return;
            }
            var meta = currentWeekMeta();
            var currentNum = Number(meta.number) || 0;
            var index = -1;
            var i;
            for (i = 0; i < filtered.length; i += 1) {
                if (filtered[i].weekStart === state.selectedWeekStart || Number(filtered[i].number) === currentNum) {
                    index = i;
                    break;
                }
            }
            if (index < 0) {
                index = 0;
            }
            var nextIndex = index + delta;
            if (nextIndex < 0 || nextIndex >= filtered.length) {
                updateWeekNavBounds();
                return;
            }
            loadWeek(filtered[nextIndex].weekStart);
        }
        function renderWeekPicker() {
            var select = pane.querySelector("#soft-week-select");
            var range = pane.querySelector("#soft-week-range");
            var meta = currentWeekMeta();
            var filtered = state.weeks.filter(weekInTerm);
            if (select) {
                select.innerHTML = filtered.map(function (week) {
                    return "<option value=\"" + escapeHtml(week.weekStart) + "\""
                        + (week.weekStart === state.selectedWeekStart ? " selected" : "")
                        + (week.isExam ? " data-exam=\"1\"" : "")
                        + ">أسبوع " + week.number + (week.isExam ? " — اختبارات" : "") + "</option>";
                }).join("");
                if (!filtered.length) {
                    select.innerHTML = "<option value=\"\">لا أسابيع</option>";
                }
                select.classList.toggle("is-exam", Boolean(meta.isExam));
            }
            if (range) {
                range.textContent = formatShort(meta.weekStart) + " — " + formatShort(meta.weekEnd)
                    + (meta.isExam ? " · اختبارات" : "");
                range.classList.toggle("is-exam", Boolean(meta.isExam));
            }
            syncCalToggle();
            updateWeekNavBounds();
        }
        function renderDayChips() {
            var host = pane.querySelector("#soft-day-chips");
            var follow = state.bundle && state.bundle.follow ? state.bundle.follow : {};
            var days = follow.days || [];
            var order = ["lineup", "break", "prayer"];
            if (!host) {
                return;
            }
            host.innerHTML = days.map(function (day) {
                var rows = dayRows(day.day_iso);
                var bySlot = {};
                rows.forEach(function (item) {
                    bySlot[item.slot_code] = item;
                });
                var on = day.day_iso === state.selectedDayIso ? " is-on" : "";
                var todayMark = day.day_iso === todayKey() ? " is-today" : "";
                var dots = order.map(function (slot) {
                    return "<span class=\"soft-dot " + slotDotClass(bySlot[slot]) + "\" title=\"" + escapeHtml(slot) + "\"></span>";
                }).join("");
                return "<button type=\"button\" class=\"soft-day-chip soft-day-strip-chip" + on + todayMark + "\" data-day-iso=\"" + escapeHtml(day.day_iso) + "\">"
                    + "<strong>" + escapeHtml(day.weekday || "") + "</strong>"
                    + "<small>" + escapeHtml(formatShort(day.day_iso)) + "</small>"
                    + "<span class=\"soft-day-dots\" aria-hidden=\"true\">" + dots + "</span>"
                    + "</button>";
            }).join("") || "<span class=\"wash-hint\">لا أيام في هذا الأسبوع.</span>";
        }
        function renderDayCard() {
            var head = pane.querySelector("#soft-day-card-head");
            var body = pane.querySelector("#soft-day-rows");
            var rows = dayRows(state.selectedDayIso);
            var dayMeta = ((state.bundle && state.bundle.follow && state.bundle.follow.days) || []).filter(function (d) {
                return d.day_iso === state.selectedDayIso;
            })[0];
            if (head) {
                head.innerHTML = "<div><strong>" + escapeHtml((dayMeta && dayMeta.weekday) || "") + "</strong>"
                    + "<span>" + escapeHtml(formatShort(state.selectedDayIso)) + "</span></div>"
                    + "<em class=\"soft-day-badge\">" + (state.selectedDayIso === todayKey() ? "اليوم" : "يوم الأسبوع") + "</em>";
            }
            if (!body) {
                return;
            }
            if (!rows.length) {
                body.innerHTML = "<tr><td colspan=\"5\">لا صفوف لهذا اليوم.</td></tr>";
                return;
            }
            body.innerHTML = rows.map(function (item, index) {
                var media = visualItemsOnly(item);
                var selected = state.selectedSlot === item.slot_code ? " is-selected" : "";
                var tone = item.status === "منفّذ" && item.evidence_status === "مرفوع"
                    ? "is-ready"
                    : (item.status === "منفّذ" ? "is-warn" : "is-muted");
                return "<tr class=\"soft-day-row " + tone + selected + "\" data-slot=\"" + escapeHtml(item.slot_code) + "\" data-entity-key=\"" + escapeHtml(item.entity_key || "") + "\" data-index=\"" + index + "\">"
                    + "<td class=\"is-name\"><strong>" + escapeHtml(item.title || "") + "</strong>"
                    + "<small class=\"program-meta\">" + escapeHtml(String(item.minutes || "") + " د") + "</small></td>"
                    + "<td><select data-field=\"status\">" + statusOptions(item.status) + "</select></td>"
                    + "<td><select data-field=\"evidence_status\">" + evidenceOptions(item.evidence_status) + "</select></td>"
                    + "<td class=\"soft-day-media-cell\">" + mediaThumbsHtml(media) + "</td>"
                    + "<td><input type=\"text\" data-field=\"note\" value=\"" + escapeHtml(item.note || "") + "\" placeholder=\"ملاحظة\" autocomplete=\"off\">"
                    + "<input type=\"hidden\" data-field=\"evidence_note\" value=\"" + escapeHtml(softEvidenceText(item)) + "\"></td>"
                    + "</tr>";
            }).join("");
            updateUploadHint();
        }
        function updateUploadHint() {
            var hint = pane.querySelector("#soft-upload-hint");
            if (!hint) {
                return;
            }
            if (!state.selectedSlot) {
                hint.textContent = "اختر صف فترة ثم ارفع الشاهد.";
                return;
            }
            var titles = { lineup: "الاصطفاف", break: "الاستراحة", prayer: "الصلاة" };
            hint.textContent = "الرفع لـ: " + (titles[state.selectedSlot] || state.selectedSlot);
        }
        function selectedEntityKey() {
            if (!state.selectedDayIso || !state.selectedSlot) {
                return "";
            }
            return state.selectedDayIso + "|" + state.selectedSlot;
        }
        function render() {
            var bundle = state.bundle || {};
            var plan = bundle.plan || {};
            var follow = bundle.follow || {};
            var slots = plan.slots || [];
            var total = plan.total_minutes || 0;
            pane.querySelector("#soft-stats").innerHTML = ""
                + "<div class=\"daily-stat\"><b>" + total + "</b><span>دقيقة يومياً</span></div>"
                + "<div class=\"daily-stat\"><b>60</b><span>المستهدف</span></div>"
                + "<div class=\"daily-stat\"><b>" + ((follow.stats && follow.stats.done) || 0) + "</b><span>منفّذ هذا الأسبوع</span></div>"
                + "<div class=\"daily-stat\"><b>" + ((follow.stats && follow.stats.missing_evidence) || 0) + "</b><span>شواهد ناقصة</span></div>";
            planNote.textContent = plan.balanced
                ? "المجموع " + total + " دقيقة — مطابق للمستهدف اليومي."
                : "المجموع " + total + " دقيقة — عدّل المدد ليصل المجموع إلى 60.";
            pane.querySelector("#soft-plan-rows").innerHTML = slots.map(function (item) {
                return "<tr data-code=\"" + escapeHtml(item.slot_code) + "\">"
                    + "<td class=\"is-name\"><strong>" + escapeHtml(item.title) + "</strong>"
                    + "<small class=\"program-meta\">" + escapeHtml((item.is_overridden ? "معدّلة — " : "تلقائية — ") + roleLabel(item.owner_role)) + "</small></td>"
                    + "<td>" + escapeHtml(String(item.minutes)) + " د</td>"
                    + "<td>" + escapeHtml(item.time_hint || "") + "</td>"
                    + "<td>" + escapeHtml(item.skill_focus || "") + "</td>"
                    + "<td class=\"is-fit\"><button type=\"button\" class=\"program-edit\" data-edit-slot=\"" + escapeHtml(item.slot_code) + "\">تعديل</button></td>"
                    + "</tr>";
            }).join("") || "<tr><td colspan=\"5\">لا فترات بعد.</td></tr>";
            renderWeekPicker();
            renderDayChips();
            renderDayCard();
            followNote.textContent = "شريط الأسبوع يعرض 5 أيام بنقاط الحالة — اللوحة أسفله لليوم المختار، والطباعة softTriple أفقية.";
        }
        function loadWeek(weekStart, preferDay) {
            var target = sundayOf(weekStart || todayKey());
            var seq = ++state.loadSeq;
            followNote.textContent = "جاري تحميل الأسبوع…";
            return fetch("/api/soft-periods/autofill?week_start=" + encodeURIComponent(target), {
                method: "POST",
                headers: headers()
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر تحميل الفترات اللاصفية");
                    }
                    return payload;
                });
            }).then(function (payload) {
                if (seq !== state.loadSeq) {
                    return null;
                }
                state.bundle = payload;
                state.selectedWeekStart = (payload.follow && payload.follow.week_start) || target;
                state.selectedDayIso = preferDay || pickDefaultDay(payload.follow);
                if (!state.selectedSlot) {
                    state.selectedSlot = "lineup";
                }
                render();
                return payload;
            }).catch(function (error) {
                if (seq !== state.loadSeq) {
                    return null;
                }
                followNote.textContent = error.message || "تعذر التحميل.";
                return null;
            });
        }
        function applyFollowPayload(follow, message) {
            if (!state.bundle) {
                state.bundle = {};
            }
            state.bundle.follow = follow;
            if (follow && follow.week_start) {
                state.selectedWeekStart = follow.week_start;
            }
            render();
            followNote.textContent = message || "تم التحديث.";
        }
        function authHeadersNoContentType() {
            var auth = headers();
            var uploadHeaders = {};
            Object.keys(auth).forEach(function (key) {
                if (String(key).toLowerCase() !== "content-type") {
                    uploadHeaders[key] = auth[key];
                }
            });
            return uploadHeaders;
        }
        function refreshAfterVisual(payload, message) {
            if (payload && payload.rows) {
                applyFollowPayload(payload, message);
                publishSuite("soft-periods");
                return;
            }
            loadWeek(state.selectedWeekStart, state.selectedDayIso).then(function () {
                followNote.textContent = message || "تم التحديث.";
                publishSuite("soft-periods");
            });
        }
        function uploadVisualFiles(fileList) {
            var key = selectedEntityKey();
            if (!key) {
                followNote.textContent = "اختر صف الفترة أولًا.";
                return;
            }
            if (!fileList || !fileList.length) {
                return;
            }
            var formData = new FormData();
            formData.append("entity_type", "soft_period");
            formData.append("entity_key", key);
            formData.append("register_key", "soft-periods");
            Array.prototype.forEach.call(fileList, function (file) {
                formData.append("files", file, file.name || "capture.jpg");
            });
            followNote.textContent = "جارٍ رفع الشاهد…";
            fetch("/api/visual-evidence", {
                method: "POST",
                headers: authHeadersNoContentType(),
                body: formData
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر رفع الشاهد");
                    }
                    return payload;
                });
            }).then(function (payload) {
                refreshAfterVisual(payload, "أُرفق الشاهد وحُفظ في visual_evidence.");
            }).catch(function (error) {
                followNote.textContent = error.message || "تعذر رفع الشاهد.";
            });
        }
        function saveVisualLink() {
            var key = selectedEntityKey();
            var urlInput = pane.querySelector("#soft-link-url");
            var nameInput = pane.querySelector("#soft-link-name");
            if (!key) {
                followNote.textContent = "اختر صف الفترة أولًا.";
                return;
            }
            var formData = new FormData();
            formData.append("entity_type", "soft_period");
            formData.append("entity_key", key);
            formData.append("register_key", "soft-periods");
            formData.append("link_url", urlInput ? urlInput.value.trim() : "");
            formData.append("link_name", nameInput ? nameInput.value.trim() : "");
            followNote.textContent = "جارٍ حفظ الرابط…";
            fetch("/api/visual-evidence", {
                method: "POST",
                headers: authHeadersNoContentType(),
                body: formData
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر حفظ الرابط");
                    }
                    return payload;
                });
            }).then(function (payload) {
                var row = pane.querySelector("#soft-link-row");
                if (row) {
                    row.hidden = true;
                }
                refreshAfterVisual(payload, "حُفظ رابط الشاهد.");
            }).catch(function (error) {
                followNote.textContent = error.message || "تعذر حفظ الرابط.";
            });
        }
        function deleteVisual(id) {
            followNote.textContent = "جارٍ حذف المرفق…";
            fetch("/api/visual-evidence/delete", {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({ id: Number(id || 0) })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر حذف المرفق");
                    }
                    return payload;
                });
            }).then(function (payload) {
                refreshAfterVisual(payload, "حُذف المرفق من visual_evidence.");
            }).catch(function (error) {
                followNote.textContent = error.message || "تعذر حذف المرفق.";
            });
        }
        function collectDayBodies() {
            var rows = dayRows(state.selectedDayIso);
            var trs = pane.querySelectorAll("#soft-day-rows tr.soft-day-row");
            var bodies = [];
            Array.prototype.forEach.call(trs, function (tr, index) {
                var item = rows[index];
                if (!item) {
                    return;
                }
                var evidenceStatus = tr.querySelector("[data-field=\"evidence_status\"]").value;
                var noteField = tr.querySelector("[data-field=\"evidence_note\"]");
                var body = {
                    day_iso: item.day_iso,
                    slot_code: item.slot_code,
                    status: tr.querySelector("[data-field=\"status\"]").value,
                    evidence_status: evidenceStatus,
                    note: tr.querySelector("[data-field=\"note\"]").value.trim(),
                    evidence_note: noteField ? noteField.value.trim() : (item.evidence_note || "")
                };
                if (body.evidence_status === "مرفوع" && !body.evidence_note) {
                    body.evidence_note = softEvidenceText({
                        title: item.title,
                        day_iso: item.day_iso,
                        evidence_status: "مرفوع",
                        evidence_note: ""
                    });
                }
                bodies.push(body);
            });
            return bodies;
        }
        function saveDay() {
            var bodies = collectDayBodies();
            if (!bodies.length) {
                followNote.textContent = "لا صفوف للحفظ.";
                return Promise.resolve();
            }
            followNote.textContent = "جارٍ حفظ اليوم…";
            var chain = Promise.resolve();
            bodies.forEach(function (body) {
                chain = chain.then(function () {
                    return fetch("/api/soft-periods/follow", {
                        method: "POST",
                        headers: headers(),
                        body: JSON.stringify(body)
                    }).then(function (response) {
                        return response.json().then(function (payload) {
                            if (!response.ok) {
                                throw new Error(payload.detail || "تعذر حفظ المتابعة");
                            }
                            return payload;
                        });
                    });
                });
            });
            return chain.then(function (follow) {
                applyFollowPayload(follow, "حُفظت متابعة اليوم للفترات الثلاث.");
                publishSuite("soft-periods");
            }).catch(function (error) {
                followNote.textContent = error.message || "تعذر حفظ اليوم.";
            });
        }
        function bulkFill(dayIso) {
            if (!state.bundle || !state.bundle.follow) {
                return;
            }
            var status = pane.querySelector("#soft-fill-status").value;
            var evidence = pane.querySelector("#soft-fill-evidence").value;
            followNote.textContent = "جارٍ تعبئة اليوم…";
            fetch("/api/soft-periods/follow-bulk", {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({
                    week_start: state.selectedWeekStart || state.bundle.follow.week_start || "",
                    day_iso: dayIso || state.selectedDayIso || "",
                    status: status,
                    evidence_status: evidence
                })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر التعبئة الجماعية");
                    }
                    return payload;
                });
            }).then(function (follow) {
                applyFollowPayload(follow, "عُبئ اليوم بالقيم المختارة.");
                publishSuite("soft-periods");
            }).catch(function (error) {
                followNote.textContent = error.message || "تعذر التعبئة الجماعية.";
            });
        }
        function buildTriplePayload(dayIso) {
            var rows = dayRows(dayIso || state.selectedDayIso);
            if (!rows.length) {
                return null;
            }
            var first = rows[0];
            var dayMeta = ((state.bundle && state.bundle.follow && state.bundle.follow.days) || []).filter(function (d) {
                return d.day_iso === first.day_iso;
            })[0];
            var weekMeta = currentWeekMeta();
            var dayGregorian = typeof gregorianFromDate === "function"
                ? gregorianFromDate(first.day_iso)
                : (typeof formatDisplayDate === "function" ? formatDisplayDate(first.day_iso, "gregorian") : first.day_iso);
            var dayHijriNumeric = "";
            if (typeof hijriParts === "function" && typeof pad2 === "function") {
                var hp = hijriParts(first.day_iso);
                dayHijriNumeric = pad2(hp.day) + " / " + pad2(hp.month) + " / " + hp.year + " هـ";
            } else if (typeof hijriFromDate === "function") {
                dayHijriNumeric = hijriFromDate(first.day_iso);
            }
            var weekday = (dayMeta && dayMeta.weekday) || first.weekday || "";
            var dateDisplay = state.calendarMode === "hijri"
                ? (dayHijriNumeric || dayGregorian || first.day_iso || "—")
                : (dayGregorian || first.day_iso || "—");
            return {
                weekLabel: "الأسبوع " + String(weekMeta.number || "—"),
                weekday: weekday || "—",
                dateDisplay: dateDisplay,
                hijri: dayHijriNumeric || "",
                dateLine: (weekday ? weekday + " — " : "") + dateDisplay,
                columns: rows.map(function (item) {
                    return {
                        title: item.title || item.slot_code,
                        recordNo: softRecordNo(item),
                        status: item.status || "",
                        images: visualItemsOnly(item)
                    };
                })
            };
        }
        function openTriplePrint(previewOnly) {
            var payload = buildTriplePayload(state.selectedDayIso);
            if (!payload || !window.board1059Kernel || !window.board1059Kernel.softTriple) {
                followNote.textContent = "لا بيانات لطباعة الفترات الثلاث لهذا اليوم.";
                return;
            }
            window.board1059Kernel.softTriple(payload, previewOnly !== false);
            followNote.textContent = previewOnly === false
                ? "جاري طباعة بطاقة الفترات الثلاث."
                : "معاينة بطاقة الفترات الثلاث جاهزة.";
        }
        function goToday() {
            var today = todayKey();
            var week = sundayOf(today);
            state.termFilter = "all";
            pane.querySelector("#soft-term-filter").value = "all";
            loadWeek(week, today);
        }

        state.weeks = buildWeeks();
        state.selectedWeekStart = sundayOf(todayKey());
        state.termFilter = "all";

        pane.querySelector("#soft-term-filter").addEventListener("change", function (event) {
            state.termFilter = event.target.value || "all";
            var meta = currentWeekMeta();
            if (!weekInTerm(meta)) {
                var first = state.weeks.filter(weekInTerm)[0];
                if (first) {
                    loadWeek(first.weekStart);
                    return;
                }
            }
            renderWeekPicker();
            renderDayChips();
        });
        pane.querySelector("#soft-week-prev").addEventListener("click", function () {
            shiftWeek(-1);
        });
        pane.querySelector("#soft-week-next").addEventListener("click", function () {
            shiftWeek(1);
        });
        pane.querySelector("#soft-week-select").addEventListener("change", function (event) {
            var value = event.target.value || "";
            if (value) {
                loadWeek(value);
            }
        });
        pane.querySelector("#soft-cal-toggle").addEventListener("click", function () {
            state.calendarMode = state.calendarMode === "hijri" ? "gregorian" : "hijri";
            syncCalToggle();
            renderWeekPicker();
            renderDayChips();
            renderDayCard();
        });
        pane.querySelector("#soft-week-today").addEventListener("click", goToday);
        pane.querySelector("#soft-day-chips").addEventListener("click", function (event) {
            var chip = event.target.closest("[data-day-iso]");
            if (!chip) {
                return;
            }
            state.selectedDayIso = chip.getAttribute("data-day-iso") || "";
            state.selectedSlot = "lineup";
            renderDayChips();
            renderDayCard();
        });
        pane.querySelector("#soft-day-rows").addEventListener("click", function (event) {
            var removeBtn = event.target.closest("[data-ve-remove]");
            if (removeBtn) {
                event.preventDefault();
                deleteVisual(removeBtn.getAttribute("data-ve-remove"));
                return;
            }
            var row = event.target.closest("tr.soft-day-row");
            if (!row) {
                return;
            }
            state.selectedSlot = row.getAttribute("data-slot") || "";
            renderDayCard();
        });
        pane.querySelector("#soft-day-save").addEventListener("click", function () {
            saveDay();
        });
        pane.querySelector("#soft-day-preview").addEventListener("click", function () {
            openTriplePrint(true);
        });
        pane.querySelector("#soft-day-print").addEventListener("click", function () {
            openTriplePrint(false);
        });
        pane.querySelector("#soft-day-fill").addEventListener("click", function () {
            bulkFill(state.selectedDayIso);
        });
        pane.querySelector("#soft-refresh").addEventListener("click", function () {
            loadWeek(state.selectedWeekStart, state.selectedDayIso);
        });
        function closeUploadPanel() {
            var panel = pane.querySelector("#soft-upload-panel");
            if (panel) {
                panel.hidden = true;
            }
        }
        pane.querySelector("#soft-upload-toggle").addEventListener("click", function (event) {
            event.stopPropagation();
            var panel = pane.querySelector("#soft-upload-panel");
            if (panel) {
                panel.hidden = !panel.hidden;
            }
        });
        document.addEventListener("click", function (event) {
            if (!pane.isConnected) {
                return;
            }
            var menu = pane.querySelector(".soft-upload-menu");
            if (menu && !menu.contains(event.target)) {
                closeUploadPanel();
            }
        });
        pane.querySelector("#soft-upload-panel").addEventListener("click", function (event) {
            var btn = event.target.closest("[data-soft-upload]");
            if (!btn) {
                return;
            }
            event.stopPropagation();
            var mode = btn.getAttribute("data-soft-upload");
            closeUploadPanel();
            if (!selectedEntityKey()) {
                followNote.textContent = "اختر صف الفترة أولًا.";
                return;
            }
            if (mode === "file") {
                pane.querySelector("#soft-file-input").click();
                return;
            }
            if (mode === "camera") {
                var camFallback = function () {
                    pane.querySelector("#soft-camera-input").click();
                };
                if (window.board1059VisualEvidence && window.board1059VisualEvidence.openCamera) {
                    window.board1059VisualEvidence.openCamera(function (blob, filename) {
                        var file = new File([blob], filename || "camera.jpg", { type: blob.type || "image/jpeg" });
                        uploadVisualFiles([file]);
                    }, camFallback);
                } else {
                    camFallback();
                }
                return;
            }
            if (mode === "link") {
                var linkRow = pane.querySelector("#soft-link-row");
                if (linkRow) {
                    linkRow.hidden = !linkRow.hidden;
                }
            }
        });
        pane.querySelector("#soft-file-input").addEventListener("change", function (event) {
            uploadVisualFiles(event.target.files);
            event.target.value = "";
        });
        pane.querySelector("#soft-camera-input").addEventListener("change", function (event) {
            uploadVisualFiles(event.target.files);
            event.target.value = "";
        });
        pane.querySelector("#soft-link-save").addEventListener("click", saveVisualLink);
        pane.querySelector("#soft-plan-rows").addEventListener("click", function (event) {
            var button = event.target.closest("[data-edit-slot]");
            if (!button || !state.bundle) {
                return;
            }
            var code = button.getAttribute("data-edit-slot");
            var slot = (state.bundle.plan.slots || []).filter(function (item) {
                return item.slot_code === code;
            })[0];
            if (!slot) {
                return;
            }
            editor.hidden = false;
            pane.querySelector("#soft-editor-title").textContent = "تعديل: " + slot.title;
            form.elements.slot_code.value = slot.slot_code;
            form.elements.title.value = slot.title || "";
            form.elements.minutes.value = slot.minutes || 0;
            form.elements.time_hint.value = slot.time_hint || "";
            form.elements.skill_focus.value = slot.skill_focus || "";
            formNote.textContent = "";
        });
        pane.querySelector("#soft-cancel").addEventListener("click", function () {
            editor.hidden = true;
            formNote.textContent = "";
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var body = {
                slot_code: form.elements.slot_code.value,
                title: form.elements.title.value.trim(),
                minutes: Number(form.elements.minutes.value),
                time_hint: form.elements.time_hint.value.trim(),
                skill_focus: form.elements.skill_focus.value.trim(),
                owner_role: "",
                sort_order: 0
            };
            var current = (state.bundle && state.bundle.plan.slots || []).filter(function (item) {
                return item.slot_code === body.slot_code;
            })[0];
            if (current) {
                body.owner_role = current.owner_role || "";
                body.sort_order = current.sort_order || 0;
            }
            formNote.textContent = "جارٍ الحفظ…";
            fetch("/api/soft-periods/slot", {
                method: "POST",
                headers: headers(),
                body: JSON.stringify(body)
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر الحفظ");
                    }
                    return payload;
                });
            }).then(function (plan) {
                if (!state.bundle) {
                    state.bundle = {};
                }
                state.bundle.plan = plan;
                editor.hidden = true;
                render();
                planNote.textContent = "حُفظ التعديل على الخطة.";
                publishSuite("soft-periods");
            }).catch(function (error) {
                formNote.textContent = error.message || "تعذر الحفظ.";
            });
        });

        window.addEventListener("dataChanged", function (event) {
            var source = event && event.detail && event.detail.source;
            if (!pane.isConnected) {
                return;
            }
            if (source === "calendar") {
                refreshWeeksFromCalendar();
                followNote.textContent = "حُدّث منتقي الأسابيع من التقويم المعتمد (" + state.weeks.length + " أسبوعًا).";
                return;
            }
            if (source && source !== "soft-periods" && source !== "visual-evidence") {
                return;
            }
            loadWeek(state.selectedWeekStart, state.selectedDayIso);
        });

        loadWeek(state.selectedWeekStart, todayKey());
    }

    window.erpBoards = {
        behavior: paintBehavior,
        textbooks: paintTextbooks,
        preparation: paintPreparation,
        grades: paintGrades,
        support: paintSupport,
        accounts: paintAccounts,
        letterhead: paintLetterhead,
        backup: paintBackup,
        "remedial-plan": paintRemedialPlan,
        "tasks-today": paintTasksToday,
        "soft-periods": paintSoftPeriods,
        "tasks-absence": paintAbsenceToday,
        "tasks-week": paintTasksWeek,
        "tasks-follow": paintTasksFollow,
        "committees-home": paintCommittees,
        "plans-home": paintPlans,
        "indicators-etec": paintIndicators,
        "indicators-nafes": paintNafes,
        "indicators-progress": paintProgress,
        "plan-book": paintPlanBook,
        "plan-deck": paintPlanDeck,
        "plan-exec": paintPlanExec,
        "plan-follow": paintPlanFollow
    };
    collectSignals();
    (function openSoftWitnessFromQuery() {
        var params = new URLSearchParams(window.location.search || "");
        if (!params.get("softWitness")) {
            return;
        }
        function launch() {
            var link = document.querySelector("[data-erp-board=\"soft-periods\"]");
            if (!link) {
                return;
            }
            if (window.erp1059 && typeof window.erp1059.openBoard === "function") {
                window.erp1059.openBoard(link);
            } else {
                link.click();
            }
        }
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", function () {
                window.setTimeout(launch, 120);
            });
        } else {
            window.setTimeout(launch, 120);
        }
    }());
})();
