/* identity-core — عقل المقاعد.
 * يقرأ التشكيل الحي من /api/session/leadership لا من ذاكرة محلية كمصدر حقيقة.
 * ROLE_SEAT يطابق env_evidence_session_api.ROLE_SEAT.
 */
(function (root) {
  "use strict";

  var ROLE_SEAT = {
    principal: "manager",
    vice_teachers: "education_agents",
    vice_students: "student_agents",
    vice_admin: "school_affairs_agent",
    student_counselor: "counselors",
    activity_leader: "activity_leader",
    safety_supervisor: "safety_supervisor",
    educational_supervisor: "educational_supervisor",
    librarian: "librarian",
    lab_tech: "lab_tech"
  };

  var ROLE_FROM_LABEL = {
    "مدير المدرسة": "principal",
    "وكيل الشؤون التعليمية": "vice_teachers",
    "وكيل شؤون الطلاب": "vice_students",
    "وكيل الشؤون المدرسية": "vice_admin",
    "الموجه الطلابي": "student_counselor",
    "رائد النشاط": "activity_leader",
    "مشرف الأمن والسلامة": "safety_supervisor",
    "مسؤول الأمن والسلامة": "safety_supervisor",
    "مسؤول أمن وسلامة": "safety_supervisor",
    "الموجه التعليمي": "educational_supervisor",
    "أمين مصادر التعلم": "librarian",
    "محضر المختبر": "lab_tech"
  };

  var SAFETY_MARKS = [
    "أمن",
    "سلامة",
    "جاهزية",
    "صيانة",
    "نظافة",
    "مرافق",
    "جاهزية الفصول",
    "تفقد الأمن",
    "الأمن والسلامة",
    "الصيانة الدورية",
    "صيانة دورية",
    "النظافة",
    "المرافق المساندة"
  ];

  var SAFETY_CODES = {
    "4-1-1-1": true,
    "4-2-1-1": true,
    "4-2-1-2": true,
    "4-2-1-3": true,
    "4-1-1-3": true
  };

  function firstId(value) {
    if (Array.isArray(value)) {
      return String(value[0] || "").trim();
    }
    return String(value || "").trim();
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

  function staffName(people, id) {
    var needle = String(id || "").replace(/\D+/g, "");
    var name = "";
    (people || []).forEach(function (person) {
      var pid = String((person && person.id) || "").replace(/\D+/g, "");
      if (needle && pid === needle && person.name) {
        name = String(person.name);
      }
    });
    return name;
  }

  var IdentityCore = {
    ROLE_SEAT: ROLE_SEAT,

    normalizeRole: function (role) {
      var text = String(role || "").trim();
      if (!text) {
        return "";
      }
      if (ROLE_SEAT[text]) {
        return text;
      }
      return ROLE_FROM_LABEL[text] || text;
    },

    isSafetyProgram: function (programName, extras) {
      extras = extras || {};
      var code = String(extras.code || extras.indicator_code || "").trim();
      if (code && SAFETY_CODES[code]) {
        return true;
      }
      var domain = String(extras.domain || "");
      var name = String(programName || extras.title || "");
      var haystack = name + " " + domain;
      return SAFETY_MARKS.some(function (mark) {
        return haystack.indexOf(mark) >= 0;
      });
    },

    seatKeyForRole: function (role) {
      var key = IdentityCore.normalizeRole(role);
      return ROLE_SEAT[key] || "";
    },

    /**
     * @param {string} role مفتاح OWNER مثل vice_teachers أو التسمية العربية
     * @returns {Promise<{id:string,name:string,seat:string}|null>}
     */
    getActiveSeat: function (role) {
      var seatKey = IdentityCore.seatKeyForRole(role) || String(role || "").trim();
      if (!seatKey) {
        return Promise.resolve(null);
      }
      return Promise.all([
        fetch("/api/session/leadership", { headers: sessionHeaders(), cache: "no-store" }).then(function (response) {
          return response.json().then(function (body) {
            return response.ok && body ? body : {};
          });
        }).catch(function () {
          return {};
        }),
        fetch("/api/noor/staff", { headers: sessionHeaders(), cache: "no-store" }).then(function (response) {
          return response.json().then(function (body) {
            return response.ok && body && Array.isArray(body.people) ? body.people : [];
          });
        }).catch(function () {
          return [];
        })
      ]).then(function (parts) {
        var id = firstId((parts[0] || {})[seatKey]);
        if (!id) {
          return null;
        }
        return {
          id: id,
          name: staffName(parts[1], id),
          seat: seatKey
        };
      });
    },

    /**
     * ترتيب المنفّذ المعتمد (قرار 266): مقعد الدور → رئيس اللجنة → assignee إن فرغ المقعد.
     * برامج الأمن والسلامة تُقرأ من مقعد safety_supervisor أولاً.
     */
    resolveExecutor: function (ownerRole, extras) {
      extras = extras || {};
      var role = IdentityCore.isSafetyProgram(extras.programName)
        ? "safety_supervisor"
        : IdentityCore.normalizeRole(ownerRole);
      return IdentityCore.getActiveSeat(role).then(function (seat) {
        if (seat && seat.id) {
          return seat;
        }
        var assignee = String(extras.assigneeStaffId || "").trim();
        if (!assignee) {
          return null;
        }
        return {
          id: assignee,
          name: String(extras.assigneeName || "").trim(),
          seat: ""
        };
      });
    }
  };

  root.IdentityCore = IdentityCore;
}(typeof window !== "undefined" ? window : this));
