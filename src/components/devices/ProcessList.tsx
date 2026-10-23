import type { ProcessInfo } from '../../types/telemetry';

interface ProcessListProps {
  processes: ProcessInfo[];
  onKill?: (pid: number) => void;
  queuedPid?: number | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const ProcessList: React.FC<ProcessListProps> = ({ processes, onKill, queuedPid }) => {
  if (!processes || processes.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <p className="text-sm text-slate-500">No process data reported yet</p>
        <p className="mt-1 text-xs text-slate-600">Process telemetry arrives on the next agent heartbeat.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-line">
            <th className="px-5 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
              Process name
            </th>
            <th className="px-5 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
              PID
            </th>
            <th className="px-5 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
              CPU
            </th>
            <th className="px-5 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
              Memory
            </th>
            <th className="px-5 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
              Threads
            </th>
            {onKill && <th className="px-5 py-2.5 text-right" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {processes.map((process) => {
            const queued = queuedPid === process.pid;
            return (
              <tr key={process.pid} className="group transition-colors hover:bg-white/[0.02]">
                <td className="px-5 py-3 text-[13px] font-medium text-slate-200">
                  {process.name}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{process.pid}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${process.cpuPercent > 50 ? 'bg-red-400' : process.cpuPercent > 20 ? 'bg-amber-400' : 'bg-sky-400'}`}
                        style={{ width: `${Math.min(Math.max(process.cpuPercent, 0), 100)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-mono text-xs text-slate-300 tabular-nums">
                      {process.cpuPercent.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right font-mono text-xs text-slate-300 tabular-nums">
                  {formatBytes(process.memoryBytes)}
                </td>
                <td className="px-5 py-3 text-right font-mono text-xs text-slate-500 tabular-nums">
                  {process.threads}
                </td>
                {onKill && (
                  <td className="px-5 py-3 text-right">
                    {queued ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-primary-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-400" />
                        Queued
                      </span>
                    ) : (
                      <button
                        onClick={() => onKill(process.pid)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
                      >
                        Kill
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ProcessList;
