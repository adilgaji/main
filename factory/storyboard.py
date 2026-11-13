"""Раскадровка: проверка по правилам проекта и раскладка кадров по времени озвучки.

Входные файлы видео:
  script.json      {"title", "chapters": [{"id", "title", "text"}], "sources": [...]}
  storyboard.json  {"chapters": [{"id", "shots": [{"at", "transition", "shot": {...}}]}]}

«at» — первые слова фразы, с которой начинается кадр (у первого кадра главы — пусто).
Так кадр привязан к конкретным словам озвучки, а его время берётся из реальной записи.
Картинки из архивов указываются ссылкой «архив:id» в поле image (см. factory/images).
"""
from __future__ import annotations

import re
from typing import Any

from factory.images.archives import ARCHIVES

FPS = 30
SHOT_TYPES = ("map", "timeline", "kenburns", "quote", "infographic", "narrator", "compare", "diagram", "scene")
# Переход в кадр: сколько кадров длится (половина — до границы, половина — после).
TRANSITIONS = {"cut": 0, "fade": 12, "slide": 14, "wipe": 14, "zoom": 12}
BACKDROPS = ("ink", "parchment", "stone", "dusk", "vault")
ICONS = (
    "hoplite", "soldier", "shield", "helmet", "spear", "ship", "tent", "tree", "column", "temple",
    "wall", "rock", "fire", "banner", "pyramid", "house", "amphora", "scroll", "crown", "coin",
)
POSES = ("idle", "explain", "point", "think", "surprise", "welcome")
EMOTIONS = ("neutral", "smile", "serious", "surprised", "concerned", "curious")
SCENE_SETTINGS = ("plain", "coast", "pass", "sea")
CHAPTER_IN, CHAPTER_OUT = 10, 8  # проявление из фона в начале главы и уход в фон в конце, кадры

SHOT_MIN, SHOT_MAX = 2.0, 10.0  # секунды: жёсткие границы длины кадра
SHOT_GOOD = (4.0, 8.0)  # желательная длина (правило «смена картинки каждые 4–8 секунд»)

# Наибольшая длина надписей, чтобы текст не выходил за кадр.
TEXT_LIMITS = {
    "title": 48, "subtitle": 84, "caption": 84, "heading": 40, "kicker": 44, "note": 84, "source": 96,
    "credit": 110, "author": 72, "label": 48, "sub": 40, "name": 30,
}
QUOTE_MAX = 230


def word_key(word: str) -> str:
    """Слово для сравнения: без знаков препинания и регистра."""
    return re.sub(r"[^0-9a-zà-ÿ]+", "", word.lower())


def find_anchor(words: list[str], phrase: str, after: int) -> int | None:
    """Номер слова, с которого начинается фраза (ищется дальше позиции after)."""
    want = [k for k in (word_key(w) for w in phrase.split()) if k]
    if not want:
        return None
    keys = [word_key(w) for w in words]
    for i in range(max(after, 0), len(keys)):
        j, k = i, 0
        while j < len(keys) and k < len(want):
            if not keys[j]:  # отдельно стоящее тире
                j += 1
                continue
            if keys[j] != want[k]:
                break
            j, k = j + 1, k + 1
        if k == len(want) and keys[i]:
            return i
    return None


def _walk_strings(node: Any, key: str = ""):
    if isinstance(node, dict):
        for k, v in node.items():
            yield from _walk_strings(v, k)
    elif isinstance(node, list):
        for v in node:
            yield from _walk_strings(v, key)
    elif isinstance(node, str):
        yield key, node


def image_refs(shot: dict) -> list[str]:
    """Ссылки на архивные изображения в одном кадре."""
    refs = [shot["image"]] if isinstance(shot.get("image"), str) else []
    for side in ("left", "right"):
        if isinstance(shot.get(side), dict) and isinstance(shot[side].get("image"), str):
            refs.append(shot[side]["image"])
    return refs


def all_image_refs(storyboard: dict) -> list[str]:
    out: list[str] = []
    for ch in storyboard.get("chapters", []):
        for item in ch.get("shots", []):
            for ref in image_refs(item.get("shot") or {}):
                if ref not in out:
                    out.append(ref)
    return out


def _check_shot(shot: dict, where: str) -> list[str]:
    err: list[str] = []
    kind = shot.get("type")
    if kind not in SHOT_TYPES:
        return [f"{where}: неизвестный тип кадра «{kind}». Доступные: {', '.join(SHOT_TYPES)}"]

    def need(*keys: str) -> None:
        for k in keys:
            if shot.get(k) in (None, "", [], {}):
                err.append(f"{where} ({kind}): нет обязательного поля «{k}»")

    if "src" in shot or any("src" in (shot.get(s) or {}) for s in ("left", "right") if isinstance(shot.get(s), dict)):
        err.append(f"{where}: поле «src» запрещено — картинка задаётся ссылкой на архив в поле «image» (иначе у неё не будет лицензии)")
    for ref in image_refs(shot):
        name, _, id_ = ref.partition(":")
        if name not in ARCHIVES or not id_:
            err.append(f"{where}: ссылка на изображение «{ref}» — нужен вид «архив:id», архивы: {', '.join(ARCHIVES)}")
    for key, text in _walk_strings(shot):
        limit = QUOTE_MAX if (kind == "quote" and key == "text") else TEXT_LIMITS.get(key)
        if limit and len(text) > limit:
            err.append(f"{where}: надпись «{key}» длиннее {limit} знаков ({len(text)}): «{text[:40]}…»")
    if shot.get("backdrop") not in (None, *BACKDROPS):
        err.append(f"{where}: фон «{shot.get('backdrop')}» не существует. Доступные: {', '.join(BACKDROPS)}")

    if kind == "map":
        need("view")
        if not (isinstance(shot.get("view"), list) and len(shot["view"]) == 4):
            err.append(f"{where} (map): view — четыре числа [запад, юг, восток, север]")
    elif kind == "timeline":
        need("events")
        if not (isinstance(shot.get("from"), (int, float)) and isinstance(shot.get("to"), (int, float)) and shot["from"] < shot["to"]):
            err.append(f"{where} (timeline): нужны годы from < to")
        elif any(not (shot["from"] <= e.get("year", 1e9) <= shot["to"]) for e in shot.get("events") or []):
            err.append(f"{where} (timeline): год события вне отрезка from…to")
    elif kind == "kenburns":
        need("image")
    elif kind == "quote":
        need("text", "author")
    elif kind == "infographic":
        need("variant", "items")
        n = len(shot.get("items") or [])
        ok = {"areas": n == 2, "bars": 2 <= n <= 5, "number": n == 1}.get(shot.get("variant"))
        if ok is None:
            err.append(f"{where} (infographic): variant — areas, bars или number")
        elif not ok:
            err.append(f"{where} (infographic): для «{shot['variant']}» неверное число значений ({n})")
    elif kind == "narrator":
        for beat in shot.get("beats") or [{"pose": shot.get("pose", "idle"), "emotion": shot.get("emotion", "neutral")}]:
            if beat.get("pose", "idle") not in POSES or beat.get("emotion", "neutral") not in EMOTIONS:
                err.append(f"{where} (narrator): неизвестная поза или эмоция: {beat}")
        if len((shot.get("board") or {}).get("lines") or []) > 3:
            err.append(f"{where} (narrator): на доске не больше трёх строк")
    elif kind == "compare":
        need("left", "right")
        for side in ("left", "right"):
            s = shot.get(side) or {}
            if not s.get("label"):
                err.append(f"{where} (compare): у половины «{side}» нет метки label")
            if not s.get("image") and s.get("icon") not in ICONS:
                err.append(f"{where} (compare): половине «{side}» нужна картинка (image) или значок (icon) — иначе она пустая")
            if len(s.get("lines") or []) > 3 or any(len(x) > 64 for x in s.get("lines") or []):
                err.append(f"{where} (compare): в половине «{side}» не больше трёх строк по 64 знака")
    elif kind == "diagram":
        need("nodes")
        nodes = shot.get("nodes") or []
        ids = [n.get("id") for n in nodes]
        if len(nodes) > 8 or len(set(ids)) != len(ids):
            err.append(f"{where} (diagram): блоков не больше 8, id не повторяются")
        if any(not (0 <= n.get("col", -1) <= 3 and 0 <= n.get("row", -1) <= 2) for n in nodes):
            err.append(f"{where} (diagram): блок вне сетки (col 0…3, row 0…2)")
        if len({(n.get("col"), n.get("row")) for n in nodes}) != len(nodes):
            err.append(f"{where} (diagram): два блока в одной клетке")
        if any(len(str(n.get("label", ""))) > 26 for n in nodes):
            err.append(f"{where} (diagram): название блока длиннее 26 знаков")
        for link in shot.get("links") or []:
            if link.get("from") not in ids or link.get("to") not in ids:
                err.append(f"{where} (diagram): стрелка ссылается на несуществующий блок: {link.get('from')} → {link.get('to')}")
    elif kind == "scene":
        need("setting", "items")
        if shot.get("setting") not in SCENE_SETTINGS:
            err.append(f"{where} (scene): setting — одно из: {', '.join(SCENE_SETTINGS)}")
        if shot.get("time") not in (None, "day", "dusk", "night"):
            err.append(f"{where} (scene): time — day, dusk или night")
        for it in shot.get("items") or []:
            if it.get("icon") not in ICONS:
                err.append(f"{where} (scene): нет значка «{it.get('icon')}». Доступные: {', '.join(ICONS)}")
            elif not (0 <= it.get("x", -1) <= 1920 and 300 <= it.get("y", -1) <= 1080 and 40 <= it.get("size", 0) <= 700):
                err.append(f"{where} (scene): значок «{it['icon']}» вне кадра или неверного размера (x 0…1920, y 300…1080, size 40…700)")
        if max((it.get("size", 0) for it in shot.get("items") or []), default=0) < 200:
            err.append(f"{where} (scene): нет крупного главного объекта (нужен значок высотой от 200)")
    return err


def validate(script: dict, storyboard: dict) -> list[str]:
    """Проверяет текст и раскадровку. Возвращает список ошибок на русском (пустой — всё в порядке)."""
    err: list[str] = []
    chapters = script.get("chapters") or []
    if not script.get("title"):
        err.append("script.json: нет названия видео (title)")
    if len(chapters) < 3:
        err.append(f"script.json: глав {len(chapters)}, а нужно не меньше трёх")
    ids = [c.get("id") for c in chapters]
    if len(set(ids)) != len(ids) or not all(ids):
        err.append("script.json: у каждой главы должен быть свой id")
    for c in chapters:
        title = str(c.get("title") or "")
        if not title or len(title) > 40:
            err.append(f"глава {c.get('id')}: название должно быть от 1 до 40 знаков (сейчас {len(title)})")
        if not str(c.get("text") or "").strip():
            err.append(f"глава {c.get('id')}: нет текста")
    sb = {c.get("id"): c for c in storyboard.get("chapters") or []}
    if list(sb) != ids:
        err.append(f"storyboard.json: главы {list(sb)} не совпадают с главами текста {ids}")
        return err

    from factory.tts.text import normalize

    prev: dict | None = None
    prev_where = ""
    for c in chapters:
        shots = sb[c["id"]].get("shots") or []
        if not shots:
            err.append(f"глава {c['id']}: в раскадровке нет кадров")
            continue
        words = normalize(str(c.get("text") or "")).split()
        last = 0
        for i, item in enumerate(shots):
            where = f"глава {c['id']}, кадр {i + 1}"
            shot = item.get("shot") or {}
            err.extend(_check_shot(shot, where))
            if item.get("transition") not in (None, *TRANSITIONS):
                err.append(f"{where}: переход «{item.get('transition')}» не существует. Доступные: {', '.join(TRANSITIONS)}")
            at = str(item.get("at") or "").strip()
            if i == 0:
                if at and find_anchor(words, at, 0) != 0:
                    err.append(f"{where}: первый кадр главы начинается с её первого слова — поле «at» оставьте пустым")
            else:
                pos = find_anchor(words, at, last + 1) if at else None
                if pos is None:
                    err.append(f"{where}: фраза «{at}» не найдена в тексте главы после начала предыдущего кадра")
                else:
                    last = pos
            if prev is not None:
                if prev.get("type") == shot.get("type"):
                    err.append(f"{where}: тип кадра «{shot.get('type')}» тот же, что у предыдущего ({prev_where}) — соседние кадры должны отличаться")
                if shot.get("backdrop") and prev.get("backdrop") == shot.get("backdrop"):
                    err.append(f"{where}: фон «{shot['backdrop']}» тот же, что у предыдущего кадра")
                if set(image_refs(prev)) & set(image_refs(shot)):
                    err.append(f"{where}: то же изображение, что и в предыдущем кадре")
            prev, prev_where = shot, where
    return err


def anchors(words: list[str], shots: list[dict]) -> list[int]:
    """Номера слов, с которых начинаются кадры главы (раскадровка уже проверена)."""
    out = [0]
    for item in shots[1:]:
        pos = find_anchor(words, str(item.get("at") or ""), out[-1] + 1)
        if pos is None:
            raise ValueError(f"Фраза «{item.get('at')}» не найдена в тексте главы")
        out.append(pos)
    return out


def plan_chapter(words: list[dict], shots: list[dict], total_frames: int, fps: int = FPS) -> list[dict]:
    """Раскладывает кадры главы по времени.

    words — слова главы со временем (секунды от начала главы). Граница между кадрами —
    середина паузы перед первым словом нового кадра. Переход занимает несколько кадров
    по обе стороны границы: новый кадр начинается чуть раньше и ложится поверх старого.
    Возвращает список {start, frames, shot, enter, exit, nominal: [с, по]} в кадрах.
    """
    idx = anchors([w["text"] for w in words], shots)
    bounds = [0]
    for a in idx[1:]:
        mid = (words[a - 1]["end"] + words[a]["start"]) / 2
        bounds.append(max(bounds[-1] + 1, min(total_frames - 1, round(mid * fps))))
    bounds.append(total_frames)
    lengths = [bounds[i + 1] - bounds[i] for i in range(len(shots))]

    kinds, pre = ["cut"], [0]
    for i in range(1, len(shots)):
        kind = shots[i].get("transition") or "fade"
        half = min(TRANSITIONS[kind] // 2, lengths[i - 1] // 4, lengths[i] // 4)
        kinds.append(kind if half > 0 else "cut")
        pre.append(half)
    pre.append(0)

    out = []
    for i, item in enumerate(shots):
        start = bounds[i] - pre[i]
        end = bounds[i + 1] + pre[i + 1]
        last = i == len(shots) - 1
        enter = {"kind": "dip", "frames": min(CHAPTER_IN, lengths[i] // 3)} if i == 0 else {"kind": kinds[i], "frames": pre[i] * 2}
        exit_ = {"kind": "dip", "frames": min(CHAPTER_OUT, lengths[i] // 3)} if last else {"kind": kinds[i + 1], "frames": pre[i + 1] * 2}
        shot = dict(item["shot"])
        if shot["type"] == "narrator":
            # губы рассказчика двигаются по словам этого кадра (время — от начала кадра на экране)
            a, b = idx[i], idx[i + 1] if i + 1 < len(idx) else len(words)
            shot["speech"] = [
                {"start": round(w["start"] - start / fps, 3), "end": round(w["end"] - start / fps, 3)}
                for w in words[a:b] if any(ch.isalnum() for ch in w["text"])
            ]
        out.append({"start": start, "frames": end - start, "shot": shot, "enter": enter, "exit": exit_, "nominal": [bounds[i], bounds[i + 1]]})
    return out


def duration_problems(timed: list[dict], chapter_id: str, fps: int = FPS) -> tuple[list[str], list[str]]:
    """(ошибки, замечания) о длине кадров: жёсткие границы 2–10 с, желательные 4–8 с."""
    errors, notes = [], []
    for i, t in enumerate(timed):
        sec = (t["nominal"][1] - t["nominal"][0]) / fps
        where = f"глава {chapter_id}, кадр {i + 1} ({t['shot']['type']})"
        if sec < SHOT_MIN or sec > SHOT_MAX:
            errors.append(f"{where}: длится {sec:.1f} с — допустимо от {SHOT_MIN:.0f} до {SHOT_MAX:.0f} с")
        elif not (SHOT_GOOD[0] <= sec <= SHOT_GOOD[1]):
            notes.append(f"{where}: {sec:.1f} с (желательно 4–8 с)")
    return errors, notes


def apply_images(shot: dict, prepared: dict[str, dict], prefix: str) -> dict:
    """Заменяет ссылки «архив:id» на файл, размер и подпись с лицензией.

    prepared: {ссылка: {"file", "width", "height", "credit"}}; prefix — папка внутри video/public.
    """
    def fill(node: dict) -> dict:
        ref = node.get("image")
        if not isinstance(ref, str):
            return node
        p = prepared[ref]
        node = {k: v for k, v in node.items() if k != "image"}
        node.update(src=f"{prefix}/{p['file']}", width=p["width"], height=p["height"])
        node.setdefault("credit", p["credit"])
        return node

    shot = fill(dict(shot))
    for side in ("left", "right"):
        if isinstance(shot.get(side), dict):
            shot[side] = fill(dict(shot[side]))
    return shot
