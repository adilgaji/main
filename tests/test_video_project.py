"""Проверки проекта видео (папка video/).

Быстрые: всё нужное лежит на месте и данные тестовых кадров согласованы.
Медленные (pytest -m slow): проверка кода TypeScript и правил Remotion.
"""
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "video"
PUBLIC = VIDEO / "public"


def test_assets_are_in_place():
    for name in ("land-110m", "land-50m", "land-10m", "countries-110m", "countries-50m", "rivers-50m", "rivers-10m", "lakes-50m", "lakes-10m"):
        f = PUBLIC / "geo" / f"{name}.json"
        assert f.exists() and f.stat().st_size > 10_000, f"нет данных карты: {f.name}"
    for name in ("grain.png", "grain-coarse.png", "paper.png", "linen.png"):
        assert (PUBLIC / "textures" / name).exists(), f"нет текстуры: {name}"
    fonts = {f.name for f in (PUBLIC / "fonts").glob("*.woff2")}
    for family in ("playfair-display", "source-sans-3", "inter"):
        assert f"{family}-latin-wght-normal.woff2" in fonts, f"нет шрифта: {family}"
    assert (PUBLIC / "fonts" / "LICENSES.md").exists()
    assert (PUBLIC / "geo" / "SOURCES.md").exists()


def test_every_demo_image_has_a_license_record():
    """Нет лицензии — нет файла: каждая картинка в public/demo записана в sources.txt."""
    records = (PUBLIC / "demo" / "sources.txt").read_text(encoding="utf-8")
    images = [f for f in (PUBLIC / "demo").iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")]
    assert images, "в public/demo нет ни одного изображения"
    for img in images:
        line = next((ln for ln in records.splitlines() if ln.startswith(img.name + " |")), None)
        assert line, f"{img.name}: нет записи об источнике"
        fields = [x.strip() for x in line.split("|")]
        assert len(fields) == 7 and all(fields), f"{img.name}: запись об источнике неполная"
        assert re.search(r"CC0|public domain", fields[4], re.I), f"{img.name}: лицензия не PD/CC0"
        assert fields[5].startswith("https://") and fields[6].startswith("https://")


def test_demo_shots_use_registered_types():
    registry = (VIDEO / "src" / "shots" / "index.tsx").read_text(encoding="utf-8")
    known = set(re.search(r"SHOT_TYPES = \[(.*?)\]", registry, re.S).group(1).replace("'", "").replace(" ", "").split(","))
    lib = json.loads((VIDEO / "src" / "demo" / "library.json").read_text(encoding="utf-8"))
    shots = [s["shot"] for s in lib["shots"]] + list(lib["extra"].values())
    assert {s["type"] for s in shots} <= known
    # все шесть типов кадров показаны в демо
    assert {s["shot"]["type"] for s in lib["shots"]} == known
    for item in lib["shots"]:
        assert item["narration"].strip(), f"у кадра {item['id']} нет текста озвучки"
    for s in shots:
        if s["type"] == "kenburns":
            assert (PUBLIC / s["src"]).exists(), f"нет файла изображения {s['src']}"
            assert s.get("credit"), "у архивного изображения должна быть строка источника"
        if s["type"] == "map":
            for region in s.get("regions", []):
                assert region.get("approximate", True), "исторические границы помечаются approximate"


@pytest.mark.slow
@pytest.mark.skipif(not (VIDEO / "node_modules").is_dir() or not shutil.which("npm"), reason="зависимости video/ не установлены")
def test_typescript_and_remotion_rules():
    p = subprocess.run([shutil.which("npm"), "run", "check", "--silent"], cwd=VIDEO, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    assert p.returncode == 0, p.stdout[-2000:]
