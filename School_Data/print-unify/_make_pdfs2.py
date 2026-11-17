# -*- coding: utf-8 -*-
from pathlib import Path
import subprocess, time, shutil, re

out = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059\School_Data\print-unify")
css = (out / "_bundle.css").read_text(encoding="utf-8")
desk = Path(r"C:\Users\Toshiba\Desktop")
chrome = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"


def header():
    return (
        '<header class="doc-official-header">'
        '<div class="header-logo-right"><img src="http://127.0.0.1:8060/assets/ministry_logo.png" alt=""></div>'
        '<div class="header-center-titles"><div>المملكة العربية السعودية</div><div>وزارة التعليم</div>'
        '<div>الإدارة العامة للتعليم بمنطقة المدينة المنورة</div>'
        '<div class="school-name-title">متوسطة سعد بن الربيع الأنصاري</div></div>'
        '<div class="header-logo-left"><img src="http://127.0.0.1:8060/assets/vision_2030.png" alt=""></div>'
        '</header><div class="header-divider-bar"></div>'
    )


def signoff(page="1 من 1"):
    return (
        '<footer class="doc-signoff-block"><div class="signoff-title-bar">التوقيعات والاعتمادات</div>'
        '<div class="signoff-grid">'
        '<div class="signoff-col"><span class="role-title">وكيل الشؤون التعليمية</span>'
        '<div class="sig-placeholder"><img class="sig-image" src="http://127.0.0.1:8060/signatures/sig_teachers.png" alt=""></div>'
        '<span class="person-name">محمد بن فايز بن هلال الحربي</span></div>'
        '<div class="signoff-col"><span class="role-title">وكيل شؤون الطلاب</span>'
        '<div class="sig-placeholder"><img class="sig-image" src="http://127.0.0.1:8060/signatures/sig_students.png" alt=""></div>'
        '<span class="person-name">خالد بن علي الجابري</span></div>'
        '<div class="signoff-col"><span class="role-title">مدير المدرسة</span>'
        '<div class="sig-placeholder"><img class="sig-image" src="http://127.0.0.1:8060/signatures/sig_manager.png" alt=""></div>'
        '<span class="person-name">نائف ابن سمير ابن حجيف الحربي</span></div>'
        '</div><div class="doc-bottom-bar"><span>وثيقة رسمية — متوسطة سعد بن الربيع الأنصاري</span>'
        f'<span>الصفحة {page}</span></div></footer>'
    )


program = (
    f'<article class="official-document-frame tpl-portrait-official tpl-program-card">{header()}'
    '<div class="doc-official-body"><h1 class="doc-official-title">بطاقة برنامج مدرسي</h1>'
    '<div class="tpl-portrait-body"><div class="tpl-pair-grid">'
    '<div class="tpl-pair"><span class="tpl-pair-k">اسم البرنامج</span><span class="tpl-pair-v">رعاية الموهوبين</span></div>'
    '<div class="tpl-pair"><span class="tpl-pair-k">الحالة</span><span class="tpl-pair-v">معتمد</span></div></div>'
    '<section class="tpl-section"><h2 class="tpl-section-title">الشواهد</h2><div class="tpl-section-body">'
    '<div class="tpl-evidence-stack is-centered"><figure class="tpl-evidence-tile is-centered">'
    '<img src="http://127.0.0.1:8060/assets/ministry_logo.png" alt=""></figure></div></div></section>'
    f'</div></div>{signoff()}</article>'
)

witness = (
    f'<article class="official-document-frame tpl-portrait-official tpl-card-official">{header()}'
    '<div class="doc-official-body"><h1 class="doc-official-title">بطاقة توثيق شاهد</h1>'
    '<div class="tpl-portrait-body"><div class="tpl-pair-grid">'
    '<div class="tpl-pair"><span class="tpl-pair-k">المؤشر</span><span class="tpl-pair-v">2-1-1-3</span></div>'
    '<div class="tpl-pair"><span class="tpl-pair-k">الإجراء</span><span class="tpl-pair-v">مبادرة التميز</span></div></div>'
    '<section class="tpl-section"><h2 class="tpl-section-title">الشواهد</h2><div class="tpl-section-body">'
    '<div class="tpl-evidence-stack is-centered"><figure class="tpl-evidence-tile is-centered">'
    '<img src="http://127.0.0.1:8060/assets/ministry_logo.png" alt=""></figure></div></div></section>'
    f'</div></div>{signoff()}</article>'
)


def council_page(title, body, foot):
    return (
        f'<article class="official-document-frame council-official-page">{header()}'
        f'<div class="doc-official-body"><h1 class="doc-official-title">{title}</h1>{body}</div>{foot}</article>'
    )


council = (
    '<div class="council-official-book">'
    + council_page(
        "محضر اجتماع رسمي",
        '<p class="council-meta-line"><b>الجهة:</b> اللجنة الإدارية</p><p>اجتمعت اللجنة واعتمدت التوصيات.</p>',
        '<div class="doc-bottom-bar"><span>وثيقة رسمية</span><span>الصفحة 1 من 3</span></div>',
    )
    + council_page(
        "كشف الحضور",
        '<table class="tpl-data-table"><thead><tr><th>م</th><th>الاسم</th></tr></thead>'
        "<tbody><tr><td>1</td><td>نائف الحربي</td></tr></tbody></table>",
        '<div class="doc-bottom-bar"><span>وثيقة رسمية</span><span>الصفحة 2 من 3</span></div>',
    )
    + council_page(
        "توثيق بالصور",
        '<figure class="tpl-evidence-tile is-centered">'
        '<img src="http://127.0.0.1:8060/assets/ministry_logo.png" alt=""></figure>',
        signoff("3 من 3"),
    )
    + "</div>"
)

attendance = (
    f'<article class="official-document-frame tpl-landscape-official tpl-table-official">{header()}'
    '<div class="doc-official-body"><h1 class="doc-official-title">سجل دوام المنسوبين</h1>'
    '<div class="tpl-landscape-body"><table class="tpl-data-table"><thead><tr>'
    "<th>الاسم</th><th>الدور</th><th>الحالة</th></tr></thead><tbody>"
    "<tr><td>نائف الحربي</td><td>مدير</td><td>حاضر</td></tr>"
    "<tr><td>محمد الحربي</td><td>وكيل</td><td>حاضر</td></tr></tbody></table></div></div>"
    f"{signoff()}</article>"
)


def wrap(name, body, landscape=False, multi=False):
    classes = ["erp-shell", "print-mode", "print-official-core", "is-print-preview"]
    if landscape:
        classes.append("print-official-landscape")
    if multi:
        classes.extend(["print-official-multi", "print-council"])
    size = "A4 landscape" if landscape else "A4 portrait"
    named = "official-core-a4-landscape" if landscape else "official-core-a4"
    inject = f"@page{{size:{size} !important;margin:0 !important;}}@page {named}{{size:{size};margin:0;}}"
    host_id = "council-print-host" if multi else "official-frame-host"
    host_cls = "council-print-host" if multi else "official-frame-host"
    return (
        f"<!DOCTYPE html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\">"
        f"<base href=\"http://127.0.0.1:8060/\"><title>{name}</title>"
        f"<style>{css}\n{inject}</style></head>"
        f"<body class=\"{' '.join(classes)}\">"
        f"<div id=\"{host_id}\" class=\"{host_cls}\">{body}</div></body></html>"
    )


specs = [
    ("01-program", program, False, False),
    ("02-witness", witness, False, False),
    ("03-council", council, False, True),
    ("04-attendance", attendance, True, False),
]

for name, body, landscape, multi in specs:
    html_path = out / f"{name}.html"
    pdf_path = out / f"{name}.pdf"
    html_path.write_text(wrap(name, body, landscape, multi), encoding="utf-8")
    if pdf_path.exists():
        pdf_path.unlink()
    subprocess.run(
        [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--no-pdf-header-footer",
            f"--print-to-pdf={pdf_path}",
            html_path.as_uri(),
        ],
        check=False,
    )
    time.sleep(2.5)
    ok = pdf_path.exists()
    if ok:
        shutil.copy2(pdf_path, desk / f"unify-{name}.pdf")
        data = pdf_path.read_bytes()
        pages = len(re.findall(rb"/Type\s*/Page[^s]", data))
        print(name, "ok", pdf_path.stat().st_size, "pages", pages)
    else:
        print(name, "FAIL")
