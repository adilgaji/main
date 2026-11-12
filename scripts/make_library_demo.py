#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собирает демо-ролик библиотеки кадров: озвучка + субтитры + шесть типов кадров.

Запуск:  python scripts/make_library_demo.py [--voice am_fenrir] [--no-render]

Шаги:
  1. берёт тексты и кадры из video/src/demo/library.json;
  2. озвучивает текст выбранным голосом и получает время каждого слова;
  3. раскладывает кадры по времени: каждый кадр длится, пока звучит его абзац;
  4. рендерит ролик и склеивает его со звуком (H.264 yuv420p, +faststart).

Это уменьшенная копия того, как будет собираться настоящая глава.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from factory import audio  # noqa: E402
from factory.console import setup_console  # noqa: E402
from factory.settings import load_settings, voice_of  # noqa: E402
from factory.tts import narrate, save_narration  # noqa: E402

VIDEO = ROOT / "video"
JOB = VIDEO / "public" / "job" / "library-demo"
OUT = VIDEO / "out"
FPS = 30


def build_props(voice: str, speed: float) -> tuple[dict, float]:
    lib = json.loads((VIDEO / "src" / "demo" / "library.json").read_text(encoding="utf-8"))
    shots = lib["shots"]
    text = "\n".join(s["narration"] for s in shots)
    s = load_settings()
    n = narrate(text, voice, speed=speed, sentence_gap=s["tts"]["sentence_gap"], paragraph_gap=s["tts"]["paragraph_gap"])

    JOB.mkdir(parents=True, exist_ok=True)
    raw = JOB / "narration.raw.wav"
    save_narration(n, raw, JOB / "narration.words.json")
    loud = audio.normalize_loudness(raw, JOB / "narration.wav")
    raw.unlink()

    total_frames = round(n.duration * FPS)
    # Граница между кадрами — середина паузы между абзацами.
    starts = [0.0]
    for p in range(1, len(shots)):
        prev_end = max(w.end for w in n.words if w.paragraph == p - 1)
        next_start = min(w.start for w in n.words if w.paragraph == p)
        starts.append((prev_end + next_start) / 2)
    starts.append(n.duration)

    timed = []
    for i, item in enumerate(shots):
        a, b = round(starts[i] * FPS), round(starts[i + 1] * FPS)
        shot = dict(item["shot"])
        if shot["type"] == "narrator":
            # губы рассказчика двигаются по словам этого абзаца
            shot["speech"] = [
                {"start": round(w.start - starts[i], 3), "end": round(w.end - starts[i], 3)}
                for w in n.words
                if w.paragraph == i and any(c.isalnum() for c in w.text)
            ]
        timed.append({"start": a, "frames": b - a, "shot": shot})

    props = {
        "styleId": s.get("style"),
        "audio": "job/library-demo/narration.wav",
        "words": [{"text": w.text, "start": round(w.start, 3), "end": round(w.end, 3)} for w in n.words],
        "shots": timed,
        "captions": True,
        "totalFrames": total_frames,
    }
    (JOB / "props.json").write_text(json.dumps(props, ensure_ascii=False, indent=1), encoding="utf-8")
    print(
        f"Озвучка: {n.duration:.1f} с, {len(n.words)} слов, {n.words_per_minute:.0f} слов/мин, "
        f"громкость {loud['lufs']:.1f} LUFS, пик {loud['true_peak']:.1f} dB"
    )
    for i, t in enumerate(timed):
        print(f"  кадр {i + 1}: {t['shot']['type']:<12} {t['start'] / FPS:5.1f} с → {(t['start'] + t['frames']) / FPS:5.1f} с  ({t['frames'] / FPS:.1f} с)")
    return props, n.duration


def render(props: dict, gl: str, concurrency: int | None) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    silent = OUT / "library-demo.silent.mp4"
    final = OUT / "library-demo.mp4"
    npx = shutil.which("npx")
    if not npx:
        raise SystemExit("Не найден npx (ставится вместе с Node.js).")
    cmd = [
        npx, "remotion", "render", "Chapter", str(silent),
        f"--props={JOB / 'props.json'}", f"--gl={gl}", "--codec=h264", "--crf=22",
        "--pixel-format=yuv420p", "--muted", "--log=error",
    ]
    if concurrency:
        cmd.append(f"--concurrency={concurrency}")
    t0 = time.time()
    subprocess.run(cmd, cwd=VIDEO, check=True)
    took = time.time() - t0
    frames = props["totalFrames"]
    print(f"Рендер: {frames} кадров за {took:.0f} с — {frames / took:.1f} кадров/с (в {took / (frames / FPS):.1f} раза дольше самого ролика)")

    # Склейка картинки и звука. yuv420p + faststart — чтобы открывалось на телефонах.
    # Звук дополняется тишиной ровно до длины картинки: видео = звук = сумма кадров.
    video_seconds = frames / FPS
    subprocess.run(
        [
            audio.ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(silent), "-i", str(JOB / "narration.wav"),
            "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
            "-af", "apad", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-t", f"{video_seconds:.6f}", "-movflags", "+faststart", str(final),
        ],
        check=True,
    )
    silent.unlink()
    check_av(final, frames)
    return final


def check_av(path: Path, expected_frames: int) -> None:
    """Проверка «видео = звук = сумма кадров» на готовом файле."""
    def probe(stream: str, entry: str) -> str:
        out = subprocess.run(
            [audio.ffprobe_bin(), "-v", "error", "-select_streams", stream, "-show_entries", f"stream={entry}",
             "-of", "default=nw=1:nk=1", str(path)],
            stdout=subprocess.PIPE, text=True, check=True,
        ).stdout.strip()
        return out.splitlines()[0] if out else ""

    got_frames = int(probe("v:0", "nb_frames") or 0)
    pix = probe("v:0", "pix_fmt")
    v_dur = float(probe("v:0", "duration") or 0)
    a_dur = float(probe("a:0", "duration") or 0)
    problems = []
    if got_frames != expected_frames:
        problems.append(f"кадров {got_frames}, а должно быть {expected_frames}")
    if abs(v_dur - a_dur) > 1 / FPS:
        problems.append(f"картинка {v_dur:.3f} с и звук {a_dur:.3f} с расходятся больше чем на кадр")
    if pix != "yuv420p":
        problems.append(f"формат пикселей {pix}, а нужен yuv420p")
    if problems:
        raise SystemExit("Проверка готового файла не пройдена: " + "; ".join(problems))
    print(f"Проверка файла: {got_frames} кадров, картинка {v_dur:.2f} с, звук {a_dur:.2f} с, {pix} — в порядке")


def main() -> int:
    setup_console()
    ap = argparse.ArgumentParser(description="Демо-ролик библиотеки кадров")
    ap.add_argument("--voice")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--gl", default="swiftshader" if sys.platform.startswith("linux") else "angle")
    ap.add_argument("--concurrency", type=int)
    ap.add_argument("--no-render", action="store_true", help="только озвучка и раскладка кадров")
    args = ap.parse_args()

    voice = args.voice or voice_of(load_settings())
    props, duration = build_props(voice, args.speed)
    if args.no_render:
        return 0
    final = render(props, args.gl, args.concurrency)
    print(f"Готово: {final} ({audio.duration(final):.1f} с, звук {duration:.1f} с)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
