@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Установка фабрики исторических видео

rem  Установка в один щелчок. Можно запускать сколько угодно раз:
rem  готовое пропускается, прерванное скачивание продолжается.

echo ================================================================
echo   Установка фабрики исторических видео
echo   Готовое пропускается, прерванное скачивание продолжается.
echo ================================================================
echo.

echo "%CD%" | findstr /i "OneDrive" >nul
if not errorlevel 1 goto badpath

where winget >nul 2>&1
if errorlevel 1 goto nowinget

rem ---------------------------------------------------------------- 1. программы
echo Шаг 1 из 6. Программы: Python 3.12, Node.js, FFmpeg, Git, Claude Code
set "NEED_RESTART="
call :tool "Python 3.12" "py -3.12 --version" Python.Python.3.12
call :tool "Node.js" "node --version" OpenJS.NodeJS.LTS
call :tool "FFmpeg" "ffmpeg -version" Gyan.FFmpeg
call :tool "Git" "git --version" Git.Git
call :tool "Claude Code" "claude --version" Anthropic.ClaudeCode
if defined NEED_RESTART goto restart
echo.

rem ---------------------------------------------------------------- 2. окружение Python
echo Шаг 2 из 6. Окружение Python, папка .venv
set "PY=.venv\Scripts\python.exe"
if not exist "%PY%" goto mkvenv
"%PY%" -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 12) else 1)" >nul 2>&1
if not errorlevel 1 goto venvok
echo [ !! ] Окружение .venv создано не той версией Python — пересоздаю.
rmdir /s /q .venv
:mkvenv
py -3.12 -m venv .venv
if errorlevel 1 goto failvenv
:venvok
echo [ OK ] .venv
echo.

rem ---------------------------------------------------------------- 3. библиотеки Python
echo Шаг 3 из 6. Библиотеки Python: озвучка, веб-страница. Около 1 ГБ, это самый долгий шаг.
"%PY%" -m pip install --upgrade pip --timeout 120 --retries 10 --disable-pip-version-check
if errorlevel 1 goto failpip
"%PY%" -m pip install --resume-retries 100 --timeout 120 --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto failpip
echo [ OK ] библиотеки Python
echo.

rem ---------------------------------------------------------------- 4. библиотеки видео
echo Шаг 4 из 6. Библиотеки видео: Remotion и браузер для рендера
pushd video
call npm install --no-audit --no-fund
if errorlevel 1 goto failnpm
call npx remotion browser ensure
if errorlevel 1 goto failnpm
popd
echo [ OK ] библиотеки видео
echo.

rem ---------------------------------------------------------------- 5. модели голоса
echo Шаг 5 из 6. Модели голоса: Kokoro и запасной Piper. Около 400 МБ.
"%PY%" scripts\download_models.py --piper
if errorlevel 1 goto failmodels
echo [ OK ] модели голоса
echo.

rem ---------------------------------------------------------------- 6. ярлык и проверка
echo Шаг 6 из 6. Ярлык на Рабочем столе и проверка компьютера
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\History Factory.lnk'); $s.TargetPath='%~dp0start.bat'; $s.WorkingDirectory='%~dp0'; $s.Save()" >nul 2>&1
if errorlevel 1 echo [ !! ] Ярлык не создан — запускайте start.bat из папки проекта.
if not errorlevel 1 echo [ OK ] ярлык «History Factory» на Рабочем столе
echo.
"%PY%" scripts\check_env.py
echo.
echo ================================================================
echo   Установка закончена.
echo.
echo   Если ещё не входили в Claude Code — один раз откройте Терминал,
echo   введите  claude  и войдите своим аккаунтом Claude.
echo.
echo   Ускорение на видеокарте, по желанию: install_gpu.bat
echo   Запуск фабрики: start.bat или ярлык «History Factory».
echo ================================================================
pause
exit /b 0

rem ================================================================ подпрограммы и ошибки

:tool
rem  аргументы: название, команда проверки, пакет winget
%~2 >nul 2>&1
if not errorlevel 1 echo [ OK ] %~1
if not errorlevel 1 goto :eof
echo [ .. ] Устанавливаю %~1 ...
winget install -e --id %~3 --accept-package-agreements --accept-source-agreements
if errorlevel 1 echo [ !! ] winget не смог поставить %~1. Если ошибка повторится, выполните в Терминале: winget install %~3
set "NEED_RESTART=1"
goto :eof

:restart
echo.
echo ================================================================
echo   Новые программы установлены. Windows увидит их только в новом окне.
echo   Закройте ЭТО окно и запустите setup.bat ещё раз —
echo   установка продолжится с места остановки.
echo ================================================================
pause
exit /b 0

:badpath
echo [НЕТ!] Папка проекта лежит в OneDrive: %CD%
echo        OneDrive мешает моделям и рендеру. Перенесите проект в C:\history-factory
echo        и запустите setup.bat оттуда.
pause
exit /b 1

:nowinget
echo [НЕТ!] Не найден winget — установщик программ Windows.
echo        Откройте Microsoft Store, найдите «Установщик приложений» / App Installer,
echo        обновите его и запустите setup.bat ещё раз.
pause
exit /b 1

:failvenv
echo [НЕТ!] Не удалось создать окружение Python. Запустите setup.bat ещё раз.
echo        Если не поможет — пришлите текст из этого окна Claude.
pause
exit /b 1

:failpip
echo.
echo [НЕТ!] Библиотеки Python не установились: обрыв связи или нет места на диске.
echo        Запустите setup.bat ещё раз — скачивание продолжится.
pause
exit /b 1

:failnpm
popd
echo.
echo [НЕТ!] Библиотеки видео не установились. Запустите setup.bat ещё раз.
pause
exit /b 1

:failmodels
echo.
echo [НЕТ!] Модели голоса не скачались до конца. Запустите setup.bat ещё раз —
echo        скачивание продолжится с места остановки.
pause
exit /b 1
