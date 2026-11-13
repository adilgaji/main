"""content/src/writing_src.txt -> content/writing.json. python tools/build_writing.py"""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; sys.path.insert(0, str(ROOT))
from tools.validate_content import validate_sentence
sec = None; out = {'order': [], 'translate': [], 'describe': []}; bad = 0
for ln in (ROOT / 'content/src/writing_src.txt').read_text(encoding='utf-8').splitlines():
    if ln.startswith('#order'): sec = 'order'; continue
    if ln.startswith('#translate'): sec = 'translate'; continue
    if ln.startswith('#describe'): sec = 'describe'; continue
    if not ln.strip(): continue
    c = ln.split('|')
    if sec == 'order': out['order'].append({'parts': c[0].split('/'), 'answer': c[0].replace('/', ''), 'ru': c[1]}); chk = [c[0].replace('/', '')]
    elif sec == 'translate': out['translate'].append({'ru': c[0], 'en': c[1], 'ref': c[2], 'words': c[3].split(',')}); chk = [c[2]]
    else: out['describe'].append({'ru': c[0], 'words': c[1].split(',')}); chk = c[1].split(',')
    for s in chk:
        iss = validate_sentence(s, grammar=True)
        if iss: bad += 1; print(s, iss)
for pre, k in (('O', 'order'), ('T', 'translate'), ('D', 'describe')):
    for i, x in enumerate(out[k]): x['id'] = f'{pre}{i+1:03d}'
json.dump(out, open(ROOT / 'content/writing.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in out.items()}, 'проблем:', bad); sys.exit(1 if bad else 0)
