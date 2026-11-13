@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Обновление фабрики

rem  Обновление: git pull + доустановка библиотек. Ваши настройки и словарь сохраняются,
rem  их копия кладётся в logs\backup.

if not exist ".venv\Scripts\python.exe" goto nosetup
".venv\Scripts\python.exe" scripts\update.py
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%

:nosetup
echo [НЕТ!] Фабрика ещё не установлена. Запустите setup.bat.
pause
exit /b 1
