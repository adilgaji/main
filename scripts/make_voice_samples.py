#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Делает образцы голосов: один и тот же исторический отрывок шестью голосами Kokoro.

Запуск:  python scripts/make_voice_samples.py [--voices am_michael bm_george ...]

Результат: assets/voices/<голос>.mp3 и assets/voices/samples.json
(эти файлы потом использует веб-страница — кнопки «прослушать»).
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from factory import audio  # noqa: E402
from factory.console import setup_console  # noqa: E402
from factory.paths import ASSETS_DIR  # noqa: E402
from factory.tts import narrate, save_narration  # noqa: E402
from factory.tts.text import count_words  # noqa: E402
from factory.tts.voices import VOICES  # noqa: E402

# Один и тот же отрывок для всех голосов. В нём есть трудные имена (Thermopylae, Xerxes,
# Hatshepsut, Tenochtitlan), число, пояснение термина, короткие фразы и вопрос.
SAMPLE_TEXT = (
    "In 480 BC, a small Greek force held the narrow pass of Thermopylae against the army "
    "of the Persian king Xerxes. About a thousand years earlier, in Egypt, a woman named "
    "Hatshepsut ruled as pharaoh — Egypt's king.\n"
    "And far across the ocean, the Aztec city of Tenochtitlan would one day rise on an "
    "island in a lake. Three places. Three stories. One question: how do we actually know "
    "what happened?"
)

OUT_DIR = ASSETS_DIR / "voices"


def median_pitch(samples: np.ndarray, sr: int) -> float:
    """Средняя высота голоса в герцах (медиана по звонким участкам)."""
    frame, hop = int(0.04 * sr), int(0.01 * sr)
    lo, hi = int(sr / 400), int(sr / 60)
    level = np.sqrt((samples.astype(np.float64) ** 2).mean()) * 0.5
    f0 = []
    for i in range(0, len(samples) - frame, hop):
        x = samples[i:i + frame].astype(np.float64)
        if np.sqrt((x**2).mean()) < level:
            continue
        x = x - x.mean()
        ac = np.correlate(x, x, "full")[frame - 1:]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        k = int(np.argmax(ac[lo:hi]))
        if ac[lo + k] > 0.5:
            f0.append(sr / (lo + k))
    return float(np.median(f0)) if f0 else 0.0


def main() -> int:
    setup_console()

    ap = argparse.ArgumentParser(description="Образцы голосов Kokoro")
    ap.add_argument("--voices", nargs="*", default=list(VOICES), help="коды голосов")
    ap.add_argument("--speed", type=float, default=1.0)
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    words = count_words(SAMPLE_TEXT)
    print(f"Отрывок: {words} слов. Голосов: {len(args.voices)}.")
    items = []
    with tempfile.TemporaryDirectory() as tmp:
        for vid in args.voices:
            v = VOICES.get(vid)
            n = narrate(SAMPLE_TEXT, vid, speed=args.speed)
            raw = Path(tmp) / f"{vid}.wav"
            save_narration(n, raw, Path(tmp) / f"{vid}.json")
            norm = Path(tmp) / f"{vid}.norm.wav"
            loud = audio.normalize_loudness(raw, norm)
            mp3 = OUT_DIR / f"{vid}.mp3"
            audio.to_mp3(norm, mp3)
            item = {
                "id": vid,
                "name": v.name if v else vid,
                "label_ru": v.label_ru if v else "",
                "gender": v.gender if v else "",
                "accent": v.accent if v else "",
                "file": mp3.name,
                "duration": round(audio.duration(mp3), 2),
                "words_per_minute": round(n.words_per_minute),
                "pitch_hz": round(median_pitch(n.audio, n.sample_rate)),
                "lufs": round(loud["lufs"], 1),
                "true_peak_db": round(loud["true_peak"], 1),
                "pronunciations": [p["word"] for p in n.pronunciations],
                "warnings": n.warnings,
            }
            items.append(item)
            print(
                f"  {vid:<11} {item['duration']:5.1f} с  {item['words_per_minute']:3d} слов/мин  "
                f"высота {item['pitch_hz']:3d} Гц  громкость {item['lufs']} LUFS, пик {item['true_peak_db']} dB"
                f"  (синтез {n.synth_seconds:.1f} с, {'видеокарта' if n.device == 'cuda' else 'процессор'})"
            )
    meta = {"text": SAMPLE_TEXT, "words": words, "speed": args.speed, "engine": "kokoro==0.9.4", "voices": items}
    (OUT_DIR / "samples.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Готово: {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
