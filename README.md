# منظومة حوكمة المدرسة 1059

متوسطة سعد بن الربيع الأنصاري — إعادة هيكلة تجربة المستخدم وفق المحطات الأربع (Strangler Fig عبر `app-journey.*`).

## المحطات المعتمدة

1. التأسيس والإعدادات المركزية  
2. الخطط المدرسية  
3. السجلات والمحاضر والشواهد  
4. القياس والاعتماد المدرسي  

## رفع النسخة المحلية (ما قبل الوحدة الأولى)

من جهاز Windows الذي يحتوي مجلد المشروع الفعلي:

```powershell
# عدّل -SourceDir إن لزم
Set-ExecutionPolicy -Scope Process Bypass -Force
irm https://raw.githubusercontent.com/ahmed1059/ahmed1059/cursor/prep-repo-backup-upload-b9be/tools/import-local-project.ps1 -OutFile import-local-project.ps1
# أو انسخ السكربت من tools/import-local-project.ps1 بعد سحب هذا الفرع
.\import-local-project.ps1 -SourceDir "D:\School_Governance_System_1059"
```

السكربت يأخذ نسخة احتياطية محلية ثم يرفع الملفات إلى فرع `cursor/import-full-project-b9be`.
