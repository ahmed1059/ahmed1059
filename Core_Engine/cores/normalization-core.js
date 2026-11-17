/* normalization-core — عقل التوحيد.
 * قيد صارم (قرار 260): جواز/تصريح أقصر من 10 أرقام ليس هوية ولا يُعبأ أصفاراً.
 * pad يُسمح به فقط لهوية وطنية فقدت صفراً بادئاً (9 أرقام بعد إزالة غير الرقمي).
 */
(function (root) {
  "use strict";

  var ROLE_ALIASES = {
    "اداري": "إداري",
    "أداري": "إداري",
    "إداري": "إداري",
    "مدير مدرسة": "مدير مدرسة",
    "مدير": "مدير مدرسة",
    "معلم": "معلم",
    "معلّم": "معلم"
  };

  var NormalizationCore = {
    digitsOnly: function (value) {
      return String(value || "").replace(/[^\d]/g, "");
    },

    /**
     * @param {string} id
     * @param {{documentType?:string}} [opts]
     * @returns {string} هوية عشرية أو سلسلة فارغة إن لم تكن هوية وطنية
     */
    normalizeSaudiId: function (id, opts) {
      opts = opts || {};
      // لاحقاً: إن documentType جواز/تصريح أو الطول < 9 → ""
      // لاحقاً: إن 9 أرقام → padStart(10,"0") ثم التحقق
      // لاحقاً: إن 10 أرقام → كما هي
      return String(id || "").trim();
    },

    /**
     * يوحّد صفة منسوب ظاهرة. لا يخترع صفة إن دخل فارغاً.
     */
    normalizeRole: function (role) {
      var raw = String(role || "").trim();
      if (!raw) {
        return "";
      }
      return ROLE_ALIASES[raw] || raw;
    }
  };

  root.NormalizationCore = NormalizationCore;
}(typeof window !== "undefined" ? window : this));
