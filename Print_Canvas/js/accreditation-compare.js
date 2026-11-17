/* يملأ مقارنة الدورات وخانات الدرجة الفارغة من بنك التقويم. لا يخترع نسبة. */
(function () {
    var payload = null;

    function token() {
        try {
            var user = JSON.parse(sessionStorage.getItem("sessionUser") || "null");
            return user && user.token ? user.token : "";
        } catch (error) {
            return "";
        }
    }

    function cell(text) {
        var node = document.createElement("td");
        node.textContent = text || "";
        return node;
    }

    function paint() {
        if (!payload) {
            return;
        }
        var note = document.getElementById("cycle-compare-note");
        if (note && payload.overall && payload.overall.score) {
            var students = payload.card_students ? " — طلاب البطاقة: " + payload.card_students : "";
            note.textContent = "الأداء العام في بطاقة 2026: " + payload.overall.level + " (" + payload.overall.score + "%)" + students;
        }
        var domains = document.querySelector("#cycle-domains tbody");
        if (domains) {
            domains.innerHTML = "";
            (payload.domains || []).forEach(function (item) {
                var row = document.createElement("tr");
                row.appendChild(cell(item.name));
                row.appendChild(cell(item.score));
                row.appendChild(cell(item.level));
                domains.appendChild(row);
            });
        }
        var body = document.querySelector("#cycle-compare tbody");
        if (body) {
            body.innerHTML = "";
            (payload.indicators || []).forEach(function (item) {
                var scores = item.scores || {};
                var row = document.createElement("tr");
                var current = parseFloat(scores["2026"] || "");
                if (!isNaN(current) && current < 50) {
                    row.className = "is-low-indicator";
                }
                row.appendChild(cell(item.code));
                row.appendChild(cell(item.statement));
                row.appendChild(cell(scores["2024"]));
                row.appendChild(cell(scores["2025"]));
                row.appendChild(cell(scores["2026"]));
                row.appendChild(cell(item.level));
                body.appendChild(row);
            });
        }
        fillPlanScores();
    }

    function fillPlanScores() {
        if (!payload) {
            return;
        }
        var byCode = {};
        (payload.indicators || []).forEach(function (item) {
            byCode[item.code] = item;
        });
        document.querySelectorAll("#booklet-programs tbody tr").forEach(function (row) {
            if (!row.cells || row.cells.length < 8) {
                return;
            }
            var code = (row.cells[1].textContent || "").trim();
            var item = byCode[code];
            if (!item) {
                return;
            }
            var score = (item.scores || {})["2026"] || "";
            if (score && !row.cells[3].textContent.trim()) {
                row.cells[3].textContent = score;
            }
            if (item.recommendation && !row.cells[4].textContent.trim()) {
                row.cells[4].textContent = item.recommendation;
            }
            if (score && !row.cells[6].textContent.trim()) {
                row.cells[6].textContent = score;
            }
        });
    }

    function load() {
        var key = token();
        if (!key || payload) {
            paint();
            return;
        }
        fetch("/api/evaluation/compare", { headers: { "X-Session-Token": key } })
            .then(function (response) {
                return response.ok ? response.json() : null;
            })
            .then(function (body) {
                payload = body && body.indicators ? body : null;
                paint();
            })
            .catch(function () {
                payload = null;
            });
    }

    var host = document.getElementById("booklet-programs");
    if (host && window.MutationObserver) {
        new MutationObserver(function () {
            fillPlanScores();
        }).observe(host, { childList: true, subtree: true });
    }
    document.addEventListener("DOMContentLoaded", load);
    load();
})();
