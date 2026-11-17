# TPL-01 — مكوّن ديناميكي (قرار 134)
## الحالة: مُسلَّم · بانتظار دمج صاحب النظام + صورة

| الملف | الغرض |
|---|---|
| `TPL-01.html` | صفحة دمج/معاينة · OfficialFrameCore · زر طباعة · يحمّل dashboard للتقويم |
| `TPL-01.js` | برامج + عنوان ذكي + `populateDropdowns` + تقويم هـ/م |
| `programs.json` | قائمة برامج (احتياطي من TEMPLATES؛ يفضّل `/api/programs` على :8080) |
| `identity.json` | 41 اسماً (high+medium) |
| `indicators.json` | 13 مؤشراً معتمداً |
| `TPL-01.json` | schema الحقول (مرجع دمج) |

## ترقية 137
- قائمة برامج: `/api/programs` ثم `programs.json` (17 من TEMPLATES).
- العنوان: `تقرير برنامج` / `تقرير مسابقة` / `تقرير مبادرة` حسب النوع.
- التقويم: `.dual-date-pair` + `bindDualDatePickers` من `dashboard.js`.
- معاينة: `Print_Canvas/preview-tpl01.html` عبر المزامنة.

### دمج سريع في النظام المحلي
```html
<script src="…/official-frame-core.js"></script>
<script src="components/tpl01/TPL-01.js"></script>
<script>
  TPL01.mount({
    identityUrl: "components/tpl01/identity.json",
    indicatorsUrl: "components/tpl01/indicators.json"
  });
</script>
```

أو استدعاء منفصل:
```js
TPL01.populateDropdowns("identity.json", "indicators.json", document);
```

### قيود
لا TPL-02 · لا API · لا DB · لا إطار طباعة جديد · لا باركود إلزامي · لا حقول خارج الهيكل.
