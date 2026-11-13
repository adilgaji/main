"""Виды структуры видео и память последних: config/structures.json.

Одна и та же структура не повторяется подряд: агенту плана даются все, кроме двух последних.
"""
from __future__ import annotations

import json
from pathlib import Path

from factory.paths import CONFIG_DIR

PATH = CONFIG_DIR / "structures.json"
BLOCK_RECENT = 2


def load(path: Path | None = None) -> dict:
    return json.loads((path or PATH).read_text(encoding="utf-8"))


def allowed(path: Path | None = None) -> list[dict]:
    data = load(path)
    blocked = set(data.get("recent", [])[:BLOCK_RECENT])
    return [s for s in data["structures"] if s["id"] not in blocked]


def record(structure_id: str, path: Path | None = None) -> None:
    path = path or PATH
    data = load(path)
    if structure_id not in {s["id"] for s in data["structures"]}:
        raise ValueError(f"Неизвестная структура «{structure_id}»")
    data["recent"] = [structure_id] + [r for r in data.get("recent", []) if r != structure_id][:9]
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def name_ru(structure_id: str) -> str:
    return next((s["name_ru"] for s in load()["structures"] if s["id"] == structure_id), structure_id)
