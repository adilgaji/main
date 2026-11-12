#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Готовит картинки-текстуры (зерно плёнки, бумага) для видео.

Зерно и бумага — это готовые PNG, которые просто накладываются на кадр.
Так рендер в разы быстрее, чем считать шум заново в каждом кадре.

Запуск:  python scripts/make_textures.py
Результат: video/public/textures/*.png (хранятся в репозитории).
Картинки «бесшовные»: их можно повторять плиткой без видимых стыков.
"""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parent.parent / "video" / "public" / "textures"


def write_png(path: Path, gray: np.ndarray) -> None:
    """Сохраняет 8-битную серую картинку в PNG без сторонних библиотек."""
    h, w = gray.shape
    raw = b"".join(b"\x00" + gray[y].astype(np.uint8).tobytes() for y in range(h))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def band_noise(size: int, lo: float, hi: float, rng: np.random.Generator, aniso: float = 1.0) -> np.ndarray:
    """Бесшовный шум с деталями от lo до hi (в долях от размера). aniso > 1 вытягивает по горизонтали."""
    spectrum = np.fft.fft2(rng.standard_normal((size, size)))
    fy = np.fft.fftfreq(size)[:, None]
    fx = np.fft.fftfreq(size)[None, :] * aniso
    f = np.sqrt(fx**2 + fy**2)
    mask = np.exp(-((f / hi) ** 2)) * (1 - np.exp(-((f / max(lo, 1e-6)) ** 2)))
    out = np.real(np.fft.ifft2(spectrum * mask))
    return (out - out.mean()) / (out.std() + 1e-9)


def to_gray(field: np.ndarray, center: float = 128, spread: float = 30) -> np.ndarray:
    return np.clip(center + field * spread, 0, 255)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(1480)

    # Зерно плёнки: мелкий шум, серый 128 = «ничего не менять» в режиме overlay.
    grain = band_noise(512, 0.08, 0.45, rng)
    write_png(OUT / "grain.png", to_gray(grain, 128, 34))

    # Крупное зерно для стиля «кинохроника».
    coarse = band_noise(512, 0.03, 0.16, rng)
    write_png(OUT / "grain-coarse.png", to_gray(coarse, 128, 38))

    # Бумага: крупные пятна + волокна + мелкая шероховатость.
    blotches = band_noise(1024, 0.0, 0.006, rng)
    fibers = band_noise(1024, 0.02, 0.09, rng, aniso=3.0)
    tooth = band_noise(1024, 0.1, 0.4, rng)
    paper = blotches * 0.55 + fibers * 0.35 + tooth * 0.28
    write_png(OUT / "paper.png", to_gray(paper, 128, 26))

    # Холст / ткань: перекрестие нитей.
    weave = band_noise(512, 0.05, 0.3, rng, aniso=8.0) + band_noise(512, 0.05, 0.3, rng, aniso=0.125)
    write_png(OUT / "linen.png", to_gray(weave, 128, 20))

    for f in sorted(OUT.glob("*.png")):
        print(f"{f.name:<18} {f.stat().st_size / 1024:6.0f} КБ")


if __name__ == "__main__":
    main()
