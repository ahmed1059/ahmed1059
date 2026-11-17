/**
 * ==============================================================================
 * Feature_AuditAllEvidence.gs — المراقب الدوري للشواهد (Shahid-Dhaman)
 * ---------------------------------------------------------------------------
 * الإصدار: 2.0.0 — وفق بروتوكول 1059-Pro
 * ---------------------------------------------------------------------------
 * التحسينات:
 *   - يفحص كل الأعمدة المطابقة للشواهد (وليس الأول فقط)
 *   - يتجاوز الأعمدة الفارغة ويستمر للأعمدة المُعبَّأة
 *   - يدعم الهيكل الفعلي للورقة (97 عموداً)
 * ==============================================================================
 */

function AUDIT_AllEvidence(options) {
  options = options || {};
  const autoFix = options.autoFix === true;
  const writeBack = options.writeBack === true;

  Logger.log('═══════════════════════════════════════════════════');
  Logger.log('  Shahid-Dhaman Audit v2.0');
  Logger.log('  صلاحيات إصلاح تلقائي: ' + (autoFix ? 'نعم' : 'لا'));
  Logger.log('═══════════════════════════════════════════════════\n');

  const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
  const sheet = ss.getSheetByName(Core_Config.get('SHEET_RESPONSES_NAME'));
  if (!sheet) {
    Logger.log('❌ الورقة غير موجودة');
    return { success: false };
  }

  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  Logger.log('📊 الورقة: ' + lastRow + ' صف × ' + lastCol + ' عمود\n');

  // ═══ ابحث عن كل الأعمدة المطابقة (بدلاً من الأول فقط) ═══
  const ev1Columns = _findAllCols(headers, ['صورة الشاهد الأولى', 'الشاهد الأول', 'الشاهد 1']);
  const ev2Columns = _findAllCols(headers, ['صورة الشاهد الثانية', 'الشاهد الثاني', 'الشاهد 2']);

  Logger.log('📋 أعمدة الشاهد الأول: ' + JSON.stringify(ev1Columns));
  Logger.log('📋 أعمدة الشاهد الثاني: ' + JSON.stringify(ev2Columns));

  if (ev1Columns.length === 0 && ev2Columns.length === 0) {
    Logger.log('❌ لا توجد أعمدة شواهد مطابقة');
    return { success: false };
  }

  // ═══ ابحث عن أو أنشئ عمود الحالة ═══
  let statusIdx = _findCol(headers, ['evidence_status']);
  if (statusIdx === -1 && writeBack) {
    statusIdx = lastCol;
    sheet.getRange(1, statusIdx + 1).setValue('evidence_status');
    Logger.log('✅ أُنشئ عمود evidence_status في العمود ' + (statusIdx + 1));
  }

  const report = {
    total: 0, valid: 0, missing: 0, no_permission: 0,
    invalid_url: 0, not_previewable: 0, fixed: 0, no_url: 0,
    rows: []
  };

  for (let i = 2; i <= lastRow; i++) {
    try {
      const row = sheet.getRange(i, 1, 1, lastCol).getValues()[0];

      // ═══ ابحث عن أول قيمة فعلية في أعمدة الشواهد ═══
      const ev1 = _getFirstFilledValue(row, ev1Columns);
      const ev2 = _getFirstFilledValue(row, ev2Columns);

      const urlToCheck = ev1 || ev2;
      if (!urlToCheck) continue;

      const result = Feature_EvidenceGuard.inspect(urlToCheck, autoFix);

      report.total++;
      const statusKey = result.status.toLowerCase().replace(/_/g, '_');
      if (report[statusKey] !== undefined) report[statusKey]++;
      else report[statusKey] = 1;

      report.rows.push({
        row: i,
        url: urlToCheck,
        status: result.status,
        fixed: result.fixed || false
      });

      // كتابة الحالة
      if (writeBack && statusIdx >= 0) {
        sheet.getRange(i, statusIdx + 1).setValue(result.status);
      }

      const icon = result.ok ? (result.fixed ? '🔧' : '✅') : '❌';
      Logger.log(icon + ' صف ' + i + ': ' + result.status);

    } catch (e) {
      Logger.log('⚠️ خطأ في الصف ' + i + ': ' + e.toString());
    }
  }

  Logger.log('\n═══════════════════════════════════════════════════');
  Logger.log('  الملخص');
  Logger.log('═══════════════════════════════════════════════════');
  Logger.log('📊 إجمالي الشواهد المفحوصة: ' + report.total);
  Logger.log('   ✅ سليمة: ' + report.valid);
  Logger.log('   🔧 مُصلَّحة: ' + report.fixed);
  Logger.log('   ⚠️ مفقودة: ' + report.missing);
  Logger.log('   🔒 بدون صلاحية: ' + report.no_permission);
  Logger.log('   🔗 رابط خاطئ: ' + report.invalid_url);
  Logger.log('   👁️ غير قابلة للمعاينة: ' + report.not_previewable);
  Logger.log('   ␀ بلا رابط: ' + report.no_url);

  return report;
}

/* ============================================================================
 * دوال مساعدة
 * ============================================================================ */

/**
 * ابحث عن كل الأعمدة المطابقة لكلمة مفتاحية.
 */
function _findAllCols(headers, keywords) {
  const matches = [];
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').trim();
    for (let k = 0; k < keywords.length; k++) {
      if (h.indexOf(keywords[k]) !== -1) {
        if (matches.indexOf(i) === -1) matches.push(i);
        break;
      }
    }
  }
  return matches;
}

/**
 * ابحث عن أول عمود مطابق (للاستخدام العام).
 */
function _findCol(headers, keywords) {
  const matches = _findAllCols(headers, keywords);
  return matches.length > 0 ? matches[0] : -1;
}

/**
 * ابحث عن أول قيمة فعلية في قائمة أعمدة.
 */
function _getFirstFilledValue(row, columns) {
  for (let i = 0; i < columns.length; i++) {
    const val = String(row[columns[i]] || '').trim();
    if (val && val !== 'undefined' && val !== 'null' && val.indexOf('http') === 0) {
      return val;
    }
  }
  return '';
}

/**
 * اختبار سريع — عرض كل الأعمدة المطابقة.
 */
function DEBUG_AuditColumns() {
  Logger.log('🔍 تشخيص أعمدة Audit...\n');

  const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
  const sheet = ss.getSheetByName(Core_Config.get('SHEET_RESPONSES_NAME'));
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  const ev1 = _findAllCols(headers, ['صورة الشاهد الأولى', 'الشاهد الأول', 'الشاهد 1']);
  const ev2 = _findAllCols(headers, ['صورة الشاهد الثانية', 'الشاهد الثاني', 'الشاهد 2']);

  Logger.log('📋 أعمدة الشاهد الأول: ' + JSON.stringify(ev1));
  ev1.forEach(function (i) { Logger.log('   [' + i + '] "' + headers[i] + '"'); });

  Logger.log('\n📋 أعمدة الشاهد الثاني: ' + JSON.stringify(ev2));
  ev2.forEach(function (i) { Logger.log('   [' + i + '] "' + headers[i] + '"'); });

  // افحص الصف 2 في كل هذه الأعمدة
  if (sheet.getLastRow() >= 2) {
    const row2 = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
    Logger.log('\n📋 محتوى الصف 2:');
    ev1.concat(ev2).forEach(function (i) {
      const val = String(row2[i] || '').trim();
      const status = val ? '✅ ' + val.substring(0, 60) : '␀ فارغ';
      Logger.log('   [' + i + '] "' + headers[i] + '" → ' + status);
    });
  } else {
    Logger.log('\n⚠️ الورقة لا تحتوي صفوف بيانات');
  }
}