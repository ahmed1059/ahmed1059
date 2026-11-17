# -*- coding: utf-8 -*-
"""مهجور (قرار 140): استُبدل بـ `_build_wave_km.py`. لا يُشغَّل في المسار الحالي.
عينة TPL-01 التاريخية — قرار 132."""

from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent / "tpl01"
OUT.mkdir(parents=True, exist_ok=True)

ADOPTED_ORDER = [
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
# تسميات من THEME_RULES في _run_03 فقط — بلا اختراع
LABELS = {
    "1-2-1-1": "انضباط/مواظبة",
    "1-3-1-1": "مجالس أولياء",
    "1-3-1-2": "تواصل أسري",
    "1-3-1-3": "شراكة/تطوع",
    "1-4-1-1": "احتياج تدريبي",
    "1-4-1-2": "تطوير مهني",
    "2-1-1-2": "مناهج",
    "2-1-1-5": "استراتيجية تدريس",
    "2-2-1-1": "تقويم مقرر",
    "2-2-1-2": "",
    "2-2-1-3": "تحليل نتائج",
    "2-2-1-4": "تحصيلي/نافس",
    "3-2-1-4": "وكيل تعليمية",
}
TPL01_INDS = ["1-4-1-2", "2-2-1-1", "2-2-1-2", "2-2-1-3", "2-2-1-4"]


def build_identity() -> dict:
    rows = list(csv.DictReader((BASE / "06_identity_expansion.csv").open(encoding="utf-8-sig")))
    persons = []
    for r in rows:
        name = (r.get("person_name") or "").strip()
        if not name:
            continue
        if r.get("confidence") not in ("high", "medium"):
            continue
        persons.append(
            {
                "person_id": r["person_id"],
                "name": name,
                "role": r.get("role") or "",
                "confidence": r.get("confidence") or "",
                "source": r.get("source") or "",
            }
        )
    return {
        "meta": {
            "source": "06_identity_expansion.csv",
            "filter": "person_name non-empty AND confidence in high|medium",
            "count": len(persons),
            "generated_at": datetime.now().strftime("%Y-%m-%d"),
            "purpose": "dropdown options — no invented names",
        },
        "persons": persons,
    }


def build_indicators() -> dict:
    return {
        "meta": {
            "source": "adopted explicit_indicator_real (13) + labels from _run_03 THEME_RULES where present",
            "count": len(ADOPTED_ORDER),
            "generated_at": datetime.now().strftime("%Y-%m-%d"),
            "purpose": "indicator binding — adopted 13 only",
        },
        "indicators": [
            {
                "code": c,
                "label_ar": LABELS.get(c) or "",
                "tpl01_default": c in TPL01_INDS,
            }
            for c in ADOPTED_ORDER
        ],
    }


def build_schema() -> dict:
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "TPL-01.schema.json",
        "title": "TPL-01 تقرير برنامج / مسابقة / مبادرة",
        "template_id": "TPL-01",
        "template_type": "تقرير",
        "structure_kind": "عائلة_قالب",
        "description": "تقرير تفعيل أو ختام لبرنامج أو مسابقة أو مبادرة بنفس هيكل الشواهد.",
        "source_refs": [
            "08_template_structure.md#TPL-01",
            "10_role_permissions.csv#TPL-01",
            "08_unified_templates.csv#TPL-01",
        ],
        "permissions": {
            "prepared_by": "required",
            "prepared_by_primary": "رائد النشاط أو منسق البرنامج أو المعلم المنفّذ",
            "approved_by": "optional",
            "approved_by_primary": "وكيل الشؤون التعليمية (اعتماد أول) · مدير المدرسة عند اللزوم فقط",
            "rapporteur_vacant": False,
            "needs_expert_review": False,
        },
        "default_indicator_codes": TPL01_INDS,
        "print": {
            "engine": "OfficialFrameCore",
            "frame": "official-document-frame",
            "page": "official-core-a4",
            "orientation": "portrait",
            "strictIdentity": True,
            "barcode_required": False,
        },
        "type": "object",
        "additionalProperties": False,
        "required": ["program_name", "prepared_by"],
        "properties": {
            "program_name": {
                "type": "string",
                "title": "اسم البرنامج/المسابقة/المبادرة",
                "x-ui": "text",
            },
            "period_hijri": {
                "type": "string",
                "title": "الفترة — التاريخ الهجري",
                "description": "هجري أولاً داخل الحقل المزدوج (قاعدة النظام)",
                "x-ui": "hijri_date",
            },
            "period_gregorian": {
                "type": "string",
                "title": "الفترة — التاريخ الميلادي",
                "description": "ميلادي ثانياً في نفس الصف",
                "x-ui": "gregorian_date",
            },
            "target_audience": {
                "type": "string",
                "title": "الفئة المستهدفة",
                "x-ui": "text",
            },
            "activities": {
                "type": "array",
                "title": "الأنشطة المنفذة",
                "x-ui": "table",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "activity_name": {"type": "string", "title": "النشاط"},
                        "date_hijri": {
                            "type": "string",
                            "title": "التاريخ هـ",
                            "x-ui": "hijri_date",
                        },
                        "date_gregorian": {
                            "type": "string",
                            "title": "التاريخ م",
                            "x-ui": "gregorian_date",
                        },
                        "notes": {"type": "string", "title": "ملاحظة"},
                    },
                    "required": ["activity_name"],
                },
            },
            "evidence_attached": {
                "type": "array",
                "title": "الشواهد المرفقة",
                "x-ui": "list",
                "items": {"type": "string", "title": "وصف/مرجع الشاهد"},
            },
            "indicator_codes": {
                "type": "array",
                "title": "المؤشرات (من الـ13 المعتمدة فقط)",
                "x-ui": "multiselect",
                "x-options_ref": "indicators.json",
                "items": {"type": "string", "enum": ADOPTED_ORDER},
                "default": TPL01_INDS,
            },
            "prepared_by": {
                "type": "string",
                "title": "المُعِدّ (prepared_by)",
                "x-ui": "person_select",
                "x-options_ref": "identity.json",
                "x-permission": "required",
            },
            "approved_by": {
                "type": "string",
                "title": "المعتمد (approved_by)",
                "x-ui": "person_select",
                "x-options_ref": "identity.json",
                "x-permission": "optional",
                "description": "وكيل الشؤون التعليمية اعتماداً أولاً · المدير عند اللزوم فقط",
            },
        },
    }


def build_html() -> str:
    """صفحة عينة تستدعي OfficialFrameCore.page — بلا بيانات مخترعة في الحقول."""
    # مسارات نسبية من components/tpl01 → جذر المشروع
    css_gov = "../../../Print_Canvas/css/media-governance.css"
    css_print = "../../../Print_Canvas/css/print.css"
    js_core = "../../../Print_Canvas/js/official-frame-core.js"
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>TPL-01 — عينة مكوّن تقرير (OfficialFrameCore)</title>
  <link rel="stylesheet" href="{css_gov}">
  <link rel="stylesheet" href="{css_print}">
  <style>
    /* معاينة الشاشة فقط — لا تمس محددات الإطار المحصّنة */
    body.tpl01-sample {{ margin: 0; background: #e8ece9; font-family: "Tajawal", sans-serif; }}
    .tpl01-toolbar {{
      position: sticky; top: 0; z-index: 20;
      display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
      padding: 10px 14px; background: #0b5e56; color: #fff;
    }}
    .tpl01-toolbar button {{
      font: inherit; cursor: pointer; border: 0; border-radius: 6px;
      padding: 8px 14px; background: #fff; color: #0b5e56; font-weight: 700;
    }}
    .tpl01-toolbar .note {{ font-size: 13px; opacity: .95; }}
    #official-frame-host {{ display: flex; justify-content: center; padding: 16px; }}
    .tpl-field-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; margin: 8px 0 14px; }}
    .tpl-field {{ border: 1px solid #c5d0cb; border-radius: 4px; padding: 8px 10px; background: #fff; }}
    .tpl-field label {{ display: block; font-size: 13px; color: #5c675f; margin-bottom: 4px; }}
    .tpl-field .value {{
      min-height: 1.4em; font-size: 15px; color: #1a1a1a;
      border-bottom: 1px dashed #9aab9f;
    }}
    .tpl-field.full {{ grid-column: 1 / -1; }}
    .tpl-act-table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
    .tpl-act-table th, .tpl-act-table td {{
      border: 1px solid #b7c4bc; padding: 6px 8px; text-align: right;
    }}
    .tpl-act-table th {{ background: #eef3f0; color: #0b5e56; }}
    .tpl-empty {{ color: #8a968e; font-style: italic; }}
    @media print {{
      .tpl01-toolbar {{ display: none !important; }}
      body.tpl01-sample {{ background: #fff; }}
      #official-frame-host {{ padding: 0; }}
    }}
  </style>
</head>
<body class="tpl01-sample">
  <div class="tpl01-toolbar no-print">
    <strong>TPL-01 عينة</strong>
    <span class="note">OfficialFrameCore · بلا بيانات مخترعة · بلا باركود · قرار 132</span>
    <button type="button" id="btn-print">طباعة</button>
  </div>
  <div id="official-frame-host" class="official-frame-host" hidden></div>
  <script src="{js_core}"></script>
  <script>
(function () {{
  "use strict";
  if (!window.OfficialFrameCore) {{
    document.body.insertAdjacentHTML("afterbegin",
      "<p style=\\"padding:1rem;color:#b91c1c\\">فشل تحميل OfficialFrameCore — تحقق من المسار النسبي.</p>");
    return;
  }}
  var core = window.OfficialFrameCore;

  function field(label, full) {{
    return "<div class=\\"tpl-field" + (full ? " full" : "") + "\\">"
      + "<label>" + core.escapeHtml(label) + "</label>"
      + "<div class=\\"value tpl-empty\\">(يُملأ من النظام / القائمة المنسدلة)</div>"
      + "</div>";
  }}

  var bodyHtml = ""
    + "<div class=\\"tpl-field-grid\\">"
    + field("اسم البرنامج/المسابقة/المبادرة", true)
    + field("الفترة — هجري أولاً ثم ميلادي (حقل مزدوج)", true)
    + field("الفئة المستهدفة", false)
    + field("المؤشرات (من الـ13 — افتراضي TPL-01: 1-4-1-2 · 2-2-1-1 · 2-2-1-2 · 2-2-1-3 · 2-2-1-4)", true)
    + "</div>"
    + "<h2 class=\\"tpl-section-title\\" style=\\"font-size:16px;color:#0b5e56;margin:12px 0 6px\\">الأنشطة المنفذة</h2>"
    + "<table class=\\"tpl-act-table\\"><thead><tr>"
    + "<th>#</th><th>النشاط</th><th>التاريخ هـ</th><th>التاريخ م</th><th>ملاحظة</th>"
    + "</tr></thead><tbody>"
    + "<tr><td>1</td><td class=\\"tpl-empty\\">—</td><td class=\\"tpl-empty\\">—</td><td class=\\"tpl-empty\\">—</td><td class=\\"tpl-empty\\">—</td></tr>"
    + "<tr><td>2</td><td class=\\"tpl-empty\\">—</td><td class=\\"tpl-empty\\">—</td><td class=\\"tpl-empty\\">—</td><td class=\\"tpl-empty\\">—</td></tr>"
    + "<tr><td>3</td><td class=\\"tpl-empty\\">—</td><td class=\\"tpl-empty\\">—</td><td class=\\"tpl-empty\\">—</td><td class=\\"tpl-empty\\">—</td></tr>"
    + "</tbody></table>"
    + "<h2 class=\\"tpl-section-title\\" style=\\"font-size:16px;color:#0b5e56;margin:14px 0 6px\\">الشواهد المرفقة</h2>"
    + "<p class=\\"tpl-empty\\">(قائمة فارغة — تُملأ من النظام دون اختراع)</p>";

  var html = core.page({{
    strictIdentity: true,
    title: "تقرير برنامج / مسابقة / مبادرة",
    frameClass: "tpl-portrait-official",
    bodyHtml: bodyHtml,
    signoff: true,
    page: 1,
    total: 1,
    columns: [
      {{
        roleTitle: "إعداد (prepared_by)",
        name: "",
        signature: "",
        signatureFallback: "signatures/sig_teachers.png"
      }},
      {{
        roleTitle: "اعتماد أول (وكيل التعليمية)",
        name: "",
        signature: "",
        signatureFallback: "signatures/sig_students.png"
      }},
      {{
        roleTitle: "اعتماد المدير (اختياري)",
        name: "",
        signature: "",
        signatureFallback: "signatures/sig_manager.png"
      }}
    ]
  }});

  var host = core.ensureHost();
  host.innerHTML = html;
  host.hidden = false;
  document.body.classList.add("is-print-preview", "print-official-core");

  document.getElementById("btn-print").addEventListener("click", function () {{
    document.body.classList.add("print-mode", "print-official-core");
    core.armPrintPage({{}});
    window.print();
  }});
}})();
  </script>
</body>
</html>
"""


def main() -> None:
    identity = build_identity()
    indicators = build_indicators()
    schema = build_schema()
    (OUT / "identity.json").write_text(
        json.dumps(identity, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUT / "indicators.json").write_text(
        json.dumps(indicators, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUT / "TPL-01.json").write_text(
        json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUT / "TPL-01.html").write_text(build_html(), encoding="utf-8")

    log = f"""# TPL-01 sample — سجل تسليم العينة
## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}
## قرارات: 131 · 132

| المخرج | الحالة | تحقق سريع |
|---|---|---|
| `tpl01/TPL-01.html` | تم | يستدعي `OfficialFrameCore.page` + `armPrintPage` · strictIdentity · بلا باركود |
| `tpl01/TPL-01.json` | تم | حقول من 08_template_structure فقط · صلاحيات من 10_role_permissions |
| `tpl01/identity.json` | تم | count={identity['meta']['count']} (high+medium بأسماء) |
| `tpl01/indicators.json` | تم | count={indicators['meta']['count']} رموز معتمدة |

## إيقاف
لا TPL-02 · بانتظار مراجعة رئيس المشروع.
"""
    (OUT / "README_SAMPLE.md").write_text(log, encoding="utf-8")
    print("OK", OUT)
    print("identity", identity["meta"]["count"])
    print("indicators", indicators["meta"]["count"])


if __name__ == "__main__":
    main()
