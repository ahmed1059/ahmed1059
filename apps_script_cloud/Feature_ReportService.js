/*************************************************************************************
 * Feature_ReportService.gs — خدمة معالجة وتحليل التقارير والإحصاءات (الاعتماد المدرسي)
 * -----------------------------------------------------------------------------------
 * الإصدار: 1.4.0 (محسّن وفق بروتوكول 1059)
 * - دعم تحليل متقدم لمؤشرات نواتج التعلم (المجال الثالث) والمجالات الأخرى
 *************************************************************************************/

const Feature_ReportService = (function() {

  /**
   * استخراج رمز المؤشر بدقة من النص.
   * مثال: "(3-2-1-2) يلتزم..." → "3-2-1-2"
   */
  function extractIndicatorCode(indicatorText) {
    if (!indicatorText) return '';
    const match = String(indicatorText).match(/\((\d+-\d+-\d+-\d+)\)/);
    return match ? match[1] : '';
  }

  /**
   * تحديد المجال برمجياً من السجل (مع معالجة استباقية للمجال الثالث: نواتج التعلم).
   */
  function detectDomainFromRecord(record) {
    if (!record) return '';

    // 1. الفحص الأساسي من رمز المؤشر
    const code = extractIndicatorCode(record.indicator);
    if (code) {
      const firstDigit = code.split('-')[0];
      if (firstDigit === '1') return "01 الإدارة المدرسية";
      if (firstDigit === '2') return "02 التعليم والتعلم";
      if (firstDigit === '3') return "03 نواتج التعلم";
      if (firstDigit === '4') return "04 البيئة المدرسية";
    }

    // 2. الفحص الاحتياطي من حقل domain أو النص المباشر
    const d = String(record.domain || '');
    if (d.includes("01") || d.includes("إدارة")) return "01 الإدارة المدرسية";
    if (d.includes("02") || d.includes("تعليم") || d.includes("تعلم")) return "02 التعليم والتعلم";
    if (d.includes("03") || d.includes("نواتج")) return "03 نواتج التعلم";
    if (d.includes("04") || d.includes("بيئة")) return "04 البيئة المدرسية";

    return '';
  }

  /**
   * توليد تقرير شامل عن موقف مشاركة منسوبي المدرسة وتحليل مؤشرات المجالات.
   */
  function generateParticipationReport() {
    try {
      const _rawStaff = Core_Context.getStaffList();
      const _seenKeys = new Set();
      const allStaff = _rawStaff.filter(function(s) {
        const _key = String((s && s.nationalId) || (s && s.name) || '').trim();
        if (!_key || _seenKeys.has(_key)) return false;
        _seenKeys.add(_key);
        return true;
      });
      const allRecords = Core_Context.getRecords();

      const totalStaffCount = allStaff.length;
      const totalEvidences = allRecords.length;

      const activeCanonicalSet = new Set();
      allRecords.forEach(function (r) {
        if (!r || !r.teacher) return;
        const matchResult = Util_NameNormalizer.findBestMatch(r.teacher, allStaff);
        const canonicalName = (matchResult && matchResult.score >= 75)
          ? matchResult.name
          : r.teacher;
        activeCanonicalSet.add(canonicalName);
      });
      const activeTeacherNames = Array.from(activeCanonicalSet);

      // 2. تصنيف المنسوبين (مشاركون / بانتظار المشاركة)
      const activeStaffList = [];
      const pendingStaffList = [];
      const pendingRoster = [];

      allStaff.forEach(function(staff) {
        let isActive = false;
        if (activeTeacherNames.includes(staff.name)) {
          isActive = true;
        } else {
          for (let i = 0; i < activeTeacherNames.length; i++) {
            if (Util_NameNormalizer.areSamePerson(staff.name, activeTeacherNames[i], 75)) {
              isActive = true;
              break;
            }
          }
        }

        if (isActive) activeStaffList.push(staff.name);
        else {
          pendingStaffList.push(staff.name);
          pendingRoster.push({
            name: staff.name,
            nationalId: String(staff.nationalId || '').trim()
          });
        }
      });

      const activeCount = activeStaffList.length;
      const pendingCount = pendingStaffList.length;

      // 3. إحصائيات المجالات (مع التركيز المعماري على نواتج التعلم)
      const domainsList = Core_Config.getDomains();
      const domainStats = {};

      domainsList.forEach(function(dName) {
        const totalInds = Core_Config.getDomainIndicatorsCount(dName);
        const coveredSet = new Set();

        allRecords.forEach(function(r) {
          const recordDomain = detectDomainFromRecord(r);
          const code = extractIndicatorCode(r.indicator);

          if (recordDomain === dName && code) {
            coveredSet.add(code);
          }
        });

        const coveredCount = coveredSet.size;
        const percentage = totalInds > 0 ? Math.round((coveredCount / totalInds) * 100) : 0;

        domainStats[dName] = {
          totalIndicators: totalInds,
          coveredIndicators: coveredCount,
          percentage: percentage,
          coveredCodes: Array.from(coveredSet)
        };

        Logger.log("📊 " + dName + ": " + coveredCount + "/" + totalInds + " (" + percentage + "%)");
      });

      return {
        success: true,
        summary: {
          totalStaffCount: totalStaffCount,
          totalEvidences: totalEvidences,
          activeCount: activeCount,
          pendingCount: pendingCount,
          participationRate: totalStaffCount > 0 ? Math.round((activeCount / totalStaffCount) * 100) : 0
        },
        lists: {
          activeStaff: activeStaffList,
          pendingStaff: pendingStaffList,
          pendingRoster: pendingRoster
        },
        domains: domainStats,
        records: allRecords
      };

    } catch (err) {
      Logger.log("❌ خطأ حرج في بناء تقرير المشاركة ونواتج التعلم: " + err.toString());
      return { success: false, error: err.toString() };
    }
  }

  return {
    generateParticipationReport: generateParticipationReport,
    detectDomainFromRecord: detectDomainFromRecord,
    extractIndicatorCode: extractIndicatorCode
  };

})();