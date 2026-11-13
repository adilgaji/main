"""Запасные движки озвучки: сборка звука и времени слов (без загрузки моделей)."""
import numpy as np
import pytest

from factory.tts import TTSError, fallback, narrate_many
from factory.tts.pronunciation import Dictionary, Entry


def test_voice_mapping_keeps_accent_and_gender():
    assert fallback.piper_voice_for("am_fenrir") == "en_US-ryan-medium"
    assert fallback.piper_voice_for("bf_emma") == "en_GB-alba-medium"
    assert fallback.edge_voice_for("bm_george").startswith("en-GB-")
    assert fallback.piper_files("en_US-ryan-medium")[0] == "en/en_US/ryan/medium/en_US-ryan-medium.onnx"


def test_spread_words_is_ordered_and_skips_dashes():
    toks = "Leonidas held — the pass.".split()
    t = fallback.spread_words(toks, 0.0, 2.0)
    assert t[0][0] == 0.0 and t[-1][1] <= 2.0 + 1e-9
    assert all(a[1] <= b[0] + 1e-9 for a, b in zip(t, t[1:]))
    assert t[2][0] == t[2][1]  # тире без звука
    assert (t[0][1] - t[0][0]) > (t[3][1] - t[3][0])  # длинное слово звучит дольше короткого


def test_edge_marks_to_words():
    toks = "In 480 BC — Xerxes came.".split()
    marks = [(0.1, 0.2), (0.35, 0.5), (0.9, 0.3), (1.3, 0.4), (1.8, 0.3)]
    t = fallback.edge_times(toks, marks)
    assert t[3] == pytest.approx((1.2, 1.2)) and t[4] == pytest.approx((1.3, 1.7))
    assert fallback.edge_times(toks, marks[:3]) is None


def test_piper_text_uses_dictionary():
    d = Dictionary({"ephialtes": Entry("Ephialtes", "ˌɛfiˈæltiz", "ˌɛfiˈaltiːz")})
    out = fallback.piper_text("Then Ephialtes, a local man.", "us", d)
    assert out == "Then [[ ˌɛfiˈæltiz ]], a local man."
    assert fallback.to_espeak("dəɹˈIəs") == "dəɹˈaɪəs"


def test_assemble_matches_text_and_timeline():
    sr = 16000

    def synth(chunk):
        n = len(chunk.split())
        a = np.zeros(int(0.1 * sr) + n * int(0.3 * sr) + int(0.1 * sr), dtype=np.float32)
        a[int(0.1 * sr): -int(0.1 * sr)] = 0.3 * np.sin(np.linspace(0, 400 * np.pi, len(a) - int(0.2 * sr)))
        return a, None

    text = "In 480 BC, a few Greeks held the pass. They did not run.\nOn the fifth day — he attacked."
    n = fallback.assemble(text, "am_fenrir", 1.0, "test", "cpu", sr, synth)
    assert [w.text for w in n.words] == text.replace("\n", " ").split()
    assert all(w.estimated for w in n.words)
    assert all(a.start <= b.start for a, b in zip(n.words, n.words[1:]))
    assert n.words[-1].end <= n.duration
    assert {w.paragraph for w in n.words} == {0, 1}


def test_engine_chain_falls_back_and_keeps_one_engine(monkeypatch):
    import factory.tts as tts

    calls = []

    def fake_run(name, text, voice, speed, device, **kw):
        calls.append(name)
        if name == "kokoro" and "second" in text:
            raise TTSError("сломалось")
        return name

    monkeypatch.setattr(tts, "_run", fake_run)
    monkeypatch.delenv("FACTORY_TTS_ENGINE", raising=False)
    out = narrate_many(["first", "second"], "am_fenrir")
    assert out == ["piper", "piper"]  # все главы — одним голосом
    assert calls == ["kokoro", "kokoro", "piper", "piper"]
    monkeypatch.setattr(tts, "_run", lambda *a, **k: (_ for _ in ()).throw(TTSError("нет")))
    with pytest.raises(TTSError, match="Ни один движок"):
        narrate_many(["x"], "am_fenrir")
