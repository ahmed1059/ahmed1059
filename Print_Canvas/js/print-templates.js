/* نماذج الطباعة فوق نواة الإطار الرسمي.
 * Portrait / Landscape / Card / Table + بطاقة برنامج مضغوطة. */
(function (root) {
    "use strict";

    var KINDS = {
        PORTRAIT_OFFICIAL: "portrait-official",
        PROGRAM_CARD: "program-card",
        LANDSCAPE_OFFICIAL: "landscape-official",
        CARD: "card",
        TABLE: "table"
    };

    function indicatorCodeList(value) {
        if (Array.isArray(value)) {
            if (value.length && value.every(function (item) {
                return typeof item === "string" && item.length === 1;
            })) {
                value = value.join("");
            } else {
                return value.map(function (item) {
                    return String(item || "").trim();
                }).filter(Boolean);
            }
        }
        var text = String(value == null ? "" : value).trim();
        if (!text) {
            return [];
        }
        if (/^[\d\s,،\-–]+$/.test(text) && /[،,]/.test(text)) {
            var compact = text.replace(/[،,\s]/g, "");
            return compact.match(/\d+(?:-\d+){3}/g) || [];
        }
        return text.split(/[،,]+/).map(function (part) {
            return part.trim();
        }).filter(Boolean);
    }

    function cleanIndicatorText(value, fallback) {
        var spare = String(fallback || "").trim();
        if (/[\u0600-\u06FF]/.test(spare)) {
            return spare;
        }
        var codes = indicatorCodeList(value);
        if (codes.length) {
            return codes.join("، ");
        }
        return "";
    }

    function escapeHtml(value) {
        if (root.OfficialFrameCore && root.OfficialFrameCore.escapeHtml) {
            return root.OfficialFrameCore.escapeHtml(value);
        }
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function metaTable(rows) {
        var body = (rows || []).filter(function (row) {
            return row && row.label && String(row.value || "").trim();
        }).map(function (row) {
            return "<tr><th>" + escapeHtml(row.label) + "</th><td>" + escapeHtml(row.value) + "</td></tr>";
        }).join("");
        if (!body) {
            return "";
        }
        return "<table class=\"tpl-meta-table\"><tbody>" + body + "</tbody></table>";
    }

    /** شبكة زوجية مضغوطة: مفتاح/قيمة جنب مفتاح/قيمة. */
    function pairedMeta(rows) {
        var cells = (rows || []).filter(function (row) {
            return row && row.label && String(row.value || "").trim();
        }).map(function (row) {
            return "<div class=\"tpl-pair\">"
                + "<span class=\"tpl-pair-k\">" + escapeHtml(row.label) + "</span>"
                + "<span class=\"tpl-pair-v\">" + escapeHtml(row.value) + "</span>"
                + "</div>";
        }).join("");
        if (!cells) {
            return "";
        }
        return "<div class=\"tpl-pair-grid\">" + cells + "</div>";
    }

    function sectionBlock(title, html) {
        if (!html || !String(html).trim()) {
            return "";
        }
        return "<section class=\"tpl-section\">"
            + (title ? "<h2 class=\"tpl-section-title\">" + escapeHtml(title) + "</h2>" : "")
            + "<div class=\"tpl-section-body\">" + html + "</div>"
            + "</section>";
    }

    function sectionBlockClassed(title, html, sectionClass) {
        if (!html || !String(html).trim()) {
            return "";
        }
        return "<section class=\"tpl-section" + (sectionClass ? (" " + sectionClass) : "") + "\">"
            + (title ? "<h2 class=\"tpl-section-title\">" + escapeHtml(title) + "</h2>" : "")
            + "<div class=\"tpl-section-body\">" + html + "</div>"
            + "</section>";
    }

    function textBlock(text, maxLines) {
        var value = String(text || "").trim();
        if (!value) {
            return "";
        }
        var lines = value.split(/\n+/).filter(Boolean);
        var limit = maxLines > 0 ? maxLines : lines.length;
        var capped = lines.slice(0, limit);
        var html = capped.map(function (line) {
            return "<p class=\"tpl-p\">" + escapeHtml(line) + "</p>";
        }).join("");
        if (lines.length > capped.length) {
            html += "<p class=\"tpl-more\">…</p>";
        }
        return html;
    }

    function evidenceBlock(items, options) {
        options = options || {};
        var maxImages = options.maxImages > 0 ? options.maxImages : 99;
        var centered = !!options.centered;
        var list = [];
        if (root.board1059VisualEvidence && root.board1059VisualEvidence.parseItems) {
            list = root.board1059VisualEvidence.parseItems(items);
        } else if (Array.isArray(items)) {
            list = items;
        }
        if (!list.length) {
            if (options.emptySlot) {
                return sectionBlock(
                    "الشواهد المصورة والمرفقات",
                    "<figure class=\"tpl-evidence-tile is-centered is-empty\"><span>موضع الصورة — يُرفق لاحقاً</span></figure>"
                );
            }
            return sectionBlock(
                "الشواهد المصورة والمرفقات",
                "<p class=\"tpl-empty\">لا مرفقات بصرية محفوظة لهذا البرنامج بعد.</p>"
            );
        }
        var images = list.filter(function (item) {
            return item && item.url && (item.kind === "image" || (!item.kind && !/\.pdf$/i.test(String(item.name || item.url || ""))));
        });
        var pdfs = list.filter(function (item) {
            if (!item || !item.url) {
                return false;
            }
            if (item.kind === "pdf") {
                return true;
            }
            return /\.pdf$/i.test(String(item.name || item.url || ""));
        });
        var others = list.filter(function (item) {
            return item && images.indexOf(item) < 0 && pdfs.indexOf(item) < 0;
        });
        var shownImages = images.slice(0, maxImages);
        var extraCount = Math.max(0, images.length - shownImages.length) + pdfs.length + others.length;
        var tiles = shownImages.map(function (item) {
            return "<figure class=\"tpl-evidence-tile" + (centered ? " is-centered" : "") + "\">"
                + "<img src=\"" + escapeHtml(item.url) + "\" alt=\"" + escapeHtml(item.name || "شاهد") + "\">"
                + "</figure>";
        }).join("");
        var pdfUrl = pdfs[0] && pdfs[0].url ? String(pdfs[0].url) : "";
        var pdfInline = /^(blob:|data:)/i.test(pdfUrl);
        if (!shownImages.length && pdfs.length && pdfInline) {
            tiles = "<figure class=\"tpl-evidence-tile is-centered is-pdf\">"
                + "<iframe src=\"" + escapeHtml(pdfUrl) + "#toolbar=0&navpanes=0&scrollbar=1&view=FitH\" title=\""
                + escapeHtml(pdfs[0].name || "مرفق PDF")
                + "\"></iframe>"
                + "<figcaption>" + escapeHtml(pdfs[0].name || "مرفق PDF") + "</figcaption>"
                + "</figure>";
            extraCount = Math.max(0, pdfs.length - 1) + others.length;
        } else if (!shownImages.length && (pdfs.length || others.length)) {
            var fileItem = pdfs[0] || others[0];
            tiles = "<figure class=\"tpl-evidence-tile is-file\">"
                + "<a href=\"" + escapeHtml(fileItem.url || "") + "\" target=\"_blank\" rel=\"noopener\">"
                + escapeHtml(fileItem.name || fileItem.url)
                + "</a></figure>";
            extraCount = Math.max(0, pdfs.length + others.length - 1);
        }
        var note = extraCount
            ? "<p class=\"tpl-empty\">مرفقات إضافية في النظام (" + extraCount + ").</p>"
            : "";
        return sectionBlock(
            "الشواهد المصورة والمرفقات",
            "<div class=\"tpl-evidence-stack" + (centered ? " is-centered" : "") + "\">" + tiles + "</div>" + note
        );
    }

    function readLeadership() {
        var live = root.AjLeadershipSeats;
        if (live && typeof live === "object") {
            return {
                principal: live.manager || "",
                schoolVice: live.school_affairs_agent || "",
                viceTeachers: live.education_agents || [],
                viceTeachersList: live.education_agents || [],
                studentsVice: live.student_agents || [],
                studentsVices: live.student_agents || [],
                studentCounselor: (live.counselors && live.counselors[0]) || "",
                studentCounselors: live.counselors || [],
                activityLeader: live.activity_leader || "",
                activityLeaders: live.activity_leader ? [live.activity_leader] : [],
                educationalGuide: live.educational_supervisor || "",
                safetySupervisor: live.safety_supervisor || ""
            };
        }
        try {
            return JSON.parse(localStorage.getItem("board1059.leadership") || "null") || {};
        } catch (error) {
            return {};
        }
    }

    function firstStored(data, keys) {
        var stored = "";
        (keys || []).forEach(function (key) {
            if (stored) {
                return;
            }
            var value = data[key];
            if (Array.isArray(value) && value.length) {
                stored = String(value[0] || "").trim();
            } else if (value) {
                stored = String(value).trim();
            }
        });
        return stored;
    }

    function resolvePerson(stored) {
        stored = String(stored || "").trim();
        var id = /^\d{10,}$/.test(stored) ? stored : "";
        var name = "";
        if (stored && root.dataHub && typeof root.dataHub.display === "function") {
            name = String(root.dataHub.display(stored) || "").trim();
        }
        if ((!name || name === stored) && id && root.dataHub && typeof root.dataHub.displayWritten === "function") {
            name = String(root.dataHub.displayWritten(id) || name || "").trim();
        }
        if (!name && stored && !/^\d{10,}$/.test(stored)) {
            name = stored;
        }
        if (name && /^\d{10,}$/.test(name)) {
            name = "";
        }
        return {
            id: id,
            name: name || "",
            signature: id ? ("signatures/sig_" + id + ".png") : ""
        };
    }

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

    function leadershipSeat(roleTitle, keys) {
        var person = resolvePerson(firstStored(readLeadership(), keys));
        return {
            role: roleTitle,
            id: person.id || "",
            name: person.name || ""
        };
    }

    function programExecutorSeat(record) {
        record = record || {};
        if (root.IdentityCore && typeof root.IdentityCore.isSafetyProgram === "function"
            && root.IdentityCore.isSafetyProgram(record.program_name, {
                code: record.code || record.indicator_code,
                domain: record.domain,
                title: record.title
            })) {
            var safety = resolvePerson(firstStored(readLeadership(), ["safetySupervisor"]));
            if (safety.id) {
                return { role: "مشرف الأمن والسلامة", id: safety.id, name: safety.name };
            }
        }
        var id = String(record.executor_id || "").trim();
        var name = String(record.executor_name || "").trim();
        if (!name && record.implementers) {
            name = String(record.implementers).split(/[،,]/)[0].replace(/\s+/g, " ").trim();
        }
        if (!id && !name) {
            var activity = resolvePerson(firstStored(readLeadership(), [
                "activityLeaders", "activityLeader", "activity"
            ]));
            id = activity.id;
            name = activity.name;
        }
        if (id && !name) {
            name = resolvePerson(id).name;
        }
        return { role: "منفّذ البرنامج", id: id, name: name };
    }

    function programViceSeat(record) {
        var roles = (record && record.owner_roles && record.owner_roles.length)
            ? record.owner_roles
            : [(record && record.owner_role) || ""];
        if (roles.indexOf("vice_students") >= 0) {
            return leadershipSeat("وكيل شؤون الطلاب", ["studentsVices", "studentsVice"]);
        }
        if (roles.indexOf("student_counselor") >= 0) {
            return leadershipSeat("الموجه الطلابي", ["studentCounselors", "studentCounselor"]);
        }
        return leadershipSeat("وكيل الشؤون التعليمية", ["viceTeachersList", "viceTeachers"]);
    }

    function programSignoffSeats(record) {
        var seats = [programExecutorSeat(record)];
        var safety = root.IdentityCore && typeof root.IdentityCore.isSafetyProgram === "function"
            && root.IdentityCore.isSafetyProgram(record && record.program_name, {
                code: record && (record.code || record.indicator_code),
                domain: record && record.domain,
                title: record && record.title
            });
        if (!safety) {
            seats.push(programViceSeat(record));
        }
        seats.push(leadershipSeat("مدير المدرسة", ["principal"]));
        return seats.filter(function (seat) {
            return seat && String(seat.id || "").trim();
        });
    }

    function columnsFromSignatureRows(rows) {
        return (rows || []).map(function (row) {
            return {
                role: (row && row.role) || "",
                roleTitle: (row && (row.roleTitle || row.role)) || "",
                name: (row && row.name) || "",
                signature: (row && row.signature) || ""
            };
        });
    }

    function programSignoffColumns(record) {
        record = record || {};
        if (Array.isArray(record.signoffColumns) && record.signoffColumns.length) {
            return record.signoffColumns;
        }
        var seats = programSignoffSeats(record);
        var core = root.SignatureCore;
        if (core && typeof core.resolve === "function") {
            return core.resolve(seats, { headers: sessionHeaders() }).then(columnsFromSignatureRows).catch(function () {
                return columnsFromSignatureRows(seats);
            });
        }
        return columnsFromSignatureRows(seats);
    }

    /** نموذج Portrait Official: نواة + منطقة محتوى مرنة. */
    function renderPortraitOfficial(payload) {
        payload = payload || {};
        if (!root.OfficialFrameCore || typeof root.OfficialFrameCore.page !== "function") {
            return "<p>نواة الإطار الرسمي غير محمّلة.</p>";
        }
        var parts = [];
        if (payload.pairedMeta && payload.pairedMeta.length) {
            parts.push(pairedMeta(payload.pairedMeta));
        } else if (payload.metaRows && payload.metaRows.length) {
            parts.push(metaTable(payload.metaRows));
        }
        (payload.sections || []).forEach(function (section) {
            if (!section) {
                return;
            }
            if (section.html) {
                parts.push(sectionBlockClassed(section.title || "", section.html, section.sectionClass || ""));
            } else if (section.text) {
                parts.push(sectionBlockClassed(
                    section.title || "",
                    textBlock(section.text, section.maxLines),
                    section.sectionClass || ""
                ));
            }
        });
        if (payload.evidenceItems) {
            parts.push(evidenceBlock(payload.evidenceItems, payload.evidenceOptions || {}));
        }
        var portraitBody = "<div class=\"tpl-portrait-body\">" + parts.join("") + "</div>";
        var portraitOpts = {
            strictIdentity: payload.strictIdentity !== false,
            title: payload.title || "",
            bodyHtml: portraitBody,
            page: payload.page || 1,
            total: payload.total || 1,
            signoff: payload.signoff !== false,
            columns: payload.signoffColumns,
            school: payload.school,
            admin: payload.admin,
            frameClass: payload.frameClass || "tpl-portrait-official",
            kind: payload.kind || "",
            grade: payload.grade || "",
            section: payload.section || "",
            specialty: payload.specialty || "",
            programName: payload.programName || (payload.record && payload.record.program_name) || ""
        };
        if (root.PrintMasterCore && typeof root.PrintMasterCore.sheet === "function") {
            return root.PrintMasterCore.sheet(portraitOpts);
        }
        return root.OfficialFrameCore.page(portraitOpts);
    }

    function ownerLabel(record) {
        if (root.IdentityCore && typeof root.IdentityCore.isSafetyProgram === "function"
            && root.IdentityCore.isSafetyProgram(record && record.program_name, {
                code: record && (record.code || record.indicator_code),
                domain: record && record.domain,
                title: record && record.title
            })) {
            var safetyName = String((record && record.executor_name) || "").trim();
            return safetyName ? ("مشرف الأمن والسلامة · " + safetyName) : "مشرف الأمن والسلامة";
        }
        if (record && record.owner_label) {
            return record.owner_label;
        }
        if (record && record.owner_roles && record.owner_roles.length) {
            return record.owner_roles.join("، ");
        }
        return record && record.owner_role ? record.owner_role : "";
    }

    function measureLine(record) {
        var parts = [];
        if (record.baseline_value) {
            parts.push("أساس " + record.baseline_value);
        }
        if (record.current_value) {
            parts.push("حالي " + record.current_value);
        }
        if (record.target_value) {
            parts.push("مستهدف " + record.target_value);
        }
        var line = parts.join(" ← ");
        if (line && record.unit) {
            line += " (" + record.unit + ")";
        }
        return line;
    }

    /** بطاقة برنامج = Portrait Official مضغوط لصفحة واحدة. */
    function renderProgramCard(record, evidenceItems) {
        record = record || {};
        var codes = cleanIndicatorText(
            record.indicator_codes,
            record.executive_goal || record.success_indicator || ""
        );
        var strategic = String(record.strategic_goal || "").trim();
        if (!strategic && root.NarrativeCore && typeof root.NarrativeCore.generateText === "function") {
            strategic = String(root.NarrativeCore.generateText("program.objective", {
                program_name: record.program_name || "",
                domain: record.domain || ""
            }) || "").trim();
        }
        var goals = [strategic, record.executive_goal].filter(Boolean).join("\n");
        var riskText = String(record.risk_management || "").trim();
        var sections = [
            { title: "الأهداف", text: goals, maxLines: 2 },
            { title: "آلية التنفيذ", text: record.mechanism || "", maxLines: 3 },
            { title: "مؤشر النجاح", text: record.success_indicator || "", maxLines: 2 }
        ];
        // المخاطر تُطبع فقط إن كانت قصيرة حتى لا تُخرج البطاقة عن صفحة واحدة
        if (riskText && riskText.length <= 120) {
            sections.push({ title: "إدارة المخاطر", text: riskText, maxLines: 1, sectionClass: "tpl-section-risk" });
        }
        var columns = record.signoffColumns;
        if (!Array.isArray(columns) || !columns.length) {
            var maybe = programSignoffColumns(record);
            columns = (maybe && typeof maybe.then === "function")
                ? columnsFromSignatureRows(programSignoffSeats(record))
                : maybe;
        }
        var payload = {
            title: "بطاقة برنامج مدرسي",
            frameClass: "tpl-portrait-official tpl-program-card",
            pairedMeta: [
                { label: "اسم البرنامج", value: record.program_name || "" },
                { label: "الحالة", value: record.status || "" },
                { label: "السجل", value: record.register_label || "" },
                { label: "صاحب البرنامج", value: ownerLabel(record) },
                { label: "المجال / المستوى", value: [record.domain, record.level_name].filter(Boolean).join(" · ") },
                { label: "هدف الخطة الأم", value: record.goal_ref || "" },
                { label: "المستهدفون", value: record.target_audience || "" },
                { label: "الفترة", value: record.duration || "" },
                { label: "القياس", value: measureLine(record) },
                { label: "المؤشرات", value: codes }
            ],
            sections: sections,
            evidenceItems: evidenceItems || [],
            evidenceOptions: { maxImages: 5, centered: false },
            signoff: true,
            signoffColumns: columns,
            record: record,
            page: 1,
            total: 1
        };
        if (root.PrintCore && typeof root.PrintCore.generate === "function") {
            var generated = root.PrintCore.generate({
                title: payload.title,
                type: "card",
                data: payload,
                seats: record.signoffSeats || [],
                orientation: "portrait"
            });
            if (generated && typeof generated === "object" && generated.html) {
                return generated.html;
            }
            if (typeof generated === "string" && generated) {
                return generated;
            }
        }
        return renderPortraitOfficial(payload);
    }

    function openHtml(html, previewClass) {
        if (!root.OfficialFrameCore || typeof root.OfficialFrameCore.ensureHost !== "function") {
            window.alert("نواة الإطار الرسمي غير محمّلة.");
            return;
        }
        if (root.openPrintPreview) {
            root.openPrintPreview("print-official-core");
        } else {
            document.body.classList.add("is-print-preview", "print-official-core");
        }
        if (previewClass) {
            document.body.classList.add(previewClass);
        }
        var host = root.OfficialFrameCore.ensureHost();
        host.innerHTML = html;
        host.hidden = false;
        return host;
    }

    function openProgramCard(record, evidenceItems, doPrint) {
        record = record || {};
        function show(html) {
            openHtml(html, "print-tpl-program-card");
            var named = document.querySelector("#official-frame-host .pm-document, #aj-print-stage-page .pm-document");
            if (named && named.getAttribute("data-file-name")) {
                document.title = named.getAttribute("data-file-name");
            }
            if (doPrint) {
                window.setTimeout(function () {
                    document.body.classList.add("print-mode", "print-official-core");
                    if (root.PrintMasterCore && typeof root.PrintMasterCore.applyTitle === "function") {
                        var card = document.querySelector(".pm-document");
                        if (card) {
                            root.PrintMasterCore.applyTitle(card.getAttribute("data-file-name"));
                        }
                    }
                    if (root.OfficialFrameCore && typeof root.OfficialFrameCore.armPrintPage === "function") {
                        root.OfficialFrameCore.armPrintPage();
                    }
                    function restore() {
                        document.body.classList.remove("print-mode", "print-tpl-program-card");
                        if (root.closePrintPreview) {
                            root.closePrintPreview();
                        } else if (root.OfficialFrameCore) {
                            root.OfficialFrameCore.hideHost();
                        }
                    }
                    window.addEventListener("afterprint", restore, { once: true });
                    window.print();
                }, 120);
            }
            return html;
        }
        var columns = programSignoffColumns(record);
        if (columns && typeof columns.then === "function") {
            return columns.then(function (resolved) {
                record.signoffColumns = resolved;
                return show(renderProgramCard(record, evidenceItems));
            }).catch(function () {
                return show(renderProgramCard(record, evidenceItems));
            });
        }
        record.signoffColumns = columns;
        return show(renderProgramCard(record, evidenceItems));
    }

    /** Landscape Official — جداول عريضة وصور متعددة على A4 أفقي. */
    function renderLandscapeOfficial(payload) {
        payload = payload || {};
        if (!root.OfficialFrameCore || typeof root.OfficialFrameCore.page !== "function") {
            return "<p>نواة الإطار الرسمي غير محمّلة.</p>";
        }
        var parts = [];
        if (payload.pairedMeta && payload.pairedMeta.length) {
            parts.push(pairedMeta(payload.pairedMeta));
        } else if (payload.metaRows && payload.metaRows.length) {
            parts.push(metaTable(payload.metaRows));
        }
        if (payload.tableHtml) {
            parts.push("<div class=\"tpl-landscape-table-wrap\">" + payload.tableHtml + "</div>");
        } else if (payload.columns && payload.rows) {
            parts.push(dataTableHtml(payload.columns, payload.rows));
        }
        (payload.sections || []).forEach(function (section) {
            if (!section) {
                return;
            }
            if (section.html) {
                parts.push(sectionBlockClassed(section.title || "", section.html, section.sectionClass || ""));
            } else if (section.text) {
                parts.push(sectionBlockClassed(
                    section.title || "",
                    textBlock(section.text, section.maxLines || 4),
                    section.sectionClass || ""
                ));
            }
        });
        if (payload.evidenceItems) {
            parts.push(evidenceBlock(payload.evidenceItems, payload.evidenceOptions || { maxImages: 4 }));
        }
        var landscapeOpts = {
            orientation: "landscape",
            strictIdentity: payload.strictIdentity !== false,
            title: payload.title || "",
            bodyHtml: "<div class=\"tpl-landscape-body\">" + parts.join("") + "</div>",
            page: payload.page || 1,
            total: payload.total || 1,
            signoff: payload.signoff !== false,
            columns: payload.signoffColumns,
            school: payload.school,
            admin: payload.admin,
            frameClass: payload.frameClass || "tpl-landscape-official",
            kind: payload.kind || "",
            grade: payload.grade || "",
            section: payload.section || "",
            specialty: payload.specialty || "",
            programName: payload.programName || (payload.record && payload.record.program_name) || ""
        };
        if (root.PrintMasterCore && typeof root.PrintMasterCore.sheet === "function") {
            return root.PrintMasterCore.sheet(landscapeOpts);
        }
        return root.OfficialFrameCore.page(landscapeOpts);
    }

    /** Card — بطاقة أرشفة سريعة مضغوطة (Portrait). */
    function renderCard(payload) {
        payload = payload || {};
        var sections = (payload.sections || []).map(function (section) {
            if (!section) {
                return section;
            }
            return {
                title: section.title,
                text: section.text,
                html: section.html,
                maxLines: section.maxLines != null ? section.maxLines : 2,
                sectionClass: (section.sectionClass || "") + " tpl-card-section"
            };
        });
        return renderPortraitOfficial({
            title: payload.title || "بطاقة توثيق",
            frameClass: "tpl-portrait-official tpl-card-official",
            pairedMeta: payload.pairedMeta,
            metaRows: payload.metaRows,
            sections: sections,
            evidenceItems: payload.evidenceItems || [],
            evidenceOptions: payload.evidenceOptions || { maxImages: 1, centered: true },
            signoff: payload.signoff !== false,
            signoffColumns: payload.signoffColumns,
            page: 1,
            total: 1,
            school: payload.school,
            admin: payload.admin
        });
    }

    function dataTableHtml(columns, rows, options) {
        options = options || {};
        var serial = options.serial !== false;
        var sourceCols = columns || [];
        var cols = serial ? ["م"].concat(sourceCols) : sourceCols;
        var head = cols.map(function (col) {
            var cls = col === "م" ? " class=\"tpl-serial\"" : "";
            return "<th" + cls + ">" + escapeHtml(col) + "</th>";
        }).join("");
        var body = (rows || []).map(function (row, index) {
            var cells = Array.isArray(row) ? row.slice() : sourceCols.map(function (col) {
                return row && (row[col] != null ? row[col] : "");
            });
            if (serial) {
                cells = [String(index + 1)].concat(cells);
            }
            return "<tr>" + cells.map(function (cell, cellIndex) {
                var cls = serial && cellIndex === 0 ? " class=\"tpl-serial\"" : "";
                return "<td" + cls + ">" + escapeHtml(cell) + "</td>";
            }).join("") + "</tr>";
        }).join("");
        if (!head) {
            return "";
        }
        return "<table class=\"tpl-data-table\"><thead><tr>" + head + "</tr></thead><tbody>"
            + (body || "<tr><td colspan=\"" + cols.length + "\">لا بيانات محفوظة.</td></tr>")
            + "</tbody></table>";
    }

    /**
     * قالب الكشوف السيادي: ترويسة رسمية + عنوان في thead (تتكرر كل صفحة)،
     * مسلسل تلقائي، والتوقيعات بعد الجدول في الصفحة الأخيرة فقط.
     */
    function renderMasterList(payload) {
        payload = payload || {};
        var core = root.OfficialFrameCore;
        if (!core || typeof core.header !== "function") {
            return "<p>نواة الإطار الرسمي غير محمّلة.</p>";
        }
        var sourceCols = payload.columns || [];
        var serial = payload.serial !== false;
        var cols = serial ? ["م"].concat(sourceCols) : sourceCols;
        var rows = payload.rows || [];
        var colHead = cols.map(function (col) {
            var cls = col === "م" ? " class=\"tpl-serial\"" : "";
            return "<th" + cls + ">" + escapeHtml(col) + "</th>";
        }).join("");
        var body = rows.map(function (row, index) {
            var cells = Array.isArray(row) ? row.slice() : sourceCols.map(function (col) {
                return row && (row[col] != null ? row[col] : "");
            });
            if (serial) {
                cells = [String(index + 1)].concat(cells);
            }
            return "<tr>" + cells.map(function (cell, cellIndex) {
                var cls = serial && cellIndex === 0 ? " class=\"tpl-serial\"" : "";
                return "<td" + cls + ">" + escapeHtml(cell) + "</td>";
            }).join("") + "</tr>";
        }).join("");
        if (!body) {
            body = "<tr><td colspan=\"" + Math.max(cols.length, 1) + "\">لا بيانات محفوظة.</td></tr>";
        }
        var table = "<table class=\"tpl-master-sheet tpl-data-table\">"
            + "<thead><tr class=\"tpl-master-cols\">" + colHead + "</tr></thead>"
            + "<tbody>" + body + "</tbody></table>";
        var listOpts = {
            title: payload.title || "كشف رسمي",
            bodyHtml: table,
            signoff: payload.signoff !== false,
            columns: payload.signoffColumns,
            school: payload.school,
            admin: payload.admin,
            frameClass: "tpl-master-list",
            kind: payload.kind || "",
            grade: payload.grade || "",
            section: payload.section || "",
            specialty: payload.specialty || "",
            programName: payload.programName || ""
        };
        if (root.PrintMasterCore && typeof root.PrintMasterCore.sheet === "function") {
            return root.PrintMasterCore.sheet(listOpts);
        }
        return "<article class=\"official-document-frame tpl-master-list\">"
            + core.header({ strictIdentity: true, school: payload.school, admin: payload.admin })
            + table
            + (payload.signoff === false ? "" : core.signoff({
                school: payload.school,
                admin: payload.admin,
                columns: payload.signoffColumns,
                pageLabel: " "
            }))
            + "</article>";
    }

    /** Table — بيانات كثيفة داخل الإطار الرسمي. */
    function renderTable(payload) {
        payload = payload || {};
        var landscape = payload.orientation === "landscape";
        var tableHtml = payload.tableHtml || dataTableHtml(payload.columns, payload.rows, {
            serial: payload.serial
        });
        var noteSection = payload.note
            ? [{ html: "<p class=\"tpl-p\">" + escapeHtml(payload.note) + "</p>" }]
            : [];
        if (landscape) {
            return renderLandscapeOfficial({
                title: payload.title || "سجل رسمي",
                frameClass: "tpl-landscape-official tpl-table-official",
                sections: noteSection,
                tableHtml: tableHtml,
                signoff: payload.signoff !== false,
                signoffColumns: payload.signoffColumns,
                page: payload.page || 1,
                total: payload.total || 1,
                school: payload.school,
                admin: payload.admin
            });
        }
        return renderMasterList(payload);
    }

    function openAndPrint(html, previewClass, armOpts) {
        openHtml(html, previewClass);
        window.setTimeout(function () {
            document.body.classList.add("print-mode", "print-official-core");
            if (root.PrintMasterCore && typeof root.PrintMasterCore.applyTitle === "function") {
                var named = document.querySelector(".pm-document");
                if (named) {
                    root.PrintMasterCore.applyTitle(named.getAttribute("data-file-name"));
                }
            }
            if (root.OfficialFrameCore && typeof root.OfficialFrameCore.armPrintPage === "function") {
                root.OfficialFrameCore.armPrintPage(armOpts || {});
            }
            function restore() {
                document.body.classList.remove("print-mode", previewClass || "");
                document.body.classList.remove("print-official-landscape", "print-official-multi", "print-official-list");
                if (root.closePrintPreview) {
                    root.closePrintPreview();
                } else if (root.OfficialFrameCore) {
                    root.OfficialFrameCore.hideHost();
                }
            }
            window.addEventListener("afterprint", restore, { once: true });
            window.print();
        }, 120);
        return html;
    }

    function planCell(value) {
        return escapeHtml(value == null ? "" : value);
    }

    function planMark(code) {
        return "\u2066" + String(code || "") + "\u2069";
    }

    function planTable(columns, rows, blankClass) {
        var head = (columns || []).map(function (col) {
            return "<th>" + planCell(col) + "</th>";
        }).join("");
        var body = (rows || []).map(function (row) {
            var cls = blankClass ? " class=\"" + blankClass + "\"" : "";
            return "<tr" + cls + ">" + (row || []).map(function (cell) {
                return "<td>" + planCell(cell) + "</td>";
            }).join("") + "</tr>";
        }).join("");
        if (!head) {
            return "";
        }
        return "<table class=\"tpl-data-table\"><thead><tr>" + head + "</tr></thead><tbody>"
            + (body || "<tr><td colspan=\"" + columns.length + "\"></td></tr>")
            + "</tbody></table>";
    }

    function planScoreLine(block) {
        if (!block || typeof block !== "object") {
            return "";
        }
        var parts = [];
        if (block.score != null && block.score !== "") {
            parts.push(String(block.score) + String(block.unit || ""));
        }
        if (block.level) {
            parts.push(String(block.level));
        }
        return parts.join(" · ");
    }

    function planDevRows(metrics) {
        var ext = (metrics && metrics.external_evaluation) || {};
        var nafes = (metrics && metrics.nafes) || {};
        var indicators = (metrics && metrics.indicators) || {};
        var rows = [];
        var environment = ext.environment || {};
        var envBase = planScoreLine(environment);
        var envTarget = environment.domain_target_pct != null && environment.domain_target_pct !== ""
            ? String(environment.domain_target_pct) + "%"
            : "";
        if (envBase || envTarget) {
            rows.push([environment.label || "مجال البيئة المدرسية", envBase, envTarget]);
        }
        ["math", "reading", "science"].forEach(function (key) {
            var block = nafes[key];
            if (!block || block.score == null || block.score === "") {
                return;
            }
            var unit = String(block.unit || "%");
            var target = block.target != null && block.target !== "" ? String(block.target) + unit : "";
            rows.push([block.label || key, String(block.score) + unit, target]);
        });
        ["1-3-1-3", "2-1-1-7", "4-1-1-1", "4-1-1-3"].forEach(function (code) {
            var item = indicators[code];
            if (!item) {
                return;
            }
            var base = [item.level_current, item.score_note].filter(Boolean).join(" · ");
            if (!base && !item.level_target) {
                return;
            }
            rows.push([code + " " + String(item.text || ""), base, item.level_target || ""]);
        });
        var teaching = ext.teaching || {};
        var teachBase = planScoreLine(teaching);
        if (teaching.gap_to_progress_pp != null && teaching.gap_to_progress_pp !== "") {
            teachBase = [teachBase, "الفجوة إلى التقدم " + teaching.gap_to_progress_pp].filter(Boolean).join(" · ");
        }
        if (teachBase) {
            rows.push([
                teaching.label || "مجال التعليم والتعلم",
                teachBase,
                teaching.gap_to_progress_pp != null && teaching.gap_to_progress_pp !== "" ? "التقدم" : ""
            ]);
        }
        return rows;
    }

    function planGoalRows(goals) {
        return (goals || []).map(function (goal) {
            var kpis = (goal.indicators || []).map(function (indicator) {
                return [indicator.kpi, indicator.target, indicator.measurement].filter(Boolean).join(" — ");
            }).filter(Boolean).join("؛ ");
            if (goal.progress) {
                kpis = [kpis, "نسبة محفوظة " + goal.progress].filter(Boolean).join("؛ ");
            }
            return [goal.id || "", goal.domain || "", goal.text || "", kpis];
        }).filter(function (row) {
            return row[2];
        });
    }

    function planProgramCodes(program) {
        var codes = [];
        ["indicator_codes", "bank_indicator_codes"].forEach(function (key) {
            var value = program && program[key];
            if (!Array.isArray(value)) {
                return;
            }
            value.forEach(function (code) {
                var text = String(code || "").trim();
                if (text && codes.indexOf(text) < 0) {
                    codes.push(text);
                }
            });
        });
        return codes;
    }

    function planLinkedPrograms(programs) {
        return (programs || []).filter(function (program) {
            if (!program) {
                return false;
            }
            if (planProgramCodes(program).indexOf("1-1-1-1") >= 0) {
                return true;
            }
            return String(program.goal_ref || "").trim() === "G1";
        });
    }

    /**
     * حزمة 1-1-1-1: صفحات الإطار الرسمي.
     * الأرقام من الخطة ومركز الأداء فقط. صف المتابعة والشاهد يبقى فارغًا.
     */
    function renderPlan111(payload) {
        payload = payload || {};
        if (!root.OfficialFrameCore || typeof root.OfficialFrameCore.page !== "function") {
            return "<p>نواة الإطار الرسمي غير محمّلة.</p>";
        }
        var plan = payload.plan || {};
        var metrics = payload.metrics || {};
        var profile = metrics.school_profile || {};
        var school = payload.school || profile.name || "";
        var admin = payload.admin || profile.education_admin || "";
        var signoffColumns = (payload.signoffColumns || []).filter(function (col) {
            return col && (String(col.name || "").trim() || String(col.id || "").trim());
        });
        if (!signoffColumns.length) {
            signoffColumns = [{ roleTitle: "مدير المدرسة", name: "\u00a0" }];
        }
        var bodies = [];
        var identity = [];
        if (plan.vision) {
            identity.push("<p class=\"tpl-p\"><strong>الرؤية. </strong>" + planCell(plan.vision) + "</p>");
        }
        if (plan.mission) {
            identity.push("<p class=\"tpl-p\"><strong>الرسالة. </strong>" + planCell(plan.mission) + "</p>");
        }
        if (plan.values && plan.values.length) {
            identity.push("<p class=\"tpl-p\"><strong>القيم. </strong>" + planCell(plan.values.join(" · ")) + "</p>");
        }
        if (plan.budget) {
            identity.push("<p class=\"tpl-p\"><strong>الميزانية. </strong>" + planCell(plan.budget) + "</p>");
        }
        bodies.push({
            title: "بطاقة المؤشر 1-1-1-1",
            html: pairedMeta([
                { label: "الرمز", value: "1-1-1-1" },
                { label: "المجال", value: "الإدارة المدرسية" },
                { label: "المعيار", value: "التخطيط" },
                { label: "العام الدراسي", value: plan.academic_year || "" }
            ])
                + sectionBlock("نص المؤشر", "<p class=\"tpl-p\">تضع المدرسة خطة تشغيلية شاملة وفق أهداف تطويرية محددة.</p>")
                + (identity.length ? sectionBlock("هوية الخطة المحفوظة", identity.join("")) : "")
        });
        var devRows = planDevRows(metrics);
        bodies.push({
            title: "الأهداف التطويرية",
            html: "<p class=\"tpl-p\">الخط الأساس والمستهدف من مركز الأداء وخطة التحسين المحفوظة. الخانة بلا رقم تبقى فارغة.</p>"
                + planTable(["الهدف", "خط الأساس", "المستهدف"], devRows)
        });
        var goalRows = planGoalRows(plan.strategic_goals);
        bodies.push({
            title: "الأهداف التشغيلية المحفوظة",
            html: planTable(["الرمز", "المجال", "الهدف", "مؤشر النجاح والمستهدف"], goalRows)
        });
        var linked = planLinkedPrograms(payload.programs);
        if (linked.length) {
            bodies.push({
                title: "برامج المؤشر 1-1-1-1",
                html: planTable(
                    ["البرنامج", "الحالة", "المسؤول", "المدة", "مؤشر النجاح"],
                    linked.map(function (program) {
                        return [
                            program.program_name || "",
                            program.status || "",
                            program.owner_label || "",
                            program.duration || "",
                            program.success_indicator || ""
                        ];
                    })
                )
            });
        }
        var followNote = String(plan.monitoring_plan || "").trim();
        var blank = ["", "", "", "", ""];
        var followRows = [];
        var followIndex = 0;
        for (followIndex = 0; followIndex < 6; followIndex += 1) {
            followRows.push(blank.slice());
        }
        bodies.push({
            title: "سجل متابعة الخطة",
            html: (followNote ? sectionBlock("نص المتابعة المحفوظ", "<p class=\"tpl-p\">" + planCell(followNote) + "</p>") : "")
                + planTable(["التاريخ", "المنجز", "الحالة", "العائق", "القرار"], followRows, "tpl-plan-blank")
        });
        var team = (plan.planning_team || []).filter(function (member) {
            return member && String(member.name || "").trim();
        });
        var teamHtml = team.length
            ? sectionBlock("فريق التخطيط", planTable(["الاسم", "الصفة"], team.map(function (member) {
                return [member.name || "", member.role || ""];
            })))
            : "";
        var evidenceRows = [
            "وثيقة الخطة المعتمدة",
            "محضر إقرار فريق التخطيط",
            "جدول الأهداف التطويرية",
            "سجل المتابعة",
            "محضر تعديل الخطة"
        ].map(function (label) {
            return [label, "", ""];
        });
        bodies.push({
            title: "فهرس الشواهد",
            html: teamHtml + planTable(["البند", "الشاهد", "التاريخ"], evidenceRows, "tpl-plan-blank")
        });
        return planFrames(bodies, signoffColumns, school, admin);
    }

    var PLAN_122_AXES = [
        "عدالة الدرجة وسجل السلوك",
        "صون كرامة الطالب في الصف والممر",
        "سرية الحالة الإرشادية",
        "حد التواصل الرقمي",
        "أمانة الحصة والحضور",
        "تعاون المناوبة والإشراف"
    ];

    /**
     * حزمة 1-2-1-2: قيم مهنة التعليم ومتابعة الالتزام.
     * المستوى من دورة التقويم إن وُجد. النسبة والشواهد لا تُخترع.
     */
    function renderPlan122(payload) {
        payload = payload || {};
        if (!root.OfficialFrameCore || typeof root.OfficialFrameCore.page !== "function") {
            return "<p>نواة الإطار الرسمي غير محمّلة.</p>";
        }
        var plan = payload.plan || {};
        var cycle = payload.cycle || {};
        var indicator = payload.indicator || {};
        var metrics = payload.metrics || {};
        var profile = metrics.school_profile || {};
        var school = payload.school || profile.name || "";
        var admin = payload.admin || profile.education_admin || "";
        var signoffColumns = (payload.signoffColumns || []).filter(function (col) {
            return col && (String(col.name || "").trim() || String(col.id || "").trim());
        });
        if (!signoffColumns.length) {
            signoffColumns = [{ roleTitle: "مدير المدرسة", name: "\u00a0" }];
        }
        var year = cycle.academic_year || plan.academic_year || "";
        var level = String(indicator.level || "").trim();
        var bodies = [];
        var identity = [];
        if (plan.values && plan.values.length) {
            identity.push("<p class=\"tpl-p\"><strong>قيم الخطة المحفوظة. </strong>" + planCell(plan.values.join(" · ")) + "</p>");
        }
        if (level) {
            identity.push("<p class=\"tpl-p\"><strong>خط الأساس. </strong>" + planCell(level) + "</p>");
            identity.push("<p class=\"tpl-p\"><strong>المستهدف. </strong>الاستدامة على " + planCell(level) + "، ثم التميز بشاهد الالتزام. بلا نسبة.</p>");
        }
        bodies.push({
            title: "بطاقة المؤشر \u200E1-2-1-2",
            html: pairedMeta([
                { label: "الرمز", value: "\u200E1-2-1-2" },
                { label: "المجال", value: indicator.domain || "الإدارة المدرسية" },
                { label: "المعيار", value: indicator.standard_name || "قيادة العملية التعليمية" },
                { label: "العام الدراسي", value: year }
            ])
                + sectionBlock("نص المؤشر", "<p class=\"tpl-p\">تطبق المدرسة قيم مهنة التعليم وأخلاقياتها، وتتابع الالتزام بها.</p>")
                + (identity.length ? sectionBlock("المحفوظ", identity.join("")) : "")
        });
        bodies.push({
            title: "أبعاد الالتزام",
            html: "<p class=\"tpl-p\">أبعاد المتابعة في المرحلة المتوسطة. الملاحظة والحالة تُملآن من الواقع.</p>"
                + planTable(
                    ["البعد", "الملاحظة", "الحالة"],
                    PLAN_122_AXES.map(function (axis) {
                        return [axis, "", ""];
                    }),
                    "tpl-plan-blank"
                )
        });
        var linked = (payload.programs || []).filter(function (program) {
            return planProgramCodes(program).indexOf("1-2-1-2") >= 0;
        });
        if (linked.length) {
            bodies.push({
                title: "برامج المؤشر 1-2-1-2",
                html: planTable(
                    ["البرنامج", "الحالة", "المسؤول", "المدة", "مؤشر النجاح"],
                    linked.map(function (program) {
                        return [
                            program.program_name || "",
                            program.status || "",
                            program.owner_label || "",
                            program.duration || "",
                            program.success_indicator || ""
                        ];
                    })
                )
            });
        }
        var followRows = [];
        var followIndex = 0;
        for (followIndex = 0; followIndex < 6; followIndex += 1) {
            followRows.push(["", "", "", "", ""]);
        }
        bodies.push({
            title: "سجل متابعة الالتزام",
            html: "<p class=\"tpl-p\">العينة الشهرية: حصة ومناوبة. العرض الفصلي في مجلس المعلمين بلا أسماء.</p>"
                + planTable(["التاريخ", "نوع العينة", "الحالة", "الملاحظة", "القرار"], followRows, "tpl-plan-blank")
        });
        var evidenceRows = [
            "الميثاق الموقع",
            "عينة الملاحظات",
            "محضر مجلس المعلمين",
            "قرار التكريم أو محضر المخالفة"
        ].map(function (label) {
            return [label, "", ""];
        });
        bodies.push({
            title: "فهرس الشواهد",
            html: planTable(["البند", "الشاهد", "التاريخ"], evidenceRows, "tpl-plan-blank")
        });
        var total = bodies.length;
        return bodies.map(function (body, index) {
            var last = index === total - 1;
            return root.OfficialFrameCore.page({
                strictIdentity: true,
                title: body.title,
                bodyHtml: "<div class=\"tpl-portrait-body\">" + body.html + "</div>",
                page: index + 1,
                total: total,
                signoff: last,
                columns: last ? signoffColumns : [],
                school: school,
                admin: admin,
                frameClass: "tpl-portrait-official tpl-plan-111"
            });
        }).join("");
    }

    var PLAN_131_AXES = [
        "لقاء رائد الفصل الأسبوعي",
        "مجلس طلابي: مقترحان كل فصل وجواب مكتوب",
        "مجتمع تعلم داخل التخصص مرة في الشهر",
        "مسار الخلاف: حوار ثم الوكيل ثم المدير",
        "أسبوع استقبال أول متوسط",
        "نبض المناخ بثلاث عبارات ثابتة"
    ];

    /**
     * حزمة 1-3-1-1: العلاقات داخل المجتمع المدرسي.
     * المستوى من دورة التقويم. نسبة المجال لا تُلصق. الشراكة الخارجية ليست هنا.
     */
    function renderPlan131(payload) {
        payload = payload || {};
        if (!root.OfficialFrameCore || typeof root.OfficialFrameCore.page !== "function") {
            return "<p>نواة الإطار الرسمي غير محمّلة.</p>";
        }
        var plan = payload.plan || {};
        var cycle = payload.cycle || {};
        var indicator = payload.indicator || {};
        var metrics = payload.metrics || {};
        var profile = metrics.school_profile || {};
        var school = payload.school || profile.name || "";
        var admin = payload.admin || profile.education_admin || "";
        var signoffColumns = (payload.signoffColumns || []).filter(function (col) {
            return col && (String(col.name || "").trim() || String(col.id || "").trim());
        });
        if (!signoffColumns.length) {
            signoffColumns = [{ roleTitle: "مدير المدرسة", name: "\u00a0" }];
        }
        var year = cycle.academic_year || plan.academic_year || "";
        var level = String(indicator.level || "").trim();
        var bodies = [];
        var saved = [];
        if (level) {
            var aim = level === "تميز"
                ? "الاستدامة على التميز. بلا نسبة."
                : "الاستدامة على " + level + ". بلا نسبة.";
            saved.push("<p class=\"tpl-p\"><strong>خط الأساس. </strong>" + planCell(level) + "</p>");
            saved.push("<p class=\"tpl-p\"><strong>المستهدف. </strong>" + planCell(aim) + "</p>");
        }
        bodies.push({
            title: "بطاقة المؤشر \u200E1-3-1-1",
            html: pairedMeta([
                { label: "الرمز", value: "\u200E1-3-1-1" },
                { label: "المجال", value: indicator.domain || "الإدارة المدرسية" },
                { label: "المعيار", value: indicator.standard_name || "المجتمع المدرسي" },
                { label: "العام الدراسي", value: year }
            ])
                + sectionBlock("نص المؤشر", "<p class=\"tpl-p\">تعزز المدرسة بناء العلاقات الإيجابية والتعاون في المجتمع المدرسي.</p>")
                + sectionBlock("نطاق المؤشر", "<p class=\"tpl-p\">المجتمع الداخلي: القيادة والمعلمون والطلاب. مشاركة الأسرة والشراكة الخارجية في مؤشريهما.</p>")
                + (saved.length ? sectionBlock("المحفوظ", saved.join("")) : "")
        });
        bodies.push({
            title: "مسارات العلاقة",
            html: "<p class=\"tpl-p\">المسار يُتابع. الحالة تُملأ من الواقع.</p>"
                + planTable(
                    ["المسار", "الملاحظة", "الحالة"],
                    PLAN_131_AXES.map(function (axis) {
                        return [axis, "", ""];
                    }),
                    "tpl-plan-blank"
                )
        });
        var linked = (payload.programs || []).filter(function (program) {
            return planProgramCodes(program).indexOf("1-3-1-1") >= 0;
        });
        if (linked.length) {
            bodies.push({
                title: "برامج المؤشر \u200E1-3-1-1",
                html: planTable(
                    ["البرنامج", "الحالة", "المسؤول", "المدة", "مؤشر النجاح"],
                    linked.map(function (program) {
                        return [
                            program.program_name || "",
                            program.status || "",
                            program.owner_label || "",
                            program.duration || "",
                            program.success_indicator || ""
                        ];
                    })
                )
            });
        }
        var phraseRows = [["", "", ""], ["", "", ""], ["", "", ""]];
        var followRows = [];
        var followIndex = 0;
        for (followIndex = 0; followIndex < 4; followIndex += 1) {
            followRows.push(["", "", "", ""]);
        }
        bodies.push({
            title: "نبض المناخ والمتابعة",
            html: "<p class=\"tpl-p\">العبارات الثلاث تبقى ثابتة حتى تُقارَن الفصول. الهبوط عن الفصل السابق يفتح إجراءً.</p>"
                + planTable(["العبارة", "نتيجة الطلاب", "نتيجة المعلمين"], phraseRows, "tpl-plan-blank")
                + planTable(["التاريخ", "اللقاء", "الحالة", "القرار"], followRows, "tpl-plan-blank")
        });
        var evidenceRows = [
            "سجل لقاء رواد الفصول",
            "محضر المجلس الطلابي وجواب المقترح",
            "محضر مجتمع التعلم",
            "نتيجة نبض المناخ"
        ].map(function (label) {
            return [label, "", ""];
        });
        bodies.push({
            title: "فهرس الشواهد",
            html: planTable(["البند", "الشاهد", "التاريخ"], evidenceRows, "tpl-plan-blank")
        });
        var total = bodies.length;
        return bodies.map(function (body, index) {
            var last = index === total - 1;
            return root.OfficialFrameCore.page({
                strictIdentity: true,
                title: body.title,
                bodyHtml: "<div class=\"tpl-portrait-body\">" + body.html + "</div>",
                page: index + 1,
                total: total,
                signoff: last,
                columns: last ? signoffColumns : [],
                school: school,
                admin: admin,
                frameClass: "tpl-portrait-official tpl-plan-111"
            });
        }).join("");
    }

    /**
     * شاهدا 1-3-1-1 من المحاضر المحفوظة فقط.
     * الإجراء الذي لا محضر له لا يُطبع كأنه نُفّذ.
     */
    function renderRelationsWitness(payload) {
        payload = payload || {};
        var minutes = Array.isArray(payload.minutes) ? payload.minutes : [];
        var columns = payload.signoffColumns || [
            { roleTitle: "معد البيان (وكيل شؤون الطلاب)", name: "………………" },
            { roleTitle: "رئيس اللجنة", name: "………………" },
            { roleTitle: "يعتمد / مدير المدرسة", name: "………………" }
        ];
        function sheet(title, body, fileName) {
            if (root.PrintMasterCore && typeof root.PrintMasterCore.sheet === "function") {
                return root.PrintMasterCore.sheet({
                    strictIdentity: true,
                    title: title,
                    bodyHtml: body,
                    signoff: true,
                    columns: columns,
                    frameClass: "tpl-portrait-official tpl-relations",
                    kind: "document",
                    fileName: fileName || "شاهد_العلاقات_1-3-1-1"
                });
            }
            return root.OfficialFrameCore.page({
                strictIdentity: true,
                title: title,
                bodyHtml: body,
                signoff: true,
                columns: columns,
                frameClass: "tpl-portrait-official tpl-relations"
            });
        }
        function peopleTable(present) {
            var rows = (present || []).map(function (person) {
                return [person.name || "", person.role || ""];
            });
            if (!rows.length) {
                rows = [["", ""]];
            }
            return planTable(["الاسم", "الصفة"], rows, rows[0][0] ? "" : "tpl-plan-blank");
        }
        var indexRows = minutes.map(function (item) {
            return [item.agenda || "", item.hijri || "", item.gregorian || ""];
        });
        if (!indexRows.length) {
            indexRows = [["", "", ""]];
        }
        var cover = "<p class=\"tpl-p\">المجال 1 الإدارة المدرسية · المعيار المجتمع المدرسي · المؤشر "
            + planMark("1-3-1-1")
            + "</p>"
            + "<p class=\"tpl-p\">تعزز المدرسة بناء العلاقات الإيجابية والتعاون في المجتمع المدرسي.</p>"
            + (payload.level ? "<p class=\"tpl-p\">المستوى المحفوظ: " + planCell(payload.level) + "</p>" : "")
            + sectionBlock(
                "الشواهد المحفوظة",
                planTable(["الموضوع", "التاريخ الهجري", "التاريخ الميلادي"], indexRows, indexRows[0][0] ? "" : "tpl-plan-blank")
            )
            + "<p class=\"tpl-p\">يُطبع المحضر المحفوظ فقط. إجراءات بنك الخطط التي بلا محضر لا تُذكر هنا.</p>";
        var pages = [sheet("شاهد العلاقات الإيجابية", cover, "شاهد_العلاقات_1-3-1-1")];
        minutes.forEach(function (item) {
            var body = "<p class=\"tpl-p\">المؤشر " + planMark("1-3-1-1")
                + " · تعزز المدرسة بناء العلاقات الإيجابية والتعاون في المجتمع المدرسي.</p>"
                + "<p class=\"tpl-p\">التاريخ: " + planCell(item.hijri || "") + " · " + planCell(item.gregorian || "") + "</p>"
                + sectionBlock("الموضوع", "<p class=\"tpl-p\">" + planCell(item.agenda || "") + "</p>")
                + sectionBlock("الحاضرون", peopleTable(item.present))
                + sectionBlock("القرار", "<p class=\"tpl-p\">" + planCell(item.decisions || "").replace(/\n/g, "<br>") + "</p>")
                + sectionBlock("نص المحضر", "<p class=\"tpl-p\">" + planCell(item.minutes || "").replace(/\n/g, "<br>") + "</p>");
            if (item.followHijri || item.followGregorian) {
                body += "<p class=\"tpl-p\">تاريخ المتابعة المحفوظ: " + planCell(item.followHijri || "")
                    + " · " + planCell(item.followGregorian || "") + "</p>";
            }
            pages.push(sheet(item.agenda || "محضر شاهد", body, "شاهد_علاقات_" + String(item.id || "محضر")));
        });
        return pages.join("");
    }

    function planFrames(bodies, signoffColumns, school, admin) {
        var list = bodies || [];
        if (root.PrintMasterCore && typeof root.PrintMasterCore.sheet === "function") {
            var inner = list.map(function (body, index) {
                var html = "<div class=\"tpl-portrait-body\">" + (body.html || "") + "</div>";
                if (index === 0) {
                    return html;
                }
                return sectionBlock(body.title || "", html);
            }).join("");
            return root.PrintMasterCore.sheet({
                strictIdentity: true,
                title: (list[0] && list[0].title) || "",
                bodyHtml: inner,
                signoff: true,
                columns: signoffColumns,
                school: school,
                admin: admin,
                frameClass: "tpl-portrait-official tpl-plan-111",
                kind: "document"
            });
        }
        var total = list.length;
        return list.map(function (body, index) {
            var last = index === total - 1;
            return root.OfficialFrameCore.page({
                strictIdentity: true,
                title: body.title,
                bodyHtml: "<div class=\"tpl-portrait-body\">" + body.html + "</div>",
                page: index + 1,
                total: total,
                signoff: last,
                columns: last ? signoffColumns : [],
                school: school,
                admin: admin,
                frameClass: "tpl-portrait-official tpl-plan-111"
            });
        }).join("");
    }

    function planSignoff(columns) {
        var kept = (columns || []).filter(function (col) {
            return col && (String(col.name || "").trim() || String(col.id || "").trim());
        });
        if (!kept.length) {
            return [{ roleTitle: "مدير المدرسة", name: "\u00a0" }];
        }
        return kept;
    }

    function planChunks(rows, size) {
        var pages = [];
        var index = 0;
        var list = rows || [];
        if (!list.length) {
            return [[]];
        }
        for (index = 0; index < list.length; index += size) {
            pages.push(list.slice(index, index + size));
        }
        return pages;
    }

    function planIsTeacher(role) {
        return String(role || "").split("،").some(function (part) {
            var title = part.trim();
            if (!title || title.indexOf("وكيل") >= 0 || title.indexOf("مدير") >= 0) {
                return false;
            }
            return title === "معلم" || title.indexOf("معلم ") === 0;
        });
    }

    function planTeacherRows(people) {
        return (people || []).filter(function (person) {
            return person && person.name && person.active !== false && planIsTeacher(person.role);
        }).map(function (person) {
            return ["", person.name || "", "", person.specialty || "", "", "", "", ""];
        });
    }

    function planStaffName(people, id) {
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

    function planIdList(value) {
        if (Array.isArray(value)) {
            return value.map(function (item) {
                return String(item || "").trim();
            }).filter(Boolean);
        }
        var one = String(value || "").trim();
        return one ? [one] : [];
    }

    function planContext(payload) {
        payload = payload || {};
        var metrics = payload.metrics || {};
        var profile = metrics.school_profile || {};
        return {
            plan: payload.plan || {},
            cycle: payload.cycle || {},
            indicator: payload.indicator || {},
            metrics: metrics,
            people: payload.people || [],
            programs: payload.programs || [],
            leadership: payload.leadership || {},
            school: payload.school || profile.name || "",
            admin: payload.admin || profile.education_admin || "",
            columns: planSignoff(payload.signoffColumns),
            year: (payload.cycle && payload.cycle.academic_year) || (payload.plan && payload.plan.academic_year) || ""
        };
    }

    var PLAN_141_HEAD = ["المادة", "المعلم", "المؤهل", "التخصص", "الصفوف", "النصاب", "المطابقة", "الفجوة"];

    /**
     * حزمة 1-4-1-1: إسناد الكادر التعليمي ومؤهله.
     * مستوى الرخصة في ملف الدورة لا يُلصق هنا. التطوير والرخصة رمزاهما الآخران.
     */
    function renderPlan141(payload) {
        if (!root.OfficialFrameCore || typeof root.OfficialFrameCore.page !== "function") {
            return "<p>نواة الإطار الرسمي غير محمّلة.</p>";
        }
        var ctx = planContext(payload);
        var bodies = [];
        bodies.push({
            title: "بطاقة المؤشر " + planMark("1-4-1-1"),
            html: pairedMeta([
                { label: "الرمز", value: planMark("1-4-1-1") },
                { label: "المجال", value: "الإدارة المدرسية" },
                { label: "المعيار", value: "التطوير المؤسسي" },
                { label: "العام الدراسي", value: ctx.year }
            ])
                + sectionBlock("نص المؤشر", "<p class=\"tpl-p\">توفر المدرسة كادرًا تعليميًّا مكتملاً ومؤهلاً بما يتسق مع المهام الموكلة له.</p>")
                + sectionBlock("نطاق المؤشر", "<p class=\"tpl-p\">الإسناد والمؤهل. التطوير المهني في " + planMark("1-4-1-5") + "، والرخصة المهنية في " + planMark("1-4-1-4") + ". ملف الدورة يضع الرخصة تحت رقم آخر، فلا يُنقل مستواها إلى هنا.</p>")
                + sectionBlock("المحفوظ", "<p class=\"tpl-p\">لا درجة محفوظة تحت هذا النص. خانة المستوى فارغة.</p>")
        });
        var teachers = planTeacherRows(ctx.people);
        planChunks(teachers.length ? teachers : [["", "", "", "", "", "", "", ""]], 10).forEach(function (rows, index) {
            bodies.push({
                title: "مصفوفة الإسناد",
                html: (index === 0
                    ? "<p class=\"tpl-p\">التخصص أصل الإسناد. المطابقة والفجوة تُملآن من الواقع. الخانة بلا اسم تبقى فارغة.</p>"
                    : "")
                    + planTable(PLAN_141_HEAD, rows, teachers.length ? "" : "tpl-plan-blank")
            });
        });
        bodies.push({
            title: "الاستثناء والشاغر والمعلم الجديد",
            html: "<p class=\"tpl-p\">الاستثناء مسوغ مكتوب وله نهاية. شاغر يتجاوز أسبوعين يُصعَّد. المعلم الجديد: مرافق، ثم زيارة، ثم مراجعة.</p>"
                + planTable(
                    ["المعلم", "المسوغ", "تاريخ النهاية"],
                    [["", "", ""], ["", "", ""], ["", "", ""]],
                    "tpl-plan-blank"
                )
                + planTable(
                    ["المادة أو التخصص", "بداية الشاغر", "جهة التصعيد"],
                    [["", "", ""], ["", "", ""]],
                    "tpl-plan-blank"
                )
                + planTable(
                    ["المحطة", "المعلم", "الزميل أو الزائر", "الملاحظة", "التاريخ"],
                    [
                        ["الأسبوع الأول: زميل مرافق", "", "", "", ""],
                        ["الأسبوع الرابع: زيارة", "", "", "", ""],
                        ["الأسبوع الثامن: مراجعة", "", "", "", ""]
                    ],
                    "tpl-plan-blank"
                )
        });
        bodies.push({
            title: "فهرس الشواهد",
            html: planTable(
                ["البند", "الشاهد", "التاريخ"],
                ["سجل الإسناد", "مسوغ الاستثناء", "خطاب تصعيد الشاغر", "متابعة المعلم الجديد"].map(function (label) {
                    return [label, "", ""];
                }),
                "tpl-plan-blank"
            )
        });
        return planFrames(bodies, ctx.columns, ctx.school, ctx.admin);
    }

    /**
     * شاهد 1-4-1-1: بيان حصر الكادر. الأسماء والأعداد تبقى فارغة حتى تُزوَّد.
     * الترويسة الرسمية لا تُستبدل. حزمة الخطة renderPlan141 تبقى كما هي.
     */
    function renderStaffCadreWitness(payload) {
        payload = payload || {};
        var given = Array.isArray(payload.rows) ? payload.rows : [];
        var rows = [];
        var index;
        if (given.length) {
            given.forEach(function (row, rowIndex) {
                var cells = Array.isArray(row) ? row : [];
                rows.push([
                    String(rowIndex + 1),
                    cells[0] || "",
                    cells[1] || "",
                    cells[2] || "",
                    cells[3] || "",
                    cells[4] || "",
                    cells[5] || "",
                    cells[6] || "☐ متسق تمامًا"
                ]);
            });
        } else {
            for (index = 1; index <= 10; index += 1) {
                rows.push([String(index), "", "", "", "", "", "", "☐ متسق تمامًا"]);
            }
        }
        var counts = payload.summary || {};
        var classCount = counts.classes ? planCell(counts.classes) : "…………";
        var needCount = counts.need ? planCell(counts.need) : "…………";
        var actualCount = counts.actual ? planCell(counts.actual) : "…………";
        var percentCount = counts.percent ? planCell(counts.percent) : "………… ٪";
        var summary = "<table class=\"tpl-data-table\"><tbody>"
            + "<tr><td>إجمالي الفصول المعتمدة</td><td>" + classCount + "</td><td>الاحتياج الفعلي للكادر التعليمي</td><td>" + needCount + "</td></tr>"
            + "<tr><td>العدد الفعلي الموجود على رأس العمل</td><td>" + actualCount + "</td><td>نسبة اكتمال الكادر التعليمي</td><td>" + percentCount + "</td></tr>"
            + "<tr><td colspan=\"4\">☐ مكتمل بنسبة 100٪ &nbsp;&nbsp; ☐ يوجد عجز وتم رفعه رسميًا بتاريخ …… / …… / 1448هـ</td></tr>"
            + "</tbody></table>";
        var procedures = "<ol class=\"tpl-p\">"
            + "<li>الاستناد إلى البيانات الرسمية: تم حصر مؤهلات وتخصصات جميع أعضاء الهيئة التعليمية من واقع ملفاتهم الرسمية وبيانات نظام فارس ونور قبل بداية العام الدراسي.</li>"
            + "<li>إسناد المواد وفق التخصص: أُسندت المواد الدراسية للمعلمين المتخصصين فيها بنسبة (….. ٪).</li>"
            + "<li>توزيع المهام المساندة واللجان: روعي عند التكليف بالمهام الإضافية (الإشراف، الريادة، لجان التميز، النشاط، الموهوبين) توافقها مع الخبرة والدورات، مع قرارات تكليف رسمية.</li>"
            + "<li>معالجة الفجوات إن وُجدت: عند عجز طارئ يُرفع طلب الاحتياج لإدارة التعليم ويُسد العجز مؤقتًا وفق الضوابط.</li>"
            + "</ol>";
        var attachments = "<ul class=\"tpl-p\">"
            + "<li>صورة من التشكيل المدرسي المعتمد من نور.</li>"
            + "<li>صورة من جدول الحصص العام المعتمد.</li>"
            + "<li>نماذج من قرارات التكليف بالمهام واللجان.</li>"
            + "</ul>";
        var body = "<p class=\"tpl-p\">المجال 1 الإدارة المدرسية · المعيار 1-4 التطوير المؤسسي · المؤشر "
            + planMark("1-4-1-1")
            + "</p>"
            + "<p class=\"tpl-p\">توفر المدرسة كادرًا تعليميًّا مكتملاً ومؤهلاً بما يتسق مع المهام الموكلة له.</p>"
            + "<p class=\"tpl-p\">العام الدراسي: 1448هـ · الفصل الدراسي: ………… · تاريخ الإعداد: …… / …… / 1448هـ</p>"
            + sectionBlock("بيانات التشكيل المدرسي ونسبة الاكتمال", summary)
            + sectionBlock(
                "سجل مطابقة المؤهلات والتخصصات",
                planTable(
                    ["م", "اسم المعلم", "المؤهل", "التخصص", "المادة المسندة", "المهام الإضافية", "النصاب", "مدى الاتساق"],
                    rows,
                    given.length ? "" : "tpl-plan-blank"
                )
            )
            + "<div class=\"tpl-pair-grid\">"
            + sectionBlock("الإجراءات المنفذة لضمان الاتساق", procedures)
            + sectionBlock("المرفقات الداعمة للشاهد", attachments)
            + "</div>";
        var columns = payload.signoffColumns || [
            { roleTitle: "معد البيان (وكيل الشؤون التعليمية)", name: "………………" },
            { roleTitle: "رئيس لجنة التميز والجودة", name: "………………" },
            { roleTitle: "يعتمد / مدير المدرسة", name: "………………" }
        ];
        if (root.PrintMasterCore && typeof root.PrintMasterCore.sheet === "function") {
            return root.PrintMasterCore.sheet({
                strictIdentity: true,
                orientation: "landscape",
                title: "بيان حصر الكادر التعليمي ومطابقة المؤهلات العلمية للمهام الموكلة",
                bodyHtml: body,
                signoff: true,
                columns: columns,
                school: payload.school,
                admin: payload.admin,
                frameClass: "tpl-portrait-official tpl-staff-cadre",
                kind: "document",
                fileName: "شاهد_الكادر_التعليمي_1-4-1-1"
            });
        }
        return root.OfficialFrameCore.page({
            strictIdentity: true,
            title: "بيان حصر الكادر التعليمي ومطابقة المؤهلات العلمية للمهام الموكلة",
            bodyHtml: body,
            signoff: true,
            columns: columns,
            school: payload.school,
            admin: payload.admin,
            frameClass: "tpl-portrait-official tpl-staff-cadre"
        });
    }

    function planLevelCounts(indicators) {
        var counts = {};
        (indicators || []).forEach(function (item) {
            var level = String((item && item.level) || "").trim();
            if (!level) {
                return;
            }
            counts[level] = (counts[level] || 0) + 1;
        });
        var parts = [];
        ["تميز", "تقدم", "انطلاق", "تهيئة"].forEach(function (level) {
            if (!counts[level]) {
                return;
            }
            parts.push(String(counts[level]) + " " + level);
            delete counts[level];
        });
        Object.keys(counts).forEach(function (level) {
            parts.push(String(counts[level]) + " " + level);
        });
        return parts.join("، ");
    }

    /**
     * حزمة 1-4-1-6: التقويم الذاتي.
     * النص في ملف الدورة تحت 1-4-1-3. درجة المجال لا تُطبع. الرمز المطبوع رمز الدليل.
     */
    function renderPlan146(payload) {
        if (!root.OfficialFrameCore || typeof root.OfficialFrameCore.page !== "function") {
            return "<p>نواة الإطار الرسمي غير محمّلة.</p>";
        }
        var ctx = planContext(payload);
        var indicators = payload.indicators || [];
        var saved = [];
        var level = String(ctx.indicator.level || "").trim();
        var legacy = String(ctx.indicator.code || "").trim();
        if (level) {
            saved.push("<p class=\"tpl-p\"><strong>مستوى النص في ملف الدورة. </strong>" + planCell(level) + "</p>");
        }
        if (legacy && legacy !== "1-4-1-6") {
            saved.push("<p class=\"tpl-p\"><strong>رمز النص في ملف الدورة. </strong>" + planCell(planMark(legacy)) + ". الرمز المطبوع رمز الدليل.</p>");
        }
        var overall = ((ctx.metrics.external_evaluation || {}).overall) || {};
        if (overall.score != null && overall.score !== "") {
            saved.push("<p class=\"tpl-p\"><strong>الدرجة الكلية للتقرير الخارجي. </strong>" + planCell(planScoreLine(overall)) + "</p>");
        }
        var spread = planLevelCounts(indicators);
        if (spread) {
            saved.push("<p class=\"tpl-p\"><strong>توزيع المستويات المحفوظة. </strong>" + planCell(spread) + "</p>");
        }
        saved.push("<p class=\"tpl-p\">درجة هذا المؤشر فارغة. درجة المجال لا تُلصق به.</p>");
        if (level) {
            var aim = level === "تميز"
                ? "الاستدامة على التميز. بلا نسبة."
                : "الاستدامة على " + level + ". بلا نسبة.";
            saved.push("<p class=\"tpl-p\"><strong>المستهدف. </strong>" + planCell(aim) + "</p>");
        }
        var bodies = [];
        bodies.push({
            title: "بطاقة المؤشر " + planMark("1-4-1-6"),
            html: pairedMeta([
                { label: "الرمز", value: planMark("1-4-1-6") },
                { label: "المجال", value: "الإدارة المدرسية" },
                { label: "المعيار", value: "التطوير المؤسسي" },
                { label: "العام الدراسي", value: ctx.year }
            ])
                + sectionBlock("نص المؤشر", "<p class=\"tpl-p\">تطبق المدرسة التقويم الذاتي المبنيّ على المعايير المعتمدة من الهيئة بشكل مستمر.</p>")
                + sectionBlock("نطاق المؤشر", "<p class=\"tpl-p\">الفريق لا يعيد كتابة المعايير. لكل مؤشر مالك وبطاقة حكم. لا يُرفع مستوى إلا باجتماع الوثيقة والملاحظة وصوت المستفيد.</p>")
                + sectionBlock("المحفوظ", saved.join(""))
        });
        var judgment = (indicators || []).filter(function (item) {
            return item && String(item.code || "").trim();
        }).map(function (item) {
            return [planMark(String(item.code).trim()), item.level || "", "", "", "", ""];
        });
        planChunks(judgment.length ? judgment : [["", "", "", "", "", ""]], 12).forEach(function (rows, index) {
            bodies.push({
                title: "بطاقات الحكم",
                html: (index === 0
                    ? "<p class=\"tpl-p\">المستوى من الدورة المحفوظة. المالك والشاهد والفجوة والإجراء يُملأون من الواقع. المراجعة الفصلية لمن تغيّر شاهده، والحكم السنوي للمجموعة.</p>"
                    : "")
                    + planTable(["الرمز", "المستوى", "المالك", "الشاهد", "الفجوة", "الإجراء"], rows, "tpl-plan-blank")
            });
        });
        bodies.push({
            title: "متابعة الحكم",
            html: "<p class=\"tpl-p\">إن خالف الحكم الذاتي التقرير الخارجي يُكتب سبب الفرق. محضر مشاركة النتائج جزء من المؤشر.</p>"
                + planTable(
                    ["التاريخ", "النطاق", "الحالة", "القرار"],
                    [["", "", "", ""], ["", "", "", ""], ["", "", "", ""], ["", "", "", ""]],
                    "tpl-plan-blank"
                )
        });
        bodies.push({
            title: "فهرس الشواهد",
            html: planTable(
                ["البند", "الشاهد", "التاريخ"],
                ["بطاقة الحكم", "محضر مشاركة النتائج", "سبب الفرق عن التقرير الخارجي", "خطة التحسين"].map(function (label) {
                    return [label, "", ""];
                }),
                "tpl-plan-blank"
            )
        });
        return planFrames(bodies, ctx.columns, ctx.school, ctx.admin);
    }

    var PLAN_142_ROLES = [
        { key: "manager", title: "مدير المدرسة" },
        { key: "education_agents", title: "وكيل الشؤون التعليمية" },
        { key: "student_agents", title: "وكيل شؤون الطلاب" },
        { key: "school_affairs_agent", title: "وكيل الشؤون المدرسية" },
        { key: "counselors", title: "الموجه الطلابي" },
        { key: "activity_leader", title: "رائد النشاط" },
        { key: "librarian", title: "أمين المصادر" },
        { key: "lab_tech", title: "محضر المختبر" },
        { key: "safety_supervisor", title: "مشرف السلامة" }
    ];

    /**
     * حزمة 1-4-1-2: الكادر الإداري.
     * مستوى التطوير المهني في ملف الدورة لا يُلصق هنا. الشاغر يبقى بلا اسم.
     */
    function renderPlan142(payload) {
        if (!root.OfficialFrameCore || typeof root.OfficialFrameCore.page !== "function") {
            return "<p>نواة الإطار الرسمي غير محمّلة.</p>";
        }
        var ctx = planContext(payload);
        var rows = [];
        PLAN_142_ROLES.forEach(function (role) {
            var ids = planIdList(ctx.leadership[role.key]);
            if (!ids.length) {
                rows.push([role.title, "", "", "", ""]);
                return;
            }
            ids.forEach(function (id) {
                rows.push([role.title, planStaffName(ctx.people, id), "", "", ""]);
            });
        });
        var bodies = [];
        bodies.push({
            title: "بطاقة المؤشر " + planMark("1-4-1-2"),
            html: pairedMeta([
                { label: "الرمز", value: planMark("1-4-1-2") },
                { label: "المجال", value: "الإدارة المدرسية" },
                { label: "المعيار", value: "التطوير المؤسسي" },
                { label: "العام الدراسي", value: ctx.year }
            ])
                + sectionBlock("نص المؤشر", "<p class=\"tpl-p\">توفر المدرسة كادرًا إداريًّا مكتملاً ومؤهلاً بما يتسق مع المهام الموكلة له.</p>")
                + sectionBlock("نطاق المؤشر", "<p class=\"tpl-p\">التشكيل المحفوظ. التكليف المؤقت له نهاية ولا يُعامل شغلًا دائمًا. التطوير المهني في ملف الدورة تحت رقم آخر، فلا يُنقل مستواه إلى هنا.</p>")
                + sectionBlock("المحفوظ", "<p class=\"tpl-p\">لا درجة محفوظة تحت هذا النص. خانة المستوى فارغة. دور بلا اسم يبقى عنوانه بلا شاغل.</p>")
        });
        bodies.push({
            title: "تغطية الأدوار",
            html: "<p class=\"tpl-p\">الأسماء من التشكيل وسجل المنسوبين. المؤهل والبديل ونهاية التكليف تُملأ من الواقع.</p>"
                + planTable(["الدور", "الشاغل", "المؤهل", "البديل", "نهاية التكليف"], rows)
        });
        var taskRows = [];
        var taskIndex = 0;
        for (taskIndex = 0; taskIndex < 8; taskIndex += 1) {
            taskRows.push(["", "", "", ""]);
        }
        bodies.push({
            title: "مهام الدور",
            html: "<p class=\"tpl-p\">ثماني مهام في حدها الأعلى لكل دور. الغاية والشاهد والمرجع لا تُكتب بلا محفوظ.</p>"
                + planTable(["الدور", "المهمة", "الشاهد", "المرجع"], taskRows, "tpl-plan-blank")
        });
        bodies.push({
            title: "فهرس الشواهد",
            html: planTable(
                ["البند", "الشاهد", "التاريخ"],
                ["تشكيل الأدوار", "قرار التكليف المؤقت", "وصف المهام", "تعميد البديل"].map(function (label) {
                    return [label, "", ""];
                }),
                "tpl-plan-blank"
            )
        });
        return planFrames(bodies, ctx.columns, ctx.school, ctx.admin);
    }

    function renderRemedialPlan(data, schema) {
        if (root.FormFillEngine && typeof root.FormFillEngine.buildPrintPayload === "function"
            && typeof root.FormFillEngine.openPrint === "function") {
            return root.FormFillEngine.openPrint(schema || { title: "خطة علاجية فردية", print: { title: "خطة علاجية فردية" } }, data || {}, false);
        }
        return renderPortraitOfficial({
            title: (data && data.values && data.values.report_title) || "خطة علاجية فردية",
            pairedMeta: [
                { label: "اسم الطالب", value: data && data.values && data.values.student_name || "" },
                { label: "المادة", value: data && data.values && data.values.subject || "" }
            ],
            sections: [{ title: "ملاحظات", text: data && data.values && data.values.notes || "" }],
            evidenceItems: data && data.evidence || []
        });
    }

    root.PrintTemplates = {
        KINDS: KINDS,
        renderPortraitOfficial: renderPortraitOfficial,
        renderProgramCard: renderProgramCard,
        renderLandscapeOfficial: renderLandscapeOfficial,
        renderCard: renderCard,
        renderTable: renderTable,
        renderMasterList: renderMasterList,
        renderRemedialPlan: renderRemedialPlan,
        renderPlan111: renderPlan111,
        renderPlan122: renderPlan122,
        renderPlan131: renderPlan131,
        renderRelationsWitness: renderRelationsWitness,
        renderPlan141: renderPlan141,
        renderStaffCadreWitness: renderStaffCadreWitness,
        renderPlan146: renderPlan146,
        renderPlan142: renderPlan142,
        openProgramCard: openProgramCard,
        openAndPrint: openAndPrint,
        openHtml: openHtml,
        metaTable: metaTable,
        pairedMeta: pairedMeta,
        dataTableHtml: dataTableHtml,
        evidenceBlock: evidenceBlock,
        programSignoffColumns: programSignoffColumns,
        cleanIndicatorText: cleanIndicatorText
    };
}(window));
