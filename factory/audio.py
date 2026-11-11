"""Работа со звуком через FFmpeg: измерение и выравнивание громкости, перекодирование.

Цель проекта: громкость −16…−13 LUFS, пики не выше −1 dB.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

TARGET_LUFS = -14.5
TARGET_TRUE_PEAK = -1.5
LUFS_MIN, LUFS_MAX = -16.0, -13.0
PEAK_MAX = -1.0


class AudioError(RuntimeError):
    pass


def ffmpeg_bin() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise AudioError("FFmpeg не найден. Установите его:  winget install Gyan.FFmpeg")
    return exe


def ffprobe_bin() -> str:
    exe = shutil.which("ffprobe")
    if not exe:
        raise AudioError("ffprobe не найден (ставится вместе с FFmpeg):  winget install Gyan.FFmpeg")
    return exe


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    if p.returncode != 0:
        raise AudioError(f"FFmpeg завершился с ошибкой:\n{p.stderr[-800:]}")
    return p


def duration(path: str | Path) -> float:
    p = _run([
        ffprobe_bin(), "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ])
    return float(p.stdout.strip())


def _loudnorm_stats(path: str | Path, target_i: float, target_tp: float, extra: str = "") -> dict:
    flt = f"loudnorm=I={target_i}:TP={target_tp}:LRA=11{extra}:print_format=json"
    p = _run([ffmpeg_bin(), "-hide_banner", "-nostats", "-i", str(path), "-af", flt, "-f", "null", "-"])
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr, re.S)
    if not m:
        raise AudioError("Не удалось измерить громкость (FFmpeg не вернул данные loudnorm).")
    return json.loads(m.group(0))


def measure_loudness(path: str | Path) -> dict:
    """Возвращает {"lufs": средняя громкость, "true_peak": пик в dB, "lra": разброс}."""
    s = _loudnorm_stats(path, TARGET_LUFS, TARGET_TRUE_PEAK)
    return {
        "lufs": float(s["input_i"]),
        "true_peak": float(s["input_tp"]),
        "lra": float(s["input_lra"]),
    }


def loudness_ok(stats: dict) -> bool:
    return LUFS_MIN <= stats["lufs"] <= LUFS_MAX and stats["true_peak"] <= PEAK_MAX


def normalize_loudness(
    src: str | Path,
    dst: str | Path,
    target_i: float = TARGET_LUFS,
    target_tp: float = TARGET_TRUE_PEAK,
    sample_rate: int = 48000,
    codec_args: list[str] | None = None,
) -> dict:
    """Выравнивает громкость и возвращает измерение результата.

    Способ: измерить → прибавить нужное усиление → мягкий ограничитель пиков.
    Общая громкость меняется одинаково по всей записи, поэтому голос не «дышит»
    и не искажается. Делается до трёх подходов, пока результат не попадёт в цель.
    """
    src, dst = Path(src), Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    codec = codec_args or ["-c:a", "pcm_s16le"]
    measured = measure_loudness(src)
    gain = target_i - measured["lufs"]
    limit = 10 ** ((target_tp - 1.0) / 20)  # запас 1 dB на «истинные» пики
    result: dict = {}
    for attempt in range(3):
        flt = (
            f"aresample={sample_rate},volume={gain:.2f}dB,"
            f"alimiter=limit={limit:.4f}:attack=3:release=60:level=disabled"
        )
        _run([
            ffmpeg_bin(), "-hide_banner", "-nostats", "-y", "-i", str(src),
            "-af", flt, "-ar", str(sample_rate), "-ac", "1", *codec, str(dst),
        ])
        result = measure_loudness(dst)
        result["gain_db"] = round(gain, 2)
        error = target_i - result["lufs"]
        if abs(error) <= 0.3 and result["true_peak"] <= PEAK_MAX:
            break
        gain += error
    return result


def to_mp3(src: str | Path, dst: str | Path, bitrate: str = "128k", sample_rate: int = 48000) -> None:
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    _run([
        ffmpeg_bin(), "-hide_banner", "-nostats", "-y", "-i", str(src),
        "-ar", str(sample_rate), "-ac", "1", "-c:a", "libmp3lame", "-b:a", bitrate, str(dst),
    ])
