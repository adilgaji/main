#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Тестовый ролик блока B: «Фермопилы», 4 главы, около 3 минут.

Запуск:  python scripts/make_test_video.py [--style museum] [--no-render] [--parallel 2]

Берёт готовые текст и раскадровку из scripts/demo/thermopylae/, создаёт папку
output/<дата>_thermopylae, записывает выбранный стиль в state.json (шаг «выбор стиля»;
без --style в терминале показывается список) и запускает производство.
"""
from __future__ import annotations

import argparse
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from factory import production  # noqa: E402
from factory.console import setup_console  # noqa: E402
from factory.paths import OUTPUT_DIR  # noqa: E402
from factory.settings import load_settings  # noqa: E402
from factory.styles import ask_style, choose_for_video, chosen_for_video, style_of  # noqa: E402

SRC = ROOT / "scripts" / "demo" / "thermopylae"


def main() -> int:
    setup_console()
    ap = argparse.ArgumentParser(description="Тестовый ролик «Фермопилы»")
    ap.add_argument("--style", help="номер, id или название стиля")
    ap.add_argument("--folder", help="папка видео (по умолчанию output/<сегодня>_thermopylae)")
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--parallel", type=int, default=2)
    args = ap.parse_args()

    folder = Path(args.folder) if args.folder else OUTPUT_DIR / f"{time.strftime('%Y-%m-%d')}_thermopylae"
    folder.mkdir(parents=True, exist_ok=True)
    for name in ("script.json", "storyboard.json"):
        shutil.copy2(SRC / name, folder / name)
    if args.style:
        choose_for_video(folder, args.style)
    elif chosen_for_video(folder) is None:
        if not sys.stdin.isatty():
            print("Сначала выберите стиль: --style <номер>")
            return 1
        choose_for_video(folder, ask_style(style_of(load_settings())))
    return production.main([str(folder), *(["--no-render"] if args.no_render else []), "--parallel", str(args.parallel)])


if __name__ == "__main__":
    sys.exit(main())
