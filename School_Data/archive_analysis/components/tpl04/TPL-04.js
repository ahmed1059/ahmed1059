/**
 * TPL-04 — مكوّن ديناميكي (خ-مك / قرار 138)
 * يعتمد TplCommon + OfficialFrameCore
 */
(function (root) {
  "use strict";
  var DEFAULT_INDICATORS = ["1-2-1-1"];

  function buildBodyHtml() {
    var C = window.TplCommon;
    return '<div class="tpl-field-grid">'
      + C.fieldSelect('tpl-committee', 'اللجنة / الفريق', 'data-tpl-committees')
      + C.fieldText('tpl-basis', 'الأساس النظامي', true)
      + C.dualDateHtml('تاريخ القرار — هجري أولاً ثم ميلادي')
      + '<div class="tpl-field full"><label><input type="checkbox" id="tpl-rapporteur-vacant"> مقرّر شاغر حتى التعيين</label></div>'
      + C.fieldSelect('tpl-indicators', 'المؤشرات', 'data-tpl-indicators multiple size="3"')
      + C.fieldSelect('tpl-prepared', 'المُعِدّ', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'المعتمد (مدير — مطلوب)', 'data-tpl-persons')
      + '</div>'
      + '<h2 class="tpl-section-title">الأعضاء والأدوار</h2>'
      + '<table class="tpl-act-table"><thead><tr><th>#</th><th>الاسم</th><th>الدور</th></tr></thead><tbody>'
      + [1,2,3,4,5].map(function (n) {
          return '<tr><td>' + n + '</td><td><select class="tpl-input" data-tpl-persons></select></td>'
            + '<td><select class="tpl-input"><option>رئيس</option><option>نائب</option><option>مقرّر</option><option selected>عضو</option></select></td></tr>';
        }).join('')
      + '</tbody></table>';
  }
  function wireTitle(host) {
    var sel = host.querySelector('#tpl-committee');
    function apply() {
      var opt = sel && sel.options[sel.selectedIndex];
      var name = opt && opt.value ? opt.textContent.replace(/\s*·.*/, '').replace(/\s*\[.*?\]/, '') : '';
      window.TplCommon.setDynamicTitle(name ? ('قرار تشكيل: ' + name) : "قرار تشكيل لجنة / فريق", host);
    }
    if (sel) { sel.addEventListener('change', apply); }
  }

  function mount(opts) {
    opts = opts || {};
    if (!root.TplCommon || !root.OfficialFrameCore) {
      return Promise.reject(new Error('TplCommon أو OfficialFrameCore غير محمّل'));
    }
    var host = root.TplCommon.mountOfficial({
      title: "قرار تشكيل لجنة / فريق",
      bodyHtml: buildBodyHtml(),
      columns: [
        { roleTitle: "إعداد (وكيل مدرسي)", name: '', signature: '', signatureFallback: 'signatures/sig_teachers.png' },
        { roleTitle: "مراجعة", name: '', signature: '', signatureFallback: 'signatures/sig_students.png' },
        { roleTitle: "اعتماد المدير (مطلوب)", name: '', signature: '', signatureFallback: 'signatures/sig_manager.png' }
      ]
    });
    wireTitle(host);
    var popOpts = {
      identityUrl: opts.identityUrl || '../_shared/identity.json',
      indicatorsUrl: opts.indicatorsUrl || '../_shared/indicators.json',
      committeesUrl: opts.committeesUrl || '../_shared/committees.json',
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
  root["TPL04"] = {
    mount: mount,
    printOfficial: function () { root.TplCommon.printOfficial({}); },
    DEFAULT_INDICATORS: DEFAULT_INDICATORS
  };
  // alias ثابت
  root["TPL-04"] = root["TPL04"];
})(window);
