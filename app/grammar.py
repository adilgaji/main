"""Грамматика HSK 4 и письменная часть: упражнения с автопроверкой + очередь «на проверку» (/hsk-check)."""
import json, random, re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from . import db, audio, cards
from .ctx import C
from .config import CONTENT
router = APIRouter(prefix='/api')
def _writing():
    return json.load(open(CONTENT / 'writing.json', encoding='utf-8'))
def _points():
    return [json.loads(r['json']) for r in C.execute('SELECT json FROM grammar ORDER BY no')]
def point_stats():
    st = {r['point_id']: r for r in C.execute('SELECT point_id, COUNT(*) n, SUM(correct) c, MAX(ts) last FROM g_attempts GROUP BY point_id')}
    return st
@router.get('/grammar/list')
def grammar_list():
    st = point_stats(); out = []
    for p in _points():
        s = st.get(p['id']); out.append({'id': p['id'], 'no': p['no'], 'group': p['group'], 'title': p['title'], 'n': s['n'] if s else 0, 'acc': round(100 * s['c'] / s['n']) if s and s['n'] else None})
    return out
@router.get('/grammar/point/{pid}')
def grammar_point(pid: str):
    r = C.execute('SELECT json FROM grammar WHERE id=?', (pid,)).fetchone()
    if not r: raise HTTPException(404)
    p = json.loads(r['json']); p['examples'] = [{**e, 'audio': audio.spec(e['zh'])} for e in p['examples']]
    p.pop('order'); p.pop('choice'); return p
@router.get('/grammar/next')
def grammar_next(kind: str = '', exclude: str = ''):
    """выбирает пункт: ещё не решавшиеся и слабые — чаще"""
    ex = set(exclude.split(',')); st = point_stats(); pts = [p for p in _points() if p['id'] not in ex] or _points()
    def weight(p):
        s = st.get(p['id']); return 3.0 if not s else (1.0 - s['c'] / s['n']) * 3 + 0.4
    p = random.choices(pts, weights=[weight(x) for x in pts])[0]; k = kind or random.choice(['order', 'choice'])
    base = {'point_id': p['id'], 'no': p['no'], 'title': p['title'], 'kind': k}
    if k == 'order':
        parts = p['order']['parts'][:]; random.shuffle(parts)
        if parts == p['order']['parts']: parts.reverse()
        return {**base, 'parts': parts, 'hint': p['order']['ru'], 'prompt': 'Составь предложение из слов:'}
    c = p['choice']; opts = c['options'][:]; random.shuffle(opts)
    return {**base, 'zh': c['zh'], 'options': opts, 'prompt': 'Выбери подходящее слово или конструкцию:'}
class GAnswer(BaseModel): point_id: str; kind: str; answer: str; ms: int = 0
@router.post('/grammar/answer')
def grammar_answer(a: GAnswer):
    r = C.execute('SELECT json FROM grammar WHERE id=?', (a.point_id,)).fetchone()
    if not r: raise HTTPException(404)
    p = json.loads(r['json'])
    if a.kind == 'order': right = p['order']['answer']; ok = re.sub(r'[，。！？、\s/]', '', a.answer) == right; shown = right
    else: c = p['choice']; right = c['options'][c['answer']]; ok = a.answer == right; shown = c['zh'].replace('___', right)
    C.execute('INSERT INTO g_attempts(point_id,kind,ts,correct,ms,answer) VALUES(?,?,?,?,?,?)', (a.point_id, a.kind, db.iso(db.now()), int(ok), a.ms, a.answer)); C.commit()
    return {'correct': ok, 'answer': shown, 'rule': p['ru'], 'rule_en': p['en'], 'example': p['examples'][0], 'title': p['title']}
# ---------- письмо ----------
@router.get('/writing/next')
def writing_next(kind: str = 'order', exclude: str = ''):
    ex = set(exclude.split(',')); w = _writing()
    if kind == 'order':
        pool = [o for o in w['order'] if o['id'] not in ex] or w['order']; o = random.choice(pool); parts = o['parts'][:]; random.shuffle(parts)
        if parts == o['parts']: parts.reverse()
        return {'kind': 'order', 'id': o['id'], 'parts': parts, 'hint': o['ru'], 'prompt': 'Составь предложение (排列 / 完成句子):'}
    if kind == 'sentence':
        row = C.execute("SELECT w.* FROM words w JOIN cards c ON c.word_id=w.id AND c.kind='recog' WHERE w.level>=3 ORDER BY RANDOM() LIMIT 1").fetchone() or C.execute('SELECT * FROM words WHERE level>=3 ORDER BY RANDOM() LIMIT 1').fetchone()
        return {'kind': 'sentence', 'id': f'S{row["id"]}', 'word': cards.word_view(C, row, with_example=False), 'prompt': 'Составь предложение со словом (8–20 знаков):'}
    if kind == 'translate':
        pool = [t for t in w['translate'] if t['id'] not in ex] or w['translate']; t = random.choice(pool)
        return {'kind': 'translate', 'id': t['id'], 'ru': t['ru'], 'en': t['en'], 'prompt': 'Переведи на китайский:', 'words': t['words']}
    if kind == 'describe':
        pool = [d for d in w['describe'] if d['id'] not in ex] or w['describe']; d = random.choice(pool)
        return {'kind': 'describe', 'id': d['id'], 'ru': d['ru'], 'words': d['words'], 'prompt': 'Опиши ситуацию 2–3 предложениями (используй слова):'}
    raise HTTPException(400)
class WOrder(BaseModel): id: str; answer: str; ms: int = 0
@router.post('/writing/order')
def writing_order(a: WOrder):
    o = next((x for x in _writing()['order'] if x['id'] == a.id), None)
    if not o: raise HTTPException(404)
    ok = re.sub(r'[，。！？、\s/]', '', a.answer) == o['answer']
    C.execute('INSERT INTO g_attempts(point_id,kind,ts,correct,ms,answer) VALUES(?,?,?,?,?,?)', (a.id, 'writing_order', db.iso(db.now()), int(ok), a.ms, a.answer)); C.commit()
    return {'correct': ok, 'answer': o['answer'], 'ru': o['ru']}
class WSubmit(BaseModel): kind: str; id: str; answer: str; prompt: str = ''; extra: dict = {}
@router.post('/writing/submit')
def writing_submit(s: WSubmit):
    if not s.answer.strip(): raise HTTPException(400, 'пустой ответ')
    kind = {'sentence': 'writing_sentence', 'translate': 'writing_translation', 'describe': 'writing_describe', 'order_alt': 'writing_order_alt'}.get(s.kind)
    if not kind: raise HTTPException(400)
    ref = None
    if s.kind == 'translate':
        t = next((x for x in _writing()['translate'] if x['id'] == s.id), None); ref = t['ref'] if t else None
    C.execute('INSERT INTO queue(ts,kind,payload) VALUES(?,?,?)', (db.iso(db.now()), kind, json.dumps({'item_id': s.id, 'prompt': s.prompt, 'answer': s.answer, 'reference': ref, **s.extra}, ensure_ascii=False))); C.commit()
    return {'queued': True, 'reference': ref}
@router.get('/queue')
def queue_list(status: str = ''):
    q = 'SELECT id, ts, kind, payload, status, feedback FROM queue' + (' WHERE status=?' if status else '') + ' ORDER BY id DESC LIMIT 60'
    return [{**dict(r), 'payload': json.loads(r['payload']), 'feedback': json.loads(r['feedback']) if r['feedback'] else None} for r in C.execute(q, (status,) if status else ())]
