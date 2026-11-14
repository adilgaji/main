"""Шаг 4: автоматическое производство ролика по ПОДТВЕРЖДЁННОЙ раскадровке.

озвучка (если нет) → субтитры (если нет) → рендер → проверки качества.
Каждый шаг повторяется до 3 раз, лог на русском — в log.txt папки ролика.

    python pipeline/produce.py output/2026-11-10_how-muscles-recover-after-training
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import Log, ffprobe_duration, retry, run  # noqa: E402
from job import compute_times, load_state, make_voice, update_state  # noqa: E402
from render import render, render_intro  # noqa: E402


def storyboard_hash(job: Path) -> str:
    sb = json.loads((job / "storyboard.json").read_text(encoding="utf-8"))
    core = [{k: s[k] for k in ("first_word", "last_word", "template", "params", "transition")} for s in sb["shots"]]
    return hashlib.sha256(json.dumps(core, sort_keys=True).encode()).hexdigest()[:16]


def loudness(path: Path) -> dict:
    out = run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"])
    summ = out[out.rfind("Summary:"):]
    get = lambda key: float(re.search(rf"{key}:\s+(-?[\d.]+)", summ).group(1))  # noqa: E731
    return {"I": get("I"), "LRA": get("LRA"), "peak": get("Peak")}


def checks(job: Path, log: Log) -> list[str]:
    """Проверки «готово». Возвращает список проблем (пустой — всё хорошо)."""
    problems = []
    video = job / "video.mp4"
    sb = json.loads((job / "storyboard.json").read_text(encoding="utf-8"))
    words = json.loads((job / "words.json").read_text(encoding="utf-8"))
    vdur = ffprobe_duration(video)
    adur = ffprobe_duration(job / "voice.wav")
    # 1. длительность видео = длине озвучки = сумме кадров
    if abs(vdur - adur) > 0.1:
        problems.append(f"Длительность видео {vdur:.2f} с ≠ озвучки {adur:.2f} с")
    if abs(sb["sum_of_shots"] - adur) > 0.05:
        problems.append(f"Сумма кадров {sb['sum_of_shots']} с ≠ озвучки {adur:.2f} с")
    from job import limits

    lo, hi = limits(job)
    if not lo <= adur <= hi:
        problems.append(f"Длина ролика {adur:.1f} с — вне {lo}–{hi} с")
    # 2. формат
    info = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "csv=p=0", str(video)])
    from job import fmt_of

    need = "1920,1080" if fmt_of(job) == "long" else "1080,1920"
    if not info.strip().startswith(need):
        problems.append(f"Формат видео {info.strip()} — нужен {need.replace(',', 'x')}")
    pix = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=pix_fmt", "-of", "csv=p=0", str(video)]).strip()
    if pix != "yuv420p":
        problems.append(f"Формат цвета {pix} — плееры телефонов его не открывают (нужен yuv420p)")
    # 3. громкость и пики
    ld = loudness(video)
    log(f"Громкость: {ld['I']} LUFS, разброс {ld['LRA']} LU, пик {ld['peak']} dBFS")
    if not -17.5 <= ld["I"] <= -12.5:
        problems.append(f"Громкость {ld['I']} LUFS вне нормы (−17…−13)")
    if ld["peak"] > -0.5:
        problems.append(f"Пики {ld['peak']} dBFS — риск искажений")
    # 4. субтитры: каждое слово внутри звука, без «обрезанных» слов
    if words[0]["startMs"] < 40:
        problems.append("Первое слово начинается слишком близко к началу (может быть обрезано)")
    # конец записи: после последнего звука должна быть тишина ≥ 0.06 с (иначе слово обрезано)
    tail = run(["ffmpeg", "-hide_banner", "-i", str(job / "voice.wav"), "-af", f"atrim=start={max(0.0, adur - 1.0):.2f},silencedetect=n=-40dB:d=0.04", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", tail)]
    if not starts or adur - starts[-1] < 0.06:
        problems.append("В конце записи нет тишины — последнее слово может быть обрезано")
    # 5. видео соответствует подтверждённой раскадровке
    st = load_state(job)
    if st.get("storyboard_hash") and st["storyboard_hash"] != storyboard_hash(job):
        problems.append("Раскадровка изменилась после подтверждения")
    return problems


def norm_w(w: str) -> str:
    return re.sub(r"[^a-z0-9']", "", w.lower())


def compute_chapters(job: Path) -> list[dict]:
    """Время начала каждой главы — по первому слову главы в реальной озвучке."""
    sj = json.loads((job / "script.json").read_text(encoding="utf-8"))
    words = json.loads((job / "words.json").read_text(encoding="utf-8"))
    toks = [norm_w(w["text"]) for w in words]
    out, pos = [], 0
    for i, ch in enumerate(sj.get("chapters") or []):
        start_words = [norm_w(x) for x in ch.get("starts_with", "").replace("*", "").split()][:5]
        idx = 0 if i == 0 else None
        if idx is None and start_words:
            for j in range(pos, len(toks) - len(start_words) + 1):
                if toks[j : j + len(start_words)] == start_words:
                    idx = j
                    break
        if idx is None:
            continue
        pos = idx + 1
        out.append({"title": ch["title"], "start": 0.0 if i == 0 else round(words[idx]["startMs"] / 1000 - 0.1, 2), "word": idx})
    (job / "chapters.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return out


def write_srt(job: Path, shift_at: float | None = None, shift: float = 0.0):
    """Субтитры .srt для загрузки в YouTube (фразы по 6–8 слов).
    shift_at/shift — после вставки интро всё, что позже shift_at секунд, сдвигается на shift."""
    words = json.loads((job / "words.json").read_text(encoding="utf-8"))
    add = int(round(shift * 1000))
    fix = lambda ms: ms + add if shift_at is not None and ms >= shift_at * 1000 else ms  # noqa: E731
    ts = lambda ms: (lambda m: f"{m // 3600000:02d}:{m // 60000 % 60:02d}:{m // 1000 % 60:02d},{m % 1000:03d}")(fix(ms))  # noqa: E731
    lines, cue, n = [], [], 1
    for i, w in enumerate(words):
        cue.append(w)
        end = re.search(r"[.!?,;:]$", w["text"].strip()) or len(cue) >= 8 or i == len(words) - 1
        if end and (len(cue) >= 3 or i == len(words) - 1):
            text = "".join(x["text"] for x in cue).strip().replace("*", "")
            lines += [str(n), f"{ts(cue[0]['startMs'])} --> {ts(cue[-1]['endMs'])}", text, ""]
            n += 1
            cue = []
    (job / "captions.srt").write_text("\n".join(lines), encoding="utf-8")


def intro_point(job: Path) -> float:
    """Куда вставить интро: сразу после хука — конец первого кадра, который закончился
    на конце предложения в промежутке 9–25 с (можно задать вручную: storyboard.json → "intro_after_shot")."""
    sb = json.loads((job / "storyboard.json").read_text(encoding="utf-8"))
    shots = sb["shots"]
    if sb.get("intro_after_shot"):
        return next(s["end"] for s in shots if s["id"] == sb["intro_after_shot"])
    for s in shots:
        if 9 <= s["end"] <= 25 and re.search(r"[.!?]\W*$", s.get("text", "").strip()):
            return s["end"]
    return next((s["end"] for s in shots if s["end"] >= 6), shots[0]["end"])


def insert_intro(job: Path, log: Log, reuse_main: bool = False) -> list[str]:
    """Вставить интро канала после хука. Исходник без интро сохраняется как video_main.mp4.
    reuse_main=True — взять уже готовый video_main.mp4 (повторная вставка без рендера)."""
    intro = render_intro(log)
    video, main = job / "video.mp4", job / "video_main.mp4"
    if not reuse_main:
        video.replace(main)
    at = intro_point(job)
    d = ffprobe_duration(intro)
    log(f"Вставляю интро канала ({d:.1f} с) после хука, на {at:.2f} с")
    au = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo"
    vf = "fps=30,scale=1920:1080,setsar=1,format=yuv420p"
    # три отдельных входа (начало, интро, остальное) — ffmpeg читает их по очереди и не держит видео в памяти
    graph = (f"[0:v]setpts=PTS-STARTPTS,{vf}[v0];[0:a]asetpts=PTS-STARTPTS,{au}[a0];"
             f"[1:v]setpts=PTS-STARTPTS,{vf}[v1];[1:a]asetpts=PTS-STARTPTS,{au}[a1];"
             f"[2:v]setpts=PTS-STARTPTS,{vf}[v2];[2:a]asetpts=PTS-STARTPTS,{au}[a2];"
             "[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]")
    run(["ffmpeg", "-y", "-loglevel", "error", "-t", f"{at:.3f}", "-i", str(main), "-i", str(intro),
         "-ss", f"{at:.3f}", "-i", str(main), "-filter_complex", graph,
         "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high",
         "-level", "4.2", "-pix_fmt", "yuv420p", "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709",
         "-color_trc", "bt709", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-threads", "4", str(video)])
    # главы и субтитры — по времени готового видео
    ch_file = job / "chapters.json"
    if ch_file.exists():
        chs = json.loads(ch_file.read_text(encoding="utf-8"))
        for c in chs:
            if c["start"] >= at:
                c["start"] = round(c["start"] + d, 2)
        ch_file.write_text(json.dumps(chs, ensure_ascii=False, indent=1), encoding="utf-8")
    write_srt(job, shift_at=at, shift=d)
    update_state(job, intro={"variant": "pulse", "at": round(at, 2), "duration": round(d, 2)})
    problems = []
    total, need = ffprobe_duration(video), ffprobe_duration(main) + d
    if abs(total - need) > 0.2:
        problems.append(f"После вставки интро длина {total:.2f} с ≠ {need:.2f} с")
    ld = loudness(video)
    if not -17.5 <= ld["I"] <= -12.5 or ld["peak"] > -0.5:
        problems.append(f"Громкость после вставки интро вне нормы: {ld['I']} LUFS, пик {ld['peak']}")
    return problems


def produce(job: Path, log: Log | None = None) -> Path:
    job = job.resolve()
    log = log or Log(job / "log.txt")
    st = update_state(job, step="production", status="working")
    if not st.get("storyboard_hash"):
        update_state(job, storyboard_hash=storyboard_hash(job))
    log("Шаг 4: начинаю производство ролика")
    if not (job / "voice.wav").exists() or not (job / "words.json").exists():
        make_voice(job, log)
    problems = compute_times(job)
    if problems:
        raise RuntimeError("Раскадровка не покрывает озвучку: " + "; ".join(problems))
    sb = json.loads((job / "storyboard.json").read_text(encoding="utf-8"))
    words = json.loads((job / "words.json").read_text(encoding="utf-8"))
    from job import fmt_of

    fmt = fmt_of(job)
    from job import location_for

    st = load_state(job)
    props = {"words": words, "shots": sb["shots"], "total": sb["total"], "music": None, "style": st.get("style", "classic"),
             "location": sb.get("location") or st.get("location") or location_for(st.get("topic", ""))}
    write_srt(job)
    if fmt == "long":
        props["chapters"] = compute_chapters(job)
        log(f"Главы: {len(props['chapters'])} — " + ", ".join(f"{int(c['start']) // 60}:{int(c['start']) % 60:02d} {c['title']}" for c in props["chapters"]))
    composition = "Long" if fmt == "long" else "Short"
    retry("рендер", render, log, composition=composition, job_dir=job, props=props, out_mp4=job / "video.mp4", log=log)
    problems = checks(job, log)
    if fmt == "long" and not problems:
        problems = insert_intro(job, log)
    if problems:
        for p in problems:
            log("ПРОВЕРКА НЕ ПРОЙДЕНА: " + p)
        update_state(job, step="production", status="checks_failed", problems=problems)
    else:
        log("Все проверки пройдены")
        update_state(job, step="production", status="rendered", problems=[])
    return job / "video.mp4"


if __name__ == "__main__":
    produce(Path(sys.argv[1]))
