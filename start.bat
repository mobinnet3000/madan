@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo   Madan - Start (Windows)
echo ============================================================
echo   Backend : http://localhost:8000
echo   Frontend: http://localhost:5173  (or 5174 / 5175 if busy)
echo ============================================================

REM Backend window
start "Madan Backend" cmd /k "call venv\Scripts\activate.bat && python manage.py runserver 0.0.0.0:8000"

REM Frontend window
start "Madan Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [*] Two windows opened. Close them to stop the servers.
echo [*] Open the Frontend URL above in your browser to use the app.
pause
