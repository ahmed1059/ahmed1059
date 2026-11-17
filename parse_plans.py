# -*- coding: utf-8 -*-
import os
import re
import json

file_path = r"School_Data\knowledge_bases\improvement_plans.txt"
json_path = r"School_Data\knowledge_bases\plans-bank.json"

if not os.path.exists(file_path):
    print(f"❌ الملف غير موجود.")
    exit()

with open(file_path, 'rb') as f:
    raw = f.read()

if len(raw) < 10000:
    print(f"⚠️ الملف صغير جداً ({len(raw)} بايت). النص لم يُلصق كاملاً!")
    exit()

try:
    text = raw.decode('utf-8-sig')
except UnicodeDecodeError:
    text = raw.decode('utf-8', errors='ignore')

# البحث عن المؤشرات حتى لو كان بجانبها مسافات أو كلمات إضافية
pattern = re.compile(r'(?m)^[ \t]*(\d+-\d+-\d+-\d+|[A-Z]\d+)[ \t]*(.*)$')
matches = list(pattern.finditer(text))

if not matches:
    print("⚠️ لم يتم العثور على أي أكواد. تأكد من لصق النص كاملاً.")
    exit()

data = []
for i in range(len(matches)):
    start_idx = matches[i].start()
    end_idx = matches[i+1].start() if i+1 < len(matches) else len(text)
    
    block = text[start_idx:end_idx].strip()
    lines = block.split('\n')
    code = matches[i].group(1).strip()
    title = matches[i].group(2).strip() if matches[i].group(2).strip() else (lines[1].strip() if len(lines) > 1 else "")

    def extract_between(start_str, end_str, text_block):
        try:
            start_pos = text_block.index(start_str) + len(start_str)
            end_pos = text_block.index(end_str, start_pos) if end_str in text_block else len(text_block)
            return text_block[start_pos:end_pos].strip()
        except ValueError:
            return ""

    domain = extract_between('📘 مجال', 'المعيار', block).replace('\n', ' ').strip()
    standard = extract_between('المعيار\n', 'العنصر', block).strip()
    element = extract_between('العنصر / المكون المراد تحسينه\n', 'المكون الإشرافي', block).strip()
    
    proc_raw = extract_between('الإجراءات', 'لجان المدرسة', block)
    proc_clean = re.sub(r'\(\d+\)', '', proc_raw).strip()
    procedures = [p.strip() for p in proc_clean.split('\n') if p.strip()]
    
    committees = extract_between('لجان المدرسة\n', 'المشرف التربوي', block).strip()
    evidence = extract_between('السجلات والشواهد\n', 'محكات المؤشر', block).strip()
    
    exp_raw = extract_between('توقعات الهيئة\n', '🧭', block)
    if not exp_raw:
        exp_raw = extract_between('توقعات الهيئة\n', '➕', block)
    expectations = exp_raw.strip()

    data.append({
        "code": code,
        "title": title,
        "domain": domain,
        "standard": standard,
        "element": element,
        "procedures": procedures,
        "committees": committees,
        "evidence": evidence,
        "expectations": expectations
    })

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ تم استخراج {len(data)} مؤشراً و {sum(len(i['procedures']) for i in data)} إجراءً بنجاح!")
print(f"📁 تم حفظ الملف في: {json_path}")