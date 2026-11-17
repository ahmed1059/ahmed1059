(function (root) {
  "use strict";
  function mount(opts) {
    opts = opts || {};
    var host = root.TplCommon.mountOfficial({
      title: "تقارير فريدة — توثيق",
      bodyHtml: '<div class="tpl-field-grid">'
        + root.TplCommon.fieldText('tpl-source-title', 'عنوان النموذج كما في المصدر', true)
        + root.TplCommon.dualDateHtml('التاريخ إن وُجد — هجري أولاً ثم ميلادي')
        + root.TplCommon.fieldSelect('tpl-prepared', 'معدّ اختياري', 'data-tpl-persons')
        + '<div class="tpl-field full"><p class="tpl-empty">صنف توثيقي ضمن TPL-09 · لا يُجبر على عائلة 01–07 · approved_by غالباً none</p></div>'
        + root.TplCommon.fieldTextarea('tpl-notes', 'حقول المصدر (وصف حر دون اختراع قيم)')
        + '</div>',
      columns: [
        { roleTitle: 'معدّ (اختياري)', name: '', signature: '', signatureFallback: 'signatures/sig_teachers.png' },
        { roleTitle: '—', name: '', signature: '', signatureFallback: 'signatures/sig_students.png' },
        { roleTitle: '—', name: '', signature: '', signatureFallback: 'signatures/sig_manager.png' }
      ]
    });
    return root.TplCommon.populateDropdowns({
      identityUrl: opts.identityUrl || '../_shared/identity.json',
      indicatorsUrl: opts.indicatorsUrl || '../_shared/indicators.json',
      defaultIndicators: [],
      root: host
    }).then(function (stats) {
      root.TplCommon.bindSystemCalendars(host);
      if (opts.statusEl) opts.statusEl.textContent = 'stub · أسماء: ' + stats.persons + ' · بلا توحيد قسري';
      return stats;
    });
  }
  root["TPL09c"] = { mount: mount, printOfficial: function () { root.TplCommon.printOfficial({}); } };
  root["TPL-09c"] = root["TPL09c"];
})(window);
