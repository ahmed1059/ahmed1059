/**
 * TPL-07 — مكوّن ديناميكي (خ-مك / قرار 138)
 * يعتمد TplCommon + OfficialFrameCore
 */
(function (root) {
  "use strict";
  var DEFAULT_INDICATORS = ["1-4-1-2", "2-2-1-4"];

  function buildBodyHtml() {
    var C = window.TplCommon;
    return '<div class="tpl-field-grid">'
      + C.fieldText('tpl-subject', 'موضوع التقويم / الأثر', true)
      + C.dualDateHtml('تاريخ الاستمارة — هجري أولاً ثم ميلادي')
      + C.fieldSelect('tpl-indicators', 'المؤشرات', 'data-tpl-indicators multiple size="3"')
      + C.fieldSelect('tpl-prepared', 'المُعِدّ', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'اعتماد وكيل (عند الحاجة)', 'data-tpl-persons')
      + C.fieldTextarea('tpl-recommend', 'التوصية')
      + '</div>'
      + '<h2 class="tpl-section-title">المحاور والدرجات</h2>'
      + '<table class="tpl-act-table"><thead><tr><th>#</th><th>المحور</th><th>الدرجة</th><th>ملاحظة</th></tr></thead><tbody>'
      + [1,2,3,4].map(function (n) {
          return '<tr><td>' + n + '</td><td><input class="tpl-input" type="text"></td><td><input class="tpl-input" type="text"></td><td><input class="tpl-input" type="text"></td></tr>';
        }).join('')
      + '</tbody></table>';
  }
  function wireTitle(host) {
    window.TplCommon.setDynamicTitle("استمارة تقويم / قياس أثر", host);
  }

  function mount(opts) {
    opts = opts || {};
    if (!root.TplCommon || !root.OfficialFrameCore) {
      return Promise.reject(new Error('TplCommon أو OfficialFrameCore غير محمّل'));
    }
    var host = root.TplCommon.mountOfficial({
      title: "استمارة تقويم / قياس أثر",
      bodyHtml: buildBodyHtml(),
      columns: [
        { roleTitle: "معدّ الاستمارة", name: '', signature: '', signatureFallback: 'signatures/sig_teachers.png' },
        { roleTitle: "مراجعة وكيل (عند الحاجة)", name: '', signature: '', signatureFallback: 'signatures/sig_students.png' },
        { roleTitle: "اعتماد اختياري", name: '', signature: '', signatureFallback: 'signatures/sig_manager.png' }
      ]
    });
    wireTitle(host);
    var popOpts = {
      identityUrl: opts.identityUrl || '../_shared/identity.json',
      indicatorsUrl: opts.indicatorsUrl || '../_shared/indicators.json',
      
      defaultIndicators: DEFAULT_INDICATORS,
      root: host
    };
    var afterPop = function (stats) {
      var calOk = root.TplCommon.bindSystemCalendars(host);
      if (opts.statusEl) {
        opts.statusEl.textContent =
          (stats.programs != null ? ('برامج: ' + stats.programs + ' · ') : '') +
          'أسماء: ' + stats.persons +
          ' · مؤشرات: ' + stats.indicators +
          (stats.committees ? (' · هيئات: ' + stats.committees) : '') +
          (calOk ? ' · تقويم مربوط' : ' · تقويم: يحتاج dashboard.js');
      }
      return stats;
    };
    return root.TplCommon.populateDropdowns(popOpts).then(function (stats) {
      return afterPop(stats);
    });
  }
  root["TPL07"] = {
    mount: mount,
    printOfficial: function () { root.TplCommon.printOfficial({}); },
    DEFAULT_INDICATORS: DEFAULT_INDICATORS
  };
  // alias ثابت
  root["TPL-07"] = root["TPL07"];
})(window);
