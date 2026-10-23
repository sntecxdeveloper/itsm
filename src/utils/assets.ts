import type { Device } from '../types';

export const ASSET_TYPES = ['Laptop', 'Desktop', 'Server', 'Printer', 'Network Device', 'Monitor', 'Software', 'Others'] as const;
export const ASSET_STATUSES = ['Active', 'In Repair', 'In Stock', 'Retired', 'Lost'] as const;

export type AssetType = (typeof ASSET_TYPES)[number];
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  brand: string;
  model: string;
  user: string;
  department: string;
  location: string;
  status: AssetStatus;
  lastSeen?: string;
  warranty?: string;
  serial?: string;
  source: 'agent' | 'manual';
  deviceId?: number;
  os?: string;
  cpu?: string;
  ram?: string;
  disk?: string;
  online?: boolean;
  atRisk?: boolean;
}

export type NewAsset = Omit<Asset, 'id' | 'source' | 'lastSeen'>;

// The backend has no asset table yet: manually added assets live in this browser,
// agent-enrolled devices are listed automatically from /devices.
const STORAGE_KEY = 'dex.assets.manual';

export function loadManualAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Asset[]) : [];
  } catch {
    return [];
  }
}

export function saveManualAssets(assets: Asset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
  } catch {
    /* storage unavailable: assets stay for this visit only */
  }
}

export function nextAssetId(existing: Asset[]): string {
  const max = existing
    .map((a) => /^AST-(\d+)$/.exec(a.id)?.[1])
    .reduce((m, n) => Math.max(m, n ? Number(n) : 0), 0);
  return `AST-${String(max + 1).padStart(5, '0')}`;
}

export function deviceToAsset(d: Device): Asset {
  const hw = d.hardware;
  const os = [d.os, d.osVersion].filter(Boolean).join(' ');
  const isServer = /server/i.test(d.os ?? '');
  const isLaptop = hw?.batteryChargePercent != null || hw?.batteryStatus != null;
  const disk = hw?.disks?.reduce((sum, x) => sum + (x.totalGB || 0), 0);
  return {
    id: `DEV-${String(d.id).padStart(5, '0')}`,
    name: d.hostname,
    type: isServer ? 'Server' : isLaptop ? 'Laptop' : 'Desktop',
    brand: hw?.motherboardManufacturer || '—',
    model: hw?.motherboardModel || '—',
    user: '—',
    department: '—',
    location: d.ipAddress || '—',
    status: 'Active',
    lastSeen: d.lastHeartbeat,
    source: 'agent',
    deviceId: d.id,
    os: os || undefined,
    cpu: hw?.cpuModel,
    ram: hw?.ramTotalGB ? `${Math.round(hw.ramTotalGB)} GB` : undefined,
    disk: disk ? `${Math.round(disk)} GB` : undefined,
    online: d.status === 'ONLINE',
    atRisk: d.status === 'ERROR' || (d.openIssueCount ?? 0) > 0,
  };
}

const CSV_COLUMNS = ['name', 'type', 'brand', 'model', 'serial', 'user', 'department', 'location', 'status', 'warranty'] as const;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** Header row required; columns: name,type,brand,model,serial,user,department,location,status,warranty. */
export function parseAssetsCsv(text: string): NewAsset[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const head = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (cells: string[], key: string) => cells[head.indexOf(key)] ?? '';
  return lines
    .slice(1)
    .map((l) => splitCsvLine(l))
    .filter((cells) => col(cells, 'name'))
    .map((cells) => {
      const type = ASSET_TYPES.find((t) => t.toLowerCase() === col(cells, 'type').toLowerCase()) ?? 'Others';
      const status = ASSET_STATUSES.find((s) => s.toLowerCase() === col(cells, 'status').toLowerCase()) ?? 'Active';
      return {
        name: col(cells, 'name'),
        type,
        status,
        brand: col(cells, 'brand') || '—',
        model: col(cells, 'model') || '—',
        serial: col(cells, 'serial') || undefined,
        user: col(cells, 'user') || '—',
        department: col(cells, 'department') || '—',
        location: col(cells, 'location') || '—',
        warranty: col(cells, 'warranty') || undefined,
      };
    });
}

export function assetsToCsv(assets: Asset[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = assets.map((a) => CSV_COLUMNS.map((c) => esc(String(a[c as keyof Asset] ?? ''))).join(','));
  return [CSV_COLUMNS.join(','), ...rows].join('\n');
}
