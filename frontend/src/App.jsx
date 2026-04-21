import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  LogOut, 
  PlusCircle, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ChevronRight,
  TrendingUp
} from 'lucide-react'
import { Button } from './components/Button'
import { Input, TextArea } from './components/Input'
import { Card } from './components/Card'
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

  const AuthView = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '1rem' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
      >
        <Card style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <motion.div 
               whileHover={{ rotate: 10 }}
               style={{ 
                 display: 'inline-flex', 
                 padding: '1rem', 
                 background: 'var(--primary)', 
                 borderRadius: '20px', 
                 marginBottom: '1rem',
                 boxShadow: '0 0 30px rgba(99, 102, 241, 0.4)'
               }}
            >
              <Sparkles color="white" size={32} />
            </motion.div>
            <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>StandupSync</h1>
            <p style={{ color: 'var(--text-muted)' }}>Focus on what matters, sync with ease.</p>
          </div>

          <form onSubmit={view === 'login' ? handleLogin : handleRegister}>
            <AnimatePresence mode="wait">
              {view === 'register' && (
                <motion.div
                  key="reg-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Input 
                    label="Full Name" 
                    icon={UserIcon} 
                    placeholder="John Doe"
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    required 
                  />
                </motion.div>
              )}
            </AnimatePresence>
            
            <Input 
              label="Email Address" 
              icon={Mail} 
              type="email"
              placeholder="name@company.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
            
            <Input 
              label="Password" 
              icon={Lock} 
              type="password"
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />

            <Button type="submit" fullWidth disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? 'Processing...' : (view === 'login' ? 'Sign In' : 'Create Account')}
            </Button>
          </form>

          <p style={{ marginTop: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {view === 'login' ? "New here?" : "Already a member?"}
            <button 
              onClick={() => setView(view === 'login' ? 'register' : 'login')}
              style={{ color: 'var(--primary)', background: 'transparent', border: 'none', marginLeft: '0.5rem', fontWeight: '600' }}
            >
              {view === 'login' ? 'Get Started' : 'Sign In'}
            </button>
          </p>
        </Card>
      </motion.div>
    </div>
  )

  const DashboardView = () => (
    <div style={{ paddingBottom: '4rem' }}>
      <nav style={{ 
        padding: '1.25rem 2rem', 
        borderBottom: '1px solid var(--border-glass)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: 'rgba(2, 6, 23, 0.8)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Sparkles size={24} color="var(--primary)" />
          <h2 className="gradient-text" style={{ fontSize: '1.25rem' }}>StandupSync</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{user?.full_name || user?.email}</span>
          </div>
          <Button variant="ghost" onClick={handleLogout} style={{ padding: '0.5rem' }}>
            <LogOut size={18} />
          </Button>
        </div>
      </nav>

      <div className="dashboard-grid">
        <div className="main-content">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card style={{ marginBottom: '2.5rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, padding: '1rem', opacity: 0.1 }}>
                <PlusCircle size={120} />
              </div>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PlusCircle size={20} color="var(--primary)" />
                Log Today's Standup
              </h3>
              <form onSubmit={submitStandup}>
                <TextArea 
                  label="Yesterday's Progress" 
                  placeholder="Completed user authentication and setup Redis..."
                  value={did} 
                  onChange={(e) => setDid(e.target.value)} 
                  required 
                />
                <TextArea 
                  label="Today's Goals" 
                  placeholder="Starting the UI overhaul and testing API endpoints..."
                  value={doing} 
                  onChange={(e) => setDoing(e.target.value)} 
                  required 
                />
                <TextArea 
                  label="Blockers (optional)" 
                  placeholder="Waiting for CI/CD pipeline approval..."
                  value={blockers} 
                  onChange={(e) => setBlockers(e.target.value)} 
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="submit">Submit Update</Button>
                </div>
              </form>
            </Card>
          </motion.div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={20} color="var(--primary)" />
              Timeline
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{standups.length} entries recorded</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {standups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-glass)', borderRadius: '1rem' }}>
                <p style={{ color: 'var(--text-muted)' }}>No entries yet. Start by logging your first standup!</p>
              </div>
            ) : (
              standups.map((entry, idx) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card interactive style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                      <span style={{ 
                        fontSize: '0.8rem', 
                        fontWeight: '600', 
                        color: 'var(--text-muted)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        border: '1px solid var(--border-glass)'
                      }}>
                        {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                          <CheckCircle2 size={14} color="var(--primary)" />
                          <h4 style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Done</h4>
                        </div>
                        <p style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>{entry.did_yesterday}</p>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                          <ChevronRight size={14} color="var(--accent)" />
                          <h4 style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next</h4>
                        </div>
                        <p style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>{entry.doing_today}</p>
                      </div>
                    </div>
                    {entry.blockers && (
                      <div style={{ 
                        marginTop: '1.25rem', 
                        padding: '1rem', 
                        background: 'rgba(239, 68, 68, 0.05)', 
                        border: '1px solid rgba(239, 68, 68, 0.1)', 
                        borderRadius: '12px',
                        display: 'flex',
                        gap: '0.75rem'
                      }}>
                        <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
                        <div>
                          <h4 style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>BLOCKERS</h4>
                          <p style={{ fontSize: '0.9rem', color: '#fca5a5' }}>{entry.blockers}</p>
                        </div>
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="sidebar">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Card style={{ 
              position: 'sticky', 
              top: '6rem', 
              background: 'linear-gradient(165deg, rgba(99, 102, 241, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.2)' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <TrendingUp size={24} color="var(--primary)" />
                <h3 className="gradient-text">AI Highlights</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                Your weekly productivity digest is being generated based on your daily inputs.
              </p>
              
              <div style={{ 
                padding: '1.25rem', 
                border: '1px dashed var(--border-glass)', 
                borderRadius: '12px', 
                textAlign: 'center',
                background: 'rgba(0, 0, 0, 0.1)'
              }}>
                <Sparkles size={16} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Check back on Friday for your full AI analysis.
                </p>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Stats</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                   <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px' }}>
                     <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{standups.length}</div>
                     <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Updated Days</div>
                   </div>
                   <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px' }}>
                     <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>92%</div>
                     <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Consistency</div>
                   </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )

  return (
    <AnimatePresence mode="wait">
      {view === 'login' || view === 'register' ? (
        <AuthView key="auth" />
      ) : (
        <motion.div 
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <DashboardView />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default App
