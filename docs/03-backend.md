# Backend Deep Dive

The backend is a FastAPI application. This document explains how each layer works — from the HTTP request arriving to the database write completing.

---

## Request Lifecycle

Every HTTP request travels through these layers in order:

```
HTTP Request
    │
    ▼
CORS Middleware          ← checks if the Origin header is in FRONTEND_ORIGINS
    │
    ▼
FastAPI Router           ← matches the URL path to a route function
    │
    ▼
Dependency Injection     ← get_db() opens a DB session; get_current_user() validates JWT
    │
    ▼
Route Handler            ← thin — just calls a service function
    │
    ▼
Service Layer            ← all business logic lives here
    │
    ▼
SQLAlchemy ORM           ← translates Python objects to SQL queries
    │
    ▼
PostgreSQL
```

---

## Database Models (`db/models.py`)

Four tables. Here is what each one stores and why relationships matter:

```
users
  id, email, hashed_password, full_name
  role (developer | team_lead | admin)
  team_id → teams.id (nullable — user may not be in a team)
  is_active, created_at

teams
  id, name, created_by → users.id

standup_entries
  id, user_id → users.id
  did_yesterday, doing_today, blockers
  date (indexed — queried by date range constantly)

weekly_summaries
  id, user_id → users.id
  week_start, summary_text, generated_at
  UNIQUE(user_id, week_start)  ← prevents writing two summaries for the same week
```

**Cascade deletes**: When a user is deleted, their standups and summaries are deleted too (`cascade="all, delete-orphan"` on the relationship). PostgreSQL enforces this at the FK level with `ondelete="CASCADE"`.

**Why `is_active` instead of deleting?** Soft-delete pattern — you keep historical data but the user can no longer log in. The login query filters `User.is_active == True`.

---

## Authentication (`core/security.py`, `core/dependencies.py`)

### How JWT works here

1. User sends `POST /auth/login` with email + password
2. `authenticate_user()` fetches the user by email, calls `passlib.verify()` to check bcrypt hash
3. If valid, `create_access_token()` builds a JWT: `{"sub": "42", "exp": <7 days from now>}`
4. The JWT is signed with `SECRET_KEY` using HS256 and returned to the browser
5. Browser stores it in `localStorage` and sends it as `Authorization: Bearer <token>` on every request

### How every protected route validates the token

`get_current_user()` in `dependencies.py` is a FastAPI dependency — any route that declares it as a parameter gets automatic validation:

```python
# This runs before the route handler body executes
async def get_current_user(token = Depends(oauth2_scheme), db = Depends(get_db)):
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    user_id = payload.get("sub")        # extract user ID from token
    user = db.query(User).filter(
        User.id == user_id,
        User.is_active == True           # inactive users can't authenticate
    ).first()
    return user                          # injected into the route handler
```

If the token is expired, tampered with, or the user is inactive — FastAPI automatically returns `401 Unauthorized` before your route code even runs.

### Role-Based Access Control (RBAC)

`require_roles()` is a factory function that returns a dependency:

```python
# In dependencies.py
def require_roles(*roles: UserRole):
    def role_checker(current_user = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(403, "Access denied")
        return current_user
    return role_checker

# Convenience shortcuts
get_current_admin     = require_roles(UserRole.ADMIN)
get_current_team_lead = require_roles(UserRole.TEAM_LEAD, UserRole.ADMIN)  # admin can do everything a lead can
get_current_developer = require_roles(UserRole.DEVELOPER, UserRole.TEAM_LEAD, UserRole.ADMIN)
```

Usage in a route:
```python
@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),  # 401 if not logged in, 403 if not admin
):
    ...
```

---

## Schemas (`schemas/`)

Pydantic models serve three purposes:
1. **Validation** — FastAPI rejects requests that don't match the schema with `422 Unprocessable Entity`
2. **Serialization** — converts SQLAlchemy ORM objects to JSON for responses
3. **Documentation** — FastAPI reads these to generate the Swagger UI

### Why `UserCreate` has no `role` field

```python
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    # role is intentionally absent — all self-registrations are developer
    # only admins can promote users via PATCH /admin/users/{id}/role
```

If `role` were a field here, anyone could register as admin by sending `{"role": "admin"}` in the request body — a privilege escalation vulnerability.

### Input validation examples

```python
@field_validator("password")
def password_strength(cls, v):
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    return v

@field_validator("did_yesterday", "doing_today")
def not_empty_or_too_long(cls, v):
    v = v.strip()
    if not v:
        raise ValueError("Field cannot be empty")
    if len(v) > 2000:
        raise ValueError("Field cannot exceed 2000 characters")
    return v
```

FastAPI catches these `ValueError` exceptions and returns a structured `422` response listing every validation failure.

---

## Service Layer (`services/`)

Routes are intentionally thin — they just call services. The service layer holds all business logic so it can be tested without HTTP.

### `standup_service.py` — key logic

**Duplicate prevention** (one standup per user per day):
```python
def get_today_standup(db, user_id):
    today_start = datetime.combine(date.today(), datetime.min.time())
    return db.query(StandupEntry).filter(
        StandupEntry.user_id == user_id,
        StandupEntry.date >= today_start,
    ).first()

def create_standup(db, standup_in, user_id):
    if get_today_standup(db, user_id):   # already submitted today?
        raise HTTPException(400, "Use PUT to edit today's standup")
    # ... create and return
```

**Same-day edit enforcement**:
```python
def update_standup(db, standup_id, standup_in, user_id):
    db_standup = db.query(StandupEntry).filter(
        StandupEntry.id == standup_id,
        StandupEntry.user_id == user_id  # you can only edit your own
    ).first()
    if db_standup.date.date() != date.today():
        raise HTTPException(403, "You can only edit standups on the same day")
    # ... update and return
```

### `ai_service.py` — Gemini integration

```python
def generate_summary(entries: List[StandupEntry]) -> str:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    # Formats entries into a readable block, sends to Gemini
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
        config=types.GenerateContentConfig(max_output_tokens=300, temperature=0.4),
    )
    return response.text
```

`temperature=0.4` — lower values make the output more factual and consistent. `max_output_tokens=300` caps the summary at roughly 3-5 sentences.

---

## Celery: Background Tasks (`tasks/digest.py`, `celery_app.py`)

### How the schedule is configured

```python
# celery_app.py
beat_schedule={
    "weekly-digest-friday-9am": {
        "task": "app.tasks.digest.send_weekly_digests",
        "schedule": crontab(hour=9, minute=0, day_of_week="friday"),
    }
}
```

**Beat vs Worker**: Beat is the clock — it only publishes a task message to Redis at 9AM Friday. The Worker is the executor — it picks the message from Redis and actually runs `send_weekly_digests`. They are two separate processes (two separate Deployments in Kubernetes).

### Per-user error isolation

```python
for user in users:
    try:
        entries = fetch_entries(user)
        if not entries:
            continue
        summary_text = generate_summary(entries)
        db.add(WeeklySummary(user_id=user.id, ...))
        db.commit()
        send_digest_email(user.email, summary_text)
    except Exception as e:
        db.rollback()
        logger.error(f"Digest failed for user {user.id}: {e}")
        continue  # ← don't fail the whole job for one user
```

Without this pattern, a single user with a bad email or a momentary Gemini failure would cause the entire weekly digest to be retried, potentially sending duplicate emails to everyone who succeeded before the failure.

---

## Configuration (`core/config.py`)

Settings are loaded from environment variables (and `.env` for local dev) via Pydantic's `BaseSettings`:

```python
class Settings(BaseSettings):
    SECRET_KEY: str = "DEVELOPMENT_SECRET_KEY_CHANGE_IN_PRODUCTION"
    DATABASE_URL: Optional[str] = None
    POSTGRES_SERVER: str = "localhost"
    # ... etc

    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        # Build from individual parts (used in K8s where password comes from a Secret)
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.FRONTEND_ORIGINS.split(",")]
```

The `@property` for `sqlalchemy_database_uri` handles both deployment modes:
- **Local / Docker Compose**: set `DATABASE_URL` in `.env` — used directly
- **Kubernetes**: set individual `POSTGRES_*` vars from ConfigMap + `POSTGRES_PASSWORD` from Secret — URI built at runtime, password never appears in plaintext in a manifest

---

## Adding a New Endpoint — Step by Step

Say you want `GET /api/v1/standups/{id}` to fetch one standup by ID.

**1. Add to the service** (`services/standup_service.py`):
```python
def get_standup_by_id(db: Session, standup_id: int, user_id: int) -> StandupEntry:
    entry = db.query(StandupEntry).filter(
        StandupEntry.id == standup_id,
        StandupEntry.user_id == user_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Standup not found")
    return entry
```

**2. Add the route** (`api/v1/routes/standup.py`):
```python
@router.get("/{standup_id}", response_model=StandupOut)
def get_standup(
    standup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return standup_service.get_standup_by_id(db, standup_id, current_user.id)
```

**3. Test it** — Swagger UI at `http://localhost:8000/api/v1/docs` updates automatically.
