import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ArrangeItem } from '../components/customization/ArrangeModal';

/** What the open page offers to customize: its parts (in the page's own order) and which access page it belongs to. */
export interface PageCustomizeConfig {
  /** The layout area, e.g. "page.devices". */
  area: string;
  title: string;
  /** The role-system page ("devices"): whether the person may customize it follows "<page>.customize". */
  page: string;
  /** First part of the address, for the section's own color ("devices", "issues"...). */
  sectionKey?: string;
  items: ArrangeItem[];
}

interface Registry {
  config: PageCustomizeConfig | null;
  register: (config: PageCustomizeConfig) => void;
  clear: (area: string) => void;
}

const PageCustomizeContext = createContext<Registry | null>(null);

/**
 * The open page tells the top bar what can be customized on it; the one Customize icon in the top bar then works for every page,
 * so no page needs its own button.
 */
export function PageCustomizeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PageCustomizeConfig | null>(null);
  const register = useCallback((c: PageCustomizeConfig) => setConfig(c), []);
  const clear = useCallback((area: string) => setConfig((c) => (c?.area === area ? null : c)), []);
  const value = useMemo(() => ({ config, register, clear }), [config, register, clear]);
  return <PageCustomizeContext.Provider value={value}>{children}</PageCustomizeContext.Provider>;
}

const NONE: Registry = { config: null, register: () => undefined, clear: () => undefined };

export function usePageCustomizeRegistry(): Registry {
  return useContext(PageCustomizeContext) ?? NONE;
}
