/* evaluation-core — قرار 284. يقرأ external_evaluations ولا يخترع مؤشراً. */
(function (root) {
  "use strict";

  var items = [];

  function headers() {
    var result = {};
    try {
      var user = JSON.parse(sessionStorage.getItem("sessionUser") || "null");
      if (user && user.token) {
        result["X-Session-Token"] = user.token;
      }
    } catch (error) {
      return result;
    }
    return result;
  }

  function load() {
    return fetch("/api/session/external-evaluations", { headers: headers(), cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("تعذر قراءة التقويم الخارجي");
        }
        return response.json();
      })
      .then(function (body) {
        items = (body && body.items) || [];
        return items;
      });
  }

  function byCode(code) {
    var key = String(code || "").trim();
    if (!key) {
      return [];
    }
    return items.filter(function (row) {
      return String(row.indicator_code || "") === key;
    });
  }

  function latest(code) {
    var rows = byCode(code).slice().sort(function (a, b) {
      return Number(b.year) - Number(a.year);
    });
    return rows.length ? rows[0] : null;
  }

  function overallSeries() {
    return byCode("OVERALL").slice().sort(function (a, b) {
      return Number(a.year) - Number(b.year);
    });
  }

  function overallHint() {
    var rows = overallSeries();
    if (!rows.length) {
      return "";
    }
    return "الأداء العام في التقويم الخارجي: " + rows.map(function (row) {
      var score = row.score == null ? "" : String(row.score);
      return row.year + (score ? " " + score + "%" : "");
    }).join(" ← ");
  }

  function notice(code) {
    var row = latest(code);
    if (!row || row.score == null || row.score === "") {
      return "";
    }
    var score = String(row.score);
    if (score.indexOf("%") < 0) {
      score += "%";
    }
    return "هذا المؤشر حصل على " + score + " في " + row.year + "، يحتاج إلى خطة تحسين";
  }

  root.EvaluationCore = {
    version: "284",
    load: load,
    items: function () { return items.slice(); },
    byCode: byCode,
    latest: latest,
    overallSeries: overallSeries,
    overallHint: overallHint,
    notice: notice
  };
}(window));
