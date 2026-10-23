import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ProtectedRoute from './ProtectedRoute';
import SetupRoute from './SetupRoute';
import RoleRoute from './RoleRoute';
import { Skeleton } from '../components/common/Skeleton';
import LeaveToConsole from './LeaveToConsole';

// The ITSM app: tickets and Setup. Every other address belongs to the console (another app on the same site): a link to one of them
// loads that app instead (see LeaveToConsole), so addresses stay exactly the same as before the split.
const GroupsPage = lazy(() => import('../group/pages/GroupsPage'));
const ItsmHomePage = lazy(() => import('../pages/ITSM/ItsmHomePage'));
const IncidentsPage = lazy(() => import('../incident/pages/IncidentsPage'));
const IncidentRoute = lazy(() => import('../incident/pages/IncidentRoute'));
const ProblemsPage = lazy(() => import('../pages/ITSM/ProblemsPage'));
const ServiceCatalogPage = lazy(() => import('../request/pages/ServiceCatalogPage'));
const CatalogRequestPage = lazy(() => import('../request/pages/CatalogRequestPage'));
const ServiceRequestsPage = lazy(() => import('../request/pages/ServiceRequestsPage'));
const RequestedItemPage = lazy(() => import('../request/pages/RequestedItemPage'));
const CatalogTaskPage = lazy(() => import('../request/pages/CatalogTaskPage'));
const ChangesPage = lazy(() => import("../change/pages/ChangesPage"));
const TicketsPage =lazy(() => import('../pages/ITSM/TicketsPage'));
const SetupPage = lazy(() => import('../setup/pages/SetupPage'));
const LifeCyclesPage = lazy(() => import('../setup/pages/LifeCyclesPage'));
const ChatSettingsPage = lazy(() => import('../setup/pages/ChatSettingsPage'));
const MailSettingsPage = lazy(() => import('../setup/pages/MailSettingsPage'));
const MailAddressesPage = lazy(() => import('../setup/pages/MailAddressesPage'));
const MailBoxPage = lazy(() => import('../setup/pages/MailBoxPage'));
const MailFilterPage = lazy(() => import('../setup/pages/MailFilterPage'));
const EmailCommandPage = lazy(() => import('../setup/pages/EmailCommandPage'));
const NotificationTemplatesPage = lazy(() => import('../setup/pages/NotificationTemplatesPage'));
const NotificationRulesPage = lazy(() => import('../setup/pages/NotificationRulesPage'));
const BusinessRulesPage = lazy(() => import('../setup/pages/BusinessRulesPage'));
const SlaPage = lazy(() => import('../setup/pages/SlaTargetsPage'));
const RolesPage = lazy(() => import('../setup/pages/RolesPage'));
const IncidentFormSettingsPage = lazy(() => import('../incident/pages/IncidentFormSettingsPage'));
const ServiceCategoryPage = lazy(() => import('../request/pages/ServiceCategoryPage'));
const CategoriesPage = lazy(() => import('../setup/pages/CategoriesPage'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Skeleton className="w-64 h-8" />
  </div>
);

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/tickets" element={<ItsmHomePage />} />
        <Route path="/tickets/incidents" element={<IncidentsPage />} />
        <Route path="/tickets/incidents/:id" element={<IncidentRoute />} />
        <Route path="/tickets/problems/:view" element={<ProblemsPage />} />
        <Route path="/tickets/service-requests" element={<ServiceCatalogPage />} />
        <Route path="/tickets/service-requests/catalog" element={<ServiceCatalogPage />} />
        <Route path="/tickets/service-requests/catalog/:key" element={<CatalogRequestPage />} />
        <Route path="/tickets/service-requests/items/:id" element={<RequestedItemPage />} />
        <Route path="/tickets/service-requests/tasks/:id" element={<CatalogTaskPage />} />
        <Route path="/tickets/service-requests/:view" element={<ServiceRequestsPage />} />
        <Route path="/tickets/changes/:view" element={<ChangesPage />} />
        <Route path="/tickets/groups" element={<GroupsPage startView="TECHNICIANS" />} />
        <Route path="/tickets/:section" element={<TicketsPage />} />
        <Route
          path="/setup"
          element={
            <SetupRoute>
              <SetupPage />
            </SetupRoute>
          }
        />
        <Route
          path="/setup/chat"
          element={
            <SetupRoute page="setup-chat">
              <ChatSettingsPage />
            </SetupRoute>
          }
        />
        <Route
          path="/setup/automation/life-cycles"
          element={
            <SetupRoute page="setup-automation">
              <LifeCyclesPage />
            </SetupRoute>
          }
        />
        <Route
          path="/setup/mail/addresses"
          element={
            <RoleRoute roles={['ROLE_ADMIN']}>
              <MailAddressesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/setup/mail/mailbox"
          element={
            <RoleRoute roles={['ROLE_ADMIN']}>
              <MailBoxPage />
            </RoleRoute>
          }
        />
        <Route
          path="/setup/mail/filter"
          element={
            <RoleRoute roles={['ROLE_ADMIN']}>
              <MailFilterPage />
            </RoleRoute>
          }
        />
        <Route
          path="/setup/mail/commands"
          element={
            <RoleRoute roles={['ROLE_ADMIN']}>
              <EmailCommandPage />
            </RoleRoute>
          }
        />
        <Route
          path="/setup/mail/:tab"
          element={
            <RoleRoute roles={['ROLE_ADMIN']}>
              <MailSettingsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/setup/automation/notification-templates"
          element={
            <SetupRoute page="setup-notifications">
              <NotificationTemplatesPage />
            </SetupRoute>
          }
        />
        <Route
          path="/setup/automation/sla"
          element={
            <SetupRoute page="setup-automation">
              <SlaPage />
            </SetupRoute>
          }
        />
        <Route
          path="/setup/automation/business-rules"
          element={
            <SetupRoute page="setup-automation">
              <BusinessRulesPage />
            </SetupRoute>
          }
        />
        <Route
          path="/setup/automation/notification-rules"
          element={
            <SetupRoute page="setup-notifications">
              <NotificationRulesPage />
            </SetupRoute>
          }
        />
        <Route
          path="/setup/service-category"
          element={
            <SetupRoute page="setup-categories">
              <ServiceCategoryPage />
            </SetupRoute>
          }
        />
        <Route
          path="/setup/roles"
          element={
            <RoleRoute roles={['ROLE_ADMIN']}>
              <RolesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/setup/incident-form"
          element={
            <SetupRoute page="setup-incident-form">
              <IncidentFormSettingsPage />
            </SetupRoute>
          }
        />
        <Route
          path="/setup/categories"
          element={
            <SetupRoute page="setup-categories">
              <CategoriesPage />
            </SetupRoute>
          }
        />
      </Route>

      {/* Everything else is the console */}
      <Route path="*" element={<LeaveToConsole />} />
    </Routes>
    </Suspense>
  );
}
