from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "service" in data


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_register_missing_fields():
    response = client.post("/api/v1/auth/register", json={"email": "bad@test.com"})
    assert response.status_code == 422


def test_register_weak_password():
    response = client.post("/api/v1/auth/register", json={
        "email": "test@test.com",
        "full_name": "Test User",
        "password": "123",
    })
    assert response.status_code == 422



def test_protected_route_without_token():
    response = client.get("/api/v1/standups/")
    assert response.status_code == 401


def test_protected_route_invalid_token():
    response = client.get(
        "/api/v1/standups/",
        headers={"Authorization": "Bearer invalidtoken"},
    )
    assert response.status_code == 401
