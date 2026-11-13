"""Имена аудиофайлов и голоса. Файлы создаёт tools/build_audio.py (edge-tts, на ноутбуке пользователя)."""
import hashlib
from .config import AUDIO_DIR
VOICES = {'F': ['zh-CN-XiaoxiaoNeural', 'zh-CN-XiaoyiNeural'], 'M': ['zh-CN-YunxiNeural', 'zh-CN-YunjianNeural', 'zh-CN-YunyangNeural']}
RATES = {'normal': '+0%', 'slow': '-35%'}
def pick_voice(text, gender=None):
    h = int(hashlib.sha1(text.encode('utf-8')).hexdigest(), 16)
    g = gender or ('F' if h % 2 == 0 else 'M')
    v = VOICES[g]; return v[(h >> 4) % len(v)]
def key(text, voice, speed='normal'):
    return hashlib.sha1(f'{voice}|{RATES[speed]}|{text}'.encode('utf-8')).hexdigest()[:20]
def spec(text, gender=None, voice=None):
    """что нужно клиенту, чтобы проиграть фразу: файл (если есть) или синтез браузера"""
    voice = voice or pick_voice(text, gender)
    out = {'text': text, 'voice': voice}
    for sp in RATES:
        k = key(text, voice, sp); out[sp] = f'/audio/{k}.mp3' if (AUDIO_DIR / f'{k}.mp3').exists() else None
    return out

def item_voices(it):
    """голоса для задания на аудирование: (текст, голос) для каждой реплики и для вопроса. Общая логика для сервера и build_audio"""
    voices = {}; out = []
    for t in it['turns']:
        v = voices.setdefault(t['spk'], pick_voice(it['id'] + t['spk'], t['spk'])); out.append((t['zh'], v))
    qv = pick_voice(it['id'] + 'Q', 'F' if it['turns'][0]['spk'] == 'M' else 'M')
    return out, (it['question'], qv)
def all_jobs(conn):
    """все фразы, которым нужен файл: (текст, голос). Предложения и аудирование — раньше отдельных слов"""
    import json
    jobs = []; seen = set()
    def add(t, v):
        if (t, v) not in seen: seen.add((t, v)); jobs.append((t, v))
    for r in conn.execute('SELECT json FROM listening'):
        turns, q = item_voices(json.loads(r[0]))
        for t, v in turns + [q]: add(t, v); add(t, pick_voice(t))   # второй вариант — для диктанта
    for r in conn.execute('SELECT zh FROM examples'): add(r[0], pick_voice(r[0]))
    for r in conn.execute('SELECT hanzi FROM words ORDER BY level, freq'): add(r[0], pick_voice(r[0]))
    return jobs
