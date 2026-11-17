/*************************************************************************************
 * Feature_SignatureService.js — توقيع المنفذ، ملف واحد لكل سجل مدني
 * -----------------------------------------------------------------------------------
 * المفتاح: sig_{nationalId}.png داخل مجلد Signatures_1059
 * لا رابط عام. لا بريد جلسة. لا علاقة بتوقيع الوكيل أو المدير.
 *************************************************************************************/

const Feature_SignatureService = (function () {
  const FOLDER_NAME = 'Signatures_1059';
  const PARENT_FOLDER_ID = '1TnTBwZQ6PORIqOkmFdkLaS0S1K-3d2pF';
  const PROP_FOLDER = 'SIGNATURES_FOLDER_ID';
  const MAX_BYTES = 800000;

  function _props() {
    return PropertiesService.getScriptProperties();
  }

  function _key(nationalId) {
    return 'SIG_' + nationalId;
  }

  function _id(nationalId) {
    const id = String(nationalId || '').trim();
    return /^\d{10}$/.test(id) ? id : '';
  }

  function _meta(nationalId) {
    const raw = _props().getProperty(_key(nationalId));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function _pngBytes(base64) {
    let clean = String(base64 || '');
    const comma = clean.indexOf(',');
    if (comma !== -1) clean = clean.substring(comma + 1);
    clean = clean.replace(/ /g, '+').replace(/\s/g, '');
    if (!clean) {
      Logger.log('INVALID_PNG: EMPTY');
      return { error: 'INVALID_PNG: EMPTY' };
    }
    let bytes = null;
    try {
      bytes = Utilities.base64Decode(clean);
    } catch (err) {
      Logger.log('INVALID_PNG: DECODE ' + err);
      return { error: 'INVALID_PNG: DECODE' };
    }
    if (!bytes) {
      Logger.log('INVALID_PNG: EMPTY');
      return { error: 'INVALID_PNG: EMPTY' };
    }
    Logger.log('bytes: ' + bytes.length);
    if (bytes.length < 60) {
      Logger.log('TOO_SMALL');
      return { error: 'INVALID_PNG: TOO_SMALL' };
    }
    if (bytes.length > MAX_BYTES) {
      Logger.log('TOO_LARGE (actual: ' + bytes.length + ')');
      return { error: 'INVALID_PNG: TOO_LARGE' };
    }
    const b0 = bytes[0] & 0xFF;
    const b1 = bytes[1] & 0xFF;
    const b2 = bytes[2] & 0xFF;
    const b3 = bytes[3] & 0xFF;
    if (b0 !== 0x89 || b1 !== 0x50 || b2 !== 0x4E || b3 !== 0x47) {
      Logger.log('NOT_PNG (first bytes: ' + b0 + ' ' + b1 + ' ' + b2 + ' ' + b3 + ')');
      return { error: 'INVALID_PNG: NOT_PNG' };
    }
    return { bytes: bytes, clean: clean };
  }

  function ensureFolder() {
    const props = _props();
    const saved = props.getProperty(PROP_FOLDER);
    if (saved) {
      try {
        const existing = DriveApp.getFolderById(saved);
        if (!existing.isTrashed() && existing.getName() === FOLDER_NAME) return existing.getId();
      } catch (e) {}
    }
    let root;
    try {
      root = DriveApp.getFolderById(PARENT_FOLDER_ID);
    } catch (err) {
      throw new Error('PARENT_NOT_FOUND ' + PARENT_FOLDER_ID + ' ' + err);
    }
    if (root.isTrashed()) throw new Error('PARENT_TRASHED ' + PARENT_FOLDER_ID);
    const iter = root.getFoldersByName(FOLDER_NAME);
    const folder = iter.hasNext() ? iter.next() : root.createFolder(FOLDER_NAME);
    props.setProperty(PROP_FOLDER, folder.getId());
    return folder.getId();
  }

  function save(nationalId, base64) {
    const id = _id(nationalId);
    if (!id) return { success: false, reason: 'INVALID_ID' };
    if (!Core_DataLayer.getTeacherByNationalId(id)) return { success: false, reason: 'TEACHER_NOT_FOUND' };
    const parsed = _pngBytes(base64);
    if (!parsed || !parsed.clean) return { success: false, reason: (parsed && parsed.error) || 'INVALID_PNG' };

    const folderId = ensureFolder();
    const fileName = 'sig_' + id + '.png';
    const previous = _meta(id);
    if (previous && previous.fileId) {
      try { DriveApp.getFileById(previous.fileId).setTrashed(true); } catch (e) {}
    }
    const folder = DriveApp.getFolderById(folderId);
    const sameName = folder.getFilesByName(fileName);
    while (sameName.hasNext()) {
      try { sameName.next().setTrashed(true); } catch (e2) {}
    }
    let fileId = '';
    try {
      fileId = _uploadPng(folderId, fileName, parsed.clean);
    } catch (err) {
      Logger.log('❌ حفظ التوقيع: ' + err);
      return { success: false, reason: String(err).substring(0, 180) };
    }
    const meta = { fileId: fileId, savedAt: new Date().toISOString() };
    _props().setProperty(_key(id), JSON.stringify(meta));
    return { success: true, fileId: fileId, savedAt: meta.savedAt };
  }

  function _uploadPng(folderId, fileName, cleanBase64) {
    const boundary = 'sig1059boundary';
    const meta = { name: fileName, mimeType: 'image/png', parents: [folderId] };
    const body =
      '--' + boundary + '\r\n' +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(meta) + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: image/png\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      cleanBase64 + '\r\n' +
      '--' + boundary + '--';
    const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'post',
      contentType: 'multipart/related; boundary=' + boundary,
      payload: body,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    const json = JSON.parse(res.getContentText() || '{}');
    if (code >= 300 || !json.id) {
      throw new Error('DRIVE_UPLOAD ' + code + ' ' + res.getContentText());
    }
    return json.id;
  }

  function embed(nationalId) {
    const current = status(nationalId);
    if (!current.success || !current.exists || !current.fileId) return '';
    try {
      const bytes = DriveApp.getFileById(current.fileId).getBlob().getBytes();
      if (!bytes || bytes.length < 8) return '';
      if ((bytes[0] & 0xFF) !== 0x89 || (bytes[1] & 0xFF) !== 0x50 || (bytes[2] & 0xFF) !== 0x4E || (bytes[3] & 0xFF) !== 0x47) return '';
      return 'data:image/png;base64,' + Utilities.base64Encode(bytes).replace(/\s/g, '');
    } catch (err) {
      Logger.log('⚠️ embed signature: ' + err);
      return '';
    }
  }

  function status(nationalId) {
    const id = _id(nationalId);
    if (!id) return { success: false, exists: false, reason: 'INVALID_ID' };
    const meta = _meta(id);
    if (!meta || !meta.fileId) return { success: true, exists: false };
    try {
      const file = DriveApp.getFileById(meta.fileId);
      if (file.isTrashed()) return { success: true, exists: false };
      return { success: true, exists: true, fileId: meta.fileId, savedAt: meta.savedAt || '' };
    } catch (e) {
      return { success: true, exists: false };
    }
  }

  function get(nationalId) {
    const current = status(nationalId);
    if (!current.success || !current.exists) return current;
    try {
      const file = DriveApp.getFileById(current.fileId);
      const bytes = file.getBlob().getBytes();
      return {
        success: true,
        exists: true,
        fileId: current.fileId,
        savedAt: current.savedAt,
        base64: Utilities.base64Encode(bytes)
      };
    } catch (err) {
      Logger.log('⚠️ توقيع غير قابل للقراءة: ' + err);
      return { success: true, exists: false };
    }
  }

  function clearProbe(nationalId) {
    const current = status(nationalId);
    if (!current.exists) return { success: true, cleared: false };
    const file = DriveApp.getFileById(current.fileId);
    if (file.getSize() > 200) return { success: false, reason: 'REFUSE_REAL_SIGNATURE' };
    file.setTrashed(true);
    _props().deleteProperty(_key(_id(nationalId)));
    return { success: true, cleared: true };
  }

  return {
    ensureFolder: ensureFolder,
    save: save,
    status: status,
    get: get,
    embed: embed,
    clearProbe: clearProbe
  };
})();

function Feature_SignatureService_status(nationalId) {
  return Feature_SignatureService.status(nationalId);
}

function Feature_SignatureService_save(nationalId, base64) {
  return Feature_SignatureService.save(nationalId, base64);
}

function TEST_SignaturePhase1() {
  let folderId = '';
  try {
    folderId = Feature_SignatureService.ensureFolder();
  } catch (err) {
    return { ok: false, reason: String(err), folderId: '' };
  }
  const staff = Core_DataLayer.getStaffList();
  if (!staff.length) return { ok: false, folderId: folderId, reason: 'NO_STAFF' };
  const id = staff[0].nationalId;
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const saved = Feature_SignatureService.save(id, png);
  const got = Feature_SignatureService.get(id);
  const cleared = Feature_SignatureService.clearProbe(id);
  const after = Feature_SignatureService.status(id);
  return {
    ok: !!(saved.success && got.exists && got.fileId === saved.fileId && cleared.success && after.exists === false),
    folderId: folderId,
    nationalId: id,
    saved: saved.success,
    retrieved: !!got.exists,
    cleared: !!cleared.success,
    stillThere: !!after.exists
  };
}
