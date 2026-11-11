@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem  Проверка компьютера. Ничего не устанавливает и не меняет.
rem  Ищем Python: сначала свой .venv, потом py -3.12, потом любой python.

set "PY="
if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"
if defined PY goto run

py -3.12 -c "import sys" >nul 2>&1
if not errorlevel 1 set "PY=py -3.12"
if defined PY goto run

py -3 -c "import sys" >nul 2>&1
if not errorlevel 1 set "PY=py -3"
if defined PY goto run

python -c "import sys" >nul 2>&1
if not errorlevel 1 set "PY=python"
if defined PY goto run

echo.
echo [НЕТ!] Python не найден. Без него проверку запустить нельзя.
echo.
echo   1. Нажмите Win+X и выберите "Терминал".
echo   2. Выполните:   winget install Python.Python.3.12
echo   3. Закройте Терминал и запустите check_env.bat ещё раз.
echo.
pause
exit /b 1

:run
%PY% scripts\check_env.py %*
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
