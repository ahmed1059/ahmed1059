/*************************************************************************************
 * Core_DataLayer.gs — بوابة قراءة البيانات من Google Sheets
 * -----------------------------------------------------------------------------------
 * الإصدار: 2.1.0
 * - يقرأ staffList من Staff_All مع دعم folder_id
 * - يقرأ سجلات الشواهد
 * - يوفّر بحث ذكي عن المعلمين
 *************************************************************************************/

const Core_DataLayer = (function() {

  /**
   * جلب قائمة المنسوبين من ورقة Staff_All.
   * يُرجع فقط النشطين (status = نشط).
   */
  function getStaffList() {
    try {
      const ss = SpreadsheetApp.openById(Core_Config.get("SPREADSHEET_ID"));
      const sheet = ss.getSheetByName(Core_Config.get("SHEET_STAFF_ALL"));
      if (!sheet) {
        Logger.log("⚠️ ورقة Staff_All غير موجودة");
        return [];
      }

      const data = sheet.getDataRange().getValues();
      if (!data || data.length < 2) return [];

      const headers = data[0].map(h => String(h).trim());
      const idx = {
        national_id: headers.indexOf("national_id"),
        name_raw: headers.indexOf("name_raw"),
        name_canonical: headers.indexOf("name_canonical"),
        role: headers.indexOf("role"),
        status: headers.indexOf("status"),
        mobile: headers.indexOf("mobile"),
        email: headers.indexOf("email"),
        specialty: headers.indexOf("specialty"),
        qualification: headers.indexOf("qualification"),
        job_number: headers.indexOf("job_number"),
        school: headers.indexOf("school"),
        last_updated: headers.indexOf("last_updated"),
        is_admin: headers.indexOf("is_admin"),
        folder_id: headers.indexOf("folder_id")
      };

      const result = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const status = idx.status >= 0 ? String(row[idx.status]).trim() : "نشط";
        if (status !== "نشط") continue;

        const nationalId = idx.national_id >= 0 ? String(row[idx.national_id] || "").trim() : "";
        const role = idx.role >= 0 ? String(row[idx.role] || "").trim() : "";

        result.push({
          nationalId: nationalId,
          name: idx.name_raw >= 0 ? String(row[idx.name_raw] || "").trim() : "",
          nameCanonical: idx.name_canonical >= 0 ? String(row[idx.name_canonical] || "").trim() : "",
          role: role,
          status: status,
          mobile: idx.mobile >= 0 ? String(row[idx.mobile] || "").trim() : "",
          email: idx.email >= 0 ? String(row[idx.email] || "").trim() : "",
          specialty: idx.specialty >= 0 ? String(row[idx.specialty] || "").trim() : "",
          qualification: idx.qualification >= 0 ? String(row[idx.qualification] || "").trim() : "",
          jobNumber: idx.job_number >= 0 ? String(row[idx.job_number] || "").trim() : "",
          school: idx.school >= 0 ? String(row[idx.school] || "").trim() : "",
          lastUpdated: idx.last_updated >= 0 ? String(row[idx.last_updated] || "").trim() : "",
          isAdmin: Core_Config.isAdmin(nationalId, role),
          folderId: idx.folder_id >= 0 ? String(row[idx.folder_id] || "").trim() : ""
        });
      }

      return result;
    } catch (err) {
      Logger.log("❌ خطأ في قراءة Staff_All: " + err.toString());
      return [];
    }
  }

  /**
   * جلب سجل معلم واحد بالاسم.
   */
  function getTeacherByName(name) {
    if (!name) return null;
    const list = (typeof Core_Context !== 'undefined')
      ? Core_Context.getStaffList()
      : getStaffList();
    return Util_NameNormalizer.findBestMatch(name, list);
  }

  /**
   * جلب سجل معلم واحد بالسجل المدني.
   */
  function getTeacherByNationalId(nationalId) {
    if (!nationalId) return null;
    const list = getStaffList();
    const id = String(nationalId).trim();
    for (let i = 0; i < list.length; i++) {
      if (list[i].nationalId === id) return list[i];
    }
    return null;
  }

  /**
   * جلب كل سجلات الشواهد من ردود النموذج.
   */
  function getAllEvidenceRecords() {
    try {
      const ss = SpreadsheetApp.openById(Core_Config.get("SPREADSHEET_ID"));
      const sheet = ss.getSheetByName(Core_Config.get("SHEET_RESPONSES_NAME")) || ss.getSheets()[0];
      const data = sheet.getDataRange().getValues();

      if (!data || data.length < 2) return [];

      const headers = data[0];
      const records = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        let teacherRaw = "";
        let term = "";
        let domain = "";
        let indicator = "";
        let beneficiary = "";
        let action = "";
        let pdfUrl = "";

        for (let c = 0; c < headers.length; c++) {
          const h = headers[c] ? headers[c].toString().trim() : "";
          const val = row[c] ? row[c].toString().trim() : "";
          if (!val) continue;

          if (!indicator && (val.startsWith("(") || val.indexOf("مؤشر") !== -1)) indicator = val;
          if (!teacherRaw && (h.indexOf("اختر الاسم") !== -1 || h.indexOf("المعلم") !== -1 || h.indexOf("الموظف") !== -1 || h.indexOf("اسم المعلم") !== -1)) teacherRaw = val;
          if (!term && h.indexOf("الفترة") !== -1) term = val;
          if (!domain && h.indexOf("مجال التقويم") !== -1) domain = val;
          if (!beneficiary && h.indexOf("المستفيد") !== -1) beneficiary = val;
          if (!action && (h.indexOf("عنوان الإجراء") !== -1 || h.indexOf("المبادرة") !== -1)) action = val;
          if (!pdfUrl && (h.indexOf("PDF") !== -1 || h.indexOf("بطاقة") !== -1)) pdfUrl = val;
        }

        if (teacherRaw || action || indicator) {
          const cleanedTeacherName = Util_NameNormalizer.getDisplay(teacherRaw);
          records.push({
            rowIndex: i + 1,
            teacherRaw: teacherRaw,
            teacher: cleanedTeacherName,
            term: term || "-",
            domain: domain || (indicator.indexOf("1-") !== -1 ? "01 الإدارة المدرسية" : "-"),
            indicator: indicator || "-",
            action: action || "-",
            pdfUrl: pdfUrl
          });
        }
      }

      return records;
    } catch (err) {
      Logger.log("❌ خطأ في قراءة سجلات الشواهد: " + err.toString());
      return [];
    }
  }

  /**
   * البحث الذكي عن معلم (متوافق مع الاستخدامات القديمة).
   */
  function findTeacherByNameSmart(name) {
    return getTeacherByName(name);
  }

  return {
    getStaffList: getStaffList,
    getTeacherByName: getTeacherByName,
    getTeacherByNationalId: getTeacherByNationalId,
    getAllEvidenceRecords: getAllEvidenceRecords,
    findTeacherByNameSmart: findTeacherByNameSmart
  };

})();