"""Integration tests for authentication endpoints."""
from tests.conftest import register_and_login, auth_headers


def test_register_success(client):
    res = client.post("/api/v1/auth/register", json={
        "email": "alice@test.com",
        "full_name": "Alice",
        "password": "strongpass1",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "alice@test.com"
    assert data["role"] == "developer"   # always developer on self-register
    assert data["is_active"] is True
    assert "hashed_password" not in data  # never leak password hash


def test_register_duplicate_email(client):
    payload = {"email": "dup@test.com", "full_name": "Dup", "password": "password123"}
    client.post("/api/v1/auth/register", json=payload)
    res = client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 400
    assert "already exists" in res.json()["detail"]


def test_register_weak_password(client):
    res = client.post("/api/v1/auth/register", json={
        "email": "weak@test.com", "full_name": "Weak", "password": "short",
    })
    assert res.status_code == 422


def test_register_empty_full_name(client):
    res = client.post("/api/v1/auth/register", json={
        "email": "blank@test.com", "full_name": "   ", "password": "password123",
    })
    assert res.status_code == 422


def test_login_success(client):
    client.post("/api/v1/auth/register", json={
        "email": "bob@test.com", "full_name": "Bob", "password": "password123",
    })
    res = client.post(
        "/api/v1/auth/login",
        data={"username": "bob@test.com", "password": "password123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client):
    client.post("/api/v1/auth/register", json={
        "email": "carol@test.com", "full_name": "Carol", "password": "password123",
    })
    res = client.post(
        "/api/v1/auth/login",
        data={"username": "carol@test.com", "password": "wrongpassword"},
    )
    assert res.status_code == 401


def test_login_unknown_email(client):
    res = client.post(
        "/api/v1/auth/login",
        data={"username": "nobody@test.com", "password": "password123"},
    )
    assert res.status_code == 401


def test_get_me(client):
    token = register_and_login(client)
    res = client.get("/api/v1/auth/me", headers=auth_headers(token))
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "dev@test.com"
    assert data["role"] == "developer"


def test_get_me_invalid_token(client):
    res = client.get("/api/v1/auth/me", headers=auth_headers("garbage"))
    assert res.status_code == 401


def test_cannot_self_register_as_admin(client):
    """Security: role field is ignored on registration — always becomes developer."""
    # Even if someone sends role in the body, registration schema doesn't accept it
    res = client.post("/api/v1/auth/register", json={
        "email": "hacker@test.com",
        "full_name": "Hacker",
        "password": "password123",
        "role": "admin",  # this field is not in UserCreate schema
    })
    # Request succeeds but role is ignored
    assert res.status_code == 200
    assert res.json()["role"] == "developer"
