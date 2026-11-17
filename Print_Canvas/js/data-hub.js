/* ترابط الشاشات بمصدر واحد. الحفظ يطلق dataChanged، والشاشة المفتوحة تعيد القراءة. */
(function () {
    var cache = [];
    var dependents = {
        staff: ["staff-registry", "leadership", "planning-team", "intro", "signature"],
        students: ["school-slide", "absence"],
        indicators: ["indicator-registry", "domains-slide", "ssot-metrics"],
        nafs: ["nafs-card", "nafs-slide", "ssot-metrics"],
        metrics: ["ssot-metrics", "nafs-card", "domains-slide"],
        settings: ["ssot-metrics"],
        improvement: ["improvement-plan", "improvement-slide"],
        programs: ["school-programs", "program-slide", "school-plan"],
        "operational-plan": ["school-plan", "school-plan-slide", "home-summary"],
        leadership: ["planning-team", "intro", "signature"],
        councils: ["committees-home", "councils", "command-attention"],
        tasks: ["command-attention"],
        "soft-periods": ["command-attention"],
        calendar: ["soft-periods", "command-attention"],
        registers: ["command-attention"],
        "visual-evidence": ["command-attention"]
    };
    var linked = null;
    var SINGLE_KEYS = ["principal", "educationalGuide", "schoolVice", "activityLeader", "viceTeachers", "studentsVice", "studentCounselor", "primaryCounselor"];
    var LIST_KEYS = ["viceTeachersList", "studentsVices", "studentCounselors"];
    var PLACE_LABEL = {
        principal: "المقدمة والتوقيع",
        viceTeachers: "فريق التخطيط",
        viceTeachersList: "فريق التخطيط",
        studentsVice: "فريق التخطيط",
        studentsVices: "فريق التخطيط",
        studentCounselor: "فريق التخطيط",
        studentCounselors: "فريق التخطيط",
        primaryCounselor: "فريق التخطيط",
        activityLeader: "فريق التخطيط",
        schoolVice: "التشكيل القيادي",
        educationalGuide: "التشكيل القيادي"
    };

    function leadership() {
        try {
            return JSON.parse(localStorage.getItem("board1059.leadership") || "null") || {};
        } catch (error) {
            return {};
        }
    }

    function writeLeadership(data) {
        localStorage.setItem("board1059.leadership", JSON.stringify(data));
    }

    function personFrom(row) {
        return {
            id: row.id,
            name: row.name,
            nationalId: row.id,
            role: row.role || "",
            specialty: row.specialty || "",
            phone: row.mobile || "",
            active: row.active !== false
        };
    }

    function pour(list) {
        cache = list;
        if (!linked) {
            return;
        }
        linked.length = 0;
        list.forEach(function (item) {
            linked.push(item);
        });
    }

    function announce(source) {
        window.dispatchEvent(new CustomEvent("dataChanged", {
            detail: {
                source: source,
                dependents: dependents[source] || []
            }
        }));
    }

    function loadMap() {
        return fetch("/data/integration-map.json").then(function (response) {
            if (!response.ok) {
                return null;
            }
            return response.json();
        }).then(function (map) {
            if (!map || !map.sources) {
                return;
            }
            Object.keys(map.sources).forEach(function (source) {
                var listed = map.sources[source] && map.sources[source].dependents;
                if (listed && listed.length) {
                    dependents[source] = listed;
                }
            });
        }).catch(function () {
            return null;
        });
    }

    function publish(source) {
        var reading = Promise.resolve();
        if (source === "staff") {
            reading = fetch("/api/noor/staff").then(function (response) {
                return response.json();
            }).then(function (payload) {
                pour((payload.people || []).filter(function (row) {
                    return row && row.name;
                }).map(personFrom));
                migrate();
            });
        }
        return reading.then(function () {
            announce(source);
        }).catch(function () {
            announce(source);
        });
    }

    function isId(value) {
        return /^\d{10,}$/.test(String(value || "").trim());
    }

    function nameOf(id) {
        var key = String(id || "").trim();
        var found = null;
        cache.forEach(function (person) {
            if (person.id === key) {
                found = person;
            }
        });
        return found ? found.name : "";
    }

    function display(value) {
        var text = String(value || "").trim();
        if (!isId(text)) {
            return "";
        }
        return nameOf(text);
    }

    function displayWritten(value) {
        var text = String(value || "").trim();
        if (!text) {
            return "";
        }
        if (isId(text)) {
            return nameOf(text);
        }
        return text;
    }

    function toId(value) {
        var text = String(value || "").trim();
        if (!text) {
            return "";
        }
        if (isId(text)) {
            return text;
        }
        var matches = cache.filter(function (person) {
            return person.name === text;
        });
        return matches.length === 1 ? matches[0].id : "";
    }

    function migrate() {
        var data = leadership();
        var changed = false;
        function convert(value) {
            var text = String(value || "").trim();
            if (!text || isId(text)) {
                return text;
            }
            changed = true;
            return toId(text);
        }
        SINGLE_KEYS.forEach(function (key) {
            if (key === "educationalGuide" || !Object.prototype.hasOwnProperty.call(data, key)) {
                return;
            }
            data[key] = convert(data[key]);
        });
        LIST_KEYS.forEach(function (key) {
            if (!Array.isArray(data[key])) {
                return;
            }
            data[key] = data[key].map(convert).filter(function (item) {
                return String(item || "").trim();
            });
        });
        var seatFromStaff = {
            principal: function () { return idByRole("مدير"); },
            viceTeachers: function () { return idByName("محمد بن فايز بن هلال الحربي"); },
            studentsVice: function () { return idByName("خالد بن علي بن حجري العمري"); },
            studentCounselor: function () { return idByName("فهد حنيف بن محمد العمري"); },
            primaryCounselor: function () { return idByName("فهد حنيف بن محمد العمري"); },
            activityLeader: function () { return idByName("محمد حامد عماش السهلي"); }
        };
        Object.keys(seatFromStaff).forEach(function (key) {
            var next = keepLiveId(data[key], seatFromStaff[key]);
            if (next !== String(data[key] || "").trim()) {
                data[key] = next;
                changed = true;
            }
        });
        var listFromSingle = {
            viceTeachersList: "viceTeachers",
            studentsVices: "studentsVice",
            studentCounselors: "studentCounselor"
        };
        Object.keys(listFromSingle).forEach(function (listKey) {
            var current = Array.isArray(data[listKey]) ? data[listKey].filter(Boolean) : [];
            if (listKey === "studentCounselors") {
                var counselors = counselorIds();
                var merged = current.slice();
                counselors.forEach(function (id) {
                    if (merged.indexOf(id) < 0) {
                        merged.push(id);
                    }
                });
                var primary = String(data.primaryCounselor || "").trim();
                merged.sort(function (left, right) {
                    if (left === primary) {
                        return -1;
                    }
                    if (right === primary) {
                        return 1;
                    }
                    return 0;
                });
                if (merged.join("|") !== current.join("|")) {
                    data[listKey] = merged;
                    changed = true;
                }
                return;
            }
            var single = String(data[listFromSingle[listKey]] || "").trim();
            if (!current.length && isId(single) && nameOf(single)) {
                data[listKey] = [single];
                changed = true;
            }
        });
        if (changed) {
            writeLeadership(data);
        }
    }

    function idByName(name) {
        var matches = cache.filter(function (person) {
            return person.name === name;
        });
        return matches.length === 1 ? matches[0].id : "";
    }

    function idByRole(marker) {
        var matches = cache.filter(function (person) {
            var role = person.role || "";
            return role.indexOf(marker) >= 0 && role.indexOf("وكيل") < 0;
        });
        return matches.length === 1 ? matches[0].id : "";
    }

    function counselorIds() {
        var primary = idByName("فهد حنيف بن محمد العمري");
        return cache.filter(function (person) {
            return (person.role || "").indexOf("موجه") >= 0;
        }).map(function (person) {
            return person.id;
        }).sort(function (left, right) {
            if (left === primary) {
                return -1;
            }
            if (right === primary) {
                return 1;
            }
            return 0;
        });
    }

    function keepLiveId(current, find) {
        var text = String(current || "").trim();
        if (isId(text)) {
            return text;
        }
        var matched = text ? toId(text) : "";
        if (matched) {
            return matched;
        }
        return find() || "";
    }

    function places(id) {
        var wanted = String(id || "").trim();
        var found = [];
        if (!wanted) {
            return found;
        }
        var data = leadership();
        function add(key) {
            var label = PLACE_LABEL[key] || "التشكيل القيادي";
            if (found.indexOf(label) < 0) {
                found.push(label);
            }
        }
        SINGLE_KEYS.forEach(function (key) {
            if (String(data[key] || "").trim() === wanted) {
                add(key);
            }
        });
        LIST_KEYS.forEach(function (key) {
            (data[key] || []).forEach(function (item) {
                if (String(item || "").trim() === wanted) {
                    add(key);
                }
            });
        });
        return found;
    }

    function rewrite(name, next) {
        var wanted = String(name || "").trim();
        var data = leadership();
        var changed = false;
        function swap(value) {
            if (String(value || "").trim() !== wanted) {
                return value || "";
            }
            changed = true;
            return next;
        }
        SINGLE_KEYS.forEach(function (key) {
            if (key === "educationalGuide" || !Object.prototype.hasOwnProperty.call(data, key)) {
                return;
            }
            data[key] = swap(data[key]);
        });
        LIST_KEYS.forEach(function (key) {
            if (!Array.isArray(data[key])) {
                return;
            }
            data[key] = data[key].map(swap).filter(function (item) {
                return next === "" ? String(item || "").trim() : true;
            });
        });
        if (changed) {
            writeLeadership(data);
            announce("leadership");
        }
        return changed;
    }

    loadMap().then(function () {
        return publish("staff");
    });

    window.dataHub = {
        publish: publish,
        announce: announce,
        people: function () {
            return cache.slice();
        },
        display: display,
        displayWritten: displayWritten,
        nameOf: nameOf,
        places: places,
        rename: function (oldName, newName) {
            return rewrite(oldName, String(newName || "").trim());
        },
        remove: function (name) {
            return rewrite(name, "");
        },
        attach: function (directory) {
            linked = directory;
            pour(cache);
        }
    };
})();
