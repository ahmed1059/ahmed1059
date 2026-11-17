/* نواة الإطار الرسمي المشتركة — مصدر واحد للترويسة والاعتماد.
 * لا تُعدَّل محددات .official-document-frame / .doc-official-header / .doc-signoff-block
 * من هنا؛ هذه الدوال تُصدِر العلامات المحصّنة كما هي في دستور الحوكمة. */
(function (root) {
    "use strict";

    var DEFAULTS = {
        kingdom: "المملكة العربية السعودية",
        ministry: "وزارة التعليم",
        admin: "الإدارة العامة للتعليم بمنطقة المدينة المنورة",
        school: "متوسطة سعد بن الربيع الأنصاري",
        year: "1448هـ",
        ministryLogo: "/assets/ministry_logo.png",
        visionLogo: "/assets/vision_2030.png",
        signTitle: "التوقيعات والاعتمادات"
    };

    var DEFAULT_SIGNOFF = [
        { role: "وكيل الشؤون التعليمية", name: "", signature: "signatures/sig_teachers.png" },
        { role: "وكيل شؤون الطلاب", name: "", signature: "signatures/sig_students.png" },
        { role: "مدير المدرسة", name: "", signature: "signatures/sig_manager.png" }
    ];

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function resolveIdentity(opts) {
        opts = opts || {};
        return {
            kingdom: opts.kingdom || DEFAULTS.kingdom,
            ministry: opts.ministry || DEFAULTS.ministry,
            admin: opts.admin || root.bookletAdmin || DEFAULTS.admin,
            school: opts.school || root.bookletSchoolName || DEFAULTS.school,
            year: opts.year || DEFAULTS.year,
            ministryLogo: opts.ministryLogo || DEFAULTS.ministryLogo,
            visionLogo: opts.visionLogo || DEFAULTS.visionLogo,
            metaHtml: opts.metaHtml || "",
            strictIdentity: !!opts.strictIdentity
        };
    }

    /** الترويسة الثلاثية المحصّنة: شعار الوزارة يمينًا، رؤية 2030 يسارًا، الهوية وسطًا. */
    function header(opts) {
        var id = resolveIdentity(opts);
        var center = "<div>" + escapeHtml(id.kingdom) + "</div>"
            + "<div>" + escapeHtml(id.ministry) + "</div>"
            + "<div>" + escapeHtml(id.admin) + "</div>"
            + "<div class=\"school-name-title\">" + escapeHtml(id.school) + "</div>";
        if (!id.strictIdentity) {
            if (id.year) {
                center += "<div>العام الدراسي " + escapeHtml(id.year) + "</div>";
            }
            if (id.metaHtml) {
                center += "<div style=\"margin-top:4px; font-size:0.75rem; color:#475569;\">" + id.metaHtml + "</div>";
            }
        }
        return "<header class=\"doc-official-header\">"
            + "<div class=\"header-logo-right\">"
            + "<img src=\"" + escapeHtml(id.ministryLogo) + "\" alt=\"وزارة التعليم\">"
            + "</div>"
            + "<div class=\"header-center-titles\">" + center + "</div>"
            + "<div class=\"header-logo-left\">"
            + "<img src=\"" + escapeHtml(id.visionLogo) + "\" alt=\"رؤية 2030\">"
            + "</div>"
            + "</header>"
            + "<div class=\"header-divider-bar\"></div>";
    }

    function normalizeSignatureSrc(path) {
        var src = String(path || "");
        if (!src) {
            return "";
        }
        if (src.indexOf("/") !== 0 && src.indexOf("http") !== 0 && src.indexOf("data:") !== 0) {
            src = "/" + src.replace(/^\/+/, "");
        }
        return src;
    }

    /**
     * صورة التوقيع مع احتياطي دوري (sig_teachers / sig_manager…)
     * لأن ملفات sig_{الهوية} قد لا تكون محفوظة بعد.
     */
    function signatureImage(path, fallbackPath) {
        var src = normalizeSignatureSrc(path);
        var fallback = normalizeSignatureSrc(fallbackPath);
        if (!src && fallback) {
            src = fallback;
            fallback = "";
        }
        if (!src) {
            return "";
        }
        var handler = fallback
            ? "if(this.dataset.fallback){var n=this.dataset.fallback;this.dataset.fallback='';this.src=n;}else{this.remove();}"
            : "this.remove()";
        return "<img class=\"sig-image\" src=\"" + escapeHtml(src) + "\""
            + (fallback ? " data-fallback=\"" + escapeHtml(fallback) + "\"" : "")
            + " alt=\"\" onerror=\"" + handler + "\">";
    }

    /** شريط الاعتماد الثلاثي المحصّن. */
    function signoff(opts) {
        opts = opts || {};
        var id = resolveIdentity(opts);
        var source = (opts.columns || []).filter(function (person) {
            return person && (String(person.id || "").trim() || String(person.name || "").trim());
        });
        var columns = (source.length ? source : DEFAULT_SIGNOFF).map(function (person) {
            var sigPath = person.signature || person.signaturePath || "";
            var fallbackPath = person.signatureFallback || person.fallbackSignature || "";
            var sigHtml = (sigPath || fallbackPath)
                ? signatureImage(sigPath, fallbackPath)
                : "<span class=\"sig-line\" aria-hidden=\"true\"></span>";
            return "<div class=\"signoff-col\">"
                + "<span class=\"role-title\">" + escapeHtml(person.roleTitle || ("اعتماد: " + (person.role || ""))) + "</span>"
                + "<div class=\"sig-placeholder\">" + sigHtml + "</div>"
                + "<span class=\"person-name\">" + escapeHtml(person.name || "") + "</span>"
                + "</div>";
        }).join("");
        var pageLabel = opts.page && opts.total
            ? ("الصفحة " + opts.page + " من " + opts.total)
            : (opts.pageLabel || "الصفحة 1 من 1");
        return "<footer class=\"doc-signoff-block\">"
            + "<div class=\"signoff-title-bar\">" + escapeHtml(opts.signTitle || DEFAULTS.signTitle) + "</div>"
            + "<div class=\"signoff-grid\">" + columns + "</div>"
            + "<div class=\"doc-bottom-bar\">"
            + "<span>وثيقة رسمية — " + escapeHtml(id.school) + "</span>"
            + "<span>" + escapeHtml(pageLabel) + "</span>"
            + "</div></footer>";
    }

    /** تذييل خفيف لصفحات المتابعة دون إعادة شريط الاعتماد كاملًا. */
    function pageBar(opts) {
        opts = opts || {};
        var id = resolveIdentity(opts);
        var pageLabel = opts.page && opts.total
            ? ("الصفحة " + opts.page + " من " + opts.total)
            : (opts.pageLabel || "الصفحة 1 من 1");
        return "<div class=\"doc-bottom-bar\">"
            + "<span>وثيقة رسمية — " + escapeHtml(id.school) + "</span>"
            + "<span>" + escapeHtml(pageLabel) + "</span>"
            + "</div>";
    }

    /**
     * صفحة رسمية كاملة: إطار محصّن + ترويسة + متن يتمدد + اعتماد أو شريط صفحة.
     * opts.bodyHtml = المحتوى المتغير فقط.
     * opts.signoff = true لإظهار شريط الاعتماد الثلاثي (آخر صفحة عادة).
     */
    function page(opts) {
        opts = opts || {};
        var title = opts.title
            ? "<h1 class=\"doc-official-title\">" + escapeHtml(opts.title) + "</h1>"
            : "";
        var foot = opts.signoff === false
            ? pageBar(opts)
            : signoff(opts);
        var extraClass = opts.frameClass ? (" " + opts.frameClass) : "";
        return "<article class=\"official-document-frame" + extraClass + "\""
            + (opts.page ? " data-frame-page=\"" + escapeHtml(opts.page) + "\"" : "")
            + ">"
            + (opts.headerHtml || header(opts))
            + "<div class=\"doc-official-body\">" + title + (opts.bodyHtml || "") + "</div>"
            + foot
            + "</article>";
    }

    /** معاينة توضيحية للنواة — لا بيانات مخترعة خارج الهوية المحفوظة. */
    function demoHtml(opts) {
        opts = opts || {};
        return page({
            strictIdentity: true,
            title: opts.title || "نواة الإطار الرسمي المشتركة",
            bodyHtml: "<p class=\"doc-core-demo-note\">هذه معاينة للنواة فقط: الترويسة والاعتماد ثابتان، "
                + "والمنتصف هنا فارغ بانتظار محتوى الوثيقة (شاهد، برنامج، محضر…).</p>"
                + "<div class=\"doc-core-demo-slot\" aria-hidden=\"true\"></div>",
            page: 1,
            total: 1,
            signoff: true,
            school: opts.school,
            admin: opts.admin
        });
    }

    function ensureHost() {
        var host = document.getElementById("official-frame-host");
        if (!host) {
            host = document.createElement("div");
            host.id = "official-frame-host";
            host.className = "official-frame-host";
            document.body.appendChild(host);
        }
        return host;
    }

    function showDemo(opts) {
        var host = ensureHost();
        host.innerHTML = demoHtml(opts);
        host.hidden = false;
        document.body.classList.add("is-print-preview", "print-official-core");
        return host;
    }

    function hideHost() {
        var host = document.getElementById("official-frame-host");
        if (host) {
            host.innerHTML = "";
            host.hidden = true;
        }
        document.body.classList.remove(
            "print-official-core",
            "print-official-multi",
            "print-official-landscape",
            "print-official-list",
            "print-master",
            "print-master-landscape"
        );
        if (!document.body.classList.contains("print-council")
            && !document.body.classList.contains("print-improvement")
            && !document.body.classList.contains("printing-register")
            && !document.body.classList.contains("print-soft-witness")) {
            document.body.classList.remove("is-print-preview", "print-mode");
        }
        var armed = document.getElementById("official-core-page-style");
        if (armed) {
            armed.remove();
        }
    }

    /**
     * يحقن @page بهوامش صفر قبل window.print
     * ليتفوق على قاعدة print.css العامة (landscape + margin:16mm).
     * opts.orientation: "portrait" | "landscape"
     * opts.multiPage: true لمحاضر متعددة الصفحات (بدون fixed صفحة واحدة)
     * opts.list: true لكشوف الجداول — هامش ورقة 15mm وترويسة تتكرر
     */
    function armPrintPage(opts) {
        opts = opts || {};
        var stage = document.getElementById("aj-print-stage-page") || document.getElementById("official-frame-host");
        var master = stage ? stage.querySelector(".pm-document") : null;
        if (master && root.PrintMasterCore && typeof root.PrintMasterCore.arm === "function") {
            var masterLandscape = master.classList.contains("pm-landscape") || opts.orientation === "landscape";
            return root.PrintMasterCore.arm({
                orientation: masterLandscape ? "landscape" : "portrait",
                multiPage: !!opts.multiPage,
                list: !!opts.list
            });
        }
        var list = !!opts.list;
        var landscape = !list && opts.orientation === "landscape";
        var multi = list || !!opts.multiPage;
        var size = landscape ? "A4 landscape" : "A4 portrait";
        var margin = list ? "15mm" : "0";
        var named = list
            ? "official-list-a4"
            : (landscape ? "official-core-a4-landscape" : "official-core-a4");
        var style = document.getElementById("official-core-page-style");
        if (!style) {
            style = document.createElement("style");
            style.id = "official-core-page-style";
            document.head.appendChild(style);
        }
        style.textContent = [
            "@page{size:" + size + " !important;margin:" + margin + " !important;}",
            "@page " + named + "{size:" + size + ";margin:" + margin + ";}",
            "html,body{margin:0!important;padding:0!important;}"
        ].join("");
        document.body.classList.add("print-official-core");
        document.body.classList.toggle("print-official-landscape", landscape);
        document.body.classList.toggle("print-official-multi", multi);
        document.body.classList.toggle("print-official-list", list);
        return style;
    }

    root.OfficialFrameCore = {
        DEFAULTS: DEFAULTS,
        DEFAULT_SIGNOFF: DEFAULT_SIGNOFF,
        escapeHtml: escapeHtml,
        header: header,
        signoff: signoff,
        pageBar: pageBar,
        page: page,
        demoHtml: demoHtml,
        showDemo: showDemo,
        hideHost: hideHost,
        ensureHost: ensureHost,
        armPrintPage: armPrintPage
    };
}(window));
