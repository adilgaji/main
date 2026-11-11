"""Подготовка текста к озвучке: чистка, абзацы, предложения, куски для синтеза.

Важно: normalize() определяет «канонический» текст. Именно он показывается в субтитрах,
и именно его слова получают время. Озвучка = субтитры на 100 %.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

# Сокращения, после которых точка НЕ заканчивает предложение.
_ABBREVIATIONS = {
    "mr", "mrs", "ms", "dr", "st", "sr", "jr", "prof", "gen", "col", "capt", "lt",
    "vs", "etc", "c", "ca", "no", "vol", "fig", "e.g", "i.e", "approx",
}

_SENT_END = re.compile(r"""([.!?…]+["”’')]*)\s+""")
_CLOSERS = "\"”’')"


def normalize(text: str) -> str:
    """Приводит текст к единому виду. Абзацы разделяются одним переводом строки."""
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace(" ", " ").replace(" ", " ").replace("\t", " ")
    text = text.replace("​", "").replace("﻿", "")
    # Апострофы — прямые (так надёжнее работают don't / Egypt's)
    text = text.replace("’", "'").replace("‘", "'").replace("`", "'")
    # Квадратные скобки зарезервированы под разметку произношения
    text = text.replace("[", "(").replace("]", ")")
    # Диапазон лет/чисел: 1914–1918 → 1914 to 1918
    text = re.sub(r"(?<=\d)\s*[–—-]\s*(?=\d)", " to ", text)
    # Тире: двойной дефис, короткое тире и « - » → длинное тире с пробелами
    text = text.replace("--", "—")
    text = re.sub(r"\s+-\s+", " — ", text)
    text = re.sub(r"\s*[–—]\s*", " — ", text)
    text = text.replace("...", "…")
    lines = []
    for line in text.split("\n"):
        line = re.sub(r" {2,}", " ", line).strip()
        line = re.sub(r"\s+([,.;:!?…])", r"\1", line)  # пробел перед знаком препинания
        if line:
            lines.append(line)
    return "\n".join(lines)


def split_paragraphs(text: str) -> list[str]:
    return [p for p in normalize(text).split("\n") if p]


def split_sentences(paragraph: str) -> list[str]:
    """Делит абзац на предложения. Склейка через пробел даёт исходный абзац."""
    sentences: list[str] = []
    start = 0
    for m in _SENT_END.finditer(paragraph):
        end = m.end(1)
        nxt = paragraph[m.end():m.end() + 1]
        if not nxt:
            break
        before = paragraph[start:m.start(1)]
        last_word = before.rsplit(" ", 1)[-1].strip("\"“”'(").lower()
        marks = m.group(1).rstrip(_CLOSERS)
        if marks == ".":
            if last_word in _ABBREVIATIONS:
                continue
            if len(last_word) == 1 and last_word.isalpha():  # инициал: «J. Caesar»
                continue
        if not (nxt.isupper() or nxt.isdigit() or nxt in "\"“'("):
            continue
        sentences.append(paragraph[start:end].strip())
        start = m.end()
    tail = paragraph[start:].strip()
    if tail:
        sentences.append(tail)
    return sentences


@dataclass
class Chunk:
    """Кусок текста, который синтезируется за один вызов модели."""

    text: str
    paragraph: int  # номер абзаца (с 0)
    first_sentence: int  # сквозной номер первого предложения куска (с 0)
    sentences: list[str]


def make_chunks(text: str, max_chars: int = 280) -> list[Chunk]:
    """Собирает предложения в куски до max_chars символов, не выходя за абзац.

    Короткие предложения («Three places.») не озвучиваются в одиночку — рядом с соседями
    интонация получается естественнее.
    """
    chunks: list[Chunk] = []
    sent_no = 0
    for p_idx, para in enumerate(split_paragraphs(text)):
        cur: list[str] = []
        cur_first = sent_no
        for sent in split_sentences(para):
            if cur and len(" ".join(cur)) + 1 + len(sent) > max_chars:
                chunks.append(Chunk(" ".join(cur), p_idx, cur_first, cur))
                cur, cur_first = [], sent_no
            cur.append(sent)
            sent_no += 1
        if cur:
            chunks.append(Chunk(" ".join(cur), p_idx, cur_first, cur))
    return chunks


def words_of(text: str) -> list[str]:
    """Слова так, как они показываются в субтитрах (со знаками препинания)."""
    return normalize(text).split()


def count_words(text: str) -> int:
    """Число произносимых слов (без отдельно стоящих тире и т. п.)."""
    return sum(1 for w in words_of(text) if any(ch.isalnum() for ch in w))
