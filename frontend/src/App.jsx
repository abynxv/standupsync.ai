import React, { useState, useEffect } from 'react'
import { LogOut } from 'lucide-react'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [view, setView] = useState('login')
  const [standups, setStandups] = useState([])
  const [loading, setLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const [did, setDid] = useState('')
  const [doing, setDoing] = useState('')
  const [blockers, setBlockers] = useState('')

  useEffect(() => {
    if (token) {
      fetchUser()
      fetchStandups()
      setView('dashboard')
    }
  }, [token])

  const fetchUser = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setUser(await res.json())
      } else {
        handleLogout()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchStandups = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/standups/', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setStandups(await res.json())
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new URLSearchParams()
      formData.append('username', email)
      formData.append('password', password)
      const res = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      })
      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('token', data.access_token)
        setToken(data.access_token)
      } else {
        alert('Login failed')
      }
    } catch (e) {
      alert('Error logging in')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName })
      })
      if (res.ok) {
        alert('Registered! Please login.')
        setView('login')
      } else {
        alert('Registration failed')
      }
    } catch (e) {
      alert('Error registering')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setView('login')
  }

  const submitStandup = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('http://localhost:8000/api/v1/standups/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ did_yesterday: did, doing_today: doing, blockers })
      })
      if (res.ok) {
        setDid('')
        setDoing('')
        setBlockers('')
        fetchStandups()
      } else {
        const err = await res.json()
        alert(err.detail || 'Failed to log standup')
      }
    } catch (e) {
      alert('Error submitting standup')
    }
  }

  /* ==================== AUTH VIEW ==================== */
  if (view === 'login' || view === 'register') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <img src="/logo.png" alt="StandupSync" className="auth-logo" />
            <h1 className="auth-title">StandupSync</h1>
            <p className="auth-subtitle">
              {view === 'login' ? 'Sign in to your account' : 'Create a new account'}
            </p>
          </div>

          <form onSubmit={view === 'login' ? handleLogin : handleRegister}>
            {view === 'register' && (
              <div className="form-group">
                <label className="form-label" htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  className="form-input"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                className="form-input"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Processing...' : (view === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="auth-footer">
            {view === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              className="btn-link"
              onClick={() => setView(view === 'login' ? 'register' : 'login')}
            >
              {view === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ==================== DASHBOARD VIEW ==================== */
  return (
    <div>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <img src="/logo.png" alt="StandupSync" className="navbar-logo" />
          <span className="navbar-name">StandupSync</span>
        </div>
        <div className="navbar-right">
          <div className="navbar-user">
            <div className="avatar">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="navbar-username">{user?.full_name || user?.email}</span>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* Dashboard Grid */}
      <div className="dashboard">
        {/* Main Content */}
        <div>
          {/* Standup Form */}
          <div className="card">
            <h3 className="card-title">Log Today's Standup</h3>
            <form onSubmit={submitStandup}>
              <div className="form-group">
                <label className="form-label" htmlFor="did">What did you do yesterday?</label>
                <textarea
                  id="did"
                  className="form-textarea"
                  placeholder="Completed user authentication, setup Redis cache..."
                  value={did}
                  onChange={(e) => setDid(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="doing">What are you doing today?</label>
                <textarea
                  id="doing"
                  className="form-textarea"
                  placeholder="Working on UI overhaul, testing API endpoints..."
                  value={doing}
                  onChange={(e) => setDoing(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="blockers">Blockers (optional)</label>
                <textarea
                  id="blockers"
                  className="form-textarea"
                  placeholder="Waiting for CI/CD pipeline approval..."
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Submit Update</button>
              </div>
            </form>
          </div>

          {/* Past Entries */}
          <div className="entries-header" style={{ marginTop: '2rem' }}>
            <h3 className="entries-title">Timeline</h3>
            <span className="entries-count">{standups.length} entries</span>
          </div>

          {standups.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">No entries yet. Log your first standup above!</p>
            </div>
          ) : (
            standups.map((entry) => (
              <div key={entry.id} className="entry-card">
                <div className="entry-date">
                  {new Date(entry.date).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric'
                  })}
                </div>
                <div className="entry-grid">
                  <div>
                    <div className="entry-section-label done">DONE</div>
                    <p className="entry-section-text">{entry.did_yesterday}</p>
                  </div>
                  <div>
                    <div className="entry-section-label next">NEXT</div>
                    <p className="entry-section-text">{entry.doing_today}</p>
                  </div>
                </div>
                {entry.blockers && (
                  <div className="entry-blockers">
                    <div className="entry-blockers-label">BLOCKERS</div>
                    <p className="entry-blockers-text">{entry.blockers}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div className="sidebar-card">
            <h3 className="sidebar-title">AI Weekly Summary</h3>
            <p className="sidebar-text">
              Your weekly productivity digest is generated every Friday based on your daily updates.
            </p>
            <div className="sidebar-placeholder">
              <p className="sidebar-placeholder-text">No summary generated yet.</p>
            </div>

            <h4 className="form-label">Quick Stats</h4>
            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-value">{standups.length}</div>
                <div className="stat-label">Updates</div>
              </div>
              <div className="stat-box">
                <div className="stat-value primary">
                  {standups.filter(s => s.blockers).length}
                </div>
                <div className="stat-label">Blocked Days</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
