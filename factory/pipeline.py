"""Сценарий работы над одним видео: шаги и решения владельца (state.json).

    стиль → тема → план → текст → раскадровка → производство → упаковка

Каждый шаг (кроме «Производства») готовит результат и ЖДЁТ решения владельца:
«принять» или «переделать» (с пожеланием). Агенты вопросов не задают.

    python -m factory.pipeline new --subgenre wars --hint "Spartans" [--minutes 8.5] [--chapters 5-7]
    python -m factory.pipeline status <папка>
    python -m factory.pipeline run <папка> <шаг> [--note "пожелание"]     # topic|outline|script|storyboard|production|package
    python -m factory.pipeline pick <папка> <номер темы>
    python -m factory.pipeline approve <папка> <шаг>
    python -m factory.pipeline next <папка>                                # следующий шаг, если предыдущий принят
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import time
from pathlib import Path

from factory import agents, production, schemas, storyboard, structures, textcheck
from factory.console import setup_console
from factory.paths import OUTPUT_DIR, ROOT
from factory.settings import effective, load_settings, voice_of
from factory.styles import chosen_for_video

log = logging.getLogger("factory.pipeline")

STEPS = ["style", "topic", "outline", "script", "storyboard", "production", "package"]
STEP_RU = {
    "style": "Стиль", "topic": "Тема", "outline": "План", "script": "Текст и проверка фактов",
    "storyboard": "Озвучка и раскадровка", "production": "Производство", "package": "Упаковка и Shorts",
}
WAITING, ACCEPTED, DONE, FAILED = "ждёт решения", "принято", "готово", "ошибка"


class PipelineError(RuntimeError):
    pass


# ---------------------------------------------------------------- состояние

def read_state(folder: Path) -> dict:
    p = folder / "state.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def write_state(folder: Path, state: dict) -> None:
    (folder / "state.json").write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def set_step(folder: Path, step: str, status: str, **extra) -> None:
    state = read_state(folder)
    state.setdefault("steps", {})[step] = {"status": status, "at": time.strftime("%Y-%m-%d %H:%M:%S"), **extra}
    write_state(folder, state)


def step_status(state: dict, step: str) -> str:
    if step == "style":
        return ACCEPTED if (state.get("overrides") or {}).get("style") else "нет"
    return (state.get("steps") or {}).get(step, {}).get("status", "нет")


def require(folder: Path, step: str) -> None:
    """Ворота: шаг можно запускать, только если предыдущий принят владельцем."""
    i = STEPS.index(step)
    prev = STEPS[i - 1]
    st = step_status(read_state(folder), prev)
    if st not in (ACCEPTED, DONE):
        raise PipelineError(f"Сначала нужен шаг «{STEP_RU[prev]}» с решением владельца (сейчас: {st}).")


def _read(folder: Path, name: str) -> dict:
    p = folder / name
    if not p.exists():
        raise PipelineError(f"Нет файла {name}")
    return json.loads(p.read_text(encoding="utf-8"))


def _write(folder: Path, name: str, data: dict) -> None:
    (folder / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def slug(text: str, n: int = 40) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return s[:n].rstrip("_") or "video"


def _settings(folder: Path) -> dict:
    return effective(load_settings(), read_state(folder).get("overrides"))


def _brief(folder: Path) -> dict:
    return read_state(folder).get("brief", {})


def _note(folder: Path, step: str) -> str:
    return (read_state(folder).get("steps", {}).get(step) or {}).get("note", "")


# ---------------------------------------------------------------- новое видео

def new_video(subgenre: str = "any", hint: str = "", minutes: float = 8.5, chapters: tuple[int, int] = (5, 7)) -> Path:
    if subgenre != "any" and subgenre not in schemas.SUBGENRES:
        raise PipelineError(f"Поднаправление: any или {', '.join(schemas.SUBGENRES)}")
    base = f"{time.strftime('%Y-%m-%d')}_{slug(hint) if hint else 'video'}"
    folder = OUTPUT_DIR / base
    k = 2
    while folder.exists():
        folder = OUTPUT_DIR / f"{base}_{k}"
        k += 1
    folder.mkdir(parents=True)
    write_state(folder, {"created": time.strftime("%Y-%m-%d %H:%M:%S"), "brief": {"subgenre": subgenre, "hint": hint, "minutes": minutes, "chapters": list(chapters)}, "steps": {}})
    return folder


# ---------------------------------------------------------------- 1. тема

def recent_topics(limit: int = 30) -> list[str]:
    out = []
    for st in sorted(OUTPUT_DIR.glob("*/state.json"), reverse=True)[:limit]:
        t = (json.loads(st.read_text(encoding="utf-8")).get("topic") or {}).get("title")
        if t:
            out.append(t)
    return out


def step_topic(folder: Path) -> dict:
    b = _brief(folder)
    data = {"subgenre": b.get("subgenre", "any"), "hint": b.get("hint", ""), "recent_topics": recent_topics(), "count": 5, "owner_note": _note(folder, "topic")}
    out = agents.run("idea-researcher", "Propose history video topics for the input below.", data, schemas.TOPICS, folder=folder)
    _write(folder, "topics.json", out)
    return out


def pick_topic(folder: Path, number: int) -> Path:
    topics = _read(folder, "topics.json")["topics"]
    if not 1 <= number <= len(topics):
        raise PipelineError(f"Номер темы — от 1 до {len(topics)}")
    state = read_state(folder)
    state["topic"] = topics[number - 1]
    state.setdefault("steps", {})["topic"] = {"status": ACCEPTED, "at": time.strftime("%Y-%m-%d %H:%M:%S"), "picked": number}
    write_state(folder, state)
    # папка получает имя по теме: output/<дата>_<тема>
    target = folder.parent / f"{folder.name[:10]}_{slug(topics[number - 1]['title'])}"
    if target != folder and not target.exists():
        folder = folder.rename(target)
    return folder


# ---------------------------------------------------------------- 2. план

def _chapters_range(folder: Path) -> tuple[int, int]:
    a, b = _brief(folder).get("chapters", [5, 7])
    return int(a), int(b)


def words_target(folder: Path) -> int:
    return textcheck.words_target(float(_brief(folder).get("minutes", 8.5)), voice_of(_settings(folder)))


def check_outline(out: dict, allowed: list[str], lo: int, hi: int, target: int, min_sources: int) -> list[str]:
    err = []
    ch = out.get("chapters", [])
    if not lo <= len(ch) <= hi:
        err.append(f"there must be {lo}–{hi} chapters, not {len(ch)}")
    if [c.get("id") for c in ch] != [f"c{i + 1}" for i in range(len(ch))]:
        err.append("chapter ids must be c1, c2, c3 … in order")
    if out.get("structure") not in allowed:
        err.append(f"structure must be one of: {', '.join(allowed)}")
    total = sum(int(c.get("est_words", 0)) for c in ch)
    if not 0.8 * target <= total <= 1.2 * target:
        err.append(f"est_words add up to {total}, they must add up to about {target}")
    if len(out.get("sources", [])) < min_sources:
        err.append(f"at least {min_sources} reliable sources are needed")
    return err


def step_outline(folder: Path) -> dict:
    require(folder, "outline")
    state = read_state(folder)
    lo, hi = _chapters_range(folder)
    target = words_target(folder)
    allowed = structures.allowed()
    data = {
        "topic": state["topic"], "subgenre": state["topic"].get("subgenre"), "structures": allowed,
        "minutes": _brief(folder).get("minutes", 8.5), "words_target": target, "chapters": {"min": lo, "max": hi},
        "owner_note": _note(folder, "outline"),
    }
    ids = [s["id"] for s in allowed]
    min_sources = 3 if hi >= 5 else 2
    out = agents.run("outline-writer", "Write the outline for the input below.", data, schemas.OUTLINE,
                     check=lambda o: check_outline(o, ids, lo, hi, target, min_sources), folder=folder)
    _write(folder, "outline.json", out)
    return out


# ---------------------------------------------------------------- 3. текст + проверка фактов

def check_script_answer(out: dict, outline: dict, target: int) -> list[str]:
    ids = [c["id"] for c in outline["chapters"]]
    err = []
    if [c.get("id") for c in out.get("chapters", [])] != ids:
        err.append(f"chapters must be exactly {ids} in this order")
    e, _ = textcheck.check_script(out.get("chapters", []), target)
    return err + e


def guessed_names(chapters: list[dict], voice: str) -> list[dict]:
    """Имена, которые Kokoro читает наугад (нет ни в его словаре, ни в нашем)."""
    from factory.tts import pronunciation as pron
    from factory.tts.kokoro_engine import get_engine
    from factory.tts.voices import accent_of, lang_of

    try:
        g2p = get_engine().g2p(lang_of(voice))
    except Exception as e:  # noqa: BLE001
        log.warning("Проверка произношения пропущена: %s", e)
        return []
    items = pron.audit("\n".join(c["text"] for c in chapters), accent_of(voice), g2p)
    return [{"word": i["word"], "kokoro_guess": i["phonemes"]} for i in items if i["proper_noun"]]


def check_facts(out: dict, chapters: list[dict]) -> list[str]:
    from factory.tts import pronunciation as pron

    err = []
    have = {f.get("chapter") for f in out.get("facts", [])}
    for c in chapters:
        if c["id"] not in have:
            err.append(f"chapter {c['id']} has no facts listed")
    for p in out.get("pronunciations", []):
        for accent in ("us", "gb"):
            bad = pron.check_phonemes(p.get(accent, ""), accent)
            if bad:
                err.append(f"pronunciation of {p.get('word')} ({accent}): {'; '.join(bad)}")
    return err


def save_pronunciations(items: list[dict]) -> list[str]:
    from factory.tts import pronunciation as pron

    saved = []
    for p in items:
        word = str(p.get("word", "")).strip()
        # ключ словаря — одно слово из букв; формы вроде «Ekirch's» Kokoro читает сам по основе
        if not word.isalpha() or pron.check_phonemes(p["us"], "us") or pron.check_phonemes(p["gb"], "gb"):
            continue
        try:
            pron.save_entry(word, p["us"], p["gb"], say=p.get("say", ""), note="added by fact-checker")
        except ValueError as e:
            log.warning("Произношение «%s» не сохранено: %s", word, e)
            continue
        saved.append(word)
    return saved


def _fact_check(folder: Path, text: dict, outline: dict, voice: str) -> dict:
    names = guessed_names(text["chapters"], voice)
    fdata = {"chapters": [{"id": c["id"], "text": c["text"]} for c in text["chapters"]], "sources": outline["sources"],
             "max_pages": 12 if len(text["chapters"]) >= 5 else 8, "guessed_names": names}
    facts = agents.run("fact-checker", "Check the script in the input below.", fdata, schemas.FACTS,
                       check=lambda o: check_facts(o, text["chapters"]), folder=folder)
    added = save_pronunciations(facts.get("pronunciations", []))
    if added:
        log.info("В словарь произношений добавлено: %s", ", ".join(added))
    return facts


def step_script(folder: Path) -> dict:
    require(folder, "script")
    outline = _read(folder, "outline.json")
    target = words_target(folder)
    voice = voice_of(_settings(folder))
    per = [round(target * c["est_words"] / max(1, sum(x["est_words"] for x in outline["chapters"]))) for c in outline["chapters"]]
    data = {"outline": {k: outline[k] for k in ("title", "logline", "hook", "chapters")}, "sources": outline["sources"],
            "words_target": target, "words_per_chapter": dict(zip([c["id"] for c in outline["chapters"]], per)), "owner_note": _note(folder, "script")}
    chk = lambda o: check_script_answer(o, outline, target)  # noqa: E731
    # Продолжение после сбоя: сохраняется текст, номер круга и результат проверки —
    # повторный запуск не заказывает заново то, что уже сделано.
    ckpt = folder / "work" / "script_checkpoint.json"
    key = json.dumps([outline, data["owner_note"], target], ensure_ascii=False, sort_keys=True)
    st = json.loads(ckpt.read_text(encoding="utf-8")) if ckpt.exists() else {}

    def save(x: dict) -> None:
        ckpt.parent.mkdir(parents=True, exist_ok=True)
        ckpt.write_text(json.dumps(x, ensure_ascii=False), encoding="utf-8")

    if st.get("key") == key:
        log.info("Продолжаю с сохранённого: круг %d, проверка фактов %s.", st["round"], "готова" if st.get("facts") else "ещё не сделана")
    else:
        st = {"key": key, "round": 1, "facts": None,
              "text": agents.run("scriptwriter", "Write the voice-over for the input below.", data, schemas.SCRIPT, check=chk, folder=folder)}
        save(st)
    while True:
        if not st.get("facts"):
            st["facts"] = _fact_check(folder, st["text"], outline, voice)
            save(st)
        if not st["facts"]["problems"] or st["round"] >= 2:
            break
        log.info("Проверка фактов нашла %d мест для исправления — сценарист исправляет.", len(st["facts"]["problems"]))
        fix = {**data, "current": st["text"]["chapters"], "problems": st["facts"]["problems"]}
        st = {"key": key, "round": 2, "facts": None,
              "text": agents.run("scriptwriter", "Fix the voice-over in the input below (fix mode).", fix, schemas.SCRIPT, check=chk, folder=folder)}
        save(st)
    text, facts = st["text"], st["facts"]
    ckpt.unlink(missing_ok=True)

    return _save_script(folder, outline, text, facts)


def _save_script(folder: Path, outline: dict, text: dict, facts: dict) -> dict:
    script = {
        "title": outline["title"], "structure": outline["structure"], "subgenre": read_state(folder)["topic"].get("subgenre"),
        "chapters": [{"id": c["id"], "title": c["title"], "text": c["text"].strip()} for c in text["chapters"]],
        "sources": [f"{s['title']}" + (f" — {s['url']}" if s.get("url") else "") + (" (открыт агентом)" if s.get("opened") else " (не открыт: сверить с ноутбука)") for s in outline["sources"]],
        "facts": facts.get("facts", []), "open_problems": facts.get("problems", []),
        "notes_ru": text.get("notes_ru", ""), "facts_summary_ru": facts.get("summary_ru", ""),
    }
    _write(folder, "script.json", script)
    _write(folder, "facts.json", facts)
    (folder / "script.txt").write_text(f"{script['title']}\n\n" + "\n\n".join(f"## {c['title']}\n{c['text']}" for c in script["chapters"]) + "\n", encoding="utf-8")
    return script


def fix_script(folder: Path, note: str = "", recheck: bool = True) -> dict:
    """Маленький вызов: исправить только оставшиеся замечания проверки (и пожелание владельца), затем проверить снова.
    recheck=False — без повторной проверки фактов (когда правки только смягчают или убирают утверждения)."""
    folder = Path(folder).resolve()
    script, outline = _read(folder, "script.json"), _read(folder, "outline.json")
    problems = list(script.get("open_problems", []))
    if note:
        problems.append({"chapter": "all", "quote": "", "issue": "the owner asks", "fix": note})
    if not problems:
        raise PipelineError("Замечаний нет — исправлять нечего.")
    target = words_target(folder)
    data = {"outline": {k: outline[k] for k in ("title", "logline", "hook", "chapters")}, "sources": outline["sources"], "words_target": target,
            "current": [{"id": c["id"], "title": c["title"], "text": c["text"]} for c in script["chapters"]], "problems": problems}
    text = agents.run("scriptwriter", "Fix the voice-over in the input below (fix mode): change only what the problems require.", data, schemas.SCRIPT,
                      check=lambda o: check_script_answer(o, outline, target), folder=folder)
    if recheck:
        facts = _fact_check(folder, text, outline, voice_of(_settings(folder)))
    else:
        facts = {**_read(folder, "facts.json"), "problems": []}
        facts["summary_ru"] = (facts.get("summary_ru", "") + " Последние замечания исправлены без повторной проверки (правки только смягчали или убирали утверждения).").strip()
    out = _save_script(folder, outline, text, facts)
    set_step(folder, "script", WAITING, note=note)
    return out


# ---------------------------------------------------------------- 4. озвучка + раскадровка

def sentences_with_times(words: list[dict]) -> list[dict]:
    out, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r"[.!?…][\"”')]?$", w["text"]):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return [{"start": round(s[0]["start"], 1), "words": len(s), "text": " ".join(w["text"] for w in s)} for s in out]


def find_candidates(queries: list[dict], per_query: int = 3, cap: int = 45) -> tuple[list[dict], dict]:
    from factory import images

    seen: dict[str, dict] = {}
    problems: dict[str, str] = {}
    blocked: set[str] = set()
    for q in queries:
        archives = [a for a in images.ARCHIVES if a not in blocked]
        found, bad = images.search(q["query"], archives, per_query)
        for name, why in bad.items():
            problems[name] = why
            if "429" in why or "403" in why or "ключ" in why:
                blocked.add(name)  # архив отказал — больше его не дёргаем
        for r in found:
            if r.ref in seen or (r.width and min(r.width, r.height) < 800):
                continue
            seen[r.ref] = {"ref": r.ref, "title": r.title, "creator": r.creator, "date": r.date, "archive": r.archive,
                           "size": f"{r.width}x{r.height}" if r.width else "unknown", "chapter": q.get("chapter")}
        if len(seen) >= cap:
            break
    return list(seen.values())[:cap], problems


def shot_catalog() -> dict:
    """Описание типов кадров для агента: что показывает + пример из тестового ролика."""
    demo = json.loads((ROOT / "scripts" / "demo" / "thermopylae" / "storyboard.json").read_text(encoding="utf-8"))
    examples: dict[str, dict] = {}
    for ch in demo["chapters"]:
        for item in ch["shots"]:
            examples.setdefault(item["shot"]["type"], item["shot"])
    what = {
        "map": "modern map (Natural Earth) with camera move view→viewTo, places, routes, approximate regions",
        "timeline": "years from→to with events (negative = BC) and spans",
        "kenburns": "archive image with slow camera move, title and caption; image = ref from the images list",
        "quote": "a primary-source quotation with author and source",
        "infographic": "numbers: areas (2 items, exact scale), bars (2–5 items), number (1 item); status claim for ancient numbers",
        "narrator": "the guide character with poses/emotions and a board (kicker, title, up to 3 lines)",
        "compare": "two halves (then / now): image ref or icon each, label, heading, up to 3 lines",
        "diagram": "boxes on a grid (col 0–3, row 0–2) with arrows: causes, battle phases, routes",
        "scene": "illustration from icons on a setting (plain, coast, pass, sea), time day/dusk/night; items x 0–1920, y 300–1080",
    }
    return {t: {"what": what[t], "example": examples.get(t)} for t in storyboard.SHOT_TYPES} | {
        "_icons": list(storyboard.ICONS), "_backdrops": list(storyboard.BACKDROPS), "_transitions": list(storyboard.TRANSITIONS),
        "_poses": list(storyboard.POSES), "_emotions": list(storyboard.EMOTIONS),
    }


def check_storyboard(out: dict, script: dict, narration: dict, refs: set[str]) -> list[str]:
    err = storyboard.validate(script, out)
    if err:
        return err[:20]
    from factory import images
    from factory.images.store import fetch

    for r in storyboard.all_image_refs(out):
        if r not in refs:
            err.append(f"image {r} is not in the images list")
            continue
        try:  # файл скачивается сразу: архив может отказать — тогда агент берёт другую картинку до показа владельцу
            fetch(images.get(r))
        except (images.ArchiveUnavailable, images.LicenseRejected, images.ImageError) as e:
            err.append(f"image {r} cannot be downloaded right now ({str(e)[:80]}); choose another image from the list")
    by_id = {c["id"]: c for c in out["chapters"]}
    for ch in narration["chapters"]:
        try:
            timed = storyboard.plan_chapter(ch["words"], by_id[ch["id"]]["shots"], ch["frames"])
        except ValueError as e:
            err.append(str(e))
            continue
        e, _ = storyboard.duration_problems(timed, ch["id"])
        err += [x.replace("глава", "chapter").replace("кадр", "shot").replace("длится", "lasts").replace("допустимо от", "allowed").replace(" до ", "–").replace(" с", " s") for x in e]
    return err


def step_storyboard(folder: Path) -> dict:
    require(folder, "storyboard")
    script = _read(folder, "script.json")
    settings = _settings(folder)
    log.info("Озвучка (сначала звук, потом картинка)…")
    narration = production.narrate_chapters(folder, script, settings)
    log.info("  %d слов, %.1f с, движок %s", narration["words"], narration["total_frames"] / 30, narration["engine"])

    qdata = {"title": script["title"], "chapters": [{"id": c["id"], "title": c["title"], "summary": c["text"][:400]} for c in script["chapters"]]}
    queries = agents.run("image-researcher", "Suggest archive search queries for the input below.", qdata, schemas.QUERIES, folder=folder)["queries"]
    log.info("Поиск изображений в архивах по %d запросам…", len(queries))
    candidates, problems = find_candidates(queries)
    _write(folder, "images_candidates.json", {"candidates": candidates, "archives_unavailable": problems})
    log.info("  найдено с проверенной лицензией: %d", len(candidates))

    data = {
        "chapters": [{"id": ch["id"], "seconds": round(ch["frames"] / 30, 1), "sentences": sentences_with_times(ch["words"])} for ch in narration["chapters"]],
        "shot_types": shot_catalog(), "images": candidates, "owner_note": _note(folder, "storyboard"),
        "rules": "4–8 s per shot (hard limits 2–10 s); neighbours differ in type, backdrop and image; images only by ref; first shot of a chapter has at=''.",
    }
    refs = {c["ref"] for c in candidates}
    out = agents.run("storyboard-agent", "Make the storyboard for the input below.", data, schemas.STORYBOARD,
                     check=lambda o: check_storyboard(o, script, narration, refs), folder=folder)
    board = {"chapters": out["chapters"], "summary_ru": out.get("summary_ru", "")}
    _write(folder, "storyboard.json", board)
    return board


# ---------------------------------------------------------------- шаги целиком

def run_step(folder: Path, step: str, note: str = "") -> Path:
    folder = Path(folder).resolve()
    if step not in STEPS[1:]:
        raise PipelineError(f"Шаг: {', '.join(STEPS[1:])}")
    if step != "topic":
        require(folder, step)
    if note:
        set_step(folder, step, "переделывается", note=note)
    try:
        if step == "topic":
            step_topic(folder)
        elif step == "outline":
            step_outline(folder)
        elif step == "script":
            step_script(folder)
        elif step == "storyboard":
            step_storyboard(folder)
        elif step == "production":
            out = production.produce(folder)
            set_step(folder, step, DONE if out["report"]["ok"] else FAILED)
            return folder
        elif step == "package":
            from factory import packaging

            packaging.package(folder)
    except (agents.AgentError, production.ProductionError) as e:
        set_step(folder, step, FAILED, error=str(e)[:2000], note=note)
        raise PipelineError(str(e)) from e
    set_step(folder, step, WAITING, note=note)
    return folder


def approve(folder: Path, step: str) -> None:
    state = read_state(folder)
    if step == "topic":
        raise PipelineError("Тема выбирается командой pick <номер>")
    if step_status(state, step) != WAITING:
        raise PipelineError(f"Шаг «{STEP_RU[step]}» не ждёт решения (сейчас: {step_status(state, step)})")
    if step == "outline":
        structures.record(_read(folder, "outline.json")["structure"])
    set_step(folder, step, ACCEPTED)


def next_step(folder: Path) -> str | None:
    state = read_state(folder)
    for step in STEPS:
        st = step_status(state, step)
        if st in (ACCEPTED, DONE):
            continue
        return step
    return None


# ---------------------------------------------------------------- что показать владельцу

def status_text(folder: Path) -> str:
    state = read_state(folder)
    lines = [f"Видео: {folder.name}"]
    for step in STEPS:
        lines.append(f"  {STEP_RU[step]:<24} {step_status(state, step)}")
    nxt = next_step(folder)
    lines.append("")
    if nxt == "style":
        lines.append("Нужно выбрать стиль: python scripts/styles.py pick --video " + str(folder))
    elif nxt == "topic":
        if (folder / "topics.json").exists():
            for i, t in enumerate(_read(folder, "topics.json")["topics"], 1):
                lines.append(f"  {i}. {t['title']} — {t['pitch_ru']}")
            lines.append("Выберите номер темы (pick) или попросите другие (run topic --note …).")
        else:
            lines.append("Следующий шаг: предложить темы (run topic).")
    elif nxt:
        st = step_status(state, nxt)
        files = {"outline": "outline.json", "script": "script.json", "storyboard": "storyboard.json"}
        if st == WAITING and nxt in files:
            data = _read(folder, files[nxt])
            summary = data.get("summary_ru") or data.get("facts_summary_ru") or data.get("notes_ru") or ""
            lines.append(f"Готово к просмотру: {files[nxt]}. {summary}")
            lines.append(f"Принять (approve {nxt}) или переделать (run {nxt} --note «что изменить»).")
        else:
            lines.append(f"Следующий шаг: {STEP_RU[nxt]} (run {nxt}).")
    else:
        lines.append("Все шаги пройдены.")
    lines.append(f"Агенты потратили примерно ${state.get('agents_cost_usd', 0):.2f}")
    chosen = chosen_for_video(folder)
    if chosen:
        lines.append(f"Стиль: {chosen}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    setup_console()
    ap = argparse.ArgumentParser(description="Работа над видео по шагам")
    sub = ap.add_subparsers(dest="cmd", required=True)
    n = sub.add_parser("new")
    n.add_argument("--subgenre", default="any", choices=["any", *schemas.SUBGENRES])
    n.add_argument("--hint", default="")
    n.add_argument("--minutes", type=float, default=8.5)
    n.add_argument("--chapters", default="5-7")
    for name in ("status", "next"):
        sub.add_parser(name).add_argument("folder")
    r = sub.add_parser("run")
    r.add_argument("folder")
    r.add_argument("step")
    r.add_argument("--note", default="")
    p = sub.add_parser("pick")
    p.add_argument("folder")
    p.add_argument("number", type=int)
    fx = sub.add_parser("fix", help="исправить оставшиеся замечания проверки фактов в тексте")
    fx.add_argument("folder")
    fx.add_argument("--note", default="")
    fx.add_argument("--no-recheck", action="store_true", help="без повторной проверки фактов")
    a = sub.add_parser("approve")
    a.add_argument("folder")
    a.add_argument("step")
    args = ap.parse_args(argv)
    try:
        if args.cmd == "new":
            lo, hi = (int(x) for x in args.chapters.split("-"))
            folder = new_video(args.subgenre, args.hint, args.minutes, (lo, hi))
            print(f"Создано: {folder}\nСначала выберите стиль: python scripts/styles.py pick --video {folder}")
            return 0
        folder = Path(args.folder)
        if args.cmd == "run":
            folder = run_step(folder, args.step, args.note)
        elif args.cmd == "pick":
            folder = pick_topic(folder, args.number)
        elif args.cmd == "approve":
            approve(folder, args.step)
        elif args.cmd == "fix":
            fix_script(folder, args.note, recheck=not args.no_recheck)
        elif args.cmd == "next":
            step = next_step(folder)
            if step in (None, "style", "topic") and (step != "topic" or not (folder / "topics.json").exists()):
                if step == "topic":
                    folder = run_step(folder, "topic")
            elif step and step_status(read_state(folder), step) != WAITING:
                folder = run_step(folder, step)
        print(status_text(folder))
    except (PipelineError, ValueError) as e:
        print(f"ОСТАНОВЛЕНО: {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
