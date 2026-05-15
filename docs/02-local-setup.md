# Local Development Setup

Two ways to run StandupSync locally. Use **Option B** (hybrid) for day-to-day development — it gives you hot-reload and faster iteration.

---

## Prerequisites

| Tool | Install |
|---|---|
| Docker Desktop | https://docs.docker.com/get-docker/ |
| uv (Python package manager) | `curl -Ls https://astral.sh/uv/install.sh \| sh` |
| Node.js v18+ | https://nodejs.org |

---

## Environment Variables

Create a `.env` file in the project root (never commit this):

```env
# Database (used by backend + alembic migrations)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/standupsync

# Celery (Redis runs on port 6380 locally to avoid conflicts)
CELERY_BROKER_URL=redis://localhost:6380/0
CELERY_RESULT_BACKEND=redis://localhost:6380/0

# Auth — generate a real secret: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=change-me-in-production

# Google Gemini — get a free key at https://aistudio.google.com/
GEMINI_API_KEY=your-key-here

# CORS — which browser origins can call the API
FRONTEND_ORIGINS=http://localhost:5173,http://localhost:3000
```

> **Port offsets explained**: PostgreSQL uses `5433` (not 5432) and Redis uses `6380` (not 6379) on the host. This avoids conflicting with any locally installed Postgres/Redis. Inside Docker Compose, services talk to each other on their default internal ports (5432 / 6379).

---

## Option A — Full Docker (Production-Like)

Runs all 6 services in isolated containers. Use this to verify the production build works.

```bash
docker compose up --build -d
```

| Service | URL |
|---|---|
| Frontend (React) | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/api/v1/docs |

Stop everything:
```bash
docker compose down
```

Stop and delete all data (including the PostgreSQL volume):
```bash
docker compose down -v
```

---

## Option B — Hybrid Mode (Recommended for Development)

Only PostgreSQL and Redis run in Docker. The backend, worker, and frontend run locally so you get **hot-reload** on every file save.

```bash
chmod +x sev.sh
./sev.sh
```

What `sev.sh` does step by step:
1. `docker compose up -d db redis` — starts only the infrastructure containers
2. Waits until PostgreSQL is ready (`pg_isready`)
3. Activates the `.venv` virtual environment
4. Runs `alembic upgrade head` — applies any pending DB migrations
5. Starts FastAPI with `--reload` on port 8000
6. Starts a Celery worker
7. Starts the Vite dev server on port 5173

All three processes run in the background. Press `Ctrl+C` once to kill them all.

| Service | URL |
|---|---|
| Frontend (Vite, hot-reload) | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/api/v1/docs |

---

## Database Migrations

Migrations are how you safely change the database schema without losing data. Alembic tracks schema changes the same way Git tracks code changes.

```bash
cd backend

# After changing a model in db/models.py, generate a migration:
uv run alembic revision --autogenerate -m "add team membership table"

# Apply all pending migrations to the database:
uv run alembic upgrade head

# Roll back the last migration (undo):
uv run alembic downgrade -1

# See migration history:
uv run alembic history
```

**When to run migrations:**
- After any change to `backend/app/db/models.py`
- When you first clone the project
- `sev.sh` runs `alembic upgrade head` automatically on startup

---

## Running Tests

```bash
cd backend

# Run all tests
uv run pytest

# Run with output (see print statements)
uv run pytest -s

# Run a specific test file
uv run pytest tests/test_main.py -v
```

The test suite uses `TestClient` from FastAPI which runs the app in-process — no running server needed. Tests that require a real database (integration tests) are excluded from the default suite.

---

## Creating the First Admin User

All users self-register as `developer`. To get an admin account, either:

**Option 1 — Promote via SQL** (quickest for local dev):
```bash
# Connect to the database
docker exec -it standupsync-db-1 psql -U postgres -d standupsync

# Run inside psql:
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
\q
```

**Option 2 — Promote via API** (once you have one admin):
```bash
# Get your user ID first
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <your-token>"

# Admin promotes another user
curl -X PATCH http://localhost:8000/api/v1/admin/users/2/role \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

---

## Project-Specific Commands Reference

```bash
# Backend — install dependencies
cd backend && uv sync

# Backend — start dev server
cd backend && uv run uvicorn app.main:app --reload --port 8000

# Backend — start Celery worker
cd backend && uv run celery -A app.celery_app worker --loglevel=info

# Backend — start Celery Beat scheduler
cd backend && uv run celery -A app.celery_app beat --loglevel=info

# Frontend — install dependencies
cd frontend && npm install

# Frontend — start dev server
cd frontend && npm run dev

# Frontend — build for production
cd frontend && npm run build
```
