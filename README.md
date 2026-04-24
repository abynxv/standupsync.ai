# StandupSync AI

StandupSync is a productivity tool that automates daily standups and generates AI-powered weekly digests. It tracks team updates and produces actionable summaries using Google Gemini, backed by a FastAPI service layer with Celery-based async task processing.

---

## Architecture

```mermaid
graph TD
    Client[React SPA] <--> API[FastAPI Backend :8000]
    API <--> DB[(PostgreSQL :5433)]
    API <--> Redis[(Redis :6380)]
    Redis <--> Worker[Celery Worker]
    Redis <--> Beat[Celery Beat Scheduler]
    Worker <--> AI[Google Gemini API]
    API <--> AI
```

**Data flow**: Client sends requests to the FastAPI backend. The backend reads/writes to PostgreSQL for persistence and publishes async tasks (AI digest generation, scheduled standups) to Redis. Celery workers consume these tasks and call the Gemini API for AI operations. Celery Beat triggers scheduled tasks (e.g., weekly digest generation) at configured intervals.

---

## Tech Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| API | FastAPI (Python 3.11) | Async REST API with auto-generated OpenAPI docs |
| Package Manager | uv | Rust-based Python dependency manager (replaces pip/poetry) |
| Database | PostgreSQL 15 | Primary data store |
| ORM | SQLAlchemy + Alembic | Object mapping and schema migrations |
| Task Queue | Celery + Redis | Async background job processing |
| AI | Google Gemini Pro | Weekly digest generation |
| Frontend | React + Vite | SPA served via Nginx in production |
| Containers | Docker + Docker Compose | Service isolation and orchestration |
| CI/CD | GitHub Actions | Automated testing and image publishing |
| Deployment | Kubernetes + ArgoCD | Container orchestration and GitOps delivery *(planned)* |

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/v1/routes/    # API route handlers
│   │   ├── core/             # Config, security, auth dependencies
│   │   ├── db/               # SQLAlchemy models, session management
│   │   ├── schemas/          # Pydantic request/response models
│   │   ├── services/         # Business logic layer
│   │   ├── tasks/            # Celery task definitions
│   │   ├── celery_app.py     # Celery app instance & config
│   │   └── main.py           # FastAPI app entry point
│   ├── alembic/              # Database migration scripts
│   ├── tests/                # Pytest test suite
│   ├── Dockerfile            # Backend container image definition
│   └── pyproject.toml        # Python project & dependency manifest (uv)
├── frontend/
│   ├── src/                  # React components, pages, styles
│   ├── Dockerfile            # Frontend multi-stage build
│   └── package.json          # Node.js dependencies
├── .github/workflows/
│   └── ci.yml                # GitHub Actions CI/CD pipeline
├── docker-compose.yml        # Local multi-service orchestration
├── sev.sh                    # Hybrid dev mode runner script
└── .env                      # Environment variables (not committed)
```

---

## Getting Started

### Prerequisites

- Docker & Docker Compose (V2)
- [uv](https://github.com/astral-sh/uv) (for local backend development)
- Node.js v18+ (for local frontend development)

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/standupsync
CELERY_BROKER_URL=redis://localhost:6380/0
CELERY_RESULT_BACKEND=redis://localhost:6380/0
GEMINI_API_KEY=<your-google-gemini-api-key>
SECRET_KEY=<your-jwt-signing-secret>
```

> **Note**: Inside Docker Compose, services communicate over Docker's internal network. The backend connects to `db:5432` and `redis:6379` (internal ports), not the host-mapped ports `5433`/`6380`.

### Running the Application

#### Option A — Full Docker (Production-Like)

Starts all 6 services as isolated containers:

```bash
docker compose up --build -d
```

| Service | URL | Description |
|:---|:---|:---|
| Backend API | http://localhost:8000 | FastAPI + Swagger UI at `/docs` |
| Frontend | http://localhost:3000 | React app served by Nginx |

#### Option B — Hybrid Dev Mode (Faster Iteration)

Only DB and Redis run in Docker. Backend, worker, and frontend run locally so you get hot-reload.

```bash
chmod +x sev.sh
./sev.sh
```

What `sev.sh` does:
1. `docker compose up -d db redis` — starts infrastructure containers
2. Waits for PostgreSQL readiness via `pg_isready`
3. Activates the `.venv` virtual environment
4. Runs Alembic migrations (`alembic upgrade head`)
5. Starts the FastAPI dev server (port 8000, with `--reload`)
6. Starts a Celery worker process
7. Starts the Vite dev server (port 5173)

All processes are backgrounded and killed on `Ctrl+C`.

---

## Docker — How It Works

### Backend Dockerfile (`backend/Dockerfile`)

```dockerfile
FROM python:3.11-slim

# Copy the uv binary from the official image (no pip install needed)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Pre-compile Python files to .pyc for faster cold starts
ENV UV_COMPILE_BYTECODE=1

# Copy dependency manifests first (this layer is cached unless deps change)
COPY pyproject.toml uv.lock README.md ./

# Install production dependencies only (--no-dev skips test/lint deps)
# --frozen ensures the lockfile is used exactly as-is (no re-resolving)
RUN uv sync --frozen --no-dev

# Copy application source code (changes here don't bust the dep cache)
COPY . .

EXPOSE 8000

# uv run handles virtualenv activation — no manual "source activate" needed
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Key design decisions:**
- **Layer caching**: Dependency manifests are copied _before_ the source code. Docker layer caching means `uv sync` only re-runs when `pyproject.toml` or `uv.lock` actually changes, not on every code edit.
- **uv instead of pip**: `uv` is a Rust-based package manager that resolves and installs dependencies 10-100x faster than pip. The binary is copied from the official `ghcr.io/astral-sh/uv` image.
- **`--frozen --no-dev`**: Ensures deterministic builds (lockfile is not re-solved) and excludes dev dependencies for a smaller production image.
- **`UV_COMPILE_BYTECODE=1`**: Pre-compiles `.py` → `.pyc` at build time so the container starts faster.

### Frontend Dockerfile (`frontend/Dockerfile`)

```dockerfile
# Stage 1: Build — compiles React/Vite source into static assets
FROM node:18-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build          # Output → /app/dist/

# Stage 2: Serve — lightweight Nginx image serves the static build
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Key design decisions:**
- **Multi-stage build**: The `node:18-slim` image (~180MB) is used only for building. The final image uses `nginx:stable-alpine` (~25MB), so the shipped container is extremely small.
- **`COPY --from=build`**: Only the compiled static assets (`/app/dist`) are copied to the final image. Node.js, `node_modules`, and source code are discarded.
- **Nginx serves static files**: Vite's dev server is not used in production. Nginx handles static file serving, caching headers, and compression efficiently.

### Docker Compose (`docker-compose.yml`)

The Compose file defines 6 services:

| Service | Base Image | What It Does |
|:---|:---|:---|
| `db` | `postgres:15-alpine` | PostgreSQL database, data persisted in `postgres_data` volume |
| `redis` | `redis:7-alpine` | Message broker for Celery + result backend |
| `backend` | Built from `./backend` | FastAPI application server |
| `worker` | Built from `./backend` | Celery worker — consumes async tasks (same image, different entrypoint) |
| `beat` | Built from `./backend` | Celery Beat — schedules periodic tasks (same image, different entrypoint) |
| `frontend` | Built from `./frontend` | Nginx serving compiled React app |

**Important**: `worker` and `beat` use the same Docker image as `backend` but override the `CMD` with their respective Celery commands. This avoids building separate images for the same codebase.

**Port mapping** (host:container):
- `5433:5432` — PostgreSQL (host port offset to avoid conflicts with local installs)
- `6380:6379` — Redis (same reason)
- `8000:8000` — Backend API
- `3000:80` — Frontend (Nginx container listens on 80, mapped to 3000 on host)

**Internal networking**: Docker Compose creates a shared network. Services reference each other by service name (e.g., `db`, `redis`), not `localhost`. That's why the backend's `DATABASE_URL` inside Compose is `postgresql://postgres:postgres@db/standupsync` (using `db` as hostname), while locally it's `@localhost:5433`.

---

## CI/CD Pipeline — GitHub Actions

The pipeline is defined in `.github/workflows/ci.yml` and runs on every push/PR to `main`.

### Pipeline Stages

```mermaid
graph LR
    A[Push to main] --> B[backend-test]
    B -->|Tests pass| C[build-and-push]
    C --> D1[Push backend image to Docker Hub]
    C --> D2[Push frontend image to Docker Hub]
```

### Stage 1: `backend-test`

**Trigger**: Every push and pull request to `main`.

**What it does:**
1. Checks out the repository
2. Installs `uv` via the official `astral-sh/setup-uv@v3` action (with dependency caching enabled)
3. Sets up Python 3.11
4. Installs project dependencies: `cd backend && uv sync --frozen`
5. Runs the test suite: `cd backend && uv run pytest`

If any test fails, the pipeline stops. No images are built or pushed.

### Stage 2: `build-and-push`

**Trigger**: Only on direct pushes to `main` (not PRs). Depends on `backend-test` passing.

**What it does:**
1. Authenticates to Docker Hub using repository secrets (`DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN`)
2. Sets up Docker Buildx (enables advanced build features like layer caching and multi-platform builds)
3. Builds and pushes **two images**:

| Image | Tags | Build Context |
|:---|:---|:---|
| `<username>/standupsync-backend` | `latest`, `<git-sha>` | `./backend` |
| `<username>/standupsync-frontend` | `latest`, `<git-sha>` | `./frontend` |

**Tagging strategy:**
- **`latest`**: Always points to the most recent build from `main`. Used as the default pull target.
- **`<git-sha>`** (e.g., `a1b2c3d`): An immutable tag tied to a specific commit. This is critical for production deployments — you can always trace a running container back to the exact code that built it. Kubernetes manifests should reference SHA tags, not `latest`.

### Docker Hub (Container Registry)

Docker Hub acts as the container registry — a centralized store for your built images. After the CI pipeline pushes images:

1. Images are stored at `docker.io/<username>/standupsync-backend` and `docker.io/<username>/standupsync-frontend`
2. Any environment (staging, production, Kubernetes) can `docker pull` these images
3. The SHA-tagged images provide an immutable deployment artifact — the image for commit `a1b2c3d` will never change

**Why a registry matters**: Without a registry, you'd need to build images on every machine that runs the app. With a registry, CI builds once, and all downstream consumers (local dev, staging, production, Kubernetes nodes) pull the pre-built image.

### Required Repository Secrets

Configure these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Value |
|:---|:---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | A Docker Hub [Personal Access Token](https://hub.docker.com/settings/security) (not your password) |

---

## Kubernetes & ArgoCD Deployment (Planned)

> This section describes the planned GitOps deployment pipeline using Kubernetes and ArgoCD.

### Deployment Architecture

```mermaid
graph LR
    Dev[Developer Push] --> GH[GitHub Actions CI]
    GH -->|Build & Push Images| DHB[Docker Hub Registry]
    GH -->|Update image tag| KR[K8s Manifests Repo]
    KR -->|Watches for changes| Argo[ArgoCD]
    Argo -->|Syncs desired state| K8s[Kubernetes Cluster]
    DHB -->|Pulls images| K8s
```

### How It Will Work

1. **Developer pushes code** to the `main` branch
2. **GitHub Actions** runs tests, builds Docker images, and pushes them to Docker Hub with the commit SHA tag
3. **Image tag update**: The CI pipeline updates the Kubernetes manifest repository (or the `k8s/` directory in this repo) with the new image tag
4. **ArgoCD watches** the manifest repository for changes. When it detects a new image tag, it automatically syncs the cluster
5. **Kubernetes pulls** the new image from Docker Hub and performs a rolling update (zero downtime)

### Planned Kubernetes Resources

| Resource | Purpose |
|:---|:---|
| `Deployment` — backend | Runs FastAPI pods (replicas for HA) |
| `Deployment` — worker | Runs Celery worker pods |
| `Deployment` — beat | Single replica for the Celery scheduler |
| `Deployment` — frontend | Runs Nginx pods serving the React build |
| `Service` — backend | ClusterIP service for internal API routing |
| `Service` — frontend | LoadBalancer/Ingress for external access |
| `ConfigMap` | Non-sensitive config (API version, feature flags) |
| `Secret` | Sensitive values (DB credentials, API keys, JWT secret) |
| `PersistentVolumeClaim` | PostgreSQL data persistence |
| `Ingress` | Route external traffic to frontend and API |

### ArgoCD GitOps Workflow

ArgoCD implements the **GitOps** pattern: the Git repository is the single source of truth for your cluster state. Instead of running `kubectl apply` manually, you commit manifest changes to Git and ArgoCD handles the rest.

**Key concepts:**
- **Application CRD**: An ArgoCD `Application` resource points to a Git repo path containing Kubernetes manifests. ArgoCD continuously compares the desired state (Git) with the actual state (cluster).
- **Sync**: When Git and cluster state diverge, ArgoCD can auto-sync or wait for manual approval.
- **Rollback**: Since every deployment is a Git commit, rolling back is just reverting a commit.
- **Health checks**: ArgoCD monitors pod health and reports deployment status in its dashboard.

---

## Development Workflow

### Backend

```bash
cd backend
uv sync                    # Install all dependencies (including dev)
uv run pytest              # Run test suite
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload  # Dev server with hot-reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev                # Vite dev server on http://localhost:5173
```

### Database Migrations

```bash
cd backend
uv run alembic revision --autogenerate -m "description"  # Generate migration from model changes
uv run alembic upgrade head                               # Apply all pending migrations
uv run alembic downgrade -1                               # Rollback last migration
```

---

## 🧠 Deep Dive: Backend Engineer Perspective

This section explains exactly what happens under the hood across the entire CI/CD and Deployment pipeline.

### 1. Docker Build & Registry Flow

#### The Multi-Stage Build Strategy
In our `frontend/Dockerfile`, we use a **Multi-Stage Build**.
- **Stage 1 (Build)**: We use a heavy Node.js image to compile the React code into static assets. This includes all the `node_modules` (hundreds of MBs).
- **Stage 2 (Production)**: We only copy the small `/dist` folder into a lightweight Nginx image.
**Result**: The final image is ~20MB instead of ~500MB, reducing deployment time and security surface area.

#### The Image Registry (Push/Pull)
- **Push**: Success in your Local Environment (or GitHub Actions) is followed by `docker push`. This uploads the layers to **Docker Hub**. Each layer is unique; if only your code changes but dependencies don't, only the code layer is uploaded.
- **Pull**: When Kubernetes starts a Pod, the Kubelet on the node runs `docker pull`. It only downloads missing layers. Using `latest` as a tag is risky in production; we use `latest` for local dev but **commit SHAs** for production to ensure exactly what was tested is what runs.

### 2. CI/CD: The GitHub Actions Engine

The `.github/workflows/ci.yml` is the orchestrator.
- **Automated Testing**: On every PR/Push, it starts a fresh Ubuntu runner, installs `uv`, and runs `pytest`. If tests fail, the pipeline stops—preventing broken code from ever reaching the registry.
- **Buildx**: We use `docker/setup-buildx-action`. Buildx is the next-gen Docker build engine that allows building for multiple architectures (like ARM and x64) and advanced layer caching.

### 3. Kubernetes: The Orchestration Layer

Kubernetes doesn't just "run" containers; it maintains "Desired State".

#### Key Controller Mechanics:
- **Deployment**: If a container crashes, the **ReplicaSet** controller notices the "Actual State" (0 pods) doesn't match the "Desired State" (1 pod) and instantly schedules a replacement.
- **Service (ClusterIP vs NodePort)**:
  - `ClusterIP`: A virtual IP available only inside the cluster. Databases use this for security.
  - `NodePort`: Opens a specific port (30000-32767) on EVERY node in your cluster. This is how we access the app locally via `minikube service`.
- **ConfigMaps & Secrets**: Instead of hardcoding credentials, we "mount" them as Environment Variables. This allows the SAME container image to run in Dev, Staging, and Production by just changing the ConfigMap/Secret attached to it.
- **Readiness Probes**: The `backend-deployment.yaml` has a probe that pings `/docs`. If your backend takes 30s to start (e.g., waiting for migrations), K8s won't send a single request to it until it responds 200 OK. This enables **Zero-Downtime Deployments**.

### 4. ArgoCD: The GitOps Heart

ArgoCD implements the **Pull Model** of deployment.

- **Sync Loop**: ArgoCD continuously compares your `k8s/*.yaml` files in GitHub with the resources running in your Minikube/Cluster.
- **Self-Healing**: If you manually change a Service port via `kubectl` (manual "drifts"), ArgoCD will notice and **automatically change it back** to what's in Git. Git is the "Single Source of Truth".
- **Application Manifest (`k8s/argocd-app.yaml`)**: This is the configuration for ArgoCD itself. It tells Argo: "Watch repository X, path Y, and ensure the Cluster namespace Z looks exactly like that."

---

## 🛠 Kubernetes Commands (Cheat Sheet)

### Cluster Management
```bash
minikube status              # Check if the cluster is alive
minikube dashboard           # Open a GUI to see everything
minikube ip                  # Get the cluster IP address
```

### Resource Inspection
```bash
kubectl get pods -n standupsync       # See all app pods
kubectl logs -f <pod_name> -n standupsync  # Stream logs
kubectl describe pod <pod_name> -n standupsync # See events/errors
```

### Accessing Services
```bash
minikube service frontend-service -n standupsync --url # Get the FE URL
minikube service backend-service -n standupsync --url  # Get the BE URL
```

---

## License

MIT
