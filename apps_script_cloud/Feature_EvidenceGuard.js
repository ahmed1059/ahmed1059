/**
 * ==============================================================================
 * Feature_EvidenceGuard.gs — حارس الشواهد (Shahid-Dhaman Guard)
 * ---------------------------------------------------------------------------
 * الإصدار: 1.0.0 — وفق بروتوكول 1059-Pro
 * ---------------------------------------------------------------------------
 * المهمة:
 *   - فحص كل شاهد بـ 3 طبقات قبل التسجيل
 *   - إصلاح تلقائي للصلاحيات
 *   - رصد المشاكل مبكراً
 * ==============================================================================
 */

const Feature_EvidenceGuard = (function () {

  /* ==========================================================================
   * القسم 1: الأخطاء القياسية
   * ========================================================================== */

  const STATUS = {
    VALID:           'VALID',           // سليم
    MISSING:         'MISSING',         // الملف غير موجود
    NO_PERMISSION:   'NO_PERMISSION',   // لا صلاحية
    NOT_PREVIEWABLE: 'NOT_PREVIEWABLE', // لا يمكن معاينته
    INVALID_URL:     'INVALID_URL',     // رابط خاطئ
    NO_URL:          'NO_URL',          // لا يوجد رابط
    FIXED:           'FIXED'            // تم الإصلاح التلقائي
  };

  /* ==========================================================================
   * القسم 2: استخراج File ID
   * ========================================================================== */

  function _extractFileId(url) {
    if (!url) return '';
    var s = String(url).trim();
    var m = s.match(/\/file\/d\/([-\w]{25,})/);
    if (m) return m[1];
    m = s.match(/[?&]id=([-\w]{25,})/);
    if (m) return m[1];
    m = s.match(/\/d\/([-\w]{25,})/);
    if (m) return m[1];
    m = s.match(/([-\w]{25,})/);
    return m ? m[1] : '';
  }

  /* ==========================================================================
   * القسم 3: الطبقة 1 — فحص الوجود
   * ========================================================================== */

  function _checkExistence(fileId) {
    if (!fileId) return { status: STATUS.NO_URL, ok: false };
    try {
      const file = DriveApp.getFileById(fileId);
      return { status: 'EXISTS', ok: true, file: file };
    } catch (e) {
      // رسالة الخطأ تحدد إن كان غير موجود أو لا صلاحية
      const msg = e.toString();
      if (msg.indexOf('not found') !== -1 || msg.indexOf('404') !== -1) {
        return { status: STATUS.MISSING, ok: false };
      }
      if (msg.indexOf('permission') !== -1 || msg.indexOf('403') !== -1) {
        return { status: STATUS.NO_PERMISSION, ok: false };
      }
      return { status: STATUS.MISSING, ok: false, error: msg };
    }
  }

  /* ==========================================================================
   * القسم 4: الطبقة 2 — فحص الصلاحية
   * ========================================================================== */

  function _checkPermission(file) {
    if (!file) return { ok: false };
    try {
      // محاولة القراءة — إذا نجحت، الصلاحية موجودة
      const blob = file.getBlob();
      if (blob.getBytes().length > 0) {
        return { ok: true };
      }
      return { ok: false };
    } catch (e) {
      return { ok: false, error: e.toString() };
    }
  }

  /* ==========================================================================
   * القسم 5: الطبقة 3 — فحص قابلية المعاينة
   * ========================================================================== */

  function _checkPreviewable(file) {
    if (!file) return { ok: false };
    try {
      const mime = file.getMimeType();

      // الأنواع المدعومة للمعاينة
      const previewable = [
        'application/pdf',
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/vnd.google-apps.document',
        'application/vnd.google-apps.spreadsheet',
        'application/vnd.google-apps.presentation'
      ];

      for (let i = 0; i < previewable.length; i++) {
        if (mime.indexOf(previewable[i]) === 0 || mime === previewable[i]) {
          return { ok: true, mime: mime };
        }
      }

      // صور عامة
      if (mime.indexOf('image/') === 0) return { ok: true, mime: mime };

      return { ok: false, mime: mime, reason: 'MIME غير مدعوم للمعاينة' };
    } catch (e) {
      return { ok: false, error: e.toString() };
    }
  }

  /* ==========================================================================
   * القسم 6: الطبقة 4 — إصلاح الصلاحيات تلقائياً
   * ========================================================================== */

  function _autoFixPermission(file) {
    if (!file) return false;
    try {
      // اجعل الملف متاحاً للقراءة لأي شخص لديه الرابط
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return true;
    } catch (e) {
      Logger.log('⚠️ تعذر إصلاح الصلاحية: ' + e.toString());
      return false;
    }
  }

  /* ==========================================================================
   * القسم 7: الفحص الشامل لشاهد واحد
   * ========================================================================== */

  /**
   * الفحص الرباعي للشاهد — يُرجع حالة موثقة.
   * @param {string} url — رابط الشاهد
   * @param {boolean} autoFix — إصلاح تلقائي للصلاحيات
   * @returns {Object} { status, fileId, mime, fixed, error }
   */
  function inspect(url, autoFix) {
    const fileId = _extractFileId(url);

    if (!fileId) {
      return { status: STATUS.INVALID_URL, ok: false };
    }

    // الطبقة 1: الوجود
    const existence = _checkExistence(fileId);
    if (!existence.ok) {
      return {
        status: existence.status,
        ok: false,
        fileId: fileId,
        error: existence.error || 'الملف غير موجود في Drive'
      };
    }

    const file = existence.file;

    // الطبقة 2: الصلاحية
    const permission = _checkPermission(file);
    let fixed = false;
    if (!permission.ok && autoFix) {
      fixed = _autoFixPermission(file);
      if (fixed) {
        // أعد الفحص
        const recheck = _checkPermission(file);
        if (!recheck.ok) {
          return { status: STATUS.NO_PERMISSION, ok: false, fileId: fileId, error: 'فشل الإصلاح التلقائي' };
        }
      } else {
        return { status: STATUS.NO_PERMISSION, ok: false, fileId: fileId };
      }
    }

    // الطبقة 3: قابلية المعاينة
    const previewable = _checkPreviewable(file);
    if (!previewable.ok) {
      return {
        status: STATUS.NOT_PREVIEWABLE,
        ok: false,
        fileId: fileId,
        mime: previewable.mime,
        error: previewable.reason || 'تعذر معاينة الملف'
      };
    }

    return {
      status: fixed ? STATUS.FIXED : STATUS.VALID,
      ok: true,
      fileId: fileId,
      mime: previewable.mime,
      fixed: fixed
    };
  }

  /* ==========================================================================
   * القسم 8: الواجهة العامة
   * ========================================================================== */

  return {
    inspect: inspect,
    STATUS: STATUS,
    _extractFileId: _extractFileId
  };

})();