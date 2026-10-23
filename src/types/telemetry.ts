export interface TelemetryData {
  id: number;
  agentId: string;
  recordedAt: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  processCount?: number;
  loadAverage?: number;
  // Extended fields from Phase 2
  uptimeHours?: number;
  cpuTemperature?: number;
  topProcesses?: ProcessInfo[];
  driveMetrics?: DriveMetrics[];
  totalMemoryBytes?: number;
  availableMemoryBytes?: number;
}

export interface ProcessInfo {
  name: string;
  pid: number;
  cpuPercent: number;
  memoryBytes: number;
  threads: number;
}

export interface DriveMetrics {
  name: string;
  label: string;
  fileSystem: string;
  totalGB: number;
  usedGB: number;
  freeGB: number;
  usedPercent: number;
}

export interface TelemetrySummary {
  avgCpu: number;
  avgMemory: number;
  avgDisk: number;
  totalNetworkIn: number;
  totalNetworkOut: number;
}
