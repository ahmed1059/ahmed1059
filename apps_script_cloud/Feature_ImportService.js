/*************************************************************************************
 * Feature_ImportService.gs — خدمة استيراد بيانات المنسوبين من نور
 * -----------------------------------------------------------------------------------
 * الإصدار: 1.1.0
 * - إنشاء مجلدات مسبقة لكل معلم
 * - ربط المجلدات تلقائياً بـ Folder ID
 *************************************************************************************/

const Feature_ImportService = (function() {

  const STAFF_HEADERS = [
    "national_id", "name_raw", "name_canonical", "role", "status",
    "mobile", "email", "specialty", "qualification",
    "job_number", "school", "last_updated", "is_admin", "folder_id"
  ];

  function importFromNurFolder() {
    const startTime = new Date();
    Logger.log("🚀 بدء استيراد بيانات المنسوبين...");

    try {
      const rootFolder = DriveApp.getFolderById(Core_Config.get("MASTER_ROOT_FOLDER_ID"));
      const importFolder = getOrCreateFolder(rootFolder, Core_Config.get("NUR_IMPORTS_FOLDER"));
      const processedFolder = getOrCreateFolder(importFolder, Core_Config.get("NUR_PROCESSED_FOLDER"));

      const files = importFolder.getFiles();
      const xlsxFiles = [];
      while (files.hasNext()) {
        const file = files.next();
        if (file.getName().match(/\.xlsx?$/i)) {
          xlsxFiles.push(file);
        }
     try { Core_Context.invalidateAll(); } catch (e) {}
      }


// ✅ إبطال الكاش بعد الاستيراد
      try { Core_Context.invalidateAll(); } catch (e) {}
      if (xlsxFiles.length === 0) {
        Logger.log("⚠️ لا توجد ملفات في NUR_Imports/");
        return { success: false, message: "لا توجد ملفات للاستيراد" };
      }

      Logger.log("📁 عدد الملفات: " + xlsxFiles.length);

      const allRecords = [];
      let processedCount = 0;
      const failedFiles = [];

      for (let i = 0; i < xlsxFiles.length; i++) {
        const file = xlsxFiles[i];
        Logger.log("\n📄 [" + (i + 1) + "/" + xlsxFiles.length + "] معالجة: " + file.getName());

        try {
          const records = processSingleFile(file);
          if (records && records.length > 0) {
            for (let r = 0; r < records.length; r++) {
              allRecords.push(records[r]);
            }
            Logger.log("   ✅ استُخرج " + records.length + " سجل");
            processedCount++;
          }
        } catch (err) {
          Logger.log("   ❌ فشل: " + err.toString());
          failedFiles.push({ name: file.getName(), error: err.toString() });
        }
      }

      Logger.log("\n📊 إجمالي السجلات: " + allRecords.length);

      if (allRecords.length === 0) {
        return { success: false, message: "لم يُستخرج أي سجل" };
      }

      // 4. دمج في Staff_All
      const mergeResult = mergeIntoStaffAll(allRecords);
      Logger.log("\n✅ نتائج الدمج:");
      Logger.log("   - جديد: " + mergeResult.added);
      Logger.log("   - محدّث: " + mergeResult.updated);
      Logger.log("   - منقول: " + mergeResult.transferred);

      // 5. إنشاء المجلدات المسبقة
      Logger.log("\n📁 إنشاء مجلدات المعلمين...");
      const folderResult = ensureFoldersForAll(allRecords);
      Logger.log("   - مجلدات موجودة: " + folderResult.existing);
      Logger.log("   - مجلدات أُنشئت: " + folderResult.created);
      Logger.log("   - Folder IDs محدّثة: " + folderResult.updated);

      // 6. نقل الملفات
      for (let i = 0; i < xlsxFiles.length; i++) {
        try {
          xlsxFiles[i].moveTo(processedFolder);
        } catch (e) {}
      }

      // 7. تسجيل
      logImportAction({
        action: "IMPORT_NUR",
        filesCount: xlsxFiles.length,
        recordsCount: allRecords.length,
        added: mergeResult.added,
        updated: mergeResult.updated,
        transferred: mergeResult.transferred,
        duration: (new Date() - startTime) / 1000,
        folderCreated: folderResult.created,
        folderExisting: folderResult.existing
      });

      return {
        success: true,
        filesProcessed: processedCount,
        recordsExtracted: allRecords.length,
        merge: mergeResult,
        folders: folderResult
      };

    } catch (err) {
      Logger.log("❌ خطأ حرج: " + err.toString());
      return { success: false, error: err.toString() };
    }
  }

  function processSingleFile(file) {
    const fileName = file.getName();
    const tempSheetInfo = convertExcelToTempSheet(file.getId(), fileName);
    const tempSpreadsheet = tempSheetInfo.spreadsheet;
    const tempSheet = tempSheetInfo.sheet;

    try {
      let userType = detectUserTypeFromContent(tempSheet);
      if (!userType) {
        userType = detectUserTypeFromFileName(fileName);
        Logger.log("   ℹ️ النوع (من الملف): " + userType);
      } else {
        Logger.log("   ℹ️ النوع (B7): " + userType);
      }

      return extractStaffFromSheet(tempSheet, userType);
    } finally {
      try {
        DriveApp.getFileById(tempSpreadsheet.getId()).setTrashed(true);
      } catch (e) {}
    }
  }

  function convertExcelToTempSheet(fileId, fileName) {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();

    const newFile = Drive.Files.insert(
      { title: "TEMP_" + fileName.replace(/\.xlsx?$/i, ""), mimeType: MimeType.GOOGLE_SHEETS },
      blob,
      { convert: true }
    );

    const spreadsheet = SpreadsheetApp.openById(newFile.id);
    return { spreadsheet: spreadsheet, sheet: spreadsheet.getSheets()[0] };
  }

  function detectUserTypeFromContent(sheet) {
    try {
      const row = Core_Config.get("IMPORT_USER_TYPE_CELL_ROW");
      const col = Core_Config.get("IMPORT_USER_TYPE_CELL_COL");
      const value = sheet.getRange(row, col).getValue();
      if (value && typeof value === "string") {
        const clean = value.trim();
        if (clean.length > 0 && clean.length < 50) return clean;
      }
    } catch (e) {}
    return null;
  }

  function detectUserTypeFromFileName(fileName) {
    let name = fileName.replace(/\.xlsx?$/i, "").trim();
    const prefix = Core_Config.get("NUR_FILE_PREFIX");
    if (name.indexOf(prefix) === 0) name = name.substring(prefix.length).trim();
    name = name.replace(/\(\d+\)/g, "").trim();
    return name || "غير محدد";
  }

  function extractStaffFromSheet(sheet, userType) {
    const data = sheet.getDataRange().getValues();
    if (!data || data.length === 0) return [];

    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(30, data.length); i++) {
      const rowStr = data[i].join(" ");
      if (rowStr.includes("رقم الهوية") && rowStr.includes("اسم الموظف")) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) return [];

    const headers = [];
    const row1 = data[headerRowIndex] || [];
    const row2 = data[headerRowIndex + 1] || [];
    const maxCols = Math.max(row1.length, row2.length);

    for (let c = 0; c < maxCols; c++) {
      const v1 = row1[c] ? String(row1[c]).trim() : "";
      const v2 = row2[c] ? String(row2[c]).trim() : "";
      headers.push((v1 + " " + v2).trim());
    }

    const colIdx = {
      national_id: findColumnByName(headers, ["رقم الهوية", "الهوية"]),
      name: findColumnByName(headers, ["اسم الموظف"]),
      mobile: findColumnByName(headers, ["الجوال"]),
      email: findColumnByName(headers, ["البريد"]),
      specialty: findColumnByName(headers, ["التخصص"]),
      qualification: findColumnByName(headers, ["المؤهل"]),
      job_number: findColumnByName(headers, ["رقم الوظيفة", "الوظيفة رقم"]),
      school: findColumnByName(headers, ["المدرسة"])
    };

    const records = [];
    const startRow = headerRowIndex + 2;

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      let nationalId = colIdx.national_id >= 0 ? String(row[colIdx.national_id] || "").trim() : "";
      nationalId = nationalId.replace(/\D/g, "");

      if (nationalId.length !== Core_Config.get("IMPORT_MIN_ID_LENGTH")) continue;

      const nameRaw = colIdx.name >= 0 ? String(row[colIdx.name] || "").trim() : "";
      if (!nameRaw) continue;

      records.push({
        nationalId: nationalId,
        nameRaw: nameRaw,
        nameCanonical: Util_NameNormalizer.getCanonical(nameRaw),
        role: userType,
        mobile: colIdx.mobile >= 0 ? String(row[colIdx.mobile] || "").trim() : "",
        email: colIdx.email >= 0 ? String(row[colIdx.email] || "").trim() : "",
        specialty: colIdx.specialty >= 0 ? String(row[colIdx.specialty] || "").trim() : "",
        qualification: colIdx.qualification >= 0 ? String(row[colIdx.qualification] || "").trim() : "",
        jobNumber: colIdx.job_number >= 0 ? String(row[colIdx.job_number] || "").trim() : "",
        school: colIdx.school >= 0 ? String(row[colIdx.school] || "").trim() : ""
      });
    }

    return records;
  }

  function findColumnByName(headers, candidates) {
    for (let i = 0; i < headers.length; i++) {
      for (let j = 0; j < candidates.length; j++) {
        if (headers[i].indexOf(candidates[j]) !== -1) return i;
      }
    }
    return -1;
  }

  function mergeIntoStaffAll(newRecords) {
    const ss = SpreadsheetApp.openById(Core_Config.get("SPREADSHEET_ID"));
    let sheet = ss.getSheetByName(Core_Config.get("SHEET_STAFF_ALL"));

    if (!sheet) {
      sheet = ss.insertSheet(Core_Config.get("SHEET_STAFF_ALL"));
      sheet.appendRow(STAFF_HEADERS);
      sheet.setFrozenRows(1);
    }

    const data = sheet.getDataRange().getValues();
    const existingMap = new Map();

    for (let i = 1; i < data.length; i++) {
      const id = String(data[i][0] || "").trim();
      if (id) existingMap.set(id, { rowIndex: i + 1, record: data[i] });
    }

    const newMap = new Map();
    newRecords.forEach(r => newMap.set(r.nationalId, r));

    const today = Utilities.formatDate(new Date(), "Asia/Riyadh", "yyyy-MM-dd");
    let added = 0, updated = 0, transferred = 0;

    newRecords.forEach(rec => {
      const existing = existingMap.get(rec.nationalId);
      const rowData = [
        rec.nationalId,
        rec.nameRaw,
        rec.nameCanonical,
        rec.role,
        "نشط",
        rec.mobile,
        rec.email,
        rec.specialty,
        rec.qualification,
        rec.jobNumber,
        rec.school,
        today,
        Core_Config.isAdmin(rec.nationalId, rec.role) ? "true" : "false",
        existing ? String(existing.record[13] || "") : ""
      ];

      if (existing) {
        sheet.getRange(existing.rowIndex, 1, 1, STAFF_HEADERS.length).setValues([rowData]);
        updated++;
      } else {
        sheet.appendRow(rowData);
        added++;
      }
    });

    existingMap.forEach((val, id) => {
      if (!newMap.has(id)) {
        const statusCol = STAFF_HEADERS.indexOf("status") + 1;
        const currentStatus = String(val.record[statusCol - 1] || "").trim();
        if (currentStatus !== "منقول") {
          sheet.getRange(val.rowIndex, statusCol).setValue("منقول");
          transferred++;
        }
      }
    });

    return { added: added, updated: updated, transferred: transferred, total: added + updated };
  }

  /* ============================================================================
   * إنشاء المجلدات المسبقة لكل المعلمين
   * ============================================================================ */

  function ensureFoldersForAll(records) {
  const rootFolder = DriveApp.getFolderById(Core_Config.get('MASTER_ROOT_FOLDER_ID'));

  let teachersFolder;
  const teachersIter = rootFolder.getFoldersByName('Teachers');
  if (teachersIter.hasNext()) {
    teachersFolder = teachersIter.next();
  } else {
    teachersFolder = rootFolder.createFolder('Teachers');
    Logger.log('✅ أُنشئ مجلد Teachers');
  }

  const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
  const sheet = ss.getSheetByName(Core_Config.get('SHEET_STAFF_ALL'));
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idColIdx = headers.indexOf('national_id');
  const folderIdColIdx = headers.indexOf('folder_id');

  if (folderIdColIdx === -1) {
    Logger.log('❌ عمود folder_id غير موجود');
    return { existing: 0, created: 0, updated: 0 };
  }

  // ✅ بناء خريطة: nationalId → { folderId, rowIndex }
  const idToRow = new Map();
  for (let i = 1; i < data.length; i++) {
    const nid = String(data[i][idColIdx] || '').trim();
    if (nid) idToRow.set(nid, i + 1);
  }

  const result = { existing: 0, created: 0, updated: 0 };
  const updates = []; // ✅ تجميع التحديثات

  records.forEach(function(rec) {
    const safeName = String(rec.nameRaw || '').replace(/[\/\\:*?"<>|]/g, '_').trim();
    if (!safeName) return;

    let folder = null;
    const iter = teachersFolder.getFoldersByName(safeName);
    if (iter.hasNext()) {
      folder = iter.next();
      result.existing++;
    } else {
      folder = teachersFolder.createFolder(safeName);
      result.created++;
    }

    const rowIndex = idToRow.get(String(rec.nationalId).trim());
    if (rowIndex) {
      const currentId = String(data[rowIndex - 1][folderIdColIdx] || '').trim();
      if (currentId !== folder.getId()) {
        updates.push({ row: rowIndex, folderId: folder.getId() });
      }
    }
  });

  // ✅ كتابة دفعة واحدة
  if (updates.length > 0) {
    updates.forEach(function(u) {
      sheet.getRange(u.row, folderIdColIdx + 1).setValue(u.folderId);
    });
    result.updated = updates.length;
  }

  return result;
}

  function logImportAction(details) {
    try {
      const ss = SpreadsheetApp.openById(Core_Config.get("SPREADSHEET_ID"));
      let logSheet = ss.getSheetByName(Core_Config.get("SHEET_AUDIT_LOG"));
      if (!logSheet) {
        logSheet = ss.insertSheet(Core_Config.get("SHEET_AUDIT_LOG"));
        logSheet.appendRow(["timestamp", "action", "files_count", "records_count", "added", "updated", "transferred", "duration_sec", "details"]);
      }

      logSheet.appendRow([
        new Date(),
        details.action || "UNKNOWN",
        details.filesCount || 0,
        details.recordsCount || 0,
        details.added || 0,
        details.updated || 0,
        details.transferred || 0,
        Math.round(details.duration || 0),
        "مجلدات: " + (details.folderCreated || 0) + " جديدة، " + (details.folderExisting || 0) + " موجودة"
      ]);
    } catch (e) {}
  }

  function getOrCreateFolder(parentFolder, name) {
    const iter = parentFolder.getFoldersByName(name);
    if (iter.hasNext()) return iter.next();
    return parentFolder.createFolder(name);
  }

  return {
    importFromNurFolder: importFromNurFolder,
    ensureFoldersForAll: ensureFoldersForAll
  };

})();

function IMPORT_NUR_DATA() {
  return Feature_ImportService.importFromNurFolder();
}

function ENSURE_ALL_FOLDERS() {
  const allStaff = Core_DataLayer.getStaffList();
  const records = allStaff.map(s => ({ nationalId: s.nationalId, nameRaw: s.name }));
  return Feature_ImportService.ensureFoldersForAll(records);
}