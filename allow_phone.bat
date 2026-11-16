@echo off
chcp 65001 >nul
rem Разрешить телефону открывать фабрику в домашней Wi-Fi (порт 8765, только «частные» сети).
net session >nul 2>&1 || (powershell -Command "Start-Process -FilePath %~f0 -Verb RunAs" & exit /b)
netsh advfirewall firewall delete rule name="Shorts factory (phone)" >nul 2>&1
netsh advfirewall firewall add rule name="Shorts factory (phone)" dir=in action=allow protocol=TCP localport=8765 profile=private
echo.
echo Готово: телефон в вашей Wi-Fi теперь может открыть фабрику.
echo Если не открывается: Параметры - Сеть и Интернет - Wi-Fi - ваша сеть - Тип профиля: Частная.
pause
