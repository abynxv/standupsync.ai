# System Architecture

## What StandupSync Does

StandupSync is a team productivity tool where developers log their daily standups (what they did, what they're doing, any blockers). Every Friday at 9 AM, a Celery background task reads the week's entries, calls Google Gemini to generate a written summary, saves it to the database, and emails it to each developer.

The app has three user roles:
- **Developer** — logs their own standups, reads their own AI digest
- **Team Lead** — everything a developer can do, plus sees their whole team's standups
- **Admin** — full user management, team creation, role assignment

---

## Component Map

```
Browser (React SPA)
      │
      │  HTTP / JSON
      ▼
┌─────────────────┐     ┌─────────────────┐
│   Nginx Ingress  │────▶│  FastAPI :8000   │
│ (cluster edge)  │     │  (API server)    │
└─────────────────┘     └────────┬────────┘
                                  │
               ┌──────────────────┼──────────────────┐
               │                  │                  │
               ▼                  ▼                  ▼
      ┌─────────────┐   ┌─────────────────┐  ┌──────────────┐
      │ PostgreSQL  │   │   Redis :6379   │  │ Gemini API   │
      │  :5432      │   │ (task broker)   │  │  (external)  │
      └─────────────┘   └────────┬────────┘  └──────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
           ┌──────────────┐          ┌──────────────────┐
           │ Celery Worker│          │  Celery Beat     │
           │ (task runner)│          │ (Friday 9AM cron)│
           └──────────────┘          └──────────────────┘
```

---

## Data Flow: Developer Submits a Standup

1. React calls `POST /api/v1/standups/` with a JWT in the `Authorization` header
2. FastAPI validates the JWT → extracts user ID → confirms user is active
3. `standup_service.create_standup()` checks no standup exists for today yet (prevents duplicates)
4. A new `StandupEntry` row is written to PostgreSQL
5. FastAPI returns the saved entry; React updates the timeline immediately

## Data Flow: Weekly Digest (automated)

1. Celery Beat fires at 09:00 UTC every Friday via `crontab(hour=9, minute=0, day_of_week="friday")`
2. The `send_weekly_digests` task fetches all active users from PostgreSQL
3. For each user it loads their `StandupEntry` rows from the past 7 days
4. Calls `ai_service.generate_summary()` → sends entries to Gemini → gets a paragraph back
5. Writes a `WeeklySummary` row (with a unique constraint on `user_id + week_start` to prevent duplicates)
6. Calls `email_service.send_digest_email()` (currently logs to stdout; plug in SendGrid/SES here)
7. If one user fails, the error is logged and the loop continues — other users are unaffected

## Data Flow: Admin Promotes a User to Team Lead

1. Admin opens the Admin panel → selects a new role from the dropdown
2. React calls `PATCH /api/v1/admin/users/{id}/role` with `{ "role": "team_lead" }`
3. FastAPI checks the JWT has `admin` role (via `require_roles(UserRole.ADMIN)`)
4. Updates the `role` column in PostgreSQL
5. On the user's next page load, `GET /api/v1/auth/me` returns the new role
6. The React navbar now shows the "Team View" tab (role-gated on the frontend too)

---

## Technology Choices — the Why

| Technology | Why this one |
|---|---|
| **FastAPI** | Auto-generates OpenAPI docs, native async, Python type hints for validation |
| **SQLAlchemy + Alembic** | ORM with safe schema migrations — schema changes are versioned like code |
| **Celery + Redis** | Proven async task queue; Redis is also the result backend so Beat can track what ran |
| **Google Gemini** | Multimodal, generous free tier, simple Python SDK |
| **JWT (HS256)** | Stateless auth — API can scale to N replicas without a shared session store |
| **React + Vite** | Fast HMR in dev; Vite builds a small static bundle that Nginx serves in production |
| **Docker Compose** | Local dev parity with production; single command to bring up all 6 services |
| **Kubernetes + ArgoCD** | GitOps — Git is the source of truth, ArgoCD syncs cluster state automatically |

---

## Directory Layout

```
StandupSync/
├── backend/
│   ├── app/
│   │   ├── api/v1/routes/    # Route handlers (auth, standups, summaries, admin, teams)
│   │   ├── core/             # JWT auth, RBAC dependencies, app config
│   │   ├── db/               # SQLAlchemy models, session factory
│   │   ├── schemas/          # Pydantic request/response models (validation layer)
│   │   ├── services/         # Business logic (auth, standup, AI, email)
│   │   ├── tasks/            # Celery task definitions
│   │   ├── celery_app.py     # Celery instance + beat schedule
│   │   └── main.py           # FastAPI app entry point
│   ├── alembic/              # Migration scripts
│   └── tests/                # Pytest test suite
├── frontend/
│   └── src/
│       ├── api.js            # Central API client (all fetch calls)
│       ├── App.jsx           # Full app: auth, developer, team lead, admin views
│       └── index.css         # Design system (dark theme, CSS custom properties)
├── k8s/                      # Kubernetes manifests
│   ├── namespace.yaml
│   ├── configmap.yaml        # Non-sensitive config (env vars)
│   ├── secret.yaml           # Sensitive config (passwords, API keys)
│   ├── *-deployment.yaml     # One per service
│   ├── *-service.yaml        # ClusterIP / NodePort
│   ├── ingress.yaml          # Routes /api → backend, / → frontend
│   └── argocd-app.yaml       # ArgoCD Application CRD
├── .github/workflows/
│   └── ci.yml                # Test → Build → Push → Update k8s tags → ArgoCD syncs
└── docker-compose.yml        # Local dev: all 6 services
```
