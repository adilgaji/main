"""Проверки готового видео — скриптами, а не «на глаз».

run_all(папка видео, план) → отчёт: список проверок с отметкой «в порядке / не пройдено» и
пояснением по-русски. Отчёт сохраняется в checks.json.
"""
from __future__ import annotations

import json
from pathlib import Path

from factory import audio, captions, chapters, storyboard
from factory.checks import media
from factory.images import check_sources, parse_sources
from factory.render.join import faststart, probe_video

EMPTY_DETAIL = 0.9  # ниже этого кадр считается пустым (см. media.detail)
SYNC_TOLERANCE = 0.25  # секунды: звук в файле против времени первого слова главы


def _item(name: str, problems: list[str], info: str = "") -> dict:
    return {"name": name, "ok": not problems, "info": info, "problems": problems}


def run_all(folder: Path, plan: dict) -> dict:
    """plan — work/plan.json: главы (кадры, слова, длина), общее число кадров, fps."""
    video = folder / "video.mp4"
    fps = plan["fps"]
    total = plan["total_frames"]
    report: list[dict] = []
    if not video.exists():
        return {"ok": False, "checks": [_item("Файл видео", ["нет файла video.mp4"])]}

    v = probe_video(video)
    bad = []
    if v["codec"] != "h264":
        bad.append(f"кодек {v['codec']}, а нужен h264")
    if v["pix_fmt"] != "yuv420p":
        bad.append(f"формат пикселей {v['pix_fmt']}, а нужен yuv420p")
    if (v["width"], v["height"]) != (1920, 1080):
        bad.append(f"размер {v['width']}x{v['height']}, а нужен 1920x1080")
    if abs(v["fps"] - fps) > 0.01:
        bad.append(f"частота {v['fps']:.2f} кадров/с, а нужна {fps}")
    if not faststart(video):
        bad.append("нет быстрого старта (+faststart)")
    report.append(_item("Файл видео: H.264, yuv420p, 1920x1080, 30 кадров/с, быстрый старт", bad, f"{v['codec']} {v['pix_fmt']} {v['width']}x{v['height']}"))

    bad = []
    if v["frames"] != total:
        bad.append(f"кадров {v['frames']}, а по раскадровке {total}")
    if abs(v["duration"] - v["audio_duration"]) > 0.05:
        bad.append(f"картинка {v['duration']:.3f} с, звук {v['audio_duration']:.3f} с")
    for ch in plan["chapters"]:
        f = folder / "work" / "render" / f"{ch['id']}.mp4"
        if f.exists() and probe_video(f)["frames"] != ch["frames"]:
            bad.append(f"глава {ch['id']}: в файле не {ch['frames']} кадров")
    report.append(_item("Видео = звук = сумма кадров", bad, f"{v['frames']} кадров, {v['duration']:.2f} с"))

    loud = audio.measure_loudness(video)
    bad = [] if audio.loudness_ok(loud) else [f"громкость {loud['lufs']:.1f} LUFS, пик {loud['true_peak']:.1f} dB — нужно −16…−13 LUFS и пик не выше −1 dB"]
    report.append(_item("Громкость ровная, пики в норме", bad, f"{loud['lufs']:.1f} LUFS, пик {loud['true_peak']:.1f} dB"))

    samples = media.audio_samples(video)
    bad, starts, shifts = [], [], []
    for ch in plan["chapters"]:
        begin = ch["start_frame"] / fps
        first_word = begin + ch["words"][0]["start"]
        heard = media.first_sound(samples, begin)
        starts.append(heard if heard is not None else first_word)
        if heard is None:
            bad.append(f"глава {ch['id']}: в начале нет звука")
        else:
            shifts.append(heard - first_word)
            if abs(heard - first_word) > SYNC_TOLERANCE:
                bad.append(f"глава {ch['id']}: голос начинается в {heard:.2f} с, а первое слово размечено на {first_word:.2f} с")
    info = f"расхождение до {max((abs(s) for s in shifts), default=0):.2f} с" if shifts else ""
    report.append(_item("Звук, картинка и субтитры синхронны (начало каждой главы)", bad, info))

    report.append(_item("В озвучке нет обрезанных слов", list(plan.get("clipped") or []), f"глав {len(plan['chapters'])}"))

    words = [w["text"] for ch in plan["chapters"] for w in ch["words"]]
    bad = captions.problems(folder / "captions.srt", words, total / fps)
    report.append(_item("Субтитры: текст совпадает с озвучкой на 100 %", bad, f"{len(words)} слов"))

    bad = chapters.problems(folder, starts, total / fps)
    report.append(_item("Главы с таймкодами (± 1 с от видео)", bad, f"глав {len(plan['chapters'])}"))

    bad = check_sources(folder / "work" / "images", folder / "sources.txt")
    known = parse_sources(folder / "sources.txt") if (folder / "sources.txt").exists() else {}
    for ref, file in (plan.get("images") or {}).items():
        if file not in known:
            bad.append(f"{ref}: изображение есть в раскадровке, но не записано в sources.txt")
    report.append(_item("У каждого изображения есть лицензия в sources.txt", bad, f"изображений {len(plan.get('images') or {})}"))

    script = json.loads((folder / "script.json").read_text(encoding="utf-8"))
    board = json.loads((folder / "storyboard.json").read_text(encoding="utf-8"))
    bad = storyboard.validate(script, board)
    planned = sum(len(ch["shots"]) for ch in plan["chapters"])
    listed = sum(len(c.get("shots") or []) for c in board.get("chapters") or [])
    if planned != listed:
        bad.append(f"в видео {planned} кадров, а в раскадровке {listed}")
    bad += list(plan.get("duration_errors") or [])
    report.append(_item("Видео соответствует раскадровке; соседние кадры и фоны не повторяются", bad, f"кадров {planned}"))

    numbers, labels = [], []
    for ch in plan["chapters"]:
        for i, s in enumerate(ch["shots"]):
            a, b = s["nominal"]
            for k in (0.5, 0.85):
                numbers.append(ch["start_frame"] + int(a + (b - a) * k))
                labels.append(f"глава {ch['id']}, кадр {i + 1} ({s['type']})")
    frames = media.sample_frames(video, numbers)
    order = sorted(range(len(numbers)), key=lambda i: numbers[i])
    bad, lowest = [], 1e9
    if len(frames) != len(set(numbers)):
        bad.append("не удалось прочитать все проверочные кадры")
    else:
        uniq = sorted(set(numbers))
        for i in order:
            d = media.detail(frames[uniq.index(numbers[i])])
            lowest = min(lowest, d)
            if d < EMPTY_DETAIL:
                bad.append(f"{labels[i]}: кадр выглядит пустым (наполненность {d:.2f})")
    for a, b in media.black_spans(video):
        if b - a > 0.8:
            bad.append(f"чёрный экран с {a:.1f} по {b:.1f} с")
    report.append(_item("Нет пустых и чёрных кадров", sorted(set(bad)), f"наименьшая наполненность {lowest:.2f}" if lowest < 1e9 else ""))

    return {"ok": all(c["ok"] for c in report), "checks": report, "notes": list(plan.get("duration_notes") or [])}


def print_report(report: dict, say=print) -> None:
    for c in report["checks"]:
        say(f"  {'✓' if c['ok'] else '✗'} {c['name']}" + (f" — {c['info']}" if c["info"] else ""))
        for p in c["problems"]:
            say(f"      {p}")
    say("Все проверки пройдены." if report["ok"] else "ЕСТЬ НЕПРОЙДЕННЫЕ ПРОВЕРКИ — видео нужно исправить.")
