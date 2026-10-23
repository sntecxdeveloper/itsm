# Dex Platform — Extension Guide

> Practical recipes for common tasks. Copy-paste friendly.

---

## Recipe 1: Add a New Page

### Files to touch:
1. `src/pages/YourPage/YourPage.tsx` — Create the page
2. `src/routes/AppRoutes.tsx` — Add the route
3. `src/utils/constants.ts` — Add nav item (if it should appear in sidebar)

### Step 1: Create the page
```tsx
// src/pages/YourPage/YourPage.tsx
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';

export default function YourPage() {
  const dispatch = useAppDispatch();
  const { items, loading } = useAppSelector(state => state.yourFeature);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Your Page</h1>
        <p className="text-sm text-slate-500 mt-1">Description</p>
      </motion.div>
      {/* content */}
    </div>
  );
}
```

### Step 2: Add route (in AppRoutes.tsx)
```tsx
// Inside the protected routes section:
<Route path="/your-page" element={<YourPage />} />
```

### Step 3: Add nav item (in constants.ts)
```tsx
// Add to NAV_ITEMS array:
{ path: '/your-page', label: 'Your Page', icon: 'your-icon' },
```

---

## Recipe 2: Add a Form (e.g., Create Device)

### Use React Hook Form (already installed)
```tsx
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';

interface DeviceForm {
  hostname: string;
  ipAddress: string;
  os: string;
}

export default function CreateDeviceForm({ onSubmit }: { onSubmit: (data: DeviceForm) => void }) {
  const { register, handleSubmit, formState: { errors }, formState: { isSubmitting } } = useForm<DeviceForm>();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Hostname</label>
        <input
          {...register('hostname', { required: 'Hostname is required' })}
          className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all duration-200"
        />
        {errors.hostname && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 text-xs text-red-600">
            {errors.hostname.message}
          </motion.p>
        )}
      </div>
      <button type="submit" disabled={isSubmitting}
        className="px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 btn-press disabled:opacity-50 transition-all duration-200">
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
```

---

## Recipe 3: Add Dark Mode

### Step 1: Add dark mode CSS to global.css
```css
@layer base {
  .dark {
    --color-background: #0f172a;
    --color-foreground: #f1f5f9;
  }
}
```

### Step 2: Add toggle to Header.tsx
```tsx
const { theme } = useAppSelector(state => state.ui);
const { setTheme } = require('../store/uiSlice');

// In header:
<button onClick={() => dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'))}>
  {theme === 'dark' ? '☀️' : '🌙'}
</button>
```

### Step 3: Apply class to root
```tsx
// In main.tsx or App.tsx:
<html className={theme === 'dark' ? 'dark' : ''}>
```

---

## Recipe 4: Add a Modal Dialog

### Use the existing ConfirmDialog component:
```tsx
import ConfirmDialog from '../components/common/ConfirmDialog';

const [showConfirm, setShowConfirm] = useState(false);

<ConfirmDialog
  isOpen={showConfirm}
  title="Delete Device?"
  message="This action cannot be undone."
  confirmLabel="Delete"
  variant="danger"
  onConfirm={() => { /* delete logic */ setShowConfirm(false); }}
  onCancel={() => setShowConfirm(false)}
/>
```

---

## Recipe 5: Add Page Transitions

### Wrap routes with AnimatePresence in AppRoutes.tsx:
```tsx
import { AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

export default function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* ... all routes */}
      </Routes>
    </AnimatePresence>
  );
}
```

---

## Recipe 6: Add a New Redux Slice

### Template:
```typescript
// src/features/feature/featureSlice.ts
import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import * as featureApi from '../../api/featureApi';
import type { FeatureItem } from '../../types';

interface FeatureState {
  items: FeatureItem[];
  selected: FeatureItem | null;
  loading: boolean;
  error: string | null;
}

const initialState: FeatureState = {
  items: [],
  selected: null,
  loading: false,
  error: null,
};

export const fetchItems = createAsyncThunk('feature/fetchAll', async () => {
  return await featureApi.getItems();
});

const featureSlice = createSlice({
  name: 'feature',
  initialState,
  reducers: {
    clearSelected(state) { state.selected = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchItems.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchItems.fulfilled, (state, action: PayloadAction<FeatureItem[]>) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed';
      });
  },
});

export const { clearSelected } = featureSlice.actions;
export default featureSlice.reducer;
```

Then add to store.ts:
```typescript
import featureReducer from '../features/feature/featureSlice';
// Add to reducer object:
feature: featureReducer,
```

---

## Recipe 7: Add a Loading Skeleton

### Use existing skeleton components:
```tsx
import { SkeletonCard, SkeletonTable, SkeletonBlock } from '../components/common/Loading';

// Card skeleton
<SkeletonCard />

// Table skeleton
<SkeletonTable rows={5} cols={4} />

// Custom skeleton
<SkeletonBlock className="h-64 w-full rounded-xl" />
```

---

## Recipe 8: Add Animated Numbers to Dashboard

### Use the existing MetricCard (already has count-up):
```tsx
import MetricCard from '../components/dashboard/MetricCard';

<MetricCard
  title="Total Users"
  value={userCount}         // Will animate from 0 to this value
  color="purple"            // primary, emerald, amber, red, purple, cyan
  delay={0.2}               // Stagger animation delay
  icon={<UserIcon />}
  trend={{ value: 12, isUp: true }}  // Optional trend indicator
/>
```

---

## Recipe 9: Add Table with Sorting & Pagination

### Use the existing DataTable component:
```tsx
import DataTable, { type Column } from '../components/common/DataTable';

const columns: Column<MyItem>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'status', label: 'Status', render: (item) => <Badge status={item.status} /> },
  { key: 'date', label: 'Date', sortable: true, render: (item) => formatDate(item.date) },
];

<DataTable
  columns={columns}
  data={items}
  loading={loading}
  keyExtractor={(item) => item.id}
  onRowClick={(item) => navigate(`/items/${item.id}`)}
  emptyMessage="No items found"
  pageSize={15}
/>
```

---

## Recipe 10: Connect a New Backend Endpoint

### The full pipeline:

```
src/types/newType.ts          ← Define the TypeScript type
src/api/newApi.ts             ← Write the API function using axios instance
src/features/new/newSlice.ts  ← Create Redux slice with async thunk
src/pages/New/NewPage.tsx     ← Create page component
src/routes/AppRoutes.tsx      ← Add route
src/store/store.ts            ← Register reducer
```

Example API function:
```typescript
// src/api/newApi.ts
import api from './axios';
import type { NewType } from '../types';

export async function getNewThings(): Promise<NewType[]> {
  const response = await api.get<{ success: boolean; data: NewType[] }>('/new-things');
  return response.data.data;
}
```

The `api` instance already:
- Has baseURL set to `/api` (proxied to backend)
- Attaches JWT token to every request
- Redirects to /login on 401

---

## CSS Utility Reference (from global.css)

| Class | Effect |
|---|---|
| `card-hover` | Lift effect on hover (translateY -2px + shadow) |
| `btn-press` | Scale down on click (scale 0.98) |
| `skeleton` | Shimmer loading animation |
| `pulse-badge` | Pulsing opacity animation |
| `focus-ring` | Blue glow on focus |
| `sidebar-transition` | Smooth width/position change |
| `table-row-hover` | Background color transition |
| `modal-backdrop` | Backdrop blur |
| `gradient-text` | Gradient colored text |
| `gpu-accelerated` | translateZ(0) for compositing |
| `count-animate` | Slide-up entrance animation |
