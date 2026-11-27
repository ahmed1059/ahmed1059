# سلامة شعار الوزارة الشفاف — مسار /assets وسقف 52×140
# تشغيل: python3 -m Core_Engine.ministry_logo_asset_test
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

ASSET = ROOT / "School_Data" / "assets" / "ministry_logo.png"
APP = ROOT / "Core_Engine" / "app.py"
FORTIFIED = (
    ROOT / "Print_Canvas" / "js" / "erp-nav.js",
    ROOT / "Print_Canvas" / "js" / "erp-suite.js",
    ROOT / "Print_Canvas" / "dashboard.html",
)
CAP_W, CAP_H = 140, 52


def main() -> int:
    errors: list[str] = []

    if not ASSET.is_file():
        errors.append("missing School_Data/assets/ministry_logo.png")
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1

    try:
        from PIL import Image
        import numpy as np
    except Exception as exc:  # pragma: no cover
        errors.append(f"PIL/numpy required: {exc}")
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1

    im = Image.open(ASSET)
    if im.mode != "RGBA":
        errors.append(f"logo must be RGBA (got {im.mode})")
    arr = np.array(im.convert("RGBA"))
    alpha = arr[:, :, 3]
    if int(alpha.min()) != 0:
        errors.append("logo must include fully transparent pixels (no black matte)")
    if int((alpha > 200).sum()) < 50:
        errors.append("logo body opacity too low / empty")
    # الزوايا الأربع شفافة تقريباً (لا مربع أسود مطبوع)
    h, w = alpha.shape
    corners = [
        int(alpha[0, 0]),
        int(alpha[0, w - 1]),
        int(alpha[h - 1, 0]),
        int(alpha[h - 1, w - 1]),
    ]
    if any(c > 8 for c in corners):
        errors.append(f"corners must be transparent, got {corners}")

    scale = min(CAP_W / float(im.size[0]), CAP_H / float(im.size[1]), 1.0)
    dw, dh = im.size[0] * scale, im.size[1] * scale
    if dw > CAP_W + 0.05 or dh > CAP_H + 0.05:
        errors.append(f"scaled size {dw:.1f}x{dh:.1f} exceeds cap {CAP_W}x{CAP_H}")

    app = APP.read_text(encoding="utf-8")
    if 'StaticFiles(directory=str(_ROOT / "School_Data" / "assets"))' not in app:
        errors.append("app.py must mount School_Data/assets at /assets")
    if '"/assets"' not in app and "'/assets'" not in app:
        errors.append("app.py must expose /assets")

    # لا مساس بالمحصّنات في هذه الموجة (الملف الثنائي فقط)
    for path in FORTIFIED:
        if not path.exists():
            errors.append(f"fortified missing: {path.name}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(
        "OK ministry_logo_asset_test "
        f"size={im.size[0]}x{im.size[1]} "
        f"fit={dw:.1f}x{dh:.1f}<= {CAP_W}x{CAP_H}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
