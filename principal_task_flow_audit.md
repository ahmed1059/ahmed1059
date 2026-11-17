# جرد سلوكي — رحلة مدير المدرسة (Task Mapping Audit)

**الملف:** `principal_task_flow_audit.md`  
**التاريخ:** 2026-11-02  
**الشريحة:** مدير المدرسة / مسؤول النظام فقط  
**المنهج:** Task-Flow Architecture · Strangler Fig · بلا كود في هذه الخطوة  
**المرجع:** `erp-nav.js` · `erp-suite.js` · `dashboard.html` · APIs · مفاتيح `board1059.*`

## رأي معماري موجز (للمراجعة)

الانتقال من «هندسة الأقسام/القوائم» إلى «رحلة الموظف + شجرة خانقة» قرار سليم بعد فشل ترقيع القشرة (تعليق `:has()` · اختفاء mega-menu). الاحتفاظ بـ L1–L8 وSQLite/API كنواة، واستبدال القشرة تدريجيًا بمسار مدير المدرسة أولًا، يقلّل مخاطرة كسر الطباعة المحصّنة والبنوك.  
`CustomEvent` بصيغة `app:module:action` يناسب Vanilla JS الحالي ويمهّد لاستبدال `dataChanged`/`dataHub` لاحقًا دون إعادة كتابة الخادم دفعة واحدة.

---

## قواعد التصنيف

| المرحلة | معنى عملي في رحلة المدير |
|---|---|
| **تخطيطي** | تأسيس الهوية، التقويم، التشكيل، الخطط، البرامج قبل/أثناء الاعتماد |
| **مهامي** | ما يظهر لليوم/الأسبوع كعمل مطلوب من المدير |
| **تنفيذي** | تعبئة/حفظ/اعتماد سجلات وتشغيل يومي |
| **طباعتي** | توليد/طباعة وثيقة رسمية أو كتيب/بطاقة |
| **متابعتي** | متابعة تنفيذ، غرفة قيادة، مؤشرات، تحسين، تقييم ذاتي |
| **شواهدي** | رفع/ربط/مراجعة شواهد بصرية مرتبطة بكيان |

**فخ تخزين محلي:** أي قراءة/كتابة عبر `localStorage` ومفاتيح `board1059.*` — يُعلَّم صراحةً لأنه مصدر حقيقة مزدوج يجب خنقه لاحقًا نحو API.

---

## جدول الجرد السلوكي — مدير المدرسة / مسؤول النظام

| المهمة (الفعل) | المرحلة في الرحلة | مصدر البيانات (Data Contract) | مقترح حدث التزامن (CustomEvent) | الموقع السابق (Legacy Location) |
|---|---|---|---|---|
| حفظ بيانات المنشأة (هوية/مبنى) | تخطيطي | **مزدوج:** بذرة من `GET/PUT /api/settings` + **فخ** `board1059.facility` | `app:facility:saved` | الإعدادات ← بيانات المنشأة (`facility`) |
| حفظ التقويم المعتمد (أعوام/محطات/منطقة) | تخطيطي | ملفات JS مرجعية (`academic-calendar-data`) + أسابيع عبر settings + **فخ** `board1059.calendar` | `app:calendar:saved` | الإعدادات ← التقويم المعتمد (`calendar`) |
| تعيين منطقة المناسبات وعرض مناسبات العام | تخطيطي | `occasions-data.js` (قراءة) + **فخ** منطقة داخل `board1059.calendar` | `app:occasions:region-set` | الإعدادات ← المناسبات (`occasions`) |
| حفظ التشكيل القيادي للتواقيع | تخطيطي | بذرة `/api/settings` + دليل `/api/noor/staff` + **فخ** `board1059.leadership` | `app:leadership:saved` | الإعدادات ← التشكيل القيادي (`leadership`) |
| استيراد كادر/طلاب/جدول من نور | تخطيطي | `POST /api/noor/import` | `app:noor:imported` | الإعدادات ← استيراد نور (`noor`) |
| إضافة/تعديل منسوب في السجل | تخطيطي | `GET/POST /api/noor/staff` | `app:staff:saved` | الإعدادات ← سجل المنسوبين (`staff`) |
| حذف منسوب من السجل | تخطيطي | `DELETE /api/noor/staff/{id}` (+ اختياري إزالة من فريق عبر dataHub/leadership) | `app:staff:deleted` | الإعدادات ← سجل المنسوبين (`staff`) |
| حفظ هندسة صلاحيات مستخدم | تخطيطي | **فخ كامل** `board1059.permissions` (واجهة) | `app:permissions:saved` | الإعدادات ← هندسة الصلاحيات (`permissions`) |
| إيقاف/تفعيل حساب أو تعيين كلمة مرور | تخطيطي | **فخ** `board1059.accounts` + `POST /api/users/password` (مدير) | `app:accounts:updated` | الإعدادات ← إدارة الحسابات (`accounts`) |
| حفظ ملاحظة الترويسة/الأختام | طباعتي | **فخ** `board1059.letterhead` (+ قراءة leadership للعرض) | `app:letterhead:saved` | الإعدادات ← الترويسة والأختام (`letterhead`) |
| إنشاء/استعادة نسخة احتياطية لقاعدة المدرسة | تخطيطي | `GET/POST /api/backups*` | `app:backup:created` / `app:backup:restored` | الإعدادات ← النسخ الاحتياطي (`backup`) |
| حفظ درجات مؤشرات الاعتماد (ETEC) | متابعتي | `GET/POST /api/evaluation*` · `DELETE .../indicators/{id}` | `app:evaluation:saved` | الإعدادات ← سجل المؤشرات (`indicators`) / المؤشرات ← إطار ETEC (`indicators-etec`) |
| حفظ بطاقة نافس الأسبوعية | متابعتي | `GET/POST /api/nafs` (+ عرض قيادي يقرأ SSOT عبر `/api/performance-metrics`) | `app:nafs:saved` | الإعدادات ← بطاقة نافس (`nafs`) / المؤشرات ← نافس (`indicators-nafes`) |
| حفظ إجراءات خطة التحسين | متابعتي | `GET/POST /api/improvement` (+ قراءة evaluation/nafs للسياق) | `app:improvement:saved` | الإعدادات ← خطة التحسين (`improvement`) |
| طباعة خطة التحسين | طباعتي | بيانات `/api/improvement` + مسار طباعة الشاشة | `app:improvement:printed` | لوحة التحسين (`improvement`) |
| إنشاء/تعديل برنامج (مسودة) | تخطيطي | `GET/POST /api/programs` · عبارات `/api/programs/phrases` | `app:program:saved` | الإعدادات/الخطط ← البرامج (`programs`) |
| اعتماد برنامج | تنفيذي | `POST /api/programs/approve` (يشترط مدير/`isPrincipal`) | `app:program:approved` | البرامج ← زر اعتماد (`programs`) |
| تسكين البرامج في المصفوفة | تخطيطي | قراءة/عرض من `/api/programs` (+ leadership محلي للأسماء) | `app:program:seated` | إعداد الخطط ← جدول تسكين البرامج (`plan-seat`) |
| استعراض سجل البرامج / السجلات الستة | متابعتي | `/api/programs` · `/api/improvement` | `app:program:records-viewed` | إعداد الخطط ← سجل البرامج / السجلات الستة |
| حفظ/تحديث بنود الخطة التشغيلية وربط المهام | تخطيطي | `GET/POST /api/operational-plan` · `/api/operational-plan/tasks` | `app:plan:saved` | إعداد الخطط ← الخطة التشغيلية (`school-plan`) |
| توليد/عرض صفحات كتيب الخطة | طباعتي | settings/content/plans APIs + محتوى أدوار؛ طباعة `print-book` | `app:plan-book:rendered` | إعداد الخطط ← الغلاف والبسملة (`plan-book`) |
| معاينة شرائح الخطة (deck) | طباعتي | محتوى الخطط/المحتوى | `app:plan-deck:opened` | إعداد الخطط ← معاينة الخطة (`plan-deck`) |
| توليد بنود الخطة التنفيذية | تنفيذي | محرك المهام / `plan-exec` (لوحة erp-suite) | `app:plan-exec:generated` | إعداد الخطط ← بنود التنفيذ (`plan-exec`) |
| تأشير التقييم الذاتي لمتابعة التنفيذ | متابعتي | لوحة `plan-follow` (ربط بنود/أسابيع) | `app:plan-follow:marked` | إعداد الخطط ← متابعة التنفيذ (`plan-follow`) |
| استعراض مؤشرات الإنجاز المجمّعة | متابعتي | تجميع من سجلات/برامج (لوحة `indicators-progress`) | `app:progress:viewed` | المؤشرات ← ما أُنجز (`indicators-progress`) |
| استعراض شريط أداء المدرسة (SSOT) | متابعتي | `GET /api/performance-metrics` ← كنسي `config/performance_metrics.json` (L1–L8) | `app:performance:loaded` | الاستقبال / PerformanceBind على `dashboard` |
| فتح غرفة القيادة ومراجعة إشارات اليوم | مهامي | `GET /api/command-room/today` | `app:command:opened` | FAB الاستقبال + إعداد الخطط ← لوحة القيادة (`command-board`) |
| تنفيذ إجراء على إشارة غرفة القيادة | تنفيذي | `POST /api/command-room/action` | `app:command:actioned` | غرفة القيادة (FAB / `command-board`) |
| استعراض لوحة المهام اليومية | مهامي | `/api/daily-tasks*` (+ مصادر مساندة) | `app:tasks:today-loaded` | المهام ← لوحة المهام اليومية (`tasks-today`) |
| متابعة الفترات اللاصفية لليوم/الأسبوع | مهامي | `/api/soft-periods*` | `app:soft-periods:loaded` | المهام ← الفترات اللاصفية (`soft-periods`) |
| استعراض غياب/تأخر اليوم المعتمد | مهامي | يعتمد على مخزون الغياب (**فخ** `board1059.studentAbsence`) + عرض مهام | `app:tasks:absence-viewed` | المهام ← غياب وتأخر اليوم (`tasks-absence`) |
| استعراض مناسبات/متابعات الأسبوع | مهامي | occasions + مجالس/سلوك (مختلط API/**فخ**) | `app:tasks:week-viewed` | المهام ← مناسبات/متابعات الأسبوع |
| اعتماد سجل دوام المنسوبين ليوم | تنفيذي | **فخ** `board1059.attendance` (+ قراءة `/api/noor/staff`) | `app:attendance:approved` | السجلات ← دوام المنسوبين (`attendance`) / أيضًا ضمن المهام |
| طباعة سجل دوام المنسوبين | طباعتي | نفس مخزون الدوام + بوابة طباعة/جدول | `app:attendance:printed` | سجل الدوام (`attendance`) |
| اعتماد سجل غياب/تأخر الطلاب ليوم | تنفيذي | **فخ** `board1059.studentAbsence` (+ طلاب نور) | `app:absence:approved` | السجلات ← غياب الطلاب (`absence`) |
| طباعة سجل غياب الطلاب | طباعتي | نفس المخزون المحلي | `app:absence:printed` | سجل الغياب (`absence`) |
| حفظ محضر مجلس/لجنة | تنفيذي | **مزدوج:** `GET/POST /api/councils` + كاش **فخ** `board1059.councils` | `app:council:saved` | السجلات ← المجالس (`councils`) / اللجان ← `committees-home` |
| طباعة محضر المجلس (رسمي متعدد الصفحات) | طباعتي | حقول المجلس المحفوظة + `OfficialFrameCore.armPrintPage({multiPage:true})` | `app:council:printed` | سجل المجالس / اللجان |
| حفظ إفادة زيارة إشرافية | تنفيذي | **فخ** `board1059.visits` (+ leadership/staff للأسماء) | `app:visit:saved` | السجلات ← الزيارات (`visits`) |
| طباعة إفادة زيارة | طباعتي | مخزون الزيارات + مسار طباعة الشاهد/الوثيقة | `app:visit:printed` | سجل الزيارات (`visits`) |
| رفع/ربط شاهد بصري لبرنامج أو محضر | شواهدي | `GET/POST /api/visual-evidence` · `rebind` · `delete` | `app:evidence:attached` | داخل البرامج / المجالس / الفترات |
| صياغة وثيقة من بوابة المعاينة (نواة الربط) | طباعتي | **فخ** `board1059.kernelMap` · `board1059.witnessDrafts` + حقول الشاشة | `app:witness:drafted` | بوابة المعاينة والطباعة (منبثقة عامة) |
| طباعة بطاقة برنامج / شاهد رسمي | طباعتي | برامج/شواهد API + `OfficialFrameCore` / PrintTemplates | `app:program:printed` / `app:evidence:printed` | البرامج · الشاهد اللاصفي · مسارات print |
| فتح خطة صاحب الدور (خطتي) للمدير | تخطيطي | RolePlanPack · `programs.json` · روابط أهداف · PerformanceBind | `app:my-plan:opened` | رابط خطتي في شريط الأوامر (`my-plan-app.html`) |
| الدخول وإثبات الجلسة | تنفيذي | `POST /api/login` · `GET /api/session` · `GET /api/staff-directory` | `app:session:started` | `login.html` → `dashboard.html` |

---

## ملخص فخاخ التخزين المحلي ذات الصلة برحلة المدير

| المفتاح | أين يظهر في أفعال المدير | ملاحظة للشجرة الخانقة |
|---|---|---|
| `board1059.facility` | حفظ المنشأة | يجب أن يصبح settings API فقط |
| `board1059.calendar` | التقويم + منطقة المناسبات | فخ ازدواج مع المرجع الرسمي |
| `board1059.leadership` | التشكيل · الزيارات · التسكين · الترويسة | مصدر أسماء غير موثوق عبر الأجهزة |
| `board1059.permissions` | هندسة الصلاحيات | صلاحيات واجهة فقط — ليست خادمًا |
| `board1059.accounts` | حالة الحساب المحلية | موازٍ جزئيًا لـ `noor_staff.active` / users |
| `board1059.attendance` | دوام المنسوبين | لا SSOT خادمي اليوم |
| `board1059.studentAbsence` | غياب الطلاب + مهام اليوم | لا SSOT خادمي اليوم |
| `board1059.councils` | كاش المجالس | يُزامَن مع `/api/councils` جزئيًا |
| `board1059.visits` | الزيارات | محلي بالكامل |
| `board1059.letterhead` | الأختام | محلي |
| `board1059.kernelMap` / `witnessDrafts` | بوابة المعاينة | مسودات ربط محلية |
| `board1059.behavior` / `textbooks` / `preparations` / `grades` / `support*` | ألواح وكالة/معلم | خارج شريحة المدير الأساسية؛ يصلها إن فُتحت كل النوافذ |

---

## حدود هذه الشريحة (صريح)

1. لم تُدرج مهام المعلم الأساسية كرحلة مستقلة (تحضير، درجات، علاجي) إلا إن المدير يفتحها عبر صلاحية كاملة/تجربة.  
2. لم يُصمَّم UI جديد ولم يُقترح تخطيط شاشة.  
3. أحداث `app:*` مقترحة للجرد فقط — **لم تُنفَّذ**.  
4. مسار الطباعة المحصّن (`print-official-core` / OfficialFrameCore) يُعامل كعقد خارج الهدم؛ يُستدعى من مرحلة «طباعتي» دون إعادة تعريف الهوامش.

---

## الخطوة التالية المقترحة (بعد مراجعتك فقط)

اعتماد/تعديل هذا الجدول → ثم خريطة خنق مرحلية (أي فعل يُنقل أولًا إلى قشرة الرحلة مع الإبقاء على العقدة القديمة صامتة).

**لا كود في هذه الخطوة.**
