# Dex Platform Frontend — Full Architecture & Implementation Guide

> **Purpose:** This document explains everything built in the frontend, how it all connects,
> and how to extend it for future tasks. Written for both human developers and AI assistants
> (Freebuff) to quickly understand the codebase without reading every file.

---

## 1. What Was Built (Summary)

A complete React frontend for the Dex Platform IT Operations Management dashboard.
The backend runs at `http://localhost:8080`. The frontend runs at `http://localhost:5173`
and proxies all `/api` requests to the backend.

**Tech Stack:**
- React 18 + TypeScript + Vite
- Tailwind CSS v4 (with `@tailwindcss/vite` plugin)
- Redux Toolkit (global state)
- React Router v6 (client-side routing)
- Axios (HTTP client with JWT interceptor)
- Framer Motion (smooth animations)
- Recharts (charts)
- React Hook Form (form validation)

---

## 2. Project Structure

```
frontend/
├── .env                          # VITE_API_BASE_URL=/api
├── vite.config.ts                # Vite config with Tailwind plugin + API proxy
├── index.html                    # Entry HTML with Inter font
├── public/favicon.svg            # Dex Platform logo
│
└── src/
    ├── main.tsx                  # ENTRY POINT: Redux Provider + BrowserRouter
    ├── App.tsx                   # Root component, renders <AppRoutes />
    │
    ├── styles/
    │   └── global.css            # Tailwind v4 import + custom animations + theme
    │
    ├── types/                    # TypeScript interfaces matching backend DTOs
    │   ├── index.ts              # Re-exports all types
    │   ├── auth.ts               # User, LoginRequest, LoginResponse, SignupRequest, AuthState
    │   ├── device.ts             # Device, DeviceHealthSummary
    │   ├── issue.ts              # Issue, IssueFilters, IssueSummary
    │   ├── telemetry.ts          # TelemetryData, TelemetrySummary
    │   ├── remediation.ts        # Remediation, RemediationSummary
    │   ├── knowledge.ts          # KnowledgeArticle
    │   └── itsm.ts               # ItsmTicket
    │
    ├── utils/
    │   ├── constants.ts          # STATUS_COLORS, SEVERITY_COLORS, CHART_COLORS, NAV_ITEMS
    │   ├── formatDate.ts         # formatDate(), formatDateTime(), formatRelativeTime()
    │   ├── formatBytes.ts        # formatBytes(), formatNumber(), formatPercent()
    │   └── errorHandler.ts       # getErrorMessage(), getValidationErrors() for Axios errors
    │
    ├── api/                      # HTTP layer — one file per backend resource
    │   ├── axios.ts              # Axios instance with JWT interceptor + 401 redirect
    │   ├── authApi.ts            # POST /api/auth/login, POST /api/auth/signup
    │   ├── deviceApi.ts          # GET /api/devices, GET /api/devices/:id, DELETE
    │   ├── telemetryApi.ts       # GET /api/telemetry/device/:deviceId
    │   ├── issueApi.ts           # GET /api/issues, GET /api/issues/:id, PATCH status/assign
    │   ├── remediationApi.ts     # GET /api/remediations, POST execute
    │   ├── knowledgeApi.ts       # GET /api/knowledge, GET /api/knowledge/:id
    │   ├── aiApi.ts              # GET /api/ai/recommendation/issue/:id, POST /api/ai/analyze/:id
    │   └── itsmApi.ts            # GET /api/itsm/tickets, PATCH status
    │
    ├── store/                    # Redux store configuration
    │   ├── store.ts              # configureStore with all 10 reducers
    │   ├── authSlice.ts          # token, user, isAuthenticated, localStorage persistence
    │   └── uiSlice.ts            # sidebarOpen, sidebarCollapsed, theme
    │
    ├── features/                 # Domain-specific Redux slices (one per backend resource)
    │   ├── dashboard/dashboardSlice.ts   # Aggregates devices + issues + remediations
    │   ├── devices/devicesSlice.ts       # fetchDevices, fetchDeviceById
    │   ├── issues/issuesSlice.ts         # fetchIssues, fetchIssueById, filters
    │   ├── telemetry/telemetrySlice.ts   # fetchTelemetry by deviceId
    │   ├── remediation/remediationSlice.ts  # fetchRemediations
    │   ├── knowledge-base/knowledgeSlice.ts # fetchArticles, fetchArticleById
    │   ├── ai/aiSlice.ts                 # fetchRecommendation, analyzeIssue
    │   └── itsm/itsmSlice.ts             # fetchTickets
    │
    ├── hooks/
    │   ├── useAppSelector.ts     # Typed useSelector hook
    │   ├── useAppDispatch.ts     # Typed useDispatch hook
    │   └── useAuth.ts            # login(), signup(), logout() with navigation
    │
    ├── components/
    │   ├── common/
    │   │   ├── Loading.tsx       # Spinner + SkeletonBlock + SkeletonCard + SkeletonTable
    │   │   ├── ErrorMessage.tsx  # Animated error card with retry button
    │   │   ├── ConfirmDialog.tsx # Modal dialog with backdrop blur
    │   │   └── DataTable.tsx     # Reusable table: sorting, pagination, row click, loading
    │   ├── dashboard/
    │   │   ├── MetricCard.tsx    # Animated count-up number + icon + trend
    │   │   ├── DeviceHealthChart.tsx   # Recharts PieChart (Online/Offline/Error)
    │   │   ├── IssueSummary.tsx        # Recharts BarChart (Critical/High/Medium/Low)
    │   │   └── RemediationSummary.tsx  # Success rate bar + stats grid
    │   ├── devices/
    │   │   ├── DeviceStatusBadge.tsx   # Colored badge with pulsing dot
    │   │   └── DeviceTable.tsx         # Devices DataTable with columns
    │   ├── issues/
    │   ├── knowledge/
    │   ├── remediation/
    │   ├── ai/
    │   └── itsm/
    │
    ├── layouts/
    │   ├── AuthLayout.tsx        # Centered card on gradient animated background
    │   ├── MainLayout.tsx        # Sidebar + Header + content area + Footer
    │   ├── Sidebar.tsx           # Animated nav with collapse, admin section
    │   ├── Header.tsx            # Search bar, notifications, user dropdown
    │   └── Footer.tsx            # Copyright + links
    │
    ├── pages/
    │   ├── Login/LoginPage.tsx           # Login form with error shake animation
    │   ├── Signup/SignupPage.tsx         # Signup form with success state
    │   ├── Dashboard/DashboardPage.tsx   # 4 metric cards + 2 charts + remediation + issues
    │   ├── Devices/DevicesPage.tsx       # Device list with search + status filter tabs
    │   ├── Devices/DeviceDetailsPage.tsx # Device info + telemetry charts (CPU, Memory, Disk, Network)
    │   ├── Issues/IssuesPage.tsx         # Issue list with severity/status filter tabs
    │   ├── Issues/IssueDetailsPage.tsx   # Issue info + AI analysis section
    │   ├── Remediation/RemediationHistoryPage.tsx  # Remediation table
    │   ├── KnowledgeBase/KnowledgeBasePage.tsx     # Article cards with search
    │   ├── KnowledgeBase/ArticleDetailsPage.tsx    # Full article view
    │   ├── ITSM/TicketsPage.tsx                     # ITSM tickets table
    │   └── NotFound/NotFoundPage.tsx                # Animated 404
    │
    └── routes/
        ├── AppRoutes.tsx         # All route definitions
        ├── ProtectedRoute.tsx    # Redirects to /login if not authenticated
        └── RoleRoute.tsx         # Shows "Access Denied" if role not in allowed list
```

---

## 3. Application Startup Flow

```
main.tsx
  └─> <Provider store={store}>    ← Redux context
        └─> <App>
              └─> <BrowserRouter>
                    └─> <AppRoutes>
                          ├─> /login → AuthLayout > LoginPage
                          ├─> /signup → AuthLayout > SignupPage
                          ├─> /* (protected) → ProtectedRoute > MainLayout > <Outlet>
                          │     ├─> /dashboard → DashboardPage
                          │     ├─> /devices → DevicesPage
                          │     ├─> /devices/:id → DeviceDetailsPage
                          │     ├─> /issues → IssuesPage
                          │     ├─> /issues/:id → IssueDetailsPage
                          │     ├─> /remediation → RemediationHistoryPage
                          │     ├─> /knowledge → KnowledgeBasePage
                          │     ├─> /knowledge/:id → ArticleDetailsPage
                          │     ├─> /tickets → TicketsPage
                          │     ├─> /settings → (admin only)
                          │     └─> /admin/users → (admin only)
                          └─> /404 → NotFoundPage
```

---

## 4. Authentication Flow (Frontend ↔ Backend)

### Login Flow
```
1. User fills form on LoginPage.tsx
2. useAuth().login({ username, password }) is called
3. authApi.login() → POST /api/auth/login
4. Backend returns: { token, type, username, email, role }
5. Redux dispatch: loginSuccess({ token, user })
6. authSlice saves to BOTH:
   - Redux store (in-memory)
   - localStorage ('dex_token', 'dex_user')
7. Axios interceptor attaches Bearer token to all future requests
8. navigate('/dashboard')
```

### Signup Flow
```
1. User fills form on SignupPage.tsx
2. useAuth().signup({ username, email, password, fullName })
3. authApi.signup() → POST /api/auth/signup
4. Backend returns: { id, username, email, role }
5. navigate('/login') — user must log in after signup
```

### Persisting Auth (Page Reload)
```
1. On app load, authSlice reads from localStorage:
   - dex_token → state.token
   - dex_user → state.user (JSON parsed)
2. isAuthenticated = !!token
3. ProtectedRoute checks isAuthenticated → allows or redirects to /login
```

### Axios Interceptor (src/api/axios.ts)
```
REQUEST:
  if localStorage has 'dex_token' → add Authorization: Bearer <token>

RESPONSE (error):
  if status === 401 →
    remove 'dex_token' and 'dex_user' from localStorage
    redirect to /login
```

---

## 5. Backend API Mapping

Every API call in the frontend maps to a specific backend endpoint:

| Frontend File | Method | Backend Endpoint | Auth? | Backend Controller |
|---|---|---|---|---|
| `authApi.ts` | POST | `/api/auth/login` | No |
| `authApi.ts` | POST | `/api/auth/signup` | No | `AuthController` |
| `authApi.ts` | GET | `/api/auth/me` | Yes | `AuthController` |
| `deviceApi.ts` | GET | `/api/devices` | Yes |
| `deviceApi.ts` | GET | `/api/devices/:id` | Yes |
| `deviceApi.ts` | DELETE | `/api/devices/:id` | Yes |
| `telemetryApi.ts` | GET | `/api/telemetry/device/:deviceId` | Yes |
| `telemetryApi.ts` | GET | `/api/telemetry/device/:deviceId/latest` | Yes |
| `issueApi.ts` | GET | `/api/issues` | Yes |
| `issueApi.ts` | GET | `/api/issues/:id` | Yes |
| `issueApi.ts` | PATCH | `/api/issues/:id/status` | Yes |
| `issueApi.ts` | PATCH | `/api/issues/:id/assign` | Yes |
| `remediationApi.ts` | GET | `/api/remediations` | Yes |
| `remediationApi.ts` | GET | `/api/remediations/:id` | Yes |
| `remediationApi.ts` | GET | `/api/remediations/issue/:issueId` | Yes |
| `remediationApi.ts` | POST | `/api/remediations` | Yes |
| `knowledgeApi.ts` | GET | `/api/knowledge` | Yes |
| `knowledgeApi.ts` | GET | `/api/knowledge/:id` | Yes |
| `knowledgeApi.ts` | GET | `/api/knowledge/search?q=` | Yes |
| `aiApi.ts` | GET | `/api/ai/recommendation/issue/:issueId` | Yes |
| `aiApi.ts` | POST | `/api/ai/analyze/:issueId` | Yes |
| `itsmApi.ts` | GET | `/api/itsm/tickets` | Yes |
| `itsmApi.ts` | GET | `/api/itsm/tickets/:id` | Yes |
| `itsmApi.ts` | PATCH | `/api/itsm/tickets/:id/status` | Yes |

| -- | GET | `/api/dashboard` | No |

**Backend response format expected by all API modules:**
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

### Backend Database Tables (V2 Migration)

| Table | Purpose |
|---|---|
| `users` | User accounts with roles (ADMIN, OPERATOR, VIEWER) |
| `agents` | Enrolled devices/agents (called "devices" in frontend) |
| `telemetry_data` | CPU, memory, disk, network metrics per agent |
| `issues` | System issues with severity, status, AI analysis |
| `remediations` | Remediation actions linked to issues |
| `knowledge_articles` | Knowledge base articles |
| `itsm_tickets` | ITSM integration tickets |

### Backend File Structure

```
backend/src/main/java/com/dex/
├── config/          # SecurityConfig, CorsConfig, JacksonConfig
├── controller/      # REST controllers (one per domain)
├── dto/             # Request/Response DTOs
├── entity/          # JPA entities
├── enums/           # AgentStatus, UserRole, IssueSeverity, IssueStatus, etc.
├── exception/       # GlobalExceptionHandler, custom exceptions
├── repository/      # Spring Data JPA repositories
├── security/        # JWT filter, JwtService, SecurityUser
└── service/         # Business logic services
```

---

## 6. Redux State Management

### Store Shape
```typescript
{
  auth:        { token, user, isAuthenticated, loading }
  ui:          { sidebarOpen, sidebarCollapsed, theme }
  dashboard:   { devices[], issues[], remediations[], loading, error }
  devices:     { items[], selected, loading, error }
  issues:      { items[], selected, loading, error, filters }
  telemetry:   { data[], loading, error }
  remediation: { items[], loading, error }
  knowledge:   { articles[], selected, loading, error }
  ai:          { recommendation, loading, error }
  itsm:        { tickets[], loading, error }
}
```

### Data Flow Pattern
```
Component mounts
  → useEffect dispatches async thunk
  → Thunk calls API function (from /api/*.ts)
  → API function calls backend via Axios instance
  → Response dispatched to Redux slice (fulfilled/rejected)
  → Component re-renders with new state from useAppSelector
```

### Example: DevicesPage
```
DevicesPage mounts
  → useEffect → dispatch(fetchDevices())
  → fetchDevices thunk → deviceApi.getDevices()
  → GET /api/devices (with Bearer token)
  → devicesSlice handles fulfilled → state.items = response
  → useAppSelector(state => state.devices) triggers re-render
  → DeviceTable receives items as prop → renders table
```

---

## 7. Key Design Patterns

### Pattern 1: API Module → Redux Slice → Page Component
Every feature follows this exact pattern:
```
api/featureApi.ts          → API calls (pure functions, no state)
features/featureSlice.ts   → Redux state + async thunks
pages/Feature/FeaturePage  → UI component that dispatches + reads state
```

### Pattern 2: Type Safety
- All backend DTOs have TypeScript interfaces in `src/types/`
- API functions are typed: `async function getDevices(): Promise<Device[]>`
- Redux slices use typed actions: `PayloadAction<Device[]>`
- Components receive typed props

### Pattern 3: Smooth UI
Every interactive element uses these CSS utilities defined in `global.css`:
- `card-hover` — translateY(-2px) + shadow on hover
- `btn-press` — scale(0.98) on click
- `skeleton` — shimmer loading animation
- `pulse-badge` — pulsing dot for live status
- `focus-ring` — smooth blue focus outline
- `sidebar-transition` — smooth width/transform change
- `table-row-hover` — background color transition
- `modal-backdrop` — backdrop blur for modals
- `gradient-text` — gradient colored text

Framer Motion is used for:
- Page entrance: `initial={{ opacity: 0, y: 16 }}` → `animate={{ opacity: 1, y: 0 }}`
- Staggered list items: `transition={{ delay: idx * 0.05 }}`
- Modal enter/exit: `AnimatePresence` with scale + opacity
- Sidebar collapse: `AnimatePresence` with width + opacity
- Count-up numbers: Custom `useCountUp` hook with `requestAnimationFrame`
- Chart animations: Recharts built-in `animationDuration={800}`

### Pattern 4: Filter Tabs
Both DevicesPage and IssuesPage use pill-style filter tabs:
```tsx
<div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
  {FILTERS.map(f => (
    <button
      onClick={() => setFilter(f)}
      className={active ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}
    >
      {f}
    </button>
  ))}
</div>
```

---

## 8. Role-Based Access Control

| Role | Can See | Cannot See |
|---|---|---|
| ROLE_ADMIN | Everything including Settings, Users | — |
| ROLE_OPERATOR | Dashboard, Devices, Issues, Remediation, KB, Tickets | Settings, Users |
| ROLE_VIEWER | Dashboard, Devices, Issues, Remediation, KB, Tickets | Settings, Users |

- `ProtectedRoute` checks if user is logged in (token exists)
- `RoleRoute` checks if user's role is in the allowed roles array
- Sidebar conditionally shows "Admin" section only for ROLE_ADMIN

---

## 9. File-by-File Quick Reference

### When you need to add a new API endpoint:
1. Create or update the relevant file in `src/api/` (e.g., `deviceApi.ts`)
2. The Axios instance in `src/api/axios.ts` handles auth headers automatically

### When you need to add new state:
1. Create a slice in `src/features/` (e.g., `features/dashboard/dashboardSlice.ts`)
2. Add the reducer to `src/store/store.ts`

### When you need a new page:
1. Create the page in `src/pages/YourPage/YourPage.tsx`
2. Add the route in `src/routes/AppRoutes.tsx`
3. Add nav item to `NAV_ITEMS` in `src/utils/constants.ts`

### When you need to add a new component:
1. Create it in `src/components/` under the appropriate subdirectory
2. Use the smooth UI patterns: `card-hover`, `btn-press`, Framer Motion entrance

---

## 10. What's Built vs What's Not

### ✅ Built and Working
- Full auth flow (login, signup, logout, persistence)
- Dashboard with animated metrics + charts
- Device list with search/filter + detail view with telemetry charts
- Issue list with severity/status filters + detail view with AI analysis
- Remediation history table
- Knowledge base with search + article detail view
- ITSM tickets table
- 404 page
- Sidebar navigation with collapse animation
- Header with search + user dropdown
- Protected routes + role-based access
- Responsive filter tabs
- Skeleton loading states everywhere
- Smooth animations on all interactions

### 🔲 Not Yet Built (Future Tasks)
- **Dark mode** — uiSlice has `theme` state but no toggle UI
- **Device CRUD** — no create/edit device form
- **Issue create/edit** — only list and view, no creation form
- **Remediation execute** — no UI button to trigger remediation from issue detail
- **Knowledge base CRUD** — no create/edit article form
- **ITSM ticket detail page** — no `/tickets/:id` route
- **Settings page** — placeholder only
- **User management** — placeholder only
- **Mobile responsive sidebar** — sidebar doesn't slide on mobile
- **Page transitions** — no AnimatePresence wrapping routes
- **Code splitting** — build warning about chunk size, needs lazy loading

---

## 11. How to Run

```bash
cd frontend
npm install
npm run dev          # Starts dev server at http://localhost:5173
```

The Vite proxy forwards `/api` to `http://localhost:8080`, so the frontend
can call `api.get('/devices')` and it hits `http://localhost:8080/api/devices`.

### Build for production:
```bash
npm run build        # Output in frontend/dist/
```

### Type-check:
```bash
npx tsc --noEmit     # Checks all TypeScript
```

---

## 12. Backend Response Format Reference

The frontend expects ALL backend responses in this format:

**Success:**
```json
{ "success": true, "message": "...", "data": { ... } }
```

**Business Error:**
```json
{ "success": false, "message": "Username already taken" }
```

**Validation Error:**
```json
{
  "status": "BAD_REQUEST",
  "code": 400,
  "message": "Validation failed",
  "path": "/api/auth/signup",
  "timestamp": "2026-08-19T22:00:00",
  "validationErrors": {
    "username": "Username must be 3-50 characters"
  }
}
```

**Auth Error:**
```json
{ "status": "Unauthorized", "code": 401, "message": "Invalid username or password" }
```

The `errorHandler.ts` utility parses all these formats into user-friendly strings.

---

## 13. Tips for Future Freebuff Sessions

When continuing work on this project:

1. **Always check `src/api/` first** to see if an API function already exists
2. **Always check `src/types/`** to see if a type already exists
3. **Follow the existing pattern:** API module → Redux slice → Page component
4. **Use existing components** from `src/components/common/` before creating new ones
5. **Use the smooth UI utilities** from `global.css` (card-hover, btn-press, etc.)
6. **Use Framer Motion** for all new animations (consistent with existing code)
7. **The Axios instance** at `src/api/axios.ts` handles all auth — don't create new Axios instances
8. **Redux store** is at `src/store/store.ts` — add new reducers there
9. **Routes** are at `src/routes/AppRoutes.tsx` — add new routes there
10. **Nav items** are in `src/utils/constants.ts` — add nav links there
