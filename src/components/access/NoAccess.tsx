import { Link } from 'react-router-dom';

/** Shown instead of a page the person's role does not include. */
export default function NoAccess() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="max-w-sm text-center">
        <svg className="mx-auto mb-3 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        <h2 className="text-lg font-semibold text-slate-900">This page is not part of your role</h2>
        <p className="mt-1 text-sm text-slate-500">Your administrator has not given you access to it. Ask them if you need it.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm font-medium text-primary-600 hover:text-primary-700">
          Back to the dashboard
        </Link>
      </div>
    </div>
  );
}
