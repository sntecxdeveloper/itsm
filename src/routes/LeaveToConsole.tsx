import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * The console and the ITSM app are two apps on one site. An address that belongs to the other app (a click on "Devices", a link back
 * to the sign-in page) is loaded from the server, which serves the right app for it. A counter stops a wrong server setup from looping.
 */
export default function LeaveToConsole() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    const key = 'dex.handoff';
    const count = Number(sessionStorage.getItem(key) ?? '0');
    if (count >= 3) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, String(count + 1));
    window.location.replace(`${pathname}${search}${hash}`);
  }, [pathname, search, hash]);
  return null;
}
