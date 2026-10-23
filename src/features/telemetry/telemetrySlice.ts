import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { TelemetryData } from '../../types';
import * as telemetryApi from '../../api/telemetryApi';

interface TelemetryState {
  data: TelemetryData[];
  loading: boolean;
  error: string | null;
}

const initialState: TelemetryState = {
  data: [],
  loading: false,
  error: null,
};

export const fetchTelemetry = createAsyncThunk(
  'telemetry/fetchByDevice',
  async (agentId: string) => {
    return await telemetryApi.getTelemetryByDeviceId(agentId);
  }
);

const telemetrySlice = createSlice({
  name: 'telemetry',
  initialState,
  reducers: {
    clearTelemetry(state) {
      state.data = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTelemetry.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTelemetry.fulfilled, (state, action: PayloadAction<TelemetryData[]>) => {
        state.data = action.payload;
        state.loading = false;
      })
      .addCase(fetchTelemetry.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch telemetry';
      });
  },
});

export const { clearTelemetry } = telemetrySlice.actions;
export default telemetrySlice.reducer;
