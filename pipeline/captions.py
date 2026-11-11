"""Субтитры с пословными таймингами.

1) faster-whisper распознаёт озвучку и даёт время начала/конца каждого слова
   (видеокарта → при ошибке процессор).
2) Распознанные слова сопоставляются с ИСХОДНЫМ текстом сценария, поэтому
   в субтитрах всегда точный текст (без ошибок распознавания), а время — настоящее.
3) Ключевые слова (в сценарии отмечены *звёздочками*) помечаются для подсветки.

Результат words.json — массив в формате Caption из @remotion/captions:
  {"text": " word", "startMs": 120, "endMs": 400, "timestampMs": 260, "confidence": 0.98, "keyword": false}

Запуск вручную:
    python pipeline/captions.py output/test/voice.wav "Script *text*" output/test/words.json
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import MODELS, Log, ffprobe_duration  # noqa: E402

WHISPER_MODEL = "base.en"  # ~150 МБ; текст всё равно сверяется со сценарием, нужна только точность времени


def norm(w: str) -> str:
    return re.sub(r"[^a-z0-9]", "", w.lower().replace("’", "'"))


def script_tokens(script: str):
    """Слова сценария с пометкой ключевых (*слово* или *два слова*)."""
    tokens = []
    for part in re.split(r"(\*[^*]+\*)", script):
        kw = part.startswith("*") and part.endswith("*")
        for w in part.strip("*").split():
            if tokens and not norm(w):  # знак препинания — приклеиваем к предыдущему слову
                tokens[-1]["text"] += w
                continue
            tokens.append({"text": w, "keyword": kw})
        # знак препинания сразу после *ключевого слова* без пробела
    return tokens


def _hotwords(prompt: str) -> str:
    """Редкие/длинные слова сценария — подсказка распознавателю (не весь текст!)."""
    words = {re.sub(r"[^A-Za-z-]", "", w) for w in prompt.split()}
    return " ".join(sorted(w for w in words if len(w) >= 8))[:300]


def _windows_cuda_dlls():
    """Windows: faster-whisper ищет библиотеки CUDA (cuBLAS/cuDNN) в PATH.
    Они уже лежат внутри PyTorch — подключаем их оттуда."""
    import os

    if os.name != "nt":
        return
    try:
        import torch

        lib = Path(torch.__file__).parent / "lib"
        os.add_dll_directory(str(lib))
        os.environ["PATH"] = str(lib) + os.pathsep + os.environ.get("PATH", "")
    except Exception:  # noqa: BLE001
        pass


def _transcribe(wav: Path, prompt: str, device: str, compute: str, vad: bool = False):
    if device == "cuda":
        _windows_cuda_dlls()
    from faster_whisper import WhisperModel

    import subprocess

    import numpy as np

    # читаем звук сами (16 кГц, моно, float32) — так не зависим от версии библиотеки PyAV
    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(wav), "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
        capture_output=True, check=True,
    ).stdout
    audio = np.frombuffer(pcm, dtype=np.float32)
    model = WhisperModel(WHISPER_MODEL, device=device, compute_type=compute, download_root=str(MODELS / "whisper"))
    # ВАЖНО: весь текст как initial_prompt давать нельзя — Whisper тогда «пропускает» начало записи.
    segments, _ = model.transcribe(
        audio, language="en", word_timestamps=True, hotwords=_hotwords(prompt), vad_filter=vad, beam_size=5,
        condition_on_previous_text=False,  # не «зацикливаться» на длинных записях
    )
    words = []
    for seg in segments:
        for w in seg.words or []:
            words.append({"text": w.word.strip(), "start": w.start, "end": w.end, "p": w.probability})
    return words


def transcribe(wav: Path, prompt: str, log: Log, vad: bool = False):
    from common import gpu_available

    if gpu_available():
        try:
            log("Субтитры: faster-whisper на видеокарте")
            return _transcribe(wav, prompt, "cuda", "float16", vad)
        except Exception as e:  # noqa: BLE001
            log(f"Видеокарта не сработала ({str(e)[:200]}) — переключаюсь на процессор")
    log("Субтитры: faster-whisper на процессоре")
    return _transcribe(wav, prompt, "cpu", "int8", vad)


def align(script: str, heard: list[dict], total: float):
    """Перенести тайминги распознанных слов на слова сценария."""
    toks = script_tokens(script)
    a = [norm(t["text"]) for t in toks]
    b = [norm(h["text"]) for h in heard]
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    times: list[tuple[float, float] | None] = [None] * len(toks)
    conf: list[float | None] = [None] * len(toks)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                h = heard[j1 + k]
                times[i1 + k] = (h["start"], h["end"])
                conf[i1 + k] = h["p"]
        elif tag == "replace" and j2 > j1:
            # распознано иначе (например «20» вместо «twenty»): делим промежуток поровну
            s, e = heard[j1]["start"], heard[j2 - 1]["end"]
            n = i2 - i1
            for k in range(n):
                times[i1 + k] = (s + (e - s) * k / n, s + (e - s) * (k + 1) / n)
    matched = sum(1 for t in times if t)
    # слова без времени — интерполяция между соседями
    for i, t in enumerate(times):
        if t is None:
            prev_end = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            nxt = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), total)
            # сколько подряд пропусков
            j = i
            while j < len(times) and times[j] is None:
                j += 1
            n = j - i
            for k in range(n):
                times[i + k] = (prev_end + (nxt - prev_end) * k / n, prev_end + (nxt - prev_end) * (k + 1) / n)
    out = []
    for i, (t, (s, e)) in enumerate(zip(toks, times)):
        out.append(
            {
                "text": (" " if i else "") + t["text"],
                "startMs": round(s * 1000),
                "endMs": round(max(e, s + 0.05) * 1000),
                "timestampMs": round((s + e) / 2 * 1000),
                "confidence": round(conf[i], 3) if conf[i] is not None else None,
                "keyword": t["keyword"],
            }
        )
    return out, matched / max(1, len(toks))


def speech_onset(wav: Path) -> float:
    """Когда в файле реально начинается голос (сек)."""
    from common import run

    out = run(["ffmpeg", "-i", str(wav), "-af", "silencedetect=n=-40dB:d=0.1", "-f", "null", "-"])
    m = re.search(r"silence_start: (-?[\d.]+).*?silence_end: ([\d.]+)", out, re.S)
    if m and float(m.group(1)) <= 0.01:
        return float(m.group(2))
    return 0.0


def make_captions(wav: Path, script: str, out_json: Path, log: Log | None = None) -> float:
    log = log or Log()
    plain = re.sub(r"\*", "", script)
    total = ffprobe_duration(wav)
    timings = wav.with_name(wav.stem + ".timings.json")
    if timings.exists() and timings.stat().st_mtime >= wav.stat().st_mtime - 5:
        # время слов уже известно от голосового движка Kokoro — распознавание речи не нужно
        log("Субтитры: время каждого слова взято из озвучки (Kokoro)")
        heard = json.loads(timings.read_text(encoding="utf-8"))
    else:
        try:
            heard = transcribe(wav, plain, log)
        except OSError as e:
            raise RuntimeError(
                "Распознавание речи не запустилось (Windows могла заблокировать файл библиотеки). "
                "Используйте голос Kokoro — с ним распознавание не нужно. Подробно: " + str(e)[:300]
            ) from e
    words, ratio = align(script, heard, total)
    if ratio < 0.9 and not timings.exists():
        log(f"Совпадение {ratio:.0%} — пробую второй режим распознавания (с фильтром тишины)")
        heard2 = transcribe(wav, plain, log, vad=True)
        words2, ratio2 = align(script, heard2, total)
        if ratio2 > ratio:
            words, ratio = words2, ratio2
    onset = round(speech_onset(wav) * 1000)
    if words and words[0]["startMs"] < onset:
        words[0]["startMs"] = min(onset, words[0]["endMs"] - 50)
    out_json.write_text(json.dumps(words, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"Субтитры готовы: {len(words)} слов, точное совпадение с текстом {ratio:.0%}")
    if ratio < 0.85:
        raise RuntimeError(f"Распознанная речь совпала с текстом только на {ratio:.0%} — возможно, обрезаны слова")
    return ratio


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("wav")
    ap.add_argument("script")
    ap.add_argument("out")
    a = ap.parse_args()
    make_captions(Path(a.wav), a.script, Path(a.out))
