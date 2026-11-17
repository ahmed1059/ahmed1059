# -*- coding: utf-8 -*-
"""الخوارزمية 3 — استخراج المؤشرات وفق بطاقة القبول (8 بنود)."""
from __future__ import annotations

import csv
import random
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from config import OUTPUT_DIR as OUT, get_archive_path

CSV_INV = OUT / "01_inventory.csv"
SOURCE = get_archive_path()
EXT_DIR = OUT / "external_sources"
RUN = OUT / "03_run_log.md"
OUT_CSV = OUT / "03_indicators.csv"
REPORT = OUT / "03_indicators_report.md"
MISSING = OUT / "03_missing_indicators.md"
SAMPLE = OUT / "03_sample_15.md"

IND_RE = re.compile(r"(?<!\d)(\d{1,2}-\d{1,2}-\d{1,2}-\d{1,2})(?!\d)")
FOOTER_MARKERS = ("شواهد التقويم المدرسي", "في التقويم المدرسي")

# ربط موضوعي محافظ — فقط إلى رموز ظهرت في explicit_indicator_real
# (لا اختراع رموز جديدة)
# قواعد ضيّقة: عبارات مميزة (≥2 تطابقات إلزامي في theme_infer) — لا كلمات عامة مثل «الأسرة»/«تقويم»
THEME_RULES: list[tuple[str, list[str], str]] = [
    ("1-2-1-1", ["سجل الغياب", "التأخر الصباحي", "حصر الحضور والغياب", "الانضباط المدرسي"], "انضباط/مواظبة"),
    ("1-3-1-1", ["مجلس أولياء الأمور", "مجالس أولياء الأمور"], "مجالس أولياء"),
    ("1-3-1-2", ["التواصل الأسري", "تزويد الأسرة بالمعلومات", "خطة التواصل الأسري"], "تواصل أسري"),
    ("1-3-1-3", ["العمل التطوعي", "الشراكة المجتمعية", "التقرير الختامي السنوي للعمل التطوعي"], "شراكة/تطوع"),
    ("1-4-1-1", ["الاحتياجات التدريبية", "تحليل الاحتياجات التدريبية"], "احتياج تدريبي"),
    ("1-4-1-2", ["خطة التطوير المهني", "البحوث الإجرائية", "التحاق المنسوبين بالبرامج"], "تطوير مهني"),
    ("2-1-1-2", ["تنفيذ المناهج", "متابعة تنفيذ المناهج", "تغطية المقرر"], "مناهج"),
    ("2-1-1-5", ["استراتيجية تعليمية", "تقرير تنفيذ استراتيجية"], "استراتيجية تدريس"),
    ("2-2-1-1", ["إتمام المقرر الدراسي", "سجل التقويم والاختبارات"], "تقويم مقرر"),
    ("2-2-1-3", ["تحليل نتائج المهارات", "تحليل نتائج"], "تحليل نتائج"),
    ("2-2-1-4", ["الاختبار التحصيلي", "نافس", "القدرات والتحصيلي"], "تحصيلي/نافس"),
    ("3-2-1-4", ["وكيل المدرسة للشؤون التعليمية", "الشؤون التعليمية وهدفه"], "وكيل تعليمية"),
]

random.seed(1059)
log_lines: list[str] = []


def log(step: str, detail: str = "") -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_lines.append(f"| {ts} | {step} | {detail.replace('|', '/')} |")
    print(step, (detail or "")[:140])


def flush_log(extra: str = "") -> None:
    RUN.write_text(
        "\n".join(
            [
                "# 03_run_log — سجل تنفيذ الخوارزمية 3",
                f"## بدء: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                "",
                "| الوقت | الخطوة | المخرج / القرار |",
                "|---|---|---|",
            ]
            + log_lines
        )
        + "\n"
        + extra
        + "\n",
        encoding="utf-8",
    )


def is_footer_line(ln: str) -> bool:
    return any(m in ln for m in FOOTER_MARKERS) or ln.strip().startswith("المؤشر:")


def load_blocks(rows: list[dict]) -> dict[str, str]:
    lines = SOURCE.read_text(encoding="utf-8", errors="replace").splitlines()
    arch = [
        r
        for r in rows
        if (r.get("source") or "archive_txt") == "archive_txt" and str(r.get("سطر_البداية") or "").strip()
    ]
    starts = sorted(int(r["سطر_البداية"]) for r in arch)
    blocks: dict[str, str] = {}
    for r in arch:
        start = int(r["سطر_البداية"])
        i = starts.index(start)
        end = starts[i + 1] if i + 1 < len(starts) else len(lines) + 1
        blocks[r["رقم"]] = "\n".join(lines[start - 1 : end - 1])
    # external: full file snippets by title
    files = {p.stem: p.read_text(encoding="utf-8", errors="replace") for p in EXT_DIR.glob("*.txt")}
    for r in rows:
        if (r.get("source") or "") == "archive_txt":
            continue
        title = r["العنوان"]
        key = None
        if "موهوب" in title or "منسق" in title:
            key = next((k for k in files if "موهوب" in k or "منسق" in k), None)
        elif "أداء" in title or "وظيف" in title:
            key = next((k for k in files if "أداء" in k or "وظيف" in k), None)
        elif "توجيه" in title:
            key = next((k for k in files if "توجيه" in k), None)
        full = files.get(key or "", title)
        idx = full.find(title[:18]) if len(title) >= 12 else -1
        blocks[r["رقم"]] = full[idx : idx + 4000] if idx >= 0 else full[:3000]
    return blocks


def approved_codes(rows: list[dict]) -> set[str]:
    codes: set[str] = set()
    for r in rows:
        v = (r.get("explicit_indicator_real") or "").strip()
        for c in v.split(";"):
            if c.strip():
                codes.add(c.strip())
    return codes


def scan_codes(text: str) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """returns (non_footer hits with line), (footer hits with line)"""
    non_f, foot = [], []
    for ln in text.splitlines():
        found = IND_RE.findall(ln)
        if not found:
            continue
        for c in found:
            if is_footer_line(ln):
                foot.append((c, ln.strip()[:120]))
            else:
                non_f.append((c, ln.strip()[:120]))
    return non_f, foot


def theme_infer(text: str, title: str, approved: set[str]) -> list[dict]:
    """استنتاج محافظ — لا رموز خارج approved؛ دليل اقتباس مطلوب."""
    blob = title + "\n" + text
    hits = []
    for code, keys, why in THEME_RULES:
        if code not in approved:
            continue
        matched = [k for k in keys if k in blob]
        # متطلب صارم: مفتاحان على الأقل، أو مفتاح واحد طويل (≥10) يظهر في العنوان
        if len(matched) >= 2:
            pass
        elif len(matched) == 1 and matched[0] in title and len(matched[0]) >= 10:
            pass
        else:
            continue
        # اقتباس: أول سطر يحتوي أحد المفاتيح
        evidence = ""
        for ln in blob.splitlines():
            if any(k in ln for k in matched):
                evidence = ln.strip()[:160]
                break
        if not evidence:
            continue
        conf = "medium" if len(matched) >= 2 else "low"
        hits.append(
            {
                "code": code,
                "matched": matched,
                "why": why,
                "evidence": evidence,
                "confidence": conf,
            }
        )
    # لا تفرط: أقصى مؤشرين مستنتجين لكل نموذج
    hits.sort(key=lambda h: (0 if h["confidence"] == "medium" else 1, -len(h["matched"])))
    return hits[:2]


def main() -> None:
    log("بدء خ3", "قرار 34 — بطاقة 8 بنود")
    rows = list(csv.DictReader(CSV_INV.open(encoding="utf-8-sig")))
    ops = [r for r in rows if r.get("layer") == "operational"]
    approved = approved_codes(ops)
    log("رموز real المعتمدة", f"صفوف_بها_real=21 · رموز_فريدة={len(approved)} · {sorted(approved)}")

    blocks = load_blocks(rows)
    log("تحميل النصوص", f"blocks={len(blocks)}")

    out_rows = []
    missing_events = []  # code not in approved
    indicator_to_forms: dict[str, list[str]] = defaultdict(list)
    coverage = Counter()
    orphan_indicators_check: dict[str, int] = {c: 0 for c in approved}

    for r in ops:
        num = r["رقم"]
        title = r["العنوان"]
        text = blocks.get(num, "")
        real_raw = (r.get("explicit_indicator_real") or "").strip()
        real_codes = [c.strip() for c in real_raw.split(";") if c.strip()]

        link_source = "لا يوجد"
        codes: list[str] = []
        inferred = False
        confidence = ""
        evidence = ""
        reason = ""
        needs_human = False

        if real_codes:
            link_source = "real"
            codes = real_codes
            inferred = False
            confidence = "high"
            evidence = f"من عمود explicit_indicator_real: {';'.join(real_codes)}"
            reason = "مؤشر صريح في سياق تشغيلي/حقلي (غير تذييل فقط)"
            needs_human = False
            coverage["real"] += 1
        else:
            non_f, foot = scan_codes(text)
            # رموز في غير تذييل وتنتمي للمعتمدة → مضمون حرفي (ليس raw)
            content_approved = [(c, ln) for c, ln in non_f if c in approved]
            # رموز غير معتمدة (من أي سياق) → missing
            for c, ln in non_f + foot:
                if c not in approved:
                    missing_events.append(
                        {
                            "form_id": num,
                            "title": title,
                            "code": c,
                            "context": "footer" if (c, ln) in foot or is_footer_line(ln) else "body",
                            "evidence": ln,
                        }
                    )

            if content_approved:
                # تجميع فريد
                uniq = []
                seen = set()
                ev_parts = []
                for c, ln in content_approved:
                    if c not in seen:
                        seen.add(c)
                        uniq.append(c)
                        ev_parts.append(ln)
                link_source = "مضمون"
                codes = uniq
                inferred = False  # مذكور حرفياً في المضمون غير التذييل
                confidence = "medium"
                evidence = " | ".join(ev_parts[:2])
                reason = "رمز مؤشر معتمد ظهر في متن غير تذييلي (ليس من عمود real)"
                needs_human = True
                coverage["مضمون_حرفي"] += 1
            else:
                themes = theme_infer(text, title, approved)
                if themes:
                    link_source = "مضمون"
                    codes = [t["code"] for t in themes]
                    inferred = True
                    confidence = themes[0]["confidence"]
                    if any(t["confidence"] == "low" for t in themes):
                        confidence = "low"
                    evidence = " || ".join(t["evidence"] for t in themes)
                    reason = "؛ ".join(f"{t['code']}:{t['why']} ({','.join(t['matched'])})" for t in themes)
                    needs_human = True
                    coverage["مضمون_مستنتج"] += 1
                else:
                    link_source = "لا يوجد"
                    codes = []
                    inferred = False
                    confidence = ""
                    evidence = ""
                    reason = "لا مؤشر real ولا إشارة مضمون كافية — بدون استنتاج قسري"
                    needs_human = False
                    coverage["لا_يوجد"] += 1

            # حتى مع عدم الربط: سجّل مفقودات من التذييل/المتن
            if not content_approved and not real_codes:
                for c, ln in foot:
                    if c not in approved:
                        missing_events.append(
                            {
                                "form_id": num,
                                "title": title,
                                "code": c,
                                "context": "footer",
                                "evidence": ln,
                            }
                        )

        for c in codes:
            indicator_to_forms[c].append(num)
            if c in orphan_indicators_check:
                orphan_indicators_check[c] += 1

        # تعارض بسيط: أكثر من 3 رموز مختلفة على نفس النموذج
        conflict = ""
        if len(codes) > 3:
            conflict = "too_many_indicators"
            needs_human = True

        out_rows.append(
            {
                "form_id": num,
                "العنوان": title,
                "النوع": r.get("النوع") or "",
                "source_file": r.get("source") or "archive_txt",
                "indicators": ";".join(codes),
                "link_source": link_source,  # real / مضمون / لا يوجد
                "inferred": "true" if inferred else "false",
                "confidence": confidence,
                "evidence": evidence,
                "reason": reason,
                "needs_human_review": "true" if needs_human or (inferred and confidence == "low") else "false",
                "conflict_flag": conflict,
            }
        )

    # صفوف بها real فقط عُدّت؛ أعد تغطية أوضح
    n_real = sum(1 for r in out_rows if r["link_source"] == "real")
    n_madmun = sum(1 for r in out_rows if r["link_source"] == "مضمون")
    n_none = sum(1 for r in out_rows if r["link_source"] == "لا يوجد")
    n_inferred = sum(1 for r in out_rows if r["inferred"] == "true")

    log(
        "تصنيف الربط",
        f"real={n_real} مضمون={n_madmun} (منها مستنتج={n_inferred}) لا_يوجد={n_none} total={len(out_rows)}",
    )

    # يتيمة المؤشر: معتمدة بلا أي نموذج
    orphan_inds = sorted([c for c, n in orphan_indicators_check.items() if n == 0])
    # نماذج بتعارض
    conflicts = [r for r in out_rows if r["conflict_flag"]]

    fields = list(out_rows[0].keys())
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as h:
        w = csv.DictWriter(h, fieldnames=fields)
        w.writeheader()
        w.writerows(out_rows)
    log("كتابة 03_indicators.csv", f"rows={len(out_rows)}")

    # missing unique
    miss_by_code: dict[str, list] = defaultdict(list)
    for ev in missing_events:
        miss_by_code[ev["code"]].append(ev)
    miss_lines = [
        "# 03_missing_indicators — مؤشرات مذكورة وغير منتمية لمجموعة real المعتمدة",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"## الرموز المعتمدة (من explicit_indicator_real): {len(approved)} → `{', '.join(sorted(approved))}`",
        f"## رموز مفقودة فريدة: **{len(miss_by_code)}**",
        "",
        "> هذه الرموز **لا تُستخدم للربط**. توثيق فقط (بند 8).",
        "",
        "| الرمز | مرات الظهور | أمثلة نماذج | سياق | اقتباس |",
        "|---|---:|---|---|---|",
    ]
    for code, evs in sorted(miss_by_code.items(), key=lambda x: -len(x[1])):
        examples = ", ".join(f"{e['form_id']}:{e['title'][:28]}" for e in evs[:3])
        ctx = Counter(e["context"] for e in evs).most_common(1)[0][0]
        miss_lines.append(
            f"| `{code}` | {len(evs)} | {examples} | {ctx} | {evs[0]['evidence'][:80]} |"
        )
    if not miss_by_code:
        miss_lines.append("| — | 0 | — | — | لا رموز خارج المجموعة المعتمدة في هذا المسح |")
    MISSING.write_text("\n".join(miss_lines) + "\n", encoding="utf-8")
    log("كتابة missing", f"unique_missing={len(miss_by_code)}")

    # عيّنة 15
    by_src = defaultdict(list)
    for r in out_rows:
        by_src[r["link_source"]].append(r)
    sample_rows = []
    for key, need in (("real", 5), ("مضمون", 5), ("لا يوجد", 5)):
        pool = by_src.get(key, [])
        take = min(need, len(pool))
        sample_rows.extend(random.sample(pool, take) if take else [])
    sample_md = [
        "# 03_sample_15 — عيّنة مراجعة (seed=1059)",
        "",
        "| # | form_id | العنوان | link_source | indicators | inferred | confidence | needs_human_review | reason |",
        "|---:|---|---|---|---|---|---|---|---|",
    ]
    for i, r in enumerate(sample_rows, 1):
        sample_md.append(
            f"| {i} | {r['form_id']} | {r['العنوان'][:40]} | {r['link_source']} | {r['indicators'][:40]} | "
            f"{r['inferred']} | {r['confidence']} | {r['needs_human_review']} | {r['reason'][:70]} |"
        )
    SAMPLE.write_text("\n".join(sample_md) + "\n", encoding="utf-8")
    log("عيّنة 15", f"n={len(sample_rows)}")

    # تقرير
    uniq_table = []
    for code in sorted(approved):
        forms = indicator_to_forms.get(code, [])
        examples = []
        for fid in forms[:3]:
            title = next((r["العنوان"] for r in out_rows if r["form_id"] == fid), "")
            examples.append(f"{fid}:{title[:30]}")
        uniq_table.append((code, len(forms), examples))

    report = [
        "# 03_indicators_report — تقرير الخوارزمية 3",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "## الحالة: مُسلَّم للمراجعة — لا خ4",
        "",
        "## ملخص تنفيذي",
        f"- دُرست **{len(ops)}** عنصراً تشغيلياً (يشمل external).",
        f"- صفوف `explicit_indicator_real` غير الفارغة: **21** · رموز فريدة معتمدة للربط: **{len(approved)}** (ليست 21 رمزاً بل 21 صفاً).",
        f"- ربط `real`: **{n_real}** · `مضمون`: **{n_madmun}** (منها مستنتج موضوعي `inferred=true`: **{n_inferred}**) · `لا يوجد`: **{n_none}** ({100*n_none/len(ops):.1f}%).",
        f"- مؤشرات معتمدة بلا أي نموذج مرتبط بعد المسح: **{len(orphan_inds)}** → {orphan_inds or 'لا يوجد'}.",
        f"- رموز مذكورة في الأرشيف وخارج المجموعة المعتمدة: **{len(miss_by_code)}** (انظر 03_missing_indicators.md).",
        "- لم يُستخدم `explicit_indicator_raw` للربط. المستنتج يحتاج مراجعة بشرية (`needs_human_review`).",
        "",
        "## المنهجية",
        "1. `real` ← عمود explicit_indicator_real فقط.",
        "2. `مضمون` حرفي ← رمز معتمد في متن غير تذييلي.",
        "3. `مضمون` مستنتج ← قواعد موضوعية محافظة (≥2 مفاتيح أو مفتاح في العنوان) + اقتباس؛ أقصى رمزين؛ لا رموز خارج المعتمدة.",
        "4. خلاف ذلك → `لا يوجد` دون استنتاج قسري.",
        "5. أي رمز خارج المعتمدة → توثيق في missing فقط.",
        "",
        "## إحصاء التغطية (من 560)",
        "| الفئة | العدد | % |",
        "|---|---:|---:|",
        f"| real | {n_real} | {100*n_real/len(ops):.1f}% |",
        f"| مضمون (حرفي+مستنتج) | {n_madmun} | {100*n_madmun/len(ops):.1f}% |",
        f"| لا يوجد | {n_none} | {100*n_none/len(ops):.1f}% |",
        f"| inferred=true | {n_inferred} | {100*n_inferred/len(ops):.1f}% |",
        f"| needs_human_review=true | {sum(1 for r in out_rows if r['needs_human_review']=='true')} | — |",
        "",
        "## المؤشرات المعتمدة — عدد النماذج المرتبطة",
        "",
        "| الرمز | عدد النماذج | أمثلة |",
        "|---|---:|---|",
    ]
    for code, n, ex in uniq_table:
        report.append(f"| `{code}` | {n} | {'; '.join(ex) if ex else '— يتيم'} |")

    report += [
        "",
        "## يتيمة المؤشر (معتمدة بلا نموذج)",
        (", ".join(f"`{c}`" for c in orphan_inds) if orphan_inds else "لا يوجد بعد احتساب real+مضمون."),
        "",
        f"## تعارضات (أكثر من 3 رموز على نموذج): {len(conflicts)}",
        "",
        "## توصيات لخ4",
        "1. مراجعة بشرية لكل `inferred=true` وخصوصاً `confidence=low`.",
        "2. الـ410 اليتيمة في خ2 + غير المربوطة بمؤشر هنا = أولوية لبطاقات المهام لاحقاً بحذر.",
        "3. لا بناء واجهة «مؤشر» على raw أو على missing.",
        "4. المسار الفرعي لتوحيد الـ24 (قرار 24) يمكن أن يستفيد من عمود المؤشرات بعد اعتمادكم للربط.",
        "",
        "## حدود",
        "- الاستنتاج الموضوعي محافظ وقد يفوّت روابط صحيحة؛ الأفضل من الربط الزائف.",
        "- 21 صفاً ≠ 21 رمزاً؛ المعتمد للربط هو مجموعة الرموز الفريدة من real.",
        "",
    ]
    REPORT.write_text("\n".join(report) + "\n", encoding="utf-8")
    log("كتابة التقرير", REPORT.name)
    log("انتهاء خ3", "بانتظار مراجعة رئيس المشروع — لا خ4")
    flush_log(
        f"\n## خلاصة\n- approved_codes={len(approved)}\n"
        f"- real={n_real} madmun={n_madmun} none={n_none} inferred={n_inferred}\n"
        f"- missing_unique={len(miss_by_code)} orphan_approved={orphan_inds}\n"
    )


if __name__ == "__main__":
    main()
