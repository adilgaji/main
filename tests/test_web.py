"""Веб-страница (блок D): маршруты, защита, фоновые задачи, показ шагов — без браузера и без Claude."""
import json
import shutil
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from factory import pipeline, settings as settings_mod, structures
from factory.web import app as app_mod, views
from factory.web.jobs import Runner

ROOT = Path(__file__).resolve().parent.parent
DEMO = ROOT / "scripts" / "demo" / "thermopylae"
H = {"X-Factory": "1"}

TOPICS = {
    "summary_ru": "Три темы для проверки.",
    "topics": [
        {"title": f"Topic number {i}", "subgenre": "wars", "pitch_ru": f"Тема {i}", "hook": "Why?",
         "sources": [{"title": "Herodotus, Histories", "url": "https://example.org/h", "opened": True}]}
        for i in (1, 2, 3)
    ],
}


@pytest.fixture
def env(tmp_path, monkeypatch):
    out = tmp_path / "output"
    out.mkdir()
    for mod in (pipeline, views):
        monkeypatch.setattr(mod, "OUTPUT_DIR", out)
    cfg = tmp_path / "settings.json"
    cfg.write_text(json.dumps({"voice": "am_fenrir", "style": "museum"}), encoding="utf-8")
    monkeypatch.setattr(settings_mod, "SETTINGS_PATH", cfg)
    st = tmp_path / "structures.json"
    shutil.copy(ROOT / "config" / "structures.json", st)
    monkeypatch.setattr(structures, "PATH", st)
    fake = tmp_path / "fake_agents"
    fake.mkdir()
    (fake / "idea-researcher.json").write_text(json.dumps(TOPICS), encoding="utf-8")
    monkeypatch.setenv("FACTORY_FAKE_AGENTS", str(fake))
    runner = Runner(tmp_path / "logs")
    client = TestClient(app_mod.create_app(runner), base_url="http://127.0.0.1:8765")
    yield {"client": client, "out": out, "runner": runner, "cfg": cfg, "tmp": tmp_path}
    runner.stop()


def post(c, url, body=None):
    return c.post(url, json=body or {}, headers=H)


def test_page_and_protection(env):
    c = env["client"]
    r = c.get("/")
    assert r.status_code == 200 and "Фабрика исторических видео" in r.text and "X-Factory" in r.text
    assert c.get("/api/ping").json() == {"app": "history-factory"}
    # команда без своего заголовка (например, с чужого сайта) отклоняется
    assert c.post("/api/videos", json={}).status_code == 403
    # чужое имя сервера (DNS rebinding) — отказ
    assert c.get("/api/home", headers={"Host": "evil.example:8765"}).status_code == 403
    assert c.get("/api/home", headers={"Host": "localhost:8765"}).status_code == 200
    assert app_mod.host_of("[::1]:8765") == "[::1]" and app_mod.host_of("127.0.0.1") == "127.0.0.1"


def test_whole_flow_style_topic_pick(env):
    c, out = env["client"], env["out"]
    assert c.get("/api/home").json()["videos"] == []
    vid = post(c, "/api/videos", {"subgenre": "wars", "hint": "Spartans", "minutes": 2.5, "chapters_min": 3, "chapters_max": 4}).json()["id"]
    assert (out / vid / "state.json").exists()
    v = c.get(f"/api/videos/{vid}").json()
    assert v["next"] == "style" and v["style"] is None and len(v["styles"]["styles"]) == 8
    assert v["styles"]["main"] == "museum"

    # без стиля темы не предлагаются
    assert post(c, f"/api/videos/{vid}/run", {"step": "topic"}).status_code == 409
    r = post(c, f"/api/videos/{vid}/style", {"style": "3"}).json()
    assert r["style"] == "illustrated"
    assert c.get(f"/api/videos/{vid}").json()["next"] == "topic"

    # следующий шаг не запускается, пока предыдущий не принят
    assert post(c, f"/api/videos/{vid}/run", {"step": "outline"}).status_code == 409
    assert post(c, f"/api/videos/{vid}/run", {"step": "unknown"}).status_code == 400

    # тема: настоящий процесс pipeline с подменённым агентом
    job = post(c, f"/api/videos/{vid}/run", {"step": "topic"}).json()["job"]
    assert job["running"] and job["video"] == vid and job["step"] == "topic"
    done = env["runner"].wait(120)
    assert done.returncode == 0, "\n".join(done.to_json(200)["log"])
    v = c.get(f"/api/videos/{vid}").json()
    assert [t["title"] for t in v["data"]["topics"]["topics"]] == ["Topic number 1", "Topic number 2", "Topic number 3"]
    assert c.get("/api/job").json()["job"]["ok"] is True

    # выбор темы переименовывает папку по теме
    new = post(c, f"/api/videos/{vid}/pick", {"number": 2}).json()["id"]
    assert new.endswith("_topic_number_2") and (out / new).exists() and not (out / vid).exists()
    v = c.get(f"/api/videos/{new}").json()
    assert v["next"] == "outline" and v["data"]["topic"]["title"] == "Topic number 2"
    assert {s["id"]: s["status"] for s in v["steps"]}["topic"] == pipeline.ACCEPTED
    # «принять» работает только для шага, который ждёт решения
    assert post(c, f"/api/videos/{new}/approve", {"step": "outline"}).status_code == 409
    home = c.get("/api/home").json()["videos"]
    assert home[0]["id"] == new and home[0]["next"] == "outline" and home[0]["style"]


def test_approve_and_redo_note(env, monkeypatch):
    c, out = env["client"], env["out"]
    folder = out / "2026-01-01_x"
    folder.mkdir()
    pipeline.write_state(folder, {"created": "2026-01-01 10:00:00", "brief": {"subgenre": "wars", "minutes": 8.5, "chapters": [5, 7]},
                                  "overrides": {"style": "museum"}, "topic": TOPICS["topics"][0],
                                  "steps": {"topic": {"status": pipeline.ACCEPTED}, "outline": {"status": pipeline.WAITING}}})
    outline = {"title": "T", "structure": "chronicle", "logline": "L", "hook": "H", "summary_ru": "план", "sources": [],
               "chapters": [{"id": "c1", "title": "A", "goal": "g", "beats": ["b1", "b2"], "climax": "c", "rehook": "r", "est_words": 100}]}
    (folder / "outline.json").write_text(json.dumps(outline), encoding="utf-8")
    v = c.get(f"/api/videos/{folder.name}").json()
    assert v["data"]["outline"]["title"] == "T" and v["data"]["structure_name"] == "Хроника" and v["title"] == "T"

    # «переделать» запускает тот же шаг с пожеланием владельца
    calls = []

    def fake_cmd(*args):
        calls.append([sys.executable, "-c", "print('ok')", *args[1:]])
        return calls[-1]

    monkeypatch.setattr(app_mod, "python_cmd", fake_cmd)
    post(c, f"/api/videos/{folder.name}/run", {"step": "outline", "note": "короче"})
    assert calls[-1][-4:] == ["run", str(folder), "outline", "--note", "короче"][-4:]
    env["runner"].wait(30)

    assert post(c, f"/api/videos/{folder.name}/approve", {"step": "outline"}).json()["next"] == "script"
    assert structures.load()["recent"][0] == "chronicle"


def test_one_job_at_a_time_and_stop(env, monkeypatch):
    c = env["client"]
    monkeypatch.setattr(app_mod, "python_cmd", lambda *a: [sys.executable, "-c", "import time\nprint('работаю', flush=True)\ntime.sleep(60)"])
    job = post(c, "/api/sheets").json()["job"]
    assert job["running"]
    r = post(c, "/api/check-env")
    assert r.status_code == 409 and "Уже идёт" in r.json()["error"]
    stopped = post(c, "/api/job/stop").json()["job"]
    assert not stopped["running"] and stopped["stopped"]
    assert any("Остановлено" in ln for ln in stopped["log"])
    assert post(c, "/api/check-env").status_code == 200


def test_files_are_served_only_from_the_video_folder(env):
    c, out = env["client"], env["out"]
    folder = out / "2026-01-01_files"
    (folder / "shorts").mkdir(parents=True)
    pipeline.write_state(folder, {"created": "x", "brief": {}, "steps": {}})
    (folder / "title.txt").write_text("A\nB\n", encoding="utf-8")
    (folder / "shorts" / "short_1.mp4").write_bytes(b"0")
    (folder / "shorts" / "short_1.txt").write_text("Short title\n\nabout", encoding="utf-8")
    (env["tmp"] / "secret.txt").write_text("no", encoding="utf-8")
    assert c.get(f"/files/{folder.name}/title.txt").text == "A\nB\n"
    assert c.get(f"/files/{folder.name}/shorts/short_1.mp4").status_code == 200
    assert c.get(f"/files/{folder.name}/../secret.txt").status_code == 404
    assert c.get(f"/files/{folder.name}/%2e%2e/%2e%2e/secret.txt").status_code == 404
    assert c.get("/files/..%2Foutput/title.txt").status_code == 404
    assert c.get("/api/videos/nope").status_code == 404
    assert c.get("/voices/../config/settings.json").status_code == 404
    assert c.get("/sheets/other.png").status_code == 404
    with pytest.raises(views.NotFound):
        views.video_dir("../output")
    res = c.get(f"/api/videos/{folder.name}").json()["data"]["result"]
    assert res["titles"] == ["A", "B"] and res["shorts"][0]["title"] == "Short title" and res["video"] is None


def test_storyboard_view_has_times_and_labels(env):
    folder = env["out"] / "2026-01-01_board"
    (folder / "work").mkdir(parents=True)
    pipeline.write_state(folder, {"created": "x", "brief": {}, "steps": {}})
    script = json.loads((DEMO / "script.json").read_text(encoding="utf-8"))
    board = json.loads((DEMO / "storyboard.json").read_text(encoding="utf-8"))
    shutil.copy(DEMO / "script.json", folder / "script.json")
    shutil.copy(DEMO / "storyboard.json", folder / "storyboard.json")
    chapters, start = [], 0
    for ch in script["chapters"]:
        words = [{"text": w, "start": i * 0.4, "end": i * 0.4 + 0.3} for i, w in enumerate(ch["text"].split())]
        frames = int(len(words) * 0.4 * 30) + 30
        chapters.append({"id": ch["id"], "frames": frames, "start_frame": start, "words": words})
        start += frames
    (folder / "work" / "narration.json").write_text(json.dumps({"chapters": chapters, "total_frames": start, "engine": "kokoro", "voice": "am_fenrir", "words": 1}), encoding="utf-8")
    (folder / "work" / "narration.wav").write_bytes(b"RIFF")
    v = env["client"].get(f"/api/videos/{folder.name}").json()
    sb = v["data"]["storyboard"]
    assert [c["id"] for c in sb["chapters"]] == [c["id"] for c in board["chapters"]]
    first = sb["chapters"][0]["shots"]
    assert first[0]["start"] == 0 and all(s["start"] is not None for s in first)
    assert [s["start"] for s in first] == sorted(s["start"] for s in first)
    assert sb["chapters"][1]["shots"][0]["start"] == round(chapters[1]["start_frame"] / 30, 1)
    assert all(s["type"] in views.storyboard.SHOT_TYPES for ch in sb["chapters"] for s in ch["shots"])
    assert sum(1 for ch in sb["chapters"] for s in ch["shots"] if s["label"]) >= len(first)
    assert v["data"]["narration"]["file"] == "work/narration.wav"
    est = v["data"]["estimate"]
    assert est["video_seconds"] == round(start / 30, 1) and est["render_minutes"] >= 0


def test_image_lookup_uses_only_the_cache(monkeypatch, tmp_path):
    from factory.images import store

    monkeypatch.setattr(store, "IMAGE_CACHE", tmp_path)
    (tmp_path / "met_436105.jpg").write_bytes(b"x")
    assert views.image_file("met:436105") == tmp_path / "met_436105.jpg"
    assert views.image_file("met:999") is None
    assert views.image_file("../etc:passwd") is None
    assert views.image_file("noref") is None


def test_settings_page_and_save(env):
    c = env["client"]
    s = c.get("/api/settings").json()
    assert s["voice"]["current"] == "am_fenrir" and len(s["voice"]["voices"]) == 6
    assert s["styles"]["main"] == "museum" and not s["smithsonian_key_set"]
    assert post(c, "/api/settings", {"voice": "bm_george", "voice_speed": 0.95, "style": "2", "smithsonian_api_key": " k123 "}).json()["ok"]
    saved = json.loads(env["cfg"].read_text(encoding="utf-8"))
    assert saved["voice"] == "bm_george" and saved["voice_speed"] == 0.95 and saved["style"] == "parchment"
    assert saved["images"]["smithsonian_api_key"] == "k123"
    assert post(c, "/api/settings", {"voice": "xx_nobody"}).status_code == 400
    assert post(c, "/api/settings", {"style": "99"}).status_code == 400
    assert post(c, "/api/settings", {"voice_speed": 3}).status_code == 422


def test_launcher_reuses_a_running_page(monkeypatch):
    from factory.web import __main__ as launcher

    monkeypatch.setattr(launcher, "ours", lambda port: port == 8766)
    monkeypatch.setattr(launcher, "port_free", lambda port: False)
    assert launcher.pick_port(8765) == (8766, True)
    monkeypatch.setattr(launcher, "ours", lambda port: False)
    monkeypatch.setattr(launcher, "port_free", lambda port: port == 8767)
    assert launcher.pick_port(8765) == (8767, False)
