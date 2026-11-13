"""Скачивание с кэшем, подготовка под кадр и запись sources.txt.

Изображение попадает в видео только вместе с записью о лицензии: `prepare` принимает
ImageRecord, а его выдают архивы лишь после проверки (см. licenses.py).
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from factory import audio
from factory.images.archives import MAX_SIDE, ImageRecord
from factory.images.http import download
from factory.paths import CACHE_DIR

IMAGE_CACHE = CACHE_DIR / "images"
SOURCES_HEADER = (
    "# Источники изображений. Только public domain / CC0 (у Library of Congress — «no known restrictions»).\n"
    "# файл | название | автор | дата | лицензия | страница объекта | прямая ссылка | чем подтверждена лицензия\n"
)


class ImageError(RuntimeError):
    pass


@dataclass
class Prepared:
    file: str  # имя файла в папке видео
    width: int
    height: int
    record: ImageRecord

    def to_json(self) -> dict:
        return {"file": self.file, "width": self.width, "height": self.height, "record": self.record.to_json()}

    @classmethod
    def from_json(cls, d: dict) -> "Prepared":
        return cls(d["file"], d["width"], d["height"], ImageRecord(**d["record"]))


def safe_name(record: ImageRecord) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "_", record.id).strip("_")[:48]
    if slug != record.id:
        slug = f"{slug}_{hashlib.sha1(record.id.encode()).hexdigest()[:6]}"
    return f"{record.archive}_{slug}"


def fetch(record: ImageRecord) -> Path:
    """Оригинал из архива → cache/images. Рядом кладётся запись о лицензии (.json)."""
    ext = Path(record.image_url.split("?")[0]).suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".tif", ".tiff"):
        ext = ".jpg"
    path = IMAGE_CACHE / f"{safe_name(record)}{ext}"
    side = path.with_suffix(".json")
    if not (path.exists() and side.exists()):
        download(record.image_url, path)
        side.write_text(json.dumps({**record.to_json(), "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S")}, ensure_ascii=False, indent=1), encoding="utf-8")
    return path


def image_size(path: Path) -> tuple[int, int]:
    p = subprocess.run(
        [audio.ffprobe_bin(), "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", str(path)],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    m = re.match(r"(\d+)x(\d+)", p.stdout.strip())
    if p.returncode != 0 or not m:
        raise ImageError(f"Файл не читается как изображение: {path.name}")
    return int(m.group(1)), int(m.group(2))


def prepare(record: ImageRecord, dest_dir: Path) -> Prepared:
    """Кладёт в папку видео JPEG не больше 2880 px по длинной стороне."""
    if not record.license or not record.evidence:
        raise ImageError(f"{record.ref}: нет подтверждённой лицензии — файл не берём")
    src = fetch(record)
    dest_dir.mkdir(parents=True, exist_ok=True)
    out = dest_dir / f"{safe_name(record)}.jpg"
    if not out.exists():
        p = subprocess.run(
            [audio.ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-frames:v", "1",
             "-vf", f"scale='min({MAX_SIDE},iw)':'min({MAX_SIDE},ih)':force_original_aspect_ratio=decrease:flags=lanczos,format=yuvj420p",
             "-q:v", "2", str(out)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        if p.returncode != 0:
            out.unlink(missing_ok=True)
            raise ImageError(f"{record.ref}: не удалось подготовить изображение: {p.stderr[-300:]}")
    w, h = image_size(out)
    if min(w, h) < 700:
        raise ImageError(f"{record.ref}: изображение слишком маленькое ({w}x{h}) — на весь кадр будет мутным")
    return Prepared(out.name, w, h, record)


def source_line(p: Prepared) -> str:
    r = p.record
    lic = f"{r.license} ({r.license_url})" if r.license_url else r.license
    return " | ".join([p.file, r.title, r.creator, r.date, lic, r.page_url, r.image_url, r.evidence])


def write_sources(images: list[Prepared], path: Path, notes: list[str] | None = None) -> None:
    """sources.txt: по строке на каждый файл + прочие источники (карты, тексты)."""
    lines = [SOURCES_HEADER]
    lines += [source_line(p) for p in sorted(images, key=lambda x: x.file)]
    if notes:
        lines += ["", "# Прочие источники", *notes]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_sources(path: Path) -> dict[str, dict]:
    """{файл: {title, creator, date, license, page_url, image_url, evidence}}"""
    out: dict[str, dict] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#") or line.count("|") < 6:
            continue
        f = [x.strip() for x in line.split("|")]
        out[f[0]] = dict(zip(("title", "creator", "date", "license", "page_url", "image_url", "evidence"), f[1:] + [""] * 7))
    return out


LICENSE_OK = re.compile(r"^(Public domain|CC0 1\.0|No known restrictions on publication)\b")


def check_sources(image_dir: Path, sources: Path) -> list[str]:
    """Проблемы: файл без записи, запись без лицензии / адреса. Пустой список — всё в порядке."""
    if not sources.exists():
        return ["нет файла sources.txt"]
    known = parse_sources(sources)
    problems = []
    for img in sorted(image_dir.glob("*")) if image_dir.is_dir() else []:
        if img.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        rec = known.get(img.name)
        if not rec:
            problems.append(f"{img.name}: нет записи в sources.txt")
        elif not LICENSE_OK.match(rec["license"]):
            problems.append(f"{img.name}: лицензия «{rec['license']}» не public domain / CC0")
        elif not rec["page_url"].startswith("http") or not rec["evidence"]:
            problems.append(f"{img.name}: в записи нет адреса страницы или подтверждения лицензии")
    return problems
