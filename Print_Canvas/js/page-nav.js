(function () {
    var hash = location.hash || (document.body.classList.contains("identity-page") ? "#about" : "");
    if (!hash) {
        return;
    }
    Array.prototype.forEach.call(document.querySelectorAll(".page-nav a"), function (link) {
        if (link.getAttribute("href") === "identity.html" + hash) {
            link.setAttribute("aria-current", "page");
        }
    });
})();
