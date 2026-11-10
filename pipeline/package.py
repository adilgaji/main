"""Шаг 5: упаковка ролика.

- scriptwriter (режим packaging) пишет 3 названия, описание, теги и идею обложки → packaging.json
- программа проверяет длины, сама добавляет в описание источники и дисклеймер
- title.txt, description.txt, tags.txt, sources.txt, thumbnail.png
- quality-reviewer проверяет всё вместе → review.json (может вернуть на доработку)

    python pipeline/package.py output/<папка ролика>
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import REMOTION, ROOT, Log, retry, run  # noqa: E402
from job import run_agent, update_state  # noqa: E402
from render import NPX, browser_env  # noqa: E402

DISCLAIMER = "Educational, not medical advice. Talk to a doctor about your own health."
FORBIDDEN = ["cure", "guarantee", "miracle", "secret", "hack", "detox", "doctors hate"]


def check_packaging(pk: dict) -> list[str]:
    problems = []
    if len(pk.get("titles", [])) != 3:
        problems.append("need exactly 3 titles")
    for t in pk.get("titles", []):
        if len(t) > 60:
            problems.append(f"title longer than 60 characters ({len(t)}): {t}")
        if any(w in t.lower() for w in FORBIDDEN):
            problems.append(f"forbidden word in title: {t}")
    for t in pk.get("tags", []) + pk.get("titles", []):
        if any(w in t.lower() for w in ("kid", "child")):
            problems.append(f"do not target kids (made-for-kids risk): {t}")
    if len(", ".join(pk.get("tags", []))) > 480:
        problems.append("tags are longer than 480 characters in total")
    if not pk.get("thumbnail", {}).get("text"):
        problems.append("thumbnail.text is empty")
    return problems


def project_licenses() -> str:
    return (ROOT / "sources.txt").read_text(encoding="utf-8").strip()


def build_files(job: Path, pk: dict):
    sj = json.loads((job / "script.json").read_text(encoding="utf-8"))
    # названия
    (job / "title.txt").write_text("\n".join(f"{i}. {t}" for i, t in enumerate(pk["titles"], 1)) + "\n", encoding="utf-8")
    # описание: текст агента + источники (из проверенного script.json) + дисклеймер
    src_lines = []
    for s in sj["sources"]:
        line = f"• {s.get('authors', '')} ({s.get('year', '')}). {s['title']}. {s.get('venue', '')}. {s['url']}"
        src_lines.append(line.replace(" ()", "").replace("..", "."))
    desc = pk["description"].strip()
    hashtags = ""
    lines = desc.splitlines()
    if lines and lines[-1].strip().startswith("#"):
        hashtags = lines.pop().strip()
        desc = "\n".join(lines).strip()
    full = f"{desc}\n\n⚠️ {DISCLAIMER}\n\nSources:\n" + "\n".join(src_lines) + (f"\n\n{hashtags}" if hashtags else "") + "\n"
    (job / "description.txt").write_text(full, encoding="utf-8")
    # теги
    (job / "tags.txt").write_text(", ".join(pk["tags"]) + "\n", encoding="utf-8")
    # источники ролика + лицензии всех нескодовых файлов
    claims = "\n".join(f"  [{c['id']}] ({c['evidence']}) {c['sentence']} → {', '.join(c['sources'])}" for c in sj["claims"])
    sources = "\n".join(f"[{s['id']}] {s.get('authors', '')} {s['title']}. {s.get('venue', '')} {s.get('year', '')}. {s['url']}" for s in sj["sources"])
    (job / "sources.txt").write_text(
        "НАУЧНЫЕ ИСТОЧНИКИ\n" + sources + "\n\nУТВЕРЖДЕНИЯ И ИХ ИСТОЧНИКИ\n" + claims + "\n\nЛИЦЕНЗИИ МАТЕРИАЛОВ\n" + project_licenses() + "\n",
        encoding="utf-8",
    )


def render_thumbnail(job: Path, pk: dict, log: Log):
    th = pk["thumbnail"]
    props = job / "thumb_props.json"
    props.write_text(json.dumps(th, ensure_ascii=False), encoding="utf-8")
    run([NPX, "remotion", "still", "src/index.ts", "Thumbnail", str((job / "thumbnail.png").resolve()), f"--props={props.resolve()}", "--log=error"],
        cwd=REMOTION, env=browser_env())
    log("Обложка готова: thumbnail.png")


def package(job: Path, log: Log | None = None, review: bool = True) -> dict:
    job = job.resolve()
    log = log or Log(job / "log.txt")
    update_state(job, step="packaging", status="working")
    rel = job.relative_to(ROOT).as_posix()
    base = f"Packaging task. Job folder: {rel}. Follow docs/PACKAGING.md exactly and write {rel}/packaging.json."
    prev = json.loads((job / "review.json").read_text(encoding="utf-8")) if (job / "review.json").exists() else {}
    pk_fixes = [f for f in prev.get("fixes", []) if f.get("file") in ("title.txt", "description.txt", "tags.txt")]
    if pk_fixes:
        base += "\nAlso fix these reviewer remarks: " + "; ".join(f"{f['problem']} → {f['suggestion']}" for f in pk_fixes)
    problems: list[str] = []
    for _ in range(3):
        prompt = base + ("\nFix: " + "; ".join(problems) if problems else "")
        retry("упаковка", run_agent, log, name="scriptwriter", prompt=prompt, log=log)
        pk = json.loads((job / "packaging.json").read_text(encoding="utf-8"))
        problems = check_packaging(pk)
        if not problems:
            break
        log("Упаковку нужно поправить: " + "; ".join(problems))
    build_files(job, pk)
    retry("обложка", render_thumbnail, log, job=job, pk=pk, log=log)
    result = {"packaging": pk, "problems": problems}
    if review:
        retry("контроль качества", run_agent, log, name="quality-reviewer", prompt=f"Job folder: {rel}. Review this video package.", log=log)
        rv = json.loads((job / "review.json").read_text(encoding="utf-8"))
        result["review"] = rv
        log(f"Контроль качества: {rv['verdict']} — {rv.get('summary_ru', '')}")
    update_state(job, step="packaging", status="done" if not problems else "needs_fix")
    return result


def auto_fix(job: Path, review: dict, log: Log) -> bool:
    """Исправить замечания контроля качества, которые можно исправить без человека.
    Раскадровка: меняются только картинки/надписи кадров, текст и границы кадров — нет.
    Возвращает True, если что-то изменили (тогда видео нужно перерендерить)."""
    from job import compute_times
    from produce import storyboard_hash

    fixes = review.get("fixes", [])
    sb_fixes = [f for f in fixes if f.get("file") == "storyboard.json"]
    other = [f for f in fixes if f.get("file") not in ("storyboard.json", "title.txt", "description.txt", "tags.txt")]
    for f in other:
        log(f"Замечание требует вашего решения ({f.get('file')}): {f.get('problem')}")
    if not sb_fixes:
        return False
    rel = job.relative_to(ROOT).as_posix()
    backup = (job / "storyboard.json").read_text(encoding="utf-8")
    ranges = [(s["first_word"], s["last_word"]) for s in json.loads(backup)["shots"]]
    log(f"Исправляю замечания контроля качества в раскадровке ({len(sb_fixes)})")
    prompt = (f"Job folder: {rel}\nApply these quality-review fixes to {rel}/storyboard.json. Change ONLY the listed shots' "
              "params/description_ru. Do NOT change first_word/last_word of any shot, the number of shots or their order.\n- "
              + "\n- ".join(f"{f['problem']} → {f['suggestion']}" for f in sb_fixes))
    retry("правки раскадровки", run_agent, log, name="storyboard-agent", prompt=prompt, log=log)
    new = json.loads((job / "storyboard.json").read_text(encoding="utf-8"))
    if [(s["first_word"], s["last_word"]) for s in new["shots"]] != ranges or compute_times(job):
        log("Агент изменил границы кадров — откатываю, нужны ручные правки")
        (job / "storyboard.json").write_text(backup, encoding="utf-8")
        return False
    update_state(job, storyboard_hash=storyboard_hash(job), revised_by_review=[f["problem"] for f in sb_fixes])
    return True


def full_production(job: Path, log: Log | None = None):
    """Шаг 4 целиком: видео → упаковка → контроль качества → (авто-правки → видео → упаковка)."""
    from produce import produce

    job = job.resolve()
    log = log or Log(job / "log.txt")
    produce(job, log)
    res = package(job, log)
    for _ in range(2):  # до 2 кругов автоисправлений
        if res.get("review", {}).get("verdict") != "revise" or not auto_fix(job, res["review"], log):
            break
        log("Перерисовываю видео с исправлениями")
        produce(job, log)
        res = package(job, log)
    update_state(job, step="done", status="done")
    return res


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[2] == "--full":
        full_production(Path(sys.argv[1]))
    else:
        package(Path(sys.argv[1]))
