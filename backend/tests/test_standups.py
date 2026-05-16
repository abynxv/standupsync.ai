"""Integration tests for standup endpoints."""
from tests.conftest import register_and_login, auth_headers


def test_create_standup(client):
    token = register_and_login(client)
    res = client.post("/api/v1/standups/", headers=auth_headers(token), json={
        "did_yesterday": "Wrote unit tests",
        "doing_today": "Working on CI pipeline",
        "blockers": None,
    })
    assert res.status_code == 201
    data = res.json()
    assert data["did_yesterday"] == "Wrote unit tests"
    assert data["blockers"] is None


def test_create_standup_duplicate_today(client):
    token = register_and_login(client)
    payload = {"did_yesterday": "A", "doing_today": "B", "blockers": None}
    client.post("/api/v1/standups/", headers=auth_headers(token), json=payload)
    res = client.post("/api/v1/standups/", headers=auth_headers(token), json=payload)
    assert res.status_code == 400
    assert "already logged" in res.json()["detail"].lower()


def test_create_standup_empty_field(client):
    token = register_and_login(client)
    res = client.post("/api/v1/standups/", headers=auth_headers(token), json={
        "did_yesterday": "   ",  # whitespace only — should fail validation
        "doing_today": "Something",
        "blockers": None,
    })
    assert res.status_code == 422


def test_create_standup_field_too_long(client):
    token = register_and_login(client)
    res = client.post("/api/v1/standups/", headers=auth_headers(token), json={
        "did_yesterday": "x" * 2001,  # over 2000 char limit
        "doing_today": "Something",
        "blockers": None,
    })
    assert res.status_code == 422


def test_get_my_standups(client):
    token = register_and_login(client)
    client.post("/api/v1/standups/", headers=auth_headers(token), json={
        "did_yesterday": "Done", "doing_today": "Doing", "blockers": None,
    })
    res = client.get("/api/v1/standups/", headers=auth_headers(token))
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_get_today_standup_none(client):
    token = register_and_login(client)
    res = client.get("/api/v1/standups/today", headers=auth_headers(token))
    assert res.status_code == 200
    assert res.json() is None


def test_get_today_standup_exists(client):
    token = register_and_login(client)
    client.post("/api/v1/standups/", headers=auth_headers(token), json={
        "did_yesterday": "Done", "doing_today": "Doing", "blockers": None,
    })
    res = client.get("/api/v1/standups/today", headers=auth_headers(token))
    assert res.status_code == 200
    assert res.json()["did_yesterday"] == "Done"


def test_update_standup(client):
    token = register_and_login(client)
    create_res = client.post("/api/v1/standups/", headers=auth_headers(token), json={
        "did_yesterday": "Old text", "doing_today": "Old doing", "blockers": None,
    })
    standup_id = create_res.json()["id"]

    res = client.put(f"/api/v1/standups/{standup_id}", headers=auth_headers(token), json={
        "did_yesterday": "Updated text",
        "doing_today": "Updated doing",
        "blockers": "CI is broken",
    })
    assert res.status_code == 200
    assert res.json()["did_yesterday"] == "Updated text"
    assert res.json()["blockers"] == "CI is broken"


def test_update_standup_not_yours(client):
    """Users cannot edit each other's standups."""
    token1 = register_and_login(client, email="user1@test.com")
    token2 = register_and_login(client, email="user2@test.com")

    res = client.post("/api/v1/standups/", headers=auth_headers(token1), json={
        "did_yesterday": "User1 work", "doing_today": "More work", "blockers": None,
    })
    standup_id = res.json()["id"]

    # user2 tries to edit user1's standup
    res = client.put(f"/api/v1/standups/{standup_id}", headers=auth_headers(token2), json={
        "did_yesterday": "Hacked", "doing_today": "Hacked", "blockers": None,
    })
    assert res.status_code == 404  # looks like "not found" to prevent info leak


def test_delete_standup(client):
    token = register_and_login(client)
    res = client.post("/api/v1/standups/", headers=auth_headers(token), json={
        "did_yesterday": "Done", "doing_today": "Doing", "blockers": None,
    })
    standup_id = res.json()["id"]

    del_res = client.delete(f"/api/v1/standups/{standup_id}", headers=auth_headers(token))
    assert del_res.status_code == 204

    # Verify it's gone
    list_res = client.get("/api/v1/standups/", headers=auth_headers(token))
    assert len(list_res.json()) == 0


def test_standup_pagination(client):
    """Pagination params are accepted and respected."""
    token = register_and_login(client)
    # Only one standup possible today, so just verify params don't error
    res = client.get("/api/v1/standups/?limit=10&skip=0", headers=auth_headers(token))
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_standup_requires_auth(client):
    res = client.get("/api/v1/standups/")
    assert res.status_code == 401
