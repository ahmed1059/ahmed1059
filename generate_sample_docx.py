# -*- coding: utf-8 -*-
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
