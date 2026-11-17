/*************************************************************************************
 * Core_MigrationFolders.gs — ترحيل مجلدات المعلمين إلى Teachers/
 * -----------------------------------------------------------------------------------
 * الإصدار: 1.0.0
 *************************************************************************************/

const TEACHERS_FOLDER_NAME = 'Teachers';

/**
 * إنشاء مجلد Teachers/ إن لم يوجد.
 */
function ensureTeachersFolder() {
  const rootFolder = DriveApp.getFolderById(Core_Config.get('MASTER_ROOT_FOLDER_ID'));
  const iter = rootFolder.getFoldersByName(TEACHERS_FOLDER_NAME);
  if (iter.hasNext()) {
    Logger.log('ℹ️ مجلد Teachers موجود');
    return iter.next();
  }
  const folder = rootFolder.createFolder(TEACHERS_FOLDER_NAME);
  Logger.log('✅ أُنشئ مجلد Teachers: ' + folder.getId());
  return folder;
}

/**
 * ترحيل كل مجلدات المعلمين إلى Teachers/.
 * يستخدم Folder ID من Staff_All.
 */
function MIGRATION_MoveTeacherFolders() {
  Logger.log('🚀 بدء ترحيل مجلدات المعلمين...\n');

  const rootFolder = DriveApp.getFolderById(Core_Config.get('MASTER_ROOT_FOLDER_ID'));
  const teachersFolder = ensureTeachersFolder();

  const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
  const sheet = ss.getSheetByName(Core_Config.get('SHEET_STAFF_ALL'));
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const nameIdx = headers.indexOf('name_raw');
  const folderIdIdx = headers.indexOf('folder_id');

  let moved = 0;
  let alreadyIn = 0;
  let notFound = 0;

  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][nameIdx] || '').trim();
    const folderId = String(data[i][folderIdIdx] || '').trim();
    if (!name || !folderId) continue;

    try {
      const folder = DriveApp.getFolderById(folderId);
      const parents = folder.getParents();

      let isInTeachers = false;
      while (parents.hasNext()) {
        if (parents.next().getId() === teachersFolder.getId()) {
          isInTeachers = true;
          break;
        }
      }

      if (isInTeachers) {
        alreadyIn++;
        continue;
      }

      // نقل المجلد
      folder.moveTo(teachersFolder);
      moved++;
      Logger.log('📁 نُقل: ' + name);
    } catch (e) {
      notFound++;
      Logger.log('⚠️ لم يُعثر على مجلد: ' + name + ' — ' + e.toString());
    }
  }

  Logger.log('\n📊 النتائج:');
  Logger.log('   ✅ نُقل: ' + moved);
  Logger.log('   ℹ️ موجود مسبقاً: ' + alreadyIn);
  Logger.log('   ⚠️ لم يُعثر: ' + notFound);

  return { moved: moved, alreadyIn: alreadyIn, notFound: notFound };
}

/**
 * فحص بنية مجلدات المعلمين.
 */
function VERIFY_TeacherFolders() {
  const rootFolder = DriveApp.getFolderById(Core_Config.get('MASTER_ROOT_FOLDER_ID'));
  const teachersIter = rootFolder.getFoldersByName(TEACHERS_FOLDER_NAME);

  if (!teachersIter.hasNext()) {
    Logger.log('❌ مجلد Teachers غير موجود');
    return;
  }

  const teachersFolder = teachersIter.next();
  const folders = teachersFolder.getFolders();
  let count = 0;

  Logger.log('📁 محتوى مجلد Teachers:');
  while (folders.hasNext()) {
    const f = folders.next();
    count++;
    Logger.log('   [' + count + '] ' + f.getName());
  }

  Logger.log('\n📊 الإجمالي: ' + count + ' مجلد');
}