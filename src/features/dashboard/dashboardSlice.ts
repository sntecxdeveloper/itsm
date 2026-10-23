import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as deviceApi from '../../api/deviceApi';
import * as issueApi from '../../api/issueApi';
import * as remediationApi from '../../api/remediationApi';
import type { Device, Issue } from '../../types';

interface DashboardRemediation {
  id: number;
  remediationCode?: string;
  issueId?: number;
  issueCode?: string;
  agentId?: string;
  hostname?: string;
  action: string;
  details?: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  executedBy?: string;
  result?: string;
  durationMs?: number;
  createdAt?: string;
}

interface DashboardState {
  devices: Device[];
  issues: Issue[];
  remediations: DashboardRemediation[];
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  devices: [],
  issues: [],
  remediations: [],
  loading: false,
  error: null,
};

export const fetchDashboardData = createAsyncThunk('dashboard/fetchAll', async () => {
  const [devices, issues, remediations] = await Promise.allSettled([
    deviceApi.getDevices(),
    issueApi.getIssues(),
    remediationApi.getRemediations(),
  ]);

  return {
    devices: devices.status === 'fulfilled' ? devices.value : [],
    issues: issues.status === 'fulfilled' ? issues.value : [],
    remediations: (remediations.status === 'fulfilled' ? remediations.value : []) as DashboardRemediation[],
  };
});

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardData.fulfilled, (state, action) => {
        state.devices = action.payload.devices;
        state.issues = action.payload.issues;
        state.remediations = action.payload.remediations;
        state.loading = false;
      })
      .addCase(fetchDashboardData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load dashboard';
      });
  },
});

export default dashboardSlice.reducer;
