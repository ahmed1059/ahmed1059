// محرر البيانات الأساسية: لا يطلب المحتوى إلا بعد الضغط على البطاقة

var basicsCard = document.getElementById("card-basics");
var setupGrid = document.querySelector(".setup-grid");
var contentEditor = document.getElementById("content-editor");
var contentMessage = document.getElementById("content-message");
var originals = {};
var goalsBaseline = "";

var fields = [
    {
        id: "f-vision",
        path: "vision.text",
        read: function (data) { return data.vision.text; }
    },
    {
        id: "f-mission",
        path: "mission.text",
        read: function (data) { return data.mission.text; }
    },
    {
        id: "f-values",
        path: "values",
        read: function (data) {
            return data.values.map(function (item) { return item.name; }).join("\n");
        }
    },
    {
        id: "f-introduction",
        path: "introduction.paragraphs",
        read: function (data) { return data.introduction.paragraphs.join("\n\n"); }
    },
    {
        id: "f-signature-name",
        path: "introduction.signature.name",
        read: function (data) { return data.introduction.signature.name; }
    },
    {
        id: "f-signature-title",
        path: "introduction.signature.title",
        read: function (data) { return data.introduction.signature.title; }
    },
    {
        id: "f-footer-note",
        path: "footer.footer_note",
        read: function (data) { return data.footer.footer_note; }
    }
];

function showContentMessage(text) {
    contentMessage.textContent = text;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m];
    });
}

function renderKpis(card, indicators) {
    var ul = card.querySelector(".goal-indicators");
    ul.innerHTML = "";
    indicators.forEach(function (ind) {
        var li = document.createElement("li");
        li.innerHTML = `
            <span>${escapeHtml(ind.kpi)}</span>
            <span>${escapeHtml(ind.target)}</span>
            <span>${escapeHtml(ind.measurement || "")}</span>
            <button class="btn-remove" type="button" data-action="remove-kpi">×</button>
        `;
        ul.appendChild(li);
    });
}

function renderPrograms(card, programs) {
    var ul = card.querySelector(".goal-programs");
    ul.innerHTML = "";
    programs.forEach(function (p) {
        var li = document.createElement("li");
        li.innerHTML = `
            <span>${escapeHtml(p)}</span>
            <button class="btn-remove" type="button" data-action="remove-program">×</button>
        `;
        ul.appendChild(li);
    });
}

function buildGoalCard(g, idx) {
    var card = document.createElement("div");
    card.className = "goal-card selected";
    card.dataset.index = idx;
    card.innerHTML = `
        <div class="goal-card-header">
            <input type="checkbox" checked data-field="selected">
            <input type="text" value="${escapeHtml(g.text)}" data-field="text">
            <button class="btn-remove" type="button" data-action="delete-goal">حذف</button>
        </div>
        <div class="goal-card-body">
            <strong>المؤشرات (KPIs):</strong>
            <ul class="goal-indicators"></ul>
            <button class="btn-secondary btn-sm" type="button" data-action="add-kpi">+ مؤشر</button>
            <strong>البرامج:</strong>
            <ul class="goal-programs"></ul>
            <button class="btn-secondary btn-sm" type="button" data-action="add-program">+ برنامج</button>
        </div>
    `;
    renderKpis(card, g.indicators || []);
    renderPrograms(card, g.programs || []);
    return card;
}

function renderGoals(goals) {
    var list = document.getElementById("goals-list");
    list.innerHTML = "";
    goals.forEach(function (g, idx) {
        list.appendChild(buildGoalCard(g, idx));
    });
    goalsBaseline = JSON.stringify(collectGoals());
}

function collectGoals() {
    var cards = document.querySelectorAll(".goal-card");
    var goals = [];
    cards.forEach(function (card) {
        var selected = card.querySelector("[data-field=\"selected\"]").checked;
        if (!selected) {
            return;
        }
        var text = card.querySelector("[data-field=\"text\"]").value;
        var indicators = [];
        card.querySelectorAll(".goal-indicators li").forEach(function (li) {
            var nameInput = li.querySelector(".kpi-name");
            if (nameInput) {
                indicators.push({
                    kpi: nameInput.value,
                    target: li.querySelector(".kpi-target").value,
                    measurement: li.querySelector(".kpi-measure").value
                });
                return;
            }
            var spans = li.querySelectorAll("span");
            indicators.push({
                kpi: spans[0].textContent,
                target: spans[1].textContent,
                measurement: spans[2] ? spans[2].textContent : ""
            });
        });
        var programs = [];
        card.querySelectorAll(".goal-programs li").forEach(function (li) {
            var programInput = li.querySelector(".program-name");
            if (programInput) {
                programs.push(programInput.value);
                return;
            }
            programs.push(li.querySelector("span").textContent);
        });
        goals.push({ text: text, indicators: indicators, programs: programs });
    });
    return goals;
}

function fillEditor(data) {
    fields.forEach(function (field) {
        var element = document.getElementById(field.id);
        var value = field.read(data);
        element.value = value;
        originals[field.id] = value;
    });
    renderGoals(data.strategic_goals.goals);
}

function loadContent() {
    showContentMessage("جارٍ تحميل البيانات");
    return fetch("/api/content/principal")
        .then(function (response) {
            return response.json().then(function (data) {
                if (!response.ok) {
                    throw new Error(data.detail || "تعذر تحميل البيانات");
                }
                return data;
            });
        })
        .then(function (data) {
            fillEditor(data);
            showContentMessage("");
        });
}

function openBasics() {
    showSetupPanel("basics");
    loadContent().catch(function (error) {
        showContentMessage(error.message);
    });
}

function postField(path, value) {
    return fetch("/api/content/principal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_path: path, value: value })
    }).then(function (response) {
        return response.json().then(function (data) {
            if (!response.ok) {
                throw new Error(data.detail || "تعذر الحفظ");
            }
            return data;
        });
    });
}

basicsCard.addEventListener("click", function () {
    openBasics();
});

document.getElementById("btn-add-goal").addEventListener("click", function () {
    var list = document.getElementById("goals-list");
    list.appendChild(buildGoalCard({ text: "", indicators: [], programs: [] }, list.children.length));
});

document.getElementById("goals-list").addEventListener("click", function (event) {
    var action = event.target.getAttribute("data-action");
    if (!action) {
        return;
    }
    var card = event.target.closest(".goal-card");
    if (action === "delete-goal") {
        card.remove();
        return;
    }
    if (action === "remove-kpi" || action === "remove-program") {
        event.target.closest("li").remove();
        return;
    }
    if (action === "add-kpi") {
        var kpiRow = document.createElement("li");
        kpiRow.innerHTML = `
            <input type="text" placeholder="المؤشر (KPI)" class="kpi-name">
            <input type="text" placeholder="القيمة المستهدفة" class="kpi-target">
            <input type="text" placeholder="طريقة القياس" class="kpi-measure">
            <button class="btn-remove" type="button" data-action="remove-kpi">×</button>
        `;
        card.querySelector(".goal-indicators").appendChild(kpiRow);
        return;
    }
    if (action === "add-program") {
        var programRow = document.createElement("li");
        programRow.innerHTML = `
            <input type="text" placeholder="اسم البرنامج" class="program-name">
            <button class="btn-remove" type="button" data-action="remove-program">×</button>
        `;
        card.querySelector(".goal-programs").appendChild(programRow);
    }
});

document.getElementById("goals-list").addEventListener("change", function (event) {
    if (event.target.getAttribute("data-field") !== "selected") {
        return;
    }
    event.target.closest(".goal-card").classList.toggle("selected", event.target.checked);
});

document.getElementById("save-all").addEventListener("click", function () {
    var pending = fields.filter(function (field) {
        return document.getElementById(field.id).value !== originals[field.id];
    });
    var goalsValue = JSON.stringify(collectGoals());
    var goalsChanged = goalsValue !== goalsBaseline;
    if (!pending.length && !goalsChanged) {
        showContentMessage("لا توجد تعديلات للحفظ");
        return;
    }
    showContentMessage("جارٍ الحفظ");
    var chain = Promise.resolve();
    pending.forEach(function (field) {
        chain = chain.then(function () {
            return postField(field.path, document.getElementById(field.id).value);
        });
    });
    if (goalsChanged) {
        chain = chain.then(function () {
            return postField("strategic_goals.goals", goalsValue);
        });
    }
    chain.then(function () {
        pending.forEach(function (field) {
            originals[field.id] = document.getElementById(field.id).value;
        });
        goalsBaseline = goalsValue;
        showContentMessage("تم حفظ التعديلات");
    }).catch(function (error) {
        showContentMessage(error.message);
    });
});

document.getElementById("reset-all").addEventListener("click", function () {
    showContentMessage("جارٍ استعادة النص الافتراضي");
    fetch("/api/content/principal/all", { method: "DELETE" })
        .then(function (response) {
            return response.json().then(function (data) {
                if (!response.ok) {
                    throw new Error(data.detail || "تعذرت الاستعادة");
                }
                return data;
            });
        })
        .then(function () {
            return loadContent();
        })
        .then(function () {
            showContentMessage("تمت استعادة النص الافتراضي");
        })
        .catch(function (error) {
            showContentMessage(error.message);
        });
});

// رجوع من محرر البيانات الأساسية إلى البطاقات الثلاث
document.getElementById("back-grid").addEventListener("click", function () {
    showSetupPanel("cards");
    showContentMessage("");
});

var planTypeLabels = {
    operational: "الخطة التشغيلية",
    executive: "الخطة التنفيذية",
    monitoring: "خطة المتابعة والتقييم"
};
var scopeLabels = {
    daily: "يومية",
    weekly: "أسبوعية",
    monthly: "شهرية",
    semester: "فصلية",
    annual: "سنوية"
};

function showSetupPanel(name) {
    setupGrid.hidden = name !== "cards";
    contentEditor.hidden = name !== "basics";
    document.getElementById("plan-type-selector").hidden = name !== "type";
    document.getElementById("generation-scope-selector").hidden = name !== "scope";
}

function markSelection(groupName) {
    document.querySelectorAll('input[name="' + groupName + '"]').forEach(function (input) {
        input.closest(".selection-card").classList.toggle("selected", input.checked);
    });
}

function applyChoice(storageKey, badgeId, buttonId, labels) {
    var value = sessionStorage.getItem(storageKey);
    var badge = document.getElementById(badgeId);
    var button = document.getElementById(buttonId);
    if (!value || !labels[value]) {
        badge.hidden = true;
        button.disabled = true;
        return;
    }
    badge.hidden = false;
    badge.textContent = labels[value];
    button.disabled = false;
}

function restoreStoredChoice(groupName, storageKey) {
    var value = sessionStorage.getItem(storageKey);
    document.querySelectorAll('input[name="' + groupName + '"]').forEach(function (input) {
        input.checked = input.value === value;
    });
    markSelection(groupName);
}

document.getElementById("card-type").addEventListener("click", function () {
    restoreStoredChoice("plan-type", "selectedPlanType");
    document.getElementById("type-message").textContent = "";
    showSetupPanel("type");
});

document.getElementById("next-type").addEventListener("click", function (event) {
    event.stopPropagation();
    restoreStoredChoice("plan-type", "selectedPlanType");
    showSetupPanel("type");
});

document.getElementById("card-scope").addEventListener("click", function () {
    restoreStoredChoice("generation-scope", "selectedGenerationScope");
    document.getElementById("scope-message").textContent = "";
    showSetupPanel("scope");
});

document.getElementById("next-scope").addEventListener("click", function (event) {
    event.stopPropagation();
    restoreStoredChoice("generation-scope", "selectedGenerationScope");
    showSetupPanel("scope");
});

document.getElementById("plan-type-selector").addEventListener("change", function () {
    markSelection("plan-type");
    var picked = document.querySelector('input[name="plan-type"]:checked');
    if (!picked) {
        return;
    }
    sessionStorage.setItem("selectedPlanType", picked.value);
    applyChoice("selectedPlanType", "badge-type", "next-type", planTypeLabels);
});

document.getElementById("generation-scope-selector").addEventListener("change", function () {
    markSelection("generation-scope");
    var picked = document.querySelector('input[name="generation-scope"]:checked');
    if (!picked) {
        return;
    }
    sessionStorage.setItem("selectedGenerationScope", picked.value);
    applyChoice("selectedGenerationScope", "badge-scope", "next-scope", scopeLabels);
});

document.getElementById("confirm-plan-type").addEventListener("click", function () {
    var picked = document.querySelector('input[name="plan-type"]:checked');
    if (!picked) {
        document.getElementById("type-message").textContent = "اختر نوع الخطة أولًا";
        return;
    }
    sessionStorage.setItem("selectedPlanType", picked.value);
    applyChoice("selectedPlanType", "badge-type", "next-type", planTypeLabels);
    showSetupPanel("cards");
});

document.getElementById("back-from-type").addEventListener("click", function () {
    showSetupPanel("cards");
});

document.getElementById("back-from-scope").addEventListener("click", function () {
    showSetupPanel("cards");
});

document.getElementById("start-generation").addEventListener("click", function () {
    var pickedScope = document.querySelector('input[name="generation-scope"]:checked');
    if (pickedScope) {
        sessionStorage.setItem("selectedGenerationScope", pickedScope.value);
        applyChoice("selectedGenerationScope", "badge-scope", "next-scope", scopeLabels);
    }
    var setupRaw = sessionStorage.getItem("planSetup");
    var planType = sessionStorage.getItem("selectedPlanType");
    var scope = sessionStorage.getItem("selectedGenerationScope");
    if (!setupRaw || !planType || !scope) {
        document.getElementById("scope-message").textContent = "أكمل نوع الخطة وطريقة التوليد بعد نموذج لوحة التحكم";
        return;
    }
    var setup = JSON.parse(setupRaw);
    sessionStorage.setItem("planReady", JSON.stringify({
        region: setup.region,
        stage: setup.stage,
        gender: setup.gender,
        semester: setup.semester,
        excel_filename: setup.excel_filename,
        plan_type: planType,
        generation_scope: scope
    }));
    window.location.href = "dashboard.html?view=plan";
});

applyChoice("selectedPlanType", "badge-type", "next-type", planTypeLabels);
applyChoice("selectedGenerationScope", "badge-scope", "next-scope", scopeLabels);

function applySchoolHeader(school) {
    var data = school || {};
    var schoolName = (data.name || "").trim() || "متوسطة سعد بن الربيع الأنصاري";
    var admin = (data.education_administration || "").trim() || "الإدارة العامة للتعليم بمنطقة المدينة المنورة";
    var office = (data.education_office || "").trim();
    document.querySelectorAll(".header-admin").forEach(function (node) {
        node.textContent = admin;
    });
    document.querySelectorAll(".header-office").forEach(function (node) {
        node.textContent = office;
    });
    var schoolNode = document.getElementById("official-school");
    if (schoolNode) {
        schoolNode.textContent = schoolName;
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
        applySchoolHeader({
            name: data.school.name,
            education_office: data.school.education_office,
            education_administration: data.school.education_administration
        });
    })
    .catch(function () {});
