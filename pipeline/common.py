"""Общие функции: лог на русском, запуск ffmpeg, повторы шагов."""
from __future__ import annotations

import datetime as _dt
import json
import shutil
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REMOTION = ROOT / "remotion"
OUTPUT = ROOT / "output"
MODELS = ROOT / "models"


class Log:
    """Пишет сообщения на русском в консоль и в файл log.txt папки ролика."""

    def __init__(self, path: Path | None = None):
        self.path = path

    def __call__(self, msg: str):
        line = f"[{_dt.datetime.now():%H:%M:%S}] {msg}"
        print(line, flush=True)
        if self.path:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.path, "a", encoding="utf-8") as f:
                f.write(line + "\n")


def run(cmd: list[str], cwd: Path | None = None, env: dict | None = None) -> str:
    res = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if res.returncode != 0:
        raise RuntimeError(f"Команда завершилась с ошибкой ({res.returncode}): {' '.join(cmd[:3])}...\n{res.stderr[-2000:]}")
    return res.stdout + res.stderr


def ffprobe_duration(path: Path) -> float:
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)])
    return float(json.loads(out[out.index("{"):])["format"]["duration"])


def retry(step_name: str, fn, logger: Log, attempts: int = 3, **kwargs):
    """Выполнить шаг; при ошибке повторить до `attempts` раз."""
    last = None
    for i in range(1, attempts + 1):
        try:
            if i > 1:
                logger(f"Шаг «{step_name}»: попытка {i} из {attempts}")
            return fn(**kwargs)
        except Exception as e:  # noqa: BLE001
            last = e
            logger(f"Шаг «{step_name}» не удался: {str(e)[:500]}")
            time.sleep(2 * i)
    raise RuntimeError(f"Шаг «{step_name}» не удался после {attempts} попыток: {last}")


def gpu_available() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:  # noqa: BLE001
        return False


def have(cmd: str) -> bool:
    return shutil.which(cmd) is not None
