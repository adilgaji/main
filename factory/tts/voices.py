"""Каталог голосов Kokoro, которые фабрика предлагает на выбор.

Первая буква кода голоса — язык произношения:
  a = американский английский, b = британский английский.
Вторая буква — f (женский) или m (мужской).
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Voice:
    id: str
    name: str
    gender: str  # "male" | "female"
    accent: str  # "us" | "gb"
    label_ru: str

    @property
    def lang_code(self) -> str:
        return self.id[0]


VOICES: dict[str, Voice] = {
    v.id: v
    for v in (
        Voice("am_fenrir", "Fenrir", "male", "us", "мужской, американский"),
        Voice("am_michael", "Michael", "male", "us", "мужской, американский"),
        Voice("bm_george", "George", "male", "gb", "мужской, британский"),
        Voice("bm_fable", "Fable", "male", "gb", "мужской, британский"),
        Voice("af_heart", "Heart", "female", "us", "женский, американский"),
        Voice("bf_emma", "Emma", "female", "gb", "женский, британский"),
    )
}

# Используется, пока владелец не выбрал голос в настройках.
FALLBACK_VOICE = "bm_george"


def lang_of(voice_id: str) -> str:
    """'a' (американский) или 'b' (британский) по коду голоса."""
    code = voice_id[:1].lower()
    if code not in ("a", "b"):
        raise ValueError(
            f"Голос «{voice_id}» не английский: код должен начинаться с a (US) или b (GB)."
        )
    return code


def accent_of(voice_id: str) -> str:
    return "us" if lang_of(voice_id) == "a" else "gb"
