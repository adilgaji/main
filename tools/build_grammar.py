"""content/src/grammar_src.tsv -> content/grammar.json (+ проверка слов HSK<=4 и упражнений). python tools/build_grammar.py"""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; sys.path.insert(0, str(ROOT))
from tools.validate_content import validate_sentence
import csv
cat = {int(r['No']): (r['Group'], r['Category'], r['Details']) for r in csv.DictReader(open(ROOT / 'data/raw/hsk30-grammar.csv', encoding='utf-8')) if r['Level'] == '4'}
out = []; bad = 0
for ln in (ROOT / 'content/src/grammar_src.tsv').read_text(encoding='utf-8').splitlines():
    if not ln.strip(): continue
    c = ln.split('|'); assert len(c) == 13, (len(c), ln[:30])
    no, title, ru, en, e1, e1r, e2, e2r, parts, pru, cz, opts, ans = c
    no = int(no); parts = parts.split('/'); opts = opts.split('/'); ans = int(ans)
    item = {'id': f'G{no}', 'no': no, 'group': ' / '.join(x for x in cat.get(no, ('',))[:2] if x), 'title': title, 'ru': ru, 'en': en,
            'examples': [{'zh': e1, 'ru': e1r}, {'zh': e2, 'ru': e2r}], 'order': {'parts': parts, 'answer': ''.join(parts), 'ru': pru},
            'choice': {'zh': cz, 'options': opts, 'answer': ans}}
    filled = cz.replace('___', opts[ans])
    for s in (e1, e2, item['order']['answer'], filled):
        iss = validate_sentence(s, grammar=True)
        if iss: bad += 1; print(no, s, iss)
    if no not in cat: print('нет такого номера в стандарте', no); bad += 1
    if len(opts) != 4 or '___' not in cz: print(no, 'choice сломан'); bad += 1
    out.append(item)
missing = sorted(set(cat) - {i['no'] for i in out}); print('пунктов:', len(out), 'не покрыто:', missing, 'проблем:', bad)
json.dump(out, open(ROOT / 'content/grammar.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
sys.exit(1 if bad or missing else 0)
