"""Вежливые запросы к архивам: кэш ответов, паузы, повторы при сбоях связи.

Защиту сайтов не обходим: на отказ (403) или «слишком много запросов» (429) сразу
останавливаемся и сообщаем об этом понятным текстом.
"""
from __future__ import annotations

import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from factory.paths import CACHE_DIR

# Имя программы без каких-либо личных данных владельца.
USER_AGENT = "HistoryVideoFactory/1.0 (local video tool)"
API_CACHE = CACHE_DIR / "api"
MIN_GAP = 0.35  # секунд между запросами к одному сайту

_last_call: dict[str, float] = {}


class ArchiveUnavailable(RuntimeError):
    """Архив не ответил или отказал (сеть, 403, 429). Текст — на русском."""


class NotFound(ArchiveUnavailable):
    """Такой записи в архиве нет (404 / 410) — остальные записи искать можно."""


def _wait(host: str) -> None:
    gap = time.time() - _last_call.get(host, 0.0)
    if gap < MIN_GAP:
        time.sleep(MIN_GAP - gap)
    _last_call[host] = time.time()


def _open(url: str, headers: dict | None, timeout: float):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    host = urllib.parse.urlsplit(url).netloc
    last: Exception | None = None
    for attempt in range(3):
        _wait(host)
        try:
            return urllib.request.urlopen(req, timeout=timeout)  # noqa: S310 — адреса только из списка архивов
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 2:
                # Сайт сам говорит, сколько подождать (Retry-After). Короткую паузу выдерживаем, длинную — нет.
                pause = e.headers.get("Retry-After", "") if e.headers else ""
                if pause.isdigit() and int(pause) <= 60:
                    time.sleep(int(pause) + 1)
                    continue
            if e.code in (403, 429):
                why = "отказал роботу (403)" if e.code == 403 else "просит подождать: слишком много запросов (429)"
                raise ArchiveUnavailable(f"{host} {why}. Защиту не обходим — попробуйте позже или с ноутбука.") from e
            if e.code in (404, 410):
                raise NotFound(f"{host}: запись не найдена ({e.code}): {url}") from e
            last = e
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            last = e
        time.sleep(1.5 * (attempt + 1))
    raise ArchiveUnavailable(f"{host} не отвечает: {last}")


def get_json(url: str, params: dict | None = None, headers: dict | None = None, cache_hours: float = 168, timeout: float = 40) -> dict:
    """GET → JSON. Ответ кэшируется на диске (по умолчанию на неделю)."""
    if params:
        url = url + ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    key = hashlib.sha1((url + json.dumps(headers or {}, sort_keys=True)).encode()).hexdigest()
    cached = API_CACHE / f"{key}.json"
    if cache_hours > 0 and cached.exists() and time.time() - cached.stat().st_mtime < cache_hours * 3600:
        return json.loads(cached.read_text(encoding="utf-8"))
    with _open(url, {"Accept": "application/json", **(headers or {})}, timeout) as r:
        raw = r.read()
    try:
        data = json.loads(raw)
    except ValueError as e:
        raise ArchiveUnavailable(f"{urllib.parse.urlsplit(url).netloc} вернул не данные, а страницу (возможно, защита от роботов).") from e
    API_CACHE.mkdir(parents=True, exist_ok=True)
    cached.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def download(url: str, dest: Path, max_mb: float = 160, timeout: float = 120) -> Path:
    """Скачивает файл целиком (во временный файл, затем переименование)."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    size = 0
    with _open(url, None, timeout) as r, open(tmp, "wb") as f:
        while True:
            block = r.read(1 << 16)
            if not block:
                break
            size += len(block)
            if size > max_mb * 1024 * 1024:
                f.close()
                tmp.unlink(missing_ok=True)
                raise ArchiveUnavailable(f"Файл больше {max_mb:.0f} МБ — пропускаю: {url}")
            f.write(block)
    if size < 2000:
        tmp.unlink(missing_ok=True)
        raise ArchiveUnavailable(f"Вместо изображения пришёл пустой ответ: {url}")
    tmp.replace(dest)
    return dest
