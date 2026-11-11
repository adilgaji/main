"""Рендер видео через Remotion.

- копирует озвучку в remotion/public/jobs/<id>/,
- передаёт данные (слова, раскадровку) в композицию через props.json,
- рендерит MP4 1080x1920 (H.264, CRF 18, AAC 192k),
- пробует ускорение видеокартой (--gl=angle), при ошибке — программный режим (--gl=swangle).

Запуск вручную:
    python pipeline/render.py TestScene output/_dev/stage2  (в папке должны быть voice.wav и words.json)
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import REMOTION, Log, run  # noqa: E402

NPX = "npx.cmd" if platform.system() == "Windows" else "npx"


def browser_env() -> dict:
    env = dict(os.environ)
    # в облаке разработки — заранее установленный Chromium; на вашем компьютере Remotion скачает свой
    if "REMOTION_BROWSER" not in env:
        for cand in Path("/opt/pw-browsers").glob("chromium_headless_shell-*/*/chrome-headless-shell"):
            env["REMOTION_BROWSER"] = str(cand)
    return env


def finalize(mp4: Path):
    """Сделать файл совместимым со всеми плеерами (телефоны, iPhone, браузеры, YouTube):
    цвет yuv420p в стандартном диапазоне, H.264 High, быстрый старт (moov в начале)."""
    tmp = mp4.with_suffix(".tmp.mp4")
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4),
         "-vf", "scale=in_range=full:out_range=tv,format=yuv420p",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-level", "4.2",
         "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
         "-c:a", "copy", "-movflags", "+faststart", str(tmp)])
    tmp.replace(mp4)


def render(composition: str, job_dir: Path, props: dict, out_mp4: Path, log: Log | None = None, gl_modes=None) -> Path:
    log = log or Log()
    job_id = job_dir.name
    pub = REMOTION / "public" / "jobs" / job_id
    pub.mkdir(parents=True, exist_ok=True)
    shutil.copy2(job_dir / "voice.wav", pub / "voice.wav")
    props = {"audio": f"jobs/{job_id}/voice.wav", **props}
    props_file = job_dir / "props.json"
    props_file.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")

    # angle — видеокарта (Windows); swiftshader/egl — быстрый программный режим (в 4 раза быстрее swangle)
    gl_modes = gl_modes or (["angle", "swiftshader", "swangle"] if platform.system() == "Windows" else ["swiftshader", "egl", "swangle"])
    last = None
    for gl in gl_modes:
        try:
            log(f"Рендер: {composition}, режим графики {gl}")
            run(
                [NPX, "remotion", "render", "src/index.ts", composition, str(out_mp4.resolve()),
                 f"--props={props_file.resolve()}", f"--gl={gl}", "--codec=h264", "--crf=18",
                 "--audio-codec=aac", "--audio-bitrate=192k", "--pixel-format=yuv420p", "--log=error",
                 *([f"--concurrency={os.environ['RENDER_CONCURRENCY']}"] if os.environ.get("RENDER_CONCURRENCY") else [])],
                cwd=REMOTION, env=browser_env(),
            )
            finalize(out_mp4)
            log(f"Рендер готов: {out_mp4.name}")
            return out_mp4
        except Exception as e:  # noqa: BLE001
            last = e
            log(f"Рендер в режиме {gl} не удался: {str(e)[:300]}")
    raise RuntimeError(f"Рендер не удался: {last}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("composition")
    ap.add_argument("job_dir")
    a = ap.parse_args()
    jd = Path(a.job_dir)
    words = json.loads((jd / "words.json").read_text(encoding="utf-8"))
    render(a.composition, jd, {"words": words}, jd / "video.mp4")
