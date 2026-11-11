"""Пути проекта и подготовка окружения для моделей.

Все модели хранятся ВНУТРИ папки проекта (models/), а не в профиле пользователя:
так их легко найти и удалить, и не мешают русские буквы в имени пользователя Windows.
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
ASSETS_DIR = ROOT / "assets"
MODELS_DIR = ROOT / "models"
CACHE_DIR = ROOT / "cache"
LOGS_DIR = ROOT / "logs"
OUTPUT_DIR = ROOT / "output"

KOKORO_REPO = "hexgrad/Kokoro-82M"
KOKORO_MODEL_FILE = "kokoro-v1_0.pth"


def hf_home() -> Path:
    return MODELS_DIR / "hf"


def kokoro_snapshot_dir() -> Path | None:
    """Папка со скачанной моделью Kokoro или None, если её ещё нет."""
    base = hf_home() / "hub" / ("models--" + KOKORO_REPO.replace("/", "--")) / "snapshots"
    if not base.is_dir():
        return None
    for snap in sorted(base.iterdir()):
        if (snap / KOKORO_MODEL_FILE).exists() and (snap / "config.json").exists():
            return snap
    return None


def kokoro_voice_downloaded(voice: str) -> bool:
    snap = kokoro_snapshot_dir()
    return bool(snap and (snap / "voices" / f"{voice}.pt").exists())


def setup_model_env(offline_if_ready: bool = True, voices: tuple[str, ...] = ()) -> None:
    """Вызывать ДО импорта kokoro / huggingface_hub.

    Если модель и нужные голоса уже скачаны — включает офлайн-режим, чтобы озвучка
    не ходила в интернет при каждом запуске (важно при медленной связи).
    """
    os.environ.setdefault("HF_HOME", str(hf_home()))
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    if offline_if_ready and kokoro_snapshot_dir() is not None:
        if all(kokoro_voice_downloaded(v) for v in voices):
            os.environ.setdefault("HF_HUB_OFFLINE", "1")
