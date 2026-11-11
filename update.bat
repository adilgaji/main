@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Обновляю фабрику до последней версии...
git pull origin claude/pensive-cerf-2kusaf || (echo Не получилось скачать обновление. Пришлите скриншот. & pause & exit /b 1)
cd remotion
call npm install --no-fund --no-audit
cd ..
.venv\Scripts\pip install -q -r requirements.txt --resume-retries 100 --timeout 120
echo.
echo Готово! Закройте окно фабрики (если открыто) и запустите start.bat заново.
pause
