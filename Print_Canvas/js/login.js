var staffDirectory = [];
var pendingPerson = null;

function armMaskedSecret(input) {
    if (!input) {
        return;
    }
    input.setAttribute("type", "text");
    input.setAttribute("name", "access-key");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    input.style.setProperty("-webkit-text-security", "disc");
    input.style.setProperty("text-security", "disc");
    function unlock() {
        input.readOnly = false;
    }
    input.addEventListener("focus", unlock);
    input.addEventListener("pointerdown", unlock);
    if (window.MutationObserver) {
        var guard = new MutationObserver(function () {
            if (input.getAttribute("type") !== "text") {
                input.setAttribute("type", "text");
            }
        });
        guard.observe(input, { attributes: true, attributeFilter: ["type"] });
    }
}

document.querySelectorAll(".password-masked").forEach(armMaskedSecret);

(function () {
    var params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "expired") {
        var node = document.getElementById("login-message");
        if (node) {
            node.textContent = "انتهت الجلسة، يرجى تسجيل الدخول";
        }
    }
})();

function cleanId(value) {
    return String(value || "").replace(/\D/g, "");
}

function showPasswordChange(person) {
    pendingPerson = person;
    var panel = document.getElementById("password-change");
    var name = document.getElementById("password-change-name");
    if (name) {
        name.textContent = person.name || "";
    }
    if (panel) {
        panel.hidden = false;
    }
    var form = document.getElementById("login-form");
    if (form) {
        form.hidden = true;
    }
}

function saveOwnPassword() {
    var message = document.getElementById("password-change-message");
    var next = document.getElementById("new-key").value;
    var again = document.getElementById("new-key-again").value;
    if (!pendingPerson || !pendingPerson.token) {
        message.textContent = "أعد الدخول ثم عيّن كلمة المرور.";
        return;
    }
    if (next.length < 6) {
        message.textContent = "كلمة المرور لا تقل عن 6 أحرف.";
        return;
    }
    if (next !== again) {
        message.textContent = "كلمتا المرور غير متطابقتين.";
        return;
    }
    message.textContent = "";
    fetch("/api/session/password", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Session-Token": pendingPerson.token
        },
        body: JSON.stringify({ password: next, confirm: again })
    }).then(function (response) {
        return response.json().then(function (payload) {
            if (!response.ok) {
                var detail = payload && payload.detail;
                throw new Error(typeof detail === "string" ? detail : "تعذر حفظ كلمة المرور");
            }
            return payload;
        });
    }).then(function () {
        var person = pendingPerson;
        if (person.roles && person.roles.length > 1) {
            document.getElementById("password-change").hidden = true;
            document.getElementById("login-form").hidden = false;
            showRoles(person);
            return;
        }
        enterSession(person, (person.roles && person.roles[0]) || person.role || "منسوب");
    }).catch(function (error) {
        message.textContent = error.message || "تعذر حفظ كلمة المرور";
    });
}

function chooseRole(person, role) {
    fetch("/api/session/role", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Session-Token": person.token || ""
        },
        body: JSON.stringify({ role: role })
    }).then(function (response) {
        return response.json().then(function (payload) {
            if (!response.ok) {
                var detail = payload && payload.detail;
                throw new Error(typeof detail === "string" ? detail : "تعذر تثبيت الدور");
            }
            enterSession(person, role);
        });
    }).catch(function (error) {
        var message = document.getElementById("login-message");
        if (message) {
            message.textContent = error.message || "تعذر تثبيت الدور";
        }
    });
}

function enterSession(person, role) {
    sessionStorage.setItem("sessionUser", JSON.stringify({
        id: person.id,
        name: person.name,
        role: role,
        roles: person.roles,
        token: person.token || ""
    }));
    window.location.href = "app-journey.html#view-desk";
}

function findPerson() {
    var typed = cleanId(document.getElementById("national-id").value);
    var picked = document.getElementById("staff-search").value;
    var id = typed || picked;
    return staffDirectory.find(function (person) {
        return person.id && person.id === id;
    }) || null;
}

function showRoles(person) {
    pendingPerson = person;
    var panel = document.getElementById("role-choice");
    var actions = document.getElementById("role-choice-actions");
    document.getElementById("role-choice-name").textContent = person.name;
    actions.innerHTML = "";
    person.roles.forEach(function (role) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "btn-unified-primary";
        button.textContent = "دخول كـ: " + role;
        button.addEventListener("click", function () {
            chooseRole(person, role);
        });
        actions.appendChild(button);
    });
    panel.hidden = false;
}

document.getElementById("staff-search").addEventListener("change", function () {
    if (this.value) {
        document.getElementById("national-id").value = this.value;
    }
});

document.getElementById("login-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var message = document.getElementById("login-message");
    var identity = cleanId(document.getElementById("national-id").value) || document.getElementById("staff-search").value;
    var password = document.getElementById("access-key").value;
    document.getElementById("role-choice").hidden = true;
    if (!identity || !password) {
        message.textContent = "رقم السجل المدني وكلمة المرور مطلوبان.";
        return;
    }
    message.textContent = "";
    fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ national_id: identity, password: password })
    }).then(function (response) {
        return response.json().then(function (payload) {
            if (!response.ok) {
                throw new Error(payload.detail || "تعذر الدخول");
            }
            return payload;
        });
    }).then(function (user) {
        var person = {
            id: user.id,
            name: user.name,
            roles: user.roles && user.roles.length ? user.roles : [user.role || "منسوب"],
            token: user.token
        };
        if (user.must_change_password) {
            showPasswordChange(person);
            return;
        }
        if (person.roles.length <= 1) {
            enterSession(person, person.roles[0] || "منسوب");
            return;
        }
        showRoles(person);
    }).catch(function (error) {
        message.textContent = error.message || "تعذر الدخول";
    });
});

fetch("/api/staff-directory")
    .then(function (response) {
        if (!response.ok) {
            throw new Error("تعذر قراءة كشف الكادر");
        }
        return response.json();
    })
    .then(function (payload) {
        staffDirectory = payload.people || [];
        var search = document.getElementById("staff-search");
        staffDirectory.forEach(function (person) {
            if (!person.id || !person.name) {
                return;
            }
            var option = document.createElement("option");
            option.value = person.id;
            option.textContent = person.name;
            search.appendChild(option);
        });
    })
    .catch(function (error) {
        document.getElementById("login-message").textContent = error.message;
    });

fetch("/api/trial-launch", { cache: "no-store" })
    .then(function (response) {
        return response.ok ? response.json() : null;
    })
    .then(function (trial) {
        var banner = document.getElementById("trial-banner");
        if (!banner || !trial || !trial.enabled) {
            return;
        }
        banner.hidden = false;
        banner.textContent = "وضع التجربة مفعّل. الدخول بكلمة التجربة مرة واحدة، ثم تُعيَّن كلمة خاصة بك.";
    })
    .catch(function () {});

(function () {
    var splash = document.getElementById("opening-splash");
    var slides = Array.prototype.slice.call(document.querySelectorAll(".opening-slide"));
    var dots = Array.prototype.slice.call(document.querySelectorAll(".opening-dot"));
    var index = 0;
    var timer = 0;

    function show(next) {
        if (!slides.length) {
            return;
        }
        index = (next + slides.length) % slides.length;
        slides.forEach(function (slide, item) {
            slide.classList.toggle("is-active", item === index);
        });
        dots.forEach(function (dot, item) {
            dot.classList.toggle("is-active", item === index);
        });
    }

    function arm() {
        window.clearInterval(timer);
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }
        timer = window.setInterval(function () {
            show(index + 1);
        }, 7000);
    }

    if (splash) {
        var closeSplash = function () {
            splash.classList.add("is-gone");
            window.setTimeout(function () {
                splash.hidden = true;
            }, 480);
        };
        splash.addEventListener("click", closeSplash);
        var delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 200 : 1700;
        window.setTimeout(closeSplash, delay);
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-slide]"), function (button) {
        button.addEventListener("click", function () {
            show(index + Number(button.getAttribute("data-slide")));
            arm();
        });
    });
    dots.forEach(function (dot, item) {
        dot.addEventListener("click", function () {
            show(item);
            arm();
        });
    });
    show(0);
    arm();
})();

document.getElementById("password-change-save").addEventListener("click", saveOwnPassword);

(function () {
    var params = new URLSearchParams(window.location.search);
    if (params.get("change") !== "1") {
        return;
    }
    var stored = null;
    try {
        stored = JSON.parse(sessionStorage.getItem("sessionUser") || "null");
    } catch (error) {
        stored = null;
    }
    if (!stored || !stored.token) {
        return;
    }
    fetch("/api/session", {
        headers: { "X-Session-Token": stored.token },
        cache: "no-store"
    }).then(function (response) {
        return response.ok ? response.json() : null;
    }).then(function (user) {
        if (!user || !user.must_change_password) {
            return;
        }
        showPasswordChange({
            id: user.id,
            name: user.name,
            role: user.role,
            roles: [user.role || "منسوب"],
            token: stored.token
        });
    }).catch(function () {});
})();
