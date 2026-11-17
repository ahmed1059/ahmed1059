/**
 * ==============================================================================
 * Feature_InstantGuardian.gs — حارس اللحظة (Instant Guardian)
 * ---------------------------------------------------------------------------
 * الإصدار: 1.0.0 — وفق بروتوكول 1059-Pro
 * ---------------------------------------------------------------------------
 * المهمة:
 *   - عند أي تغيير في ورقة الردود → نسخة فورية
 *   - الاحتفاظ بآخر 3 نسخ فقط
 *   - إبطال الكاش تلقائياً
 *   - إشعار في Audit_Log
 * ==============================================================================
 */

const Feature_InstantGuardian = (function () {

  const PREFIX = 'SNAP_';  // Snapshot (صورة لحظية)
  const MAX_SNAPSHOTS = 3;

  /**
   * إنشاء نسخة لحظية.
   */
  function takeSnapshot(reason) {
    try {
      const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
      const sourceSheet = ss.getSheetByName(Core_Config.get('SHEET_RESPONSES_NAME'));

      if (!sourceSheet) return { success: false, error: 'SHEET_NOT_FOUND' };

      const rows = sourceSheet.getLastRow() - 1;
      if (rows < 1) return { success: false, error: 'EMPTY' };

      // ═══ اسم النسخة ═══
      const timestamp = Utilities.formatDate(new Date(), 'Asia/Riyadh', 'yyyy-MM-dd_HH-mm-ss');
      const snapshotName = PREFIX + timestamp + '_' + (reason || 'auto').substring(0, 20);

      // ═══ النسخ ═══
      const snapshot = sourceSheet.copyTo(ss);
      snapshot.setName(snapshotName);

      Logger.log('📸 نسخة لحظية: ' + snapshotName + ' (' + rows + ' صف)');

      // ═══ اقتصاص ═══
      _pruneSnapshots(ss);

      // ═══ تسجيل ═══
      try {
        Feature_AdminService.logAdminAction({
          action: 'SNAPSHOT',
          details: snapshotName + ' (' + rows + ' صف) — السبب: ' + reason
        });
      } catch (e) {}

      return { success: true, name: snapshotName, rows: rows };
    } catch (e) {
      Logger.log('❌ خطأ في النسخة: ' + e.toString());
      return { success: false, error: e.toString() };
    }
  }

  /**
   * اقتصاص النسخ الاحتياطية — الاحتفاظ بأحدث 3.
   */
  function _pruneSnapshots(ss) {
    const sheets = ss.getSheets();
    const snapshots = [];

    sheets.forEach(function (s) {
      const name = s.getName();
      if (name.indexOf(PREFIX) === 0) {
        snapshots.push({
          sheet: s,
          name: name,
          timestamp: name.replace(PREFIX, '').split('_').slice(0, 2).join('_')
        });
      }
    });

    snapshots.sort(function (a, b) {
      return b.timestamp.localeCompare(a.timestamp);
    });

    const toDelete = snapshots.slice(MAX_SNAPSHOTS);
    toDelete.forEach(function (s) {
      try {
        ss.deleteSheet(s.sheet);
        Logger.log('🗑️ حُذفت نسخة قديمة: ' + s.name);
      } catch (e) {}
    });
  }

  return {
    takeSnapshot: takeSnapshot
  };

})();