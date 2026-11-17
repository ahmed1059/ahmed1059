var SKILLS_BY_SUBJECT = {
    "القرآن الكريم": {
        "التلاوة والحفظ": ["سورة الملك", "سورة القلم", "سورة الحاقة", "سورة المعارج", "سورة نوح", "سورة الجن"],
        "التجويد": ["أحكام النون الساكنة", "التجويد التطبيقي", "المدود", "الوقف والابتداء", "صفات الحروف", "التطبيق على السور المقررة"]
    },
    "التوحيد": {
        "أركان الإيمان": ["أنواع التوحيد", "الإيمان بالملائكة", "الإيمان بالكتب", "الإيمان بالرسل", "الإيمان باليوم الآخر", "الإيمان بالقدر"],
        "العبادة والحذر من الانحراف": ["الشرك وأنواعه", "نواقض الإسلام", "محبة الله ورسوله", "العبادة وشروطها", "البدع", "الولاء والبراء"]
    },
    "الفقه": {
        "العبادات": ["الطهارة", "الصلاة", "الزكاة", "الصيام", "الحج والعمرة"],
        "المعاملات والآداب": ["الأطعمة", "الأيمان والنذور", "آداب الخلاف", "البيوع", "الإجارة", "الوصية", "المواريث المختصرة"]
    },
    "الحديث": {
        "الآداب": ["آداب الحديث", "بر الوالدين", "الأمانة", "حقوق الجار", "حفظ اللسان"],
        "القيم": ["فضل العلم", "الإحسان", "إماطة الأذى", "الصدق", "الاستقامة", "التعاون", "المسؤولية"]
    },
    "لغتي": {
        "القراءة والنصوص": ["نص الانتماء", "نص العمل التطوعي", "نص رؤية الوطن"],
        "الرسم والبنية": ["الهمزة المتوسطة", "الألف اللينة", "الميزان الصرفي", "الأساليب اللغوية"],
        "التراكيب والتعبير": ["الجملة الاسمية", "الجملة الفعلية", "التعبير الوصفي", "الرسالة الرسمية", "المقال القصير"]
    },
    "الرياضيات": {
        "الأعداد والعمليات": ["الأعداد الصحيحة والعمليات عليها", "الأعداد النسبية"],
        "الجبر": ["المعادلات الخطية البسيطة", "المعادلات والمتباينات", "كثيرات الحدود", "الدوال الخطية"],
        "الهندسة والقياس": ["الزوايا والمثلثات", "المساحة والمحيط", "نظرية فيثاغورس"],
        "الإحصاء والاحتمال": ["تمثيل البيانات بالأعمدة", "الاحتمال البسيط", "الإحصاء والاحتمال"]
    },
    "العلوم": {
        "طبيعة العلم والمادة": ["طبيعة العلم والقياس", "حالات المادة", "الجدول الدوري", "التفاعلات الكيميائية"],
        "الأحياء": ["الخلية ووظائفها", "أجهزة جسم الإنسان", "الوراثة والتكاثر"],
        "الفيزياء": ["الحركة والقوى", "الكهرباء والمغناطيس"],
        "الأرض والبيئة": ["الأرض والنظام الشمسي", "الطقس والمناخ", "الموارد والبيئة"]
    },
    "الدراسات الاجتماعية": {
        "التاريخ الوطني": ["الدولة السعودية الأولى", "الدولة السعودية الثانية", "توحيد المملكة"],
        "الجغرافيا": ["موقع وطني", "الوطن العربي", "المناخ والتضاريس", "المملكة والعالم"],
        "المواطنة والاقتصاد": ["الموارد الاقتصادية", "حقوق المواطنة", "المؤسسات الوطنية", "التنمية المستدامة", "الأنظمة والحقوق"]
    },
    "اللغة الإنجليزية": {
        "التواصل الشفهي": ["التحيات والتعارف", "الحياة المدرسية", "الهوايات"],
        "القراءة والكتابة": ["أسرتي", "الروتين اليومي", "القصة القصيرة"],
        "الحياة والبيئة": ["الطعام والصحة", "الرحلات", "المدينة والمعالم", "البيئة", "المستقبل والمهن", "التقنية والاتصال"]
    },
    "التربية الفنية": {
        "التربية الفنية": ["التشكيل البصري"]
    }
};

var CLASSROOM_VISIT_LEVELS = [
    { id: "none", label: "لم يتحقق", ratio: 0 },
    { id: "partial", label: "متحقق جزئياً", ratio: 0.5 },
    { id: "met", label: "متحقق", ratio: 0.75 },
    { id: "high", label: "متحقق بدرجة عالية", ratio: 1 }
];

var CLASSROOM_VISIT_VISITORS = [
    { name: "نايف بن سمير حجيف المخلفي", role: "مدير المدرسة", signature: "signatures/sig_manager.png" },
    { name: "محمد بن فايز الجابري", role: "وكيل شؤون المعلمين", signature: "signatures/sig_teachers.png" },
    { name: "خالد بن علي الجابري", role: "وكيل شؤون الطلاب", signature: "signatures/sig_students.png" }
];

function mountClassroomVisit(host) {
    var template = document.getElementById("classroom-visit");
    if (!template || !host) {
        return;
    }
    host.appendChild(template.content.cloneNode(true));
    var root = host.querySelector(".classroom-visit");
    fillVisitors(root);
    fillTeachers(root);
    fillGrades(root);
    fillSubjects(root);
    root.addEventListener("change", function (event) {
        var field = event.target;
        if (field.getAttribute("data-cv") === "subject" || field.getAttribute("data-cv") === "grade") {
            fillSkills(root);
        }
        if (field.getAttribute("data-cv") === "skill") {
            fillLessons(root);
        }
        refreshClassroomVisit(root);
    });
    refreshClassroomVisit(root);
    fetch("/api/staff-directory")
        .then(function (response) { return response.ok ? response.json() : { people: [] }; })
        .then(function (payload) {
            root.dataset.staffReady = "1";
            root._staff = payload.people || [];
            refreshClassroomVisit(root);
        })
        .catch(function () {});
}

function fillVisitors(root) {
    var select = root.querySelector("[data-cv='visitor']");
    var session = window.sessionPersonName ? sessionPersonName() : "";
    select.innerHTML = CLASSROOM_VISIT_VISITORS.map(function (person) {
        var selected = person.name === session ? " selected" : "";
        return '<option value="' + person.name + '"' + selected + ">" + person.name + " — " + person.role + "</option>";
    }).join("");
    if (!select.value) {
        select.value = CLASSROOM_VISIT_VISITORS[0].name;
    }
}

function fillTeachers(root) {
    var select = root.querySelector("[data-cv='teacher']");
    var people = window.ProgressEngine ? ProgressEngine.individuals : [];
    select.innerHTML = '<option value=""></option>' + people.map(function (person) {
        return '<option value="' + person.name + '">' + person.name + "</option>";
    }).join("");
}

function fillGrades(root) {
    var select = root.querySelector("[data-cv='grade']");
    var grades = window.curriculumBank ? curriculumBank().grades || [] : [];
    select.innerHTML = '<option value=""></option>' + grades.map(function (grade) {
        return '<option value="' + grade + '">' + grade + "</option>";
    }).join("");
}

function fillSubjects(root) {
    var select = root.querySelector("[data-cv='subject']");
    select.innerHTML = '<option value=""></option>' + Object.keys(SKILLS_BY_SUBJECT).map(function (subject) {
        return '<option value="' + subject + '">' + subject + "</option>";
    }).join("");
    fillSkills(root);
}

function fillSkills(root) {
    var subject = root.querySelector("[data-cv='subject']").value;
    var select = root.querySelector("[data-cv='skill']");
    var skills = SKILLS_BY_SUBJECT[subject] || {};
    select.innerHTML = '<option value=""></option>' + Object.keys(skills).map(function (skill) {
        return '<option value="' + skill + '">' + skill + "</option>";
    }).join("");
    fillLessons(root);
}

function fillLessons(root) {
    var subject = root.querySelector("[data-cv='subject']").value;
    var skill = root.querySelector("[data-cv='skill']").value;
    var grade = root.querySelector("[data-cv='grade']").value;
    var select = root.querySelector("[data-cv='lesson']");
    var lessons = ((SKILLS_BY_SUBJECT[subject] || {})[skill]) || [];
    if (grade && window.lessonsForSelection) {
        var inGrade = lessonsForSelection(grade, subject);
        var filtered = lessons.filter(function (lesson) {
            return inGrade.indexOf(lesson) !== -1;
        });
        if (filtered.length) {
            lessons = filtered;
        }
    }
    select.innerHTML = '<option value=""></option>' + lessons.map(function (lesson) {
        return '<option value="' + lesson + '">' + lesson + "</option>";
    }).join("");
}

function levelRatio(value) {
    var found = CLASSROOM_VISIT_LEVELS.filter(function (level) {
        return level.id === value;
    })[0];
    return found ? found.ratio : 0;
}

function scoreBand(total) {
    if (total >= 90) {
        return { label: "ممتاز", tone: "high" };
    }
    if (total >= 75) {
        return { label: "متقدم", tone: "good" };
    }
    if (total >= 60) {
        return { label: "متمكن", tone: "mid" };
    }
    return { label: "بحاجة إلى دعم", tone: "low" };
}

function signatureFor(root, name) {
    if (!name) {
        return "";
    }
    if (name.indexOf("نايف بن سمير") !== -1) {
        return "signatures/sig_manager.png";
    }
    if (name.indexOf("محمد بن فايز") !== -1) {
        return "signatures/sig_teachers.png";
    }
    if (name.indexOf("خالد بن علي") !== -1) {
        return "signatures/sig_students.png";
    }
    var people = root._staff || [];
    var found = people.filter(function (person) {
        return person.name === name;
    })[0];
    return found && found.id ? "signatures/sig_" + found.id + ".png" : "";
}

function setSignature(image, path) {
    if (!image) {
        return;
    }
    if (!path) {
        image.removeAttribute("src");
        image.hidden = true;
        return;
    }
    image.hidden = false;
    image.onerror = function () {
        image.hidden = true;
    };
    image.src = path;
}

function sectionDone(root, id) {
    function filled(name) {
        var field = root.querySelector("[data-cv='" + name + "']");
        return !!(field && String(field.value || "").trim());
    }
    if (id === "context") {
        return filled("visitor") && filled("teacher") && filled("visit-type") && filled("indicator");
    }
    if (id === "lesson") {
        return filled("subject") && filled("skill") && filled("lesson");
    }
    if (id === "matrix") {
        var rows = root.querySelectorAll("[data-cv='level-select']");
        return rows.length > 0 && Array.prototype.every.call(rows, function (select) {
            return String(select.value || "").trim();
        });
    }
    if (id === "plan") {
        return filled("recommendations") && filled("improvement") && (filled("follow-up") || filled("follow-up-gregorian"));
    }
    return filled("teacher") && filled("visitor");
}

function refreshClassroomVisit(root) {
    var total = 0;
    root.querySelectorAll(".cv-criterion").forEach(function (row) {
        var weight = Number(row.getAttribute("data-weight") || "0");
        var selected = row.querySelector("[data-cv='level-select']");
        var points = Math.round(levelRatio(selected ? selected.value : "") * weight * 100) / 100;
        total += points;
        var cell = row.querySelector("[data-cv='points']");
        if (cell) {
            cell.textContent = String(points);
        }
    });
    total = Math.round(total * 100) / 100;
    var band = scoreBand(total);
    var totalCell = root.querySelector("[data-cv='total']");
    var levelCell = root.querySelector("[data-cv='level']");
    if (totalCell) {
        totalCell.textContent = String(total);
        totalCell.className = "cv-total cv-level-" + band.tone;
    }
    if (levelCell) {
        levelCell.textContent = band.label;
        levelCell.className = "cv-level-" + band.tone;
    }
    var teacher = root.querySelector("[data-cv='teacher']");
    var visitor = root.querySelector("[data-cv='visitor']");
    var teacherName = teacher ? teacher.value : "";
    var visitorName = visitor ? visitor.value : "";
    var teacherSlot = root.querySelector("[data-cv='sign-teacher']");
    var visitorSlot = root.querySelector("[data-cv='sign-visitor']");
    if (teacherSlot) {
        teacherSlot.textContent = teacherName;
    }
    if (visitorSlot) {
        visitorSlot.textContent = visitorName;
    }
    setSignature(root.querySelector("[data-cv='sign-teacher-image']"), signatureFor(root, teacherName));
    setSignature(root.querySelector("[data-cv='sign-visitor-image']"), signatureFor(root, visitorName));
    root.querySelectorAll(".cv-progress span").forEach(function (segment) {
        segment.classList.toggle("is-done", sectionDone(root, segment.getAttribute("data-section")));
    });
}

window.mountClassroomVisit = mountClassroomVisit;
window.SKILLS_BY_SUBJECT = SKILLS_BY_SUBJECT;
