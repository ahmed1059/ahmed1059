const Core_RoleDomains = (function () {
  const ADOPTION_TEXT = 'هذه مصفوفة داخلية معتمدة من قائد المدرسة. تستند إلى: النموذج الإشرافي في ضوء تمكين المدرسة (المجالات المؤكدة: التدريس، نواتج التعلم، الأنشطة، التوجيه الطلابي). الهيكل التنظيمي للمدرسة. المهام الفعلية المعتمدة لكل دور. يُراجع سنوياً. الجزء غير المُؤيَّد بنص صريح من النموذج الإشرافي مُعلَّم بكلمة (استنباط داخلي).';

  const DOMAIN_NAMES = {
    '01': '01 الإدارة المدرسية',
    '02': '02 التعليم والتعلم',
    '03': '03 نواتج التعلم',
    '04': '04 البيئة المدرسية'
  };

  const ROLE_DOMAIN_MAP = {
    principal: { label: 'مدير المدرسة', basis: 'قيادة شاملة', domains: { '01': 'full', '02': 'full', '03': 'full', '04': 'partial' } },
    educationalVice: { label: 'وكيل الشؤون التعليمية', basis: 'استنباط داخلي', domains: { '01': 'partial', '02': 'full', '03': 'full', '04': 'none' } },
    studentVice: { label: 'وكيل الشؤون الطلابية', basis: 'استنباط داخلي', domains: { '01': 'partial', '02': 'partial', '03': 'full', '04': 'partial' } },
    schoolVice: { label: 'وكيل الشؤون المدرسية', basis: 'استنباط داخلي', domains: { '01': 'partial', '02': 'none', '03': 'none', '04': 'full' } },
    counselor: { label: 'الموجه الطلابي', basis: 'التوجيه الطلابي', domains: { '01': 'none', '02': 'partial', '03': 'full', '04': 'partial' } },
    activityLeader: { label: 'رائد النشاط', basis: 'الأنشطة المدرسية', domains: { '01': 'none', '02': 'partial', '03': 'full', '04': 'partial' } },
    giftedTeacher: { label: 'معلم الموهوبين', basis: 'استنباط داخلي', domains: { '01': 'none', '02': 'partial', '03': 'full', '04': 'none' } },
    teacher: { label: 'معلم (جميع التخصصات)', basis: 'التدريس', domains: { '01': 'none', '02': 'full', '03': 'partial', '04': 'none' } },
    secretary: { label: 'إداري/سكرتير', basis: 'استنباط داخلي', domains: { '01': 'full', '02': 'none', '03': 'none', '04': 'partial' } },
    evaluationLead: { label: 'مسؤول التقويم', basis: 'استنباط داخلي', domains: { '01': 'full', '02': 'full', '03': 'full', '04': 'partial' } },
    healthGuide: { label: 'الموجه الصحي', basis: 'استنباط داخلي', domains: { '01': 'none', '02': 'none', '03': 'partial', '04': 'partial' } },
    resourcesClerk: { label: 'أمين مصادر التعلم', basis: 'استنباط داخلي', domains: { '01': 'none', '02': 'partial', '03': 'none', '04': 'none' } },
    labTechnician: { label: 'محضر المختبر', basis: 'استنباط داخلي', domains: { '01': 'none', '02': 'partial', '03': 'none', '04': 'partial' } }
  };

  function _norm(role) {
    return String(role || '').replace(/\s+/g, ' ').trim();
  }

  function _matchRoleId(role) {
    const r = _norm(role);
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

  function _split(domains) {
    const full = [];
    const partial = [];
    Object.keys(DOMAIN_NAMES).forEach(function (code) {
      if (domains[code] === 'full') full.push(code);
      if (domains[code] === 'partial') partial.push(code);
    });
    return { full: full, partial: partial };
  }

  function getDomainsForRole(role) {
    const roleId = _matchRoleId(role);
    if (!roleId) {
      return { matched: false, roleId: '', label: _norm(role), basis: '', adoptionText: ADOPTION_TEXT, domains: {}, full: [], partial: [], recommended: [] };
    }
    const entry = ROLE_DOMAIN_MAP[roleId];
    const split = _split(entry.domains);
    return { matched: true, roleId: roleId, label: entry.label, basis: entry.basis, adoptionText: ADOPTION_TEXT, domains: entry.domains, full: split.full, partial: split.partial, recommended: split.full.concat(split.partial) };
  }

  function getIndicatorDomains(role) {
    const info = getDomainsForRole(role);
    return { roleId: info.roleId, label: info.label, domains: info.recommended, indicators: [], pendingSchoolAssignment: true };
  }

  function getRoleMapForClient() {
    const roles = {};
    Object.keys(ROLE_DOMAIN_MAP).forEach(function (roleId) {
      const entry = ROLE_DOMAIN_MAP[roleId];
      const split = _split(entry.domains);
      roles[roleId] = {
        label: entry.label,
        recommended: split.full.concat(split.partial)
      };
    });
    return { domainNames: DOMAIN_NAMES, roles: roles };
  }

  return {
    getDomainsForRole: getDomainsForRole,
    getIndicatorDomains: getIndicatorDomains,
    getRoleMapForClient: getRoleMapForClient,
    getAdoptionText: function () { return ADOPTION_TEXT; },
    getDomainName: function (code) { return DOMAIN_NAMES[code] || code; }
  };
})();
