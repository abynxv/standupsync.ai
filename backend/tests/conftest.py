"""
Test fixtures.

Uses an in-memory SQLite database so tests run without a real PostgreSQL
instance. The `get_db` FastAPI dependency is overridden to use this DB.

SQLite limitations vs PostgreSQL:
- No native Enum type — we use String for the role column in tests
- No timezone-aware datetimes — tests use naive datetimes
These are acceptable trade-offs for fast, dependency-free unit tests.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import Base, get_db

SQLALCHEMY_DATABASE_URL = "sqlite://"  # in-memory, lost after each test session

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,  # reuse single connection so in-memory DB persists across queries
)

# SQLite doesn't enforce FK constraints by default — enable them
@event.listens_for(engine, "connect")
def enable_sqlite_fk(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Fresh database for each test — tables created, dropped on teardown."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """TestClient with the real DB dependency replaced by the test DB."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass  # session is managed by db_session fixture

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Helpers ───────────────────────────────────────────────────────────────────

def register_and_login(client, email="dev@test.com", password="password123", full_name="Dev User"):
    """Register a user and return their auth token."""
    client.post("/api/v1/auth/register", json={
        "email": email,
        "full_name": full_name,
        "password": password,
    })
    res = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    return res.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}
