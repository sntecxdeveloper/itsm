import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { ItsmTicket } from '../../types';
import * as itsmApi from '../../api/itsmApi';
import type { RootState } from '../../store/store';

interface ItsmState {
  tickets: ItsmTicket[];
  loading: boolean;
  error: string | null;
}

const initialState: ItsmState = {
  tickets: [],
  loading: false,
  error: null,
};

// Admins see every ticket; everyone else only sees tickets assigned to their own login.
export const fetchTickets = createAsyncThunk('itsm/fetchTickets', async (_: void, { getState }) => {
  const all = await itsmApi.getTickets();
  const user = (getState() as RootState).auth.user;
  if (user?.role === 'ROLE_ADMIN') return all;
  const me = (user?.username ?? '').trim().toLowerCase();
  // A ticket in an assignment group is only sent to that group's technicians, so it stays.
  return all.filter((t) => t.assignmentGroupId != null || (!!me && (t.assignedTo ?? '').trim().toLowerCase() === me));
});

const itsmSlice = createSlice({
  name: 'itsm',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTickets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTickets.fulfilled, (state, action: PayloadAction<ItsmTicket[]>) => {
        state.tickets = action.payload;
        state.loading = false;
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch tickets';
      });
  },
});

export default itsmSlice.reducer;
