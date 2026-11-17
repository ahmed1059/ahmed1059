# سجل تغييرات API — جلسة القشرة

**التاريخ:** 2026-11-03  
**السبب:** قشرة رحلة المدير تحتاج توقيعاً محفوظاً مركزياً، وكتابة منسوبين محمية، وقراءة توقيعات حضور المحضر دفعة واحدة.

## توقيع الجلسة — `Core_Engine/session_signature_api.py`

- Migration: `ALTER TABLE users ADD COLUMN signature_path TEXT` (nullable، مرة واحدة).
- `GET /api/session/signature` يعيد `signature_path` و`has_signature` و`signature_data_url` لصاحب الجلسة فقط.
- `POST /api/session/signature` يستقبل PNG Base64، يتحقق (سحر PNG + حد 500KB)، ويحفظ الملف.
- مكان الحفظ: `School_Data/signatures/sig_{national_id}.png`.
- `users.signature_path` يخزّن اسم الملف فقط (`sig_{id}.png`) وليس URL عاماً.
- `POST` يستخدم `require_user` ويكتب على `user["id"]` من الجلسة فقط.
- `GET /api/session` يضيف الحقل `signature_path` فقط إلى كائن المستخدم.
- العرض في الواجهة عبر data URL من API المصادق، لا عبر مسار static عام.

## كتابة المنسوبين — `Core_Engine/staff_session_api.py`

- `POST /api/session/staff` يحفظ منسوباً أو يعدّله.
- `DELETE /api/session/staff/{national_id}` يحذف منسوباً.
- الحقلان الإلزاميان: `national_id` و`name`. بقية الحقول: `original_id` و`role` و`specialty` و`mobile` و`active`.
- الحماية: `require_user` عبر `X-Session-Token`. أي مستخدم داخل الجلسة، لا المدير وحده.
- `POST /api/noor/staff` و`DELETE /api/noor/staff/{national_id}` بقيا بلا جلسة حتى تعمل الشاشة القديمة.

## توقيعات حضور المحضر — `Core_Engine/council_signature_api.py`

- `GET /api/session/councils/{council_id}/signatures`
- الحماية: `require_user`. بلا توكن: `401` و«لا جلسة». محضر غير موجود: `404`.
- يقرأ حضور ذلك المحضر من `School_Data/council_minutes.json` (حقل `present`).
- يبحث عن `School_Data/signatures/sig_{رقم_الهوية}.png` لهويات رقمية بين 8 و12 خانة فقط.
- الإجابة كائن JSON واحد: المفتاح رقم الهوية، والقيمة `data:image/png;base64,...`.
- من بلا ملف، أو معرّفه ليس رقم هوية، لا يُذكر مفتاحه في الكائن.

## التسجيل في `Core_Engine/app.py`

سطر `include_router` لكل ملف جديد، قبل تقديم الملفات الثابتة. لا تغيير على مسارات ERP القديمة غير إضافة `signature_path` في `GET /api/session`.

## بنك المعرفة — `Core_Engine/knowledge_bank_api.py`

- `GET /api/knowledge-bank`
- الحماية: `require_user`. بلا توكن: `401` و«لا جلسة».
- القراءة من `read_plan()`: الخطة المحفوظة إن وُجدت، وإلا ملف المدير. لا نسخة جديدة للأهداف.
- الإجابة: `source` و`academic_year` و`goals` و`missing`.
- كل هدف: `id` و`domain` و`text` و`indicators` (`kpi` و`target` و`measurement`). الحقل الفارغ يبقى فارغاً.
- `missing` يسرد ما غاب من G1–G7 ولا يُستبدل بنص آخر.
- `/api/performance-metrics` يبقى مسار مركز نافس، ولا يُدمج هنا.

## برامج الجلسة — `Core_Engine/program_session_api.py`

- `GET /api/session/program-templates` يعيد القوالب والسجلات الستة والأدوار والوحدات. الحماية `require_user`.
- `POST /api/session/programs` يحفظ مسودة جديدة عبر `save_program`. يجبر `id=0` و`status=مسودة`. لا يحدّث برنامجاً قائماً ولا يعتمد.
- `POST /api/programs` القديم بقي بلا جلسة. اعتماد المدير بقي `POST /api/programs/approve`.
- بنك المعرفة لا يحتوي القوالب.

## ما لم يُمس

- `erp-nav.js` · `erp-suite.js` · `dashboard.html`
- بقية جداول SQLite وبياناتها القائمة
- مسارات الطباعة الرسمية القديمة
