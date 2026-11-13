"""Говорение: запись в браузере → faster-whisper → сравнение с ожидаемым. Содержательный разбор — через /hsk-check."""
import json, random, re, difflib, time
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from . import db, audio, stt
from .ctx import C
from .config import CONTENT, ROOT
router = APIRouter(prefix='/api/speaking')
REC = ROOT / 'recordings'
PUNCT = re.compile(r'[，。！？、；：“”"\'‘’（）()《》…—\-,.!?;:\s]+')
def _bank(): return json.load(open(CONTENT / 'speaking.json', encoding='utf-8'))
def norm(s): return PUNCT.sub('', s or '')
def repeat_pool():
    pool = [{'id': f'R{r["id"]}', 'zh': r['zh'], 'ru': r['ru']} for r in C.execute('SELECT id, zh, ru FROM examples') if len(norm(r['zh'])) >= 8]
    for r in C.execute("SELECT json FROM listening WHERE type='passage'"):
        it = json.loads(r['json'])
        for i, t in enumerate(it['turns']): pool.append({'id': f'RL{it["id"]}_{i}', 'zh': t['zh'], 'ru': ''})
    return pool
@router.get('/status')
def status(): return {**stt.status(), 'sessions_today': C.execute("SELECT COUNT(*) n FROM s_attempts WHERE ts>=?", (db.iso(datetime.now().astimezone().replace(hour=0, minute=0, second=0)),)).fetchone()['n']}
@router.get('/next')
def nxt(kind: str = 'repeat', exclude: str = ''):
    ex = set(exclude.split(','))
    if kind == 'repeat':
        pool = [p for p in repeat_pool() if p['id'] not in ex] or repeat_pool(); p = random.choice(pool)
        return {'kind': 'repeat', 'id': p['id'], 'zh': p['zh'], 'ru': p['ru'], 'audio': audio.spec(p['zh']), 'prompt': 'Послушай и повтори фразу:'}
    if kind == 'question':
        pool = [q for q in _bank()['question'] if q['id'] not in ex] or _bank()['question']; q = random.choice(pool)
        return {'kind': 'question', 'id': q['id'], 'zh': q['zh'], 'ru': q['ru'], 'words': q['words'], 'audio': audio.spec(q['zh']), 'prompt': 'Ответь на вопрос (2–4 предложения):'}
    if kind == 'retell':
        its = [json.loads(r['json']) for r in C.execute("SELECT json FROM listening WHERE type='passage'")]
        its = [i for i in its if i['id'] not in ex] or its; it = random.choice(its); text = ''.join(t['zh'] for t in it['turns'])
        from tools.validate_content import segment
        words = []
        for w in segment(text):
            if len(w) >= 2 and w not in words: words.append(w)
        return {'kind': 'retell', 'id': it['id'], 'words': words[:6], 'audios': [audio.spec(t['zh'], voice=audio.item_voices(it)[0][i][1]) for i, t in enumerate(it['turns'])], 'prompt': 'Послушай и перескажи своими словами:', 'text': text}
    if kind == 'monologue':
        pool = [m for m in _bank()['monologue'] if m['id'] not in ex] or _bank()['monologue']; m = random.choice(pool)
        return {'kind': 'monologue', 'id': m['id'], 'zh': m['zh'], 'ru': m['ru'], 'words': m['words'], 'prompt': 'Расскажи по теме (1 минута), используй слова:'}
    raise HTTPException(400)
def compare(kind, task_id, transcript):
    t = norm(transcript)
    if kind == 'repeat':
        ref = norm(next((p['zh'] for p in repeat_pool() if p['id'] == task_id), ''))
        sm = difflib.SequenceMatcher(None, ref, t); diff = [{'op': op, 'ref': ref[a1:a2], 'ans': t[b1:b2]} for op, a1, a2, b1, b2 in sm.get_opcodes() if op != 'equal']
        wrong = []  # номера знаков эталона, которые не прозвучали верно
        for op, a1, a2, b1, b2 in sm.get_opcodes():
            if op != 'equal': wrong += list(range(a1, a2))
        return {'ref': ref, 'ratio': round(sm.ratio(), 2), 'diff': diff, 'wrong_idx': wrong, 'score': round(sm.ratio(), 2)}
    words = []
    if kind == 'question': words = next((q['words'] for q in _bank()['question'] if q['id'] == task_id), [])
    elif kind == 'monologue': words = next((m['words'] for m in _bank()['monologue'] if m['id'] == task_id), [])
    else:
        r = C.execute('SELECT json FROM listening WHERE id=?', (task_id,)).fetchone()
        if r:
            from tools.validate_content import segment
            text = ''.join(x['zh'] for x in json.loads(r['json'])['turns']); words = [w for w in dict.fromkeys(segment(text)) if len(w) >= 2][:6]
    found = [w for w in words if w in t]; need = max(1, len(words)); length_ok = len(t) >= {'question': 8, 'retell': 20, 'monologue': 30}[kind]
    score = round(0.7 * len(found) / need + 0.3 * (1 if length_ok else len(t) / 30), 2)
    return {'found': found, 'missing': [w for w in words if w not in t], 'length': len(t), 'length_ok': length_ok, 'score': score}
@router.post('/upload')
async def upload(request: Request, kind: str, task_id: str, prompt: str = ''):
    data = await request.body()
    if len(data) < 1000: raise HTTPException(400, 'запись слишком короткая')
    REC.mkdir(exist_ok=True); ext = 'mp4' if 'mp4' in (request.headers.get('content-type') or '') else 'webm'
    path = REC / f'{datetime.now():%Y%m%d-%H%M%S}-{task_id}.{ext}'; path.write_bytes(data)
    try: res = stt.transcribe(path)
    except Exception as e: raise HTTPException(500, f'распознавание не удалось: {e}')
    cmp = compare(kind, task_id, res['text'])
    C.execute('INSERT INTO s_attempts(ts,kind,task_id,score,transcript,audio) VALUES(?,?,?,?,?,?)', (db.iso(db.now()), kind, task_id, cmp['score'], res['text'], str(path.name)))
    if kind != 'repeat' or cmp['score'] < 0.85:   # в очередь /hsk-check: все свободные ответы и плохо повторённые фразы
        C.execute('INSERT INTO queue(ts,kind,payload) VALUES(?,?,?)', (db.iso(db.now()), 'speaking', json.dumps({'task_kind': kind, 'item_id': task_id, 'prompt': prompt, 'transcript': res['text'], 'audio': str(path.name), 'auto': cmp, 'stt': {k: res[k] for k in ('device', 'model', 'secs')}}, ensure_ascii=False)))
    C.commit(); return {'transcript': res['text'], 'stt': {k: res[k] for k in ('device', 'model', 'secs')}, **cmp, 'queued': kind != 'repeat' or cmp['score'] < 0.85}
