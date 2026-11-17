/**
 * ==============================================================================
 * Feature_SubmissionService.gs — خدمة معالجة النماذج والشواهد
 * الإصدار: 3.1.0 (موحّد — مُصحَّح وفق 1059-Pro)
 * ==============================================================================
 */

/* ============================================================================
 * SECTION 1: Image Cache + extractImageAsBase64
 * ============================================================================ */

const _IMAGE_CACHE = {};

function _getCachedImage(url) {
  if (!url) return '';

  const key = String(url).trim();

  // ═══ محاولة CacheService أولاً ═══
  try {
    if (typeof Feature_ImageCacheService !== 'undefined') {
      const cached = Feature_ImageCacheService.get(key);
      if (cached) return cached;
    }
  } catch (e) {}

  // ═══ من الذاكرة الحية ═══
  if (_IMAGE_CACHE[key] !== undefined) {
    return _IMAGE_CACHE[key];
  }

  // ═══ اقرأ من Drive ═══
  const b64 = extractImageAsBase64(key);
  _IMAGE_CACHE[key] = b64;

  // ═══ احفظ في الكاش الدائم ═══
  try {
    if (b64 && typeof Feature_ImageCacheService !== 'undefined') {
      Feature_ImageCacheService.put(key, b64);
    }
  } catch (e) {}

  return b64;
}

function _hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h' + Math.abs(hash).toString(36);
}

function extractImageAsBase64(input) {
  if (!input) return '';

  try {
    let fileId = '';

    if (typeof input === 'object' && input.getId) {
      fileId = input.getId();
    } else {
      const urlStr = String(input).trim();
      if (!urlStr || urlStr === 'undefined' || urlStr === 'null') return '';

      let match = urlStr.match(/\/file\/d\/([-\w]{25,})/);
      if (match) fileId = match[1];

      if (!fileId) {
        match = urlStr.match(/[?&]id=([-\w]{25,})/);
        if (match) fileId = match[1];
      }

      if (!fileId) {
        match = urlStr.match(/\/d\/([-\w]{25,})/);
        if (match) fileId = match[1];
      }

      if (!fileId) {
        match = urlStr.match(/([-\w]{25,})/);
        if (match) fileId = match[1];
      }
    }

    if (!fileId) return '';

    const file = DriveApp.getFileById(fileId);
    const mimeType = file.getMimeType();

    // ═══ 1. صور عادية ═══
    if (mimeType.indexOf('image/') === 0) {
      const blob = file.getBlob();
      const bytes = blob.getBytes();

      if (bytes.length > 800000) {
        Logger.log('🗜️ ضغط صورة: ' + Math.round(bytes.length/1024) + 'KB');
        return _resizeImageBase64(file, 1200);
      }

      const base64 = Utilities.base64Encode(bytes);
      return 'data:' + mimeType + ';base64,' + base64;
    }

    // ═══ 2. PDF و Google Docs ═══
    if (mimeType === 'application/pdf' ||
        mimeType.indexOf('application/vnd.google-apps') === 0) {
      const thumb = _tryThumbnail(fileId);
      if (thumb) return thumb;

      Logger.log('⚠️ PDF thumbnail فشل — محاولة تحويل');
      try {
        const pdfFile = DriveApp.getFileById(fileId);
        const blob = pdfFile.getBlob();

        const converted = Drive.Files.insert({
          title: 'TEMP_PDF_' + Date.now(),
          mimeType: MimeType.GOOGLE_DOCS
        }, blob, { convert: true });

        Utilities.sleep(800);

        const tempThumb = _tryThumbnail(converted.id);

        try {
          DriveApp.getFileById(converted.id).setTrashed(true);
        } catch (e) {}

        if (tempThumb) return tempThumb;
      } catch (e) {
        Logger.log('⚠️ PDF fallback فشل: ' + e.toString());
      }

      return '';
    }

    // ═══ 3. Word / Excel / PowerPoint ═══
    if (mimeType.indexOf('application/vnd.openxmlformats') === 0 ||
        mimeType.indexOf('application/msword') === 0 ||
        mimeType.indexOf('application/vnd.ms-') === 0) {
      Logger.log('📄 Office file: ' + mimeType);
      return _officeToImage(fileId);
    }

    Logger.log('⚠️ mimeType غير معروف: ' + mimeType);
    return '';
  } catch (err) {
    Logger.log('extractImageAsBase64 error: ' + err.toString());
    return '';
  }
}

function _tryThumbnail(fileId) {
  try {
    const thumbUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w600';
    const response = UrlFetchApp.fetch(thumbUrl, {
      headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
      followRedirects: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('Thumbnail فشل: ' + response.getResponseCode());
      return '';
    }

    const blob = response.getBlob();
    const bytes = blob.getBytes();
    if (bytes.length < 100) return '';

    return 'data:image/png;base64,' + Utilities.base64Encode(bytes);
  } catch (e) {
    Logger.log('Thumbnail error: ' + e.toString());
    return '';
  }
}

function _officeToImage(fileId) {
  let tempDocId = null;
  try {
    const sourceFile = DriveApp.getFileById(fileId);
    const blob = sourceFile.getBlob();
    const mime = sourceFile.getMimeType();

    let targetMime;
    if (mime.indexOf('word') !== -1) {
      targetMime = MimeType.GOOGLE_DOCS;
    } else if (mime.indexOf('sheet') !== -1 || mime.indexOf('excel') !== -1) {
      targetMime = MimeType.GOOGLE_SHEETS;
    } else if (mime.indexOf('presentation') !== -1) {
      targetMime = MimeType.GOOGLE_SLIDES;
    } else {
      targetMime = MimeType.GOOGLE_DOCS;
    }

    const newFile = Drive.Files.insert(
      { title: 'TEMP_' + Date.now(), mimeType: targetMime },
      blob,
      { convert: true }
    );
    tempDocId = newFile.id;

    Utilities.sleep(800);

    const thumbUrl = 'https://drive.google.com/thumbnail?id=' + tempDocId + '&sz=w1200';
    const response = UrlFetchApp.fetch(thumbUrl, {
      headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
      followRedirects: true
    });

    if (response.getResponseCode() === 200) {
      const bytes = response.getBlob().getBytes();
      if (bytes.length > 100) {
        return 'data:image/png;base64,' + Utilities.base64Encode(bytes);
      }
    }

    return '';
  } catch (e) {
    Logger.log('Office conversion error: ' + e.toString());
    return '';
  } finally {
    if (tempDocId) {
      try {
        DriveApp.getFileById(tempDocId).setTrashed(true);
      } catch (e) {}
    }
  }
}

function _resizeImageBase64(file, maxWidth) {
  try {
    const blob = file.getBlob();
    const mime = blob.getContentType();

    if (mime.indexOf('image/') === 0) {
      const thumbUrl = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800';
      const response = UrlFetchApp.fetch(thumbUrl, {
        headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true,
        followRedirects: true
      });

      if (response.getResponseCode() === 200) {
        const bytes = response.getBlob().getBytes();
        if (bytes.length > 100 && bytes.length < blob.getBytes().length) {
          Logger.log('🗜️ ضُغطت: ' + Math.round(blob.getBytes().length/1024) + 'KB → ' + Math.round(bytes.length/1024) + 'KB');
          return 'data:image/jpeg;base64,' + Utilities.base64Encode(bytes);
        }
      }
    }

    return 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    Logger.log('⚠️ _resizeImageBase64: ' + e.toString());
    return '';
  }
}

function getPdfThumbnailAsBase64(fileId) {
  try {
    const thumbUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
    const response = UrlFetchApp.fetch(thumbUrl, {
      headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
      followRedirects: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('Thumbnail fetch failed: ' + response.getResponseCode());
      return '';
    }

    const blob = response.getBlob();
    return 'data:image/png;base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (err) {
    Logger.log('getPdfThumbnailAsBase64 error: ' + err.toString());
    return '';
  }
}

/* ============================================================================
 * SECTION 2: parseEvidenceField
 * ============================================================================ */

function parseEvidenceField(field) {
  if (!field) return [];

  if (Array.isArray(field)) {
    return field
      .map(x => String(x).trim())
      .filter(x => x && x !== 'undefined' && x !== 'null');
  }

  if (typeof field === 'object' && field.getUrl) {
    return [field.getUrl()];
  }

  const str = String(field).trim();
  if (!str) return [];

  return str
    .split(/[\n,;]+/)
    .map(x => x.trim())
    .filter(x => x && x !== 'undefined' && x !== 'null' && x.indexOf('http') === 0);
}

/* ============================================================================
 * SECTION 3: دوال البناء
 * ============================================================================ */

function buildEvidenceCell(evidenceUrl, label, index) {
  if (!evidenceUrl) {
    return '<div style="color:#cbd5e1; font-size:9pt; padding:20px; text-align:center; ' +
           'height:100%; display:flex; align-items:center; justify-content:center;">' +
           'لا يوجد شاهد ' + label + ' مرفق</div>';
  }

  const base64 = _getCachedImage(evidenceUrl);

  if (!base64) {
    return '<div style="color:#94a3b8; font-size:9pt; padding:15px; text-align:center;">' +
           '⚠️ تعذّر تحميل الشاهد ' + label + '</div>';
  }

  return '<img src="' + base64 + '" ' +
         'style="width:100%; height:100%; object-fit:contain; background:#fff; display:block;" ' +
         'alt="الشاهد ' + label + '" />';
}

function buildHeaderHtml(logoHtml, term, grade, today) {
  return '' +
    '<div class="header">' +
    '<div class="left-box">' +
    '<div><strong>الفترة:</strong> ' + escapeHtml(term) + '</div>' +
    '<div><strong>التاريخ:</strong> ' + today + '</div>' +
    '<div><strong>الصف:</strong> ' + escapeHtml(grade) + '</div>' +
    '</div>' +
    '<div class="center-box">' +
    '<div class="kingdom">' + CARD_HEADER.kingdom + '</div>' +
    '<div class="ministry">' + CARD_HEADER.ministry + '</div>' +
    '<div class="region">' + CARD_HEADER.region + '</div>' +
    '<div class="school">' + CARD_HEADER.school + '</div>' +
    '</div>' +
    '<div class="logo-box">' + logoHtml + '</div>' +
    '</div>';
}

function buildSignaturesTable(teacherName) {
  const viceSigId = Core_Config.get('VICE_PRINCIPAL_SIG_FILE_ID');
  const managerSigId = Core_Config.get('MANAGER_SIG_FILE_ID');

  const viceSigBase64 = viceSigId
    ? extractImageAsBase64('https://drive.google.com/open?id=' + viceSigId)
    : '';
  const managerSigBase64 = managerSigId
    ? extractImageAsBase64('https://drive.google.com/open?id=' + managerSigId)
    : '';

  const viceSigHtml = viceSigBase64
    ? '<img src="' + viceSigBase64 + '" style="max-height:45px; max-width:90%; display:block; margin:2px auto;" />'
    : '<div style="height:45px;"></div>';

  const managerSigHtml = managerSigBase64
    ? '<img src="' + managerSigBase64 + '" style="max-height:45px; max-width:90%; display:block; margin:2px auto;" />'
    : '<div style="height:45px;"></div>';

  return '' +
    '<div class="signatures-title">✍️ التوقيعات والاعتمادات</div>' +
    '<table class="signatures">' +
    '<thead><tr>' +
    '<th style="width:33.33%;">توقيع المعلم / المنفذ</th>' +
    '<th style="width:33.33%;">اعتماد وكيل المدرسة</th>' +
    '<th style="width:33.33%;">اعتماد قائد المدرسة</th>' +
    '</tr></thead>' +
    '<tbody><tr>' +
    '<td>' +
    '<div class="sig-role">المعلم / المنفذ</div>' +
    '<div class="sig-blank">التوقيع: ..............</div>' +
    '<div class="sig-name">' + escapeHtml(teacherName || '-') + '</div>' +
    '</td>' +
    '<td>' +
    viceSigHtml +
    '<div class="sig-role">وكيل شؤون الطلاب</div>' +
    '<div class="sig-name">أ. محمد بن فايز الجابري</div>' +
    '</td>' +
    '<td>' +
    managerSigHtml +
    '<div class="sig-role">قائد المدرسة</div>' +
    '<div class="sig-name">أ. نايف بن سمير الحربي</div>' +
    '</td>' +
    '</tr></tbody></table>';
}

function _preloadImages(data) {
  if (!data) return;

  const urls = [];
  if (data.evidence1) urls.push(data.evidence1);
  if (data.evidence2) urls.push(data.evidence2);

  urls.forEach(function(url) {
    if (url) {
      try {
        _getCachedImage(url);
      } catch (e) {}
    }
  });
}

/* ============================================================================
 * SECTION 4: buildCardHtml — تفويض إلى Feature_SmartCardBuilder
 * ============================================================================ */
function buildCardHtml(data, matchedTeacher) {
  if (!data) {
    Logger.log('⚠️ buildCardHtml: data مفقود');
    data = {};
  }
  if (typeof Feature_SmartCardBuilder === 'undefined') {
    Logger.log('❌ Feature_SmartCardBuilder غير متوفر');
    return '<h1>خطأ: باني البطاقة غير متوفر</h1>';
  }
  return Feature_SmartCardBuilder.build(data, matchedTeacher, false);
}

/* ============================================================================
 * SECTION 5: escapeHtml
 * ============================================================================ */

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================================
 * SECTION 6: ثوابت الترويسة
 * ============================================================================ */

const CARD_HEADER = {
  kingdom: 'المملكة العربية السعودية',
  ministry: 'وزارة التعليم',
  region: 'الإدارة العامة للتعليم بمنطقة المدينة المنورة',
  school: 'متوسطة سعد بن الربيع الأنصاري',
  title: 'بطاقة توثيق شاهد تقويم واعتماد مدرسي'
};

/* ============================================================================
 * SECTION 7: MODULE WRAPPER — Feature_SubmissionService
 * ============================================================================ */

const Feature_SubmissionService = (function () {

  const FIELD_KEYWORDS = {
    teacher:     ['اسم المعلم أو الموظف', 'اسم المعلم / الموظف', 'اسم المعلم'],
    term:        ['الفترة', 'الفترة الزمنية للشاهد'],
    grade:       ['الصف الدراسي المستهدف'],
    domain:      ['مجال التقويم المستهدف'],
    indicator:   ['المؤشر المستهدف'],
    actionTitle: ['عنوان الإجراء', 'المبادرة المنفذة'],
    actionDesc:  ['وصف موجز للخطوات', 'وصف موجز'],
    impact:      ['الأثر المتحقق'],
    evidence1:   ['صورة الشاهد الأولى', 'الشاهد الأول'],
    evidence2:   ['صورة الشاهد الثانية', 'الشاهد الثاني'],
    approver:    ['معتمد التقرير', 'المعتمد'],
    pdfUrl:      ['رابط بطاقة الشاهد', 'PDF']
  };

  function _findColIdx(headers, keywords) {
    for (let k = 0; k < keywords.length; k++) {
      const kw = keywords[k];
      for (let i = headers.length - 1; i >= 0; i--) {
        const h = String(headers[i] || '').trim();
        if (h.indexOf(kw) !== -1) return i;
      }
    }
    return -1;
  }

  function _extractField(headers, row, keywords) {
    for (let k = 0; k < keywords.length; k++) {
      const kw = keywords[k];
      for (let i = headers.length - 1; i >= 0; i--) {
        const h = String(headers[i] || '').trim();
        if (h.indexOf(kw) === -1) continue;
        const v = String(row[i] || '').trim();
        if (v && v !== 'undefined' && v !== 'null') return v;
      }
    }
    return '';
  }

  function _extractRowData(headers, row) {
    return {
      teacherName: _extractField(headers, row, FIELD_KEYWORDS.teacher),
      term:        _extractField(headers, row, FIELD_KEYWORDS.term),
      grade:       _extractField(headers, row, FIELD_KEYWORDS.grade),
      domain:      _extractField(headers, row, FIELD_KEYWORDS.domain),
      indicator:   _extractField(headers, row, FIELD_KEYWORDS.indicator),
      actionTitle: _extractField(headers, row, FIELD_KEYWORDS.actionTitle),
      actionDesc:  _extractField(headers, row, FIELD_KEYWORDS.actionDesc),
      impact:      _extractField(headers, row, FIELD_KEYWORDS.impact),
      evidence1:   _extractField(headers, row, FIELD_KEYWORDS.evidence1),
      evidence2:   _extractField(headers, row, FIELD_KEYWORDS.evidence2),
      approver:    _extractField(headers, row, FIELD_KEYWORDS.approver) // 🆕
    };
  }

  function _createPdfInTeacherFolder(html, data, teacher) {
    let folderId = '';
    if (teacher && teacher.folderId) {
      try {
        const own = DriveApp.getFolderById(teacher.folderId);
        if (!own.isTrashed()) folderId = own.getId();
      } catch (err) {
        Logger.log('⚠️ مجلد المعلم غير متاح، سيُستخدم مجلد Teachers: ' + err);
      }
    }
    if (!folderId) {
      const rootFolder = DriveApp.getFolderById(Core_Config.get('MASTER_ROOT_FOLDER_ID'));
      const iter = rootFolder.getFoldersByName('Teachers');
      folderId = iter.hasNext() ? iter.next().getId() : rootFolder.getId();
    }

    const htmlBlob = Utilities.newBlob(html, 'text/html', 'tmp_card.html');
    const docFile = Drive.Files.insert(
      { title: 'TMP_Card_' + Date.now(), mimeType: 'application/vnd.google-apps.document' },
      htmlBlob,
      { convert: true }
    );

    const doc = DriveApp.getFileById(docFile.id);
    const pdfBlob = doc.getAs('application/pdf');

    const cleanTeacher = (teacher && teacher.name) || data.teacherName || 'معلم';
    const safeTeacher = cleanTeacher.replace(/[\/\\:*?"<>|]/g, '_').trim();
    const indicatorCode = (data.indicator.match(/\((\d+-\d+-\d+-\d+)\)/) || [])[1] || 'X';
    const fileName = safeTeacher + '_' + indicatorCode + '_' +
                     Utilities.formatDate(new Date(), 'Asia/Riyadh', 'yyyyMMdd_HHmmss') + '.pdf';

    const folder = DriveApp.getFolderById(folderId);
    const pdfFile = folder.createFile(pdfBlob.setName(fileName));

    try { doc.setTrashed(true); } catch (e) {}

    return pdfFile.getUrl();
  }

  function reprocessRow(rowIndex, force) {
    try {
      const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
      const sheet = ss.getSheetByName(Core_Config.get('SHEET_RESPONSES_NAME'));
      if (!sheet) return { success: false, reason: 'SHEET_NOT_FOUND' };

      const lastCol = sheet.getLastColumn();
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const row = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];

      const data = _extractRowData(headers, row);

      if (!data.teacherName && !data.indicator) {
        return { success: false, reason: 'EMPTY_ROW' };
      }

      const pdfColIdx = _findColIdx(headers, FIELD_KEYWORDS.pdfUrl);
      if (!force && pdfColIdx !== -1) {
        const existing = String(row[pdfColIdx] || '').trim();
        if (existing && existing.indexOf('http') === 0) {
          return { success: true, reason: 'ALREADY_PROCESSED', url: existing };
        }
      }

      const teacher = Core_DataLayer.getTeacherByName(data.teacherName);
      const html = buildCardHtml(data, teacher);
      const pdfUrl = _createPdfInTeacherFolder(html, data, teacher);

      if (force && pdfColIdx !== -1 && pdfUrl) {
        sheet.getRange(rowIndex, pdfColIdx + 1).setValue(pdfUrl);
      }

      return {
        success: true,
        url: pdfUrl,
        teacher: teacher ? teacher.name : data.teacherName,
        indicator: data.indicator,
        forced: !!force
      };

    } catch (err) {
      Logger.log('❌ reprocessRow error: ' + err.toString());
      return { success: false, reason: err.toString() };
    }
  }

  return {
    reprocessRow: reprocessRow,
    _extractRowData: _extractRowData,
    _findColIdx: _findColIdx
  };

})();

/* ============================================================================
 * SECTION 8: دوال اختبار عامة
 * ============================================================================ */

function TEST_ReprocessOneRow() {
  Logger.log('🚀 اختبار reprocessRow على الصف 2...\n');
  const result = Feature_SubmissionService.reprocessRow(2, true);
  Logger.log('📊 النتيجة: ' + JSON.stringify(result, null, 2));

  if (result.success && result.url) {
    Logger.log('\n🎉 تم توليد PDF بنجاح!');
    Logger.log('📄 الرابط: ' + result.url);
  }

  return result;
}

function TEST_BuildCard() {
  Logger.log('🧪 اختبار buildCardHtml...\n');

  const fakeData = {
    teacherName: 'اختبار',
    term: '1',
    grade: '1',
    domain: '01',
    indicator: '(1-1-1-1) اختبار',
    actionTitle: 'test',
    actionDesc: 'test',
    impact: 'test',
    evidence1: '',
    evidence2: ''
  };

  try {
    const html = buildCardHtml(fakeData, null);
    Logger.log('✅ HTML: ' + html.length + ' حرف');
    Logger.log('✅ يحتوي على العنوان: ' + (html.indexOf('بطاقة توثيق شاهد') !== -1));
  } catch (e) {
    Logger.log('❌ خطأ: ' + e.toString());
    Logger.log('Stack: ' + e.stack);
  }
}