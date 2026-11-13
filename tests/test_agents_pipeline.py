"""Агенты и шаги работы над видео — без вызова Claude (ответы агентов подменяются)."""
import json
from pathlib import Path

import jsonschema
import pytest

from factory import agents, pipeline, schemas, shorts, structures, textcheck

ROOT = Path(__file__).resolve().parent.parent
NAMES = ["idea-researcher", "outline-writer", "scriptwriter", "fact-checker", "image-researcher",
         "storyboard-agent", "shorts-editor", "packager", "quality-reviewer"]


def test_nine_agents_with_minimal_tools_and_right_models():
    found = sorted(p.stem for p in (ROOT / ".claude" / "agents").glob("*.md"))
    assert found == sorted(NAMES)
    web = {"WebSearch", "WebFetch"}
    for n in NAMES:
        a = agents.load_agent(n)
        assert set(a["tools"]) <= web, f"{n}: лишние инструменты {a['tools']}"
        assert "never ask" in a["prompt"].lower() and "json" in a["prompt"].lower()
    assert agents.load_agent("scriptwriter")["model"] == agents.load_agent("fact-checker")["model"] == "opus"
    for light in ("idea-researcher", "packager", "shorts-editor", "image-researcher"):
        assert agents.load_agent(light)["model"] == "haiku"
    assert agents.load_agent("storyboard-agent")["tools"] == []  # работает только с данными


def test_parse_answer_variants():
    data, meta = agents.parse_answer(json.dumps({"result": '```json\n{"a": 1}\n```', "total_cost_usd": 0.01, "is_error": False}))
    assert data == {"a": 1} and meta["cost"] == 0.01
    assert agents.parse_answer(json.dumps({"structured_output": {"b": 2}, "result": ""}))[0] == {"b": 2}
    with pytest.raises(agents.AgentError):
        agents.parse_answer(json.dumps({"result": "no json here"}))
    with pytest.raises(agents.AgentError):
        agents.parse_answer(json.dumps({"is_error": True, "result": "limit"}))


def test_run_retries_with_feedback(monkeypatch, tmp_path):
    answers = [{"x": "bad"}, {"x": 5}]
    prompts = []

    def fake(name, agent, task, data, schema, model, timeout):
        prompts.append(task)
        return answers.pop(0), {"cost": 0.002}

    monkeypatch.setattr(agents, "_call", fake)
    (tmp_path / "state.json").write_text("{}")
    schema = {"type": "object", "required": ["x"], "properties": {"x": {"type": "integer"}}}
    out = agents.run("packager", "do it", {"in": 1}, schema, check=lambda o: [] if o["x"] > 3 else ["x too small"], folder=tmp_path)
    assert out == {"x": 5}
    assert "rejected" in prompts[1] and "x" in prompts[1]
    st = json.loads((tmp_path / "state.json").read_text())
    assert st["agents"][0]["tries"] == 2 and st["agents_cost_usd"] == 0.004


def test_schemas_accept_the_demo_storyboard_and_are_valid():
    for s in (schemas.TOPICS, schemas.OUTLINE, schemas.SCRIPT, schemas.FACTS, schemas.QUERIES, schemas.STORYBOARD, schemas.SHORTS, schemas.PACKAGE, schemas.REVIEW):
        jsonschema.Draft202012Validator.check_schema(s)
    board = json.loads((ROOT / "scripts" / "demo" / "thermopylae" / "storyboard.json").read_text(encoding="utf-8"))
    jsonschema.validate({**board, "summary_ru": "ok"}, schemas.STORYBOARD)


def test_structures_never_repeat_recent(tmp_path):
    p = tmp_path / "s.json"
    p.write_text(json.dumps({"structures": [{"id": i, "name_ru": i} for i in "abcd"], "recent": []}))
    structures.record("a", p)
    structures.record("b", p)
    assert [s["id"] for s in structures.allowed(p)] == ["c", "d"]
    structures.record("c", p)
    assert [s["id"] for s in structures.allowed(p)] == ["a", "d"]
    with pytest.raises(ValueError):
        structures.record("zzz", p)


def test_outline_and_script_checks():
    outline = {"structure": "chronicle", "sources": [{"title": "x"}] * 3,
               "chapters": [{"id": f"c{i}", "est_words": 100} for i in range(1, 6)]}
    assert pipeline.check_outline(outline, ["chronicle"], 5, 7, 500, 3) == []
    bad = pipeline.check_outline({**outline, "structure": "countdown"}, ["chronicle"], 5, 7, 900, 3)
    assert any("structure" in e for e in bad) and any("est_words" in e for e in bad)
    text = "The pass was narrow. " * 40
    ch = [{"id": "c1", "text": text + "Darius I ruled.", "title": "a"}, {"id": "c2", "text": text + "Like and subscribe!", "title": "b"}]
    errors, stats = textcheck.check_script(ch, 330)
    assert any("Darius" in e and "the First" in e for e in errors)
    assert any("subscribe" in e for e in errors)
    assert stats["words"] == 326 and stats["grade"] < 5


def test_words_target_follows_voice_tempo():
    assert 1400 <= textcheck.words_target(8.5, "am_fenrir") <= 1500
    assert textcheck.words_target(8.5, "am_fenrir") != textcheck.words_target(8.5, "bf_emma")


def words(text, t0=0.3, step=0.4):
    return [{"text": w, "start": round(t0 + i * step, 3), "end": round(t0 + i * step + 0.3, 3)} for i, w in enumerate(text.split())]


def test_shorts_locate_and_duration_check():
    body = " ".join(f"w{i}" + ("." if i % 12 == 11 else "") for i in range(160))
    ch = {"c1": {"id": "c1", "words": words(body)}}
    assert shorts.locate(ch["c1"]["words"], "w10 w11.", "w40 w41") == (10, 41)
    good = {"title": "t", "hook": "Why did nobody notice this for a thousand years?", "chapter": "c1", "start": "w10", "end": "w90 w91", "description": "d"}
    assert shorts.check_answer({"shorts": [good]}, ch) == []
    short = {**good, "end": "w20"}
    assert any("30–55" in e for e in shorts.check_answer({"shorts": [short]}, ch))
    assert any("not found" in e for e in shorts.check_answer({"shorts": [{**good, "start": "nope"}]}, ch))
    assert any("overlaps" in e for e in shorts.check_answer({"shorts": [good, {**good, "start": "w50"}]}, ch))


def test_clip_shots_cover_the_short():
    props = {"shots": [
        {"start": 0, "frames": 200, "shot": {"type": "narrator", "speech": [{"start": 1.0, "end": 1.3}, {"start": 5.0, "end": 5.4}], "beats": [{"at": 4.0, "pose": "idle", "emotion": "smile"}]}, "enter": None, "exit": {"kind": "fade", "frames": 12}},
        {"start": 194, "frames": 300, "shot": {"type": "quote"}, "enter": {"kind": "fade", "frames": 12}, "exit": None},
    ]}
    out = shorts._clip_shots(props, 120, 400, 60, 340)
    assert out[0]["start"] == 0 and out[-1]["start"] + out[-1]["frames"] == 340
    assert out[0]["shot"]["speech"] == [{"start": 1.0, "end": 1.4}]  # кадр начат с 4-й секунды
    assert out[0]["shot"]["beats"][0]["at"] == 0.0
    assert out[0]["enter"]["kind"] == "dip" and out[-1]["exit"]["kind"] == "dip"


def test_pipeline_gates_and_topic_pick(tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline, "OUTPUT_DIR", tmp_path)
    folder = pipeline.new_video("wars", "Spartans at the pass", 2.5, (3, 4))
    assert folder.name.endswith("spartans_at_the_pass")
    with pytest.raises(pipeline.PipelineError, match="Стиль"):
        pipeline.require(folder, "topic")
    (folder / "topics.json").write_text(json.dumps({"topics": [{"title": "The Hot Gates: 480 BC", "subgenre": "wars", "pitch_ru": "п", "hook": "h", "sources": [{"title": "s"}]}]}))
    with pytest.raises(pipeline.PipelineError):
        pipeline.run_step(folder, "outline")
    new = pipeline.pick_topic(folder, 1)
    assert new.name.endswith("the_hot_gates_480_bc") and (new / "state.json").exists()
    st = pipeline.read_state(new)
    assert st["topic"]["title"] == "The Hot Gates: 480 BC" and pipeline.step_status(st, "topic") == pipeline.ACCEPTED
    assert pipeline.next_step(new) == "style"
    with pytest.raises(pipeline.PipelineError, match="не ждёт решения"):
        pipeline.approve(new, "outline")
    assert "Тема" in pipeline.status_text(new)


def test_sentences_with_times():
    s = pipeline.sentences_with_times(words("One two. Three four five? Six"))
    assert [x["words"] for x in s] == [2, 3, 1] and s[1]["start"] == 1.1
