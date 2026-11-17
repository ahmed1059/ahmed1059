# -*- coding: utf-8 -*-
"""
bootstrap_v7.py — يعمل تلقائياً في المجلد الحالي ويبني المشروع بالكامل.
"""
import os
import sys
import subprocess

# ضمان أننا في مجلد السكربت الحالي
os.chdir(os.path.dirname(os.path.abspath(__file__)))

def ensure_deps():
    missing = []
    for lib in ["python-docx", "matplotlib", "numpy"]:
        try:
            __import__(lib.split("-")[0])
        except ImportError:
            missing.append(lib)
    if missing:
        print(f"📦 تثبيت المكتبات المطلوبة: {' '.join(missing)}")
        subprocess.check_call([sys.executable, "-m", "pip", "install", *missing, "--quiet"])

# =====================================================================
# 1) محتوى math_diagrams.py (matplotlib)
# =====================================================================
MATH_DIAGRAMS_CODE = r'''# -*- coding: utf-8 -*-
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import os

plt.rcParams['font.family'] = 'Tahoma'
plt.rcParams['axes.unicode_minus'] = False

def _ensure_dir(path):
    d = os.path.dirname(path)
    if d and not os.path.exists(d):
        os.makedirs(d)

def generate_coordinate_plane(p1, p2, path):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(5, 5), dpi=150)
    ax.set_xlim(-1, 10); ax.set_ylim(-1, 10)
    ax.grid(True, linestyle='--', alpha=0.6)
    ax.axhline(0, color='black', linewidth=1.5)
    ax.axvline(0, color='black', linewidth=1.5)
    ax.plot([p1[0], p2[0]], [p1[1], p2[1]], 'ro--', markersize=8)
    ax.annotate(f'أ({p1[0]}،{p1[1]})', xy=p1, xytext=(p1[0]+0.3, p1[1]+0.3), color='red', fontsize=12)
    ax.annotate(f'ب({p2[0]}،{p2[1]})', xy=p2, xytext=(p2[0]-1.5, p2[1]+0.3), color='blue', fontsize=12)
    ax.set_xticks(range(0, 11)); ax.set_yticks(range(0, 11))
    plt.savefig(path, bbox_inches='tight'); plt.close()

def generate_right_triangle(side_a, side_b, hyp, angle_label, path):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(5, 3), dpi=150)
    A, B, C = np.array([0, 0]), np.array([0, side_a]), np.array([side_b, 0])
    ax.add_patch(plt.Polygon([A, B, C], fill=None, edgecolor='navy', linewidth=2))
    ax.plot([0, 0.5, 0.5, 0], [side_a-0.5, side_a-0.5, side_a, side_a], color='navy', linewidth=1)
    ax.text(0.2, side_a/2, str(side_a), color='navy', fontsize=12)
    ax.text(side_b/2, -0.2, str(side_b), color='navy', fontsize=12, ha='center')
    ax.text(side_b/2, side_a/2 + 0.5, str(hyp), color='navy', fontsize=12, ha='center', rotation=-np.degrees(np.arctan(side_a/side_b)))
    ax.text(1, 0.5, f"∠{angle_label}", color='red', fontsize=14)
    ax.set_xlim(-1, side_b + 1); ax.set_ylim(-1, side_a + 1); ax.axis('off')
    plt.savefig(path, bbox_inches='tight'); plt.close()

def generate_parabola(a, b, c, path):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(5, 5), dpi=150)
    x = np.linspace(-4, 4, 400); y = a*x**2 + b*x + c
    ax.plot(x, y, color='navy', linewidth=2)
    ax.grid(True, linestyle='--', alpha=0.6)
    ax.axhline(0, color='black', linewidth=1.5); ax.axvline(0, color='black', linewidth=1.5)
    if a != 0:
        vx = -b / (2*a); vy = a*vx**2 + b*vx + c
        ax.plot(vx, vy, 'ro', markersize=8)
        ax.annotate('الرأس', xy=(vx, vy), xytext=(vx+0.5, vy+0.5), color='red', fontsize=12)
    plt.savefig(path, bbox_inches='tight'); plt.close()

def generate_number_line(lo, hi, path, empty=False):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(6, 1.5), dpi=150)
    ax.axhline(0, color='black', linewidth=1.5)
    for v in range(lo, hi+1):
        ax.plot(v, 0, 'k|', markersize=10)
        ax.text(v, -0.5, str(v), ha='center', va='top', fontsize=10)
    if empty: ax.text((lo+hi)/2, 0.5, "∅", color='red', fontsize=24, ha='center', va='center')
    ax.set_xlim(lo-1, hi+1); ax.set_ylim(-1, 1); ax.axis('off')
    plt.savefig(path, bbox_inches='tight'); plt.close()

def generate_lewis_nacl(path):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(4, 2), dpi=150)
    ax.text(0.2, 0.5, "Na", fontsize=20, fontweight='bold', va='center', ha='center')
    ax.text(0.2, 0.8, "+", fontsize=14, color='red', va='center', ha='center')
    ax.annotate("", xy=(0.6, 0.5), xytext=(0.4, 0.5), arrowprops=dict(arrowstyle="->"))
    ax.text(0.8, 0.5, "Cl", fontsize=20, fontweight='bold', va='center', ha='center')
    ax.text(0.8, 0.8, "-", fontsize=14, color='red', va='center', ha='center')
    for angle in range(0, 360, 45):
        rad = np.radians(angle); x = 0.8 + 0.15 * np.cos(rad); y = 0.5 + 0.15 * np.sin(rad)
        ax.plot(x, y, 'ro', markersize=4)
    ax.axis('off'); plt.savefig(path, bbox_inches='tight'); plt.close()

def generate_static_discharge(path):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(6, 3), dpi=150)
    ax.text(0.2, 0.5, "مقبض الباب", fontsize=12, ha='center')
    ax.text(0.2, 0.2, "(+)", fontsize=14, color='red', ha='center')
    ax.text(0.8, 0.5, "قدم على سجاد", fontsize=12, ha='center')
    ax.text(0.8, 0.2, "(-)", fontsize=14, color='blue', ha='center')
    ax.annotate("", xy=(0.6, 0.5), xytext=(0.4, 0.5), arrowprops=dict(arrowstyle="->", color="yellow", linewidth=2))
    ax.text(0.5, 0.6, "تفريغ", fontsize=10, color='orange', ha='center')
    ax.axis('off'); plt.savefig(path, bbox_inches='tight'); plt.close()

def generate_water_cycle(path):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(6, 4), dpi=150)
    ax.set_xlim(0, 10); ax.set_ylim(0, 6)
    ax.add_patch(plt.Rectangle((0, 0), 10, 1.5, color='#0ea5e9'))
    ax.text(5, 0.75, "البحر", color='white', fontsize=14, ha='center', va='center')
    ax.plot(2, 5, 'yo', markersize=20); ax.text(2, 4.5, "الشمس", ha='center')
    ax.plot([6, 7], [4.5, 4.5], 'o', color='gray', markersize=30, alpha=0.5); ax.text(6.5, 4.8, "سحاب", ha='center')
    ax.annotate("تبخر", xy=(3, 4.5), xytext=(3, 1.8), arrowprops=dict(arrowstyle="->", color="red", linewidth=2), ha='center', color='red')
    ax.annotate("هطول", xy=(6.5, 1.8), xytext=(6.5, 4.2), arrowprops=dict(arrowstyle="->", color="blue", linewidth=2), ha='center', color='blue')
    ax.axis('off'); plt.savefig(path, bbox_inches='tight'); plt.close()
'''

# =====================================================================
# 2) محتوى sample_bank.py
# =====================================================================
SAMPLE_BANK_CODE = r'''# -*- coding: utf-8 -*-
MATH_QS_SAMPLE = [
    (1, "الأسس", "أوجد قيمة المقدار: ٣^٤", "(أ) ١٢   (ب) ١٦   (ج) ٣٢   (د) ٨١", "(د) ٨١", "٣^٤ = ٣ × ٣ × ٣ × ٣ = ٨١.", "الخطأ: ضرب ٣×٤=١٢.", "نموذج نافس", None),
    (2, "القيمة المطلقة", "حل المعادلة: |س − ٣| = −١", "(أ) {٢، ٤}   (ب) {١، ٣}   (ج) {−١، −٣}   (د) ∅", "(د) ∅", "القيمة المطلقة ≥ ٠ دائماً.", "الخطأ: تجاهل الإشارة.", "نموذج أ", None),
    (3, "معادلة المستقيم", "معادلة المستقيم المار بـ (٢، ٣) وميله ٤:", "(أ) ص = ٣س − ١   (ب) ص = ٣س + ١٠   (ج) ص = ٤س − ٥   (د) ص = ٤س − ١٠", "(ج) ص = ٤س − ٥", "ص − ٣ = ٤(س − ٢).", "الخطأ: عدم التوزيع.", "نموذج أ", None),
    (4, "المسافة", "المسافة بين (١، ٢) و(٩، ٨):", "(أ) ٦   (ب) ٨   (ج) ١٠   (د) ١٤", "(ج) ١٠", "جذر(٦٤ + ٣٦) = ١٠.", "الخطأ: جمع ٨+٦.", "176009", "coordinate_plane"),
    (5, "رأس القطع", "رأس د(س) = س^٢ + ٢س + ١:", "(أ) (٠، ١)   (ب) (−١، ٠)   (ج) (١، ٠)   (د) (١، ٤)", "(ب) (−١، ٠)", "س = −ب/٢أ.", "الخطأ: نسيان السالب.", "176009", "parabola"),
    (6, "المتتابعات", "الحد الثامن في (−٤، −١، ٢، ٥، ...):", "(أ) ١٤   (ب) ١٧   (ج) ٢٠   (د) ٢٣", "(ب) ١٧", "أ٨ = −٤ + ٧×٣.", "الخطأ: ٨×٣.", "176009", None),
    (7, "النسب المثلثية", "جا(أ) في مثلث ساقاه ١١ و٦٠ والوتر ٦١:", "(أ) ١١/٦١   (ب) ٦٠/٦١   (ج) ١١/٦٠   (د) ٦٠/١١", "(أ) ١١/٦١", "جا = المقابل/الوتر.", "الخطأ: جتا.", "نموذج ب", "right_triangle"),
    (8, "المتباينات", "حل: |ك − ٤| > −١٠", "(أ) ∅   (ب) −١٤ < ك < ٦   (ج) ٦ < ك < ١٤   (د) −٦ < ك < ١٤", "(أ) ∅", "القيمة المطلقة ≥ ٠.", "الخطأ: حل كأنها = ١٠.", "نموذج نافس", "number_line"),
    (9, "التباديل", "٨ طلاب يصطفون. بكم طريقة؟", "(أ) ٨   (ب) ٢٨   (ج) ٤٠٣٢٠   (د) ٦٤", "(ج) ٤٠٣٢٠", "٨! = ٤٠٣٢٠.", "الخطأ: ٨ أو ٢٨.", "نموذج نافس", None),
    (10, "وحيدات الحد", "(٢ص^٣)(٣ص^٢) =", "(أ) ٥ص^٥   (ب) ٦ص^٥   (ج) ٦ص^٦   (د) ٥ص^٦", "(ب) ٦ص^٥", "٢×٣=٦، ص^(٣+٢).", "الخطأ: ضرب الأسس.", "176009", None),
]
SCI_QS_SAMPLE = [
    (1, "الطريقة العلمية", "العامل الثابت:", "(أ) الفرضية   (ب) العامل الثابت   (ج) التابع   (د) المستقل", "(ب) العامل الثابت", "لا يتغير.", "الخطأ: التابع.", "نافس 3م", None),
    (2, "التنفسي", "تبادل الغازات:", "(أ) القصبة   (ب) الشعبتان   (ج) الحويصلات   (د) الشعيبات", "(ج) الحويصلات", "جدران رقيقة.", "الخطأ: القصبة.", "نافس علوم", None),
    (3, "الذرة", "العدد الذري =", "(أ) المستويات   (ب) النيوترونات   (ج) البروتونات   (د) النواة", "(ج) البروتونات", "هوية العنصر.", "الخطأ: الكتلي.", "نافس علوم", None),
    (4, "الروابط", "رابطة (Na⁺Cl⁻):", "(أ) تساهمية   (ب) أيونية   (ج) فلزية   (د) قطبيه", "(ب) أيونية", "انتقال إلكترون.", "الخطأ: التساهمية.", "نموذج أ", "lewis_nacl"),
    (5, "الكهرباء", "لمس المقبض =", "(أ) الدائرة   (ب) الجهد   (ج) التفريغ   (د) التيار", "(ج) التفريغ", "انتقال شحنات.", "الخطأ: التيار.", "نموذج أ", "static"),
    (6, "الصوت", "أسرع الأوساط للصوت:", "(أ) هواء   (ب) فولاذ   (ج) ماء   (د) فراغ", "(ب) فولاذ", "الصلب أسرع.", "الخطأ: هواء.", "نموذج أ", None),
    (7, "الأمراض", "فيروس يهاجم الدم البيضاء:", "(أ) الإيدز   (ب) الحصبة   (ج) الأنفلونزا   (د) شلل", "(أ) الإيدز", "HIV.", "الخطأ: تنفسي.", "نافس علوم", None),
    (8, "التصنيف", "ليس لافقارياً:", "(أ) إسفنجيات   (ب) رخويات   (ج) حبليات   (د) مفصليات", "(ج) حبليات", "فقاريات.", "الخطأ: مفصليات.", "نافس علوم", None),
    (9, "الإشعاع", "تحلل بيتا يزيد العدد الذري:", "(أ) ١   (ب) ينقص ١   (ج) ٢   (د) ينقص ٢", "(أ) ١", "β⁻ يزيد ١.", "الخطأ: ينقص.", "نافس علوم", None),
    (10, "دورة الماء", "الترتيب:", "(أ) هطول ← تبخر ← تكاثف   (ب) تبخر ← تكاثف ← هطول   (ج) تكاثف ← هطول ← تبخر   (د) هطول ← تكاثف ← تبخر", "(ب) تبخر ← تكاثف ← هطول", "تبخر ← تكاثف ← هطول.", "الخطأ: عكس.", "نصوص", "water_cycle"),
]
AR_QS_SAMPLE = [
    (1, "المفعول لأجله", "مفعول لأجله:", "(أ) احتراماً   (ب) تنظيماً   (ج) صلاتك   (د) صيفاً", "(أ) احتراماً", "مصدر قلبي.", "الخطأ: المطلق.", "نافس لغتي", None),
    (2, "الترجي", "ترجٍّ:", "(أ) لعلّ   (ب) ليت   (ج) نعم   (د) لا", "(أ) لعلّ", "لعل للترجي.", "الخطأ: ليت.", "نافس لغتي", None),
    (3, "الأسماء الخمسة", "(يا بني صُن فاك): المنصوب:", "(أ) أبو   (ب) فاك   (ج) ذي   (د) فمك", "(ب) فاك", "بالألف.", "الخطأ: فمك.", "نافس لغتي", None),
    (4, "الاستفهام", "ألستَ تحب؟ إثبات:", "(أ) نعم   (ب) لا   (ج) لا ولكني   (د) بلى", "(د) بلى", "إبطال النفي.", "الخطأ: نعم.", "نافس لغتي", None),
    (5, "الهمزة", "(م ش ي ء ة):", "(أ) مشيأة   (ب) مشيئة   (ج) مشاية   (د) مشأية", "(ب) مشيئة", "نبرة.", "الخطأ: ألف.", "نافس لغتي", None),
    (6, "البدل", "(الإمامُ عليٌّ):", "(أ) بعض   (ب) اشتمال   (ج) مطابق   (د) مباين", "(ج) مطابق", "علم بعد لقب.", "الخطأ: اشتمال.", "نافس لغتي", None),
    (7, "الفهم", "مرادف (موحية):", "(أ) نافعة   (ب) جاهزة   (ج) باعثة   (د) ساعية", "(ج) باعثة", "من السياق.", "الخطأ: نافعة.", "نموذج أ", None),
    (8, "الفهم", "نص (الإيجابية) ينتمي إلى:", "(أ) تقني   (ب) صحي   (ج) نفسي اجتماعي   (د) اقتصادي", "(ج) نفسي اجتماعي", "يعالج الصحة النفسية.", "الخطأ: صحي.", "نموذج أ", None),
    (9, "الفهم", "الفكرة الرئيسة للفقرة الثانية:", "(أ) التحديات   (ب) التطور   (ج) الجودة   (د) السرعة", "(أ) التحديات", "تطرح السلبيات.", "الخطأ: التطور.", "نموذج ب", None),
    (10, "المبني للمجهول", "(كُتِبَ الدرسُ):", "(أ) كُتِبَ   (ب) الدرسُ   (ج) كتبَ   (د) الكاتب", "(أ) كُتِبَ", "ضم الأول.", "الخطأ: كتبَ.", "نافس لغتي", None),
]
SAMPLE_BANK = {"الرياضيات": MATH_QS_SAMPLE, "العلوم": SCI_QS_SAMPLE, "اللغة العربية": AR_QS_SAMPLE}
'''

# =====================================================================
# 3) محتوى answer_keys.py
# =====================================================================
ANSWER_KEYS_CODE = r'''# -*- coding: utf-8 -*-
import re
from sample_bank import SAMPLE_BANK
def extract_letter(ans):
    m = re.search(r"\(([أبجد])\)", ans)
    return m.group(1) if m else "?"
def build_keys():
    return {subj: [{"id": q[0], "skill": q[1], "answer_letter": extract_letter(q[4]), "answer_full": q[4], "explanation": q[5]} for q in qs] for subj, qs in SAMPLE_BANK.items()}
'''

# =====================================================================
# 4) محتوى generate_sample_docx.py
# =====================================================================
GENERATE_DOCX_CODE = r'''# -*- coding: utf-8 -*-
import os
import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls, qn
from sample_bank import SAMPLE_BANK
from math_diagrams import (
    generate_coordinate_plane, generate_right_triangle, generate_parabola,
    generate_number_line, generate_lewis_nacl, generate_static_discharge, generate_water_cycle,
)

FONT = "Tahoma"
C_GREEN, C_NAVY, C_TEAL, C_BURGUNDY = "006C35", "1B365D", "0F766E", "7C2D12"
C_BG, C_BORDER = "F8FAFC", "CBD5E1"

def _apply(run, size=11, bold=False, color=None):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    rPr = run._r.get_or_add_rPr()
    rPr.append(parse_xml(f'<w:rFonts {nsdecls("w")} w:ascii="{FONT}" w:hAnsi="{FONT}" w:cs="{FONT}"/>'))
    rPr.append(parse_xml(f'<w:rtl {nsdecls("w")}/>'))
    if color:
        run.font.color.rgb = RGBColor(int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16))

def _p_rtl(p, align=WD_ALIGN_PARAGRAPH.RIGHT):
    p.alignment = align
    pPr = p._p.get_or_add_pPr()
    if pPr.find(qn("w:bidi")) is None:
        pPr.append(parse_xml(f'<w:bidi {nsdecls("w")}/>'))

def _shd(cell, color):
    cell._tc.get_or_add_tcPr().append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color}"/>'))

def _mar(cell, t=60, b=60, l=80, r=80):
    cell._tc.get_or_add_tcPr().append(parse_xml(
        f'<w:tcMar {nsdecls("w")}><w:top w:w="{t}" w:type="dxa"/><w:bottom w:w="{b}" w:type="dxa"/>'
        f'<w:left w:w="{l}" w:type="dxa"/><w:right w:w="{r}" w:type="dxa"/></w:tcMar>'))

def _brd(cell, color=C_BORDER, sz="4"):
    cell._tc.get_or_add_tcPr().append(parse_xml(
        f'<w:tcBorders {nsdecls("w")}><w:top w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:left w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:right w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/></w:tcBorders>'))

def _tbl_rtl(t):
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t._tbl.tblPr.append(parse_xml(f'<w:bidiVisual {nsdecls("w")}/>'))

def add_math_text(p, text, size=11, color=None, bold=False):
    parts = re.split(r'(\^[٠-٩0-9]+)', text)
    for part in parts:
        if part.startswith('^'):
            run = p.add_run(part[1:])
            _apply(run, size=size-2, bold=bold, color=color)
            run.font.superscript = True
        else:
            run = p.add_run(part)
            _apply(run, size=size, bold=bold, color=color)

def add_title(doc, text, color=C_GREEN, size=16):
    p = doc.add_paragraph()
    _p_rtl(p, WD_ALIGN_PARAGRAPH.CENTER)
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(8)
    _apply(p.add_run(text), size=size, bold=True, color=color)

def build_cover(doc):
    doc.add_paragraph().paragraph_format.space_after = Pt(20)
    tbl = doc.add_table(rows=1, cols=3)
    _tbl_rtl(tbl)
    cells = tbl.rows[0].cells
    for c in cells:
        c.width = Inches(2.2)
        c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        _brd(c, "FFFFFF", "2") 
    p1 = cells[0].paragraphs[0]; _p_rtl(p1, WD_ALIGN_PARAGRAPH.CENTER)
    _apply(p1.add_run("المملكة العربية السعودية\nوزارة التعليم\nإدارة التعليم بالمدينة المنورة"), size=9, bold=True, color=C_NAVY)
    p2 = cells[1].paragraphs[0]; _p_rtl(p2, WD_ALIGN_PARAGRAPH.CENTER)
    _apply(p2.add_run("[شعار وزارة التعليم]\nالرقم الإحصائي: 40341"), size=9, bold=True, color=C_NAVY)
    p3 = cells[2].paragraphs[0]; _p_rtl(p3, WD_ALIGN_PARAGRAPH.CENTER)
    _apply(p3.add_run("[شعار نافس]\nموسوعة الاختبارات الوطنية"), size=9, bold=True, color=C_NAVY)
    p_title = doc.add_paragraph(); _p_rtl(p_title, WD_ALIGN_PARAGRAPH.CENTER)
    p_title.paragraph_format.space_before = Pt(40)
    _apply(p_title.add_run("مَوْسُوعَةُ نَافِس وَالمَهَارَاتِ الأَسَاسِيَّةِ\nلِلمَرْحَلَةِ المُتَوَسِّطَةِ"), size=20, bold=True, color=C_GREEN)
    p_sub = doc.add_paragraph(); _p_rtl(p_sub, WD_ALIGN_PARAGRAPH.CENTER)
    _apply(p_sub.add_run("الدليل الشامل وبنك الأسئلة المعيارية ونماذج المحاكاة"), size=14, bold=True, color=C_NAVY)
    p_school = doc.add_paragraph(); _p_rtl(p_school, WD_ALIGN_PARAGRAPH.CENTER)
    p_school.paragraph_format.space_before = Pt(20)
    _apply(p_school.add_run("متوسطة سعد بن الربيع الأنصاري\nإعداد: أ. أحمد بن علي الشهري"), size=12, bold=True, color=C_NAVY)
    doc.add_page_break()

def add_question(doc, q, diagram_path=None):
    num, domain, stem, opts, ans, expl, trap, src, _ = q
    p = doc.add_paragraph(); _p_rtl(p)
    p.paragraph_format.space_before = Pt(10); p.paragraph_format.space_after = Pt(2)
    _apply(p.add_run(f"س{num}. "), size=12, bold=True, color=C_NAVY)
    _apply(p.add_run(f"[{domain}] "), size=11, bold=True, color=C_GREEN)
    add_math_text(p, stem, size=12, color="000000")
    p2 = doc.add_paragraph(); _p_rtl(p2)
    p2.paragraph_format.space_after = Pt(6)
    add_math_text(p2, opts, size=11, color=C_NAVY)
    if diagram_path and os.path.exists(diagram_path):
        pi = doc.add_paragraph(); _p_rtl(pi, WD_ALIGN_PARAGRAPH.CENTER)
        pi.add_run().add_picture(diagram_path, width=Inches(3.5))

def build():
    print("🎨 توليد الرسومات...")
    diagrams = {
        "coordinate_plane": generate_coordinate_plane((1, 2), (9, 8), "sample_assets/coord.png"),
        "right_triangle": generate_right_triangle(11, 60, 61, "أ", "sample_assets/tri.png"),
        "parabola": generate_parabola(1, 2, 1, "sample_assets/parabola.png"),
        "number_line": generate_number_line(-14, 14, "sample_assets/nl.png", empty=True),
        "lewis_nacl": generate_lewis_nacl("sample_assets/lewis.png"),
        "static": generate_static_discharge("sample_assets/static.png"),
        "water_cycle": generate_water_cycle("sample_assets/wc.png"),
    }
    print("📄 بناء المستند...")
    doc = docx.Document()
    norm = doc.styles["Normal"]
    norm.font.name = FONT; norm.font.size = Pt(11)
    rPr = norm.element.get_or_add_rPr()
    rPr.append(parse_xml(f'<w:rFonts {nsdecls("w")} w:ascii="{FONT}" w:hAnsi="{FONT}" w:cs="{FONT}"/>'))
    rPr.append(parse_xml(f'<w:rtl {nsdecls("w")}/>'))
    for s in doc.sections:
        s.top_margin = s.bottom_margin = Inches(0.6)
        s.left_margin = s.right_margin = Inches(0.6)
        s.page_width, s.page_height = Inches(8.27), Inches(11.69)
    build_cover(doc)
    for subj, color, label in [("الرياضيات", C_GREEN, "🎯 القسم الأول: الرياضيات"), ("العلوم", C_TEAL, "🔬 القسم الثاني: العلوم"), ("اللغة العربية", C_BURGUNDY, "📖 القسم الثالث: لغتي")]:
        add_title(doc, label, color, 15)
        for q in SAMPLE_BANK[subj]:
            add_question(doc, q, diagrams.get(q[8]) if q[8] else None)
        doc.add_page_break()
    out = "النموذج_التجريبي_نافس_v7.docx"
    doc.save(out)
    print(f"\n✅ تم حفظ الملف النهائي: {out}")

if __name__ == "__main__":
    build()
'''

def main():
    print("=" * 60)
    print("  Bootstrap v7: بناء المشروع في المجلد الحالي")
    print("=" * 60)
    ensure_deps()
    files = {
        "math_diagrams.py": MATH_DIAGRAMS_CODE,
        "sample_bank.py": SAMPLE_BANK_CODE,
        "answer_keys.py": ANSWER_KEYS_CODE,
        "generate_sample_docx.py": GENERATE_DOCX_CODE,
    }
    for name, code in files.items():
        with open(name, "w", encoding="utf-8") as f:
            f.write(code)
        print(f"✓ تم كتابة {name}")
    print("\n🚀 تشغيل المولد...")
    import generate_sample_docx
    generate_sample_docx.build()

if __name__ == "__main__":
    main()