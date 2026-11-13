"""Запуск веб-страницы: python -m factory.web  (это делает start.bat).

Страница открывается в браузере сама. Если она уже запущена (второй щелчок по start.bat),
просто открывается ещё раз, без второго сервера.
"""
from __future__ import annotations

import argparse
import json
import socket
import sys
import threading
import time
import urllib.request
import webbrowser

from factory.console import setup_console

HOST = "127.0.0.1"
DEFAULT_PORT = 8765


def ours(port: int) -> bool:
    """На этом порту уже работает наша страница?"""
    try:
        with urllib.request.urlopen(f"http://{HOST}:{port}/api/ping", timeout=2) as r:  # noqa: S310 — только 127.0.0.1
            return json.loads(r.read().decode("utf-8")).get("app") == "history-factory"
    except Exception:  # noqa: BLE001
        return False


def port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((HOST, port))
            return True
        except OSError:
            return False


def pick_port(start: int) -> tuple[int, bool]:
    """(порт, уже_запущено). Наш сервер на порту — используем его; занято чужим — следующий порт."""
    for port in range(start, start + 20):
        if ours(port):
            return port, True
        if port_free(port):
            return port, False
    raise SystemExit("Не нашлось свободного порта для страницы (8765–8784).")


def open_later(url: str, delay: float = 1.5) -> None:
    def go() -> None:
        time.sleep(delay)
        webbrowser.open(url)

    threading.Thread(target=go, daemon=True).start()


def main(argv: list[str] | None = None) -> int:
    setup_console()
    ap = argparse.ArgumentParser(description="Веб-страница фабрики")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--no-browser", action="store_true", help="не открывать браузер")
    args = ap.parse_args(argv)

    port, running = pick_port(args.port)
    url = f"http://{HOST}:{port}"
    if running:
        print(f"Страница уже работает: {url} — открываю её в браузере.")
        if not args.no_browser:
            webbrowser.open(url)
        return 0

    import uvicorn

    from factory.web.app import app

    print("=" * 64)
    print(f"  Фабрика исторических видео: {url}")
    print("  Страница откроется в браузере сама.")
    print("  НЕ закрывайте это окно, пока работаете со страницей.")
    print("  Закончить работу: закройте окно или нажмите Ctrl+C.")
    print("=" * 64)
    if not args.no_browser:
        open_later(url)
    uvicorn.run(app, host=HOST, port=port, log_level="warning")
    return 0


if __name__ == "__main__":
    sys.exit(main())
