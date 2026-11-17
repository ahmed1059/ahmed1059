# خطتي / RolePlanPack — ملخص المنظومة
## خ-الإغلاق · قرار 155

## ما هي؟
واجهة «خطتي» تجمع لكل منسوب: أهدافه · برامجه المعتمدة · مرشحي المعرفة · بنود التنفيذ · السجلات · القوالب — حسب **الدور** لا حسب قائمة عامة.

## كيف تعمل؟
1. يُحدَّد الدور من الجلسة أو `?role=`.
2. `rolePlanPack.js` يقرأ `roles.json` + `programs.json` + `programs_knowledge.json` + `task_goal_links.json`.
3. تُعرض فقط برامج `owner_role` / `owner_roles` للدور.
4. البرامج `seasonal=true` مخفية إلا `?seasonal=1`.
5. المرشّح مميّز بصرياً وليس معتمداً للتنفيذ.

## من يستخدمها؟
11 دوراً في `roles.json` (مدير…مساعد). الأدوار بلا برامج في التصنيف تبقى فارغة موثّقة.

## أين الملفات؟
`Print_Canvas/components/my-plan/` و`_shared/programs*.json`.

## العدد الحالي
برامج معتمدة في النواة: **47**.


## خ-الإنهاء (قرار 156)
- `13_duplicate_tagging.md` · `14_MVP_v1.0.md` · `15_final_test.md` · `16_final_delivery.md`
