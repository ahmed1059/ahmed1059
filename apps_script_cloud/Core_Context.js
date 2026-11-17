/*************************************************************************************
 * Core_Context.gs — طبقة السياق الموحدة (Context Layer)
 * -----------------------------------------------------------------------------------
 * الإصدار: 1.0.0
 * وفق بروتوكول 1059-Pro — System Context Pattern
 * -----------------------------------------------------------------------------------
 * الهدف: توحيد مصادر القراءة المكلفة (Sheets/Drive) خلف كاش مركزي
 * الاعتماديات: Core_DataLayer, Feature_SubmissionService (extractImageAsBase64)
 * ملاحظة: هذا الملف إضافي بحت — لا يستبدل أي دالة قائمة
 *************************************************************************************/

const Core_Context = (function () {

  const CACHE = CacheService.getScriptCache();

  // ─── TTLs (بالثواني) ──────────────────────────────────────────────────
  const TTL_STAFF   = 300;    // 5 دقائق — قائمة المنسوبين
  const TTL_RECORDS = 120;    // دقيقتان — سجلات الشواهد (تتغير كثيراً)
  const TTL_MEDIA   = 21600;  // 6 ساعات — الشعار والتوقيعات (شبه ثابتة)

  // ─── حد CacheService لكل مفتاح = 100KB، نستخدم 90KB أماناً ────────────
  const CHUNK_SIZE  = 90000;
  const MAX_CHUNKS  = 15;     // الحد الأقصى 1.35MB لكل كيان

  const PREFIX = 'S1059_';

  /* ==========================================================================
   * القسم 1: طبقة الكاش متعدد الأجزاء (Chunked Cache)
   * ========================================================================== */

  function _key(name) {
    return PREFIX + name;
  }

  /**
   * كتابة قيمة كبيرة موزعة على عدة أجزاء.
   * @returns {boolean} نجاح الكتابة
   */
  function _putLarge(key, value, ttl) {
    try {
      const str = JSON.stringify(value);
      const chunks = Math.ceil(str.length / CHUNK_SIZE);
      if (chunks > MAX_CHUNKS) return false; // كبير جداً، نتخطى الكاش

      const map = {};
      for (let i = 0; i < chunks; i++) {
        map[key + '_c' + i] = str.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      }
      map[key + '_meta'] = String(chunks);
      CACHE.putAll(map, ttl);
      return true;
    } catch (e) {
      Logger.log('⚠️ Core_Context._putLarge: ' + e.toString());
      return false;
    }
  }

  function _getLarge(key) {
    try {
      const meta = CACHE.get(key + '_meta');
      if (!meta) return null;
      const chunks = parseInt(meta, 10);
      if (!chunks || chunks < 1 || chunks > MAX_CHUNKS) return null;

      const keys = [];
      for (let i = 0; i < chunks; i++) keys.push(key + '_c' + i);
      const values = CACHE.getAll(keys);

      let str = '';
      for (let i = 0; i < chunks; i++) {
        const v = values[key + '_c' + i];
        if (v === undefined || v === null) return null; // جزء مفقود → إبطال
        str += v;
      }
      return JSON.parse(str);
    } catch (e) {
      Logger.log('⚠️ Core_Context._getLarge: ' + e.toString());
      return null;
    }
  }

  /* ==========================================================================
   * القسم 2: الواجهة العامة — Staff
   * ========================================================================== */

  /**
   * جلب قائمة المنسوبين عبر الكاش.
   * عند الفشل: يعود مباشرة إلى Core_DataLayer (Fail-Through).
   */
  function getStaffList() {
    const key = _key('staff');
    const cached = _getLarge(key);
    if (cached !== null) return cached;

    const fresh = Core_DataLayer.getStaffList();
    _putLarge(key, fresh, TTL_STAFF);
    return fresh;
  }

  /* ==========================================================================
   * القسم 3: الواجهة العامة — Evidence Records
   * ========================================================================== */

  function getRecords() {
    const key = _key('records');
    const cached = _getLarge(key);
    if (cached !== null) return cached;

    const fresh = Core_DataLayer.getAllEvidenceRecords();
    _putLarge(key, fresh, TTL_RECORDS);
    return fresh;
  }

  /* ==========================================================================
   * القسم 4: الواجهة العامة — Media (Logo + Signatures)
   * ========================================================================== */

  /**
   * جلب Base64 لملف Drive عبر الكاش.
   * مخصص فقط للملفات الثابتة (شعار، توقيعات).
   * ⚠️ لا يُستخدم لشواهد المعلمين (تتغير + حجمها كبير).
   */
  function getMediaBase64(fileId) {
    if (!fileId) return '';
    const key = _key('media_' + fileId);
    const cached = CACHE.get(key);
    if (cached !== null && cached !== undefined) return cached;

    const fresh = extractImageAsBase64('https://drive.google.com/open?id=' + fileId);
    if (fresh && fresh.length < 90000) { // فقط إن كان صغيراً
      try { CACHE.put(key, fresh, TTL_MEDIA); } catch (e) {}
    }
    return fresh;
  }

  /* ==========================================================================
   * القسم 5: الإبطال (Invalidation)
   * ========================================================================== */

  /**
   * إبطال كيان محدد.
   * @param {string} scope - 'staff' | 'records' | 'all'
   */
  function invalidate(scope) {
    const toRemove = [];
    if (scope === 'staff' || scope === 'all') {
      toRemove.push(_key('staff') + '_meta');
      for (let i = 0; i < MAX_CHUNKS; i++) toRemove.push(_key('staff') + '_c' + i);
    }
    if (scope === 'records' || scope === 'all') {
      toRemove.push(_key('records') + '_meta');
      for (let i = 0; i < MAX_CHUNKS; i++) toRemove.push(_key('records') + '_c' + i);
    }
    if (toRemove.length > 0) CACHE.removeAll(toRemove);
  }

  function invalidateAll() {
    invalidate('all');
  }

  /* ==========================================================================
   * القسم 6: تشخيص (للتطوير فقط)
   * ========================================================================== */

  function DEBUG_stats() {
    const s = _getLarge(_key('staff'));
    const r = _getLarge(_key('records'));
    return {
      staffCached: s !== null,
      staffCount: s ? s.length : 0,
      recordsCached: r !== null,
      recordsCount: r ? r.length : 0
    };
  }

  return {
    getStaffList: getStaffList,
    getRecords: getRecords,
    getMediaBase64: getMediaBase64,
    invalidate: invalidate,
    invalidateAll: invalidateAll,
    DEBUG_stats: DEBUG_stats
  };

})();

/**
 * اختبار سريع من محرر Apps Script.
 */
function TEST_Context() {
  Logger.log('🚀 اختبار Core_Context...\n');

  const t0 = Date.now();
  const staff1 = Core_Context.getStaffList();
  const t1 = Date.now();
  const staff2 = Core_Context.getStaffList();
  const t2 = Date.now();

  Logger.log('👥 Staff count: ' + staff1.length);
  Logger.log('⏱️  القراءة الأولى: ' + (t1 - t0) + 'ms');
  Logger.log('⚡ القراءة الثانية (كاش): ' + (t2 - t1) + 'ms');

  const r0 = Date.now();
  const rec1 = Core_Context.getRecords();
  const r1 = Date.now();
  const rec2 = Core_Context.getRecords();
  const r2 = Date.now();

  Logger.log('📊 Records count: ' + rec1.length);
  Logger.log('⏱️  القراءة الأولى: ' + (r1 - r0) + 'ms');
  Logger.log('⚡ القراءة الثانية (كاش): ' + (r2 - r1) + 'ms');

  Logger.log('\n📋 التشخيص: ' + JSON.stringify(Core_Context.DEBUG_stats()));
}