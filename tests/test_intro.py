"""Интро канала после хука: место вставки, звук, раскладка кадров, правила для текста и Shorts."""
import json
from pathlib import Path

import numpy as np

from factory import intro, shorts, storyboard, textcheck

ROOT = Path(__file__).resolve().parent.parent
SR = 24000

HOOK = "In 480 BC, a tiny Greek army stood in a narrow pass. Why would anyone choose to fight there?"
REST = "The answer starts with geography. The pass was the only easy road south. Persia's army was huge. Greece had to slow it down."


def timed(text: str, step: float = 0.4, gap_at: int | None = None) -> list[dict]:
    out, t = [], 0.25
    for i, w in enumerate(text.split()):
        if gap_at is not None and i == gap_at:
            t += 0.85
        out.append({"text": w, "start": round(t, 3), "end": round(t + 0.3, 3)})
        t += step
    return out


def test_config_is_the_owner_choice():
    cfg = intro.load()
    assert cfg and cfg["channel"] == "True Tales of the Past" and cfg["variant"] == "ages"
    assert intro.text_of(cfg) == "Welcome to True Tales of the Past.\nPull up a chair — history has a story for you."
    assert 0.7 <= cfg["voice_speed"] < 1.0


def test_split_after_the_hook_paragraph():
    j = intro.split_word(f"{HOOK}\n\n{REST}")
    assert j == len(HOOK.split())
    assert intro.first_words(f"{HOOK}\n\n{REST}", j, 3) == "The answer starts"
    # без абзацев — начало предложения около 30-го слова
    one = " ".join([HOOK, REST, REST])
    k = intro.split_word(one)
    words = one.split()
    assert 8 <= k <= 70 and words[k - 1].endswith((".", "?"))
    # раскадровка уже есть, но кадр на границе хука не начинается — берётся ближайшая граница кадров
    assert intro.split_word(f"{HOOK}\n\n{REST}", anchors=[0, 9, len(HOOK.split()) + 5]) == len(HOOK.split()) + 5
    assert intro.split_word("Too short.") is None


def test_insert_shifts_words_and_keeps_frames_exact():
    words = timed(f"{HOOK} {REST}", gap_at=len(HOOK.split()))
    frames = int(np.ceil((words[-1]["end"] + 0.5) * 30))
    chapter = np.ones(frames * SR // 30, dtype=np.float32) * 0.1
    voice = np.ones(int(5.2 * SR), dtype=np.float32) * 0.5
    vw = [{"text": "Welcome", "start": 0.25, "end": 0.7}]
    j = len(HOOK.split())
    out, moved, info = intro.insert(chapter, SR, words, j, voice, vw)
    assert len(out) == (frames + info["frames"]) * SR // 30  # звук = кадры
    assert info["frames"] == int(np.ceil((intro.LEAD + 5.2 + intro.TAIL) * 30))
    mid = (words[j - 1]["end"] + words[j]["start"]) / 2
    assert info["at_frame"] == round(mid * 30) and info["word"] == j
    shift = info["frames"] / 30
    assert moved[:j] == words[:j] and abs(moved[j]["start"] - words[j]["start"] - shift) < 1e-3
    assert info["words"][0]["start"] == round(intro.LEAD + 0.25, 3)
    # на месте интро звучит голос интро, а не глава
    s0 = info["at_frame"] * SR // 30
    assert out[s0 + int(intro.LEAD * SR) + 100] == 0.5 and out[s0 - 10] == np.float32(0.1)


def _shots(at_second: str | None):
    shot = lambda t: {"type": t, "title": t}  # noqa: E731
    items = [{"at": "", "transition": "fade", "shot": shot("map")}, {"at": "Why would anyone", "transition": "fade", "shot": shot("quote")}]
    if at_second:
        items.append({"at": at_second, "transition": "fade", "shot": shot("timeline")})
    items.append({"at": "Persia's army was huge", "transition": "fade", "shot": shot("scene")})
    return items


def _chapter():
    words = timed(f"{HOOK} {REST}", step=0.45, gap_at=len(HOOK.split()))
    frames = int(np.ceil((words[-1]["end"] + 0.6) * 30))
    j = len(HOOK.split())
    audio = np.zeros(frames * SR // 30, dtype=np.float32)
    _, moved, info = intro.insert(audio, SR, words, j, np.zeros(int(5 * SR), np.float32), [])
    return moved, frames + info["frames"], info


def test_plan_with_intro_splits_the_chapter():
    words, frames, info = _chapter()
    plan = storyboard.plan_with_intro(words, _shots("The answer starts"), frames, info)
    assert [p["shot"]["type"] for p in plan] == ["map", "quote", "timeline", "scene"]
    a, n = info["at_frame"], info["frames"]
    assert plan[1]["start"] + plan[1]["frames"] == a and plan[1]["exit"]["kind"] == "dip"  # хук уходит в фон
    assert plan[2]["start"] == a + n and plan[2]["enter"]["kind"] == "dip"  # после интро — проявление
    assert plan[-1]["start"] + plan[-1]["frames"] == frames
    assert not any(p.get("continued") for p in plan)
    # кадр на границе не начинается: кадр хука продолжается после интро
    plan2 = storyboard.plan_with_intro(words, _shots(None), frames, info)
    assert [p["shot"]["type"] for p in plan2] == ["map", "quote", "quote", "scene"] and plan2[2]["continued"]
    assert plan2[2]["start"] == a + n
    # без интро — как раньше
    assert storyboard.plan_with_intro(words, _shots(None), frames, None) == storyboard.plan_chapter(words, _shots(None), frames)


def test_hook_must_be_its_own_paragraph():
    assert textcheck.hook_problems([{"id": "c1", "text": f"{HOOK}\n\n{REST}"}]) == []
    assert "own first paragraph" in textcheck.hook_problems([{"id": "c1", "text": f"{HOOK} {REST}"}])[0]
    long_hook = " ".join([HOOK] * 4)
    assert "words" in textcheck.hook_problems([{"id": "c1", "text": f"{long_hook}\n\n{REST}"}])[0]


def test_shorts_do_not_cross_the_intro():
    words, frames, info = _chapter()
    chapters = {"c1": {"id": "c1", "words": words, "intro": {k: info[k] for k in ("at_frame", "frames", "word")}}}
    cross = {"shorts": [{"title": "t", "hook": "A short hook.", "chapter": "c1", "start": "Why would anyone", "end": "slow it down", "description": "d"}]}
    assert any("channel intro" in e for e in shorts.check_answer(cross, chapters))
    after = {"shorts": [{"title": "t", "hook": "A short hook.", "chapter": "c1", "start": "The answer starts", "end": "slow it down", "description": "d"}]}
    assert not any("channel intro" in e for e in shorts.check_answer(after, chapters))


def test_agents_know_about_the_intro():
    sw = (ROOT / ".claude" / "agents" / "scriptwriter.md").read_text(encoding="utf-8")
    sb = (ROOT / ".claude" / "agents" / "storyboard-agent.md").read_text(encoding="utf-8")
    assert "FIRST PARAGRAPH of chapter c1" in sw and "intro_break" in sb
    variants = json.loads(json.dumps(intro.load()))["variant"]
    assert variants in (ROOT / "video" / "src" / "Intro.tsx").read_text(encoding="utf-8")


def test_srt_has_no_caption_during_the_intro(tmp_path):
    from factory import captions, production

    words, frames, info = _chapter()
    plan = {"total_frames": frames, "chapters": [{"id": "c1", "start_frame": 0, "words": words, "intro": {k: info[k] for k in ("at_frame", "frames", "word")}}]}
    production.write_texts(tmp_path, {"title": "T", "chapters": [{"id": "c1", "title": "One", "text": f"{HOOK}\n\n{REST}"}]}, plan)
    a, b = info["at_frame"] / 30, (info["at_frame"] + info["frames"]) / 30
    for c in captions.read_srt(tmp_path / "captions.srt"):
        assert c["end"] <= a + 1e-3 or c["start"] >= b - 1e-3
