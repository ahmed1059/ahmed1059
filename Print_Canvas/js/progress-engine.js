var ProgressEngine = (function () {
    var charts = [];
    var documented = {
        "بندر حمدان سمران المحمدي": 100,
        "محمد عايد نغيمش الجهني": 100,
        "بندر بن عائد بن محمد الاحمدي": 100,
        "يوسف بن عواد بن عويد العوفي": 100,
        "منور بن محمد بن عليان اللهيبي": 100,
        "احمد علي هيازع الشهري": 100
    };
    var individuals = [
        ["نايف بن سمير حجيف المخلفي", "مدير مدرسة"],
        ["محمد بن فايز بن هلال الحربي", "وكيل الشؤون التعليمية"],
        ["خالد بن علي بن حجري العمري", "وكيل شؤون الطلاب"],
        ["فهد حنيف بن محمد العمري", "موجه طلابي"],
        ["منور بن محمد بن عليان اللهيبي", "موجه طلابي"],
        ["احمد بن سعيد بن سلمي العوفي", "معلم"],
        ["احمد عبدالله عريج الحربي", "معلم"],
        ["احمد علي هيازع الشهري", "مسؤول النظام والقيادة الشاملة / معلم رياضيات"],
        ["انس عبدالرحمن صالح الرحيلي", "معلم"],
        ["ايمن سليم محمد البلادي", "معلم"],
        ["بدر بن سليم بن حمود الترجمي", "معلم"],
        ["بندر بن عائد بن محمد الاحمدي", "معلم"],
        ["بندر حمدان سمران المحمدي", "معلم"],
        ["حسن بن نافع بن مساعد الهرساني", "معلم"],
        ["حميد قاسم ضفيدع الصاعدي", "معلم"],
        ["خالد بن سعود بن مسعود الأحمدي", "معلم"],
        ["راشد حمد محمد الصاعدي", "معلم"],
        ["زهير بن عتيق بن عوده الحجيلي", "معلم"],
        ["صالح بن فالح بن صالح الحربي", "معلم"],
        ["عبدالرحمن بن حامد بن حمد العوفي", "معلم"],
        ["عبدالمحسن بن حسين بن حسن الحربي", "معلم"],
        ["عدنان صلاح بن عويد الحربي", "معلم"],
        ["فائز حمدان حميد الترجمي", "معلم"],
        ["فواز بن علي بن سليم الحربي", "معلم"],
        ["ماجد طلال عوض الحجيلي", "معلم"],
        ["ماجد فهد محمد الحربي", "معلم"],
        ["محمد بن نافع بن نويفع الصاعدي", "معلم"],
        ["محمد عايد نغيمش الجهني", "معلم"],
        ["مطيع بن طلال بن غازي الصاعدي", "معلم"],
        ["هاشم بن راشد بن دهيكل البرقاني الجهني", "معلم"],
        ["هاني مسعود سعيد الأحمدي", "معلم"],
        ["ياسر دخيل الله بن حمود السهلي", "معلم"],
        ["ياسر فالح مسعد السحيمي", "معلم"],
        ["يوسف بن عواد بن عويد العوفي", "معلم"],
        ["يوسف مقبل مانع الصاعدي", "معلم"],
        ["احمد بن صالح بن رجاء العوفي", "محضر مختبر علوم / أمين مصادر تعلم ومحضر معمل حاسب"],
        ["محمد حامد عماش السهلي", "رائد النشاط"],
        ["عبدالمجيد محمد رميزان المرواني", "اداري"]
    ].map(function (row) {
        return { name: row[0], role: row[1], score: documented[row[0]] || 0 };
    });

    var domainLabels = ["الإدارة المدرسية", "التعليم والتعلم", "نواتج التعلم", "البيئة المدرسية"];
    var domainCurrent = [0, 0, 0, 0];
    var domainTarget = [90, 75, 75, 75];
    var nafesLabels = ["القراءة", "الرياضيات", "العلوم"];
    var nafesCurrent = [0, 0, 0];
    var nafesTarget = [0, 0, 0];
    var evidenceLabels = ["محضر", "كشف", "تقرير", "خطة", "سجل", "صور", "شواهد أخرى"];
    var evidenceCounts = [9, 14, 14, 9, 44, 3, 55];

    function applyMetrics(metrics) {
        if (!metrics || !window.PerformanceBind) return;
        var domains = PerformanceBind.domainSeries(metrics);
        domainLabels = domains.labels;
        domainCurrent = domains.current;
        domainTarget = domains.target;
        var nafes = PerformanceBind.nafesSeries(metrics);
        nafesLabels = nafes.labels;
        nafesCurrent = nafes.current;
        nafesTarget = nafes.target;
        var note = document.querySelector("#measurement-center .kpi-card .kpi-note");
        if (note && metrics.external_evaluation && metrics.external_evaluation.overall) {
            var ext = metrics.external_evaluation;
            note.textContent =
                "من مركز الأداء: كلي " +
                ext.overall.score +
                "% · إدارة " +
                (ext.administration && ext.administration.score) +
                "% · تعليم " +
                (ext.teaching && ext.teaching.score) +
                "% · نواتج " +
                (ext.outcomes && ext.outcomes.score) +
                "% · بيئة " +
                (ext.environment && ext.environment.score) +
                "%.";
        }
        var nafesNote = document.querySelector("#measurement-center .kpi-card-wide .kpi-note");
        if (nafesNote && metrics.nafes) {
            nafesNote.textContent =
                "نافس من المركز: قراءة " +
                (metrics.nafes.reading && metrics.nafes.reading.score) +
                "% · رياضيات " +
                (metrics.nafes.math && metrics.nafes.math.score) +
                "% · علوم " +
                (metrics.nafes.science && metrics.nafes.science.score) +
                "%.";
        }
    }

    function token(name, fallback) {
        var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return value || fallback;
    }

    function destroyCharts() {
        charts.forEach(function (chart) {
            chart.destroy();
        });
        charts = [];
    }

    function mount(id, config) {
        var canvas = document.getElementById(id);
        if (!canvas || typeof Chart === "undefined") {
            return;
        }
        config.options = config.options || {};
        config.options.responsive = true;
        config.options.maintainAspectRatio = false;
        config.options.animation = false;
        charts.push(new Chart(canvas, config));
    }

    function paintCharts() {
        if (typeof Chart === "undefined") {
            return;
        }
        destroyCharts();
        var teal = token("--primary-teal", "#0d766e");
        var dark = token("--primary-dark", "#115e59");
        var muted = token("--text-muted", "#475569");
        var border = token("--border-subtle", "#e2e8f0");
        Chart.defaults.font.family = "Tajawal, Cairo, sans-serif";
        Chart.defaults.animation = false;
        Chart.defaults.responsive = true;
        var readiness = Math.round(domainCurrent.reduce(function (sum, value) {
            return sum + value;
        }, 0) / Math.max(domainCurrent.length, 1));
        mount("chart-readiness", {
            type: "doughnut",
            data: {
                labels: ["الجاهزية", "المتبقي"],
                datasets: [{
                    data: [readiness, Math.max(0, 100 - readiness)],
                    backgroundColor: [teal, border],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: "72%",
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: { enabled: true }
                }
            }
        });
        mount("chart-domains", {
            type: "radar",
            data: {
                labels: domainLabels,
                datasets: [{
                    label: "الوضع الحالي",
                    data: domainCurrent,
                    borderColor: teal,
                    backgroundColor: "rgba(13, 118, 110, 0.2)",
                    pointBackgroundColor: dark
                }]
            },
            options: {
                scales: { r: { min: 0, max: 100, ticks: { stepSize: 20 } } },
                plugins: { legend: { position: "bottom" } }
            }
        });
        mount("chart-nafs", {
            data: {
                labels: nafesLabels,
                datasets: [
                    { type: "bar", label: "الوضع الحالي", data: nafesCurrent, backgroundColor: dark, borderRadius: 6 },
                    { type: "line", label: "المستهدف", data: nafesTarget, borderColor: teal, backgroundColor: teal, tension: 0.2 }
                ]
            },
            options: {
                scales: { y: { min: 0, max: 100 } },
                plugins: { legend: { position: "bottom" } }
            }
        });
        mount("chart-staff", {
            type: "bar",
            data: {
                labels: individuals.map(function (person) {
                    return person.name + " — " + person.role;
                }),
                datasets: [{
                    label: "توثيق الشاهد",
                    data: individuals.map(function (person) {
                        return person.score;
                    }),
                    backgroundColor: individuals.map(function (person) {
                        return person.score ? teal : border;
                    }),
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: "y",
                maintainAspectRatio: false,
                scales: { x: { min: 0, max: 100 } },
                plugins: { legend: { display: false } }
            }
        });
        mount("chart-evidence", {
            type: "doughnut",
            data: {
                labels: evidenceLabels,
                datasets: [{
                    data: evidenceCounts,
                    backgroundColor: [dark, teal, "#0f766e", "#14b8a6", "#5eead4", "#115e59", "#99f6e4"],
                    borderColor: "#ffffff",
                    borderWidth: 2
                }]
            },
            options: { plugins: { legend: { position: "bottom", labels: { color: muted } } } }
        });
    }

    function initCharts() {
        if (window.PerformanceBind && PerformanceBind.load) {
            PerformanceBind.invalidate();
            return PerformanceBind.load().then(function (metrics) {
                applyMetrics(metrics);
                paintCharts();
            }).catch(function () {
                paintCharts();
            });
        }
        paintCharts();
        return Promise.resolve();
    }

    function paintProgress(bar) {
        var form = bar.closest(".register-form-body") || bar.parentElement;
        var fields = form.querySelectorAll("input, select, textarea");
        var total = 0;
        var filled = 0;
        Array.prototype.forEach.call(fields, function (field) {
            if (field.type === "hidden" || field.disabled) {
                return;
            }
            total += 1;
            if (String(field.value || "").trim()) {
                filled += 1;
            }
        });
        var ratio = total ? filled / total : 0;
        if (bar.getAttribute("data-register-progress") === "activity") {
            var covered = {};
            Array.prototype.forEach.call(form.querySelectorAll("tr"), function (row) {
                if (row.classList.contains("support-activity")) {
                    return;
                }
                var domain = row.querySelector('[data-label="المجال"]');
                if (domain && String(domain.value || "").trim()) {
                    covered[domain.value] = true;
                }
            });
            ratio = Object.keys(covered).length / 8;
        }
        var tone = ratio >= 0.75 ? "green" : ratio >= 0.4 ? "yellow" : "red";
        var segments = bar.querySelectorAll("span");
        var active = ratio === 0 ? 1 : Math.max(1, Math.round(segments.length * ratio));
        Array.prototype.forEach.call(segments, function (segment, index) {
            segment.className = index < active ? tone : "";
        });
        bar.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
    }

    function sync(root) {
        if (!root) {
            return;
        }
        var bar = root.querySelector("[data-register-progress]");
        if (bar) {
            paintProgress(bar);
        }
    }

    function bindRegister(root) {
        var bar = root.querySelector("[data-register-progress]");
        if (!bar || bar.dataset.bound === "1") {
            sync(root);
            return;
        }
        bar.dataset.bound = "1";
        root.addEventListener("input", function () {
            paintProgress(bar);
        });
        root.addEventListener("change", function () {
            paintProgress(bar);
        });
        paintProgress(bar);
    }

    function showMeasurement() {
        if (window.setDashboardView) {
            window.setDashboardView("measurement");
            return;
        }
        document.body.classList.add("view-measurement");
        var center = document.getElementById("measurement-center");
        if (center) {
            center.hidden = false;
        }
        var nav = document.getElementById("nav-measurement");
        document.querySelectorAll(".app-sidebar .nav-item").forEach(function (item) {
            item.classList.remove("active");
        });
        if (nav) {
            nav.classList.add("active");
        }
        initCharts();
    }

    function showHome() {
        if (window.setDashboardView) {
            window.setDashboardView("plans");
            return;
        }
        document.body.classList.remove("view-measurement");
        var center = document.getElementById("measurement-center");
        if (center) {
            center.hidden = true;
        }
        document.querySelectorAll(".app-sidebar .nav-item").forEach(function (item) {
            item.classList.remove("active");
        });
        var home = document.querySelector('.app-sidebar .nav-item[href="#"]');
        if (home) {
            home.classList.add("active");
        }
    }

    function bindNavigation() {
        var tab = document.getElementById("tab-measurement");
        var home = document.getElementById("tab-home");
        var nav = document.getElementById("nav-measurement");
        var printButton = document.getElementById("print-measurement");
        if (tab) {
            tab.addEventListener("click", showMeasurement);
        }
        if (nav) {
            nav.addEventListener("click", function (event) {
                event.preventDefault();
                showMeasurement();
            });
        }
        if (home) {
            home.addEventListener("click", showHome);
        }
        ["tab-registers", "tab-committees", "nav-committees"].forEach(function (id) {
            var node = document.getElementById(id);
            if (!node) {
                return;
            }
            node.addEventListener("click", function (event) {
                if (node.tagName === "A") {
                    event.preventDefault();
                }
                if (window.setDashboardView) {
                    window.setDashboardView(id.indexOf("committees") !== -1 ? "committees" : "registers");
                }
            });
        });
        if (printButton) {
            printButton.addEventListener("click", function () {
                document.body.classList.add("printing-measure");
                window.addEventListener("afterprint", function cleanup() {
                    document.body.classList.remove("printing-measure");
                    window.removeEventListener("afterprint", cleanup);
                });
                window.print();
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindNavigation);
    } else {
        bindNavigation();
    }

    function snapshot() {
        var documentedCount = individuals.filter(function (person) {
            return person.score;
        }).length;
        return {
            domainCurrent: domainCurrent.slice(),
            domainTarget: domainTarget.slice(),
            domainLabels: domainLabels.slice(),
            evidenceLabels: evidenceLabels.slice(),
            evidenceCounts: evidenceCounts.slice(),
            staffRate: Math.round((documentedCount / individuals.length) * 100)
        };
    }

    return {
        initCharts: initCharts,
        destroyCharts: destroyCharts,
        bindRegister: bindRegister,
        sync: sync,
        individuals: individuals,
        showMeasurement: showMeasurement,
        snapshot: snapshot
    };
}());
