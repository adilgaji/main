"""Веб-страница фабрики: FastAPI + один HTML-файл (index.html рядом).

Страница работает только на этом компьютере (адрес 127.0.0.1). Долгие шаги идут фоновой задачей
(jobs.py), быстрые решения владельца (стиль, номер темы, «принять») — сразу через pipeline.py.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

from factory import pipeline, schemas
from factory.paths import ASSETS_DIR, ROOT
from factory.settings import load_settings, save_settings, update_settings
from factory.styles import choose_for_video, resolve_style
from factory.tts.voices import VOICES
from factory.web import views
from factory.web.jobs import Busy, Runner, python_cmd

HERE = Path(__file__).resolve().parent
LOCAL_HOSTS = {"127.0.0.1", "localhost", "[::1]"}
RUN_STEPS = {"topic", "outline", "script", "storyboard", "production", "package"}


class NewVideo(BaseModel):
    subgenre: str = "any"
    hint: str = Field("", max_length=200)
    minutes: float = Field(8.5, ge=1, le=15)
    chapters_min: int = Field(5, ge=2, le=9)
    chapters_max: int = Field(7, ge=2, le=9)


class StyleChoice(BaseModel):
    style: str


class RunStep(BaseModel):
    step: str
    note: str = Field("", max_length=2000)


class Pick(BaseModel):
    number: int


class Approve(BaseModel):
    step: str


class Fix(BaseModel):
    note: str = Field("", max_length=2000)
    recheck: bool = True


class SettingsIn(BaseModel):
    voice: str | None = None
    voice_speed: float | None = Field(None, ge=0.7, le=1.3)
    style: str | None = None
    smithsonian_api_key: str | None = Field(None, max_length=100)


def host_of(header: str) -> str:
    """Имя компьютера из заголовка Host без порта: «127.0.0.1:8765» → «127.0.0.1», «[::1]:80» → «[::1]»."""
    if header.startswith("["):
        return header.split("]")[0] + "]"
    return header.rsplit(":", 1)[0]


def create_app(runner: Runner | None = None) -> FastAPI:
    app = FastAPI(title="Фабрика исторических видео", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.runner = runner or Runner()

    @app.middleware("http")
    async def local_only(request: Request, call_next):
        # Защита: страница отвечает только себе. Чужой сайт в браузере не сможет
        # ни подменить адрес (DNS rebinding), ни отправить команду (нужен свой заголовок).
        if host_of(request.headers.get("host", "")) not in LOCAL_HOSTS:
            return JSONResponse({"error": "Страница доступна только с этого компьютера."}, status_code=403)
        if request.method == "POST" and request.headers.get("x-factory") != "1":
            return JSONResponse({"error": "Команда отклонена."}, status_code=403)
        return await call_next(request)

    def err(status: int, text: str) -> HTTPException:
        return HTTPException(status_code=status, detail=text)

    def folder_of(video_id: str) -> Path:
        try:
            return views.video_dir(video_id)
        except views.NotFound as e:
            raise err(404, str(e)) from e

    def runner() -> Runner:
        return app.state.runner

    def job_json() -> dict | None:
        job = runner().poll()
        return job.to_json() if job else None

    def not_busy_with(video_id: str) -> None:
        job = runner().poll()
        if job and job.running and job.video == video_id:
            raise err(409, f"Для этого видео идёт задача «{job.title}». Дождитесь окончания.")

    # ------------------------------------------------------------ страница и файлы

    @app.get("/", response_class=HTMLResponse)
    def index() -> HTMLResponse:
        return HTMLResponse((HERE / "index.html").read_text(encoding="utf-8"), headers={"Cache-Control": "no-store"})

    @app.get("/api/ping")
    def ping() -> dict:
        return {"app": "history-factory"}

    @app.get("/files/{video_id}/{rel:path}")
    def video_file(video_id: str, rel: str) -> FileResponse:
        folder = folder_of(video_id)
        try:
            return FileResponse(views.safe_file(folder, rel))
        except views.NotFound as e:
            raise err(404, str(e)) from e

    @app.get("/sheets/{kind}.png")
    def sheet(kind: str) -> FileResponse:
        p = views.SHEETS_DIR / f"styles-{kind}.png"
        if kind not in views.SHEET_KINDS or not p.exists():
            raise err(404, "Лист ещё не нарисован")
        return FileResponse(p)

    @app.get("/voices/{name}")
    def voice_sample(name: str) -> FileResponse:
        p = (ASSETS_DIR / "voices" / name).resolve()
        if p.parent != (ASSETS_DIR / "voices").resolve() or p.suffix != ".mp3" or not p.exists():
            raise err(404, "Нет образца")
        return FileResponse(p)

    @app.get("/image")
    def archive_image(ref: str) -> FileResponse:
        p = views.image_file(ref)
        if not p:
            raise err(404, "Картинка ещё не скачана")
        return FileResponse(p)

    # ------------------------------------------------------------ чтение

    @app.get("/api/home")
    def home() -> dict:
        s = load_settings()
        return {"videos": views.list_videos(), "job": job_json(), "subgenres": schemas.SUBGENRES,
                "voice": s.get("voice"), "style": views.style_name(s.get("style"))}

    @app.get("/api/videos/{video_id}")
    def video(video_id: str) -> dict:
        folder = folder_of(video_id)
        return {**views.video_view(folder), "job": job_json(), "styles": views.styles_view(views.chosen_for_video(folder))}

    @app.get("/api/settings")
    def settings() -> dict:
        return {**views.settings_view(), "job": job_json()}

    @app.get("/api/job")
    def job() -> dict:
        return {"job": job_json()}

    # ------------------------------------------------------------ решения владельца

    @app.post("/api/videos")
    def new_video(body: NewVideo) -> dict:
        if body.subgenre != "any" and body.subgenre not in schemas.SUBGENRES:
            raise err(400, "Неизвестное поднаправление")
        lo, hi = sorted((body.chapters_min, body.chapters_max))
        folder = pipeline.new_video(body.subgenre, body.hint.strip(), body.minutes, (lo, hi))
        return {"id": folder.name}

    @app.post("/api/videos/{video_id}/style")
    def choose_style(video_id: str, body: StyleChoice) -> dict:
        folder = folder_of(video_id)
        not_busy_with(video_id)
        st = pipeline.read_state(folder)
        if pipeline.step_status(st, "production") in (pipeline.DONE, pipeline.FAILED) or (folder / "video.mp4").exists():
            raise err(409, "Видео уже собрано в выбранном стиле. Для другого стиля начните новое видео.")
        try:
            style = choose_for_video(folder, body.style)
        except ValueError as e:
            raise err(400, str(e)) from e
        return {"style": style, "name": views.style_name(style)}

    @app.post("/api/videos/{video_id}/run")
    def run(video_id: str, body: RunStep) -> dict:
        folder = folder_of(video_id)
        if body.step not in RUN_STEPS:
            raise err(400, "Неизвестный шаг")
        if body.step != "topic":
            try:
                pipeline.require(folder, body.step)
            except pipeline.PipelineError as e:
                raise err(409, str(e)) from e
        elif not views.chosen_for_video(folder):
            raise err(409, "Сначала выберите стиль видео.")
        cmd = python_cmd("-m", "factory.pipeline", "run", str(folder), body.step)
        if body.note.strip():
            cmd += ["--note", body.note.strip()]
        title = pipeline.STEP_RU[body.step] + (" — переделка" if body.note.strip() else "")
        try:
            job = runner().start("step", title, cmd, video=video_id, step=body.step)
        except Busy as e:
            raise err(409, str(e)) from e
        return {"job": job.to_json()}

    @app.post("/api/videos/{video_id}/fix")
    def fix(video_id: str, body: Fix) -> dict:
        folder = folder_of(video_id)
        if not (folder / "script.json").exists():
            raise err(409, "Текста ещё нет.")
        cmd = python_cmd("-m", "factory.pipeline", "fix", str(folder))
        if body.note.strip():
            cmd += ["--note", body.note.strip()]
        if not body.recheck:
            cmd.append("--no-recheck")
        try:
            job = runner().start("fix", "Исправление замечаний в тексте", cmd, video=video_id, step="script")
        except Busy as e:
            raise err(409, str(e)) from e
        return {"job": job.to_json()}

    @app.post("/api/videos/{video_id}/pick")
    def pick(video_id: str, body: Pick) -> dict:
        folder = folder_of(video_id)
        not_busy_with(video_id)
        try:
            new = pipeline.pick_topic(folder, body.number)
        except (pipeline.PipelineError, KeyError, OSError) as e:
            raise err(409, str(e)) from e
        return {"id": new.name}

    @app.post("/api/videos/{video_id}/approve")
    def approve(video_id: str, body: Approve) -> dict:
        folder = folder_of(video_id)
        not_busy_with(video_id)
        if body.step not in pipeline.STEPS:
            raise err(400, "Неизвестный шаг")
        try:
            pipeline.approve(folder, body.step)
        except pipeline.PipelineError as e:
            raise err(409, str(e)) from e
        return {"ok": True, "next": pipeline.next_step(folder)}

    @app.post("/api/videos/{video_id}/open")
    def open_folder(video_id: str) -> dict:
        folder = folder_of(video_id)
        if os.name == "nt":
            os.startfile(str(folder))  # type: ignore[attr-defined]  # Проводник Windows
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(folder)])
        else:
            subprocess.Popen(["xdg-open", str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"ok": True}

    @app.post("/api/job/stop")
    def stop() -> dict:
        job = runner().stop()
        return {"job": job.to_json() if job else None}

    @app.post("/api/settings")
    def save(body: SettingsIn) -> dict:
        changes: dict = {}
        if body.voice is not None:
            if body.voice not in VOICES:
                raise err(400, "Неизвестный голос")
            changes["voice"] = body.voice
        if body.voice_speed is not None:
            changes["voice_speed"] = round(body.voice_speed, 2)
        if body.style is not None:
            try:
                changes["style"] = resolve_style(body.style)
            except ValueError as e:
                raise err(400, str(e)) from e
        if changes:
            update_settings(changes)
        if body.smithsonian_api_key is not None:
            s = load_settings()
            s.setdefault("images", {})["smithsonian_api_key"] = body.smithsonian_api_key.strip()
            save_settings(s)
        return {"ok": True}

    @app.post("/api/sheets")
    def draw_sheets() -> dict:
        try:
            job = runner().start("sheets", "Листы-образцы стилей", python_cmd(str(ROOT / "scripts" / "styles.py"), "sheets"))
        except Busy as e:
            raise err(409, str(e)) from e
        return {"job": job.to_json()}

    @app.post("/api/check-env")
    def check_env() -> dict:
        try:
            job = runner().start("check_env", "Проверка компьютера", python_cmd(str(ROOT / "scripts" / "check_env.py")))
        except Busy as e:
            raise err(409, str(e)) from e
        return {"job": job.to_json()}

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse({"error": exc.detail}, status_code=exc.status_code)

    return app


app = create_app()
