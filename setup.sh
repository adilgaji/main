#!/usr/bin/env bash
# Установка фабрики Shorts (Linux/macOS), один раз.
set -e
cd "$(dirname "$0")"
for c in python3.12 node ffmpeg claude; do command -v $c >/dev/null || { echo "[НЕТ] $c не найден — установите его (см. README)"; exit 1; }; done
python3.12 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install torch   # на Linux PyTorch с CUDA ставится по умолчанию
.venv/bin/pip install -r requirements.txt
(cd remotion && npm install)
.venv/bin/python scripts/check_env.py
echo "Готово! Запуск: ./start.sh"
