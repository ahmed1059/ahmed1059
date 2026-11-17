/* حزمة طباعة المؤشر 1-1-1-1 على مسار الإطار الرسمي. */
(function (root) {
    "use strict";

    function sessionHeaders() {
        var headers = { "Content-Type": "application/json" };
        try {
            var user = JSON.parse(sessionStorage.getItem("sessionUser") || "null");
            if (user && user.token) {
                headers["X-Session-Token"] = user.token;
            }
        } catch (error) {
            return headers;
        }
        return headers;
    }

    function getJson(url, auth) {
        return fetch(url, {
            headers: auth ? sessionHeaders() : { "Content-Type": "application/json" },
            cache: "no-store"
        }).then(function (response) {
            return response.json().then(function (body) {
                if (!response.ok) {
                    var detail = body && (body.detail || body.message);
                    throw new Error(typeof detail === "string" ? detail : "تعذر القراءة");
                }
                return body;
            });
        });
    }

    function firstId(value) {
        if (Array.isArray(value)) {
            return String(value[0] || "").trim();
        }
        return String(value || "").trim();
    }

    function staffName(people, id) {
        var needle = String(id || "").trim();
        var digits = needle.replace(/\D+/g, "");
        var name = "";
        (people || []).forEach(function (person) {
            if (!person || !person.name) {
                return;
            }
            var pid = String(person.id || "").trim();
            if (pid === needle || (digits && pid.replace(/\D+/g, "") === digits)) {
                name = String(person.name);
            }
        });
        return name;
    }

    function column(roleTitle, id, people, fallback) {
        var name = staffName(people, id);
        var digits = String(id || "").replace(/\D+/g, "");
        if (!digits || !name) {
            return null;
        }
        return {
            role: roleTitle,
            roleTitle: roleTitle,
            id: digits,
            name: name,
            signature: "signatures/sig_" + digits + ".png",
            signatureFallback: fallback
        };
    }

    function seatsFromLeadership(leadership, people) {
        var seats = [];
        var vice = column(
            "وكيل الشؤون التعليمية",
            firstId(leadership && leadership.education_agents),
            people,
            "signatures/sig_teachers.png"
        );
        var manager = column(
            "مدير المدرسة",
            firstId(leadership && leadership.manager),
            people,
            "signatures/sig_manager.png"
        );
        if (vice) {
            seats.push(vice);
        }
        if (manager && (!vice || vice.id !== manager.id)) {
            seats.push(manager);
        }
        return seats;
    }

    function seatsForSchool(leadership, people) {
        var seats = [];
        var vice = column(
            "وكيل الشؤون المدرسية",
            firstId(leadership && leadership.school_affairs_agent),
            people,
            ""
        );
        var manager = column(
            "مدير المدرسة",
            firstId(leadership && leadership.manager),
            people,
            "signatures/sig_manager.png"
        );
        if (vice) {
            seats.push(vice);
        }
        if (manager && (!vice || vice.id !== manager.id)) {
            seats.push(manager);
        }
        return seats;
    }

    function seatsForStudents(leadership, people) {
        var seats = [];
        var vice = column(
            "وكيل شؤون الطلاب",
            firstId(leadership && leadership.student_agents),
            people,
            "signatures/sig_students.png"
        );
        var manager = column(
            "مدير المدرسة",
            firstId(leadership && leadership.manager),
            people,
            "signatures/sig_manager.png"
        );
        if (vice) {
            seats.push(vice);
        }
        if (manager && (!vice || vice.id !== manager.id)) {
            seats.push(manager);
        }
        return seats;
    }

    function showPack(plan, metrics, programs, columns) {
        var html = root.PrintTemplates.renderPlan111({
            plan: plan,
            metrics: metrics,
            programs: programs,
            signoffColumns: columns
        });
        root.AJPrint.show(html, {
            pdfTitle: "الخطة التشغيلية 1-1-1-1",
            arm: { multiPage: true }
        });
    }

    function open() {
        if (!root.PrintTemplates || typeof root.PrintTemplates.renderPlan111 !== "function") {
            return Promise.reject(new Error("نموذج الحزمة غير محمّل."));
        }
        if (!root.AJPrint || typeof root.AJPrint.show !== "function") {
            return Promise.reject(new Error("معاينة الطباعة غير محمّلة."));
        }
        return Promise.all([
            getJson("/api/operational-plan", false),
            getJson("/api/performance-metrics", false).catch(function () {
                return {};
            }),
            getJson("/api/programs", false).catch(function () {
                return { programs: [] };
            }),
            getJson("/api/session/leadership", true).catch(function () {
                return {};
            }),
            getJson("/api/noor/staff", true).catch(function () {
                return { people: [] };
            })
        ]).then(function (parts) {
            var plan = parts[0] || {};
            var metrics = parts[1] || {};
            var programs = (parts[2] && parts[2].programs) || [];
            var seats = seatsFromLeadership(parts[3] || {}, (parts[4] && parts[4].people) || []);
            var core = root.SignatureCore;
            if (!seats.length || !core || typeof core.resolve !== "function") {
                showPack(plan, metrics, programs, seats);
                return;
            }
            return core.resolve(seats, { headers: sessionHeaders() }).then(function (resolved) {
                if (!resolved || !resolved.length) {
                    showPack(plan, metrics, programs, seats);
                    return;
                }
                showPack(plan, metrics, programs, resolved.map(function (row, index) {
                    var seat = seats[index] || {};
                    return {
                        role: row.role || seat.role,
                        roleTitle: row.role || seat.roleTitle,
                        id: row.id || seat.id,
                        name: row.name || seat.name,
                        signature: row.signature || seat.signature || "",
                        signatureFallback: seat.signatureFallback || ""
                    };
                }));
            }).catch(function () {
                showPack(plan, metrics, programs, seats);
            });
        });
    }

    function showPack122(plan, metrics, evaluation, columns, programs) {
        var indicators = (evaluation && evaluation.indicators) || [];
        var indicator = null;
        indicators.forEach(function (item) {
            if (item && String(item.code || "") === "1-2-1-2") {
                indicator = item;
            }
        });
        var html = root.PrintTemplates.renderPlan122({
            plan: plan,
            metrics: metrics,
            cycle: (evaluation && evaluation.cycle) || {},
            indicator: indicator || {},
            programs: programs || [],
            signoffColumns: columns
        });
        root.AJPrint.show(html, {
            pdfTitle: "قيم مهنة التعليم 1-2-1-2",
            arm: { multiPage: true }
        });
    }

    function open122() {
        if (!root.PrintTemplates || typeof root.PrintTemplates.renderPlan122 !== "function") {
            return Promise.reject(new Error("نموذج قيم المهنة غير محمّل."));
        }
        if (!root.AJPrint || typeof root.AJPrint.show !== "function") {
            return Promise.reject(new Error("معاينة الطباعة غير محمّلة."));
        }
        return Promise.all([
            getJson("/api/operational-plan", false).catch(function () {
                return {};
            }),
            getJson("/api/performance-metrics", false).catch(function () {
                return {};
            }),
            getJson("/api/programs", false).catch(function () {
                return { programs: [] };
            }),
            getJson("/api/evaluation", false).catch(function () {
                return { cycle: null, indicators: [] };
            }),
            getJson("/api/session/leadership", true).catch(function () {
                return {};
            }),
            getJson("/api/noor/staff", true).catch(function () {
                return { people: [] };
            })
        ]).then(function (parts) {
            var plan = parts[0] || {};
            var metrics = parts[1] || {};
            var programs = (parts[2] && parts[2].programs) || [];
            var evaluation = parts[3] || {};
            var seats = seatsFromLeadership(parts[4] || {}, (parts[5] && parts[5].people) || []);
            var core = root.SignatureCore;
            function show(columns) {
                showPack122(plan, metrics, evaluation, columns, programs);
            }
            if (!seats.length || !core || typeof core.resolve !== "function") {
                show(seats);
                return;
            }
            return core.resolve(seats, { headers: sessionHeaders() }).then(function (resolved) {
                if (!resolved || !resolved.length) {
                    show(seats);
                    return;
                }
                show(resolved.map(function (row, index) {
                    var seat = seats[index] || {};
                    return {
                        role: row.role || seat.role,
                        roleTitle: row.role || seat.roleTitle,
                        id: row.id || seat.id,
                        name: row.name || seat.name,
                        signature: row.signature || seat.signature || "",
                        signatureFallback: seat.signatureFallback || ""
                    };
                }));
            }).catch(function () {
                show(seats);
            });
        });
    }

    function indicatorByCode(evaluation, code) {
        var found = null;
        ((evaluation && evaluation.indicators) || []).forEach(function (item) {
            if (item && String(item.code || "") === code) {
                found = item;
            }
        });
        return found || {};
    }

    function showResolved(seats, core, show) {
        if (!seats.length || !core || typeof core.resolve !== "function") {
            show(seats);
            return null;
        }
        return core.resolve(seats, { headers: sessionHeaders() }).then(function (resolved) {
            if (!resolved || !resolved.length) {
                show(seats);
                return;
            }
            show(resolved.map(function (row, index) {
                var seat = seats[index] || {};
                return {
                    role: row.role || seat.role,
                    roleTitle: row.role || seat.roleTitle,
                    id: row.id || seat.id,
                    name: row.name || seat.name,
                    signature: row.signature || seat.signature || "",
                    signatureFallback: seat.signatureFallback || ""
                };
            }));
        }).catch(function () {
            show(seats);
        });
    }

    function open131() {
        if (!root.PrintTemplates || typeof root.PrintTemplates.renderPlan131 !== "function") {
            return Promise.reject(new Error("نموذج العلاقات غير محمّل."));
        }
        if (!root.AJPrint || typeof root.AJPrint.show !== "function") {
            return Promise.reject(new Error("معاينة الطباعة غير محمّلة."));
        }
        return Promise.all([
            getJson("/api/operational-plan", false).catch(function () {
                return {};
            }),
            getJson("/api/performance-metrics", false).catch(function () {
                return {};
            }),
            getJson("/api/programs", false).catch(function () {
                return { programs: [] };
            }),
            getJson("/api/evaluation", false).catch(function () {
                return { cycle: null, indicators: [] };
            }),
            getJson("/api/session/leadership", true).catch(function () {
                return {};
            }),
            getJson("/api/noor/staff", true).catch(function () {
                return { people: [] };
            })
        ]).then(function (parts) {
            var programs = (parts[2] && parts[2].programs) || [];
            var evaluation = parts[3] || {};
            var seats = seatsForStudents(parts[4] || {}, (parts[5] && parts[5].people) || []);
            function show(columns) {
                var html = root.PrintTemplates.renderPlan131({
                    plan: parts[0] || {},
                    metrics: parts[1] || {},
                    cycle: evaluation.cycle || {},
                    indicator: indicatorByCode(evaluation, "1-3-1-1"),
                    programs: programs,
                    signoffColumns: columns
                });
                root.AJPrint.show(html, {
                    pdfTitle: "العلاقات الإيجابية 1-3-1-1",
                    arm: { multiPage: true }
                });
            }
            return showResolved(seats, root.SignatureCore, show);
        });
    }

    function loadPack() {
        return Promise.all([
            getJson("/api/operational-plan", false).catch(function () {
                return {};
            }),
            getJson("/api/performance-metrics", false).catch(function () {
                return {};
            }),
            getJson("/api/programs", false).catch(function () {
                return { programs: [] };
            }),
            getJson("/api/evaluation", false).catch(function () {
                return { cycle: null, indicators: [] };
            }),
            getJson("/api/session/leadership", true).catch(function () {
                return {};
            }),
            getJson("/api/noor/staff", true).catch(function () {
                return { people: [] };
            })
        ]);
    }

    function selfEvalIndicator(evaluation) {
        var direct = indicatorByCode(evaluation, "1-4-1-6");
        if (direct && direct.code) {
            return direct;
        }
        var found = null;
        ((evaluation && evaluation.indicators) || []).forEach(function (item) {
            if (item && String(item.statement || "").indexOf("التقويم الذاتي") >= 0) {
                found = item;
            }
        });
        return found || {};
    }

    function openRendered(renderName, seatsOf, pdfTitle, build) {
        if (!root.PrintTemplates || typeof root.PrintTemplates[renderName] !== "function") {
            return Promise.reject(new Error("نموذج الحزمة غير محمّل."));
        }
        if (!root.AJPrint || typeof root.AJPrint.show !== "function") {
            return Promise.reject(new Error("معاينة الطباعة غير محمّلة."));
        }
        return loadPack().then(function (parts) {
            var people = (parts[5] && parts[5].people) || [];
            var seats = seatsOf(parts[4] || {}, people);
            function show(columns) {
                var html = build(parts, people, columns);
                root.AJPrint.show(html, {
                    pdfTitle: pdfTitle,
                    arm: { multiPage: true }
                });
            }
            return showResolved(seats, root.SignatureCore, show);
        });
    }

    function nameOnly(roleTitle, id, people) {
        var name = staffName(people, id);
        return {
            roleTitle: roleTitle,
            name: name || "………………"
        };
    }

    function cadreRows(people, committees) {
        var duty = {};
        (committees || []).forEach(function (committee) {
            var title = String(committee && committee.title || "").trim();
            (committee && committee.members || []).forEach(function (member) {
                var id = String(member && member.national_id || "").trim();
                if (!id || !title) {
                    return;
                }
                var label = String(member.seat || "") === "chair" ? ("رئيس " + title) : title;
                if (!duty[id]) {
                    duty[id] = [];
                }
                if (duty[id].indexOf(label) < 0) {
                    duty[id].push(label);
                }
            });
        });
        return (people || []).filter(function (person) {
            return person && String(person.role || "").indexOf("معلم") === 0 && person.active !== false && person.name;
        }).sort(function (a, b) {
            return String(a.name).localeCompare(String(b.name), "ar");
        }).map(function (person) {
            var tasks = duty[String(person.id || "").trim()] || [];
            return [person.name, "", person.specialty || "", "", tasks.join("، "), "", "☐ متسق تمامًا"];
        });
    }

    function classCount(students) {
        var keys = {};
        (students || []).forEach(function (student) {
            var grade = String(student && student.grade || "").trim();
            var room = String(student && student.classroom || "").trim();
            if (grade && room) {
                keys[grade + "|" + room] = true;
            }
        });
        return Object.keys(keys).length;
    }

    function witnessBase(people, committees, students, leadership) {
        var rows = cadreRows(people, committees);
        var rooms = classCount(students);
        var excellence = null;
        (committees || []).forEach(function (committee) {
            if (committee && committee.id === "excellence") {
                excellence = committee;
            }
        });
        var chairId = "";
        ((excellence && excellence.members) || []).forEach(function (member) {
            if (!chairId && String(member.seat || "") === "chair") {
                chairId = member.national_id;
            }
        });
        return root.PrintTemplates.renderStaffCadreWitness({
            rows: rows,
            summary: {
                classes: rooms ? String(rooms) : "",
                actual: rows.length ? String(rows.length) : ""
            },
            signoffColumns: [
                nameOnly("معد البيان (وكيل الشؤون التعليمية)", firstId(leadership && leadership.education_agents), people),
                nameOnly("رئيس لجنة التميز والجودة", chairId, people),
                nameOnly("يعتمد / مدير المدرسة", firstId(leadership && leadership.manager), people)
            ]
        });
    }

    function showWitness(html) {
        root.AJPrint.show(html, {
            pdfTitle: "شاهد الكادر التعليمي 1-4-1-1",
            arm: { orientation: "landscape", multiPage: true }
        });
    }

    function witnessFileUrl(id) {
        var headers = sessionHeaders();
        delete headers["Content-Type"];
        return fetch("/api/session/witness-files/" + encodeURIComponent(id) + "/file", {
            headers: headers,
            cache: "no-store"
        }).then(function (response) {
            if (!response.ok) {
                throw new Error("تعذر قراءة المرفق.");
            }
            return response.blob();
        }).then(function (blob) {
            return new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload = function () { resolve(String(reader.result || "")); };
                reader.onerror = function () { reject(new Error("تعذر قراءة المرفق.")); };
                reader.readAsDataURL(blob);
            });
        });
    }

    function witnessAttachmentHtml(item, dataUrl) {
        if (!root.PrintMasterCore || typeof root.PrintMasterCore.sheet !== "function") {
            return "";
        }
        var body = item.kind === "image" && dataUrl
            ? "<p class=\"tpl-p\"><img src=\"" + dataUrl + "\" alt=\"\" style=\"display:block;width:100%;max-height:150mm;object-fit:contain;margin:0 auto\"></p>"
            : "<p class=\"tpl-p\">مرفق PDF: " + String(item.original_name || "").replace(/[&<>"]/g, "") + "</p>";
        return root.PrintMasterCore.sheet({
            strictIdentity: true,
            orientation: "landscape",
            title: "مرفق الشاهد",
            bodyHtml: body,
            signoff: false,
            frameClass: "tpl-portrait-official",
            kind: "document"
        });
    }

    function openStaffCadreWitness() {
        if (!root.PrintTemplates || typeof root.PrintTemplates.renderStaffCadreWitness !== "function") {
            return Promise.reject(new Error("نموذج شاهد الكادر غير محمّل."));
        }
        if (!root.AJPrint || typeof root.AJPrint.show !== "function") {
            return Promise.reject(new Error("معاينة الطباعة غير محمّلة."));
        }
        return Promise.all([
            getJson("/api/noor/staff", false).catch(function () { return { people: [] }; }),
            getJson("/api/session/committees", true).catch(function () { return { committees: [] }; }),
            getJson("/api/session/noor-students", true).catch(function () { return { students: [] }; }),
            getJson("/api/session/leadership", true).catch(function () { return {}; }),
            getJson("/api/session/witness-files", true).catch(function () { return { items: [] }; })
        ]).then(function (parts) {
            var people = (parts[0] && parts[0].people) || [];
            var base = witnessBase(people, (parts[1] && parts[1].committees) || [], (parts[2] && parts[2].students) || [], parts[3] || {});
            var body = parts[4] || {};
            var items = (body && body.items) || [];
            if (!items.length) {
                showWitness(base);
                return;
            }
            return Promise.all(items.map(function (item) {
                if (item.kind !== "image") {
                    return "";
                }
                return witnessFileUrl(item.id);
            })).then(function (urls) {
                var extra = items.map(function (item, index) {
                    return witnessAttachmentHtml(item, urls[index]);
                }).join("");
                showWitness(base + extra);
            });
        });
    }

    function open141() {
        return openRendered("renderPlan141", seatsFromLeadership, "الكادر التعليمي 1-4-1-1", function (parts, people, columns) {
            return root.PrintTemplates.renderPlan141({
                plan: parts[0] || {},
                metrics: parts[1] || {},
                cycle: (parts[3] && parts[3].cycle) || {},
                programs: (parts[2] && parts[2].programs) || [],
                people: people,
                signoffColumns: columns
            });
        });
    }

    function open146() {
        return openRendered("renderPlan146", seatsFromLeadership, "التقويم الذاتي 1-4-1-6", function (parts, people, columns) {
            var evaluation = parts[3] || {};
            return root.PrintTemplates.renderPlan146({
                plan: parts[0] || {},
                metrics: parts[1] || {},
                cycle: evaluation.cycle || {},
                indicator: selfEvalIndicator(evaluation),
                indicators: evaluation.indicators || [],
                programs: (parts[2] && parts[2].programs) || [],
                people: people,
                signoffColumns: columns
            });
        });
    }

    function open142() {
        return openRendered("renderPlan142", seatsForSchool, "الكادر الإداري 1-4-1-2", function (parts, people, columns) {
            return root.PrintTemplates.renderPlan142({
                plan: parts[0] || {},
                metrics: parts[1] || {},
                cycle: (parts[3] && parts[3].cycle) || {},
                programs: (parts[2] && parts[2].programs) || [],
                people: people,
                leadership: parts[4] || {},
                signoffColumns: columns
            });
        });
    }

    root.Plan111 = { open: open };
    root.Plan122 = { open: open122 };
    function openRelationsWitness() {
        if (!root.PrintTemplates || typeof root.PrintTemplates.renderRelationsWitness !== "function") {
            return Promise.reject(new Error("شاهد العلاقات غير محمّل."));
        }
        if (!root.AJPrint || typeof root.AJPrint.show !== "function") {
            return Promise.reject(new Error("معاينة الطباعة غير محمّلة."));
        }
        var ids = {
            "pilot-1448-guidance-2026-09-09": true,
            "pilot-1448-students-2026-11-04": true
        };
        return Promise.all([
            getJson("/api/councils", false).catch(function () {
                return { minutes: [] };
            }),
            getJson("/api/evaluation", false).catch(function () {
                return { indicators: [] };
            })
        ]).then(function (parts) {
            var minutes = ((parts[0] && parts[0].minutes) || []).filter(function (item) {
                return item && ids[item.id];
            });
            minutes.sort(function (a, b) {
                return String(a.iso || "").localeCompare(String(b.iso || ""));
            });
            var indicator = {};
            ((parts[1] && parts[1].indicators) || []).forEach(function (item) {
                if (item && item.code === "1-3-1-1") {
                    indicator = item;
                }
            });
            return Promise.all([
                getJson("/api/noor/staff", false).catch(function () { return { people: [] }; }),
                getJson("/api/session/leadership", true).catch(function () { return {}; })
            ]).then(function (extra) {
                var people = (extra[0] && extra[0].people) || [];
                var leadership = extra[1] || {};
                root.AJPrint.show(root.PrintTemplates.renderRelationsWitness({
                minutes: minutes,
                level: indicator.level || "",
                signoffColumns: [
                    nameOnly("معد البيان (وكيل شؤون الطلاب)", firstId(leadership.student_agents), people),
                    nameOnly("رئيس اللجنة", firstId(leadership.counselors), people),
                    nameOnly("يعتمد / مدير المدرسة", firstId(leadership.manager), people)
                ]
            }), {
                pdfTitle: "شاهد العلاقات 1-3-1-1",
                arm: { multiPage: true }
            });
            });
        });
    }

    root.Plan131 = { open: open131, openWitness: openRelationsWitness };
    root.Plan141 = { open: open141, openWitness: openStaffCadreWitness };
    root.Plan146 = { open: open146 };
    root.Plan142 = { open: open142 };
}(window));
