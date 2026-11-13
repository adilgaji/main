"""Запасные движки озвучки — на случай, если Kokoro не запустился.

  1. Piper   — работает на компьютере без интернета (модель ≈ 60 МБ в models/piper).
  2. edge-tts — голос Microsoft через интернет; последний резерв.

Оба выдают тот же результат, что и Kokoro: звук + время каждого слова. Отличия:
  • Piper не сообщает время слов. Текст озвучивается кусками по 1–3 предложения, длина
    каждого куска известна точно, а внутри куска время слов рассчитывается по длине слов
    (у таких слов пометка estimated). Подсветка в субтитрах может отставать на доли секунды.
  • edge-tts время слов сообщает сам; словарь произношений к нему не применяется.
Распознавание речи (Whisper) не используется нигде.
"""
from __future__ import annotations

import asyncio
import logging
import subprocess
import time
from collections.abc import Callable
from pathlib import Path

import numpy as np

from factory import audio as ffm
from factory.paths import MODELS_DIR
from factory.tts import pronunciation as pron
from factory.tts.kokoro_engine import Narration, TTSError, Word, _fade, audible_bounds
from factory.tts.text import make_chunks, normalize
from factory.tts.voices import VOICES, accent_of

log = logging.getLogger("factory.tts")

PIPER_DIR = MODELS_DIR / "piper"
PIPER_REPO = "rhasspy/piper-voices"
# (акцент, пол) → голос. Подбирается по голосу Kokoro, выбранному владельцем.
PIPER_VOICES = {
    ("us", "male"): "en_US-ryan-medium",
    ("us", "female"): "en_US-amy-medium",
    ("gb", "male"): "en_GB-alan-medium",
    ("gb", "female"): "en_GB-alba-medium",
}
EDGE_VOICES = {
    ("us", "male"): "en-US-GuyNeural",
    ("us", "female"): "en-US-JennyNeural",
    ("gb", "male"): "en-GB-RyanNeural",
    ("gb", "female"): "en-GB-SoniaNeural",
}
EDGE_RATE = 24000


def _kind(voice: str) -> tuple[str, str]:
    v = VOICES.get(voice)
    return accent_of(voice), (v.gender if v else ("female" if voice[1:2] == "f" else "male"))


def piper_voice_for(voice: str) -> str:
    return PIPER_VOICES[_kind(voice)]


def edge_voice_for(voice: str) -> str:
    return EDGE_VOICES[_kind(voice)]


def piper_files(name: str) -> tuple[str, str]:
    """Пути файлов голоса внутри хранилища rhasspy/piper-voices."""
    locale, speaker, quality = name.split("-")
    base = f"{locale[:2]}/{locale}/{speaker}/{quality}/{name}.onnx"
    return base, base + ".json"


def piper_model_path(name: str) -> Path:
    return PIPER_DIR / piper_files(name)[0]


def spread_words(tokens: list[str], start: float, end: float) -> list[tuple[float, float]]:
    """Делит отрезок [start, end] между словами пропорционально их «весу».

    Вес — число букв и цифр плюс пауза после знака препинания. Отдельно стоящее тире
    звука не даёт и получает нулевую длину.
    """
    weights = []
    for tok in tokens:
        letters = sum(1 for c in tok if c.isalnum())
        if letters == 0:
            weights.append((0.0, 0.0))
            continue
        pause = 3.0 if tok[-1:] in ".!?…" or tok[-2:-1] in ".!?" else 1.5 if tok[-1:] in ",;:" else 0.0
        weights.append((1.5 + letters, pause))
    total = sum(a + b for a, b in weights) or 1.0
    out, t = [], start
    for a, b in weights:
        d = (end - start) * a / total
        out.append((t, t + d))
        t += d + (end - start) * b / total
    return out


# misaki (Kokoro) → IPA для espeak: буквы-сокращения дифтонгов разворачиваются.
_MISAKI_TO_IPA = {"A": "eɪ", "I": "aɪ", "W": "aʊ", "Y": "ɔɪ", "O": "oʊ", "Q": "əʊ", "T": "ɾ", "ᵊ": "ə", "ᵻ": "ɪ", "ʧ": "tʃ", "ʤ": "dʒ", "ɡ": "ɡ"}


def to_espeak(phonemes: str) -> str:
    return "".join(_MISAKI_TO_IPA.get(ch, ch) for ch in phonemes)


def piper_text(chunk: str, accent: str, dictionary: pron.Dictionary) -> str:
    """Слова из словаря произношений заменяются записью [[ фонемы ]], которую понимает Piper."""
    out = []
    for tok in chunk.split():
        core = tok.strip(".,;:!?…\"'()[]“”‘’—-")
        entry = dictionary.get(core) if core else None
        if entry is None:
            out.append(tok)
            continue
        head, tail = tok.split(core, 1) if core in tok else ("", "")
        out.append(f"{head}[[ {to_espeak(entry.phonemes(accent))} ]]{tail}")
    return " ".join(out)


def assemble(
    text: str,
    voice: str,
    speed: float,
    engine: str,
    device: str,
    sample_rate: int,
    synth_chunk: Callable[[str], tuple[np.ndarray, list[tuple[float, float]] | None]],
    sentence_gap: float = 0.45,
    paragraph_gap: float = 0.85,
    lead: float = 0.25,
    tail: float = 0.45,
    max_chars: int = 280,
    warnings: list[str] | None = None,
) -> Narration:
    """Общая сборка: куски → один звук + слова со временем (как у Kokoro)."""
    clean = normalize(text)
    chunks = make_chunks(clean, max_chars=max_chars)
    if not chunks:
        raise TTSError("Пустой текст — озвучивать нечего.")
    t0 = time.time()
    sr = sample_rate
    pieces = [np.zeros(int(lead * sr), dtype=np.float32)]
    cursor = lead
    words: list[Word] = []
    pad_in, pad_out = 0.05, 0.10
    for ci, chunk in enumerate(chunks):
        audio, times = synth_chunk(chunk.text)
        audio = np.asarray(audio, dtype=np.float32)
        total = len(audio) / sr
        on, off = audible_bounds(audio, sr)
        cut_a, cut_b = max(0.0, on - pad_in), min(total, off + pad_out)
        if times:
            cut_a = min(cut_a, max(0.0, min(s for s, _ in times) - 0.02))
        a = _fade(audio[int(cut_a * sr): int(cut_b * sr)].copy(), sr)
        length = len(a) / sr
        tokens = chunk.text.split()
        estimated = times is None
        if times is None:
            times = spread_words(tokens, min(pad_in, length), max(length - pad_out, 0.0))
        else:
            times = [(max(0.0, s - cut_a), min(length, e - cut_a)) for s, e in times]
        sent_ids: list[int] = []
        for k, s in enumerate(chunk.sentences):
            sent_ids.extend([chunk.first_sentence + k] * len(s.split()))
        for tok, (s, e), sid in zip(tokens, times, sent_ids):
            words.append(Word(tok, cursor + s, cursor + max(s, e), chunk.paragraph, sid, estimated))
        pieces.append(a)
        cursor += length
        if ci + 1 < len(chunks):
            gap = paragraph_gap if chunks[ci + 1].paragraph != chunk.paragraph else sentence_gap
            n = int(max(0.0, gap - pad_in - pad_out) * sr)
            pieces.append(np.zeros(n, dtype=np.float32))
            cursor += n / sr
    pieces.append(np.zeros(int(tail * sr), dtype=np.float32))
    audio = np.concatenate(pieces)
    peak = float(np.abs(audio).max()) if len(audio) else 0.0
    if peak > 0.98:
        audio = audio * (0.98 / peak)
    if [w.text for w in words] != clean.split():
        raise TTSError("Внутренняя ошибка озвучки: слова со временем не совпали с текстом.")
    return Narration(
        audio=audio, sample_rate=sr, text=clean, words=words, voice=voice, speed=speed, device=device,
        engine=engine, synth_seconds=time.time() - t0, warnings=list(warnings or []),
    )


# ---------------------------------------------------------------- Piper

_piper_cache: dict[str, object] = {}


def _load_piper(name: str):
    if name in _piper_cache:
        return _piper_cache[name]
    try:
        from piper import PiperVoice
    except Exception as e:  # noqa: BLE001
        raise TTSError(f"Запасной голос Piper не установлен ({type(e).__name__}). Установка: pip install piper-tts") from e
    model = piper_model_path(name)
    if not model.exists() or not Path(str(model) + ".json").exists():
        raise TTSError(f"Запасной голос Piper «{name}» не скачан. Скачать: python scripts/download_models.py --piper")
    try:
        voice = PiperVoice.load(str(model))
    except Exception as e:  # noqa: BLE001
        raise TTSError(f"Piper не смог загрузить голос «{name}»: {e}") from e
    _piper_cache[name] = voice
    return voice


def narrate_piper(text: str, voice: str, speed: float = 1.0, dictionary: pron.Dictionary | None = None, **kwargs) -> Narration:
    from piper import SynthesisConfig

    name = piper_voice_for(voice)
    pv = _load_piper(name)
    cfg = SynthesisConfig(length_scale=1.0 / max(0.5, min(2.0, speed)))
    dictionary = dictionary or pron.load_dictionary()
    accent = accent_of(voice)

    def synth(chunk: str) -> tuple[np.ndarray, None]:
        parts = [np.asarray(c.audio_float_array, dtype=np.float32) for c in pv.synthesize(piper_text(chunk, accent, dictionary), syn_config=cfg)]
        if not parts:
            raise TTSError("Piper вернул пустой звук.")
        return np.concatenate(parts), None

    kwargs = {k: v for k, v in kwargs.items() if k in ("sentence_gap", "paragraph_gap", "lead", "tail", "max_chars")}
    note = f"Озвучено запасным голосом Piper ({name}): время слов внутри фраз рассчитано, а не получено от модели."
    return assemble(text, voice, speed, f"piper:{name}", "cpu", pv.config.sample_rate, synth, warnings=[note], **kwargs)


# ---------------------------------------------------------------- edge-tts

def _decode_mp3(data: bytes) -> np.ndarray:
    p = subprocess.run(
        [ffm.ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", str(EDGE_RATE), "pipe:1"],
        input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    if p.returncode != 0 or not p.stdout:
        raise TTSError("Не удалось разобрать звук, полученный от edge-tts.")
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


def edge_times(tokens: list[str], marks: list[tuple[float, float]]) -> list[tuple[float, float]] | None:
    """Раздаёт отметки времени словам. None — отметок не столько, сколько слов (тогда время рассчитывается)."""
    spoken = [i for i, t in enumerate(tokens) if any(c.isalnum() for c in t)]
    if len(marks) != len(spoken) or not spoken:
        return None
    out: list[tuple[float, float]] = [(0.0, 0.0)] * len(tokens)
    for i, (s, d) in zip(spoken, marks):
        out[i] = (s, s + d)
    last = 0.0
    for i in range(len(tokens)):  # тире и прочие знаки без звука — точка сразу после предыдущего слова
        if i in spoken:
            last = out[i][1]
        else:
            out[i] = (last, last)
    return out


def narrate_edge(text: str, voice: str, speed: float = 1.0, **kwargs) -> Narration:
    try:
        import edge_tts
    except Exception as e:  # noqa: BLE001
        raise TTSError(f"Запасной онлайн-голос edge-tts не установлен ({type(e).__name__}). Установка: pip install edge-tts") from e
    name = edge_voice_for(voice)
    rate = f"{round((speed - 1) * 100):+d}%"

    async def one(chunk: str) -> tuple[bytes, list[tuple[float, float]]]:
        com = edge_tts.Communicate(chunk, name, rate=rate, boundary="WordBoundary")
        data, marks = bytearray(), []
        async for ev in com.stream():
            if ev["type"] == "audio":
                data += ev["data"]
            elif ev["type"] == "WordBoundary":
                marks.append((ev["offset"] / 1e7, ev["duration"] / 1e7))
        return bytes(data), marks

    def synth(chunk: str) -> tuple[np.ndarray, list[tuple[float, float]] | None]:
        try:
            data, marks = asyncio.run(one(chunk))
        except Exception as e:  # noqa: BLE001
            raise TTSError(f"edge-tts не ответил (нужен интернет): {type(e).__name__}: {e}") from e
        return _decode_mp3(data), edge_times(chunk.split(), marks)

    kwargs = {k: v for k, v in kwargs.items() if k in ("sentence_gap", "paragraph_gap", "lead", "tail", "max_chars")}
    note = f"Озвучено запасным онлайн-голосом edge-tts ({name}): словарь произношений не применялся."
    return assemble(text, voice, speed, f"edge:{name}", "online", EDGE_RATE, synth, warnings=[note], **kwargs)
