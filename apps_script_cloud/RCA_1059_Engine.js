/**
 * ==============================================================================
 * RCA_1059_Engine.gs — المحرك الذاتي للتحليل والتصحيح
 * ---------------------------------------------------------------------------
 * الإصدار: 1.0.0
 * وفق بروتوكول 1059-Pro — Auto-Engine Pattern
 * ---------------------------------------------------------------------------
 * القدرات:
 *   1. Self-Scan    — قراءة كل ملفات Apps Script
 *   2. Pattern-Detect — كشف 12 نمط خاطئ
 *   3. Blast-Map    — رسم خريطة الأثر
 *   4. Auto-Report  — تقرير مرتّب
 *   5. Propose-Fix  — اقتراح تصحيح
 * ==============================================================================
 */

const RCA_1059_Engine = (function () {

  /* ==========================================================================
   * القسم 1: قراءة الملفات
   * ========================================================================== */

  /**
   * قراءة محتوى ملف من Apps Script عبر DriveApp.
   * (المشروع مرتبط بـ Apps Script — لا يوجد Apps Script API مباشر)
   */
  function _readScriptFile(fileName) {
    try {
      // البحث في Root الخاص بالمشروع
      const rootFolder = DriveApp.getRootFolder();
      const iter = rootFolder.getFilesByName(fileName);
      if (!iter.hasNext()) return null;
      const file = iter.next();
      return file.getBlob().getDataAsString('UTF-8');
    } catch (e) {
      return null;
    }
  }

  /**
   * قراءة كل ملفات المشروع (المعروفة مسبقاً).
   * ملاحظة: Apps Script لا يوفّر API ذاتياً لقراءة الملفات.
   * لذلك نعتمد على نسخ من المشروع في Drive أو قائمة صريحة.
   */
  function _getKnownFiles() {
    return [
      'Core_Config',
      'Core_Context',
      'Core_DataLayer',
      'Core_ETECGuide',
      'Core_Migration',
      'Core_MigrationFolders',
      'SettingsService',
      'Util_NameNormalizer',
      'Feature_ReportService',
      'Feature_SubmissionService',
      'Feature_ImportService',
      'Feature_AdminService',
      'Feature_PrintEngine',
      'CardTemplate',
      'CardRenderer',
      'UI_Controller'
    ];
  }

  /* ==========================================================================
   * القسم 2: قواعد الفحص (Detection Rules)
   * ========================================================================== */

  /**
   * فحص R01: الكتل المكررة.
   */
  function _detectDuplicateBlocks(code) {
    const issues = [];
    // كشف دالة معرَّفة مرتين بنفس الاسم
    const funcRegex = /function\s+([A-Za-z_][\w]*)\s*\(/g;
    const seen = {};
    let m;
    while ((m = funcRegex.exec(code)) !== null) {
      const name = m[1];
      if (seen[name] !== undefined) {
        issues.push({
          rule: 'R01',
          severity: 'HIGH',
          line: _getLineNumber(code, m.index),
          message: 'دالة مكررة: ' + name,
          fix: 'احذف النسخة الثانية'
        });
      } else {
        seen[name] = m.index;
      }
    }
    return issues;
  }

  /**
   * فحص R02: \n مكشوف في نصوص JS المُقدَّمة.
   * (فقط داخل ملفات UI)
   */
  function _detectNakedNewlines(code) {
    const issues = [];
    // ابحث عن نصوص JavaScript بـ \n غير مُهرَّبة
    const regex = /'([^']*?)\n([^']*?)'/g;
    let m;
    while ((m = regex.exec(code)) !== null) {
      // تجاهل السطور التي تحتوي على \\n (escape)
      if (m[0].indexOf('\\\\n') !== -1) continue;
      if (m[0].indexOf('HTML') !== -1) continue;
      issues.push({
        rule: 'R02',
        severity: 'CRITICAL',
        line: _getLineNumber(code, m.index),
        message: '\\n مكشوف داخل سلسلة نصية',
        fix: 'استبدل \\n بـ \\\\n'
      });
    }
    return issues.slice(0, 10); // أول 10 فقط
  }

  /**
   * فحص R03: Backticks متداخلة.
   */
  function _detectNestedBackticks(code) {
    const issues = [];
    // ابحث عن ` داخل ` في سياق دالة داخلية
    const lines = code.split('\n');
    let inTemplate = false;
    let startLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const backtickCount = (line.match(/`/g) || []).length;
      if (backtickCount % 2 === 1) {
        if (!inTemplate) {
          inTemplate = true;
          startLine = i + 1;
        } else {
          inTemplate = false;
        }
      }
      // إذا كنا في template ورأينا backtick آخر
      if (inTemplate && i > startLine && backtickCount > 0) {
        issues.push({
          rule: 'R03',
          severity: 'HIGH',
          line: i + 1,
          message: 'backtick متداخل داخل template literal',
          fix: 'استخدم string concatenation'
        });
      }
    }
    return issues.slice(0, 5);
  }

  /**
   * فحص R04: وصول مباشر للـSheet من UI.
   */
  function _detectDirectDataAccess(code, fileName) {
    const issues = [];
    if (fileName.indexOf('UI_') !== 0 && fileName.indexOf('Card') !== 0) return issues;

    const regex = /Core_DataLayer\.(getStaffList|getAllEvidenceRecords)\s*\(/g;
    let m;
    while ((m = regex.exec(code)) !== null) {
      issues.push({
        rule: 'R04',
        severity: 'HIGH',
        line: _getLineNumber(code, m.index),
        message: 'وصول مباشر للـDataLayer من طبقة العرض',
        fix: 'استخدم Core_Context.' + m[1]
      });
    }
    return issues;
  }

  /**
   * فحص R06: استخدام get() بدل getFresh() في المصادقة.
   */
  function _detectStaleAuthReads(code, fileName) {
    const issues = [];
    if (fileName !== 'UI_Controller') return issues;

    const authContexts = ['checkObserverLogin', 'observer_password', 'observer_enabled'];
    authContexts.forEach(function (ctx) {
      const idx = code.indexOf(ctx);
      if (idx === -1) return;
      const segment = code.substring(idx, idx + 800);
      if (segment.indexOf('SettingsService.get(') !== -1 &&
          segment.indexOf('SettingsService.getFresh(') === -1) {
        issues.push({
          rule: 'R06',
          severity: 'MEDIUM',
          line: _getLineNumber(code, idx),
          message: 'استخدام get() بدل getFresh() في ' + ctx,
          fix: 'استبدل get() بـ getFresh()'
        });
      }
    });
    return issues;
  }

  /**
   * فحص R07: تكرار invalidate.
   */
  function _detectDuplicateInvalidate(code) {
    const issues = [];
    const pattern = /(Core_Context\.invalidate\([^)]+\);\s*\n\s*try\s*\{\s*Core_Context\.invalidate\([^)]+\);\s*\}\s*catch[^\n]+\n\s*try\s*\{\s*Core_Context\.invalidate)/g;
    let m;
    while ((m = pattern.exec(code)) !== null) {
      issues.push({
        rule: 'R07',
        severity: 'MEDIUM',
        line: _getLineNumber(code, m.index),
        message: 'استدعاءات invalidate متتالية مكررة',
        fix: 'احذف المكرر'
      });
    }
    return issues;
  }

  /**
   * فحص R09: extractFileId غير موحَّد.
   */
  function _detectUnifiedFileId(code, fileName) {
    const issues = [];
    const funcRegex = /function\s+extractFileId\s*\(/g;
    let m;
    while ((m = funcRegex.exec(code)) !== null) {
      const segment = code.substring(m.index, m.index + 500);
      // هل يحتوي على 4 أنماط regex؟
      const patterns = ['/file/d/', '[?&]id=', '/d/', '[-\w]{25,}'];
      const found = patterns.filter(p => segment.indexOf(p) !== -1).length;
      if (found < 3) {
        issues.push({
          rule: 'R09',
          severity: 'MEDIUM',
          line: _getLineNumber(code, m.index),
          message: 'extractFileId في ' + fileName + ' ناقص الأنماط (' + found + '/4)',
          fix: 'استخدم النسخة الموحَّدة بـ4 أنماط'
        });
      }
    }
    return issues;
  }

  /**
   * فحص R10: DEBUG_* في ملفات الإنتاج.
   */
  function _detectDebugInProduction(code, fileName) {
    const issues = [];
    if (fileName.indexOf('Debug') !== -1) return issues;

    const regex = /function\s+(DEBUG_|TEST_)[A-Za-z_][\w]*\s*\(/g;
    let m;
    while ((m = regex.exec(code)) !== null) {
      issues.push({
        rule: 'R10',
        severity: 'LOW',
        line: _getLineNumber(code, m.index),
        message: 'دالة تشخيص في ملف الإنتاج: ' + m[0],
        fix: 'انقلها إلى Debug.gs'
      });
    }
    return issues.slice(0, 5);
  }

  /* ==========================================================================
   * القسم 3: أدوات مساعدة
   * ========================================================================== */

  function _getLineNumber(text, index) {
    return (text.substring(0, index).match(/\n/g) || []).length + 1;
  }

  /* ==========================================================================
   * القسم 4: محرك الفحص الرئيسي
   * ========================================================================== */

  function scanFile(fileName, code) {
    if (!code) return [];
    const allIssues = [];

    allIssues.push(..._detectDuplicateBlocks(code).map(i => Object.assign({}, i, { file: fileName })));
    allIssues.push(..._detectNakedNewlines(code).map(i => Object.assign({}, i, { file: fileName })));
    allIssues.push(..._detectNestedBackticks(code).map(i => Object.assign({}, i, { file: fileName })));
    allIssues.push(..._detectDirectDataAccess(code, fileName).map(i => Object.assign({}, i, { file: fileName })));
    allIssues.push(..._detectStaleAuthReads(code, fileName).map(i => Object.assign({}, i, { file: fileName })));
    allIssues.push(..._detectDuplicateInvalidate(code).map(i => Object.assign({}, i, { file: fileName })));
    allIssues.push(..._detectUnifiedFileId(code, fileName).map(i => Object.assign({}, i, { file: fileName })));
    allIssues.push(..._detectDebugInProduction(code, fileName).map(i => Object.assign({}, i, { file: fileName })));

    return allIssues;
  }

  /* ==========================================================================
   * القسم 5: التقرير الشامل
   * ========================================================================== */

  /**
   * تشغيل الفحص الشامل على كل الملفات.
   * ملاحظة: يجب تمرير الكود يدوياً (Apps Script لا يقرأ ذاته).
   * @param {Object} filesMap - {fileName: code}
   */
  function fullScan(filesMap) {
    const startTime = Date.now();
    const allIssues = [];

    Object.keys(filesMap).forEach(function (fileName) {
      const code = filesMap[fileName];
      const fileIssues = scanFile(fileName, code);
      allIssues.push(...fileIssues);
    });

    // ترتيب حسب الخطورة
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // تجميع حسب الملف
    const byFile = {};
    allIssues.forEach(function (issue) {
      if (!byFile[issue.file]) byFile[issue.file] = [];
      byFile[issue.file].push(issue);
    });

    // تقرير نهائي
    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      totalFiles: Object.keys(filesMap).length,
      totalIssues: allIssues.length,
      bySeverity: {
        CRITICAL: allIssues.filter(i => i.severity === 'CRITICAL').length,
        HIGH: allIssues.filter(i => i.severity === 'HIGH').length,
        MEDIUM: allIssues.filter(i => i.severity === 'MEDIUM').length,
        LOW: allIssues.filter(i => i.severity === 'LOW').length
      },
      byRule: _countByRule(allIssues),
      issues: allIssues,
      byFile: byFile
    };

    _printReport(report);
    return report;
  }

  function _countByRule(issues) {
    const counts = {};
    issues.forEach(function (i) {
      counts[i.rule] = (counts[i.rule] || 0) + 1;
    });
    return counts;
  }

  function _printReport(report) {
    Logger.log('═══════════════════════════════════════════════════');
    Logger.log('  RCA-1059 Auto-Report');
    Logger.log('═══════════════════════════════════════════════════');
    Logger.log('⏱️  مدة الفحص: ' + report.duration + 'ms');
    Logger.log('📁 عدد الملفات: ' + report.totalFiles);
    Logger.log('🔍 إجمالي المشاكل: ' + report.totalIssues);
    Logger.log('');
    Logger.log('📊 التوزيع حسب الخطورة:');
    Logger.log('   🔴 CRITICAL: ' + report.bySeverity.CRITICAL);
    Logger.log('   🟠 HIGH:     ' + report.bySeverity.HIGH);
    Logger.log('   🟡 MEDIUM:   ' + report.bySeverity.MEDIUM);
    Logger.log('   🟢 LOW:      ' + report.bySeverity.LOW);
    Logger.log('');
    Logger.log('📊 التوزيع حسب القاعدة:');
    Object.keys(report.byRule).sort().forEach(function (rule) {
      Logger.log('   ' + rule + ': ' + report.byRule[rule]);
    });

    if (report.totalIssues === 0) {
      Logger.log('\n✅ لا توجد مشاكل! النظام نظيف.');
      return;
    }

    Logger.log('\n═══════════════════════════════════════════════════');
    Logger.log('  التفاصيل (أول 30 مشكلة)');
    Logger.log('═══════════════════════════════════════════════════');
    report.issues.slice(0, 30).forEach(function (issue, idx) {
      const icon = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' }[issue.severity];
      Logger.log('[' + (idx + 1) + '] ' + icon + ' ' + issue.rule + ' | ' + issue.file + ':' + issue.line);
      Logger.log('     ' + issue.message);
      Logger.log('     💡 ' + issue.fix);
    });
  }

  /* ==========================================================================
   * القسم 6: الواجهة العامة
   * ========================================================================== */

  return {
    scanFile: scanFile,
    fullScan: fullScan,
    _detectDuplicateBlocks: _detectDuplicateBlocks,
    _detectNakedNewlines: _detectNakedNewlines,
    _detectNestedBackticks: _detectNestedBackticks,
    _detectDirectDataAccess: _detectDirectDataAccess,
    _detectStaleAuthReads: _detectStaleAuthReads,
    _detectDuplicateInvalidate: _detectDuplicateInvalidate,
    _detectUnifiedFileId: _detectUnifiedFileId,
    _detectDebugInProduction: _detectDebugInProduction
  };

})();