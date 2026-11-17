var GovernanceSuite = (function () {
    var PRINCIPAL = "نايف بن سمير حجيف المخلفي";
    var pack = null;
    var staffPeople = [];
    var SUITE_KEYS = {
        employee_leave_register: "employee_leave_register",
        school_fund_register: "school_fund_register",
        schedule_and_substitution_register: "schedule_and_substitution_register",
        lrr_learning_resources: "learning_resources_register"
    };
    var COMMITTEE_KEYS = {
        quality: "accreditation_and_excellence",
        achievement: "academic_achievement_and_nafes",
        guidance: "student_guidance_and_care",
        safety: "safety_security_and_crisis",
        activity: "national_events_and_activities",
        resources: "learning_resources_and_digital",
        partnership: "school_fund_and_procurement",
        exams: "schedule_and_substitutions",
        discipline: "emergency_intervention_team"
    };

    function esc(value) {
        if (typeof escapeHeader === "function") {
            return escapeHeader(value);
        }
        return String(value || "");
    }

    function schoolName() {
        return (typeof bookletSchoolName === "string" && bookletSchoolName) || "متوسطة سعد بن الربيع الأنصاري";
    }

    function adminName() {
        return (typeof bookletAdmin === "string" && bookletAdmin) || "الإدارة العامة للتعليم بمنطقة المدينة المنورة";
    }

    function officeName() {
        return typeof bookletOffice === "string" ? bookletOffice.trim() : "";
    }

    function schemas() {
        return (pack && pack.operational_registers_schemas) || {};
    }

    function specFor(id) {
        return schemas()[SUITE_KEYS[id]] || null;
    }

    function isSuite(id) {
        return !!SUITE_KEYS[id];
    }

    function catalogItems() {
        return Object.keys(SUITE_KEYS).map(function (id) {
            var spec = specFor(id);
            return {
                id: id,
                title: spec ? spec.register_name : id,
                orientation: "landscape",
                suite: true,
                fixed: { school: schoolName(), principal: PRINCIPAL, year: "1448هـ" }
            };
        }).filter(function (item) {
            return specFor(item.id);
        });
    }

    function nextCode(prefix, width) {
        var key = "serial1059-" + prefix;
        var current = Number(sessionStorage.getItem(key) || "0") + 1;
        sessionStorage.setItem(key, String(current));
        var text = String(current);
        var size = width || 5;
        while (text.length < size) {
            text = "0" + text;
        }
        return text;
    }

    function options(list, placeholder) {
        var html = '<option value="">' + esc(placeholder || "") + "</option>";
        (list || []).forEach(function (option) {
            html += '<option value="' + esc(option) + '">' + esc(option) + "</option>";
        });
        return html;
    }

    function staffList() {
        var names = {};
        staffPeople.forEach(function (person) {
            if (person.name) {
                names[person.name] = person;
            }
        });
        if (window.ProgressEngine) {
            ProgressEngine.individuals.forEach(function (person) {
                if (!names[person.name]) {
                    names[person.name] = { name: person.name, id: "", roles: [person.role] };
                }
            });
        }
        return Object.keys(names).map(function (name) {
            return names[name];
        });
    }

    function datalist(id, people) {
        return '<datalist id="' + id + '">' + people.map(function (person) {
            var label = person.student_name || person.name || "";
            return '<option value="' + esc(label) + '"></option>';
        }).join("") + "</datalist>";
    }

    function control(field) {
        var label = field.label;
        var attr = ' data-label="' + esc(label) + '"';
        if (field.type === "dropdown") {
            return "<label>" + esc(label) + '<select' + attr + ">" + options(field.options) + "</select></label>";
        }
        if (field.type === "multi_dropdown") {
            return "<label>" + esc(label) + '<select' + attr + ' multiple size="4">' + (field.options || []).map(function (option) {
                return '<option value="' + esc(option) + '">' + esc(option) + "</option>";
            }).join("") + "</select></label>";
        }
        if (field.type === "boolean") {
            return "<label>" + esc(label) + '<select' + attr + ">" + options(["نعم", "لا"]) + "</select></label>";
        }
        if (field.type === "textarea") {
            return "<label>" + esc(label) + "<textarea" + attr + "></textarea></label>";
        }
        if (field.type === "time") {
            return "<label>" + esc(label) + '<input type="time"' + attr + "></label>";
        }
        if (field.type === "conditional_dropdown") {
            return "<label>" + esc(label) + '<select' + attr + ' data-suite-grade="1">' + options([]) + "</select></label>";
        }
        if (field.type === "computed" && field.label === "التصنيف المحاسبي") {
            return "<label>" + esc(label) + '<input' + attr + ' readonly data-suite-kind="class"></label>';
        }
        if (field.type === "number" || field.type === "computed") {
            var read = field.type === "computed" ? " readonly" : "";
            return "<label>" + esc(label) + '<input type="number"' + attr + read + ' data-suite-kind="' + field.type + '"></label>';
        }
        if (field.type === "hijri_date") {
            var iso = typeof todayIso === "function" ? todayIso() : "";
            var hijri = iso && typeof hijriFromDate === "function" ? hijriFromDate(iso) : "";
            var gregorian = iso && typeof gregorianFromDate === "function" ? gregorianFromDate(iso) : "";
            return "<label class=\"dual-date\">" + esc(label) + '<span class="dual-date-pair">' +
                '<input class="doc-hijri" data-label="' + esc(label) + ' هجري" placeholder="مثال: 17 ربيع الأول 1448هـ" value="' + esc(hijri) + '">' +
                '<input class="doc-date-picker" data-label="' + esc(label) + ' ميلادي" placeholder="مثال: 30 أغسطس 2026م" value="' + esc(gregorian) + '">' +
                "</span></label>";
        }
        if (field.type === "autocomplete" && field.source === "noor_teachers") {
            return "<label>" + esc(label) + '<input list="suite-staff-list"' + attr + ' autocomplete="off"></label>';
        }
        if (field.type === "autocomplete" && (field.source === "students_and_staff" || (field.sources && field.sources.length))) {
            return "<label>" + esc(label) + '<input list="suite-people-list"' + attr + ' autocomplete="off"></label>';
        }
        return "<label>" + esc(label) + "<input" + attr + "></label>";
    }

    function formHtml(item) {
        var spec = specFor(item.id);
        var serial = spec.register_code + "-1448-" + nextCode(spec.register_code, 5);
        var html = typeof registerHeader === "function" ? registerHeader({ school: schoolName(), year: "1448هـ", principal: PRINCIPAL }, serial) : "";
        var students = typeof loadStudents === "function" ? loadStudents() : [];
        html += datalist("suite-staff-list", staffList());
        html += datalist("suite-people-list", staffList().concat(students));
        Object.keys(spec.fields || {}).forEach(function (groupName) {
            var group = spec.fields[groupName];
            html += '<section class="register-section"><div class="suite-fields">';
            Object.keys(group).forEach(function (key) {
                html += control(group[key]);
            });
            html += "</div></section>";
        });
        if (item.id === "employee_leave_register") {
            html += '<p class="suite-computed" data-suite-hours>رصيد الساعات: —</p>';
        }
        if (item.id === "school_fund_register") {
            html += '<p class="suite-computed" data-suite-balance>الرصيد بعد المعاملة: —</p>';
        }
        html += '<table class="register-editor-table"><thead><tr><th>م</th><th>التوقيع</th><th>الاسم</th></tr></thead><tbody>' +
            (spec.signatures_matrix || []).map(function (line, index) {
                var name = line.indexOf("مدير") !== -1 ? PRINCIPAL : "";
                return "<tr><td>" + (index + 1) + "</td><td>" + esc(line) + "</td><td>" + esc(name) + "</td></tr>";
            }).join("") + "</tbody></table>";
        html += suiteSignoff(item.id);
        return html;
    }

    function suiteBar() {
        var standard = (pack && pack.print_footer_standard) || {};
        var template = standard.content_template || "وثيقة إدارية رسمية معتمدة — متوسطة سعد بن الربيع الأنصاري | صفحة {page}/{total_pages}";
        var text = template.split("{page}").join("1").split("{total_pages}").join("1");
        return '<p class="print-doc-bar suite-doc-bar">' + esc(text) + "</p>";
    }

    function suiteSignoff(id) {
        var html = typeof officialSignoff === "function" ? officialSignoff(id) : "";
        return html.replace(/<p class="print-doc-bar">[\s\S]*?<\/p>/, suiteBar());
    }

    function valueOf(root, label) {
        var node = root.querySelector('[data-label="' + label + '"]');
        if (!node) {
            return "";
        }
        if (node.multiple) {
            return Array.prototype.filter.call(node.options, function (option) {
                return option.selected;
            }).map(function (option) {
                return option.value;
            }).join("، ");
        }
        return node.value || "";
    }

    function setValue(root, label, value) {
        var node = root.querySelector('[data-label="' + label + '"]');
        if (node && value) {
            node.value = value;
        }
    }

    function personByName(name) {
        var found = staffList().filter(function (person) {
            return person.name === name;
        })[0];
        return found || null;
    }

    function jobOption(role) {
        var text = role || "";
        if (text.indexOf("الشؤون التعليمية") !== -1) {
            return "وكيل شؤون تعليمية";
        }
        if (text.indexOf("شؤون الطلاب") !== -1) {
            return "وكيل شؤون طلاب";
        }
        if (text.indexOf("موجه") !== -1) {
            return "موجه طلابي";
        }
        if (text.indexOf("نشاط") !== -1) {
            return "رائد نشاط";
        }
        if (text.indexOf("مختبر") !== -1) {
            return "محضر مختبر";
        }
        if (text.indexOf("حاسب") !== -1) {
            return "محضر معمل حاسب";
        }
        if (text.indexOf("مصادر") !== -1) {
            return "أمين مصادر تعلم";
        }
        if (text.indexOf("مساعد") !== -1) {
            return "مساعد إداري";
        }
        if (text.indexOf("اداري") !== -1 || text.indexOf("إداري") !== -1) {
            return "إداري";
        }
        if (text.indexOf("معلم") !== -1) {
            return "معلم";
        }
        return "";
    }

    function minutesOf(value) {
        var parts = String(value || "").split(":");
        if (parts.length < 2) {
            return null;
        }
        var hour = parseInt(parts[0], 10);
        var minute = parseInt(parts[1], 10);
        if (isNaN(hour) || isNaN(minute)) {
            return null;
        }
        return hour * 60 + minute;
    }

    function paintHours(root) {
        var node = root.querySelector("[data-suite-hours]");
        if (!node) {
            return;
        }
        var start = minutesOf(valueOf(root, "وقت الخروج"));
        var end = minutesOf(valueOf(root, "وقت العودة الفعلي"));
        if (end === null) {
            end = minutesOf(valueOf(root, "وقت العودة المتوقع"));
        }
        if (start === null || end === null || end < start) {
            node.textContent = "رصيد الساعات: —";
            return;
        }
        var diff = end - start;
        node.textContent = "رصيد الساعات: " + Math.floor(diff / 60) + " س و " + (diff % 60) + " د";
    }

    function paintFund(root) {
        var balanceNode = root.querySelector("[data-suite-balance]");
        var opening = parseFloat(valueOf(root, "الرصيد الافتتاحي"));
        var amount = parseFloat(valueOf(root, "المبلغ (ريال)"));
        var kind = valueOf(root, "نوع المعاملة");
        var incomeTypes = ["إيراد نقدي", "إيراد خدمي", "تبرع", "رعاية"];
        var code = "";
        if (incomeTypes.indexOf(kind) !== -1) {
            code = "income";
        } else if (kind === "تحويل داخلي") {
            code = "neutral";
        } else if (kind) {
            code = "expense";
        }
        var classLabels = { income: "إيراد", expense: "مصروف", neutral: "محايد" };
        setValue(root, "التصنيف المحاسبي", classLabels[code] || "");
        if (balanceNode) {
            if (isNaN(opening) || isNaN(amount) || !code) {
                balanceNode.textContent = "الرصيد بعد المعاملة: —";
            } else {
                var delta = code === "income" ? amount : (code === "expense" ? -amount : 0);
                var next = opening + delta;
                balanceNode.textContent = "الرصيد بعد المعاملة: " + next + " ريال";
                setValue(root, "الرصيد بعد المعاملة", String(next));
            }
        }
        var quantity = parseFloat(valueOf(root, "الكمية"));
        var price = parseFloat(valueOf(root, "سعر الوحدة"));
        if (!isNaN(quantity) && !isNaN(price)) {
            setValue(root, "الإجمالي", String(quantity * price));
        }
    }

    function classLabel(student) {
        var grade = student.grade || "";
        var section = student.section || "";
        var shortGrade = grade.replace("الأول", "أول").replace("الثاني", "ثاني").replace("الثالث", "ثالث");
        return section ? shortGrade + " / " + section : shortGrade;
    }

    function paintBorrower(root) {
        var name = valueOf(root, "اسم المستعير");
        var staff = personByName(name);
        if (staff) {
            setValue(root, "السجل المدني", staff.id || "");
            return;
        }
        var students = typeof loadStudents === "function" ? loadStudents() : [];
        var student = students.filter(function (entry) {
            return entry.student_name === name;
        })[0];
        if (student) {
            setValue(root, "السجل المدني", student.student_nid || "");
            setValue(root, "الصف / القسم", classLabel(student));
        }
    }

    function paintEmployee(root) {
        var person = personByName(valueOf(root, "اسم الموظف"));
        if (!person) {
            return;
        }
        setValue(root, "السجل المدني", person.id || "");
        var job = "";
        (person.roles || []).forEach(function (role) {
            if (!job) {
                job = jobOption(role);
            }
        });
        setValue(root, "الوظيفة", job);
        paintGrade(root);
    }

    function paintGrade(root) {
        var spec = specFor("employee_leave_register");
        var field = spec && spec.fields && spec.fields.employee_info ? spec.fields.employee_info.grade_or_level : null;
        var select = root.querySelector("[data-suite-grade]");
        if (!field || !select) {
            return;
        }
        var job = valueOf(root, "الوظيفة");
        var list = !job ? [] : (job === "معلم" ? field.options_teacher : field.options_admin);
        var current = select.value;
        select.innerHTML = options(list || []);
        if ((list || []).indexOf(current) !== -1) {
            select.value = current;
        }
    }

    function bind(root) {
        if (!root || root.dataset.suiteBound === "1") {
            return;
        }
        root.dataset.suiteBound = "1";
        root.addEventListener("input", function () {
            paintEmployee(root);
            paintGrade(root);
            paintHours(root);
            paintFund(root);
            paintBorrower(root);
        });
        root.addEventListener("change", function () {
            paintEmployee(root);
            paintGrade(root);
            paintHours(root);
            paintFund(root);
            paintBorrower(root);
        });
    }

    function blanks(text, map) {
        return String(text || "").replace(/\{([a-z0-9_]+)\}/gi, function (token, key) {
            if (map && map[key] !== undefined && map[key] !== null && map[key] !== "") {
                return map[key];
            }
            return "....";
        });
    }

    function headerLines() {
        var lines = ["المملكة العربية السعودية", "وزارة التعليم", adminName()];
        if (officeName()) {
            lines.push(officeName());
        }
        lines.push(schoolName());
        lines.push("العام الدراسي 1448هـ");
        return lines.map(function (line) {
            return "<div>" + esc(line) + "</div>";
        }).join("");
    }

    function committeeSpec(id) {
        var bank = pack && pack.committee_meeting_minutes_bank;
        var key = COMMITTEE_KEYS[id];
        return bank && key ? bank.committees[key] : null;
    }

    function minutesDocument(item, seats) {
        var spec = committeeSpec(item.id);
        if (!spec) {
            return "";
        }
        var meta = pack.committee_meeting_minutes_bank.meeting_metadata || {};
        var code = "MIN-" + spec.committee_code + "-1448-" + nextCode("MIN-" + spec.committee_code, 3);
        var agenda = (spec.standard_agenda || []).map(function (line) {
            return "<li>" + esc(line) + "</li>";
        }).join("");
        var fill = window.GovernanceIntelligence ? GovernanceIntelligence.tokens() : {};
        var advice = (spec.sample_recommendations || []).map(function (line) {
            return "<li>" + esc(blanks(line, fill)) + "</li>";
        }).join("");
        var linked = window.GovernanceIntelligence ? GovernanceIntelligence.recommendationsFor(item.id) : [];
        var linkedHtml = linked.length ? "<h3>التوصيات التدخلية المرتبطة بانحراف المؤشر</h3><ul>" + linked.map(function (line) {
            return "<li>" + esc(blanks(line, fill)) + "</li>";
        }).join("") + "</ul>" : "";
        var body = (seats || []).map(function (seat, index) {
            return "<tr><td>" + (index + 1) + "</td><td>" + esc(seat.name) + "</td><td>" + esc(seat.title) + "</td><td></td><td></td></tr>";
        }).join("");
        var signs = (spec.signatures_matrix || []).map(function (line, index) {
            var name = line.indexOf("مدير") !== -1 || line.indexOf("رئيس") !== -1 ? PRINCIPAL : "";
            return "<tr><td>" + (index + 1) + "</td><td>" + esc(line) + "</td><td>" + esc(name) + "</td><td></td></tr>";
        }).join("");
        return '<article class="committee-document">' +
            '<header class="register-official-header"><div>' + headerLines() +
            (typeof documentMetaHtml === "function" ? documentMetaHtml(code) : "") +
            "</div></header>" +
            "<h2>محضر اجتماع " + esc(spec.committee_name) + "</h2>" +
            "<p>" + esc(meta.attendance_quorum || "") + "</p>" +
            "<p>" + esc(meta.decision_rule || "") + "</p>" +
            "<h3>جدول الأعمال</h3><ol>" + agenda + "</ol>" +
            "<h3>الحضور</h3><table class=\"register-editor-table\"><thead><tr><th>م</th><th>الاسم</th><th>الصفة</th><th>الحضور</th><th>التوقيع</th></tr></thead><tbody>" + body + "</tbody></table>" +
            "<h3>التوصيات النموذجية</h3><ul>" + advice + "</ul>" +
            linkedHtml +
            "<h3>التوقيع الجماعي</h3><table class=\"register-editor-table\"><thead><tr><th>م</th><th>الصفة</th><th>الاسم</th><th>التوقيع</th></tr></thead><tbody>" + signs + "</tbody></table>" +
            suiteSignoff(item.id) +
            "</article>";
    }

    function committeesFor(name, current) {
        var found = [];
        (window.committeeBank || []).forEach(function (item) {
            var saved = (window.committeeFormations || {})[item.id];
            var seats = saved && saved.length ? saved : (item.seats || []);
            seats.forEach(function (seat) {
                if (seat.name === name) {
                    found.push({ item: item, seat: seat });
                }
            });
        });
        if (current && !found.some(function (entry) { return entry.item.id === current.id; })) {
            var seat = (current._printSeats || current.seats || []).filter(function (entry) {
                return entry.name === name;
            })[0];
            if (seat) {
                found.unshift({ item: current, seat: seat });
            }
        }
        return found;
    }

    function appointmentDocument(personName, item, seats) {
        var letter = pack && pack.staff_appointment_letter_template;
        if (!letter || !personName) {
            return "";
        }
        var person = personByName(personName) || { name: personName, id: "", roles: [] };
        var printable = Object.assign({}, item || {}, { _printSeats: seats || [] });
        var memberships = committeesFor(personName, printable);
        var tasks = [];
        memberships.forEach(function (entry) {
            (entry.item.tasks || []).forEach(function (task) {
                if (tasks.length < 5 && tasks.indexOf(task) === -1) {
                    tasks.push(task);
                }
            });
        });
        while (tasks.length < 5) {
            tasks.push("....");
        }
        var seq = nextCode("MND", 3);
        var hijri = typeof hijriFromDate === "function" ? hijriFromDate() : "";
        var committees = memberships.length ? memberships.map(function (entry) {
            return "<li>لجنة " + esc(entry.item.title) + " بصفة " + esc(entry.seat.title || "") + " اعتباراً من " + esc(hijri) + " ولمدة العام الدراسي 1448هـ.</li>";
        }).join("") : "<li>....</li>";
        var taskLines = tasks.map(function (task, index) {
            return "<li>المهمة " + ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة"][index] + ": " + esc(task) + "</li>";
        }).join("");
        var job = (person.roles || []).join(" / ");
        var ack = letter.acknowledgment || {};
        return '<article class="committee-document">' +
            '<header class="register-official-header"><div>' + headerLines() +
            "<div>رقم الخطاب: " + seq + "-1448</div>" +
            "<div>التاريخ: " + esc(hijri) + "</div>" +
            "<div>المرجع الأرشيفي: MND-1448-" + esc(person.id || "....") + "-" + seq + "</div>" +
            "</div></header>" +
            "<h2>" + esc(letter.document_type) + "</h2>" +
            "<p>المكرم / " + esc(person.name) + "</p>" +
            "<p>" + esc(job) + "</p>" +
            "<p>" + esc(letter.recipient_block.greeting) + "</p>" +
            "<p>" + esc(blanks(letter.preamble.text, {})) + "</p>" +
            "<h3>" + esc(letter.mandate_body.intro) + "</h3><ul>" + committees + "</ul>" +
            "<h3>" + esc(letter.mandate_body.tasks_section.label) + "</h3><ol>" + taskLines + "</ol>" +
            "<p>" + esc(letter.mandate_body.support_note) + "</p>" +
            "<p>" + esc(letter.closing_statement) + "</p>" +
            "<p><strong>" + esc(letter.signature_block.principal_label) + "</strong><br>" + esc(PRINCIPAL) + "</p>" +
            '<img class="staff-signature sig-image" src="signatures/sig_manager.png" alt="" onerror="this.remove()">' +
            '<img class="school-stamp" src="/assets/img/official_school_stamp.png" alt="' + esc(letter.signature_block.stamp_label) + '">' +
            '<section class="receipt-box"><h3>' + esc(ack.label) + "</h3><p>" + esc(ack.text) + "</p>" +
            "<p>الاسم الكامل: " + esc(person.name) + "</p>" +
            "<p>السجل المدني: " + esc(person.id || "") + "</p>" +
            "<p>الصفة الوظيفية: " + esc(job) + "</p>" +
            "<p>تاريخ الاستلام: " + esc(hijri) + "</p>" +
            "<p>التوقيع: ______________________</p></section>" +
            "<p>نسخة معطاة إلى: " + esc((letter.cc_block.recipients || []).join("، ")) + "</p>" +
            suiteSignoff("assignment") +
            "</article>";
    }

    function committeeTitle(code) {
        var committees = pack && pack.committee_meeting_minutes_bank ? pack.committee_meeting_minutes_bank.committees : {};
        var name = "";
        Object.keys(committees || {}).forEach(function (key) {
            if (committees[key].committee_code === code) {
                name = committees[key].committee_name;
            }
        });
        return name ? code + " — " + name : code;
    }

    function levelOf(percent) {
        if (percent >= 90) {
            return "متميز";
        }
        if (percent >= 80) {
            return "جيد جداً";
        }
        if (percent >= 70) {
            return "جيد";
        }
        return "بحاجة إلى دعم";
    }

    function rollupDocument(school) {
        var report = pack && pack.etec_self_assessment_rollup_report;
        var snap = window.ProgressEngine ? ProgressEngine.snapshot() : null;
        if (!report || !snap) {
            return "";
        }
        var domains = report.domains_rollup.domains || [];
        var achievedSum = 0;
        var rows = domains.map(function (domain, index) {
            var current = snap.domainCurrent[index];
            var target = snap.domainTarget[index] || 100;
            var percent = Math.round((current / target) * 100);
            var achieved = Math.round(domain.total_indicators * current / target);
            achievedSum += achieved;
            var standards = (domain.standards || []).map(function (standard) {
                var standardAchieved = Math.round(standard.indicators_count * current / target);
                return "<tr><td>" + esc(standard.standard_code) + "</td><td>" + esc(standard.standard_name) + "</td><td>" + standard.indicators_count + "</td><td>" + standardAchieved + "</td><td>" + percent + "%</td></tr>";
            }).join("");
            return { domain: domain, current: current, target: target, percent: percent, achieved: achieved, standards: standards };
        });
        var indicatorTotal = domains.reduce(function (sum, domain) {
            return sum + (Number(domain.total_indicators) || 0);
        }, 0) || 52;
        var overall = indicatorTotal ? Math.round((achievedSum / indicatorTotal) * 100) : 0;
        var strongest = rows.slice().sort(function (a, b) { return b.percent - a.percent; })[0];
        var weakest = rows.slice().sort(function (a, b) { return a.percent - b.percent; })[0];
        var evidenceTotal = snap.evidenceCounts.reduce(function (sum, value) { return sum + value; }, 0);
        var students = typeof loadStudents === "function" ? loadStudents().length : 0;
        var staffCount = window.ProgressEngine ? ProgressEngine.individuals.length : 0;
        var classrooms = school && school.classrooms ? school.classrooms : "";
        var statistical = school && school.statistical_number ? school.statistical_number : "";
        var domainTable = rows.map(function (row) {
            var links = (row.domain.linked_committees || []).map(committeeTitle).join("، ");
            return "<tr><td>" + esc(row.domain.domain_name) + "</td><td>" + row.domain.total_indicators + "</td><td>" + row.achieved + "</td><td>الوضع " + row.current + " من مستهدف " + row.target + "</td><td>" + row.percent + "%</td><td>" + esc(levelOf(row.percent)) + "</td><td>" + esc(links) + "</td></tr>";
        }).join("");
        var standardTable = rows.map(function (row) { return row.standards; }).join("");
        var outcomes = rows[2];
        var nafsSpec = (outcomes.domain.nafes_results || {}).arabic || {};
        var nafsTarget = parseInt(String(nafsSpec.target || "70"), 10);
        var nafsGap = nafsTarget - outcomes.current;
        var nafs = ["لغتي", "الرياضيات", "العلوم"].map(function (subject) {
            return "<tr><td>" + subject + "</td><td>" + outcomes.current + "%</td><td>" + nafsTarget + "%</td><td>" + nafsGap + " نقاط</td></tr>";
        }).join("");
        var evidenceRows = snap.evidenceLabels.map(function (label, index) {
            return "<tr><td>" + esc(label) + "</td><td>" + snap.evidenceCounts[index] + "</td></tr>";
        }).join("");
        return '<article class="committee-document">' +
            '<header class="register-official-header"><div>' + headerLines() +
            "<div>" + esc(report.report_title) + "</div></div></header>" +
            "<h2>" + esc(report.report_type) + "</h2>" +
            "<p>المدرسة: " + esc(schoolName()) + " | الرقم الإحصائي: " + esc(statistical) + " | الفصول: " + esc(classrooms) + " | الطلاب: " + students + " | الكادر: " + staffCount + "</p>" +
            "<p>مدير المدرسة: " + esc(PRINCIPAL) + "</p>" +
            "<p>نسبة الإنجاز المرجحة لـ " + indicatorTotal + " مؤشرًا: " + overall + "% — " + esc(levelOf(overall)) + ". أقوى مجال: " + esc(strongest.domain.domain_name) + " " + strongest.percent + "%. المجال الأدنى: " + esc(weakest.domain.domain_name) + " " + weakest.percent + "%.</p>" +
            "<h3>المجالات الأربعة</h3><table class=\"register-editor-table\"><thead><tr><th>المجال</th><th>المؤشرات</th><th>المتحقق</th><th>الوضع والمستهدف</th><th>نسبة الإنجاز</th><th>المستوى</th><th>اللجان</th></tr></thead><tbody>" + domainTable + "</tbody></table>" +
            "<h3>المعايير الأحد عشر</h3><table class=\"register-editor-table\"><thead><tr><th>الرمز</th><th>المعيار</th><th>المؤشرات</th><th>المتحقق</th><th>نسبة المجال</th></tr></thead><tbody>" + standardTable + "</tbody></table>" +
            "<h3>فجوة نافس</h3><p>الوضع الحالي من نواتج التعلم المنشورة " + outcomes.current + "%، ومستهدف نافس في المخطط " + nafsTarget + "%.</p><table class=\"register-editor-table\"><thead><tr><th>المادة</th><th>الوضع الحالي</th><th>المستهدف</th><th>الفجوة</th></tr></thead><tbody>" + nafs + "</tbody></table>" +
            "<h3>الشواهد المرفوعة</h3><p>المجموع " + evidenceTotal + "</p><table class=\"register-editor-table\"><thead><tr><th>النوع</th><th>العدد</th></tr></thead><tbody>" + evidenceRows + "</tbody></table>" +
            "<p>إعداد: فريق التقويم الذاتي | مراجعة: لجنة التميز والجودة | اعتماد: مدير المدرسة " + esc(PRINCIPAL) + "</p>" +
            suiteSignoff("etec") +
            "</article>";
    }

    function present(html, landscape) {
        var sheet = document.getElementById("committee-sheet");
        if (!sheet) {
            return;
        }
        sheet.innerHTML = html;
        if (window.sealRepeatingLetterhead) {
            window.sealRepeatingLetterhead(sheet);
        }
        sheet.hidden = false;
        document.body.classList.add("printing-committee");
        if (landscape) {
            document.body.classList.add("printing-rollup");
        }
        window.addEventListener("afterprint", function cleanup() {
            document.body.classList.remove("printing-committee", "printing-rollup");
            sheet.hidden = true;
            window.removeEventListener("afterprint", cleanup);
        });
        window.print();
    }

    var ready = Promise.all([
        fetch("/banks/school_governance_remaining_suite.json?v=suite2").then(function (response) {
            return response.ok ? response.json() : {};
        }),
        fetch("/api/staff-directory").then(function (response) {
            return response.ok ? response.json() : { people: [] };
        })
    ]).then(function (payloads) {
        pack = (payloads[0] && payloads[0].school_governance_remaining_suite) || null;
        var allowed = {};
        if (window.ProgressEngine) {
            ProgressEngine.individuals.forEach(function (person) {
                allowed[person.name] = true;
            });
        }
        staffPeople = ((payloads[1] && payloads[1].people) || []).filter(function (person) {
            return person.name && allowed[person.name];
        });
        if (window.refreshRegisterCatalog) {
            window.refreshRegisterCatalog();
        }
        return catalogItems();
    }).catch(function () {
        pack = null;
        return [];
    });

    var button = document.getElementById("print-etec-rollup");
    if (button) {
        button.addEventListener("click", function () {
            fetch("/api/settings").then(function (response) {
                return response.ok ? response.json() : {};
            }).then(function (payload) {
                var html = rollupDocument(payload.school || {});
                if (html) {
                    present(html, true);
                }
            });
        });
    }

    return {
        ready: ready,
        isSuite: isSuite,
        catalogItems: catalogItems,
        formHtml: formHtml,
        bind: bind,
        minutesDocument: minutesDocument,
        appointmentDocument: appointmentDocument,
        rollupDocument: rollupDocument,
        present: present
    };
}());
