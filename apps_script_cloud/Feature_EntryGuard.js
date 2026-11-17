/**
 * ==============================================================================
 * Feature_EntryGuard.gs — حارس التحقق من هوية المُدخِل
 * ---------------------------------------------------------------------------
 * الإصدار: 1.0.0 — وفق بروتوكول 1059-Pro
 * ---------------------------------------------------------------------------
 * الوظيفة:
 *   1. استخراج "رمز الدخول المعتمد" من الرد
 *   2. التحقق من:
 *      - وجوده في Staff_All + status=نشط → ✅
 *      - مطابقته لـ observer_password (123123) → ✅
 *   3. تسجيل النتيجة في Audit_Log
 *   4. إرجاع { valid: true/false, person: {...} }
 * ==============================================================================
 */

const Feature_EntryGuard = (function () {

  /**
   * استخراج رمز الدخول من الرد.
   */
  function _extractCode(response) {
    if (!response) return '';
    try {
      const itemResponses = response.getItemResponses();
      for (let i = 0; i < itemResponses.length; i++) {
        const title = String(itemResponses[i].getItem().getTitle() || '');
        if (title.indexOf('رمز الدخول') !== -1) {
          const val = itemResponses[i].getResponse();
          return String(val || '').trim().replace(/\D/g, ''); // أرقام فقط
        }
      }
    } catch (e) {
      Logger.log('⚠️ _extractCode: ' + e.toString());
    }
    return '';
  }

  /**
   * التحقق من الرمز.
   */
  function verify(code) {
    const clean = String(code || '').trim().replace(/\D/g, '');

    if (!clean) {
      return { valid: false, reason: 'EMPTY_CODE' };
    }

    // ═══ 1. المشرف المقيم (123123) ═══
    const observerPassword = String(SettingsService.getFresh('observer_password') || '123123').trim();
    if (clean === observerPassword) {
      return {
        valid: true,
        type: 'OBSERVER',
        person: {
          name: String(SettingsService.getFresh('observer_name') || 'مشرف مقيم'),
          role: 'مشرف مقيم / مراقب',
          nationalId: clean
        }
      };
    }

    // ═══ 2. المنسوب النشط ═══
    const staff = Core_DataLayer.getStaffList();
    const match = staff.filter(function (s) {
      return String(s.nationalId || '').trim() === clean;
    })[0];

    if (match) {
      return {
        valid: true,
        type: 'STAFF',
        person: {
          name: match.name,
          role: match.role,
          nationalId: match.nationalId
        }
      };
    }

    // ═══ 3. البحث كـ ID قصير (احتياطي) ═══
    const shortMatch = staff.filter(function (s) {
      const id = String(s.nationalId || '').trim();
      return id.endsWith(clean) && clean.length >= 6;
    })[0];

    if (shortMatch) {
      return {
        valid: true,
        type: 'STAFF',
        person: {
          name: shortMatch.name,
          role: shortMatch.role,
          nationalId: shortMatch.nationalId
        }
      };
    }

    return { valid: false, reason: 'NOT_FOUND', code: clean };
  }

  /**
   * معالجة الاستقبال الكامل (يُشغَّل من onFormSubmit).
   */
  function handleSubmission(e) {
    try {
      Logger.log('═══════════════════════════════════════');
      Logger.log('  EntryGuard — فحص المُدخِل');
      Logger.log('═══════════════════════════════════════');

      const response = e && e.response;
      if (!response) {
        Logger.log('⚠️ لا يوجد response');
        return { valid: false, reason: 'NO_RESPONSE' };
      }

      // 1. استخراج الرمز
      const code = _extractCode(response);
      Logger.log('🔑 الرمز المُدخَل: ' + (code || '(فارغ)'));

      // 2. التحقق
      const result = verify(code);
      Logger.log('📋 النتيجة: ' + (result.valid ? '✅ قبول' : '❌ رفض'));
      if (result.valid) {
        Logger.log('   النوع: ' + result.type);
        Logger.log('   الاسم: ' + result.person.name);
        Logger.log('   الصفة: ' + result.person.role);
      } else {
        Logger.log('   السبب: ' + result.reason);
      }

      // 3. تسجيل في Audit_Log
      _logAttempt(result, code);

      return result;
    } catch (err) {
      Logger.log('❌ EntryGuard error: ' + err.toString());
      return { valid: false, reason: 'ERROR', error: err.toString() };
    }
  }

  /**
   * تسجيل المحاولة.
   */
  function _logAttempt(result, code) {
    try {
      const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
      let logSheet = ss.getSheetByName(Core_Config.get('SHEET_AUDIT_LOG'));
      if (!logSheet) return;

      const action = result.valid ? 'ENTRY_VALID' : 'ENTRY_INVALID';
      const details = result.valid
        ? result.person.name + ' — ' + result.person.role
        : 'رفض: ' + result.reason + ' (الرمز: ' + (code || 'فارغ') + ')';

      logSheet.appendRow([
        new Date(), action, '', '', '', '', '', '', details
      ]);
    } catch (e) {
      Logger.log('⚠️ _logAttempt: ' + e.toString());
    }
  }

  return {
    verify: verify,
    handleSubmission: handleSubmission,
    _extractCode: _extractCode
  };

})();