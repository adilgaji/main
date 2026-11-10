"""Озвучка текста.

Порядок движков: Kokoro (локально, GPU → CPU) → Piper (локально, CPU) → edge-tts (онлайн, бесплатно).
Результат: voice.wav (48 кГц, моно), громкость выровнена (−16 LUFS), по краям небольшая тишина,
чтобы слова не обрезались.

Запуск вручную:
    python pipeline/tts.py "Text to speak" output/test/voice.wav
"""
from __future__ import annotations

import argparse
import asyncio
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import MODELS, Log, ffprobe_duration, gpu_available, run  # noqa: E402

DEFAULT_VOICE = "am_fenrir"  # выбран пользователем; запасные: am_michael, af_heart, bf_emma
SPEED = 0.85  # чуть медленнее обычного — легче успевать за субтитрами
SENTENCE_PAUSE = 0.35  # пауза между предложениями, сек


def clean_text(text: str) -> str:
    """Убрать разметку ключевых слов (*слово*) и лишние пробелы."""
    text = re.sub(r"[*_]", "", text)
    return re.sub(r"\s+", " ", text).strip()


# ----------------------------------------------------------------- Kokoro
def _kokoro(text: str, raw_wav: Path, voice: str, log: Log, device: str):
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline

    pipe = KPipeline(lang_code="a" if voice.startswith("a") else "b", repo_id="hexgrad/Kokoro-82M", device=device)
    chunks = []
    gap = np.zeros(int(24000 * SENTENCE_PAUSE), dtype=np.float32)
    # каждое предложение отдельно, между ними — пауза: голос не «тараторит»
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    for sent in sentences:
        for _, _, audio in pipe(sent, voice=voice, speed=SPEED, split_pattern=r"\n+"):
            chunks.append(audio.numpy() if hasattr(audio, "numpy") else audio)
        chunks.append(gap)
    if not chunks:
        raise RuntimeError("Kokoro не вернул звук")
    sf.write(raw_wav, np.concatenate(chunks), 24000)


def kokoro(text: str, raw_wav: Path, voice: str, log: Log):
    if gpu_available():
        try:
            log("Озвучка: Kokoro на видеокарте (CUDA)")
            return _kokoro(text, raw_wav, voice, log, "cuda")
        except Exception as e:  # noqa: BLE001
            log(f"Видеокарта не сработала ({str(e)[:200]}) — переключаюсь на процессор")
    log("Озвучка: Kokoro на процессоре")
    return _kokoro(text, raw_wav, voice, log, "cpu")


# ----------------------------------------------------------------- Piper
PIPER_VOICE = "en_US-ryan-high"


def piper(text: str, raw_wav: Path, voice: str, log: Log):
    from huggingface_hub import hf_hub_download
    from piper import PiperVoice  # pip install piper-tts
    import wave

    base = "en/en_US/ryan/high/en_US-ryan-high"
    onnx = hf_hub_download("rhasspy/piper-voices", f"{base}.onnx", cache_dir=MODELS)
    hf_hub_download("rhasspy/piper-voices", f"{base}.onnx.json", cache_dir=MODELS)
    log(f"Озвучка: Piper ({PIPER_VOICE}) на процессоре")
    v = PiperVoice.load(onnx)
    with wave.open(str(raw_wav), "wb") as w:
        v.synthesize_wav(text, w)


# ----------------------------------------------------------------- edge-tts
def edge(text: str, raw_wav: Path, voice: str, log: Log):
    import edge_tts  # pip install edge-tts

    log("Озвучка: edge-tts (онлайн-сервис, запасной вариант)")
    mp3 = raw_wav.with_suffix(".mp3")
    asyncio.run(edge_tts.Communicate(text, "en-US-GuyNeural").save(str(mp3)))
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), str(raw_wav)])


ENGINES = [("kokoro", kokoro), ("piper", piper), ("edge-tts", edge)]


def postprocess(raw_wav: Path, out_wav: Path):
    """Срезать длинную тишину по краям, добавить 0.25 с в начале и 0.5 с в конце,
    выровнять громкость (EBU R128, −16 LUFS, пики ≤ −1.5 dB)."""
    flt = (
        "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,"
        "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,"
        "adelay=250:all=1,apad=pad_dur=0.5,"
        "loudnorm=I=-16:TP=-1.5:LRA=7"
    )
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw_wav), "-af", flt, "-ar", "48000", "-ac", "1", str(out_wav)])


def synthesize(text: str, out_wav: Path, voice: str = DEFAULT_VOICE, log: Log | None = None, engines=None) -> str:
    log = log or Log()
    text = clean_text(text)
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    errors = []
    for name, fn in ENGINES:
        if engines and name not in engines:
            continue
        with tempfile.TemporaryDirectory() as td:
            raw = Path(td) / "raw.wav"
            try:
                fn(text, raw, voice, log)
                postprocess(raw, out_wav)
                log(f"Озвучка готова: {out_wav.name}, {ffprobe_duration(out_wav):.1f} с (движок: {name})")
                return name
            except Exception as e:  # noqa: BLE001
                errors.append(f"{name}: {str(e)[:300]}")
                log(f"Движок {name} не сработал: {str(e)[:300]}")
    raise RuntimeError("Ни один движок озвучки не сработал:\n" + "\n".join(errors))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("text")
    ap.add_argument("out")
    ap.add_argument("--voice", default=DEFAULT_VOICE)
    a = ap.parse_args()
    synthesize(a.text, Path(a.out), a.voice)
