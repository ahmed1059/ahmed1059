// إعدادات المدرسة وفريق التخطيط: الجلب عند الفتح، والحفظ عبر /api/settings
var OFFICIAL_PRINCIPAL_NAME = "نايف بن سمير حجيف المخلفي";

function principalName(value) {
    var name = value ? String(value).trim() : "";
    if (!name || name.indexOf("نائف") !== -1) {
        return OFFICIAL_PRINCIPAL_NAME;
    }
    return name;
}

var settingsMessage = document.getElementById("settings-message");

function showSettingsMessage(text) {
    settingsMessage.textContent = text;
}

function applyBookletIdentity(school) {
    var schoolName = school && school.name ? school.name : "متوسطة سعد بن الربيع الأنصاري";
    var office = school && school.education_office ? school.education_office.trim() : "";
    var admin = school && school.education_administration ? school.education_administration.trim() : "";
    if (!admin) {
        admin = "الإدارة العامة للتعليم بمنطقة المدينة المنورة";
    }
    document.querySelectorAll(".header-admin").forEach(function (node) {
        node.textContent = admin;
    });
    document.querySelectorAll(".header-office").forEach(function (node) {
        node.textContent = office;
    });
    var schoolNode = document.getElementById("official-school");
    if (schoolNode && schoolName) {
        schoolNode.textContent = schoolName;
    }
}

function addSourceRow(value) {
    var row = document.createElement("div");
    row.className = "source-row";
    var input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    var removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn-remove";
    removeButton.textContent = "×";
    removeButton.addEventListener("click", function () {
        row.remove();
    });
    row.appendChild(input);
    row.appendChild(removeButton);
    document.getElementById("sources-list").appendChild(row);
    return input;
}

var COMMITTEE_ROLES = ["عضو", "نائب الرئيس", "مقرر اللجنة", "مسؤول التنفيذ", "مسؤول المتابعة"];

function addPersonRow(listId, value) {
    var row = document.createElement("div");
    row.className = "source-row";
    var input = document.createElement("input");
    input.type = "text";
    input.className = "person-name";
    input.value = value || "";
    var removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn-remove";
    removeButton.textContent = "×";
    removeButton.addEventListener("click", function () {
        row.remove();
    });
    row.appendChild(input);
    row.appendChild(removeButton);
    document.getElementById(listId).appendChild(row);
    return input;
}

function renderPeople(listId, names) {
    var list = document.getElementById(listId);
    list.innerHTML = "";
    var items = names && names.length ? names : [""];
    items.forEach(function (name) {
        addPersonRow(listId, name);
    });
}

function collectNames(listId) {
    var names = [];
    document.querySelectorAll("#" + listId + " .person-name").forEach(function (input) {
        if (input.value.trim()) {
            names.push(input.value.trim());
        }
    });
    return names;
}

function renderTeachers(teachers, members, deputies) {
    var body = document.getElementById("teacher-rows");
    body.innerHTML = "";
    var selected = {};
    (members || []).forEach(function (member) {
        if (member.id) {
            selected[member.id] = member;
        }
        if (member.name) {
            selected[member.name] = member;
        }
    });
    var deputyByKey = {};
    (deputies || []).forEach(function (person) {
        if (person.id) {
            deputyByKey[person.id] = person;
        }
        if (person.name) {
            deputyByKey[person.name] = person;
        }
    });
    if (!teachers.length) {
        var empty = document.createElement("tr");
        empty.innerHTML = "<td colspan='3'>لا يوجد منسوبون في ملف الشواهد</td>";
        body.appendChild(empty);
        return;
    }
    var rosterSaved = (members || []).some(function (member) {
        return member.name === "__roster__";
    });
    teachers.forEach(function (teacher) {
        var saved = selected[teacher.id] || selected[teacher.name] || null;
        var deputy = deputyByKey[teacher.id] || deputyByKey[teacher.name] || null;
        var row = document.createElement("tr");
        row.dataset.id = teacher.id || "";
        row.dataset.name = teacher.name || "";
        var checkCell = document.createElement("td");
        var box = document.createElement("input");
        box.type = "checkbox";
        box.className = "member-check";
        box.checked = saved ? true : Boolean(deputy && !rosterSaved);
        checkCell.appendChild(box);
        var nameCell = document.createElement("td");
        nameCell.textContent = teacher.name || "";
        var roleCell = document.createElement("td");
        var roleInput = document.createElement("select");
        roleInput.className = "member-role";
        var chosen = saved && saved.role ? saved.role : (deputy && deputy.role ? deputy.role : "عضو");
        var options = COMMITTEE_ROLES.slice();
        if (deputy && deputy.role && options.indexOf(deputy.role) === -1) {
            options.unshift(deputy.role);
        }
        if (chosen && options.indexOf(chosen) === -1) {
            options.unshift(chosen);
        }
        options.forEach(function (role) {
            var option = document.createElement("option");
            option.value = role;
            option.textContent = role;
            roleInput.appendChild(option);
        });
        roleInput.value = chosen;
        roleCell.appendChild(roleInput);
        row.appendChild(checkCell);
        row.appendChild(nameCell);
        row.appendChild(roleCell);
        body.appendChild(row);
    });
}

function renderSources(sources) {
    var list = document.getElementById("sources-list");
    list.innerHTML = "";
    (sources || []).forEach(function (source) {
        addSourceRow(source);
    });
}

var DEFAULT_ADMINISTRATION = "الإدارة العامة للتعليم بمنطقة المدينة المنورة";

function administrationChoices(regions) {
    var names = regions && regions.length ? regions : ["المدينة المنورة", "مكة المكرمة", "جدة", "الطائف", "الرياض"];
    return names.map(function (region) {
        return "الإدارة العامة للتعليم بمنطقة " + region;
    });
}

function administrationValue() {
    var select = document.getElementById("education-administration");
    var custom = document.getElementById("education-administration-custom");
    if (select.value === "أخرى") {
        return custom.value.trim() || DEFAULT_ADMINISTRATION;
    }
    return select.value || DEFAULT_ADMINISTRATION;
}

function fillAdministration(value, regions) {
    var select = document.getElementById("education-administration");
    var custom = document.getElementById("education-administration-custom");
    select.innerHTML = "";
    administrationChoices(regions).forEach(function (label) {
        var option = document.createElement("option");
        option.value = label;
        option.textContent = label;
        select.appendChild(option);
    });
    var other = document.createElement("option");
    other.value = "أخرى";
    other.textContent = "أخرى";
    select.appendChild(other);
    var stored = (value || "").trim() || DEFAULT_ADMINISTRATION;
    var known = [].some.call(select.options, function (option) {
        return option.value === stored;
    });
    if (known) {
        select.value = stored;
        custom.value = "";
        custom.hidden = true;
    } else {
        select.value = "أخرى";
        custom.value = stored;
        custom.hidden = false;
    }
}

function addApprovalPerson(tbody, person) {
    var row = document.createElement("tr");
    var nameCell = document.createElement("td");
    var roleCell = document.createElement("td");
    var actionCell = document.createElement("td");
    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "cell-input approval-person-name";
    nameInput.value = person && person.name ? person.name : "";
    var roleInput = document.createElement("input");
    roleInput.type = "text";
    roleInput.className = "cell-input approval-person-role";
    roleInput.value = person && person.role ? person.role : "";
    var removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn-remove";
    removeButton.textContent = "×";
    removeButton.addEventListener("click", function () {
        row.remove();
    });
    nameCell.appendChild(nameInput);
    roleCell.appendChild(roleInput);
    actionCell.appendChild(removeButton);
    row.appendChild(nameCell);
    row.appendChild(roleCell);
    row.appendChild(actionCell);
    tbody.appendChild(row);
}

function renderApproval(map) {
    var root = document.getElementById("approval-authorities");
    if (!root) {
        return;
    }
    root.innerHTML = "";
    var principal = map && map.principal ? map.principal : {};
    var principalGrid = document.createElement("div");
    principalGrid.className = "form-grid";
    var nameWrap = document.createElement("div");
    var nameLabel = document.createElement("label");
    nameLabel.textContent = "اعتماد مدير المدرسة";
    nameLabel.htmlFor = "approval-principal-name";
    var nameInput = document.createElement("input");
    nameInput.id = "approval-principal-name";
    nameInput.type = "text";
    nameInput.readOnly = true;
    nameInput.value = principalName(principal.name || "");
    nameWrap.appendChild(nameLabel);
    nameWrap.appendChild(nameInput);
    principalGrid.appendChild(nameWrap);
    principalGrid.dataset.signature = principal.signature || "signatures/sig_manager.png";
    principalGrid.dataset.driveId = principal.drive_id || "";
    principalGrid.dataset.title = principal.title || "مدير المدرسة";
    root.appendChild(principalGrid);

    (map && map.authorities ? map.authorities : []).forEach(function (authority) {
        var block = document.createElement("div");
        block.className = "approval-block";
        block.dataset.signature = authority.signature || "";
        block.dataset.driveId = authority.drive_id || "";
        var grid = document.createElement("div");
        grid.className = "form-grid";
        var approverWrap = document.createElement("div");
        var approverLabel = document.createElement("label");
        approverLabel.textContent = "الوكيل المعتمد";
        var approverInput = document.createElement("input");
        approverInput.type = "text";
        approverInput.className = "approval-name";
        approverInput.value = authority.name || "";
        approverWrap.appendChild(approverLabel);
        approverWrap.appendChild(approverInput);
        var titleWrap = document.createElement("div");
        var titleLabel = document.createElement("label");
        titleLabel.textContent = "الصفة";
        var titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.className = "approval-title";
        titleInput.value = authority.title || "";
        titleWrap.appendChild(titleLabel);
        titleWrap.appendChild(titleInput);
        grid.appendChild(approverWrap);
        grid.appendChild(titleWrap);
        var table = document.createElement("table");
        table.className = "data-table settings-table";
        var thead = document.createElement("thead");
        var headRow = document.createElement("tr");
        ["الاسم", "المهمة", ""].forEach(function (label) {
            var th = document.createElement("th");
            th.textContent = label;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        var tbody = document.createElement("tbody");
        var people = authority.people && authority.people.length ? authority.people : [{ name: "", role: "" }];
        people.forEach(function (person) {
            addApprovalPerson(tbody, person);
        });
        table.appendChild(thead);
        table.appendChild(tbody);
        var addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className = "btn-secondary";
        addButton.textContent = "+ إضافة اسم";
        addButton.addEventListener("click", function () {
            addApprovalPerson(tbody, { name: "", role: "" });
            tbody.lastChild.querySelector("input").focus();
        });
        var actions = document.createElement("div");
        actions.className = "form-actions";
        actions.appendChild(addButton);
        block.appendChild(grid);
        block.appendChild(table);
        block.appendChild(actions);
        root.appendChild(block);
    });
}

function collectApproval() {
    var principalGrid = document.querySelector("#approval-authorities .form-grid");
    var authorities = [];
    document.querySelectorAll("#approval-authorities .approval-block").forEach(function (block) {
        var people = [];
        block.querySelectorAll("tbody tr").forEach(function (row) {
            var name = row.querySelector(".approval-person-name");
            var role = row.querySelector(".approval-person-role");
            if (name && name.value.trim()) {
                people.push({
                    name: name.value.trim(),
                    role: role ? role.value.trim() : ""
                });
            }
        });
        var nameInput = block.querySelector(".approval-name");
        var titleInput = block.querySelector(".approval-title");
        authorities.push({
            name: nameInput ? nameInput.value.trim() : "",
            title: titleInput ? titleInput.value.trim() : "",
            signature: block.dataset.signature || "",
            drive_id: block.dataset.driveId || "",
            people: people
        });
    });
    return {
        principal: {
            name: document.getElementById("approval-principal-name") ? document.getElementById("approval-principal-name").value.trim() : OFFICIAL_PRINCIPAL_NAME,
            title: principalGrid && principalGrid.dataset.title ? principalGrid.dataset.title : "مدير المدرسة",
            signature: principalGrid && principalGrid.dataset.signature ? principalGrid.dataset.signature : "signatures/sig_manager.png",
            drive_id: principalGrid && principalGrid.dataset.driveId ? principalGrid.dataset.driveId : ""
        },
        authorities: authorities
    };
}

function fillSettings(data) {
    var school = data.school || {};
    document.getElementById("school-name").value = school.name || "متوسطة سعد بن الربيع الأنصاري";
    document.getElementById("statistical-number").value = school.statistical_number || "";
    document.getElementById("office_name").value = school.education_office || "";
    fillAdministration(school.education_administration, settingsRegions);
    document.getElementById("building-type").value = school.building_type || "حكومي";
    document.getElementById("classrooms").value = school.classrooms || "";
    document.getElementById("labs").value = school.labs || "";
    document.getElementById("sports-halls").value = school.sports_halls || "";
    document.getElementById("total-students").value = school.total_students || "";
    document.getElementById("total-staff").value = school.total_staff || "";
    var storedWeeks = parseInt(school.term_weeks_count, 10);
    document.getElementById("term_weeks_count").value = storedWeeks >= 10 && storedWeeks <= 20 ? String(storedWeeks) : "18";
    var committee = data.committee || {};
    document.getElementById("chair-name").value = principalName(data.principal_name || committee.chair_name || "");
    renderPeople("parents-list", committee.parent_representative || []);
    renderPeople("students-list", committee.student_representative || []);
    renderTeachers(data.teachers || [], committee.members || [], data.deputies || []);
    renderSources(data.sources || []);
    renderApproval(data.approval || settingsApprovalFallback);
    applyBookletIdentity(school);
}

function collectSettings() {
    var members = [];
    document.querySelectorAll("#teacher-rows tr").forEach(function (row) {
        var box = row.querySelector(".member-check");
        if (!box || !box.checked) {
            return;
        }
        members.push({
            id: row.dataset.id || "",
            name: row.dataset.name || "",
            role: row.querySelector(".member-role").value
        });
    });
    members.push({ id: "", name: "__roster__", role: "" });
    var sources = [];
    document.querySelectorAll("#sources-list input").forEach(function (input) {
        if (input.value.trim()) {
            sources.push(input.value.trim());
        }
    });
    return {
        school: {
            name: document.getElementById("school-name").value.trim() || "متوسطة سعد بن الربيع الأنصاري",
            statistical_number: document.getElementById("statistical-number").value,
            education_office: document.getElementById("office_name").value.trim(),
            education_administration: administrationValue(),
            building_type: document.getElementById("building-type").value,
            classrooms: document.getElementById("classrooms").value,
            labs: document.getElementById("labs").value,
            sports_halls: document.getElementById("sports-halls").value,
            total_students: document.getElementById("total-students").value,
            total_staff: document.getElementById("total-staff").value,
            term_weeks_count: parseInt(document.getElementById("term_weeks_count").value, 10) || 18
        },
        committee: {
            chair_name: document.getElementById("chair-name").value,
            members: members,
            parent_representative: collectNames("parents-list"),
            student_representative: collectNames("students-list")
        },
        sources: sources,
        approval: collectApproval()
    };
}

function saveSettings() {
    var payload = collectSettings();
    return fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).then(function (response) {
        return response.json().then(function (body) {
            if (!response.ok) {
                throw new Error(body.detail || "تعذر حفظ الإعدادات");
            }
            return payload;
        });
    });
}

document.getElementById("add-source").addEventListener("click", function () {
    addSourceRow("").focus();
});

document.getElementById("add-parent").addEventListener("click", function () {
    addPersonRow("parents-list", "").focus();
});

document.getElementById("add-student").addEventListener("click", function () {
    addPersonRow("students-list", "").focus();
});

document.getElementById("save-settings").addEventListener("click", function () {
    showSettingsMessage("جارٍ حفظ الإعدادات");
    saveSettings().then(function () {
        showSettingsMessage("تم حفظ الإعدادات");
    }).catch(function (error) {
        showSettingsMessage(error.message);
    });
});

document.getElementById("apply-settings").addEventListener("click", function () {
    showSettingsMessage("جارٍ تطبيق الإعدادات");
    saveSettings().then(function (payload) {
        applyBookletIdentity(payload.school);
        showSettingsMessage("تم تطبيق الإعدادات على الكتيب");
    }).catch(function (error) {
        showSettingsMessage(error.message);
    });
});

var settingsRegions = [];
var settingsApprovalFallback = { principal: { name: OFFICIAL_PRINCIPAL_NAME, title: "مدير المدرسة", signature: "signatures/sig_manager.png", drive_id: "" }, authorities: [] };

document.getElementById("education-administration").addEventListener("change", function () {
    var custom = document.getElementById("education-administration-custom");
    var other = this.value === "أخرى";
    custom.hidden = !other;
    if (other) {
        custom.focus();
    }
});

Promise.all([
    fetch("/api/settings").then(function (response) {
        if (!response.ok) {
            throw new Error("تعذر تحميل الإعدادات");
        }
        return response.json();
    }),
    fetch("/api/regions").then(function (response) {
        return response.ok ? response.json() : [];
    }).catch(function () {
        return [];
    }),
    fetch("/banks/approval_authorities.json").then(function (response) {
        return response.ok ? response.json() : null;
    }).catch(function () {
        return null;
    })
]).then(function (trio) {
    settingsRegions = trio[1] || [];
    if (trio[2] && trio[2].authorities) {
        settingsApprovalFallback = trio[2];
    }
    var payload = trio[0] || {};
    if (!payload.approval || !payload.approval.authorities || !payload.approval.authorities.length) {
        payload.approval = settingsApprovalFallback;
    }
    fillSettings(payload);
}).catch(function (error) {
    showSettingsMessage(error.message);
});
