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
*   [Docker](https://www.docker.com/) & Docker Compose
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

### 3. One-Command Start (Hybrid Mode)
The project is configured for a **Hybrid Setup**: Infrastructure (DB/Redis) runs in Docker, while Application services run locally for faster development feedback.

```bash
chmod +x sev.sh
./sev.sh
```
*This script starts Docker services, runs migrations, and launches the Backend, Worker, and Frontend.*

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
├── docker-compose.yml  # Infrastructure setup
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

## 🛡 CI/CD
Every push to `main` triggers:
1.  **Backend Tests**: Automated verification using `uv` and `pytest`.
2.  **Image Builds**: Docker images are built and validated to ensure deployment readiness.

---

## 📄 License
MIT
