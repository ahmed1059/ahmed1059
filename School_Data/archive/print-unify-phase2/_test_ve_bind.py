# -*- coding: utf-8 -*-
"""تحقق عزل شواهد البرامج + ترحيل المسودة."""
import json
import urllib.request
from pathlib import Path
import sqlite3

BASE = "http://127.0.0.1:8060"
DB = Path(r"C:\Users\Toshiba\Desktop\School_Governance_System_1059\School_Data\school_1059.db")


def get(url):
    with urllib.request.urlopen(url, timeout=10) as res:
        return json.loads(res.read().decode("utf-8"))


def post_json(url, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read().decode("utf-8"))


def main():
    p1 = get(BASE + "/api/visual-evidence?entity_type=program&entity_key=program-1")
    p2 = get(BASE + "/api/visual-evidence?entity_type=program&entity_key=program-2")
    p4 = get(BASE + "/api/visual-evidence?entity_type=program&entity_key=program-4")
    p6 = get(BASE + "/api/visual-evidence?entity_type=program&entity_key=program-6")
    print("program-1 ids:", [i["id"] for i in p1.get("items", [])], "names:", [i["name"] for i in p1.get("items", [])])
    print("program-2 ids:", [i["id"] for i in p2.get("items", [])], "names:", [i["name"] for i in p2.get("items", [])])
    print("program-4 ids:", [i["id"] for i in p4.get("items", [])])
    print("program-6 ids:", [i["id"] for i in p6.get("items", [])])

    ids1 = {i["id"] for i in p1.get("items", [])}
    ids2 = {i["id"] for i in p2.get("items", [])}
    ids6 = {i["id"] for i in p6.get("items", [])}
    assert not (ids1 & ids2), "تداخل شواهد program-1 و program-2"
    assert not (ids1 & ids6), "تداخل شواهد program-1 و program-6"
    assert not (ids2 & ids6), "تداخل شواهد program-2 و program-6"
    print("OK: no overlap between program galleries")

    # ترحيل مسودة تجريبية ثم إرجاعها
    conn = sqlite3.connect(str(DB))
    draft = "program-draft-test-rebind"
    # أنشئ صفاً مؤقتاً إن لم يوجد
    conn.execute(
        "INSERT INTO visual_evidence(entity_type, entity_key, register_key, kind, url, name, created_at) "
        "VALUES('program', ?, 'programs', 'link', 'https://example.com/x', 'rebind-probe', datetime('now'))",
        (draft,),
    )
    conn.commit()
    draft_ids = [
        r[0]
        for r in conn.execute(
            "SELECT id FROM visual_evidence WHERE entity_type='program' AND entity_key=?",
            (draft,),
        )
    ]
    print("draft rows:", draft_ids)
    rebound = post_json(
        BASE + "/api/visual-evidence/rebind",
        {"entity_type": "program", "from_key": draft, "to_key": "program-4"},
    )
    print("rebind moved:", rebound.get("moved"), "to items:", [i["id"] for i in rebound.get("items", [])])
    after4 = get(BASE + "/api/visual-evidence?entity_type=program&entity_key=program-4")
    names4 = [i["name"] for i in after4.get("items", [])]
    assert "rebind-probe" in names4, "فشل ظهور الشاهد بعد الترحيل على program-4"
    # نظّف صف الاختبار
    for item in after4.get("items", []):
        if item.get("name") == "rebind-probe":
            post_json(BASE + "/api/visual-evidence/delete", {"id": item["id"]})
    left = get(BASE + "/api/visual-evidence?entity_type=program&entity_key=program-4")
    assert "rebind-probe" not in [i["name"] for i in left.get("items", [])]
    print("OK: rebind + cleanup")
    conn.close()


if __name__ == "__main__":
    main()
