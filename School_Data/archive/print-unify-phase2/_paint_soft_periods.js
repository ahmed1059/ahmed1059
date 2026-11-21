    function paintSoftPeriods(pane, link) {
        var weekFocus = link && link.getAttribute("data-erp-filter") === "week";
        paint(pane, "/assets/dashboard/board-calendar.jpg",
            "<div class=\"soft-periods-board\">"
            + "<h1>الفترات اللاصفية</h1>"
            + "<p class=\"wash-hint\">بطاقة يوم واحدة للفترات الثلاث (اصطفاف، استراحة، صلاة). البيانات تبقى ثلاث صفوف في القاعدة، والشاهد من <b>visual_evidence</b> فقط.</p>"
            + "<div class=\"daily-stats\" id=\"soft-stats\"></div>"
            + "<div class=\"board-layout\">"
            + "<section class=\"board-card board-span\" id=\"soft-plan-card\"" + (weekFocus ? " hidden" : "") + ">"
            + "<h2>الخطة الزمنية اليومية</h2>"
            + "<p class=\"wash-note\" id=\"soft-plan-note\"></p>"
            + "<div class=\"program-table-wrap\"><table class=\"program-table data-table\"><thead><tr>"
            + "<th>الفترة</th><th>المدة</th><th>التوقيت</th><th>المهارة المستهدفة</th><th class=\"is-fit\">تعديل</th>"
            + "</tr></thead><tbody id=\"soft-plan-rows\"></tbody></table></div>"
            + "</section>"
            + "<section class=\"board-card board-span soft-day-board\">"
            + "<h2>متابعة اليوم</h2>"
            + "<div class=\"soft-week-picker\" id=\"soft-week-picker\">"
            + "<label class=\"soft-term-field\"><span>الفصل</span>"
            + "<select id=\"soft-term-filter\" aria-label=\"الفصل الدراسي\">"
            + "<option value=\"all\">كل الأسابيع</option>"
            + "<option value=\"1\">الفصل الأول</option>"
            + "<option value=\"2\">الفصل الثاني</option>"
            + "</select></label>"
            + "<div class=\"soft-week-chips\" id=\"soft-week-chips\" role=\"listbox\" aria-label=\"أسابيع العام\"></div>"
            + "<button type=\"button\" class=\"wash-save\" id=\"soft-week-today\">اليوم</button>"
            + "</div>"
            + "<div class=\"soft-day-chips\" id=\"soft-day-chips\" aria-label=\"أيام الأسبوع\"></div>"
            + "<div class=\"daily-toolbar soft-day-toolbar\">"
            + "<button type=\"button\" class=\"wash-save\" id=\"soft-day-save\">حفظ اليوم</button>"
            + "<button type=\"button\" class=\"wash-add\" id=\"soft-day-preview\">معاينة</button>"
            + "<button type=\"button\" class=\"wash-save\" id=\"soft-day-print\">طباعة</button>"
            + "<button type=\"button\" class=\"wash-add\" id=\"soft-day-fill\">تعبئة اليوم</button>"
            + "<button type=\"button\" class=\"wash-add\" id=\"soft-refresh\">تحديث</button>"
            + "<button class=\"wash-back\" type=\"button\">العودة</button>"
            + "</div>"
            + "<p class=\"wash-note\" id=\"soft-follow-note\"></p>"
            + "<article class=\"soft-day-card\" id=\"soft-day-card\">"
            + "<header class=\"soft-day-card-head\" id=\"soft-day-card-head\"></header>"
            + "<div class=\"program-table-wrap\"><table class=\"program-table data-table soft-day-table\"><thead><tr>"
            + "<th>الفترة</th><th>التنفيذ</th><th>الشاهد</th><th>المرفق</th><th>ملاحظة</th>"
            + "</tr></thead><tbody id=\"soft-day-rows\"></tbody></table></div>"
            + "<div class=\"soft-day-tools\" id=\"soft-day-tools\">"
            + "<div class=\"soft-upload-menu\">"
            + "<button type=\"button\" class=\"wash-save\" id=\"soft-upload-toggle\" data-soft-upload-toggle>رفع شاهد ▾</button>"
            + "<div class=\"soft-upload-panel\" id=\"soft-upload-panel\" hidden>"
            + "<button type=\"button\" data-soft-upload=\"file\">ملف</button>"
            + "<button type=\"button\" data-soft-upload=\"camera\">كاميرا</button>"
            + "<button type=\"button\" data-soft-upload=\"link\">رابط</button>"
            + "</div></div>"
            + "<span class=\"soft-upload-hint\" id=\"soft-upload-hint\">اختر صف فترة ثم ارفع الشاهد.</span>"
            + "<div class=\"ve-link-row soft-day-link-row\" id=\"soft-link-row\" hidden>"
            + "<input type=\"url\" id=\"soft-link-url\" placeholder=\"https://...\" autocomplete=\"off\">"
            + "<input type=\"text\" id=\"soft-link-name\" placeholder=\"اسم الرابط (اختياري)\" autocomplete=\"off\">"
            + "<button type=\"button\" class=\"wash-save\" id=\"soft-link-save\">حفظ الرابط</button>"
            + "</div>"
            + "<input type=\"file\" id=\"soft-file-input\" accept=\"image/*,video/mp4,video/webm,application/pdf\" multiple hidden>"
            + "<input type=\"file\" id=\"soft-camera-input\" accept=\"image/*\" capture=\"environment\" hidden>"
            + "</div>"
            + "</article>"
            + "<div class=\"soft-fill-defaults no-print\">"
            + "<label class=\"soft-fill-field\"><span>حالة التعبئة</span><select id=\"soft-fill-status\">"
            + "<option value=\"منفّذ\" selected>منفّذ</option><option value=\"جزئي\">جزئي</option>"
            + "<option value=\"لم يُنفّذ\">لم يُنفّذ</option><option value=\"إجازة\">إجازة</option></select></label>"
            + "<label class=\"soft-fill-field\"><span>توثيق التعبئة</span><select id=\"soft-fill-evidence\">"
            + "<option value=\"غير مطلوب\">غير مطلوب</option><option value=\"ناقص\">ناقص</option>"
            + "<option value=\"مرفوع\" selected>مرفوع</option></select></label>"
            + "</div>"
            + "</section>"
            + "<section class=\"board-card board-span\" id=\"soft-editor\" hidden>"
            + "<h2 id=\"soft-editor-title\">تعديل الفترة</h2>"
            + "<form id=\"soft-slot-form\" class=\"facility-fields\">"
            + "<input type=\"hidden\" name=\"slot_code\" value=\"\">"
            + "<label class=\"wash-field\"><span>عنوان الفترة</span><input name=\"title\" type=\"text\" required autocomplete=\"off\"></label>"
            + "<label class=\"wash-field\"><span>المدة (دقائق)</span><input name=\"minutes\" type=\"number\" min=\"1\" max=\"120\" required></label>"
            + "<label class=\"wash-field\"><span>التوقيت الإرشادي</span><input name=\"time_hint\" type=\"text\" autocomplete=\"off\"></label>"
            + "<label class=\"wash-field wash-span\"><span>المهارة المستهدفة</span><textarea name=\"skill_focus\" rows=\"2\"></textarea></label>"
            + "<div class=\"wash-actions facility-actions\">"
            + "<button class=\"wash-save\" type=\"submit\">حفظ التعديل</button>"
            + "<button class=\"wash-cancel\" type=\"button\" id=\"soft-cancel\">إلغاء</button>"
            + "</div><p class=\"wash-note\"></p></form>"
            + "</section>"
            + "</div></div>");

        var planNote = pane.querySelector("#soft-plan-note");
        var followNote = pane.querySelector("#soft-follow-note");
        var editor = pane.querySelector("#soft-editor");
        var form = pane.querySelector("#soft-slot-form");
        var formNote = form.querySelector(".wash-note");
        var state = {
            bundle: null,
            selectedWeekStart: "",
            selectedDayIso: "",
            selectedSlot: "",
            termFilter: "all",
            loadSeq: 0,
            weeks: []
        };

        function headers() {
            return window.board1059Access ? window.board1059Access.headers() : { "Content-Type": "application/json" };
        }
        function escapeHtml(value) {
            return String(value == null ? "" : value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\"/g, "&quot;");
        }
        function roleLabel(code) {
            var map = {
                vice_students: "وكيل شؤون الطلاب",
                activity_leader: "رائد النشاط",
                principal: "مدير المدرسة"
            };
            return map[code] || code || "";
        }
        function todayKey() {
            return api.todayIso ? api.todayIso() : new Date().toISOString().slice(0, 10);
        }
        function sundayOf(iso) {
            var parts = String(iso || "").split("-");
            if (parts.length !== 3) {
                return todayKey();
            }
            var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
            d.setDate(d.getDate() - d.getDay());
            return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        }
        function addDaysIso(iso, days) {
            var parts = String(iso || "").split("-");
            var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
            d.setDate(d.getDate() + days);
            return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        }
        function formatShort(iso) {
            if (!iso) {
                return "";
            }
            if (typeof formatDisplayDate === "function") {
                return formatDisplayDate(iso, "gregorian");
            }
            return iso;
        }
        function yearStartIso() {
            var start = "2026-08-23";
            if (window.academicCalendarData && window.academicCalendarData.length) {
                var hit = window.academicCalendarData.filter(function (item) {
                    return String(item.title || "").indexOf("بداية العام") >= 0 && String(item.year || "").indexOf("1448") >= 0;
                })[0] || window.academicCalendarData.filter(function (item) {
                    return String(item.title || "").indexOf("بداية العام") >= 0;
                })[0];
                if (hit && hit.gregorian) {
                    var bits = String(hit.gregorian).split("/");
                    if (bits.length === 3) {
                        start = bits[2] + "-" + bits[1].padStart(2, "0") + "-" + bits[0].padStart(2, "0");
                    }
                }
            }
            return sundayOf(start);
        }
        function weekCountLimit() {
            if (typeof weekCount === "function") {
                return weekCount();
            }
            if (typeof termWeekCount === "number" && termWeekCount >= 10) {
                return termWeekCount;
            }
            return 18;
        }
        function buildWeeks() {
            var start = yearStartIso();
            var total = weekCountLimit();
            var list = [];
            var i;
            for (i = 0; i < total; i += 1) {
                var ws = addDaysIso(start, i * 7);
                var we = addDaysIso(ws, 4);
                list.push({
                    number: i + 1,
                    weekStart: ws,
                    weekEnd: we,
                    term: i < Math.ceil(total / 2) ? "1" : "2"
                });
            }
            return list;
        }
        function statusOptions(selected) {
            return ["منفّذ", "جزئي", "لم يُنفّذ", "إجازة"].map(function (status) {
                return "<option value=\"" + status + "\"" + (selected === status ? " selected" : "") + ">" + status + "</option>";
            }).join("");
        }
        function evidenceOptions(selected) {
            return ["غير مطلوب", "ناقص", "مرفوع"].map(function (status) {
                return "<option value=\"" + status + "\"" + (selected === status ? " selected" : "") + ">" + status + "</option>";
            }).join("");
        }
        function softEvidenceText(item) {
            var saved = String(item.evidence_note || "").trim();
            if (saved) {
                return saved;
            }
            if (item.evidence_status !== "مرفوع" && item.evidence_status !== "ناقص") {
                return "";
            }
            var dayText = formatShort(item.day_iso);
            return "بطاقة شاهد: " + (item.title || "الفترة اللاصفية") + (dayText ? " — " + dayText : "");
        }
        function softRecordNo(item) {
            if (item && item.id) {
                return "SOFT-" + item.id;
            }
            if (item && item.day_iso && item.slot_code) {
                return "SOFT-" + item.day_iso + "-" + item.slot_code;
            }
            return "";
        }
        function visualItemsOnly(item) {
            var raw = (item && item.evidence_media && item.evidence_media.items)
                ? item.evidence_media.items
                : [];
            return (window.board1059VisualEvidence
                ? window.board1059VisualEvidence.parseItems(raw)
                : raw).filter(function (entry) {
                return entry && Number(entry.id || 0) > 0;
            });
        }
        function mediaThumbsHtml(items) {
            var list = visualItemsOnly({ evidence_media: { items: items } });
            if (!list.length) {
                return "<span class=\"soft-day-empty-media\">—</span>";
            }
            return "<div class=\"soft-day-thumbs\">" + list.map(function (item) {
                var id = Number(item.id || 0);
                var inner = item.kind === "image"
                    ? "<img src=\"" + escapeHtml(item.url) + "\" alt=\"\">"
                    : "<span class=\"soft-day-file-kind\">" + escapeHtml(item.kind || "ملف") + "</span>";
                return "<figure class=\"soft-day-thumb\" data-ve-id=\"" + id + "\">"
                    + inner
                    + "<button type=\"button\" class=\"soft-day-thumb-del\" data-ve-remove=\"" + id + "\" title=\"حذف\">×</button>"
                    + "</figure>";
            }).join("") + "</div>";
        }
        function dayRows(dayIso) {
            var order = { lineup: 1, break: 2, prayer: 3 };
            return ((state.bundle && state.bundle.follow && state.bundle.follow.rows) || [])
                .filter(function (item) { return item.day_iso === dayIso; })
                .slice()
                .sort(function (a, b) {
                    return (order[a.slot_code] || 9) - (order[b.slot_code] || 9);
                });
        }
        function pickDefaultDay(follow) {
            var today = todayKey();
            var days = (follow && follow.days) || [];
            var i;
            for (i = 0; i < days.length; i += 1) {
                if (days[i].day_iso === today) {
                    return today;
                }
            }
            return days[0] ? days[0].day_iso : "";
        }
        function renderWeekPicker() {
            var host = pane.querySelector("#soft-week-chips");
            if (!host) {
                return;
            }
            var filtered = state.weeks.filter(function (week) {
                return state.termFilter === "all" || week.term === state.termFilter;
            });
            host.innerHTML = filtered.map(function (week) {
                var on = week.weekStart === state.selectedWeekStart ? " is-on" : "";
                return "<button type=\"button\" class=\"soft-week-chip" + on + "\" data-week-start=\"" + escapeHtml(week.weekStart) + "\" role=\"option\" aria-selected=\"" + (on ? "true" : "false") + "\">"
                    + "<strong>أسبوع " + week.number + "</strong>"
                    + "<small>" + escapeHtml(formatShort(week.weekStart)) + " — " + escapeHtml(formatShort(week.weekEnd)) + "</small>"
                    + "</button>";
            }).join("");
            var chip = host.querySelector(".soft-week-chip.is-on");
            if (chip && typeof chip.scrollIntoView === "function") {
                chip.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
            }
        }
        function renderDayChips() {
            var host = pane.querySelector("#soft-day-chips");
            var follow = state.bundle && state.bundle.follow ? state.bundle.follow : {};
            var days = follow.days || [];
            if (!host) {
                return;
            }
            host.innerHTML = days.map(function (day) {
                var on = day.day_iso === state.selectedDayIso ? " is-on" : "";
                var todayMark = day.day_iso === todayKey() ? " is-today" : "";
                return "<button type=\"button\" class=\"soft-day-chip" + on + todayMark + "\" data-day-iso=\"" + escapeHtml(day.day_iso) + "\">"
                    + "<strong>" + escapeHtml(day.weekday || "") + "</strong>"
                    + "<small>" + escapeHtml(formatShort(day.day_iso)) + "</small>"
                    + "</button>";
            }).join("") || "<span class=\"wash-hint\">لا أيام في هذا الأسبوع.</span>";
        }
        function renderDayCard() {
            var head = pane.querySelector("#soft-day-card-head");
            var body = pane.querySelector("#soft-day-rows");
            var rows = dayRows(state.selectedDayIso);
            var dayMeta = ((state.bundle && state.bundle.follow && state.bundle.follow.days) || []).filter(function (d) {
                return d.day_iso === state.selectedDayIso;
            })[0];
            if (head) {
                head.innerHTML = "<div><strong>" + escapeHtml((dayMeta && dayMeta.weekday) || "") + "</strong>"
                    + "<span>" + escapeHtml(formatShort(state.selectedDayIso)) + "</span></div>"
                    + "<em class=\"soft-day-badge\">" + (state.selectedDayIso === todayKey() ? "اليوم" : "يوم الأسبوع") + "</em>";
            }
            if (!body) {
                return;
            }
            if (!rows.length) {
                body.innerHTML = "<tr><td colspan=\"5\">لا صفوف لهذا اليوم.</td></tr>";
                return;
            }
            body.innerHTML = rows.map(function (item, index) {
                var media = visualItemsOnly(item);
                var selected = state.selectedSlot === item.slot_code ? " is-selected" : "";
                var tone = item.status === "منفّذ" && item.evidence_status === "مرفوع"
                    ? "is-ready"
                    : (item.status === "منفّذ" ? "is-warn" : "is-muted");
                return "<tr class=\"soft-day-row " + tone + selected + "\" data-slot=\"" + escapeHtml(item.slot_code) + "\" data-entity-key=\"" + escapeHtml(item.entity_key || "") + "\" data-index=\"" + index + "\">"
                    + "<td class=\"is-name\"><strong>" + escapeHtml(item.title || "") + "</strong>"
                    + "<small class=\"program-meta\">" + escapeHtml(String(item.minutes || "") + " د") + "</small></td>"
                    + "<td><select data-field=\"status\">" + statusOptions(item.status) + "</select></td>"
                    + "<td><select data-field=\"evidence_status\">" + evidenceOptions(item.evidence_status) + "</select></td>"
                    + "<td class=\"soft-day-media-cell\">" + mediaThumbsHtml(media) + "</td>"
                    + "<td><input type=\"text\" data-field=\"note\" value=\"" + escapeHtml(item.note || "") + "\" placeholder=\"ملاحظة\" autocomplete=\"off\">"
                    + "<input type=\"hidden\" data-field=\"evidence_note\" value=\"" + escapeHtml(softEvidenceText(item)) + "\"></td>"
                    + "</tr>";
            }).join("");
            updateUploadHint();
        }
        function updateUploadHint() {
            var hint = pane.querySelector("#soft-upload-hint");
            if (!hint) {
                return;
            }
            if (!state.selectedSlot) {
                hint.textContent = "اختر صف فترة ثم ارفع الشاهد.";
                return;
            }
            var titles = { lineup: "الاصطفاف", break: "الاستراحة", prayer: "الصلاة" };
            hint.textContent = "الرفع لـ: " + (titles[state.selectedSlot] || state.selectedSlot);
        }
        function selectedEntityKey() {
            if (!state.selectedDayIso || !state.selectedSlot) {
                return "";
            }
            return state.selectedDayIso + "|" + state.selectedSlot;
        }
        function render() {
            var bundle = state.bundle || {};
            var plan = bundle.plan || {};
            var follow = bundle.follow || {};
            var slots = plan.slots || [];
            var total = plan.total_minutes || 0;
            pane.querySelector("#soft-stats").innerHTML = ""
                + "<div class=\"daily-stat\"><b>" + total + "</b><span>دقيقة يومياً</span></div>"
                + "<div class=\"daily-stat\"><b>60</b><span>المستهدف</span></div>"
                + "<div class=\"daily-stat\"><b>" + ((follow.stats && follow.stats.done) || 0) + "</b><span>منفّذ هذا الأسبوع</span></div>"
                + "<div class=\"daily-stat\"><b>" + ((follow.stats && follow.stats.missing_evidence) || 0) + "</b><span>شواهد ناقصة</span></div>";
            planNote.textContent = plan.balanced
                ? "المجموع " + total + " دقيقة — مطابق للمستهدف اليومي."
                : "المجموع " + total + " دقيقة — عدّل المدد ليصل المجموع إلى 60.";
            pane.querySelector("#soft-plan-rows").innerHTML = slots.map(function (item) {
                return "<tr data-code=\"" + escapeHtml(item.slot_code) + "\">"
                    + "<td class=\"is-name\"><strong>" + escapeHtml(item.title) + "</strong>"
                    + "<small class=\"program-meta\">" + escapeHtml((item.is_overridden ? "معدّلة — " : "تلقائية — ") + roleLabel(item.owner_role)) + "</small></td>"
                    + "<td>" + escapeHtml(String(item.minutes)) + " د</td>"
                    + "<td>" + escapeHtml(item.time_hint || "") + "</td>"
                    + "<td>" + escapeHtml(item.skill_focus || "") + "</td>"
                    + "<td class=\"is-fit\"><button type=\"button\" class=\"program-edit\" data-edit-slot=\"" + escapeHtml(item.slot_code) + "\">تعديل</button></td>"
                    + "</tr>";
            }).join("") || "<tr><td colspan=\"5\">لا فترات بعد.</td></tr>";
            renderWeekPicker();
            renderDayChips();
            renderDayCard();
            followNote.textContent = "أسبوع يبدأ " + formatShort(follow.week_start || state.selectedWeekStart)
                + " — بطاقة اليوم للفترات الثلاث، والطباعة الافتراضية صفحة أفقية واحدة.";
        }
        function loadWeek(weekStart, preferDay) {
            var target = sundayOf(weekStart || todayKey());
            var seq = ++state.loadSeq;
            followNote.textContent = "جاري تحميل الأسبوع…";
            return fetch("/api/soft-periods/autofill?week_start=" + encodeURIComponent(target), {
                method: "POST",
                headers: headers()
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر تحميل الفترات اللاصفية");
                    }
                    return payload;
                });
            }).then(function (payload) {
                if (seq !== state.loadSeq) {
                    return null;
                }
                state.bundle = payload;
                state.selectedWeekStart = (payload.follow && payload.follow.week_start) || target;
                state.selectedDayIso = preferDay || pickDefaultDay(payload.follow);
                if (!state.selectedSlot) {
                    state.selectedSlot = "lineup";
                }
                render();
                return payload;
            }).catch(function (error) {
                if (seq !== state.loadSeq) {
                    return null;
                }
                followNote.textContent = error.message || "تعذر التحميل.";
                return null;
            });
        }
        function applyFollowPayload(follow, message) {
            if (!state.bundle) {
                state.bundle = {};
            }
            state.bundle.follow = follow;
            if (follow && follow.week_start) {
                state.selectedWeekStart = follow.week_start;
            }
            render();
            followNote.textContent = message || "تم التحديث.";
        }
        function authHeadersNoContentType() {
            var auth = headers();
            var uploadHeaders = {};
            Object.keys(auth).forEach(function (key) {
                if (String(key).toLowerCase() !== "content-type") {
                    uploadHeaders[key] = auth[key];
                }
            });
            return uploadHeaders;
        }
        function refreshAfterVisual(payload, message) {
            if (payload && payload.rows) {
                applyFollowPayload(payload, message);
                publishSuite("soft-periods");
                return;
            }
            loadWeek(state.selectedWeekStart, state.selectedDayIso).then(function () {
                followNote.textContent = message || "تم التحديث.";
                publishSuite("soft-periods");
            });
        }
        function uploadVisualFiles(fileList) {
            var key = selectedEntityKey();
            if (!key) {
                followNote.textContent = "اختر صف الفترة أولًا.";
                return;
            }
            if (!fileList || !fileList.length) {
                return;
            }
            var formData = new FormData();
            formData.append("entity_type", "soft_period");
            formData.append("entity_key", key);
            formData.append("register_key", "soft-periods");
            Array.prototype.forEach.call(fileList, function (file) {
                formData.append("files", file, file.name || "capture.jpg");
            });
            followNote.textContent = "جارٍ رفع الشاهد…";
            fetch("/api/visual-evidence", {
                method: "POST",
                headers: authHeadersNoContentType(),
                body: formData
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر رفع الشاهد");
                    }
                    return payload;
                });
            }).then(function (payload) {
                refreshAfterVisual(payload, "أُرفق الشاهد وحُفظ في visual_evidence.");
            }).catch(function (error) {
                followNote.textContent = error.message || "تعذر رفع الشاهد.";
            });
        }
        function saveVisualLink() {
            var key = selectedEntityKey();
            var urlInput = pane.querySelector("#soft-link-url");
            var nameInput = pane.querySelector("#soft-link-name");
            if (!key) {
                followNote.textContent = "اختر صف الفترة أولًا.";
                return;
            }
            var formData = new FormData();
            formData.append("entity_type", "soft_period");
            formData.append("entity_key", key);
            formData.append("register_key", "soft-periods");
            formData.append("link_url", urlInput ? urlInput.value.trim() : "");
            formData.append("link_name", nameInput ? nameInput.value.trim() : "");
            followNote.textContent = "جارٍ حفظ الرابط…";
            fetch("/api/visual-evidence", {
                method: "POST",
                headers: authHeadersNoContentType(),
                body: formData
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر حفظ الرابط");
                    }
                    return payload;
                });
            }).then(function (payload) {
                var row = pane.querySelector("#soft-link-row");
                if (row) {
                    row.hidden = true;
                }
                refreshAfterVisual(payload, "حُفظ رابط الشاهد.");
            }).catch(function (error) {
                followNote.textContent = error.message || "تعذر حفظ الرابط.";
            });
        }
        function deleteVisual(id) {
            followNote.textContent = "جارٍ حذف المرفق…";
            fetch("/api/visual-evidence/delete", {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({ id: Number(id || 0) })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر حذف المرفق");
                    }
                    return payload;
                });
            }).then(function (payload) {
                refreshAfterVisual(payload, "حُذف المرفق من visual_evidence.");
            }).catch(function (error) {
                followNote.textContent = error.message || "تعذر حذف المرفق.";
            });
        }
        function collectDayBodies() {
            var rows = dayRows(state.selectedDayIso);
            var trs = pane.querySelectorAll("#soft-day-rows tr.soft-day-row");
            var bodies = [];
            Array.prototype.forEach.call(trs, function (tr, index) {
                var item = rows[index];
                if (!item) {
                    return;
                }
                var evidenceStatus = tr.querySelector("[data-field=\"evidence_status\"]").value;
                var noteField = tr.querySelector("[data-field=\"evidence_note\"]");
                var body = {
                    day_iso: item.day_iso,
                    slot_code: item.slot_code,
                    status: tr.querySelector("[data-field=\"status\"]").value,
                    evidence_status: evidenceStatus,
                    note: tr.querySelector("[data-field=\"note\"]").value.trim(),
                    evidence_note: noteField ? noteField.value.trim() : (item.evidence_note || "")
                };
                if (body.evidence_status === "مرفوع" && !body.evidence_note) {
                    body.evidence_note = softEvidenceText({
                        title: item.title,
                        day_iso: item.day_iso,
                        evidence_status: "مرفوع",
                        evidence_note: ""
                    });
                }
                bodies.push(body);
            });
            return bodies;
        }
        function saveDay() {
            var bodies = collectDayBodies();
            if (!bodies.length) {
                followNote.textContent = "لا صفوف للحفظ.";
                return Promise.resolve();
            }
            followNote.textContent = "جارٍ حفظ اليوم…";
            var chain = Promise.resolve();
            bodies.forEach(function (body) {
                chain = chain.then(function () {
                    return fetch("/api/soft-periods/follow", {
                        method: "POST",
                        headers: headers(),
                        body: JSON.stringify(body)
                    }).then(function (response) {
                        return response.json().then(function (payload) {
                            if (!response.ok) {
                                throw new Error(payload.detail || "تعذر حفظ المتابعة");
                            }
                            return payload;
                        });
                    });
                });
            });
            return chain.then(function (follow) {
                applyFollowPayload(follow, "حُفظت متابعة اليوم للفترات الثلاث.");
                publishSuite("soft-periods");
            }).catch(function (error) {
                followNote.textContent = error.message || "تعذر حفظ اليوم.";
            });
        }
        function bulkFill(dayIso) {
            if (!state.bundle || !state.bundle.follow) {
                return;
            }
            var status = pane.querySelector("#soft-fill-status").value;
            var evidence = pane.querySelector("#soft-fill-evidence").value;
            followNote.textContent = "جارٍ تعبئة اليوم…";
            fetch("/api/soft-periods/follow-bulk", {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({
                    week_start: state.selectedWeekStart || state.bundle.follow.week_start || "",
                    day_iso: dayIso || state.selectedDayIso || "",
                    status: status,
                    evidence_status: evidence
                })
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر التعبئة الجماعية");
                    }
                    return payload;
                });
            }).then(function (follow) {
                applyFollowPayload(follow, "عُبئ اليوم بالقيم المختارة.");
                publishSuite("soft-periods");
            }).catch(function (error) {
                followNote.textContent = error.message || "تعذر التعبئة الجماعية.";
            });
        }
        function buildTriplePayload(dayIso) {
            var rows = dayRows(dayIso || state.selectedDayIso);
            if (!rows.length) {
                return null;
            }
            var first = rows[0];
            var dayText = formatShort(first.day_iso);
            var dayHijri = typeof hijriFromDate === "function" ? hijriFromDate(first.day_iso) : "";
            return {
                hijri: dayHijri || "",
                dateLine: (first.weekday ? first.weekday + " — " : "")
                    + (dayHijri && dayText ? dayHijri + " الموافق " + dayText : (dayText || first.day_iso)),
                columns: rows.map(function (item) {
                    return {
                        title: item.title || item.slot_code,
                        recordNo: softRecordNo(item),
                        status: item.status || "",
                        images: visualItemsOnly(item)
                    };
                })
            };
        }
        function openTriplePrint(previewOnly) {
            var payload = buildTriplePayload(state.selectedDayIso);
            if (!payload || !window.board1059Kernel || !window.board1059Kernel.softTriple) {
                followNote.textContent = "لا بيانات لطباعة الفترات الثلاث لهذا اليوم.";
                return;
            }
            window.board1059Kernel.softTriple(payload, previewOnly !== false);
            followNote.textContent = previewOnly === false
                ? "جاري طباعة بطاقة الفترات الثلاث."
                : "معاينة بطاقة الفترات الثلاث جاهزة.";
        }
        function goToday() {
            var today = todayKey();
            var week = sundayOf(today);
            state.termFilter = "all";
            pane.querySelector("#soft-term-filter").value = "all";
            loadWeek(week, today);
        }

        state.weeks = buildWeeks();
        state.selectedWeekStart = sundayOf(todayKey());
        state.termFilter = "all";

        pane.querySelector("#soft-term-filter").addEventListener("change", function (event) {
            state.termFilter = event.target.value || "all";
            renderWeekPicker();
        });
        pane.querySelector("#soft-week-chips").addEventListener("click", function (event) {
            var chip = event.target.closest("[data-week-start]");
            if (!chip) {
                return;
            }
            loadWeek(chip.getAttribute("data-week-start") || "");
        });
        pane.querySelector("#soft-week-today").addEventListener("click", goToday);
        pane.querySelector("#soft-day-chips").addEventListener("click", function (event) {
            var chip = event.target.closest("[data-day-iso]");
            if (!chip) {
                return;
            }
            state.selectedDayIso = chip.getAttribute("data-day-iso") || "";
            state.selectedSlot = "lineup";
            renderDayChips();
            renderDayCard();
        });
        pane.querySelector("#soft-day-rows").addEventListener("click", function (event) {
            var removeBtn = event.target.closest("[data-ve-remove]");
            if (removeBtn) {
                event.preventDefault();
                deleteVisual(removeBtn.getAttribute("data-ve-remove"));
                return;
            }
            var row = event.target.closest("tr.soft-day-row");
            if (!row) {
                return;
            }
            state.selectedSlot = row.getAttribute("data-slot") || "";
            renderDayCard();
        });
        pane.querySelector("#soft-day-save").addEventListener("click", function () {
            saveDay();
        });
        pane.querySelector("#soft-day-preview").addEventListener("click", function () {
            openTriplePrint(true);
        });
        pane.querySelector("#soft-day-print").addEventListener("click", function () {
            openTriplePrint(false);
        });
        pane.querySelector("#soft-day-fill").addEventListener("click", function () {
            bulkFill(state.selectedDayIso);
        });
        pane.querySelector("#soft-refresh").addEventListener("click", function () {
            loadWeek(state.selectedWeekStart, state.selectedDayIso);
        });
        pane.querySelector("#soft-upload-toggle").addEventListener("click", function () {
            var panel = pane.querySelector("#soft-upload-panel");
            if (panel) {
                panel.hidden = !panel.hidden;
            }
        });
        pane.querySelector("#soft-upload-panel").addEventListener("click", function (event) {
            var btn = event.target.closest("[data-soft-upload]");
            if (!btn) {
                return;
            }
            var mode = btn.getAttribute("data-soft-upload");
            var panel = pane.querySelector("#soft-upload-panel");
            if (panel) {
                panel.hidden = true;
            }
            if (!selectedEntityKey()) {
                followNote.textContent = "اختر صف الفترة أولًا.";
                return;
            }
            if (mode === "file") {
                pane.querySelector("#soft-file-input").click();
                return;
            }
            if (mode === "camera") {
                var camFallback = function () {
                    pane.querySelector("#soft-camera-input").click();
                };
                if (window.board1059VisualEvidence && window.board1059VisualEvidence.openCamera) {
                    window.board1059VisualEvidence.openCamera(function (blob, filename) {
                        var file = new File([blob], filename || "camera.jpg", { type: blob.type || "image/jpeg" });
                        uploadVisualFiles([file]);
                    }, camFallback);
                } else {
                    camFallback();
                }
                return;
            }
            if (mode === "link") {
                var linkRow = pane.querySelector("#soft-link-row");
                if (linkRow) {
                    linkRow.hidden = !linkRow.hidden;
                }
            }
        });
        pane.querySelector("#soft-file-input").addEventListener("change", function (event) {
            uploadVisualFiles(event.target.files);
            event.target.value = "";
        });
        pane.querySelector("#soft-camera-input").addEventListener("change", function (event) {
            uploadVisualFiles(event.target.files);
            event.target.value = "";
        });
        pane.querySelector("#soft-link-save").addEventListener("click", saveVisualLink);
        pane.querySelector("#soft-plan-rows").addEventListener("click", function (event) {
            var button = event.target.closest("[data-edit-slot]");
            if (!button || !state.bundle) {
                return;
            }
            var code = button.getAttribute("data-edit-slot");
            var slot = (state.bundle.plan.slots || []).filter(function (item) {
                return item.slot_code === code;
            })[0];
            if (!slot) {
                return;
            }
            editor.hidden = false;
            pane.querySelector("#soft-editor-title").textContent = "تعديل: " + slot.title;
            form.elements.slot_code.value = slot.slot_code;
            form.elements.title.value = slot.title || "";
            form.elements.minutes.value = slot.minutes || 0;
            form.elements.time_hint.value = slot.time_hint || "";
            form.elements.skill_focus.value = slot.skill_focus || "";
            formNote.textContent = "";
        });
        pane.querySelector("#soft-cancel").addEventListener("click", function () {
            editor.hidden = true;
            formNote.textContent = "";
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var body = {
                slot_code: form.elements.slot_code.value,
                title: form.elements.title.value.trim(),
                minutes: Number(form.elements.minutes.value),
                time_hint: form.elements.time_hint.value.trim(),
                skill_focus: form.elements.skill_focus.value.trim(),
                owner_role: "",
                sort_order: 0
            };
            var current = (state.bundle && state.bundle.plan.slots || []).filter(function (item) {
                return item.slot_code === body.slot_code;
            })[0];
            if (current) {
                body.owner_role = current.owner_role || "";
                body.sort_order = current.sort_order || 0;
            }
            formNote.textContent = "جارٍ الحفظ…";
            fetch("/api/soft-periods/slot", {
                method: "POST",
                headers: headers(),
                body: JSON.stringify(body)
            }).then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(payload.detail || "تعذر الحفظ");
                    }
                    return payload;
                });
            }).then(function (plan) {
                if (!state.bundle) {
                    state.bundle = {};
                }
                state.bundle.plan = plan;
                editor.hidden = true;
                render();
                planNote.textContent = "حُفظ التعديل على الخطة.";
                publishSuite("soft-periods");
            }).catch(function (error) {
                formNote.textContent = error.message || "تعذر الحفظ.";
            });
        });

        window.addEventListener("dataChanged", function (event) {
            var source = event && event.detail && event.detail.source;
            if (source && source !== "soft-periods" && source !== "visual-evidence") {
                return;
            }
            if (!pane.isConnected) {
                return;
            }
            loadWeek(state.selectedWeekStart, state.selectedDayIso);
        });

        loadWeek(state.selectedWeekStart, todayKey());
    }
