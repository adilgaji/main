"""Склейка глав и проверки файла на маленьких роликах, сделанных FFmpeg (без Remotion)."""
import subprocess

import numpy as np
import pytest
import soundfile as sf

from factory import audio
from factory.render import join as asm
from factory.render import remotion

pytestmark = pytest.mark.skipif(not audio.shutil.which("ffmpeg"), reason="нет FFmpeg")


def clip(path, frames, color):
    subprocess.run([audio.ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"color=c={color}:s=320x180:r=30",
                    "-frames:v", str(frames), "-c:v", "libx264", "-pix_fmt", "yuv420p", str(path)], check=True)


def test_concat_and_mux_keep_every_frame(tmp_path):
    a, b = tmp_path / "c1.mp4", tmp_path / "c2.mp4"
    clip(a, 47, "red")
    clip(b, 31, "blue")
    sr = 24000
    wav = tmp_path / "n.wav"
    sf.write(wav, (0.1 * np.sin(np.linspace(0, 2000, int(2.0 * sr)))).astype(np.float32), sr)  # звук короче картинки
    info = asm.assemble([a, b], wav, tmp_path / "video.mp4", 78)
    assert info["frames"] == 78 and info["pix_fmt"] == "yuv420p" and info["audio_codec"] == "aac"
    assert abs(info["audio_duration"] - info["duration"]) < 0.03
    assert asm.faststart(tmp_path / "video.mp4")
    assert not asm.faststart(a)  # обычный файл без +faststart


def test_done_marks_and_fingerprint(tmp_path):
    out = tmp_path / "c1.mp4"
    clip(out, 30, "green")
    props = tmp_path / "p.json"
    props.write_text('{"a": 1}')
    key = remotion.chapter_key(props, "abc", 22)
    assert not remotion.is_done(out, key, 30)
    out.with_suffix(".done.json").write_text(f'{{"key": "{key}", "frames": 30}}')
    assert remotion.is_done(out, key, 30)
    assert not remotion.is_done(out, remotion.chapter_key(props, "abc", 23), 30)  # другие настройки — рендер заново
    props.write_text('{"a": 2}')
    assert not remotion.is_done(out, remotion.chapter_key(props, "abc", 22), 30)  # глава изменилась
    assert len(remotion.source_fingerprint()) == 16
    assert "swangle" not in remotion.gl_modes()
