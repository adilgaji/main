"""Список визуальных стилей.

Единственный источник — video/src/styles.json (его же читает Remotion).
Сами цвета, шрифты и обработка картинки лежат в video/src/style.ts; их согласованность со
списком и читаемость текста проверяет `node scripts/check-styles.mjs` (запускается в `npm run check`).
"""
from __future__ import annotations

import json
from dataclasses import dataclass

from factory.paths import ROOT

STYLES_JSON = ROOT / "video" / "src" / "styles.json"


@dataclass(frozen=True)
class Style:
    id: str
    name_ru: str
    tagline_ru: str


def _load() -> tuple[str, list[Style]]:
    data = json.loads(STYLES_JSON.read_text(encoding="utf-8"))
    return data["default"], [Style(s["id"], s["name_ru"], s["tagline_ru"]) for s in data["styles"]]


def default_style() -> str:
    return _load()[0]


def list_styles() -> list[Style]:
    """Стили в том порядке, в котором они показаны на листе (номера 1…8)."""
    return _load()[1]


def style_ids() -> list[str]:
    return [s.id for s in list_styles()]


def resolve_style(value: str | int | None) -> str:
    """Номер с листа (1…8), id или русское название → id стиля. None → стиль по умолчанию."""
    if value is None or value == "":
        return default_style()
    styles = list_styles()
    text = str(value).strip().lower()
    if text.isdigit():
        n = int(text)
        if 1 <= n <= len(styles):
            return styles[n - 1].id
    for s in styles:
        if text in (s.id.lower(), s.name_ru.lower()):
            return s.id
    raise ValueError(f"Неизвестный стиль «{value}». Доступные: " + ", ".join(f"{i + 1} — {s.name_ru} ({s.id})" for i, s in enumerate(styles)))


def style_of(settings: dict) -> str:
    """Стиль из настроек (или из настроек с переопределением для видео); если не выбран — по умолчанию."""
    value = settings.get("style")
    if value is None:
        return default_style()
    if value not in style_ids():
        raise ValueError(f"В настройках записан неизвестный стиль «{value}»")
    return value
