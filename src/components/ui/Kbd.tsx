import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-[5px] border border-line bg-panel-2 px-1 font-mono text-[10px] font-medium text-slate-500">
      {children}
    </kbd>
  );
}
