"""Склейка глав без перекодирования и соединение со звуком.

Итог — H.264 yuv420p + AAC, с -movflags +faststart. Звук дополняется тишиной ровно до длины
картинки (без -shortest: с ним теряются кадры), затем проверка «кадров столько, сколько ожидалось».
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from factory import audio


def _probe(path: Path, stream: str, entries: str) -> dict:
    p = subprocess.run(
        [audio.ffprobe_bin(), "-v", "error", "-select_streams", stream, "-show_entries", f"stream={entries}", "-of", "default=nw=1", str(path)],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    out = {}
    for line in p.stdout.splitlines():
        k, _, v = line.partition("=")
        out.setdefault(k, v)
    return out


def probe_video(path: Path) -> dict:
    """Параметры видеодорожки и звука готового файла."""
    v = _probe(path, "v:0", "codec_name,pix_fmt,width,height,r_frame_rate,nb_frames,duration")
    a = _probe(path, "a:0", "codec_name,sample_rate,duration")
    num, _, den = (v.get("r_frame_rate") or "0/1").partition("/")
    return {
        "codec": v.get("codec_name", ""), "pix_fmt": v.get("pix_fmt", ""),
        "width": int(v.get("width") or 0), "height": int(v.get("height") or 0),
        "fps": float(num) / float(den or 1) if float(den or 1) else 0.0,
        "frames": int(v.get("nb_frames") or 0) if (v.get("nb_frames") or "").isdigit() else 0,
        "duration": float(v.get("duration") or 0) if v.get("duration") not in (None, "N/A", "") else 0.0,
        "audio_codec": a.get("codec_name", ""),
        "audio_duration": float(a.get("duration") or 0) if a.get("duration") not in (None, "N/A", "") else 0.0,
    }


def faststart(path: Path) -> bool:
    """True, если служебная часть файла (moov) стоит перед данными (mdat) — видео открывается сразу."""
    with open(path, "rb") as f:
        pos, size = 0, path.stat().st_size
        while pos + 8 <= size:
            f.seek(pos)
            head = f.read(16)
            n, kind = int.from_bytes(head[:4], "big"), head[4:8]
            if n == 1:
                n = int.from_bytes(head[8:16], "big")
            if kind == b"moov":
                return True
            if kind == b"mdat" or n < 8:
                return False
            pos += n
    return False


def _ffmpeg(args: list[str]) -> None:
    p = subprocess.run([audio.ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    if p.returncode != 0:
        raise RuntimeError(f"FFmpeg завершился с ошибкой:\n{p.stderr[-800:]}")


def assemble(chapter_files: list[Path], narration: Path, out: Path, total_frames: int, fps: int = 30) -> dict:
    """Главы → одно видео (копированием) → + звук. Возвращает параметры готового файла."""
    work = out.parent / "work"
    work.mkdir(parents=True, exist_ok=True)
    listing = work / "concat.txt"
    listing.write_text("".join(f"file '{f.resolve().as_posix()}'\n" for f in chapter_files), encoding="utf-8")
    silent = work / "video.silent.mp4"
    _ffmpeg(["-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(silent)])
    got = probe_video(silent)["frames"]
    if got != total_frames:
        raise RuntimeError(f"После склейки кадров {got}, а должно быть {total_frames}")
    _ffmpeg([
        "-i", str(silent), "-i", str(narration), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
        "-af", "apad", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{total_frames / fps:.6f}",
        "-movflags", "+faststart", str(out),
    ])
    silent.unlink(missing_ok=True)
    return probe_video(out)
