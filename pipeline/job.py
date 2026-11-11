"""Ролик = папка output/<дата>_<тема>/ со state.json.

Шаги сценария (их вызывает веб-страница, их же можно запускать из консоли):
  step_script(job, remarks)  — scriptwriter → fact-checker → script.txt
  step_storyboard(job)       — озвучка + субтитры → storyboard-agent → storyboard.json (с временем кадров)

Консоль:
  python pipeline/job.py new "How muscles recover after training"
  python pipeline/job.py script output/2026-11-10_how-muscles-recover
  python pipeline/job.py storyboard output/2026-11-10_how-muscles-recover
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUTPUT, ROOT, Log, ffprobe_duration, retry  # noqa: E402

MIN_SEC, MAX_SEC = 30, 55  # допустимая длина ролика (сек)
import shutil  # noqa: E402

def _find_claude() -> str:
    """Найти Claude Code: в PATH или в папке официального установщика (~/.local/bin)."""
    found = shutil.which("claude")
    if found:
        return found
    for cand in (Path.home() / ".local" / "bin" / "claude.exe", Path.home() / ".local" / "bin" / "claude"):
        if cand.exists():
            return str(cand)
    return "claude"


CLAUDE = _find_claude()
AGENT_TOOLS = {
    "idea-researcher": "WebSearch WebFetch Read Write",
    "scriptwriter": "WebSearch WebFetch Read Write",
    "fact-checker": "WebSearch WebFetch Read Write",
    "storyboard-agent": "Read Write",
    "quality-reviewer": "Read Write WebFetch",
}


# ------------------------------------------------------------------ состояние
def slugify(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:48].rstrip("-") or "video"


STYLES = ["classic", "glass", "pixel", "paper", "watercolour", "terminal", "isometric", "thermal", "clay"]


def new_job(topic: str, style: str = "classic") -> Path:
    job = OUTPUT / f"{dt.date.today():%Y-%m-%d}_{slugify(topic)}"
    job.mkdir(parents=True, exist_ok=True)
    style = style if style in STYLES else "classic"
    save_state(job, {"topic": topic, "style": style, "step": "script", "status": "new", "created": dt.datetime.now().isoformat(timespec="seconds"), "history": []})
    return job


def load_state(job: Path) -> dict:
    p = job / "state.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def save_state(job: Path, state: dict):
    (job / "state.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def update_state(job: Path, **kw):
    st = load_state(job)
    st.update(kw)
    st.setdefault("history", []).append({"at": dt.datetime.now().isoformat(timespec="seconds"), **{k: v for k, v in kw.items() if k in ("step", "status")}})
    save_state(job, st)
    return st


# ------------------------------------------------------------------ агенты
def run_agent(name: str, prompt: str, log: Log, timeout: int = 1500) -> str:
    """Запустить субагента Claude Code без диалога (claude -p)."""
    log(f"Агент {name}: работает…")
    res = subprocess.run(
        [CLAUDE, "-p", "--agent", name, "--allowedTools", *AGENT_TOOLS[name].split(), "--output-format", "text", prompt],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout,
    )
    out = (res.stdout or "").strip()
    if res.returncode != 0:
        raise RuntimeError(f"Агент {name} завершился с ошибкой: {(res.stderr or out)[-800:]}")
    log(f"Агент {name}: {out.splitlines()[-1] if out else 'готово'}")
    return out


# ------------------------------------------------------------------ шаг 2: текст
def write_script_txt(job: Path):
    sj = json.loads((job / "script.json").read_text(encoding="utf-8"))
    lines = [sj["script"].strip(), "", "SOURCES:"]
    for s in sj["sources"]:
        lines.append(f"[{s['id']}] {s.get('authors', '')} {s['title']}. {s.get('venue', '')} {s.get('year', '')}. {s['url']}")
    (job / "script.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return sj


def step_script(job: Path, remarks: str = "", log: Log | None = None) -> dict:
    log = log or Log(job / "log.txt")
    st = update_state(job, step="script", status="working")
    rel = job.relative_to(ROOT).as_posix()
    prompt = f"Topic: {st['topic']}\nJob folder: {rel}\n"
    if st.get("angle"):
        prompt += f"Angle: {st['angle']}\n"
    if remarks:
        prompt += f"Remarks from the human editor (must be addressed): {remarks}\n"
        if (job / "script.json").exists():
            prompt += f"Previous version is in {rel}/script.json — rewrite it.\n"
    retry("сценарий", run_agent, log, name="scriptwriter", prompt=prompt, log=log)
    retry("проверка фактов", run_agent, log, name="fact-checker", prompt=f"Job folder: {rel}\nCheck {rel}/script.json.", log=log)
    # проверка простоты языка: сложный текст автоматически уходит на упрощение (1 раз)
    from readability import analyze, problems as read_problems

    sj = json.loads((job / "script.json").read_text(encoding="utf-8"))
    issues = read_problems(sj["script"])
    a = analyze(sj["script"])
    log(f"Простота текста: уровень {a['grade']} класса, в среднем {a['avg_sentence']} слов в предложении")
    if a["grade"] > 6.0 or a["long_sentences"] or len(a["hard_words"]) > 3:
        log("Текст сложноват — отправляю сценаристу на упрощение")
        simp = ("Make the language simpler so a 10-year-old understands it (docs/PLAIN_LANGUAGE.md). Problems: "
                + "; ".join(issues) + f". Rewrite {rel}/script.json keeping the facts and sources.")
        retry("упрощение текста", run_agent, log, name="scriptwriter", prompt=f"Job folder: {rel}\nTopic: {st['topic']}\n{simp}", log=log)
        retry("проверка фактов", run_agent, log, name="fact-checker", prompt=f"Job folder: {rel}\nCheck {rel}/script.json.", log=log)
        sj = json.loads((job / "script.json").read_text(encoding="utf-8"))
        a = analyze(sj["script"])
        log(f"После упрощения: уровень {a['grade']} класса")
    sj = write_script_txt(job)
    sj["readability"] = analyze(sj["script"])
    (job / "script.json").write_text(json.dumps(sj, ensure_ascii=False, indent=2), encoding="utf-8")
    words = len(re.sub(r"[*]", "", sj["script"]).split())
    update_state(job, step="script", status="review", word_count=words)
    log(f"Текст готов: {words} слов, источников: {len(sj['sources'])}, проверка: {sj.get('fact_check', {}).get('verdict')}")
    return sj


# ------------------------------------------------------------------ шаг 3: раскадровка
def make_voice(job: Path, log: Log):
    from captions import make_captions
    from tts import synthesize

    sj = json.loads((job / "script.json").read_text(encoding="utf-8"))
    retry("озвучка", synthesize, log, text=sj["script"], out_wav=job / "voice.wav", log=log)
    retry("субтитры", make_captions, log, wav=job / "voice.wav", script=sj["script"], out_json=job / "words.json", log=log)
    words = json.loads((job / "words.json").read_text(encoding="utf-8"))
    for i, w in enumerate(words):
        w["i"] = i
    (job / "words.json").write_text(json.dumps(words, ensure_ascii=False, indent=1), encoding="utf-8")


def compute_times(job: Path) -> list[str]:
    """Посчитать начало/конец каждого кадра по словам; вернуть список проблем."""
    sb = json.loads((job / "storyboard.json").read_text(encoding="utf-8"))
    words = json.loads((job / "words.json").read_text(encoding="utf-8"))
    total = ffprobe_duration(job / "voice.wav")
    shots = sb["shots"]
    problems = []
    expect = 0
    for i, s in enumerate(shots):
        if s["first_word"] != expect:
            problems.append(f"Кадр {s['id']}: начинается со слова {s['first_word']}, а должен с {expect} (пропуск или наложение)")
        if s["last_word"] < s["first_word"]:
            problems.append(f"Кадр {s['id']}: последнее слово раньше первого")
        expect = s["last_word"] + 1
    if expect != len(words):
        problems.append(f"Раскадровка заканчивается на слове {expect - 1}, а слов всего {len(words)}")
    for i, s in enumerate(shots):
        s["start"] = 0.0 if i == 0 else round(words[s["first_word"]]["startMs"] / 1000 - 0.08, 2)
    for i, s in enumerate(shots):
        s["end"] = shots[i + 1]["start"] if i + 1 < len(shots) else round(total, 2)
        s["duration"] = round(s["end"] - s["start"], 2)
        s["text"] = "".join(w["text"] for w in words[s["first_word"]: s["last_word"] + 1]).strip()
        if s["duration"] < 2.0:
            problems.append(f"Кадр {s['id']}: слишком короткий ({s['duration']} с)")
        if s["duration"] > 5.0:
            problems.append(f"Кадр {s['id']}: слишком длинный ({s['duration']} с)")
    sb["total"] = round(total, 2)
    sb["sum_of_shots"] = round(sum(s["duration"] for s in shots), 2)
    (job / "storyboard.json").write_text(json.dumps(sb, ensure_ascii=False, indent=2), encoding="utf-8")
    return problems


def step_storyboard(job: Path, remarks: str = "", log: Log | None = None):
    log = log or Log(job / "log.txt")
    update_state(job, step="storyboard", status="working")
    if not (job / "words.json").exists() or remarks == "__revoice__":
        make_voice(job, log)
    # длина ролика должна быть 30–40 с: иначе текст автоматически сокращается/дополняется
    for _ in range(2):
        dur = ffprobe_duration(job / "voice.wav")
        if MIN_SEC <= dur <= MAX_SEC:
            break
        words_now = len(json.loads((job / "words.json").read_text(encoding="utf-8")))
        target = round(words_now * (45 if dur > MAX_SEC else 35) / dur)
        log(f"Озвучка {dur:.1f} с — вне нормы {MIN_SEC}–{MAX_SEC} с. Прошу сценариста привести текст к ~{target} словам")
        step_script(job, remarks=f"The voiceover is {dur:.1f} s, it must be {MIN_SEC}-{MAX_SEC} s. Rewrite to about {target} words, keep the hook, the core idea, the plain-language explanations and the strongest facts.", log=log)
        update_state(job, step="storyboard", status="working")
        make_voice(job, log)
    rel = job.relative_to(ROOT).as_posix()
    prompt = f"Job folder: {rel}\n"
    if remarks and remarks != "__revoice__":
        prompt += f"Remarks from the human editor (must be addressed): {remarks}\n"
    problems: list[str] = []
    for attempt in range(3):
        p = prompt + ("\nFix these problems of the previous storyboard:\n- " + "\n- ".join(problems) if problems else "")
        retry("раскадровка", run_agent, log, name="storyboard-agent", prompt=p, log=log)
        problems = compute_times(job)
        if not problems:
            break
        log("Раскадровка требует правки: " + "; ".join(problems))
    sb = json.loads((job / "storyboard.json").read_text(encoding="utf-8"))
    # новая раскадровка ещё не подтверждена человеком
    update_state(job, step="storyboard", status="review", duration=sb["total"], problems=problems, storyboard_hash=None)
    log(f"Раскадровка готова: {len(sb['shots'])} кадров, {sb['total']} с")
    return sb


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["new", "script", "storyboard"])
    ap.add_argument("arg")
    ap.add_argument("--remarks", default="")
    ap.add_argument("--style", default="classic")
    a = ap.parse_args()
    if a.cmd == "new":
        print(new_job(a.arg, a.style))
    elif a.cmd == "script":
        step_script(Path(a.arg).resolve(), a.remarks)
    else:
        step_storyboard(Path(a.arg).resolve(), a.remarks)
