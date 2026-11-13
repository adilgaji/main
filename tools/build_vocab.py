"""Собирает content/words.json из data/raw/old.json (список 'newest' 1-4 + пометка старого HSK).
Запуск: python tools/build_vocab.py"""
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
src = json.load(open(ROOT/'data/raw/old.json', encoding='utf-8'))
def lv(x, p):
    r = [int(l.split('-')[1]) for l in x['level'] if l.startswith(p+'-')]
    return min(r) if r else None
BAD = re.compile(r"^(old |variant of|abbr\. for|used in|see |surname|Taiwan pr|also pr\.|\(archaic\)|\(literary\)|\(slang\)|\(dialect\)|CL:|\(Tw\)|erhua variant|archaic|ancient|\(coll\.\) what\?)", re.I)
def clean_en(ms):
    out = []
    for m in ms:
        m = re.sub(r"\s*\((?:also )?pr\. \[[^\]]*\]\)|;?\s*(?:also |colloquial )?pr\. \[[^\]]*\]", "", m).strip()
        if BAD.search(m) or not m: continue
        if m not in out: out.append(m)
    return out
import csv, unicodedata, collections
TONE = {'ā':1,'á':2,'ǎ':3,'à':4,'ē':1,'é':2,'ě':3,'è':4,'ī':1,'í':2,'ǐ':3,'ì':4,'ō':1,'ó':2,'ǒ':3,'ò':4,'ū':1,'ú':2,'ǔ':3,'ù':4,'ǖ':1,'ǘ':2,'ǚ':3,'ǜ':4}
def strip(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c))
    return unicodedata.normalize('NFC', s).lower()
def official():
    h = collections.defaultdict(list)
    for r in csv.DictReader(open(ROOT/'data/raw/hsk30.csv', encoding='utf-8')):
        k = re.sub(r'\d$', '', re.split(r'[（|]', r['Simplified'])[0])
        p = re.split(r'[|/(]', r['Pinyin'])[0].strip().replace(' ', '')
        h[k].append(p)
    return h
OFF = official()
def tones_match(numeric, official_py):
    # numeric 'ai4 hao4' vs official 'àihào' (нейтральный тон - любой)
    o = official_py.replace("'", '').lower(); i = 0
    for syl in numeric.lower().split():
        m = re.match(r'([a-züv:]+)(\d)?', syl); letters = m.group(1).replace('u:', 'ü').replace('v', 'ü'); t = int(m.group(2) or 5)
        chunk = o[i:i+len(letters)]; i += len(letters)
        if strip(chunk).replace('v', 'ü') != strip(letters): return False
        ot = next((TONE[c] for c in chunk if c in TONE), 5)
        if 5 not in (t, ot) and t != ot: return False
    return i == len(o)
def exact(numeric, o):
    # без подстановки нейтрального тона: сравниваем цифры тонов 1-4 буквально, нейтральный == нейтральный
    o = o.replace("'", '').lower(); i = 0
    for syl in numeric.lower().split():
        m = re.match(r'([a-züv:]+)(\d)?', syl); letters = m.group(1).replace('u:', 'ü').replace('v', 'ü'); t = int(m.group(2) or 5)
        chunk = o[i:i+len(letters)]; i += len(letters)
        ot = next((TONE[c] for c in chunk if c in TONE), 5)
        if strip(chunk).replace('v', 'ü') != strip(letters) or ot != t: return False
    return i == len(o)
def pick_form(x):
    cands = OFF.get(x['simplified'])
    forms = [f for f in x['forms'] if not f['meanings'][0].lower().startswith(('surname', 'variant of'))] or x['forms']
    if not cands: return forms[0], 'noofficial'
    for fn in (exact, tones_match):
        for c in cands:
            for f in forms:
                if fn(f['transcriptions']['numeric'], c): return f, 'ok'
    return forms[0], 'mismatch'
words = []
for x in src:
    n = lv(x, 'newest')
    if n is None or n > 4: continue
    f, st = pick_form(x)
    py = f['transcriptions']['numeric']
    ms = clean_en([m for g in x['forms'] if g['transcriptions']['numeric'] == py for m in g['meanings']])
    if not ms: st = 'noen'; ms = [f['meanings'][0]]
    if st == 'mismatch': f = dict(f, transcriptions=dict(f['transcriptions'], pinyin=OFF[x['simplified']][0]), meanings=f['meanings'])
    words.append(dict(hanzi=x['simplified'], pinyin=f['transcriptions']['pinyin'].replace(' ', ''),
        en='; '.join(ms[:3]), pos=','.join(x.get('pos', [])), level=n, old=lv(x, 'old'),
        std2021=lv(x, 'new'), freq=x.get('frequency', 10**9), check=(st != 'ok')))
ru = {}; en_fix = {}
for f in sorted((ROOT/'content/ru').glob('ru_*.tsv')):
    for ln in f.read_text(encoding='utf-8').splitlines():
        if not ln.strip(): continue
        c = ln.split('\t'); ru[int(c[0])] = c[1].strip()
        if len(c) > 2 and c[2].strip(): en_fix[int(c[0])] = c[2].strip()
ef = ROOT/'content/en_fix.tsv'
if ef.exists():
    for ln in ef.read_text(encoding='utf-8').splitlines():
        c = ln.split('\t')
        if len(c) > 1: en_fix[int(c[0])] = c[1].strip()
words.sort(key=lambda w: (w['level'], w['freq']))
for i, w in enumerate(words, 1):
    w['id'] = i; w['ru'] = ru.get(i, ''); 
    if i in en_fix: w['en'] = en_fix[i]; w['check'] = False
miss = [w['id'] for w in words if not w['ru']]
print('без русского перевода:', len(miss), miss[:10])
(ROOT/'content').mkdir(exist_ok=True)
json.dump(words, open(ROOT/'content/words.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('к ручной проверке:', [(w['hanzi'], w['pinyin'], w['en'][:30]) for w in words if w['check']])
print(len(words), {l: sum(w['level'] == l for w in words) for l in (1, 2, 3, 4)})

# список разрешённых слов для проверки контента: newest 1-4 + старый HSK 2.0 1-4
allowed = {w['hanzi'] for w in words}
for x in src:
    if lv(x, 'old') is not None and lv(x, 'old') <= 4: allowed.add(x['simplified'])
(ROOT/'content/allowed_words.txt').write_text('\n'.join(sorted(allowed)), encoding='utf-8')
print('разрешённых слов для проверки контента:', len(allowed))

# слова стандарта 2021 уровней 1-4 (нужны только для примеров к грамматике: 格外, 渐渐, 假如...)
g = {x['simplified'] for x in src if lv(x, 'new') is not None and lv(x, 'new') <= 4}
(ROOT/'content/allowed_grammar.txt').write_text('\n'.join(sorted(g - allowed)), encoding='utf-8')
print('доп. слов стандарта 2021 для грамматики:', len(g - allowed))
