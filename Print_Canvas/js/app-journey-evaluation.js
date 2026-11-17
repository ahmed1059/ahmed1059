/* شاشة نتائج التقويم الخارجي — قرار 284. */
(function () {
  "use strict";

  function paint(items) {
    var hint = document.getElementById("aj-eval-hint");
    var table = document.getElementById("aj-eval-table");
    var canvas = document.getElementById("aj-eval-chart");
    var core = window.EvaluationCore;
    if (hint && core) {
      hint.textContent = core.overallHint();
    }
    if (table) {
      var body = table.querySelector("tbody");
      body.innerHTML = "";
      var codes = {};
      items.forEach(function (row) {
        var code = row.indicator_code || "";
        if (!codes[code]) {
          codes[code] = {};
        }
        codes[code][row.year] = row;
      });
      Object.keys(codes).forEach(function (code) {
        var tr = document.createElement("tr");
        [code, 2024, 2025, 2026].forEach(function (key, index) {
          var cell = document.createElement("td");
          if (index === 0) {
            cell.textContent = code;
          } else {
            var row = codes[code][key];
            cell.textContent = row && row.score != null && row.score !== ""
              ? (String(row.score) + "%" + (row.level ? " · " + row.level : ""))
              : "";
          }
          tr.appendChild(cell);
        });
        body.appendChild(tr);
      });
    }
    if (!canvas || !core) {
      return;
    }
    var series = core.overallSeries();
    var ctx = canvas.getContext("2d");
    var width = canvas.width;
    var height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    if (!series.length) {
      return;
    }
    var max = 100;
    var pad = 36;
    ctx.strokeStyle = "#0b5e56";
    ctx.lineWidth = 2;
    ctx.beginPath();
    series.forEach(function (row, index) {
      var x = pad + (index * (width - pad * 2)) / Math.max(series.length - 1, 1);
      var y = height - pad - ((Number(row.score) || 0) / max) * (height - pad * 2);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.fillStyle = "#0b5e56";
    ctx.font = "14px Tahoma";
    ctx.textAlign = "center";
    series.forEach(function (row, index) {
      var x = pad + (index * (width - pad * 2)) / Math.max(series.length - 1, 1);
      var y = height - pad - ((Number(row.score) || 0) / max) * (height - pad * 2);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(String(row.year), x, height - 12);
      ctx.fillText(String(row.score) + "%", x, y - 10);
    });
  }

  function load() {
    var status = document.getElementById("aj-eval-status");
    if (!window.EvaluationCore) {
      return;
    }
    if (status) {
      status.textContent = "";
    }
    window.EvaluationCore.load().then(function (items) {
      paint(items || []);
    }).catch(function (error) {
      if (status) {
        status.textContent = error.message || "تعذر عرض التقويم.";
      }
    });
  }

  window.addEventListener("hashchange", function () {
    if (String(window.location.hash || "").indexOf("#view-external-eval") === 0) {
      load();
    }
  });
  window.AjExternalEval = { load: load };
}());
