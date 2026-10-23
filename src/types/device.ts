export interface Device {
  id: number;
  agentId: string;
  hostname: string;
  ipAddress?: string;
  os?: string;
  osVersion?: string;
  agentVersion?: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'ENROLLING';
  lastHeartbeat?: string;
  createdAt?: string;
  // Extended fields from Phase 2
  hardware?: HardwareInfo;
  eventSummary?: EventSummary;
  openIssueCount?: number;
  location?: string | null;
  region?: string | null;
  /** Names of the groups the device is in, and its CPU, memory and disk (devices list only). */
  groups?: string[];
  /** The customer company (organization) the device belongs to (devices list only). */
  organizationId?: number | null;
  organizationName?: string | null;
  cpuModel?: string | null;
  ramGb?: number | null;
  diskGb?: number | null;
}

export interface HardwareInfo {
  cpuModel: string;
  cpuManufacturer: string;
  cpuMaxClockMhz: number;
  cpuCores: number;
  cpuLogicalProcessors: number;
  ramTotalGB: number;
  memorySlots: MemorySlot[];
  gpus: GpuInfo[];
  motherboardManufacturer: string;
  motherboardModel: string;
  biosVersion: string;
  uptimeHours: number;
  disks: DiskInfo[];
  batteryStatus?: number;
  batteryChargePercent?: number;
  networkAdapters?: NetworkAdapterInfo[];
}

export interface NetworkAdapterInfo {
  name: string;
  description?: string;
  macAddress?: string;
  ipAddresses?: string[];
}

export interface MemorySlot {
  capacityGB: number;
  speedMHz: number;
  manufacturer: string;
  slot: string;
}

export interface GpuInfo {
  name: string;
  vramGB: number;
  driverVersion: string;
  videoProcessor: string;
}

export interface DiskInfo {
  name: string;
  label: string;
  fileSystem: string;
  totalGB: number;
  freeGB: number;
  usedPercent: number;
}

export interface EventSummary {
  totalEvents: number;
  errors: number;
  warnings: number;
  informational: number;
  lookbackMinutes: number;
  lastEventTime?: string;
}

export interface SystemEvent {
  id: number;
  level: string;
  source: string;
  message: string;
  timeCreated: string;
  machineName: string;
  recordId?: number;
  logName: string;
}

export interface AgentEnrollmentRequest {
  agentId: string;
  hostname: string;
  ipAddress?: string;
  os?: string;
  osVersion?: string;
  agentVersion?: string;
  enrollmentToken: string;
}

export interface AgentHeartbeatRequest {
  agentId: string;
  agentVersion?: string;
  ipAddress?: string;
}

export interface DeviceHealthSummary {
  total: number;
  online: number;
  offline: number;
  error: number;
}
