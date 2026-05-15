# API Reference

Base URL: `http://localhost:8000/api/v1`

Interactive docs (Swagger UI): `http://localhost:8000/api/v1/docs`

All protected endpoints require an `Authorization: Bearer <token>` header. Get the token from `POST /auth/login`.

---

## Authentication

### Register
```
POST /auth/register
```
Creates a new account. All users start with the `developer` role — an admin must promote them.

**Request body:**
```json
{
  "email": "jane@company.com",
  "full_name": "Jane Smith",
  "password": "mypassword123"
}
```

**Response `201`:**
```json
{
  "id": 1,
  "email": "jane@company.com",
  "full_name": "Jane Smith",
  "role": "developer",
  "is_active": true,
  "team_id": null,
  "created_at": "2026-05-14T09:00:00Z"
}
```

**Errors:**
- `400` — email already exists
- `422` — password < 8 chars, email invalid, full_name empty

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@company.com","full_name":"Jane Smith","password":"mypassword123"}'
```

---

### Login
```
POST /auth/login
```
Returns a JWT. Uses `application/x-www-form-urlencoded` (OAuth2 standard form).

**Request body (form, not JSON):**
```
username=jane@company.com&password=mypassword123
```

**Response `200`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

**Errors:** `401` — wrong credentials or inactive account

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d "username=jane@company.com&password=mypassword123"
```

---

### Get Current User
```
GET /auth/me          🔒 any role
```

Returns the profile of the logged-in user. Use this on app load to get the user's role.

```bash
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <token>"
```

---

## Standups

### Get Today's Standup
```
GET /standups/today          🔒 any role
```
Returns the current user's standup for today, or `null` if not yet submitted.

The frontend uses this to decide whether to show the form or the "already submitted" notice.

```bash
curl http://localhost:8000/api/v1/standups/today \
  -H "Authorization: Bearer <token>"
```

---

### Get My Standup History
```
GET /standups/?limit=30&skip=0          🔒 any role
```

Returns standups for the logged-in user, newest first.

**Query params:**
- `limit` — how many to return (1–100, default 30)
- `skip` — how many to skip for pagination (default 0)

```bash
# First page
curl "http://localhost:8000/api/v1/standups/?limit=30&skip=0" \
  -H "Authorization: Bearer <token>"

# Second page
curl "http://localhost:8000/api/v1/standups/?limit=30&skip=30" \
  -H "Authorization: Bearer <token>"
```

---

### Log Today's Standup
```
POST /standups/          🔒 any role
```

Creates a new standup entry. Returns `400` if you've already submitted one today (use PUT to edit).

**Request body:**
```json
{
  "did_yesterday": "Finished the auth module, wrote unit tests",
  "doing_today": "Starting on the team dashboard UI",
  "blockers": null
}
```

**Response `201`:** the saved standup object

**Errors:**
- `400` — already submitted today
- `422` — fields empty or > 2000 chars

```bash
curl -X POST http://localhost:8000/api/v1/standups/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"did_yesterday":"Finished auth module","doing_today":"Starting dashboard","blockers":null}'
```

---

### Edit Today's Standup
```
PUT /standups/{id}          🔒 any role
```

Updates an existing standup. Only allowed on the same calendar day it was created.

**Request body:** same as POST

**Errors:**
- `403` — trying to edit a standup from a previous day
- `404` — standup not found or belongs to another user

```bash
curl -X PUT http://localhost:8000/api/v1/standups/5 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"did_yesterday":"Updated text","doing_today":"Still on dashboard","blockers":"CI pipeline is flaky"}'
```

---

### Delete Today's Standup
```
DELETE /standups/{id}          🔒 any role
```

Deletes a standup. Only allowed on the same day it was created.

**Response `204`:** no body

```bash
curl -X DELETE http://localhost:8000/api/v1/standups/5 \
  -H "Authorization: Bearer <token>"
```

---

### Get Team Standups
```
GET /standups/team/{team_id}?limit=50&skip=0          🔒 team_lead, admin
```

Returns all standups from members of the specified team. Team leads can only view their own team.

```bash
curl "http://localhost:8000/api/v1/standups/team/1?limit=50" \
  -H "Authorization: Bearer <team-lead-token>"
```

---

## Summaries

### Get My AI Summaries
```
GET /summaries/me          🔒 any role
```

Returns all weekly digest summaries generated for the logged-in user, newest first.

```bash
curl http://localhost:8000/api/v1/summaries/me \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
[
  {
    "id": 1,
    "user_id": 5,
    "week_start": "2026-05-06T00:00:00Z",
    "summary_text": "This week Jane completed the authentication module and unit tests...",
    "generated_at": "2026-05-09T09:00:00Z"
  }
]
```

---

### Get Team Summaries
```
GET /summaries/team          🔒 team_lead, admin
```

Returns summaries for all members in the caller's team.

---

## Admin

All admin endpoints require the `admin` role. A `403` is returned if a non-admin calls them.

### List All Users
```
GET /admin/users          🔒 admin
```

Returns every user in the system with their role, team, and status.

```bash
curl http://localhost:8000/api/v1/admin/users \
  -H "Authorization: Bearer <admin-token>"
```

---

### Update a User's Role
```
PATCH /admin/users/{id}/role          🔒 admin
```

**Request body:**
```json
{ "role": "team_lead" }
```
Valid values: `developer`, `team_lead`, `admin`

**Errors:** `400` — trying to change your own role

```bash
curl -X PATCH http://localhost:8000/api/v1/admin/users/3/role \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"role":"team_lead"}'
```

---

### Toggle User Active / Inactive
```
PATCH /admin/users/{id}/toggle-active          🔒 admin
```

Flips `is_active`. Inactive users cannot log in. Returns the updated user object.

```bash
curl -X PATCH http://localhost:8000/api/v1/admin/users/3/toggle-active \
  -H "Authorization: Bearer <admin-token>"
```

---

### Delete a User
```
DELETE /admin/users/{id}          🔒 admin
```

Permanently deletes the user and all their standups and summaries (cascade). Cannot delete yourself.

**Response `204`:** no body

```bash
curl -X DELETE http://localhost:8000/api/v1/admin/users/3 \
  -H "Authorization: Bearer <admin-token>"
```

---

## Teams

### Create a Team
```
POST /teams/          🔒 admin
```

**Request body:**
```json
{ "name": "Platform Engineering" }
```

**Errors:** `400` — team with this name already exists

---

### List All Teams
```
GET /teams/          🔒 admin
```

---

### Delete a Team
```
DELETE /teams/{id}          🔒 admin
```

Unassigns all members (`team_id` set to null) before deleting the team row.

---

### Get Team Members
```
GET /teams/{id}/members          🔒 team_lead, admin
```

Team leads can only view their own team. Admins can view any team.

---

### Add a Member to a Team
```
POST /teams/{id}/members          🔒 admin
```

**Request body:**
```json
{ "user_id": 7 }
```

Sets `users.team_id` to this team. A user can only be in one team at a time.

---

### Remove a Member from a Team
```
DELETE /teams/{id}/members/{user_id}          🔒 admin
```

Sets `users.team_id` to null.

---

## Health

```
GET /health
```

Returns `{"status": "ok"}`. Used by Kubernetes readiness and liveness probes. No authentication required.

---

## Error Response Format

All errors return a JSON body:

```json
{
  "detail": "You have already logged a standup for today. Use PUT to edit it."
}
```

Validation errors (`422`) return a list:

```json
{
  "detail": [
    {
      "loc": ["body", "password"],
      "msg": "Password must be at least 8 characters",
      "type": "value_error"
    }
  ]
}
```

---

## Role Summary

| Endpoint | developer | team_lead | admin |
|---|:---:|:---:|:---:|
| `POST /auth/register` | ✓ | ✓ | ✓ |
| `POST /auth/login` | ✓ | ✓ | ✓ |
| `GET /auth/me` | ✓ | ✓ | ✓ |
| `GET/POST /standups/` | ✓ | ✓ | ✓ |
| `GET /standups/today` | ✓ | ✓ | ✓ |
| `PUT/DELETE /standups/{id}` | ✓ | ✓ | ✓ |
| `GET /standups/team/{id}` | — | ✓ | ✓ |
| `GET /summaries/me` | ✓ | ✓ | ✓ |
| `GET /summaries/team` | — | ✓ | ✓ |
| `GET /admin/users` | — | — | ✓ |
| `PATCH /admin/users/{id}/role` | — | — | ✓ |
| `PATCH /admin/users/{id}/toggle-active` | — | — | ✓ |
| `DELETE /admin/users/{id}` | — | — | ✓ |
| `POST/GET /teams/` | — | — | ✓ |
| `POST/DELETE /teams/{id}/members` | — | — | ✓ |
| `GET /teams/{id}/members` | — | ✓ | ✓ |
