var STUDENTS_KEY = "studentsRegistry1059";
var studentsRegistrySeed = [];

function escapeStudent(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
}

function loadStudents() {
    try {
        var saved = JSON.parse(localStorage.getItem(STUDENTS_KEY) || "");
        if (saved && Array.isArray(saved.students) && saved.students.length) {
            return saved.students;
        }
    } catch (error) {
        return studentsRegistrySeed;
    }
    return studentsRegistrySeed;
}

function saveStudents(students) {
    var payload = { students: students || [] };
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(payload));
    studentsRegistrySeed = payload.students;
    refreshStudentList();
    return payload;
}

function refreshStudentList() {
    var list = document.getElementById("students-registry-list");
    if (!list) {
        list = document.createElement("datalist");
        list.id = "students-registry-list";
        document.body.appendChild(list);
    }
    list.innerHTML = loadStudents().map(function (student) {
        return '<option value="' + escapeStudent(student.student_name) + '"></option>';
    }).join("");
}

function columnKey(header) {
    var text = String(header || "").replace(/\s+/g, "").replace(/[أإآ]/g, "ا");
    if (!text) {
        return "";
    }
    if (text.indexOf("دراسي") !== -1) {
        return "";
    }
    if (text.indexOf("ولي") !== -1 && (text.indexOf("جوال") !== -1 || text.indexOf("هاتف") !== -1)) {
        return "guardian_phone";
    }
    if (text.indexOf("جوال") !== -1 || text.indexOf("هاتف") !== -1) {
        return "guardian_phone";
    }
    if (text.indexOf("هوي") !== -1 || text.indexOf("سجلمدني") !== -1 || text.indexOf("رقمالطالب") !== -1) {
        return "student_nid";
    }
    if (text.indexOf("ولي") !== -1 || text.indexOf("معلم") !== -1) {
        return "";
    }
    if (text.indexOf("اسمالطالب") !== -1 || text === "الاسم" || text.indexOf("اسم") !== -1) {
        return "student_name";
    }
    if (text.indexOf("مرحله") !== -1) {
        return "stage";
    }
    if (text.indexOf("الصف") !== -1 || text === "صف") {
        return "grade";
    }
    if (text.indexOf("فصل") !== -1 || text.indexOf("شعب") !== -1) {
        return "section";
    }
    return "";
}

function headerMap(grid) {
    var best = { index: 0, map: {}, score: 0 };
    var limit = Math.min(grid.length, 40);
    var rowIndex;
    for (rowIndex = 0; rowIndex < limit; rowIndex += 1) {
        var map = {};
        var score = 0;
        var filled = 0;
        (grid[rowIndex] || []).forEach(function (cell, index) {
            if (String(cell || "").trim()) {
                filled += 1;
            }
            var key = columnKey(cell);
            if (key && map[key] === undefined) {
                map[key] = index;
                score += 1;
            }
        });
        if (!filled) {
            continue;
        }
        if (score > best.score) {
            best = { index: rowIndex, map: map, score: score };
        }
    }
    return best;
}

function studentSheetReady(map) {
    return map.student_name !== undefined && map.student_nid !== undefined && map.section !== undefined;
}

function sheetCell(row, index) {
    if (index === undefined || index === null) {
        return "";
    }
    var value = row[index];
    if (typeof value === "number" && isFinite(value)) {
        return String(Math.round(value));
    }
    return String(value === undefined || value === null ? "" : value).trim();
}

function studentsFromGrid(grid, found) {
    var students = [];
    grid.slice(found.index + 1).forEach(function (row) {
        var name = sheetCell(row, found.map.student_name).replace(/\s+/g, " ").trim();
        var nid = sheetCell(row, found.map.student_nid);
        if (!name || !nid) {
            return;
        }
        var phone = sheetCell(row, found.map.guardian_phone);
        students.push({
            student_nid: nid,
            student_name: name,
            grade: canonicalGrade(sheetCell(row, found.map.grade) || sheetCell(row, found.map.stage)),
            section: canonicalSection(sheetCell(row, found.map.section)),
            phone: phone,
            guardian_phone: phone
        });
    });
    return students;
}

function parseStudentSheet(buffer) {
    if (!window.XLSX) {
        throw new Error("تعذر تحميل قارئ الإكسل");
    }
    var book = XLSX.read(buffer, { type: "array" });
    var chosen = null;
    (book.SheetNames || []).forEach(function (name) {
        var grid = XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: "", raw: false });
        var found = headerMap(grid);
        if (!studentSheetReady(found.map)) {
            return;
        }
        var students = studentsFromGrid(grid, found);
        if (!chosen || students.length > chosen.students.length) {
            chosen = { name: name, students: students };
        }
    });
    if (!chosen) {
        throw new Error("تعذر العثور على ورقة اسم الطالب ورقم الطالب والفصل");
    }
    return chosen.students;
}

function canonicalGrade(value) {
    var compact = String(value || "").replace(/\s+/g, "");
    if (compact === "0725" || compact === "725") {
        return "الأول متوسط";
    }
    if (compact === "0825" || compact === "825") {
        return "الثاني متوسط";
    }
    if (compact === "0925" || compact === "925") {
        return "الثالث متوسط";
    }
    var text = String(value || "").trim().replace(/[أإآ]/g, "ا");
    if (!text) {
        return "";
    }
    if (text.indexOf("اول") !== -1 || text === "1") {
        return "الأول متوسط";
    }
    if (text.indexOf("ثاني") !== -1 || text === "2") {
        return "الثاني متوسط";
    }
    if (text.indexOf("ثالث") !== -1 || text === "3") {
        return "الثالث متوسط";
    }
    return String(value || "").trim();
}

function canonicalSection(value) {
    var text = String(value || "").trim();
    var named = { "أ": "1", "ا": "1", "ب": "2", "ج": "3" };
    return named[text] || text;
}

function studentPhone(student) {
    return student.phone || student.guardian_phone || "";
}

function studentsInClass(grade, section) {
    var gradeName = canonicalGrade(grade);
    var sectionName = canonicalSection(section);
    if (!gradeName || !sectionName) {
        return [];
    }
    return loadStudents().filter(function (student) {
        return canonicalGrade(student.grade) === gradeName && canonicalSection(student.section) === sectionName;
    });
}

function studentByName(name, root) {
    var target = String(name || "").replace(/\s+/g, " ").trim();
    var pool = loadStudents();
    if (root) {
        var grade = root.querySelector('[data-label="الصف"]');
        var section = root.querySelector('[data-label="الفصل"]');
        if (grade && grade.value && section && section.value) {
            pool = studentsInClass(grade.value, section.value);
        }
    }
    var found = null;
    pool.forEach(function (student) {
        if (!found && student.student_name === target) {
            found = student;
        }
    });
    return found;
}

function studentFormRoot(origin) {
    return origin.closest("tr") || origin.closest(".standard-register") || origin.closest(".register-section") || origin.closest(".register-form-body") || document;
}

function refillStudentNames(origin) {
    var root = studentFormRoot(origin);
    var grade = root.querySelector('[data-label="الصف"]');
    var section = root.querySelector('[data-label="الفصل"]');
    var name = root.querySelector(".student-name");
    if (!name || name.tagName !== "SELECT") {
        return;
    }
    var current = name.value;
    var students = studentsInClass(grade ? grade.value : "", section ? section.value : "");
    name.innerHTML = '<option value=""></option>' + students.map(function (student) {
        return '<option value="' + escapeStudent(student.student_name) + '">' + escapeStudent(student.student_name) + "</option>";
    }).join("");
    if (current && students.some(function (student) { return student.student_name === current; })) {
        name.value = current;
        return;
    }
    name.value = "";
    ["السجل المدني", "جوال ولي الأمر"].forEach(function (label) {
        var field = root.querySelector('[data-label="' + label + '"]');
        if (field) {
            field.value = "";
        }
    });
}

function setLabeledField(root, label, value) {
    if (!root || !value) {
        return;
    }
    var field = root.querySelector('[data-label="' + label + '"]');
    if (!field) {
        return;
    }
    if (field.tagName === "SELECT") {
        var exists = Array.prototype.some.call(field.options, function (option) {
            return option.value === value;
        });
        if (!exists) {
            var option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            field.appendChild(option);
        }
    }
    field.value = value;
}

function applyStudentFields(input) {
    var root = studentFormRoot(input);
    var student = studentByName(input.value, root);
    if (!student) {
        return;
    }
    setLabeledField(root, "السجل المدني", student.student_nid);
    setLabeledField(root, "جوال ولي الأمر", studentPhone(student));
    var grade = root.querySelector('[data-label="الصف"]');
    var section = root.querySelector('[data-label="الفصل"]');
    if (!grade || !grade.value) {
        setLabeledField(root, "الصف", canonicalGrade(student.grade));
    }
    if (!section || !section.value) {
        setLabeledField(root, "الفصل", canonicalSection(student.section));
    }
}

function activitiesForDomain(domain) {
    var name = window.contextualDomain ? contextualDomain(domain) : domain;
    if (!name) {
        name = domain || "";
    }
    var found = [];
    var templates = window.contextualBank ? contextualBank.templates : [];
    (templates || []).forEach(function (item) {
        if (item.domain === name && item.activity && found.indexOf(item.activity) === -1) {
            found.push(item.activity);
        }
    });
    return found;
}

function refillActivitySelect(origin) {
    var root = origin.closest("tr") || origin.closest(".standard-register");
    if (!root || !window.fillSelect) {
        return;
    }
    var activity = root.querySelector('[data-label="النشاط"], [data-label="النوع"]');
    if (!activity) {
        return;
    }
    var list = activitiesForDomain(origin.value);
    if (!list.length) {
        return;
    }
    fillSelect(activity, list, activity.value);
}

function copyLabeled(origin, label) {
    var root = origin.closest(".standard-register") || origin.closest("tr");
    if (!root || !origin.value) {
        return;
    }
    setLabeledField(root, label, origin.value);
}

function ensureXlsx(done) {
    if (window.XLSX) {
        done();
        return;
    }
    var script = document.createElement("script");
    script.src = "js/xlsx.full.min.js";
    script.onload = function () {
        done();
    };
    script.onerror = function () {
        done(new Error("تعذر تحميل قارئ الإكسل"));
    };
    document.body.appendChild(script);
}

function bindStudentImport() {
    var button = document.getElementById("import-students");
    var message = document.getElementById("students-import-message");
    if (!button) {
        return;
    }
    button.addEventListener("click", function () {
        var input = document.getElementById("students-excel");
        var file = input && input.files ? input.files[0] : null;
        if (!file) {
            message.textContent = "اختر ملف إكسل أولاً";
            return;
        }
        ensureXlsx(function (error) {
            if (error) {
                message.textContent = error.message;
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                try {
                    var students = parseStudentSheet(reader.result);
                    saveStudents(students);
                    message.textContent = "تم تحديث القاعدة: " + students.length + " طالباً بنجاح";
                } catch (readError) {
                    message.textContent = readError.message || "تعذر قراءة الملف";
                }
            };
            reader.readAsArrayBuffer(file);
        });
    });
}

document.addEventListener("change", function (event) {
    var target = event.target;
    if (!target || !target.getAttribute) {
        return;
    }
    var label = target.getAttribute("data-label");
    if (label === "الصف" || label === "الفصل") {
        refillStudentNames(target);
    }
    if (target.classList && target.classList.contains("student-name")) {
        applyStudentFields(target);
    }
    if (label === "المجال") {
        refillActivitySelect(target);
    }
    if (label === "نوع الحادثة") {
        copyLabeled(target, "وصف المخالفة");
        copyLabeled(target, "الوصف");
    }
    if (label === "البند") {
        var evidenceItem = window.evidenceByItem ? evidenceByItem(target.value) : null;
        if (evidenceItem) {
            var evidenceRoot = target.closest("tr") || target.closest(".register-form-body") || target.closest(".standard-register");
            setLabeledField(evidenceRoot, "الوصف", evidenceItem.description);
            setLabeledField(evidenceRoot, "الشاهد", evidenceItem.witness);
            return;
        }
    }
    if (label === "البند" && target.dataset.planField !== "title") {
        var row = target.closest("tr") || target.closest(".register-form-body");
        var description = row ? row.querySelector('[data-label="الوصف"]') : null;
        if (description && !description.value && description.options && description.options.length > 1) {
            description.value = description.options[1].value;
        }
        var witness = row ? row.querySelector('[data-label="الشاهد"]') : null;
        if (witness && witness.options) {
            var same = Array.prototype.some.call(witness.options, function (option) {
                return option.value === target.value;
            });
            if (same) {
                witness.value = target.value;
            } else if (!witness.value && witness.options.length > 1) {
                witness.value = witness.options[1].value;
            }
        }
    }
});

document.addEventListener("input", function (event) {
    var target = event.target;
    if (target && target.classList && target.classList.contains("student-name")) {
        applyStudentFields(target);
    }
});

fetch("/banks/students_registry.json")
    .then(function (response) {
        return response.ok ? response.json() : { students: [] };
    })
    .then(function (payload) {
        if (!localStorage.getItem(STUDENTS_KEY)) {
            studentsRegistrySeed = (payload && payload.students) || [];
        }
        refreshStudentList();
    })
    .catch(function () {
        refreshStudentList();
    });

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindStudentImport);
} else {
    bindStudentImport();
}

function evidenceByItem(value) {
    var found = null;
    ((window.autoFillDictionary || {}).evidence_matrix || []).forEach(function (item) {
        if (item.code === value || item.label === value) {
            found = item;
        }
    });
    return found;
}

function dictionaryChoices(registerId, column) {
    var dict = window.autoFillDictionary || {};
    var care = dict.academic_care || {};
    var behavior = dict.behavior || {};
    var lab = dict.lab || {};
    var gifted = dict.gifted || {};
    var matrix = dict.evidence_matrix || [];
    if (column === "البند") {
        return matrix.map(function (item) { return item.label; });
    }
    if (column === "نوع الفاقد") {
        return care.loss_type || null;
    }
    if (column === "المهارة" || column === "المهارة المستهدفة") {
        return care.skill || null;
    }
    if (column === "نوع التدخل") {
        return care.intervention || null;
    }
    if (column === "وصف المخالفة" || column === "نوع الحادثة" || (column === "الوصف" && registerId === "behavior_cases")) {
        return behavior.violation_description || null;
    }
    if (column === "الوصف" && registerId === "teacher_portfolio") {
        return matrix.map(function (item) { return item.description; });
    }
    if (column === "الشاهد" && registerId === "teacher_portfolio") {
        return matrix.map(function (item) { return item.witness; });
    }
    if (column === "الإجراء التربوي" || column === "الإجراء الفوري") {
        return behavior.educational_action || null;
    }
    if (column === "قرار اللجنة") {
        return behavior.committee_decision || null;
    }
    if (column === "المواد والأدوات") {
        return lab.tools || null;
    }
    if (column === "نوع التجربة") {
        return lab.experiment_type || null;
    }
    if (column === "مستوى السلامة") {
        return lab.safety || null;
    }
    if (column === "التصنيف") {
        return gifted.classification || null;
    }
    if (column === "أداة الاكتشاف") {
        return gifted.discovery_tool || null;
    }
    if (column === "البرامج الإثرائية") {
        return gifted.enrichment || null;
    }
    return null;
}

fetch("/banks/auto_fill_dictionary.json")
    .then(function (response) {
        return response.ok ? response.json() : {};
    })
    .then(function (payload) {
        window.autoFillDictionary = payload || {};
        if (window.refreshPlanChoices) {
            refreshPlanChoices();
        }
    })
    .catch(function () {
        window.autoFillDictionary = window.autoFillDictionary || {};
    });

window.evidenceByItem = evidenceByItem;
window.dictionaryChoices = dictionaryChoices;
window.loadStudents = loadStudents;
window.saveStudents = saveStudents;
window.parseStudentSheet = parseStudentSheet;
window.refillStudentNames = refillStudentNames;
window.studentsInClass = studentsInClass;
window.activitiesForDomain = activitiesForDomain;
