"""Шаг «Производство»: из подтверждённых текста и раскадровки — готовое видео.

    python -m factory.production output/<дата>_<тема> [--no-render] [--parallel 2]

В папке видео должны лежать script.json и storyboard.json (их пишут агенты в блоке C),
а в state.json — выбранный стиль. Шаги:
  1. проверка текста и раскадровки по правилам;
  2. изображения из архивов: проверка лицензии, кэш, sources.txt;
  3. озвучка всех глав одним голосом (Kokoro → Piper → edge-tts) и время каждого слова;
  4. раскладка кадров по словам озвучки, переходы, субтитры .srt, главы-таймкоды;
  5. рендер по главам (готовые главы не рендерятся заново), склейка, звук;
  6. проверки готового файла → checks.json.
Упавший шаг повторяется до 3 раз; повторный запуск продолжает с места сбоя.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import shutil
import sys
import time
from pathlib import Path

import numpy as np

from factory import audio, captions, chapters, checks, images, storyboard
from factory.console import setup_console
from factory.paths import LOGS_DIR, ROOT
from factory.render import assemble, bundle, render_chapters
from factory.settings import effective, load_settings, voice_of
from factory.styles import require_style_chosen
from factory.tts import narrate_many

log = logging.getLogger("factory.production")
FPS = storyboard.FPS
PUBLIC_JOB = ROOT / "video" / "public" / "job"
STEP_TRIES = 3


class ProductionError(RuntimeError):
    pass


def _read(path: Path) -> dict:
    if not path.exists():
        raise ProductionError(f"Нет файла {path.name} в папке видео {path.parent}")
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def _retry(name: str, fn, *args, **kwargs):
    for attempt in range(1, STEP_TRIES + 1):
        try:
            return fn(*args, **kwargs)
        except (ProductionError, ValueError):
            raise  # ошибки в данных повтором не лечатся
        except Exception as e:  # noqa: BLE001
            if attempt == STEP_TRIES:
                raise ProductionError(f"Шаг «{name}» не удался за {STEP_TRIES} попытки: {e}") from e
            log.warning("Шаг «%s»: попытка %d не удалась (%s). Повторяю…", name, attempt, str(e).splitlines()[0][:160])
            time.sleep(2 * attempt)
    return None


def _state(folder: Path, step: str, status: str, **extra) -> None:
    path = folder / "state.json"
    state = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    prod = state.setdefault("production", {})
    prod.setdefault("steps", {})[step] = {"status": status, "at": time.strftime("%Y-%m-%d %H:%M:%S"), **extra}
    prod["status"] = status if step == "итог" else prod.get("status", "идёт")
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- 2. изображения

def fetch_images(folder: Path, board: dict, job_dir: Path) -> dict[str, dict]:
    refs = storyboard.all_image_refs(board)
    img_dir = folder / "work" / "images"
    if img_dir.exists():  # в папке остаются только картинки из текущей раскадровки
        shutil.rmtree(img_dir)
    prepared: list[images.Prepared] = []
    out: dict[str, dict] = {}
    problems: list[str] = []
    for ref in refs:
        try:
            rec = _retry(f"изображение {ref}", images.get, ref)
            p = images.prepare(rec, img_dir)
        except (images.LicenseRejected, images.ImageError, images.ArchiveUnavailable, ProductionError) as e:
            problems.append(f"{ref}: {e}")
            continue
        prepared.append(p)
        out[ref] = {"file": p.file, "width": p.width, "height": p.height, "credit": rec.credit}
        log.info("  %s → %s (%dx%d, %s)", ref, p.file, p.width, p.height, rec.license)
    if problems:
        raise ProductionError("Не удалось получить изображения (без лицензии файл не берём):\n  " + "\n  ".join(problems))
    job_img = job_dir / "img"
    if job_img.exists():
        shutil.rmtree(job_img)
    job_img.mkdir(parents=True)
    for p in prepared:
        shutil.copy2(img_dir / p.file, job_img / p.file)
    script = _read(folder / "script.json")
    notes = [
        "Карты: Natural Earth (naturalearthdata.com), public domain. Исторические границы и маршруты нарисованы по тексту источников и подписаны как approximate.",
        *[f"Текст: {s}" for s in script.get("sources", [])],
    ]
    images.write_sources(prepared, folder / "sources.txt", notes)
    return out


# ---------------------------------------------------------------- 3. озвучка

def _text_key(texts: list[str], voice: str, speed: float, settings: dict) -> str:
    raw = json.dumps([texts, voice, speed, settings["tts"], (ROOT / "config" / "pronunciations.json").read_text(encoding="utf-8")], ensure_ascii=False)
    return hashlib.sha1(raw.encode()).hexdigest()


def narrate_chapters(folder: Path, script: dict, settings: dict) -> dict:
    """Озвучка глав. Длина каждой главы округляется вверх до целого кадра (тишиной в конце),
    поэтому звук всего видео = сумма длин глав = число кадров / 30."""
    work = folder / "work"
    voice, speed = voice_of(settings), float(settings.get("voice_speed", 1.0))
    texts = [c["text"] for c in script["chapters"]]
    key = _text_key(texts, voice, speed, settings)
    cached = work / "narration.json"
    if cached.exists() and (work / "narration.wav").exists():
        info = json.loads(cached.read_text(encoding="utf-8"))
        if info.get("key") == key:
            log.info("Озвучка уже готова (текст не менялся) — беру сохранённую.")
            return info
    log.info("Озвучиваю %d глав голосом %s…", len(texts), voice)
    ns = narrate_many(texts, voice, speed=speed, device=settings["tts"]["device"], sentence_gap=settings["tts"]["sentence_gap"], paragraph_gap=settings["tts"]["paragraph_gap"])
    sr = ns[0].sample_rate
    pieces, chs, clipped, offset = [], [], [], 0
    for c, n in zip(script["chapters"], ns):
        frames = math.ceil(n.duration * FPS - 1e-6)
        samples = round(frames * sr / FPS)
        a = np.zeros(samples, dtype=np.float32)
        a[: len(n.audio)] = n.audio[:samples]
        tail = a[-int(0.03 * sr):]
        if np.sqrt(np.mean(tail.astype(np.float64) ** 2)) > 0.01 * max(1e-6, float(np.abs(a).max())):
            clipped.append(f"глава {c['id']}: звук обрывается в конце главы")
        last = max(w.end for w in n.words)
        if last > frames / FPS - 0.05:
            clipped.append(f"глава {c['id']}: последнее слово не успевает прозвучать до конца главы")
        words = [{"text": w.text, "start": round(w.start, 3), "end": round(w.end, 3), **({"estimated": True} if w.estimated else {})} for w in n.words]
        chs.append({"id": c["id"], "title": c["title"], "frames": frames, "start_frame": offset, "words": words, "wpm": round(n.words_per_minute)})
        offset += frames
        pieces.append(a)
    import soundfile as sf

    raw = work / "narration.raw.wav"
    work.mkdir(parents=True, exist_ok=True)
    sf.write(str(raw), np.concatenate(pieces), sr, subtype="PCM_16")
    loud = audio.normalize_loudness(raw, work / "narration.wav")
    raw.unlink()
    total_words = sum(1 for ch in chs for w in ch["words"] if any(x.isalnum() for x in w["text"]))
    info = {
        "key": key, "engine": ns[0].engine, "voice": voice, "chapters": chs, "total_frames": offset,
        "words": total_words, "loudness": loud, "clipped": clipped,
        "warnings": sorted({w for n in ns for w in n.warnings}),
        "pronunciations": sorted({p["word"] for n in ns for p in n.pronunciations}),
    }
    _write(cached, info)
    return info


# ---------------------------------------------------------------- 4. раскладка, субтитры, главы

def build_plan(folder: Path, board: dict, narration: dict, prepared: dict[str, dict], style: str, slug: str) -> dict:
    by_id = {c["id"]: c for c in board["chapters"]}
    props_dir = folder / "work" / "props"
    plan_chapters, errors, notes = [], [], []
    for ch in narration["chapters"]:
        shots = []
        for item in by_id[ch["id"]]["shots"]:
            shots.append({**item, "shot": storyboard.apply_images(item["shot"], prepared, f"job/{slug}/img")})
        timed = storyboard.plan_chapter(ch["words"], shots, ch["frames"])
        e, n = storyboard.duration_problems(timed, ch["id"])
        errors += e
        notes += n
        props = {
            "styleId": style, "audio": None, "captions": True, "totalFrames": ch["frames"],
            "words": [{"text": w["text"], "start": w["start"], "end": w["end"]} for w in ch["words"]],
            "shots": [{k: t[k] for k in ("start", "frames", "shot", "enter", "exit")} for t in timed],
        }
        _write(props_dir / f"{ch['id']}.json", props)
        plan_chapters.append({
            "id": ch["id"], "frames": ch["frames"], "start_frame": ch["start_frame"], "words": ch["words"],
            "shots": [{"type": t["shot"]["type"], "nominal": t["nominal"], "transition": (t["enter"] or {}).get("kind")} for t in timed],
        })
    files = {ref: p["file"] for ref, p in prepared.items()}
    return {
        "fps": FPS, "total_frames": narration["total_frames"], "chapters": plan_chapters, "images": files,
        "clipped": narration["clipped"], "duration_errors": errors, "duration_notes": notes,
    }


def write_texts(folder: Path, script: dict, plan: dict) -> None:
    items = captions.cues([(ch["start_frame"] / FPS, ch["words"]) for ch in plan["chapters"]])
    captions.write_srt(items, folder / "captions.srt")
    first = [ch["start_frame"] / FPS + ch["words"][0]["start"] for ch in plan["chapters"]]
    chapters.write(chapters.build([c["title"] for c in script["chapters"]], first), folder)
    (folder / "script.txt").write_text(
        f"{script['title']}\n\n" + "\n\n".join(f"## {c['title']}\n{c['text'].strip()}" for c in script["chapters"]) + "\n", encoding="utf-8"
    )


# ---------------------------------------------------------------- главный порядок

def _logfile(folder: Path) -> None:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    h = logging.FileHandler(LOGS_DIR / f"production_{folder.name}.log", encoding="utf-8")
    h.setFormatter(logging.Formatter("%(asctime)s %(message)s", "%H:%M:%S"))
    logging.getLogger().addHandler(h)


def produce(folder: Path, render: bool = True, parallel: int = 2, gl: str | None = None, crf: int = 22) -> dict:
    folder = folder.resolve()
    _logfile(folder)
    t0 = time.time()
    style = require_style_chosen(folder)
    state = json.loads((folder / "state.json").read_text(encoding="utf-8"))
    settings = effective(load_settings(), state.get("overrides"))
    script, board = _read(folder / "script.json"), _read(folder / "storyboard.json")
    slug = folder.name
    job_dir = PUBLIC_JOB / slug

    log.info("1/6 Проверка текста и раскадровки (стиль: %s)", style)
    errors = storyboard.validate(script, board)
    if errors:
        _state(folder, "проверка раскадровки", "ошибка", problems=errors)
        raise ProductionError("Раскадровка не прошла проверку:\n  " + "\n  ".join(errors))
    _state(folder, "проверка раскадровки", "готово")

    log.info("2/6 Изображения из архивов (%d шт.)", len(storyboard.all_image_refs(board)))
    prepared = fetch_images(folder, board, job_dir)
    _state(folder, "изображения", "готово", count=len(prepared))

    log.info("3/6 Озвучка")
    narration = _retry("озвучка", narrate_chapters, folder, script, settings)
    log.info("  движок %s, слов %d, длина %.1f с, громкость %.1f LUFS", narration["engine"], narration["words"], narration["total_frames"] / FPS, narration["loudness"]["lufs"])
    for w in narration["warnings"]:
        log.warning("  %s", w)
    _state(folder, "озвучка", "готово", engine=narration["engine"], seconds=round(narration["total_frames"] / FPS, 2))

    log.info("4/6 Раскладка кадров по словам, субтитры, главы")
    plan = build_plan(folder, board, narration, prepared, style, slug)
    _write(folder / "work" / "plan.json", plan)
    write_texts(folder, script, plan)
    if plan["duration_errors"]:
        _state(folder, "раскладка", "ошибка", problems=plan["duration_errors"])
        raise ProductionError("Длина кадров вне допустимого:\n  " + "\n  ".join(plan["duration_errors"]))
    _state(folder, "раскладка", "готово", shots=sum(len(c["shots"]) for c in plan["chapters"]))
    if not render:
        return {"plan": plan, "narration": narration}

    log.info("5/6 Рендер по главам и склейка")
    serve = _retry("сборка проекта видео", bundle, folder / "work" / "bundle")
    jobs = [{"id": ch["id"], "props": str(folder / "work" / "props" / f"{ch['id']}.json"), "out": str(folder / "work" / "render" / f"{ch['id']}.mp4"), "frames": ch["frames"]} for ch in plan["chapters"]]
    (folder / "work" / "render").mkdir(parents=True, exist_ok=True)
    result = render_chapters(serve, jobs, parallel=parallel, crf=crf, gl=gl)
    final = _retry("склейка", assemble, [Path(j["out"]) for j in jobs], folder / "work" / "narration.wav", folder / "video.mp4", plan["total_frames"])
    shutil.rmtree(folder / "work" / "bundle", ignore_errors=True)
    _state(folder, "рендер", "готово", seconds=round(result["seconds"]), speed=round(result["speed"], 1))

    log.info("6/6 Проверки готового видео")
    report = checks.run_all(folder, plan)
    _write(folder / "checks.json", report)
    checks.print_report(report, log.info)
    took = time.time() - t0
    _state(folder, "итог", "готово" if report["ok"] else "проверки не пройдены", minutes=round(took / 60, 1))
    log.info("Готово: %s (%.1f с видео, %.1f МБ) за %.0f мин", folder / "video.mp4", final["duration"], (folder / "video.mp4").stat().st_size / 1024**2, took / 60)
    return {"plan": plan, "narration": narration, "report": report, "render": result}


def main(argv: list[str] | None = None) -> int:
    setup_console()
    ap = argparse.ArgumentParser(description="Производство видео: изображения, озвучка, рендер по главам, склейка, проверки")
    ap.add_argument("folder", help="папка видео: output/<дата>_<тема>")
    ap.add_argument("--no-render", action="store_true", help="всё, кроме рендера (быстрая проверка раскадровки и озвучки)")
    ap.add_argument("--parallel", type=int, default=2, help="сколько глав рендерить одновременно")
    ap.add_argument("--gl", help="режим графики для рендера (по умолчанию — подбирается сам)")
    args = ap.parse_args(argv)
    try:
        out = produce(Path(args.folder), render=not args.no_render, parallel=args.parallel, gl=args.gl)
    except ProductionError as e:
        log.error("ОСТАНОВЛЕНО: %s", e)
        return 1
    except ValueError as e:
        log.error("ОСТАНОВЛЕНО: %s", e)
        return 1
    return 0 if out.get("report", {"ok": True})["ok"] else 2


if __name__ == "__main__":
    sys.exit(main())
