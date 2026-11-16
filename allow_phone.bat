@echo off
chcp 65001 >nul
rem Разрешить телефону открывать фабрику в домашней Wi-Fi (порт 8765, только «частные» сети).
net session >nul 2>&1 || (powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs" & exit /b)
netsh advfirewall firewall delete rule name="Shorts factory (phone)" >nul 2>&1
netsh advfirewall firewall add rule name="Shorts factory (phone)" dir=in action=allow protocol=TCP localport=8765 profile=private
rem Tailscale (вне дома): только адреса вашей личной сети Tailscale 100.64.0.0/10
netsh advfirewall firewall delete rule name="Shorts factory (Tailscale)" >nul 2>&1
netsh advfirewall firewall add rule name="Shorts factory (Tailscale)" dir=in action=allow protocol=TCP localport=8765 remoteip=100.64.0.0/10 profile=any
echo.
echo Готово: телефон теперь может открыть фабрику — дома по Wi-Fi и вне дома через Tailscale.
echo Если не открывается: Параметры - Сеть и Интернет - Wi-Fi - ваша сеть - Тип профиля: Частная.
pause
