"""Скачивает модель распознавания речи заранее (нужен VPN). Запускается из start.bat в фоне."""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; sys.path.insert(0, str(ROOT))
from app import stt
try:
    stt._load(); print('Модель готова:', stt.status())
    if stt._info['error']: print('Внимание:', stt._info['error'])
except Exception as e:
    print('Не удалось скачать модель:', e, '\nВключи VPN и перезапусти start.bat. Говорение пока не будет распознавать речь.'); sys.exit(2)
