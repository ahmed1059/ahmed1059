const Core_Programs = (function () {
  const SHEET_NAME = 'Programs_Assignments';
  const INTERNAL_SOURCE = 'قائمة داخلية معتمدة';

  const PROGRAMS = [
    { id: 'PROG_001', name: 'إدارة الأداء الوظيفي', issuer: 'وزارة التعليم — أبعاد', audience: 'leaders', domain: 'general', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_002', name: 'سياسات حوكمة البيانات', issuer: 'وزارة التعليم — أبعاد', audience: 'leaders', domain: 'general', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_003', name: 'الأمن السيبراني', issuer: 'وزارة التعليم — أبعاد', audience: 'leaders', domain: 'general', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_004', name: 'إدارة المخاطر', issuer: 'وزارة التعليم — أبعاد', audience: 'leaders', domain: 'general', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_005', name: 'التطوير المهني المستمر', issuer: 'المعهد الوطني للتطوير المهني', audience: 'teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_006', name: 'مجتمعات التعلم المهنية', issuer: 'وزارة التعليم', audience: 'teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_007', name: 'البحث الإجرائي', issuer: 'وزارة التعليم', audience: 'teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_008', name: 'التقويم التكويني', issuer: 'وزارة التعليم', audience: 'teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_009', name: 'تنمية مهارات التفكير', issuer: 'وزارة التعليم', audience: 'teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_010', name: 'التوجيه المهني', issuer: 'قائمة داخلية', audience: 'counselor', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_011', name: 'الحد من التنمر', issuer: 'قائمة داخلية', audience: 'counselor', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_012', name: 'تعزيز السلوك الإيجابي', issuer: 'قائمة داخلية', audience: 'counselor', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_013', name: 'التهيئة الإرشادية للاختبارات', issuer: 'قائمة داخلية', audience: 'counselor', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_014', name: 'رعاية الفئات الخاصة', issuer: 'قائمة داخلية', audience: 'counselor', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_015', name: 'معالجة الحالات السلوكية', issuer: 'قائمة داخلية', audience: 'counselor', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_016', name: 'القيم', issuer: 'قائمة داخلية', audience: 'activity_leader', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_017', name: 'الذكاء الاجتماعي والعاطفي', issuer: 'قائمة داخلية', audience: 'activity_leader', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_018', name: 'الذوق العام', issuer: 'قائمة داخلية', audience: 'activity_leader', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_019', name: 'الأمن السيبراني للطلاب', issuer: 'قائمة داخلية', audience: 'activity_leader', domain: '04', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_020', name: 'الأنشطة اللاصفية الخمسة', issuer: 'قائمة داخلية', audience: 'activity_leader', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_021', name: 'الكشف عن الموهوبين', issuer: 'قائمة داخلية', audience: 'gifted_teacher', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_022', name: 'البرامج الإثرائية', issuer: 'قائمة داخلية', audience: 'gifted_teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_023', name: 'برنامج الكورت', issuer: 'قائمة داخلية', audience: 'gifted_teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_024', name: 'التفكير الإبداعي', issuer: 'قائمة داخلية', audience: 'gifted_teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_025', name: 'البحث المستقل IIM', issuer: 'قائمة داخلية', audience: 'gifted_teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_026', name: 'القيادة المدرسية الفاعلة', issuer: 'وزارة التعليم', audience: 'leaders', domain: '01', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_027', name: 'الإشراف التربوي', issuer: 'وزارة التعليم', audience: 'leaders', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_028', name: 'إدارة المخاطر المدرسية', issuer: 'وزارة التعليم', audience: 'leaders', domain: '01', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_029', name: 'الأمن والسلامة المدرسية', issuer: 'وزارة التعليم', audience: 'leaders', domain: '04', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_030', name: 'الحوكمة والشفافية', issuer: 'وزارة التعليم', audience: 'leaders', domain: '01', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_031', name: 'تنفيذ المنهج وتوزيعه', issuer: 'قائمة داخلية', audience: 'teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_032', name: 'تطبيق استراتيجية في الحصة', issuer: 'قائمة داخلية', audience: 'teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_033', name: 'حصة باستخدام التقنية', issuer: 'قائمة داخلية', audience: 'teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_034', name: 'مهارة قرائية أو عددية', issuer: 'قائمة داخلية', audience: 'teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_035', name: 'تحليل نتائج ومعالجة', issuer: 'قائمة داخلية', audience: 'teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_036', name: 'تغذية راجعة لولي الأمر', issuer: 'قائمة داخلية', audience: 'teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_037', name: 'تحفيز الطلاب', issuer: 'قائمة داخلية', audience: 'teacher', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_038', name: 'الخطة التشغيلية', issuer: 'قائمة داخلية', audience: 'principal', domain: '01', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_039', name: 'متابعة تنفيذ الخطة', issuer: 'قائمة داخلية', audience: 'principal', domain: '01', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_040', name: 'اللجان ومحاضر المجلس', issuer: 'قائمة داخلية', audience: 'principal', domain: '01', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_041', name: 'توزيع الأنصبة والجداول', issuer: 'قائمة داخلية', audience: 'educationalVice', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_042', name: 'الزيارات الصفية', issuer: 'قائمة داخلية', audience: 'educationalVice', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_043', name: 'متابعة مجتمعات التعلم', issuer: 'قائمة داخلية', audience: 'educationalVice', domain: '01', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_044', name: 'المواظبة والغياب', issuer: 'قائمة داخلية', audience: 'studentVice', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_045', name: 'السلوك والإجراءات', issuer: 'قائمة داخلية', audience: 'studentVice', domain: '01', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_046', name: 'التواصل مع الأسرة', issuer: 'قائمة داخلية', audience: 'studentVice', domain: '01', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_047', name: 'صيانة المرافق', issuer: 'قائمة داخلية', audience: 'schoolVice', domain: '04', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_048', name: 'سلامة المبنى', issuer: 'قائمة داخلية', audience: 'schoolVice', domain: '04', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_049', name: 'النظافة والبيئة المدرسية', issuer: 'قائمة داخلية', audience: 'schoolVice', domain: '04', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_050', name: 'خطة النشاط وسجل التنفيذ', issuer: 'قائمة داخلية', audience: 'activityLeader', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_051', name: 'رعاية الحالات الطلابية', issuer: 'قائمة داخلية', audience: 'counselor', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_052', name: 'البرامج الصحية المدرسية', issuer: 'قائمة داخلية', audience: 'healthGuide', domain: '03', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_053', name: 'مصادر التعلم ودعم المنهج', issuer: 'قائمة داخلية', audience: 'resourcesClerk', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_054', name: 'تجارب المختبر وسلامته', issuer: 'قائمة داخلية', audience: 'labTechnician', domain: '02', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE },
    { id: 'PROG_055', name: 'الصادر والوارد والأرشيف', issuer: 'قائمة داخلية', audience: 'secretary', domain: '01', timing: 'as_needed', level: 'individual', source_url: INTERNAL_SOURCE }
  ];

  const AUDIENCE_BY_ROLE = {
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

  function getTimingLabel(code) {
    const MAP = {
      'annual': 'سنوي',
      'semester': 'فصلي',
      'ongoing': 'مستمر',
      'as_needed': 'حسب الحاجة',
      '': 'غير محدد'
    };
    return MAP[code] || 'غير محدد';
  }

  function getAll() { return PROGRAMS.slice(); }

  function getForRole(role) {
    let audience = 'all';
    if (typeof Core_RoleDomains !== 'undefined') {
      const info = Core_RoleDomains.getDomainsForRole(role);
      if (info.matched && AUDIENCE_BY_ROLE[info.roleId]) audience = AUDIENCE_BY_ROLE[info.roleId];
    }
    return PROGRAMS.filter(function (program) {
      return program.audience === 'all' || program.audience === audience;
    });
  }

  function getProgress() {
    return { documented: 0, required: 0, ratio: 0, pendingEvidenceLink: true };
  }

  function ensureProgramsSheet() {
    const ss = SpreadsheetApp.openById(Core_Config.get('SPREADSHEET_ID'));
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['program_id', 'program_name', 'issuer', 'audience_role', 'domain', 'timing', 'level', 'source_url']);
      const rows = PROGRAMS.map(function (program) {
        return [program.id, program.name, program.issuer, program.audience, program.domain, program.timing, program.level, program.source_url];
      });
      if (rows.length) sheet.getRange(2, 1, rows.length, 8).setValues(rows);
    }
    return sheet.getName();
  }

  return {
    getAll: getAll,
    getForRole: getForRole,
    getProgress: getProgress,
    getTimingLabel: getTimingLabel,
    ensureProgramsSheet: ensureProgramsSheet
  };
})();
