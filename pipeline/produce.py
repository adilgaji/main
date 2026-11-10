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
from render import render  # noqa: E402


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
    from job import MAX_SEC, MIN_SEC

    if not MIN_SEC <= adur <= MAX_SEC:
        problems.append(f"Длина ролика {adur:.1f} с — вне {MIN_SEC}–{MAX_SEC} с")
    # 2. формат
    info = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "csv=p=0", str(video)])
    if not info.strip().startswith("1080,1920"):
        problems.append(f"Формат видео {info.strip()} — нужен 1080x1920")
    # 3. громкость и пики
    ld = loudness(video)
    log(f"Громкость: {ld['I']} LUFS, разброс {ld['LRA']} LU, пик {ld['peak']} dBFS")
    if not -17.5 <= ld["I"] <= -12.5:
        problems.append(f"Громкость {ld['I']} LUFS вне нормы (−17…−13)")
    if ld["peak"] > -0.5:
        problems.append(f"Пики {ld['peak']} dBFS — риск искажений")
    # 4. субтитры: каждое слово внутри звука, без «обрезанных» слов
    if words[0]["startMs"] < 100:
        problems.append("Первое слово начинается слишком близко к началу (может быть обрезано)")
    if words[-1]["endMs"] / 1000 > adur - 0.15:
        problems.append("Последнее слово слишком близко к концу (может быть обрезано)")
    # 5. видео соответствует подтверждённой раскадровке
    st = load_state(job)
    if st.get("storyboard_hash") and st["storyboard_hash"] != storyboard_hash(job):
        problems.append("Раскадровка изменилась после подтверждения")
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
    props = {"words": words, "shots": sb["shots"], "total": sb["total"], "music": None}
    retry("рендер", render, log, composition="Short", job_dir=job, props=props, out_mp4=job / "video.mp4", log=log)
    problems = checks(job, log)
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
