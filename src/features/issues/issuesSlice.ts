import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { Issue, IssueFilters } from '../../types';
import * as issueApi from '../../api/issueApi';

interface IssuesState {
  items: Issue[];
  selected: Issue | null;
  loading: boolean;
  error: string | null;
  filters: IssueFilters;
}

const initialState: IssuesState = {
  items: [],
  selected: null,
  loading: false,
  error: null,
  filters: {},
};

export const fetchIssues = createAsyncThunk(
  'issues/fetchAll',
  async (params?: { severity?: string; status?: string }) => {
    return await issueApi.getIssues(params);
  }
);

export const fetchIssueById = createAsyncThunk('issues/fetchById', async (id: number) => {
  return await issueApi.getIssueById(id);
});

export const updateIssueStatus = createAsyncThunk(
  'issues/updateStatus',
  async ({ id, status }: { id: number; status: string }) => {
    return await issueApi.updateIssueStatus(id, status);
  }
);

export const assignIssue = createAsyncThunk(
  'issues/assign',
  async ({ id, assignedTo }: { id: number; assignedTo: string }) => {
    return await issueApi.assignIssue(id, assignedTo);
  }
);

const issuesSlice = createSlice({
  name: 'issues',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<IssueFilters>) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters(state) {
      state.filters = {};
    },
    clearSelected(state) {
      state.selected = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchIssues.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchIssues.fulfilled, (state, action: PayloadAction<Issue[]>) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchIssues.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch issues';
      })
      .addCase(fetchIssueById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchIssueById.fulfilled, (state, action: PayloadAction<Issue>) => {
        state.selected = action.payload;
        state.loading = false;
      })
      .addCase(fetchIssueById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch issue';
      })
      .addCase(updateIssueStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.items.findIndex((i) => i.id === updated.id);
        if (index !== -1) {
          state.items[index] = updated;
        }
        if (state.selected?.id === updated.id) {
          state.selected = updated;
        }
      })
      .addCase(assignIssue.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.items.findIndex((i) => i.id === updated.id);
        if (index !== -1) {
          state.items[index] = updated;
        }
        if (state.selected?.id === updated.id) {
          state.selected = updated;
        }
      });
  },
});

export const { setFilters, clearFilters, clearSelected, clearError } = issuesSlice.actions;
export default issuesSlice.reducer;
