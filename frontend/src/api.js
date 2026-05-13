const BASE = '/api/v1'

function getToken() {
  return localStorage.getItem('token')
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 204) return null

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const message =
      data?.detail ||
      (Array.isArray(data?.detail)
        ? data.detail.map((e) => e.msg).join(', ')
        : null) ||
      `Request failed (${res.status})`
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }

  return data
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(email, password) {
  const form = new URLSearchParams({ username: email, password })
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.detail || 'Login failed')
  return data
}

export const register = (payload) =>
  request('/auth/register', { method: 'POST', body: JSON.stringify(payload) })

export const getMe = () => request('/auth/me')

// ── Standups ──────────────────────────────────────────────────────────────────

export const getStandups = (params = '') => request(`/standups/${params}`)

export const getTodayStandup = () => request('/standups/today')

export const createStandup = (payload) =>
  request('/standups/', { method: 'POST', body: JSON.stringify(payload) })

export const updateStandup = (id, payload) =>
  request(`/standups/${id}`, { method: 'PUT', body: JSON.stringify(payload) })

export const deleteStandup = (id) =>
  request(`/standups/${id}`, { method: 'DELETE' })

export const getTeamStandups = (teamId) =>
  request(`/standups/team/${teamId}`)

// ── Summaries ─────────────────────────────────────────────────────────────────

export const getMySummaries = () => request('/summaries/me')
export const getTeamSummaries = () => request('/summaries/team')

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminListUsers = () => request('/admin/users')

export const adminUpdateRole = (userId, role) =>
  request(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })

export const adminToggleActive = (userId) =>
  request(`/admin/users/${userId}/toggle-active`, { method: 'PATCH' })

export const adminDeleteUser = (userId) =>
  request(`/admin/users/${userId}`, { method: 'DELETE' })

// ── Teams ─────────────────────────────────────────────────────────────────────

export const listTeams = () => request('/teams/')

export const createTeam = (name) =>
  request('/teams/', { method: 'POST', body: JSON.stringify({ name }) })

export const deleteTeam = (teamId) =>
  request(`/teams/${teamId}`, { method: 'DELETE' })

export const getTeamMembers = (teamId) => request(`/teams/${teamId}/members`)

export const addTeamMember = (teamId, userId) =>
  request(`/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  })

export const removeTeamMember = (teamId, userId) =>
  request(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' })
