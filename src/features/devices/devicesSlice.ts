import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { Device } from '../../types';
import * as deviceApi from '../../api/deviceApi';

interface DevicesState {
  items: Device[];
  selected: Device | null;
  loading: boolean;
  error: string | null;
}

const initialState: DevicesState = {
  items: [],
  selected: null,
  loading: false,
  error: null,
};

export const fetchDevices = createAsyncThunk('devices/fetchAll', async () => {
  return await deviceApi.getDevices();
});

export const fetchDeviceById = createAsyncThunk('devices/fetchById', async (id: number) => {
  return await deviceApi.getDeviceById(id);
});

const devicesSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {
    clearSelected(state) {
      state.selected = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDevices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDevices.fulfilled, (state, action: PayloadAction<Device[]>) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchDevices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch devices';
      })
      .addCase(fetchDeviceById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDeviceById.fulfilled, (state, action: PayloadAction<Device>) => {
        state.selected = action.payload;
        state.loading = false;
      })
      .addCase(fetchDeviceById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch device';
      });
  },
});

export const { clearSelected, clearError } = devicesSlice.actions;
export default devicesSlice.reducer;
