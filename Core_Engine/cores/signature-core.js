/* signature-core — عقل التوقيع.
 * المصدر الوحيد: GET /api/session/signatures?ids= (ملف sig_{national_id}.png).
 * المقعد الفارغ أو الملف الغائب → signature: null. لا مسار احتياطي ولا صورة مكسورة.
 * لا يقرأ القرص من المتصفح. لا localStorage.
 */
(function (root) {
  "use strict";

  function digitsId(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function seatRow(seat) {
    seat = seat || {};
    var raw = String(seat.id || seat.national_id || "").trim();
    var digits = digitsId(raw);
    return {
      role: String(seat.role || ""),
      id: digits ? raw : "",
      name: String(seat.name || ""),
      signature: null,
      _digits: digits
    };
  }

  function publicRow(row) {
    return {
      role: row.role,
      id: row.id,
      name: row.name,
      signature: row.signature
    };
  }

  var SignatureCore = {
    /**
     * @param {Array<{role:string,id?:string,national_id?:string,name?:string}>} seats
     * @param {{headers?:object, fetch?:function}} [options] headers من الجلسة (X-Session-Token)
     * @returns {Promise<Array<{role:string,id:string,name:string,signature:string|null}>>}
     */
    resolve: function (seats, options) {
      seats = Array.isArray(seats) ? seats : [];
      options = options || {};
      var rows = seats.map(seatRow);
      var ids = [];
      rows.forEach(function (row) {
        if (row._digits && ids.indexOf(row._digits) < 0) {
          ids.push(row._digits);
        }
      });
      if (!ids.length) {
        return Promise.resolve(rows.map(publicRow));
      }
      var fetchFn = options.fetch || root.fetch;
      if (typeof fetchFn !== "function") {
        return Promise.reject(new Error("SignatureCore: fetch unavailable"));
      }
      return fetchFn("/api/session/signatures?ids=" + encodeURIComponent(ids.join(",")), {
        headers: options.headers || {},
        cache: "no-store"
      }).then(function (response) {
        if (!response.ok) {
          throw new Error("SignatureCore: " + response.status);
        }
        return response.json();
      }).then(function (payload) {
        var map = (payload && payload.signatures) || {};
        rows.forEach(function (row) {
          if (!row._digits) {
            row.signature = null;
            return;
          }
          var data = map[row._digits] || map[row.id] || "";
          row.signature = data ? data : null;
        });
        return rows.map(publicRow);
      });
    },

    urlFor: function () {
      return null;
    }
  };

  root.SignatureCore = SignatureCore;
}(typeof window !== "undefined" ? window : this));
