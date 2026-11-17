var standardSchema = { registers: [] };
var standardSchemaReady = fetch("/banks/registers_standardized_schemas.json")
    .then(function (response) {
        return response.ok ? response.json() : { registers: [] };
    })
    .then(function (payload) {
        standardSchema = payload || standardSchema;
    })
    .catch(function () {
        standardSchema = { registers: [] };
    });

function standardRecord(registerId) {
    var found = null;
    (standardSchema.registers || []).forEach(function (item) {
        if (item.register_id === registerId) {
            found = item;
        }
    });
    return found;
}

function standardOptions(options) {
    return '<option value=""></option>' + (options || []).map(function (option) {
        return '<option value="' + option + '">' + option + "</option>";
    }).join("");
}

function standardStaffOptions() {
    var names = window.ProgressEngine ? ProgressEngine.individuals.map(function (person) {
        return person.name;
    }) : [];
    return standardOptions(names);
}

function standardField(field, registerId) {
    var calc = field.calc ? ' data-calc="' + field.calc + '"' : "";
    var compute = field.compute ? ' data-compute="' + field.compute + '" readonly' : "";
    var label = field.label;
    if (field.type === "student" || label === "اسم الطالب" || label === "اسم المتعلم") {
        return '<label>' + label + '<select class="student-name" data-label="' + label + '"><option value=""></option></select></label>';
    }
    if ((field.type === "textarea" || field.type === "text") && !field.calc && typeof optionsForColumn === "function") {
        var choices = optionsForColumn(registerId, label);
        if (choices && choices.length) {
            return '<label>' + label + '<select data-label="' + label + '">' + standardOptions(choices) + "</select></label>";
        }
    }
    if (field.type === "textarea") {
        return '<label>' + label + '<textarea data-label="' + label + '"' + calc + '></textarea></label>';
    }
    if (field.type === "computed") {
        return '<label>' + label + '<input class="std-computed" data-label="' + label + '"' + compute + ' value=""></label>';
    }
    if (field.type === "grade") {
        var grades = window.curriculumBank ? (curriculumBank().grades || []) : [];
        return '<label>' + label + '<select data-label="' + label + '" class="register-grade">' + standardOptions(grades) + "</select></label>";
    }
    if (field.type === "subject") {
        var subjects = window.curriculumBank ? (curriculumBank().subjects || []) : [];
        return '<label>' + label + '<select data-label="' + label + '" class="register-subject">' + standardOptions(subjects) + "</select></label>";
    }
    if (field.type === "skill") {
        return '<label>' + label + '<select data-label="' + label + '" class="register-skill">' + standardOptions([]) + "</select></label>";
    }
    if (field.type === "select") {
        var dictated = typeof dictionaryChoices === "function" ? dictionaryChoices(registerId, label) : null;
        var selectOptions = dictated && dictated.length ? dictated : field.options;
        return '<label>' + label + '<select data-label="' + label + '"' + calc + ">" + standardOptions(selectOptions) + "</select></label>";
    }
    var inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text";
    return '<label>' + label + '<input type="' + inputType + '" data-label="' + label + '"' + calc + compute + ' value=""></label>';
}

function standardSignature(column) {
    var body = "<strong>" + column.role + "</strong>";
    if (column.source === "staff") {
        body += '<select data-label="' + column.role + '">' + standardStaffOptions() + "</select>";
    } else if (column.source === "text") {
        body += '<input data-label="' + column.role + '" type="text" value="">';
    } else {
        body += "<span>" + (column.name || "") + "</span>";
    }
    if (column.signature) {
        body += '<img class="sig-image" src="' + column.signature + '" alt="" onerror="this.remove()">';
    }
    if (column.stamp) {
        body += '<img class="school-stamp" src="/assets/img/official_school_stamp.png" alt="الختم المدرسي">';
    }
    return "<div>" + body + "</div>";
}

function standardNumber(root, name) {
    var field = root.querySelector('[data-calc="' + name + '"]');
    if (!field || String(field.value).trim() === "") {
        return null;
    }
    var value = parseFloat(field.value);
    return isNaN(value) ? null : value;
}

function standardSet(root, name, text) {
    var field = root.querySelector('[data-compute="' + name + '"]');
    if (field) {
        field.value = text;
    }
}

function recomputeStandard(root) {
    var pre = standardNumber(root, "pre");
    var target = standardNumber(root, "target");
    var post = standardNumber(root, "post");
    if (target !== null && post !== null) {
        standardSet(root, "gap", String(Math.round((target - post) * 100) / 100));
    }
    if (pre !== null && post !== null) {
        var base = pre !== 0 ? pre : target;
        if (base) {
            standardSet(root, "improvement", String(Math.round(((post - pre) / base) * 1000) / 10) + "%");
        }
    }
    var students = standardNumber(root, "students");
    var mastered = standardNumber(root, "mastered");
    if (students && mastered !== null) {
        standardSet(root, "mastery", String(Math.round((mastered / students) * 1000) / 10) + "%");
    }
    var planned = standardNumber(root, "planned");
    var actual = standardNumber(root, "actual");
    var satisfied = standardNumber(root, "satisfied");
    if (planned) {
        if (actual !== null) {
            standardSet(root, "participation", String(Math.round((actual / planned) * 1000) / 10) + "%");
        }
    }
    if (actual) {
        if (satisfied !== null) {
            standardSet(root, "satisfaction", String(Math.round((satisfied / actual) * 1000) / 10) + "%");
        }
    }
}

function mountStandardRegister(host, registerId) {
    var record = standardRecord(registerId);
    var template = document.getElementById("standard-register");
    if (!record || !template || !host) {
        return;
    }
    host.appendChild(template.content.cloneNode(true));
    var root = host.querySelector(".standard-register");
    root.querySelector("[data-std='sections']").innerHTML = (record.sections || []).map(function (section) {
        return '<section class="std-section"><h4>' + section.label + '</h4><div class="std-grid">' +
            (section.fields || []).map(function (field) {
                return standardField(field, registerId);
            }).join("") + "</div></section>";
    }).join("");
    var signatures = root.querySelector("[data-std='signatures']");
    var bar = root.querySelector("[data-std='bar']");
    if (signatures && typeof officialSignoff === "function") {
        signatures.outerHTML = officialSignoff(registerId);
        if (bar) {
            bar.remove();
        }
    } else if (signatures) {
        signatures.classList.add((record.signatures || []).length === 3 ? "cols-3" : "cols-4");
        signatures.innerHTML = (record.signatures || []).map(standardSignature).join("");
        if (bar) {
            bar.textContent = standardSchema.document_bar || "";
        }
    }
    var subject = root.querySelector(".register-subject");
    var skill = root.querySelector(".register-skill");
    if (subject && skill) {
        subject.addEventListener("change", function () {
            var names = window.SKILLS_BY_SUBJECT ? Object.keys(SKILLS_BY_SUBJECT[subject.value] || {}) : [];
            if (names.length) {
                skill.innerHTML = standardOptions(names);
                return;
            }
            var dictated = typeof dictionaryChoices === "function" ? dictionaryChoices(registerId, skill.getAttribute("data-label")) : null;
            skill.innerHTML = standardOptions(dictated || []);
        });
    }
    var domain = root.querySelector('[data-label="المجال"]');
    var activityKind = root.querySelector('[data-label="النوع"]');
    if (domain && activityKind) {
        domain.addEventListener("change", function () {
            var list = window.activitiesForDomain ? activitiesForDomain(domain.value) : [];
            if (list.length) {
                activityKind.innerHTML = standardOptions(list);
            }
        });
    }
    root.addEventListener("input", function () {
        recomputeStandard(root);
    });
}

window.mountStandardRegister = mountStandardRegister;
window.standardSchemaReady = standardSchemaReady;
