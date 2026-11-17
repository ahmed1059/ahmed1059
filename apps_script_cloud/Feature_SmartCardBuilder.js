/**
 * ==============================================================================
 * Feature_SmartCardBuilder.gs — محرك توليد بطاقة الشاهد الرسمية (v2.0.0)
 * المعيار: 1059-Pro — هندسة الصفحة الواحدة الصارمة (Single-Page Guarantee)
 * ------------------------------------------------------------------------------
 * التحديثات في v2.0.0:
 *   - حاوية A4 صارمة: 195mm × 277mm مع overflow: hidden
 *   - ترويسة ثابتة 20mm، تذييل 10mm مع margin-top: auto
 *   - الشواهد Base64 مباشر (لا fetch، لا انتظار)
 *   - انتظار تحميل الصور قبل الطباعة (waitForImagesAndPrint)
 *   - صفحة واحدة دائماً — بلا استثناء
 * ==============================================================================
 */

const Feature_SmartCardBuilder = (function () {

  const C = {
    PRIMARY:      '#177d82',
    PRIMARY_DARK: '#0d4d50',
    TEXT:         '#0f172a',
    MUTED:        '#64748b',
    BORDER:       '#cbd5e1',
    LIGHT_BG:     '#f8fafc',
    TITLE_BG:     '#e6fffa',
    SIG_BG:       '#f1f5f9'
  };

  function _esc(t) {
    if (t === null || t === undefined) return '';
    return String(t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _extractFileId(url) {
    if (!url) return '';
    const s = String(url).trim();
    let m = s.match(/\/file\/d\/([-\w]{25,})/);
    if (m) return m[1];
    m = s.match(/[?&]id=([-\w]{25,})/);
    if (m) return m[1];
    m = s.match(/\/d\/([-\w]{25,})/);
    if (m) return m[1];
    m = s.match(/([-\w]{25,})/);
    return m ? m[1] : '';
  }

  /**
   * جلب صورة كـ Base64 — متزامن مع الكاش وDrive
   */
  function _resolveBase64Image(fileIdOrUrl) {
    if (!fileIdOrUrl) return '';
    const fileId = _extractFileId(fileIdOrUrl);
    if (!fileId) return '';

    // 1. فحص كاش الصور
    try {
      if (typeof Feature_ImageCacheService !== 'undefined') {
        const cached = Feature_ImageCacheService.get(fileId);
        if (cached) return cached;
      }
    } catch (e) {}

    // 2. الجلب من Drive
    try {
      if (typeof extractImageAsBase64 === 'function') {
        const b64 = extractImageAsBase64('https://drive.google.com/open?id=' + fileId);
        if (b64 && typeof Feature_ImageCacheService !== 'undefined') {
          Feature_ImageCacheService.put(fileId, b64);
        }
        return b64 || '';
      }
    } catch (e) {
      Logger.log('⚠️ _resolveBase64Image error: ' + e.toString());
    }
    return '';
  }

  function _evidenceCell(dataUrl, fileUrl, label) {
    const safeUrl = _esc(fileUrl || '');
    const safeLabel = _esc(label || '');
    if (dataUrl) {
      return '<div class="evidence-cell"><img src="' + dataUrl.replace(/\s/g, '') + '" alt="' + safeLabel + '" style="cursor:pointer;" title="انقر لعرض الشاهد كاملاً" onclick="openEvidenceModal(\'' + safeUrl + '\', \'' + safeLabel + '\')"></div>';
    }
    const fileId = _extractFileId(fileUrl);
    if (!fileId) return '';
    return '<div class="evidence-cell" onclick="openEvidenceModal(\'' + safeUrl + '\', \'' + safeLabel + '\')">' +
      '<iframe src="https://drive.google.com/file/d/' + fileId + '/preview" style="width:100%;height:100%;border:none;pointer-events:none;"></iframe>' +
      '</div>';
  }

  /**
   * بناء البطاقة الذكية v2.0.0
   */
  function build(data, teacher, previewMode) {
    data = data || {};
    const S = (typeof SettingsService !== 'undefined') ? SettingsService.getAll() : {};

    const teacherName = (teacher && teacher.name) || data.teacherName || '-';
    const teacherRole = (teacher && teacher.role) || 'معلم';
    const term = data.term || 'الفصل الدراسي الأول';
    const date = Utilities.formatDate(new Date(), 'Asia/Riyadh', 'yyyy/MM/dd');
    const grade = data.grade || '-';
    const domain = data.domain || '-';
    const indicator = data.indicator || '-';
    const actionTitle = data.actionTitle || '-';
    const actionDesc = data.actionDesc || '-';
    const impact = data.impact || '-';

    // ═══ تحديد المعتمد ═══
    const approver = String(data.approver || '').trim();
    const isTeachersApprover = approver.indexOf('المعلمين') !== -1;
    const isStudentsApprover = approver.indexOf('الطلاب') !== -1;

    let approverSigId = '';
    let approverName = '';
    let approverRole = '';

    if (isTeachersApprover) {
      approverSigId = S.approver_teachers_sig_id;
      approverName = S.approver_teachers_name;
      approverRole = S.approver_teachers_role;
    } else if (isStudentsApprover) {
      approverSigId = S.approver_students_sig_id;
      approverName = S.approver_students_name;
      approverRole = S.approver_students_role;
    } else {
      approverSigId = S.approver_students_sig_id;
      approverName = S.approver_students_name;
      approverRole = S.approver_students_role;
    }

    // ═══ تحميل الصور كـ Base64 مباشر ═══
    const logoBase64 = _resolveBase64Image(Core_Config.get('MOE_LOGO_FILE_ID'));
    const managerSigBase64 = _resolveBase64Image(S.manager_sig_id);
    const approverSigBase64 = _resolveBase64Image(approverSigId);
    let executorSig = '';
    try {
      const nationalId = teacher && teacher.nationalId;
      if (nationalId && typeof Feature_SignatureService !== 'undefined') {
        const saved = Feature_SignatureService.embed(nationalId);
        if (saved) executorSig = saved;
      }
    } catch (e) {
      Logger.log('⚠️ توقيع المنفذ: ' + e.toString());
    }

    const ev1Base64 = _resolveBase64Image(data.evidence1);
    const ev2Base64 = _resolveBase64Image(data.evidence2);

    const hasEv1 = !!ev1Base64;
    const hasEv2 = !!ev2Base64;

    // ═══ أزرار المعاينة (previewMode فقط) ═══
    const printButtons = previewMode
      ? '<div class="no-print" style="position:fixed;bottom:20px;left:20px;z-index:9999;display:flex;gap:10px;">' +
        '<button onclick="window.print()" style="padding:10px 20px;background:#177d82;color:white;border:none;border-radius:6px;font-weight:bold;font-size:13px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.15);">🖨️ طباعة</button>' +
        '' +  // ✕ إغلاق محذوف (مكرر مع ✕ رأس النافذة)
        '</div>'
      : '';

    // ═══ سكربت الطباعة التلقائية — ينتظر تحميل كل الصور ═══
    const autoPrintScript = previewMode
      ? ''
      : '<script>' +
        '(function() {' +
        '  function waitForImagesAndPrint() {' +
        '    var images = document.querySelectorAll("img");' +
        '    var pending = 0, done = false;' +
        '    function checkComplete() {' +
        '      pending--;' +
        '      if (pending <= 0 && !done) {' +
        '        done = true;' +
        '        setTimeout(function() { window.print(); }, 300);' +
        '      }' +
        '    }' +
        '    images.forEach(function(img) {' +
        '      if (img.complete && img.naturalHeight !== 0) return;' +
        '      pending++;' +
        '      img.addEventListener("load", checkComplete);' +
        '      img.addEventListener("error", checkComplete);' +
        '    });' +
        '    if (pending === 0) {' +
        '      setTimeout(function() { window.print(); }, 1500);' +
        '    } else {' +
        '      setTimeout(function() {' +
        '        if (!done) { done = true; window.print(); }' +
        '      }, 15000);' +
        '    }' +
        '  }' +
        '  if (document.readyState === "complete") {' +
        '    setTimeout(waitForImagesAndPrint, 500);' +
        '  } else {' +
        '    window.addEventListener("load", function() {' +
        '      setTimeout(waitForImagesAndPrint, 500);' +
        '    });' +
        '  }' +
        '})();' +
        '<\/script>';

    // ═══ HTML الكامل ═══
    let html = '<!DOCTYPE html>' +
      '<html lang="ar" dir="rtl">' +
      '<head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>بطاقة شاهد — ' + _esc(teacherName) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">' +
      '<style>' +

      // ═══ الصفحة A4 — حجم صارم ═══
      '@page { size: A4 portrait; margin: 10mm 8mm; }' +
      '* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
      'html, body { margin: 0; padding: 0; background: #ffffff; font-family: "Tajawal", Arial, sans-serif; color: ' + C.TEXT + '; direction: rtl; text-align: right; }' +

      // ═══ الحاوية الرئيسية ═══
      '.a4-page {' +
      '  width: 100%;' +
      '  max-width: 210mm;' +
      '  height: 277mm;' +
      '  max-height: 277mm;' +
      '  min-height: 277mm;' +
      '  margin-left: auto;' +
      '  margin-right: auto;' +
      '  padding: 5mm 6mm;' +
      '  background: #ffffff;' +
      '  border: 1.5px solid ' + C.PRIMARY + ';' +
      '  display: flex;' +
      '  flex-direction: column;' +
      '  overflow: hidden;' +
      '  page-break-inside: avoid !important;' +
      '  page-break-after: avoid !important;' +
      '}' +

      // ═══ الترويسة: 20mm ═══
      '.header-box {' +
      '  height: 20mm;' +
      '  max-height: 20mm;' +
      '  display: grid;' +
      '  grid-template-columns: 1.6fr 0.6fr 1.0fr;' +
      '  align-items: center;' +
      '  border-bottom: 2px solid ' + C.PRIMARY + ';' +
      '  padding-bottom: 2mm;' +
      '  margin-bottom: 2mm;' +
      '}' +
      '.h-right,.h-center,.h-left{display:block;width:100%}' +
      '.h-center *{text-align:center !important}' +
      '.h-left *{text-align:left !important}' +
      '.h-right *{text-align:center !important}' +
      '.h-right { font-size: 8pt; font-weight: 700; line-height: 1.35; color: ' + C.PRIMARY + '; text-align: center; }' +
      '.h-right .school { font-size: 9pt; font-weight: 800; }' +
      '.h-center { text-align: center; }' +
      '.h-center .logo { height: 15mm; max-height: 15mm; width: auto; display: block; margin: 0 auto; object-fit: contain; }' +
      '.h-left { text-align: left; font-size: 8pt; line-height: 1.35; color: #334155; direction: rtl; }' +
      '.h-left strong { color: ' + C.PRIMARY + '; }' +

      // ═══ شريط العنوان ═══
      '.title-badge {' +
      '  background: ' + C.TITLE_BG + ';' +
      '  color: ' + C.PRIMARY_DARK + ';' +
      '  border: 1px solid ' + C.PRIMARY + ';' +
      '  border-radius: 4px;' +
      '  padding: 2px 8px;' +
      '  text-align: center;' +
      '  font-size: 9.5pt;' +
      '  font-weight: 800;' +
      '  margin-bottom: 2mm;' +
      '}' +

      // ═══ جدول البيانات ═══
      '.data-table { width: 100%; border-collapse: collapse; margin-bottom: 2mm; font-size: 8pt; }' +
      '.data-table th {' +
      '  width: 16%;' +
      '  background: ' + C.SIG_BG + ';' +
      '  color: ' + C.PRIMARY + ';' +
      '  border: 1px solid ' + C.BORDER + ';' +
      '  padding: 3px 5px;' +
      '  font-weight: 700;' +
      '  vertical-align: middle;' +
      '}' +
      '.data-table td {' +
      '  border: 1px solid ' + C.BORDER + ';' +
      '  padding: 3px 5px;' +
      '  vertical-align: middle;' +
      '  background: #ffffff;' +
      '}' +

      // ═══ الوصف والأثر ═══
      '.narrative-grid {' +
      '  display: grid;' +
      '  grid-template-columns: 1fr 1fr;' +
      '  gap: 4px;' +
      '  height: 44mm;' +
      '  max-height: 44mm;' +
      '  margin-bottom: 2mm;' +
      '}' +
      '.narrative-box {' +
      '  border: 1px solid ' + C.BORDER + ';' +
      '  border-radius: 4px;' +
      '  background: ' + C.LIGHT_BG + ';' +
      '  display: flex;' +
      '  flex-direction: column;' +
      '  overflow: hidden;' +
      '}' +
      '.narrative-title {' +
      '  background: ' + C.PRIMARY + ';' +
      '  color: #ffffff;' +
      '  font-size: 8pt;' +
      '  font-weight: 700;' +
      '  padding: 2.5px 6px;' +
      '}' +
      '.narrative-content {' +
      '  padding: 4px 6px;' +
      '  font-size: 7.5pt;' +
      '  line-height: 1.4;' +
      '  color: #1e293b;' +
      '  overflow: hidden;' +
      '}' +

      // ═══ الشواهد المصورة ═══
      '.section-bar {' +
      '  background: ' + C.PRIMARY_DARK + ';' +
      '  color: #ffffff;' +
      '  font-size: 8pt;' +
      '  font-weight: 700;' +
      '  padding: 2px 6px;' +
      '  border-radius: 4px 4px 0 0;' +
      '  text-align: center;' +
      '}' +
      '.evidence-grid {' +
      '  display: grid;' +
      '  grid-template-columns: ' + (hasEv1 && hasEv2 ? '1fr 1fr' : '1fr') + ';' +
      '  gap: 4px;' +
      '  height: 94mm;' +
      '  max-height: 94mm;' +
      '  border: 1px solid ' + C.BORDER + ';' +
      '  border-top: none;' +
      '  padding: 4px;' +
      '  margin-bottom: 2mm;' +
      '  background: #ffffff;' +
      '}' +
      '.evidence-cell {' +
      '  border: 1px dashed ' + C.BORDER + ';' +
      '  border-radius: 4px;' +
      '  display: flex;' +
      '  align-items: center;' +
      '  justify-content: center;' +
      '  overflow: hidden;' +
      '  background: #fcfcfc;' +
      '  height: 100%;' +
      '}' +
      '.evidence-cell img {' +
      '  max-width: 100%;' +
      '  max-height: 100%;' +
      '  object-fit: contain;' +
      '  display: block;' +
      '}' +
      '.no-evidence { color: ' + C.MUTED + '; font-size: 8pt; font-weight: 500; }' +

      // ═══ التوقيعات ═══
      '.signatures-grid {' +
      '  display: grid;' +
      '  grid-template-columns: 1fr 1fr 1fr;' +
      '  gap: 6px;' +
      '  height: 22mm;' +
      '  max-height: 22mm;' +
      '  border-top: 1px solid ' + C.BORDER + ';' +
      '  padding-top: 2mm;' +
      '  margin-bottom: 1.5mm;' +
      '  /* margin-top: auto; -- منقول إلى signatures-section-bar */' +
      '  text-align: center;' +
      '}' +
      '.sig-col { display: flex; flex-direction: column; justify-content: space-between; }' +
      '.sig-role { font-size: 7.5pt; font-weight: 800; color: ' + C.PRIMARY + '; }' +
      '.sig-slot { height: 11mm; display: flex; align-items: center; justify-content: center; overflow: hidden; }' +
      '.sig-img { max-height: 11mm; max-width: 85%; object-fit: contain; }' +
      '.sig-name { font-size: 7.5pt; font-weight: 600; color: #334155; }' +
      '.signatures-section-bar { margin-top: auto; }' +

      // ═══ التذييل: 10mm ملاصق للقاع ═══
      '.footer-bar {' +
      '  height: 10mm;' +
      '  max-height: 10mm;' +
      '  /* margin-top: auto; -- منقول إلى signatures-grid */' +
      '  position: relative;' +
      '  text-align: center;' +
      '  border-top: 1px solid #cbd5e1;' +
      '  display: flex;' +
      '  justify-content: space-between;' +
      '  align-items: center;' +
      '  font-size: 7.5pt;' +
      '  color: ' + C.MUTED + ';' +
      '  padding-top: 8px;' +
      '}' +

      // ═══ إخفاء الأزرار في الطباعة ═══
      '@media print {' +
      '  .no-print, button { display: none !important; }' +
      '  body { background: #ffffff !important; padding: 0 !important; }' +
      '  .a4-page { border: none !important; margin-left: auto !important; margin-right: auto !important; width: 100% !important; max-width: 210mm !important; min-height: 277mm !important; }' +
      '}' +
      '.ev-modal-overlay { display:none; position:fixed; inset:0; background:rgba(15,23,42,0.85); z-index:99999; justify-content:center; align-items:center; padding:20px; }' +
      '.ev-modal-overlay.active { display:flex !important; }' +
      '.ev-modal-box { width:95%; max-width:1100px; height:90vh; background:white; border-radius:10px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.4); }' +
      '.ev-modal-header { background:#177d82; color:white; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; }' +
      '.ev-modal-close { background:#64748b; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px; }' +
      '.ev-modal-body { flex:1; background:#e2e8f0; }' +
      '</style>' +
      '</head>' +
      '<body>' +

      '<div class="a4-page">' +

      // ═══ الترويسة ═══
      '<div class="header-box">' +
        '<div class="h-right">' +
          _esc(S.kingdom_name || 'المملكة العربية السعودية') + '<br>' +
          _esc(S.ministry_name || 'وزارة التعليم') + '<br>' +
          _esc(S.region_name || 'الإدارة العامة للتعليم بمنطقة المدينة المنورة') + '<br>' +
          '<span class="school">' + _esc(S.school_name || 'متوسطة سعد بن الربيع الأنصاري') + '</span>' +
        '</div>' +
        '<div class="h-center">' +
          (logoBase64 ? '<img class="logo" src="' + logoBase64 + '" alt="شعار الوزارة">' : '<div style="font-size:8pt;font-weight:bold;color:#177d82;">وزارة التعليم</div>') +
        '</div>' +
        '<div class="h-left">' +
          '<div><strong>التاريخ:</strong> ' + date + '</div>' +
          '<div><strong>الفترة:</strong> ' + _esc(term) + '</div>' +
          '<div><strong>الصف:</strong> ' + _esc(grade) + '</div>' +
        '</div>' +
      '</div>' +

      // ═══ عنوان البطاقة ═══
      '<div class="title-badge">' + _esc(S.card_title || 'بطاقة توثيق شاهد تقويم واعتماد مدرسي') + '</div>' +

      // ═══ جدول البيانات ═══
      '<table class="data-table">' +
        '<tr>' +
          '<th>اسم المنفذ</th><td><strong>' + _esc(teacherName) + '</strong></td>' +
          '<th style="width:14%;">الصفة / الدور</th><td style="width:34%;">' + _esc(teacherRole) + '</td>' +
        '</tr>' +
        '<tr><th>المجال</th><td colspan="3">' + _esc(domain) + '</td></tr>' +
        '<tr><th>المؤشر المستهدف</th><td colspan="3"><strong>' + _esc(indicator) + '</strong></td></tr>' +
        '<tr><th>عنوان الإجراء</th><td colspan="3"><strong>' + _esc(actionTitle) + '</strong></td></tr>' +
      '</table>' +

      // ═══ الوصف والأثر ═══
      '<div class="narrative-grid">' +
        '<div class="narrative-box">' +
          '<div class="narrative-title">📋 وصف الإجراء وخطوات التنفيذ</div>' +
          '<div class="narrative-content">' + _esc(actionDesc).replace(/\n/g, '<br>') + '</div>' +
        '</div>' +
        '<div class="narrative-box">' +
          '<div class="narrative-title">📊 الأثر المتحقق والنتائج بالأرقام</div>' +
          '<div class="narrative-content">' + _esc(impact).replace(/\n/g, '<br>') + '</div>' +
        '</div>' +
      '</div>' +

      // ═══ الشواهد المصورة ═══
      '<div class="section-bar">📸 الشواهد المصورة والأدلة الميدانية</div>' +
      '<div class="evidence-grid">' +
        _evidenceCell(ev1Base64, data.evidence1, 'الشاهد الأول') +
        _evidenceCell(ev2Base64, data.evidence2, 'الشاهد الثاني') +
        ((!ev1Base64 && !data.evidence1 && !ev2Base64 && !data.evidence2) ? '<div class="evidence-cell"><div class="no-evidence">لا توجد شواهد مرفقة</div></div>' : '') +
      '</div>' +

      // ═══ التوقيعات ═══
      '<div class="section-bar signatures-section-bar">التوقيعات والاعتمادات</div>' +
      '<div class="signatures-grid">' +
        '<div class="sig-col">' +
          '<div class="sig-role">إعداد وتوقيع المنفذ</div>' +
          '<div class="sig-slot">' + (executorSig ? '<img class="sig-img" src="' + executorSig + '">' : '<span style="color:#94a3b8;font-size:7pt;">التوقيع: .....................</span>') + '</div>' +
          '<div class="sig-name">' + _esc(teacherName) + '</div>' +
        '</div>' +
        '<div class="sig-col">' +
          '<div class="sig-role">اعتماد: ' + _esc(approverRole || '-') + '</div>' +
          '<div class="sig-slot">' + (approverSigBase64 ? '<img class="sig-img" src="' + approverSigBase64 + '">' : '<span style="color:#94a3b8;font-size:7pt;">الاعتماد: .....................</span>') + '</div>' +
          '<div class="sig-name">' + _esc(approverName || '-') + '</div>' +
        '</div>' +
        '<div class="sig-col">' +
          '<div class="sig-role">اعتماد مدير المدرسة</div>' +
          '<div class="sig-slot">' + (managerSigBase64 ? '<img class="sig-img" src="' + managerSigBase64 + '">' : '<span style="color:#94a3b8;font-size:7pt;">الختم: .....................</span>') + '</div>' +
          '<div class="sig-name">' + _esc(S.manager_name || '-') + '</div>' +
        '</div>' +
      '</div>' +

      // ═══ التذييل ═══
      '<div class="footer-bar">' +
        '<div>' + _esc(S.footer_text || 'وثيقة رسمية — متوسطة سعد بن الربيع الأنصاري') + '</div>' +
        '<div>الصفحة 1 من 1</div>' +
      '</div>' +

      '</div>' + // نهاية .a4-page

      printButtons +
      '<div id="evidenceModal" class="ev-modal-overlay" onclick="closeEvidenceOnOverlay(event)">' +
        '<div class="ev-modal-box">' +
          '<div class="ev-modal-header">' +
            '<h3 id="evModalTitle" style="margin:0;font-size:15px;">معاينة الشاهد</h3>' +
            '<button type="button" class="ev-modal-close" onclick="closeEvidenceModal()">✕ إغلاق</button>' +
          '</div>' +
          '<div class="ev-modal-body">' +
            '<iframe id="evFrame" src="" style="width:100%;height:100%;border:none;"></iframe>' +
          '</div>' +
        '</div>' +
      '</div>' +
      autoPrintScript +

      '<script>' +
      'function closeCardPreview() {' +
      '  try {' +
      '    if (window.parent && window.parent !== window) {' +
      '      window.parent.postMessage({type:"closeCardPreview"}, "*");' +
      '      return;' +
      '    }' +
      '  } catch(e) {}' +
      '  try {' +
      '    if (window.top && window.top !== window) {' +
      '      window.top.postMessage({type:"closeCardPreview"}, "*");' +
      '      return;' +
      '    }' +
      '  } catch(e) {}' +
      '  window.close();' +
      '}' +
      'function openEvidenceModal(url, title) {' +
      '  if (!url) { alert("⚠️ لا يوجد رابط لهذا الشاهد."); return; }' +
      '  var m = String(url).match(/\\/file\\/d\\/([-\\w]{25,})/);' +
      '  if (!m) m = String(url).match(/[?&]id=([-\\w]{25,})/);' +
      '  if (!m) { alert("⚠️ رابط غير صالح."); return; }' +
      '  var fileId = m[1];' +
      '  var embedUrl = "https://drive.google.com/file/d/" + fileId + "/preview";' +
      '  document.getElementById("evModalTitle").textContent = title || "معاينة الشاهد";' +
      '  document.getElementById("evFrame").src = embedUrl;' +
      '  document.getElementById("evidenceModal").classList.add("active");' +
      '}' +
      'function closeEvidenceModal() {' +
      '  document.getElementById("evidenceModal").classList.remove("active");' +
      '  document.getElementById("evFrame").src = "";' +
      '}' +
      'function closeEvidenceOnOverlay(e) {' +
      '  if (e.target && e.target.id === "evidenceModal") closeEvidenceModal();' +
      '}' +
      '<\/script>' +
      '</body>' +
      '</html>';

    return html;
  }

  return {
    build: build
  };

})();