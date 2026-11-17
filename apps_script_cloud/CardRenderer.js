/**
 * ==============================================================================
 * CardRenderer.gs — خدمة عرض وطباعة بطاقة الشاهد
 * الإصدار: 2.0.0 — وفق بروتوكول 1059-Pro (Smart Card)
 * ==============================================================================
 */

function renderCardPage(rowIndex, previewMode) {
  try {
    Logger.log('📄 renderCardPage: صف=' + rowIndex + ' preview=' + previewMode);

    // ═══ 1. تحقق من الصف ═══
    const rowNum = parseInt(rowIndex, 10);
    if (!rowNum || rowNum < 2) {
      return HtmlService.createHtmlOutput(
        '<h1 style="font-family:Tajawal;padding:50px;text-align:center;">رقم صف غير صالح: ' + rowIndex + '</h1>'
      );
    }

    // ═══ 2. افتح الورقة ═══
    const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
    const sheetName = Core_Config.get('SHEET_RESPONSES_NAME');
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log('❌ الورقة غير موجودة: ' + sheetName);
      return HtmlService.createHtmlOutput(
        '<h1 style="font-family:Tajawal;padding:50px;text-align:center;">الورقة غير موجودة: ' + sheetName + '</h1>'
      );
    }

    // ═══ 3. تحقق من الأعمدة ═══
    const lastCol = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();

    Logger.log('📊 الورقة: ' + lastRow + ' صف × ' + lastCol + ' عمود');

    if (lastCol < 1) {
      return HtmlService.createHtmlOutput('<h1>الورقة فارغة</h1>');
    }

    if (rowNum > lastRow) {
      return HtmlService.createHtmlOutput(
        '<h1 style="font-family:Tajawal;padding:50px;text-align:center;">الصف ' + rowNum + ' غير موجود (آخر صف: ' + lastRow + ')</h1>'
      );
    }

    // ═══ 4. اقرأ البيانات ═══
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const row = sheet.getRange(rowNum, 1, 1, lastCol).getValues()[0];

    // ═══ 5. استخرج البيانات ═══
    if (typeof Feature_SubmissionService === 'undefined' ||
        typeof Feature_SubmissionService._extractRowData !== 'function') {
      Logger.log('❌ Feature_SubmissionService غير متوفر');
      return HtmlService.createHtmlOutput(
        '<h1 style="font-family:Tajawal;padding:50px;text-align:center;">خدمة المعالجة غير متوفرة</h1>'
      );
    }

    const data = Feature_SubmissionService._extractRowData(headers, row);

    if (!data.teacherName && !data.indicator) {
      return HtmlService.createHtmlOutput(
        '<h1 style="font-family:Tajawal;padding:50px;text-align:center;">لا توجد بيانات في الصف ' + rowNum + '</h1>'
      );
    }

    // ═══ 6. مطابقة المعلم ═══
    let teacher = null;
    try {
      teacher = Core_DataLayer.getTeacherByName(data.teacherName);
    } catch (e) {
      Logger.log('⚠️ مطابقة المعلم: ' + e.toString());
    }

    // ═══ 7. بناء البطاقة ═══
    if (typeof Feature_SmartCardBuilder === 'undefined') {
      Logger.log('❌ Feature_SmartCardBuilder غير متوفر');
      return HtmlService.createHtmlOutput(
        '<h1 style="font-family:Tajawal;padding:50px;text-align:center;">باني البطاقة غير متوفر</h1>'
      );
    }

    const html = Feature_SmartCardBuilder.build(data, teacher, previewMode === true);

    return HtmlService.createHtmlOutput(html)
      .setTitle('بطاقة شاهد — ' + (data.teacherName || ''))
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    Logger.log('❌ renderCardPage error: ' + err.toString());
    Logger.log('Stack: ' + err.stack);
    return HtmlService.createHtmlOutput(
      '<h1 style="font-family:Tajawal;color:#b91c1c;padding:50px;text-align:center;">خطأ: ' + err.toString() + '</h1>'
    );
  }
}