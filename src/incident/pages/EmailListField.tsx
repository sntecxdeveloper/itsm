import { useState, type DragEvent, type KeyboardEvent } from 'react';

export interface KnownEmail {
  email: string;
  /** Where the address comes from, shown as a tooltip: "Requester", "Group member", "Used before"... */
  label: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POOL_TYPE = 'application/x-dex-pool';
const LIST_TYPE = 'application/x-dex-list';

export const splitEmails = (value: string): string[] => Array.from(new Set(value.split(/[,;\s]+/).filter(Boolean)));

const chip = 'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]';

/**
 * A list of email addresses kept as a comma-separated string. Addresses are added by typing a new one (Enter or
 * comma), by clicking a known address, or by dragging one in, from the known addresses or from the other list.
 */
export default function EmailListField({
  value,
  onChange,
  known,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  known: KnownEmail[];
  placeholder: string;
  label: string;
}) {
  const [draft, setDraft] = useState('');
  const [over, setOver] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const list = splitEmails(value);
  const save = (next: string[]) => onChange(next.join(','));

  const add = (raw: string) => {
    const emails = splitEmails(raw);
    const bad = emails.find((e) => !EMAIL_RE.test(e));
    if (bad) return setNote(`"${bad}" is not a valid email address.`);
    setNote(null);
    save(Array.from(new Set([...list, ...emails])));
  };
  const remove = (email: string) => save(list.filter((e) => e !== email));
  const commitDraft = () => {
    if (!draft.trim()) return;
    add(draft);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && !draft && list.length) remove(list[list.length - 1]);
  };

  const drop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setOver(false);
    const email = e.dataTransfer.getData('text/plain').trim();
    if (email) add(email);
  };
  const dragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(LIST_TYPE) ? 'move' : 'copy';
    setOver(true);
  };
  const start = (e: DragEvent<HTMLElement>, email: string, type: string) => {
    e.dataTransfer.setData('text/plain', email);
    e.dataTransfer.setData(type, '1');
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const suggestions = known.filter((k, i) => !list.includes(k.email) && known.findIndex((x) => x.email === k.email) === i);

  return (
    <div className="relative min-w-0" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setShowSaved(false)}>
      <div
        onDragOver={dragOver}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={`flex min-h-[32px] flex-wrap items-center gap-1 rounded border bg-white px-1.5 py-1 ${
          over ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-slate-300'
        }`}
      >
        {list.map((email) => (
          <span
            key={email}
            draggable
            onDragStart={(e) => start(e, email, LIST_TYPE)}
            // Dropped on the other list (a "move"): it leaves this one.
            onDragEnd={(e) => e.dataTransfer.dropEffect === 'move' && remove(email)}
            title="Drag to the other list to move it"
            className={`${chip} cursor-grab border-primary-200 bg-primary-50 text-primary-800`}
          >
            <span className="truncate">{email}</span>
            <button type="button" aria-label={`Remove ${email}`} onClick={() => remove(email)} className="text-primary-400 hover:text-red-600">
              ×
            </button>
          </span>
        ))}
        {suggestions.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSaved((v) => !v)}
            aria-expanded={showSaved}
            aria-label={showSaved ? 'Hide saved emails' : 'Show saved emails'}
            title={showSaved ? 'Hide saved emails' : 'Show saved emails'}
            className="order-last ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
          >
            <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${showSaved ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={commitDraft}
          aria-label={label}
          placeholder={list.length ? '' : placeholder}
          className="min-w-[140px] flex-1 border-0 bg-transparent p-0.5 !text-[11px] outline-none focus:ring-0"
        />
      </div>
      {note && <p className="mt-0.5 text-[11px] text-red-600">{note}</p>}
      {showSaved && suggestions.length > 0 && (
        <ul role="listbox" aria-label={`Saved emails for ${label}`} className="absolute left-0 right-0 z-20 mt-0.5 max-h-56 overflow-auto rounded border border-slate-300 bg-white py-1 shadow-lg">
          {suggestions.map((k) => (
            <li key={k.email} role="option" aria-selected={false}>
              <button
                type="button"
                draggable
                onDragStart={(e) => start(e, k.email, POOL_TYPE)}
                onClick={() => {
                  add(k.email);
                  setShowSaved(false);
                }}
                title="Click to add, or drag into the box"
                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[12px] text-slate-800 hover:bg-primary-600 hover:text-white"
              >
                <span className="truncate">{k.email}</span>
                <span className="shrink-0 text-[10px] opacity-60">{k.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
