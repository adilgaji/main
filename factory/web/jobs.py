"""Фоновые задачи веб-страницы: один долгий шаг за раз в отдельном процессе.

Шаги фабрики (агенты, озвучка, рендер) идут минутами и часами, поэтому страница не ждёт их,
а запускает `python -m factory.pipeline …` отдельным процессом и читает его лог.
Одновременно — только одна задача: рендер и агенты и так занимают весь ноутбук и лимит подписки.
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from factory.paths import LOGS_DIR, ROOT

WEB_LOGS = LOGS_DIR / "web"


class Busy(RuntimeError):
    pass


@dataclass
class Job:
    id: str
    kind: str  # step | fix | sheets | check_env
    title: str  # по-русски, для страницы
    cmd: list[str]
    log: Path
    video: str | None = None
    step: str | None = None
    started: float = field(default_factory=time.time)
    ended: float | None = None
    returncode: int | None = None
    stopped: bool = False
    proc: subprocess.Popen | None = None

    @property
    def running(self) -> bool:
        return self.returncode is None

    def to_json(self, tail: int = 60) -> dict:
        return {
            "id": self.id, "kind": self.kind, "title": self.title, "video": self.video, "step": self.step,
            "started": time.strftime("%H:%M:%S", time.localtime(self.started)),
            "seconds": round((self.ended or time.time()) - self.started),
            "running": self.running, "returncode": self.returncode, "stopped": self.stopped,
            "ok": self.returncode == 0, "log": tail_lines(self.log, tail),
        }


def tail_lines(path: Path, n: int = 60) -> list[str]:
    """Последние строки лога (читается только конец файла)."""
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            f.seek(max(0, size - 64 * 1024))
            data = f.read().decode("utf-8", errors="replace")
    except OSError:
        return []
    # прогресс-бары пишут строки через \r — показываем последнее состояние строки
    lines = [ln.rsplit("\r", 1)[-1] for ln in data.replace("\r\n", "\n").split("\n")]
    return [ln for ln in lines if ln.strip()][-n:]


def python_cmd(*args: str) -> list[str]:
    return [sys.executable, *args]


class Runner:
    def __init__(self, logs_dir: Path | None = None):
        self.logs_dir = logs_dir or WEB_LOGS
        self.current: Job | None = None
        self.history: list[Job] = []
        self._lock = threading.Lock()

    def poll(self) -> Job | None:
        """Обновляет состояние текущей задачи; возвращает её (или последнюю завершённую)."""
        with self._lock:
            job = self.current
            if job and job.running and job.proc is not None:
                rc = job.proc.poll()
                if rc is not None:
                    job.returncode, job.ended = rc, time.time()
            return job

    def busy(self) -> bool:
        job = self.poll()
        return bool(job and job.running)

    def start(self, kind: str, title: str, cmd: list[str], video: str | None = None, step: str | None = None) -> Job:
        if self.busy():
            raise Busy(f"Уже идёт задача «{self.current.title}». Дождитесь её окончания или остановите.")  # type: ignore[union-attr]
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        stamp = time.strftime("%Y%m%d_%H%M%S")
        job_id = f"{stamp}_{kind}" + (f"_{step}" if step else "")
        log = self.logs_dir / f"{job_id}.log"
        env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1", "PYTHONUTF8": "1"}
        kwargs: dict = {}
        if os.name == "nt":
            # своя группа процессов (чтобы остановить вместе с дочерними) и без лишнего чёрного окна
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW  # type: ignore[attr-defined]
        else:
            kwargs["start_new_session"] = True
        with open(log, "wb") as out:
            out.write(f"$ {' '.join(cmd[1:])}\n".encode("utf-8"))
            out.flush()
            proc = subprocess.Popen(cmd, cwd=ROOT, stdout=out, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, env=env, **kwargs)
        job = Job(job_id, kind, title, cmd, log, video=video, step=step, proc=proc)
        with self._lock:
            if self.current:
                self.history = ([self.current] + self.history)[:10]
            self.current = job
        return job

    def stop(self) -> Job | None:
        job = self.poll()
        if not job or not job.running or job.proc is None:
            return job
        job.stopped = True
        pid = job.proc.pid
        try:
            if os.name == "nt":
                # /T — вместе с дочерними процессами (рендер, node, claude)
                subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
            else:
                os.killpg(pid, signal.SIGTERM)
        except (OSError, ProcessLookupError):
            pass
        try:
            job.proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            if os.name != "nt":
                try:
                    os.killpg(pid, signal.SIGKILL)
                except (OSError, ProcessLookupError):
                    pass
            job.proc.wait(timeout=10)
        with open(job.log, "ab") as out:
            out.write("\nОстановлено владельцем. Повторный запуск продолжит с места остановки.\n".encode("utf-8"))
        return self.poll()

    def wait(self, timeout: float = 60) -> Job | None:
        """Для автотестов: дождаться окончания текущей задачи."""
        t0 = time.time()
        while self.busy() and time.time() - t0 < timeout:
            time.sleep(0.05)
        return self.poll()
