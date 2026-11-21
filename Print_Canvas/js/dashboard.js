(function () {
    var stored = null;
    try {
        stored = JSON.parse(sessionStorage.getItem("sessionUser") || "null");
    } catch (error) {
        stored = null;
    }
    if (!stored || !stored.token || !stored.id) {
        window.location.replace("login.html");
    }
})();
// منطق التوليد محفوظ هنا، وزر النموذج ينقل إلى صفحة الإعداد
var OFFICIAL_PRINCIPAL_NAME = "نايف بن سمير حجيف المخلفي";
var PLAN_OWNERS = {
    principal: { title: "مدير المدرسة", name: OFFICIAL_PRINCIPAL_NAME, heading: "خطة مدير المدرسة" },
    vice_teachers: { title: "وكيل الشؤون التعليمية", name: "محمد بن فايز بن هلال الحربي", heading: "خطة وكيل الشؤون التعليمية" },
    vice_students: { title: "وكيل شؤون الطلاب", name: "خالد بن علي بن حجري العمري", heading: "خطة وكيل شؤون الطلاب" },
    student_counselor: { title: "الموجه الطلابي", name: "فهد حنيف بن محمد العمري", heading: "خطة الموجه الطلابي" },
    activity_leader: { title: "رائد النشاط الطلابي", name: "محمد حامد عماش السهلي", heading: "خطة رائد النشاط الطلابي" }
};
var bookletSchoolName = "متوسطة سعد بن الربيع الأنصاري";
var bookletAdmin = "الإدارة العامة للتعليم بمنطقة المدينة المنورة";
var bookletOffice = "";
var bookletStudents = 350;

function applySchoolHeader(school) {
    var data = school || {};
    bookletSchoolName = (data.name || "").trim() || "متوسطة سعد بن الربيع الأنصاري";
    bookletAdmin = (data.education_administration || "").trim() || "الإدارة العامة للتعليم بمنطقة المدينة المنورة";
    bookletOffice = (data.education_office || "").trim();
    var students = parseInt(data.total_students, 10);
    bookletStudents = students > 0 ? students : 350;
    document.querySelectorAll(".header-admin").forEach(function (node) {
        node.textContent = bookletAdmin;
    });
    document.querySelectorAll(".header-office").forEach(function (node) {
        node.textContent = bookletOffice;
    });
    document.querySelectorAll(".school-name, #official-school").forEach(function (node) {
        node.textContent = bookletSchoolName;
    });
}

function escapeHeader(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
var termWeekCount = 18;

function weekCount() {
    return termWeekCount >= 10 && termWeekCount <= 24 ? termWeekCount : 18;
}
var EVIDENCE_PORTAL = "https://script.google.com/macros/s/AKfycbxv401T2f7sORF2jEwnlG1u1rhfj9nqfXAkfQf6TFC1PPWqObugF600p3HCMd_-lDdc/exec";

function launchEvidencePortal(context) {
    var item = context || {};
    var currentUser = {};
    try {
        currentUser = JSON.parse(sessionStorage.getItem("sessionUser") || sessionStorage.getItem("currentUser") || "{}") || {};
    } catch (error) {
        currentUser = {};
    }
    var shared = Boolean(item.shared_with && String(item.shared_with).trim()) || item.classification === "مشترك" || item.shared === true;
    var token = item.token || (window.GovernanceIntelligence && GovernanceIntelligence.portalToken ? GovernanceIntelligence.portalToken() : "autologin");
    var base = (window.GovernanceIntelligence && GovernanceIntelligence.portalUrl && GovernanceIntelligence.portalUrl()) || EVIDENCE_PORTAL;
    var params = new URLSearchParams({
        token: token,
        nid: item.nid || currentUser.national_id || currentUser.id || "",
        etec: item.etec || item.indicator || item.etec_indicator || "",
        name: item.name || currentUser.name || "",
        role: item.role || currentUser.role || "",
        task: item.title || item.task_name || item.task || "",
        week: item.week || item.execution_time || "",
        kind: shared ? "shared" : "direct",
        steps: item.steps || "",
        impact: item.impact || "",
        autologin: "true"
    });
    var url = base + "?" + params.toString();
    if (item.open !== false) {
        window.open(url, "_blank", "noopener");
    }
    return url;
}

function evidencePortalUrl(item) {
    var copy = Object.assign({}, item || {});
    copy.open = false;
    return launchEvidencePortal(copy);
}

function liveLeadershipName(value) {
    if (window.dataHub && typeof window.dataHub.display === "function") {
        return window.dataHub.display(value);
    }
    return "";
}

function storedLeadershipId(role) {
    var keys = {
        principal: ["principal"],
        vice_teachers: ["viceTeachersList", "viceTeachers"],
        vice_students: ["studentsVices", "studentsVice"],
        student_counselor: ["primaryCounselor", "studentCounselor"],
        activity_leader: ["activityLeader"]
    };
    var leadership = {};
    try {
        leadership = JSON.parse(localStorage.getItem("board1059.leadership") || "null") || {};
    } catch (error) {
        leadership = {};
    }
    var stored = "";
    (keys[role] || ["principal"]).forEach(function (key) {
        if (stored) {
            return;
        }
        var value = leadership[key];
        if (Array.isArray(value) && value.length) {
            stored = value[0] || "";
        } else if (value) {
            stored = value;
        }
    });
    return stored;
}

function applyPlanOwner(role) {
    var owner = PLAN_OWNERS[role] || PLAN_OWNERS.principal;
    var name = liveLeadershipName(storedLeadershipId(role));
    var author = document.getElementById("cover-author");
    if (author) {
        author.textContent = name ? "إعداد: " + owner.title + " / " + name : "إعداد: " + owner.title;
    }
    var intro = document.getElementById("intro-sign");
    if (intro) {
        intro.textContent = name ? name + " / " + owner.title + " " + bookletSchoolName : owner.title + " " + bookletSchoolName;
    }
    if (executorName) {
        executorName.textContent = name;
    }
    var option = document.querySelector("#plan-role option[value='" + (role || "principal") + "']");
    if (option) {
        option.textContent = name ? owner.heading + ": " + name : owner.heading;
    }
    var heading = document.querySelector("#results .card-header h2");
    if (heading) {
        heading.textContent = owner.heading;
    }
}

function principalName(value) {
    var name = value ? String(value).trim() : "";
    if (window.dataHub && typeof window.dataHub.display === "function" && /^\d{10,}$/.test(name)) {
        return window.dataHub.display(name);
    }
    if (/^\d{10,}$/.test(name)) {
        return "";
    }
    return name;
}

function submitPlan(data) {
    showMessage("جارٍ توليد الخطط");
    fetch("/api/generate-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
        .then(function (response) {
            return response.json().then(function (payload) {
                if (!response.ok) {
                    throw new Error(payload.detail || "تعذر توليد الخطط");
                }
                return payload;
            });
        })
        .then(function (payload) {
            plans = payload.plans || {};
            var picker = document.getElementById("plan-role");
            var selected = picker && plans[picker.value] ? picker.value : "principal";
            if (!plans[selected]) {
                results.hidden = true;
                showMessage("لا توجد خطط في الاستجابة");
                return;
            }
            if (picker) {
                picker.value = selected;
            }
            results.hidden = false;
            showMessage("");
            selectRole(selected);
        })
        .catch(function (error) {
            results.hidden = true;
            showMessage(error.message);
        });
}

var planForm = document.getElementById("plan-form");
if (planForm && document.getElementById("region")) planForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var setup = {
        region: document.getElementById("region").value,
        stage: document.getElementById("stage").value,
        gender: document.getElementById("gender").value,
        semester: document.getElementById("semester").value,
        excel_filename: document.getElementById("excel-filename").value
    };
    sessionStorage.setItem("planSetup", JSON.stringify(setup));
    window.location.href = "setup.html";
});

var execRows = document.getElementById("exec-rows");
var matrixHead = document.getElementById("matrix-head");
var matrixRows = document.getElementById("matrix-rows");
var rowSerial = 0;

function renderPlan(weeks) {
    execRows.innerHTML = "";
    matrixRows.innerHTML = "";
    renderMatrixHead();
    executorName.textContent = principalName(weeks[0] && weeks[0].executor ? weeks[0].executor.name : "");
    if (weeks.length) {
        var first = weeks[0];
        var last = weeks[weeks.length - 1];
        var startGreg = typeof formatDisplayDate === "function" ? formatDisplayDate(first.start_date, "gregorian") : first.start_date;
        var endGreg = typeof formatDisplayDate === "function" ? formatDisplayDate(last.end_date, "gregorian") : last.end_date;
        var startHijri = typeof formatDisplayDate === "function" ? formatDisplayDate(first.hijri_start, "hijri") : first.hijri_start;
        var endHijri = typeof formatDisplayDate === "function" ? formatDisplayDate(last.hijri_end, "hijri") : last.hijri_end;
        planDates.textContent = startGreg + " — " + endGreg + " / " + startHijri + " — " + endHijri;
    } else {
        planDates.textContent = "";
    }
    weeks.forEach(function (week) {
        (week.tasks || []).forEach(function (task) {
            addItemRow({
                title: task.title,
                execution_time: task.execution_time,
                execution_method: task.execution_method,
                evidence: task.evidence,
                week: week.week_number,
                shared_with: task.shared_with || ""
            });
        });
    });
    if (window.MasterKnowledge) {
        MasterKnowledge.refreshPlan();
    }
}

function renderMatrixHead() {
    matrixHead.innerHTML = "";
    var label = document.createElement("th");
    label.className = "matrix-label";
    label.textContent = "البند";
    matrixHead.appendChild(label);
    for (var number = 1; number <= weekCount(); number += 1) {
        var cell = document.createElement("th");
        cell.className = "week-col";
        cell.textContent = String(number);
        matrixHead.appendChild(cell);
    }
}

function planFieldOptions(field) {
    if (field === "title") {
        var matrix = window.autoFillDictionary ? autoFillDictionary.evidence_matrix || [] : [];
        if (matrix.length) {
            return matrix.map(function (item) { return item.label; });
        }
        var titles = [];
        (contextualBank.templates || []).forEach(function (item) {
            if (item.activity) {
                titles.push(item.activity);
            }
        });
        var packs = registerLookup.dropdowns_by_register || {};
        Object.keys(packs).forEach(function (key) {
            titles = titles.concat(packs[key].program_classification || [], packs[key].case_type || [], packs[key].skill || []);
        });
        return uniqueLookup(titles);
    }
    if (field === "execution_time") {
        return weekOptions();
    }
    if (field === "execution_method") {
        var steps = [];
        (contextualBank.templates || []).forEach(function (item) {
            steps = steps.concat(item.steps || []);
        });
        return uniqueLookup(steps);
    }
    return mergedLookup(["witness_type", "witness", "evidence_kind"]);
}

function fillPlanSelect(select, field, value) {
    var options = planFieldOptions(field);
    if (value && options.indexOf(value) === -1) {
        options.unshift(value);
    }
    var html = '<option value=""></option>';
    options.forEach(function (option) {
        html += '<option value="' + escapeHeader(option) + '">' + escapeHeader(option) + "</option>";
    });
    select.innerHTML = html;
    if (value) {
        select.value = value;
    }
}

function planSelect(field, value) {
    var select = document.createElement("select");
    select.className = "cell-input";
    select.dataset.planField = field;
    var planLabels = { title: "البند", execution_time: "وقت التنفيذ", execution_method: "الوصف", evidence: "الشاهد" };
    select.setAttribute("data-label", planLabels[field] || field);
    fillPlanSelect(select, field, value || "");
    return select;
}

function refreshPlanChoices() {
    document.querySelectorAll("#exec-rows select.cell-input").forEach(function (select) {
        fillPlanSelect(select, select.dataset.planField, select.value);
    });
}

function addItemRow(item) {
    var rowId = "item-" + (rowSerial += 1);
    var row = document.createElement("tr");
    row.dataset.rowId = rowId;
    row.dataset.sharedWith = item.shared_with || "";
    var deleteCell = document.createElement("td");
    var removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn-remove";
    removeButton.textContent = "×";
    removeButton.addEventListener("click", function () {
        row.remove();
        var matrixRow = matrixRows.querySelector('[data-row-id="' + rowId + '"]');
        if (matrixRow) {
            matrixRow.remove();
        }
    });
    deleteCell.appendChild(removeButton);
    row.appendChild(deleteCell);
    var fieldInputs = {};
    ["title", "execution_time", "execution_method", "evidence"].forEach(function (field) {
        var cell = document.createElement("td");
        if (field === "title") {
            cell.className = "task-item-cell";
        }
        var input = planSelect(field, item[field] || "");
        fieldInputs[field] = input;
        if (field === "title") {
            var stack = document.createElement("div");
            stack.className = "item-title-stack";
            var line = document.createElement("div");
            line.className = "item-title";
            line.appendChild(input);
            var partner = item.shared_with ? String(item.shared_with).trim() : "";
            var shared = Boolean(partner) || item.classification === "مشترك" || item.shared === true;
            var badge = document.createElement("span");
            badge.className = "task-badge " + (shared ? "badge-shared" : "badge-direct");
            badge.textContent = shared ? "مشترك" : "مباشر";
            line.appendChild(badge);
            stack.appendChild(line);
            if (shared && partner) {
                var note = document.createElement("div");
                note.className = "shared-partner-label";
                note.textContent = "🔗 مشترك مع: " + partner;
                stack.appendChild(note);
            }
            cell.appendChild(stack);
        } else if (field === "evidence") {
            var evidenceCell = document.createElement("div");
            evidenceCell.className = "evidence-cell";
            evidenceCell.appendChild(input);
            var portal = document.createElement("a");
            portal.target = "_blank";
            portal.className = "evidence-link-btn";
            portal.title = "فتح بوابة الشواهد لتوثيق هذا البند";
            portal.textContent = "توثيق الشاهد ↗";
            evidenceCell.appendChild(portal);
            cell.appendChild(evidenceCell);
            var refreshPortal = function () {
                portal.href = evidencePortalUrl({
                    title: fieldInputs.title ? fieldInputs.title.value : item.title,
                    task_name: item.task_name,
                    week: item.week || (fieldInputs.execution_time ? fieldInputs.execution_time.value : item.execution_time),
                    execution_time: fieldInputs.execution_time ? fieldInputs.execution_time.value : item.execution_time,
                    shared_with: item.shared_with,
                    classification: item.classification,
                    shared: item.shared
                });
            };
            refreshPortal();
            input.addEventListener("change", refreshPortal);
            if (fieldInputs.title) {
                fieldInputs.title.addEventListener("change", refreshPortal);
            }
            if (fieldInputs.execution_time) {
                fieldInputs.execution_time.addEventListener("change", refreshPortal);
            }
        } else {
            cell.appendChild(input);
        }
        if (field === "title") {
            input.addEventListener("change", function () {
                var matrixLabel = matrixRows.querySelector('[data-row-id="' + rowId + '"] .matrix-label');
                if (matrixLabel) {
                    matrixLabel.textContent = input.value;
                }
                var evidenceItem = window.evidenceByItem ? evidenceByItem(input.value) : null;
                if (evidenceItem) {
                    [fieldInputs.execution_method, fieldInputs.evidence].forEach(function (target, index) {
                        var text = index === 0 ? evidenceItem.description : evidenceItem.witness;
                        if (!target || !text) {
                            return;
                        }
                        var exists = Array.prototype.some.call(target.options, function (option) {
                            return option.value === text;
                        });
                        if (!exists) {
                            var option = document.createElement("option");
                            option.value = text;
                            option.textContent = text;
                            target.appendChild(option);
                        }
                        target.value = text;
                    });
                    return;
                }
                var match = null;
                (contextualBank.templates || []).forEach(function (template) {
                    if (template.activity && template.activity === input.value) {
                        match = template;
                    }
                });
                if (!match || !match.steps || !match.steps.length) {
                    return;
                }
                if (fieldInputs.execution_method) {
                    fieldInputs.execution_method.value = match.steps[0];
                }
                if (fieldInputs.evidence) {
                    var witnesses = planFieldOptions("evidence");
                    var preferred = witnesses.filter(function (item) {
                        return item.indexOf("كشف") !== -1;
                    })[0] || witnesses[0] || "";
                    if (preferred) {
                        fieldInputs.evidence.value = preferred;
                    }
                }
            });
        }
        row.appendChild(cell);
    });
    execRows.appendChild(row);
    addMatrixRow(rowId, item.title || "", item.week, item.checks);
}

function addMatrixRow(rowId, title, week, checks) {
    var row = document.createElement("tr");
    row.dataset.rowId = rowId;
    var label = document.createElement("td");
    label.className = "matrix-label";
    label.textContent = title;
    row.appendChild(label);
    for (var number = 1; number <= weekCount(); number += 1) {
        var cell = document.createElement("td");
        cell.className = "week-col";
        var box = document.createElement("input");
        box.type = "checkbox";
        if (Array.isArray(checks)) {
            box.checked = Boolean(checks[number - 1]);
        } else {
            box.checked = Number(week) === number;
        }
        cell.appendChild(box);
        row.appendChild(cell);
    }
    matrixRows.appendChild(row);
}

function showRolePlan(role) {
    var weeks = plans[role] && plans[role].weeks ? plans[role].weeks : [];
    fetch("/api/get-plan-items?role=" + encodeURIComponent(role))
        .then(function (response) {
            if (!response.ok) {
                throw new Error("تعذر قراءة البنود المحفوظة");
            }
            return response.json();
        })
        .then(function (data) {
            if (role !== activeRole) {
                return;
            }
            if (data.items && data.items.length) {
                renderPlan([]);
                executorName.textContent = principalName(weeks[0] && weeks[0].executor ? weeks[0].executor.name : "");
                if (weeks.length) {
                    var first = weeks[0];
                    var last = weeks[weeks.length - 1];
                    var startGreg = formatDisplayDate(first.start_date, "gregorian");
                    var endGreg = formatDisplayDate(last.end_date, "gregorian");
                    var startHijri = formatDisplayDate(first.hijri_start, "hijri");
                    var endHijri = formatDisplayDate(last.hijri_end, "hijri");
                    planDates.textContent = startGreg + " — " + endGreg + " / " + startHijri + " — " + endHijri;
                }
                var partners = {};
                weeks.forEach(function (week) {
                    (week.tasks || []).forEach(function (task) {
                        if (task.title && task.shared_with) {
                            partners[task.title] = task.shared_with;
                        }
                    });
                });
                var settledWeek = {};
                weeks.forEach(function (week) {
                    (week.tasks || []).forEach(function (task) {
                        if (task.title) {
                            settledWeek[task.title] = week.week_number;
                        }
                    });
                });
                data.items.forEach(function (item) {
                    if (!item.shared_with && partners[item.title]) {
                        item.shared_with = partners[item.title];
                    }
                    if (settledWeek[item.title]) {
                        item.week = settledWeek[item.title];
                        item.checks = null;
                    }
                    addItemRow(item);
                });
                applyPlanOwner(role);
                return;
            }
            renderPlan(weeks);
            applyPlanOwner(role);
        })
        .catch(function () {
            if (role === activeRole) {
                renderPlan(weeks);
                applyPlanOwner(role);
            }
        });
}

function collectPlanItems() {
    var items = [];
    Array.prototype.forEach.call(execRows.querySelectorAll("tr"), function (row) {
        var inputs = row.querySelectorAll(".cell-input");
        var matrixRow = matrixRows.querySelector('[data-row-id="' + row.dataset.rowId + '"]');
        var checks = [];
        if (matrixRow) {
            matrixRow.querySelectorAll('input[type="checkbox"]').forEach(function (box) {
                checks.push(box.checked);
            });
        }
        items.push({
            title: inputs[0] ? inputs[0].value : "",
            execution_time: inputs[1] ? inputs[1].value : "",
            execution_method: inputs[2] ? inputs[2].value : "",
            evidence: inputs[3] ? inputs[3].value : "",
            shared_with: row.dataset.sharedWith || "",
            checks: checks
        });
    });
    return items;
}

var addItemButton = document.getElementById("add-item");
if (addItemButton) addItemButton.addEventListener("click", function () {
    addItemRow({});
});

var savePlanButton = document.getElementById("btn-save-plan");
if (savePlanButton) savePlanButton.addEventListener("click", function () {
    var note = document.getElementById("plan-save-message");
    note.hidden = false;
    note.textContent = "جارٍ حفظ تعديلات الخطة";
    fetch("/api/save-plan-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            role: activeRole || "principal",
            items: collectPlanItems()
        })
    })
        .then(function (response) {
            return response.json().then(function (payload) {
                if (!response.ok) {
                    throw new Error(payload.detail || "تعذر حفظ تعديلات الخطة");
                }
                return payload;
            });
        })
        .then(function () {
            note.textContent = "تم حفظ تعديلات الخطة";
        })
        .catch(function (error) {
            note.textContent = error.message;
        });
});

if (new URLSearchParams(window.location.search).get("view") === "plan") {
    var readyRaw = sessionStorage.getItem("planReady");
    if (readyRaw) {
        var ready = JSON.parse(readyRaw);
        submitPlan({
            region: ready.region,
            stage: ready.stage,
            gender: ready.gender,
            semester: ready.semester,
            excel_filename: ready.excel_filename
        });
    }
}

fetch("/api/settings")
    .then(function (response) {
        if (!response.ok) {
            return null;
        }
        return response.json();
    })
    .then(function (data) {
        if (!data || !data.school) {
            return;
        }
        applySchoolHeader(data.school);
        var storedWeeks = parseInt(data.school.term_weeks_count, 10);
        termWeekCount = storedWeeks >= 10 && storedWeeks <= 20 ? storedWeeks : 18;
        fillBookletFromSettings(data);
        if (activeRole && plans[activeRole]) {
            selectRole(activeRole);
        }
    })
    .catch(function () {});

function refreshSsotSurfaces() {
    if (!window.PerformanceBind) {
        return;
    }
    PerformanceBind.invalidate();
    PerformanceBind.load().then(function (metrics) {
        PerformanceBind.fillDomainScoreTable(document, metrics);
        PerformanceBind.fillNafesTable(document, metrics);
        PerformanceBind.renderStrip(document.getElementById("ssot-metrics-strip"), metrics);
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshSsotSurfaces);
} else {
    refreshSsotSurfaces();
}

fetch("/api/content/principal")
    .then(function (response) {
        if (!response.ok) {
            return null;
        }
        return response.json();
    })
    .then(function (content) {
        if (content) {
            window.__bookletContent = content;
            fillBookletFromContent(content);
            applyBookletLeadership();
        }
    })
    .catch(function () {});

function fillBookletFromSettings(data) {
    var schoolName = data.school.name || "متوسطة سعد بن الربيع الأنصاري";
    bookletSchoolName = schoolName;
    document.querySelectorAll(".school-name").forEach(function (node) {
        node.textContent = schoolName;
    });
    var ready = {};
    try {
        ready = JSON.parse(sessionStorage.getItem("planReady") || "{}");
    } catch (error) {
        ready = {};
    }
    var typeLabels = {
        operational: "الخطة التشغيلية",
        executive: "الخطة التنفيذية",
        monitoring: "خطة المتابعة والتقييم"
    };
    var fullType = typeLabels[ready.plan_type] || "الخطة التشغيلية";
    var kind = fullType.replace(/^الخطة\s*/, "").replace(/^خطة\s*/, "");
    var kindNode = document.getElementById("cover-plan-kind");
    if (kindNode) {
        kindNode.textContent = kind;
    }
    var shortName = schoolName.replace(/^متوسطة\s*/, "");
    var schoolNameNode = document.getElementById("cover-school-name");
    if (schoolNameNode) {
        schoolNameNode.textContent = "لمدرسة " + shortName;
    }
    applyPlanOwner(activeRole || "principal");
    var stripe = document.getElementById("cover-stripe-text");
    var yearNode = document.getElementById("cover-year");
    var yearText = yearNode ? yearNode.textContent.replace("للعام الدراسي ", "") : "1448هـ";
    if (stripe) {
        stripe.textContent = "الخطة " + kind + " " + yearText;
    }
    var profileName = document.getElementById("profile-name");
    if (profileName) {
        profileName.textContent = schoolName;
    }
    var facility = {};
    try {
        facility = JSON.parse(localStorage.getItem("board1059.facility") || "null") || {};
    } catch (error) {
        facility = {};
    }
    var fields = {
        "profile-number": data.school.statistical_number || facility.statisticalNumber,
        "profile-stage": facility.stage,
        "profile-admin": data.school.education_administration || facility.educationAdministration,
        "profile-address": [facility.district, facility.address].filter(Boolean).join("، "),
        "profile-phone": facility.phone,
        "profile-email": facility.email,
        "profile-building": data.school.building_type || facility.buildingType,
        "profile-classrooms": data.school.classrooms || facility.classroomCount,
        "profile-labs": data.school.labs || facility.labCount,
        "profile-halls": data.school.sports_halls,
        "profile-students": data.school.total_students,
        "profile-staff": data.school.total_staff,
        "profile-founded": [facility.foundedHijri, facility.foundedGregorian].filter(Boolean).join(" — ")
    };
    Object.keys(fields).forEach(function (id) {
        var node = document.getElementById(id);
        var value = fields[id];
        if (node && value !== undefined && value !== null && String(value).trim() !== "") {
            node.textContent = value;
        }
    });
    var team = document.getElementById("booklet-team");
    if (!team) {
        return;
    }
    team.innerHTML = "";
    function addTeamRow(name, role) {
        if (!name || seen[name]) {
            return;
        }
        seen[name] = true;
        var row = document.createElement("tr");
        [name, role || "", ""].forEach(function (value) {
            var cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });
        team.appendChild(row);
    }
    var savedRoles = {};
    ((data.committee && data.committee.members) || []).forEach(function (person) {
        if (person.name) {
            savedRoles[person.name] = person.role || "";
        }
    });
    var seen = {};
    addTeamRow(principalName(data.principal_name), "مدير المدرسة");
    (data.deputies || []).forEach(function (person) {
        addTeamRow(person.name, savedRoles[person.name] || person.role);
    });
    (data.participants || []).forEach(function (person) {
        addTeamRow(person.name, savedRoles[person.name] || person.role);
    });
    var academicSign = document.getElementById("sign-academic");
    var studentsSign = document.getElementById("sign-students");
    var principalSign = document.getElementById("sign-principal");
    (data.deputies || []).forEach(function (person) {
        var role = person.role || "";
        if (academicSign && role.indexOf("تعليم") !== -1) {
            academicSign.textContent = person.name;
        }
        if (studentsSign && role.indexOf("طلاب") !== -1) {
            studentsSign.textContent = person.name;
        }
    });
    if (principalSign && !principalSign.textContent.trim()) {
        principalSign.textContent = principalName(data.principal_name);
    }
    applyPlanOwner(activeRole || "principal");
    applyBookletLeadership();
}

function savedCalendarYear() {
    try {
        var calendar = JSON.parse(localStorage.getItem("board1059.calendar") || "null");
        if (calendar && calendar.year) {
            return String(calendar.year).replace(/هـ/g, "").trim();
        }
    } catch (error) {
        return "";
    }
    return "";
}

function applyBookletLeadership() {
    var leadership = {};
    try {
        leadership = JSON.parse(localStorage.getItem("board1059.leadership") || "null") || {};
    } catch (error) {
        leadership = {};
    }
    var rows = [
        [liveLeadershipName(leadership.principal), "مدير المدرسة"],
        [liveLeadershipName(leadership.schoolVice), "وكيل الشؤون المدرسية"],
        [liveLeadershipName(leadership.studentsVice), "وكيل شؤون الطلاب"],
        [window.dataHub && window.dataHub.displayWritten ? window.dataHub.displayWritten(leadership.educationalGuide) : liveLeadershipName(leadership.educationalGuide), "الموجه التربوي"],
        [liveLeadershipName(leadership.studentCounselor), "الموجه الطلابي"]
    ].filter(function (pair) {
        return pair[0] && String(pair[0]).trim();
    });
    var team = document.getElementById("booklet-team");
    if (team && rows.length) {
        team.innerHTML = "";
        rows.forEach(function (pair) {
            var row = document.createElement("tr");
            [pair[0], pair[1]].forEach(function (value) {
                var cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });
            var sign = document.createElement("td");
            var src = "";
            if (pair[1].indexOf("مدير") !== -1) {
                src = "signatures/sig_manager.png";
            } else if (pair[1].indexOf("طلاب") !== -1) {
                src = "signatures/sig_students.png";
            } else if (pair[1].indexOf("مدرس") !== -1) {
                src = "signatures/sig_teachers.png";
            }
            if (src) {
                var image = document.createElement("img");
                image.className = "sig-image";
                image.alt = "التوقيع";
                image.src = src;
                image.addEventListener("error", function () { image.remove(); });
                sign.appendChild(image);
            }
            row.appendChild(sign);
            team.appendChild(row);
        });
    }
    var principalNameShown = liveLeadershipName(leadership.principal);
    var author = document.getElementById("cover-author");
    if (author) {
        author.textContent = principalNameShown ? "إعداد: مدير المدرسة / " + principalNameShown : "إعداد: مدير المدرسة";
    }
    var introSign = document.getElementById("intro-sign");
    if (introSign) {
        introSign.textContent = "";
        if (principalNameShown) {
            var nameLine = document.createElement("span");
            nameLine.textContent = principalNameShown;
            var caption = document.createElement("span");
            caption.textContent = "التوقيع";
            var image = document.createElement("img");
            image.className = "sig-image";
            image.alt = "";
            image.src = "signatures/sig_manager.png";
            image.addEventListener("error", function () { image.remove(); });
            var roleLine = document.createElement("span");
            roleLine.textContent = "مدير " + bookletSchoolName;
            introSign.appendChild(nameLine);
            introSign.appendChild(caption);
            introSign.appendChild(image);
            introSign.appendChild(roleLine);
        } else {
            introSign.textContent = "مدير " + bookletSchoolName;
        }
    }
    var principalSign = document.getElementById("sign-principal");
    if (principalSign) {
        principalSign.textContent = principalNameShown;
    }
    var academicSign = document.getElementById("sign-academic");
    var schoolViceName = liveLeadershipName(leadership.schoolVice);
    if (academicSign && schoolViceName) {
        academicSign.textContent = schoolViceName;
    }
    var studentsSign = document.getElementById("sign-students");
    var studentsViceName = liveLeadershipName(leadership.studentsVice);
    if (studentsSign && studentsViceName) {
        studentsSign.textContent = studentsViceName;
    }
}

window.addEventListener("dataChanged", function (event) {
    var src = event && event.detail && event.detail.source;
    if (!src || src === "metrics" || src === "nafs" || src === "indicators" || src === "settings") {
        refreshSsotSurfaces();
    }
    var source = event.detail && event.detail.source;
    if (source === "staff" || source === "leadership") {
        applyBookletLeadership();
        if (planRolePicker) {
            applyPlanOwner(planRolePicker.value || "principal");
        }
    }
});

var planRolePicker = document.getElementById("plan-role");
if (planRolePicker) planRolePicker.addEventListener("change", function (event) {
    var role = event.target.value;
    applyPlanOwner(role);
    if (plans[role] && typeof selectRole === "function") {
        selectRole(role);
    }
});

function fillBookletFromContent(content) {
    var calendarYear = savedCalendarYear();
    var year = document.getElementById("cover-year");
    if (year && content.academic_year && !calendarYear) {
        year.textContent = "للعام الدراسي " + content.academic_year;
    }
    var stripe = document.getElementById("cover-stripe-text");
    var kindNode = document.getElementById("cover-plan-kind");
    if (stripe && content.academic_year && !calendarYear) {
        stripe.textContent = "الخطة " + (kindNode ? kindNode.textContent : "التشغيلية") + " " + content.academic_year;
    }
    var intro = document.getElementById("intro-columns");
    if (intro && content.introduction && content.introduction.paragraphs) {
        intro.innerHTML = "";
        content.introduction.paragraphs.forEach(function (paragraph) {
            var block = document.createElement("p");
            block.textContent = paragraph;
            intro.appendChild(block);
        });
    }
    var title = document.getElementById("intro-title");
    if (title && content.introduction && content.introduction.title) {
        title.textContent = content.introduction.title;
    }
    var vision = document.getElementById("booklet-vision");
    if (vision && content.vision) {
        vision.textContent = content.vision.text || "";
    }
    var mission = document.getElementById("booklet-mission");
    if (mission && content.mission) {
        mission.textContent = content.mission.text || "";
    }
    var values = document.getElementById("booklet-values");
    if (values && content.values) {
        values.innerHTML = "";
        content.values.forEach(function (item) {
            if (!item.name) {
                return;
            }
            var line = document.createElement("li");
            line.textContent = item.name;
            values.appendChild(line);
        });
    }
    var domains = document.getElementById("booklet-domains");
    var scoreBody = document.querySelector("#booklet-domain-scores tbody");
    var items = content.strategic_domains && content.strategic_domains.items;
    if (domains && items) {
        domains.innerHTML = "";
        items.forEach(function (domain) {
            var domainName = String(domain.name || "").replace(/^مجال\s*/, "");
            (domain.sub_domains || []).forEach(function (sub) {
                if (!sub) {
                    return;
                }
                var row = document.createElement("tr");
                [domainName, sub, ""].forEach(function (value) {
                    var cell = document.createElement("td");
                    cell.textContent = value;
                    row.appendChild(cell);
                });
                domains.appendChild(row);
            });
        });
    }
    if (scoreBody && items) {
        scoreBody.innerHTML = "";
        items.forEach(function (domain) {
            var row = document.createElement("tr");
            [String(domain.name || "").replace(/^مجال\s*/, ""), "", ""].forEach(function (value) {
                var cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });
            scoreBody.appendChild(row);
        });
    }
    if (window.PerformanceBind) {
        PerformanceBind.load().then(function (metrics) {
            PerformanceBind.fillDomainScoreTable(document, metrics);
            PerformanceBind.fillNafesTable(document, metrics);
            PerformanceBind.renderStrip(document.getElementById("ssot-metrics-strip"), metrics);
        });
    }
}

function renderSessionBar() {
    var nameNode = document.getElementById("command-user-name");
    var roleNode = document.getElementById("command-user-role");
    var raw = sessionStorage.getItem("sessionUser");
    if (!raw) {
        if (nameNode) nameNode.textContent = "";
        if (roleNode) roleNode.textContent = "";
        return;
    }
    var user;
    try {
        user = JSON.parse(raw);
    } catch (error) {
        return;
    }
    if (!user || !user.name) {
        return;
    }
    if (nameNode) nameNode.textContent = user.name;
    if (roleNode) roleNode.textContent = user.role || "";
    var button = document.getElementById("session-switch");
    var roles = user.roles || [];
    if (!button) {
        return;
    }
    button.hidden = roles.length < 2;
    button.textContent = "تبديل الصلاحية";
    button.title = user.role ? "الصلاحية الحالية: " + user.role : "تبديل الصلاحية";
    button.onclick = function () {
        var index = roles.indexOf(user.role);
        if (index < 0) {
            index = 0;
        }
        user.role = roles[(index + 1) % roles.length];
        sessionStorage.setItem("sessionUser", JSON.stringify(user));
        if (typeof registerPreviewRole !== "undefined") {
            registerPreviewRole = "";
        }
        renderSessionBar();
        if (window.applyRoleView) {
            window.applyRoleView();
        }
        renderRegistersPortal();
    };
}

function refreshDualRoles() {
    var account = sessionAccount();
    if (!account || !account.id) {
        return;
    }
    fetch("/api/staff-directory")
        .then(function (response) {
            return response.ok ? response.json() : { people: [] };
        })
        .then(function (payload) {
            var person = null;
            (payload.people || []).forEach(function (item) {
                if (String(item.id) === String(account.id)) {
                    person = item;
                }
            });
            if (!person || !person.roles || person.roles.length < 2) {
                return;
            }
            var stored = account.roles || [];
            var changed = stored.length !== person.roles.length;
            person.roles.forEach(function (role) {
                if (stored.indexOf(role) === -1) {
                    changed = true;
                }
            });
            if (!changed && stored.indexOf(account.role) !== -1) {
                return;
            }
            account.roles = person.roles.slice();
            var kept = String(account.role || "");
            if (person.roles.indexOf(kept) === -1 && kept.indexOf("مدير") !== 0) {
                account.role = person.roles[0];
            }
            sessionStorage.setItem("sessionUser", JSON.stringify(account));
            renderSessionBar();
        })
        .catch(function () {
            return null;
        });
}

renderSessionBar();
refreshDualRoles();

var themeButton = document.getElementById("theme-toggle");

function paintTheme(mode) {
    var dark = mode === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    if (themeButton) {
        themeButton.textContent = dark ? "☀️" : "🌙";
        themeButton.title = dark ? "الوضع الفاتح" : "الوضع الداكن";
    }
}

paintTheme(localStorage.getItem("theme1059") || "light");
if (themeButton) {
    themeButton.addEventListener("click", function () {
        var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        localStorage.setItem("theme1059", next);
        paintTheme(next);
    });
}

function mountHomeShell() {
    var main = document.querySelector(".app-main");
    if (!main || document.getElementById("home-dashboard")) {
        return;
    }
    var alerts = document.getElementById("section-c");
    var measure = document.getElementById("measurement-center");
    if (alerts) {
        alerts.classList.add("layout-dashboard__alerts", "dashboard-alerts");
    }
    if (measure) {
        measure.classList.add("layout-dashboard__kpi");
        measure.hidden = false;
    }
    var registers = document.createElement("section");
    registers.id = "home-registers";
    registers.className = "layout-dashboard__registers dashboard-registers";
    registers.setAttribute("aria-label", "السجلات التسعة");
    var dash = document.createElement("div");
    dash.id = "home-dashboard";
    dash.className = "layout-dashboard";
    if (alerts) {
        dash.appendChild(alerts);
    }
    if (measure) {
        dash.appendChild(measure);
    }
    dash.appendChild(registers);
    var workspace = document.createElement("div");
    workspace.id = "workspace";
    workspace.className = "workspace";
    while (main.firstChild) {
        workspace.appendChild(main.firstChild);
    }
    main.appendChild(dash);
    main.appendChild(workspace);
}

mountHomeShell();

var HOME_REGISTERS = [
    "academic_care",
    "behavior_cases",
    "student_portfolio",
    "discipline_register",
    "activity_plan",
    "lab_register",
    "employee_leave_register",
    "results_analysis",
    "gifted_care"
];

function paintHomeRegisters() {
    var host = document.getElementById("home-registers");
    if (!host || !registerCatalog.length) {
        return;
    }
    var items = HOME_REGISTERS.map(function (id) {
        return registerCatalog.filter(function (item) {
            return item.id === id;
        })[0];
    }).filter(Boolean);
    registerCatalog.forEach(function (item) {
        if (!items.some(function (entry) {
            return entry.id === item.id;
        })) {
            items.push(item);
        }
    });
    host.innerHTML = "";
    items.forEach(function (item) {
        var rate = window.WidgetControllers ? WidgetControllers.rateForRegister(item.id) : 0;
        var info = window.WidgetControllers ? WidgetControllers.state(rate) : { key: "critical", label: "حرج" };
        var status = info.key === "excellent" ? "excellent" : info.key === "critical" ? "critical" : "progress";
        var card = document.createElement("article");
        card.className = "status-card reg-card";
        card.setAttribute("data-status", status);
        card.setAttribute("data-register", item.id);
        var title = document.createElement("h3");
        title.textContent = item.title;
        var state = document.createElement("span");
        state.className = "status-badge";
        state.textContent = info.label;
        var meter = document.createElement("div");
        meter.className = "progress";
        meter.setAttribute("role", "progressbar");
        meter.setAttribute("aria-valuemin", "0");
        meter.setAttribute("aria-valuemax", "100");
        meter.setAttribute("aria-valuenow", String(rate));
        var fill = document.createElement("span");
        fill.className = "progress__fill";
        fill.style.width = Math.max(0, Math.min(100, Number(rate) || 0)) + "%";
        meter.appendChild(fill);
        var percent = document.createElement("span");
        percent.className = "status-rate";
        percent.textContent = rate + "%";
        var button = document.createElement("button");
        button.type = "button";
        button.setAttribute("data-open-register", item.id);
        button.textContent = "عرض";
        card.appendChild(title);
        card.appendChild(state);
        card.appendChild(meter);
        card.appendChild(percent);
        card.appendChild(button);
        host.appendChild(card);
    });
}

var sidebarToggle = document.getElementById("sidebar-toggle");

function paintSidebar(mini) {
    document.body.classList.toggle("sidebar-mini", !!mini);
    if (!sidebarToggle) {
        return;
    }
    sidebarToggle.textContent = mini ? "⟩" : "⟨";
    sidebarToggle.title = mini ? "توسيع القائمة" : "طي القائمة";
}

document.querySelectorAll(".app-sidebar .nav-item").forEach(function (link) {
    var label = link.querySelector(".nav-item__label");
    if (label && !link.getAttribute("title")) {
        link.setAttribute("title", label.textContent.replace(/\s+/g, " ").trim());
    }
});
document.querySelectorAll(".app-sidebar .nav-item.disabled").forEach(function (link) {
    link.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);
});
paintSidebar(localStorage.getItem("sidebar1059") === "mini");
if (sidebarToggle) {
    sidebarToggle.addEventListener("click", function () {
        var mini = !document.body.classList.contains("sidebar-mini");
        localStorage.setItem("sidebar1059", mini ? "mini" : "full");
        paintSidebar(mini);
    });
}

document.querySelectorAll(".app-sidebar [data-nav]").forEach(function (link) {
    link.addEventListener("click", function (event) {
        event.preventDefault();
        if (link.classList.contains("disabled")) {
            return;
        }
        var nav = link.getAttribute("data-nav");
        if (nav === "home") {
            setDashboardView("home");
        } else if (nav === "registers") {
            setDashboardView("registers");
        } else if (nav === "committees") {
            setDashboardView("committees");
        } else if (nav === "measurement" || nav === "etec" || nav === "charts") {
            setDashboardView("measurement");
        } else {
            setDashboardView("plans");
        }
        document.querySelectorAll(".app-sidebar .nav-item").forEach(function (item) {
            item.classList.remove("active");
        });
        link.classList.add("active");
        var target = null;
        if (nav === "tasks") {
            target = document.getElementById("results") || document.getElementById("plan-role");
        } else if (nav === "etec") {
            target = document.getElementById("chart-domains");
        } else if (nav === "charts") {
            target = document.querySelector(".kpi-grid");
        } else if (nav === "noor") {
            target = document.getElementById("students-import-card");
        } else if (nav === "users") {
            target = document.getElementById("command-user");
        }
        if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    });
});

var registerCatalog = [];
var registerPreviewRole = "";

var REGISTER_GROUPS = {
    vice_academic: ["results_analysis", "exam_committees", "kpi_monitoring", "schedule_and_substitution_register"],
    vice_students: ["discipline_register", "behavior_cases", "student_leave"],
    counselor: ["academic_care", "gifted_care", "case_study", "counseling_programs"],
    activity: ["activity_plan", "competitions_register"],
    gifted: ["gifted_care", "competitions_register"],
    lab: ["lab_register"],
    resources: ["learning_resources_register", "lrr_learning_resources"],
    admin_assistant: ["leave_register", "admin_communications", "employee_leave_register", "school_fund_register"],
    teacher: ["class_followup", "teacher_portfolio", "personal_leave"]
};

var DELEGATION_ROLES = [
    { value: "", label: "شبكة السجلات كاملة" },
    { value: "وكيل الشؤون التعليمية", label: "وكيل الشؤون التعليمية" },
    { value: "وكيل شؤون الطلاب", label: "وكيل شؤون الطلاب" },
    { value: "الموجه الطلابي", label: "الموجه الطلابي" },
    { value: "رائد النشاط", label: "رائد النشاط" },
    { value: "محضر المختبر", label: "محضر المختبر" },
    { value: "أمين مصادر التعلم والحاسب", label: "أمين مصادر التعلم والحاسب" },
    { value: "المساعد الإداري", label: "المساعد الإداري" },
    { value: "المعلم", label: "المعلم" }
];

function sessionAccount() {
    var raw = sessionStorage.getItem("sessionUser");
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch (error) {
        return null;
    }
}

function registerGroup(role) {
    var text = role || "";
    if (text.indexOf("مسؤول النظام") !== -1 || text.indexOf("مدير") !== -1) {
        return "all";
    }
    if (text.indexOf("الشؤون التعليمية") !== -1) {
        return "vice_academic";
    }
    if (text.indexOf("شؤون الطلاب") !== -1) {
        return "vice_students";
    }
    if (text.indexOf("موجه") !== -1) {
        return "counselor";
    }
    if (text.indexOf("نشاط") !== -1) {
        return "activity";
    }
    if (text.indexOf("موهوب") !== -1) {
        return "gifted";
    }
    if (text.indexOf("مصادر") !== -1) {
        return "resources";
    }
    if (text.indexOf("محضر مختبر") !== -1 || text.indexOf("محضر المختبر") !== -1) {
        return "lab";
    }
    if (text.indexOf("مساعد") !== -1) {
        return "admin_assistant";
    }
    if (text.indexOf("معلم") !== -1) {
        return "teacher";
    }
    return "none";
}

function visibleRegisters() {
    var account = sessionAccount();
    var role = registerPreviewRole || (account ? account.role : "");
    if (window.roleRuleFor) {
        var rule = window.roleRuleFor(role);
        if (rule && rule.registers === "*") {
            return registerCatalog.slice();
        }
        if (rule && rule.registers && rule.registers.length) {
            return registerCatalog.filter(function (item) {
                return rule.registers.indexOf(item.id) !== -1;
            });
        }
    }
    var group = registerGroup(role);
    if (group === "all") {
        return registerCatalog.slice();
    }
    var allowed = REGISTER_GROUPS[group] || [];
    return registerCatalog.filter(function (item) {
        return allowed.indexOf(item.id) !== -1;
    });
}

function pad2(value) {
    var text = String(value);
    return text.length < 2 ? "0" + text : text;
}

var HIJRI_MONTHS = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
var GREGORIAN_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
var HIJRI_WEEK = ["سبت", "أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];

function formatDayMonthYear(day, month, year, suffix) {
    return pad2(day) + "/" + pad2(month) + "/" + year + (suffix || "");
}

function formatHijriNamed(day, month, year) {
    var monthName = HIJRI_MONTHS[Number(month) - 1] || String(month);
    return Number(day) + " " + monthName + " " + year + "هـ";
}

function formatGregorianNamed(day, month, year) {
    var monthName = GREGORIAN_MONTHS[Number(month) - 1] || String(month);
    return Number(day) + " " + monthName + " " + year + "م";
}

function dateFromIso(iso) {
    var date = iso ? new Date(iso + "T12:00:00") : new Date();
    if (isNaN(date.getTime())) {
        date = new Date();
    }
    return date;
}

function hijriParts(iso) {
    var parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(dateFromIso(iso));
    function pick(type) {
        var found = parts.filter(function (part) { return part.type === type; })[0];
        return found ? found.value : "";
    }
    return {
        day: pick("day"),
        month: pick("month"),
        year: String(pick("year")).replace(/[^\d]/g, "")
    };
}

function hijriFromDate(iso) {
    var parts = hijriParts(iso);
    return formatHijriNamed(parts.day, parts.month, parts.year);
}

function gregorianFromDate(iso) {
    var date = dateFromIso(iso);
    return formatGregorianNamed(date.getDate(), date.getMonth() + 1, date.getFullYear());
}

function monthIndexFromName(name, months) {
    var target = String(name || "").replace(/\s+/g, " ").trim();
    var index = months.indexOf(target);
    if (index >= 0) {
        return index + 1;
    }
    var compact = target.replace(/\s/g, "");
    for (index = 0; index < months.length; index += 1) {
        if (months[index].replace(/\s/g, "") === compact) {
            return index + 1;
        }
    }
    return 0;
}

function parseDayMonthYear(text) {
    var raw = String(text || "").trim();
    if (!raw) {
        return null;
    }
    var numeric = raw.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/);
    if (numeric) {
        return { day: Number(numeric[1]), month: Number(numeric[2]), year: Number(numeric[3]) };
    }
    var named = raw.match(/(\d{1,2})\s+([^\d\/]+?)\s+(\d{4})/);
    if (!named) {
        return null;
    }
    var monthName = named[2].replace(/[هـم]/g, "").trim();
    var hijriMonth = monthIndexFromName(monthName, HIJRI_MONTHS);
    var gregMonth = monthIndexFromName(monthName, GREGORIAN_MONTHS);
    var month = hijriMonth || gregMonth;
    if (!month) {
        return null;
    }
    return { day: Number(named[1]), month: month, year: Number(named[3]), named: true, calendar: hijriMonth ? "hijri" : "gregorian" };
}

function isoFromGregorianText(text) {
    var raw = String(text || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }
    if (raw.indexOf("ه") >= 0) {
        return "";
    }
    var parts = parseDayMonthYear(raw);
    if (!parts) {
        return "";
    }
    if (parts.named && parts.calendar === "hijri") {
        return "";
    }
    if (parts.year >= 1300 && parts.year <= 1600 && raw.indexOf("م") < 0) {
        return "";
    }
    var date = new Date(parts.year, parts.month - 1, parts.day);
    if (date.getFullYear() !== parts.year || date.getMonth() !== parts.month - 1 || date.getDate() !== parts.day) {
        return "";
    }
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}

function isoFromHijriText(text) {
    var parts = parseDayMonthYear(text);
    if (!parts || parts.year < 1300 || parts.year > 1600) {
        return "";
    }
    if (parts.named && parts.calendar === "gregorian") {
        return "";
    }
    var gregorianYear = Math.round(parts.year + 622 - parts.year / 33);
    var estimate = new Date(gregorianYear, 0, 1);
    var delta = 0;
    for (delta = -40; delta <= 420; delta += 1) {
        var candidate = new Date(estimate.getFullYear(), estimate.getMonth(), estimate.getDate() + delta);
        var iso = candidate.getFullYear() + "-" + pad2(candidate.getMonth() + 1) + "-" + pad2(candidate.getDate());
        var found = hijriParts(iso);
        if (Number(found.day) === parts.day && Number(found.month) === parts.month && Number(found.year) === parts.year) {
            return iso;
        }
    }
    return "";
}

function looksHijriDateText(text) {
    var raw = String(text || "").trim();
    if (!raw) {
        return false;
    }
    if (raw.indexOf("ه") >= 0) {
        return true;
    }
    if (raw.indexOf("م") >= 0) {
        return false;
    }
    var parts = parseDayMonthYear(raw);
    if (parts && parts.named && parts.calendar === "hijri") {
        return true;
    }
    if (parts && parts.year >= 1300 && parts.year <= 1600) {
        return true;
    }
    var yearFirst = raw.match(/(\d{4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
    if (yearFirst) {
        var yearValue = Number(yearFirst[1]);
        return yearValue >= 1300 && yearValue <= 1600;
    }
    return false;
}

function formatDisplayDate(text, prefer) {
    var raw = String(text || "").trim();
    if (!raw) {
        return "";
    }
    var wantHijri = prefer === "hijri" || (prefer !== "gregorian" && looksHijriDateText(raw));
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return wantHijri ? hijriFromDate(raw) : gregorianFromDate(raw);
    }
    if (wantHijri) {
        var hijriIso = isoFromHijriText(raw);
        if (hijriIso) {
            return hijriFromDate(hijriIso);
        }
        var hijriParts = parseDayMonthYear(raw);
        if (hijriParts && hijriParts.year >= 1300 && hijriParts.year <= 1600) {
            return formatHijriNamed(hijriParts.day, hijriParts.month, hijriParts.year);
        }
    }
    var gregIso = isoFromGregorianText(raw);
    if (gregIso) {
        return gregorianFromDate(gregIso);
    }
    var gregParts = parseDayMonthYear(raw);
    if (gregParts && (!wantHijri || gregParts.year < 1300 || gregParts.year > 1600)) {
        return formatGregorianNamed(gregParts.day, gregParts.month, gregParts.year);
    }
    return normalizeDateOrder(raw) || raw;
}

function formatDisplayDateRange(start, end, prefer) {
    var first = formatDisplayDate(start, prefer);
    var last = end ? formatDisplayDate(end, prefer) : "";
    if (!last || last === first) {
        return first;
    }
    return first + " – " + last;
}

function normalizeDateOrder(text) {
    var raw = String(text || "").trim();
    if (!raw) {
        return "";
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return gregorianFromDate(raw);
    }
    if (looksHijriDateText(raw)) {
        var hijriIso = isoFromHijriText(raw);
        if (hijriIso) {
            return hijriFromDate(hijriIso);
        }
        var hijriParts = parseDayMonthYear(raw);
        if (hijriParts) {
            return formatHijriNamed(hijriParts.day, hijriParts.month, hijriParts.year);
        }
    }
    var gregIso = isoFromGregorianText(raw);
    if (gregIso) {
        return gregorianFromDate(gregIso);
    }
    var yearFirst = raw.match(/(\d{4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
    if (yearFirst) {
        var yearValue = Number(yearFirst[1]);
        var suffix = raw.indexOf("ه") >= 0 ? "هـ" : (raw.indexOf("م") >= 0 ? "م" : "");
        if (suffix === "هـ" || (yearValue >= 1300 && yearValue <= 1600)) {
            var asHijri = isoFromHijriText(yearFirst[3] + "/" + yearFirst[2] + "/" + yearFirst[1]);
            return asHijri ? hijriFromDate(asHijri) : formatHijriNamed(yearFirst[3], yearFirst[2], yearFirst[1]);
        }
        var asGreg = isoFromGregorianText(yearFirst[3] + "/" + yearFirst[2] + "/" + yearFirst[1]);
        return asGreg ? gregorianFromDate(asGreg) : formatGregorianNamed(yearFirst[3], yearFirst[2], yearFirst[1]);
    }
    var namedAlready = parseDayMonthYear(raw);
    if (namedAlready && namedAlready.named) {
        return namedAlready.calendar === "hijri"
            ? formatHijriNamed(namedAlready.day, namedAlready.month, namedAlready.year)
            : formatGregorianNamed(namedAlready.day, namedAlready.month, namedAlready.year);
    }
    return raw;
}

function syncDualDateField(field) {
    if (!field || !field.classList) {
        return;
    }
    var hijriSide = field.classList.contains("doc-hijri");
    var gregSide = field.classList.contains("doc-date-picker");
    if (!hijriSide && !gregSide) {
        return;
    }
    var box = (field.closest && (field.closest(".dual-date-pair") || field.closest("label"))) || field.parentElement;
    if (!box) {
        return;
    }
    var hijriField = box.querySelector(".doc-hijri");
    var gregField = box.querySelector(".doc-date-picker");
    if (gregSide && gregField) {
        var gregorianIso = isoFromGregorianText(gregField.value);
        if (!gregorianIso) {
            return;
        }
        gregField.value = gregorianFromDate(gregorianIso);
        if (hijriField) {
            hijriField.value = hijriFromDate(gregorianIso);
        }
        var gregNative = box.querySelector(".date-picker-native");
        if (gregNative) {
            gregNative.value = gregorianIso;
        }
        return;
    }
    if (hijriSide && hijriField) {
        var hijriIso = isoFromHijriText(hijriField.value);
        if (!hijriIso) {
            return;
        }
        hijriField.value = hijriFromDate(hijriIso);
        if (gregField) {
            gregField.value = gregorianFromDate(hijriIso);
        }
    }
    var native = box.querySelector(".date-picker-native");
    var syncedIso = gregField ? isoFromGregorianText(gregField.value) : "";
    if (native && syncedIso) {
        native.value = syncedIso;
    }
}

function dateField(ref) {
    if (!ref) {
        return null;
    }
    if (typeof ref === "string") {
        return document.getElementById(ref);
    }
    return ref;
}

var hijriPopup = null;
var hijriPopupField = null;
var hijriView = { year: 1448, month: 1 };
var gregPopup = null;
var gregPopupField = null;
var gregView = { year: 2026, month: 1 };

function isoFromDate(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}

function yearOptionsHtml(start, end, selected) {
    var html = "";
    var year;
    for (year = start; year <= end; year += 1) {
        html += '<option value="' + year + '"' + (year === selected ? " selected" : "") + ">" + year + "</option>";
    }
    return html;
}

function monthOptionsHtml(months, selected) {
    return months.map(function (name, index) {
        var value = index + 1;
        return '<option value="' + value + '"' + (value === selected ? " selected" : "") + ">" + name + "</option>";
    }).join("");
}

function placePopup(popup, anchor, width) {
    var rect = anchor.getBoundingClientRect();
    var left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width));
    var top = rect.bottom + 8;
    if (top + 420 > window.innerHeight) {
        top = Math.max(12, rect.top - 420);
    }
    popup.style.left = left + "px";
    popup.style.top = top + "px";
    popup.style.width = width + "px";
}

function hijriMonthDays(year, month) {
    var first = isoFromHijriText("01/" + pad2(month) + "/" + year);
    if (!first) {
        return [];
    }
    var cursor = new Date(first + "T12:00:00");
    var days = [];
    var guard = 0;
    while (guard < 31) {
        var iso = isoFromDate(cursor);
        var parts = hijriParts(iso);
        if (Number(parts.year) !== year || Number(parts.month) !== month) {
            break;
        }
        days.push({
            day: Number(parts.day),
            label: hijriFromDate(iso),
            weekday: cursor.getDay()
        });
        cursor.setDate(cursor.getDate() + 1);
        guard += 1;
    }
    return days;
}

function closeHijriPopup() {
    if (hijriPopup) {
        hijriPopup.hidden = true;
    }
    hijriPopupField = null;
}

function closeGregPopup() {
    if (gregPopup) {
        gregPopup.hidden = true;
    }
    gregPopupField = null;
}

function paintHijriPopup() {
    var popup = hijriPopup;
    var yearSelect = popup.querySelector("[data-hijri-year]");
    var monthSelect = popup.querySelector("[data-hijri-month]");
    if (yearSelect && String(yearSelect.value) !== String(hijriView.year)) {
        yearSelect.value = String(hijriView.year);
    }
    if (monthSelect && String(monthSelect.value) !== String(hijriView.month)) {
        monthSelect.value = String(hijriView.month);
    }
    var days = hijriMonthDays(hijriView.year, hijriView.month);
    var cells = "";
    var index = 0;
    if (days.length) {
        var lead = (days[0].weekday + 1) % 7;
        for (index = 0; index < lead; index += 1) {
            cells += "<span></span>";
        }
        days.forEach(function (item) {
            cells += '<button type="button" data-hijri-day="' + item.label + '">' + item.day + "</button>";
        });
    }
    popup.querySelector(".hijri-popup-days").innerHTML = cells;
}

function paintGregPopup() {
    var popup = gregPopup;
    var yearSelect = popup.querySelector("[data-greg-year]");
    var monthSelect = popup.querySelector("[data-greg-month]");
    if (yearSelect && String(yearSelect.value) !== String(gregView.year)) {
        yearSelect.value = String(gregView.year);
    }
    if (monthSelect && String(monthSelect.value) !== String(gregView.month)) {
        monthSelect.value = String(gregView.month);
    }
    var first = new Date(gregView.year, gregView.month - 1, 1);
    var daysInMonth = new Date(gregView.year, gregView.month, 0).getDate();
    var lead = (first.getDay() + 1) % 7;
    var cells = "";
    var index;
    for (index = 0; index < lead; index += 1) {
        cells += "<span></span>";
    }
    for (index = 1; index <= daysInMonth; index += 1) {
        var iso = gregView.year + "-" + pad2(gregView.month) + "-" + pad2(index);
        cells += '<button type="button" data-greg-day="' + iso + '">' + index + "</button>";
    }
    popup.querySelector(".greg-popup-days").innerHTML = cells;
}

function ensureHijriPopup() {
    if (hijriPopup) {
        return hijriPopup;
    }
    var popup = document.createElement("div");
    popup.className = "hijri-popup date-popup";
    popup.hidden = true;
    popup.innerHTML = ""
        + '<div class="date-popup-bar">'
        + '<button type="button" data-hijri-nav="-1" aria-label="الشهر السابق">›</button>'
        + '<div class="date-popup-selects">'
        + '<label><span>السنة</span><select data-hijri-year aria-label="السنة الهجرية"></select></label>'
        + '<label><span>الشهر</span><select data-hijri-month aria-label="الشهر الهجري"></select></label>'
        + "</div>"
        + '<button type="button" data-hijri-nav="1" aria-label="الشهر التالي">‹</button>'
        + "</div>"
        + '<div class="hijri-popup-week"></div><div class="hijri-popup-days"></div>';
    popup.querySelector(".hijri-popup-week").innerHTML = HIJRI_WEEK.map(function (name) {
        return "<span>" + name + "</span>";
    }).join("");
    popup.querySelector("[data-hijri-year]").innerHTML = yearOptionsHtml(1435, 1460, hijriView.year);
    popup.querySelector("[data-hijri-month]").innerHTML = monthOptionsHtml(HIJRI_MONTHS, hijriView.month);
    document.body.appendChild(popup);
    popup.addEventListener("change", function (event) {
        if (event.target.matches("[data-hijri-year]")) {
            hijriView.year = Number(event.target.value);
            paintHijriPopup();
            return;
        }
        if (event.target.matches("[data-hijri-month]")) {
            hijriView.month = Number(event.target.value);
            paintHijriPopup();
        }
    });
    popup.addEventListener("click", function (event) {
        var nav = event.target.closest ? event.target.closest("[data-hijri-nav]") : null;
        if (nav) {
            hijriView.month += Number(nav.getAttribute("data-hijri-nav"));
            if (hijriView.month > 12) {
                hijriView.month = 1;
                hijriView.year += 1;
            }
            if (hijriView.month < 1) {
                hijriView.month = 12;
                hijriView.year -= 1;
            }
            paintHijriPopup();
            return;
        }
        var day = event.target.closest ? event.target.closest("[data-hijri-day]") : null;
        if (!day || !hijriPopupField) {
            return;
        }
        hijriPopupField.value = day.getAttribute("data-hijri-day");
        syncDualDateField(hijriPopupField);
        closeHijriPopup();
    });
    document.addEventListener("click", function (event) {
        if (!hijriPopup || hijriPopup.hidden) {
            return;
        }
        if (hijriPopup.contains(event.target)) {
            return;
        }
        if (event.target.closest && event.target.closest(".hijri-picker-open")) {
            return;
        }
        closeHijriPopup();
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeHijriPopup();
            closeGregPopup();
        }
    });
    hijriPopup = popup;
    return popup;
}

function ensureGregPopup() {
    if (gregPopup) {
        return gregPopup;
    }
    var popup = document.createElement("div");
    popup.className = "greg-popup date-popup";
    popup.hidden = true;
    popup.innerHTML = ""
        + '<div class="date-popup-bar">'
        + '<button type="button" data-greg-nav="-1" aria-label="الشهر السابق">›</button>'
        + '<div class="date-popup-selects">'
        + '<label><span>السنة</span><select data-greg-year aria-label="السنة الميلادية"></select></label>'
        + '<label><span>الشهر</span><select data-greg-month aria-label="الشهر الميلادي"></select></label>'
        + "</div>"
        + '<button type="button" data-greg-nav="1" aria-label="الشهر التالي">‹</button>'
        + "</div>"
        + '<div class="greg-popup-week"></div><div class="greg-popup-days"></div>';
    popup.querySelector(".greg-popup-week").innerHTML = HIJRI_WEEK.map(function (name) {
        return "<span>" + name + "</span>";
    }).join("");
    popup.querySelector("[data-greg-year]").innerHTML = yearOptionsHtml(2018, 2035, gregView.year);
    popup.querySelector("[data-greg-month]").innerHTML = monthOptionsHtml(GREGORIAN_MONTHS, gregView.month);
    document.body.appendChild(popup);
    popup.addEventListener("change", function (event) {
        if (event.target.matches("[data-greg-year]")) {
            gregView.year = Number(event.target.value);
            paintGregPopup();
            return;
        }
        if (event.target.matches("[data-greg-month]")) {
            gregView.month = Number(event.target.value);
            paintGregPopup();
        }
    });
    popup.addEventListener("click", function (event) {
        var nav = event.target.closest ? event.target.closest("[data-greg-nav]") : null;
        if (nav) {
            gregView.month += Number(nav.getAttribute("data-greg-nav"));
            if (gregView.month > 12) {
                gregView.month = 1;
                gregView.year += 1;
            }
            if (gregView.month < 1) {
                gregView.month = 12;
                gregView.year -= 1;
            }
            paintGregPopup();
            return;
        }
        var day = event.target.closest ? event.target.closest("[data-greg-day]") : null;
        if (!day || !gregPopupField) {
            return;
        }
        var iso = day.getAttribute("data-greg-day");
        gregPopupField.value = gregorianFromDate(iso);
        var native = gregPopupField.parentNode ? gregPopupField.parentNode.querySelector(".date-picker-native") : null;
        if (native) {
            native.value = iso;
        }
        syncDualDateField(gregPopupField);
        closeGregPopup();
    });
    document.addEventListener("click", function (event) {
        if (!gregPopup || gregPopup.hidden) {
            return;
        }
        if (gregPopup.contains(event.target)) {
            return;
        }
        if (event.target.closest && event.target.closest(".greg-picker-open")) {
            return;
        }
        closeGregPopup();
    });
    gregPopup = popup;
    return popup;
}

function openHijriPopup(field, anchor) {
    closeGregPopup();
    var parts = parseDayMonthYear(field.value);
    if (parts && parts.year >= 1300 && parts.year <= 1600 && parts.month >= 1 && parts.month <= 12) {
        hijriView.year = parts.year;
        hijriView.month = parts.month;
    } else {
        var today = hijriParts(todayIso());
        hijriView.year = Number(today.year);
        hijriView.month = Number(today.month);
    }
    hijriPopupField = field;
    ensureHijriPopup();
    paintHijriPopup();
    hijriPopup.hidden = false;
    placePopup(hijriPopup, anchor, 340);
}

function openGregPopup(field, anchor) {
    closeHijriPopup();
    var iso = isoFromGregorianText(field.value) || todayIso();
    var date = dateFromIso(iso);
    gregView.year = date.getFullYear();
    gregView.month = date.getMonth() + 1;
    gregPopupField = field;
    ensureGregPopup();
    paintGregPopup();
    gregPopup.hidden = false;
    placePopup(gregPopup, anchor, 340);
}

function attachDatePicker(gregField) {
    if (!gregField || gregField.dataset.pickerReady === "1") {
        return;
    }
    gregField.dataset.pickerReady = "1";
    gregField.placeholder = "مثال: 30 أغسطس 2026م";
    var slot = document.createElement("span");
    slot.className = "date-picker-slot";
    gregField.parentNode.insertBefore(slot, gregField);
    slot.appendChild(gregField);
    var native = document.createElement("input");
    native.type = "date";
    native.className = "date-picker-native";
    native.tabIndex = -1;
    native.setAttribute("aria-hidden", "true");
    var current = isoFromGregorianText(gregField.value);
    if (current) {
        native.value = current;
        gregField.value = gregorianFromDate(current);
    }
    var button = document.createElement("button");
    button.type = "button";
    button.className = "date-picker-open greg-picker-open";
    button.setAttribute("aria-label", "اختيار التاريخ الميلادي");
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect><path d="M8 3.5v4M16 3.5v4M3.5 10h17"></path></svg>';
    slot.appendChild(button);
    slot.appendChild(native);
    button.addEventListener("click", function () {
        if (gregPopup && !gregPopup.hidden && gregPopupField === gregField) {
            closeGregPopup();
            return;
        }
        openGregPopup(gregField, button);
    });
    native.addEventListener("change", function () {
        if (!native.value) {
            return;
        }
        gregField.value = gregorianFromDate(native.value);
        syncDualDateField(gregField);
    });
}

function attachHijriPicker(hijriField) {
    if (!hijriField || hijriField.dataset.hijriReady === "1") {
        return;
    }
    hijriField.dataset.hijriReady = "1";
    hijriField.placeholder = "مثال: 17 ربيع الأول 1448هـ";
    var current = isoFromHijriText(hijriField.value);
    if (current) {
        hijriField.value = hijriFromDate(current);
    }
    var slot = document.createElement("span");
    slot.className = "date-picker-slot";
    hijriField.parentNode.insertBefore(slot, hijriField);
    slot.appendChild(hijriField);
    var button = document.createElement("button");
    button.type = "button";
    button.className = "date-picker-open hijri-picker-open";
    button.setAttribute("aria-label", "اختيار التاريخ الهجري");
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect><path d="M8 3.5v4M16 3.5v4M3.5 10h17"></path></svg>';
    slot.appendChild(button);
    button.addEventListener("click", function () {
        if (hijriPopup && !hijriPopup.hidden && hijriPopupField === hijriField) {
            closeHijriPopup();
            return;
        }
        openHijriPopup(hijriField, button);
    });
}

function syncHijriGregorianDates(gregorianRef, hijriRef) {
    var gregField = dateField(gregorianRef);
    var hijriField = dateField(hijriRef);
    if (!gregField || !hijriField) {
        return;
    }
    attachDatePicker(gregField);
    attachHijriPicker(hijriField);
    if (isoFromGregorianText(gregField.value)) {
        syncDualDateField(gregField);
        return;
    }
    if (isoFromHijriText(hijriField.value)) {
        syncDualDateField(hijriField);
    }
}

function bindDualDatePickers(root) {
    var scope = root || document;
    var pairs = [];
    if (scope.matches && scope.matches(".dual-date-pair")) {
        pairs = [scope];
    } else if (scope.querySelectorAll) {
        pairs = Array.prototype.slice.call(scope.querySelectorAll(".dual-date-pair"));
    }
    pairs.forEach(function (pair) {
        var gregField = pair.querySelector(".doc-date-picker");
        var hijriField = pair.querySelector(".doc-hijri");
        if (gregField) {
            attachDatePicker(gregField);
        }
        if (hijriField) {
            attachHijriPicker(hijriField);
        }
    });
}

function watchDualDates() {
    bindDualDatePickers(document);
    var observer = new MutationObserver(function (records) {
        records.forEach(function (record) {
            Array.prototype.forEach.call(record.addedNodes, function (node) {
                if (!node || node.nodeType !== 1) {
                    return;
                }
                bindDualDatePickers(node);
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function todayIso() {
    var date = new Date();
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}

function nextDocumentCode() {
    var current = Number(sessionStorage.getItem("docSerial1059") || "0") + 1;
    sessionStorage.setItem("docSerial1059", String(current));
    var text = String(current);
    while (text.length < 3) {
        text = "0" + text;
    }
    return "ق-1448-" + text;
}

function nextStandardCode(prefix) {
    var key = "serial1059-" + prefix;
    var current = Number(sessionStorage.getItem(key) || "0") + 1;
    sessionStorage.setItem(key, String(current));
    var text = String(current);
    while (text.length < 4) {
        text = "0" + text;
    }
    return prefix + "-1448-" + text;
}

function documentMetaHtml(serial) {
    var iso = todayIso();
    return '<div class="doc-meta-row"><label>رقم المعاملة / القرار <input class="doc-number" data-label="رقم الوثيقة" value="' + escapeHeader(serial || nextDocumentCode()) + '"></label>' +
        '<label class="dual-date">التاريخ <span class="dual-date-pair">' +
        '<input class="doc-hijri" data-label="التاريخ الهجري" placeholder="مثال: 17 ربيع الأول 1448هـ" value="' + escapeHeader(hijriFromDate(iso)) + '">' +
        '<input class="doc-date-picker" data-label="التاريخ الميلادي" placeholder="مثال: 30 أغسطس 2026م" value="' + escapeHeader(gregorianFromDate(iso)) + '">' +
        '</span></label></div>';
}

function registerHeader(fixed, serial) {
    var data = fixed || {};
    var school = bookletSchoolName || data.school || "متوسطة سعد بن الربيع الأنصاري";
    var admin = bookletAdmin || "الإدارة العامة للتعليم بمنطقة المدينة المنورة";
    var meta = (typeof documentMetaHtml === "function") ? documentMetaHtml(serial) : "";
    if (window.OfficialFrameCore && typeof window.OfficialFrameCore.header === "function") {
        return window.OfficialFrameCore.header({
            school: school,
            admin: admin,
            year: data.year || "1448هـ",
            metaHtml: meta
        });
    }
    return "<header class=\"doc-official-header\">"
        + "<div class=\"header-logo-right\">"
        + "<img src=\"/assets/ministry_logo.png\" alt=\"وزارة التعليم\">"
        + "</div>"
        + "<div class=\"header-center-titles\">"
        + "<div>المملكة العربية السعودية</div>"
        + "<div>وزارة التعليم</div>"
        + "<div>" + escapeHeader(admin) + "</div>"
        + "<div class=\"school-name-title\">" + escapeHeader(school) + "</div>"
        + "<div>العام الدراسي " + escapeHeader(data.year || "1448هـ") + "</div>"
        + "<div style=\"margin-top:4px; font-size:0.75rem; color:#475569;\">" + meta + "</div>"
        + "</div>"
        + "<div class=\"header-logo-left\">"
        + "<img src=\"/assets/vision_2030.png\" alt=\"رؤية 2030\">"
        + "</div>"
        + "</header>"
        + "<div class=\"header-divider-bar\"></div>";
}

var registerLookup = {
    curriculum_middle_school: { grades: [], subjects: [], lessons_by_grade: {} },
    dropdowns_by_register: {},
    system_metadata: {}
};

var REGISTER_LOOKUP_KEYS = {
    academic_care: "counselor_care",
    counseling_programs: "counselor_care",
    case_study: "counselor_care",
    gifted_care: "counselor_care",
    activity_plan: "activity_register",
    behavior_cases: "behavior_cases",
    discipline_register: "discipline_register",
    student_leave: "discipline_register",
    lab_register: "lab_register",
    competitions_register: "competitions_register",
    learning_resources_register: "learning_resources_register",
    results_analysis: "results_analysis",
    class_followup: "class_followup",
    teacher_portfolio: "class_followup",
    kpi_monitoring: "results_analysis",
    admin_communications: "counselor_care"
};

function lookupMeta() {
    return registerLookup.system_metadata || {};
}

function officeDisplayName() {
    return (bookletOffice || "").trim();
}

function resolveLookupText(value) {
    var token = lookupMeta().office_name_token || "{{office_name}}";
    return String(value || "").split(token).join(officeDisplayName());
}

function lookupPack(registerId) {
    var key = REGISTER_LOOKUP_KEYS[registerId] || registerId;
    return (registerLookup.dropdowns_by_register || {})[key] || {};
}

function curriculumBank() {
    return registerLookup.curriculum_middle_school || {};
}

function weekOptions() {
    var count = termWeekCount >= 10 && termWeekCount <= 20 ? termWeekCount : 18;
    var options = [];
    var week;
    for (week = 1; week <= count; week += 1) {
        options.push("الأسبوع " + week);
    }
    return options;
}

function sessionPersonName() {
    var account = sessionAccount();
    if (!account || !account.name) {
        try {
            account = JSON.parse(sessionStorage.getItem("currentUser") || "{}");
        } catch (error) {
            account = null;
        }
    }
    return account && account.name ? String(account.name).trim() : "";
}

function activityExecutorName() {
    var account = sessionAccount();
    var leader = lookupMeta().activity_leader || "محمد حامد عماش السهلي";
    if (account && account.role && account.role.indexOf("نشاط") !== -1 && account.name) {
        return account.name;
    }
    return leader;
}

function uniqueLookup(list) {
    var found = [];
    (list || []).forEach(function (item) {
        var text = resolveLookupText(item);
        if (text && found.indexOf(text) === -1) {
            found.push(text);
        }
    });
    return found;
}

function mergedLookup(keys) {
    var found = [];
    var packs = registerLookup.dropdowns_by_register || {};
    Object.keys(packs).forEach(function (name) {
        keys.forEach(function (key) {
            found = found.concat(packs[name][key] || []);
        });
    });
    return uniqueLookup(found);
}

function firstLookup(pack, keys) {
    var found = null;
    keys.forEach(function (key) {
        if (!found && pack[key] && pack[key].length) {
            found = pack[key];
        }
    });
    return found ? uniqueLookup(found) : null;
}

function nafesRubricSkills() {
    var bank = window.SKILLS_BY_SUBJECT || {};
    var found = [];
    ["لغتي", "الرياضيات", "العلوم"].forEach(function (subject) {
        Object.keys(bank[subject] || {}).forEach(function (skill) {
            found.push(subject + " — " + skill);
        });
    });
    return found;
}

function optionsForColumn(registerId, column) {
    if (registerId === "student_portfolio" && column === "محك التقييم") {
        return nafesRubricSkills();
    }
    if (registerId === "student_portfolio" && column === "مستوى التحقق") {
        return ["متقن ✅", "نامٍ 🟡", "يحتاج دعم 🔴"];
    }
    if (window.dictionaryChoices) {
        var dictated = dictionaryChoices(registerId, column);
        if (dictated && dictated.length) {
            return dictated;
        }
    }
    var pack = lookupPack(registerId);
    var curriculum = curriculumBank();
    if (column === "الصف") {
        return curriculum.grades || [];
    }
    if (column === "المادة") {
        return curriculum.subjects || [];
    }
    if (column === "الأسبوع" && registerId === "activity_plan") {
        return weekOptions();
    }
    var named = {
        "نوع الرعاية": ["case_type"],
        "نوع الحالة": ["case_type"],
        "وصف الحالة": ["case_description"],
        "نوع الحادثة": ["case_description"],
        "الوصف": ["case_description", "observation", "analysis_note"],
        "البند": ["skill", "evidence_kind"],
        "الإجراء": ["program_type", "action"],
        "الإجراء الفوري": ["action"],
        "المجال": ["field"],
        "النشاط": ["program_classification"],
        "النوع": ["program_classification"],
        "تصنيف البرنامج": ["program_classification"],
        "البرنامج": ["program_type"],
        "البرامج الإثرائية": ["program_classification", "program_type"],
        "نوع المواظبة": ["attendance_type"],
        "متطلبات الأمن والسلامة": ["experiment_safety"],
        "نوع المشاركة": ["participation_type"],
        "نوع التفعيل": ["activation_type"],
        "مستوى الإتقان": ["mastery_level"],
        "مستوى التحقق": ["mastery_level"],
        "محك التقييم": ["skill"],
        "الحصة": ["period_slot"],
        "الغرض": ["purpose"],
        "الشاهد": ["witness_type", "witness", "evidence_kind"],
        "الشواهد": ["witness", "witness_type"],
        "نوع الشاهد": ["witness_type", "evidence_kind", "witness"],
        "الملاحظة": ["observation", "analysis_note", "note_kind"],
        "الملاحظات": ["note_kind", "observation"],
        "المبرر": ["absence_reason"],
        "الفترة": ["period"],
        "النتيجة": ["care_result", "result"],
        "المتابعة": ["follow_up"],
        "المكان": ["place"],
        "أداة الاكتشاف": ["evidence_kind"],
        "المواد والأدوات": ["tool"],
        "الشراكات المجتمعية": ["audience"],
        "جلسات المرشد الفردية": ["session_type", "program_type"],
        "قرار اللجنة": ["committee_decision"],
        "الحالة": ["status"],
        "الجهة": ["referral"],
        "الموضوع": ["program_classification"]
    };
    var keys = named[column];
    if (!keys) {
        return null;
    }
    return firstLookup(pack, keys) || mergedLookup(keys);
}

function lessonsForSelection(grade, subject) {
    var tree = (curriculumBank().lessons_by_grade || {})[grade] || {};
    return tree[subject] || [];
}

function selectMarkup(label, options, className, selected) {
    var html = '<select data-label="' + escapeHeader(label) + '" class="register-select' + (className ? " " + className : "") + '">';
    html += '<option value=""></option>';
    (options || []).forEach(function (option) {
        var text = resolveLookupText(option);
        html += '<option value="' + escapeHeader(text) + '"' + (text === selected ? " selected" : "") + ">" + escapeHeader(text) + "</option>";
    });
    html += "</select>";
    return html;
}

function etecDomain(name) {
    var domains = (registerLookup.etec_framework || {}).domains || [];
    var found = null;
    domains.forEach(function (domain) {
        if (domain.display_name === name || domain.official_name === name) {
            found = domain;
        }
    });
    return found;
}

function standardLabels(name) {
    var domain = etecDomain(name);
    if (!domain) {
        return [];
    }
    return (domain.standards || []).map(function (standard) {
        return standard.code + " " + standard.name;
    });
}

function domainTableMarkup(domainName, registerId) {
    var labels = standardLabels(domainName);
    var rows = labels.length ? labels : ["", ""];
    var head = "<tr><th>المعيار</th><th>الشاهد</th><th>الحالة</th></tr>";
    var body = rows.map(function (label) {
        var standardCell = labels.length ? selectMarkup("المعيار", labels, "", label) : cellControl(registerId, "المعيار");
        return "<tr><td>" + standardCell + "</td><td>" + cellControl(registerId, "الشاهد") + "</td><td>" + cellControl(registerId, "الحالة") + "</td></tr>";
    }).join("");
    return '<table class="register-editor-table"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
}

function prefilledValue(registerId, column) {
    if (column === "المنفذ" && registerId === "activity_plan") {
        return activityExecutorName();
    }
    if (column === "رائد النشاط") {
        return lookupMeta().activity_leader || "محمد حامد عماش السهلي";
    }
    if (column === "المنفذ" || column === "المعلم" || column === "اسم المعلم") {
        return sessionPersonName();
    }
    return "";
}

function executorMarkup(selected) {
    var names = window.ProgressEngine ? ProgressEngine.individuals.map(function (person) {
        return person.name;
    }) : [];
    var current = selected || sessionPersonName() || activityExecutorName();
    if (current && names.indexOf(current) === -1) {
        names.unshift(current);
    }
    var html = '<select data-label="المنفذ" class="register-select">';
    html += '<option value=""></option>';
    names.forEach(function (name) {
        html += '<option value="' + escapeHeader(name) + '"' + (name === current ? " selected" : "") + ">" + escapeHeader(name) + "</option>";
    });
    html += "</select>";
    return html;
}

function cadreSelect(label, selected) {
    var names = window.ProgressEngine ? ProgressEngine.individuals.map(function (person) {
        return person.name;
    }) : [];
    if (selected && names.indexOf(selected) === -1) {
        names.unshift(selected);
    }
    var html = '<select data-label="' + escapeHeader(label) + '" class="register-select">';
    html += '<option value=""></option>';
    names.forEach(function (name) {
        html += '<option value="' + escapeHeader(name) + '"' + (name === selected ? " selected" : "") + ">" + escapeHeader(name) + "</option>";
    });
    html += "</select>";
    return html;
}

function cellControl(registerId, column) {
    if (registerId === "activity_plan" && column === "المنفذ") {
        return executorMarkup(sessionPersonName() || activityExecutorName());
    }
    if (column === "رائد النشاط") {
        return cadreSelect(column, lookupMeta().activity_leader || "محمد حامد عماش السهلي");
    }
    if (column === "المعلم المستفيد") {
        return cadreSelect(column, "");
    }
    if (column === "المحضر / المشرف" || column === "أمين المصادر / المشرف" || column === "الموجه / المعلم المُسجل" || column === "الموجه الطلابي" || column === "المعلم المُسجل" || column === "المعلم / الموجه المُسجل" || column === "المنفذ" || column === "المعلم" || column === "اسم المعلم") {
        return cadreSelect(column, sessionPersonName());
    }
    if (column === "الفصل") {
        return selectMarkup(column, ["1", "2", "3", "4"], "student-section");
    }
    if (column === "المادة") {
        return selectMarkup("المادة", curriculumBank().subjects || [], "register-subject");
    }
    if (column === "المهارة") {
        return selectMarkup("المهارة", [], "register-skill");
    }
    if (column === "الموضوع / الدرس" || column === "الموضوع / النشاط") {
        return selectMarkup(column, [], "register-lesson");
    }
    if (column === "الطالب" || column === "اسم الطالب" || column === "اسم المتعلم") {
        return '<select class="student-name register-select" data-label="' + escapeHeader(column) + '"><option value=""></option></select>';
    }
    if (column === "الملاحظات" || column === "الملاحظة" || column === "الوصف" || column === "المبرر" || column === "البند" || column === "نوع الشاهد") {
        var listed = optionsForColumn(registerId, column);
        if (listed && listed.length) {
            return selectMarkup(column, listed);
        }
        return '<input data-label="' + escapeHeader(column) + '" type="text" value="">';
    }
    var options = optionsForColumn(registerId, column);
    if (options) {
        var markup = selectMarkup(column, options, column === "الصف" ? "register-grade" : "");
        if (registerId === "activity_plan" && column === "المجال") {
            markup += '<button class="btn-unified-back no-print add-same-field" type="button">+ إضافة نشاط لنفس المجال</button>';
        }
        return markup;
    }
    return '<input data-label="' + escapeHeader(column) + '" type="text" value="' + escapeHeader(prefilledValue(registerId, column)) + '">';
}

function fieldInputs(fields, registerId) {
    return (fields || []).map(function (label) {
        return "<label>" + escapeHeader(label) + cellControl(registerId, label) + "</label>";
    }).join("");
}

function tableMarkup(columns, rows, registerId) {
    var head = "<tr>" + columns.map(function (column) {
        return "<th>" + escapeHeader(column) + "</th>";
    }).join("") + "</tr>";
    var body = "";
    var count = rows || 4;
    var index;
    for (index = 0; index < count; index += 1) {
        body += "<tr>" + columns.map(function (column) {
            return "<td>" + cellControl(registerId, column) + "</td>";
        }).join("") + "</tr>";
    }
    return '<table class="register-editor-table"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
}

function registerProgressKey(registerId) {
    var keys = {
        leave_register: "leave",
        personal_leave: "leave",
        results_analysis: "results",
        activity_plan: "activity",
        academic_care: "care"
    };
    return keys[registerId] || registerId || "register";
}

function registerProgressBar(registerId) {
    var spans = "";
    var index;
    for (index = 0; index < 10; index += 1) {
        spans += "<span></span>";
    }
    return '<div class="register-progress" data-register-progress="' + registerProgressKey(registerId) + '" role="meter" aria-label="نسبة تعبئة السجل" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' + spans + "</div>";
}

function registerIdentityNote(item) {
    var caption = "النموذج";
    if (item && item.id === "student_portfolio") {
        caption = "نموذج متابعة متعلم";
    } else if (item && item.title) {
        caption = item.title;
    }
    return '<p class="register-identity">' + escapeHeader(caption) + "</p>";
}

function fillSelect(select, options, current) {
    var markup = '<option value=""></option>';
    options.forEach(function (option) {
        markup += '<option value="' + escapeHeader(option) + '">' + escapeHeader(option) + "</option>";
    });
    select.innerHTML = markup;
    if (options.indexOf(current) !== -1) {
        select.value = current;
    }
}

function skillsForSubject(subject) {
    var bank = window.SKILLS_BY_SUBJECT || {};
    return Object.keys(bank[subject] || {});
}

function lessonsForSkill(subject, skill, grade) {
    var bank = window.SKILLS_BY_SUBJECT || {};
    var lessons = ((bank[subject] || {})[skill]) || [];
    if (!lessons.length) {
        return lessonsForSelection(grade, subject);
    }
    if (!grade) {
        return lessons;
    }
    var inGrade = lessonsForSelection(grade, subject);
    var filtered = lessons.filter(function (lesson) {
        return inGrade.indexOf(lesson) !== -1;
    });
    return filtered.length ? filtered : lessons;
}

function bindLessonSelects(root) {
    root.querySelectorAll("tr, .register-section").forEach(function (row) {
        var grade = row.querySelector(".register-grade");
        var subject = row.querySelector(".register-subject");
        var skill = row.querySelector(".register-skill");
        var lesson = row.querySelector(".register-lesson");
        if (!subject) {
            return;
        }
        var refreshSkills = function () {
            if (!skill) {
                return;
            }
            fillSelect(skill, skillsForSubject(subject.value), skill.value);
            refreshLessons();
        };
        var refreshLessons = function () {
            if (!lesson) {
                return;
            }
            fillLessons(lesson, subject.value, skill ? skill.value : "", grade ? grade.value : "", lesson.value);
        };
        subject.addEventListener("change", refreshSkills);
        if (skill) {
            skill.addEventListener("change", refreshLessons);
        }
        if (grade) {
            grade.addEventListener("change", refreshLessons);
        }
    });
}

function fillLessons(lesson, subject, skill, grade, current) {
    fillSelect(lesson, lessonsForSkill(subject, skill, grade), current);
}

var contentScenarios = [];

var contentReady = fetch("/api/registers-content")
    .then(function (response) {
        return response.ok ? response.json() : { scenarios: [] };
    })
    .then(function (payload) {
        contentScenarios = payload.scenarios || [];
    })
    .catch(function () {
        contentScenarios = [];
    });

function scenarioFor(value) {
    var text = resolveLookupText(value || "");
    var found = null;
    contentScenarios.forEach(function (item) {
        if (resolveLookupText(item.trigger) === text) {
            found = item;
        }
    });
    return found;
}

function classStudentCount(row) {
    var grade = row ? row.querySelector(".register-grade") : null;
    if (grade && grade.value) {
        return String(Math.max(1, Math.round(bookletStudents / 3)));
    }
    return String(bookletStudents);
}

function achievementRate(row) {
    if (!row) {
        return "";
    }
    var body = row.closest(".register-form-body");
    var meter = body ? body.querySelector("[data-register-progress]") : null;
    if (meter && meter.getAttribute("data-register-progress") !== "activity") {
        var marked = meter.getAttribute("aria-valuenow") || "";
        if (marked && marked !== "0") {
            return marked;
        }
    }
    var fields = row.querySelectorAll("select, input");
    var total = 0;
    var filled = 0;
    Array.prototype.forEach.call(fields, function (field) {
        if (field.classList && (field.classList.contains("doc-number") || field.classList.contains("doc-hijri") || field.classList.contains("doc-date-picker"))) {
            return;
        }
        total += 1;
        if (String(field.value || "").trim()) {
            filled += 1;
        }
    });
    if (!total || !filled) {
        return "";
    }
    return String(Math.round((filled / total) * 100));
}

function fillScenarioText(template, row) {
    var grade = row && row.querySelector(".register-grade") ? row.querySelector(".register-grade").value : "";
    var activity = row && row.querySelector('[data-label="النشاط"]') ? row.querySelector('[data-label="النشاط"]').value : "";
    var count = grade ? classStudentCount(row) : "";
    var completion = achievementRate(row);
    var text = resolveLookupText(template || "")
        .replace(/\{\{grade\}\}/g, grade || "الصف")
        .replace(/\{\{class_students\}\}/g, count)
        .replace(/\{\{completion\}\}/g, completion)
        .replace(/\{\{activity\}\}/g, activity || "النشاط")
        .replace(/\{\{school_name\}\}/g, bookletSchoolName);
    if (!count) {
        text = text.replace(/وعددهم\s*(?:\{\{class_students\}\}\s*)?(?:طالباً\s*)?/g, "");
        text = text.replace(/،\s*وعدد الطلاب\s*[،.]/g, "،");
    }
    if (!completion) {
        text = text.replace(/،?\s*ونسبة الإنجاز\s*%\.?/g, "");
    }
    return text.replace(/\s{2,}/g, " ").replace(" .", ".").replace("،.", ".").trim();
}

function scenarioMarkup() {
    return '<div class="scenario-box">' +
        '<label>وصف الإجراء وخطوات التنفيذ<textarea class="scenario-steps" data-label="خطوات التنفيذ"></textarea></label>' +
        '<label>الأثر المتحقق والنتائج بالأرقام<textarea class="scenario-impact" data-label="الأثر الرقمي"></textarea></label>' +
        '<a class="evidence-link-btn" target="_blank" href="#">توثيق الشاهد ↗</a>' +
        "</div>";
}

function refreshScenarioLink(box, row) {
    var link = box.querySelector(".evidence-link-btn");
    if (!link) {
        return;
    }
    var action = row ? row.querySelector('[data-label="الإجراء"], [data-label="النشاط"], [data-label="نوع الرعاية"], [data-label="وصف الحالة"], [data-label="نوع المشاركة"]') : null;
    link.href = evidencePortalUrl({
        title: action ? action.value : "",
        steps: box.querySelector(".scenario-steps").value,
        impact: box.querySelector(".scenario-impact").value
    });
}

var contextualBank = { domains: [], templates: [] };
var contextualReady = fetch("/banks/contextual_impact_bank.json")
    .then(function (response) {
        return response.ok ? response.json() : { templates: [] };
    })
    .then(function (payload) {
        contextualBank = payload || contextualBank;
        if (window.refreshPlanChoices) {
            refreshPlanChoices();
        }
    })
    .catch(function () {
        contextualBank = { domains: [], templates: [] };
    });

function contextualDomain(value) {
    var text = value || "";
    if (text.indexOf("رياضيات") !== -1 || text.indexOf("علوم") !== -1 || text.indexOf("علم") !== -1 || text.indexOf("نافس") !== -1 || text.indexOf("تحصيل") !== -1 || text.indexOf("متأخر") !== -1 || text.indexOf("متفوق") !== -1 || text.indexOf("صعوبات") !== -1) {
        return "علمي";
    }
    if (text.indexOf("رياض") !== -1) {
        return "رياضي";
    }
    if (text.indexOf("وطن") !== -1) {
        return "وطني";
    }
    if (text.indexOf("سلوك") !== -1 || text.indexOf("اجتماع") !== -1 || text.indexOf("غياب") !== -1 || text.indexOf("إرشاد") !== -1 || text.indexOf("توجيه") !== -1) {
        return "سلوكي";
    }
    return "";
}

function contextualForRow(row) {
    if (!row) {
        return null;
    }
    var domain = "";
    row.querySelectorAll('[data-label="المجال"], [data-label="نوع الرعاية"], [data-label="وصف الحالة"], [data-label="نوع المشاركة"], [data-label="المادة"], [data-label="البرنامج"]').forEach(function (node) {
        if (!domain) {
            domain = contextualDomain(node.value);
        }
    });
    var activity = "";
    row.querySelectorAll('[data-label="النشاط"], [data-label="الموضوع / الدرس"], [data-label="الموضوع / النشاط"], [data-label="الإجراء"]').forEach(function (node) {
        if (!activity && node.value) {
            activity = node.value;
        }
    });
    if (!domain) {
        return null;
    }
    var exact = null;
    var fallback = null;
    (contextualBank.templates || []).forEach(function (item) {
        if (item.domain !== domain) {
            return;
        }
        if (item.activity && item.activity === activity) {
            exact = item;
        }
        if (!item.activity) {
            fallback = item;
        }
    });
    return exact || fallback;
}

function applyScenario(select) {
    var labels = ["الإجراء", "النشاط", "نوع الرعاية", "وصف الحالة", "نوع المشاركة", "المجال"];
    if (labels.indexOf(select.getAttribute("data-label")) === -1) {
        return;
    }
    var row = select.closest("tr");
    var contextual = contextualForRow(row);
    var scenario = scenarioFor(select.value);
    if (!contextual && !scenario) {
        return;
    }
    var cell = select.closest("td") || select.parentElement;
    if (!cell) {
        return;
    }
    var box = cell.querySelector(".scenario-box");
    if (!box) {
        cell.insertAdjacentHTML("beforeend", scenarioMarkup());
        box = cell.querySelector(".scenario-box");
    }
    var steps = box.querySelector(".scenario-steps");
    var impact = box.querySelector(".scenario-impact");
    var sourceSteps = contextual && contextual.steps && contextual.steps.length ? contextual.steps : ((scenario && (scenario.execution_steps || scenario.steps)) || []);
    var sourceImpact = contextual ? (contextual.impact || "") : "";
    steps.value = sourceSteps.map(function (step, index) {
        return (index + 1) + ". " + fillScenarioText(step, row);
    }).join("\n");
    impact.value = fillScenarioText(sourceImpact, row);
    refreshScenarioLink(box, row);
}

function bindScenarios(root) {
    if (root.dataset.scenariosBound === "1") {
        return;
    }
    root.dataset.scenariosBound = "1";
    root.addEventListener("change", function (event) {
        if (event.target && event.target.classList && (event.target.classList.contains("doc-date-picker") || event.target.classList.contains("doc-hijri"))) {
            syncDualDateField(event.target);
        }
        if (event.target && event.target.matches("select")) {
            applyScenario(event.target);
            if (window.ProgressEngine) {
                ProgressEngine.sync(root);
            }
        }
    });
    root.addEventListener("input", function (event) {
        var box = event.target.closest ? event.target.closest(".scenario-box") : null;
        if (box) {
            refreshScenarioLink(box, event.target.closest("tr"));
        }
    });
    root.addEventListener("click", function (event) {
        var button = event.target.closest ? event.target.closest(".add-same-field") : null;
        if (!button) {
            return;
        }
        var row = button.closest("tr");
        var clone = row.cloneNode(true);
        clone.classList.add("support-activity");
        Array.prototype.forEach.call(clone.querySelectorAll("input, textarea"), function (field) {
            if (field.getAttribute("data-label") === "المنفذ") {
                return;
            }
            field.value = "";
        });
        var sourceDomain = row.querySelector('[data-label="المجال"]');
        var clonedDomain = clone.querySelector('[data-label="المجال"]');
        if (sourceDomain && clonedDomain) {
            clonedDomain.value = sourceDomain.value;
        }
        var sourceExecutor = row.querySelector('[data-label="المنفذ"]');
        var clonedExecutor = clone.querySelector('[data-label="المنفذ"]');
        if (clonedExecutor) {
            clonedExecutor.value = (sourceExecutor && sourceExecutor.value) || sessionPersonName() || activityExecutorName();
        }
        var box = clone.querySelector(".scenario-box");
        if (box) {
            box.remove();
        }
        row.after(clone);
        if (window.ProgressEngine) {
            ProgressEngine.sync(root);
        }
    });
}

function specialistVice() {
    return { name: "هاني مسعود سعيد الأحمدي", signature: "signatures/sig_1018745529.png" };
}

function signatureImage(path) {
    if (!path) {
        return "";
    }
    return '<img class="sig-image" src="' + escapeHeader(path) + '" alt="" onerror="this.remove()">';
}

var APPROVAL_SIGNATURES = [
    { role: "وكيل شؤون المعلمين", name: "أ. محمد بن فايز الجابري", signature: "signatures/sig_teachers.png" },
    { role: "وكيل شؤون الطلاب", name: "أ. خالد بن علي الجابري", signature: "signatures/sig_students.png" },
    { role: "مدير المدرسة", name: "أ. نايف بن سمير حجيف المخلفي", signature: "signatures/sig_manager.png" }
];

function approvalSignoffHtml() {
    if (window.OfficialFrameCore && typeof window.OfficialFrameCore.signoff === "function") {
        return window.OfficialFrameCore.signoff({
            school: bookletSchoolName,
            columns: APPROVAL_SIGNATURES
        });
    }
    var columns = APPROVAL_SIGNATURES.map(function (person) {
        return "<div class=\"signoff-col\">"
            + "<span class=\"role-title\">اعتماد: " + escapeHeader(person.role) + "</span>"
            + "<div class=\"sig-placeholder\">" + signatureImage(person.signature) + "</div>"
            + "<span class=\"person-name\">" + escapeHeader(person.name) + "</span>"
            + "</div>";
    }).join("");
    return "<footer class=\"doc-signoff-block\">"
        + "<div class=\"signoff-title-bar\">التوقيعات والاعتمادات</div>"
        + "<div class=\"signoff-grid\">" + columns + "</div>"
        + "<div class=\"doc-bottom-bar\">"
        + "<span>وثيقة رسمية — " + escapeHeader(bookletSchoolName) + "</span>"
        + "<span>الصفحة 1 من 1</span>"
        + "</div></footer>";
}

function officialSignoff() {
    return approvalSignoffHtml();
}

function signaturePathFor(name) {
    var person = staffRecord(name);
    var pattern = (assignmentTemplates.signatures_protocol || {}).path_pattern || "signatures/sig_{nid}.png";
    return person.id ? pattern.split("{nid}").join(person.id) : "";
}

function paintClassroomVisit(item) {
    var editor = document.getElementById("register-editor");
    var fixed = item.fixed || {};
    editor.innerHTML = '<div class="register-editor-head"><h3>' + escapeHeader(item.title) + '</h3>' +
        '<button class="btn-unified-primary" type="button" id="register-print">🖨️ طباعة النموذج الرسمي</button></div>' +
        '<div class="official-document-frame register-form-body">' + registerHeader(fixed) + "</div>";
    editor.hidden = false;
    editor.dataset.registerId = item.id;
    window.mountClassroomVisit(editor.querySelector(".register-form-body"));
    document.getElementById("register-print").addEventListener("click", function () {
        printRegister(item);
    });
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
}

var STANDARD_REGISTER_CODES = {
    academic_care: "ACR",
    behavior_cases: "BCR",
    gifted_care: "GCR",
    lab_register: "LER",
    activity_plan: "APR"
};

function paintStandardRegister(item) {
    var editor = document.getElementById("register-editor");
    var fixed = item.fixed || {};
    var code = STANDARD_REGISTER_CODES[item.id];
    editor.innerHTML = '<div class="register-editor-head"><h3>' + escapeHeader(item.title) + '</h3>' +
        '<button class="btn-unified-primary" type="button" id="register-print">🖨️ طباعة النموذج الرسمي</button></div>' +
        '<div class="official-document-frame register-form-body">' + registerHeader(fixed, nextStandardCode(code)) + "</div>";
    editor.hidden = false;
    editor.dataset.registerId = item.id;
    var host = editor.querySelector(".register-form-body");
    var ready = window.standardSchemaReady || Promise.resolve();
    ready.then(function () {
        if (window.mountStandardRegister) {
            window.mountStandardRegister(host, item.id);
        }
        if (window.GovernanceIntelligence) {
            GovernanceIntelligence.prepareRegister(item.id, host);
        }
        if (window.MasterKnowledge) {
            MasterKnowledge.bindRegister(item.id, host);
        }
    });
    document.getElementById("register-print").addEventListener("click", function () {
        printRegister(item);
    });
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function paintSuiteRegister(item) {
    var editor = document.getElementById("register-editor");
    editor.innerHTML = '<div class="register-editor-head"><h3>' + escapeHeader(item.title) + '</h3>' +
        '<button class="btn-unified-primary" type="button" id="register-print">🖨️ طباعة النموذج الرسمي</button></div>' +
        '<div class="official-document-frame register-form-body">' + GovernanceSuite.formHtml(item) + "</div>";
    editor.hidden = false;
    editor.dataset.registerId = item.id;
    var host = editor.querySelector(".register-form-body");
    bindScenarios(host);
    GovernanceSuite.bind(host);
    document.getElementById("register-print").addEventListener("click", function () {
        printRegister(item);
    });
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function paintRegister(item) {
    if (window.GovernanceSuite && GovernanceSuite.isSuite(item.id)) {
        paintSuiteRegister(item);
        return;
    }
    if (item.id === "class_followup" && window.mountClassroomVisit) {
        paintClassroomVisit(item);
        return;
    }
    if (STANDARD_REGISTER_CODES[item.id] && window.mountStandardRegister) {
        paintStandardRegister(item);
        return;
    }
    var editor = document.getElementById("register-editor");
    var fixed = item.fixed || {};
    var html = '<div class="register-editor-head"><h3>' + escapeHeader(item.title) + '</h3>' +
        '<button class="btn-unified-primary" type="button" id="register-print">🖨️ طباعة النموذج الرسمي</button></div>';
    html += '<div class="official-document-frame register-form-body">';
    html += registerHeader(fixed);
    html += registerIdentityNote(item);
    html += registerProgressBar(item.id);
    (item.sections || []).forEach(function (section) {
        html += '<section class="register-section"><h4>' + escapeHeader(section.label) + '</h4>' + fieldInputs(section.fields, item.id) + '</section>';
    });
    (item.domains || []).forEach(function (domain) {
        html += '<h4>' + escapeHeader(domain) + '</h4>' + domainTableMarkup(domain, item.id);
    });
    if (item.columns && item.columns.length) {
        html += tableMarkup(item.columns, 4, item.id);
    }
    if (item.staff_linked) {
        html += '<button class="btn-unified-back no-print" type="button" id="register-add-staff">إضافة موظف من كشف الكادر</button>';
    }
    html += officialSignoff(item.id);
    html += "</div>";
    editor.innerHTML = html;
    editor.hidden = false;
    editor.dataset.registerId = item.id;
    bindLessonSelects(editor);
    bindScenarios(editor);
    if (window.ProgressEngine) {
        ProgressEngine.bindRegister(editor);
    }
    document.getElementById("register-print").addEventListener("click", function () {
        printRegister(item);
    });
    var addStaff = document.getElementById("register-add-staff");
    if (addStaff) {
        addStaff.addEventListener("click", function () {
            addStaffToRegister(item);
        });
    }
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openRegister(itemOrId, afterOpen) {
    var item = itemOrId;
    if (typeof itemOrId === "string") {
        item = registerCatalog.filter(function (entry) {
            return entry.id === itemOrId;
        })[0];
    }
    if (!item) {
        return;
    }
    if (window.setDashboardView) {
        window.setDashboardView("registers");
    }
    Promise.all([registerLookupReady, contentReady, contextualReady]).then(function () {
        paintRegister(item);
        if (afterOpen) {
            afterOpen();
        }
    });
}

window.openRegister = openRegister;

function addStaffToRegister(item) {
    fetch("/api/staff-directory")
        .then(function (response) {
            return response.json();
        })
        .then(function (payload) {
            var people = payload.people || [];
            var name = window.prompt("اكتب جزءًا من اسم الموظف كما في كشف الكادر");
            if (!name) {
                return;
            }
            var found = people.find(function (person) {
                return person.name && person.name.indexOf(name.trim()) !== -1;
            });
            if (!found) {
                return;
            }
            var inputs = document.querySelectorAll("#register-editor input");
            inputs.forEach(function (input) {
                if (input.getAttribute("data-label") === "الاسم" && !input.value) {
                    input.value = found.name;
                }
                if (input.getAttribute("data-label") === "السجل المدني" && !input.value) {
                    input.value = found.id || "";
                }
                if (input.getAttribute("data-label") === "العمل الحالي" && !input.value) {
                    input.value = found.roles ? found.roles[0] : "";
                }
            });
        });
}

function sealRepeatingLetterhead(root) {
    if (!root || root.querySelector(":scope > table.print-repeat-frame")) {
        return;
    }
    var header = root.querySelector(".print-header-table, .register-official-header, .doc-official-header");
    if (!header) {
        return;
    }
    var table = document.createElement("table");
    table.className = "print-repeat-frame";
    var headCell = document.createElement("td");
    headCell.appendChild(header);
    var headRow = document.createElement("tr");
    headRow.appendChild(headCell);
    var thead = document.createElement("thead");
    thead.appendChild(headRow);
    var bodyCell = document.createElement("td");
    var fill = document.createElement("div");
    fill.className = "print-repeat-fill";
    while (root.firstChild) {
        fill.appendChild(root.firstChild);
    }
    bodyCell.appendChild(fill);
    var bodyRow = document.createElement("tr");
    bodyRow.appendChild(bodyCell);
    var tbody = document.createElement("tbody");
    tbody.appendChild(bodyRow);
    table.appendChild(thead);
    table.appendChild(tbody);
    root.appendChild(table);
}

window.sealRepeatingLetterhead = sealRepeatingLetterhead;

function printRegister(item) {
    var source = document.querySelector("#register-editor .register-form-body");
    var sheet = document.getElementById("register-sheet");
    if (!source || !sheet) {
        return;
    }
    if (window.ProgressEngine) {
        ProgressEngine.sync(source);
    }
    source.querySelectorAll("select").forEach(function (select) {
        Array.prototype.forEach.call(select.options, function (option) {
            if (option.selected) {
                option.setAttribute("selected", "selected");
            } else {
                option.removeAttribute("selected");
            }
        });
    });
    source.querySelectorAll("input, textarea").forEach(function (field) {
        field.setAttribute("value", field.value);
        if (field.tagName === "TEXTAREA") {
            field.textContent = field.value;
        }
    });
    sheet.className = "register-sheet register-" + (item.orientation === "portrait" ? "portrait" : "landscape");
    if (item.id === "class_followup") {
        sheet.classList.add("classroom-visit-sheet");
    }
    sheet.innerHTML = source.innerHTML;
    sealRepeatingLetterhead(sheet);
    sheet.hidden = false;
    document.body.classList.add("printing-register");
    function cleanupRegister() {
        document.body.classList.remove("printing-register");
        sheet.hidden = true;
    }
    if (!window.PrintEngine || typeof window.PrintEngine.gate !== "function") {
        console.error("PrintEngine غير محمّل.");
        cleanupRegister();
        return;
    }
    var printedRegister = window.PrintEngine.gate(sheet.outerHTML, {
        multiPage: true,
        orientation: item.orientation === "portrait" ? "portrait" : "landscape",
        docTitle: item.title || "سجل"
    });
    if (printedRegister && typeof printedRegister.finally === "function") {
        printedRegister.finally(cleanupRegister);
    } else if (printedRegister && typeof printedRegister.then === "function") {
        printedRegister.then(cleanupRegister, cleanupRegister);
    } else {
        cleanupRegister();
    }
}

function registerTone(registerId) {
    var tones = {
        accreditation_register: "tone-admin",
        kpi_monitoring: "tone-admin",
        admin_communications: "tone-admin",
        leave_register: "tone-admin",
        personal_leave: "tone-admin",
        teacher_portfolio: "tone-admin",
        class_followup: "tone-academic",
        exam_committees: "tone-academic",
        results_analysis: "tone-outcomes",
        student_portfolio: "tone-outcomes",
        academic_care: "tone-care",
        gifted_care: "tone-care",
        activity_plan: "tone-care",
        counseling_programs: "tone-care",
        case_study: "tone-care",
        behavior_cases: "tone-care",
        discipline_register: "tone-care",
        student_leave: "tone-care",
        competitions_register: "tone-care",
        lab_register: "tone-environment",
        learning_resources_register: "tone-environment"
    };
    return tones[registerId] || "tone-academic";
}

function renderRegistersPortal() {
    var grid = document.getElementById("registers-grid");
    var note = document.getElementById("registers-note");
    var delegation = document.getElementById("register-delegation");
    if (!grid || !note || !delegation) {
        return;
    }
    var account = sessionAccount();
    if (!account || !account.role) {
        note.textContent = "ادخل برقم السجل المدني لعرض سجلات صفتك";
        delegation.hidden = true;
        grid.innerHTML = "";
        return;
    }
    var realGroup = registerGroup(account.role);
    if (realGroup !== "all") {
        registerPreviewRole = "";
    }
    delegation.hidden = realGroup !== "all";
    var select = document.getElementById("register-role-preview");
    if (realGroup === "all" && select && !delegation.dataset.ready) {
        select.addEventListener("change", function () {
            registerPreviewRole = select.value;
            renderRegistersPortal();
            if (window.applyRoleView) {
                window.applyRoleView();
            }
        });
        delegation.dataset.ready = "1";
    }
    if (window.fillDelegationRoles) {
        window.fillDelegationRoles(select);
    }
    note.textContent = "الصفة المعتمدة للعرض: " + (registerPreviewRole || account.role);
    var items = visibleRegisters();
    grid.innerHTML = "";
    if (!items.length) {
        note.textContent = "لا توجد سجلات مخصصة لهذه الصفة";
        return;
    }
    items.forEach(function (item) {
        var rate = window.WidgetControllers ? WidgetControllers.rateForRegister(item.id) : 0;
        var info = window.WidgetControllers ? WidgetControllers.state(rate) : { key: "critical", label: "حرج" };
        var card = document.createElement("article");
        card.className = "card register-card rw-card rw-" + info.key + " " + registerTone(item.id);
        card.setAttribute("data-register", item.id);
        card.setAttribute("data-rate", String(rate));
        var head = document.createElement("div");
        head.className = "rw-head";
        var title = document.createElement("h3");
        title.textContent = item.title;
        var badge = document.createElement("span");
        badge.className = "rw-state";
        badge.textContent = info.label + " " + rate + "%";
        head.appendChild(title);
        head.appendChild(badge);
        var meter = document.createElement("div");
        meter.className = "rw-meter";
        meter.setAttribute("role", "meter");
        meter.setAttribute("aria-valuemin", "0");
        meter.setAttribute("aria-valuemax", "100");
        meter.setAttribute("aria-valuenow", String(rate));
        meter.innerHTML = window.WidgetControllers ? WidgetControllers.meter(rate) : "";
        var actions = document.createElement("div");
        actions.className = "rw-actions register-card-actions";
        var viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.className = "rw-view";
        viewButton.setAttribute("data-open-register", item.id);
        viewButton.textContent = "عرض";
        actions.appendChild(viewButton);
        if (info.key === "critical") {
            var intervene = document.createElement("button");
            intervene.type = "button";
            intervene.className = "rw-intervene";
            intervene.setAttribute("data-intervene", item.id);
            intervene.textContent = "التدخل السريع";
            actions.appendChild(intervene);
        }
        var openButton = document.createElement("button");
        openButton.type = "button";
        openButton.className = "btn-unified-primary";
        openButton.textContent = "👁️ تعبئة واستعراض السجل";
        openButton.addEventListener("click", function () {
            openRegister(item.id);
        });
        var printButton = document.createElement("button");
        printButton.type = "button";
        printButton.className = "btn-unified-back";
        printButton.textContent = "🖨️ طباعة النموذج الرسمي";
        printButton.addEventListener("click", function () {
            openRegister(item.id, function () {
                printRegister(item);
            });
        });
        actions.appendChild(openButton);
        actions.appendChild(printButton);
        card.appendChild(head);
        card.appendChild(meter);
        card.appendChild(actions);
        grid.appendChild(card);
    });
    if (window.WidgetControllers) {
        WidgetControllers.renderAlerts();
    }
    if (window.applyRoleView) {
        window.applyRoleView();
    }
}

var registerLookupReady = fetch("/api/registers-lookup")
    .then(function (response) {
        return response.ok ? response.json() : {};
    })
    .then(function (payload) {
        registerLookup = payload || registerLookup;
        refreshPlanChoices();
    })
    .catch(function () {});

var committeeBank = [];
var committeeFormations = {};
var assignmentTemplates = {};
var assignmentContext = null;
var staffDirectory = [];

function cadreOptions(selected) {
    var names = window.ProgressEngine ? ProgressEngine.individuals.map(function (person) {
        return person.name;
    }) : [OFFICIAL_PRINCIPAL_NAME];
    return names.map(function (name) {
        return '<option value="' + escapeHeader(name) + '"' + (name === selected ? " selected" : "") + ">" + escapeHeader(name) + "</option>";
    }).join("");
}

function committeeCard(item) {
    var saved = committeeFormations[item.id] || item.seats || [];
    var seats = (item.seats || []).map(function (seat, index) {
        var chosen = saved[index] && saved[index].name ? saved[index].name : seat.name;
        return '<label class="committee-seat"><span>' + escapeHeader(seat.title) + '</span><select data-seat="' + escapeHeader(seat.title) + '">' + cadreOptions(chosen) + "</select></label>";
    }).join("");
    return '<article class="card committee-card" data-committee="' + escapeHeader(item.id) + '">' +
        "<h3>" + escapeHeader(item.title) + "</h3>" +
        "<p>" + escapeHeader(resolveLookupText(item.decision || "")) + "</p>" +
        "<h4>المسوغات</h4><ul>" + (item.justifications || []).map(function (line) {
            return "<li>" + escapeHeader(line) + "</li>";
        }).join("") + "</ul>" +
        "<h4>الأهداف</h4><ul>" + (item.goals || []).map(function (line) {
            return "<li>" + escapeHeader(line) + "</li>";
        }).join("") + "</ul>" +
        "<h4>المهام</h4><ul>" + (item.tasks || []).map(function (line) {
            return "<li>" + escapeHeader(line) + "</li>";
        }).join("") + "</ul>" +
        "<h4>الأعضاء</h4>" + seats +
        '<div class="committee-actions">' +
        '<button class="btn-unified-primary save-committee" type="button">💾 حفظ التشكيل</button>' +
        '<button class="btn-unified-back print-committee" type="button">🖨️ طباعة القرار الإداري الشامل للجنة</button>' +
        '<button class="btn-unified-back print-assignment" type="button">✉️ طباعة خطابات التكليف الفردية</button>' +
        '<button class="btn-unified-back print-minutes" type="button">🖨️ طباعة محضر الاجتماع</button>' +
        "</div></article>";
}

var COMMITTEE_GROUPS = [
    { title: "لجان القيادة والجودة", ids: ["quality", "partnership"] },
    { title: "لجان الشؤون التعليمية", ids: ["achievement", "resources", "exams"] },
    { title: "لجان الرعاية والبيئة المدرسية", ids: ["guidance", "activity", "safety", "discipline"] }
];

var COMMITTEE_MARKS = {
    quality: ["🏅", "الاعتماد والجودة"],
    partnership: ["💼", "الصندوق المدرسي"],
    achievement: ["📈", "التحصيل ونافس"],
    resources: ["💻", "مصادر التعلم"],
    exams: ["🗓️", "الجدول المدرسي"],
    guidance: ["🧭", "التوجيه الطلابي"],
    activity: ["🎯", "المناسبات والنشاط"],
    safety: ["🛡️", "الأمن والسلامة"],
    discipline: ["⚡", "التدخل السريع"]
};

function committeeSeatRate(item) {
    var saved = committeeFormations[item.id] || item.seats || [];
    var seats = item.seats || [];
    if (!seats.length) {
        return 0;
    }
    var filled = 0;
    seats.forEach(function (seat, index) {
        var name = saved[index] && saved[index].name ? saved[index].name : seat.name;
        if (String(name || "").trim()) {
            filled += 1;
        }
    });
    return Math.round((filled / seats.length) * 100);
}

function committeeIcon(item) {
    var mark = COMMITTEE_MARKS[item.id] || ["🏛️", item.title];
    var rate = committeeSeatRate(item);
    var info = window.WidgetControllers ? WidgetControllers.state(rate) : { key: rate >= 90 ? "excellent" : "critical", label: "" };
    var meter = window.WidgetControllers ? WidgetControllers.meter(rate) : "";
    var intervene = info.key === "critical"
        ? '<button class="rw-intervene" type="button" data-intervene-committee="' + escapeHeader(item.id) + '">التدخل السريع</button>'
        : "";
    return '<article class="rw-card rw-' + info.key + '" data-committee="' + escapeHeader(item.id) + '" data-rate="' + rate + '">' +
        '<button class="committee-icon" type="button" data-committee="' + escapeHeader(item.id) + '" title="' + escapeHeader(item.title) + '">' +
        "<span>" + mark[0] + "</span><strong>" + escapeHeader(mark[1]) + "</strong></button>" +
        '<div class="rw-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + rate + '">' + meter + "</div>" +
        '<span class="rw-state">' + escapeHeader(info.label) + " " + rate + "%</span>" +
        '<div class="rw-actions"><button class="rw-view" type="button" data-open-committee="' + escapeHeader(item.id) + '">عرض</button>' + intervene + "</div></article>";
}

function renderCommitteesPortal() {
    var grid = document.getElementById("committees-grid");
    var note = document.getElementById("committees-note");
    if (!grid) {
        return;
    }
    Promise.all([
        fetch("/api/committees").then(function (response) { return response.json(); }),
        fetch("/api/assignment-templates").then(function (response) { return response.ok ? response.json() : {}; }),
        fetch("/api/staff-directory").then(function (response) { return response.ok ? response.json() : { people: [] }; })
    ])
        .then(function (payloads) {
            var payload = payloads[0];
            assignmentTemplates = payloads[1] || {};
            staffDirectory = (payloads[2] && payloads[2].people) || [];
            committeeBank = payload.committees || [];
            committeeFormations = payload.formations || {};
            grid.innerHTML = COMMITTEE_GROUPS.map(function (group) {
                var icons = group.ids.map(function (id) {
                    var item = committeeBank.filter(function (entry) {
                        return entry.id === id;
                    })[0];
                    return item ? committeeIcon(item) : "";
                }).join("");
                return '<section class="committee-group"><h3>' + escapeHeader(group.title) + '</h3><div class="committee-icons rw-grid">' + icons + "</div></section>";
            }).join("");
            grid.hidden = false;
            if (note) {
                note.textContent = "اللجان المعتمدة: " + committeeBank.length;
            }
        })
        .catch(function () {
            if (note) {
                note.textContent = "تعذر تحميل بنك اللجان";
            }
        });
}

function openCommitteeWorkspace(id) {
    var item = committeeBank.filter(function (entry) {
        return entry.id === id;
    })[0];
    var dialog = document.getElementById("committee-dialog");
    if (!item || !dialog) {
        return;
    }
    dialog.innerHTML = '<button class="btn-unified-back close-committee" type="button">إغلاق</button>' + committeeCard(item);
    if (typeof dialog.showModal === "function") {
        dialog.showModal();
    }
}

window.openCommitteeWorkspace = openCommitteeWorkspace;

function committeeFromCard(card) {
    var id = card.getAttribute("data-committee");
    var item = committeeBank.filter(function (entry) {
        return entry.id === id;
    })[0] || { id: id, title: "", seats: [] };
    var seats = Array.prototype.map.call(card.querySelectorAll("select"), function (select) {
        return { title: select.getAttribute("data-seat") || "", name: select.value };
    });
    return { item: item, seats: seats };
}

function staffRecord(name) {
    var found = staffDirectory.filter(function (person) {
        return person.name === name;
    })[0];
    if (found) {
        return found;
    }
    var local = window.ProgressEngine ? ProgressEngine.individuals.filter(function (person) {
        return person.name === name;
    })[0] : null;
    return { name: name || "", id: "", roles: local ? [local.role] : [] };
}

function attendanceRole(title) {
    var text = title || "";
    if (text.indexOf("مقرر") !== -1) {
        return "مقرر";
    }
    if (text.indexOf("نائب") !== -1) {
        return "نائب";
    }
    if (text.indexOf("رئيس") !== -1) {
        return "رئيس";
    }
    return "عضو";
}

function mandateTemplate() {
    return assignmentTemplates.individual_mandate_letter || assignmentTemplates.assignment_letter || {};
}

function minutesTemplate() {
    return assignmentTemplates.meeting_minutes_template || assignmentTemplates.meeting_minutes || {};
}

function fillAssignmentTokens(text, seat, item) {
    var seats = item && item._printSeats ? item._printSeats : (item.seats || []);
    var chair = seats[0] && seats[0].name ? seats[0].name : OFFICIAL_PRINCIPAL_NAME;
    var tasks = (item.tasks || []).map(function (line, index) {
        return (index + 1) + ". " + line;
    }).join("\n");
    var person = staffRecord(seat.name || "");
    var minutes = minutesTemplate();
    var map = {
        staff_name: seat.name || "",
        staff_job_title: (person.roles || []).join(" / "),
        staff_nid: person.id || "",
        mandate_title: seat.title || "",
        committee_name: item.title || "",
        committee_title: item.title || "",
        school_name: bookletSchoolName,
        principal_name: assignmentTemplates.principal_name || OFFICIAL_PRINCIPAL_NAME,
        year: assignmentTemplates.academic_year || "1448هـ",
        decision: resolveLookupText(item.decision || ""),
        tasks_list: tasks,
        tasks: tasks,
        meeting_number: minutes.meeting_number || "1",
        education_administration: bookletAdmin,
        education_office: (bookletOffice || "").trim(),
        chair_name: chair
    };
    var rendered = String(text || "");
    Object.keys(map).forEach(function (key) {
        rendered = rendered.split("{" + key + "}").join(map[key]);
    });
    return resolveLookupText(rendered);
}

function assignmentLines(lines, seat, item) {
    return (lines || []).filter(function (line) {
        var raw = String(line || "");
        if (raw.indexOf("{education_office}") !== -1 && !(bookletOffice || "").trim() && raw.split("{education_office}").join("").trim() === "") {
            return false;
        }
        return fillAssignmentTokens(raw, seat, item).trim() !== "";
    }).map(function (line) {
        return "<div>" + escapeHeader(fillAssignmentTokens(line, seat, item)).replace(/\n/g, "<br>") + "</div>";
    }).join("");
}

function signatureMatrix(seats) {
    var matrix = assignmentTemplates.signatures_protocol || assignmentTemplates.signature_matrix || {};
    var columns = matrix.decision_columns || ["م", "الاسم", "الصفة", "التوقيع", "بالعلم"];
    var head = columns.map(function (column) {
        return "<th>" + escapeHeader(column) + "</th>";
    }).join("");
    var body = seats.map(function (seat, index) {
        return "<tr><td>" + (index + 1) + "</td><td>" + escapeHeader(seat.name) + "</td><td>" + escapeHeader(seat.title) + "</td><td></td><td></td></tr>";
    }).join("");
    return '<table class="register-editor-table signature-matrix"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table>";
}

function printCommittee(item, seats) {
    var sheet = document.getElementById("committee-sheet");
    if (!sheet) {
        return;
    }
    var letter = mandateTemplate();
    var preamble = letter.preamble || [
        "المملكة العربية السعودية",
        "وزارة التعليم",
        "{education_administration}",
        "{education_office}",
        "{school_name}",
        "العام الدراسي {year}"
    ];
    var printable = Object.assign({}, item, { _printSeats: seats });
    sheet.innerHTML = '<article class="committee-document">' +
        '<header class="register-official-header"><div>' + assignmentLines(preamble, seats[0] || {}, printable) + documentMetaHtml() + "</div></header>" +
        "<h2>قرار إداري: " + escapeHeader(item.title) + "</h2>" +
        "<p>" + escapeHeader(resolveLookupText(item.decision || "")) + "</p>" +
        "<h3>المسوغات</h3><ul>" + (item.justifications || []).map(function (line) {
            return "<li>" + escapeHeader(line) + "</li>";
        }).join("") + "</ul>" +
        "<h3>الأهداف</h3><ul>" + (item.goals || []).map(function (line) {
            return "<li>" + escapeHeader(line) + "</li>";
        }).join("") + "</ul>" +
        "<h3>المهام</h3><ul>" + (item.tasks || []).map(function (line) {
            return "<li>" + escapeHeader(line) + "</li>";
        }).join("") + "</ul>" +
        signatureMatrix(seats) +
        officialSignoff(item.id) +
        "</article>";
    presentCommitteeSheet(sheet);
}

function printAssignmentLetter(item, seat, seats) {
    var sheet = document.getElementById("committee-sheet");
    var letter = mandateTemplate();
    if (!sheet || !seat) {
        return;
    }
    if (window.GovernanceSuite) {
        var suiteLetter = GovernanceSuite.appointmentDocument(seat.name, item, seats);
        if (suiteLetter) {
            GovernanceSuite.present(suiteLetter, false);
            return;
        }
    }
    var printable = Object.assign({}, item, { _printSeats: seats });
    var paragraphs = (letter.paragraphs || []).map(function (line) {
        return "<p>" + escapeHeader(fillAssignmentTokens(line, seat, printable)).replace(/\n/g, "<br>") + "</p>";
    }).join("");
    var person = staffRecord(seat.name || "");
    var pattern = (assignmentTemplates.signatures_protocol || {}).path_pattern || "signatures/sig_{nid}.png";
    var signature = person.id ? '<img class="staff-signature" src="' + escapeHeader(pattern.split("{nid}").join(person.id)) + '" alt="" onerror="this.remove()">' : "";
    var receipt = '<section class="receipt-box"><h3>' + escapeHeader(letter.acknowledgment_title || "إقرار الاستلام والتوقيع بالعلم") + "</h3><p>" +
        escapeHeader(fillAssignmentTokens(letter.acknowledgment || "", seat, printable)) +
        '</p>' + signature + '<div class="receipt-sign"><div><strong>اسم المستلم</strong><span></span></div><div><strong>التوقيع بالعلم</strong><span></span></div><div><strong>التاريخ</strong><span></span></div></div></section>';
    sheet.innerHTML = '<article class="committee-document">' +
        '<header class="register-official-header"><div>' + assignmentLines(letter.preamble || [], seat, printable) + documentMetaHtml() + "</div></header>" +
        "<h2>" + escapeHeader(fillAssignmentTokens(letter.subject || letter.title || "خطاب تكليف فردي", seat, printable)) + "</h2>" +
        paragraphs +
        receipt +
        "<p class=\"principal-approval\">" + escapeHeader(fillAssignmentTokens(letter.principal_approval || "اعتماد مدير المدرسة: {principal_name}", seat, printable)) + "</p>" +
        officialSignoff(item.id) +
        "</article>";
    presentCommitteeSheet(sheet);
}

function printMeetingMinutes(item, seats) {
    var sheet = document.getElementById("committee-sheet");
    var minutes = minutesTemplate();
    if (!sheet) {
        return;
    }
    if (window.GovernanceSuite) {
        var suiteMinutes = GovernanceSuite.minutesDocument(item, seats);
        if (suiteMinutes) {
            GovernanceSuite.present(suiteMinutes, false);
            return;
        }
    }
    var printable = Object.assign({}, item, { _printSeats: seats });
    var sample = seats[0] || {};
    var columns = minutes.attendance_columns || ["م", "الاسم", "الدور", "الحضور", "التوقيع"];
    var head = columns.map(function (column) {
        return "<th>" + escapeHeader(column) + "</th>";
    }).join("");
    var body = seats.map(function (member, index) {
        return "<tr><td>" + (index + 1) + "</td><td>" + escapeHeader(member.name) + "</td><td>" + escapeHeader(attendanceRole(member.title)) + "</td><td></td><td></td></tr>";
    }).join("");
    var sections = (minutes.sections || []).map(function (label) {
        return '<section class="minutes-block"><h3>' + escapeHeader(label) + '</h3><div class="minutes-lines"><div></div><div></div><div></div><div></div></div></section>';
    }).join("");
    sheet.innerHTML = '<article class="committee-document">' +
        '<header class="register-official-header"><div>' + assignmentLines(minutes.preamble || [], sample, printable) + documentMetaHtml() + "</div></header>" +
        "<h2>" + escapeHeader(fillAssignmentTokens(minutes.title || "محضر اجتماع {committee_name}", sample, printable)) + "</h2>" +
        "<p>" + escapeHeader(fillAssignmentTokens(minutes.intro || "", sample, printable)) + "</p>" +
        '<table class="register-editor-table"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table>" +
        sections +
        officialSignoff(item.id) +
        "</article>";
    presentCommitteeSheet(sheet);
}

function presentCommitteeSheet(sheet) {
    sealRepeatingLetterhead(sheet);
    sheet.hidden = false;
    document.body.classList.add("printing-committee");
    function cleanupCommittee() {
        document.body.classList.remove("printing-committee");
        sheet.hidden = true;
    }
    if (!window.PrintEngine || typeof window.PrintEngine.gate !== "function") {
        console.error("PrintEngine غير محمّل.");
        cleanupCommittee();
        return;
    }
    var printedCommittee = window.PrintEngine.gate(sheet.outerHTML, {
        multiPage: true,
        orientation: "portrait",
        docTitle: "محضر لجنة"
    });
    if (printedCommittee && typeof printedCommittee.finally === "function") {
        printedCommittee.finally(cleanupCommittee);
    } else if (printedCommittee && typeof printedCommittee.then === "function") {
        printedCommittee.then(cleanupCommittee, cleanupCommittee);
    } else {
        cleanupCommittee();
    }
}

var committeesPortal = document.getElementById("committees-portal");
if (committeesPortal) committeesPortal.addEventListener("click", function (event) {
    var icon = event.target.closest(".committee-icon");
    if (icon) {
        openCommitteeWorkspace(icon.getAttribute("data-committee"));
        return;
    }
    if (event.target.closest(".close-committee")) {
        var dialog = document.getElementById("committee-dialog");
        if (dialog && dialog.open) {
            dialog.close();
        }
        return;
    }
    var card = event.target.closest(".committee-card");
    if (!card) {
        return;
    }
    var packed = committeeFromCard(card);
    if (event.target.closest(".save-committee")) {
        fetch("/api/committees/" + encodeURIComponent(packed.item.id), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seats: packed.seats })
        }).then(function (response) {
            if (!response.ok) {
                throw new Error("تعذر حفظ التشكيل");
            }
            return response.json();
        }).then(function (payload) {
            committeeFormations[packed.item.id] = payload.seats;
            var note = document.getElementById("committees-note");
            if (note) {
                note.textContent = "تم حفظ تشكيل " + packed.item.title;
            }
        }).catch(function (error) {
            var note = document.getElementById("committees-note");
            if (note) {
                note.textContent = error.message;
            }
        });
    }
    if (event.target.closest(".print-committee")) {
        printCommittee(packed.item, packed.seats);
    }
    if (event.target.closest(".print-assignment")) {
        assignmentContext = packed;
        var select = document.getElementById("assignment-member");
        var people = window.ProgressEngine ? ProgressEngine.individuals : packed.seats.map(function (seat) {
            return { name: seat.name, role: seat.title };
        });
        select.innerHTML = people.map(function (person) {
            return '<option value="' + escapeHeader(person.name) + '">' + escapeHeader(person.name + " — " + person.role) + "</option>";
        }).join("");
        var preset = packed.seats.filter(function (seat) { return seat.name; })[0];
        if (preset) {
            select.value = preset.name;
        }
        document.getElementById("assignment-dialog").showModal();
    }
    if (event.target.closest(".print-minutes")) {
        printMeetingMinutes(packed.item, packed.seats);
    }
});

var assignmentPrint = document.getElementById("assignment-print");
if (assignmentPrint) assignmentPrint.addEventListener("click", function () {
    if (!assignmentContext) {
        return;
    }
    var chosen = document.getElementById("assignment-member").value;
    var dialog = document.getElementById("assignment-dialog");
    var seat = assignmentContext.seats.filter(function (entry) {
        return entry.name === chosen;
    })[0] || { name: chosen, title: (staffRecord(chosen).roles || [])[0] || "" };
    if (dialog.open) {
        dialog.close();
    }
    printAssignmentLetter(assignmentContext.item, seat, assignmentContext.seats);
});

window.setDashboardView = function (name) {
    document.body.classList.remove("view-home", "view-plans", "view-registers", "view-measurement", "view-committees", "quiet-lobby", "quiet-alerts", "quiet-charts", "quiet-registers");
    document.body.classList.add("view-" + name);
    ["quiet-lobby", "registers-portal", "plan-generator", "measurement-center", "app-main"].forEach(function (id) {
        var node = id === "app-main" ? document.querySelector(".app-main") : document.getElementById(id);
        if (node) {
            node.style.display = "";
        }
    });
    var center = document.getElementById("measurement-center");
    var committees = document.getElementById("committees-portal");
    if (center) {
        center.hidden = name !== "measurement" && name !== "home";
    }
    if (committees) {
        committees.hidden = name !== "committees";
    }
    if (name !== "committees") {
        var committeeDialog = document.getElementById("committee-dialog");
        if (committeeDialog && committeeDialog.open) {
            committeeDialog.close();
        }
    }
    document.querySelectorAll(".app-sidebar .nav-item").forEach(function (item) {
        item.classList.remove("active");
        item.removeAttribute("aria-current");
    });
    var activeMap = {
        home: "nav-home",
        plans: "nav-tasks",
        registers: "nav-registers",
        measurement: "nav-measurement",
        committees: "nav-committees"
    };
    var active = document.getElementById(activeMap[name] || "");
    if (active) {
        active.classList.add("active");
        active.setAttribute("aria-current", "page");
    }
    if (window.history && window.history.replaceState && location.hash !== "#review") {
        window.history.replaceState(null, "", location.pathname + location.search + "#" + name);
    }
    if (name === "measurement" && window.ProgressEngine) {
        ProgressEngine.initCharts();
    } else if (window.ProgressEngine && ProgressEngine.destroyCharts) {
        ProgressEngine.destroyCharts();
    }
    if (name === "committees") {
        renderCommitteesPortal();
    }
};

function publishRegisterCatalog() {
    var extra = window.GovernanceSuite ? GovernanceSuite.catalogItems() : [];
    var seen = {};
    registerCatalog = registerBase.concat(extra).filter(function (item) {
        if (!item || !item.id || seen[item.id]) {
            return false;
        }
        seen[item.id] = true;
        return true;
    });
    var registerCount = document.getElementById("nav-register-count");
    if (registerCount) {
        registerCount.textContent = String(registerCatalog.length);
    }
    renderRegistersPortal();
    paintHomeRegisters();
}

window.refreshRegisterCatalog = publishRegisterCatalog;

var registerBase = [];

fetch("/api/registers")
    .then(function (response) {
        if (!response.ok) {
            throw new Error("تعذر تحميل بنك السجلات");
        }
        return response.json();
    })
    .then(function (payload) {
        registerBase = payload.registers || [];
        publishRegisterCatalog();
    })
    .catch(function (error) {
        var note = document.getElementById("registers-note");
        if (note) {
            note.textContent = error.message;
        }
    });

var MasterKnowledge = (function () {
    var matrix = null;
    var pending = [];
    var ready = fetch("/banks/master_knowledge_matrix.json?v=mkm1")
        .then(function (response) { return response.json(); })
        .then(function (payload) {
            matrix = payload.master_knowledge_matrix || payload;
            pending.splice(0).forEach(function (job) { job(); });
            refreshPlan();
            return matrix;
        })
        .catch(function () {
            matrix = null;
            return null;
        });

    function pack() {
        return matrix || {};
    }

    function nafesEngine() {
        return pack().axis_2_floating_nafes_engine || {};
    }

    function nafesConfig() {
        return (nafesEngine().configuration || {}).nafes_target_week || { range: [8, 18], default: 14 };
    }

    function storedWeek() {
        var config = nafesConfig();
        var range = config.range || [8, 18];
        var fallback = Number(config.default) || 14;
        var value = parseInt(localStorage.getItem("nafesTargetWeek1059") || "", 10);
        if (isNaN(value) || value < range[0] || value > range[1]) {
            return fallback;
        }
        return value;
    }

    function phaseSpan(rule, target) {
        var start = target + Number(rule.offset_weeks || 0);
        var end = rule.range_end_offset == null ? start : target + Number(rule.range_end_offset);
        if (end < start) {
            var swap = start;
            start = end;
            end = swap;
        }
        return { id: rule.phase_id, label: rule.label, start: start, end: end };
    }

    function schedule(target) {
        return (nafesEngine().offset_rules || []).map(function (rule) {
            return phaseSpan(rule, target);
        });
    }

    function weekText(span) {
        var limit = typeof weekCount === "function" ? weekCount() : 18;
        var text = span.start === span.end ? "الأسبوع " + span.start : "الأسابيع " + span.start + "–" + span.end;
        if (span.start < 1 || span.end > limit) {
            text += "، خارج أسابيع الفصل الـ " + limit;
        }
        return text;
    }

    function paintLines() {
        var lines = document.getElementById("nafes-float-lines");
        if (!lines) {
            return;
        }
        if (!matrix) {
            lines.textContent = "";
            return;
        }
        var target = storedWeek();
        lines.textContent = schedule(target).map(function (span) {
            return span.label + ": " + weekText(span);
        }).join(" | ");
    }

    function refreshPlan() {
        var card = document.querySelector("#plan-generator .card-body");
        if (!card) {
            return;
        }
        var box = document.getElementById("nafes-float");
        if (!box) {
            box = document.createElement("div");
            box.id = "nafes-float";
            box.className = "screen-only";
            box.innerHTML = '<label for="nafes-target-week">أسبوع نافس المستهدف في الخطة التنفيذية</label>' +
                '<input id="nafes-target-week" type="number" inputmode="numeric">' +
                '<p id="nafes-float-lines" class="form-message"></p>';
            card.appendChild(box);
            document.getElementById("nafes-target-week").addEventListener("input", function (event) {
                var config = nafesConfig();
                var range = config.range || [8, 18];
                var value = parseInt(event.target.value, 10);
                if (isNaN(value) || value < range[0] || value > range[1]) {
                    return;
                }
                localStorage.setItem("nafesTargetWeek1059", String(value));
                paintLines();
            });
        }
        var input = document.getElementById("nafes-target-week");
        var config = nafesConfig();
        var range = config.range || [8, 18];
        input.min = String(range[0]);
        input.max = String(range[1]);
        if (document.activeElement !== input) {
            input.value = String(storedWeek());
        }
        paintLines();
    }

    function labeled(root, label) {
        return root.querySelector('[data-label="' + label + '"]');
    }

    function pathways() {
        var block = (pack().axis_5_smart_autofill || {}).multi_step_pathways || {};
        return block.pathways || [];
    }

    function pathwayById(id) {
        return pathways().filter(function (item) { return item.pathway_id === id; })[0] || null;
    }

    function criticalLoss(loss, delay) {
        var lossText = String(loss || "");
        var delayText = String(delay || "");
        var skill = lossText === "مهاري" || lossText.indexOf("مهارة") === 0;
        return skill && delayText.indexOf("عميق") !== -1;
    }

    function pathwayIdFor(subject, loss) {
        var subjectText = String(subject || "");
        var lossText = String(loss || "");
        if (subjectText.indexOf("رياض") !== -1) {
            return "MSP-01";
        }
        if (subjectText.indexOf("لغت") !== -1 || subjectText.indexOf("قراء") !== -1) {
            return "MSP-02";
        }
        if (subjectText.indexOf("علوم") !== -1) {
            return "MSP-03";
        }
        if (lossText.indexOf("حساب") !== -1) {
            return "MSP-01";
        }
        if (lossText.indexOf("قرائ") !== -1) {
            return "MSP-02";
        }
        if (lossText.indexOf("علم") !== -1) {
            return "MSP-03";
        }
        return "";
    }

    function stepsText(pathway) {
        return (pathway.steps || []).map(function (step) {
            return step.step + ". " + step.type;
        }).join(" — ");
    }

    function placeNote(section, text) {
        var note = section.querySelector("[data-msp-note]");
        if (!text) {
            if (note) {
                note.remove();
            }
            return;
        }
        if (!note) {
            note = document.createElement("p");
            note.className = "form-message screen-only";
            note.setAttribute("data-msp-note", "1");
            section.appendChild(note);
        }
        note.textContent = text;
    }

    function sectionByHeading(root, heading) {
        var sections = root.querySelectorAll(".std-section");
        var index;
        for (index = 0; index < sections.length; index += 1) {
            var title = sections[index].querySelector("h4");
            if (title && title.textContent === heading) {
                return sections[index];
            }
        }
        return root;
    }

    function applyIntervention(select, stepType) {
        var prior = select.querySelector("option[data-msp-option]");
        if (prior && prior.value !== stepType) {
            if (select.value === prior.value) {
                select.value = "";
            }
            prior.remove();
        }
        if (!stepType || select.dataset.userPicked === "1") {
            return;
        }
        var option = Array.prototype.filter.call(select.options, function (item) {
            return item.value === stepType;
        })[0];
        if (!option) {
            option = document.createElement("option");
            option.value = stepType;
            option.textContent = stepType;
            option.setAttribute("data-msp-option", "1");
            select.appendChild(option);
        }
        select.value = stepType;
    }

    function applyAcademic(root) {
        var subject = labeled(root, "المادة");
        var loss = labeled(root, "نوع الفاقد");
        var delay = labeled(root, "درجة التأخر");
        var intervention = labeled(root, "نوع التدخل");
        var section = sectionByHeading(root, "التشخيص");
        if (!criticalLoss(loss && loss.value, delay && delay.value)) {
            placeNote(section, "");
            if (intervention) {
                applyIntervention(intervention, "");
            }
            return;
        }
        var pathway = pathwayById(pathwayIdFor(subject && subject.value, loss && loss.value));
        if (!pathway) {
            placeNote(section, "");
            return;
        }
        placeNote(section, pathway.pathway_id + " " + pathway.pathway_name + ": " + stepsText(pathway));
        var first = (pathway.steps || [])[0];
        if (intervention && first) {
            applyIntervention(intervention, first.type);
        }
    }

    function kangarooBank() {
        return ((pack().axis_3_nafes_repository || {}).kangaroo_gifted_repository) || {};
    }

    function kangarooText() {
        var bank = kangarooBank();
        var levels = (bank.question_difficulty_levels || []).map(function (level) {
            return level.label + " (" + level.points + ")";
        }).join("، ");
        var format = bank.competition_format || {};
        var parts = [bank.bank_name || "بنك الكانجارو للموهوبين"];
        if (bank.total_questions) {
            parts.push(bank.total_questions + " سؤالاً");
        }
        if (levels) {
            parts.push(levels);
        }
        if (format.duration_minutes) {
            parts.push(format.duration_minutes + " دقيقة");
        }
        var gifted = pathwayById("MSP-04");
        if (gifted) {
            parts.push(gifted.pathway_id + ": " + stepsText(gifted));
        }
        return parts.join(" — ");
    }

    function applyGifted(root) {
        var classification = labeled(root, "التصنيف");
        var enrichment = labeled(root, "البرامج الإثرائية");
        var section = sectionByHeading(root, "التصنيف والاكتشاف");
        var gifted = classification && String(classification.value).indexOf("موهوب") !== -1;
        if (!gifted) {
            placeNote(section, "");
            if (enrichment && enrichment.tagName === "SELECT") {
                applyIntervention(enrichment, "");
            } else if (enrichment && enrichment.dataset.mkmFill === "1") {
                enrichment.value = "";
                enrichment.dataset.mkmFill = "";
            }
            return;
        }
        var text = kangarooText();
        var bankName = kangarooBank().bank_name || "بنك الكانجارو للموهوبين";
        placeNote(section, "GCR ← " + text);
        if (enrichment && enrichment.tagName === "SELECT") {
            applyIntervention(enrichment, bankName);
            return;
        }
        if (enrichment && enrichment.dataset.userPicked !== "1" && (!enrichment.value || enrichment.dataset.mkmFill === "1")) {
            enrichment.value = text;
            enrichment.dataset.mkmFill = "1";
        }
    }

    function applyRegister(registerId, root) {
        if (!root || !matrix) {
            return;
        }
        if (registerId === "academic_care") {
            var delayField = labeled(root, "درجة التأخر");
            if (delayField && delayField.type === "number") {
                delayField.type = "text";
            }
            applyAcademic(root);
        }
        if (registerId === "gifted_care") {
            applyGifted(root);
        }
    }

    function bindRegister(registerId, root) {
        function run() {
            if (!root || root.dataset.mkmBound === "1") {
                applyRegister(registerId, root);
                return;
            }
            root.dataset.mkmBound = "1";
            root.addEventListener("change", function (event) {
                var field = event.target;
                if (field && event.isTrusted && (field.getAttribute("data-label") === "نوع التدخل" || field.getAttribute("data-label") === "البرامج الإثرائية")) {
                    field.dataset.userPicked = "1";
                }
                applyRegister(registerId, root);
            });
            root.addEventListener("input", function (event) {
                var field = event.target;
                if (field && field.getAttribute("data-label") === "البرامج الإثرائية" && event.isTrusted) {
                    field.dataset.userPicked = "1";
                    field.dataset.mkmFill = "";
                }
            });
            applyRegister(registerId, root);
        }
        if (matrix) {
            run();
        } else {
            pending.push(run);
        }
    }

    refreshPlan();

    return {
        ready: ready,
        refreshPlan: refreshPlan,
        bindRegister: bindRegister,
        schedule: schedule,
        storedWeek: storedWeek
    };
}());

window.MasterKnowledge = MasterKnowledge;

function getMasterSignoffBlock() {
    return approvalSignoffHtml();
}


function openPlansGeneratorView() {
    document.body.classList.remove('view-registers', 'view-measurement', 'view-isolated-record');
    document.body.classList.add('view-plans-isolated');
    var portal = document.getElementById('landing-portal') || document.querySelector('.portal-grid');
    if (portal) portal.style.display = 'none';
    var regs = document.getElementById('registers-portal') || document.querySelector('.registers-section');
    if (regs) regs.style.display = 'none';
    var planGen = document.getElementById('plan-generator') || document.querySelector('.plan-generator-card') || document.querySelector('#plan-generator');
    if (planGen) {
        planGen.style.display = 'block';
        planGen.scrollIntoView({ behavior: 'smooth' });
    }
}






/* ==========================================================================
   المعمارية المعزولة للتنقل وإدارة الأبواب الأربعة والعودة الآمنة
   ========================================================================== */

function hideAllViews() {
    var lobby = document.getElementById('quiet-lobby');
    if (lobby) lobby.style.display = 'none';

    var regFilters = document.getElementById('register-filters');
    if (regFilters) regFilters.style.display = 'none';

    var regsPortal = document.getElementById('registers-portal');
    if (regsPortal) regsPortal.style.display = 'none';

    var planGen = document.getElementById('plan-generator') || document.querySelector('.plan-generator-section');
    if (planGen) planGen.style.display = 'none';

    var measureCenter = document.getElementById('measurement-center');
    if (measureCenter) measureCenter.style.display = 'none';

    var main = document.querySelector('.app-main');
    if (main) main.style.display = 'none';

    document.body.classList.remove('view-registers', 'view-plans', 'view-charts', 'view-alerts', 'view-isolated-record');
}

function returnToLobby(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    hideAllViews();
    
    // إظهار البهو الرئيسي النظيف بالأبواب الأربعة
    var lobby = document.getElementById('quiet-lobby');
    if (lobby) {
        lobby.style.display = 'block';
    }
    
    // إزالة الهاش لمنع تصادم معالجات الأحداث
    if (window.history && window.history.replaceState) {
        window.history.replaceState(null, null, window.location.pathname);
    } else {
        window.location.hash = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showPlansView() {
    switchSection("plans");
}

// ربط مستمعات النقر بدقة عالية وبدون تصادم
document.addEventListener('DOMContentLoaded', function() {
    var doorPlans = document.querySelector('button[data-room="quiet-plans"]');
    if (doorPlans) {
        doorPlans.onclick = function(e) {
            e.preventDefault();
            showPlansView();
        };
    }
    
    var returnBtn = document.getElementById('btn-global-return');
    if (returnBtn) {
        returnBtn.onclick = returnToLobby;
    }
});

// دعم الضغط المباشر حتى لو كان DOM محملاً
document.addEventListener('click', function(e) {
    var btnPlans = e.target.closest('button[data-room="quiet-plans"]');
    if (btnPlans) {
        e.preventDefault();
        showPlansView();
        return;
    }
    var btnRet = e.target.closest('#btn-global-return, .sidebar-return-btn');
    if (btnRet) {
        e.preventDefault();
        returnToLobby(e);
        return;
    }
});


function switchSection(target) {
    var view = {
        plans: "plans",
        registers: "registers",
        measurement: "measurement",
        alerts: "home",
        lobby: "home",
        home: "home"
    }[target] || "home";
    if (window.setDashboardView) {
        window.setDashboardView(view);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function returnToLobby(e) {
    if (e) {
        e.preventDefault();
    }
    switchSection("home");
}

var initialView = (window.location.hash || "").replace("#", "");
if (initialView === "registers" || initialView === "measurement" || initialView === "plans" || initialView === "home") {
    window.setDashboardView(initialView);
}


// ==========================================================================
// محرك التوجيه والعزل الصارم بين الشاشات الأربعة
// ==========================================================================

function navigateToSection(sectionName) {
    var view = {
        lobby: "home",
        home: "home",
        alerts: "home",
        charts: "measurement",
        measurement: "measurement",
        registers: "registers",
        plans: "plans",
        committees: "committees"
    }[sectionName] || "home";
    if (window.setDashboardView) {
        window.setDashboardView(view);
    }
    return;
    var elementsToHide = [
        'quiet-lobby',
        'registers-portal',
        'register-filters',
        'measurement-center',
        'plan-generator',
        'view-plans-container',
        'analytics-hub'
    ];
    
    elementsToHide.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important');
    });

    var main = document.querySelector('.app-main');
    if (main) main.style.display = 'none';

    // 2. إظهار القسم المطلوب حصراً
    if (sectionName === 'lobby' || sectionName === 'home') {
        var lobby = document.getElementById('quiet-lobby');
        if (lobby) lobby.style.setProperty('display', 'block', 'important');
        window.location.hash = '';
    } 
    else if (sectionName === 'registers') {
        if (main) main.style.display = 'block';
        var reg = document.getElementById('registers-portal');
        if (reg) reg.style.setProperty('display', 'block', 'important');
        var regFilter = document.getElementById('register-filters');
        if (regFilter) regFilter.style.setProperty('display', 'block', 'important');
        window.location.hash = 'registers';
    } 
    else if (sectionName === 'measurement' || sectionName === 'charts') {
        if (main) main.style.display = 'block';
        var mc = document.getElementById('measurement-center');
        if (mc) mc.style.setProperty('display', 'block', 'important');
        window.location.hash = 'measurement';
    } 
    else if (sectionName === 'plans') {
        if (main) main.style.display = 'block';
        var pg = document.getElementById('plan-generator') || document.getElementById('view-plans-container');
        if (pg) pg.style.setProperty('display', 'block', 'important');
        window.location.hash = 'plans';
    } 
    else if (sectionName === 'alerts') {
        alert('لا توجد مهام حرجة معلقة حالياً.');
        var lobby = document.getElementById('quiet-lobby');
        if (lobby) lobby.style.setProperty('display', 'block', 'important');
        window.location.hash = '';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function returnToLobby(e) {
    if (e) e.preventDefault();
    navigateToSection('lobby');
}

// ربط النقر العام لضمان الاستجابة التامة
document.addEventListener('click', function(e) {
    var door = e.target.closest('[data-target], .door-card, .quiet-doors button');
    if (door) {
        var target = door.getAttribute('data-target') || door.getAttribute('data-room');
        if (target) {
            e.preventDefault();
            if (target.includes('alert')) navigateToSection('alerts');
            else if (target.includes('chart') || target.includes('measure')) navigateToSection('measurement');
            else if (target.includes('reg')) navigateToSection('registers');
            else if (target.includes('plan')) navigateToSection('plans');
            return;
        }
    }

    if (e.target.closest('#btn-global-return, .sidebar-return-btn')) {
        e.preventDefault();
        navigateToSection('lobby');
        return;
    }

    var sideLink = e.target.closest('.sidebar-nav a, .app-sidebar a');
    if (sideLink) {
        var text = sideLink.innerText || '';
        if (text.includes('الرئيسية')) {
            e.preventDefault();
            navigateToSection('lobby');
        } else if (text.includes('السجلات')) {
            e.preventDefault();
            navigateToSection('registers');
        } else if (text.includes('المؤشرات') || text.includes('التحليلات')) {
            e.preventDefault();
            navigateToSection('measurement');
        } else if (text.includes('الخطط')) {
            e.preventDefault();
            navigateToSection('plans');
        }
    }
});

window.addEventListener('DOMContentLoaded', function() {
    var hash = window.location.hash.replace('#', '');
    if (hash === 'registers') navigateToSection('registers');
    else if (hash === 'plans') navigateToSection('plans');
    else if (hash === 'measurement') navigateToSection('measurement');
    else if (!document.getElementById("measurement-center") && document.getElementById("plan-form")) navigateToSection("plans");
    else navigateToSection("home");
});


// ==========================================================================
// محرك التوجيه والعزل الصارم بين الشاشات الأربعة
// ==========================================================================

function navigateToSection(sectionName) {
    var view = {
        lobby: "home",
        home: "home",
        alerts: "home",
        charts: "measurement",
        measurement: "measurement",
        registers: "registers",
        plans: "plans",
        committees: "committees"
    }[sectionName] || "home";
    if (window.setDashboardView) {
        window.setDashboardView(view);
    }
    return;
    var elementsToHide = [
        'quiet-lobby',
        'registers-portal',
        'register-filters',
        'measurement-center',
        'plan-generator',
        'view-plans-container',
        'analytics-hub'
    ];
    
    elementsToHide.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important');
    });

    var main = document.querySelector('.app-main');
    if (main) main.style.display = 'none';

    // 2. إظهار القسم المطلوب حصراً
    if (sectionName === 'lobby' || sectionName === 'home') {
        var lobby = document.getElementById('quiet-lobby');
        if (lobby) lobby.style.setProperty('display', 'block', 'important');
        window.location.hash = '';
    } 
    else if (sectionName === 'registers') {
        if (main) main.style.display = 'block';
        var reg = document.getElementById('registers-portal');
        if (reg) reg.style.setProperty('display', 'block', 'important');
        var regFilter = document.getElementById('register-filters');
        if (regFilter) regFilter.style.setProperty('display', 'block', 'important');
        window.location.hash = 'registers';
    } 
    else if (sectionName === 'measurement' || sectionName === 'charts') {
        if (main) main.style.display = 'block';
        var mc = document.getElementById('measurement-center');
        if (mc) mc.style.setProperty('display', 'block', 'important');
        window.location.hash = 'measurement';
    } 
    else if (sectionName === 'plans') {
        if (main) main.style.display = 'block';
        var pg = document.getElementById('plan-generator') || document.getElementById('view-plans-container');
        if (pg) pg.style.setProperty('display', 'block', 'important');
        window.location.hash = 'plans';
    } 
    else if (sectionName === 'alerts') {
        alert('لا توجد مهام حرجة معلقة حالياً.');
        var lobby = document.getElementById('quiet-lobby');
        if (lobby) lobby.style.setProperty('display', 'block', 'important');
        window.location.hash = '';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function returnToLobby(e) {
    if (e) e.preventDefault();
    navigateToSection('lobby');
}

// ربط النقر العام لضمان الاستجابة التامة
document.addEventListener('click', function(e) {
    var door = e.target.closest('[data-target], .door-card, .quiet-doors button');
    if (door) {
        var target = door.getAttribute('data-target') || door.getAttribute('data-room');
        if (target) {
            e.preventDefault();
            if (target.includes('alert')) navigateToSection('alerts');
            else if (target.includes('chart') || target.includes('measure')) navigateToSection('measurement');
            else if (target.includes('reg')) navigateToSection('registers');
            else if (target.includes('plan')) navigateToSection('plans');
            return;
        }
    }

    if (e.target.closest('#btn-global-return, .sidebar-return-btn')) {
        e.preventDefault();
        navigateToSection('lobby');
        return;
    }

    var sideLink = e.target.closest('.sidebar-nav a, .app-sidebar a');
    if (sideLink) {
        var text = sideLink.innerText || '';
        if (text.includes('الرئيسية')) {
            e.preventDefault();
            navigateToSection('lobby');
        } else if (text.includes('السجلات')) {
            e.preventDefault();
            navigateToSection('registers');
        } else if (text.includes('المؤشرات') || text.includes('التحليلات')) {
            e.preventDefault();
            navigateToSection('measurement');
        } else if (text.includes('الخطط')) {
            e.preventDefault();
            navigateToSection('plans');
        }
    }
});

window.addEventListener('DOMContentLoaded', function() {
    var hash = window.location.hash.replace('#', '');
    if (hash === 'registers') navigateToSection('registers');
    else if (hash === 'plans') navigateToSection('plans');
    else if (hash === 'measurement') navigateToSection('measurement');
    else if (!document.getElementById("measurement-center") && document.getElementById("plan-form")) navigateToSection("plans");
    else navigateToSection("home");
});

document.addEventListener("change", function (event) {
    syncDualDateField(event.target);
});
watchDualDates();
