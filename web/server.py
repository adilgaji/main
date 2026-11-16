"""Веб-страница фабрики Shorts.

Запуск:  python web/server.py   (или start.bat / start.sh) → http://localhost:8765

Телефон: страница доступна в домашней Wi-Fi по секретной ссылке (адрес ноутбука + ключ доступа).
Ссылку и QR-код показывает страница http://localhost:8765/phone на ноутбуке и окно start.bat.
Без ключа с других устройств ничего не открыть. Только для ноутбука: переменная LOCAL_ONLY=1.

Каждый шаг ждёт решения человека. Состояние — output/<дата>_<тема>/state.json.
Долгие шаги (агенты, озвучка, рендер) идут в фоне; страница опрашивает состояние.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import platform
import secrets
import socket
import subprocess
import sys
import threading
import traceback
import webbrowser
from pathlib import Path

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))

from common import OUTPUT, Log  # noqa: E402
from job import (  # noqa: E402
    DEFAULT_STYLE,
    STYLE_INFO,
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
STYLE_LIST = [{"id": i, "name": n, "ru": r} for i, n, r in STYLE_INFO]


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


# ------------------------------------------------------------------ доступ с телефона
PORT = int(os.environ.get("PORT", 8765))
KEY_FILE = OUTPUT / "_phone_key.txt"
LOCAL = {"127.0.0.1", "::1", "localhost"}


def phone_key() -> str:
    """Секретный ключ доступа с других устройств (создаётся один раз, хранится на ноутбуке)."""
    if not KEY_FILE.exists():
        KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
        KEY_FILE.write_text(secrets.token_urlsafe(9), encoding="utf-8")
    return KEY_FILE.read_text(encoding="utf-8").strip()


def lan_ip() -> str:
    """Адрес ноутбука в домашней сети (например 192.168.1.23)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # ничего не отправляется — только выбирается сетевая карта
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def phone_url() -> str:
    return f"http://{lan_ip()}:{PORT}/?key={phone_key()}"


DENIED = """<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<body style="font-family:system-ui;background:#0E1A2B;color:#F5F1E8;padding:24px"><h2>🔒 Нужна ссылка с ключом</h2>
<p>Откройте на ноутбуке страницу фабрики → «📱 Телефон» и отсканируйте QR-код камерой телефона.</p></body>"""


@app.middleware("http")
async def guard(request: Request, call_next):
    host = request.client.host if request.client else ""
    if host in LOCAL:
        return await call_next(request)
    key = phone_key()
    q = request.query_params.get("key")
    if q and secrets.compare_digest(q, key):
        # ключ запоминается в телефоне (cookie на год), адрес — без ключа
        resp = RedirectResponse(str(request.url.remove_query_params("key")), status_code=303)
        resp.set_cookie("atm_key", key, max_age=365 * 24 * 3600, httponly=True, samesite="lax")
        return resp
    if secrets.compare_digest(request.cookies.get("atm_key", ""), key):
        return await call_next(request)
    return HTMLResponse(DENIED, status_code=401)


@app.get("/phone", response_class=HTMLResponse)
def phone(request: Request):
    """Страница для ноутбука: QR-код и ссылка, чтобы открыть фабрику на телефоне."""
    if (request.client.host if request.client else "") not in LOCAL:
        raise HTTPException(403, "Эта страница открывается только на ноутбуке")
    import segno

    url = phone_url()
    svg = segno.make(url, error="m").svg_inline(scale=8, dark="#0E1A2B", light="#FFFFFF")
    local_only = os.environ.get("LOCAL_ONLY")
    return f"""<!doctype html><meta charset=utf-8><title>Фабрика на телефоне</title>
<body style="font-family:system-ui;background:#0E1A2B;color:#F5F1E8;max-width:640px;margin:30px auto;padding:0 16px;line-height:1.5">
<h2>📱 Открыть фабрику на телефоне</h2>
{"<p style='color:#FF6B6B'>Сейчас включён режим «только ноутбук» (LOCAL_ONLY). Уберите его, чтобы открыть с телефона.</p>" if local_only else ""}
<ol><li>Телефон должен быть подключён к <b>той же Wi-Fi</b>, что и ноутбук.</li>
<li>Наведите камеру телефона на QR-код и нажмите на появившуюся ссылку.</li>
<li>Добавьте страницу на главный экран (в браузере: «Поделиться» → «На экран Домой»).</li></ol>
<div style="background:#fff;display:inline-block;padding:16px;border-radius:16px">{svg}</div>
<p>Или наберите вручную: <br><code style="font-size:18px;color:#FFC845">{url}</code></p>
<p style="color:#8FA3BF">Ноутбук должен быть включён, а окно фабрики (start.bat) — открыто. Не пересылайте ссылку другим: в ней ключ доступа.</p>
<p><a href="/" style="color:#FFC845">← назад к фабрике</a></p></body>"""


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
        out.append({"id": d.name, "topic": st.get("topic"), "step": st.get("step"), "status": st.get("status"), "format": st.get("format", "short")})
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
    job = new_job(topic, data.get("style") or DEFAULT_STYLE, data.get("format") or "short")
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
    files = {n: (job / n).exists() for n in ["voice.wav", "video.mp4", "thumbnail.png", "captions.srt"]}
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
    if name not in {"voice.wav", "video.mp4", "thumbnail.png", "captions.srt"}:
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

    port = PORT
    local_only = bool(os.environ.get("LOCAL_ONLY"))
    print(f"\n  Фабрика Shorts: http://localhost:{port}\n  (закройте это окно, чтобы остановить)\n")
    if not local_only:
        print(f"  📱 С телефона (та же Wi-Fi): {phone_url()}")
        try:
            import segno

            print("  или отсканируйте QR-код камерой телефона:\n")
            segno.make(phone_url(), error="m").terminal(compact=True)
        except Exception:  # noqa: BLE001
            print("  QR-код — на странице http://localhost:%d/phone" % port)
        print()
    if not os.environ.get("NO_BROWSER"):
        threading.Timer(1.5, lambda: webbrowser.open(f"http://localhost:{port}")).start()
    uvicorn.run(app, host="127.0.0.1" if local_only else "0.0.0.0", port=port, log_level="warning")
