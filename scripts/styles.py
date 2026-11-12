#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Стили видео: листы-образцы, список, выбор.

  python scripts/styles.py sheets          # нарисовать листы «один кадр в 8 стилях» → video/out/styles-*.png
  python scripts/styles.py list            # показать 8 стилей и текущий выбор
  python scripts/styles.py set 3           # выбрать стиль по номеру с листа (или id / названию)
  python scripts/styles.py set 3 --video output/2025-01-01_thermopylae   # только для одного видео
  python scripts/styles.py check           # проверка стилей: контраст текста, шрифты, различимость
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from factory.console import setup_console  # noqa: E402
from factory.settings import load_settings, update_settings  # noqa: E402
from factory.styles import list_styles, resolve_style, style_of  # noqa: E402

VIDEO = ROOT / "video"
OUT = VIDEO / "out"
SHEETS = {"image": "Styles-Image", "map": "Styles-Map", "quote": "Styles-Quote"}


def npx() -> str:
    found = shutil.which("npx")
    if not found:
        raise SystemExit("Не найден npx (ставится вместе с Node.js).")
    return found


def cmd_sheets(args: argparse.Namespace) -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    gl = args.gl or ("swiftshader" if sys.platform.startswith("linux") else "angle")
    for name, comp in SHEETS.items():
        target = OUT / f"styles-{name}.png"
        # scale=2 — лист 3840x2160, чтобы текст в каждой ячейке был читаем
        subprocess.run([npx(), "remotion", "still", comp, str(target), "--scale=2", f"--gl={gl}", "--log=error"], cwd=VIDEO, check=True)
        print(f"Готово: {target}")
    return 0


def cmd_list(_: argparse.Namespace) -> int:
    current = style_of(load_settings())
    for i, s in enumerate(list_styles(), 1):
        mark = "  ← выбран" if s.id == current else ""
        print(f"{i}. {s.name_ru} ({s.id}) — {s.tagline_ru}{mark}")
    if load_settings().get("style") is None:
        print("\nСтиль ещё не выбран: пока используется первый («по умолчанию»).")
    return 0


def cmd_set(args: argparse.Namespace) -> int:
    style = resolve_style(args.style)
    name = next(s.name_ru for s in list_styles() if s.id == style)
    if args.video:
        # Переопределение для одного видео хранится в state.json этого видео (блок C создаёт его целиком).
        state_path = Path(args.video) / "state.json"
        state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
        state.setdefault("overrides", {})["style"] = style
        state_path.parent.mkdir(parents=True, exist_ok=True)
        state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Для видео {args.video} выбран стиль «{name}».")
    else:
        update_settings({"style": style})
        print(f"Стиль по умолчанию: «{name}» ({style}). Записано в config/settings.json.")
    return 0


def cmd_check(_: argparse.Namespace) -> int:
    return subprocess.run([shutil.which("node") or "node", "scripts/check-styles.mjs"], cwd=VIDEO).returncode


def main() -> int:
    setup_console()
    ap = argparse.ArgumentParser(description="Стили видео")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("sheets", help="листы-образцы: один кадр в 8 стилях")
    p.add_argument("--gl")
    p.set_defaults(fn=cmd_sheets)
    sub.add_parser("list", help="список стилей").set_defaults(fn=cmd_list)
    p = sub.add_parser("set", help="выбрать стиль")
    p.add_argument("style", help="номер с листа, id или название")
    p.add_argument("--video", help="папка видео: выбрать стиль только для него")
    p.set_defaults(fn=cmd_set)
    sub.add_parser("check", help="проверка стилей").set_defaults(fn=cmd_check)
    args = ap.parse_args()
    try:
        return args.fn(args)
    except ValueError as e:
        print(f"Ошибка: {e}")
        return 2


if __name__ == "__main__":
    sys.exit(main())
