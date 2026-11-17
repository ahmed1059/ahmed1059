# -*- coding: utf-8 -*-
"""خ-مك / خ-مك-2: بناء مكوّنات TPL-01…09 + بيانات مشتركة + معاينات (قرارات 138–139)."""
from __future__ import annotations

import csv
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ARCHIVE = ROOT.parent  # School_Data/archive_analysis
SHARED = ROOT / "_shared"
PROJECT = ARCHIVE.parent.parent  # School_Governance_System_1059
PC = PROJECT / "Print_Canvas"
PC_COMP = PC / "components"

INDICATORS_ALL = [
    "1-2-1-1",
    "1-3-1-1",
    "1-3-1-2",
    "1-3-1-3",
    "1-4-1-1",
    "1-4-1-2",
    "2-1-1-2",
    "2-1-1-5",
    "2-2-1-1",
    "2-2-1-2",
    "2-2-1-3",
    "2-2-1-4",
    "3-2-1-4",
]

SPECS = [
    {
        "id": "TPL-01",
        "folder": "tpl01",
        "title": "تقرير برنامج / مسابقة / مبادرة",
        "title_map": {
            "برنامج": "تقرير برنامج",
            "مسابقة": "تقرير مسابقة",
            "مبادرة": "تقرير مبادرة",
        },
        "defaults": ["1-4-1-2", "2-2-1-1", "2-2-1-2", "2-2-1-3", "2-2-1-4"],
        "approved": "optional",
        "programs": True,
        "columns": [
            ("إعداد (prepared_by)", "sig_teachers.png"),
            ("اعتماد أول (وكيل التعليمية)", "sig_students.png"),
            ("اعتماد المدير (اختياري)", "sig_manager.png"),
        ],
        "kind": "report",
    },
    {
        "id": "TPL-02",
        "folder": "tpl02",
        "title": "خطة تربوية / تشغيلية",
        "title_map": {
            "علاجية": "خطة علاجية",
            "إثرائية": "خطة إثرائية",
            "تشغيلية": "خطة تشغيلية",
            "اجتماعات": "خطة اجتماعات",
        },
        "defaults": ["1-4-1-1", "2-1-1-2", "1-4-1-2", "2-1-1-5", "1-3-1-2", "3-2-1-4"],
        "approved": "required",
        "columns": [
            ("إعداد (وكيل/رئيس لجنة)", "sig_teachers.png"),
            ("مراجعة", "sig_students.png"),
            ("اعتماد المدير (مطلوب)", "sig_manager.png"),
        ],
        "kind": "plan",
    },
    {
        "id": "TPL-03",
        "folder": "tpl03",
        "title": "محضر لجنة / اجتماع",
        "defaults": ["1-2-1-1", "1-4-1-2", "2-1-1-2"],
        "approved": "required",
        "rapporteur_vacant": True,
        "committees": True,
        "columns": [
            ("المقرّر / المعدّ", "sig_teachers.png"),
            ("رئيس اللجنة / وكيل", "sig_students.png"),
            ("اعتماد المدير", "sig_manager.png"),
        ],
        "kind": "minutes",
    },
    {
        "id": "TPL-04",
        "folder": "tpl04",
        "title": "قرار تشكيل لجنة / فريق",
        "defaults": ["1-2-1-1"],
        "approved": "required",
        "rapporteur_vacant": True,
        "committees": True,
        "columns": [
            ("إعداد (وكيل مدرسي)", "sig_teachers.png"),
            ("مراجعة", "sig_students.png"),
            ("اعتماد المدير (مطلوب)", "sig_manager.png"),
        ],
        "kind": "decision",
    },
    {
        "id": "TPL-05",
        "folder": "tpl05",
        "title": "سجل متابعة تشغيلي",
        "title_map": {
            "غياب": "سجل متابعة الغياب",
            "مقصف": "سجل متابعة المقصف",
            "مخالفات": "سجل المخالفات",
            "تدريب": "سجل التدريب",
            "قيم": "سجل القيم والسلوك",
            "أخرى": "سجل متابعة تشغيلي",
        },
        "defaults": ["1-4-1-1", "1-4-1-2", "2-1-1-2", "2-1-1-5", "1-3-1-1"],
        "approved": "optional",
        "columns": [
            ("صاحب الدور (معدّ)", "sig_teachers.png"),
            ("متابعة", "sig_students.png"),
            ("اعتماد اختياري", "sig_manager.png"),
        ],
        "kind": "register",
    },
    {
        "id": "TPL-06",
        "folder": "tpl06",
        "title": "كشف / قائمة تشغيلية",
        "title_map": {
            "غياب": "كشف الغياب",
            "تسليم": "كشف التسليم",
            "تشكيل": "كشف التشكيل",
            "أخرى": "كشف تشغيلي",
        },
        "defaults": ["1-3-1-2", "2-1-1-5"],
        "approved": "optional",
        "columns": [
            ("إعداد", "sig_teachers.png"),
            ("وكيل طلاب / لجنة", "sig_students.png"),
            ("اعتماد اختياري", "sig_manager.png"),
        ],
        "kind": "roster",
    },
    {
        "id": "TPL-07",
        "folder": "tpl07",
        "title": "استمارة تقويم / قياس أثر",
        "defaults": ["1-4-1-2", "2-2-1-4"],
        "approved": "optional",
        "columns": [
            ("معدّ الاستمارة", "sig_teachers.png"),
            ("مراجعة وكيل (عند الحاجة)", "sig_students.png"),
            ("اعتماد اختياري", "sig_manager.png"),
        ],
        "kind": "form",
    },
    {
        "id": "TPL-08a",
        "folder": "tpl08a",
        "title": "توثيق عمل تطوعي",
        "defaults": ["1-3-1-3", "1-3-1-2", "3-2-1-4"],
        "approved": "activity_leader",
        "expert": True,
        "columns": [
            ("منسق التطوع (معدّ)", "sig_teachers.png"),
            ("رائد النشاط (معتمد)", "sig_students.png"),
            ("مدير عند اللزوم", "sig_manager.png"),
        ],
        "kind": "volunteer",
    },
    {
        "id": "TPL-08b",
        "folder": "tpl08b",
        "title": "توثيق شراكة مجتمعية",
        "defaults": ["1-3-1-3", "1-3-1-2", "3-2-1-4"],
        "approved": "manager",
        "expert": True,
        "columns": [
            ("منسق الشراكة (معدّ)", "sig_teachers.png"),
            ("مراجعة", "sig_students.png"),
            ("اعتماد المدير", "sig_manager.png"),
        ],
        "kind": "partnership",
    },
]

STUBS_09 = [
    ("TPL-09a", "tpl09a", "نماذج فريدة — توثيق بلا توحيد"),
    ("TPL-09b", "tpl09b", "تعريفات أدوار — مرجع"),
    ("TPL-09c", "tpl09c", "تقارير فريدة — توثيق"),
    ("TPL-09d", "tpl09d", "أغلفة/فهرس/فواصل — عرض"),
    ("TPL-09e", "tpl09e", "خطابات/إشعارات — توثيق"),
    ("TPL-09f", "tpl09f", "بطاقات — توثيق"),
]


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def copy_shared_data() -> None:
    SHARED.mkdir(parents=True, exist_ok=True)
    src01 = ROOT / "tpl01"
    for name in ("identity.json", "indicators.json", "programs.json"):
        shutil.copy2(src01 / name, SHARED / name)

    committees = []
    csv_path = ARCHIVE / "05_committee_structure.csv"
    with csv_path.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            committees.append(
                {
                    "body_id": row.get("body_id") or row.get("\ufeffbody_id"),
                    "body_name": row.get("body_name"),
                    "kind": row.get("kind"),
                    "has_rapporteur_role": row.get("has_rapporteur_role"),
                    "has_rapporteur_named": row.get("has_rapporteur_named"),
                    "rapporteur_vacant": row.get("has_rapporteur_named") == "no"
                    and row.get("has_rapporteur_role") == "yes",
                    "named_members_count": int(row.get("named_members_count") or 0),
                }
            )
    write_json(
        SHARED / "committees.json",
        {
            "meta": {
                "source": "05_committee_structure.csv",
                "count": len(committees),
                "note": "أسماء هيئات محفوظة فقط — بلا اختراع أعضاء",
            },
            "committees": committees,
        },
    )


def body_js_builder(spec: dict) -> str:
    kind = spec["kind"]
    tid = spec["id"]
    defaults = json.dumps(spec["defaults"], ensure_ascii=False)
    title = spec["title"]
    title_map = spec.get("title_map") or {}
    use_committees = bool(spec.get("committees"))
    expert = bool(spec.get("expert"))

    if kind == "report":
        body = f"""
  function buildBodyHtml() {{
    var C = window.TplCommon;
    var kinds = {json.dumps(list(title_map.keys()), ensure_ascii=False)};
    var opts = kinds.map(function (k) {{
      return '<option value="' + k + '">' + k + '</option>';
    }}).join('');
    return '<div class="tpl-field-grid">'
      + '<div class="tpl-field full"><label for="tpl-program">اختيار البرنامج / المسابقة / المبادرة</label>'
      + '<select id="tpl-program" class="tpl-input" data-tpl-programs></select></div>'
      + '<div class="tpl-field"><label for="tpl-kind">نوع المحتوى (للعنوان الذكي)</label><select id="tpl-kind" class="tpl-input">' + opts + '</select></div>'
      + C.fieldText('tpl-program-name', 'الاسم المعروض')
      + C.dualDateHtml('الفترة — هجري أولاً ثم ميلادي')
      + C.fieldText('tpl-audience', 'الفئة المستهدفة')
      + C.fieldSelect('tpl-indicators', 'المؤشرات (من الـ13 المعتمدة)', 'data-tpl-indicators multiple size="5"')
      + C.fieldSelect('tpl-prepared', 'المُعِدّ (prepared_by)', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'المعتمد (approved_by) — اختياري', 'data-tpl-persons')
      + '</div>'
      + '<h2 class="tpl-section-title">الأنشطة المنفذة</h2>'
      + '<table class="tpl-act-table"><thead><tr><th>#</th><th>النشاط</th><th colspan="2">التاريخ (هـ / م)</th><th>ملاحظة</th></tr></thead><tbody>'
      + [1,2,3].map(function (n) {{
          return '<tr><td>' + n + '</td><td><input class="tpl-input" type="text"></td>'
            + '<td colspan="2"><div class="dual-date-pair tpl-dual-date">'
            + '<input class="doc-hijri tpl-input" type="text" placeholder="هـ" aria-label="هجري">'
            + '<input class="doc-date-picker tpl-input" type="text" placeholder="م" aria-label="ميلادي">'
            + '</div></td><td><input class="tpl-input" type="text"></td></tr>';
        }}).join('')
      + '</tbody></table>'
      + '<h2 class="tpl-section-title">الشواهد المرفقة</h2>'
      + '<p class="tpl-empty">(قائمة فارغة — تُملأ من النظام دون اختراع)</p>';
  }}
  function wireTitle(host) {{
    var map = {json.dumps(title_map, ensure_ascii=False)};
    var kindSel = host.querySelector('#tpl-kind');
    var programSel = host.querySelector('#tpl-program');
    var audience = host.querySelector('#tpl-audience');
    var nameField = host.querySelector('#tpl-program-name');
    function applyKind() {{
      window.TplCommon.setDynamicTitle(map[kindSel.value] || {json.dumps(title, ensure_ascii=False)}, host);
    }}
    function applyProgram() {{
      var opt = programSel && programSel.options[programSel.selectedIndex];
      if (!opt || !opt.value) return;
      if (kindSel && opt.dataset.kind && !kindSel.dataset.userTouched) {{
        kindSel.value = opt.dataset.kind;
      }}
      if (nameField && opt.dataset.name) nameField.value = opt.dataset.name;
      if (audience && opt.dataset.audience && !audience.value) audience.value = opt.dataset.audience;
      applyKind();
    }}
    if (kindSel) {{
      kindSel.addEventListener('change', function () {{
        kindSel.dataset.userTouched = '1';
        applyKind();
      }});
      applyKind();
    }}
    if (programSel) programSel.addEventListener('change', applyProgram);
  }}
"""
    elif kind == "plan":
        body = f"""
  function buildBodyHtml() {{
    var C = window.TplCommon;
    var kinds = {json.dumps(list(title_map.keys()), ensure_ascii=False)};
    var opts = kinds.map(function (k) {{
      return '<option value="' + k + '">' + k + '</option>';
    }}).join('');
    return '<div class="tpl-field-grid">'
      + '<div class="tpl-field"><label for="tpl-kind">نوع الخطة</label><select id="tpl-kind" class="tpl-input">' + opts + '</select></div>'
      + C.fieldText('tpl-title', 'عنوان الخطة')
      + C.dualDateHtml('فترة الخطة — هجري أولاً ثم ميلادي')
      + C.fieldText('tpl-audience', 'المستهدفون', true)
      + C.fieldSelect('tpl-indicators', 'مؤشرات المتابعة (من الـ13)', 'data-tpl-indicators multiple size="5"')
      + C.fieldSelect('tpl-prepared', 'المُعِدّ (prepared_by)', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'المعتمد (مدير — مطلوب)', 'data-tpl-persons')
      + '</div>'
      + '<h2 class="tpl-section-title">الأهداف والإجراءات</h2>'
      + '<table class="tpl-act-table"><thead><tr><th>#</th><th>الهدف</th><th>الإجراء</th><th>متابعة</th></tr></thead><tbody>'
      + [1,2,3].map(function (n) {{
          return '<tr><td>' + n + '</td><td><input class="tpl-input" type="text"></td><td><input class="tpl-input" type="text"></td><td><input class="tpl-input" type="text"></td></tr>';
        }}).join('')
      + '</tbody></table>';
  }}
  function wireTitle(host) {{
    var map = {json.dumps(title_map, ensure_ascii=False)};
    var sel = host.querySelector('#tpl-kind');
    function apply() {{
      window.TplCommon.setDynamicTitle(map[sel.value] || {json.dumps(title, ensure_ascii=False)}, host);
    }}
    if (sel) {{ sel.addEventListener('change', apply); apply(); }}
  }}
"""
    elif kind == "minutes":
        body = f"""
  function buildBodyHtml() {{
    var C = window.TplCommon;
    return '<div class="tpl-field-grid">'
      + C.fieldSelect('tpl-committee', 'اللجنة / الاجتماع', 'data-tpl-committees')
      + C.fieldText('tpl-serial', 'رقم المحضر')
      + C.dualDateHtml('تاريخ المحضر — هجري أولاً ثم ميلادي')
      + C.fieldSelect('tpl-rapporteur', 'المقرّر (أو شاغر)', 'data-tpl-persons')
      + '<div class="tpl-field full"><label><input type="checkbox" id="tpl-rapporteur-vacant"> مقرّر شاغر (rapporteur_vacant) — يُعيَّن لاحقاً بقرار المدير</label></div>'
      + C.fieldSelect('tpl-indicators', 'المؤشرات', 'data-tpl-indicators multiple size="4"')
      + C.fieldSelect('tpl-prepared', 'المُعِدّ (غالباً المقرّر)', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'المعتمد (مطلوب)', 'data-tpl-persons')
      + C.fieldTextarea('tpl-items', 'البنود والتوصيات')
      + '</div>'
      + '<h2 class="tpl-section-title">الحاضرون</h2>'
      + '<table class="tpl-act-table"><thead><tr><th>#</th><th>الاسم (من الهوية فقط)</th><th>الصفة</th></tr></thead><tbody>'
      + [1,2,3,4,5].map(function (n) {{
          return '<tr><td>' + n + '</td><td><select class="tpl-input" data-tpl-persons></select></td><td><input class="tpl-input" type="text"></td></tr>';
        }}).join('')
      + '</tbody></table>';
  }}
  function wireTitle(host) {{
    var sel = host.querySelector('#tpl-committee');
    function apply() {{
      var opt = sel && sel.options[sel.selectedIndex];
      var name = opt && opt.value ? opt.textContent.replace(/\\s*·.*/, '').replace(/\\s*\\[.*?\\]/, '') : '';
      window.TplCommon.setDynamicTitle(name ? ('محضر: ' + name) : {json.dumps(title, ensure_ascii=False)}, host);
      var vacant = opt && /مقرّر شاغر/.test(opt.textContent);
      var box = host.querySelector('#tpl-rapporteur-vacant');
      if (box && vacant) {{ box.checked = true; }}
    }}
    if (sel) {{ sel.addEventListener('change', apply); }}
  }}
"""
    elif kind == "decision":
        body = f"""
  function buildBodyHtml() {{
    var C = window.TplCommon;
    return '<div class="tpl-field-grid">'
      + C.fieldSelect('tpl-committee', 'اللجنة / الفريق', 'data-tpl-committees')
      + C.fieldText('tpl-basis', 'الأساس النظامي', true)
      + C.dualDateHtml('تاريخ القرار — هجري أولاً ثم ميلادي')
      + '<div class="tpl-field full"><label><input type="checkbox" id="tpl-rapporteur-vacant"> مقرّر شاغر حتى التعيين</label></div>'
      + C.fieldSelect('tpl-indicators', 'المؤشرات', 'data-tpl-indicators multiple size="3"')
      + C.fieldSelect('tpl-prepared', 'المُعِدّ', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'المعتمد (مدير — مطلوب)', 'data-tpl-persons')
      + '</div>'
      + '<h2 class="tpl-section-title">الأعضاء والأدوار</h2>'
      + '<table class="tpl-act-table"><thead><tr><th>#</th><th>الاسم</th><th>الدور</th></tr></thead><tbody>'
      + [1,2,3,4,5].map(function (n) {{
          return '<tr><td>' + n + '</td><td><select class="tpl-input" data-tpl-persons></select></td>'
            + '<td><select class="tpl-input"><option>رئيس</option><option>نائب</option><option>مقرّر</option><option selected>عضو</option></select></td></tr>';
        }}).join('')
      + '</tbody></table>';
  }}
  function wireTitle(host) {{
    var sel = host.querySelector('#tpl-committee');
    function apply() {{
      var opt = sel && sel.options[sel.selectedIndex];
      var name = opt && opt.value ? opt.textContent.replace(/\\s*·.*/, '').replace(/\\s*\\[.*?\\]/, '') : '';
      window.TplCommon.setDynamicTitle(name ? ('قرار تشكيل: ' + name) : {json.dumps(title, ensure_ascii=False)}, host);
    }}
    if (sel) {{ sel.addEventListener('change', apply); }}
  }}
"""
    elif kind == "register":
        body = f"""
  function buildBodyHtml() {{
    var C = window.TplCommon;
    var kinds = {json.dumps(list(title_map.keys()), ensure_ascii=False)};
    var opts = kinds.map(function (k) {{ return '<option value="' + k + '">' + k + '</option>'; }}).join('');
    return '<div class="tpl-field-grid">'
      + '<div class="tpl-field"><label for="tpl-kind">نوع السجل</label><select id="tpl-kind" class="tpl-input">' + opts + '</select></div>'
      + C.dualDateHtml('يوم المتابعة — هجري أولاً ثم ميلادي')
      + C.fieldSelect('tpl-indicators', 'المؤشرات', 'data-tpl-indicators multiple size="4"')
      + C.fieldSelect('tpl-prepared', 'صاحب الدور (معدّ)', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'اعتماد اختياري', 'data-tpl-persons')
      + C.fieldTextarea('tpl-notes', 'ملاحظات وإجراء')
      + '</div>'
      + '<h2 class="tpl-section-title">جدول المتابعة</h2>'
      + '<table class="tpl-act-table"><thead><tr><th>#</th><th>البند</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>'
      + [1,2,3,4].map(function (n) {{
          return '<tr><td>' + n + '</td><td><input class="tpl-input" type="text"></td><td><input class="tpl-input" type="text"></td><td><input class="tpl-input" type="text"></td></tr>';
        }}).join('')
      + '</tbody></table>';
  }}
  function wireTitle(host) {{
    var map = {json.dumps(title_map, ensure_ascii=False)};
    var sel = host.querySelector('#tpl-kind');
    function apply() {{ window.TplCommon.setDynamicTitle(map[sel.value] || {json.dumps(title, ensure_ascii=False)}, host); }}
    if (sel) {{ sel.addEventListener('change', apply); apply(); }}
  }}
"""
    elif kind == "roster":
        body = f"""
  function buildBodyHtml() {{
    var C = window.TplCommon;
    var kinds = {json.dumps(list(title_map.keys()), ensure_ascii=False)};
    var opts = kinds.map(function (k) {{ return '<option value="' + k + '">' + k + '</option>'; }}).join('');
    return '<div class="tpl-field-grid">'
      + '<div class="tpl-field"><label for="tpl-kind">نوع الكشف</label><select id="tpl-kind" class="tpl-input">' + opts + '</select></div>'
      + C.fieldText('tpl-title', 'عنوان الكشف')
      + C.dualDateHtml('تاريخ الكشف — هجري أولاً ثم ميلادي')
      + C.fieldSelect('tpl-indicators', 'المؤشرات', 'data-tpl-indicators multiple size="3"')
      + C.fieldSelect('tpl-prepared', 'المُعِدّ', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'اعتماد اختياري', 'data-tpl-persons')
      + '</div>'
      + '<h2 class="tpl-section-title">الأسماء / الحالة</h2>'
      + '<table class="tpl-act-table"><thead><tr><th>#</th><th>الاسم</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>'
      + [1,2,3,4,5,6].map(function (n) {{
          return '<tr><td>' + n + '</td><td><input class="tpl-input" type="text" placeholder="من السجلات المحفوظة فقط"></td><td><input class="tpl-input" type="text"></td><td><input class="tpl-input" type="text"></td></tr>';
        }}).join('')
      + '</tbody></table>';
  }}
  function wireTitle(host) {{
    var map = {json.dumps(title_map, ensure_ascii=False)};
    var sel = host.querySelector('#tpl-kind');
    function apply() {{ window.TplCommon.setDynamicTitle(map[sel.value] || {json.dumps(title, ensure_ascii=False)}, host); }}
    if (sel) {{ sel.addEventListener('change', apply); apply(); }}
  }}
"""
    elif kind == "form":
        body = f"""
  function buildBodyHtml() {{
    var C = window.TplCommon;
    return '<div class="tpl-field-grid">'
      + C.fieldText('tpl-subject', 'موضوع التقويم / الأثر', true)
      + C.dualDateHtml('تاريخ الاستمارة — هجري أولاً ثم ميلادي')
      + C.fieldSelect('tpl-indicators', 'المؤشرات', 'data-tpl-indicators multiple size="3"')
      + C.fieldSelect('tpl-prepared', 'المُعِدّ', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'اعتماد وكيل (عند الحاجة)', 'data-tpl-persons')
      + C.fieldTextarea('tpl-recommend', 'التوصية')
      + '</div>'
      + '<h2 class="tpl-section-title">المحاور والدرجات</h2>'
      + '<table class="tpl-act-table"><thead><tr><th>#</th><th>المحور</th><th>الدرجة</th><th>ملاحظة</th></tr></thead><tbody>'
      + [1,2,3,4].map(function (n) {{
          return '<tr><td>' + n + '</td><td><input class="tpl-input" type="text"></td><td><input class="tpl-input" type="text"></td><td><input class="tpl-input" type="text"></td></tr>';
        }}).join('')
      + '</tbody></table>';
  }}
  function wireTitle(host) {{
    window.TplCommon.setDynamicTitle({json.dumps(title, ensure_ascii=False)}, host);
  }}
"""
    elif kind == "volunteer":
        body = f"""
  function buildBodyHtml() {{
    var C = window.TplCommon;
    return '<div class="tpl-field-grid">'
      + C.fieldText('tpl-activity', 'اسم النشاط التطوعي', true)
      + C.dualDateHtml('تاريخ النشاط — هجري أولاً ثم ميلادي')
      + C.fieldText('tpl-hours', 'الساعات')
      + C.fieldText('tpl-participants', 'عدد المشاركين')
      + C.fieldSelect('tpl-indicators', 'المؤشرات (1-3-1-3 + مراجعة خبير)', 'data-tpl-indicators multiple size="3"')
      + C.fieldSelect('tpl-prepared', 'منسق التطوع (معدّ)', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'رائد النشاط (معتمد)', 'data-tpl-persons')
      + C.fieldTextarea('tpl-notes', 'وصف موجز / شواهد')
      + '<div class="tpl-field full"><p class="tpl-empty">needs_expert_review=true · لا يُنقل تلقائياً إلى 3-2-1-4</p></div>'
      + '</div>';
  }}
  function wireTitle(host) {{
    window.TplCommon.setDynamicTitle({json.dumps(title, ensure_ascii=False)}, host);
  }}
"""
    else:  # partnership
        body = f"""
  function buildBodyHtml() {{
    var C = window.TplCommon;
    return '<div class="tpl-field-grid">'
      + C.fieldText('tpl-partner', 'الجهة الشريكة', true)
      + C.fieldText('tpl-activity', 'موضوع الشراكة')
      + C.dualDateHtml('تاريخ التوثيق — هجري أولاً ثم ميلادي')
      + C.fieldSelect('tpl-indicators', 'المؤشرات (1-3-1-3 + مراجعة خبير)', 'data-tpl-indicators multiple size="3"')
      + C.fieldSelect('tpl-prepared', 'منسق الشراكة (معدّ)', 'data-tpl-persons')
      + C.fieldSelect('tpl-approved', 'اعتماد المدير', 'data-tpl-persons')
      + C.fieldTextarea('tpl-notes', 'المشاركون / المخرجات')
      + '<div class="tpl-field full"><p class="tpl-empty">needs_expert_review=true · مسار اعتماد المدير (08b)</p></div>'
      + '</div>';
  }}
  function wireTitle(host) {{
    window.TplCommon.setDynamicTitle({json.dumps(title, ensure_ascii=False)}, host);
  }}
"""

    cols_js = ",\n        ".join(
        [
            "{ roleTitle: %s, name: '', signature: '', signatureFallback: 'signatures/%s' }"
            % (json.dumps(role, ensure_ascii=False), sig)
            for role, sig in spec["columns"]
        ]
    )
    committees_line = (
        "committeesUrl: opts.committeesUrl || '../_shared/committees.json',"
        if use_committees
        else ""
    )
    expert_suffix = (
        " + " + json.dumps(" · مراجعة خبير", ensure_ascii=False) if expert else ""
    )
    if spec.get("programs"):
        then_body = """      return root.TplCommon.loadPrograms(opts.programsUrl || '../_shared/programs.json').then(function (programs) {
        root.TplCommon.populatePrograms(host.querySelector('#tpl-program'), programs);
        stats.programs = programs.length;
        return afterPop(stats);
      });"""
    else:
        then_body = "      return afterPop(stats);"

    return f"""/**
 * {tid} — مكوّن ديناميكي (خ-مك / قرار 138)
 * يعتمد TplCommon + OfficialFrameCore
 */
(function (root) {{
  "use strict";
  var DEFAULT_INDICATORS = {defaults};
{body}
  function mount(opts) {{
    opts = opts || {{}};
    if (!root.TplCommon || !root.OfficialFrameCore) {{
      return Promise.reject(new Error('TplCommon أو OfficialFrameCore غير محمّل'));
    }}
    var host = root.TplCommon.mountOfficial({{
      title: {json.dumps(title, ensure_ascii=False)},
      bodyHtml: buildBodyHtml(),
      columns: [
        {cols_js}
      ]
    }});
    wireTitle(host);
    var popOpts = {{
      identityUrl: opts.identityUrl || '../_shared/identity.json',
      indicatorsUrl: opts.indicatorsUrl || '../_shared/indicators.json',
      {committees_line}
      defaultIndicators: DEFAULT_INDICATORS,
      root: host
    }};
    var afterPop = function (stats) {{
      var calOk = root.TplCommon.bindSystemCalendars(host);
      if (opts.statusEl) {{
        opts.statusEl.textContent =
          (stats.programs != null ? ('برامج: ' + stats.programs + ' · ') : '') +
          'أسماء: ' + stats.persons +
          ' · مؤشرات: ' + stats.indicators +
          (stats.committees ? (' · هيئات: ' + stats.committees) : '') +
          (calOk ? ' · تقويم مربوط' : ' · تقويم: يحتاج dashboard.js'){expert_suffix};
      }}
      return stats;
    }};
    return root.TplCommon.populateDropdowns(popOpts).then(function (stats) {{
{then_body}
    }});
  }}
  root[{json.dumps(tid.replace('-', ''))}] = {{
    mount: mount,
    printOfficial: function () {{ root.TplCommon.printOfficial({{}}); }},
    DEFAULT_INDICATORS: DEFAULT_INDICATORS
  }};
  // alias ثابت
  root[{json.dumps(tid)}] = root[{json.dumps(tid.replace('-', ''))}];
}})(window);
"""


def html_page(spec: dict, rel_shared: str, rel_core: str, rel_dash: str, rel_css: str) -> str:
    tid = spec["id"]
    folder = spec["folder"]
    api = tid.replace("-", "")
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>{tid} — {spec['title']}</title>
  <link rel="stylesheet" href="{rel_css}/media-governance.css">
  <link rel="stylesheet" href="{rel_css}/print.css">
  <style id="tpl-shell"></style>
</head>
<body class="tpl-sample">
  <div class="tpl-toolbar no-print">
    <strong>{tid}</strong>
    <span class="note" id="tpl-status">جاري التحميل…</span>
    <button type="button" id="btn-print">طباعة</button>
    <a href="../preview-hub.html" style="color:#fff;margin-inline-start:auto">مركز المعاينة</a>
  </div>
  <div id="official-frame-host" class="official-frame-host" hidden></div>
  <script>
  (function(){{
    try {{
      var raw = sessionStorage.getItem('sessionUser');
      var ok = false;
      if (raw) {{ var s = JSON.parse(raw); ok = !!(s && s.token && s.id); }}
      if (!ok) sessionStorage.setItem('sessionUser', JSON.stringify({{token:'tpl-preview',id:'{folder}',name:'معاينة {tid}'}}));
    }} catch (e) {{}}
  }})();
  </script>
  <script src="{rel_dash}/dashboard.js"></script>
  <script src="{rel_core}/official-frame-core.js"></script>
  <script src="{rel_shared}/tpl-common.js"></script>
  <script src="{tid}.js"></script>
  <script>
  (function () {{
    'use strict';
    var st = document.getElementById('tpl-status');
    if (window.TplCommon && window.TplCommon.SHELL_CSS) {{
      document.getElementById('tpl-shell').textContent = window.TplCommon.SHELL_CSS;
    }}
    var api = window[{json.dumps(api)}] || window[{json.dumps(tid)}];
    if (!api) {{ st.textContent = 'فشل تحميل {tid}'; return; }}
    api.mount({{
      identityUrl: '{rel_shared}/identity.json',
      indicatorsUrl: '{rel_shared}/indicators.json',
      committeesUrl: '{rel_shared}/committees.json',
      programsUrl: '{rel_shared}/programs.json',
      statusEl: st
    }}).catch(function (err) {{ st.textContent = String(err && err.message ? err.message : err); }});
    document.getElementById('btn-print').addEventListener('click', function () {{ api.printOfficial(); }});
  }})();
  </script>
</body>
</html>
"""


def schema_json(spec: dict) -> dict:
    return {
        "template_id": spec["id"],
        "title": spec["title"],
        "structure_ref": "08_template_structure.md#" + spec["id"].split("a")[0].split("b")[0],
        "default_indicator_codes": spec["defaults"],
        "permissions": {
            "approved_by": spec.get("approved"),
            "rapporteur_vacant": bool(spec.get("rapporteur_vacant")),
            "needs_expert_review": bool(spec.get("expert")),
        },
        "print": {
            "engine": "OfficialFrameCore",
            "orientation": "portrait",
            "strictIdentity": True,
            "barcode_required": False,
        },
        "fields_from_structure_only": True,
        "dynamic": {
            "persons": "identity.json",
            "indicators": "indicators.json",
            "committees": "committees.json" if spec.get("committees") else None,
            "programs": "programs.json" if spec.get("programs") else None,
            "dual_date": True,
            "dynamic_title": bool(spec.get("title_map") or spec.get("committees") or spec.get("programs")),
        },
    }


def build_stub(tid: str, folder: str, title: str) -> None:
    d = ROOT / folder
    d.mkdir(parents=True, exist_ok=True)
    write_json(
        d / f"{tid}.json",
        {
            "template_id": tid,
            "title": title,
            "kind": "stub_documentation",
            "note": "توثيق صنف TPL-09 بلا توحيد قسري (قرار 104) · لا مكوّن تشغيل كامل",
            "print": {"engine": "OfficialFrameCore", "strictIdentity": True},
        },
    )
    (d / f"{tid}.js").write_text(
        f"""(function (root) {{
  "use strict";
  function mount(opts) {{
    opts = opts || {{}};
    var host = root.TplCommon.mountOfficial({{
      title: {json.dumps(title, ensure_ascii=False)},
      bodyHtml: '<div class="tpl-field-grid">'
        + root.TplCommon.fieldText('tpl-source-title', 'عنوان النموذج كما في المصدر', true)
        + root.TplCommon.dualDateHtml('التاريخ إن وُجد — هجري أولاً ثم ميلادي')
        + root.TplCommon.fieldSelect('tpl-prepared', 'معدّ اختياري', 'data-tpl-persons')
        + '<div class="tpl-field full"><p class="tpl-empty">صنف توثيقي ضمن TPL-09 · لا يُجبر على عائلة 01–07 · approved_by غالباً none</p></div>'
        + root.TplCommon.fieldTextarea('tpl-notes', 'حقول المصدر (وصف حر دون اختراع قيم)')
        + '</div>',
      columns: [
        {{ roleTitle: 'معدّ (اختياري)', name: '', signature: '', signatureFallback: 'signatures/sig_teachers.png' }},
        {{ roleTitle: '—', name: '', signature: '', signatureFallback: 'signatures/sig_students.png' }},
        {{ roleTitle: '—', name: '', signature: '', signatureFallback: 'signatures/sig_manager.png' }}
      ]
    }});
    return root.TplCommon.populateDropdowns({{
      identityUrl: opts.identityUrl || '../_shared/identity.json',
      indicatorsUrl: opts.indicatorsUrl || '../_shared/indicators.json',
      defaultIndicators: [],
      root: host
    }}).then(function (stats) {{
      root.TplCommon.bindSystemCalendars(host);
      if (opts.statusEl) opts.statusEl.textContent = 'stub · أسماء: ' + stats.persons + ' · بلا توحيد قسري';
      return stats;
    }});
  }}
  root[{json.dumps(tid.replace('-', ''))}] = {{ mount: mount, printOfficial: function () {{ root.TplCommon.printOfficial({{}}); }} }};
  root[{json.dumps(tid)}] = root[{json.dumps(tid.replace('-', ''))}];
}})(window);
""",
        encoding="utf-8",
    )
    stub_spec = {
        "id": tid,
        "folder": folder,
        "title": title,
        "defaults": [],
        "approved": "none",
        "columns": [],
        "kind": "stub",
    }
    (d / f"{tid}.html").write_text(
        html_page(
            stub_spec,
            "../_shared",
            "../../../Print_Canvas/js",
            "../../../Print_Canvas/js",
            "../../../Print_Canvas/css",
        ),
        encoding="utf-8",
    )
    (d / "README.md").write_text(
        f"# {tid}\n\n{title}\n\nStub توثيقي ضمن خ-مك — لا توحيد قسري.\n",
        encoding="utf-8",
    )


def build_family(spec: dict) -> None:
    d = ROOT / spec["folder"]
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{spec['id']}.js").write_text(body_js_builder(spec), encoding="utf-8")
    (d / f"{spec['id']}.html").write_text(
        html_page(
            spec,
            "../_shared",
            "../../../Print_Canvas/js",
            "../../../Print_Canvas/js",
            "../../../Print_Canvas/css",
        ),
        encoding="utf-8",
    )
    write_json(d / f"{spec['id']}.json", schema_json(spec))
    (d / "README.md").write_text(
        f"# {spec['id']} — {spec['title']}\n\nخ-مك · OfficialFrameCore · حقول من الهيكل فقط.\n",
        encoding="utf-8",
    )


def write_registry() -> None:
    items = []
    for s in SPECS:
        items.append(
            {
                "id": s["id"],
                "folder": s["folder"],
                "title": s["title"],
                "kind": s["kind"],
                "html": f"{s['folder']}/{s['id']}.html",
                "status": "dynamic",
            }
        )
    for tid, folder, title in STUBS_09:
        items.append(
            {
                "id": tid,
                "folder": folder,
                "title": title,
                "kind": "stub",
                "html": f"{folder}/{tid}.html",
                "status": "documentation_stub",
            }
        )
    write_json(
        ROOT / "registry.json",
        {
            "meta": {
                "wave": "خ-مك-2",
                "decision": 139,
                "count": len(items),
                "engine": "OfficialFrameCore",
            },
            "templates": items,
        },
    )


def write_hub() -> None:
    links = []
    for s in SPECS:
        links.append((s["id"], f"{s['folder']}/{s['id']}.html", s["title"]))
    for tid, folder, title in STUBS_09:
        links.append((tid, f"{folder}/{tid}.html", title))
    items = "\n".join(
        f'    <li><a href="{href}">{tid}</a> — {desc}</li>'
        for tid, href, desc in links
    )
    hub = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>مركز معاينة المكوّنات — خ-مك</title>
  <style>
    body {{ font-family: Tajawal, sans-serif; margin: 24px; background: #f4f7f5; color: #1a1a1a; }}
    h1 {{ color: #0b5e56; }}
    ul {{ line-height: 1.9; }}
    a {{ color: #0b5e56; font-weight: 700; }}
    .note {{ color: #5c675f; }}
  </style>
</head>
<body>
  <h1>مركز معاينة المكوّنات (خ-مك / خ-مك-2)</h1>
  <p class="note">قرارات 138–139 · OfficialFrameCore · لا خ6/خ7 · لا اختراع أسماء</p>
  <ul>
{items}
  </ul>
</body>
</html>
"""
    (ROOT / "preview-hub.html").write_text(hub, encoding="utf-8")


def sync_to_print_canvas() -> None:
    PC_COMP.mkdir(parents=True, exist_ok=True)
    # shared
    dst_shared = PC_COMP / "_shared"
    if dst_shared.exists():
        shutil.rmtree(dst_shared)
    shutil.copytree(SHARED, dst_shared)

    folders = [s["folder"] for s in SPECS] + [f for _, f, _ in STUBS_09]
    for folder in folders:
        src = ROOT / folder
        if not src.exists():
            continue
        dst = PC_COMP / folder
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        for html in dst.glob("*.html"):
            text = html.read_text(encoding="utf-8")
            text = text.replace("../../../Print_Canvas/css/", "../../css/")
            text = text.replace("../../../Print_Canvas/js/", "../../js/")
            html.write_text(text, encoding="utf-8")

    hub_src = (ROOT / "preview-hub.html").read_text(encoding="utf-8")
    hub_src = hub_src.replace('href="', 'href="components/')
    (PC / "preview-tpl-hub.html").write_text(hub_src, encoding="utf-8")
    shutil.copy2(ROOT / "preview-hub.html", PC_COMP / "preview-hub.html")
    if (ROOT / "registry.json").exists():
        shutil.copy2(ROOT / "registry.json", PC_COMP / "registry.json")

    # اختصار قديم لمعاينة TPL-01 من جذر Print_Canvas
    tpl01_html = (PC_COMP / "tpl01" / "TPL-01.html").read_text(encoding="utf-8")
    shortcut = (
        tpl01_html.replace("../../css/", "css/")
        .replace("../../js/", "js/")
        .replace("../_shared/", "components/_shared/")
        .replace('src="TPL-01.js"', 'src="components/tpl01/TPL-01.js"')
        .replace('href="../preview-hub.html"', 'href="preview-tpl-hub.html"')
    )
    (PC / "preview-tpl01.html").write_text(shortcut, encoding="utf-8")


def main() -> None:
    copy_shared_data()
    for spec in SPECS:
        build_family(spec)
        print("built", spec["id"])
    for tid, folder, title in STUBS_09:
        build_stub(tid, folder, title)
        print("stub", tid)
    write_registry()
    write_hub()
    sync_to_print_canvas()
    print("hub + sync OK →", PC / "preview-tpl-hub.html")


if __name__ == "__main__":
    main()
