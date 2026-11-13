@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title HSK 4 - тренер

echo ================================================
echo   HSK 4 - тренер. Запуск...
echo ================================================

rem --- 1. Ищем Python ---
set PY=
where py >nul 2>nul && set PY=py -3
if "%PY%"=="" (where python >nul 2>nul && set PY=python)
if "%PY%"=="" (
  echo.
  echo [ОШИБКА] Python не найден. Скачай Python 3.11 или новее с python.org
  echo          При установке поставь галочку "Add Python to PATH". Потом запусти start.bat снова.
  pause & exit /b 1
)

rem --- 2. Виртуальное окружение и зависимости (один раз) ---
if not exist ".venv\Scripts\python.exe" (
  echo Создаю окружение .venv ...
  %PY% -m venv .venv || (echo [ОШИБКА] не удалось создать .venv & pause & exit /b 1)
)
if not exist ".venv\.installed" (
  echo Ставлю библиотеки ^(один раз, 1-3 минуты, нужен интернет^)...
  ".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt || (echo [ОШИБКА] не удалось поставить библиотеки. Проверь интернет/VPN. & pause & exit /b 1)
  echo ok> ".venv\.installed"
)

rem --- 3. Озвучка edge-tts в фоне (создаёт только недостающие файлы; нужен VPN) ---
start "Озвучка HSK4 (можно свернуть)" /min "%~dp0.venv\Scripts\python.exe" "%~dp0tools\build_audio.py"

rem --- 3b. Модель распознавания речи (скачивается один раз, ~1.6 ГБ, нужен VPN) и сертификат для https ---
start "Модель речи HSK4 (можно свернуть)" /min ".venv\Scripts\python.exe" "%~dp0tools\fetch_whisper.py"
".venv\Scripts\python.exe" tools\make_cert.py

rem --- 4. Адрес для телефона ---
echo.
echo   На этом компьютере:  http://localhost:8765
echo   Для микрофона на телефоне - https:  https://ВАШ_IP:8766  ^(появится предупреждение - нажми "Всё равно перейти"^)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo   С телефона ^(та же Wi-Fi^): http://%%b:8765
)
echo.
echo   Чтобы закрыть приложение, закрой это окно.
echo   Если Windows спросит про брандмауэр - нажми "Разрешить доступ" ^(для частной сети^).
echo.

rem --- 5. https-сервер для телефона (микрофон) в отдельном окне, затем основной сервер ---
if exist "cert\server.crt" start "HSK4 https (для телефона)" /min cmd /c "timeout /t 8 >nul & .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8766 --ssl-keyfile cert\server.key --ssl-certfile cert\server.crt"

rem --- 6. Открываем браузер и запускаем сервер ---
start "" http://localhost:8765
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8765
echo.
echo Сервер остановлен. Если это ошибка - сфотографируй окно и покажи Claude.
pause
