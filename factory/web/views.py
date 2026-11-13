"""Данные для веб-страницы: всё, что показывается владельцу, собирается из файлов папки видео.

Здесь только чтение. Решения владельца (выбор стиля, темы, «принять») — в app.py через pipeline.py.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from types import SimpleNamespace

from factory import pipeline, schemas, storyboard, structures
from factory.paths import ASSETS_DIR, CACHE_DIR, LOGS_DIR, OUTPUT_DIR, ROOT
from factory.settings import effective, load_settings, voice_of
from factory.styles import chosen_for_video, list_styles, style_of
from factory.tts.voices import VOICES

FPS = 30
SHEETS_DIR = ROOT / "video" / "out"
SHEET_KINDS = {"image": "Архивное изображение", "map": "Карта", "quote": "Цитата"}
IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff")
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,120}$")


class NotFound(LookupError):
    pass


# ---------------------------------------------------------------- папки видео

def video_dir(video_id: str) -> Path:
    """Папка видео по имени; только прямые подпапки output/ (никаких «..»)."""
    if not NAME_RE.match(video_id or "") or ".." in video_id:
        raise NotFound("Нет такого видео")
    folder = (OUTPUT_DIR / video_id).resolve()
    if folder.parent != OUTPUT_DIR.resolve() or not (folder / "state.json").exists():
        raise NotFound("Нет такого видео")
    return folder


def safe_file(folder: Path, rel: str) -> Path:
    """Файл внутри папки видео (для плеера и картинок)."""
    path = (folder / rel).resolve()
    if not path.is_relative_to(folder) or not path.is_file():
        raise NotFound("Нет такого файла")
    return path


def _json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return None


def _mtime(path: Path) -> int:
    try:
        return int(path.stat().st_mtime)
    except OSError:
        return 0


def style_name(style_id: str | None) -> str | None:
    return next((s.name_ru for s in list_styles() if s.id == style_id), None)


def step_list(state: dict) -> list[dict]:
    return [{"id": s, "name": pipeline.STEP_RU[s], "status": pipeline.step_status(state, s)} for s in pipeline.STEPS]


def video_title(folder: Path, state: dict) -> str:
    for name in ("script.json", "outline.json"):
        data = _json(folder / name)
        if data and data.get("title"):
            return data["title"]
    if (state.get("topic") or {}).get("title"):
        return state["topic"]["title"]
    hint = (state.get("brief") or {}).get("hint")
    return f"Новое видео: {hint}" if hint else "Новое видео (тема ещё не выбрана)"


def list_videos() -> list[dict]:
    out = []
    if not OUTPUT_DIR.exists():
        return out
    for st in OUTPUT_DIR.glob("*/state.json"):
        folder = st.parent
        state = _json(st) or {}
        nxt = pipeline.next_step(folder)
        out.append({
            "id": folder.name, "title": video_title(folder, state), "created": state.get("created", ""),
            "next": nxt, "next_name": pipeline.STEP_RU.get(nxt or "", "всё готово"),
            "next_status": pipeline.step_status(state, nxt) if nxt else "готово",
            "style": style_name(chosen_for_video(folder)), "cost": round(float(state.get("agents_cost_usd", 0)), 2),
            "has_video": (folder / "video.mp4").exists(), "thumb": "thumbnail_1.png" if (folder / "thumbnail_1.png").exists() else None,
        })
    out.sort(key=lambda v: (v["created"], v["id"]), reverse=True)
    return out


# ---------------------------------------------------------------- стили, голоса, настройки

def styles_view(current: str | None = None) -> dict:
    settings = load_settings()
    main_style = style_of(settings)
    sheets = []
    for kind, title in SHEET_KINDS.items():
        p = SHEETS_DIR / f"styles-{kind}.png"
        if p.exists():
            sheets.append({"kind": kind, "title": title, "url": f"/sheets/{kind}.png?v={_mtime(p)}"})
    return {
        "styles": [{"n": i, "id": s.id, "name": s.name_ru, "tagline": s.tagline_ru} for i, s in enumerate(list_styles(), 1)],
        "main": main_style, "main_chosen": settings.get("style") is not None,
        "current": current, "sheets": sheets,
    }


def voices_view() -> dict:
    samples = _json(ASSETS_DIR / "voices" / "samples.json") or {}
    by_id = {v["id"]: v for v in samples.get("voices", [])}
    settings = load_settings()
    voices = []
    for v in VOICES.values():
        s = by_id.get(v.id, {})
        voices.append({"id": v.id, "name": v.name, "label": v.label_ru, "wpm": s.get("words_per_minute"),
                       "sample": f"/voices/{s['file']}" if s.get("file") and (ASSETS_DIR / "voices" / s["file"]).exists() else None})
    return {"voices": voices, "current": voice_of(settings), "chosen": settings.get("voice") is not None, "sample_text": samples.get("text", "")}


def settings_view() -> dict:
    s = load_settings()
    env = _json(LOGS_DIR / "env_report.json")
    return {
        "voice": voices_view(), "voice_speed": s.get("voice_speed", 1.0), "styles": styles_view(),
        "smithsonian_key_set": bool((s.get("images") or {}).get("smithsonian_api_key")),
        "env_report": env, "subgenres": schemas.SUBGENRES,
    }


# ---------------------------------------------------------------- одно видео

def image_file(ref: str) -> Path | None:
    """Скачанная картинка из архива по ссылке «архив:id» (только из кэша, без интернета)."""
    if ":" not in (ref or ""):
        return None
    from factory.images.store import IMAGE_CACHE, safe_name

    archive, ident = ref.split(":", 1)
    if not re.fullmatch(r"[a-z]{2,12}", archive):
        return None
    base = safe_name(SimpleNamespace(archive=archive, id=ident))  # type: ignore[arg-type]
    for ext in IMAGE_EXT:
        p = IMAGE_CACHE / f"{base}{ext}"
        if p.exists():
            return p
    return None


def shot_label(shot: dict) -> str:
    for key in ("title", "heading", "quote", "caption", "text", "label"):
        v = shot.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    board = shot.get("board") or {}
    if board.get("title"):
        return board["title"]
    items = shot.get("items")
    if isinstance(items, list) and items and isinstance(items[0], dict):
        for key in ("label", "text", "name", "title"):
            if items[0].get(key):
                return str(items[0][key])
    return ""


def storyboard_view(folder: Path, board: dict) -> dict:
    narration = _json(folder / "work" / "narration.json")
    words = {c["id"]: c for c in (narration or {}).get("chapters", [])}
    titles = {c["id"]: c["title"] for c in (_json(folder / "script.json") or {}).get("chapters", [])}
    chapters = []
    for ch in board.get("chapters", []):
        timed = None
        n = words.get(ch["id"])
        if n:
            try:
                timed = storyboard.plan_chapter(n["words"], ch["shots"], n["frames"])
            except (ValueError, KeyError):
                timed = None
        offset = n["start_frame"] / FPS if n else 0
        shots = []
        for i, item in enumerate(ch["shots"]):
            shot = item["shot"]
            start = None
            if timed:
                start = offset + max(0, timed[i]["start"]) / FPS
            shots.append({
                "type": shot.get("type"), "at": item.get("at", ""), "transition": item.get("transition"),
                "label": shot_label(shot), "start": round(start, 1) if start is not None else None,
                "seconds": round(timed[i]["frames"] / FPS, 1) if timed else None,
                "images": [{"ref": r, "has": image_file(r) is not None} for r in storyboard.image_refs(shot)],
            })
        chapters.append({"id": ch["id"], "title": titles.get(ch["id"], ch["id"]), "shots": shots})
    return {"chapters": chapters, "summary_ru": board.get("summary_ru", "")}


def estimate_view(folder: Path) -> dict | None:
    """Оценка времени рендера по замеру скорости этого компьютера."""
    narration = _json(folder / "work" / "narration.json")
    if not narration:
        return None
    from factory.render.remotion import measured_speed

    frames = int(narration.get("total_frames", 0))
    speed = measured_speed()
    return {"video_seconds": round(frames / FPS, 1), "fps": round(speed, 1), "render_minutes": round(frames / max(0.1, speed) / 60), "measured": (CACHE_DIR / "render_speed.json").exists()}


def result_view(folder: Path) -> dict:
    shorts = []
    for mp4 in sorted((folder / "shorts").glob("short_*.mp4")):
        txt = _text(mp4.with_suffix(".txt")) or ""
        title = txt.split("\n", 1)[0].strip()
        shorts.append({"file": f"shorts/{mp4.name}", "title": title, "text": txt.strip()})
    files = [p.name for p in sorted(folder.iterdir()) if p.is_file() and p.name != "state.json"] if folder.exists() else []
    return {
        "video": "video.mp4" if (folder / "video.mp4").exists() else None,
        "video_mb": round((folder / "video.mp4").stat().st_size / 1024**2, 1) if (folder / "video.mp4").exists() else None,
        "checks": _json(folder / "checks.json"),
        "chapters": _json(folder / "chapters.json"),
        "titles": [t for t in (_text(folder / "title.txt") or "").splitlines() if t.strip()],
        "description": _text(folder / "description.txt"), "tags": (_text(folder / "tags.txt") or "").strip(),
        "thumbnails": [f"thumbnail_{k}.png" for k in (1, 2, 3) if (folder / f"thumbnail_{k}.png").exists()],
        "shorts": shorts, "review": _json(folder / "review.json"), "files": files,
    }


def video_view(folder: Path) -> dict:
    state = pipeline.read_state(folder)
    settings = effective(load_settings(), state.get("overrides"))
    style = chosen_for_video(folder)
    nxt = pipeline.next_step(folder)
    data: dict = {}
    topics = _json(folder / "topics.json")
    if topics:
        data["topics"] = topics
    if state.get("topic"):
        data["topic"] = state["topic"]
    for name in ("outline", "script", "facts"):
        v = _json(folder / f"{name}.json")
        if v:
            data[name] = v
    if data.get("outline", {}).get("structure"):
        data["structure_name"] = structures.name_ru(data["outline"]["structure"])
    if "script" in data:
        data["script_words"] = {c["id"]: len(c["text"].split()) for c in data["script"].get("chapters", [])}
        try:
            data["words_target"] = pipeline.words_target(folder)
        except (ValueError, KeyError):
            pass
    board = _json(folder / "storyboard.json")
    if board:
        data["storyboard"] = storyboard_view(folder, board)
    if (folder / "work" / "narration.wav").exists():
        data["narration"] = {"file": "work/narration.wav", "v": _mtime(folder / "work" / "narration.wav"),
                             **{k: (_json(folder / "work" / "narration.json") or {}).get(k) for k in ("engine", "voice", "words", "total_frames", "warnings")}}
    data["production"] = state.get("production")
    data["estimate"] = estimate_view(folder)
    data["result"] = result_view(folder)
    return {
        "id": folder.name, "title": video_title(folder, state), "created": state.get("created", ""),
        "brief": state.get("brief", {}), "subgenre_name": schemas.SUBGENRES.get((state.get("brief") or {}).get("subgenre", ""), "любое"),
        "steps": step_list(state), "next": nxt, "style": style, "style_name": style_name(style),
        "voice": voice_of(settings), "cost": round(float(state.get("agents_cost_usd", 0)), 2),
        "step_info": {k: v for k, v in (state.get("steps") or {}).items()},
        "data": data, "folder": str(folder), "updated": time.strftime("%H:%M:%S"),
    }
