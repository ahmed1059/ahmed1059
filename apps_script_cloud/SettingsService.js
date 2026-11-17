/*************************************************************************************
 * SettingsService.gs — خدمة الإعدادات الديناميكية
 * -----------------------------------------------------------------------------------
 * الإصدار: 1.2.0 — وفق بروتوكول 1059-Pro
 * -----------------------------------------------------------------------------------
 * - قراءة الإعدادات من ورقة "إعدادات_البوابة"
 * - كاش مدمج (10 دقائق)
 * - getFresh: قراءة مباشرة بدون كاش
 * - إصلاح: إزالة القوس الزائد قبل return
 *************************************************************************************/

const SettingsService = (function () {

  const SHEET_NAME = 'إعدادات_البوابة';
  const SHEET_GID  = 1344498954;
  const CACHE_KEY  = 'SETTINGS_GID_1059';
  const CACHE_TTL  = 600;

  const DEFAULTS = {
    // ═══ قائد المدرسة ═══
    manager_name:   'أ. نايف بن سمير الخلفي',
    manager_role:   'مدير المدرسة', 
    manager_sig_id: '1cKhNVqvhj6pbqZKCz8_TBveYN4nOw4Lo',

    // ═══ وكيل شؤون المعلمين ═══
    approver_teachers_name:   'أ. محمد بن فايز الجابري',
    approver_teachers_role:   'وكيل شؤون المعلمين',
    approver_teachers_sig_id: '1yVqA5F7HRDGV_2M9XhD4MT8YJEvnnEFy',

    // ═══ وكيل شؤون الطلاب ═══
    approver_students_name:   'أ. خالد بن علي الجابري',
    approver_students_role:   'وكيل شؤون الطلاب',
    approver_students_sig_id: '1MOr87Aeja_bIFo_sF0hhwTk4dyBxVIog',

    // ═══ البيانات الثابتة ═══
    school_name:    'متوسطة سعد بن الربيع الأنصاري',
    region_name:    'الإدارة العامة للتعليم بمنطقة المدينة المنورة',
    kingdom_name:   'المملكة العربية السعودية',
    ministry_name:  'وزارة التعليم',
    card_title:     'بطاقة توثيق شاهد تقويم واعتماد مدرسي',
    footer_text:    'وثيقة رسمية — متوسطة سعد بن الربيع الأنصاري',

    // ═══ المشرف المقيم ═══
    observer_enabled:  'true',
    observer_name:     'مشرف مقيم / مراقب',
    observer_password: '123123'
  };

  function _sheet(ss) {
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === SHEET_GID) return sheets[i];
    }
    return ss.getSheetByName(SHEET_NAME);
  }

  function _cell(key, value) {
    const text = String(value || '').trim();
    if (key.slice(-7) !== '_sig_id') return text;
    let match = text.match(/\/file\/d\/([-\w]{25,})/);
    if (match) return match[1];
    match = text.match(/[?&]id=([-\w]{25,})/);
    if (match) return match[1];
    match = text.match(/^([-\w]{25,})/);
    return match ? match[1] : text;
  }

  function _loadAll() {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }

    const settings = Object.assign({}, DEFAULTS);

    try {
      const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
      const sheet = _sheet(ss);
      if (sheet && sheet.getLastRow() >= 2) {
        const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
        data.forEach(function (row) {
          const key = String(row[0] || '').trim();
          const value = _cell(key, row[1]);
          if (key && value) settings[key] = value;
        });
      }
    } catch (e) {
      Logger.log('⚠️ SettingsService._loadAll: ' + e.toString());
    }

    try { cache.put(CACHE_KEY, JSON.stringify(settings), CACHE_TTL); } catch (e) {}
    return settings;
  }

  function get(key) {
    const all = _loadAll();
    return all[key] !== undefined ? all[key] : null;
  }

  function getAll() {
    return _loadAll();
  }

  function getFresh(key) {
    try {
      const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
      const sheet = _sheet(ss);
      if (sheet && sheet.getLastRow() >= 2) {
        const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
        for (let i = 0; i < data.length; i++) {
          if (String(data[i][0] || '').trim() === key) {
            return _cell(key, data[i][1]);
          }
        }
      }
    } catch (e) {
      Logger.log('⚠️ SettingsService.getFresh: ' + e.toString());
    }
    return DEFAULTS[key] !== undefined ? DEFAULTS[key] : null;
  }

  function invalidate() {
    try { CacheService.getScriptCache().remove(CACHE_KEY); } catch (e) {}
  }

  function ensureSheet() {
    const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (sheet) {
      Logger.log('✅ الورقة موجودة مسبقاً: ' + SHEET_NAME);
      return sheet;
    }

    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
    sheet.getRange(1, 1, 1, 2)
      .setFontWeight('bold')
      .setBackground('#177d82')
      .setFontColor('#ffffff');

    const rows = Object.keys(DEFAULTS).map(function (k) {
      return [k, DEFAULTS[k]];
    });
    sheet.getRange(2, 1, rows.length, 2).setValues(rows);
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(2, 400);
    sheet.setFrozenRows(1);

    Logger.log('✅ أُنشئت الورقة: ' + SHEET_NAME + ' (' + rows.length + ' إعداد)');
    return sheet;
  }

  return {
    get:          get,
    getAll:       getAll,
    getFresh:     getFresh,
    invalidate:   invalidate,
    ensureSheet:  ensureSheet
  };

})();


/* ============================================================================
 * دوال مساعدة عامة
 * ============================================================================ */

function SETUP_SettingsSheet() {
  Logger.log('🚀 إنشاء ورقة الإعدادات...\n');
  SettingsService.ensureSheet();
  SettingsService.invalidate();

  Logger.log('\n📋 اختبار القراءة:');
  const all = SettingsService.getAll();
  Object.keys(all).forEach(function (k) {
    Logger.log('   ' + k + ' = ' + all[k]);
  });
}

function REFRESH_SETTINGS() {
  SettingsService.invalidate();
  Logger.log('✅ تم إبطال كاش الإعدادات — التعديلات سارية فوراً.');
}

function TEST_Settings() {
  Logger.log('🔍 قراءة الإعدادات...\n');
  const all = SettingsService.getAll();
  Object.keys(all).forEach(function (k) {
    Logger.log('   ' + k + ' = ' + all[k]);
  });
}

function TEST_SettingsFresh() {
  Logger.log('🔍 القراءة المباشرة (بدون كاش)...\n');
  ['manager_name', 'approver_teachers_name', 'approver_students_name'].forEach(function (k) {
    Logger.log('   ' + k + ' = ' + SettingsService.getFresh(k));
  });
}