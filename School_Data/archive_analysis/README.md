# تحليل الأرشيف — أوامر التشغيل (المرحلة أ / خطوة 2)

المجلد: `School_Data/archive_analysis/`  
القيد: **لا خ6/خ7** هنا. الأرقام المعتمدة مجمّدة في `config.FROZEN`.

## المتطلبات

```bash
cd School_Data/archive_analysis
pip install -r requirements.txt
```

## مسار الأرشيف النصي

الكود **لا** يضمّن مساراً مطلقاً لجهاز معيّن. الترتيب:

1. متغير البيئة `SCHOOL_ARCHIVE_PATH` (إن وُجد)
2. `../البرامج والتقارير والسجلات والمحاضر .txt` بجانب مجلد المشروع (عادةً سطح المكتب)
3. مرشحون داخل المشروع (انظر `config.py`)

Windows PowerShell مثال:

```powershell
$env:SCHOOL_ARCHIVE_PATH = "D:\path\to\البرامج والتقارير والسجلات والمحاضر .txt"
```

## أمر موحّد

من داخل هذا المجلد:

```bash
# التحقق من المخرجات المجمدة + الاختبارات (الافتراضي — لا إعادة حساب)
python run_all.py

# أو صراحة
python run_all.py --validate-only

# تشغيل خوارزمية واحدة (يعيد الحساب — استخدم بحذر؛ راقب الانحدار)
python run_all.py --algo 1
python run_all.py --algo 2
python run_all.py --algo 3
python run_all.py --algo 4
python run_all.py --algo 5

# تشغيل السلسلة 1←5 (إعادة حساب كاملة — غير مطلوبة في الخطوة 2)
python run_all.py --execute
```

## خ1 ← خ5 (يدوياً)

| خ | الأمر | يعتمد على | مخرجات رئيسية |
|---|---|---|---|
| 1 | `python _build_01_inventory.py` ثم `python _enrich_01_inventory.py` ثم `python _adopt_algo1.py` | الأرشيف النصي | `01_inventory.csv` (565) |
| 2 | `python _run_02_duplicates.py` | خ1 + الأرشيف | `02_duplicates.csv` (441) · `02_groups.csv` (37) |
| 3 | `python _run_03_indicators.py` | خ1 + الأرشيف | `03_indicators.csv` (21/44/495) |
| 4 | `python _run_04_person_tasks.py` | خ1 + خ3 + `committee_formations.json` | `04_person_task_cards.csv` (10) |
| 5 | `python _run_05_committees.py` | خ1 + التشكيلات + خ4 تقاطع | `05_committee_structure.csv` (15) |

> لا يوجد ملف باسم `_run_01_inventory.py` — السلسلة أعلاه هي أمر خ1 الموحّد.

## الاختبارات

```bash
python -m unittest discover -s tests -v
```

## تبعيات بين الخوارزميات

```
خ1 (جرد) → خ2 (تكرار)
         → خ3 (مؤشرات) → خ4 (قوالب بطاقات)
خ1 + تشكيلات → خ5 (أدوار لجان)
خ4 تقاطع → خ5 (اختياري للتقاطعات)
```

حذف `01_inventory.csv` يكسر خ2–خ5.

## سجل الخطوة 2

انظر `run_log.md` في هذا المجلد.

## أدوات تاريخية (لا تُشغَّل يومياً)

| السكربت | الدور | ملاحظة |
|---|---|---|
| `_build_00_source_manifest.py` | بناء بيان المصادر مرة واحدة | قد يحوي مسارات ضمّ قديمة؛ لا جزء من `run_all.py --validate-only` |
| `_adopt_algo1.py` | اعتماد مخرجات خ1 / ضمّ خارجي | تاريخي؛ يُبقى للرجوع إن أُعيدت خ1 |

لا تُحذف. ليست في مسار التشغيل اليومي خ2–خ5.

## الخطوة 3 — إعادة تصنيف خ2

```bash
python _run_02_reclassify.py
```

المخرجات: `02_reclassified.csv` · `02_reclassification_report.md` · `02_reclassification_run_log.md`  
القيد: 441 زوجاً ثابتاً — بلا حذف — لا خ6/خ7.
