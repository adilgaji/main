@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Ускорение на видеокарте NVIDIA (по желанию)
echo ============================================
echo Скачает PyTorch с поддержкой CUDA (~2.8 ГБ). Можно запустить ночью.
echo Без этого всё работает, просто озвучка и субтитры идут на процессоре.
echo.
.venv\Scripts\pip install --force-reinstall --no-deps torch --index-url https://download.pytorch.org/whl/cu128
.venv\Scripts\python scripts\check_env.py
echo.
echo Если в строке PyTorch написано "CUDA доступна: True" — видеокарта подключена.
pause
