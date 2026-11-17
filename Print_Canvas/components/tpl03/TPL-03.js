/**
 * TPL-03 — مكوّن ديناميكي (خ-مك / قرار 138)
 * يعتمد TplCommon + OfficialFrameCore
 */
(function (root) {
  "use strict";
  var DEFAULT_INDICATORS = ["1-2-1-1", "1-4-1-2", "2-1-1-2"];

  function buildBodyHtml() {
    var C = window.TplCommon;
    return '<div class="tpl-field-grid">'
      + C.fieldSelect('tpl-committee', 'اللجنة / الاجتماع', 'data-tpl-committees')
      + C.fieldText('tpl-serial', 'رقم المحضر')
      + C.dualDateHtml('تاريخ المحضر — هجري أولاً ثم ميلادي')
      + C.fieldSelect('tpl-rapporteur', 'المقرّر (أو شاغر)', 'data-tpl-persons')
      + '<div class="tpl-field full"><label><input type="checkbox" id="tpl-rapporteur-vacant"> مقرّر شاغر (rapporteur_vacant) — يُعيَّن لاحقاً بقرار المدير</label></div>'
      + C.fieldSelect('tpl-indicators', 'المؤشرات', 'data-tpl-indicators multiple size="4"')
      + C.fieldSelect('tpl-prepared', 'المُعِدّ (غالباً المقرّر)', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'المعتمد (مطلوب)', 'data-tpl-persons')
      + C.fieldTextarea('tpl-items', 'البنود والتوصيات')
      + '</div>'
      + '<h2 class="tpl-section-title">الحاضرون</h2>'
      + '<table class="tpl-act-table"><thead><tr><th>#</th><th>الاسم (من الهوية فقط)</th><th>الصفة</th></tr></thead><tbody>'
      + [1,2,3,4,5].map(function (n) {
          return '<tr><td>' + n + '</td><td><select class="tpl-input" data-tpl-persons></select></td><td><input class="tpl-input" type="text"></td></tr>';
        }).join('')
      + '</tbody></table>';
  }
  function wireTitle(host) {
    var sel = host.querySelector('#tpl-committee');
    function apply() {
      var opt = sel && sel.options[sel.selectedIndex];
      var name = opt && opt.value ? opt.textContent.replace(/\s*·.*/, '').replace(/\s*\[.*?\]/, '') : '';
      window.TplCommon.setDynamicTitle(name ? ('محضر: ' + name) : "محضر لجنة / اجتماع", host);
      var vacant = opt && /مقرّر شاغر/.test(opt.textContent);
      var box = host.querySelector('#tpl-rapporteur-vacant');
      if (box && vacant) { box.checked = true; }
    }
    if (sel) { sel.addEventListener('change', apply); }
  }

  function mount(opts) {
    opts = opts || {};
    if (!root.TplCommon || !root.OfficialFrameCore) {
      return Promise.reject(new Error('TplCommon أو OfficialFrameCore غير محمّل'));
    }
    var host = root.TplCommon.mountOfficial({
      title: "محضر لجنة / اجتماع",
      bodyHtml: buildBodyHtml(),
      columns: [
        { roleTitle: "المقرّر / المعدّ", name: '', signature: '', signatureFallback: 'signatures/sig_teachers.png' },
        { roleTitle: "رئيس اللجنة / وكيل", name: '', signature: '', signatureFallback: 'signatures/sig_students.png' },
        { roleTitle: "اعتماد المدير", name: '', signature: '', signatureFallback: 'signatures/sig_manager.png' }
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
  root["TPL03"] = {
    mount: mount,
    printOfficial: function () { root.TplCommon.printOfficial({}); },
    DEFAULT_INDICATORS: DEFAULT_INDICATORS
  };
  // alias ثابت
  root["TPL-03"] = root["TPL03"];
})(window);
