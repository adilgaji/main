"""Настройки фабрики: config/settings.json.

Здесь хранится выбор владельца (голос, стиль). Для отдельного видео их можно
переопределить — тогда значение берётся из state.json этого видео.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

from factory.paths import CONFIG_DIR
from factory.styles import resolve_style
from factory.tts.voices import FALLBACK_VOICE

SETTINGS_PATH = CONFIG_DIR / "settings.json"

DEFAULTS: dict = {
    "voice": None,  # код голоса Kokoro; null — владелец ещё не выбрал
    "voice_speed": 1.0,  # 1.0 — обычная скорость речи
    "style": None,  # id стиля из video/src/styles.json; null — владелец ещё не выбрал (работает «documentary»)
    "tts": {
        "device": "auto",  # auto — видеокарта, если есть; иначе процессор
        "sentence_gap": 0.45,  # пауза между кусками текста внутри абзаца, секунды
        "paragraph_gap": 0.85,  # пауза между абзацами, секунды
    },
    "loudness": {"target_lufs": -14.5, "max_true_peak_db": -1.5},
    # Smithsonian Open Access: бесплатный личный ключ с https://api.data.gov/signup/
    # (общий DEMO_KEY быстро упирается в лимит запросов)
    "images": {"smithsonian_api_key": ""},
}


def _merge(base: dict, over: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def load_settings(path: Path | None = None) -> dict:
    path = path or SETTINGS_PATH
    if not path.exists():
        return copy.deepcopy(DEFAULTS)
    return _merge(DEFAULTS, json.loads(path.read_text(encoding="utf-8")))


def save_settings(settings: dict, path: Path | None = None) -> None:
    path = path or SETTINGS_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(settings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_settings(changes: dict, path: Path | None = None) -> dict:
    if changes.get("style") is not None:
        changes = {**changes, "style": resolve_style(changes["style"])}  # проверка: стиль должен существовать
    s = _merge(load_settings(path), changes)
    save_settings(s, path)
    return s


def effective(settings: dict, video_overrides: dict | None = None) -> dict:
    """Настройки с учётом переопределений для отдельного видео."""
    return _merge(settings, video_overrides or {})


def voice_of(settings: dict) -> str:
    return settings.get("voice") or FALLBACK_VOICE
