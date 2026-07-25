@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo   Madan - One-click Setup (Windows)
echo ============================================================

REM ---- Check Python ----
where python >nul 2>nul
if errorlevel 1 (
  echo [!] Python not found. Please install Python 3.11-3.13 and add it to PATH.
  pause
  exit /b 1
)

REM ---- Python virtual environment ----
if not exist "venv\" (
  echo [*] Creating Python virtual environment...
  python -m venv venv
)
call venv\Scripts\activate.bat

echo [*] Upgrading pip...
python -m pip install --upgrade pip

echo [*] Installing Python dependencies...
pip install -r requirements.txt

echo [*] Applying database migrations...
python manage.py makemigrations
python manage.py migrate

echo [*] Seeding demo data (this may take a minute)...
python seed_demo.py

REM ---- Node frontend ----
echo [*] Installing frontend dependencies...
cd frontend
if not exist "node_modules\" (
  call npm install
) else (
  echo     (node_modules already exists, skipping npm install)
)
echo [*] Building frontend...
call npm run build
cd ..

echo ============================================================
echo   Setup complete!
echo   Now run start.bat to launch the application.
echo ============================================================
pause
