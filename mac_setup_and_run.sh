#!/bin/bash
echo "========================================="
echo "Setting up and Starting Exam Generator Web App"
echo "========================================="

# Change to the directory where the script is located
cd "$(dirname "$0")"

# Terminate background processes when script exits
trap "echo 'Stopping servers...'; kill 0" EXIT

# ---------------------------------------------------------
# 1. Backend Setup
# ---------------------------------------------------------
echo "Checking Backend Environment..."
cd backend

# Recreate virtual environment if it doesn't exist or is a broken Windows venv
if [ ! -f "venv/bin/activate" ]; then
    echo "Creating Python virtual environment for Mac..."
    rm -rf venv
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
echo "Verifying backend dependencies..."
pip install -r requirements.txt
cd ..

# ---------------------------------------------------------
# 2. Frontend Setup
# ---------------------------------------------------------
echo "Checking Frontend Environment..."
cd frontend

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed!"
    echo "Please download and install Node.js from https://nodejs.org/"
    echo "Then re-run this script."
    exit 1
fi

# Check for copied Windows node_modules and remove if found
if [ -d "node_modules" ] && [ ! -x "node_modules/.bin/vite" ]; then
    echo "Detected Windows node_modules. Cleaning up for Mac..."
    rm -rf node_modules
fi

# Install node modules
echo "Verifying frontend dependencies..."
npm install
cd ..

# ---------------------------------------------------------
# 3. Start Servers
# ---------------------------------------------------------
echo "========================================="
echo "Starting Servers..."
echo "The frontend will be available at http://localhost:5173"
echo "The backend API will be available at http://localhost:8000"
echo "Press Ctrl+C to stop both servers."
echo "========================================="

# Start Backend Server
cd backend
source venv/bin/activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
cd ..

# Start Frontend Server
cd frontend
npm run dev &
cd ..

# Wait for both background processes
wait
