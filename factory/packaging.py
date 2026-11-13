"""Упаковка готового видео: названия, описание с главами, теги, 3 обложки, Shorts, итоговая проверка.

Файлы в папке видео: title.txt (3 варианта), description.txt (первая строка «0:00 …»),
tags.txt, thumbnail_1..3.png, shorts/short_N.mp4 + short_N.txt, review.json.
"""
from __future__ import annotations

import json
import logging
import re
import shutil
from collections import Counter
from pathlib import Path

from factory import agents, chapters, schemas, shorts, storyboard, textcheck
from factory.images import parse_sources
from factory.images.store import image_size
from factory.render import bundle, still
from factory.settings import effective, load_settings, voice_of
from factory.styles import require_style_chosen

log = logging.getLogger("factory.packaging")
TAGS_MAX_CHARS = 450


def _read(folder: Path, name: str) -> dict:
    return json.loads((folder / name).read_text(encoding="utf-8"))


def image_list(folder: Path, plan: dict) -> list[dict]:
    known = parse_sources(folder / "sources.txt") if (folder / "sources.txt").exists() else {}
    out = []
    for ref, file in (plan.get("images") or {}).items():
        rec = known.get(file, {})
        out.append({"ref": ref, "file": file, "title": rec.get("title", ""), "date": rec.get("date", "")})
    return out


def check_package(out: dict, refs: set[str]) -> list[str]:
    err = []
    if sum(len(t) for t in out.get("tags", [])) + 2 * len(out.get("tags", [])) > TAGS_MAX_CHARS:
        err.append(f"tags together must be at most {TAGS_MAX_CHARS} characters")
    for i, t in enumerate(out.get("thumbnails", []), 1):
        n = len(t.get("text", "").split())
        if not 2 <= n <= 4:
            err.append(f"thumbnail {i}: text must be 2–4 words")
        if t.get("image") not in (None, *refs):
            err.append(f"thumbnail {i}: image must be one of {sorted(refs)} or null")
    if len(set(out.get("titles", []))) < 3:
        err.append("three different titles are needed")
    return err


def write_texts(folder: Path, out: dict, script: dict, plan: dict) -> None:
    (folder / "title.txt").write_text("\n".join(out["titles"]) + "\n", encoding="utf-8")
    chs = json.loads((folder / "chapters.json").read_text(encoding="utf-8"))
    archives = sorted({i["ref"].split(":")[0] for i in image_list(folder, plan)})
    holders = {"commons": "Wikimedia Commons", "met": "The Metropolitan Museum of Art", "aic": "Art Institute of Chicago",
               "smithsonian": "Smithsonian", "rijksmuseum": "Rijksmuseum", "loc": "Library of Congress"}
    outline = folder / "outline.json"
    if outline.exists():
        text_sources = [s["title"] + (f" — {s['url']}" if s.get("url") else "") for s in json.loads(outline.read_text(encoding="utf-8"))["sources"]]
    else:
        text_sources = [s.split(" (")[0] for s in script.get("sources", [])]
    # описание — для англоязычных зрителей: служебные русские пометки не попадают
    text_sources = [re.sub(r"\s+—\s+[^—]*[А-Яа-яЁё].*$", "", s).strip() for s in text_sources]
    text_sources = [s for s in text_sources if s and not re.search(r"[А-Яа-яЁё]", s)]
    desc = (
        chapters.description_block(chs) + "\n" + out["description"].strip() + "\n\n"
        + "Sources:\n" + "\n".join(f"• {s}" for s in text_sources) + "\n"
        + ("Images: " + ", ".join(holders.get(a, a) for a in archives) + " (public domain / CC0). Maps: Natural Earth.\n" if archives else "")
        + "Narration: AI voice (Kokoro). Full list of sources and image licences: sources.txt\n"
    )
    (folder / "description.txt").write_text(desc, encoding="utf-8")
    (folder / "tags.txt").write_text(", ".join(t.strip() for t in out["tags"]) + "\n", encoding="utf-8")


def thumbnails(folder: Path, serve: Path, out: dict, plan: dict, style: str) -> list[str]:
    files = {i["ref"]: i["file"] for i in image_list(folder, plan)}
    work = folder / "work" / "thumbs"
    work.mkdir(parents=True, exist_ok=True)
    made = []
    for k, t in enumerate(out["thumbnails"], 1):
        image = None
        if t.get("image") in files:
            f = files[t["image"]]
            w, h = image_size(folder / "work" / "images" / f)
            image = {"src": f"job/{folder.name}/img/{f}", "width": w, "height": h}
        props = {"styleId": style, "text": t["text"], "kicker": t.get("kicker") or "", "image": image, "icon": t.get("icon") or "helmet", "side": t.get("side", "left"), "seed": k}
        p = work / f"thumbnail_{k}.json"
        p.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
        still(serve, "Thumbnail", p, folder / f"thumbnail_{k}.png")
        made.append(f"thumbnail_{k}.png")
    return made


def review(folder: Path, script: dict, board: dict, pkg: dict, shorts_report: list[dict]) -> dict:
    checks = _read(folder, "checks.json") if (folder / "checks.json").exists() else {"checks": []}
    facts = script.get("facts", [])
    types = Counter(s["shot"]["type"] for c in board["chapters"] for s in c["shots"])
    data = {
        "automatic_checks": [{"name": c["name"], "ok": c["ok"], "problems": c["problems"][:5]} for c in checks.get("checks", [])],
        "facts": {"total": len(facts), "by_status": dict(Counter(f.get("status") for f in facts)), "opened": sum(1 for f in facts if f.get("opened")),
                  "open_problems": script.get("open_problems", [])},
        "script": {"structure": script.get("structure"), "grade": textcheck.grade("\n".join(c["text"] for c in script["chapters"])),
                   "chapters": [c["title"] for c in script["chapters"]]},
        "storyboard": {"shots": sum(types.values()), "types": dict(types)},
        "packaging": {"titles": pkg["titles"], "description": (folder / "description.txt").read_text(encoding="utf-8")[:2500], "tags": pkg["tags"]},
        "shorts": shorts_report,
    }
    out = agents.run("quality-reviewer", "Review the finished video package in the input below.", data, schemas.REVIEW, folder=folder)
    (folder / "review.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return out


def package(folder: Path, parallel: int = 2) -> dict:
    folder = Path(folder).resolve()
    style = require_style_chosen(folder)
    settings = effective(load_settings(), json.loads((folder / "state.json").read_text(encoding="utf-8")).get("overrides"))
    script, board, plan = _read(folder, "script.json"), _read(folder, "storyboard.json"), _read(folder / "work", "plan.json")
    narration = _read(folder / "work", "narration.json")

    log.info("Упаковка: названия, описание, теги, обложки")
    imgs = image_list(folder, plan)
    data = {"title": script["title"], "logline": (json.loads((folder / "outline.json").read_text(encoding="utf-8")).get("logline") if (folder / "outline.json").exists() else ""),
            "chapters": [{"title": c["title"], "summary": c["text"][:300]} for c in script["chapters"]],
            "images": [{"ref": i["ref"], "title": i["title"], "date": i["date"]} for i in imgs], "icons": list(storyboard.ICONS)}
    refs = {i["ref"] for i in imgs}
    pkg = agents.run("packager", "Package the video in the input below.", data, schemas.PACKAGE, check=lambda o: check_package(o, refs), folder=folder)
    write_texts(folder, pkg, script, plan)

    log.info("Shorts: выбор отрывков")
    chs = {c["id"]: c for c in plan["chapters"]}
    from factory.pipeline import sentences_with_times

    sdata = {"title": script["title"], "count": 3 if len(script["chapters"]) <= 4 else 5,
             "chapters": [{"id": c["id"], "sentences": sentences_with_times(c["words"])} for c in plan["chapters"]],
             "rules": "hook + excerpt = 30–55 s; excerpt from one chapter; start/end copied exactly; no overlaps"}
    picked = agents.run("shorts-editor", "Pick the Shorts for the input below.", sdata, schemas.SHORTS, check=lambda o: shorts.check_answer(o, chs), folder=folder)
    (folder / "shorts.json").write_text(json.dumps(picked, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    serve = bundle(folder / "work" / "bundle")
    try:
        made = thumbnails(folder, serve, pkg, plan, style)
        log.info("Обложки: %s", ", ".join(made))
        jobs = shorts.build(folder, picked["shorts"], style, narration["engine"], voice_of(settings))
        shorts_report = shorts.render(folder, serve, jobs, parallel=parallel)
    finally:
        shutil.rmtree(folder / "work" / "bundle", ignore_errors=True)

    log.info("Итоговая проверка агентом")
    verdict = review(folder, script, board, pkg, shorts_report)
    log.info("Вердикт: %s. %s", verdict["verdict"], verdict["summary_ru"])
    return {"package": pkg, "shorts": shorts_report, "review": verdict}
