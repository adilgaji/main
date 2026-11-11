"""Настройка вывода в консоль: русский текст без «кракозябр» и без шума чужих библиотек."""
from __future__ import annotations

import logging
import sys

_NOISY = (
    "httpx", "httpx2", "httpcore", "httpcore2", "huggingface_hub", "urllib3", "filelock",
    "transformers", "phonemizer",
)


def setup_console(level: int = logging.INFO) -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except Exception:  # noqa: BLE001
            pass
    logging.basicConfig(level=level, format="%(message)s")
    for name in _NOISY:
        logging.getLogger(name).setLevel(logging.WARNING)
