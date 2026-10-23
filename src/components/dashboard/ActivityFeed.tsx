import { useNavigate } from 'react-router-dom';
import { Panel } from '../ui/Panel';
import { Skeleton } from '../ui/Skeleton';
import type { AuditLog } from '../../api/auditApi';

interface ActivityFeedProps {
  logs: AuditLog[];
  loading?: boolean;
}

const AUTH_ACTIONS = ['LOGIN', 'LOGIN_FAILED', 'LOGOUT', '2FA'];
const ISSUE_ACTIONS = ['ISSUE_'];
const DEVICE_ACTIONS = ['DEVICE_'];
const REMEDIATION_ACTIONS = ['REMEDIATION_', 'REMED_'];

function actionMeta(action: string): { chip: string; dot: string } {
  const upper = (action || '').toUpperCase();
  if (AUTH_ACTIONS.some((a) => upper.includes(a))) {
    return { chip: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-400' };
  }
  if (ISSUE_ACTIONS.some((a) => upper.includes(a))) {
    return { chip: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-400' };
  }
  if (REMEDIATION_ACTIONS.some((a) => upper.includes(a))) {
    return { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-400' };
  }
  if (DEVICE_ACTIONS.some((a) => upper.includes(a))) {
    return { chip: 'bg-primary-50 text-primary-700 ring-primary-200', dot: 'bg-primary-400' };
  }
  return { chip: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' };
}

function humanize(action: string): string {
  const text = action.toLowerCase().replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityFeed({ logs, loading = false }: ActivityFeedProps) {
  const navigate = useNavigate();

  return (
    <Panel padded={false} className="rise h-full overflow-hidden" style={{ animationDelay: '0.24s' }}>
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Audit trail
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">Recent activity</h3>
        </div>
        <button
          onClick={() => navigate('/audit-logs')}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          View all
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 border-t border-line px-5 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="border-t border-line px-5 py-12 text-center">
          <p className="text-sm text-slate-500">No recent activity</p>
          <p className="mt-1 text-xs text-slate-400">User actions will appear here.</p>
        </div>
      ) : (
        <div className="border-t border-line">
          {logs.map((log) => {
            const meta = actionMeta(log.action);
            return (
              <div
                key={log.id}
                className="group flex items-start gap-3 border-b border-line/60 px-5 py-3 last:border-b-0"
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1 ring-inset ${meta.chip}`}
                >
                  {(log.username || '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-slate-800">
                    <span className="font-semibold text-slate-900">{log.username || 'System'}</span>{' '}
                    <span className="text-slate-500">{humanize(log.action)}</span>
                  </p>
                  {log.details && <p className="mt-0.5 truncate text-[11px] text-slate-400">{log.details}</p>}
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {log.entityType} {log.entityId != null ? `#${log.entityId}` : ''}
                  </p>
                </div>
                <span
                  title={new Date(log.createdAt).toLocaleString()}
                  className="shrink-0 font-mono text-[10px] text-slate-400"
                >
                  {timeAgo(log.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
