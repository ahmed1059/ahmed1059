# اختبار نهائي End-to-End · خ-الإنهاء م3 · قرار 156

## الطريقة
عدّ منطقي من `programs.json` + `programs_knowledge.json` + `roles.json` + تحقق كودي لشارة «مكرر» في `my-plan.js`.

| الدور | برامج | منها مكرر | موسمي | مرشّح | مرشّح مكرر | النتيجة |
|---|---:|---:|---:|---:|---:|---|
| principal | 3 | 0 | 0 | 3 | 2 | اجتاز |
| vice_teachers | 6 | 0 | 0 | 26 | 2 | اجتاز |
| vice_students | 8 | 0 | 1 | 15 | 3 | اجتاز |
| vice_admin | 0 | 0 | 0 | 0 | 0 | فارغ موثّق — اجتاز |
| student_counselor | 2 | 0 | 0 | 9 | 0 | اجتاز |
| health_counselor | 0 | 0 | 0 | 0 | 0 | فارغ موثّق — اجتاز |
| teacher | 8 | 0 | 0 | 0 | 0 | اجتاز |
| activity_leader | 10 | 1 | 2 | 9 | 0 | اجتاز |
| librarian | 8 | 1 | 1 | 0 | 0 | اجتاز |
| lab_tech | 2 | 0 | 1 | 0 | 0 | اجتاز |
| admin_assistant | 1 | 0 | 0 | 0 | 0 | اجتاز |

- إجمالي البرامج: **47**
- نواة موسومة مكرر: **2** → ['reading_for_all→reading_init', 'radio_program→school_broadcast']
- واجهة الشارة: `mp-badge-dup` في `my-plan.html/js`

## حكم الجاهزية
**جاهز**

### مراجعة ذاتية م3
- إخفاقات: لا أخطاء
- تصحيح فوري: طُبّقت شارة المكرر في الواجهة ضمن هذه المهمة.
