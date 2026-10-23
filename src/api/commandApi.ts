import api from './axios';
import type { DeviceKbSuggestion, KbScriptRun } from '../types/knowledge';
import { agentCommandsTopic, isLive, subscribeTopic } from './liveBus';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AgentCommand {
  id: number;
  commandId: string;
  agentId: string;
  type: string;
  action: string;
  parameters?: string;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  result?: string;
  createdAt: string;
  executedAt?: string;
}

export interface QueueCommandRequest {
  type: string;
  action: string;
  parameters?: string;
}

// Queue a command for an agent
export async function queueCommand(agentId: string, request: QueueCommandRequest): Promise<AgentCommand> {
  const response = await api.post<ApiResponse<AgentCommand>>(`/agent/${agentId}/commands`, request);
  return response.data.data;
}

// Queue a command for a device from the web UI (operator endpoint - audit-logged).
export async function queueDeviceCommand(deviceId: number, request: QueueCommandRequest): Promise<AgentCommand> {
  const response = await api.post<ApiResponse<AgentCommand>>(`/devices/${deviceId}/commands`, request);
  return response.data.data;
}

// Run a knowledge-base script on a device. The backend loads the script text itself;
// runAsAdmin makes the agent ask the user at that PC to approve Windows' admin prompt.
/**
 * Queues the approved, signed version of a KB script on a device. Admin rights come from the
 * script's own metadata; parameters are validated by the backend and again by the agent.
 */
export async function runKbScript(
  deviceId: number,
  scriptId: number,
  parameters: Record<string, string | number | boolean> = {},
  issueId?: number,
): Promise<AgentCommand> {
  const response = await api.post<ApiResponse<AgentCommand>>(`/devices/${deviceId}/kb-scripts/${scriptId}/run`, {
    parameters,
    issueId,
  });
  return response.data.data;
}

/** KB fix runs on a device, newest first, with their check/fix/verify/undo outcome. */
export async function getDeviceKbRuns(deviceId: number, limit = 20): Promise<KbScriptRun[]> {
  const response = await api.get<ApiResponse<KbScriptRun[]>>(`/devices/${deviceId}/kb-runs`, { params: { limit } });
  return response.data.data;
}

/** Approved fixes matching the device's open issues. */
export async function getDeviceKbSuggestions(deviceId: number): Promise<DeviceKbSuggestion[]> {
  const response = await api.get<ApiResponse<DeviceKbSuggestion[]>>(`/devices/${deviceId}/kb-suggestions`);
  return response.data.data;
}

// Recent commands for a device, newest first, with their real output once finished.
export async function getDeviceCommands(deviceId: number, limit = 50): Promise<AgentCommand[]> {
  const response = await api.get<ApiResponse<AgentCommand[]>>(`/devices/${deviceId}/commands`, { params: { limit } });
  return response.data.data;
}

export const isFinished = (status: AgentCommand['status']) =>
  status === 'COMPLETED' || status === 'FAILED' || status === 'EXPIRED' || status === 'CANCELLED';

/** Cancels a command the device hasn't picked up yet. */
export async function cancelDeviceCommand(deviceId: number, commandId: string): Promise<AgentCommand> {
  const response = await api.post<ApiResponse<AgentCommand>>(`/devices/${deviceId}/commands/${commandId}/cancel`);
  return response.data.data;
}

/**
 * Polls a queued command until the agent reports a result. The agent picks
 * commands up within ~5s, but anything that changes the machine first waits
 * for the user at that PC to approve it, so this can legitimately take a
 * while. Resolves with the last-seen command on timeout (still unfinished).
 */
export async function waitForCommandResult(
  deviceId: number,
  commandId: string,
  { timeoutMs = 5 * 60_000, intervalMs = 2_000, onUpdate, signal, agentId }: {
    timeoutMs?: number;
    intervalMs?: number;
    onUpdate?: (command: AgentCommand) => void;
    signal?: AbortSignal;
    /** When given, listens for pushed updates and only polls slowly as a safety net. */
    agentId?: string;
  } = {},
): Promise<AgentCommand | null> {
  const deadline = Date.now() + timeoutMs;
  let last: AgentCommand | null = null;
  let wake: (() => void) | null = null;

  const accept = (cmd: AgentCommand): AgentCommand => {
    const merged = { ...(last ?? {}), ...cmd } as AgentCommand;
    last = merged;
    onUpdate?.(merged);
    return merged;
  };
  const unsubscribe = agentId
    ? subscribeTopic(agentCommandsTopic(agentId), (data) => {
        const cmd = data as AgentCommand;
        if (cmd?.commandId !== commandId) return;
        if (isFinished(accept(cmd).status)) wake?.();
      })
    : () => {};

  try {
    while (Date.now() < deadline && !signal?.aborted) {
      // last is also set from the push callback, which TS can't see here.
      const current = last as AgentCommand | null;
      if (current && isFinished(current.status)) return current;
      const commands = await getDeviceCommands(deviceId, 50);
      const match = commands.find((c) => c.commandId === commandId);
      if (match && isFinished(accept(match).status)) return last;
      // A push ends the wait early; while live the poll is only a safety net.
      const pause = agentId && isLive() ? 15_000 : intervalMs;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, pause);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
        signal?.addEventListener('abort', () => wake?.(), { once: true });
      });
      wake = null;
    }
    return last;
  } finally {
    unsubscribe();
  }
}

// Get pending commands for an agent
export async function getPendingCommands(agentId: string): Promise<AgentCommand[]> {
  const response = await api.get<ApiResponse<AgentCommand[]>>(`/agent/${agentId}/commands`);
  return response.data.data;
}

// Report command result
export async function reportCommandResult(
  agentId: string,
  commandId: string,
  success: boolean,
  output?: string
): Promise<void> {
  await api.post(`/agent/${agentId}/command-result`, {
    commandId,
    success,
    output
  });
}

// Get agent health
export async function getAgentHealth(agentId: string): Promise<Record<string, unknown>> {
  const response = await api.get<ApiResponse<Record<string, unknown>>>(`/devices/agent/${agentId}/health`);
  return response.data.data;
}

// Get health summary
export async function getHealthSummary(): Promise<{
  totalAgents: number;
  onlineAgents: number;
  offlineAgents: number;
  openIssues: number;
  overallHealthy: boolean;
}> {
  const response = await api.get<ApiResponse<{
    totalAgents: number;
    onlineAgents: number;
    offlineAgents: number;
    openIssues: number;
    overallHealthy: boolean;
  }>>('/devices/health-summary');
  return response.data.data;
}
