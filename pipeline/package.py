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


if __name__ == "__main__":
    package(Path(sys.argv[1]))
