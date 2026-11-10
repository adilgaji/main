"""Оценка простоты английского текста (Flesch–Kincaid grade = «класс школы»).

Чем меньше число, тем проще текст. Цель для роликов: ≤ 6 (понятно ребёнку ~10–11 лет).
"""
from __future__ import annotations

import re

MAX_GRADE = 6.0
MAX_SENTENCE_WORDS = 14


def syllables(word: str) -> int:
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    if len(w) <= 3:
        return 1
    w = re.sub(r"(?:es|ed|e)$", "", w) or w
    groups = re.findall(r"[aeiouy]+", w)
    return max(1, len(groups))


def analyze(text: str) -> dict:
    text = text.replace("*", "")
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if re.search(r"[A-Za-z]", s)]
    words = re.findall(r"[A-Za-z][A-Za-z'’-]*", text)
    n_w = max(1, len(words))
    n_s = max(1, len(sentences))
    syl = sum(syllables(w) for w in words)
    grade = 0.39 * (n_w / n_s) + 11.8 * (syl / n_w) - 15.59
    long_sent = [s for s in sentences if len(s.split()) > MAX_SENTENCE_WORDS]
    common = {"everyone", "everything", "important", "recovery", "together", "anything", "somebody", "exercise", "yesterday", "tomorrow", "different", "another", "family", "energy", "body", "every"}
    hard_words = sorted({w for w in words if syllables(w) >= 3 and len(w) >= 8 and w.lower() not in common})
    return {
        "grade": round(grade, 1),
        "words": len(words),
        "avg_sentence": round(n_w / n_s, 1),
        "long_sentences": long_sent,
        "hard_words": hard_words,
    }


def problems(text: str) -> list[str]:
    a = analyze(text)
    out = []
    if a["grade"] > MAX_GRADE or len(a["hard_words"]) > 3:
        out.append(f"reading grade {a['grade']} is above {MAX_GRADE}")
    for s in a["long_sentences"]:
        out.append(f"sentence too long: \"{s}\"")
    if a["hard_words"]:
        out.append("hard words (make simpler or explain in plain words): " + ", ".join(a["hard_words"]))
    return out
