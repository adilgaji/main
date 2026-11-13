"""Субтитры: те же «страницы» по две строки, что и на экране, + файл .srt.

Разбивка повторяет buildPages из video/src/components/Captions.tsx: страница не пересекает
границу предложения, строки выравниваются по длине. Поэтому .srt совпадает с тем, что видно в кадре.
"""
from __future__ import annotations

import math
import re
from pathlib import Path

MAX_CHARS = 36
_SENTENCE_END = re.compile(r"[.!?…][\"”')]?$")


def _line_len(words: list[dict], idx: list[int]) -> int:
    return sum(len(words[i]["text"]) for i in idx) + max(0, len(idx) - 1)


def _wrap_balanced(words: list[dict], idx: list[int], max_chars: int) -> list[list[int]]:
    total = _line_len(words, idx)
    count = max(1, math.ceil(total / max_chars))
    while count <= len(idx):
        target = total / count
        lines: list[list[int]] = [[]]
        length, ok = 0, True
        for i in idx:
            add = len(words[i]["text"]) + (1 if length else 0)
            is_last = len(lines) == count
            if length > 0 and (length + add > max_chars or (not is_last and length + add / 2 > target)):
                lines.append([])
                length = 0
            lines[-1].append(i)
            length += len(words[i]["text"]) + (1 if length else 0)
            if length > max_chars and len(lines[-1]) > 1:
                ok = False
        if ok and len(lines) <= count:
            return lines
        count += 1
    return [[i] for i in idx]


def build_pages(words: list[dict], max_chars: int = MAX_CHARS) -> list[dict]:
    """words: [{text, start, end}] → страницы [{lines: [[номера слов]], start, end}]."""
    sentences: list[list[int]] = [[]]
    for i, w in enumerate(words):
        sentences[-1].append(i)
        if _SENTENCE_END.search(w["text"]) and i < len(words) - 1:
            sentences.append([])
    groups: list[list[list[int]]] = []
    for sent in sentences:
        if not sent:
            continue
        lines = _wrap_balanced(words, sent, max_chars)
        for i in range(0, len(lines), 2):
            groups.append(lines[i:i + 2])
    merged: list[list[list[int]]] = []
    for g in groups:
        prev = merged[-1] if merged else None
        if prev and len(prev) == 1 and len(g) == 1:
            gap = words[g[0][0]]["start"] - words[prev[0][-1]]["end"]
            if gap < 0.7:
                prev.append(g[0])
                continue
        merged.append([list(line) for line in g])
    pages = []
    for lines in merged:
        flat = [i for line in lines for i in line]
        pages.append({"lines": lines, "start": words[flat[0]]["start"], "end": words[flat[-1]]["end"]})
    for i, pg in enumerate(pages):
        nxt = pages[i + 1] if i + 1 < len(pages) else None
        pg["end"] = min(nxt["start"], pg["end"] + 1.2) if nxt else pg["end"] + 0.6
    return pages


def srt_time(t: float) -> str:
    ms = max(0, round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def cues(chapters: list[tuple[float, list[dict]]], max_chars: int = MAX_CHARS) -> list[dict]:
    """chapters: [(начало главы в секундах, слова главы со временем от её начала)] → реплики."""
    out = []
    for offset, words in chapters:
        for pg in build_pages(words, max_chars):
            text = "\n".join(" ".join(words[i]["text"] for i in line) for line in pg["lines"])
            out.append({"start": offset + pg["start"], "end": offset + pg["end"], "text": text})
    for a, b in zip(out, out[1:]):  # реплики не накладываются
        a["end"] = min(a["end"], b["start"])
    return out


def write_srt(items: list[dict], path: Path) -> None:
    blocks = [f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}\n" for i, c in enumerate(items, 1)]
    path.write_text("\n".join(blocks), encoding="utf-8")


def read_srt(path: Path) -> list[dict]:
    def sec(s: str) -> float:
        h, m, rest = s.split(":")
        return int(h) * 3600 + int(m) * 60 + float(rest.replace(",", "."))

    out = []
    for block in re.split(r"\n\s*\n", path.read_text(encoding="utf-8").strip()):
        lines = block.strip().splitlines()
        if len(lines) >= 3 and "-->" in lines[1]:
            a, b = (x.strip() for x in lines[1].split("-->"))
            out.append({"start": sec(a), "end": sec(b), "text": "\n".join(lines[2:])})
    return out


def problems(path: Path, expected_words: list[str], duration: float) -> list[str]:
    """Проверка .srt: текст совпадает со словами озвучки на 100 %, время идёт по порядку, не больше двух строк."""
    if not path.exists():
        return ["нет файла captions.srt"]
    items = read_srt(path)
    out = []
    got = " ".join(c["text"] for c in items).split()
    if got != expected_words:
        k = next((i for i, (a, b) in enumerate(zip(got, expected_words)) if a != b), min(len(got), len(expected_words)))
        out.append(f"текст субтитров расходится с озвучкой на слове №{k + 1} (слов {len(got)} против {len(expected_words)})")
    for i, c in enumerate(items):
        if c["end"] <= c["start"]:
            out.append(f"реплика {i + 1}: конец не позже начала")
        if i and c["start"] < items[i - 1]["end"] - 1e-3:
            out.append(f"реплика {i + 1}: накладывается на предыдущую")
        if c["text"].count("\n") > 1:
            out.append(f"реплика {i + 1}: больше двух строк")
        if any(len(line) > MAX_CHARS + 8 for line in c["text"].splitlines()):
            out.append(f"реплика {i + 1}: слишком длинная строка")
    if items and items[-1]["end"] > duration + 0.05:
        out.append("последняя реплика заканчивается позже конца видео")
    return out
