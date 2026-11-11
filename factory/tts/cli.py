"""Команды озвучки и словаря произношений.

  python -m factory.tts.cli check
        проверить словарь config/pronunciations.json

  python -m factory.tts.cli audit ФАЙЛ.txt [--voice bm_george] [--json]
        показать слова, произношение которых Kokoro «угадал» (их нужно проверить)

  python -m factory.tts.cli phonemes "Текст" [--voice bm_george]
        показать, как Kokoro прочитает текст (фонемы каждого слова)

  python -m factory.tts.cli add СЛОВО --us ФОНЕМЫ --gb ФОНЕМЫ [--say подсказка] [--note пояснение]
        добавить или заменить слово в словаре (с проверкой записи)

  python -m factory.tts.cli say "Текст" --voice bm_george --out файл.wav [--speed 1.0]
        озвучить текст; рядом сохраняется файл .words.json со временем каждого слова
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from factory.console import setup_console
from factory.settings import load_settings, voice_of
from factory.tts import pronunciation as pron
from factory.tts.voices import accent_of, lang_of


def _setup_output() -> None:
    setup_console()


def cmd_check(_args) -> int:
    d = pron.load_dictionary()
    errors = pron.validate_dictionary(d)
    if errors:
        print(f"В словаре {len(d)} слов, найдено ошибок: {len(errors)}")
        for e in errors:
            print("  -", e)
        return 1
    print(f"Словарь в порядке: {len(d)} слов.")
    return 0


def cmd_audit(args) -> int:
    from factory.tts.kokoro_engine import get_engine

    text = Path(args.file).read_text(encoding="utf-8")
    voice = args.voice or voice_of(load_settings())
    items = pron.audit(text, accent_of(voice), get_engine().g2p(lang_of(voice)))
    if args.json:
        print(json.dumps(items, ensure_ascii=False, indent=2))
        return 0
    if not items:
        print("Все слова есть в словарях — проверять нечего.")
        return 0
    print(f"Слова, которые Kokoro прочитал наугад ({len(items)}). Имена собственные нужно проверить:")
    for it in items:
        mark = "ИМЯ " if it["proper_noun"] else "    "
        print(f"  {mark}{it['word']:<20} /{it['phonemes']}/  — {it['source_ru']}, встречается {it['count']} раз(а)")
    return 0


def cmd_phonemes(args) -> int:
    from factory.tts.kokoro_engine import get_engine
    from factory.tts.text import normalize

    voice = args.voice or voice_of(load_settings())
    accent, lang = accent_of(voice), lang_of(voice)
    g2p = get_engine().g2p(lang)
    src_ru = {"project": "словарь проекта", "kokoro": "словарь Kokoro", "guess": "ДОГАДКА", "none": "НЕ ПРОЧИТАНО"}
    for para in normalize(args.text).split("\n"):
        marked = pron.apply(para, accent, None, g2p).text
        _, tokens = g2p(marked)
        for t in tokens:
            if any(c.isalnum() for c in t.text):
                print(f"  {t.text:<20} /{t.phonemes or ''}/  — {src_ru[pron.classify(t)]}")
    return 0


def cmd_add(args) -> int:
    try:
        pron.save_entry(args.word, args.us, args.gb, args.say or "", args.note or "")
    except ValueError as e:
        print("Не добавлено:", e)
        return 1
    print(f"Слово «{args.word}» сохранено в словаре.")
    return 0


def cmd_say(args) -> int:
    from factory.tts import TTSError, narrate_to_files

    s = load_settings()
    voice = args.voice or voice_of(s)
    try:
        info = narrate_to_files(
            args.text,
            args.out,
            voice=voice,
            speed=args.speed or s["voice_speed"],
            device=s["tts"]["device"],
            sentence_gap=s["tts"]["sentence_gap"],
            paragraph_gap=s["tts"]["paragraph_gap"],
        )
    except TTSError as e:
        print("Ошибка озвучки:", e)
        return 1
    dev = "видеокарта" if info["device"] == "cuda" else "процессор"
    print(
        f"Готово: {args.out} — {info['duration']:.1f} с, {len(info['words'])} слов, "
        f"{info['words_per_minute']:.0f} слов/мин, голос {voice}, {dev}, синтез {info['synth_seconds']:.1f} с"
    )
    for w in info["warnings"]:
        print("Замечание:", w)
    return 0


def main(argv: list[str] | None = None) -> int:
    _setup_output()
    ap = argparse.ArgumentParser(prog="python -m factory.tts.cli", description="Озвучка и словарь произношений")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("check", help="проверить словарь произношений").set_defaults(fn=cmd_check)

    p = sub.add_parser("audit", help="найти слова, прочитанные наугад")
    p.add_argument("file")
    p.add_argument("--voice")
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_audit)

    p = sub.add_parser("phonemes", help="показать, как Kokoro прочитает текст")
    p.add_argument("text")
    p.add_argument("--voice")
    p.set_defaults(fn=cmd_phonemes)

    p = sub.add_parser("add", help="добавить слово в словарь")
    p.add_argument("word")
    p.add_argument("--us", required=True)
    p.add_argument("--gb", required=True)
    p.add_argument("--say")
    p.add_argument("--note")
    p.set_defaults(fn=cmd_add)

    p = sub.add_parser("say", help="озвучить текст")
    p.add_argument("text")
    p.add_argument("--voice")
    p.add_argument("--out", required=True)
    p.add_argument("--speed", type=float)
    p.set_defaults(fn=cmd_say)

    args = ap.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
