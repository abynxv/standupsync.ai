# Frontend Deep Dive

The frontend is a React single-page application built with Vite. This document explains every major pattern used — from how API calls are structured to how roles gate what each user sees.

---

## Project Structure

```
frontend/src/
├── api.js        # All API calls in one place (no fetch() calls in components)
├── App.jsx       # Entire app: auth, developer, team lead, admin views
├── App.css       # Intentionally empty — all styles live in index.css
└── index.css     # Design system: CSS custom properties, all component styles
```

The app is intentionally in a single `App.jsx` file for this stage. It is easy to split into `components/` and `views/` later as the app grows.

---

## The API Client (`api.js`)

**Why a central API client?**

Without one, every component would contain its own `fetch()` call with its own headers, error handling, and base URL. When the API moves (e.g., from `localhost:8000` to `api.yourdomain.com`) you'd need to find and update every single call.

With `api.js`, you change one line and every component picks it up.

### How the base URL works

```js
const BASE = '/api/v1'
```

There is no `localhost:8000` anywhere in the frontend code. In development, Vite's dev server proxies all `/api` requests to `http://localhost:8000` (configured in `vite.config.js`). In production, Nginx's Ingress routes `/api` requests to the backend service. The frontend code never changes.

```js
// vite.config.js
server: {
  proxy: {
    '/api': { target: 'http://localhost:8000', changeOrigin: true }
  }
}
```

### The `request()` helper

Every exported function calls this one utility:

```js
async function request(path, options = {}) {
  const token = localStorage.getItem('token')  // attach JWT automatically
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 204) return null   // DELETE returns no body

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    // Extract FastAPI's error message (detail field)
    const message = data?.detail || `Request failed (${res.status})`
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }

  return data
}
```

When a request fails, the thrown `Error` carries the exact message from the backend (e.g., `"You have already logged a standup for today"`). Components just display `err.message` in a toast — no custom error mapping needed.

---

## Toast Notification System

**Why replace `alert()`?**

`alert()` is a blocking browser dialog — it freezes the entire page until the user clicks OK. It looks ugly, can't be styled, and is disruptive. Toasts appear in a corner, disappear automatically, and don't interrupt the user.

### Implementation

```js
function useToast() {
  const [toasts, setToasts] = useState([])
  const id = useRef(0)  // incrementing key — avoids React key collisions

  const add = useCallback((message, type = 'info') => {
    const key = ++id.current
    setToasts((prev) => [...prev, { key, message, type }])
    // Auto-dismiss after 3.5 seconds
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.key !== key)), 3500)
  }, [])

  return {
    toasts,
    toast: {
      success: (msg) => add(msg, 'success'),
      error:   (msg) => add(msg, 'error'),
      info:    (msg) => add(msg, 'info'),
    }
  }
}
```

Usage in a component:

```js
const { toasts, toast } = useToast()

// On success:
toast.success('Standup logged!')

// On error:
try {
  await api.createStandup(payload)
} catch (err) {
  toast.error(err.message)  // shows backend's exact error message
}
```

The `<ToastContainer toasts={toasts} />` renders them in a fixed-position corner. CSS handles the slide-in animation.

---

## Role-Based Navigation

The navbar tabs are filtered based on the logged-in user's role:

```js
const NAV_ITEMS = [
  { key: 'dashboard', label: 'My Standups', icon: LayoutDashboard, roles: ['developer', 'team_lead', 'admin'] },
  { key: 'team',      label: 'Team View',   icon: Users,           roles: ['team_lead', 'admin'] },
  { key: 'admin',     label: 'Admin',       icon: Shield,          roles: ['admin'] },
]

// Filter to only items the current user's role can see
const visibleNav = NAV_ITEMS.filter((n) => n.roles.includes(user.role))
```

A developer only sees "My Standups". A team lead sees "My Standups" and "Team View". An admin sees all three.

**Important:** this is UI-only gating for convenience. The actual security enforcement happens in the backend via `require_roles()`. Even if someone bypasses the frontend, the API will return `403 Forbidden`.

---

## Developer Dashboard

### Today's standup detection

On load, the dashboard fires three requests in parallel:

```js
const [all, today, sums] = await Promise.all([
  api.getStandups(),       // full timeline
  api.getTodayStandup(),   // null or today's entry
  api.getMySummaries(),    // AI weekly digests
])
```

`getTodayStandup()` calls `GET /standups/today` which returns `null` (not `404`) if nothing is submitted yet. This drives the status banner at the top:

```js
{todayEntry
  ? <><CheckCircle2 /> Today's standup submitted — you're all set!</>
  : <><Clock /> You haven't logged today's standup yet</>}
```

And controls whether the form or the "all done" notice is shown in the card.

### Edit / Delete

The edit and delete buttons only appear on the entry that matches today's submission (`todayEntry?.id === entry.id`). Past entries show read-only.

Delete has a two-step confirmation built into the card — clicking trash once shows confirm + cancel buttons instead of using `window.confirm()`:

```js
{confirmDelete ? (
  <>
    <button onClick={() => onDelete(entry.id)}><Check /></button>   {/* confirm */}
    <button onClick={() => setConfirmDelete(false)}><X /></button>  {/* cancel */}
  </>
) : (
  <button onClick={() => setConfirmDelete(true)}><Trash2 /></button>
)}
```

---

## Skeleton Loaders

While data is loading, skeleton loaders are shown instead of a blank page or spinner:

```js
function Skeleton({ height = 80 }) {
  return <div className="skeleton" style={{ height }} />
}

// While loading:
<div className="skeleton-list">
  <Skeleton height={130} />
  <Skeleton height={130} />
  <Skeleton height={100} />
</div>
```

The CSS uses a shimmer animation (gradient sweeping left to right) to indicate loading activity. This is the same pattern used by LinkedIn, YouTube, and GitHub.

---

## Admin Panel

The admin panel has two sections: **User Management** and **Team Management**.

### User table

- Inline role select — changing the dropdown immediately calls `PATCH /admin/users/{id}/role`
- Toggle active button — `PATCH /admin/users/{id}/toggle-active` (soft disable, user can't log in)
- Delete button — `DELETE /admin/users/{id}` (permanent, with browser confirm dialog)
- Inactive rows are visually dimmed with CSS (`row-inactive` class)

### Team management

- Create team form at the top
- Each team shows its members as chips (removable via the × button)
- A dropdown lists all users not in this team — selecting one and clicking Add calls `POST /teams/{id}/members`

---

## Design System (`index.css`)

All styles live in `index.css`. No CSS framework is used — just CSS custom properties (variables).

### Key variables

```css
:root {
  --color-bg: #09090b;               /* near-black background */
  --color-surface: #18181b;          /* card / panel background */
  --color-surface-hover: #27272a;    /* hovered surface */
  --color-border: #3f3f46;           /* subtle borders */
  --color-primary: #8b5cf6;          /* violet accent */
  --color-danger: #ef4444;           /* red for errors / destructive actions */
  --color-success: #10b981;          /* green for success states */
  --radius: 10px;                    /* standard border radius */
  --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Pattern: semantic class names

Classes describe what something IS, not how it looks:

```css
/* ✓ Good — semantic */
.entry-blockers { ... }
.status-banner  { ... }
.role-badge     { ... }

/* ✗ Avoid — presentational (breaks when you change the design) */
.red-box        { ... }
.float-right    { ... }
```

---

## Authentication Flow

```
App loads
  │
  ├─ token in localStorage? ──YES──▶ call GET /auth/me
  │                                        │
  │                                   ┌────┴─────┐
  │                                 OK │         │ 401
  │                              setUser()    clear token
  │                                   │         │
  │                              show navbar  show login
  │
  └─ no token ──▶ show AuthView (login / register)
```

On logout:
1. `localStorage.removeItem('token')`
2. `setAuthed(false)` and `setUser(null)`
3. React re-renders — no token found → AuthView shown
4. All in-memory state (standups, user data) is discarded automatically

---

## Adding a New View

Say you want a "Profile" page where users can change their name.

1. **Add the API call** in `api.js`:
   ```js
   export const updateProfile = (payload) =>
     request('/auth/me', { method: 'PATCH', body: JSON.stringify(payload) })
   ```

2. **Add the nav item** in `App.jsx`:
   ```js
   { key: 'profile', label: 'Profile', icon: User, roles: ['developer', 'team_lead', 'admin'] }
   ```

3. **Write the component**:
   ```jsx
   function ProfileView({ user, toast }) {
     const [name, setName] = useState(user.full_name)
     const handleSave = async () => {
       try {
         await api.updateProfile({ full_name: name })
         toast.success('Profile updated!')
       } catch (err) {
         toast.error(err.message)
       }
     }
     return (...)
   }
   ```

4. **Render it** in the tab switch block:
   ```jsx
   {activeTab === 'profile' && <ProfileView user={user} toast={toast} />}
   ```
