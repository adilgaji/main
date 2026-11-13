import json, os, sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; sys.path.insert(0, str(ROOT))
os.environ['HSK_DB'] = str(Path(tempfile.mkdtemp()) / 'test.db')
from fastapi.testclient import TestClient
from app import cards, srs, db
from app.main import app, C
client = TestClient(app)
WORDS = json.load(open(ROOT / 'content/words.json', encoding='utf-8'))

def test_vocab_integrity():
    assert len(WORDS) == 1950 and len({w['hanzi'] for w in WORDS}) == 1950
    assert [sum(w['level'] == l for w in WORDS) for l in (1, 2, 3, 4)] == [294, 197, 487, 972]
    assert all(w['ru'].strip() for w in WORDS), 'у каждого слова есть русский перевод'
    assert all(w['en'].strip() and w['pinyin'].strip() for w in WORDS)
    assert not any(w['en'].startswith(('old variant', 'Taiwan pr', 'surname', 'abbr.')) for w in WORDS)
def test_polyphone_pinyin_fixed():
    d = {w['hanzi']: w['pinyin'] for w in WORDS}
    assert d['说'] == 'shuō' and d['听'] == 'tīng' and d['更'] == 'gèng' and d['还'] == 'hái' and d['吗'] == 'ma'
def test_tone_marks():
    assert cards.mark('xi3') == 'xǐ' and cards.mark('liu2') == 'liú' and cards.mark('hui4') == 'huì' and cards.mark('nv3'.replace('v', 'ü')) == 'nǚ'
    opts, ans = cards.tone_options('喜欢', 'xǐhuan')
    assert opts[ans] == 'xǐhuan' and len(set(opts)) == 4
def test_content_validator():
    from tools.validate_content import validate_sentence
    assert validate_sentence('我希望明天天气好。', '希望') == []
    assert validate_sentence('这个程序员的算法很复杂。')  # слова выше HSK 4 должны ловиться
    assert validate_sentence('我喜欢吃苹果。', '苹果') == []
def test_all_content_valid():
    from tools.validate_content import check_all
    assert check_all(verbose=True) == 0
def test_fsrs_scheduling():
    wid = 1; cid = srs.create_card(C, wid, 'recog'); C.commit()
    r1 = srs.review(C, cid, 3); r2 = srs.review(C, cid, 3); r3 = srs.review(C, cid, 3)
    assert r3['stability'] >= r1['stability'] and r3['reps'] == 3
    lapse = srs.review(C, cid, 1); assert lapse['stability'] < r3['stability'] or lapse['state'] != 2
def test_api_full_flow():
    assert client.get('/api/state').json()['placement_done'] is False
    q = client.get('/api/placement/questions').json()['questions']
    assert sum(x['type'] == 'vocab' for x in q) >= 30 and any(x['type'] == 'listening' for x in q)
    vocab = [{'stratum': x['stratum'], 'word_id': x['word_id'], 'correct': x['answer_idx'] % 2 == 0} for x in q if x['type'] == 'vocab']
    res = client.post('/api/placement/submit', json={'vocab': vocab, 'listening': []}).json()
    assert res['known_est'] + res['to_learn'] == 1950
    t = client.get('/api/today').json(); assert t['placement_done'] and t['blocks'] and 0 <= t['forecast']['ready_pct'] <= 100
    n = client.get('/api/new/next?source=new').json(); assert n['word']['ru']
    client.post('/api/new/answer', json={'word_id': n['word']['id'], 'action': 'learn'})
    r = client.get('/api/review/next').json(); assert r.get('card_id') or r.get('empty')
    if r.get('mode') == 'mcq': assert 'answer' not in r  # правильный ответ не утекает клиенту
    if r.get('card_id'):
        a = client.post('/api/review/answer', json={'card_id': r['card_id'], 'rating': 3, 'ms': 1000} if r['mode'] == 'reveal' else {'card_id': r['card_id'], 'choice': 0, 'ms': 1000}).json()
        assert 'next_due' in a
def test_listening_and_dictation():
    it = client.get('/api/listening/next').json(); assert len(it['options']) == 4 and 'answer' not in it
    ok = client.post('/api/listening/answer', json={'item_id': it['id'], 'choice': 0}).json(); assert isinstance(ok['correct'], bool) and ok['script']
    d = client.get('/api/dictation/next').json()
    r = client.post('/api/dictation/check', json={'id': d['id'], 'answer': ''}).json(); assert r['correct'] is False and r['zh']
    r2 = client.post('/api/dictation/check', json={'id': d['id'], 'answer': r['zh']}).json(); assert r2['correct'] is True
def test_stats_and_forecast():
    s = client.get('/api/stats').json(); assert 'words' in s and 'hard_words' in s
    f = client.get('/api/today').json()['forecast']; assert f['words']['total'] == 1950
def test_plan_reschedules_after_missed_days():
    t0 = client.get('/api/today').json()['new_per_day']
    st = client.get('/api/state').json()['plan']
    from datetime import date, timedelta
    client.post('/api/settings', json={'start': (date.today() - timedelta(days=20)).isoformat()})
    t1 = client.get('/api/today').json()
    assert t1['behind']['missed_days'] >= 15 and t1['behind']['words'] > 0
    client.post('/api/settings', json={'start': st['start']})

def test_grammar_content_complete():
    g = json.load(open(ROOT / 'content/grammar.json', encoding='utf-8'))
    import csv
    nos = {int(r['No']) for r in csv.DictReader(open(ROOT / 'data/raw/hsk30-grammar.csv', encoding='utf-8')) if r['Level'] == '4'}
    assert {x['no'] for x in g} == nos and len(g) == 76
    for x in g:
        assert ''.join(x['order']['parts']) == x['order']['answer'] and len(x['order']['parts']) >= 3
        c = x['choice']; assert len(set(c['options'])) == 4 and '___' in c['zh'] and 0 <= c['answer'] < 4
        assert x['ru'] and x['en'] and len(x['examples']) == 2
def test_grammar_flow():
    assert len(client.get('/api/grammar/list').json()) == 76
    for kind in ('order', 'choice'):
        q = client.get(f'/api/grammar/next?kind={kind}').json(); assert 'answer' not in q
        wrong = client.post('/api/grammar/answer', json={'point_id': q['point_id'], 'kind': kind, 'answer': 'zzz'}).json(); assert wrong['correct'] is False and wrong['rule']
        right = client.post('/api/grammar/answer', json={'point_id': q['point_id'], 'kind': kind, 'answer': wrong['answer'] if kind == 'choice' else wrong['answer']}).json()
        if kind == 'order': assert right['correct'] is True
    assert client.get('/api/grammar/point/G249').json()['examples']
def test_writing_and_queue():
    o = client.get('/api/writing/next?kind=order').json(); assert len(o['parts']) >= 3
    r = client.post('/api/writing/order', json={'id': o['id'], 'answer': ''.join(o['parts'])}).json(); assert 'answer' in r
    assert client.post('/api/writing/order', json={'id': o['id'], 'answer': r['answer']}).json()['correct'] is True
    t = client.get('/api/writing/next?kind=translate').json()
    s = client.post('/api/writing/submit', json={'kind': 'translate', 'id': t['id'], 'answer': '我想申请奖学金。', 'prompt': t['ru']}).json(); assert s['queued'] and s['reference']
    assert client.post('/api/writing/submit', json={'kind': 'sentence', 'id': 'S1', 'answer': ' '}).status_code == 400
    sent = client.get('/api/writing/next?kind=sentence').json(); assert sent['word']['hanzi']
    assert client.get('/api/writing/next?kind=describe').json()['words']
    q = client.get('/api/queue').json(); assert q and q[0]['status'] == 'pending'
    assert client.get('/api/today').json()['queue_pending'] >= 1
    # имитация /hsk-check: записываем разбор, прогноз учитывает балл
    C.execute("UPDATE queue SET status='checked', feedback=? WHERE id=?", (json.dumps({'score': 4, 'errors': []}), q[0]['id'])); C.commit()
    f = client.get('/api/today').json()['forecast']; assert f['grammar']['writing_score_pct'] == 80 and f['components']['grammar'] is not None
def test_placement_has_grammar():
    qs = client.get('/api/placement/questions').json()['questions']; assert sum(x['type'] == 'grammar' for x in qs) == 6
