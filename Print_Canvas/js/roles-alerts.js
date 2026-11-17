var roleViewRules = { roles: [] };
var scoringRules = { composite: { weights: { tasks: 0.4, evidence: 0.3, punctuality: 0.2, participation: 0.1 }, levels: [] }, templates: [] };
var notifyTab = "new";

var roleRulesReady = Promise.all([
    fetch("/banks/roles_view_rules.json?v=suite1").then(function (response) { return response.ok ? response.json() : { roles: [] }; }),
    fetch("/banks/scoring_and_alerts_logic.json").then(function (response) { return response.ok ? response.json() : { templates: [] }; })
]).then(function (payloads) {
    roleViewRules = payloads[0] || roleViewRules;
    scoringRules = payloads[1] || scoringRules;
    window.roleViewRules = roleViewRules;
    if (window.fillDelegationRoles) {
        window.fillDelegationRoles(document.getElementById("register-role-preview"));
    }
    applyRoleView();
    renderNotifications();
}).catch(function () {
    applyRoleView();
});

function compositeScore(parts) {
    var weights = (scoringRules.composite && scoringRules.composite.weights) || { tasks: 0.4, evidence: 0.3, punctuality: 0.2, participation: 0.1 };
    var score = (Number(parts.tasks) || 0) * weights.tasks +
        (Number(parts.evidence) || 0) * weights.evidence +
        (Number(parts.punctuality) || 0) * weights.punctuality +
        (Number(parts.participation) || 0) * weights.participation;
    score = Math.round(score * 10) / 10;
    return { score: score, level: compositeLevel(score) };
}

function compositeLevel(score) {
    var levels = (scoringRules.composite && scoringRules.composite.levels) || [];
    var found = null;
    levels.forEach(function (level) {
        if (score >= level.min && (!found || level.min >= found.min)) {
            found = level;
        }
    });
    return found || { label: "يحتاج تدخل", icon: "🔴" };
}

function savedTaskRate() {
    try {
        var saved = JSON.parse(sessionStorage.getItem("registerFill1059") || "{}");
        var values = Object.keys(saved).map(function (key) { return Number(saved[key]); }).filter(function (value) { return !isNaN(value); });
        if (!values.length) return 0;
        return values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
    } catch (error) {
        return 0;
    }
}

function partsForPerson(person, own) {
    return {
        tasks: own ? savedTaskRate() : 0,
        evidence: person && person.score ? person.score : 0,
        punctuality: 0,
        participation: 0
    };
}

function currentPerson() {
    var account = window.sessionAccount ? sessionAccount() : null;
    var name = account && account.name ? account.name : "";
    var people = window.ProgressEngine ? ProgressEngine.individuals : [];
    var found = people.filter(function (person) { return person.name === name; })[0];
    return found || { name: name, role: account ? account.role : "", score: 0 };
}

function anonymousRank(person) {
    var people = window.ProgressEngine ? ProgressEngine.individuals : [];
    var mine = compositeScore(partsForPerson(person, true)).score;
    var better = 0;
    people.forEach(function (item) {
        var score = compositeScore(partsForPerson(item, item.name === person.name)).score;
        if (score > mine) better += 1;
    });
    return { place: better + 1, total: people.length };
}

function activeRoleText() {
    if (window.registerPreviewRole) return registerPreviewRole;
    var account = window.sessionAccount ? sessionAccount() : null;
    return account && account.role ? account.role : "";
}

function roleRuleFor(text) {
    var found = null;
    (roleViewRules.roles || []).forEach(function (rule) {
        if (rule.match && String(text || "").indexOf(rule.match) !== -1 && !found) {
            found = rule;
        }
    });
    return found || { scope: "supervision", registers: [], widgets: ["registers"], permissions: [] };
}

function applyRoleView() {
    var rule = roleRuleFor(activeRoleText());
    document.body.classList.remove("role-full", "role-self", "role-supervision");
    document.body.classList.add(rule.scope === "full" ? "role-full" : rule.scope === "self" ? "role-self" : "role-supervision");
    var card = document.getElementById("self-achievement");
    if (card) card.hidden = rule.scope !== "self";
    var person = currentPerson();
    var result = compositeScore(partsForPerson(person, true));
    var badge = document.getElementById("composite-badge");
    if (badge) {
        badge.textContent = result.level.icon + " " + result.level.label + " " + result.score;
        badge.classList.toggle("is-alert", String(result.level.label || "").indexOf("يحتاج") !== -1);
    }
    if (rule.scope === "self") {
        var score = document.getElementById("self-score");
        var rank = document.getElementById("self-rank");
        var subject = document.getElementById("self-subject");
        var place = anonymousRank(person);
        if (score) score.textContent = "مؤشر الإنجاز: " + result.score + " — " + result.level.icon + " " + result.level.label;
        if (rank) rank.textContent = "ترتيبك " + place.place + " من " + place.total;
        if (subject) {
            var account = window.sessionAccount ? sessionAccount() : null;
            var namedRole = ((account && account.roles) || []).join(" ") + " " + ((account && account.role) || "") + " " + activeRoleText();
            subject.textContent = namedRole.indexOf("رياضيات") !== -1 ? "المادة المسندة: الرياضيات" : "المواد المسندة وفق جدولك";
        }
    }
    renderNotifications();
}

function readIds() {
    try {
        return JSON.parse(sessionStorage.getItem("notifyRead1059") || "[]");
    } catch (error) {
        return [];
    }
}

function templateActive(template) {
    var snap = window.ProgressEngine && ProgressEngine.snapshot ? ProgressEngine.snapshot() : null;
    if (template.id === "outcomes_gap" && snap) {
        return snap.domainCurrent[2] < snap.domainTarget[2];
    }
    if (template.id === "evidence_gap" && snap) {
        return snap.staffRate < 50;
    }
    if (template.id === "composite_low") {
        return compositeScore(partsForPerson(currentPerson(), true)).score < 60;
    }
    return true;
}

function notificationVisible(template, scope) {
    return (template.audience || []).indexOf(scope) !== -1;
}

function activeScope() {
    if (document.body.classList.contains("role-self")) return "self";
    if (document.body.classList.contains("role-full")) return "full";
    return "supervision";
}

function renderNotifications() {
    var list = document.getElementById("notify-list");
    var badge = document.getElementById("notify-badge");
    if (!list || !badge) return;
    var scope = activeScope();
    var read = readIds();
    var items = (scoringRules.templates || []).filter(function (template) {
        return notificationVisible(template, scope) && templateActive(template);
    }).sort(function (a, b) { return a.priority - b.priority; });
    var unread = items.filter(function (template) { return read.indexOf(template.id) === -1; }).length;
    badge.textContent = String(unread);
    badge.hidden = unread === 0;
    var visible = items.filter(function (template) {
        var seen = read.indexOf(template.id) !== -1;
        return notifyTab === "read" ? seen : !seen;
    });
    list.innerHTML = visible.map(function (template) {
        return '<button class="notify-item notify-priority-' + template.priority + '" type="button" data-notify-id="' + template.id + '"' +
            (template.register ? ' data-open-register="' + template.register + '"' : '') +
            (template.view ? ' data-notify-view="' + template.view + '"' : '') +
            '><strong>' + template.title + '</strong><span>' + template.body + '</span></button>';
    }).join("") || "<p>لا إشعارات في هذا التبويب</p>";
}

function markNotification(id) {
    var read = readIds();
    if (read.indexOf(id) === -1) read.push(id);
    sessionStorage.setItem("notifyRead1059", JSON.stringify(read));
    renderNotifications();
}

function fillDelegationRoles(select) {
    if (!select || select.dataset.rolesFilled === "1" || !(roleViewRules.roles || []).length) return;
    var current = select.value;
    select.innerHTML = "";
    var currentOption = document.createElement("option");
    currentOption.value = "";
    currentOption.textContent = "الصفة الحالية";
    select.appendChild(currentOption);
    roleViewRules.roles.forEach(function (rule) {
        var option = document.createElement("option");
        option.value = rule.preview;
        option.textContent = rule.label;
        select.appendChild(option);
    });
    if (current) select.value = current;
    select.dataset.rolesFilled = "1";
}

document.addEventListener("click", function (event) {
    var bell = event.target.closest("#open-alerts");
    var panel = document.getElementById("notify-panel");
    if (bell && panel) {
        panel.hidden = !panel.hidden;
        return;
    }
    var tab = event.target.closest("[data-notify-tab]");
    if (tab) {
        notifyTab = tab.getAttribute("data-notify-tab");
        document.querySelectorAll("[data-notify-tab]").forEach(function (button) {
            button.classList.toggle("is-active", button === tab);
        });
        renderNotifications();
        return;
    }
    var note = event.target.closest("[data-notify-id]");
    if (note) {
        markNotification(note.getAttribute("data-notify-id"));
        if (panel) panel.hidden = true;
        var view = note.getAttribute("data-notify-view");
        if (view && window.setDashboardView) setDashboardView(view);
    }
    if (panel && !event.target.closest(".notify-wrap")) panel.hidden = true;
});

window.roleRuleFor = roleRuleFor;
window.compositeScore = compositeScore;
window.applyRoleView = applyRoleView;
window.fillDelegationRoles = fillDelegationRoles;
window.roleRulesReady = roleRulesReady;
