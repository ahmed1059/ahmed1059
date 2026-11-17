/**
 * ==============================================================================
 * onFormSubmit.gs — معالج إرسال الفورم
 * ---------------------------------------------------------------------------
 * يتحقق من هوية المُدخِل أولاً
 * ==============================================================================
 */

function onFormSubmit(e) {
  Logger.log('📝 استلم شاهد جديد');

  // ═══ 1. التحقق من الهوية ═══
  const entryResult = Feature_EntryGuard.handleSubmission(e);

  if (!entryResult.valid) {
    Logger.log('🚫 رُفض الإدخال — السبب: ' + entryResult.reason);
    Logger.log('   لا يتم توليد بطاقة');
    return {
      success: false,
      reason: 'ENTRY_REJECTED',
      details: entryResult
    };
  }

  Logger.log('✅ المُدخِل موثوق: ' + entryResult.person.name);

  // ═══ 2. Snapshot ═══
  try {
    Feature_InstantGuardian.takeSnapshot('form_submit');
  } catch (e) {
    Logger.log('⚠️ Snapshot: ' + e.toString());
  }

  // ═══ 3. مشاركة الشواهد تلقائياً ═══
  try {
    const response = e.response;
    const itemResponses = response.getItemResponses();

    itemResponses.forEach(function (itemResponse) {
      const title = String(itemResponse.getItem().getTitle() || '');
      if (title.indexOf('الشاهد') === -1 && title.indexOf('صورة') === -1) return;

      const resp = itemResponse.getResponse();
      const urls = Array.isArray(resp) ? resp : [resp];

      urls.forEach(function (url) {
        if (!url || String(url).indexOf('http') !== 0) return;
        try {
          const id = _extractFileId(String(url));
          if (!id) return;
          const file = DriveApp.getFileById(id);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          Logger.log('🔧 شُورك الشاهد: ' + title);
        } catch (e2) {
          Logger.log('⚠️ ' + e2.toString());
        }
      });
    });
  } catch (err) {
    Logger.log('⚠️ المشاركة: ' + err.toString());
  }

  return {
    success: true,
    person: entryResult.person
  };
}

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