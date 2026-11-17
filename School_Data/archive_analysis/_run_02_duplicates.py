# -*- coding: utf-8 -*-
"""الخوارزمية 2 — كشف التكرار وفق 02_method.md المعتمد."""
from __future__ import annotations

import csv
import json
import re
import time
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path

from config import OUTPUT_DIR as OUT, get_archive_path

CSV_PATH = OUT / "01_inventory.csv"
SOURCE_TXT = get_archive_path()
EXT_DIR = OUT / "external_sources"
RUN_LOG = OUT / "02_run_log.md"
DUP_CSV = OUT / "02_duplicates.csv"
GRP_CSV = OUT / "02_groups.csv"
REPORT = OUT / "02_duplicates_report.md"
CACHE = OUT / "_02_blocks_cache.json"

NOISE = [
    "أكتب هنا خيار إضافي",
    "أكتب خيارات إضافية",
    "اكتب هنا",
    "أكتب هنا",
    "لخّص الغاية",
    "لخص الغاية",
    "اذكر الأهداف",
    "اذكر عناصر",
    "وضح الغاية",
    "ّلم يتمّ اختيار أيّ ملفّ",
    "لم يتم اختيار أي ملف",
    "ضع رابط الشواهد",
    "إضافة شواهد (صور)",
    "أقصى حد للشواهد",
    "ضغط الشواهد",
    "شواهد التقويم المدرسي",
    "محاولة تصغير الشواهد للحصول على صفحة واحدة",
]

SHARP_PAIRS = {
    frozenset(p)
    for p in [
        ("محضر", "تقرير"),
        ("محضر", "سجل"),
        ("محضر", "كشف"),
        ("محضر", "خطة"),
        ("محضر", "استمارة"),
        ("قرار", "سجل"),
        ("قرار", "تقرير"),
        ("قرار", "كشف"),
        ("قرار", "خطة"),
        ("خطاب", "كشف"),
        ("خطاب", "سجل"),
        ("خطاب", "خطة"),
        ("بطاقة", "خطة"),
        ("بطاقة", "سجل"),
        ("بطاقة", "كشف"),
        ("كشف", "خطة"),
        ("استبانة", "محضر"),
        ("استبانة", "قرار"),
        ("استبانة", "خطاب"),
    ]
}

FLOW_COMMITTEE = re.compile(r"حاضر|حضور|تصويت|اعتماد اللجنة|محضر اجتماع|أعضاء اللجنة|التوقيعات")
FLOW_ACTIVITY = re.compile(r"فكرة المبادرة|أهداف المبادرة|آلية التنفيذ|الأنشطة|وصف البرنامج")

log_lines: list[str] = []


def log(step: str, detail: str = "") -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"| {ts} | {step} | {detail.replace('|', '/')} |"
    log_lines.append(line)
    print(step, detail[:120] if detail else "")


def flush_log(extra: str = "") -> None:
    header = [
        "# 02_run_log — سجل تنفيذ الخوارزمية 2",
        f"## بدء السجل: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "| الوقت | الخطوة | المخرج / القرار |",
        "|---|---|---|",
    ]
    RUN_LOG.write_text("\n".join(header + log_lines) + "\n" + extra + "\n", encoding="utf-8")


def normalize_ar(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    text = re.sub(r"[\u064B-\u065F\u0670]", "", text)
    repl = {"أ": "ا", "إ": "ا", "آ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي"}
    for a, b in repl.items():
        text = text.replace(a, b)
    text = re.sub(r"[^\w\s\u0600-\u06ff]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def strip_noise(text: str) -> str:
    out = text
    for n in NOISE:
        out = out.replace(n, " ")
    return out


def ratio(a: str, b: str) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def extract_fields(text: str) -> set[str]:
    fields: set[str] = set()
    for ln in text.splitlines():
        s = ln.strip()
        if not s or len(s) > 60:
            continue
        # تسمية حقل: قصيرة، بلا جملة طويلة
        if s.endswith(":") or s.endswith("؟") or s.endswith("?"):
            fields.add(normalize_ar(s.rstrip(":؟?")))
            continue
        if re.match(r"^[\u0600-\u06ff\s]{3,40}$", s) and " " in s and len(s.split()) <= 6:
            # عناوين فرعية شائعة
            if any(
                k in s
                for k in (
                    "اسم",
                    "تاريخ",
                    "رقم",
                    "نوع",
                    "مكان",
                    "هدف",
                    "فكرة",
                    "آلية",
                    "فئة",
                    "مدة",
                    "مؤشر",
                    "توقيع",
                    "الفصل",
                    "الصف",
                )
            ):
                fields.add(normalize_ar(s))
    return fields


def extract_table_sig(text: str) -> set[str]:
    sig: set[str] = set()
    # أسطر بفواصل جدولية أو أعمدة متكررة
    for ln in text.splitlines():
        if ln.count("|") >= 2 or ln.count("\t") >= 2:
            parts = re.split(r"[|\t]+", ln)
            for p in parts:
                p = normalize_ar(p)
                if 2 <= len(p) <= 40:
                    sig.add(p)
    # رؤوس شائعة
    for key in ("م", "اليوم", "التاريخ", "الحالة", "الطالب", "المعلم", "الدرجة", "الحضور", "الغياب"):
        if key in text:
            sig.add(normalize_ar(key))
    sig.add(f"cols:{min(20, text.count('|') // max(1, text.count(chr(10)) or 1))}")
    return sig


def content_tokens(text: str) -> set[str]:
    cleaned = normalize_ar(strip_noise(text))
    toks = [t for t in cleaned.split() if len(t) >= 3]
    return set(toks[:400])


@dataclass
class Item:
    num: str
    title: str
    kind: str
    source: str
    text: str
    real_ind: str
    title_n: str = ""
    fields: set[str] = field(default_factory=set)
    tables: set[str] = field(default_factory=set)
    content: set[str] = field(default_factory=set)

    def prepare(self) -> None:
        self.title_n = normalize_ar(self.title)
        self.fields = extract_fields(self.text)
        self.tables = extract_table_sig(self.text)
        self.content = content_tokens(self.text)


def load_rows() -> list[dict]:
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as h:
        return list(csv.DictReader(h))


def blocks_archive(rows: list[dict], lines: list[str]) -> dict[str, str]:
    arch = [r for r in rows if (r.get("source") or "archive_txt") == "archive_txt" and r.get("سطر_البداية")]
    starts = sorted(int(r["سطر_البداية"]) for r in arch)
    mapping: dict[str, str] = {}
    for r in arch:
        start = int(r["سطر_البداية"])
        i = starts.index(start)
        end = starts[i + 1] if i + 1 < len(starts) else len(lines) + 1
        mapping[r["رقم"]] = "\n".join(lines[start - 1 : end - 1])
    return mapping


def load_external_full() -> dict[str, str]:
    """خريطة تقريبية: عنوان فرعي → أفضل تطابق من ملفات external."""
    by_file: dict[str, str] = {}
    for p in EXT_DIR.glob("*.txt"):
        by_file[p.stem] = p.read_text(encoding="utf-8", errors="replace")
    return by_file


def resolve_external_text(row: dict, files: dict[str, str]) -> str:
    title = row["العنوان"]
    # اختر الملف حسب المصدر/العنوان
    if "موهوب" in title or row.get("source") == "external_docx" and "موهوب" in (row.get("العنوان") or ""):
        key = next((k for k in files if "موهوب" in k or "منسق" in k), None)
    elif "أداء" in title or "وظيف" in title:
        key = next((k for k in files if "أداء" in k or "وظيف" in k), None)
    elif "توجيه" in title or row.get("source") == "external_doc":
        key = next((k for k in files if "توجيه" in k or "خطة" in k), None)
    else:
        key = next(iter(files), None)
    full = files.get(key or "", "")
    if not full:
        return title
    # مقطع حول العنوان إن وُجد
    idx = full.find(title[:20]) if len(title) >= 10 else -1
    if idx >= 0:
        return full[idx : idx + 3500]
    # للأول من كل ملف: خذ المقدمة
    if "مصدر خارجي" in title:
        return full[:5000]
    return full[:2500]


def text_score(a: Item, b: Item) -> float:
    t = ratio(a.title_n, b.title_n)
    f = jaccard(a.fields, b.fields)
    g = jaccard(a.tables, b.tables)
    c = jaccard(a.content, b.content)
    return 100.0 * (0.20 * t + 0.40 * f + 0.15 * g + 0.25 * c)


def operational_gate(a: Item, b: Item) -> tuple[str, str, str]:
    """returns pass/fail, fail_reason, extra_tag"""
    tags = []
    ka, kb = (a.kind or "").strip(), (b.kind or "").strip()
    if ka and kb and frozenset((ka, kb)) in SHARP_PAIRS:
        return "fail", f"اختلاف نوع حاد: {ka}↔{kb}", ""
    # تدفق
    ca, cb = FLOW_COMMITTEE.search(a.text) is not None, FLOW_COMMITTEE.search(b.text) is not None
    aa, ab = FLOW_ACTIVITY.search(a.text) is not None, FLOW_ACTIVITY.search(b.text) is not None
    if (ca and ab and not cb) or (cb and aa and not ca):
        return "fail", "اختلاف تدفق (لجنة/اعتماد vs نشاط/أهداف)", ""
    ra, rb = bool((a.real_ind or "").strip()), bool((b.real_ind or "").strip())
    if ra != rb:
        tags.append("indicator_mismatch")
    # أجزاء ملف واحد
    if a.source.startswith("external") and b.source.startswith("external") and a.source == b.source:
        # نفس المصدر الخارجي — وسم لا فشل
        tags.append("أجزاء_ملف_واحد_مرشّح")
    return "pass", "", ";".join(tags)


def recommend(score: float, gate: str, tag: str, a: Item, b: Item) -> tuple[str, str, str]:
    """recommendation, reason, confidence"""
    same_ext = (
        a.source.startswith("external")
        and b.source.startswith("external")
        and a.source == b.source
    )
    if same_ext and score >= 50:
        return (
            "أجزاء_ملف_واحد",
            "عنصران من نفس الملف الخارجي يُرجَّحان أقساماً لا تكراراً عابراً للأرشيف",
            "medium",
        )
    if score >= 90 and gate == "pass":
        return (
            "دمج_مرشّح",
            f"تشابه نصي {score:.1f}% مع بوابة تشغيلية ناجحة — يُرجَّح نفس النموذج",
            "high",
        )
    if score >= 90 and gate == "fail":
        return (
            "same_template?",
            f"تشابه نصي {score:.1f}% لكن البوابة فشلت — هيكل مشترك محتمل لا دمج",
            "high",
        )
    if 70 <= score < 90 and gate == "pass":
        return (
            "مراجعة_بشرية",
            f"تشابه {score:.1f}% وبوابة ناجحة — يحتاج حكماً بشرياً",
            "medium",
        )
    if 70 <= score < 90 and gate == "fail":
        return (
            "same_template?",
            f"تشابه {score:.1f}% مع فشل تشغيلي — قالب مشترك محتمل",
            "medium",
        )
    if 50 <= score < 70:
        return (
            "same_template?",
            f"تشابه هيكلي متوسط {score:.1f}% — فرضية قالب دون دمج",
            "low",
        )
    return (
        "إبقاء_منفصل",
        f"تشابه ضعيف {score:.1f}%",
        "high",
    )


class UnionFind:
    def __init__(self) -> None:
        self.p: dict[str, str] = {}

    def find(self, x: str) -> str:
        self.p.setdefault(x, x)
        if self.p[x] != x:
            self.p[x] = self.find(self.p[x])
        return self.p[x]

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[rb] = ra


def main() -> None:
    t0 = time.time()
    log("بدء خ2", "قرار 16 — اعتماد المنهج")
    rows = load_rows()
    ops = [r for r in rows if r.get("layer") == "operational"]
    log("تحميل الجرد", f"إجمالي={len(rows)} operational={len(ops)}")

    lines = SOURCE_TXT.read_text(encoding="utf-8", errors="replace").splitlines()
    arch_blocks = blocks_archive(rows, lines)
    ext_files = load_external_full()
    log("تحميل النصوص", f"archive_blocks={len(arch_blocks)} external_files={len(ext_files)}")

    items: list[Item] = []
    for r in ops:
        num = r["رقم"]
        src = r.get("source") or "archive_txt"
        if src == "archive_txt":
            text = arch_blocks.get(num, r["العنوان"])
        else:
            text = resolve_external_text(r, ext_files)
        it = Item(
            num=num,
            title=r["العنوان"],
            kind=r.get("النوع") or "",
            source=src,
            text=text,
            real_ind=r.get("explicit_indicator_real") or "",
        )
        it.prepare()
        items.append(it)
    log("تجهيز السمات", f"items={len(items)}")

    # حفظ كاش خفيف للعناوين فقط
    CACHE.write_text(
        json.dumps(
            [{"num": i.num, "title": i.title, "kind": i.kind, "source": i.source, "fields": len(i.fields)} for i in items],
            ensure_ascii=False,
            indent=0,
        ),
        encoding="utf-8",
    )

    threshold = 70.0
    pairs_raw: list[tuple] = []
    n = len(items)
    total_comp = n * (n - 1) // 2
    log("بدء المقارنات", f"pairs_possible={total_comp} threshold_initial={threshold}")

    for i in range(n):
        if i % 50 == 0 and i:
            log("تقدم المقارنة", f"{i}/{n} elapsed={time.time()-t0:.1f}s kept={len(pairs_raw)}")
            flush_log()
        for j in range(i + 1, n):
            sc = text_score(items[i], items[j])
            if sc >= threshold:
                pairs_raw.append((sc, i, j))

    log("انتهاء المقارنة الأولية", f"pairs>={threshold}: {len(pairs_raw)}")

    if len(pairs_raw) > 2000:
        old = threshold
        threshold = 80.0
        pairs_raw = [p for p in pairs_raw if p[0] >= threshold]
        log(
            "رفع العتبة المؤقت",
            f"من {old} إلى {threshold} لأن الأزواج>{2000} سابقاً؛ المتبقي={len(pairs_raw)} (تحفظ رئيس المشروع)",
        )

    # لا توصيات قبل اكتمال التصنيف — أولاً كل الأوزان محسوبة، ثم البوابة ثم التوصية دفعة واحدة
    log("تصنيف البوابة والتوصيات", "دفعة واحدة بعد اكتمال الأزواج")
    dup_rows = []
    uf = UnionFind()
    rec_counter: Counter = Counter()
    edge_for_group = []  # pairs that connect groups: score>=threshold and not إبقاء_منفصل weak

    for idx, (sc, i, j) in enumerate(sorted(pairs_raw, key=lambda x: -x[0]), 1):
        a, b = items[i], items[j]
        gate, fail_reason, tag = operational_gate(a, b)
        rec, reason, conf = recommend(sc, gate, tag, a, b)
        if tag and "indicator_mismatch" in tag and "indicator_mismatch" not in reason:
            reason = reason + " | وسم indicator_mismatch"
        if tag and "أجزاء_ملف" in tag and rec != "أجزاء_ملف_واحد":
            # لا تغيّر التوصية إن كانت أعلى، لكن أضف الوسم في reason إن لزم
            pass
        rec_counter[rec] += 1
        pair_id = f"P{idx:05d}"
        dup_rows.append(
            {
                "pair_id": pair_id,
                "رقم_أ": a.num,
                "عنوان_أ": a.title,
                "نوع_أ": a.kind,
                "مصدر_أ": a.source,
                "رقم_ب": b.num,
                "عنوان_ب": b.title,
                "نوع_ب": b.kind,
                "مصدر_ب": b.source,
                "درجة_نصية": f"{sc:.2f}",
                "text_score": f"{sc:.2f}",
                "بوابة_تشغيلية": gate,
                "operational_gate": gate,
                "سبب_فشل_البوابة": fail_reason,
                "توصية": rec,
                "recommendation": rec,
                "reason": reason,
                "confidence": conf,
                "وسم_إضافي": tag,
            }
        )
        if rec in ("دمج_مرشّح", "مراجعة_بشرية", "same_template?", "أجزاء_ملف_واحد") and sc >= threshold:
            uf.union(a.num, b.num)
            edge_for_group.append((a.num, b.num, sc, rec))

    # مجموعات
    clusters: dict[str, list[str]] = defaultdict(list)
    for it in items:
        # فقط من ظهر في حافة
        pass
    members_in_edges = set()
    for a, b, _, _ in edge_for_group:
        members_in_edges.add(a)
        members_in_edges.add(b)
    for num in members_in_edges:
        clusters[uf.find(num)].append(num)

    by_num = {it.num: it for it in items}
    group_rows = []
    gid = 0
    for root, members in sorted(clusters.items(), key=lambda x: -len(x[1])):
        if len(members) < 2:
            continue
        gid += 1
        # متوسط درجات الحواف داخل المجموعة
        scores = [
            sc
            for a, b, sc, _ in edge_for_group
            if uf.find(a) == root and uf.find(b) == root
        ]
        recs = [
            rec
            for a, b, _, rec in edge_for_group
            if uf.find(a) == root and uf.find(b) == root
        ]
        top_rec = Counter(recs).most_common(1)[0][0] if recs else "مراجعة_بشرية"
        titles = [by_num[m].title[:40] for m in members[:8]]
        group_rows.append(
            {
                "group_id": f"G{gid:04d}",
                "size": len(members),
                "الأعضاء": ";".join(members),
                "عناوين_عينة": " | ".join(titles),
                "متوسط_الدرجة": f"{(sum(scores)/len(scores) if scores else 0):.2f}",
                "توصية_المجموعة": top_rec,
                "ملاحظات": f"أنواع:{','.join(sorted({by_num[m].kind for m in members}))}",
            }
        )

    # كتابة CSV
    dup_fields = list(dup_rows[0].keys()) if dup_rows else [
        "pair_id",
        "رقم_أ",
        "عنوان_أ",
        "نوع_أ",
        "مصدر_أ",
        "رقم_ب",
        "عنوان_ب",
        "نوع_ب",
        "مصدر_ب",
        "درجة_نصية",
        "text_score",
        "بوابة_تشغيلية",
        "operational_gate",
        "سبب_فشل_البوابة",
        "توصية",
        "recommendation",
        "reason",
        "confidence",
        "وسم_إضافي",
    ]
    with DUP_CSV.open("w", encoding="utf-8-sig", newline="") as h:
        w = csv.DictWriter(h, fieldnames=dup_fields)
        w.writeheader()
        for row in dup_rows:
            w.writerow(row)

    grp_fields = [
        "group_id",
        "size",
        "الأعضاء",
        "عناوين_عينة",
        "متوسط_الدرجة",
        "توصية_المجموعة",
        "ملاحظات",
    ]
    with GRP_CSV.open("w", encoding="utf-8-sig", newline="") as h:
        w = csv.DictWriter(h, fieldnames=grp_fields)
        w.writeheader()
        for row in group_rows:
            w.writerow(row)

    log("كتابة المخرجات", f"duplicates={len(dup_rows)} groups={len(group_rows)} recs={dict(rec_counter)}")

    # أمثلة للتقرير
    high_pass = [r for r in dup_rows if float(r["درجة_نصية"]) >= 90 and r["بوابة_تشغيلية"] == "pass"]
    high_fail = [r for r in dup_rows if float(r["درجة_نصية"]) >= 90 and r["بوابة_تشغيلية"] == "fail"]
    mid = [r for r in dup_rows if 70 <= float(r["درجة_نصية"]) < 90]
    same_t = [r for r in dup_rows if r["توصية"] == "same_template?"]
    merge_c = [r for r in dup_rows if r["توصية"] == "دمج_مرشّح"]

    top_groups = group_rows[:10]

    report = [
        "# 02_duplicates_report — تقرير الخوارزمية 2",
        f"## التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "## الحالة: مُسلَّم للمراجعة — لا دمج نهائي — لا خ3",
        "",
        "## ملخص تنفيذي",
        f"- قورن **{len(items)}** عنصراً تشغيلياً (يشمل external). مقارنات ممكنة ≈ {total_comp}.",
        f"- عتبة الإبقاء النهائية: **{threshold}%**"
        + (" (رُفعت من 70% لتجاوز 2000 زوج)" if threshold > 70 else "")
        + ".",
        f"- أزواج فوق العتبة: **{len(dup_rows)}** · مجموعات: **{len(group_rows)}**.",
        f"- توصيات: " + " · ".join(f"{k}={v}" for k, v in rec_counter.most_common()) + ".",
        f"- ≥90% وبوابة pass: **{len(high_pass)}** · ≥90% وبوابة fail: **{len(high_fail)}** (نصي≠تشغيلي).",
        "- لا حذف من 01_inventory · لا فتح لخ3 · الخط الأساس يبقى **565** ما لم تعتمد مراجعة بشرية خلاف ذلك.",
        "",
        "## المنهجية",
        "- أوزان: عنوان 20 · هيكل حقول 40 · جداول 15 · مضمون 25 (بعد إزالة ضوضاء edu-forms).",
        "- التدفق والنوع الحاد: بوابة تشغيلية فقط (قائمة الأزواج الحادة في 02_method).",
        "- التوصيات الخمس فقط مع reason وconfidence لكل صف.",
        "- المسار: منفّذ أنتج ← رئيس المشروع يراجع ← لجنة التميز / خ9 تعتمد.",
        "",
        "## إحصاءات العتبات",
        f"| البند | العدد |",
        f"|---|---:|",
        f"| أزواج ≥90% + pass | {len(high_pass)} |",
        f"| أزواج ≥90% + fail | {len(high_fail)} |",
        f"| أزواج 70–89% (ضمن المُبقى حسب العتبة) | {len([r for r in dup_rows if 70 <= float(r['درجة_نصية']) < 90])} |",
        f"| same_template? | {len(same_t)} |",
        f"| دمج_مرشّح | {len(merge_c)} |",
        "",
        "## أهم 10 مجموعات",
        "",
    ]
    for g in top_groups:
        report.append(
            f"### {g['group_id']} — حجم {g['size']} — متوسط {g['متوسط_الدرجة']} — {g['توصية_المجموعة']}"
        )
        report.append(f"- أعضاء: `{g['الأعضاء']}`")
        report.append(f"- عينة: {g['عناوين_عينة']}")
        report.append(f"- {g['ملاحظات']}")
        report.append("")

    report += [
        "## أمثلة تشابه نصي عالٍ + اختلاف تشغيلي",
        "",
    ]
    for r in high_fail[:8]:
        report.append(
            f"- `{r['pair_id']}` {r['عنوان_أ'][:40]} ({r['نوع_أ']}) ↔ {r['عنوان_ب'][:40]} ({r['نوع_ب']}) "
            f"— درجة {r['درجة_نصية']} — {r['سبب_فشل_البوابة']} — {r['توصية']}"
        )
    if not high_fail:
        report.append("- لا أمثلة ≥90% مع فشل بوابة في هذه الجولة (قد تظهر تحت عتبة أدنى).")

    report += [
        "",
        "## أمثلة دمج_مرشّح (للمراجعة البشرية)",
        "",
    ]
    for r in merge_c[:8]:
        report.append(
            f"- `{r['pair_id']}` {r['عنوان_أ'][:45]} ↔ {r['عنوان_ب'][:45]} — {r['درجة_نصية']}% — {r['reason']}"
        )
    if not merge_c:
        report.append("- لا مرشّحات دمج عالية في هذه الجولة تحت العتبة النهائية.")

    report += [
        "",
        "## ما يكشفه الأرشيف عن بنيته (توصيات عامة)",
        "1. كثافة `same_template?` إن ارتفعت تدعم فرضية القالب المشترك (س4) دون دمج مبكر.",
        "2. مجموعات المبادرات/التقارير المتشابهة مرشّحة لأنماط واجهات لاحقاً (بعد خ2/خ9) لا لـ 560 شاشة.",
        "3. عناصر external يجب أن تُراجع ضمن مجموعاتها مع الأرشيف — لا تُستثنى.",
        "4. البوابة التشغيلية حمت من دمج أنواع حادة حتى عند تشابه نصي عالٍ — مبدأ نصي≠تشغيلي مُنفَّذ.",
        "",
        "## أسئلة مفتوحة للخوارزمية 9 (التوحيد)",
        "1. أي مجموعات `same_template?` تُعتمد قالباً رسمياً واحداً؟",
        "2. أي `دمج_مرشّح` تُثبّت بعد مراجعة الرئيس ولجنة التميز؟",
        "3. هل تُعاد فهرسة الخط الأساس بعد الاعتماد البشري للدمج؟",
        "4. كيف تُربط أنماط الواجهة (فرضية ب لاحقاً) بمجموعات خ2؟",
        "",
        "## أثر على الخط الأساس",
        "- **لا تغيير الآن على 565.** أي دمج معتمد لاحقاً يُسجَّل مرة واحدة في decisions_log.",
        "",
        f"## زمن التشغيل",
        f"- {time.time() - t0:.1f} ثانية",
        "",
    ]
    REPORT.write_text("\n".join(report) + "\n", encoding="utf-8")
    log("كتابة التقرير", str(REPORT.name))
    log("انتهاء خ2", f"elapsed={time.time()-t0:.1f}s — بانتظار مراجعة رئيس المشروع — لا خ3")
    flush_log(
        "\n## خلاصة\n"
        f"- threshold={threshold}\n"
        f"- pairs={len(dup_rows)}\n"
        f"- groups={len(group_rows)}\n"
        f"- recommendations={dict(rec_counter)}\n"
    )


if __name__ == "__main__":
    main()
