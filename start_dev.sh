#!/bin/bash
# Simple dev script to run everything
# In a real scenario we might use docker-compose, but this is good for quick local dev

# Trap to kill background processes on exit
trap "kill 0" EXIT

echo "Starting Backend..."
cd backend
# Create venv if not exists
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
# Always update deps
./venv/bin/pip install -r requirements.txt

# Default to In-Memory for local dev if not set
export USE_FIRESTORE=${USE_FIRESTORE:-false}

# Note: DATASET_PATH must be set externally to bootstrap the In-Memory database
# Example: export DATASET_PATH="/path/to/your/dataset.csv"


./venv/bin/uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

cd ..

echo "Starting Frontend..."
cd frontend
npm install
npm run dev &
FRONTEND_PID=$!

wait
