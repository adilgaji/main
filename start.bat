@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Фабрика исторических видео

rem  Запуск веб-страницы. Окно не закрывать, пока работаете со страницей.

if not exist ".venv\Scripts\python.exe" goto nosetup
".venv\Scripts\python.exe" -m factory.web %*
if errorlevel 1 goto crashed
exit /b 0

:nosetup
echo [НЕТ!] Фабрика ещё не установлена. Сначала запустите setup.bat.
pause
exit /b 1

:crashed
echo.
echo [НЕТ!] Страница остановилась с ошибкой — текст выше. Пришлите его Claude.
echo        Проверка компьютера: check_env.bat
pause
exit /b 1
