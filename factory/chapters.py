"""Главы с таймкодами: chapters.json и блок глав для description.txt.

Время главы — время её первого слова в реальной озвучке (первая глава — всегда 0:00,
так требует YouTube). Проверки: первая строка «0:00», глав не меньше трёх, каждая не короче
10 секунд, время по возрастанию, названия до 40 знаков, расхождение с видео не больше 1 с.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

MIN_CHAPTERS, MIN_SECONDS, MAX_TITLE = 3, 10, 40
_LINE = re.compile(r"^(\d+):(\d\d)(?::(\d\d))? (.+)$")


def timecode(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600}:{s // 60 % 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


def build(titles: list[str], first_word_times: list[float]) -> list[dict]:
    """Список глав: {title, start (целые секунды), timecode}."""
    out = []
    for i, (title, t) in enumerate(zip(titles, first_word_times)):
        start = 0 if i == 0 else int(t)
        out.append({"title": title.strip(), "start": start, "timecode": timecode(start)})
    return out


def description_block(chapters: list[dict]) -> str:
    return "\n".join(f"{c['timecode']} {c['title']}" for c in chapters) + "\n"


def write(chapters: list[dict], folder: Path) -> None:
    (folder / "chapters.json").write_text(json.dumps(chapters, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (folder / "description.txt").write_text(description_block(chapters), encoding="utf-8")


def parse_description(text: str) -> list[dict]:
    out = []
    for line in text.splitlines():
        m = _LINE.match(line.strip())
        if m:
            a, b, c = int(m.group(1)), int(m.group(2)), m.group(3)
            start = a * 3600 + b * 60 + int(c) if c else a * 60 + b
            out.append({"title": m.group(4).strip(), "start": start, "timecode": line.split(" ", 1)[0]})
    return out


def problems(folder: Path, video_starts: list[float], video_duration: float) -> list[str]:
    """video_starts — где главы реально начинаются в video.mp4 (секунды)."""
    out: list[str] = []
    desc, js = folder / "description.txt", folder / "chapters.json"
    if not desc.exists() or not js.exists():
        return ["нет description.txt или chapters.json"]
    lines = [ln for ln in desc.read_text(encoding="utf-8").splitlines() if ln.strip()]
    listed = parse_description(desc.read_text(encoding="utf-8"))
    stored = json.loads(js.read_text(encoding="utf-8"))
    if not lines or not lines[0].startswith("0:00 "):
        out.append("description.txt: первая строка должна начинаться с «0:00 »")
    if len(listed) < MIN_CHAPTERS:
        out.append(f"глав {len(listed)}, а нужно не меньше {MIN_CHAPTERS}")
    if [(c["title"], c["start"]) for c in listed] != [(c["title"], c["start"]) for c in stored]:
        out.append("главы в description.txt и в chapters.json не совпадают")
    if len(listed) != len(video_starts):
        out.append(f"глав в описании {len(listed)}, а в видео {len(video_starts)}")
    for i, c in enumerate(listed):
        end = listed[i + 1]["start"] if i + 1 < len(listed) else video_duration
        if i and c["start"] <= listed[i - 1]["start"]:
            out.append(f"глава {i + 1}: время не по возрастанию")
        if end - c["start"] < MIN_SECONDS:
            out.append(f"глава {i + 1} «{c['title']}» короче {MIN_SECONDS} с")
        if not c["title"] or len(c["title"]) > MAX_TITLE:
            out.append(f"глава {i + 1}: название должно быть от 1 до {MAX_TITLE} знаков")
        if i < len(video_starts) and abs(c["start"] - video_starts[i]) > 1.0:
            out.append(f"глава {i + 1}: таймкод {c['timecode']} расходится с видео ({video_starts[i]:.1f} с) больше чем на секунду")
    return out
