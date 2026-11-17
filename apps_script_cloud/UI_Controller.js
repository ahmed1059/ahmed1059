/**
 * ==============================================================================
 * UI_Controller.gs — وحدة واجهة المستخدم والتحكم المركزي
 * الإصدار: 1.8.0 (وفق بروتوكول 1059-Pro)
 * ---------------------------------------------------------------------------
 * التحديثات في 1.8.0:
 *   ✅ حذف checkObserverLogin المكررة
 *   ✅ نقل getImage/clearImageCache إلى doGet الرئيسي
 *   ✅ تصحيح postMessage (كائن بدل نص)
 *   ✅ إزالة الكود الميت
 *   ✅ cache-buster للـ URLs
 * ==============================================================================
 */

// ═══════════════════════════════════════════════════════════════
// getReportDataForClient — غلاف عام لدالة توليد التقرير
// يُستدعى عبر google.script.run من الواجهة (لا CORS)
// ═══════════════════════════════════════════════════════════════
function getReportDataForClient() {
  try {
    return Feature_ReportService.generateParticipationReport();
  } catch (e) {
    return { success: false, error: String(e && e.message ? e.message : e) };
  }
}

function deleteRecordForClient(rowIdx, pdfUrl, actorId) {
  try {
    return deleteEvidenceRecord(parseInt(rowIdx, 10), String(pdfUrl || ''), String(actorId || ''));
  } catch (e) {
    return 'ERROR: ' + String(e && e.message ? e.message : e);
  }
}

function checkObserverLoginForClient(pass) {
  try {
    const expected = String(SettingsService.getFresh('observer_password') || '123123').trim();
    const clean = String(pass || '').trim();
    if (clean === expected) {
      const observerEnabled = String(SettingsService.getFresh('observer_enabled') || 'true').trim().toLowerCase() !== 'false';
      if (!observerEnabled) return { success: false, reason: 'OBSERVER_DISABLED' };
      return {
        success: true,
        user: {
          nationalId: '__OBSERVER__',
          name: String(SettingsService.getFresh('observer_name') || 'مشرف مقيم'),
          role: 'مشرف مقيم / مراقب',
          isObserver: true
        }
      };
    }
    return { success: false, reason: 'WRONG_PASSWORD' };
  } catch (e) {
    return { success: false, reason: 'ERROR: ' + String(e && e.message ? e.message : e) };
  }
}

function doGet(e) {
  try {
    // ✅ حماية: كائن parameter آمن دائماً
    const params = (e && e.parameter) ? e.parameter : {};

    // ═══════════════════════════════════════════════════════════════
    // 1. API Actions (قبل تحميل البوابة)
    // ═══════════════════════════════════════════════════════════════

    if (params.action) {

      // ═══ 🆕 جلب صورة كـ base64 ═══
      if (params.action === "getImage") {
        const fileId = String(params.id || '').trim();
        if (!fileId) {
          return ContentService.createTextOutput(JSON.stringify({ success: false }))
            .setMimeType(ContentService.MimeType.JSON);
        }

        let base64 = '';
        try {
          if (typeof Feature_ImageCacheService !== 'undefined') {
            base64 = Feature_ImageCacheService.get(fileId);
          }
        } catch (e) {}

        if (!base64) {
          try {
            base64 = extractImageAsBase64('https://drive.google.com/open?id=' + fileId);
            if (base64 && typeof Feature_ImageCacheService !== 'undefined') {
              Feature_ImageCacheService.put(fileId, base64);
            }
          } catch (e) {
            Logger.log('⚠️ getImage error: ' + e.toString());
          }
        }

        return ContentService.createTextOutput(JSON.stringify({
          success: !!base64,
          base64: base64 || ''
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // ═══ 🆕 إحصائيات الكاش ═══
      if (params.action === "imageCacheStats") {
        const stats = (typeof Feature_ImageCacheService !== 'undefined')
          ? Feature_ImageCacheService.stats()
          : { error: 'cache service not found' };
        return ContentService.createTextOutput(JSON.stringify(stats))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // ═══ 🆕 مسح الكاش ═══
      if (params.action === "clearImageCache") {
        const cleared = (typeof Feature_ImageCacheService !== 'undefined')
          ? Feature_ImageCacheService.clearAll()
          : 0;
        return ContentService.createTextOutput('Cleared: ' + cleared);
      }

      // ═══ فحص دخول المشرف ═══
      if (params.action === "checkObserverLogin") {
        const pass = String(params.pass || '').trim();
        const enabled = SettingsService.getFresh('observer_enabled') !== 'false';
        const expected = String(SettingsService.getFresh('observer_password') || '123123').trim();

        if (enabled && pass === expected) {
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            user: {
              name: String(SettingsService.getFresh('observer_name') || 'مشرف مقيم / مراقب'),
              role: 'مشرف مقيم (مراقب)',
              nationalId: '__OBSERVER__',
              isObserver: true
            }
          })).setMimeType(ContentService.MimeType.JSON);
        }
        return ContentService.createTextOutput(JSON.stringify({ success: false }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // ═══ تفريغ التجارب ═══
      if (params.action === "purge") {
        purgeTestEvidence();
        return ContentService.createTextOutput("SUCCESS");
      }

      // ═══ حذف سجل ═══
      if (params.action === "deleteRecord") {
        const rIdx = parseInt(params.row);
        const pUrl = params.url || "";
        const res = deleteEvidenceRecord(rIdx, pUrl, params.actor || params.teacherId || "");
        return ContentService.createTextOutput(res);
      }

      // ═══ بيانات التقرير ═══
      if (params.action === "getReportData") {
        const reportData = Feature_ReportService.generateParticipationReport();
        return ContentService.createTextOutput(JSON.stringify(reportData))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // ═══ طباعة بطاقة ═══
      if (params.action === "printCard") {
        const rowIdx = parseInt(params.row);
        if (!rowIdx || rowIdx < 2) {
          return ContentService.createTextOutput("رقم صف غير صالح");
        }
        const previewMode = (params.preview === "1");
        return renderCardPage(rowIdx, previewMode);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. بوابة الدخول (HTML)
    // ═══════════════════════════════════════════════════════════════

    const allStaff = Core_Context.getStaffList();
    const staffList = allStaff.filter(function(s) { return !s.isAdmin; });
    const adminList = allStaff.filter(function(s) { return s.isAdmin; });
    const reportResult = Feature_ReportService.generateParticipationReport();
    const records = reportResult.success ? reportResult.records : [];

    const guideJson        = JSON.stringify(Core_ETECGuide.getGuideData());
    const staffJson        = JSON.stringify(staffList);
    const adminJson        = JSON.stringify(adminList);
    let roleDomainsJson = '{"domainNames":{},"roles":{}}';
    try {
      if (typeof Core_RoleDomains !== 'undefined') {
        roleDomainsJson = JSON.stringify(Core_RoleDomains.getRoleMapForClient());
      }
    } catch (e) {
      Logger.log('⚠️ getRoleMapForClient: ' + e.toString());
    }

    let programsJson = '[]';
    try {
      if (typeof Core_Programs !== 'undefined') {
        programsJson = JSON.stringify(Core_Programs.getAll());
      }
    } catch (e) {
      Logger.log('⚠️ Core_Programs.getAll: ' + e.toString());
    }

    const observerNameJs   = JSON.stringify(String(SettingsService.get('observer_name') || 'مشرف مقيم / مراقب'));
    const observerEnabledJs = SettingsService.get('observer_enabled') !== 'false';
    const recordsJson      = JSON.stringify(records);
    const formUrl          = Core_Config.get("OFFICIAL_FORM_URL");
    const officialUrl      = Core_Config.get("OFFICIAL_WEB_APP_URL");

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>بوابة شواهد التقويم والاعتماد المدرسي</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
  <style>
    :root { --primary: #177d82; --primary-dark: #0d4d50; --secondary: #10b981; --bg: #f8fafc; --text: #1e293b; }
    * { box-sizing: border-box; }
    body { font-family: 'Tajawal', sans-serif; background: var(--bg); margin: 0; padding: 15px; color: var(--text); }
    #loginSection { display: flex; justify-content: center; align-items: center; min-height: 85vh; }
    .login-card { background: white; padding: 35px 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); width: 100%; max-width: 440px; text-align: center; border-top: 6px solid var(--primary); }
    .login-title { font-size: 20px; font-weight: 800; color: var(--primary); margin: 10px 0 5px; }
    .login-subtitle { font-size: 13px; color: #64748b; margin-bottom: 25px; }
    .form-group { margin-bottom: 18px; text-align: right; }
    .form-label { display: block; font-size: 13px; font-weight: bold; margin-bottom: 6px; color: #334155; }
    .form-input { width: 100%; padding: 12px 14px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 14.5px; font-family: inherit; outline: none; }
    .form-input:focus { border-color: var(--primary); }
    .btn-submit { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; border: none; width: 100%; padding: 13px; border-radius: 8px; font-size: 16px; font-weight: 800; cursor: pointer; margin-top: 10px; }
    .login-error { color: #e11d48; font-size: 13px; margin-top: 12px; display: none; font-weight: bold; }
    #dashboardSection { display: none; }
    .portal-header { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; padding: 20px 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
    #roleDomainHint.hint-shine {
      font-weight: 800;
      background: linear-gradient(270deg, #ffffff 0%, #fde68a 28%, #5eead4 52%, #ffffff 76%, #fde68a 100%);
      background-size: 220% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: hintSweep 3.4s linear infinite;
    }
    @keyframes hintSweep {
      0% { background-position: 100% 0; }
      100% { background-position: 0% 0; }
    }
    .user-badge { background: rgba(255, 255, 255, 0.15); padding: 6px 14px; border-radius: 20px; font-size: 12.5px; margin-top: 6px; display: inline-block; }
    .portal-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn-nav { background: white; color: var(--primary); padding: 9px 15px; border-radius: 8px; font-weight: bold; font-size: 13px; text-decoration: none; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .btn-nav-primary { background: #38bdf8; color: #082f49; }
    .btn-logout { background: #fee2e2; color: #b91c1c; }
    .btn-purge { background: #ffe4e6; color: #be123c; border: 1px solid #fda4af; }
    .btn-stats { background: #10b981; color: white; }
    .btn-import { background: #8b5cf6; color: white; }
    .btn-batch-print { background: #0284c7; color: white; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin: 18px 0; }
    .stat-card { background: white; padding: 18px; border-radius: 10px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.04); border-top: 4px solid var(--primary); }
    .stat-card .num { font-size: 28px; font-weight: 800; color: var(--primary); margin-top: 4px; }
    .table-box { background: white; border-radius: 10px; overflow-x: auto; box-shadow: 0 2px 6px rgba(0,0,0,0.04); }
    table { width: 100%; border-collapse: collapse; text-align: right; }
    th { background: var(--primary); color: white; padding: 12px 14px; font-size: 13px; }
    td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .btn-pdf { background: var(--secondary); color: white; padding: 6px 12px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 12px; display: inline-block; cursor: pointer; }
    .btn-delete { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 6px 10px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 12px; cursor: pointer; display: inline-block; margin-right: 5px; }
    .btn-edit { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; padding: 6px 10px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 12px; cursor: pointer; display: inline-block; margin-right: 5px; }
    .btn-print-card { background: #0284c7; color: white; padding: 6px 10px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 12px; cursor: pointer; display: inline-block; margin-right: 5px; }
    .modal-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.7); z-index: 9999; justify-content: center; align-items: center; padding: 20px; }
    .modal-box { background: white; border-radius: 12px; width: 100%; max-width: 1100px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }
    .modal-header { background: var(--primary); color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
    .modal-close { background: none; border: none; color: white; font-size: 24px; cursor: pointer; }
    .modal-body { padding: 20px; overflow-y: auto; }
    .guide-domain-block { margin-bottom: 25px; page-break-inside: avoid; break-inside: avoid; }
    .guide-page-header { text-align: center; color: var(--primary); font-size: 15px; font-weight: 800; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 2px solid var(--primary); }
    .guide-domain-title { background: #e6fffa; color: #13666b; padding: 6px 10px; font-size: 13.5px; font-weight: 800; border-radius: 6px; margin: 0 0 6px; border-right: 4px solid var(--primary); }
    .guide-table { width: 100%; margin-bottom: 10px; border-collapse: collapse; }
    .guide-table th { background: #334155; color: white; font-size: 11px; padding: 5px 6px; }
    .guide-table td { border: 1px solid #e2e8f0; font-size: 10.5px; padding: 4px 6px; vertical-align: top; line-height: 1.3; }
    .guide-hints { color: #047857; font-weight: 500; }
    .report-header-print { display: none; text-align: center; margin-bottom: 8px; border-bottom: 2px solid #177d82; padding-bottom: 4px; }
    .stats-box-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-bottom: 12px; }
    .stat-mini-card { background: #f8fafc; border: 1.5px solid #cbd5e1; padding: 8px; border-radius: 8px; text-align: center; }
    .stat-mini-card .val { font-size: 18px; font-weight: 800; color: #177d82; margin-top: 2px; }
    .charts-container { display: flex; flex-direction: row; gap: 15px; margin-bottom: 12px; align-items: stretch; }
    .chart-card { flex: 1; background: #ffffff; border: 1.5px solid #e2e8f0; padding: 10px; border-radius: 10px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .chart-title { font-weight: 800; font-size: 12.5px; color: #177d82; margin-bottom: 6px; }
    .chart-inner-box { width: 100%; max-width: 340px; height: 180px; display: flex; justify-content: center; align-items: center; margin: auto; }
    .two-column-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
    .two-column-table th { background: #177d82; color: white; padding: 8px 10px; font-size: 12px; border: 1px solid #177d82; text-align: center; }
    .two-column-table td { width: 50%; vertical-align: top; padding: 8px 12px; border: 1px solid #cbd5e1; font-size: 10.5px; line-height: 1.6; background: #ffffff; }
    .print-page-1 { page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; }
    .print-page-2 { page-break-before: always; break-before: page; page-break-inside: avoid; break-inside: avoid; }
    @keyframes predictFlash { 0% { background: #d1fae5; } 100% { background: transparent; } }
    .predict-flash { animation: predictFlash 800ms ease; }
    #sigCanvas { width: 100%; height: 180px; touch-action: none; border: 1.5px solid #cbd5e1; border-radius: 8px; background: repeating-conic-gradient(#f8fafc 0% 25%, #e2e8f0 0% 50%) 50% / 16px 16px; cursor: crosshair; }
    .sig-tab { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 8px; padding: 8px 14px; font-family: inherit; font-weight: 700; cursor: pointer; }
    .sig-tab.active { background: #177d82; color: #fff; border-color: #177d82; }
  </style>
</head>

<body>
<div id="loginSection">
  <div class="login-card">
    <div style="font-size: 44px; margin-bottom: 6px;">🏛️</div>
    <div class="login-title">بوابة شواهد التقويم والاعتماد المدرسي</div>
    <div class="login-subtitle">متوسطة سعد بن الربيع الأنصاري | المدينة المنورة</div>
    <div class="form-group" id="teacherLoginBox">
      <label class="form-label">اختر الاسم الكريم:</label>
      <select id="userSelect" class="form-input"><option value="">-- اختر من قائمة منسوبي المدرسة --</option></select>
    </div>
    <button type="button" id="btnShowAdminLogin" onclick="toggleAdminLogin()" style="width:100%; margin:0 0 12px; padding:8px 12px; background:#f1f5f9; color:#0d4d50; border:1px solid #cbd5e1; border-radius:6px; font-weight:bold; cursor:pointer;">🔐 دخول الإدارات والقيادة</button>
    <div id="adminLoginBox" class="form-group" style="display:none;">
      <label class="form-label">الإدارات والقيادة:</label>
      <select id="adminSelect" class="form-input"><option value="">-- اختر من الإدارات والقيادة --</option></select>
    </div>
    <div class="form-group">
      <label class="form-label">رقم السجل المدني (كلمة المرور):</label>
      <input type="password" id="userPass" class="form-input" placeholder="أدخل رقم السجل المدني..." maxlength="10">
    </div>
    <button class="btn-submit" onclick="performLogin()">تسجيل الدخول للمنظومة 🔒</button>
    <div id="loginErr" class="login-error">⚠️ رقم السجل المدني غير متطابق، الرجاء التأكد والمحاولة مجدداً.</div>
  </div>
</div>

<div id="dashboardSection">
  <div class="portal-header">
    <div>
      <h2 id="headerUserName" style="margin: 0 0 4px; font-size: 20px;"></h2>
      <div id="headerUserRole" class="user-badge"></div>
      <button type="button" id="sigStatusChip" onclick="editSignature()" style="display:none; margin-top:8px; border:none; border-radius:999px; padding:4px 10px; font-family:inherit; font-weight:800; font-size:12px; cursor:pointer;"></button>
      <div id="sigReprintNote" style="display:none; margin-top:6px; font-size:12px; line-height:1.5; max-width:420px;">التوقيع المحدّث يظهر في البطاقات التي تُعاد طباعتها. البطاقات المطبوعة سابقاً لا تتغير تلقائياً.</div>
      <button type="button" id="btnReprintMine" class="btn-nav" style="display:none; margin-top:6px;" onclick="reprintMyCards()">إعادة طباعة بطاقاتي</button>
      <span id="roleDomainHint" class="hint-shine" style="display:none; margin-top:6px; font-size:12px;"></span>
    </div>
    <div class="portal-actions">
      <button type="button" class="btn-nav btn-nav-primary" onclick="openUploadModal()">➕ رفع شاهد جديد</button>
      <a id="btnNewEvidence" href="${formUrl}" target="_blank" class="btn-nav">📄 رفع عبر النموذج (احتياطي)</a>
      <button class="btn-nav btn-stats" id="btnOpenStats" onclick="openStatsModal()">📊 لوحة المؤشرات الشاملة</button>
      <button class="btn-nav btn-batch-print" id="btnBatchPrint" onclick="batchPrintAll()">🖨️ طباعة كل البطاقات</button>
      <button class="btn-nav" onclick="openGuideModal()">📖 دليل ETEC</button>
      <button class="btn-nav" onclick="openQrModal()">📱 باركود البوابة (QR)</button>
      <button id="btnImportNur" class="btn-nav btn-import" style="display: none;" onclick="confirmNurImport()">📥 استيراد بيانات المنسوبين</button>
      <button id="btnAdminPurge" class="btn-nav btn-purge" style="display: none;" onclick="confirmPurge()">🗑️ تفريغ التجارب الشامل</button>
      <button class="btn-nav btn-logout" onclick="performLogout()">خروج 🚪</button>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card"><div id="statTitle1">الشواهد المنجزة</div><div class="num" id="statNum1">0</div></div>
    <div class="stat-card"><div>المجالات المغطاة</div><div class="num" id="statNum2">0</div></div>
    <div class="stat-card"><div id="statTitle3">حالة السجل الرقمي</div><div class="num" id="statNum3" style="font-size: 20px; padding-top: 6px; color: #10b981;">معتمد ومكتمل</div></div>
  </div>

  <input type="text" id="searchInput" class="form-input" style="margin-bottom: 15px;" placeholder="🔍 ابحث في الشواهد والمؤشرات..." onkeyup="filterTable()">

  <div class="table-box">
    <table id="evidenceTable">
      <thead><tr><th>#</th><th>اسم الموظف / المنفذ حصرياً</th><th>الفترة</th><th>المجال</th><th>المؤشر</th><th>الإجراء المنفذ</th><th>الإجراءات والبطاقة (PDF)</th></tr></thead>
      <tbody id="tableBody"></tbody>
    </table>
  </div>
</div>

<div id="viewerModal" class="modal-overlay" onclick="closeViewerOnOverlay(event)">
  <div class="modal-box" style="max-width: 95vw; height: 92vh;">
    <div class="modal-header">
      <h3 id="viewerTitle" style="margin:0; font-size:16px;">📄 معاينة المستند والشاهد داخل البوابة</h3>
      <button class="modal-close" onclick="closeViewerModal()">✕</button>
    </div>
    <div class="modal-body" style="padding: 0; height: 100%; display: flex; flex-direction: column; overflow: auto; background: #e2e8f0;">
      <iframe id="viewerFrame" src=""
              style="width: 100%; height: 100%; border: none; flex-grow: 1;"
              allow="autoplay; encrypted-media"
              allowfullscreen></iframe>
    </div>
  </div>
</div>

<div id="statsModal" class="modal-overlay" onclick="closeModalOnOverlay(event)">
    <div class="modal-box" style="max-width: 1100px; position: relative;">
    <div class="modal-header">
      <h3 style="margin:0; font-size:17px;">📊 لوحة المؤشرات والتحليلات الشاملة للاعتماد المدرسي</h3>
      <button class="modal-close" onclick="closeStatsModal()">✕</button>
    </div>
    <div id="domainEvidencePanel" style="display:none; position:absolute; inset:0; background:#fff; z-index:6; overflow:auto; border-radius:12px;">
      <div style="position:sticky; top:0; background:#177d82; color:#fff; padding:14px 16px; display:flex; justify-content:space-between; align-items:center;">
        <h3 id="domainEvidenceTitle" style="margin:0; font-size:16px;"></h3>
        <button type="button" class="btn-nav" style="background:#fff; color:#0d4d50;" onclick="closeDomainEvidence()">رجوع إلى اللوحة</button>
      </div>
      <div id="domainEvidenceBody" style="padding:16px;"></div>
    </div>
    <div class="modal-body" id="statsPrintArea">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;" class="no-print">
        <div style="display:flex; gap: 8px;">
          <button class="btn-nav btn-nav-primary" onclick="printStatsReport()">🖨️ طباعة التقرير / حفظ PDF</button>
          <button class="btn-nav" style="background:#10b981; color:white;" onclick="exportToExcel()">📥 تصدير إلى Excel</button>
          <button class="btn-nav" style="background:#0284c7; color:white;" onclick="refreshLiveData()">🔄 تحديث البيانات</button>
        </div>
        <div style="font-size: 12.5px; color: #64748b;" id="lastSyncTime">التحديث التلقائي مفعل</div>
      </div>

      <div class="print-page-1">
        <div class="report-header-print">
          <div style="font-weight: bold; font-size: 12.5px;">المملكة العربية السعودية | وزارة التعليم</div>
          <div style="font-weight: bold; font-size: 11.5px;">الإدارة العامة للتعليم بمنطقة المدينة المنورة - متوسطة سعد بن الربيع الأنصاري</div>
          <h3 style="margin: 4px 0 0; color: #177d82; font-size: 14px;">التقرير البياني الإحصائي لشواهد الاعتماد المدرسي (الصفحة 1 من 2)</h3>
        </div>
        <div class="stats-box-grid" id="statsCardsContainer"></div>
        <div class="charts-container">
          <div class="chart-card">
            <div class="chart-title">📈 إنجاز المجالات (مقارنة بالمؤشرات المطلوبة)</div>
            <div class="chart-inner-box"><canvas id="domainsBarChart"></canvas></div>
          </div>
          <div class="chart-card">
            <div class="chart-title">🍩 نسبة مشاركة المعلمين بالمدرسة</div>
            <div class="chart-inner-box"><canvas id="teachersPieChart"></canvas></div>
          </div>
        </div>
        <h4 style="margin: 10px 0 5px; color: #177d82; border-right: 4px solid #177d82; padding-right: 8px; font-size:13px;">📌 جدول تفاصيل نسب إنجاز المعايير للمجالات الأربعة:</h4>
        <div class="table-box" style="margin-bottom: 5px;">
          <table class="guide-table">
            <thead><tr><th>مجال التقويم</th><th>إجمالي المؤشرات المطلوبة</th><th>المؤشرات المغطاة</th><th>نسبة الإنجاز</th></tr></thead>
            <tbody id="domainsStatsBody"></tbody>
          </table>
        </div>
      </div>

      <div class="print-page-2">
        <div class="report-header-print">
          <div style="font-weight: bold; font-size: 12.5px;">المملكة العربية السعودية | وزارة التعليم</div>
          <div style="font-weight: bold; font-size: 11.5px;">الإدارة العامة للتعليم بمنطقة المدينة المنورة - متوسطة سعد بن الربيع الأنصاري</div>
          <h3 style="margin: 4px 0 0; color: #177d82; font-size: 14px;">تقرير موقف مشاركة منسوبي المدرسة (الصفحة 2 من 2)</h3>
        </div>
        <h4 style="margin: 2px 0 8px; color: #177d82; border-right: 4px solid #177d82; padding-right: 8px; font-size:13px;">👥 موقف مشاركة منسوبي المدرسة بالتفصيل:</h4>
        <table class="two-column-table">
          <thead>
            <tr>
              <th>⏳ بانتظار المشاركة (<span id="pendingStaffCount">0</span>)</th>
              <th>✅ المشاركون (<span id="activeStaffCount">0</span>)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td id="pendingStaffList"></td><td id="activeStaffList"></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<div id="guideModal" class="modal-overlay" onclick="closeModalOnOverlay(event)">
  <div class="modal-box" style="max-width: 1000px;">
    <div class="modal-header">
      <h3 style="margin:0; font-size:17px;">📖 الدليل الاسترشادي لشواهد الاعتماد المدرسي (ETEC)</h3>
      <button class="modal-close" onclick="closeGuideModal()">✕</button>
    </div>
    <div class="modal-body" id="guidePrintArea">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;" class="no-print">
        <button class="btn-nav btn-nav-primary" onclick="printGuideReport()">🖨️ طباعة الدليل / حفظ كـ PDF</button>
      </div>
      <div id="guideContent"></div>
    </div>
  </div>
</div>

<div id="qrModal" class="modal-overlay" onclick="closeModalOnOverlay(event)">
  <div class="modal-box" style="max-width: 440px; text-align: center;">
    <div class="modal-header">
      <h3 style="margin:0; font-size:16px;">📱 رمز الدخول المباشر للبوابة (QR Code)</h3>
      <button class="modal-close" onclick="closeQrModal()">✕</button>
    </div>
    <div class="modal-body" style="padding: 25px;">
      <div id="printableQrArea" style="background: white; padding: 15px; border-radius: 10px; border: 1.5px dashed #cbd5e1;">
        <div style="font-weight: 800; font-size: 16px; color: #177d82; margin-bottom: 4px;">متوسطة سعد بن الربيع الأنصاري</div>
        <div style="font-size: 13px; color: #64748b; margin-bottom: 12px;">بوابة توثيق شواهد التقويم والاعتماد المدرسي</div>
        <img id="qrImgDirect" src="" alt="QR Code" style="width: 230px; height: 230px; border-radius: 8px; margin: auto; display: block; border: 1px solid #e2e8f0; padding: 6px;">
        <div style="font-weight: 800; color: #0d4d50; margin-top: 12px; font-size: 14px;">امسح الكود بكاميرا الجوال للدخول المباشر</div>
        <div style="font-size: 11.5px; color: #94a3b8; margin-top: 3px;">الدخول متاح برقم السجل المدني</div>
      </div>
      <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: center;">
        <a id="btnDirectPortalLink" href="${officialUrl}" target="_blank" style="background: #177d82; color: white; padding: 8px 14px; border-radius: 6px; font-size: 12.5px; font-weight: bold; text-decoration: none;">فتح الرابط مباشرة ↗</a>
        <button onclick="printQrCard()" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 6px; font-size: 12.5px; font-weight: bold; cursor: pointer;">🖨️ طباعة بطاقة الباركود</button>
      </div>
    </div>
  </div>
</div>
<div id="uploadModal" class="modal-overlay" onclick="closeUploadOnOverlay(event)">
  <div class="modal-box" style="max-width: 720px;">
    <div class="modal-header">
      <h3 id="upModalTitle" style="margin:0; font-size:17px;">➕ رفع شاهد جديد</h3>
      <button type="button" class="modal-close" onclick="closeUploadModal()">✕</button>
    </div>
    <div class="modal-body" style="padding: 18px 20px; overflow: auto;">
      <div id="upFormBody">
      <div class="form-group">
        <label class="form-label">الفترة</label>
        <select id="upPeriod" class="form-input">
          <option value="">-- اختر الفترة --</option>
          <option value="الفصل الدراسي الأول">الفصل الدراسي الأول</option>
          <option value="الفصل الدراسي الثاني">الفصل الدراسي الثاني</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">البرنامج المنفذ</label>
        <select id="upProgram" class="form-input" onchange="onUploadProgramChange()"></select>
      </div>
      <div class="form-group" id="upOtherWrap" style="display:none;">
        <label class="form-label">اسم البرنامج غير المدرج</label>
        <input id="upOtherName" class="form-input" maxlength="200" placeholder="اكتب اسم البرنامج كما سيظهر في البطاقة">
      </div>
      <div id="upPlaceSentence" style="display:none; margin:0 0 8px; padding:10px 12px; background:#f0fdfa; border:1px solid #99f6e4; border-radius:8px; color:#0d4d50; font-weight:800; font-size:13.5px;"></div>
      <div id="upPlaceGuide" style="display:none; margin:0 0 12px; font-size:12px; line-height:1.7; color:#334155;"></div>
      <button type="button" id="upChangeIndicator" class="btn-nav" style="display:none; margin:0 0 12px;" onclick="showIndicatorChoices()">تغيير المؤشر</button>
      <div id="upPlaceFields">
      <div class="form-group">
        <label class="form-label">المجال</label>
        <select id="upDomain" class="form-input" onchange="onUploadDomainChange()"></select>
      </div>
      <div class="form-group">
        <label class="form-label">المؤشر المستهدف</label>
        <select id="upIndicator" class="form-input" onchange="refreshPlaceSentence()"></select>
      </div>
      </div>
      <div class="form-group">
        <label class="form-label">عنوان الإجراء</label>
        <input id="upActionTitle" class="form-input" maxlength="200">
      </div>
      <div class="form-group">
        <label class="form-label">وصف الإجراء</label>
        <textarea id="upActionDesc" class="form-input" maxlength="500" rows="4"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">الأثر المتحقق</label>
        <textarea id="upImpact" class="form-input" maxlength="300" rows="3"></textarea>
      </div>
      <div id="upDraftHint" style="font-size:12.5px;color:#0d4d50;font-weight:700;margin:-6px 0 12px;"></div>
      <div class="form-group">
        <label class="form-label">الصف الدراسي المستهدف</label>
        <select id="upGrade" class="form-input">
          <option value="">-- اختر الصف --</option>
          <option value="الأول المتوسط">الأول المتوسط</option>
          <option value="الثاني المتوسط">الثاني المتوسط</option>
          <option value="الثالث المتوسط">الثالث المتوسط</option>
          <option value="المرحلة المتوسطة">المرحلة المتوسطة (جميع الصفوف)</option>
          <option value="المجتمع المدرسي / المحلي">المجتمع المدرسي / المحلي</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">الشاهد الأول (إلزامي)</label>
        <div id="upDrop1" style="border: 1.5px dashed #94a3b8; border-radius: 8px; padding: 16px; text-align: center; background: #f8fafc;">اسحب الملف هنا أو انقر للاختيار. الحد 20 MB. يدعم: صور، PDF، Word، PowerPoint</div>
        <input id="upEv1" type="file" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" style="display:none;">
        <div id="upEv1Name" style="font-size: 12px; margin-top: 6px;"></div>
        <div style="height: 8px; background: #e2e8f0; border-radius: 4px; margin-top: 6px;"><div id="upEv1Bar" style="height: 8px; width: 0; background: #177d82; border-radius: 4px;"></div></div>
      </div>
      <div class="form-group">
        <label class="form-label">الشاهد الثاني (اختياري)</label>
        <div id="upDrop2" style="border: 1.5px dashed #94a3b8; border-radius: 8px; padding: 16px; text-align: center; background: #f8fafc;">اسحب الملف هنا أو انقر للاختيار. الحد 20 MB. يدعم: صور، PDF، Word، PowerPoint</div>
        <input id="upEv2" type="file" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" style="display:none;">
        <div id="upEv2Name" style="font-size: 12px; margin-top: 6px;"></div>
        <div style="height: 8px; background: #e2e8f0; border-radius: 4px; margin-top: 6px;"><div id="upEv2Bar" style="height: 8px; width: 0; background: #177d82; border-radius: 4px;"></div></div>
      </div>
      <div class="form-group">
        <label class="form-label">معتمد التقرير</label>
        <label style="display:block; margin-bottom: 6px;"><input type="radio" name="upApprover" value="وكيل المعلمين"> وكيل المعلمين</label>
        <label style="display:block;"><input type="radio" name="upApprover" value="وكيل الطلاب"> وكيل الطلاب</label>
      </div>
      <div id="upSaveMsg" style="min-height:18px; font-size:13px; color:#b45309; margin-bottom:8px;"></div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button type="button" class="btn-nav" onclick="closeUploadModal()">إلغاء</button>
        <button type="button" id="upSubmitBtn" class="btn-nav btn-nav-primary" onclick="prepareEvidenceSubmit()">حفظ ورفع الشاهد</button>
      </div>
      </div>
      <div id="upSuccessBody" style="display:none; text-align:center; padding:18px 8px 8px;">
        <div style="font-size:18px; font-weight:800; color:#0d4d50;">تم تسجيل الشاهد</div>
        <div id="upSuccessRow" style="margin:12px 0 18px; font-size:15px; color:#334155;"></div>
        <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
          <button type="button" class="btn-nav btn-nav-primary" onclick="resetUploadForm()">رفع شاهد آخر</button>
          <button type="button" class="btn-nav" onclick="closeUploadModal()">إغلاق والعودة للقائمة</button>
        </div>
      </div>
    </div>
  </div>
</div>
<div id="signature-modal" class="modal-overlay" style="z-index:10001;">
  <div class="modal-box" style="max-width:640px;">
    <div class="modal-header">
      <h3 style="margin:0; font-size:17px;">توقيعك المعتمد</h3>
    </div>
    <div class="modal-body" style="padding:18px 20px;">
      <p style="margin:0 0 12px; font-size:13px; color:#475569;">الحفظ يستبدل التوقيع السابق ويظهر في خانة المنفذ على بطاقاتك.</p>
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <button type="button" id="sigTabDraw" class="sig-tab active" onclick="setSigTab('draw')">رسم يدوي</button>
        <button type="button" id="sigTabFile" class="sig-tab" onclick="setSigTab('file')">رفع صورة</button>
      </div>
      <canvas id="sigCanvas"></canvas>
      <div id="sigFilePane" style="display:none; margin-top:10px;">
        <input id="sigFile" type="file" accept="image/*" class="form-input">
      </div>
      <label style="display:block; margin:12px 0; font-size:13.5px; font-weight:700;">
        <input type="checkbox" id="sigAck"> أقر بأن هذا توقيعي الرسمي
      </label>
      <div id="sigMsg" style="min-height:18px; font-size:12.5px; color:#b45309; margin-bottom:8px;"></div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button type="button" class="btn-nav" onclick="clearSignaturePad()">مسح</button>
        <button type="button" class="btn-nav" onclick="dismissSignatureLater()">لاحقاً</button>
        <button type="button" id="sigSaveBtn" class="btn-nav btn-nav-primary" onclick="saveSignaturePad()">حفظ التوقيع</button>
      </div>
    </div>
  </div>
</div>
<script>
  const staffList = ${staffJson};
  const adminList = ${adminJson};
  const roleDomains = ${roleDomainsJson};
  let _programsCache = null;
  let _indicatorsCache = {};

  // ⚠️ هذا المنطق مطابق لـ Core_RoleDomains._matchRoleId (خادم).
  // عند تعديل أحدهما، يجب تعديل الآخر.
  function matchRoleIdClient(role) {
    const r = String(role || '').replace(/\s+/g, ' ').trim();
    if (!r) return '';
    if (r.indexOf('موهوب') !== -1) return 'giftedTeacher';
    if (r.indexOf('مختبر') !== -1) return 'labTechnician';
    if (r.indexOf('مصادر') !== -1) return 'resourcesClerk';
    if (r.indexOf('صحي') !== -1) return 'healthGuide';
    if (r.indexOf('رائد') !== -1 || r.indexOf('نشاط') !== -1) return 'activityLeader';
    if (r.indexOf('موجه') !== -1 || r.indexOf('مرشد') !== -1) return 'counselor';
    if (r.indexOf('وكيل') !== -1 && r.indexOf('تعليم') !== -1) return 'educationalVice';
    if (r.indexOf('وكيل') !== -1 && (r.indexOf('طلاب') !== -1 || r.indexOf('طلبة') !== -1)) return 'studentVice';
    if (r.indexOf('وكيل') !== -1 && r.indexOf('مدرس') !== -1) return 'schoolVice';
    if (r.indexOf('سكرتير') !== -1 || r.indexOf('إداري') !== -1) return 'secretary';
    if (r.indexOf('تقويم') !== -1) return 'evaluationLead';
    if (r.indexOf('مدير') !== -1) return 'principal';
    if (r.indexOf('معلم') !== -1) return 'teacher';
    return '';
  }

  function getDomainsForRoleClient(role) {
    if (!roleDomains || !roleDomains.roles) return null;
    const roleId = matchRoleIdClient(role);
    if (!roleId) return null;
    const entry = roleDomains.roles[roleId];
    if (!entry) return null;
    return {
      matched: true,
      label: entry.label,
      recommended: entry.recommended,
      domainNames: roleDomains.domainNames || {}
    };
  }

  const observerName = ${observerNameJs};
  const observerEnabled = ${observerEnabledJs};
  let allRecords = ${recordsJson};
  const guideData = ${guideJson};

  // ═══════════════════════════════════════════════════════════════
  // منطق رفع الشواهد من الواجهة
  // ═══════════════════════════════════════════════════════════════
  const programsCatalog = ${programsJson};
  const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
  const UPLOAD_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];
  const uploadFiles = { ev1: null, ev2: null };
  let editingRowIndex = 0;

  // ⚠️ مطابق لـ Core_Programs.AUDIENCE_BY_ROLE. عند تعديل أحدهما، عدّل الآخر.
  const UPLOAD_AUDIENCE = {
    teacher: 'teacher',
    giftedTeacher: 'gifted_teacher',
    counselor: 'counselor',
    activityLeader: 'activity_leader',
    principal: 'leaders',
    educationalVice: 'leaders',
    studentVice: 'leaders',
    schoolVice: 'leaders',
    secretary: 'leaders',
    evaluationLead: 'leaders',
    healthGuide: 'healthGuide',
    resourcesClerk: 'resourcesClerk',
    labTechnician: 'labTechnician'
  };

  function programsForCurrentUser() {
    const roleId = currentUser ? matchRoleIdClient(currentUser.role) : '';
    const audience = UPLOAD_AUDIENCE[roleId] || '';
    return (programsCatalog || []).filter(function (program) {
      return program.audience === 'all' || program.audience === audience || program.audience === roleId;
    });
  }

  function fillUploadPrograms() {
    const select = document.getElementById('upProgram');
    if (!_programsCache) {
      const programs = programsForCurrentUser();
      let html = '<option value="">-- اختر البرنامج --</option>';
      programs.forEach(function (program) {
        html += '<option value="' + program.id + '" data-domain="' + (program.domain || '') + '">' + program.name + '</option>';
      });
      html += '<option value="__OTHER__">برنامج آخر (غير مدرج)</option>';
      _programsCache = html;
    }
    select.innerHTML = _programsCache;
  }

  function domainLabelFromCode(code) {
    if (!code || code === 'general') return 'عام';
    const names = roleDomains && roleDomains.domainNames ? roleDomains.domainNames : {};
    return names[code] || code;
  }

  function fillUploadIndicators(domainCode) {
    const select = document.getElementById('upIndicator');
    const key = domainCode || '';
    if (!_indicatorsCache[key]) {
      let html = '<option value="">-- اختر المؤشر --</option>';
      (guideData || []).forEach(function (group) {
        const groupCode = String(group.domain || '').substring(0, 2);
        if (domainCode && domainCode !== 'general' && groupCode !== domainCode) return;
        (group.indicators || []).forEach(function (indicator) {
          html += '<option value="(' + indicator.code + ') ' + indicator.name + '">' + indicator.code + ' — ' + indicator.name + '</option>';
        });
      });
      _indicatorsCache[key] = html;
    }
    select.innerHTML = _indicatorsCache[key];
  }

  const SmartPredictor = (function () {
    function pack(indicatorCode, title, description, impact) {
      return { indicatorCode: indicatorCode, templates: { title: title, description: description, impact: impact } };
    }
    const RULES = {
      PROG_005: pack('1-4-1-5',
        'تنفيذ برنامج التطوير المهني المستمر لمنسوبي المدرسة',
        'نُفّذ برنامج التطوير المهني بتاريخ ____ بمشاركة ____ من المنسوبين، بناءً على الاحتياج التدريبي المحدد من نتائج التقويم الذاتي. شمل البرنامج ورشاً تطبيقية في مجال ____.',
        'بلغت نسبة حضور المنسوبين ____٪، وطبّق ____ منهم الممارسات المستهدفة داخل الصفوف وفق متابعة أُجريت بتاريخ ____.'),
      PROG_006: pack('1-4-1-5',
        'تفعيل مجتمع التعلم المهني لمنسوبي المدرسة',
        'عُقد مجتمع التعلم المهني بتاريخ ____ بمشاركة ____ من المعلمين، حول ممارسة تعليمية حدّدها الاحتياج: ____. اتُفق على تطبيق الممارسة داخل الصف، ثم مناقشة أثرها في لقاء المتابعة.',
        'طبّق ____ من المشاركين الممارسة المتفق عليها، ونُوقش أثرها في لقاء بتاريخ ____.'),
      PROG_007: pack('1-4-1-5',
        'تنفيذ بحث إجرائي لتحسين عملية التعليم',
        'أُجري البحث الإجرائي في صف ____ خلال الفترة ____ حول المشكلة: ____. جُمعت البيانات بأداة ____، وحُلّلت النتائج لتطوير الممارسة الصفية.',
        'كانت النتيجة قبل المعالجة ____، وبعدها ____. القرار المعتمد لتحسين الممارسة: ____.'),
      PROG_008: pack('2-2-1-1',
        'تطبيق التقويم التكويني لمتابعة نواتج التعلم',
        'نُفّذ التقويم التكويني في صف ____ خلال ____. استُخدمت الأدوات: ____، وقُدمت تغذية راجعة لـ ____ طالباً.',
        'أتمّ ____ طالباً المهمة. تحسّن ____ طالباً مقارنة بالتشخيص القبلي، وبقي ____ ضمن خطة المعالجة.'),
      PROG_009: pack('2-1-1-7',
        'تنمية مهارات التفكير لدى المتعلمين',
        'نُفّذت أنشطة تنمية التفكير في صف ____ بتاريخ ____، واستهدفت مهارة ____. شارك ____ طالباً، ونُفذت المهمة بأسلوب ____.',
        'أظهر ____ طالباً المهارة في المهمة الختامية، وأُحيل ____ طالباً إلى نشاط دعم خلال ____.'),
      PROG_031: pack('2-1-1-2', 'تنفيذ المنهج وتوزيعه', 'وُزّع منهج ____ للصف ____ بتاريخ ____. التغطية حتى ____ موثقة في سجل التنفيذ.', 'نُفذت ____ وحدة من ____ وفق سجل التغطية.'),
      PROG_032: pack('2-1-1-3', 'تطبيق استراتيجية في الحصة', 'طُبقت استراتيجية ____ في صف ____ بتاريخ ____. التحضير وصورة التنفيذ بلا وجوه موثقان.', 'شارك ____ طالباً، وظهر الفهم في ____.'),
      PROG_033: pack('2-1-1-4', 'حصة باستخدام التقنية', 'نُفذت الحصة عبر ____ في صف ____ بتاريخ ____. اللقطة من المنصة مرفقة.', 'استخدم الأداة ____ طالباً من ____.'),
      PROG_034: pack('2-1-1-6', 'مهارة قرائية أو عددية', 'نُفذت مهارة ____ في صف ____ بتاريخ ____. القياس قبل ____ وبعد ____.', 'بلغ المتمكنون ____ من ____ وفق السجل.'),
      PROG_035: pack('2-2-1-2', 'تحليل نتائج ومعالجة', 'حُللت نتائج ____ بتاريخ ____. الإجراء للمتعثرين: ____ وللموهوبين: ____.', 'انتقل ____ طالباً من مستوى ____ إلى ____.'),
      PROG_036: pack('2-2-1-3', 'تغذية راجعة لولي الأمر', 'أُرسلت التغذية عن ____ بتاريخ ____ لـ ____ ولي أمر، بعد حجب البيانات الحساسة.', 'ردّ أو حضر ____ ولي أمر، ووُثق في سجل التواصل.'),
      PROG_037: pack('2-1-1-9', 'تحفيز الطلاب', 'مُنح حافز ____ في صف ____ بتاريخ ____ لـ ____ طالباً.', 'تكرر الالتزام لدى ____ طالباً وفق السجل.'),
      PROG_038: pack('1-1-1-1', 'الخطة التشغيلية', 'اعتُمدت الخطة التشغيلية بتاريخ ____ وتشمل الأهداف والبرامج والمسؤولين.', 'اعتمدها قائد المدرسة، ووُثقت في ملف الخطة.'),
      PROG_039: pack('1-1-1-2', 'متابعة تنفيذ الخطة', 'رُوجعت الخطة بتاريخ ____. المنجز: ____ والمتعثّر: ____.', 'صدر قرار تحديث: ____.'),
      PROG_040: pack('1-3-1-1', 'اللجان ومحاضر المجلس', 'عُقد الاجتماع بتاريخ ____ بحضور ____. القرار: ____.', 'كُلّف ____ بالمتابعة حتى ____.'),
      PROG_041: pack('2-1-1-2', 'توزيع الأنصبة والجداول', 'وُزعت الأنصبة والجداول بتاريخ ____ وفق بيانات نور.', 'اكتمل الإسناد لـ ____ معلماً.'),
      PROG_042: pack('2-1-1-3', 'الزيارات الصفية', 'نُفذت زيارة لـ ____ بتاريخ ____ في صف ____. التغذية الراجعة مكتوبة.', 'الاتفاق التالي: ____ وموعده ____.'),
      PROG_043: pack('1-4-1-5', 'متابعة مجتمعات التعلم', 'رُوجع محضر مجتمع التعلم بتاريخ ____ لـ ____ معلماً.', 'طُبقت الممارسة لدى ____ وفق المتابعة.'),
      PROG_044: pack('3-2-1-4', 'المواظبة والغياب', 'رُصد الغياب للفترة ____. الغياب: ____ والتأخر: ____.', 'انخفض الغياب إلى ____ بعد الإجراء ____.'),
      PROG_045: pack('1-2-1-3', 'السلوك والإجراءات', 'عُولجت مخالفة ____ بتاريخ ____ وفق لائحة السلوك.', 'أُغلق الموقف بتاريخ ____.'),
      PROG_046: pack('1-3-1-2', 'التواصل مع الأسرة', 'تم التواصل مع ____ ولي أمر بتاريخ ____ بخصوص ____.', 'النتيجة: ____ ووُثقت في السجل.'),
      PROG_047: pack('4-2-1-2', 'صيانة المرافق', 'طُلب إصلاح ____ بتاريخ ____. حالة الإنجاز: ____.', 'أُغلق ____ طلباً من ____.'),
      PROG_048: pack('4-2-1-1', 'سلامة المبنى', 'فُقدت مواقع السلامة بتاريخ ____. الملاحظات: ____.', 'عُولجت ____ ملاحظة من ____.'),
      PROG_049: pack('4-2-1-3', 'النظافة والبيئة المدرسية', 'تُوبعت النظافة بتاريخ ____ في ____.', 'الملاحظات المغلقة: ____ من ____.'),
      PROG_050: pack('3-2-1-3', 'خطة النشاط وسجل التنفيذ', 'نُفذ نشاط ____ بتاريخ ____ بمشاركة ____ طالباً.', 'الشاهد: ____ في سجل النشاط المعتمد.'),
      PROG_051: pack('1-2-1-4', 'رعاية الحالات الطلابية', 'تُوبعت حالة ____ بتاريخ ____ وفق خطة تعديل السلوك، دون كشف الاسم في الشاهد.', 'حالة التحسن: ____.'),
      PROG_052: pack('3-2-1-2', 'البرامج الصحية المدرسية', 'نُفذ برنامج ____ بتاريخ ____ للمستهدفين ____.', 'شارك ____، والإجراء التالي ____.'),
      PROG_053: pack('2-1-1-2', 'مصادر التعلم ودعم المنهج', 'استُخدم مركز المصادر بتاريخ ____ للصف ____ في موضوع ____.', 'عدد الزيارات أو الاستعارات: ____.'),
      PROG_054: pack('2-1-1-5', 'تجارب المختبر وسلامته', 'نُفذت تجربة ____ للصف ____ بتاريخ ____ مع إجراءات السلامة.', 'شارك ____ طالباً، والهدف المتحقق: ____.'),
      PROG_055: pack('1-1-1-2', 'الصادر والوارد والأرشيف', 'سُجّلت معاملة ____ بتاريخ ____ في الصادر/الوارد.', 'أُرشفت وأُغلق الإجراء بتاريخ ____.')
    };
    function get(programId) { return RULES[programId] || null; }
    return { get: get };
  })();

  let uploadDraftStamp = { title: '', description: '', impact: '' };

  function domainCodeFromIndicator(code) {
    const digit = String(code || '').charAt(0);
    if (digit === '1') return '01';
    if (digit === '2') return '02';
    if (digit === '3') return '03';
    if (digit === '4') return '04';
    return '';
  }

  function renderDomainSelect(selectedCode, locked) {
    const select = document.getElementById('upDomain');
    const names = (roleDomains && roleDomains.domainNames) ? roleDomains.domainNames : {};
    let html = '<option value="">-- اختر المجال --</option>';
    ['01', '02', '03', '04'].forEach(function (code) {
      const label = names[code] || domainLabelFromCode(code);
      html += '<option value="' + label + '" data-code="' + code + '">' + label + '</option>';
    });
    if (selectedCode === 'general') html += '<option value="عام" data-code="general">عام</option>';
    select.innerHTML = html;
    if (selectedCode === 'general') select.value = 'عام';
    else if (selectedCode) select.value = names[selectedCode] || domainLabelFromCode(selectedCode);
    else select.value = '';
    select.disabled = !!locked;
  }

  function applyDraft(elementId, text, stampKey) {
    const el = document.getElementById(elementId);
    const previous = uploadDraftStamp[stampKey];
    if (el.value && el.value !== previous) return false;
    el.value = text;
    uploadDraftStamp[stampKey] = text;
    return true;
  }

  function selectIndicatorByCode(code) {
    const select = document.getElementById('upIndicator');
    const needle = '(' + code + ')';
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value.indexOf(needle) === 0) {
        select.selectedIndex = i;
        return;
      }
    }
  }

  function flashFields(ids) {
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('predict-flash');
      void el.offsetWidth;
      el.classList.add('predict-flash');
    });
  }

  function prepareEvidenceSubmit() {
    const select = document.getElementById('upProgram');
    if (select.value === '__OTHER__') {
      const name = document.getElementById('upOtherName').value.trim();
      if (!name) {
        alert('اكتب اسم البرنامج غير المدرج.');
        return;
      }
      const option = select.querySelector('option[value="__OTHER__"]');
      if (option) option.textContent = name;
    }
    submitEvidence();
  }

  function onUploadDomainChange() {
    if (document.getElementById('upProgram').value !== '__OTHER__') return;
    const select = document.getElementById('upDomain');
    const option = select.options[select.selectedIndex];
    fillUploadIndicators(option ? (option.getAttribute('data-code') || '') : '');
  }

  function showPlaceGuide(programId) {
    const box = document.getElementById('upPlaceGuide');
    const GUIDE = {
      PROG_005: {
        examples: 'شهادة دورة، مشهد حضور، خطة تطوير فردية، تقرير أثر التدريب.',
        proof: 'يثبته تقرير أثر التدريب، أو الشهادة مع تطبيق داخل الصف. الشهادة وحدها لا تُحتسب.'
      },
      PROG_006: {
        examples: 'محضر مجتمع تعلم، اتفاق التخصص، متابعة الزملاء، سجل زيارة تبادلية.',
        proof: 'يثبته محضر الاجتماع أو التغذية الراجعة المكتوبة بعد الزيارة.'
      },
      PROG_007: {
        examples: 'وصف المشكلة، أداة الجمع، نتيجة قبل وبعد، قرار التحسين.',
        proof: 'يثبته نموذج البحث موقعاً ومؤرخاً، لا فكرة بلا نتيجة.'
      },
      PROG_008: {
        examples: 'اختبار قصير، سلم تقدير، عينة إجابات، تغذية راجعة.',
        proof: 'يثبته نموذج التقويم وعينة الإجابات، لا صورة النشاط وحدها.'
      },
      PROG_009: {
        examples: 'نشاط تفكير، سؤال مفتوح، منتج طلابي، نموذج المهمة.',
        proof: 'يثبته نموذج المهمة وعدد من أنجز المهارة.'
      },
      PROG_031: { examples: 'توزيع المنهج، خطة الوحدة، سجل تغطية الدروس.', proof: 'يثبته التوزيع أو سجل التغطية، لا صورة الغلاف وحدها.' },
      PROG_032: { examples: 'تحضير الحصة، صورة السبورة، ورقة المجموعات.', proof: 'يثبته التحضير المطبَّق أو صورة التنفيذ بلا وجوه.' },
      PROG_033: { examples: 'لقطة من مدرستي، اختبار إلكتروني، أداة رقمية.', proof: 'يثبته أثر الاستخدام في الحصة لا مجرد وجود الحساب.' },
      PROG_034: { examples: 'قراءة حرة، إملاء، معالجة فاقد، مسابقة حساب.', proof: 'يثبته قياس قبل وبعد في سجل المهارة.' },
      PROG_035: { examples: 'جدول مقارنة، خطة علاجية، خطة إثرائية.', proof: 'يثبته التحليل ثم الإجراء، لا الجدول وحده.' },
      PROG_036: { examples: 'رسالة لولي الأمر، تقرير مستوى، محضر اجتماع.', proof: 'يثبته نموذج التواصل بعد حجب الأسماء.' },
      PROG_037: { examples: 'شهادة تقدير، لوحة تميز، حافز صفي.', proof: 'يثبته السجل أو الشهادة، لا صورة الحفل وحدها.' },
      PROG_038: { examples: 'وثيقة الخطة المعتمدة: أهداف، برامج، مؤشرات، مسؤولون.', proof: 'يثبته اعتماد القائد، لا مسودة بلا توقيع.' },
      PROG_039: { examples: 'سجل المتابعة، محضر التحديث، قرار المعالجة.', proof: 'يثبته ما نُفّذ وما تغيّر، لا الخطة وحدها.' },
      PROG_040: { examples: 'محضر مجلس، تكليف لجنة، قرار موثّق.', proof: 'يثبته المحضر الموقع بتاريخه.' },
      PROG_041: { examples: 'جدول أنصبة، جدول حصص، إسناد من نور.', proof: 'يثبته الجدول المعتمد للعام الحالي.' },
      PROG_042: { examples: 'خطة زيارات، بطاقة ملاحظة، تغذية راجعة مكتوبة.', proof: 'يثبته الاتفاق بعد الزيارة لا كشف الحضور.' },
      PROG_043: { examples: 'محاضر PLC، متابعة تطبيق المعلمين.', proof: 'يثبته المحضر ثم أثر التطبيق.' },
      PROG_044: { examples: 'سجل غياب يومي أو شهري، متابعة تأخر.', proof: 'يثبته السجل وإجراء المعالجة.' },
      PROG_045: { examples: 'سجل مخالفة، إجراء وفق اللائحة، إغلاق الموقف.', proof: 'يثبته الإجراء الموقع لا الوصف الشفهي.' },
      PROG_046: { examples: 'رسائل، اجتماعات، إشعارات بعد حجب الأسماء.', proof: 'يثبته سجل التواصل وتاريخه.' },
      PROG_047: { examples: 'جدول صيانة، طلب إصلاح، إغلاق الطلب.', proof: 'يثبته السجل لا صورة العطل وحدها.' },
      PROG_048: { examples: 'تفقد مرافق، مخاطر، إجراء وقائي.', proof: 'يثبته سجل السلامة للعام الحالي.' },
      PROG_049: { examples: 'سجل نظافة، متابعة مرافق، ملاحظات مغلقة.', proof: 'يثبته السجل الدوري لا صورة واحدة.' },
      PROG_050: { examples: 'خطة نشاط معتمدة، صور تنفيذ، تقرير مشاركة.', proof: 'يثبته التنفيذ لا الخطة بلا شاهد.' },
      PROG_051: { examples: 'خطة تعديل سلوك، متابعة حالة دون كشف الاسم.', proof: 'يثبته التحسن في السجل لا وصف الحالة.' },
      PROG_052: { examples: 'خطة صحية، تنفيذ توعية أو فحص، تنسيق مع مركز صحي.', proof: 'يثبته سجل التنفيذ للعام الحالي.' },
      PROG_053: { examples: 'سجل استعارة، سجل زيارات، نشاط داعم للمنهج.', proof: 'يثبته الاستخدام لا جرد المصادر وحده.' },
      PROG_054: { examples: 'سجل تجربة: تاريخ، مادة، صف، وسلامة المختبر.', proof: 'يثبته سجل التجربة لا صورة الأدوات وحدها.' },
      PROG_055: { examples: 'سجل صادر ووارد، أرشفة، محضر إداري.', proof: 'يثبته القيد بتاريخه وتوقيعه.' },
      PROG_010: { examples: 'جلسة توجيه مهني، نموذج ميول، خطة طالب.', proof: 'يثبته التنفيذ لا عنوان البرنامج وحده.' },
      PROG_011: { examples: 'خطة حد من التنمر، سجل حالة، إجراء تربوي.', proof: 'يثبته الإجراء والمتابعة.' },
      PROG_016: { examples: 'برنامج قيم، إذاعة، مناسبة وطنية.', proof: 'يثبته التنفيذ بتاريخه.' },
      PROG_020: { examples: 'نشاط لاصفي، مشاركة طلاب، تقرير.', proof: 'يثبته سجل النشاط.' },
      PROG_026: { examples: 'قرار قيادي، متابعة، توجيه موثّق.', proof: 'يثبته الأثر لا مشهد الحضور.' },
      PROG_029: { examples: 'خطة سلامة، تفقد، معالجة ملاحظة.', proof: 'يثبته السجل الدوري.' }
    };
    const item = GUIDE[programId];
    if (!item) {
      box.style.display = 'none';
      box.textContent = '';
      return;
    }
    box.style.display = 'block';
    box.textContent = 'أمثلة: ' + item.examples + ' ' + item.proof;
  }

  function showIndicatorChoices() {
    document.getElementById('upPlaceFields').style.display = 'block';
    document.getElementById('upChangeIndicator').style.display = 'none';
  }

  function confirmPlaceSentence() {
    const domain = document.getElementById('upDomain');
    const indicator = document.getElementById('upIndicator');
    const box = document.getElementById('upPlaceSentence');
    const domainText = domain && domain.selectedIndex > 0 ? domain.options[domain.selectedIndex].textContent : '';
    const indicatorText = indicator && indicator.selectedIndex > 0 ? indicator.options[indicator.selectedIndex].textContent : '';
    if (!domainText || !indicatorText) {
      box.style.display = 'none';
      box.textContent = '';
      return;
    }
    box.style.display = 'block';
    box.textContent = 'سيُحفظ تحت: ' + domainText + '، ' + indicatorText;
  }

  function refreshPlaceSentence() {
    confirmPlaceSentence();
  }

  function setPlaceMode(mode) {
    const fields = document.getElementById('upPlaceFields');
    const changeBtn = document.getElementById('upChangeIndicator');
    if (mode === 'confirmed') {
      fields.style.display = 'none';
      changeBtn.style.display = 'inline-block';
      confirmPlaceSentence();
      return;
    }
    fields.style.display = 'block';
    changeBtn.style.display = 'none';
    if (mode === 'manual') {
      document.getElementById('upPlaceSentence').style.display = 'none';
    } else {
      confirmPlaceSentence();
    }
  }

  function onUploadProgramChange() {
    const select = document.getElementById('upProgram');
    const programId = select.value;
    const option = select.options[select.selectedIndex];
    const hint = document.getElementById('upDraftHint');
    const otherWrap = document.getElementById('upOtherWrap');

    if (programId === '__OTHER__') {
      otherWrap.style.display = 'block';
      renderDomainSelect('', false);
      fillUploadIndicators('');
      applyDraft('upActionTitle', '', 'title');
      applyDraft('upActionDesc', '', 'description');
      applyDraft('upImpact', '', 'impact');
      hint.textContent = 'أنت تستخدم برنامجاً غير مدرج. اختر المجال ثم المؤشر.';
      showPlaceGuide('');
      setPlaceMode('manual');
      return;
    }

    otherWrap.style.display = 'none';
    const otherOption = select.querySelector('option[value="__OTHER__"]');
    if (otherOption) otherOption.textContent = 'برنامج آخر (غير مدرج)';

    const rule = SmartPredictor.get(programId);
    if (!rule) {
      const domainCode = option ? (option.getAttribute('data-domain') || '') : '';
      renderDomainSelect(domainCode, true);
      fillUploadIndicators(domainCode);
      hint.textContent = '';
      showPlaceGuide(programId);
      setPlaceMode('open');
      return;
    }

    const domainCode = domainCodeFromIndicator(rule.indicatorCode);
    renderDomainSelect(domainCode, true);
    fillUploadIndicators(domainCode);
    selectIndicatorByCode(rule.indicatorCode);
    showPlaceGuide(programId);
    setPlaceMode('confirmed');
    const flashed = ['upDomain', 'upIndicator'];
    if (applyDraft('upActionTitle', rule.templates.title, 'title')) flashed.push('upActionTitle');
    if (applyDraft('upActionDesc', rule.templates.description, 'description')) flashed.push('upActionDesc');
    if (applyDraft('upImpact', rule.templates.impact, 'impact')) flashed.push('upImpact');
    flashFields(flashed);
    hint.textContent = 'مسودة مقترحة. أكمل الفراغات بالأرقام والتواريخ الفعلية، أو عدّل كما تريد.';
  }

  function bindUploadDrop(zoneId, inputId, slot) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    zone.onclick = function () { input.click(); };
    zone.ondragover = function (event) { event.preventDefault(); };
    zone.ondrop = function (event) {
      event.preventDefault();
      const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
      setUploadFile(slot, file);
    };
    input.onchange = function () {
      setUploadFile(slot, input.files && input.files[0] ? input.files[0] : null);
    };
  }

  function setUploadFile(slot, file) {
    const nameEl = document.getElementById(slot === 'ev1' ? 'upEv1Name' : 'upEv2Name');
    if (!file) {
      uploadFiles[slot] = null;
      nameEl.textContent = '';
      return;
    }
    const error = validateUploadFile(file);
    if (error) {
      alert(error);
      uploadFiles[slot] = null;
      nameEl.textContent = '';
      return;
    }
    uploadFiles[slot] = file;
    nameEl.textContent = file.name + ' — ' + Math.ceil(file.size / 1024) + ' KB';
  }

  function fileExt(name) {
    const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : '';
  }

  function validateUploadFile(file) {
    const ext = fileExt(file.name);
    const type = String(file.type || '').toLowerCase();
    const allowedExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif', 'pdf', 'doc', 'docx', 'ppt', 'pptx'];
    const known = UPLOAD_TYPES.indexOf(type) !== -1 || allowedExt.indexOf(ext) !== -1 || type.indexOf('image/') === 0;
    if (!known) return 'نوع الملف غير مدعوم. المسموح: صور، PDF، Word، PowerPoint.';
    if (file.size > UPLOAD_MAX_BYTES) return 'الملف أكبر من 20 MB.';
    return '';
  }

  function prepareUploadBlob(file) {
    return new Promise(function (resolve) {
      const type = String(file.type || '').toLowerCase();
      const ext = fileExt(file.name);
      const imageExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif'];
      const isImage = type.indexOf('image/') === 0 || imageExt.indexOf(ext) !== -1;
      const needsShrink = isImage && (file.size > 1400000 || ext === 'heic' || ext === 'heif' || !type);
      if (!needsShrink) {
        resolve(file);
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        const maxW = 1600;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          URL.revokeObjectURL(url);
          if (!blob) {
            resolve(file);
            return;
          }
          const base = String(file.name || 'evidence').replace(/\.[^.]+$/, '');
          resolve(new File([blob], base + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.72);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }

  function ensureSelectValue(id, value) {
    const el = document.getElementById(id);
    const text = String(value || '').trim();
    if (!el || !text) return;
    let found = false;
    for (let i = 0; i < el.options.length; i++) {
      if (el.options[i].value === text || el.options[i].textContent === text) {
        el.value = el.options[i].value;
        found = true;
        break;
      }
    }
    if (!found) {
      const opt = document.createElement('option');
      opt.value = text;
      opt.textContent = text;
      el.appendChild(opt);
      el.value = text;
    }
  }

  function openUploadModal(editRec) {
    if (!currentUser || !currentUser.nationalId || currentUser.isObserver) {
      alert('الرفع متاح لحساب منسوب مسجّل فقط.');
      return;
    }
    document.getElementById('uploadModal').style.display = 'flex';
    uploadDraftStamp = { title: '', description: '', impact: '' };
    editingRowIndex = editRec && editRec.rowIndex ? Number(editRec.rowIndex) : 0;
    const titleEl = document.getElementById('upModalTitle');
    if (titleEl) titleEl.textContent = editingRowIndex ? '✏️ تعديل الشاهد' : '➕ رفع شاهد جديد';
    const submitBtn = document.getElementById('upSubmitBtn');
    if (submitBtn) submitBtn.textContent = editingRowIndex ? 'حفظ التعديل' : 'حفظ ورفع الشاهد';
    document.getElementById('upActionTitle').value = editRec ? String(editRec.action || '') : '';
    document.getElementById('upActionDesc').value = '';
    document.getElementById('upImpact').value = '';
    document.getElementById('upOtherName').value = '';
    document.getElementById('upOtherWrap').style.display = 'none';
    document.getElementById('upDraftHint').textContent = editingRowIndex
      ? 'عدّل النصوص. أرفق ملفاً جديداً فقط إذا أردت استبدال صورة الشاهد.'
      : '';
    if (editRec && editRec.term) document.getElementById('upPeriod').value = editRec.term;
    renderDomainSelect(editRec && editRec.domain ? editRec.domain : '', true);
    setTimeout(function () {
      fillUploadPrograms();
      fillUploadIndicators(editRec && editRec.domain ? editRec.domain : '');
      if (editRec) {
        ensureSelectValue('upDomain', editRec.domain);
        ensureSelectValue('upIndicator', editRec.indicator);
        ensureSelectValue('upPeriod', editRec.term);
      }
    }, 0);
  }

  function showUploadSuccess(rowIndex) {
    document.getElementById('upFormBody').style.display = 'none';
    document.getElementById('upSuccessRow').textContent = (editingRowIndex ? 'تم تعديل الشاهد في الصف ' : 'تم تسجيل الشاهد في الصف ') + rowIndex + '.';
    document.getElementById('upSuccessBody').style.display = 'block';
  }

  function resetUploadForm() {
    editingRowIndex = 0;
    const titleEl = document.getElementById('upModalTitle');
    if (titleEl) titleEl.textContent = '➕ رفع شاهد جديد';
    const success = document.getElementById('upSuccessBody');
    const form = document.getElementById('upFormBody');
    if (success) success.style.display = 'none';
    if (form) form.style.display = 'block';
    const button = document.getElementById('upSubmitBtn');
    if (button) {
      button.disabled = false;
      button.textContent = editingRowIndex ? 'حفظ التعديل' : 'حفظ ورفع الشاهد';
    }
    uploadFiles.ev1 = null;
    uploadFiles.ev2 = null;
    document.getElementById('upEv1Name').textContent = '';
    document.getElementById('upEv2Name').textContent = '';
    document.getElementById('upEv1Bar').style.width = '0';
    document.getElementById('upEv2Bar').style.width = '0';
    document.getElementById('upActionTitle').value = '';
    document.getElementById('upActionDesc').value = '';
    document.getElementById('upImpact').value = '';
    document.getElementById('upPeriod').value = '';
    document.getElementById('upGrade').value = '';
    const saveMsg = document.getElementById('upSaveMsg');
    if (saveMsg) saveMsg.textContent = '';
    const radios = document.querySelectorAll('input[name="upApprover"]');
    for (let i = 0; i < radios.length; i++) radios[i].checked = false;
    const ev1 = document.getElementById('upEv1');
    const ev2 = document.getElementById('upEv2');
    if (ev1) ev1.value = '';
    if (ev2) ev2.value = '';
    fillUploadPrograms();
    renderDomainSelect('', true);
    fillUploadIndicators('');
    showPlaceGuide('');
    setPlaceMode('manual');
  }

  function closeUploadModal() {
    editingRowIndex = 0;
    const titleEl = document.getElementById('upModalTitle');
    if (titleEl) titleEl.textContent = '➕ رفع شاهد جديد';
    document.getElementById('uploadModal').style.display = 'none';
    document.getElementById('upEv1Bar').style.width = '0';
    document.getElementById('upEv2Bar').style.width = '0';
    uploadFiles.ev1 = null;
    uploadFiles.ev2 = null;
    document.getElementById('upEv1Name').textContent = '';
    document.getElementById('upEv2Name').textContent = '';
    const success = document.getElementById('upSuccessBody');
    const form = document.getElementById('upFormBody');
    if (success) success.style.display = 'none';
    if (form) form.style.display = 'block';
    const button = document.getElementById('upSubmitBtn');
    if (button) {
      button.disabled = false;
      button.textContent = 'حفظ ورفع الشاهد';
    }
  }

  function closeUploadOnOverlay(event) {
    if (event.target && event.target.id === 'uploadModal') closeUploadModal();
  }

  function uploadFile(file, slot) {
    return new Promise(function (resolve, reject) {
      const error = validateUploadFile(file);
      if (error) {
        reject(new Error(error));
        return;
      }
      prepareUploadBlob(file).then(function (ready) {
        const reader = new FileReader();
        const bar = document.getElementById(slot === 'ev1' ? 'upEv1Bar' : 'upEv2Bar');
        const sendName = ready.name || file.name;
        const sendType = ready.type || file.type || 'image/jpeg';
        reader.onerror = function () { reject(new Error('تعذر قراءة الملف')); };
        reader.onload = function () {
          bar.style.width = '100%';
          const raw = String(reader.result || '');
          const base64 = raw.indexOf(',') !== -1 ? raw.split(',')[1] : '';
          google.script.run
            .withSuccessHandler(function (result) {
              if (!result || !result.success) reject(new Error((result && result.reason) || 'UPLOAD_FAILED'));
              else resolve(result);
            })
            .withFailureHandler(function (err) { reject(err); })
            .Feature_DirectUpload_receiveBlob({
              teacherId: currentUser.nationalId,
              slot: slot,
              fileName: sendName,
              mimeType: sendType,
              base64: base64
            });
        };
        reader.readAsDataURL(ready);
      }).catch(function (err) { reject(err); });
    });
  }

  function submitEvidence() {
    if (!currentUser || !currentUser.nationalId) {
      alert('لا توجد هوية في الجلسة.');
      return;
    }
    const approverEl = document.querySelector('input[name="upApprover"]:checked');
    const programSelect = document.getElementById('upProgram');
    const programOption = programSelect.options[programSelect.selectedIndex];
    const payload = {
      teacherId: currentUser.nationalId,
      period: document.getElementById('upPeriod').value,
      program: programOption ? programOption.textContent : '',
      domain: document.getElementById('upDomain').value,
      indicator: document.getElementById('upIndicator').value,
      actionTitle: document.getElementById('upActionTitle').value.trim(),
      actionDesc: document.getElementById('upActionDesc').value.trim(),
      impact: document.getElementById('upImpact').value.trim(),
      grade: document.getElementById('upGrade').value,
      approver: approverEl ? approverEl.value : ''
    };
    if (!payload.period || !payload.program || !payload.domain || !payload.indicator || !payload.actionTitle || !payload.actionDesc || !payload.impact || !payload.grade || !payload.approver) {
      alert('أكمل جميع الحقول قبل الحفظ.');
      return;
    }
    if (!uploadFiles.ev1 && !editingRowIndex) {
      alert('الشاهد الأول إلزامي.');
      return;
    }
    const button = document.getElementById('upSubmitBtn');
    const saveMsg = document.getElementById('upSaveMsg');
    if (saveMsg) saveMsg.textContent = '';
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ…';
    const isEdit = !!editingRowIndex;
    if (isEdit) payload.rowIndex = editingRowIndex;
    const start = uploadFiles.ev1
      ? uploadFile(uploadFiles.ev1, 'ev1')
      : Promise.resolve(null);
    start
      .then(function (first) {
        payload.evidence1FileId = first ? first.fileId : '';
        if (!uploadFiles.ev2) return null;
        return uploadFile(uploadFiles.ev2, 'ev2');
      })
      .then(function (second) {
        payload.evidence2FileId = second ? second.fileId : '';
        const runner = google.script.run
          .withSuccessHandler(function (result) {
            button.disabled = false;
            button.textContent = isEdit ? 'حفظ التعديل' : 'حفظ ورفع الشاهد';
            if (!result || !result.success) {
              if (saveMsg) saveMsg.textContent = 'تعذر حفظ الصف: ' + ((result && result.reason) || 'UNKNOWN');
              return;
            }
            showUploadSuccess(result.rowIndex);
            google.script.run
              .withSuccessHandler(function (data) {
                if (!data || !data.records) return;
                allRecords = data.records;
                renderDashboard();
              })
              .withFailureHandler(function (err) {
                console.log('Table refresh after save failed:', err);
              })
              .getReportDataForClient();
          })
          .withFailureHandler(function (err) {
            button.disabled = false;
            button.textContent = isEdit ? 'حفظ التعديل' : 'حفظ ورفع الشاهد';
            if (saveMsg) saveMsg.textContent = 'تعذر الاتصال بالخادم: ' + (err && err.message ? err.message : err);
          });
        if (isEdit) runner.Feature_DirectUpload_updateUpload(payload);
        else runner.Feature_DirectUpload_saveUpload(payload);
      })
      .catch(function (err) {
        button.disabled = false;
        button.textContent = isEdit ? 'حفظ التعديل' : 'حفظ ورفع الشاهد';
        if (saveMsg) saveMsg.textContent = err && err.message ? err.message : String(err);
      });
  }

  const officialPortalUrl = "${officialUrl}";
  let currentUser = null;
  let adminMode = false;
  let barChartInstance = null;
  let pieChartInstance = null;

  function normalizePersonName(value) {
    return String(value || '').replace(/[\\u064b-\\u0652]/g, '').replace(/\\s+/g, ' ').trim();
  }

  function findStaffByNameAndId(list, selectedName, pass) {
    const selName = normalizePersonName(selectedName);
    for (let i = 0; i < list.length; i++) {
      const person = list[i];
      if (normalizePersonName(person.name) === selName && String(person.nationalId).trim() === pass) {
        return person;
      }
    }
    return null;
  }

  function fillNameSelect(selectEl, list, placeholder) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    const first = document.createElement('option');
    first.value = '';
    first.textContent = placeholder;
    selectEl.appendChild(first);
    list.forEach(function(person) {
      const opt = document.createElement('option');
      opt.value = person.name;
      opt.textContent = person.name;
      selectEl.appendChild(opt);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. تعبئة قائمة المنسوبين
  // ═══════════════════════════════════════════════════════════════
  const userSelect = document.getElementById('userSelect');
  const adminSelect = document.getElementById('adminSelect');
  if (userSelect && staffList && staffList.length > 0) {
    fillNameSelect(userSelect, staffList, '-- اختر من قائمة منسوبي المدرسة --');

    // ═══ خيار المشرف المقيم يبقى في القائمة الرئيسية ═══
    if (observerEnabled) {
      const obsOpt = document.createElement('option');
      obsOpt.value = '__OBSERVER__';
      obsOpt.textContent = '👁️ ' + observerName;
      obsOpt.style.fontWeight = 'bold';
      obsOpt.style.color = '#0284c7';
      userSelect.appendChild(obsOpt);
    }
  }
  if (adminSelect) {
    fillNameSelect(adminSelect, adminList || [], '-- اختر من الإدارات والقيادة --');
  }

  function toggleAdminLogin() {
    adminMode = !adminMode;
    const teacherBox = document.getElementById('teacherLoginBox');
    const adminBox = document.getElementById('adminLoginBox');
    const toggleBtn = document.getElementById('btnShowAdminLogin');
    if (teacherBox) teacherBox.style.display = adminMode ? 'none' : '';
    if (adminBox) adminBox.style.display = adminMode ? 'block' : 'none';
    if (toggleBtn) {
      toggleBtn.textContent = adminMode ? 'العودة لقائمة المعلمين' : '🔐 دخول الإدارات والقيادة';
    }
    if (!adminMode && adminSelect) adminSelect.value = '';
    const errDiv = document.getElementById('loginErr');
    if (errDiv) errDiv.style.display = 'none';
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. تسجيل الدخول
  // ═══════════════════════════════════════════════════════════════
  function performLogin() {
    const pass = document.getElementById('userPass').value.trim();
    const errDiv = document.getElementById('loginErr');

    if (adminMode) {
      const adminName = adminSelect ? adminSelect.value.trim() : '';
      const adminFound = findStaffByNameAndId(adminList || [], adminName, pass);
      if (adminFound) {
        errDiv.style.display = 'none';
        currentUser = adminFound;
        sessionStorage.setItem('evidence_user', JSON.stringify(currentUser));
        renderDashboard();
      } else {
        errDiv.style.display = 'block';
      }
      return;
    }

    const selectedName = userSelect.value.trim();

    // ═══ الحالة 1: المشرف المقيم ═══
    if (selectedName === '__OBSERVER__') {
      google.script.run
        .withSuccessHandler(function(data) {
          if (data && data.success) {
            errDiv.style.display = 'none';
            currentUser = data.user;
            sessionStorage.setItem('evidence_user', JSON.stringify(currentUser));
            renderDashboard();
          } else {
            errDiv.style.display = 'block';
          }
        })
        .withFailureHandler(function() {
          errDiv.style.display = 'block';
        })
        .checkObserverLoginForClient(pass);
      return;
    }

    // ═══ الحالة 2: المنسوب العادي ═══
    const found = staffList.find(function(u) {
      const dbName = u.name.replace(/[\\u064b-\\u0652]/g, "").replace(/\\s+/g, " ").trim();
      const selName = selectedName.replace(/[\\u064b-\\u0652]/g, "").replace(/\\s+/g, " ").trim();
      return dbName === selName && String(u.nationalId).trim() === pass;
    });

    if (found) {
      errDiv.style.display = 'none';
      currentUser = found;
      sessionStorage.setItem('evidence_user', JSON.stringify(currentUser));
      renderDashboard();
    } else {
      errDiv.style.display = 'block';
    }
  }

  let signatureDismissedFor = '';
  let signatureInk = false;
  let sigDrawing = false;
  let sigCtx = null;

  function sigPoint(ev) {
    const rect = document.getElementById('sigCanvas').getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function prepareSigCanvas() {
    const canvas = document.getElementById('sigCanvas');
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || 560;
    const cssH = rect.height || 180;
    canvas.width = Math.round(cssW * ratio);
    canvas.height = Math.round(cssH * ratio);
    sigCtx = canvas.getContext('2d');
    sigCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    sigCtx.lineWidth = 2.4;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
    sigCtx.strokeStyle = '#0f172a';
    signatureInk = false;
  }

  function bindSigPad() {
    if (bindSigPad.done) return;
    bindSigPad.done = true;
    const canvas = document.getElementById('sigCanvas');
    canvas.addEventListener('pointerdown', function (ev) {
      canvas.setPointerCapture(ev.pointerId);
      sigDrawing = true;
      const p = sigPoint(ev);
      sigCtx.beginPath();
      sigCtx.moveTo(p.x, p.y);
      ev.preventDefault();
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!sigDrawing) return;
      const p = sigPoint(ev);
      sigCtx.lineTo(p.x, p.y);
      sigCtx.stroke();
      signatureInk = true;
      ev.preventDefault();
    });
    function stopDraw() { sigDrawing = false; }
    canvas.addEventListener('pointerup', stopDraw);
    canvas.addEventListener('pointercancel', stopDraw);
    document.getElementById('sigFile').addEventListener('change', function (ev) {
      const file = ev.target.files && ev.target.files[0];
      const msg = document.getElementById('sigMsg');
      if (!file || file.type.indexOf('image/') !== 0) {
        msg.textContent = 'اختر ملف صورة.';
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        const img = new Image();
        img.onload = function () {
          prepareSigCanvas();
          const rect = document.getElementById('sigCanvas').getBoundingClientRect();
          const scale = Math.min(rect.width / img.width, rect.height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          sigCtx.drawImage(img, (rect.width - w) / 2, (rect.height - h) / 2, w, h);
          signatureInk = true;
          msg.textContent = '';
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function setSigTab(tab) {
    document.getElementById('sigFilePane').style.display = tab === 'file' ? 'block' : 'none';
    document.getElementById('sigTabDraw').className = 'sig-tab' + (tab === 'draw' ? ' active' : '');
    document.getElementById('sigTabFile').className = 'sig-tab' + (tab === 'file' ? ' active' : '');
  }

  function openSignatureModal() {
    document.getElementById('signature-modal').style.display = 'flex';
    document.getElementById('sigAck').checked = false;
    document.getElementById('sigMsg').textContent = '';
    document.getElementById('sigFile').value = '';
    setSigTab('draw');
    bindSigPad();
    requestAnimationFrame(prepareSigCanvas);
  }

  function dismissSignatureLater() {
    signatureDismissedFor = String(currentUser.nationalId);
    document.getElementById('signature-modal').style.display = 'none';
  }

  function clearSignaturePad() {
    prepareSigCanvas();
    document.getElementById('sigFile').value = '';
    document.getElementById('sigMsg').textContent = '';
  }

  function sigReasonText(reason) {
    const code = String(reason || '');
    if (code.indexOf('INVALID_PNG') === 0) return code;
    if (code === 'INVALID_ID') return 'السجل المدني غير صالح.';
    if (code === 'TEACHER_NOT_FOUND') return 'السجل غير موجود في قائمة المنسوبين.';
    return 'تعذر حفظ التوقيع' + (code ? ': ' + code : '.');
  }

  function exportSignaturePng() {
    const source = document.getElementById('sigCanvas');
    const out = document.createElement('canvas');
    out.width = source.width;
    out.height = source.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, 0, 0);
    return out.toDataURL('image/png');
  }

  function saveSignaturePad() {
    const msg = document.getElementById('sigMsg');
    if (!signatureInk) {
      msg.textContent = 'ارسم التوقيع أو ارفع صورته أولاً.';
      return;
    }
    if (!document.getElementById('sigAck').checked) {
      msg.textContent = 'يلزم الإقرار بأن هذا توقيعك الرسمي.';
      return;
    }
    const dataUrl = exportSignaturePng();
    const btn = document.getElementById('sigSaveBtn');
    btn.disabled = true;
    google.script.run
      .withSuccessHandler(function (res) {
        btn.disabled = false;
        if (!res || !res.success) {
          msg.textContent = sigReasonText(res && res.reason);
          return;
        }
        document.getElementById('signature-modal').style.display = 'none';
        setSignatureChip('saved');
        alert('تم حفظ توقيعك بنجاح');
      })
      .withFailureHandler(function (err) {
        btn.disabled = false;
        msg.textContent = 'تعذر الحفظ: ' + (err && err.message ? err.message : err);
      })
      .Feature_SignatureService_save(String(currentUser.nationalId), dataUrl);
  }

  function showSignatureModal() {
    openSignatureModal();
  }

  function setSignatureChip(state) {
    const el = document.getElementById('sigStatusChip');
    if (!el) return;
    if (!currentUser || currentUser.isObserver) {
      el.style.display = 'none';
      const note = document.getElementById('sigReprintNote');
      const reprint = document.getElementById('btnReprintMine');
      if (note) note.style.display = 'none';
      if (reprint) reprint.style.display = 'none';
      return;
    }
    el.style.display = 'inline-block';
    const note = document.getElementById('sigReprintNote');
    const reprint = document.getElementById('btnReprintMine');
    if (note) note.style.display = 'block';
    if (reprint) reprint.style.display = 'inline-block';
    if (state === 'saved') {
      el.textContent = 'التوقيع محفوظ — تعديل';
      el.style.background = '#d1fae5';
      el.style.color = '#065f46';
      return;
    }
    el.textContent = 'التوقيع غير محفوظ — أضفه';
    el.style.background = '#ffedd5';
    el.style.color = '#9a3412';
  }

  function reprintMyCards() {
    if (!currentUser || !currentUser.name) return;
    const cleanMyName = currentUser.name.split('-')[0].trim();
    const mine = (allRecords || []).filter(function (r) { return r.teacher && r.teacher.indexOf(cleanMyName) !== -1; });
    if (!mine.length) {
      alert('لا توجد بطاقات باسمك لإعادة طباعتها.');
      return;
    }
    const confirmed = confirm('ستُعاد طباعة ' + mine.length + ' بطاقة بالتوقيع الحالي. متابعة؟');
    if (!confirmed) return;
    mine.forEach(function (r, idx) {
      setTimeout(function () {
        window.open(
          officialPortalUrl + '?action=printCard&row=' + r.rowIndex + '&t=' + Date.now(),
          '_blank',
          'width=900,height=1200'
        );
      }, idx * 1500);
    });
  }

  function editSignature() {
    if (!currentUser || currentUser.isObserver || !currentUser.nationalId) return;
    showSignatureModal();
  }

  function promptSignatureIfMissing() {
    if (!currentUser || currentUser.isObserver || !currentUser.nationalId) return;
    const id = String(currentUser.nationalId);
    google.script.run
      .withSuccessHandler(function (res) {
        if (!currentUser || String(currentUser.nationalId) !== id) return;
        const missing = !res || res.exists === false;
        setSignatureChip(missing ? 'missing' : 'saved');
        if (signatureDismissedFor === id || !missing) return;
        showSignatureModal();
      })
      .withFailureHandler(function (err) {
        if (!currentUser || String(currentUser.nationalId) !== id) return;
        setSignatureChip('missing');
        if (signatureDismissedFor === id) return;
        showSignatureModal();
        var msg = document.getElementById('sigMsg');
        if (msg) msg.textContent = 'تعذر التحقق من التوقيع: ' + (err && err.message ? err.message : err);
      })
      .Feature_SignatureService_status(id);
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. عرض لوحة التحكم
  // ═══════════════════════════════════════════════════════════════
  function renderDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    document.getElementById('headerUserName').textContent = 'مرحباً، ' + currentUser.name;
    document.getElementById('headerUserRole').textContent = 'الصفة: ' + currentUser.role;

    const hint = document.getElementById('roleDomainHint');
    if (hint && currentUser && !currentUser.isObserver) {
      const roleInfo = getDomainsForRoleClient(currentUser.role);
      if (roleInfo && roleInfo.matched) {
        const names = roleInfo.recommended.map(function (code) {
          return roleInfo.domainNames[code] || code;
        }).join('، ');
        hint.textContent = 'دورك: ' + roleInfo.label + ' — المجالات الموصى بها: ' + names + '. المؤشرات كاملة حتى الاعتماد الرسمي.';
        hint.style.display = 'block';
      } else {
        hint.style.display = 'none';
      }
    }

    const isObserver = currentUser.isObserver === true;
    const isMasterAdmin = !isObserver && (
      currentUser.nationalId === '1008379958' ||
      currentUser.name.includes('أحمد علي الشهري') ||
      currentUser.role.includes('مدير') ||
      currentUser.role.includes('وكيل')
    );

    if (isMasterAdmin) {
      document.getElementById('btnAdminPurge').style.display = 'inline-block';
      document.getElementById('btnImportNur').style.display = 'inline-block';
    } else {
      document.getElementById('btnAdminPurge').style.display = 'none';
      document.getElementById('btnImportNur').style.display = 'none';
    }

    document.getElementById('btnOpenStats').style.display = 'inline-block';
    document.getElementById('btnBatchPrint').style.display = 'inline-block';

    let userRecords = [];
    const cleanMyName = currentUser && currentUser.name ? currentUser.name.split('-')[0].trim() : '';
    if (isMasterAdmin || isObserver) {
      userRecords = allRecords;
      document.getElementById('statTitle1').textContent = 'إجمالي الشواهد المنجزة بالمدرسة';
      document.getElementById('statTitle3').textContent = 'المعلمون المشاركون';
      document.getElementById('statNum3').textContent = new Set(allRecords.map(r => r.teacher)).size;
    } else {
      userRecords = allRecords.filter(r => r.teacher.includes(cleanMyName));
      document.getElementById('statTitle1').textContent = 'شواهدي المنجزة';
      document.getElementById('statTitle3').textContent = 'حالة السجل الشخصي';
      document.getElementById('statNum3').textContent = userRecords.length > 0 ? 'نشط ومحدث' : 'بانتظار الشواهد';
    }
    document.getElementById('statNum1').textContent = userRecords.length;
    document.getElementById('statNum2').textContent = new Set(userRecords.map(r => r.domain)).size;

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    if (userRecords.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#64748b;">لا توجد شواهد مسجلة باسمك حتى الآن.</td></tr>';
    } else {
      userRecords.forEach((r, idx) => {
        const tr = document.createElement('tr');
        const cleanIndicator = String(r.indicator || '').replace(/'/g, '').substring(0, 50);
        const pdfBtnHtml = '<button onclick="openCardInViewer(' + r.rowIndex + ', \\'' + cleanIndicator + '\\')" class="btn-pdf">👁️ عرض البطاقة داخل النظام</button>';
        const mine = !isObserver && (isMasterAdmin || (cleanMyName && String(r.teacher || '').indexOf(cleanMyName) !== -1));
        const editBtnHtml = mine ? '<button type="button" onclick="editRecord(' + r.rowIndex + ')" class="btn-edit">✏️ تعديل</button>' : '';
        const deleteBtnHtml = mine ? '<button type="button" onclick="deleteRecord(' + r.rowIndex + ', \\'' + String(r.pdfUrl || '').replace(/'/g, '') + '\\')" class="btn-delete">🗑️ حذف</button>' : '';
        const printBtn = '<button onclick="openCardInViewer(' + r.rowIndex + ', \\'بطاقة الشاهد\\')" class="btn-print-card">🖨️ طباعة</button>';
        tr.innerHTML = '<td>' + (idx + 1) + '</td><td><strong>' + r.teacher + '</strong></td><td>' + r.term + '</td><td>' + r.domain + '</td><td>' + r.indicator + '</td><td>' + r.action + '</td><td>' + pdfBtnHtml + ' ' + printBtn + ' ' + editBtnHtml + ' ' + deleteBtnHtml + '</td>';
        tbody.appendChild(tr);
      });
    }
    promptSignatureIfMissing();
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. فتح البطاقة في العارض
  // ═══════════════════════════════════════════════════════════════
  function openCardInViewer(rowIndex, indicatorText) {
    if (!rowIndex) {
      alert('⚠️ رقم الصف غير متوفر.');
      return;
    }
    const previewUrl = officialPortalUrl + '?action=printCard&row=' + rowIndex + '&preview=1&t=' + Date.now();
    document.getElementById('viewerTitle').textContent = '👁️ معاينة البطاقة: ' + (indicatorText || '');
    document.getElementById('viewerFrame').src = previewUrl;
    document.getElementById('viewerModal').style.display = 'flex';
  }

  function closeViewerModal() {
    document.getElementById('viewerModal').style.display = 'none';
    document.getElementById('viewerFrame').src = '';
  }

  function closeViewerOnOverlay(e) {
    if (e.target.id === 'viewerModal') closeViewerModal();
  }

  // ═══ 🆕 استقبال رسالة إغلاق البطاقة من iframe ═══
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'closeCardPreview') {
      closeViewerModal();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. فتح معاينة الشاهد مباشرة (embed)
  // ═══════════════════════════════════════════════════════════════
  function openEmbeddedViewer(url, titleText) {
    console.log('🔍 فتح المعاينة. URL: "' + url + '"');

    if (!url || String(url).trim() === '' || String(url) === 'undefined' || String(url) === 'null') {
      alert('⚠️ لا يوجد رابط لهذا الشاهد.');
      return;
    }

    const urlStr = String(url).trim();
    let fileId = '';

    let match = urlStr.match(/\\/file\\/d\\/([-\\w]{25,})/);
    if (match) fileId = match[1];

    if (!fileId) {
      match = urlStr.match(/[?&]id=([-\\w]{25,})/);
      if (match) fileId = match[1];
    }

    if (!fileId) {
      match = urlStr.match(/([-\\w]{25,})/);
      if (match) fileId = match[1];
    }

    if (!fileId) {
      alert('⚠️ الرابط غير صالح للمعاينة.');
      return;
    }

    const embedUrl = 'https://drive.google.com/file/d/' + fileId + '/preview';
    console.log('✅ فتح المعاينة: ' + embedUrl);

    document.getElementById('viewerTitle').textContent = titleText || 'معاينة المستند والشاهد';
    document.getElementById('viewerFrame').src = embedUrl;
    document.getElementById('viewerModal').style.display = 'flex';
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. لوحة المؤشرات
  // ═══════════════════════════════════════════════════════════════
  function openStatsModal() {
    document.getElementById('statsModal').style.display = 'flex';
    refreshLiveData();
  }

  function closeStatsModal() {
    document.getElementById('statsModal').style.display = 'none';
    const panel = document.getElementById('domainEvidencePanel');
    if (panel) panel.style.display = 'none';
  }

  function refreshLiveData() {
    const syncEl = document.getElementById('lastSyncTime');
    if (syncEl) syncEl.textContent = '⏳ جاري التحديث...';

    google.script.run
      .withSuccessHandler(function (data) {
        if (data && data.success) {
          allRecords = data.records;
          renderStatsData(data);
          const timeStr = new Date().toLocaleTimeString('ar-SA');
          if (syncEl) syncEl.textContent = '✅ آخر تحديث: ' + timeStr;
        } else {
          if (syncEl) syncEl.textContent = '⚠️ فشل جلب البيانات';
        }
      })
      .withFailureHandler(function (err) {
        if (syncEl) syncEl.textContent = '❌ فشل الاتصال بالخادم';
        console.log('Auto-refresh error:', err);
      })
      .getReportDataForClient();
  }

  function renderStatsData(reportResult) {
    const totalEvidences = reportResult.summary.totalEvidences;
    const activeCount = reportResult.summary.activeCount;
    const totalStaffCount = reportResult.summary.totalStaffCount;
    const activeStaffListNames = reportResult.lists.activeStaff;
    const pendingStaffListNames = reportResult.lists.pendingStaff;

    const cardsHtml = '<div class="stat-mini-card"><div>إجمالي الشواهد المرفوعة</div><div class="val">' + totalEvidences + '</div></div>' +
                      '<div class="stat-mini-card"><div>نسبة مشاركة المعلمين</div><div class="val">' + activeCount + ' / ' + totalStaffCount + ' (' + reportResult.summary.participationRate + '%)</div></div>' +
                      '<div class="stat-mini-card"><div>المجالات المغطاة</div><div class="val">' + Object.keys(reportResult.domains).filter(k => reportResult.domains[k].coveredIndicators > 0).length + ' / 4</div></div>';
    document.getElementById('statsCardsContainer').innerHTML = cardsHtml;

    let domainTableHtml = '';
    const barChartLabels = ['الإدارة المدرسية', 'التعليم والتعلم', 'نواتج التعلم', 'البيئة المدرسية'];
    const barChartValues = [];
    Object.keys(reportResult.domains).forEach(dName => {
      const dInfo = reportResult.domains[dName];
      barChartValues.push(dInfo.percentage);
      domainTableHtml += '<tr style="cursor:pointer;" onclick="openDomainEvidence(\\'' + dName.substring(0, 2) + '\\')"><td><strong>' + dName + '</strong></td><td>' + dInfo.totalIndicators + ' مؤشرات</td><td>' + dInfo.coveredIndicators + ' مؤشرات مغطاة</td><td><strong>' + dInfo.percentage + '%</strong></td></tr>';
    });
    document.getElementById('domainsStatsBody').innerHTML = domainTableHtml;

    const barCtx = document.getElementById('domainsBarChart').getContext('2d');
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(barCtx, {
      type: 'bar',
      data: { labels: barChartLabels, datasets: [{ label: 'نسبة إنجاز المعايير (%)', data: barChartValues, backgroundColor: '#177d82', borderRadius: 6 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100 } },
        onClick: function (evt, elements) {
          if (!elements || !elements.length) return;
          const codes = ['01', '02', '03', '04'];
          openDomainEvidence(codes[elements[0].index]);
        }
      }
    });

    const pendingCount = reportResult.summary.pendingCount;
    const pieCtx = document.getElementById('teachersPieChart').getContext('2d');
    if (pieChartInstance) pieChartInstance.destroy();
    pieChartInstance = new Chart(pieCtx, {
      type: 'doughnut',
      data: { labels: ['المشاركون', 'بانتظار المشاركة'], datasets: [{ data: [activeCount, pendingCount], backgroundColor: ['#10b981', '#e11d48'] }] },
      options: { responsive: true, maintainAspectRatio: false }
    });

    let activeNamesHtml = '';
    activeStaffListNames.forEach(name => { activeNamesHtml += '• ' + name + '<br>'; });
    const pendingRoster = (reportResult.lists && reportResult.lists.pendingRoster && reportResult.lists.pendingRoster.length)
      ? reportResult.lists.pendingRoster
      : pendingStaffListNames.map(function (name) { return { name: name, nationalId: '' }; });
    window._pendingRoster = pendingRoster;
    const canManageRoster = (function () {
      if (!currentUser || currentUser.isObserver === true) return false;
      const role = String(currentUser.role || '');
      return currentUser.nationalId === '1008379958'
        || (currentUser.name && currentUser.name.indexOf('أحمد علي الشهري') !== -1)
        || role.indexOf('مدير') !== -1
        || role.indexOf('وكيل') !== -1;
    })();
    let pendingNamesHtml = '';
    pendingRoster.forEach(function (person) {
      const name = String(person.name || '');
      const id = String(person.nationalId || '').replace(/\\D/g, '');
      pendingNamesHtml += '<div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin:2px 0;">';
      pendingNamesHtml += '<span>• ' + name.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
      if (canManageRoster && /^\\d{10}$/.test(id)) {
        pendingNamesHtml += '<span style="white-space:nowrap;">'
          + '<button type="button" style="margin-right:4px;padding:1px 6px;font-size:11px;border:1px solid #b45309;background:#fff7ed;border-radius:4px;cursor:pointer;" onclick="markStaffLeaving(\\'' + id + '\\',\\'منقول\\')">منقول</button>'
          + '<button type="button" style="padding:1px 6px;font-size:11px;border:1px solid #64748b;background:#f8fafc;border-radius:4px;cursor:pointer;" onclick="markStaffLeaving(\\'' + id + '\\',\\'متقاعد\\')">متقاعد</button>'
          + '</span>';
      }
      pendingNamesHtml += '</div>';
    });

    document.getElementById('activeStaffCount').textContent = activeCount;
    document.getElementById('activeStaffList').innerHTML = activeNamesHtml || 'لا توجد مشاركات حتى الآن';
    document.getElementById('pendingStaffCount').textContent = pendingCount;
    document.getElementById('pendingStaffList').innerHTML = pendingNamesHtml || 'جميع منسوبي المدرسة شاركوا!';
  }

  function markStaffLeaving(nationalId, status) {
    if (window._rosterSaving) return;
    const id = String(nationalId || '').replace(/\\D/g, '');
    if (!/^\\d{10}$/.test(id) || (status !== 'منقول' && status !== 'متقاعد')) return;
    const person = (window._pendingRoster || []).filter(function (p) { return String(p.nationalId || '').replace(/\\D/g, '') === id; })[0];
    const name = person && person.name ? person.name : id;
    const note = prompt('إخراج «' + name + '» بحالة ' + status + '؟\\nالشواهد تبقى كما هي.\\nاكتب ملاحظة قصيرة، أو اتركها فارغة:', '');
    if (note === null) return;
    if (!currentUser || !currentUser.nationalId) {
      alert('أعد فتح الصفحة ثم أعد المحاولة.');
      return;
    }
    window._rosterSaving = true;
    google.script.run
      .withSuccessHandler(function (res) {
        window._rosterSaving = false;
        if (!res || res.success !== true) {
          alert(res && res.message ? res.message : 'تعذر حفظ الحالة.');
          return;
        }
        refreshLiveData();
      })
      .withFailureHandler(function (err) {
        window._rosterSaving = false;
        alert(err && err.message ? err.message : 'تعذر الاتصال.');
      })
      .setStaffRosterStatusForClient(currentUser.nationalId, id, status, note);
  }

  function closeDomainEvidence() {
    document.getElementById('domainEvidencePanel').style.display = 'none';
  }

  function openDomainEvidence(domainCode) {
    const code = String(domainCode || '').substring(0, 2);
    const group = (guideData || []).filter(function (g) {
      return String(g.domain || '').substring(0, 2) === code;
    })[0];
    if (!group) return;
    const records = (allRecords || []).filter(function (r) {
      return String(r.domain || '').indexOf(code) === 0 || String(r.domain || '').indexOf(group.domain) !== -1;
    });
    let html = '<div class="guide-mini-header">' +
      '<div class="gmh-line1">المملكة العربية السعودية | وزارة التعليم</div>' +
      '<div class="gmh-line2">الإدارة العامة للتعليم بمنطقة المدينة المنورة — متوسطة سعد بن الربيع الأنصاري</div>' +
      '</div>';
    html += '<div class="guide-page-header">شواهد المجال مرتبة من أول مؤشر إلى آخره</div>';
    html += '<div class="guide-domain-title">' + group.domain + '</div>';
    html += '<table class="guide-table"><thead><tr>' +
      '<th width="12%">المؤشر</th><th width="28%">نص المؤشر</th><th width="60%">الشواهد المرفوعة</th>' +
      '</tr></thead><tbody>';
    group.indicators.forEach(function (ind) {
      const mine = records.filter(function (r) {
        return String(r.indicator || '').indexOf(ind.code) !== -1;
      });
      let cell = '';
      if (!mine.length) {
        cell = '<span style="color:#94a3b8;">لا يوجد شاهد مرفوع</span>';
      } else {
        mine.forEach(function (r) {
          const who = String(r.teacher || '').replace(/</g, '');
          const act = String(r.action || '').replace(/</g, '');
          cell += '<div style="margin-bottom:8px;">' +
            '<strong>' + who + '</strong> — ' + act +
            ' <button type="button" class="btn-nav" style="padding:2px 8px; font-size:12px;" onclick="openCardInViewer(' + r.rowIndex + ', \\'' + ind.code + '\\')">عرض</button>' +
            '</div>';
        });
      }
      html += '<tr><td><strong>' + ind.code + '</strong></td><td>' + ind.name + '</td><td class="guide-hints">' + cell + '</td></tr>';
    });
    html += '</tbody></table>';
    document.getElementById('domainEvidenceTitle').textContent = group.domain;
    document.getElementById('domainEvidenceBody').innerHTML = html;
    document.getElementById('domainEvidencePanel').style.display = 'block';
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. تصدير Excel
  // ═══════════════════════════════════════════════════════════════
  function exportToExcel() {
    let csv = '\\uFEFFاسم المعلم,الفترة,المجال,المؤشر,الإجراء المنفذ,رابط البطاقة\\n';
    allRecords.forEach(r => {
      csv += '"' + r.teacher + '","' + r.term + '","' + r.domain + '","' + r.indicator + '","' + r.action + '","' + r.pdfUrl + '"\\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'التقرير.csv';
    a.click();
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. تحديث الجدول بعد الحذف أو التفريغ — بدون إعادة توجيه
  // ═══════════════════════════════════════════════════════════════
  function refreshRecordsAfterChange(successMessage) {
    alert(successMessage);
    google.script.run
      .withSuccessHandler(function (data) {
        if (!data || !data.records) {
          alert("تم التحديث، لكن تعذّر جلب البيانات. أعد تحميل الصفحة يدوياً.");
          return;
        }
        allRecords = data.records;
        renderDashboard();
      })
      .withFailureHandler(function (err) {
        alert("تم الحذف، لكن تعذّر تحديث الجدول. أعد تحميل الصفحة يدوياً.");
        try {
          google.script.run.logDeleteRefreshFailed(String(err && err.message ? err.message : err));
        } catch (logErr) {}
      })
      .getReportDataForClient();
  }

  function editRecord(rowIdx) {
    const rec = (allRecords || []).filter(function (r) { return Number(r.rowIndex) === Number(rowIdx); })[0];
    if (!rec) {
      alert('تعذر العثور على الشاهد.');
      return;
    }
    uploadFiles.ev1 = null;
    uploadFiles.ev2 = null;
    const ev1 = document.getElementById('upEv1');
    const ev2 = document.getElementById('upEv2');
    if (ev1) ev1.value = '';
    if (ev2) ev2.value = '';
    document.getElementById('upEv1Name').textContent = '';
    document.getElementById('upEv2Name').textContent = '';
    openUploadModal(rec);
  }

  function deleteRecord(rowIdx, pdfUrl) {
    if (!confirm("هل أنت متأكد من حذف هذا الشاهد؟")) return;
    google.script.run
      .withSuccessHandler(function (res) {
        if (res === "SUCCESS") {
          refreshRecordsAfterChange("تم الحذف بنجاح!");
        } else {
          alert("خطأ: " + res);
        }
      })
      .withFailureHandler(function (err) {
        alert("تعذر الاتصال بالخادم: " + (err && err.message ? err.message : err));
      })
      .deleteRecordForClient(rowIdx, pdfUrl, currentUser && currentUser.nationalId);
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. طباعة كل البطاقات (جماعية)
  // ═══════════════════════════════════════════════════════════════
  function batchPrintAll() {
    if (!allRecords || allRecords.length === 0) {
      alert('لا توجد بطاقات لطباعتها.');
      return;
    }
    const isObserver = !!(currentUser && currentUser.isObserver === true);
    const isMasterAdmin = !!(currentUser && !isObserver && (
      currentUser.nationalId === '1008379958' ||
      (currentUser.name && currentUser.name.includes('أحمد علي الشهري')) ||
      (currentUser.role && currentUser.role.includes('مدير')) ||
      (currentUser.role && currentUser.role.includes('وكيل'))
    ));
    let recordsToPrint = allRecords;
    if (!(isMasterAdmin === true || isObserver === true)) {
      const cleanMyName = currentUser.name.split('-')[0].trim();
      const myRecords = allRecords.filter(function (r) { return r.teacher.includes(cleanMyName); });
      recordsToPrint = myRecords;
    }
    if (!recordsToPrint.length) {
      alert('لا توجد بطاقات لطباعتها.');
      return;
    }
    const confirmed = confirm('سيتم فتح ' + recordsToPrint.length + ' نافذة طباعة. متابعة؟');
    if (!confirmed) return;

    recordsToPrint.forEach(function(r, idx) {
      setTimeout(function() {
        window.open(
          officialPortalUrl + '?action=printCard&row=' + r.rowIndex + '&t=' + Date.now(),
          '_blank',
          'width=900,height=1200'
        );
      }, idx * 1500);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 10. تسجيل الخروج
  // ═══════════════════════════════════════════════════════════════
  function performLogout() {
    sessionStorage.removeItem('evidence_user');
    currentUser = null;
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('userPass').value = '';
  }

  // ═══════════════════════════════════════════════════════════════
  // 11. طباعة التقرير البياني (مع الرسوم)
  // ═══════════════════════════════════════════════════════════════
  function printStatsReport() {
    const originalTitle = document.title;
    document.title = "التقرير البياني - متوسطة سعد بن الربيع";

    const statsContent = document.getElementById('statsPrintArea')
                      || document.getElementById('statsModal')
                      || document.body;

    let clonedHtml = statsContent.innerHTML;

    // ═══ استبدال كل canvas بـ img ═══
    ['domainsBarChart', 'teachersPieChart'].forEach(function(id) {
      const canvas = document.getElementById(id);
      if (!canvas) return;

      let dataUrl;
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch (e) {
        console.warn('Canvas convert failed: ' + id);
        return;
      }
      if (!dataUrl || dataUrl.length < 100) return;

      const searchStr = 'id="' + id + '"';
      const idx = clonedHtml.indexOf(searchStr);
      if (idx < 0) return;

      const start = clonedHtml.lastIndexOf('<canvas', idx);
      if (start < 0) return;

      const end = clonedHtml.indexOf('</canvas>', idx);
      if (end < 0) return;
      const endFull = end + 9;

      const before = clonedHtml.substring(0, start);
      const after = clonedHtml.substring(endFull);
      const replacement = '<img src="' + dataUrl + '" ' +
        'style="max-width:100%;height:auto;display:block;margin:0 auto;' +
        'border:1px solid #e2e8f0;border-radius:6px;" alt="chart" />';

      clonedHtml = before + replacement + after;
    });

    const cssText =
      '@page{size:A4 portrait;margin:12mm 10mm}' +
      '*{box-sizing:border-box}' +
      'body{font-family:Tajawal,Arial,sans-serif;direction:rtl;text-align:right;' +
      'color:#1e293b;background:#fff;padding:0;margin:0;' +
      '-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.report-header{text-align:center;border-bottom:2px solid #177d82;' +
      'padding-bottom:8px;margin-bottom:15px}' +
      '.report-header .k1{font-weight:bold;font-size:13px}' +
      '.report-header .k2{font-weight:bold;font-size:12px;margin-top:2px}' +
      '.report-header h3{margin:6px 0 0;color:#177d82;font-size:15px}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:10px}' +
      'th{background:#334155;color:#fff;font-size:11px;padding:6px;border:1px solid #333}' +
      'td{border:1px solid #333;font-size:10.5px;padding:5px 6px;vertical-align:top;' +
      'line-height:1.35;color:#000}' +
      '.no-print,.toolbar,nav,.btn,button{display:none !important}' +
      '.stats-box-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}' +
      '.stat-mini-card{background:#f8fafc;border:1.5px solid #cbd5e1;padding:8px;' +
      'border-radius:8px;text-align:center}' +
      '.stat-mini-card .val{font-size:18px;font-weight:800;color:#177d82;margin-top:2px}' +
      '.charts-container{display:flex;gap:15px;margin-bottom:12px}' +
      '.chart-card{flex:1;background:#fff;border:1.5px solid #e2e8f0;padding:10px;' +
      'border-radius:10px;text-align:center}' +
      '.chart-title{font-weight:800;font-size:12.5px;color:#177d82;margin-bottom:6px}' +
      '.chart-inner-box{width:100%;height:auto}' +
      '.chart-inner-box img{max-width:100%;height:auto}' +
      '.report-header-print{display:block !important}' +
      '.print-page-1,.print-page-2{page-break-inside:avoid}' +
      '.print-page-1{page-break-after:always}' +
      '.print-page-2{page-break-before:always}' +
      '.two-column-table{width:100%;border-collapse:collapse}' +
      '.two-column-table th{background:#177d82;color:white;padding:8px;' +
      'font-size:12px;border:1px solid #177d82;text-align:center}' +
      '.two-column-table td{width:50%;vertical-align:top;padding:8px 12px;' +
      'border:1px solid #cbd5e1;font-size:10.5px;line-height:1.6}' +
      '.guide-table{width:100%;border-collapse:collapse}' +
      '.guide-table th{background:#334155;color:white;font-size:11px;padding:6px;' +
      'border:1px solid #333}' +
      '.guide-table td{border:1px solid #333;font-size:10.5px;padding:5px 6px;' +
      'vertical-align:top;line-height:1.35}' +
      'img{max-width:100%;height:auto}' +
      '.report-header-print{display:block !important;text-align:center !important;direction:rtl}' +
      '.report-header-print .k1{text-align:center !important;font-weight:bold;font-size:13px}' +
      '.report-header-print .k2{text-align:center !important;font-weight:bold;font-size:12px;margin-top:2px}' +
      '.report-header-print h3{text-align:center !important;margin:6px 0 0;color:#177d82;font-size:15px}';

    const fullHtml =
      '<!DOCTYPE html>' +
      '<html dir="rtl" lang="ar">' +
      '<head>' +
      '<meta charset="UTF-8">' +
      '<title>Report</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">' +
      '<style>' + cssText + '</style>' +
      '</head>' +
      '<body>' +
      '<div id="printRoot">' + clonedHtml + '</div>' +
      '</body>' +
      '</html>';

    const printWindow = window.open('', '', 'width=900,height=800');
    printWindow.document.open();
    printWindow.document.write(fullHtml);
    printWindow.document.close();
    printWindow.focus();

    const doPrint = function() {
      printWindow.print();
      setTimeout(function() { printWindow.close(); }, 300);
    };

    if (printWindow.document.fonts && printWindow.document.fonts.ready) {
      printWindow.document.fonts.ready.then(function() { setTimeout(doPrint, 300); });
    } else {
      setTimeout(doPrint, 900);
    }

    setTimeout(function() { document.title = originalTitle; }, 1500);
  }

  // ═══════════════════════════════════════════════════════════════
  // 12. دليل ETEC
  // ═══════════════════════════════════════════════════════════════
  function renderGuide() {
    const container = document.getElementById('guideContent');
    let html = '';
    guideData.forEach(function(g, idx) {
      html += '<div class="guide-domain-block" data-idx="' + idx + '">';
      html += '<div class="guide-mini-header">' +
              '<div class="gmh-line1">المملكة العربية السعودية | وزارة التعليم</div>' +
              '<div class="gmh-line2">الإدارة العامة للتعليم بمنطقة المدينة المنورة — متوسطة سعد بن الربيع الأنصاري</div>' +
              '</div>';
      html += '<div class="guide-page-header">مؤشرات شواهد الاعتماد المدرسي (ETEC)</div>';
      html += '<div class="guide-domain-title">' + g.domain + '</div>';
      html += '<table class="guide-table">';
      html += '<thead><tr>' +
              '<th width="14%">المؤشر</th>' +
              '<th width="41%">نص المؤشر</th>' +
              '<th width="45%">الشواهد المقبولة</th>' +
              '</tr></thead><tbody>';
      g.indicators.forEach(function(ind) {
        html += '<tr><td><strong>' + ind.code + '</strong></td>' +
                '<td>' + ind.name + '</td>' +
                '<td class="guide-hints">✓ ' + ind.hints.replace(/، /g, '<br>✓ ') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    });
    container.innerHTML = html;
  }

  function openGuideModal() {
    document.getElementById('guideModal').style.display = 'flex';
    renderGuide();
  }

  function closeGuideModal() {
    document.getElementById('guideModal').style.display = 'none';
  }
  // ═══════════════════════════════════════════════════════════════
  // 13. طباعة الدليل
  // ═══════════════════════════════════════════════════════════════
  function printGuideReport() {
    const content = document.getElementById('guideContent').innerHTML;
    const printWindow = window.open('', '', 'width=900,height=800');

    const cssText =
      '@page{size:A4 portrait;margin:15mm 15mm 18mm 15mm}' +
      '*{box-sizing:border-box}' +
      'body{font-family:Tajawal,Arial,sans-serif;direction:rtl;text-align:right;' +
      'color:#1e293b;padding:0 2mm;margin:0;background:#fff;font-size:10pt;' +
      '-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.guide-domain-block{page-break-before:always;page-break-after:always;' +
      'page-break-inside:avoid;margin:0;padding:0}' +
      '.guide-domain-block:first-child{page-break-before:auto}' +
      '.guide-domain-block:last-child{page-break-after:auto}' +
      '.guide-mini-header{text-align:center;padding-bottom:6px;margin-bottom:8px;' +
      'border-bottom:2px solid #177d82;page-break-after:avoid}' +
      '.gmh-line1{font-weight:800;font-size:11px;color:#177d82;line-height:1.3}' +
      '.gmh-line2{font-weight:600;font-size:9.5px;color:#334155;margin-top:2px;line-height:1.3}' +
      '.guide-page-header{text-align:center;color:#177d82;font-size:12px;' +
      'font-weight:800;margin:0 0 6px;padding-bottom:3px;' +
      'border-bottom:1px solid #177d82;page-break-after:avoid}' +
      '.guide-domain-title{background:#e6fffa;color:#13666b;padding:5px 10px;' +
      'font-size:12.5px;font-weight:800;border-radius:6px;margin:0 0 8px;' +
      'border-right:4px solid #177d82;page-break-after:avoid}' +
      '.guide-table{width:98%;border-collapse:collapse;margin:0 auto 8px;' +
      'border:2px solid #334155;table-layout:fixed}' +
      '.guide-table thead{display:table-header-group}' +
      '.guide-table tr{page-break-inside:avoid}' +
      '.guide-table th{background:#334155;color:#fff;font-size:10.5px;' +
      'padding:6px;border:1px solid #333;text-align:center}' +
      '.guide-table td{border:1px solid #333;font-size:10px;padding:5px 6px;' +
      'vertical-align:top;line-height:1.35;color:#000}' +
      '.guide-hints{color:#047857;font-weight:500}';

    const fullHtml =
      '<!DOCTYPE html>' +
      '<html dir="rtl" lang="ar">' +
      '<head>' +
      '<meta charset="UTF-8">' +
      '<title>الدليل الاسترشادي</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">' +
      '<style>' + cssText + '</style>' +
      '</head>' +
      '<body>' +
      '<div id="guideRoot">' + content + '</div>' +
      '</body>' +
      '</html>';

    printWindow.document.open();
    printWindow.document.write(fullHtml);
    printWindow.document.close();
    printWindow.focus();

    const doPrint = function() {
      printWindow.print();
      setTimeout(function() { printWindow.close(); }, 500);
    };

    if (printWindow.document.fonts && printWindow.document.fonts.ready) {
      printWindow.document.fonts.ready.then(function() { setTimeout(doPrint, 400); });
    } else {
      setTimeout(doPrint, 1000);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 14. الباركود QR
  // ═══════════════════════════════════════════════════════════════
  function openQrModal() {
    document.getElementById('qrModal').style.display = 'flex';
    const qrApi = 'https://api.qrserver.com/v1/create-qr-code/?size=350x350&margin=1&data=' + encodeURIComponent(officialPortalUrl);
    document.getElementById('qrImgDirect').src = qrApi;
  }

  function closeQrModal() {
    document.getElementById('qrModal').style.display = 'none';
  }

  function printQrCard() {
    const printContent = document.getElementById('printableQrArea').innerHTML;
    const printWindow = window.open('', '', 'width=650,height=700');

    printWindow.document.write(
      '<!DOCTYPE html>' +
      '<html dir="rtl" lang="ar">' +
      '<head>' +
      '<meta charset="UTF-8">' +
      '<title>طباعة رمز الدخول</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700;800&display=swap" rel="stylesheet">' +
      '<style>' +
      '@page { size: A4 portrait; margin: 15mm; }' +
      '* { box-sizing: border-box; }' +
      'body {' +
      '  font-family: "Tajawal", sans-serif;' +
      '  text-align: center; padding: 40px;' +
      '  direction: rtl;' +
      '  -webkit-print-color-adjust: exact;' +
      '  print-color-adjust: exact;' +
      '}' +
      'img { width: 320px; height: 320px; margin: 20px auto; display: block; }' +
      '.no-print, button { display: none !important; }' +
      '</style>' +
      '</head>' +
      '<body>' + printContent + '</body>' +
      '</html>'
    );
    printWindow.document.close();
    printWindow.focus();

    const doPrint = function() {
      printWindow.print();
      setTimeout(function() { printWindow.close(); }, 300);
    };

    if (printWindow.document.fonts && printWindow.document.fonts.ready) {
      printWindow.document.fonts.ready.then(function() { setTimeout(doPrint, 200); });
    } else {
      setTimeout(doPrint, 600);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 15. إغلاق Modals على النقر خارجها
  // ═══════════════════════════════════════════════════════════════
  function closeModalOnOverlay(e) {
    if (e.target.id === 'guideModal') closeGuideModal();
    if (e.target.id === 'qrModal') closeQrModal();
    if (e.target.id === 'statsModal') closeStatsModal();
  }

  // ═══════════════════════════════════════════════════════════════
  // 16. بحث في الجدول
  // ═══════════════════════════════════════════════════════════════
  function filterTable() {
    const filter = document.getElementById('searchInput').value.toLowerCase();
    const trs = document.getElementById('evidenceTable').getElementsByTagName('tr');
    for (let i = 1; i < trs.length; i++) {
      const txt = trs[i].textContent || trs[i].innerText;
      trs[i].style.display = txt.toLowerCase().indexOf(filter) > -1 ? '' : 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 17. تفريغ تجريبي (حماية مزدوجة)
  // ═══════════════════════════════════════════════════════════════
  function confirmPurge() {
    const count = (allRecords && allRecords.length) ? allRecords.length : 0;

    const warningMsg =
      '⚠️ تحذير خطير — تفريغ شامل\\n\\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\\n' +
      '📊 السجلات الحالية: ' + count + ' سجل\\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n' +
      'ما سيحدث:\\n' +
      '  🔴 حذف ' + count + ' سجلاً من ورقة الردود\\n' +
      '  ✅ إنشاء نسخة احتياطية تلقائياً\\n' +
      '  ✅ الاحتفاظ بآخر نسختين احتياطيتين فقط\\n' +
      '  ✅ ملفات PDF في Drive لن تُحذف\\n' +
      '  ✅ يمكن الاستعادة عبر: FIX_RestoreResponsesFromLatestBackup\\n\\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\\n' +
      'للمتابعة، اكتب رقم سجلك المدني (كلمة المرور):';

    const inputPassword = prompt(warningMsg);

    if (inputPassword === null) return;

    const expectedPassword = String((currentUser && currentUser.nationalId) || '').trim();
    const enteredPassword  = String(inputPassword).trim();

    if (!expectedPassword || enteredPassword !== expectedPassword) {
      alert('❌ كلمة المرور غير صحيحة.\\n\\nتم إلغاء العملية.');
      return;
    }

    const finalConfirm =
      '✅ تم التحقق من كلمة المرور.\\n\\n' +
      'أنت على وشك حذف ' + count + ' سجلاً.\\n\\n' +
      'هل تريد المتابعة؟';

    if (!confirm(finalConfirm)) return;

    const btn = document.getElementById('btnAdminPurge');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ جاري التفريغ...';
    }

    fetch(officialPortalUrl + '?action=purge&t=' + Date.now())
      .then(res => res.text())
      .then(result => {
        if (result === 'SUCCESS') {
          refreshRecordsAfterChange('✅ تم التفريغ بنجاح!\\n\\nتم إنشاء نسخة احتياطية تلقائياً.');
        } else {
          alert('⚠️ النتيجة: ' + result);
          if (btn) {
            btn.disabled = false;
            btn.textContent = '🗑️ تفريغ التجارب الشامل';
          }
        }
      })
      .catch(err => {
        alert('❌ خطأ في التنفيذ: ' + err.message);
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🗑️ تفريغ التجارب الشامل';
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // 18. استيراد NUR
  // ═══════════════════════════════════════════════════════════════
  function confirmNurImport() {
    if (!confirm("⚠️ سيتم استيراد بيانات المنسوبين من مجلد NUR_Imports.\\n\\nهل أنت متأكد؟")) return;
    const btn = document.getElementById('btnImportNur');
    btn.disabled = true;
    btn.textContent = '⏳ جاري الاستيراد...';
    google.script.run
      .withSuccessHandler(onImportSuccess)
      .withFailureHandler(onImportError)
      .runNurImport();
  }

  function onImportSuccess(result) {
    const btn = document.getElementById('btnImportNur');
    btn.disabled = false;
    btn.textContent = '📥 استيراد بيانات المنسوبين';
    if (result && result.success) {
      alert("✅ نجح الاستيراد!\\n\\n📁 الملفات: " + result.filesProcessed + "\\n📊 السجلات: " + result.recordsExtracted + "\\n➕ جديد: " + result.merge.added + "\\n🔄 محدّث: " + result.merge.updated + "\\n📤 منقول: " + result.merge.transferred);
      setTimeout(() => { window.location.href = officialPortalUrl + '?t=' + Date.now(); }, 1500);
    } else {
      alert("⚠️ فشل: " + (result && result.message ? result.message : "خطأ غير معروف"));
    }
  }

  function onImportError(err) {
    const btn = document.getElementById('btnImportNur');
    btn.disabled = false;
    btn.textContent = '📥 استيراد بيانات المنسوبين';
    alert("❌ خطأ: " + err.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // 19. استعادة الجلسة المحفوظة
  // ═══════════════════════════════════════════════════════════════
  // ═══ يُنفَّذ مرة واحدة عند تحميل الصفحة ═══
  bindUploadDrop('upDrop1', 'upEv1', 'ev1');
  bindUploadDrop('upDrop2', 'upEv2', 'ev2');
  const savedUser = sessionStorage.getItem('evidence_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    renderDashboard();
  }
<\/script>
</body>
</html>`;

    return HtmlService.createHtmlOutput(html)
      .setTitle("بوابة شواهد التقويم والاعتماد المدرسي")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');

  } catch (err) {
    return ContentService.createTextOutput("خطأ حرج في النظام: " + err.toString());
  }
}

/**
 * استيراد بيانات المنسوبين من مجلد نور.
 */
function runNurImport() {
  return Feature_ImportService.importFromNurFolder();
}