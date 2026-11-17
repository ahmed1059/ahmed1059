"""تحصين الترابط — مصدر الأداء الكنسي ومزامنته وفحص الطبقات."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
CANONICAL = _ROOT / "config" / "performance_metrics.json"
MIRROR = _ROOT / "Print_Canvas" / "components" / "_shared" / "performance_metrics.json"
MAP_FILE = _ROOT / "Print_Canvas" / "components" / "_shared" / "program_goal_indicator_map.json"
REPORT = _ROOT / "Print_Canvas" / "components" / "my-plan" / "21_binding_fortification.md"


def _sha(path: Path) -> str:
    if not path.is_file():
        return ""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_canonical() -> dict:
    if not CANONICAL.is_file():
        raise FileNotFoundError(f"المركز الكنسي مفقود: {CANONICAL}")
    return json.loads(CANONICAL.read_text(encoding="utf-8"))


def sync_performance_mirror(force: bool = True) -> dict:
    """ينسخ الكنسي بايتًا بايتًا إلى مرآة الخدمة. الأصل دائمًا config/."""
    load_canonical()  # تحقق JSON
    raw = CANONICAL.read_bytes()
    MIRROR.parent.mkdir(parents=True, exist_ok=True)
    before = _sha(MIRROR)
    digest = hashlib.sha256(raw).hexdigest()
    if force or before != digest:
        MIRROR.write_bytes(raw)
    after = _sha(MIRROR)
    return {
        "ok": True,
        "canonical": str(CANONICAL.relative_to(_ROOT)),
        "mirror": str(MIRROR.relative_to(_ROOT)),
        "sha256": after[:16],
        "synced": before != after,
        "identical": after == digest,
    }


def audit_binding_layers() -> dict:
    """فحص واسع→ضيق لطبقات الترابط الحرجة."""
    findings = []
    metrics = None
    try:
        metrics = load_canonical()
        findings.append({"layer": "L1-مركز الأداء", "status": "ok", "detail": "الكنسي مقروء"})
    except Exception as error:
        findings.append({"layer": "L1-مركز الأداء", "status": "fail", "detail": str(error)})

    sync = {}
    try:
        sync = sync_performance_mirror(force=True)
        same = _sha(CANONICAL) == _sha(MIRROR)
        findings.append(
            {
                "layer": "L2-مرآة الخدمة",
                "status": "ok" if same else "fail",
                "detail": f"sha={sync.get('sha256')} identical={same}",
            }
        )
    except Exception as error:
        findings.append({"layer": "L2-مرآة الخدمة", "status": "fail", "detail": str(error)})

    required = [
        ("external_evaluation", "overall"),
        ("external_evaluation", "administration"),
        ("external_evaluation", "teaching"),
        ("external_evaluation", "outcomes"),
        ("external_evaluation", "environment"),
        ("nafes", "math"),
        ("nafes", "reading"),
        ("nafes", "science"),
    ]
    missing = []
    if metrics:
        for group, key in required:
            node = (metrics.get(group) or {}).get(key)
            if not node or node.get("score") is None:
                missing.append(f"{group}.{key}")
        findings.append(
            {
                "layer": "L3-مفاتيح الأداء",
                "status": "ok" if not missing else "fail",
                "detail": "كاملة" if not missing else ("ناقص: " + ", ".join(missing)),
            }
        )

    map_ok = MAP_FILE.is_file()
    map_count = 0
    if map_ok:
        try:
            mapped = json.loads(MAP_FILE.read_text(encoding="utf-8"))
            map_count = len(mapped.get("programs") or [])
        except json.JSONDecodeError:
            map_ok = False
    findings.append(
        {
            "layer": "L4-خريطة برنامج↔مؤشر",
            "status": "ok" if map_ok else "warn",
            "detail": f"programs={map_count}" if map_ok else "الملف مفقود أو تالف",
        }
    )

    consumers = [
        _ROOT / "Print_Canvas" / "js" / "performance-bind.js",
        _ROOT / "Print_Canvas" / "js" / "progress-engine.js",
        _ROOT / "Print_Canvas" / "js" / "dashboard.js",
        _ROOT / "Print_Canvas" / "js" / "erp-suite.js",
        _ROOT / "Print_Canvas" / "components" / "my-plan" / "my-plan-app.js",
        _ROOT / "Print_Canvas" / "js" / "data-hub.js",
    ]
    missing_files = [str(p.relative_to(_ROOT)) for p in consumers if not p.is_file()]
    findings.append(
        {
            "layer": "L5-مستهلكو الواجهة",
            "status": "ok" if not missing_files else "fail",
            "detail": "كل الملفات موجودة" if not missing_files else ("مفقود: " + ", ".join(missing_files)),
        }
    )

    # أرقام ثابتة شائعة في JS (استثناء ملفات البيانات)
    hard_hits = []
    needles = ['"18.8"', "'18.8'", "71%", "78.75", "نسبة الإتقان — الرياضيات"]
    for path in (_ROOT / "Print_Canvas" / "js").rglob("*.js"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for needle in needles:
            if needle in text and "performance_metrics" not in path.name:
                # performance-bind لا يجب أن يحتوي أرقامًا ثابتة للقيم
                if path.name == "performance-bind.js" and needle in ('"18.8"', "'18.8'", "71%", "78.75"):
                    hard_hits.append(f"{path.name}:{needle}")
                elif path.name != "performance-bind.js" and needle in ('"18.8"', "'18.8'", "71%", "78.75"):
                    hard_hits.append(f"{path.name}:{needle}")
    findings.append(
        {
            "layer": "L6-منع Hardcode أرقام",
            "status": "ok" if not hard_hits else "warn",
            "detail": "لا أرقام أداء ثابتة في JS" if not hard_hits else (", ".join(hard_hits[:12])),
        }
    )

    fail = sum(1 for row in findings if row["status"] == "fail")
    warn = sum(1 for row in findings if row["status"] == "warn")
    return {
        "fail": fail,
        "warn": warn,
        "ok": sum(1 for row in findings if row["status"] == "ok"),
        "findings": findings,
        "sync": sync,
        "scores": {
            "overall": ((metrics or {}).get("external_evaluation") or {}).get("overall", {}).get("score"),
            "math": ((metrics or {}).get("nafes") or {}).get("math", {}).get("score"),
            "reading": ((metrics or {}).get("nafes") or {}).get("reading", {}).get("score"),
            "science": ((metrics or {}).get("nafes") or {}).get("science", {}).get("score"),
        }
        if metrics
        else {},
    }


def write_fortification_report(audit: dict | None = None) -> Path:
    audit = audit or audit_binding_layers()
    lines = [
        "# 21 — تحصين الترابط (Binding Fortification)",
        "",
        "**المبدأ:** واسع → ضيق · المصدر الكنسي أولًا · المرآة ظلّ · الواجهة تقرأ ولا تخترع.",
        "",
        "## طبقات الفحص",
        "",
        "| الطبقة | الحالة | التفصيل |",
        "|---|---|---|",
    ]
    for row in audit["findings"]:
        lines.append(f"| {row['layer']} | `{row['status']}` | {row['detail']} |")
    lines.extend(
        [
            "",
            "## ملخص",
            "",
            f"- OK: **{audit['ok']}** · WARN: **{audit['warn']}** · FAIL: **{audit['fail']}**",
            f"- درجات حية: `{audit.get('scores')}`",
            "",
            "## عقد التحصين",
            "",
            "1. **L1** `config/performance_metrics.json` هو المصدر الوحيد لكتابة أرقام الأداء.",
            "2. **L2** المرآة تُحدَّث تلقائيًا عند إقلاع الخادم عبر `binding_guard.sync_performance_mirror`.",
            "3. **L3** القراءة من الواجهة عبر `/api/performance-metrics` ثم المرآة احتياطيًا.",
            "4. **L4** خريطة البرنامج↔المؤشر منفصلة عن الأرقام.",
            "5. **L5** مستهلكو الشاشة: PerformanceBind · progress-engine · خطتي · نافس.",
            "6. **L6** ممنوع تثبيت نسب نافس/التقرير في HTML/JS.",
            "7. **L7** اسم المدرسة والقيادة من `/api/settings` عبر IdentityBind.",
            "8. **L8** حدث `dataChanged` يُبطل الكاش ويعيد التعبئة.",
            "",
            "## ما قبل أي إعادة تخطيط بصري",
            "",
            "تحصين الترابط يسبق موجة GOV.UK Layout. لا تُخلط إعادة التخطيط مع إعادة هندسة البيانات.",
            "",
        ]
    )
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return REPORT
