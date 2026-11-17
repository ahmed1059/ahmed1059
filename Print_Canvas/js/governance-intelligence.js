var GovernanceIntelligence = (function () {
    var bank = null;
    var ready = fetch("/banks/advanced_governance_intelligence.json?v=intel1")
        .then(function (response) { return response.json(); })
        .then(function (payload) {
            bank = payload.advanced_governance_intelligence || payload;
            render();
            return bank;
        })
        .catch(function () {
            bank = null;
            return null;
        });

    function pack() {
        return bank || {};
    }

    function weights() {
        var source = (pack().readiness || {}).weights || {};
        return {
            evidence: Number(source.evidence != null ? source.evidence : 0.35),
            nafes: Number(source.nafes != null ? source.nafes : 0.30),
            attendance: Number(source.attendance != null ? source.attendance : 0.20),
            interventions: Number(source.interventions != null ? source.interventions : 0.15)
        };
    }

    function care() {
        return pack().nafes_care || {
            subjects: ["لغتي", "الرياضيات", "العلوم"],
            skill_below: 60,
            register_id: "academic_care",
            loss_type: "مهاري",
            delay_degree: "عميق"
        };
    }

    function pulseRule() {
        var rule = pack().critical_pulse || {};
        return { threshold: Number(rule.threshold != null ? rule.threshold : 25) };
    }

    function snapshot() {
        if (!window.ProgressEngine || !ProgressEngine.snapshot) {
            return {};
        }
        return ProgressEngine.snapshot();
    }

    function publishedNafes() {
        var snap = snapshot();
        return Number(snap.domainCurrent && snap.domainCurrent[2]) || 0;
    }

    function evidenceRate() {
        return Number(snapshot().staffRate) || 0;
    }

    function absenceRate() {
        var stored = sessionStorage.getItem("classAbsence1059");
        if (stored === null || stored === "") {
            return 0;
        }
        var value = Number(stored);
        return isNaN(value) ? 0 : value;
    }

    function interventionRate() {
        var card = document.querySelector('[data-register="academic_care"]');
        if (!card) {
            return 0;
        }
        return Number(card.getAttribute("data-rate") || "0") || 0;
    }

    function subjects() {
        var gate = care();
        var published = publishedNafes();
        var rows = {};
        (gate.subjects || []).forEach(function (name) {
            var listed = gate.scores && gate.scores[name] != null ? Number(gate.scores[name]) : published;
            rows[name] = isNaN(listed) ? published : listed;
        });
        return rows;
    }

    function inputs() {
        var absence = absenceRate();
        return {
            evidence: evidenceRate(),
            nafes: publishedNafes(),
            attendance: Math.max(0, Math.min(100, 100 - absence)),
            interventions: interventionRate(),
            absence: absence,
            subjects: subjects()
        };
    }

    function readiness(values) {
        var current = values || inputs();
        var scale = weights();
        var score = (scale.evidence * current.evidence) +
            (scale.nafes * current.nafes) +
            (scale.attendance * current.attendance) +
            (scale.interventions * current.interventions);
        return Math.round(score * 10) / 10;
    }

    function weakSubjects() {
        var limit = Number(care().skill_below != null ? care().skill_below : 60);
        var rows = subjects();
        return Object.keys(rows).filter(function (name) {
            return rows[name] < limit;
        });
    }

    function pulseOn() {
        return absenceRate() > pulseRule().threshold;
    }

    function tokens() {
        var counts = snapshot().evidenceCounts || [];
        var total = counts.reduce(function (sum, value) {
            return sum + Number(value || 0);
        }, 0);
        var weak = weakSubjects();
        return {
            evidence_count: total ? String(total) : "....",
            target_percentage: String(Math.round(readiness())),
            weak_subject: weak[0] || "...."
        };
    }

    function recommendationsFor(committeeId) {
        return (pack().intervention_recommendations || []).filter(function (row) {
            return row.committee_id === committeeId;
        }).map(function (row) {
            return row.text;
        });
    }

    function labeled(root, label) {
        return root.querySelector('[data-label="' + label + '"]');
    }

    function setField(root, label, value) {
        var field = labeled(root, label);
        if (!field) {
            return;
        }
        if (field.tagName === "SELECT") {
            var exists = Array.prototype.some.call(field.options, function (option) {
                return option.value === value;
            });
            if (!exists) {
                var option = document.createElement("option");
                option.value = value;
                option.textContent = value;
                field.appendChild(option);
            }
            field.value = value;
            return;
        }
        field.type = "text";
        field.value = value;
    }

    function prepareRegister(registerId, root) {
        var gate = care();
        if (!root || registerId !== (gate.register_id || "academic_care") || !weakSubjects().length) {
            return false;
        }
        setField(root, "نوع الفاقد", gate.loss_type || "مهاري");
        setField(root, "درجة التأخر", gate.delay_degree || "عميق");
        var subject = labeled(root, "المادة");
        var first = weakSubjects()[0];
        if (subject && subject.tagName === "SELECT" && first && !subject.value) {
            var match = Array.prototype.some.call(subject.options, function (option) {
                return option.value === first;
            });
            if (match) {
                subject.value = first;
            }
        }
        root.setAttribute("data-acr-prepared", "1");
        return true;
    }

    function portalUrl() {
        return (pack().evidence_portal || {}).url || "";
    }

    function portalToken() {
        return (pack().evidence_portal || {}).token || "autologin";
    }

    function note(host, name, text) {
        var prior = host.querySelector("[data-" + name + "]");
        if (prior) {
            prior.remove();
        }
        if (!text) {
            return;
        }
        var article = document.createElement("article");
        article.className = "sa-item alert-chip sa-critical";
        article.setAttribute("data-" + name, "1");
        article.textContent = text;
        host.insertBefore(article, host.firstChild);
    }

    function render() {
        var values = inputs();
        var score = readiness(values);
        var meter = document.getElementById("readiness-meter");
        if (meter) {
            meter.textContent = "الجاهزية الكلية " + score + "% — شواهد " + values.evidence +
                "، نافس " + values.nafes + "، حضور " + values.attendance + "، تدخلات " + values.interventions;
        }
        var group = document.querySelector(".sa-group-critical");
        if (group) {
            group.classList.toggle("critical-pulse", pulseOn());
        }
        var host = document.getElementById("sa-critical");
        if (!host) {
            return;
        }
        var weak = weakSubjects();
        note(host, "intel-acr", weak.length
            ? "سجل الرعاية التحصيلية مهيأ: " + weak.join("، ") + " دون " + (care().skill_below || 60) + "%، نوع الفاقد مهاري، درجة التأخر عميق"
            : "");
        note(host, "intel-pulse", pulseOn()
            ? "نبض الحالة الحرجة: غياب فصلي مفاجئ " + values.absence + "% يتجاوز " + pulseRule().threshold + "%"
            : "");
    }

    document.addEventListener("DOMContentLoaded", function () {
        ready.then(render);
    });

    return {
        ready: ready,
        inputs: inputs,
        readiness: readiness,
        weakSubjects: weakSubjects,
        pulseOn: pulseOn,
        tokens: tokens,
        recommendationsFor: recommendationsFor,
        prepareRegister: prepareRegister,
        portalUrl: portalUrl,
        portalToken: portalToken,
        render: render
    };
}());
