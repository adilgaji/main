"""Список визуальных стилей.

Единственный источник — video/src/styles.json (его же читает Remotion).
Сами цвета, шрифты и обработка картинки лежат в video/src/style.ts; их согласованность со
списком и читаемость текста проверяет `node scripts/check-styles.mjs` (запускается в `npm run check`).
"""
from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

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


# ------------------------------------------------------------------ шаг «выбор стиля» перед запуском

def menu_text(current: str) -> str:
    """Нумерованный список стилей; текущий помечен."""
    lines = []
    for i, st in enumerate(list_styles(), 1):
        mark = "   ← сейчас" if st.id == current else ""
        lines.append(f"  {i}. {st.name_ru} — {st.tagline_ru}{mark}")
    return "\n".join(lines)


def ask_style(
    current: str,
    ask: Callable[[str], str] = input,
    say: Callable[[str], None] = print,
    tries: int = 5,
) -> str:
    """Показывает список и спрашивает номер. Пустой ответ — оставить текущий стиль."""
    name = next(st.name_ru for st in list_styles() if st.id == current)
    say("Выберите стиль видео:\n" + menu_text(current))
    for _ in range(tries):
        answer = ask(f"Номер 1–{len(list_styles())} (Enter — оставить «{name}»): ").strip()
        if not answer:
            return current
        try:
            return resolve_style(answer)
        except ValueError:
            say("Не понял. Введите номер из списка, например 3.")
    raise ValueError("Стиль не выбран: ответ не распознан")


def _state_path(video_dir: str | Path) -> Path:
    return Path(video_dir) / "state.json"


def _read_state(video_dir: str | Path) -> dict:
    path = _state_path(video_dir)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def choose_for_video(video_dir: str | Path, value: str | int) -> str:
    """Записывает выбор стиля для одного видео (output/<дата>_<тема>/state.json). Остальное в файле не трогает."""
    style = resolve_style(value)
    state = _read_state(video_dir)
    state.setdefault("overrides", {})["style"] = style
    path = _state_path(video_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return style


def chosen_for_video(video_dir: str | Path) -> str | None:
    """Стиль, выбранный для этого видео; None — выбор ещё не сделан."""
    value = _read_state(video_dir).get("overrides", {}).get("style")
    return resolve_style(value) if value else None


def require_style_chosen(video_dir: str | Path) -> str:
    """Ворота перед производством: без выбранного стиля генерация не стартует."""
    style = chosen_for_video(video_dir)
    if style is None:
        raise ValueError(
            "Перед запуском нужно выбрать стиль видео: python scripts/styles.py pick --video "
            f"{video_dir}  (или напишите «стиль N» в чате)"
        )
    return style
