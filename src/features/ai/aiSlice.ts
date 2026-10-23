import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as aiApi from '../../api/aiApi';

interface AiRecommendation {
  explanation: string;
  recommendations: string[];
  confidence: number;
}

interface AiState {
  recommendation: AiRecommendation | null;
  loading: boolean;
  error: string | null;
}

const initialState: AiState = {
  recommendation: null,
  loading: false,
  error: null,
};

export const fetchRecommendation = createAsyncThunk(
  'ai/fetchRecommendation',
  async (issueId: number) => {
    const result = await aiApi.getRecommendation(issueId);
    return result as AiRecommendation;
  }
);

export const analyzeIssue = createAsyncThunk(
  'ai/analyzeIssue',
  async (issueId: number) => {
    const result = await aiApi.explainIssue(issueId);
    return result as AiRecommendation;
  }
);

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    clearRecommendation(state) {
      state.recommendation = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecommendation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecommendation.fulfilled, (state, action) => {
        state.recommendation = action.payload as AiRecommendation;
        state.loading = false;
      })
      .addCase(fetchRecommendation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch recommendation';
      })
      .addCase(analyzeIssue.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(analyzeIssue.fulfilled, (state, action) => {
        state.recommendation = action.payload as AiRecommendation;
        state.loading = false;
      })
      .addCase(analyzeIssue.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to analyze issue';
      });
  },
});

export const { clearRecommendation } = aiSlice.actions;
export default aiSlice.reducer;
