"""Схемы ответов агентов (JSON Schema). Их же получает Claude Code (--json-schema),
а скрипт после ответа проверяет ещё раз и добавляет правила фабрики (pipeline.py)."""
from __future__ import annotations

from factory.storyboard import ICONS, SHOT_TYPES, TRANSITIONS

SUBGENRES = {
    "ancient": "Древние цивилизации",
    "wars": "Войны и сражения",
    "mysteries": "Загадки и тайны истории",
    "daily_life": "Повседневная жизнь людей в прошлом",
}

S = {"type": "string"}


def text(n: int) -> dict:
    return {"type": "string", "maxLength": n}


def obj(required: list[str], **props) -> dict:
    return {"type": "object", "required": required, "properties": props}


def arr(items: dict, lo: int = 0, hi: int | None = None) -> dict:
    out = {"type": "array", "items": items, "minItems": lo}
    if hi is not None:
        out["maxItems"] = hi
    return out


SOURCE = obj(["title"], title=text(240), url=text(400), kind=text(40), opened={"type": "boolean"}, notes=text(400))

TOPICS = obj(
    ["topics", "summary_ru"],
    topics=arr(obj(["title", "subgenre", "pitch_ru", "hook", "sources"],
                   title=text(90), subgenre={"enum": list(SUBGENRES)}, pitch_ru=text(500), hook=text(320),
                   sources=arr(SOURCE, 1, 4), risk_ru=text(300)), 3, 6),
    summary_ru=text(800),
)

OUTLINE = obj(
    ["title", "structure", "logline", "hook", "chapters", "sources", "summary_ru"],
    title=text(90), structure=S, logline=text(400), hook=text(500),
    chapters=arr(obj(["id", "title", "goal", "beats", "climax", "rehook", "est_words"],
                     id=S, title=text(40), goal=text(400), beats=arr(text(300), 2, 6), climax=text(300),
                     rehook=text(300), est_words={"type": "integer", "minimum": 30}), 3, 7),
    sources=arr(SOURCE, 2, 8),
    summary_ru=text(1000),
)

SCRIPT = obj(["chapters", "notes_ru"], chapters=arr(obj(["id", "title", "text"], id=S, title=text(40), text=text(12000)), 3, 7), notes_ru=text(600))

STATUS = ["fact", "disputed", "legend", "myth"]
FACTS = obj(
    ["facts", "problems", "pronunciations", "summary_ru"],
    facts=arr(obj(["chapter", "claim", "status", "source_title", "opened"],
                  chapter=S, claim=text(400), status={"enum": STATUS}, source_title=text(240), url=text(400),
                  opened={"type": "boolean"}, evidence=text(500)), 3),
    problems=arr(obj(["chapter", "quote", "issue", "fix"], chapter=S, quote=text(400), issue=text(400), fix=text(400))),
    pronunciations=arr(obj(["word", "us", "gb", "say"], word=text(40), us=text(60), gb=text(60), say=text(60))),
    summary_ru=text(800),
)

QUERIES = obj(["queries"], queries=arr(obj(["chapter", "query"], chapter=S, query=text(60), why=text(200)), 3, 30))

STORYBOARD = obj(
    ["chapters", "summary_ru"],
    chapters=arr(obj(["id", "shots"], id=S, shots=arr(obj(["at", "shot"], at=text(120), transition={"enum": list(TRANSITIONS)},
                                                          shot={"type": "object", "required": ["type"], "properties": {"type": {"enum": list(SHOT_TYPES)}}}), 1)), 3, 7),
    summary_ru=text(600),
)

SHORTS = obj(
    ["shorts", "summary_ru"],
    shorts=arr(obj(["title", "hook", "chapter", "start", "end", "description"],
                   title=text(60), hook=text(120), chapter=S, start=text(120), end=text(120), description=text(300)), 3, 5),
    summary_ru=text(500),
)

PACKAGE = obj(
    ["titles", "description", "tags", "thumbnails", "summary_ru"],
    titles=arr(text(70), 3, 3), description=text(1200), tags=arr(text(40), 8, 25),
    thumbnails=arr(obj(["text", "side"], text=text(32), kicker=text(24), image={"type": ["string", "null"]},
                       icon={"enum": [*ICONS, None]}, side={"enum": ["left", "right"]}), 3, 3),
    summary_ru=text(400),
)

REVIEW = obj(
    ["verdict", "items", "fixes", "summary_ru"],
    verdict={"enum": ["ready", "needs_fixes"]},
    items=arr(obj(["area", "ok", "note"], area=text(80), ok={"type": "boolean"}, note=text(300)), 5),
    fixes=arr(text(300)), summary_ru=text(800),
)
