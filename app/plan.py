"""План на 16 недель, блок «Сегодня», честный прогноз и статистика."""
import math, json
from datetime import timedelta, datetime, time
from . import db, srs
from .config import AVAILABLE
PHASES = [(1, 5, 'Набор слов и грамматики'), (6, 13, 'Закрепление и навыки (мини-пробники с 7-й недели)'), (14, 15, 'Полные пробные экзамены'), (16, 16, 'Финальная шлифовка')]
W = {'vocab': 0.40, 'listening': 0.20, 'grammar': 0.20, 'reading': 0.10, 'speaking': 0.10}
def phase_of(week):
    return next((p for p in PHASES if p[0] <= week <= p[1]), PHASES[-1])[2]
def settings(c):
    s = db.get(c, 'plan')
    if not s:
        st = db.today(); s = {'start': st.isoformat(), 'exam': (st + timedelta(weeks=16) - timedelta(days=2)).isoformat(), 'minutes': 120}
    return s
def end_of_today_utc():
    local = datetime.now().astimezone(); end = datetime.combine(local.date(), time(23, 59, 59), tzinfo=local.tzinfo)
    return db.iso(end)
def day_count(c, module, day=None):
    r = c.execute('SELECT seconds FROM activity WHERE day=? AND module=?', ((day or db.today()).isoformat(), module)).fetchone()
    return r['seconds'] if r else 0
def done_today(c):
    d0 = datetime.combine(db.today(), time(0, 0)).astimezone()
    iso0 = db.iso(d0)
    rev = c.execute("SELECT COUNT(*) n FROM reviews WHERE ts>=?", (iso0,)).fetchone()['n']
    new = c.execute("SELECT COUNT(*) n FROM cards WHERE kind='recog' AND state=1 AND created>=?", (iso0,)).fetchone()['n']
    tri = c.execute("SELECT COUNT(*) n FROM cards WHERE kind='recog' AND state=2 AND created>=?", (iso0,)).fetchone()['n']
    lis = c.execute("SELECT COUNT(*) n FROM l_attempts WHERE ts>=? AND mode!='dictation'", (iso0,)).fetchone()['n']
    dic = c.execute("SELECT COUNT(*) n FROM l_attempts WHERE ts>=? AND mode='dictation'", (iso0,)).fetchone()['n']
    gram = c.execute("SELECT COUNT(*) n FROM g_attempts WHERE ts>=? AND kind!='placement'", (iso0,)).fetchone()['n'] + c.execute("SELECT COUNT(*) n FROM queue WHERE ts>=?", (iso0,)).fetchone()['n']
    return {'grammar': gram, 'review': rev, 'new': new, 'triage': tri, 'listening': lis, 'dictation': dic}
def pools(c):
    """сколько слов ещё не введено: из старого HSK 3 (сортировка) и по-настоящему новых"""
    intro = {r['word_id'] for r in c.execute("SELECT word_id FROM cards WHERE kind='recog'")}
    rows = c.execute('SELECT id, old FROM words').fetchall()
    triage = sum(1 for r in rows if r['id'] not in intro and r['old'] and r['old'] <= 3)
    new = sum(1 for r in rows if r['id'] not in intro and not (r['old'] and r['old'] <= 3))
    return {'triage': triage, 'new': new, 'introduced': len(intro)}
def acc(c, table_sql, args=()):
    r = c.execute(table_sql, args).fetchone(); return (r['c'] / r['n']) if r and r['n'] else None
def listening_accuracy(c, days=14):
    since = db.iso(db.now() - timedelta(days=days))
    return acc(c, "SELECT SUM(correct) c, COUNT(*) n FROM l_attempts WHERE mode!='dictation' AND ts>=?", (since,))
def build_today(c):
    s = settings(c); start = db.parse(s['start'] + 'T00:00:00+00:00').date(); exam = db.parse(s['exam'] + 'T00:00:00+00:00').date()
    t = db.today(); day = (t - start).days + 1; week = max(1, math.ceil(day / 7)); days_left = (exam - t).days
    p = pools(c); intro_deadline = exam - timedelta(days=21); intro_days = max(1, (intro_deadline - t).days + 1)
    new_per_day = math.ceil(p['new'] / intro_days) if p['new'] else 0
    triage_today = min(p['triage'], max(40, math.ceil(p['triage'] / max(1, min(7, intro_days))))) if p['triage'] else 0
    due = c.execute('SELECT COUNT(*) n FROM cards WHERE due<=?', (end_of_today_utc(),)).fetchone()['n']
    la = listening_accuracy(c)
    budget = s['minutes']; blocks = []
    def add(key, title, minutes, target, unit, route, hint=''):
        blocks.append({'key': key, 'title': title, 'minutes': round(minutes), 'target': target, 'unit': unit, 'route': route, 'hint': hint, 'available': True})
    review_min = min(55, due * 0.22); add('review', 'Повторение карточек', review_min, due, 'карт', '#/review', 'FSRS: сначала то, что вот-вот забудется')
    if triage_today: add('triage', 'Сортировка слов старого HSK 3 (знаю / не знаю)', triage_today * 0.17, triage_today, 'слов', '#/triage', 'быстро отсеять знакомое; незнакомое пойдёт в изучение')
    if new_per_day: add('new', 'Новые слова', min(35, new_per_day * 1.3), new_per_day, 'слов', '#/new', 'знакомство со словом: значение, звук, пример')
    others = {'listening': ('Аудирование (задания в формате экзамена)', 1.0, '#/listening', 'слабое место №1'), 'grammar': ('Грамматика и письмо', 0.8, '#/grammar', 'слабое место №2: порядок слов, составление фраз'),
              'speaking': ('Говорение', 0.35, '#/speaking', 'устная часть нового HSK 4'), 'reading': ('Чтение', 0.5, '#/reading', 'тексты ≤ HSK 4')}
    used = sum(b['minutes'] for b in blocks); free = max(0, budget - used)
    avail = {k: v for k, v in others.items() if k in AVAILABLE}; wsum = sum(v[1] for v in avail.values()) or 1
    for k, v in others.items():
        if k in avail:
            m = free * v[1] / wsum
            if k == 'listening' and la is not None and la < 0.7: m *= 1.25
            if k == 'listening': m = min(m, 50)  # не больше 50 мин: банк заданий ограничен, остальное — когда появятся другие модули
            add(k, v[0], m, max(1, round(m / 1.5)), 'заданий', v[2], v[3])
        else:
            blocks.append({'key': k, 'title': v[0], 'minutes': 0, 'target': 0, 'unit': '', 'route': v[2], 'hint': 'модуль ещё не готов — минуты отданы другим блокам', 'available': False})
    done = done_today(c); dmap = {'grammar': done['grammar'], 'review': done['review'], 'new': done['new'], 'triage': done['triage'], 'listening': done['listening'] + done['dictation']}
    for b in blocks: b['done'] = dmap.get(b['key'], 0)
    total_min = sum(b['minutes'] for b in blocks)
    return {'date': t.isoformat(), 'day': day, 'week': week, 'weeks_total': 16, 'phase': phase_of(min(week, 16)), 'days_left': days_left,
            'exam': s['exam'], 'blocks': blocks, 'planned_minutes': total_min, 'pools': p, 'new_per_day': new_per_day,
            'minutes_today': round(sum(r['seconds'] for r in c.execute('SELECT seconds FROM activity WHERE day=?', (t.isoformat(),))) / 60, 1),
            'behind': behind(c, s, p, t, start, exam), 'queue_pending': c.execute("SELECT COUNT(*) n FROM queue WHERE status='pending'").fetchone()['n']}
def behind(c, s, p, t, start, exam):
    """отставание от линейного графика введения слов: слов и пропущенных дней"""
    total = c.execute('SELECT COUNT(*) n FROM words').fetchone()['n']
    intro_total_days = max(1, (exam - timedelta(days=21) - start).days + 1); elapsed = max(0, min((t - start).days, intro_total_days))
    planned = round(total * elapsed / intro_total_days); actual = p['introduced']
    missed = 0
    for i in range((t - start).days):
        d = (start + timedelta(days=i)).isoformat()
        if not c.execute('SELECT 1 FROM activity WHERE day=? AND seconds>=300', (d,)).fetchone(): missed += 1
    return {'words': max(0, planned - actual), 'planned_words': planned, 'actual_words': actual, 'missed_days': missed}
def streak(c):
    n = 0; d = db.today()
    if not c.execute('SELECT 1 FROM activity WHERE day=? AND seconds>=300', (d.isoformat(),)).fetchone(): d -= timedelta(days=1)
    while c.execute('SELECT 1 FROM activity WHERE day=? AND seconds>=300', (d.isoformat(),)).fetchone(): n += 1; d -= timedelta(days=1)
    return n
def grammar_acc(c, days=30):
    """(точность автопроверяемых упражнений, доля пунктов, в которых был хотя бы один верный ответ)"""
    since = db.iso(db.now() - timedelta(days=days))
    a = acc(c, "SELECT SUM(correct) c, COUNT(*) n FROM g_attempts WHERE ts>=?", (since,))
    total = c.execute('SELECT COUNT(*) n FROM grammar').fetchone()['n'] or 1
    covered = c.execute("SELECT COUNT(DISTINCT point_id) n FROM g_attempts WHERE correct=1 AND point_id LIKE 'G%'").fetchone()['n']
    return a, min(1.0, covered / total)
def writing_score(c, days=30):
    """средний балл проверенных вручную (/hsk-check) письменных ответов, 0..1"""
    since = db.iso(db.now() - timedelta(days=days)); vals = []
    for r in c.execute("SELECT feedback FROM queue WHERE status='checked' AND kind LIKE 'writing%' AND ts>=?", (since,)):
        try: vals.append(float(json.loads(r['feedback'])['score']) / 5)
        except Exception: pass
    return sum(vals) / len(vals) if vals else None
def forecast(c):
    """Только цифры. Слова: темп за последние 14 дней → прогноз выученных слов к дате экзамена."""
    s = settings(c); exam = db.parse(s['exam'] + 'T00:00:00+00:00').date(); t = db.today(); left = max(0, (exam - t).days)
    st = srs.word_status(c); total = st['total']; target = 0.90 * total  # цель: ≥90% списка со стабильностью ≥ 21 дня
    start = db.parse(s['start'] + 'T00:00:00+00:00').date(); days_active = max(1, min(14, (t - start).days + 1))
    first14 = db.iso(db.now() - timedelta(days=days_active))
    gained = c.execute("SELECT COUNT(*) n FROM cards WHERE kind='recog' AND state=2 AND stability>=? AND last_review>=?", (srs.KNOWN_STABILITY, first14)).fetchone()['n']
    rate = gained / days_active
    # слова в процессе доходят до «выученных» не мгновенно: считаем готовность по взвешенной стабильности
    projected = min(total, st['known'] + rate * max(0, left - 14) + 0.5 * st['learning'])
    vocab_pct = min(1.0, projected / target) if target else 0
    la = listening_accuracy(c, 30)
    ga, cov = grammar_acc(c); ws = writing_score(c)
    gparts = [x for x in (None if ga is None else ga * cov, ws) if x is not None]
    comp = {'vocab': vocab_pct, 'listening': la, 'grammar': (sum(gparts) / len(gparts)) if gparts else None, 'reading': None, 'speaking': None}
    have = {k: v for k, v in comp.items() if v is not None}; wsum = sum(W[k] for k in have)
    ready = sum(W[k] * have[k] for k in have) / wsum if wsum else 0
    need_rate = max(0, (target - st['known']) / max(1, left - 14)) if left > 14 else None
    msgs = []
    if st['known'] < target and need_rate is not None and rate < need_rate: msgs.append(f'Темп слов: {rate:.1f}/день, нужно {need_rate:.1f}/день до рубежа за 14 дней до экзамена.')
    if la is not None and la < 0.75: msgs.append(f'Аудирование: {la*100:.0f}% верных (цель ≥75%).')
    if la is None: msgs.append('Аудирование: нет данных — сделай задания.')
    if ga is not None and ga < 0.75: msgs.append(f'Грамматика: {ga*100:.0f}% верных (цель ≥75%), охвачено {cov*100:.0f}% пунктов.')
    if ga is None: msgs.append('Грамматика и письмо: нет данных.')
    pend = c.execute("SELECT COUNT(*) n FROM queue WHERE status='pending'").fetchone()['n']
    if pend: msgs.append(f'На проверке у Claude: {pend} письменных ответов — запусти /hsk-check.')
    return {'ready_pct': round(ready * 100), 'covered_weight': round(wsum * 100), 'components': {k: (None if v is None else round(v * 100)) for k, v in comp.items()},
            'grammar': {'acc': None if ga is None else round(ga * 100), 'covered_pct': round(cov * 100), 'writing_score_pct': None if ws is None else round(ws * 100)}, 'words': {**st, 'target': round(target), 'projected': round(projected), 'rate_per_day': round(rate, 1), 'need_rate': None if need_rate is None else round(need_rate, 1)},
            'days_left': left, 'messages': msgs, 'note': f'Оценка по доступным навыкам (вес {round(wsum*100)}% от экзамена). Чтение и говорение — пока без данных.'}
def stats(c):
    since = db.iso(db.now() - timedelta(days=30))
    kinds = c.execute('SELECT kind, SUM(correct) c, COUNT(*) n FROM reviews WHERE ts>=? GROUP BY kind', (since,)).fetchall()
    days = [{'day': r['day'], 'minutes': round(r['s'] / 60, 1)} for r in c.execute("SELECT day, SUM(seconds) s FROM activity WHERE day>=? GROUP BY day ORDER BY day", ((db.today() - timedelta(days=13)).isoformat(),))]
    week = sum(d['minutes'] for d in days[-7:])
    hard = c.execute("SELECT w.hanzi, w.pinyin, w.ru, SUM(1-r.correct) bad, COUNT(*) n FROM reviews r JOIN words w ON w.id=r.word_id GROUP BY r.word_id HAVING bad>0 ORDER BY bad DESC, n DESC LIMIT 15").fetchall()
    lbad = c.execute("SELECT item_id, SUM(1-correct) bad, COUNT(*) n FROM l_attempts GROUP BY item_id HAVING bad>0 ORDER BY bad DESC LIMIT 10").fetchall()
    gw = c.execute("SELECT point_id, SUM(1-correct) bad, COUNT(*) n FROM g_attempts WHERE point_id LIKE 'G%' GROUP BY point_id HAVING bad>0 ORDER BY bad DESC LIMIT 10").fetchall()
    return {'grammar_weak': [dict(r) for r in gw], 'queue_pending': c.execute("SELECT COUNT(*) n FROM queue WHERE status='pending'").fetchone()['n'], 'words': srs.word_status(c), 'accuracy': {r['kind']: round(100 * r['c'] / r['n']) for r in kinds if r['n']}, 'listening_acc': listening_accuracy(c, 30),
            'minutes_by_day': days, 'minutes_week': round(week), 'streak': streak(c), 'hard_words': [dict(r) for r in hard], 'hard_listening': [dict(r) for r in lbad]}
