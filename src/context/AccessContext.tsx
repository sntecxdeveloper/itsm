import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMyAccess, type EffectiveAccess, type PageLevel } from '../api/accessApi';
import { useAppSelector } from '../hooks/useAppSelector';
import { ACTION_PERMISSIONS, NAV_PERMISSIONS } from '../utils/constants';

/** The console page each address belongs to (ITSM and the administrators' area are not part of roles). */
export const PATH_PAGE: [string, string][] = [
  ['/dashboard', 'dashboard'],
  ['/devices', 'devices'],
  ['/groups', 'groups'],
  ['/issues', 'issues'],
  ['/deleted', 'deleted'],
  ['/remediation', 'remediation'],
  ['/knowledge', 'knowledge'],
  ['/kb-articles', 'knowledge'],
  ['/scripts', 'knowledge'],
  ['/ai-chat', 'ai-chat'],
  ['/ai-tasks', 'ai-tasks'],
  ['/assets', 'assets'],
  ['/reports', 'reports'],
  ['/alerts', 'alerts'],
  ['/audit-logs', 'audit'],
  ['/security', 'security'],
];

/** The menu entry (icon key) of each page. */
export const MENU_PAGE: Record<string, string> = {
  dashboard: 'dashboard',
  devices: 'devices',
  groups: 'groups',
  issues: 'issues',
  deleted: 'deleted',
  remediation: 'remediation',
  execute: 'remediation',
  knowledge: 'knowledge',
  aichat: 'ai-chat',
  aitasks: 'ai-tasks',
  assets: 'assets',
  reports: 'reports',
  alerts: 'alerts',
  audit: 'audit',
  security: 'security',
};

export function pageOfPath(pathname: string): string | null {
  const hit = PATH_PAGE.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  return hit ? hit[1] : null;
}

/** What the old built-in rules said, used until the server answers (or if it is older than configurable roles). */
const LEGACY_ACTIONS: Record<string, string[]> = {
  'devices.delete': ACTION_PERMISSIONS.DELETE_DEVICE,
  'issues.delete': ACTION_PERMISSIONS.DELETE_ISSUE,
  'issues.status': ACTION_PERMISSIONS.UPDATE_ISSUE_STATUS,
  'issues.assign': ACTION_PERMISSIONS.ASSIGN_ISSUE,
  'knowledge.edit': ACTION_PERMISSIONS.MANAGE_KB_CONTENT,
  'knowledge.approve': ACTION_PERMISSIONS.APPROVE_KB_ARTICLE,
  'devices.fix': ACTION_PERMISSIONS.MANAGE_KB_CONTENT,
  'remediation.run': ACTION_PERMISSIONS.CREATE_REMEDIATION,
  'groups.edit': ACTION_PERMISSIONS.MANAGE_GROUPS,
  'deleted.restore': ACTION_PERMISSIONS.DELETE_ISSUE,
};
const LEGACY_PAGE_PATH: Record<string, string> = {
  dashboard: '/dashboard', devices: '/devices', groups: '/groups', issues: '/issues', deleted: '/deleted', remediation: '/remediation',
  knowledge: '/knowledge', 'ai-chat': '/ai-chat', 'ai-tasks': '/ai-tasks', assets: '/assets', reports: '/reports', alerts: '/alerts',
  audit: '/audit-logs', security: '/security',
};

interface AccessState {
  ready: boolean;
  access: EffectiveAccess | null;
  page: (key: string) => PageLevel;
  can: (action: string) => boolean;
  isRequired: (page: string) => boolean;
  refresh: () => Promise<void>;
}

const AccessContext = createContext<AccessState | null>(null);

/** Loads what the signed-in person may see and use, once; the console hides and disables accordingly (the server enforces it too). */
export function AccessProvider({ children }: { children: ReactNode }) {
  const user = useAppSelector((s) => s.auth.user);
  const [access, setAccess] = useState<EffectiveAccess | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setAccess(await getMyAccess());
    } catch {
      setAccess(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  const value = useMemo<AccessState>(() => {
    const role = user?.role ?? '';
    const page = (key: string): PageLevel => {
      if (role === 'ROLE_ADMIN') return 'FULL';
      if (access?.pages[key]) return access.pages[key];
      const path = LEGACY_PAGE_PATH[key];
      const roles = path ? NAV_PERMISSIONS[path] : undefined;
      return !roles || roles.includes(role) ? 'FULL' : 'HIDDEN';
    };
    const can = (action: string): boolean => {
      if (role === 'ROLE_ADMIN') return true;
      if (access && action in access.actions) return !!access.actions[action];
      // "Customize this page" is for everyone until an administrator takes it away from a role.
      if (action.endsWith('.customize')) return true;
      return (LEGACY_ACTIONS[action] ?? []).includes(role);
    };
    return { ready, access, page, can, isRequired: (p) => !!access?.required.includes(p), refresh };
  }, [access, ready, user?.role, refresh]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessState {
  const ctx = useContext(AccessContext);
  if (ctx) return ctx;
  return { ready: true, access: null, page: () => 'FULL', can: () => true, isRequired: () => false, refresh: async () => undefined };
}
