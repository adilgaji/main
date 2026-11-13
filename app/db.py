import sqlite3, json, hashlib, re, logging
from datetime import datetime, timezone, timedelta
from pypinyin import pinyin, Style
from .config import DB_PATH, CONTENT
log = logging.getLogger('hsk')
SCHEMA = """
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS words(id INTEGER PRIMARY KEY, hanzi TEXT, pinyin TEXT, en TEXT, ru TEXT, pos TEXT, level INT, old INT, freq INT);
CREATE TABLE IF NOT EXISTS examples(id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT UNIQUE, word_id INT, zh TEXT, pinyin TEXT, ru TEXT);
CREATE TABLE IF NOT EXISTS cards(id INTEGER PRIMARY KEY AUTOINCREMENT, word_id INT, kind TEXT, due TEXT, stability REAL, difficulty REAL, state INT, step INT, last_review TEXT, reps INT DEFAULT 0, lapses INT DEFAULT 0, created TEXT, UNIQUE(word_id, kind));
CREATE INDEX IF NOT EXISTS cards_due ON cards(due);
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY AUTOINCREMENT, card_id INT, word_id INT, kind TEXT, ts TEXT, rating INT, correct INT, ms INT);
CREATE TABLE IF NOT EXISTS listening(id TEXT PRIMARY KEY, type TEXT, level INT, json TEXT);
CREATE TABLE IF NOT EXISTS l_attempts(id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT, ts TEXT, mode TEXT, correct INT, ms INT, answer TEXT);
CREATE TABLE IF NOT EXISTS activity(day TEXT, module TEXT, seconds INT DEFAULT 0, PRIMARY KEY(day, module));
CREATE TABLE IF NOT EXISTS placement(id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, json TEXT);
CREATE TABLE IF NOT EXISTS grammar(id TEXT PRIMARY KEY, no INT, json TEXT);
CREATE TABLE IF NOT EXISTS g_attempts(id INTEGER PRIMARY KEY AUTOINCREMENT, point_id TEXT, kind TEXT, ts TEXT, correct INT, ms INT, answer TEXT);
CREATE TABLE IF NOT EXISTS queue(id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, kind TEXT, payload TEXT, status TEXT DEFAULT 'pending', feedback TEXT);
"""
def now(): return datetime.now(timezone.utc)
def iso(dt): return dt.astimezone(timezone.utc).isoformat()
def parse(s): return datetime.fromisoformat(s)
def today():  # локальная дата пользователя
    return datetime.now().astimezone().date()
def connect(path=None):
    c = sqlite3.connect(str(path or DB_PATH), check_same_thread=False); c.row_factory = sqlite3.Row
    c.execute('PRAGMA journal_mode=WAL'); return c
def init(c):
    c.executescript(SCHEMA); sync_content(c); c.commit()
def get(c, k, default=None):
    r = c.execute('SELECT v FROM settings WHERE k=?', (k,)).fetchone()
    return json.loads(r['v']) if r else default
def put(c, k, v):
    c.execute('INSERT INTO settings VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', (k, json.dumps(v, ensure_ascii=False))); c.commit()
def sync_content(c):
    words = json.load(open(CONTENT / 'words.json', encoding='utf-8'))
    c.executemany('INSERT OR REPLACE INTO words(id,hanzi,pinyin,en,ru,pos,level,old,freq) VALUES(?,?,?,?,?,?,?,?,?)',
        [(w['id'], w['hanzi'], w['pinyin'], w['en'], w['ru'], w['pos'], w['level'], w['old'], w['freq']) for w in words])
    by = {w['hanzi']: w['id'] for w in words}
    from tools.validate_content import validate_sentence  # импорт здесь: jieba грузится долго
    for f in sorted((CONTENT / 'src').glob('examples_*.jsonl')):
        for ln in f.read_text(encoding='utf-8').splitlines():
            if not ln.strip(): continue
            e = json.loads(ln); uid = hashlib.sha1((e['w'] + e['zh']).encode()).hexdigest()[:16]
            if c.execute('SELECT 1 FROM examples WHERE uid=?', (uid,)).fetchone(): continue
            if e['w'] not in by or validate_sentence(e['zh'], e['w']): log.warning('пример отклонён: %s', e['zh']); continue
            py = ' '.join(p[0] for p in pinyin(e['zh'], style=Style.TONE))
            c.execute('INSERT INTO examples(uid,word_id,zh,pinyin,ru) VALUES(?,?,?,?,?)', (uid, by[e['w']], e['zh'], py, e['ru']))
    gf = CONTENT / 'grammar.json'
    if gf.exists():
        for g in json.load(open(gf, encoding='utf-8')): c.execute('INSERT OR REPLACE INTO grammar(id,no,json) VALUES(?,?,?)', (g['id'], g['no'], json.dumps(g, ensure_ascii=False)))
    for f in sorted((CONTENT / 'src').glob('listening_*.json')):
        for it in json.load(open(f, encoding='utf-8')):
            c.execute('INSERT OR REPLACE INTO listening(id,type,level,json) VALUES(?,?,?,?)', (it['id'], it['type'], it.get('level', 3), json.dumps(it, ensure_ascii=False)))
    c.commit()
