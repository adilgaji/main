"""Равномерно распределяет позицию правильного ответа (A/B/C/D) в банках заданий — чтобы ответ нельзя было угадать по позиции.
Запускать после добавления новых заданий (/hsk-refill это делает). Детерминированно: python tools/balance_answers.py"""
import json, random, collections
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
def place(options, answer, target, rng):
    right = options[answer]; others = [o for i, o in enumerate(options) if i != answer]; rng.shuffle(others)
    out = others[:target] + [right] + others[target:]; return out, target
def run():
    for f in sorted((ROOT / 'content/src').glob('listening_*.json')) + sorted((ROOT / 'content/src').glob('reading_*.json')):
        data = json.load(open(f, encoding='utf-8')); n = 0; cnt = collections.Counter()
        for it in data:
            rng = random.Random(it['id'])
            if it['type'] in ('dialog', 'passage') and 'turns' in it or it['type'] == 'cloze':
                it['options'], it['answer'] = place(it['options'], it['answer'], n % 4, rng); n += 1; cnt[it['answer']] += 1
            elif it['type'] == 'passage':
                for q in it['questions']: q['options'], q['answer'] = place(q['options'], q['answer'], n % 4, rng); n += 1; cnt[q['answer']] += 1
        json.dump(data, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print(f.name, dict(sorted(cnt.items())))
if __name__ == '__main__': run()
