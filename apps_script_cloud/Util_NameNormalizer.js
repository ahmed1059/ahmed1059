/*************************************************************************************
 * Util_NameNormalizer.gs
 * -----------------------------------------------------------------------------------
 * أداة تطبيع ومقارنة أسماء منسوبي المدرسة
 * النمط الهندسي: Strangler Fig + Modular Architecture
 * -----------------------------------------------------------------------------------
 * الإصدار: 1.1.0 (نظيف — بدون تكرارات، وفق 1059-Pro)
 * الاعتماديات: لا شيء (Pure Module)
 *************************************************************************************/

const Util_NameNormalizer = (function() {

  /* ============================================================================
   * القسم 1: الثوابت
   * ============================================================================ */

  const TITLES = [
    'ا', 'د', 'م',
    'الاستاذ', 'الاستاذه',
    'الدكتور', 'الدكتوره',
    'المهندس', 'المهندسه',
    'المعلم', 'المعلمه',
    'سعاده', 'فضيله', 'معالي',
    'المدير', 'الوكيل', 'المشرف'
  ];

  const CONNECTORS = ['بن', 'ابن', 'بنت', 'ابنه', 'بنته'];

  const COMPOUND_PREFIXES = ['عبد', 'ابو', 'ام'];

  const THRESHOLD_SAME = 85;
  const THRESHOLD_CANDIDATE = 60;

  const WEIGHT_FIRST = 40;
  const WEIGHT_FAMILY = 40;
  const WEIGHT_MIDDLE = 20;


  /* ============================================================================
   * القسم 2: الطبقة 1 — التنظيف الأولي
   * ============================================================================ */

  function cleanup(text) {
    if (!text || typeof text !== 'string') return '';
    let s = String(text);
    s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ');
    s = s.replace(/[0-9\u0660-\u0669\u06F0-\u06F9]+/g, ' ');
    s = s.replace(/[^\u0600-\u06FF\s]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }


  /* ============================================================================
   * القسم 3: الطبقة 2 — توحيد الحروف
   * ============================================================================ */

  function removeDiacritics(text) {
    return String(text || '').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  }

  function removeTatweel(text) {
    return String(text || '').replace(/\u0640/g, '');
  }

  function normalizeAlef(text) {
    return String(text || '').replace(/[أإآٱ]/g, 'ا');
  }

  function normalizeYeh(text) {
    return String(text || '').replace(/[ىئ]/g, 'ي');
  }

  function normalizeWaw(text) {
    return String(text || '').replace(/ؤ/g, 'و');
  }

  function normalizeDigits(text) {
    return String(text || '')
      .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
  }

  function normalizeArabic(text) {
    if (!text) return '';
    let s = cleanup(text);
    s = removeDiacritics(s);
    s = removeTatweel(s);
    s = normalizeAlef(s);
    s = normalizeYeh(s);
    s = normalizeWaw(s);
    s = normalizeDigits(s);
    return s;
  }

  function normalizeForMatch(text) {
    return normalizeArabic(text).replace(/ة/g, 'ه');
  }


  /* ============================================================================
   * القسم 4: الطبقة 3 — التقسيم والتصفية
   * ============================================================================ */

  function stripTitlesTokens(tokens) {
    if (!tokens || tokens.length === 0) return [];
    const titles = TITLES.map(t => normalizeForMatch(t));
    let start = 0;
    let end = tokens.length;
    while (start < end && titles.indexOf(tokens[start]) !== -1) start++;
    while (end > start && titles.indexOf(tokens[end - 1]) !== -1) end--;
    return tokens.slice(start, end);
  }

  function stripConnectors(tokens) {
    if (!tokens || tokens.length === 0) return [];
    const connectors = CONNECTORS.map(c => normalizeForMatch(c));
    return tokens.filter(t => connectors.indexOf(t) === -1);
  }

  function normalizeCompoundNames(tokens) {
    if (!tokens || tokens.length === 0) return [];
    const prefixes = COMPOUND_PREFIXES.map(p => normalizeForMatch(p));
    const result = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let handled = false;
      for (let p = 0; p < prefixes.length; p++) {
        const prefix = prefixes[p];
        if (token.length > prefix.length && token.indexOf(prefix) === 0) {
          const rest = token.substring(prefix.length);
          if (rest.length >= 2) {
            result.push(prefix);
            result.push(rest);
            handled = true;
            break;
          }
        }
      }
      if (!handled) result.push(token);
    }
    return result;
  }

  function tokenize(fullName) {
    if (!fullName) return [];
    const normalized = normalizeForMatch(fullName);
    let tokens = normalized.split(' ').filter(t => t.length > 0);
    tokens = stripTitlesTokens(tokens);
    tokens = stripConnectors(tokens);
    tokens = normalizeCompoundNames(tokens);
    return tokens;
  }


  /* ============================================================================
   * القسم 5: الطبقة 4 — المقارنة
   * ============================================================================ */

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const m = a.length;
    const n = b.length;
    const matrix = [];
    for (let i = 0; i <= m; i++) {
      matrix[i] = [i];
      for (let j = 1; j <= n; j++) matrix[i][j] = 0;
    }
    for (let j = 0; j <= n; j++) matrix[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[m][n];
  }

  function calculateSimilarity(str1, str2) {
    const a = normalizeForMatch(str1);
    const b = normalizeForMatch(str2);
    if (!a && !b) return 100;
    if (!a || !b) return 0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 100;
    const dist = levenshtein(a, b);
    return Math.round(((maxLen - dist) / maxLen) * 100);
  }

  function tokenMatch(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 100;
    return calculateSimilarity(a, b);
  }

  function matchScore(name1, name2) {
    const t1 = tokenize(name1);
    const t2 = tokenize(name2);
    if (t1.length === 0 || t2.length === 0) return 0;
    const firstScore = tokenMatch(t1[0], t2[0]);
    const family1 = t1[t1.length - 1];
    const family2 = t2[t2.length - 1];
    const familyScore = tokenMatch(family1, family2);
    const middleScore = computeMiddleScore(t1, t2);
    let total = Math.round(
      (firstScore * WEIGHT_FIRST +
       familyScore * WEIGHT_FAMILY +
       middleScore * WEIGHT_MIDDLE) / 100
    );
    if (firstScore === 100 && familyScore === 100 && t1.length >= 2 && t2.length >= 2) {
      total = Math.max(total, 95);
    }
    return total;
  }

  function computeMiddleScore(t1, t2) {
    const mid1 = t1.slice(1, -1);
    const mid2 = t2.slice(1, -1);
    if (mid1.length === 0 && mid2.length === 0) return 100;
    if (mid1.length === 0 || mid2.length === 0) return 60;
    let totalScore = 0;
    for (let i = 0; i < mid1.length; i++) {
      let best = 0;
      for (let j = 0; j < mid2.length; j++) {
        const s = tokenMatch(mid1[i], mid2[j]);
        if (s > best) best = s;
      }
      totalScore += best;
    }
    return Math.round(totalScore / mid1.length);
  }

  function areSamePerson(name1, name2, threshold) {
    if (threshold === undefined) threshold = THRESHOLD_SAME;
    return matchScore(name1, name2) >= threshold;
  }

  function findBestMatch(targetName, candidates) {
    if (!candidates || candidates.length === 0) return null;
    let best = null;
    let highest = 0;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const name = (typeof candidate === 'object')
        ? (candidate.name || candidate.fullName || '')
        : candidate;
      const score = matchScore(targetName, name);
      if (score > highest) {
        highest = score;
        best = (typeof candidate === 'object')
          ? Object.assign({}, candidate, { score: score })
          : { name: candidate, score: score };
      }
    }
    return highest >= THRESHOLD_CANDIDATE ? best : null;
  }


  /* ============================================================================
   * القسم 6: الواجهة العامة — Display & Debug
   * ============================================================================ */

  function getCanonical(fullName) {
    return tokenize(fullName).join(' ');
  }

  /**
   * إرجاع الاسم للعرض بعد إزالة اللاحقة الوظيفية والأقواس.
   * مثال: "أحمد علي الشهري - مسؤول التقويم" → "أحمد علي الشهري"
   */
  function getDisplay(fullName) {
    if (!fullName) return '';
    let s = String(fullName);

    // إزالة اللاحقة الوظيفية: " - role" أو "- role" أو " – role"
    s = s.replace(/\s*[-–—]\s*[^-–—]+$/, '');

    // إزالة الأقواس في النهاية إن وُجدت
    s = s.replace(/\s*\([^)]*\)\s*$/, '');

    return s.replace(/\s+/g, ' ').trim();
  }

  function debugMatch(name1, name2) {
    const t1 = tokenize(name1);
    const t2 = tokenize(name2);
    return {
      name1: getDisplay(name1),
      name2: getDisplay(name2),
      tokens1: t1,
      tokens2: t2,
      first1: t1[0] || '',
      first2: t2[0] || '',
      family1: t1[t1.length - 1] || '',
      family2: t2[t2.length - 1] || '',
      score: matchScore(name1, name2),
      isMatch: areSamePerson(name1, name2)
    };
  }


  /* ============================================================================
   * القسم 7: الاختبارات
   * ============================================================================ */

  function runTests() {
    const testCases = [
      { n1: 'احمد بن صالح بن رجاء العوفي', n2: 'أحمد صالح العوفي', expected: true },
      { n1: 'عبدالرحمن بن حامد بن حمد العوفي', n2: 'عبد الرحمن حامد العوفي', expected: true },
      { n1: 'فهد حنيف بن محمد العمري', n2: 'أ. فهد حنيف العمري', expected: true },
      { n1: 'هاشم بن راشد بن دهيكل البرقاني الجهني', n2: 'هاشم البرقاني', expected: true },
      { n1: 'زهير بن عتيق بن عوده الحجيلي', n2: 'زهير عتيق عودة الحجيلي', expected: true },
      { n1: 'محمد بن علي القحطاني', n2: 'محمد علي القحطاني', expected: true },
      { n1: 'عبدالله بن محمد الشهري', n2: 'عبد الله محمد الشهري', expected: true },
      { n1: 'نايف بن سمير الحربي', n2: 'نايف سمير الحربي', expected: true },
      { n1: 'أحمد علي هيازع الشهري', n2: 'احمد علي هيازع الشهري', expected: true },
      { n1: 'أحمد علي هيازع الشهري', n2: 'أحمد الشهري', expected: true },
      { n1: 'سعد بن سعيد الغامدي', n2: 'سعيد سعد الغامدي', expected: false },
      { n1: 'خالد الحربي', n2: 'محمد الحربي', expected: false },
      { n1: 'عمر بن عمر العمري', n2: 'عمر العمري', expected: true },
      { n1: 'أحمد', n2: 'أحمد علي محمد', expected: false },
      { n1: 'فارس المطيري', n2: 'فارس بن مطير المطيري', expected: true }
    ];

    Logger.log('=== بدء اختبارات Util_NameNormalizer ===\n');
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const score = matchScore(tc.n1, tc.n2);
      const matched = score >= THRESHOLD_SAME;
      const ok = matched === tc.expected;
      if (ok) passed++; else failed++;
      Logger.log(
        '[' + (i + 1) + '] ' + (ok ? '✅ PASS' : '❌ FAIL') +
        ' | متوقع: ' + (tc.expected ? 'مطابقة' : 'عدم') +
        ' | فعلي: ' + matched + ' (' + score + '%)'
      );
    }

    Logger.log('\n=== النتيجة: ' + passed + ' نجح | ' + failed + ' فشل ===');
    return { passed: passed, failed: failed, total: testCases.length };
  }

  function runDebugTest(name1, name2) {
    const result = debugMatch(name1, name2);
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }


  /* ============================================================================
   * الواجهة العامة
   * ============================================================================ */

  return {
    cleanup: cleanup,
    normalizeArabic: normalizeArabic,
    normalizeForMatch: normalizeForMatch,
    tokenize: tokenize,
    calculateSimilarity: calculateSimilarity,
    matchScore: matchScore,
    areSamePerson: areSamePerson,
    findBestMatch: findBestMatch,
    getCanonical: getCanonical,
    getDisplay: getDisplay,
    debugMatch: debugMatch,
    runTests: runTests,
    runDebugTest: runDebugTest
  };

})();


/* ============================================================================
 * دوال اختبار عامة (خارج الـIIFE)
 * ============================================================================ */

/**
 * اختبار شامل لتطبيع الأسماء من محرر Apps Script.
 */
function TEST_NameNormalizer() {
  return Util_NameNormalizer.runTests();
}

/**
 * اختبار خدمة التقارير (يستخدم Feature_ReportService).
 */
function TEST_ReportService() {
  Logger.log("🚀 اختبار Feature_ReportService...");

  try {
    const report = Feature_ReportService.generateParticipationReport();

    Logger.log("✅ نجح التقرير:");
    Logger.log("   success: " + report.success);
    Logger.log("   - إجمالي المنسوبين: " + report.summary.totalStaffCount);
    Logger.log("   - إجمالي الشواهد: " + report.summary.totalEvidences);
    Logger.log("   - المشاركون: " + report.summary.activeCount);
    Logger.log("   - بانتظار المشاركة: " + report.summary.pendingCount);
    Logger.log("   - نسبة المشاركة: " + report.summary.participationRate + "%");
    Logger.log("   - عدد المجالات: " + Object.keys(report.domains).length);

    Logger.log("\n📋 أول 5 مشاركين:");
    for (let i = 0; i < Math.min(5, report.lists.activeStaff.length); i++) {
      Logger.log("   - " + report.lists.activeStaff[i]);
    }

    Logger.log("\n📋 أول 5 بانتظار:");
    for (let i = 0; i < Math.min(5, report.lists.pendingStaff.length); i++) {
      Logger.log("   - " + report.lists.pendingStaff[i]);
    }

    return report;
  } catch (err) {
    Logger.log("❌ خطأ: " + err.toString());
    Logger.log("Stack: " + err.stack);
    return null;
  }
}