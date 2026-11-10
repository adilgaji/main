@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Установка фабрики Shorts (один раз)
echo ============================================
where py >nul 2>nul || (echo [НЕТ] Python не найден. Выполните: winget install Python.Python.3.12 & pause & exit /b 1)
where node >nul 2>nul || (echo [НЕТ] Node.js не найден. Выполните: winget install OpenJS.NodeJS.LTS & pause & exit /b 1)
where ffmpeg >nul 2>nul || (echo [НЕТ] FFmpeg не найден. Выполните: winget install Gyan.FFmpeg & pause & exit /b 1)
where claude >nul 2>nul || (echo [НЕТ] Claude Code не найден. Установите: npm install -g @anthropic-ai/claude-code  и войдите: claude & pause & exit /b 1)

echo [1/4] Python-окружение (Python 3.12)...
py -3.12 -m venv .venv || (echo Нужен именно Python 3.12: winget install Python.Python.3.12 & pause & exit /b 1)
.venv\Scripts\python -m pip install --upgrade pip

echo [2/4] PyTorch с поддержкой видеокарты NVIDIA (около 3 ГБ)...
.venv\Scripts\pip install torch --index-url https://download.pytorch.org/whl/cu128

echo [3/4] Озвучка, субтитры, веб-страница...
.venv\Scripts\pip install -r requirements.txt

echo [4/4] Видео-движок Remotion...
cd remotion
call npm install
cd ..

.venv\Scripts\python scripts\check_env.py
echo.
echo Готово! Запуск: двойной щелчок по start.bat
pause
