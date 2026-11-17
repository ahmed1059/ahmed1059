/**
 * ==============================================================================
 * RCA_Live_Scanner.gs — الفحص الذاتي الحي (Live Self-Diagnosis)
 * ---------------------------------------------------------------------------
 * الإصدار: 2.0.0 — وفق بروتوكول 1059-Pro
 * ---------------------------------------------------------------------------
 * بديل ذكي عن قراءة الملفات:
 *   - يستدعي الدوال الفعلية في وقت التشغيل
 *   - يفحص السلوك لا الكود
 *   - يكشف 15 نوع عطل تشغيلي
 * ==============================================================================
 */

const RCA_Live_Scanner = (function () {

  /* ==========================================================================
   * القسم 1: اختبارات الطبقات
   * ========================================================================== */

  function _testCoreConfig() {
    const issues = [];
    try {
      const id = Core_Config.get('SPREADSHEET_ID');
      if (!id) issues.push({ sev: 'CRITICAL', msg: 'SPREADSHEET_ID مفقود' });
      if (!Core_Config.get('MASTER_ROOT_FOLDER_ID')) issues.push({ sev: 'CRITICAL', msg: 'MASTER_ROOT_FOLDER_ID مفقود' });
      if (!Core_Config.get('MOE_LOGO_FILE_ID')) issues.push({ sev: 'HIGH', msg: 'MOE_LOGO_FILE_ID مفقود' });
      const adminIds = Core_Config.get('ADMIN_NATIONAL_IDS');
      if (!Array.isArray(adminIds) || adminIds.length === 0) issues.push({ sev: 'HIGH', msg: 'ADMIN_NATIONAL_IDS فارغ' });
    } catch (e) {
      issues.push({ sev: 'CRITICAL', msg: 'Core_Config لا يستجيب: ' + e.toString() });
    }
    return { name: 'Core_Config', issues: issues };
  }

  function _testSettingsService() {
    const issues = [];
    try {
      const all = SettingsService.getAll();
      const required = ['vice_name', 'manager_name', 'school_name', 'observer_enabled', 'observer_password'];
      required.forEach(function (k) {
        if (!all[k]) issues.push({ sev: 'HIGH', msg: 'إعداد مفقود: ' + k });
      });
      const fresh = SettingsService.getFresh('observer_password');
      if (!fresh) issues.push({ sev: 'HIGH', msg: 'getFresh لا يعمل' });
      if (fresh !== all.observer_password) {
        issues.push({ sev: 'MEDIUM', msg: 'getFresh و get يعطيان قيماً مختلفة' });
      }
    } catch (e) {
      issues.push({ sev: 'CRITICAL', msg: 'SettingsService لا يستجيب: ' + e.toString() });
    }
    return { name: 'SettingsService', issues: issues };
  }

  function _testCoreContext() {
    const issues = [];
    try {
      Core_Context.invalidateAll();
      const t0 = Date.now();
      const s1 = Core_Context.getStaffList();
      const t1 = Date.now();
      const s2 = Core_Context.getStaffList();
      const t2 = Date.now();

      if (!Array.isArray(s1) || s1.length === 0) {
        issues.push({ sev: 'CRITICAL', msg: 'getStaffList يرجع فارغاً' });
      }
      const cacheSpeedup = (t1 - t0) - (t2 - t1);
      if (cacheSpeedup < 100) {
        issues.push({ sev: 'MEDIUM', msg: 'الكاش لا يعطي تحسناً ملموساً (' + cacheSpeedup + 'ms)' });
      }
      if ((t1 - t0) > 5000) issues.push({ sev: 'MEDIUM', msg: 'القراءة الأولى بطيئة جداً: ' + (t1-t0) + 'ms' });
    } catch (e) {
      issues.push({ sev: 'CRITICAL', msg: 'Core_Context لا يستجيب: ' + e.toString() });
    }
    return { name: 'Core_Context', issues: issues };
  }

  function _testUtilNameNormalizer() {
    const issues = [];
    try {
      const s = Util_NameNormalizer.matchScore('أحمد علي', 'احمد علي');
      if (s < 90) issues.push({ sev: 'MEDIUM', msg: 'matchScore منخفض: ' + s });
      const d = Util_NameNormalizer.getDisplay('أحمد الشهري - مسؤول');
      if (d.indexOf(' - ') !== -1) issues.push({ sev: 'MEDIUM', msg: 'getDisplay لا يزيل اللاحقة' });
      if (typeof Util_NameNormalizer.getCanonical !== 'function') {
        issues.push({ sev: 'CRITICAL', msg: 'getCanonical مفقود' });
      }
      if (typeof Util_NameNormalizer.debugMatch !== 'function') {
        issues.push({ sev: 'HIGH', msg: 'debugMatch مفقود' });
      }
    } catch (e) {
      issues.push({ sev: 'CRITICAL', msg: 'Util_NameNormalizer لا يستجيب: ' + e.toString() });
    }
    return { name: 'Util_NameNormalizer', issues: issues };
  }

  function _testDataLayer() {
    const issues = [];
    try {
      const list = Core_DataLayer.getStaffList();
      if (!Array.isArray(list)) issues.push({ sev: 'CRITICAL', msg: 'getStaffList يرجع غير مصفوفة' });
      const recs = Core_DataLayer.getAllEvidenceRecords();
      if (!Array.isArray(recs)) issues.push({ sev: 'CRITICAL', msg: 'getAllEvidenceRecords يرجع غير مصفوفة' });
      // فحص بنية السجل
      if (recs.length > 0) {
        const r = recs[0];
        ['rowIndex', 'teacher', 'indicator', 'domain'].forEach(function (k) {
          if (r[k] === undefined) issues.push({ sev: 'HIGH', msg: 'سجل ناقص الحقل: ' + k });
        });
      }
    } catch (e) {
      issues.push({ sev: 'CRITICAL', msg: 'Core_DataLayer لا يستجيب: ' + e.toString() });
    }
    return { name: 'Core_DataLayer', issues: issues };
  }

  function _testReportService() {
    const issues = [];
    try {
      const rep = Feature_ReportService.generateParticipationReport();
      if (!rep.success) issues.push({ sev: 'CRITICAL', msg: 'generateParticipationReport فشل' });
      if (!rep.summary) issues.push({ sev: 'HIGH', msg: 'summary مفقود' });
      if (!rep.domains) issues.push({ sev: 'HIGH', msg: 'domains مفقود' });
      if (!Array.isArray(rep.lists?.activeStaff)) issues.push({ sev: 'HIGH', msg: 'activeStaff مفقود' });
      const domainsCount = Object.keys(rep.domains || {}).length;
      if (domainsCount !== 4) issues.push({ sev: 'MEDIUM', msg: 'عدد المجالات ' + domainsCount + ' بدلاً من 4' });
    } catch (e) {
      issues.push({ sev: 'CRITICAL', msg: 'Feature_ReportService لا يستجيب: ' + e.toString() });
    }
    return { name: 'Feature_ReportService', issues: issues };
  }

  function _testSubmissionService() {
    const issues = [];
    try {
      if (typeof Feature_SubmissionService.reprocessRow !== 'function') {
        issues.push({ sev: 'CRITICAL', msg: 'reprocessRow مفقود' });
      }
      if (typeof Feature_SubmissionService._extractRowData !== 'function') {
        issues.push({ sev: 'HIGH', msg: '_extractRowData مفقود' });
      }
      if (typeof extractImageAsBase64 !== 'function') {
        issues.push({ sev: 'CRITICAL', msg: 'extractImageAsBase64 مفقود' });
      }
    } catch (e) {
      issues.push({ sev: 'CRITICAL', msg: 'Feature_SubmissionService لا يستجيب: ' + e.toString() });
    }
    return { name: 'Feature_SubmissionService', issues: issues };
  }

  function _testAdminService() {
    const issues = [];
    try {
      if (typeof Feature_AdminService.purgeTestEvidence !== 'function') {
        issues.push({ sev: 'CRITICAL', msg: 'purgeTestEvidence مفقود' });
      }
      if (typeof Feature_AdminService._cleanupOldBackups !== 'function') {
        issues.push({ sev: 'HIGH', msg: '_cleanupOldBackups مفقود' });
      }
    } catch (e) {
      issues.push({ sev: 'CRITICAL', msg: 'Feature_AdminService لا يستجيب: ' + e.toString() });
    }
    return { name: 'Feature_AdminService', issues: issues };
  }

  function _testImportService() {
    const issues = [];
    try {
      if (typeof Feature_ImportService.importFromNurFolder !== 'function') {
        issues.push({ sev: 'CRITICAL', msg: 'importFromNurFolder مفقود' });
      }
      if (typeof Feature_ImportService.ensureFoldersForAll !== 'function') {
        issues.push({ sev: 'HIGH', msg: 'ensureFoldersForAll مفقود' });
      }
    } catch (e) {
      issues.push({ sev: 'CRITICAL', msg: 'Feature_ImportService لا يستجيب: ' + e.toString() });
    }
    return { name: 'Feature_ImportService', issues: issues };
  }

  function _testCardTemplate() {
    const issues = [];
    try {
      if (typeof CardTemplate.buildCardHtml !== 'function') {
        issues.push({ sev: 'CRITICAL', msg: 'buildCardHtml مفقود' });
        return { name: 'CardTemplate', issues: issues };
      }
      // اختبار بسيط
      const fakeData = {
        teacherName: 'اختبار',
        term: '1',
        grade: '1',
        domain: '01',
        indicator: '(1-1-1-1) اختبار',
        actionTitle: 'test',
        actionDesc: 'test',
        impact: 'test',
        evidence1: '',
        evidence2: ''
      };
      const html = CardTemplate.buildCardHtml(fakeData, null, true);
      if (!html || html.length < 1000) issues.push({ sev: 'HIGH', msg: 'buildCardHtml ينتج HTML قصير' });
      if (html.indexOf('__OBSERVER__') !== -1) issues.push({ sev: 'LOW', msg: 'تسرب __OBSERVER__ إلى HTML' });
      if (html.indexOf('openEvidencePreview') === -1) issues.push({ sev: 'MEDIUM', msg: 'Modal معاينة الشاهد مفقود' });
    } catch (e) {
      issues.push({ sev: 'CRITICAL', msg: 'CardTemplate لا يستجيب: ' + e.toString() });
    }
    return { name: 'CardTemplate', issues: issues };
  }

  function _testUIController() {
    const issues = [];
    try {
      if (typeof doGet !== 'function') {
        issues.push({ sev: 'CRITICAL', msg: 'doGet مفقود' });
        return { name: 'UI_Controller', issues: issues };
      }

      // اختبار doGet بدون parameters
      const out = doGet({});
      const html = out.getContent();

      if (!html || html.length < 1000) {
        issues.push({ sev: 'CRITICAL', msg: 'doGet يرجع HTML قصير: ' + html.length });
        return { name: 'UI_Controller', issues: issues };
      }

      // فحص العناصر الضرورية
      const checks = {
        'const staffList': 'staffList غير محقون',
        'const observerName': 'observerName غير محقون',
        'const observerEnabled': 'observerEnabled غير محقون',
        '__OBSERVER__': 'خيار المشرف مفقود',
        'checkObserverLogin': 'دالة checkObserverLogin مفقودة',
        'openCardInViewer': 'دالة openCardInViewer مفقودة',
        'batchPrintAll': 'دالة batchPrintAll مفقودة',
        'confirmPurge': 'دالة confirmPurge مفقودة',
        'printStatsReport': 'دالة printStatsReport مفقودة',
        'renderGuide': 'دالة renderGuide مفقودة'
      };

      Object.keys(checks).forEach(function (k) {
        if (html.indexOf(k) === -1) issues.push({ sev: 'HIGH', msg: checks[k] });
      });

      // فحص تكرار checkObserverLogin
      const occurrences = (html.match(/function checkObserverLogin/g) || []).length;
      if (occurrences > 1) {
        issues.push({ sev: 'CRITICAL', msg: 'checkObserverLogin مكررة ' + occurrences + ' مرات' });
      }

      // فحص \n مكشوف
      const nakedNlPattern = /'[^'\\]*\n[^']*'/g;
      const nakedMatches = html.match(nakedNlPattern) || [];
      if (nakedMatches.length > 100) {
        issues.push({ sev: 'MEDIUM', msg: 'احتمال وجود \\n مكشوف (' + nakedMatches.length + ' حالة)' });
      }
    } catch (e) {
      issues.push({ sev: 'CRITICAL', msg: 'UI_Controller لا يستجيب: ' + e.toString() });
    }
    return { name: 'UI_Controller', issues: issues };
  }

  function _testDoGetActions() {
    const issues = [];

    // اختبار checkObserverLogin
    try {
      const res = doGet({ parameter: { action: 'checkObserverLogin', pass: '123123' } });
      const content = res.getContent();
      if (content.indexOf('"success":true') === -1) {
        issues.push({ sev: 'CRITICAL', msg: 'checkObserverLogin يفشل مع كلمة المرور الصحيحة' });
      }
    } catch (e) {
      issues.push({ sev: 'CRITICAL', msg: 'checkObserverLogin يرمي خطأ: ' + e.toString() });
    }

    // اختبار كلمة مرور خاطئة
    try {
      const res = doGet({ parameter: { action: 'checkObserverLogin', pass: 'xxx' } });
      if (res.getContent().indexOf('"success":false') === -1) {
        issues.push({ sev: 'HIGH', msg: 'checkObserverLogin يقبل كلمة مرور خاطئة' });
      }
    } catch (e) {
      issues.push({ sev: 'HIGH', msg: 'checkObserverLogin لا يرفض كلمة خاطئة: ' + e.toString() });
    }

    // اختبار getReportData
    try {
      const res = doGet({ parameter: { action: 'getReportData' } });
      const json = JSON.parse(res.getContent());
      if (!json.success) issues.push({ sev: 'HIGH', msg: 'getReportData يرجع success=false' });
    } catch (e) {
      issues.push({ sev: 'CRITICAL', msg: 'getReportData يرمي خطأ: ' + e.toString() });
    }

    // اختبار printCard
    try {
      const res = doGet({ parameter: { action: 'printCard', row: '2' } });
      const html = res.getContent();
      if (html.length < 500) issues.push({ sev: 'HIGH', msg: 'printCard يرجع HTML قصير' });
    } catch (e) {
      issues.push({ sev: 'HIGH', msg: 'printCard يرمي خطأ: ' + e.toString() });
    }

    return { name: 'doGet Actions', issues: issues };
  }

  /* ==========================================================================
   * القسم 2: الواجهة الرئيسية
   * ========================================================================== */

  function runFullScan() {
    Logger.log('═══════════════════════════════════════════════════');
    Logger.log('  RCA-Live-1059 — الفحص الذاتي الحي');
    Logger.log('═══════════════════════════════════════════════════\n');

    const startTime = Date.now();
    const results = [];
    let totalIssues = 0;
    const severityCount = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

    const tests = [
      _testCoreConfig,
      _testSettingsService,
      _testCoreContext,
      _testUtilNameNormalizer,
      _testDataLayer,
      _testReportService,
      _testSubmissionService,
      _testAdminService,
      _testImportService,
      _testCardTemplate,
      _testUIController,
      _testDoGetActions
    ];

    tests.forEach(function (testFn) {
      const result = testFn();
      results.push(result);
      totalIssues += result.issues.length;
      result.issues.forEach(function (i) { severityCount[i.sev] = (severityCount[i.sev] || 0) + 1; });
      const icon = result.issues.length === 0 ? '✅' : (result.issues.some(i => i.sev === 'CRITICAL') ? '🔴' : '⚠️');
      Logger.log(icon + ' ' + result.name + ' — ' + result.issues.length + ' مشكلة');
    });

    Logger.log('\n═══════════════════════════════════════════════════');
    Logger.log('  الملخص');
    Logger.log('═══════════════════════════════════════════════════');
    Logger.log('⏱️  المدة: ' + (Date.now() - startTime) + 'ms');
    Logger.log('🔍 إجمالي المشاكل: ' + totalIssues);
    Logger.log('   🔴 CRITICAL: ' + severityCount.CRITICAL);
    Logger.log('   🟠 HIGH:     ' + severityCount.HIGH);
    Logger.log('   🟡 MEDIUM:   ' + severityCount.MEDIUM);
    Logger.log('   🟢 LOW:      ' + severityCount.LOW);

    if (totalIssues > 0) {
      Logger.log('\n═══════════════════════════════════════════════════');
      Logger.log('  التفاصيل');
      Logger.log('═══════════════════════════════════════════════════');
      results.forEach(function (r) {
        if (r.issues.length === 0) return;
        Logger.log('\n📁 ' + r.name + ':');
        r.issues.forEach(function (issue, i) {
          const icon = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' }[issue.sev];
          Logger.log('   [' + (i+1) + '] ' + icon + ' ' + issue.msg);
        });
      });
    } else {
      Logger.log('\n✅ النظام نظيف!');
    }

    return {
      totalIssues: totalIssues,
      severityCount: severityCount,
      results: results
    };
  }

  return { runFullScan: runFullScan };

})();


/**
 * تشغيل الفحص الشامل.
 */
function RUN_RCA_LiveScan() {
  return RCA_Live_Scanner.runFullScan();
}