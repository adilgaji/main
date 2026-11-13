import json, random, re, socket, difflib, logging
from datetime import timedelta
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from . import db, srs, cards, plan, audio
from .config import WEB, AUDIO_DIR, AVAILABLE
logging.basicConfig(level=logging.INFO)
app = FastAPI(title='HSK 4 Trainer')
from .ctx import C
from .grammar import router as grammar_router
app.include_router(grammar_router)
def rows(q, a=()): return [dict(r) for r in C.execute(q, a).fetchall()]
# ---------- общее ----------
@app.get('/api/state')
def state():
    return {'placement_done': bool(db.get(C, 'placement_done')), 'plan': plan.settings(C), 'available': sorted(AVAILABLE), 'planned': db.get(C, 'plan') is not None}
class Settings(BaseModel):
    start: str | None = None; exam: str | None = None; minutes: int | None = None
@app.post('/api/settings')
def set_settings(s: Settings):
    cur = plan.settings(C)
    for k in ('start', 'exam', 'minutes'):
        if getattr(s, k) is not None: cur[k] = getattr(s, k)
    db.put(C, 'plan', cur); return cur
@app.get('/api/today')
def today(): return {**plan.build_today(C), 'forecast': plan.forecast(C), 'streak': plan.streak(C), 'placement_done': bool(db.get(C, 'placement_done'))}
@app.get('/api/stats')
def stats(): return plan.stats(C)
class Beat(BaseModel): module: str; seconds: int = 15
@app.post('/api/heartbeat')
def heartbeat(b: Beat):
    C.execute('INSERT INTO activity(day,module,seconds) VALUES(?,?,?) ON CONFLICT(day,module) DO UPDATE SET seconds=seconds+excluded.seconds', (db.today().isoformat(), b.module, min(b.seconds, 30))); C.commit(); return {'ok': True}
@app.get('/api/lan')
def lan():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('10.255.255.255', 1)); ips.add(s.getsockname()[0]); s.close()
    except Exception: pass
    return {'ips': sorted(ips), 'port': 8765}
# ---------- слова и карточки ----------
@app.get('/api/words')
def words(q: str = '', limit: int = 40):
    like = f'%{q}%'
    rs = C.execute('SELECT * FROM words WHERE hanzi LIKE ? OR pinyin LIKE ? OR ru LIKE ? OR en LIKE ? ORDER BY level, freq LIMIT ?', (like, like, like, like, limit)).fetchall()
    return [cards.word_view(C, r) for r in rs]
@app.get('/api/review/next')
def review_next():
    cutoff = db.iso(db.now() + timedelta(minutes=1))
    for _ in range(5):
        r = C.execute('SELECT * FROM cards WHERE due<=? ORDER BY due LIMIT 1', (cutoff,)).fetchone()
        if not r: break
        ex = cards.build(C, r)
        if ex and ex.get('mode') == 'mcq': db.put(C, f'ans_{r["id"]}', ex.pop('answer'))  # правильный ответ клиенту не отдаём
        if ex: return {**ex, 'remaining': C.execute('SELECT COUNT(*) n FROM cards WHERE due<=?', (cutoff,)).fetchone()['n']}
        C.execute('DELETE FROM cards WHERE id=?', (r['id'],)); C.commit()  # карточку нельзя построить (нет примера/тонов)
    nxt = C.execute('SELECT MIN(due) d FROM cards').fetchone()['d']
    return {'empty': True, 'next_due': nxt}
class Answer(BaseModel): card_id: int; rating: int | None = None; choice: int | None = None; ms: int = 0
@app.post('/api/review/answer')
def review_answer(a: Answer):
    r = C.execute('SELECT * FROM cards WHERE id=?', (a.card_id,)).fetchone()
    if not r: raise HTTPException(404)
    res = {}
    if a.rating is None:  # режим выбора: проверяем сами
        correct = bool(a.choice == db.get(C, f'ans_{a.card_id}'))
        rating = 3 if correct else 1; res = {'correct': correct, 'answer': db.get(C, f'ans_{a.card_id}')}
    else: rating = a.rating
    nr = srs.review(C, a.card_id, rating, a.ms)
    if r['kind'] == 'recog' and rating >= 3 and (nr['reps'] or 0) >= 2: srs.unlock_followups(C, r['word_id'])
    C.commit(); return {**res, 'rating': rating, 'next_due': nr['due']}
# ---------- новые слова и сортировка ----------
def pick_new(kind, limit=1):
    intro = {r['word_id'] for r in C.execute("SELECT word_id FROM cards WHERE kind='recog'")}
    rs = C.execute('SELECT * FROM words ORDER BY level, freq').fetchall()
    out = []
    for w in rs:
        if w['id'] in intro: continue
        is_old = bool(w['old'] and w['old'] <= 3)
        if (kind == 'triage') == is_old: out.append(w)
        if len(out) >= limit: break
    return out
@app.get('/api/new/next')
def new_next(source: str = 'new'):
    ws = pick_new(source)
    if not ws: return {'empty': True}
    left = len(pick_new(source, 10000))
    return {'word': cards.word_view(C, ws[0]), 'left': left}
class NewAnswer(BaseModel): word_id: int; action: str  # learn | know
@app.post('/api/new/answer')
def new_answer(a: NewAnswer):
    if a.action == 'know':
        srs.seed_known(C, a.word_id, 'recog'); srs.seed_known(C, a.word_id, 'audio', stability=6.0, spread_days=14); srs.unlock_followups(C, a.word_id)
    else:
        srs.create_card(C, a.word_id, 'recog'); srs.create_card(C, a.word_id, 'audio', due=db.now() + timedelta(minutes=5))
    C.commit(); return {'ok': True}
# ---------- аудирование ----------
def l_view(row):
    it = json.loads(row['json']); out = {k: it[k] for k in ('id', 'type', 'level', 'question', 'options')}
    turns, q = audio.item_voices(it)
    out['turns'] = [{'spk': t['spk'], 'audio': audio.spec(tx, voice=v)} for t, (tx, v) in zip(it['turns'], turns)]
    out['question_audio'] = audio.spec(q[0], voice=q[1]); return out
@app.get('/api/listening/next')
def listening_next(level: int | None = None, exclude: str = ''):
    ex = [x for x in exclude.split(',') if x]
    stats = {r['item_id']: r for r in C.execute('SELECT item_id, COUNT(*) n, SUM(correct) c, MAX(ts) last FROM l_attempts WHERE mode!="dictation" GROUP BY item_id')}
    its = [r for r in C.execute('SELECT * FROM listening').fetchall() if r['id'] not in ex and (level is None or r['level'] == level)]
    if not its: return {'empty': True}
    def prio(r):
        s = stats.get(r['id'])
        if not s: return (0, random.random())            # ещё не решал
        if s['c'] < s['n']: return (1, s['last'])        # были ошибки
        return (2, s['last'])                            # остальные — давно решённые
    its.sort(key=prio); return l_view(its[0])
class LAnswer(BaseModel): item_id: str; choice: int; ms: int = 0; mode: str = 'exam'
@app.post('/api/listening/answer')
def listening_answer(a: LAnswer):
    r = C.execute('SELECT json FROM listening WHERE id=?', (a.item_id,)).fetchone()
    if not r: raise HTTPException(404)
    it = json.loads(r['json']); ok = a.choice == it['answer']
    C.execute('INSERT INTO l_attempts(item_id,ts,mode,correct,ms,answer) VALUES(?,?,?,?,?,?)', (a.item_id, db.iso(db.now()), a.mode, int(ok), a.ms, str(a.choice))); C.commit()
    return {'correct': ok, 'answer': it['answer'], 'explain': it.get('explain', ''), 'script': [{'spk': t['spk'], 'zh': t['zh']} for t in it['turns']], 'question': it['question'], 'options': it['options']}
def dict_sentences():
    out = [('e%d' % r['id'], r['zh'], r['pinyin']) for r in C.execute('SELECT id, zh, pinyin FROM examples')]
    for r in C.execute('SELECT json FROM listening'):
        it = json.loads(r['json'])
        for i, t in enumerate(it['turns']): out.append((f'l{it["id"]}_{i}', t['zh'], ' '.join(p[0] for p in __import__('pypinyin').pinyin(t['zh'], style=__import__('pypinyin').Style.TONE))))
    return out
@app.get('/api/dictation/next')
def dictation_next(exclude: str = ''):
    ex = set(exclude.split(','))
    pool = [s for s in dict_sentences() if s[0] not in ex]
    if not pool: return {'empty': True}
    sid, zh, py = random.choice(pool)
    return {'id': sid, 'audio': audio.spec(zh), 'length': len(re.sub(r'[，。！？、\s]', '', zh))}
class Dict(BaseModel): id: str; answer: str; mode: str = 'hanzi'; tones: bool = False; ms: int = 0
def _norm_py(s, tones):
    s = re.sub(r"[\s，。！？、,.!?']", '', s).lower()
    return s if tones else cards.strip_tones(s).replace('v', 'ü').replace('ü', 'v')
@app.post('/api/dictation/check')
def dictation_check(d: Dict):
    pool = {s[0]: s for s in dict_sentences()}; s = pool.get(d.id)
    if not s: raise HTTPException(404)
    _, zh, py = s
    if d.mode == 'hanzi':
        ref = re.sub(r'[，。！？、\s]', '', zh); ans = re.sub(r'[，。！？、,.!?\s]', '', d.answer)
        sm = difflib.SequenceMatcher(None, ref, ans); diff = []
        for op, a1, a2, b1, b2 in sm.get_opcodes(): diff.append({'op': op, 'ref': ref[a1:a2], 'ans': ans[b1:b2]})
        ok = ref == ans
    else:
        ref = _norm_py(py, d.tones); ans = _norm_py(d.answer, d.tones); ok = ref == ans
        sm = difflib.SequenceMatcher(None, ref, ans); diff = [{'op': op, 'ref': ref[a1:a2], 'ans': ans[b1:b2]} for op, a1, a2, b1, b2 in sm.get_opcodes()]
    C.execute('INSERT INTO l_attempts(item_id,ts,mode,correct,ms,answer) VALUES(?,?,?,?,?,?)', (d.id, db.iso(db.now()), 'dictation', int(ok), d.ms, d.answer)); C.commit()
    return {'correct': ok, 'zh': zh, 'pinyin': py, 'diff': diff, 'ratio': round(sm.ratio(), 2)}
# ---------- входной тест ----------
def grammar_points():
    return [json.loads(r['json']) for r in C.execute('SELECT json FROM grammar')]
@app.get('/api/placement/questions')
def placement_questions(n_vocab: int = 36, n_listen: int = 8):
    random.seed()
    ws = C.execute('SELECT * FROM words').fetchall()
    strata = {'old': [w for w in ws if w['old'] and w['old'] <= 3], 'l3': [w for w in ws if not (w['old'] and w['old'] <= 3) and w['level'] <= 3], 'l4': [w for w in ws if not (w['old'] and w['old'] <= 3) and w['level'] == 4]}
    take = {'old': n_vocab // 4, 'l3': n_vocab // 4, 'l4': n_vocab - 2 * (n_vocab // 4)}
    qs = []
    for k, lst in strata.items():
        for w in random.sample(lst, take[k]):
            ds = cards.same_pos_words(C, w); opts = [w] + ds; random.shuffle(opts)
            qs.append({'type': 'vocab', 'stratum': k, 'word_id': w['id'], 'hanzi': w['hanzi'], 'audio': audio.spec(w['hanzi']), 'options': [cards.short_ru(o) for o in opts], 'answer_idx': [o['id'] for o in opts].index(w['id'])})
    random.shuffle(qs)
    lis = C.execute('SELECT * FROM listening ORDER BY RANDOM() LIMIT ?', (n_listen,)).fetchall()
    for r in lis: qs.append({'type': 'listening', 'item': l_view(r)})
    for g in random.sample(grammar_points(), min(6, len(grammar_points()))):
        c = g['choice']; opts = c['options'][:]; random.shuffle(opts)
        qs.append({'type': 'grammar', 'point_id': g['id'], 'zh': c['zh'], 'options': opts, 'answer_idx': opts.index(c['options'][c['answer']])})
    return {'questions': qs}
class PlacementIn(BaseModel): vocab: list[dict]; listening: list[dict]; grammar: list[dict] = []
@app.post('/api/placement/submit')
def placement_submit(p: PlacementIn):
    strata = {}
    for r in p.vocab:
        s = strata.setdefault(r['stratum'], {'n': 0, 'c': 0}); s['n'] += 1; s['c'] += int(r['correct'])
        if r['correct']: srs.seed_known(C, r['word_id'], 'recog', stability=10.0, spread_days=14); srs.seed_known(C, r['word_id'], 'audio', stability=6.0, spread_days=18); srs.unlock_followups(C, r['word_id'])
    ws = C.execute('SELECT old, level FROM words').fetchall()
    size = {'old': sum(1 for w in ws if w['old'] and w['old'] <= 3), 'l3': sum(1 for w in ws if not (w['old'] and w['old'] <= 3) and w['level'] <= 3), 'l4': sum(1 for w in ws if not (w['old'] and w['old'] <= 3) and w['level'] == 4)}
    est = {k: (v['c'] / v['n'] if v['n'] else 0) for k, v in strata.items()}
    known = round(sum(size[k] * est.get(k, 0) for k in size)); total = len(ws)
    lis = [r for r in p.listening]; lacc = (sum(1 for r in lis if r['correct']) / len(lis)) if lis else None
    for r in lis: C.execute('INSERT INTO l_attempts(item_id,ts,mode,correct,ms,answer) VALUES(?,?,?,?,?,?)', (r['item_id'], db.iso(db.now()), 'placement', int(r['correct']), r.get('ms', 0), str(r.get('choice')))) 
    gr = p.grammar; gacc = (sum(1 for r in gr if r['correct']) / len(gr)) if gr else None
    for r in gr: C.execute('INSERT INTO g_attempts(point_id,kind,ts,correct,ms,answer) VALUES(?,?,?,?,?,?)', (r['point_id'], 'placement', db.iso(db.now()), int(r['correct']), 0, ''))
    s = plan.settings(C); exam = db.parse(s['exam'] + 'T00:00:00+00:00').date(); days = max(1, (exam - db.today()).days - 21)
    res = {'known_est': known, 'total': total, 'to_learn': total - known, 'per_day': round((total - known) / days, 1), 'strata': {k: {'asked': v['n'], 'correct': v['c']} for k, v in strata.items()}, 'strata_est_pct': {k: round(100 * v) for k, v in est.items()}, 'listening_acc': lacc, 'grammar_acc': gacc, 'days_to_intro_deadline': days}
    C.execute('INSERT INTO placement(ts,json) VALUES(?,?)', (db.iso(db.now()), json.dumps(res))); db.put(C, 'placement_done', True)
    if db.get(C, 'plan') is None: db.put(C, 'plan', plan.settings(C))
    C.commit(); return res
@app.get('/api/placement/last')
def placement_last():
    r = C.execute('SELECT * FROM placement ORDER BY id DESC LIMIT 1').fetchone(); return json.loads(r['json']) if r else None
# ---------- статика и аудио ----------
AUDIO_DIR.mkdir(exist_ok=True)
app.mount('/audio', StaticFiles(directory=str(AUDIO_DIR)), name='audio')
@app.get('/')
def index(): return FileResponse(WEB / 'index.html', headers={'Cache-Control': 'no-cache'})
app.mount('/', StaticFiles(directory=str(WEB)), name='web')
