# الوحدة الأولى — تدقيق وحصر التعارضات (المحطات الأربع)

**الحالة:** مكتملة (جرد فقط — بلا حذف أعمى)  
**التاريخ:** 2026-11-17  
**الفرع:** `cursor/unit1-audit-conflicts-b9be`  
**الأساس:** المذكرة المعمارية المعتمدة + الشروط التقنية الثمانية  
**الخادم (SSOT):** `Core_Engine/app.py` — **ليس** `server.py`

---

## 0) نطاق الوحدة وما لم يُنفَّذ عمداً

| مُنجَز | مؤجَّل (وحدات لاحقة) |
|--------|----------------------|
| نسخة احتياطية محلية (لدى صاحب المشروع) | حذف/إعادة كتابة في `erp-nav.js` / `erp-suite.js` / `dashboard.html` |
| جرد التعارضات الحرجة والمتوسطة | توحيد القائمة الجانبية إلى 4 محطات (الوحدة 2) |
| خريطة تسكين الأدوات → المحطات الأربع | عزل الحاويات البصري (الوحدة 3) |
| قائمة ملفات **ممنوع لمسها** vs **مسار الخنق** | اختبار تنقل/طباعة شامل (الوحدة 4) |

**قاعدة الوحدة 1:** حصر بلا حذف أعمى. أي تنظيف لاحق يتم عبر غلاف `app-journey.*` (Strangler Fig) وليس بفتح القشرة القديمة.

---

## 1) المحطات الأربع المعتمدة (مرجع التسمية)

1. **التأسيس والإعدادات المركزية** — بيانات المدرسة، استيراد نور، تشكيل اللجان (+ قيادة، تقويم، حسابات، صلاحيات، ترويسة، نسخ).
2. **الخطط المدرسية** — توليد الخطط التشغيلية، الجدولة، اعتماد الخطة، البرامج، خطتي.
3. **السجلات والمحاضر والشواهد** — السجلات الـ 18، محاضر اللجان، الشواهد، الطباعة الرسمية A4.
4. **القياس والاعتماد المدرسي** — تنبيهات حرجة (رادار تشغيل)، مؤشرات، نواتج تعلم، تقرير ETEC التجميعي.

---

## 2) تشخيص معماري موجز

النظام يعمل حالياً كـ**قشرتين متوازيتين**:

| القشرة | المدخل | المحرك | الحجم التقريبي |
|--------|--------|--------|----------------|
| ERP قديمة (حية) | `Print_Canvas/dashboard.html` | `erp-nav.js` (~513KB) + `erp-suite.js` (~176KB) + `dashboard.js` (~182KB) | ضخمة، localStorage كثيف |
| رحلة المدير (Strangler) | `Print_Canvas/app-journey.html` | `app-journey.js` (~422KB) + وحدات `app-journey-*.js` | مسار SSOT عبر `/api/session/*` |

الرحلة تعرّف **6 مراحل UI** (`plan` / `settings` / `tasks` / `exec` / `follow` / `evidence`) وليست بعد المحطات الأربع المعتمدة — هذا هدف الوحدة 2.

---

## 3) تعارضات حرجة (يجب معالجتها قبل/أثناء الوحدة 2–3)

### C1 — تكدس الشاشات بسبب `!important` على البهو
- **الملف:** `Print_Canvas/css/media-governance.css`
- **الدليل:** تكرار `#quiet-lobby { display: block !important; }` (مثلاً حول الأسطر 1203، 1245، 1367).
- **الأثر:** يبطل `lobby.style.display = 'none'` من `hideAllViews` / تنقل ERP → بهو + محتوى معاً.
- **قرار الوحدة 1:** لا حذف الآن داخل الملف القديم؛ الوحدة 3 تعزل عبر قشرة الرحلة / تجاوزات `app-journey.css` دون كسر عقد الطباعة.

### C2 — دوال تنقل مكررة ومتعارضة في `dashboard.js`
- `window.setDashboardView` (~3817) يعتمد أصناف `body.view-*` ويصفّر `style.display`.
- `hideAllViews` / `navigateToSection` / `returnToLobby` تفرض إخفاءً يدوياً.
- **`returnToLobby` معرّفة عدة مرات**؛ **`navigateToSection` مكررة** → آخر تعريف يفوز، والبقية دين ميت/متضارب.
- **قرار:** لا تعديل على `dashboard.js` في هذه الوحدة؛ القشرة تُخنق عبر التحويل إلى `app-journey.html`.

### C3 — ازدواج كتابة بيانات المدرسة
| المسار | الآلية |
|--------|--------|
| رحلة | `loadSchoolSettings` / `saveSchoolSettings` → `GET/POST /api/settings` |
| settings.html | `settings.js` → نفس API |
| ERP | `paintFacility` + `board1059.facility` (localStorage) |

يكسر شرط SSOT.

### C4 — استيراد نور في ثلاثة مواضع
1. ERP: `erp-nav.js` → `paintNoorImport` → `POST /api/noor/import`
2. رحلة: `app-journey-import-center.js` → `AjImportCenter` → `#view-import-center`
3. بطاقات قديمة: `settings.html` / `registers.html` + `students-registry.js` (`studentsRegistry1059`)

### C5 — اللجان في أربعة مسارات
1. ERP قائمة `committees` / `committees-home`
2. `dashboard.js` → `renderCommitteesPortal`
3. رحلة: `AjCommittees` + `/api/session/committees`
4. نموذج لجنة داخل `settings.html`

### C6 — قشرتان حيّتان (Strangler غير مكتمل)
- `dashboard.html` يحوّل بعض الهاشات إلى الرحلة ويُبقي ERP للمراجعة (`#review`).
- `app-journey.html` يحتفظ برابط «النظام السابق للمراجعة» → `dashboard.html#review`.
- **مقبول مؤقتاً** شرط أن تبقى الكتابة التشغيلية على APIs الرحلة فقط في الوحدات القادمة.

### C7 — إخفاء مزدوج في موجّه الرحلة
- `router()` يضبط السمة `hidden` و`style.display` معاً؛ CSS `.aj-view[hidden]{display:none!important}` قد يتعارض مع inline `display:block` عند حالات حدّية.

---

## 4) مخاطر متوسطة

| رمز | الملخص |
|-----|--------|
| M1 | تكرار تنقل الرحلة: شريط جانبي + بطاقات المنزل + شريط سفلي بنفس المسميات |
| M2 | قائمة ERP ثابتة في HTML + حقن ديناميكي يكرر روابط الإعدادات/السجلات |
| M3 | أبواب `#quiet-lobby` الأربعة تكرر وجهات السجلات/الخطط/القياس |
| M4 | قيادة مزدوجة: `board1059.leadership` مقابل `/api/session/leadership` |
| M5 | سجل طلاب محلي `studentsRegistry1059` مقابل نور/جلسة |
| M6 | اسم مستعار `view-noor-import` → `view-import-center` (دين تحويل) |
| M7 | سباق `!important` في `media-governance.css` (عزل شاشات + طباعة) |
| M8 | `settings.html` / `setup.html` بشريط جانبي منفصل عن ERP والرحلة |
| M9 | مقاس لوحي: `openStage("")` يغلق كل لوحات المراحل أثناء المزامنة |
| M10 | احتمال ظهور `measurement-center` مع بهو/منزل في مسارات ERP |

---

## 5) مخالفات SSOT — `localStorage` (قشرة قديمة)

وحدات `app-journey-*.js` تصرّح: **بلا localStorage للبيانات** وتستخدم `sessionStorage.sessionUser` للجلسة فقط — هذا متوافق.

المخالفات الأساسية في القشرة القديمة (`erp-nav.js` / `erp-suite.js` / `dashboard.js`):

| مفتاح | غرض |
|-------|-----|
| `board1059.facility` | هوية/مبنى موازية لـ `/api/settings` |
| `board1059.leadership` | تشكيل توقيعات محلي |
| `board1059.calendar` | تقويم/محطات |
| `board1059.permissions` / `accounts` / `letterhead` | صلاحيات/حسابات/ترويسة واجهة |
| `board1059.attendance` / `studentAbsence` / `behavior` / … | سجلات تشغيل محلية |
| `board1059.councils` / `visits` | كاش موازٍ لـ APIs |
| `studentsRegistry1059` | طلاب إكسل محلي |
| `theme1059` / `sidebar1059` | تفضيلات قشرة (أولوية منخفضة) |

**هدف لاحق:** إغلاق الكتابة على مفاتيح المنشأة/القيادة/التقويم لصالح `Core_Engine/app.py`.

---

## 6) ملفات ممنوعة vs مسار الخنق

### ممنوع التعديل (الشرط 2)
- `Print_Canvas/js/erp-nav.js`
- `Print_Canvas/js/erp-suite.js`
- `Print_Canvas/dashboard.html`

### مسار الخنق المسموح
- `Print_Canvas/app-journey.html`
- `Print_Canvas/js/app-journey.js` + `Print_Canvas/js/app-journey-*.js`
- `Print_Canvas/css/app-journey.css`
- مسارات API جديدة تحت `Core_Engine/` عند الحاجة (جلسة محمية)

### محصّن بصرياً (عقد الطباعة — الشرط 6)
- `.official-document-frame` / `OfficialFrameCore.armPrintPage`
- قواعد `print-official-core` داخل `media-governance.css` و`official-frame-core.js`
- **لا تُمس** محددات الترويسة/التوقيعات دون استثناء صريح بكلمة «موافق»

---

## 7) خريطة التسكين → المحطات الأربع

### المحطة 1 — التأسيس والإعدادات المركزية
| أداة | مصدر رحلة مفضّل | ظل قديم (يُخنق) |
|------|-----------------|------------------|
| بيانات المدرسة | `#view-school` | ERP `facility` + `settings.html` |
| استيراد نور | `#view-import-center` (`AjImportCenter`) | ERP `noor` + بطاقات settings/registers |
| تشكيل اللجان | `#view-committees` (`AjCommittees`) | بوابة ERP + settings |
| التشكيل القيادي | `#view-leadership` | `board1059.leadership` |
| تقويم / مناسبات / ترويسة / نسخ / حسابات / صلاحيات | عروض الرحلة المناظرة | ألواح ERP + settings/setup |

### المحطة 2 — الخطط المدرسية
| أداة | مصدر رحلة مفضّل | ظل قديم |
|------|-----------------|---------|
| الخطط والبرامج | `#view-planning` / `AJPlanning` | ERP `programs` / مولّد الخطة |
| خطط ذكية / إضافة برنامج | `#view-smart-planning` / `#view-program-add` | — |
| تفاصيل واعتماد | `#view-plan-details` | `setup.html` + booklet |
| خطتي | `components/my-plan/my-plan-app.html` | يُربط لاحقاً تحت المحطة 2 |

### المحطة 3 — السجلات والمحاضر والشواهد
| أداة | مصدر رحلة مفضّل | ظل قديم |
|------|-----------------|---------|
| مركز التنفيذ / المحاضر | `#view-execution` / `#view-council-details` | ERP `councils` + registers |
| الزيارات | `#view-visits` / `#view-visits-plan` | ERP `visits` |
| الشواهد | `#view-evidence` / `#view-env-evidence` | visual-evidence APIs + مسودات محلية |
| السجلات الـ 18 | بطاقات ERP registers (خلف `#review` مؤقتاً) | `registers.html` |

### المحطة 4 — القياس والاعتماد المدرسي
| أداة | مصدر رحلة مفضّل | ظل قديم |
|------|-----------------|---------|
| مؤشرات الأداء | `#view-performance` | `#measurement-center` + SSOT |
| تقويم خارجي / ETEC | `#view-external-eval` | ERP `indicators` / improvement |
| متابعة لاصفية | `#view-soft-follow` | soft-periods |
| تنبيهات حرجة (رادار) | مكتب المدير `AjDesk` + إشارات يومية | غرفة قيادة ERP |

---

## 8) فجوة التسمية الحالية (6 مراحل → 4 محطات)

| مرحلة UI حالية (`data-aj-stage`) | المحطة المستهدفة |
|----------------------------------|------------------|
| `settings` إعداداتي | **1 التأسيس** |
| `plan` تخطيطي (+ أجزاء من staff/طلاب إن بقيت للتخطيط) | **2 الخطط** (مع إعادة فرز المنسوبين/الطلاب إن لزم) |
| `exec` تنفيذي + `evidence` شواهدي (+ زيارات من follow) | **3 السجلات والمحاضر والشواهد** |
| `follow` متابعتي + قياس/ETEC من settings | **4 القياس والاعتماد** |
| `tasks` مهامي | تبقى مدخل يومي داخل **مكتبي** أو رادار المحطة 4 (قرار الوحدة 2) |
| `print` طباعتي (مخفي) | يُدمج مع عقد الطباعة داخل المحطة 3 |

---

## 9) إحصاءات سريعة وقت الجرد

| مؤشر | قيمة |
|------|------|
| ملفات المستودع المستوردة | ~1042 |
| أسطر `app-journey.js` | ~11810 |
| أسطر `erp-nav.js` | ~9953 |
| أسطر `dashboard.js` | ~4662 |
| أسطر `media-governance.css` | ~1700 |
| تكرارات `#quiet-lobby { display:block !important }` | ≥3 كتل متتالية |
| تعريفات `returnToLobby` في dashboard.js | متعددة (≥3) |
| نقطة دخول الخادم | `Core_Engine/app.py` (~3527 سطر) |

---

## 10) مخرجات الوحدة 1 ومعيار الاكتمال

- [x] استلام النسخة الكاملة على GitHub
- [x] تصحيح مرجع الخادم إلى `Core_Engine/app.py`
- [x] حصر التعارضات الحرجة C1–C7 والمخاطر M1–M10
- [x] خريطة تسكين → 4 محطات
- [x] تثبيت قائمة الملفات الممنوعة ومسار الخنق
- [ ] **لا حذف أعمى** في القشرة القديمة (متعمد)
- [ ] بدء الوحدة 2 **فقط بعد موافقة صريحة**

---

## 11) مقترح الوحدة 2 (للتاعتماد — بلا تنفيذ الآن)

1. إعادة تسمية مراحل الشريط في `app-journey.html` / `app-journey.css` / موجّه `app-journey.js` إلى المحطات الأربع المعتمدة.
2. الإبقاء على رابط «النظام السابق» خلف صلاحية مالك فقط.
3. عدم لمس `erp-nav.js` / `erp-suite.js` / `dashboard.html`.
4. أي عزل بصري إضافي عبر `app-journey.css` فقط.

**بانتظار موافقتكم للانتقال إلى الوحدة الثانية.**
