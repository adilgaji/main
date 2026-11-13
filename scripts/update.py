#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Обновление фабрики (его запускает update.bat): git pull + доустановка библиотек.

Ваши настройки не теряются. Три файла меняются и у вас, и в новой версии:
  config/settings.json        — ваш выбор (голос, стиль, ключи) остаётся вашим;
  config/pronunciations.json  — слова, которые добавила проверка фактов, сохраняются;
  config/structures.json      — память последних структур видео сохраняется.
Перед обновлением их копия кладётся в logs/backup/<время>/.
"""
from __future__ import annotations

import copy
import json
import shutil
import subprocess
import sys
import time
from importlib import metadata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config"
LOCAL_FILES = ("settings.json", "pronunciations.json", "structures.json")


# ---------------------------------------------------------------- слияние своих данных с новой версией

def _deep(base: dict, over: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in over.items():
        out[k] = _deep(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else copy.deepcopy(v)
    return out


def merge_settings(new: dict, mine: dict) -> dict:
    """Новые поля — из новой версии, значения — ваши."""
    return _deep(new, mine)


def merge_pronunciations(new: dict, mine: dict) -> dict:
    """Описание словаря — из новой версии; слова — все из обеих. Если слово есть в обеих, берётся
    вариант новой версии (его проверил разработчик)."""
    out = copy.deepcopy(new)
    words = out.setdefault("words", {})
    for w, entry in (mine.get("words") or {}).items():
        if w not in words:
            words[w] = copy.deepcopy(entry)
    return out


def merge_structures(new: dict, mine: dict) -> dict:
    """Список структур — из новой версии, память последних видео — ваша."""
    out = copy.deepcopy(new)
    known = {s["id"] for s in out.get("structures", [])}
    out["recent"] = [r for r in mine.get("recent", []) if r in known]
    return out


MERGERS = {"settings.json": merge_settings, "pronunciations.json": merge_pronunciations, "structures.json": merge_structures}


def _load(text: str | None) -> dict | None:
    try:
        return json.loads(text) if text else None
    except ValueError:
        return None


def merge_file(name: str, new_text: str | None, mine_text: str | None) -> str | None:
    """Текст файла после обновления. None — оставить файл новой версии как есть."""
    mine, new = _load(mine_text), _load(new_text)
    if mine is None:
        return None
    if new is None:
        return mine_text
    merged = MERGERS[name](new, mine)
    return json.dumps(merged, ensure_ascii=False, indent=2) + "\n"


# ---------------------------------------------------------------- шаги

def git(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=ROOT, text=True, encoding="utf-8", errors="replace",
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=check)


def say(text: str) -> None:
    print(text, flush=True)


def torch_version() -> str | None:
    try:
        return metadata.version("torch")
    except metadata.PackageNotFoundError:
        return None


def pull() -> bool:
    if shutil.which("git") is None:
        say("[НЕТ!] Не найден Git. Установите: winget install Git.Git — и запустите update.bat ещё раз.")
        return False
    saved = {n: (CONFIG / n).read_text(encoding="utf-8") for n in LOCAL_FILES if (CONFIG / n).exists()}
    backup = ROOT / "logs" / "backup" / time.strftime("%Y%m%d_%H%M%S")
    backup.mkdir(parents=True, exist_ok=True)
    for n, text in saved.items():
        (backup / n).write_text(text, encoding="utf-8")
    say(f"Копия ваших настроек: {backup}")

    # свои файлы на время обновления возвращаются к версии из git — тогда git pull не спотыкается
    tracked = [f"config/{n}" for n in saved if git("ls-files", "--error-unmatch", f"config/{n}", check=False).returncode == 0]
    if tracked:
        git("checkout", "--", *tracked, check=False)
    before = git("rev-parse", "HEAD", check=False).stdout.strip()
    p = git("pull", "--ff-only", check=False)
    say(p.stdout.strip())
    ok = p.returncode == 0
    for n, text in saved.items():
        if ok:
            merged = merge_file(n, (CONFIG / n).read_text(encoding="utf-8") if (CONFIG / n).exists() else None, text)
            (CONFIG / n).write_text(merged if merged is not None else text, encoding="utf-8")
        else:
            (CONFIG / n).write_text(text, encoding="utf-8")  # не получилось — всё как было
    if not ok:
        say("[НЕТ!] Не удалось скачать обновление (вывод git — выше). Ваши файлы не тронуты.\n"
            "       Проверьте интернет и запустите update.bat ещё раз. Если не поможет — пришлите этот текст Claude.")
        return False
    after = git("rev-parse", "HEAD", check=False).stdout.strip()
    say("Обновление скачано." if after != before else "Новых изменений нет — у вас последняя версия.")
    return True


def install() -> bool:
    gpu_before = "+cu" in (torch_version() or "")
    say("\nДоустановка библиотек Python (если что-то изменилось)…")
    r = subprocess.run([sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "--resume-retries", "100",
                        "--timeout", "120", "-r", str(ROOT / "requirements.txt")], cwd=ROOT)
    if r.returncode != 0:
        say("[НЕТ!] pip не смог установить библиотеки. Запустите update.bat ещё раз (скачивание продолжится).")
        return False
    if gpu_before and "+cu" not in (torch_version() or ""):
        say("[ !! ] Ускорение на видеокарте сброшено новой версией PyTorch. Запустите install_gpu.bat ещё раз.")
    npm = shutil.which("npm")
    if not npm:
        say("[НЕТ!] Не найден Node.js (npm). Запустите setup.bat.")
        return False
    say("\nДоустановка библиотек видео (Remotion)…")
    r = subprocess.run([npm, "install", "--no-audit", "--no-fund"], cwd=ROOT / "video")
    if r.returncode != 0:
        say("[НЕТ!] npm не смог установить библиотеки видео. Запустите update.bat ещё раз.")
        return False
    return True


def page_running(port: int = 8765) -> bool:
    import urllib.request

    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/ping", timeout=2) as r:  # noqa: S310 — только этот компьютер
            return b"history-factory" in r.read()
    except Exception:  # noqa: BLE001
        return False


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except Exception:  # noqa: BLE001
            pass
    if page_running():
        say("[ !! ] Сейчас открыта страница фабрики (окно start.bat). Закройте это окно\n"
            "       и запустите update.bat ещё раз: работающая страница мешает обновить библиотеки.")
        return 1
    if not pull():
        return 1
    if "--no-install" not in sys.argv and not install():
        return 1
    say("\nГотово. Запускайте start.bat.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
