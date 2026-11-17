/* planning-core — بنك خطط التحسين.
 * المصدر الوحيد: School_Data/knowledge_bases/plans-bank.json عبر الجلسة.
 * لا اختراع عناوين أو إجراءات.
 */
(function (root) {
  "use strict";

  var items = [];
  var byCode = {};
  var loaded = false;
  var loading = null;
  var CYCLE_STATEMENT = {
    "1-4-1-1": "تشجع المدرسة منسوبيها للحصول على الرخصة المهنية",
    "1-4-1-2": "تدعم المدرسة التطوير المهني لمنسوبيها وفقًا لنتائج تقويم الأداء الوظيفي واحتياجاتهم",
    "1-4-1-3": "تطبق المدرسة التقويم الذاتي المبني على المعايير المعتمدة من الهيئة",
    "2-2-1-1": "تقوم المدرسة أداء المتعلمين باستخدام أساليب وأدوات تقويم متنوعة وفاعلة"
  };

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

  function cleanDomain(value) {
    return String(value || "").replace(/\r/g, " ").replace(/\s+/g, " ").trim();
  }

  function normalize(raw) {
    raw = raw || {};
    return {
      code: String(raw.code || "").trim(),
      title: String(raw.title || "").trim(),
      domain: cleanDomain(raw.domain),
      standard: String(raw.standard || "").trim(),
      element: String(raw.element || "").trim(),
      procedures: Array.isArray(raw.procedures)
        ? raw.procedures.map(function (row) { return String(row || "").trim(); }).filter(Boolean)
        : [],
      committees: String(raw.committees || "").trim(),
      evidence: String(raw.evidence || "").trim(),
      expectations: String(raw.expectations || "").trim()
    };
  }

  function haystack(item) {
    return [
      item.code,
      item.title,
      item.domain,
      item.standard,
      item.element,
      item.committees,
      item.evidence,
      item.expectations,
      (item.procedures || []).join(" ")
    ].join(" ").toLowerCase();
  }

  function fold(value) {
    return String(value || "")
      .replace(/[إأآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[\u064B-\u0652\u0640]/g, "")
      .replace(/[^\u0600-\u06FFa-z0-9]/g, "");
  }

  function indexAll(rows) {
    items = [];
    byCode = {};
    (Array.isArray(rows) ? rows : []).forEach(function (raw) {
      var item = normalize(raw);
      if (!item.code) {
        return;
      }
      items.push(item);
      if (!byCode[item.code]) {
        byCode[item.code] = [];
      }
      byCode[item.code].push(item);
    });
    loaded = true;
  }

  function listFor(code) {
    var key = String(code || "").trim();
    var list = key && byCode[key] ? byCode[key] : [];
    return list.slice();
  }

  function cycleMatch(code, list) {
    var statement = CYCLE_STATEMENT[String(code || "").trim()];
    if (!statement) {
      return null;
    }
    var wanted = fold(statement);
    var hit = null;
    list.forEach(function (item) {
      var title = fold(item.title);
      if (!title || (title.indexOf(wanted) < 0 && wanted.indexOf(title) < 0)) {
        return;
      }
      if (!hit || title.length < fold(hit.title).length) {
        hit = item;
      }
    });
    return hit;
  }

  var PlanningCore = {
    load: function (options) {
      options = options || {};
      if (loaded && !options.reload) {
        return Promise.resolve(items);
      }
      if (loading && !options.reload) {
        return loading;
      }
      var fetchFn = options.fetch || root.fetch;
      if (typeof fetchFn !== "function") {
        return Promise.resolve(items);
      }
      loading = fetchFn(options.url || "/api/session/plans-bank", {
        headers: options.headers || sessionHeaders(),
        cache: "no-store"
      }).then(function (response) {
        if (!response.ok) {
          throw new Error("تعذر قراءة بنك الخطط");
        }
        return response.json();
      }).then(function (payload) {
        indexAll(Array.isArray(payload) ? payload : (payload && payload.items) || []);
        loading = null;
        return items;
      }).catch(function () {
        loading = null;
        indexAll([]);
        return items;
      });
      return loading;
    },

    /**
     * @param {string} code مثل 2-1-1-2
     * @returns {object|null}
     */
    matches: function (code) {
      return listFor(code);
    },

    getIndicator: function (code) {
      var list = listFor(code);
      if (!list.length) {
        return null;
      }
      return cycleMatch(code, list) || list[0];
    },

    /**
     * @param {string} query رقم مؤشر أو كلمة
     * @returns {object[]}
     */
    search: function (query) {
      var needle = String(query || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!needle) {
        return [];
      }
      var exact = [];
      var rest = [];
      items.forEach(function (item) {
        if (item.code.toLowerCase() === needle) {
          exact.push(item);
          return;
        }
        if (item.code.indexOf(needle) === 0 || haystack(item).indexOf(needle) >= 0) {
          rest.push(item);
        }
      });
      return exact.concat(rest).slice(0, 12);
    }
  };

  root.PlanningCore = PlanningCore;
}(typeof window !== "undefined" ? window : this));
