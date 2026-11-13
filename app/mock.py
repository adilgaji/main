"""Пробные экзамены. Формат и шкала НЕ подтверждены официально (см. EXAM_SPEC.md): значения ниже — рабочие допущения."""
import json, random, re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from . import db, audio, srs, reading, cards
from .ctx import C
from .config import CONTENT
router = APIRouter(prefix='/api/mock')
# рабочие допущения по сторонним источникам; confirmed=False означает «не подтверждено официально»
FORMAT = {'confirmed': False, 'source': 'сторонние пересказы (Wikipedia/mandarinzone) — см. EXAM_SPEC.md',
          'full': {'listening': {'items': 32, 'minutes': 20}, 'reading': {'items': 32, 'minutes': 30}, 'writing': {'items': 6, 'minutes': 25}},
          'mini': {'listening': {'items': 12, 'minutes': 8}, 'reading': {'items': 12, 'minutes': 12}, 'writing': {'items': 3, 'minutes': 10}}}
SCALE = {'confirmed': False, 'per_section': 100, 'pass_total': 180, 'note': 'Условная шкала по старому HSK 4 (3 раздела × 100, проходной 180). Для нового формата официальная шкала не найдена.'}
def writing_bank(): return json.load(open(CONTENT / 'writing.json', encoding='utf-8'))
def compose(kind):
    f = FORMAT[kind]; sec = {}
    L = [json.loads(r['json']) for r in C.execute('SELECT json FROM listening')]; random.shuffle(L)
    sec['listening'] = [{'key': f'L:{x["id"]}', 'id': x['id']} for x in L[:f['listening']['items']]]
    R = []
    for it in reading.items():
        for k in reading.question_keys(it): R.append({'key': f'R:{k}', 'id': it['id'], 'q': int(k.split('#')[1]) if '#' in k else 0})
    random.shuffle(R); sec['reading'] = R[:f['reading']['items']]
    W = writing_bank(); n = f['writing']['items']; n_free = 2 if n >= 6 else 1; order = random.sample(W['order'], n - n_free)
    sec['writing'] = [{'key': f'W:{o["id"]}', 'id': o['id'], 'type': 'order'} for o in order]
    sec['writing'] += [{'key': f'W:{W["translate"][i]["id"]}', 'id': W['translate'][i]['id'], 'type': 'translate'} for i in random.sample(range(len(W['translate'])), 1)]
    if n_free == 2: sec['writing'].append({'key': 'W:S', 'id': 'S', 'type': 'sentence'})
    return sec
@router.get('/plan')
def plan(kind: str = 'full'):
    sec = compose(kind); last = C.execute("SELECT id, ts, json FROM mocks WHERE status='done' ORDER BY id DESC LIMIT 1").fetchone()
    return {'format': FORMAT, 'scale': SCALE, 'kind': kind, 'available': {k: len(v) for k, v in sec.items()}, 'wanted': {k: FORMAT[kind][k]['items'] for k in sec},
            'last': ({'ts': last['ts'], **{k: json.loads(last['json'])['result'][k] for k in ('total_scaled', 'pct')}} if last else None)}
class Start(BaseModel): kind: str = 'full'
@router.post('/start')
def start(s: Start):
    if s.kind not in ('full', 'mini'): raise HTTPException(400)
    sec = compose(s.kind); data = {'kind': s.kind, 'sections': sec, 'answers': {}, 'secs_used': {}, 'minutes': {k: FORMAT[s.kind][k]['minutes'] for k in sec}}
    cur = C.execute('INSERT INTO mocks(ts,kind,status,json) VALUES(?,?,?,?)', (db.iso(db.now()), s.kind, 'running', json.dumps(data, ensure_ascii=False))); C.commit()
    return {'id': cur.lastrowid, 'minutes': data['minutes'], 'counts': {k: len(v) for k, v in sec.items()}}
def _load(mid):
    r = C.execute('SELECT * FROM mocks WHERE id=?', (mid,)).fetchone()
    if not r: raise HTTPException(404)
    return r, json.loads(r['json'])
@router.get('/{mid}/section/{name}')
def section(mid: int, name: str):
    r, d = _load(mid); items = d['sections'].get(name)
    if items is None: raise HTTPException(404)
    out = []
    if name == 'listening':
        from .main import l_view
        for x in items: out.append({'key': x['key'], **l_view(C.execute('SELECT * FROM listening WHERE id=?', (x['id'],)).fetchone())})
    elif name == 'reading':
        allr = {i['id']: i for i in reading.items()}
        for x in items:
            it = allr[x['id']]; p = reading.public(it)
            if it['type'] == 'passage': p = {'id': it['id'], 'type': 'passage', 'text': it['text'], 'q': x['q'], 'question': it['questions'][x['q']]['q'], 'options': it['questions'][x['q']]['options']}
            out.append({'key': x['key'], **p})
    else:
        W = writing_bank()
        for x in items:
            if x['type'] == 'order':
                o = next(o for o in W['order'] if o['id'] == x['id']); parts = o['parts'][:]; random.shuffle(parts)
                out.append({'key': x['key'], 'type': 'order', 'parts': parts, 'hint': o['ru']})
            elif x['type'] == 'translate':
                t = next(t for t in W['translate'] if t['id'] == x['id']); out.append({'key': x['key'], 'type': 'translate', 'ru': t['ru'], 'words': t['words']})
            else:
                w = C.execute("SELECT * FROM words WHERE level>=3 ORDER BY RANDOM() LIMIT 1").fetchone(); out.append({'key': x['key'], 'type': 'sentence', 'word': cards.word_view(C, w, with_example=False)})
    return {'items': out, 'minutes': d['minutes'][name]}
class Submit(BaseModel): section: str; answers: dict = {}; secs_used: int = 0
@router.post('/{mid}/submit')
def submit(mid: int, s: Submit):
    r, d = _load(mid)
    if r['status'] != 'running': raise HTTPException(400, 'пробник уже завершён')
    d['answers'][s.section] = s.answers; d['secs_used'][s.section] = s.secs_used
    C.execute('UPDATE mocks SET json=? WHERE id=?', (json.dumps(d, ensure_ascii=False), mid)); C.commit(); return {'ok': True}
def _words_of(text, limit=6):
    from tools.validate_content import segment
    out = []
    for w in segment(text):
        row = C.execute('SELECT * FROM words WHERE hanzi=?', (w,)).fetchone()
        if row and row['id'] not in [x['id'] for x in out]: out.append(row)
    return out
@router.post('/{mid}/finish')
def finish(mid: int):
    r, d = _load(mid); res = {'sections': {}, 'review': [], 'queued': 0}; wrong_texts = []
    for name, items in d['sections'].items():
        ans = d['answers'].get(name, {}); ok = 0; auto_n = 0
        for x in items:
            a = ans.get(x['key']); correct = None; why = ''; shown = ''; text = ''
            if name == 'listening':
                it = json.loads(C.execute('SELECT json FROM listening WHERE id=?', (x['id'],)).fetchone()['json']); auto_n += 1
                correct = (a is not None and int(a) == it['answer']); shown = it['options'][it['answer']]; why = it.get('explain', ''); text = ' '.join(t['zh'] for t in it['turns']) + it['question']
            elif name == 'reading':
                it = next(i for i in reading.items() if i['id'] == x['id']); auto_n += 1
                correct, shown, why = reading.grade(it, x['q'], a if a is not None else (-1 if it['type'] == 'cloze' else ''))
                text = it.get('text', '') or ''.join(it.get('sentences', []))
                reading.record(x['key'].split(':', 1)[1], correct, 0, 'mock', a if a is not None else '', it)
            elif x['type'] == 'order':
                o = next(o for o in writing_bank()['order'] if o['id'] == x['id']); auto_n += 1
                correct = re.sub(r'[，。！？、\s/]', '', str(a or '')) == o['answer']; shown = o['answer']; why = o['ru']; text = o['answer']
            else:
                if a and str(a).strip():
                    C.execute('INSERT INTO queue(ts,kind,payload) VALUES(?,?,?)', (db.iso(db.now()), 'writing_translation' if x['type'] == 'translate' else 'writing_sentence', json.dumps({'item_id': x['id'], 'prompt': x.get('id'), 'answer': a, 'from': f'пробник #{mid}'}, ensure_ascii=False))); res['queued'] += 1
                continue
            ok += bool(correct)
            if not correct: res['review'].append({'section': name, 'key': x['key'], 'your': a, 'right': shown, 'explain': why}); wrong_texts.append(text)
        res['sections'][name] = {'correct': ok, 'auto_total': auto_n, 'pct': round(100 * ok / auto_n) if auto_n else None, 'items': len(items), 'secs_used': d['secs_used'].get(name)}
    pcts = [v['pct'] for v in res['sections'].values() if v['pct'] is not None]; res['pct'] = round(sum(pcts) / len(pcts)) if pcts else 0
    res['total_scaled'] = round(sum((v['pct'] or 0) for v in res['sections'].values()) * SCALE['per_section'] / 100)   # сумма по 3 разделам, максимум 300
    res['passed_provisional'] = res['total_scaled'] >= SCALE['pass_total']; res['scale_note'] = SCALE['note']
    # слабые слова -> в повторение (не более 12 слов за пробник)
    added = []
    for t in wrong_texts:
        for w in _words_of(t):
            if len(added) >= 12: break
            card = C.execute("SELECT * FROM cards WHERE word_id=? AND kind='recog'", (w['id'],)).fetchone()
            if card is None: srs.create_card(C, w['id'], 'recog'); srs.create_card(C, w['id'], 'audio'); added.append(w['hanzi'])
            else:   # слово уже в системе — показываем сегодня же
                C.execute("UPDATE cards SET due=? WHERE id=? AND due>?", (db.iso(db.now()), card['id'], db.iso(db.now()))); added.append(w['hanzi'])
    res['words_to_review'] = list(dict.fromkeys(added))
    d['result'] = res; C.execute("UPDATE mocks SET status='done', json=? WHERE id=?", (json.dumps(d, ensure_ascii=False), mid)); C.commit(); return res
@router.get('/history')
def history():
    out = []
    for r in C.execute("SELECT id, ts, kind, json FROM mocks WHERE status='done' ORDER BY id"):
        res = json.loads(r['json'])['result']; out.append({'id': r['id'], 'ts': r['ts'], 'kind': r['kind'], 'total_scaled': res['total_scaled'], 'pct': res['pct'], 'sections': {k: v['pct'] for k, v in res['sections'].items()}})
    return out
@router.get('/{mid}/result')
def result(mid: int):
    r, d = _load(mid); return d.get('result') or {}
