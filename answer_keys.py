# -*- coding: utf-8 -*-
import re
from sample_bank import SAMPLE_BANK
def extract_letter(ans):
    m = re.search(r"\(([أبجد])\)", ans)
    return m.group(1) if m else "?"
def build_keys():
    return {subj: [{"id": q[0], "skill": q[1], "answer_letter": extract_letter(q[4]), "answer_full": q[4], "explanation": q[5]} for q in qs] for subj, qs in SAMPLE_BANK.items()}
