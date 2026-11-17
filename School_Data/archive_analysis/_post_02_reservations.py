# -*- coding: utf-8 -*-
"""التحفظات الثلاثة بعد خ2 — يتيمة · توزيع مجموعات · عيّنة 30."""
from __future__ import annotations

import csv
import random
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

OUT = Path(__file__).resolve().parent
INV = OUT / "01_inventory.csv"
DUP = OUT / "02_duplicates.csv"
GRP = OUT / "02_groups.csv"
RUN = OUT / "02_run_log.md"
REP = OUT / "02_duplicates_report.md"
DEC = OUT / "decisions_log.md"

random.seed(1059)  # عيّنة قابلة لإعادة الإنتاج


def main() -> None:
    inv = [r for r in csv.DictReader(INV.open(encoding="utf-8-sig")) if r.get("layer") == "operational"]
    dups = list(csv.DictReader(DUP.open(encoding="utf-8-sig")))
    groups = list(csv.DictReader(GRP.open(encoding="utf-8-sig")))

    all_ops = {r["رقم"] for r in inv}
    by_num = {r["رقم"]: r for r in inv}

    # عضوية المجموعات
    member_to_groups: dict[str, list[str]] = defaultdict(list)
    for g in groups:
        gid = g["group_id"]
        for m in g["الأعضاء"].split(";"):
            m = m.strip()
            if m:
                member_to_groups[m].append(gid)

    in_any = set(member_to_groups)
    orphans = sorted(all_ops - in_any, key=lambda x: int(x))
    one_group = sorted([m for m, gs in member_to_groups.items() if len(gs) == 1], key=lambda x: int(x))
    multi_group = sorted([m for m, gs in member_to_groups.items() if len(gs) > 1], key=lambda x: int(x))

    # ملاحظة: Union-Find يعطي مجموعة واحدة لكل عنصر — multi_group غالباً 0
    # احسب أيضاً: كم عنصر ظهر في زوج واحد على الأقل فوق العتبة
    in_pair = set()
    for r in dups:
        in_pair.add(r["رقم_أ"])
        in_pair.add(r["رقم_ب"])
    pair_orphans = sorted(all_ops - in_pair, key=lambda x: int(x))

    # توزيع المجموعات
    dist_lines = [
        "",
        "## التحفظ 1 و2 و3 — إضافات ما بعد التسليم",
        f"### التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "### التحفظ 1 — اليتيمة والتغطية",
        "",
        f"| البند | العدد | النسبة من 560 |",
        f"|---|---:|---:|",
        f"| عناصر operational | {len(all_ops)} | 100% |",
        f"| ممثلة في مجموعة (≥1 زوج فوق العتبة ومترابطة) | {len(in_any)} | {100*len(in_any)/len(all_ops):.1f}% |",
        f"| يتيمة (لا مجموعة) | {len(orphans)} | {100*len(orphans)/len(all_ops):.1f}% |",
        f"| في مجموعة واحدة فقط | {len(one_group)} | {100*len(one_group)/len(all_ops):.1f}% |",
        f"| في أكثر من مجموعة | {len(multi_group)} | {100*len(multi_group)/len(all_ops):.1f}% |",
        f"| ظهرت في زوج واحد على الأقل فوق العتبة | {len(in_pair)} | {100*len(in_pair)/len(all_ops):.1f}% |",
        f"| بلا أي زوج فوق العتبة | {len(pair_orphans)} | {100*len(pair_orphans)/len(all_ops):.1f}% |",
        "",
        "> توضيح: التجميع بـ Union-Find يضع كل عنصر في جذر واحد؛ لذا «أكثر من مجموعة» عادة 0. المقياس الأصدق لليتيمة هو **بلا أي زوج فوق العتبة**.",
        f"> تغطية المجموعات: **{len(in_any)}/{len(all_ops)}** — الـ37 مجموعة لا تشمل كل الأرشيف.",
        "",
    ]

    # عيّنة 30
    by_rec = defaultdict(list)
    for r in dups:
        by_rec[r["توصية"]].append(r)

    sample_lines = [
        "### التحفظ 3 — عيّنة عشوائية قابلة لإعادة الإنتاج (seed=1059)",
        "",
        "| # | pair_id | النموذج أ | النموذج ب | درجة | بوابة | توصية | reason |",
        "|---:|---|---|---|---:|---|---|---|",
    ]
    n = 0
    for rec in ("دمج_مرشّح", "مراجعة_بشرية", "أجزاء_ملف_واحد"):
        pool = list(by_rec.get(rec, []))
        take = min(10, len(pool))
        sample = random.sample(pool, take) if take else []
        sample_lines.append(f"| | | **عيّنة {rec}** ({take}/{len(pool)}) | | | | | |")
        for r in sample:
            n += 1
            sample_lines.append(
                f"| {n} | {r['pair_id']} | {r['عنوان_أ'][:42]} | {r['عنوان_ب'][:42]} | "
                f"{r['درجة_نصية']} | {r['بوابة_تشغيلية']} | {r['توصية']} | {r.get('reason','')[:70]} |"
            )
    sample_lines.append("")

    # شرح الفرق دمج vs مراجعة
    explain = [
        "### توضيح الفرق: دمج_مرشّح vs مراجعة_بشرية",
        "- **دمج_مرشّح**: درجة نصية ≥90% **و** بوابة تشغيلية pass — يُرجَّح أنهما نفس النموذج (غالباً عنوان متطابق مكرر). ما زال يحتاج اعتماداً بشرياً؛ ليس دمجاً منفّذاً.",
        "- **مراجعة_بشرية**: درجة 70–89% وبوابة pass — تشابه قوي لكن غير حاسم؛ المنهج **لا يستطيع الحكم** بالدمج دون تدخل بشري (وليس «لم يُحسم تقنياً بالخطأ»).",
        "- **same_template?**: لم يظهر في هذه الجولة (قرار 18).",
        "",
    ]

    # تحديث run_log
    run_text = RUN.read_text(encoding="utf-8")
    if "التحفظ 1 و2 و3" not in run_text:
        RUN.write_text(run_text.rstrip() + "\n" + "\n".join(dist_lines + explain + sample_lines), encoding="utf-8")
    else:
        # استبدال القسم إن وُجد
        head = run_text.split("## التحفظ 1 و2 و3")[0].rstrip()
        RUN.write_text(head + "\n" + "\n".join(dist_lines + explain + sample_lines), encoding="utf-8")

    # جدول توزيع المجموعات للتقرير
    table = [
        "",
        "## التحفظ 2 — جدول توزيع المجموعات (37)",
        "",
        "| المجموعة | الحجم | النوع السائد | التوصية السائدة | ملاحظة خلط أنواع |",
        "|---|---:|---|---|---|",
    ]
    mixed = []
    for g in sorted(groups, key=lambda x: -int(x["size"])):
        members = [m.strip() for m in g["الأعضاء"].split(";") if m.strip()]
        kinds = Counter((by_num.get(m, {}).get("النوع") or "?") for m in members)
        dominant = kinds.most_common(1)[0][0] if kinds else "?"
        mix = "نعم — " + ",".join(f"{k}:{v}" for k, v in kinds.most_common()) if len(kinds) > 1 else "لا"
        if len(kinds) > 1:
            mixed.append((g, kinds, dominant))
        table.append(
            f"| {g['group_id']} | {g['size']} | {dominant} | {g['توصية_المجموعة']} | {mix} |"
        )

    table += [
        "",
        f"### مجموعات بخلط أنواع (تحتاج مراجعة فورية): **{len(mixed)}**",
        "",
    ]
    for g, kinds, dominant in mixed[:15]:
        table.append(
            f"- **{g['group_id']}** حجم {g['size']} — أنواع: "
            + ", ".join(f"{k}={v}" for k, v in kinds.most_common())
            + f" — عينة: {g['عناوين_عينة'][:100]}"
        )
    if not mixed:
        table.append("- لا مجموعات بخلط أنواع في هذه الجولة.")

    table += [
        "",
        "### المجموعات الخمس الكبرى (شرح)",
        "",
    ]
    for g in sorted(groups, key=lambda x: -int(x["size"]))[:5]:
        members = [m.strip() for m in g["الأعضاء"].split(";") if m.strip()]
        kinds = Counter((by_num.get(m, {}).get("النوع") or "?") for m in members)
        table.append(f"#### {g['group_id']} — حجم {g['size']} — متوسط {g['متوسط_الدرجة']} — {g['توصية_المجموعة']}")
        table.append(f"- النوع السائد: {kinds.most_common(1)[0]}")
        table.append(f"- عينة العناوين: {g['عناوين_عينة']}")
        table.append(f"- قراءة: مجموعة تشابه هيكلي/عنواني داخل عائلة «{kinds.most_common(1)[0][0]}»؛ ليست دمجاً آلياً.")
        table.append("")

    table += [
        "### تغطية",
        f"- عناصر في مجموعات: **{len(in_any)}** · يتيمة بلا مجموعة: **{len(orphans)}** · بلا زوج فوق العتبة: **{len(pair_orphans)}**",
        "",
    ]

    rep = REP.read_text(encoding="utf-8")
    marker = "## التحفظ 2 — جدول توزيع المجموعات"
    if marker in rep:
        rep = rep.split(marker)[0].rstrip()
    REP.write_text(rep + "\n" + "\n".join(table), encoding="utf-8")

    # قرارات 17-20
    dec = DEC.read_text(encoding="utf-8")
    block = f"""
### [قرار 17] اعتماد مبدئي لخ2 مشروطاً — {datetime.now().strftime('%Y-%m-%d')}.
مشروط بإضافة: أرقام اليتيمة؛ جدول توزيع المجموعات؛ عيّنة 30 زوجاً. نُفّذت في 02_run_log.md و02_duplicates_report.md.

### [قرار 18] صفر same_template? لا يعني نجاح مبدأ نصي≠تشغيلي.
يعني أن المبدأ **لم يُختبر بعد** في هذه الجولة (الأزواج فوق العتبة كانت متجانسة نوعياً). يُختبر بعمق في خ9 عند تحليل المجموعات.

### [قرار 19] أولوية مادة التوحيد عند خ9.
خ9 تبدأ بمراجعة الـ24 دمج_مرشّح والـ120 أجزاء_ملف_واحد. الـ297 مراجعة_بشرية تُؤجل لمراجعة أعمق في خ9. (لا فتح لخ9 الآن إن بقي ترتيب الخوارزميات كما هو.)

### [قرار 20] لا فتح خ3 قبل استلام التحفظات الثلاثة والتحقق منها واعتماد خ2 نهائياً.

"""
    if "[قرار 17]" not in dec:
        # أدرج قبل فرضية س4 أو في نهاية قرارات الاعتماد
        if "## فرضية مسجّلة" in dec:
            dec = dec.replace("## فرضية مسجّلة", block + "## فرضية مسجّلة")
        else:
            dec += block
        DEC.write_text(dec, encoding="utf-8")

    print(
        {
            "ops": len(all_ops),
            "in_groups": len(in_any),
            "orphans_no_group": len(orphans),
            "one_group": len(one_group),
            "multi_group": len(multi_group),
            "in_pair": len(in_pair),
            "no_pair": len(pair_orphans),
            "mixed_groups": len(mixed),
            "groups": len(groups),
        }
    )


if __name__ == "__main__":
    main()
