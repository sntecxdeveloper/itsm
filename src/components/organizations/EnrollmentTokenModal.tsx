import { useState } from 'react';
import { Button } from '../ui/Button';

interface Props {
  organizationName: string;
  token: string;
  /** True when this is a replacement for an earlier token. */
  replaced?: boolean;
  onClose: () => void;
}

/**
 * Shows a company's enrollment token ONCE. The server keeps only a hash of it, so it cannot be read again: if it is lost, make a new one.
 * The installer built for the company carries the token, and every PC that runs it enrolls into this company by itself.
 */
export default function EnrollmentTokenModal({ organizationName, token, replaced = false, onClose }: Props) {
  const [copied, setCopied] = useState<'token' | 'command' | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const command = `powershell -ExecutionPolicy Bypass -File tools\\Build-OrganizationInstaller.ps1 -OrganizationName "${organizationName}"`;

  const copy = async (what: 'token' | 'command', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* the text is selectable, so it can still be copied by hand */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Enrollment token"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-2xl bg-white p-6 shadow-xl"
      >
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-primary-500">{replaced ? 'New enrollment token' : 'Enrollment token'}</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">{organizationName}</h2>
        <p className="mt-1 text-sm text-amber-700">Copy this token now. It is shown only once and cannot be read again.</p>

        <div className="mt-4">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Token</span>
          <div className="flex items-stretch gap-2">
            <code data-testid="enrollment-token" className="block flex-1 select-all break-all rounded-lg border border-line bg-slate-50 px-3 py-2 font-mono text-[12px] text-slate-800">
              {token}
            </code>
            <Button variant="secondary" size="sm" onClick={() => void copy('token', token)}>
              {copied === 'token' ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-line bg-slate-50/60 p-4 text-[13px] text-slate-700">
          <p className="font-semibold text-slate-800">Build this company's installer</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>Publish the agent as usual so the files are ready.</li>
            <li>
              Run this on the build PC, and paste the token when it asks (it is hidden as you type):
              <div className="mt-1.5 flex items-stretch gap-2">
                <code className="block flex-1 select-all break-all rounded-md border border-line bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-700">{command}</code>
                <Button variant="secondary" size="sm" onClick={() => void copy('command', command)}>
                  {copied === 'command' ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </li>
            <li>Give the finished installer only to {organizationName}. Every PC that runs it joins this company on its own.</li>
          </ol>
          <p className="mt-3 text-[12px] text-slate-500">
            The installer contains the token, so treat it like a password. If it ever leaks, make a new token here: PCs already enrolled keep working, and the old installer stops enrolling new ones.
          </p>
        </div>

        <label className="mt-4 flex items-start gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-sky-600" />
          <span>I have copied the token and will keep it safe.</span>
        </label>

        <div className="mt-4 flex justify-end">
          <Button onClick={onClose} disabled={!confirmed}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
