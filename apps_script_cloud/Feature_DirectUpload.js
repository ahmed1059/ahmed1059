const Feature_DirectUpload = (function () {
  const MAX_BYTES = 20 * 1024 * 1024;
  const IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/pjpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
  };

  const WRITE_FIELDS = [
    { key: 'timestamp', keywords: ['الطابع الزمني', 'Timestamp'] },
    { key: 'teacher', keywords: ['اسم المعلم أو الموظف', 'اسم المعلم / الموظف', 'اسم المعلم'] },
    { key: 'term', keywords: ['الفترة', 'الفترة الزمنية للشاهد'] },
    { key: 'grade', keywords: ['الصف الدراسي المستهدف'] },
    { key: 'domain', keywords: ['مجال التقويم المستهدف'] },
    { key: 'indicator', keywords: ['المؤشر المستهدف'] },
    { key: 'actionTitle', keywords: ['عنوان الإجراء', 'المبادرة المنفذة'] },
    { key: 'actionDesc', keywords: ['وصف موجز للخطوات', 'وصف موجز'] },
    { key: 'impact', keywords: ['الأثر المتحقق'] },
    { key: 'evidence1', keywords: ['صورة الشاهد الأولى', 'الشاهد الأول'] },
    { key: 'evidence2', keywords: ['صورة الشاهد الثانية', 'الشاهد الثاني'] },
    { key: 'approver', keywords: ['معتمد التقرير', 'المعتمد'] },
    // ⚠️ ملاحظة: لا يوجد عمود "البرنامج" حالياً في "ردود النموذج 1".
    // القيمة تُسجَّل حالياً في Audit_Log فقط.
    // عند إضافة عمود "البرنامج المنفذ" مستقبلاً، سيُملأ تلقائياً عبر _findColIdx.
    { key: 'program', keywords: ['البرنامج المنفذ', 'البرنامج'] }
  ];

  function _sheet() {
    const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
    const sheet = ss.getSheetByName(Core_Config.get('SHEET_RESPONSES_NAME'));
    if (!sheet) throw new Error('SHEET_NOT_FOUND');
    return sheet;
  }

  function _teacher(teacherId) {
    const id = String(teacherId || '').trim();
    if (!id) return null;
    return Core_DataLayer.getTeacherByNationalId(id);
  }

  function _fileUrl(fileId) {
    return 'https://drive.google.com/open?id=' + fileId;
  }

  function _usableFolder(folderId) {
    if (!folderId) return '';
    try {
      const folder = DriveApp.getFolderById(folderId);
      if (folder.isTrashed()) return '';
      return folder.getId();
    } catch (err) {
      Logger.log('⚠️ مجلد غير متاح: ' + folderId + ' ' + err);
      return '';
    }
  }

  function getOrCreateTeacherFolder(teacherId) {
    const teacher = _teacher(teacherId);
    const own = _usableFolder(teacher && teacher.folderId);
    if (own) return own;
    const root = DriveApp.getFolderById(Core_Config.get('MASTER_ROOT_FOLDER_ID'));
    const iter = root.getFoldersByName('Teachers');
    if (iter.hasNext()) return iter.next().getId();
    return root.createFolder('Teachers').getId();
  }

  function registerUploadedFile(fileId, teacherId, slot) {
    const file = DriveApp.getFileById(fileId);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { fileId: fileId, url: _fileUrl(fileId), slot: slot || '', teacherId: String(teacherId || '') };
  }

  function receiveBlob(payload) {
    try {
      return _receiveBlob(payload);
    } catch (err) {
      Logger.log('❌ receiveBlob: ' + err);
      return { success: false, reason: 'FOLDER_OR_FILE', details: String(err) };
    }
  }

  function _receiveBlob(payload) {
    payload = payload || {};
    const teacher = _teacher(payload.teacherId);
    if (!teacher) return { success: false, reason: 'TEACHER_NOT_FOUND' };

    const mimeRaw = String(payload.mimeType || '').toLowerCase();
    const extFromName = String(payload.fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    const extName = extFromName ? extFromName[1] : '';
    const EXT_MIME = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
      gif: 'image/gif', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif',
      pdf: 'application/pdf', doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    const mime = IMAGE_TYPES[mimeRaw] ? mimeRaw : (EXT_MIME[extName] || '');
    if (!IMAGE_TYPES[mime]) return { success: false, reason: 'TYPE_DEFERRED' };

    const b64 = String(payload.base64 || '').replace(/ /g, '+').replace(/\s/g, '');
    if (!b64) return { success: false, reason: 'EMPTY_FILE' };
    const bytes = Utilities.base64Decode(b64);
    if (bytes.length > MAX_BYTES) return { success: false, reason: 'FILE_TOO_LARGE' };

    const ext = IMAGE_TYPES[mime];
    const safeName = String(payload.fileName || ('evidence.' + ext)).replace(/[\/\\:*?"<>|]/g, '_');
    const folder = DriveApp.getFolderById(getOrCreateTeacherFolder(payload.teacherId));
    const file = folder.createFile(Utilities.newBlob(bytes, mime, safeName));
    const registered = registerUploadedFile(file.getId(), payload.teacherId, payload.slot);
    return { success: true, fileId: registered.fileId, url: registered.url, slot: registered.slot };
  }

  function saveUpload(data) {
    data = data || {};
    const teacher = _teacher(data.teacherId);
    if (!teacher) return { success: false, reason: 'TEACHER_NOT_FOUND' };
    if (!data.evidence1FileId) return { success: false, reason: 'EVIDENCE1_REQUIRED' };

    const sheet = _sheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const values = {
      timestamp: new Date(),
      teacher: teacher.name,
      term: data.period || '',
      grade: data.grade || '',
      domain: data.domain || '',
      indicator: data.indicator || '',
      actionTitle: data.actionTitle || '',
      actionDesc: data.actionDesc || '',
      impact: data.impact || '',
      evidence1: _fileUrl(data.evidence1FileId),
      evidence2: data.evidence2FileId ? _fileUrl(data.evidence2FileId) : '',
      approver: data.approver || '',
      program: data.program || ''
    };

    const row = headers.map(function () { return ''; });
    WRITE_FIELDS.forEach(function (field) {
      const idx = Feature_SubmissionService._findColIdx(headers, field.keywords);
      if (idx !== -1) row[idx] = values[field.key];
    });

    try {
      sheet.appendRow(row);
    } catch (appendErr) {
      Logger.log('❌ appendRow failed: ' + appendErr.toString());
      return { success: false, reason: 'SHEET_WRITE_FAILED', details: String(appendErr) };
    }
    const rowIndex = sheet.getLastRow();

    let pdfUrl = '';
    let pdfError = '';
    try {
      const card = Feature_SubmissionService.reprocessRow(rowIndex, true);
      if (card && card.success) pdfUrl = card.url || '';
      else pdfError = card && card.reason ? card.reason : 'PDF_FAILED';
    } catch (err) {
      pdfError = String(err);
    }

    try { Core_Context.invalidate('records'); } catch (e) {}
    try {
      Feature_AdminService.logAdminAction({
        action: 'DIRECT_UPLOAD',
        details: 'صف ' + rowIndex + ' | ' + teacher.name + ' | برنامج: ' + (data.program || '—')
      });
    } catch (e2) {}

    return { success: true, rowIndex: rowIndex, pdfUrl: pdfUrl, pdfError: pdfError };
  }

  function updateUpload(data) {
    data = data || {};
    const actor = _teacher(data.teacherId);
    const rowIndex = parseInt(data.rowIndex, 10);
    if (!actor) return { success: false, reason: 'TEACHER_NOT_FOUND' };
    if (!rowIndex || rowIndex < 2) return { success: false, reason: 'ROW_INVALID' };
    if (!Feature_AdminService.actorCanManageRow(data.teacherId, rowIndex)) {
      return { success: false, reason: 'FORBIDDEN' };
    }

    const sheet = _sheet();
    if (rowIndex > sheet.getLastRow()) return { success: false, reason: 'ROW_MISSING' };
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const values = {
      term: data.period || '',
      grade: data.grade || '',
      domain: data.domain || '',
      indicator: data.indicator || '',
      actionTitle: data.actionTitle || '',
      actionDesc: data.actionDesc || '',
      impact: data.impact || '',
      evidence1: data.evidence1FileId ? _fileUrl(data.evidence1FileId) : '',
      evidence2: data.evidence2FileId ? _fileUrl(data.evidence2FileId) : '',
      approver: data.approver || '',
      program: data.program || ''
    };

    WRITE_FIELDS.forEach(function (field) {
      if (field.key === 'timestamp' || field.key === 'teacher') return;
      if ((field.key === 'evidence1' || field.key === 'evidence2') && !values[field.key]) return;
      const idx = Feature_SubmissionService._findColIdx(headers, field.keywords);
      if (idx === -1) return;
      if (values[field.key] === '' && field.key !== 'evidence2') return;
      sheet.getRange(rowIndex, idx + 1).setValue(values[field.key]);
    });

    let pdfUrl = '';
    let pdfError = '';
    try {
      const card = Feature_SubmissionService.reprocessRow(rowIndex, true);
      if (card && card.success) pdfUrl = card.url || '';
      else pdfError = card && card.reason ? card.reason : 'PDF_FAILED';
    } catch (err) {
      pdfError = String(err);
    }

    try { Core_Context.invalidate('records'); } catch (e) {}
    try {
      Feature_AdminService.logAdminAction({
        action: 'DIRECT_UPDATE',
        details: 'صف ' + rowIndex + ' | ' + actor.name
      });
    } catch (e2) {}

    return { success: true, rowIndex: rowIndex, pdfUrl: pdfUrl, pdfError: pdfError };
  }

  return {
    saveUpload: saveUpload,
    updateUpload: updateUpload,
    receiveBlob: receiveBlob,
    getOrCreateTeacherFolder: getOrCreateTeacherFolder,
    registerUploadedFile: registerUploadedFile
  };
})();

function Feature_DirectUpload_receiveBlob(payload) {
  return Feature_DirectUpload.receiveBlob(payload);
}

function Feature_DirectUpload_saveUpload(data) {
  return Feature_DirectUpload.saveUpload(data);
}

function Feature_DirectUpload_updateUpload(data) {
  return Feature_DirectUpload.updateUpload(data);
}
