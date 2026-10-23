import { Fragment, useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { setSidebarOpen } from '../store/uiSlice';
import { logout, setUser } from '../store/authSlice';
import { ROLE_LABELS } from '../utils/constants';
import { useSetupAccess } from '../utils/access';
import NotificationCenter from '../components/common/NotificationCenter';
import { getImpersonator, stopImpersonating } from '../api/authApi';
import ImpersonateModal from '../components/common/ImpersonateModal';
import HeaderSearch from '../components/common/HeaderSearch';
import { Badge } from '../components/ui/Badge';
import { loadChatSettings } from '../utils/chatSettings';
import { arrange, useLayoutArea } from '../hooks/useLayoutArea';
import { useUiLayouts } from '../context/UiLayoutContext';
import { useAccess } from '../context/AccessContext';
import { usePageCustomizeRegistry } from '../context/PageCustomizeContext';
import ArrangeModal from '../components/customization/ArrangeModal';

/** The shortcut icons the top bar can show. They are off until a person turns them on (Customize top bar), so the bar stays clean. */
const SHORTCUT_KEYS = ['new-incident', 'run-fix', 'fix-history', 'tickets', 'chat', 'help'];

export default function Header() {
  const chatEnabled = loadChatSettings().enabled;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { devices, issues } = useAppSelector((state) => state.dashboard);
  const { hasAnySetup } = useSetupAccess();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const roleLabel = user?.role ? ROLE_LABELS[user.role] || user.role : '';
  // Defensive: see the matching comment in Sidebar.tsx - both default to []
  // in dashboardSlice's initialState, but guard here too since this render
  // path hit the same undefined-array crash in production.
  const onlineCount = (devices ?? []).filter((d) => d.status === 'ONLINE').length;
  const criticalIssues = (issues ?? []).filter((i) => i.severity === 'CRITICAL' && i.status === 'OPEN').length;

  const { tickets } = useAppSelector((state) => state.itsm);
  const openTickets = (tickets ?? []).filter((t) => t.status === 'OPEN').length;
  const canSeeTickets = user?.role === 'ROLE_ADMIN' || user?.role === 'ROLE_ITSM_TECHNICIAN';
  const canRemediate = user?.role === 'ROLE_ADMIN' || user?.role === 'ROLE_OPERATOR';
  const iconBtn = 'relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100/70 hover:text-slate-700';
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const isAdmin =user?.role === 'ROLE_ADMIN';
  // Only offered while an admin is acting as someone else.
  const impersonator = getImpersonator();
  const isImpersonating = !!impersonator && !!user && impersonator.id !== user.id;
  const handleUnimpersonate = async () => {
    const admin = await stopImpersonating();
    if (admin) {
      dispatch(setUser(admin));
      window.location.assign('/admin/users');
    } else {
      dispatch(logout());
      navigate('/login');
    }
  };
  // The shortcut icons, each only for people who can use what it opens; the person picks which of them show.
  const linkIcon = (key: string, label: string, to: string, path: string, badge = 0) => ({
    key,
    label,
    node: (
      <Link to={to} aria-label={label} title={label} className={iconBtn}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d={path} />
        </svg>
        {badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    ),
  });
  const allShortcuts = [
    ...(canSeeTickets ? [linkIcon('new-incident', 'New incident', '/tickets/incidents/new', 'M3 3v18M3 4.5h13.5l-2.25 3.75L16.5 12H3M18 15.75v4.5M15.75 18h4.5')] : []),
    ...(canRemediate ? [linkIcon('run-fix', 'Run a fix', '/remediation/execute', 'm3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z'), linkIcon('fix-history', 'Remediation history', '/remediation', 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z')] : []),
    ...(canSeeTickets ? [linkIcon('tickets', 'Open tickets', '/tickets', 'M4.5 4.5h10.5M4.5 9h6m-6 4.5h4.5m-4.5 4.5h7.5M13.5 15l2.25 2.25L20.25 12.75', openTickets)] : []),
    ...(chatEnabled ? [linkIcon('chat', 'Chat', '/ai-chat', 'M8.625 9.75h6.75m-6.75 3h4.5m-9 6.75 1.8-3.6a8.25 8.25 0 1 1 3.05 2.28l-4.85 1.32Z')] : []),
    linkIcon('help', 'Help and knowledge base', '/knowledge', 'M9.879 7.519a3 3 0 0 1 5.842 1c0 2-3 3-3 3m.03 3h.008M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'),
  ];
  const barLayout = useLayoutArea('header');
  const shownShortcuts = arrange(allShortcuts, barLayout.arrangement ?? { order: [], hidden: SHORTCUT_KEYS });
  const [arrangingBar, setArrangingBar] = useState(false);

  // One Customize icon for whichever page is open (the page tells what can be customized on it).
  const { level: customizeLevel } = useUiLayouts();
  const { can } = useAccess();
  const { config: pageConfig } = usePageCustomizeRegistry();
  const [customizing, setCustomizing] = useState(false);
  const canCustomizePage = !!pageConfig && customizeLevel !== 'NONE' && can(`${pageConfig.page}.customize`);
  const customizeIcon = canCustomizePage ? (
    <button type="button" onClick={() => setCustomizing(true)} aria-label="Customize this page" title="Customize this page" className={iconBtn}>
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
      </svg>
    </button>
  ) : null;

  const menuItems: { label: string; icon: string; to?: string; onClick?: () => void; disabled?: boolean }[] = [
    { label: 'Profile', to: '/security', icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.5-1.632Z' },
    ...(isAdmin
      ? [
          { label: 'Preferences', to: '/settings', icon: 'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75' },
          { label: 'Impersonate user', onClick: () => setImpersonateOpen(true), icon: 'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' },
          { label: 'Elevate role', disabled: true, icon: 'M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18' },
        ]
      : []),
    ...(isImpersonating
      ? [{ label: 'Unimpersonate user', onClick: handleUnimpersonate, icon: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9' }]
      : []),
    ...(customizeLevel !== 'NONE' ? [{ label: 'Customize top bar', onClick: () => setArrangingBar(true), icon: 'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75' }] : []),
    { label: 'Printer friendly version', onClick: () => window.print(), icon: 'M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z' },
  ];

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-[var(--dex-header-bg,var(--color-canvas))]/80 px-4 backdrop-blur-xl sm:px-6">
      {/* Left — mobile menu */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          onClick={() => dispatch(setSidebarOpen(true))}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100/70 hover:text-slate-700 lg:hidden"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </div>

      {/* Right — search, shortcuts, status, notifications, user */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <HeaderSearch />

        {/* Fleet pulse */}
        <div className="mr-1 hidden items-center gap-2 lg:flex">
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-mono text-xs text-slate-700">{onlineCount}</span>
            <span className="text-xs text-slate-500">online</span>
          </div>
          {criticalIssues > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-red-400 opacity-50" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-red-400" />
              </span>
              <span className="font-mono text-xs text-red-600">{criticalIssues}</span>
              <span className="text-xs text-red-500">critical</span>
            </div>
          )}
        </div>

        {customizeIcon}
        {shownShortcuts.map((s) => (
          <Fragment key={s.key}>{s.node}</Fragment>
        ))}

        <NotificationCenter />

        <Link
          to={isAdmin || hasAnySetup ? '/setup' : '/security'}
          aria-label="Settings"
          title="Settings"
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100/70 hover:text-slate-700"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </Link>

        <div className="mx-1 hidden h-6 w-px bg-line sm:block" />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100/70"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-800 font-display text-sm font-semibold text-white shadow-cta">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-[13px] font-medium leading-tight text-slate-800">{user?.username || 'User'}</p>
              <p className="text-[10px] leading-tight text-slate-500">{roleLabel}</p>
            </div>
            <svg
              className={`hidden h-3.5 w-3.5 text-slate-500 transition-transform duration-200 sm:block ${menuOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-raised shadow-pop"
              >
                <div className="border-b border-line px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-800 font-display text-sm font-semibold text-white">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{user?.username}</p>
                      <p className="truncate text-xs text-slate-500">{user?.email}</p>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <Badge tone="primary" dot>
                      {roleLabel}
                    </Badge>
                  </div>
                </div>

                <div className="p-1.5">
                  {menuItems.map((item) => {
                    const cls =
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-100/70 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent';
                    const icon = (
                      <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                    );
                    return item.to ? (
                      <Link key={item.label} to={item.to} onClick={() => setMenuOpen(false)} className={cls}>
                        {icon}
                        {item.label}
                      </Link>
                    ) : (
                      <button
                        key={item.label}
                        onClick={() => {
                          setMenuOpen(false);
                          item.onClick?.();
                        }}
                        disabled={item.disabled}
                        title={item.disabled ? 'Not available yet — needs backend support' : undefined}
                        className={cls}
                      >
                        {icon}
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-line p-1.5">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-red-600 transition-colors hover:bg-red-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                    Log out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {impersonateOpen && <ImpersonateModal onClose={() => setImpersonateOpen(false)} />}
      {customizing && pageConfig && (
        <ArrangeModal area={pageConfig.area} title={pageConfig.title} items={pageConfig.items} sectionKey={pageConfig.sectionKey} onClose={() => setCustomizing(false)} />
      )}
      {arrangingBar && (
        <ArrangeModal area="header" title="Customize the top bar" items={allShortcuts.map((s) => ({ key: s.key, label: s.label }))} defaultHidden={SHORTCUT_KEYS} onClose={() => setArrangingBar(false)} />
      )}
    </header>
  );
}
