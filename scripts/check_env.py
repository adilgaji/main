"""Этап 0: проверка компьютера перед запуском фабрики Shorts.

Запуск:  python scripts/check_env.py
Ничего не устанавливает — только проверяет и подсказывает команды.
"""
import platform
import shutil
import subprocess
import sys

OK, WARN, FAIL = "[OK]  ", "[!!]  ", "[НЕТ] "
problems = []


def run(cmd):
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return (out.stdout or out.stderr).strip()
    except Exception:
        return None


def line(status, text, fix=None):
    print(status + text)
    if fix:
        print("      -> " + fix)
        if status != OK:
            problems.append(fix)


osname = platform.system()
print("=== Проверка окружения ===")
line(OK, f"ОС: {osname} {platform.release()} ({platform.machine()})")

# Python: Kokoro работает только на 3.10–3.12
v = sys.version_info
if (3, 10) <= (v.major, v.minor) <= (3, 12):
    line(OK, f"Python {v.major}.{v.minor}.{v.micro}")
else:
    fix = ("Установите Python 3.12: winget install Python.Python.3.12"
           if osname == "Windows" else "Установите Python 3.12 (sudo apt install python3.12 python3.12-venv)")
    line(FAIL, f"Python {v.major}.{v.minor} — нужен 3.10–3.12 (Kokoro не поддерживает 3.13+)", fix)

# Node.js: Remotion требует 18+
nv = run(["node", "-v"])
if nv and int(nv.lstrip("v").split(".")[0]) >= 18:
    line(OK, f"Node.js {nv}")
else:
    line(FAIL, "Node.js 18+ не найден",
         "winget install OpenJS.NodeJS.LTS" if osname == "Windows" else "https://nodejs.org (LTS)")

# FFmpeg
ff = run(["ffmpeg", "-version"])
if ff:
    line(OK, ff.splitlines()[0][:60])
else:
    line(FAIL, "FFmpeg не найден",
         "winget install Gyan.FFmpeg" if osname == "Windows" else "sudo apt install ffmpeg")

# espeak-ng нужен Kokoro для редких слов
if shutil.which("espeak-ng") or shutil.which("espeak"):
    line(OK, "espeak-ng найден")
else:
    line(WARN, "espeak-ng не найден (Kokoro лучше произносит редкие слова с ним)",
         "winget install eSpeak-NG.eSpeak-NG" if osname == "Windows" else "sudo apt install espeak-ng")

# Git
line(OK if shutil.which("git") else FAIL, "Git" + ("" if shutil.which("git") else " не найден"),
     None if shutil.which("git") else "winget install Git.Git")

# NVIDIA
smi = run(["nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"])
if smi:
    line(OK, f"Видеокарта: {smi}")
    cuda = run(["nvidia-smi"])
    if cuda and "CUDA Version" in cuda:
        ver = cuda.split("CUDA Version:")[1].split()[0]
        line(OK, f"Драйвер поддерживает CUDA до {ver} (нужно >= 12.1)")
else:
    line(WARN, "nvidia-smi не найден — всё будет работать на процессоре (медленнее)",
         "Обновите драйвер NVIDIA: https://www.nvidia.com/Download/index.aspx")

# PyTorch с CUDA (если уже установлен)
try:
    import torch  # noqa
    line(OK if torch.cuda.is_available() else WARN,
         f"PyTorch {torch.__version__}, CUDA доступна: {torch.cuda.is_available()}")
except ImportError:
    line(WARN, "PyTorch ещё не установлен (поставится на этапе 2 через setup)")

print()
if problems:
    print("Что нужно сделать:")
    for p in dict.fromkeys(problems):
        print("  " + p)
else:
    print("Всё готово к следующему этапу.")
