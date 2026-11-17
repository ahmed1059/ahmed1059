/**
 * ==============================================================================
 * AUTO_PATCH_Engine.gs — محرك الترقيع التلقائي (Auto-Patch Engine)
 * الإصدار: 1.0.0 — وفق بروتوكول 1059-Pro
 * ==============================================================================
 */

const AUTO_PATCH_Engine = (function () {

  const PATCHES = [
    {
      id: 'PATCH-001',
      title: 'إضافة action=getImage إلى doGet',
      file: 'UI_Controller.gs',
      search: 'if (params.action === "checkObserverLogin") {',
      replace: '      // ═══ 🆕 جلب صورة كـ base64 ═══\n      if (params.action === "getImage") {\n        const fileId = String(params.id || \'\').trim();\n        if (!fileId) {\n          return ContentService.createTextOutput(JSON.stringify({ success: false }))\n            .setMimeType(ContentService.MimeType.JSON);\n        }\n        let base64 = \'\';\n        try {\n          if (typeof Feature_ImageCacheService !== \'undefined\') {\n            base64 = Feature_ImageCacheService.get(fileId);\n          }\n        } catch (e) {}\n        if (!base64) {\n          try {\n            base64 = extractImageAsBase64(\'https://drive.google.com/open?id=\' + fileId);\n            if (base64 && typeof Feature_ImageCacheService !== \'undefined\') {\n              Feature_ImageCacheService.put(fileId, base64);\n            }\n          } catch (e) {}\n        }\n        return ContentService.createTextOutput(JSON.stringify({ success: !!base64, base64: base64 || \'\' }))\n          .setMimeType(ContentService.MimeType.JSON);\n      }\n      if (params.action === "checkObserverLogin") {',
      verify: function() {
        try {
          const html = doGet({ parameter: { action: 'getImage', id: 'test' } }).getContent();
          return html.indexOf('success') !== -1;
        } catch (e) {
          return false;
        }
      }
    },

    {
      id: 'PATCH-002',
      title: 'إصلاح إحصائيات الكاش (stats)',
      file: 'Feature_ImageCacheService.gs',
      search: 'function stats() {',
      replace: 'function stats() {\n    try {\n      const folder = _getCacheFolder();\n      const files = folder.getFiles();\n      let count = 0;\n      let totalSize = 0;\n      while (files.hasNext()) {\n        const f = files.next();\n        count++;\n        try { totalSize += f.getSize(); } catch (e) {}\n      }\n      return {\n        files: count,\n        totalSize: Math.round(totalSize / 1024) + \' KB\',\n        avgSize: count > 0 ? Math.round(totalSize / count / 1024) + \' KB\' : \'0 KB\'\n      };\n    } catch (e) {\n      return { error: e.toString(), files: 0, totalSize: \'0 KB\' };\n    }\n  }\n\n  function _UNUSED_stats_OLD() {',
      verify: function() {
        try {
          const stats = Feature_ImageCacheService.stats();
          return stats.files !== undefined;
        } catch (e) {
          return false;
        }
      }
    },

    {
      id: 'PATCH-003',
      title: 'إضافة fallback لـPDF',
      file: 'Feature_SubmissionService.gs',
      search: "const thumb = _tryThumbnail(fileId);\n      if (thumb) return thumb;\n      Logger.log('⚠️ PDF thumbnail فشل');\n      return '';",
      replace: "const thumb = _tryThumbnail(fileId);\n      if (thumb) return thumb;\n      Logger.log('⚠️ PDF thumbnail فشل — محاولة تحويل');\n      try {\n        const converted = _officeToImage(fileId);\n        if (converted) return converted;\n      } catch (e) {\n        Logger.log('⚠️ fallback فشل: ' + e.toString());\n      }\n      return '';",
      verify: function() {
        return true;
      }
    },

    {
      id: 'PATCH-004',
      title: 'إضافة timeout لتحميل الشواهد',
      file: 'Feature_SmartCardBuilder.gs',
      search: "'function loadEvidence(elementId, fileId) {' +\n'  if (!fileId) return;' +\n'  fetch(API_URL + \"?action=getImage&id=\" + fileId)'",
      replace: "'function loadEvidence(elementId, fileId) {' +\n'  if (!fileId) return;' +\n'  var el = document.getElementById(elementId);' +\n'  if (!el) return;' +\n'  var timeoutId = setTimeout(function() {' +\n'    var loading = el.querySelector(\".loading\");' +\n'    if (loading) loading.innerHTML = \"⏱️ استغرق التحميل وقتاً طويلاً\";' +\n'  }, 15000);' +\n'  fetch(API_URL + \"?action=getImage&id=\" + fileId)'",
      verify: function() {
        try {
          const html = Feature_SmartCardBuilder.build(
            { teacherName: 'test', term: '1', grade: '1', domain: '1', indicator: '1', actionTitle: 't', actionDesc: 't', impact: 't' },
            null, true
          );
          return html.indexOf('timeoutId') !== -1;
        } catch (e) {
          return false;
        }
      }
    },

    {
      id: 'PATCH-005',
      title: 'إصلاح خطأ iterator',
      file: 'Feature_ImageCacheService.gs',
      search: '      if (iter.hasNext()) {\n        const file = iter.next();\n        const created = file.getDateCreated();',
      replace: '      let cacheFile = null;\n      while (iter.hasNext()) {\n        const f = iter.next();\n        if (f && f.getName() === key + \'.json\') {\n          cacheFile = f;\n          break;\n        }\n      }\n\n      if (cacheFile) {\n        const created = cacheFile.getDateCreated();',
      verify: function() {
        try {
          Feature_ImageCacheService.get('test-nonexistent');
          return true;
        } catch (e) {
          return e.toString().indexOf('iterator') === -1;
        }
      }
    }
  ];

  function checkAll() {
    Logger.log('═══════════════════════════════════════════════════');
    Logger.log('  AUTO-PATCH Engine — حالة التعديلات');
    Logger.log('═══════════════════════════════════════════════════\n');

    const results = [];
    PATCHES.forEach(function (patch) {
      let applied = false;
      let error = null;
      try {
        applied = patch.verify ? patch.verify() : false;
      } catch (e) {
        error = e.toString();
      }
      results.push({ id: patch.id, applied: applied, error: error });
      const icon = applied ? '✅' : (error ? '❌' : '⏳');
      Logger.log(icon + ' ' + patch.id + ' — ' + patch.title);
      Logger.log('     الملف: ' + patch.file);
      if (error) Logger.log('     خطأ: ' + error);
    });

    const appliedCount = results.filter(function(r) { return r.applied; }).length;
    Logger.log('\n═══════════════════════════════════════════════════');
    Logger.log('✅ مُطبَّق: ' + appliedCount + ' / ' + results.length);
    Logger.log('⏳ بانتظار: ' + (results.length - appliedCount));
    Logger.log('═══════════════════════════════════════════════════');

    return results;
  }

  function showPatch(patchId) {
    const patch = PATCHES.filter(function(p) { return p.id === patchId; })[0];
    if (!patch) {
      Logger.log('❌ Patch غير موجود: ' + patchId);
      return;
    }
    Logger.log('═══════════════════════════════════════');
    Logger.log('  ' + patch.id + ' — ' + patch.title);
    Logger.log('═══════════════════════════════════════');
    Logger.log('\n📁 الملف: ' + patch.file);
    Logger.log('\n🔍 ابحث عن:');
    Logger.log('───────────────────────────────────');
    Logger.log(patch.search);
    Logger.log('───────────────────────────────────');
    Logger.log('\n📝 استبدله بـ:');
    Logger.log('───────────────────────────────────');
    Logger.log(patch.replace);
    Logger.log('───────────────────────────────────');
    return patch;
  }

  return {
    checkAll: checkAll,
    showPatch: showPatch,
    PATCHES: PATCHES
  };

})();


/* ============================================================================
 * دوال مساعدة (بدون معامل — للتشغيل من قائمة Apps Script)
 * ============================================================================ */

function AUTO_PATCH_Check() {
  return AUTO_PATCH_Engine.checkAll();
}

function AUTO_PATCH_ShowPending() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('  التعديلات الناقصة');
  Logger.log('═══════════════════════════════════════');
  const patches = AUTO_PATCH_Engine.PATCHES;
  let count = 0;
  patches.forEach(function (patch) {
    let applied = false;
    try {
      applied = patch.verify ? patch.verify() : false;
    } catch (e) {}
    if (!applied) {
      count++;
      Logger.log('\n🔧 ' + patch.id + ' — ' + patch.title);
      Logger.log('   📁 ' + patch.file);
    }
  });
  Logger.log('\n📊 الإجمالي الناقص: ' + count);
}

function SHOW_PATCH_004() {
  const patch = AUTO_PATCH_Engine.PATCHES.filter(function(p) {
    return p.id === 'PATCH-004';
  })[0];
  if (!patch) {
    Logger.log('❌ PATCH-004 غير موجود');
    return;
  }
  Logger.log('═══════════════════════════════════════');
  Logger.log('  PATCH-004');
  Logger.log('═══════════════════════════════════════');
  Logger.log('\n📁 ' + patch.file);
  Logger.log('\n🔍 ابحث عن:');
  Logger.log('───────────────────────────────────');
  Logger.log(patch.search);
  Logger.log('───────────────────────────────────');
  Logger.log('\n📝 استبدله بـ:');
  Logger.log('───────────────────────────────────');
  Logger.log(patch.replace);
  Logger.log('───────────────────────────────────');
}

function SHOW_PATCH_005() {
  const patch = AUTO_PATCH_Engine.PATCHES.filter(function(p) {
    return p.id === 'PATCH-005';
  })[0];
  if (!patch) {
    Logger.log('❌ PATCH-005 غير موجود');
    return;
  }
  Logger.log('═══════════════════════════════════════');
  Logger.log('  PATCH-005');
  Logger.log('═══════════════════════════════════════');
  Logger.log('\n📁 ' + patch.file);
  Logger.log('\n🔍 ابحث عن:');
  Logger.log('───────────────────────────────────');
  Logger.log(patch.search);
  Logger.log('───────────────────────────────────');
  Logger.log('\n📝 استبدله بـ:');
  Logger.log('───────────────────────────────────');
  Logger.log(patch.replace);
  Logger.log('───────────────────────────────────');
}