import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getMyLayouts,
  resetLayoutAt,
  resetMyLayout,
  saveLayoutAt,
  saveMyLayout,
  type CustomizeLevel,
  type LayoutScope,
  type ResolvedLayout,
} from '../api/uiLayoutApi';
import { useAppSelector } from '../hooks/useAppSelector';
import { useLocation } from 'react-router-dom';
import { applyTheme, type ThemeConfig } from '../utils/themeColors';
import { countUse } from '../api/insightsApi';
import { NAV_ITEMS } from '../utils/constants';

interface UiLayoutState {
  ready: boolean;
  level: CustomizeLevel;
  groups: { id: number; name: string }[];
  layouts: Record<string, ResolvedLayout>;
  refresh: () => Promise<void>;
  saveMine: (area: string, config: Record<string, unknown>) => Promise<void>;
  resetMine: (area: string) => Promise<void>;
  saveAt: (scope: LayoutScope, key: string, area: string, config: Record<string, unknown>, locked: boolean) => Promise<void>;
  resetAt: (scope: LayoutScope, key: string, area: string) => Promise<void>;
}

const UiLayoutContext = createContext<UiLayoutState | null>(null);

/**
 * Loads every console layout that applies to the signed-in person once, and keeps it fresh after a change. A server without this
 * feature (or a failure) simply means no layouts: every page keeps its built-in arrangement.
 */
export function UiLayoutProvider({ children }: { children: ReactNode }) {
  const user = useAppSelector((s) => s.auth.user);
  const [ready, setReady] = useState(false);
  const [level, setLevel] = useState<CustomizeLevel>('NONE');
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [layouts, setLayouts] = useState<Record<string, ResolvedLayout>>({});

  const refresh = useCallback(async () => {
    try {
      const mine = await getMyLayouts();
      setLevel(mine.level);
      setGroups(mine.groups);
      setLayouts(mine.layouts ?? {});
    } catch {
      setLayouts({});
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  const value = useMemo<UiLayoutState>(
    () => ({
      ready,
      level,
      groups,
      layouts,
      refresh,
      saveMine: async (area, config) => {
        await saveMyLayout(area, config);
        await refresh();
      },
      resetMine: async (area) => {
        await resetMyLayout(area);
        await refresh();
      },
      saveAt: async (scope, key, area, config, locked) => {
        await saveLayoutAt(scope, key, area, config, locked);
        await refresh();
      },
      resetAt: async (scope, key, area) => {
        await resetLayoutAt(scope, key, area);
        await refresh();
      },
    }),
    [ready, level, groups, layouts, refresh],
  );

  // Colors (area "theme"): applied for the whole app, with the open section's own color when it has one.
  const location = useLocation();
  const section = location.pathname.split('/')[1] ?? '';
  const theme = (layouts.theme?.config as ThemeConfig | undefined) ?? null;
  useEffect(() => {
    applyTheme(theme, section);
  }, [theme, section]);
  useEffect(() => () => applyTheme(null, ''), []);

  // Which menu entry this page belongs to, counted once per visit (for suggested layouts). Only the count is kept.
  useEffect(() => {
    if (!user) return;
    const match = NAV_ITEMS.filter((i) => location.pathname === i.path || location.pathname.startsWith(`${i.path}/`)).sort((a, b) => b.path.length - a.path.length)[0];
    if (match) void countUse(match.icon).catch(() => undefined);
  }, [location.pathname, user]);

  return <UiLayoutContext.Provider value={value}>{children}</UiLayoutContext.Provider>;
}

const EMPTY: UiLayoutState = {
  ready: true,
  level: 'NONE',
  groups: [],
  layouts: {},
  refresh: async () => undefined,
  saveMine: async () => undefined,
  resetMine: async () => undefined,
  saveAt: async () => undefined,
  resetAt: async () => undefined,
};

export function useUiLayouts(): UiLayoutState {
  return useContext(UiLayoutContext) ?? EMPTY;
}
