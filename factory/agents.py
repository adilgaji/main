"""Запуск субагентов Claude Code: `claude -p --agent <имя>`.

  • описание агента — .claude/agents/<имя>.md (модель, инструменты, инструкция);
  • агент получает короткую выжимку (JSON) и возвращает только JSON по схеме;
  • ответ проверяется схемой и правилами фабрики; при ошибке агенту возвращается список
    ошибок — до 3 попыток;
  • вызов идёт из временной папки вне проекта: так в него не попадает CLAUDE.md и лимит
    не тратится зря;
  • каждый вызов записывается в state.json (время, стоимость) и в work/agents/.

Для автотестов: FACTORY_FAKE_AGENTS=<папка> — вместо вызова берётся готовый <имя>.json из папки.
"""
from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import time
from collections.abc import Callable
from pathlib import Path

import jsonschema

from factory.paths import ROOT

log = logging.getLogger("factory.agents")
AGENTS_DIR = ROOT / ".claude" / "agents"
TRIES = 3


class AgentError(RuntimeError):
    pass


def load_agent(name: str) -> dict:
    """Описание агента из .md: {description, prompt, tools: [...], model}."""
    path = AGENTS_DIR / f"{name}.md"
    if not path.exists():
        raise AgentError(f"Нет описания агента {path}")
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        raise AgentError(f"{path.name}: нет заголовка ---")
    meta: dict[str, str] = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(":")
        meta[k.strip()] = v.strip()
    tools = [t.strip() for t in meta.get("tools", "").split(",") if t.strip()]
    return {"description": meta.get("description", name), "prompt": m.group(2).strip(), "tools": tools, "model": meta.get("model") or "sonnet"}


def _claude() -> str:
    exe = shutil.which("claude")
    if not exe:
        raise AgentError("Не найден Claude Code. Установка: winget install Anthropic.ClaudeCode")
    return exe


def parse_answer(stdout: str) -> tuple[dict, dict]:
    """Ответ `claude -p --output-format json` → (JSON агента, служебные данные: стоимость, ошибки)."""
    try:
        outer = json.loads(stdout)
    except ValueError as e:
        raise AgentError(f"Claude Code вернул не JSON: {stdout[-300:]}") from e
    meta = {"cost": float(outer.get("total_cost_usd") or 0), "turns": outer.get("num_turns"), "denials": outer.get("permission_denials") or []}
    if outer.get("is_error"):
        raise AgentError(f"Агент завершился с ошибкой: {str(outer.get('result'))[:400]}")
    data = outer.get("structured_output")
    if data is None:
        text = str(outer.get("result") or "").strip()
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end < start:
            raise AgentError("В ответе агента нет JSON")
        try:
            data = json.loads(text[start:end + 1])
        except ValueError as e:
            raise AgentError(f"JSON агента не читается: {e}") from e
    if not isinstance(data, dict):
        raise AgentError("Ответ агента — не объект JSON")
    return data, meta


def _record(folder: Path | None, name: str, seconds: float, cost: float, tries: int, ok: bool) -> None:
    if folder is None:
        return
    path = folder / "state.json"
    state = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    calls = state.setdefault("agents", [])
    calls.append({"agent": name, "at": time.strftime("%Y-%m-%d %H:%M:%S"), "seconds": round(seconds), "cost_usd": round(cost, 4), "tries": tries, "ok": ok})
    state["agents_cost_usd"] = round(sum(c["cost_usd"] for c in calls), 4)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _call(name: str, agent: dict, task: str, data: dict, schema: dict, model: str | None, timeout: int) -> tuple[dict, dict]:
    fake = os.environ.get("FACTORY_FAKE_AGENTS")
    if fake and (Path(fake) / f"{name}.json").exists():  # готовый ответ (тесты, повтор без лишних трат)
        return json.loads((Path(fake) / f"{name}.json").read_text(encoding="utf-8")), {"cost": 0.0}
    tools = agent["tools"]
    with tempfile.TemporaryDirectory(prefix="hf_agent_") as cwd:
        agents_file = Path(cwd) / "agents.json"
        agents_file.write_text(json.dumps({name: {k: agent[k] for k in ("description", "prompt", "tools", "model")}}, ensure_ascii=False), encoding="utf-8")
        cmd = [
            _claude(), "-p", task, "--agents", str(agents_file), "--agent", name, "--output-format", "json",
            "--json-schema", json.dumps(schema, ensure_ascii=False), "--tools", ",".join(tools),
            "--permission-mode", "dontAsk", "--no-session-persistence", "--strict-mcp-config",
        ]
        if tools:
            cmd += ["--allowedTools", *tools]
        if model:
            cmd += ["--model", model]
        p = subprocess.run(cmd, input=json.dumps(data, ensure_ascii=False), cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                           text=True, encoding="utf-8", errors="replace", timeout=timeout)
    if p.returncode != 0 and not p.stdout.strip():
        raise AgentError(f"Claude Code завершился с ошибкой ({p.returncode}): {p.stderr.strip()[-400:]}")
    return parse_answer(p.stdout)


def run(
    name: str,
    task: str,
    data: dict,
    schema: dict,
    check: Callable[[dict], list[str]] | None = None,
    folder: Path | None = None,
    model: str | None = None,
    timeout: int = 1500,
) -> dict:
    """Вызывает агента и возвращает проверенный JSON. При ошибках — до 3 попыток с подсказкой."""
    agent = load_agent(name)
    if model is None:
        from factory.settings import load_settings

        model = (load_settings().get("agents") or {}).get("models", {}).get(name)
    log.info("Агент %s (%s) работает…", name, model or agent["model"])
    t0, cost, problems, answer = time.time(), 0.0, [], None
    work = folder / "work" / "agents" if folder else None
    if work:
        work.mkdir(parents=True, exist_ok=True)
        (work / f"{name}.input.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    for attempt in range(1, TRIES + 1):
        prompt = task
        if problems:
            prompt += (
                "\n\nYour previous answer was rejected by the factory's checks. Fix ALL of these problems and return"
                " the complete corrected JSON again:\n- " + "\n- ".join(problems[:25])
                + "\n\nYour previous answer:\n" + json.dumps(answer, ensure_ascii=False)[:60000]
            )
        try:
            answer, meta = _call(name, agent, prompt, data, schema, model, timeout)
        except (AgentError, subprocess.TimeoutExpired) as e:
            problems = [f"technical error: {e}"]
            answer = None
            log.warning("  попытка %d: %s", attempt, str(e)[:200])
            continue
        cost += meta.get("cost", 0.0)
        problems = [f"{'/'.join(str(x) for x in err.path) or 'answer'}: {err.message}" for err in jsonschema.Draft202012Validator(schema).iter_errors(answer)][:15]
        if not problems and check:
            problems = check(answer)
        if work:
            (work / f"{name}.output.json").write_text(json.dumps(answer, ensure_ascii=False, indent=1), encoding="utf-8")
        if not problems:
            _record(folder, name, time.time() - t0, cost, attempt, True)
            log.info("  готово за %.0f с (попыток: %d, примерно $%.3f)", time.time() - t0, attempt, cost)
            return answer
        log.warning("  попытка %d: ответ не прошёл проверку (%d замечаний): %s", attempt, len(problems), problems[0][:160])
    _record(folder, name, time.time() - t0, cost, TRIES, False)
    raise AgentError(f"Агент {name} не справился за {TRIES} попытки. Последние замечания:\n  " + "\n  ".join(problems[:10]))
