import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { isIncidentTicket } from '../../utils/itsmSections';
import { INCIDENT_VIEWS } from '../../utils/incidentViews';
import IncidentFormPage from './IncidentFormPage';
import IncidentsPage from './IncidentsPage';
import NewIncidentPage from './NewIncidentPage';

function IncidentOverview() {
  const dispatch = useAppDispatch();
  const { tickets } = useAppSelector((s) => s.itsm);
  const username = useAppSelector((s) => s.auth.user?.username) ?? '';
  const incidents = tickets.filter(isIncidentTicket);

  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  return (
    <div className="space-y-4">
      <h1 className="text-sm font-semibold text-slate-900">Incidents · Overview</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INCIDENT_VIEWS.filter((v) => v.matches).map((v) => (
          <Link key={v.slug} to={`/tickets/incidents/${v.slug}`} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-primary-400">
            <p className="text-xs text-slate-500">{v.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{incidents.filter((t) => v.matches!(t, username)).length}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** /tickets/incidents/:id — an incident number opens the form, a view name opens that list. */
export default function IncidentRoute() {
  const { id = '' } = useParams();
  if (/^\d+$/.test(id)) return <IncidentFormPage />;
  if (id === 'new' || id === 'create-new') return <NewIncidentPage />;
  if (id === 'overview') return <IncidentOverview />;
  if (!INCIDENT_VIEWS.some((v) => v.slug === id)) return <Navigate to="/tickets/incidents" replace />;
  return <IncidentsPage view={id} />;
}
