/**
 * TPL-02 — مكوّن ديناميكي (خ-مك / قرار 138)
 * يعتمد TplCommon + OfficialFrameCore
 */
(function (root) {
  "use strict";
  var DEFAULT_INDICATORS = ["1-4-1-1", "2-1-1-2", "1-4-1-2", "2-1-1-5", "1-3-1-2", "3-2-1-4"];

  function buildBodyHtml() {
    var C = window.TplCommon;
    var kinds = ["علاجية", "إثرائية", "تشغيلية", "اجتماعات"];
    var opts = kinds.map(function (k) {
      return '<option value="' + k + '">' + k + '</option>';
    }).join('');
    return '<div class="tpl-field-grid">'
      + '<div class="tpl-field"><label for="tpl-kind">نوع الخطة</label><select id="tpl-kind" class="tpl-input">' + opts + '</select></div>'
      + C.fieldText('tpl-title', 'عنوان الخطة')
      + C.dualDateHtml('فترة الخطة — هجري أولاً ثم ميلادي')
      + C.fieldText('tpl-audience', 'المستهدفون', true)
      + C.fieldSelect('tpl-indicators', 'مؤشرات المتابعة (من الـ13)', 'data-tpl-indicators multiple size="5"')
      + C.fieldSelect('tpl-prepared', 'المُعِدّ (prepared_by)', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'المعتمد (مدير — مطلوب)', 'data-tpl-persons')
      + '</div>'
      + '<h2 class="tpl-section-title">الأهداف والإجراءات</h2>'
      + '<table class="tpl-act-table"><thead><tr><th>#</th><th>الهدف</th><th>الإجراء</th><th>متابعة</th></tr></thead><tbody>'
      + [1,2,3].map(function (n) {
          return '<tr><td>' + n + '</td><td><input class="tpl-input" type="text"></td><td><input class="tpl-input" type="text"></td><td><input class="tpl-input" type="text"></td></tr>';
        }).join('')
      + '</tbody></table>';
  }
  function wireTitle(host) {
    var map = {"علاجية": "خطة علاجية", "إثرائية": "خطة إثرائية", "تشغيلية": "خطة تشغيلية", "اجتماعات": "خطة اجتماعات"};
    var sel = host.querySelector('#tpl-kind');
    function apply() {
      window.TplCommon.setDynamicTitle(map[sel.value] || "خطة تربوية / تشغيلية", host);
    }
    if (sel) { sel.addEventListener('change', apply); apply(); }
  }

  function mount(opts) {
    opts = opts || {};
    if (!root.TplCommon || !root.OfficialFrameCore) {
      return Promise.reject(new Error('TplCommon أو OfficialFrameCore غير محمّل'));
    }
    var host = root.TplCommon.mountOfficial({
      title: "خطة تربوية / تشغيلية",
      bodyHtml: buildBodyHtml(),
      columns: [
        { roleTitle: "إعداد (وكيل/رئيس لجنة)", name: '', signature: '', signatureFallback: 'signatures/sig_teachers.png' },
        { roleTitle: "مراجعة", name: '', signature: '', signatureFallback: 'signatures/sig_students.png' },
        { roleTitle: "اعتماد المدير (مطلوب)", name: '', signature: '', signatureFallback: 'signatures/sig_manager.png' }
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
  root["TPL02"] = {
    mount: mount,
    printOfficial: function () { root.TplCommon.printOfficial({}); },
    DEFAULT_INDICATORS: DEFAULT_INDICATORS
  };
  // alias ثابت
  root["TPL-02"] = root["TPL02"];
})(window);
