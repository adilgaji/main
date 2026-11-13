"""Поиск изображений в архивах из командной строки.

    python -m factory.images.cli search "greek helmet" [--archive met,aic] [--limit 5]
    python -m factory.images.cli get met:248299
    python -m factory.images.cli archives        — какие архивы сейчас отвечают
"""
from __future__ import annotations

import argparse
import sys

from factory.console import setup_console
from factory.images import ARCHIVES, ArchiveUnavailable, LicenseRejected, get, search


def _line(r) -> str:
    size = f"{r.width}x{r.height}" if r.width else "?"
    return f"{r.ref} | {size} | {r.license} | {r.date[:24]} | {r.title[:70]} | {r.creator[:40]}"


def main(argv: list[str] | None = None) -> int:
    setup_console()
    ap = argparse.ArgumentParser(description="Изображения из открытых архивов (только public domain / CC0)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search", help="поиск по архивам")
    s.add_argument("query")
    s.add_argument("--archive", help="через запятую: " + ", ".join(ARCHIVES))
    s.add_argument("--limit", type=int, default=5)
    g = sub.add_parser("get", help="проверить одну запись: архив:id")
    g.add_argument("ref")
    sub.add_parser("archives", help="проверить, отвечают ли архивы")
    args = ap.parse_args(argv)

    if args.cmd == "search":
        names = args.archive.split(",") if args.archive else None
        found, problems = search(args.query, names, args.limit)
        for r in found:
            print(_line(r))
        for name, why in problems.items():
            print(f"[{name}] не ответил: {why}")
        print(f"Найдено с подтверждённой лицензией: {len(found)}")
        return 0
    if args.cmd == "get":
        try:
            r = get(args.ref)
        except LicenseRejected as e:
            print(f"Нельзя использовать: {e}")
            return 1
        except ArchiveUnavailable as e:
            print(f"Архив не ответил: {e}")
            return 2
        print(_line(r))
        print(f"  лицензия:  {r.license} — {r.evidence}")
        print(f"  страница:  {r.page_url}\n  файл:      {r.image_url}\n  подпись:   {r.credit}")
        return 0
    for name, a in ARCHIVES.items():
        try:
            n = len(a.search("greece", 1))
            print(f"{a.title:<34} отвечает ({'есть результат' if n else 'пусто'})")
        except ArchiveUnavailable as e:
            print(f"{a.title:<34} НЕ отвечает: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
