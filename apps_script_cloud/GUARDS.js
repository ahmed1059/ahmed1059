/**
 * ==============================================================================
 * _GUARDS.gs — حراس 1059 (1059 Guards)
 * ------------------------------------------------------------------------------
 * الإصدار: 1.0.0 — وفق بروتوكول 1059-Pro
 * ------------------------------------------------------------------------------
 * الغرض:
 *   - منع الترقيع (Patch Prevention)
 *   - منع الكسر (Break Prevention)
 *   - منع الفقدان (Data Loss Prevention)
 * ==============================================================================
 */

const _GUARDS = (function() {

  /**
   * حارس 1: لا ترقيع
   */
  function guardNoPatch(action) {
    const patchIndicators = [
      'patch',
      'quick fix',
      'temp',
      'temporary',
      'hack',
      'workaround'
    ];
    
    const actionLower = String(action || '').toLowerCase();
    const isPatch = patchIndicators.some(ind => actionLower.includes(ind));
    
    if (isPatch) {
      Logger.log('🔴 GUARD: محاولة ترقيع مرفوضة');
      Logger.log('   الإجراء: ' + action);
      Logger.log('   الحل: أعد صياغة كحل جذري');
      return false;
    }
    
    Logger.log('✅ GUARD: لا ترقيع');
    return true;
  }

  /**
   * حارس 2: لا كسر
   */
  function guardNoBreak(changedFiles) {
    Logger.log('🔍 GUARD: فحص الأثر');
    
    const criticalFiles = [
      'UI_Controller.gs',
      'Feature_SmartCardBuilder.gs',
      'CardRenderer.gs',
      'Core_Config.gs'
    ];
    
    const affected = changedFiles.filter(f => criticalFiles.includes(f));
    
    if (affected.length > 0) {
      Logger.log('⚠️ ملفات حرجة:');
      affected.forEach(f => Logger.log('   - ' + f));
      Logger.log('   ✅ مطلوب: اختبار شامل بعد التعديل');
      return { safe: true, requiresTest: true, files: affected };
    }
    
    Logger.log('✅ GUARD: لا ملفات حرجة');
    return { safe: true, requiresTest: false };
  }

  /**
   * حارس 3: لا فقدان
   */
  function guardNoDataLoss(operation) {
    const dangerousOps = [
      'delete',
      'purge',
      'trash',
      'remove',
      'clear'
    ];
    
    const opLower = String(operation || '').toLowerCase();
    const isDangerous = dangerousOps.some(op => opLower.includes(op));
    
    if (isDangerous) {
      Logger.log('🔴 GUARD: عملية خطرة');
      Logger.log('   الإجراء: ' + operation);
      Logger.log('   ⚠️ مطلوب: نسخة احتياطية قبل التنفيذ');
      
      try {
        const backup = Feature_AdminService.purgeTestEvidence ? 'available' : 'check';
        return { dangerous: true, requiresBackup: true };
      } catch (e) {
        return { dangerous: true, requiresBackup: true, error: e.toString() };
      }
    }
    
    Logger.log('✅ GUARD: عملية آمنة');
    return { dangerous: false };
  }

  /**
   * فحص شامل
   */
  function check(action, changedFiles) {
    const results = {
      noPatch: guardNoPatch(action),
      noBreak: guardNoBreak(changedFiles || []),
      noDataLoss: guardNoDataLoss(action)
    };
    
    const allPassed = results.noPatch && results.noBreak.safe && !results.noDataLoss.dangerous;
    
    Logger.log('');
    Logger.log('═══════════════════════════════════════');
    Logger.log('  🛡️ نتيجة حراس 1059');
    Logger.log('═══════════════════════════════════════');
    Logger.log('   لا ترقيع: ' + (results.noPatch ? '✅' : '❌'));
    Logger.log('   لا كسر: ' + (results.noBreak.safe ? '✅' : '❌'));
    Logger.log('   لا فقدان: ' + (!results.noDataLoss.dangerous ? '✅' : '⚠️'));
    Logger.log('   النتيجة: ' + (allPassed ? '✅ مسموح' : '❌ مرفوض'));
    Logger.log('═══════════════════════════════════════');
    
    return {
      allPassed: allPassed,
      details: results
    };
  }

  return {
    guardNoPatch: guardNoPatch,
    guardNoBreak: guardNoBreak,
    guardNoDataLoss: guardNoDataLoss,
    check: check
  };

})();


function TEST_GUARDS() {
  Logger.log('🧪 اختبار الحراس\n');
  
  _GUARDS.check('إضافة patch سريع', ['UI_Controller.gs']);
  _GUARDS.check('إعادة بناء v2.0', ['Feature_SmartCardBuilder.gs']);
}