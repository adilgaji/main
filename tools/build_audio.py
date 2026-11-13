"""Генерация озвучки через edge-tts (бесплатно, нужен интернет/VPN). Запускается из start.bat и вручную:
    python tools/build_audio.py            # досоздать недостающие файлы (обычная и медленная скорость)
    python tools/build_audio.py --limit 200  # только первые 200 новых
Если файла нет, приложение само озвучивает речью браузера."""
import asyncio, sys, argparse, sqlite3
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; sys.path.insert(0, str(ROOT))
from app import audio, db
from app.config import AUDIO_DIR
ap = argparse.ArgumentParser(); ap.add_argument('--limit', type=int, default=0); ap.add_argument('--fake', action='store_true', help='только для тестов: пустые файлы'); ap.add_argument('--workers', type=int, default=6)
args = ap.parse_args(); AUDIO_DIR.mkdir(exist_ok=True)
conn = db.connect(); db.init(conn)  # на случай, если сервер ещё не создал базу
todo = [(t, v, sp) for t, v in audio.all_jobs(conn) for sp in audio.RATES if not (AUDIO_DIR / f'{audio.key(t, v, sp)}.mp3').exists()]
if args.limit: todo = todo[:args.limit]
print(f'Нужно создать файлов: {len(todo)}', flush=True)
async def one(sem, t, v, sp, stats):
    path = AUDIO_DIR / f'{audio.key(t, v, sp)}.mp3'
    async with sem:
        for attempt in range(4):
            try:
                if args.fake: path.write_bytes(b'\xff\xfb\x90\x00' + b'\x00' * 413)
                else:
                    import edge_tts
                    await edge_tts.Communicate(t, v, rate=audio.RATES[sp]).save(str(path) + '.tmp'); Path(str(path) + '.tmp').replace(path)
                stats['ok'] += 1; break
            except Exception as e:
                if attempt == 3: stats['fail'] += 1; stats['err'] = repr(e)
                else: await asyncio.sleep(1.5 * (attempt + 1))
        if (stats['ok'] + stats['fail']) % 100 == 0: print(f"  {stats['ok'] + stats['fail']} / {len(todo)}", flush=True)
async def main():
    sem = asyncio.Semaphore(args.workers); stats = {'ok': 0, 'fail': 0}
    await asyncio.gather(*(one(sem, t, v, sp, stats) for t, v, sp in todo))
    print(f"Готово: создано {stats['ok']}, ошибок {stats['fail']}", stats.get('err', ''))
    if stats['fail'] and not stats['ok']: print('Не удалось связаться с edge-tts. Включи VPN и запусти start.bat ещё раз. Пока работает голос браузера.'); sys.exit(2)
asyncio.run(main())
