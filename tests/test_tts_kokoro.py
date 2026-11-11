"""Тесты с настоящей озвучкой Kokoro. Нужна скачанная модель (scripts/download_models.py).

Запуск только их:  pytest -m slow
Пропустить их:      pytest -m "not slow"
"""
import json

import numpy as np
import pytest

from factory.paths import kokoro_snapshot_dir

pytestmark = [
    pytest.mark.slow,
    pytest.mark.skipif(kokoro_snapshot_dir() is None, reason="модель Kokoro не скачана"),
]

TEXT = (
    "In 480 BC, a small Greek force held the pass of Thermopylae against king Xerxes. "
    "Thutmose III ruled later — or so it seemed.\n"
    "Hatshepsut's temple still stands. Three places. One question: how do we know?"
)


@pytest.fixture(scope="module")
def narration():
    from factory.tts import narrate

    return narrate(TEXT, "am_michael")


def test_words_equal_text(narration):
    from factory.tts.text import normalize

    assert [w.text for w in narration.words] == normalize(TEXT).split()


def test_times_are_ordered_and_inside_audio(narration):
    prev_start = 0.0
    for w in narration.words:
        assert 0.0 <= w.start <= w.end <= narration.duration + 1e-6
        assert w.start >= prev_start - 1e-6, f"слово «{w.text}» начинается раньше предыдущего"
        prev_start = w.start
    spoken = [w for w in narration.words if any(c.isalnum() for c in w.text)]
    assert all(w.end - w.start > 0.03 for w in spoken)
    assert not any(w.estimated for w in spoken), "время слов должно приходить от модели"


def test_paragraph_and_sentence_numbers(narration):
    assert [w.paragraph for w in narration.words][0] == 0
    assert narration.words[-1].paragraph == 1
    sentences = [w.sentence for w in narration.words]
    assert sentences == sorted(sentences)
    assert sentences[-1] == 4  # всего 5 предложений


def test_pause_between_paragraphs_is_longer(narration):
    words = narration.words
    last_p0 = max(i for i, w in enumerate(words) if w.paragraph == 0)
    para_gap = words[last_p0 + 1].start - words[last_p0].end
    assert 0.3 < para_gap < 1.6


def test_pronunciation_overrides_used(narration):
    used = {p["word"]: p for p in narration.pronunciations}
    assert used["Xerxes"]["kind"] == "dictionary"
    assert used["III"]["say"] == "the Third"


def test_audio_is_sane(narration):
    a = narration.audio
    assert a.dtype == np.float32 and a.ndim == 1
    assert 0.05 < float(np.abs(a).max()) <= 0.99
    # начало и конец — тишина (нет обрезанных слов на краях)
    sr = narration.sample_rate
    assert float(np.abs(a[: int(0.15 * sr)]).max()) < 0.01
    assert float(np.abs(a[-int(0.2 * sr):]).max()) < 0.01
    assert 120 < narration.words_per_minute < 200


def test_british_voice_uses_british_dictionary():
    from factory.tts import narrate

    n = narrate("King Xerxes waited.", "bm_george")
    assert n.pronunciations[0]["phonemes"] == "zˈɜːksiːz"
    assert [w.text for w in n.words] == ["King", "Xerxes", "waited."]


def test_save_files_and_loudness(narration, tmp_path):
    from factory import audio
    from factory.tts import save_narration

    wav = tmp_path / "ch01.wav"
    info = save_narration(narration, wav)
    saved = json.loads((tmp_path / "ch01.words.json").read_text(encoding="utf-8"))
    assert saved["words"][0]["text"] == "In"
    assert abs(audio.duration(wav) - info["duration"]) < 0.02
    out = tmp_path / "norm.wav"
    stats = audio.normalize_loudness(wav, out)
    assert audio.loudness_ok(stats), stats
    assert abs(audio.duration(out) - info["duration"]) < 0.05


def test_gpu_request_falls_back_to_cpu(monkeypatch):
    """Просим видеокарту там, где её нет: должно тихо перейти на процессор."""
    import torch

    if torch.cuda.is_available():
        pytest.skip("на этой машине есть видеокарта")
    from factory.tts.kokoro_engine import KokoroEngine

    eng = KokoroEngine(device="cuda")
    n = eng.synthesize("A short test.", "am_michael")
    assert n.device == "cpu"
    assert [w.text for w in n.words] == ["A", "short", "test."]
