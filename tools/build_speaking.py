"""content/src/speaking_src.txt -> content/speaking.json (+ автопроверка). python tools/build_speaking.py"""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; sys.path.insert(0, str(ROOT))
from tools.validate_content import validate_sentence
sec = None; out = {'question': [], 'monologue': []}; bad = 0
for ln in (ROOT / 'content/src/speaking_src.txt').read_text(encoding='utf-8').splitlines():
    if ln.startswith('#question'): sec = 'question'; continue
    if ln.startswith('#monologue'): sec = 'monologue'; continue
    if not ln.strip(): continue
    c = ln.split('|')
    if sec == 'question': out['question'].append({'ru': c[0], 'zh': c[1], 'words': c[2].split(','), 'sample': c[3]}); chk = [c[1], c[3]]
    else: out['monologue'].append({'ru': c[0], 'zh': c[1], 'words': c[2].split(',')}); chk = [c[1]]
    for s in chk:
        iss = validate_sentence(s, grammar=True)
        if iss: bad += 1; print(s, iss)
for pre, k in (('Q', 'question'), ('M', 'monologue')):
    for i, x in enumerate(out[k]): x['id'] = f'{pre}{i+1:03d}'
json.dump(out, open(ROOT / 'content/speaking.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in out.items()}, 'проблем:', bad); sys.exit(1 if bad else 0)
