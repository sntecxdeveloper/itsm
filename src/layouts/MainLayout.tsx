import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../motion';
import { useAppSelector } from '../hooks/useAppSelector';
import ErrorBoundary from '../components/common/ErrorBoundary';
import Loading from '../components/common/Loading';
import { hydrateSetupSettings } from '../utils/setupSync';
import { AccessContext, pageKeyForPath } from '../utils/access';
import { getMyAccess, type MyAccess } from '../api/accessApi';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import { UiLayoutProvider } from '../context/UiLayoutContext';
import { PageCustomizeProvider } from '../context/PageCustomizeContext';
import { AccessProvider, pageOfPath, useAccess } from '../context/AccessContext';
import NoAccess from '../components/access/NoAccess';

/** The page itself, or "not part of your role" when the person's role hides it. */
function GuardedOutlet({ pathname }: { pathname: string }) {
  const { page } = useAccess();
  const key = pageOfPath(pathname);
  if (key && page(key) === 'HIDDEN') return <NoAccess />;
  return <Outlet />;
}

export default function MainLayout() {
  const { sidebarCollapsed } = useAppSelector((state) => state.ui);
  const location = useLocation();
  const role = useAppSelector((state) => state.auth.user?.role);

  // The Setup settings come from the server: load them before the pages read them (the browser's copy is used if the server is unreachable).
  const [setupReady, setSetupReady] = useState(false);
  const [access, setAccess] = useState<MyAccess | null>(null);

  // A page an administrator hid from this person's role cannot be opened, even by typing its address.
  const pageKey = pageKeyForPath(location.pathname);
  const blocked = role !== 'ROLE_ADMIN' && pageKey && access?.pages[pageKey] === 'HIDDEN' ? pageKey : null;
  useEffect(() => {
    let live = true;
    setSetupReady(false);
    // What this person may open in Setup comes from the server too (their role, set by an administrator).
    getMyAccess()
      .catch(() => null)
      .then((a) => {
        if (!live) return undefined;
        setAccess(a);
        // Someone whose role may edit a Setup section also saves their changes to the server (the server checks each one).
        const canEdit = role === 'ROLE_ADMIN' || Object.entries(a?.actions ?? {}).some(([k, v]) => k.startsWith('setup-') && v);
        return hydrateSetupSettings(role === 'ROLE_ADMIN', canEdit);
      })
      .finally(() => live && setSetupReady(true));
    return () => {
      live = false;
    };
  }, [role]);

  return (
    <AccessContext.Provider value={access}>
    <AccessProvider>
    <UiLayoutProvider>
    <PageCustomizeProvider>
    <div className="min-h-dvh bg-canvas">
      <Sidebar />
      <div
        className={`flex min-h-dvh flex-col transition-[margin] duration-200 ease-out ${
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
        }`}
      >
        <Header />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">
            {/* Page-level boundary: a crash in one page keeps the sidebar usable and clears on navigation. */}
            <ErrorBoundary resetKey={location.pathname}>
              {/* Enter-only: the new page rises in at once; nothing waits for the old one to leave. */}
              {setupReady && blocked ? (
                blocked === 'dashboard' ? (
                  <div className="py-16 text-center">
                    <h2 className="text-lg font-semibold text-slate-900">No access</h2>
                    <p className="mt-1 text-sm text-slate-500">Your role does not include this page. Ask an administrator.</p>
                    <Link to="/tickets" className="mt-3 inline-block text-sm text-primary-700 hover:underline">
                      Go to ITSM
                    </Link>
                  </div>
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : setupReady ? (
                <motion.div key={location.pathname} variants={fadeUp} initial="hidden" animate="show">
                  <GuardedOutlet pathname={location.pathname} />
                </motion.div>
              ) : (
                <Loading />
              )}
            </ErrorBoundary>
          </div>
        </main>
        <Footer />
      </div>
    </div>
    </PageCustomizeProvider>
    </UiLayoutProvider>
    </AccessProvider>
    </AccessContext.Provider>
  );
}
