# 29 — خريطة المصادر (قراءة فقط)

التاريخ: 2026-11-04
الأمر: 177، الخطوة الأولى.
الحالة: خريطة من الكود والملفات كما هي. لا تعديل على برنامج عامل.
قاعدة البيانات: `School_Data/school_1059.db` عبر `Core_Engine/database.py` (`DB_PATH`).

التصنيف في عمود «الحكم»: **أصل** = المكان الذي تُحفظ فيه القيمة العاملة. **نسخة** = مرآة أو احتياط يُقرأ إن غاب الأصل. **بذرة** = نص في الكود يملأ الفراغ ولا يُعد أصل التحرير.

## 1. الهوية

### الأصل: جدول `school_settings`

المسار: صف `id = 1` في `School_Data/school_1059.db`.
الإنشاء: `Core_Engine/database.py`، ثم أعمدة أُضيفت لاحقاً: `term_weeks_count`، `education_administration`، `approval_authorities_json`.

| الحقل | المعنى في الكود |
|---|---|
| school_name | اسم المدرسة |
| statistical_number | الرقم الإحصائي |
| education_office | مكتب التعليم |
| education_administration | الإدارة التعليمية |
| building_type | طبيعة المبنى |
| classrooms / labs / sports_halls | أعداد مرافق، نص |
| total_students / total_staff | إجماليات، نص |
| chair_name | اسم رئيس اللجنة |
| members_json | أعضاء اللجنة |
| parent_representative / student_representative | أسماء، نص أو JSON |
| sources_json | مصادر الخطة |
| term_weeks_count | عدد الأسابيع، ويُحبس بين 10 و20 |
| approval_authorities_json | خريطة الاعتماد والتواقيع الإدارية |
| updated_at | وقت آخر كتابة |

من يقرأ: `_settings_row()` ثم `_saved_settings()` في `Core_Engine/app.py`. المسار `GET /api/settings`. من الواجهة: `Print_Canvas/js/identity-bind.js` يقرأ `school.name` ويكتبه في عناصر الهوية الظاهرة. `Print_Canvas/js/dashboard.js` يضع الاسم في المتغير العام `bookletSchoolName`.

من يكتب: `POST /api/settings` يستبدل الصف `id = 1`. عند الكتابة يُثبَّت `chair_name` على الثابت `OFFICIAL_PRINCIPAL_NAME` في `database.py`، لا على الاسم المرسل في الجسم. المساران `GET` و`POST` بلا `require_user` في تعريف الدالة.

إن لم يوجد صف: الاسم الافتراضي في الكود `_DEFAULT_SCHOOL_NAME` = «متوسطة سعد بن الربيع الأنصاري»، والإدارة `_DEFAULT_ADMINISTRATION`.

### ما ليس أصل الهوية

- `Print_Canvas/components/_shared/identity.json`: قائمة أشخاص لقوائم منسدلة (`persons[]`: `person_id`، `name`، `role`، `confidence`، `source`). ليست بطاقة المدرسة.
- جدول `settings` في القاعدة (`school_id`، `key`، `value`): مُنشأ في `database.py`. لا يوجد له `INSERT` أو `SELECT` في `Core_Engine`. ليس مصدر الهوية العامل.
- أسطر الترويسة الأربعة داخل `OfficialFrameCore` (القسم 3): نص ثابت في جافاسكربت، لا يُقرأ من `school_settings` إلا اسم المدرسة بشرط أن يكون `bookletSchoolName` قد ضُبط.

قشرة `app-journey` لا تستدعي `/api/settings` ولا `IdentityBind`.

## 2. التواقيع

### الأصل العامل للجلسة والمحضر

المجلد: `School_Data/signatures/`.
الوضع عند المسح: المجلد موجود وفيه ملف PNG واحد.

الربط:

1. الحفظ: `POST /api/session/signature` في `Core_Engine/session_signature_api.py`. الجلسة تحدد الهوية. الملف `sig_{هوية}.png`. العمود `users.signature_path` يُحدَّث باسم الملف.
2. قراءة صاحب الجلسة: `GET /api/session/signature` يعيد `signature_data_url` (PNG مضمّن)، لا رابطاً عاماً.
3. قراءة حضور محضر: `GET /api/session/councils/{id}/signatures` في `council_signature_api.py`. يقرأ `School_Data/council_minutes.json`، حقل `present[].id`. الهوية الرقمية من 8 إلى 12 خانة فقط. إن وُجد الملف تُعاد صورة مضمّنة، وإن غاب المفتاح يُحذف من الناتج.
4. القشرة: `app-journey.js` تطلب مسار المحضر وتضع الصورة في جدول الحضور.

إن غاب الملف من `School_Data/signatures` ووُجد بنفس الاسم في `Print_Canvas/signatures`، القراءة تنسخه إلى المجلد الأول ثم تقرأه (`_absolute_path`).

### احتياط الإطار الرسمي (نسخة مسار مختلف)

`Print_Canvas/signatures/`: ثلاثة ملفات PNG عند المسح.
`OfficialFrameCore.signatureImage` يضع `src` يبدأ بـ `/signatures/...`. هذا المسار يخدمه الجذر الساكن `Print_Canvas`، لا مجلد `School_Data/signatures`.
الاحتياط المكتوب في النواة: `signatures/sig_teachers.png`، `signatures/sig_students.png`، `signatures/sig_manager.png`.
`Print_Canvas/assets/signatures/` موجود وبلا PNG.

### اعتماد إداري مرتبط بالهوية

- ملف البذرة: `Print_Canvas/banks/approval_authorities.json` (`_APPROVAL_PATH`).
- الأصل بعد أول حفظ فيه بيانات: عمود `school_settings.approval_authorities_json`.
- القراءة: العمود إن كان JSON صالحاً، وإلا الملف. اسم المدير في الناتج يُستبدل بـ `OFFICIAL_PRINCIPAL_NAME`.
- الكتابة: `POST /api/settings` عند إرسال `approval`. إن وصلت قائمة جهات فارغة لا يُمسح العمود (`COALESCE`).

أسماء شريط الاعتماد الافتراضية مكتوبة داخل `DEFAULT_SIGNOFF` في `official-frame-core.js`، وليست قراءة من سجل المنسوبين.

## 3. الطباعة

النواة: `Print_Canvas/js/official-frame-core.js`.
ليست خدمة خادم. المتصفح يركّب HTML ثم `window.print()`.

الترويسة: `header()` / `resolveIdentity()`.
ترتيب النص: المملكة، الوزارة، الإدارة، اسم المدرسة. مع `strictIdentity: true` لا يُضاف العام ولا سطر حر.
مصدر كل سطر:

- المملكة والوزارة: ثابت `DEFAULTS` في الملف نفسه.
- الإدارة: `opts.admin` وإلا `window.bookletAdmin` وإلا ثابت المدينة المنورة.
- المدرسة: `opts.school` وإلا `window.bookletSchoolName` وإلا «متوسطة سعد بن الربيع الأنصاري».
- `bookletSchoolName` يبدأ في `dashboard.js` بالاسم الثابت، ثم يُستبدل من `GET /api/settings` عند تحميل اللوحة.
- الشعاران: `/assets/ministry_logo.png` و`/assets/vision_2030.png` من `School_Data/assets` (التركيب `/assets` في `app.py` يسبق الجذر).

تمرير الوحدات: `Print_Canvas/js/print-templates.js`.
`renderPortraitOfficial` يبني جسم الوثيقة (بيانات وصفية، أقسام، شاهد) ثم يستدعي `OfficialFrameCore.page({ strictIdentity, title, bodyHtml, signoff, columns, school, admin, ... })`.
النماذج على هذه الدالة: Portrait، وبطاقة البرنامج، وLandscape، وCard، وTable.
قبل الطباعة: `OfficialFrameCore.armPrintPage({ orientation, multiPage })` يحقن `@page` بهامش صفر حتى لا تطغى قاعدة `print.css` الأفقية.

قشرة الرحلة لا تستدعي النواة. طباعة المحضر فيها `window.print()` على وسم الشاشة، وتنسيقها في `app-journey.css`.

## 4. البرامج

ليست ملفاً JSON.

### أصل النسخ المحفوظة: `school_programs`

الجدول في `database.py`، ثم أعمدة أُضيفت في دوال التمديد:

الأعمدة الأصلية: `id`، `program_name`، `strategic_goal`، `executive_goal`، `target_audience`، `duration`، `implementers`، `budget`، `mechanism`، `success_indicator`، `risk_management`، `register_id`، `owner_role`، `indicator_ids` (JSON نصي)، `status`، `duty_ref`، `task_ref`، `created_at`، `updated_at`.

أُضيفت: `owner_roles`، `baseline_value`، `target_value`، `current_value`، `unit`، `kpi_description`، `goal_ref`، `domain`، `level_name`.

من يقرأ: `list_programs()` في `program_registry.py`. المسار المفتوح `GET /api/programs` يعيد البرامج مع القوالب والسجلات والأدوار وأهداف الخطة (`id` و`text` فقط). القشرة `loadPlanning` تقرأ هذا المسار.

من يكتب:

- `POST /api/programs` يستدعي `save_program` بلا جلسة في التعريف الحالي. يقبل تحديث صف قائم وتغيير الحالة ضمن `_next_status` (الاعتماد الصريح مسار آخر).
- `POST /api/session/programs` في `program_session_api.py` بجلسة، ويفرض `id = 0` و`status = مسودة`، فلا يحدّث صفاً ولا يعتمد.
- `POST /api/programs/approve` اعتماد المدير.
- عند `init_db`: `ensure_school_programs_from_templates` يزرع القالب الناقص ويحدّث الحقول الفارغة. هذا كاتب ثانٍ عند تهيئة القاعدة.

### بذرة القالب (ليست نسخة البرنامج)

1. الثابت `TEMPLATES` داخل `program_registry.py`.
2. جدول `program_templates` (مفتاح `template_key` وحقول القالب). `template_payload()` يقرأ الجدول ويكمل من الثابت.
3. القراءة للقشرة الجديدة: `GET /api/session/program-templates` بجلسة.

`program_phrase_bank` و`knowledge_options` قوائم صياغة ومجالات، لا سجل البرامج.

## 5. الشواهد

أصل الملفات: `School_Data/evidence/`.
يُنشر للقراءة على `/evidence` من `app.py`.

الربط بكيان: جدول `visual_evidence` (`visual_evidence.py`).

| العمود | الدور |
|---|---|
| entity_type | نوع الكيان |
| entity_key | مفتاح الكيان داخل النوع |
| register_key | سجل اختياري |
| kind | image / video / pdf / link |
| url | مسار `/evidence/...` أو رابط |
| name / created_at | الاسم ووقت الحفظ |

الأنواع المقبولة في الكود: `soft_period`، `daily_task`، `program`، `action`، `minutes`، `council_minutes`، `event`، `lesson`، `register`.
المجلد على القرص: `{نوع}/{مفتاح آمن}/` وملف باسم فريد.
المجلدات التي فيها ملفات عند المسح: `council_minutes` (12)، `program` (10)، `soft_period` (15). `soft` موجود وفارغ.

مفتاح اللاصفية: `{تاريخ}|{رمز الحصة}` في الجدول، ويصبح `__` في اسم المجلد.
إعادة الربط: `rebind_visual_evidence` من مفتاح مسودة إلى مفتاح مثل `program-{id}`.

هذا غير ملف الردود `School_Data/توثيق شواهد التقويم والاعتماد المدرسي - متوسطة سعد بن الربيع الأنصاري (الردود).xlsx`. ذلك الملف يقرأه `_evidence_directory()` ليملأ أسماء المدير والوكلاء والمعلمين في `GET /api/settings`. ليس مجلد الشاهد البصري. اسم المدير في ناتج هذه القراءة يُستبدل أيضاً بـ `OFFICIAL_PRINCIPAL_NAME`.

## 6. الخطط والمؤشرات

### الخطة التشغيلية

الأصل إن وُجد صف: جدول `school_operational_plan` (صف واحد، `ORDER BY id LIMIT 1`).
الحقول: `academic_year`، `vision`، `mission`، `values_json`، `swot_analysis`، `strategic_goals` (JSON: `id`، `text`، `indicators[{kpi,target,measurement}]`)، `kpis`، `budget`، `planning_team`، `monitoring_plan`، `updated_at`.

البذرة إن لم يوجد صف: `Core_Engine/content_bank/principal.json`. `read_plan()` يضع `source: bank` و`persisted: false`. الميزانية والمتابعة تبقى فارغة في هذا الفرع.

القراءة: `read_plan()`، و`GET /api/knowledge-bank` (جلسة) يعيد `source` و`academic_year` و`goals` و`missing` لـ G1–G7. `GET /api/programs` يأخذ من الخطة `id` و`text` فقط.

ربط مهمة بهدف: جدول `task_goal_links` (`role`، `task_code`، `goal_id`).

جدول `plans` (`plan_type`، `week_number`، `content`) مخطط قديم في `database.py`. ليس مسار `read_plan()`.

### مؤشرات نافس / التقويم (مصدر آخر، ليس أهداف G1–G7)

الأصل: `config/performance_metrics.json`.
المرآة: `Print_Canvas/components/_shared/performance_metrics.json`.
`GET /api/performance-metrics` يستدعي `sync_performance_mirror` ثم يعيد الملف الكنسي.
في رأس الملف أرقام هوية وأعداد (منها `students_total` و`ministry_id`). هذه ليست أعمدة `school_settings`.

### مؤشرات البرامج

`school_programs.indicator_ids` معرفات داخل السجل، و`success_indicator` نص، وحقول القياس (`baseline_value`، `target_value`، `current_value`، `unit`، `kpi_description`).
مؤشرات الهدف في الخطة تبقى داخل `strategic_goals`، وتعرضها القشرة الجديدة اقتراحاً بجانب النموذج ولا تحفظها مكان `indicator_ids`.

## 7. السجلات الأخرى المذكورة في السؤال

| الموضوع | الأصل | من يقرأ / يكتب |
|---|---|---|
| المنسوبون | جدول `noor_staff` | قراءة مفتوحة `GET /api/noor/staff`. كتابة الجلسة `staff_session_api.py`. كشف الإعدادات يأتي من ملف الردود xlsx لا من هذا الجدول. |
| المجالس | `School_Data/council_minutes.json` | مسارات المجالس في `app.py`. التوقيعات مسار الجلسة أعلاه. |
| خيارات المجال والمستوى | جدول `knowledge_options` | `list_knowledge()` ضمن `GET /api/programs`. الحفظ في البرنامج عمودا `domain` و`level_name`. |

## 8. ازدواج وانحراف

1. اسم المدرسة في ثلاثة مواضع كتابة: عمود `school_name`، وثابت `_DEFAULT_SCHOOL_NAME`، و`DEFAULTS.school` و`bookletSchoolName` الابتدائي في جافاسكربت. اللوحة تُحدّث المتغير من العمود بعد التحميل. القشرة لا تفعل. الإطار يستخدم المتغير إن وُجد وإلا الثابت. انحراف ظاهر إن تغيّر العمود قبل فتح اللوحة، أو في أي طباعة لا تضبط `bookletSchoolName`.
2. التواقيع مساران: `School_Data/signatures` مع عمود `users.signature_path` (جلسة ومحضر)، و`Print_Canvas/signatures` كملفات ثابتة لشريط الإطار. النسخ من الثاني إلى الأول يحدث عند القراءة فقط إن تطابق الاسم. ملف الجلسة الواحد لا يغذي شريط الاعتماد الثلاثي.
3. أسماء الأشخاص: `noor_staff`، وملف الردود xlsx داخل `GET /api/settings`، و`identity.json`، و`DEFAULT_SIGNOFF`، والثابت `OFFICIAL_PRINCIPAL_NAME` الذي يطغى على `chair_name` عند الحفظ. هذه خمسة مداخل للاسم. سجل القشرة يقرأ `noor_staff`. شاشة الإعدادات تقرأ xlsx.
4. الاعتماد: الملف `approval_authorities.json` بذرة، والعمود أصل بعد الحفظ. الملف لا يُحدَّث بالكتابة، فيبقى نسخة قديمة لمن يفتحه مباشرة.
5. الخطة: صف `school_operational_plan` أصل بعد الحفظ، و`principal.json` بذرة تبقى على القرص. من يقرأ الملف مباشرة يرى البذرة لا الصف.
6. نافس: `config/performance_metrics.json` أصل، والمرآة تحت `Print_Canvas/components/_shared/` تُنسخ عند `GET /api/performance-metrics`. تحرير المرآة باليد ينحرف حتى الطلب التالي.
7. البرامج: `school_programs` أصل النسخة المحفوظة. `TEMPLATES` و`program_templates` بذرة. `init_db` يكتب في الأصل عندما تكون الحقول فارغة، ومنها تعبئة `goal_ref = G3` لبرنامج اسمه يحتوي «الفاقد» إن كان المرجع فارغاً.
8. جدول `settings` مخطط بلا قارئ أو كاتب في `Core_Engine`. ليس ازدواجاً عاملاً، وهو سطح زائد.
9. أعداد الطلاب في رأس `performance_metrics.json` ليست عمود `school_settings.total_students`. مصدران لرقم «عدد الطلاب» إن استُعمل الحقلان معاً.
10. طباعة المحضر في القشرة مسار ثانٍ بجانب `OfficialFrameCore`. لا تقرأ الترويسة من الإعدادات.

## 9. الخطوة الرقيقة المقترحة (لا تُنفَّذ هنا)

خطوة واحدة: في استقبال القشرة `app-journey`، قراءة حقل `school.name` من `GET /api/settings` وعرضه في سطر الهوية الظاهر، بلا كتابة إلى القاعدة، وبلا تعديل على `OfficialFrameCore` ولا على ملفات اللوحة القديمة.

سبب اختيارها: الحقل له أصل واحد (`school_settings.school_name`)، واللوحة تقرأه أصلاً، والقشرة لا تقرأه. الخطوة مستهلكة لا طبقة جديدة، وتتراجع بحذف سطر العرض.

ليست هذه الخطوة دمج التواقيع، ولا توحيد كشف xlsx مع `noor_staff`، ولا نقل ترويسة الإطار. تلك ثلاثة أعمال لاحقة، كل منها بأمر بعد مراجعته.

## توقف

لا كود بعد هذا الملف. المراجعة تقرر إن كانت الخطوة في القسم 9 تُقبل أو تُستبدل.
