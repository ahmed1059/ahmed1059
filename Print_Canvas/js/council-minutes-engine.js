/* محرك صياغة محضر المجالس — صياغة قانونية إدارية تتكيّف مع نوع اللجنة */
(function (root) {
    "use strict";

    var WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

    /** ربط نوع المجلس بتشكيل اللجنة في API وبسجل النظام المناسب */
    var PROFILES = {
        admin: {
            voice: "اللجنة",
            label: "اللجنة الإدارية",
            formationIds: ["admin", "partnership"],
            registerKey: "leadership",
            registerLabel: "سجل القيادة والإدارة المدرسية",
            opener: "اجتمعت اللجنة الإدارية",
            closeVoice: "اللجنة"
        },
        guidance: {
            voice: "اللجنة",
            label: "لجنة التوجيه والإرشاد",
            formationIds: ["guidance"],
            registerKey: "behavior",
            registerLabel: "سجل التوجيه والإرشاد والسلوك",
            opener: "اجتمعت لجنة التوجيه والإرشاد",
            closeVoice: "اللجنة"
        },
        discipline: {
            voice: "اللجنة",
            label: "لجنة الانضباط والتدخل السريع",
            formationIds: ["discipline"],
            registerKey: "behavior",
            registerLabel: "سجل الانضباط والمواظبة",
            opener: "اجتمعت لجنة الانضباط والتدخل السريع",
            closeVoice: "اللجنة"
        },
        achievement: {
            voice: "اللجنة",
            label: "لجنة التحصيل الدراسي",
            formationIds: ["achievement"],
            registerKey: "grades",
            registerLabel: "سجل التحصيل ونواتج التعلم",
            opener: "اجتمعت لجنة التحصيل الدراسي",
            closeVoice: "اللجنة"
        },
        excellence: {
            voice: "اللجنة",
            label: "لجنة التميز",
            formationIds: ["excellence", "quality"],
            registerKey: "indicators",
            registerLabel: "سجل الاعتماد والتميز والجودة",
            opener: "اجتمعت لجنة التميز",
            closeVoice: "اللجنة"
        },
        activity: {
            voice: "اللجنة",
            label: "لجنة النشاط والمناسبات",
            formationIds: ["activity"],
            registerKey: "activity",
            registerLabel: "سجل خطة النشاط",
            opener: "اجتمعت لجنة النشاط والمناسبات",
            closeVoice: "اللجنة"
        },
        fund: {
            voice: "الفريق",
            label: "فريق الصندوق المدرسي",
            formationIds: ["fund", "partnership"],
            registerKey: "accounts",
            registerLabel: "سجل الصندوق المدرسي",
            opener: "اجتمع فريق الصندوق المدرسي",
            closeVoice: "الفريق"
        },
        safety: {
            voice: "الفريق",
            label: "فريق الأمن والسلامة المدرسية",
            formationIds: ["safety"],
            registerKey: "facility",
            registerLabel: "سجل الأمن والسلامة",
            opener: "اجتمع فريق الأمن والسلامة المدرسية",
            closeVoice: "الفريق"
        },
        special: {
            voice: "الفريق",
            label: "فريق التربية الخاصة",
            formationIds: ["special"],
            registerKey: "support",
            registerLabel: "سجل التربية الخاصة والدعم",
            opener: "اجتمع فريق التربية الخاصة",
            closeVoice: "الفريق"
        }
    };

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function profileFor(typeId) {
        return PROFILES[typeId] || PROFILES.admin;
    }

    function weekdayFromIso(iso) {
        var text = String(iso || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            return "";
        }
        var date = new Date(text + "T12:00:00");
        if (Number.isNaN(date.getTime())) {
            return "";
        }
        return WEEKDAYS[date.getDay()] || "";
    }

    function joinDate(hijri, gregorian) {
        var h = String(hijri || "").trim();
        var g = String(gregorian || "").trim();
        if (h && g) {
            return h + " الموافق " + g;
        }
        return h || g || "";
    }

    function chairOf(present, seats) {
        var list = Array.isArray(present) ? present : [];
        var seatChair = (Array.isArray(seats) ? seats : []).filter(function (seat) {
            return String(seat.title || "").indexOf("رئيس") >= 0 && seat.name;
        })[0];
        if (seatChair) {
            var match = list.filter(function (person) {
                return person.name === seatChair.name;
            })[0];
            if (match) {
                return match;
            }
            return { name: seatChair.name, role: seatChair.title };
        }
        return list[0] || null;
    }

    function namesList(present) {
        return (present || []).map(function (person) {
            return person.name;
        }).filter(Boolean);
    }

    /** يزيل الفعل الافتتاحي من عنوان الموضوع عند دخوله بعد «لمناقشة» لتفادي التكرار */
    function topicForDiscuss(topic) {
        return String(topic || "")
            .trim()
            .replace(/^(مناقشة|دراسة|متابعة|إعداد|إقرار|مراجعة|اقتراح|تنفيذ|تقويم|رصد|تبادل|استطلاع|تنظيم|توثيق|خفض|اعتماد|الإشراف على)\s+/u, "")
            .trim();
    }

    /** لـ + ال… → لل… (للجنة / للفريق) بلا «لـال» */
    function lamDefinite(noun) {
        var text = String(noun || "").trim();
        if (!text) {
            return "";
        }
        if (text.indexOf("ال") === 0) {
            return "ل" + text.slice(2);
        }
        return "ل" + text;
    }

    function chairRoleClean(role) {
        var text = String(role || "").trim();
        if (!text) {
            return "";
        }
        return text.replace(/ً$/, "").replace(/اً$/, "");
    }

    /**
     * صياغة قانونية إدارية تتكيّف مع نوع اللجنة.
     * الحقول المستقلة تُحفظ منفصلة؛ النص قابل للتعديل قبل الطباعة.
     */
    function draftMinutes(ctx) {
        ctx = ctx || {};
        var profile = profileFor(ctx.type);
        var school = String(ctx.school || "متوسطة سعد بن الربيع الأنصاري").trim();
        var whenDay = weekdayFromIso(ctx.iso);
        var when = joinDate(ctx.hijri, ctx.gregorian);
        var topicRaw = String(ctx.agenda || "").trim();
        var topic = topicForDiscuss(topicRaw) || topicRaw;
        var decisions = String(ctx.decisions || "").trim();
        var notes = String(ctx.addition || "").trim();
        var present = Array.isArray(ctx.present) ? ctx.present : [];
        var seats = Array.isArray(ctx.seats) ? ctx.seats : [];
        var chair = chairOf(present, seats);
        var attendNames = namesList(present);
        var follow = joinDate(ctx.followHijri, ctx.followGregorian);
        var ofBody = lamDefinite(profile.closeVoice);

        var lead = "الحمد لله رب العالمين، والصلاة والسلام على أشرف الأنبياء والمرسلين.";
        var dayBit = whenDay ? ("في يوم " + whenDay) : "في يوم انعقاد الاجتماع";
        var dateBit = when ? (" الموافق " + when) : "";
        var body = dayBit + dateBit + "، " + profile.opener
            + " بمدرسة " + school;
        if (chair && chair.name) {
            var chairRole = chairRoleClean(chair.role);
            body += " برئاسة " + chair.name;
            // «برئاسة» تغني عن تكرار صفة الرئيس
            if (chairRole && !/^رئيس/.test(chairRole)) {
                body += " — " + chairRole;
            }
        }
        if (attendNames.length) {
            body += "، وبحضور الأعضاء الواردة أسماؤهم في كشف الحضور والتوقيعات المرفق بهذا المحضر";
        } else {
            body += "، وبحضور أعضائها المكلّفين";
        }
        if (topic) {
            body += "، وذلك لمناقشة «" + topic + "» وفق الاختصاص النظامي " + ofBody;
        }
        body += ".";

        var mid = "";
        if (ctx.type === "discipline" || ctx.type === "guidance") {
            mid = "وبعد الاطلاع على الأنظمة والتعليمات ذات الصلة، وقواعد السلوك والمواظبة، ومداولة الأعضاء فيما عُرض؛";
        } else if (ctx.type === "excellence" || ctx.type === "admin") {
            mid = "وبعد الاطلاع على مؤشرات الأداء والشواهد المحفوظة، ومداولة الأعضاء فيما عُرض؛";
        } else if (ctx.type === "achievement") {
            mid = "وبعد الاطلاع على نتائج التحصيل ونواتج التعلم المحفوظة، ومداولة الأعضاء فيما عُرض؛";
        } else if (ctx.type === "fund") {
            mid = "وبعد الاطلاع على البنود المالية والمستندات المحفوظة، ومداولة الأعضاء فيما عُرض؛";
        } else if (ctx.type === "safety") {
            mid = "وبعد الاطلاع على متطلبات الأمن والسلامة المحفوظة، ومداولة الأعضاء فيما عُرض؛";
        } else if (ctx.type === "activity") {
            mid = "وبعد الاطلاع على خطة النشاط والبرامج المعتمدة، ومداولة الأعضاء فيما عُرض؛";
        } else {
            mid = "وبعد المداولة النظامية فيما عُرض على " + profile.closeVoice + "؛";
        }

        var end = "انتهى الاجتماع إلى القرارات والتوصيات الآتية:";
        var decisionBlock = decisions
            ? decisions
            : ("١- اعتماد ما دار في الاجتماع بشأن «" + (topic || "الموضوع المعروض") + "» والعمل بموجبه وفق الأنظمة والتعليمات."
                + "\n٢- تكليف المختصين بمتابعة التنفيذ ورفع ما يستجد إلى رئيس " + profile.closeVoice + ".");

        var followBit = follow
            ? ("ويُتابع تنفيذ ما ورد في هذا المحضر بتاريخ " + follow + ".")
            : ("ويُتابع التنفيذ في الموعد الذي يعتمده رئيس " + profile.closeVoice + ".");

        var seal = "حُرّر هذا المحضر، ويُعتمد بتوقيع الحاضرين في الصفحة التالية، ويُحفظ في «"
            + profile.registerLabel + "».";

        var parts = [lead, body, mid, end, decisionBlock, followBit];
        if (notes) {
            parts.push("ملاحظات إضافية: " + notes);
        }
        parts.push(seal);
        return parts.join("\n\n");
    }

    function resolveSeats(typeId, formations, committeesBank) {
        var profile = profileFor(typeId);
        var ids = profile.formationIds || [typeId];
        var formationsMap = formations || {};
        var bank = Array.isArray(committeesBank) ? committeesBank : [];
        var i;
        for (i = 0; i < ids.length; i += 1) {
            var fromFormation = formationsMap[ids[i]];
            if (Array.isArray(fromFormation) && fromFormation.some(function (seat) { return seat && seat.name; })) {
                return fromFormation.map(function (seat) {
                    return { title: seat.title || "عضواً", name: seat.name || "" };
                });
            }
        }
        for (i = 0; i < ids.length; i += 1) {
            var found = bank.filter(function (item) { return item.id === ids[i]; })[0];
            if (found && Array.isArray(found.seats) && found.seats.some(function (seat) { return seat && seat.name; })) {
                return found.seats.map(function (seat) {
                    return { title: seat.title || "عضواً", name: seat.name || "" };
                });
            }
        }
        return [];
    }

    function signCell(person) {
        var id = person && person.id ? String(person.id) : "";
        var rolePath = "";
        var role = String((person && person.role) || "");
        if (role.indexOf("مدير") === 0) {
            rolePath = "signatures/sig_manager.png";
        } else if (role.indexOf("وكيل") === 0 && role.indexOf("طلاب") >= 0) {
            rolePath = "signatures/sig_students.png";
        } else if (role.indexOf("وكيل") === 0) {
            rolePath = "signatures/sig_teachers.png";
        }
        var primary = id ? ("signatures/sig_" + id + ".png") : rolePath;
        if (!primary) {
            return "<span class=\"council-sign-line\" aria-hidden=\"true\"></span>";
        }
        return "<img class=\"council-sign-img\" src=\"/" + escapeHtml(primary) + "\" alt=\"\" onerror=\"this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.hidden=false)\">"
            + "<span class=\"council-sign-line\" hidden aria-hidden=\"true\"></span>";
    }

    function attendanceTableHtml(present) {
        var rows = (present || []).map(function (person, index) {
            return "<tr>"
                + "<td>" + (index + 1) + "</td>"
                + "<td>" + escapeHtml(person.name || "") + "</td>"
                + "<td>" + escapeHtml(person.role || "") + "</td>"
                + "<td class=\"council-sign-cell\">" + signCell(person) + "</td>"
                + "</tr>";
        }).join("");
        if (!rows) {
            rows = "<tr><td colspan=\"4\">لم يُحدد حاضرون في هذا الاجتماع.</td></tr>";
        }
        return "<table class=\"council-attendance-table\">"
            + "<thead><tr><th>م</th><th>الاسم</th><th>الصفة</th><th>التوقيع</th></tr></thead>"
            + "<tbody>" + rows + "</tbody></table>";
    }

    function evidenceGalleryHtml(items) {
        var list = [];
        if (root.board1059VisualEvidence && root.board1059VisualEvidence.parseItems) {
            list = root.board1059VisualEvidence.parseItems(items);
        } else if (Array.isArray(items)) {
            list = items;
        }
        if (!list.length) {
            return "<p class=\"council-page-note\">لا مرفقات بصرية محفوظة لهذا المحضر.</p>";
        }
        return "<div class=\"council-evidence-grid\">" + list.map(function (item) {
            if (item.kind === "image" || (!item.kind && item.url)) {
                return "<figure class=\"council-evidence-tile\"><img src=\"" + escapeHtml(item.url) + "\" alt=\""
                    + escapeHtml(item.name || "توثيق") + "\"></figure>";
            }
            return "<figure class=\"council-evidence-tile is-file\"><a href=\"" + escapeHtml(item.url)
                + "\" target=\"_blank\" rel=\"noopener\">" + escapeHtml(item.name || item.url) + "</a></figure>";
        }).join("") + "</div>";
    }

    function pageShell(title, pageNo, total, bodyHtml, headerHtml, withSignoff) {
        var core = root.OfficialFrameCore;
        if (core && typeof core.page === "function") {
            return core.page({
                strictIdentity: true,
                title: title,
                bodyHtml: bodyHtml,
                page: pageNo,
                total: total,
                signoff: !!withSignoff,
                frameClass: "council-official-page"
            });
        }
        return "<article class=\"council-official-page\" data-council-page=\"" + pageNo + "\">"
            + (headerHtml || "")
            + "<h1 class=\"council-official-title\">" + escapeHtml(title) + "</h1>"
            + bodyHtml
            + "<footer class=\"council-official-foot\">"
            + "<span>متوسطة سعد بن الربيع الأنصاري</span>"
            + "<span>صفحة " + pageNo + " من " + total + "</span>"
            + "</footer></article>";
    }

    function buildThreePages(ctx, headerHtml) {
        ctx = ctx || {};
        var profile = profileFor(ctx.type);
        var minutesText = String(ctx.minutes || draftMinutes(ctx)).trim();
        var paragraphs = minutesText.split(/\n+/).filter(Boolean).map(function (line) {
            return "<p class=\"council-minutes-p\">" + escapeHtml(line) + "</p>";
        }).join("");

        var page1 = pageShell(
            "محضر اجتماع رسمي",
            1,
            3,
            "<p class=\"council-meta-line\"><b>الجهة:</b> " + escapeHtml(profile.label) + "</p>"
                + "<p class=\"council-meta-line\"><b>يُحفظ في:</b> " + escapeHtml(profile.registerLabel) + "</p>"
                + "<p class=\"council-meta-line\"><b>الموضوع:</b> " + escapeHtml(ctx.agenda || "—") + "</p>"
                + "<p class=\"council-meta-line\"><b>التاريخ:</b> " + escapeHtml(joinDate(ctx.hijri, ctx.gregorian) || "—") + "</p>"
                + "<div class=\"council-minutes-body\">" + paragraphs + "</div>",
            headerHtml,
            false
        );

        var topicLead = topicForDiscuss(ctx.agenda) || ctx.agenda || "";
        var page2 = pageShell(
            "كشف الحضور والتوقيعات",
            2,
            3,
            "<p class=\"council-page-lead\">يُثبت أدناه حضور أعضاء «" + escapeHtml(profile.label)
                + "» لاجتماع «" + escapeHtml(topicLead) + "»، ويُعتمد بتوقيع كل حاضر.</p>"
                + attendanceTableHtml(ctx.present),
            headerHtml,
            false
        );

        var page3 = pageShell(
            "توثيق الاجتماع بالصور والمرفقات",
            3,
            3,
            "<p class=\"council-page-lead\">المرفقات البصرية المرتبطة بهذا المحضر (إن وُجدت).</p>"
                + evidenceGalleryHtml(ctx.evidenceItems || []),
            headerHtml,
            true
        );

        return "<div class=\"council-official-book\">" + page1 + page2 + page3 + "</div>";
    }

    root.councilMinutesEngine = {
        profiles: PROFILES,
        profileFor: profileFor,
        draftMinutes: draftMinutes,
        topicForDiscuss: topicForDiscuss,
        lamDefinite: lamDefinite,
        resolveSeats: resolveSeats,
        buildThreePages: buildThreePages,
        attendanceTableHtml: attendanceTableHtml,
        weekdayFromIso: weekdayFromIso,
        joinDate: joinDate
    };
}(window));
