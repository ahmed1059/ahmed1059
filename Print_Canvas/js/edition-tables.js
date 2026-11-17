/* جدولا الإصدار: البرامج وفق الأهداف، ومتابعة الخطة. عبر PrintMasterCore. */
(function (root) {
    "use strict";

    var payload = null;
    var loading = false;

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function token() {
        try {
            var user = JSON.parse(root.sessionStorage.getItem("sessionUser") || "null");
            return user && user.token ? String(user.token) : "";
        } catch (error) {
            return "";
        }
    }

    function serialClass(label) {
        return String(label || "").trim() === "م" ? " class=\"col-serial\"" : "";
    }

    function tableHtml(spec) {
        var columns = spec.columns || [];
        var cols = columns.map(function (label) {
            return "<col" + serialClass(label) + ">";
        }).join("");
        var head = columns.map(function (label) {
            return "<th" + serialClass(label) + ">" + escapeHtml(label) + "</th>";
        }).join("");
        var body = (spec.rows || []).map(function (row) {
            var cells = (spec.keys || []).map(function (key, index) {
                return "<td" + serialClass(columns[index]) + ">" + escapeHtml(row[key]).replace(/\n/g, "<br>") + "</td>";
            }).join("");
            return "<tr>" + cells + "</tr>";
        }).join("");
        if (!body) {
            body = "<tr><td colspan=\"" + columns.length + "\"></td></tr>";
        }
        return "<table class=\"tpl-data-table\"><colgroup>" + cols + "</colgroup><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table>";
    }

    function sheetHtml(spec) {
        if (!root.PrintMasterCore || typeof root.PrintMasterCore.sheet !== "function") {
            return "";
        }
        return root.PrintMasterCore.sheet({
            title: spec.title || "",
            orientation: "landscape",
            strictIdentity: true,
            kind: "document",
            signoff: true,
            bodyHtml: tableHtml(spec)
        });
    }

    function openSheet(html) {
        var core = root.OfficialFrameCore;
        if (!core || typeof core.ensureHost !== "function" || !html) {
            return;
        }
        if (typeof root.openPrintPreview === "function") {
            root.openPrintPreview("print-official-core");
        }
        var host = core.ensureHost();
        host.innerHTML = html;
        host.hidden = false;
        root.document.body.classList.add("app-journey", "print-master", "print-official-core", "print-official-multi");
        if (root.PrintMasterCore && typeof root.PrintMasterCore.arm === "function") {
            root.PrintMasterCore.arm({ orientation: "landscape" });
        }
        if (typeof core.armPrintPage === "function") {
            core.armPrintPage({ multiPage: true });
        }
    }

    function section(spec, key) {
        var bar = root.document.querySelector(".plan-book-bar");
        if (bar && !bar.querySelector("[data-edition-btn=\"" + key + "\"]")) {
            var button = root.document.createElement("button");
            button.type = "button";
            button.className = "wash-print";
            button.setAttribute("data-edition-btn", key);
            button.textContent = "معاينة طباعة " + (spec.title || "");
            var html = sheetHtml(spec);
            button.addEventListener("click", function () {
                openSheet(html);
            });
            bar.appendChild(button);
        }
        var page = root.document.createElement("section");
        page.className = "booklet-page";
        page.setAttribute("data-edition", key);
        page.innerHTML = "<h2>" + escapeHtml(spec.title || "") + "</h2>" + tableHtml(spec);
        return page;
    }

    function mount() {
        var page = root.document.getElementById("booklet-programs-page");
        var programs = root.document.getElementById("booklet-programs");
        if (!page || !programs || !payload || root.document.getElementById("edition-tables")) {
            return;
        }
        if (programs.textContent.indexOf("الإطار العام") === -1 && programs.textContent.indexOf("الإطار التنفيذي") === -1) {
            return;
        }
        var booklet = root.document.getElementById("booklet");
        var marker = root.document.createElement("div");
        marker.id = "edition-tables";
        marker.hidden = true;
        var programsPage = section(payload.programs, "programs");
        var followPage = section(payload.follow, "follow");
        if (booklet && page.nextSibling) {
            booklet.insertBefore(followPage, page.nextSibling);
            booklet.insertBefore(programsPage, followPage);
            booklet.insertBefore(marker, programsPage);
        } else if (booklet) {
            booklet.appendChild(marker);
            booklet.appendChild(programsPage);
            booklet.appendChild(followPage);
        }
        markSerial(booklet || page);
    }

    function markColumn(scope, title, className) {
        scope.querySelectorAll("table").forEach(function (table) {
            table.querySelectorAll("thead th").forEach(function (th, index) {
                if (String(th.textContent || "").trim() !== title) {
                    return;
                }
                th.classList.add(className);
                table.querySelectorAll("tbody tr").forEach(function (tr) {
                    var cell = tr.cells[index];
                    if (cell) {
                        cell.classList.add(className);
                    }
                });
            });
        });
    }

    function markSerial(scope) {
        markColumn(scope, "م", "col-serial");
        markColumn(scope, "الرمز", "col-code");
    }

    function load() {
        if (payload || loading) {
            mount();
            return;
        }
        var key = token();
        if (!key) {
            return;
        }
        loading = true;
        root.fetch("/api/edition/tables", { headers: { "X-Session-Token": key } })
            .then(function (response) {
                return response.ok ? response.json() : null;
            })
            .then(function (body) {
                payload = body && body.programs && body.follow ? body : null;
                mount();
            })
            .catch(function () {
                payload = null;
            })
            .finally(function () {
                loading = false;
            });
    }

    function watch() {
        var programs = root.document.getElementById("booklet-programs");
        if (!programs || programs.getAttribute("data-edition-watch") === "1") {
            return;
        }
        programs.setAttribute("data-edition-watch", "1");
        var observer = new root.MutationObserver(function () {
            load();
        });
        observer.observe(programs, { childList: true });
        load();
    }

    function boot() {
        watch();
        var previous = root.closePrintPreview;
        if (typeof previous === "function" && !previous.editionWrapped) {
            var wrapped = function () {
                root.document.body.classList.remove("app-journey");
                return previous();
            };
            wrapped.editionWrapped = true;
            root.closePrintPreview = wrapped;
        }
    }

    if (root.document.readyState === "loading") {
        root.document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
}(window));
