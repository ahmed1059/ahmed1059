/* عرض الشرائح. التسكين للمدير يأتي من الخادم مرة واحدة ويبقى في الذاكرة. */
var DECK_ROLES = [
    { id: "principal", title: "مدير المدرسة", name: "نايف بن سمير بن حجيف الحربي", key: "principal" },
    { id: "vice_teachers", title: "وكيل الشؤون التعليمية", name: "محمد بن فايز بن هلال الحربي", key: "viceTeachers", list: "viceTeachersList" },
    { id: "vice_students", title: "وكيل شؤون الطلاب", name: "خالد بن علي بن حجري العمري", key: "studentsVice", list: "studentsVices" },
    { id: "student_counselor", title: "الموجه الطلابي", name: "منور بن محمد بن عليان اللهيبي", key: "primaryCounselor" },
    { id: "activity_leader", title: "رائد النشاط الطلابي", name: "محمد حامد عماش السهلي", key: "activityLeader" }
];

function deckRoleRecord(role) {
    var index;
    for (index = 0; index < DECK_ROLES.length; index += 1) {
        if (DECK_ROLES[index].id === role) {
            return DECK_ROLES[index];
        }
    }
    return DECK_ROLES[0];
}

function currentDeckRole() {
    var picker = document.querySelector('.slide-deck [data-deck="role"]');
    if (picker && picker.value) {
        return picker.value;
    }
    var page = document.getElementById("plan-role");
    if (page && page.value) {
        return page.value;
    }
    return "principal";
}

function deckGender() {
    var box = document.getElementById("gender");
    if (box && (box.value === "female" || box.value === "male")) {
        return box.value;
    }
    return "male";
}

function deckStoredIds(record, leadership) {
    var stored = leadership || {};
    if (record.list && Array.isArray(stored[record.list])) {
        var listed = stored[record.list].map(function (item) {
            return String(item || "").trim();
        }).filter(Boolean);
        if (listed.length) {
            return listed;
        }
    }
    if (record.key && Object.prototype.hasOwnProperty.call(stored, record.key)) {
        var written = String(stored[record.key] || "").trim();
        return written ? [written] : [];
    }
    return [];
}

function deckLiveName(value) {
    var shown = "";
    if (window.dataHub && typeof window.dataHub.display === "function") {
        shown = window.dataHub.display(value);
    }
    if (!shown) {
        shown = String(value || "");
    }
    if (shown === "فهد حنيف بن محمد العمري") {
        return "منور بن محمد بن عليان اللهيبي";
    }
    return shown;
}

function deckRoleNames(record, leadership) {
    return deckStoredIds(record, leadership).map(deckLiveName).filter(Boolean);
}

function deckAuthor(record, leadership) {
    var names = deckRoleNames(record, leadership);
    return names.length ? names[0] : "";
}

function deckOptionLabel(record) {
    var name = deckAuthor(record, readJsonStore("board1059.leadership"));
    return name ? record.title + ": " + name : record.title;
}

function refreshDeckRoleOptions(root) {
    var picker = root && root.querySelector('[data-deck="role"]');
    if (!picker) {
        return;
    }
    var selected = picker.value;
    Array.prototype.forEach.call(picker.options, function (option) {
        option.textContent = deckOptionLabel(deckRoleRecord(option.value));
    });
    if (selected) {
        picker.value = selected;
    }
}

function deckTeamRows(leadership) {
    var rows = [];
    DECK_ROLES.forEach(function (record) {
        var ids = deckStoredIds(record, leadership);
        if (!ids.length) {
            rows.push({ role_id: record.id, title: record.title, name: "" });
            return;
        }
        ids.forEach(function (id) {
            rows.push({ role_id: record.id, title: record.title, name: deckLiveName(id) });
        });
    });
    return rows;
}

var viewerState = {
    currentSlide: 0,
    totalSlides: 0,
    isEditMode: false,
    isApproved: false,
    seating: false,
    deck: null
};

function deckNafsIcon(kind) {
    if (kind === "science") {
        return '<svg viewBox="0 0 24 24"><path d="M9 3h6"/><path d="M10 3v6L5.6 19.2A2 2 0 0 0 7.4 22h9.2a2 2 0 0 0 1.8-2.8L14 9V3"/><path d="M8.2 14h7.6"/></svg>';
    }
    if (kind === "math") {
        return '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>';
    }
    return '<svg viewBox="0 0 24 24"><path d="M4 5.5h6.2A2.8 2.8 0 0 1 13 8.2V19a2.4 2.4 0 0 0-2.4-2.4H4z"/><path d="M20 5.5h-6.2A2.8 2.8 0 0 0 11 8.2V19a2.4 2.4 0 0 1 2.4-2.4H20z"/></svg>';
}

function deckNafsRing(score, weak) {
    var raw = parseFloat(String(score == null ? "" : score).replace("%", ""));
    var value = isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
    var length = 2 * Math.PI * 46;
    var offset = length * (1 - value / 100);
    var color = weak ? "#c2410c" : "#005a53";
    var shown = score ? deckEscape(score) + "%" : "";
    return '<div class="deck-nafs-ring">'
        + '<svg viewBox="0 0 120 120" aria-hidden="true">'
        + '<circle class="deck-nafs-track" cx="60" cy="60" r="46"></circle>'
        + '<circle class="deck-nafs-value" cx="60" cy="60" r="46" stroke="' + color + '" stroke-dasharray="' + length.toFixed(2) + '" stroke-dashoffset="' + offset.toFixed(2) + '"></circle>'
        + '</svg><b>' + shown + '</b></div>';
}

function deckEscape(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function deckLogoRow(ministryFirst, identity) {
    var info = identity || {};
    var ministry = '<img src="/assets/ministry_logo.png" alt="وزارة التعليم">';
    var vision = '<img src="/assets/vision_2030.png" alt="رؤية 2030">';
    var text = '<div class="deck-logo-text">'
        + '<div>المملكة العربية السعودية</div>'
        + '<div>وزارة التعليم</div>'
        + '<div>' + deckEscape(info.administration || "الإدارة العامة للتعليم بمنطقة المدينة المنورة") + '</div>'
        + '<div>' + deckEscape(info.school || "متوسطة سعد بن الربيع الأنصاري") + '</div>'
        + '</div>';
    var side = ministryFirst ? ministry + text + vision : vision + text + ministry;
    return '<div class="deck-logos">' + side + '</div>';
}

function deckProfileSpecs(items, allowWide) {
    return (items || []).map(function (item) {
        var wide = allowWide && item.wide ? " is-wide" : "";
        var figure = /^[0-9]+$/.test(String(item.value || "").replace(/\s/g, "")) ? " is-figure" : "";
        return '<li class="' + wide.trim() + '"><span>' + deckEscape(item.label) + '</span><strong class="' + figure.trim() + '">' + deckEscape(item.value) + '</strong></li>';
    }).join("");
}

function deckCellText(cell) {
    return deckEscape(cell && cell.value ? cell.value : "");
}

function deckPublicEvidence(value) {
    var text = String(value || "").trim();
    if (text === "pilot-1448-improve-formative") {
        return "سجل الزيارات الصفية وتقارير مجتمعات التعلم المهنية";
    }
    return text;
}

function deckManagerSign(identity) {
    var role = String((identity && identity.author_role) || "");
    if (role.indexOf("مدير المدرسة") === 0) {
        return '<img class="deck-sign-image" src="signatures/sig_manager.png" alt="توقيع مدير المدرسة">';
    }
    return "";
}

function deckIcon(name) {
    var paths = {
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/>',
        user: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.5c1.2-3 3.4-4.5 6.5-4.5s5.3 1.5 6.5 4.5"/>',
        "shield-check": '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
        lock: '<rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11"/>',
        flag: '<path d="M6 21V4"/><path d="M6 5h11l-2 3.5L17 12H6"/>',
        heart: '<path d="M12 19s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z"/>',
        users: '<circle cx="9" cy="8" r="2.4"/><circle cx="16" cy="9" r="2"/><path d="M4.5 18.5c.8-2.6 2.6-3.8 4.5-3.8s3.7 1.2 4.5 3.8"/><path d="M13.5 14.8c1.6-.2 3.2.6 4 2.7"/>',
        "users-round": '<circle cx="8.5" cy="9" r="2.2"/><circle cx="15.5" cy="9" r="2.2"/><path d="M4.2 18c.7-2.4 2.4-3.6 4.3-3.6s3.6 1.2 4.3 3.6"/><path d="M12.8 14.6c1.5-.3 3.3.5 4.2 2.9"/>',
        award: '<circle cx="12" cy="9" r="4"/><path d="M9.2 12.5L8 20l4-2 4 2-1.2-7.5"/>',
        smile: '<circle cx="12" cy="12" r="8"/><path d="M8.5 14.5c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2"/><path d="M9 10h.01M15 10h.01"/>'
    };
    return '<svg class="deck-icon" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || "") + '</svg>';
}

function deckSlideMarkup(slide, index, identity) {
    var current = index === 1 ? " is-current" : "";
    var hidden = index === 1 ? "" : " hidden";
    var plain = slide.kind === "basmala" ? " is-basmala" : "";
    var motif = slide.kind === "basmala" ? "" : '<div class="deck-motif" aria-hidden="true"></div>';
    var paint = identity && identity.paint_role ? ' data-paint="' + deckEscape(identity.paint_role) + '"' : '';
    return '<article class="slide-deck-slide slide-container' + plain + current + '"' + paint + ' data-kind="' + deckEscape(slide.kind) + '" data-slide="' + index + '"' + hidden + '>'
        + motif
        + deckSlideInner(slide, identity)
        + '</article>';
}

function deckSlideInner(slide, identity) {
    if (slide.kind === "cover") {
        return '<img class="deck-watermark" src="/assets/ministry_logo.png" alt="">'
            + '<div class="slide-deck-pad">'
            + deckLogoRow(false, identity)
            + '<div class="deck-cover-body">'
            + '<p class="deck-plan-kicker">' + deckEscape(slide.kicker || "") + '</p>'
            + '<p class="deck-plan-kind">' + deckEscape(slide.plan_kind || "") + '</p>'
            + '<div class="deck-ornament" aria-hidden="true"></div>'
            + '<p class="deck-school">' + deckEscape(identity.school || "") + '</p>'
            + '<p class="deck-note">' + deckEscape(slide.note || "") + '</p>'
            + '<div class="deck-author">'
            + '<p class="deck-author-name">' + deckEscape(identity.author_name || "") + '</p>'
            + '<p class="deck-author-role">' + deckEscape(identity.author_role || "") + '</p>'
            + '</div></div></div>'
            + '<footer class="slide-deck-stripe">' + deckEscape(slide.stripe || "") + '</footer>';
    }
    if (slide.kind === "basmala") {
        return '<div class="deck-basmala"><img src="/assets/basmala.png" alt="بسم الله الرحمن الرحيم"></div>';
    }
    if (slide.kind === "vision") {
        var vision = slide.vision || {};
        var mission = slide.mission || {};
        var valueCards = (slide.values || []).map(function (cell) {
            return '<li class="deck-value-card" data-path="' + deckEscape(cell.path) + '">'
                + '<span>' + deckCellText(cell) + '</span></li>';
        }).join("");
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-page-title">الرؤية والرسالة</h2>'
            + '<div class="deck-vision-split">'
            + '<article class="deck-vision-card">'
            + '<h3>' + deckIcon("eye") + '<span>الرؤية</span></h3>'
            + '<p data-path="' + deckEscape(vision.path) + '">' + deckCellText(vision) + '</p>'
            + '</article>'
            + '<article class="deck-vision-card">'
            + '<h3>' + deckIcon("mail") + '<span>الرسالة</span></h3>'
            + '<p data-path="' + deckEscape(mission.path) + '">' + deckCellText(mission) + '</p>'
            + '</article>'
            + '</div>'
            + '<h2 class="deck-values-title">القيم</h2>'
            + '<ul class="deck-value-row">' + valueCards + '</ul>'
            + '</div>';
    }
    if (slide.kind === "school_plan") {
        var planNote = slide.source === "bank"
            ? "<p class=\"deck-school-note\">نص ملف المدير. الحفظ في صفحة الخطة التشغيلية ينقله إلى جدول المدرسة.</p>"
            : "";
        var planGoals = (slide.goals || []).map(function (goal) {
            var indicators = (goal.indicators || []).map(function (item) {
                var bits = [item.kpi, item.target, item.measurement].filter(Boolean);
                return bits.length ? "<li>" + deckEscape(bits.join(" — ")) + "</li>" : "";
            }).join("");
            var programs = (goal.programs || []).map(function (name) {
                return "<li>" + deckEscape(name) + "</li>";
            }).join("");
            var tasks = (goal.tasks || []).map(function (title) {
                return "<li>" + deckEscape(title) + "</li>";
            }).join("");
            return "<article class=\"deck-school-goal\"><h3>" + deckEscape(goal.id || "") + " · " + deckEscape(goal.domain || "") + "</h3>"
                + "<p>" + deckEscape(goal.text || "") + "</p>"
                + (indicators ? "<ul class=\"deck-school-kpis\">" + indicators + "</ul>" : "")
                + (programs ? "<p class=\"deck-school-link\">البرامج</p><ul class=\"deck-school-kpis\">" + programs + "</ul>" : "")
                + (tasks ? "<p class=\"deck-school-link\">البنود</p><ul class=\"deck-school-kpis\">" + tasks + "</ul>" : "")
                + "</article>";
        }).join("");
        if (!planGoals) {
            planGoals = "<p class=\"deck-school-note\">لا أهداف محفوظة.</p>";
        }
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-page-title">' + deckEscape(slide.title || "الخطة التشغيلية للمدرسة") + "</h2>"
            + planNote
            + '<div class="deck-school-goals">' + planGoals + "</div></div>";
    }
    if (slide.kind === "intro") {
        var paragraphs = (slide.paragraphs || []).map(function (cell) {
            return '<p class="deck-intro" data-path="' + deckEscape(cell.path) + '">' + deckCellText(cell) + '</p>';
        }).join("");
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-page-title">' + deckEscape(slide.title || "المقدمة") + '</h2>'
            + '<div class="deck-intro-body">'
            + '<div class="deck-intro-copy">' + paragraphs + '</div>'
            + '</div>'
            + '<div class="deck-intro-sign">'
            + '<span class="deck-ruqaa">التوقيع</span>'
            + deckManagerSign(identity)
            + '<p class="deck-ruqaa deck-sign-name">' + deckEscape(identity.author_name || "") + '</p>'
            + '<p class="deck-author-role">' + deckEscape(identity.author_role || "") + '</p>'
            + '</div></div>';
    }
    if (slide.kind === "swot") {
        var swotIndex = { strength: "01", weakness: "02", opportunity: "03", threat: "04" };
        var quadrants = (slide.quadrants || []).map(function (cell) {
            var mark = cell.overridden ? " is-overridden" : "";
            return '<article class="deck-swot-cell is-editable' + mark + '" data-swot="' + deckEscape(cell.key) + '" data-path="' + deckEscape(cell.path) + '" data-multiline="1">'
                + '<header><b>' + (swotIndex[cell.key] || "") + '</b><h3>' + deckEscape(cell.label) + '</h3></header>'
                + '<span class="deck-cell-text">' + deckCellText(cell) + '</span>'
                + '</article>';
        }).join("");
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-page-title">' + deckEscape(slide.title || "التحليل الرباعي") + '</h2>'
            + '<div class="deck-swot">' + quadrants + '</div>'
            + '</div>';
    }
    if (slide.kind === "team") {
        var members = (slide.members || []).map(function (member) {
            var signSrc = "";
            var title = member.title || "";
            if (title === "وكيل الشؤون التعليمية") {
                signSrc = "signatures/sig_teachers.png";
            } else if (title === "وكيل شؤون الطلاب") {
                signSrc = "signatures/sig_students.png";
            } else if (title === "مدير المدرسة") {
                signSrc = "signatures/sig_manager.png";
            }
            var sign = signSrc ? '<img class="deck-sign-image" src="' + deckEscape(signSrc) + '" alt="">' : "";
            return '<tr><td>' + deckEscape(member.title) + '</td><td>' + deckEscape(member.name) + '</td><td class="deck-sign-blank">' + sign + '</td></tr>';
        }).join("");
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-page-title">' + deckEscape(slide.title || "فريق التخطيط") + '</h2>'
            + '<table class="deck-table deck-team"><thead><tr><th>الصفة</th><th>الاسم</th><th>التوقيع</th></tr></thead>'
            + '<tbody>' + members + '</tbody></table></div>';
    }
    if (slide.kind === "profile") {
        var identitySpecs = (slide.identity || []).filter(function (item) {
            var label = item && item.label ? item.label : "";
            if (label === "الهاتف" || label === "البريد الإلكتروني") {
                return String(item.value || "").trim() !== "";
            }
            return true;
        });
        var buildingSpecs = (slide.building || []).filter(function (item) {
            return String((item && item.value) || "").trim() !== "";
        });
        var buildingCard = buildingSpecs.length
            ? '<section class="deck-profile-card"><h3>' + deckEscape(slide.building_type ? "المبنى المدرسي · " + slide.building_type : "المبنى المدرسي") + "</h3>"
                + '<ul class="deck-building">' + deckProfileSpecs(buildingSpecs, false) + "</ul></section>"
            : "";
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-page-title">' + deckEscape(slide.title || "بيانات المدرسة") + "</h2>"
            + '<div class="deck-profile">'
            + '<div class="deck-profile-top">'
            + '<h3 class="deck-profile-name">' + deckEscape(slide.name || "") + "</h3>"
            + '<ul class="deck-profile-head">' + deckProfileSpecs(slide.headline, false) + "</ul>"
            + "</div>"
            + '<ul class="deck-profile-identity">' + deckProfileSpecs(identitySpecs, true) + "</ul>"
            + '<div class="deck-profile-split">'
            + '<section class="deck-profile-card"><h3>تبعد عن</h3><ul class="deck-distances">' + deckProfileSpecs(slide.distances, true) + "</ul></section>"
            + buildingCard
            + "</div></div></div>";
    }
    if (slide.kind === "domains") {
        var cards = (slide.cards || []).map(function (card, cardIndex) {
            var raw = String(card.label || "");
            var splitAt = raw.indexOf(":");
            var kicker = splitAt > 0 ? raw.slice(0, splitAt).trim() : "";
            var name = splitAt > 0 ? raw.slice(splitAt + 1).trim() : raw;
            var subs = (card.subs || []).map(function (item) {
                return '<li>' + deckEscape(item) + '</li>';
            }).join("");
            var index = cardIndex + 1;
            var score = card.score ? '<p class="deck-domain-score">' + deckEscape(card.score) + '%</p>' : '';
            var gap = card.gap ? '<p class="deck-domain-gap">المسافة إلى المستوى التالي ' + deckEscape(card.gap) + '</p>' : '';
            return '<article class="deck-domain-card" data-domain="' + index + '">'
                + '<span class="deck-domain-index" aria-hidden="true">0' + index + '</span>'
                + (kicker ? '<p class="deck-domain-kicker">' + deckEscape(kicker) + '</p>' : '')
                + '<h3>' + deckEscape(name) + '</h3>'
                + score
                + gap
                + '<ul>' + subs + '</ul></article>';
        }).join("");
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-page-title">' + deckEscape(slide.title || "مجالات التقويم") + '</h2>'
            + '<div class="deck-domains">' + cards + '</div>'
            + '</div>';
    }
    if (slide.kind === "nafs") {
        var facts = [
            ["الصف", slide.grade],
            ["المقيدون", slide.enrolled],
            ["المختبرون", slide.tested]
        ].filter(function (pair) {
            return pair[1];
        }).map(function (pair) {
            return '<li><span>' + deckEscape(pair[0]) + '</span><b>' + deckEscape(pair[1]) + '</b></li>';
        }).join("");
        var subjects = (slide.subjects || []).map(function (subject) {
            var mark = subject.weak ? " is-weak" : "";
            var note = subject.weak && slide.weakest_skill
                ? '<small>أضعف مهارة: ' + deckEscape(slide.weakest_skill)
                    + (slide.weakest_score ? " " + deckEscape(slide.weakest_score) + "%" : "")
                    + '</small>'
                : '';
            return '<article class="deck-nafs-card' + mark + '">'
                + '<header><span class="deck-nafs-icon">' + deckNafsIcon(subject.icon) + '</span>'
                + '<h3>' + deckEscape(subject.label) + '</h3></header>'
                + deckNafsRing(subject.score, subject.weak)
                + (subject.weak ? '<em>الأضعف</em>' : '')
                + note
                + '</article>';
        }).join("");
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-page-title">' + deckEscape(slide.title || "نتائج نافس") + '</h2>'
            + '<ul class="deck-nafs-facts">' + facts + '</ul>'
            + '<div class="deck-nafs-grid">' + subjects + '</div></div>';
    }
    if (slide.kind === "improvement") {
        var actions = (slide.rows || []).map(function (row) {
            return '<tr><td>' + deckEscape(row.title) + '</td><td>' + deckEscape(row.owner) + '</td><td>' + deckEscape(row.indicator) + '</td><td>' + deckEscape(deckPublicEvidence(row.evidence)) + '</td></tr>';
        }).join("");
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-page-title">' + deckEscape(slide.title || "خطة التحسين") + '</h2>'
            + '<table class="deck-table deck-improvement"><thead><tr><th>الإجراء</th><th>المسؤول</th><th>المؤشر</th><th>الشاهد</th></tr></thead>'
            + '<tbody>' + actions + '</tbody></table></div>';
    }
    if (slide.kind === "school_programs") {
        var origin = Number(slide.start) || 0;
        var programRows = (slide.rows || []).map(function (row, rowIndex) {
            var name = row.name || "";
            if (row.goal) {
                name = name + " — " + row.goal;
            }
            return "<tr><td>" + (origin + rowIndex + 1) + "</td><td>" + deckEscape(name) + "</td><td>"
                + deckEscape(row.audience) + "</td><td>" + deckEscape(row.duration) + "</td><td>"
                + deckEscape(row.implementers) + "</td><td>" + deckEscape(row.success) + "</td><td>"
                + deckEscape(row.register) + "</td></tr>";
        }).join("");
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-page-title">' + deckEscape(slide.title || "خطة البرامج") + "</h2>"
            + '<table class="deck-table deck-program-table"><thead><tr><th>م</th><th>اسم البرنامج والهدف</th><th>المستهدفون</th><th>الفترة</th><th>المنفذون</th><th>مؤشر النجاح</th><th>السجل والشاهد</th></tr></thead><tbody>'
            + programRows + "</tbody></table></div>";
    }
    if (slide.kind === "toc") {
        var entries = (slide.entries || []).map(function (entry) {
            return '<tr><td>' + deckEscape(entry.label) + '</td><td>' + deckEscape(entry.pages) + '</td></tr>';
        }).join("");
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-programs-title">المحتويات</h2>'
            + '<table class="deck-toc"><tbody>' + entries + '</tbody></table>'
            + '</div>';
    }
    if (slide.kind === "programs") {
        var rows = (slide.rows || []).map(function (row) {
        var cells = (row.cells || []).map(function (cell, cellIndex) {
            var mark = cell.overridden ? " is-overridden" : "";
            var drop = cellIndex === 0
                ? '<button type="button" class="deck-row-delete" data-deck="drop" data-code="'
                    + deckEscape(row.task_code) + '" aria-label="حذف البند">حذف</button>'
                : "";
            return '<td class="' + mark.trim() + '" data-path="' + deckEscape(cell.path) + '">'
                + '<span class="deck-cell-text">' + deckCellText(cell) + '</span>'
                + drop + '</td>';
        }).join("");
        return '<tr data-code="' + deckEscape(row.task_code) + '">' + cells + '</tr>';
        }).join("");
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-programs-title">' + deckEscape(slide.title || "") + '</h2>'
            + '<table class="deck-table"><thead><tr><th>العمل</th><th>الأسبوع</th><th>الأسلوب</th><th>الشاهد</th></tr></thead>'
            + '<tbody>' + rows + '</tbody></table></div>';
    }
    if (slide.kind === "program_follow") {
        var followRows = (slide.rows || []).map(function (row) {
            return "<tr><td>" + deckEscape(row.name) + "</td><td>" + deckEscape(row.status) + "</td><td>" + deckEscape(row.baseline) + "</td><td>" + deckEscape(row.current) + "</td><td>" + deckEscape(row.target) + "</td><td>" + deckEscape(row.progress) + "</td><td>" + deckEscape(row.action_status) + "</td></tr>";
        }).join("");
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-page-title">' + deckEscape(slide.title || "متابعة البرامج") + "</h2>"
            + '<table class="deck-table deck-plan-programs"><thead><tr><th>البرنامج</th><th>الحالة</th><th>خط الأساس</th><th>القراءة الحالية</th><th>المستهدف</th><th>نسبة الإنجاز</th><th>حالة الإجراء</th></tr></thead><tbody>'
            + followRows + "</tbody></table></div>";
    }
    if (slide.kind === "follow") {
        var lines = slide.weeks || [];
        var split = lines.length > 8;
        var half = split ? Math.ceil(lines.length / 2) : lines.length;
        var hasOwner = lines.some(function (line) {
            return line && line.responsible;
        });
        var body = "";
        var index;
        function ownerCell(line) {
            return hasOwner ? "<td>" + deckEscape(line && line.responsible ? line.responsible : "") + "</td>" : "";
        }
        for (index = 0; index < half; index += 1) {
            var first = lines[index];
            var second = split ? lines[index + half] : null;
            function weekMark(line) {
                if (!line) {
                    return "";
                }
                if (line.mark) {
                    return line.mark;
                }
                return line.done ? "✓" : "";
            }
            body += "<tr><td>" + deckEscape(first.week) + "</td><td>" + weekMark(first) + "</td>" + ownerCell(first);
            if (split) {
                body += second
                    ? "<td>" + deckEscape(second.week) + "</td><td>" + weekMark(second) + "</td>" + ownerCell(second)
                    : "<td></td><td></td>" + (hasOwner ? "<td></td>" : "");
            }
            body += "</tr>";
        }
        var head = split
            ? "<th>الأسبوع</th><th>المتابعة</th>" + (hasOwner ? "<th>المسؤول</th>" : "") + "<th>الأسبوع</th><th>المتابعة</th>" + (hasOwner ? "<th>المسؤول</th>" : "")
            : "<th>الأسبوع</th><th>المتابعة</th>" + (hasOwner ? "<th>المسؤول</th>" : "");
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-programs-title">' + deckEscape(slide.title || "متابعة التنفيذ") + '</h2>'
            + '<table class="deck-table deck-follow"><thead><tr>' + head + '</tr></thead>'
            + '<tbody>' + body + '</tbody></table></div>';
    }
    if (slide.kind === "sign") {
        var yearLine = identity.year ? "العام الدراسي " + identity.year : "";
        return '<div class="slide-deck-pad">'
            + deckLogoRow(true, identity)
            + '<h2 class="deck-programs-title">' + deckEscape(slide.title || "التوقيع") + '</h2>'
            + '<div class="deck-sign">'
            + '<p class="deck-closing">' + deckEscape(slide.closing || "") + '</p>'
            + (slide.signature ? '<img class="deck-sign-image" src="' + deckEscape(slide.signature) + '" alt="توقيع مدير المدرسة">' : '')
            + '<div class="deck-sign-line"></div>'
            + '<p class="deck-author-name">' + deckEscape(identity.author_name || "") + '</p>'
            + '<p class="deck-author-role">' + deckEscape(identity.author_role || "") + '</p>'
            + '<p class="deck-sign-year">' + deckEscape(yearLine) + '</p>'
            + '</div></div>';
    }
    return '<div class="slide-deck-pad">'
        + deckLogoRow(true, identity)
        + '<h2 class="deck-programs-title">اعتماد الخطة</h2>'
        + '<div class="deck-sign">'
        + '<div class="deck-sign-line"></div>'
        + '<p class="deck-author-name" data-path="' + deckEscape(slide.name && slide.name.path) + '">' + deckCellText(slide.name) + '</p>'
        + '<p class="deck-author-role" data-path="' + deckEscape(slide.role && slide.role.path) + '">' + deckCellText(slide.role) + '</p>'
        + '</div></div>';
}

function renderSeatedDeck(root, payload) {
    root.setAttribute("data-role", payload.role || "principal");
    viewerState.deck = payload;
    viewerState.totalSlides = payload.slides.length;
    viewerState.currentSlide = 1;
    var identity = payload.identity || {};
    identity.paint_role = payload.role || "";
    var viewport = root.querySelector(".slide-deck-viewport");
    viewport.innerHTML = payload.slides.map(function (slide, index) {
        return deckSlideMarkup(slide, index + 1, identity);
    }).join("");
    var thumbs = root.querySelector(".slide-deck-thumbs");
    var buttons = "";
    payload.slides.forEach(function (_slide, index) {
        var number = index + 1;
        buttons += '<button type="button" data-slide="' + number + '"'
            + (number === 1 ? ' aria-current="true"' : '')
            + ">" + number + "</button>";
    });
    thumbs.innerHTML = buttons;
    showDeckSlide(root, 1);
}

function rememberDeckCell(path, value) {
    var deck = viewerState.deck;
    if (!deck) {
        return;
    }
    (deck.slides || []).forEach(function (slide) {
        (slide.rows || []).forEach(function (row) {
            (row.cells || []).forEach(function (cell) {
                if (cell.path === path) {
                    cell.value = value;
                    cell.overridden = true;
                }
            });
        });
        (slide.quadrants || []).forEach(function (cell) {
            if (cell.path === path) {
                cell.value = value;
                cell.overridden = true;
            }
        });
    });
}

function openDeckCell(root, td) {
    if (!td || td.querySelector('.deck-cell-input')) {
        return;
    }
    var span = td.querySelector('.deck-cell-text');
    if (!span) {
        return;
    }
    var previous = span.textContent || '';
    var multiline = td.hasAttribute('data-multiline');
    var input = document.createElement(multiline ? 'textarea' : 'input');
    if (!multiline) {
        input.type = 'text';
    }
    input.className = 'deck-cell-input';
    input.value = previous;
    span.hidden = true;
    td.appendChild(input);
    input.focus();
    input.select();
    input.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            input.value = previous;
            input.blur();
        } else if (event.key === 'Enter' && !multiline) {
            event.preventDefault();
            input.blur();
        }
    });
    input.addEventListener('blur', function () {
        commitDeckCell(root, td, previous);
    });
}

function commitDeckCell(root, td, previous) {
    var input = td.querySelector('.deck-cell-input');
    if (!input || td.dataset.saving === '1') {
        return;
    }
    var next = input.value.replace(/^\s+|\s+$/g, '');
    input.remove();
    var span = td.querySelector('.deck-cell-text');
    if (span) {
        span.hidden = false;
        span.textContent = next;
    }
    if (next === previous.replace(/^\s+|\s+$/g, '')) {
        return;
    }
    var path = td.getAttribute('data-path');
    var note = root.querySelector('[data-deck="edit-note"]');
    var wasOverridden = td.classList.contains('is-overridden');
    td.dataset.saving = '1';
    fetch('/api/deck/cell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            role: currentDeckRole(),
            field_path: path,
            value: next
        })
    }).then(function (response) {
        if (!response.ok) {
            throw new Error('cell');
        }
        return response.json();
    }).then(function () {
        td.classList.add('is-overridden');
        rememberDeckCell(path, next);
        if (note) {
            note.textContent = 'حُفظ التعديل، ويبقى بعد إعادة التسكين.';
        }
    }).catch(function () {
        if (span) {
            span.textContent = previous;
        }
        td.classList.toggle('is-overridden', wasOverridden);
        if (note) {
            note.textContent = 'تعذر حفظ التعديل.';
        }
    }).finally(function () {
        delete td.dataset.saving;
    });
}

function dropDeckItem(root, code) {
    if (!code || viewerState.seating) {
        return;
    }
    if (!window.confirm('حذف هذا البند من الخطة؟')) {
        return;
    }
    var note = root.querySelector('[data-deck="edit-note"]');
    if (note) {
        note.textContent = 'جارٍ تثبيت شاهد الحذف';
    }
    fetch('/api/deck/tombstone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: currentDeckRole(), task_code: code })
    }).then(function (response) {
        if (!response.ok) {
            throw new Error('drop');
        }
        return response.json();
    }).then(function () {
        seatDeck(root);
    }).catch(function () {
        if (note) {
            note.textContent = 'تعذر حذف البند.';
        }
    });
}

function addDeckItem(root) {
    if (viewerState.seating) {
        return;
    }
    var note = root.querySelector('[data-deck="edit-note"]');
    if (note) {
        note.textContent = 'جارٍ إضافة البند';
    }
    fetch('/api/deck/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: currentDeckRole() })
    }).then(function (response) {
        if (!response.ok) {
            throw new Error('add');
        }
        return response.json();
    }).then(function () {
        seatDeck(root, 'last');
    }).catch(function () {
        if (note) {
            note.textContent = 'تعذر إضافة البند.';
        }
    });
}

function readJsonStore(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || "null") || {};
    } catch (error) {
        return {};
    }
}

function deckSeatBody(record) {
    var leadership = readJsonStore("board1059.leadership");
    var calendar = readJsonStore("board1059.calendar");
    var facility = readJsonStore("board1059.facility");
    var year = calendar.year ? String(calendar.year).replace(/هـ/g, "").trim() : "";
    return {
        role: record.id,
        gender: deckGender(),
        year_label: year,
        author_name: deckAuthor(record, leadership),
        author_role: record.title,
        names_resolved: true,
        stage: facility.stage || "",
        founded_hijri: facility.foundedHijri || "",
        founded_gregorian: facility.foundedGregorian || "",
        address: facility.address || "",
        facility: {
                school_name: facility.schoolName || "",
                statistical_number: facility.statisticalNumber || "",
                stage: facility.stage || "",
                founded_hijri: facility.foundedHijri || "",
                founded_gregorian: facility.foundedGregorian || "",
                district: facility.district || "",
                address: facility.address || "",
                education_administration: facility.educationAdministration || "",
                phone: facility.phone || "",
                fax: facility.fax || "",
                email: facility.email || "",
                website: facility.website || "",
                distance_admin_km: facility.distanceAdminKm || "",
                distance_secondary: facility.distanceSecondary || "",
                distance_secondary_unit: facility.distanceSecondaryUnit || "",
                distance_middle: facility.distanceMiddle || "",
                distance_middle_unit: facility.distanceMiddleUnit || "",
                distance_primary: facility.distancePrimary || "",
                distance_primary_unit: facility.distancePrimaryUnit || "",
                building_type: facility.buildingType || "",
                built_area: facility.builtArea || "",
                yard_area: facility.yardArea || "",
                room_count: facility.roomCount || "",
                classroom_count: facility.classroomCount || "",
                bathroom_count: facility.bathroomCount || "",
                admin_room_count: facility.adminRoomCount || "",
                lab_count: facility.labCount || "",
                teacher_room_count: facility.teacherRoomCount || "",
                workshop_count: facility.workshopCount || "",
                warehouse_count: facility.warehouseCount || ""
            },
        team: deckTeamRows(leadership)
    };
}

window.addEventListener("dataChanged", function (event) {
    var source = event.detail && event.detail.source;
    if (source !== "staff" && source !== "students" && source !== "leadership" && source !== "indicators" && source !== "nafs" && source !== "improvement" && source !== "programs" && source !== "operational-plan") {
        return;
    }
    if (!document.body.classList.contains("deck-open")) {
        return;
    }
    var root = document.querySelector(".slide-deck");
    if (root) {
        seatDeck(root);
    }
});

function seatDeck(root, focus) {
    var note = root.querySelector('[data-deck="edit-note"]');
    var record = deckRoleRecord(currentDeckRole());
    var token = (viewerState.seatToken || 0) + 1;
    viewerState.seatToken = token;
    viewerState.seating = true;
    var button = root.querySelector('[data-deck="seat"]');
    if (button) {
        button.disabled = true;
    }
    if (note) {
        note.textContent = "جارٍ تسكين خطة " + record.title;
    }
    fetch("/api/deck/seat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deckSeatBody(record))
    }).then(function (response) {
        if (!response.ok) {
            throw new Error("seat");
        }
        return response.json();
    }).then(function (payload) {
        if (token !== viewerState.seatToken) {
            return;
        }
        if (note) {
            note.textContent = "";
        }
        renderSeatedDeck(root, payload);
        refreshDeckRoleOptions(root);
        if (focus === 'last' && viewerState.totalSlides > 1) {
            showDeckSlide(root, viewerState.totalSlides);
        }
        if (viewerState.isEditMode) {
            root.classList.add('is-editing');
        }
    }).catch(function () {
        if (token !== viewerState.seatToken) {
            return;
        }
        if (note) {
            note.textContent = "تعذر تسكين خطة " + record.title + ".";
        }
    }).finally(function () {
        if (token !== viewerState.seatToken) {
            return;
        }
        viewerState.seating = false;
        if (button) {
            button.disabled = false;
        }
    });
}

function paintDeckSlides(root, decks) {
    var html = "";
    var number = 1;
    decks.forEach(function (payload) {
        var identity = payload.identity || {};
        identity.paint_role = payload.role || "";
        (payload.slides || []).forEach(function (slide) {
            html += deckSlideMarkup(slide, number, identity);
            number += 1;
        });
    });
    root.setAttribute("data-role", (decks[0] && decks[0].role) || "principal");
    viewerState.deck = decks[0] || null;
    viewerState.totalSlides = number - 1;
    viewerState.currentSlide = 1;
    root.querySelector(".slide-deck-viewport").innerHTML = html;
    var buttons = "";
    var index;
    for (index = 1; index <= viewerState.totalSlides; index += 1) {
        buttons += '<button type="button" data-slide="' + index + '">' + index + "</button>";
    }
    root.querySelector(".slide-deck-thumbs").innerHTML = buttons;
    showDeckSlide(root, 1);
}

function exportAllDecks(root) {
    if (viewerState.seating) {
        return;
    }
    var note = root.querySelector('[data-deck="edit-note"]');
    var button = root.querySelector('[data-deck="export-all"]');
    viewerState.seating = true;
    if (button) {
        button.disabled = true;
    }
    if (note) {
        note.textContent = "جارٍ تجهيز خطط المدرسة الخمس…";
    }
    var chain = Promise.resolve([]);
    DECK_ROLES.forEach(function (record) {
        chain = chain.then(function (collected) {
            return fetch("/api/deck/seat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(deckSeatBody(record))
            }).then(function (response) {
                if (!response.ok) {
                    throw new Error("seat");
                }
                return response.json();
            }).then(function (payload) {
                collected.push(payload);
                return collected;
            });
        });
    });
    chain.then(function (decks) {
        paintDeckSlides(root, decks);
        if (note) {
            note.textContent = "الخطط الخمس جاهزة. من نافذة الطباعة اختر «حفظ بتنسيق PDF».";
        }
        printDeck(false);
    }).catch(function () {
        if (note) {
            note.textContent = "تعذر تجهيز خطط المدرسة.";
        }
    }).finally(function () {
        viewerState.seating = false;
        if (button) {
            button.disabled = false;
        }
    });
}

function fitDeckSlide(root) {
    var viewport = root.querySelector('.slide-deck-viewport');
    var slide = root.querySelector('.slide-deck-slide.is-current');
    if (!viewport || !slide) {
        return;
    }
    var natural = slide.offsetWidth || 1;
    var scale = viewport.clientWidth / natural;
    if (!isFinite(scale) || scale <= 0) {
        scale = 1;
    }
    root.style.setProperty('--deck-scale', String(scale));
    viewport.style.height = Math.max(240, Math.ceil(slide.offsetHeight * scale)) + 'px';
}

function showDeckSlide(root, index) {
    var next = Math.min(viewerState.totalSlides, Math.max(1, index));
    viewerState.currentSlide = next;
    Array.prototype.forEach.call(root.querySelectorAll('.slide-deck-slide'), function (slide) {
        var on = slide.getAttribute('data-slide') === String(next);
        slide.classList.toggle('is-current', on);
        slide.hidden = !on;
    });
    var counter = root.querySelector('.slide-deck-counter');
    if (counter) {
        counter.textContent = viewerState.totalSlides ? (next + ' من ' + viewerState.totalSlides) : '';
    }
    Array.prototype.forEach.call(root.querySelectorAll('.slide-deck-thumbs button'), function (button) {
        var on = button.getAttribute('data-slide') === String(next);
        if (on) {
            button.setAttribute('aria-current', 'true');
        } else {
            button.removeAttribute('aria-current');
        }
    });
    var prev = root.querySelector('[data-deck="prev"]');
    var nextButton = root.querySelector('[data-deck="next"]');
    if (prev) {
        prev.disabled = next === 1;
    }
    if (nextButton) {
        nextButton.disabled = next === viewerState.totalSlides;
    }
    fitDeckSlide(root);
}

function printDeck(oneSlide) {
    document.body.classList.toggle('print-deck-one', Boolean(oneSlide));
    if (window.openPrintPreview) {
        window.openPrintPreview('print-deck');
        return;
    }
    document.body.classList.add('print-deck');
    var root = document.querySelector('.slide-deck');
    var html = root ? root.outerHTML : '';
    function cleanup() {
        document.body.classList.remove('print-deck', 'print-deck-one');
    }
    if (!window.PrintEngine || typeof window.PrintEngine.gate !== 'function') {
        console.error('PrintEngine غير محمّل.');
        cleanup();
        return;
    }
    var printed = window.PrintEngine.gate(html, {
        multiPage: !oneSlide,
        orientation: 'landscape',
        docTitle: 'شرائح الخطة'
    });
    if (printed && typeof printed.finally === 'function') {
        printed.finally(cleanup);
    } else if (printed && typeof printed.then === 'function') {
        printed.then(cleanup, cleanup);
    } else {
        cleanup();
    }
}

function mountSlideDeck(pane) {
    viewerState.currentSlide = 0;
    viewerState.totalSlides = 0;
    viewerState.deck = null;
    viewerState.isEditMode = false;
    viewerState.isApproved = false;
    pane.innerHTML = '<div class="slide-deck">'
        + '<div class="slide-deck-toolbar">'
        + '<button type="button" class="deck-tool wash-back">العودة</button>'
        + '<button type="button" class="deck-tool" data-deck="print-one">طباعة الشريحة الحالية</button>'
        + '<button type="button" class="deck-tool" data-deck="print-all">طباعة الكل</button>'
        + '<button type="button" class="deck-tool" data-deck="export-all">تصدير الكل كـ PDF</button>'
        + '<label class="deck-role-label">الخطة'
        + '<select class="deck-role" data-deck="role" aria-label="الخطة المعروضة">'
        + DECK_ROLES.map(function (role) {
            var page = document.getElementById("plan-role");
            var selected = page && page.value ? page.value : "principal";
            return '<option value="' + role.id + '"' + (role.id === selected ? " selected" : "") + ">"
                + deckEscape(deckOptionLabel(role)) + "</option>";
        }).join("")
        + '</select></label>'
        + '<button type="button" class="deck-tool" data-deck="seat">تسكين خطتي</button>'
        + '<button type="button" class="deck-tool" data-deck="add-item">إضافة بند</button>'
        + '<button type="button" class="deck-tool" data-deck="edit" aria-pressed="false">تعديل</button>'
        + '</div>'
        + '<p class="slide-deck-note" data-deck="edit-note"></p>'
        + '<div class="slide-deck-stage">'
        + '<div class="slide-deck-nav"><button type="button" data-deck="prev" aria-label="الشريحة السابقة" disabled>›</button></div>'
        + '<div class="slide-deck-viewport"></div>'
        + '<div class="slide-deck-nav"><button type="button" data-deck="next" aria-label="الشريحة التالية" disabled>‹</button></div>'
        + '</div>'
        + '<p class="slide-deck-counter"></p>'
        + '<div class="slide-deck-thumbs"></div>'
        + '</div>';
    var root = pane.querySelector('.slide-deck');
    root.addEventListener('click', function (event) {
        var target = event.target.closest('[data-deck], .slide-deck-thumbs button, td[data-path], .deck-swot-cell');
        if (!target || !root.contains(target)) {
            return;
        }
        if (target.getAttribute('data-deck') === 'prev') {
            showDeckSlide(root, viewerState.currentSlide - 1);
        } else if (target.getAttribute('data-deck') === 'next') {
            showDeckSlide(root, viewerState.currentSlide + 1);
        } else if (target.getAttribute('data-slide')) {
            showDeckSlide(root, parseInt(target.getAttribute('data-slide'), 10));
        } else if (target.getAttribute('data-deck') === 'print-one') {
            printDeck(true);
        } else if (target.getAttribute('data-deck') === 'print-all') {
            printDeck(false);
        } else if (target.getAttribute('data-deck') === 'export-all') {
            exportAllDecks(root);
        } else if (target.getAttribute('data-deck') === 'seat') {
            seatDeck(root);
        } else if (target.getAttribute('data-deck') === 'add-item') {
            addDeckItem(root);
        } else if (target.getAttribute('data-deck') === 'drop') {
            dropDeckItem(root, target.getAttribute('data-code'));
        } else if (target.getAttribute('data-deck') === 'edit') {
            viewerState.isEditMode = !viewerState.isEditMode;
            target.setAttribute('aria-pressed', viewerState.isEditMode ? 'true' : 'false');
            root.classList.toggle('is-editing', viewerState.isEditMode);
            var note = root.querySelector('[data-deck="edit-note"]');
            if (note) {
                note.textContent = viewerState.isEditMode ? 'اضغط نص الخلية لتعديله. الحذف والإضافة يبقيان بعد إعادة التسكين.' : '';
            }
        } else if (viewerState.isEditMode && target.closest('td[data-path], .deck-swot-cell') && !target.closest('.deck-cell-input')) {
            openDeckCell(root, target.closest('td[data-path], .deck-swot-cell'));
        }
    });
    window.addEventListener('resize', function () {
        if (document.body.classList.contains('deck-open')) {
            fitDeckSlide(root);
        }
    });
    var rolePicker = root.querySelector('[data-deck="role"]');
    if (rolePicker) {
        rolePicker.addEventListener("change", function () {
            var page = document.getElementById("plan-role");
            if (page) {
                page.value = rolePicker.value;
            }
            seatDeck(root);
        });
    }
    var planRole = document.getElementById("plan-role");
    if (planRole && planRole.getAttribute("data-deck-bound") !== "1") {
        planRole.setAttribute("data-deck-bound", "1");
        planRole.addEventListener("change", function () {
            var open = document.querySelector(".slide-deck");
            if (!open || !document.body.classList.contains("deck-open")) {
                return;
            }
            var picker = open.querySelector('[data-deck="role"]');
            if (picker && picker.value !== planRole.value) {
                picker.value = planRole.value;
            }
            seatDeck(open);
        });
    }
    seatDeck(root);
    syncDeckPrintSheet();
}

window.mountSlideDeck = mountSlideDeck;
window.viewerState = viewerState;

window.addEventListener('keydown', function (event) {
    if (!document.body.classList.contains('deck-open')) {
        return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
    }
    var root = document.querySelector('.slide-deck');
    if (!root) {
        return;
    }
    var step = event.key === 'ArrowLeft' ? 1 : -1;
    showDeckSlide(root, viewerState.currentSlide + step);
});

var deckPageStyle = null;
var DECK_PAGE_CSS = '@page{size:297mm 210mm;margin:0 !important;'
    + '@top-left{content:none}@top-center{content:none}@top-right{content:none}'
    + '@bottom-left{content:none}@bottom-center{content:none}@bottom-right{content:none}}'
    + '@page slide-landscape{size:297mm 210mm;margin:0 !important;'
    + '@top-left{content:none}@top-center{content:none}@top-right{content:none}'
    + '@bottom-left{content:none}@bottom-center{content:none}@bottom-right{content:none}}';

function syncDeckPrintSheet() {
    var open = document.body.classList.contains('deck-open');
    if (!open) {
        if (deckPageStyle && deckPageStyle.parentNode) {
            deckPageStyle.parentNode.removeChild(deckPageStyle);
        }
        deckPageStyle = null;
        if (document.body.classList.contains('print-deck')) {
            document.body.classList.remove('print-deck');
        }
        return;
    }
    if (!document.body.classList.contains('print-deck')) {
        document.body.classList.add('print-deck');
    }
    if (!deckPageStyle) {
        deckPageStyle = document.createElement('style');
        deckPageStyle.id = 'deck-print-page';
        deckPageStyle.textContent = DECK_PAGE_CSS;
    }
    document.head.appendChild(deckPageStyle);
}

new MutationObserver(syncDeckPrintSheet).observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
});

window.addEventListener('beforeprint', syncDeckPrintSheet);
window.addEventListener('afterprint', function () {
    document.body.classList.remove('print-deck-one');
    syncDeckPrintSheet();
});

var deckPrintRequested = /[?&]deck=print(?:&|$)/.test(location.search);

function openDeckFromQuery() {
    if (!deckPrintRequested) {
        return;
    }
    if (document.body.classList.contains('deck-open') && document.querySelector('.slide-deck')) {
        return;
    }
    var pane = document.getElementById('erp-pane');
    var welcome = document.getElementById('erp-welcome');
    if (!pane || !window.erpBoards || typeof window.erpBoards['plan-deck'] !== 'function') {
        return;
    }
    try {
        pane.hidden = false;
        window.erpBoards['plan-deck'](pane);
    } catch (error) {
        pane.hidden = true;
        if (welcome) {
            welcome.hidden = false;
        }
        return;
    }
    if (!document.querySelector('.slide-deck')) {
        pane.hidden = true;
        if (welcome) {
            welcome.hidden = false;
        }
        return;
    }
    if (welcome) {
        welcome.hidden = true;
    }
}

openDeckFromQuery();
window.addEventListener('load', openDeckFromQuery);
