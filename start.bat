@echo off
echo =========================================
echo Starting Exam Generator Web App
echo =========================================

echo Starting Backend Server (FastAPI)...
start cmd /k "cd backend && .\venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo Starting Frontend Server (React/Vite)...
start cmd /k "cd frontend && npm run dev"

echo Both servers should now be starting in separate windows.
echo The frontend will be available at http://localhost:5173
echo The backend API will be available at http://localhost:8000
