"""Страница «Учить слова» (как в Duolingo): дневная цель, уроки по 5 слов, мини-проверка после знакомства."""
import random
from datetime import datetime, time, timedelta
from fastapi import APIRouter
from pydantic import BaseModel
from . import db, srs, cards, audio
from .ctx import C
router = APIRouter(prefix='/api/learn')
DEFAULT_GOAL = 20
def goal(): return int(db.get(C, 'learn_goal', DEFAULT_GOAL))
def done_today():
    iso0 = db.iso(datetime.combine(db.today(), time(0, 0)).astimezone())
    return C.execute("SELECT COUNT(*) n FROM cards WHERE kind='recog' AND state=1 AND created>=?", (iso0,)).fetchone()['n']
def pool(limit=None):
    """ещё не введённые слова; слова старого HSK 3 идут через «сортировку», поэтому здесь только остальные.
    Сначала слова, у которых есть пример (предложение показывается на каждом слове)"""
    intro = {r['word_id'] for r in C.execute("SELECT word_id FROM cards WHERE kind='recog'")}
    ex = {r['word_id'] for r in C.execute('SELECT DISTINCT word_id FROM examples')}
    rows = [w for w in C.execute('SELECT * FROM words ORDER BY level, freq') if w['id'] not in intro and not (w['old'] and w['old'] <= 3)]
    rows.sort(key=lambda w: (0 if w['id'] in ex else 1, w['level'], w['freq']))   # сортировка стабильная: внутри группы порядок по уровню
    return rows[:limit] if limit else rows
@router.get('/state')
def state():
    p = pool(); g = goal(); d = done_today()
    return {'goal': g, 'done': d, 'left_in_pool': len(p), 'with_example': sum(1 for w in p if C.execute('SELECT 1 FROM examples WHERE word_id=?', (w['id'],)).fetchone()), 'streak': __import__('app.plan', fromlist=['x']).streak(C)}
class Goal(BaseModel): goal: int
@router.post('/goal')
def set_goal(g: Goal):
    db.put(C, 'learn_goal', max(1, min(200, g.goal))); return {'goal': goal()}
def view(w):
    ex = C.execute('SELECT * FROM examples WHERE word_id=? ORDER BY RANDOM() LIMIT 1', (w['id'],)).fetchone()
    v = {'id': w['id'], 'hanzi': w['hanzi'], 'pinyin': w['pinyin'], 'ru': w['ru'], 'en': w['en'], 'level': w['level'], 'audio': audio.spec(w['hanzi']),
         'example': ({'zh': ex['zh'], 'pinyin': ex['pinyin'], 'ru': ex['ru'], 'audio': audio.spec(ex['zh'])} if ex else None)}
    ds = cards.same_pos_words(C, w, 3); opts = [w] + list(ds); random.shuffle(opts)
    v['quiz_ru'] = {'options': [cards.short_ru(o) for o in opts], 'answer': [o['id'] for o in opts].index(w['id'])}
    opts2 = [w] + list(cards.similar_words(C, w, 3, same_len=True)); random.shuffle(opts2)
    v['quiz_hz'] = {'options': [{'hanzi': o['hanzi'], 'pinyin': o['pinyin']} for o in opts2], 'answer': [o['id'] for o in opts2].index(w['id'])}
    return v
@router.get('/batch')
def batch(n: int = 5):
    ws = pool(max(1, min(n, 20)))
    return {'words': [view(w) for w in ws], 'state': state()}
class Done(BaseModel): word_ids: list[int]; weak: list[int] = []
@router.post('/finish')
def finish(d: Done):
    """урок закончен: слова попадают в FSRS (карточки recog + audio); слова, в которых были ошибки, повторятся скорее"""
    for wid in d.word_ids:
        srs.create_card(C, wid, 'recog', due=db.now() + (timedelta(minutes=1) if wid in d.weak else timedelta(minutes=10)))
        srs.create_card(C, wid, 'audio', due=db.now() + timedelta(minutes=30))
    C.commit(); return state()
