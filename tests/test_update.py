"""update.bat: git pull не теряет настройки владельца и слова словаря."""
import importlib.util
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("update_script", ROOT / "scripts" / "update.py")
upd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upd)


def test_merge_rules():
    s = upd.merge_settings({"voice": None, "style": None, "tts": {"device": "auto", "new_opt": 1}}, {"voice": "am_fenrir", "style": "museum", "tts": {"device": "cpu"}})
    assert s == {"voice": "am_fenrir", "style": "museum", "tts": {"device": "cpu", "new_opt": 1}}
    p = upd.merge_pronunciations({"about": "new", "words": {"Xerxes": {"us": "new"}}}, {"about": "old", "words": {"Xerxes": {"us": "mine"}, "Ekirch": {"us": "x"}}})
    assert p["about"] == "new" and p["words"] == {"Xerxes": {"us": "new"}, "Ekirch": {"us": "x"}}
    st = upd.merge_structures({"structures": [{"id": "a"}, {"id": "b"}], "recent": []}, {"structures": [{"id": "a"}], "recent": ["b", "gone", "a"]})
    assert st["recent"] == ["b", "a"] and len(st["structures"]) == 2
    assert upd.merge_file("settings.json", '{"a": 1}', "not json") is None
    assert upd.merge_file("settings.json", "broken", '{"a": 2}') == '{"a": 2}'


def _git(cwd, *args):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True)


@pytest.mark.skipif(shutil.which("git") is None, reason="нет git")
def test_pull_keeps_local_changes(tmp_path, monkeypatch):
    remote, dev, laptop = tmp_path / "remote.git", tmp_path / "dev", tmp_path / "laptop"
    _git(tmp_path, "init", "--bare", "-b", "main", str(remote))
    _git(tmp_path, "clone", str(remote), str(dev))
    for repo in (dev,):
        _git(repo, "config", "user.email", "t@t")
        _git(repo, "config", "user.name", "t")
    (dev / "config").mkdir()
    (dev / "config" / "settings.json").write_text(json.dumps({"voice": None, "style": None}), encoding="utf-8")
    (dev / "config" / "pronunciations.json").write_text(json.dumps({"words": {"Xerxes": {"us": "a"}}}), encoding="utf-8")
    (dev / "config" / "structures.json").write_text(json.dumps({"structures": [{"id": "a"}], "recent": []}), encoding="utf-8")
    _git(dev, "add", ".")
    _git(dev, "commit", "-m", "1")
    _git(dev, "push", "origin", "HEAD:main")
    _git(tmp_path, "clone", str(remote), str(laptop))

    # у владельца: выбран голос, проверка фактов добавила слово, записана структура
    (laptop / "config" / "settings.json").write_text(json.dumps({"voice": "am_fenrir", "style": "museum"}), encoding="utf-8")
    (laptop / "config" / "pronunciations.json").write_text(json.dumps({"words": {"Xerxes": {"us": "a"}, "Ekirch": {"us": "e"}}}), encoding="utf-8")
    (laptop / "config" / "structures.json").write_text(json.dumps({"structures": [{"id": "a"}], "recent": ["a"]}), encoding="utf-8")
    # у разработчика: новые поля и слова в тех же файлах + новый код
    (dev / "config" / "settings.json").write_text(json.dumps({"voice": None, "style": None, "new": 5}), encoding="utf-8")
    (dev / "config" / "pronunciations.json").write_text(json.dumps({"words": {"Xerxes": {"us": "b"}, "Leonidas": {"us": "l"}}}), encoding="utf-8")
    (dev / "code.py").write_text("x = 1\n", encoding="utf-8")
    _git(dev, "add", ".")
    _git(dev, "commit", "-m", "2")
    _git(dev, "push", "origin", "HEAD:main")

    monkeypatch.setattr(upd, "ROOT", laptop)
    monkeypatch.setattr(upd, "CONFIG", laptop / "config")
    assert upd.pull()
    assert (laptop / "code.py").exists()
    s = json.loads((laptop / "config" / "settings.json").read_text(encoding="utf-8"))
    assert s == {"voice": "am_fenrir", "style": "museum", "new": 5}
    w = json.loads((laptop / "config" / "pronunciations.json").read_text(encoding="utf-8"))["words"]
    assert set(w) == {"Xerxes", "Leonidas", "Ekirch"} and w["Xerxes"]["us"] == "b"
    assert json.loads((laptop / "config" / "structures.json").read_text(encoding="utf-8"))["recent"] == ["a"]
    assert list((laptop / "logs" / "backup").iterdir())

    # повторный запуск: обновлений нет, ничего не ломается
    assert upd.pull()
    assert json.loads((laptop / "config" / "settings.json").read_text(encoding="utf-8"))["voice"] == "am_fenrir"


BATS = ["setup.bat", "start.bat", "update.bat", "install_gpu.bat", "check_env.bat"]


@pytest.mark.parametrize("name", BATS)
def test_bat_files_follow_windows_rules(name):
    lines = (ROOT / name).read_text(encoding="utf-8").splitlines()
    assert lines[0] == "@echo off" and lines[1] == "chcp 65001 >nul", "первая строка после @echo off — chcp 65001"
    labels = {ln[1:].split()[0].lower() for ln in lines if ln.startswith(":") and not ln.startswith("::")}
    for ln in lines:
        s = ln.strip()
        low = s.lower()
        for target in [w for w in low.replace("goto :eof", "").split("goto ")[1:]]:
            assert target.split()[0] in labels, f"{name}: нет метки для «{s}»"
        if low.startswith("if ") and "(" in s:
            pytest.fail(f"{name}: блоки if ( … ) не используем — в них ломаются скобки в echo: {s}")
        first = low.split()[0] if low else ""
        assert first not in ("npm", "npx", "claude"), f"{name}: .cmd-программы вызываются через call: {s}"
    gattr = (ROOT / ".gitattributes").read_text(encoding="utf-8")
    assert "*.bat   text eol=crlf" in gattr
