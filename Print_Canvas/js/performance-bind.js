/* مصدر الحقيقة الواحد — قراءة مركز الأداء بدون أرقام ثابتة في الواجهة */
(function (global) {
  "use strict";

  /* الترتيب إلزامي: API الكنسي → المرآة → مسار نسبي احتياطي */
  var URLS = [
    "/api/performance-metrics",
    "/components/_shared/performance_metrics.json",
    "../components/_shared/performance_metrics.json"
  ];
  var cache = null;
  var inflight = null;

  function softFetch(url) {
    return fetch(url, { cache: "no-store" }).then(
      function (r) {
        return r.ok ? r.json() : null;
      },
      function () {
        return null;
      }
    );
  }

  function load() {
    if (cache) return Promise.resolve(cache);
    if (inflight) return inflight;
    inflight = softFetch(URLS[0])
      .then(function (data) {
        if (data) return data;
        return softFetch(URLS[1]);
      })
      .then(function (data) {
        if (data) return data;
        return softFetch(URLS[2]);
      })
      .then(function (data) {
        cache = data || null;
        inflight = null;
        return cache;
      });
    return inflight;
  }

  function invalidate() {
    cache = null;
    inflight = null;
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("dataChanged", function (event) {
      var source = event && event.detail && event.detail.source;
      if (!source || source === "metrics" || source === "settings" || source === "nafs" || source === "indicators") {
        invalidate();
      }
    });
  }

  function domainSeries(metrics) {
    var ext = (metrics && metrics.external_evaluation) || {};
    return {
      labels: [
        "الإدارة المدرسية",
        "التعليم والتعلم",
        "نواتج التعلم",
        "البيئة المدرسية"
      ],
      current: [
        (ext.administration && ext.administration.score) || 0,
        (ext.teaching && ext.teaching.score) || 0,
        (ext.outcomes && ext.outcomes.score) || 0,
        (ext.environment && ext.environment.score) || 0
      ],
      target: [
        90,
        75,
        75,
        (ext.environment && ext.environment.domain_target_pct) || 75
      ]
    };
  }

  function nafesSeries(metrics) {
    var n = (metrics && metrics.nafes) || {};
    return {
      labels: ["القراءة", "الرياضيات", "العلوم"],
      current: [
        (n.reading && n.reading.score) || 0,
        (n.math && n.math.score) || 0,
        (n.science && n.science.score) || 0
      ],
      target: [
        (n.reading && n.reading.target) || 0,
        (n.math && n.math.target) || 0,
        (n.science && n.science.target) || 0
      ]
    };
  }

  function fillNafesTable(root, metrics) {
    var host = (root || document).querySelector("table.nafes-table tbody");
    if (!host || !metrics || !metrics.nafes) return;
    var n = metrics.nafes;
    var rows = [
      ["القراءة", n.reading],
      ["الرياضيات", n.math],
      ["العلوم", n.science]
    ];
    host.innerHTML = rows
      .map(function (pair) {
        var row = pair[1] || {};
        var cur = row.score != null ? row.score + (row.unit || "%") : "";
        var tgt = row.target != null ? row.target + (row.unit || "%") : "";
        return (
          "<tr><td>" +
          pair[0] +
          "</td><td>" +
          (cur ? "الحالي " + cur + (tgt ? " · المستهدف " + tgt : "") : "") +
          "</td><td>اختبار نافس</td></tr>"
        );
      })
      .join("");
  }

  function fillDomainScoreTable(root, metrics) {
    var host = (root || document).querySelector("#booklet-domain-scores tbody");
    if (!host || !metrics) return;
    var series = domainSeries(metrics);
    host.innerHTML = series.labels
      .map(function (label, i) {
        return (
          "<tr><td>" +
          label +
          "</td><td>" +
          series.current[i] +
          "%</td><td>" +
          series.target[i] +
          "%</td></tr>"
        );
      })
      .join("");
  }

  function metricCell(row, extraClass) {
    if (!row) return "";
    return (
      '<div class="ssot-metric' +
      (extraClass ? " " + extraClass : "") +
      '"><span class="n">' +
      (row.score != null ? row.score + (row.unit || "%") : "—") +
      '</span><span class="l">' +
      (row.label || "") +
      "</span></div>"
    );
  }

  function renderStrip(host, metrics) {
    if (!host) return;
    if (!metrics) {
      host.innerHTML = '<p class="pi-empty">مركز الأداء غير متاح.</p>';
      return;
    }
    var ext = metrics.external_evaluation || {};
    var n = metrics.nafes || {};
    var primary = metricCell(ext.overall, "ssot-metric--primary");
    var restCells = [
      metricCell(ext.administration),
      metricCell(ext.teaching),
      metricCell(ext.outcomes),
      metricCell(ext.environment),
      metricCell(n.math),
      metricCell(n.reading),
      metricCell(n.science)
    ].filter(Boolean);
    host.innerHTML =
      primary +
      (restCells.length
        ? '<details class="ssot-metrics-more">' +
          '<summary>بقية المؤشرات <span class="ssot-metrics-more__count">' +
          restCells.length +
          "</span></summary>" +
          '<div class="ssot-metrics__strip ssot-metrics__rest">' +
          restCells.join("") +
          "</div></details>"
        : "");
  }

  global.PerformanceBind = {
    load: load,
    invalidate: invalidate,
    domainSeries: domainSeries,
    nafesSeries: nafesSeries,
    fillNafesTable: fillNafesTable,
    fillDomainScoreTable: fillDomainScoreTable,
    renderStrip: renderStrip
  };
})(window);
