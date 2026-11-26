# تحقق عزل الأس في renderArabicMath — python3 -m Core_Engine.nafs_math_atom_render_test
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PORTAL_JS = ROOT / "Print_Canvas" / "js" / "portal-student.js"
PORTAL_CSS = ROOT / "Print_Canvas" / "css" / "portal-student.css"


NODE_SMOKE = r"""
const EASTERN = "٠١٢٣٤٥٦٧٨٩";
function toEastern(text) {
  return String(text == null ? "" : text)
    .replace(/[0-9]/g, (d) => EASTERN.charAt(Number(d)))
    .replace(/%/g, "٪");
}
function escapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function wrapMathAtom(innerHtml) {
  return '<span class="math-atom" dir="rtl">' + innerHtml + "</span>";
}
function renderArabicMath(raw) {
  var source = String(raw == null ? "" : raw);
  if (!source) return "";
  var tokens = [];
  function keep(html) {
    tokens.push(html);
    return "\uE000" + (tokens.length - 1) + "\uE001";
  }
  var text = source;
  text = text.replace(/([0-9٠-٩أ-يA-Za-zπΩµα])\^([0-9٠-٩]+)/g, function (_m, base, exp) {
    return keep(wrapMathAtom(toEastern(base) + "<sup>" + toEastern(exp) + "</sup>"));
  });
  text = text.replace(/([0-9٠-٩أ-يA-Za-zπΩµα])([²³⁴⁵⁶⁷⁸⁹⁰¹]+)/g, function (_m, base, exp) {
    var map = { "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁰": "0" };
    var easternExp = String(exp).split("").map((ch) => map[ch] || ch).join("");
    return keep(wrapMathAtom(toEastern(base) + "<sup>" + toEastern(easternExp) + "</sup>"));
  });
  text = text.replace(/\uE000\d+\uE001|[^\uE000]+/g, function (part) {
    if (part.charAt(0) === "\uE000") return part;
    return toEastern(escapeHtml(part));
  });
  return text.replace(/\uE000(\d+)\uE001/g, function (_m, idx) {
    return tokens[Number(idx)] || "";
  });
}
const samples = [
  "في المثلث القائم: أ² + ب² = ج² حيث ج الوتر. مثال: ٣-٤-٥.",
  "نضرب المعاملات ونجمع الأسس: (٢ص³)(٣ص²)=٦ص⁵.",
  "س^3 + ص^2",
  "ناتج ٣⁴ يساوي:",
  "ناتج ٢³ يساوي:",
];
for (const s of samples) {
  const html = renderArabicMath(s);
  const atoms = (html.match(/<span class="math-atom" dir="rtl">/g) || []).length;
  const loose = /[أ-يA-Za-z٠-٩0-9]<sup>/.test(html.replace(/<span class="math-atom"[^>]*>.*?<\/span>/gs, ""));
  if (atoms < 1) { console.error("FAIL no atoms", s, html); process.exit(1); }
  if (loose) { console.error("FAIL loose sup", s, html); process.exit(1); }
  if (!html.includes("<sup>") || !/dir="rtl"/.test(html)) { console.error("FAIL dir", html); process.exit(1); }
  // داخل الذرة: الأساس قبل <sup> في DOM حتى يظهر الأساس أولاً عند قراءة RTL
  if (!/<span class="math-atom" dir="rtl">[^<]+<sup>/.test(html)) {
    console.error("FAIL base-before-sup", html); process.exit(1);
  }
  if (/dir="ltr"/.test(html)) { console.error("FAIL leftover ltr atom", html); process.exit(1); }
  console.log("OK", atoms, html.slice(0, 140));
}
"""


def main() -> int:
    errors: list[str] = []
    js = PORTAL_JS.read_text(encoding="utf-8")
    css = PORTAL_CSS.read_text(encoding="utf-8")
    if "wrapMathAtom" not in js or 'class="math-atom"' not in js:
        errors.append("portal-student.js missing math-atom wrap")
    if 'dir="rtl"' not in js or "wrapMathAtom" not in js:
        errors.append("math-atom must use dir=rtl so base precedes exponent in RTL reading")
    if 'dir="ltr">' in js and "math-atom" in js:
        # لا نسمح بذرات أسس ltr في بوابة الطالب
        if re.search(r'class="math-atom" dir="ltr"', js):
            errors.append("leftover math-atom dir=ltr in portal-student.js")
    if ".math-atom" not in css or "unicode-bidi: isolate" not in css:
        errors.append("portal-student.css missing math-atom rules")
    if not re.search(r"\.math-atom\s*\{[^}]*direction:\s*rtl", css, re.S):
        errors.append("math-atom css direction must be rtl")
    analytics = (ROOT / "Print_Canvas" / "js" / "app-journey-nafs-analytics.js").read_text(encoding="utf-8")
    if re.search(r'class="math-atom" dir="ltr"', analytics):
        errors.append("analytics still has math-atom dir=ltr")
    if 'class="math-atom" dir="rtl"' not in analytics:
        errors.append("analytics missing math-atom dir=rtl")
    if re.search(r"\.flip-face\.back \.flip-body\s*\{[^}]*display:\s*flex", css, re.S):
        errors.append("flip-body still display:flex")
    if "display: block" not in css:
        errors.append("flip-body not block")

    from .nafs_misconception_lab import GOLDEN_DECK

    m1 = next((c for c in GOLDEN_DECK if c["id"] == "m1"), None)
    if not m1 or "أ² + ب² = ج²" not in (m1.get("line_concept") or m1.get("back") or ""):
        errors.append("m1 pythagoras content changed unexpectedly")
    for c in GOLDEN_DECK:
        blob = " ".join(
            [
                c.get("back") or "",
                c.get("line_title") or "",
                c.get("line_concept") or "",
                c.get("line_example") or "",
            ]
        )
        if re.search(r"[0-9]", blob):
            errors.append(f"western digit in golden {c['id']}")

    try:
        proc = subprocess.run(
            ["node", "-e", NODE_SMOKE],
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
        if proc.returncode != 0:
            errors.append("node smoke failed: " + (proc.stderr or proc.stdout or "")[:400])
        else:
            print(proc.stdout.strip())
    except FileNotFoundError:
        errors.append("node not available")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK", {"golden": len(GOLDEN_DECK), "m1": m1["back"][:40]})
    return 0


if __name__ == "__main__":
    sys.exit(main())
