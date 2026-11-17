/**
 * TPL-08a — مكوّن ديناميكي (خ-مك / قرار 138)
 * يعتمد TplCommon + OfficialFrameCore
 */
(function (root) {
  "use strict";
  var DEFAULT_INDICATORS = ["1-3-1-3", "1-3-1-2", "3-2-1-4"];

  function buildBodyHtml() {
    var C = window.TplCommon;
    return '<div class="tpl-field-grid">'
      + C.fieldText('tpl-activity', 'اسم النشاط التطوعي', true)
      + C.dualDateHtml('تاريخ النشاط — هجري أولاً ثم ميلادي')
      + C.fieldText('tpl-hours', 'الساعات')
      + C.fieldText('tpl-participants', 'عدد المشاركين')
      + C.fieldSelect('tpl-indicators', 'المؤشرات (1-3-1-3 + مراجعة خبير)', 'data-tpl-indicators multiple size="3"')
      + C.fieldSelect('tpl-prepared', 'منسق التطوع (معدّ)', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'رائد النشاط (معتمد)', 'data-tpl-persons')
      + C.fieldTextarea('tpl-notes', 'وصف موجز / شواهد')
      + '<div class="tpl-field full"><p class="tpl-empty">needs_expert_review=true · لا يُنقل تلقائياً إلى 3-2-1-4</p></div>'
      + '</div>';
  }
  function wireTitle(host) {
    window.TplCommon.setDynamicTitle("توثيق عمل تطوعي", host);
  }

  function mount(opts) {
    opts = opts || {};
    if (!root.TplCommon || !root.OfficialFrameCore) {
      return Promise.reject(new Error('TplCommon أو OfficialFrameCore غير محمّل'));
    }
    var host = root.TplCommon.mountOfficial({
      title: "توثيق عمل تطوعي",
      bodyHtml: buildBodyHtml(),
      columns: [
        { roleTitle: "منسق التطوع (معدّ)", name: '', signature: '', signatureFallback: 'signatures/sig_teachers.png' },
        { roleTitle: "رائد النشاط (معتمد)", name: '', signature: '', signatureFallback: 'signatures/sig_students.png' },
        { roleTitle: "مدير عند اللزوم", name: '', signature: '', signatureFallback: 'signatures/sig_manager.png' }
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
  root["TPL08a"] = {
    mount: mount,
    printOfficial: function () { root.TplCommon.printOfficial({}); },
    DEFAULT_INDICATORS: DEFAULT_INDICATORS
  };
  // alias ثابت
  root["TPL-08a"] = root["TPL08a"];
})(window);
