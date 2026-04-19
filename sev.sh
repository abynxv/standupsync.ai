#!/bin/bash

# Function to stop background processes
cleanup() {
    echo "Stopping all services..."
    # Kill background jobs
    kill $(jobs -p) 2>/dev/null
    
    # Optional: stop docker containers
    # echo "Stopping Docker infrastructure..."
    # docker compose stop db redis
    
    exit
}

# Trap Ctrl+C (SIGINT)
trap cleanup SIGINT

echo "🚀 Starting StandupSync Application (Hybrid Setup)..."

# 0. Start Infrastructure via Docker
echo "🐳 Starting PostgreSQL and Redis via Docker..."
docker compose up -d db redis

echo "⏳ Waiting for database to be ready..."
# Simple wait loop for postgres
until docker exec $(docker compose ps -q db) pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done
echo "✅ Database is ready!"

# Check if venv exists
if [ ! -d ".venv" ]; then
    echo "❌ .venv directory not found. Please run setup first."
    exit 1
fi

# Activate virtual environment
source .venv/bin/activate
VENV_PYTHON="$(pwd)/.venv/bin/python3"

# 1. Run Migrations
echo "📦 Running database migrations..."
cd backend
$VENV_PYTHON -m alembic upgrade head
if [ $? -ne 0 ]; then
    echo "⚠️  Migrations failed. Regenerating migration if needed..."
    $VENV_PYTHON -m alembic revision --autogenerate -m "Initial migration"
    $VENV_PYTHON -m alembic upgrade head
fi
cd ..

# 2. Start Backend
echo "Backend API starting on http://localhost:8000..."
cd backend
$VENV_PYTHON -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
cd ..

# 3. Start Celery Worker
echo "Worker starting..."
cd backend
$VENV_PYTHON -m celery -A app.celery_app worker --loglevel=info &
cd ..

# 4. Start Frontend
echo "Frontend starting on http://localhost:5173..."
cd frontend
npm run dev &
cd ..

echo ""
echo "✅ All services are attempting to start!"
echo "- Backend API: http://localhost:8000"
echo "- Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop all services."

# Wait for background processes
wait
