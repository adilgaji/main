"""Словарь произношений исторических имён и мест.

Kokoro читает текст через библиотеку misaki. Она понимает запись
    [слово](/фонемы/)
— слово показывается в субтитрах как есть, а произносится по указанным фонемам.
Этот модуль:
  * читает и проверяет config/pronunciations.json;
  * расставляет такую разметку в тексте перед озвучкой;
  * читает римские цифры у правителей («Thutmose III» → «the Third»);
  * делает «аудит»: показывает, какие слова Kokoro прочитал по своему словарю,
    а какие — угадал (их агент обязан проверить и добавить в словарь).
"""
from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Callable

from factory.paths import CONFIG_DIR

DICT_PATH = CONFIG_DIR / "pronunciations.json"

_LETTERS = "A-Za-zÀ-ÖØ-öø-ÿĀ-ž"
_WORD_RE = re.compile(rf"(?<![{_LETTERS}])([{_LETTERS}]+)('s|')?(?![{_LETTERS}])")
_KEY_RE = re.compile(rf"^[{_LETTERS}]+$")

_VOWELS = set("AIOQWYaiuæɑɒɔəɛɜɪʊʌᵻ")
_STRESS = "ˈˌ"
_SIBILANTS = set("szʃʒʧʤ")
_VOICELESS = set("ptkfθ")

# Римские цифры у правителей и в названиях войн.
_ROMAN = {
    "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10,
    "XI": 11, "XII": 12, "XIII": 13, "XIV": 14, "XV": 15, "XVI": 16, "XVII": 17,
    "XVIII": 18, "XIX": 19, "XX": 20, "XXI": 21, "XXII": 22, "XXIII": 23,
}
_ORDINALS = {
    1: "First", 2: "Second", 3: "Third", 4: "Fourth", 5: "Fifth", 6: "Sixth", 7: "Seventh",
    8: "Eighth", 9: "Ninth", 10: "Tenth", 11: "Eleventh", 12: "Twelfth", 13: "Thirteenth",
    14: "Fourteenth", 15: "Fifteenth", 16: "Sixteenth", 17: "Seventeenth",
    18: "Eighteenth", 19: "Nineteenth", 20: "Twentieth", 21: "Twenty-first",
    22: "Twenty-second", 23: "Twenty-third",
}
_CARDINALS = {
    1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight",
    9: "Nine", 10: "Ten", 11: "Eleven", 12: "Twelve",
}
# После этих слов римская цифра читается как обычное число («World War Two»).
_CARDINAL_CONTEXT = {
    "war", "chapter", "part", "book", "volume", "act", "phase", "stage", "mark", "type",
    "class", "panzer", "model", "apollo", "level", "section", "article", "title",
}
# После этих слов цифра — не номер правителя («Malcolm X»).
_NOT_REGNAL = {"malcolm", "vitamin", "generation", "plan", "project", "planet", "the", "a"}
_ROMAN_RE = re.compile(
    rf"(?<![{_LETTERS}])([A-Z][{_LETTERS}]+)(\s+)("
    + "|".join(sorted(_ROMAN, key=len, reverse=True))
    + rf"|I)(?![{_LETTERS}])"
)


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _fold(s: str) -> str:
    return strip_accents(s).casefold()


@dataclass
class Entry:
    word: str
    us: str = ""
    gb: str = ""
    say: str = ""
    note: str = ""

    def phonemes(self, accent: str) -> str:
        return self.us if accent == "us" else self.gb


@dataclass
class Dictionary:
    entries: dict[str, Entry] = field(default_factory=dict)  # ключ — _fold(word)
    path: Path | None = None

    def get(self, word: str) -> Entry | None:
        return self.entries.get(_fold(word))

    def __len__(self) -> int:
        return len(self.entries)


@lru_cache(maxsize=1)
def _alphabets() -> dict[str, set[str]]:
    """Допустимые символы фонем — те же, что в собственных словарях Kokoro (misaki)."""
    import misaki

    data = Path(misaki.__file__).parent / "data"
    out: dict[str, set[str]] = {}
    for accent, name in (("us", "us_gold.json"), ("gb", "gb_gold.json")):
        chars: set[str] = set()
        for v in json.loads((data / name).read_text(encoding="utf-8")).values():
            for x in v.values() if isinstance(v, dict) else [v]:
                if x:
                    chars.update(x)
        out[accent] = chars
    out["us"].add("T")  # T — «мягкая» американская t (как в water); misaki сам пишет её так
    for chars in out.values():
        chars.add(" ")
    return out


def check_phonemes(ps: str, accent: str) -> list[str]:
    """Возвращает список проблем в записи фонем (пустой — всё хорошо)."""
    problems = []
    if not ps:
        return ["пустая запись"]
    bad = sorted({c for c in ps if c not in _alphabets()[accent]})
    if bad:
        problems.append(
            f"недопустимые символы для {'американского' if accent == 'us' else 'британского'} "
            f"произношения: {' '.join(bad)}"
        )
    if ps.count("ˈ") == 0:
        problems.append("нет главного ударения (знак ˈ перед ударной гласной)")
    for i, c in enumerate(ps):
        if c in _STRESS and (i + 1 >= len(ps) or ps[i + 1] not in _VOWELS):
            problems.append("знак ударения должен стоять прямо перед гласной")
            break
    if not any(c in _VOWELS for c in ps):
        problems.append("нет ни одной гласной")
    return problems


def load_dictionary(path: Path | None = None) -> Dictionary:
    path = path or DICT_PATH
    d = Dictionary(path=path)
    if not path.exists():
        return d
    raw = json.loads(path.read_text(encoding="utf-8"))
    for word, v in raw.get("words", {}).items():
        d.entries[_fold(word)] = Entry(
            word=word,
            us=(v.get("us") or "").strip(),
            gb=(v.get("gb") or "").strip(),
            say=v.get("say", ""),
            note=v.get("note", ""),
        )
    return d


def validate_dictionary(d: Dictionary) -> list[str]:
    """Проверка словаря. Возвращает список ошибок на русском (пустой — словарь в порядке)."""
    errors = []
    for e in d.entries.values():
        if not _KEY_RE.match(e.word):
            errors.append(f"«{e.word}»: ключ должен быть одним словом из букв (без пробелов и дефисов)")
        for accent in ("us", "gb"):
            for p in check_phonemes(e.phonemes(accent), accent):
                errors.append(f"«{e.word}» ({accent}): {p}")
    return errors


def save_entry(word: str, us: str, gb: str, say: str = "", note: str = "", path: Path | None = None) -> None:
    """Добавляет или заменяет слово в словаре (используется агентом и веб-страницей)."""
    path = path or DICT_PATH
    for accent, ps in (("us", us), ("gb", gb)):
        problems = check_phonemes(ps, accent)
        if problems:
            raise ValueError(f"«{word}» ({accent}): " + "; ".join(problems))
    if not _KEY_RE.match(word):
        raise ValueError(f"«{word}»: ключ должен быть одним словом из букв")
    raw = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"words": {}}
    words = raw.setdefault("words", {})
    for existing in list(words):
        if _fold(existing) == _fold(word) and existing != word:
            del words[existing]
    entry = {"us": us, "gb": gb}
    if say:
        entry["say"] = say
    if note:
        entry["note"] = note
    words[word] = entry
    raw["words"] = dict(sorted(words.items(), key=lambda kv: _fold(kv[0])))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _last_sound(ps: str) -> str:
    for c in reversed(ps):
        if c not in _STRESS and c != "ː":
            return c
    return ""


def add_s(ps: str, accent: str) -> str:
    """Добавляет окончание -s / -'s по правилам английского произношения."""
    last = _last_sound(ps)
    if last in _SIBILANTS:
        return ps + ("ᵻz" if accent == "us" else "ɪz")
    if last in _VOICELESS:
        return ps + "s"
    return ps + "z"


@dataclass
class Applied:
    text: str  # текст с разметкой — уходит в Kokoro
    used: list[dict]  # какие слова заменены: {"word", "phonemes", "say", "kind"}


G2P = Callable[[str], tuple[str, list]]


def _spoken_phonemes(spoken: str, g2p: G2P) -> str:
    """Фонемы для произносимой замены (например «the Third»)."""
    _, tokens = g2p(spoken)
    return "".join((t.phonemes or "") + (" " if t.whitespace else "") for t in tokens).strip()


def _roman_spoken(prev_word: str, numeral: str, next_char: str) -> str | None:
    prev = prev_word.casefold()
    if numeral == "I":
        # «I» слишком похоже на местоимение. Читаем как номер только в явных случаях.
        if prev == "war":
            return "One"
        if prev in _NOT_REGNAL or next_char.isalpha():
            return None
        return "the First" if next_char in ",.;:!?)" else None
    n = _ROMAN[numeral]
    if prev in _CARDINAL_CONTEXT:
        return _CARDINALS.get(n)
    if prev in _NOT_REGNAL:
        return None
    return "the " + _ORDINALS[n]


def apply(text: str, accent: str, dictionary: Dictionary | None = None, g2p: G2P | None = None) -> Applied:
    """Расставляет разметку произношения. text — уже нормализованный текст без разметки.

    g2p нужен только для римских цифр; без него они остаются как есть.
    """
    d = dictionary if dictionary is not None else load_dictionary()
    used: list[dict] = []
    protected: list[tuple[int, int, str]] = []  # (начало, конец, замена)

    if g2p is not None:
        for m in _ROMAN_RE.finditer(text):
            nxt = text[m.end():].lstrip(" ")[:1]
            direct_next = text[m.end():m.end() + 1]
            spoken = _roman_spoken(m.group(1), m.group(3), nxt if direct_next == " " else direct_next)
            if not spoken:
                continue
            ps = _spoken_phonemes(spoken, g2p)
            if not ps:
                continue
            s, e = m.start(3), m.end(3)
            protected.append((s, e, f"[{m.group(3)}](/{ps}/)"))
            used.append({"word": m.group(3), "phonemes": ps, "say": spoken, "kind": "roman"})

    for m in _WORD_RE.finditer(text):
        s, e = m.span()
        if any(a <= s < b or a < e <= b for a, b, _ in protected):
            continue
        base, suffix = m.group(1), m.group(2) or ""
        entry = d.get(base)
        plural = False
        if entry is None and len(base) > 3 and base.endswith("s"):
            entry = d.get(base[:-1])
            plural = entry is not None
        if entry is None:
            continue
        # Имя собственное из словаря (с большой буквы) не должно задевать обычное слово
        # в тексте с маленькой: «Nice» (город) и «nice» — разные слова.
        if entry.word[:1].isupper() and not base[:1].isupper():
            continue
        ps = entry.phonemes(accent)
        if not ps:
            continue
        if plural:
            ps = add_s(ps, accent)
        if suffix == "'s":
            ps = add_s(ps, accent)
        protected.append((s, e, f"[{m.group(0)}](/{ps}/)"))
        used.append({"word": m.group(0), "phonemes": ps, "say": entry.say, "kind": "dictionary"})

    out, pos = [], 0
    for s, e, rep in sorted(protected):
        out.append(text[pos:s])
        out.append(rep)
        pos = e
    out.append(text[pos:])
    return Applied("".join(out), used)


# ------------------------------------------------------------------ аудит

_SOURCE_RU = {
    "project": "словарь проекта",
    "kokoro": "словарь Kokoro",
    "guess": "догадка (нужно проверить)",
    "none": "не прочитано",
}


def token_rating(tok) -> int | None:
    r = getattr(tok, "rating", None)
    if r is None and getattr(tok, "_", None) is not None:
        r = tok._.rating
    return r


def classify(tok) -> str:
    """Откуда взято произношение слова: project / kokoro / guess / none."""
    if not tok.phonemes:
        return "none"
    r = token_rating(tok)
    if r is None:
        return "kokoro"
    if r >= 5:
        return "project"
    if r >= 3:
        return "kokoro"
    return "guess"


def audit(text: str, accent: str, g2p: G2P, dictionary: Dictionary | None = None) -> list[dict]:
    """Список слов, произношение которых стоит проверить.

    Возвращает слова, которые Kokoro «угадал» (их нет ни в его словаре, ни в словаре
    проекта) или не смог прочитать. Имена собственные из этого списка агент обязан
    проверить и добавить в config/pronunciations.json.
    """
    from factory.tts.text import split_paragraphs

    seen: dict[str, dict] = {}
    for para in split_paragraphs(text):
        marked = apply(para, accent, dictionary, g2p).text
        _, tokens = g2p(marked)
        for t in tokens:
            if not any(ch.isalpha() for ch in t.text):
                continue
            kind = classify(t)
            if kind in ("guess", "none"):
                key = t.text.casefold()
                if key not in seen:
                    seen[key] = {
                        "word": t.text,
                        "phonemes": t.phonemes or "",
                        "source": kind,
                        "source_ru": _SOURCE_RU[kind],
                        "proper_noun": t.tag in ("NNP", "NNPS") or t.text[:1].isupper(),
                        "count": 0,
                    }
                seen[key]["count"] += 1
    return list(seen.values())
