"""Интро канала: играет в каждом видео сразу после хука — первого абзаца главы 1.

Настройки — config/intro.json (название, фразы, вариант картинки, скорость голоса).
Голос интро — тот же, что у видео (тот же движок), но медленнее. Интро вставляется в звук
первой главы; слова главы после него сдвигаются, поэтому субтитры, таймкоды глав и
проверки считаются уже по настоящему звуку. Картинку рисует композиция Remotion `Intro`.
"""
from __future__ import annotations

import json
import math
import re
from pathlib import Path

import numpy as np

from factory.paths import CONFIG_DIR

PATH = CONFIG_DIR / "intro.json"
FPS = 30
LEAD = 0.3  # тишина перед голосом интро: картинка успевает проявиться
TAIL = 0.5  # тишина после голоса: название успевает постоять
# Если в главе 1 нет отдельного абзаца-хука — интро после предложения, ближайшего к ~30 словам.
HOOK_WORDS, HOOK_MIN_WORDS, HOOK_MAX_WORDS = 30, 8, 70
SENT_END = re.compile(r"[.!?…][\"”')]?$")


def load(path: Path | None = None) -> dict | None:
    """Настройки интро или None, если интро выключено."""
    p = path or PATH
    if not p.exists():
        return None
    cfg = json.loads(p.read_text(encoding="utf-8"))
    return cfg if cfg.get("enabled") and cfg.get("phrases") else None


def text_of(cfg: dict) -> str:
    """Каждая фраза — отдельный абзац: между ними пауза cfg["pause"]."""
    return "\n".join(p.strip() for p in cfg["phrases"] if p.strip())


def key_of(cfg: dict | None) -> list:
    """Всё, что влияет на звук интро (для кэша озвучки)."""
    if not cfg:
        return []
    return [text_of(cfg), cfg.get("pause"), cfg.get("voice_speed")]


def split_word(text: str, anchors: list[int] | None = None) -> int | None:
    """Номер слова главы 1, ПЕРЕД которым играет интро (начало второго абзаца).

    Нет второго абзаца — начало предложения около 30-го слова. anchors — номера слов, с которых
    начинаются кадры раскадровки: если на границе хука кадр не начинается, берётся ближайшая
    граница кадров (лучше — на начале предложения). None — места для интро нет.
    """
    from factory.tts.text import normalize, split_paragraphs

    words = normalize(text).split()
    if len(words) < 2:
        return None
    paras = split_paragraphs(text)
    j = len(paras[0].split()) if len(paras) > 1 else None
    starts = [i for i in range(1, len(words)) if SENT_END.search(words[i - 1])]
    if j is None:
        near = [i for i in starts if HOOK_MIN_WORDS <= i <= HOOK_MAX_WORDS]
        j = min(near, key=lambda i: abs(i - HOOK_WORDS)) if near else None
    if anchors and j is not None and j not in anchors:
        ok = [a for a in anchors[1:] if HOOK_MIN_WORDS <= a <= HOOK_MAX_WORDS]
        good = [a for a in ok if a in starts] or ok
        if good:
            j = min(good, key=lambda a: abs(a - j))
    return j if j is not None and 0 < j < len(words) else None


def first_words(text: str, j: int, n: int = 5) -> str:
    from factory.tts.text import normalize

    return " ".join(normalize(text).split()[j:j + n])


def insert(audio: np.ndarray, sr: int, words: list[dict], j: int, voice_audio: np.ndarray, voice_words: list[dict]) -> tuple[np.ndarray, list[dict], dict]:
    """Вставляет интро в звук главы перед словом j (в середину паузы, по границе кадра).

    Возвращает (новый звук, слова главы со сдвигом, сведения об интро для раскладки)."""
    mid = (words[j - 1]["end"] + words[j]["start"]) / 2
    at = round(mid * FPS)
    frames = math.ceil((LEAD + len(voice_audio) / sr + TAIL) * FPS - 1e-6)
    seg = np.zeros(round(frames * sr / FPS), dtype=np.float32)
    s0 = round(LEAD * sr)
    piece = voice_audio[: len(seg) - s0]
    seg[s0: s0 + len(piece)] = piece
    cut = round(at * sr / FPS)
    out = np.concatenate([audio[:cut], seg, audio[cut:]])
    shift = frames / FPS
    moved = words[:j] + [{**w, "start": round(w["start"] + shift, 3), "end": round(w["end"] + shift, 3)} for w in words[j:]]
    info = {
        "at_frame": at, "frames": frames, "word": j,
        "words": [{"text": w["text"], "start": round(LEAD + w["start"], 3), "end": round(LEAD + w["end"], 3)} for w in voice_words],
    }
    return out, moved, info


def props_of(intro: dict, cfg: dict | None) -> dict:
    """Данные для слоя интро в композиции главы."""
    cfg = cfg or {}
    return {"start": intro["at_frame"], "frames": intro["frames"], "variant": cfg.get("variant", "ages"),
            "channel": cfg.get("channel", ""), "words": intro.get("words", [])}
