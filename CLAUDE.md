# StandupSync — Claude Context

## What this project is
A team standup tracker with AI-generated weekly digests. Developers log daily standups; Celery generates a Gemini-powered summary every Friday at 9AM UTC; admins manage users and teams.

## Tech stack
- **Backend**: FastAPI + SQLAlchemy + Alembic + Celery + Redis + PostgreSQL
- **AI**: Google Gemini via `google-genai` SDK (model: `gemini-2.0-flash`)
- **Frontend**: React + Vite (no router — tab-based SPA)
- **Package manager**: `uv` (not pip or poetry)
- **Infra**: Docker Compose (local), Kubernetes + ArgoCD (production)

## Running locally
```bash
./sev.sh            # hybrid mode: Docker for DB+Redis, local FastAPI+Vite
```
Or `docker compose up --build -d` for full Docker.

## Running tests
```bash
cd backend && uv run python -m pytest -v
```
Tests use in-memory SQLite — no live DB needed. 28 tests across `test_main.py`, `test_auth.py`, `test_standups.py`.

## Key architecture decisions
- All self-registrations are `developer` role — only admins can promote via `PATCH /admin/users/{id}/role`
- JWT is stateless HS256 — no session store needed
- RBAC via `require_roles()` factory in `core/dependencies.py`; shortcuts: `get_current_admin`, `get_current_team_lead`, `get_current_user`
- Celery Beat (`replicas: 1` always — duplicates break weekly digest)
- `initContainers` in backend K8s Deployment runs `alembic upgrade head` before app starts

## Important files
- `backend/app/core/dependencies.py` — JWT validation + RBAC
- `backend/app/db/models.py` — all SQLAlchemy models
- `backend/app/tasks/digest.py` — weekly digest Celery task (per-user error isolation)
- `frontend/src/api.js` — all API calls; uses Vite proxy `/api` → `localhost:8000`
- `frontend/src/App.jsx` — full React app: auth, developer, team lead, admin views
- `k8s/` — all Kubernetes manifests
- `.github/workflows/ci.yml` — test → build → push → update k8s tags → ArgoCD syncs

## Alembic migrations
Two migrations exist:
1. `33ea74a9b86d` — initial schema (all tables)
2. `b2f4e8c1d9a3` — constraints + indexes (UniqueConstraint on weekly_summaries, cascade FKs, date index)

After changing `db/models.py`: `cd backend && uv run alembic revision --autogenerate -m "description"`

## Docs
Full documentation in `docs/`:
- `01-architecture.md` — system overview and data flows
- `02-local-setup.md` — dev environment setup
- `03-backend.md` — FastAPI, auth, RBAC, Celery deep dive
- `04-api-reference.md` — all endpoints with curl examples
- `05-frontend.md` — React architecture and patterns
- `06-kubernetes.md` — manifest walkthrough and Minikube deploy guide
- `07-cicd.md` — GitHub Actions pipeline and GitOps flow

## What's next (planned)
- Email service integration (SendGrid/SES) — currently logs to stdout in `services/email_service.py`
- Rate limiting on auth endpoints (add `slowapi` dependency)
- Kubernetes deployment to a real cluster (manifests in `k8s/` are production-ready)
