import type { AgentCommand, QueueCommandRequest } from '../api/commandApi';
import type { TerminalEntry } from '../components/devices/RemoteTerminal';

/**
 * What the DEX Windows agent can actually run, and how to phrase each request
 * so it accepts it. The agent is the security authority; this mirrors its rules
 * (DEXResolveAgent.Tray: Commands/CommandSecurityPolicy.cs for free-typed
 * commands, Tasks/AgentTaskRegistry for built-in tasks) so the UI can explain a
 * refusal before sending instead of after. Keep in sync with the agent.
 */

export type ActionField = 'command' | 'serviceName' | 'processName';

export interface AgentAction {
  id: string;
  label: string;
  description: string;
  field?: ActionField;
  /** Anything that changes the machine waits for the user at that PC to click Continue. */
  needsApproval: boolean;
  /** Needs administrator rights: the user at that PC approves a Windows admin (UAC) prompt. */
  needsAdmin?: boolean;
  build: (value: string) => QueueCommandRequest;
}

const task = (type: string, label: string, params: Record<string, string> = {}): QueueCommandRequest => ({
  type,
  // `action` is required by the backend but never executed for built-in tasks; the agent reads `parameters`.
  action: label,
  parameters: Object.keys(params).length ? JSON.stringify(params) : undefined,
});

export const AGENT_ACTIONS: AgentAction[] = [
  {
    id: 'SCRIPT',
    label: 'Run command',
    description: 'One allow-listed command',
    field: 'command',
    needsApproval: true,
    build: (cmd) => ({ type: 'SCRIPT', action: cmd.trim() }),
  },
  {
    id: 'RESTART_SERVICE',
    label: 'Restart service',
    description: 'Stop and start a Windows service',
    field: 'serviceName',
    needsApproval: true,
    needsAdmin: true,
    build: (name) => task('RESTART_SERVICE', `Restart service ${name.trim()}`, { serviceName: name.trim() }),
  },
  {
    id: 'START_SERVICE',
    label: 'Start service',
    description: 'Start a stopped service',
    field: 'serviceName',
    needsApproval: true,
    needsAdmin: true,
    build: (name) => task('START_SERVICE', `Start service ${name.trim()}`, { serviceName: name.trim() }),
  },
  {
    id: 'GET_SERVICE_STATUS',
    label: 'Service status',
    description: 'Read a service’s state',
    field: 'serviceName',
    needsApproval: false,
    build: (name) => task('GET_SERVICE_STATUS', `Service status ${name.trim()}`, { serviceName: name.trim() }),
  },
  {
    id: 'GET_PROCESS_STATUS',
    label: 'Process status',
    description: 'Is a program running, and how much RAM',
    field: 'processName',
    needsApproval: false,
    build: (name) => task('GET_PROCESS_STATUS', `Process status ${name.trim()}`, { processName: name.trim() }),
  },
  {
    id: 'GET_SYSTEM_INFO',
    label: 'System info',
    description: 'OS, uptime, CPU, memory',
    needsApproval: false,
    build: () => task('GET_SYSTEM_INFO', 'Get system info'),
  },
  {
    id: 'COLLECT_DIAGNOSTICS',
    label: 'Collect diagnostics',
    description: 'Health snapshot for troubleshooting',
    needsApproval: false,
    build: () => task('COLLECT_DIAGNOSTICS', 'Collect diagnostics'),
  },
  {
    id: 'FLUSH_DNS',
    label: 'Flush DNS',
    description: 'Clear the DNS resolver cache',
    needsApproval: true,
    needsAdmin: true,
    build: () => ({ type: 'FLUSH_DNS', action: 'ipconfig /flushdns' }),
  },
  {
    id: 'CLEAN_TEMP',
    label: 'Clean temp files',
    description: 'Delete the user’s temp files',
    needsApproval: true,
    build: () => ({ type: 'CLEAN_TEMP', action: 'Remove-Item $env:TEMP\\* -Recurse -Force -ErrorAction SilentlyContinue' }),
  },
  {
    id: 'CLEAR_RECYCLE_BIN',
    label: 'Empty Recycle Bin',
    description: 'Permanently delete recycled files',
    needsApproval: true,
    build: () => ({ type: 'CLEAR_RECYCLE_BIN', action: 'Clear-RecycleBin -Force' }),
  },
  {
    id: 'RUN_DEFENDER_SCAN',
    label: 'Defender quick scan',
    description: 'Windows Defender quick scan',
    needsApproval: true,
    needsAdmin: true,
    build: () => ({ type: 'RUN_DEFENDER_SCAN', action: 'Start-MpScan -ScanType QuickScan' }),
  },
];

/** Examples that pass the agent's allow-list as-is. */
export const SCRIPT_EXAMPLES = [
  'ipconfig /all',
  'systeminfo',
  'tasklist | findstr chrome',
  'sc query spooler',
  'ping -n 4 8.8.8.8',
  'netstat -ano',
  'powershell -Command "Get-Service -Name Spooler"',
  'powershell -Command "Get-Volume"',
];

// Mirrors CommandSecurityPolicy.AllowedPrefixes / AllowedPowerShellCommands.
const ALLOWED_PREFIXES = [
  'systeminfo', 'hostname', 'ipconfig', 'ifconfig', 'whoami', 'echo', 'date', 'time', 'ver', 'set', 'env',
  'tasklist', 'wmic process', 'wmic diskdrive', 'wmic logicaldisk', 'sc query', 'sc start', 'sc stop', 'sc status',
  'net start', 'net stop', 'ping', 'tracert', 'nslookup', 'netstat', 'arp', 'pathping', 'route print', 'dir',
  'diskpart list', 'fsutil', 'type', 'more', 'find', 'findstr', 'sort', 'where', 'which', 'powershell -Command',
  'cmd /c echo',
];
const ALLOWED_PS = [
  'Get-Process', 'Get-Service', 'Get-WmiObject', 'Get-CimInstance', 'Get-NetAdapter', 'Get-NetIPAddress', 'Get-Disk',
  'Get-Partition', 'Get-Volume', 'Get-WinEvent', 'Get-HotFix', 'Get-Package', 'Get-ItemProperty', 'Get-Content',
  'Test-Connection', 'Test-NetConnection', 'Get-Date', 'Get-ComputerInfo', 'Restart-Service', 'Stop-Service',
  'Start-Service', 'Remove-Item', 'Clear-RecycleBin', 'Start-Process', 'Start-MpScan',
];

const startsWithCi = (text: string, prefix: string) => text.toLowerCase().startsWith(prefix.toLowerCase());
const firstToken = (text: string) => text.trim().split(/\s+/)[0] ?? '';

/**
 * Returns why the agent would refuse a free-typed command, or null if it
 * should be accepted. Best-effort pre-check only - the agent re-checks.
 */
export function checkScriptCommand(raw: string): string | null {
  const cmd = raw.trim().replace(/\s+/g, ' ');
  if (!cmd) return 'Enter a command.';
  if (/[\r\n]/.test(raw)) return 'One command per line - line breaks are refused.';
  if (cmd.includes('&&') || cmd.includes('||') || cmd.includes('&')) return 'Chaining with & is refused - run one command at a time.';
  if (cmd.includes(';')) return 'Semicolons are refused - run one command at a time.';
  if (cmd.includes('>') || cmd.includes('<')) return 'File redirection (> <) is refused.';
  // PowerShell accepts any prefix of -EncodedCommand (-e, -en, -enc, …).
  const encodedFlag = /\s-e(?:n|nc|nco|ncod|ncode|ncoded|ncodedc|ncodedco|ncodedcom|ncodedcomm|ncodedcomma|ncodedcomman|ncodedcommand)?\b/i;
  if (encodedFlag.test(cmd) && /powershell|pwsh/i.test(cmd)) {
    return 'Encoded PowerShell is refused.';
  }

  if (cmd.includes('|')) {
    const bad = cmd.split('|').map((p) => firstToken(p)).find((t) => !ALLOWED_PREFIXES.some((a) => a.toLowerCase() === t.toLowerCase()));
    return bad ? `"${bad}" can't be used in a pipe - both sides must be allowed plain commands (e.g. tasklist | findstr chrome).` : null;
  }

  if (/^(powershell|pwsh)\b/i.test(cmd)) {
    const idx = cmd.search(/-Command\b|-c\s/i);
    if (idx < 0) return 'Use powershell -Command "…".';
    const inner = cmd.slice(idx).replace(/^(-Command|-c)\s*/i, '').replace(/^["']|["']$/g, '').trim();
    return ALLOWED_PS.some((p) => startsWithCi(inner, p))
      ? null
      : `"${firstToken(inner)}" isn't an allowed PowerShell cmdlet. Allowed: Get-Service, Get-Process, Get-Volume, Test-NetConnection, …`;
  }

  if (ALLOWED_PS.some((p) => startsWithCi(cmd, p))) {
    return `Wrap PowerShell cmdlets as: powershell -Command "${cmd}"`;
  }

  return ALLOWED_PREFIXES.some((p) => startsWithCi(cmd, p))
    ? null
    : `"${firstToken(cmd)}" isn't on the agent's allow-list. Try ipconfig, tasklist, sc query, ping, netstat, or powershell -Command "Get-…".`;
}

/** Plain-language status for a queued command. */
export function describeStatus(status: string, needsApproval: boolean): string {
  switch (status) {
    case 'PENDING':
      return 'Queued - waiting for the device to pick it up (instant while it is online)';
    case 'EXECUTING':
      return needsApproval
        ? 'The device has it - waiting for the user on that PC to approve, then running'
        : 'The device is running it';
    case 'COMPLETED':
      return 'Done';
    case 'FAILED':
      return 'Failed or declined';
    case 'EXPIRED':
      return 'Expired - the device was offline and never picked it up, so nothing ran';
    case 'CANCELLED':
      return 'Cancelled before the device picked it up - nothing ran';
    default:
      return status;
  }
}

/** Converts stored command history (newest first) into Terminal entries (oldest first). */
export function toTerminalEntries(commands: AgentCommand[]): TerminalEntry[] {
  return commands
    .filter((c) => c.type === 'SCRIPT')
    .slice(0, 20)
    .reverse()
    .map((c) => {
      const finished = c.status !== 'PENDING' && c.status !== 'EXECUTING';
      return {
        id: c.commandId,
        command: c.action,
        output: finished ? formatOutput(c.result) : '(no result yet)',
        state: c.status === 'COMPLETED' ? 'done' : 'failed',
        note: 'earlier',
        timestamp: new Date(c.createdAt),
      };
    });
}

/** Built-in tasks return JSON; show it readably. Plain command output passes through. */
export function formatOutput(result?: string | null): string {
  if (!result) return '(no output)';
  const trimmed = result.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      /* not JSON after all */
    }
  }
  return result;
}
