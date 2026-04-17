import React, { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [view, setView] = useState('login') // 'login', 'register', 'dashboard'
  const [standups, setStandups] = useState([])
  const [loading, setLoading] = useState(false)

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  // Standup form states
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
        const data = await res.json()
        setUser(data)
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
        const data = await res.json()
        setStandups(data)
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
        alert('Standup logged!')
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

  if (view === 'login' || view === 'register') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="glass-card" style={{ width: '400px' }}>
          <h1 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>StandupSync</h1>
          <form onSubmit={view === 'login' ? handleLogin : handleRegister}>
            {view === 'register' && (
              <div style={{ marginBottom: '1rem' }}>
                <label>Full Name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Processing...' : (view === 'login' ? 'Login' : 'Register')}
            </button>
          </form>
          <p style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {view === 'login' ? "Don't have an account?" : "Already have an account?"}
            <span 
              onClick={() => setView(view === 'login' ? 'register' : 'login')}
              style={{ color: 'var(--primary)', cursor: 'pointer', marginLeft: '0.5rem' }}
            >
              {view === 'login' ? 'Register' : 'Login'}
            </span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <nav style={{ padding: '1rem 2rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'var(--primary)' }}>StandupSync</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>{user?.full_name || user?.email}</span>
          <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--glass-border)', color: 'white' }}>Logout</button>
        </div>
      </nav>

      <div className="dashboard-grid">
        <div className="main-content">
          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Log Today's Standup</h3>
            <form onSubmit={submitStandup}>
              <div style={{ marginBottom: '1rem' }}>
                <label>What did I do yesterday?</label>
                <textarea rows="3" value={did} onChange={(e) => setDid(e.target.value)} required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label>What am I doing today?</label>
                <textarea rows="3" value={doing} onChange={(e) => setDoing(e.target.value)} required />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label>Blockers (if any)</label>
                <textarea rows="2" value={blockers} onChange={(e) => setBlockers(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary">Submit Standup</button>
            </form>
          </div>

          <h3>Past Entries</h3>
          <div style={{ marginTop: '1rem' }}>
            {standups.map(entry => (
              <div key={entry.id} className="glass-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--text-muted)' }}>
                  <span>{new Date(entry.date).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <h4 style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>YESTERDAY</h4>
                    <p>{entry.did_yesterday}</p>
                  </div>
                  <div>
                    <h4 style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>TODAY</h4>
                    <p>{entry.doing_today}</p>
                  </div>
                </div>
                {entry.blockers && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '0.5rem' }}>
                    <h4 style={{ color: '#ef4444', fontSize: '0.8rem' }}>BLOCKERS</h4>
                    <p>{entry.blockers}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar">
          <div className="glass-card" style={{ position: 'sticky', top: '2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(30, 41, 59, 0.7))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>✨</span>
              <h3>AI Weekly Summary</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Your weekly digest is being prepared. It will appear here every Friday!
            </p>
            <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px dashed var(--glass-border)', borderRadius: '0.5rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No summary generated yet.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
