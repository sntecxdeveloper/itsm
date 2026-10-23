import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSetupAccess } from '../utils/access';

/**
 * A Setup page. Administrators open every one; anyone else opens it only if an administrator gave their role that Setup
 * section (Setup → Roles): "View" shows it with the controls switched off, "Edit" lets them change it.
 * Without `page` the route is the Setup home, shown to anyone who has at least one section.
 */
export default function SetupRoute({ page, children }: { page?: string; children: ReactNode }) {
  const { level, canEdit, hasAnySetup } = useSetupAccess();

  if (page ? level(page) === 'HIDDEN' : !hasAnySetup) return <Navigate to="/dashboard" replace />;
  if (!page || canEdit(page)) return <>{children}</>;

  // View only: the controls are switched off here; the server refuses a save from this role in any case.
  return (
    <div className="space-y-3">
      <p className="rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-700">View only: your role can look at this page but not change it.</p>
      <fieldset disabled className="m-0 min-w-0 border-0 p-0 opacity-90">
        {children}
      </fieldset>
    </div>
  );
}
