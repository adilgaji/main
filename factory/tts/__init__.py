"""Озвучка: текст → звук + точное время каждого слова.

Пример:
    from factory.tts import narrate_to_files
    info = narrate_to_files("In 480 BC ...", "out/ch01.wav", voice="bm_george")

Основной движок — Kokoro. Запасные (Piper, затем edge-tts) подключаются на этапе 4.
"""
from __future__ import annotations

import json
from pathlib import Path

from factory.tts.kokoro_engine import Narration, TTSError, Word, get_engine

__all__ = ["Narration", "TTSError", "Word", "narrate", "narrate_to_files", "save_narration"]


def narrate(text: str, voice: str, speed: float = 1.0, device: str = "auto", **kwargs) -> Narration:
    return get_engine(device).synthesize(text, voice=voice, speed=speed, **kwargs)


def save_narration(n: Narration, wav_path: str | Path, json_path: str | Path | None = None) -> dict:
    """Сохраняет WAV (24 кГц, моно, 16 бит) и JSON со временем слов рядом с ним."""
    import soundfile as sf

    wav_path = Path(wav_path)
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(wav_path), n.audio, n.sample_rate, subtype="PCM_16")
    info = n.to_json()
    info["audio_file"] = wav_path.name
    json_path = Path(json_path) if json_path else wav_path.with_suffix(".words.json")
    json_path.write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return info


def narrate_to_files(
    text: str,
    wav_path: str | Path,
    voice: str,
    speed: float = 1.0,
    device: str = "auto",
    json_path: str | Path | None = None,
    **kwargs,
) -> dict:
    return save_narration(narrate(text, voice, speed, device, **kwargs), wav_path, json_path)
