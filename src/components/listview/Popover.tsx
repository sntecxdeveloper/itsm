import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /** What the button says. */
  label: ReactNode;
  /** A small number or word on the button (how many conditions are set, for example). */
  badge?: ReactNode;
  title: string;
  width?: number;
  align?: 'left' | 'right';
  children: (close: () => void) => ReactNode;
}

/** A toolbar button that opens a panel under it. The panel closes on Escape or a click outside. */
export default function Popover({ label, badge, title, width = 380, align = 'left', children }: Props) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const w = Math.min(width, window.innerWidth - 16);
    const left = align === 'right' ? r.right - w : r.left;
    setPos({ left: Math.max(8, Math.min(left, window.innerWidth - w - 8)), top: r.bottom + 6 });
  }, [open, width, align]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || button.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={title}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
          open || badge ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-line bg-white text-slate-600 hover:border-line-strong hover:text-slate-900'
        }`}
      >
        {label}
        {badge !== undefined && badge !== null && badge !== '' && (
          <span className="rounded-full bg-primary-600 px-1.5 py-px font-mono text-[10px] leading-4 text-white">{badge}</span>
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label={title}
            style={{ left: pos.left, top: pos.top, width: Math.min(width, window.innerWidth - 16) }}
            className="fixed z-[60] max-h-[75vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xl"
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}
