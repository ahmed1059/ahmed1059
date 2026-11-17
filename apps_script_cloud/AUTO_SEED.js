/**
 * ==============================================================================
 * _AUTO_SEED.gs — مولّد البذرة التلقائي
 * ------------------------------------------------------------------------------
 * الإصدار: 1.0.0 — وفق بروتوكول 1059-Pro
 * ------------------------------------------------------------------------------
 * الغرض:
 *   - توليد _SEED.json محدَّث
 *   - حفظه في 3 أماكن (Triple-Lock)
 *   - تسهيل الاستئناف
 * ==============================================================================
 */

const _AUTO_SEED = (function() {

  const SEED_VERSION = '1.0.0';
  const SEED_PROP_KEY = 'CURRENT_SEED';
  const SEED_DRIVE_NAME = '_SEED_Backup.json';

  /**
   * توليد البذرة الكاملة
   */
  function generate() {
    try {
      const seed = {
        version: SEED_VERSION,
        timestamp: new Date().toISOString(),
        timestamp_ar: Utilities.formatDate(new Date(), 'Asia/Riyadh', 'yyyy-MM-dd HH:mm:ss'),
        scriptId: '1FaHwHbtG6aDcDyRnCiXMGgv4Uvvmr_3vpPvXXBwycx_DFrJDa7FgWpaJ',
        spreadsheetId: Core_Config.get('SPREADSHEET_ID'),
        webAppUrl: Core_Config.get('OFFICIAL_WEB_APP_URL'),
        masterFolderId: Core_Config.get('MASTER_ROOT_FOLDER_ID'),
        
        files: _scanFiles(),
        constraints: _loadConstraints(),
        problems: _scanProblems(),
        checkpoints: _listCheckpoints(),
        nextTask: _getNextTask(),
        stats: _getStats()
      };
      
      // Triple-Lock
      _saveToProperties(seed);
      _saveToDrive(seed);
      _saveToSheets(seed);
      
      Logger.log('✅ تم إنشاء البذرة بنجاح');
      Logger.log('📊 عدد الملفات: ' + Object.keys(seed.files).length);
      Logger.log('📅 آخر تحديث: ' + seed.timestamp_ar);
      
      return seed;
      
    } catch (e) {
      Logger.log('❌ خطأ في توليد البذرة: ' + e.toString());
      return null;
    }
  }

  /**
   * فحص الملفات الأساسية
   */
  function _scanFiles() {
    return {
      // CORE
      'appsscript.json': 'v2.0',
      'Core_Config.gs': 'v2.3.0',
      'Core_Context.gs': 'v1.0.0',
      'Core_DataLayer.gs': 'v2.1.0',
      'Core_ETECGuide.gs': 'v2.0.0',
      'Core_Migration.gs': 'v1.5.0',
      'Core_MigrationFolders.gs': 'v1.0.0',
      
      // UTIL
      'Util_NameNormalizer.gs': 'v1.1.0',
      
      // FEATURE
      'Feature_SubmissionService.gs': 'v3.1.0',
      'Feature_ReportService.gs': 'v1.4.0',
      'Feature_ImportService.gs': 'v1.1.0',
      'Feature_AdminService.gs': 'v1.1.0',
      'Feature_ImageCacheService.gs': 'v1.1.0',
      'Feature_EntryGuard.gs': 'v1.0.0',
      'Feature_SmartCardBuilder.gs': 'v1.5.0',
      'Feature_PrintEngine.gs': 'v1.0.0',
      
      // UI
      'UI_Controller.gs': 'v1.8.0',
      'CardRenderer.gs': 'v2.1.0',
      'SettingsService.gs': 'v1.2.0',
      'CardTemplate.gs': 'v1.2.0',
      
      // EVENT
      'onFormSubmit.gs': 'v1.0.0'
    };
  }

  /**
   * القيود الثابتة
   */
  function _loadConstraints() {
    return {
      'A4_Width': '200mm',
      'A4_Height': '277mm',
      'Header_Height': '20mm',
      'Footer_Height': '10mm',
      'Signature_Height': '25mm',
      'Evidence_Min_Height': '90mm',
      'Evidence_Type': 'Base64_Direct',
      'PDF_Buttons': 'hidden',
      'Print_Pages': '1_page_always'
    };
  }

  /**
   * المشاكل المعلقة
   */
  function _scanProblems() {
    return [
      {
        id: 1,
        severity: 'HIGH',
        title: 'الطباعة 2 صفحات عند Drive PDF',
        status: 'open'
      },
      {
        id: 2,
        severity: 'HIGH',
        title: 'الشواهد تتأخر في الظهور',
        status: 'open'
      },
      {
        id: 3,
        severity: 'MEDIUM',
        title: 'التذييل ليس في الأسفل دائماً',
        status: 'open'
      }
    ];
  }

  /**
   * قائمة Checkpoints
   */
  function _listCheckpoints() {
    return [
      { id: 'CP#0', date: '2026-10-01', status: 'completed' },
      { id: 'CP#1', date: '2026-10-02', status: 'completed' },
      { id: 'CP#2', date: '2026-10-03', status: 'completed' },
      { id: 'CP#3', date: '2026-10-04', status: 'completed' },
      { id: 'CP#4', date: '2026-10-05', status: 'completed' },
      { id: 'CP#4.1', date: '2026-10-05', status: 'completed' },
      { id: 'CP#5', date: '2026-10-09', status: 'pending' }
    ];
  }

  /**
   * المهمة التالية
   */
  function _getNextTask() {
    return {
      id: 'v2.0_rebuild',
      title: 'إعادة بناء Feature_SmartCardBuilder.gs',
      reason: 'حل مشكلة الطباعة + الشواهد',
      parts: 5,
      currentPart: 0,
      status: 'pending'
    };
  }

  /**
   * إحصائيات
   */
  function _getStats() {
    try {
      const staff = Core_Context.getStaffList();
      const records = Core_Context.getRecords();
      return {
        staffCount: staff.length,
        recordsCount: records.length,
        schools: 1,
        activeUsers: 23
      };
    } catch (e) {
      return { error: e.toString() };
    }
  }

  /**
   * حفظ في Script Properties
   */
  function _saveToProperties(seed) {
    try {
      const json = JSON.stringify(seed);
      PropertiesService.getScriptProperties().setProperty(SEED_PROP_KEY, json);
      Logger.log('💾 حفظ في Script Properties (' + json.length + ' حرف)');
    } catch (e) {
      Logger.log('⚠️ فشل Properties: ' + e.toString());
    }
  }

  /**
   * حفظ في Drive
   */
  function _saveToDrive(seed) {
    try {
      const folder = DriveApp.getFolderById(Core_Config.get('MASTER_ROOT_FOLDER_ID'));
      const iter = folder.getFilesByName(SEED_DRIVE_NAME);
      
      // حذف القديم
      while (iter.hasNext()) {
        iter.next().setTrashed(true);
      }
      
      // إنشاء جديد
      const blob = Utilities.newBlob(
        JSON.stringify(seed, null, 2),
        'application/json',
        SEED_DRIVE_NAME
      );
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      Logger.log('💾 حفظ في Drive: ' + file.getUrl());
    } catch (e) {
      Logger.log('⚠️ فشل Drive: ' + e.toString());
    }
  }

  /**
   * حفظ في Sheets
   */
  function _saveToSheets(seed) {
    try {
      const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
      let logSheet = ss.getSheetByName('_SEED_Log');
      
      if (!logSheet) {
        logSheet = ss.insertSheet('_SEED_Log');
        logSheet.appendRow(['timestamp', 'version', 'seed_json']);
        logSheet.setFrozenRows(1);
      }
      
      logSheet.appendRow([
        new Date(),
        seed.version,
        JSON.stringify(seed)
      ]);
      
      Logger.log('💾 حفظ في Sheets');
    } catch (e) {
      Logger.log('⚠️ فشل Sheets: ' + e.toString());
    }
  }

  /**
   * استرجاع البذرة
   */
  function retrieve() {
    try {
      // 1. من Properties
      const propJson = PropertiesService.getScriptProperties().getProperty(SEED_PROP_KEY);
      if (propJson) {
        Logger.log('✅ وُجدت في Properties');
        return JSON.parse(propJson);
      }
      
      // 2. من Drive
      const folder = DriveApp.getFolderById(Core_Config.get('MASTER_ROOT_FOLDER_ID'));
      const iter = folder.getFilesByName(SEED_DRIVE_NAME);
      if (iter.hasNext()) {
        const file = iter.next();
        const json = file.getBlob().getDataAsString('UTF-8');
        Logger.log('✅ وُجدت في Drive');
        return JSON.parse(json);
      }
      
      // 3. من Sheets
      const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
      const logSheet = ss.getSheetByName('_SEED_Log');
      if (logSheet && logSheet.getLastRow() > 1) {
        const lastRow = logSheet.getLastRow();
        const json = logSheet.getRange(lastRow, 3).getValue();
        Logger.log('✅ وُجدت في Sheets');
        return JSON.parse(json);
      }
      
      Logger.log('❌ لم تُوجد البذرة');
      return null;
    } catch (e) {
      Logger.log('❌ خطأ: ' + e.toString());
      return null;
    }
  }

  return {
    generate: generate,
    retrieve: retrieve
  };

})();


function GENERATE_SEED() {
  return _AUTO_SEED.generate();
}

function RETRIEVE_SEED() {
  return _AUTO_SEED.retrieve();
}