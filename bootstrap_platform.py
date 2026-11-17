# -*- coding: utf-8 -*-
"""
bootstrap_platform.py — يبني مسودة Word بتصميم المنصة + ملف JSON للرفع.
"""
import os
import sys
import json
import subprocess

# ضمان أننا في مجلد السكربت الحالي
os.chdir(os.path.dirname(os.path.abspath(__file__)))

def ensure_deps():
    try:
        import docx
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "python-docx", "--quiet"])

# =====================================================================
# 1) بنك الأسئلة (نفس العينة السابقة)
# =====================================================================
QUESTIONS_DATA = {
    "الرياضيات": [
        {"id": 1, "skill": "الأسس", "stem": "أوجد قيمة المقدار: ٣^٤", "options": ["١٢", "١٦", "٣٢", "٨١"], "answer": 3, "explanation": "٣^٤ = ٣ × ٣ × ٣ × ٣ = ٨١."},
        {"id": 2, "skill": "القيمة المطلقة", "stem": "حل المعادلة: |س − ٣| = −١", "options": ["{٢، ٤}", "{١، ٣}", "{−١، −٣}", "∅"], "answer": 3, "explanation": "القيمة المطلقة ≥ ٠ دائماً."},
        {"id": 3, "skill": "معادلة المستقيم", "stem": "معادلة المستقيم المار بـ (٢، ٣) وميله ٤:", "options": ["ص = ٣س − ١", "ص = ٣س + ١٠", "ص = ٤س − ٥", "ص = ٤س − ١٠"], "answer": 2, "explanation": "ص − ٣ = ٤(س − ٢)."},
        {"id": 4, "skill": "المسافة", "stem": "المسافة بين (١، ٢) و(٩، ٨):", "options": ["٦", "٨", "١٠", "١٤"], "answer": 2, "explanation": "جذر(٦٤ + ٣٦) = ١٠."},
        {"id": 5, "skill": "رأس القطع", "stem": "رأس د(س) = س^٢ + ٢س + ١:", "options": ["(٠، ١)", "(−١، ٠)", "(١، ٠)", "(١، ٤)"], "answer": 1, "explanation": "س = −ب/٢أ."},
        {"id": 6, "skill": "المتتابعات", "stem": "الحد الثامن في (−٤، −١، ٢، ٥، ...):", "options": ["١٤", "١٧", "٢٠", "٢٣"], "answer": 1, "explanation": "أ٨ = −٤ + ٧×٣."},
        {"id": 7, "skill": "النسب المثلثية", "stem": "جا(أ) في مثلث ساقاه ١١ و٦٠ والوتر ٦١:", "options": ["١١/٦١", "٦٠/٦١", "١١/٦٠", "٦٠/١١"], "answer": 0, "explanation": "جا = المقابل/الوتر."},
        {"id": 8, "skill": "المتباينات", "stem": "حل: |ك − ٤| > −١٠", "options": ["∅", "−١٤ < ك < ٦", "٦ < ك < ١٤", "−٦ < ك < ١٤"], "answer": 0, "explanation": "القيمة المطلقة ≥ ٠."},
        {"id": 9, "skill": "التباديل", "stem": "٨ طلاب يصطفون. بكم طريقة؟", "options": ["٨", "٢٨", "٤٠٣٢٠", "٦٤"], "answer": 2, "explanation": "٨! = ٤٠٣٢٠."},
        {"id": 10, "skill": "وحيدات الحد", "stem": "(٢ص^٣)(٣ص^٢) =", "options": ["٥ص^٥", "٦ص^٥", "٦ص^٦", "٥ص^٦"], "answer": 1, "explanation": "٢×٣=٦، ص^(٣+٢)."}
    ],
    "العلوم": [
        {"id": 1, "skill": "الطريقة العلمية", "stem": "العامل الثابت:", "options": ["الفرضية", "العامل الثابت", "التابع", "المستقل"], "answer": 1, "explanation": "لا يتغير."},
        {"id": 2, "skill": "التنفسي", "stem": "تبادل الغازات:", "options": ["القصبة", "الشعبتان", "الحويصلات", "الشعيبات"], "answer": 2, "explanation": "جدران رقيقة."},
        {"id": 3, "skill": "الذرة", "stem": "العدد الذري =", "options": ["المستويات", "النيوترونات", "البروتونات", "النواة"], "answer": 2, "explanation": "هوية العنصر."},
        {"id": 4, "skill": "الروابط", "stem": "رابطة (Na⁺Cl⁻):", "options": ["تساهمية", "أيونية", "فلزية", "قطبيه"], "answer": 1, "explanation": "انتقال إلكترون."},
        {"id": 5, "skill": "الكهرباء", "stem": "لمس المقبض =", "options": ["الدائرة", "الجهد", "التفريغ", "التيار"], "answer": 2, "explanation": "انتقال شحنات."},
        {"id": 6, "skill": "الصوت", "stem": "أسرع الأوساط للصوت:", "options": ["هواء", "فولاذ", "ماء", "فراغ"], "answer": 1, "explanation": "الصلب أسرع."},
        {"id": 7, "skill": "الأمراض", "stem": "فيروس يهاجم الدم البيضاء:", "options": ["الإيدز", "الحصبة", "الأنفلونزا", "شلل"], "answer": 0, "explanation": "HIV."},
        {"id": 8, "skill": "التصنيف", "stem": "ليس لافقارياً:", "options": ["إسفنجيات", "رخويات", "حبليات", "مفصليات"], "answer": 2, "explanation": "فقاريات."},
        {"id": 9, "skill": "الإشعاع", "stem": "تحلل بيتا يزيد العدد الذري:", "options": ["١", "ينقص ١", "٢", "ينقص ٢"], "answer": 0, "explanation": "β⁻ يزيد ١."},
        {"id": 10, "skill": "دورة الماء", "stem": "الترتيب:", "options": ["هطول ← تبخر ← تكاثف", "تبخر ← تكاثف ← هطول", "تكاثف ← هطول ← تبخر", "هطول ← تكاثف ← تبخر"], "answer": 1, "explanation": "تبخر ← تكاثف ← هطول."}
    ],
    "اللغة العربية": [
        {"id": 1, "skill": "المفعول لأجله", "stem": "مفعول لأجله:", "options": ["احتراماً", "تنظيماً", "صلاتك", "صيفاً"], "answer": 0, "explanation": "مصدر قلبي."},
        {"id": 2, "skill": "الترجي", "stem": "ترجٍّ:", "options": ["لعلّ", "ليت", "نعم", "لا"], "answer": 0, "explanation": "لعل للترجي."},
        {"id": 3, "skill": "الأسماء الخمسة", "stem": "(يا بني صُن فاك): المنصوب:", "options": ["أبو", "فاك", "ذي", "فمك"], "answer": 1, "explanation": "بالألف."},
        {"id": 4, "skill": "الاستفهام", "stem": "ألستَ تحب؟ إثبات:", "options": ["نعم", "لا", "لا ولكني", "بلى"], "answer": 3, "explanation": "إبطال النفي."},
        {"id": 5, "skill": "الهمزة", "stem": "(م ش ي ء ة):", "options": ["مشيأة", "مشيئة", "مشاية", "مشأية"], "answer": 1, "explanation": "نبرة."},
        {"id": 6, "skill": "البدل", "stem": "(الإمامُ عليٌّ):", "options": ["بعض", "اشتمال", "مطابق", "مباين"], "answer": 2, "explanation": "علم بعد لقب."},
        {"id": 7, "skill": "الفهم", "stem": "مرادف (موحية):", "options": ["نافعة", "جاهزة", "باعثة", "ساعية"], "answer": 2, "explanation": "من السياق."},
        {"id": 8, "skill": "الفهم", "stem": "نص (الإيجابية) ينتمي إلى:", "options": ["تقني", "صحي", "نفسي اجتماعي", "اقتصادي"], "answer": 2, "explanation": "يعالج الصحة النفسية."},
        {"id": 9, "skill": "الفهم", "stem": "الفكرة الرئيسة للفقرة الثانية:", "options": ["التحديات", "التطور", "الجودة", "السرعة"], "answer": 0, "explanation": "تطرح السلبيات."},
        {"id": 10, "skill": "المبني للمجهول", "stem": "(كُتِبَ الدرسُ):", "options": ["كُتِبَ", "الدرسُ", "كتبَ", "الكاتب"], "answer": 0, "explanation": "ضم الأول."}
    ]
}

# =====================================================================
# 2) بناء ملف JSON للرفع (لبرنامجك الخاص)
# =====================================================================
def build_json():
    out_file = "questions_for_upload.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(QUESTIONS_DATA, f, ensure_ascii=False, indent=4)
    print(f"✅ تم إنشاء ملف الرفع: {out_file}")

# =====================================================================
# 3) بناء ملف Word (بتصميم المنصة)
# =====================================================================
def build_docx():
    import docx
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import parse_xml
    from docx.oxml.ns import nsdecls, qn
    import re

    FONT = "Tahoma"
    
    def _apply(run, size=12, bold=False, color="000000"):
        run.font.name = FONT
        run.font.size = Pt(size)
        run.font.bold = bold
        rPr = run._r.get_or_add_rPr()
        rPr.append(parse_xml(f'<w:rFonts {nsdecls("w")} w:ascii="{FONT}" w:hAnsi="{FONT}" w:cs="{FONT}"/>'))
        rPr.append(parse_xml(f'<w:rtl {nsdecls("w")}/>'))
        run.font.color.rgb = RGBColor(int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16))

    def _p_rtl(p, align=WD_ALIGN_PARAGRAPH.RIGHT):
        p.alignment = align
        pPr = p._p.get_or_add_pPr()
        if pPr.find(qn("w:bidi")) is None:
            pPr.append(parse_xml(f'<w:bidi {nsdecls("w")}/>'))

    # دالة الأسس المصححة (تضع الأس قبل النص الأساسي لضمان الترتيب الصحيح في RTL)
    def add_math_text(p, text, size=12, bold=False, color="000000"):
        # البحث عن نمط الأس (مثل ^٤ أو ^2)
        parts = re.split(r'(\^[٠-٩0-9]+)', text)
        for part in parts:
            if part.startswith('^'):
                # إضافة الأس
                run = p.add_run(part[1:])
                _apply(run, size=int(size*0.7), bold=bold, color=color)
                run.font.superscript = True
            else:
                run = p.add_run(part)
                _apply(run, size=size, bold=bold, color=color)

    doc = docx.Document()
    norm = doc.styles["Normal"]
    norm.font.name = FONT
    for s in doc.sections:
        s.top_margin = s.bottom_margin = Inches(0.8)
        s.left_margin = s.right_margin = Inches(0.8)
        s.page_width, s.page_height = Inches(8.27), Inches(11.69)

    # عنوان الصفحة
    p_title = doc.add_paragraph()
    _p_rtl(p_title, WD_ALIGN_PARAGRAPH.CENTER)
    _apply(p_title.add_run("بنك أسئلة نافس — مسودة الرفع"), size=16, bold=True, color="006C35")
    doc.add_paragraph()

    for subj, questions in QUESTIONS_DATA.items():
        # عنوان المادة
        p_sub = doc.add_paragraph()
        _p_rtl(p_sub)
        p_sub.paragraph_format.space_before = Pt(15)
        p_sub.paragraph_format.space_after = Pt(10)
        _apply(p_sub.add_run(f"مادة: {subj}"), size=14, bold=True, color="1B365D")

        for q in questions:
            # 1. المهارة (في صندوق رمادي فاتح يشبه المنصة)
            p_skill = doc.add_paragraph()
            _p_rtl(p_skill)
            p_skill.paragraph_format.space_before = Pt(10)
            p_skill.paragraph_format.space_after = Pt(2)
            # إضافة خلفية رمادية للفقرة
            pPr = p_skill._p.get_or_add_pPr()
            pPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="F1F5F9"/>'))
            _apply(p_skill.add_run(f"المهارة: {q['skill']}"), size=10, bold=True, color="475569")

            # 2. نص السؤال
            p_stem = doc.add_paragraph()
            _p_rtl(p_stem)
            p_stem.paragraph_format.space_before = Pt(4)
            p_stem.paragraph_format.space_after = Pt(8)
            _apply(p_stem.add_run(f"{q['id']}. "), size=12, bold=True, color="000000")
            add_math_text(p_stem, q['stem'], size=12)

            # 3. الخيارات (دائرة + نص)
            for idx, opt in enumerate(q['options']):
                p_opt = doc.add_paragraph()
                _p_rtl(p_opt)
                p_opt.paragraph_format.space_after = Pt(4)
                p_opt.paragraph_format.right_indent = Inches(0.3)
                # دائرة مفرغة
                _apply(p_opt.add_run("○ "), size=14, color="64748B")
                add_math_text(p_opt, opt, size=12)

            # 4. خط فاصل رمادي خفيف
            p_line = doc.add_paragraph()
            p_line.paragraph_format.space_after = Pt(15)
            pPr_line = p_line._p.get_or_add_pPr()
            pPr_line.append(parse_xml(
                f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="6" w:space="1" w:color="E2E8F0"/></w:pBdr>'
            ))

        doc.add_page_break()

    out_file = "مسودة_الرفع_تصميم_المنصة.docx"
    doc.save(out_file)
    print(f"✅ تم إنشاء مسودة الوورد: {out_file}")

# =====================================================================
# التشغيل
# =====================================================================
if __name__ == "__main__":
    ensure_deps()
    print("🚀 بدء بناء الملفات...")
    build_json()
    build_docx()
    print("\n🎉 اكتمل العمل! يمكنك رفع ملف JSON إلى برنامجك، ومراجعة ملف Word.")