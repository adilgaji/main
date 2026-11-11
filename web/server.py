"""Веб-страница фабрики Shorts.

Запуск:  python web/server.py   (или start.bat / start.sh) → http://localhost:8765

Каждый шаг ждёт решения человека. Состояние — output/<дата>_<тема>/state.json.
Долгие шаги (агенты, озвучка, рендер) идут в фоне; страница опрашивает состояние.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import platform
import subprocess
import sys
import threading
import traceback
import webbrowser
from pathlib import Path

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))

from common import OUTPUT, Log  # noqa: E402
from job import (  # noqa: E402
    compute_times,
    load_state,
    new_job,
    run_agent,
    step_script,
    step_storyboard,
    update_state,
    write_script_txt,
)
from package import full_production  # noqa: E402
from produce import storyboard_hash  # noqa: E402

app = FastAPI()
app.mount("/static", StaticFiles(directory=str(Path(__file__).resolve().parent / "static")), name="static")

# стили видео (картинки-примеры: web/static/styles/<id>.jpg)
STYLE_LIST = [
    {"id": "classic", "name": "Classic", "ru": "Текущий стиль канала"},
    {"id": "glass", "name": "Glass mosaic", "ru": "Витраж: яркие «стёкла» в тёмной окантовке"},
    {"id": "pixel", "name": "Pixel explainer", "ru": "Пиксельная графика, как в ретро-игре"},
    {"id": "paper", "name": "Paper-cut", "ru": "Слои цветной бумаги с тенями"},
    {"id": "watercolour", "name": "Watercolour", "ru": "Акварель: мягкие края, прозрачные краски"},
    {"id": "terminal", "name": "Retro terminal", "ru": "Зелёный экран старого компьютера"},
    {"id": "isometric", "name": "Isometric", "ru": "Объёмные «макеты» под углом, как инфографика"},
    {"id": "thermal", "name": "Thermal cam", "ru": "Тепловизор: горячее — жёлтое, холодное — фиолетовое"},
    {"id": "clay", "name": "Claymation", "ru": "Пластилин: мягкие объёмные формы"},
]


@app.get("/api/styles")
def styles():
    return STYLE_LIST
_busy: dict[str, threading.Thread] = {}
IDEAS = OUTPUT / "_ideas"


# ------------------------------------------------------------------ фон
def background(key: str, job: Path | None, fn, *args, **kw):
    """Запустить долгий шаг в фоне. Ошибка → status=error с текстом на русском."""
    if key in _busy and _busy[key].is_alive():
        raise HTTPException(409, "Этот шаг уже выполняется")

    def run():
        try:
            fn(*args, **kw)
        except Exception as e:  # noqa: BLE001
            msg = str(e)[:1500]
            if job:
                Log(job / "log.txt")(f"ОШИБКА: {msg}")
                update_state(job, status="error", error=msg)
            else:
                (IDEAS / "error.txt").write_text(msg + "\n" + traceback.format_exc(), encoding="utf-8")

    th = threading.Thread(target=run, daemon=True)
    _busy[key] = th
    th.start()


def job_dir(job_id: str) -> Path:
    p = (OUTPUT / job_id).resolve()
    if p.parent != OUTPUT.resolve() or not (p / "state.json").exists():
        raise HTTPException(404, "Ролик не найден")
    return p


def read_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


# ------------------------------------------------------------------ страница
@app.get("/", response_class=HTMLResponse)
def index():
    return (ROOT / "web" / "index.html").read_text(encoding="utf-8")


# ------------------------------------------------------------------ список роликов
@app.get("/api/jobs")
def jobs():
    out = []
    for d in sorted(OUTPUT.glob("*_*"), reverse=True):
        if d.name.startswith("_") or not (d / "state.json").exists():
            continue
        st = load_state(d)
        out.append({"id": d.name, "topic": st.get("topic"), "step": st.get("step"), "status": st.get("status")})
    return out


# ------------------------------------------------------------------ шаг 1: тема
def used_topics() -> list[str]:
    topics = [load_state(d).get("topic", "") for d in OUTPUT.glob("*_*") if (d / "state.json").exists()]
    hist = read_json(IDEAS / "history.json") or []
    return [t for t in topics + hist if t]


def research_idea():
    IDEAS.mkdir(parents=True, exist_ok=True)
    (IDEAS / "error.txt").unlink(missing_ok=True)
    (IDEAS / "idea.json").unlink(missing_ok=True)
    avoid = used_topics()
    rel = IDEAS.relative_to(ROOT).as_posix()
    prompt = f"Job folder: {rel}\nDo NOT repeat or closely resemble these topics:\n- " + "\n- ".join(avoid or ["(none yet)"])
    run_agent("idea-researcher", prompt, Log(IDEAS / "log.txt"))
    idea = read_json(IDEAS / "idea.json")
    hist = read_json(IDEAS / "history.json") or []
    hist.append(idea["topic"])
    (IDEAS / "history.json").write_text(json.dumps(hist, ensure_ascii=False, indent=1), encoding="utf-8")


@app.post("/api/idea")
def idea_start():
    background("idea", None, research_idea)
    return {"ok": True}


@app.get("/api/idea")
def idea_get():
    running = "idea" in _busy and _busy["idea"].is_alive()
    err = (IDEAS / "error.txt").read_text(encoding="utf-8") if (IDEAS / "error.txt").exists() else None
    return {"running": running, "idea": None if running else read_json(IDEAS / "idea.json"), "error": err}


@app.post("/api/jobs")
def create_job(data: dict = Body(...)):
    topic = (data.get("topic") or "").strip()
    if len(topic) < 5:
        raise HTTPException(400, "Введите тему (хотя бы несколько слов)")
    job = new_job(topic, data.get("style") or "classic")
    if data.get("angle"):
        update_state(job, angle=data["angle"])
    background(job.name, job, step_script, job)
    return {"id": job.name}


# ------------------------------------------------------------------ общий статус ролика
@app.get("/api/jobs/{job_id}")
def job_info(job_id: str):
    job = job_dir(job_id)
    st = load_state(job)
    st["running"] = job_id in _busy and _busy[job_id].is_alive()
    log = (job / "log.txt").read_text(encoding="utf-8").splitlines()[-40:] if (job / "log.txt").exists() else []
    files = {n: (job / n).exists() for n in ["voice.wav", "video.mp4", "thumbnail.png"]}
    data = {"id": job_id, "state": st, "log": log, "files": files}
    data["script"] = read_json(job / "script.json")
    data["storyboard"] = read_json(job / "storyboard.json")
    data["review"] = read_json(job / "review.json")
    for n in ["title.txt", "description.txt", "tags.txt"]:
        p = job / n
        data[n.split(".")[0]] = p.read_text(encoding="utf-8") if p.exists() else None
    return data


@app.get("/api/jobs/{job_id}/file/{name}")
def job_file(job_id: str, name: str):
    if name not in {"voice.wav", "video.mp4", "thumbnail.png"}:
        raise HTTPException(404)
    p = job_dir(job_id) / name
    if not p.exists():
        raise HTTPException(404)
    return FileResponse(p, headers={"Cache-Control": "no-store"})


# ------------------------------------------------------------------ шаг 2: текст
@app.post("/api/jobs/{job_id}/script/rewrite")
def script_rewrite(job_id: str, data: dict = Body(...)):
    job = job_dir(job_id)
    background(job_id, job, step_script, job, (data.get("remarks") or "").strip() or "Rewrite it better.")
    return {"ok": True}


@app.post("/api/jobs/{job_id}/script/manual")
def script_manual(job_id: str, data: dict = Body(...)):
    """Ручная правка: сохраняем текст, затем fact-checker проверяет его по источникам."""
    job = job_dir(job_id)
    text = (data.get("script") or "").strip()
    if len(text.split()) < 40:
        raise HTTPException(400, "Текст слишком короткий")
    sj = read_json(job / "script.json") or {}
    sj["script"] = text
    sj["notes"] = (sj.get("notes") or "") + " | Edited manually by the human editor."
    (job / "script.json").write_text(json.dumps(sj, ensure_ascii=False, indent=2), encoding="utf-8")

    def check():
        log = Log(job / "log.txt")
        update_state(job, step="script", status="working")
        rel = job.relative_to(ROOT).as_posix()
        run_agent("fact-checker", f"Job folder: {rel}\nThe human edited the script by hand. Check {rel}/script.json; keep their wording where it is correct.", log)
        write_script_txt(job)
        update_state(job, step="script", status="review")

    background(job_id, job, check)
    return {"ok": True}


@app.post("/api/jobs/{job_id}/script/confirm")
def script_confirm(job_id: str):
    job = job_dir(job_id)
    update_state(job, script_confirmed=True)
    for n in ["voice.wav", "words.json", "storyboard.json"]:
        (job / n).unlink(missing_ok=True)
    background(job_id, job, step_storyboard, job)
    return {"ok": True}


# ------------------------------------------------------------------ шаг 3: раскадровка
@app.post("/api/jobs/{job_id}/storyboard/redo")
def storyboard_redo(job_id: str, data: dict = Body(...)):
    job = job_dir(job_id)
    remarks = (data.get("remarks") or "").strip()
    shot = data.get("shot")
    if shot:
        remarks = f"Change ONLY shot {shot} (keep all other shots exactly as they are): {remarks}"
    background(job_id, job, step_storyboard, job, remarks or "Make a better, more varied storyboard.")
    return {"ok": True}


@app.post("/api/jobs/{job_id}/storyboard/confirm")
def storyboard_confirm(job_id: str):
    job = job_dir(job_id)
    problems = compute_times(job)
    if problems:
        raise HTTPException(400, "Раскадровка не покрывает текст: " + "; ".join(problems))
    update_state(job, storyboard_hash=storyboard_hash(job), storyboard_confirmed=True)

    background(job_id, job, full_production, job)
    return {"ok": True}


# ------------------------------------------------------------------ шаг 5: открыть папку
@app.post("/api/jobs/{job_id}/open")
def open_folder(job_id: str):
    job = job_dir(job_id)
    if platform.system() == "Windows":
        os.startfile(job)  # noqa: S606
    elif platform.system() == "Darwin":
        subprocess.Popen(["open", str(job)])
    else:
        subprocess.Popen(["xdg-open", str(job)])
    return {"ok": True, "path": str(job)}


@app.post("/api/jobs/{job_id}/retry")
def retry_step(job_id: str):
    """Повторить упавший шаг с того места, где он остановился."""
    job = job_dir(job_id)
    st = load_state(job)
    step = st.get("step")
    if step == "script":
        background(job_id, job, step_script, job)
    elif step == "storyboard":
        background(job_id, job, step_storyboard, job)
    else:
        return storyboard_confirm(job_id)
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8765))
    print(f"\n  Фабрика Shorts: http://localhost:{port}\n  (закройте это окно, чтобы остановить)\n")
    if not os.environ.get("NO_BROWSER"):
        threading.Timer(1.5, lambda: webbrowser.open(f"http://localhost:{port}")).start()
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
