@echo off
cd /d "%~dp0web"
start "UniVista Early Access" cmd /k python -m http.server 8755
timeout /t 2 /nobreak >nul
start http://127.0.0.1:8755/
