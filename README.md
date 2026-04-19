# 🚀 StandupSync AI

StandupSync is a modern productivity tool designed to automate standups and generate smart weekly digests using AI. It streamlines team coordination by tracking updates and providing concise, actionable summaries.

---

## 🏗 Architecture Overview

```mermaid
graph TD
    Client[Browser/Frontend] <--> API[FastAPI Backend]
    API <--> DB[(PostgreSQL)]
    API <--> Redis[(Redis Broker)]
    Redis <--> Worker[Celery Worker]
    Worker <--> AI[Google Gemini AI]
    API <--> AI
```

---

## 🛠 Tech Stack

### Backend
*   **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Async Python)
*   **Dependency Management**: [uv](https://github.com/astral-sh/uv) (Extremely fast Rust-based manager)
*   **Database**: [PostgreSQL](https://www.postgresql.org/) with [SQLAlchemy](https://www.sqlalchemy.org/) ORM
*   **Background Tasks**: [Celery](https://docs.celeryq.dev/) + [Redis](https://redis.io/)
*   **AI Integration**: [Google Gemini Pro](https://deepmind.google/technologies/gemini/)

### Frontend
*   **Framework**: [React](https://reactjs.org/) (Vite)
*   **Styling**: Vanilla CSS (Modern richness)

### DevOps & CI/CD
*   **Containerization**: Docker & Docker Compose
*   **Automation**: GitHub Actions (Testing & Image builds)

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have the following installed:
*   [Docker](https://www.docker.com/) & Docker Compose (V2)
*   [uv](https://github.com/astral-sh/uv) (Python manager)
*   [Node.js](https://nodejs.org/) (v18+)

### 2. Environment Configuration
Create a `.env` file in the root directory:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/standupsync
CELERY_BROKER_URL=redis://localhost:6380/0
CELERY_RESULT_BACKEND=redis://localhost:6380/0
GEMINI_API_KEY=your_api_key_here
SECRET_KEY=your_jwt_secret
```

### 3. Running the Project

You can run the project in two ways:

#### A. Full Docker Mode (Recommended for Production/QA) 🐳
This starts the entire stack (Frontend, Backend, DB, Redis, Workers) as isolated containers.
```bash
docker compose up --build -d
```
*   **Backend API**: [http://localhost:8000](http://localhost:8000)
*   **Frontend App**: [http://localhost:3000](http://localhost:3000)

#### B. Hybrid Dev Mode (Faster Iteration) 🛠️
Infrastructure (DB/Redis) runs in Docker, while application services run locally.
```bash
chmod +x sev.sh
./sev.sh
```

---

## 🐋 Docker Service Map

| Service | Port | Description |
| :--- | :--- | :--- |
| `backend` | `8000` | FastAPI app & Swagger docs |
| `frontend` | `3000` | React (Vite) served via Nginx |
| `worker` | - | Celery consumer for AI tasks |
| `beat` | - | Celery scheduler for automated standups |
| `db` | `5433` | PostgreSQL 15 database |
| `redis` | `6380` | Message broker and result backend |

---

## 📂 Project Structure

```text
.
├── backend/            # FastAPI Application
│   ├── app/            # Source code
│   ├── tests/          # Pytest suite
│   ├── pyproject.toml  # UV configuration
│   └── Dockerfile      # Production build
├── frontend/           # React + Vite Application
│   ├── src/            # Components & Logic
│   └── Dockerfile      # Nginx-based build
├── .github/            # CI/CD Workflows
├── docker-compose.yml  # Infrastructure setup (V2)
└── sev.sh              # Unified dev runner
```

---

## 🧪 Development Workflow

### Backend
Manage dependencies and run tests using `uv`:
```bash
cd backend
uv sync                 # Install dependencies
uv run pytest           # Run tests
uv run uvicorn ...      # Start dev server
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🛡 CI/CD Pipeline

The project uses GitHub Actions for automated testing and deployment. Every push to `main` triggers:

1.  **Backend Tests**: Runs `pytest` suite using `uv`.
2.  **Docker Hub Push**: If tests pass, it builds and pushes images to Docker Hub:
    *   `username/standupsync-backend`
    *   `username/standupsync-frontend`

### Required GitHub Secrets
To enable the pipeline, add these to your repository settings:
*   `DOCKERHUB_USERNAME`: Your Docker Hub account name.
*   `DOCKERHUB_TOKEN`: Your Docker Hub Personal Access Token (PAT).

---

## 📄 License
MIT
