import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const supportedKeys = ['action', 'record', 'ticket', 'status', 'priority', 'category', 'assignee', 'description'];

type ParseResult = {
  matchedSubject: boolean;
  commandBlocks: string[];
  fields: Array<[string, string]>;
  errors: string[];
};

function parsePreview(subject: string, body: string, identifier: string, delimiter: string): ParseResult {
  const matchedSubject = identifier.trim().length > 0 && subject.toLowerCase().includes(identifier.trim().toLowerCase());
  if (!delimiter) {
    return { matchedSubject, commandBlocks: [], fields: [], errors: ['Set a command delimiter to parse attributes.'] };
  }

  const parts = body.split(delimiter);
  const commandBlocks = parts.filter((_, index) => index % 2 === 1).map((part) => part.trim()).filter(Boolean);
  const errors: string[] = [];
  if (parts.length % 2 === 0) errors.push(`A command block is missing its closing ${delimiter} delimiter.`);
  if (!matchedSubject) errors.push('Subject does not contain the configured email identifier.');
  if (matchedSubject && commandBlocks.length === 0) errors.push('No delimited command block was found in the email body.');

  const fields: Array<[string, string]> = [];
  commandBlocks.forEach((block) => {
    block.split(';').forEach((pair) => {
      const separator = pair.indexOf('=');
      if (separator < 1) {
        if (pair.trim()) errors.push(`Invalid command attribute: "${pair.trim()}". Use key=value.`);
        return;
      }
      const key = pair.slice(0, separator).trim().toLowerCase();
      const value = pair.slice(separator + 1).trim();
      if (!supportedKeys.includes(key)) {
        errors.push(`Unsupported attribute "${key}".`);
      } else if (!value) {
        errors.push(`Attribute "${key}" needs a value.`);
      } else {
        fields.push([key, value]);
      }
    });
  });

  return { matchedSubject, commandBlocks, fields, errors };
}

export default function EmailCommandPage() {
  const [identifier, setIdentifier] = useState('[ITSM]');
  const [delimiter, setDelimiter] = useState('$$');
  const [subject, setSubject] = useState('[ITSM] Request new laptop');
  const [body, setBody] = useState(
    'Please help with this request.\n\n$$action=create;record=incident;priority=high;category=hardware;description=New laptop request$$',
  );
  const preview = useMemo(
    () => parsePreview(subject, body, identifier, delimiter),
    [subject, body, identifier, delimiter],
  );

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs">
        <Link to="/setup" className="text-primary-700 hover:underline">Setup</Link>
        <span className="text-slate-300">›</span>
        <Link to="/setup/mail/server" className="text-primary-700 hover:underline">Mail Settings</Link>
        <span className="text-slate-300">›</span>
        <span className="text-slate-500">Email Command</span>
      </nav>

      <header>
        <h1 className="text-lg font-semibold text-slate-900">Email Command</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Configure a recognizable subject marker and delimited key-value syntax for commands sent by email.
          Commands can be designed to create, update, or transition ITSM records.
        </p>
      </header>

      <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Preview only — email command processing is not connected</p>
        <p className="mt-1 text-amber-800">
          This page parses the example in your browser to demonstrate the syntax. Settings are not saved and no
          ticket will be created, updated, or transitioned.
        </p>
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Command recognition</h2>
              <p className="mt-1 text-sm text-slate-500">Only messages with the subject identifier and command block should be interpreted as commands.</p>
            </div>
            <label className="block space-y-1 text-sm font-medium text-slate-700">
              Email subject identifier
              <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="[ITSM]" className={inputClass} />
              <span className="block text-xs font-normal text-slate-500">Example: [ITSM], @SDP@, or another distinctive subject tag.</span>
            </label>
            <label className="block space-y-1 text-sm font-medium text-slate-700">
              Command delimiter
              <input value={delimiter} onChange={(event) => setDelimiter(event.target.value)} maxLength={8} placeholder="$$" className={`${inputClass} max-w-40`} />
              <span className="block text-xs font-normal text-slate-500">Use the same delimiter at the start and end of the command block.</span>
            </label>
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected format</p>
              <code className="mt-2 block break-all text-sm text-slate-800">
                {delimiter || '$$'}action=create;record=incident;priority=high{delimiter || '$$'}
              </code>
              <p className="mt-2 text-xs text-slate-500">Separate key=value attributes with semicolons. Supported keys: {supportedKeys.join(', ')}.</p>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Command safety</h2>
              <p className="mt-1 text-sm text-slate-500">Email commands can make changes on behalf of the sender. A live processor should verify permissions before applying any command.</p>
            </div>
            <ul className="space-y-2 text-sm text-slate-700">
              <SafetyItem>Verify the sender against an authorized user or approved integration.</SafetyItem>
              <SafetyItem>Allow only explicitly supported actions and fields.</SafetyItem>
              <SafetyItem>Require a ticket identifier for update or transition commands.</SafetyItem>
              <SafetyItem>Record the sender, parsed command, and result in the audit log.</SafetyItem>
            </ul>
          </section>
        </div>

        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Try a command</h2>
            <p className="mt-1 text-sm text-slate-500">Edit the sample message and inspect what the local preview recognizes.</p>
          </div>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Email subject
            <input value={subject} onChange={(event) => setSubject(event.target.value)} className={inputClass} />
          </label>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Email body
            <textarea rows={7} value={body} onChange={(event) => setBody(event.target.value)} className={`${inputClass} resize-y font-mono text-xs`} />
          </label>

          <div className="rounded-md border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-800">Parse preview</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${preview.errors.length === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {preview.errors.length === 0 ? 'Syntax recognized' : 'Needs attention'}
              </span>
            </div>
            <div className="space-y-3 p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-600">Subject identifier</span>
                <span className={preview.matchedSubject ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>
                  {preview.matchedSubject ? 'Matched' : 'Not matched'}
                </span>
              </div>
              <div className="space-y-2">
                {preview.fields.length > 0 ? preview.fields.map(([key, value], index) => (
                  <div key={`${key}-${index}`} className="grid grid-cols-[minmax(100px,0.7fr)_minmax(0,1.3fr)] gap-3 rounded bg-slate-50 px-3 py-2 text-sm">
                    <code className="text-slate-500">{key}</code>
                    <span className="break-words font-medium text-slate-800">{value}</span>
                  </div>
                )) : (
                  <p className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-500">No command attributes parsed.</p>
                )}
              </div>
              {preview.errors.length > 0 && (
                <ul className="space-y-1 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {preview.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
                </ul>
              )}
              <p className="text-xs text-slate-500">
                The preview only parses text. It does not authenticate the sender or execute any command.
              </p>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}

function SafetyItem({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
      <span>{children}</span>
    </li>
  );
}
