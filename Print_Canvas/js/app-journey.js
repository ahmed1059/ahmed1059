/* قشرة الرحلة — SPA Hash Routing · Vanilla JS فقط
   المصدر: مسارات /api فقط · بلا استيراد ملفات النظام القديم */

(function () {
  "use strict";

  var sessionRedirected = false;
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  if (nativeFetch) {
    window.fetch = function (input, init) {
      return nativeFetch(input, init).then(function (response) {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        var headerBag = init && init.headers;
        var sentToken = "";
        if (headerBag && typeof headerBag.get === "function") {
          sentToken = String(headerBag.get("X-Session-Token") || headerBag.get("x-session-token") || "");
        } else if (headerBag && typeof headerBag === "object") {
          sentToken = String(
            headerBag["X-Session-Token"] || headerBag["x-session-token"] || ""
          );
        }
        if (
          response &&
          response.status === 403 &&
          response.headers &&
          response.headers.get("X-Password-Change") === "1" &&
          !sessionRedirected
        ) {
          sessionRedirected = true;
          window.location.replace("login.html?change=1");
        }
        /* لا تُسقط الجلسة إلا إذا أُرسل توكن صريح ورُفض — طلب بلا توكن لا يُخرج المستخدم */
        if (
          response &&
          response.status === 401 &&
          String(url).indexOf("/api/") === 0 &&
          sentToken &&
          !sessionRedirected
        ) {
          sessionRedirected = true;
          try {
            sessionStorage.removeItem("sessionUser");
          } catch (ignore) {
            /* الجلسة غير متاحة */
          }
          window.location.replace("login.html?reason=expired");
        }
        return response;
      });
    };
  }

  var browserWarn = document.getElementById("aj-browser-warn");
  if (
    browserWarn &&
    (!window.WebSocket || !window.fetch || !window.Promise || document.documentMode)
  ) {
    browserWarn.hidden = false;
  }
  window.addEventListener("app:disk:low", function (event) {
    var percent = event.detail && event.detail.free_percent;
    var text = "المساحة المتبقية أقل من 10%";
    if (percent != null) {
      text += " (" + percent + "%)";
    }
    showToast(text, "error");
  });

  var VIEWS = [
    "view-home",
    "view-desk",
    "view-station-foundation",
    "view-station-planning",
    "view-station-registers",
    "view-station-measurement",
    "view-access-hub",
    "view-calendar-hub",
    "view-system-care",
    "view-term-schedule",
    "view-nafes",
    "view-license-form",
    "view-visits",
    "view-visits-plan",
    "view-practice-evidence",
    "view-performance",
    "view-tasks",
    "view-task-details",
    "view-planning",
    "view-smart-planning",
    "view-program-add",
    "view-staff",
    "view-school",
    "view-external-eval",
    "view-leadership",
    "view-committees",
    "view-deliverables",
    "view-calendar",
    "view-occasions",
    "view-letterhead",
    "view-backup",
    "view-noor-import",
    "view-import-center",
    "view-accounts",
    "view-permissions",
    "view-trash",
    "view-audit",
    "view-health",
    "view-students-lists",
    "view-student-registry",
    "view-plan-details",
    "view-execution",
    "view-council-details",
    "view-evidence",
    "view-env-evidence",
    "view-profile",
    "view-soft-follow",
    "view-portfolio"
  ];
  var DEFAULT_VIEW = "view-desk";
  var VIEW_TITLES = {
    "view-home": "المحطات الأربع",
    "view-desk": "مكتبي",
    "view-station-foundation": "التأسيس والإعدادات المركزية",
    "view-station-planning": "الخطط المدرسية",
    "view-station-registers": "السجلات والمحاضر والشواهد",
    "view-station-measurement": "القياس والاعتماد المدرسي",
    "view-access-hub": "إدارة الحسابات وهندسة الصلاحيات",
    "view-calendar-hub": "التقويم المعتمد والمناسبات",
    "view-system-care": "النسخ الاحتياطي والتدقيق وفحص النظام",
    "view-term-schedule": "التوزيع الزمني على الفصلين",
    "view-nafes": "ملف التدريب والقياس (نافس)",
    "view-license-form": "تعبئة الرخص المهنية",
    "view-visits": "الزيارات الصفية",
    "view-visits-plan": "الخطة السنوية للزيارات الصفية",
    "view-practice-evidence": "شواهد الممارسات",
    "view-performance": "مؤشرات الأداء (SSOT)",
    "view-tasks": "التنبيهات ومهام اليوم",
    "view-task-details": "تفاصيل المهمة",
    "view-planning": "الخطة التشغيلية للمدرسة",
    "view-smart-planning": "الخطط الذكية",
    "view-program-add": "إضافة برنامج / مبادرة",
    "view-staff": "سجل المنسوبين",
    "view-school": "بيانات المدرسة",
    "view-external-eval": "التقويم الذاتي والاعتماد الخارجي (ETEC)",
    "view-leadership": "التشكيل القيادي",
    "view-committees": "تشكيل اللجان والمجالس",
    "view-deliverables": "تسليمات المعلمين ومتابعة الأداء",
    "view-calendar": "التقويم المعتمد",
    "view-occasions": "المناسبات",
    "view-letterhead": "الترويسة والأختام الرسمية",
    "view-backup": "النسخ الاحتياطي",
    "view-noor-import": "الاستيراد من نور",
    "view-import-center": "الاستيراد من نور",
    "view-accounts": "إدارة الحسابات",
    "view-permissions": "هندسة الصلاحيات",
    "view-trash": "سلة المهملات",
    "view-audit": "سجل التدقيق",
    "view-health": "فحص النظام",
    "view-students-lists": "قوائم الطلاب",
    "view-student-registry": "سجل طلاب المدرسة",
    "view-plan-details": "تفاصيل الخطة",
    "view-execution": "مركز التنفيذ ومحاضر اللجان",
    "view-council-details": "محضر المجلس",
    "view-evidence": "معرض الشواهد الشامل",
    "view-env-evidence": "شواهد البرامج والبيئة المدرسية",
    "view-profile": "ملفي الشخصي",
    "view-portfolio": "سجل الإنجاز",
    "view-soft-follow": "المتابعة اللاصفية"
  };
  var SIGNATURE_INK = "#000080";
  var PLAN_GOALS_PLACEHOLDER = "";
  var FIELD_MODE_MQ = "(max-width: 1023px)";

  /* الوحدة 3: رحلة متسلسلة + عزل شاشة واحدة — لا localStorage للبيانات */
  var STATION_BY_VIEW = {
    "view-station-foundation": "foundation",
    "view-school": "foundation",
    "view-letterhead": "foundation",
    "view-noor-import": "foundation",
    "view-import-center": "foundation",
    "view-staff": "foundation",
    "view-students-lists": "foundation",
    "view-student-registry": "foundation",
    "view-leadership": "foundation",
    "view-committees": "foundation",
    "view-access-hub": "foundation",
    "view-accounts": "foundation",
    "view-permissions": "foundation",
    "view-calendar-hub": "foundation",
    "view-calendar": "foundation",
    "view-occasions": "foundation",
    "view-system-care": "foundation",
    "view-backup": "foundation",
    "view-trash": "foundation",
    "view-audit": "foundation",
    "view-health": "foundation",
    "view-station-planning": "planning",
    "view-planning": "planning",
    "view-smart-planning": "planning",
    "view-program-add": "planning",
    "view-plan-details": "planning",
    "view-term-schedule": "planning",
    "view-station-registers": "registers",
    "view-execution": "registers",
    "view-council-details": "registers",
    "view-visits": "registers",
    "view-visits-plan": "registers",
    "view-deliverables": "registers",
    "view-evidence": "registers",
    "view-env-evidence": "registers",
    "view-license-form": "registers",
    "view-practice-evidence": "registers",
    "view-station-measurement": "measurement",
    "view-performance": "measurement",
    "view-nafes": "measurement",
    "view-external-eval": "measurement",
    "view-soft-follow": "measurement"
  };
  var stageButtons = document.querySelectorAll("[data-aj-stage]");
  var statusEl = document.getElementById("aj-status");
  var loadingEl = document.getElementById("aj-loading");
  var metaEl = document.getElementById("aj-meta");
  var cardsEl = document.getElementById("aj-cards");
  var softLoadingEl = document.getElementById("aj-soft-loading");
  var softStatusEl = document.getElementById("aj-soft-status");
  var softMetaEl = document.getElementById("aj-soft-meta");
  var softDaysEl = document.getElementById("aj-soft-days");
  var softEmptyEl = document.getElementById("aj-soft-empty");
  var softCardsEl = document.getElementById("aj-soft-cards");
  var tasksStatusEl = document.getElementById("aj-tasks-status");
  var tasksLoadingEl = document.getElementById("aj-tasks-loading");
  var tasksMetaEl = document.getElementById("aj-tasks-meta");
  var tasksEmptyEl = document.getElementById("aj-tasks-empty");
  var tasksCardsEl = document.getElementById("aj-tasks-cards");
  var tasksSummaryEl = document.getElementById("aj-tasks-summary");
  var tasksFiltersEl = document.getElementById("aj-tasks-filters");
  var detailTitleEl = document.getElementById("aj-detail-title");
  var detailStatusBadgeEl = document.getElementById("aj-detail-status-badge");
  var detailStatusLineEl = document.getElementById("aj-detail-status-line");
  var detailDateEl = document.getElementById("aj-detail-date");
  var detailDescEl = document.getElementById("aj-detail-desc");
  var detailErrorEl = document.getElementById("aj-detail-error");
  var detailCompleteBtn = document.getElementById("aj-detail-complete");
  var detailEvidenceBtn = document.getElementById("aj-detail-evidence");
  var detailPrintBtn = document.getElementById("aj-detail-print");
  var taskCompleteInFlight = false;
  var planSummaryEl = document.getElementById("aj-plan-summary");
  var planLoadingEl = document.getElementById("aj-plan-loading");
  var planStatusEl = document.getElementById("aj-plan-status");
  var planEmptyEl = document.getElementById("aj-plan-empty");
  var planCardsEl = document.getElementById("aj-plan-cards");
  var smartLoadingEl = document.getElementById("aj-smart-loading");
  var smartStatusEl = document.getElementById("aj-smart-status");
  var smartMissingEl = document.getElementById("aj-smart-missing");
  var smartEmptyEl = document.getElementById("aj-smart-empty");
  var smartCardsEl = document.getElementById("aj-smart-cards");
  var smartCache = null;
  var smartLoaded = false;
  var smartLoading = false;
  var programFormEl = document.getElementById("aj-program-form");
  var programTemplateEl = document.getElementById("aj-program-template");
  var programOwnersEl = document.getElementById("aj-program-owners");
  var programLinkHintEl = document.getElementById("aj-program-link-hint");
  var programLoadingEl = document.getElementById("aj-program-loading");
  var programStatusEl = document.getElementById("aj-program-status");
  var programMissingEl = document.getElementById("aj-program-missing");
  var programErrorEl = document.getElementById("aj-program-form-error");
  var programSaveBtn = document.getElementById("aj-program-save");
  var programFormTitleEl = document.getElementById("aj-program-form-title");
  var editingProgramId = 0;
  var giftedAssignBtn = document.getElementById("aj-gifted-assign");
  var giftedAssignModalEl = document.getElementById("aj-gifted-assign-modal");
  var giftedAssignFormEl = document.getElementById("aj-gifted-assign-form");
  var giftedStaffEl = document.getElementById("aj-gifted-staff");
  var giftedAssignErrorEl = document.getElementById("aj-gifted-assign-error");
  var programReopenBtn = document.getElementById("aj-program-reopen");
  var programBoardCountDraftEl = document.getElementById("aj-program-count-draft");
  var programBoardCountProgressEl = document.getElementById("aj-program-count-progress");
  var programBoardCountDoneEl = document.getElementById("aj-program-count-done");
  var programBoardFiltersEl = document.getElementById("aj-program-board-filters");
  var programBoardLoadingEl = document.getElementById("aj-program-board-loading");
  var programBoardEmptyEl = document.getElementById("aj-program-board-empty");
  var programBoardListEl = document.getElementById("aj-program-board-list");
  var programGoalKpisEl = document.getElementById("aj-program-goal-kpis");
  var programGoalKpiListEl = document.getElementById("aj-program-goal-kpi-list");
  var programBankQEl = document.getElementById("aj-program-bank-q");
  var programBankHitsEl = document.getElementById("aj-program-bank-hits");
  var programBankActionsEl = document.getElementById("aj-program-bank-actions");
  var programBankActionsWrapEl = document.getElementById("aj-program-bank-actions-wrap");
  var programBankEvidenceEl = document.getElementById("aj-program-bank-evidence");
  var programBankEvidenceWrapEl = document.getElementById("aj-program-bank-evidence-wrap");
  var programBankCommitteesEl = document.getElementById("aj-program-bank-committees");
  var programBankCommitteesWrapEl = document.getElementById("aj-program-bank-committees-wrap");
  var programBankMetaEl = document.getElementById("aj-program-bank-meta");
  var programBankCode = "";
  var programCatalog = null;
  var programGoals = [];
  var programMissingIds = [];
  var programIndicatorIds = [];
  var programDutyRef = "";
  var programTaskRef = "";
  var programSaveInFlight = false;
  var programGiftedAssignment = null;
  var lastSavedProgramId = 0;
  var programBoardCache = null;
  var programBoardFilter = "all";
  var programFlashTimers = [];
  var staffSummaryEl = document.getElementById("aj-staff-summary");
  var staffLoadingEl = document.getElementById("aj-staff-loading");
  var staffStatusEl = document.getElementById("aj-staff-status");
  var staffEmptyEl = document.getElementById("aj-staff-empty");
  var staffTableWrapEl = document.getElementById("aj-staff-table-wrap");
  var staffTbodyEl = document.getElementById("aj-staff-tbody");
  var staffCardsEl = document.getElementById("aj-staff-cards");
  var staffAddBtn = document.getElementById("aj-staff-add");
  var staffFilterRoleEl = document.getElementById("aj-staff-filter-role");
  var staffFilterSpecialtyEl = document.getElementById("aj-staff-filter-specialty");
  var staffFilterQEl = document.getElementById("aj-staff-filter-q");
  var staffPrintBtn = document.getElementById("aj-staff-print");
  var staffModalEl = document.getElementById("aj-staff-modal");
  var staffFormEl = document.getElementById("aj-staff-form");
  var staffFormTitleEl = document.getElementById("aj-staff-form-title");
  var staffFormErrorEl = document.getElementById("aj-staff-form-error");
  var staffOriginalIdEl = document.getElementById("aj-staff-original-id");
  var staffNameEl = document.getElementById("aj-staff-name");
  var staffNationalIdEl = document.getElementById("aj-staff-national-id");
  var staffRoleEl = document.getElementById("aj-staff-role");
  var staffSpecialtyEl = document.getElementById("aj-staff-specialty");
  var staffMobileEl = document.getElementById("aj-staff-mobile");
  var staffActiveEl = document.getElementById("aj-staff-active");
  var staffSaveBtn = document.getElementById("aj-staff-save");
  var planDetailTitleEl = document.getElementById("aj-plan-detail-title");
  var planDetailStatusEl = document.getElementById("aj-plan-detail-status");
  var planDetailMetaEl = document.getElementById("aj-plan-detail-meta");
  var planDetailGoalsEl = document.getElementById("aj-plan-detail-goals");
  var planDetailErrorEl = document.getElementById("aj-plan-detail-error");
  var planApproveBtn = document.getElementById("aj-plan-approve");
  var planEditBtn = document.getElementById("aj-plan-edit");
  var planPrintBtn = document.getElementById("aj-plan-print");
  var planPrint122Btn = document.getElementById("aj-plan-print-122");
  var planPrint131Btn = document.getElementById("aj-plan-print-131");
  var planWitness131Btn = document.getElementById("aj-plan-witness-131");
  var planPrint141Btn = document.getElementById("aj-plan-print-141");
  var planWitness141Btn = document.getElementById("aj-plan-witness-141");
  var witnessFilesBox = document.getElementById("aj-witness-files");
  var witnessFilesList = document.getElementById("aj-witness-files-list");
  var witnessFileAddBtn = document.getElementById("aj-witness-file-add");
  var witnessFileInput = document.getElementById("aj-witness-file-input");
  var planPrint146Btn = document.getElementById("aj-plan-print-146");
  var planPrint142Btn = document.getElementById("aj-plan-print-142");
  var planPdfBtn = document.getElementById("aj-plan-pdf");
  var planEvidenceBtn = document.getElementById("aj-plan-evidence");
  var planPhotosBtn = document.getElementById("aj-plan-photos");
  var planFileBtn = document.getElementById("aj-plan-file");
  var programPlanEl = document.getElementById("aj-program-plan");
  var programPlanPreviewEl = document.getElementById("aj-program-plan-preview");
  var programPlanFrameEl = document.getElementById("aj-program-plan-frame");
  var programPlanEmptyEl = document.getElementById("aj-program-plan-empty");
  var programPlanDeleteEl = document.getElementById("aj-program-plan-delete");
  var programPlanFileEl = document.getElementById("aj-program-plan-file");
  var programPhotosEl = document.getElementById("aj-program-photos");
  var programPhotosListEl = document.getElementById("aj-program-photos-list");
  var programPhotoCaptionEl = document.getElementById("aj-program-photo-caption");
  var programPhotoFileEl = document.getElementById("aj-program-photo-file");
  var planDetailGoalsLabelEl = document.getElementById("aj-plan-detail-goals-label");
  var printStagePdfBtn = document.getElementById("aj-print-preview-pdf");
  var printStageExportBtn = document.getElementById("aj-print-preview-export");
  var currentProgramRecord = null;
  var currentProgramEvidence = [];
  var currentProgramImages = [];
  var currentProgramPlan = null;
  var evidencePrefillLabel = "";
  var execSummaryEl = document.getElementById("aj-exec-summary");
  var execLoadingEl = document.getElementById("aj-exec-loading");
  var execStatusEl = document.getElementById("aj-exec-status");
  var execEmptyEl = document.getElementById("aj-exec-empty");
  var execCardsEl = document.getElementById("aj-exec-cards");
  var councilAddBtn = document.getElementById("aj-council-add");
  var councilModalEl = document.getElementById("aj-council-modal");
  var councilFormEl = document.getElementById("aj-council-form");
  var councilFormErrorEl = document.getElementById("aj-council-form-error");
  var councilTypeEl = document.getElementById("aj-council-type");
  var councilDateEl = document.getElementById("aj-council-date");
  var councilAgendaEl = document.getElementById("aj-council-agenda");
  var councilPresentListEl = document.getElementById("aj-council-present-list");
  var councilPresentStatusEl = document.getElementById("aj-council-present-status");
  var councilMinutesEl = document.getElementById("aj-council-minutes");
  var councilSaveBtn = document.getElementById("aj-council-save");
  var councilDetailTitleEl = document.getElementById("aj-council-detail-title");
  var councilDetailDateEl = document.getElementById("aj-council-detail-date");
  var councilDetailBodyEl = document.getElementById("aj-council-detail-body");
  var councilAttendanceEl = document.getElementById("aj-council-attendance");
  var councilDetailErrorEl = document.getElementById("aj-council-detail-error");
  var councilSignatureTicket = 0;
  var councilPrintBtn = document.getElementById("aj-council-print");
  var evidenceSummaryEl = document.getElementById("aj-evidence-summary");
  var evidenceLoadingEl = document.getElementById("aj-evidence-loading");
  var evidenceStatusEl = document.getElementById("aj-evidence-status");
  var evidenceEmptyEl = document.getElementById("aj-evidence-empty");
  var evidenceCardsEl = document.getElementById("aj-evidence-cards");
  var evidenceAddBtn = document.getElementById("aj-evidence-add");
  var evidenceModalEl = document.getElementById("aj-evidence-modal");
  var evidenceFormEl = document.getElementById("aj-evidence-form");
  var evidenceFormErrorEl = document.getElementById("aj-evidence-form-error");
  var evidenceEntityTypeEl = document.getElementById("aj-evidence-entity-type");
  var evidenceEntityKeyEl = document.getElementById("aj-evidence-entity-key");
  var evidenceDateEl = document.getElementById("aj-evidence-date");
  var evidenceFileEl = document.getElementById("aj-evidence-file");
  var evidenceFileNameEl = document.getElementById("aj-evidence-file-name");
  var evidenceDropEl = document.getElementById("aj-evidence-drop");
  var evidenceSaveBtn = document.getElementById("aj-evidence-save");
  var evidenceDeliverKindWrapEl = document.getElementById("aj-evidence-deliver-kind-wrap");
  var evidenceDeliverSubjectWrapEl = document.getElementById("aj-evidence-deliver-subject-wrap");
  var evidenceDeliverYearWrapEl = document.getElementById("aj-evidence-deliver-year-wrap");
  var evidenceDeliverKindEl = document.getElementById("aj-evidence-deliver-kind");
  var evidenceDeliverSubjectEl = document.getElementById("aj-evidence-deliver-subject");
  var evidenceDeliverYearEl = document.getElementById("aj-evidence-deliver-year");
  var evidenceTeacherPeople = [];
  var evidenceOptionsCache = null;
  var evidenceSaveInFlight = false;
  var toastEl = document.getElementById("aj-toast");
  var toastTimer = null;
  var signatureModalEl = document.getElementById("signature-modal");
  var signaturePadEl = document.getElementById("signature-pad");
  var signatureAckEl = document.getElementById("signature-ack");
  var signatureClearBtn = document.getElementById("signature-clear");
  var signatureSaveBtn = document.getElementById("signature-save");
  var signatureFormErrorEl = document.getElementById("signature-form-error");
  var signatureModalHintEl = document.getElementById("signature-modal-hint");
  var signatureModeDrawBtn = document.getElementById("signature-mode-draw");
  var signatureModeUploadBtn = document.getElementById("signature-mode-upload");
  var signatureDrawPanelEl = document.getElementById("signature-draw-panel");
  var signatureUploadPanelEl = document.getElementById("signature-upload-panel");
  var signatureFileEl = document.getElementById("signature-file");
  var signatureUploadBtn = document.getElementById("signature-upload-btn");
  var signatureUploadStatusEl = document.getElementById("signature-upload-status");
  var signatureUploadPreviewWrapEl = document.getElementById("signature-upload-preview-wrap");
  var signatureUploadPreviewEl = document.getElementById("signature-upload-preview");
  var printedSignatureEl = document.getElementById("printed-signature");
  var printedSignatureNameEl = document.getElementById("printed-signature-name");
  var profileMetaEl = document.getElementById("aj-profile-meta");
  var profileSignatureEl = document.getElementById("aj-profile-signature");
  var profileSignatureEmptyEl = document.getElementById("aj-profile-signature-empty");
  var profileSignerNameEl = document.getElementById("aj-profile-signer-name");
  var profileEditBtn = document.getElementById("aj-profile-edit-signature");
  var topbarTitle = document.getElementById("aj-topbar-title");
  var backBtn = document.getElementById("aj-back");
  var backdrop = document.getElementById("aj-backdrop");
  var menuOpen = document.getElementById("aj-menu-open");
  var menuOpenBottom = document.getElementById("aj-menu-open-bottom");

  var currentUser = null;
  var currentSignatureDataUrl = "";
  var signaturePadCtx = null;
  var signatureDrawing = false;
  var signatureHasStroke = false;
  var signatureModalRequired = false;
  var signatureSaveInFlight = false;
  var signatureExtractInFlight = false;
  var signatureInputMode = "draw";
  var uploadedSignatureDataUrl = "";
  var signExtractModulePromise = null;
  var SIGNATURE_EXTRACT_CDN = "https://cdn.jsdelivr.net/npm/sign-extract@0.1.0/+esm";
  var ssotLoaded = false;
  var ssotLoading = false;
  var tasksLoaded = false;
  var tasksLoading = false;
  var tasksCache = null;
  var tasksFilter = "all";
  var pendingDetailId = null;
  var planningLoaded = false;
  var planningLoading = false;
  var planningCache = null;
  var staffLoaded = false;
  var staffLoading = false;
  var staffCache = null;
  var staffSaveInFlight = false;
  var pendingPlanDetailId = null;
  var approveInFlight = false;
  var councilsLoaded = false;
  var councilsLoading = false;
  var councilsCache = null;
  var pendingCouncilDetailId = null;
  var evidenceLoaded = false;
  var evidenceLoading = false;
  var evidenceCache = null;

  var EVIDENCE_ENTITY_LABELS = {
    council_minutes: "محضر مجلس",
    program: "برنامج",
    soft_period: "فترة لاصفية",
    teacher_deliverable: "تسليم معلم",
    daily_task: "مهمة يومية",
    action: "إجراء",
    minutes: "محضر",
    event: "فعالية",
    lesson: "حصة",
    register: "سجل"
  };

  var SOFT_SLOT_LABELS = {
    lineup: "الاصطفاف الصباحي",
    break: "الاستراحة",
    prayer: "الصلاة"
  };

  var COUNCIL_TYPE_LABELS = {
    admin: "اللجنة الإدارية",
    guidance: "لجنة التوجيه والإرشاد",
    achievement: "لجنة التحصيل الدراسي",
    excellence: "لجنة التميز",
    fund: "فريق الصندوق المدرسي",
    safety: "فريق الأمن والسلامة المدرسية",
    activity: "لجنة النشاط والمناسبات",
    discipline: "لجنة الانضباط والتدخل السريع",
    special: "فريق التربية الخاصة",
    teachers: "مجلس المعلمين",
    students: "مجلس الطلاب",
    parents: "مجلس أولياء الأمور"
  };

  var COUNCIL_REGISTER_MAP = {
    admin: { registerKey: "leadership", registerLabel: "سجل القيادة والإدارة المدرسية" },
    guidance: { registerKey: "behavior", registerLabel: "سجل التوجيه والإرشاد والسلوك" },
    discipline: { registerKey: "behavior", registerLabel: "سجل الانضباط والمواظبة" },
    achievement: { registerKey: "grades", registerLabel: "سجل التحصيل ونواتج التعلم" },
    excellence: { registerKey: "indicators", registerLabel: "سجل الاعتماد والتميز والجودة" },
    activity: { registerKey: "activity", registerLabel: "سجل خطة النشاط" },
    fund: { registerKey: "accounts", registerLabel: "سجل الصندوق المدرسي" },
    safety: { registerKey: "facility", registerLabel: "سجل الأمن والسلامة" },
    special: { registerKey: "support", registerLabel: "سجل التربية الخاصة والدعم" }
  };

  var councilSaveInFlight = false;
  var councilChairName = "";
  var councilChairLoading = null;
  var councilDraftStamp = "";
  var councilEditingId = "";

  var SSOT_URLS = [
    "/api/performance-metrics",
    "/components/_shared/performance_metrics.json"
  ];

  function setTextStatus(el, text, isError) {
    if (!el) {
      return;
    }
    el.textContent = text || "";
    el.classList.toggle("is-error", !!isError);
  }

  function setHidden(el, hidden) {
    if (el) {
      el.hidden = !!hidden;
    }
  }

  function softFetch(url) {
    return fetch(url, { cache: "no-store" }).then(
      function (response) {
        return response.ok ? response.json() : null;
      },
      function () {
        return null;
      }
    );
  }

  function showToast(message, kind) {
    if (!toastEl) {
      console.log("[app-journey]", message);
      return;
    }
    toastEl.hidden = false;
    toastEl.className = "aj-toast is-" + (kind || "info");
    toastEl.textContent = String(message || "");
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(function () {
      toastEl.hidden = true;
    }, 3200);
  }

  var SESSION_KEY = "sessionUser";
  var authGateEl = document.getElementById("aj-auth-gate");
  var authStatusEl = document.getElementById("aj-auth-status");
  var authSpinnerEl = document.getElementById("aj-auth-spinner");
  var authRetryBtn = document.getElementById("aj-auth-retry");
  var userNameEl = document.getElementById("aj-user-name");
  var schoolNameEl = document.getElementById("aj-school-name");
  var logoutBtn = document.getElementById("aj-logout");
  var authCheckInFlight = false;

  function readStoredSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function clearStoredSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function redirectToLogin() {
    window.location.replace("login.html");
  }

  function showAuthGate(message, failed) {
    document.body.classList.remove("aj-auth-ready");
    setHidden(authGateEl, false);
    if (authStatusEl) {
      authStatusEl.textContent = message;
    }
    setHidden(authSpinnerEl, !!failed);
    setHidden(authRetryBtn, !failed);
  }

  function revealShell(user) {
    currentUser = user;
    document.querySelectorAll(".aj-principal-only").forEach(function (node) {
      node.hidden = !(user && String(user.role || "").indexOf("مدير") === 0);
    });
    document.querySelectorAll(".aj-leadership-only").forEach(function (node) {
      var role = user ? String(user.role || "") : "";
      node.hidden = !(role.indexOf("مدير") === 0 || role.indexOf("وكيل") !== -1);
    });
    document.querySelectorAll(".aj-owner-only").forEach(function (node) {
      var roles = user && Array.isArray(user.roles) ? user.roles : [];
      var id = user && user.id ? String(user.id) : "";
      var owner = id === "1008379958"
        || String(user && user.role || "") === "مدير نظام"
        || roles.indexOf("مدير نظام") !== -1;
      node.hidden = !owner;
    });
    if (userNameEl) {
      userNameEl.textContent = user && user.name ? String(user.name) : "";
    }
    document.body.classList.add("aj-auth-ready");
    setHidden(authGateEl, true);
    loadSchoolName();
  }

  function loadSchoolName() {
    if (!schoolNameEl) {
      return Promise.resolve();
    }
    return fetch("/api/settings", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          return null;
        }
        return response.json();
      })
      .then(function (data) {
        var name = data && data.school && data.school.name
          ? String(data.school.name).trim()
          : "";
        schoolNameEl.textContent = name;
      })
      .catch(function () {
        schoolNameEl.textContent = "";
      });
  }

  var schoolSettingsPayload = null;
  var schoolSaveInFlight = false;
  var SCHOOL_FIELDS = [
    ["name", "اسم المدرسة"],
    ["statistical_number", "الرقم الإحصائي"],
    ["education_administration", "الإدارة التعليمية"],
    ["education_office", "مكتب التعليم"],
    ["building_type", "نوع المبنى"],
    ["classrooms", "الفصول"],
    ["labs", "المعامل"],
    ["sports_halls", "الصالات"],
    ["total_students", "عدد الطلاب"],
    ["total_staff", "عدد المنسوبين"],
    ["term_weeks_count", "أسابيع الفصل"]
  ];

  function schoolControl(key, value) {
    var current = value == null ? "" : String(value);
    if (key === "building_type") {
      var select = document.createElement("select");
      select.className = "aj-soft-note";
      select.setAttribute("data-school-key", key);
      ["حكومي", "مستأجر"].forEach(function (optionValue) {
        var option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        select.appendChild(option);
      });
      if (current && current !== "حكومي" && current !== "مستأجر") {
        var extra = document.createElement("option");
        extra.value = current;
        extra.textContent = current;
        select.appendChild(extra);
      }
      select.value = current || "حكومي";
      return select;
    }
    var input = document.createElement("input");
    input.type = "text";
    input.className = "aj-soft-note";
    input.setAttribute("data-school-key", key);
    if (key === "term_weeks_count") {
      input.inputMode = "numeric";
    }
    input.value = current;
    return input;
  }

  function schoolFieldValue(key) {
    var field = document.querySelector("#aj-school-fields [data-school-key=\"" + key + "\"]");
    return field ? String(field.value || "").trim() : "";
  }

  function renderSchoolSettings(school) {
    var host = document.getElementById("aj-school-fields");
    if (!host) {
      return;
    }
    host.innerHTML = "";
    var data = school || {};
    SCHOOL_FIELDS.forEach(function (pair) {
      var row = document.createElement("label");
      row.className = "aj-soft-label";
      row.textContent = pair[1];
      row.appendChild(schoolControl(pair[0], data[pair[0]]));
      host.appendChild(row);
    });
  }

  function loadSchoolSettings() {
    var loadingEl = document.getElementById("aj-school-loading");
    var statusEl = document.getElementById("aj-school-status");
    setHidden(loadingEl, false);
    setTextStatus(statusEl, "", false);
    fetch("/api/settings", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok || !body || !body.school) {
            throw new Error(apiErrorMessage(body, "تعذر قراءة بيانات المدرسة."));
          }
          return body;
        });
      })
      .then(function (body) {
        if (currentHashView() !== "view-school") {
          return;
        }
        schoolSettingsPayload = body;
        renderSchoolSettings(body.school);
        if (schoolNameEl && body.school.name) {
          schoolNameEl.textContent = String(body.school.name).trim();
        }
      })
      .catch(function (error) {
        schoolSettingsPayload = null;
        renderSchoolSettings({});
        setTextStatus(statusEl, (error && error.message) || "تعذر قراءة بيانات المدرسة.", true);
      })
      .finally(function () {
        setHidden(loadingEl, true);
      });
  }

  function saveSchoolSettings(button) {
    if (schoolSaveInFlight) {
      return;
    }
    var statusEl = document.getElementById("aj-school-status");
    if (!schoolSettingsPayload) {
      setTextStatus(statusEl, "تعذر الحفظ قبل اكتمال القراءة.", true);
      return;
    }
    var name = schoolFieldValue("name");
    var building = schoolFieldValue("building_type");
    var weeksText = schoolFieldValue("term_weeks_count");
    var weeks = Number(weeksText);
    if (!name) {
      setTextStatus(statusEl, "اسم المدرسة مطلوب.", true);
      return;
    }
    if (building !== "حكومي" && building !== "مستأجر") {
      setTextStatus(statusEl, "نوع المبنى يجب أن يكون حكوميًا أو مستأجرًا.", true);
      return;
    }
    if (!/^\d+$/.test(weeksText) || weeks < 10 || weeks > 20) {
      setTextStatus(statusEl, "أسابيع الفصل بين 10 و 20.", true);
      return;
    }
    var committee = schoolSettingsPayload.committee || {};
    var payload = {
      school: {
        name: name,
        statistical_number: schoolFieldValue("statistical_number"),
        education_office: schoolFieldValue("education_office"),
        education_administration: schoolFieldValue("education_administration"),
        building_type: building,
        classrooms: schoolFieldValue("classrooms"),
        labs: schoolFieldValue("labs"),
        sports_halls: schoolFieldValue("sports_halls"),
        total_students: schoolFieldValue("total_students"),
        total_staff: schoolFieldValue("total_staff"),
        term_weeks_count: weeks
      },
      committee: {
        chair_name: committee.chair_name || "",
        members: Array.isArray(committee.members) ? committee.members : [],
        parent_representative: Array.isArray(committee.parent_representative) ? committee.parent_representative : [],
        student_representative: Array.isArray(committee.student_representative) ? committee.student_representative : []
      },
      sources: Array.isArray(schoolSettingsPayload.sources) ? schoolSettingsPayload.sources : [],
      approval: schoolSettingsPayload.approval || null
    };
    schoolSaveInFlight = true;
    if (button) {
      button.disabled = true;
    }
    setTextStatus(statusEl, "", false);
    fetch("/api/settings", {
      method: "POST",
      headers: authHeaders(),
      cache: "no-store",
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر حفظ بيانات المدرسة."));
          }
          return body;
        });
      })
      .then(function () {
        showToast("تم حفظ بيانات المدرسة", "info");
        window.dispatchEvent(new CustomEvent("app:settings:saved"));
      })
      .catch(function (error) {
        setTextStatus(statusEl, (error && error.message) || "تعذر حفظ بيانات المدرسة.", true);
      })
      .finally(function () {
        schoolSaveInFlight = false;
        if (button) {
          button.disabled = false;
        }
      });
  }

  var leadershipPeople = [];
  var liveLeadershipSeats = {};
  var leadershipSaveInFlight = false;

  function setLiveLeadership(payload) {
    liveLeadershipSeats = payload && typeof payload === "object" ? payload : {};
    window.AjLeadershipSeats = liveLeadershipSeats;
  }

  function flattenLeadershipIds(value) {
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return String(item || "").trim();
      }).filter(Boolean);
    }
    var text = String(value || "").trim();
    return text ? [text] : [];
  }

  function leadershipSelect(selectedId) {
    var select = document.createElement("select");
    select.className = "aj-soft-note";
    var blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "بانتظار التعيين";
    select.appendChild(blank);
    leadershipPeople.forEach(function (person) {
      if (!person || person.id == null || !person.name) {
        return;
      }
      var option = document.createElement("option");
      option.value = String(person.id);
      option.textContent = String(person.name);
      select.appendChild(option);
    });
    var current = String(selectedId || "");
    var known = Array.prototype.some.call(select.options, function (option) {
      return option.value === current;
    });
    select.value = known ? current : "";
    return select;
  }

  function leadershipRow(selectedId, withDelete) {
    var row = document.createElement("div");
    row.className = "aj-leadership-row";
    row.appendChild(leadershipSelect(selectedId));
    if (withDelete) {
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "aj-staff-delete";
      remove.textContent = "حذف";
      remove.setAttribute("data-leadership-remove", "1");
      row.appendChild(remove);
    }
    return row;
  }

  function leadershipListHost(role, ids, withDelete) {
    var host = document.createElement("div");
    host.id = "aj-leadership-" + role;
    if (withDelete) {
      host.setAttribute("data-leadership-rows", "1");
    }
    var values = Array.isArray(ids) && ids.length ? ids : [""];
    values.forEach(function (id) {
      host.appendChild(withDelete ? leadershipRow(id, true) : leadershipSelect(id));
    });
    return host;
  }

  function renderLeadershipForm(payload) {
    var form = document.getElementById("aj-leadership-form");
    if (!form) {
      return;
    }
    var data = payload || {};
    form.innerHTML = "";
    var singles = [
      ["manager", "المدير"],
      ["school_affairs_agent", "وكيل الشؤون المدرسية"],
      ["educational_supervisor", "الموجه التعليمي"],
      ["activity_leader", "رائد النشاط"],
      ["safety_supervisor", "مشرف الأمن والسلامة"],
      ["librarian", "أمين مصادر التعلم"],
      ["lab_tech", "محضر المختبر"]
    ];
    singles.forEach(function (pair) {
      var label = document.createElement("label");
      label.className = "aj-soft-label";
      var caption = document.createElement("span");
      caption.className = "aj-leadership-label";
      caption.textContent = pair[1];
      label.appendChild(caption);
      var select = leadershipSelect(data[pair[0]]);
      select.setAttribute("data-leadership", pair[0]);
      label.appendChild(select);
      form.appendChild(label);
    });
    [
      ["education_agents", "وكلاء الشؤون التعليمية", false],
      ["student_agents", "وكلاء شؤون الطلاب", false],
      ["counselors", "الموجه الطلابي", true]
    ].forEach(function (pair) {
      var block = document.createElement("div");
      block.className = "aj-leadership-block";
      var title = document.createElement("p");
      title.className = "aj-leadership-label";
      title.textContent = pair[1];
      block.appendChild(title);
      var stored = data[pair[0]];
      if (pair[0] === "counselors" && (!stored || !stored.length) && data.counselor) {
        stored = [data.counselor];
      }
      block.appendChild(leadershipListHost(pair[0], stored, pair[2]));
      var add = document.createElement("button");
      add.type = "button";
      add.className = "aj-detail-btn aj-detail-btn-secondary";
      add.textContent = "إضافة";
      add.setAttribute("data-leadership-add", "aj-leadership-" + pair[0]);
      block.appendChild(add);
      form.appendChild(block);
    });
  }

  function leadershipReferenceValue(data, key, fallback) {
    if (Array.isArray(data[key]) && data[key].length) {
      return data[key];
    }
    if (fallback && data[fallback]) {
      return [data[fallback]];
    }
    if (data[key] && !Array.isArray(data[key])) {
      return [data[key]];
    }
    return [];
  }

  function leadershipBrowserName(value) {
    var text = String(value || "").trim();
    if (!text) {
      return "";
    }
    var found = null;
    leadershipPeople.forEach(function (person) {
      if (person && String(person.id) === text) {
        found = person;
      }
    });
    return found && found.name ? String(found.name) : text;
  }

  function renderLeadershipReference() {
    var host = document.getElementById("aj-leadership-ref");
    var emptyEl = document.getElementById("aj-leadership-ref-empty");
    if (!host) {
      return;
    }
    host.innerHTML = "";
    var data = liveLeadershipSeats;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      setHidden(emptyEl, false);
      return;
    }
    var rows = [
      ["مدير المدرسة", flattenLeadershipIds(data.manager)],
      ["وكيل الشؤون المدرسية", flattenLeadershipIds(data.school_affairs_agent)],
      ["وكلاء الشؤون التعليمية", flattenLeadershipIds(data.education_agents)],
      ["وكلاء شؤون الطلاب", flattenLeadershipIds(data.student_agents)],
      ["الموجه الطلابي", flattenLeadershipIds(data.counselors).concat(flattenLeadershipIds(data.counselor))],
      ["رائد النشاط", flattenLeadershipIds(data.activity_leader)],
      ["الموجه التعليمي", flattenLeadershipIds(data.educational_supervisor)],
      ["مشرف الأمن والسلامة", flattenLeadershipIds(data.safety_supervisor)],
      ["أمين مصادر التعلم", flattenLeadershipIds(data.librarian)],
      ["محضر المختبر", flattenLeadershipIds(data.lab_tech)]
    ];
    var table = document.createElement("table");
    table.className = "aj-leadership-ref";
    var head = document.createElement("thead");
    var headRow = document.createElement("tr");
    ["اسم الدور", "اسم الشخص"].forEach(function (text) {
      var cell = document.createElement("th");
      cell.textContent = text;
      headRow.appendChild(cell);
    });
    head.appendChild(headRow);
    table.appendChild(head);
    var body = document.createElement("tbody");
    var shown = false;
    rows.forEach(function (row) {
      row[1].map(leadershipBrowserName).filter(Boolean).forEach(function (name) {
        shown = true;
        var line = document.createElement("tr");
        var role = document.createElement("td");
        role.textContent = row[0];
        var person = document.createElement("td");
        person.textContent = name;
        line.appendChild(role);
        line.appendChild(person);
        body.appendChild(line);
      });
    });
    table.appendChild(body);
    if (shown) {
      host.appendChild(table);
    }
    setHidden(emptyEl, shown);
  }

  function leadershipMissingIds(payload) {
    var known = {};
    leadershipPeople.forEach(function (person) {
      if (person && person.id != null) {
        known[String(person.id)] = true;
      }
    });
    var ids = []
      .concat(flattenLeadershipIds(payload.manager))
      .concat(flattenLeadershipIds(payload.school_affairs_agent))
      .concat(flattenLeadershipIds(payload.education_agents))
      .concat(flattenLeadershipIds(payload.student_agents))
      .concat(flattenLeadershipIds(payload.counselors))
      .concat(flattenLeadershipIds(payload.counselor))
      .concat(flattenLeadershipIds(payload.activity_leader))
      .concat(flattenLeadershipIds(payload.educational_supervisor))
      .concat(flattenLeadershipIds(payload.safety_supervisor))
      .concat(flattenLeadershipIds(payload.librarian))
      .concat(flattenLeadershipIds(payload.lab_tech));
    return ids.filter(function (id) {
      return id && !known[String(id)];
    });
  }

  function loadLeadership() {
    var loadingEl = document.getElementById("aj-leadership-loading");
    var statusEl = document.getElementById("aj-leadership-status");
    setHidden(loadingEl, false);
    setTextStatus(statusEl, "", false);
    Promise.all([
      fetch("/api/noor/staff", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok || !body || !Array.isArray(body.people)) {
            throw new Error("تعذر قراءة سجل المنسوبين.");
          }
          return body.people;
        });
      }),
      fetch("/api/session/leadership", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok || !body) {
            throw new Error(apiErrorMessage(body, "تعذر قراءة التشكيل القيادي."));
          }
          return body;
        });
      })
    ]).then(function (result) {
      if (currentHashView() !== "view-leadership") {
        return;
      }
      leadershipPeople = result[0];
      setLiveLeadership(result[1]);
      renderLeadershipForm(result[1]);
      renderLeadershipReference();
      if (leadershipMissingIds(result[1]).length) {
        setTextStatus(statusEl, "بعض الأرقام المحفوظة بلا صف في سجل المنسوبين.", false);
      }
    }).catch(function (error) {
      leadershipPeople = [];
      setLiveLeadership({});
      renderLeadershipForm({});
      renderLeadershipReference();
      setTextStatus(statusEl, (error && error.message) || "تعذر عرض التشكيل القيادي.", true);
    }).finally(function () {
      setHidden(loadingEl, true);
    });
  }

  function leadershipListValues(role) {
    var host = document.getElementById("aj-leadership-" + role);
    if (!host) {
      return [];
    }
    return Array.prototype.map.call(host.querySelectorAll("select"), function (select) {
      return String(select.value || "").trim();
    }).filter(Boolean);
  }

  function saveLeadership(button) {
    if (leadershipSaveInFlight) {
      return;
    }
    var statusEl = document.getElementById("aj-leadership-status");
    function single(role) {
      var field = document.querySelector("#aj-leadership-form [data-leadership=\"" + role + "\"]");
      return field ? String(field.value || "").trim() : "";
    }
    var payload = {
      manager: single("manager"),
      school_affairs_agent: single("school_affairs_agent"),
      education_agents: leadershipListValues("education_agents"),
      student_agents: leadershipListValues("student_agents"),
      counselors: leadershipListValues("counselors"),
      activity_leader: single("activity_leader"),
      educational_supervisor: single("educational_supervisor"),
      safety_supervisor: single("safety_supervisor"),
      librarian: single("librarian"),
      lab_tech: single("lab_tech")
    };
    leadershipSaveInFlight = true;
    if (button) {
      button.disabled = true;
    }
    setTextStatus(statusEl, "", false);
    fetch("/api/session/leadership", {
      method: "POST",
      headers: authHeaders(),
      cache: "no-store",
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر حفظ التشكيل القيادي."));
          }
          return body;
        });
      })
      .then(function (body) {
        setLiveLeadership(body);
        renderLeadershipForm(body);
        renderLeadershipReference();
        showToast("تم حفظ التشكيل", "success");
        window.dispatchEvent(new CustomEvent("app:leadership:saved"));
      })
      .catch(function (error) {
        setTextStatus(statusEl, (error && error.message) || "تعذر حفظ التشكيل القيادي.", true);
      })
      .finally(function () {
        leadershipSaveInFlight = false;
        if (button) {
          button.disabled = false;
        }
      });
  }

  function authHeaders() {
    var headers = { "Content-Type": "application/json" };
    var user = readStoredSession();
    if (user && user.token) {
      headers["X-Session-Token"] = user.token;
    }
    return headers;
  }

  function multipartAuthHeaders() {
    var headers = authHeaders() || {};
    var out = {};
    Object.keys(headers).forEach(function (key) {
      if (String(key).toLowerCase() !== "content-type") {
        out[key] = headers[key];
      }
    });
    return out;
  }

  function apiErrorMessage(payload, fallback) {
    if (!payload) {
      return fallback;
    }
    if (typeof payload.detail === "string") {
      return payload.detail;
    }
    if (Array.isArray(payload.detail) && payload.detail[0] && payload.detail[0].msg) {
      return payload.detail[0].msg;
    }
    return fallback;
  }

  function fetchSsot() {
    return softFetch(SSOT_URLS[0]).then(function (data) {
      if (data) {
        return { data: data, source: SSOT_URLS[0] };
      }
      return softFetch(SSOT_URLS[1]).then(function (fallback) {
        if (fallback) {
          return { data: fallback, source: SSOT_URLS[1] };
        }
        return null;
      });
    });
  }

  function openStage(stageId) {
    stageButtons.forEach(function (button) {
      var id = button.getAttribute("data-aj-stage");
      var panel = document.getElementById("aj-panel-" + id);
      var active = !!stageId && id === stageId;
      button.setAttribute("aria-expanded", active ? "true" : "false");
      if (panel) {
        panel.classList.toggle("is-open", active);
      }
    });
  }

  function isFieldMode() {
    return window.matchMedia(FIELD_MODE_MQ).matches;
  }

  function syncAdaptiveMode() {
    var field = isFieldMode();
    document.body.classList.toggle("aj-mode-field", field);
    document.body.classList.toggle("aj-mode-admin", !field);
    document.querySelectorAll(".aj-field-only").forEach(function (node) {
      node.hidden = !field;
    });
  }

  function isolateViews(viewId) {
    var known = {};
    VIEWS.forEach(function (id) {
      known[id] = true;
    });
    document.querySelectorAll(".aj-main > .aj-view").forEach(function (section) {
      var id = section.id || "";
      var active = id === viewId;
      section.hidden = !active;
      section.classList.toggle("is-active", active);
      if (active) {
        section.style.removeProperty("display");
      } else {
        section.style.display = "none";
      }
      if (id && !known[id] && !active) {
        section.hidden = true;
        section.classList.remove("is-active");
        section.style.display = "none";
      }
    });
    VIEWS.forEach(function (id) {
      var section = document.getElementById(id);
      if (!section) {
        return;
      }
      var active = id === viewId;
      section.hidden = !active;
      section.classList.toggle("is-active", active);
      if (active) {
        section.style.removeProperty("display");
      } else {
        section.style.display = "none";
      }
    });
    document.body.classList.toggle("aj-on-desk", viewId === "view-desk");
    document.body.classList.toggle("aj-off-desk", viewId !== "view-desk");
    setDrawer(false);
    if (isFieldMode()) {
      openStage(STATION_BY_VIEW[viewId] || "");
    }
  }

  function setDrawer(open) {
    document.body.classList.toggle("aj-drawer-open", !!open);
    if (menuOpen) {
      menuOpen.setAttribute("aria-expanded", open ? "true" : "false");
    }
    setHidden(backdrop, !open);
  }

  function parseHash() {
    var raw = String(window.location.hash || "").replace(/^#/, "");
    var parts = raw.split("?");
    var view = parts[0] || DEFAULT_VIEW;
    var query = {};
    if (parts[1]) {
      parts[1].split("&").forEach(function (pair) {
        var bits = pair.split("=");
        if (bits[0]) {
          query[decodeURIComponent(bits[0])] = decodeURIComponent(bits[1] || "");
        }
      });
    }
    if (view.indexOf("view-task-details") === 0) {
      view = "view-task-details";
    } else if (view.indexOf("view-plan-details") === 0) {
      view = "view-plan-details";
    } else if (view.indexOf("view-council-details") === 0) {
      view = "view-council-details";
    } else if (VIEWS.indexOf(view) < 0) {
      view = DEFAULT_VIEW;
    }
    return { view: view, query: query, raw: raw };
  }

  function currentHashView() {
    return parseHash().view;
  }

  function findTaskById(taskId) {
    var list = (tasksCache && tasksCache.tasks) || [];
    var needle = String(taskId == null ? "" : taskId);
    for (var i = 0; i < list.length; i += 1) {
      if (String(list[i].id) === needle) {
        return list[i];
      }
    }
    return null;
  }

  function canCompleteTask(task) {
    if (!task) {
      return false;
    }
    if (String(task.status || "").trim() === "مكتملة") {
      return false;
    }
    return /^\d+$/.test(String(task.id));
  }

  function setTaskCompleteButtonVisible(visible) {
    if (!detailCompleteBtn) {
      return;
    }
    detailCompleteBtn.hidden = !visible;
    if (!visible) {
      detailCompleteBtn.disabled = false;
    }
  }

  function paintTaskStatus(task) {
    var status = mapStatusTag(task && task.status);
    var priority = mapPriority(task && task.priority);
    if (detailStatusBadgeEl) {
      if (task) {
        detailStatusBadgeEl.hidden = false;
        detailStatusBadgeEl.className = "aj-tag " + status.cls;
        detailStatusBadgeEl.textContent = status.label;
      } else {
        detailStatusBadgeEl.hidden = true;
        detailStatusBadgeEl.textContent = "";
        detailStatusBadgeEl.className = "aj-tag";
      }
    }
    if (detailStatusLineEl) {
      detailStatusLineEl.textContent = task
        ? "الأولوية: " + priority.label
        : "";
    }
  }

  function showTaskDetails(taskId) {
    pendingDetailId = taskId;
    var task = findTaskById(taskId);
    setHidden(detailErrorEl, true);
    if (!task) {
      if (detailTitleEl) {
        detailTitleEl.textContent = "تفاصيل المهمة";
      }
      paintTaskStatus(null);
      if (detailDescEl) {
        detailDescEl.textContent = "";
      }
      setHidden(detailDateEl, true);
      setTaskCompleteButtonVisible(false);
      if (detailErrorEl) {
        detailErrorEl.hidden = false;
        detailErrorEl.textContent = "تعذر العثور على المهمة. عد إلى قائمة المهام وحاول مجددًا.";
      }
      return;
    }

    if (detailTitleEl) {
      detailTitleEl.textContent = task.title || "تفاصيل المهمة";
    }
    paintTaskStatus(task);
    if (detailDateEl) {
      detailDateEl.hidden = false;
      detailDateEl.textContent = "التاريخ: " + taskDateLabel(task);
    }
    if (detailDescEl) {
      detailDescEl.textContent =
        task.description && String(task.description).trim()
          ? String(task.description).trim()
          : "لا يوجد وصف محفوظ لهذه المهمة.";
    }
    setTaskCompleteButtonVisible(canCompleteTask(task));
    console.log("Task Details:", task);
    window.dispatchEvent(
      new CustomEvent("app:task:opened", {
        detail: { id: task.id, title: task.title || "" }
      })
    );
  }

  function normalizeTaskPriority(raw) {
    var value = String(raw || "").trim();
    if (value === "عاجل" || value === "عالية" || value === "high") {
      return "عاجل";
    }
    if (value === "منخفض" || value === "منخفضة" || value === "low") {
      return "منخفض";
    }
    return "عادي";
  }

  function normalizeEvidenceStatus(raw) {
    var value = String(raw || "").trim();
    if (value === "ناقص" || value === "مرفوع" || value === "غير مطلوب") {
      return value;
    }
    return "غير مطلوب";
  }

  function markTaskCompletedInCache(taskId) {
    var needle = String(taskId);
    if (!tasksCache || !Array.isArray(tasksCache.tasks)) {
      return;
    }
    tasksCache.tasks.forEach(function (item) {
      if (String(item.id) === needle) {
        item.status = "مكتملة";
      }
    });
    if (Array.isArray(tasksCache.today)) {
      tasksCache.today.forEach(function (item) {
        if (String(item.id) === needle) {
          item.status = "مكتملة";
        }
      });
    }
    if (Array.isArray(tasksCache.overdue)) {
      tasksCache.overdue.forEach(function (item) {
        if (String(item.id) === needle) {
          item.status = "مكتملة";
        }
      });
    }
  }

  function completeCurrentTask() {
    var task = findTaskById(pendingDetailId);
    if (!canCompleteTask(task) || taskCompleteInFlight) {
      return;
    }
    var taskId = Number(task.id);
    taskCompleteInFlight = true;
    if (detailCompleteBtn) {
      detailCompleteBtn.disabled = true;
    }
    fetch("/api/daily-tasks", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        id: taskId,
        title: task.title || "",
        description: task.description || "",
        owner_role: task.owner_role || "",
        status: "مكتملة",
        priority: normalizeTaskPriority(task.priority),
        evidence_status: normalizeEvidenceStatus(task.evidence_status),
        evidence_note: task.evidence_note || "",
        due_iso: task.due_iso || task.task_date || "",
        task_date: task.task_date || task.due_iso || "",
        hijri_date: task.hijri_date || "",
        source_ref: task.source_ref || "",
        is_overridden: true
      })
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(payload, "تعذر إنجاز المهمة."));
          }
          return payload;
        });
      })
      .then(function (payload) {
        console.log("Task Completed:", payload);
        markTaskCompletedInCache(taskId);
        if (payload && Array.isArray(payload.tasks)) {
          tasksCache = normalizeTasksPayload(payload);
          renderTasksBoard(tasksCache);
        } else if (tasksCache) {
          renderTasksBoard(tasksCache);
        }
        showTaskDetails(taskId);
        window.dispatchEvent(
          new CustomEvent("app:task:completed", {
            detail: { id: taskId }
          })
        );
        showToast("تم إنجاز المهمة بنجاح", "success");
      })
      .catch(function (error) {
        showToast(error.message || "تعذر إنجاز المهمة.", "error");
        if (detailCompleteBtn && canCompleteTask(findTaskById(pendingDetailId))) {
          detailCompleteBtn.disabled = false;
          detailCompleteBtn.hidden = false;
        }
      })
      .finally(function () {
        taskCompleteInFlight = false;
      });
  }

  function openTaskDetailsRoute(taskId) {
    window.location.hash = "view-task-details?id=" + encodeURIComponent(String(taskId));
  }

  function metricCard(label, scoreText, hint) {
    var li = document.createElement("li");
    li.className = "aj-card";
    var h2 = document.createElement("h2");
    h2.textContent = label || "مؤشر";
    var score = document.createElement("p");
    score.className = "aj-score";
    score.textContent = scoreText != null && scoreText !== "" ? String(scoreText) : "—";
    li.appendChild(h2);
    li.appendChild(score);
    if (hint) {
      var meta = document.createElement("p");
      meta.className = "aj-card-meta";
      meta.textContent = hint;
      li.appendChild(meta);
    }
    return li;
  }

  function formatScore(row) {
    if (!row || row.score == null) {
      return "—";
    }
    return row.score + (row.unit || "%");
  }

  function buildMetricCards(metrics) {
    if (!cardsEl) {
      return;
    }
    cardsEl.innerHTML = "";
    var ext = (metrics && metrics.external_evaluation) || {};
    var nafes = (metrics && metrics.nafes) || {};
    var rows = [
      { row: ext.overall, hint: ext.overall && ext.overall.level ? "المستوى: " + ext.overall.level : "" },
      { row: ext.administration, hint: ext.administration && ext.administration.level ? "المستوى: " + ext.administration.level : "" },
      { row: ext.teaching, hint: ext.teaching && ext.teaching.level ? "المستوى: " + ext.teaching.level : "" },
      { row: ext.outcomes, hint: ext.outcomes && ext.outcomes.level ? "المستوى: " + ext.outcomes.level : "" },
      { row: ext.environment, hint: ext.environment && ext.environment.level ? "المستوى: " + ext.environment.level : "" },
      { row: nafes.reading, hint: "" },
      { row: nafes.math, hint: "" },
      { row: nafes.science, hint: "" }
    ];
    rows.forEach(function (item) {
      if (!item.row) {
        return;
      }
      cardsEl.appendChild(metricCard(item.row.label || "مؤشر", formatScore(item.row), item.hint));
    });
  }

  function softGregorian(iso) {
    var date = new Date(String(iso || "") + "T12:00:00");
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    try {
      return date.toLocaleDateString("ar-EG-u-ca-gregory", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }) + "م";
    } catch (error) {
      return "";
    }
  }

  function oneEraMark(text, mark) {
    var value = String(text || "").trim();
    if (!value) {
      return "";
    }
    var repeated = new RegExp("(?:\\s*" + mark + ")+$");
    value = value.replace(repeated, "").trim();
    return value ? value + mark : "";
  }

  function softDateLine(iso) {
    var hijri = oneEraMark(formatCouncilHijri(iso), "هـ");
    var gregorian = oneEraMark(softGregorian(iso), "م");
    if (hijri && gregorian) {
      return hijri + " · " + gregorian;
    }
    return hijri || gregorian || String(iso || "");
  }

  function todayIso() {
    var now = new Date();
    var month = String(now.getMonth() + 1);
    var day = String(now.getDate());
    if (month.length < 2) {
      month = "0" + month;
    }
    if (day.length < 2) {
      day = "0" + day;
    }
    return now.getFullYear() + "-" + month + "-" + day;
  }

  function asSoftFollowPayload(payload) {
    if (payload && payload.follow && Array.isArray(payload.follow.rows)) {
      return payload;
    }
    if (payload && Array.isArray(payload.rows)) {
      return { follow: payload };
    }
    return null;
  }

  function saveSoftNote(row, note, button) {
    if (!row || button.disabled) {
      return;
    }
    button.disabled = true;
    setTextStatus(softStatusEl, "", false);
    fetch("/api/soft-periods/follow", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        day_iso: row.day_iso || "",
        slot_code: row.slot_code || "",
        note: note,
        status: row.status || "",
        evidence_status: row.evidence_status || "",
        evidence_note: row.evidence_note || ""
      })
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(payload, "تعذر حفظ الملاحظة."));
          }
          return payload;
        });
      })
      .then(function (payload) {
        var wrapped = asSoftFollowPayload(payload);
        if (!wrapped) {
          throw new Error("تعذر حفظ الملاحظة.");
        }
        renderSoftFollow(wrapped, row.day_iso || "");
        setTextStatus(softStatusEl, "تم حفظ الملاحظة.", false);
      })
      .catch(function (error) {
        button.disabled = false;
        setTextStatus(softStatusEl, (error && error.message) || "تعذر حفظ الملاحظة.", true);
      });
  }

  function uploadSoftEvidence(row, file, button) {
    if (!row || !file || button.disabled) {
      return;
    }
    button.disabled = true;
    setTextStatus(softStatusEl, "", false);
    var form = new FormData();
    form.append("entity_type", "soft_period");
    form.append("entity_key", (row.day_iso || "") + "|" + (row.slot_code || ""));
    form.append("register_key", "soft-periods");
    form.append("files", file, file.name || "evidence.bin");
    fetch("/api/visual-evidence", {
      method: "POST",
      headers: multipartAuthHeaders(),
      body: form
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(payload, "تعذر رفع الشاهد."));
          }
          return payload;
        });
      })
      .then(function (payload) {
        var wrapped = asSoftFollowPayload(payload);
        if (!wrapped) {
          throw new Error("تعذر رفع الشاهد.");
        }
        renderSoftFollow(wrapped, row.day_iso || "");
        window.dispatchEvent(
          new CustomEvent("app:evidence:attached", {
            detail: {
              entity_type: "soft_period",
              entity_key: (row.day_iso || "") + "|" + (row.slot_code || "")
            }
          })
        );
        setTextStatus(softStatusEl, "تم رفع الشاهد.", false);
      })
      .catch(function (error) {
        button.disabled = false;
        setTextStatus(softStatusEl, (error && error.message) || "تعذر رفع الشاهد.", true);
      });
  }

  function renderSoftFollow(payload, wantedDay) {
    var follow = payload && payload.follow ? payload.follow : {};
    var days = Array.isArray(follow.days) ? follow.days : [];
    var rows = Array.isArray(follow.rows) ? follow.rows : [];
    var known = days.map(function (day) {
      return day.day_iso;
    });
    var today = todayIso();
    var selected = wantedDay && known.indexOf(wantedDay) >= 0
      ? wantedDay
      : (known.indexOf(today) >= 0 ? today : (known[0] || ""));
    if (softDaysEl) {
      softDaysEl.innerHTML = "";
      days.forEach(function (day) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "aj-filter" + (day.day_iso === selected ? " is-active" : "");
        var name = document.createElement("span");
        name.textContent = day.weekday || "";
        var when = document.createElement("span");
        when.className = "aj-soft-date";
        when.textContent = softDateLine(day.day_iso);
        button.appendChild(name);
        button.appendChild(when);
        button.addEventListener("click", function () {
          window.location.hash = "view-soft-follow?day=" + encodeURIComponent(day.day_iso);
        });
        softDaysEl.appendChild(button);
      });
    }
    if (softMetaEl) {
      var week = follow.week_start ? softDateLine(follow.week_start) : "";
      var stats = follow.stats || {};
      softMetaEl.innerHTML = "";
      softMetaEl.dir = "rtl";
      var hasCount = typeof stats.done === "number" && typeof stats.total === "number";
      if (!week && !hasCount) {
        softMetaEl.hidden = true;
      } else {
        softMetaEl.hidden = false;
        if (week) {
          var weekText = document.createElement("span");
          weekText.textContent = "أسبوع " + week;
          softMetaEl.appendChild(weekText);
        }
        if (hasCount) {
          if (week) {
            softMetaEl.appendChild(document.createTextNode(" · "));
          }
          var countText = document.createElement("span");
          countText.appendChild(document.createTextNode("تم تنفيذ "));
          var doneText = document.createElement("bdi");
          doneText.dir = "ltr";
          doneText.textContent = String(stats.done);
          countText.appendChild(doneText);
          countText.appendChild(document.createTextNode(" من "));
          var totalText = document.createElement("bdi");
          totalText.dir = "ltr";
          totalText.textContent = String(stats.total);
          countText.appendChild(totalText);
          softMetaEl.appendChild(countText);
        }
      }
    }
    if (softCardsEl) {
      softCardsEl.innerHTML = "";
    }
    var dayRows = rows.filter(function (row) {
      return row && row.day_iso === selected;
    });
    setHidden(softEmptyEl, dayRows.length > 0);
    dayRows.forEach(function (row) {
      var li = document.createElement("li");
      li.className = "aj-card";
      var title = document.createElement("h2");
      title.textContent = row.title || "";
      li.appendChild(title);
      function line(text) {
        if (!text) {
          return;
        }
        var paragraph = document.createElement("p");
        paragraph.textContent = text;
        li.appendChild(paragraph);
      }
      if (row.minutes != null && row.minutes !== "") {
        line(String(row.minutes) + " دقيقة");
      }
      line(row.status || "");
      line(row.evidence_status || "");
      line(row.evidence_note || "");
      if (Array.isArray(row.evidence_images) && row.evidence_images.length) {
        line("الشواهد: " + row.evidence_images.length);
      }
      var noteLabel = document.createElement("label");
      noteLabel.className = "aj-soft-label";
      noteLabel.textContent = "ملاحظة";
      var noteInput = document.createElement("input");
      noteInput.type = "text";
      noteInput.className = "aj-soft-note";
      noteInput.value = row.note || "";
      noteLabel.appendChild(noteInput);
      li.appendChild(noteLabel);
      var actions = document.createElement("div");
      actions.className = "aj-soft-actions";
      var saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "aj-detail-btn";
      saveButton.textContent = "حفظ";
      saveButton.addEventListener("click", function () {
        saveSoftNote(row, noteInput.value, saveButton);
      });
      var fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.className = "aj-soft-file";
      fileInput.accept = "image/*,.pdf";
      var uploadButton = document.createElement("button");
      uploadButton.type = "button";
      uploadButton.className = "aj-detail-btn aj-detail-btn-secondary";
      uploadButton.textContent = "رفع شاهد";
      uploadButton.addEventListener("click", function () {
        fileInput.click();
      });
      fileInput.addEventListener("change", function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) {
          return;
        }
        uploadSoftEvidence(row, file, uploadButton);
      });
      actions.appendChild(saveButton);
      actions.appendChild(uploadButton);
      actions.appendChild(fileInput);
      li.appendChild(actions);
      if (softCardsEl) {
        softCardsEl.appendChild(li);
      }
    });
  }

  function loadSoftFollow() {
    var wanted = parseHash().query.day || "";
    setHidden(softLoadingEl, false);
    setTextStatus(softStatusEl, "", false);
    setHidden(softEmptyEl, true);
    fetch("/api/soft-periods", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok || !payload || !payload.follow) {
            throw new Error("soft");
          }
          return payload;
        });
      })
      .then(function (payload) {
        if (currentHashView() !== "view-soft-follow") {
          return;
        }
        setHidden(softLoadingEl, true);
        renderSoftFollow(payload, wanted);
      })
      .catch(function () {
        setHidden(softLoadingEl, true);
        if (softCardsEl) {
          softCardsEl.innerHTML = "";
        }
        if (softDaysEl) {
          softDaysEl.innerHTML = "";
        }
        setTextStatus(softStatusEl, "تعذر قراءة المتابعة اللاصفية.", true);
      });
  }

  function loadPerformanceMetrics() {
    if (ssotLoaded || ssotLoading || !cardsEl) {
      return;
    }
    ssotLoading = true;
    setHidden(loadingEl, false);
    setTextStatus(statusEl, "", false);
    setHidden(metaEl, true);
    cardsEl.innerHTML = "";

    fetchSsot()
      .then(function (payload) {
        if (!payload || !payload.data) {
          throw new Error("تعذر عرض مؤشرات الأداء حالياً.");
        }
        var metrics = payload.data;
        console.log("SSOT Data:", metrics);
        console.log("SSOT Source:", payload.source);
        var meta = (metrics && metrics.meta) || {};
        if (metaEl) {
          if (meta.updated) {
            metaEl.hidden = false;
            metaEl.textContent = "آخر تحديث: " + meta.updated;
          } else {
            metaEl.hidden = true;
            metaEl.textContent = "";
          }
        }
        buildMetricCards(metrics);
        ssotLoaded = true;
        setTextStatus(statusEl, "", false);
        window.dispatchEvent(
          new CustomEvent("app:performance:loaded", {
            detail: { source: payload.source, at: Date.now() }
          })
        );
      })
      .catch(function (error) {
        cardsEl.innerHTML = "";
        setTextStatus(statusEl, error.message || "تعذر عرض المؤشرات.", true);
      })
      .finally(function () {
        ssotLoading = false;
        setHidden(loadingEl, true);
      });
  }

  function loadNafesMetrics() {
    var loading = document.getElementById("aj-nafes-loading");
    var status = document.getElementById("aj-nafes-status");
    var host = document.getElementById("aj-nafes-cards");
    if (!host) {
      return;
    }
    setHidden(loading, false);
    setTextStatus(status, "", false);
    host.innerHTML = "";
    fetchSsot()
      .then(function (payload) {
        if (!payload || !payload.data) {
          throw new Error("تعذر عرض ملف نافس حالياً.");
        }
        var nafes = (payload.data && payload.data.nafes) || {};
        [
          { row: nafes.reading },
          { row: nafes.math },
          { row: nafes.science }
        ].forEach(function (item) {
          if (!item.row) {
            return;
          }
          host.appendChild(metricCard(item.row.label || "مؤشر نافس", formatScore(item.row), "نافس"));
        });
        if (!host.children.length) {
          setTextStatus(status, "لا توجد مؤشرات نافس محفوظة بعد.", false);
        } else {
          setTextStatus(status, "", false);
        }
      })
      .catch(function (error) {
        host.innerHTML = "";
        setTextStatus(status, (error && error.message) || "تعذر عرض نافس.", true);
      })
      .finally(function () {
        setHidden(loading, true);
      });
  }

  function loadTermSchedule() {
    var status = document.getElementById("aj-term-status");
    var summary = document.getElementById("aj-term-summary");
    var host = document.getElementById("aj-term-cards");
    if (!host) {
      return;
    }
    host.innerHTML = "";
    if (summary) {
      summary.textContent = "";
    }
    setTextStatus(status, "جارٍ التحميل...", false);
    fetch("/api/session/calendar", { headers: authHeaders(), cache: "no-store" })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            throw new Error((body && body.detail) || "تعذر قراءة التقويم المعتمد.");
          }
          return body;
        });
      })
      .then(function (cal) {
        var termCount = Number(cal.termCount || 2) || 2;
        var year = cal.year || "";
        var region = cal.region || "makkah";
        if (summary) {
          summary.textContent = "عدد الفصول: " + termCount + (year ? " · العام: " + year : "");
        }
        var qs =
          "/api/session/calendar/stations?year=" +
          encodeURIComponent(year) +
          "&region=" +
          encodeURIComponent(region);
        return fetch(qs, { headers: authHeaders(), cache: "no-store" })
          .then(function (res) {
            return res.json().then(function (body) {
              if (!res.ok) {
                throw new Error((body && body.detail) || "تعذر قراءة المحطات الزمنية.");
              }
              return body;
            });
          })
          .then(function (body) {
            var stations = body.items || [];
            stations.forEach(function (row, index) {
              var title = (row && row.title) || "محطة " + (index + 1);
              var meta = [row && row.hijriStart, row && row.gregorianStart, row && row.note]
                .filter(Boolean)
                .join(" · ");
              host.appendChild(metricCard(title, meta || "—", termCount === 2 ? "توزيع على فصلين" : ""));
            });
            if (!stations.length) {
              setTextStatus(status, "لا محطات زمنية محفوظة بعد. عدّل التقويم المعتمد أولاً.", false);
            } else {
              setTextStatus(status, "", false);
            }
          });
      })
      .catch(function (error) {
        setTextStatus(status, (error && error.message) || "تعذر تحميل التوزيع الزمني.", true);
      });
  }

  function taskDateLabel(item) {
    if (item.hijri_date) {
      return item.hijri_date;
    }
    if (item.due_iso) {
      return item.due_iso;
    }
    if (item.task_date) {
      return item.task_date;
    }
    return "—";
  }

  function mapPriority(raw) {
    var value = String(raw || "").trim();
    if (value === "عاجل" || value === "عالية" || value === "high") {
      return { label: "عالية", cls: "is-high" };
    }
    if (value === "منخفض" || value === "منخفضة" || value === "low") {
      return { label: "منخفضة", cls: "is-low" };
    }
    return { label: "متوسطة", cls: "is-medium" };
  }

  function mapStatusTag(raw) {
    var value = String(raw || "").trim();
    if (value === "مكتملة") {
      return { label: "مكتملة", cls: "is-done" };
    }
    if (value === "قيد التنفيذ") {
      return { label: "قيد التنفيذ", cls: "is-progress" };
    }
    return { label: "جديدة", cls: "is-new" };
  }

  function isMineTask(item) {
    if (item.mine === true) {
      return true;
    }
    var role = String(item.owner_role || "").toLowerCase();
    return (
      role.indexOf("principal") >= 0 ||
      role.indexOf("مدير") >= 0 ||
      role.indexOf("system") >= 0 ||
      role.indexOf("مسؤول") >= 0
    );
  }

  function isOverdueTask(item) {
    return item.bucket === "متأخرة" || item.overdue === true;
  }

  function normalizeTasksPayload(payload) {
    var source = (payload && payload.tasks) || [];
    var tasks = source.map(function (item) {
      var next = Object.assign({}, item);
      if (!next.priority) {
        next.priority = "عادي";
      }
      if (!next.status) {
        next.status = "مستحقة";
      }
      if (typeof next.mine !== "boolean") {
        next.mine = isMineTask(next);
      }
      return next;
    });
    return Object.assign({}, payload || {}, {
      tasks: tasks,
      today: tasks.filter(function (item) {
        return item.bucket === "اليوم" || !item.bucket;
      }),
      overdue: tasks.filter(isOverdueTask)
    });
  }

  function filteredTasks(payload) {
    var list = (payload && payload.tasks) || [];
    if (tasksFilter === "mine") {
      return list.filter(isMineTask);
    }
    if (tasksFilter === "overdue") {
      return list.filter(isOverdueTask);
    }
    return list.slice();
  }

  function renderTasksSummary(payload) {
    if (!tasksSummaryEl) {
      return;
    }
    var list = (payload && payload.tasks) || [];
    var overdue = list.filter(isOverdueTask).length;
    var done = list.filter(function (item) {
      return String(item.status || "") === "مكتملة";
    }).length;
    var open = list.length - done;
    tasksSummaryEl.hidden = false;
    tasksSummaryEl.textContent =
      "لديك " + overdue + " مهام متأخرة، و" + done + " مهام مكتملة" +
      (open > 0 ? "، و" + open + " قيد المتابعة." : ".");
  }

  function buildTaskCards(payload) {
    if (!tasksCardsEl) {
      return;
    }
    tasksCardsEl.innerHTML = "";
    var list = filteredTasks(payload);
    if (!list.length) {
      setHidden(tasksEmptyEl, false);
      return;
    }
    setHidden(tasksEmptyEl, true);
    list.forEach(function (item) {
      var priority = mapPriority(item.priority);
      var status = mapStatusTag(item.status);
      var li = document.createElement("li");
      li.className = "aj-card aj-task-card";

      var head = document.createElement("div");
      head.className = "aj-task-head";
      var h2 = document.createElement("h2");
      h2.textContent = item.title || "مهمة";
      var badge = document.createElement("span");
      badge.className = "aj-badge " + priority.cls;
      badge.textContent = priority.label;
      head.appendChild(h2);
      head.appendChild(badge);

      var tag = document.createElement("span");
      tag.className = "aj-tag " + status.cls;
      tag.textContent = status.label;

      var date = document.createElement("p");
      date.className = "aj-card-meta";
      date.textContent = "التاريخ: " + taskDateLabel(item);

      var actions = document.createElement("div");
      actions.className = "aj-task-actions";
      var openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "aj-open-task";
      openBtn.textContent = "فتح المهمة";
      openBtn.addEventListener("click", function () {
        openTaskDetailsRoute(item.id);
      });
      actions.appendChild(openBtn);

      li.appendChild(head);
      li.appendChild(tag);
      li.appendChild(date);
      li.appendChild(actions);
      tasksCardsEl.appendChild(li);
    });
  }

  function renderTasksBoard(payload) {
    tasksCache = payload;
    renderTasksSummary(payload);
    buildTaskCards(payload);
  }

  function loadTodayTasks(options) {
    options = options || {};
    if (options.force) {
      tasksLoaded = false;
      tasksCache = null;
    }
    if (tasksLoading || !tasksCardsEl) {
      return Promise.resolve(tasksCache);
    }
    if (tasksLoaded && tasksCache) {
      if (!options.silentBoard) {
        renderTasksBoard(tasksCache);
      }
      return Promise.resolve(tasksCache);
    }
    tasksLoading = true;
    setHidden(tasksLoadingEl, false);
    setTextStatus(tasksStatusEl, "", false);
    setHidden(tasksEmptyEl, true);
    setHidden(tasksMetaEl, true);
    setHidden(tasksSummaryEl, true);
    if (!options.silentBoard) {
      tasksCardsEl.innerHTML = "";
    }

    return softFetch("/api/daily-tasks")
      .then(function (payload) {
        if (!payload) {
          throw new Error("تعذر عرض مهام اليوم حالياً.");
        }
        console.log("Task Data:", payload);
        var normalized = normalizeTasksPayload(payload);
        if (tasksMetaEl && normalized.date) {
          tasksMetaEl.hidden = false;
          tasksMetaEl.textContent = "اليوم: " + normalized.date;
        }
        if (!options.silentBoard) {
          renderTasksBoard(normalized);
        } else {
          tasksCache = normalized;
        }
        tasksLoaded = true;
        setTextStatus(tasksStatusEl, "", false);
        window.dispatchEvent(
          new CustomEvent("app:tasks:today-loaded", {
            detail: { source: "/api/daily-tasks", at: Date.now() }
          })
        );
        return normalized;
      })
      .catch(function (error) {
        if (!options.silentBoard) {
          tasksCardsEl.innerHTML = "";
          setHidden(tasksEmptyEl, true);
          setHidden(tasksSummaryEl, true);
          setTextStatus(tasksStatusEl, error.message || "تعذر عرض المهام.", true);
        }
        throw error;
      })
      .finally(function () {
        tasksLoading = false;
        setHidden(tasksLoadingEl, true);
      });
  }

  if (tasksFiltersEl) {
    tasksFiltersEl.addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest("[data-aj-filter]") : null;
      if (!button) {
        return;
      }
      tasksFilter = button.getAttribute("data-aj-filter") || "all";
      tasksFiltersEl.querySelectorAll("[data-aj-filter]").forEach(function (node) {
        node.classList.toggle("is-active", node === button);
      });
      if (tasksCache) {
        buildTaskCards(tasksCache);
      }
    });
  }

  function markCurrent(selector, active) {
    document.querySelectorAll(selector).forEach(function (link) {
      if (link.classList.contains("aj-back-btn")) {
        return;
      }
      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function syncChrome(viewId) {
    var isHome = viewId === "view-home" || viewId === "view-desk";
    var stationId = STATION_BY_VIEW[viewId] || "";
    syncAdaptiveMode();
    if (topbarTitle) {
      topbarTitle.textContent = VIEW_TITLES[viewId] || "رحلة المدير";
    }
    if (backBtn) {
      backBtn.hidden = isHome;
      if (viewId === "view-task-details") {
        backBtn.setAttribute("href", "#view-tasks");
        backBtn.textContent = "رجوع";
      } else if (viewId === "view-tasks") {
        backBtn.setAttribute("href", "#view-desk");
        backBtn.textContent = "مكتبي";
      } else if (viewId === "view-plan-details") {
        backBtn.setAttribute("href", "#view-planning");
        backBtn.textContent = "العودة";
      } else if (viewId === "view-council-details") {
        backBtn.setAttribute("href", "#view-execution");
        backBtn.textContent = "رجوع";
      } else if (stationId) {
        backBtn.setAttribute("href", "#view-station-" + stationId);
        backBtn.textContent = "المحطة";
      } else {
        backBtn.setAttribute("href", "#view-home");
        backBtn.textContent = "رجوع";
      }
    }
    markCurrent('a[href="#view-home"]', viewId === "view-home");
    markCurrent('a[href="#view-desk"]', viewId === "view-desk");
    markCurrent('a[href="#view-station-foundation"]', viewId === "view-station-foundation" || stationId === "foundation");
    markCurrent('a[href="#view-station-planning"]', viewId === "view-station-planning" || stationId === "planning");
    markCurrent('a[href="#view-station-registers"]', viewId === "view-station-registers" || stationId === "registers");
    markCurrent('a[href="#view-station-measurement"]', viewId === "view-station-measurement" || stationId === "measurement");
    markCurrent('a[href="#view-performance"]', viewId === "view-performance");
    markCurrent('a[href="#view-nafes"]', viewId === "view-nafes");
    markCurrent('a[href="#view-soft-follow"]', viewId === "view-soft-follow");
    markCurrent('a[href="#view-external-eval"]', viewId === "view-external-eval");
    markCurrent('a[href="#view-tasks"]', viewId === "view-tasks" || viewId === "view-task-details");
    markCurrent(
      'a[href="#view-planning"]',
      viewId === "view-planning" || viewId === "view-plan-details"
    );
    markCurrent('a[href="#view-smart-planning"]', viewId === "view-smart-planning");
    markCurrent('a[href="#view-program-add"]', viewId === "view-program-add");
    markCurrent('a[href="#view-term-schedule"]', viewId === "view-term-schedule");
    markCurrent('a[href="#view-staff"]', viewId === "view-staff");
    markCurrent('a[href="#view-school"]', viewId === "view-school");
    markCurrent('a[href="#view-leadership"]', viewId === "view-leadership");
    markCurrent('a[href="#view-committees"]', viewId === "view-committees");
    markCurrent('a[href="#view-deliverables"]', viewId === "view-deliverables");
    markCurrent('a[href="#view-calendar-hub"]', viewId === "view-calendar-hub" || viewId === "view-calendar" || viewId === "view-occasions");
    markCurrent('a[href="#view-calendar"]', viewId === "view-calendar");
    markCurrent('a[href="#view-occasions"]', viewId === "view-occasions");
    markCurrent('a[href="#view-letterhead"]', viewId === "view-letterhead");
    markCurrent('a[href="#view-system-care"]', viewId === "view-system-care" || viewId === "view-backup" || viewId === "view-audit" || viewId === "view-health" || viewId === "view-trash");
    markCurrent('a[href="#view-backup"]', viewId === "view-backup");
    markCurrent('a[href="#view-access-hub"]', viewId === "view-access-hub" || viewId === "view-accounts" || viewId === "view-permissions");
    markCurrent('a[href="#view-noor-import"]', viewId === "view-noor-import" || viewId === "view-import-center");
    markCurrent('a[href="#view-import-center"]', viewId === "view-import-center" || viewId === "view-noor-import");
    markCurrent('a[href="#view-accounts"]', viewId === "view-accounts");
    markCurrent('a[href="#view-permissions"]', viewId === "view-permissions");
    markCurrent('a[href="#view-trash"]', viewId === "view-trash");
    markCurrent('a[href="#view-audit"]', viewId === "view-audit");
    markCurrent('a[href="#view-health"]', viewId === "view-health");
    markCurrent('a[href="#view-students-lists"]', viewId === "view-students-lists" || viewId === "view-student-registry");
    markCurrent(
      'a[href="#view-execution"]',
      viewId === "view-execution" || viewId === "view-council-details"
    );
    markCurrent('a[href="#view-visits"]', viewId === "view-visits");
    markCurrent('a[href="#view-visits-plan"]', viewId === "view-visits-plan");
    markCurrent('a[href="#view-evidence"]', viewId === "view-evidence");
    markCurrent('a[href="#view-env-evidence"]', viewId === "view-env-evidence");
    markCurrent('a[href="#view-license-form"]', viewId === "view-license-form");
    markCurrent('a[href="#view-practice-evidence"]', viewId === "view-practice-evidence");
    markCurrent('a[href="#view-profile"]', viewId === "view-profile");
    markCurrent('a[href="#view-portfolio"]', viewId === "view-portfolio");
    markCurrent('.aj-bottom-nav a[href="#view-desk"]', viewId === "view-desk");
    document.querySelectorAll(".aj-bottom-nav a[data-aj-station]").forEach(function (link) {
      var linkStation = link.getAttribute("data-aj-station") || "";
      if (stationId && linkStation === stationId) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    if (!isFieldMode() && stationId) {
      openStage(stationId);
    } else if (!isFieldMode()) {
      openStage("");
    }
  }

  function routeCachedDetail(entityId, cache, showFn, loadFn) {
    if (!entityId) {
      showFn(null);
      return;
    }
    if (cache) {
      showFn(entityId);
      return;
    }
    loadFn({ silentBoard: true })
      .then(function () {
        showFn(entityId);
      })
      .catch(function () {
        showFn(null);
      });
  }

  function isPrincipalUser() {
    return currentUser && String(currentUser.role || "").indexOf("مدير") === 0;
  }

  function opinionScreen() {
    var active = document.querySelector(".aj-view:not([hidden]) h1");
    var title = active ? String(active.textContent || "").trim() : "";
    return title || "مكتب العمل";
  }

  function renderStaffOpinions(payload) {
    var title = document.getElementById("aj-opinion-list-title");
    var list = document.getElementById("aj-opinion-list");
    if (!title || !list) {
      return;
    }
    var items = payload && payload.items ? payload.items : [];
    title.hidden = false;
    title.textContent = payload && payload.scope === "all" ? "آراء المنسوبين" : "آراؤك المرسلة";
    list.hidden = false;
    list.innerHTML = "";
    if (!items.length) {
      var empty = document.createElement("li");
      empty.textContent = "لا آراء محفوظة بعد.";
      list.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var row = document.createElement("li");
      var meta = document.createElement("span");
      meta.textContent = [item.author_name, item.screen, item.created_at].filter(Boolean).join(" · ");
      row.appendChild(meta);
      row.appendChild(document.createTextNode(item.text || ""));
      list.appendChild(row);
    });
  }

  function loadStaffOpinions() {
    var status = document.getElementById("aj-opinion-status");
    fetch("/api/session/opinions", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر قراءة الآراء"));
          }
          return body;
        });
      })
      .then(renderStaffOpinions)
      .catch(function (error) {
        if (status) {
          status.textContent = (error && error.message) || "تعذر قراءة الآراء";
        }
      });
  }

  function sendStaffOpinion() {
    var field = document.getElementById("aj-opinion-text");
    var status = document.getElementById("aj-opinion-status");
    var text = field ? String(field.value || "").trim() : "";
    if (text.length < 2) {
      if (status) {
        status.textContent = "اكتب الرأي أولاً.";
      }
      return;
    }
    if (status) {
      status.textContent = "جارٍ إرسال الرأي...";
    }
    fetch("/api/session/opinions", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ text: text, screen: opinionScreen() })
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error(apiErrorMessage(body, "تعذر إرسال الرأي"));
        }
        return body;
      });
    }).then(function () {
      if (field) {
        field.value = "";
      }
      if (status) {
        status.textContent = "حُفظ رأيك دون تعديل السجل الأصلي.";
      }
      loadStaffOpinions();
    }).catch(function (error) {
      if (status) {
        status.textContent = (error && error.message) || "تعذر إرسال الرأي";
      }
    });
  }

  function loadTrash() {
    var status = document.getElementById("aj-trash-status");
    var host = document.getElementById("aj-trash-list");
    if (!host) {
      return;
    }
    if (!isPrincipalUser()) {
      if (status) {
        status.textContent = "هذه الشاشة للمدير فقط.";
      }
      host.innerHTML = "";
      return;
    }
    if (status) {
      status.textContent = "";
    }
    fetch("/api/session/trash", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("تعذر قراءة السلة");
        }
        return response.json();
      })
      .then(function (body) {
        var items = body && body.items ? body.items : [];
        if (!items.length) {
          host.innerHTML = "<li>لا صفوف مخفية.</li>";
          return;
        }
        host.innerHTML = "";
        items.forEach(function (item) {
          var row = document.createElement("li");
          var label = document.createElement("span");
          label.textContent = (item.table_label || "") + " — " + (item.label || "");
          var button = document.createElement("button");
          button.type = "button";
          button.className = "aj-detail-btn";
          button.textContent = "استعادة";
          button.addEventListener("click", function () {
            fetch("/api/session/trash/restore", {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({ table: item.table, record_id: item.record_id })
            }).then(function (response) {
              if (!response.ok) {
                throw new Error("تعذرت الاستعادة");
              }
              showToast("تمت الاستعادة", "success");
              loadTrash();
            }).catch(function (error) {
              if (status) {
                status.textContent = error.message || "تعذرت الاستعادة";
              }
            });
          });
          row.appendChild(label);
          row.appendChild(button);
          host.appendChild(row);
        });
      })
      .catch(function (error) {
        if (status) {
          status.textContent = error.message || "تعذر قراءة السلة";
        }
      });
  }

  function loadAudit() {
    var status = document.getElementById("aj-audit-status");
    var host = document.getElementById("aj-audit-list");
    if (!host) {
      return;
    }
    if (!isPrincipalUser()) {
      if (status) {
        status.textContent = "هذه الشاشة للمدير فقط.";
      }
      host.innerHTML = "";
      return;
    }
    if (status) {
      status.textContent = "";
    }
    fetch("/api/session/audit-logs", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        if (response.status === 403) {
          throw new Error("هذه الشاشة للمدير فقط.");
        }
        if (!response.ok) {
          throw new Error("تعذر قراءة السجل");
        }
        return response.json();
      })
      .then(function (body) {
        var items = body && body.items ? body.items : [];
        if (!items.length) {
          host.innerHTML = "<li>لا سجلات بعد.</li>";
          return;
        }
        host.innerHTML = "";
        items.forEach(function (item) {
          var row = document.createElement("li");
          row.textContent = [item.timestamp, item.user_name, item.action, item.table_name, item.detail]
            .filter(function (part) { return part; })
            .join(" — ");
          host.appendChild(row);
        });
      })
      .catch(function (error) {
        if (status) {
          status.textContent = error.message || "تعذر قراءة السجل";
        }
      });
  }

  function paintHealthRow(host, name, ok, detail) {
    var row = document.createElement("li");
    row.textContent = (ok ? "نجاح" : "فشل") + " — " + name + " — " + detail;
    row.className = ok ? "aj-status is-ok" : "aj-status is-error";
    host.appendChild(row);
  }

  function loadHealth() {
    var status = document.getElementById("aj-health-status");
    var host = document.getElementById("aj-health-list");
    if (!host) {
      return;
    }
    host.innerHTML = "";
    if (!isPrincipalUser()) {
      if (status) {
        status.textContent = "هذه الشاشة للمدير فقط.";
      }
      return;
    }
    if (status) {
      status.textContent = "جارٍ الفحص...";
    }
    var dataReady = fetch("/api/session/health", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error((body && body.detail) || "تعذر فحص القاعدة");
          }
          return body;
        });
      });
    var linksReady = window.ConsistencyCore && typeof window.ConsistencyCore.check === "function"
      ? window.ConsistencyCore.check().catch(function () { return null; })
      : Promise.resolve(null);
    var plansReady = window.PlanningCore && typeof window.PlanningCore.load === "function"
      ? window.PlanningCore.load({ headers: authHeaders() }).catch(function () { return []; })
      : Promise.resolve([]);
    Promise.all([dataReady, linksReady, plansReady]).then(function (parts) {
      var report = parts[0] || { checks: [] };
      var links = parts[1];
      var plans = parts[2] || [];
      var byName = {};
      (report.checks || []).forEach(function (item) {
        byName[item.name] = item;
      });
      function rowOf(name) {
        return byName[name] || { ok: false, detail: "غير مفحوص" };
      }
      var students = rowOf("الطلاب");
      var printRow = rowOf("قالب الطباعة");
      var signs = rowOf("التوقيعات");
      var plansRow = rowOf("بنك الخطط");
      paintHealthRow(host, "قاعدة البيانات", !!students.ok, students.ok ? "متصلة (" + students.detail + " طالباً)" : students.detail);
      paintHealthRow(host, "محرك الطباعة", !!printRow.ok, printRow.ok ? "يعمل (A4 مضبوط)" : printRow.detail);
      paintHealthRow(host, "التوقيعات", !!signs.ok, signs.detail);
      paintHealthRow(host, "بنك الخطط", !!plansRow.ok, plansRow.detail);
      if (links) {
        paintHealthRow(host, "التوافقية", !!links.ok, links.ok ? "لا أخطاء" : String(links.count || 0) + " ملاحظة");
      } else {
        paintHealthRow(host, "التوافقية", false, "تعذر فحص الاتساق");
      }
      ["تطابق سجل الطلاب", "المنسوبون", "حصص نافس", "طلاب بلا صف", "منسوبون بلا صفة"].forEach(function (name) {
        var item = rowOf(name);
        paintHealthRow(host, name, !!item.ok, item.detail || "");
      });
      var indicator = window.PlanningCore && typeof window.PlanningCore.getIndicator === "function"
        ? window.PlanningCore.getIndicator("2-1-1-2")
        : null;
      var procedureCount = indicator && indicator.procedures ? indicator.procedures.length : 0;
      var license = window.PlanningCore && typeof window.PlanningCore.getIndicator === "function"
        ? window.PlanningCore.getIndicator("1-4-1-1")
        : null;
      var licenseRows = window.PlanningCore && typeof window.PlanningCore.matches === "function"
        ? window.PlanningCore.matches("1-4-1-1")
        : [];
      var kept = license && String(license.title || "").indexOf("الرخصة المهنية") >= 0 && licenseRows.length === 2;
      paintHealthRow(host, "واجهة بنك الخطط", plans.length === 56 && procedureCount === 26 && kept, plans.length + " صفًا / 1-4-1-1 بلا إسقاط / 2-1-1-2 = " + procedureCount);
      var narrative = window.NarrativeCore && typeof window.NarrativeCore.generateText === "function"
        ? window.NarrativeCore.generateText("program.objective", {
          program_name: indicator && indicator.title ? indicator.title : "",
          domain: indicator && indicator.domain ? indicator.domain : ""
        })
        : "";
      paintHealthRow(host, "النص التربوي", !!narrative, narrative ? "ظهر نص البرنامج" : "النص فارغ");
      if (status) {
        var failed = host.querySelectorAll(".is-error").length;
        status.textContent = failed ? "الفحص فيه " + failed + " فشلاً" : "الفحص مكتمل بلا فشل ظاهر";
      }
    }).catch(function (error) {
      if (status) {
        status.textContent = (error && error.message) || "تعذر الفحص";
      }
    });
  }

  function router() {
    if (!document.body.classList.contains("aj-auth-ready")) {
      return;
    }
    var parsed = parseHash();
    var viewId = parsed.view;
    if (viewId === "view-noor-import") {
      window.location.replace("#view-import-center");
      return;
    }
    if (!window.location.hash || window.location.hash === "#") {
      window.location.replace("#view-desk");
      return;
    }

    isolateViews(viewId);

    if (window.AjCommittees && typeof window.AjCommittees.shouldRedirect === "function" && window.AjCommittees.shouldRedirect(viewId)) {
      window.location.replace("#view-committees");
      return;
    }

    syncChrome(viewId);

    if (viewId === "view-desk") {
      if (window.AjDesk && typeof window.AjDesk.load === "function") {
        window.AjDesk.load();
      }
      loadStaffOpinions();
      return;
    }
    if (viewId === "view-visits") {
      if (!canFillLicenseForm()) {
        showToast("هذا النموذج للمدير والوكيل.", "error");
        window.location.replace("#view-desk");
        return;
      }
      if (window.AjVisits && typeof window.AjVisits.load === "function") {
        window.AjVisits.load();
      }
      return;
    }
    if (viewId === "view-visits-plan") {
      if (!canFillLicenseForm()) {
        showToast("هذه الخطة للمدير والوكيل.", "error");
        window.location.replace("#view-desk");
        return;
      }
      if (window.AjVisitPlan && typeof window.AjVisitPlan.load === "function") {
        window.AjVisitPlan.load();
      }
      return;
    }
    if (viewId === "view-license-form") {
      if (!canFillLicenseForm()) {
        showToast("تعبئة هذا النموذج للمدير والوكيل.", "error");
        window.location.replace("#view-desk");
        return;
      }
      loadLicenseRows();
      loadWitnessFiles();
      return;
    }
    if (viewId === "view-practice-evidence") {
      if (!canFillLicenseForm()) {
        showToast("شواهد الممارسات للمدير والوكيل.", "error");
        window.location.replace("#view-desk");
        return;
      }
      loadPracticeEvidence();
      return;
    }
    if (viewId === "view-committees") {
      if (window.AjCommittees && typeof window.AjCommittees.load === "function") {
        window.AjCommittees.load();
      }
      return;
    }

    if (viewId === "view-performance") {
      loadPerformanceMetrics();
      return;
    }
    if (viewId === "view-nafes") {
      loadNafesMetrics();
      return;
    }
    if (viewId === "view-term-schedule") {
      loadTermSchedule();
      return;
    }
    if (viewId === "view-system-care") {
      if (currentUser) {
        document.querySelectorAll("#view-system-care .aj-principal-only").forEach(function (node) {
          node.hidden = String(currentUser.role || "").indexOf("مدير") !== 0;
        });
      }
      return;
    }
    if (viewId === "view-soft-follow") {
      loadSoftFollow();
      return;
    }
    if (viewId === "view-tasks") {
      loadTodayTasks();
      return;
    }
    if (viewId === "view-planning") {
      loadPlanning();
      return;
    }
    if (viewId === "view-smart-planning") {
      loadSmartPlanning();
      return;
    }
    if (viewId === "view-program-add") {
      var editId = parsed.query && parsed.query.id ? String(parsed.query.id) : "";
      loadProgramForm().then(function () {
        if (editId) {
          beginProgramEdit(editId);
        } else if (editingProgramId) {
          setProgramFormMode(0);
          if (programFormEl) {
            programFormEl.reset();
          }
          clearProgramBank();
        }
      });
      return;
    }
    if (viewId === "view-staff") {
      loadStaff();
      return;
    }
    if (viewId === "view-school") {
      loadSchoolSettings();
      return;
    }
    if (viewId === "view-trash") {
      loadTrash();
      return;
    }
    if (viewId === "view-audit") {
      loadAudit();
      return;
    }
    if (viewId === "view-health") {
      loadHealth();
      return;
    }
    if (viewId === "view-external-eval") {
      if (window.AjExternalEval && typeof window.AjExternalEval.load === "function") {
        window.AjExternalEval.load();
      }
      return;
    }
    if (viewId === "view-leadership") {
      loadLeadership();
      return;
    }
    if (viewId === "view-deliverables") {
      loadDeliverables();
      return;
    }
    if (viewId === "view-students-lists") {
      if (window.AjStudentsLists && typeof window.AjStudentsLists.load === "function") {
        window.AjStudentsLists.load();
      }
      return;
    }
    if (viewId === "view-student-registry") {
      if (window.AjStudentRegistry && typeof window.AjStudentRegistry.load === "function") {
        window.AjStudentRegistry.load();
      }
      return;
    }
    if (viewId === "view-import-center") {
      if (window.AjImportCenter && typeof window.AjImportCenter.load === "function") {
        window.AjImportCenter.load();
      }
      return;
    }
    if (window.AJPlanning && typeof window.AJPlanning.load === "function") {
      if (window.AJPlanning.load(viewId)) {
        return;
      }
    }
    if (viewId === "view-execution") {
      loadCouncils();
      return;
    }
    if (viewId === "view-evidence") {
      loadEvidence();
      return;
    }
    if (viewId === "view-env-evidence") {
      if (window.AjEnvEvidence && typeof window.AjEnvEvidence.load === "function") {
        window.AjEnvEvidence.load();
      }
      return;
    }
    if (viewId === "view-profile") {
      renderProfileView();
      return;
    }
    if (viewId === "view-portfolio") {
      loadPortfolio();
      return;
    }
    if (viewId === "view-task-details") {
      routeCachedDetail(
        parsed.query.id || pendingDetailId,
        tasksCache,
        showTaskDetails,
        loadTodayTasks
      );
      return;
    }
    if (viewId === "view-plan-details") {
      var planRouteId = String(parsed.query.id || pendingPlanDetailId || "");
      if (planRouteId === "operational-plan") {
        window.location.replace("#view-planning");
        return;
      }
      routeCachedDetail(
        parsed.query.id || pendingPlanDetailId,
        planningCache,
        showPlanDetails,
        loadPlanning
      );
      return;
    }
    if (viewId === "view-council-details") {
      routeCachedDetail(
        parsed.query.id || pendingCouncilDetailId,
        councilsCache,
        showCouncilDetails,
        loadCouncils
      );
    }
  }

  if (detailCompleteBtn) {
    detailCompleteBtn.addEventListener("click", function () {
      completeCurrentTask();
    });
  }
  if (detailEvidenceBtn) {
    detailEvidenceBtn.addEventListener("click", function () {
      window.location.hash = "view-evidence";
    });
  }
  if (detailPrintBtn) {
    detailPrintBtn.addEventListener("click", function () {
      printTaskDetail();
    });
  }
  var opinionSaveBtn = document.getElementById("aj-opinion-save");
  if (opinionSaveBtn) {
    opinionSaveBtn.addEventListener("click", sendStaffOpinion);
  }
  if (planApproveBtn) {
    planApproveBtn.addEventListener("click", function () {
      approveCurrentProgram();
    });
  }
  if (planEditBtn) {
    planEditBtn.addEventListener("click", function () {
      openProgramEditor();
    });
  }
  if (planPrintBtn) {
    planPrintBtn.addEventListener("click", function () {
      if (String(pendingPlanDetailId) === "operational-plan" && window.Plan111 && typeof window.Plan111.open === "function") {
        window.Plan111.open().catch(function (error) {
          showToast((error && error.message) || "تعذر تجهيز حزمة الخطة.", "error");
        });
        return;
      }
      printCurrentProgramCard(false);
    });
  }
  if (planPrint122Btn) {
    planPrint122Btn.addEventListener("click", function () {
      if (!window.Plan122 || typeof window.Plan122.open !== "function") {
        showToast("نموذج قيم المهنة غير محمّل.", "error");
        return;
      }
      window.Plan122.open().catch(function (error) {
        showToast((error && error.message) || "تعذر تجهيز حزمة قيم المهنة.", "error");
      });
    });
  }
  if (planPrint131Btn) {
    planPrint131Btn.addEventListener("click", function () {
      if (!window.Plan131 || typeof window.Plan131.open !== "function") {
        showToast("نموذج العلاقات غير محمّل.", "error");
        return;
      }
      window.Plan131.open().catch(function (error) {
        showToast((error && error.message) || "تعذر تجهيز حزمة العلاقات.", "error");
      });
    });
  }
  if (planWitness131Btn) {
    planWitness131Btn.addEventListener("click", function () {
      if (!window.Plan131 || typeof window.Plan131.openWitness !== "function") {
        showToast("شاهد العلاقات غير محمّل.", "error");
        return;
      }
      window.Plan131.openWitness().catch(function (error) {
        showToast((error && error.message) || "تعذر فتح شاهد العلاقات.", "error");
      });
    });
  }
  if (planPrint141Btn) {
    planPrint141Btn.addEventListener("click", function () {
      if (!window.Plan141 || typeof window.Plan141.open !== "function") {
        showToast("نموذج الكادر التعليمي غير محمّل.", "error");
        return;
      }
      window.Plan141.open().catch(function (error) {
        showToast((error && error.message) || "تعذر تجهيز حزمة الكادر التعليمي.", "error");
      });
    });
  }
  if (planWitness141Btn) {
    planWitness141Btn.addEventListener("click", function () {
      if (!window.Plan141 || typeof window.Plan141.openWitness !== "function") {
        showToast("شاهد الكادر غير محمّل.", "error");
        return;
      }
      window.Plan141.openWitness().catch(function (error) {
        showToast((error && error.message) || "تعذر فتح شاهد الكادر.", "error");
      });
    });
  }
  function witnessLabel(value) {
    return String(value || "").replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[ch];
    });
  }
  function renderWitnessFiles(items) {
    var lists = [witnessFilesList, document.getElementById("aj-license-files-list")];
    var list = Array.isArray(items) ? items : [];
    var html = list.length ? list.map(function (item) {
      var turn = item.kind === "image"
        ? "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary\" data-witness-turn=\"" + item.id + "\" data-witness-slot=\"" + witnessLabel(item.slot || "") + "\">تدوير</button>"
        : "";
      return "<li><span>" + witnessLabel(item.original_name) + "</span>"
        + turn
        + "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary\" data-witness-delete=\"" + item.id + "\">حذف</button></li>";
    }).join("") : "<li class=\"aj-meta\">لا مرفقات بعد.</li>";
    lists.forEach(function (node) {
      if (node) {
        node.innerHTML = html;
      }
    });
  }
  function loadWitnessFiles() {
    if (!witnessFilesList) {
      return;
    }
    fetch("/api/session/witness-files", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر قراءة المرفقات."));
          }
          renderWitnessFiles(body.items || []);
        });
      })
      .catch(function () {
        renderWitnessFiles([]);
      });
  }
  function uploadWitnessFile(file, slot) {
    var data = new FormData();
    data.append("file", file);
    if (slot) {
      data.append("slot", slot);
    }
    fetch("/api/session/witness-files", {
      method: "POST",
      headers: multipartAuthHeaders(),
      body: data
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error(apiErrorMessage(body, "تعذر رفع الملف."));
        }
        showToast("تم رفع المرفق.", "success");
        loadWitnessFiles();
        loadPracticeEvidence();
      });
    }).catch(function (error) {
      showToast((error && error.message) || "تعذر رفع الملف.", "error");
    });
  }
  function rotateWitnessFile(id, slot) {
    var headers = multipartAuthHeaders();
    fetch("/api/session/witness-files/" + encodeURIComponent(id) + "/file", { headers: headers })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("تعذر قراءة الصورة.");
        }
        return response.blob();
      })
      .then(function (blob) {
        return new Promise(function (resolve, reject) {
          var image = new Image();
          var url = URL.createObjectURL(blob);
          image.onload = function () {
            var canvas = document.createElement("canvas");
            canvas.width = image.height;
            canvas.height = image.width;
            var ctx = canvas.getContext("2d");
            ctx.translate(canvas.width, 0);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(image, 0, 0);
            URL.revokeObjectURL(url);
            canvas.toBlob(function (turned) {
              if (!turned) {
                reject(new Error("تعذر تدوير الصورة."));
                return;
              }
              resolve(turned);
            }, blob.type === "image/png" ? "image/png" : "image/jpeg", 0.92);
          };
          image.onerror = function () {
            URL.revokeObjectURL(url);
            reject(new Error("تعذر تدوير الصورة."));
          };
          image.src = url;
        });
      })
      .then(function (turned) {
        var data = new FormData();
        var ext = turned.type === "image/png" ? "png" : "jpg";
        data.append("file", turned, "witness-" + id + "." + ext);
        if (slot) {
          data.append("slot", slot);
        }
        return fetch("/api/session/witness-files", {
          method: "POST",
          headers: headers,
          body: data
        }).then(function (response) {
          return response.json().then(function (body) {
            if (!response.ok) {
              throw new Error(apiErrorMessage(body, "تعذر حفظ الصورة بعد التدوير."));
            }
            return fetch("/api/session/witness-files/" + encodeURIComponent(id), {
              method: "DELETE",
              headers: authHeaders()
            });
          });
        });
      })
      .then(function () {
        showToast("تم تدوير الصورة.", "success");
        loadWitnessFiles();
        loadPracticeEvidence();
      })
      .catch(function (error) {
        showToast((error && error.message) || "تعذر تدوير الصورة.", "error");
      });
  }
  if (witnessFileAddBtn && witnessFileInput) {
    witnessFileAddBtn.addEventListener("click", function () {
      witnessFileInput.value = "";
      witnessFileInput.click();
    });
    witnessFileInput.addEventListener("change", function () {
      var file = witnessFileInput.files && witnessFileInput.files[0];
      if (file) {
        uploadWitnessFile(file);
      }
    });
  }
  if (witnessFilesList) {
    witnessFilesList.addEventListener("click", function (event) {
      var turn = event.target.closest("[data-witness-turn]");
      var remove = event.target.closest("[data-witness-delete]");
      if (turn) {
        rotateWitnessFile(turn.getAttribute("data-witness-turn"), turn.getAttribute("data-witness-slot"));
      } else if (remove) {
        fetch("/api/session/witness-files/" + encodeURIComponent(remove.getAttribute("data-witness-delete")), {
          method: "DELETE",
          headers: authHeaders()
        }).then(function (response) {
          if (!response.ok) {
            throw new Error("تعذر حذف المرفق.");
          }
          loadWitnessFiles();
        }).catch(function (error) {
          showToast((error && error.message) || "تعذر حذف المرفق.", "error");
        });
      }
    });
  }
  var licenseRows = [];
  var licenseRowsList = document.getElementById("aj-license-rows");
  var licenseForm = document.getElementById("aj-license-form");
  var licensePrintBtn = document.getElementById("aj-license-print");
  var licenseFileAdd = document.getElementById("aj-license-file-add");
  var licenseFileInput = document.getElementById("aj-license-file-input");
  var licenseFilesList = document.getElementById("aj-license-files-list");
  function canFillLicenseForm() {
    var role = currentUser ? String(currentUser.role || "") : "";
    return role.indexOf("مدير") === 0 || role.indexOf("وكيل") !== -1;
  }
  function renderLicenseRows() {
    if (!licenseRowsList) {
      return;
    }
    if (!licenseRows.length) {
      licenseRowsList.innerHTML = "<li class=\"aj-meta\">لا أسماء محفوظة بعد.</li>";
      return;
    }
    licenseRowsList.innerHTML = licenseRows.map(function (item) {
      var bits = [
        ["الاسم", item.person_name],
        ["الهوية", item.national_id],
        ["الرخصة", item.license_no],
        ["المستوى", item.level_name],
        ["التخصص", item.major],
        ["الانتهاء", item.expires_on]
      ].filter(function (pair) {
        return String(pair[1] || "").trim();
      }).map(function (pair) {
        return pair[0] + " " + witnessLabel(pair[1]);
      });
      return "<li><span>" + bits.join(" · ") + "</span>"
        + "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary\" data-license-delete=\"" + item.id + "\">حذف</button></li>";
    }).join("");
  }
  function loadLicenseRows() {
    fetch("/api/session/witness-licenses", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر قراءة السجل."));
          }
          licenseRows = body.items || [];
          renderLicenseRows();
        });
      })
      .catch(function (error) {
        showToast((error && error.message) || "تعذر قراءة السجل.", "error");
      });
  }
  function printLicenseRows() {
    if (!window.PrintMasterCore || typeof window.PrintMasterCore.sheet !== "function" || !window.AJPrint) {
      showToast("نواة الطباعة غير محمّلة.", "error");
      return;
    }
    var body = "<table class=\"tpl-data-table\" dir=\"rtl\"><thead><tr>"
      + "<th>الاسم</th><th>رقم الهوية</th><th>رقم الرخصة</th><th>المستوى</th><th>التخصص</th><th>الانتهاء</th>"
      + "</tr></thead><tbody>"
      + (licenseRows.length ? licenseRows.map(function (item) {
        return "<tr><td>" + witnessLabel(item.person_name) + "</td><td>" + witnessLabel(item.national_id) + "</td><td>"
          + witnessLabel(item.license_no) + "</td><td>" + witnessLabel(item.level_name) + "</td><td>"
          + witnessLabel(item.major) + "</td><td>" + witnessLabel(item.expires_on) + "</td></tr>";
      }).join("") : "<tr><td colspan=\"6\"></td></tr>")
      + "</tbody></table>";
    window.AJPrint.show(window.PrintMasterCore.sheet({
      strictIdentity: true,
      orientation: "landscape",
      title: "الرخص المهنية المتاحة",
      bodyHtml: body,
      signoff: true,
      columns: [
        { roleTitle: "معد البيان (وكيل الشؤون التعليمية)", name: "………………" },
        { roleTitle: "رئيس لجنة التميز والجودة", name: "………………" },
        { roleTitle: "يعتمد / مدير المدرسة", name: "………………" }
      ],
      frameClass: "tpl-portrait-official"
    }), {
      pdfTitle: "الرخص المهنية",
      arm: { orientation: "landscape", multiPage: true }
    });
  }
  if (licenseForm) {
    licenseForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!canFillLicenseForm()) {
        showToast("تعبئة هذا النموذج للمدير والوكيل.", "error");
        return;
      }
      fetch("/api/session/witness-licenses", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          person_name: document.getElementById("aj-license-name").value,
          national_id: document.getElementById("aj-license-nid").value,
          license_no: document.getElementById("aj-license-no").value,
          level_name: document.getElementById("aj-license-level").value,
          major: document.getElementById("aj-license-major").value,
          expires_on: document.getElementById("aj-license-exp").value
        })
      }).then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر الحفظ."));
          }
          licenseForm.reset();
          showToast("حُفظ الاسم في السجل.", "success");
          loadLicenseRows();
        });
      }).catch(function (error) {
        showToast((error && error.message) || "تعذر الحفظ.", "error");
      });
    });
  }
  if (licensePrintBtn) {
    licensePrintBtn.addEventListener("click", printLicenseRows);
  }
  if (licenseRowsList) {
    licenseRowsList.addEventListener("click", function (event) {
      var remove = event.target.closest("[data-license-delete]");
      if (!remove) {
        return;
      }
      fetch("/api/session/witness-licenses/" + encodeURIComponent(remove.getAttribute("data-license-delete")), {
        method: "DELETE",
        headers: authHeaders()
      }).then(function (response) {
        if (!response.ok) {
          throw new Error("تعذر الحذف.");
        }
        loadLicenseRows();
      }).catch(function (error) {
        showToast((error && error.message) || "تعذر الحذف.", "error");
      });
    });
  }
  if (licenseFileAdd && licenseFileInput) {
    licenseFileAdd.addEventListener("click", function () {
      licenseFileInput.value = "";
      licenseFileInput.click();
    });
    licenseFileInput.addEventListener("change", function () {
      var file = licenseFileInput.files && licenseFileInput.files[0];
      if (file) {
        uploadWitnessFile(file);
      }
    });
  }
  if (licenseFilesList) {
    licenseFilesList.addEventListener("click", function (event) {
      var turn = event.target.closest("[data-witness-turn]");
      var remove = event.target.closest("[data-witness-delete]");
      if (turn) {
        rotateWitnessFile(turn.getAttribute("data-witness-turn"), turn.getAttribute("data-witness-slot"));
      } else if (remove) {
        fetch("/api/session/witness-files/" + encodeURIComponent(remove.getAttribute("data-witness-delete")), {
          method: "DELETE",
          headers: authHeaders()
        }).then(function (response) {
          if (!response.ok) {
            throw new Error("تعذر حذف المرفق.");
          }
          loadWitnessFiles();
        }).catch(function (error) {
          showToast((error && error.message) || "تعذر حذف المرفق.", "error");
        });
      }
    });
  }
  var PRACTICE_EVIDENCE = [
    {
      code: "1-2-1-2",
      title: "تلتزم المدرسة بقيم مهنة التعليم وأخلاقياتها.",
      min: "2 إلى 3",
      note: "يُرفع ما يوثق الالتزام وحسن التعامل والمظهر والقدوة. لا تُكتب ملاحظة غير محفوظة.",
      slots: [
        ["p122-charter", "ميثاق أخلاقيات مهنة التعليم"],
        ["p122-follow", "سجل المتابعة والتوثيق"],
        ["p122-council", "محاضر مجالس المعلمين"]
      ]
    },
    {
      code: "1-2-1-6",
      title: "توفر المدرسة برامج وأنشطة إثرائية غير صفية؛ لتطوير مواهب المتعلمين، وتهيئتهم للمستقبل.",
      min: "3 إلى 4",
      note: "خطة الموهوبين، وسجل الرعاية، وصور التنفيذ، وتقرير الأثر. الأسماء تُؤخذ من المرفق لا تُخترع.",
      slots: [
        ["p126-plan", "خطة برامج الموهوبين والمبتكرين"],
        ["p126-log", "سجل أنشطة ورعاية الموهوبين"],
        ["p126-visual", "شواهد بصرية للأنشطة الإثرائية"],
        ["p126-impact", "تقارير أثر البرامج ونسب المشاركة"]
      ]
    },
    {
      code: "1-3-1-1",
      title: "تعزز المدرسة بناء العلاقات الإيجابية والتعاون في المجتمع المدرسي.",
      min: "3",
      note: "خطة العلاقات، وسجل التواصل الداخلي، ومحاضر الطلاب. المحضر المحفوظ سابقًا يبقى في زر شاهد العلاقات.",
      slots: [
        ["p131-plan", "خطة العلاقات الإنسانية والمناشط الاجتماعية"],
        ["p131-meetings", "سجل مجالس الأداء والتواصل الداخلي"],
        ["p131-students", "محاضر مجالس الطلاب وشواهد الدعم"]
      ]
    },
    {
      code: "1-3-1-2",
      title: "تعزز المدرسة مشاركة الأسرة في تعلم أبنائهم، والتحضير لمستقبلهم.",
      min: "3",
      note: "خطة الشراكة، وسجل اللقاءات، ورسائل التواصل. لا يُنشأ نص رسالة غير مرفوع.",
      slots: [
        ["p132-plan", "خطة الشراكة المجتمعية والأسرية"],
        ["p132-meetings", "سجل لقاءات أولياء الأمور"],
        ["p132-messages", "شواهد رسائل التواصل الرسمية"]
      ]
    },
    {
      code: "1-4-1-1",
      title: "توفر المدرسة كادرًا تعليميًا مكتملًا ومؤهلًا بما يتسق مع المهام الموكلة له.",
      cycle: "تشجع المدرسة منسوبيها للحصول على الرخصة المهنية.",
      min: "2 إلى 3",
      note: "التشكيل والجداول، والرخص والمؤهلات، وخطة التنمية المهنية. الرقم غير المرفق يبقى فارغًا.",
      slots: [
        ["p141-formation", "التشكيل المدرسي والجداول الدراسية المعتمدة"],
        ["p141-license", "سجل الكفاءة المهنية"],
        ["p141-plc", "خطة التنمية المهنية المستمرة"]
      ]
    },
    {
      code: "1-4-1-2",
      title: "توفر المدرسة كادرًا إداريًا مكتملًا ومؤهلًا بما يتسق مع المهام الموكلة له.",
      cycle: "تدعم المدرسة التطوير المهني لمنسوبيها وفقًا لنتائج تقويم الأداء الوظيفي واحتياجاتهم.",
      min: "2",
      note: "الهيكل وتوزيع المهام، وسجل تقييم الإداريين. لا يُستكمل اسم غير موجود في المرفق.",
      slots: [
        ["p142-structure", "الهيكل الإداري وتوزيع المهام"],
        ["p142-review", "سجل تقييم أداء الكادر الإداري"]
      ]
    },
    {
      code: "1-4-1-3",
      title: "تطبق المدرسة التقويم الذاتي المبنيّ على المعايير المعتمدة من الهيئة بشكل مستمر.",
      cycle: "تطبق المدرسة التقويم الذاتي المبني على المعايير المعتمدة من الهيئة.",
      min: "3",
      note: "تقرير التقويم الذاتي، وخطة التحسين، ومحاضر فريق الجودة. الطباعة تبقى على إطارها الحالي.",
      slots: [
        ["p143-report", "تقرير التقويم الذاتي المدرسي"],
        ["p143-improve", "خطة التحسين المستندة إلى التقويم الذاتي"],
        ["p143-quality", "محاضر فريق الجودة والتميز"]
      ]
    }
  ];
  function loadPracticeEvidence() {
    var host = document.getElementById("aj-practice-host");
    var section = document.getElementById("view-practice-evidence");
    if (!host || !section || section.hidden) {
      return;
    }
    fetch("/api/session/witness-files?slot=bundle", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر قراءة الشواهد."));
          }
          var bySlot = {};
          (body.items || []).forEach(function (item) {
            var key = item.slot || "";
            if (!bySlot[key]) {
              bySlot[key] = [];
            }
            bySlot[key].push(item);
          });
          host.innerHTML = PRACTICE_EVIDENCE.map(function (practice) {
            var slots = practice.slots.map(function (pair) {
              var files = bySlot[pair[0]] || [];
              var list = files.length ? files.map(function (item) {
                var turn = item.kind === "image"
                  ? "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary\" data-witness-turn=\"" + item.id + "\" data-witness-slot=\"" + witnessLabel(pair[0]) + "\">تدوير</button>"
                  : "";
                return "<li><span>" + witnessLabel(item.original_name) + "</span>" + turn
                  + "<button type=\"button\" class=\"aj-detail-btn aj-detail-btn-secondary\" data-witness-delete=\"" + item.id + "\">حذف</button></li>";
              }).join("") : "<li class=\"aj-meta\">لا مرفق بعد.</li>";
              return "<div class=\"aj-witness-files\"><h2 class=\"aj-detail-label\">" + witnessLabel(pair[1]) + "</h2><ul>" + list + "</ul>"
                + "<button type=\"button\" class=\"aj-detail-btn\" data-practice-upload=\"" + pair[0] + "\">رفع صورة أو ملف</button></div>";
            }).join("");
            var cycleLine = practice.cycle
              ? "<p class=\"aj-meta\">عبارة دورة التقويم لهذا الرمز: " + witnessLabel(practice.cycle) + "</p>"
              : "";
            return "<section class=\"aj-witness-files\"><h2 class=\"aj-group-title\">" + witnessLabel(practice.code) + " · " + witnessLabel(practice.title) + "</h2>"
              + cycleLine
              + "<p class=\"aj-meta\">الحد الأدنى: " + witnessLabel(practice.min) + " شواهد. " + witnessLabel(practice.note) + "</p>"
              + slots + "</section>";
          }).join("");
          if (window.AjIndicatorFiles && typeof window.AjIndicatorFiles.paint === "function") {
            window.AjIndicatorFiles.onAssigned = loadPracticeEvidence;
            window.AjIndicatorFiles.paint(host);
          }
        });
      })
      .catch(function (error) {
        host.textContent = (error && error.message) || "تعذر قراءة الشواهد.";
      });
  }
  var practiceHost = document.getElementById("aj-practice-host");
  var practiceInput = document.getElementById("aj-practice-file");
  var practiceSlot = "";
  if (practiceHost && practiceInput) {
    practiceHost.addEventListener("click", function (event) {
      var upload = event.target.closest("[data-practice-upload]");
      var turn = event.target.closest("[data-witness-turn]");
      var remove = event.target.closest("[data-witness-delete]");
      if (upload) {
        practiceSlot = upload.getAttribute("data-practice-upload") || "";
        practiceInput.value = "";
        practiceInput.click();
      } else if (turn) {
        rotateWitnessFile(turn.getAttribute("data-witness-turn"), turn.getAttribute("data-witness-slot"));
      } else if (remove) {
        fetch("/api/session/witness-files/" + encodeURIComponent(remove.getAttribute("data-witness-delete")), {
          method: "DELETE",
          headers: authHeaders()
        }).then(function (response) {
          if (!response.ok) {
            throw new Error("تعذر حذف المرفق.");
          }
          loadPracticeEvidence();
        }).catch(function (error) {
          showToast((error && error.message) || "تعذر حذف المرفق.", "error");
        });
      }
    });
    practiceInput.addEventListener("change", function () {
      var file = practiceInput.files && practiceInput.files[0];
      if (file && practiceSlot) {
        uploadWitnessFile(file, practiceSlot);
      }
    });
  }
  if (planPrint146Btn) {
    planPrint146Btn.addEventListener("click", function () {
      if (!window.Plan146 || typeof window.Plan146.open !== "function") {
        showToast("نموذج التقويم الذاتي غير محمّل.", "error");
        return;
      }
      window.Plan146.open().catch(function (error) {
        showToast((error && error.message) || "تعذر تجهيز حزمة التقويم الذاتي.", "error");
      });
    });
  }
  if (planPrint142Btn) {
    planPrint142Btn.addEventListener("click", function () {
      if (!window.Plan142 || typeof window.Plan142.open !== "function") {
        showToast("نموذج الكادر الإداري غير محمّل.", "error");
        return;
      }
      window.Plan142.open().catch(function (error) {
        showToast((error && error.message) || "تعذر تجهيز حزمة الكادر الإداري.", "error");
      });
    });
  }
  if (planPdfBtn) {
    planPdfBtn.addEventListener("click", function () {
      if (String(pendingPlanDetailId) === "operational-plan" && window.Plan111 && typeof window.Plan111.open === "function") {
        window.Plan111.open().then(function () {
          showToast("في نافذة الطباعة: الطابعة «حفظ كـ PDF». الهوامش «بلا» حتى تبقى هوامش الوثيقة 15 مم. فعّل رسومات الخلفية.", "success");
        }).catch(function (error) {
          showToast((error && error.message) || "تعذر تجهيز حزمة الخطة.", "error");
        });
        return;
      }
      printCurrentProgramCard(true);
    });
  }
  if (planEvidenceBtn) {
    planEvidenceBtn.addEventListener("click", function () {
      attachCurrentProgramEvidence();
    });
  }
  if (planPhotosBtn && programPhotoFileEl) {
    planPhotosBtn.addEventListener("click", function () {
      if (!currentProgramRecord || !currentProgramRecord.id) {
        showToast("افتح برنامجاً أولاً.", "error");
        return;
      }
      replaceProgramImageId = 0;
      programPhotoFileEl.multiple = true;
      if ((currentProgramImages || []).length >= 5) {
        showToast("الحد الأقصى خمس صور لكل برنامج.", "error");
        return;
      }
      programPhotoFileEl.click();
    });
    programPhotoFileEl.addEventListener("change", function () {
      uploadProgramCardImages();
    });
  }
  if (planFileBtn && programPlanFileEl) {
    planFileBtn.addEventListener("click", function () {
      if (!currentProgramRecord || !currentProgramRecord.id) {
        showToast("افتح برنامجاً أولاً.", "error");
        return;
      }
      programPlanFileEl.click();
    });
    programPlanFileEl.addEventListener("change", function () {
      uploadProgramPlan();
    });
  }
  if (programPlanPreviewEl) {
    programPlanPreviewEl.addEventListener("click", function () {
      if (!currentProgramPlan || !currentProgramPlan.blob) {
        return;
      }
      openFilePreview({
        blob: currentProgramPlan.blob,
        filename: currentProgramPlan.name || "الخطة التفصيلية.pdf",
        pdf: true,
        title: "الخطة التفصيلية"
      });
    });
  }
  if (programPlanDeleteEl) {
    programPlanDeleteEl.addEventListener("click", function () {
      deleteProgramPlan();
    });
  }
  if (councilAddBtn) {
    councilAddBtn.addEventListener("click", function () {
      openCouncilForm();
    });
  }
  if (councilModalEl) {
    councilModalEl.addEventListener("click", function (event) {
      var closer = event.target.closest ? event.target.closest("[data-aj-council-close]") : null;
      if (closer) {
        closeCouncilForm();
      }
    });
  }
  if (councilFormEl) {
    councilFormEl.addEventListener("submit", function (event) {
      event.preventDefault();
      submitCouncilForm();
    });
    [councilTypeEl, councilDateEl, councilAgendaEl].forEach(function (field) {
      if (!field) {
        return;
      }
      field.addEventListener("change", refreshCouncilDraft);
      field.addEventListener("input", refreshCouncilDraft);
    });
    if (councilTypeEl) {
      councilTypeEl.addEventListener("change", function () {
        if (councilEditingId) {
          return;
        }
        var ids = window.AjCommittees && typeof window.AjCommittees.memberIds === "function"
          ? window.AjCommittees.memberIds(councilTypeEl.value)
          : [];
        loadCouncilPresentChoices(ids);
      });
    }
  }
  Array.prototype.forEach.call(document.querySelectorAll(".aj-deliver-form"), function (form) {
    form.addEventListener("submit", submitDeliverable);
  });
  var filePreviewClose = document.getElementById("aj-file-preview-close");
  var filePreviewBackdrop = document.getElementById("aj-file-preview-backdrop");
  var filePreviewDownload = document.getElementById("aj-file-preview-download");
  if (filePreviewClose) {
    filePreviewClose.addEventListener("click", closeFilePreview);
  }
  if (filePreviewBackdrop) {
    filePreviewBackdrop.addEventListener("click", closeFilePreview);
  }
  if (filePreviewDownload) {
    filePreviewDownload.addEventListener("click", function () {
      if (filePreviewState && filePreviewState.blob) {
        triggerBlobDownload(filePreviewState.blob, filePreviewState.filename || "ملف");
        return;
      }
      showToast("لا ملف للتنزيل.", "error");
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll(".aj-deliver-teacher"), function (select) {
    select.addEventListener("change", function () {
      fillDeliverableSubject(select);
    });
  });
  if (staffAddBtn) {
    staffAddBtn.addEventListener("click", function () {
      openStaffForm(null);
    });
  }
  [staffFilterRoleEl, staffFilterSpecialtyEl].forEach(function (node) {
    if (node) {
      node.addEventListener("change", paintStaffBoard);
    }
  });
  if (staffFilterQEl) {
    staffFilterQEl.addEventListener("input", paintStaffBoard);
  }
  if (staffPrintBtn) {
    staffPrintBtn.addEventListener("click", printStaffRoster);
  }
  if (staffModalEl) {
    staffModalEl.addEventListener("click", function (event) {
      var closer = event.target.closest ? event.target.closest("[data-aj-staff-close]") : null;
      if (closer) {
        closeStaffForm();
      }
    });
  }
  if (staffFormEl) {
    staffFormEl.addEventListener("submit", function (event) {
      event.preventDefault();
      submitStaffForm();
    });
  }
  if (councilPrintBtn) {
    councilPrintBtn.addEventListener("click", function () {
      printCouncilDetail();
    });
  }
  if (evidenceAddBtn) {
    evidenceAddBtn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      openEvidenceForm();
    });
  }
  if (evidenceModalEl) {
    evidenceModalEl.addEventListener("click", function (event) {
      var closer = event.target.closest ? event.target.closest("[data-aj-evidence-close]") : null;
      if (closer) {
        closeEvidenceForm();
      }
    });
  }
  if (evidenceFormEl) {
    evidenceFormEl.addEventListener("submit", function (event) {
      event.preventDefault();
      submitEvidenceForm();
    });
  }
  if (evidenceEntityTypeEl) {
    evidenceEntityTypeEl.addEventListener("change", function () {
      fillEvidenceEntityOptions(evidenceEntityTypeEl.value);
    });
  }
  if (evidenceEntityKeyEl) {
    evidenceEntityKeyEl.addEventListener("change", function () {
      fillEvidenceDeliverableSubject();
    });
  }
  if (evidenceFileEl) {
    evidenceFileEl.addEventListener("change", function () {
      paintEvidenceFileName();
    });
  }
  if (evidenceDropEl) {
    ["dragenter", "dragover"].forEach(function (eventName) {
      evidenceDropEl.addEventListener(eventName, function (event) {
        event.preventDefault();
        evidenceDropEl.classList.add("is-dragover");
      });
    });
    ["dragleave", "drop"].forEach(function (eventName) {
      evidenceDropEl.addEventListener(eventName, function (event) {
        event.preventDefault();
        evidenceDropEl.classList.remove("is-dragover");
      });
    });
    evidenceDropEl.addEventListener("drop", function (event) {
      var files = event.dataTransfer && event.dataTransfer.files;
      if (!files || !files.length || !evidenceFileEl) {
        return;
      }
      try {
        evidenceFileEl.files = files;
      } catch (error) {
        /* بعض المتصفحات تمنع تعيين files مباشرة */
      }
      if (evidenceFileEl.files && evidenceFileEl.files.length) {
        paintEvidenceFileName();
        return;
      }
      if (evidenceFileNameEl) {
        evidenceFileNameEl.textContent = files[0].name || "ملف محدد";
      }
      evidenceDropEl._droppedFile = files[0];
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") {
      return;
    }
    var fileHost = document.getElementById("aj-file-preview");
    if (fileHost && !fileHost.hidden) {
      closeFilePreview();
      return;
    }
    if (document.body.classList.contains("is-print-preview")) {
      closeOfficialPreview();
    }
  });

  function councilTypeLabel(type) {
    var key = String(type || "").trim();
    return COUNCIL_TYPE_LABELS[key] || key || "مجلس مدرسي";
  }

  function councilDateLabel(item) {
    var hijri = String((item && item.hijri) || "").trim();
    var gregorian = String((item && item.gregorian) || "").trim();
    if (hijri && gregorian) {
      return hijri + " · " + gregorian;
    }
    return hijri || gregorian || String((item && (item.iso || item.dayKey)) || "").trim() || "—";
  }

  function findCouncilById(councilId) {
    var list = (councilsCache && councilsCache.minutes) || [];
    var needle = String(councilId == null ? "" : councilId);
    for (var i = 0; i < list.length; i += 1) {
      if (String(list[i].id) === needle) {
        return list[i];
      }
    }
    return null;
  }

  function renderCouncilAttendance(present, signatures) {
    if (!councilAttendanceEl) {
      return;
    }
    councilAttendanceEl.innerHTML = "";
    var list = Array.isArray(present) ? present : [];
    var images = signatures && typeof signatures === "object" ? signatures : {};
    list.forEach(function (person) {
      var tr = document.createElement("tr");
      var nameCell = document.createElement("td");
      nameCell.textContent = person && person.name ? String(person.name) : "";
      var roleCell = document.createElement("td");
      roleCell.textContent = person && person.role ? String(person.role) : "";
      var signCell = document.createElement("td");
      signCell.className = "aj-attendance-sign";
      var personId = person && person.id != null ? String(person.id) : "";
      var dataUrl = personId && typeof images[personId] === "string" ? images[personId] : "";
      if (dataUrl.indexOf("data:image/") === 0) {
        var image = document.createElement("img");
        image.className = "aj-attendance-sign-img";
        image.alt = "";
        image.src = dataUrl;
        signCell.appendChild(image);
      } else {
        var line = document.createElement("span");
        line.className = "aj-attendance-sign-line";
        line.setAttribute("aria-hidden", "true");
        signCell.appendChild(line);
      }
      tr.appendChild(nameCell);
      tr.appendChild(roleCell);
      tr.appendChild(signCell);
      councilAttendanceEl.appendChild(tr);
    });
  }

  function loadCouncilAttendance(item) {
    councilSignatureTicket += 1;
    var ticket = councilSignatureTicket;
    var present = item && Array.isArray(item.present) ? item.present : [];
    var councilId = item && item.id != null ? String(item.id) : "";
    renderCouncilAttendance(present, {});
    if (!councilId) {
      return;
    }
    fetch("/api/session/councils/" + encodeURIComponent(councilId) + "/signatures", {
      headers: authHeaders(),
      cache: "no-store"
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error("signatures");
          }
          return payload;
        });
      })
      .then(function (payload) {
        if (ticket !== councilSignatureTicket) {
          return;
        }
        renderCouncilAttendance(present, payload);
      })
      .catch(function () {
        if (ticket !== councilSignatureTicket) {
          return;
        }
        renderCouncilAttendance(present, {});
      });
  }

  function showCouncilDetails(councilId) {
    pendingCouncilDetailId = councilId;
    var item = findCouncilById(councilId);
    setHidden(councilDetailErrorEl, true);
    if (councilDetailBodyEl) {
      councilDetailBodyEl.textContent = item ? councilSpokenMinutes(item, councilChairName).text : "";
    }
    if (!item) {
      if (councilDetailTitleEl) {
        councilDetailTitleEl.textContent = "محضر المجلس";
      }
      if (councilDetailDateEl) {
        councilDetailDateEl.textContent = "";
      }
      clearPrintedSignature();
      renderCouncilAttendance([], {});
      if (councilDetailErrorEl) {
        councilDetailErrorEl.hidden = false;
        councilDetailErrorEl.textContent = "تعذر العثور على المحضر. عد إلى مركز التنفيذ وحاول مجددًا.";
      }
      return;
    }

    if (councilDetailTitleEl) {
      councilDetailTitleEl.textContent = councilTypeLabel(item.type);
    }
    if (councilDetailDateEl) {
      councilDetailDateEl.textContent = "التاريخ: " + councilDateLabel(item);
    }
    loadCouncilAttendance(item);
    ensureCouncilChair().then(function (name) {
      if (String(pendingCouncilDetailId) !== String(councilId) || !councilDetailBodyEl) {
        return;
      }
      councilDetailBodyEl.textContent = councilSpokenMinutes(item, name).text;
    });
    console.log("Council Details:", item);
    window.dispatchEvent(
      new CustomEvent("app:council:opened", {
        detail: { id: item.id, type: item.type || "" }
      })
    );
  }

  function openCouncilDetailsRoute(councilId) {
    window.location.hash = "view-council-details?id=" + encodeURIComponent(String(councilId));
  }

  function buildCouncilCards(minutes) {
    if (!execCardsEl) {
      return;
    }
    execCardsEl.innerHTML = "";
    var list = Array.isArray(minutes) ? minutes : [];

    if (execSummaryEl) {
      execSummaryEl.hidden = false;
      execSummaryEl.textContent = "سجل المجالس: " + list.length + " مجلس";
    }

    if (!list.length) {
      setHidden(execEmptyEl, false);
      return;
    }
    setHidden(execEmptyEl, true);

    list.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "aj-card";
      var h2 = document.createElement("h2");
      h2.textContent = councilTypeLabel(item.type);
      var date = document.createElement("p");
      date.className = "aj-card-meta";
      date.textContent = "التاريخ: " + councilDateLabel(item);
      li.appendChild(h2);
      li.appendChild(date);
      if (item.agenda) {
        var agenda = document.createElement("p");
        agenda.className = "aj-card-meta";
        agenda.textContent = String(item.agenda);
        li.appendChild(agenda);
      }
      var actions = document.createElement("div");
      actions.className = "aj-task-actions";
      var openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "aj-open-task";
      openBtn.textContent = "عرض المحضر";
      openBtn.addEventListener("click", function () {
        openCouncilDetailsRoute(item.id);
      });
      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "aj-open-task";
      editBtn.textContent = "تعديل";
      editBtn.addEventListener("click", function () {
        openCouncilEditor(item);
      });
      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "aj-council-delete";
      deleteBtn.textContent = "حذف";
      deleteBtn.addEventListener("click", function () {
        deleteCouncil(item);
      });
      actions.appendChild(openBtn);
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      li.appendChild(actions);
      execCardsEl.appendChild(li);
    });
  }

  var officialPreviewSavedTitle = "";
  var officialPreviewArm = {};
  var officialPreviewHtml = "";
  var officialPreviewFiles = [];
  var filePreviewState = null;
  var printStageEl = document.getElementById("aj-print-stage");
  var printStagePageEl = document.getElementById("aj-print-stage-page");
  var printStageGoBtn = document.getElementById("aj-print-preview-go");
  var printStageCloseBtn = document.getElementById("aj-print-preview-close");

  function closeOfficialPreview() {
    var core = window.OfficialFrameCore;
    if (printStageEl) {
      printStageEl.hidden = true;
    }
    if (printStagePageEl) {
      printStagePageEl.innerHTML = "";
    }
    document.body.classList.remove(
      "is-print-preview",
      "print-official-core",
      "print-official-list",
      "print-official-multi",
      "print-master",
      "print-master-landscape"
    );
    if (officialPreviewSavedTitle) {
      document.title = officialPreviewSavedTitle;
      officialPreviewSavedTitle = "";
    }
    officialPreviewHtml = "";
    officialPreviewFiles = [];
    closeFilePreview();
    if (core && typeof core.hideHost === "function") {
      core.hideHost();
    }
  }

  function waitOfficialPreviewImages(root, done) {
    var images = root ? root.querySelectorAll("img") : [];
    var pending = 0;
    var settled = false;
    function finish() {
      if (settled) {
        return;
      }
      settled = true;
      done();
    }
    Array.prototype.forEach.call(images, function (img) {
      if (!img.getAttribute("src") || (img.complete && img.naturalHeight !== 0)) {
        return;
      }
      pending += 1;
      img.addEventListener("load", function () {
        pending -= 1;
        if (pending <= 0) {
          finish();
        }
      });
      img.addEventListener("error", function () {
        pending -= 1;
        if (pending <= 0) {
          finish();
        }
      });
    });
    if (pending === 0) {
      finish();
      return;
    }
    window.setTimeout(finish, 8000);
  }

  function materializeBlobImages(root) {
    var jobs = [];
    Array.prototype.forEach.call(root ? root.querySelectorAll("img") : [], function (img) {
      var src = img.getAttribute("src") || "";
      if (src.indexOf("blob:") !== 0) {
        return;
      }
      jobs.push(
        fetch(src).then(function (response) {
          return response.blob();
        }).then(function (blob) {
          return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onloadend = function () {
              if (reader.result) {
                img.setAttribute("src", reader.result);
              }
              resolve();
            };
            reader.onerror = function () {
              resolve();
            };
            reader.readAsDataURL(blob);
          });
        }).catch(function () {
          return null;
        })
      );
    });
    return Promise.all(jobs);
  }

  function prepareOfficialPrintStage() {
    var core = window.OfficialFrameCore;
    if (!printStagePageEl || !officialPreviewHtml) {
      return false;
    }
    if (printStageEl) {
      printStageEl.hidden = false;
      printStageEl.style.display = "block";
      printStageEl.style.visibility = "visible";
    }
    if (printStagePageEl) {
      printStagePageEl.style.display = "block";
      printStagePageEl.style.visibility = "visible";
    }
    document.body.classList.add("is-print-preview");
    if (core && typeof core.armPrintPage === "function") {
      core.armPrintPage(officialPreviewArm || {});
    } else {
      document.body.classList.add("print-official-core");
    }
    Array.prototype.forEach.call(printStagePageEl.querySelectorAll("img.sig-image"), function (img) {
      img.removeAttribute("onerror");
      img.style.position = "static";
      img.style.display = "block";
      img.style.visibility = "visible";
      img.style.opacity = "1";
    });
    return true;
  }

  function printOfficialPreview() {
    if (!prepareOfficialPrintStage()) {
      showToast("لا معاينة للطباعة.", "error");
      return;
    }
    materializeBlobImages(printStagePageEl).then(function () {
      waitOfficialPreviewImages(printStagePageEl, function () {
        var named = printStagePageEl.querySelector(".pm-document");
        var smart = named ? named.getAttribute("data-file-name") : "";
        if (window.PrintMasterCore && typeof window.PrintMasterCore.applyTitle === "function" && smart) {
          window.PrintMasterCore.applyTitle(smart);
        } else if (smart) {
          document.title = smart;
        }
        window.print();
        restorePreviewChrome();
      });
    });
  }

  function restorePreviewChrome() {
    var bar = printStageEl ? printStageEl.querySelector(".aj-print-preview-bar") : null;
    if (bar) {
      bar.style.removeProperty("display");
    }
    if (printStageCloseBtn) {
      printStageCloseBtn.hidden = false;
      printStageCloseBtn.style.removeProperty("display");
    }
    if (printStageGoBtn) {
      printStageGoBtn.hidden = false;
      printStageGoBtn.style.removeProperty("display");
    }
  }

  window.addEventListener("beforeprint", function () {
    if (!document.body.classList.contains("is-print-preview")) {
      return;
    }
    prepareOfficialPrintStage();
  });
  window.addEventListener("afterprint", restorePreviewChrome);

  function showOfficialPreview(html, opts) {
    opts = opts || {};
    if (!printStageEl || !printStagePageEl) {
      showToast("لوحة المعاينة غير موجودة.", "error");
      return;
    }
    officialPreviewArm = opts.arm || {};
    officialPreviewHtml = html || "";
    var smartName = "";
    var namedNode = document.createElement("div");
    namedNode.innerHTML = officialPreviewHtml;
    var named = namedNode.querySelector(".pm-document");
    if (named && named.getAttribute("data-file-name")) {
      smartName = named.getAttribute("data-file-name");
    } else if (window.PrintMasterCore && typeof window.PrintMasterCore.fileName === "function") {
      smartName = window.PrintMasterCore.fileName(Object.assign({ title: opts.pdfTitle || "" }, opts.file || {}));
    } else {
      smartName = String(opts.pdfTitle || "").trim();
    }
    if (!officialPreviewSavedTitle) {
      officialPreviewSavedTitle = document.title;
    }
    if (smartName) {
      document.title = smartName;
    }
    var fileLabel = document.getElementById("aj-print-file-name");
    if (!fileLabel && printStageEl) {
      var bar = printStageEl.querySelector(".aj-print-preview-bar");
      if (bar) {
        fileLabel = document.createElement("span");
        fileLabel.id = "aj-print-file-name";
        fileLabel.className = "aj-print-file-name no-print";
        bar.appendChild(fileLabel);
      }
    }
    if (fileLabel) {
      fileLabel.textContent = smartName ? (smartName + ".pdf") : "";
    }
    printStagePageEl.innerHTML = officialPreviewHtml;
    officialPreviewFiles = Array.isArray(opts.files) ? opts.files : [];
    appendPreviewFilesStrip(officialPreviewFiles);
    printStageEl.hidden = false;
    printStageEl.scrollTop = 0;
    document.body.classList.add("is-print-preview");
  }

  if (printStageGoBtn) {
    printStageGoBtn.addEventListener("click", printOfficialPreview);
  }
  if (printStagePdfBtn) {
    printStagePdfBtn.addEventListener("click", function () {
      showToast("في نافذة الطباعة: الطابعة «حفظ كـ PDF». الهوامش «بلا» حتى تبقى هوامش الوثيقة 15 مم. فعّل رسومات الخلفية.", "success");
      printOfficialPreview();
    });
  }
  if (printStageExportBtn) {
    printStageExportBtn.addEventListener("click", function () {
      exportPreviewAttachments(officialPreviewFiles);
    });
  }
  if (printStageCloseBtn) {
    printStageCloseBtn.addEventListener("click", closeOfficialPreview);
  }
  window.AJPrint = {
    show: showOfficialPreview,
    print: printOfficialPreview
  };
  window.AJEvidence = {
    open: openEvidenceForm
  };

  function printFrameHtml(title, bodyHtml, columns) {
    var core = window.OfficialFrameCore;
    if (!core || typeof core.page !== "function") {
      showToast("نواة الطباعة غير محمّلة.", "error");
      return;
    }
    var school = schoolNameEl ? String(schoolNameEl.textContent || "").trim() : "";
    var people = Array.isArray(columns) ? columns : [];
    fetchLetterheadAssets().then(function (letter) {
      var spec = Object.assign({
        strictIdentity: true,
        title: title || "",
        bodyHtml: bodyHtml || "",
        school: school,
        signoff: people.length > 0,
        columns: people,
        page: 1,
        total: 1
      }, letterheadPrintOpts(letter));
      var html = window.PrintMasterCore && typeof window.PrintMasterCore.sheet === "function"
        ? window.PrintMasterCore.sheet(spec)
        : core.page(spec);
      showOfficialPreview(html, { pdfTitle: title || "وثيقة", arm: { multiPage: true } });
    });
  }

  function printTextBlock(text) {
    var core = window.OfficialFrameCore;
    var value = String(text || "");
    var safe = core && typeof core.escapeHtml === "function" ? core.escapeHtml(value) : "";
    if (!value.trim()) {
      return "";
    }
    return "<p style=\"white-space:pre-wrap;margin:0 0 8px;\">" + safe + "</p>";
  }

  function councilSignoffColumns(present, images) {
    var list = Array.isArray(present) ? present : [];
    var batch = images && typeof images === "object" ? images : {};
    return list.map(function (person) {
      var personId = person && person.id != null ? String(person.id) : "";
      var src = personId && typeof batch[personId] === "string" ? batch[personId] : "";
      if (src.indexOf("data:image/") !== 0) {
        src = "";
      }
      return {
        roleTitle: person && person.role ? String(person.role) : "",
        name: person && person.name ? String(person.name) : "",
        signature: src
      };
    }).filter(function (person) {
      return person.name || person.roleTitle || person.signature;
    });
  }

  function councilAttendanceTableFrom(rows, continued) {
    if (!rows.length) {
      return "";
    }
    var core = window.OfficialFrameCore;
    var esc = core && typeof core.escapeHtml === "function"
      ? function (value) { return core.escapeHtml(value); }
      : function (value) { return String(value || ""); };
    var body = rows.map(function (person) {
      var mark = person.signature
        ? "<img class=\"sig-image\" src=\"" + esc(person.signature) + "\" alt=\"\">"
        : "<span class=\"aj-sign-line\"></span>";
      return "<tr><td>" + esc(person.name) + "</td><td>" + esc(person.roleTitle) + "</td><td class=\"aj-sign-slot\">" + mark + "</td></tr>";
    }).join("");
    var heading = continued
      ? "<p class=\"aj-sign-continued\">توقيعات الحضور (تابع)</p>"
      : "";
    return heading
      + "<table class=\"aj-sign-table\"><thead><tr><th>الاسم</th><th>الصفة</th><th>التوقيع</th></tr></thead><tbody>"
      + body + "</tbody></table>";
  }

  function councilTextProbe() {
    var probe = document.createElement("div");
    var bodyStyle = window.getComputedStyle(document.body);
    probe.setAttribute("aria-hidden", "true");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.left = "0";
    probe.style.top = "0";
    probe.style.width = "160mm";
    probe.style.fontFamily = bodyStyle.fontFamily;
    probe.style.fontSize = "12px";
    probe.style.lineHeight = "1.8";
    probe.style.whiteSpace = "pre-wrap";
    probe.style.wordWrap = "break-word";
    probe.style.overflowWrap = "break-word";
    probe.style.textAlign = "justify";
    probe.style.direction = "rtl";
    document.body.appendChild(probe);
    return probe;
  }

  function councilTextMillimeters(probe, text) {
    probe.style.height = "auto";
    probe.textContent = text || "";
    var px = probe.getBoundingClientRect().height;
    probe.style.height = "100mm";
    var mm = px / (probe.getBoundingClientRect().height / 100);
    probe.style.height = "auto";
    return mm;
  }

  function councilFlowPages(text, firstMm, nextMm) {
    var clean = String(text || "").trim();
    if (!clean) {
      return [];
    }
    var probe = councilTextProbe();
    var pages = [];
    var rest = clean;
    var limit = firstMm;
    function fits(value, maxMm) {
      return councilTextMillimeters(probe, value) <= maxMm + 0.4;
    }
    while (rest) {
      if (fits(rest, limit)) {
        pages.push(rest);
        break;
      }
      var low = 0;
      var high = Array.from(rest).length;
      var best = 1;
      while (low <= high) {
        var mid = Math.floor((low + high) / 2);
        var sample = Array.from(rest).slice(0, mid).join("");
        if (mid > 0 && fits(sample, limit)) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      var chars = Array.from(rest);
      var windowText = chars.slice(0, best).join("");
      var breakAt = Math.max(windowText.lastIndexOf("\n"), windowText.lastIndexOf(" "));
      var cut = best;
      if (breakAt > best * 0.6) {
        cut = Array.from(windowText.slice(0, breakAt + 1)).length;
      }
      if (cut < 1) {
        cut = 1;
      }
      pages.push(chars.slice(0, cut).join("").replace(/\s+$/, ""));
      rest = chars.slice(cut).join("").replace(/^\s+/, "");
      limit = nextMm;
    }
    document.body.removeChild(probe);
    return pages;
  }

  function printCouncilFrames(heading, pdfTitle, pages, options) {
    var core = window.OfficialFrameCore;
    if (!core || typeof core.page !== "function" || typeof core.armPrintPage !== "function" || typeof core.ensureHost !== "function") {
      showToast("نواة الطباعة غير محمّلة.", "error");
      return;
    }
    var fileTitle = String(pdfTitle || heading || "محضر").trim() || "محضر";
    var school = schoolNameEl ? String(schoolNameEl.textContent || "").trim() : "";
    var total = pages.length || 1;
    var withSignoff = !options || options.signoff !== false;
    fetchLetterheadAssets().then(function (letter) {
      var logos = letterheadPrintOpts(letter);
      var bodyHtml = pages.map(function (body) {
        return "<div class=\"aj-print-slot\">" + (body || "") + "</div>";
      }).join("");
      var master = window.PrintMasterCore;
      var html = master && typeof master.sheet === "function"
        ? master.sheet(Object.assign({
          strictIdentity: true,
          title: heading || "",
          bodyHtml: bodyHtml,
          school: school,
          signoff: withSignoff,
          columns: (options && options.columns) || [],
          frameClass: "tpl-portrait-official",
          kind: "document"
        }, logos))
        : pages.map(function (body, index) {
          return core.page(Object.assign({
            strictIdentity: true,
            title: index === 0 ? (heading || "") : "",
            bodyHtml: "<div class=\"aj-print-slot\">" + (body || "") + "</div>",
            school: school,
            signoff: withSignoff && index === total - 1,
            columns: options && options.columns,
            page: index + 1,
            total: total
          }, logos));
        }).join("");
      showOfficialPreview(html, { pdfTitle: fileTitle, arm: { multiPage: true } });
    });
  }

  function fetchCouncilSignatures(councilId) {
    if (!councilId) {
      return Promise.resolve({});
    }
    return fetch("/api/session/councils/" + encodeURIComponent(councilId) + "/signatures", {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) {
          return {};
        }
        return payload;
      });
    }).catch(function () {
      return {};
    });
  }

  function councilLeadershipColumn(role, id, people, signatures) {
    var identity = String(id || "").trim();
    var name = "";
    if (identity) {
      (people || []).forEach(function (person) {
        if (person && String(person.id) === identity && person.name) {
          name = String(person.name);
        }
      });
    }
    return {
      role: role,
      name: name,
      signature: identity && signatures && signatures[identity] ? signatures[identity] : ""
    };
  }

  var COUNCIL_SIGNOFF_BEFORE = {
    admin: ["education", "students"],
    fund: ["education", "students"],
    safety: ["education", "students"],
    special: ["education", "students"],
    achievement: ["education"],
    excellence: ["education"],
    guidance: ["students", "counselor"],
    discipline: ["students", "counselor"],
    activity: ["students", "activity"]
  };

  var COUNCIL_SIGNOFF_BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

  var COUNCIL_SIGNOFF_TITLES = {
    education: "وكيل شؤون المعلمين",
    students: "وكيل شؤون الطلاب",
    counselor: "الموجه الطلابي",
    activity: "رائد النشاط",
    manager: "مدير المدرسة"
  };

  function councilSeatId(seats, key) {
    var row = seats || {};
    if (key === "education") {
      return Array.isArray(row.education_agents) ? row.education_agents[0] : "";
    }
    if (key === "students") {
      return Array.isArray(row.student_agents) ? row.student_agents[0] : "";
    }
    if (key === "counselor") {
      var guides = Array.isArray(row.counselors) ? row.counselors : [];
      return guides[0] || row.counselor || "";
    }
    if (key === "activity") {
      return row.activity_leader || "";
    }
    if (key === "manager") {
      return row.manager || "";
    }
    return "";
  }

  function councilSignoffKeys(type) {
    var listed = COUNCIL_SIGNOFF_BEFORE[String(type || "").trim()];
    var before = Array.isArray(listed) ? listed.slice(0, 2) : [];
    while (before.length < 2) {
      before.push("blank");
    }
    before.push("manager");
    return before;
  }

  function councilBlankColumn() {
    return {
      roleTitle: "\u00a0",
      name: "",
      signature: COUNCIL_SIGNOFF_BLANK_IMAGE
    };
  }

  function councilLeadershipColumns(type, people, leadership, signatures) {
    var seats = leadership || {};
    var images = signatures || {};
    var keys = councilSignoffKeys(type);
    var needed = {};
    keys.forEach(function (key) {
      if (key === "blank") {
        return;
      }
      var identity = String(councilSeatId(seats, key) || "").trim();
      if (identity && images[identity]) {
        needed[identity] = images[identity];
      }
    });
    return keys.map(function (key) {
      if (key === "blank") {
        return councilBlankColumn();
      }
      return councilLeadershipColumn(
        COUNCIL_SIGNOFF_TITLES[key],
        councilSeatId(seats, key),
        people,
        needed
      );
    });
  }

  function fetchLeadershipSignoff(type) {
    return Promise.all([
      fetch("/api/noor/staff", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.json().then(function (body) {
          return response.ok && body && Array.isArray(body.people) ? body.people : [];
        });
      }).catch(function () {
        return [];
      }),
      fetch("/api/session/leadership", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.json().then(function (body) {
          return response.ok && body ? body : {};
        });
      }).catch(function () {
        return {};
      }),
      fetch("/api/session/leadership/signatures", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.json().then(function (body) {
          return response.ok && body && body.signatures ? body.signatures : {};
        });
      }).catch(function () {
        return {};
      })
    ]).then(function (result) {
      return councilLeadershipColumns(type, result[0], result[1], result[2]);
    });
  }
  if (window.AJPrint) {
    window.AJPrint.leadership = fetchLeadershipSignoff;
  }

  var COUNCIL_REVIEW = {
    admin: "أعمال المدرسة المعروضة",
    achievement: "ما يتعلق بالتحصيل ونواتج التعلم",
    excellence: "ما يتعلق بالتميز والجودة ومؤشرات الأداء",
    guidance: "ما يتعلق بالتوجيه والإرشاد وقواعد السلوك والمواظبة",
    discipline: "ما يتعلق بالانضباط وقواعد السلوك والمواظبة",
    activity: "خطة النشاط والبرامج المعتمدة",
    fund: "شؤون الصندوق والمستندات المعروضة",
    safety: "متطلبات الأمن والسلامة",
    special: "احتياجات التربية الخاصة والدعم"
  };

  var COUNCIL_WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  function councilVoice(type) {
    var key = String(type || "").trim();
    var team = key === "fund" || key === "safety" || key === "special";
    var label = COUNCIL_TYPE_LABELS[key] || (team ? "الفريق" : "اللجنة");
    var register = COUNCIL_REGISTER_MAP[key];
    return {
      team: team,
      opener: (team ? "اجتمع " : "اجتمعت ") + label,
      review: COUNCIL_REVIEW[key] || "ما عُرض في الاجتماع",
      verb: team ? "أقر" : "أقرت",
      recommend: team ? "وأوصى" : "وأوصت",
      subject: team ? "الفريق" : "اللجنة",
      head: team ? "رئيس الفريق" : "رئيس اللجنة",
      register: register ? register.registerLabel : "سجل المجالس"
    };
  }

  function councilWeekday(iso) {
    var date = new Date(String(iso || "") + "T12:00:00");
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return COUNCIL_WEEKDAYS[date.getDay()] || "";
  }

  function stripAttendanceNarration(text) {
    var value = String(text || "");
    value = value.replace(/،?\s*وبحضور الأعضاء الواردة أسماؤهم في كشف الحضور والتوقيعات المرفق بهذا المحضر/g, "");
    value = value.replace(/وقد حضر الاجتماع\s*[:：]?\s*[^.]+\.?/g, "");
    value = value.replace(/وحضر كل من\s*[:：]?\s*[^.]+\.?/g, "");
    value = value.replace(/[ \t]{2,}/g, " ");
    value = value.replace(/\s+([.،])/g, "$1");
    value = value.replace(/\n{3,}/g, "\n\n");
    return value.trim();
  }

  function isCrudeMinutes(text) {
    return /وقد حضر الاجتماع|وحضر كل من|عُقد اجتماع/.test(String(text || ""));
  }

  function councilKeptLines(text) {
    var chunks = String(text || "").replace(/\n+/g, " ").split(/(?<=[.؟!])/);
    var kept = [];
    var follow = "";
    chunks.forEach(function (chunk) {
      var sentence = chunk.replace(/\s+/g, " ").trim();
      if (!sentence) {
        return;
      }
      if (/وقد حضر الاجتماع|وحضر كل من|وبحضور الأعضاء الواردة/.test(sentence)) {
        return;
      }
      if (/^ويُتابع|^ويتابع/.test(sentence)) {
        follow = sentence;
        return;
      }
      if (/^(عُقد|اجتمعت|اجتمع|الحمد|في يوم|وبعد|انتهى الاجتماع|حُرّر|حرر|اطلع الأعضاء)/.test(sentence)) {
        return;
      }
      if (/قررت|أقرت|أقر |أوصت|أوصى|اطلعت|اطلع |راجعت|راجع |تقرر/.test(sentence)) {
        kept.push(sentence);
      }
    });
    return { decisions: kept.join("\n"), follow: follow };
  }

  function draftCouncilMinutes(ctx) {
    ctx = ctx || {};
    var voice = councilVoice(ctx.type);
    var topic = String(ctx.agenda || "").trim();
    var iso = String(ctx.iso || "").trim();
    var hijri = oneEraMark(ctx.hijri || formatCouncilHijri(iso), "هـ");
    var gregorian = oneEraMark(ctx.gregorian || softGregorian(iso), "م");
    var day = councilWeekday(iso);
    var school = schoolNameEl ? String(schoolNameEl.textContent || "").trim() : "";
    var chair = String(ctx.managerName || "").trim();
    var when = "في يوم " + (day || "انعقاد الاجتماع");
    if (hijri) {
      when += " " + hijri;
    }
    if (gregorian) {
      when += "، الموافق " + gregorian;
    }
    var meeting = when + "، " + voice.opener;
    if (school) {
      meeting += " بمدرسة " + school;
    }
    if (chair) {
      meeting += " برئاسة " + chair;
    }
    if (topic) {
      meeting += "، للنظر في «" + topic + "»";
    }
    meeting += ".";
    var decision = String(ctx.decisions || "").trim();
    if (!decision) {
      decision = voice.verb + " " + voice.subject + " «" + (topic || "الموضوع المعروض") + "»، " + voice.recommend + " بمتابعة التنفيذ وفق الأنظمة والتعليمات، على أن يتم التنفيذ في الموعد الذي يعتمده " + voice.head + ".";
    }
    var follow = String(ctx.follow || "").trim();
    if (!follow) {
      follow = "ويُتابع التنفيذ في الموعد الذي يعتمده " + voice.head + ".";
    }
    var seal = "حُرّر هذا المحضر، ويُعتمد بتوقيع الحاضرين، ويُحفظ في «" + voice.register + "».";
    return [
      "الحمد لله رب العالمين، والصلاة والسلام على أشرف الأنبياء والمرسلين.",
      meeting,
      "وبعد الاطلاع على " + voice.review + "؛",
      "انتهى الاجتماع إلى ما يلي:",
      decision,
      follow,
      seal
    ].join("\n\n");
  }

  function councilSpokenMinutes(item, managerName) {
    var raw = item && item.minutes != null ? String(item.minutes) : "";
    var stripped = stripAttendanceNarration(raw);
    if (stripped && /الحمد لله/.test(stripped) && !isCrudeMinutes(raw)) {
      return { text: stripped, standalone: false };
    }
    if (!raw.trim() || isCrudeMinutes(raw) || !stripped) {
      var kept = councilKeptLines(raw);
      return {
        text: draftCouncilMinutes({
          type: item && item.type,
          iso: item && item.iso,
          hijri: item && item.hijri,
          gregorian: item && item.gregorian,
          agenda: item && item.agenda,
          managerName: managerName,
          decisions: kept.decisions,
          follow: kept.follow
        }),
        standalone: true
      };
    }
    return { text: stripped, standalone: false };
  }

  function ensureCouncilChair() {
    if (councilChairName) {
      return Promise.resolve(councilChairName);
    }
    if (councilChairLoading) {
      return councilChairLoading;
    }
    councilChairLoading = Promise.all([
      fetch("/api/noor/staff", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.json().then(function (body) {
          return response.ok && body && Array.isArray(body.people) ? body.people : [];
        });
      }).catch(function () {
        return [];
      }),
      fetch("/api/session/leadership", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.json().then(function (body) {
          return response.ok && body ? body : {};
        });
      }).catch(function () {
        return {};
      })
    ]).then(function (result) {
      var manager = result[1] && result[1].manager ? String(result[1].manager) : "";
      var name = "";
      result[0].forEach(function (person) {
        if (person && String(person.id) === manager && person.name) {
          name = String(person.name);
        }
      });
      councilChairName = name;
      return name;
    });
    return councilChairLoading;
  }

  function refreshCouncilDraft() {
    if (councilEditingId || !councilMinutesEl || !councilTypeEl) {
      return;
    }
    var current = String(councilMinutesEl.value || "").trim();
    if (current && current !== councilDraftStamp) {
      return;
    }
    var draft = draftCouncilMinutes({
      type: councilTypeEl.value,
      iso: councilDateEl ? councilDateEl.value : "",
      agenda: councilAgendaEl ? councilAgendaEl.value : "",
      managerName: councilChairName
    });
    councilDraftStamp = draft;
    councilMinutesEl.value = draft;
  }

  function printCouncilDetail() {
    var item = findCouncilById(pendingCouncilDetailId);
    if (!item) {
      showToast("تعذر العثور على المحضر.", "error");
      return;
    }
    var councilId = item.id != null ? String(item.id) : "";
    Promise.all([
      fetchCouncilSignatures(councilId),
      fetchLeadershipSignoff(item.type)
    ]).then(function (loaded) {
      var images = loaded[0];
      var columns = loaded[1];
      var rows = councilSignoffColumns(item.present, images);
      var chairName = "";
      if (columns.length && columns[columns.length - 1].role === "مدير المدرسة") {
        chairName = columns[columns.length - 1].name || "";
      }
      var spoken = councilSpokenMinutes(item, chairName);
      var plain = spoken.standalone
        ? spoken.text
        : [item.agenda, councilDateLabel(item), spoken.text].map(function (part) {
          return String(part || "").trim();
        }).filter(Boolean).join("\n");
      var core = window.OfficialFrameCore;
      var esc = core && typeof core.escapeHtml === "function"
        ? function (value) { return core.escapeHtml(value); }
        : function (value) { return String(value || ""); };
      var pages = [];
      var perPage = 18;
      var rowMm = 8;
      var firstBudget = 148;
      var textPages = councilFlowPages(plain, firstBudget, 168);
      function textHtml(chunk) {
        return "<p class=\"aj-minutes-prose\">" + esc(chunk) + "</p>";
      }
      var cursor = 0;
      if (textPages.length === 1) {
        var probe = councilTextProbe();
        var used = councilTextMillimeters(probe, textPages[0]);
        document.body.removeChild(probe);
        var slots = Math.floor((firstBudget - used) / rowMm);
        var firstData = rows.length && slots >= 2 ? Math.min(rows.length, slots - 1) : 0;
        pages.push(textHtml(textPages[0]) + councilAttendanceTableFrom(rows.slice(0, firstData), false));
        cursor = firstData;
      } else {
        textPages.forEach(function (chunk) {
          pages.push(textHtml(chunk));
        });
      }
      var tableContinued = cursor > 0;
      for (; cursor < rows.length; cursor += perPage) {
        pages.push(councilAttendanceTableFrom(rows.slice(cursor, cursor + perPage), tableContinued));
        tableContinued = true;
      }
      if (!pages.length) {
        pages.push("");
      }
      window.dispatchEvent(
        new CustomEvent("app:council:printed", {
          detail: { id: councilId }
        })
      );
      printCouncilFrames(
        councilTypeLabel(item.type),
        String(item.agenda || "").trim() || councilTypeLabel(item.type),
        pages,
        { columns: columns }
      );
    });
  }

  function printTaskDetail() {
    var task = findTaskById(pendingDetailId);
    if (!task) {
      showToast("تعذر العثور على المهمة.", "error");
      return;
    }
    var status = mapStatusTag(task.status);
    var priority = mapPriority(task.priority);
    var when = taskDateLabel(task);
    var plain = [
      status && status.label ? status.label : "",
      task.priority && priority ? "الأولوية: " + priority.label : "",
      when && when !== "—" ? "التاريخ: " + when : "",
      task.description || ""
    ].map(function (part) {
      return String(part || "").trim();
    }).filter(Boolean).join("\n");
    var core = window.OfficialFrameCore;
    var esc = core && typeof core.escapeHtml === "function"
      ? function (value) { return core.escapeHtml(value); }
      : function (value) { return String(value || ""); };
    var chunks = councilFlowPages(plain, 180, 205);
    var pages = chunks.map(function (chunk) {
      return "<p>" + esc(chunk) + "</p>";
    });
    if (!pages.length) {
      pages.push("");
    }
    printCouncilFrames(task.title || "مهمة", task.title || "مهمة", pages, { signoff: false });
  }

  function setCouncilFormMode(editing) {
    var title = document.getElementById("aj-council-form-title");
    if (title) {
      title.textContent = editing ? "تعديل محضر" : "إضافة محضر مجلس";
    }
    if (councilSaveBtn) {
      councilSaveBtn.textContent = editing ? "حفظ التعديل" : "حفظ المحضر";
    }
  }

  function openCouncilForm() {
    if (!councilModalEl) {
      return;
    }
    councilEditingId = "";
    setCouncilFormMode(false);
    if (councilFormEl) {
      councilFormEl.reset();
    }
    setHidden(councilFormErrorEl, true);
    if (councilDateEl && !councilDateEl.value) {
      var today = new Date();
      var month = String(today.getMonth() + 1);
      var day = String(today.getDate());
      if (month.length < 2) {
        month = "0" + month;
      }
      if (day.length < 2) {
        day = "0" + day;
      }
      councilDateEl.value = today.getFullYear() + "-" + month + "-" + day;
    }
    councilDraftStamp = "";
    councilModalEl.hidden = false;
    document.body.classList.add("aj-modal-open");
    var seedIds = window.AjCommittees && typeof window.AjCommittees.memberIds === "function" && councilTypeEl
      ? window.AjCommittees.memberIds(councilTypeEl.value)
      : [];
    loadCouncilPresentChoices(seedIds);
    ensureCouncilChair().then(function () {
      refreshCouncilDraft();
    });
    if (councilTypeEl) {
      councilTypeEl.focus();
    }
  }

  function closeCouncilForm() {
    if (!councilModalEl) {
      return;
    }
    councilModalEl.hidden = true;
    document.body.classList.remove("aj-modal-open");
    setHidden(councilFormErrorEl, true);
    if (councilSaveBtn) {
      councilSaveBtn.disabled = false;
    }
    councilSaveInFlight = false;
    councilEditingId = "";
    setCouncilFormMode(false);
  }

  function openCouncilEditor(item) {
    if (!councilModalEl || !item || item.id == null) {
      return;
    }
    councilEditingId = String(item.id);
    setCouncilFormMode(true);
    setHidden(councilFormErrorEl, true);
    if (councilTypeEl) {
      councilTypeEl.value = String(item.type || "");
    }
    if (councilDateEl) {
      councilDateEl.value = String(item.iso || "");
    }
    if (councilAgendaEl) {
      councilAgendaEl.value = String(item.agenda || "");
    }
    if (councilMinutesEl) {
      councilMinutesEl.value = item.minutes != null ? String(item.minutes) : "";
    }
    councilDraftStamp = councilMinutesEl ? String(councilMinutesEl.value || "").trim() : "";
    councilModalEl.hidden = false;
    document.body.classList.add("aj-modal-open");
    var selected = (Array.isArray(item.present) ? item.present : []).map(function (person) {
      return person && person.id;
    });
    loadCouncilPresentChoices(selected);
    if (councilTypeEl) {
      councilTypeEl.focus();
    }
  }

  function deleteCouncil(item) {
    if (!item || item.id == null) {
      return;
    }
    var label = councilTypeLabel(item.type);
    if (!window.confirm("حذف محضر " + label + "؟")) {
      return;
    }
    fetch("/api/session/councils/" + encodeURIComponent(String(item.id)), {
      method: "DELETE",
      headers: authHeaders()
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error(apiErrorMessage(body, "تعذر حذف المحضر."));
        }
        return body;
      });
    }).then(function () {
      councilsLoaded = false;
      councilsCache = null;
      loadCouncils({ force: true });
      showToast("تم الحذف", "info");
      window.dispatchEvent(new CustomEvent("app:council:deleted", { detail: { id: String(item.id) } }));
    }).catch(function (error) {
      showToast((error && error.message) || "تعذر حذف المحضر.", "error");
    });
  }

  function formatCouncilGregorian(iso) {
    var date = new Date(String(iso || "") + "T12:00:00");
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    try {
      return date.toLocaleDateString("ar-SA", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }) + "م";
    } catch (error) {
      return String(iso);
    }
  }

  window.AjDates = {
    hijri: function (iso) {
      return formatCouncilHijri(iso);
    },
    gregorian: function (iso) {
      return oneEraMark(softGregorian(iso), "م");
    }
  };

  function formatCouncilHijri(iso) {
    var date = new Date(String(iso || "") + "T12:00:00");
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    try {
      return (
        date.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", {
          day: "numeric",
          month: "long",
          year: "numeric"
        }) + "هـ"
      );
    } catch (error) {
      try {
        return (
          date.toLocaleDateString("ar-SA-u-ca-islamic", {
            day: "numeric",
            month: "long",
            year: "numeric"
          }) + "هـ"
        );
      } catch (fallbackError) {
        return "";
      }
    }
  }

  function selectedCouncilPresent() {
    if (!councilPresentListEl) {
      return [];
    }
    return Array.prototype.map.call(
      councilPresentListEl.querySelectorAll("input[type='checkbox']:checked"),
      function (input) {
        return {
          id: String(input.value || "").trim(),
          name: String(input.getAttribute("data-name") || "").trim(),
          role: String(input.getAttribute("data-role") || "").trim()
        };
      }
    ).filter(function (person) {
      return person.id && person.name;
    });
  }

  function renderCouncilPresentChoices(people) {
    if (!councilPresentListEl) {
      return;
    }
    councilPresentListEl.innerHTML = "";
    var list = (Array.isArray(people) ? people : []).filter(function (person) {
      return person && person.active !== false && String(person.id || "").trim() && String(person.name || "").trim();
    });
    if (!list.length) {
      setTextStatus(councilPresentStatusEl, "لا منسوبين محفوظين في السجل.", false);
      setHidden(councilPresentStatusEl, false);
      return;
    }
    setTextStatus(councilPresentStatusEl, "", false);
    setHidden(councilPresentStatusEl, true);
    list.forEach(function (person) {
      var label = document.createElement("label");
      label.className = "aj-checkbox";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.value = String(person.id);
      input.setAttribute("data-name", String(person.name));
      input.setAttribute("data-role", String(person.role || ""));
      var text = document.createElement("span");
      text.textContent = String(person.name) + (person.role ? " — " + String(person.role) : "");
      label.appendChild(input);
      label.appendChild(text);
      councilPresentListEl.appendChild(label);
    });
  }

  function loadCouncilPresentChoices(selectedIds) {
    if (!councilPresentListEl) {
      return;
    }
    councilPresentListEl.innerHTML = "";
    setTextStatus(councilPresentStatusEl, "جارٍ قراءة سجل المنسوبين...", false);
    setHidden(councilPresentStatusEl, false);
    fetch("/api/noor/staff", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok || !payload || !Array.isArray(payload.people)) {
            throw new Error("staff");
          }
          return payload.people;
        });
      })
      .then(function (people) {
        renderCouncilPresentChoices(people);
        var chosen = {};
        (selectedIds || []).forEach(function (identity) {
          chosen[String(identity)] = true;
        });
        if (councilPresentListEl) {
          Array.prototype.forEach.call(councilPresentListEl.querySelectorAll("input"), function (input) {
            input.checked = !!chosen[input.value];
          });
        }
      })
      .catch(function () {
        if (councilPresentListEl) {
          councilPresentListEl.innerHTML = "";
        }
        setTextStatus(councilPresentStatusEl, "تعذر قراءة سجل المنسوبين.", true);
        setHidden(councilPresentStatusEl, false);
      });
  }

  function buildCouncilRecordFromForm() {
    var type = councilTypeEl ? String(councilTypeEl.value || "").trim() : "";
    var iso = councilDateEl ? String(councilDateEl.value || "").trim() : "";
    var agenda = councilAgendaEl ? String(councilAgendaEl.value || "").trim() : "";
    var minutesText = councilMinutesEl ? String(councilMinutesEl.value || "").trim() : "";
    if (!type) {
      throw new Error("اختر نوع المجلس.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      throw new Error("اختر تاريخ الاجتماع.");
    }
    if (!agenda) {
      throw new Error("أدخل موضوع الاجتماع.");
    }
    if (!minutesText) {
      throw new Error("أدخل نص المحضر.");
    }
    var register = COUNCIL_REGISTER_MAP[type] || COUNCIL_REGISTER_MAP.admin;
    return {
      id: "council-" + Date.now(),
      type: type,
      hijri: formatCouncilHijri(iso),
      gregorian: formatCouncilGregorian(iso),
      iso: iso,
      agenda: agenda,
      present: selectedCouncilPresent(),
      decisions: "",
      minutes: minutesText,
      addition: "",
      followHijri: "",
      followGregorian: "",
      followIso: "",
      registerKey: register.registerKey,
      registerLabel: register.registerLabel,
      dayKey: iso,
      evidenceCount: 0
    };
  }

  function submitCouncilForm() {
    if (councilSaveInFlight) {
      return;
    }
    setHidden(councilFormErrorEl, true);
    var record;
    try {
      record = buildCouncilRecordFromForm();
    } catch (error) {
      if (councilFormErrorEl) {
        councilFormErrorEl.hidden = false;
        councilFormErrorEl.textContent = error.message || "تحقق من الحقول.";
      }
      return;
    }
    councilSaveInFlight = true;
    if (councilSaveBtn) {
      councilSaveBtn.disabled = true;
    }
    var editing = councilEditingId;
    var request = editing
      ? fetch("/api/session/councils/" + encodeURIComponent(editing), {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          type: record.type,
          hijri: record.hijri,
          gregorian: record.gregorian,
          iso: record.iso,
          agenda: record.agenda,
          present: record.present,
          minutes: record.minutes,
          registerKey: record.registerKey,
          registerLabel: record.registerLabel,
          dayKey: record.dayKey
        })
      }).then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر حفظ التعديل."));
          }
          return body;
        });
      })
      : softFetch("/api/councils")
        .then(function (payload) {
          if (!payload) {
            throw new Error("تعذر قراءة المحاضر الحالية قبل الحفظ.");
          }
          var list = Array.isArray(payload.minutes) ? payload.minutes.slice() : [];
          list.push(record);
          return fetch("/api/councils", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ minutes: list })
          }).then(function (response) {
            return response.json().then(function (body) {
              if (!response.ok) {
                throw new Error(apiErrorMessage(body, "تعذر حفظ المحضر."));
              }
              return body;
            });
          });
        });
    request
      .then(function (body) {
        if (editing) {
          councilsLoaded = false;
          councilsCache = null;
          loadCouncils({ force: true });
          window.dispatchEvent(new CustomEvent("app:council:updated", { detail: { id: editing } }));
          closeCouncilForm();
          showToast("تم حفظ التعديل", "success");
          return;
        }
        console.log("Council Created:", body);
        var minutes = Array.isArray(body.minutes) ? body.minutes : null;
        if (minutes) {
          councilsCache = { minutes: minutes };
          councilsLoaded = true;
          buildCouncilCards(minutes);
        } else {
          councilsLoaded = false;
          councilsCache = null;
          loadCouncils({ force: true });
        }
        window.dispatchEvent(
          new CustomEvent("app:council:created", {
            detail: { id: record.id }
          })
        );
        closeCouncilForm();
        showToast("تم إضافة المحضر بنجاح", "success");
      })
      .catch(function (error) {
        if (councilFormErrorEl) {
          councilFormErrorEl.hidden = false;
          councilFormErrorEl.textContent = error.message || "تعذر حفظ المحضر.";
        }
        showToast(error.message || "تعذر حفظ المحضر.", "error");
      })
      .finally(function () {
        councilSaveInFlight = false;
        if (councilSaveBtn) {
          councilSaveBtn.disabled = false;
        }
      });
  }

  var deliverSaveInFlight = false;
  var deliverableStaff = [];
  var DELIVERABLE_LABELS = {
    plan: "الخطة الدراسية",
    prep: "التحضير اليومي",
    visits: "الزيارات الصفية",
    tests: "أدوات التقويم",
    results: "تحليل النتائج",
    portfolio: "ملف إنجاز المعلم",
    growth: "التطوير المهني"
  };

  function deliverableDateLine(iso) {
    var hijri = oneEraMark(formatCouncilHijri(iso), "هـ");
    var gregorian = oneEraMark(softGregorian(iso), "م");
    if (hijri && gregorian) {
      return hijri + "، الموافق " + gregorian;
    }
    return hijri || gregorian || String(iso || "");
  }

  function deliverUnit(node) {
    return node && node.closest ? node.closest(".aj-deliver-unit") : null;
  }

  function deliverKind(unit) {
    return unit ? String(unit.getAttribute("data-deliver-kind") || "") : "";
  }

  function deliverLabel(kind) {
    return DELIVERABLE_LABELS[kind] || "تسليم";
  }

  function deliverNotice(unit, text, isError) {
    var box = unit ? unit.querySelector(".aj-deliver-feedback") : null;
    if (box) {
      box.hidden = !text;
      box.textContent = text || "";
      box.classList.toggle("is-error", !!isError);
      box.classList.toggle("is-ok", !!text && !isError);
    }
    if (text) {
      showToast(text, isError ? "error" : "success");
    }
  }

  function renderDeliverableList(unit, items) {
    if (!unit) {
      return;
    }
    var list = unit.querySelector(".aj-deliver-list");
    var empty = unit.querySelector(".aj-deliver-empty");
    if (!list) {
      return;
    }
    var kind = deliverKind(unit);
    var rows = items || [];
    list.innerHTML = "";
    if (empty) {
      empty.hidden = rows.length > 0;
    }
    rows.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "aj-card";
      li.setAttribute("data-deliver-id", String(item.id || ""));
      li.setAttribute("data-teacher-name", item.teacher_name || "");
      li.setAttribute("data-subject", item.subject || "");
      li.setAttribute("data-upload-date", item.upload_date || "");
      li.setAttribute("data-notes", item.notes || "");
      li.setAttribute("data-original-name", item.original_name || "");
      li.setAttribute("data-file-name", item.file_name || "");
      li.setAttribute("data-deliver-kind", item.deliverable_type || kind);
      li.setAttribute("data-byte-size", String(item.byte_size != null ? item.byte_size : ""));
      li.setAttribute("data-displayable", item.displayable === false ? "0" : "1");
      li.setAttribute("data-file-kind", item.file_kind || "");
      var title = document.createElement("p");
      title.textContent = item.teacher_name || "";
      var fileName = document.createElement("p");
      fileName.textContent = item.file_name || item.original_name || "";
      var meta = document.createElement("p");
      meta.className = "aj-card-meta";
      meta.textContent = deliverableDateLine(item.upload_date);
      var actions = document.createElement("div");
      actions.className = "aj-task-actions";
      var download = document.createElement("button");
      download.type = "button";
      download.className = "aj-detail-btn";
      download.textContent = "تنزيل";
      download.addEventListener("click", function () {
        downloadDeliverable(item);
      });
      var preview = document.createElement("button");
      preview.type = "button";
      preview.className = "aj-detail-btn aj-detail-btn-secondary";
      preview.textContent = "معاينة";
      preview.addEventListener("click", function () {
        previewDeliverable(item);
      });
      var printCard = document.createElement("button");
      printCard.type = "button";
      printCard.className = "aj-detail-btn aj-detail-btn-secondary";
      printCard.textContent = "طباعة";
      printCard.addEventListener("click", function () {
        printDeliverableCard(item);
      });
      var evidenceBtn = document.createElement("button");
      evidenceBtn.type = "button";
      evidenceBtn.className = "aj-detail-btn aj-detail-btn-secondary";
      evidenceBtn.textContent = "إرفاق كشاهد";
      evidenceBtn.addEventListener("click", function () {
        attachDeliverableEvidence(item);
      });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "aj-council-delete";
      remove.textContent = "حذف";
      remove.addEventListener("click", function () {
        deleteDeliverable(item);
      });
      actions.appendChild(preview);
      actions.appendChild(download);
      actions.appendChild(printCard);
      actions.appendChild(evidenceBtn);
      actions.appendChild(remove);
      li.appendChild(title);
      li.appendChild(fileName);
      li.appendChild(meta);
      if (item.notes) {
        var note = document.createElement("p");
        note.textContent = String(item.notes);
        li.appendChild(note);
      }
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function fillDeliverableSubject(select) {
    var form = select && select.form ? select.form : null;
    var subject = form ? form.querySelector(".aj-deliver-subject") : null;
    if (!subject) {
      return;
    }
    var identity = String(select.value || "").trim();
    if (!identity) {
      return;
    }
    var specialty = "";
    var i;
    for (i = 0; i < deliverableStaff.length; i += 1) {
      var person = deliverableStaff[i];
      if (person && String(person.id || "") === identity) {
        specialty = String(person.specialty || "").trim();
        break;
      }
    }
    if (specialty) {
      subject.value = specialty;
    }
  }

  function fillDeliverableTeachers(people) {
    deliverableStaff = people || [];
    var count = 0;
    Array.prototype.forEach.call(document.querySelectorAll(".aj-deliver-teacher"), function (teacherSelect) {
      var current = teacherSelect.value;
      teacherSelect.innerHTML = "";
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "اختر المعلم";
      teacherSelect.appendChild(empty);
      count = 0;
      (people || []).forEach(function (person) {
        if (!person || person.active === false || !person.id || !person.name) {
          return;
        }
        var option = document.createElement("option");
        option.value = String(person.id);
        option.textContent = String(person.name);
        teacherSelect.appendChild(option);
        count += 1;
      });
      if (current) {
        teacherSelect.value = current;
      }
      var role = currentUser && currentUser.role ? String(currentUser.role) : "";
      var selfId = currentUser && currentUser.id ? String(currentUser.id) : "";
      if (selfId && role.indexOf("مدير") !== 0) {
        if (!teacherSelect.querySelector("option[value=\"" + selfId + "\"]")) {
          var selfOpt = document.createElement("option");
          selfOpt.value = selfId;
          selfOpt.textContent = currentUser.name || selfId;
          teacherSelect.appendChild(selfOpt);
        }
        teacherSelect.value = selfId;
        teacherSelect.disabled = true;
        fillDeliverableSubject(teacherSelect);
      }
    });
    return count;
  }

  function collectDeliverableCards(unit, skipId) {
    var list = unit ? unit.querySelector(".aj-deliver-list") : null;
    var current = [];
    if (!list) {
      return current;
    }
    Array.prototype.forEach.call(list.querySelectorAll("[data-deliver-id]"), function (node) {
      if (skipId && node.getAttribute("data-deliver-id") === String(skipId)) {
        return;
      }
      current.push({
        id: node.getAttribute("data-deliver-id"),
        teacher_name: node.getAttribute("data-teacher-name") || "",
        subject: node.getAttribute("data-subject") || "",
        upload_date: node.getAttribute("data-upload-date") || "",
        notes: node.getAttribute("data-notes") || "",
        original_name: node.getAttribute("data-original-name") || "",
        file_name: node.getAttribute("data-file-name") || "",
        deliverable_type: node.getAttribute("data-deliver-kind") || deliverKind(unit),
        byte_size: Number(node.getAttribute("data-byte-size") || 0),
        displayable: node.getAttribute("data-displayable") !== "0",
        file_kind: node.getAttribute("data-file-kind") || ""
      });
    });
    return current;
  }

  function refreshDeliverableCards() {
    var status = document.getElementById("aj-deliver-status");
    fetch("/api/session/teacher-deliverables", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر قراءة التسليمات."));
          }
          return body;
        });
      })
      .then(function (body) {
        var grouped = {};
        ((body && body.items) || []).forEach(function (item) {
          var kind = String((item && item.deliverable_type) || "");
          if (!grouped[kind]) {
            grouped[kind] = [];
          }
          grouped[kind].push(item);
        });
        Array.prototype.forEach.call(document.querySelectorAll(".aj-deliver-unit"), function (unit) {
          renderDeliverableList(unit, grouped[deliverKind(unit)] || []);
        });
      })
      .catch(function (error) {
        var saved = document.querySelector(".aj-deliver-feedback.is-ok");
        if (saved) {
          return;
        }
        setTextStatus(status, (error && error.message) || "تعذر قراءة التسليمات.", true);
      });
  }

  function loadDeliverables() {
    var status = document.getElementById("aj-deliver-status");
    fetch("/api/noor/staff", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok || !body || !Array.isArray(body.people)) {
            throw new Error(apiErrorMessage(body, "تعذر قراءة سجل المنسوبين."));
          }
          return body.people;
        });
      })
      .then(function (people) {
        fillDeliverableTeachers(people);
      })
      .catch(function (error) {
        setTextStatus(status, (error && error.message) || "تعذر قراءة سجل المنسوبين.", true);
      });
    fetch("/api/settings", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json();
      })
      .then(function (settings) {
        var year = String((settings && settings.academic_year) || "").trim();
        Array.prototype.forEach.call(document.querySelectorAll(".aj-deliver-year"), function (yearInput) {
          yearInput.value = year;
        });
        if (!year) {
          setTextStatus(status, "العام الدراسي غير محفوظ.", true);
        }
      })
      .catch(function () {
        setTextStatus(status, "تعذر قراءة العام الدراسي.", true);
      });
    refreshDeliverableCards();
  }

  function submitDeliverable(event) {
    event.preventDefault();
    if (deliverSaveInFlight) {
      return;
    }
    var form = event.currentTarget;
    var unit = deliverUnit(form);
    var kind = deliverKind(unit);
    var label = deliverLabel(kind);
    var teacher = form.querySelector(".aj-deliver-teacher");
    var subject = form.querySelector(".aj-deliver-subject");
    var yearInput = form.querySelector(".aj-deliver-year");
    var fileInput = form.querySelector(".aj-deliver-file");
    var notes = form.querySelector(".aj-deliver-notes");
    var year = yearInput ? String(yearInput.value || "").trim() : "";
    var file = fileInput && fileInput.files ? fileInput.files[0] : null;
    if (!kind) {
      deliverNotice(unit, "نوع التسليم غير معروف.", true);
      return;
    }
    if (!year) {
      deliverNotice(unit, "العام الدراسي غير محفوظ.", true);
      return;
    }
    if (!teacher || !teacher.value || !subject || !String(subject.value || "").trim()) {
      deliverNotice(unit, "اختر المعلم وأدخل المادة.", true);
      return;
    }
    if (!file) {
      deliverNotice(unit, "اختر الملف.", true);
      return;
    }
    var allowed = ["application/pdf", "image/jpeg", "image/png", "application/octet-stream", ""];
    var name = String(file.name || "").toLowerCase();
    var extensionOk = /\.(pdf|jpg|jpeg|png)$/.test(name);
    if (!extensionOk || allowed.indexOf(file.type || "") === -1 || file.size > 10 * 1024 * 1024) {
      deliverNotice(unit, file.size > 10 * 1024 * 1024 ? "تعذر الحفظ، الملف أكبر من 10 ميجابايت." : "تعذر الحفظ، الملف يجب أن يكون PDF أو JPG أو PNG.", true);
      return;
    }
    var body = new FormData();
    body.append("teacher_id", teacher.value);
    body.append("subject", String(subject.value || "").trim());
    body.append("notes", notes ? String(notes.value || "") : "");
    body.append("deliverable_type", kind);
    body.append("academic_year", year);
    body.append("upload", file);
    deliverSaveInFlight = true;
    fetch("/api/session/teacher-deliverables", {
      method: "POST",
      headers: multipartAuthHeaders(),
      body: body
    }).then(function (response) {
      return response.text().then(function (text) {
        var payload = {};
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch (parseError) {
            payload = {};
          }
        }
        if (!response.ok) {
          throw new Error(apiErrorMessage(payload, "حدث خطأ في الخادم."));
        }
        return payload;
      });
    }).then(function (payload) {
      if (subject) {
        subject.value = "";
      }
      if (notes) {
        notes.value = "";
      }
      if (fileInput) {
        fileInput.value = "";
      }
      deliverNotice(unit, "تم حفظ " + label + " بنجاح", false);
      renderDeliverableList(unit, [payload].concat(collectDeliverableCards(unit, payload && payload.id)));
      refreshDeliverableCards();
    }).catch(function (error) {
      deliverNotice(unit, (error && error.message) || "حدث خطأ في الخادم.", true);
    }).finally(function () {
      deliverSaveInFlight = false;
    });
  }

  function deliverableMime(name, blobType) {
    var type = String(blobType || "").split(";")[0].trim();
    if (type === "application/pdf" || type === "image/jpeg" || type === "image/png") {
      return type;
    }
    var lower = String(name || "").toLowerCase();
    if (/\.pdf$/.test(lower)) {
      return "application/pdf";
    }
    if (/\.png$/.test(lower)) {
      return "image/png";
    }
    if (/\.jpe?g$/.test(lower)) {
      return "image/jpeg";
    }
    return type || "application/octet-stream";
  }

  function downloadDeliverable(item, asPreview) {
    var suffix = asPreview ? "" : "?download=1";
    var headers = authHeaders();
    if (asPreview) {
      headers.Accept = "application/octet-stream";
    }
    fetch("/api/session/teacher-deliverables/" + encodeURIComponent(String(item.id)) + "/file" + suffix, {
      headers: headers,
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error(asPreview ? "تعذر فتح الملف." : "تعذر تنزيل الملف.");
      }
      return response.blob().then(function (blob) {
        var knownSize = Number(item && item.byte_size != null ? item.byte_size : 0);
        var name = item.file_name || item.original_name || (deliverLabel(item.deliverable_type) + ".pdf");
        var mime = deliverableMime(name, blob.type);
        if (blob.size < 500) {
          if (knownSize >= 500) {
            throw new Error("تعذر جلب الملف للمعاينة. أوقف مدير التحميل (سكر) لهذه الصفحة ثم أعد المحاولة.");
          }
          throw new Error("الملف تالف ولا يُعرض.");
        }
        var typed = new Blob([blob], { type: mime });
        var url = URL.createObjectURL(typed);
        if (asPreview) {
          openFilePreview({
            title: name,
            filename: name,
            blob: typed,
            url: url,
            pdf: mime === "application/pdf"
          });
          return;
        }
        var link = document.createElement("a");
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 4000);
      });
    }).catch(function (error) {
      showToast((error && error.message) || "تعذر تنزيل الملف.", "error");
    });
  }

  function previewDeliverable(item) {
    var size = Number(item && item.byte_size != null ? item.byte_size : 0);
    if (item && item.displayable === false && size > 0 && size < 500) {
      showToast("الملف تالف ولا يُعرض.", "error");
      return;
    }
    downloadDeliverable(item, true);
  }

  function openDeliverablePreview(item, blob, url) {
    openFilePreview({
      title: item.file_name || item.original_name || "معاينة",
      filename: item.file_name || item.original_name || "ملف",
      blob: blob,
      url: url
    });
  }

  function closeDeliverablePreview() {
    closeFilePreview();
  }

  function attachDeliverableEvidence(item) {
    if (!item || !item.id) {
      return;
    }
    fetch("/api/session/teacher-deliverables/" + encodeURIComponent(String(item.id)) + "/evidence", {
      method: "POST",
      headers: authHeaders()
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error(apiErrorMessage(body, "تعذر إرفاق الشاهد."));
        }
        return body;
      });
    }).then(function () {
      showToast("أُرفق التسليم كشاهد.", "success");
      loadEvidence({ force: true });
    }).catch(function (error) {
      showToast((error && error.message) || "تعذر إرفاق الشاهد.", "error");
    });
  }

  function letterheadPrintOpts(letter) {
    var opts = {};
    var files = letter && letter.files ? letter.files : {};
    if (files.ministry && files.ministry.dataUrl) {
      opts.ministryLogo = files.ministry.dataUrl;
    }
    if (files.vision && files.vision.dataUrl) {
      opts.visionLogo = files.vision.dataUrl;
    }
    return opts;
  }

  function fetchLetterheadAssets() {
    return fetch("/api/session/letterhead", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          return response.ok ? body : { files: {}, stamp_note: "" };
        });
      })
      .then(function (letter) {
        var slots = ["ministry", "vision", "stamp"];
        return Promise.all(slots.map(function (slot) {
          var meta = letter.files && letter.files[slot];
          if (!meta || !meta.displayable || !meta.file_url) {
            return null;
          }
          return fetch(meta.file_url, { headers: authHeaders() }).then(function (response) {
            if (!response.ok) {
              return null;
            }
            return response.blob().then(function (blob) {
              if (blob.size < 500) {
                return null;
              }
              return new Promise(function (resolve) {
                var reader = new FileReader();
                reader.onload = function () {
                  resolve({ slot: slot, dataUrl: reader.result });
                };
                reader.onerror = function () {
                  resolve(null);
                };
                reader.readAsDataURL(blob);
              });
            });
          }).catch(function () {
            return null;
          });
        })).then(function (loaded) {
          loaded.forEach(function (item) {
            if (!item || !letter.files[item.slot]) {
              return;
            }
            letter.files[item.slot].dataUrl = item.dataUrl;
          });
          return letter;
        });
      })
      .catch(function () {
        return { files: {}, stamp_note: "" };
      });
  }

  function printDeliverableCard(item) {
    var core = window.OfficialFrameCore;
    if (!core || typeof core.page !== "function") {
      showToast("نواة الطباعة غير محمّلة.", "error");
      return;
    }
    var esc = core.escapeHtml;
    Promise.all([
      fetchLeadershipSignoff("admin"),
      fetchLetterheadAssets(),
      item.displayable && item.file_kind === "image"
        ? fetch("/api/session/teacher-deliverables/" + encodeURIComponent(String(item.id)) + "/file", {
          headers: authHeaders()
        }).then(function (response) {
          if (!response.ok) {
            return "";
          }
          return response.blob().then(function (blob) {
            if (blob.size < 500) {
              return "";
            }
            return new Promise(function (resolve) {
              var reader = new FileReader();
              reader.onload = function () {
                resolve(reader.result || "");
              };
              reader.onerror = function () {
                resolve("");
              };
              reader.readAsDataURL(blob);
            });
          });
        }).catch(function () {
          return "";
        })
        : Promise.resolve("")
    ]).then(function (loaded) {
      var columns = loaded[0] || [];
      var letter = loaded[1] || {};
      var image = loaded[2] || "";
      var stamp = letter.files && letter.files.stamp && letter.files.stamp.dataUrl ? letter.files.stamp.dataUrl : "";
      var body = "<p>النوع: " + esc(deliverLabel(item.deliverable_type)) + "</p>"
        + "<p>المعلم: " + esc(item.teacher_name || "") + "</p>"
        + "<p>المادة: " + esc(item.subject || "") + "</p>"
        + "<p>العام الدراسي: " + esc(item.academic_year || "") + "</p>"
        + "<p>التاريخ: " + esc(deliverableDateLine(item.upload_date)) + "</p>"
        + (item.notes ? "<p>ملاحظة: " + esc(item.notes) + "</p>" : "")
        + (image
          ? "<figure class=\"aj-deliver-print-tile\"><img src=\"" + image + "\" alt=\"\"></figure>"
          : "")
        + (stamp
          ? "<figure class=\"aj-deliver-print-tile aj-stamp-tile\"><img src=\"" + stamp + "\" alt=\"\"></figure>"
            + (letter.stamp_note ? "<p>" + esc(letter.stamp_note) + "</p>" : "")
          : "");
      var html = core.page(Object.assign({
        strictIdentity: true,
        title: "بطاقة تسليم — " + deliverLabel(item.deliverable_type),
        bodyHtml: body,
        school: schoolNameEl ? String(schoolNameEl.textContent || "").trim() : "",
        signoff: true,
        columns: columns,
        page: 1,
        total: 1
      }, letterheadPrintOpts(letter)));
      showOfficialPreview(html, {
        pdfTitle: "بطاقة تسليم - " + deliverLabel(item.deliverable_type),
        arm: {}
      });
    }).catch(function () {
      showToast("تعذر تجهيز بطاقة التسليم.", "error");
    });
  }

  function deleteDeliverable(item) {
    var label = "حذف " + deliverLabel(item.deliverable_type) + " للمعلم " + (item.teacher_name || "") + "؟";
    if (!window.confirm(label)) {
      return;
    }
    fetch("/api/session/teacher-deliverables/" + encodeURIComponent(String(item.id)), {
      method: "DELETE",
      headers: authHeaders()
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error(apiErrorMessage(body, "تعذر حذف التسليم."));
        }
        return body;
      });
    }).then(function () {
      showToast("تم الحذف", "info");
      loadDeliverables();
      loadEvidence({ force: true });
    }).catch(function (error) {
      showToast((error && error.message) || "تعذر حذف التسليم.", "error");
    });
  }

  function evidenceFileData(item) {
    if (item && item.dataUrl && String(item.kind || "") === "image") {
      return Promise.resolve(item.dataUrl);
    }
    if (!item || !item.id || item._deliverable) {
      return Promise.resolve("");
    }
    return fetch(evidenceSessionFileUrl(item.id), { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("تعذر قراءة الشاهد.");
        }
        return response.blob();
      })
      .then(function (blob) {
        if (!blob || blob.size < 500) {
          return "";
        }
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function () { resolve(String(reader.result || "")); };
          reader.onerror = function () { resolve(""); };
          reader.readAsDataURL(blob);
        });
      });
  }

  function evidenceWide(dataUrl) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        resolve(img.naturalWidth > img.naturalHeight);
      };
      img.onerror = function () {
        resolve(false);
      };
      img.src = dataUrl;
    });
  }

  function printEvidenceWitness(item) {
    var kind = String(item && item.kind || "");
    if (kind !== "image" && kind !== "pdf") {
      showToast("هذا النوع لا يُدرج في قالب.", "error");
      return;
    }
    var type = String(item.entity_type || "");
    var key = String(item.entity_key || "");
    evidenceFileData(item).then(function (fileUrl) {
      if (!fileUrl) {
        showToast("لا ملف صالح للإدراج.", "error");
        return null;
      }
      if (type === "program") {
        var id = key.replace(/^program-/, "");
        return fetch("/api/session/programs/" + encodeURIComponent(id), {
          headers: authHeaders(),
          cache: "no-store"
        }).then(function (response) {
          return response.json().then(function (payload) {
            if (!response.ok) {
              throw new Error(apiErrorMessage(payload, "تعذر تحميل البرنامج."));
            }
            return printCurrentProgramCard(false, {
              record: payload,
              images: kind === "image" ? [{ dataUrl: fileUrl }] : [],
              evidence: [],
              files: kind === "pdf" ? [item] : []
            });
          });
        });
      }
      if (type === "register" && window.AjEnvEvidence && typeof window.AjEnvEvidence.printLinked === "function") {
        return window.AjEnvEvidence.printLinked(key, {
          url: fileUrl,
          kind: kind,
          name: item.name || ""
        }).then(function (linked) {
          if (!linked) {
            showToast("لا قالب محفوظ لهذا السجل.", "error");
          }
        });
      }
      showToast("لا قالب محفوظ لهذا الربط.", "error");
      return null;
    }).catch(function (error) {
      showToast((error && error.message) || "تعذر استدعاء القالب.", "error");
    });
  }

  function previewEvidenceCard(item) {
    if (item && item._deliverable) {
      previewDeliverable(item);
      return;
    }
    if (item && String(item.kind || "") === "link" && item.url) {
      window.open(item.url, "_blank", "noopener");
      return;
    }
    previewEvidenceBlob(item);
  }

  function replaceEvidenceCard(item) {
    if (!item || item.id == null || item._deliverable) {
      return;
    }
    var kind = String(item.kind || "");
    if (kind === "link") {
      showToast("احذف الرابط ثم أرفق رابطاً جديداً.", "error");
      return;
    }
    var accept = kind === "pdf"
      ? "application/pdf,.pdf"
      : kind === "video"
        ? "video/mp4,video/webm,.mp4,.webm"
        : "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
    var input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) {
        return;
      }
      setUploadSpin(true, "جارٍ استبدال الشاهد...");
      fetch("/api/visual-evidence/delete", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id: Number(item.id) })
      })
        .then(function (response) {
          return response.json().then(function (body) {
            if (!response.ok) {
              throw new Error(apiErrorMessage(body, "تعذر حذف الملف السابق."));
            }
            return body;
          });
        })
        .then(function () {
          return compressImageFile(file);
        })
        .then(function (ready) {
          var form = new FormData();
          form.append("entity_type", item.entity_type || "");
          form.append("entity_key", item.entity_key || "");
          form.append("register_key", item.register_key || evidenceRegisterKey(item.entity_type));
          form.append("files", ready, ready.name || file.name || "evidence.bin");
          return fetch("/api/visual-evidence", {
            method: "POST",
            headers: multipartAuthHeaders(),
            body: form
          }).then(function (response) {
            return response.json().then(function (payload) {
              if (!response.ok) {
                throw new Error(apiErrorMessage(payload, "تعذر رفع الملف البديل."));
              }
              return payload;
            });
          });
        })
        .then(function () {
          showToast("استُبدل الشاهد.", "success");
          return loadEvidence({ force: true });
        })
        .catch(function (error) {
          showToast((error && error.message) || "تعذر الاستبدال.", "error");
          return loadEvidence({ force: true });
        })
        .finally(function () {
          setUploadSpin(false);
        });
    });
    input.click();
  }

  function deleteEvidenceCard(item) {
    if (!item || item.id == null || String(item.id) === "") {
      return;
    }
    var label = item._deliverable
      ? "حذف " + deliverLabel(item.deliverable_type) + " للمعلم " + (item.teacher_name || "") + "؟"
      : "حذف الشاهد «" + (item.name || evidenceEntityLabel(item, {})) + "»؟";
    if (!window.confirm(label)) {
      return;
    }
    var request = item._deliverable
      ? fetch("/api/session/teacher-deliverables/" + encodeURIComponent(String(item.id)), {
          method: "DELETE",
          headers: authHeaders()
        })
      : fetch("/api/visual-evidence/delete", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ id: Number(item.id) })
        });
    request
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر حذف الشاهد."));
          }
          return body;
        });
      })
      .then(function () {
        showToast("تم الحذف", "info");
        if (item._deliverable) {
          loadDeliverables();
        }
        return loadEvidence({ force: true });
      })
      .catch(function (error) {
        showToast((error && error.message) || "تعذر حذف الشاهد.", "error");
      });
  }

  function loadCouncils(options) {
    options = options || {};
    if (options.force) {
      councilsLoaded = false;
      councilsCache = null;
    }
    if (councilsLoading || !execCardsEl) {
      return Promise.resolve(councilsCache);
    }
    if (councilsLoaded && councilsCache) {
      if (!options.silentBoard) {
        buildCouncilCards(councilsCache.minutes || []);
      }
      return Promise.resolve(councilsCache);
    }
    councilsLoading = true;
    setHidden(execLoadingEl, false);
    setTextStatus(execStatusEl, "", false);
    setHidden(execEmptyEl, true);
    setHidden(execSummaryEl, true);
    if (!options.silentBoard) {
      execCardsEl.innerHTML = "";
    }

    return softFetch("/api/councils")
      .then(function (data) {
        console.log("Councils Data:", data);
        if (!data) {
          throw new Error("تعذر عرض سجل المجالس حالياً.");
        }
        var minutes = Array.isArray(data.minutes) ? data.minutes : [];
        councilsCache = { minutes: minutes };
        if (!options.silentBoard) {
          buildCouncilCards(minutes);
        }
        councilsLoaded = true;
        setTextStatus(execStatusEl, "", false);
        window.dispatchEvent(
          new CustomEvent("app:councils:loaded", {
            detail: { count: minutes.length, at: Date.now() }
          })
        );
        return councilsCache;
      })
      .catch(function (error) {
        if (!options.silentBoard) {
          execCardsEl.innerHTML = "";
          setHidden(execEmptyEl, true);
          setHidden(execSummaryEl, true);
          setTextStatus(execStatusEl, error.message || "تعذر عرض المجالس.", true);
        }
        throw error;
      })
      .finally(function () {
        councilsLoading = false;
        setHidden(execLoadingEl, true);
      });
  }

  function evidenceEntityLabel(item, labelsMap) {
    var type = String((item && item.entity_type) || "").trim();
    var key = String((item && item.entity_key) || "").trim();
    var typeLabel = EVIDENCE_ENTITY_LABELS[type] || type || "كيان";
    if (labelsMap && labelsMap[type + "::" + key]) {
      return labelsMap[type + "::" + key];
    }
    if (type === "soft_period" && key.indexOf("|") >= 0) {
      var parts = key.split("|");
      var slot = SOFT_SLOT_LABELS[parts[1]] || parts[1] || "";
      return typeLabel + " · " + slot + (parts[0] ? " · " + parts[0] : "");
    }
    if (type === "program") {
      return typeLabel + " · " + key.replace(/^program-/, "");
    }
    return typeLabel + (key ? " · " + key : "");
  }

  function evidenceDateLabel(value) {
    var raw = String(value || "").trim();
    if (!raw) {
      return "—";
    }
    if (raw.length >= 10 && raw.charAt(4) === "-") {
      return raw.slice(0, 10);
    }
    return raw;
  }

  function collectEvidenceQueries(councilsPayload, programsPayload, softPayload) {
    var queries = [];
    var seen = {};
    var labelsMap = {};

    function pushQuery(entityType, entityKey, label) {
      var type = String(entityType || "").trim();
      var key = String(entityKey || "").trim();
      if (!type || !key) {
        return;
      }
      var token = type + "::" + key;
      if (seen[token]) {
        return;
      }
      seen[token] = true;
      if (label) {
        labelsMap[token] = label;
      }
      queries.push({ entity_type: type, entity_key: key });
    }

    (((councilsPayload && councilsPayload.minutes) || [])).forEach(function (item) {
      pushQuery(
        "council_minutes",
        item.id,
        "محضر مجلس · " + councilTypeLabel(item.type)
      );
    });

    [
      { key: "env-4-1-1-1", label: "سجل · جاهزية الفصول والمعامل والمرافق" },
      { key: "env-4-2-1-1", label: "سجل · تفقد الأمن والسلامة" },
      { key: "env-4-2-1-2", label: "سجل · الصيانة الدورية" },
      { key: "env-4-2-1-3", label: "سجل · النظافة والبيئة المدرسية" },
      { key: "env-4-1-1-3", label: "سجل · المرافق المساندة ووصولية المتعلمين" },
      { key: "eq-2111-1", label: "2-1-1-1 · فرص ومصادر متنوعة" },
      { key: "eq-2111-2", label: "2-1-1-1 · أنشطة تراعي المادة" },
      { key: "eq-2111-3", label: "2-1-1-1 · تكافؤ الاستخدام" },
      { key: "eq-2111-4", label: "2-1-1-1 · الفروق الفردية" },
      { key: "eq-2111-5", label: "2-1-1-1 · سهولة الاستخدام" },
      { key: "eq-2111-6", label: "2-1-1-1 · خبرات الموهوبين" },
      { key: "eq-2111-7", label: "2-1-1-1 · عينة سجل إنجاز" },
      { key: "eq-2111-8", label: "2-1-1-1 · عينة أنشطة صفية" },
      { key: "PILOT-1448-COMM-REL-01", label: "1-3-1-1 · PILOT-1448-COMM-REL-01 بناة الألفة والتعاون" },
      { key: "PILOT-1448-STAFF-QUAL-01", label: "PILOT-1448-STAFF-QUAL-01 دليل اكتمال الكادر التعليمي" },
      { key: "PILOT-1448-ADMIN-TEAM-01", label: "PILOT-1448-ADMIN-TEAM-01 سجل المهام الإدارية" },
      { key: "PILOT-1448-SELF-EVAL-01", label: "1-4-1-3 · PILOT-1448-SELF-EVAL-01 التقويم الذاتي" }
    ].forEach(function (item) {
      pushQuery("register", item.key, item.label);
    });

    (((programsPayload && programsPayload.programs) || [])).forEach(function (item) {
      var id = item.id;
      if (id == null || String(id).trim() === "") {
        return;
      }
      var key = String(id).indexOf("program-") === 0 ? String(id) : "program-" + id;
      var title = item.program_name || item.name || item.title || key;
      pushQuery("program", key, "برنامج · " + title);
    });

    var softRows =
      softPayload && softPayload.follow && Array.isArray(softPayload.follow.rows)
        ? softPayload.follow.rows
        : [];
    softRows.forEach(function (row) {
      pushQuery(
        row.entity_type || "soft_period",
        row.entity_key,
        "فترة لاصفية · " + (row.title || row.slot_code || row.entity_key || "")
      );
    });

    return { queries: queries, labelsMap: labelsMap };
  }

  function fetchEvidenceForQuery(query) {
    var url =
      "/api/session/visual-evidence?entity_type=" +
      encodeURIComponent(query.entity_type) +
      "&entity_key=" +
      encodeURIComponent(query.entity_key);
    return fetch(url, { headers: authHeaders(), cache: "no-store" }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          return { query: query, items: [] };
        }
        return {
          query: query,
          items: (payload && Array.isArray(payload.items) && payload.items) || []
        };
      });
    }).catch(function () {
      return { query: query, items: [] };
    });
  }

  function buildEvidenceCards(items, labelsMap) {
    if (!evidenceCardsEl) {
      return;
    }
    evidenceCardsEl.innerHTML = "";
    var list = Array.isArray(items) ? items : [];

    if (evidenceSummaryEl) {
      evidenceSummaryEl.hidden = false;
      evidenceSummaryEl.textContent = "لديك " + list.length + " شاهدًا.";
    }

    if (!list.length) {
      setHidden(evidenceEmptyEl, false);
      return;
    }
    setHidden(evidenceEmptyEl, true);

    list.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "aj-card";

      if (String(item.kind || "") === "image" && item.dataUrl) {
        var img = document.createElement("img");
        img.className = "aj-evidence-thumb";
        img.src = item.dataUrl;
        img.alt = item.name || "شاهد";
        img.loading = "lazy";
        li.appendChild(img);
      } else {
        var fallback = document.createElement("div");
        fallback.className = "aj-evidence-thumb-fallback";
        var kind = String(item.kind || "");
        var tiny = item.byte_size != null && Number(item.byte_size) < 500;
        fallback.textContent =
          kind === "image"
            ? "لا صور"
            : kind === "pdf"
              ? (tiny ? "لا صور" : "ملف PDF")
              : kind === "video"
                ? "فيديو"
                : kind === "link"
                  ? "رابط"
                  : "شاهد";
        li.appendChild(fallback);
      }

      var h2 = document.createElement("h2");
      h2.textContent = item.name || evidenceEntityLabel(item, labelsMap);
      var entity = document.createElement("p");
      entity.className = "aj-card-meta";
      entity.textContent = "الكيان: " + evidenceEntityLabel(item, labelsMap);
      var date = document.createElement("p");
      date.className = "aj-card-meta";
      date.textContent = "تاريخ الرفع: " + evidenceDateLabel(item.created_at);

      li.appendChild(h2);
      li.appendChild(entity);
      li.appendChild(date);
      var actions = document.createElement("div");
      actions.className = "aj-task-actions";
      var preview = document.createElement("button");
      preview.type = "button";
      preview.className = "aj-detail-btn";
      preview.textContent = "معاينة";
      preview.addEventListener("click", function () {
        previewEvidenceCard(item);
      });
      var download = document.createElement("button");
      download.type = "button";
      download.className = "aj-detail-btn";
      download.textContent = "تنزيل";
      download.addEventListener("click", function () {
        downloadEvidenceFile(item);
      });
      var printWitness = null;
      if (String(item.kind || "") === "image" || String(item.kind || "") === "pdf") {
        printWitness = document.createElement("button");
        printWitness.type = "button";
        printWitness.className = "aj-detail-btn aj-detail-btn-secondary";
        printWitness.textContent = "طباعة";
        printWitness.addEventListener("click", function () {
          printEvidenceWitness(item, labelsMap);
        });
      }
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "aj-council-delete";
      remove.textContent = "حذف";
      remove.addEventListener("click", function () {
        deleteEvidenceCard(item);
      });
      actions.appendChild(preview);
      actions.appendChild(download);
      if (printWitness) {
        actions.appendChild(printWitness);
      }
      if (!item._deliverable && item.can_replace) {
        var replaceBtn = document.createElement("button");
        replaceBtn.type = "button";
        replaceBtn.className = "aj-detail-btn aj-detail-btn-secondary";
        replaceBtn.textContent = "استبدال";
        replaceBtn.addEventListener("click", function () {
          replaceEvidenceCard(item);
        });
        actions.appendChild(replaceBtn);
      }
      if (item._deliverable || item.can_delete) {
        actions.appendChild(remove);
      }
      li.appendChild(actions);
      evidenceCardsEl.appendChild(li);
    });
  }

  function paintEvidenceFileName() {
    var file = getSelectedEvidenceFile();
    if (evidenceFileNameEl) {
      evidenceFileNameEl.textContent = file ? file.name : "";
    }
  }

  function getSelectedEvidenceFile() {
    if (evidenceFileEl && evidenceFileEl.files && evidenceFileEl.files[0]) {
      return evidenceFileEl.files[0];
    }
    if (evidenceDropEl && evidenceDropEl._droppedFile) {
      return evidenceDropEl._droppedFile;
    }
    return null;
  }

  function evidenceRegisterKey(entityType) {
    if (entityType === "program") {
      return "programs";
    }
    if (entityType === "soft_period") {
      return "soft-periods";
    }
    if (entityType === "register") {
      return "environment-1448";
    }
    return "councils";
  }

  function isTeacherDeliverableEvidence() {
    return evidenceEntityTypeEl && evidenceEntityTypeEl.value === "teacher_deliverable";
  }

  function setEvidenceDeliverableFields(visible) {
    var hidden = !visible;
    if (evidenceDeliverKindWrapEl) {
      evidenceDeliverKindWrapEl.hidden = hidden;
    }
    if (evidenceDeliverSubjectWrapEl) {
      evidenceDeliverSubjectWrapEl.hidden = hidden;
    }
    if (evidenceDeliverYearWrapEl) {
      evidenceDeliverYearWrapEl.hidden = hidden;
    }
    if (evidenceDeliverKindEl) {
      evidenceDeliverKindEl.required = !!visible;
    }
    if (evidenceDeliverSubjectEl) {
      evidenceDeliverSubjectEl.required = !!visible;
    }
  }

  function fillEvidenceDeliverableSubject() {
    if (!isTeacherDeliverableEvidence() || !evidenceDeliverSubjectEl || !evidenceEntityKeyEl) {
      return;
    }
    var identity = String(evidenceEntityKeyEl.value || "").trim();
    if (!identity) {
      return;
    }
    var specialty = "";
    var i;
    for (i = 0; i < evidenceTeacherPeople.length; i += 1) {
      var person = evidenceTeacherPeople[i];
      if (person && String(person.id || "") === identity) {
        specialty = String(person.specialty || "").trim();
        break;
      }
    }
    if (specialty) {
      evidenceDeliverSubjectEl.value = specialty;
    }
  }

  function loadEvidenceTeachers() {
    return fetch("/api/noor/staff", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok || !body || !Array.isArray(body.people)) {
            return evidenceTeacherPeople;
          }
          evidenceTeacherPeople = body.people.filter(function (person) {
            return person && person.active !== false && person.id && person.name;
          });
          return evidenceTeacherPeople;
        });
      })
      .catch(function () {
        return evidenceTeacherPeople;
      });
  }

  function loadEvidenceAcademicYear() {
    if (evidenceDeliverYearEl && String(evidenceDeliverYearEl.value || "").trim()) {
      return Promise.resolve(String(evidenceDeliverYearEl.value || "").trim());
    }
    return fetch("/api/settings", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json();
      })
      .then(function (settings) {
        var year = String((settings && settings.academic_year) || "").trim();
        if (evidenceDeliverYearEl) {
          evidenceDeliverYearEl.value = year;
        }
        return year;
      })
      .catch(function () {
        return evidenceDeliverYearEl ? String(evidenceDeliverYearEl.value || "").trim() : "";
      });
  }

  function mapDeliverablesToEvidence(rows) {
    var labelsMap = {};
    var items = [];
    (rows || []).forEach(function (row) {
      if (!row || !row.id) {
        return;
      }
      var kindKey = String(row.deliverable_type || "");
      var kindLabel = (typeof DELIVERABLE_LABELS !== "undefined" && DELIVERABLE_LABELS[kindKey]) || kindKey;
      var name = row.file_name || row.original_name || kindLabel;
      labelsMap["teacher_deliverable::" + row.id] =
        (row.teacher_name || "") + (kindLabel ? " · " + kindLabel : "");
      var lower = String(name || "").toLowerCase();
      var kind = "pdf";
      if (/\.png$|\.jpe?g$/.test(lower)) {
        kind = "image";
      }
      items.push({
        id: row.id,
        entity_type: "teacher_deliverable",
        entity_key: String(row.id),
        kind: kind,
        url: "",
        name: name,
        created_at: row.upload_date || "",
        teacher_name: row.teacher_name || "",
        deliverable_type: kindKey,
        file_name: row.file_name || "",
        original_name: row.original_name || "",
        _deliverable: true
      });
    });
    return { items: items, labelsMap: labelsMap };
  }

  function fetchDeliverableEvidence() {
    return fetch("/api/session/teacher-deliverables", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            return { items: [], labelsMap: {} };
          }
          return mapDeliverablesToEvidence((body && body.items) || []);
        });
      })
      .catch(function () {
        return { items: [], labelsMap: {} };
      });
  }

  function visualItemsFromCache(cache) {
    var items = ((cache && cache.items) || []).filter(function (item) {
      return !item || item.entity_type !== "teacher_deliverable";
    });
    var labelsMap = {};
    var source = (cache && cache.labelsMap) || {};
    Object.keys(source).forEach(function (key) {
      if (key.indexOf("teacher_deliverable::") !== 0) {
        labelsMap[key] = source[key];
      }
    });
    return { items: items, labelsMap: labelsMap };
  }

  function ensureEvidenceOptions() {
    if (evidenceOptionsCache) {
      return Promise.resolve(evidenceOptionsCache);
    }
    return Promise.all([
      softFetch("/api/councils"),
      softFetch("/api/programs"),
      softFetch("/api/soft-periods")
    ]).then(function (sources) {
      var collected = collectEvidenceQueries(sources[0], sources[1], sources[2]);
      evidenceOptionsCache = {
        queries: collected.queries,
        labelsMap: collected.labelsMap,
        sources: sources
      };
      return evidenceOptionsCache;
    });
  }

  function fillEvidenceEntityOptions(entityType, preferredKey) {
    if (!evidenceEntityKeyEl) {
      return;
    }
    var type = String(entityType || "").trim();
    var selected = String(preferredKey || evidenceEntityKeyEl.value || "").trim();
    evidenceEntityKeyEl.innerHTML = "";
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "— اختر —";
    evidenceEntityKeyEl.appendChild(placeholder);
    setEvidenceDeliverableFields(type === "teacher_deliverable");
    if (type === "teacher_deliverable") {
      evidenceTeacherPeople.forEach(function (person) {
        var option = document.createElement("option");
        option.value = String(person.id);
        option.textContent = String(person.name);
        evidenceEntityKeyEl.appendChild(option);
      });
      if (selected) {
        evidenceEntityKeyEl.value = selected;
      }
      fillEvidenceDeliverableSubject();
      loadEvidenceAcademicYear();
      return;
    }

    var options = ((evidenceOptionsCache && evidenceOptionsCache.queries) || []).filter(function (item) {
      return item.entity_type === type;
    });
    options.forEach(function (item) {
      var option = document.createElement("option");
      option.value = item.entity_key;
      option.textContent =
        (evidenceOptionsCache.labelsMap &&
          evidenceOptionsCache.labelsMap[item.entity_type + "::" + item.entity_key]) ||
        item.entity_key;
      evidenceEntityKeyEl.appendChild(option);
    });

    if (selected) {
      var hasSelected = false;
      Array.prototype.forEach.call(evidenceEntityKeyEl.options, function (option) {
        if (option.value === selected) {
          hasSelected = true;
        }
      });
      if (!hasSelected) {
        var extra = document.createElement("option");
        extra.value = selected;
        extra.textContent = evidencePrefillLabel || selected;
        evidenceEntityKeyEl.appendChild(extra);
      }
      evidenceEntityKeyEl.value = selected;
    }
    if (!options.length && !selected) {
      var fallback = document.createElement("option");
      var prefix =
        type === "program" ? "program-" : type === "soft_period" ? "soft-" : "council-";
      fallback.value = prefix + Date.now();
      fallback.textContent = "كيان جديد لهذا الرفع";
      evidenceEntityKeyEl.appendChild(fallback);
      evidenceEntityKeyEl.value = fallback.value;
      return;
    }

    if (selected) {
      evidenceEntityKeyEl.value = selected;
    }
    if (!evidenceEntityKeyEl.value && options[0]) {
      evidenceEntityKeyEl.value = options[0].entity_key;
    }
  }

  function openEvidenceForm(prefill) {
    if (!evidenceModalEl) {
      return;
    }
    prefill = prefill || {};
    evidencePrefillLabel = String(prefill.entityLabel || "").trim();
    if (evidenceFormEl) {
      evidenceFormEl.reset();
    }
    if (evidenceDropEl) {
      evidenceDropEl._droppedFile = null;
      evidenceDropEl.classList.remove("is-dragover");
    }
    paintEvidenceFileName();
    setHidden(evidenceFormErrorEl, true);
    if (evidenceDateEl) {
      var today = new Date();
      var month = String(today.getMonth() + 1);
      var day = String(today.getDate());
      if (month.length < 2) {
        month = "0" + month;
      }
      if (day.length < 2) {
        day = "0" + day;
      }
      evidenceDateEl.value = today.getFullYear() + "-" + month + "-" + day;
    }
    evidenceModalEl.hidden = false;
    document.body.classList.add("aj-modal-open");
    if (evidenceEntityTypeEl && prefill.entityType) {
      evidenceEntityTypeEl.value = prefill.entityType;
    }
    fillEvidenceEntityOptions(
      evidenceEntityTypeEl ? evidenceEntityTypeEl.value : "council_minutes",
      prefill.entityKey
    );
    Promise.all([
      ensureEvidenceOptions().catch(function () {
        return evidenceOptionsCache;
      }),
      loadEvidenceTeachers(),
      loadEvidenceAcademicYear()
    ])
      .then(function () {
        fillEvidenceEntityOptions(
          evidenceEntityTypeEl ? evidenceEntityTypeEl.value : "council_minutes",
          prefill.entityKey
        );
        if (evidenceEntityTypeEl) {
          evidenceEntityTypeEl.focus();
        }
      })
      .catch(function () {
        fillEvidenceEntityOptions(
          evidenceEntityTypeEl ? evidenceEntityTypeEl.value : "council_minutes",
          prefill.entityKey
        );
      });
  }

  function closeEvidenceForm() {
    if (!evidenceModalEl) {
      return;
    }
    evidenceModalEl.hidden = true;
    document.body.classList.remove("aj-modal-open");
    setHidden(evidenceFormErrorEl, true);
    if (evidenceSaveBtn) {
      evidenceSaveBtn.disabled = false;
    }
    evidenceSaveInFlight = false;
    evidencePrefillLabel = "";
  }

  function submitTeacherDeliverableEvidence(teacherId, file) {
    var kind = evidenceDeliverKindEl ? String(evidenceDeliverKindEl.value || "").trim() : "";
    var subject = evidenceDeliverSubjectEl ? String(evidenceDeliverSubjectEl.value || "").trim() : "";
    var year = evidenceDeliverYearEl ? String(evidenceDeliverYearEl.value || "").trim() : "";
    var name = String(file.name || "").toLowerCase();
    var allowed = ["application/pdf", "image/jpeg", "image/png", "application/octet-stream", ""];
    if (!kind || !DELIVERABLE_LABELS[kind]) {
      if (evidenceFormErrorEl) {
        evidenceFormErrorEl.hidden = false;
        evidenceFormErrorEl.textContent = "اختر نوع التسليم.";
      }
      return;
    }
    if (!subject) {
      if (evidenceFormErrorEl) {
        evidenceFormErrorEl.hidden = false;
        evidenceFormErrorEl.textContent = "أدخل المادة.";
      }
      return;
    }
    if (!year) {
      if (evidenceFormErrorEl) {
        evidenceFormErrorEl.hidden = false;
        evidenceFormErrorEl.textContent = "العام الدراسي غير محفوظ.";
      }
      return;
    }
    if (!/\.(pdf|jpg|jpeg|png)$/.test(name) || allowed.indexOf(file.type || "") === -1 || file.size > 10 * 1024 * 1024) {
      if (evidenceFormErrorEl) {
        evidenceFormErrorEl.hidden = false;
        evidenceFormErrorEl.textContent =
          file.size > 10 * 1024 * 1024
            ? "تعذر الحفظ، الملف أكبر من 10 ميجابايت."
            : "تسليم المعلم يقبل PDF أو JPG أو PNG فقط.";
      }
      return;
    }
    var body = new FormData();
    body.append("teacher_id", teacherId);
    body.append("subject", subject);
    body.append("notes", "");
    body.append("deliverable_type", kind);
    body.append("academic_year", year);
    body.append("upload", file);
    evidenceSaveInFlight = true;
    if (evidenceSaveBtn) {
      evidenceSaveBtn.disabled = true;
    }
    fetch("/api/session/teacher-deliverables", {
      method: "POST",
      headers: multipartAuthHeaders(),
      body: body
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(payload, "تعذر حفظ التسليم."));
          }
          return payload;
        });
      })
      .then(function () {
        closeEvidenceForm();
        return loadEvidence({ force: true }).then(function () {
          showToast("تم إرفاق الشاهد بنجاح", "success");
        });
      })
      .catch(function (error) {
        if (evidenceFormErrorEl) {
          evidenceFormErrorEl.hidden = false;
          evidenceFormErrorEl.textContent = error.message || "تعذر حفظ التسليم.";
        }
        showToast(error.message || "تعذر حفظ التسليم.", "error");
      })
      .finally(function () {
        evidenceSaveInFlight = false;
        if (evidenceSaveBtn) {
          evidenceSaveBtn.disabled = false;
        }
      });
  }

  function submitEvidenceForm() {
    if (evidenceSaveInFlight) {
      return;
    }
    setHidden(evidenceFormErrorEl, true);
    var entityType = evidenceEntityTypeEl ? String(evidenceEntityTypeEl.value || "").trim() : "";
    var entityKey = evidenceEntityKeyEl ? String(evidenceEntityKeyEl.value || "").trim() : "";
    var dateValue = evidenceDateEl ? String(evidenceDateEl.value || "").trim() : "";
    var file = getSelectedEvidenceFile();
    if (!entityType) {
      if (evidenceFormErrorEl) {
        evidenceFormErrorEl.hidden = false;
        evidenceFormErrorEl.textContent = "اختر نوع الكيان.";
      }
      return;
    }
    if (!entityKey) {
      if (evidenceFormErrorEl) {
        evidenceFormErrorEl.hidden = false;
        evidenceFormErrorEl.textContent = "اختر الكيان المرتبط.";
      }
      return;
    }
    if (!dateValue) {
      if (evidenceFormErrorEl) {
        evidenceFormErrorEl.hidden = false;
        evidenceFormErrorEl.textContent = "حدد تاريخ الإرفاق.";
      }
      return;
    }
    if (!file) {
      if (evidenceFormErrorEl) {
        evidenceFormErrorEl.hidden = false;
        evidenceFormErrorEl.textContent = "اختر ملفاً للإرفاق.";
      }
      return;
    }
    if (entityType === "teacher_deliverable") {
      submitTeacherDeliverableEvidence(entityKey, file);
      return;
    }

    evidenceSaveInFlight = true;
    if (evidenceSaveBtn) {
      evidenceSaveBtn.disabled = true;
    }
    setUploadSpin(true, "جارٍ ضغط الصورة ورفعها...");

    compressImageFile(file).then(function (ready) {
      var form = new FormData();
      form.append("entity_type", entityType);
      form.append("entity_key", entityKey);
      form.append("register_key", evidenceRegisterKey(entityType));
      form.append("files", ready, ready.name || "evidence.jpg");
      return fetch("/api/visual-evidence", {
        method: "POST",
        headers: multipartAuthHeaders(),
        body: form
      }).then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(payload, "تعذر إرفاق الشاهد."));
          }
          return payload;
        });
      });
    })
      .then(function (payload) {
        evidenceOptionsCache = null;
        window.dispatchEvent(
          new CustomEvent("app:evidence:attached", {
            detail: {
              entity_type: entityType,
              entity_key: entityKey,
              date: dateValue,
              id: payload && payload.items && payload.items[0] ? payload.items[0].id : null
            }
          })
        );
        closeEvidenceForm();
        var after = currentHashView() === "view-evidence"
          ? refreshEvidenceEntity(entityType, entityKey)
          : Promise.resolve();
        return after.then(function () {
          showToast("تم إرفاق الشاهد بنجاح", "success");
        });
      })
      .catch(function (error) {
        if (evidenceFormErrorEl) {
          evidenceFormErrorEl.hidden = false;
          evidenceFormErrorEl.textContent = error.message || "تعذر إرفاق الشاهد.";
        }
        showToast(error.message || "تعذر إرفاق الشاهد.", "error");
      })
      .finally(function () {
        evidenceSaveInFlight = false;
        setUploadSpin(false);
        if (evidenceSaveBtn) {
          evidenceSaveBtn.disabled = false;
        }
      });
  }

  function loadEvidence(options) {
    options = options || {};
    var previous = evidenceCache;
    if (options.force) {
      evidenceLoaded = false;
      evidenceOptionsCache = null;
    }
    if (evidenceLoading || !evidenceCardsEl) {
      return Promise.resolve(evidenceCache);
    }
    if (evidenceLoaded && evidenceCache && !options.force) {
      buildEvidenceCards(evidenceCache.items || [], evidenceCache.labelsMap || {});
      return Promise.resolve(evidenceCache);
    }
    evidenceLoading = true;
    setHidden(evidenceLoadingEl, false);
    setTextStatus(evidenceStatusEl, "", false);
    if (!previous) {
      setHidden(evidenceEmptyEl, true);
      setHidden(evidenceSummaryEl, true);
      evidenceCardsEl.innerHTML = "";
    }

    var visualBundle = Promise.all([
      softFetch("/api/councils"),
      softFetch("/api/programs"),
      softFetch("/api/soft-periods")
    ])
      .then(function (sources) {
        var collected = collectEvidenceQueries(sources[0], sources[1], sources[2]);
        evidenceOptionsCache = {
          queries: collected.queries,
          labelsMap: collected.labelsMap,
          sources: sources
        };
        if (!collected.queries.length) {
          return { items: [], labelsMap: collected.labelsMap, sources: sources, queries: [] };
        }
        return Promise.all(collected.queries.map(fetchEvidenceForQuery)).then(function (chunks) {
          var items = [];
          chunks.forEach(function (chunk) {
            (chunk.items || []).forEach(function (entry) {
              items.push(entry);
            });
          });
          return {
            items: items,
            labelsMap: collected.labelsMap,
            sources: sources,
            queries: collected.queries
          };
        });
      })
      .catch(function (error) {
        var restored = visualItemsFromCache(previous);
        restored.restored = true;
        restored.error = error;
        return restored;
      });

    return Promise.all([visualBundle, fetchDeliverableEvidence()])
      .then(function (parts) {
        var visual = parts[0] || { items: [], labelsMap: {} };
        var extra = parts[1] || { items: [], labelsMap: {} };
        var labelsMap = {};
        Object.keys(visual.labelsMap || {}).forEach(function (key) {
          labelsMap[key] = visual.labelsMap[key];
        });
        Object.keys(extra.labelsMap || {}).forEach(function (key) {
          labelsMap[key] = extra.labelsMap[key];
        });
        var items = (visual.items || []).concat(extra.items || []);
        items.sort(function (a, b) {
          return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        });
        var data = {
          items: items,
          labelsMap: labelsMap,
          sources: visual.sources,
          queries: visual.queries || []
        };
        evidenceCache = data;
        buildEvidenceCards(data.items || [], data.labelsMap || {});
        evidenceLoaded = true;
        if (visual.restored) {
          setTextStatus(evidenceStatusEl, "تعذر تحديث بعض الشواهد، فبقي المعروض السابق.", true);
        } else {
          setTextStatus(evidenceStatusEl, "", false);
        }
        window.dispatchEvent(
          new CustomEvent("app:evidence:loaded", {
            detail: { count: (data.items || []).length, at: Date.now() }
          })
        );
        hydrateEvidenceList(items).then(function (hydrated) {
          data.items = hydrated;
          evidenceCache = data;
          if (currentHashView() === "view-evidence") {
            buildEvidenceCards(hydrated, labelsMap);
          }
        });
        return data;
      })
      .catch(function (error) {
        if (previous) {
          evidenceCache = previous;
          buildEvidenceCards(previous.items || [], previous.labelsMap || {});
          setTextStatus(evidenceStatusEl, "تعذر التحديث، عُرض المحفوظ السابق.", true);
          return previous;
        }
        evidenceCardsEl.innerHTML = "";
        setHidden(evidenceEmptyEl, true);
        setHidden(evidenceSummaryEl, true);
        setTextStatus(evidenceStatusEl, error.message || "تعذر عرض الشواهد.", true);
        throw error;
      })
      .finally(function () {
        evidenceLoading = false;
        setHidden(evidenceLoadingEl, true);
      });
  }

  function programStatusLabel(raw) {
    var value = String(raw || "").trim();
    if (!value || value === "مسودة") {
      return { label: "مسودة", cls: "is-new" };
    }
    if (value === "معتمد" || value === "معتمدة") {
      return { label: "معتمد", cls: "is-done" };
    }
    if (value === "مكتمل") {
      return { label: "مكتمل", cls: "is-done" };
    }
    if (value === "قيد التنفيذ") {
      return { label: "قيد التنفيذ", cls: "is-progress" };
    }
    return { label: value, cls: "is-progress" };
  }

  function isProgramApproved(item) {
    if (!item) {
      return false;
    }
    var raw = String(item.rawStatus || item.status || "").trim();
    return raw === "معتمد" || raw === "معتمدة";
  }

  function canApproveProgram(item) {
    if (!item || item.kind !== "program") {
      return false;
    }
    if (!/^\d+$/.test(String(item.id))) {
      return false;
    }
    return !isProgramApproved(item);
  }

  function setApproveButtonVisible(visible) {
    if (!planApproveBtn) {
      return;
    }
    planApproveBtn.hidden = !visible;
    if (!visible) {
      planApproveBtn.disabled = false;
    }
  }

  function collectPlanningItems(plan, programs) {
    var items = [];
    if (
      plan &&
      (plan.vision ||
        plan.mission ||
        (plan.strategic_goals && plan.strategic_goals.length) ||
        plan.academic_year)
    ) {
      items.push({
        id: "operational-plan",
        kind: "plan",
        title: "الخطة التشغيلية للمدرسة",
        status: "معتمدة",
        statusCls: "is-done",
        rawStatus: "معتمد",
        meta: plan.academic_year ? "العام: " + plan.academic_year : ""
      });
    }
    (programs || []).forEach(function (item, index) {
      var mapped = programStatusLabel(item.status);
      var itemId = item.id != null && String(item.id).trim() !== "" ? String(item.id) : "program-" + index;
      items.push({
        id: itemId,
        kind: "program",
        title: item.program_name || item.name || item.title || "برنامج",
        status: mapped.label,
        statusCls: mapped.cls,
        rawStatus: String(item.status || "").trim() || "مسودة",
        meta: item.owner_label || item.owner_role || ""
      });
    });
    return items;
  }

  function markProgramApprovedInCache(programId) {
    var needle = String(programId);
    if (!planningCache) {
      return;
    }
    (planningCache.items || []).forEach(function (item) {
      if (String(item.id) === needle) {
        var mapped = programStatusLabel("معتمد");
        item.status = mapped.label;
        item.statusCls = mapped.cls;
        item.rawStatus = "معتمد";
      }
    });
    (planningCache.programs || []).forEach(function (item) {
      if (String(item.id) === needle) {
        item.status = "معتمد";
      }
    });
  }

  function findPlanItemById(planId) {
    var list = (planningCache && planningCache.items) || [];
    var needle = String(planId == null ? "" : planId);
    for (var i = 0; i < list.length; i += 1) {
      if (String(list[i].id) === needle) {
        return list[i];
      }
    }
    return null;
  }

  function programEntityKey(programId) {
    return "program-" + String(programId);
  }

  function setProgramDocButtons(visible) {
    [planPrintBtn, planPdfBtn, planEvidenceBtn, planPhotosBtn, planEditBtn].forEach(function (btn) {
      if (btn) {
        btn.hidden = !visible;
      }
    });
    if (programPhotosEl) {
      programPhotosEl.hidden = !visible;
    }
    if (programPlanEl) {
      programPlanEl.hidden = !visible;
    }
    if (planFileBtn) {
      planFileBtn.hidden = !visible;
    }
  }

  function fillProgramDetailBody(record) {
    if (!planDetailGoalsEl) {
      return;
    }
    if (!record) {
      planDetailGoalsEl.textContent = PLAN_GOALS_PLACEHOLDER;
      return;
    }
    var lines = [];
    if (record.strategic_goal) {
      lines.push("الهدف الاستراتيجي: " + record.strategic_goal);
    }
    if (record.executive_goal) {
      lines.push("الهدف التنفيذي: " + record.executive_goal);
    }
    if (record.owner_label) {
      lines.push("صاحب البرنامج: " + record.owner_label);
    }
    if (record.target_audience) {
      lines.push("المستهدفون: " + record.target_audience);
    }
    if (record.duration) {
      lines.push("الفترة: " + record.duration);
    }
    var evidenceCount = (currentProgramEvidence || []).length;
    lines.push(evidenceCount ? "الشواهد المرفقة: " + evidenceCount : "لا شاهد مرفق بعد.");
    var photoCount = (currentProgramImages || []).length;
    lines.push(photoCount ? "صور البطاقة: " + photoCount : "لا صور للبطاقة بعد.");
    lines.push(currentProgramPlan ? "الخطة التفصيلية: مرفقة." : "لا خطة تفصيلية مرفقة.");
    planDetailGoalsEl.textContent = lines.join("\n") || PLAN_GOALS_PLACEHOLDER;
  }

  function escapeProgramPrint(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setUploadSpin(on, text) {
    var node = document.getElementById("aj-upload-spin");
    if (!node) {
      return;
    }
    node.hidden = !on;
    if (text) {
      node.textContent = text;
    }
  }

  function compressImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("اختر صورة."));
        return;
      }
      var name = String(file.name || "").toLowerCase();
      var type = String(file.type || "").toLowerCase();
      if (file.size > 12 * 1024 * 1024) {
        reject(new Error("الملف أكبر من 12 ميغابايت."));
        return;
      }
      if (/\.(heic|heif)$/.test(name) || type.indexOf("heic") >= 0 || type.indexOf("heif") >= 0) {
        reject(new Error("صيغة HEIC غير مدعومة. احفظ الصورة JPG أو PNG ثم أرفقها."));
        return;
      }
      if (!type.startsWith("image/")) {
        resolve(file);
        return;
      }
      var url = URL.createObjectURL(file);
      var done = false;
      var timer = window.setTimeout(function () {
        finish(new Error("انتهت مهلة قراءة الصورة."));
      }, 20000);
      function finish(error, value) {
        if (done) {
          return;
        }
        done = true;
        window.clearTimeout(timer);
        URL.revokeObjectURL(url);
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      }
      var img = new Image();
      img.onload = function () {
        window.requestAnimationFrame(function () {
          try {
            var max = 1200;
            var width = img.width || max;
            var height = img.height || max;
            if (width > max || height > max) {
              if (width >= height) {
                height = Math.round(height * max / width);
                width = max;
              } else {
                width = Math.round(width * max / height);
                height = max;
              }
            }
            var canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext("2d");
            if (!ctx) {
              finish(new Error("تعذر ضغط الصورة."));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(function (blob) {
              if (!blob) {
                finish(new Error("تعذر ضغط الصورة."));
                return;
              }
              if (blob.size > 5 * 1024 * 1024) {
                finish(new Error("الصورة أكبر من 5 ميغابايت بعد الضغط."));
                return;
              }
              var base = String(file.name || "photo").replace(/\.[^.]+$/, "");
              finish(null, new File([blob], base + ".jpg", { type: "image/jpeg" }));
            }, "image/jpeg", 0.8);
          } catch (error) {
            finish(error || new Error("تعذر ضغط الصورة."));
          }
        });
      };
      img.onerror = function () {
        finish(new Error("تعذر قراءة الصورة."));
      };
      img.src = url;
    });
  }

  function refreshEvidenceEntity(entityType, entityKey) {
    return fetchEvidenceForQuery({ entity_type: entityType, entity_key: entityKey }).then(function (chunk) {
      return hydrateEvidenceList(chunk.items || []).then(function (hydrated) {
        var rest = ((evidenceCache && evidenceCache.items) || []).filter(function (item) {
          return String(item.entity_type || "") !== String(entityType)
            || String(item.entity_key || "") !== String(entityKey);
        });
        var data = {
          items: hydrated.concat(rest),
          labelsMap: (evidenceCache && evidenceCache.labelsMap) || {},
          sources: evidenceCache && evidenceCache.sources,
          queries: evidenceCache && evidenceCache.queries
        };
        evidenceCache = data;
        evidenceLoaded = true;
        buildEvidenceCards(data.items, data.labelsMap);
        return data;
      });
    });
  }

  function fetchImageAsDataUrl(url) {
    return fetch(url, { headers: multipartAuthHeaders(), cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("تعذر تحميل الصورة.");
      }
      return response.blob();
    }).then(function (blob) {
      if (!blob || blob.size < 500) {
        throw new Error("tiny");
      }
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          resolve(String(reader.result || ""));
        };
        reader.onerror = function () {
          reject(new Error("تعذر قراءة الصورة."));
        };
        reader.readAsDataURL(blob);
      });
    });
  }

  function evidenceSessionFileUrl(itemId) {
    return "/api/session/evidence/" + encodeURIComponent(String(itemId)) + "/file";
  }

  function evidenceIsDisplayable(item) {
    if (!item) {
      return false;
    }
    if (String(item.kind || "") === "link") {
      return !!String(item.url || "").trim();
    }
    if (item.displayable === false) {
      return false;
    }
    if (item.byte_size != null && item.byte_size !== "") {
      return Number(item.byte_size) >= 500;
    }
    return !!item.dataUrl;
  }

  function hydrateEvidenceList(items) {
    return Promise.all(
      (items || []).map(function (item) {
        var copy = item && typeof item === "object" ? Object.assign({}, item) : {};
        if (copy._deliverable) {
          return Promise.resolve(copy);
        }
        if (copy.id && Number(copy.id) > 0 && String(copy.kind || "") !== "link") {
          copy.file_url = evidenceSessionFileUrl(copy.id);
        }
        var kind = String(copy.kind || "");
        if (kind === "pdf") {
          return Promise.resolve(copy);
        }
        if (kind === "image" && copy.file_url && copy.displayable !== false) {
          return fetch(copy.file_url, { headers: multipartAuthHeaders(), cache: "no-store" }).then(function (response) {
            if (!response.ok) {
              throw new Error("file");
            }
            return response.blob();
          }).then(function (blob) {
            if (!blob || blob.size < 500) {
              throw new Error("tiny");
            }
            var mime = blob.type && blob.type.indexOf("image/") === 0 ? blob.type : "image/jpeg";
            copy.dataUrl = URL.createObjectURL(new Blob([blob], { type: mime }));
            return copy;
          }).catch(function () {
            copy.dataUrl = "";
            copy.displayable = false;
            return copy;
          });
        }
        return Promise.resolve(copy);
      })
    );
  }

  function evidencePrintItems(items) {
    return (items || []).filter(function (item) {
      var kind = item && String(item.kind || "");
      return item && item.dataUrl && (kind === "image" || kind === "pdf");
    }).map(function (item) {
      return {
        kind: String(item.kind || "image"),
        url: item.dataUrl,
        name: item.name || "شاهد"
      };
    });
  }

  function triggerBlobDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename || "شاهد";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 120000);
  }

  function downloadEvidenceFile(item) {
    if (item && item._deliverable) {
      downloadDeliverable(item);
      return;
    }
    if (item && String(item.kind || "") === "link" && item.url) {
      window.open(item.url, "_blank", "noopener");
      return;
    }
    if (!item || !item.id) {
      showToast("لا ملف لهذا الشاهد.", "error");
      return;
    }
    fetch(evidenceSessionFileUrl(item.id), { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("تعذر تنزيل الشاهد.");
        }
        return response.blob();
      })
      .then(function (blob) {
        triggerBlobDownload(blob, item.name || ("شاهد-" + item.id));
      })
      .catch(function (error) {
        showToast((error && error.message) || "تعذر تنزيل الشاهد.", "error");
      });
  }

  function previewEvidenceBlob(item) {
    if (!item || !item.id) {
      showToast("لا معاينة لهذا الشاهد.", "error");
      return;
    }
    if (!evidenceIsDisplayable(item)) {
      showToast("لا يمكن معاينة هذا الملف.", "error");
      return;
    }
    fetch(evidenceSessionFileUrl(item.id), { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("تعذر فتح الشاهد.");
        }
        return response.blob();
      })
      .then(function (blob) {
        if (!blob || blob.size < 500) {
          showToast("لا يمكن معاينة هذا الملف.", "error");
          return;
        }
        var kind = String(item.kind || "");
        var mime = kind === "pdf"
          ? "application/pdf"
          : (blob.type || "application/octet-stream");
        var typed = blob.type === mime ? blob : new Blob([blob], { type: mime });
        var url = URL.createObjectURL(typed);
        openFilePreview({
          title: item.name || "معاينة المرفق",
          filename: item.name || ("شاهد-" + item.id),
          blob: typed,
          url: url,
          pdf: kind === "pdf" || mime === "application/pdf"
        });
      })
      .catch(function (error) {
        showToast((error && error.message) || "تعذر فتح الشاهد.", "error");
      });
  }

  function programPreviewFiles(items) {
    return (items || []).filter(function (item) {
      var kind = String((item && item.kind) || "");
      return (kind === "pdf" || kind === "image") && evidenceIsDisplayable(item);
    });
  }

  function appendPreviewFilesStrip(items) {
    if (!printStagePageEl) {
      return;
    }
    var old = printStagePageEl.querySelector(".aj-preview-files");
    if (old) {
      old.remove();
    }
    var files = (items || []).filter(function (item) {
      return String((item && item.kind) || "") === "pdf" && evidenceIsDisplayable(item);
    });
    if (!files.length) {
      return;
    }
    var wrap = document.createElement("div");
    wrap.className = "aj-preview-files";
    var hint = document.createElement("p");
    hint.textContent = "المرفقات — اضغط لعرض الملف كاملاً في هذه الصفحة";
    var list = document.createElement("div");
    list.className = "aj-preview-files-list";
    files.forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "aj-preview-file-btn";
      btn.textContent = (String(item.kind || "") === "pdf" ? "PDF: " : "صورة: ") + (item.name || "مرفق");
      btn.addEventListener("click", function () {
        previewEvidenceCard(item);
      });
      list.appendChild(btn);
    });
    wrap.appendChild(hint);
    wrap.appendChild(list);
    printStagePageEl.appendChild(wrap);
  }

  function exportPreviewAttachments(items) {
    var files = programPreviewFiles(items);
    var ids = [];
    files.forEach(function (item) {
      var id = Number(item && item.id);
      if (id > 0) {
        ids.push(String(id));
      }
    });
    if (!ids.length) {
      showToast("لا مرفقات صالحة للتصدير.", "error");
      return;
    }
    if (printStageExportBtn) {
      printStageExportBtn.disabled = true;
    }
    var label = document.getElementById("aj-print-file-name");
    var base = label && label.textContent
      ? String(label.textContent).replace(/\.pdf$/i, "")
      : "مرفقات";
    fetch("/api/session/visual-evidence/export?ids=" + encodeURIComponent(ids.join(",")), {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        return response.json().then(function (body) {
          var detail = body && body.detail;
          throw new Error(typeof detail === "string" ? detail : "تعذر تصدير المرفقات.");
        }, function () {
          throw new Error("تعذر تصدير المرفقات.");
        });
      }
      return response.blob();
    }).then(function (blob) {
      if (!blob || !blob.size) {
        throw new Error("ملف التصدير فارغ.");
      }
      triggerBlobDownload(blob, base + "_مرفقات.zip");
      showToast("تم تنزيل ملف المرفقات.", "success");
    }).catch(function (error) {
      showToast((error && error.message) || "تعذر تصدير المرفقات.", "error");
    }).then(function () {
      if (printStageExportBtn) {
        printStageExportBtn.disabled = false;
      }
    });
  }

  function closeFilePreview() {
    var host = document.getElementById("aj-file-preview");
    var frame = document.getElementById("aj-file-preview-frame");
    var image = document.getElementById("aj-file-preview-image");
    var objectEl = document.getElementById("aj-file-preview-object");
    if (filePreviewState && filePreviewState.url) {
      URL.revokeObjectURL(filePreviewState.url);
    }
    filePreviewState = null;
    if (frame) {
      frame.hidden = true;
      frame.removeAttribute("src");
    }
    if (image) {
      image.hidden = true;
      image.removeAttribute("src");
    }
    if (objectEl) {
      objectEl.hidden = true;
      objectEl.removeAttribute("data");
    }
    if (host) {
      host.hidden = true;
    }
  }

  function openFilePreview(opts) {
    opts = opts || {};
    var host = document.getElementById("aj-file-preview");
    var frame = document.getElementById("aj-file-preview-frame");
    var image = document.getElementById("aj-file-preview-image");
    var objectEl = document.getElementById("aj-file-preview-object");
    var title = document.getElementById("aj-file-preview-title");
    if (!host) {
      if (opts.url) {
        window.open(opts.url, "_blank", "noopener");
      }
      return;
    }
    closeFilePreview();
    var blob = opts.blob;
    var url = opts.url || (blob ? URL.createObjectURL(blob) : "");
    if (!url) {
      showToast("لا معاينة لهذا الملف.", "error");
      return;
    }
    filePreviewState = {
      url: url,
      blob: blob || null,
      filename: opts.filename || "ملف"
    };
    if (title) {
      title.textContent = opts.title || "معاينة الملف";
    }
    var mime = blob && blob.type ? String(blob.type) : "";
    var isImage = mime.indexOf("image/") === 0;
    var isPdf = !!opts.pdf || mime === "application/pdf" || /\.pdf$/i.test(opts.filename || "");
    if (isImage && image) {
      image.src = url;
      image.hidden = false;
    } else if (isPdf) {
      var pdfUrl = url + (url.indexOf("#") >= 0 ? "" : "#toolbar=1&navpanes=0&scrollbar=1&view=FitH");
      if (frame) {
        frame.src = pdfUrl;
        frame.hidden = false;
      } else if (objectEl) {
        objectEl.setAttribute("data", pdfUrl);
        objectEl.hidden = false;
      }
    } else if (frame) {
      frame.src = url;
      frame.hidden = false;
    }
    host.hidden = false;
    host.scrollTop = 0;
  }

  function renderProgramPhotos() {
    if (!programPhotosListEl) {
      return;
    }
    programPhotosListEl.innerHTML = "";
    (currentProgramImages || []).forEach(function (item) {
      var li = document.createElement("li");
      if (item.dataUrl) {
        var img = document.createElement("img");
        img.src = item.dataUrl;
        img.alt = item.caption || "صورة البرنامج";
        li.appendChild(img);
      }
      if (item.caption) {
        var cap = document.createElement("span");
        cap.textContent = item.caption;
        li.appendChild(cap);
      }
      var actions = document.createElement("div");
      actions.className = "aj-photo-actions";
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "aj-detail-btn aj-detail-btn-secondary";
      edit.textContent = "تعديل";
      edit.addEventListener("click", function () {
        beginReplaceProgramImage(item.id);
      });
      var del = document.createElement("button");
      del.type = "button";
      del.className = "aj-detail-btn aj-detail-btn-secondary";
      del.textContent = "حذف";
      del.addEventListener("click", function () {
        deleteProgramCardImage(item.id);
      });
      actions.appendChild(edit);
      actions.appendChild(del);
      li.appendChild(actions);
      programPhotosListEl.appendChild(li);
    });
  }

  function deleteProgramCardImage(imageId) {
    if (!imageId || !currentProgramRecord || !currentProgramRecord.id) {
      return;
    }
    if (!window.confirm("حذف صورة البرنامج؟")) {
      return;
    }
    fetch("/api/session/program-images/" + encodeURIComponent(imageId), {
      method: "DELETE",
      headers: authHeaders()
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(payload, "تعذر حذف الصورة."));
          }
          return payload;
        });
      })
      .then(function () {
        showToast("تم حذف الصورة.", "success");
        return loadProgramImages(currentProgramRecord.id).then(function () {
          fillProgramDetailBody(currentProgramRecord);
        });
      })
      .catch(function (error) {
        showToast((error && error.message) || "تعذر حذف الصورة.", "error");
      });
  }

  function loadProgramImages(programId) {
    return fetch("/api/session/programs/" + encodeURIComponent(programId) + "/images", {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error(apiErrorMessage(payload, "تعذر تحميل صور البرنامج."));
        }
        return payload;
      });
    }).then(function (payload) {
      var items = (payload && payload.items) || [];
      return Promise.all(
        items.map(function (item) {
          return fetchImageAsDataUrl(item.url).then(
            function (dataUrl) {
              item.dataUrl = dataUrl;
              return item;
            },
            function () {
              item.dataUrl = "";
              return item;
            }
          );
        })
      );
    }).then(function (items) {
      currentProgramImages = items;
      renderProgramPhotos();
      return items;
    }).catch(function () {
      currentProgramImages = [];
      renderProgramPhotos();
      return [];
    });
  }

  function releaseProgramPlan() {
    if (currentProgramPlan && currentProgramPlan.url) {
      URL.revokeObjectURL(currentProgramPlan.url);
    }
    currentProgramPlan = null;
    if (programPlanFrameEl) {
      programPlanFrameEl.removeAttribute("src");
    }
  }

  function renderProgramPlan() {
    var hasFile = !!(currentProgramPlan && currentProgramPlan.url);
    if (programPlanPreviewEl) {
      programPlanPreviewEl.hidden = !hasFile;
    }
    if (programPlanEmptyEl) {
      programPlanEmptyEl.hidden = hasFile;
    }
    if (programPlanDeleteEl) {
      programPlanDeleteEl.hidden = !hasFile;
    }
    if (programPlanFrameEl && hasFile) {
      programPlanFrameEl.src = currentProgramPlan.url + "#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH";
    }
    if (planFileBtn && programPlanEl && !programPlanEl.hidden) {
      planFileBtn.hidden = false;
      planFileBtn.textContent = hasFile ? "استبدال الخطة التفصيلية" : "إرفاق الخطة التفصيلية";
    }
  }

  function loadProgramPlan(programId) {
    releaseProgramPlan();
    renderProgramPlan();
    return fetch("/api/session/programs/" + encodeURIComponent(programId) + "/plan-file", {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error(apiErrorMessage(payload, "تعذر تحميل الخطة التفصيلية."));
        }
        return payload;
      });
    }).then(function (payload) {
      var item = payload && payload.item;
      if (!item || !item.url) {
        renderProgramPlan();
        return null;
      }
      return fetch(item.url, { headers: multipartAuthHeaders(), cache: "no-store" }).then(function (response) {
        if (!response.ok) {
          throw new Error("تعذر تحميل الخطة التفصيلية.");
        }
        return response.blob();
      }).then(function (blob) {
        if (!blob || !blob.size) {
          throw new Error("ملف الخطة فارغ.");
        }
        var typed = blob.type === "application/pdf"
          ? blob
          : new Blob([blob], { type: "application/pdf" });
        currentProgramPlan = {
          url: URL.createObjectURL(typed),
          blob: typed,
          name: item.original_name || "الخطة التفصيلية.pdf"
        };
        renderProgramPlan();
        if (currentProgramRecord && String(currentProgramRecord.id) === String(programId)) {
          fillProgramDetailBody(currentProgramRecord);
        }
        return currentProgramPlan;
      });
    }).catch(function () {
      releaseProgramPlan();
      renderProgramPlan();
      return null;
    });
  }

  function uploadProgramPlan() {
    if (!programPlanFileEl || !currentProgramRecord || !currentProgramRecord.id) {
      return;
    }
    var file = programPlanFileEl.files && programPlanFileEl.files[0];
    if (!file) {
      return;
    }
    var name = String(file.name || "").toLowerCase();
    var type = String(file.type || "").toLowerCase();
    if (!name.endsWith(".pdf") && type !== "application/pdf") {
      showToast("الملف يجب أن يكون PDF.", "error");
      programPlanFileEl.value = "";
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast("حجم الملف لا يتجاوز 15 ميغابايت.", "error");
      programPlanFileEl.value = "";
      return;
    }
    var form = new FormData();
    form.append("file", file, file.name || "الخطة التفصيلية.pdf");
    if (planFileBtn) {
      planFileBtn.disabled = true;
    }
    setUploadSpin(true, "جارٍ رفع الخطة التفصيلية...");
    fetch("/api/session/programs/" + encodeURIComponent(currentProgramRecord.id) + "/plan-file", {
      method: "POST",
      headers: multipartAuthHeaders(),
      body: form
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error(apiErrorMessage(payload, "تعذر رفع الخطة التفصيلية."));
        }
        return payload;
      });
    }).then(function () {
      showToast("تم إرفاق الخطة التفصيلية.", "success");
      return loadProgramPlan(currentProgramRecord.id);
    }).catch(function (error) {
      showToast((error && error.message) || "تعذر رفع الخطة التفصيلية.", "error");
    }).then(function () {
      setUploadSpin(false);
      programPlanFileEl.value = "";
      if (planFileBtn) {
        planFileBtn.disabled = false;
      }
    });
  }

  function deleteProgramPlan() {
    if (!currentProgramRecord || !currentProgramRecord.id || !currentProgramPlan) {
      return;
    }
    if (!window.confirm("حذف الخطة التفصيلية؟")) {
      return;
    }
    fetch("/api/session/programs/" + encodeURIComponent(currentProgramRecord.id) + "/plan-file", {
      method: "DELETE",
      headers: authHeaders()
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error(apiErrorMessage(payload, "تعذر حذف الخطة التفصيلية."));
        }
        return payload;
      });
    }).then(function () {
      showToast("تم حذف الخطة التفصيلية.", "success");
      releaseProgramPlan();
      renderProgramPlan();
      fillProgramDetailBody(currentProgramRecord);
    }).catch(function (error) {
      showToast((error && error.message) || "تعذر حذف الخطة التفصيلية.", "error");
    });
  }

  function stripEmptyProgramEvidence(html) {
    return String(html || "").replace(
      /<section class="tpl-section">\s*<h2 class="tpl-section-title">الشواهد المصورة والمرفقات<\/h2>[\s\S]*?<\/section>/,
      ""
    );
  }

  function injectProgramCardImages(html, images, bandTitle) {
    var list = (images || []).filter(function (item) {
      return item && item.dataUrl;
    }).slice(0, 5);
    if (!list.length) {
      return html;
    }
    var count = list.length;
    var imgH = count === 1 ? "34mm" : count === 2 ? "32mm" : count === 3 ? "28mm" : "24mm";
    var wrap = count > 3 ? "wrap" : "nowrap";
    var figFlex = count > 3 ? "1 1 30%" : "1 1 0";
    var figures = list.map(function (item) {
      var caption = item.caption
        ? "<figcaption style=\"margin:1mm 0 0;color:#5c675f;font-size:8px;line-height:1.2;text-align:center;\">"
          + escapeProgramPrint(item.caption)
          + "</figcaption>"
        : "";
      return "<figure class=\"aj-program-card-photo\" style=\"margin:0;flex:"
        + figFlex
        + ";min-width:0;max-width:100%;overflow:hidden;text-align:center;box-sizing:border-box;\">"
        + "<div class=\"aj-program-card-photo-frame\" style=\"position:relative;width:100%;height:"
        + imgH
        + ";overflow:hidden;background:#ffffff;border:1px solid #ccc;box-sizing:border-box;\">"
        + "<img src=\"" + escapeProgramPrint(item.dataUrl) + "\" alt=\""
        + escapeProgramPrint(item.caption || "صورة البرنامج")
        + "\" style=\"position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;object-position:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;\">"
        + "</div>"
        + caption
        + "</figure>";
    }).join("");
    var block = "<section class=\"aj-program-card-photos\" data-photo-count=\""
      + count
      + "\" style=\"margin:2mm 0 3mm;flex:0 0 auto;width:100%;\">"
      + "<div class=\"aj-program-card-photos-bar\" style=\"background:#004d46;color:#ffffff;font-weight:700;text-align:center;font-size:11px;line-height:8mm;height:8mm;width:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact;\">"
      + escapeProgramPrint(bandTitle || "صور البرنامج")
      + "</div>"
      + "<div class=\"aj-program-card-photo-grid\" style=\"display:flex;flex-wrap:"
      + wrap
      + ";justify-content:stretch;align-items:stretch;gap:2.5mm;width:100%;margin:0;padding:2.5mm;border:1px solid #ccc;border-top:none;background:#ffffff;box-sizing:border-box;\">"
      + figures
      + "</div>"
      + "</section>";
    var marker = 'class="doc-signoff-block"';
    var idx = html.lastIndexOf(marker);
    if (idx < 0) {
      return html + block;
    }
    var open = html.lastIndexOf("<", idx);
    if (open < 0) {
      return html + block;
    }
    return html.slice(0, open) + block + html.slice(open);
  }
  if (window.AJPrint) {
    window.AJPrint.injectPhotoBand = injectProgramCardImages;
  }

  var replaceProgramImageId = 0;

  function beginReplaceProgramImage(imageId) {
    if (!programPhotoFileEl || !imageId) {
      return;
    }
    replaceProgramImageId = imageId;
    programPhotoFileEl.multiple = false;
    programPhotoFileEl.click();
  }

  function uploadProgramCardImages() {
    if (!programPhotoFileEl || !currentProgramRecord || !currentProgramRecord.id) {
      return;
    }
    var files = programPhotoFileEl.files;
    var replacing = replaceProgramImageId;
    replaceProgramImageId = 0;
    programPhotoFileEl.multiple = true;
    if (!files || !files.length) {
      return;
    }
    var kept = (currentProgramImages || []).length - (replacing ? 1 : 0);
    if (kept + files.length > 5) {
      showToast("الحد الأقصى خمس صور لكل برنامج.", "error");
      programPhotoFileEl.value = "";
      return;
    }
    var form = new FormData();
    var caption = programPhotoCaptionEl ? String(programPhotoCaptionEl.value || "").trim() : "";
    if (caption) {
      form.append("caption", caption);
    }
    if (planPhotosBtn) {
      planPhotosBtn.disabled = true;
    }
    setUploadSpin(true, "جارٍ ضغط الصور ورفعها...");
    Promise.all(Array.prototype.map.call(files, compressImageFile)).then(function (readyFiles) {
      readyFiles.forEach(function (file) {
        form.append("files", file, file.name || "photo.jpg");
      });
      return fetch("/api/session/programs/" + encodeURIComponent(currentProgramRecord.id) + "/images", {
      method: "POST",
      headers: multipartAuthHeaders(),
      body: form
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(payload, "تعذر رفع الصورة."));
          }
          return payload;
        });
      })
      .then(function () {
        var refresh = function () {
          showToast(replacing ? "تم تعديل الصورة." : "تم إرفاق صور البطاقة.", "success");
          if (programPhotoCaptionEl) {
            programPhotoCaptionEl.value = "";
          }
          return loadProgramImages(currentProgramRecord.id).then(function () {
            fillProgramDetailBody(currentProgramRecord);
          });
        };
        if (!replacing) {
          return refresh();
        }
        return fetch("/api/session/program-images/" + encodeURIComponent(replacing), {
          method: "DELETE",
          headers: authHeaders()
        }).then(function (response) {
          return response.json().then(function (payload) {
            if (!response.ok) {
              throw new Error(apiErrorMessage(payload, "تعذر استبدال الصورة."));
            }
            return refresh();
          });
        });
      })
      .catch(function (error) {
        showToast((error && error.message) || "تعذر رفع الصورة.", "error");
      });
    }).catch(function (error) {
      showToast((error && error.message) || "تعذر رفع الصورة.", "error");
    }).finally(function () {
      setUploadSpin(false);
      programPhotoFileEl.value = "";
      if (planPhotosBtn) {
        planPhotosBtn.disabled = false;
      }
    });
  }

  function paintProgramHeader(record, fallbackItem) {
    var title = (record && record.program_name) || (fallbackItem && fallbackItem.title) || "برنامج";
    if (planDetailTitleEl) {
      planDetailTitleEl.textContent = title;
    }
    var statusInfo = programStatusLabel(record && record.status);
    if (planDetailStatusEl) {
      planDetailStatusEl.hidden = false;
      planDetailStatusEl.className = "aj-tag " + statusInfo.cls;
      planDetailStatusEl.textContent = statusInfo.label;
    }
    if (planDetailMetaEl) {
      var meta = (record && record.owner_label) || (fallbackItem && fallbackItem.meta) || "";
      planDetailMetaEl.hidden = !meta;
      planDetailMetaEl.textContent = meta;
    }
    if (planDetailGoalsLabelEl) {
      planDetailGoalsLabelEl.textContent = "بيانات البرنامج";
    }
    setApproveButtonVisible(
      canApproveProgram({
        id: record && record.id,
        kind: "program",
        rawStatus: record && record.status,
        status: record && record.status
      })
    );
  }

  function loadProgramPrintBundle(programId) {
    var id = Number(programId);
    if (!id) {
      return Promise.reject(new Error("معرف البرنامج غير صالح."));
    }
    var key = programEntityKey(id);
    return Promise.all([
      fetch("/api/session/programs/" + encodeURIComponent(id), {
        headers: authHeaders()
      }).then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(payload, "تعذر تحميل البرنامج."));
          }
          return payload;
        });
      }),
      fetch(
        "/api/session/visual-evidence?entity_type=program&entity_key=" + encodeURIComponent(key),
        { headers: authHeaders() }
      ).then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            return { items: [] };
          }
          return payload;
        });
      }),
      loadProgramImages(id),
      loadProgramPlan(id)
    ]).then(function (parts) {
      currentProgramRecord = parts[0];
      return hydrateEvidenceList((parts[1] && parts[1].items) || []).then(function (items) {
        currentProgramEvidence = items;
        fillProgramDetailBody(currentProgramRecord);
        paintProgramHeader(currentProgramRecord, findPlanItemById(id));
        return currentProgramRecord;
      });
    });
  }

  function firstLeadershipId(value) {
    if (Array.isArray(value)) {
      return String(value[0] || "").trim();
    }
    return String(value || "").trim();
  }

  function staffIdDigits(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function sameStaffId(left, right) {
    var a = String(left || "").trim();
    var b = String(right || "").trim();
    if (!a || !b) {
      return false;
    }
    if (a === b) {
      return true;
    }
    a = staffIdDigits(a);
    b = staffIdDigits(b);
    return !!(a && b && a === b);
  }

  function signatureByStaffId(signatures, id) {
    var raw = String(id || "").trim();
    var digits = staffIdDigits(raw);
    if (!signatures) {
      return "";
    }
    return signatures[raw] || (digits ? signatures[digits] : "") || "";
  }

  function staffNameById(people, id) {
    var needle = String(id || "").trim();
    var digits = staffIdDigits(needle);
    var name = "";
    if (!needle) {
      return "";
    }
    (people || []).forEach(function (person) {
      if (!person || !person.name) {
        return;
      }
      var pid = String(person.id || "").trim();
      if (pid === needle || (digits && staffIdDigits(pid) === digits)) {
        name = String(person.name);
      }
    });
    return name;
  }

  function programOwnerSeatId(role, leadership) {
    var seats = leadership || {};
    var key = role;
    if (window.IdentityCore && typeof window.IdentityCore.normalizeRole === "function") {
      key = window.IdentityCore.normalizeRole(role) || role;
    }
    var seatName = window.IdentityCore && window.IdentityCore.ROLE_SEAT
      ? window.IdentityCore.ROLE_SEAT[key]
      : "";
    if (seatName) {
      return firstLeadershipId(seats[seatName]) || (seatName === "counselors" ? firstLeadershipId(seats.counselor) : "");
    }
    if (key === "principal") {
      return firstLeadershipId(seats.manager);
    }
    if (key === "vice_teachers") {
      return firstLeadershipId(seats.education_agents);
    }
    if (key === "vice_students") {
      return firstLeadershipId(seats.student_agents);
    }
    if (key === "student_counselor") {
      return firstLeadershipId(seats.counselors) || firstLeadershipId(seats.counselor);
    }
    if (key === "activity_leader") {
      return firstLeadershipId(seats.activity_leader);
    }
    if (key === "vice_admin") {
      return firstLeadershipId(seats.school_affairs_agent);
    }
    if (key === "safety_supervisor") {
      return firstLeadershipId(seats.safety_supervisor);
    }
    if (key === "educational_supervisor") {
      return firstLeadershipId(seats.educational_supervisor);
    }
    if (key === "librarian") {
      return firstLeadershipId(seats.librarian);
    }
    if (key === "lab_tech") {
      return firstLeadershipId(seats.lab_tech);
    }
    return "";
  }

  function programSignPerson(roleTitle, id, people, signatures) {
    var identity = String(id || "").trim();
    return {
      role: roleTitle,
      roleTitle: roleTitle,
      name: staffNameById(people, identity),
      signature: signatureByStaffId(signatures, identity)
    };
  }

  function resolveProgramExecutorId(record, leadership) {
    var roles = Array.isArray(record.owner_roles) && record.owner_roles.length
      ? record.owner_roles
      : [String(record.owner_role || "").trim()];
    if (window.IdentityCore && typeof window.IdentityCore.isSafetyProgram === "function"
        && window.IdentityCore.isSafetyProgram(record.program_name, {
          code: record.code || record.indicator_code,
          domain: record.domain,
          title: record.title
        })) {
      var safetyId = programOwnerSeatId("safety_supervisor", leadership);
      if (safetyId) {
        return safetyId;
      }
    }
    var firstRole = roles[0];
    if (window.IdentityCore && typeof window.IdentityCore.normalizeRole === "function") {
      firstRole = window.IdentityCore.normalizeRole(firstRole) || firstRole;
    }
    var executorId = firstRole ? programOwnerSeatId(firstRole, leadership) : "";
    if (!executorId) {
      var ownerMap = { activity_leader: "activity", student_counselor: "guidance" };
      var committeeId = ownerMap[roles[0]] || "";
      if (committeeId && window.AjCommittees && typeof window.AjCommittees.chairOf === "function") {
        executorId = window.AjCommittees.chairOf(committeeId) || "";
      }
    }
    if (!executorId) {
      executorId = String(record.assignee_staff_id || "").trim();
    }
    return executorId;
  }

  function occupiedSignoffSeat(roleTitle, id, people) {
    var identity = String(id || "").trim();
    if (!identity) {
      return null;
    }
    return { role: roleTitle, id: identity, name: staffNameById(people, identity) };
  }

  function programCardSignoffSeats(record, people, leadership) {
    var roles = Array.isArray(record.owner_roles) && record.owner_roles.length
      ? record.owner_roles
      : [String(record.owner_role || "").trim()];
    var executorId = resolveProgramExecutorId(record, leadership);
    var firstRoleTitle = "منفّذ البرنامج";
    var isSafety = window.IdentityCore && typeof window.IdentityCore.isSafetyProgram === "function"
        && window.IdentityCore.isSafetyProgram(record.program_name, {
          code: record.code || record.indicator_code,
          domain: record.domain,
          title: record.title
        });
    if (isSafety) {
      firstRoleTitle = "مشرف الأمن والسلامة";
    }
    var columns = [];
    var exec = occupiedSignoffSeat(firstRoleTitle, executorId, people);
    if (exec) {
      columns.push(exec);
    }
    var viceRole = "وكيل الشؤون التعليمية";
    var viceId = isSafety ? "" : programOwnerSeatId("vice_teachers", leadership);
    if (!isSafety && roles.indexOf("vice_students") >= 0) {
      viceRole = "وكيل شؤون الطلاب";
      viceId = programOwnerSeatId("vice_students", leadership);
    } else if (!isSafety && roles.indexOf("student_counselor") >= 0) {
      viceRole = "الموجه الطلابي";
      viceId = programOwnerSeatId("student_counselor", leadership);
    }
    if (viceId && !sameStaffId(viceId, executorId)) {
      columns.push(occupiedSignoffSeat(viceRole, viceId, people));
    }
    var managerId = firstLeadershipId(leadership && leadership.manager);
    if (managerId && !sameStaffId(managerId, executorId) && !sameStaffId(managerId, viceId)) {
      columns.push(occupiedSignoffSeat("مدير المدرسة", managerId, people));
    }
    return columns.filter(Boolean);
  }

  function programCardSignoffColumns(record, people, leadership, signatures) {
    return programCardSignoffSeats(record, people, leadership).map(function (seat) {
      return {
        role: seat.role,
        roleTitle: seat.role,
        name: seat.name || "",
        signature: signatureByStaffId(signatures, seat.id)
      };
    });
  }

  function columnsFromSignatureCore(resolved) {
    return (resolved || []).map(function (row) {
      return {
        role: row.role || "",
        roleTitle: row.role || "",
        name: row.name || "",
        signature: row.signature || ""
      };
    });
  }

  function applyProgramCardSignoff(html, columns) {
    var core = window.OfficialFrameCore;
    if (!core || typeof core.signoff !== "function") {
      return html;
    }
    var school = schoolNameEl ? String(schoolNameEl.textContent || "").trim() : "";
    var foot = core.signoff({
      strictIdentity: true,
      columns: columns,
      school: school,
      page: 1,
      total: 1
    });
    return String(html || "").replace(/<footer class="doc-signoff-block">[\s\S]*?<\/footer>/, foot);
  }

  function fetchSignaturesByIds(ids) {
    var list = [];
    (ids || []).forEach(function (value) {
      var identity = String(value || "").replace(/\D+/g, "");
      if (identity && list.indexOf(identity) < 0) {
        list.push(identity);
      }
    });
    if (!list.length) {
      return Promise.resolve({});
    }
    return fetch("/api/session/signatures?ids=" + encodeURIComponent(list.join(",")), {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (response) {
      return response.json().then(function (body) {
        return response.ok && body && body.signatures ? body.signatures : {};
      });
    }).catch(function () {
      return {};
    });
  }

  function fetchProgramCardSignoff(record) {
    return Promise.all([
      fetch("/api/noor/staff", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.json().then(function (body) {
          return response.ok && body && Array.isArray(body.people) ? body.people : [];
        });
      }).catch(function () {
        return [];
      }),
      fetch("/api/session/leadership", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
        return response.json().then(function (body) {
          return response.ok && body ? body : {};
        });
      }).catch(function () {
        return {};
      }),
      window.AjCommittees && typeof window.AjCommittees.load === "function"
        ? window.AjCommittees.load().catch(function () { return null; })
        : Promise.resolve(null)
    ]).then(function (parts) {
      var people = parts[0];
      var leadership = parts[1] || {};
      setLiveLeadership(leadership);
      var seats = programCardSignoffSeats(record, people, leadership);

      function legacySignoff() {
        return fetchSignaturesByIds(seats.map(function (seat) {
          return seat.id;
        })).then(function (signatures) {
          return programCardSignoffColumns(record, people, leadership, signatures);
        });
      }

      var core = window.SignatureCore;
      if (!core || typeof core.resolve !== "function") {
        return legacySignoff();
      }
      return core.resolve(seats, { headers: authHeaders() }).then(function (resolved) {
        if (!resolved || !resolved.length) {
          return legacySignoff();
        }
        return columnsFromSignatureCore(resolved);
      }).catch(function () {
        return legacySignoff();
      });
    });
  }

  function printCurrentProgramCard(asPdf, linked) {
    var openedHere = !(linked && linked.record);
    var record = openedHere ? currentProgramRecord : Object.assign({}, linked.record);
    var cardImages = openedHere ? currentProgramImages : (linked.images || []);
    var cardEvidence = openedHere ? currentProgramEvidence : (linked.evidence || []);
    var cardFiles = openedHere ? null : (linked.files || []);
    if (!record) {
      showToast("افتح برنامجاً أولاً.", "error");
      return;
    }
    if (!window.PrintTemplates || typeof window.PrintTemplates.renderProgramCard !== "function") {
      showToast("نموذج بطاقة البرنامج غير محمّل.", "error");
      return;
    }
    ensurePlanningBank().then(function () {
      var code = programBankCodesFromRecord(record)[0] || "";
      var packed = window.NarrativeCore && typeof window.NarrativeCore.fromBank === "function"
        ? window.NarrativeCore.fromBank(code)
        : null;
      if (packed && packed.item) {
        if (!String(record.executive_goal || "").trim() && packed.item.title) {
          record.executive_goal = packed.item.title;
        }
        if (!String(record.mechanism || "").trim() && packed.procedures) {
          record.mechanism = packed.procedures;
        }
        if (!String(record.success_indicator || "").trim() && packed.evidence) {
          record.success_indicator = packed.evidence;
        }
      }
      return fetchProgramCardSignoff(record);
    }).then(function (columns) {
      record.executor_id = "";
      record.executor_name = columns[0] ? columns[0].name : "";
      record.executor_signature = columns[0] ? columns[0].signature : "";
      record.signoffColumns = columns;
      var listsApi = window.AjStudentsLists;
      var listKind = listsApi && typeof listsApi.kindForProgram === "function"
        ? listsApi.kindForProgram(record.program_name, record.template_key)
        : "";
      var listsReady = listKind && listsApi && typeof listsApi.fetchLists === "function"
        ? listsApi.fetchLists()
        : Promise.resolve(null);
      return listsReady.then(function () {
        var html = applyProgramCardSignoff(
          injectProgramCardImages(
            stripEmptyProgramEvidence(
              window.PrintTemplates.renderProgramCard(record, evidencePrintItems(cardEvidence))
            ),
            cardImages
          ),
          columns
        );
        if (listKind && listsApi && typeof listsApi.injectStudentsTable === "function") {
          var rows = listsApi.approvedRows(listKind);
          var listTitle = listKind === "gifted"
            ? "قائمة الطلاب الموهوبين المعتمدة"
            : "قائمة الطلاب المتدني المعتمدة";
          html = listsApi.injectStudentsTable(html, rows, listTitle);
        }
        var gaps = window.DeficiencyCore && typeof window.DeficiencyCore.check === "function"
          ? window.DeficiencyCore.check("program-card", {
            images: cardImages,
            evidenceItems: evidencePrintItems(cardEvidence),
            signoffColumns: columns,
            executor_signature: record.executor_signature,
            record: record
          })
          : [];
        if (window.PrintCore && typeof window.PrintCore.allowAfterWarning === "function") {
          if (!window.PrintCore.allowAfterWarning(gaps)) {
            return;
          }
        }
        var title = "بطاقة برنامج - " + (record.program_name || record.id);
        var hasTable = !!(listKind && listsApi && listsApi.approvedRows(listKind).length);
        showOfficialPreview(html, {
          pdfTitle: title,
          file: { kind: "program", programName: record.program_name || "" },
          arm: hasTable ? { multiPage: true } : {},
          files: programPreviewFiles(cardFiles || cardEvidence)
        });
      });
    }).then(function () {
      if (asPdf) {
        showToast("المعاينة في هذه الصفحة. من الشريط: حفظ PDF أو تصدير المرفقات.", "success");
      }
    }).catch(function () {
      showToast("تعذر تجهيز اعتماد البطاقة.", "error");
    });
  }

  function attachCurrentProgramEvidence() {
    if (!currentProgramRecord || !currentProgramRecord.id) {
      showToast("افتح برنامجاً أولاً.", "error");
      return;
    }
    openEvidenceForm({
      entityType: "program",
      entityKey: programEntityKey(currentProgramRecord.id),
      entityLabel: "برنامج · " + (currentProgramRecord.program_name || currentProgramRecord.id)
    });
  }

  function showPlanDetails(planId) {
    pendingPlanDetailId = planId;
    if (planPrint122Btn) {
      planPrint122Btn.hidden = true;
    }
    if (planPrint131Btn) {
      planPrint131Btn.hidden = true;
    }
    if (planWitness131Btn) {
      planWitness131Btn.hidden = true;
    }
    if (planPrint141Btn) {
      planPrint141Btn.hidden = true;
    }
    if (planWitness141Btn) {
      planWitness141Btn.hidden = true;
    }
    if (witnessFilesBox) {
      witnessFilesBox.hidden = true;
    }
    if (planPrint146Btn) {
      planPrint146Btn.hidden = true;
    }
    if (planPrint142Btn) {
      planPrint142Btn.hidden = true;
    }
    currentProgramRecord = null;
    currentProgramEvidence = [];
    currentProgramImages = [];
    renderProgramPhotos();
    releaseProgramPlan();
    renderProgramPlan();
    var item = findPlanItemById(planId);
    setHidden(planDetailErrorEl, true);
    if (planDetailGoalsEl) {
      planDetailGoalsEl.textContent = PLAN_GOALS_PLACEHOLDER;
    }
    if (!item) {
      if (/^\d+$/.test(String(planId || ""))) {
        setProgramDocButtons(true);
        setApproveButtonVisible(false);
        if (planDetailTitleEl) {
          planDetailTitleEl.textContent = "برنامج";
        }
        loadProgramPrintBundle(planId).catch(function (error) {
          setProgramDocButtons(false);
          if (planDetailErrorEl) {
            planDetailErrorEl.hidden = false;
            planDetailErrorEl.textContent = (error && error.message) || "تعذر العثور على البرنامج.";
          }
        });
        return;
      }
      if (planDetailTitleEl) {
        planDetailTitleEl.textContent = "تفاصيل الخطة";
      }
      if (planDetailStatusEl) {
        planDetailStatusEl.textContent = "";
        planDetailStatusEl.className = "aj-tag";
        planDetailStatusEl.hidden = true;
      }
      setApproveButtonVisible(false);
      setProgramDocButtons(false);
      setHidden(planDetailMetaEl, true);
      if (planDetailErrorEl) {
        planDetailErrorEl.hidden = false;
        planDetailErrorEl.textContent = "تعذر العثور على الخطة. عد إلى التخطيط وحاول مجددًا.";
      }
      return;
    }

    if (planDetailTitleEl) {
      planDetailTitleEl.textContent = item.title || "تفاصيل الخطة";
    }
    if (planDetailStatusEl) {
      planDetailStatusEl.hidden = false;
      planDetailStatusEl.className = "aj-tag " + (item.statusCls || "is-progress");
      planDetailStatusEl.textContent = item.status || "قيد التنفيذ";
    }
    if (planDetailMetaEl) {
      if (item.meta) {
        planDetailMetaEl.hidden = false;
        planDetailMetaEl.textContent = item.meta;
      } else {
        planDetailMetaEl.hidden = true;
        planDetailMetaEl.textContent = "";
      }
    }
    var isProgram = item.kind === "program";
    setProgramDocButtons(isProgram);
    if (item.id === "operational-plan") {
      if (planPrintBtn) {
        planPrintBtn.hidden = false;
      }
      if (planPdfBtn) {
        planPdfBtn.hidden = false;
      }
      if (planPrint122Btn) {
        planPrint122Btn.hidden = false;
      }
      if (planPrint131Btn) {
        planPrint131Btn.hidden = false;
      }
      if (planWitness131Btn) {
        planWitness131Btn.hidden = false;
      }
      if (planPrint141Btn) {
        planPrint141Btn.hidden = false;
      }
      if (planWitness141Btn) {
        planWitness141Btn.hidden = false;
      }
      if (witnessFilesBox) {
        witnessFilesBox.hidden = false;
        loadWitnessFiles();
      }
      if (planPrint146Btn) {
        planPrint146Btn.hidden = false;
      }
      if (planPrint142Btn) {
        planPrint142Btn.hidden = false;
      }
    }
    if (planDetailGoalsLabelEl) {
      planDetailGoalsLabelEl.textContent = isProgram ? "بيانات البرنامج" : "أهداف الخطة";
    }
    setApproveButtonVisible(canApproveProgram(item));
    if (isProgram) {
      loadProgramPrintBundle(item.id).catch(function (error) {
        if (planDetailErrorEl) {
          planDetailErrorEl.hidden = false;
          planDetailErrorEl.textContent = (error && error.message) || "تعذر تحميل البرنامج.";
        }
      });
    }
    console.log("Plan Details:", item);
    window.dispatchEvent(
      new CustomEvent("app:plan:opened", {
        detail: { id: item.id, title: item.title || "", kind: item.kind }
      })
    );
  }

  function approveCurrentProgram() {
    var item = findPlanItemById(pendingPlanDetailId);
    if (!canApproveProgram(item) || approveInFlight) {
      return;
    }
    var programId = Number(item.id);
    if (!programId) {
      showToast("تعذر اعتماد هذا البرنامج: المعرف غير صالح.", "error");
      return;
    }
    approveInFlight = true;
    if (planApproveBtn) {
      planApproveBtn.disabled = true;
    }
    fetch("/api/programs/approve", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: programId })
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(payload, "تعذر اعتماد البرنامج."));
          }
          return payload;
        });
      })
      .then(function (payload) {
        console.log("Program Approve:", payload);
        markProgramApprovedInCache(programId);
        if (planDetailStatusEl) {
          planDetailStatusEl.hidden = false;
          planDetailStatusEl.className = "aj-tag is-done";
          planDetailStatusEl.textContent = programStatusLabel("معتمد").label;
        }
        setApproveButtonVisible(false);
        if (planningCache) {
          buildPlanningCards(planningCache);
        }
        loadProgramPrintBundle(programId).catch(function () {});
        window.dispatchEvent(
          new CustomEvent("app:program:approved", {
            detail: { id: programId }
          })
        );
        showToast("تم اعتماد البرنامج بنجاح", "success");
      })
      .catch(function (error) {
        showToast(error.message || "تعذر اعتماد البرنامج.", "error");
        if (planApproveBtn && canApproveProgram(findPlanItemById(pendingPlanDetailId))) {
          planApproveBtn.disabled = false;
          planApproveBtn.hidden = false;
        }
      })
      .finally(function () {
        approveInFlight = false;
      });
  }

  function openPlanDetailsRoute(planId) {
    if (String(planId) === "operational-plan") {
      window.location.hash = "view-planning";
      return;
    }
    window.location.hash = "view-plan-details?id=" + encodeURIComponent(String(planId));
  }

  function buildPlanningCards(cache) {
    if (!planCardsEl) {
      return;
    }
    planCardsEl.innerHTML = "";
    var cards = ((cache && cache.items) || []).filter(function (card) {
      return card.kind !== "plan";
    });

    if (planSummaryEl) {
      var programCount = cards.filter(function (card) {
        return card.kind === "program";
      }).length;
      planSummaryEl.hidden = false;
      planSummaryEl.textContent = "البرامج المعروضة: " + programCount + ".";
    }

    if (!cards.length) {
      setHidden(planEmptyEl, false);
      return;
    }
    setHidden(planEmptyEl, true);

    cards.forEach(function (card) {
      if (card.kind === "plan") {
        return;
      }
      var li = document.createElement("li");
      li.className = "aj-card";
      var h2 = document.createElement("h2");
      h2.textContent = card.title;
      var tag = document.createElement("span");
      tag.className = "aj-tag " + card.statusCls;
      tag.textContent = card.status;
      li.appendChild(h2);
      li.appendChild(tag);
      if (card.meta) {
        var meta = document.createElement("p");
        meta.className = "aj-card-meta";
        meta.textContent = card.meta;
        li.appendChild(meta);
      }
      var actions = document.createElement("div");
      actions.className = "aj-task-actions";
      var openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "aj-open-task";
      openBtn.textContent = "استعراض الخطة";
      openBtn.addEventListener("click", function () {
        openPlanDetailsRoute(card.id);
      });
      actions.appendChild(openBtn);
      li.appendChild(actions);
      planCardsEl.appendChild(li);
    });
  }

  function indicatorLine(item) {
    var kpi = item && item.kpi ? String(item.kpi) : "";
    var extra = [];
    if (item && item.target) {
      extra.push(String(item.target));
    }
    if (item && item.measurement) {
      extra.push(String(item.measurement));
    }
    if (kpi && extra.length) {
      return kpi + " — " + extra.join(" · ");
    }
    return kpi || extra.join(" · ");
  }

  function renderSmartPlanning(payload) {
    if (!smartCardsEl) {
      return;
    }
    smartCardsEl.innerHTML = "";
    var goals = payload && Array.isArray(payload.goals) ? payload.goals : [];
    var missing = payload && Array.isArray(payload.missing)
      ? payload.missing.filter(function (item) { return String(item || "").trim(); })
      : [];
    if (smartMissingEl) {
      if (missing.length) {
        smartMissingEl.hidden = false;
        smartMissingEl.textContent = "الأهداف التالية غير موجودة في الخطة: " + missing.join("، ");
      } else {
        smartMissingEl.hidden = true;
        smartMissingEl.textContent = "";
      }
    }
    if (!goals.length) {
      setHidden(smartEmptyEl, false);
      return;
    }
    setHidden(smartEmptyEl, true);
    goals.forEach(function (goal) {
      var li = document.createElement("li");
      li.className = "aj-card aj-smart-card";
      var title = document.createElement("h2");
      var goalId = goal && goal.id ? String(goal.id) : "";
      var goalText = goal && goal.text ? String(goal.text) : "";
      title.textContent = goalId && goalText ? goalId + " — " + goalText : (goalId || goalText);
      li.appendChild(title);
      var list = document.createElement("ul");
      list.className = "aj-smart-kpis";
      var indicators = goal && Array.isArray(goal.indicators) ? goal.indicators : [];
      if (!indicators.length) {
        var emptyItem = document.createElement("li");
        emptyItem.textContent = "لا مؤشرات محفوظة لهذا الهدف.";
        list.appendChild(emptyItem);
      } else {
        indicators.forEach(function (item) {
          var row = document.createElement("li");
          row.textContent = indicatorLine(item);
          list.appendChild(row);
        });
      }
      li.appendChild(list);
      smartCardsEl.appendChild(li);
    });
  }

  function loadSmartPlanning(options) {
    options = options || {};
    if (options.force) {
      smartLoaded = false;
      smartCache = null;
    }
    if (smartLoading || !smartCardsEl) {
      return Promise.resolve(smartCache);
    }
    if (smartLoaded && smartCache && !options.silentBoard) {
      renderSmartPlanning(smartCache);
      return Promise.resolve(smartCache);
    }
    if (smartLoaded && smartCache) {
      return Promise.resolve(smartCache);
    }
    smartLoading = true;
    setHidden(smartLoadingEl, false);
    setTextStatus(smartStatusEl, "", false);
    setHidden(smartMissingEl, true);
    setHidden(smartEmptyEl, true);
    if (!options.silentBoard) {
      smartCardsEl.innerHTML = "";
    }
    return fetch("/api/knowledge-bank", {
      headers: authHeaders(),
      cache: "no-store"
    })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر عرض الخطط الذكية."));
          }
          return body;
        });
      })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.goals)) {
          throw new Error("تعذر عرض الخطط الذكية.");
        }
        smartCache = payload;
        smartLoaded = true;
        if (!options.silentBoard) {
          renderSmartPlanning(payload);
        }
        setTextStatus(smartStatusEl, "", false);
        return payload;
      })
      .catch(function (error) {
        if (!options.silentBoard) {
          smartCardsEl.innerHTML = "";
          setHidden(smartEmptyEl, true);
          setHidden(smartMissingEl, true);
          setTextStatus(smartStatusEl, (error && error.message) || "تعذر عرض الخطط الذكية.", true);
        }
      })
      .finally(function () {
        smartLoading = false;
        setHidden(smartLoadingEl, true);
      });
  }

  function fillSelect(select, items, placeholder, valueKey, labelKey) {
    if (!select) {
      return;
    }
    var current = select.value;
    select.innerHTML = "";
    var empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder;
    select.appendChild(empty);
    (items || []).forEach(function (item) {
      var option = document.createElement("option");
      option.value = String(item[valueKey]);
      option.textContent = String(item[labelKey] || item[valueKey] || "");
      select.appendChild(option);
    });
    select.value = current;
  }

  function ensureOption(select, value, label) {
    if (!select || !value) {
      return;
    }
    var needle = String(value);
    var found = false;
    Array.prototype.forEach.call(select.options, function (option) {
      if (option.value === needle) {
        found = true;
      }
    });
    if (!found) {
      var option = document.createElement("option");
      option.value = needle;
      option.textContent = label || needle;
      select.appendChild(option);
    }
  }

  function flashField(el) {
    if (!el) {
      return;
    }
    var field = el.closest ? el.closest(".aj-field") : null;
    if (!field) {
      return;
    }
    field.classList.remove("aj-flash-success");
    window.setTimeout(function () {
      field.classList.add("aj-flash-success");
    }, 0);
    var timer = window.setTimeout(function () {
      field.classList.remove("aj-flash-success");
    }, 1000);
    programFlashTimers.push(timer);
  }

  function setProgramField(name, value) {
    if (!programFormEl || !programFormEl.elements[name]) {
      return;
    }
    var el = programFormEl.elements[name];
    var next = value == null ? "" : String(value);
    if (name === "goal_ref" || name === "register_id" || name === "unit") {
      ensureOption(el, next, next);
    }
    if (el.value === next) {
      return;
    }
    el.value = next;
    flashField(el);
  }

  function goalById(goalId) {
    var needle = String(goalId || "");
    for (var i = 0; i < programGoals.length; i += 1) {
      if (String(programGoals[i].id) === needle) {
        return programGoals[i];
      }
    }
    return null;
  }

  function showProgramGoalHint(goalId) {
    var id = String(goalId || "").trim();
    if (programGoalKpiListEl) {
      programGoalKpiListEl.innerHTML = "";
    }
    if (!id) {
      setHidden(programMissingEl, true);
      setHidden(programGoalKpisEl, true);
      return;
    }
    var goal = goalById(id);
    var missing = programMissingIds.indexOf(id) >= 0 || !goal;
    if (programMissingEl) {
      if (missing) {
        programMissingEl.hidden = false;
        programMissingEl.textContent = "الهدف غير موجود في الخطة: " + id;
      } else {
        programMissingEl.hidden = true;
        programMissingEl.textContent = "";
      }
    }
    if (!goal || !programGoalKpiListEl || !programGoalKpisEl) {
      setHidden(programGoalKpisEl, true);
      return;
    }
    var indicators = Array.isArray(goal.indicators) ? goal.indicators : [];
    indicators.forEach(function (item) {
      var row = document.createElement("li");
      row.textContent = indicatorLine(item);
      programGoalKpiListEl.appendChild(row);
    });
    if (!indicators.length) {
      var emptyItem = document.createElement("li");
      emptyItem.textContent = "لا مؤشرات محفوظة لهذا الهدف.";
      programGoalKpiListEl.appendChild(emptyItem);
    }
    setHidden(programGoalKpisEl, false);
  }

  function selectedProgramOwners() {
    if (!programOwnersEl) {
      return [];
    }
    var roles = [];
    Array.prototype.forEach.call(programOwnersEl.querySelectorAll("input[type='checkbox']"), function (box) {
      if (box.getAttribute("data-assignee") === "1") {
        return;
      }
      if (box.checked && box.value) {
        roles.push(String(box.value));
      }
    });
    return roles;
  }

  function assigneeOwnerChecked() {
    if (!programOwnersEl) {
      return false;
    }
    var box = programOwnersEl.querySelector('input[data-assignee="1"]');
    return !!(box && box.checked);
  }

  function fillProgramOwners(owners, selected, selectedAssignee) {
    if (!programOwnersEl) {
      return;
    }
    var chosen = {};
    (selected || []).forEach(function (role) {
      chosen[String(role)] = true;
    });
    programOwnersEl.innerHTML = "";
    (owners || []).forEach(function (item) {
      var role = String(item.role || "");
      if (!role) {
        return;
      }
      var row = document.createElement("label");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.name = "owner_roles";
      box.value = role;
      box.checked = !!chosen[role];
      row.appendChild(box);
      row.appendChild(document.createTextNode(String(item.label || role)));
      programOwnersEl.appendChild(row);
    });
    if (programGiftedAssignment && programGiftedAssignment.staff_name) {
      var assigneeRow = document.createElement("label");
      var assigneeBox = document.createElement("input");
      assigneeBox.type = "checkbox";
      assigneeBox.name = "assignee_staff";
      assigneeBox.setAttribute("data-assignee", "1");
      assigneeBox.value = String(programGiftedAssignment.staff_id || "");
      assigneeBox.checked = !!selectedAssignee;
      assigneeRow.appendChild(assigneeBox);
      assigneeRow.appendChild(
        document.createTextNode("منسق موهوبين — " + programGiftedAssignment.staff_name)
      );
      programOwnersEl.appendChild(assigneeRow);
    }
    if ((selected && selected.length) || selectedAssignee) {
      flashField(programOwnersEl);
    }
  }

  function refreshGiftedAssignment() {
    return fetch("/api/session/internal-assignments?assignment_type=gifted_coordinator", {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) {
          throw new Error(apiErrorMessage(body, "تعذر قراءة التكليف."));
        }
        return body;
      });
    }).then(function (payload) {
      var items = payload && Array.isArray(payload.items) ? payload.items : [];
      programGiftedAssignment = items[0] || null;
      return programGiftedAssignment;
    }).catch(function () {
      programGiftedAssignment = null;
      return null;
    });
  }

  function openGiftedAssignModal() {
    if (!giftedAssignModalEl) {
      return;
    }
    setHidden(giftedAssignErrorEl, true);
    fetch("/api/noor/staff", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر قراءة سجل المنسوبين."));
          }
          return body;
        });
      })
      .then(function (payload) {
        var people = (payload.people || []).filter(function (item) {
          return item && item.id && item.name && item.active !== false;
        });
        fillSelect(giftedStaffEl, people, "— اختر معلماً —", "id", "name");
        if (programGiftedAssignment && programGiftedAssignment.staff_id) {
          giftedStaffEl.value = String(programGiftedAssignment.staff_id);
        }
        giftedAssignModalEl.hidden = false;
        document.body.classList.add("aj-modal-open");
      })
      .catch(function (error) {
        if (giftedAssignErrorEl) {
          giftedAssignErrorEl.hidden = false;
          giftedAssignErrorEl.textContent = (error && error.message) || "تعذر فتح التعيين.";
        }
        giftedAssignModalEl.hidden = false;
        document.body.classList.add("aj-modal-open");
      });
  }

  function closeGiftedAssignModal() {
    if (!giftedAssignModalEl) {
      return;
    }
    giftedAssignModalEl.hidden = true;
    document.body.classList.remove("aj-modal-open");
  }

  function submitGiftedAssignment() {
    var staffId = giftedStaffEl ? String(giftedStaffEl.value || "").trim() : "";
    if (!staffId) {
      if (giftedAssignErrorEl) {
        giftedAssignErrorEl.hidden = false;
        giftedAssignErrorEl.textContent = "اختر معلماً من السجل.";
      }
      return;
    }
    fetch("/api/session/internal-assignments", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        assignment_type: "gifted_coordinator",
        staff_id: staffId
      })
    })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر حفظ التكليف."));
          }
          return body;
        });
      })
      .then(function (payload) {
        programGiftedAssignment = payload.item || null;
        fillProgramOwners(
          (programCatalog && programCatalog.owners) || [],
          selectedProgramOwners(),
          true
        );
        closeGiftedAssignModal();
        showToast("تم تعيين منسق الموهوبين", "success");
      })
      .catch(function (error) {
        if (giftedAssignErrorEl) {
          giftedAssignErrorEl.hidden = false;
          giftedAssignErrorEl.textContent = (error && error.message) || "تعذر حفظ التكليف.";
        }
      });
  }

  function setProgramFormMode(programId) {
    editingProgramId = Number(programId) || 0;
    if (programFormTitleEl) {
      programFormTitleEl.textContent = editingProgramId ? "تعديل البرنامج" : "إضافة برنامج";
    }
    if (programSaveBtn) {
      programSaveBtn.textContent = editingProgramId ? "حفظ التعديل" : "حفظ البرنامج مسودة";
    }
  }

  function ensurePlanningBank() {
    if (!window.PlanningCore || typeof window.PlanningCore.load !== "function") {
      return Promise.resolve([]);
    }
    return window.PlanningCore.load();
  }

  function hideProgramBankHits() {
    if (!programBankHitsEl) {
      return;
    }
    programBankHitsEl.hidden = true;
    programBankHitsEl.innerHTML = "";
  }

  function programBankCodesFromRecord(program) {
    var codes = [];
    if (program && Array.isArray(program.bank_indicator_codes)) {
      program.bank_indicator_codes.forEach(function (item) {
        var code = String(item || "").trim();
        if (code && codes.indexOf(code) < 0) {
          codes.push(code);
        }
      });
    }
    if (!codes.length && program && program.indicator_codes) {
      String(program.indicator_codes).split(/[،,]/).forEach(function (item) {
        var code = String(item || "").trim();
        if (code && codes.indexOf(code) < 0) {
          codes.push(code);
        }
      });
    }
    return codes;
  }

  function clearProgramBank() {
    programBankCode = "";
    if (programBankQEl) {
      programBankQEl.value = "";
    }
    hideProgramBankHits();
    if (programBankActionsEl) {
      programBankActionsEl.innerHTML = "";
    }
    if (programBankActionsWrapEl) {
      programBankActionsWrapEl.hidden = true;
    }
    if (programBankMetaEl) {
      programBankMetaEl.hidden = true;
      programBankMetaEl.textContent = "";
    }
    if (programBankEvidenceEl) {
      programBankEvidenceEl.value = "";
    }
    if (programBankEvidenceWrapEl) {
      programBankEvidenceWrapEl.hidden = true;
    }
    if (programBankCommitteesEl) {
      programBankCommitteesEl.value = "";
    }
    if (programBankCommitteesWrapEl) {
      programBankCommitteesWrapEl.hidden = true;
    }
  }

  function syncMechanismFromBankChecks() {
    if (!programBankActionsEl) {
      return;
    }
    var chosen = [];
    programBankActionsEl.querySelectorAll("input[type='checkbox']").forEach(function (box) {
      if (box.checked) {
        chosen.push(box.getAttribute("data-text") || "");
      }
    });
    if (chosen.length) {
      setProgramField("mechanism", chosen.join("\n"));
    }
  }

  function paintProgramBankItem(item, options) {
    options = options || {};
    programBankCode = item && item.code ? item.code : "";
    hideProgramBankHits();
    if (programBankQEl && item) {
      programBankQEl.value = item.code + " — " + item.title;
    }
    if (programBankMetaEl) {
      var lines = [];
      if (item) {
        lines.push(item.code + " — " + item.title);
        lines.push("الشواهد المطلوبة: " + (item.evidence || "—"));
        lines.push("اللجان المعنية: " + (item.committees || "—"));
        if (item.expectations) {
          lines.push(item.expectations);
        }
        if (item.alternates && item.alternates.length) {
          lines.push("عبارة أخرى محفوظة بالرمز نفسه: " + item.alternates.join(" | "));
        }
      }
      programBankMetaEl.textContent = lines.join(" · ");
      programBankMetaEl.hidden = !item;
    }
    if (programBankActionsEl) {
      programBankActionsEl.innerHTML = "";
    }
    var procedures = item && Array.isArray(item.procedures) ? item.procedures : [];
    if (programBankActionsWrapEl) {
      programBankActionsWrapEl.hidden = !procedures.length;
    }
    var savedMechanism = options.mechanism || "";
    procedures.forEach(function (text, index) {
      if (!programBankActionsEl) {
        return;
      }
      var label = document.createElement("label");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.value = String(index);
      box.setAttribute("data-text", text);
      if (options.restoreChecks && savedMechanism.indexOf(text) >= 0) {
        box.checked = true;
      }
      var span = document.createElement("span");
      span.textContent = text;
      label.appendChild(box);
      label.appendChild(span);
      programBankActionsEl.appendChild(label);
    });
    if (programBankEvidenceEl) {
      programBankEvidenceEl.value = item && item.evidence ? item.evidence : "";
    }
    if (programBankEvidenceWrapEl) {
      programBankEvidenceWrapEl.hidden = !item;
    }
    if (programBankCommitteesEl) {
      programBankCommitteesEl.value = item && item.committees ? item.committees : "";
    }
    if (programBankCommitteesWrapEl) {
      programBankCommitteesWrapEl.hidden = !item;
    }
    if (!options.skipFill && item) {
      if (item.title) {
        setProgramField("program_name", item.title);
      }
      setProgramField("executive_goal", item.title || item.element || "");
      if (!programFieldValue("kpi_description") && item.title) {
        setProgramField("kpi_description", item.title);
      }
      if (item.evidence) {
        setProgramField("success_indicator", item.evidence);
      }
      if (item.committees) {
        setProgramField("implementers", item.committees);
      }
    }
  }

  function procedureOverlap(item, mechanism) {
    var saved = String(mechanism || "");
    if (!saved || !item || !item.procedures) {
      return 0;
    }
    var score = 0;
    item.procedures.forEach(function (text) {
      if (text && saved.indexOf(text) >= 0) {
        score += 1;
      }
    });
    return score;
  }

  function applyProgramBankCode(code, options) {
    options = options || {};
    return ensurePlanningBank().then(function () {
      var core = window.PlanningCore;
      if (!core || typeof core.getIndicator !== "function") {
        return null;
      }
      var list = typeof core.matches === "function" ? core.matches(code) : [];
      var item = core.getIndicator(code);
      if (!item) {
        return null;
      }
      var bestScore = procedureOverlap(item, options.mechanism);
      list.forEach(function (row) {
        var score = procedureOverlap(row, options.mechanism);
        if (score > bestScore) {
          item = row;
          bestScore = score;
        }
      });
      if (list.length > 1) {
        item = Object.assign({}, item, {
          alternates: list.filter(function (row) {
            return row.title !== item.title;
          }).map(function (row) {
            return row.title;
          })
        });
      }
      paintProgramBankItem(item, options);
      return item;
    });
  }

  function searchProgramBank() {
    var query = programBankQEl ? String(programBankQEl.value || "").trim() : "";
    hideProgramBankHits();
    if (!query) {
      return;
    }
    ensurePlanningBank().then(function () {
      var evalReady = window.EvaluationCore && typeof window.EvaluationCore.load === "function"
        ? window.EvaluationCore.load().catch(function () { return []; })
        : Promise.resolve([]);
      return evalReady.then(function () {
      if (!window.PlanningCore || typeof window.PlanningCore.search !== "function" || !programBankHitsEl) {
        return;
      }
      window.PlanningCore.search(query).forEach(function (item) {
        var li = document.createElement("li");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = item.code + " — " + item.title;
        btn.addEventListener("click", function () {
          paintProgramBankItem(item, {});
        });
        var noteText = window.EvaluationCore && typeof window.EvaluationCore.notice === "function"
          ? window.EvaluationCore.notice(item.code)
          : "";
        li.appendChild(btn);
        if (noteText) {
          var note = document.createElement("p");
          note.className = "aj-status";
          note.textContent = noteText;
          li.appendChild(note);
        }
        programBankHitsEl.appendChild(li);
      });
      if (window.EvaluationCore && typeof window.EvaluationCore.overallHint === "function" && programBankHitsEl.childElementCount) {
        var overall = document.createElement("li");
        overall.textContent = window.EvaluationCore.overallHint();
        programBankHitsEl.appendChild(overall);
      }
      programBankHitsEl.hidden = !programBankHitsEl.childElementCount;
      });
    });
  }

  function fillProgramFormFromRecord(program) {
    if (!program) {
      return;
    }
    if (programTemplateEl) {
      programTemplateEl.value = "";
    }
    programIndicatorIds = Array.isArray(program.indicator_ids)
      ? program.indicator_ids.map(function (item) { return Number(item); }).filter(function (item) { return item; })
      : [];
    programDutyRef = program.duty_ref ? String(program.duty_ref) : "";
    programTaskRef = program.task_ref ? String(program.task_ref) : "";
    setProgramField("program_name", program.program_name || "");
    setProgramField("goal_ref", program.goal_ref || "");
    setProgramField("strategic_goal", program.strategic_goal || "");
    setProgramField("executive_goal", program.executive_goal || "");
    setProgramField("domain", program.domain || "");
    setProgramField("level_name", program.level_name || "");
    setProgramField("target_audience", program.target_audience || "");
    setProgramField("duration", program.duration || "");
    setProgramField("implementers", program.implementers || "");
    setProgramField("budget", program.budget || "");
    setProgramField("mechanism", program.mechanism || "");
    setProgramField("success_indicator", program.success_indicator || "");
    setProgramField("risk_management", program.risk_management || "");
    setProgramField("register_id", program.register_id || "");
    setProgramField("unit", program.unit || "");
    setProgramField("baseline_value", program.baseline_value || "");
    setProgramField("target_value", program.target_value || "");
    setProgramField("kpi_description", program.kpi_description || "");
    var assigneeOn = !!(
      programGiftedAssignment
      && program.assignee_staff_id
      && String(program.assignee_staff_id) === String(programGiftedAssignment.staff_id)
    );
    fillProgramOwners(
      (programCatalog && programCatalog.owners) || [],
      program.owner_roles || [],
      assigneeOn
    );
    showProgramGoalHint(program.goal_ref || "");
    showProgramLinkHint(null);
    setProgramFormMode(program.id);
    var bankCodes = programBankCodesFromRecord(program);
    if (bankCodes.length) {
      applyProgramBankCode(bankCodes[0], {
        skipFill: true,
        restoreChecks: true,
        mechanism: program.mechanism || ""
      });
    } else {
      clearProgramBank();
    }
    if (window.AjStudentsLists && typeof window.AjStudentsLists.paintBanner === "function") {
      window.AjStudentsLists.paintBanner();
    }
  }

  function beginProgramEdit(programId) {
    var needle = Number(programId) || 0;
    if (!needle) {
      return;
    }
    var ready = currentProgramRecord && Number(currentProgramRecord.id) === needle
      ? Promise.resolve(currentProgramRecord)
      : fetch("/api/session/programs/" + encodeURIComponent(needle), {
        headers: authHeaders(),
        cache: "no-store"
      }).then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر فتح البرنامج للتعديل."));
          }
          return body;
        });
      });
    ready.then(function (program) {
      fillProgramFormFromRecord(program);
    }).catch(function (error) {
      showToast((error && error.message) || "تعذر فتح البرنامج للتعديل.", "error");
    });
  }

  function openProgramEditor() {
    if (!currentProgramRecord || !currentProgramRecord.id) {
      showToast("افتح برنامجاً أولاً.", "error");
      return;
    }
    window.location.hash = "view-program-add?id=" + encodeURIComponent(String(currentProgramRecord.id));
  }

  function openLastSavedProgram() {
    if (!lastSavedProgramId) {
      return;
    }
    window.location.hash = "view-program-add?id=" + encodeURIComponent(String(lastSavedProgramId));
  }

  function showProgramLinkHint(template) {
    if (!programLinkHintEl) {
      return;
    }
    if (!template) {
      programLinkHintEl.hidden = true;
      programLinkHintEl.textContent = "";
      return;
    }
    var codes = Array.isArray(template.indicator_codes) ? template.indicator_codes.filter(Boolean) : [];
    var parts = [];
    if (template.goal_ref) {
      parts.push("الهدف " + template.goal_ref);
    }
    if (codes.length) {
      parts.push("المؤشرات " + codes.join("، "));
    }
    if (template.register_id && programCatalog && Array.isArray(programCatalog.registers)) {
      var registerLabel = "";
      programCatalog.registers.forEach(function (item) {
        if (Number(item.id) === Number(template.register_id)) {
          registerLabel = item.label || "";
        }
      });
      if (registerLabel) {
        parts.push(registerLabel);
      }
    }
    programLinkHintEl.hidden = !parts.length;
    programLinkHintEl.textContent = parts.length ? "الربط: " + parts.join(" ← ") : "";
  }

  function applyProgramTemplate(template) {
    programIndicatorIds = template && Array.isArray(template.indicator_ids)
      ? template.indicator_ids.map(function (item) { return Number(item); }).filter(function (item) { return item; })
      : [];
    programDutyRef = template && template.duty_ref ? String(template.duty_ref) : "";
    programTaskRef = template && template.task_ref ? String(template.task_ref) : "";
    if (!template) {
      fillProgramOwners((programCatalog && programCatalog.owners) || [], []);
      showProgramGoalHint("");
      showProgramLinkHint(null);
      return;
    }
    var ownerRoles = Array.isArray(template.owner_roles) && template.owner_roles.length
      ? template.owner_roles
      : (template.owner_role ? [template.owner_role] : []);
    setProgramField("program_name", template.program_name || "");
    setProgramField("goal_ref", template.goal_ref || "");
    var goal = goalById(template.goal_ref || "");
    setProgramField("strategic_goal", template.strategic_goal || (goal && goal.text) || "");
    setProgramField("executive_goal", template.executive_goal || "");
    setProgramField("domain", template.domain || (goal && goal.domain) || "");
    setProgramField("level_name", template.level_name || "");
    setProgramField("target_audience", template.target_audience || "");
    setProgramField("duration", template.duration || "");
    setProgramField("implementers", template.implementers || "");
    setProgramField("budget", template.budget || "");
    setProgramField("mechanism", template.mechanism || "");
    setProgramField("success_indicator", template.success_indicator || "");
    setProgramField("risk_management", template.risk_management || "");
    setProgramField("register_id", template.register_id || "");
    fillProgramOwners(
      (programCatalog && programCatalog.owners) || [],
      ownerRoles,
      !!(template && template.key === "gifted" && programGiftedAssignment)
    );
    setProgramField("unit", template.unit || "");
    setProgramField("baseline_value", template.baseline_value || "");
    setProgramField("target_value", template.target_value || "");
    setProgramField("kpi_description", template.kpi_description || "");
    showProgramGoalHint(template.goal_ref || "");
    showProgramLinkHint(template);
    if (window.AjStudentsLists && typeof window.AjStudentsLists.paintBanner === "function") {
      window.AjStudentsLists.paintBanner();
    }
  }

  function selectedProgramTemplate() {
    if (!programTemplateEl || !programCatalog) {
      return null;
    }
    var key = String(programTemplateEl.value || "");
    var list = programCatalog.templates || [];
    for (var i = 0; i < list.length; i += 1) {
      if (String(list[i].key) === key) {
        return list[i];
      }
    }
    return null;
  }

  function programFieldValue(name) {
    if (!programFormEl || !programFormEl.elements[name]) {
      return "";
    }
    return String(programFormEl.elements[name].value || "").trim();
  }

  function boardStatusClass(displayStatus) {
    if (displayStatus === "done") {
      return "is-done";
    }
    if (displayStatus === "in_progress") {
      return "is-progress";
    }
    if (displayStatus === "draft") {
      return "is-new";
    }
    return "is-progress";
  }

  function renderProgramBoard() {
    if (!programBoardListEl) {
      return;
    }
    var counts = (programBoardCache && programBoardCache.counts) || {};
    if (programBoardCountDraftEl) {
      programBoardCountDraftEl.textContent = String(counts.draft || 0);
    }
    if (programBoardCountProgressEl) {
      programBoardCountProgressEl.textContent = String(counts.in_progress || 0);
    }
    if (programBoardCountDoneEl) {
      programBoardCountDoneEl.textContent = String(counts.done || 0);
    }
    if (programBoardFiltersEl) {
      Array.prototype.forEach.call(
        programBoardFiltersEl.querySelectorAll("[data-aj-program-filter]"),
        function (button) {
          var key = button.getAttribute("data-aj-program-filter") || "all";
          if (key === programBoardFilter) {
            button.classList.add("is-active");
          } else {
            button.classList.remove("is-active");
          }
        }
      );
    }
    var items = (programBoardCache && programBoardCache.items) || [];
    var visible = items.filter(function (item) {
      if (programBoardFilter === "all") {
        return true;
      }
      return String(item.display_status || "") === programBoardFilter;
    });
    programBoardListEl.innerHTML = "";
    visible.forEach(function (item) {
      var row = document.createElement("li");
      row.className = "aj-program-board-item";
      var name = document.createElement("button");
      name.type = "button";
      name.className = "aj-program-board-open";
      name.textContent = item.program_name || "برنامج";
      name.addEventListener("click", function () {
        if (item.id) {
          openPlanDetailsRoute(item.id);
        }
      });
      var tag = document.createElement("span");
      tag.className = "aj-tag " + boardStatusClass(item.display_status);
      tag.textContent = item.display_label || item.status || "";
      row.appendChild(name);
      row.appendChild(tag);
      programBoardListEl.appendChild(row);
    });
    setHidden(programBoardEmptyEl, !!visible.length);
  }

  function loadProgramBoard() {
    if (!programBoardListEl) {
      return Promise.resolve(programBoardCache);
    }
    setHidden(programBoardLoadingEl, false);
    return fetch("/api/session/program-board", {
      headers: authHeaders(),
      cache: "no-store"
    })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر قراءة لوحة البرامج."));
          }
          return body;
        });
      })
      .then(function (payload) {
        programBoardCache = payload || { counts: {}, items: [] };
        renderProgramBoard();
        return programBoardCache;
      })
      .catch(function () {
        programBoardCache = { counts: { draft: 0, in_progress: 0, done: 0, all: 0 }, items: [] };
        renderProgramBoard();
        return programBoardCache;
      })
      .finally(function () {
        setHidden(programBoardLoadingEl, true);
      });
  }

  function loadProgramForm() {
    var catalogReady = programCatalog
      ? Promise.resolve(programCatalog)
      : (function () {
        setHidden(programLoadingEl, false);
        setTextStatus(programStatusEl, "", false);
        setHidden(programErrorEl, true);
        return Promise.all([
          fetch("/api/knowledge-bank", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
            return response.json().then(function (body) {
              if (!response.ok) {
                throw new Error(apiErrorMessage(body, "تعذر قراءة الأهداف."));
              }
              return body;
            });
          }),
          fetch("/api/session/program-templates", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
            return response.json().then(function (body) {
              if (!response.ok) {
                throw new Error(apiErrorMessage(body, "تعذر قراءة القوالب."));
              }
              return body;
            });
          })
        ]).then(function (payloads) {
          var knowledge = payloads[0] || {};
          var catalog = payloads[1] || {};
          programGoals = Array.isArray(knowledge.goals) ? knowledge.goals : [];
          programMissingIds = Array.isArray(knowledge.missing) ? knowledge.missing.map(String) : [];
          programCatalog = catalog;
          fillSelect(
            programTemplateEl,
            (catalog.templates || []).map(function (item) {
              return { key: item.key, label: item.label || item.program_name || item.key };
            }),
            "— اختر قالباً —",
            "key",
            "label"
          );
          fillSelect(
            programFormEl ? programFormEl.elements.goal_ref : null,
            programGoals.map(function (goal) {
              return { id: goal.id, label: goal.id + " — " + (goal.text || "") };
            }),
            "— بلا ربط —",
            "id",
            "label"
          );
          fillSelect(
            programFormEl ? programFormEl.elements.register_id : null,
            catalog.registers || [],
            "— اختر —",
            "id",
            "label"
          );
          var unitSelect = programFormEl ? programFormEl.elements.unit : null;
          if (unitSelect && Array.isArray(catalog.units) && catalog.units.length) {
            fillSelect(
              unitSelect,
              catalog.units.map(function (unit) { return { id: unit, label: unit }; }),
              "— اختر —",
              "id",
              "label"
            );
          }
          setTextStatus(programStatusEl, "", false);
          return catalog;
        });
      }());
    return catalogReady.then(function (catalog) {
      return ensurePlanningBank().then(function () {
        return catalog;
      });
    }).then(function (catalog) {
      return refreshGiftedAssignment().then(function () {
        var keepRoles = selectedProgramOwners();
        var keepAssignee = assigneeOwnerChecked();
        fillProgramOwners((catalog && catalog.owners) || [], keepRoles, keepAssignee);
        loadProgramBoard();
        if (window.AjStudentsLists && typeof window.AjStudentsLists.paintBanner === "function") {
          window.AjStudentsLists.paintBanner();
        }
        return catalog;
      });
    }).catch(function (error) {
      setTextStatus(programStatusEl, (error && error.message) || "تعذر فتح نموذج البرنامج.", true);
    }).finally(function () {
      setHidden(programLoadingEl, true);
    });
  }

  function submitProgramForm() {
    if (programSaveInFlight) {
      return;
    }
    setHidden(programErrorEl, true);
    var name = programFieldValue("program_name");
    var audience = programFieldValue("target_audience");
    var duration = programFieldValue("duration");
    var implementers = programFieldValue("implementers");
    var mechanism = programFieldValue("mechanism");
    var success = programFieldValue("success_indicator");
    var registerId = Number(programFieldValue("register_id"));
    var owners = selectedProgramOwners();
    var assigneeId = "";
    if (assigneeOwnerChecked() && programGiftedAssignment && programGiftedAssignment.staff_id) {
      assigneeId = String(programGiftedAssignment.staff_id);
    } else if (editingProgramId && currentProgramRecord && Number(currentProgramRecord.id) === editingProgramId) {
      assigneeId = String(currentProgramRecord.assignee_staff_id || "");
    }
    if (!owners.length && assigneeId) {
      owners = ["teacher"];
    }
    var unit = programFieldValue("unit");
    if (!name || !audience || !duration || !implementers || !mechanism || !success) {
      if (programErrorEl) {
        programErrorEl.hidden = false;
        programErrorEl.textContent = "أكمل الحقول المطلوبة قبل الحفظ.";
      }
      return;
    }
    if (!registerId || !owners.length) {
      if (programErrorEl) {
        programErrorEl.hidden = false;
        programErrorEl.textContent = "اختر السجل وصاحب برنامج واحداً على الأقل.";
      }
      return;
    }
    if (unit && unit !== "%" && unit !== "عدد" && unit !== "نسبة") {
      if (programErrorEl) {
        programErrorEl.hidden = false;
        programErrorEl.textContent = "وحدة المؤشر تكون % أو عدد أو نسبة، أو تُترك فارغة.";
      }
      return;
    }
    programSaveInFlight = true;
    if (programSaveBtn) {
      programSaveBtn.disabled = true;
    }
    var saveUrl = editingProgramId
      ? "/api/session/programs/" + encodeURIComponent(String(editingProgramId))
      : "/api/session/programs";
    fetch(saveUrl, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        program_name: name,
        strategic_goal: programFieldValue("strategic_goal"),
        executive_goal: programFieldValue("executive_goal"),
        target_audience: audience,
        duration: duration,
        implementers: implementers,
        budget: programFieldValue("budget"),
        mechanism: mechanism,
        success_indicator: success,
        risk_management: programFieldValue("risk_management"),
        register_id: registerId,
        owner_role: owners[0],
        owner_roles: owners,
        indicator_ids: programIndicatorIds,
        indicator_codes: programBankCode ? [programBankCode] : [],
        baseline_value: programFieldValue("baseline_value"),
        target_value: programFieldValue("target_value"),
        unit: unit,
        kpi_description: programFieldValue("kpi_description"),
        goal_ref: programFieldValue("goal_ref"),
        domain: programFieldValue("domain"),
        level_name: programFieldValue("level_name"),
        duty_ref: programDutyRef,
        task_ref: programTaskRef,
        assignee_staff_id: assigneeId
      })
    })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر حفظ البرنامج."));
          }
          return body;
        });
      })
      .then(function (body) {
        var savedId = Number(body && body.id) || editingProgramId || 0;
        lastSavedProgramId = savedId;
        if (programReopenBtn) {
          programReopenBtn.hidden = !lastSavedProgramId;
        }
        window.dispatchEvent(
          new CustomEvent("app:program:saved", {
            detail: { name: name, id: lastSavedProgramId }
          })
        );
        showToast(editingProgramId ? "تم حفظ التعديل" : "تم حفظ البرنامج مسودة", "success");
        if (programFormEl) {
          programFormEl.reset();
        }
        fillProgramOwners((programCatalog && programCatalog.owners) || [], []);
        programIndicatorIds = [];
        programDutyRef = "";
        programTaskRef = "";
        showProgramGoalHint("");
        showProgramLinkHint(null);
        var editedId = editingProgramId;
        setProgramFormMode(0);
        planningLoaded = false;
        if (editedId) {
          openPlanDetailsRoute(editedId);
        }
      })
      .catch(function (error) {
        if (programErrorEl) {
          programErrorEl.hidden = false;
          programErrorEl.textContent = (error && error.message) || "تعذر حفظ البرنامج.";
        }
        showToast((error && error.message) || "تعذر حفظ البرنامج.", "error");
      })
      .finally(function () {
        programSaveInFlight = false;
        if (programSaveBtn) {
          programSaveBtn.disabled = false;
        }
      });
  }

  function loadPlanning(options) {
    options = options || {};
    if (options.force) {
      planningLoaded = false;
      planningCache = null;
    }
    if (planningLoading || !planCardsEl) {
      return Promise.resolve(planningCache);
    }
    if (planningLoaded && planningCache) {
      if (!options.silentBoard) {
        buildPlanningCards(planningCache);
      }
      return Promise.resolve(planningCache);
    }
    planningLoading = true;
    setHidden(planLoadingEl, false);
    setTextStatus(planStatusEl, "", false);
    setHidden(planEmptyEl, true);
    setHidden(planSummaryEl, true);
    if (!options.silentBoard) {
      planCardsEl.innerHTML = "";
    }

    return Promise.all([
      softFetch("/api/operational-plan"),
      softFetch("/api/programs")
    ])
      .then(function (payloads) {
        var plan = payloads[0];
        var programsPayload = payloads[1];
        var programs = (programsPayload && programsPayload.programs) || [];
        var data = {
          plan: plan,
          programs: programs,
          items: collectPlanningItems(plan || {}, programs)
        };
        console.log("Planning Data:", data);
        if (!plan && !programsPayload) {
          throw new Error("تعذر عرض بيانات التخطيط حالياً.");
        }
        planningCache = data;
        if (!options.silentBoard) {
          buildPlanningCards(data);
        }
        planningLoaded = true;
        setTextStatus(planStatusEl, "", false);
        window.dispatchEvent(
          new CustomEvent("app:plan:loaded", {
            detail: { at: Date.now() }
          })
        );
        return data;
      })
      .catch(function (error) {
        if (!options.silentBoard) {
          planCardsEl.innerHTML = "";
          setHidden(planEmptyEl, true);
          setHidden(planSummaryEl, true);
          setTextStatus(planStatusEl, error.message || "تعذر عرض التخطيط.", true);
        }
        throw error;
      })
      .finally(function () {
        planningLoading = false;
        setHidden(planLoadingEl, true);
      });
  }

  function staffText(value) {
    return String(value == null ? "" : value).trim();
  }

  function clearStaffBoard() {
    if (staffTbodyEl) {
      staffTbodyEl.textContent = "";
    }
    if (staffCardsEl) {
      staffCardsEl.textContent = "";
    }
  }

  function staffEditButton(person) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "aj-open-task";
    button.textContent = "تعديل";
    button.addEventListener("click", function () {
      openStaffForm(person);
    });
    return button;
  }

  function staffDeleteButton(person) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "aj-staff-delete";
    button.textContent = "حذف";
    button.addEventListener("click", function () {
      deleteStaff(person, button);
    });
    return button;
  }

  function deleteStaff(person, button) {
    var nationalId = staffText(person && person.id);
    var name = staffText(person && person.name);
    if (!nationalId || (button && button.disabled)) {
      return;
    }
    if (!window.confirm("حذف " + (name || nationalId) + " من سجل المنسوبين؟")) {
      return;
    }
    if (button) {
      button.disabled = true;
    }
    fetch("/api/session/staff/" + encodeURIComponent(nationalId), {
      method: "DELETE",
      headers: authHeaders(),
      cache: "no-store"
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(payload, "تعذر حذف المنسوب."));
          }
          return payload;
        });
      })
      .then(function () {
        showToast("تم الحذف", "info");
        window.dispatchEvent(new CustomEvent("app:staff:deleted", {
          detail: { id: nationalId }
        }));
      })
      .catch(function (error) {
        if (button) {
          button.disabled = false;
        }
        setTextStatus(staffStatusEl, (error && error.message) || "تعذر حذف المنسوب.", true);
      });
  }

  function appendStaffPair(list, label, value) {
    var row = document.createElement("div");
    var term = document.createElement("dt");
    var detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value;
    row.appendChild(term);
    row.appendChild(detail);
    list.appendChild(row);
  }

  function uniqueStaffValues(people, key) {
    var seen = {};
    var out = [];
    (people || []).forEach(function (person) {
      var value = staffText(person && person[key]);
      if (value && !seen[value]) {
        seen[value] = true;
        out.push(value);
      }
    });
    out.sort();
    return out;
  }

  function fillStaffFilter(el, values, allLabel) {
    if (!el) {
      return;
    }
    var current = el.value || "";
    el.innerHTML = "";
    var all = document.createElement("option");
    all.value = "";
    all.textContent = allLabel;
    el.appendChild(all);
    values.forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      el.appendChild(option);
    });
    if (current) {
      el.value = current;
    }
  }

  function visibleStaff() {
    var role = staffFilterRoleEl ? String(staffFilterRoleEl.value || "").trim() : "";
    var specialty = staffFilterSpecialtyEl ? String(staffFilterSpecialtyEl.value || "").trim() : "";
    var query = staffFilterQEl ? String(staffFilterQEl.value || "").trim() : "";
    return (staffCache || []).filter(function (person) {
      if (role && staffText(person.role) !== role) {
        return false;
      }
      if (specialty && staffText(person.specialty) !== specialty) {
        return false;
      }
      if (!query) {
        return true;
      }
      var hay = [person.name, person.id, person.role, person.specialty, person.mobile]
        .map(staffText)
        .join(" ");
      return hay.indexOf(query) >= 0;
    });
  }

  function paintStaffBoard() {
    fillStaffFilter(staffFilterRoleEl, uniqueStaffValues(staffCache, "role"), "كل الصفات");
    fillStaffFilter(staffFilterSpecialtyEl, uniqueStaffValues(staffCache, "specialty"), "كل التخصصات");
    buildStaffBoard(visibleStaff());
  }

  function printStaffRoster() {
    var rows = visibleStaff();
    if (!window.PrintTemplates || typeof window.PrintTemplates.renderTable !== "function") {
      setTextStatus(staffStatusEl, "قالب الطباعة غير محمّل.", true);
      return;
    }
    if (!rows.length) {
      setTextStatus(staffStatusEl, "لا أسماء في التصفية الحالية.", true);
      return;
    }
    var school = schoolNameEl ? String(schoolNameEl.textContent || "").trim() : "";
    var title = "كشف المنسوبين";
    var role = staffFilterRoleEl ? String(staffFilterRoleEl.value || "").trim() : "";
    var specialty = staffFilterSpecialtyEl ? String(staffFilterSpecialtyEl.value || "").trim() : "";
    if (role) {
      title += " — " + role;
    }
    if (specialty) {
      title += " — " + specialty;
    }
    var listData = {
      title: title,
      kind: "staff",
      specialty: specialty,
      columns: ["الاسم", "رقم الهوية", "الصفة", "التخصص"],
      rows: rows.map(function (person) {
        return [
          staffText(person.name),
          staffText(person.id),
          staffText(person.role),
          staffText(person.specialty)
        ];
      }),
      school: school,
      serial: true,
      signoff: true
    };
    function showStaffPrint(html) {
      if (!html || !window.AJPrint || typeof window.AJPrint.show !== "function") {
        return;
      }
      window.AJPrint.show(html, {
        pdfTitle: title,
        file: { kind: "staff", specialty: specialty },
        arm: { multiPage: true, list: true }
      });
    }
    function fallbackStaffPrint(columns) {
      var html = window.PrintTemplates.renderTable({
        title: title,
        columns: listData.columns,
        rows: listData.rows,
        school: school,
        signoff: true,
        signoffColumns: columns || [{ role: "مدير المدرسة", name: "", signature: "" }]
      });
      showStaffPrint(html);
    }
    function runStaffPrint(seats) {
      var core = window.PrintCore;
      if (!core || typeof core.generate !== "function") {
        fallbackStaffPrint(null);
        return;
      }
      var generated = core.generate({
        title: title,
        type: "table",
        data: listData,
        seats: seats,
        orientation: "portrait",
        headers: authHeaders()
      });
      function acceptStaffResult(result) {
        var html = window.PrintCore && typeof window.PrintCore.htmlOf === "function"
          ? window.PrintCore.htmlOf(result)
          : (result && result.html ? result.html : result);
        var warnings = window.PrintCore && typeof window.PrintCore.warningsOf === "function"
          ? window.PrintCore.warningsOf(result)
          : (result && result.warnings) || [];
        if (window.PrintCore && typeof window.PrintCore.allowAfterWarning === "function") {
          if (!window.PrintCore.allowAfterWarning(warnings)) {
            return;
          }
        }
        if (html) {
          showStaffPrint(html);
          return;
        }
        fallbackStaffPrint(null);
      }
      if (generated && typeof generated.then === "function") {
        generated.then(acceptStaffResult).catch(function () {
          fallbackStaffPrint(null);
        });
        return;
      }
      if (generated) {
        acceptStaffResult(generated);
        return;
      }
      fallbackStaffPrint(null);
    }
    fetch("/api/session/leadership", { headers: authHeaders(), cache: "no-store" }).then(function (response) {
      return response.json().then(function (body) {
        return response.ok && body ? body : {};
      });
    }).then(function (leadership) {
      var managerId = firstLeadershipId(leadership && leadership.manager);
      runStaffPrint([{
        role: "مدير المدرسة",
        id: managerId,
        name: staffNameById(staffCache, managerId)
      }]);
    }).catch(function () {
      runStaffPrint([{ role: "مدير المدرسة", id: "", name: "" }]);
    });
  }

  function buildStaffBoard(people) {
    clearStaffBoard();
    if (!people.length) {
      setHidden(staffSummaryEl, true);
      setHidden(staffEmptyEl, false);
      setHidden(staffTableWrapEl, true);
      setHidden(staffCardsEl, true);
      return;
    }
    if (staffSummaryEl) {
      var total = (staffCache || []).length;
      staffSummaryEl.textContent = people.length === total
        ? "السجل يضم " + people.length + " منسوبًا."
        : "المعروض " + people.length + " من " + total + " منسوبًا.";
    }
    setHidden(staffSummaryEl, false);
    setHidden(staffEmptyEl, true);
    setHidden(staffTableWrapEl, false);
    setHidden(staffCardsEl, false);
    people.forEach(function (person) {
      var name = staffText(person.name);
      var nationalId = staffText(person.id);
      var role = staffText(person.role);
      var specialty = staffText(person.specialty);
      var mobile = staffText(person.mobile);
      var status = person.active ? "نشط" : "غير نشط";
      var tr = document.createElement("tr");
      [name, nationalId, role, specialty, mobile, status].forEach(function (text, index) {
        var cell = document.createElement("td");
        cell.textContent = text;
        if (index === 5) {
          cell.className = "aj-staff-status";
        }
        tr.appendChild(cell);
      });
      var actionCell = document.createElement("td");
      actionCell.className = "aj-staff-action";
      actionCell.appendChild(staffEditButton(person));
      actionCell.appendChild(staffDeleteButton(person));
      tr.appendChild(actionCell);
      if (staffTbodyEl) {
        staffTbodyEl.appendChild(tr);
      }
      var card = document.createElement("li");
      card.className = "aj-card aj-staff-card";
      var title = document.createElement("h2");
      title.textContent = name;
      var list = document.createElement("dl");
      list.className = "aj-staff-dl";
      appendStaffPair(list, "رقم الهوية", nationalId);
      appendStaffPair(list, "الصفة", role);
      appendStaffPair(list, "التخصص", specialty);
      appendStaffPair(list, "الجوال", mobile);
      appendStaffPair(list, "الحالة", status);
      var actions = document.createElement("div");
      actions.className = "aj-task-actions";
      actions.appendChild(staffEditButton(person));
      actions.appendChild(staffDeleteButton(person));
      card.appendChild(title);
      card.appendChild(list);
      card.appendChild(actions);
      if (staffCardsEl) {
        staffCardsEl.appendChild(card);
      }
    });
  }

  function setStaffField(el, value) {
    if (el) {
      el.value = value;
    }
  }

  function openStaffForm(person) {
    if (!staffModalEl) {
      return;
    }
    var editing = !!(person && staffText(person.id));
    if (staffFormTitleEl) {
      staffFormTitleEl.textContent = editing ? "تعديل منسوب" : "إضافة منسوب";
    }
    setStaffField(staffOriginalIdEl, editing ? staffText(person.id) : "");
    setStaffField(staffNameEl, editing ? staffText(person.name) : "");
    setStaffField(staffNationalIdEl, editing ? staffText(person.id) : "");
    setStaffField(staffRoleEl, editing ? staffText(person.role) : "");
    setStaffField(staffSpecialtyEl, editing ? staffText(person.specialty) : "");
    setStaffField(staffMobileEl, editing ? staffText(person.mobile) : "");
    setStaffField(staffActiveEl, editing && !person.active ? "0" : "1");
    setHidden(staffFormErrorEl, true);
    if (staffFormErrorEl) {
      staffFormErrorEl.textContent = "";
    }
    if (staffSaveBtn) {
      staffSaveBtn.disabled = false;
    }
    staffSaveInFlight = false;
    staffModalEl.hidden = false;
    document.body.classList.add("aj-modal-open");
    if (staffNameEl) {
      staffNameEl.focus();
    }
  }

  function closeStaffForm() {
    if (!staffModalEl) {
      return;
    }
    staffModalEl.hidden = true;
    document.body.classList.remove("aj-modal-open");
    setHidden(staffFormErrorEl, true);
    if (staffSaveBtn) {
      staffSaveBtn.disabled = false;
    }
    staffSaveInFlight = false;
  }

  function showStaffFormError(message) {
    if (!staffFormErrorEl) {
      return;
    }
    staffFormErrorEl.textContent = message;
    staffFormErrorEl.hidden = false;
  }

  function submitStaffForm() {
    if (staffSaveInFlight) {
      return;
    }
    var name = staffText(staffNameEl ? staffNameEl.value : "");
    var nationalId = staffText(staffNationalIdEl ? staffNationalIdEl.value : "");
    if (!name || !nationalId) {
      showStaffFormError("الاسم ورقم الهوية مطلوبان");
      return;
    }
    staffSaveInFlight = true;
    if (staffSaveBtn) {
      staffSaveBtn.disabled = true;
    }
    setHidden(staffFormErrorEl, true);
    fetch("/api/session/staff", {
      method: "POST",
      headers: authHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        national_id: nationalId,
        original_id: staffText(staffOriginalIdEl ? staffOriginalIdEl.value : ""),
        name: name,
        role: staffText(staffRoleEl ? staffRoleEl.value : ""),
        specialty: staffText(staffSpecialtyEl ? staffSpecialtyEl.value : ""),
        mobile: staffText(staffMobileEl ? staffMobileEl.value : ""),
        active: !staffActiveEl || staffActiveEl.value !== "0"
      })
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(payload, "تعذر حفظ المنسوب."));
          }
          return payload;
        });
      })
      .then(function () {
        closeStaffForm();
        showToast("تم الحفظ بنجاح", "info");
        window.dispatchEvent(new CustomEvent("app:staff:saved", {
          detail: { id: nationalId }
        }));
      })
      .catch(function (error) {
        staffSaveInFlight = false;
        if (staffSaveBtn) {
          staffSaveBtn.disabled = false;
        }
        showStaffFormError((error && error.message) || "تعذر حفظ المنسوب.");
      });
  }

  function loadStaff(options) {
    options = options || {};
    if (staffLoading || !staffCardsEl) {
      return Promise.resolve(staffCache);
    }
    if (!options.force && staffLoaded && staffCache) {
      paintStaffBoard();
      return Promise.resolve(staffCache);
    }
    staffLoading = true;
    setHidden(staffLoadingEl, false);
    setTextStatus(staffStatusEl, "", false);
    setHidden(staffEmptyEl, true);
    setHidden(staffSummaryEl, true);
    setHidden(staffTableWrapEl, true);
    setHidden(staffCardsEl, true);
    clearStaffBoard();
    return softFetch("/api/noor/staff")
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.people)) {
          throw new Error("تعذر عرض سجل المنسوبين.");
        }
        staffCache = payload.people;
        paintStaffBoard();
        staffLoaded = true;
        setTextStatus(staffStatusEl, "", false);
        return staffCache;
      })
      .catch(function (error) {
        clearStaffBoard();
        setHidden(staffEmptyEl, true);
        setHidden(staffSummaryEl, true);
        setHidden(staffTableWrapEl, true);
        setHidden(staffCardsEl, true);
        setTextStatus(staffStatusEl, (error && error.message) || "تعذر عرض سجل المنسوبين.", true);
      })
      .finally(function () {
        staffLoading = false;
        setHidden(staffLoadingEl, true);
      });
  }

  function setCurrentSignature(dataUrl) {
    var value = String(dataUrl || "").trim();
    currentSignatureDataUrl = value.indexOf("data:image/") === 0 ? value : "";
    applyPrintedSignature();
    renderProfileView();
  }

  function fetchSessionSignatureDataUrl() {
    return fetch("/api/session/signature", {
      headers: authHeaders(),
      cache: "no-store"
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error(apiErrorMessage(payload, "تعذر قراءة التوقيع."));
        }
        return payload;
      });
    });
  }

  function clearPrintedSignature() {
    if (printedSignatureEl) {
      printedSignatureEl.removeAttribute("src");
      printedSignatureEl.hidden = true;
    }
    if (printedSignatureNameEl) {
      printedSignatureNameEl.textContent = "";
    }
  }

  function applyPrintedSignature() {
    var name = currentUser && currentUser.name ? currentUser.name : "";
    if (printedSignatureNameEl) {
      printedSignatureNameEl.textContent = name;
    }
    if (!printedSignatureEl) {
      return;
    }
    if (!currentSignatureDataUrl) {
      printedSignatureEl.removeAttribute("src");
      printedSignatureEl.hidden = true;
      return;
    }
    printedSignatureEl.src = currentSignatureDataUrl;
    printedSignatureEl.hidden = false;
  }

  var portfolioPrintState = { name: "", role: "", specialty: "", items: [] };

  function rememberPortfolioPrint(person, items) {
    var sessionName = currentUser && currentUser.name ? String(currentUser.name) : "";
    var sessionRole = currentUser && currentUser.role ? String(currentUser.role) : "";
    portfolioPrintState = {
      name: person && person.name ? String(person.name) : sessionName,
      role: person && person.role ? String(person.role) : sessionRole,
      specialty: person && person.specialty ? String(person.specialty) : "",
      items: Array.isArray(items) ? items.slice() : (portfolioPrintState.items || [])
    };
  }

  function printPortfolio() {
    var core = window.OfficialFrameCore;
    if (!core || typeof core.page !== "function" || typeof core.armPrintPage !== "function" || typeof core.ensureHost !== "function") {
      showToast("نواة الطباعة غير محمّلة.", "error");
      return;
    }
    var esc = core.escapeHtml;
    var state = portfolioPrintState;
    var lines = [
      "الاسم: " + (state.name || ""),
      "الصفة: " + (state.role || ""),
      "التخصص: " + (state.specialty || "")
    ];
    var html = lines.map(function (line) {
      return "<p>" + esc(line) + "</p>";
    }).join("");
    var evidenceItems = state.items || [];
    if (evidenceItems.length) {
      html += "<h2 class=\"aj-print-evidence-title\">الشواهد المرفقة</h2>";
      html += "<div class=\"tpl-evidence-stack is-centered\">";
      evidenceItems.forEach(function (item) {
        var name = item && item.name ? String(item.name) : "";
        if (item && String(item.kind || "") === "image" && item.dataUrl) {
          html += "<figure class=\"tpl-evidence-tile is-centered\">";
          html += "<img src=\"" + esc(item.dataUrl) + "\" alt=\"" + esc(name || "شاهد") + "\">";
          html += "</figure>";
        } else if (item && String(item.kind || "") === "image") {
          html += "<p>لا صور</p>";
        } else {
          html += "<p>" + esc(name || "مرفق") + "</p>";
        }
      });
      html += "</div>";
    }
    var fileTitle = state.name ? state.name : "سجل الإنجاز";
    var school = schoolNameEl ? String(schoolNameEl.textContent || "").trim() : "";
    showOfficialPreview(core.page({
      strictIdentity: true,
      title: "سجل الإنجاز",
      bodyHtml: "<div class=\"aj-print-slot\">" + html + "</div>",
      school: school,
      signoff: false,
      page: 1,
      total: 1
    }), { pdfTitle: fileTitle, arm: {} });
  }

  function portfolioKey() {
    return currentUser && currentUser.id != null ? String(currentUser.id).trim() : "";
  }

  function portfolioLine(label, value) {
    var row = document.createElement("p");
    var name = document.createElement("span");
    name.className = "aj-soft-label";
    name.textContent = label;
    row.appendChild(name);
    row.appendChild(document.createTextNode(value || ""));
    return row;
  }

  function appendPortfolioGoal(list, goal) {
    var card = document.createElement("li");
    card.className = "aj-card";
    var title = document.createElement("h2");
    title.textContent = [goal.id, goal.text].filter(Boolean).join(" — ");
    card.appendChild(title);
    if (goal.domain) {
      var domain = document.createElement("p");
      domain.textContent = goal.domain;
      card.appendChild(domain);
    }
    (goal.indicators || []).forEach(function (item) {
      var bits = [item.kpi, item.target, item.measurement].filter(Boolean);
      if (!bits.length) {
        return;
      }
      var line = document.createElement("p");
      line.textContent = bits.join(" · ");
      card.appendChild(line);
    });
    list.appendChild(card);
  }

  var PORTFOLIO_SPECIALTY_KEYWORDS = {
    "رياضيات": ["نواتج التعلم", "التحصيل", "نافس", "الرياضيات"],
    "عربي": ["القراءة", "اللغة العربية", "نواتج التعلم"]
  };

  function portfolioSuggestions(goals, specialty) {
    var keywords = PORTFOLIO_SPECIALTY_KEYWORDS[String(specialty || "").trim()];
    if (!keywords || !keywords.length) {
      return [];
    }
    return (goals || []).filter(function (goal) {
      var parts = [goal && goal.text, goal && goal.domain];
      ((goal && goal.indicators) || []).forEach(function (item) {
        parts.push(item && item.kpi, item && item.target, item && item.measurement);
      });
      var haystack = parts.filter(Boolean).join("\n");
      return keywords.some(function (word) {
        return haystack.indexOf(word) >= 0;
      });
    });
  }

  function renderPortfolioSuggestions(goals, specialty, bankFailed) {
    var listEl = document.getElementById("aj-portfolio-suggest");
    var emptyEl = document.getElementById("aj-portfolio-suggest-empty");
    var needle = String(specialty || "").trim();
    var matches = bankFailed ? [] : portfolioSuggestions(goals, needle);
    if (listEl) {
      listEl.innerHTML = "";
      matches.forEach(function (goal) {
        appendPortfolioGoal(listEl, goal);
      });
    }
    setHidden(emptyEl, bankFailed || !needle || matches.length > 0);
  }

  function renderPortfolio(person, goals, missing, staffMiss) {
    var identity = document.getElementById("aj-portfolio-identity");
    var goalsEl = document.getElementById("aj-portfolio-goals");
    var emptyEl = document.getElementById("aj-portfolio-empty");
    if (identity) {
      identity.innerHTML = "";
      var sessionName = currentUser && currentUser.name ? String(currentUser.name) : "";
      var sessionRole = currentUser && currentUser.role ? String(currentUser.role) : "";
      identity.appendChild(portfolioLine("الاسم", person && person.name ? person.name : sessionName));
      identity.appendChild(portfolioLine("الصفة", person && person.role ? person.role : sessionRole));
      identity.appendChild(portfolioLine("التخصص", person && person.specialty ? person.specialty : ""));
    }
    if (goalsEl) {
      goalsEl.innerHTML = "";
      (goals || []).forEach(function (goal) {
        appendPortfolioGoal(goalsEl, goal);
      });
    }
    setHidden(emptyEl, (goals || []).length > 0);
  }

  function renderPortfolioEvidence(items) {
    var listEl = document.getElementById("aj-portfolio-evidence");
    var emptyEl = document.getElementById("aj-portfolio-evidence-empty");
    if (!listEl) {
      return;
    }
    listEl.innerHTML = "";
    var list = Array.isArray(items) ? items : [];
    setHidden(emptyEl, list.length > 0);
    list.forEach(function (item) {
      var card = document.createElement("li");
      card.className = "aj-card";
      if (String(item.kind || "") === "image" && item.dataUrl) {
        var image = document.createElement("img");
        image.className = "aj-evidence-thumb";
        image.src = item.dataUrl;
        image.alt = item.name || "شاهد";
        image.loading = "lazy";
        card.appendChild(image);
      } else if (String(item.kind || "") === "image") {
        var empty = document.createElement("p");
        empty.className = "aj-card-meta";
        empty.textContent = "لا صور";
        card.appendChild(empty);
      }
      var title = document.createElement("h2");
      title.textContent = item.name || "";
      card.appendChild(title);
      if (item.id || item.url) {
        var openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "aj-detail-btn";
        openBtn.textContent = "معاينة";
        openBtn.addEventListener("click", function () {
          previewEvidenceCard(item);
        });
        var downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.className = "aj-detail-btn";
        downBtn.textContent = "تنزيل";
        downBtn.addEventListener("click", function () {
          downloadEvidenceFile(item);
        });
        card.appendChild(openBtn);
        card.appendChild(downBtn);
      }
      listEl.appendChild(card);
    });
  }

  function portfolioNotes(staffMiss, missing, extras, isError) {
    var notes = [];
    if (staffMiss) {
      notes.push("لا صف لهذا الحساب في سجل المنسوبين.");
    }
    if (missing && missing.length) {
      notes.push("أهداف غير محفوظة: " + missing.join("، "));
    }
    (extras || []).forEach(function (line) {
      if (line) {
        notes.push(line);
      }
    });
    setTextStatus(document.getElementById("aj-portfolio-status"), notes.join(" "), !!isError);
  }

  function uploadPortfolioEvidence(file, button) {
    var key = portfolioKey();
    if (!key) {
      setTextStatus(document.getElementById("aj-portfolio-status"), "لا حساب لربط الشاهد.", true);
      return;
    }
    if (!file || button.disabled) {
      return;
    }
    button.disabled = true;
    var form = new FormData();
    form.append("entity_type", "teacher_portfolio");
    form.append("entity_key", key);
    form.append("register_key", "teacher-portfolio");
    form.append("files", file, file.name || "evidence.bin");
    fetch("/api/visual-evidence", {
      method: "POST",
      headers: multipartAuthHeaders(),
      body: form
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok || !payload || !Array.isArray(payload.items)) {
            throw new Error(apiErrorMessage(payload, "تعذر رفع الشاهد."));
          }
          return payload;
        });
      })
      .then(function (payload) {
        renderPortfolioEvidence(payload.items);
        portfolioPrintState.items = payload.items.slice();
        setTextStatus(document.getElementById("aj-portfolio-status"), "تم رفع الشاهد.", false);
      })
      .catch(function (error) {
        setTextStatus(
          document.getElementById("aj-portfolio-status"),
          (error && error.message) || "تعذر رفع الشاهد.",
          true
        );
      })
      .finally(function () {
        button.disabled = false;
      });
  }

  function loadPortfolio() {
    var loadingEl = document.getElementById("aj-portfolio-loading");
    var statusEl = document.getElementById("aj-portfolio-status");
    setHidden(loadingEl, false);
    setTextStatus(statusEl, "", false);
    var sessionId = portfolioKey();
    var staffResult = { people: [], failed: false };
    var bankResult = { goals: [], missing: [], failed: false, message: "" };
    var evidenceResult = { items: [], failed: false, message: "" };
    var staffFetch = fetch("/api/noor/staff", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok || !body || !Array.isArray(body.people)) {
            throw new Error("staff");
          }
          staffResult.people = body.people;
        });
      })
      .catch(function () {
        staffResult.failed = true;
      });
    var bankFetch = fetch("/api/knowledge-bank", { headers: authHeaders(), cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok || !body || !Array.isArray(body.goals)) {
            throw new Error(apiErrorMessage(body, "تعذر قراءة بنك المعرفة."));
          }
          bankResult.goals = body.goals;
          bankResult.missing = body.missing || [];
        });
      })
      .catch(function (error) {
        bankResult.failed = true;
        bankResult.message = (error && error.message) || "تعذر قراءة بنك المعرفة.";
      });
    var evidenceFetch = sessionId
      ? fetch(
        "/api/session/visual-evidence?entity_type=teacher_portfolio&entity_key=" + encodeURIComponent(sessionId),
        { headers: authHeaders(), cache: "no-store" }
      )
        .then(function (response) {
          return response.json().then(function (body) {
            if (!response.ok || !body || !Array.isArray(body.items)) {
              throw new Error(apiErrorMessage(body, "تعذر قراءة الشواهد."));
            }
            evidenceResult.items = body.items;
          });
        })
        .catch(function (error) {
          evidenceResult.failed = true;
          evidenceResult.message = (error && error.message) || "تعذر قراءة الشواهد.";
        })
      : Promise.resolve();
    Promise.all([staffFetch, bankFetch, evidenceFetch]).then(function () {
      if (currentHashView() !== "view-portfolio") {
        return;
      }
      var person = null;
      staffResult.people.forEach(function (item) {
        if (item && String(item.id) === sessionId) {
          person = item;
        }
      });
      var staffMiss = !staffResult.failed && !person;
      renderPortfolio(
        person,
        bankResult.goals,
        bankResult.missing,
        staffMiss
      );
      renderPortfolioSuggestions(
        bankResult.goals,
        person && person.specialty,
        bankResult.failed
      );
      hydrateEvidenceList(evidenceResult.items || []).then(function (hydrated) {
        evidenceResult.items = hydrated;
        renderPortfolioEvidence(hydrated);
        rememberPortfolioPrint(person, hydrated);
      });
      if (bankResult.failed) {
        setHidden(document.getElementById("aj-portfolio-empty"), true);
      }
      if (evidenceResult.failed) {
        setHidden(document.getElementById("aj-portfolio-evidence-empty"), true);
      }
      var extras = [];
      if (staffResult.failed) {
        extras.push("تعذر قراءة سجل المنسوبين.");
      }
      if (bankResult.failed) {
        extras.push(bankResult.message);
      }
      if (evidenceResult.failed) {
        extras.push(evidenceResult.message);
      }
      portfolioNotes(
        staffMiss,
        bankResult.missing,
        extras,
        staffResult.failed || bankResult.failed || evidenceResult.failed
      );
    }).finally(function () {
      setHidden(loadingEl, true);
    });
  }

  function renderProfileView() {
    var name = currentUser && currentUser.name ? currentUser.name : "";
    var role = currentUser && currentUser.role ? currentUser.role : "";
    if (profileMetaEl) {
      profileMetaEl.textContent = name
        ? name + (role ? " · " + role : "")
        : "بيانات التوقيع للاستخدام في الوثائق الرسمية.";
    }
    if (profileSignerNameEl) {
      if (name) {
        profileSignerNameEl.hidden = false;
        profileSignerNameEl.textContent = name;
      } else {
        profileSignerNameEl.hidden = true;
        profileSignerNameEl.textContent = "";
      }
    }
    if (profileSignatureEl && profileSignatureEmptyEl) {
      if (currentSignatureDataUrl) {
        profileSignatureEl.src = currentSignatureDataUrl;
        profileSignatureEl.hidden = false;
        profileSignatureEmptyEl.hidden = true;
      } else {
        profileSignatureEl.removeAttribute("src");
        profileSignatureEl.hidden = true;
        profileSignatureEmptyEl.hidden = false;
      }
    }
  }

  function configureSignaturePadStyle() {
    if (!signaturePadCtx) {
      return;
    }
    signaturePadCtx.strokeStyle = SIGNATURE_INK;
    signaturePadCtx.lineWidth = 2.25;
    signaturePadCtx.lineCap = "round";
    signaturePadCtx.lineJoin = "round";
  }

  function resizeSignaturePad() {
    if (!signaturePadEl || !signaturePadCtx) {
      return;
    }
    var ratio = Math.max(window.devicePixelRatio || 1, 1);
    var rect = signaturePadEl.getBoundingClientRect();
    var cssWidth = Math.max(Math.floor(rect.width), 280);
    var cssHeight = 220;
    signaturePadEl.width = Math.floor(cssWidth * ratio);
    signaturePadEl.height = Math.floor(cssHeight * ratio);
    signaturePadEl.style.width = cssWidth + "px";
    signaturePadEl.style.height = cssHeight + "px";
    signaturePadCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    signaturePadCtx.clearRect(0, 0, cssWidth, cssHeight);
    configureSignaturePadStyle();
    signatureHasStroke = false;
  }

  function signaturePoint(event) {
    var rect = signaturePadEl.getBoundingClientRect();
    var source = event.touches && event.touches[0] ? event.touches[0] : event;
    return {
      x: source.clientX - rect.left,
      y: source.clientY - rect.top
    };
  }

  function beginSignatureStroke(event) {
    if (!signaturePadCtx || !signaturePadEl) {
      return;
    }
    event.preventDefault();
    signatureDrawing = true;
    var point = signaturePoint(event);
    signaturePadCtx.beginPath();
    signaturePadCtx.moveTo(point.x, point.y);
  }

  function drawSignatureStroke(event) {
    if (!signatureDrawing || !signaturePadCtx) {
      return;
    }
    event.preventDefault();
    var point = signaturePoint(event);
    signaturePadCtx.lineTo(point.x, point.y);
    signaturePadCtx.stroke();
    signatureHasStroke = true;
  }

  function endSignatureStroke() {
    signatureDrawing = false;
  }

  function setSignatureUploadStatus(message, isError) {
    if (!signatureUploadStatusEl) {
      return;
    }
    if (!message) {
      signatureUploadStatusEl.hidden = true;
      signatureUploadStatusEl.textContent = "";
      signatureUploadStatusEl.classList.remove("is-error");
      return;
    }
    signatureUploadStatusEl.hidden = false;
    signatureUploadStatusEl.textContent = message;
    signatureUploadStatusEl.classList.toggle("is-error", !!isError);
  }

  function clearUploadedSignaturePreview() {
    uploadedSignatureDataUrl = "";
    if (signatureUploadPreviewEl) {
      signatureUploadPreviewEl.removeAttribute("src");
      signatureUploadPreviewEl.hidden = true;
    }
    setHidden(signatureUploadPreviewWrapEl, true);
    setSignatureUploadStatus("");
    if (signatureFileEl) {
      signatureFileEl.value = "";
    }
  }

  function setSignatureInputMode(mode) {
    signatureInputMode = mode === "upload" ? "upload" : "draw";
    var isUpload = signatureInputMode === "upload";
    if (signatureModeDrawBtn) {
      signatureModeDrawBtn.classList.toggle("is-active", !isUpload);
      signatureModeDrawBtn.setAttribute("aria-selected", isUpload ? "false" : "true");
      signatureModeDrawBtn.tabIndex = isUpload ? -1 : 0;
    }
    if (signatureModeUploadBtn) {
      signatureModeUploadBtn.classList.toggle("is-active", isUpload);
      signatureModeUploadBtn.setAttribute("aria-selected", isUpload ? "true" : "false");
      signatureModeUploadBtn.tabIndex = isUpload ? 0 : -1;
    }
    if (signatureDrawPanelEl) {
      signatureDrawPanelEl.hidden = !!isUpload;
      signatureDrawPanelEl.setAttribute("aria-hidden", isUpload ? "true" : "false");
    }
    if (signatureUploadPanelEl) {
      signatureUploadPanelEl.hidden = !isUpload;
      signatureUploadPanelEl.setAttribute("aria-hidden", isUpload ? "false" : "true");
    }
    setHidden(signatureFormErrorEl, true);
    if (signatureModalHintEl) {
      signatureModalHintEl.textContent = isUpload
        ? "ارفع صورة التوقيع من الجوال أو الكمبيوتر، راجع المعاينة، ثم أقرّ واحفظ."
        : "ارسم توقيعك بالحبر الأزرق داخل الإطار، ثم أقرّ واحفظ.";
    }
    if (!isUpload) {
      window.setTimeout(function () {
        resizeSignaturePad();
      }, 30);
    }
  }

  function clearSignaturePad() {
    if (signaturePadEl && signaturePadCtx) {
      var rect = signaturePadEl.getBoundingClientRect();
      signaturePadCtx.clearRect(0, 0, rect.width, rect.height);
      configureSignaturePadStyle();
    }
    signatureHasStroke = false;
    clearUploadedSignaturePreview();
    if (signatureAckEl) {
      signatureAckEl.checked = false;
    }
    setHidden(signatureFormErrorEl, true);
  }

  function exportSignaturePng() {
    if (!signaturePadEl) {
      return "";
    }
    return signaturePadEl.toDataURL("image/png");
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("تعذر قراءة صورة التوقيع."));
      };
      reader.readAsDataURL(blob);
    });
  }

  function loadSignExtractModule() {
    if (!signExtractModulePromise) {
      signExtractModulePromise = import(SIGNATURE_EXTRACT_CDN).catch(function (error) {
        signExtractModulePromise = null;
        throw error;
      });
    }
    return signExtractModulePromise;
  }

  function showUploadedSignaturePreview(dataUrl) {
    uploadedSignatureDataUrl = dataUrl || "";
    if (!uploadedSignatureDataUrl || !signatureUploadPreviewEl) {
      clearUploadedSignaturePreview();
      return;
    }
    signatureUploadPreviewEl.src = uploadedSignatureDataUrl;
    signatureUploadPreviewEl.hidden = false;
    setHidden(signatureUploadPreviewWrapEl, false);
  }

  function extractSignatureFromFile(file) {
    if (!file) {
      return Promise.reject(new Error("اختر صورة التوقيع أولاً."));
    }
    if (!String(file.type || "").startsWith("image/")) {
      return Promise.reject(new Error("الملف المختار ليس صورة."));
    }
    signatureExtractInFlight = true;
    if (signatureUploadBtn) {
      signatureUploadBtn.disabled = true;
    }
    setSignatureUploadStatus("جاري تنظيف الخلفية واستخراج التوقيع…", false);
    setHidden(signatureFormErrorEl, true);
    return loadSignExtractModule()
      .then(function (mod) {
        if (!mod || typeof mod.extractSignature !== "function") {
          throw new Error("تعذر تحميل مكتبة استخراج التوقيع.");
        }
        return mod.extractSignature(file, {
          thresholdAdjust: 10,
          cleanup: 2,
          maxWidth: 800
        });
      })
      .then(function (result) {
        if (!result || !result.blob) {
          throw new Error("لم يُستخرج توقيع صالح من الصورة.");
        }
        return blobToDataUrl(result.blob);
      })
      .then(function (dataUrl) {
        if (!dataUrl || dataUrl.indexOf("data:image/png") !== 0) {
          throw new Error("تعذر تحويل التوقيع المستخرج إلى PNG.");
        }
        showUploadedSignaturePreview(dataUrl);
        setSignatureUploadStatus("تمت إزالة الخلفية. راجع المعاينة ثم احفظ.", false);
        return dataUrl;
      })
      .finally(function () {
        signatureExtractInFlight = false;
        if (signatureUploadBtn) {
          signatureUploadBtn.disabled = false;
        }
      });
  }

  function openSignatureModal(options) {
    options = options || {};
    if (!signatureModalEl) {
      return;
    }
    signatureModalRequired = !!options.required;
    signatureModalEl.classList.toggle("is-required", signatureModalRequired);
    signatureModalEl.hidden = false;
    document.body.classList.add("aj-modal-open");
    if (signatureModalHintEl) {
      signatureModalHintEl.textContent = signatureModalRequired
        ? "يجب تسجيل توقيعك مرة واحدة قبل متابعة استخدام الرحلة (رسم أو رفع صورة)."
        : "ارسم توقيعك الجديد أو ارفع صورة توقيع، ثم أقرّ واحفظ للتحديث.";
    }
    setSignatureInputMode("draw");
    window.setTimeout(function () {
      resizeSignaturePad();
      clearSignaturePad();
    }, 30);
  }

  function closeSignatureModal() {
    if (signatureModalRequired) {
      return;
    }
    if (!signatureModalEl) {
      return;
    }
    signatureModalEl.hidden = true;
    document.body.classList.remove("aj-modal-open");
    setHidden(signatureFormErrorEl, true);
  }

  function persistSignatureUpsert(dataUrl) {
    return fetch("/api/session/signature", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ signature: dataUrl })
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          throw new Error(apiErrorMessage(payload, "تعذر حفظ التوقيع على الخادم."));
        }
        return payload;
      });
    });
  }

  function resolveSignatureDataUrlForSave() {
    if (signatureInputMode === "upload") {
      if (!uploadedSignatureDataUrl || uploadedSignatureDataUrl.indexOf("data:image/png") !== 0) {
        return { error: "ارفع صورة التوقيع وانتظر اكتمال التنظيف أولاً." };
      }
      return { dataUrl: uploadedSignatureDataUrl };
    }
    if (!signatureHasStroke) {
      return { error: "ارسم التوقيع أولاً." };
    }
    var dataUrl = exportSignaturePng();
    if (!dataUrl || dataUrl.indexOf("data:image/png") !== 0) {
      return { error: "تعذر تصدير التوقيع." };
    }
    return { dataUrl: dataUrl };
  }

  function saveSignatureFromPad() {
    if (signatureSaveInFlight || signatureExtractInFlight) {
      return;
    }
    setHidden(signatureFormErrorEl, true);
    if (!currentUser || !currentUser.id) {
      if (signatureFormErrorEl) {
        signatureFormErrorEl.hidden = false;
        signatureFormErrorEl.textContent = "يلزم تسجيل الدخول لحفظ التوقيع.";
      }
      return;
    }
    if (!signatureAckEl || !signatureAckEl.checked) {
      if (signatureFormErrorEl) {
        signatureFormErrorEl.hidden = false;
        signatureFormErrorEl.textContent = "يلزم الإقرار قبل حفظ التوقيع.";
      }
      return;
    }
    var resolved = resolveSignatureDataUrlForSave();
    if (resolved.error) {
      if (signatureFormErrorEl) {
        signatureFormErrorEl.hidden = false;
        signatureFormErrorEl.textContent = resolved.error;
      }
      return;
    }
    var dataUrl = resolved.dataUrl;
    signatureSaveInFlight = true;
    if (signatureSaveBtn) {
      signatureSaveBtn.disabled = true;
    }
    persistSignatureUpsert(dataUrl)
      .then(function (payload) {
        console.log("Signature Upsert:", payload);
        setCurrentSignature((payload && payload.signature_data_url) || dataUrl);
        if (currentUser) {
          currentUser.signature_path = (payload && payload.signature_path) || "";
        }
        signatureModalRequired = false;
        if (signatureModalEl) {
          signatureModalEl.classList.remove("is-required");
          signatureModalEl.hidden = true;
        }
        document.body.classList.remove("aj-modal-open");
        window.dispatchEvent(
          new CustomEvent("app:signature:saved", {
            detail: {
              id: currentUser && currentUser.id ? currentUser.id : "",
              signature_path: (payload && payload.signature_path) || ""
            }
          })
        );
        showToast("تم حفظ التوقيع وتحديث الملف.", "success");
      })
      .catch(function (error) {
        if (signatureFormErrorEl) {
          signatureFormErrorEl.hidden = false;
          signatureFormErrorEl.textContent = error.message || "تعذر حفظ التوقيع.";
        }
        showToast(error.message || "تعذر حفظ التوقيع.", "error");
      })
      .finally(function () {
        signatureSaveInFlight = false;
        if (signatureSaveBtn) {
          signatureSaveBtn.disabled = false;
        }
      });
  }

  function bindSignaturePadEvents() {
    if (!signaturePadEl) {
      return;
    }
    signaturePadCtx = signaturePadEl.getContext("2d");
    signaturePadEl.addEventListener("mousedown", beginSignatureStroke);
    signaturePadEl.addEventListener("mousemove", drawSignatureStroke);
    window.addEventListener("mouseup", endSignatureStroke);
    signaturePadEl.addEventListener("touchstart", beginSignatureStroke, { passive: false });
    signaturePadEl.addEventListener("touchmove", drawSignatureStroke, { passive: false });
    signaturePadEl.addEventListener("touchend", endSignatureStroke);
    signaturePadEl.addEventListener("touchcancel", endSignatureStroke);
    window.addEventListener("resize", function () {
      if (signatureModalEl && !signatureModalEl.hidden) {
        resizeSignaturePad();
      }
    });
  }

  function bootstrapUserSignature() {
    if (authCheckInFlight) {
      return Promise.resolve(null);
    }
    authCheckInFlight = true;
    showAuthGate("جارٍ التحقق من الجلسة...", false);
    var stored = readStoredSession();
    if (!stored || !String(stored.token || "").trim()) {
      authCheckInFlight = false;
      redirectToLogin();
      return Promise.resolve(null);
    }
    var controller = new AbortController();
    var timer = window.setTimeout(function () {
      controller.abort();
    }, 12000);
    return fetch("/api/session", {
      headers: authHeaders(),
      cache: "no-store",
      signal: controller.signal
    })
      .then(function (response) {
        window.clearTimeout(timer);
        if (response.status === 401) {
          clearStoredSession();
          redirectToLogin();
          return null;
        }
        if (!response.ok) {
          throw new Error("server");
        }
        return response.json();
      })
      .then(function (user) {
        if (!user) {
          return null;
        }
        if (user.must_change_password) {
          window.location.replace("login.html?change=1");
          return null;
        }
        if (!user.id) {
          clearStoredSession();
          redirectToLogin();
          return null;
        }
        revealShell(user);
        var path = String(user.signature_path || "").trim();
        if (!path) {
          setCurrentSignature("");
          openSignatureModal({ required: true });
          return user;
        }
        return fetchSessionSignatureDataUrl()
          .then(function (payload) {
            var dataUrl = payload && payload.signature_data_url ? payload.signature_data_url : "";
            if (dataUrl) {
              setCurrentSignature(dataUrl);
            } else {
              setCurrentSignature("");
              openSignatureModal({ required: true });
            }
            return user;
          })
          .catch(function () {
            setCurrentSignature("");
            openSignatureModal({ required: true });
            return user;
          });
      })
      .catch(function () {
        window.clearTimeout(timer);
        showAuthGate("تعذر الاتصال بالخادم. تحقق من الشبكة وحاول مجدداً.", true);
        return null;
      })
      .finally(function () {
        authCheckInFlight = false;
      });
  }

  if (signatureClearBtn) {
    signatureClearBtn.addEventListener("click", clearSignaturePad);
  }
  if (signatureSaveBtn) {
    signatureSaveBtn.addEventListener("click", saveSignatureFromPad);
  }
  if (signatureModeDrawBtn) {
    signatureModeDrawBtn.addEventListener("click", function () {
      setSignatureInputMode("draw");
    });
  }
  if (signatureModeUploadBtn) {
    signatureModeUploadBtn.addEventListener("click", function () {
      setSignatureInputMode("upload");
    });
  }
  if (signatureUploadBtn && signatureFileEl) {
    signatureUploadBtn.addEventListener("click", function () {
      if (signatureExtractInFlight) {
        return;
      }
      signatureFileEl.click();
    });
    signatureFileEl.addEventListener("change", function () {
      var file = signatureFileEl.files && signatureFileEl.files[0] ? signatureFileEl.files[0] : null;
      if (!file) {
        return;
      }
      setSignatureInputMode("upload");
      extractSignatureFromFile(file).catch(function (error) {
        clearUploadedSignaturePreview();
        var message = error && error.message ? error.message : "تعذر استخراج التوقيع من الصورة.";
        setSignatureUploadStatus(message, true);
        if (signatureFormErrorEl) {
          signatureFormErrorEl.hidden = false;
          signatureFormErrorEl.textContent = message;
        }
        showToast(message, "error");
      });
    });
  }
  if (signatureModalEl) {
    signatureModalEl.addEventListener("click", function (event) {
      if (event.target && event.target.id === "signature-modal-backdrop") {
        closeSignatureModal();
      }
    });
  }
  var portfolioUploadBtn = document.getElementById("aj-portfolio-upload");
  var portfolioFileEl = document.getElementById("aj-portfolio-file");
  var leadershipFormEl = document.getElementById("aj-leadership-form");
  if (leadershipFormEl) {
    leadershipFormEl.addEventListener("click", function (event) {
      var remove = event.target && event.target.closest ? event.target.closest("[data-leadership-remove]") : null;
      if (remove) {
        var row = remove.closest(".aj-leadership-row");
        var list = row ? row.parentNode : null;
        if (row) {
          row.remove();
        }
        if (list && !list.querySelector("select")) {
          list.appendChild(leadershipRow("", true));
        }
        return;
      }
      var button = event.target && event.target.closest ? event.target.closest("[data-leadership-add]") : null;
      if (!button) {
        return;
      }
      var host = document.getElementById(button.getAttribute("data-leadership-add") || "");
      if (!host) {
        return;
      }
      host.appendChild(host.getAttribute("data-leadership-rows") === "1" ? leadershipRow("", true) : leadershipSelect(""));
    });
  }
  var leadershipSaveBtn = document.getElementById("aj-leadership-save");
  if (leadershipSaveBtn) {
    leadershipSaveBtn.addEventListener("click", function () {
      saveLeadership(leadershipSaveBtn);
    });
  }
  var schoolSaveBtn = document.getElementById("aj-school-save");
  if (schoolSaveBtn) {
    schoolSaveBtn.addEventListener("click", function () {
      saveSchoolSettings(schoolSaveBtn);
    });
  }
  var portfolioPrintBtn = document.getElementById("aj-portfolio-print");
  if (portfolioPrintBtn) {
    portfolioPrintBtn.addEventListener("click", printPortfolio);
  }
  if (portfolioUploadBtn && portfolioFileEl) {
    portfolioUploadBtn.addEventListener("click", function () {
      portfolioFileEl.click();
    });
    portfolioFileEl.addEventListener("change", function () {
      var file = portfolioFileEl.files && portfolioFileEl.files[0];
      if (!file) {
        return;
      }
      uploadPortfolioEvidence(file, portfolioUploadBtn);
      portfolioFileEl.value = "";
    });
  }
  if (profileEditBtn) {
    profileEditBtn.addEventListener("click", function () {
      openSignatureModal({ required: false });
    });
  }

  bindSignaturePadEvents();

  document.querySelectorAll(".aj-sidebar .aj-stage-toggle, .aj-sidebar .aj-home-link, .aj-sidebar .aj-legacy-link, .aj-sidebar .aj-logout-btn").forEach(function (node) {
    if (!node.getAttribute("title")) {
      node.setAttribute("title", String(node.textContent || "").trim());
    }
  });

  stageButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var hub = button.getAttribute("data-aj-station-hub") || "";
      var id = button.getAttribute("data-aj-stage") || "";
      if (hub) {
        if (window.location.hash === hub) {
          openStage(button.getAttribute("aria-expanded") === "true" ? "" : id);
          return;
        }
        window.location.hash = hub.replace(/^#/, "");
        return;
      }
      var expanded = button.getAttribute("aria-expanded") === "true";
      openStage(expanded ? "" : id);
    });
  });

  if (window.matchMedia) {
    var fieldMq = window.matchMedia(FIELD_MODE_MQ);
    var onFieldChange = function () {
      syncAdaptiveMode();
      if (document.body.classList.contains("aj-auth-ready")) {
        router();
      }
    };
    if (typeof fieldMq.addEventListener === "function") {
      fieldMq.addEventListener("change", onFieldChange);
    } else if (typeof fieldMq.addListener === "function") {
      fieldMq.addListener(onFieldChange);
    }
  }

  if (menuOpen) {
    menuOpen.addEventListener("click", function () {
      setDrawer(!document.body.classList.contains("aj-drawer-open"));
    });
  }
  if (menuOpenBottom) {
    menuOpenBottom.addEventListener("click", function () {
      setDrawer(true);
    });
  }
  if (backdrop) {
    backdrop.addEventListener("click", function () {
      setDrawer(false);
    });
  }

  document.querySelectorAll('a[href^="#view-"]').forEach(function (link) {
    link.addEventListener("click", function () {
      setDrawer(false);
      if (isFieldMode()) {
        openStage("");
      }
    });
  });

  if (document.getElementById("aj-main")) {
    document.getElementById("aj-main").addEventListener("click", function () {
      if (isFieldMode()) {
        openStage("");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      clearStoredSession();
      redirectToLogin();
    });
  }
  if (authRetryBtn) {
    authRetryBtn.addEventListener("click", function () {
      bootstrapUserSignature().then(function (user) {
        if (user && user.id) {
          router();
        }
      });
    });
  }

  var journeyBusBusy = {};

  function viewIsOpen(viewId) {
    var node = document.getElementById(viewId);
    return !!(node && !node.hidden);
  }

  function bindJourneyBus() {
    var routes = {
      "app:task:completed": function () {
        return loadTodayTasks({
          force: true,
          silentBoard: !viewIsOpen("view-tasks")
        });
      },
      "app:council:created": function () {
        return loadCouncils({
          force: true,
          silentBoard: !viewIsOpen("view-execution")
        });
      },
      "app:evidence:attached": function () {
        loadProgramBoard();
        if (currentProgramRecord && currentProgramRecord.id) {
          loadProgramPrintBundle(currentProgramRecord.id).catch(function () {});
        }
        return loadEvidence({ force: true });
      },
      "app:program:saved": function () {
        loadProgramBoard();
        return loadPlanning({
          force: true,
          silentBoard: !viewIsOpen("view-planning")
        });
      },
      "app:program:approved": function () {
        loadProgramBoard();
        return loadPlanning({
          force: true,
          silentBoard: !viewIsOpen("view-planning")
        });
      },
      "app:signature:saved": function () {
        renderProfileView();
      },
      "app:staff:saved": function () {
        return loadStaff({ force: true });
      },
      "app:staff:deleted": function () {
        return loadStaff({ force: true });
      },
      "app:settings:saved": function () {
        var jobs = [loadSchoolName()];
        if (viewIsOpen("view-school")) {
          jobs.push(loadSchoolSettings());
        }
        return Promise.all(jobs);
      },
      "app:leadership:saved": function () {
        if (!viewIsOpen("view-leadership")) {
          return Promise.resolve();
        }
        return loadLeadership();
      }
    };
    Object.keys(routes).forEach(function (name) {
      window.addEventListener(name, function () {
        if (journeyBusBusy[name]) {
          return;
        }
        journeyBusBusy[name] = true;
        var result;
        try {
          result = routes[name]();
        } catch (error) {
          journeyBusBusy[name] = false;
          return;
        }
        if (result && typeof result.then === "function") {
          result.then(release, release);
        } else {
          journeyBusBusy[name] = false;
        }
        function release() {
          journeyBusBusy[name] = false;
        }
      });
    });
  }

  if (programTemplateEl) {
    programTemplateEl.addEventListener("change", function () {
      applyProgramTemplate(selectedProgramTemplate());
    });
  }
  if (programBankQEl) {
    programBankQEl.addEventListener("input", searchProgramBank);
    programBankQEl.addEventListener("focus", function () {
      if (String(programBankQEl.value || "").trim()) {
        searchProgramBank();
      }
    });
  }
  if (programBankActionsEl) {
    programBankActionsEl.addEventListener("change", syncMechanismFromBankChecks);
  }
  document.addEventListener("click", function (event) {
    if (!programBankHitsEl || programBankHitsEl.hidden) {
      return;
    }
    if (programBankQEl && programBankQEl.contains(event.target)) {
      return;
    }
    if (programBankHitsEl.contains(event.target)) {
      return;
    }
    hideProgramBankHits();
  });
  if (programFormEl && programFormEl.elements.goal_ref) {
    programFormEl.elements.goal_ref.addEventListener("change", function () {
      showProgramGoalHint(programFieldValue("goal_ref"));
    });
  }
  if (programFormEl) {
    programFormEl.addEventListener("submit", function (event) {
      event.preventDefault();
      submitProgramForm();
    });
  }
  if (giftedAssignBtn) {
    giftedAssignBtn.addEventListener("click", function () {
      openGiftedAssignModal();
    });
  }
  if (giftedAssignFormEl) {
    giftedAssignFormEl.addEventListener("submit", function (event) {
      event.preventDefault();
      submitGiftedAssignment();
    });
  }
  if (giftedAssignModalEl) {
    giftedAssignModalEl.addEventListener("click", function (event) {
      if (event.target && event.target.getAttribute("data-aj-gifted-close") !== null) {
        closeGiftedAssignModal();
      }
    });
  }
  if (programReopenBtn) {
    programReopenBtn.addEventListener("click", function () {
      openLastSavedProgram();
    });
  }
  if (programBoardFiltersEl) {
    programBoardFiltersEl.addEventListener("click", function (event) {
      var button = event.target && event.target.closest
        ? event.target.closest("[data-aj-program-filter]")
        : null;
      if (!button) {
        return;
      }
      programBoardFilter = button.getAttribute("data-aj-program-filter") || "all";
      renderProgramBoard();
    });
  }

  var findForm = document.getElementById("aj-find");
  var findQuery = document.getElementById("aj-find-q");
  var findHits = document.getElementById("aj-find-hits");
  function paintFindHits(items) {
    if (!findHits) {
      return;
    }
    var list = Array.isArray(items) ? items : [];
    if (!list.length) {
      findHits.innerHTML = "<li class=\"aj-meta\">لا نتيجة محفوظة لهذا البحث.</li>";
      findHits.hidden = false;
      return;
    }
    findHits.innerHTML = list.map(function (item) {
      var href = String(item.href || "#view-home");
      var kind = String(item.kind || "");
      var title = String(item.title || "");
      var note = String(item.note || "");
      return "<li><a href=\"" + href.replace(/\"/g, "") + "\">" + witnessLabel(kind) + " · " + witnessLabel(title)
        + (note ? " · " + witnessLabel(note) : "") + "</a></li>";
    }).join("");
    findHits.hidden = false;
  }
  if (findForm && findQuery) {
    findForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var query = String(findQuery.value || "").trim();
      if (query.length < 2) {
        if (findHits) {
          findHits.innerHTML = "<li class=\"aj-meta\">اكتب حرفين على الأقل.</li>";
          findHits.hidden = false;
        }
        return;
      }
      fetch("/api/session/search?q=" + encodeURIComponent(query), {
        headers: authHeaders(),
        cache: "no-store"
      }).then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) {
            throw new Error(apiErrorMessage(body, "تعذر البحث."));
          }
          paintFindHits(body.items || []);
        });
      }).catch(function (error) {
        showToast((error && error.message) || "تعذر البحث.", "error");
      });
    });
  }
  bindJourneyBus();
  window.addEventListener("hashchange", router);
  bootstrapUserSignature().then(function (user) {
    if (!user || !user.id) {
      return;
    }
    var ready = window.AjCommittees && typeof window.AjCommittees.afterAuth === "function"
      ? window.AjCommittees.afterAuth(user)
      : Promise.resolve();
    return ready.then(function () {
      if (window.EventBus && typeof window.EventBus.connect === "function") {
        window.EventBus.connect();
      }
      if (window.EvaluationCore && typeof window.EvaluationCore.load === "function") {
        window.EvaluationCore.load().catch(function () {});
      }
      router();
    });
  });
})();
