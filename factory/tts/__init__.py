"""Озвучка: текст → звук + точное время каждого слова.

Пример:
    from factory.tts import narrate_to_files
    info = narrate_to_files("In 480 BC ...", "out/ch01.wav", voice="bm_george")

Основной движок — Kokoro. Если он не запустился, пробуются запасные: Piper (локально),
затем edge-tts (через интернет). Порядок и причины отказа пишутся в журнал по-русски.
Выбрать движок вручную: engine="kokoro" | "piper" | "edge" или переменная FACTORY_TTS_ENGINE.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from factory.tts.kokoro_engine import Narration, TTSError, Word, get_engine

__all__ = ["ENGINES", "Narration", "TTSError", "Word", "narrate", "narrate_many", "narrate_to_files", "save_narration"]

log = logging.getLogger("factory.tts")
ENGINES = ("kokoro", "piper", "edge")
ENGINE_RU = {"kokoro": "Kokoro (основной)", "piper": "Piper (запасной, без интернета)", "edge": "edge-tts (запасной, через интернет)"}


def _order(engine: str | None) -> tuple[str, ...]:
    engine = (os.environ.get("FACTORY_TTS_ENGINE") or engine or "auto").lower()
    if engine == "auto":
        return ENGINES
    if engine not in ENGINES:
        raise TTSError(f"Неизвестный движок озвучки «{engine}». Доступные: auto, {', '.join(ENGINES)}")
    return (engine,)


def _run(name: str, text: str, voice: str, speed: float, device: str, **kwargs) -> Narration:
    if name == "kokoro":
        return get_engine(device).synthesize(text, voice=voice, speed=speed, **kwargs)
    from factory.tts import fallback

    return (fallback.narrate_piper if name == "piper" else fallback.narrate_edge)(text, voice, speed, **kwargs)


def narrate_many(texts: list[str], voice: str, speed: float = 1.0, device: str = "auto", engine: str | None = "auto", **kwargs) -> list[Narration]:
    """Озвучивает несколько текстов ОДНИМ движком: если основной не справился хотя бы с одним,
    все тексты переозвучиваются запасным — голос в видео не должен меняться от главы к главе."""
    errors: list[str] = []
    for name in _order(engine):
        try:
            return [_run(name, t, voice, speed, device, **kwargs) for t in texts]
        except Exception as e:  # noqa: BLE001 — любая поломка движка = переход к запасному
            errors.append(f"{ENGINE_RU[name]}: {e}")
            log.warning("Озвучка: %s не сработал — %s", ENGINE_RU[name], str(e).splitlines()[0][:200])
    raise TTSError("Ни один движок озвучки не сработал:\n  " + "\n  ".join(errors))


def narrate(text: str, voice: str, speed: float = 1.0, device: str = "auto", engine: str | None = "auto", **kwargs) -> Narration:
    return narrate_many([text], voice, speed, device, engine, **kwargs)[0]


def save_narration(n: Narration, wav_path: str | Path, json_path: str | Path | None = None) -> dict:
    """Сохраняет WAV (моно, 16 бит) и JSON со временем слов рядом с ним."""
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
