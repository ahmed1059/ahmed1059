var WidgetControllers = (function () {
    var STORE = "registerFill1059";

    function savedRates() {
        try {
            return JSON.parse(sessionStorage.getItem(STORE) || "{}");
        } catch (error) {
            return {};
        }
    }

    function remember(id, rate) {
        var rates = savedRates();
        rates[id] = rate;
        sessionStorage.setItem(STORE, JSON.stringify(rates));
    }

    function state(rate) {
        var value = Number(rate) || 0;
        if (value >= 90) {
            return { key: "excellent", label: "ممتاز", tone: "green" };
        }
        if (value >= 75) {
            return { key: "progress", label: "قيد الإنجاز", tone: "teal" };
        }
        if (value >= 40) {
            return { key: "late", label: "متأخر", tone: "yellow" };
        }
        return { key: "critical", label: "حرج", tone: "red" };
    }

    function publishedRate(id) {
        var snap = window.ProgressEngine && ProgressEngine.snapshot ? ProgressEngine.snapshot() : null;
        if (!snap) {
            return 0;
        }
        var domainIndex = {
            accreditation_register: 0,
            kpi_monitoring: 0,
            admin_communications: 0,
            leave_register: 0,
            personal_leave: 0,
            teacher_portfolio: 0,
            class_followup: 1,
            exam_committees: 1,
            results_analysis: 2,
            student_portfolio: 2,
            lab_register: 3,
            learning_resources_register: 3,
            employee_leave_register: 0,
            school_fund_register: 0,
            schedule_and_substitution_register: 0,
            lrr_learning_resources: 1
        };
        if (Object.prototype.hasOwnProperty.call(domainIndex, id)) {
            var index = domainIndex[id];
            var current = snap.domainCurrent[index];
            var target = snap.domainTarget[index] || 100;
            return Math.round((current / target) * 100);
        }
        return snap.staffRate;
    }

    function rateForRegister(id) {
        var saved = savedRates()[id];
        if (typeof saved === "number") {
            return saved;
        }
        return publishedRate(id);
    }

    function meter(rate) {
        var info = state(rate);
        var active = rate <= 0 ? 1 : Math.max(1, Math.round(rate / 10));
        var html = "";
        var index;
        for (index = 0; index < 10; index += 1) {
            html += '<span class="' + (index < active ? info.tone : "") + '"></span>';
        }
        return html;
    }

    function formRate(editor) {
        var fields = editor.querySelectorAll("input, select, textarea");
        var total = 0;
        var filled = 0;
        Array.prototype.forEach.call(fields, function (field) {
            if (field.type === "hidden" || field.disabled) {
                return;
            }
            if (field.classList.contains("doc-number") || field.classList.contains("doc-hijri") || field.classList.contains("doc-date-picker")) {
                return;
            }
            total += 1;
            if (String(field.value || "").trim()) {
                filled += 1;
            }
        });
        return total ? Math.round((filled / total) * 100) : 0;
    }

    function paintCard(card, rate) {
        var info = state(rate);
        card.classList.remove("rw-excellent", "rw-progress", "rw-late", "rw-critical");
        card.classList.add("rw-" + info.key);
        card.setAttribute("data-rate", String(rate));
        var label = card.querySelector(".rw-state");
        if (label) {
            label.textContent = info.label + " " + rate + "%";
        }
        var bar = card.querySelector(".rw-meter");
        if (bar) {
            bar.setAttribute("aria-valuenow", String(rate));
            bar.innerHTML = meter(rate);
        }
    }

    function refreshRegister(id) {
        var card = document.querySelector('#registers-grid .rw-card[data-register="' + id + '"]');
        if (card) {
            paintCard(card, rateForRegister(id));
        }
        renderAlerts();
    }

    function alertItem(level, text, registerId) {
        var action = registerId
            ? '<button type="button" data-open-register="' + registerId + '">' + text + "</button>"
            : "<span>" + text + "</span>";
        return '<article class="sa-item alert-chip sa-' + level + '">' + action + "</article>";
    }

    function renderAlerts() {
        var critical = document.getElementById("sa-critical");
        var stable = document.getElementById("sa-stable");
        if (!critical || !stable || !window.ProgressEngine || !ProgressEngine.snapshot) {
            return;
        }
        var snap = ProgressEngine.snapshot();
        var urgent = [];
        var calm = [];
        function placeDomain(label, current, target) {
            if (current >= 80) {
                calm.push(alertItem("excellent", label + ": نسبة الإنجاز " + current + "% من مستهدف " + target + "%"));
                return;
            }
            var text = label + ": الوضع الحالي " + current + "% من مستهدف " + target + "%";
            urgent.push(alertItem(current < target * 0.75 ? "critical" : "late", text));
        }
        placeDomain("القيادة المدرسية", snap.domainCurrent[0], snap.domainTarget[0]);
        placeDomain("التعليم والتعلم", snap.domainCurrent[1], snap.domainTarget[1]);
        placeDomain("نواتج التعلم", snap.domainCurrent[2], snap.domainTarget[2]);
        placeDomain("البيئة المدرسية", snap.domainCurrent[3], snap.domainTarget[3]);
        if (snap.staffRate < 80) {
            urgent.push(alertItem(snap.staffRate < 40 ? "critical" : "late", "توثيق شواهد الكادر: نسبة الإنجاز " + snap.staffRate + "% — يحتاج متابعة"));
        } else {
            calm.push(alertItem("excellent", "توثيق شواهد الكادر: نسبة الإنجاز " + snap.staffRate + "% — مستقرة"));
        }
        document.querySelectorAll("#registers-grid .rw-card").forEach(function (card) {
            var rate = Number(card.getAttribute("data-rate") || "0");
            var info = state(rate);
            var title = card.querySelector("h3");
            var name = title ? title.textContent : "سجل";
            if (info.key === "critical" || info.key === "late") {
                urgent.push(alertItem(info.key, name + ": " + info.label + "، نسبة التعبئة " + rate + "%", card.getAttribute("data-register")));
            }
        });
        critical.innerHTML = urgent.join("") || "<span class=\"sa-empty\">لا تنبيهات حرجة الآن</span>";
        stable.innerHTML = calm.join("") || "<span class=\"sa-empty\">لا مؤشرات مستقرة بعد</span>";
        if (window.GovernanceIntelligence) {
            GovernanceIntelligence.render();
        }
    }

    function focusEmpty(editor) {
        var fields = editor.querySelectorAll("input, select, textarea");
        var index;
        for (index = 0; index < fields.length; index += 1) {
            if (!String(fields[index].value || "").trim() && fields[index].type !== "hidden") {
                fields[index].focus();
                return;
            }
        }
    }

    function bind() {
        document.addEventListener("click", function (event) {
            var opener = event.target.closest("[data-open-register]");
            if (opener && window.openRegister) {
                window.openRegister(opener.getAttribute("data-open-register"));
                return;
            }
            var intervene = event.target.closest("[data-intervene]");
            if (intervene && window.openRegister) {
                var registerId = intervene.getAttribute("data-intervene");
                window.openRegister(registerId, function () {
                    var editor = document.getElementById("register-editor");
                    if (editor) {
                        focusEmpty(editor);
                    }
                });
                return;
            }
            var committee = event.target.closest("[data-open-committee], [data-intervene-committee]");
            if (committee && window.openCommitteeWorkspace) {
                window.setDashboardView("committees");
                window.openCommitteeWorkspace(committee.getAttribute("data-open-committee") || committee.getAttribute("data-intervene-committee"));
                return;
            }
        });
        document.addEventListener("input", function (event) {
            var editor = event.target.closest("#register-editor");
            if (!editor || !editor.dataset.registerId) {
                return;
            }
            remember(editor.dataset.registerId, formRate(editor));
            refreshRegister(editor.dataset.registerId);
        });
        document.addEventListener("change", function (event) {
            var editor = event.target.closest("#register-editor");
            if (!editor || !editor.dataset.registerId) {
                return;
            }
            remember(editor.dataset.registerId, formRate(editor));
            refreshRegister(editor.dataset.registerId);
        });
        renderAlerts();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bind);
    } else {
        bind();
    }

    return {
        state: state,
        meter: meter,
        rateForRegister: rateForRegister,
        renderAlerts: renderAlerts,
        refreshRegister: refreshRegister
    };
}());
