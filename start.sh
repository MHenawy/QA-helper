#!/bin/bash
echo "========================================="
echo "Starting Exam Generator Web App"
echo "========================================="

# Change to the directory where the script is located
cd "$(dirname "$0")"

# Terminate background processes when script exits
trap "kill 0" EXIT

echo "Starting Backend Server (FastAPI)..."
cd backend
if [ -d "venv/bin" ]; then
    source venv/bin/activate
elif [ -d "venv/Scripts" ]; then
    # Fallback in case running on git bash on windows
    source venv/Scripts/activate
fi
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
cd ..

echo "Starting Frontend Server (React/Vite)..."
cd frontend
npm run dev &
cd ..

echo "Both servers are starting..."
echo "The frontend will be available at http://localhost:5173"
echo "The backend API will be available at http://localhost:8000"
echo "Press Ctrl+C to stop both servers."

# Wait for both background processes
wait
