"""Чтение: выбор слова (cloze), упорядочивание предложений (order), понимание текста (passage)."""
import json, random
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from . import db
from .ctx import C
router = APIRouter(prefix='/api/reading')
def items(kind=''):
    return [json.loads(r['json']) for r in C.execute('SELECT json FROM reading' + (' WHERE type=?' if kind else ''), (kind,) if kind else ())]
def question_keys(it):
    return [it['id']] if it['type'] != 'passage' else [f'{it["id"]}#{i}' for i in range(len(it['questions']))]
def public(it):
    """без ответов"""
    if it['type'] == 'cloze': return {'id': it['id'], 'type': 'cloze', 'text': it['text'], 'options': it['options']}
    if it['type'] == 'order': return {'id': it['id'], 'type': 'order', 'sentences': it['sentences']}
    return {'id': it['id'], 'type': 'passage', 'text': it['text'], 'questions': [{'q': q['q'], 'options': q['options']} for q in it['questions']]}
def grade(it, qi, answer):
    """-> (верно?, правильный ответ в виде показа, пояснение)"""
    if it['type'] == 'cloze': return answer == it['answer'], it['text'].replace('____', it['options'][it['answer']]), it['explain']
    if it['type'] == 'order': return str(answer).upper() == it['answer'], ' → '.join(it['sentences']['ABCDEFG'.index(ch)] for ch in it['answer']), it['explain']
    q = it['questions'][qi]; return answer == q['answer'], q['options'][q['answer']], q['explain']
def record(key, correct, ms=0, mode='practice', answer='', it=None):
    C.execute('INSERT INTO r_attempts(item_id,ts,mode,correct,ms,answer) VALUES(?,?,?,?,?,?)', (key, db.iso(db.now()), mode, int(correct), ms, str(answer)))
    if it and it.get('g') and not correct:   # ошибка в конструкции → пункт грамматики чаще попадает в практику
        C.execute('INSERT INTO g_attempts(point_id,kind,ts,correct,ms,answer) VALUES(?,?,?,?,?,?)', (it['g'], 'reading', db.iso(db.now()), 0, ms, str(answer)))
@router.get('/next')
def nxt(kind: str = '', exclude: str = ''):
    ex = set(exclude.split(',')); st = {r['item_id']: r for r in C.execute("SELECT item_id, COUNT(*) n, SUM(correct) c, MAX(ts) last FROM r_attempts GROUP BY item_id")}
    pool = [i for i in items(kind) if i['id'] not in ex]
    if not pool: return {'empty': True}
    def prio(i):
        s = [st[k] for k in question_keys(i) if k in st]
        if not s: return (0, random.random())
        if any(x['c'] < x['n'] for x in s): return (1, min(x['last'] for x in s))
        return (2, min(x['last'] for x in s))
    pool.sort(key=prio); return public(pool[0])
class RAnswer(BaseModel): item_id: str; q: int = 0; answer: str | int; ms: int = 0
@router.post('/answer')
def answer(a: RAnswer):
    it = next((i for i in items() if i['id'] == a.item_id), None)
    if not it: raise HTTPException(404)
    ok, shown, why = grade(it, a.q, a.answer); key = it['id'] if it['type'] != 'passage' else f'{it["id"]}#{a.q}'
    record(key, ok, a.ms, 'practice', a.answer, it); C.commit()
    return {'correct': ok, 'answer': shown, 'explain': why}
@router.get('/stats')
def stats():
    return [dict(r) for r in C.execute("SELECT SUM(correct) c, COUNT(*) n FROM r_attempts WHERE mode='practice'")]
