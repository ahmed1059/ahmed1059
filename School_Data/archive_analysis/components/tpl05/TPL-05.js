/**
 * TPL-05 — مكوّن ديناميكي (خ-مك / قرار 138)
 * يعتمد TplCommon + OfficialFrameCore
 */
(function (root) {
  "use strict";
  var DEFAULT_INDICATORS = ["1-4-1-1", "1-4-1-2", "2-1-1-2", "2-1-1-5", "1-3-1-1"];

  function buildBodyHtml() {
    var C = window.TplCommon;
    var kinds = ["غياب", "مقصف", "مخالفات", "تدريب", "قيم", "أخرى"];
    var opts = kinds.map(function (k) { return '<option value="' + k + '">' + k + '</option>'; }).join('');
    return '<div class="tpl-field-grid">'
      + '<div class="tpl-field"><label for="tpl-kind">نوع السجل</label><select id="tpl-kind" class="tpl-input">' + opts + '</select></div>'
      + C.dualDateHtml('يوم المتابعة — هجري أولاً ثم ميلادي')
      + C.fieldSelect('tpl-indicators', 'المؤشرات', 'data-tpl-indicators multiple size="4"')
      + C.fieldSelect('tpl-prepared', 'صاحب الدور (معدّ)', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'اعتماد اختياري', 'data-tpl-persons')
      + C.fieldTextarea('tpl-notes', 'ملاحظات وإجراء')
      + '</div>'
      + '<h2 class="tpl-section-title">جدول المتابعة</h2>'
      + '<table class="tpl-act-table"><thead><tr><th>#</th><th>البند</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>'
      + [1,2,3,4].map(function (n) {
          return '<tr><td>' + n + '</td><td><input class="tpl-input" type="text"></td><td><input class="tpl-input" type="text"></td><td><input class="tpl-input" type="text"></td></tr>';
        }).join('')
      + '</tbody></table>';
  }
  function wireTitle(host) {
    var map = {"غياب": "سجل متابعة الغياب", "مقصف": "سجل متابعة المقصف", "مخالفات": "سجل المخالفات", "تدريب": "سجل التدريب", "قيم": "سجل القيم والسلوك", "أخرى": "سجل متابعة تشغيلي"};
    var sel = host.querySelector('#tpl-kind');
    function apply() { window.TplCommon.setDynamicTitle(map[sel.value] || "سجل متابعة تشغيلي", host); }
    if (sel) { sel.addEventListener('change', apply); apply(); }
  }

  function mount(opts) {
    opts = opts || {};
    if (!root.TplCommon || !root.OfficialFrameCore) {
      return Promise.reject(new Error('TplCommon أو OfficialFrameCore غير محمّل'));
    }
    var host = root.TplCommon.mountOfficial({
      title: "سجل متابعة تشغيلي",
      bodyHtml: buildBodyHtml(),
      columns: [
        { roleTitle: "صاحب الدور (معدّ)", name: '', signature: '', signatureFallback: 'signatures/sig_teachers.png' },
        { roleTitle: "متابعة", name: '', signature: '', signatureFallback: 'signatures/sig_students.png' },
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
  root["TPL05"] = {
    mount: mount,
    printOfficial: function () { root.TplCommon.printOfficial({}); },
    DEFAULT_INDICATORS: DEFAULT_INDICATORS
  };
  // alias ثابت
  root["TPL-05"] = root["TPL05"];
})(window);
