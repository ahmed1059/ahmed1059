# 18 — تقرير الربط الديناميكي (مصدر الحقيقة الواحد)

**التاريخ:** 2026-11-01  
**المبدأ:** أي رقم أداء يُقرأ من مركز واحد؛ لا Hardcoding في HTML/JS لخطتي.

---

## 1) أين توجد الأرقام؟

| الملف | الدور |
|---|---|
| **`config/performance_metrics.json`** | المصدر الكنسي (Canonical) |
| **`Print_Canvas/components/_shared/performance_metrics.json`** | مرآة للخدمة الثابتة لصفحة خطتي |
| **`Print_Canvas/components/_shared/program_goal_indicator_map.json`** | قرارات الربط برنامج↔مؤشر↔هدف تفصيلي (ليست أرقام نافس) |

عند التحديث: عدّل **الكنسي** ثم انسخ للمرآة (أو أعد تشغيل `_build_168b_hub.py`). الصفحة تطلب المرآة بـ `cache: "no-store"`.

---

## 2) ماذا يحتوي المركز؟

- `nafes.math|reading|science` → `score` + `target`
- `external_evaluation.overall|administration|teaching|outcomes|environment`
- `indicators.<code>` → درجة/مستوى حالي ومستهدف
- `improvement_goals.*` → نصوص خطة التحسين + مدة + منفّذ
- `program_bindings` → ربط برامج موجة 168-ب بالمفاتيح أعلاه
- `code_aliases` → تقابل رموز التقرير ↔ ETEC

---

## 3) كيف تقرأها «خطتي»؟

الملف: `my-plan-app.js` (إصدار `i4`)

1. عند كل `loadRole` يستدعي `loadHub()` فيجلب:
   - `../_shared/performance_metrics.json`
   - `../_shared/program_goal_indicator_map.json`
2. `renderMetrics()` يبني شريط «مؤشرات الأداء» من `external_evaluation` و`nafes` فقط — **بلا أرقام مكتوبة في HTML**.
3. `enrichProgram()` يدمج:
   - `executive_fields` من خريطة الربط (إن وُجدت)،
   - و/أو `improvement_goals` عبر `program_bindings`,
   - ومؤشر النجاح من `success_binding` عبر `resolveMetric(key)`.

---

## 4) اختبار التغيير (مطلوب للتحقق اليدوي)

1. افتح `config/performance_metrics.json`.
2. غيّر مثلًا `nafes.math.score` من `18.8` إلى `20`.
3. انسخ الملف إلى المرآة `_shared/performance_metrics.json` (أو أعد البناء).
4. حدّث صفحة خطتي (`my-plan-app.html`) أو اضغط «تحديث».
5. **المتوقع:** بطاقة «نسبة الإتقان — الرياضيات» تعرض `20%` فورًا.

لا يوجد اليوم مسار طباعة كتيب يقرأ المركز — النطاق المعتمد: **خطتي فقط**.

---

## 5) قيود صريحة

| القيد | الحالة |
|---|---|
| لا Hardcoding لأرقام نافس/التقرير في HTML | ملتزم في شريط المقاييس |
| لا تعديل `programs.json` | ملتزم |
| لا كتيب تشغيلي في هذه الموجة | ملتزم |
| رموز تقرير غير مطابقة لـ ETEC | موثّقة كـ `provisional` في المركز |

---

## 6) ملاحظة ملكية البرامج الثلاثة

`national_day` / `school_broadcast` / `radio_program` في النواة مملوكة لـ **`activity_leader`** وليست `principal`.  
التحديث في الخريطة والمركز مكتمل؛ ظهورها في جدول «برامج دوري» يكون عند اختيار دور رائد النشاط (مع إظهار الموسمي إن لزم). برامج `principal` في النواة حاليًا: `planning` · `partnership` · `parent_meet`.
