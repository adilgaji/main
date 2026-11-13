"""FSRS (py-fsrs) поверх таблицы cards."""
import random
from datetime import timedelta
from fsrs import Scheduler, Card, Rating, State
from . import db
SCHED = Scheduler(desired_retention=0.9, enable_fuzzing=True)
KNOWN_STABILITY = 21.0   # слово считается выученным, когда стабильность >= 21 дня
def row_to_card(r):
    return Card(state=State(r['state']), step=r['step'], stability=r['stability'], difficulty=r['difficulty'],
                due=db.parse(r['due']), last_review=db.parse(r['last_review']) if r['last_review'] else None)
def save_card(c, cid, card, reps_inc=0, lapse=False):
    c.execute('UPDATE cards SET due=?,stability=?,difficulty=?,state=?,step=?,last_review=?,reps=reps+?,lapses=lapses+? WHERE id=?',
        (db.iso(card.due), card.stability, card.difficulty, int(card.state), card.step, db.iso(card.last_review) if card.last_review else None, reps_inc, 1 if lapse else 0, cid))
def create_card(c, word_id, kind, due=None):
    """новая карточка (состояние Learning, готова к показу сразу)"""
    card = Card(); d = due or db.now()
    c.execute('INSERT OR IGNORE INTO cards(word_id,kind,due,stability,difficulty,state,step,last_review,created) VALUES(?,?,?,?,?,?,?,?,?)',
        (word_id, kind, db.iso(d), None, None, int(card.state), card.step, None, db.iso(db.now())))
    return c.execute('SELECT id FROM cards WHERE word_id=? AND kind=?', (word_id, kind)).fetchone()['id']
def seed_known(c, word_id, kind, stability=8.0, spread_days=10):
    """слово из старого HSK 3 или отвеченное верно на тесте: стартуем сразу как 'Review' со стабильностью stability,
    первый показ через случайные 2..spread_days дней (проверка, что оно реально помнится)"""
    due = db.now() + timedelta(days=random.uniform(2, spread_days))
    c.execute('INSERT OR IGNORE INTO cards(word_id,kind,due,stability,difficulty,state,step,last_review,reps,created) VALUES(?,?,?,?,?,?,?,?,?,?)',
        (word_id, kind, db.iso(due), stability, 5.0, int(State.Review), None, db.iso(db.now() - timedelta(days=stability)), 1, db.iso(db.now())))
def review(c, card_id, rating, ms=None):
    r = c.execute('SELECT * FROM cards WHERE id=?', (card_id,)).fetchone()
    card, _ = SCHED.review_card(row_to_card(r), Rating(rating), review_duration=ms)
    save_card(c, card_id, card, reps_inc=1, lapse=(rating == 1 and r['state'] == int(State.Review)))
    c.execute('INSERT INTO reviews(card_id,word_id,kind,ts,rating,correct,ms) VALUES(?,?,?,?,?,?,?)',
        (card_id, r['word_id'], r['kind'], db.iso(db.now()), rating, 0 if rating == 1 else 1, ms or 0))
    return c.execute('SELECT * FROM cards WHERE id=?', (card_id,)).fetchone()
def unlock_followups(c, word_id):
    """после уверенного распознавания добавляем остальные типы карточек"""
    for kind in ('recall', 'tones'): create_card(c, word_id, kind)
    if c.execute('SELECT 1 FROM examples WHERE word_id=?', (word_id,)).fetchone(): create_card(c, word_id, 'context')
def word_status(c):
    """{'known': n, 'learning': n, 'new': n} по карточке recog"""
    tot = c.execute('SELECT COUNT(*) n FROM words').fetchone()['n']
    rows = c.execute("SELECT stability, state FROM cards WHERE kind='recog'").fetchall()
    known = sum(1 for r in rows if r['state'] == int(State.Review) and (r['stability'] or 0) >= KNOWN_STABILITY)
    return {'known': known, 'learning': len(rows) - known, 'new': tot - len(rows), 'total': tot}
