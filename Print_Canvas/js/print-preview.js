(function () {
    var currentClass = "";

    function finish(done) {
        window.setTimeout(done, 300);
    }

    function waitForImages(done) {
        var images = document.querySelectorAll("img");
        var pending = 0;
        var settled = false;
        function doneOnce() {
            if (settled) {
                return;
            }
            settled = true;
            finish(done);
        }
        function check() {
            pending -= 1;
            if (pending <= 0) {
                doneOnce();
            }
        }
        Array.prototype.forEach.call(images, function (img) {
            if (!img.getAttribute("src") || (img.complete && img.naturalHeight !== 0)) {
                return;
            }
            pending += 1;
            img.addEventListener("load", check);
            img.addEventListener("error", check);
        });
        if (pending === 0) {
            doneOnce();
            return;
        }
        window.setTimeout(doneOnce, 8000);
    }

    function bar() {
        var node = document.getElementById("print-preview-bar");
        if (node) {
            return node;
        }
        node = document.createElement("div");
        node.id = "print-preview-bar";
        node.className = "print-preview-bar no-print";
        node.innerHTML = "<button type=\"button\" id=\"print-preview-go\">طباعة</button><button type=\"button\" id=\"print-preview-close\">إغلاق</button>";
        document.body.appendChild(node);
        node.querySelector("#print-preview-go").addEventListener("click", function () {
            waitForImages(function () {
                if (!window.PrintEngine || typeof window.PrintEngine.gate !== "function") {
                    console.error("PrintEngine غير محمّل.");
                    return;
                }
                var html = "";
                var opts = { multiPage: true, orientation: "portrait" };
                if (document.body.classList.contains("print-book")) {
                    isolateBookletForPrint();
                    var booklet = document.getElementById("booklet");
                    html = booklet ? booklet.outerHTML : "";
                } else if (document.body.classList.contains("print-official-core")) {
                    if (window.OfficialFrameCore && typeof window.OfficialFrameCore.armPrintPage === "function") {
                        window.OfficialFrameCore.armPrintPage(
                            document.body.classList.contains("print-official-landscape")
                                ? { orientation: "landscape" }
                                : {}
                        );
                    }
                    var frameHost = document.getElementById("official-frame-host");
                    html = frameHost ? frameHost.innerHTML : "";
                    if (document.body.classList.contains("print-official-landscape")) {
                        opts.orientation = "landscape";
                    }
                    if (document.body.classList.contains("print-official-multi")
                        || document.body.classList.contains("print-official-list")) {
                        opts.multiPage = true;
                        opts.list = document.body.classList.contains("print-official-list");
                    }
                } else if (document.body.classList.contains("print-deck")) {
                    var deck = document.querySelector(".slide-deck");
                    html = deck ? deck.outerHTML : "";
                    opts.orientation = "landscape";
                    opts.multiPage = !document.body.classList.contains("print-deck-one");
                } else {
                    var stage = document.getElementById("aj-print-stage-page")
                        || document.getElementById("council-print-host")
                        || document.getElementById("improvement-print-host");
                    html = stage ? (stage.innerHTML || stage.outerHTML) : "";
                }
                var printed = window.PrintEngine.gate(html, opts);
                function afterGate() {
                    if (document.body.classList.contains("print-book")) {
                        restoreBookletAfterPrint();
                    }
                }
                if (printed && typeof printed.finally === "function") {
                    printed.finally(afterGate);
                } else if (printed && typeof printed.then === "function") {
                    printed.then(afterGate, afterGate);
                } else {
                    afterGate();
                }
            });
        });
        node.querySelector("#print-preview-close").addEventListener("click", closePrintPreview);
        return node;
    }

    function closePrintPreview() {
        restoreBookletAfterPrint();
        document.body.classList.remove("is-print-preview", "print-mode");
        if (currentClass) {
            document.body.classList.remove(currentClass);
        }
        currentClass = "";
        var councilHost = document.getElementById("council-print-host");
        if (councilHost) {
            councilHost.innerHTML = "";
        }
        if (window.OfficialFrameCore && typeof window.OfficialFrameCore.hideHost === "function") {
            window.OfficialFrameCore.hideHost();
        }
        var node = document.getElementById("print-preview-bar");
        if (node) {
            node.hidden = true;
        }
    }

    function isolateBookletForPrint() {
        if (!document.body.classList.contains("print-book")) {
            return;
        }
        var booklet = document.getElementById("booklet");
        if (!booklet || booklet.dataset.printParked === "1") {
            document.body.classList.add("print-book-isolated");
            return;
        }
        booklet.dataset.printParked = "1";
        booklet._printParent = booklet.parentNode;
        booklet._printNext = booklet.nextSibling;
        document.body.insertBefore(booklet, document.body.firstChild);
        document.body.classList.add("print-book-isolated");
    }

    function restoreBookletAfterPrint() {
        var booklet = document.getElementById("booklet");
        document.body.classList.remove("print-book-isolated");
        if (!booklet || booklet.dataset.printParked !== "1") {
            return;
        }
        delete booklet.dataset.printParked;
        if (booklet._printParent) {
            booklet._printParent.insertBefore(booklet, booklet._printNext || null);
        }
        booklet._printParent = null;
        booklet._printNext = null;
    }

    function openPrintPreview(bodyClass) {
        closePrintPreview();
        if (bodyClass === "print-book") {
            document.body.classList.remove(
                "print-official-core",
                "print-official-multi",
                "print-official-landscape",
                "print-master",
                "print-master-landscape"
            );
        }
        currentClass = bodyClass || "";
        if (currentClass) {
            document.body.classList.add(currentClass);
        }
        document.body.classList.add("is-print-preview");
        var node = bar();
        node.hidden = false;
    }

    window.addEventListener("beforeprint", isolateBookletForPrint);
    window.addEventListener("afterprint", restoreBookletAfterPrint);

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && document.body.classList.contains("is-print-preview")) {
            closePrintPreview();
        }
    });

    window.openPrintPreview = openPrintPreview;
    window.closePrintPreview = closePrintPreview;
})();
