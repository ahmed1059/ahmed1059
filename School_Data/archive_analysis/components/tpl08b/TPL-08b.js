/**
 * TPL-08b — مكوّن ديناميكي (خ-مك / قرار 138)
 * يعتمد TplCommon + OfficialFrameCore
 */
(function (root) {
  "use strict";
  var DEFAULT_INDICATORS = ["1-3-1-3", "1-3-1-2", "3-2-1-4"];

  function buildBodyHtml() {
    var C = window.TplCommon;
    return '<div class="tpl-field-grid">'
      + C.fieldText('tpl-partner', 'الجهة الشريكة', true)
      + C.fieldText('tpl-activity', 'موضوع الشراكة')
      + C.dualDateHtml('تاريخ التوثيق — هجري أولاً ثم ميلادي')
      + C.fieldSelect('tpl-indicators', 'المؤشرات (1-3-1-3 + مراجعة خبير)', 'data-tpl-indicators multiple size="3"')
      + C.fieldSelect('tpl-prepared', 'منسق الشراكة (معدّ)', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'اعتماد المدير', 'data-tpl-persons')
      + C.fieldTextarea('tpl-notes', 'المشاركون / المخرجات')
      + '<div class="tpl-field full"><p class="tpl-empty">needs_expert_review=true · مسار اعتماد المدير (08b)</p></div>'
      + '</div>';
  }
  function wireTitle(host) {
    window.TplCommon.setDynamicTitle("توثيق شراكة مجتمعية", host);
  }

  function mount(opts) {
    opts = opts || {};
    if (!root.TplCommon || !root.OfficialFrameCore) {
      return Promise.reject(new Error('TplCommon أو OfficialFrameCore غير محمّل'));
    }
    var host = root.TplCommon.mountOfficial({
      title: "توثيق شراكة مجتمعية",
      bodyHtml: buildBodyHtml(),
      columns: [
        { roleTitle: "منسق الشراكة (معدّ)", name: '', signature: '', signatureFallback: 'signatures/sig_teachers.png' },
        { roleTitle: "مراجعة", name: '', signature: '', signatureFallback: 'signatures/sig_students.png' },
        { roleTitle: "اعتماد المدير", name: '', signature: '', signatureFallback: 'signatures/sig_manager.png' }
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
          (calOk ? ' · تقويم مربوط' : ' · تقويم: يحتاج dashboard.js') + " · مراجعة خبير";
      }
      return stats;
    };
    return root.TplCommon.populateDropdowns(popOpts).then(function (stats) {
      return afterPop(stats);
    });
  }
  root["TPL08b"] = {
    mount: mount,
    printOfficial: function () { root.TplCommon.printOfficial({}); },
    DEFAULT_INDICATORS: DEFAULT_INDICATORS
  };
  // alias ثابت
  root["TPL-08b"] = root["TPL08b"];
})(window);
