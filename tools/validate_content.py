"""Автопроверка контента: каждое китайское предложение разбирается jieba, слов выше HSK 4 быть не должно.
Пиньинь целевого слова сверяется со словарём. Использование:
    python tools/validate_content.py            # проверить всё, выйти с кодом 1 при ошибках
как модуль: validate_sentence(zh, target=None) -> список проблем"""
import json, re, sys, csv
from pathlib import Path
import jieba
from pypinyin import pinyin, Style
ROOT = Path(__file__).resolve().parent.parent
PUNCT = re.compile(r'[\s，。！？、；：“”"\'‘’（）()《》…—\-,.!?;:\d０-９a-zA-Z]+')
_state = {}
def _load():
    if _state: return _state
    words = json.load(open(ROOT/'content/words.json', encoding='utf-8'))
    allowed = set((ROOT/'content/allowed_words.txt').read_text(encoding='utf-8').split('\n'))
    allowed |= set(x for x in (ROOT/'content/whitelist.txt').read_text(encoding='utf-8').split('\n') if x)
    chars = set(''.join(allowed))
    for r in csv.DictReader(open(ROOT/'data/raw/hsk30-chars.csv', encoding='utf-8')):
        if r['Level'] in '1234' and r['Level'] != '': chars.add(r['Hanzi'])
    for w in allowed: jieba.add_word(w, freq=200000)
    _state.update(words={w['hanzi']: w for w in words}, allowed=allowed, chars=chars)
    return _state
def segment(zh): _load(); return [t for t in jieba.lcut(zh, HMM=False) if not PUNCT.fullmatch(t)]
def _norm(py): return re.sub(r'[\s\']', '', py).lower()
import unicodedata
_TONE = {'ā':1,'á':2,'ǎ':3,'à':4,'ē':1,'é':2,'ě':3,'è':4,'ī':1,'í':2,'ǐ':3,'ì':4,'ō':1,'ó':2,'ǒ':3,'ò':4,'ū':1,'ú':2,'ǔ':3,'ù':4,'ǖ':1,'ǘ':2,'ǚ':3,'ǜ':4}
def _strip(s): return ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c)).replace('ü', 'u').lower()
def tones_equal(got, dic, target):
    """сравнение пиньиня по слогам; нейтральный тон в словаре или в тексте - совместим с любым"""
    sylls = [p[0].replace('v', 'ü') for p in pinyin(target, style=Style.NORMAL, v_to_u=True)]
    if len(sylls) != len(target): return True  # нельзя разобрать - не придираемся
    g, d = _norm(got).replace('r', '') if got.endswith('r') and not target.endswith('儿') else _norm(got), _norm(dic)
    gi = di = 0
    for s in sylls:
        n = len(s)
        gc, dc = g[gi:gi+n], d[di:di+n]; gi += n; di += n
        if _strip(gc) != _strip(dc): return False
        tg = next((_TONE[c] for c in gc if c in _TONE), 5); td = next((_TONE[c] for c in dc if c in _TONE), 5)
        if 5 not in (tg, td) and tg != td: return False
    return True
def _decompose(t, allowed):
    """можно ли разбить токен на разрешённые слова"""
    ok = [False]*(len(t)+1); ok[0] = True
    for i in range(1, len(t)+1):
        ok[i] = any(ok[j] and t[j:i] in allowed for j in range(max(0, i-6), i))
    return ok[len(t)]
def validate_sentence(zh, target=None):
    st = _load(); issues = []
    if not re.search(r'[\u4e00-\u9fff]', zh): return ['нет китайского текста']
    for t in segment(zh):
        if t in st['allowed'] or _decompose(t, st['allowed']): continue
        issues.append(f'слово вне HSK4: {t}')
    if target:
        if target not in zh: issues.append(f'целевого слова {target} нет в предложении')
        else:
            w = st['words'].get(target)
            if w:
                i = zh.index(target)
                full = pinyin(zh, style=Style.TONE, heteronym=False)
                got = ''.join(p[0] for p in full[i:i+len(target)])
                if not tones_equal(got, w['pinyin'], target):
                    issues.append(f'пиньинь {target}: в предложении {got}, в словаре {w["pinyin"]}')
    return issues
def check_all(verbose=True):
    bad = 0; seen = 0
    for f in sorted((ROOT/'content/src').glob('examples_*.jsonl')):
        for n, ln in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
            if not ln.strip(): continue
            e = json.loads(ln); seen += 1
            iss = validate_sentence(e['zh'], e.get('w'))
            if not e.get('ru'): iss.append('нет русского перевода')
            if iss: bad += 1; verbose and print(f'{f.name}:{n} {e["zh"]} -> {iss}')
    for f in sorted((ROOT/'content/src').glob('listening_*.json')):
        for it in json.load(open(f, encoding='utf-8')):
            texts = [t['zh'] for t in it.get('turns', [])] + [it.get('question', '')] + it.get('options', [])
            if it.get('answer') is None or not (0 <= it['answer'] < len(it.get('options', []))): bad += 1; print(it['id'], 'нет правильного ответа')
            for s in texts:
                seen += 1; iss = validate_sentence(s)
                if iss: bad += 1; verbose and print(f'{f.name}:{it["id"]} {s} -> {iss}')
    print(f'проверено строк: {seen}, с проблемами: {bad}')
    return bad
if __name__ == '__main__': sys.exit(1 if check_all() else 0)
