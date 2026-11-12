#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка компьютера для «Фабрики исторических видео».

Работает БЕЗ установки чего-либо: только стандартная библиотека Python.
Запуск на Windows: двойной щелчок по check_env.bat
Запуск вручную:    python scripts/check_env.py [--no-net] [--deep] [--json]

  --no-net  не проверять интернет
  --deep    дополнительно сделать один настоящий запрос к Claude Code
            (проверяет, что вы вошли в аккаунт; тратит чуть-чуть лимита)
  --json    вывести результат в машинном виде (для веб-страницы)

Результат также сохраняется в logs/env_report.json
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IS_WIN = os.name == "nt"

OK, WARN, FAIL, INFO = "ok", "warn", "fail", "info"
MARK = {OK: "[ OK ]", WARN: "[ !! ]", FAIL: "[НЕТ!]", INFO: "[ .. ]"}

# Минимальные требования
NEED_PY = (3, 12)
MIN_FREE_GB_FAIL = 10
MIN_FREE_GB_WARN = 20
MIN_RAM_GB_WARN = 15

results: list[dict] = []


def add(status: str, name: str, detail: str, fix: str = "", key: str = "") -> None:
    results.append(
        {"key": key or name, "status": status, "name": name, "detail": detail, "fix": fix}
    )


def run(cmd: list[str], timeout: int = 20) -> tuple[int, str]:
    """Запускает команду, возвращает (код, вывод). Никогда не падает."""
    try:
        p = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return p.returncode, (p.stdout or "").strip()
    except FileNotFoundError:
        return 127, ""
    except subprocess.TimeoutExpired:
        return 124, "timeout"
    except Exception as e:  # noqa: BLE001
        return 1, f"{type(e).__name__}: {e}"


def which(name: str) -> str | None:
    return shutil.which(name)


def first_version(text: str) -> tuple[int, ...]:
    m = re.search(r"(\d+)\.(\d+)(?:\.(\d+))?", text or "")
    if not m:
        return ()
    return tuple(int(x) for x in m.groups() if x is not None)


# ---------------------------------------------------------------- проверки


def check_os() -> None:
    system = platform.system()
    if system == "Windows":
        build = sys.getwindowsversion().build  # type: ignore[attr-defined]
        edition = "Windows 11" if build >= 22000 else "Windows 10 или старше"
        detail = f"{edition}, сборка {build}, {platform.machine()}"
        if build >= 22000:
            add(OK, "Операционная система", detail, key="os")
        else:
            add(
                WARN,
                "Операционная система",
                detail + " — проект рассчитан на Windows 11, но должен работать",
                key="os",
            )
    else:
        add(
            INFO,
            "Операционная система",
            f"{system} {platform.release()} ({platform.machine()}) — режим разработки, не Windows",
            key="os",
        )


def check_project_path() -> None:
    p = str(ROOT)
    problems = []
    try:
        p.encode("ascii")
    except UnicodeEncodeError:
        problems.append("в пути есть русские буквы или другие не-латинские символы")
    low = p.lower()
    if IS_WIN:
        if not low.startswith("c:"):
            problems.append("папка не на диске C:")
        for bad, why in (
            ("onedrive", "папка внутри OneDrive (синхронизация ломает установку)"),
            ("\\desktop", "папка на Рабочем столе"),
            ("рабочий стол", "папка на Рабочем столе"),
            ("\\downloads", "папка в «Загрузках»"),
        ):
            if bad in low and why not in problems:
                problems.append(why)
        if len(p) > 40:
            problems.append("путь длинный (лучше короче 40 символов)")
    if " " in p:
        problems.append("в пути есть пробелы")
    if problems:
        add(
            FAIL if any("русские" in x or "OneDrive" in x for x in problems) else WARN,
            "Папка проекта",
            f"{p} — " + "; ".join(problems),
            "Перенесите папку целиком в C:\\history-factory и запустите проверку оттуда.",
            key="path",
        )
    else:
        add(OK, "Папка проекта", p, key="path")


def check_python() -> None:
    v = sys.version_info
    cur = f"{v.major}.{v.minor}.{v.micro}"
    fix = (
        "Откройте Терминал и выполните:  winget install Python.Python.3.12\n"
        "Потом закройте и снова откройте Терминал."
    )
    if (v.major, v.minor) == NEED_PY:
        add(OK, "Python 3.12", f"{cur} ({sys.executable})", key="python")
        return
    # Запущены не из 3.12 — ищем 3.12 рядом
    found = ""
    if IS_WIN and which("py"):
        code, out = run(["py", "-3.12", "-c", "import sys;print(sys.version.split()[0])"])
        if code == 0 and out.startswith("3.12"):
            found = f"py -3.12 → {out}"
    else:
        exe = which("python3.12")
        if exe:
            code, out = run([exe, "-c", "import sys;print(sys.version.split()[0])"])
            if code == 0:
                found = f"{exe} → {out}"
    if found:
        add(
            OK,
            "Python 3.12",
            f"найден ({found}); эта проверка запущена из Python {cur}",
            key="python",
        )
    elif (v.major, v.minor) > NEED_PY:
        add(
            FAIL,
            "Python 3.12",
            f"найден только Python {cur}. Озвучка Kokoro НЕ работает на 3.13 и новее",
            fix,
            key="python",
        )
    else:
        add(FAIL, "Python 3.12", f"найден только Python {cur}, нужен 3.12", fix, key="python")


def node_supported(ver: tuple[int, ...]) -> bool:
    """Remotion 4 работает на Node 20.19+, 22.13+ и 24+ (так записано в его package.json)."""
    major = ver[0]
    minor = ver[1] if len(ver) > 1 else 0
    return (major == 20 and minor >= 19) or (major == 22 and minor >= 13) or major >= 24


def check_node() -> None:
    fix = "Терминал:  winget install OpenJS.NodeJS.LTS   (потом перезапустите Терминал)"
    exe = which("node")
    if not exe:
        add(FAIL, "Node.js", "не найден (нужен для сборки видео в Remotion)", fix, key="node")
        return
    _, out = run([exe, "--version"])
    ver = first_version(out)
    if not ver:
        add(FAIL, "Node.js", f"не удалось узнать версию: {out[:80]}", fix, key="node")
    elif not node_supported(ver):
        add(
            FAIL,
            "Node.js",
            f"версия {out} не подходит для Remotion: нужна 22.13+ (или 20.19+, или 24+)",
            fix,
            key="node",
        )
    else:
        add(OK, "Node.js", f"{out}", key="node")
    npm = which("npm")
    if not npm:
        add(FAIL, "npm", "не найден (ставится вместе с Node.js)", fix, key="npm")
    else:
        code, out = run([npm, "--version"], timeout=40)
        if code == 0:
            add(OK, "npm", out.splitlines()[-1], key="npm")
        else:
            add(WARN, "npm", f"найден, но не ответил: {out[:80]}", fix, key="npm")


def check_ffmpeg() -> None:
    fix = "Терминал:  winget install Gyan.FFmpeg   (потом перезапустите Терминал)"
    ff, fp = which("ffmpeg"), which("ffprobe")
    if not ff or not fp:
        missing = " и ".join(n for n, e in (("ffmpeg", ff), ("ffprobe", fp)) if not e)
        add(FAIL, "FFmpeg", f"не найден: {missing} (склейка видео, громкость, проверки)", fix, key="ffmpeg")
        return
    _, out = run([ff, "-hide_banner", "-version"])
    version = out.splitlines()[0] if out else "?"
    _, enc = run([ff, "-hide_banner", "-encoders"])
    _, flt = run([ff, "-hide_banner", "-filters"])
    missing = []
    if "libx264" not in enc:
        missing.append("кодек H.264 (libx264)")
    if not re.search(r"\baac\b", enc):
        missing.append("кодек звука AAC")
    if "loudnorm" not in flt:
        missing.append("фильтр громкости loudnorm")
    if missing:
        add(
            FAIL,
            "FFmpeg",
            f"{version} — но не хватает: " + ", ".join(missing),
            "Поставьте полную сборку:  winget install Gyan.FFmpeg",
            key="ffmpeg",
        )
    else:
        add(OK, "FFmpeg", version.split(" Copyright")[0][:60], key="ffmpeg")


def check_git() -> None:
    exe = which("git")
    if not exe:
        add(
            WARN,
            "Git",
            "не найден — обновление проекта (update.bat) работать не будет",
            "Терминал:  winget install Git.Git",
            key="git",
        )
        return
    _, out = run([exe, "--version"])
    add(OK, "Git", out, key="git")


def check_claude(deep: bool) -> None:
    fix = (
        "Терминал:  winget install Anthropic.ClaudeCode\n"
        "Затем один раз запустите  claude  и войдите в свой аккаунт."
    )
    exe = which("claude")
    if not exe:
        add(FAIL, "Claude Code", "не найден (это «мозг» фабрики: сценарии, проверка фактов)", fix, key="claude")
        return
    low = exe.lower().replace("/", "\\")
    if IS_WIN and ("\\npm\\" in low or "node_modules" in low or low.endswith((".cmd", ".ps1"))):
        add(
            WARN,
            "Claude Code",
            f"найдена npm-версия ({exe}) — на Windows она даёт ошибку «claude.exe is not a valid application»",
            "Удалите её:  npm uninstall -g @anthropic-ai/claude-code\n" + fix,
            key="claude",
        )
        return
    code, out = run([exe, "--version"], timeout=40)
    if code != 0:
        add(FAIL, "Claude Code", f"найден, но не запускается: {out[:120]}", fix, key="claude")
        return
    detail = f"{out.splitlines()[0]} ({exe})"
    if not deep:
        add(OK, "Claude Code", detail + " — вход в аккаунт не проверялся (для этого: --deep)", key="claude")
        return
    code, out = run(
        [exe, "-p", "Reply with exactly: FACTORY_OK"],
        timeout=120,
    )
    if code == 0 and "FACTORY_OK" in out:
        add(OK, "Claude Code", detail + " — вход в аккаунт работает", key="claude")
    else:
        add(
            FAIL,
            "Claude Code",
            detail + f" — запрос не прошёл: {out[-160:] or 'нет ответа'}",
            "Запустите в Терминале  claude  и войдите в аккаунт, затем повторите проверку.",
            key="claude",
        )


def check_gpu() -> None:
    exe = which("nvidia-smi")
    if not exe:
        add(
            WARN,
            "Видеокарта NVIDIA",
            "nvidia-smi не найден — фабрика будет работать на процессоре (медленнее, но работает)",
            "Если видеокарта есть: поставьте свежий драйвер с nvidia.com (или через приложение NVIDIA).",
            key="gpu",
        )
        return
    code, out = run(
        [exe, "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"]
    )
    if code != 0 or not out:
        add(
            WARN,
            "Видеокарта NVIDIA",
            f"nvidia-smi не ответил ({out[:80]}) — будет использоваться процессор",
            "Обновите драйвер NVIDIA и перезагрузите ноутбук.",
            key="gpu",
        )
        return
    line = out.splitlines()[0]
    parts = [x.strip() for x in line.split(",")]
    name = parts[0] if parts else line
    mem = parts[1] if len(parts) > 1 else "?"
    drv = parts[2] if len(parts) > 2 else "?"
    try:
        mem_gb = f"{int(float(mem)) / 1024:.0f} ГБ"
    except ValueError:
        mem_gb = mem
    add(OK, "Видеокарта NVIDIA", f"{name}, память {mem_gb}, драйвер {drv}", key="gpu")

    # CUDA в PyTorch — только если зависимости уже установлены
    vpy = ROOT / ".venv" / ("Scripts/python.exe" if IS_WIN else "bin/python")
    if not vpy.exists():
        add(
            INFO,
            "Ускорение на видеокарте (CUDA)",
            "проверится после установки (setup.bat, затем по желанию install_gpu.bat)",
            key="cuda",
        )
        return
    code, out = run(
        [str(vpy), "-c", "import torch;print(torch.__version__, torch.cuda.is_available())"],
        timeout=90,
    )
    if code != 0:
        add(INFO, "Ускорение на видеокарте (CUDA)", "PyTorch ещё не установлен", key="cuda")
    elif out.strip().endswith("True"):
        add(OK, "Ускорение на видеокарте (CUDA)", f"PyTorch {out.split()[0]} видит видеокарту", key="cuda")
    else:
        add(
            INFO,
            "Ускорение на видеокарте (CUDA)",
            f"PyTorch {out.split()[0]} — обычная версия (процессор). Это нормально.",
            "Для ускорения озвучки запустите install_gpu.bat (скачает ≈2,5 ГБ).",
            key="cuda",
        )


def check_disk() -> None:
    try:
        free = shutil.disk_usage(ROOT).free / 1024**3
    except OSError as e:
        add(WARN, "Свободное место", f"не удалось узнать: {e}", key="disk")
        return
    detail = f"свободно {free:.0f} ГБ на диске с проектом"
    if free < MIN_FREE_GB_FAIL:
        add(FAIL, "Свободное место", detail + f" — нужно минимум {MIN_FREE_GB_FAIL} ГБ", "Освободите место на диске.", key="disk")
    elif free < MIN_FREE_GB_WARN:
        add(WARN, "Свободное место", detail + f" — лучше {MIN_FREE_GB_WARN}+ ГБ (видео и кэш картинок растут)", key="disk")
    else:
        add(OK, "Свободное место", detail, key="disk")


def total_ram_gb() -> float | None:
    try:
        if IS_WIN:
            import ctypes

            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]

            st = MEMORYSTATUSEX()
            st.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(st))  # type: ignore[attr-defined]
            return st.ullTotalPhys / 1024**3
        with open("/proc/meminfo", encoding="utf-8") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    return int(line.split()[1]) / 1024**2
    except Exception:  # noqa: BLE001
        return None
    return None


def check_ram_cpu() -> None:
    ram = total_ram_gb()
    cores = os.cpu_count() or 0
    if ram is None:
        add(INFO, "Память и процессор", f"ядер: {cores}; объём памяти узнать не удалось", key="ram")
        return
    detail = f"память {ram:.0f} ГБ, ядер процессора: {cores}"
    if ram < MIN_RAM_GB_WARN:
        add(
            WARN,
            "Память и процессор",
            detail + " — мало памяти: главы будут рендериться по одной (дольше)",
            key="ram",
        )
    else:
        add(OK, "Память и процессор", detail, key="ram")


def _reg_dword(path: str, name: str) -> int | None:
    try:
        import winreg  # type: ignore[import-not-found]

        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path) as k:
            val, _ = winreg.QueryValueEx(k, name)
            return int(val)
    except Exception:  # noqa: BLE001
        return None


def check_windows_extras() -> None:
    if not IS_WIN:
        return
    sac = _reg_dword(r"SYSTEM\CurrentControlSet\Control\CI\Policy", "VerifiedAndReputablePolicyState")
    unblock = (
        "Если .bat-файлы не запускаются: откройте папку проекта, правый щелчок → «Открыть в терминале»,\n"
        "выполните:  Get-ChildItem -Recurse | Unblock-File   и затем  .\\setup.bat"
    )
    if sac == 1:
        add(
            WARN,
            "Smart App Control",
            "ВКЛЮЧЁН — может блокировать скачанные .bat-файлы. Проект это учитывает "
            "(не использует faster-whisper, чьи DLL он блокирует)",
            unblock,
            key="sac",
        )
    elif sac == 2:
        add(INFO, "Smart App Control", "режим оценки (пока ничего не блокирует)", unblock, key="sac")
    elif sac == 0:
        add(OK, "Smart App Control", "выключен", key="sac")
    else:
        add(INFO, "Smart App Control", "состояние узнать не удалось", unblock, key="sac")

    lp = _reg_dword(r"SYSTEM\CurrentControlSet\Control\FileSystem", "LongPathsEnabled")
    if lp == 1:
        add(OK, "Длинные пути Windows", "включены", key="longpaths")
    else:
        add(
            INFO,
            "Длинные пути Windows",
            "выключены — не страшно, если папка проекта короткая (C:\\history-factory)",
            key="longpaths",
        )


NET_HOSTS = [
    # (название, URL, обязательно для установки?)
    ("PyPI (библиотеки Python)", "https://pypi.org/simple/pip/", True),
    ("npm (библиотеки для видео)", "https://registry.npmjs.org/remotion", True),
    ("HuggingFace (модель голоса Kokoro)", "https://huggingface.co/api/models/hexgrad/Kokoro-82M", True),
    ("GitHub (обновления проекта)", "https://github.com/", True),
    ("Wikimedia Commons (изображения)", "https://commons.wikimedia.org/w/api.php?action=query&meta=siteinfo&format=json", False),
    ("The Met (изображения)", "https://collectionapi.metmuseum.org/public/collection/v1/departments", False),
    ("Art Institute of Chicago (изображения)", "https://api.artic.edu/api/v1/artworks?limit=1", False),
    ("Smithsonian (изображения)", "https://api.si.edu/openaccess/api/v1.0/stats", False),
    ("Rijksmuseum (изображения)", "https://data.rijksmuseum.nl/", False),
    ("Library of Congress (изображения)", "https://www.loc.gov/pictures/?fo=json", False),
]


def _probe(url: str) -> tuple[bool, str]:
    req = urllib.request.Request(
        url, headers={"User-Agent": "history-factory-env-check/1.0 (local setup check)"}
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            r.read(256)
        return True, f"{time.time() - t0:.1f} с"
    except urllib.error.HTTPError as e:
        # Сервер ответил (пусть и ошибкой) — значит, он доступен
        return True, f"HTTP {e.code}, {time.time() - t0:.1f} с"
    except Exception as e:  # noqa: BLE001
        reason = getattr(e, "reason", e)
        return False, str(reason)[:70]


def check_network() -> None:
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(NET_HOSTS)) as pool:
        futs = {name: pool.submit(_probe, url) for name, url, _ in NET_HOSTS}
    bad_required, bad_optional, slow = [], [], []
    for name, _url, required in NET_HOSTS:
        ok, info = futs[name].result()
        if not ok:
            (bad_required if required else bad_optional).append(f"{name} — {info}")
        else:
            m = re.search(r"([\d.]+) с", info)
            if m and float(m.group(1)) > 5:
                slow.append(name)
    n_optional = sum(1 for _n, _u, req in NET_HOSTS if not req)
    if bad_required:
        add(
            FAIL,
            "Интернет: установка",
            "недоступны сайты, нужные для установки:",
            "\n".join(bad_required)
            + "\nПроверьте интернет / VPN / антивирус и запустите проверку ещё раз.",
            key="net_required",
        )
    else:
        note = " (медленно отвечают: " + ", ".join(slow) + ")" if slow else ""
        add(OK, "Интернет: установка", "PyPI, npm, HuggingFace, GitHub доступны" + note, key="net_required")
    if not bad_optional:
        add(OK, "Интернет: архивы изображений", f"все {n_optional} музейных архивов доступны", key="net_images")
    elif len(bad_optional) == n_optional:
        add(
            WARN,
            "Интернет: архивы изображений",
            "ни один архив недоступен — скачивать архивные изображения отсюда не получится",
            "\n".join(bad_optional),
            key="net_images",
        )
    else:
        add(
            WARN,
            "Интернет: архивы изображений",
            f"недоступно {len(bad_optional)} из {n_optional} — фабрика возьмёт картинки из остальных",
            "\n".join(bad_optional),
            key="net_images",
        )


# ------------------------------------------------------------------ вывод


def plural(n: int, one: str, few: str, many: str) -> str:
    n10, n100 = n % 10, n % 100
    if n10 == 1 and n100 != 11:
        return one
    if 2 <= n10 <= 4 and not 12 <= n100 <= 14:
        return few
    return many


def print_report() -> None:
    line = "=" * 68
    print(line)
    print("  ФАБРИКА ИСТОРИЧЕСКИХ ВИДЕО — проверка компьютера")
    print(line)
    for r in results:
        print(f"{MARK[r['status']]} {r['name']}: {r['detail']}")
        if r["fix"] and r["status"] in (FAIL, WARN):
            for ln in r["fix"].splitlines():
                print(f"         → {ln}")
    fails = [r for r in results if r["status"] == FAIL]
    warns = [r for r in results if r["status"] == WARN]
    print(line)
    if fails:
        n = len(fails)
        print(f"ИТОГ: нужно исправить {n} {plural(n, 'пункт', 'пункта', 'пунктов')} с пометкой [НЕТ!], "
              "потом запустить проверку снова.")
    elif warns:
        n = len(warns)
        print(f"ИТОГ: можно продолжать. Есть {n} {plural(n, 'замечание', 'замечания', 'замечаний')} [ !! ] — "
              "подробности выше.")
    else:
        print("ИТОГ: всё готово.")
    print("Отчёт сохранён: logs" + os.sep + "env_report.json  (его можно прислать Claude)")
    print(line)


def save_report() -> dict:
    report = {
        "time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "root": str(ROOT),
        "platform": platform.platform(),
        "python": sys.version.split()[0],
        "ok": not any(r["status"] == FAIL for r in results),
        "results": results,
    }
    try:
        logs = ROOT / "logs"
        logs.mkdir(exist_ok=True)
        (logs / "env_report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except OSError:
        pass
    return report


def main() -> int:
    ap = argparse.ArgumentParser(description="Проверка окружения фабрики исторических видео")
    ap.add_argument("--no-net", action="store_true", help="не проверять интернет")
    ap.add_argument("--deep", action="store_true", help="сделать настоящий запрос к Claude Code")
    ap.add_argument("--json", action="store_true", help="вывести JSON вместо текста")
    args = ap.parse_args()

    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except Exception:  # noqa: BLE001
            pass

    check_os()
    check_project_path()
    check_python()
    check_node()
    check_ffmpeg()
    check_git()
    check_claude(args.deep)
    check_gpu()
    check_disk()
    check_ram_cpu()
    check_windows_extras()
    if not args.no_net:
        check_network()

    report = save_report()
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_report()
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
