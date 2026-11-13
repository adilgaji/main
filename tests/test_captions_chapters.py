"""Субтитры .srt и главы-таймкоды."""
import json

from factory import captions, chapters


def words_of(text, t0=0.3, step=0.35):
    return [{"text": w, "start": round(t0 + i * step, 3), "end": round(t0 + i * step + 0.3, 3)} for i, w in enumerate(text.split())]


TEXT = "In the summer of 480 BC, a few thousand Greeks tried to stop the biggest army their world had ever seen. Why fight there? And how much of this famous story can we really trust?"


def test_pages_never_cross_sentences_and_keep_two_lines():
    w = words_of(TEXT)
    pages = captions.build_pages(w)
    assert all(len(p["lines"]) <= 2 for p in pages)
    for p in pages:
        flat = [i for line in p["lines"] for i in line]
        inner = [w[i]["text"] for i in flat[:-1]]
        # внутри страницы может закончиться только короткое предложение, слитое с соседним
        assert sum(t.endswith((".", "?")) for t in inner) <= 1
        assert all(captions._line_len(w, line) <= captions.MAX_CHARS or len(line) == 1 for line in p["lines"])


def test_srt_matches_text_exactly(tmp_path):
    w1, w2 = words_of(TEXT), words_of("Our main witness is Herodotus.")
    items = captions.cues([(0.0, w1), (30.0, w2)])
    path = tmp_path / "captions.srt"
    captions.write_srt(items, path)
    back = captions.read_srt(path)
    assert [round(c["start"], 3) for c in back] == [round(c["start"], 3) for c in items]
    expected = [x["text"] for x in w1 + w2]
    assert captions.problems(path, expected, 40.0) == []
    assert captions.problems(path, expected[:-1] + ["Herodotos."], 40.0)
    assert back[-1]["start"] >= 30.0
    assert captions.srt_time(3723.5) == "01:02:03,500"
    # последняя реплика не выходит за конец видео (на экране она держится ещё 0,6 с после слова)
    short = captions.cues([(0.0, w2)], total=w2[-1]["end"] + 0.2)
    assert short[-1]["end"] == w2[-1]["end"] + 0.2


def test_chapters_files_and_checks(tmp_path):
    ch = chapters.build(["Room for one wagon", "The king who came west", "Three days in the pass"], [0.28, 32.1, 68.9])
    assert [c["timecode"] for c in ch] == ["0:00", "0:32", "1:08"]
    chapters.write(ch, tmp_path)
    assert (tmp_path / "description.txt").read_text(encoding="utf-8").startswith("0:00 Room for one wagon\n")
    assert json.loads((tmp_path / "chapters.json").read_text(encoding="utf-8"))[1]["start"] == 32
    assert chapters.problems(tmp_path, [0.3, 32.2, 68.95], 100.0) == []
    bad = chapters.problems(tmp_path, [0.3, 34.0, 68.95], 75.0)
    assert any("расходится с видео" in p for p in bad) and any("короче 10 с" in p for p in bad)
    assert chapters.timecode(3725) == "1:02:05"
