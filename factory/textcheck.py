"""Автоматическая проверка простоты текста и объёма: «понятно школьнику».

Уровень по формуле Флеша–Кинкейда (класс американской школы): цель — не выше 8.
Слоги считаются приближённо (по группам гласных), этого достаточно для оценки.
"""
from __future__ import annotations

import json
import re

from factory.paths import ASSETS_DIR

MAX_GRADE = 8.5
MAX_SENTENCE_WORDS = 30
# Слов в минуту ГОТОВОГО видео относительно темпа голоса (с паузами между фразами и главами).
# Замер на тестовом ролике «Фермопилы»: 412 слов → 2:22 голосом am_fenrir (159 слов/мин) = 174 слова/мин.
VIDEO_RATE = 1.09
FORBIDDEN = re.compile(r"\b(subscribe|like and subscribe|smash (?:that|the) like|hit the bell|comment below)\b", re.I)
SINGLE_ROMAN_I = re.compile(r"\b[A-Z][a-z]+ I(?=[\s,.;:!?)]|$)(?! (?:am|was|have|had|think|know|will|would|can|could|say|said|went|saw)\b)")


def syllables(word: str) -> int:
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    if len(w) <= 3:
        return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w)
    w = re.sub(r"^y", "", w)
    return max(1, len(re.findall(r"[aeiouy]{1,2}", w)))


def sentences(text: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?…])\s+", text.strip()) if re.search(r"[A-Za-z]", s)]


def words(text: str) -> list[str]:
    return [w for w in text.split() if re.search(r"[A-Za-z0-9]", w)]


def grade(text: str) -> float:
    """Флеш–Кинкейд: 0.39·(слов/предложение) + 11.8·(слогов/слово) − 15.59."""
    ws, ss = words(text), sentences(text)
    if not ws or not ss:
        return 0.0
    syl = sum(syllables(w) for w in ws)
    return round(0.39 * len(ws) / len(ss) + 11.8 * syl / len(ws) - 15.59, 1)


def voice_wpm(voice: str) -> float:
    try:
        data = json.loads((ASSETS_DIR / "voices" / "samples.json").read_text(encoding="utf-8"))
        return float(next(v["words_per_minute"] for v in data["voices"] if v["id"] == voice))
    except Exception:  # noqa: BLE001
        return 160.0


def words_target(minutes: float, voice: str) -> int:
    """Сколько слов нужно на столько минут видео выбранным голосом."""
    return int(round(minutes * voice_wpm(voice) * VIDEO_RATE / 10) * 10)


def check_script(chapters: list[dict], target: int, tolerance: float = 0.12) -> tuple[list[str], dict]:
    """(ошибки, сводка) для текста глав. Ошибки возвращаются сценаристу на исправление."""
    errors: list[str] = []
    full = "\n".join(c.get("text", "") for c in chapters)
    total = len(words(full))
    if not (target * (1 - tolerance) <= total <= target * (1 + tolerance)):
        errors.append(f"total length is {total} words, it must be {int(target * (1 - tolerance))}–{int(target * (1 + tolerance))} (target {target})")
    g = grade(full)
    if g > MAX_GRADE:
        errors.append(f"the text is too hard (Flesch-Kincaid grade {g}); use shorter sentences and simpler words, max grade {MAX_GRADE}")
    for c in chapters:
        for s in sentences(c.get("text", "")):
            if len(words(s)) > MAX_SENTENCE_WORDS:
                errors.append(f"chapter {c.get('id')}: sentence longer than {MAX_SENTENCE_WORDS} words: «{s[:80]}…»")
        if FORBIDDEN.search(c.get("text", "")):
            errors.append(f"chapter {c.get('id')}: no calls to subscribe / like / comment")
        m = SINGLE_ROMAN_I.search(c.get("text", ""))
        if m:
            errors.append(f"chapter {c.get('id')}: write «{m.group(0)[:-2]} the First» instead of «{m.group(0)}»")
        if re.search(r"[\[\]*#_<>{}]|\(music|\(sound", c.get("text", ""), re.I):
            errors.append(f"chapter {c.get('id')}: no markup, brackets or stage directions in the voice-over")
    return errors, {"words": total, "grade": g, "target": target}
