/**
 * ==============================================================================
 * Feature_ImageCacheService.gs — كاش الصور الدائم
 * الإصدار: 1.1.0 — وفق بروتوكول 1059-Pro
 * ==============================================================================
 */

const Feature_ImageCacheService = (function () {

  const CACHE_FOLDER_NAME = '_ImageCache';
  const TTL_DAYS = 30;

  let _cacheFolderId = null;

  function _getCacheFolder() {
    if (_cacheFolderId) {
      try { return DriveApp.getFolderById(_cacheFolderId); } catch (e) {}
    }
    const root = DriveApp.getFolderById(Core_Config.get('MASTER_ROOT_FOLDER_ID'));
    const iter = root.getFoldersByName(CACHE_FOLDER_NAME);
    if (iter.hasNext()) {
      const folder = iter.next();
      _cacheFolderId = folder.getId();
      return folder;
    }
    const folder = root.createFolder(CACHE_FOLDER_NAME);
    _cacheFolderId = folder.getId();
    Logger.log('📁 أُنشئ مجلد الكاش: ' + CACHE_FOLDER_NAME);
    return folder;
  }

  function _getCacheKey(fileId) {
    let hash = 0;
    for (let i = 0; i < fileId.length; i++) {
      const char = fileId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'img_' + Math.abs(hash).toString(36);
  }

  function get(fileId) {
    if (!fileId) return '';

    const key = _getCacheKey(fileId);

    // ═══ L1: ScriptCache ═══
    try {
      const scriptCache = CacheService.getScriptCache();
      const cached = scriptCache.get(key);
      if (cached) return cached;
    } catch (e) {}

    // ═══ L2: Drive Cache ═══
    try {
      const folder = _getCacheFolder();
      const iter = folder.getFilesByName(key + '.json');

      if (iter.hasNext()) {
        const file = iter.next();
        const created = file.getDateCreated();
        const ageDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);

        if (ageDays < TTL_DAYS) {
          const data = JSON.parse(file.getBlob().getDataAsString('UTF-8'));

          try {
            if (data.base64 && data.base64.length < 90000) {
              CacheService.getScriptCache().put(key, data.base64, 21600);
            }
          } catch (e) {}

          return data.base64;
        } else {
          try { file.setTrashed(true); } catch (e) {}
        }
      }
    } catch (e) {
      Logger.log('⚠️ Cache read error: ' + e.toString());
    }

    return '';
  }

  function put(fileId, base64) {
    if (!fileId || !base64) return;

    const key = _getCacheKey(fileId);

    // ═══ L1: ScriptCache ═══
    try {
      if (base64.length < 90000) {
        CacheService.getScriptCache().put(key, base64, 21600);
      }
    } catch (e) {}

    // ═══ L2: Drive Cache ═══
    try {
      const folder = _getCacheFolder();
      const blob = Utilities.newBlob(
        JSON.stringify({ fileId: fileId, base64: base64, cachedAt: new Date().toISOString() }),
        'application/json',
        key + '.json'
      );

      const existing = folder.getFilesByName(key + '.json');
      while (existing.hasNext()) {
        existing.next().setTrashed(true);
      }

      folder.createFile(blob);
    } catch (e) {
      Logger.log('⚠️ Cache write error: ' + e.toString());
    }
  }

  function clearAll() {
    try {
      const folder = _getCacheFolder();
      const files = folder.getFiles();
      let count = 0;
      while (files.hasNext()) {
        files.next().setTrashed(true);
        count++;
      }
      Logger.log('🗑️ حُذفت ' + count + ' ملفات من الكاش');
      return count;
    } catch (e) {
      Logger.log('⚠️ ' + e.toString());
      return 0;
    }
  }

  function stats() {
    try {
      const folder = _getCacheFolder();
      const files = folder.getFiles();
      let count = 0;
      let totalSize = 0;

      while (files.hasNext()) {
        const f = files.next();
        count++;
        try { totalSize += f.getSize(); } catch (e) {}
      }

      return {
        files: count,
        totalSize: Math.round(totalSize / 1024) + ' KB',
        avgSize: count > 0 ? Math.round(totalSize / count / 1024) + ' KB' : '0 KB'
      };
    } catch (e) {
      Logger.log('⚠️ stats error: ' + e.toString());
      return { files: 0, totalSize: '0 KB', avgSize: '0 KB' };
    }
  }

  return {
    get: get,
    put: put,
    clearAll: clearAll,
    stats: stats
  };

})();