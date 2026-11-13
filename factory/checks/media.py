"""Измерения на готовом файле: звук по времени, отдельные кадры, чёрные участки."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

import numpy as np

from factory import audio

ENV_RATE = 8000
THUMB = (192, 78)  # уменьшенный кадр без полосы субтитров


def audio_samples(path: Path, rate: int = ENV_RATE) -> np.ndarray:
    p = subprocess.run(
        [audio.ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(rate), "-f", "f32le", "pipe:1"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    if p.returncode != 0:
        raise RuntimeError("Не удалось прочитать звук из файла: " + p.stderr.decode("utf-8", "replace")[-300:])
    return np.frombuffer(p.stdout, dtype=np.float32)


def rms_db(samples: np.ndarray) -> float:
    if len(samples) == 0:
        return -120.0
    return float(20 * np.log10(np.sqrt(np.mean(samples.astype(np.float64) ** 2)) + 1e-9))


def first_sound(samples: np.ndarray, t_from: float, window: float = 4.0, rate: int = ENV_RATE, rel_db: float = -32.0) -> float | None:
    """Момент первого слышимого звука после t_from (секунды). Порог — относительно самого громкого места."""
    win = rate // 100
    a = samples[int(t_from * rate): int((t_from + window) * rate)]
    n = len(a) // win
    if n == 0:
        return None
    db = 20 * np.log10(np.sqrt((a[: n * win].reshape(n, win).astype(np.float64) ** 2).mean(axis=1)) + 1e-9)
    peak = 20 * np.log10(float(np.abs(samples).max()) + 1e-9)
    loud = np.where(db > peak + rel_db)[0]
    return t_from + loud[0] * win / rate if len(loud) else None


def sample_frames(path: Path, numbers: list[int]) -> list[np.ndarray]:
    """Кадры с указанными номерами: серые, уменьшенные, без нижней полосы субтитров."""
    if not numbers:
        return []
    numbers = sorted(set(numbers))
    expr = "+".join(f"eq(n\\,{n})" for n in numbers)
    w, h = THUMB
    p = subprocess.run(
        [audio.ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-i", str(path), "-an",
         "-vf", f"select='{expr}',crop=iw:ih*0.72:0:0,scale={w}:{h},format=gray", "-vsync", "0", "-f", "rawvideo", "pipe:1"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    if p.returncode != 0:
        raise RuntimeError("Не удалось прочитать кадры: " + p.stderr.decode("utf-8", "replace")[-300:])
    data = np.frombuffer(p.stdout, dtype=np.uint8)
    count = len(data) // (w * h)
    return [data[i * w * h:(i + 1) * w * h].reshape(h, w).astype(np.float32) for i in range(count)]


def detail(frame: np.ndarray) -> float:
    """Насколько кадр «наполнен»: средний перепад яркости между соседними точками.
    У пустого фона (ровная заливка, мягкий градиент) значение близко к нулю."""
    return float(np.abs(np.diff(frame, axis=1)).mean() + np.abs(np.diff(frame, axis=0)).mean())


def black_spans(path: Path, min_seconds: float = 0.4) -> list[tuple[float, float]]:
    p = subprocess.run(
        [audio.ffmpeg_bin(), "-hide_banner", "-nostats", "-i", str(path), "-an", "-vf", f"blackdetect=d={min_seconds}:pix_th=0.06", "-f", "null", "-"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace",
    )
    return [(float(a), float(b)) for a, b in re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", p.stderr)]
