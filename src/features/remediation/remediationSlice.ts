import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';

import * as remediationApi from '../../api/remediationApi';

interface RemediationApiItem {
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

interface RemediationState {
  items: RemediationApiItem[];
  loading: boolean;
  error: string | null;
}

const initialState: RemediationState = {
  items: [],
  loading: false,
  error: null,
};

export const fetchRemediations = createAsyncThunk('remediation/fetchAll', async () => {
  return await remediationApi.getRemediations() as RemediationApiItem[];
});

const remediationSlice = createSlice({
  name: 'remediation',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    void remediationApi;
    builder
      .addCase(fetchRemediations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRemediations.fulfilled, (state, action: PayloadAction<RemediationApiItem[]>) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchRemediations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch remediations';
      });
  },
});

export default remediationSlice.reducer;
