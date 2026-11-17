/*************************************************************************************
 * Core_Migration.gs — ترحيلات لمرة واحدة
 * -----------------------------------------------------------------------------------
 * الإصدار: 1.5.0
 * - MIGRATION_ImportFolderIds
 * - MIGRATION_Verify
 * - MIGRATION_ManualAssign
 * - MIGRATION_CleanRootFolders (جديدة) — تنظيف مجلدات Drive
 * - REPROCESS_AllSubmissions
 * - DEBUG_CompareNames
 *************************************************************************************/

/* ============================================================================
 * 1. ترحيل Folder IDs
 * ============================================================================ */

function MIGRATION_ImportFolderIds() {
  Logger.log('🚀 بدء ترحيل Folder IDs...\n');

  const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));

  const sourceSheet = ss.getSheetByName(Core_Config.get('SHEET_TEACHER_DATA'));
  if (!sourceSheet) {
    Logger.log('❌ ورقة "بيانات المعلمين" غير موجودة');
    return { success: false, error: 'ورقة المصدر غير موجودة' };
  }

  const sourceData = sourceSheet.getDataRange().getValues();
  const sourceHeaders = sourceData[0].map(h => String(h).trim());

  Logger.log('📋 أعمدة المصدر: ' + sourceHeaders.join(' | '));

  const srcNameIdx = findColumnByKeyword(sourceHeaders, ['اسم المعلم', 'الموظف']);
  const srcFolderIdx = findColumnByKeyword(sourceHeaders, ['Folder ID', 'المجلد الشخصي', 'المجلد']);
  const srcIdIdx = findColumnByKeyword(sourceHeaders, ['رقم السجل', 'الهوية', 'السجل المدني']);

  if (srcNameIdx === -1 || srcFolderIdx === -1) {
    Logger.log('❌ الأعمدة المطلوبة غير موجودة');
    return { success: false };
  }

  const sourceRecords = [];
  for (let i = 1; i < sourceData.length; i++) {
    let rawName = String(sourceData[i][srcNameIdx] || '').trim();
    const folderId = String(sourceData[i][srcFolderIdx] || '').trim();
    let nationalId = srcIdIdx >= 0 ? String(sourceData[i][srcIdIdx] || '').trim() : '';

    if (!rawName || !folderId) continue;

    let cleanName = rawName;
    const dashIdx = cleanName.indexOf(' - ');
    if (dashIdx !== -1) cleanName = cleanName.substring(0, dashIdx).trim();
    const dashIdx2 = cleanName.indexOf('-');
    if (dashIdx2 !== -1) cleanName = cleanName.substring(0, dashIdx2).trim();

    nationalId = nationalId.replace(/\D/g, '');

    sourceRecords.push({
      name: cleanName,
      rawName: rawName,
      folderId: folderId,
      nationalId: nationalId
    });
  }

  Logger.log('📦 عدد سجلات المصدر: ' + sourceRecords.length);

  const targetSheet = ss.getSheetByName(Core_Config.get('SHEET_STAFF_ALL'));
  const targetData = targetSheet.getDataRange().getValues();
  const targetHeaders = targetData[0].map(h => String(h).trim());

  let folderIdColIdx = targetHeaders.indexOf('folder_id');
  if (folderIdColIdx === -1) {
    folderIdColIdx = targetHeaders.length;
    targetSheet.getRange(1, folderIdColIdx + 1).setValue('folder_id');
    targetHeaders.push('folder_id');
    Logger.log('✅ أُضيف عمود folder_id');
  }

  const targetNameIdx = targetHeaders.indexOf('name_raw');
  const targetIdIdx = targetHeaders.indexOf('national_id');

  let matchedById = 0, matchedLiteral = 0, matchedCanonical = 0, matchedSmart = 0, notMatched = 0;
  const unmatchedNames = [];

  for (let i = 1; i < targetData.length; i++) {
    const staffName = String(targetData[i][targetNameIdx] || '').trim();
    const staffId = targetIdIdx >= 0 ? String(targetData[i][targetIdIdx] || '').trim().replace(/\D/g, '') : '';
    if (!staffName) continue;

    let found = null;

    if (staffId && staffId.length >= 8) {
      for (let j = 0; j < sourceRecords.length; j++) {
        if (sourceRecords[j].nationalId && sourceRecords[j].nationalId === staffId) {
          found = sourceRecords[j];
          matchedById++;
          break;
        }
      }
    }

    if (!found) {
      for (let j = 0; j < sourceRecords.length; j++) {
        if (String(sourceRecords[j].name).trim() === staffName) {
          found = sourceRecords[j];
          matchedLiteral++;
          break;
        }
      }
    }

    if (!found) {
      const canonicalStaff = Util_NameNormalizer.getCanonical(staffName);
      if (canonicalStaff) {
        for (let j = 0; j < sourceRecords.length; j++) {
          const canonicalSource = Util_NameNormalizer.getCanonical(sourceRecords[j].name);
          if (canonicalSource && canonicalStaff === canonicalSource) {
            found = sourceRecords[j];
            matchedCanonical++;
            break;
          }
        }
      }
    }

    if (!found) {
      const staffTokens = Util_NameNormalizer.tokenize(staffName);
      if (staffTokens.length >= 2) {
        const staffFirst = staffTokens[0];
        const staffFamily = staffTokens[staffTokens.length - 1];
        let bestScore = 0;

        for (let j = 0; j < sourceRecords.length; j++) {
          const srcTokens = Util_NameNormalizer.tokenize(sourceRecords[j].name);
          if (srcTokens.length < 2) continue;
          if (srcTokens[0] !== staffFirst) continue;

          const familySim = Util_NameNormalizer.calculateSimilarity(srcTokens[srcTokens.length - 1], staffFamily);
          if (familySim >= 70) {
            const totalScore = Math.round((100 + familySim) / 2);
            if (totalScore > bestScore) {
              bestScore = totalScore;
              found = sourceRecords[j];
            }
          }
        }

        if (found) matchedSmart++;
      }
    }

    if (found) {
      targetSheet.getRange(i + 1, folderIdColIdx + 1).setValue(found.folderId);
    } else {
      notMatched++;
      unmatchedNames.push(staffName);
    }
  }

  Logger.log('\n📊 النتائج:');
  Logger.log('   🆔 بالسجل المدني: ' + matchedById);
  Logger.log('   🔤 حرفي: ' + matchedLiteral);
  Logger.log('   🔤 تطبيع: ' + matchedCanonical);
  Logger.log('   🤖 ذكي: ' + matchedSmart);
  Logger.log('   ⚠️ بدون مطابقة: ' + notMatched);
  Logger.log('   📊 الإجمالي المُطابق: ' + (matchedById + matchedLiteral + matchedCanonical + matchedSmart));

  if (unmatchedNames.length > 0) {
    Logger.log('\n📋 أسماء بدون Folder ID:');
    unmatchedNames.forEach((n, i) => Logger.log('   ' + (i + 1) + '. ' + n));
  }

  return {
    success: true,
    matchedById: matchedById,
    matchedLiteral: matchedLiteral,
    matchedCanonical: matchedCanonical,
    matchedSmart: matchedSmart,
    notMatched: notMatched
  };
}


/* ============================================================================
 * 2. التحقق من Staff_All
 * ============================================================================ */

function MIGRATION_Verify() {
  const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
  const sheet = ss.getSheetByName(Core_Config.get('SHEET_STAFF_ALL'));
  if (!sheet) { Logger.log('❌ Staff_All غير موجودة'); return; }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const nameIdx = headers.indexOf('name_raw');
  const folderIdIdx = headers.indexOf('folder_id');
  const roleIdx = headers.indexOf('role');

  if (folderIdIdx === -1) { Logger.log('❌ عمود folder_id غير موجود'); return; }

  let withId = 0, withoutId = 0;
  const withoutNames = [];

  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][nameIdx] || '').trim();
    const folderId = String(data[i][folderIdIdx] || '').trim();
    const role = roleIdx >= 0 ? String(data[i][roleIdx] || '').trim() : '';
    if (!name) continue;

    if (folderId) withId++;
    else { withoutId++; withoutNames.push({ name: name, role: role }); }
  }

  Logger.log('\n📊 حالة Staff_All:');
  Logger.log('   ✅ مع Folder ID: ' + withId);
  Logger.log('   ⚠️ بدون Folder ID: ' + withoutId);

  if (withoutNames.length > 0) {
    Logger.log('\n📋 الذين بدون Folder ID:');
    withoutNames.forEach((t, i) => Logger.log('   ' + (i + 1) + '. ' + t.name + ' [' + t.role + ']'));
  }

  return { withId: withId, withoutId: withoutId };
}


/* ============================================================================
 * 3. أدوات مساعدة
 * ============================================================================ */

function findColumnByKeyword(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i]).trim();
    for (let j = 0; j < keywords.length; j++) {
      if (h.indexOf(keywords[j]) !== -1) return i;
    }
  }
  return -1;
}

function MIGRATION_ManualAssign(staffNameInStaffAll, folderId) {
  if (!staffNameInStaffAll || !folderId) {
    Logger.log('❌ يجب تمرير الاسم و Folder ID');
    return;
  }

  const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
  const sheet = ss.getSheetByName(Core_Config.get('SHEET_STAFF_ALL'));
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const nameIdx = headers.indexOf('name_raw');
  const folderIdIdx = headers.indexOf('folder_id');

  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][nameIdx] || '').trim();
    if (name === staffNameInStaffAll) {
      sheet.getRange(i + 1, folderIdIdx + 1).setValue(folderId);
      Logger.log('✅ تم تعيين Folder ID إلى: ' + name);
      return { success: true };
    }
  }

  Logger.log('❌ لم يُعثر على: ' + staffNameInStaffAll);
  return { success: false };
}


/* ============================================================================
 * 4. ✅ تنظيف مجلدات Drive (جديدة)
 * ============================================================================ */

/**
 * تنظيف المجلدات القديمة في الجذر.
 * - يحتفظ بـ: NUR_Imports, _Processed, _Archive, Teachers
 * - ينقل المجلدات الأخرى إلى Teachers/
 * - يحذف المكرر
 */
function MIGRATION_CleanRootFolders() {
  Logger.log('🧹 بدء تنظيف مجلدات Drive...\n');

  const rootFolder = DriveApp.getFolderById(Core_Config.get('MASTER_ROOT_FOLDER_ID'));
  const teachersFolderName = 'Teachers';

  // احصل على Teachers/ أو أنشئه
  let teachersFolder;
  const teachersIter = rootFolder.getFoldersByName(teachersFolderName);
  if (teachersIter.hasNext()) {
    teachersFolder = teachersIter.next();
  } else {
    teachersFolder = rootFolder.createFolder(teachersFolderName);
    Logger.log('✅ أُنشئ مجلد Teachers/');
  }

  const keepNames = ['NUR_Imports', '_Processed', '_Archive', 'Teachers'];

  const folders = rootFolder.getFolders();
  const report = [];

  let kept = 0;
  let moved = 0;
  let deleted = 0;

  while (folders.hasNext()) {
    const folder = folders.next();
    const name = folder.getName();

    // احتفظ بالمجلدات الأساسية
    if (keepNames.indexOf(name) !== -1) {
      kept++;
      report.push('ℹ️ احتُفظ: ' + name);
      continue;
    }

    // ابحث عن مجلد مطابق في Teachers/
    const teachersIter = teachersFolder.getFoldersByName(name);

    if (teachersIter.hasNext()) {
      // موجود في Teachers/ — احذف النسخة المكررة
      folder.setTrashed(true);
      deleted++;
      report.push('🗑️ حُذف مكرر: ' + name);
    } else {
      // غير موجود — انقله
      folder.moveTo(teachersFolder);
      moved++;
      report.push('📦 نُقل: ' + name);
    }
  }

  Logger.log('\n📋 التقرير:');
  report.forEach(line => Logger.log('   ' + line));

  Logger.log('\n══════════════════════════════════════════');
  Logger.log('📊 نتائج التنظيف:');
  Logger.log('   ℹ️ احتُفظ: ' + kept);
  Logger.log('   📦 نُقل: ' + moved);
  Logger.log('   🗑️ حُذف: ' + deleted);
  Logger.log('══════════════════════════════════════════');

  return { kept: kept, moved: moved, deleted: deleted };
}


/* ============================================================================
 * 5. تشخيص مقارنة الأسماء
 * ============================================================================ */

function DEBUG_CompareNames() {
  Logger.log('🔍 مقارنة الأسماء...\n');
  const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));

  const sourceSheet = ss.getSheetByName(Core_Config.get('SHEET_TEACHER_DATA'));
  if (sourceSheet) {
    const sourceData = sourceSheet.getDataRange().getValues();
    const sourceHeaders = sourceData[0].map(h => String(h).trim());
    const srcNameIdx = findColumnByKeyword(sourceHeaders, ['اسم المعلم', 'الموظف']);
    Logger.log('📋 من "بيانات المعلمين" (أول 5):');
    for (let i = 1; i <= 5 && i < sourceData.length; i++) {
      Logger.log('   ' + i + '. "' + String(sourceData[i][srcNameIdx] || '').trim() + '"');
    }
  }

  const targetSheet = ss.getSheetByName(Core_Config.get('SHEET_STAFF_ALL'));
  const targetData = targetSheet.getDataRange().getValues();
  const targetHeaders = targetData[0].map(h => String(h).trim());
  const targetNameIdx = targetHeaders.indexOf('name_raw');

  Logger.log('\n📋 من "Staff_All" (أول 5):');
  for (let i = 1; i <= 5 && i < targetData.length; i++) {
    Logger.log('   ' + i + '. "' + String(targetData[i][targetNameIdx] || '').trim() + '"');
  }
}


/* ============================================================================
 * 6. إعادة معالجة الشواهد القديمة
 * ============================================================================ */

function REPROCESS_AllSubmissions() {
  Logger.log('🚀 بدء إعادة معالجة الشواهد القديمة...\n');

  const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
  const sheet = ss.getSheetByName(Core_Config.get('SHEET_RESPONSES_NAME'));

  if (!sheet) {
    Logger.log('❌ الورقة غير موجودة');
    return { success: false, error: 'SHEET_NOT_FOUND' };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log('⚠️ لا توجد بيانات');
    return { success: false, error: 'NO_DATA' };
  }

  const headers = data[0].map(h => String(h).trim());
  const pdfUrlColIdx = headers.indexOf('رابط بطاقة الشاهد (PDF)');

  Logger.log('📊 عدد السجلات: ' + (data.length - 1));
  Logger.log('📊 عمود PDF: ' + (pdfUrlColIdx >= 0 ? 'موجود (عمود ' + (pdfUrlColIdx + 1) + ')' : 'غير موجود'));

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const failedRows = [];

  for (let row = 2; row <= data.length; row++) {
    try {
      const currentPdfUrl = pdfUrlColIdx >= 0
        ? String(data[row - 1][pdfUrlColIdx] || '').trim()
        : '';

      if (currentPdfUrl && currentPdfUrl.indexOf('http') === 0) {
        skipped++;
        continue;
      }

      Logger.log('\n🔄 معالجة الصف ' + row + '...');

      const result = Feature_SubmissionService.reprocessRow(row);

      if (result && result.success) {
        processed++;
        Logger.log('   ✅ نجح');
      } else {
        failed++;
        failedRows.push(row);
        Logger.log('   ❌ فشل: ' + (result && result.reason || 'غير معروف'));
      }

      Utilities.sleep(500);

    } catch (err) {
      failed++;
      failedRows.push(row);
      Logger.log('   ❌ خطأ في الصف ' + row + ': ' + err.toString());
    }
  }

  Logger.log('\n══════════════════════════════════════════');
  Logger.log('📊 نتائج إعادة المعالجة:');
  Logger.log('   ✅ معالجة: ' + processed);
  Logger.log('   ⏭️ تخطي: ' + skipped);
  Logger.log('   ❌ فشل: ' + failed);
  Logger.log('   📊 الإجمالي: ' + (data.length - 1));
  Logger.log('══════════════════════════════════════════');

  if (failedRows.length > 0) {
    Logger.log('\n⚠️ الصفوف التي فشلت: ' + failedRows.join(', '));
  }

  return { processed, skipped, failed, failedRows };
}


/* ============================================================================
 * 7. إعادة معالجة شاملة (مع تجاوز الرابط الموجود)
 * ============================================================================ */

/**
 * إعادة معالجة كل السجلات (حتى التي لها رابط).
 * ⚠️ يحذف الروابط القديمة ويولّد بطاقات جديدة.
 */
function REPROCESS_ForceAll() {
  Logger.log('🔄 بدء إعادة المعالجة القسرية...\n');

  const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
  const sheet = ss.getSheetByName(Core_Config.get('SHEET_RESPONSES_NAME'));
  if (!sheet) return { success: false };

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: false };

  const headers = data[0].map(h => String(h).trim());
  const pdfUrlColIdx = headers.indexOf('رابط بطاقة الشاهد (PDF)');

  let processed = 0, failed = 0;
  const failedRows = [];

  for (let row = 2; row <= data.length; row++) {
    try {
      Logger.log('\n🔄 معالجة الصف ' + row + '...');

      const result = Feature_SubmissionService.reprocessRow(row);

      if (result && result.success) {
        processed++;
        Logger.log('   ✅ نجح');
      } else {
        failed++;
        failedRows.push(row);
      }

      Utilities.sleep(500);

    } catch (err) {
      failed++;
      failedRows.push(row);
      Logger.log('   ❌ خطأ: ' + err.toString());
    }
  }

  Logger.log('\n📊 النتائج:');
  Logger.log('   ✅ معالجة: ' + processed);
  Logger.log('   ❌ فشل: ' + failed);

  return { processed, failed, failedRows };
}/**
 * DEBUG — فحص شامل لـ Staff_All.
 * يُشغَّل مرة واحدة للتشخيص.
 */
function DEBUG_CheckStaffList() {
  Logger.log('🔍 فحص Staff_All...\n');
  
  const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
  Logger.log('📊 Spreadsheet: ' + ss.getName());
  
  // 1. هل الورقة موجودة؟
  const sheet = ss.getSheetByName(Core_Config.get('SHEET_STAFF_ALL'));
  
  if (!sheet) {
    Logger.log('❌ ورقة "' + Core_Config.get('SHEET_STAFF_ALL') + '" غير موجودة');
    Logger.log('\n📋 الورقات المتوفرة:');
    ss.getSheets().forEach(s => Logger.log('   - "' + s.getName() + '"'));
    return;
  }
  
  Logger.log('✅ الورقة موجودة');
  Logger.log('📊 عدد الصفوف: ' + sheet.getLastRow());
  Logger.log('📊 عدد الأعمدة: ' + sheet.getLastColumn());
  
  // 2. قراءة الرؤوس
  const data = sheet.getDataRange().getValues();
  if (data.length < 1) {
    Logger.log('⚠️ الورقة فارغة');
    return;
  }
  
  const headers = data[0].map(h => String(h).trim());
  Logger.log('\n📋 الرؤوس (' + headers.length + '):');
  headers.forEach((h, i) => Logger.log('   [' + i + '] "' + h + '"'));
  
  // 3. قراءة أول 3 صفوف
  if (data.length > 1) {
    Logger.log('\n📋 أول 3 صفوف:');
    for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
      const row = data[i];
      Logger.log('\n   صف ' + (i + 1) + ':');
      Logger.log('      national_id: "' + row[0] + '"');
      Logger.log('      name_raw: "' + row[1] + '"');
      Logger.log('      role: "' + row[3] + '"');
      Logger.log('      status: "' + row[4] + '"');
    }
  }
  
  // 4. اختبار getStaffList()
  Logger.log('\n══════════════════════════════════════');
  Logger.log('🧪 اختبار Core_DataLayer.getStaffList():');
  Logger.log('══════════════════════════════════════');
  
  try {
    const list = Core_DataLayer.getStaffList();
    Logger.log('📊 عدد المنسوبين: ' + list.length);
    
    if (list.length > 0) {
      Logger.log('\n📋 أول 5 منسوبين:');
      for (let i = 0; i < Math.min(5, list.length); i++) {
        Logger.log('   ' + (i + 1) + '. ' + list[i].name);
        Logger.log('      role: ' + list[i].role + ' | status: ' + list[i].status);
      }
    } else {
      Logger.log('⚠️ القائمة فارغة!');
    }
  } catch (err) {
    Logger.log('❌ خطأ: ' + err.toString());
  }
}/**
 * DEBUG — اختبار doGet مباشرة.
 */
function DEBUG_TestDoGet() {
  Logger.log('🔍 اختبار doGet...\n');
  
  const e = {}; // كائن فارغ
  
  try {
    const result = doGet(e);
    Logger.log('✅ doGet نجح');
    
    if (result) {
      const html = result.getContent();
      Logger.log('📊 حجم HTML: ' + html.length + ' حرف');
      
      // ابحث عن const staffList في HTML
      const match = html.match(/const staffList = (\[[\s\S]*?\]);/);
      if (match) {
        Logger.log('✅ وجدنا staffList في HTML');
        Logger.log('📊 محتوى أول 500 حرف:');
        Logger.log(match[1].substring(0, 500));
      } else {
        Logger.log('⚠️ لم نجد staffList في HTML');
      }
      
      // ابحث عن عدد الخيارات
      const optionsMatch = html.match(/<option[^>]*>/g);
      if (optionsMatch) {
        Logger.log('\n📊 عدد خيارات <option>: ' + optionsMatch.length);
        optionsMatch.slice(0, 5).forEach((o, i) => Logger.log('   ' + (i + 1) + '. ' + o));
      }
    }
  } catch (err) {
    Logger.log('❌ خطأ: ' + err.toString());
    Logger.log('Stack: ' + err.stack);
  }
}