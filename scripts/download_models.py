#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Скачивает модель голоса Kokoro заранее, с докачкой при обрыве связи.

Запуск:  python scripts/download_models.py [--all-voices] [--piper]

  --piper   дополнительно скачать запасной голос Piper (≈ 60 МБ) — он включится сам,
            если основной голос Kokoro не запустится.

Файлы кладутся в папку models/ внутри проекта (≈330 МБ). Если связь оборвётся,
просто запустите ещё раз — скачивание продолжится с места остановки.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from factory.console import setup_console  # noqa: E402
from factory.paths import KOKORO_MODEL_FILE, KOKORO_REPO, kokoro_snapshot_dir, setup_model_env  # noqa: E402
from factory.tts.voices import VOICES  # noqa: E402

MAX_ATTEMPTS = 30


def fetch(filename: str) -> Path:
    """Скачивает один файл; при обрыве повторяет, продолжая с того же места."""
    from huggingface_hub import hf_hub_download

    last: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return Path(hf_hub_download(repo_id=KOKORO_REPO, filename=filename))
        except KeyboardInterrupt:
            raise
        except Exception as e:  # noqa: BLE001
            last = e
            wait = min(60, 3 * attempt)
            print(f"   обрыв связи ({type(e).__name__}); попытка {attempt} из {MAX_ATTEMPTS}, жду {wait} с…")
            time.sleep(wait)
    raise RuntimeError(f"Не удалось скачать {filename}: {last}")


def fetch_piper() -> int:
    """Запасной голос Piper под выбранный в настройках голос (тот же акцент и пол)."""
    from huggingface_hub import hf_hub_download

    from factory.settings import load_settings, voice_of
    from factory.tts.fallback import PIPER_DIR, PIPER_REPO, piper_files, piper_voice_for

    name = piper_voice_for(voice_of(load_settings()))
    print(f"Скачиваю запасной голос Piper «{name}» (≈ 60 МБ).")
    for filename in piper_files(name):
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                hf_hub_download(repo_id=PIPER_REPO, filename=filename, local_dir=str(PIPER_DIR))
                break
            except KeyboardInterrupt:
                print("\nОстановлено. Запустите ещё раз — скачивание продолжится.")
                return 1
            except Exception as e:  # noqa: BLE001
                if attempt == MAX_ATTEMPTS:
                    print(f"Ошибка: не удалось скачать {filename}: {e}")
                    return 1
                wait = min(60, 3 * attempt)
                print(f"   обрыв связи ({type(e).__name__}); попытка {attempt} из {MAX_ATTEMPTS}, жду {wait} с…")
                time.sleep(wait)
    print(f"Готово: {PIPER_DIR}")
    return 0


def main() -> int:
    setup_console()
    ap = argparse.ArgumentParser(description="Скачать модель голоса Kokoro")
    ap.add_argument("--all-voices", action="store_true", help="скачать все английские голоса, а не только шесть основных")
    ap.add_argument("--piper", action="store_true", help="скачать ещё и запасной голос Piper")
    ap.add_argument("--only-piper", action="store_true", help="скачать только запасной голос Piper")
    args = ap.parse_args()
    if args.only_piper:
        setup_model_env(offline_if_ready=False)
        return fetch_piper()

    setup_model_env(offline_if_ready=False)
    voices = list(VOICES)
    if args.all_voices:
        from huggingface_hub import list_repo_files

        voices = sorted(
            Path(f).stem
            for f in list_repo_files(KOKORO_REPO)
            if f.startswith("voices/") and Path(f).stem[:1] in ("a", "b")
        )

    files = ["config.json", KOKORO_MODEL_FILE] + [f"voices/{v}.pt" for v in voices]
    print(f"Скачиваю модель Kokoro: {len(files)} файлов (главный — около 330 МБ).")
    t0 = time.time()
    try:
        for i, name in enumerate(files, 1):
            print(f"[{i}/{len(files)}] {name}")
            fetch(name)
    except KeyboardInterrupt:
        print("\nОстановлено. Запустите ещё раз — скачивание продолжится.")
        return 1
    except RuntimeError as e:
        print(f"\nОшибка: {e}\nПроверьте интернет и запустите ещё раз — скачивание продолжится.")
        return 1

    snap = kokoro_snapshot_dir()
    if snap is None:
        print("Ошибка: файлы скачаны, но модель не найдена на диске.")
        return 1
    size = sum(f.stat().st_size for f in snap.rglob("*") if f.is_file()) / 1024**2
    print(f"Готово за {time.time() - t0:.0f} с. Модель: {snap} ({size:.0f} МБ).")
    return fetch_piper() if args.piper else 0


if __name__ == "__main__":
    sys.exit(main())
