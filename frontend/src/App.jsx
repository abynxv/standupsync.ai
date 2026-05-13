import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  LogOut, CheckCircle2, ArrowRightCircle, AlertOctagon, LayoutDashboard,
  Sparkles, Plus, Clock, FileText, Calendar, Pencil, Trash2, X, Check,
  Users, Shield, UserCheck, UserX, Crown, Code2, Loader2,
  RefreshCw, Building2,
} from 'lucide-react'
import * as api from './api.js'
import './App.css'

// ─── Toast System ─────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState([])
  const id = useRef(0)

  const add = useCallback((message, type = 'info') => {
    const key = ++id.current
    setToasts((prev) => [...prev, { key, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.key !== key)), 3500)
  }, [])

  const toast = {
    success: (msg) => add(msg, 'success'),
    error: (msg) => add(msg, 'error'),
    info: (msg) => add(msg, 'info'),
  }

  return { toasts, toast }
}

function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(({ key, message, type }) => (
        <div key={key} className={`toast toast-${type} animate-slide-down`}>
          {type === 'success' && <Check size={15} />}
          {type === 'error' && <X size={15} />}
          {type === 'info' && <Sparkles size={15} />}
          <span>{message}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Role Badge ───────────────────────────────────────────────────────────────

const ROLE_META = {
  admin: { label: 'Admin', icon: Shield, className: 'badge-admin' },
  team_lead: { label: 'Team Lead', icon: Crown, className: 'badge-lead' },
  developer: { label: 'Developer', icon: Code2, className: 'badge-dev' },
}

function RoleBadge({ role }) {
  const meta = ROLE_META[role] || ROLE_META.developer
  const Icon = meta.icon
  return (
    <span className={`role-badge ${meta.className}`}>
      <Icon size={11} />
      {meta.label}
    </span>
  )
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

function Skeleton({ height = 80 }) {
  return <div className="skeleton" style={{ height }} />
}

// ─── Auth View ────────────────────────────────────────────────────────────────

function AuthView({ onLogin }) {
  const [view, setView] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(email, password)
      localStorage.setItem('token', data.access_token)
      onLogin()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.register({ email, password, full_name: fullName })
      setSuccess('Account created! Sign in below.')
      setView('login')
      setEmail('')
      setPassword('')
      setFullName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-wrap">
            <Sparkles size={28} className="auth-logo-icon" />
          </div>
          <h1 className="auth-title gradient-text">StandupSync</h1>
          <p className="auth-subtitle">
            {view === 'login' ? 'Welcome back.' : 'Create your account.'}
          </p>
        </div>

        {success && (
          <div className="form-success">
            <Check size={14} /> {success}
          </div>
        )}
        {error && (
          <div className="form-error">
            <AlertOctagon size={14} /> {error}
          </div>
        )}

        <form onSubmit={view === 'login' ? handleLogin : handleRegister}>
          {view === 'register' && (
            <div className="form-group animate-slide-down">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
            style={{ marginTop: '1.25rem' }}
          >
            {loading
              ? <><Loader2 size={16} className="spin" /> Processing…</>
              : view === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          {view === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="btn-link"
            onClick={() => { setView(v => v === 'login' ? 'register' : 'login'); setError(''); setSuccess('') }}
          >
            {view === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Standup Form ─────────────────────────────────────────────────────────────

function StandupForm({ initial, onSubmit, onCancel, loading, submitLabel = 'Submit Update' }) {
  const [did, setDid] = useState(initial?.did_yesterday ?? '')
  const [doing, setDoing] = useState(initial?.doing_today ?? '')
  const [blockers, setBlockers] = useState(initial?.blockers ?? '')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({ did_yesterday: did, doing_today: doing, blockers: blockers || null })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">
          <CheckCircle2 size={13} className="label-icon done" />
          What did you do yesterday?
        </label>
        <textarea
          className="form-textarea"
          placeholder="Completed user auth, fixed Redis cache bug…"
          value={did}
          onChange={(e) => setDid(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">
          <ArrowRightCircle size={13} className="label-icon next" />
          What are you doing today?
        </label>
        <textarea
          className="form-textarea"
          placeholder="Working on team standup UI, API integration…"
          value={doing}
          onChange={(e) => setDoing(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">
          <AlertOctagon size={13} className="label-icon blocker" />
          Blockers <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          className="form-textarea"
          style={{ minHeight: 70 }}
          placeholder="Waiting for design review, CI flaky…"
          value={blockers}
          onChange={(e) => setBlockers(e.target.value)}
        />
      </div>
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <><Loader2 size={15} className="spin" /> Saving…</> : submitLabel}
        </button>
      </div>
    </form>
  )
}

// ─── Standup Entry Card ───────────────────────────────────────────────────────

function EntryCard({ entry, isToday, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="entry-card">
      <div className="entry-date-row">
        <span className="entry-date">
          <Calendar size={13} />
          {new Date(entry.date).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          })}
          {isToday && <span className="today-pill">Today</span>}
        </span>
        {isToday && (
          <div className="entry-actions">
            <button className="btn-icon" title="Edit" onClick={() => onEdit(entry)}>
              <Pencil size={14} />
            </button>
            {confirmDelete ? (
              <>
                <button className="btn-icon danger" title="Confirm" onClick={() => onDelete(entry.id)}>
                  <Check size={14} />
                </button>
                <button className="btn-icon" title="Cancel" onClick={() => setConfirmDelete(false)}>
                  <X size={14} />
                </button>
              </>
            ) : (
              <button className="btn-icon danger" title="Delete" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="entry-grid">
        <div>
          <div className="entry-section-header">
            <CheckCircle2 size={13} className="entry-section-icon done" />
            <span className="entry-section-label">Completed</span>
          </div>
          <p className="entry-section-text">{entry.did_yesterday}</p>
        </div>
        <div>
          <div className="entry-section-header">
            <ArrowRightCircle size={13} className="entry-section-icon next" />
            <span className="entry-section-label">In Progress</span>
          </div>
          <p className="entry-section-text">{entry.doing_today}</p>
        </div>
      </div>

      {entry.blockers && (
        <div className="entry-blockers">
          <AlertOctagon size={15} className="entry-blockers-icon" />
          <div className="entry-blockers-content">
            <div className="entry-blockers-label">Blocker</div>
            <p className="entry-blockers-text">{entry.blockers}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Developer Dashboard ──────────────────────────────────────────────────────

function DeveloperDashboard({ user, toast }) {
  const [standups, setStandups] = useState([])
  const [todayEntry, setTodayEntry] = useState(undefined)
  const [summaries, setSummaries] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoadingData(true)
    try {
      const [all, today, sums] = await Promise.all([
        api.getStandups(),
        api.getTodayStandup(),
        api.getMySummaries(),
      ])
      setStandups(all)
      setTodayEntry(today)
      setSummaries(sums)
    } catch {
      toast.error('Failed to load your data')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (payload) => {
    setSubmitting(true)
    try {
      await api.createStandup(payload)
      toast.success('Standup logged!')
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (payload) => {
    setSubmitting(true)
    try {
      await api.updateStandup(editing.id, payload)
      toast.success('Standup updated!')
      setEditing(null)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.deleteStandup(id)
      toast.success('Standup deleted.')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const latestSummary = summaries[0]
  const blockedDays = standups.filter((s) => s.blockers).length
  const thisWeek = standups.filter((s) => {
    return Date.now() - new Date(s.date).getTime() < 7 * 24 * 60 * 60 * 1000
  }).length

  return (
    <div className="dashboard animate-fade-in">
      <div>
        {/* Today status banner */}
        {todayEntry !== undefined && (
          <div className={`status-banner ${todayEntry ? 'status-done' : 'status-pending'}`}>
            {todayEntry
              ? <><CheckCircle2 size={16} /> Today's standup submitted — you're all set!</>
              : <><Clock size={16} /> You haven't logged today's standup yet</>}
          </div>
        )}

        {/* Standup form / submitted notice */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          {editing ? (
            <>
              <h3 className="card-title"><Pencil size={18} className="text-primary" /> Edit Standup</h3>
              <StandupForm
                initial={editing}
                onSubmit={handleUpdate}
                onCancel={() => setEditing(null)}
                loading={submitting}
                submitLabel="Save Changes"
              />
            </>
          ) : todayEntry ? (
            <div className="submitted-notice">
              <CheckCircle2 size={22} className="text-success" />
              <div>
                <div className="submitted-title">All done for today!</div>
                <div className="submitted-sub">Use the pencil icon on your entry below to make changes.</div>
              </div>
            </div>
          ) : (
            <>
              <h3 className="card-title"><Plus size={18} className="text-primary" /> Log Today's Standup</h3>
              <StandupForm onSubmit={handleCreate} loading={submitting} />
            </>
          )}
        </div>

        {/* Timeline */}
        <div className="entries-header" style={{ marginBottom: '1.25rem' }}>
          <h3 className="entries-title"><LayoutDashboard size={18} /> Timeline</h3>
          <span className="entries-count">{standups.length} entries</span>
        </div>

        {loadingData ? (
          <div className="skeleton-list">
            <Skeleton height={130} /><Skeleton height={130} /><Skeleton height={100} />
          </div>
        ) : standups.length === 0 ? (
          <div className="empty-state">
            <FileText size={44} className="empty-state-icon" />
            <p className="empty-state-text">No entries yet. Log your first standup above.</p>
          </div>
        ) : (
          standups.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              isToday={todayEntry?.id === entry.id}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Sidebar */}
      <div>
        <div className="sidebar-card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="sidebar-title"><Sparkles size={18} className="text-primary" /> AI Weekly Digest</h3>
          {loadingData ? (
            <><Skeleton height={70} /><div style={{ height: 8 }} /><Skeleton height={30} /></>
          ) : latestSummary ? (
            <>
              <p className="summary-text">{latestSummary.summary_text}</p>
              <div className="summary-meta">
                <Calendar size={12} />
                Week of {new Date(latestSummary.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </>
          ) : (
            <div className="sidebar-placeholder">
              <Sparkles size={22} style={{ color: 'var(--color-border)' }} />
              <p className="sidebar-placeholder-text">Generated every Friday at 9 AM based on your week's standups.</p>
            </div>
          )}
        </div>

        <div className="sidebar-card">
          <h4 className="sidebar-section-title">Your Stats</h4>
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-value">{standups.length}</div>
              <div className="stat-label">Total</div>
            </div>
            <div className="stat-box">
              <div className="stat-value" style={{ color: 'var(--color-primary)' }}>{thisWeek}</div>
              <div className="stat-label">This Week</div>
            </div>
            <div className="stat-box">
              <div className="stat-value" style={{ color: 'var(--color-danger)' }}>{blockedDays}</div>
              <div className="stat-label">Blocked</div>
            </div>
            <div className="stat-box">
              <div className="stat-value" style={{ color: 'var(--color-success)' }}>{summaries.length}</div>
              <div className="stat-label">Digests</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Team Lead View ───────────────────────────────────────────────────────────

function TeamView({ user, toast }) {
  const [members, setMembers] = useState([])
  const [standups, setStandups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user.team_id) { setLoading(false); return }
    Promise.all([
      api.getTeamMembers(user.team_id),
      api.getTeamStandups(user.team_id),
    ])
      .then(([m, s]) => { setMembers(m); setStandups(s) })
      .catch(() => toast.error('Failed to load team data'))
      .finally(() => setLoading(false))
  }, [user.team_id])

  if (!user.team_id) {
    return (
      <div className="page-content animate-fade-in">
        <div className="empty-state" style={{ marginTop: '3rem' }}>
          <Building2 size={44} className="empty-state-icon" />
          <p className="empty-state-text">You are not assigned to a team yet. Contact an admin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">Team Overview</h2>
        <span className="entries-count">{members.length} members</span>
      </div>

      {loading ? (
        <div className="skeleton-list"><Skeleton height={110} /><Skeleton height={110} /></div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 className="card-title"><Users size={16} /> Members</h3>
            <div className="member-list">
              {members.map((m) => (
                <div key={m.id} className="member-row">
                  <div className="avatar">{(m.full_name || m.email).charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div className="member-name">{m.full_name || m.email}</div>
                    <div className="member-email">{m.email}</div>
                  </div>
                  <RoleBadge role={m.role} />
                </div>
              ))}
            </div>
          </div>

          <div className="entries-header" style={{ marginBottom: '1.25rem' }}>
            <h3 className="entries-title"><LayoutDashboard size={16} /> Team Standups</h3>
            <span className="entries-count">{standups.length} entries</span>
          </div>
          {standups.length === 0 ? (
            <div className="empty-state">
              <FileText size={36} className="empty-state-icon" />
              <p className="empty-state-text">No team standups yet.</p>
            </div>
          ) : (
            standups.map((entry) => (
              <EntryCard key={entry.id} entry={entry} isToday={false} onEdit={() => {}} onDelete={() => {}} />
            ))
          )}
        </>
      )}
    </div>
  )
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────

function AdminPanel({ toast }) {
  const [users, setUsers] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTeamName, setNewTeamName] = useState('')
  const [teamLoading, setTeamLoading] = useState(false)
  const [addMember, setAddMember] = useState({})

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [u, t] = await Promise.all([api.adminListUsers(), api.listTeams()])
      setUsers(u)
      setTeams(t)
    } catch {
      toast.error('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleRoleChange = async (userId, role) => {
    try {
      await api.adminUpdateRole(userId, role)
      toast.success('Role updated')
      loadAll()
    } catch (err) { toast.error(err.message) }
  }

  const handleToggle = async (userId, name) => {
    try {
      const updated = await api.adminToggleActive(userId)
      toast.success(`${name} is now ${updated.is_active ? 'active' : 'inactive'}`)
      loadAll()
    } catch (err) { toast.error(err.message) }
  }

  const handleDelete = async (userId, name) => {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return
    try {
      await api.adminDeleteUser(userId)
      toast.success(`"${name}" deleted`)
      loadAll()
    } catch (err) { toast.error(err.message) }
  }

  const handleCreateTeam = async (e) => {
    e.preventDefault()
    if (!newTeamName.trim()) return
    setTeamLoading(true)
    try {
      await api.createTeam(newTeamName.trim())
      toast.success(`Team "${newTeamName}" created`)
      setNewTeamName('')
      loadAll()
    } catch (err) { toast.error(err.message) }
    finally { setTeamLoading(false) }
  }

  const handleDeleteTeam = async (teamId, name) => {
    if (!window.confirm(`Delete team "${name}"? Members will be unassigned.`)) return
    try {
      await api.deleteTeam(teamId)
      toast.success(`Team "${name}" deleted`)
      loadAll()
    } catch (err) { toast.error(err.message) }
  }

  const handleAddMember = async (teamId) => {
    const userId = parseInt(addMember[teamId])
    if (!userId) return
    try {
      await api.addTeamMember(teamId, userId)
      toast.success('Member added')
      setAddMember((s) => ({ ...s, [teamId]: '' }))
      loadAll()
    } catch (err) { toast.error(err.message) }
  }

  const handleRemoveMember = async (teamId, userId, name) => {
    try {
      await api.removeTeamMember(teamId, userId)
      toast.success(`${name} removed from team`)
      loadAll()
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="page-content animate-fade-in">
      <div className="page-header">
        <h2 className="page-title"><Shield size={20} /> Admin Panel</h2>
        <button className="btn btn-ghost btn-sm" onClick={loadAll}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="skeleton-list"><Skeleton height={220} /><Skeleton height={160} /></div>
      ) : (
        <>
          {/* Users table */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 className="card-title"><Users size={16} /> Users ({users.length})</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Team</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const teamName = teams.find((t) => t.id === u.team_id)?.name
                    return (
                      <tr key={u.id} className={!u.is_active ? 'row-inactive' : ''}>
                        <td>
                          <div className="table-user">
                            <div className="avatar avatar-sm">
                              {(u.full_name || u.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="table-name">{u.full_name || '—'}</div>
                              <div className="table-email">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <select
                            className="role-select"
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          >
                            <option value="developer">Developer</option>
                            <option value="team_lead">Team Lead</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td>
                          <span className="table-team">
                            {teamName || <span style={{ opacity: 0.35 }}>—</span>}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${u.is_active ? 'active' : 'inactive'}`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className={`btn-icon ${u.is_active ? 'warn' : 'success-icon'}`}
                              title={u.is_active ? 'Deactivate' : 'Activate'}
                              onClick={() => handleToggle(u.id, u.full_name || u.email)}
                            >
                              {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                            </button>
                            <button
                              className="btn-icon danger"
                              title="Delete"
                              onClick={() => handleDelete(u.id, u.full_name || u.email)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Teams */}
          <div className="card">
            <h3 className="card-title"><Building2 size={16} /> Teams</h3>
            <form className="create-team-form" onSubmit={handleCreateTeam}>
              <input
                className="form-input"
                placeholder="New team name…"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={teamLoading}>
                {teamLoading ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
                Create
              </button>
            </form>

            {teams.length === 0 ? (
              <p className="empty-inline">No teams yet.</p>
            ) : (
              teams.map((team) => {
                const members = users.filter((u) => u.team_id === team.id)
                return (
                  <div key={team.id} className="team-block">
                    <div className="team-block-header">
                      <span className="team-block-name">{team.name}</span>
                      <span className="entries-count">{members.length} members</span>
                      <button
                        className="btn-icon danger"
                        title="Delete team"
                        onClick={() => handleDeleteTeam(team.id, team.name)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {members.length > 0 && (
                      <div className="team-member-list">
                        {members.map((m) => (
                          <div key={m.id} className="team-member-chip">
                            <span>{m.full_name || m.email}</span>
                            <RoleBadge role={m.role} />
                            <button
                              className="chip-remove"
                              onClick={() => handleRemoveMember(team.id, m.id, m.full_name || m.email)}
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="add-member-row">
                      <select
                        className="role-select"
                        value={addMember[team.id] || ''}
                        onChange={(e) => setAddMember((s) => ({ ...s, [team.id]: e.target.value }))}
                      >
                        <option value="">Add member…</option>
                        {users.filter((u) => u.team_id !== team.id).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name || u.email}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleAddMember(team.id)}
                        disabled={!addMember[team.id]}
                      >
                        <Plus size={13} /> Add
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── App Shell ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { key: 'dashboard', label: 'My Standups', icon: LayoutDashboard, roles: ['developer', 'team_lead', 'admin'] },
  { key: 'team',      label: 'Team View',   icon: Users,           roles: ['team_lead', 'admin'] },
  { key: 'admin',     label: 'Admin',       icon: Shield,          roles: ['admin'] },
]

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const { toasts, toast } = useToast()

  const loadUser = useCallback(async () => {
    try {
      const u = await api.getMe()
      setUser(u)
    } catch {
      localStorage.removeItem('token')
      setAuthed(false)
    }
  }, [])

  useEffect(() => {
    if (authed) loadUser()
  }, [authed, loadUser])

  const handleLogout = () => {
    localStorage.removeItem('token')
    setAuthed(false)
    setUser(null)
    setActiveTab('dashboard')
  }

  if (!authed) {
    return (
      <>
        <AuthView onLogin={() => setAuthed(true)} />
        <ToastContainer toasts={toasts} />
      </>
    )
  }

  const visibleNav = NAV_ITEMS.filter((n) => !user || n.roles.includes(user.role))

  return (
    <>
      <ToastContainer toasts={toasts} />

      <nav className="navbar">
        <div className="navbar-brand">
          <Sparkles size={20} className="brand-icon" />
          <span className="navbar-name">StandupSync</span>
        </div>

        <div className="navbar-tabs">
          {visibleNav.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`nav-tab ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <div className="navbar-right">
          {user && (
            <div className="navbar-user">
              <div className="avatar">
                {(user.full_name || user.email).charAt(0).toUpperCase()}
              </div>
              <div className="navbar-user-info">
                <span className="navbar-username">{user.full_name || user.email}</span>
                <RoleBadge role={user.role} />
              </div>
            </div>
          )}
          <button className="btn btn-ghost" onClick={handleLogout} title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </nav>

      {!user ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '5rem' }}>
          <Loader2 size={28} className="spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && <DeveloperDashboard user={user} toast={toast} />}
          {activeTab === 'team'      && <TeamView user={user} toast={toast} />}
          {activeTab === 'admin'     && <AdminPanel toast={toast} />}
        </>
      )}
    </>
  )
}
