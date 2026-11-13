"""Shorts: 3–5 вертикальных роликов 30–55 с, собранных заново из материала видео.

Short = новая фраза-хук (озвучивается тем же голосом) + непрерывный отрывок озвучки одной главы.
Картинка — те же кадры раскадровки на вертикальном холсте 1080x1920 (композиция Short):
карта, архивное изображение, цитата и рассказчик перестраиваются, остальное идёт в рамке.
"""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path

import numpy as np
import soundfile as sf

from factory import audio, storyboard
from factory.checks.media import audio_samples
from factory.render import assemble, probe_video, render_chapters

log = logging.getLogger("factory.shorts")
FPS = 30
RATE = 48000
MIN_S, MAX_S = 30.0, 55.0
LEAD, GAP, TAIL = 0.15, 0.4, 0.5
HOOK_WPS = 2.7  # слов в секунду для оценки длины хука до озвучки


def locate(words: list[dict], start: str, end: str) -> tuple[int, int] | None:
    """Номера первого и последнего слова отрывка (по фразам начала и конца)."""
    texts = [w["text"] for w in words]
    a = storyboard.find_anchor(texts, start, 0)
    if a is None:
        return None
    b0 = storyboard.find_anchor(texts, end, a)
    if b0 is None:
        return None
    need = len([k for k in (storyboard.word_key(x) for x in end.split()) if k])
    b, seen = b0, 0
    while b < len(texts):
        if storyboard.word_key(texts[b]):
            seen += 1
            if seen == need:
                break
        b += 1
    return (a, min(b, len(texts) - 1))


def estimate(short: dict, chapters: dict[str, dict]) -> tuple[float | None, str]:
    """Примерная длина Short до озвучки хука: (секунды или None, ошибка)."""
    ch = chapters.get(short.get("chapter"))
    if not ch:
        return None, f"chapter {short.get('chapter')} does not exist"
    span = locate(ch["words"], short["start"], short["end"])
    if span is None:
        return None, f"«{short['start']}» … «{short['end']}» not found in chapter {ch['id']} (copy the words exactly)"
    a, b = span
    excerpt = ch["words"][b]["end"] - ch["words"][a]["start"]
    hook = len(short["hook"].split()) / HOOK_WPS
    return LEAD + hook + GAP + excerpt + TAIL + 0.3, ""


def check_answer(out: dict, chapters: dict[str, dict]) -> list[str]:
    err, spans = [], []
    for i, s in enumerate(out.get("shorts", []), 1):
        sec, problem = estimate(s, chapters)
        if problem:
            err.append(f"short {i}: {problem}")
            continue
        if not MIN_S + 1 <= sec <= MAX_S - 1:
            err.append(f"short {i}: about {sec:.0f} s with the hook — it must be {MIN_S:.0f}–{MAX_S:.0f} s")
        a, b = locate(chapters[s["chapter"]]["words"], s["start"], s["end"])
        for c, x, y in spans:
            if c == s["chapter"] and not (b < x or a > y):
                err.append(f"short {i} overlaps another short")
        spans.append((s["chapter"], a, b))
        if len(s["hook"].split()) > 16:
            err.append(f"short {i}: the hook must be at most 14 words")
    return err


def _clip_shots(props: dict, f0: int, f1: int, shift: int, total: int) -> list[dict]:
    """Кадры главы, попавшие в отрывок [f0, f1), — со сдвигом во времени Short."""
    out = []
    for s in props["shots"]:
        a, b = max(s["start"], f0), min(s["start"] + s["frames"], f1)
        if b - a < 6:
            continue
        shot = json.loads(json.dumps(s["shot"]))
        cut = (a - s["start"]) / FPS
        if cut > 0 and shot["type"] == "narrator":
            shot["speech"] = [{"start": round(x["start"] - cut, 3), "end": round(x["end"] - cut, 3)} for x in shot.get("speech", []) if x["end"] - cut > 0]
            shot["beats"] = [{**x, "at": max(0.0, x["at"] - cut)} for x in shot.get("beats", [])]
        out.append({"start": a - f0 + shift, "frames": b - a, "shot": shot, "enter": s.get("enter"), "exit": s.get("exit")})
    if not out:
        return out
    # первый кадр показывается и во время хука; последний — до конца Short
    out[0]["frames"] += out[0]["start"]
    out[0]["start"] = 0
    out[-1]["frames"] = total - out[-1]["start"]
    out[0]["enter"] = {"kind": "dip", "frames": 8}
    out[-1]["exit"] = {"kind": "dip", "frames": 10}
    for s in out:
        for k in ("enter", "exit"):
            if s.get(k):
                s[k] = {**s[k], "frames": min(s[k]["frames"], s["frames"] // 3)}
    return out


def build(folder: Path, plan_shorts: list[dict], style: str, engine: str, voice: str) -> list[dict]:
    """Озвучка хуков, звук и props каждого Short. Возвращает задания для рендера."""
    from factory.tts import narrate

    plan = json.loads((folder / "work" / "plan.json").read_text(encoding="utf-8"))
    chapters = {c["id"]: c for c in plan["chapters"]}
    full = audio_samples(folder / "work" / "narration.wav", RATE)
    work = folder / "work" / "shorts"
    work.mkdir(parents=True, exist_ok=True)
    jobs = []
    for k, s in enumerate(plan_shorts, 1):
        ch = chapters[s["chapter"]]
        a, b = locate(ch["words"], s["start"], s["end"])
        offset = ch["start_frame"] / FPS
        t0 = offset + ch["words"][a]["start"] - 0.12
        t1 = offset + ch["words"][b]["end"] + 0.3
        hook = narrate(s["hook"], voice, engine=engine.split(":")[0])
        hook_wav = work / f"hook_{k}.wav"
        sf.write(str(hook_wav), hook.audio, hook.sample_rate, subtype="PCM_16")
        hook_audio = audio_samples(hook_wav, RATE)
        excerpt = full[int(t0 * RATE): int(t1 * RATE)]
        parts = [np.zeros(int(LEAD * RATE), np.float32), hook_audio, np.zeros(int(GAP * RATE), np.float32), excerpt, np.zeros(int(TAIL * RATE), np.float32)]
        raw = np.concatenate(parts)
        frames = math.ceil(len(raw) / RATE * FPS - 1e-6)
        raw = np.concatenate([raw, np.zeros(round(frames * RATE / FPS) - len(raw), np.float32)])
        sf.write(str(work / f"short_{k}.raw.wav"), raw, RATE, subtype="PCM_16")
        audio.normalize_loudness(work / f"short_{k}.raw.wav", work / f"short_{k}.wav")
        (work / f"short_{k}.raw.wav").unlink()

        hook_shift = LEAD + len(hook_audio) / RATE + GAP
        words = [{"text": w.text, "start": round(LEAD + w.start * 1.0, 3), "end": round(LEAD + w.end, 3)} for w in hook.words]
        words += [{"text": w["text"], "start": round(w["start"] + offset - t0 + hook_shift, 3), "end": round(w["end"] + offset - t0 + hook_shift, 3)} for w in ch["words"][a:b + 1]]
        props_ch = json.loads((folder / "work" / "props" / f"{ch['id']}.json").read_text(encoding="utf-8"))
        f0 = round((t0 - offset) * FPS)
        f1 = round((t1 - offset) * FPS)
        shots = _clip_shots(props_ch, f0, f1, round(hook_shift * FPS), frames)
        props = {"styleId": style, "title": s["title"], "audio": None, "words": words, "shots": shots, "totalFrames": frames}
        (work / f"short_{k}.json").write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
        jobs.append({"id": f"short_{k}", "props": str(work / f"short_{k}.json"), "out": str(work / f"short_{k}.mp4"), "frames": frames, "composition": "Short",
                     "seconds": frames / FPS, "audio": str(work / f"short_{k}.wav"), "meta": s})
    return jobs


def render(folder: Path, serve: Path, jobs: list[dict], parallel: int = 2) -> list[dict]:
    """Рендер, склейка со звуком и проверка: 1080x1920, кадры = звук, 30–55 с."""
    render_chapters(serve, jobs, parallel=parallel)
    out_dir = folder / "shorts"
    out_dir.mkdir(exist_ok=True)
    report = []
    for k, j in enumerate(jobs, 1):
        final = out_dir / f"short_{k}.mp4"
        info = assemble([Path(j["out"])], Path(j["audio"]), final, j["frames"])
        problems = []
        if (info["width"], info["height"]) != (1080, 1920):
            problems.append(f"размер {info['width']}x{info['height']}")
        if info["frames"] != j["frames"] or abs(info["duration"] - info["audio_duration"]) > 0.05:
            problems.append("кадры и звук не совпадают")
        if not MIN_S <= info["duration"] <= MAX_S:
            problems.append(f"длина {info['duration']:.1f} с вне 30–55 с")
        m = j["meta"]
        (out_dir / f"short_{k}.txt").write_text(f"{m['title']}\n\n{m['description']}\n\n#shorts #history\n", encoding="utf-8")
        report.append({"file": final.name, "title": m["title"], "seconds": round(info["duration"], 1), "ok": not problems, "problems": problems})
        log.info("  Short %d: %.1f с — %s", k, info["duration"], "в порядке" if not problems else "; ".join(problems))
    return report
