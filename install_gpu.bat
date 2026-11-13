@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Ускорение на видеокарте

rem  По желанию: PyTorch для видеокарты NVIDIA — озвучка быстрее.
rem  Версия torch та же, что в requirements.txt, сборка с CUDA 13.2 — нужен драйвер 580 или новее.
rem  Если видеокарта не заработает, фабрика сама продолжит на процессоре.

if not exist ".venv\Scripts\python.exe" goto nosetup
where nvidia-smi >nul 2>&1
if errorlevel 1 goto nogpu

set "DRV="
for /f "tokens=1 delims=." %%a in ('nvidia-smi --query-gpu^=driver_version --format^=csv^,noheader') do if not defined DRV set "DRV=%%a"
if not defined DRV goto nogpu
echo Драйвер NVIDIA: версия %DRV%
if %DRV% LSS 580 goto olddriver

echo.
echo Скачиваю PyTorch для видеокарты, около 2,5-3 ГБ.
echo Если связь оборвётся — запустите install_gpu.bat ещё раз, скачивание продолжится.
echo.
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check --resume-retries 100 --timeout 120 "torch==2.15.0+cu132" --index-url https://download.pytorch.org/whl/cu132
if errorlevel 1 goto fail

".venv\Scripts\python.exe" -c "import torch; ok = torch.cuda.is_available(); print('Видеокарта:', torch.cuda.get_device_name(0) if ok else 'не видна'); raise SystemExit(0 if ok else 3)"
if errorlevel 1 goto notvisible
echo.
echo [ OK ] Готово: озвучка будет работать на видеокарте.
echo        При любой ошибке видеокарты фабрика сама перейдёт на процессор.
pause
exit /b 0

:nosetup
echo [НЕТ!] Сначала запустите setup.bat.
pause
exit /b 1

:nogpu
echo [ !! ] Видеокарта NVIDIA не найдена: nvidia-smi не отвечает.
echo        Поставьте свежий драйвер с nvidia.com и перезагрузите ноутбук.
echo        Без этого фабрика работает на процессоре — медленнее, но работает.
pause
exit /b 1

:olddriver
echo [ !! ] Драйвер NVIDIA версии %DRV% слишком старый: нужен 580 или новее.
echo        Обновите драйвер через приложение NVIDIA или nvidia.com, перезагрузите
echo        ноутбук и запустите install_gpu.bat ещё раз.
pause
exit /b 1

:fail
echo.
echo [НЕТ!] Скачивание не закончилось. Запустите install_gpu.bat ещё раз — оно продолжится.
pause
exit /b 1

:notvisible
echo.
echo [ !! ] PyTorch установлен, но видеокарту не видит. Обновите драйвер NVIDIA и
echo        перезагрузите ноутбук. Пока фабрика работает на процессоре.
pause
exit /b 1
