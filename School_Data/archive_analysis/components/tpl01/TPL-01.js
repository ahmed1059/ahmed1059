/**
 * TPL-01 — مكوّن ديناميكي (خ-مك / قرار 138)
 * يعتمد TplCommon + OfficialFrameCore
 */
(function (root) {
  "use strict";
  var DEFAULT_INDICATORS = ["1-4-1-2", "2-2-1-1", "2-2-1-2", "2-2-1-3", "2-2-1-4"];

  function buildBodyHtml() {
    var C = window.TplCommon;
    var kinds = ["برنامج", "مسابقة", "مبادرة"];
    var opts = kinds.map(function (k) {
      return '<option value="' + k + '">' + k + '</option>';
    }).join('');
    return '<div class="tpl-field-grid">'
      + '<div class="tpl-field full"><label for="tpl-program">اختيار البرنامج / المسابقة / المبادرة</label>'
      + '<select id="tpl-program" class="tpl-input" data-tpl-programs></select></div>'
      + '<div class="tpl-field"><label for="tpl-kind">نوع المحتوى (للعنوان الذكي)</label><select id="tpl-kind" class="tpl-input">' + opts + '</select></div>'
      + C.fieldText('tpl-program-name', 'الاسم المعروض')
      + C.dualDateHtml('الفترة — هجري أولاً ثم ميلادي')
      + C.fieldText('tpl-audience', 'الفئة المستهدفة')
      + C.fieldSelect('tpl-indicators', 'المؤشرات (من الـ13 المعتمدة)', 'data-tpl-indicators multiple size="5"')
      + C.fieldSelect('tpl-prepared', 'المُعِدّ (prepared_by)', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'المعتمد (approved_by) — اختياري', 'data-tpl-persons')
      + '</div>'
      + '<h2 class="tpl-section-title">الأنشطة المنفذة</h2>'
      + '<table class="tpl-act-table"><thead><tr><th>#</th><th>النشاط</th><th colspan="2">التاريخ (هـ / م)</th><th>ملاحظة</th></tr></thead><tbody>'
      + [1,2,3].map(function (n) {
          return '<tr><td>' + n + '</td><td><input class="tpl-input" type="text"></td>'
            + '<td colspan="2"><div class="dual-date-pair tpl-dual-date">'
            + '<input class="doc-hijri tpl-input" type="text" placeholder="هـ" aria-label="هجري">'
            + '<input class="doc-date-picker tpl-input" type="text" placeholder="م" aria-label="ميلادي">'
            + '</div></td><td><input class="tpl-input" type="text"></td></tr>';
        }).join('')
      + '</tbody></table>'
      + '<h2 class="tpl-section-title">الشواهد المرفقة</h2>'
      + '<p class="tpl-empty">(قائمة فارغة — تُملأ من النظام دون اختراع)</p>';
  }
  function wireTitle(host) {
    var map = {"برنامج": "تقرير برنامج", "مسابقة": "تقرير مسابقة", "مبادرة": "تقرير مبادرة"};
    var kindSel = host.querySelector('#tpl-kind');
    var programSel = host.querySelector('#tpl-program');
    var audience = host.querySelector('#tpl-audience');
    var nameField = host.querySelector('#tpl-program-name');
    function applyKind() {
      window.TplCommon.setDynamicTitle(map[kindSel.value] || "تقرير برنامج / مسابقة / مبادرة", host);
    }
    function applyProgram() {
      var opt = programSel && programSel.options[programSel.selectedIndex];
      if (!opt || !opt.value) return;
      if (kindSel && opt.dataset.kind && !kindSel.dataset.userTouched) {
        kindSel.value = opt.dataset.kind;
      }
      if (nameField && opt.dataset.name) nameField.value = opt.dataset.name;
      if (audience && opt.dataset.audience && !audience.value) audience.value = opt.dataset.audience;
      applyKind();
    }
    if (kindSel) {
      kindSel.addEventListener('change', function () {
        kindSel.dataset.userTouched = '1';
        applyKind();
      });
      applyKind();
    }
    if (programSel) programSel.addEventListener('change', applyProgram);
  }

  function mount(opts) {
    opts = opts || {};
    if (!root.TplCommon || !root.OfficialFrameCore) {
      return Promise.reject(new Error('TplCommon أو OfficialFrameCore غير محمّل'));
    }
    var host = root.TplCommon.mountOfficial({
      title: "تقرير برنامج / مسابقة / مبادرة",
      bodyHtml: buildBodyHtml(),
      columns: [
        { roleTitle: "إعداد (prepared_by)", name: '', signature: '', signatureFallback: 'signatures/sig_teachers.png' },
        { roleTitle: "اعتماد أول (وكيل التعليمية)", name: '', signature: '', signatureFallback: 'signatures/sig_students.png' },
        { roleTitle: "اعتماد المدير (اختياري)", name: '', signature: '', signatureFallback: 'signatures/sig_manager.png' }
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
      return root.TplCommon.loadPrograms(opts.programsUrl || '../_shared/programs.json').then(function (programs) {
        root.TplCommon.populatePrograms(host.querySelector('#tpl-program'), programs);
        stats.programs = programs.length;
        return afterPop(stats);
      });
    });
  }
  root["TPL01"] = {
    mount: mount,
    printOfficial: function () { root.TplCommon.printOfficial({}); },
    DEFAULT_INDICATORS: DEFAULT_INDICATORS
  };
  // alias ثابت
  root["TPL-01"] = root["TPL01"];
})(window);
