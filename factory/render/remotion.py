"""Рендер глав через Remotion.

  • проект собирается один раз (bundle), затем каждая глава рендерится отдельным файлом;
  • готовая глава не рендерится заново: рядом лежит отметка с «отпечатком» её содержимого,
    и при повторном запуске такие главы пропускаются (продолжение с места сбоя);
  • упавшая глава повторяется до 3 раз; на Windows вторая попытка идёт с другим режимом графики;
  • перед началом и после каждой главы печатается оценка оставшегося времени.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from factory.paths import CACHE_DIR, ROOT
from factory.render.join import probe_video

log = logging.getLogger("factory.render")
VIDEO = ROOT / "video"
SPEED_FILE = CACHE_DIR / "render_speed.json"
DEFAULT_FPS = 7.0  # кадров в секунду, пока скорость этого компьютера не измерена
TRIES = 3


class RenderError(RuntimeError):
    pass


def gl_modes() -> list[str]:
    """Режимы графики по порядку попыток. swangle не используется: он в 4 раза медленнее."""
    return ["swiftshader", "egl"] if sys.platform.startswith("linux") else ["angle", "swiftshader"]


def _npx() -> str:
    exe = shutil.which("npx")
    if not exe:
        raise RenderError("Не найден npx (ставится вместе с Node.js).")
    return exe


def source_fingerprint() -> str:
    """Отпечаток кода видео: меняется, когда меняются компоненты кадров."""
    h = hashlib.sha1()
    for f in sorted((VIDEO / "src").rglob("*")):
        if f.is_file() and "demo" not in f.parts:
            h.update(f.relative_to(VIDEO).as_posix().encode())
            h.update(f.read_bytes())
    return h.hexdigest()[:16]


def bundle(out_dir: Path) -> Path:
    """Собирает проект один раз. Папка public (карты, шрифты, картинки этого видео) копируется внутрь."""
    if out_dir.exists():
        shutil.rmtree(out_dir)
    env = {**os.environ, "NODE_USE_ENV_PROXY": "1"}
    p = subprocess.run([_npx(), "remotion", "bundle", "src/index.ts", f"--out-dir={out_dir}", "--log=error"], cwd=VIDEO, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    if p.returncode != 0 or not (out_dir / "index.html").exists():
        raise RenderError(f"Не удалось собрать проект видео:\n{p.stdout[-1200:]}")
    return out_dir


def measured_speed() -> float:
    try:
        return float(json.loads(SPEED_FILE.read_text())["fps"])
    except Exception:  # noqa: BLE001
        return DEFAULT_FPS


def _save_speed(fps: float) -> None:
    SPEED_FILE.parent.mkdir(parents=True, exist_ok=True)
    SPEED_FILE.write_text(json.dumps({"fps": round(fps, 2), "measured": time.strftime("%Y-%m-%d %H:%M")}))


def minutes(seconds: float) -> str:
    return f"{seconds / 60:.0f} мин" if seconds >= 90 else f"{seconds:.0f} с"


def chapter_key(props_path: Path, fingerprint: str, crf: int) -> str:
    return hashlib.sha1(props_path.read_bytes() + fingerprint.encode() + str(crf).encode()).hexdigest()


def is_done(out: Path, key: str, frames: int) -> bool:
    mark = out.with_suffix(".done.json")
    if not (out.exists() and mark.exists()):
        return False
    try:
        info = json.loads(mark.read_text())
        return info.get("key") == key and info.get("frames") == frames and probe_video(out)["frames"] == frames
    except Exception:  # noqa: BLE001
        return False


def _render_one(serve: Path, props_path: Path, out: Path, frames: int, key: str, concurrency: int | None, crf: int, gl: str | None, composition: str = "Chapter") -> float:
    modes = [gl] if gl else gl_modes()
    last = ""
    for attempt in range(1, TRIES + 1):
        mode = modes[min(attempt - 1, len(modes) - 1)]
        tmp = out.with_name(out.stem + ".part.mp4")
        cmd = [
            _npx(), "remotion", "render", str(serve), composition, str(tmp), f"--props={props_path}", f"--gl={mode}",
            "--codec=h264", f"--crf={crf}", "--pixel-format=yuv420p", "--muted", "--log=error",
        ]
        if concurrency:
            cmd.append(f"--concurrency={concurrency}")
        t0 = time.time()
        p = subprocess.run(cmd, cwd=VIDEO, env={**os.environ, "NODE_USE_ENV_PROXY": "1"}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
        took = time.time() - t0
        if p.returncode == 0 and tmp.exists():
            got = probe_video(tmp)["frames"]
            if got == frames:
                tmp.replace(out)
                out.with_suffix(".done.json").write_text(json.dumps({"key": key, "frames": frames, "seconds": round(took, 1), "gl": mode}))
                return took
            last = f"кадров {got}, а должно быть {frames}"
        else:
            last = (p.stdout or "").strip()[-700:] or f"код завершения {p.returncode}"
        tmp.unlink(missing_ok=True)
        log.warning("Глава %s: попытка %d из %d не удалась (%s). %s", out.stem, attempt, TRIES, mode, "Повторяю…" if attempt < TRIES else "")
    raise RenderError(f"Глава {out.stem} не отрендерилась за {TRIES} попытки. Последняя ошибка:\n{last}")


def render_chapters(
    serve: Path,
    jobs: list[dict],
    parallel: int = 1,
    crf: int = 22,
    gl: str | None = None,
    fps: int = 30,
) -> dict:
    """jobs: [{id, props: путь, out: путь, frames}]. Готовые главы пропускаются.

    Возвращает {rendered: [...], skipped: [...], seconds, speed}. При сбое главы остальные
    готовые главы остаются на диске — повторный запуск продолжит с упавшей.
    """
    fingerprint = source_fingerprint()
    todo, skipped = [], []
    for j in jobs:
        j["key"] = chapter_key(Path(j["props"]), fingerprint, crf)
        (skipped if is_done(Path(j["out"]), j["key"], j["frames"]) else todo).append(j)
    total = sum(j["frames"] for j in todo)
    speed = measured_speed()
    if skipped:
        log.info("Уже готовы и не рендерятся заново: %s", ", ".join(j["id"] for j in skipped))
    if not todo:
        return {"rendered": [], "skipped": [j["id"] for j in skipped], "seconds": 0.0, "speed": speed}
    cores = os.cpu_count() or 4
    parallel = max(1, min(parallel, len(todo)))
    concurrency = max(1, cores // parallel) if parallel > 1 else None
    log.info("Рендер: глав %d, кадров %d (%s видео). Оценка времени: около %s.", len(todo), total, minutes(total / fps), minutes(total / speed))

    t0, done_frames, failed = time.time(), 0, []
    with ThreadPoolExecutor(max_workers=parallel) as pool:
        futures = {pool.submit(_render_one, serve, Path(j["props"]), Path(j["out"]), j["frames"], j["key"], concurrency, crf, gl, j.get("composition", "Chapter")): j for j in todo}
        for fut in as_completed(futures):
            j = futures[fut]
            try:
                took = fut.result()
            except RenderError as e:
                failed.append(str(e))
                continue
            done_frames += j["frames"]
            speed = done_frames / max(1e-6, time.time() - t0)
            left = total - done_frames
            log.info("  глава %s готова: %d кадров за %s (%.1f кадров/с). Осталось около %s.", j["id"], j["frames"], minutes(took), j["frames"] / took, minutes(left / speed) if left else "0 с")
    if done_frames:
        _save_speed(done_frames / (time.time() - t0))
    if failed:
        raise RenderError("\n".join(failed) + "\nГотовые главы сохранены — запустите ещё раз, рендер продолжится с упавшей главы.")
    return {"rendered": [j["id"] for j in todo], "skipped": [j["id"] for j in skipped], "seconds": time.time() - t0, "speed": speed}


def still(serve: Path, composition: str, props_path: Path, out: Path, gl: str | None = None) -> Path:
    """Один кадр (обложка, лист) в PNG. До 3 попыток, как и у глав."""
    last = ""
    for attempt, mode in enumerate(([gl] if gl else gl_modes()) * TRIES, 1):
        if attempt > TRIES:
            break
        p = subprocess.run(
            [_npx(), "remotion", "still", str(serve), composition, str(out), f"--props={props_path}", "--frame=0", f"--gl={mode}", "--log=error"],
            cwd=VIDEO, env={**os.environ, "NODE_USE_ENV_PROXY": "1"}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
        )
        if p.returncode == 0 and out.exists():
            return out
        last = (p.stdout or "").strip()[-500:]
    raise RenderError(f"Не удалось нарисовать {out.name}: {last}")
