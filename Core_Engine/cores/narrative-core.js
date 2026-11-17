/* narrative-core — بنك العبارات التربوية.
 * يدمج قالباً محفوظاً مع متغيرات من السجل فقط.
 * الفراغ يبقى فراغاً. لا أعداد ولا أسماء تُخترع.
 * المصدر: BANK المضمّن + /cores/phrases-bank.json
 */
(function (root) {
  "use strict";

  var BANK = {
    "meeting.opening": "اجتماع اللجنة {{committee_name}} بتاريخ {{date}} لمناقشة {{topic}}.",
    "program.objective": "يهدف البرنامج إلى {{program_name}} ضمن مجال {{domain}}.",
    "report.closing": "وفي الختام نوصي بـ {{recommendation}}.",
    "plan.objective": "العنصر المراد تحسينه: {{title}}.",
    "plan.procedures": "تُنفَّذ الإجراءات التالية: {{procedures}}.",
    "plan.evidence": "الشواهد المطلوبة: {{evidence}}.",
    "plan.expectations": "{{expectations}}",
    "plan.committees": "اللجان المعنية: {{committees}}."
  };

  function applyBank(data) {
    if (!data || typeof data !== "object") {
      return;
    }
    Object.keys(data).forEach(function (key) {
      if (typeof data[key] === "string" && String(data[key]).trim()) {
        BANK[key] = String(data[key]);
      }
    });
  }

  function fillTemplate(template, variables) {
    variables = variables || {};
    var filled = 0;
    var text = String(template).replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, function (_, key) {
      var value = String(variables[key] == null ? "" : variables[key]).trim();
      if (value) {
        filled += 1;
      }
      return value;
    });
    if (!filled) {
      return "";
    }
    return text.replace(/\s{2,}/g, " ").replace(/\s+([.،,])/g, "$1").trim();
  }

  var NarrativeCore = {
    bank: BANK,

    /**
     * @param {string} templateKey مثل meeting.opening | program.objective | report.closing
     * @param {object} variables مفاتيح من السجل المحفوظ فقط
     * @returns {string} النص المدمج أو فراغ
     */
    generateText: function (templateKey, variables) {
      var template = BANK[String(templateKey || "")];
      if (!template) {
        return "";
      }
      return fillTemplate(template, variables);
    },

    /**
     * نصوص المؤشر من PlanningCore فقط. الحقل الفارغ في البنك يبقى فارغاً.
     * @param {string} code
     * @returns {{title:string,procedures:string,evidence:string,expectations:string,committees:string,item:object|null}}
     */
    fromBank: function (code) {
      var empty = {
        title: "",
        procedures: "",
        evidence: "",
        expectations: "",
        committees: "",
        item: null
      };
      var core = root.PlanningCore;
      if (!core || typeof core.getIndicator !== "function") {
        return empty;
      }
      var item = core.getIndicator(code);
      if (!item) {
        return empty;
      }
      return {
        title: NarrativeCore.generateText("plan.objective", { title: item.title }),
        procedures: NarrativeCore.generateText("plan.procedures", {
          procedures: (item.procedures || []).join("؛ ")
        }),
        evidence: NarrativeCore.generateText("plan.evidence", { evidence: item.evidence }),
        expectations: NarrativeCore.generateText("plan.expectations", {
          expectations: item.expectations
        }),
        committees: NarrativeCore.generateText("plan.committees", { committees: item.committees }),
        item: item
      };
    },

    load: function (options) {
      options = options || {};
      var fetchFn = options.fetch || root.fetch;
      if (typeof fetchFn !== "function") {
        return Promise.resolve(BANK);
      }
      return fetchFn(options.url || "/cores/phrases-bank.json", { cache: "no-store" }).then(function (response) {
        if (!response.ok) {
          return BANK;
        }
        return response.json();
      }).then(function (data) {
        applyBank(data);
        return BANK;
      }).catch(function () {
        return BANK;
      });
    },

    register: function () {
      return false;
    }
  };

  root.NarrativeCore = NarrativeCore;
}(typeof window !== "undefined" ? window : this));
