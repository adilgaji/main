"""Раскадровка: проверка правил и раскладка кадров по словам озвучки."""
import copy
import json
from pathlib import Path

from factory import storyboard as sbm

DEMO = Path(__file__).resolve().parent.parent / "scripts" / "demo" / "thermopylae"


def demo():
    return json.loads((DEMO / "script.json").read_text(encoding="utf-8")), json.loads((DEMO / "storyboard.json").read_text(encoding="utf-8"))


def test_demo_storyboard_is_valid():
    script, board = demo()
    assert sbm.validate(script, board) == []
    assert 3 <= len(script["chapters"]) <= 7
    assert all(len(c["title"]) <= 40 for c in script["chapters"])


def test_rules_are_enforced():
    script, board = demo()
    b = copy.deepcopy(board)
    shots = b["chapters"][0]["shots"]
    shots[1]["shot"] = copy.deepcopy(shots[0]["shot"])  # два одинаковых типа подряд
    shots[2]["at"] = "words that are not in the text"
    shots[3]["shot"]["src"] = "demo/x.jpg"  # картинка мимо архивов — без лицензии
    shots[4]["shot"]["title"] = "x" * 80
    errors = "\n".join(sbm.validate(script, b))
    assert "тот же, что у предыдущего" in errors
    assert "не найдена в тексте" in errors
    assert "«src» запрещено" in errors
    assert "длиннее" in errors
    b = copy.deepcopy(board)
    b["chapters"][1]["shots"][0]["shot"]["image"] = "flickr:123"
    assert any("архив:id" in e for e in sbm.validate(script, b))
    s = copy.deepcopy(script)
    s["chapters"] = s["chapters"][:2]
    assert any("не меньше трёх" in e for e in sbm.validate(s, board))


def test_anchor_search_ignores_punctuation_and_dashes():
    words = "In 480 BC, a few — Greeks tried. Why fight there? And how".split()
    assert sbm.find_anchor(words, "Why fight there", 1) == 8
    assert sbm.find_anchor(words, "few greeks", 0) == 4
    assert sbm.find_anchor(words, "why fight", 9) is None


def fake_words(n, step=0.4, gap_every=10):
    out, t = [], 0.25
    for i in range(n):
        out.append({"text": f"w{i}" + ("." if (i + 1) % gap_every == 0 else ""), "start": round(t, 3), "end": round(t + 0.3, 3)})
        t += step + (0.5 if (i + 1) % gap_every == 0 else 0)
    return out


def test_plan_chapter_covers_every_frame_and_overlaps_only_for_transitions():
    words = fake_words(40)
    shots = [
        {"shot": {"type": "quote", "text": "a", "author": "b"}},
        {"at": "w10.", "transition": "fade", "shot": {"type": "narrator"}},
        {"at": "w20", "transition": "cut", "shot": {"type": "timeline", "from": 1, "to": 2, "events": []}},
        {"at": "w30", "transition": "slide", "shot": {"type": "narrator"}},
    ]
    total = 600
    timed = sbm.plan_chapter(words, shots, total)
    assert timed[0]["start"] == 0 and timed[-1]["start"] + timed[-1]["frames"] == total
    nominal = [t["nominal"] for t in timed]
    assert nominal[0][0] == 0 and nominal[-1][1] == total
    assert all(a[1] == b[0] for a, b in zip(nominal, nominal[1:]))  # без дыр и наложений «по смыслу»
    for prev, cur in zip(timed, timed[1:]):
        overlap = prev["start"] + prev["frames"] - cur["start"]
        assert overlap == cur["enter"]["frames"] == prev["exit"]["frames"]
    assert timed[2]["enter"] == {"kind": "cut", "frames": 0}
    assert timed[0]["enter"]["kind"] == "dip" and timed[-1]["exit"]["kind"] == "dip"
    # граница — в паузе перед первым словом кадра
    b = nominal[1][0] / 30
    assert words[9]["end"] <= b <= words[10]["start"]
    # у рассказчика губы двигаются по словам его кадра, время — от начала кадра на экране
    sp = timed[1]["shot"]["speech"]
    assert len(sp) == 10 and abs(sp[0]["start"] - (words[10]["start"] - timed[1]["start"] / 30)) < 1e-3


def test_duration_limits():
    timed = [{"nominal": [0, 45], "shot": {"type": "map"}}, {"nominal": [45, 225], "shot": {"type": "quote"}}, {"nominal": [225, 600], "shot": {"type": "scene"}}]
    errors, notes = sbm.duration_problems(timed, "c1")
    assert len(errors) == 2 and "1.5 с" in errors[0] and "12.5 с" in errors[1]
    assert notes == []


def test_apply_images_fills_file_size_and_credit():
    prepared = {"met:1": {"file": "met_1.jpg", "width": 2000, "height": 1500, "credit": "The Met · public domain (CC0)"}}
    shot = sbm.apply_images({"type": "kenburns", "image": "met:1"}, prepared, "job/v/img")
    assert shot == {"type": "kenburns", "src": "job/v/img/met_1.jpg", "width": 2000, "height": 1500, "credit": "The Met · public domain (CC0)"}
    cmp_ = sbm.apply_images({"type": "compare", "left": {"label": "A", "icon": "wall"}, "right": {"label": "B", "image": "met:1", "credit": "own"}}, prepared, "p")
    assert cmp_["right"]["src"] == "p/met_1.jpg" and cmp_["right"]["credit"] == "own" and "src" not in cmp_["left"]


def test_python_and_remotion_agree_on_shot_types_and_icons():
    import re

    video = Path(__file__).resolve().parent.parent / "video" / "src"
    reg = (video / "shots" / "index.tsx").read_text(encoding="utf-8")
    ts = re.search(r"SHOT_TYPES = \[(.*?)\]", reg, re.S).group(1).replace("'", "").replace(" ", "").split(",")
    assert tuple(ts) == sbm.SHOT_TYPES
    icons = (video / "components" / "Icons.tsx").read_text(encoding="utf-8")
    names = re.search(r"ICON_NAMES = \[(.*?)\]", icons, re.S).group(1)
    assert tuple(re.findall(r"'(\w+)'", names)) == sbm.ICONS
    chapter = (video / "Chapter.tsx").read_text(encoding="utf-8")
    kinds = re.search(r"TransitionKind = (.*?);", chapter).group(1)
    assert set(sbm.TRANSITIONS) | {"dip"} == set(re.findall(r"'(\w+)'", kinds))
