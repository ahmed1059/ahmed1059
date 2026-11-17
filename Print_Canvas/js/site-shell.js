(function () {
    var icons = {
        user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M6.5 19c.8-2.8 2.8-4.2 5.5-4.2s4.7 1.4 5.5 4.2"/></svg>',
        users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="2.4"/><circle cx="16" cy="9" r="2.2"/><path d="M4.5 18c.6-2.2 2.2-3.4 4.5-3.4s3.8 1.2 4.4 3.4M13 18c.4-1.6 1.6-2.6 3.2-2.6 1.4 0 2.6.8 3.2 2.6"/></svg>',
        folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5h5l2 2H20v8.5H4z"/><path d="M4 8.5V7h4l1.5 1.5"/></svg>',
        chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V10M12 19V5M19 19v-7"/></svg>',
        plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
        gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.4 6.4l1.4 1.4M16.2 16.2l1.4 1.4M17.6 6.4l-1.4 1.4M7.8 16.2l-1.4 1.4"/></svg>'
    };

    var menu = [
        { id: "home", label: "الرئيسية", href: "dashboard.html#home", view: "home" },
        {
            id: "school",
            label: "المدرسة",
            columns: [
                {
                    title: "التعريف",
                    icon: "user",
                    links: [
                        { label: "من نحن", href: "identity.html#about" },
                        { label: "الرؤية والرسالة", href: "identity.html#vision" },
                        { label: "أهدافنا", href: "identity.html#goals" }
                    ]
                },
                {
                    title: "الشراكة",
                    icon: "users",
                    links: [
                        { label: "شركاؤنا", href: "identity.html#partners" }
                    ]
                }
            ]
        },
        {
            id: "work",
            label: "العمل المدرسي",
            columns: [
                {
                    title: "السجلات",
                    icon: "folder",
                    links: [
                        { label: "السجلات المدرسية", href: "dashboard.html#registers", view: "registers" }
                    ]
                },
                {
                    title: "المتابعة",
                    icon: "chart",
                    links: [
                        { label: "التحليلات والمؤشرات", href: "dashboard.html#measurement", view: "measurement" },
                        { label: "الخطط التشغيلية", href: "dashboard.html#plans", view: "plans" }
                    ]
                },
                {
                    title: "الإدارة",
                    icon: "gear",
                    links: [
                        { label: "الإعدادات العامة", href: "settings.html" },
                        { label: "إعداد الخطة", href: "setup.html" }
                    ]
                }
            ]
        },
        { id: "contact", label: "تواصل معنا", href: "identity.html#contact" }
    ];

    function fileName(path) {
        var part = String(path || "").split("/").pop();
        return part || "dashboard.html";
    }

    function samePlace(href) {
        var probe = document.createElement("a");
        probe.href = href;
        var there = fileName(probe.pathname);
        var here = fileName(location.pathname);
        if (there !== here) {
            return false;
        }
        if (there === "dashboard.html") {
            return (location.hash || "#home") === (probe.hash || "#home");
        }
        return (probe.hash || "") === (location.hash || "");
    }

    function groupOf() {
        var here = fileName(location.pathname);
        if (here === "identity.html" && location.hash === "#contact") {
            return "contact";
        }
        if (here === "identity.html") {
            return "school";
        }
        if (here === "settings.html" || here === "setup.html") {
            return "work";
        }
        if (here !== "dashboard.html") {
            return "";
        }
        var hash = location.hash || "#home";
        if (hash === "#registers" || hash === "#measurement" || hash === "#plans") {
            return "work";
        }
        return "home";
    }

    function linkNode(item) {
        var link = document.createElement("a");
        link.className = "mega-link";
        link.href = item.href;
        link.textContent = item.label;
        if (item.view) {
            link.setAttribute("data-view", item.view);
        }
        if (samePlace(item.href)) {
            link.setAttribute("aria-current", "page");
        }
        return link;
    }

    function build(nav) {
        var active = groupOf();
        var row = document.createElement("div");
        row.className = "mega-row";
        menu.forEach(function (item) {
            var wrap = document.createElement("div");
            wrap.className = "mega-item";
            wrap.setAttribute("data-shell", item.id);
            if (!item.columns) {
                var direct = document.createElement("a");
                direct.className = "mega-direct";
                direct.href = item.href;
                direct.textContent = item.label;
                if (item.view) {
                    direct.setAttribute("data-view", item.view);
                }
                if (item.id === active) {
                    direct.setAttribute("aria-current", "page");
                }
                wrap.appendChild(direct);
                row.appendChild(wrap);
                return;
            }
            var button = document.createElement("button");
            button.type = "button";
            button.className = "mega-trigger";
            button.setAttribute("aria-expanded", "false");
            button.setAttribute("aria-controls", "mega-" + item.id);
            button.appendChild(document.createTextNode(item.label));
            var caret = document.createElement("span");
            caret.className = "mega-caret";
            caret.setAttribute("aria-hidden", "true");
            button.appendChild(caret);
            if (item.id === active) {
                button.setAttribute("aria-current", "page");
            }
            var panel = document.createElement("div");
            panel.className = "mega-panel";
            panel.id = "mega-" + item.id;
            panel.hidden = true;
            item.columns.forEach(function (column) {
                var col = document.createElement("div");
                col.className = "mega-col";
                var head = document.createElement("div");
                head.className = "mega-col-head";
                var icon = document.createElement("span");
                icon.className = "mega-icon";
                icon.innerHTML = icons[column.icon] || "";
                var title = document.createElement("p");
                title.textContent = column.title;
                head.appendChild(icon);
                head.appendChild(title);
                col.appendChild(head);
                column.links.forEach(function (entry) {
                    col.appendChild(linkNode(entry));
                });
                panel.appendChild(col);
            });
            wrap.appendChild(button);
            wrap.appendChild(panel);
            row.appendChild(wrap);
        });
        nav.classList.add("mega-nav");
        nav.setAttribute("aria-label", "التنقل الرئيسي");
        nav.textContent = "";
        nav.appendChild(row);
    }

    function place(panel) {
        var nav = panel.closest(".page-nav");
        if (!nav) {
            return;
        }
        var rect = nav.getBoundingClientRect();
        panel.style.top = rect.bottom + "px";
        panel.style.left = "0";
        panel.style.right = "0";
    }

    function closeItem(item) {
        item.classList.remove("is-open");
        var button = item.querySelector(".mega-trigger");
        var panel = item.querySelector(".mega-panel");
        if (button) {
            button.setAttribute("aria-expanded", "false");
        }
        if (panel) {
            panel.hidden = true;
        }
    }

    function closeAll(except) {
        Array.prototype.forEach.call(document.querySelectorAll(".mega-item.is-open"), function (item) {
            if (item !== except) {
                closeItem(item);
            }
        });
    }

    function openItem(item) {
        if (item.classList.contains("is-open")) {
            return;
        }
        closeAll(item);
        var panel = item.querySelector(".mega-panel");
        var button = item.querySelector(".mega-trigger");
        if (!panel || !button) {
            return;
        }
        panel.hidden = false;
        place(panel);
        item.classList.add("is-open");
        item.dataset.openedAt = String(Date.now());
        button.setAttribute("aria-expanded", "true");
    }

    function mark() {
        var active = groupOf();
        Array.prototype.forEach.call(document.querySelectorAll("[data-shell]"), function (item) {
            var control = item.querySelector(".mega-direct, .mega-trigger");
            if (!control) {
                return;
            }
            if (item.getAttribute("data-shell") === active) {
                control.setAttribute("aria-current", "page");
            } else {
                control.removeAttribute("aria-current");
            }
        });
        Array.prototype.forEach.call(document.querySelectorAll(".mega-nav a.mega-link"), function (link) {
            if (samePlace(link.getAttribute("href"))) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    document.querySelectorAll(".page-nav").forEach(build);

    var closeTimer = 0;
    document.addEventListener("mouseover", function (event) {
        var item = event.target.closest ? event.target.closest(".mega-item") : null;
        if (!item || !item.querySelector(".mega-panel")) {
            return;
        }
        window.clearTimeout(closeTimer);
        openItem(item);
    });
    document.addEventListener("mouseout", function (event) {
        var item = event.target.closest ? event.target.closest(".mega-item") : null;
        if (!item || !item.querySelector(".mega-panel")) {
            return;
        }
        var next = event.relatedTarget;
        if (next && item.contains(next)) {
            return;
        }
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(function () {
            closeAll(null);
        }, 180);
    });
    document.addEventListener("click", function (event) {
        var trigger = event.target.closest ? event.target.closest(".mega-trigger") : null;
        if (trigger) {
            event.preventDefault();
            var item = trigger.closest(".mega-item");
            var openedAt = Number(item.dataset.openedAt || 0);
            if (item.classList.contains("is-open") && Date.now() - openedAt > 350) {
                closeItem(item);
            } else if (!item.classList.contains("is-open")) {
                openItem(item);
            }
            return;
        }
        var direct = event.target.closest ? event.target.closest(".mega-direct") : null;
        if (direct) {
            closeAll(null);
            if (direct.hasAttribute("data-view") && document.querySelector(".app-shell") && window.setDashboardView) {
                event.preventDefault();
                window.setDashboardView(direct.getAttribute("data-view"));
                mark();
            }
            return;
        }
        var viewLink = event.target.closest ? event.target.closest(".mega-nav a[data-view]") : null;
        if (viewLink && document.querySelector(".app-shell") && window.setDashboardView) {
            event.preventDefault();
            closeAll(null);
            window.setDashboardView(viewLink.getAttribute("data-view"));
            mark();
            return;
        }
        if (!event.target.closest || !event.target.closest(".mega-item")) {
            closeAll(null);
        }
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeAll(null);
        }
    });
    window.addEventListener("resize", function () {
        var open = document.querySelector(".mega-item.is-open .mega-panel");
        if (open) {
            place(open);
        }
    });
})();
