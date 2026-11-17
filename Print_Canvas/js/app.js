// تهيئة صفحة الدخول محليًا دون طلبات إلى الخادم

document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("login-form");
    if (!form) {
        return;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
    });
});
