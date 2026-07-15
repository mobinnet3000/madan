#!/usr/bin/env bash
# Madan - Start script for Linux / macOS
# Installs dependencies on first run, then launches backend + frontend.
set -e
cd "$(dirname "$0")"

echo "============================================================"
echo "  Madan - Start (Linux / macOS)"
echo "  Backend : http://localhost:8000"
echo "  Frontend: http://localhost:5173  (or 5174 / 5175 if busy)"
echo "============================================================"

# ---- Python backend ----
if [ ! -d "venv" ]; then
  echo "[*] Creating Python virtual environment..."
  python3 -m venv venv
  ./venv/bin/pip install --upgrade pip
  ./venv/bin/pip install -r requirements.txt
  ./venv/bin/python manage.py migrate
  echo "[*] Seeding demo data (this may take a minute)..."
  ./venv/bin/python seed_demo.py
fi

# ---- Node frontend ----
cd frontend
if [ ! -d "node_modules" ]; then
  echo "[*] Installing frontend dependencies..."
  npm install
fi
echo "[*] Building frontend..."
npm run build
cd ..

# ---- Launch both ----
./venv/bin/python manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!
cd frontend && npm run dev &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "[*] Stopping servers..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
wait
