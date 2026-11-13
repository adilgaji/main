"""Построение упражнений для карточек и вспомогательные функции подбора отвлекающих вариантов."""
import random, re, unicodedata, difflib
from pypinyin import pinyin, Style
from . import audio
_TONE = {'a': 'āáǎà', 'e': 'ēéěè', 'i': 'īíǐì', 'o': 'ōóǒò', 'u': 'ūúǔù', 'ü': 'ǖǘǚǜ'}
def mark(num):
    """'xi3' -> 'xǐ'"""
    m = re.fullmatch(r'([a-zü]+?)([1-5]?)', num)
    s, t = m.group(1), int(m.group(2) or 5)
    if t == 5: return s
    for v in ('a', 'e', 'ou'):
        if v in s:
            i = s.index(v); ch = v[0]; return s[:i] + _TONE[ch][t-1] + s[i+1:]
    idx = max(i for i, ch in enumerate(s) if ch in _TONE)  # последняя гласная (для iu, ui)
    return s[:idx] + _TONE[s[idx]][t-1] + s[idx+1:]
def strip_tones(s): return ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c)).replace('ü', 'v').lower()
def tone_of(chunk):
    for ch in chunk:
        for v, ts in _TONE.items():
            if ch in ts: return ts.index(ch) + 1
    return 5
def split_numeric(hanzi, py):
    """диакритический пиньинь слова -> [(слог, тон)] по длинам слогов pypinyin"""
    sylls = [p[0] for p in pinyin(hanzi, style=Style.NORMAL, v_to_u=True)]
    py = py.replace("'", '').lower(); out = []; i = 0
    for s in sylls:
        n = len(s); chunk = py[i:i+n]; i += n
        if strip_tones(chunk) != strip_tones(s): return None
        out.append((strip_tones(chunk).replace('v', 'ü'), tone_of(chunk)))
    return out if i == len(py) else None
def tone_options(hanzi, py, n=4):
    syl = split_numeric(hanzi, py)
    if not syl or len(syl) > 4: return None
    ans = ''.join(mark(f'{s}{t}') for s, t in syl); opts = {ans}
    tries = 0
    while len(opts) < n and tries < 50:
        tries += 1
        mut = [(s, t) for s, t in syl]; k = random.choice(range(len(mut))); alts = [x for x in (1, 2, 3, 4, 5) if x != mut[k][1]]
        mut[k] = (mut[k][0], random.choice(alts)); opts.add(''.join(mark(f'{s}{t}') for s, t in mut))
    if len(opts) < n: return None
    opts = list(opts); random.shuffle(opts); return opts, opts.index(ans)
def similar_words(c, w, k=3, same_len=True):
    """слова, похожие по звучанию (без тонов) — отвлекающие варианты для аудио"""
    base = strip_tones(w['pinyin']); rows = c.execute('SELECT * FROM words WHERE id!=? AND length(hanzi)=?', (w['id'], len(w['hanzi']) if same_len else 0)).fetchall()
    sc = sorted(rows, key=lambda r: -difflib.SequenceMatcher(None, base, strip_tones(r['pinyin'])).ratio() + random.random() * 0.15)
    return sc[:k]
def same_pos_words(c, w, k=3):
    pos = (w['pos'] or '').split(',')[0]
    rows = c.execute('SELECT * FROM words WHERE id!=? AND pos LIKE ? AND level<=? ORDER BY RANDOM() LIMIT ?', (w['id'], f'{pos}%', max(w['level'], 2), k)).fetchall()
    if len(rows) < k: rows += c.execute('SELECT * FROM words WHERE id!=? ORDER BY RANDOM() LIMIT ?', (w['id'], k - len(rows))).fetchall()
    return rows
def short_ru(w): return re.split(r'[;(]', w['ru'])[0].strip() or w['ru']
def word_view(c, w, with_example=True):
    v = {'id': w['id'], 'hanzi': w['hanzi'], 'pinyin': w['pinyin'], 'ru': w['ru'], 'en': w['en'], 'level': w['level'], 'audio': audio.spec(w['hanzi'])}
    if with_example:
        ex = c.execute('SELECT * FROM examples WHERE word_id=? ORDER BY RANDOM() LIMIT 2', (w['id'],)).fetchall()
        v['examples'] = [{'zh': e['zh'], 'pinyin': e['pinyin'], 'ru': e['ru'], 'audio': audio.spec(e['zh'])} for e in ex]
    return v
def _mcq(prompt, options, answer, **kw):
    return dict(mode='mcq', prompt=prompt, options=options, answer=answer, **kw)
def build(c, card):
    """card — строка cards; возвращает описание упражнения"""
    w = c.execute('SELECT * FROM words WHERE id=?', (card['word_id'],)).fetchone(); kind = card['kind']
    base = {'card_id': card['id'], 'kind': kind, 'word': word_view(c, w), 'state': card['state']}
    if kind == 'recog':
        return {**base, 'mode': 'reveal', 'prompt': 'Что значит это слово?', 'autoplay': True}
    if kind == 'recall':
        ds = same_pos_words(c, w); opts = [w] + list(ds); random.shuffle(opts)
        return {**base, **_mcq('Выбери иероглифы для слова:', [{'hanzi': o['hanzi'], 'pinyin': o['pinyin']} for o in opts], [o['id'] for o in opts].index(w['id']), cue=short_ru(w), cue_en=w['en'].split(';')[0])}
    if kind == 'audio':
        ds = similar_words(c, w); opts = [w] + list(ds); random.shuffle(opts)
        return {**base, **_mcq('Что ты слышишь?', [{'hanzi': o['hanzi'], 'pinyin': o['pinyin']} for o in opts], [o['id'] for o in opts].index(w['id'])), 'audio_only': True, 'autoplay': True}
    if kind == 'tones':
        r = tone_options(w['hanzi'], w['pinyin'])
        if not r: return None
        opts, ans = r; return {**base, **_mcq('Выбери правильный пиньинь с тонами:', opts, ans, cue=w['hanzi'])}
    if kind == 'context':
        ex = c.execute('SELECT * FROM examples WHERE word_id=? ORDER BY RANDOM() LIMIT 1', (w['id'],)).fetchone()
        if not ex: return None
        ds = same_pos_words(c, w); opts = [w] + list(ds); random.shuffle(opts)
        return {**base, **_mcq('Вставь подходящее слово:', [{'hanzi': o['hanzi'], 'pinyin': o['pinyin']} for o in opts], [o['id'] for o in opts].index(w['id']),
                  cloze=ex['zh'].replace(w['hanzi'], '＿＿', 1), cloze_ru=ex['ru'], sentence_audio=audio.spec(ex['zh']))}
    return None
