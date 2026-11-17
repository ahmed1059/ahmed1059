# جرد سريع مكمّل لتقرير المراجعة — 1059

مرفق لـ `docs/AUDIT_REPORT.md`. قراءة فقط. تاريخ الجرد: 2026-10-31.

## 1) جداول SQLite الحية (33)

| جدول | صفوف تقريبية وقت الجرد | دور مختصر |
|------|-------------------------|-----------|
| school_programs | 5 | برامج المدرسة |
| program_templates | 17 | قوالب برامج |
| program_phrase_bank | — | عبارات حقول البرامج |
| phrase_bank | — | بنك عبارات عام |
| daily_tasks | 17 | مهام يومية |
| task_bank | 0 | بنك مهام (فارغ) |
| task_goal_links | — | ربط مهمة↔هدف |
| visual_evidence | 22 | شواهد بصرية |
| rules | 7 | قواعد غرفة القيادة |
| signals | 21 | إشارات اليوم |
| signal_actions | 24 | قرارات على الإشارات |
| noor_staff | 39 | منسوبون (بدل staff) |
| noor_students | 338 | طلاب (بدل students) |
| noor_timetable | — | جدول حصص |
| soft_period_slots / soft_period_follow | — | فترات لاصفية |
| improvement_actions | 3 | إجراءات تحسين |
| evaluation_cycles / evaluation_indicators | — | اعتماد |
| nafs_cards | — | نافس |
| school_operational_plan | — | خطة تشغيلية |
| plans / plan_custom_items | — | خطط أدوار |
| content_overrides / school_settings / settings | — | إعدادات ومحتوى |
| schools / users / auth_sessions / calendars | — | أساس النظام |
| knowledge_options / kpi_options | — | خيارات |

**ليست جداول SQLite:** `committees` → JSON حوكمة اللجان؛ المجالس → ملف JSON عبر `/api/councils`.

## 2) أبواب الواجهة (`erp-nav` — عيّنة)

| board | وظيفة |
|-------|--------|
| tasks-today / tasks-week / tasks-follow | مهام |
| soft-periods | لاصفية |
| tasks-absence / attendance | غياب ودوام |
| committees-home | لجان |
| school-plan / plan-book / plan-deck / plan-exec / plan-follow | خطط |
| programs / program-records / plan-seat | برامج |
| six-registers / command-board | سجلات وقيادة |
| indicators-* | مؤشرات |
| مجالس / زيارات / تحسين / شاهد لاصفي | عبر لوحات متخصصة في نفس الملف |

## 3) مسارات الطباعة

| المسار | التقنية | وضع التوحيد |
|--------|---------|-------------|
| بطاقة برنامج | OfficialFrameCore + PrintTemplates | ✅ معتمد A4 |
| نواة/تحسين شواهد عبر core | OfficialFrameCore | ✅ جزئي |
| محضر مجالس | host خاص + نواة في الصفحات | ⚠️ هجين |
| شاهد لاصفي soft | print-soft-witness | ❌ خارج العقد الكامل |
| غياب/سجلات/زيارة/تسكين | print-header-table | ❌ قديم |
| كتيب خطة | print-book / plan-portrait | مسار مستقل مقصود |

## 4) مصادر dataChanged المعروفة

**نشر:** `dataHub` (staff/programs/…)؛ مجالس؛ visual-evidence.  
**استماع:** erp-nav (لوحات متعددة)، dashboard.js، slide-deck.js، انتباه القيادة.  
**فجوة:** ليست كل عمليات الحفظ تمر من `publish`.

## 5) مخاطر تكامل حرجة (من التدقيق الفرعي)

| الخطر | الأثر |
|-------|--------|
| `soft_no_media` يتجاهل `visual_evidence` | إشارة كاذبة «فترة بلا مرفق» |
| `erp-suite.js` بلا `dataChanged` | غرفة القيادة لا تتحدث بعد حفظ المهام/اللاصفية |
| طلاب: نور vs localStorage | الغياب قد لا يرى استيراد نور |
| `armPrintPage` ناقص في شاهد/محضر | عودة هوامش/صفحتين رغم النواة |

## 6) قرار مقترح عند العودة

1) `armPrintPage` على كل `print-official-core`  
2) مواءمة شواهد اللاصفية مع الإشارات  
3) ثم ترحيل مسار طباعة قديم واحد → ثم `dataChanged` من `erp-suite`
