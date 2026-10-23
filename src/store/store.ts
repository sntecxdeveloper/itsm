import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import uiReducer from './uiSlice';
import dashboardReducer from '../features/dashboard/dashboardSlice';
import devicesReducer from '../features/devices/devicesSlice';
import telemetryReducer from '../features/telemetry/telemetrySlice';
import issuesReducer from '../features/issues/issuesSlice';
import remediationReducer from '../features/remediation/remediationSlice';
import knowledgeReducer from '../features/knowledge-base/knowledgeSlice';
import aiReducer from '../features/ai/aiSlice';
import itsmReducer from '../features/itsm/itsmSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    dashboard: dashboardReducer,
    devices: devicesReducer,
    telemetry: telemetryReducer,
    issues: issuesReducer,
    remediation: remediationReducer,
    knowledge: knowledgeReducer,
    ai: aiReducer,
    itsm: itsmReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
