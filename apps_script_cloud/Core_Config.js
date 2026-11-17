/*************************************************************************************
 * Core_Config.gs — مركز التحكم وثوابت النظام الأساسية
 * -----------------------------------------------------------------------------------
 * الإصدار: 2.3.0
 * - الرابط الرسمي الصحيح
 * - الأدوار الإدارية الموسّعة
 * - إعدادات المجالات الـ4 (38 مؤشراً)
 * - إضافة توقيع الوكيل + المدير
 *************************************************************************************/

const Core_Config = (function() {

  const SETTINGS = {
    // معرفات الملفات والمجلدات
    FORM_ID: "1vQboE2eL6b7FRD0-jrYkbhOaoiorPG19kSKUUszC9HE",
    SPREADSHEET_ID: "1hSQU2spX7j-_dZumo4h0_wbyIHYHg03AyuGqqet637M",
    MASTER_ROOT_FOLDER_ID: "1TnTBwZQ6PORIqOkmFdkLaS0S1K-3d2pF",

    // روابط رسمية
    OFFICIAL_FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLSfHPJCTTNCXT28hukniLlZCFIuV0C7atdrm4ZgXIGto3iiayA/viewform",
    OFFICIAL_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbxv401T2f7sORF2jEwnlG1u1rhfj9nqfXAkfQf6TFC1PPWqObugF600p3HCMd_-lDdc/exec",

    // الشعارات والتوقيعات
    MOE_LOGO_FILE_ID: "1Xd6rzx3dBM5j02s3YwGW-b2z3LNeWavX",
    VICE_PRINCIPAL_SIG_FILE_ID: "12emM7SocTer5VqptioKHSai0IYWFbufe",  // توقيع الوكيل
    MANAGER_SIG_FILE_ID: "1zbaM0oz-lDrhb-VF73plxmswHqzkg9Ip",          // توقيع المدير
    AHMED_SIG_FILE_ID: "1EDt2jNf62Sx6m1grpUlFk5wFFhKpOdeO",            // احتياطي
    NAIF_SIG_FILE_ID: "1zbaM0oz-lDrhb-VF73plxmswHqzkg9Ip",             // احتياطي

    // أسماء الأوراق في Google Sheets
    SHEET_RESPONSES_NAME: "ردود النموذج 1",
    SHEET_STAFF_ALL: "Staff_All",
    SHEET_AUDIT_LOG: "Audit_Log",
    SHEET_TEACHER_DATA: "بيانات المعلمين",

    // مجلدات Drive
    NUR_IMPORTS_FOLDER: "NUR_Imports",
    NUR_PROCESSED_FOLDER: "_Processed",
    ARCHIVE_FOLDER: "_Archive",

    // بادئة ملفات نور
    NUR_FILE_PREFIX: "GetEmployeeDataList",

    // إعدادات الاستيراد
    IMPORT_MIN_ID_LENGTH: 10,
    IMPORT_START_ROW: 17,
    IMPORT_USER_TYPE_CELL_ROW: 7,
    IMPORT_USER_TYPE_CELL_COL: 2,

    // الأدوار الإدارية
    ADMIN_ROLES: [
      "مدير مدرسة",
      "وكيل",
      "وكيل شؤون طلاب",
      "وكيل شؤون تعليمية",
      "مسؤول تقويم",
      "إدارة مدرسية",
      "سكرتير"
    ],

    // السجلات المدنية للقيادة (طوارئ)
    ADMIN_NATIONAL_IDS: [
      "1046940365", // نايف الحربي - مدير
      "1060852900", // محمد الحربي - وكيل
      "1006741209", // خالد العمري - وكيل
      "1008379958"  // أحمد الشهري - مسؤول تقويم
    ],

    // عمود رابط بطاقة PDF في ردود النموذج
    PDF_URL_COLUMN: "رابط بطاقة الشاهد (PDF)"
  };

  const DOMAINS_LIST = [
    "01 الإدارة المدرسية",
    "02 التعليم والتعلم",
    "03 نواتج التعلم",
    "04 البيئة المدرسية"
  ];

  const DOMAINS_TOTAL_INDICATORS = {
    "01 الإدارة المدرسية": 16,
    "02 التعليم والتعلم": 12,
    "03 نواتج التعلم": 6,
    "04 البيئة المدرسية": 4
  };

  function get(key) {
    return SETTINGS[key] !== undefined ? SETTINGS[key] : null;
  }

  function getDomains() {
    return DOMAINS_LIST;
  }

  function getDomainIndicatorsCount(domainName) {
    return DOMAINS_TOTAL_INDICATORS[domainName] || 0;
  }

  function isAdmin(nationalId, role) {
    if (nationalId) {
      const id = String(nationalId).trim();
      if (SETTINGS.ADMIN_NATIONAL_IDS.indexOf(id) !== -1) return true;
    }
    if (role) {
      const r = String(role).trim();
      if (SETTINGS.ADMIN_ROLES.indexOf(r) !== -1) return true;
    }
    return false;
  }

  function isAdminRole(role) {
    if (!role) return false;
    return SETTINGS.ADMIN_ROLES.indexOf(String(role).trim()) !== -1;
  }

  return {
    get: get,
    getDomains: getDomains,
    getDomainIndicatorsCount: getDomainIndicatorsCount,
    isAdmin: isAdmin,
    isAdminRole: isAdminRole
  };
})();