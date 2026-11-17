/*************************************************************************************
 * Feature_AdminService.gs — خدمات الحذف والحوكمة
 * -----------------------------------------------------------------------------------
 * الإصدار: 1.1.0
 * - نسخة احتياطية تلقائية قبل الحذف
 * - Soft Delete (نقل إلى _Archive)
 * - استعادة النسخ الاحتياطية
 *************************************************************************************/

const Feature_AdminService = (function() {

  const ARCHIVE_FOLDER_NAME = "_Archive";
  const BACKUP_PREFIX = "BACKUP_Responses_";

    /* ============================================================================
   * ✅ purgeTestEvidence v2.0 — نسخة مُحكّمة (1059-Pro)
   * ---------------------------------------------------------------------------
   * 1. نسخة احتياطية إلزامية قبل الحذف
   * 2. تحقق فعلي من عدد صفوف النسخة
   * 3. إبطال الكاش قبل الحذف
   * 4. اقتصاص النسخ الاحتياطية القديمة (الاحتفاظ بأحدث 2)
   * ============================================================================ */
  function purgeTestEvidence() {
    try {
      const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
      const sheet = ss.getSheetByName(Core_Config.get('SHEET_RESPONSES_NAME'));
      if (!sheet) return 'SHEET_NOT_FOUND';

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        Logger.log('ℹ️ لا توجد بيانات لتفريغها.');
        return 'EMPTY';
      }

      // ═══ 1. نسخة احتياطية إلزامية + التحقق الفعلي ═══
      const backupName = BACKUP_PREFIX +
        Utilities.formatDate(new Date(), 'Asia/Riyadh', 'yyyy-MM-dd_HH-mm-ss');

      let backupSheet;
      try {
        backupSheet = sheet.copyTo(ss);
        backupSheet.setName(backupName);
        SpreadsheetApp.flush(); // إجبار الكتابة قبل التحقق

        const backupRows = backupSheet.getLastRow() - 1;
        const expectedRows = lastRow - 1;
        if (backupRows !== expectedRows) {
          throw new Error(
            'النسخة الاحتياطية غير مطابقة: متوقع ' + expectedRows +
            '، فعلي ' + backupRows
          );
        }
      } catch (e) {
        Logger.log('❌ فشل النسخة الاحتياطية — إلغاء التفريغ: ' + e.toString());
        return 'BACKUP_FAILED: ' + e.toString();
      }

      Logger.log('📦 نسخة احتياطية مُتحقق منها: ' + backupName +
        ' (' + (lastRow - 1) + ' صف)');

      // ═══ 2. إبطال الكاش قبل الحذف ═══
      try { Core_Context.invalidate('records'); } catch (e) {}

      // ═══ 3. الحذف ═══
      sheet.deleteRows(2, lastRow - 1);
      Logger.log('✅ تم تفريغ السجل (' + (lastRow - 1) + ' صف).');

      // ═══ 4. التحقق النهائي من سلامة النسخة الاحتياطية ═══
      if (backupSheet.getLastRow() < 2) {
        Logger.log('🚨 تحذير حرج: النسخة الاحتياطية فارغة بعد الحذف!');
        return 'BACKUP_CORRUPTED';
      }

      // ═══ 5. اقتصاص النسخ الاحتياطية القديمة ═══
      try {
        _cleanupOldBackups(ss, 2); // الاحتفاظ بأحدث نسختين فقط
      } catch (e) {
        Logger.log('⚠️ فشل اقتصاص النسخ (غير حرج): ' + e.toString());
      }

      // ═══ 6. تسجيل ═══
      logAdminAction({
        action: 'PURGE_RESPONSES',
        details: 'حُذف ' + (lastRow - 1) + ' صف. النسخة: ' + backupName
      });

      return 'SUCCESS';
    } catch (err) {
      Logger.log('❌ خطأ في التفريغ: ' + err.toString());
      return 'ERROR: ' + err.toString();
    }
  }

  /* ============================================================================
   * _cleanupOldBackups — اقتصاص النسخ الاحتياطية القديمة
   * ---------------------------------------------------------------------------
   * @param {Spreadsheet} ss - الـSpreadsheet
   * @param {number} keepCount - عدد النسخ المطلوب الاحتفاظ بها (الأحدث أولاً)
   * ============================================================================ */
  function _cleanupOldBackups(ss, keepCount) {
    const allSheets = ss.getSheets();
    const backups = [];

    allSheets.forEach(function (s) {
      const name = s.getName();
      if (name.indexOf(BACKUP_PREFIX) === 0) {
        backups.push({
          sheet: s,
          name: name,
          timestamp: name.replace(BACKUP_PREFIX, '')
        });
      }
    });

    // ترتيب تنازلي حسب الطابع الزمني (الأحدث أولاً)
    backups.sort(function (a, b) {
      return b.timestamp.localeCompare(a.timestamp);
    });

    // حذف ما بعد الحد المسموح
    const toDelete = backups.slice(keepCount);
    toDelete.forEach(function (b) {
      try {
        ss.deleteSheet(b.sheet);
        Logger.log('🗑️ حُذفت نسخة قديمة: ' + b.name);
      } catch (e) {
        Logger.log('⚠️ تعذر حذف: ' + b.name + ' — ' + e.toString());
      }
    });

    const kept = Math.min(backups.length, keepCount);
    Logger.log('📦 النسخ الاحتياطية: ' + backups.length + ' → الاحتفاظ بـ ' + kept);
  }

  function actorCanManageRow(actorNationalId, rowIndex) {
    const actor = Core_DataLayer.getTeacherByNationalId(String(actorNationalId || "").trim());
    if (!actor) return false;
    const role = String(actor.role || "");
    const id = String(actor.nationalId || "");
    if (id === "1008379958" || role.indexOf("مدير") !== -1 || role.indexOf("وكيل") !== -1) return true;
    const idx = parseInt(rowIndex, 10);
    if (!idx || idx < 2) return false;
    const ss = SpreadsheetApp.openById(Core_Config.get("SPREADSHEET_ID"));
    const sheet = ss.getSheetByName(Core_Config.get("SHEET_RESPONSES_NAME"));
    if (!sheet) return false;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const tIdx = Feature_SubmissionService._findColIdx(headers, [
      "اسم المعلم أو الموظف",
      "اسم المعلم / الموظف",
      "اسم المعلم"
    ]);
    if (tIdx < 0) return false;
    const rowName = Util_NameNormalizer.getDisplay(String(sheet.getRange(idx, tIdx + 1).getValue() || ""));
    const mine = Util_NameNormalizer.getDisplay(String(actor.name || "")).split("-")[0].trim();
    return !!(rowName && mine && rowName.indexOf(mine) !== -1);
  }

  function deleteEvidenceRecord(rowIndex, pdfUrl, actorNationalId) {
    try {
      if (!actorCanManageRow(actorNationalId, rowIndex)) return "FORBIDDEN";
      const ss = SpreadsheetApp.openById(Core_Config.get("SPREADSHEET_ID"));
      const sheet = ss.getSheetByName(Core_Config.get("SHEET_RESPONSES_NAME"));
      if (!sheet) return "SHEET_NOT_FOUND";

      if (pdfUrl) {
        try {
          const fileId = extractFileId(pdfUrl);
          if (fileId) {
            const file = DriveApp.getFileById(fileId);
            const archive = getOrCreateArchiveFolder();
            file.moveTo(archive);
            Logger.log("📦 نُقل الملف إلى _Archive: " + fileId);
          }
        } catch (e) {
          Logger.log("⚠️ تعذر نقل الملف: " + e.toString());
        }
      }

      if (rowIndex && rowIndex > 1) sheet.deleteRow(rowIndex);

      logAdminAction({
        action: "DELETE_RECORD",
        details: "الصف: " + rowIndex + " | الملف: " + (pdfUrl || "—")
      });

    try { Core_Context.invalidate('records'); } catch (e) {}
      return "SUCCESS";
    } catch (err) {
      Logger.log("❌ خطأ في الحذف: " + err.toString());
      return "ERROR: " + err.toString();
    }
  }

  function extractFileId(url) {
    if (!url) return null;
    const match = url.match(/[-\w]{25,}/);
    return match ? match[0] : null;
  }

  function getOrCreateArchiveFolder() {
    const rootId = Core_Config.get("MASTER_ROOT_FOLDER_ID");
    const root = DriveApp.getFolderById(rootId);
    const iter = root.getFoldersByName(ARCHIVE_FOLDER_NAME);
    if (iter.hasNext()) return iter.next();
    return root.createFolder(ARCHIVE_FOLDER_NAME);
  }

  function logAdminAction(details) {
    try {
      const ss = SpreadsheetApp.openById(Core_Config.get("SPREADSHEET_ID"));
      let logSheet = ss.getSheetByName(Core_Config.get("SHEET_AUDIT_LOG"));
      if (!logSheet) {
        logSheet = ss.insertSheet(Core_Config.get("SHEET_AUDIT_LOG"));
        logSheet.appendRow(["timestamp", "action", "files_count", "records_count", "added", "updated", "transferred", "duration_sec", "details"]);
      }

      const headers = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
      const hasDetails = headers.indexOf("details") !== -1;

      if (hasDetails) {
        logSheet.appendRow([new Date(), details.action || "", "", "", "", "", "", "", details.details || ""]);
      } else {
        logSheet.appendRow([new Date(), details.action || "", "", "", "", "", "", ""]);
      }
    } catch (e) {
      Logger.log("⚠️ تعذر التسجيل: " + e.toString());
    }
  }

  function restoreBackup(backupName) {
    try {
      const ss = SpreadsheetApp.openById(Core_Config.get("SPREADSHEET_ID"));
      const backupSheet = ss.getSheetByName(backupName);
      if (!backupSheet) return "BACKUP_NOT_FOUND";

      const targetSheet = ss.getSheetByName(Core_Config.get("SHEET_RESPONSES_NAME"));
      if (!targetSheet) return "TARGET_NOT_FOUND";

      const lastRow = targetSheet.getLastRow();
      if (lastRow > 1) targetSheet.deleteRows(2, lastRow - 1);

      const backupData = backupSheet.getDataRange().getValues();
      if (backupData.length > 1) {
        targetSheet.getRange(2, 1, backupData.length - 1, backupData[0].length)
          .setValues(backupData.slice(1));
      }

      Logger.log("✅ تمت الاستعادة من: " + backupName);
      return "SUCCESS";
    } catch (err) {
      Logger.log("❌ خطأ في الاستعادة: " + err.toString());
      return "ERROR: " + err.toString();
    }
  }
  function RESTORE_LATEST() {
  const backups = Feature_AdminService.listBackups();
  if (backups.length === 0) {
    Logger.log('❌ لا توجد نسخ احتياطية');
    return;
  }
  const latest = backups[0].name;
  Logger.log('📦 استعادة من: ' + latest);
  return Feature_AdminService.restoreBackup(latest);
}

  function listBackups() {
    const ss = SpreadsheetApp.openById(Core_Config.get("SPREADSHEET_ID"));
    const sheets = ss.getSheets();
    const backups = [];

    sheets.forEach(s => {
      if (s.getName().indexOf(BACKUP_PREFIX) === 0) {
        backups.push({ name: s.getName(), rows: s.getLastRow() - 1 });
      }
    });

    Logger.log("📦 النسخ الاحتياطية المتاحة: " + backups.length);
    backups.forEach(b => Logger.log("   - " + b.name + " (" + b.rows + " صف)"));
    return backups;
  }

  /**
   * إخراج منسوب من التشكيل النشط دون المساس بالشواهد.
   * يكتب الحالة وتاريخ اليوم والملاحظة فقط.
   */
  function setRosterStatus(actorNationalId, targetNationalId, nextStatus, note) {
    const allowed = { 'منقول': true, 'متقاعد': true };
    nextStatus = String(nextStatus || '').trim();
    if (!allowed[nextStatus]) return { success: false, message: 'الحالة المسموحة: منقول أو متقاعد.' };

    actorNationalId = String(actorNationalId || '').replace(/\D/g, '');
    targetNationalId = String(targetNationalId || '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(actorNationalId) || !/^\d{10}$/.test(targetNationalId)) {
      return { success: false, message: 'السجل المدني غير مكتمل.' };
    }
    if (actorNationalId === targetNationalId) {
      return { success: false, message: 'لا يمكن إخراج حسابك أنت.' };
    }

    const staff = Core_DataLayer.getStaffList();
    let actor = null;
    let target = null;
    for (let i = 0; i < staff.length; i++) {
      if (staff[i].nationalId === actorNationalId) actor = staff[i];
      if (staff[i].nationalId === targetNationalId) target = staff[i];
    }
    if (!actor) return { success: false, message: 'الحساب غير مخوّل.' };
    const actorRole = String(actor.role || '');
    const actorAllowed = Core_Config.isAdmin(actorNationalId, actor.role)
      || actorRole.indexOf('مدير') !== -1
      || actorRole.indexOf('وكيل') !== -1;
    if (!actorAllowed) return { success: false, message: 'هذا الإجراء للقيادة فقط.' };
    if (!target) return { success: false, message: 'المنسوب غير موجود ضمن النشطين.' };

    const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
    const sheet = ss.getSheetByName(Core_Config.get('SHEET_STAFF_ALL'));
    if (!sheet) return { success: false, message: 'ورقة المنسوبين غير موجودة.' };

    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) return { success: false, message: 'ورقة المنسوبين فارغة.' };
    const headers = data[0].map(function (h) { return String(h).trim(); });
    const idCol = headers.indexOf('national_id');
    const statusCol = headers.indexOf('status');
    const updatedCol = headers.indexOf('last_updated');
    if (idCol < 0 || statusCol < 0) return { success: false, message: 'أعمدة الورقة غير مكتملة.' };

    let noteCol = headers.indexOf('status_note');
    if (noteCol < 0) {
      noteCol = Math.max(headers.length, sheet.getLastColumn());
      sheet.getRange(1, noteCol + 1).setValue('status_note');
    }

    const cleanNote = String(note || '').replace(/[\r\n]/g, ' ').trim().substring(0, 200);
    const today = Utilities.formatDate(new Date(), 'Asia/Riyadh', 'yyyy-MM-dd');
    let found = false;
    for (let r = 1; r < data.length; r++) {
      const rowId = String(data[r][idCol] || '').replace(/\D/g, '');
      if (rowId !== targetNationalId) continue;
      sheet.getRange(r + 1, statusCol + 1).setValue(nextStatus);
      if (updatedCol >= 0) sheet.getRange(r + 1, updatedCol + 1).setValue(today);
      sheet.getRange(r + 1, noteCol + 1).setValue(cleanNote);
      found = true;
      break;
    }
    if (!found) return { success: false, message: 'تعذر العثور على صف المنسوب.' };

    try { Core_Context.invalidate('staff'); } catch (e) {}
    logAdminAction({
      action: 'ROSTER_STATUS',
      details: targetNationalId + ' | ' + target.name + ' | ' + nextStatus
        + ' | ' + today + ' | ' + (cleanNote || '—') + ' | by ' + actorNationalId
    });
    return { success: true, name: target.name, status: nextStatus, date: today, note: cleanNote };
  }

  return {
    purgeTestEvidence: purgeTestEvidence,
    deleteEvidenceRecord: deleteEvidenceRecord,
    actorCanManageRow: actorCanManageRow,
    restoreBackup: restoreBackup,
    listBackups: listBackups,
    logAdminAction: logAdminAction,
    setRosterStatus: setRosterStatus,
    _cleanupOldBackups: _cleanupOldBackups     // ✅ مُصدَّر الآن
  };

})();

// ==================== Wrappers عامة ====================

function purgeTestEvidence() {
  return Feature_AdminService.purgeTestEvidence();
}

function deleteEvidenceRecord(rowIndex, pdfUrl, actorNationalId) {
  return Feature_AdminService.deleteEvidenceRecord(rowIndex, pdfUrl, actorNationalId);
}

function setStaffRosterStatusForClient(actorNationalId, targetNationalId, nextStatus, note) {
  try {
    return Feature_AdminService.setRosterStatus(actorNationalId, targetNationalId, nextStatus, note);
  } catch (e) {
    return { success: false, message: String(e && e.message ? e.message : e) };
  }
}

function TEST_ListBackups() {
  return Feature_AdminService.listBackups();
}

function logDeleteRefreshFailed(errorMessage) {
  try {
    Feature_AdminService.logAdminAction({
      action: 'DELETE_REFRESH_FAILED',
      details: 'فشل تحديث الجدول بعد الحذف: ' + String(errorMessage || '—')
    });
  } catch (e) {
    Logger.log('⚠️ logDeleteRefreshFailed: ' + e.toString());
  }
}