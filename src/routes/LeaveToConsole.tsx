import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * The console and the ITSM app are two apps on one site. An address that belongs to the other app (a click on "Devices", a link back
 * to the sign-in page) is loaded from the server, which serves the right app for it. A counter stops a wrong server setup from looping.
 */
export default function LeaveToConsole() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    // Only a loop is stopped: the same address handed over again and again within a few seconds (a wrong server setup). Normal
    // switching between the apps never counts up, however often it happens.
    const key = 'dex.handoff';
    const target = `${pathname}${search}${hash}`;
    let last: { target?: string; at?: number; count?: number } = {};
    try {
      last = JSON.parse(sessionStorage.getItem(key) ?? '{}');
    } catch {
      last = {};
    }
    const now = Date.now();
    const count = last.target === target && now - (last.at ?? 0) < 5000 ? (last.count ?? 0) + 1 : 1;
    if (count > 3) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, JSON.stringify({ target, at: now, count }));
    window.location.replace(target);
  }, [pathname, search, hash]);
  return null;
}
