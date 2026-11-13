"""Сводка из базы для команд Claude Code (/hsk-week, /hsk-refill): python tools/report.py [--json]"""
import sys, json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; sys.path.insert(0, str(ROOT))
from app import db, plan
c = db.connect(); db.init(c)
weak_kinds = c.execute("SELECT kind, ROUND(100.0*SUM(correct)/COUNT(*)) acc, COUNT(*) n FROM reviews GROUP BY kind").fetchall()
no_ex = c.execute("SELECT w.id, w.hanzi, w.pinyin, w.ru, w.level, (SELECT COUNT(*) FROM cards k WHERE k.word_id=w.id AND k.kind='recog') has_card FROM words w WHERE NOT EXISTS (SELECT 1 FROM examples e WHERE e.word_id=w.id) ORDER BY has_card DESC, w.level DESC, w.freq LIMIT 400").fetchall()
total_ex = c.execute('SELECT COUNT(*) FROM examples').fetchone()[0]; words_with_ex = c.execute('SELECT COUNT(DISTINCT word_id) FROM examples').fetchone()[0]
out = {'today': plan.build_today(c), 'forecast': plan.forecast(c), 'stats': plan.stats(c), 'accuracy_by_kind': [dict(r) for r in weak_kinds],
       'content': {'examples': total_ex, 'words_with_examples': words_with_ex, 'listening_items': c.execute('SELECT COUNT(*) FROM listening').fetchone()[0],
                   'words_without_examples_priority': [dict(r) for r in no_ex[:120]]},
       'queue_pending': [dict(r) for r in c.execute("SELECT id, kind, ts FROM queue WHERE status='pending'")]}
print(json.dumps(out, ensure_ascii=False, indent=1))
