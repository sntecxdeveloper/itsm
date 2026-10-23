import { Navigate, useParams } from 'react-router-dom';
import NewServiceRequestPage from './NewServiceRequestPage';
import TicketsPage from './TicketsPage';

/** /tickets/service-requests/:view — "create-new" and "requests" (the landing page is the catalog). */
export default function ServiceRequestsPage() {
  const { view } = useParams();
  if (view === 'create-new') return <NewServiceRequestPage />;
  if (view === 'requests') return <TicketsPage sectionKey="service-requests" />;
  return <Navigate to="/tickets/service-requests" replace />;
}
