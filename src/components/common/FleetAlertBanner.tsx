import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFleetAlerts, type FleetAlert } from '../../api/aiTaskApi';

/**
 * Shown on the dashboard only while several devices have the same problem open at once: one line per alert, with a way in to run
 * the fix on all of them. Quiet (renders nothing) otherwise, and also when the person's role may not see the alerts.
 */
export default function FleetAlertBanner() {
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getFleetAlerts()
        .then((a) => alive && setAlerts(a.filter((x) => x.status === 'OPEN')))
        .catch(() => alive && setAlerts([]));
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (alerts.length === 0) return null;
  return (
    <section aria-label="Fleet alerts" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-amber-900">
          {alerts.length === 1 ? 'The same problem on several devices' : `The same problem on several devices (${alerts.length} alerts)`}
        </h2>
        <Link to="/ai-tasks?tab=fleet" className="text-xs font-medium text-amber-900 underline">
          Open fleet checks →
        </Link>
      </div>
      <ul className="mt-1.5 space-y-0.5 text-xs text-amber-900">
        {alerts.slice(0, 3).map((a) => (
          <li key={a.id}>
            <span className="font-medium">{a.title}</span> - {a.deviceCount} devices{a.ticketCode ? ` · ticket ${a.ticketCode}` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}
