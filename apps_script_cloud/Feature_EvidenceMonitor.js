/**
 * ==============================================================================
 * Feature_EvidenceMonitor.gs — المراقب التلقائي
 * ---------------------------------------------------------------------------
 * - Trigger دوري يفحص كل الشواهد
 * - يُصلح الصلاحيات تلقائياً
 * - يُرسل تقريراً للإدارة
 * ==============================================================================
 */

function MONITOR_RunAudit() {
  Logger.log('═══════════════════════════════════════════════════');
  Logger.log('  Shahid-Dhaman Monitor');
  Logger.log('  التاريخ: ' + new Date().toLocaleString('ar-SA'));
  Logger.log('═══════════════════════════════════════════════════\n');

  // 1. الفحص مع الإصلاح التلقائي
  const report = AUDIT_AllEvidence({ autoFix: true, writeBack: true });

  // 2. تسجيل في Audit_Log
  try {
    const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
    let logSheet = ss.getSheetByName(Core_Config.get('SHEET_AUDIT_LOG'));
    if (!logSheet) {
      logSheet = ss.insertSheet(Core_Config.get('SHEET_AUDIT_LOG'));
      logSheet.appendRow(['timestamp', 'action', 'total', 'valid', 'fixed', 'missing', 'details']);
    }

    logSheet.appendRow([
      new Date(),
      'AUDIT_EVIDENCE',
      report.total,
      report.valid,
      report.fixed,
      report.missing,
      'مشاكل: ' + (report.total - report.valid - report.fixed)
    ]);
  } catch (e) {
    Logger.log('⚠️ تعذر تسجيل العملية: ' + e.toString());
  }

  Logger.log('\n✅ اكتمل الفحص الدوري');
  return report;
}

/**
 * إعداد Trigger كل 6 ساعات.
 */
function MONITOR_SetupTrigger() {
  // احذف كل triggers الموجودة
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'MONITOR_RunAudit') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // أنشئ trigger كل 6 ساعات
  ScriptApp.newTrigger('MONITOR_RunAudit')
    .timeBased()
    .everyHours(6)
    .create();

  Logger.log('✅ تم إعداد Trigger كل 6 ساعات');
}